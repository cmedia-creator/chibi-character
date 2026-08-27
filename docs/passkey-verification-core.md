# Passkey Verification Core

このbranchでは WebAuthn の暗号検証を独自実装せず、`@simplewebauthn/server` に委譲する。

## Gate

- registration challenge はD1へhash保存し、検証時に1回だけconsumeする
- authentication challenge も同様にone-time consumeする
- expected origin / RP ID を検証する
- user verificationを要求する
- credential counterを認証成功後に更新する
- raw session tokenはD1へ保存しない
- session cookieは Secure / HttpOnly / SameSite=Lax
- auth HTTP routesはD1と濫用対策が有効になるまで本番公開しない

この文書追加は、CI failure artifact対応後のPR再検証を確実に発火させるための同期commitでもある。
