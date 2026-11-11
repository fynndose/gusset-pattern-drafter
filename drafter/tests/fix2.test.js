// Round FIX-2: the maintainer's beta.7 feedback and the audit's small rows. Batch B: hidden things made findable (the Avatar
// Outline in the 2D window's own display button and the 2D menu; the menus the audit found missing: Fabric, Avatar ▸
// Measurement, 3D ▸ Garment Resolution, 2D ▸ Create ▸ Dart, the volume tools in 3D ▸ Measurement). Create History Group… on the
// pattern menus themselves is checked where those menus are pinned row by row (roundg1.test.js, W1 and W18).
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 180000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 180 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// a menu as names: a submenu's rows under "Name ▸"; a row not built carries "(nb)"
const MENU = `
  const flat = (items, pre, out) => { for (const it of (items || []).filter(Boolean)) { if (it.sep || it.hd) continue;
    const n = pre + String(it.n).replace(/ [(]not built yet[)]$/, "") + (it.nb ? " (nb)" : "");
    out.push(n); if (it.menu) flat(it.menu(), n + " ▸ ", out); } return out; };
`;

test("FIX-2 / B: the menus the audit found missing are there, with only built rows (Fabric ▸ Texture, Avatar ▸ Measurement, 3D ▸ Garment Resolution, 2D ▸ Create ▸ Dart, the volume tools, 2D ▸ Avatar Outline), with Show Tools That Are Not Built Yet on and off", () => {
  const o = boot({ three: true, blank: true, script: MENU + `
    const out = {};
    for (const nb of [false, true]) { S.ui.unbuilt = nb; out[nb ? "on" : "off"] = { fabric: flat(app.MENUS.fabric(), "", []), avatar: flat(app.MENUS.avatar(), "", []), d3: flat(app.MENUS["3d"](), "", []), d2: flat(app.MENUS["2d"](), "", []) }; }
    return out;` }).result;
  for (const k of ["off", "on"]) {
    const m = o[k];
    assert.deepStrictEqual(m.fabric, ["Texture", "Texture ▸ Edit Texture (2D)", "Texture ▸ Edit Texture (3D)"], k);      // (Round FIX-4b / A, beta.8 gate G9: the 2D row moves the grainline only and is named as its toolbar button)
    const meas = m.avatar.filter(n => n.startsWith("Measurement ▸ "));
    assert.deepStrictEqual(meas, ["Measurement ▸ Edit Measure (Avatar)", "Measurement ▸ Basic Tape Measure (Avatar)", "Measurement ▸ Surface Tape Measure (Avatar)", "Measurement ▸ Height Measure (Avatar)",
      "Measurement ▸ Basic Circumference Measure (Avatar)", "Measurement ▸ Surface Circumference Measure (Avatar)"], k + ": the built tapes only");
    assert.deepStrictEqual(m.d3.filter(n => n.startsWith("Garment Resolution ▸ ")), ["Garment Resolution ▸ Hi-Res Garment", "Garment Resolution ▸ Low-Res Garment", "Garment Resolution ▸ Custom Resolution"], k);
    assert.ok(m.d3.includes("Measurement ▸ Volume Measure (Garment/Bag)") && m.d3.includes("Measurement ▸ Edit Volume Measure (Garment/Bag)"), k);
    assert.ok(m.d2.includes("Create ▸ Dart"), k + ": 2D ▸ Create ▸ Dart");
    assert.ok(m.d2.indexOf("Create ▸ Dart") === m.d2.indexOf("Create ▸ Internal Spiral") + 1, k + ": after the internal shapes, before Seamless Blocking (W49)");
    // (Round FIX-3 / A: Edit Avatar Outline is gone; the outline stands on the floor line, with no offset to drag)
    assert.ok(m.d2.includes("Avatar Outline ▸ Front") && !m.d2.includes("Avatar Outline ▸ Edit Avatar Outline"), k + ": 2D ▸ Avatar Outline ▸");
    for (const list of [m.fabric, meas]) assert.ok(!list.some(n => / [(]nb[)]$/.test(n)), k + ": no row that is not built in the new menus");
  }
});

test("FIX-2 / B: the 2D window's own 2D Pattern display button has Avatar Outline ▸ (Front by default since Round FIX-3 / A; drawn only with an avatar), as Settings ▸ Display ▸ 2D Pattern has", () => {
  const o = boot({ three: true, blank: true, script: MENU + `
    const it = app.selectorItems("garment"), row = it.find(r => r && r.n === "Avatar Outline");
    const out = { has: !!row, rows: row ? flat(row.menu(), "", []) : [], start: S.ui.avOut || "off" };
    row.menu().find(r => r && r.n === "Front").f(); out.after = S.ui.avOut;
    out.others = ["sewing", "info", "render", "lock"].some(g => app.selectorItems(g).some(r => r && r.n === "Avatar Outline"));
    return out;` }).result;
  assert.ok(o.has, "the row is in the 2D Pattern button");
  assert.deepStrictEqual(o.rows.slice(0, 4), ["Off", "Front", "Back", "Side (Left)"]);
  assert.strictEqual(o.start, "front", "Front at start (Round FIX-3 / A, the maintainer's brief: on by default; drawn only when there is an avatar)");
  assert.strictEqual(o.after, "front");
  assert.strictEqual(o.others, false, "only in the 2D Pattern button");
});

/* ---- batch C: the maintainer's beta.7 list ---- */
const RECT = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
  S.pieces.push(A); S.sel = [A.id]; app.commit();
`;

test("FIX-2 / C1: Glue Fill, Sticker and Edit Gluing on the 2D toolbar too: each picks the tool itself (one implementation, both windows), and its slot shows it in hand", () => {
  const o = boot({ three: true, blank: true, script: `
    const T = app.ev("TOOLS"), G = app.ev("GROUPS"), out = {};
    out.win = ["glue_fill_2d", "sticker_2d", "edit_gluing_2d"].map(id => T[id] && T[id].win);
    app.setTool("sticker_2d"); out.tool = S.tool; out.tool3 = S.tool3;
    out.active = G.find(g => g.some(x => x.id === "sticker_2d")).active;
    app.setTool("glue_fill_2d"); out.tool2 = S.tool;
    return out;` }).result;
  assert.deepStrictEqual(o.win, ["2D", "2D", "2D"]);
  assert.deepStrictEqual([o.tool, o.tool3, o.active, o.tool2], ["sticker", "sticker", "sticker_2d", "glue_fill"]);
});

test("FIX-2 / C2: Trace as a Pattern closed by internal lines: sides A, B, D and a line from B to D give A, the parts of B and D on A's side and the line; two lines cutting two corners give the outline with both corners cut; a selection that closes no loop is traced as before", () => {
  const o = boot({ blank: true, script: RECT + `
    const L = app.ev("lineRef"), add = app.ev("addChild"), mk = app.mkShape, out = {};
    const trace = (sel) => { S.traceSel = sel; const lines = app.ev("traceLines")(); app.setTool("trace"); app.ev("traceAsPattern")(lines);
      const at = app.toS({ x: 900, y: 200 }); app.fire("pointermove", at); app.fire("pointerdown", at); app.fire("pointerup", at);
      const q = S.pieces[S.pieces.length - 1]; return [S.pieces.length, q.pts.length, Math.round(Math.abs(app.ev("signedArea")(q.pts)))]; };
    add(A, "internals", mk([{x:100,y:0},{x:100,y:400}], false));
    out.one = trace([L(A, A, 0), L(A, A, 2), L(A, A, 3), L(A, A.internals[0], 0)]);
    S.pieces.length = 1; A.internals = []; app.commit();
    add(A, "internals", mk([{x:150,y:0},{x:200,y:50}], false)); add(A, "internals", mk([{x:200,y:350},{x:150,y:400}], false));
    out.two = trace([L(A, A, 0), L(A, A, 1), L(A, A, 2), L(A, A, 3), L(A, A.internals[0], 0), L(A, A.internals[1], 0)]);
    S.pieces.length = 1; app.commit();
    out.plain = trace([L(A, A, 0), L(A, A, 1), L(A, A, 2), L(A, A, 3)]);
    out.src = A.pts.length;
    return out;` }).result;
  assert.deepStrictEqual(o.one, [2, 4, 100*400], "the left half: four points");
  assert.deepStrictEqual(o.two, [2, 6, 80000 - 2*1250], "both corners cut off");
  assert.deepStrictEqual(o.plain, [2, 4, 80000], "the whole outline, as before");
  assert.strictEqual(o.src, 4, "the source pattern is not changed");
});

test("FIX-2 / C3: with the Pleat tool the line under the pointer is tracked, and the place the click would take is what pleatOutlinePt() gives (drawn as Fullness's dot)", () => {
  const o = boot({ blank: true, script: RECT + `
    app.setTool("pleats"); const s = app.toS({ x: 100, y: 0 }); app.fire("pointermove", s);
    const h = S.hover, q = h && app.ev("pleatOutlinePt")(h, s.x, s.y, null);
    return { k: h && h.k, q: q && typeof q === "object" ? [Math.round(q.x), Math.round(q.y)] : q };` }).result;
  assert.strictEqual(o.k, "seg");
  assert.deepStrictEqual(o.q, [100, 0], "the middle of the top line (caught as Add Point catches it)");
});

test("FIX-2 / C5: the 3D button column has two dividers: after Quality / Schematic Render and before Render", () => {
  const o = boot({ three: true, blank: true, script: `
    const h3 = app.ev("document").getElementById("sel3d"), seq = h3.children.map(c => c.className === "sel-div" ? "|" : c.id || "btn");
    return seq;` }).result;
  const i = o.indexOf("schem3d");
  assert.strictEqual(o[i + 1], "|", "a divider after the render switches: " + o.join(" "));
  assert.strictEqual(o[o.indexOf("render3d") - 1], "|", "and before Render");
});

test("FIX-2 / C6: Edit Grading on one corner moves that corner alone in every size (the pattern no longer moves whole); a click on a line picks its two ends; the box and the table do the same", () => {
  const o = boot({ blank: true, oldSizeRun: true, script: RECT + `
    const G = S.grading, grp = G.groups[0], gp = app.ev("gradedPiece"), XL = grp.sizes[4], out = {};
    const pts = () => (gp(G, A, XL.id) || A).pts.map(q => [Math.round(q.x), Math.round(q.y)]);
    app.setTool("edit_grading"); let c = app.toS({ x: 200, y: 0 }); app.click(c.x, c.y); app.key("ArrowRight"); out.corner = pts();
    c = app.toS({ x: 0, y: 200 }); app.click(c.x, c.y); out.picked = S.gradeSel.map(s => s.i).sort(); app.key("ArrowLeft"); out.side = pts();
    return out;` }).result;
  assert.deepStrictEqual(o.corner, [[0, 0], [220, 0], [200, 400], [0, 400]], "XL: only the top right corner, two steps of 10 mm");
  assert.deepStrictEqual(o.picked, [0, 3], "the left line's two ends");
  assert.deepStrictEqual(o.side, [[-20, 0], [220, 0], [200, 400], [-20, 400]], "and then the left line alone");
});

test("FIX-2 / C7: the ruler's pointer marks and a guideline being dragged are drawn in the accent, not the selection yellow", () => {
  const src = require("fs").readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8");
  const body = (name) => { const i = src.indexOf("function " + name + "("); return src.slice(i, src.indexOf("\n}\n", i)); };
  assert.ok(!/#ecfd3f/i.test(body("drawRulers")) && /uiAccent\("line"\)/.test(body("drawRulers")), "the ruler's marks");
  assert.ok(!/#ecfd3f/i.test(body("drawGuides")) && /g[.]id === live [?] uiAccent[(]"line"[)]/.test(body("drawGuides")), "a guideline dragged");
});

test("FIX-2 / C8: a fresh start shows no pattern names and no grain lines (both switchable)", () => {
  const o = boot({ blank: true });
  assert.strictEqual(o.show.name, false); assert.strictEqual(o.show.grainline, false);
  assert.strictEqual(o.show.sa, true, "the rest as before");
});

test("FIX-2 / C9: a grain line never leaves its pattern: one drawn across the outline is brought inside along its own line; one dragged out stays in; a pattern made narrower takes it with it; an older file's comes inside on opening; one inside is left as it is", () => {
  const o = boot({ blank: true, script: RECT + `
    const fit = app.ev("grainFit"), out = {}, inside = (p) => { const poly = app.ev("flatten")(p, 16), I = app.ev("inside"); return I(poly, p.grain.a) && I(poly, p.grain.b); };
    A.grain = { a: { x: 100, y: 50 }, b: { x: 100, y: 350 } }; out.same = fit(A, A.grain) === A.grain;
    app.push(); A.grain = { a: { x: 100, y: -200 }, b: { x: 100, y: 600 } }; app.commit(); out.long = [inside(A), Math.round(A.grain.a.x), Math.round(A.grain.b.x)];
    app.push(); A.grain = { a: { x: 300, y: 100 }, b: { x: 300, y: 300 } }; app.commit(); out.outside = inside(A);
    app.push(); A.pts[1].x = 120; A.pts[2].x = 120; A.grain = { a: { x: 150, y: 100 }, b: { x: 150, y: 300 } }; app.commit(); out.narrow = [inside(A), A.grain.a.x < 120];
    return out;` }).result;
  assert.strictEqual(o.same, true, "inside: the very same line");
  assert.deepStrictEqual(o.long, [true, 100, 100], "the same direction, shortened to fit");
  assert.strictEqual(o.outside, true);
  assert.deepStrictEqual(o.narrow, [true, true]);
});

test("FIX-2 / C10: a fabric's Material has Front / Back / Side (frame S28/at-07-45.0-pe); Back and Side keep their own Texture Mapping and Type, Side its Color; kept only once set; saved and opened", () => {
  const o = boot({ blank: true, script: RECT + `
    const f = app.libOf().fabric[0], norm = app.ev("normLibItem"), face = app.ev("fabFace"), out = {};
    out.none = "faces" in norm("fabric", f, f.id);
    out.front = face(f, "front"); out.side0 = face(f, "side");
    f.faces = { side: { mapping: "Unified", type: "Leather", color: "#ABCDEF" }, back: { type: "Fabric_Shiny", bogus: 1 } }; Object.assign(f, norm("fabric", f, f.id));
    out.faces = f.faces; out.side = face(f, "side"); out.back = face(f, "back");
    const pr = app.ev("document").getElementById("props"); app.ev("LIB_FACE").tab = "side"; app.ev("libProps")(pr, "fabric", f); out.html = /class="ftab on"[^>]*data-face="side"/.test(pr.innerHTML) && /Texture Mapping/.test(pr.innerHTML);
    const d = JSON.parse(app.docJSON()); out.saved = d.lib.fabric[0].faces;
    return out;` }).result;
  assert.strictEqual(o.none, false, "nothing stored while unset");
  assert.deepStrictEqual(o.side0, { mapping: o.front.mapping, type: o.front.type, color: o.front.color }, "Side takes Front's while unset");
  assert.deepStrictEqual(o.faces, { back: { type: "Fabric_Shiny" }, side: { mapping: "Unified", type: "Leather", color: "#abcdef" } });
  assert.deepStrictEqual(o.side, { mapping: "Unified", type: "Leather", color: "#abcdef" });
  assert.strictEqual(o.back.type, "Fabric_Shiny"); assert.strictEqual(o.back.mapping, o.front.mapping);
  assert.strictEqual(o.html, true, "the Side tab in front, with its rows");
  assert.deepStrictEqual(o.saved, o.faces, "in the file");
});

test("FIX-2 / C11: the X / Y readout: each number straight after its letter, its slot sized from the decimals (Y never moves)", () => {
  const o = boot({ blank: true, script: `
    const slot = app.ev("posSlot"), out = {};
    for (const d of [0, 1, 2, 3]) { S.prefs.decimals = d; out[d] = slot(); }
    S.prefs.decimals = 1; app.ev("posShow")({ x: -12.3, y: 4 }); const D = app.ev("document"); out.w = [D.getElementById("s-x").style.width, D.getElementById("s-y").style.width];
    return out;` }).result;
  assert.deepStrictEqual([o[0], o[1], o[2], o[3]], ["6ch", "8ch", "9ch", "10ch"]);
  assert.deepStrictEqual(o.w, ["8ch", "8ch"]);
});

/* ---- batch D: the audit's small rows ---- */
test("FIX-2 / D: a pattern being moved catches another pattern's cut line (S26); Add Point catches level with the middle of another pattern's line; A over the 3D window is Select/Move (over the 2D window Transform Pattern)", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {};
    S.pieces.length = 0;
    const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
    const B = app.mkPiece("B", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:300},{x:300,y:300}], true));
    B.segs.forEach(s => s.sa = 10); S.pieces.push(A, B); app.commit();
    S.over3d = true; app.key("a"); out.tool3 = S.tool3; S.over3d = false; app.key("a"); out.tool2 = S.tool;
    app.setTool("transform_pattern"); S.sel = [A.id];
    const s0 = app.toS({ x: 100, y: 200 }), s1 = app.toS({ x: 187, y: 200 });
    app.fire("pointermove", s0); app.fire("pointerdown", s0); app.fire("pointermove", { x: (s0.x + s1.x)/2, y: s0.y }); app.fire("pointermove", s1); app.fire("pointerup", s1);
    out.moved = Math.round(Math.max(...A.pts.map(q => q.x)) * 100) / 100;
    app.undo(); S.prefs.snapPts = false; const A2 = S.pieces.find(p => p.name === "A"); S.sel = [A2.id];      // (undo puts back copies)
    app.fire("pointermove", s0); app.fire("pointerdown", s0); app.fire("pointermove", s1); app.fire("pointerup", s1);
    out.free = Math.round(Math.max(...A2.pts.map(q => q.x))); S.prefs.snapPts = true;
    const h = { p: A, sh: A, i: 3, t: 0.62, k: "seg", kind: "outline" }, sp = app.toS(app.ev("segPt")(A, 3, 0.62)), c = app.ev("midCatch")(h, sp.x, sp.y);
    out.level = c.level ? [Math.round(app.ev("segPt")(A, 3, c.t).y), Math.round(c.level[0].y)] : null;
    return out;` }).result;
  assert.deepStrictEqual([o.tool3, o.tool2], ["select_move", "transform_pattern"]);
  assert.strictEqual(o.moved, 290, "3 mm short of B's cut line: caught on it");
  assert.strictEqual(o.free, 287, "with Snap to Pattern off it goes where it is put");
  assert.deepStrictEqual(o.level, [150, 150], "on A's left line, level with the middle of B's right line");
});

test("FIX-2 / D: the Property Editor's Selected Line has 3D Line Length (the line on the cloth) and, for a symmetric pair, + Symmetric Line Length; the rows not built show greyed only while Show Tools That Are Not Built Yet is on", () => {
  const o = boot({ blank: true, three: true, script: `
    S.pieces.length = 0;
    const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
    S.pieces.push(A); S.sel = [A.id]; app.commit(); app.ev("garmentSync")();
    app.setTool("edit_pattern"); S.selKind = "outline"; S.selSeg = 0; S.selPt = -1;
    const pr = app.ev("document").getElementById("props"), html = () => { app.ev("ui")(); return pr.innerHTML.replace(/<[^>]+>/g, " "); };
    const out = {}; S.ui.unbuilt = false; out.off = html(); S.ui.unbuilt = true; out.on = html();
    const q = JSON.parse(JSON.stringify(A)); q.id = 99; q.name = "A copy"; q.link = { of: A.id, kind: "symmetric", m: [-1, 0, 0, 1, 600, 0] }; q.pts = q.pts.map(r => ({ x: 600 - r.x, y: r.y })); S.pieces.push(q); app.commit(); S.sel = [A.id]; S.selKind = "outline"; S.selSeg = 0; app.ev("garmentSync")(); out.sym = html();
    return out;` }).result;
  assert.ok(/3D Line Length\s+200[.]0 mm/.test(o.off), o.off.slice(0, 400));
  /* (Round FIX-3b / C: Shirring is built, in the Elastic section; Round BETA8-1 / E: Seam Taping is built, a switch either way; Show Schematic Line is still greyed) */ assert.ok(/Seam Taping/.test(o.off) && !/Seam Taping\s+not built yet/.test(o.on) && !/Show Schematic Line/.test(o.off) && /Show Schematic Line\s+not built yet/.test(o.on), "greyed only with the switch on");
  assert.ok(/[+] Symmetric Line Length\s+400[.]0 mm/.test(o.sym), "this line and its mirror image");
});

module.exports = T;
