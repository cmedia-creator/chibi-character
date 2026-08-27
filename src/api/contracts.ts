import type { CharacterDraft, EntitlementSnapshot, OshiProfileDraft, Visibility } from '../data/models';

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error';

export interface ApiErrorBody {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export type ApiResult<T> = ApiSuccess<T> | ApiErrorBody;

export interface MeResponse {
  userId: string;
  authenticated: boolean;
}

export interface SavedCharacter {
  id: string;
  name: string;
  draft: CharacterDraft;
  createdAt: number;
  updatedAt: number;
}

export interface SaveCharacterRequest {
  characterId?: string;
  draft: CharacterDraft;
}

export interface SaveCharacterResponse {
  character: SavedCharacter;
}

export interface SavedProfile {
  slug: string;
  profile: OshiProfileDraft;
  updatedAt: number;
}

export interface SaveProfileRequest {
  slug: string;
  profile: OshiProfileDraft;
}

export interface SaveProfileResponse {
  profile: SavedProfile;
}

export interface PublicProfileResponse {
  slug: string;
  displayName: string;
  oshiName: string;
  oshiSince: string;
  favoriteSong: string;
  favoritePoint: string;
  doufanStance: string;
  participationHistory: string;
  favoriteOutfit: string;
  message: string;
  bio: string;
  themeId: string;
  visibility: Exclude<Visibility, 'private'>;
  character: CharacterDraft | null;
  shareImageUrl: string | null;
  updatedAt: number;
}

export interface EntitlementsResponse extends EntitlementSnapshot {}

export interface ApiRoutes {
  'GET /api/me': { response: MeResponse };
  'GET /api/characters': { response: { characters: SavedCharacter[] } };
  'PUT /api/characters': { request: SaveCharacterRequest; response: SaveCharacterResponse };
  'GET /api/profile': { response: { profile: SavedProfile | null } };
  'PUT /api/profile': { request: SaveProfileRequest; response: SaveProfileResponse };
  'GET /api/public/:slug': { response: PublicProfileResponse };
  'GET /api/entitlements': { response: EntitlementsResponse };
}
