// Boots the whole app script in a fake DOM and prints what happened as JSON.
// Run by boot.test.js in a child process with a timeout, so a hang fails the test
// instead of freezing the runner.   argv[2] = JSON options:
//   { seed?: string (raw autosave), w?: number, h?: number, blocked?: bool, skipCheckDoc?: bool, script?: string, liveServer?: bool, desktop?: bool | { store?, files?, local? },
//     blank?: bool, recover?: true | false | "ask", performance?: bool, idb?: { store?, full? } }
// Since R4 the program starts with a blank document and offers to recover an autosave. So that the many tests written
// against the old start still say what they mean, this harness by default starts from the starter pattern (as the
// program used to) and answers "Recover" to the question; blank: true starts as the program really does, recover: false
// answers "Discard", recover: "ask" leaves the question open (app.modalPick("recover") answers it).
// Every question asked comes back in `modals`; app.modalAnswer = (title, keys) => key answers later ones ("discard" by default).
// desktop = boot as the desktop app does, with a stand-in for window.desktop (desktop/preload.js): its autosave store,
// its files by path and every call made to it come back as `desk`; a script reaches it as app.desk and sets
// app.desk.dialog to the path the next Open / Save As dialog "picks" (null = cancelled).
// liveServer = boot the page as VS Code Live Server serves it (its reload script injected before the first </body>).
// freshUnbuilt = Show Tools That Are Not Built Yet as a fresh profile has it (off); without it the harness starts with it on (Round FIX-4b).
// oldSizeRun = S.grading is the size run of before r33 when the script starts (harness.js oldSizeRun()).
// script = a function body run after boot with (S, app, toasts); its return value is printed as `result` (a promise is waited for).
// streams = give the page the platform's CompressionStream / DecompressionStream, as a browser has them: a saved file is then
// packed, and saving and opening finish a moment later. Without it (the default) entries are stored and both finish at once.
// three = the 3D window is up: three.js and its loaders (three-env.js) with a renderer that draws nothing.
// A saved version 12 file is bytes: app.fileDoc(bytes) is the document in it (with its history), app.fileParts(bytes) its
// parts as [name, size]; both need the entries stored (no streams). In `desk.files` a file of bytes is printed as { bytes: n }.
// app.menuClick(sx, sy, "Item name", tool?) right-clicks the canvas there and clicks that menu item.
// app.promptAnswer = "text" answers the next typed-text dialogs (null = cancelled); app.promptNums = { k: value } their number fields.
"use strict";
const vm = require("vm");
const { appSource, liveServerInject } = require("./harness");

// (options too long for a command line come in a file: argv[2] = "@" + its path)
const opt = JSON.parse((process.argv[2] || "").startsWith("@") ? require("fs").readFileSync(process.argv[2].slice(1), "utf8") : process.argv[2] || "{}");
const els = {}, store = new Map(), toasts = [], warnings = [], errors = [], timers = [], listeners = {}, modals = [];
if (opt.seed !== undefined) store.set("pdraft:doc", opt.seed);
if (opt.prefs !== undefined) store.set("pdraft:prefs", opt.prefs);       // saved preferences (units, snapping, colours)
if (opt.view !== undefined) store.set("pdraft:view", opt.view);          // saved view settings from an earlier session
if (opt.uiSaved !== undefined) store.set("pdraft:ui", opt.uiSaved);
// (Round FIX-4b / A) Show Tools That Are Not Built Yet starts off since the beta.8 gate (G1); the tests written before it were written
// with it on, so the harness starts with it on, as a stored choice, unless the script says otherwise (freshUnbuilt: true boots the
// program's own default, as a fresh profile has it)
else if (!opt.freshUnbuilt && !(opt.storage && "pdraft:ui" in opt.storage)) store.set("pdraft:ui", JSON.stringify({ unbuilt: true }));
for (const k of Object.keys(opt.storage || {})) store.set(k, opt.storage[k]);      // any other saved keys, as text       // a saved window layout / show-unbuilt choice

function el(id) {
  return els[id] || (els[id] = {
    id, style: {}, dataset: {}, children: [], innerHTML: "", textContent: "", value: "", className: "", title: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(type, f) { (listeners[id] = listeners[id] || {})[type] = f; }, removeEventListener() {}, appendChild(c) { this.children.push(c); return c; }, insertBefore(c) { this.children.unshift(c); return c; }, remove() {},
    querySelector() { return el("q:" + id); }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: opt.w ?? 1000, height: opt.h ?? 800 }; },
    setPointerCapture() {}, contains() { return false; }, closest() { return null; }, focus() {}, select() {}, click() {},
    offsetWidth: 200, offsetHeight: 300,
    getContext() {
      return new Proxy({}, { get: (t, k) => k === "measureText" ? () => ({ width: 20 }) : (k in t ? t[k] : () => {}),
        set: (t, k, v) => { t[k] = v; return true; } });
    },
  });
}
// the right-click menu as a page has it: emptied when its HTML is set to nothing (menuRows() fills it so, again and again)
{ const m = el("menu"); let html = ""; Object.defineProperty(m, "innerHTML", { get: () => html, set: (v) => { html = String(v); if (!html) m.children.length = 0; } }); }
// the stand-in for the desktop shell. Its promises settle at once, so a script can read the outcome on the next line.
const now = (v) => ({ then(f) { return now(f(v)); }, catch() { return this; } });
const failed = (msg) => ({ then() { return this; }, catch(f) { f(new Error("Error invoking remote method 'x': Error: " + msg)); return now(); } });
const dk = opt.desktop === true ? {} : opt.desktop;
const desk = dk && { store: new Map(Object.entries(dk.store || {})), files: new Map(Object.entries(dk.files || {})), calls: [], dialog: null, recent: [], onFile: null };
const base = (p) => p.replace(/^.*[\\/]/, "");
// a file as the shell hands it to the page: text, or the bytes of a version 12 file (desktop/main.js readFile())
const handed = (p) => { const v = desk.files.get(p); return typeof v === "string" ? { path: p, name: base(p), text: v } : { path: p, name: base(p), data: v }; };
// as the shell does (desktop/main.js keepV11()): the text of a version 11 .pdraft is kept beside it before bytes go over it
const keep = (p, data) => { const was = desk.files.get(p), copy = p.replace(/\.pdraft$/i, "") + ".v11.pdraft"; if (!/\.pdraft$/i.test(p) || typeof data === "string" || typeof was !== "string" || desk.files.has(copy)) return null; desk.files.set(copy, was); return base(copy); };
const desktop = desk && {
  store: { getItem: (k) => (desk.store.has(k) ? desk.store.get(k) : null), setItem: (k, v) => { desk.store.set(k, String(v)); },
    removeItem: (k) => { desk.store.delete(k); }, where: (k) => "C:\\data\\" +k.replace("pdraft:doc", "autosave") + ".json" },
  open: () => { desk.calls.push(["open"]); const p = desk.dialog; return now(p ? handed(p) : null); },
  openRecent: (p) => { desk.calls.push(["openRecent", p]); return desk.files.has(p) ? now(handed(p)) : failed("ENOENT: no such file"); },
  recent: () => now(desk.recent),
  save: (p, text) => { desk.calls.push(["save", p]); if (dk.readonly) return failed("EPERM: operation not permitted"); const kept = keep(p, text); desk.files.set(p, text); return now({ path: p, name: base(p), kept }); },
  saveAs: (sug, text) => { desk.calls.push(["saveAs", sug]); const p = desk.dialog; if (!p) return now(null); const kept = keep(p, text); desk.files.set(p, text); return now({ path: p, name: base(p), kept }); },
  onOpenFile: (f) => { desk.onFile = f; },
  print: (html, pw, ph) => { desk.calls.push(["print", pw, ph, html.length > 0]); return now(""); },
  // (Round desk-1) exports where the dialog "picks" (desk.dialog), the PDF, the bug report, the clipboard, the feedback link
  exportFile: (sug, data) => { desk.calls.push(["exportFile", sug]); const p = desk.dialog; if (!p) return now(null); desk.files.set(p, data); return now({ path: p, name: base(p) }); },
  pdf: (sug, html) => { desk.calls.push(["pdf", sug, /<svg /.test(html)]); const p = desk.dialog; if (!p) return now(null); desk.files.set(p, "%PDF of " + html.length); return now({ path: p, name: base(p) }); },
  bugReport: (sug, text, doc) => { desk.calls.push(["bugReport", sug, !!doc]); const p = desk.dialog; if (!p) return now(null); desk.files.set(p, text); const c = doc ? p.replace(/[.]txt$/, "") + " (document).pdraft" : null; if (c) desk.files.set(c, doc); return now({ path: p, name: base(p), copy: c && base(c) }); },
  copyText: (text) => { desk.calls.push(["copyText"]); desk.clip = text; return now(true); },
  // (Round BETA8-1 / K) the library's Show in Explorer: true for a file the stand-in holds
  showFile: (p) => { desk.calls.push(["showFile", p]); return now(desk.files.has(p)); },
  openFeedback: () => { desk.calls.push(["openFeedback"]); return now("mailto:x"); },
  // what the shell says of itself; only with desktop: { info: … }, so the welcome box (which needs it) shows only in the tests that ask for it
  // (Round r24) the update check, only with desktop: { updates: { check: <what check() answers> } }: the download reports 42 %
  // once and finishes; the page's calls are recorded
  ...(dk && dk.updates ? { updates: { state: () => now({}), check: () => { desk.calls.push(["updates.check"]); return now(dk.updates.check); },
    download: () => { desk.calls.push(["updates.download"]); if (desk.onProgress) desk.onProgress({ percent: 42 }); return dk.updates.downloadFails ? failed(dk.updates.downloadFails) : now({ downloaded: true }); },
    install: () => { desk.calls.push(["updates.install"]); return now(true); }, page: () => { desk.calls.push(["updates.page"]); return now("https://example.invalid/releases"); },
    onProgress: (f) => { desk.onProgress = f; } } } : {}),
  ...(dk && dk.info ? { info: () => now(dk.info === true ? { version: "0.0.0-test", build: "2026-01-01", commit: "abc1234", packaged: true, os: "Windows 11 (10.0.26200)", arch: "x64", electron: "1", chrome: "2" } : dk.info) } : {}),
};
if (dk && dk.local) for (const [k, v] of Object.entries(dk.local)) store.set(k, v);
const blocked = () => { throw new Error("SecurityError: storage blocked"); };
const localStorage = opt.blocked ? { getItem: blocked, setItem: blocked, removeItem: blocked } : {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); },
};
let src = appSource(opt.liveServer ? liveServerInject() : undefined)
  .replace(/\}\)\(\);\s*\}\)\(\);\s*$/, "})();\nglobalThis.__S = S; globalThis.__app = { ev: (code) => eval(code), modalPick: (k) => modalPick(k), histSteps, histGo, setTimeline, push, libOf, hint: (t) => histNote(t), setMode, layoutCmd, layoutStats, layoutOf, layoutPieces, layoutJob, layoutTurn, layoutSheet, layS: (q) => lS(q), showMenu, menu, toS, undo, redo, setTool, segPt, segLen, checkDoc, docJSON, dartGeom, rotateNumeric, seamInfo, commit, pick, GROUPS, setLayout, setUnbuilt, KEY_CONFLICTS, iconSVG, toolNote, view3d, HINT, sewClick, sewKey, sewGuides, sewLengthNumeric, editSewDown, editSewMove, editSewMenu, seamHit, setSewCheck, reverseSewing, unlinkSewing, mkPiece, mkShape, hideMenu, walkClick, walkMove, measureClick, measureInfo, grabGuide, addPointNumeric, notchPosNumeric, turnNumeric, walkNotch, traceToInternal, zoomBy, draftShape, KEYMAP, TOOLS, shapeNumeric, lenTo, toW, showViewMenu, setView, gradeNudge, gradedPiece, sizeMenu, gSize, printJob, dxfOutNumeric, dxfInNumeric, saveDoc, openDoc, openText, importDXF, runPrint, showRecentMenu, selectorItems, VIEW3D, OB_TABS, obSelect, obAdd, obCopy, obAssign, MENUS, shortcutsDialog, listMenu, setRender, libAdd, sewReadout, addStitch, stitchLine, stitchAt, grainOf, grainAngle, addImage, placeGraphic, addGraphicDialog, wheelParts, gfxCorners, selGfx, frameHit, boxHandles, handleScreen, turnHandle, bboxOf, tpsSel, tpsBox, freeSel, toHandles, toCurvePoints, insertCp, deleteCp, addPoint, segCurve, isSpline, hit, setPrefs, settingsDialog, noteDialog, askText, del, walkLive, cutLine, segNear, dragLines, dragOnLines, toolCursor, setCursor, cv, seamsOn, seamLanes, ghostDrag, HINT, addChild, normFolds, normPins, pieceFolds, piecePins, unfoldPieces, removePins, zipList, G3, SIM, simToggle, simStart, simStop, simSeams, fabricPhys, show3dChanged, garmentSync, garmentChanged, normCloth, normP3, setTool3, TOOL3, CMD3, setArrPoints, setDensity, resetArrangement2, pieceMesh3, defaultP3, avatarMenu, normAvatar, boneRole, cam3d, setAvatar, avatarStatus, note3d, draw, editSewDown, deleteSewing, sewLayers, loadDoc, keyTable, keyFind, keyOf, keyCombo, viewCtl, viewDrag, viewHelp, normViewCtl, setDownload: (f) => { globalThis.__dl = f; } };\n})();")
  .replace("function toast(m, ms) {", "function toast(m, ms) { globalThis.__toast(m);");
// a script can answer numeric dialogs: app.answer = (title, fields, opts) => ({ k: value, ... }); null = cancelled (Esc)
src = src.replace("function numDialog(title, fields, at, onOk, opts) {",
  "function numDialog(title, fields, at, onOk, opts) { if (globalThis.__app && globalThis.__app.answer) { const __a = globalThis.__app.answer(title, fields, opts || {}); if (__a === null) { if (opts && opts.onCancel) opts.onCancel(); return; } return onOk(__a); }");
// a script can catch a download instead of it going to the (fake) browser: app.setDownload((name, text) => …)
src = src.replace("function dl(n, t, m, then) {", "function dl(n, t, m, then) { if (globalThis.__dl) { const r = globalThis.__dl(n, t, m); if (typeof then === \"function\") then(n); return r; }");
src = src.replace("function askText(title, val, onOk, opts) {",
  "function askText(title, val, onOk, opts) { if (globalThis.__app && globalThis.__app.promptAnswer !== undefined) { const a = globalThis.__app.promptAnswer; if (a !== null && String(a).trim()) onOk(String(a).trim(), Object.fromEntries(((opts || {}).fields || []).map(f => [f.k, (globalThis.__app.promptNums || {})[f.k] ?? f.val]))); return; }");
src = src.replace("function bootPieces() { return []; }", "function bootPieces() { return globalThis.__blank ? [] : [starter()]; }");
src = src.replace("function askModal(title, text, buttons, opts) {", "function askModal(title, text, buttons, opts) { { const k = globalThis.__modal(title, buttons.map(b => b.k), text), b = buttons.find(x => x.k === k); if (b) return b.f(); }");
if (opt.skipCheckDoc) src = src.replace("function checkDoc(pieces, seams) {", "function checkDoc(pieces, seams) { return;");
const winKeys = [], winOn = {};
const ctx = {
  TOOL_REGISTRY: require("../drafter-tools.js"), SIM3D: require("../drafter-sim.js"), ZPRJ: require("../zprj-import.js"), PATTERN_BLOCKS: require("../blocks/blocks.js"), PATTERN_EXAMPLES: require("../examples/examples.js"), PDRAFT_CONFIG: require("../config.js"), Float32Array, Float64Array, Int32Array, Uint32Array, Uint16Array, Uint8Array, Int8Array, ArrayBuffer, DataView, TextEncoder, TextDecoder, Infinity, NaN, isNaN, Symbol, Promise, WeakMap, Math, JSON, Map, Set, Array, Object, Number, String, Error, Proxy, Date, isFinite, parseFloat, encodeURIComponent,
  console: { log() {}, warn: (m) => warnings.push(String(m)), error: (m) => errors.push(String(m)) },
  document: { getElementById: el, createElement: () => el("new" + Math.random()), querySelectorAll: () => [], querySelector: () => null, body: el("body") },
  window: { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 900, addEventListener(type, f) { if (type === "keydown") winKeys.push(f); else (winOn[type] = winOn[type] || []).push(f); }, removeEventListener() {}, ...(desktop ? { desktop } : {}) },
  localStorage, ResizeObserver: class { observe() {} }, URL: {}, Blob: class {}, prompt: () => (ctx.__app && ctx.__app.promptAnswer !== undefined ? ctx.__app.promptAnswer : null),
  setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  __toast: (m) => toasts.push(m),
  __blank: !!opt.blank,
  __modal: (title, keys, text) => {
    modals.push({ title, keys, text });
    if (ctx.__app && ctx.__app.modalAnswer) return ctx.__app.modalAnswer(title, keys, text);
    if (title === "Recover unsaved work?") return opt.recover === "ask" ? undefined : opt.recover === false ? "discard" : "recover";
    // (Round H1b / 3) going back and editing: the old future kept as a branch, as before the box; a new project's history on
    if (title === "Keep the Old Future?") return "keep";
    if (title === "Keep a History?") return "on";
    return "discard";
  },
};
ctx.globalThis = ctx;
if (opt.streams) { ctx.CompressionStream = CompressionStream; ctx.DecompressionStream = DecompressionStream; }
// (Round perf-1) performance = the page has performance.now(), as a browser has it: with the flag "perf" the marks are on
if (opt.performance) ctx.performance = performance;
// (Round perf-2) idb = the page has IndexedDB, as a browser has it (where the autosave is kept): a stand-in that answers a moment
// later (promises), { store?: { key: text } what it holds at the start, full?: true every write fails as with a full storage };
// what it holds at the end comes back as `idb`
const idbData = opt.idb ? new Map(Object.entries(opt.idb.store || {})) : null;
if (opt.idb) ctx.indexedDB = {
  open() {
    const r = {};
    Promise.resolve().then(() => {
      r.result = { transaction() {
        const tx = {}, later = (f) => Promise.resolve().then(f), done = () => tx.oncomplete && tx.oncomplete();
        const st = {
          put(v, k) { const q = {}; later(() => { if (opt.idb.full) { const e = new Error("The quota has been exceeded."); e.name = "QuotaExceededError"; tx.error = e; return tx.onabort && tx.onabort(); } idbData.set(k, v); done(); }); return q; },
          get(k) { const q = {}; later(() => { q.result = idbData.has(k) ? idbData.get(k) : undefined; done(); }); return q; },
          delete(k) { const q = {}; later(() => { idbData.delete(k); done(); }); return q; },
        };
        tx.objectStore = () => st;
        return tx;
      } };
      if (r.onsuccess) r.onsuccess();
    });
    return r;
  },
};
if (opt.three) {
  const t = require("./three-env").three(), TH = Object.create(t.THREE);
  // (Round r19 follow-up) what view3d.shot() asks of a renderer, and what each render saw: app.renders, a list of
  // { w, h, lights (the visible lights' types and intensities), shadows (the shadow map on), grid (the grid shown), casters }
  const renders = [];
  TH.WebGLRenderer = class { constructor() { ctx.__gl = this; this.domElement = el("gl"); this.w = 300; this.h = 150; this.shadowMap = { enabled: false, type: 1 }; this.capabilities = { maxTextureSize: 8192 }; }
    setPixelRatio() {} getPixelRatio() { return 1; } setClearColor() {} getSize(v) { v.x = this.w; v.y = this.h; return v; } setSize(w, h) { this.w = w; this.h = h; }
    render(scene) { if (!scene || !scene.traverse) return; const L = [], cast = []; let grid = false; scene.traverse((o) => { if (!o.visible) return; if (o.isLight) { L.push(o.type + ":" + o.intensity); if (o.castShadow) cast.push(o.type); } if (/^grid:/.test(o.name || "")) grid = true; });
      if (renders.length < 200) renders.push({ w: this.w, h: this.h, lights: L.sort(), shadows: !!this.shadowMap.enabled, grid, casters: cast }); } };
  ctx.__renders = renders;
  ctx.THREE = TH; ctx.THREE_LOADERS = t.THREE_LOADERS;
}
try { vm.runInNewContext(src, ctx, { timeout: 5000 }); }
catch (e) { errors.push(e.message); }
// the old start: the starter pattern, autosaved as soon as the program is up
if (!opt.blank && ctx.__app) try { ctx.__app.ev("if (!S.dirty && S.pieces.length && !recoverPending) store()"); } catch (e) { errors.push("start: " + e.message); }
// let any async part of boot settle before reading state (older builds booted in an async function)
setImmediate(() => {
  for (let round = 0; round < 3 && timers.length; round++)             // run debounced autosave etc.
    for (const f of timers.splice(0)) try { f(); } catch (e) { errors.push("timer: " + e.message); }
  const S = ctx.__S;
  let result;
  if (opt.script && ctx.__app) {
    const app = ctx.__app; app.el = el; app.storage = store; app.desk = desk; app.title = () => ctx.document.title;
    const unzip = (bytes) => { let got = null; app.ev("zipUnpack")(bytes, (e, parts) => { if (e) throw e; got = parts; }); if (!got) throw new Error("the file is packed: read it with streams off"); return got; };
    // waits (a promise) until cond() holds: for what finishes a moment later, with streams or a file being parsed
    // (Round r34) the timers the page set since boot, run now (setTimeout only queues them in the fake page)
    app.runTimers = () => { for (let round = 0; round < 3 && timers.length; round++) for (const f of timers.splice(0)) try { f(); } catch (e) { errors.push("timer: " + e.message); } };
    app.wait = (cond, what) => new Promise((res, rej) => { const t0 = Date.now(), tick = () => { let ok = false; try { ok = cond(); } catch (e) { return rej(e); } if (ok) res(ok); else if (Date.now() - t0 > 20000) rej(new Error("timed out waiting for " + (what || "it"))); else setImmediate(tick); }; tick(); });
    // a file's bytes (an ArrayBuffer), by its path from this folder
    app.renders = ctx.__renders || []; app.gl = () => ctx.__gl;
    app.read = (p) => { const b = require("fs").readFileSync(require("path").resolve(__dirname, p)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
    app.fileDoc = (bytes) => app.ev("pdraftDoc")(unzip(bytes));
    app.fileParts = (bytes) => [...unzip(bytes)].map(([n, d]) => [n, d.length]);
    // tool (optional): the tool in hand for this right-click, e.g. "trace" to reach a baseline
    // app.fire("pointerdown", { x, y, ...event fields }) sends an event to the canvas's own handler (x, y = canvas pixels);
    // app.key("Enter", { ctrlKey }) a key to the window's. app.click(x, y) is a press and a release in one place.
    app.fire = (type, e) => { const f = (listeners.c || {})[type]; if (!f) throw new Error("no canvas handler for " + type);
      f({ clientX: e.x, clientY: e.y, button: 0, pointerId: 1, preventDefault() {}, stopPropagation() {}, ...e }); };
    // the same for the Print Layout canvas
    app.fireLay = (type, e) => { const f = (listeners.lc || {})[type]; if (!f) throw new Error("no layout handler for " + type);
      f({ clientX: e.x, clientY: e.y, button: 0, pointerId: 1, deltaY: 0, preventDefault() {}, stopPropagation() {}, ...e }); };
    app.click = (x, y, e) => { app.fire("pointermove", { x, y, ...e }); app.fire("pointerdown", { x, y, ...e }); app.fire("pointerup", { x, y, ...e }); };
    app.drag = (x0, y0, x1, y1, e) => { app.fire("pointermove", { x: x0, y: y0 }); app.fire("pointerdown", { x: x0, y: y0 }); app.fire("pointermove", { x: (x0+x1)/2, y: (y0+y1)/2, ...e }); app.fire("pointermove", { x: x1, y: y1, ...e }); };
    app.key = (key, e) => { for (const f of winKeys) f({ key, code: key === " " ? "Space" : key, target: { tagName: "BODY" }, preventDefault() {}, stopPropagation() {}, ...e }); };
    // the window's own events other than keys ("load", "beforeunload" …): how many handlers ran
    app.winFire = (type, e) => { for (const f of winOn[type] || []) f(e || {}); return (winOn[type] || []).length; };
    // an event to any element's own handler, by the element's id (the toolbars, the splitter)
    app.fireOn = (id, type, e) => { const f = (listeners[id] || {})[type]; if (!f) throw new Error("no " + type + " handler on #" + id); f({ preventDefault() {}, stopPropagation() {}, ...e }); };
    app.menuClick = (sx, sy, name, tool) => {
      const was = S.tool;
      if (tool) S.tool = tool;
      app.menu.children.length = 0;
      try { app.showMenu({ clientX: sx, clientY: sy }); } finally { S.tool = was; }
      // "Row ▸ Sub ▸ …": a row with a submenu, then a row of that submenu, as deep as it goes
      const [first, ...more] = name.split(" \u25b8 ");
      const it = app.menu.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes("<span>" + first + "</span>"));
      if (!it) throw new Error("no menu item '" + first + "' at " + sx + "," + sy);
      it.onclick({ stopPropagation() {} });
      let above = first;
      for (const next of more) {
        const subs = app.ev("menuSubs"), sub = subs[subs.length - 1], row = sub && (sub.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes("<span>" + next + "</span>")) || sub.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes(next)));
        if (!row) throw new Error("no submenu item '" + next + "' under '" + above + "'");
        row.onclick({ stopPropagation() {} });
        above = next;
      }
    };
    // (Round r33 / 4) oldSizeRun = the document graded on the size run every document had before r33 (XS–XL, M the base; harness.js)
    if (opt.oldSizeRun) { S.grading = require("./harness").oldSizeRun(); app.ev("ui")(); }
    try { result = new Function("S", "app", "toasts", opt.script)(S, app, toasts); }
    catch (e) { errors.push("script: " + e.message); }
  }
  Promise.resolve(result).catch((e) => { errors.push("script: " + ((e && e.message) || e)); }).then((result) => console.log(JSON.stringify({
    errors, warnings, toasts, result, modals,
    dirty: S && !!S.dirty, undo: S && S.undo.length,
    view: S && S.view, show: S && S.show,
    names: S && S.pieces.map(p => p.name),
    saveText: els["s-save"] && els["s-save"].textContent,
    panelBuilt: !!(els.props && els.props.innerHTML.length),
    storage: Object.fromEntries(store),
    ...(idbData ? { idb: Object.fromEntries(idbData) } : {}),
    desk: desk ? { store: Object.fromEntries(desk.store), files: Object.fromEntries([...desk.files].map(([k, v]) => [k, typeof v === "string" ? v : { bytes: v.length }])), calls: desk.calls, clip: desk.clip } : undefined,
    title: ctx.document.title,
  })));
});
