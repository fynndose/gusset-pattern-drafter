// Round rename-1: the program is called Gusset. The desktop app's data folder is named after the program, so its old one
// (desktop/migrate.js: OLD_NAME) is copied over once, never moved or deleted; files written under the old name still open,
// and what is written now says Gusset. Every folder here is a fresh one in the system's temp folder (desktop/test-data.js),
// passed to migrate.js as the old and the new folder: no test looks into the user's own.
// This file and desktop/migrate.js are the only released files that may name the old program (release check rule 13).
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const M = require("../../desktop/migrate.js"), TD = require("../../desktop/test-data.js");
const OLD = "2D Pattern Drafter";
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const f = path.join(os.tmpdir(), "pdraft-rename-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}

// a folder of files from { "rel/path": text }
function put(dir, files) { for (const [rel, text] of Object.entries(files)) { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); } }
// every file under dir: { rel: [text, mtime] }, to show a folder was left exactly as it was
function snap(dir) {
  const out = {}, walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else out[path.relative(dir, f).split(path.sep).join("/")] = [fs.readFileSync(f, "utf8"), fs.statSync(f).mtimeMs]; } };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}
const files = (dir) => Object.keys(snap(dir)).sort();
// an old data folder as the old app left it: ours (autosaves, recent files, avatars, the page's store, Chromium's Local Storage
// with its lock) and Chromium's own (caches, preferences), which are not copied
const OLD_FILES = {
  "autosave.json": '{"v":20,"doc":"unsaved work"}', "autosave.unreadable.1729000000000.json": "half a file",
  "recent.json": '["C:\\\\patterns\\\\skirt.pdraft"]', "avatars.json": '["C:\\\\avatars\\\\me.glb"]',
  "store/library.json": '[{"name":"my block"}]', "store/flags.json": '{"later":true}',
  "Local Storage/leveldb/CURRENT": "MANIFEST-000001\n", "Local Storage/leveldb/MANIFEST-000001": "manifest", "Local Storage/leveldb/000003.log": "pdraft:prefs pdraft:ui pdraft:view",
  "Local Storage/leveldb/LOCK": "", "GPUCache/data_0": "cache", "Preferences": "{}", "Code Cache/js/index": "x",
};
const BROUGHT = ["Local Storage/leveldb/000003.log", "Local Storage/leveldb/CURRENT", "Local Storage/leveldb/MANIFEST-000001", "autosave.json", "autosave.unreadable.1729000000000.json",
  "avatars.json", "migration.json", "recent.json", "store/flags.json", "store/library.json"];
function folders(tag) { const f = TD.fresh("rename-" + tag); return { dir: f.dir, data: path.join(f.dir, "Gusset"), old: path.join(f.dir, OLD) }; }

test("rename-1: old folder only: our files are copied over (not Chromium's caches, not its database lock), a marker says so, the line to show names the old program; the old folder is left exactly as it was; a second start does nothing", () => {
  const f = folders("old");
  try {
    put(f.old, OLD_FILES);
    const before = snap(f.old);
    assert.ok(M.due(f.data, f.old), "due: Gusset's folder is not there yet, the old one has ours");
    const r = M.run({ data: f.data, old: f.old });
    assert.deepStrictEqual([r.state, r.notice], ["done", "Settings from " + OLD + " were brought over."]);
    assert.deepStrictEqual(r.copied, ["Local Storage", "autosave.json", "autosave.unreadable.1729000000000.json", "avatars.json", "recent.json", "store"]);
    assert.deepStrictEqual(files(f.data), BROUGHT);
    for (const k of BROUGHT.filter(x => x !== "migration.json")) assert.strictEqual(fs.readFileSync(path.join(f.data, k), "utf8"), OLD_FILES[k], k + " copied whole");
    const mark = JSON.parse(fs.readFileSync(path.join(f.data, "migration.json"), "utf8"));
    assert.deepStrictEqual([mark.state, path.resolve(mark.from)], ["done", path.resolve(f.old)]);
    assert.deepStrictEqual(snap(f.old), before, "nothing in the old folder was written, moved or deleted");
    // the second start: nothing again, nothing to show
    fs.writeFileSync(path.join(f.data, "store", "flags.json"), "{}");
    assert.ok(!M.due(f.data, f.old));
    assert.deepStrictEqual(M.run({ data: f.data, old: f.old }), { state: "already", copied: [] });
    assert.strictEqual(fs.readFileSync(path.join(f.data, "store", "flags.json"), "utf8"), "{}", "what Gusset wrote since is not written over");
    assert.deepStrictEqual(snap(f.old), before);
  } finally { TD.remove(f.dir); }
});

test("rename-1: new folder only (no old folder): nothing is copied, nothing to show, a marker so it is not looked for again", () => {
  const f = folders("new");
  try {
    put(f.data, { "store/ui.json": "{}", "recent.json": "[]" });
    assert.ok(!M.due(f.data, f.old));
    const r = M.run({ data: f.data, old: f.old });
    assert.deepStrictEqual([r.state, r.notice], ["none", undefined]);
    assert.deepStrictEqual(files(f.data), ["migration.json", "recent.json", "store/ui.json"]);
    assert.ok(!fs.existsSync(f.old), "the old folder is not made");
    assert.strictEqual(M.run({ data: f.data, old: f.old }).state, "already");
  } finally { TD.remove(f.dir); }
});

test("rename-1: both folders (Gusset's already has data of its own): nothing is copied over it, both are left as they were", () => {
  const f = folders("both");
  try {
    put(f.old, OLD_FILES); put(f.data, { "recent.json": '["D:\\\\new.pdraft"]' });
    const was = [snap(f.old), snap(f.data)];
    assert.ok(!M.due(f.data, f.old));
    assert.deepStrictEqual(M.run({ data: f.data, old: f.old }), { state: "skipped", copied: [] });
    assert.deepStrictEqual(snap(f.old), was[0]);
    assert.deepStrictEqual(files(f.data), ["migration.json", "recent.json"]);
    assert.strictEqual(fs.readFileSync(path.join(f.data, "recent.json"), "utf8"), '["D:\\\\new.pdraft"]');
    // an empty store/ (as a start might leave it) is no data of its own
    const g = folders("both-empty");
    try {
      put(g.old, OLD_FILES); fs.mkdirSync(path.join(g.data, "store"), { recursive: true });
      assert.ok(M.due(g.data, g.old)); assert.strictEqual(M.run({ data: g.data, old: g.old }).state, "done");
    } finally { TD.remove(g.dir); }
  } finally { TD.remove(f.dir); }
});

test("rename-1: neither folder: nothing to bring, nothing to show; an old folder with nothing of ours in it is the same", () => {
  const f = folders("neither");
  try {
    assert.ok(!M.due(f.data, f.old));
    assert.deepStrictEqual(M.run({ data: f.data, old: f.old }), { state: "none", copied: [] });
    assert.deepStrictEqual(files(f.data), ["migration.json"]);
    const g = folders("neither-junk");
    try {
      put(g.old, { "GPUCache/data_0": "cache", "Preferences": "{}" });
      assert.ok(!M.due(g.data, g.old));
      assert.strictEqual(M.run({ data: g.data, old: g.old }).state, "none");
      assert.deepStrictEqual(files(g.data), ["migration.json"]);
    } finally { TD.remove(g.dir); }
  } finally { TD.remove(f.dir); }
});

test("rename-1: a copy cut short (the marker says copying, some files there, a half-written .part): the next start finishes it; files already there are not copied again", () => {
  const f = folders("partial");
  try {
    put(f.old, OLD_FILES);
    put(f.data, { "migration.json": JSON.stringify({ state: "copying", from: f.old }), "autosave.json": "landed whole before the crash", "store/library.json": OLD_FILES["store/library.json"],
      "recent.json.part": "half" });
    assert.ok(M.due(f.data, f.old), "a copy cut short is due even though the folder has data");
    const r = M.run({ data: f.data, old: f.old });
    assert.deepStrictEqual([r.state, r.notice], ["done", "Settings from " + OLD + " were brought over."]);
    assert.deepStrictEqual(files(f.data), BROUGHT, "every file there, no .part left");
    assert.strictEqual(fs.readFileSync(path.join(f.data, "autosave.json"), "utf8"), "landed whole before the crash", "not written over");
    assert.strictEqual(fs.readFileSync(path.join(f.data, "recent.json"), "utf8"), OLD_FILES["recent.json"]);
  } finally { TD.remove(f.dir); }
});

test("rename-1: Start Without Them is final; folders inside each other are refused; the old app's lock is seen (Windows: its lockfile; elsewhere: a SingletonLock link to a live process)", () => {
  const f = folders("lock");
  try {
    put(f.old, OLD_FILES);
    M.decline(f.data);
    assert.ok(!M.due(f.data, f.old));
    assert.strictEqual(M.run({ data: f.data, old: f.old }).state, "already");
    assert.deepStrictEqual(files(f.data), ["migration.json"]);
    // a data folder inside the old one (or the same folder) is refused, nothing written
    const inner = path.join(f.old, "Gusset"), before = snap(f.old);
    assert.deepStrictEqual(M.run({ data: inner, old: f.old }), { state: "refused", copied: [] });
    assert.deepStrictEqual(M.run({ data: f.old, old: f.old }).state, "refused");
    assert.deepStrictEqual(snap(f.old), before);
    assert.ok(!M.oldAppOpen(f.old), "no lock: the old app is not running");
    if (process.platform === "win32") put(f.old, { lockfile: "" });
    else fs.symlinkSync(os.hostname() + "-" + process.pid, path.join(f.old, "SingletonLock"));
    assert.ok(M.oldAppOpen(f.old), "the lock of a running app");
    if (process.platform !== "win32") {
      fs.unlinkSync(path.join(f.old, "SingletonLock")); fs.symlinkSync(os.hostname() + "-999999999", path.join(f.old, "SingletonLock"));
      assert.ok(!M.oldAppOpen(f.old), "a lock left by an app that has ended");
    }
  } finally { TD.remove(f.dir); }
});

test("rename-1: the desktop shell copies the old folder before it reads its lists or opens the window, and a check that gives its own data folder never looks into the user's old one", () => {
  const main = fs.readFileSync(path.join(ROOT, "desktop", "main.js"), "utf8");
  // (Round r24: and an app built under another name, the update test's, none either; its follow-up: told by the pinned data
  // folder, which is not Gusset's for such an app, and the old folder lies beside it in the app-data folder or its stand-in)
  assert.ok(/const OLD_DATA = process\.env\.PDRAFT_OLD_USER_DATA \? path\.resolve\(process\.env\.PDRAFT_OLD_USER_DATA\)\s*: process\.env\.PDRAFT_USER_DATA \|\| DATA_FOLDER !== "Gusset" \? null : path\.join\(APPDATA, MIGRATE\.OLD_NAME\);/.test(main),
    "PDRAFT_USER_DATA without PDRAFT_OLD_USER_DATA: no old folder at all");
  const ready = main.slice(main.indexOf("app.whenReady()"));
  assert.ok(ready.indexOf("bringOver();") > 0 && ready.indexOf("bringOver();") < ready.indexOf("loadLists();") && ready.indexOf("loadLists();") < ready.indexOf("createWindow();"));
  assert.ok(!/readFileSync\((RECENT|AVATARS)/.test(main.slice(0, main.indexOf("function loadLists()"))), "the lists are read after the copy, not when the script loads");
  assert.ok(!main.includes(OLD), "the shell names the old program only through migrate.js");
  // migrate.js only reads the old folder: its writes go through the two places that check they land inside the new one
  const mig = fs.readFileSync(path.join(ROOT, "desktop", "migrate.js"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.strictEqual((mig.match(/fs\.(writeFileSync|copyFileSync|renameSync|mkdirSync)\(/g) || []).length, 9);
  assert.ok(!/fs\.(rmSync|unlinkSync|rmdirSync|rename\(|cpSync|appendFileSync)/.test(mig), "no delete, no move out of the old folder");
  for (const s of ["desktop/smoke.js", "scripts/start-built.js"]) assert.ok(!fs.readFileSync(path.join(ROOT, s), "utf8").includes(OLD), s + " does not name the old folder");
});

test("rename-1: files written under the old name still open (version 11 and 12 pattern files, a DXF whose header says the old name); what is written now says Gusset (the DXF's AUTHOR, the bug report)", () => {
  const r = boot({ blank: true, desktop: { info: true }, script: `
    const out = {};
    for (const f of ["files/v11/starter-history.pdraft", "files/v12/skirt-on-the-marty-of-8-oct.pdraft"]) { app.ev("openFile")(f, new Uint8Array(app.read(f)), null, true); out[f] = S.pieces.length; }
    app.ev("newDoc")(true);
    S.pieces.push(app.ev("mkPiece")("Panel", app.ev("mkShape")([{x:0,y:0},{x:300,y:0},{x:300,y:200},{x:0,y:200}], true)));
    const text = app.ev("dxfExport")(S.pieces, { format: "aama", unit: "mm", scale: 1, rotate: 0, straight: false, optimise: true, noBase: false, noGrade: true, dupNotch: false }, S.grading);
    out.author = text.split(/\\r?\\n/).filter(l => /^AUTHOR:/.test(l));
    const opt = { append: false, autoScale: true, scale: 1, angle: 0, swap: false, toSA: true, optimise: true, notches: true, internals: true, annotations: true, distribute: false };
    const back = (t) => { const b = app.ev("dxfImport")(t, opt); return b && b.pieces ? b.pieces.map(p => [p.name, p.pts.length]) : null; };
    out.now = back(text); out.old = back(text.split("AUTHOR: Gusset").join("AUTHOR: ${OLD}"));
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  assert.ok(r.result["files/v11/starter-history.pdraft"] > 0 && r.result["files/v12/skirt-on-the-marty-of-8-oct.pdraft"] > 0, JSON.stringify(r.result));
  assert.deepStrictEqual(r.result.author, ["AUTHOR: Gusset"]);
  assert.ok(r.result.now && r.result.now.length === 1, JSON.stringify(r.result.now));
  assert.deepStrictEqual(r.result.old, r.result.now, "the old AUTHOR line is skipped as any is");
  const js = fs.readFileSync(path.join(ROOT, "drafter", "pattern-drafter.js"), "utf8");
  assert.ok(js.includes('"Gusset: bug information"') && js.includes('"gusset-bug-"') && !js.includes(OLD));
  assert.ok(!/Pattern Drafter/.test(fs.readFileSync(path.join(ROOT, "drafter", "config.js"), "utf8")), "the feedback mail's subject");
});

module.exports = T;
