// (Round rename-1) The program was called "2D Pattern Drafter" until 24 Oct 2026, and Electron keeps an app's data in a
// folder named after it: %APPDATA%\2D Pattern Drafter (Windows), ~/Library/Application Support/2D Pattern Drafter (macOS),
// ~/.config/2D Pattern Drafter (Linux). Gusset's is %APPDATA%\Gusset and so on. On the first start, when Gusset's folder
// holds nothing of its own and the old one is there, what the old one holds of ours is COPIED over: the settings
// (Chromium's "Local Storage", where the page keeps its view, preferences, print and window settings), the page's own store
// (store/: the library, the flags), the recent files, the avatars picked before, and the autosaves. The old folder is only
// ever read: nothing in it is written, moved or deleted, and nothing of Chromium's own (caches, the GPU's) is copied.
//   run({ data, old })   data: Gusset's folder, old: the old one. Returns { state, copied, notice }; state is
//                        "done" (copied just now; notice is the line to show), "none" (nothing to bring), "skipped" (Gusset's
//                        folder already had data of its own), "already" (it ran before), "refused" (the two folders overlap)
//   oldAppOpen(old)      whether the old app is running on that folder (its settings cannot be copied whole while it writes)
// A marker, migration.json in Gusset's folder, makes it run once. It says "copying" while the copy is under way, so a copy
// cut short (a crash, the power) is finished at the next start: what is already there whole is not copied again, every file
// lands whole (copied beside its place, then renamed). Nothing in Gusset's folder is ever written over.
// This file, and the tests on it, are the only released files that may name the old program (release check rule 13).
"use strict";
const fs = require("fs");
const path = require("path");

const OLD_NAME = "2D Pattern Drafter";
const NOTICE = "Settings from " + OLD_NAME + " were brought over.";
const MARK = "migration.json";
// what is ours in a data folder (desktop/main.js): files at the top, and two folders
const OURS_FILE = /^(autosave([.][\w.-]+)?|recent|avatars)\.json$/i, OURS_DIR = ["store", "Local Storage"];
// in a folder that is copied: Chromium's lock on its database, never copied (it belongs to the app that holds it)
const SKIP = /^LOCK$/;

const norm = (p) => { const r = path.resolve(p); return process.platform === "linux" ? r : r.toLowerCase(); };
const inside = (dir, p) => { const rel = path.relative(norm(dir), norm(p)); return !rel.startsWith("..") && !path.isAbsolute(rel); };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const readMark = (data) => { try { return JSON.parse(fs.readFileSync(path.join(data, MARK), "utf8")); } catch (e) { return null; } };

// the names at the top of a data folder that are ours (files and folders), in a fixed order
function oursIn(dir) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return []; }
  return names.filter(e => (e.isFile() && OURS_FILE.test(e.name)) || (e.isDirectory() && OURS_DIR.includes(e.name))).map(e => e.name).sort();
}
// Gusset's folder has data of its own: any of ours (an empty store/ does not count)
function hasData(data) {
  return oursIn(data).some(n => n !== "store" || fs.readdirSync(path.join(data, n)).length > 0);
}

// whether the old app is running on its folder: Chromium's one-window lock. On Windows a "lockfile" the running app holds
// (deleted when it ends, a crash too); elsewhere a "SingletonLock" link "<host>-<pid>" to a process that is still alive
function oldAppOpen(old) {
  if (process.platform === "win32") return fs.existsSync(path.join(old, "lockfile"));
  let to = null;
  try { to = fs.readlinkSync(path.join(old, "SingletonLock")); } catch (e) { return false; }
  const m = /-(\d+)$/.exec(to);
  if (!m || to.slice(0, -m[0].length) !== require("os").hostname()) return false;
  try { process.kill(+m[1], 0); return true; } catch (e) { return e.code === "EPERM"; }
}

function run(opts) {
  const data = path.resolve(opts.data), old = opts.old ? path.resolve(opts.old) : null;
  // every write goes through here: only ever into Gusset's folder
  const write = (file, text) => {
    if (!inside(data, file)) throw new Error("refused to write outside " + data + ": " + file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + ".part", text); fs.renameSync(file + ".part", file);
  };
  const mark = readMark(data), put = (o) => write(path.join(data, MARK), JSON.stringify({ ...o, at: new Date().toISOString() }, null, 1));
  if (mark && mark.state !== "copying") return { state: "already", copied: [] };
  if (!old || !isDir(old)) { put({ state: "none" }); return { state: "none", copied: [] }; }
  if (inside(old, data) || inside(data, old)) return { state: "refused", copied: [] };
  const items = oursIn(old);
  if (!mark) {
    if (hasData(data)) { put({ state: "skipped", from: old }); return { state: "skipped", copied: [] }; }
    if (!items.length) { put({ state: "none", from: old }); return { state: "none", copied: [] }; }
  }
  put({ state: "copying", from: old });
  // a file is copied only where there is none yet (a file already there is whole: each lands by a rename); links are not followed
  const copy = (src, dst) => {
    const st = fs.lstatSync(src);
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      for (const n of fs.readdirSync(src).sort()) if (!SKIP.test(n)) copy(path.join(src, n), path.join(dst, n));
      return;
    }
    if (!st.isFile() || fs.existsSync(dst)) return;
    if (!inside(data, dst)) throw new Error("refused to write outside " + data + ": " + dst);
    fs.copyFileSync(src, dst + ".part"); fs.renameSync(dst + ".part", dst);
  };
  for (const n of items) copy(path.join(old, n), path.join(data, n));
  put({ state: "done", from: old, copied: items });
  return { state: "done", copied: items, notice: NOTICE };
}

// whether run() would copy anything: no marker yet (or a copy cut short), the old folder there with something of ours in it,
// and Gusset's folder without data of its own (unless a copy was cut short)
function due(data, old) {
  const mark = readMark(path.resolve(data));
  if (!old || (mark && mark.state !== "copying") || !isDir(old) || !oursIn(old).length) return false;
  return !!mark || !hasData(data);
}
// the user chose to start without what the old folder holds: never asked again
function decline(data) {
  const f = path.join(path.resolve(data), MARK);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f + ".part", JSON.stringify({ state: "declined", at: new Date().toISOString() }, null, 1)); fs.renameSync(f + ".part", f);
}

module.exports = { run, due, decline, oldAppOpen, hasData, OLD_NAME, NOTICE, MARK };
