// Behavioral smoke tests for video-hotkeys.user.js.
//
// The userscript must stay a single readable file, so there is nothing to
// import: the tests run the whole script in a stubbed page environment
// (node:vm) and assert observable behavior. Zero dependencies - Node.js
// built-ins only (`node --test`).
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

function makeVideo() {
  const video = {
    paused: true, duration: 100, currentTime: 0, volume: 0.5, muted: false,
    getBoundingClientRect: () => ({ width: 640, height: 360, left: 0, top: 0, right: 640, bottom: 360 }),
    play() { video.paused = false; video.played = true; return Promise.resolve(); },
    pause() { video.paused = true; },
  };
  video.played = false;
  return video;
}

// Loads the userscript with stubbed GM/page globals. With `keyEvent` set, the
// Space key is pressed through the keydown path; with `message` set, a
// postMessage event is dispatched instead. Reports what happened.
async function runScenario({ hostname, lang, store, videos, iframes, keyEvent = true, message = null, fromParent = true }) {
  const created = [];
  const handlers = {};
  const registered = [];
  const parentWin = {}; // sentinel for "the direct parent frame"

  const video = makeVideo();
  const videoList = videos !== undefined ? videos : [video];
  const iframeList = iframes || [];

  globalThis.GM = {
    getValue: async k => store.get(k),
    setValue: async (k, v) => { store.set(k, v); },
    registerMenuCommand: (label, fn) => registered.push({ label, fn }),
  };
  Object.defineProperty(globalThis, 'navigator', { value: { language: lang }, configurable: true });
  Object.defineProperty(globalThis, 'location', { value: { hostname }, configurable: true });
  Object.defineProperty(globalThis, 'window', {
    value: {
      parent: parentWin,
      addEventListener(type, fn) { handlers[type] = fn; },
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'innerWidth', { value: 1920, configurable: true });
  Object.defineProperty(globalThis, 'innerHeight', { value: 1080, configurable: true });
  globalThis.document = {
    fullscreenElement: null,
    activeElement: null,
    documentElement: makeEl('html'),
    createElement: tag => { const el = makeEl(tag); created.push(el); return el; },
    querySelectorAll: sel => (sel === 'video' ? videoList : sel === 'iframe' ? iframeList : []),
  };
  globalThis.getComputedStyle = () => ({ visibility: 'visible', display: 'block' });
  globalThis.confirm = () => false;

  vm.runInThisContext(src, { filename: 'video-hotkeys.user.js' });
  await new Promise(r => setTimeout(r, 0)); // loadConfig is async; let main finish

  const result = { registered, video, created, toastTexts: () => created.map(e => e.textContent).filter(Boolean) };
  result.prevented = false;

  if (keyEvent) {
    handlers.keydown({
      key: ' ', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
      preventDefault() { result.prevented = true; },
      stopImmediatePropagation() {},
    });
  }
  if (message !== null) {
    const source = fromParent ? parentWin : { notParent: true };
    handlers.message({ data: message, source });
  }
  return result;
}

// --- scenarios -----------------------------------------------------------

test('built-in blacklisted site: menu command present, keys untouched', async () => {
  const r = await runScenario({ hostname: 'www.youtube.com', lang: 'zh-CN', store: new Map() });
  assert.strictEqual(r.registered.length, 1, 'menu command must be registered even on blacklisted sites');
  assert.strictEqual(r.video.played, false, 'youtube.com must be blacklisted by default');
});

test('non-blacklisted site: keys taken over, localized toast (zh-CN)', async () => {
  const r = await runScenario({ hostname: 'example.com', lang: 'zh-CN', store: new Map() });
  assert.strictEqual(r.video.played, true, 'keys must work on non-blacklisted sites');
  assert.ok(r.toastTexts().some(t => t.includes('播放')), `zh toast expected, got: ${r.toastTexts()}`);
});

test('disabling a built-in entry re-enables keys on that site (en toast)', async () => {
  const store = new Map([['blacklist-config', JSON.stringify({ disabled: ['youtube.com'] })]]);
  const r = await runScenario({ hostname: 'www.youtube.com', lang: 'en', store });
  assert.strictEqual(r.video.played, true, 'disabled youtube.com must not block keys');
  assert.ok(r.toastTexts().some(t => t.includes('Play')), `en toast expected, got: ${r.toastTexts()}`);
});

test('endsWith false-positive is fixed: notyoutube.com is not blacklisted', async () => {
  const r = await runScenario({ hostname: 'notyoutube.com', lang: 'en', store: new Map() });
  assert.strictEqual(r.video.played, true, 'notyoutube.com must not match youtube.com');
});

test('user-added entry takes effect, including subdomains', async () => {
  const store = new Map([['blacklist-config', JSON.stringify({ added: ['example2.com'] })]]);
  const r = await runScenario({ hostname: 'm.example2.com', lang: 'en', store });
  assert.strictEqual(r.video.played, false, 'user-added domain must block keys (subdomain too)');
});

test('suffix-anchored matching does not over-block', async () => {
  const r = await runScenario({ hostname: 'youtube.com.other.org', lang: 'en', store: new Map() });
  assert.strictEqual(r.video.played, true, 'youtube.com.other.org must not match youtube.com');
});

test('menu command opens the management panel', async () => {
  const r = await runScenario({ hostname: 'example.com', lang: 'zh-CN', store: new Map(), keyEvent: false });
  const created = [];
  const origCreate = globalThis.document.createElement;
  globalThis.document.createElement = tag => { const el = origCreate(tag); created.push(el); return el; };
  r.registered[0].fn(); // openPanel
  assert.ok(created.some(e => e.textContent === '黑名单管理'), 'panel title expected');
});

test('keys are forwarded into a player iframe when the page itself has no video', async () => {
  const iframe = makeEl('iframe');
  iframe.getBoundingClientRect = () => ({ width: 800, height: 450, left: 100, top: 100, right: 900, bottom: 550 });
  const posted = [];
  iframe.contentWindow = { postMessage: (msg, origin) => posted.push({ msg, origin }) };
  const r = await runScenario({ hostname: 'example.com', lang: 'en', store: new Map(), videos: [], iframes: [iframe] });
  assert.deepStrictEqual(posted, [{ msg: { vh: 1, key: ' ', shift: false }, origin: '*' }]);
  assert.strictEqual(r.prevented, true, 'space must be kept from scrolling the page');
});

test('iframe instance handles forwarded keys from the parent frame', async () => {
  const r = await runScenario({ hostname: 'example.com', lang: 'en', store: new Map(), keyEvent: false, message: { vh: 1, key: ' ', shift: false } });
  assert.strictEqual(r.video.played, true, 'forwarded space must play the video');
});

test('forwarded keys are rejected without the vh marker, foreign source, or on blacklist', async () => {
  // no vh marker: host page's own messages must be ignored
  const r1 = await runScenario({ hostname: 'example.com', lang: 'en', store: new Map(), keyEvent: false, message: { key: ' ' } });
  assert.strictEqual(r1.video.played, false, 'unmarked messages must be ignored');
  // source is not the direct parent frame
  const r2 = await runScenario({ hostname: 'example.com', lang: 'en', store: new Map(), keyEvent: false, message: { vh: 1, key: ' ', shift: false }, fromParent: false });
  assert.strictEqual(r2.video.played, false, 'messages from other frames must be ignored');
  // the receiving iframe is itself blacklisted
  const r3 = await runScenario({ hostname: 'www.youtube.com', lang: 'en', store: new Map(), keyEvent: false, message: { vh: 1, key: ' ', shift: false } });
  assert.strictEqual(r3.video.played, false, 'blacklisted frames must not act on forwarded keys');
});
