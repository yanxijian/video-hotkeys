# video-hotkeys

**日本語** · [English](README.md) · [简体中文](README.zh-CN.md) · [한국어](README.ko.md)

[![hygiene](https://github.com/yanxijian/video-hotkeys/actions/workflows/hygiene.yml/badge.svg)](https://github.com/yanxijian/video-hotkeys/actions/workflows/hygiene.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-userscript-black.svg)](https://www.tampermonkey.net/)
[![Greasy Fork](https://img.shields.io/greasyfork/dt/604756)](https://greasyfork.org/zh-CN/scripts/604756-%E9%80%9A%E7%94%A8%E8%A7%86%E9%A2%91%E9%94%AE%E7%9B%98%E6%8E%A7%E5%88%B6-space)

<!-- translated-from: README.md sha256:da6ced81321d -->

ショートカットキーを実装していないサイトを含め、ウェブ上の**あらゆる** HTML5 動画にキーボード操作を追加する Tampermonkey ユーザースクリプト。

## 機能

| キー | 動作 |
|---|---|
| `Space` | 再生 / 一時停止（ページのスクロールも防止） |
| `←` / `→` | 5 秒巻き戻し / 5 秒早送り |
| `Shift + ←` / `→` | 30 秒巻き戻し / 30 秒早送り |
| `↑` / `↓` | 音量 ±5%（↓ で 0 になるとミュート、↑ で解除） |

- **スマートターゲティング** — ページ上で最も大きな表示中の動画を自動で操作
- **ネイティブのショートカットに譲る** — YouTube、Netflix、Twitch、TikTok など独自実装のあるサイトでは自動的に無効化。`BLACKLIST` はスクリプト先頭で編集可能
- **入力安全** — 入力欄 / contenteditable への入力中には決して発火しない
- **動画内トースト** — フィードバックは動画のビューポート内・中央下に表示。全画面でも有効
- **ライブ配信セーフ** — 長さが確定していない配信ではシークしない
- **iframe 対応** — 埋め込みプレーヤーでも動作
- **多言語 UI** — トースト表示はブラウザの言語に追従（English / 简体中文 / 日本語 / 한국어）

## インストール

1. Chrome / Edge / Firefox 向け [Tampermonkey](https://www.tampermonkey.net/) をインストール
2. [Greasy Fork](https://greasyfork.org/zh-CN/scripts/604756-%E9%80%9A%E7%94%A8%E8%A7%86%E9%A2%91%E9%94%AE%E7%9B%98%E6%8E%A7%E5%88%B6-space) からワンクリックでインストール（自動更新）
3. またはダッシュボードを開く → 新規スクリプト作成 → [`video-hotkeys.user.js`](video-hotkeys.user.js) の内容を貼り付け → 保存

## 設定

変更したくなりそうなものは、すべてスクリプト先頭の設定ブロックにまとめてあります:

```js
const SEEK_STEP = 5;      // ←/→ のステップ（秒）
const VOLUME_STEP = 0.05; // ↑/↓ のステップ
const BLACKLIST = [ ... ]; // ネイティブのショートカットがあるサイト（自動で譲る）
```

## ライセンス

[MIT](LICENSE)
