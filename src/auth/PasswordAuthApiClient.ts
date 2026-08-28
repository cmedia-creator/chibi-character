import { createPasswordMaterial, derivePasswordVerifier } from './PasswordKdfClient';

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

  async register(input: {
    loginId: string;
    password: string;
    turnstileToken: string;
  }): Promise<PasswordRegisterResult> {
    const material = await createPasswordMaterial(input.password);
    return this.request('/api/auth/password/register', {
      loginId: input.loginId,
      verifier: material.verifier,
      passwordSalt: material.salt,
      passwordIterations: material.iterations,
      turnstileToken: input.turnstileToken,
    });
  }

  async login(input: {
    loginId: string;
    password: string;
    turnstileToken: string;
  }): Promise<PasswordAuthSessionResult> {
    const params = await this.getParams(input.loginId);
    const verifier = await derivePasswordVerifier(
      input.password,
      params.salt,
      params.iterations,
    );
    return this.request('/api/auth/password/login', {
      loginId: input.loginId,
      verifier,
      turnstileToken: input.turnstileToken,
    });
  }

  async recover(input: {
    loginId: string;
    recoveryCode: string;
    newPassword: string;
    turnstileToken: string;
  }): Promise<PasswordRegisterResult> {
    const material = await createPasswordMaterial(input.newPassword);
    return this.request('/api/auth/password/recover', {
      loginId: input.loginId,
      recoveryCode: input.recoveryCode,
      newVerifier: material.verifier,
      passwordSalt: material.salt,
      passwordIterations: material.iterations,
      turnstileToken: input.turnstileToken,
    });
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
