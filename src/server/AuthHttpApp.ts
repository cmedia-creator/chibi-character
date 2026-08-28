import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { AbuseGuard } from './AbuseGuard';
import { AuthRateLimiter } from './AuthRateLimiter';
import { D1AuthStore } from './D1AuthStore';
import { HttpError, jsonError, jsonSuccess, readJsonBody } from './http';
import { PasskeyService, relyingPartyFromRequest } from './PasskeyService';
import { PasswordAuthService } from './PasswordAuthService';
import { PasswordAuthStore } from './PasswordAuthStore';
import { clearSessionCookie, createSessionCookie } from './sessionCookie';
import { readCookie } from './session';
import { TurnstileVerifier } from './TurnstileVerifier';
import type { D1Database } from './cloudflare';

const SESSION_COOKIE = 'chibi_session';
const HOUR = 60 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

type RegisterOptionsBody = {
  turnstileToken?: unknown;
};

type PasswordParamsBody = {
  loginId?: unknown;
};

type PasswordRegisterBody = {
  loginId?: unknown;
  verifier?: unknown;
  passwordSalt?: unknown;
  passwordIterations?: unknown;
};

type PasswordLoginBody = {
  loginId?: unknown;
  verifier?: unknown;
};

type PasswordRecoverBody = {
  loginId?: unknown;
  recoveryCode?: unknown;
  newVerifier?: unknown;
  passwordSalt?: unknown;
  passwordIterations?: unknown;
};

export class AuthHttpApp {
  constructor(
    private readonly db: D1Database,
    private readonly turnstileSecret?: string,
    private readonly passwordPepper?: string,
  ) {}

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();
    const store = new D1AuthStore(this.db);
    const passkeys = new PasskeyService(store, relyingPartyFromRequest(request));
    const passwordAuth = this.passwordPepper
      ? new PasswordAuthService(new PasswordAuthStore(this.db), store, this.passwordPepper)
      : null;
    const rateLimiter = this.passwordPepper
      ? new AuthRateLimiter(this.db, this.passwordPepper)
      : null;

    try {
      if (request.method === 'POST' && url.pathname === '/api/auth/password/params') {
        const service = requirePasswordService(passwordAuth);
        const raw = await readJsonBody<PasswordParamsBody>(request);
        return jsonSuccess(await service.params(asString(raw.loginId)));
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/password/register') {
        const service = requirePasswordService(passwordAuth);
        const limiter = requireRateLimiter(rateLimiter);
        const raw = await readJsonBody<PasswordRegisterBody>(request);
        await limiter.consume(request, 'register', 10, HOUR, now);
        const result = await service.register({
          loginId: asString(raw.loginId),
          verifier: asString(raw.verifier),
          passwordSalt: asString(raw.passwordSalt),
          passwordIterations: asNumber(raw.passwordIterations),
          now,
        });
        return withSessionCookie(
          jsonSuccess({
            userId: result.userId,
            authenticated: true,
            recoveryCode: result.recoveryCode,
          }),
          result.session.token,
          result.session.expiresAt,
        );
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/password/login') {
        const service = requirePasswordService(passwordAuth);
        const limiter = requireRateLimiter(rateLimiter);
        const raw = await readJsonBody<PasswordLoginBody>(request);
        await limiter.consume(request, 'login', 60, FIFTEEN_MINUTES, now);
        const result = await service.login({
          loginId: asString(raw.loginId),
          verifier: asString(raw.verifier),
          now,
        });
        return withSessionCookie(
          jsonSuccess({ userId: result.userId, authenticated: true }),
          result.session.token,
          result.session.expiresAt,
        );
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/password/recover') {
        const service = requirePasswordService(passwordAuth);
        const limiter = requireRateLimiter(rateLimiter);
        const raw = await readJsonBody<PasswordRecoverBody>(request);
        await limiter.consume(request, 'recover', 10, HOUR, now);
        const result = await service.recover({
          loginId: asString(raw.loginId),
          recoveryCode: asString(raw.recoveryCode),
          newVerifier: asString(raw.newVerifier),
          passwordSalt: asString(raw.passwordSalt),
          passwordIterations: asNumber(raw.passwordIterations),
          now,
        });
        return withSessionCookie(
          jsonSuccess({
            userId: result.userId,
            authenticated: true,
            recoveryCode: result.recoveryCode,
          }),
          result.session.token,
          result.session.expiresAt,
        );
      }

      // Legacy Passkey routes remain dormant during the MVP transition.
      if (request.method === 'POST' && url.pathname === '/api/auth/register/options') {
        if (!this.turnstileSecret) {
          return jsonError(503, 'internal_error', 'Human verification is not configured.');
        }

        const raw = await readJsonBody<RegisterOptionsBody>(request);
        const token = typeof raw.turnstileToken === 'string' ? raw.turnstileToken : '';
        if (!token || token.length > 4096) {
          throw new HttpError(400, 'bad_request', 'Turnstile token is required.');
        }

        const guard = new AbuseGuard(new TurnstileVerifier(this.turnstileSecret));
        await guard.requireTurnstile(request, token, 'passkey-register');
        await store.purgeExpired(now);
        return jsonSuccess(await passkeys.beginRegistration(now));
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/register/verify') {
        const response = await readJsonBody<RegistrationResponseJSON>(request);
        const result = await passkeys.finishRegistration(response, now);
        return withSessionCookie(
          jsonSuccess({ userId: result.userId, authenticated: true }),
          result.session.token,
          result.session.expiresAt,
        );
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login/options') {
        await store.purgeExpired(now);
        return jsonSuccess(await passkeys.beginAuthentication(now));
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login/verify') {
        const response = await readJsonBody<AuthenticationResponseJSON>(request);
        const result = await passkeys.finishAuthentication(response, now);
        return withSessionCookie(
          jsonSuccess({ userId: result.userId, authenticated: true }),
          result.session.token,
          result.session.expiresAt,
        );
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
        if (token && token.length <= 256) await store.revokeSession(token);
        const response = jsonSuccess({ authenticated: false });
        response.headers.set('Set-Cookie', clearSessionCookie());
        return response;
      }

      if (url.pathname.startsWith('/api/auth/')) {
        return jsonError(404, 'not_found', 'Auth route not found.');
      }

      return jsonError(404, 'not_found', 'API route not found.');
    } catch (error) {
      if (error instanceof HttpError) return jsonError(error.status, error.code, error.message);
      console.error('Unhandled auth API error', error);
      return jsonError(500, 'internal_error', 'Internal server error.');
    }
  }
}

function withSessionCookie(
  response: Response,
  token: string,
  expiresAt: number,
): Response {
  response.headers.set('Set-Cookie', createSessionCookie(token, expiresAt));
  return response;
}

function requirePasswordService(service: PasswordAuthService | null): PasswordAuthService {
  if (!service) throw new HttpError(503, 'internal_error', 'Password authentication is not configured.');
  return service;
}

function requireRateLimiter(limiter: AuthRateLimiter | null): AuthRateLimiter {
  if (!limiter) throw new HttpError(503, 'internal_error', 'Authentication rate limiting is not configured.');
  return limiter;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN;
}
