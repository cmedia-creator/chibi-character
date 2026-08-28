import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { AbuseGuard } from './AbuseGuard';
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

type RegisterOptionsBody = {
  turnstileToken?: unknown;
};

type PasswordRegisterBody = {
  loginId?: unknown;
  password?: unknown;
  turnstileToken?: unknown;
};

type PasswordLoginBody = PasswordRegisterBody;

type PasswordRecoverBody = {
  loginId?: unknown;
  recoveryCode?: unknown;
  newPassword?: unknown;
  turnstileToken?: unknown;
};

export class AuthHttpApp {
  constructor(
    private readonly db: D1Database,
    private readonly turnstileSecret?: string,
  ) {}

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();
    const store = new D1AuthStore(this.db);
    const passkeys = new PasskeyService(store, relyingPartyFromRequest(request));
    const passwordAuth = new PasswordAuthService(new PasswordAuthStore(this.db), store);

    try {
      if (request.method === 'POST' && url.pathname === '/api/auth/password/register') {
        const raw = await readJsonBody<PasswordRegisterBody>(request);
        await this.requirePasswordTurnstile(request, raw.turnstileToken);
        const result = await passwordAuth.register({
          loginId: asString(raw.loginId),
          password: asString(raw.password),
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
        const raw = await readJsonBody<PasswordLoginBody>(request);
        await this.requirePasswordTurnstile(request, raw.turnstileToken);
        const result = await passwordAuth.login({
          loginId: asString(raw.loginId),
          password: asString(raw.password),
          now,
        });
        return withSessionCookie(
          jsonSuccess({ userId: result.userId, authenticated: true }),
          result.session.token,
          result.session.expiresAt,
        );
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/password/recover') {
        const raw = await readJsonBody<PasswordRecoverBody>(request);
        await this.requirePasswordTurnstile(request, raw.turnstileToken);
        const result = await passwordAuth.recover({
          loginId: asString(raw.loginId),
          recoveryCode: asString(raw.recoveryCode),
          newPassword: asString(raw.newPassword),
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

  private async requirePasswordTurnstile(request: Request, rawToken: unknown): Promise<void> {
    if (!this.turnstileSecret) {
      throw new HttpError(503, 'internal_error', 'Human verification is not configured.');
    }
    const token = typeof rawToken === 'string' ? rawToken : '';
    if (!token || token.length > 4096) {
      throw new HttpError(400, 'bad_request', 'Turnstile token is required.');
    }
    const guard = new AbuseGuard(new TurnstileVerifier(this.turnstileSecret));
    await guard.requireTurnstile(request, token, 'password-auth');
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

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
