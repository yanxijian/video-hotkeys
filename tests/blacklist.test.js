// Behavioral smoke tests for video-hotkeys.user.js.
//
// The userscript must stay a single readable file, so there is nothing to
// import: the tests run the whole script in a stubbed page environment
// (node:vm) and assert observable behavior. Zero dependencies - Node.js
// built-ins only (`node --test tests/`).
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'video-hotkeys.user.js'), 'utf8');

// --- minimal page stubs -------------------------------------------------

function makeEl(tag) {
  const el = {
    tag, style: {}, children: [], parentElement: null,
    textContent: '', placeholder: '', type: '', checked: false, title: '',
    append(...els) { el.children.push(...els); },
    appendChild(child) { child.parentElement = el; el.children.push(child); return child; },
    replaceChildren() { el.children.length = 0; },
    addEventListener() {}, removeEventListener() {},
    remove() {}, focus() {},
    getBoundingClientRect: () => ({ width: 640, height: 360, left: 0, top: 0, right: 640, bottom: 360 }),
  };
  return el;
}

// Loads the userscript with stubbed GM/page globals, presses Space once and
// reports what happened: was a video played, what did the toast say.
async function runScenario({ hostname, lang, store }) {
  const created = [];
  let keydownHandler = null;
  const registered = [];

  const video = {
    paused: true, duration: 100, currentTime: 0, volume: 0.5, muted: false,
    getBoundingClientRect: () => ({ width: 640, height: 360, left: 0, top: 0, right: 640, bottom: 360 }),
    play() { video.paused = false; video.played = true; return Promise.resolve(); },
    pause() { video.paused = true; },
  };
  video.played = false;

  globalThis.GM = {
    getValue: async k => store.get(k),
    setValue: async (k, v) => { store.set(k, v); },
    registerMenuCommand: (label, fn) => registered.push({ label, fn }),
  };
  Object.defineProperty(globalThis, 'navigator', { value: { language: lang }, configurable: true });
  Object.defineProperty(globalThis, 'location', { value: { hostname }, configurable: true });
  Object.defineProperty(globalThis, 'window', {
    value: { addEventListener(type, fn) { if (type === 'keydown') keydownHandler = fn; } },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'innerWidth', { value: 1920, configurable: true });
  Object.defineProperty(globalThis, 'innerHeight', { value: 1080, configurable: true });
  globalThis.document = {
    fullscreenElement: null,
    activeElement: null,
    documentElement: makeEl('html'),
    createElement: tag => { const el = makeEl(tag); created.push(el); return el; },
    querySelectorAll: () => [video],
  };
  globalThis.getComputedStyle = () => ({ visibility: 'visible', display: 'block' });
  globalThis.confirm = () => false;

  vm.runInThisContext(src, { filename: 'video-hotkeys.user.js' });
  await new Promise(r => setTimeout(r, 0)); // loadConfig is async; let main finish

  keydownHandler({
    key: ' ', ctrlKey: false, altKey: false, metaKey: false,
    preventDefault() {}, stopImmediatePropagation() {},
  });

  const toastTexts = created.map(e => e.textContent).filter(t => t);
  return { registered, played: video.played, toastTexts };
}

// --- scenarios -----------------------------------------------------------

test('built-in blacklisted site: menu command present, keys untouched', async () => {
  const r = await runScenario({ hostname: 'www.youtube.com', lang: 'zh-CN', store: new Map() });
  assert.strictEqual(r.registered.length, 1, 'menu command must be registered even on blacklisted sites');
  assert.strictEqual(r.played, false, 'youtube.com must be blacklisted by default');
});

test('non-blacklisted site: keys taken over, localized toast (zh-CN)', async () => {
  const r = await runScenario({ hostname: 'example.com', lang: 'zh-CN', store: new Map() });
  assert.strictEqual(r.played, true, 'keys must work on non-blacklisted sites');
  assert.ok(r.toastTexts.some(t => t.includes('播放')), `zh toast expected, got: ${r.toastTexts}`);
});

test('disabling a built-in entry re-enables keys on that site (en toast)', async () => {
  const store = new Map([['blacklist-config', JSON.stringify({ disabled: ['youtube.com'] })]]);
  const r = await runScenario({ hostname: 'www.youtube.com', lang: 'en', store });
  assert.strictEqual(r.played, true, 'disabled youtube.com must not block keys');
  assert.ok(r.toastTexts.some(t => t.includes('Play')), `en toast expected, got: ${r.toastTexts}`);
});

test('endsWith false-positive is fixed: notyoutube.com is not blacklisted', async () => {
  const r = await runScenario({ hostname: 'notyoutube.com', lang: 'en', store: new Map() });
  assert.strictEqual(r.played, true, 'notyoutube.com must not match youtube.com');
});

test('user-added entry takes effect, including subdomains', async () => {
  const store = new Map([['blacklist-config', JSON.stringify({ added: ['example2.com'] })]]);
  const r = await runScenario({ hostname: 'm.example2.com', lang: 'en', store });
  assert.strictEqual(r.played, false, 'user-added domain must block keys (subdomain too)');
});

test('suffix-anchored matching does not over-block', async () => {
  const r = await runScenario({ hostname: 'youtube.com.other.org', lang: 'en', store: new Map() });
  assert.strictEqual(r.played, true, 'youtube.com.other.org must not match youtube.com');
});

test('menu command opens the management panel', async () => {
  const created = [];
  const r = await runScenario({ hostname: 'example.com', lang: 'zh-CN', store: new Map() });
  const origCreate = globalThis.document.createElement;
  globalThis.document.createElement = tag => { const el = origCreate(tag); created.push(el); return el; };
  r.registered[0].fn(); // openPanel
  assert.ok(created.some(e => e.textContent === '黑名单管理'), 'panel title expected');
});
