import type { CreatedSession, StoredChallenge, StoredPasskeyCredential, WebAuthnPurpose } from '../auth/types';
import type { D1Database } from './cloudflare';
import type { AuthStore } from './AuthStore';
import { sha256Hex } from './session';

type CredentialRow = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: ArrayBuffer | Uint8Array;
  sign_count: number;
  transports_json: string;
  created_at: number;
};

type ChallengeRow = {
  challenge_hash: string;
  user_id: string | null;
  purpose: WebAuthnPurpose;
  expires_at: number;
  created_at: number;
};

const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export class D1AuthStore implements AuthStore {
  constructor(private readonly db: D1Database) {}

  async createUser(now: number): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.prepare('INSERT INTO users (id, created_at) VALUES (?, ?)').bind(id, now).run();
    return id;
  }

  async createChallenge(input: {
    challengeHash: string;
    userId: string | null;
    purpose: WebAuthnPurpose;
    expiresAt: number;
    now: number;
  }): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO webauthn_challenges (
          challenge_hash, user_id, purpose, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(challenge_hash) DO UPDATE SET
          user_id = excluded.user_id,
          purpose = excluded.purpose,
          expires_at = excluded.expires_at,
          created_at = excluded.created_at
      `)
      .bind(input.challengeHash, input.userId, input.purpose, input.expiresAt, input.now)
      .run();
  }

  async consumeChallenge(
    challengeHash: string,
    purpose: WebAuthnPurpose,
    now: number,
  ): Promise<StoredChallenge | null> {
    const row = await this.db
      .prepare(`
        DELETE FROM webauthn_challenges
        WHERE challenge_hash = ? AND purpose = ? AND expires_at > ?
        RETURNING challenge_hash, user_id, purpose, expires_at, created_at
      `)
      .bind(challengeHash, purpose, now)
      .first<ChallengeRow>();
    return row ? this.challengeFromRow(row) : null;
  }

  async credentialByCredentialId(credentialId: string): Promise<StoredPasskeyCredential | null> {
    const row = await this.db
      .prepare(`
        SELECT id, user_id, credential_id, public_key, sign_count, transports_json, created_at
        FROM passkey_credentials
        WHERE credential_id = ?
        LIMIT 1
      `)
      .bind(credentialId)
      .first<CredentialRow>();
    return row ? this.credentialFromRow(row) : null;
  }

  async credentialsForUser(userId: string): Promise<StoredPasskeyCredential[]> {
    const result = await this.db
      .prepare(`
        SELECT id, user_id, credential_id, public_key, sign_count, transports_json, created_at
        FROM passkey_credentials
        WHERE user_id = ?
        ORDER BY created_at ASC
      `)
      .bind(userId)
      .all<CredentialRow>();
    return (result.results ?? []).map((row) => this.credentialFromRow(row));
  }

  async saveCredential(credential: StoredPasskeyCredential): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO passkey_credentials (
          id, user_id, credential_id, public_key, sign_count, transports_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        credential.id,
        credential.userId,
        credential.credentialId,
        credential.publicKey,
        credential.signCount,
        JSON.stringify(credential.transports),
        credential.createdAt,
      )
      .run();
  }

  async updateCredentialCounter(credentialId: string, signCount: number): Promise<void> {
    await this.db
      .prepare('UPDATE passkey_credentials SET sign_count = ? WHERE credential_id = ?')
      .bind(signCount, credentialId)
      .run();
  }

  async createSession(
    userId: string,
    now: number,
    ttlMs = DEFAULT_SESSION_TTL_MS,
  ): Promise<CreatedSession> {
    const token = randomToken(32);
    const idHash = await sha256Hex(token);
    const expiresAt = now + Math.max(60_000, ttlMs);
    await this.db
      .prepare('INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(idHash, userId, expiresAt, now)
      .run();
    return { token, expiresAt };
  }

  async revokeSession(token: string): Promise<void> {
    const idHash = await sha256Hex(token);
    await this.db.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(idHash).run();
  }

  async purgeExpired(now: number): Promise<void> {
    await this.db.batch([
      this.db.prepare('DELETE FROM webauthn_challenges WHERE expires_at <= ?').bind(now),
      this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    ]);
  }

  private credentialFromRow(row: CredentialRow): StoredPasskeyCredential {
    return {
      id: row.id,
      userId: row.user_id,
      credentialId: row.credential_id,
      publicKey: toArrayBufferBackedUint8Array(row.public_key),
      signCount: row.sign_count,
      transports: parseStringArray(row.transports_json),
      createdAt: row.created_at,
    };
  }

  private challengeFromRow(row: ChallengeRow): StoredChallenge {
    return {
      challengeHash: row.challenge_hash,
      userId: row.user_id,
      purpose: row.purpose,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toArrayBufferBackedUint8Array(value: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const source = value instanceof Uint8Array ? value : new Uint8Array(value);
  const copy = new Uint8Array(new ArrayBuffer(source.byteLength));
  copy.set(source);
  return copy;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
