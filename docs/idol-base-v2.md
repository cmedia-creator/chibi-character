# Idol Base v2

## Current gate

The production preview now uses one fixed adult pseudo-idol identity, pose, body standard, hair, and camera alignment across four outfit states.

The first implementation gate deliberately limits editing to `outfit`. Hair, facial expression, hands, and accessories stay fixed until outfit switching passes the static browser gate.

## Runtime asset

- Transparent runtime sheet: `public/assets/idol-base-v2/idol-look-strip.webp`
- Frame size: `192 x 422`
- Frames: rehearsal base, sky-blue idol, silver stage, gray cardigan
- Runtime slot: `production_look`

## Why the first gate swaps a complete look frame

The generated artwork keeps the character visually consistent but is not yet a trustworthy pixel-perfect clothing-only overlay. Swapping complete aligned frames avoids exposed seams and false layering while the art standard is being approved.

After approval, the fixed rehearsal frame becomes the registration standard for true transparent layers. The next extraction order is:

1. face and hair identity layer
2. body base
3. outfit overlay
4. expression overlays
5. hand and arm gesture states
6. accessories and secondary motion

This preserves the product contract (one fixed pseudo-idol whose clothing changes) without pretending that a composite sprite is already a production rig.
