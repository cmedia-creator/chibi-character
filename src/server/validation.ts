import type { SaveCharacterRequest, SaveProfileRequest } from '../api/contracts';
import type { CharacterAppearance, CharacterDraft, OshiProfileDraft, RoomState, Visibility } from '../data/models';
import { validateProfileSlug } from '../profile/slug';
import { HttpError } from './http';

const VISIBILITIES = new Set<Visibility>(['private', 'unlisted', 'public']);
const PROFILE_THEMES = new Set(['simple', 'y2k', 'heisei', 'street']);

export function validateSaveCharacterRequest(value: unknown): SaveCharacterRequest {
  const object = asRecord(value, 'body');
  const characterId = optionalString(object.characterId, 80, 'characterId');
  const draft = validateCharacterDraft(object.draft);
  return characterId ? { characterId, draft } : { draft };
}

export function validateSaveProfileRequest(value: unknown): SaveProfileRequest {
  const object = asRecord(value, 'body');
  const rawSlug = requiredString(object.slug, 30, 'slug');
  const slugResult = validateProfileSlug(rawSlug);
  if (!slugResult.ok) throw bad(`Invalid profile slug: ${slugResult.reason}.`);
  const profile = validateProfileDraft(object.profile);
  return { slug: slugResult.slug, profile };
}

function validateCharacterDraft(value: unknown): CharacterDraft {
  const object = asRecord(value, 'draft');
  const schemaVersion = requiredInteger(object.schemaVersion, 1, 100, 'draft.schemaVersion');
  const name = requiredString(object.name, 30, 'draft.name');
  const appearance = validateAppearance(object.appearance);
  const room = validateRoom(object.room);
  const updatedAt = finiteNumber(object.updatedAt, 'draft.updatedAt');
  return { schemaVersion, name, appearance, room, updatedAt };
}

function validateAppearance(value: unknown): CharacterAppearance {
  const object = asRecord(value, 'draft.appearance');
  const parts = stringRecord(object.parts, 16, 100, 'draft.appearance.parts');
  const colors = stringRecord(object.colors, 16, 32, 'draft.appearance.colors');
  const rawAccessories = Array.isArray(object.accessories) ? object.accessories : [];
  if (rawAccessories.length > 20) throw bad('Too many accessories.');
  const accessories = rawAccessories.map((item, index) => requiredString(item, 100, `accessories[${index}]`));
  return { parts, colors, accessories };
}

function validateRoom(value: unknown): RoomState {
  const object = asRecord(value, 'draft.room');
  const themeId = requiredString(object.themeId, 100, 'draft.room.themeId');
  if (!Array.isArray(object.furniture)) throw bad('draft.room.furniture must be an array.');
  if (object.furniture.length > 30) throw bad('Too many furniture items.');
  const furniture = object.furniture.map((entry, index) => {
    const item = asRecord(entry, `draft.room.furniture[${index}]`);
    return {
      id: requiredString(item.id, 100, `furniture[${index}].id`),
      x: boundedNumber(item.x, -200, 1224, `furniture[${index}].x`),
      y: boundedNumber(item.y, -200, 1224, `furniture[${index}].y`),
      scale: boundedNumber(item.scale, 0.2, 3, `furniture[${index}].scale`),
    };
  });
  return { themeId, furniture };
}

function validateProfileDraft(value: unknown): OshiProfileDraft {
  const object = asRecord(value, 'profile');
  const schemaVersion = requiredInteger(object.schemaVersion, 1, 100, 'profile.schemaVersion');
  const visibility = requiredString(object.visibility, 20, 'profile.visibility') as Visibility;
  if (!VISIBILITIES.has(visibility)) throw bad('Invalid profile visibility.');
  const themeId = requiredString(object.themeId, 30, 'profile.themeId');
  if (!PROFILE_THEMES.has(themeId)) throw bad('Invalid profile theme.');

  return {
    schemaVersion,
    displayName: requiredString(object.displayName, 40, 'profile.displayName'),
    oshiName: stringValue(object.oshiName, 80, 'profile.oshiName'),
    oshiSince: stringValue(object.oshiSince, 80, 'profile.oshiSince'),
    favoriteSong: stringValue(object.favoriteSong, 120, 'profile.favoriteSong'),
    favoritePoint: stringValue(object.favoritePoint, 400, 'profile.favoritePoint'),
    doufanStance: stringValue(object.doufanStance, 120, 'profile.doufanStance'),
    participationHistory: stringValue(object.participationHistory, 500, 'profile.participationHistory'),
    favoriteOutfit: stringValue(object.favoriteOutfit, 200, 'profile.favoriteOutfit'),
    message: stringValue(object.message, 280, 'profile.message'),
    bio: stringValue(object.bio, 800, 'profile.bio'),
    themeId,
    visibility,
    updatedAt: finiteNumber(object.updatedAt, 'profile.updatedAt'),
  };
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, maxLength: number, field: string): string {
  if (typeof value !== 'string') throw bad(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw bad(`${field} is required.`);
  if (trimmed.length > maxLength) throw bad(`${field} is too long.`);
  return trimmed;
}

function stringValue(value: unknown, maxLength: number, field: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw bad(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw bad(`${field} is too long.`);
  return trimmed;
}

function optionalString(value: unknown, maxLength: number, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, maxLength, field);
}

function requiredInteger(value: unknown, min: number, max: number, field: string): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw bad(`${field} must be an integer between ${min} and ${max}.`);
  }
  return value as number;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw bad(`${field} must be a finite number.`);
  return value;
}

function boundedNumber(value: unknown, min: number, max: number, field: string): number {
  const number = finiteNumber(value, field);
  if (number < min || number > max) throw bad(`${field} must be between ${min} and ${max}.`);
  return number;
}

function stringRecord(
  value: unknown,
  maxEntries: number,
  maxValueLength: number,
  field: string,
): Record<string, string> {
  const object = asRecord(value, field);
  const entries = Object.entries(object);
  if (entries.length > maxEntries) throw bad(`${field} has too many entries.`);
  return Object.fromEntries(entries.map(([key, item]) => [
    requiredString(key, 60, `${field} key`),
    requiredString(item, maxValueLength, `${field}.${key}`),
  ]));
}

function bad(message: string): HttpError {
  return new HttpError(400, 'bad_request', message);
}
