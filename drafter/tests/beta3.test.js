// 1.0.0-beta.3: a 3D picture never larger than the graphics card draws (THE GRAPHICS CARD'S LIMIT: cardPx(), pxMax3(), renderHere(), cardHeld(),
// view3d.shot()'s drawing-buffer check). The card's limit is set by hand here (CARD_PX): the test page has no WebGL of its own.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });

function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-beta3-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}
const APP = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8");

// a document asking for a render of w x h (a preset when size names one), shown; what the session renders, the line said, the pane, and what a typed size does
const SCRIPT = (card, render) => `
  const out = {};
  return app.wait(() => app.view3d.ready(), "the 3D window").then(() => {
    app.ev("CARD_PX = ${card}");
    const doc = JSON.parse(app.docJSON()); doc.render = ${JSON.stringify(render)};
    // (the line is put up a moment later: run at once here)
    const G = app.ev("globalThis"), later = G.setTimeout; G.setTimeout = (f) => { f(); return 0; };
    app.ev("loadDoc")(doc); toasts.length = 0; try { app.ev("showDoc")(); } finally { G.setTimeout = later; }
    out.toasts = toasts.slice();
    const o = app.ev("loadRender")(); out.render = [o.size, o.w, o.h];
    out.held = app.ev("cardHeld")();
    out.pane = app.ev("rwinImageHTML")(o);
    app.ev("renderWindow")(); app.ev("rwinSet")("samples", { value: "64", dataset: { num: "1" } });
    out.saved = [app.ev("S.render").size, app.ev("S.render").w, app.ev("S.render").h, app.ev("S.render").samples];
    toasts.length = 0;
    app.ev("rwinSet")("w", { value: "20000", dataset: { num: "1" } });
    out.typed = [app.ev("loadRender")().w, app.ev("S.render").w, toasts.slice(), !!app.ev("modalNow")];
    app.ev("closeModal")();
    out.snap = app.ev("snap3Size")({ preset: "custom", unit: "px", w: 12000, h: 3000, ppi: 300 });
    out.snapHint = app.ev("pxLimitHint")();
    app.ev("rwinClose")();
    return out;
  });`;

test("beta3 / 1: the desktop app on a card of 8192: a file asking for 12000 x 6000 renders at 8192 x 6000, one line says so, the file keeps its size (also after another setting is changed); the pane shows the limit; a size typed past it is set at it with a line, no box; the 3D snapshot too", () => {
  const b = boot({ desktop: true, three: true, script: SCRIPT(8192, { mode: "quick", size: "custom", w: 12000, h: 6000 }) }).result;
  assert.deepStrictEqual(b.render, ["custom", 8192, 6000]);
  assert.strictEqual(b.held, "Its 12000 × 6000 render is made at most 8192 pixels a side here: this graphics card's limit. The file keeps its own size.");
  assert.ok(b.toasts.includes(b.held), JSON.stringify(b.toasts));
  assert.ok(/At most 8192 pixels a side: this graphics card's limit[.]/.test(b.pane) && !/lock/.test(b.pane), "the limit beside the fields, no lock: the desktop app would not help");
  assert.deepStrictEqual(b.saved, ["custom", 12000, 6000, 64], "Samples changed: the file's size stays");
  assert.deepStrictEqual(b.typed.slice(0, 2), [8192, 8192], "typed past the limit: set at it, and that is the document's now");
  assert.ok(b.typed[2].some(t => /at most 8192 pixels a side: set at 8192/.test(t)), JSON.stringify(b.typed[2]));
  assert.strictEqual(b.typed[3], false, "no box");
  assert.deepStrictEqual(b.snap, { w: 8192, h: 3000 });
  assert.ok(/8192/.test(b.snapHint));
});

test("beta3 / 1: a preset larger than the card (3840 x 2160 on a card of 2048) renders as 2048 a side, and the file keeps its preset; on a card of no limit (none known) nothing changes and nothing is said", () => {
  const b = boot({ desktop: true, three: true, script: SCRIPT(2048, { mode: "quick", size: "3840x2160" }) }).result;
  assert.deepStrictEqual(b.render, ["custom", 2048, 2048]);
  assert.ok(/3840 × 2160 render is made at most 2048/.test(b.held), b.held);
  assert.strictEqual(b.saved[0], "3840x2160", "the preset stays the document's");
  const d = boot({ desktop: true, three: true, script: SCRIPT(Infinity, { mode: "quick", size: "custom", w: 12000, h: 6000 }) }).result;
  assert.deepStrictEqual([d.render, d.held, d.snap, d.snapHint], [["custom", 12000, 6000], "", { w: 12000, h: 3000 }, ""]);
  assert.ok(!/At most/.test(d.pane));
});

test("beta3 / 1: the browser: on a card of 8192 the browser's 4096 holds as in Round r32 (the lock, the box); on a card of 2048 the card holds: its line, no box, since the desktop app would not help", () => {
  const b = boot({ three: true, script: SCRIPT(8192, { mode: "quick", size: "custom", w: 6000, h: 6000 }) }).result;
  assert.deepStrictEqual(b.render, ["custom", 4096, 4096]);
  assert.strictEqual(b.held, "", "the browser's own line says it (browserHeld())");
  assert.ok(/class="hint locked"><svg class="lock"/.test(b.snapHint) && /At most 4096 pixels a side in a browser; more in the desktop app[.]/.test(b.snapHint), b.snapHint);
  assert.strictEqual(b.typed[3], true, "the desktop app's box");
  const c = boot({ three: true, script: SCRIPT(2048, { mode: "quick", size: "custom", w: 6000, h: 6000 }) }).result;
  assert.deepStrictEqual(c.render, ["custom", 2048, 2048]);
  assert.ok(/6000 × 6000 render is made at most 2048/.test(c.held), c.held);
  assert.ok(c.toasts.some(t => t === c.held) && !c.toasts.some(t => /Only in the desktop app/.test(t)), JSON.stringify(c.toasts));
  assert.deepStrictEqual([c.typed[0], c.typed[3]], [2048, false]);
});

test("beta3 / 1: view3d.shot(): where the card gives a smaller drawing buffer than asked, it tries without supersampling, and if that is still too small it makes no picture, says why and keeps what the card held as the limit for the session, never a picture drawn wrong", () => {
  const b = boot({ desktop: true, three: true, script: `
    return app.wait(() => app.view3d.ready(), "the 3D window").then(() => {
      const R = app.view3d.renderer(), out = {};
      const give = (gw, gh) => { R.getContext = () => ({ drawingBufferWidth: gw, drawingBufferHeight: gh }); };
      give(100, 100); out.small = [app.view3d.shot(400, 300) === null, app.view3d.shotShort(), app.ev("shotWhy")()];
      out.learned = app.ev("cardPx()"); app.ev("CARD_PX = Infinity");
      give(500, 500); out.ss = [app.view3d.shot(400, 300, null, null, false, { ss: 2 }) !== null, app.view3d.shotShort()];
      return out;
    });` }).result;
  assert.deepStrictEqual(b.small.slice(0, 2), [true, { w: 400, h: 300, gw: 100, gh: 100, most: 100 }]);
  assert.strictEqual(b.small[2], ": the graphics card gave 100 × 100 pixels for 400 × 300. From now on pictures are at most 100 pixels a side here: try again.");
  assert.strictEqual(b.learned, 100, "what the card really held is the session's limit");
  assert.deepStrictEqual(b.ss, [true, null], "800 x 600 did not fit; 400 x 300 did");
  assert.ok(/The render could not be made here" [+] shotWhy[(][)]/.test(APP) && /The 3D picture could not be made here" [+] shotWhy[(][)]/.test(APP), "the boxes say why");
});

test("beta3 / 2: the download page: Windows offers the installer alone as the big button, the portable under Other downloads with why; a Mac both chips' disk images, the .zip under Other downloads; Linux the AppImage and nothing else", () => {
  const D = require(path.join(__dirname, "..", "..", "website", "assets", "download.js"));
  const f = (os, kind, arch) => ({ os, kind, arch, url: os + "-" + kind + "-" + arch, size: 1 });
  const rel = { files: [f("mac", "zip", "arm64"), f("mac", "dmg", "x64"), f("mac", "dmg", "arm64"), f("windows", "portable", "x64"), f("windows", "installer", "x64"), f("linux", "appimage", "x64")] };
  assert.deepStrictEqual(D.buttonsFor(rel, "windows").map(x => x.kind), ["installer"]);
  assert.deepStrictEqual(D.othersFor(rel, "windows").map(o => [o.file.kind, o.why]), [["portable", "Starts slower (it unpacks itself each time). Use it if you can't install."]]);
  assert.deepStrictEqual(D.buttonsFor(rel, "mac").map(x => x.kind + " " + x.arch), ["dmg arm64", "dmg x64"]);
  assert.deepStrictEqual(D.othersFor(rel, "mac").map(o => [o.file.kind, o.why]), [["zip", "The same app as the disk image, in a .zip archive."]]);
  assert.deepStrictEqual([D.buttonsFor(rel, "linux").map(x => x.kind), D.othersFor(rel, "linux")], [["appimage"], []]);
  assert.deepStrictEqual([D.buttonsFor({ files: [] }, "windows"), D.othersFor({ files: [] }, "windows")], [[], []]);
  const page = fs.readFileSync(path.join(__dirname, "..", "..", "website", "download.html"), "utf8");
  assert.ok(page.includes('<div id="dl-other" hidden></div>'), "its place on the page, hidden until there is something to list");
});

module.exports = T;
