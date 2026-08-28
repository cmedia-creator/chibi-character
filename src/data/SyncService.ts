import { ApiClient } from '../api/ApiClient';
import type { SavedCharacter, SavedProfile } from '../api/contracts';
import { validateProfileSlug } from '../profile/slug';
import { DraftStore } from './DraftStore';
import {
  createEmptyCharacterDraft,
  type CharacterDraft,
  type EntitlementSnapshot,
  type OshiProfileDraft,
} from './models';

export interface SyncSnapshot {
  authenticated: boolean;
  character: SavedCharacter | null;
  profile: SavedProfile | null;
  entitlements: EntitlementSnapshot | null;
}

export class SyncService {
  constructor(
    private readonly api = new ApiClient(),
    private readonly drafts = new DraftStore(),
  ) {}

  async status(): Promise<{ authenticated: boolean; userId: string }> {
    const me = await this.api.getMe();
    return { authenticated: me.authenticated, userId: me.userId };
  }

  /**
   * Explicitly persists the current local character draft.
   * This is intentionally never called from sliders, taps, idle motions or autosave.
   */
  async saveCharacter(characterId?: string): Promise<SavedCharacter> {
    const draft = await this.requireCharacterDraft();
    const result = await this.api.saveCharacter({ characterId, draft });
    await this.drafts.saveCharacterDraft(result.character.draft);
    return result.character;
  }

  /**
   * Technical-prototype helper: if CREATE has not produced a local draft yet,
   * bootstrap a minimal draft that represents the on-screen test character and
   * persist it through the exact same explicit D1 save path.
   */
  async saveTestCharacter(characterId?: string): Promise<SavedCharacter> {
    let draft = await this.drafts.loadCharacterDraft();
    if (!draft) {
      draft = createEmptyCharacterDraft();
      draft.name = 'TEST CHARACTER 01';
      draft.appearance.parts = {
        preset: 'test-character-01',
      };
      await this.drafts.saveCharacterDraft(draft);
    }

    const result = await this.api.saveCharacter({ characterId, draft });
    await this.drafts.saveCharacterDraft(result.character.draft);
    return result.character;
  }

  /** Explicitly persists the current local oshi profile draft. */
  async saveProfile(slugInput: string): Promise<SavedProfile> {
    const profile = await this.requireProfileDraft();
    const slug = validateProfileSlug(slugInput);
    if (!slug.ok) throw new Error(`Invalid profile slug: ${slug.reason}`);
    const result = await this.api.saveProfile({ slug: slug.slug, profile });
    await this.drafts.saveProfileDraft(result.profile.profile);
    return result.profile;
  }

  async refreshEntitlements(): Promise<EntitlementSnapshot> {
    const snapshot = await this.api.getEntitlements();
    await this.drafts.saveEntitlementsCache(snapshot);
    return snapshot;
  }

  /**
   * Pulls authoritative saved state after authentication or an explicit refresh.
   * It does not run on every page render, keeping normal character activity DB-free.
   */
  async hydrateFromServer(): Promise<SyncSnapshot> {
    const me = await this.api.getMe();
    if (!me.authenticated) {
      return { authenticated: false, character: null, profile: null, entitlements: null };
    }

    const [characters, profile, entitlements] = await Promise.all([
      this.api.getCharacters(),
      this.api.getProfile(),
      this.api.getEntitlements(),
    ]);
    const character = characters[0] ?? null;

    if (character) await this.drafts.saveCharacterDraft(character.draft);
    if (profile) await this.drafts.saveProfileDraft(profile.profile);
    await this.drafts.saveEntitlementsCache(entitlements);

    return { authenticated: true, character, profile, entitlements };
  }

  async localSnapshot(): Promise<{
    character: CharacterDraft | null;
    profile: OshiProfileDraft | null;
    entitlements: EntitlementSnapshot | null;
  }> {
    const [character, profile, entitlements] = await Promise.all([
      this.drafts.loadCharacterDraft(),
      this.drafts.loadProfileDraft(),
      this.drafts.loadEntitlementsCache(),
    ]);
    return { character, profile, entitlements };
  }

  private async requireCharacterDraft(): Promise<CharacterDraft> {
    const draft = await this.drafts.loadCharacterDraft();
    if (!draft) throw new Error('Character draft does not exist.');
    return draft;
  }

  private async requireProfileDraft(): Promise<OshiProfileDraft> {
    const draft = await this.drafts.loadProfileDraft();
    if (!draft) throw new Error('Profile draft does not exist.');
    return draft;
  }
}
