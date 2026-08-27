# Cloudflare Deploy Guide

本プロジェクトは Cloudflare Workers + Static Assets で配信する。

## 推奨: Workers Builds + GitHub

Cloudflare Dashboard で以下を設定する。

1. Workers & Pages を開く
2. Create application
3. Import a repository
4. GitHub の `cmedia-creator/chibi-character` を選択
5. Production branch: `main`
6. Build command: `npm run build`
7. Deploy command: `npx wrangler deploy`
8. Root directory: `/`
9. Save and Deploy

`wrangler.jsonc` では `./dist` を Static Assets として配信する。

デプロイ後は `*.workers.dev` URL で Phase 1 Technical Prototype を確認する。

## Gate 1 実機確認

- idle が微細に動く
- blink がランダム間隔で発生する
- キャラ領域タップで wave
- wave 後に基準姿勢へ戻る
- 頭・足が表示範囲から切れない
- iPhone Safari で操作できる
- Android Chrome で操作できる

DEBUG RIG は見た目評価用ではない。Gate 1 通過後に正式なK-POPアイドル風テストキャラクター1号へ差し替える。
