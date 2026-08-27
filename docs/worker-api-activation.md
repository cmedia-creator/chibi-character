# Worker API / D1 Activation

この文書は、Cloudflare側でD1を作成したあとに行う本番有効化手順を固定する。

## 現在の状態

コード側は以下まで準備済み。

- `migrations/0001_core.sql`
- `src/server/worker-entry.ts`
- `src/server/App.ts`
- `src/server/D1Repository.ts`
- session cookie hash lookup
- character / profile payload validation
- public profile API
- entitlement API

ただし `wrangler.jsonc` にはまだ `main` / `DB` / `ASSETS` bindingを追加していない。

D1 database IDを推測値で書かないためである。

## Cloudflareで作成するもの

Database name:

`chibi-character-db`

Binding name:

`DB`

Static Assets binding:

`ASSETS`

## D1作成後のwrangler設定イメージ

実際の `database_id` はCloudflareが発行した値を使う。

```jsonc
{
  "name": "chibi-character",
  "main": "src/server/worker-entry.ts",
  "compatibility_date": "2026-08-28",
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "chibi-character-db",
      "database_id": "<CLOUDFLARE発行ID>",
      "migrations_dir": "migrations"
    }
  ]
}
```

## Migration

D1 binding追加後、まずpreview/dev側でmigrationを適用し、構造をRead Only確認する。

適用対象:

- users
- passkey_credentials
- webauthn_challenges
- sessions
- characters
- profiles
- entitlements
- share_assets
- payment_events

本番migration適用前に、対象database名とenvironmentを必ず確認する。

## API routes

- `GET /api/me`
- `GET /api/characters`
- `PUT /api/characters`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/public/:slug`
- `GET /api/entitlements`

認証済みAPIは `chibi_session` cookieをSHA-256化し、D1の `sessions.id_hash` と照合する。

## まだ有効化しないもの

- Passkey registration/authentication endpoints
- Stripe Checkout / webhook
- R2 share asset upload

これらはD1接続後、個別Gateで実装する。
