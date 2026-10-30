// Round icon-1: the app icon and the logo. The desktop build's icons (desktop/icons/: the .ico and .icns are made of the
// PNGs there by scripts/make-icons.js), the browser tab's icon, the mark in the About and welcome boxes, and the files
// the logo's rights are written in (TRADEMARKS.md: all rights reserved, not under the code licence).
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pageHTML } = require("./harness");

const ROOT = path.join(__dirname, "..", ".."), ICONS = path.join(ROOT, "desktop", "icons");
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-icons-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after 60 s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "desktop", "package.json"), "utf8"));
const png = (n) => fs.readFileSync(path.join(ICONS, "png", n + "x" + n + ".png"));
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];
// the pictures in an .ico: [width, PNG bytes] each (0 in the directory means 256)
function icoPics(buf) {
  assert.deepStrictEqual([buf.readUInt16LE(0), buf.readUInt16LE(2)], [0, 1], "an icon file");
  return Array.from({ length: buf.readUInt16LE(4) }, (_, i) => {
    const e = 6 + 16*i, len = buf.readUInt32LE(e + 8), at = buf.readUInt32LE(e + 12);
    return [buf[e] || 256, buf.subarray(at, at + len)];
  });
}
// the chunks of an .icns: { type: bytes }
function icnsChunks(buf) {
  assert.strictEqual(buf.toString("latin1", 0, 4), "icns"); assert.strictEqual(buf.readUInt32BE(4), buf.length, "its length is the file's");
  const out = {};
  for (let at = 8; at < buf.length; ) { const len = buf.readUInt32BE(at + 4); out[buf.toString("latin1", at, at + 4)] = buf.subarray(at + 8, at + len); at += len; }
  return out;
}
const ICNS = { icp4: 16, icp5: 32, icp6: 64, ic07: 128, ic08: 256, ic09: 512, ic10: 1024, ic11: 32, ic12: 64, ic13: 256, ic14: 512 };

test("the app icon: every size of the transparent red mark is there; the Windows .ico and the macOS .icns hold exactly those PNGs", () => {
  for (const n of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) assert.deepStrictEqual(pngSize(png(n)), [n, n], n + "x" + n + ".png");
  const ico = icoPics(fs.readFileSync(path.join(ICONS, "icon.ico")));
  assert.deepStrictEqual(ico.map(p => p[0]), [16, 24, 32, 48, 64, 128, 256], "16 to 256 px");
  for (const [n, b] of ico) assert.ok(b.equals(png(n)), "the .ico's " + n + " px is png/" + n + "x" + n + ".png (node scripts/make-icons.js)");
  const icns = icnsChunks(fs.readFileSync(path.join(ICONS, "icon.icns")));
  assert.deepStrictEqual(Object.keys(icns).sort(), Object.keys(ICNS).sort());
  for (const [t, n] of Object.entries(ICNS)) assert.ok(icns[t].equals(png(n)), "the .icns's " + t + " is png/" + n + "x" + n + ".png (node scripts/make-icons.js)");
  // the rounded square, kept beside it until the maintainer chooses: every size, each a PNG of its size
  const r = icnsChunks(fs.readFileSync(path.join(ICONS, "icon-rounded.icns")));
  assert.deepStrictEqual(Object.keys(r).sort(), Object.keys(ICNS).sort());
  for (const [t, n] of Object.entries(ICNS)) assert.deepStrictEqual(pngSize(r[t]), [n, n], "icon-rounded.icns " + t);
});

test("the desktop build uses them: the .ico on Windows, the transparent .icns on macOS (for now), the PNG folder on Linux; the window has it when run from source", () => {
  assert.strictEqual(PKG.build.win.icon, "icons/icon.ico");
  assert.strictEqual(PKG.build.mac.icon, "icons/icon.icns", "the transparent mark until the maintainer chooses the rounded one (icons/icon-rounded.icns)");
  assert.strictEqual(PKG.build.linux.icon, "icons/png", "a folder of <n>x<n>.png");
  for (const k of ["win", "mac", "linux"]) assert.ok(fs.existsSync(path.join(ROOT, "desktop", PKG.build[k].icon)), k);
  // (nothing that decides the app's data folder changed with the icon; Round rename-1 changed them, with the data copied over:
  // rename.test.js)
  assert.strictEqual(PKG.productName, "Gusset – Pattern Drafter");      // (Round r24 follow-up: the name in full; it was "Gusset")
   assert.strictEqual(PKG.build.appId, "com.gussetdrafter.gusset-pattern-drafter");      // (Round r24 follow-up: the project's own id)
  const main = fs.readFileSync(path.join(ROOT, "desktop", "main.js"), "utf8");
  assert.ok(/app\.isPackaged \? \{\} : \{ icon: path\.join\(__dirname, "icons"/.test(main), "run from source, the window shows the icon");
});

test("the page: the browser tab's icon is the transparent red mark; every logo file the page names exists and is packed by the desktop build", () => {
  const html = pageHTML(), js = fs.readFileSync(path.join(ROOT, "drafter", "pattern-drafter.js"), "utf8");
  assert.ok(/<link rel="icon" type="image\/svg\+xml" href="assets\/brand\/gusset-icon-transparent\.svg">/.test(html), "the tab's icon");
  const named = [...new Set((html + js).match(/assets\/brand\/[\w.-]+/g))];
  // (Round rename-1) the wordmark too, in the About and welcome boxes; (Round r24) the mark sewing itself, the start-up splash
  assert.deepStrictEqual(named.sort(), ["assets/brand/gusset-icon-transparent.svg", "assets/brand/gusset-mark-sewn.svg", "assets/brand/gusset-mark.svg", "assets/brand/gusset-wordmark-white.svg"]);
  const filter = PKG.build.extraResources.find(r => r.from === "../drafter").filter;
  for (const f of named) {
    assert.ok(fs.existsSync(path.join(ROOT, "drafter", f)), f);
    assert.ok(filter.includes(f), f + ": desktop/package.json must pack it (extraResources)");
    const svg = fs.readFileSync(path.join(ROOT, "drafter", f), "utf8");
    if (/wordmark/.test(f)) assert.ok(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*><title>Gusset<\/title><path fill="#FAFAF7"/.test(svg), f + ": the wordmark, in warm white for the dark boxes");
    else assert.ok(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>[\s\S]*fill-rule="evenodd"/.test(svg), f + ": the mark, one path with its hole");
  }
});

// (Round rename-1) the mark and the wordmark side by side in both boxes (the lockup), the name's full form under it
test("Help ▸ About shows the logo, the name in full and what it stands for; the welcome box shows the logo and the name only; the licence notes stay", () => {
  const r = boot({ blank: true, script: `app.modalAnswer = () => "ok"; app.ev("aboutDialog")(); app.modalAnswer = () => "start"; app.ev("welcomeDialog")(false); return 1;` });
  assert.deepStrictEqual(r.errors, []);
  // (Round r24 follow-up) the name in full in every title: "Gusset – Pattern Drafter" (it was "Gusset")
  const about = r.modals.find(m => m.title === "Gusset – Pattern Drafter"), welcome = r.modals.find(m => /^Welcome/.test(m.title));
  assert.ok(about && welcome, r.modals.map(m => m.title).join());
  const MARK = '<div class="mhead"><div class="lockup"><img src="assets/brand/gusset-mark.svg" alt="" width="45" height="36"><img src="assets/brand/gusset-wordmark-white.svg" alt="Gusset" width="203" height="46"></div>';
  assert.ok(about.text.startsWith(MARK + "<div><b>Gusset – Pattern Drafter</b><br><i>Garment Utility for Sewing, Simulation &amp; Engineering Tools</i><br><b>Version "), about.text.slice(0, 300));
  assert.ok(about.text.includes("TRADEMARKS.md") && /license covers the code only/.test(about.text), "the logo is not under the code licence");
  assert.ok(/GNU General Public License/.test(about.text) && /either version 3 of the License, or \(at your option\) any later version/.test(about.text));
  assert.ok(welcome.text.startsWith(MARK + "<div><b>Gusset – Pattern Drafter</b>: a free program for drafting"), welcome.text.slice(0, 300));
  assert.strictEqual(welcome.title, "Welcome to Gusset – Pattern Drafter");            // (Round r24: no version in a title; its follow-up: the name in full)
  assert.ok(!/Garment Utility/.test(welcome.text), "the name's meaning is in the About box only");
});

test("TRADEMARKS.md: at the root, released and packed; the logo all rights reserved, the code licence for the code only, forks with their own name and icon", () => {
  const t = fs.readFileSync(path.join(ROOT, "TRADEMARKS.md"), "utf8");
  assert.ok(/covers the \*\*code only\*\*/.test(t) && /All rights reserved/.test(t), "all rights reserved, code licence for the code only");
  assert.ok(/unchanged/.test(t) && /own name/.test(t) && /own icon/.test(t), "talking about it with the unchanged logo; forks with their own name and icon");
  // (the r24 follow-up's last step: the project's own contact address in place of the placeholder)
  assert.ok(/Questions or permission requests: \[contact@gussetdrafter\.com\]\(mailto:contact@gussetdrafter\.com\)/.test(t), "the project's contact address");
  assert.ok(t.includes("drafter/assets/brand/") && t.includes("desktop/icons/"), "names where the logo's files are");
  assert.ok(!/\blogo\/|private\//.test(t), "names no folder that is not released");
  const root = PKG.build.extraResources.find(r => r.from === "..").filter;
  assert.ok(root.includes("TRADEMARKS.md"), "packed into the desktop build beside LICENSE");
  // (the manifest is not released: in a release copy this is not checked)
  const mf = path.join(ROOT, "RELEASE-MANIFEST.md");
  if (fs.existsSync(mf)) assert.ok(/^\/TRADEMARKS\.md\b/m.test(fs.readFileSync(mf, "utf8")), "released");
  assert.ok(/\[`TRADEMARKS\.md`\]\(TRADEMARKS\.md\)/.test(fs.readFileSync(path.join(ROOT, "README.md"), "utf8")), "the README points to it");
});

module.exports = T;
