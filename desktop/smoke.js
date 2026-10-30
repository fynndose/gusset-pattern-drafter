// End-to-end check of the desktop shell: starts the real app (main.js, the real page)
// against a throwaway data folder, with the file dialogs and the print dialog stood in
// for, and drives it with real key events.   npm run smoke
"use strict";
const { app, dialog, Menu, BrowserWindow } = require("electron");
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAC = process.platform === "darwin";
// (Round desk-2) PDRAFT_SMOKE_APP: a built app's resources folder, whose files are checked instead of the source (see the end)
const BUILT = process.env.PDRAFT_SMOKE_APP ? path.resolve(process.env.PDRAFT_SMOKE_APP) : null;
const PAGE_DIR = BUILT ? path.join(BUILT, "drafter") : path.join(__dirname, "..", "drafter");
// a fresh data folder in the system's temp folder, never the user's own (desktop/test-data.js); main.js takes it from
// PDRAFT_USER_DATA, as every check that starts the app gives it
// (npm run smoke:desktop makes the folder and deletes it once the app has exited, PDRAFT_SMOKE_DIR: the app's helper
// processes hold files in it until then; run by itself, this check makes its own and tries to delete it at the end)
const TD = require("./test-data.js"), given = process.env.PDRAFT_SMOKE_DIR;
const fresh = given && TD.inTemp(given) ? { dir: given, data: path.join(given, "data") } : TD.fresh("smoke");
fs.mkdirSync(fresh.data, { recursive: true });
const tmp = fresh.dir, data = fresh.data;
process.env.PDRAFT_USER_DATA = data;
app.setPath("userData", data);
// (Round rename-1) a stand-in for the data folder of the program's old name, with one file of the page's store in it: the
// first start copies it over (desktop/migrate.js) and says so, and leaves the folder as it is
const OLD_DATA = path.join(tmp, "old-data"), MIGRATE = require("./migrate.js");
fs.mkdirSync(path.join(OLD_DATA, "store"), { recursive: true });
fs.writeFileSync(path.join(OLD_DATA, "store", "smoke-old.json"), '"from the old folder"');
process.env.PDRAFT_OLD_USER_DATA = OLD_DATA;
const A = path.join(tmp, "a.pdraft"), B = path.join(tmp, "b.json");      // A: what Save writes (version 22, a ZIP container); B: a pattern file as JSON text, as earlier versions wrote it
// the parts of a saved pattern file, read here with Node's own inflate (not with the program's reader): { name: { method, data } }
function partsOf(file) {
  const b = fs.readFileSync(file), out = {};
  let e = b.length - 22;
  while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  let o = b.readUInt32LE(e + 16);
  for (let k = b.readUInt16LE(e + 10); k > 0; k--) {
    const method = b.readUInt16LE(o + 10), cs = b.readUInt32LE(o + 20), nl = b.readUInt16LE(o + 28), at = b.readUInt32LE(o + 42), name = b.toString("utf8", o + 46, o + 46 + nl);
    const d0 = at + 30 + b.readUInt16LE(at + 26) + b.readUInt16LE(at + 28), raw = b.subarray(d0, d0 + cs);
    out[name] = { method, data: method === 8 ? require("zlib").inflateRawSync(raw) : raw };
    o += 46 + nl + b.readUInt16LE(o + 30) + b.readUInt16LE(o + 32);
  }
  return out;
}
const docOf = (file) => JSON.parse(partsOf(file)["document.json"].data.toString("utf8"));
// a ZIP container of the parts, each entry stored (method 0): { name: { data } } as partsOf() gives them
function zipStored(parts) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const heads = [], dir = []; let at = 0;
  for (const [name, { data }] of Object.entries(parts)) {
    const n = Buffer.from(name), h = Buffer.alloc(30), c = crc(data);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(c, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const d = Buffer.alloc(46); d.writeUInt32LE(0x02014b50, 0); d.writeUInt16LE(20, 4); d.writeUInt16LE(20, 6); d.writeUInt32LE(c, 16); d.writeUInt32LE(data.length, 20); d.writeUInt32LE(data.length, 24); d.writeUInt16LE(n.length, 28); d.writeUInt32LE(at, 42);
    heads.push(h, n, data); dir.push(d, n); at += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(dir), e = Buffer.alloc(22), k = Object.keys(parts).length;
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(k, 8); e.writeUInt16LE(k, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(at, 16);
  return Buffer.concat([...heads, cd, e]);
}

// the dialogs "pick" these
let saveTo = A, openFrom = B, saveDialogs = 0;
dialog.showSaveDialog = async () => { saveDialogs++; return saveTo ? { canceled: false, filePath: saveTo } : { canceled: true }; };      // saveTo null: cancelled
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [openFrom] });
// the system print dialog: keep what it was asked for, and the pages as a PDF made the same way
let printed = null;
app.on("web-contents-created", (e, wc) => {
  wc.print = (opts, done) => {
    const html = fs.readFileSync(decodeURIComponent(new URL(wc.getURL()).pathname).replace(/^\/(\w:)/, "$1"), "utf8");
    wc.printToPDF({ preferCSSPageSize: true, printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } })
      .then((pdf) => { printed = { opts, html, pdf: pdf.toString("latin1") }; done(true); });
  };
});

// the version the page and the shell show (drafter/config.js)
const VERSION = require("../drafter/config.js").version;
// the system clipboard and the feedback link: what was opened is kept, nothing is opened
const { clipboard, shell } = require("electron");
const opened = [];
shell.openExternal = async (url) => { opened.push(url); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// (Round desk-2) PDRAFT_SMOKE_SLOW = n: every wait n times as long, for a build machine with no graphics card and slow
// processors (the release workflow: the solver there takes over 200 ms a step)
const SLOW = Math.max(1, +process.env.PDRAFT_SMOKE_SLOW || 1);
// the pause after each event of a real-mouse drag, as long again on a slow machine
const pace = (ms) => sleep(ms*SLOW);
async function until(what, f, ms = 8000) {
  ms *= SLOW;
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) { const v = await f(); if (v) return v; }
  throw new Error("timed out waiting for " + what);
}
const checks = [];
// (Round desk-2) the page's console errors since the last check, written under a check that failed
let pageErrors = [];
app.on("web-contents-created", (e, wc) => wc.on("console-message", (ev) => { if (ev.level === "error" || ev.level === 3) pageErrors.push(String(ev.message).slice(0, 300)); }));
// (Round desk-2) PDRAFT_NO_WEBGL=1: a machine that cannot give WebGL at all (the Intel Mac build machine: no graphics card,
// and Chromium's software renderer needs Vulkan there). The checks that draw in the 3D window are listed as not checked
const NOGL = process.env.PDRAFT_NO_WEBGL === "1";
const check3d = (name, f) => (NOGL ? (checks.push("  --   " + name + "\n       not checked: no WebGL on this machine"), Promise.resolve()) : check(name, f));
const check = async (name, f) => {
  pageErrors = [];
  try { await f(); checks.push("  ok   " + name); }
  catch (e) { checks.push("  FAIL " + name + "\n       " + String(e.message).split("\n").slice(0, 16).join("\n       ") + (pageErrors.length ? "\n       the page's errors: " + pageErrors.slice(0, 5).join(" | ") : "")); process.exitCode = 1; }
};

async function run(win) {
  const wc = win.webContents, js = (code) => wc.executeJavaScript(code, true);
  const key = async (keyCode, ...modifiers) => { wc.sendInputEvent({ type: "keyDown", keyCode, modifiers }); wc.sendInputEvent({ type: "keyUp", keyCode, modifiers }); await sleep(250); };
  const autosave = path.join(data, "autosave.json");
  win.focus();

  await check("the first start: the welcome box, with \"Don't show again\"; ticked, it stays away (the next start is checked at the end)", async () => {
    const w = await until("the welcome box", () => js("(() => { const m = document.getElementById('modal'); return m && [m.querySelector('.dt').textContent, [...m.querySelectorAll('.btn')].map(b => b.textContent), !!m.querySelector('#wl-off'), m.querySelectorAll('li').length, m.textContent]; })()"));
    assert.deepStrictEqual(w.slice(0, 4), ["Welcome to Gusset – Pattern Drafter", ["Start Drafting", "Open an Example"], true, 6]);
    assert.ok(/early test version/.test(w[4]) && /Save your work often/.test(w[4]) && !/\bclo\b/i.test(w[4]), w[4]);
    await js("document.getElementById('wl-off').click(); [...document.querySelectorAll('#modal .btn')].find(b => b.textContent === 'Start Drafting').click(); 0");
    assert.deepStrictEqual(await js("[!!document.getElementById('modal'), localStorage.getItem('pdraft:welcome')]"), [false, "off"]);
  });
  await check("(Round rename-1) the first start copied the data folder of the program's old name over, once, and said so in one line; that folder is left as it was", async () => {
    await until("the line about it", () => js("document.getElementById('toast').textContent").then(t => t === MIGRATE.NOTICE));
    assert.strictEqual(fs.readFileSync(path.join(data, "store", "smoke-old.json"), "utf8"), '"from the old folder"');
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(data, "migration.json"), "utf8")).state, "done");
    assert.deepStrictEqual(fs.readdirSync(OLD_DATA, { recursive: true }).sort(), ["store", path.join("store", "smoke-old.json")], "nothing added to the old folder or taken from it");
    assert.strictEqual(fs.readFileSync(path.join(OLD_DATA, "store", "smoke-old.json"), "utf8"), '"from the old folder"');
    assert.strictEqual((await js("desktop.info()")).notice, MIGRATE.NOTICE);
    // the lock a running app holds in its folder is what tells migrate.js that the old app is open (this app's own folder, here)
    assert.ok(MIGRATE.oldAppOpen(data), "a running app's lock is seen in its data folder");
    assert.ok(!MIGRATE.oldAppOpen(OLD_DATA), "a folder no app runs on has none");
  });
  await check("the page runs sandboxed with the desktop bridge and no menu bar but its own (a Mac: and the app's own first menu and Window); the title bar says BETA, not the version (Round r24)", async () => {
    if (MAC) {
      // (Round desk-2) a Mac has the app's own menu and Window, and nothing that doubles the page's menus
      const m = Menu.getApplicationMenu();
      assert.deepStrictEqual(m.items.map(i => i.label), [app.name, "Window"]);
      assert.deepStrictEqual(m.items[0].submenu.items.filter(i => i.type !== "separator").map(i => i.label), ["About " + app.name, "Settings…", "Services", "Hide " + app.name, "Hide Others", "Show All", "Quit " + app.name]);
    } else { assert.strictEqual(Menu.getApplicationMenu(), null); assert.strictEqual(win.isMenuBarVisible(), false, "no menu bar of the window's own"); }
    assert.strictEqual(win.getTitle(), "Gusset – Pattern Drafter (Beta)");      // (Round r24 follow-up: the name in full, "(Beta)" after it)
    assert.deepStrictEqual(await js("[...document.querySelectorAll('#menubar .mb')].map(b => b.textContent.trim())"), ["File", "Edit", "3D", "2D", "Materials/UV", "Avatar", "Production", "Render", "Settings", "Help"], "the page's one menu bar");      // (Render since the r19 follow-up, H22)
    assert.deepStrictEqual(await js("[typeof desktop.save, typeof require, typeof process]"), ["function", "undefined", "undefined"]);
    // the File menu of the desktop app has Save As and Recent Files
    assert.strictEqual(await js("(() => { document.querySelector('#menubar .mb[data-m=file]').click(); const m = document.getElementById('menu'), t = [...m.querySelectorAll('.mi')].map(x => x.textContent); m.style.display = 'none'; return t.some(x => /Recent Files/.test(x)) && t.some(x => /Save As/.test(x)); })()"), true, "Save As and Recent are in the File menu");
  });
  await check("it starts with a blank document and nothing autosaved; unsaved work then goes to a file in the data folder, not localStorage", async () => {
    assert.deepStrictEqual(await js("[drafterDebug().S.pieces.length, document.getElementById('s-save').textContent, !!document.getElementById('modal')]"), [0, "SAVED", false]);
    assert.ok(!fs.existsSync(autosave), "nothing to recover from a session that did nothing");
    await js("drafterDebug().run('starterDoc', true); 0");
    await until("autosave.json", () => fs.existsSync(autosave));
    assert.strictEqual(JSON.parse(fs.readFileSync(autosave, "utf8")).v, 26);      // (version 26 since Round r26; 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2)
    assert.strictEqual(await js("localStorage.getItem('pdraft:doc')"), null);
    assert.strictEqual(await js("document.getElementById('s-save').title"), "Autosaved to " + autosave + ", for recovery: not saved to a file yet");
  });
  await check("Ctrl+Shift+S asks where and writes the file; Ctrl+S then writes in place without asking", async () => {
    // (Round r19 follow-up) the window's title is set by the page after the file is written: the check waits for that title instead of
    // reading it the moment the file exists (it failed once so, a race). PDRAFT_SMOKE_SAVEAS_RUNS=n repeats this Save As n times in the
    // one session (the file deleted and the title put back between), to show the wait holds
    const want = "a.pdraft — Gusset – Pattern Drafter (Beta)", runs = Math.max(1, Math.floor(+process.env.PDRAFT_SMOKE_SAVEAS_RUNS || 1));
    for (let r = 0; r < runs; r++) {
      if (r) { fs.rmSync(A); await js("drafterDebug().run('setFile', null); 0"); await until("the title without the file", () => !/a[.]pdraft/.test(win.getTitle())); }
      await key("S", "control", "shift");
      await until("a.pdraft", () => fs.existsSync(A));
      await until("the window's title naming the file", () => win.getTitle() === want);
      assert.strictEqual(saveDialogs, r + 1); assert.strictEqual(win.getTitle(), want, "the page's title and the version after it");
    }
    if (runs > 1) console.log("  note: Save As and the window title right " + runs + " times of " + runs);
    fs.rmSync(A);
    await key("S", "control");
    await until("a.pdraft again", () => fs.existsSync(A));
    assert.strictEqual(saveDialogs, runs, "no dialog the second time");
    const parts = partsOf(A);
    assert.strictEqual(fs.readFileSync(A).toString("latin1", 0, 2), "PK", "a version 23 file is a ZIP container");
    assert.deepStrictEqual([docOf(A).v, docOf(A).pieces[0].name], [26, "Front bodice"]);      // (version 26 since Round r26; 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2)
    assert.strictEqual(parts["document.json"].method, 8, "packed with the platform's own deflate");
    assert.ok(!fs.existsSync(A + ".tmp"));
    await until("the autosave to go", () => !fs.existsSync(autosave));          // saved: nothing is left to recover
    assert.strictEqual(await js("document.getElementById('s-save').textContent"), "SAVED");
  });
  await check("Ctrl+O opens through the dialog; the file becomes the document's file and heads the recent list", async () => {
    const d = docOf(A); d.pieces[0].name = "From B";
    fs.writeFileSync(B, JSON.stringify(d));
    await key("O", "control");
    await until("b.json in the title", () => win.getTitle().startsWith("b.json"));
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(data, "recent.json"), "utf8")), [B, A]);
    assert.strictEqual(await js("drafterDebug().S.pieces[0].name"), "From B");
    assert.ok(!fs.existsSync(autosave), "an opened file is not unsaved work");
  });
  await check("a file from a second launch (double-click) opens in the running window: a version 12 file, read back as it was saved", async () => {
    app.emit("second-instance", {}, ["Gusset.exe", "--some-flag", A]);
    await until("a.pdraft in the title", () => win.getTitle().startsWith("a.pdraft"));
    assert.deepStrictEqual(await js("[drafterDebug().S.pieces[0].name, document.getElementById('s-save').textContent]"), ["Front bodice", "SAVED"]);
    // saved again without a change: the same bytes
    const was = fs.readFileSync(A);
    fs.rmSync(A); await key("S", "control"); await until("a.pdraft again", () => fs.existsSync(A));
    const one = partsOf(A), differ = Object.keys(one).filter(n => { fs.writeFileSync(A + ".was", was); const o = partsOf(A + ".was")[n]; return !o || !o.data.equals(one[n].data); });
    const where = differ.map(n => { const a = partsOf(A + ".was")[n].data.toString("utf8"), b = one[n].data.toString("utf8"); let i = 0; while (i < a.length && a[i] === b[i]) i++; return n + " at " + i + ": " + a.slice(Math.max(0, i - 60), i + 60) + " | " + b.slice(Math.max(0, i - 60), i + 60); });
    fs.rmSync(A + ".was", { force: true });
    assert.ok(was.equals(fs.readFileSync(A)), "save, reopen, save: identical bytes; differing: " + where.join(" ;; "));
  });
  await check("Recent lists both files and opens the one clicked", async () => {
    await js("document.getElementById('recent').click()");
    const items = await until("the recent menu", () => js("(() => { const m = document.getElementById('menu'); return m.style.display === 'block' && [...m.querySelectorAll('.mi')].map(x => x.textContent); })()"));
    assert.deepStrictEqual(items, ["a.pdraft", "b.json"]);
    await js("document.querySelectorAll('#menu .mi')[1].click()");
    await until("b.json in the title", () => win.getTitle().startsWith("b.json"));
  });
  await check("a version 11 .pdraft opened and saved: the original is kept beside it as <name>.v11.pdraft, without a dialog, once", async () => {
    const old = path.join(tmp, "old.pdraft"), kept = path.join(tmp, "old.v11.pdraft"), d = docOf(A);
    d.v = 11; d.pieces[0].name = "Eleven";
    const text = JSON.stringify(d, null, 1);
    fs.writeFileSync(old, text);
    openFrom = old; await key("O", "control");
    await until("old.pdraft in the title", () => win.getTitle().startsWith("old.pdraft"));
    const dialogs = saveDialogs;
    await key("S", "control");
    await until("the copy", () => fs.existsSync(kept));
    await until("version 12 in its place", () => fs.readFileSync(old).toString("latin1", 0, 2) === "PK");
    assert.strictEqual(fs.readFileSync(kept, "utf8"), text, "the copy is the original, byte for byte"); assert.strictEqual(saveDialogs, dialogs, "no dialog");
    assert.strictEqual(docOf(old).pieces[0].name, "Eleven");
    assert.ok(/the original is kept beside it as old\.v11\.pdraft$/.test(await js("document.getElementById('toast').textContent")), "the toast says so");
    // saved again: nothing more is kept, and the copy is not touched
    const stamp = fs.statSync(kept).mtimeMs;
    await js("drafterDebug().run('store'); 0"); await key("S", "control"); await sleep(400);
    assert.strictEqual(fs.statSync(kept).mtimeMs, stamp); assert.deepStrictEqual(fs.readdirSync(tmp).filter(n => /v11/.test(n)), ["old.v11.pdraft"]);
    openFrom = B; await key("O", "control");
    await until("b.json in the title", () => win.getTitle().startsWith("b.json"));
  });
  await check("the desktop app's two own keys: Ctrl+W removes all pins, Ctrl+N starts a new document after asking about unsaved work; Ctrl+F is ours too", async () => {
    await js("(() => { const d = drafterDebug(), p = d.S.pieces[0], b = d.run('bboxOf', [p]); d.push('Pin'); p.pins = [{ x: (b.x0 + b.x1)/2, y: (b.y0 + b.y1)/2 }]; d.commit(); return 0; })()");
    assert.strictEqual(await js("(drafterDebug().S.pieces[0].pins || []).length"), 1);
    await key("W", "control", "shift");
    assert.strictEqual(await js("(drafterDebug().S.pieces[0].pins || []).length"), 1, "with Shift held as well it is not the key");
    await key("W", "control");
    assert.ok(!win.isDestroyed(), "window still open");
    assert.strictEqual(await js("(drafterDebug().S.pieces[0].pins || []).length"), 0);
    await key("F", "control");
    assert.strictEqual(await js("document.getElementById('toast').textContent"), "Select a pattern in the 3D window first", "Ctrl+F reached Reset 3D Arrangement (Selected)");
    await key("N", "control");
    const q = await until("the question", () => js("(() => { const m = document.getElementById('modal'); return m && [m.querySelector('.dt').textContent, m.querySelectorAll('.btn').length]; })()"));
    assert.deepStrictEqual(q, ["Unsaved changes", 3]);
    await js("document.querySelectorAll('#modal .btn')[1].click(); 0");
    assert.deepStrictEqual(await js("[drafterDebug().S.pieces.length, document.title]"), [0, "Gusset – Pattern Drafter"]);
    // back to the file the checks below work on
    await key("O", "control");
    await until("b.json in the title", () => win.getTitle().startsWith("b.json"));
    assert.strictEqual(await js("drafterDebug().S.pieces[0].name"), "From B");
  });
  await check("no built-in shortcut gets in first: Ctrl+R, Ctrl+W, Ctrl+Shift+I, Ctrl+= and F5 leave the page as it is", async () => {
    await js("window.__mark = 1");
    await key("R", "control"); await key("W", "control"); await key("I", "control", "shift"); await key("=", "control"); await key("F5");
    assert.ok(!win.isDestroyed(), "window still open");
    assert.strictEqual(await js("window.__mark"), 1, "page was not reloaded");
    assert.strictEqual(wc.isDevToolsOpened(), false); assert.strictEqual(wc.getZoomFactor(), 1);
  });
  if (MAC) await check("a Mac: Cmd does what Ctrl does, but Cmd+H, Cmd+Q and Cmd+W are left to the Mac (their commands are on Control); About and Settings… of the app's menu open the page's; Cmd+V pastes in a text field", async () => {
    const find = (key, mods) => js("(() => { const r = drafterDebug().run('keyFind', Object.assign({ key: " + JSON.stringify(key) + ", code: 'Key' + " + JSON.stringify(key.toUpperCase()) + " }, " + JSON.stringify(mods) + ")); return r && r.id; })()");
    assert.deepStrictEqual([await find("s", { metaKey: true }), await find("h", { metaKey: true }), await find("h", { ctrlKey: true }), await find("q", { metaKey: true }), await find("q", { ctrlKey: true }), await find("w", { metaKey: true }), await find("s", { ctrlKey: true })],
      ["save", null, "strong3", null, "tool:quick_pinching", null, "save"]);
    assert.strictEqual(await js("drafterDebug().run('keyOf', 'strong3') + ' ' + drafterDebug().run('keyOf', 'saveAs')"), "Control+H Cmd+Shift+S");
    const items = Menu.getApplicationMenu().items[0].submenu.items;
    items.find(i => i.label === "About " + app.name).click();
    assert.ok(/Version/.test(await until("the About box", () => js("(() => { const m = document.getElementById('modal'); return m && m.textContent; })()"))));
    await js("document.querySelector('#modal .btn').click(); 0");
    items.find(i => i.label === "Settings…").click();
    assert.strictEqual(await until("Settings", () => js("(() => { const d = document.getElementById('dlg'); return d.style.display === 'block' && d.querySelector('.dt').textContent; })()")), "Settings");
    await js("drafterDebug().run('hideDlg'); 0");
    clipboard.writeText("123.5");
    await js("(() => { const i = document.createElement('input'); i.id = 'mac-paste'; document.body.appendChild(i); i.focus(); return 0; })()");
    await key("V", "meta");
    assert.strictEqual(await js("(() => { const i = document.getElementById('mac-paste'), v = i.value; i.remove(); return v; })()"), "123.5");
  });
  await check("Ctrl+D reaches the app (Symmetric Pattern) and right-click opens the app's own menu", async () => {
    const before = await js("drafterDebug().S.pieces.length");
    await key("D", "control");
    // (Round r23 / 1: every start shows both windows, so the page's first canvas is the 3D window's: the 2D window's is #c)
    const r = await js("(() => { const c = document.getElementById('c'), b = c.getBoundingClientRect(); return [b.left + b.width/2, b.top + b.height/2]; })()");
    // the copy hangs on the pointer until a click sets it down
    await until("the copy on the pointer", () => js("!!drafterDebug().S.place"));
    wc.sendInputEvent({ type: "mouseMove", x: Math.round(r[0]), y: Math.round(r[1]) });
    wc.sendInputEvent({ type: "mouseDown", x: Math.round(r[0]), y: Math.round(r[1]), button: "left", clickCount: 1 });
    wc.sendInputEvent({ type: "mouseUp", x: Math.round(r[0]), y: Math.round(r[1]), button: "left", clickCount: 1 });
    await until("the linked copy in the autosave", () => fs.existsSync(autosave) && JSON.parse(fs.readFileSync(autosave, "utf8")).pieces.length === before + 1);
    // the click was in the middle of the window, on the pattern itself: put the copy beside it, where the checks further down expect cloth that hangs free.
    // (Round r20 / 1c) a move in 2D does not move a pattern in 3D, so the copy also gets its 3D place from where it now lies in 2D (its p3
    // taken away, as Reset 2D Arrangement does): until r20 the two patterns lay exactly on each other in 3D, and which one the gizmo
    // check's click met was a tie
    await js("(() => { const d = drafterDebug(), p = d.S.pieces[0], q = d.S.pieces[d.S.pieces.length - 1], a = d.run('bboxOf', [p]), b = d.run('bboxOf', [q]); d.push('Move'); d.run('mapPiece', q, (v) => ({ x: v.x + a.x1 + 40 - b.x0, y: v.y + a.y0 - b.y0 })); delete q.p3; d.commit(); return 0; })()");
    wc.sendInputEvent({ type: "mouseDown", x: Math.round(r[0]), y: Math.round(r[1]), button: "right", clickCount: 1 });
    wc.sendInputEvent({ type: "mouseUp", x: Math.round(r[0]), y: Math.round(r[1]), button: "right", clickCount: 1 });
    wc.sendInputEvent({ type: "contextMenu", x: Math.round(r[0]), y: Math.round(r[1]) });
    await until("the app's menu", () => js("document.getElementById('menu').style.display === 'block' && document.querySelectorAll('#menu .mi').length > 3"));
    await key("Escape");
  });
  await check("dropping a file on the window does not navigate away from the app", async () => {
    await js("location.href = " + JSON.stringify("file:///" + A.replace(/\\/g, "/")) + "; 0");
    await sleep(400);
    assert.ok(wc.getURL().endsWith("pattern-drafter.html"), wc.getURL());
  });
  await check("the avatar bridge hands over a picked file's bytes, opens it again later, and no other file", async () => {
    const fbx = path.join(tmp, "body.fbx"), was = openFrom;
    fs.writeFileSync(fbx, Buffer.from([75, 97, 121, 100, 97, 114, 97, 0, 1, 2, 3]));
    openFrom = fbx;
    const got = await js("window.desktop.avatar.pick().then(r => [r.name, r.path, r.data.length, r.data[10]])");
    openFrom = was;
    assert.deepStrictEqual(got, ["body.fbx", fbx, 11, 3]);
    assert.deepStrictEqual(await js("window.desktop.avatar.read(" + JSON.stringify(fbx) + ").then(r => [r.name, r.data.length])"), ["body.fbx", 11]);
    assert.strictEqual(await js("window.desktop.avatar.read(" + JSON.stringify(A) + ").then(() => \"read\", () => \"refused\")"), "refused", "a file that was never picked as an avatar");
    assert.ok(await js("typeof SIM3D === \"object\" && typeof THREE_LOADERS === \"object\" && typeof THREE_LOADERS.FBXLoader === \"function\""), "the 3D scripts are loaded");
  });
  await check("the Load Avatar dialog shows Marty on the Male card and Jessica on the Female card, and a preset file may be read without having been picked", async () => {
    const dir = path.join(PAGE_DIR, "assets", "avatar", "presets");
    for (const n of ["marty.glb", "jessica.glb"]) if (!fs.existsSync(path.join(dir, n))) throw new Error("drafter/assets/avatar/presets/" + n + " is not there");
    const ps = await js("window.desktop.avatar.presets()");
    assert.ok(ps.male && /^marty\./i.test(ps.male.name) && ps.male.path.startsWith(dir) && ps.female && /^jessica\./i.test(ps.female.name), JSON.stringify(ps));
    assert.ok((await js("window.desktop.avatar.read(" + JSON.stringify(ps.female.path) + ").then(r => r.data.length)")) > 0, "a preset can be read without having been picked");
    await js("document.getElementById('s-av').click(); 0");
    const html = await until("the dialog with its presets", () => js("(() => { const d = document.getElementById('dlg'); return d.style.display === 'block' && d.className === 'avatar' && !/looking/.test(d.innerHTML) && d.innerHTML; })()"));
    assert.ok(/>Male</.test(html) && />Female</.test(html) && /Load your own/.test(html));
    assert.deepStrictEqual(await js("[...document.querySelectorAll('#dlg .avc')].map(b => [b.querySelector('b').textContent, b.querySelector('i').textContent, b.disabled])"), [["Male", "Marty", false], ["Female", "Jessica", false]]);
    assert.ok(await js("(() => { const r = document.querySelector('#dlg .avc').getBoundingClientRect(), o = document.getElementById('av-own').getBoundingClientRect(); return r.width > 80 && r.height > 120 && o.top > r.bottom; })()"), "cards on top, Load your own below");
    await js("document.getElementById('dlg-x').click(); 0");
  });
  await check("the 3D window comes up with no avatar; a click on the Male card loads Marty and one on the Female card Jessica: each at its height, with its skeleton, every arrangement point and the pose sliders; the cloth collides with the body only, the underwear is drawn", async () => {
    await js("drafterDebug().setLayout('both'); 0"); await sleep(1500);
    assert.deepStrictEqual(await js("[drafterDebug().S.av, document.getElementById('s-av').textContent, drafterDebug().view3d.group('avatar').children.length]"), [null, "NO AVATAR", 0], "a session starts with an empty 3D scene");
    const card = async (k) => {
      await js("drafterDebug().run('hideDlg'); drafterDebug().run('loadAvatar'); 0");
      await until("the " + k + " card", () => js("(() => { const b = document.querySelector('#dlg .avc[data-k=" + k + "]'); return b && !/looking/.test(document.getElementById('dlg').innerHTML) && !!b.onclick; })()"));
      await js("document.querySelector('#dlg .avc[data-k=" + k + "]').click(); 0");
    };
    await card("male");
    const state = () => js("(() => { const d = drafterDebug(), a = d.S.av; if (!a) return null; d.run('posePanel', true); const solid = d.run('avatarSolid', a); " +
      "return { name: a.name, preset: a.preset, h: Math.round(a.height*10)/10, bones: a.bones.size, set: d.S.avSet.name, status: document.getElementById('s-av').textContent, points: d.arrList().length, " +
      "sliders: document.querySelectorAll('#posepanel input[type=range]').length, meshes: a.meshes.length, shown: a.meshes.filter(m => m.visible !== false).length, solid: solid.map(m => m.name), tris: a.colTris || 0 }; })()");
    const marty = await until("Marty", async () => { const st = await state(); return st && st.name === "Marty" && st; }, 30000);
    assert.deepStrictEqual([marty.preset, marty.set, marty.h, marty.bones, marty.points], ["marty", "Marty", 1875.5, 53, 46]);
    assert.ok(/^AVATAR 187\d MM$/.test(marty.status), marty.status);
    assert.ok(marty.sliders >= 54, "three sliders a main bone: " + marty.sliders);
    // (Round r15: Marty and Jessica are plain mannequins; the file's other meshes are hidden)
    assert.deepStrictEqual([marty.meshes, marty.shown, marty.solid], [2, 1, ["Marty_body"]], "the body alone is drawn, collides and is measured");
    // the Female card
    await card("female");
    const jess = await until("Jessica", async () => { const st = await state(); return st && st.name === "Jessica" && st; }, 30000);
    assert.deepStrictEqual([jess.preset, jess.set, jess.h, jess.bones, jess.points], ["jessica", "Jessica", 1755.8, 53, 46]);
    assert.ok(jess.sliders >= 54); assert.deepStrictEqual([jess.meshes, jess.shown, jess.solid], [3, 1, ["Jessica_body"]]);
    // and back to Marty for what follows
    await card("male");
    await until("Marty again", async () => { const st = await state(); return st && st.name === "Marty"; }, 30000);
    await js("drafterDebug().run('posePanel', false); 0");
  });
  await check3d("the 3D window's mouse and keys: a right drag turns the view and a left drag on empty space leaves it (the set a new installation has); with the left-button set the left drag turns; the wheel forward zooms in, in 3D and in 2D; 6 is Left and 4 is Right", async () => {
    await js("drafterDebug().setLayout('both'); 0"); await sleep(250);
    const at = await js("(() => { const b = document.querySelector('#stage3d canvas').getBoundingClientRect(); return [Math.round(b.left + 40), Math.round(b.top + b.height*0.62)]; })()");
    const cam = () => js("(() => { const c = drafterDebug().view3d.cam; return [c.az, c.dist]; })()");
    const dragWith = async (button) => {
      const [x, y] = at, held = { modifiers: [button + "ButtonDown"] };
      wc.sendInputEvent({ type: "mouseMove", x, y }); await pace(60);
      wc.sendInputEvent({ type: "mouseDown", x, y, button, clickCount: 1 }); await pace(60);
      wc.sendInputEvent({ type: "mouseMove", x: x + 30, y, button, ...held }); await pace(60);
      wc.sendInputEvent({ type: "mouseMove", x: x + 60, y, button, ...held }); await pace(60);
      wc.sendInputEvent({ type: "mouseUp", x: x + 60, y, button, clickCount: 1 }); await pace(120);
    };
    assert.strictEqual(await js("drafterDebug().S.prefs.view.preset"), "right");
    assert.ok(/^.*right-drag to turn the view, middle-drag to pan/.test(await js("document.getElementById('note3d').textContent")), "the line under the 3D window says which button");
    const c0 = await cam(); await dragWith("left"); const c1 = await cam();
    assert.strictEqual(c1[0], c0[0], "a left drag on empty space does not turn the view");
    await dragWith("right"); const c2 = await cam();
    assert.ok(Math.abs(c2[0] - c1[0]) > 0.2, "a right drag turns it: " + c1[0] + " -> " + c2[0]);
    assert.notStrictEqual(await js("document.getElementById('menu').style.display"), "block", "and opens no menu");
    await js("drafterDebug().run('setPrefs', { view: { preset: 'left' } }); 0");
    await dragWith("left"); const c3 = await cam();
    assert.ok(Math.abs(c3[0] - c2[0]) > 0.2, "with the left-button set a left drag turns it");
    await dragWith("right"); assert.strictEqual((await cam())[0], c3[0], "and a right drag pans");
    await js("drafterDebug().run('setPrefs', { view: { preset: 'right' } }); 0");
    // the wheel, turned forward (away from the hand)
    wc.sendInputEvent({ type: "mouseMove", x: at[0], y: at[1] }); await sleep(60);
    wc.sendInputEvent({ type: "mouseWheel", x: at[0], y: at[1], deltaX: 0, deltaY: 120 }); await sleep(150);
    assert.ok((await cam())[1] < c3[1], "3D: forward zooms in: " + c3 + " -> " + (await cam()) + " " + JSON.stringify(await js("drafterDebug().run('(() => ERRLOG)')")));
    // the view keys, with the pointer over the 3D window
    await key("6"); assert.ok(Math.abs((await cam())[0] - Math.PI/2) < 1e-9, "6 is Left: the camera at the avatar's left");
    await key("4"); assert.ok(Math.abs((await cam())[0] + Math.PI/2) < 1e-9, "4 is Right");
    await key("6", "alt"); assert.ok(Math.abs((await cam())[0] + Math.PI/2) < 1e-9, "Alt+6 is no view");
    const two = await js("(() => { const b = document.getElementById('c').getBoundingClientRect(); return [Math.round(b.left + b.width/2), Math.round(b.top + b.height/2)]; })()");
    const s0 = await js("drafterDebug().S.view.s");
    wc.sendInputEvent({ type: "mouseMove", x: two[0], y: two[1] }); await sleep(60);
    wc.sendInputEvent({ type: "mouseWheel", x: two[0], y: two[1], deltaX: 0, deltaY: 120 }); await sleep(150);
    assert.ok((await js("drafterDebug().S.view.s")) > s0, "2D: forward zooms in");
    await key("4"); assert.ok(Math.abs((await cam())[0] + Math.PI/2) < 1e-9, "away from the 3D window the number keys are no views");
    await key("2");
  });
  await check3d("the gizmo with the real mouse: a click on a pattern in the 3D window puts it there; an arrow is dragged and the distance written beside the pointer; the right button pressed as well opens the box, Enter applies the typed distance as one undo step; on a ring Esc goes back to turning", async () => {
    // (Round r15 / 8: Gizmo ▸ opens at Screen Coordinate; this check turns about the world's Z, so World Coordinate is chosen first)
    await js("drafterDebug().run('setPrefs', { gizSpace: 'world' }); drafterDebug().setLayout('both'); drafterDebug().run('cam3d', 'front'); drafterDebug().setTool3('select_move'); 0"); await sleep(300);
    await until("a pattern's cloth", () => js("drafterDebug().G3.items.size > 0"));
    // the click selects the pattern the ray at that whole pixel meets (Round r19); since r20 the document's two patterns lie apart in 3D,
    // so that is the first one, whose middle is clicked
    const at = await js("(() => { const d = drafterDebug(), it = [...d.G3.items.values()][0], X = it.X, n = X.length/3; let x = 0, y = 0, z = 0; for (let i = 0; i < X.length; i += 3) { x += X[i]; y += X[i+1]; z += X[i+2]; } const q = d.view3d.project({ x: x/n, y: y/n, z: z/n }), cx = Math.round(q.x), cy = Math.round(q.y), h = d.run('garmentHit', d.view3d.ray({ clientX: cx, clientY: cy })); return [cx, cy, h ? h.p.id : it.pid, it.pid]; })()");
    assert.strictEqual(at[2], at[3], "the ray at the first pattern's middle meets that pattern (no other lies on it in 3D)");
    const mouse = async (type, x, y, button, held) => { wc.sendInputEvent({ type, x, y, ...(button ? { button, clickCount: 1 } : {}), ...(held ? { modifiers: held.map(b => b + "ButtonDown") } : {}) }); await pace(70); };
    await mouse("mouseMove", at[0], at[1]); await mouse("mouseDown", at[0], at[1], "left"); await mouse("mouseUp", at[0], at[1], "left");
    assert.deepStrictEqual(await js("[drafterDebug().S.sel.join(), (drafterDebug().G3.giz || {}).pid]"), [String(at[2]), at[2]], "the click selected the pattern and put the gizmo on it");
    const state = () => js("(() => { const d = drafterDebug(), p = d.byId(" + at[2] + "), it = d.G3.items.get(p.id), b = p.p3 || d.run('defaultP3', p, it.mesh.c), g = document.getElementById('giz3d'), dl = document.getElementById('dlg'), h = d.run('histSteps'); " +
      "return { pos: b.pos, q: b.q, read: g.style.display === 'block' ? g.textContent : '', dlg: dl.style.display === 'block' ? (dl.querySelector('.dt') || {}).textContent : '', drag: !!d.TOOL3.select_move.d, typing: !!(d.TOOL3.select_move.d || {}).typing, last: h.at ? h.steps[h.at - 1].n : '', n: h.at }; })()");
    const handle = (k, a, b) => js("(() => { const d = drafterDebug(), g = d.run('gizGeom'), h = d.run('gizHandles')[" + k + "], P = (q) => { const s = d.view3d.project(q); return [Math.round(s.x), Math.round(s.y)]; }; " +
      "const p = h.kind === 'move' ? [d.run('gizTip', g, h.ax, " + a + "), d.run('gizTip', g, h.ax, " + b + ")] : [d.run('gizRingPt', g, h.ax, " + a + "), d.run('gizRingPt', g, h.ax, " + b + ")]; " +
      "return [...P(p[0]), ...P(p[1]), (d.run('gizHit', { clientX: P(p[0])[0], clientY: P(p[0])[1] }) || {}).id]; })()");
    // the X arrow
    const s0 = await state(), ar = await handle(1, 0.5, 0.95);
    assert.strictEqual(ar[4], "move:x");
    await mouse("mouseMove", ar[0], ar[1]); await mouse("mouseDown", ar[0], ar[1], "left"); await mouse("mouseMove", ar[2], ar[3], "left", ["left"]);
    const s1 = await state();
    assert.ok(/^Moved \d+\.\d mm along X$/.test(s1.read), "written beside the pointer: " + s1.read); assert.ok(s1.pos[0] > s0.pos[0] + 5 && s1.pos[1] === s0.pos[1] && s1.pos[2] === s0.pos[2], "along X only");
    await mouse("mouseDown", ar[2], ar[3], "right", ["left"]);                    // the right button as well, the left still down
    const s2 = await until("the box for the distance", async () => { const st = await state(); return st.dlg && st; });
    assert.strictEqual(s2.dlg, "Move along X"); assert.strictEqual(s2.typing, true);
    await js("(() => { const i = document.querySelector('#dlg input'); i.focus(); i.value = '120'; })(); 0"); await key("Enter");
    await mouse("mouseUp", ar[2], ar[3], "right", ["left"]); await mouse("mouseUp", ar[2], ar[3], "left");
    const s3 = await state();
    assert.ok(Math.abs(s3.pos[0] - s0.pos[0] - 120) < 1e-6, "exactly the 120 mm typed, from where it stood: " + (s3.pos[0] - s0.pos[0]));
    assert.deepStrictEqual([s3.dlg, s3.drag, s3.read, s3.last, s3.n], ["", false, "", "Move in 3D", s0.n + 1], "the drag is over, one undo step");
    assert.notStrictEqual(await js("document.getElementById('menu').style.display"), "block", "the right button opened no menu");
    // the Z ring: the angle is written, the box opens, Esc goes back to turning, letting go keeps the turn
    const rg = await handle(6, 1.0, 1.4);
    assert.strictEqual(rg[4], "turn:z");
    await mouse("mouseMove", rg[0], rg[1]); await mouse("mouseDown", rg[0], rg[1], "left"); await mouse("mouseMove", rg[2], rg[3], "left", ["left"]);
    const t1 = await state();
    assert.ok(/^Turned −?\d+\.\d° about Z$/.test(t1.read), "the angle beside the pointer: " + t1.read);
    await mouse("mouseDown", rg[2], rg[3], "right", ["left"]);
    const t2 = await until("the box for the angle", async () => { const st = await state(); return st.dlg && st; });
    assert.strictEqual(t2.dlg, "Turn about Z");
    await js("document.querySelector('#dlg input').focus(); 0"); await key("Escape");
    const t3 = await state();
    assert.deepStrictEqual([t3.dlg, t3.drag, t3.typing, t3.n], ["", true, false, s3.n], "Esc closed the box and the ring is still in hand");
    await mouse("mouseUp", rg[2], rg[3], "right", ["left"]); await mouse("mouseMove", rg[2] + 6, rg[3] + 6, "left", ["left"]); await mouse("mouseUp", rg[2] + 6, rg[3] + 6, "left");
    const t4 = await state();
    assert.deepStrictEqual([t4.drag, t4.last, t4.n], [false, "Turn in 3D", s3.n + 1]); assert.ok(Math.abs(t4.q[2]) > 0.01 && Math.abs(t4.q[0]) < 1e-9 && Math.abs(t4.q[1]) < 1e-9, "turned about Z only: " + t4.q);
    // undo twice: back where it stood
    await key("Z", "control"); await key("Z", "control");
    const u = await state();
    assert.ok(Math.abs(u.pos[0] - s0.pos[0]) < 1e-6 && Math.abs(u.q[2]) < 1e-9, "two undo steps bring it back");
  });
  await check3d("layout: the splitter is dragged, the toolbars dock at the top, right and left, a toolbar is dragged by its empty part, and scrollbars are dark", async () => {
    const rect = (sel) => js("(() => { const r = document.querySelector(" + JSON.stringify(sel) + ").getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; })()");
    // (a move between press and release carries the held button, as a real mouse does: without it Chromium ends the pointer capture)
    const mouse = async (type, x, y) => { wc.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1, ...(type === "mouseMove" ? { modifiers: ["leftButtonDown"] } : {}) }); await pace(60); };
    await js("drafterDebug().setLayout('both'); 0"); await sleep(200);
    const p3 = await rect("#pane3d"), sp = await rect("#split"), p2 = await rect("#pane2d");
    assert.ok(sp.w >= 5 && sp.w <= 9 && Math.abs(sp.l - p3.r) < 1 && Math.abs(p2.l - sp.r) < 1, "the splitter lies between the two windows: " + JSON.stringify([p3, sp, p2]));
    assert.ok(Math.abs(p3.w - p2.w) < 3, "half and half to start with");
    assert.strictEqual(await js("getComputedStyle(document.getElementById('split')).cursor"), "col-resize");
    // drag it 180 px to the left
    await mouse("mouseDown", sp.l + 3, sp.t + 200); await mouse("mouseMove", sp.l - 90, sp.t + 210); await mouse("mouseMove", sp.l - 177, sp.t + 210); await mouse("mouseUp", sp.l - 177, sp.t + 210);
    const q3 = await rect("#pane3d"), q2 = await rect("#pane2d");
    assert.ok(Math.abs((p3.w - q3.w) - 180) < 6 && q2.w > p2.w + 170, "3D " + p3.w + " -> " + q3.w + ", 2D " + p2.w + " -> " + q2.w);
    // (Round r23 / 1: the split is view state: for this session only, not written)
    assert.ok(Math.abs(await js("drafterDebug().S.ui.split") - q3.w/(q3.w + q2.w + sp.w)) < 0.02, "the split follows the drag");
    assert.strictEqual(JSON.parse(await js("localStorage.getItem('pdraft:ui') || '{}'")).split, undefined, "not written");
    assert.ok((await rect("#stage3d canvas")).w > 100 && Math.abs((await rect("#c")).w - (await rect("#stage")).w) < 1, "both windows are drawn at their new size");
    // the 2D toolbar: at the right in two columns, then along the top
    let rail = await rect("#rail"), stage = await rect("#stage");
    assert.ok(rail.l >= stage.r - 1 && rail.w < 80 && rail.h > 300, "at the right: " + JSON.stringify(rail));
    await js("drafterDebug().run('setDock', '2D', 'top'); 0"); await sleep(150);
    rail = await rect("#rail"); stage = await rect("#stage");
    assert.ok(rail.b <= stage.t + 1 && rail.w > 300 && Math.abs(rail.w - stage.w) < 2, "along the top: " + JSON.stringify([rail, stage]));
    // … dragged back to the right by its empty part (the far end of the strip)
    const free = await js("(() => { const el = document.getElementById('rail'), r = el.getBoundingClientRect(); for (let x = r.right - 4; x > r.left; x -= 6) for (let y = r.bottom - 4; y > r.top; y -= 6) if (document.elementFromPoint(x, y) === el) return [x, y]; return null; })()");
    assert.ok(free, "the toolbar has an empty part to take it by");
    await mouse("mouseDown", free[0], free[1]); await mouse("mouseMove", free[0] - 14, free[1] + 120); await mouse("mouseMove", stage.r - 12, stage.t + 320);
    assert.strictEqual(await js("getComputedStyle(document.getElementById('dockhint')).display"), "block", "the edge it would dock to is marked while it is dragged");
    await mouse("mouseUp", stage.r - 12, stage.t + 320);
    assert.strictEqual(await js("drafterDebug().S.ui.dock2"), "right");
    // the 3D toolbar: down the left (Round r23 / 2: where it starts), then along the top, then back
    let r3 = await rect("#rail3d"), s3 = await rect("#stage3d");
    assert.ok(r3.r <= s3.l + 1 && r3.w < 80 && r3.h > 300, "down the left: " + JSON.stringify([r3, s3]));
    await js("drafterDebug().run('setDock', '3D', 'top'); 0"); await sleep(150);
    r3 = await rect("#rail3d"); s3 = await rect("#stage3d");
    assert.ok(r3.b <= s3.t + 1 && r3.w > 150, "3D toolbar along the top");
    await js("drafterDebug().run('setDock', '3D', 'left'); drafterDebug().run('setSplit', 0.5, true); 0");
    // scrollbars
    assert.strictEqual(await js("getComputedStyle(document.getElementById('props')).scrollbarColor"), "rgb(86, 86, 90) rgb(30, 30, 32)");
    assert.strictEqual(await js("getComputedStyle(document.getElementById('ob-body')).scrollbarWidth"), "thin");
  });
  await check3d("Simulate runs the cloth solver in a worker: the cloth moves, the page keeps drawing, and Space-off leaves the cloth where it got to", async () => {
    await js("drafterDebug().setLayout('both'); 0"); await sleep(300);
    // (the cloth moves: with Marty there it need not fall, as it did with no avatar; its points are compared before and after)
    await js("window.__X0 = [...drafterDebug().G3.items.values()].map(it => Float32Array.from(it.X)); 0");
    const y0 = await js("(() => { const d = drafterDebug(), it = [...d.G3.items.values()][0]; return it ? it.X[1] : null; })()");
    assert.ok(Number.isFinite(y0), "there is cloth to simulate");
    await js("window.__frames = 0; (function tick() { window.__frames++; requestAnimationFrame(tick); })(); drafterDebug().simStart(); 0");
    await until("frames from the worker", () => js("drafterDebug().SIM.tick > 10"), 15000).catch(async (e) => { throw new Error(e.message + " " + JSON.stringify(await js("({ on: drafterDebug().SIM.on, tick: drafterDebug().SIM.tick, err: drafterDebug().run('(() => ERRLOG)'), note: document.getElementById('note3d').textContent, items: drafterDebug().G3.items.size })"))); });
    const st = await js("(() => { const d = drafterDebug(), its = [...d.G3.items.values()], it = its[0]; let moved = 0; its.forEach((t, k) => { for (let i = 0; i < t.X.length; i++) moved = Math.max(moved, Math.abs(t.X[i] - window.__X0[k][i])); }); return { remote: !!d.SIM.sim.remote, worker: !!d.SIM.wk, moved, draped: it.draped, note: document.getElementById('note3d').textContent, frames: window.__frames }; })()");
    assert.strictEqual(st.remote, true, "the solver is not in the page"); assert.strictEqual(st.worker, true);
    assert.ok(st.moved > 1, "the cloth has moved: " + st.moved + " mm at most"); assert.strictEqual(st.draped, true);
    assert.ok(/Simulating/.test(st.note) && !/own thread/.test(st.note), st.note);
    assert.ok(st.frames > 10, "the page went on drawing meanwhile: " + st.frames + " frames");
    await js("drafterDebug().simStop(); 0"); await sleep(200);
    const y1 = await js("[...drafterDebug().G3.items.values()][0].X[1]"); await sleep(300);
    assert.strictEqual(await js("[...drafterDebug().G3.items.values()][0].X[1]"), y1, "stopped: the cloth stays");
    assert.strictEqual(await js("drafterDebug().SIM.on"), false);
  });
  /* ---- Round desk-1: what the desktop app does that a browser does not, and the test version's own parts ---- */
  const out = (n) => path.join(tmp, "out", n);
  fs.mkdirSync(path.join(tmp, "out"), { recursive: true });
  const toast = () => js("document.getElementById('toast').textContent");
  const answerUnsaved = async () => { if (await js("!!document.getElementById('modal')")) await js("[...document.querySelectorAll('#modal .btn')].find(b => /Don.t Save/.test(b.textContent)).click(); 0"); };
  const openVia = async (file) => { openFrom = file; await key("O", "control"); await answerUnsaved(); await until(path.basename(file) + " in the title", () => win.getTitle().startsWith(path.basename(file) + " —")); };
  await check("pattern files of every version open through Open: the three version 11 files (JSON text), the version 12 file, a version 15 container and version 19", async () => {
    const dir = path.join(__dirname, "..", "drafter", "tests", "files");
    for (const f of ["v11/curves-graphic-block.pdraft", "v11/sewn-arranged-draped.pdraft", "v11/starter-history.pdraft", "v12/skirt-on-the-marty-of-8-oct.pdraft"]) {
      const copy = out(path.basename(f)); fs.copyFileSync(path.join(dir, f), copy);
      await openVia(copy);
      const st = await js("[drafterDebug().S.pieces.length, document.getElementById('toast').textContent]");
      // (the toast may already be the next one: the version 12 file says it was draped on another version of Marty)
      assert.ok(st[0] > 0 && !/^Couldn/.test(st[1]), f + ": " + st);
    }
    // a version 15 container: a file saved here with its document's version set back to 15 (stored entries, written here)
    const parts = partsOf(A), doc = JSON.parse(parts["document.json"].data.toString("utf8")); doc.v = 15;
    parts["document.json"] = { data: Buffer.from(JSON.stringify(doc)) };
    const v15 = out("fifteen.pdraft"); fs.writeFileSync(v15, zipStored(parts));
    await openVia(v15);
    assert.deepStrictEqual(await js("[drafterDebug().S.pieces[0].name, /^Opened fifteen/.test(document.getElementById('toast').textContent)]"), ["Front bodice", true]);
    await openVia(A);
    assert.strictEqual(await js("drafterDebug().S.pieces[0].name"), "Front bodice");
  });
  await check("exports are written where the user chooses: DXF, SVG, a real PDF at the patterns' size, the BOM; a cancelled dialog writes and says nothing", async () => {
    saveTo = out("p.dxf"); await js("drafterDebug().run('dxfOutNumeric', { x: 300, y: 120 }); document.getElementById('dlg-ok').click(); 0");
    await until("p.dxf", () => fs.existsSync(out("p.dxf")));
    assert.ok(/SECTION[\s\S]*ENTITIES[\s\S]*EOF/.test(fs.readFileSync(out("p.dxf"), "utf8"))); await until("the DXF toast", async () => /written as DXF-AAMA/.test(await toast()));
    saveTo = out("p.svg"); await js("document.getElementById('ex-svg').click(); 0");
    await until("p.svg", () => fs.existsSync(out("p.svg")));
    assert.ok(/^<\?xml[\s\S]*<svg [^>]*width="[\d.]+mm"/.test(fs.readFileSync(out("p.svg"), "utf8"))); await until("the SVG toast", async () => /SVG 1:1/.test(await toast()));
    saveTo = out("p.pdf"); await js("drafterDebug().run('pdfExportDialog', { x: 300, y: 120 }); document.getElementById('dlg-ok').click(); 0");
    await until("p.pdf", () => fs.existsSync(out("p.pdf")) && fs.statSync(out("p.pdf")).size > 1000, 15000);
    const pdf = fs.readFileSync(out("p.pdf")).toString("latin1"), box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf);
    assert.ok(pdf.startsWith("%PDF-") && box, "a PDF with a page");
    const job = await js("(() => { const j = drafterDebug().run('pdfJob', { ...drafterDebug().S.pdfSet }); return [j.plan.pw, j.plan.ph]; })()");
    assert.ok(Math.abs(+box[1] - job[0]/25.4*72) < 1 && Math.abs(+box[2] - job[1]/25.4*72) < 1, "the page is the patterns' size: " + box.slice(1) + " pt for " + job + " mm");
    await until("the PDF toast", async () => /^Saved p\.pdf \(/.test(await toast()));
    saveTo = out("bom.xml"); await js("drafterDebug().run('exportBOM'); 0"); await until("bom.xml", () => fs.existsSync(out("bom.xml")));
    // (Round desk-2) the BOM's toast comes a moment after its file: waited for, so that it is not taken for the cancelled SVG's
    await until("the BOM toast", async () => /^BOM written as XML/.test(await toast()));
    saveTo = null; await js("document.getElementById('toast').textContent = ''; document.getElementById('ex-svg').click(); 0"); await sleep(400);
    assert.strictEqual(await toast(), "", "cancelled: no toast"); assert.deepStrictEqual(fs.readdirSync(path.join(tmp, "out")).filter(n => /\.svg$/.test(n)), ["p.svg"]);
  });
  // (Round r17b / 4) File ▸ Snapshot: a 2D snapshot as PNG and as PDF, and a 3D snapshot, each written where the user chooses
  await check3d("the 2D snapshot as a PNG at its size and as a real PDF at the patterns' true size, and the 3D snapshot as a PNG, written where the user chooses", async () => {
    saveTo = out("snap.png"); await js("(() => { const d = drafterDebug(), o = d.run('snap2Default'); o.fmt = 'png'; d.run('snap2Save', o); return 0; })()");
    await until("snap.png", () => fs.existsSync(out("snap.png")) && fs.statSync(out("snap.png")).size > 100, 15000);
    const b = fs.readFileSync(out("snap.png")), want = await js("(() => { const d = drafterDebug(), j = d.run('snap2Job', d.run('snap2Default')); return [j.wpx, j.hpx]; })()");
    assert.deepStrictEqual([b.toString("latin1", 1, 4), b.readUInt32BE(16), b.readUInt32BE(20)], ["PNG", ...want]);
    saveTo = out("snap.pdf"); await js("(() => { const d = drafterDebug(), o = d.run('snap2Default'); o.fmt = 'pdf'; d.run('snap2Save', o); return 0; })()");
    await until("snap.pdf", () => fs.existsSync(out("snap.pdf")) && fs.statSync(out("snap.pdf")).size > 1000, 15000);
    const pdf = fs.readFileSync(out("snap.pdf")).toString("latin1"), box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf);
    const mm = await js("(() => { const d = drafterDebug(), j = d.run('snap2Job', d.run('snap2Default')); return [j.wmm, j.hmm]; })()");
    assert.ok(pdf.startsWith("%PDF-") && box && Math.abs(+box[1] - mm[0]/25.4*72) < 1.5, "a page of the patterns' true size: " + (box && box.slice(1)) + " pt for " + mm + " mm");
    await js("drafterDebug().setLayout('both'); 0"); await sleep(300);
    saveTo = out("snap3.png"); await js("(() => { const d = drafterDebug(); d.run('snap3Save', { ...d.run('snap3Default'), w: 300, h: 400 }); return 0; })()");
    await until("snap3.png", () => fs.existsSync(out("snap3.png")) && fs.statSync(out("snap3.png")).size > 100, 15000);
    const c = fs.readFileSync(out("snap3.png"));
    assert.deepStrictEqual([c.readUInt32BE(16), c.readUInt32BE(20)], [300, 400]);
  });
  await check3d("every app shortcut reaches the app: Ctrl+K / Ctrl+H / Ctrl+J on the selected pattern in 3D, Ctrl+Shift+C (Clone as Pattern, not the inspector of the developer tools), P (Zipper), Ctrl+C / Ctrl+V", async () => {
    await js("drafterDebug().setLayout('both'); 0"); await sleep(250);
    const over = async (sel) => { const p = await js("(() => { const b = document.querySelector(" + JSON.stringify(sel) + ").getBoundingClientRect(); return [Math.round(b.left + b.width*0.3), Math.round(b.top + b.height*0.3)]; })()"); wc.sendInputEvent({ type: "mouseMove", x: p[0], y: p[1] }); await sleep(80); return p; };
    await js("(() => { const d = drafterDebug(); d.setTool('edit_pattern'); d.S.sel = [d.S.pieces[0].id]; return 0; })()");
    await over("#stage3d canvas");
    const st = () => js("(() => { const p = drafterDebug().S.pieces[0]; return [!!p.freeze3, !!p.strong3, p.off3 || null]; })()");
    await key("K", "control"); assert.deepStrictEqual(await st(), [true, false, null], "Ctrl+K: Freeze");
    await key("H", "control"); assert.deepStrictEqual(await st(), [true, true, null], "Ctrl+H: Strengthen");
    await key("J", "control"); assert.deepStrictEqual(await st(), [true, true, "pattern"], "Ctrl+J: Deactivate (Pattern Only)");
    await key("Z", "control"); await key("Z", "control"); await key("Z", "control");
    assert.deepStrictEqual(await st(), [false, false, null], "three undo steps");
    // Ctrl+Shift+C with a closed internal shape selected: its copy hangs on the pointer (Esc gives it up)
    await js("(() => { const d = drafterDebug(), p = d.S.pieces[0], b = d.run('bboxOf', [p]), cx = (b.x0 + b.x1)/2, cy = (b.y0 + b.y1)/2; d.push('Internal Rectangle'); " +
      "const j = d.run('addChild', p, 'internals', d.run('mkShape', [{ x: cx - 20, y: cy - 20 }, { x: cx + 20, y: cy - 20 }, { x: cx + 20, y: cy + 20 }, { x: cx - 20, y: cy + 20 }], true)); d.commit(); d.S.sel = [p.id]; d.S.selKind = 'internal'; d.S.selInt = j; return 0; })()");
    await over("#c");
    await key("C", "control", "shift");
    assert.strictEqual(await js("!!drafterDebug().S.place"), true, "Clone as Pattern hangs on the pointer"); assert.strictEqual(wc.isDevToolsOpened(), false);
    await key("Escape"); assert.strictEqual(await js("!!drafterDebug().S.place"), false);
    await js("drafterDebug().undo(); 0");
    await key("P"); assert.deepStrictEqual(await js("[drafterDebug().S.tool, drafterDebug().S.tool3]"), ["zipper", "zipper"], "P: the Zipper, in both windows");
    await key("Escape"); await js("drafterDebug().setTool('edit_pattern'); drafterDebug().setTool3('select_move'); 0");
    // the app's own clipboard: a pattern copied and pasted with the keys
    const n0 = await js("drafterDebug().S.pieces.length"), at = await over("#c");
    await js("(() => { const d = drafterDebug(); d.S.sel = [d.S.pieces[0].id]; return 0; })()");
    await key("C", "control"); await key("V", "control");
    await until("the copy on the pointer", () => js("!!drafterDebug().S.place"));
    wc.sendInputEvent({ type: "mouseDown", x: at[0], y: at[1], button: "left", clickCount: 1 }); wc.sendInputEvent({ type: "mouseUp", x: at[0], y: at[1], button: "left", clickCount: 1 });
    await until("the pasted pattern", () => js("drafterDebug().S.pieces.length === " + (n0 + 1)));
    await key("Z", "control"); assert.strictEqual(await js("drafterDebug().S.pieces.length"), n0);
  });
  await check("a file dropped on the window is opened by the page (a .pdraft), and a DXF goes to its import dialog", async () => {
    const drop = (name, b64) => js("(() => { const bin = atob(" + JSON.stringify(b64) + "), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); " +
      "const dt = new DataTransfer(); dt.items.add(new File([u8], " + JSON.stringify(name) + ")); const c = document.getElementById('c'); " +
      "c.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); return c.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); })()");
    const d = docOf(A); d.pieces[0].name = "Dropped";
    const dropped = out("dropped.pdraft"); fs.writeFileSync(dropped, JSON.stringify(d));
    assert.strictEqual(await drop("dropped.pdraft", fs.readFileSync(dropped).toString("base64")), false, "the page took the drop (the browser's own handling was stopped)");
    // (Round desk-2) the dropped file is read first, so the question about unsaved work comes a moment later: waited for
    await until("the question, or the dropped document", () => js("!!document.getElementById('modal') || drafterDebug().S.pieces[0].name === 'Dropped'"));
    await answerUnsaved();
    await until("the dropped document", () => js("drafterDebug().S.pieces[0].name === 'Dropped'"));
    assert.ok(wc.getURL().endsWith("pattern-drafter.html"));
    await drop("p.dxf", fs.readFileSync(out("p.dxf")).toString("base64"));
    await until("the DXF import dialog", () => js("document.getElementById('dlg').style.display === 'block' && /DXF/.test(document.getElementById('dlg').textContent)"));
    await js("document.getElementById('dlg-x').click(); 0");
  });
  await check("Save to Library keeps the pattern in the data folder (not a browser's storage), and writes its file where the user chooses", async () => {
    saveTo = out("lib.pdraft");
    await js("drafterDebug().run('saveToLibrary', 'Desk smoke'); 0");
    await until("lib.pdraft", () => fs.existsSync(out("lib.pdraft")));
    const lib = JSON.parse(fs.readFileSync(path.join(data, "store", "library.json"), "utf8"));
    assert.deepStrictEqual(lib.map(x => x.name), ["Desk smoke"]);
    assert.ok(/^Saved to the library as Desk smoke/.test(await toast()), await toast());
    assert.strictEqual((await js("drafterDebug().run('libraryDialog')")).mine, 1); await js("drafterDebug().run('hideDlg'); 0");
  });
  await check("Help ▸ Send Feedback puts the bug information on the system clipboard, says so, and opens the feedback link of config.js", async () => {
    await clipboard.writeText("before");
    await js("[...document.querySelectorAll('#menubar .mb')].find(b => b.textContent.trim() === 'Help').click(); 0");
    await js("[...document.querySelectorAll('#menu .mi')].find(m => /^Send Feedback/.test(m.textContent)).click(); 0");
    // (Round r24 follow-up) config.js has no feedback link until the project has an address of its own: nothing opened, the box says so
    const link = require("../drafter/config.js").feedbackUrl;
    if (link) { await until("the link", () => opened.length === 1); assert.strictEqual(opened[0], link); }
    else { await until("the box", () => js("!!document.querySelector('#modal .mtext')")); assert.ok(/No feedback link is set/.test(await js("document.querySelector('#modal .mtext').textContent")) && opened.length === 0); }
    const clip = await clipboard.readText();      // (a promise in this Electron, a string in older ones)
    assert.ok(new RegExp("^Gusset: bug information\\nVersion: " + VERSION.replace(/\./g, "\\.") + " \\(desktop app, " + (BUILT ? "built \\d{4}-\\d\\d-\\d\\d from ([0-9a-f]+(-dirty)?|source)" : "run from source") + "\\)\\nSystem: [^\\n]+, " + process.arch + "; Electron [\\d.]+, Chromium [\\d.]+\\nScreen: \\d+ × \\d+ at \\d+ %").test(clip), clip);
    assert.ok(!/Front bodice|pdraft-smoke/.test(clip), "nothing of the document or its file");
    const m = await js("[document.querySelector('#modal .dt').textContent, /on the clipboard/.test(document.querySelector('#modal .mtext').textContent)]");
    assert.deepStrictEqual(m, ["Send Feedback", true]);
    await js("document.querySelector('#modal .btn.pri').click(); 0");
  });
  await check("Help ▸ Save Bug Report… writes the text where the user chooses and, ticked, a copy of the open document beside it", async () => {
    saveTo = out("bug.txt");
    await js("drafterDebug().run('saveBugReport'); [...document.querySelectorAll('#modal .btn')].find(b => /^Save/.test(b.textContent)).click(); 0");
    await until("bug.txt and the copy", () => fs.existsSync(out("bug.txt")) && fs.existsSync(out("bug (document).pdraft")));
    assert.ok(/^Gusset: bug information/.test(fs.readFileSync(out("bug.txt"), "utf8")));
    assert.strictEqual(fs.readFileSync(out("bug (document).pdraft")).toString("latin1", 0, 2), "PK");
    assert.strictEqual(docOf(out("bug (document).pdraft")).pieces[0].name, "Dropped");
  });
  await check3d("File ▸ Open Example: the skirt on Marty opens sewn and placed, Marty comes with it, Simulate drapes it in the worker; Save As and Open bring the drape back", async () => {
    await js("drafterDebug().run('openExample', drafterDebug().run('shippedExamples')[0]); 0"); await answerUnsaved();
    await until("Marty and the skirt", () => js("(() => { const d = drafterDebug(); return d.S.av && d.S.av.name === 'Marty' && d.G3.items.size === 4; })()"), 30000);
    assert.deepStrictEqual(await js("[drafterDebug().S.pieces.map(p => p.name), drafterDebug().S.seams.length, drafterDebug().S.ui.layout]"), [["Skirt front", "Skirt back", "Skirt back (mirror)", "Skirt waistband"], 12, "both"]);      // (Round r17a / 4: 12 seams, the waistband closed)
    await js("drafterDebug().simStart(); 0");
    await until("frames from the worker", () => js("drafterDebug().SIM.tick > 40"), 30000);
    await js("drafterDebug().simStop(); 0"); await sleep(300);
    assert.strictEqual(await js("[...drafterDebug().G3.items.values()].every(it => it.draped)"), true);
    saveTo = out("skirt.pdraft"); await key("S", "control", "shift");
    await until("skirt.pdraft", () => fs.existsSync(out("skirt.pdraft")));
    assert.ok(partsOf(out("skirt.pdraft"))["drape.bin"], "the drape is in the file");
    await js("drafterDebug().run('newDoc', true); 0");
    await openVia(out("skirt.pdraft"));
    assert.strictEqual(await js("[...drafterDebug().G3.items.values()].filter(it => it.draped).length"), 4, "opened with its drape");
    await openVia(B);
    // unsaved work, for the recovery check at the end
    await js("(() => { const d = drafterDebug(); d.push('Rename'); d.S.pieces[0].name = 'From B, renamed'; d.commit(); return 0; })()");
    await until("the autosave", () => fs.existsSync(autosave));
  });
  await check("a .zprj is read in a worker made from the importer's own text, and its patterns come into the document with a report", async () => {
    // a small project file made here from the documented layout (no real one is needed)
    const MK = require("../drafter/tests/zprj-make.js");
    const sq = { name: "Pattern_1", annotation: "Smoke square", points: [[-250, -250], [250, -250], [250, 250], [-250, 250]], lines: [0, 1, 2, 3].map(k => ({ start: k, end: (k + 1) % 4, sa: [10, 10] })) };
    const curved = { name: "Pattern_2", points: [[0, 0], [300, 0], [300, 200]], lines: [{ start: 0, end: 1, cps: [[150, -40]] }, { start: 1, end: 2 }, { start: 2, end: 0 }] };
    const b64 = MK.zprj([sq, curved]).toString("base64");
    await js("window.__z = null; (() => { const d = drafterDebug(), bin = atob('" + b64 + "'), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);" +
      " d.run('zprjRead', u8.buffer, (err, res) => { window.__z = { err: err && err.code, n: res && res.pieces.length, worker: !!d.run('zprjWorker'), res }; }); })(); 0");
    await until("the worker's answer", () => js("!!window.__z"), 10000);
    const z = await js("({ err: window.__z.err, n: window.__z.n, worker: window.__z.worker })");
    assert.deepStrictEqual(z, { err: null, n: 2, worker: true }, "read off the page's thread");
    const before = await js("drafterDebug().S.pieces.length");
    const got = await js("(() => { const d = drafterDebug(), rep = d.run('zprjTake', 'smoke.zprj', window.__z.res, {}); const m = document.getElementById('modal'); const t = m ? m.textContent : ''; if (m) m.querySelector('.btn').click(); return { rep, t, names: d.S.pieces.slice(-2).map(p => p.name), sa: d.S.pieces[d.S.pieces.length - 2].segs.map(s => s.sa), cps: d.S.pieces[d.S.pieces.length - 1].segs[0].cps.length, gone: !document.getElementById('modal') }; })()");
    assert.strictEqual(got.rep.patterns, 2); assert.deepStrictEqual(got.names, ["Smoke square", "Pattern_2"]); assert.deepStrictEqual(got.sa, [10, 10, 10, 10]); assert.strictEqual(got.cps, 1);
    assert.ok(/Imported smoke\.zprj/.test(got.t) && /2 patterns/.test(got.t) && /Not imported: /.test(got.t), got.t); assert.strictEqual(got.gone, true, "OK closes the report");
    assert.strictEqual(await js("drafterDebug().S.pieces.length"), before + 2);
    // the options dialog: what the file holds, each part with a tick; OK takes it
    const dlg = await js("(() => { const d = drafterDebug(); d.run('zprjAsk', 'again.zprj', window.__z.res); const el = document.getElementById('dlg'); return { shown: el.style.display, text: el.textContent, ticks: [...el.querySelectorAll('input[type=checkbox]')].map(c => c.checked) }; })()");
    assert.strictEqual(dlg.shown, "block"); assert.deepStrictEqual(dlg.ticks, [true, true, true, true, true]);
    assert.ok(/Import project \(\.zprj, \.zpac\)/.test(dlg.text) && /2 patterns/.test(dlg.text) && /Seam allowance \(4 lines\)/.test(dlg.text) && /Reference lines \(0\), hidden/.test(dlg.text), dlg.text);
    const took = await js("(() => { document.querySelector('#dlg-ok').click(); const m = document.getElementById('modal'), t = m ? m.textContent : ''; if (m) m.querySelector('.btn').click(); return { t, n: drafterDebug().S.pieces.length }; })()");
    assert.ok(/Imported again\.zprj/.test(took.t), took.t); assert.strictEqual(took.n, before + 4, "appended beside the first import");
    await js("drafterDebug().undo(); 0");
    // an encrypted file is refused by the worker with its reason
    const locked = MK.zprj([sq], { encrypted: "pac" }).toString("base64");
    await js("window.__z = null; (() => { const d = drafterDebug(), bin = atob('" + locked + "'), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);" +
      " d.run('zprjRead', u8.buffer, (err, res) => { window.__z = { err: err && err.code, msg: err && err.message }; }); })(); 0");
    await until("the refusal", () => js("!!window.__z"), 10000);
    assert.strictEqual(await js("window.__z.err"), "encrypted");
    await js("drafterDebug().undo(); 0");
  });
  await check("Print: system dialog at 100 %, no margins, the sheet the plan was made for; the page is true size", async () => {
    await js("document.getElementById('pr-open').click(); document.querySelector('#dlg select[data-p=paper]').value = 'a4'; document.getElementById('pr-go').click()");
    const p = await until("the print job", () => printed);
    assert.deepStrictEqual(p.opts, { silent: false, printBackground: true, scaleFactor: 100, margins: { marginType: "none" }, landscape: false, pageSize: { width: 210000, height: 297000 } });
    // the PDF Chromium makes from the same pages: every sheet is A4 to the point (1 pt = 1/72 in)
    const boxes = [...p.pdf.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(m => [+m[1], +m[2]]);
    const sheets = (p.html.match(/<svg /g) || []).length;
    assert.ok(sheets >= 2, "the starter pattern takes several A4 sheets");
    assert.strictEqual(boxes.length, sheets, "one printed page per sheet: " + boxes.length + " for " + sheets);
    for (const b of boxes) assert.ok(Math.abs(b[0] - 210/25.4*72) < 0.5 && Math.abs(b[1] - 297/25.4*72) < 0.5, "page is " + b.join(" × ") + " pt");
    // and laid out by Chromium, the 50 mm check line measures 50 mm (96 CSS px = 1 in)
    const f = path.join(tmp, "print.html"); fs.writeFileSync(f, p.html);
    const w = new BrowserWindow({ show: false }); await w.loadFile(f);
    const m = await w.webContents.executeJavaScript(`(() => {
      const mm = (px) => px/96*25.4, pg = document.querySelector("svg.page").getBoundingClientRect();
      const line = [...document.querySelectorAll("svg.page > path")].find(x => / h 50 m 0 -2 v 4 /.test(x.getAttribute("d"))).getBoundingClientRect();
      return [mm(pg.width), mm(pg.height), mm(line.width), document.querySelectorAll("svg.page").length];
    })()`);
    w.destroy();
    assert.ok(Math.abs(m[0] - 210) < 0.01 && Math.abs(m[1] - 297) < 0.01, "sheet is " + m[0] + " × " + m[1] + " mm");
    assert.ok(Math.abs(m[2] - 50) < 0.01, "check line is " + m[2] + " mm");
  });
  await check3d("started again with work unsaved and the 3D window open: it asks to recover, Recover brings the work and its file back, and the 3D window is drawn at once", async () => {
    await js("localStorage.setItem('pdraft:ui', JSON.stringify({ layout: 'both' })); 0");
    const unsaved = JSON.parse(fs.readFileSync(autosave, "utf8")).pieces.length;
    wc.reload();
    await until("the 3D window", () => js("typeof drafterDebug === 'function' && drafterDebug().view3d.ready()").catch(() => false));
    assert.deepStrictEqual(await js("[drafterDebug().S.pieces.length, document.querySelector('#modal .dt').textContent, [...document.querySelectorAll('#modal .btn')].map(b => b.textContent)]"), [0, "Recover unsaved work?", ["Recover", "Discard"]]);
    await js("document.querySelector('#modal .btn.pri').click(); 0");
    assert.deepStrictEqual(await js("[drafterDebug().S.pieces.length, !!document.getElementById('modal'), document.getElementById('s-save').textContent]"), [unsaved, false, "AUTOSAVED"]);
    assert.ok(win.getTitle().startsWith("b.json"), "the file it belongs to: " + win.getTitle());
    const c = await js("(() => { const c = document.querySelector('#stage3d canvas'); return c ? [c.clientWidth, c.clientHeight, c.width] : null; })()");
    assert.ok(c && c[0] > 100 && c[1] > 100 && c[2] > 100, "the 3D canvas has a size: " + c);
    assert.ok(!/needs vendor/.test(await js("document.getElementById('note3d').textContent")));
  });
  await check("started again with nothing unsaved: no question and no welcome box, which was switched off at the first start", async () => {
    await js("drafterDebug().run('markClean'); 0");
    await until("the autosave to go", () => !fs.existsSync(autosave));
    wc.reload();
    await until("the page", () => js("typeof drafterDebug === 'function' && drafterDebug().S.ui && 1").catch(() => false));
    await sleep(800);
    assert.deepStrictEqual(await js("[!!document.getElementById('modal'), localStorage.getItem('pdraft:welcome'), drafterDebug().S.pieces.length]"), [false, "off", 0]);
  });
}

setTimeout(() => { console.log(checks.join("\n") + "\n  FAIL timed out"); app.exit(1); }, 400000*SLOW);
// the page's window (Round r24: the splash's window comes first)
let started = false;
app.on("browser-window-created", (e, win) => win.webContents.once("did-finish-load", async () => {
  if (started || !win.webContents.getURL().includes("pattern-drafter.html")) return;
  started = true;
  try { await sleep(300); await run(win); } catch (err) { checks.push("  FAIL " + err.stack); process.exitCode = 1; }
  console.log(checks.join("\n"));
  const bad = checks.filter(c => c.startsWith("  FAIL")).length;
  const skipped = checks.filter(c => c.startsWith("  --")).length;
  console.log("\n" + (checks.length - bad - skipped) + " passed, " + bad + " failed" + (skipped ? ", " + skipped + " not checked (no WebGL on this machine)" : ""));
  if (!given) try { TD.remove(tmp); } catch (e) { console.log("The check's own data folder is left in the temp folder: " + e.message); }
  app.exit(bad ? 1 : 0);
}));
/* (Round desk-2) PDRAFT_SMOKE_APP = a built app's resources folder (the one with app.asar and drafter/): the checks run on
   the very files the build packed (its main.js, preload.js and package.json from app.asar, the page beside it), with this
   Electron. Otherwise on the source. */
if (BUILT) console.log("Checking the built app's files in " + BUILT);
require(BUILT ? path.join(BUILT, "app.asar", "main.js") : "./main.js");
