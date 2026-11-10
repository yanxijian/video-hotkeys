// ==UserScript==
// @name         通用视频键盘控制 (Space / ←→ / ↑↓)
// @name:en      Universal Video Hotkeys (Space / ←→ / ↑↓)
// @namespace    dsh.video.hotkeys
// @version      1.2.2
// @description  给任意网页视频补上键盘控制：空格 播放/暂停，←/→ 快退/快进 5s（Shift 加速 30s），↑/↓ 音量。已实现快捷键的网站（YouTube 等）自动让路。提示显示在视频窗口内底部，支持全屏。
// @description:en  Adds keyboard controls to any web video: Space play/pause, ←/→ seek ±5s (Shift ±30s), ↑/↓ volume. Defers to sites with native hotkeys (YouTube etc.). Toast shows inside the video, works in fullscreen.
// @author       Dana
// @license      MIT
// @homepageURL  https://github.com/yanxijian/video-hotkeys
// @supportURL   https://github.com/yanxijian/video-hotkeys/issues
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ===== 配置 =====
  const SEEK_STEP = 5;      // ←/→ 步长（秒），按住 Shift 为 30
  const VOLUME_STEP = 0.05; // ↑/↓ 步长
  // 这些网站有自己的快捷键，本脚本直接退出，避免双重响应
  // 注：B站曾因原生快捷键不可靠被移出黑名单，由本脚本统一接管
  const BLACKLIST = [
    'youtube.com', 'iqiyi.com', 'youku.com',
    'v.qq.com', 'netflix.com', 'twitch.tv', 'douyin.com', 'tiktok.com',
  ];
  if (BLACKLIST.some(d => location.hostname.endsWith(d))) return;

  // ===== 选定目标视频 =====
  // 规则：优先取「视口内可见、面积最大」的视频；无可见的退回页面上任意一个
  function pickVideo() {
    const vids = document.querySelectorAll('video');
    if (!vids.length) return null;
    let best = null, bestArea = -1;
    for (const v of vids) {
      const r = v.getBoundingClientRect();
      if (r.width < 32 || r.height < 32) continue;
      const style = getComputedStyle(v);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const inViewport = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      const area = r.width * r.height * (inViewport ? 2 : 0.5); // 可见的加权
      if (area > bestArea) { bestArea = area; best = v; }
    }
    return best || vids[vids.length - 1];
  }

  // ===== 正在打字时不要接管 =====
  function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable;
  }

  // ===== 屏幕提示 =====
  // 提示条显示在目标视频窗口的底部居中（而非整个页面底部）；
  // 全屏时挂到全屏元素内，否则会被浏览器顶层（top layer）遮挡而不可见
  let toastEl = null, toastTimer = 0;
  function toast(text, v) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      Object.assign(toastEl.style, {
        position: 'fixed',
        transform: 'translate(-50%, -100%)', // 锚点即提示条底部中点
        padding: '8px 16px', borderRadius: '8px', background: 'rgba(0,0,0,.72)',
        color: '#fff', fontSize: '14px', fontFamily: 'sans-serif',
        zIndex: 2147483647, pointerEvents: 'none', transition: 'opacity .25s',
        opacity: '0', whiteSpace: 'nowrap',
      });
    }
    const host = document.fullscreenElement || document.documentElement;
    if (toastEl.parentElement !== host) host.appendChild(toastEl);

    // 锚点：有视频时取视频窗口内部底部居中；否则退回页面底部居中
    let x = innerWidth / 2, y = innerHeight * 0.88;
    if (v) {
      const r = v.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        x = r.left + r.width / 2;
        y = r.bottom - Math.max(r.height * 0.12, 48); // 底边向上留 12% 高度，至少 48px
      }
    }
    // 防止超出视口
    x = Math.min(innerWidth - 90, Math.max(90, x));
    y = Math.min(innerHeight - 8, Math.max(60, y));
    toastEl.style.left = `${x}px`;
    toastEl.style.top = `${y}px`;

    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 900);
  }

  function fmt(s) {
    s = Math.max(0, Math.round(s));
    const m = Math.floor(s / 60), r = s % 60;
    return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
  }

  function seek(v, delta) {
    // 直播流没有可寻址的 duration，跳过
    if (!isFinite(v.duration) || v.duration <= 0) { toast('直播流不支持快进/快退', v); return; }
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration);
    toast(`${delta > 0 ? '▶▶' : '◀◀'} ${fmt(v.currentTime)}`, v);
  }

  function changeVolume(v, delta) {
    if (v.muted && delta > 0) v.muted = false;
    v.volume = Math.min(1, Math.max(0, Math.round((v.volume + delta) * 100) / 100));
    toast(`音量 ${Math.round(v.volume * 100)}%${v.muted ? '（静音）' : ''}`, v);
  }

  // ===== 按键处理 =====
  // capture 阶段注册，尽量赶在页面自己的监听器之前
  window.addEventListener('keydown', (e) => {
    if (isTyping()) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return; // 不碰系统组合键

    const key = e.key;
    const isKey = key === ' ' || key === 'ArrowLeft' || key === 'ArrowRight'
               || key === 'ArrowUp' || key === 'ArrowDown';
    if (!isKey) return;

    const v = pickVideo();
    if (!v) return; // 页面上没有视频，全部放行给浏览器默认行为

    e.preventDefault();
    e.stopImmediatePropagation();

    switch (key) {
      case ' ': {
        const wasPaused = v.paused; // 先记录状态，play/pause 会同步翻转它
        if (wasPaused) v.play().catch(() => {});
        else v.pause();
        toast(wasPaused ? '▶ 播放' : '⏸ 暂停', v);
        break;
      }
      case 'ArrowLeft': seek(v, e.shiftKey ? -30 : -SEEK_STEP); break;
      case 'ArrowRight': seek(v, e.shiftKey ? 30 : SEEK_STEP); break;
      case 'ArrowUp': changeVolume(v, VOLUME_STEP); break;
      case 'ArrowDown': changeVolume(v, -VOLUME_STEP); break;
    }
  }, true);
})();
