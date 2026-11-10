# video-hotkeys

**한국어** · [English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

[![hygiene](https://github.com/yanxijian/video-hotkeys/actions/workflows/hygiene.yml/badge.svg)](https://github.com/yanxijian/video-hotkeys/actions/workflows/hygiene.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-userscript-black.svg)](https://www.tampermonkey.net/)

<!-- translated-from: README.md sha256:701c2a586fa7 -->

단축키를 아직 구현하지 않은 사이트를 포함해, 웹의 **모든** HTML5 동영상에 키보드 조작을 추가해 주는 Tampermonkey 유저스크립트입니다.

## 기능

| 키 | 동작 |
|---|---|
| `Space` | 재생 / 일시정지 (페이지 스크롤도 방지) |
| `←` / `→` | 5초 뒤로 / 앞으로 |
| `Shift + ←` / `→` | 30초 뒤로 / 앞으로 |
| `↑` / `↓` | 음량 ±5% (↓ 로 0이 되면 음소거, ↑ 로 해제) |

- **스마트 타기팅** — 페이지에서 가장 큰 보이는 동영상을 자동으로 조작
- **네이티브 단축키 양보** — YouTube, Netflix, Twitch, TikTok 등 자체 단축키가 있는 사이트에서는 자동으로 비활성화. `BLACKLIST`는 스크립트 상단에서 편집 가능
- **입력 안전** — 입력란 / contenteditable에 입력하는 중에는 절대 발동하지 않음
- **동영상 내 토스트** — 피드백은 동영상 뷰포트 안 하단 중앙에 표시. 전체 화면에서도 동작
- **라이브 스트림 안전** — 길이가 정해지지 않은 스트림은 시킹하지 않음
- **iframe 지원** — 임베디드 플레이어에서도 동작

## 설치

1. Chrome / Edge / Firefox용 [Tampermonkey](https://www.tampermonkey.net/) 설치
2. 대시보드 열기 → 새 스크립트 만들기 → [`video-hotkeys.user.js`](video-hotkeys.user.js) 내용 붙여넣기 → 저장
3. Greasy Fork 게시 후에는 raw 파일로 바로 설치 가능 (링크 추후 추가)

## 설정

바꾸고 싶은 값은 모두 스크립트 상단의 설정 블록에 있습니다:

```js
const SEEK_STEP = 5;      // ←/→ 이동 간격(초)
const VOLUME_STEP = 0.05; // ↑/↓ 이동 간격
const BLACKLIST = [ ... ]; // 네이티브 단축키가 있는 사이트(자동으로 양보)
```

## 라이선스

[MIT](LICENSE)
