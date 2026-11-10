# video-hotkeys

**简体中文** · [English](README.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

[![hygiene](https://github.com/yanxijian/video-hotkeys/actions/workflows/hygiene.yml/badge.svg)](https://github.com/yanxijian/video-hotkeys/actions/workflows/hygiene.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-userscript-black.svg)](https://www.tampermonkey.net/)
[![Greasy Fork](https://img.shields.io/greasyfork/dt/604756)](https://greasyfork.org/zh-CN/scripts/604756-%E9%80%9A%E7%94%A8%E8%A7%86%E9%A2%91%E9%94%AE%E7%9B%98%E6%8E%A7%E5%88%B6-space)

<!-- translated-from: README.md sha256:da6ced81321d -->

给任意网页视频补上键盘控制的 Tampermonkey 用户脚本——尤其是那些没实现快捷键的网站。

## 功能

| 按键 | 动作 |
|---|---|
| `Space` | 播放 / 暂停（并阻止页面滚动） |
| `←` / `→` | 后退 / 前进 5 秒 |
| `Shift + ←` / `→` | 后退 / 前进 30 秒 |
| `↑` / `↓` | 音量 ±5%（↓ 到 0 静音，↑ 解除静音） |

- **智能定位** — 自动控制页面上最大的可见视频
- **让位原生快捷键** — 在已实现快捷键的站点（YouTube、爱奇艺、优酷、腾讯视频、Netflix、Twitch、抖音/TikTok 等）自动退出；`BLACKLIST` 在脚本顶部，可自行编辑
- **输入安全** — 在输入框 / contenteditable 中打字时绝不触发
- **视频内提示** — 反馈显示在视频视口内、底部居中；全屏下同样有效
- **直播安全** — 无有限时长的直播流不做快进快退
- **iframe 友好** — 嵌入式播放器里同样生效
- **多语言界面** — 提示文字跟随浏览器语言（English / 简体中文 / 日本語 / 한국어）

## 安装

1. 安装 Chrome / Edge / Firefox 的 [Tampermonkey](https://www.tampermonkey.net/)
2. 从 [Greasy Fork](https://greasyfork.org/zh-CN/scripts/604756-%E9%80%9A%E7%94%A8%E8%A7%86%E9%A2%91%E9%94%AE%E7%9B%98%E6%8E%A7%E5%88%B6-space) 一键安装（自动更新）
3. 或打开管理面板 → 新建脚本 → 粘贴 [`video-hotkeys.user.js`](video-hotkeys.user.js) 的内容 → 保存

## 自定义

所有可能想改的东西都在脚本顶部的配置块里：

```js
const SEEK_STEP = 5;      // ←/→ 步长（秒）
const VOLUME_STEP = 0.05; // ↑/↓ 步长
const BLACKLIST = [ ... ]; // 已有原生快捷键的站点，自动让路
```

## 许可证

[MIT](LICENSE)
