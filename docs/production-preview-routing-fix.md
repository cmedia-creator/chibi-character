# Production Preview Routing Fix

The CREATE navigation now points directly to the production-base visual gate:

`/?creator=1&auth=1&base=production&auto=0`

This prevents normal CREATE navigation from silently showing the legacy test character during the production-base review phase.

Visual review rule:
- `PRODUCTION BASE V1 / STATIC GATE` + `PRODUCTION BASE PREVIEW` = correct review target
- `TEST CHARACTER 01 / LOCAL` + `TEST CHARACTER ACTIVE` = legacy technical model; do not use for production-art feedback
