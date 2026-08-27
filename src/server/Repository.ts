import type {
  EntitlementsResponse,
  PublicProfileResponse,
  SaveCharacterRequest,
  SaveCharacterResponse,
  SavedCharacter,
  SavedProfile,
  SaveProfileRequest,
  SaveProfileResponse,
} from '../api/contracts';

export interface ServerRepository {
  sessionUserId(sessionHash: string, now: number): Promise<string | null>;
  listCharacters(userId: string): Promise<SavedCharacter[]>;
  saveCharacter(userId: string, input: SaveCharacterRequest, now: number): Promise<SaveCharacterResponse>;
  getProfile(userId: string): Promise<SavedProfile | null>;
  saveProfile(userId: string, input: SaveProfileRequest, now: number): Promise<SaveProfileResponse>;
  getPublicProfile(slug: string): Promise<PublicProfileResponse | null>;
  getEntitlements(userId: string): Promise<EntitlementsResponse>;
}
