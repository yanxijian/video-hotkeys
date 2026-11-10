# video-hotkeys

**English** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

[![hygiene](https://github.com/yanxijian/video-hotkeys/actions/workflows/hygiene.yml/badge.svg)](https://github.com/yanxijian/video-hotkeys/actions/workflows/hygiene.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-userscript-black.svg)](https://www.tampermonkey.net/)
[![Greasy Fork](https://img.shields.io/greasyfork/dt/604756)](https://greasyfork.org/zh-CN/scripts/604756-%E9%80%9A%E7%94%A8%E8%A7%86%E9%A2%91%E9%94%AE%E7%9B%98%E6%8E%A7%E5%88%B6-space)

A Tampermonkey userscript that adds keyboard controls to **any** HTML5 video on the web — including sites that never implemented them.

## Features

| Key | Action |
|---|---|
| `Space` | Play / Pause (and stops the page from scrolling) |
| `←` / `→` | Seek −5s / +5s |
| `Shift + ←` / `→` | Seek −30s / +30s |
| `↑` / `↓` | Volume ±5% (↓ to 0 mutes, ↑ unmutes) |

- **Smart targeting** — controls the largest visible video on the page
- **Defers to native hotkeys** — exits on sites that implement their own (YouTube, Netflix, Twitch, TikTok, …). Editable `BLACKLIST` at the top of the script
- **Typing-safe** — never fires while you're typing in inputs / contenteditable
- **In-video toast** — feedback shows inside the video viewport, bottom-center; works in fullscreen
- **Live-stream safe** — no seeking on streams without a finite duration
- **iframe-friendly** — runs in embedded players too

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome / Edge / Firefox
2. Install from [Greasy Fork](https://greasyfork.org/zh-CN/scripts/604756-%E9%80%9A%E7%94%A8%E8%A7%86%E9%A2%91%E9%94%AE%E7%9B%98%E6%8E%A7%E5%88%B6-space) — one click, updates automatically
3. Or open the dashboard → Create a new script → paste the contents of [`video-hotkeys.user.js`](video-hotkeys.user.js) → save

## Configuration

Everything you might want to tweak sits in the config block at the top:

```js
const SEEK_STEP = 5;      // ←/→ step in seconds
const VOLUME_STEP = 0.05; // ↑/↓ step
const BLACKLIST = [ ... ]; // sites with native hotkeys, skipped automatically
```

## License

[MIT](LICENSE)
