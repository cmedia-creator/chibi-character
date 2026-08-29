# Production Base v1 Layer Pack

## Status
The production base character is now being converted from a design reference into real riggable raster layers.

This is no longer a presentation-sheet convention. The working layer pack contains actual transparent raster parts extracted into an atlas-ready set.

## Branch
`feat/production-base-character-v1`

## Core layer names
- hair_back
- hair_front
- face_skin
- eye_open_L
- eye_open_R
- eye_closed_L
- eye_closed_R
- mouth_neutral
- mouth_smile
- mouth_open
- torso
- shorts
- arm_L
- arm_R
- hand_L
- hand_R
- leg_L
- leg_R
- sock_L
- sock_R
- shoe_L
- shoe_R
- hairpin
- ribbon
- earring_L
- earring_R
- cheek
- shadow

## Runtime packaging
The intended runtime format is one transparent atlas plus frame metadata, matching the existing PixiJS atlas-oriented character system. Individual design layers remain independent frames even when packaged into one runtime image.

Target runtime files:
- `/assets/production-base-v1/production-base-v1-atlas.webp`
- `/data/characters/production-base-v1.json`

The atlas must remain lossless/alpha-capable. The character definition will reference frame rectangles for each layer and will keep the existing bone/slot architecture.

## Static visual gate
Before any new hairstyle production resumes, the Web CREATE preview must show the new base character in a neutral front pose and pass:
- manga/anime illustration feel rather than 3D avatar feel
- coherent 2.3–2.6-head full-body balance
- soft line/shading language across head and body
- no visible seams between modular layers
- neutral face already feels lively
- hands/feet do not read as toy blocks or sticks

Blink, idle, hand-wave, hair tint, clothing tint, save/restore, and additional hair production are later gates. Static reconstruction comes first.
