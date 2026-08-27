import type { CreatedSession, StoredChallenge, StoredPasskeyCredential, WebAuthnPurpose } from '../auth/types';

export interface AuthStore {
  createUser(now: number): Promise<string>;
  createChallenge(input: {
    challengeHash: string;
    userId: string | null;
    purpose: WebAuthnPurpose;
    expiresAt: number;
    now: number;
  }): Promise<void>;
  consumeChallenge(challengeHash: string, purpose: WebAuthnPurpose, now: number): Promise<StoredChallenge | null>;
  credentialByCredentialId(credentialId: string): Promise<StoredPasskeyCredential | null>;
  credentialsForUser(userId: string): Promise<StoredPasskeyCredential[]>;
  saveCredential(credential: StoredPasskeyCredential): Promise<void>;
  updateCredentialCounter(credentialId: string, signCount: number): Promise<void>;
  createSession(userId: string, now: number, ttlMs?: number): Promise<CreatedSession>;
  revokeSession(token: string): Promise<void>;
  purgeExpired(now: number): Promise<void>;
}
