// Round BETA8-1: the last round before beta.8. Batch 0 the beta.8 gate's G10 (Edit ▸ Context Menu ▸ 2D Pattern's line rows); the
// pull that went through the body (PULL-1) is in beta8pull.test.js; the 22 rows of the beta.8 cut follow, a test (or more) each.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-beta8-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
// a pattern A (200 × 400) with an open internal line across its middle, B beside it
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
  const B = app.mkPiece("B", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:400},{x:300,y:400}], true));
  S.pieces.push(A, B); app.commit();
  S.sel = [A.id]; S.selPt = S.selSeg = S.selInt = -1; S.selKind = "outline";
  { const L = app.mkShape([{x:0,y:200},{x:200,y:200}], false); app.ev("addChild")(A, "internals", L); }
  app.commit(); S.undo.length = 0; S.redo.length = 0;
  const steps = () => S.undo.length;
  const p2 = () => app.MENUS.edit().find(r => r && r.n === "Context Menu").menu().find(r => r && r.n === "2D Pattern").menu().filter(Boolean);
  const NAMES = ["Convert to Curve Point", "Offset as Internal Line", "Offset as Seamless Block Line", "Unfold", "Unfold Pattern Outline Only", "Unfold Symmetric Editing (with Sewing)", "Change Length", "Cut", "Cut & Sew", "Extend/Trim", "Extend/Trim & Add Point"];
  const mine = () => p2().filter(r => NAMES.includes(r.n));
  const out = {};`;

test("BETA8-1 / 0 G10: Edit ▸ Context Menu ▸ 2D Pattern's 11 line rows: with nothing selected they are hidden with the not-built switch off and greyed \"select a line\" with it on; with a line selected each is that line's own right-click row and runs its command (Change Length on an outline line, Cut on an internal line, Convert to Curve Point on a point), one step each; rows its menu lacks are hidden; the selection stays as it was", () => {
  const o = boot({ script: DOC + `
    S.ui.unbuilt = false; out.none = mine().map(r => r.n);
    S.ui.unbuilt = true; out.noneOn = mine().map(r => [r.n, !!r.off, r.note]);
    S.ui.unbuilt = false;
    app.ev("setTool")("edit_pattern");
    // an outline line (the right side, 400 mm): its rows, then Change Length to 450 as the right-click's dialog does
    S.sel = [A.id]; S.selKind = "outline"; S.selInt = -1; S.selSeg = 1;
    out.outline = mine().map(r => r.n);
    out.keep = [S.selKind, S.selInt, S.selSeg, S.sel.slice()];
    let asked = null; app.answer = (t, f) => { asked = t; return { len: 450 }; };
    const s0 = steps(); mine().find(r => r.n === "Change Length").f();
    out.len = [asked, +app.ev("segLen")(A, 1).toFixed(2), steps() - s0];
    // an internal line: Cut makes two patterns, as its right-click does
    S.selKind = "internal"; S.selInt = 0; S.selSeg = 0; S.selPt = -1;
    out.internal = mine().map(r => r.n + (r.menu ? " >" : ""));
    const n0 = S.pieces.length, s1 = steps(); app.answer = null;
    mine().find(r => r.n === "Cut").f();
    out.cut = [S.pieces.length - n0, steps() - s1];
    // a point of B's outline: Convert to Curve Point ▸ its ways
    const Bq = S.pieces.find(p => p.name === "B"); S.sel = [Bq.id]; S.selKind = "outline"; S.selInt = -1; S.selSeg = -1; S.selPt = 1;
    const cc = mine().find(r => r.n === "Convert to Curve Point");
    out.convert = cc && cc.menu ? cc.menu().filter(Boolean).map(r => r.n) : null;
    return out;
  ` });
  assert.deepStrictEqual(o.none, [], "nothing selected, the switch off: hidden");
  assert.strictEqual(o.noneOn.length, 11);
  for (const [n, off, note] of o.noneOn) assert.ok(off && note === "select a line", n + ": greyed with the switch on");
  assert.deepStrictEqual(o.outline, ["Offset as Internal Line", "Offset as Seamless Block Line", "Unfold", "Unfold Pattern Outline Only", "Unfold Symmetric Editing (with Sewing)", "Change Length"], "an outline line's own rows (Cut is an internal line's: hidden)");
  assert.deepStrictEqual(o.keep.slice(0, 3), ["outline", -1, 1], "the selection is left as it was");
  assert.deepStrictEqual(o.len, ["Change Length", 450, 1], "Change Length: its dialog, the line 450 mm, one step");
  assert.deepStrictEqual(o.internal, ["Offset as Internal Line", "Offset as Seamless Block Line", "Change Length", "Cut", "Cut & Sew", "Extend/Trim >", "Extend/Trim & Add Point >"]);
  assert.deepStrictEqual(o.cut, [1, 1], "Cut: A in two, one step");
  assert.ok(Array.isArray(o.convert) && o.convert.length >= 2, "Convert to Curve Point on a point: its ways " + JSON.stringify(o.convert));
});

// a picture (an empty SVG, as text: the page in the tests loads no picture, imgEl() is told it has loaded one of 4 × 2 pixels)
const PNG = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%222%22/%3E";
test("BETA8-1 / C 2.C24: a fabric's texture (a picture and its repeat size, one step) lies on each pattern of that fabric along its grainline: Edit Texture (2D) moving or turning the grainline moves or turns it, in 2D and on the cloth (its picture is drawn again); Repeat tiles it, Unified draws it once; kept in the file with its picture, also when only the history names it; Remove is one step", () => {
  const o = boot({ script: DOC + `
    const fab = app.libOf().fabric[0]; A.fabric = fab.id; app.commit(); S.undo.length = 0;
    const s0 = steps(); app.ev("fabTexSet")(fab, "weave.png", "${PNG}", 4, 2);
    out.tex = [JSON.parse(JSON.stringify(fab.tex)), steps() - s0, S.undo.slice(-1).map(u => u.n || u.tool || "")];
    app.ev("if (typeof Image === 'undefined') globalThis.Image = class {}");
    app.ev("IMG_EL").set(fab.tex.img, { complete: true, naturalWidth: 4, naturalHeight: 2 });
    // drawn: a fake context records what is asked of it
    const rec = []; const ctx = new Proxy({}, { get: (t, k) => k === "createPattern" ? () => ({ setTransform() {} }) : (...a) => rec.push([k, ...a.map(v => typeof v === "number" ? +v.toFixed(4) : typeof v)]), set: (t, k, v) => { rec.push(["=" + String(k)]); return true; } });
    const place = () => { const q = app.ev("texPlace")(A); return q && [+q.o.x.toFixed(2), +q.o.y.toFixed(2), +(q.ang*180/Math.PI).toFixed(2)]; };
    out.drawn = [app.ev("drawFabTex")(ctx, A, () => {}, app.toS, S.view.s), rec.map(r => r[0])];
    out.p0 = place(); const sig0 = app.ev("paintSig")(A);
    // Edit Texture: the grainline's middle dragged 50 right and 20 down, then an end turned
    app.setTool("edit_texture");
    const g0 = app.grainOf(A), mid = { x: (g0.a.x + g0.b.x)/2, y: (g0.a.y + g0.b.y)/2 };
    let a = app.toS(mid), b = app.toS({ x: mid.x + 50, y: mid.y + 20 });
    app.fire("pointermove", { x: a.x, y: a.y }); app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y });
    out.p1 = place(); out.sigMoved = app.ev("paintSig")(A) !== sig0;
    const g1 = app.grainOf(A), m1 = { x: (g1.a.x + g1.b.x)/2, y: (g1.a.y + g1.b.y)/2 }, top = g1.a.y < g1.b.y ? g1.a : g1.b;
    a = app.toS(top); b = app.toS({ x: m1.x + 90, y: m1.y });
    app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y });
    out.p2 = place();
    // Unified: drawn once
    fab.mapping = "Unified"; rec.length = 0; app.ev("drawFabTex")(ctx, A, () => {}, app.toS, S.view.s); out.unified = rec.map(r => r[0]); fab.mapping = "Repeat";
    // the file: the fabric keeps it and the picture goes with it; opened again, the same
    const d = JSON.parse(app.docJSON()); out.file = [JSON.stringify(d.lib.fabric[0].tex) === JSON.stringify(fab.tex), d.images.some(im => im.id === fab.tex.img)];
    app.loadDoc(d); app.commit(); out.back = JSON.stringify(app.libOf().fabric[0].tex) === JSON.stringify(d.lib.fabric[0].tex);
    // Remove: one step; the picture stays in the file while the history names it
    const f2 = app.libOf().fabric[0], s1 = steps(); app.ev("push")("Remove Fabric Texture"); delete f2.tex; app.commit();
    out.removed = [!!f2.tex, steps() - s1, app.ev("usedImages")().length];
    return out;
  ` });
  assert.deepStrictEqual(o.tex.slice(0, 2), [{ img: o.tex[0].img, w: 100, h: 50 }, 1], "100 mm wide, its height from the picture's proportions, one step");
  // tiled: by a repeating pattern where the page has DOMMatrix (a browser), else picture by picture (the test page has none)
  const tiles = o.drawn[1].filter(k => k === "drawImage").length;
  assert.ok(o.drawn[0] && o.drawn[1].includes("clip") && o.drawn[1].includes("rotate") && (o.drawn[1].includes("fillRect") || tiles > 4), "clipped to the pattern, turned with the grain, tiled: " + o.drawn[1].slice(0, 8));
  assert.strictEqual(o.p0[2], 0, "a grainline straight up and down: the picture upright");
  assert.deepStrictEqual([+(o.p1[0] - o.p0[0]).toFixed(1), +(o.p1[1] - o.p0[1]).toFixed(1), o.p1[2]], [50, 20, 0], "moved with the grainline");
  assert.ok(o.sigMoved, "the cloth's picture is drawn again");
  assert.ok(Math.abs(Math.abs(o.p2[2]) - 90) < 1, "turned with the grainline: " + o.p2);
  assert.ok(o.unified.filter(k => k === "drawImage").length === 1 && !o.unified.includes("fillRect"), "Unified: once " + o.unified);
  assert.deepStrictEqual(o.file, [true, true]);
  assert.ok(o.back, "opened again, the same");
  assert.deepStrictEqual(o.removed, [false, 1, 1], "removed in one step; the picture still kept for the history");
});

test("BETA8-1 / C2 1.T58: a pattern's Select All ▸ Layer selects every pattern on the layers of the ones selected, and only those; no step", () => {
  const o = boot({ script: DOC + `
    const C = app.mkPiece("C", app.mkShape([{x:600,y:0},{x:700,y:0},{x:700,y:100},{x:600,y:100}], true)); S.pieces.push(C);
    A.layer = 1; C.layer = 1; B.layer = 0; app.commit(); const s0 = steps();
    const p = app.ev("patternMenu")(A, { x: 100, y: 100 }, { x: 10, y: 10 }, "");
    const row = p.find(r => r.n === "Select All").menu().find(r => r.n === "Layer");
    row.f(); out.layer = [S.sel.map(id => app.ev("byId")(id).name).sort(), steps() - s0, !!row.off];
    return out;
  ` });
  assert.deepStrictEqual(o.layer, [["A", "C"], 0, false]);
});

test("BETA8-1 / C2 1.H18 1.T10 3.C18: the Plotter box lists every line kind and information kind the reference's has (Punch Marks, Graphic Lines, Shrinkage Lines, Buffer Spacing; Buttons / Buttonholes, Nesting Information, Fabric Outline); each prints and plots when on (the 2D print's box leaves out Print Layout's own three); a plotter on a serial port gets the HP-GL through Web Serial with the Port settings chosen", () => {
  const o = boot({ script: DOC + `
    A.punches = [{ x: 100, y: 100, d: 5 }]; A.shrink = { w: 95, h: 100 }; S.buttons = [{ id: 1, kind: "button", piece: A.id, x: 60, y: 60, angle: 0 }];
    app.commit();
    app.setMode("layout"); S.layout.paper = "rollc"; S.layout.customW = 1500; S.layout.margin = 10; S.layout.buffer = { l: 5, r: 5, t: 5, b: 5 }; app.layoutCmd("row");
    // the box: every kind, Print Layout's three marked
    app.ev("plotterDialog")(); const dlg = app.el("dlg"), h = dlg.innerHTML;
    out.lines = ["Punch mark", "Graphic line", "Shrinkage line", "Buffer spacing", "Buttons / buttonholes", "Nesting information", "Fabric outline"].map(n => h.includes(n));
    app.ev("hideDlg")();
    // switched on, the print and the plot file have them
    for (const k of ["punch", "shrink", "buffer"]) S.print.lines[k].show = true; for (const k of ["buttons", "nesting", "fabric"]) S.print.info[k] = true;
    const fk = app.ev("layFabNow")(), job = app.ev("layoutJob")().html;
    out.print = ["punch", "shrink", "buffer", "fabric", "nesting", "buttons"].map(k => job.includes('data-layer="' + k + '"'));
    const plt = app.ev("pltText")(fk).text; out.plt = [/LB[^;]*% used/.test(plt), (plt.match(/PU/g) || []).length];
    // off, gone
    for (const k of ["punch", "shrink", "buffer"]) S.print.lines[k].show = false; for (const k of ["buttons", "nesting", "fabric"]) S.print.info[k] = false;
    const job2 = app.ev("layoutJob")().html; out.off = ["punch", "shrink", "buffer", "fabric", "nesting"].map(k => job2.includes('data-layer="' + k + '"'));
    // the 2D print's own box: not the layout's three
    out.print2 = app.ev("PRINT_LINES").filter(x => !x[2]).map(x => x[0]).includes("buffer");
    // a plotter on a serial port (a stand-in for Web Serial)
    const sent = [], opened = []; app.ev("globalThis.navigator = globalThis.navigator || {}");
    app.ev("navigator").serial = { requestPort: async () => ({ open: async (o) => opened.push(o), close: async () => {}, writable: { getWriter: () => ({ write: async (b) => sent.push(b.length), releaseLock() {} }) } }) };
    app.ev("plotterDialog")(); const d2 = app.el("dlg");
    out.serialRow = d2.innerHTML.includes("Plotter on a serial port");
    d2.onchange({ target: { dataset: { pl: "dev" }, value: "serial" } });
    out.portRows = ["Bits per second", "Data bits", "Parity", "Stop bits", "Flow control"].map(n => app.el("dlg").innerHTML.includes(n));
    app.el("dlg").onchange({ target: { dataset: { port: "baud" }, value: "19200" } });
    out.kept = S.print.plot.port.baud;
    return app.ev("plotSerial")().then(() => { out.sent = [opened.map(x => [x.baudRate, x.dataBits, x.parity, x.stopBits, x.flowControl]), sent.length > 0 && sent[0] > 20]; return out; });
  ` });
  assert.deepStrictEqual(o.lines, [true, true, true, true, true, true, true]);
  assert.deepStrictEqual(o.print, [true, true, true, true, true, true], "printed when on");
  assert.ok(o.plt[0], "the nesting information in the plot file");
  assert.deepStrictEqual(o.off, [false, false, false, false, false], "off: not printed");
  assert.strictEqual(o.print2, false, "the 2D print's box leaves out Buffer spacing");
  assert.ok(o.serialRow); assert.deepStrictEqual(o.portRows, [true, true, true, true, true]);
  assert.strictEqual(+o.kept, 19200);
  assert.deepStrictEqual(o.sent[0], [[19200, 8, "none", 1, "none"]], "opened with the Port settings");
  assert.ok(o.sent[1], "the HP-GL written to the port");
});

test("BETA8-1 / C3 1.T2: the Button tab has a catalogue of ready-made buttons (shirt, blouse, trousers, jacket, coat, jeans, snap, …); one picked becomes a button type of the library, selected, in one step, with its size, thread type and material; saved with the document", () => {
  const o = boot({ script: DOC + `
    app.obSelect("button", null); const items = app.el("ob-items");
    out.bar = Array.from(items.children || []).some(c => String(c.innerHTML || "").includes("Catalogue"));
    let menu = null; app.ev("listMenu = (rows) => { globalThis.__cat = rows; }"); app.ev("catalogueMenu")(10, 10); menu = app.ev("globalThis.__cat").filter(r => !r.hd).map(r => r.n);
    out.menu = menu;
    const n0 = app.libOf().button.length, s0 = steps(); const it = app.ev("catalogueAdd")(9);
    out.added = [app.libOf().button.length - n0, steps() - s0, it.name, it.width, it.thread, it.type, app.ev("obState")().sel === it.id];
    const d = JSON.parse(app.docJSON()); out.saved = d.lib.button.some(b => b.name === it.name && b.width === 17);
    return out;
  ` });
  assert.ok(o.bar, "the Catalogue button under the types");
  assert.ok(o.menu.length >= 10 && o.menu.some(n => /^Shirt/.test(n)) && o.menu.some(n => /^Snap/.test(n)), JSON.stringify(o.menu));
  assert.deepStrictEqual(o.added, [1, 1, "Jeans button, 27 L (17 mm)", 17, "None", "Metal", true]);
  assert.ok(o.saved);
});

test("BETA8-1 / C3 1.T29 2.C35: User Settings has the reference's pages (User Interface, View Controls, Shortcuts, 2D, 3D, Other); on Shortcuts a command's key is changed: the key handler, the menus and the Keyboard Shortcuts box take it, a key another command has is refused, it is a preference kept per machine, and Reset gives the key back", () => {
  const KF = (k, mods) => ({ key: k, code: "Key" + k, ctrlKey: !!(mods || "").includes("c"), shiftKey: !!(mods || "").includes("s"), altKey: false, metaKey: false });
  const o = boot({ script: DOC + `
    app.settingsDialog({ x: 10, y: 10 }); const h = app.el("dlg").innerHTML;
    out.tabs = ["User Interface", "View Controls", "Shortcuts", "2D", "3D", "Other"].map(n => h.includes('>' + n + '</button>'));
    out.page = h.includes('data-page="keys"') && h.includes("Freeze (selected)") && h.includes("Reset All Shortcuts");
    const kf = (e) => { const r = app.ev("keyFind")(e); return r ? r.id : null; };
    out.before = [app.keyOf("freeze3"), kf(${JSON.stringify(KF("K", "c"))})];
    out.refused = app.ev("keySet")("freeze3|Ctrl+K", "Ctrl+H");
    out.ok = app.ev("keySet")("freeze3|Ctrl+K", "Ctrl+Shift+K");
    out.after = [app.keyOf("freeze3"), kf(${JSON.stringify(KF("K", "cs"))}), kf(${JSON.stringify(KF("K", "c"))}), /* (BETA8-1 / 0b: the README (true) lists a fresh start's keys now; the box (false) the keys in force) */ app.ev("shortcutRows")(false).some(r => /Ctrl[+]Shift[+]K/.test(JSON.stringify(r)) && /Freeze/.test(JSON.stringify(r)))];
    app.ev("savePrefs")(); out.stored = JSON.parse(app.ev("localStorage").getItem("pdraft:prefs")).keys;
    app.ev("keySet")("freeze3|Ctrl+K", "Ctrl+K"); out.reset = [app.keyOf("freeze3"), JSON.stringify(app.ev("S.prefs.keys"))];
    return out;
  ` });
  assert.deepStrictEqual(o.tabs, [true, true, true, true, true, true]);
  assert.ok(o.page, "the Shortcuts page lists the commands");
  assert.deepStrictEqual(o.before, ["Ctrl+K", "freeze3"]);
  assert.match(o.refused, /Strengthen/, "a key another command has is refused");
  assert.strictEqual(o.ok, "");
  assert.deepStrictEqual(o.after, ["Ctrl+Shift+K", "freeze3", null, true], "the handler, the menus and the Keyboard Shortcuts box follow");
  assert.deepStrictEqual(o.stored, { "freeze3|Ctrl+K": "Ctrl+Shift+K" }, "a preference");
  assert.deepStrictEqual(o.reset, ["Ctrl+K", "{}"]);
  const again = boot({ storage: { "pdraft:prefs": JSON.stringify({ keys: { "freeze3|Ctrl+K": "Ctrl+Shift+K" } }) }, script: "return app.keyOf('freeze3');" });
  assert.strictEqual(again, "Ctrl+Shift+K", "kept for the next start");
});


test("BETA8-1 / 0b: sending to a plotter on a serial port (tried only on a stand-in) is shown only with Show Tools That Are Not Built Yet on, marked \"needs a real-plotter test\"; with it off a stored serial choice saves and plots the HP-GL file, the box's settings and the PLT export stay", () => {
  const o = boot({ freshUnbuilt: true, script: DOC + `
    app.setMode("layout"); app.layoutCmd("row");
    app.ev("globalThis.navigator = globalThis.navigator || {}");
    let asked = 0; app.ev("navigator").serial = { requestPort: async () => { asked++; throw Object.assign(new Error("x"), { name: "NotFoundError" }); } };
    const files = []; app.setDownload((n) => files.push(n));
    out.off = [!!S.ui.unbuilt];
    app.ev("plotterDialog")(); let h = app.el("dlg").innerHTML;
    out.off.push(h.includes("serial port"), h.includes("HP-GL file (.plt)"), h.includes("Line Options"), h.includes("Bits per second"));
    // a choice stored while the switch was on: kept, but the box shows the HP-GL file, and Plot writes the file without asking for a port
    S.print.plot = { ...S.print.plot, dev: "serial" }; app.ev("plotterDialog")(); h = app.el("dlg").innerHTML;
    out.stored = [/<option value="plt" selected/.test(h), h.includes("Bits per second")];
    out.stored.push(app.ev("plotDev")(), asked, S.print.plot.dev);      // (the test page's querySelector gives one element for every button: Plot's choice is plotDev())
    return app.ev("plotSerial")().then(() => {
      out.stored.push(asked, files.slice());
      S.ui.unbuilt = true; app.ev("plotterDialog")(); h = app.el("dlg").innerHTML;
      out.on = [h.includes("Plotter on a serial port (HP-GL) (not built yet: needs a real-plotter test)"), h.includes("Bits per second")];
      return out;
    });
  ` });
  assert.deepStrictEqual(o.off, [false, false, true, true, false], "switch off: no serial plotter, the rest of the box stays");
  assert.deepStrictEqual(o.stored, [true, false, "plt", 0, "serial", 0, ["pattern-layout.plt"]], "a stored serial choice writes the HP-GL file, asks for no port, and stays stored: " + JSON.stringify(o.stored));
  assert.deepStrictEqual(o.on, [true, true], "switch on: shown, marked as untested");
});

test("BETA8-1 / 0b: a key changed on the Shortcuts page is a preference only: the saved file holds nothing of it, and the same file opened on a fresh profile (and on this one) gives the same document; the README lists a fresh start's keys while the Keyboard Shortcuts box shows the keys in force, the changed one marked, and its Reset to Default gives every key back", () => {
  const PREF = JSON.stringify({ keys: { "freeze3|Ctrl+K": "Ctrl+Shift+K" } });
  const SAVE = `
    const saveBytes = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return got; };
    const b = saveBytes(); let parts = null; app.ev("zipUnpack")(b, (e, q) => { parts = q; });
    out.bytes = Array.from(b); out.doc = app.ev("canonJSON")(app.fileDoc(b));
    out.parts = [...parts].map(x => x[0]); out.leak = [...parts].some(([n, v]) => { let t = ""; for (let i = 0; i < v.length; i++) t += String.fromCharCode(v[i]); return /Shift[+]K|freeze3[|]/.test(t); });`;
  const a = boot({ storage: { "pdraft:prefs": PREF }, script: DOC + `
    out.key = app.keyOf("freeze3");` + SAVE + `
    out.readme = app.ev("shortcutsMarkdown")();
    const rows = app.ev("shortcutsDialog")(); out.dlg = rows.find(r => /^Freeze/.test(r[1]));
    out.reset = app.el("dlg").innerHTML.includes("keys-def");      // (the test page's querySelector gives one element for every button: the last wired, Reset to Default)
    app.el("dlg").querySelector("#keys-def").onclick(); out.after = [app.keyOf("freeze3"), JSON.stringify(S.prefs.keys), JSON.parse(app.ev("localStorage").getItem("pdraft:prefs")).keys, app.el("dlg").innerHTML.includes("keys-def")];
    return out;
  ` });
  assert.strictEqual(a.key, "Ctrl+Shift+K");
  assert.strictEqual(a.leak, false, "no part of the file names the changed key: " + a.parts);
  assert.match(a.readme, /[|] Ctrl[+]K [|] Freeze/, "the README: Freeze's own key");
  assert.doesNotMatch(a.readme, /Ctrl[+]Shift[+]K [|] Freeze/);
  assert.deepStrictEqual(a.dlg, ["Ctrl+Shift+K", a.dlg[1]], "the box: the key in force");
  assert.match(a.dlg[1], /changed; its own key: Ctrl[+]K/, "marked as changed, with its own key");
  assert.ok(a.reset, "Reset to Default while a key is changed");
  assert.deepStrictEqual(a.after, ["Ctrl+K", "{}", {}, false], "every key back, saved at once; the button gone: " + JSON.stringify(a.after));
  // the same file on a fresh profile and on the one with the change: the same document, and saved again the same bytes
  const OPEN = `const out = {}; app.ev("openFile")("k.pdraft", new Uint8Array(${JSON.stringify(a.bytes)}), null, true); app.commit();
    out.key = app.keyOf("freeze3");` + SAVE + ` delete out.bytes; return out;`;
  const fresh = boot({ freshUnbuilt: true, script: OPEN }), mine = boot({ storage: { "pdraft:prefs": PREF }, script: OPEN });
  assert.strictEqual(fresh.key, "Ctrl+K", "a fresh profile keeps its own keys");
  assert.strictEqual(mine.key, "Ctrl+Shift+K");
  assert.strictEqual(fresh.doc, a.doc, "the same document on a fresh profile");
  assert.strictEqual(mine.doc, a.doc, "the same document on this profile");
  assert.strictEqual(fresh.leak || mine.leak, false);
});

test("BETA8-1 / 0b: keys that cannot be given: on a Mac Cmd+H / Q / W / M stay macOS's (refused), Control goes only with H, Q and W (Strengthen's Control+H stays), Cmd is stored as the table's Ctrl; in a browser the browser's own keys are refused; a key kept for a not-built command is refused without naming it while the switch is off, and such commands are not on the page; a command's own key can always be given back", () => {
  const E = (key, m) => ({ key, code: /^[A-Z]$/.test(key) ? "Key" + key : key, ctrlKey: m.includes("c"), metaKey: m.includes("m"), shiftKey: m.includes("s"), altKey: m.includes("a"), preventDefault() {}, stopPropagation() {} });
  const o = boot({ freshUnbuilt: true, script: DOC + `
    const kp = (e) => app.ev("keyPressed")(e), ks = app.ev("keySet");
    app.ev("MAC = true");
    out.mac = [${JSON.stringify(["H", "Q", "W", "M"].map(k => E(k, "m")))}.map(e => kp(e).why || ""),
      kp(${JSON.stringify(E("L", "ms"))}), kp(${JSON.stringify(E("S", "c"))}).why || "", kp(${JSON.stringify(E("H", "c"))}), kp(${JSON.stringify(E("H", "cm"))}).why || "",
      ks("freeze3|Ctrl+K", "Ctrl+M"), app.keyOf("strengthen3") || app.ev("keyTable")().find(r => r.k === "Ctrl+H").k];
    app.ev("MAC = false");
    out.browser = ["Ctrl+W", "Ctrl+T", "Ctrl+N", "F5"].map(k => ks("freeze3|Ctrl+K", k));
    // a not-built command's key (the switch off): refused, its name not given; the page lists no not-built command
    const nb = app.ev("keyTable")().find(r => r.nb && r.k && !r.l && !r.desk && ["draft", "3d", "any"].includes(r.w));
    out.nb = [!!nb, nb ? ks("freeze3|Ctrl+K", nb.k) : "", nb ? nb.n : ""];
    out.page = app.ev("keyPageHTML")();
    out.nbOnPage = app.ev("keyTable")().filter(r => r.nb).some(r => out.page.includes(">" + r.n + "<"));
    // its own key back, whatever: a desktop-only key on a desktop row stays the row's
    ks("freeze3|Ctrl+K", "Ctrl+Shift+K"); out.back = [ks("freeze3|Ctrl+K", "Ctrl+K"), app.keyOf("freeze3")];
    delete out.page; return out;
  ` });
  assert.deepStrictEqual(o.mac[0].map(w => /belongs to macOS/.test(w)), [true, true, true, true], "Cmd+H / Q / W / M: macOS's " + o.mac[0]);
  assert.deepStrictEqual(o.mac[1], { k: "Ctrl+Shift+L" }, "Cmd is the table's Ctrl");
  assert.match(o.mac[2], /Control goes only with H, Q and W/);
  assert.deepStrictEqual(o.mac[3], { k: "Ctrl+H" }, "Control+H is the table's Ctrl+H (Control on a Mac)");
  assert.match(o.mac[4], /not both/);
  assert.match(o.mac[5], /Cmd[+]M belongs to macOS/, "the table's Ctrl+M is Cmd+M on a Mac: refused");
  assert.deepStrictEqual(o.browser.map(w => /browser's own/.test(w)), [true, true, true, true], "the browser's own keys: " + o.browser);
  assert.ok(o.nb[0], "the table has a not-built command with a key");
  assert.match(o.nb[1], /kept for a command that is not built yet/);
  assert.ok(!o.nb[1].includes(o.nb[2]), "its name not given");
  assert.strictEqual(o.nbOnPage, false, "no not-built command on the Shortcuts page");
  assert.deepStrictEqual(o.back, ["", "Ctrl+K"]);
});

test("BETA8-1 / D 3.C5: Glue Brush (the 3D toolbar's Gluing slot, Materials/UV ▸ Gluing) paints over the cloth of the pattern pressed on (the Brush panel's Size); let go, the painted part is a glue area to the layer under it, its outline the painted triangles' (an L-shaped stroke stays L-shaped), one step; Ctrl takes away; painting where nothing lies under it glues nothing", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Pocket", 500, 0, 200, 200)); const [A, P] = S.pieces;
    A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 };
    P.p3 = { pos: [0, 1100, 124], q: [0, 0, 0, 1], r: 0 };       // the pocket lies 4 mm in front of the front, its middle on the front's
    S.cloth = app.normCloth({ ...S.cloth, res: 20, substeps: 8, self: false, worker: false });
    app.commit(); app.ev("garmentSync")();
    Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
    const pos = app.ev("tackPos"), scr = (p, x, y) => { const Q = pos({ piece: p.id, x, y }); return v3.project(new THREE.Vector3(Q[0], Q[1], Q[2])); };
    const ev = (p, x, y, opt) => { const q = scr(p, x, y); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1, ...(opt || {}) }; };
    const reg = app.ev("TOOLS").glue_brush; out.reg = [!!reg, reg && !reg.off];
    const row = app.ev("menuMaterials")().find(r => r && r.n === "Gluing"); out.row = !!(row && row.menu().some(r => r && r.n === "Glue Brush" && r.f && !r.off));
    app.setTool3("glue_brush"); const B = app.TOOL3.glue_brush; app.ev("MESH_BRUSH").size = 25;
    const n0 = S.undo.length;
    // an L-shaped stroke on the pocket: down its left side, then along its bottom
    const path = [[540, 40], [540, 80], [540, 120], [540, 160], [580, 160], [620, 160], [660, 160]];
    B.down(ev(P, ...path[0])); for (const q of path.slice(1)) B.move(ev(P, ...q)); B.up();
    const g = (S.glues || [])[S.glues.length - 1];
    out.glue = g && [g.kind, g.a === P.id, g.b === A.id, S.undo.length - n0, S.un[S.un.length - 1].n];
    // L-shaped: the corner of the pocket's bounding square (its top right) not inside the outline, the stroke's points are
    const ins = app.ev("inside");
    out.shape = g && [ins(g.poly, { x: 540, y: 100 }), ins(g.poly, { x: 620, y: 160 }), ins(g.poly, { x: 640, y: 60 })];
    out.painted = (G3.meshSel && G3.meshSel.size) || 0;
    // painting on the front where nothing lies over it: nothing glued, no step
    const n1 = S.undo.length, k1 = S.glues.length;
    B.down(ev(A, 250, 350)); B.move(ev(A, 260, 360)); B.up();
    out.none = [S.glues.length - k1, S.undo.length - n1];
    return out;
  ` });
  assert.deepStrictEqual(o.reg, [true, true]);
  assert.ok(o.row, "Materials/UV ▸ Gluing ▸ Glue Brush is a working row");
  assert.deepStrictEqual(o.glue, ["area", true, true, 1, "Glue Brush"], "a glue area of the pocket to the front, one step");
  assert.deepStrictEqual(o.shape, [true, true, false], "the stroke's shape, not its hull");
  assert.strictEqual(o.painted, 0, "the painting is let go");
  assert.deepStrictEqual(o.none, [0, 0], "nothing under it: nothing glued");
});

test("BETA8-1 / E 3.A18: Seam Taping on the selected lines (the Property Editor's Selected Line, Materials/UV ▸ Seam Taping): a tape keeps the line at its length, in the solver a cord of ratio 100 stiffer than an elastic; a line has a tape or an elastic, not both; one step; saved with the line", () => {
  const o = boot({ script: DOC + `
    S.sel = [A.id]; S.selKind = "outline"; S.selSeg = 1; S.selPt = -1; app.ev("ui")();
    out.pe = app.el("props").innerHTML.includes('id="sl-tape"');
    const row = app.ev("menuMaterials")().find(r => r && r.n === "Seam Taping"); out.row = [!!row, !!(row && row.f), !(row && row.off), !!(row && row.on)];
    const s0 = steps(); A.segs[1].elastic = { k: 10, r: 80 }; out.set = app.ev("setTape")(true);
    out.after = [!!A.segs[1].tape, !!A.segs[1].elastic, steps() - s0, S.un[S.un.length - 1].n, !!app.ev("menuMaterials")().find(r => r && r.n === "Seam Taping").on];
    const m = app.ev("pieceMesh3")(A, 20); const els = app.ev("elasticsOf")(A, m);
    out.cord = els.map(e => [e.r, e.k, e.i.length > 1]);
    out.k = app.ev("ELASTIC_K")*app.ev("ELASTIC_STRENGTH")*app.ev("TAPE_STRENGTH");
    const d = JSON.parse(app.docJSON()); out.file = !!d.pieces[0].segs[1].tape;
    app.ev("setTape")(false); out.off = [!!A.segs[1].tape, app.ev("elasticsOf")(A, m).length];
    return out;
  ` });
  assert.ok(o.pe, "the Property Editor's Seam Taping switch");
  assert.deepStrictEqual(o.row, [true, true, true, false], "Materials/UV ▸ Seam Taping: a working row, off");
  assert.strictEqual(o.set, true);
  assert.deepStrictEqual(o.after, [true, false, 1, "Seam Taping", true], "taped, its elastic gone, one step; the row now on");
  assert.deepStrictEqual(o.cord, [[100, o.k, true]], "a cord at the line's own length, stiffer than an elastic");
  assert.ok(o.file, "saved with the line");
  assert.deepStrictEqual(o.off, [false, 0]);
});

test("BETA8-1 / E 3.A18 3.B6: Steam brushed over the cloth leaves spots on the pattern (the Brush panel's Size and Strength), one step a stroke; the solver's rest lengths there are shrunk by the Strength (relaxed below 0), eased in as Simulation Shrinkage; the next run draws the cloth in; Remove Steam on Selected Pattern and Remove All Steam take it away (one step each), Refresh Textures paints every cloth again; saved with the pattern", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces.push(sq("Front", 0, 0, 300, 400)); const A = S.pieces[0];
    A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 };
    S.cloth = app.normCloth({ ...S.cloth, res: 20, substeps: 8, self: false, worker: false });
    app.commit(); app.ev("garmentSync")();
    Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
    const pos = app.ev("tackPos"), scr = (x, y) => { const Q = pos({ piece: A.id, x, y }); return v3.project(new THREE.Vector3(Q[0], Q[1], Q[2])); };
    const ev = (x, y) => { const q = scr(x, y); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1 }; };
    const reg = app.ev("TOOLS").steam; out.reg = [!!reg, reg && !reg.off];
    app.setTool3("steam"); const St = app.TOOL3.steam; app.ev("MESH_BRUSH").size = 60; app.ev("STEAM").s = 20;
    out.panel = app.el("brush3d").innerHTML.includes("Strength");
    const n0 = S.undo.length;
    St.down(ev(150, 100)); St.move(ev(150, 150)); St.move(ev(150, 200)); St.up();
    out.spots = [(A.steam || []).length >= 2, A.steam.every(q => q.r === 60 && q.s === 20), S.undo.length - n0, S.un[S.un.length - 1].n];
    // the solver: the steamed edges' rest lengths 0.8 of the flat ones (some fully, some partly), the rest as cut
    const it = G3.items.get(A.id), F = app.ev("steamOf")(A, it.mesh);
    out.factor = [+Math.min(...F).toFixed(3), +Math.max(...F).toFixed(3)];
    app.ev("simBuild")(); const sim = app.ev("SIM").sim;
    const r = Array.from(sim.eT, (t, c) => t/sim.eF[c]);
    out.rest = [+Math.min(...r).toFixed(3), +Math.max(...r).toFixed(3), r.filter(x => x < 0.999).length > 10];
    // run it: the steamed part drawn in (the distance across the brushed band shorter), the rest about as cut
    const P = (v) => [sim.x[3*v], sim.x[3*v+1], sim.x[3*v+2]], near = (x, y) => { let b = 0, bd = Infinity; for (let v = 0; v < it.mesh.xy.length/2; v++) { const d = Math.hypot(it.mesh.xy[2*v] - x, it.mesh.xy[2*v+1] - y); if (d < bd) { bd = d; b = v; } } return b; };
    const a1 = near(130, 150), b1 = near(170, 150), a2 = near(30, 380), b2 = near(70, 380), dist = (u, w) => { const p = P(u), q = P(w); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
    const l1 = dist(a1, b1), l2 = dist(a2, b2);
    sim.g = [0, 0, 0]; for (let f = 0; f < 120; f++) app.ev("SIM3D").clothStep(sim, 1/30);
    out.drawn = [+(dist(a1, b1)/l1).toFixed(3), +(dist(a2, b2)/l2).toFixed(3)];
    // saved with the pattern
    const d = JSON.parse(app.docJSON()); out.file = (d.pieces[0].steam || []).length === A.steam.length;
    // Refresh Textures: every cloth painted again
    it.painted = "x";
    app.ev("refreshTextures")(); out.refresh = it.painted !== "x";
    // the menus: Materials/UV ▸ Steam ▸ Steam (the tool) and Remove All Steam, built rows
    const sub = app.ev("menuMaterials")().find(r => r && r.n === "Steam").menu();
    out.menu = sub.map(r => [r.n, !!r.f, !r.off]);
    // Remove Steam on Selected Pattern, Remove All Steam: one step each
    S.sel = [A.id]; const n1 = S.undo.length; app.ev("removeSteamSel")(); out.sel = [!A.steam, S.undo.length - n1];
    app.undo(); const A2 = S.pieces[0]; out.back = (A2.steam || []).length > 0;
    const n2 = S.undo.length; app.ev("removeAllSteam")(); out.all = [!S.pieces[0].steam, S.undo.length - n2, S.un[S.un.length - 1].n];
    return out;
  ` });
  assert.deepStrictEqual(o.reg, [true, true]);
  assert.ok(o.panel, "the Brush panel has Strength while Steam is in hand");
  assert.deepStrictEqual(o.spots, [true, true, 1, "Steam"], "spots of the brush's Size and Strength, one step a stroke");
  assert.deepStrictEqual(o.factor, [0.8, 1], "0.8 inside a spot of 20 %, 1 outside: " + JSON.stringify([o.factor, o.spots]));
  assert.ok(o.rest[0] >= 0.79 && o.rest[0] <= 0.81 && o.rest[1] === 1 && o.rest[2], "the solver's rest lengths there: " + o.rest);
  assert.ok(o.drawn[0] < 0.9 && o.drawn[1] > 0.97, "the steamed band drawn in, the rest about as cut: " + o.drawn);
  assert.ok(o.file, "saved with the pattern");
  assert.ok(o.refresh, "Refresh Textures paints the cloth again");
  assert.deepStrictEqual(o.menu, [["Steam", true, true], ["Remove All Steam", true, true]]);
  assert.deepStrictEqual(o.sel, [true, 1]);
  assert.ok(o.back, "undone: the steam back");
  assert.deepStrictEqual(o.all, [true, 1, "Remove All Steam"]);
});

test("BETA8-1 / F 1.H22: Nest All Patterns nests at once, then goes on looking for a shorter marker until Stop Nesting (on the bar, pressable only while it runs), its tries run out, or anything else touches the history; a marker is kept only when shorter; all of it is the one Nest Patterns step", () => {
  const o = boot({ script: `
    const out = {}; S.pieces.length = 0; S.seams.length = 0;
    const sizes = [[420, 180], [160, 300], [260, 90], [90, 250], [330, 140], [120, 120], [200, 210], [70, 380]];
    sizes.forEach(([w, h], k) => S.pieces.push(app.mkPiece("P" + k, app.mkShape([{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}], true))));
    app.commit(); S.undo.length = 0; S.un.length = 0;
    app.setMode("layout"); S.layout.paper = "rollc"; S.layout.customW = 600; app.layoutCmd("row");
    const R = app.ev("NEST_RUN"), stopBtn = () => app.ev("LAY_TOOLS").find(t => t[0] === "stop");
    out.built = !!stopBtn()[3];
    const n0 = S.undo.length; out.row = app.ev("layoutStats")().length;
    app.layoutCmd("nest");
    const first = app.ev("layoutStats")().length;
    out.running = [R.on, S.undo.length - n0, S.un[S.un.length - 1].n];
    // the run, slice by slice as the timer would
    let guard = 0; while (R.on && guard++ < 10000) app.ev("nestSlice")();
    const best = app.ev("layoutStats")().length;
    out.done = [R.on, R.tries, best <= first + 1e-6, S.undo.length - n0];
    out.first = first; out.best = best;
    // every copy still on the roll, none overlapping
    out.over = app.ev("layOverlaps")(app.ev("layoutPieces")()).n;
    // undo takes the whole nest back
    app.undo(); out.undone = app.ev("layoutStats")().length;
    // started again: Stop Nesting ends it; a step taken meanwhile ends it too
    app.redo(); app.layoutCmd("nest"); out.again = R.on; app.layoutCmd("stop"); out.stopped = R.on;
    app.layoutCmd("nest"); const was = R.on; app.ev("push")("Something else"); out.byStep = [was, R.on];
    return out;
  ` });
  assert.ok(o.built, "Stop Nesting is built");
  assert.deepStrictEqual(o.running, [true, 1, "Nest Patterns"], "nested at once, one step, and it goes on");
  assert.deepStrictEqual(o.done.slice(0, 1).concat(o.done.slice(2)), [false, true, 1], "ended by itself; never longer than the first nest; still one step: " + JSON.stringify(o.done));
  assert.ok(o.done[1] >= 50, "it tried other orders: " + o.done[1]);
  if (process.env.PDRAFT_NEST_REPORT) console.log("      nest: first " + o.first.toFixed(1) + " mm, best " + o.best.toFixed(1) + " mm, " + o.done[1] + " tries");
  assert.strictEqual(o.over, 0, "nothing overlaps");
  assert.strictEqual(+o.undone.toFixed(3), +o.row.toFixed(3), "undo: the row as before the nest");
  assert.deepStrictEqual([o.again, o.stopped], [true, false], "Stop Nesting ends it");
  assert.deepStrictEqual(o.byStep, [true, false], "another step ends it");
});

test("BETA8-1 / G 3.A25: the menu bar's search (the magnifier beside the Library) opens every menu of the bar with a search field: a word lists every row of every menu and submenu holding it, by its path; a row runs from it; rows hidden in the menus (not built, the switch off) are not found", () => {
  const o = boot({ freshUnbuilt: true, script: DOC + `
    const items = app.ev("menuBarSearch")(), flat = app.ev("menuFlat")(items);
    out.top = items.map(r => r.n);
    out.search = app.ev("menuRowCount")(items) >= app.ev("MENU_SEARCH_MIN");
    const find = (t) => flat.filter(r => String(r.n).toLowerCase().includes(t)).map(r => r.n);
    out.dxf = find("dxf"); out.about = find("about"); out.nb = flat.filter(r => r.nb || /not built/.test(r.note || "")).length;
    // one runs: Help ▸ Keyboard Shortcuts…
    const ks = flat.find(r => r.n === "Help ▸ Keyboard Shortcuts…"); ks.f(); out.ran = app.el("dlg").innerHTML.includes("Keyboard Shortcuts");
    return out;
  ` });
  assert.deepStrictEqual(o.top, ["File", "Edit", "3D", "2D", "Materials/UV", "Avatar", "Fabric", "Production", "Render", "Settings", "Help"]);
  assert.ok(o.search, "with its search field");
  assert.ok(o.dxf.some(n => /^File ▸ Export ▸ .*DXF/.test(n)) && o.dxf.some(n => /^File ▸ Import ▸ .*DXF/.test(n)), "rows by their path: " + o.dxf);
  assert.ok(o.about.includes("Help ▸ About…"), o.about);
  assert.strictEqual(o.nb, 0, "nothing not built is found with the switch off");
  assert.ok(o.ran, "a row runs");
});

test("BETA8-1 / H 2.C33: every library item in the Object Browser has a “…” menu (Duplicate, Rename…, Export…, Import…, Delete); Export writes the item as a file of ours with a fabric's texture inside, Import reads it into an item keeping its id (the patterns keep it), one step; another kind's file is refused", () => {
  const o = boot({ freshUnbuilt: true, script: DOC + `
    const L = app.ev("libOf")();
    // a second fabric with a texture, a colour and a Detail row of its own
    app.ev("push")(); const f2 = app.ev("libAdd")("fabric"); f2.color = "#123456"; f2.weight = 222; f2.dir = { stretchWeft: 150 }; app.commit();
    app.ev("fabTexSet")(f2, "check.png", "${PNG}", 10, 20);
    A.fabric = L.fabric[0].id; app.commit();
    // the Fabric tab: a "…" on each row, before its ×
    app.ev("obSelect")("fabric", null);
    const items = app.el("ob-items").children;
    out.dots = items.map(d => (d.children[0] || {}).className);
    items[1].children[0].onclick({ stopPropagation() {} });
    out.menu = app.menu.children.some(c => /Export/.test(c.innerHTML)) && app.menu.children.some(c => /Import/.test(c.innerHTML));
    const rows = app.ev("libItemRows")("fabric", f2);
    out.rows = rows.filter(r => r.n).map(r => r.n);
    // Export: the file holds the item and its picture
    const text = app.ev("libItemText")("fabric", f2), d = JSON.parse(text);
    out.file = [d.gusset, d.kind, d.item.weight, d.item.color, !!d.image && d.image.data === "${PNG}", "id" in d.item];
    // Import into the first fabric: its properties and name the file's, its id kept, the pattern keeps it, one step
    const id0 = L.fabric[0].id, n0 = S.undo.length;
    out.why = app.ev("libItemImportText")("fabric", id0, text);
    const g = app.ev("libOf")().fabric.find(x => x.id === id0);
    out.imported = [g.weight, g.color, g.name === f2.name, JSON.stringify(g.dir), !!g.tex && S.images.find(i => i.id === g.tex.img).data === "${PNG}", g.tex && g.tex.h, A.fabric === id0, S.undo.length - n0];
    out.oneImage = S.images.filter(i => i.data === "${PNG}").length;
    // refused: another kind, not a file of ours
    out.wrong = app.ev("libItemImportText")("button", L.button.length ? L.button[0].id : 0, text);
    out.bad = app.ev("libItemImportText")("fabric", id0, "{}");
    // Duplicate and Delete from the menu, a step each; undo takes Delete back
    const nf = L.fabric.length; rows.find(r => r.n === "Duplicate").f(); out.dup = [app.ev("libOf")().fabric.length - nf, app.ev("libOf")().fabric.slice(-1)[0].name];
    rows.find(r => r.n === "Delete").f(); out.del = app.ev("libOf")().fabric.some(x => x.id === f2.id);
    app.undo(); out.undel = app.ev("libOf")().fabric.some(x => x.id === f2.id);
    // a button type round trip
    app.ev("push")(); const bt = app.ev("libAdd")("button"); bt.width = 17; app.commit();
    app.ev("push")(); const b2 = app.ev("libAdd")("button"); app.commit();
    out.btn = [app.ev("libItemImportText")("button", b2.id, app.ev("libItemText")("button", bt)), app.ev("libOf")().button.find(x => x.id === b2.id).width];
    return out;
  ` });
  assert.deepStrictEqual(o.dots, ["dots", "dots"], "a “…” on each fabric");
  assert.ok(o.menu, "it opens the item's menu");
  assert.deepStrictEqual(o.rows, ["Duplicate", "Rename…", "Export…", "Import…", "Delete"]);
  assert.deepStrictEqual(o.file, ["library-item", "fabric", 222, "#123456", true, false], "the item without its id, its picture inside");
  assert.strictEqual(o.why, "");
  assert.deepStrictEqual(o.imported, [222, "#123456", true, JSON.stringify({ stretchWeft: 150 }), true, 200, true, 1], "the file's properties, the id kept, one step");
  assert.strictEqual(o.oneImage, 1, "the same picture is kept once");
  assert.ok(/holds a fabric, not a button/.test(o.wrong), o.wrong);
  assert.ok(/not a library item file/.test(o.bad), o.bad);
  assert.deepStrictEqual(o.dup, [1, o.dup[1]]); assert.ok(/copy$/.test(o.dup[1]), o.dup[1]);
  assert.deepStrictEqual([o.del, o.undel], [false, true], "Delete, and undo brings it back");
  assert.deepStrictEqual(o.btn, ["", 17]);
});

test("BETA8-1 / I 3.C8: Hi-Res Properties' Add'l Thickness - Collision (added to every cloth's distance off the body and to the patterns' Collision Thickness, in the file, kept only when set) and Simulation Quality (the preference, asked first) are real rows with the switch off; Tolerance and Skin Offset stay behind it; Reset puts all three back", () => {
  const o = boot({ freshUnbuilt: true, blank: true, three: true, script: `
    const out = {};
    app.ev("setLayout")("both");
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces.push(sq("A", 0, 0, 300, 400)); S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, worker: false }); app.commit(); app.ev("garmentSync")();
    out.none = ["addThick" in S.cloth, "addThick" in app.normCloth(null)];
    app.ev("simBuild")(); out.before = [app.SIM.sim.thick[0], app.SIM.sim.opt.selfMin];
    let seen = null; app.answer = (t, f, opts) => { seen = [f.map(x => x.label + (x.ro ? " [ro]" : "")), opts.reset]; return { res: 25, thick: 2, quality: "high" }; };
    app.modalAnswer = () => "ok";
    app.ev("CMD3").hi_res(); out.rows = seen[0]; out.reset = seen[1];
    out.after = [S.cloth.addThick, S.prefs.simQuality];
    app.ev("simBuild")(); out.solver = [+app.SIM.sim.thick[0].toFixed(3), +app.SIM.sim.opt.selfMin.toFixed(3)];
    // in the file, and back on opening
    const doc = JSON.parse(app.ev("docJSON")()); out.file = doc.cloth.addThick;
    app.ev("loadDoc")(doc); out.reopened = S.cloth.addThick;
    out.bad = app.normCloth({ addThick: 50 }).addThick;
    // set back to none: no key
    app.answer = () => ({ res: 25, thick: 0, quality: "normal" }); app.ev("CMD3").hi_res(); out.back = ["addThick" in S.cloth, S.prefs.simQuality];
    return out;
  ` });
  assert.deepStrictEqual(o.none, [false, false], "not set: no key, so a file without it opens and saves as it was");
  assert.deepStrictEqual(o.before, [3, 2.5], "Skin Offset 3 mm and Collision Thickness 2.5 mm as before");
  assert.deepStrictEqual(o.rows, ["Particle Distance", "Add'l Thickness - Collision", "Simulation Quality"], "no greyed row with the switch off");
  assert.deepStrictEqual(o.reset, { res: 8, thick: 0, quality: "normal" });
  assert.deepStrictEqual(o.after, [2, "high"]);
  assert.deepStrictEqual(o.solver, [5, 4.5], "the thickness added to both");
  assert.deepStrictEqual([o.file, o.reopened], [2, 2], "kept in the file");
  assert.strictEqual(o.bad, undefined, "out of range: none");
  assert.deepStrictEqual(o.back, [false, "normal"]);
});

test("BETA8-1 / J 3.B11: Viewpoint ▸ 1:1 View puts the 3D window at true size where the view is centered (a millimetre there is 96/25.4 CSS pixels; the direction and the point stay); Camera Properties ▸ Default Camera (Main) on the 3D background's menu and in Preferences opens the camera's Property Editor (the Render workspace's Camera pane); Show/Hide Color stays greyed (its submenu was never seen)", () => {
  const o = boot({ freshUnbuilt: true, blank: true, three: true, script: `
    const out = {}, v3 = app.view3d;
    app.ev("setLayout")("both");
    Object.assign(v3.cam, { az: 0.6, el: 0.3, dist: 3000, tx: 10, ty: 1100, tz: 5 });
    const vp = app.ev("menuDisplay")().find(r => r.n === "Viewpoint").menu(), row = vp.find(r => r.n === "1:1 View");
    out.row = [!!row, !!(row && row.off), !!(row && row.nb)];
    row.f();
    out.cam = [v3.cam.az, v3.cam.el, v3.cam.tx, v3.cam.ty, v3.cam.tz];
    out.mmPx = v3.wpp({ x: 10, y: 1100, z: 5 });
    // the 3D background's menu: Camera Properties ▸ Default Camera (Main)
    app.ev("garmentMenu")({ clientX: 5, clientY: 5, button: 2 });
    out.bg = app.menu.children.map(c => c.innerHTML).filter(h => /Camera Properties|Show\\/Hide Color/.test(h));
    const cp = app.ev("menuPreferences")().find(r => r.n === "Camera Properties").menu();
    out.pref = cp.map(r => [r.n, !!r.off]);
    cp[0].f(); out.opened = [app.ev("RWIN").open, app.ev("RWIN").pane];
    return out;
  ` });
  assert.deepStrictEqual(o.row, [true, false, false], "a real row");
  assert.deepStrictEqual(o.cam, [0.6, 0.3, 10, 1100, 5], "the direction and the point stay");
  assert.ok(Math.abs(o.mmPx - 25.4/96) < 1e-3, "a millimetre a millimetre: " + o.mmPx);
  assert.ok(o.bg.some(h => /Camera Properties/.test(h) && !/not built/.test(h)), "Camera Properties is a real row: " + o.bg);
  // (Round BETA8-PREP / A: Show/Hide Color is a not-built row, ctxNb(), which follows the switch since the beta.8 sweep: this boot is a
  // fresh profile's, the switch off, so the row is not there; BETA8-PREP / A below checks it is back, greyed, with the switch on)
  assert.ok(!o.bg.some(h => /Show.Hide Color/.test(h)), "Show/Hide Color is hidden with the switch off");
  assert.deepStrictEqual(o.pref, [["Default Camera (Main)", false]]);
  assert.deepStrictEqual(o.opened, [true, "camera"], "the camera's properties open");
});

test("BETA8-1 / K 1.T34 3.C3 3.C4: a library item's right-click menu (Add to Workspace; for a pattern of one's own the desktop app saved, Copy the Path and Show in Explorer); the Open Garment box (Load Type Open / Add, Add's Translation X / Y / Z in a unit of its own) before the library's garment or File ▸ Add ▸ Project comes in; Add moves every pattern by as much in 3D and in 2D, one step", () => {
  const o = boot({ desktop: true, script: DOC + `
    const block = app.ev("shippedBlocks")()[0];
    out.blockRows = app.ev("libraryItemRows")(block).filter(r => r.n).map(r => r.n);
    // Save to Library in the desktop app: the entry remembers its file
    app.desk.dialog = "/home/p/lib/Two.pdraft";
    app.ev("saveToLibrary")("Two"); const own = app.ev("myPatterns")().find(m => m.name === "Two");
    out.path = own && own.path;
    const rows = app.ev("libraryItemRows")(own); out.mineRows = rows.filter(r => r.n).map(r => r.n);
    rows.find(r => r.n === "Copy the Path").f(); out.clip = app.desk.clip;
    rows.find(r => r.n === "Show in Explorer").f(); out.shown = app.desk.calls.filter(c => c[0] === "showFile");
    // the library row's right-click opens the menu
    app.ev("libraryDialog")(); out.dlgRows = /lb-row/.test(app.el("dlg").innerHTML); app.ev("hideDlg")();
    // Add with no Translation: where saved; then again 1 m right, 20 cm up, 50 mm forward (in m)
    const n0 = S.pieces.length;
    let seen = null; app.answer = (t, f, opts) => { seen = [t, f.map(x => x.k), opts.reset]; return { load: "add", x: 0, y: 0, z: 0, unit: "mm" }; };
    rows.find(r => r.n === "Add to Workspace").f();
    out.box = seen; const a = S.pieces.slice(n0), n1 = S.pieces.length, u0 = S.undo.length;
    out.place0 = a.map(p => [app.ev("bboxOf")([p]).x0, app.ev("bboxOf")([p]).y0, p.p3.pos.slice()]);
    app.answer = () => ({ load: "add", x: 1, y: 0.2, z: 0.05, unit: "m" });
    app.ev("openGarmentDialog")("Two", JSON.parse(JSON.stringify(own.doc)), "add");
    const b = S.pieces.slice(n1);
    out.steps = S.undo.length - u0;
    out.moved = b.map((p, k) => { const bb = app.ev("bboxOf")([p]); return [+(bb.x0 - out.place0[k][0]).toFixed(3), +(bb.y0 - out.place0[k][1]).toFixed(3), p.p3.pos.map((c, i) => +(c - out.place0[k][2][i]).toFixed(3))]; });
    // undo takes the whole add back
    app.undo(); out.undone = S.pieces.length === n1;
    // File ▸ Add ▸ Project goes through the box with Add chosen
    app.answer = (t, f) => { seen = [t, f.find(x => x.k === "load").val]; return null; };
    app.ev("openGarmentDialog")("x", JSON.parse(JSON.stringify(own.doc)), "add"); out.viaAdd = seen;
    out.src = /openGarmentDialog[(]name, d, "add"[)]/.test(String(app.ev("addProject")));
    return out;
  ` });
  assert.deepStrictEqual(o.blockRows, ["Add to Workspace"], "a shipped block is no file of its own: " + JSON.stringify(o.blockRows));
  assert.strictEqual(o.path, "/home/p/lib/Two.pdraft");
  assert.deepStrictEqual(o.mineRows, ["Add to Workspace", "Copy the Path", "Show in Explorer"], JSON.stringify(o.mineRows));
  assert.strictEqual(o.clip, "/home/p/lib/Two.pdraft");
  assert.deepStrictEqual(o.shown, [["showFile", "/home/p/lib/Two.pdraft"]]);
  assert.ok(o.dlgRows);
  assert.deepStrictEqual(o.box, ["Open Garment", ["load", "x", "y", "z", "unit"], { load: "open", x: 0, y: 0, z: 0, unit: "mm" }], JSON.stringify(o.box));
  assert.strictEqual(o.steps, 1, "one step");
  assert.ok(o.moved.length >= 2 && o.moved.every(m => JSON.stringify(m) === JSON.stringify([1000, -200, [1000, 200, 50]])), "1 m right, 20 cm up, 5 cm forward, in 3D and in 2D: " + JSON.stringify(o.moved));
  assert.ok(o.undone);
  assert.deepStrictEqual(o.viaAdd, ["Open Garment", "add"]);
  assert.ok(o.src, "File ▸ Add ▸ Project opens the box");
});

test("BETA8-1 / L 1.T61 3.B1: the pattern menu has the tabs All / Edit / Pattern / Line / Arrange under its search field (W1); each other tab a flat list of the same rows, a submenu a bold title with its rows under it, as the frames list them; a row runs from a tab; Assign to New Fabric (the Pattern tab, Context Menu ▸ Materials) gives the selected patterns a new fabric, one step", () => {
  const o = boot({ freshUnbuilt: true, script: DOC + `
    S.view = { s: 1, x: 100, y: 100 }; app.ev("draw")();      // (the patterns' pick grid follows the view at the next draw)
    const at = (x, y) => app.toS({ x, y });
    const words = (el) => el.children.filter(c => c.className !== "msearch" && c.className !== "mtabs").map(c => c.className === "sep" ? "—" : c.className === "hd" ? "# " + c.innerHTML.replace(/<[^>]*>/g, "") : (/ sub/.test(c.className) ? "  " : "") + c.innerHTML.replace(/<span class="k">.*?<.span>/, "").replace(/<[^>]*>/g, ""));
    const open = () => { const s = at(100, 100); app.setTool("transform_pattern"); app.menu.children.length = 0; app.showMenu({ clientX: s.x, clientY: s.y }); };
    const tabs = () => app.menu.children.find(c => c.className === "mtabs");
    open();
    out.order = app.menu.children.slice(0, 2).map(c => c.className);
    out.pills = (tabs().innerHTML.match(/data-tab="[a-z]+"/g) || []).map(t => t.slice(10, -1));
    out.on = (tabs().innerHTML.match(/class="mtab on" data-tab="([a-z]+)"/) || [])[1];
    out.all = words(app.menu).length;
    // the tabs: the menu's rows array carries them; each listed as listMenu shows it
    const I = app.ev("patternMenu")(S.pieces[0], { x: 10, y: 10 }, { x: 100, y: 100 }); I.tabs = app.ev("patternTabs")(I);      // (as showMenu() builds them)
    for (const t of ["edit", "pattern", "line", "arrange"]) { app.ev("listMenu")(I, 10, 10, false, false, t); out[t] = words(app.menu); }
    out.onLine = (tabs().innerHTML.match(/class="mtab on" data-tab="([a-z]+)"/) || [])[1];
    // a row runs from a tab: Arrange ▸ Rotate's Clockwise (90°)
    app.ev("listMenu")(I, 10, 10, false, false, "arrange");
    const r = app.menu.children.find(c => /Clockwise [(]90/.test(c.innerHTML)); const x0 = S.pieces[0].pts.map(p => [p.x, p.y]); r.onclick();
    out.turned = JSON.stringify(S.pieces[0].pts.map(p => [p.x, p.y])) !== JSON.stringify(x0);
    // Assign to New Fabric
    S.sel = S.pieces.map(p => p.id); const nf = app.ev("libOf")().fabric.length, u = S.undo.length;
    const f = app.ev("assignNewFabric")();
    out.fab = [app.ev("libOf")().fabric.length - nf, S.pieces.every(p => p.fabric === f.id), S.undo.length - u, app.ev("obState")().sel === f.id];
    out.ctx = app.MENUS.edit().find(x => x && x.n === "Context Menu").menu().find(x => x && x.n === "Materials").menu().filter(Boolean).find(x => x.n === "Assign to New Fabric");
    out.ctx = out.ctx && !out.ctx.off;
    return out;
  ` });
  assert.deepStrictEqual(o.order, ["msearch", "mtabs"], "the search field, then the tabs");
  assert.deepStrictEqual(o.pills, ["all", "edit", "pattern", "line", "arrange"]);
  assert.strictEqual(o.on, "all");
  assert.ok(o.all > 20, "All is the whole menu");
  // (Round BETA8-PREP / A: Export To USD Layer is a not-built row, ctxNb(), which follows the switch since the beta.8 sweep: this boot is
  // a fresh profile's, the switch off, so the Edit tab ends at Select All's rows)
  assert.deepStrictEqual(o.edit, ["Delete", "Copy", "Paste", "Mirror Paste", "—", "Replaced by", "—", "Invert Selection", "Lock", "—", "# Select All", "  Sewn", "  Particle Distance", "  Fabric", "  Layer"], JSON.stringify(o.edit));
  assert.deepStrictEqual(o.pattern.slice(0, 7), ["# Clone as", "  Symmetric Pattern (with Sewing)", "  Symmetric Pattern", "  Instance Pattern", "# Apply", "  Half Symmetric Pattern (with Sewing)", "# 3D Pattern"], JSON.stringify(o.pattern));
  assert.deepStrictEqual(o.pattern.slice(-5), ["—", "Layer Clone (Over)", "Layer Clone (Under)", "—", "Assign to New Fabric"], JSON.stringify(o.pattern));
  assert.deepStrictEqual(o.line, ["Offset as Internal Line", "Offset as Seamless Block Line", "Offset Pattern Outline", "—", "Clone as Internal Shape", "Clone as Reference Line"], JSON.stringify(o.line));
  assert.deepStrictEqual([o.arrange[0], o.arrange[5], o.arrange.slice(-2)].flat(), ["# Order", "# Rotate", "—", "Zoom to Selected"], JSON.stringify(o.arrange));
  assert.strictEqual(o.onLine, "arrange");
  assert.ok(o.turned, "a row runs from its tab");
  assert.deepStrictEqual(o.fab, [1, true, 1, true]);
  assert.ok(o.ctx, "Context Menu ▸ Materials ▸ Assign to New Fabric is a real row");
});

test("BETA8-PREP / A: the right-click menus' not-built rows (ctxNb()) follow Show Tools That Are Not Built Yet: with default settings the 3D pattern menu, the 3D background menu and the 2D pattern menu have none (Show/Hide Color, Convert, Mesh Type, Reverse-Arrange, Export To USD Layer gone, a submenu left empty with them); with the switch on they are back, greyed", () => {
  const o = boot({ freshUnbuilt: true, three: true, script: DOC + `
    S.view = { s: 1, x: 100, y: 100 }; app.ev("draw")();
    app.ev("(() => { const o = listMenu; listMenu = function (items, ...a) { globalThis.__items = items; return o(items, ...a); }; })()");
    // (a submenu with no row in it now is left out, as menuRows() leaves it out)
    const rows = (items, p, acc) => { for (const it of items || []) { if (!it || it.sep || it.hd || (it.menu && !it.menu().filter(x => x && !x.sep && !x.hd).length)) continue; acc.push([p + it.n, !!it.nb, !!it.off]); if (it.menu) rows(it.menu(), p + it.n + " > ", acc); } return acc; };
    const take = () => { const I = app.ev("globalThis.__items"); app.ev("globalThis.__items = null"); return rows(I, "", []); };
    const menus = () => {
      app.setTool("transform_pattern"); S.sel = [S.pieces[0].id]; const s = app.toS({ x: 100, y: 100 }); app.showMenu({ clientX: s.x, clientY: s.y });
      const p2 = take();
      app.ev("garmentHit = () => null; pinAt3 = () => null"); app.ev("garmentMenu")({ clientX: 10, clientY: 10, button: 2 }); const bg = take();
      app.ev("garmentHit = () => ({ p: S.pieces[0] })"); app.ev("garmentMenu")({ clientX: 10, clientY: 10, button: 2 }); const pat = take();
      return { p2, bg, pat };
    };
    out.off = menus(); S.ui.unbuilt = true; out.on = menus();
    return out;
  ` });
  const nb = (m) => [...m.p2, ...m.bg, ...m.pat].filter(r => r[1]).map(r => r[0]);
  assert.deepStrictEqual(nb(o.off), [], "none with the switch off: " + JSON.stringify(nb(o.off)));
  for (const n of ["Show/Hide Color"]) assert.ok(!o.off.bg.some(r => r[0] === n), n);
  for (const n of ["Convert", "Mesh Type", "Reverse-Arrange", "Export To USD Layer", "Symmetric Arrangement"]) assert.ok(!o.off.pat.some(r => r[0] === n), n + " (an empty submenu goes too)");
  assert.ok(o.off.pat.some(r => r[0] === "Superimpose"), "the built rows stay");
  assert.ok(o.on.bg.some(r => r[0] === "Show/Hide Color" && r[1] && r[2]), "with the switch on: greyed, not built");
  assert.ok(o.on.pat.some(r => r[0] === "Mesh Type > Quad" && r[2]));
  assert.ok(o.on.p2.some(r => r[0] === "Export To USD Layer" && r[2]));
});

module.exports = T;
