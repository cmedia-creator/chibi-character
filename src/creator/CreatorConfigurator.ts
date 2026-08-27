import type { AtlasCharacterRig } from '../engine/AtlasCharacterRig';
import type { CharacterDraft, EntitlementSnapshot } from '../data/models';
import { canUseBundle } from '../catalog/CatalogService';
import type { CatalogBundle, CatalogCategory } from '../catalog/types';

export async function applyCatalogBundle(
  rig: AtlasCharacterRig,
  bundle: CatalogBundle,
  entitlements: EntitlementSnapshot | null,
): Promise<void> {
  if (!canUseBundle(bundle, entitlements)) {
    throw new Error(`Pack required: ${bundle.packId}`);
  }

  await Promise.all(
    Object.entries(bundle.sources).map(([slot, source]) => rig.replacePartSource(slot, source)),
  );
}

export function applyBundleToDraft(
  draft: CharacterDraft,
  category: CatalogCategory,
  bundle: CatalogBundle,
): CharacterDraft {
  return {
    ...draft,
    appearance: {
      ...draft.appearance,
      parts: {
        ...draft.appearance.parts,
        [category]: bundle.id,
      },
    },
    updatedAt: Date.now(),
  };
}
