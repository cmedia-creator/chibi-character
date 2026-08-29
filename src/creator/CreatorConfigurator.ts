import type { AtlasCharacterRig } from '../engine/AtlasCharacterRig';
import type { CharacterDraft, EntitlementSnapshot } from '../data/models';
import { canUseBundle } from '../catalog/CatalogService';
import type { CatalogBundle, CatalogCategory } from '../catalog/types';

const CLEAN_FACE_SOURCE = { asset: '/assets/face/clean-base.svg' };

const HEAD_V2_LAYOUT = {
  face: { x: 0, y: 18, width: 360, height: 340 },
  eyes_open: { x: 0, y: 18, width: 248, height: 76 },
  eyes_closed: { x: 0, y: 22, width: 214, height: 43 },
  mouth: { x: 0, y: 92, width: 52, height: 18 },
  accessory: { x: 104, y: 45, width: 72, height: 72 },
} as const;

export async function applyCatalogBundle(
  rig: AtlasCharacterRig,
  bundle: CatalogBundle,
  entitlements: EntitlementSnapshot | null,
): Promise<void> {
  if (!canUseBundle(bundle, entitlements)) {
    throw new Error(`Pack required: ${bundle.packId}`);
  }

  // Production hair uses a shared v2 head standard instead of the original
  // prototype face geometry. Keeping the head dimensions stable gives every
  // hair asset the same fitting target.
  if (bundle.category === 'hair') {
    rig.resetPartDebugState('face');
    await rig.replacePartSource('face', CLEAN_FACE_SOURCE);
    for (const [slot, layout] of Object.entries(HEAD_V2_LAYOUT)) {
      rig.setPartDebugState(slot, layout);
    }
  }

  await Promise.all(
    Object.entries(bundle.sources).map(async ([slot, source]) => {
      // Hair slots still return to their character-definition layout before a
      // bundle-specific transform. Head-v2 facial geometry is intentionally
      // preserved across hair changes.
      if (!(bundle.category === 'hair' && slot in HEAD_V2_LAYOUT)) {
        rig.resetPartDebugState(slot);
      }
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
