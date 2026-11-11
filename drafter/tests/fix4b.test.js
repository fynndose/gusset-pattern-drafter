// Round FIX-4b: batch A, the beta.8 gate's cut (the gate report): what a tester sees with default settings works,
// and what is not ready is hidden. G1 the switch off by default; G2 not-built keys; G3 the 2D menu's block-drafting row; G4 Fullness rows; G5 Display
// ▸ Window; G6 Help's hint row; G7 the BOM's buttons; G8 the 2D Snapshot's Preset; G9 Edit Texture (Grainline).
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-fix4b-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
// every menu-bar row, walked to the bottom: [path, off]
const WALK = `
  const rows = [];
  const walk = (items, p, d) => { if (d > 6) return; for (const it of (items || [])) { if (!it || it.sep || it.hd) continue; const n = String(it.n || "");
    rows.push([p + " > " + n, !!it.off, it]); if (it.menu) walk(it.menu(), p + " > " + n, d + 1); } };
  const walkAll = () => { rows.length = 0; for (const k of Object.keys(app.MENUS)) walk(app.MENUS[k](), k, 0); return rows; };
  walkAll();`;
const AGAIN = "walkAll();";

test("FIX-4b / A G1: Show Tools That Are Not Built Yet is off in a fresh profile (browser) and in the desktop app's fresh data folder; a stored choice is kept, on or off", () => {
  const r = boot({ blank: true, freshUnbuilt: true, script: "return S.ui.unbuilt;" });
  assert.strictEqual(r, false, "a fresh browser profile");
  assert.strictEqual(boot({ blank: true, desktop: true, freshUnbuilt: true, script: "return S.ui.unbuilt;" }), false, "the desktop app with a fresh data folder");
  assert.strictEqual(boot({ blank: true, uiSaved: JSON.stringify({ unbuilt: true }), script: "return S.ui.unbuilt;" }), true, "switched on before: kept");
  assert.strictEqual(boot({ blank: true, uiSaved: JSON.stringify({ unbuilt: false }), script: "return S.ui.unbuilt;" }), false);
});

test("FIX-4b / A G1: with default settings no menu-bar row says \"not built\" (and with the switch on they are there, greyed)", () => {
  const r = boot({ blank: true, freshUnbuilt: true, script: WALK + `
    const off = rows.filter(([p]) => /not built/i.test(p) && !/Show Tools That Are Not Built Yet/.test(p)).length;
    S.ui.unbuilt = true; ${AGAIN}
    return { off, on: rows.filter(([p]) => /not built/i.test(p) && !/Show Tools That Are Not Built Yet/.test(p)).length };` });
  assert.strictEqual(r.off, 0);
  assert.ok(r.on > 150, "the switch on shows them: " + r.on);
});

test("FIX-4b / A G2: the Keyboard Shortcuts box lists no not-built key with the switch off, and such a key then does nothing; with it on both are back", () => {
  const r = boot({ blank: true, freshUnbuilt: true, script: `
    const has = () => { const rows = app.shortcutsDialog(); app.ev("hideDlg")(); return rows.some(([k, n]) => /not built/.test(n)); };
    const t0 = toasts.length; const kept = app.keyTable().find(x => x.id === "kept:O");
    const off = has(); kept.f(); const saidOff = toasts.length - t0;
    S.ui.unbuilt = true; const on = has(); kept.f(); const saidOn = toasts.slice(t0).join(" ");
    return { off, saidOff, on, saidOn, sec: app.ev("shortcutsMarkdown")().includes("Kept for what is not built yet") };` });
  assert.strictEqual(r.off, false, "not listed with the switch off");
  assert.strictEqual(r.saidOff, 0, "the key says nothing with the switch off");
  assert.strictEqual(r.on, true, "listed with the switch on");
  assert.ok(/Colorway is not built yet/.test(r.saidOn), r.saidOn);
  const readme = fs.readFileSync(path.join(__dirname, "..", "..", "README.md"), "utf8");
  assert.ok(!/not built yet/.test(readme), "the README's key list is a fresh start's: none of them");
});

test("FIX-4b / A G3 G4 G9: the 2D menu's block-drafting row (the tool pattern_drafter) opens New Block…; Fullness (Line) is a row only with the switch on (Fullness (Point) is the built Fullness tool); Fabric > Texture names Edit Texture (Grainline)", () => {
  const r = boot({ blank: true, freshUnbuilt: true, script: WALK + `
    const pd = rows.find(([p]) => p === "2d > " + app.ev("TOOLS").pattern_drafter.n);
    const full = rows.filter(([p]) => /Fullness \\((Point|Line)\\)/.test(p)).map(([p]) => p);
    const tex = rows.filter(([p]) => p.startsWith("fabric > Texture > ")).map(([p]) => p);
    S.ui.unbuilt = true; ${AGAIN}
    return { pdOff: pd[1], full, tex, fullOn: rows.filter(([p]) => /Fullness \\((Point|Line)\\)/.test(p)).length };` });
  assert.strictEqual(r.pdOff, false);
  assert.deepStrictEqual(r.full, ["2d > Edit > Fullness (Point)"], "the menu's Fullness (Point) is the built five-click Fullness tool (toolRow(…, \"fullness\")): it stays; Fullness (Line), which only pointed to the right-click, goes");
  assert.strictEqual(r.fullOn, 2);
  // (Round BETA8-1 / C, 2.C24: the fabric's texture follows the grainline, so the tool is Edit Texture (2D) again, as the reference names it)
  assert.deepStrictEqual(r.tex, ["fabric > Texture > Edit Texture (2D)", "fabric > Texture > Edit Texture (3D)"]);
});

test("FIX-4b / A G3: the 2D menu's block-drafting row (pattern_drafter) opens the New Block box", () => {
  const r = boot({ blank: true, freshUnbuilt: true, script: WALK + `
    rows.find(([p]) => p === "2d > " + app.ev("TOOLS").pattern_drafter.n)[2].f();
    return app.el("dlg").innerHTML;` });
  assert.ok(/Straight skirt/.test(r), "the New Block box (the skirt block's): " + String(r).slice(0, 200));
});

test("FIX-4b / A G5 G6: Display > Window > Object Browser folds and unfolds it; Property Editor only with the switch on; Help's row is the Show Tool Hints switch", () => {
  const r = boot({ blank: true, freshUnbuilt: true, script: WALK + `
    const win = rows.filter(([p]) => p.startsWith("settings > Display > Window > ")).map(([p, off]) => [p.split(" > ").pop(), off]);
    const ob = rows.find(([p]) => p === "settings > Display > Window > Object Browser")[2];
    const was = S.ui.obFold; ob.f(); const fold = S.ui.obFold;
    const help = rows.filter(([p]) => p.startsWith("help > ")).map(([p, off]) => [p.split(" > ").pop(), off]);
    rows.find(([p]) => p === "help > Show Tool Hints")[2].f();
    return { win, was, fold, help, hints: S.prefs.showHints, pe: (() => { S.ui.unbuilt = true; ${AGAIN} return rows.some(([p]) => p === "settings > Display > Window > Property Editor"); })() };` });
  assert.ok(r.win.some(([n, off]) => n === "Object Browser" && !off), JSON.stringify(r.win));
  assert.ok(!r.win.some(([n]) => n === "Property Editor"), "no greyed Property Editor row with the switch off");
  assert.strictEqual(r.pe, true);
  assert.strictEqual(r.was, false); assert.strictEqual(r.fold, true);
  assert.ok(!r.help.some(([, off]) => off), "no greyed row in Help: " + JSON.stringify(r.help));
  assert.ok(r.help.some(([n]) => n === "Show Tool Hints"));
  assert.strictEqual(r.hints, true);
});

test("FIX-4b / A G7: the BOM counts the buttons and buttonholes placed, per type, and its note no longer says the Button tool is not built", () => {
  const r = boot({ blank: true, freshUnbuilt: true, script: `
    const P = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:400}], true)); app.push("A"); S.pieces.push(P);
    const L = app.libOf();
    S.buttons = [{ id: 1, kind: "button", piece: P.id, x: 50, y: 50, angle: 0, lib: L.button[0].id }, { id: 2, kind: "button", piece: P.id, x: 80, y: 50, angle: 0, lib: null },
      { id: 3, kind: "hole", piece: P.id, x: 50, y: 90, angle: 0, lib: L.buttonhole[0].id }];
    app.commit();
    const b = app.ev("bomData")(), xml = app.ev("bomXML")();
    app.ev("bomView")(); const html = app.el("bom") ? app.el("bom").innerHTML : "";
    return { buttons: b.buttons.map(x => [x.kind, x.placed]), xml: /<buttonhole [^>]*placed="1"/.test(xml) && /<button [^>]*placed="2"/.test(xml), src: app.ev("bomView").toString().includes("not built") };` });
  assert.deepStrictEqual(r.buttons, [["Button", 2], ["Buttonhole", 1]]);
  assert.ok(r.xml, "the XML says so too");
  assert.strictEqual(r.src, false, "the note says what is counted");
});

test("FIX-4b / A G8: the 2D Snapshot box shows its one-entry Preset list only with the switch on", () => {
  const r = boot({ blank: true, freshUnbuilt: true, script: `
    const P = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:400}], true)); app.push("A"); S.pieces.push(P); app.commit();
    const out = []; for (const nb of [false, true]) { S.ui.unbuilt = nb; app.ev("snap2Dialog")(); out.push(/<label>Preset<\\/label>/.test(app.el("dlg").innerHTML)); app.ev("hideDlg")(); }
    return out;` });
  assert.deepStrictEqual(r, [false, true]);
});

module.exports = T;
