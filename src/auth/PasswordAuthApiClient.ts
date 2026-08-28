type ApiSuccess<T> = { ok: true; data: T };
type ApiFailure = { ok: false; error: { code: string; message: string } };
type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface PasswordAuthSessionResult {
  userId: string;
  authenticated: boolean;
}

export interface PasswordRegisterResult extends PasswordAuthSessionResult {
  recoveryCode: string;
}

export interface PasswordParams {
  salt: string;
  iterations: number;
}

export class PasswordAuthApiClient {
  getParams(loginId: string): Promise<PasswordParams> {
    return this.request('/api/auth/password/params', { loginId });
  }

  register(input: {
    loginId: string;
    verifier: string;
    passwordSalt: string;
    passwordIterations: number;
    turnstileToken: string;
  }): Promise<PasswordRegisterResult> {
    return this.request('/api/auth/password/register', input);
  }

  login(input: {
    loginId: string;
    verifier: string;
    turnstileToken: string;
  }): Promise<PasswordAuthSessionResult> {
    return this.request('/api/auth/password/login', input);
  }

  recover(input: {
    loginId: string;
    recoveryCode: string;
    newVerifier: string;
    passwordSalt: string;
    passwordIterations: number;
    turnstileToken: string;
  }): Promise<PasswordRegisterResult> {
    return this.request('/api/auth/password/recover', input);
  }

  logout(): Promise<{ authenticated: boolean }> {
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
      throw new PasswordAuthApiError(response.status, 'internal_error', 'Invalid API response.');
    }

    if (!response.ok || !payload.ok) {
      const error = payload.ok
        ? { code: 'internal_error', message: `HTTP ${response.status}` }
        : payload.error;
      throw new PasswordAuthApiError(response.status, error.code, error.message);
    }

    return payload.data;
  }
}

export class PasswordAuthApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PasswordAuthApiError';
  }
}
