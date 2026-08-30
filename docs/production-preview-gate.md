# Production Preview Gate

The CREATE screen now defaults to the production-base static preview while the new manga/anime character direction is being validated.

Reason:
- the previous flow required `?base=production`, so opening CREATE normally could silently show the legacy test character instead;
- visual feedback on that legacy character was therefore not feedback on the production-base asset;
- during this gate, the production base must be the default thing the user sees on CREATE.

Behavior:
- `?creator=` => production base static preview by default
- `?creator=&base=test` => explicit legacy test character escape hatch for technical checks
- `?base=production` continues to force production preview outside CREATE

Production preview remains static. Motions and character-creator editing are intentionally disabled until the static visual gate passes.
