# chibi-character

動くちびキャラサービスの開発リポジトリです。

## 現在地

Phase 0 の設計を完了し、Phase 1 Technical Prototype に着手しています。

現在の目的は、**本番キャラクターデザインを作る前に、Character JSON / Bone / Motion JSON / PixiJS の分離構造が成立することを検証すること**です。

## Phase 1 検証範囲

- Vite + TypeScript
- PixiJS v8
- Character JSON 読み込み
- Bone Container
- パーツ別 Sprite 配置
- idle（微細な上下動）
- blink（ランダム間隔）
- wave（Motion JSON / Keyframe駆動）
- キャラ領域タップ反応
- モバイル前提の1:1ステージ
- Cloudflare Workers Static Assets 設定

## Debug Rig について

`public/assets/debug-rig/` は**デザイン案ではありません**。
Bone / Pivot / Blink / Wave の技術確認だけを目的とした無機質なテスト素体です。

本番用のK-POPアイドル風ちびキャラ素材は、この技術Gateを通過したあとに別途制作・分割します。

## 起動

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Cloudflare deploy

```bash
npm run deploy
```

## Phase 1 Gate

- [ ] Character JSONから正常表示
- [ ] 頭・足が見切れない
- [ ] idleが不自然でない
- [ ] blinkが規則的すぎない
- [ ] waveの肩Pivotがズレない
- [ ] タップ連打で壊れない
- [ ] iPhone Safariで操作可能
- [ ] Android Chromeで操作可能

Gate通過後、正式テストキャラクター1号を制作します。
