import type {
  AuthenticationOptionsJson,
  RegistrationOptionsJson,
} from './WebAuthnClient';
import type {
  AuthenticationCredentialPayload,
  RegistrationCredentialPayload,
} from './types';

type ApiSuccess<T> = { ok: true; data: T };
type ApiFailure = { ok: false; error: { code: string; message: string } };
type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface AuthSessionResult {
  userId: string;
  authenticated: boolean;
}

export class AuthApiClient {
  async beginRegistration(turnstileToken: string): Promise<{
    userId: string;
    options: RegistrationOptionsJson;
  }> {
    return this.request('/api/auth/register/options', {
      turnstileToken,
    });
  }

  async finishRegistration(
    credential: RegistrationCredentialPayload,
  ): Promise<AuthSessionResult> {
    return this.request('/api/auth/register/verify', credential);
  }

  async beginLogin(): Promise<{ options: AuthenticationOptionsJson }> {
    return this.request('/api/auth/login/options', {});
  }

  async finishLogin(
    credential: AuthenticationCredentialPayload,
  ): Promise<AuthSessionResult> {
    return this.request('/api/auth/login/verify', credential);
  }

  async logout(): Promise<{ authenticated: boolean }> {
    return this.request('/api/auth/logout', {});
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });

    let payload: ApiResult<T>;
    try {
      payload = await response.json() as ApiResult<T>;
    } catch {
      throw new AuthApiError(response.status, 'internal_error', 'Invalid API response.');
    }

    if (!response.ok || !payload.ok) {
      const error = payload.ok
        ? { code: 'internal_error', message: `HTTP ${response.status}` }
        : payload.error;
      throw new AuthApiError(response.status, error.code, error.message);
    }

    return payload.data;
  }
}

export class AuthApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}
