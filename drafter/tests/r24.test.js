// Round r24: release polish. The start-up splash (the desktop app's window of its own, drafter/splash.html; the browser's
// overlay in the page and its few lines of script), the update check (batch 3), the popovers (batch 4).
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pageHTML, pageScripts } = require("./harness");

const ROOT = path.join(__dirname, "..", "..");
const MAIN = fs.readFileSync(path.join(ROOT, "desktop", "main.js"), "utf8");
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "desktop", "package.json"), "utf8"));
const T = [];
const test = (name, fn) => T.push({ name, fn });

// the overlay's script run on a stand-in page: the splash element, timers that run when told, performance.now() as set
function overlay(opts) {
  const html = pageHTML(), code = pageScripts(html).find(s => !s.src && /gussetSplashEnd/.test(s.code)).code;
  const timers = [], marks = [], handlers = {};
  let now = opts.now || 0, removed = false;
  const el = { className: "", parentNode: { removeChild: () => { removed = true; el.parentNode = null; } }, addEventListener: (n, f) => { handlers[n] = f; } };
  const win = opts.desktop ? { desktop: {} } : {};
  const ctx = { window: win, document: { getElementById: (id) => (id === "splash" ? el : null) },
    performance: { now: () => now, mark: (n) => marks.push([n, now]) }, setTimeout: (f, ms) => timers.push({ f, at: now + (ms || 0) }) };
  vm.runInNewContext(code, ctx);
  const run = (to) => { now = to; for (let k = 0; k < 10; k++) { const due = timers.filter(t => !t.done && t.at <= now); if (!due.length) break; for (const t of due) { t.done = true; t.f(); } } };
  return { el, win, marks, handlers, run, removed: () => removed };
}

test("r24 splash, browser: the overlay comes first in the page and shows the mark sewing itself (the still mark under reduced motion)", () => {
  const html = pageHTML(), at = html.indexOf('<div id="splash"');
  assert.ok(at > html.indexOf("</style>") && at < html.indexOf('<div id="app">'), "before the app, so it is the first thing painted");
  assert.ok(html.includes('<picture><source media="(prefers-reduced-motion: reduce)" srcset="assets/brand/gusset-mark.svg"><img src="assets/brand/gusset-mark-sewn.svg"'));
  assert.ok(/#splash\.out \{ opacity: 0; pointer-events: none; \}/.test(html) && /transition: opacity \.2s/.test(html), "a fade of 0.2 s, through which clicks reach the app");
  const svg = fs.readFileSync(path.join(ROOT, "drafter", "assets", "brand", "gusset-mark-sewn.svg"), "utf8");
  for (const c of ["up", "lo", "band", "whole"]) assert.ok(svg.includes('class="' + c + '"'), c);
  assert.ok(/class="whole" fill="#E8412F" fill-rule="evenodd" d="M214 -323/.test(svg), "it ends as the mark itself");
  assert.ok(/prefers-reduced-motion: reduce\) \{ \* \{ animation: none/.test(svg));
  // every animation is over by 0.55 s (the shortest the splash stays, 0.6 s)
  const ends = [...svg.matchAll(/animation: \w+ ([.\d]+)s(?: ([.\d]+)s)?/g)].map(m => +m[1] + (+m[2] || 0));
  assert.ok(ends.length === 4 && Math.max(...ends) <= 0.55, ends.join(", "));
});

test("r24 splash, browser: it goes once the page has loaded and 600 ms have passed; a click skips it at once; the desktop app takes it away", () => {
  const quick = overlay({ now: 120 });
  quick.run(300); quick.win.gussetSplashEnd();
  quick.run(599); assert.strictEqual(quick.el.className, "", "still up before 600 ms");
  quick.run(600); assert.strictEqual(quick.el.className, "out"); assert.deepStrictEqual(quick.marks, [["gusset-splash-gone", 600]]);
  assert.ok(!quick.removed()); quick.run(800); assert.ok(quick.removed(), "out of the page after its fade");
  const slow = overlay({ now: 100 });
  slow.run(1400); slow.win.gussetSplashEnd(); slow.run(1400);
  assert.deepStrictEqual(slow.marks, [["gusset-splash-gone", 1400]], "a slower start: at once, no wait added");
  const click = overlay({ now: 50 }); let stopped = 0;
  click.run(200); click.handlers.pointerdown({ preventDefault: () => stopped++, stopPropagation: () => stopped++ });
  assert.strictEqual(click.el.className, "out"); assert.strictEqual(stopped, 2, "the click goes no further");
  click.win.gussetSplashEnd(); click.run(900); assert.strictEqual(click.marks.length, 1, "once");
  const desk = overlay({ desktop: true });
  assert.ok(desk.removed() && !desk.win.gussetSplashEnd, "the desktop app has a window of its own");
});

test("r24 splash, browser: the app ends it once the page has loaded (the mark gusset-ready)", () => {
  const app = fs.readFileSync(path.join(ROOT, "drafter", "pattern-drafter.js"), "utf8");
  const at = app.indexOf("const started = () => {"), body = app.slice(at, app.indexOf("\n  };", at));
  assert.ok(at > 0 && body.includes('performance.mark("gusset-ready")') && body.includes('if (typeof window.gussetSplashEnd === "function") window.gussetSplashEnd();'), body);
  assert.ok(app.includes('if (document.readyState === "complete") started(); else window.addEventListener("load", started);'));
});

test("r24 splash, desktop: its own window, made after the old folder is brought over and before the page's; the page's window shown when it can paint; at most 0.8 s and a fade of at most 0.3 s", () => {
  const ready = MAIN.slice(MAIN.indexOf("app.whenReady().then("));
  const at = (s) => { const i = ready.indexOf(s); assert.ok(i > 0, s); return i; };
  assert.ok(at("bringOver();") < at("showSplash();") && at("showSplash();") < at("loadLists();") && at("loadLists();") < at("createWindow();"));
  const min = +/const SPLASH_MIN = (\d+)/.exec(MAIN)[1], fade = +/SPLASH_FADE = (\d+)/.exec(MAIN)[1];
  assert.ok(min > 0 && min <= 800 && fade > 0 && fade <= 300, min + " / " + fade);
  assert.ok(MAIN.includes("show: !splash,"), "the page's window hidden while the splash is up");
  assert.ok(/w\.once\("ready-to-show", up\)/.test(MAIN) && /SPLASH_WAIT\)/.test(MAIN), "shown at its first paint, or after SPLASH_WAIT whatever happens");
  assert.ok(/Math\.max\(0, SPLASH_MIN - \(Date\.now\(\) - splashAt\)\)/.test(MAIN), "kept up only as long as the shortest time, never longer");
  assert.ok(/skipTaskbar: true, alwaysOnTop: true, show: true, backgroundColor: "#1F1F1F"/.test(MAIN));
  assert.ok(/webPreferences: \{ contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: false \}/.test(MAIN), "no preload, no bridge");
  const page = fs.readFileSync(path.join(ROOT, "drafter", "splash.html"), "utf8");
  assert.ok(page.includes('<body onclick="window.close()">'), "a click closes it");
  assert.ok(page.includes('<source media="(prefers-reduced-motion: reduce)" srcset="assets/brand/gusset-mark.svg"><img src="assets/brand/gusset-mark-sewn.svg"'));
  assert.ok(/@media \(prefers-reduced-motion: reduce\) \{ \.line \{ display: block; \} \}/.test(page), "the line under reduced motion");
  assert.ok(!/<script/i.test(page) && !/https?:/.test(page), "nothing else loaded");
  const files = PKG.build.extraResources.find(r => r.from === "../drafter").filter;
  for (const f of ["splash.html", "assets/brand/gusset-mark-sewn.svg", "assets/brand/gusset-mark.svg"]) assert.ok(files.includes(f), f + " packed");
});

test("r24 start-up times: written only when PDRAFT_STARTUP_LOG names a file", () => {
  assert.ok(MAIN.includes('const START_LOG = process.env.PDRAFT_STARTUP_LOG || ""'));
  assert.ok(MAIN.includes("if (START_LOG) try { fs.writeFileSync(START_LOG, JSON.stringify({ ...T0, version: app.getVersion(), exe: process.execPath })); } catch (e) {}"));
  assert.ok(/const mark = \(n\) => \{ if \(START_LOG && T0\[n\] == null\)/.test(MAIN), "nothing kept without it");
});

/* ---- batch 3: updates ---- */
const os = require("os"), { spawnSync } = require("child_process");
function boot(opt) {
  const f = path.join(os.tmpdir(), "pdraft-r24-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
const U = require("../../desktop/updates.js");
// a stand-in for electron-updater's autoUpdater: what it was set to and asked, and what it answers
function fakeUpdater(answer) {
  const u = { calls: [], on: (n, f) => { u.calls.push("on " + n); u.progress = f; }, setFeedURL: (s) => { u.feed = s; },
    checkForUpdates: () => { u.calls.push("check"); return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer); },
    downloadUpdate: () => { u.calls.push("download"); if (u.progress) u.progress({ percent: 50.4, transferred: 5, total: 10 }); return Promise.resolve(["x"]); },
    quitAndInstall: (silent, run) => { u.calls.push("quitAndInstall " + silent + " " + run); } };
  return u;
}
const appOf = (version, packaged = true) => ({ isPackaged: packaged, getVersion: () => version });
const avail = (v) => ({ isUpdateAvailable: true, updateInfo: { version: v, releaseDate: "2026-11-01" } });

test("r24 updates: the kind of copy, the source, the release page and the channel", () => {
  assert.strictEqual(U.kindOf({ isPackaged: false }, {}, "win32"), "source");
  assert.strictEqual(U.kindOf({ isPackaged: true }, {}, "win32"), "installer");
  assert.strictEqual(U.kindOf({ isPackaged: true }, { PORTABLE_EXECUTABLE_FILE: "x.exe" }, "win32"), "portable");
  assert.strictEqual(U.kindOf({ isPackaged: true }, { APPIMAGE: "/a/G.AppImage" }, "linux"), "appimage");
  assert.strictEqual(U.kindOf({ isPackaged: true }, {}, "linux"), "linux");
  assert.strictEqual(U.kindOf({ isPackaged: true }, {}, "darwin"), "mac");
  assert.deepStrictEqual(U.sourceOf({ updateSource: "github:someone/some-repo" }, {}), { provider: "github", owner: "someone", repo: "some-repo" });
  assert.deepStrictEqual(U.sourceOf({ updateSource: "https://example.invalid/gusset" }, {}), { provider: "generic", url: "https://example.invalid/gusset/" });
  assert.deepStrictEqual(U.sourceOf({ updateSource: "github:a/b" }, { PDRAFT_UPDATE_URL: "http://127.0.0.1:9/" }), { provider: "generic", url: "http://127.0.0.1:9/" }, "a check's own server first");
  for (const bad of ["", "github:", "ftp://x", "file:///C:/x", "github:a/b/c", "javascript:alert(1)"]) assert.strictEqual(U.sourceOf({ updateSource: bad }, {}), null, bad);
  assert.strictEqual(U.releasePage({ provider: "github", owner: "o", repo: "r" }, "0.9.1"), "https://github.com/o/r/releases/tag/v0.9.1");
  assert.strictEqual(U.releasePage({ provider: "generic", url: "https://e.invalid/g/" }, "0.9.1"), "https://e.invalid/g/");
  assert.strictEqual(U.channelOf("0.9.0-beta.4"), "beta"); assert.strictEqual(U.channelOf("1.0.0"), "latest"); assert.strictEqual(U.channelOf("1.1.0-RC.1"), "rc");
  // the shell's build is the one place a source is set: no project file names a repository
  assert.ok(!/updateSource|github:/.test(fs.readFileSync(path.join(ROOT, "desktop", "package.json"), "utf8")));
  assert.ok(!/updateSource|github:/.test(fs.readFileSync(path.join(ROOT, "drafter", "config.js"), "utf8")));
});

test("r24 updates: nothing downloaded or installed without being asked; a beta reads the beta channel, never downgrades; the installer and an AppImage install, the rest open the release page", async () => {
  const sent = [], opened = [];
  const make = (version, kind, answer, src) => { const u = fakeUpdater(answer);
    const env = kind === "portable" ? { PORTABLE_EXECUTABLE_FILE: "G.exe" } : kind === "appimage" ? { APPIMAGE: "/x" } : {};
    const plat = kind === "mac" ? "darwin" : kind === "appimage" ? "linux" : "win32";
    return { u, up: U.make({ app: appOf(version), env, platform: plat, meta: { updateSource: src === undefined ? "github:o/r" : src }, send: (c, v) => sent.push([c, v]), openExternal: (x) => { opened.push(x); return Promise.resolve(); }, load: () => u }) }; };
  const a = make("0.9.0-beta.4", "installer", avail("0.9.0-beta.5"));
  assert.deepStrictEqual(a.u.calls, [], "nothing at all until asked (electron-updater not even loaded)");
  const r = await a.up.check();
  assert.strictEqual(r.status, "available"); assert.deepStrictEqual(r.found, { version: "0.9.0-beta.5", date: "2026-11-01" });
  assert.ok(r.canInstall && r.kind === "installer" && r.channel === "beta");
  assert.strictEqual(a.u.autoDownload, false); assert.strictEqual(a.u.autoInstallOnAppQuit, false);
  assert.strictEqual(a.u.channel, "beta"); assert.strictEqual(a.u.allowPrerelease, true); assert.strictEqual(a.u.allowDowngrade, false);
  assert.deepStrictEqual(a.u.feed, { provider: "github", owner: "o", repo: "r" });
  assert.ok(!a.u.calls.includes("download"), "a check downloads nothing");
  assert.throws(() => a.up.install(), /nothing downloaded/);
  await a.up.download();
  assert.deepStrictEqual(sent, [["update-progress", { percent: 50, bytes: 5, total: 10 }]]);
  a.up.install(); await new Promise(r => setImmediate(r));
  assert.strictEqual(a.u.calls[a.u.calls.length - 1], "quitAndInstall true true", "without the installer's pages, and run again after");
  // a stable version: the latest channel, no betas
  const s = make("1.0.0", "installer", { isUpdateAvailable: false, updateInfo: { version: "1.0.0" } });
  assert.strictEqual((await s.up.check()).status, "none"); assert.strictEqual(s.u.channel, "latest"); assert.strictEqual(s.u.allowPrerelease, false);
  // the portable .exe and a Mac: told, and the release page opened; never a download
  for (const kind of ["portable", "mac"]) {
    const p = make("0.9.0-beta.4", kind, avail("0.9.0-beta.5"));
    const q = await p.up.check();
    assert.ok(q.status === "available" && !q.canInstall && q.page === "https://github.com/o/r/releases/tag/v0.9.0-beta.5", kind);
    await assert.rejects(p.up.download(), /cannot replace itself/);
    assert.strictEqual(await p.up.openPage(), "https://github.com/o/r/releases/tag/v0.9.0-beta.5");
  }
  assert.strictEqual(opened.length, 2);
  assert.ok((await make("0.9.0-beta.4", "appimage", avail("0.9.0-beta.5")).up.check()).canInstall, "an AppImage replaces itself");
  // no source: nothing to ask; a failed check is said, not thrown
  const n = make("0.9.0-beta.4", "installer", avail("x"), "");
  assert.strictEqual((await n.up.check()).status, "nosource"); assert.deepStrictEqual(n.u.calls, []);
  const e = make("0.9.0-beta.4", "installer", new Error("HttpError: 404 Not Found\nmore"));
  const er = await e.up.check(); assert.strictEqual(er.status, "error"); assert.strictEqual(er.error, "HttpError: 404 Not Found");
});

test("r24 updates, the page: the check at the start only while the setting is on; the button's words through the download; Restart asks first while there is unsaved work; the browser has none of it", () => {
  const CHECK = { status: "available", canInstall: true, found: { version: "9.9.9" }, version: "0.9.0-beta.4", channel: "beta" };
  const r = boot({ desktop: { updates: { check: CHECK } }, blank: true, script: `
    const out = {}, d = app.desk, b = () => app.ev("document").getElementById("s-upd"), txt = () => [b().style.display, b().textContent, !!b().disabled];
    out.pref = S.prefs.updateCheck;
    out.help = app.MENUS.help().filter(x => x && x.n).map(x => x.n);
    app.ev("checkUpdates")(false);
    out.found = txt();
    app.ev("updClick")();
    out.ready = txt(); out.calls = d.calls.map(c => c[0]);
    // unsaved work: asked first, Cancel leaves it
    S.pieces.push(app.mkPiece ? app.mkPiece("A", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]) : {}); app.ev("store")();
    let asked = null; app.modalAnswer = (t, keys) => { asked = [t, keys]; return "cancel"; };
    app.ev("updClick")();
    out.asked = asked; out.afterCancel = d.calls.filter(c => c[0] === "updates.install").length;
    app.modalAnswer = (t, keys) => "anyway";
    app.ev("updClick")();
    out.installed = d.calls.filter(c => c[0] === "updates.install").length;
    out.settings = (() => { app.ev("settingsDialog")({ x: 0, y: 0 }); return app.ev("document").getElementById("dlg").innerHTML; })();
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.pref, true, "on by default");
  assert.ok(pageHTML().includes('<button id="s-upd" style="display:none">Update available</button>'), "hidden until a newer version is found");
  assert.ok(o.help.includes("Check for Updates\u2026"));
  assert.deepStrictEqual(o.found, ["", "Update available", false]);
  assert.deepStrictEqual(o.ready, ["", "Restart to Update", false]);
  assert.deepStrictEqual(o.calls.filter(c => /^updates/.test(c)), ["updates.check", "updates.download"], "the click downloads; nothing is installed");
  assert.deepStrictEqual(o.asked, ["Restart to Update", ["save", "anyway", "cancel"]]);
  assert.strictEqual(o.afterCancel, 0, "Cancel restarts nothing");
  assert.strictEqual(o.installed, 1);
  assert.ok(/data-p="updateCheck" checked/.test(o.settings) && /Check for updates on start/.test(o.settings));
  // a copy that cannot replace itself: the button opens the release page
  const p = boot({ desktop: { updates: { check: { ...CHECK, canInstall: false } } }, blank: true, script: `
    app.ev("checkUpdates")(false); app.ev("updClick")(); return app.desk.calls.map(c => c[0]);` });
  assert.deepStrictEqual(p.result.filter(c => /^updates/.test(c)), ["updates.check", "updates.page"]);
  // the setting off: no check at the start
  const off = boot({ desktop: { updates: { check: CHECK }, local: { "pdraft:prefs": JSON.stringify({ updateCheck: false }) } }, blank: true, script: `
    return [S.prefs.updateCheck, app.winFire("load"), app.desk.calls.filter(c => c[0] === "updates.check").length];` });
  assert.deepStrictEqual(off.result.slice(0, 1).concat(off.result.slice(2)), [false, 0]);
  // the browser: no button wiring, no menu row, no setting
  const br = boot({ blank: true, script: `
    app.ev("settingsDialog")({ x: 0, y: 0 });
    return [app.MENUS.help().filter(x => x && x.n).map(x => x.n).includes("Check for Updates\\u2026"), /updateCheck/.test(app.ev("document").getElementById("dlg").innerHTML)];` });
  assert.deepStrictEqual(br.result, [false, false]);
});

test("r24 installer and release files: per user, folder optional, both shortcuts, the user's files kept; both Windows files from one build; the channel files checked", () => {
  const n = PKG.build.nsis;
  assert.deepStrictEqual([n.oneClick, n.perMachine, n.allowElevation, n.allowToChangeInstallationDirectory, n.createDesktopShortcut, n.createStartMenuShortcut, n.deleteAppDataOnUninstall, n.shortcutName],
    [false, false, false, true, true, true, false, "Gusset – Pattern Drafter"]);      // (r24 follow-up: the shortcut has the name in full)
  assert.deepStrictEqual(PKG.build.win.target, ["nsis", "portable"]);
  const build = fs.readFileSync(path.join(ROOT, "desktop", "build.js"), "utf8");
  assert.ok(build.includes('win: ["win", "--win nsis portable"]') && build.includes('{ win: "win", mac: "mac", linux: "linux" }[SYSTEM]'), "Windows: both by default");
  assert.ok(build.includes('"--config.nsis.license=" + q(lic)') && /read\("LICENSE"\).*read\("ATTRIBUTION\.md"\).*read\("TRADEMARKS\.md"\)/.test(build), "the licence page: ours, then the third parties'");
  assert.ok(build.includes('"--config.generateUpdatesFilesForAllChannels=true"'), "a stable build writes every channel's file, so betas are offered it too");
  const wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "release.yml"), "utf8");
  assert.ok(wf.includes("desktop/dist/*.yml") && wf.includes("desktop/dist/*.blockmap"), "uploaded with the builds");
  // (Round r24 follow-up) no default to this repository: its owner is a person's account, which would be packed into every build
  assert.ok(wf.includes("PDRAFT_UPDATE_SOURCE: ${{ inputs.update_source || vars.PDRAFT_UPDATE_SOURCE || 'github:fynndose/gusset-pattern-drafter' }}"), "configurable; (Round PUB-1, the maintainer's brief) the public repository by default");
  assert.ok(wf.includes('if [ "$PDRAFT_UPDATE_SOURCE" != none ]; then node scripts/update-files-check.js dist "$V"'), "the channel files checked when there is a source");
  const rel = wf.slice(wf.indexOf("name: Create or update the draft release"));
  assert.ok(rel.indexOf('node scripts/update-files-check.js dist "$V"') > 0 && rel.indexOf('node scripts/update-files-check.js') < rel.indexOf('echo "Would make'), "checked in the dry run too");
  // the check itself, on a folder made here
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdraft-r24-yml-")), exe = Buffer.from("not really an installer");
  try {
    fs.writeFileSync(path.join(dir, "Gusset-0.9.0-beta.5-win-x64-setup.exe"), exe);
    const sha = require("crypto").createHash("sha512").update(exe).digest("base64");
    const yml = (v, size) => "version: " + v + "\nfiles:\n  - url: Gusset-0.9.0-beta.5-win-x64-setup.exe\n    sha512: " + sha + "\n    size: " + size + "\npath: Gusset-0.9.0-beta.5-win-x64-setup.exe\nsha512: " + sha + "\nreleaseDate: '2026-11-01T00:00:00.000Z'\n";
    const run = () => spawnSync(process.execPath, [path.join(ROOT, "scripts", "update-files-check.js"), dir, "0.9.0-beta.5"], { encoding: "utf8" });
    fs.writeFileSync(path.join(dir, "beta.yml"), yml("0.9.0-beta.5", exe.length));
    assert.strictEqual(run().status, 0, run().stdout);
    fs.writeFileSync(path.join(dir, "latest.yml"), yml("0.9.0-beta.5", exe.length));
    assert.ok(/must not write a latest channel file/.test(run().stdout), "a beta never offered to stable versions");
    fs.rmSync(path.join(dir, "latest.yml"));
    fs.writeFileSync(path.join(dir, "beta.yml"), yml("0.9.0-beta.5", exe.length + 1));
    assert.ok(/bytes, the file says/.test(run().stdout));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("r24 updates: a build under another name (the update test's) never looks into the old data folder; the shell opens only the configured release page", () => {
  // (r24 follow-up: told by its data folder, which is pinned: an app whose folder is not Gusset's)
  assert.ok(MAIN.includes('process.env.PDRAFT_USER_DATA || DATA_FOLDER !== "Gusset" ? null : path.join(APPDATA, MIGRATE.OLD_NAME)'));
  for (const ch of ["updates:state", "updates:check", "updates:download", "updates:install", "updates:page"]) assert.ok(MAIN.includes('ipcMain.handle("' + ch + '"'), ch);
  assert.ok(/if \(!\/\^https\?:\\\/\\\/\/i\.test\(url\)\) throw/.test(fs.readFileSync(path.join(ROOT, "desktop", "updates.js"), "utf8")), "only a web page");
});

module.exports = T;
