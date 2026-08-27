# Phase 2 Data Foundation

## 方針

本サービスでは、ユーザー操作量とサーバー費用をできるだけ切り離す。

- 編集中: ブラウザ内で処理
- 下書き: IndexedDB
- 明示的な「保存」: D1へ書き込み
- パーツ画像 / Motion JSON / pack catalog: Static Assets
- 公開プロフィール用の生成済み画像: R2（導入時）
- 動画生成: クライアント側

IndexedDB は正本ではない。ログイン済みユーザーの保存済みキャラクター・プロフィール・購入権利は D1 を正本とする。

## D1 migration

`migrations/0001_core.sql`

初期テーブル:

- `users`
- `passkey_credentials`
- `sessions`
- `characters`
- `profiles`
- `entitlements`
- `share_assets`
- `payment_events`

### characters

キャラクター外見は Phase 2 では `appearance_json` を中心に保存する。

細かなパーツ選択を列へ過剰に正規化しない。パーツ規格が固まる前にテーブルを増殖させると、人間が自分で作ったスキーマに追い回されるため。

### profiles

公開範囲は以下の3段階。

- `private`
- `unlisted`
- `public`

`slug` は公開URL用で UNIQUE。

### entitlements

購入済みpackのみ保持する。個別パーツ利用のたびに Stripe や D1 を確認しない。

ログイン時・明示的な同期時に取得し、クライアントでキャッシュする。

## Local draft

`src/data/DraftStore.ts`

IndexedDB に保存するもの:

- character draft
- oshi profile draft
- entitlement snapshot cache

保存済みD1データの代替ではなく、編集途中の復元と通信削減が目的。

## Share

`src/share/ProfileCardRenderer.ts` はブラウザ内で推しプロフィールカードを生成する。

- 初期サイズ: 1080 × 1350
- `simple / y2k / heisei / street` theme foundation
- キャラCanvasをカード内へ合成可能
- PNG Blob出力
- Web Share API利用可能端末ではネイティブ共有
- 非対応環境ではファイル保存へフォールバック

公開プロフィールのOG画像を導入する際は、プロフィール変更時だけ再生成して R2 に保存する。閲覧のたびに生成しない。

## Cloudflare側で次に必要な人間操作

コード側だけでは完了しない項目:

1. D1 database作成
2. `wrangler.jsonc` にD1 binding追加
3. migration適用
4. R2導入時はbucket作成とbinding追加
5. Passkey API実装後に本番OriginでWebAuthn実機確認

D1作成前にbindingだけ追加するとデプロイを壊すため、migrationと型だけ先にGit管理する。
