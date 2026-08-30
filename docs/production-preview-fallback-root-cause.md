# Production preview fallback root cause

The production preview routing is correct, but the browser falls back to `DEBUG RIG FALLBACK` because `AtlasCharacterRig.create()` fails while loading the production static texture.

The JSON definition exists in production and points to `/assets/production-base-v1/production-base-v1-static.webp`. The repository also contains that path, so the remaining failure is asset decode/load rather than routing.

Fix strategy:

1. Replace the production WebP with a freshly encoded, verified WebP derived from the approved production-base master image.
2. Keep the static gate as a single sprite until the visual is approved.
3. Do not alter body proportions during this fix.
4. Verify the browser label becomes `PRODUCTION BASE V1 / STATIC GATE` / `PRODUCTION BASE PREVIEW` and does not fall back to the debug rig.
