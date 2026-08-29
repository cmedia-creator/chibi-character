import type { AtlasCharacterRig } from '../engine/AtlasCharacterRig';
import type { CharacterDraft, EntitlementSnapshot } from '../data/models';
import { canUseBundle } from '../catalog/CatalogService';
import type { CatalogBundle, CatalogCategory } from '../catalog/types';

const CLEAN_FACE_SOURCE = { asset: '/assets/face/clean-base.svg' };

const HEAD_V3_LAYOUT = {
  face: { x: 0, y: 2, width: 330, height: 285 },
  eyes_open: { x: 0, y: 2, width: 230, height: 70 },
  eyes_closed: { x: 0, y: 6, width: 198, height: 40 },
  mouth: { x: 0, y: 64, width: 48, height: 16 },
  accessory: { x: 94, y: 34, width: 68, height: 68 },
} as const;

export async function applyCatalogBundle(
  rig: AtlasCharacterRig,
  bundle: CatalogBundle,
  entitlements: EntitlementSnapshot | null,
): Promise<void> {
  if (!canUseBundle(bundle, entitlements)) {
    throw new Error(`Pack required: ${bundle.packId}`);
  }

  // Production hair uses one compact chibi head standard. The face, eyes,
  // mouth, ears and accessory positions are intentionally kept together so
  // every hair asset fits the same skull target instead of compensating for
  // the oversized prototype face.
  if (bundle.category === 'hair') {
    rig.resetPartDebugState('face');
    await rig.replacePartSource('face', CLEAN_FACE_SOURCE);
    for (const [slot, layout] of Object.entries(HEAD_V3_LAYOUT)) {
      rig.setPartDebugState(slot, layout);
    }
  }

  await Promise.all(
    Object.entries(bundle.sources).map(async ([slot, source]) => {
      if (!(bundle.category === 'hair' && slot in HEAD_V3_LAYOUT)) {
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
