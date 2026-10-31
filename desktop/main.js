// Desktop shell for Gusset. It loads the same page the browser
// version uses (drafter/pattern-drafter.html) and gives it, through
// preload.js, what a browser can't: files saved in place, an autosave file,
// a recent-files list, printing through the system dialog at 100 %, exports
// written where the user chooses (a PDF made by the shell itself), the
// clipboard, and the feedback link.
"use strict";
const { app, BrowserWindow, Menu, dialog, ipcMain, clipboard, shell } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
// (Round r24) PDRAFT_STARTUP_LOG=<file>: the moments of the start, in ms since the process began, written there once the page
// has loaded (scripts/startup-time.js reads them). Nothing is kept or written without it
const START_LOG = process.env.PDRAFT_STARTUP_LOG || "", T0 = { main: performance.now() };
const mark = (n) => { if (START_LOG && T0[n] == null) T0[n] = Math.round(performance.now()); };

// (Round r24 follow-up) the program's name in full: the windows' titles, and the product name the real app has (productName)
const APP_NAME = "Gusset – Pattern Drafter";
// (Round r24 follow-up) The data folder is pinned by a name of its own, package.json's "dataFolder" ("Gusset"): %APPDATA%\Gusset
// on Windows, ~/Library/Application Support/Gusset on a Mac, ~/.config/Gusset on Linux, whatever productName and appId are
// (Electron would name it after productName, which is the name in full since this round). The update test's builds have one of
// their own name (build.js, PDRAFT_BUILD_NAME). PDRAFT_APP_DATA: a folder inside the system's temp folder standing in for the
// system's app-data folder, so that a check can start the app as a user does and see which folder it takes and what it finds
// there (scripts/data-folder-test.js); a folder anywhere else is refused and the app does not start.
const PKG = (() => { try { return require("./package.json"); } catch (e) { return {}; } })();
const DATA_FOLDER = String(PKG.dataFolder || app.getName());
const APPDATA = process.env.PDRAFT_APP_DATA ? path.resolve(process.env.PDRAFT_APP_DATA) : app.getPath("appData");
if (process.env.PDRAFT_APP_DATA) {
  // a folder not there yet is judged by what its nearest existing parent really is (the temp folder's path often holds a link)
  const real = (p) => { try { return fs.realpathSync.native(p); } catch (e) { const up = path.dirname(p); return up === p ? p : path.join(real(up), path.basename(p)); } }, low = (p) => process.platform === "win32" ? p.toLowerCase() : p;
  const rel = path.relative(low(real(os.tmpdir())), low(real(APPDATA)));
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) { console.error("PDRAFT_APP_DATA must be a folder inside " + os.tmpdir() + ", not " + APPDATA); process.exit(2); }
  app.setPath("appData", APPDATA);
}
// (Round desk-2) PDRAFT_USER_DATA: a data folder for this run instead of the app's own, set before anything reads it. Every
// check that starts the app passes a fresh one (desktop/test-data.js), so none ever touches the user's; the one-window lock
// (below) is kept in the data folder, so such a run does not hand over to, or stop for, an app the user has open.
if (process.env.PDRAFT_USER_DATA) app.setPath("userData", path.resolve(process.env.PDRAFT_USER_DATA));
else app.setPath("userData", path.join(APPDATA, DATA_FOLDER));
const PAGE = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, ".."), "drafter", "pattern-drafter.html");
const SPLASH = path.join(path.dirname(PAGE), "splash.html");
// the data folder (pinned above): %APPDATA%\Gusset on Windows, ~/Library/Application Support/Gusset on a Mac, ~/.config/Gusset on Linux
const DATA = app.getPath("userData");
// (Round rename-1) the folder the program kept its data in under its old name, whose settings, recent files and autosaves are
// copied over once (desktop/migrate.js; the old folder is only read). PDRAFT_OLD_USER_DATA stands in for it in a check; a
// check that gives PDRAFT_USER_DATA and not this one brings nothing over, so no check ever looks into the user's own
const MIGRATE = require("./migrate.js");
// (Round r24) and an app built under another name (the update check's own test builds, whose data folder is theirs) never looks into it either
const OLD_DATA = process.env.PDRAFT_OLD_USER_DATA ? path.resolve(process.env.PDRAFT_OLD_USER_DATA)
  : process.env.PDRAFT_USER_DATA || DATA_FOLDER !== "Gusset" ? null : path.join(APPDATA, MIGRATE.OLD_NAME);
const RECENT = path.join(DATA, "recent.json");
const MAC = process.platform === "darwin";
// pattern files are .pdraft (since version 12 a ZIP container, before that JSON text); the .json files of earlier versions still open;
// a DXF goes to the DXF import and a project file (.zprj, .zpac) to the project import
const FILTERS = [{ name: "Pattern files", extensions: ["pdraft", "json", "dxf", "zprj", "zpac"] }, { name: "All files", extensions: ["*"] }];
const BINARY = /\.(zprj|zpac)$/i;
let win = null;

/* ---- the build: version, date, commit ----
   The version and the feedback link are the page's own (drafter/config.js, one place for both); the build date and the
   commit are written into the packed package.json by build.js (extraMetadata). Run from source they are not there. */
const META = (() => { try { return require("./package.json"); } catch (e) { return {}; } })();
const CONFIG = (() => {
  let text = "";
  try { text = fs.readFileSync(path.join(path.dirname(PAGE), "config.js"), "utf8"); } catch (e) {}
  const get = (k) => { const m = new RegExp(k + ':\\s*"([^"]*)"').exec(text); return m ? m[1] : ""; };
  return { version: get("version") || META.version || "", feedbackUrl: get("feedbackUrl"), downloadUrl: get("downloadUrl") };
})();
// the system, for a bug report: "Windows 11 (10.0.26200)", "macOS 15.5", "Linux 6.8.0-1017-azure"
function systemName() {
  const r = os.release(), build = +(r.split(".")[2] || 0);
  if (process.platform === "win32") return (build >= 22000 ? "Windows 11" : /^10\./.test(r) ? "Windows 10" : "Windows") + " (" + r + ")";
  if (MAC) return "macOS " + (process.getSystemVersion ? process.getSystemVersion() : r);
  return os.type() + " " + r;
}
const INFO = {
  version: CONFIG.version, build: META.buildDate || "", commit: META.buildCommit || "", packaged: app.isPackaged,
  os: systemName(), arch: process.arch, electron: process.versions.electron, chrome: process.versions.chrome,
};
// the title bar says it is a test version, after whatever the page calls itself; never the version itself (Round r24: that is
// in Help ▸ About, the bug report and the feedback text only)
// (Round r24 follow-up) a test version says so in brackets, as one more dash after the name's own would read badly
const TITLE_TAIL = /beta|alpha|rc/i.test(CONFIG.version) ? " (Beta)" : "";

// written beside the target first, so a crash mid-write can't leave half a file (text, or a pattern file's bytes)
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

/* ---- the page's own storage (kv()): files in the data folder ----
   pdraft:doc -> autosave.json, pdraft:doc.unreadable.<time> -> autosave.unreadable.<time>.json; any other key the page
   keeps there (pdraft:library, pdraft:flags) -> store/<key>.json. Synchronous, like the localStorage it stands in for,
   so the save on closing is not lost. */
function storeFile(key) {
  if (/^pdraft:doc[\w.-]*$/.test(key)) return path.join(DATA, key.replace("pdraft:doc", "autosave") + ".json");
  if (/^pdraft:[a-z][\w-]*$/.test(key)) return path.join(DATA, "store", key.slice(7) + ".json");
  throw new Error("unknown key " + key);
}
ipcMain.on("store", (e, op, key, val) => {
  try {
    const f = storeFile(key);
    if (op === "get") e.returnValue = { value: fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null };
    else if (op === "set") { writeAtomic(f, String(val)); e.returnValue = {}; }
    else if (op === "remove") { fs.rmSync(f, { force: true }); e.returnValue = {}; }
    else e.returnValue = { value: f };
  } catch (err) { e.returnValue = { error: err.message }; }
});

/* ---- files ---- */
// (read once the old folder's have been brought over: loadLists() at the start)
let recent = [];
// the page may only write to files the user picked, opened or was handed
const granted = new Set();
// (file names are told apart by case on Linux only)
const same = (a, b) => (process.platform === "linux" ? a === b : a.toLowerCase() === b.toLowerCase());
function remember(file) {
  granted.add(file);
  recent = [file, ...recent.filter(p => !same(p, file))].slice(0, 10);
  try { writeAtomic(RECENT, JSON.stringify(recent)); } catch (e) {}
  app.addRecentDocument(file);
}
// a version 12 pattern file is handed to the page as its bytes (data), anything else (an older pattern file, a DXF) as text
/* A pattern file of version 11 or older is JSON text; saving it writes version 12 over it, which no earlier build
   can open. So the first time that happens the original is copied to "<name>.v11.pdraft" beside it, without asking.
   Once a file: after the save the file is version 12 and there is nothing to keep. A copy that is already there is
   never written over. Returns the copy's path if one was made just now, otherwise null; throws if the copy could
   not be made (the save is then not done). data: what is about to be written. */
function keepV11(file, data) {
  const zip = (b) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;
  if (!/\.pdraft$/i.test(file) || typeof data === "string" || !zip(data) || !fs.existsSync(file)) return null;
  const fd = fs.openSync(file, "r"), head = Buffer.alloc(4), n = fs.readSync(fd, head, 0, 4, 0);
  fs.closeSync(fd);
  if (n === 0 || zip(head.subarray(0, n))) return null;        // empty, or version 12 already
  const copy = file.replace(/\.pdraft$/i, "") + ".v11.pdraft";
  try { fs.copyFileSync(file, copy, fs.constants.COPYFILE_EXCL); }
  catch (e) { if (e.code === "EEXIST") return null; throw new Error("the original could not be kept as " + path.basename(copy) + " (" + e.message + "), so nothing was saved"); }
  return copy;
}
// a pattern file of version 12 or later and a project file (.zprj, .zpac) as their bytes, anything else as text
function readFile(file) {
  const buf = fs.readFileSync(file);
  remember(file);
  const zip = buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 3 && buf[3] === 4;
  return zip || BINARY.test(file) ? { path: file, name: path.basename(file), data: buf } : { path: file, name: path.basename(file), text: buf.toString("utf8") };
}
ipcMain.handle("file:open", async () => {
  const r = await dialog.showOpenDialog(win, { properties: ["openFile"], filters: FILTERS });
  return r.canceled || !r.filePaths[0] ? null : readFile(r.filePaths[0]);
});
/* The avatar (an .fbx or .glb, tens of megabytes): the page gets its bytes. A file can be
   read again later only if it was picked through the dialog once (avatars.json), or is a
   preset. With nothing remembered the page gets the default preset. */
const AVATARS = path.join(DATA, "avatars.json");
let avatars = [];
function loadLists() {
  try { recent = JSON.parse(fs.readFileSync(RECENT, "utf8")).filter(p => typeof p === "string"); } catch (e) {}
  try { avatars = JSON.parse(fs.readFileSync(AVATARS, "utf8")).filter(p => typeof p === "string"); } catch (e) {}
}
const avatarFile = (file) => ({ path: file, name: path.basename(file), data: fs.readFileSync(file) });
ipcMain.handle("avatar:pick", async () => {
  const r = await dialog.showOpenDialog(win, { properties: ["openFile"], filters: [{ name: "Avatar or pose", extensions: ["fbx", "glb", "gltf"] }, { name: "All files", extensions: ["*"] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  const file = r.filePaths[0];
  avatars = [file, ...avatars.filter(p => p !== file)].slice(0, 20);
  try { writeAtomic(AVATARS, JSON.stringify(avatars)); } catch (e) {}
  return avatarFile(file);
});
/* The presets of the Load Avatar dialog: [card, file] with the file assets/avatar/presets/<file>.glb (or .gltf, .fbx) beside
   the page and an optional picture of the same name for its card: { male: { path, name, thumb } }. The first is the default.
   (The same list as AV_PRESETS in the page; a card that is still to come has no file and is not listed.) */
const PRESETS = path.join(path.dirname(PAGE), "assets", "avatar", "presets"), PRESET_FILES = [["male", "marty"], ["female", "jessica"]];
function presetList() {
  const out = {};
  let names = [];
  try { names = fs.readdirSync(PRESETS); } catch (e) { return out; }
  const pick = (key, exts) => exts.map(x => names.find(n => n.toLowerCase() === key + "." + x)).find(Boolean);
  for (const [key, file] of PRESET_FILES) {
    const model = pick(file, ["glb", "gltf", "fbx"]), pic = pick(file, ["png", "jpg", "jpeg", "webp"]);
    if (!model) continue;
    let thumb = null;
    if (pic) try { const b = fs.readFileSync(path.join(PRESETS, pic)); if (b.length < 4e6) thumb = "data:image/" + path.extname(pic).slice(1).toLowerCase().replace("jpg", "jpeg") + ";base64," + b.toString("base64"); } catch (e) {}
    out[key] = { path: path.join(PRESETS, model), name: model, thumb };
  }
  return out;
}
ipcMain.handle("avatar:presets", () => presetList());
ipcMain.handle("avatar:read", (e, file) => {
  if (!file) return null;                                   // (no avatar is loaded by default: a session starts with none)
  // refused as an answer, not thrown: Electron writes a stack trace to the console for every handler that throws
  if (!avatars.includes(file) && !Object.values(presetList()).some(p => p.path === file)) return { refused: "pick the avatar through Load Avatar once" };
  return avatarFile(file);
});
ipcMain.handle("file:recent", () => (recent = recent.filter(p => fs.existsSync(p))));
ipcMain.handle("file:open-recent", (e, file) => {
  if (!recent.includes(file)) throw new Error("not in the recent files");
  return readFile(file);
});
ipcMain.handle("file:save", (e, file, text) => {
  if (!granted.has(file) && !recent.includes(file)) throw new Error("use Save As to choose where to save");
  const kept = keepV11(file, text);
  writeAtomic(file, text); remember(file);
  return { path: file, name: path.basename(file), kept: kept && path.basename(kept) };
});
ipcMain.handle("file:save-as", async (e, suggested, text) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: suggested, filters: [{ name: "Pattern project", extensions: ["pdraft"] }] });
  if (r.canceled || !r.filePath) return null;
  const kept = keepV11(r.filePath, text);
  writeAtomic(r.filePath, text); remember(r.filePath);
  return { path: r.filePath, name: path.basename(r.filePath), kept: kept && path.basename(kept) };
});

/* ---- exports: DXF, SVG, BOM, tech pack, print files, the bug report: asked where, then written ----
   In a browser these are downloads; here the user picks the place. Resolves to { path, name }, or null if cancelled. */
const KINDS = { dxf: "DXF drawing", svg: "SVG picture", png: "PNG picture", pdf: "PDF document", html: "Web page", xml: "XML file", json: "JSON file", txt: "Text file", pdraft: "Pattern project", plt: "HP-GL plotter file", obj: "OBJ model" };
function askWhere(suggested) {
  const ext = (path.extname(suggested).slice(1) || "").toLowerCase();
  return dialog.showSaveDialog(win, { defaultPath: suggested, filters: [...(ext ? [{ name: KINDS[ext] || ext.toUpperCase() + " file", extensions: [ext] }] : []), { name: "All files", extensions: ["*"] }] })
    .then((r) => (r.canceled || !r.filePath ? null : r.filePath));
}
let lastExport = null;
ipcMain.handle("file:export", async (e, suggested, data) => {
  const file = await askWhere(String(suggested || "export"));
  if (!file) return null;
  writeAtomic(file, typeof data === "string" ? data : Buffer.from(data));
  lastExport = file;
  return { path: file, name: path.basename(file) };
});
// (Round r29) the Render workspace's Show in Saved Folder: the file an export last wrote, no other path
ipcMain.handle("file:show-saved", () => { if (lastExport) shell.showItemInFolder(lastExport); return !!lastExport; });
// the page's print file (sheets sized in mm, an @page rule) made into a PDF of the same size by Chromium's own PDF writer
async function htmlToPdf(html) {
  const file = path.join(app.getPath("temp"), "pdraft-pdf-" + Date.now() + ".html");
  fs.writeFileSync(file, html);
  const w = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
  try {
    await w.loadFile(file);
    return await w.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  } finally { w.destroy(); fs.rmSync(file, { force: true }); }
}
ipcMain.handle("file:pdf", async (e, suggested, html) => {
  const file = await askWhere(String(suggested || "pattern.pdf"));
  if (!file) return null;
  writeAtomic(file, await htmlToPdf(String(html)));
  return { path: file, name: path.basename(file) };
});
/* Help ▸ Save Bug Report…: the text where the user chooses, and (if asked for) a copy of the open document beside it,
   under a name of its own that is never one already there, so no pattern file of the user's is written over. */
ipcMain.handle("file:bug-report", async (e, suggested, text, doc) => {
  const file = await askWhere(String(suggested || "bug-report.txt"));
  if (!file) return null;
  writeAtomic(file, String(text));
  let copy = null;
  if (doc) {
    const base = file.replace(/\.[^.\\/]*$/, "") + " (document)";
    for (let n = 1; !copy; n++) { const c = base + (n > 1 ? " " + n : "") + ".pdraft"; if (!fs.existsSync(c)) copy = c; }
    writeAtomic(copy, Buffer.from(doc));
  }
  return { path: file, name: path.basename(file), copy: copy && path.basename(copy) };
});

/* ---- the clipboard, the build's facts, the feedback link ---- */
ipcMain.handle("clipboard:write", async (e, text) => { await clipboard.writeText(String(text)); return true; });      // (a promise in newer Electron)
ipcMain.handle("app:info", () => INFO);
// only the one link in config.js is opened, and only a web page or a mail: the page cannot open anything else
ipcMain.handle("feedback:open", async () => {
  const url = CONFIG.feedbackUrl;
  if (!/^(https:\/\/|mailto:)/i.test(url)) throw new Error("no feedback link is set in config.js");
  await shell.openExternal(url);
  return url;
});
// (Round r24) updates (desktop/updates.js): asked by the page only, never on their own; the download page (config.js, Round
// r28), else the configured source's release page, is the one other link the shell opens
const UPDATES = require("./updates.js").make({ app, env: process.env, platform: process.platform, meta: META, downloadPage: CONFIG.downloadUrl,
  send: (ch, v) => { if (win && !win.isDestroyed()) win.webContents.send(ch, v); }, openExternal: (u) => shell.openExternal(u) });
ipcMain.handle("updates:state", () => UPDATES.state());
ipcMain.handle("updates:check", () => UPDATES.check());
ipcMain.handle("updates:download", () => UPDATES.download());
ipcMain.handle("updates:install", () => UPDATES.install());
ipcMain.handle("updates:page", () => UPDATES.openPage());
// (a Mac) the text-field commands an Edit menu would give, for the text field that has the focus
const EDITS = ["copy", "cut", "paste", "selectAll", "undo", "redo"];
ipcMain.on("edit", (e, what) => { if (EDITS.includes(what)) e.sender[what](); });

// a pattern file named on the command line: a double-click, "Open with", or a file dropped on the exe
const fileArg = (argv) => argv.slice(1).find(a => /\.(pdraft|json|dxf|zprj|zpac)$/i.test(a) && !a.startsWith("-") && fs.existsSync(a) && fs.statSync(a).isFile());
// (a Mac hands a double-clicked file to the app as an event, not on the command line; it can come before the window)
let loaded = false, early = null;
app.on("open-file", (e, file) => { e.preventDefault(); if (win && loaded) { if (win.isMinimized()) win.restore(); win.focus(); handOver(file); } else early = file; });
function handOver(file) {
  if (!file || !win) return;
  try { win.webContents.send("open-file", readFile(path.resolve(file))); }
  catch (err) { dialog.showErrorBox("Couldn't open the file", file + "\n\n" + err.message); }
}

/* ---- printing ----
   The pages (one SVG per sheet, sized in mm) go to a hidden window and from there to
   the system print dialog: 100 % scale, no margins, the sheet size the page was laid
   out for. Nothing is scaled to fit, so a millimetre in the drawing is a millimetre
   on paper and the 50 mm check line on the first sheet holds.
   pw, ph = the sheet in mm, as printPlan() worked it out. Resolves to "" or why it failed. */
ipcMain.handle("print", async (e, html, pw, ph) => {
  const file = path.join(app.getPath("temp"), "pdraft-print-" + Date.now() + ".html");
  fs.writeFileSync(file, html);
  const w = new BrowserWindow({ show: false, parent: win, webPreferences: { javascript: false, sandbox: true } });
  try {
    await w.loadFile(file);
    return await new Promise((done) => w.webContents.print({
      silent: false, printBackground: true, scaleFactor: 100, margins: { marginType: "none" },
      landscape: pw > ph, pageSize: { width: Math.round(Math.min(pw, ph)*1000), height: Math.round(Math.max(pw, ph)*1000) },   // microns
    }, (ok, why) => done(ok ? "" : String(why || "failed"))));
  } finally { w.destroy(); fs.rmSync(file, { force: true }); }
});

/* ---- the start-up splash (Round r24) ----
   A small window of its own (drafter/splash.html: the mark sewing itself together), shown the moment the app is ready to
   open windows and before the page starts loading; the page's window stays hidden until it can paint, is then shown at once,
   and the splash fades out over it (SPLASH_FADE) once it has been up SPLASH_MIN: so it never delays the program, and only a
   start quicker than SPLASH_MIN keeps it up that long. A click on it closes it. Under reduced motion it stands still
   (its page's own style). SPLASH_WAIT: the page's window is shown then even if it has not painted. */
const SPLASH_MIN = 600, SPLASH_FADE = 200, SPLASH_WAIT = 10000;
let splash = null, splashAt = 0;
function showSplash() {
  splashAt = Date.now();
  splash = new BrowserWindow({
    width: 260, height: 240, center: true, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, show: true, backgroundColor: "#1F1F1F", title: APP_NAME,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: false },
  });
  splash.webContents.on("will-navigate", (e) => e.preventDefault());
  splash.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  splash.on("closed", () => { splash = null; });
  splash.once("show", () => mark("splashShown"));
  splash.webContents.once("did-finish-load", () => mark("splashLoaded"));
  splash.loadFile(SPLASH).catch(() => {});
}
// the page's window is up: the splash goes, after SPLASH_MIN from its start at the earliest, fading where the system can
function splashEnd() {
  if (!splash) return;
  setTimeout(() => {
    if (!splash) return;
    if (process.platform === "linux") return splash.destroy();          // (no window opacity there)
    const t0 = Date.now(), step = () => {
      if (!splash) return;
      const k = Math.min(1, (Date.now() - t0)/SPLASH_FADE);
      if (k >= 1) return splash.destroy();
      splash.setOpacity(1 - k); setTimeout(step, 16);
    };
    step();
  }, Math.max(0, SPLASH_MIN - (Date.now() - splashAt)));
}

/* ---- the window ---- */
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 720, minHeight: 480, backgroundColor: "#2b2b2d", title: APP_NAME + TITLE_TAIL,
    show: !splash,                                                   // (with the splash: shown when it can paint, below)
    // the developer tools only when run from source (npm start, F12); a built app has none
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: !app.isPackaged },
    // run from source, the window shows the app's icon (Electron's own otherwise); a built app has it in the executable
    ...(app.isPackaged ? {} : { icon: path.join(__dirname, "icons", process.platform === "win32" ? "icon.ico" : "png/256x256.png") }),
  });
  win.on("page-title-updated", (e, title) => { e.preventDefault(); win.setTitle(title + TITLE_TAIL); });
  // the page is the whole app: it never navigates away or opens windows (a file dropped on it would otherwise replace it)
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // the page blocks closing when its autosave failed; a browser asks, Electron would just refuse to close
  win.webContents.on("will-prevent-unload", (e) => {
    const leave = dialog.showMessageBoxSync(win, { type: "warning", buttons: ["Close anyway", "Stay"], defaultId: 1, cancelId: 1,
      message: "Autosave failed, so changes since the last Save will be lost.", detail: "Stay and use Save to keep your work." }) === 0;
    if (leave) e.preventDefault();
  });
  if (!app.isPackaged) win.webContents.on("before-input-event", (e, k) => { if (k.type === "keyDown" && k.key === "F12") win.webContents.toggleDevTools(); });
  win.webContents.once("did-finish-load", () => { loaded = true; handOver(fileArg(process.argv) || early); early = null; });
  win.on("closed", () => { win = null; loaded = false; });
  if (splash) {
    const w = win, up = () => { clearTimeout(late); if (!w.isDestroyed() && !w.isVisible()) w.show(); splashEnd(); }, late = setTimeout(up, SPLASH_WAIT);
    w.once("ready-to-show", up);
  }
  win.once("show", () => mark("mainShown"));
  win.once("ready-to-show", () => mark("mainPaint"));
  win.webContents.once("did-finish-load", () => {
    mark("mainLoaded");
    if (START_LOG) try { fs.writeFileSync(START_LOG, JSON.stringify({ ...T0, version: app.getVersion(), exe: process.execPath })); } catch (e) {}
  });
  win.loadFile(PAGE);
}

/* The Mac's menu bar: the app's menu (About and Settings… open the page's own; Hide, Quit as every Mac app has them) and
   Window. The page's menus (File, Edit, …) stay in the window, as on Windows and Linux. A key reaches the page first: only
   one the page does not use goes to these menus (Cmd+H, Cmd+Q, Cmd+W, Cmd+M, Cmd+,: the page's own keys that were on
   those are on the Control key on a Mac, MAC_CTRL in the page). No Edit menu: the page has its own, and the text-field
   commands are asked for by the page ("edit", above). */
function macMenu() {
  const send = (what) => () => { if (win) win.webContents.send("app-menu", what); };
  return Menu.buildFromTemplate([
    { label: app.name, submenu: [
      { label: "About " + app.name, click: send("about") }, { type: "separator" },
      { label: "Settings…", accelerator: "Cmd+,", click: send("settings") }, { type: "separator" },
      { role: "services" }, { type: "separator" },
      { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" },
      { role: "quit" },
    ] },
    { label: "Window", role: "window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "close" }, { type: "separator" }, { role: "front" }] },
  ]);
}

/* (Round rename-1) The first start: the old folder's settings, recent files and autosaves copied into this one (desktop/migrate.js),
   before anything here reads them. While the old app is still open its settings cannot be copied whole, so it is asked to be
   closed first; "Start Without Them" starts with nothing of it and does not ask again. A copy that fails is told, and the rest
   is copied at the next start. The line to show (INFO.notice) is shown by the page once it is up. */
function bringOver() {
  if (!OLD_DATA) return;
  try {
    while (MIGRATE.due(DATA, OLD_DATA) && MIGRATE.oldAppOpen(OLD_DATA)) {
      const r = dialog.showMessageBoxSync({ type: "info", buttons: ["Try Again", "Start Without Them"], defaultId: 0, cancelId: 1, title: app.name,
        message: MIGRATE.OLD_NAME + " is still open.",
        detail: "Close it, then press Try Again: its settings, recent files and unsaved work are then copied over to " + app.name + ", and its own folder is left as it is.\n\nStart Without Them: " + app.name + " starts with its own settings and does not ask again." });
      if (r === 1) return MIGRATE.decline(DATA);
    }
    const r = MIGRATE.run({ data: DATA, old: OLD_DATA });
    if (r.notice) INFO.notice = r.notice;
  } catch (e) { INFO.notice = "Not everything from " + MIGRATE.OLD_NAME + " could be brought over (" + e.message + "); the rest is tried at the next start."; }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  // a second launch (double-clicking another file) hands its file to the window that is already open
  app.on("second-instance", (e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    handOver(fileArg(argv));
  });
  app.whenReady().then(() => {
    // Windows and Linux: no menu bar, and with it none of its shortcuts: the page's own menu bar is the only one, and Ctrl+R
    // (Mirror Paste), Ctrl+N (New), Ctrl+W (Remove All Pins), Ctrl+H / J / K, Ctrl+Shift+I, Ctrl +/− and F11 all reach the page.
    // A Mac: the app's own first menu and Window, which every Mac app has, and nothing that doubles the page's menus
    mark("ready");
    Menu.setApplicationMenu(MAC ? macMenu() : null);
    bringOver(); mark("broughtOver");
    showSplash(); mark("splashMade");
    loadLists(); mark("lists");
    createWindow(); mark("mainMade");
  });
  app.on("window-all-closed", () => app.quit());
}
