export const CHARACTER_SCHEMA_VERSION = 1;
export const PROFILE_SCHEMA_VERSION = 1;

export type Visibility = 'private' | 'unlisted' | 'public';

export interface CharacterAppearance {
  parts: Record<string, string>;
  colors: Record<string, string>;
  accessories: string[];
}

export interface RoomState {
  themeId: string;
  furniture: Array<{
    id: string;
    x: number;
    y: number;
    scale: number;
  }>;
}

export interface CharacterDraft {
  schemaVersion: number;
  name: string;
  appearance: CharacterAppearance;
  room: RoomState;
  updatedAt: number;
}

export interface OshiProfileDraft {
  schemaVersion: number;
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
  visibility: Visibility;
  updatedAt: number;
}

export interface EntitlementSnapshot {
  packIds: string[];
  updatedAt: number;
}

export const createEmptyCharacterDraft = (): CharacterDraft => ({
  schemaVersion: CHARACTER_SCHEMA_VERSION,
  name: 'MY CHARACTER',
  appearance: {
    parts: {},
    colors: {},
    accessories: [],
  },
  room: {
    themeId: 'room.default',
    furniture: [],
  },
  updatedAt: Date.now(),
});

export const createEmptyProfileDraft = (): OshiProfileDraft => ({
  schemaVersion: PROFILE_SCHEMA_VERSION,
  displayName: '',
  oshiName: '',
  oshiSince: '',
  favoriteSong: '',
  favoritePoint: '',
  doufanStance: '',
  participationHistory: '',
  favoriteOutfit: '',
  message: '',
  bio: '',
  themeId: 'simple',
  visibility: 'private',
  updatedAt: Date.now(),
});
