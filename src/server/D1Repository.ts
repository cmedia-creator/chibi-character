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
import type { CharacterAppearance, OshiProfileDraft, RoomState, Visibility } from '../data/models';
import type { D1Database } from './cloudflare';
import { RepositoryConflictError, RepositoryForbiddenError } from './errors';
import type { ServerRepository } from './Repository';

type CharacterRow = {
  id: string;
  user_id: string;
  name: string;
  appearance_json: string;
  room_json: string;
  schema_version: number;
  created_at: number;
  updated_at: number;
};

type ProfileRow = {
  user_id: string;
  slug: string;
  display_name: string;
  oshi_name: string;
  oshi_since: string;
  favorite_song: string;
  favorite_point: string;
  doufan_stance: string;
  participation_history: string;
  favorite_outfit: string;
  message: string;
  bio: string;
  theme_id: string;
  visibility: Visibility;
  schema_version: number;
  updated_at: number;
};

export class D1Repository implements ServerRepository {
  constructor(private readonly db: D1Database) {}

  async sessionUserId(sessionHash: string, now: number): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT user_id FROM sessions WHERE id_hash = ? AND expires_at > ? LIMIT 1')
      .bind(sessionHash, now)
      .first<{ user_id: string }>();
    return row?.user_id ?? null;
  }

  async listCharacters(userId: string): Promise<SavedCharacter[]> {
    const result = await this.db
      .prepare(`
        SELECT id, user_id, name, appearance_json, room_json, schema_version, created_at, updated_at
        FROM characters
        WHERE user_id = ? AND is_active = 1
        ORDER BY updated_at DESC
      `)
      .bind(userId)
      .all<CharacterRow>();
    return (result.results ?? []).map((row) => this.characterFromRow(row));
  }

  async saveCharacter(userId: string, input: SaveCharacterRequest, now: number): Promise<SaveCharacterResponse> {
    const requestedId = input.characterId?.trim() || null;
    const latestOwned = await this.db
      .prepare(`
        SELECT id, user_id, created_at
        FROM characters
        WHERE user_id = ?
        ORDER BY is_active DESC, updated_at DESC
        LIMIT 1
      `)
      .bind(userId)
      .first<{ id: string; user_id: string; created_at: number }>();

    let id = requestedId ?? latestOwned?.id ?? crypto.randomUUID();
    let existing = await this.db
      .prepare('SELECT id, user_id, created_at FROM characters WHERE id = ? LIMIT 1')
      .bind(id)
      .first<{ id: string; user_id: string; created_at: number }>();

    if (existing && existing.user_id !== userId) {
      throw new RepositoryForbiddenError('Character belongs to another user.');
    }

    // MVP rule: one account owns one active saved character. Saving without an ID
    // updates the existing character. A caller cannot manufacture a second row by
    // submitting a fresh arbitrary characterId. Paid multi-save can replace this
    // check with an entitlement/slot limit later.
    if (requestedId && !existing && latestOwned) {
      throw new RepositoryConflictError('Only one saved character is available in the MVP.');
    }

    if (!existing && !requestedId && latestOwned) {
      id = latestOwned.id;
      existing = latestOwned;
    }

    const createdAt = existing?.created_at ?? now;
    const draft = input.draft;
    await this.db.batch([
      this.db
        .prepare(`
          INSERT INTO characters (
            id, user_id, name, appearance_json, room_json, schema_version, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            appearance_json = excluded.appearance_json,
            room_json = excluded.room_json,
            schema_version = excluded.schema_version,
            is_active = 1,
            updated_at = excluded.updated_at
          WHERE characters.user_id = excluded.user_id
        `)
        .bind(
          id,
          userId,
          draft.name,
          JSON.stringify(draft.appearance),
          JSON.stringify(draft.room),
          draft.schemaVersion,
          createdAt,
          now,
        ),
      this.db
        .prepare('UPDATE characters SET is_active = 0 WHERE user_id = ? AND id <> ?')
        .bind(userId, id),
    ]);

    return {
      character: {
        id,
        name: draft.name,
        draft: { ...draft, updatedAt: now },
        createdAt,
        updatedAt: now,
      },
    };
  }

  async getProfile(userId: string): Promise<SavedProfile | null> {
    const row = await this.db
      .prepare(`
        SELECT user_id, slug, display_name, oshi_name, oshi_since, favorite_song,
               favorite_point, doufan_stance, participation_history, favorite_outfit,
               message, bio, theme_id, visibility, schema_version, updated_at
        FROM profiles
        WHERE user_id = ?
        LIMIT 1
      `)
      .bind(userId)
      .first<ProfileRow>();
    return row ? this.savedProfileFromRow(row) : null;
  }

  async saveProfile(userId: string, input: SaveProfileRequest, now: number): Promise<SaveProfileResponse> {
    const slugOwner = await this.db
      .prepare('SELECT user_id FROM profiles WHERE slug = ? AND user_id <> ? LIMIT 1')
      .bind(input.slug, userId)
      .first<{ user_id: string }>();
    if (slugOwner) throw new RepositoryConflictError('Profile slug is already in use.');

    const p = input.profile;
    await this.db
      .prepare(`
        INSERT INTO profiles (
          user_id, slug, display_name, oshi_name, oshi_since, favorite_song,
          favorite_point, doufan_stance, participation_history, favorite_outfit,
          message, bio, theme_id, visibility, schema_version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          slug = excluded.slug,
          display_name = excluded.display_name,
          oshi_name = excluded.oshi_name,
          oshi_since = excluded.oshi_since,
          favorite_song = excluded.favorite_song,
          favorite_point = excluded.favorite_point,
          doufan_stance = excluded.doufan_stance,
          participation_history = excluded.participation_history,
          favorite_outfit = excluded.favorite_outfit,
          message = excluded.message,
          bio = excluded.bio,
          theme_id = excluded.theme_id,
          visibility = excluded.visibility,
          schema_version = excluded.schema_version,
          updated_at = excluded.updated_at
      `)
      .bind(
        userId,
        input.slug,
        p.displayName,
        p.oshiName,
        p.oshiSince,
        p.favoriteSong,
        p.favoritePoint,
        p.doufanStance,
        p.participationHistory,
        p.favoriteOutfit,
        p.message,
        p.bio,
        p.themeId,
        p.visibility,
        p.schemaVersion,
        now,
      )
      .run();

    return {
      profile: {
        slug: input.slug,
        profile: { ...p, updatedAt: now },
        updatedAt: now,
      },
    };
  }

  async getPublicProfile(slug: string): Promise<PublicProfileResponse | null> {
    const profile = await this.db
      .prepare(`
        SELECT user_id, slug, display_name, oshi_name, oshi_since, favorite_song,
               favorite_point, doufan_stance, participation_history, favorite_outfit,
               message, bio, theme_id, visibility, schema_version, updated_at
        FROM profiles
        WHERE slug = ? AND visibility IN ('public', 'unlisted')
        LIMIT 1
      `)
      .bind(slug)
      .first<ProfileRow>();
    if (!profile) return null;

    const characterRow = await this.db
      .prepare(`
        SELECT id, user_id, name, appearance_json, room_json, schema_version, created_at, updated_at
        FROM characters
        WHERE user_id = ? AND is_active = 1
        ORDER BY updated_at DESC
        LIMIT 1
      `)
      .bind(profile.user_id)
      .first<CharacterRow>();

    const character = characterRow ? this.characterFromRow(characterRow).draft : null;
    return {
      slug: profile.slug,
      displayName: profile.display_name,
      oshiName: profile.oshi_name,
      oshiSince: profile.oshi_since,
      favoriteSong: profile.favorite_song,
      favoritePoint: profile.favorite_point,
      doufanStance: profile.doufan_stance,
      participationHistory: profile.participation_history,
      favoriteOutfit: profile.favorite_outfit,
      message: profile.message,
      bio: profile.bio,
      themeId: profile.theme_id,
      visibility: profile.visibility as 'public' | 'unlisted',
      character,
      shareImageUrl: null,
      updatedAt: profile.updated_at,
    };
  }

  async getEntitlements(userId: string): Promise<EntitlementsResponse> {
    const result = await this.db
      .prepare('SELECT pack_id, acquired_at FROM entitlements WHERE user_id = ? ORDER BY acquired_at ASC')
      .bind(userId)
      .all<{ pack_id: string; acquired_at: number }>();
    const rows = result.results ?? [];
    return {
      packIds: rows.map((row) => row.pack_id),
      updatedAt: rows.reduce((latest, row) => Math.max(latest, row.acquired_at), 0),
    };
  }

  private characterFromRow(row: CharacterRow): SavedCharacter {
    const appearance = parseJson<CharacterAppearance>(row.appearance_json, 'appearance_json');
    const room = parseJson<RoomState>(row.room_json, 'room_json');
    return {
      id: row.id,
      name: row.name,
      draft: {
        schemaVersion: row.schema_version,
        name: row.name,
        appearance,
        room,
        updatedAt: row.updated_at,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private savedProfileFromRow(row: ProfileRow): SavedProfile {
    return {
      slug: row.slug,
      profile: this.profileDraftFromRow(row),
      updatedAt: row.updated_at,
    };
  }

  private profileDraftFromRow(row: ProfileRow): OshiProfileDraft {
    return {
      schemaVersion: row.schema_version,
      displayName: row.display_name,
      oshiName: row.oshi_name,
      oshiSince: row.oshi_since,
      favoriteSong: row.favorite_song,
      favoritePoint: row.favorite_point,
      doufanStance: row.doufan_stance,
      participationHistory: row.participation_history,
      favoriteOutfit: row.favorite_outfit,
      message: row.message,
      bio: row.bio,
      themeId: row.theme_id,
      visibility: row.visibility,
      updatedAt: row.updated_at,
    };
  }
}

function parseJson<T>(value: string, field: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Corrupt ${field} in D1.`);
  }
}
