import type { AtlasCharacterRig } from '../engine/AtlasCharacterRig';
import type { CharacterDraft, EntitlementSnapshot } from '../data/models';
import { canUseBundle } from '../catalog/CatalogService';
import type { CatalogBundle, CatalogCategory } from '../catalog/types';

const CLEAN_FACE_SOURCE = { asset: '/assets/face/clean-base.svg' };

export async function applyCatalogBundle(
  rig: AtlasCharacterRig,
  bundle: CatalogBundle,
  entitlements: EntitlementSnapshot | null,
): Promise<void> {
  if (!canUseBundle(bundle, entitlements)) {
    throw new Error(`Pack required: ${bundle.packId}`);
  }

  // The current atlas face still contains prototype hair/scalp pixels baked into
  // the face image. Production hair cannot layer cleanly over that source.
  // Until face assets are rebuilt as independent parts, switch to a clean skin
  // base whenever a hair bundle is applied.
  if (bundle.category === 'hair') {
    rig.resetPartDebugState('face');
    await rig.replacePartSource('face', CLEAN_FACE_SOURCE);
  }

  await Promise.all(
    Object.entries(bundle.sources).map(async ([slot, source]) => {
      // Always return the slot to its character-definition layout before applying
      // a bundle-specific transform. This prevents MEDIUM -> LONG, etc. from
      // inheriting the previous style's geometry.
      rig.resetPartDebugState(slot);
      await rig.replacePartSource(slot, source);
      if (source.layout) rig.setPartDebugState(slot, source.layout);
    }),
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
