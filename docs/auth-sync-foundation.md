# Auth / Sync Foundation

## Passkey方針

ブラウザ側の WebAuthn credential 作成・取得と、D1側の challenge / credential / session 保存境界を先に実装する。

署名・attestation/assertion検証は独自実装しない。WebAuthn検証はセキュリティ境界なので、D1接続後に実績のある検証ライブラリを選定し、その時点のAPIで実装する。

現時点で用意済み:

- base64url encode/decode
- `navigator.credentials.create()` adapter
- `navigator.credentials.get()` adapter
- `D1AuthStore`
  - user creation
  - one-time challenge create/consume
  - passkey credential persistence
  - signature counter update
  - 30日session creation
  - session revoke
  - expired challenge/session purge

## Session

Cookie名は `chibi_session`。

D1にはraw tokenを保存せず、SHA-256 hashのみ保存する。

将来のSet-Cookieは最低限:

- `HttpOnly`
- `Secure`
- `SameSite=Lax`
- `Path=/`
- 有効期限をD1 sessionと一致

## Sync方針

`SyncService` は明示操作時だけAPIを呼ぶ。

### DB書き込みしない操作

- キャラのidle / blink / walk / sit / heart
- タップ反応
- パーツ選択中の試着
- MY ROOM家具移動
- 推しプロフィール入力中
- share card preview
- short video rendering

これらは端末内処理 / IndexedDB下書き。

### D1へ書き込む操作

- ユーザーが明示的に「保存」を押した時のcharacter save
- ユーザーが明示的に「公開/保存」を押した時のprofile save
- Passkey auth/session管理
- 決済成功後のentitlement付与

`hydrateFromServer()` もログイン直後または明示refresh用途であり、通常のアニメーションループから呼ばない。
