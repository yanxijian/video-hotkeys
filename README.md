# Universal Video Hotkeys / 通用视频键盘控制

A Tampermonkey userscript that adds keyboard controls to **any** HTML5 video on the web — including sites that never implemented them.

给任意网页视频补上键盘控制的 Tampermonkey 用户脚本——尤其是那些没实现快捷键的网站。

## Features / 功能

| Key | Action |
|---|---|
| `Space` | Play / Pause（并阻止页面滚动） |
| `←` / `→` | Seek −5s / +5s |
| `Shift + ←` / `→` | Seek −30s / +30s |
| `↑` / `↓` | Volume ±5%（↓ 到 0 静音，↑ 解除静音） |

- **Smart targeting** — controls the largest visible video on the page
- **Defers to native hotkeys** — exits on sites that implement their own (YouTube, 爱奇艺, 优酷, 腾讯视频, Netflix, Twitch, 抖音/TikTok …). Editable `BLACKLIST` at the top of the script
- **Typing-safe** — never fires while you're typing in inputs / contenteditable
- **In-video toast** — feedback shows inside the video viewport, bottom-center; works in fullscreen
- **Live-stream safe** — no seeking on streams without a finite duration
- **iframe-friendly** — runs in embedded players too

## Install / 安装

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome / Edge / Firefox
2. Open the dashboard → Create a new script → paste the contents of [`video-hotkeys.user.js`](video-hotkeys.user.js) → save
3. Or install directly from the raw file once published on Greasy Fork (link TBD)

## Configuration / 自定义

Everything you might want to tweak sits in the config block at the top:

```js
const SEEK_STEP = 5;      // ←/→ 步长（秒）
const VOLUME_STEP = 0.05; // ↑/↓ 步长
const BLACKLIST = [ ... ]; // 已有原生快捷键的站点，自动让路
```

## License

[MIT](LICENSE)
