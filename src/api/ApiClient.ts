import type {
  ApiResult,
  EntitlementsResponse,
  MeResponse,
  PublicProfileResponse,
  SaveCharacterRequest,
  SaveCharacterResponse,
  SavedCharacter,
  SavedProfile,
  SaveProfileRequest,
  SaveProfileResponse,
} from './contracts';

export class ApiClient {
  constructor(private readonly baseUrl = '') {}

  getMe(): Promise<MeResponse> {
    return this.request<MeResponse>('/api/me');
  }

  async getCharacters(): Promise<SavedCharacter[]> {
    const result = await this.request<{ characters: SavedCharacter[] }>('/api/characters');
    return result.characters;
  }

  saveCharacter(input: SaveCharacterRequest): Promise<SaveCharacterResponse> {
    return this.request<SaveCharacterResponse>('/api/characters', {
      method: 'PUT',
      body: input,
    });
  }

  async getProfile(): Promise<SavedProfile | null> {
    const result = await this.request<{ profile: SavedProfile | null }>('/api/profile');
    return result.profile;
  }

  saveProfile(input: SaveProfileRequest): Promise<SaveProfileResponse> {
    return this.request<SaveProfileResponse>('/api/profile', {
      method: 'PUT',
      body: input,
    });
  }

  getPublicProfile(slug: string): Promise<PublicProfileResponse> {
    return this.request<PublicProfileResponse>(`/api/public/${encodeURIComponent(slug)}`);
  }

  getEntitlements(): Promise<EntitlementsResponse> {
    return this.request<EntitlementsResponse>('/api/entitlements');
  }

  private async request<T>(
    path: string,
    options: { method?: 'GET' | 'PUT' | 'POST' | 'DELETE'; body?: unknown } = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
    });

    let payload: ApiResult<T>;
    try {
      payload = await response.json() as ApiResult<T>;
    } catch {
      throw new ApiClientError(response.status, 'internal_error', 'Invalid API response.');
    }

    if (!response.ok || !payload.ok) {
      const error = payload.ok
        ? { code: 'internal_error' as const, message: `HTTP ${response.status}` }
        : payload.error;
      throw new ApiClientError(response.status, error.code, error.message);
    }

    return payload.data;
  }
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
