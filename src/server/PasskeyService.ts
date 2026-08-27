import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import type { CreatedSession, StoredChallenge } from '../auth/types';
import type { AuthStore } from './AuthStore';
import { HttpError } from './http';
import { sha256Hex } from './session';

const CHALLENGE_TTL_MS = 1000 * 60 * 5;

export interface RelyingPartyConfig {
  rpName: string;
  rpID: string;
  origin: string;
}

export interface RegistrationStart {
  userId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface AuthenticationStart {
  options: PublicKeyCredentialRequestOptionsJSON;
}

export class PasskeyService {
  constructor(
    private readonly store: AuthStore,
    private readonly config: RelyingPartyConfig,
  ) {}

  async beginRegistration(now = Date.now(), existingUserId?: string): Promise<RegistrationStart> {
    const userId = existingUserId ?? await this.store.createUser(now);
    const credentials = await this.store.credentialsForUser(userId);
    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpID,
      userName: `chibi-${userId.slice(0, 12)}`,
      userDisplayName: 'CHIBI LIFE USER',
      userID: new TextEncoder().encode(userId),
      attestationType: 'none',
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as WebAuthnCredential['transports'],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await this.store.createChallenge({
      challengeHash: await sha256Hex(options.challenge),
      userId,
      purpose: 'register',
      expiresAt: now + CHALLENGE_TTL_MS,
      now,
    });

    return { userId, options };
  }

  async finishRegistration(
    response: RegistrationResponseJSON,
    now = Date.now(),
  ): Promise<{ userId: string; session: CreatedSession }> {
    let challengeRecord: StoredChallenge | null = null;
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: async (challenge) => {
        const consumed = await this.store.consumeChallenge(
          await sha256Hex(challenge),
          'register',
          now,
        );
        if (!consumed?.userId) return false;
        challengeRecord = consumed;
        return true;
      },
      expectedOrigin: this.config.origin,
      expectedRPID: this.config.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo || !challengeRecord) {
      throw new HttpError(401, 'unauthorized', 'Passkey registration could not be verified.');
    }

    const userId = (challengeRecord as StoredChallenge).userId;
    if (!userId) throw new HttpError(401, 'unauthorized', 'Registration challenge is invalid.');
    const credential = verification.registrationInfo.credential;

    await this.store.saveCredential({
      id: crypto.randomUUID(),
      userId,
      credentialId: credential.id,
      publicKey: credential.publicKey,
      signCount: credential.counter,
      transports: credential.transports ?? response.response.transports ?? [],
      createdAt: now,
    });

    const session = await this.store.createSession(userId, now);
    return { userId, session };
  }

  async beginAuthentication(now = Date.now()): Promise<AuthenticationStart> {
    const options = await generateAuthenticationOptions({
      rpID: this.config.rpID,
      userVerification: 'preferred',
    });

    await this.store.createChallenge({
      challengeHash: await sha256Hex(options.challenge),
      userId: null,
      purpose: 'authenticate',
      expiresAt: now + CHALLENGE_TTL_MS,
      now,
    });

    return { options };
  }

  async finishAuthentication(
    response: AuthenticationResponseJSON,
    now = Date.now(),
  ): Promise<{ userId: string; session: CreatedSession }> {
    const stored = await this.store.credentialByCredentialId(response.id);
    if (!stored) throw new HttpError(401, 'unauthorized', 'Passkey is not registered.');

    const credential: WebAuthnCredential = {
      id: stored.credentialId,
      publicKey: stored.publicKey,
      counter: stored.signCount,
      transports: stored.transports as WebAuthnCredential['transports'],
    };

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: async (challenge) => Boolean(
        await this.store.consumeChallenge(
          await sha256Hex(challenge),
          'authenticate',
          now,
        )
      ),
      expectedOrigin: this.config.origin,
      expectedRPID: this.config.rpID,
      credential,
      requireUserVerification: true,
    });

    if (!verification.verified) {
      throw new HttpError(401, 'unauthorized', 'Passkey authentication could not be verified.');
    }

    await this.store.updateCredentialCounter(
      stored.credentialId,
      verification.authenticationInfo.newCounter,
    );
    const session = await this.store.createSession(stored.userId, now);
    return { userId: stored.userId, session };
  }
}

export function relyingPartyFromRequest(
  request: Request,
  overrides: Partial<RelyingPartyConfig> = {},
): RelyingPartyConfig {
  const url = new URL(request.url);
  return {
    rpName: overrides.rpName ?? 'CHIBI LIFE',
    rpID: overrides.rpID ?? url.hostname,
    origin: overrides.origin ?? url.origin,
  };
}
