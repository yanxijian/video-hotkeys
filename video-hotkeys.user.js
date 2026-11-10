// ==UserScript==
// @name         通用视频键盘控制 (Space / ←→ / ↑↓)
// @name:en      Universal Video Hotkeys (Space / ←→ / ↑↓)
// @namespace    dsh.video.hotkeys
// @version      1.3.0
// @description  给任意网页视频补上键盘控制：空格 播放/暂停，←/→ 快退/快进 5s（Shift 加速 30s），↑/↓ 音量。已实现快捷键的网站（YouTube 等）自动让路，黑名单可从脚本菜单管理。提示显示在视频窗口内底部，支持全屏。
// @description:en  Adds keyboard controls to any web video: Space play/pause, ←/→ seek ±5s (Shift ±30s), ↑/↓ volume. Defers to sites with native hotkeys (YouTube etc.); blacklist manageable from the script menu. Toast shows inside the video, works in fullscreen.
// @author       Dana
// @license      MIT
// @homepageURL  https://github.com/yanxijian/video-hotkeys
// @supportURL   https://github.com/yanxijian/video-hotkeys/issues
// @updateURL    https://cdn.jsdelivr.net/gh/yanxijian/video-hotkeys@master/video-hotkeys.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/yanxijian/video-hotkeys@master/video-hotkeys.user.js
// @match        *://*/*
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// ==/UserScript==

(async function () {
  'use strict';

  // ===== 配置 =====
  const SEEK_STEP = 5;      // ←/→ 步长（秒），按住 Shift 为 30
  const VOLUME_STEP = 0.05; // ↑/↓ 步长
  // 内置黑名单：这些网站有自己的快捷键，默认不接管（可在脚本菜单中禁用/恢复）
  // 注：B站曾因原生快捷键不可靠被移出黑名单，由本脚本统一接管
  const BLACKLIST = [
    'youtube.com', 'iqiyi.com', 'youku.com',
    'v.qq.com', 'netflix.com', 'twitch.tv', 'douyin.com', 'tiktok.com',
  ];

  // ===== UI strings =====
  // Toast text follows the browser language; unrecognized languages fall back to English.
  const I18N = {
    en: {
      play: '▶ Play', pause: '⏸ Pause', volume: 'Volume', muted: ' (muted)', live: 'Live streams cannot be seeked',
      menu: 'Manage blacklist', panelTitle: 'Blacklist management', addPlaceholder: 'domain or URL',
      add: 'Add', builtin: 'built-in', custom: 'custom', duplicate: 'Already in the list',
      invalid: 'Cannot parse that domain or URL', reset: 'Reset to defaults',
      resetConfirm: 'Clear all customization and restore the built-in blacklist?', close: 'Close',
    },
    zh: {
      play: '▶ 播放', pause: '⏸ 暂停', volume: '音量', muted: '（静音）', live: '直播流不支持快进/快退',
      menu: '管理黑名单', panelTitle: '黑名单管理', addPlaceholder: '域名或 URL',
      add: '添加', builtin: '内置', custom: '自定义', duplicate: '已在黑名单中',
      invalid: '无法识别的域名或网址', reset: '恢复默认',
      resetConfirm: '清除所有自定义配置，恢复内置黑名单？', close: '关闭',
    },
    ja: {
      play: '▶ 再生', pause: '⏸ 一時停止', volume: '音量', muted: '（ミュート）', live: 'ライブ配信ではシークできません',
      menu: 'ブラックリストを管理', panelTitle: 'ブラックリスト管理', addPlaceholder: 'ドメインまたはURL',
      add: '追加', builtin: '組み込み', custom: 'カスタム', duplicate: 'すでにリストにあります',
      invalid: 'ドメインまたはURLを解析できません', reset: 'デフォルトに戻す',
      resetConfirm: 'すべての設定を消去して組み込みのブラックリストに戻しますか？', close: '閉じる',
    },
    ko: {
      play: '▶ 재생', pause: '⏸ 일시정지', volume: '음량', muted: ' (음소거)', live: '라이브 스트림은 시킹할 수 없습니다',
      menu: '블랙리스트 관리', panelTitle: '블랙리스트 관리', addPlaceholder: '도메인 또는 URL',
      add: '추가', builtin: '기본 제공', custom: '사용자 정의', duplicate: '이미 목록에 있습니다',
      invalid: '도메인 또는 URL을 해석할 수 없습니다', reset: '기본값으로 복원',
      resetConfirm: '모든 설정을 지우고 기본 블랙리스트를 복원할까요?', close: '닫기',
    },
  };
  const T = I18N[(navigator.language || 'en').slice(0, 2).toLowerCase()] || I18N.en;

  // ===== 黑名单：存储与匹配 =====
  // 用户配置只保存相对内置默认的差异（新增 added / 禁用 disabled），脚本更新带来的
  // 新内置站点自动生效。GM 存储按脚本隔离、跨站点共享，页面代码读不到。
  const STORAGE_KEY = 'blacklist-config';
  let panelEl = null;

  async function loadConfig() {
    let parsed = {};
    try { parsed = JSON.parse((await GM.getValue(STORAGE_KEY)) || '{}') || {}; } catch { /* start over on corruption */ }
    return {
      added: Array.isArray(parsed.added) ? parsed.added.filter(v => typeof v === 'string') : [],
      disabled: Array.isArray(parsed.disabled) ? parsed.disabled.filter(v => typeof v === 'string') : [],
    };
  }

  // 接受裸域名或完整 URL，统一提取小写主机名
  function normalizeDomain(input) {
    const value = String(input || '').trim().toLowerCase();
    if (!value) return null;
    try {
      return new URL(value.includes('://') ? value : `https://${value}`).hostname;
    } catch { return null; }
  }

  const cfg = await loadConfig();
  let hotkeysEnabled = false;

  function effectiveBlacklist() {
    return BLACKLIST.concat(cfg.added).filter(d => !cfg.disabled.includes(d));
  }

  function isBlacklisted(hostname) {
    // 单纯 endsWith 会误伤 "notyoutube.com" 这类域名，锚定到点号
    return effectiveBlacklist().some(d => hostname === d || hostname.endsWith(`.${d}`));
  }

  function applyBlacklist() {
    hotkeysEnabled = !isBlacklisted(location.hostname);
  }

  function persist() {
    return GM.setValue(STORAGE_KEY, JSON.stringify({ added: cfg.added, disabled: cfg.disabled }));
  }

  applyBlacklist();
  GM.registerMenuCommand(T.menu, openPanel);

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
    if (!isFinite(v.duration) || v.duration <= 0) { toast(T.live, v); return; }
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration);
    toast(`${delta > 0 ? '▶▶' : '◀◀'} ${fmt(v.currentTime)}`, v);
  }

  function changeVolume(v, delta) {
    if (v.muted && delta > 0) v.muted = false;
    v.volume = Math.min(1, Math.max(0, Math.round((v.volume + delta) * 100) / 100));
    toast(`${T.volume} ${Math.round(v.volume * 100)}%${v.muted ? T.muted : ''}`, v);
  }

  // ===== 按键处理 =====
  // capture 阶段注册，尽量赶在页面自己的监听器之前；
  // 黑名单站点上监听器依然存在（否则菜单里恢复后要刷新才生效），只是不接管按键
  window.addEventListener('keydown', (e) => {
    if (!hotkeysEnabled) return;
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
        toast(wasPaused ? T.play : T.pause, v);
        break;
      }
      case 'ArrowLeft': seek(v, e.shiftKey ? -30 : -SEEK_STEP); break;
      case 'ArrowRight': seek(v, e.shiftKey ? 30 : SEEK_STEP); break;
      case 'ArrowUp': changeVolume(v, VOLUME_STEP); break;
      case 'ArrowDown': changeVolume(v, -VOLUME_STEP); break;
    }
  }, true);

  // ===== 黑名单管理面板 =====
  // 从 userscript 菜单打开（任何站点都可用，包括黑名单站点本身）；再点一次菜单 = 关闭
  function openPanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; return; }

    panelEl = document.createElement('div');
    Object.assign(panelEl.style, {
      position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      width: 'min(420px, 92vw)', maxHeight: '80vh', overflow: 'auto',
      background: '#fff', color: '#222', borderRadius: '10px',
      boxShadow: '0 8px 32px rgba(0,0,0,.35)', padding: '14px 16px',
      fontFamily: 'sans-serif', fontSize: '14px', zIndex: 2147483647,
    });

    // 标题行
    const head = document.createElement('div');
    Object.assign(head.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' });
    const title = document.createElement('strong');
    title.textContent = T.panelTitle;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = T.close;
    Object.assign(closeBtn.style, { border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer', color: '#666' });
    closeBtn.addEventListener('click', () => { panelEl.remove(); panelEl = null; });
    head.append(title, closeBtn);

    // 新增行
    const addRow = document.createElement('div');
    Object.assign(addRow.style, { display: 'flex', gap: '8px', marginBottom: '10px' });
    const input = document.createElement('input');
    input.placeholder = T.addPlaceholder;
    Object.assign(input.style, { flex: '1', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box', font: 'inherit' });
    const addBtn = document.createElement('button');
    addBtn.textContent = T.add;
    Object.assign(addBtn.style, { padding: '6px 14px', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', cursor: 'pointer', font: 'inherit' });
    addRow.append(input, addBtn);

    const listEl = document.createElement('div');

    function rebuildList() {
      listEl.replaceChildren();
      const rows = BLACKLIST.map(d => ({ d, builtin: true })).concat(cfg.added.map(d => ({ d, builtin: false })));
      for (const { d, builtin } of rows) {
        const row = document.createElement('label');
        Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' });
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = !cfg.disabled.includes(d); // 未勾选 = 已禁用
        box.addEventListener('change', () => {
          if (box.checked) cfg.disabled = cfg.disabled.filter(x => x !== d);
          else cfg.disabled.push(d);
          persist();
          applyBlacklist();
        });
        const text = document.createElement('span');
        text.textContent = `${d}（${builtin ? T.builtin : T.custom}）`;
        row.append(box, text);
        if (!builtin) {
          // 内置条目来自脚本代码，删除无意义（下次更新会回来），只给禁用；自定义条目可真删
          const del = document.createElement('button');
          del.textContent = '✕';
          Object.assign(del.style, { marginLeft: 'auto', border: 'none', background: 'none', color: '#c00', cursor: 'pointer', font: 'inherit' });
          del.addEventListener('click', (ev) => {
            ev.preventDefault(); // 阻止外层 label 把点击转给复选框
            cfg.added = cfg.added.filter(x => x !== d);
            persist();
            rebuildList();
            applyBlacklist();
          });
          row.append(del);
        }
        listEl.append(row);
      }
    }

    function addFromInput() {
      const d = normalizeDomain(input.value);
      if (!d) { toast(T.invalid, null); return; }
      if (BLACKLIST.includes(d) || cfg.added.includes(d)) { toast(T.duplicate, null); input.value = ''; return; }
      cfg.disabled = cfg.disabled.filter(x => x !== d); // 重新添加时自动解除禁用
      cfg.added.push(d);
      persist();
      rebuildList();
      applyBlacklist();
      input.value = '';
    }
    addBtn.addEventListener('click', addFromInput);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFromInput(); });

    // 底部：恢复默认
    const foot = document.createElement('div');
    Object.assign(foot.style, { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' });
    const resetBtn = document.createElement('button');
    resetBtn.textContent = T.reset;
    Object.assign(resetBtn.style, { padding: '6px 12px', border: '1px solid #ccc', borderRadius: '6px', background: 'none', color: '#b00', cursor: 'pointer', font: 'inherit' });
    resetBtn.addEventListener('click', () => {
      if (!confirm(T.resetConfirm)) return;
      cfg.added = [];
      cfg.disabled = [];
      persist();
      rebuildList();
      applyBlacklist();
      toast(T.reset, null);
    });
    foot.append(resetBtn);

    panelEl.append(head, addRow, listEl, foot);
    document.documentElement.append(panelEl);
    rebuildList();
    input.focus();
  }
})();
