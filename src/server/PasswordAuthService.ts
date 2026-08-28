import { D1AuthStore } from './D1AuthStore';
import { HttpError } from './http';
import {
  clientKdfIterations,
  fakePasswordSalt,
  generateRecoveryCode,
  generateRecoverySalt,
  hashPasswordVerifier,
  hashRecoveryCode,
  isValidClientIterations,
  isValidPasswordSalt,
  isValidVerifier,
  normalizeRecoveryCode,
  timingSafeStringEqual,
} from './PasswordCrypto';
import { PasswordAuthStore } from './PasswordAuthStore';

const LOGIN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{3,23}$/;

export class PasswordAuthService {
  constructor(
    private readonly credentials: PasswordAuthStore,
    private readonly sessions: D1AuthStore,
    private readonly pepper: string,
  ) {
    if (!pepper) throw new Error('Password pepper is required.');
  }

  async params(loginIdInput: string): Promise<{ salt: string; iterations: number }> {
    const loginId = normalizeLoginId(loginIdInput);
    const credential = await this.credentials.credentialByLoginId(loginId);
    if (credential) {
      return {
        salt: credential.passwordSalt,
        iterations: credential.passwordIterations,
      };
    }
    return {
      salt: await fakePasswordSalt(this.pepper, loginId),
      iterations: clientKdfIterations(),
    };
  }

  async register(input: {
    loginId: string;
    verifier: string;
    passwordSalt: string;
    passwordIterations: number;
    now?: number;
  }): Promise<{ userId: string; recoveryCode: string; session: { token: string; expiresAt: number } }> {
    const now = input.now ?? Date.now();
    const loginId = normalizeLoginId(input.loginId);
    validateClientPasswordMaterial(input.verifier, input.passwordSalt, input.passwordIterations);

    if (await this.credentials.credentialByLoginId(loginId)) {
      throw new HttpError(409, 'conflict', 'This login ID is already in use.');
    }

    const recoveryCode = generateRecoveryCode();
    const recoverySalt = generateRecoverySalt();
    const [passwordHash, recoveryHash] = await Promise.all([
      hashPasswordVerifier(this.pepper, loginId, input.verifier),
      hashRecoveryCode(this.pepper, recoverySalt, recoveryCode),
    ]);
    const userId = crypto.randomUUID();

    try {
      await this.credentials.createUserWithCredential({
        userId,
        loginId,
        passwordSalt: input.passwordSalt,
        passwordHash,
        passwordIterations: input.passwordIterations,
        recoverySalt,
        recoveryHash,
        recoveryIterations: 0,
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
    verifier: string;
    now?: number;
  }): Promise<{ userId: string; session: { token: string; expiresAt: number } }> {
    const now = input.now ?? Date.now();
    const loginId = normalizeLoginId(input.loginId);
    if (!isValidVerifier(input.verifier)) throw invalidCredentials();

    const credential = await this.credentials.credentialByLoginId(loginId);
    const candidateHash = await hashPasswordVerifier(this.pepper, loginId, input.verifier);
    if (!credential || !timingSafeStringEqual(candidateHash, credential.passwordHash)) {
      throw invalidCredentials();
    }

    const session = await this.sessions.createSession(credential.userId, now);
    return { userId: credential.userId, session };
  }

  async recover(input: {
    loginId: string;
    recoveryCode: string;
    newVerifier: string;
    passwordSalt: string;
    passwordIterations: number;
    now?: number;
  }): Promise<{ userId: string; recoveryCode: string; session: { token: string; expiresAt: number } }> {
    const now = input.now ?? Date.now();
    const loginId = normalizeLoginId(input.loginId);
    const recoveryCode = normalizeRecoveryCode(input.recoveryCode);
    validateClientPasswordMaterial(input.newVerifier, input.passwordSalt, input.passwordIterations);
    if (recoveryCode.length < 20 || recoveryCode.length > 64) throw invalidRecovery();

    const credential = await this.credentials.credentialByLoginId(loginId);
    if (!credential) throw invalidRecovery();

    const candidateRecoveryHash = await hashRecoveryCode(
      this.pepper,
      credential.recoverySalt,
      recoveryCode,
    );
    if (!timingSafeStringEqual(candidateRecoveryHash, credential.recoveryHash)) {
      throw invalidRecovery();
    }

    const nextRecoveryCode = generateRecoveryCode();
    const nextRecoverySalt = generateRecoverySalt();
    const [passwordHash, recoveryHash] = await Promise.all([
      hashPasswordVerifier(this.pepper, loginId, input.newVerifier),
      hashRecoveryCode(this.pepper, nextRecoverySalt, nextRecoveryCode),
    ]);

    await this.credentials.revokeAllSessionsForUser(credential.userId);
    await this.credentials.updatePassword({
      userId: credential.userId,
      passwordSalt: input.passwordSalt,
      passwordHash,
      passwordIterations: input.passwordIterations,
      recoverySalt: nextRecoverySalt,
      recoveryHash,
      recoveryIterations: 0,
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

function validateClientPasswordMaterial(
  verifier: string,
  salt: string,
  iterations: number,
): void {
  if (!isValidVerifier(verifier) || !isValidPasswordSalt(salt) || !isValidClientIterations(iterations)) {
    throw new HttpError(400, 'bad_request', 'Password verification material is invalid.');
  }
}

function invalidCredentials(): HttpError {
  return new HttpError(401, 'unauthorized', 'Login ID or password is incorrect.');
}

function invalidRecovery(): HttpError {
  return new HttpError(401, 'unauthorized', 'Login ID or recovery code is incorrect.');
}
