// Round desk-1: what the desktop build packs, the version in one place, and the parts of the page the test version
// added (exports to a chosen file in the desktop app, Help ▸ Send Feedback and Save Bug Report, the welcome box,
// File ▸ Open Example). The desktop app itself is checked by desktop/smoke.js (npm run smoke:desktop).
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pageHTML, pageScripts } = require("./harness");

const ROOT = path.join(__dirname, "..", "..");
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-deskb-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after 60 s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "desktop", "package.json"), "utf8"));
const CONFIG = require("../config.js");

test("the desktop build packs every script the page loads, the two avatars and nothing that is not there; it is the page's version", () => {
  const res = PKG.build.extraResources.find(r => r.from === "../drafter"), filter = res.filter;
  // (Round r24: the splash's own few lines are inline in the page, with nothing to pack)
  for (const s of pageScripts(pageHTML())) if (s.src) assert.ok(filter.includes(s.src), "the page loads " + s.src + ": desktop/package.json must pack it (extraResources)");
  for (const f of ["pattern-drafter.html", "splash.html", "assets/avatar/presets/marty.glb", "assets/avatar/presets/jessica.glb"]) assert.ok(filter.includes(f), f);
  for (const f of filter) assert.ok(!/[*?]/.test(f) && fs.existsSync(path.join(ROOT, "drafter", f)), "packed but not there (or a pattern, which could take a stray file along): " + f);
  assert.ok(!filter.some(f => /^tests\/|\.test\.js$/.test(f)), "no tests");
  // (Round rename-1) and migrate.js, which copies the old name's data folder over once
  // (Round r24: and updates.js, the update check; electron-updater, the one dependency the app holds, is packed by the builder
  // from desktop/package.json's dependencies, and scripts/package-check.js lets exactly those through)
  assert.deepStrictEqual(PKG.build.files, ["main.js", "preload.js", "migrate.js", "updates.js"], "the shell's own four scripts, and no node_modules");
  assert.deepStrictEqual(Object.keys(PKG.dependencies || {}), ["electron-updater"], "one dependency, the updater");
  assert.strictEqual(PKG.version, CONFIG.version, "desktop/package.json's version is drafter/config.js's (the exe is named after it, the page shows it)");
  assert.ok(/^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/.test(CONFIG.version), CONFIG.version);
  // (Round r24 follow-up) empty until the project has an address of its own (it was a person's); release check rule 15 keeps a person's out
  assert.ok(/^(|https:\/\/\S+|mailto:\S+)$/.test(CONFIG.feedbackUrl), "the feedback link is empty, a web page or a mail address: " + CONFIG.feedbackUrl);
  assert.deepStrictEqual(PKG.build.electronLanguages, ["en-US"]);
  // (Round desk-2) every file is named by its version, system and processor; (Round rename-1) after the new name:
  // Gusset-0.9.0-beta.4-win-x64-portable.exe, -mac-arm64.dmg, -linux-x64.AppImage
  assert.deepStrictEqual([PKG.build.portable.artifactName, PKG.build.nsis.artifactName, PKG.build.mac.artifactName, PKG.build.dmg.artifactName, PKG.build.linux.artifactName],
    ["Gusset-${version}-win-${arch}-portable.${ext}", "Gusset-${version}-win-${arch}-setup.${ext}", "Gusset-${version}-mac-${arch}.${ext}", "Gusset-${version}-mac-${arch}.${ext}", "Gusset-${version}-linux-${arch}.${ext}"]);
  assert.strictEqual(PKG.build.linux.executableName, "gusset");
  // a double-clicked .pdraft opens Gusset (where the system registers it: macOS, Linux, the Windows installer; the portable exe
  // registers nothing, "Open with" picks it)
  assert.deepStrictEqual(PKG.build.fileAssociations.map(a => [a.ext, a.name, a.description, a.role]), [["pdraft", "Gusset pattern", "Gusset pattern file", "Editor"]]);
});

test("desktop: an export asks where to write it; the toast comes only once it is written, none when the dialog is cancelled; Export PDF is a real PDF", () => {
  const r = boot({ desktop: true, script: `
    const out = {}, d = app.desk;
    d.dialog = null; app.ev("exportBOM")(); out.cancelled = [d.calls.map(c => c[0]).join(), toasts.length];
    d.dialog = "C:\\\\out\\\\bom.xml"; app.ev("exportBOM")(); out.bom = [d.calls[d.calls.length - 1], toasts[toasts.length - 1], /<bom/i.test(d.files.get(d.dialog))];
    d.dialog = "C:\\\\out\\\\p.svg"; app.el("ex-svg").onclick(); out.svg = [d.calls[d.calls.length - 1][1], /^<[?]xml/.test(d.files.get(d.dialog)), /SVG 1:1/.test(toasts[toasts.length - 1])];
    app.answer = (t, f, o) => ({ ...Object.fromEntries(f.map(x => [x.k, x.val])), ...Object.fromEntries((o.selects || []).map(c => [c.k, c.val])), ...Object.fromEntries((o.checks || []).map(c => [c.k, c.val])) });
    d.dialog = "C:\\\\out\\\\p.dxf"; app.dxfOutNumeric({ x: 0, y: 0 }); out.dxf = [d.calls[d.calls.length - 1][1], /SECTION/.test(d.files.get(d.dialog)), /written as DXF-AAMA/.test(toasts[toasts.length - 1])];
    d.dialog = "C:\\\\out\\\\p.pdf"; app.ev("pdfExportDialog")({ x: 0, y: 0 }); out.pdf = [d.calls[d.calls.length - 1], /^Saved p[.]pdf [(]/.test(toasts[toasts.length - 1])];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.cancelled, ["exportFile", 0], "cancelled: nothing said");
  assert.deepStrictEqual(o.bom, [["exportFile", "pattern-bom.xml"], "BOM written as XML", true]);
  assert.deepStrictEqual(o.svg, ["pattern.svg", true, true]); assert.deepStrictEqual(o.dxf, ["pattern.dxf", true, true]);
  assert.deepStrictEqual(o.pdf, [["pdf", "pattern.pdf", true], true], "the desktop app makes the PDF itself");
});

// (Round rename-1) the program is called Gusset: the titles and texts expected below say so (they had the old name)
test("Help ▸ Send Feedback: the bug information goes to the clipboard and the feedback link opens; it holds the version, errors without the user's folders, step names, and nothing of the document", () => {
  const r = boot({ desktop: { info: true }, recover: false, script: `
    const out = {}, d = app.desk;
    app.ev("hideDlg")(); app.ev("closeModal")();
    app.ev("push")("Rename"); S.pieces[0].name = "Secret bodice"; app.commit();
    app.ev("noteError")("Couldn't read C:\\\\Users\\\\someone\\\\Documents\\\\x.pdraft for me@example.com");
    const help = app.MENUS.help(); out.rows = help.filter(x => x && x.n).map(x => x.n);
    return Promise.resolve(help.find(x => x.n === "Send Feedback\\u2026").f()).then(() => { out.calls = d.calls.map(c => c[0]); out.clip = d.clip; out.modal = app.ev("modalNow") && app.ev("modalNow").title; return out; });` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, clip = o.clip;
  assert.ok(o.rows.includes("Send Feedback\u2026") && o.rows.includes("Save Bug Report\u2026") && o.rows.includes("Welcome\u2026") && o.rows.includes("About\u2026"), o.rows.join());
  // (Round r24 follow-up: config.js has the project's own address again, feedback@gussetdrafter.com, so the link opens)
  assert.deepStrictEqual(o.calls.filter(c => /copyText|openFeedback/.test(c)), ["copyText", "openFeedback"], "copied first, then the link");
  // (Round desk-2: the version is now 0.9.0-beta.2; release beta.3: 0.9.0-beta.3; release beta.4: 0.9.0-beta.4; Round r28: 1.0.0-beta.1; release beta.2: 1.0.0-beta.2; release beta.3: 1.0.0-beta.3; release beta.4: 1.0.0-beta.4; release beta.5: 1.0.0-beta.5; release beta.6: 1.0.0-beta.6, here and in the welcome box below)
  assert.ok(/^Gusset: bug information\nVersion: 1[.]0[.]0-beta[.]6 [(]desktop app, built 2026-01-01 from abc1234[)]\nSystem: Windows 11 [(]10[.]0[.]26200[)], x64/.test(clip), clip);
  assert.ok(/Screen: .*the window 1200 \u00d7 900/.test(clip) && /Document: \d+ patterns?, 0 seams; avatar none/.test(clip), clip);
  assert.ok(/Couldn't read <home>\\Documents\\x[.]pdraft for <e-mail>/.test(clip), "the user's folder and address are cut out: " + clip);
  assert.ok(/Last steps [(]\d+, the newest last[)]:[\s\S]*  Rename\n/.test(clip), clip);
  assert.ok(!/Secret bodice|someone|example[.]com/.test(clip), "nothing of the document or the user");
  assert.ok((clip.match(/\n  \S/g) || []).length <= 30, "at most 20 errors and 10 steps");
});

test("Help ▸ Save Bug Report…: the text where the user chooses, with a copy of the open document beside it while that is ticked", () => {
  const r = boot({ desktop: true, script: `
    const d = app.desk; d.dialog = "C:\\\\r\\\\bug.txt"; app.modalAnswer = (t) => (t === "Save Bug Report" ? "save" : "discard");
    app.MENUS.help().find(x => x && x.n === "Save Bug Report\\u2026").f();
    return app.wait ? app.wait(() => d.calls.some(c => c[0] === "bugReport"), "the report").then(() => ({ call: d.calls.find(c => c[0] === "bugReport"), files: [...d.files.keys()], toast: toasts[toasts.length - 1] })) : null;` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result.call.slice(0, 1).concat(r.result.call.slice(2)), ["bugReport", true], "with the document (ticked at first)");
  assert.ok(/^gusset-bug-\d{8}-\d{4}[.]txt$/.test(r.result.call[1]), r.result.call[1]);
  assert.deepStrictEqual(r.result.files.filter(f => f.startsWith("C:\\r\\")), ["C:\\r\\bug.txt", "C:\\r\\bug (document).pdraft"]);
  assert.strictEqual(r.result.toast, "Saved bug.txt and bug (document).pdraft");
});

test("the welcome box: at the desktop app's first start, not again once \"Don't show again\" is ticked; never at a browser's start, nor over the recovery question", () => {
  const first = boot({ blank: true, desktop: { info: true } });
  assert.deepStrictEqual(first.errors, []);
  // (Round r24 follow-up) the name in full in every title: "Gusset – Pattern Drafter" (it was "Gusset")
  const w = first.modals.find(m => m.title === "Welcome to Gusset – Pattern Drafter");
  assert.ok(w, "it shows: " + first.modals.map(m => m.title));
  assert.deepStrictEqual(w.keys, ["start", "example"]);
  assert.ok(/early test version/.test(w.text) && /Save your work often/.test(w.text) && (w.text.match(/<li>/g) || []).length === 6, w.text);
  for (const t of ["Draw a pattern", "Edit points and curves", "Add seam allowance", "Sew two patterns", "Simulate on the avatar", "Save, reopen, export"]) assert.ok(w.text.includes(t), t);
  assert.ok(!/\bclo\b/i.test(w.text), "names no other program");
  assert.ok(/id="wl-off">/.test(w.text) && !/id="wl-off" checked/.test(w.text), "Don't show again, not ticked at first");
  // "Discard" is the harness's default answer for any other question: Start was not chosen, so it shows again next time
  const off = boot({ blank: true, desktop: { info: true }, storage: { "pdraft:welcome": "off" } });
  assert.ok(!off.modals.some(m => /^Welcome/.test(m.title)), "not once it was switched off");
  assert.ok(!boot({ blank: true }).modals.some(m => /^Welcome/.test(m.title)), "not in a browser");
  const rec = boot({ blank: true, desktop: { info: true, store: { "pdraft:doc": boot().storage["pdraft:doc"] } } });
  assert.deepStrictEqual(rec.modals.map(m => m.title), ["Recover unsaved work?"], "the recovery question alone");
  // ticked and closed: kept switched off
  const r = boot({ blank: true, script: `app.modalAnswer = () => "start"; app.ev("welcomeDialog")(false); return app.storage.get("pdraft:welcome");` });
  assert.strictEqual(r.result, "off", "opened from Help it starts ticked, and Start keeps it so");
});

test("File ▸ Open Example: each example is sewn and placed on a built-in avatar, opens as a new document with no file, and asks about unsaved work first", () => {
  const E = require("../examples/examples.js");
  assert.deepStrictEqual(E.map(e => e.name), ["Straight skirt on Marty", "T-shirt on Marty", "Straight skirt on Jessica"]);
  for (const e of E) {
    assert.ok(e.doc.pieces.length === 4 && e.doc.pieces.every(p => p.p3), e.name + ": four patterns, each placed in 3D");
    assert.ok(e.doc.seams.length >= 8, e.name + ": sewn"); assert.ok(!e.doc.drape && !e.doc.history, e.name + ": not draped, no history");
    assert.ok(["marty", "jessica"].includes(e.doc.scene.avatar.preset), e.name);
  }
  const r = boot({ desktop: true, script: `
    const out = {}, row = app.MENUS.file().find(x => x && x.n === "Open Example");
    out.rows = row.menu().map(x => x.n);
    app.ev("push")("Move"); S.pieces[0].pts[0].x += 1; app.commit(); S.dirty = true;
    const n = modals => 0; row.menu()[1].f();
    out.asked = app.ev("modalNow") ? app.ev("modalNow").title : null;
    out.names = S.pieces.map(p => p.name); out.seams = S.seams.length; out.layout = S.ui.layout; out.title = app.title(); out.toast = toasts[toasts.length - 1];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result.rows, E.map(e => e.name));
  assert.ok(r.modals.some(m => m.title === "Unsaved changes"), "asked first: " + r.modals.map(m => m.title));
  assert.deepStrictEqual(r.result.names, ["Front", "Back", "Left sleeve", "Right sleeve"]); assert.strictEqual(r.result.seams, 8);
  assert.deepStrictEqual([r.result.layout, r.result.title], ["both", "Gusset – Pattern Drafter"], "the 3D window beside the 2D one; no file (Save asks where)");
  assert.ok(/^Opened T-shirt on Marty/.test(r.result.toast), r.result.toast);
});

// (Round desk-2) no check that starts the app may read, move or delete the user's own data folder
test("a check that starts the desktop app gets a fresh data folder in the temp folder (PDRAFT_USER_DATA, set before the one-window lock), and only a folder inside the temp folder is ever deleted", () => {
  const TD = require("../../desktop/test-data.js"), os = require("os");
  const f = TD.fresh("unit");
  assert.ok(TD.inTemp(f.dir) && fs.existsSync(f.data) && fs.readdirSync(f.data).length === 0, f.dir);
  assert.strictEqual(f.env.PDRAFT_USER_DATA, f.data); assert.ok(!("ELECTRON_RUN_AS_NODE" in f.env));
  TD.remove(f.dir);
  assert.ok(!fs.existsSync(f.dir));
  // anything outside the temp folder is refused and left as it is: the project, the home folder, the temp folder itself
  // (Round r28: a copy of the project that lies inside the temp folder is not asked about: the helper would rightly delete it,
  // and did, mid-run, in the first check of the public export from a temp folder)
  for (const d of [...(TD.inTemp(ROOT) ? [] : [path.join(ROOT, "drafter")]), os.homedir(), os.tmpdir()]) {
    assert.throws(() => TD.remove(d), /refused/, d);
    assert.ok(fs.existsSync(d));
  }
  const main = fs.readFileSync(path.join(ROOT, "desktop", "main.js"), "utf8"), set = main.indexOf('app.setPath("userData"'), lock = main.indexOf("requestSingleInstanceLock()");
  assert.ok(set > 0 && set < main.indexOf("app.getPath(\"userData\")") && set < lock, "PDRAFT_USER_DATA is set before the data folder is read and before the lock");
  // the scripts that start the app take their data folder from the helper, and none names the user's own
  for (const s of ["desktop/smoke.js", "desktop/shots.js", "scripts/start-built.js"]) {
    const t = fs.readFileSync(path.join(ROOT, s), "utf8");
    assert.ok(/test-data[.]js/.test(t) && /PDRAFT_USER_DATA|fresh[.]env/.test(t), s);
    assert.ok(!/APPDATA|Application Support|[.]config/.test(t.replace(/^\s*\/\/.*$/gm, "")), s + " names the user's data folder");
  }
});

module.exports = T;
