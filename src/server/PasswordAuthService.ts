import { D1AuthStore } from './D1AuthStore';
import { HttpError } from './http';
import {
  generateRecoveryCode,
  hashPassword,
  normalizeRecoveryCode,
  verifyPassword,
} from './PasswordCrypto';
import { PasswordAuthStore } from './PasswordAuthStore';

const LOGIN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{3,23}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export class PasswordAuthService {
  constructor(
    private readonly credentials: PasswordAuthStore,
    private readonly sessions: D1AuthStore,
  ) {}

  async register(input: {
    loginId: string;
    password: string;
    now?: number;
  }): Promise<{ userId: string; recoveryCode: string; session: { token: string; expiresAt: number } }> {
    const now = input.now ?? Date.now();
    const loginId = normalizeLoginId(input.loginId);
    validatePassword(input.password);

    if (await this.credentials.credentialByLoginId(loginId)) {
      throw new HttpError(409, 'conflict', 'This login ID is already in use.');
    }

    const recoveryCode = generateRecoveryCode();
    const [passwordHash, recoveryHash] = await Promise.all([
      hashPassword(input.password),
      hashPassword(normalizeRecoveryCode(recoveryCode)),
    ]);
    const userId = crypto.randomUUID();

    try {
      await this.credentials.createUserWithCredential({
        userId,
        loginId,
        passwordSalt: passwordHash.salt,
        passwordHash: passwordHash.hash,
        passwordIterations: passwordHash.iterations,
        recoverySalt: recoveryHash.salt,
        recoveryHash: recoveryHash.hash,
        recoveryIterations: recoveryHash.iterations,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (await this.credentials.credentialByLoginId(loginId)) {
        throw new HttpError(409, 'conflict', 'This login ID is already in use.');
      }
      throw error;
    }

    const session = await this.sessions.createSession(userId, now);
    return { userId, recoveryCode, session };
  }

  async login(input: {
    loginId: string;
    password: string;
    now?: number;
  }): Promise<{ userId: string; session: { token: string; expiresAt: number } }> {
    const now = input.now ?? Date.now();
    const loginId = normalizeLoginId(input.loginId);
    validatePassword(input.password);

    const credential = await this.credentials.credentialByLoginId(loginId);
    if (!credential) throw invalidCredentials();

    const verified = await verifyPassword(
      input.password,
      credential.passwordSalt,
      credential.passwordHash,
      credential.passwordIterations,
    );
    if (!verified) throw invalidCredentials();

    const session = await this.sessions.createSession(credential.userId, now);
    return { userId: credential.userId, session };
  }

  async recover(input: {
    loginId: string;
    recoveryCode: string;
    newPassword: string;
    now?: number;
  }): Promise<{ userId: string; recoveryCode: string; session: { token: string; expiresAt: number } }> {
    const now = input.now ?? Date.now();
    const loginId = normalizeLoginId(input.loginId);
    const recoveryCode = normalizeRecoveryCode(input.recoveryCode);
    validatePassword(input.newPassword);
    if (recoveryCode.length < 20 || recoveryCode.length > 64) throw invalidRecovery();

    const credential = await this.credentials.credentialByLoginId(loginId);
    if (!credential) throw invalidRecovery();

    const verified = await verifyPassword(
      recoveryCode,
      credential.recoverySalt,
      credential.recoveryHash,
      credential.recoveryIterations,
    );
    if (!verified) throw invalidRecovery();

    const nextRecoveryCode = generateRecoveryCode();
    const [passwordHash, recoveryHash] = await Promise.all([
      hashPassword(input.newPassword),
      hashPassword(normalizeRecoveryCode(nextRecoveryCode)),
    ]);

    await this.credentials.revokeAllSessionsForUser(credential.userId);
    await this.credentials.updatePassword({
      userId: credential.userId,
      passwordSalt: passwordHash.salt,
      passwordHash: passwordHash.hash,
      passwordIterations: passwordHash.iterations,
      recoverySalt: recoveryHash.salt,
      recoveryHash: recoveryHash.hash,
      recoveryIterations: recoveryHash.iterations,
      updatedAt: now,
    });

    const session = await this.sessions.createSession(credential.userId, now);
    return { userId: credential.userId, recoveryCode: nextRecoveryCode, session };
  }
}

export function normalizeLoginId(value: string): string {
  const loginId = value.trim().toLowerCase();
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    throw new HttpError(
      400,
      'bad_request',
      'Login ID must be 4-24 characters using letters, numbers, dot, underscore, or hyphen.',
    );
  }
  return loginId;
}

function validatePassword(value: string): void {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
    throw new HttpError(400, 'bad_request', 'Password must be 8-128 characters.');
  }
}

function invalidCredentials(): HttpError {
  return new HttpError(401, 'unauthorized', 'Login ID or password is incorrect.');
}

function invalidRecovery(): HttpError {
  return new HttpError(401, 'unauthorized', 'Login ID or recovery code is incorrect.');
}
