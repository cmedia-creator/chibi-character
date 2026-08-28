import type { D1Database } from './cloudflare';

export interface StoredPasswordCredential {
  userId: string;
  loginId: string;
  passwordSalt: string;
  passwordHash: string;
  passwordIterations: number;
  recoverySalt: string;
  recoveryHash: string;
  recoveryIterations: number;
  createdAt: number;
  updatedAt: number;
}

type CredentialRow = {
  user_id: string;
  login_id: string;
  password_salt: string;
  password_hash: string;
  password_iterations: number;
  recovery_salt: string;
  recovery_hash: string;
  recovery_iterations: number;
  created_at: number;
  updated_at: number;
};

export class PasswordAuthStore {
  constructor(private readonly db: D1Database) {}

  async createUserWithCredential(credential: StoredPasswordCredential): Promise<void> {
    await this.db.batch([
      this.db
        .prepare('INSERT INTO users (id, created_at) VALUES (?, ?)')
        .bind(credential.userId, credential.createdAt),
      this.db.prepare(`
        INSERT INTO password_credentials (
          user_id, login_id,
          password_salt, password_hash, password_iterations,
          recovery_salt, recovery_hash, recovery_iterations,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        credential.userId,
        credential.loginId,
        credential.passwordSalt,
        credential.passwordHash,
        credential.passwordIterations,
        credential.recoverySalt,
        credential.recoveryHash,
        credential.recoveryIterations,
        credential.createdAt,
        credential.updatedAt,
      ),
    ]);
  }

  async credentialByLoginId(loginId: string): Promise<StoredPasswordCredential | null> {
    const row = await this.db.prepare(`
      SELECT
        user_id, login_id,
        password_salt, password_hash, password_iterations,
        recovery_salt, recovery_hash, recovery_iterations,
        created_at, updated_at
      FROM password_credentials
      WHERE login_id = ? COLLATE NOCASE
      LIMIT 1
    `).bind(loginId).first<CredentialRow>();
    return row ? fromRow(row) : null;
  }

  async updatePassword(input: {
    userId: string;
    passwordSalt: string;
    passwordHash: string;
    passwordIterations: number;
    recoverySalt: string;
    recoveryHash: string;
    recoveryIterations: number;
    updatedAt: number;
  }): Promise<void> {
    await this.db.prepare(`
      UPDATE password_credentials
      SET password_salt = ?,
          password_hash = ?,
          password_iterations = ?,
          recovery_salt = ?,
          recovery_hash = ?,
          recovery_iterations = ?,
          updated_at = ?
      WHERE user_id = ?
    `).bind(
      input.passwordSalt,
      input.passwordHash,
      input.passwordIterations,
      input.recoverySalt,
      input.recoveryHash,
      input.recoveryIterations,
      input.updatedAt,
      input.userId,
    ).run();
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  }
}

function fromRow(row: CredentialRow): StoredPasswordCredential {
  return {
    userId: row.user_id,
    loginId: row.login_id,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    passwordIterations: row.password_iterations,
    recoverySalt: row.recovery_salt,
    recoveryHash: row.recovery_hash,
    recoveryIterations: row.recovery_iterations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
