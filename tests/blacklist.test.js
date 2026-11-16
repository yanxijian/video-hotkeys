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
const fileVersion = (/@version\s+(\S+)/.exec(src) || [])[1];

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
    closest: () => null,
    requestFullscreen: () => Promise.resolve(),
    getBoundingClientRect: () => ({ width: 640, height: 360, left: 0, top: 0, right: 640, bottom: 360 }),
  };
  return el;
}

function makeVideo() {
  const video = {
    paused: true, duration: 100, currentTime: 0, volume: 0.5, muted: false,
    closest: () => null,
    requestFullscreen() { video.fsRequested = (video.fsRequested || 0) + 1; return Promise.resolve(); },
    getBoundingClientRect: () => ({ width: 640, height: 360, left: 0, top: 0, right: 640, bottom: 360 }),
    play() { video.paused = false; video.played = true; return Promise.resolve(); },
    pause() { video.paused = true; },
  };
  video.played = false;
  return video;
}

// Loads the userscript with stubbed GM/page globals. With `keyEvent` set, the
// Space key (or `press`, if given) is dispatched through the keydown path;
// with `message` set, a postMessage event is dispatched instead.
async function runScenario({
  hostname, lang, store, videos, iframes, keyEvent = true, press = null,
  message = null, fromParent = true, fromChild = false, closestTarget = null,
}) {
  const created = [];
  const handlers = {};
  const registered = [];
  const opened = [];
  const parentWin = {}; // sentinel for "the direct parent frame"

  const video = makeVideo();
  if (closestTarget) video.closest = () => closestTarget;
  const videoList = videos !== undefined ? videos : [video];
  const iframeList = iframes || [];

  globalThis.GM = {
    getValue: async k => store.get(k),
    setValue: async (k, v) => { store.set(k, v); },
    registerMenuCommand: (label, fn) => registered.push({ label, fn }),
    xmlHttpRequest: opts => { handlers.xhr = opts; },
    openInTab: (url, opts) => opened.push({ url, opts }),
  };
  globalThis.GM_info = { script: { version: fileVersion } };
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
  const html = makeEl('html');
  globalThis.document = {
    fullscreenElement: null,
    activeElement: null,
    documentElement: html,
    createElement: tag => { const el = makeEl(tag); created.push(el); return el; },
    querySelectorAll: sel => (sel === 'video' ? videoList : sel === 'iframe' ? iframeList : []),
  };
  globalThis.getComputedStyle = () => ({ visibility: 'visible', display: 'block' });
  globalThis.confirm = () => false;

  vm.runInThisContext(src, { filename: 'video-hotkeys.user.js' });
  await new Promise(r => setTimeout(r, 0)); // loadConfig is async; let main finish

  const result = {
    registered, video, created, opened, handlers,
    toastTexts: () => created.map(e => e.textContent).filter(Boolean),
    xhr: () => handlers.xhr,
    prevented: false, exits: 0,
  };
  globalThis.document.exitFullscreen = () => { result.exits++; return Promise.resolve(); };

  if (keyEvent) {
    const def = press || { key: ' ' };
    handlers.keydown({
      key: def.key, shiftKey: !!def.shiftKey, altKey: !!def.altKey,
      ctrlKey: false, altKey2: false, metaKey: false,
      preventDefault() { result.prevented = true; },
      stopImmediatePropagation() {},
    });
  }
  if (message !== null) {
    const source = fromChild ? iframeList[0].contentWindow : (fromParent ? parentWin : { notParent: true });
    handlers.message({ data: message, source });
  }
  return result;
}

// --- scenarios -----------------------------------------------------------

test('built-in blacklisted site: menu commands present, keys untouched', async () => {
  const r = await runScenario({ hostname: 'www.netflix.com', lang: 'zh-CN', store: new Map() });
  assert.strictEqual(r.registered.length, 2, 'blacklist and update menu commands expected');
  assert.strictEqual(r.video.played, false, 'netflix.com must be blacklisted by default');
});

test('non-blacklisted site: keys taken over, localized toast (zh-CN)', async () => {
  const r = await runScenario({ hostname: 'example.com', lang: 'zh-CN', store: new Map() });
  assert.strictEqual(r.video.played, true, 'keys must work on non-blacklisted sites');
  assert.ok(r.toastTexts().some(t => t.includes('播放')), `zh toast expected, got: ${r.toastTexts()}`);
});

test('disabling a built-in entry re-enables keys on that site (en toast)', async () => {
  const store = new Map([['blacklist-config', JSON.stringify({ disabled: ['netflix.com'] })]]);
  const r = await runScenario({ hostname: 'www.netflix.com', lang: 'en', store });
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

test('YouTube is taken over by default (removed from the built-in blacklist)', async () => {
  // Embedded YouTube players get neither native keys (no iframe focus) nor ours
  // if deferred, so youtube.com must not sit in the default blacklist.
  const r = await runScenario({ hostname: 'www.youtube.com', lang: 'en', store: new Map() });
  assert.strictEqual(r.video.played, true, 'keys must work on youtube.com by default');
  // ...and its iframe instance must still accept keys forwarded by a host page
  const r2 = await runScenario({ hostname: 'www.youtube.com', lang: 'en', store: new Map(), keyEvent: false, message: { vh: 1, key: ' ', shift: false, alt: false } });
  assert.strictEqual(r2.video.played, true, 'forwarded keys must reach embedded YouTube players');
});

test('suffix-anchored matching does not over-block', async () => {
  const r = await runScenario({ hostname: 'youtube.com.other.org', lang: 'en', store: new Map() });
  assert.strictEqual(r.video.played, true, 'youtube.com.other.org must not match youtube.com');
});

test('menu "check for updates": opens install page on newer, reports when current', async () => {
  const r = await runScenario({ hostname: 'example.com', lang: 'zh-CN', store: new Map(), keyEvent: false });
  assert.strictEqual(r.registered.length, 2, 'two menu commands expected');
  const updateCmd = r.registered.find(c => c.label === '检查更新');
  assert.ok(updateCmd, 'update menu command expected');

  // remote equals current: report only, no install tab
  updateCmd.fn();
  r.xhr().onload({ status: 200, responseText: `// @version ${fileVersion}` });
  assert.strictEqual(r.opened.length, 0, 'no tab when already up to date');
  assert.ok(r.toastTexts().some(t => t.includes('已是最新')), `up-to-date toast expected, got: ${r.toastTexts()}`);

  // remote newer: open the raw install page
  r.xhr().onload({ status: 200, responseText: '// @version 99.0.0' });
  assert.strictEqual(r.opened.length, 1, 'install tab expected on newer version');
  assert.ok(r.opened[0].url.includes('raw.githubusercontent.com/yanxijian/video-hotkeys'));
  assert.ok(r.toastTexts().some(t => t.includes('发现新版本')), `new-version toast expected, got: ${r.toastTexts()}`);

  // network failure: failure toast, still no tab
  r.xhr().onerror();
  assert.strictEqual(r.opened.length, 1);
  assert.ok(r.toastTexts().some(t => t.includes('失败')), `failure toast expected, got: ${r.toastTexts()}`);
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
  assert.deepStrictEqual(posted, [{ msg: { vh: 1, key: ' ', shift: false, alt: false }, origin: '*' }]);
  assert.strictEqual(r.prevented, true, 'space must be kept from scrolling the page');
});

test('iframe instance handles forwarded keys from the parent frame', async () => {
  const r = await runScenario({ hostname: 'example.com', lang: 'en', store: new Map(), keyEvent: false, message: { vh: 1, key: ' ', shift: false, alt: false } });
  assert.strictEqual(r.video.played, true, 'forwarded space must play the video');
});

test('forwarded keys are rejected without the vh marker, foreign source, or on blacklist', async () => {
  // no vh marker: host page's own messages must be ignored
  const r1 = await runScenario({ hostname: 'example.com', lang: 'en', store: new Map(), keyEvent: false, message: { key: ' ' } });
  assert.strictEqual(r1.video.played, false, 'unmarked messages must be ignored');
  // source is not the direct parent frame
  const r2 = await runScenario({ hostname: 'example.com', lang: 'en', store: new Map(), keyEvent: false, message: { vh: 1, key: ' ', shift: false, alt: false }, fromParent: false });
  assert.strictEqual(r2.video.played, false, 'messages from other frames must be ignored');
  // the receiving iframe is itself blacklisted
  const r3 = await runScenario({ hostname: 'www.netflix.com', lang: 'en', store: new Map(), keyEvent: false, message: { vh: 1, key: ' ', shift: false, alt: false } });
  assert.strictEqual(r3.video.played, false, 'blacklisted frames must not act on forwarded keys');
});

test('Alt+Enter fullscreen-toggles the player iframe from the top frame', async () => {
  const iframe = makeEl('iframe');
  iframe.contentWindow = { postMessage() {} };
  let fsReq = 0;
  iframe.requestFullscreen = () => { fsReq++; return Promise.resolve(); };
  const r = await runScenario({
    hostname: 'example.com', lang: 'en', store: new Map(), videos: [], iframes: [iframe],
    press: { key: 'Enter', altKey: true },
  });
  assert.strictEqual(fsReq, 1, 'iframe element should be fullscreened');
  assert.strictEqual(r.video.played, false);
  assert.strictEqual(r.prevented, true, 'Enter must not reach the page');

  // second press while a fullscreen element exists exits fullscreen instead
  globalThis.document.fullscreenElement = iframe;
  r.handlers.keydown({
    key: 'Enter', shiftKey: false, altKey: true, ctrlKey: false, metaKey: false,
    preventDefault() {}, stopImmediatePropagation() {},
  });
  assert.strictEqual(r.exits, 1, 'second Alt+Enter must exit fullscreen');
});

test('Alt+Enter fullscreens the player container when the video is local', async () => {
  const container = makeEl('div');
  let fsReq = 0;
  container.requestFullscreen = () => { fsReq++; return Promise.resolve(); };
  const r = await runScenario({
    hostname: 'example.com', lang: 'en', store: new Map(),
    press: { key: 'Enter', altKey: true }, closestTarget: container,
  });
  assert.strictEqual(fsReq, 1, 'player container should be fullscreened');
  assert.strictEqual(r.video.fsRequested || 0, 0, 'bare video should not be fullscreened when a container exists');
});

test('fullscreen request from a child iframe (vh:2) fullscreens that iframe element', async () => {
  const iframe = makeEl('iframe');
  let fsReq = 0;
  iframe.requestFullscreen = () => { fsReq++; return Promise.resolve(); };
  const r = await runScenario({
    hostname: 'example.com', lang: 'en', store: new Map(), keyEvent: false, iframes: [iframe],
    message: { vh: 2, key: 'Enter', shift: false }, fromChild: true,
  });
  assert.strictEqual(fsReq, 1, 'child iframe element should be fullscreened');
});
