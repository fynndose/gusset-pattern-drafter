// Roadmap 2, batch 6: the workspace. The display selectors and rendering styles, Pattern
// Lock, the library behind the Object Browser, the Property Editor, the menus.
"use strict";
const { oldSizeRun } = require("./harness");      // (Round r33 / 4) the size run every document had before r33: a document starts with none since (harness.js)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { load, pageHTML } = require("./harness");

const S = { pieces: [], seams: [], stitches: [], images: [], sel: [], show: {}, ui: { render: "front" }, lib: null, nextSegId: 1, nextShapeId: 1, nextId: 1, undo: [], redo: [] };
const G = load(["V", "mkShape", "rectShape", "mkPiece", "VIEW", "VIEW_DEFAULT", "VIEW_GROUPS", "RENDER", "RANDOM_COLS", "isLocked", "freeSel", "pickable", "pieceFill",
  "LIB", "LIB_KINDS", "normLibItem", "normLib", "libOf", "fabricOf", "libAdd", "libDelete", "libAssign", "normUI", "snap", "unsnap", "docJSON", "loadDoc", "checkDoc", "defaultGrading"],
  { S, ui: () => {}, draw: () => {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
const { rectShape, mkPiece, VIEW, VIEW_DEFAULT, VIEW_GROUPS, RENDER, RANDOM_COLS, isLocked, freeSel, pickable, pieceFill, LIB, LIB_KINDS, normLibItem, normLib, fabricOf, libAdd, libDelete, libAssign, normUI, snap, unsnap, docJSON, loadDoc, defaultGrading } = G;

const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.stitches = []; S.images = []; S.sel = []; S.show = { ...VIEW_DEFAULT }; S.ui = { render: "front" }; S.lib = normLib(null); S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.grading = oldSizeRun(); S.selStitch = null; }
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
const DOC = `
  S.pieces.length = 0; S.seams.length = 0; S.stitches.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}], true));
  const B = app.mkPiece("B", app.mkShape([{x:600,y:0},{x:800,y:0},{x:800,y:300},{x:600,y:300}], true));
  S.pieces.push(A, B); S.sel = [A.id]; app.commit(); S.undo.length = 0;
  const at = (q) => app.toS(q), out = {}, P = () => S.pieces[0];
  const names = (items) => items.filter(x => x.n).map(x => x.n), heads = (items) => items.filter(x => x.hd).map(x => x.hd);
  const run = (items, n) => { const it = items.find(x => x.n === n); if (!it) throw new Error("no menu item " + n); it.f(); };
`;

/* ---------- the page ---------- */
test("the page's layout: a menu bar, selectors in the 2D window, the toolbar after the drawing area, Object Browser over Property Editor", () => {
  const html = pageHTML();
  for (const id of ["menubar", "sel2d", "sel3d", "ob", "ob-tabs", "ob-add", "ob-copy", "ob-assign", "ob-items", "ob-grading", "list", "pe", "props", "mode"]) assert.ok(html.includes('id="' + id + '"'), id);
  assert.deepStrictEqual([...html.matchAll(/class="mb" data-m="([^"]+)"/g)].map(m => m[1]), ["file", "edit", "3d", "2d", "materials", "avatar", "fabric", "production", "render", "settings", "help"]);      // (the r19 follow-up: Render, where the reference has it, after Production; Round FIX-2 / B: Fabric, after Avatar as in W32)
  assert.ok(html.indexOf('id="stage"') < html.indexOf('id="rail"'), "the 2D toolbar comes after the drawing area: it sits at its right");
  assert.ok(/#rail \{[^}]*grid-template-columns: 31px 31px/.test(html), "in two columns");
  assert.ok(html.indexOf('id="ob"') < html.indexOf('id="pe"'), "the Object Browser is above the Property Editor");
  assert.ok(!/id="s-view"[^>]*>VIEW/.test(html), "the VIEW button of the status bar is gone: the selectors replace it");
});

/* ---------- display ---------- */
test("the rendering styles: the fabric's colour in front, its back colour behind, plain in monochrome, a colour-blind-safe colour each in random", () => {
  reset();
  const a = mkPiece("A", rectShape(0, 0, 10, 10)), b = mkPiece("B", rectShape(20, 0, 10, 10)); S.pieces.push(a, b);
  assert.deepStrictEqual(RENDER.map(r => r[0]), ["front", "mono", "translucent", "transparent", "back", "random"]);      // (Translucent and Transparent built in Round r17b / 2)
  assert.deepStrictEqual(VIEW_GROUPS.map(g => g[0]), ["sewing", "garment", "info", "render", "lock"]);
  const f2 = libAdd("fabric"); f2.color = "#aabbcc"; f2.back = "#112233"; b.fabric = f2.id;
  assert.strictEqual(pieceFill(b, "front"), "#aabbcc"); assert.strictEqual(pieceFill(b, "back"), "#112233");
  assert.strictEqual(pieceFill(b, "mono"), pieceFill(a, "mono"), "monochrome: every pattern the same");
  assert.notStrictEqual(pieceFill(a, "random"), pieceFill(b, "random"), "random: neighbours differ");
  assert.strictEqual(RANDOM_COLS.length, 8); assert.ok(RANDOM_COLS.includes("#0072B2") && RANDOM_COLS.includes("#E69F00"), "Okabe and Ito's palette");
  assert.strictEqual(normUI({ render: "sparkly" }).render, "front"); assert.strictEqual(normUI({ render: "random" }).render, "random");
  assert.deepStrictEqual(normUI({ show3d: { buttons: false, zippers: true, x: "y" } }).show3d, { buttons: false });
});

test("Pattern Lock: with Lock All Pattern Outlines no pattern can be picked, moved or deleted; the patterns' own locks are left alone", () => {
  reset();
  const a = mkPiece("A", rectShape(0, 0, 10, 10)), b = mkPiece("B", rectShape(20, 0, 10, 10)); b.lock = true; S.pieces.push(a, b); S.sel = [a.id, b.id];
  assert.deepStrictEqual(pickable(), [a.id]); assert.deepStrictEqual(freeSel().map(p => p.id), [a.id]);
  S.show.lockAll = true;
  assert.strictEqual(isLocked(a), true); assert.deepStrictEqual(pickable(), []); assert.deepStrictEqual(freeSel(), []);
  assert.strictEqual(a.lock, false, "the pattern itself is not changed");
  S.show.lockAll = false; assert.strictEqual(isLocked(a), false); assert.strictEqual(isLocked(b), true);
});

test("the selectors in the booted app: each lists its switches, a choice is saved and changes what is drawn and picked", () => {
  const r = boot({ script: DOC + `
    out.groups = ["sewing", "garment", "info", "render", "lock"].map(g => names(app.selectorItems(g)));
    out.heads = ["sewing", "garment", "info", "render", "lock"].map(g => heads(app.selectorItems(g))[0]);
    run(app.selectorItems("garment"), "Show Seam Allowance"); run(app.selectorItems("info"), "Show Angle");
    out.show = [S.show.sa, S.show.angle, app.storage.get("pdraft:view")];      // (Round r23 / 1: view state, not written)
    run(app.selectorItems("render"), "Random Color Surface");
    out.render = [S.ui.render, JSON.parse(app.storage.get("pdraft:ui")).render === undefined ? "not written" : "written", app.selectorItems("render").filter(x => x.on).map(x => x.n)];
    // Pattern Lock: a click on a pattern picks nothing
    app.setTool("edit_pattern"); const s = at({ x: 400, y: 150 });
    run(app.selectorItems("lock"), "Lock All Pattern Outlines"); S.sel = []; app.click(s.x, s.y); out.locked = [S.sel.length, S.selSeg];
    run(app.selectorItems("lock"), "Lock All Pattern Outlines"); app.click(s.x, s.y); out.unlocked = [S.sel.length, S.selSeg];
    out.three = names(app.VIEW3D.trim.map(x => ({ n: x[1] })));
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.heads, ["Sewing", "2D Pattern", "2D Information", "2D Pattern Rendering Style", "Pattern Lock"]);
  assert.deepStrictEqual(o.groups[0], ["Show Sewing", "Show 2D Sewing Lengths" /* (Round r20 / 3) */, "Show Topstitch", "Show Puckering"]);
  assert.deepStrictEqual(o.groups[1], ["Show Baseline", "Show Seam Allowance", "Show Grading", "Show Reference Line", "Show Symmetric/Instance Lines", "Show Link Lines", "Show Pins", "Avatar Outline" /* (Round FIX-2 / B: the avatar's outline in the 2D window's own button, the maintainer's brief) */]);
  assert.deepStrictEqual(o.groups[2], ["Show Pattern Name", "Show Annotations", "Show Line Length", "Show Angle", "Show Grainline", "Show 2D Measurements", "Show Ruler", "Show Guideline"]);
  assert.deepStrictEqual(o.groups[3], ["Front Texture Surface", "Monochrome Surface", "Translucent Surface", "Transparent Surface", "Show Mesh", "Back Texture Surface", "Random Color Surface"], "the reference's list, every row built (Round r17b / 2; greyed as not built since Round D / D1, Q13)");
  // (Round build-1: Lock All Internal Lines, Lock All Baselines (on from the start) and Lock All Guidelines are built)
  assert.deepStrictEqual(o.groups[4], ["Lock All Pattern Outlines", "Lock All Internal Lines", "Lock All Baselines", "Lock All Guidelines"]);
  assert.deepStrictEqual(o.show, [false, true, null], "flipped, for the session only (Round r23 / 1)");
  assert.deepStrictEqual(o.render, ["random", "not written", ["Random Color Surface"]]);
  assert.deepStrictEqual(o.locked, [0, -1]); assert.deepStrictEqual(o.unlocked, [1, 1]);
  assert.ok(o.three.includes("Show Zippers") && o.three.some(n => n.startsWith("Show Buttons")));
});

/* ---------- the library ---------- */
test("the library: seven kinds, each with its fields for the Property Editor; a document always has a fabric to start from", () => {
  reset();
  assert.deepStrictEqual(LIB_KINDS, ["fabric", "button", "buttonhole", "topstitch", "puckering", "trim", "zipper"]);
  const L = S.lib;
  assert.strictEqual(L.fabric.length, 1); assert.strictEqual(L.fabric[0].name, "FABRIC 1"); assert.strictEqual(L.topstitch[0].name, "Default Topstitch");
  assert.strictEqual(L.button[0].name, "Default Button"); assert.strictEqual(L.buttonhole[0].name, "Default Buttonhole"); assert.strictEqual(L.zipper.length, 0);
  const has = (kind, labels) => { const got = LIB[kind].fields.map(f => f[2]); for (const l of labels) assert.ok(got.includes(l), kind + " has " + l); };
  has("fabric", ["Name", "Item No.", "Cost (USD)", "Construction", "Supplier", "Owner", "Texture Mapping", "Type", "Color", "Opacity", "Roughness", "Reflection Intensity", "Metalness", "Preset", "Thickness", "Weight"]);
  has("button", ["Thread Type", "Width", "Link to Fastened Buttonhole", "Thickness", "Weight", "Color"]);
  has("buttonhole", ["Shape", "Width", "Color"]);
  has("zipper", ["Function", "Type", "Teeth", "Slider", "Puller", "Stopper", "Top stop", "Bottom stop", "Gauge", "Teeth Width", "Size", "Weight", "Thickness", "Tape Width (each side)"]);
  // the fabric presets and the zipper types by their plain names
  const choice = (kind, key) => LIB[kind].fields.find(f => f[1] === key)[3];
  assert.deepStrictEqual(choice("fabric", "physical"), ["Custom", "Light woven", "Medium woven", "Heavy woven", "Single jersey", "Rib knit"]);
  assert.deepStrictEqual(choice("zipper", "type"), ["Coil", "Moulded plastic", "Metal", "Invisible"]); assert.strictEqual(LIB.zipper.def.type, "Coil");
  for (const kind of LIB_KINDS) for (const f of LIB[kind].fields) if (Array.isArray(f[3])) { assert.ok(f[3].includes(LIB[kind].def[f[1]]), kind + "." + f[1] + ": the default is one of the choices"); }
  for (const c of choice("fabric", "physical").concat(choice("zipper", "type"))) assert.ok(/^[A-Z][a-z]+( [a-z]+)?$/.test(c), "\"" + c + "\" is a plain name: no number, no underscore");
  assert.strictEqual(LIB.button.def.width, 20); assert.strictEqual(LIB.buttonhole.def.width, 23); assert.strictEqual(LIB.zipper.def.gauge, "#3"); assert.strictEqual(LIB.zipper.def.teethW, 3);
  assert.ok(LIB.zipper.def.tapeW >= 10 && LIB.zipper.def.tapeW <= 12, "a realistic tape width");
  // every field has a default of the right type
  for (const kind of LIB_KINDS) for (const [, k, , type] of LIB[kind].fields) {
    const d = LIB[kind].def[k];
    assert.ok(d !== undefined, kind + "." + k + " has a default");
    if (type === "num") assert.strictEqual(typeof d, "number", kind + "." + k); if (type === "check") assert.strictEqual(typeof d, "boolean"); if (Array.isArray(type)) assert.ok(type.includes(d), kind + "." + k + " default is one of its choices");
  }
});

test("library items: add, copy, delete, assign; junk in a file is made safe; they are saved and part of undo", () => {
  reset();
  const a = mkPiece("A", rectShape(0, 0, 10, 10)), b = mkPiece("B", rectShape(20, 0, 10, 10)); S.pieces.push(a, b);
  assert.strictEqual(fabricOf(a), S.lib.fabric[0], "a pattern is cut from the first fabric until it is given another");
  const f2 = libAdd("fabric"); assert.strictEqual(f2.name, "FABRIC 2"); assert.notStrictEqual(f2.id, S.lib.fabric[0].id);
  const f3 = libAdd("fabric", f2); assert.strictEqual(f3.name, "FABRIC 2 copy");
  S.sel = [b.id]; assert.strictEqual(libAssign("fabric", f2), "FABRIC 2 on 1 pattern"); assert.strictEqual(fabricOf(b), f2); assert.strictEqual(fabricOf(a), S.lib.fabric[0]);
  S.sel = []; assert.strictEqual(libAssign("fabric", f2), "", "nothing selected: nothing assigned");
  assert.strictEqual(libDelete("fabric", f2.id), ""); assert.strictEqual(fabricOf(b), S.lib.fabric[0], "its patterns fall back to the first fabric");
  libDelete("fabric", f3.id); assert.ok(/at least one/.test(libDelete("fabric", S.lib.fabric[0].id)), "the last fabric stays");
  // a topstitch preset gives the selected topstitch its name and offset
  const t = libAdd("topstitch"); t.name = "Double 6"; t.offset = 6;
  S.stitches = [{ id: 1, name: "Topstitch 1", preset: "Default Topstitch", offset: 3, part: { piece: a.id, shape: 0, sids: [a.segs[0].id], t0: 0, t1: 1 } }]; S.selStitch = 1;
  assert.strictEqual(libAssign("topstitch", t), "Double 6 on Topstitch 1"); assert.deepStrictEqual([S.stitches[0].preset, S.stitches[0].offset], ["Double 6", 6]);
  assert.strictEqual(libAssign("button", S.lib.button[0]), "", "buttons can't be placed yet");
  const z = libAdd("zipper"); assert.strictEqual(z.name, "Zipper 1"); assert.strictEqual(libAdd("zipper").name, "Zipper 2");
  // junk
  const it = normLibItem("zipper", { name: 5, cost: "abc", gauge: 7, teethW: "4.5", color: "red", extra: 1 }, 9);
  assert.deepStrictEqual([it.id, it.cost, it.teethW, it.color, it.extra], [9, 1, 4.5, "#333333", undefined]); assert.strictEqual(typeof it.name, "string");
  // a choice that is not one of the choices falls back; a zipper type from an earlier build keeps its kind of teeth
  assert.deepStrictEqual(["Plastic_02", "Metal_01", "Coil_01", "Invisible", "Moulded plastic", "Velcro", 7].map(t => normLibItem("zipper", { type: t }, 1).type), ["Moulded plastic", "Metal", "Coil", "Invisible", "Moulded plastic", "Coil", "Coil"]);
  assert.deepStrictEqual(["Rib knit", "Some_Old_Preset", ""].map(p => normLibItem("fabric", { physical: p, weight: 222 }, 1)).map(f => [f.physical, f.weight]), [["Rib knit", 222], ["Custom", 222], ["Custom", 222]]);
  const n = normLib({ fabric: [{ id: 4, name: "Wool", color: "#ABCDEF" }, { id: 4, name: "dup" }, null, { name: "no id" }], zipper: "x", nextId: 2 });
  assert.deepStrictEqual(n.fabric.map(f => [f.id, f.name, f.color]), [[4, "Wool", "#abcdef"]]); assert.ok(n.nextId > 4, "new ids start above the ones in the file");
  assert.strictEqual(n.topstitch.length, 1, "what a file lacks is filled in");
  // saved, and part of undo
  const d = JSON.parse(docJSON()); assert.strictEqual(d.lib.topstitch.length, 2); assert.strictEqual(d.lib.zipper.length, 2);
  const s0 = snap(); libAdd("trim"); assert.strictEqual(S.lib.trim.length, 1); unsnap(s0); assert.strictEqual(S.lib.trim.length, 0);
  reset(); loadDoc(d); assert.strictEqual(S.lib.topstitch[1].name, "Double 6"); assert.strictEqual(S.pieces[1].fabric, undefined);
  reset(); loadDoc({ v: 9, nextId: 2, pieces: [JSON.parse(JSON.stringify(mkPiece("Old", rectShape(0, 0, 9, 9))))], seams: [] });
  assert.strictEqual(S.lib.fabric.length, 1, "an older file gets the starting library");
});

test("the Object Browser in the booted app: tabs, Add / Copy / Assign, and the Property Editor showing what is picked", () => {
  const r = boot({ script: DOC + `
    out.tabs = app.OB_TABS.map(t => t[0]);
    app.obSelect("fabric", null); out.empty = [S.ob.tab, S.ob.sel, /Pattern/.test(app.el("props").innerHTML)];
    app.obAdd(); const f = S.lib.fabric[1];
    out.added = [S.lib.fabric.length, S.ob.sel === f.id, S.undo.length, /<h2>Fabric<\\/h2>/.test(app.el("props").innerHTML), /Physical Property/.test(app.el("props").innerHTML)];
    // a field typed in the Property Editor
    app.el("lp-color").value = "#ff8800"; app.el("lp-color").onchange(); app.el("lp-thickness").value = "0.8"; app.el("lp-thickness").onchange();
    out.edited = [f.color, f.thickness, S.undo.length];
    // a preset brings its typical weight and thickness, which can be typed over; Custom leaves them alone
    app.el("lp-physical").value = "Heavy woven"; app.el("lp-physical").onchange(); out.preset = [f.physical, f.weight, f.thickness];
    app.el("lp-weight").value = "410"; app.el("lp-weight").onchange(); app.el("lp-physical").value = "Custom"; app.el("lp-physical").onchange(); out.custom = [f.physical, f.weight, f.thickness];
    app.obAssign(); out.assigned = [P().fabric === f.id, /Assigned/.test(toasts[toasts.length - 1])];
    app.obCopy(); out.copied = [S.lib.fabric.length, S.lib.fabric[2].name, S.lib.fabric[2].color];
    // a press on the canvas hands the Property Editor back to the pattern
    const s = at({ x: 200, y: 150 }); app.setTool("edit_pattern"); app.click(s.x, s.y);
    out.back = [S.ob.sel, /Information/.test(app.el("props").innerHTML), /id="pp-fab"/.test(app.el("props").innerHTML)];
    // the pattern's own fabric choice, and the selected line's seam allowance with its corners
    app.el("pp-fab").value = String(S.lib.fabric[0].id); app.el("pp-fab").onchange({ target: app.el("pp-fab") }); out.fab = P().fabric === S.lib.fabric[0].id;
    const e1 = at({ x: 200, y: 0 }); app.click(e1.x, e1.y);
    out.line = [S.selSeg, /Selected Line/.test(app.el("props").innerHTML), /Custom Seam Allowance/.test(app.el("props").innerHTML), /Seam Type: Start/.test(app.el("props").innerHTML)];
    app.el("sl-on").onchange({ target: { checked: true } }); out.sa = P().segs[0].sa;
    app.el("sl-w").onchange({ target: { value: "15" } }); out.sa2 = P().segs[0].sa;
    // (Round r15 / 3: each corner is a picker of the reference's types, a picture each: a click opens it, a click on a type sets it)
    app.el("sl-c1").onclick(); app.el("sl-c1-round").onclick(); app.el("sl-c0").onclick(); app.el("sl-c0-slant").onclick();
    out.corners = [P().segs[0].corner, P().segs[1].corner];
    app.el("sl-cx").onclick(); app.el("sl-cx-ext").onclick(); out.both = [P().segs[0].corner === undefined, P().segs[1].corner === undefined];
    app.el("pp-grain").onchange({ target: { value: "45" } }); out.grain = app.grainAngle(P().grain);
    // the other tabs
    app.obSelect("zipper", null); app.obAdd(); out.zipper = [S.lib.zipper[0].name, /Tape Width/.test(app.el("props").innerHTML)];
    app.obSelect("grading", null); out.grading = /Grading/.test(app.el("ob-grading").innerHTML);
    app.obSelect("button", S.lib.button[0].id); app.obAssign(); out.button = toasts[toasts.length - 1];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  // (Round r19 / H16, H17: one row, Patterns then the reference's Scene … POM; Tack, Piping, Binding and Gluing are opened from the
  // Scene tab now, still by obSelect(); they were tabs, the last three since Round r11)
  // (Round r33 / 5, the maintainer's brief) Scene at the far left, Patterns beside it
  assert.deepStrictEqual(o.tabs, ["scene", "patterns", "fabric", "graphic", "button", "buttonhole", "topstitch", "puckering", "trim", "zipper", "grading", "pom"]);
  assert.deepStrictEqual(o.empty, ["fabric", null, true], "a tab with nothing picked: the Property Editor still shows the pattern");
  assert.deepStrictEqual(o.added, [2, true, 1, true, true]);
  assert.deepStrictEqual(o.edited, ["#ff8800", 0.8, 3]); assert.deepStrictEqual(o.preset, ["Heavy woven", 340, 0.8]); assert.deepStrictEqual(o.custom, ["Custom", 410, 0.8]); assert.deepStrictEqual(o.assigned, [true, true]);
  assert.deepStrictEqual(o.copied, [3, "FABRIC 2 copy", "#ff8800"]);
  assert.deepStrictEqual(o.back, [null, true, true]); assert.strictEqual(o.fab, true);
  assert.deepStrictEqual(o.line, [0, true, true, true]); assert.strictEqual(o.sa, 10); assert.strictEqual(o.sa2, 15);
  // (Round r25: Slant starts at Distance A / B 10 / 10)
  assert.deepStrictEqual(o.corners, [{ t: "slant", a: 10, b: 10 }, { t: "round" }], "Start is the corner at the line's start point, End the one at its end point");
  assert.deepStrictEqual(o.both, [true, true], "Intersection sets both");
  assert.ok(Math.abs(o.grain - 45) < 1e-9);
  assert.deepStrictEqual(o.zipper, ["Zipper 1", true]); assert.strictEqual(o.grading, true);
  assert.ok(/can't be placed on patterns yet/.test(o.button), o.button);
});

/* ---------- menus ---------- */
// (Round rename-1) the program is called Gusset: the titles and texts expected below say so (they had the old name)
test("Help → About says what the program is, names its licence, says there is no warranty and ends with the trademark notice", () => {
  const r = boot({ script: DOC + `
    const about = app.MENUS.help().find(i => i.n === "About\u2026"); out.has = !!about; about.f(); return out;
  ` });
  assert.strictEqual(r.result.has, true);
  const m = r.modals[r.modals.length - 1];
  assert.strictEqual(m.title, "Gusset – Pattern Drafter");      // (Round r24 follow-up: About's title is the name in full) assert.deepStrictEqual(m.keys, ["ok"]);
  assert.ok(/GNU General Public License/.test(m.text) && /either version 3 of the License, or \(at your option\) any later version/.test(m.text) && /WITHOUT ANY WARRANTY/.test(m.text) && /LICENSE/.test(m.text) && /ATTRIBUTION\.md/.test(m.text), m.text);
  // (Round PUB-1b, the maintainer's decision: the notice is gone, and no other program is named anywhere)
  assert.ok(m.text.endsWith("(all rights reserved, TRADEMARKS.md).") && !/trademark of/.test(m.text), "no notice of another program's trademark");
});

test("the menus: File, Edit, 2D, Avatar, Settings, Help; their commands run the same code as the keys and the old buttons", () => {
  const r = boot({ script: DOC + `
    const flatF = (items) => items.filter(Boolean).flatMap(x => x.menu ? flatF(x.menu()) : [x]);
    out.file = names(flatF(app.MENUS.file())); out.edit = names(app.MENUS.edit()); out.settings = names(app.MENUS.settings()); out.avatar = names(app.MENUS.avatar());
    // the 2D menu is in submenus since Round D / D2 (W49): read it flat
    const flat = (items) => items.filter(Boolean).flatMap(x => x.menu ? flat(x.menu()) : [x]);
    const two = flat(app.MENUS["2d"]()); out.two = [app.MENUS["2d"]().filter(x => x && x.menu).map(x => x.n), names(two).length, names(two).includes("Fullness (Point)"), names(two).includes("Auto Fitting")];      /* (Round r33b / 2: Seamless Blocking is built; Round FIX-3b / B: Set Sublayer too, so Auto Fitting is the example of a tool not built) */
    // File
    let file = null; app.setDownload((n, t) => { file = n; });
    run(app.MENUS.file(), "Save Project"); out.save = file;
    run(flatF(app.MENUS.file()), "SVG, true size"); out.svg = file;
    let dlg = null; app.answer = (t) => { dlg = t; return {}; };
    run(app.MENUS.settings(), "Notch Settings\\u2026"); out.notch = dlg;
    // Edit
    run(app.MENUS.edit(), "Select All"); out.all = [S.sel.length, S.tool];
    run(app.MENUS.edit(), "Copy"); run(app.MENUS.edit(), "Paste"); app.click(400, 300); out.pasted = S.pieces.length;
    run(app.MENUS.edit(), "Undo"); out.undone = S.pieces.length;
    out.undoOff = [app.MENUS.edit().find(x => x.n === "Redo").off, app.MENUS.edit().find(x => x.n === "Undo").off];
    // 2D: a tool by name
    run(flat(app.MENUS["2d"]()), "Punch Mark"); out.tool = [S.tool, flat(app.MENUS["2d"]()).find(x => x.n === "Punch Mark").on];
    // Settings: unit, and the list of shortcuts
    run(app.MENUS.settings(), "Centimeters"); out.unit = [S.unit, app.MENUS.settings().find(x => x.n === "Centimeters").on];      // (Round r27: one spelling in the program's text, the American of the menu rows taken from the references)
    out.keys = app.shortcutsDialog().map(x => x[0]);
    // File > New: an empty document with an empty history (it asks about unsaved work first; the harness answers Don't Save)
    run(app.MENUS.file(), "New Project"); out.fresh = [S.pieces.length, S.seams.length];
    app.undo(); out.back = S.pieces.length;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  for (const n of ["New Project", "Project", "Save Project", "DXF", "Pattern File (.pdraft, .json)…", "SVG, true size", "Print or PDF…", "2D Window as a Picture"]) assert.ok(o.file.includes(n), "File has " + n);
  for (const n of ["Undo", "Redo", "Copy", "Paste", "Mirror Paste", "Delete", "Select All", "Invert Selection"]) assert.ok(o.edit.includes(n), "Edit has " + n);
  for (const n of ["Millimeters", "Centimeters", "Inches", "Keyboard Shortcuts…"]) assert.ok(o.settings.includes(n), "Settings has " + n);
  assert.ok(o.settings.some(n => /^User Settings/.test(n)), "User Settings opens the settings dialog (Round D / D7, as W31)");
  // (Round FIX-2 / B) Measurement ▸ at the end (W51's avatar tapes): one row more
  assert.ok(/^Load Avatar/.test(o.avatar[0]) && o.avatar[o.avatar.length - 1] === "Measurement"); assert.strictEqual(o.avatar.length, 16, "Load Avatar, four arrangement commands, two for the simulation, the eight camera views while no avatar is loaded, and Measurement");
  assert.ok(o.two[0].includes("Sewing") && o.two[0].includes("Create"), JSON.stringify(o.two[0])); assert.ok(o.two[1] >= 35, "every tool that works: " + o.two[1]); assert.strictEqual(o.two[2], true); assert.strictEqual(o.two[3], false, "tools that are not built are left out (Auto Fitting since Round FIX-3b; Set Sublayer until then: Spiral was the example until Round r10 / 5 built it, Seamless Blocking until Round r33b / 2)");
  assert.strictEqual(o.save, "pattern.pdraft"); assert.ok(/\.svg$/.test(o.svg)); assert.strictEqual(o.notch, "Notch Settings");
  assert.deepStrictEqual(o.all, [2, "transform_pattern"]); assert.strictEqual(o.pasted, 4); assert.strictEqual(o.undone, 2); assert.deepStrictEqual(o.undoOff, [false, true]);
  assert.deepStrictEqual(o.tool, ["punch_mark", true]); assert.deepStrictEqual(o.unit, ["cm", true]);
  for (const k of ["A", "Z", "V", "N", "M", "K", "F", "Ctrl+D", "Enter", "Esc"]) assert.ok(o.keys.includes(k), "the shortcut list has " + k);
  assert.deepStrictEqual(o.fresh, [0, 0]); assert.strictEqual(o.back, 0, "New starts a new history: undo does not bring the old document back");
  assert.ok(r.modals.some(m => m.title === "Unsaved changes"));
});

module.exports = T;
