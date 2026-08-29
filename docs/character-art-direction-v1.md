# Character Art Direction v1

## Status
This document is the visual source of truth for the production character reset.

The existing character remains a technical test model. Do not derive final hair, outfit, or body assets by polishing its current 3D/doll-like look.

## Target
A lively Japanese manga/anime-style chibi character suitable for an idol-oriented character creator.

Reference direction:
- approximately 2.3–2.6 heads tall
- cute but not preschool/fancy-toy styled
- delicate, slightly elegant silhouette
- looks like a hand-drawn manga illustration that happens to move
- avoids the rigid feeling of a modular 3D avatar

## Drawing language
- Use fine linework with deliberate variation in line weight.
- Avoid perfectly uniform vector contours.
- Preserve slight asymmetry and organic curves where they make the character feel drawn rather than assembled.
- Use restrained cel shading plus soft hand-painted accents instead of glossy 3D gradients.
- Keep highlights selective. Do not make every surface look plastic.
- Use soft cheek color and subtle warm skin shading.

## Head and face
- Large rounded cranium, but the facial features occupy a smaller coherent area inside it.
- Face should not become a large vertical plate.
- Large expressive anime eyes with manga-style lashes and hand-drawn highlights.
- Small nose indication or no explicit nose depending on expression.
- Small mouth with expression-specific shapes.
- Short eye-to-chin distance.
- Ears should support the head silhouette, not widen it excessively.

## Hair
- Hair must read as flowing locks, not one rigid helmet.
- Use primary masses plus secondary locks and a small number of flyaway strands.
- Hair-front and hair-back may be technically separate, but the seam must disappear in the final image.
- Different hairstyles must fit the same production head standard. Never resize the face to fit a hairstyle.

## Body proportions
- Overall target: 2.3–2.6 heads.
- Narrow, delicate shoulders.
- Short torso, but not a toddler body.
- Arms and legs are stylized and compact while retaining graceful taper.
- Hands should have readable gesture silhouettes rather than stick-like endpoints.
- Feet/shoes may be slightly enlarged for chibi stability, but should not feel like toy blocks.
- Avoid perfect bilateral symmetry in relaxed poses.

## Clothing
- Fabric should bend and overlap naturally.
- Ribbons, frills, sleeves, skirts, and loose details should have soft curves and slight asymmetry.
- Avoid excessive micro-detail that disappears at mobile display size.
- Outfit layers must remain technically separable without looking like disconnected plates.

## Rig layer target
Back to front, production assets should support at least:
1. hair_back
2. head / ears
3. face_skin
4. eyes / brows
5. mouth
6. hair_front
7. neck
8. torso / outfit_top
9. sleeve_L / sleeve_R
10. arm_L / arm_R
11. hand_L / hand_R
12. bottom
13. leg_L / leg_R
14. legwear_L / legwear_R
15. shoe_L / shoe_R
16. face accessory
17. body accessory

## Motion direction
Animation must preserve the feeling of a drawn character.
- Idle uses subtle breathing, weight shift, hair-tip delay, and sleeve/accessory follow-through.
- Gestures should include small anticipation and settle phases.
- Avoid mechanically mirrored limb movement.
- Hair and clothing secondary motion should lag the body slightly.
- Expression changes should be part of motion, not merely sprite swaps after the body moves.

## Production rules
- The current test atlas is not the visual source of truth.
- PR #46 is useful as a proportion experiment, not as approval of the final art style.
- Do not resume production SLEEK LONG / LAYERED LOB / HIGH PONY assets until the new base character passes the visual gate.
- Do not make final outfits before the production body standard passes.
- Skin and clothing must never be baked into the same recolorable asset.
- All interchangeable assets must fit the common rig without changing head/face/body scale.

## Visual gate for the new base character
Before mass-producing parts, a neutral front-view production base must pass all of these:
- immediately reads as manga/anime illustration rather than 3D avatar or toy doll
- cute but not strongly child-oriented
- whole-body proportions feel coherent at mobile size
- head, face, torso, arms, legs, hands, and shoes share one design language
- silhouette remains attractive without outfit micro-detail
- linework and shading retain softness and hand-drawn character
- face feels lively in neutral expression
- layer seams are not visually obvious

Only after this gate passes should production hair and outfit work resume.
