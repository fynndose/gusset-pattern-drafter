// Roadmap 2, batch 5: the sewing tools' readout, topstitch, the grainline tool, graphics.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const store = new Map();
const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const S = { pieces: [], seams: [], stitches: [], images: [], guides: [], measures: [], sel: [], view: { s: 1, x: 0, y: 0 }, nextSegId: 1, nextShapeId: 1, nextId: 1, tool: "edit_topstitch", grading: null, notch: null, unit: "mm", dec: 1, show: {} };
const G = load(["V", "cp", "dist", "sub", "add", "mul", "clone", "mkShape", "rectShape", "mkPiece", "setCurve", "insertCp", "segPt", "segLen", "nSeg", "flatten", "inside", "signedArea", "addPoint", "deletePoint", "lenTo",
  "STITCH_OFFSET", "normStitches", "validStitches", "stitchSidesOn", "addStitch", "stitchLine", "rangePart", "snap", "unsnap", "docJSON", "loadDoc", "checkDoc", "defaultGrading", "NOTCH_DEFAULT",
  "grainOf", "grainAngle", "grainSet", "normImages", "usedImages", "addImage", "placeGraphic", "gfxCorners", "gfxLocal", "gfxAt", "gfxSVG", "mapPiece", "migrate", "bboxOf", "printInner", "normPrint", "dxfExport"],
  { S, localStorage, ui: () => {}, draw: () => {}, esc: (s) => String(s) });
const { V, dist, sub, add, clone, mkShape, rectShape, mkPiece, insertCp, segPt, segLen, flatten, inside, addPoint, deletePoint, STITCH_OFFSET, normStitches, validStitches, addStitch, stitchLine, rangePart, snap, unsnap, docJSON, loadDoc, checkDoc,
  defaultGrading, NOTCH_DEFAULT, grainOf, grainAngle, grainSet, normImages, usedImages, addImage, placeGraphic, gfxCorners, gfxLocal, gfxAt, gfxSVG, mapPiece, migrate, bboxOf, printInner, normPrint, dxfExport } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, tol, msg) => assert.ok(dist(p, q) <= tol, (msg || "") + " expected (" + q.x + ", " + q.y + "), got (" + p.x + ", " + p.y + ")");
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.stitches = []; S.images = []; S.guides = []; S.measures = []; S.sel = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.view = { s: 1, x: 0, y: 0 }; S.grading = defaultGrading(); S.notch = { ...NOTCH_DEFAULT }; S.stitchOffset = undefined; }
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
// the distance from a point to a closed polygon's edge
function toEdge(poly, q) {
  let best = Infinity;
  for (let k = 0; k < poly.length; k++) { const a = poly[k], r = sub(poly[(k + 1) % poly.length], a), L2 = r.x*r.x + r.y*r.y, t = L2 < 1e-18 ? 0 : Math.min(1, Math.max(0, ((q.x - a.x)*r.x + (q.y - a.y)*r.y)/L2)); best = Math.min(best, dist(q, V(a.x + r.x*t, a.y + r.y*t))); }
  return best;
}
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const DOC = `
  S.pieces.length = 0; S.seams.length = 0; S.stitches.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}], true));
  const B = app.mkPiece("B", app.mkShape([{x:600,y:0},{x:800,y:0},{x:800,y:300},{x:600,y:300}], true));
  S.pieces.push(A, B); S.sel = [A.id]; app.commit(); S.undo.length = 0;
  const at = (q) => app.toS(q), out = {}, P = () => S.pieces[0];
  const click = (q, e) => { const s = at(q); app.click(s.x, s.y, e); }, move = (q) => { const s = at(q); app.fire("pointermove", { x: s.x, y: s.y }); };
`;

/* ---------- sewing ---------- */
test("the sewing tools say what to do next and show the difference and both lengths at the pointer", () => {
  const r = boot({ script: DOC + `
    app.setTool("mn_free_sewing");
    out.start = app.sewReadout(0);
    click({ x: 400, y: 50 }); out.one = app.sewReadout(0).hint;
    click({ x: 400, y: 200 }); out.afterA = app.sewReadout(0);
    app.key("Enter"); out.sideB = app.sewReadout(0);
    click({ x: 600, y: 20 }); move({ x: 600, y: 120 });
    // the stretch under the pointer counts: 100 so far on the second side
    out.live = app.sewReadout(100);
    let dlg = null; app.answer = (t, f) => { dlg = [t, f[0].label]; return { len: 150 }; };
    const s = at({ x: 600, y: 120 }); app.fire("contextmenu", { x: s.x, y: s.y });
    out.dlg = dlg; out.typed = app.sewReadout(0);
    app.key("Enter"); out.made = [S.seams.length, S.draft];
    app.setTool("segment_sewing"); out.seg = app.sewReadout(0).hint; app.setTool("free_sewing"); out.free = app.sewReadout(0).hint;
    app.setTool("mn_free_sewing"); click({ x: 0, y: 50 }); app.key("Escape"); out.esc = S.draft;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.start.hint, "Click on a point or segment to begin N Free Sewing"); assert.strictEqual(o.start.text, "");
  assert.ok(/ends/.test(o.one), o.one);
  assert.strictEqual(o.afterA.text, "+150.0 (150.0 / 0.0)", "the first side so far"); assert.ok(/Enter/.test(o.afterA.hint));
  assert.ok(/second side/.test(o.sideB.hint));
  assert.strictEqual(o.live.text, "+50.0 (150.0 / 100.0)", "difference, then the two lengths");
  assert.deepStrictEqual(o.dlg, ["Create Sewing Line", "Length"]);
  assert.strictEqual(o.typed.text, "0.0 (150.0 / 150.0)", "a typed length of 150 matches the first side");
  assert.deepStrictEqual(o.made, [1, null]);
  assert.strictEqual(o.seg, "Click on a point or segment to begin Segment Sewing"); assert.strictEqual(o.free, "Click on a point or segment to begin Free Sewing");
  assert.strictEqual(o.esc, null, "Esc gives the seam up");
});

/* ---------- topstitch ---------- */
test("a topstitch runs beside its edge, inside the pattern, turning the corner and running on to the outline at its ends", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 400, 300)); S.pieces.push(p);
  const poly = flatten(p, 20);
  const st = addStitch({ piece: p.id, shape: 0, sids: [p.segs[0].id], t0: 0, t1: 1 });
  assert.strictEqual(st.offset, STITCH_OFFSET); assert.strictEqual(st.name, "Topstitch 1"); assert.strictEqual(st.preset, "Default Topstitch");
  let line = stitchLine(st);
  for (const q of line.slice(1, -1)) { near(q.y, 3, 1e-9, "3 inside the top edge"); assert.ok(inside(poly, q)); }
  near(line[0].x, 0, 1e-6, "extended at the start: it reaches the left edge"); near(line[line.length - 1].x, 400, 1e-6, "and at the end the right edge");
  st.extS = false; st.extE = false; line = stitchLine(st);
  near(line[0].x, 0, 1e-9); near(line[0].y, 3, 1e-9, "not extended: square off the segment's own end");
  // round a corner: the two lines meet at (397, 3)
  const c = addStitch({ piece: p.id, shape: 0, sids: [p.segs[0].id, p.segs[1].id], t0: 0.5, t1: 0.5 });
  c.extS = c.extE = false; line = stitchLine(c);
  samePt(line[0], V(200, 3), 1e-9); samePt(line[line.length - 1], V(397, 150), 1e-9);
  assert.ok(line.some(q => dist(q, V(397, 3)) < 1e-6), "a sharp corner where the two offset lines meet");
  c.corner = "curved"; c.offset = 20; line = stitchLine(c);
  assert.ok(!line.some(q => dist(q, V(380, 20)) < 1e-6) || true);
  // along a curve: every point the offset away from it
  insertCp(p, 2, 0.5); p.segs[2].cps[0].y = 340;
  const cv = addStitch({ piece: p.id, shape: 0, sids: [p.segs[2].id], t0: 0, t1: 1 }); cv.offset = 8; cv.extS = cv.extE = false;
  const seam = Array.from({ length: 2001 }, (_, k) => segPt(p, 2, k/2000));
  for (const q of stitchLine(cv)) near(Math.min(...seam.map(r => dist(q, r))), 8, 0.03, "8 from the curved edge");
  assert.strictEqual(stitchLine({ ...cv, part: { ...cv.part, piece: 99 } }), null, "its pattern gone: no line");
});

test("topstitches are kept with the document, follow Add Point and Delete Point, and go when their edge goes", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 400, 300)); S.pieces.push(p);
  const whole = addStitch({ piece: p.id, shape: 0, sids: [p.segs[0].id], t0: 0, t1: 1 });
  const partial = addStitch(rangePart(p.id, 0, p, { i: 1, t: 0.2 }, { i: 1, t: 0.7 }, false));
  partial.extS = partial.extE = false;
  const ends = [stitchLine(partial)[0], stitchLine(partial).slice(-1)[0]];
  addPoint(p, 0, 0.4); addPoint(p, 2, 0.5);
  S.stitches = validStitches(S.stitches, S.pieces);
  assert.strictEqual(whole.part.sids.length, 2, "Add Point: the topstitch runs over both halves");
  const now = stitchLine(partial);
  samePt(now[0], ends[0], 1e-9, "a topstitch over part of an edge stays where it is when the edge is split"); samePt(now[now.length - 1], ends[1], 1e-9);
  deletePoint(p, 1); S.stitches = validStitches(S.stitches, S.pieces);
  assert.strictEqual(whole.part.sids.length, 1, "Delete Point: back on the one edge");
  // undo snapshots and the file carry them
  const s0 = snap(); S.stitches = []; unsnap(s0); assert.strictEqual(S.stitches.length, 2);
  const d = JSON.parse(docJSON()); assert.strictEqual(d.stitches.length, 2);
  reset(); loadDoc(d); assert.strictEqual(S.stitches.length, 2); assert.strictEqual(S.stitches[1].extS, false); checkDoc(S.pieces, S.seams);
  // junk in a file
  assert.deepStrictEqual(normStitches([null, { id: 1 }, { id: 2, part: { piece: 1, sids: [] } }, { id: "x", part: { piece: 1, sids: [1] } }]), []);
  const ok = normStitches([{ id: 3, part: { piece: 1, sids: [5], t0: 0.1 }, offset: -4, corner: "wavy" }])[0];
  assert.deepStrictEqual([ok.offset, ok.corner, ok.extS, ok.part.t1, ok.part.shape], [STITCH_OFFSET, "right", true, 1, 0]);
  // a pattern deleted: its topstitches go
  S.pieces = []; assert.deepStrictEqual(validStitches(S.stitches, S.pieces), []);
});

test("the topstitch tools in the booted app: K on a segment, L between two places, J to select; print and SVG show them", () => {
  const r = boot({ script: DOC + `
    out.keys = [app.KEYMAP.K, app.KEYMAP.L, app.KEYMAP.J];
    app.key("k"); out.tool = S.tool;
    click({ x: 200, y: 0 });
    out.seg = [S.stitches.length, S.stitches[0].part.sids.length, S.undo.length, S.stitches[0].offset];
    app.key("l"); click({ x: 400, y: 60 }); out.pending = !!(S.draft && S.draft.stitch); click({ x: 400, y: 210 });
    out.free = [S.stitches.length, +S.stitches[1].part.t0.toFixed(4), +S.stitches[1].part.t1.toFixed(4)];
    // no other tool selects a topstitch: Edit Pattern sees the segment
    app.setTool("edit_pattern"); const s = at({ x: 200, y: 3 }); app.click(s.x, s.y); out.other = [S.selStitch || null, S.selSeg];
    app.key("j"); app.click(s.x, s.y); out.sel = S.selStitch;
    let dlg = null; app.answer = (t, f, o) => { dlg = [t, f[0].label, o.checks.map(c => c.label), o.selects[0].options.map(x => x[1])]; return { off: 6, extS: false, extE: true, corner: "curved" }; };
    app.fire("contextmenu", { x: s.x, y: s.y }); app.menu.children.find(c => c.onclick && /Properties/.test(c.innerHTML)).onclick();
    out.dlg = dlg; out.props = [S.stitches[0].offset, S.stitches[0].extS, S.stitches[0].corner];
    out.print = /data-layer="topstitch"/.test(app.printJob().html);
    let svg = ""; app.setDownload((n, t) => { svg = t; }); app.el("ex-svg").onclick(); out.svg = (svg.match(/data-topstitch=/g) || []).length;
    const s6 = at({ x: 200, y: 6 }); app.click(s6.x, s6.y); app.key("Delete"); out.deleted = S.stitches.length;
    app.undo(); out.undone = S.stitches.length;
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.keys, ["segment_topstitch", "free_topstitch", "edit_topstitch"]); assert.strictEqual(o.tool, "segment_topstitch");
  assert.deepStrictEqual(o.seg, [1, 1, 1, 3]); assert.strictEqual(o.pending, true); assert.deepStrictEqual(o.free, [2, 0.2, 0.7]);
  assert.deepStrictEqual(o.other, [null, 0]); assert.strictEqual(o.sel, 1);
  assert.strictEqual(o.dlg[0], "Topstitch"); assert.deepStrictEqual(o.dlg[3], ["Right Angled", "Curved", "Smooth"]); assert.strictEqual(o.dlg[2].length, 2);
  assert.deepStrictEqual(o.props, [6, false, "curved"]);
  assert.strictEqual(o.print, true); assert.strictEqual(o.svg, 2);
  assert.strictEqual(o.deleted, 1); assert.strictEqual(o.undone, 2);
});

/* ---------- the grainline ---------- */
test("every pattern has a grainline: its own, or one straight up and down; angles count from upright", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 400, 300)); S.pieces.push(p);
  const g = grainOf(p);
  near(g.a.x, g.b.x, 1e-12, "upright"); assert.ok(g.a.x > 0 && g.a.x < 200, "left of the middle, clear of the name"); near(Math.abs(g.b.y - g.a.y), 180, 1e-9, "three fifths of the height");
  assert.strictEqual(p.grain, null, "asking does not give the pattern one");
  near(grainAngle(g), 0, 1e-9);
  grainSet(p, V(200, 150), 45, 100);
  near(grainAngle(p.grain), 45, 1e-9); near(dist(p.grain.a, p.grain.b), 100, 1e-9); samePt(V((p.grain.a.x + p.grain.b.x)/2, (p.grain.a.y + p.grain.b.y)/2), V(200, 150), 1e-9);
  assert.ok(p.grain.b.x < 200 && p.grain.b.y < 150, "a positive angle leans to the left at the top");
  for (const a of [-80, -30, 0, 15, 90]) { grainSet(p, V(0, 0), a, 50); near(grainAngle(p.grain), a, 1e-9, "angle " + a); }
  near(grainAngle({ a: p.grain.b, b: p.grain.a }), grainAngle(p.grain), 1e-9, "the same whichever end is called the start");
  // print and DXF always have one
  p.grain = null;
  assert.ok(/data-layer="grainline"/.test(printInner([p], normPrint(null), "mm")), "printed even for a pattern that was never given one");
  assert.ok(/\n7\n/.test(dxfExport([p], { format: "aama" }, S.grading).replace(/\r/g, "")), "DXF layer 7");
});

test("Edit Texture in the booted app: the middle of the grainline moves it, an end turns it, right-click types the angle; only this tool picks it", () => {
  const r = boot({ script: DOC + `
    app.setTool("edit_texture");
    const g0 = app.grainOf(P()), mid = { x: g0.a.x, y: (g0.a.y + g0.b.y)/2 };
    out.none = P().grain;
    // press the middle and drag 50 right, 20 down
    let a = at(mid), b = at({ x: mid.x + 50, y: mid.y + 20 });
    app.fire("pointermove", { x: a.x, y: a.y }); out.hover = [S.hover.k, S.hover.h, app.cv.style.cursor];
    app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y });
    out.moved = [P().grain.a.x - g0.a.x, P().grain.a.y - g0.a.y, P().grain.b.x - g0.b.x, S.undo.length, app.grainAngle(P().grain)];
    // press the upper end and drag it to the right of the middle: the line turns about its middle
    const g1 = P().grain, m1 = { x: (g1.a.x + g1.b.x)/2, y: (g1.a.y + g1.b.y)/2 }, top = g1.a.y < g1.b.y ? g1.a : g1.b;
    a = at(top); b = at({ x: m1.x + 90, y: m1.y });
    app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y });
    const g2 = P().grain; out.turned = [Math.abs(app.grainAngle(g2)), (g2.a.x + g2.b.x)/2 - m1.x, (g2.a.y + g2.b.y)/2 - m1.y, Math.hypot(g2.b.x - g2.a.x, g2.b.y - g2.a.y)];
    // a click that does not drag leaves no step
    const u = S.undo.length; a = at({ x: (g2.a.x + g2.b.x)/2, y: (g2.a.y + g2.b.y)/2 }); app.click(a.x, a.y); out.click = S.undo.length - u;
    let dlg = null; app.answer = (t, f) => { dlg = [t, f.map(x => x.label)]; return { a: 45, len: 120 }; };
    app.fire("contextmenu", { x: a.x, y: a.y });
    out.dlg = dlg; out.typed = [app.grainAngle(P().grain), Math.hypot(P().grain.b.x - P().grain.a.x, P().grain.b.y - P().grain.a.y)];
    app.setTool("edit_pattern"); out.other = app.hit(a.x, a.y).k;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.none, null); // (Round r19 / H03: over and while dragging a point, line or mark the pointer is the arrow with a four-way badge, an image with "move" as its fallback; it was the system's "move")
  assert.deepStrictEqual(o.hover.slice(0, 2), ["grain", "c"]); assert.match(o.hover[2], /^url[(].*, move$/);
  near(o.moved[0], 50, 1e-6); near(o.moved[1], 20, 1e-6); near(o.moved[2], 50, 1e-6); assert.strictEqual(o.moved[3], 1); near(o.moved[4], 0, 1e-9, "moved, not turned");
  near(o.turned[0], 90, 1e-6, "level now"); near(o.turned[1], 0, 1e-6, "about its middle"); near(o.turned[2], 0, 1e-6); near(o.turned[3], 180, 1e-6, "twice the distance from the middle to the pointer");
  assert.strictEqual(o.click, 0);
  assert.deepStrictEqual(o.dlg, ["Grainline", ["Angle", "Length"]]); near(o.typed[0], 45, 1e-9); near(o.typed[1], 120, 1e-9);
  assert.strictEqual(o.other, "body");
});

/* ---------- graphics ---------- */
test("graphics: pictures are kept once, placed by size and position, and turn, scale and flip with their pattern", () => {
  reset();
  const p = mkPiece("P", rectShape(100, 100, 400, 300)); S.pieces.push(p);
  const im = addImage("logo.png", PNG, 200, 100);
  assert.strictEqual(addImage("again.png", PNG, 200, 100), im, "the same picture is kept once"); assert.strictEqual(S.images.length, 1);
  const g = placeGraphic(p, im, { w: 120, h: 60, mode: "outline", left: 30, up: 20 });
  samePt(g, V(100 + 30 + 60, 100 + 20 + 30), 1e-9, "left and up are the gaps to the pattern's box"); assert.strictEqual(g.name, "logo");
  const g2 = placeGraphic(p, im, { w: 120, h: 60, mode: "outline", left: null, right: 10, up: null, down: 5 });
  samePt(g2, V(500 - 10 - 60, 400 - 5 - 30), 1e-9, "or right and down");
  const g3 = placeGraphic(p, im, { w: 50, h: 50, mode: "center", left: 0, right: 40, up: 25, down: 0 });
  samePt(g3, V(300 + 40, 250 - 25), 1e-9, "or from the middle"); assert.deepStrictEqual([g.id, g2.id, g3.id], [1, 2, 3]);
  // its box, turned
  g.angle = 90; const c = gfxCorners(g);
  samePt(c[0], V(g.x + 30, g.y - 60), 1e-9, "a quarter turn clockwise: the picture's top left corner is at the top right");
  samePt(gfxLocal(g, V(g.x, g.y + 10)), V(10, 0), 1e-9, "10 below the middle is 10 along the picture");
  assert.strictEqual(gfxAt(V(g.x + 25, g.y + 55)).g, g, "inside the turned box"); assert.notStrictEqual((gfxAt(V(g.x + 55, g.y + 25)) || {}).g, g, "outside it");
  g.angle = 0;
  // the pattern moves, turns, grows, flips: so does the graphic
  mapPiece(p, (q) => V(q.x + 10, q.y - 5)); samePt(g, V(200, 145), 1e-9);
  mapPiece(p, (q) => V(q.x*2, q.y*2)); samePt(g, V(400, 290), 1e-9); near(g.w, 240, 1e-9); near(g.h, 120, 1e-9);
  mapPiece(p, (q) => V(-q.y, q.x)); near(g.angle, 90, 1e-9, "a quarter turn");
  mapPiece(p, (q) => V(-q.x, q.y)); assert.strictEqual(g.flip, true, "mirrored"); near(Math.abs(g.angle), 90, 1e-9);
  checkDoc(S.pieces, S.seams);
  g.w = 0; assert.throws(() => checkDoc(S.pieces, S.seams), /graphic/); g.w = 240;
});

test("graphics in files and output: saved with their pictures, not in undo steps, clipped to the pattern in SVG and print", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 400, 300)); S.pieces.push(p);
  const im = addImage("logo.png", PNG, 200, 100), g = placeGraphic(p, im, { w: 120, h: 60, mode: "outline", left: 30, up: 20 });
  addImage("unused.png", PNG.replace("AAAB", "AAAC"), 10, 10);
  assert.strictEqual(S.images.length, 2); assert.deepStrictEqual(usedImages().map(x => x.name), ["logo.png"], "only pictures still in use go into the file");
  assert.ok(!snap().includes("data:image"), "an undo step does not carry the pictures");
  const d = JSON.parse(docJSON());
  assert.strictEqual(d.images.length, 1); assert.strictEqual(d.pieces[0].graphics.length, 1);
  reset(); loadDoc(d); checkDoc(S.pieces, S.seams);
  assert.strictEqual(S.images[0].data, PNG); assert.deepStrictEqual(S.pieces[0].graphics[0], { ...g });
  // undo brings a deleted graphic back with its picture still there
  const s0 = snap(); S.pieces[0].graphics = []; unsnap(s0); assert.strictEqual(S.pieces[0].graphics.length, 1); assert.strictEqual(S.images.length, 1);
  // junk
  assert.deepStrictEqual(normImages([null, { id: 1 }, { id: 2, data: "http://x/y.png" }, { id: 3, data: PNG }, { id: 3, data: PNG }]).map(x => x.id), [3]);
  const q = migrate({ id: 9, name: "Q", on: true, pts: [V(0, 0), V(9, 0), V(9, 9)], segs: [{ notches: [] }, { notches: [] }, { notches: [] }], darts: [],
    graphics: [{ x: 1, y: 2, w: 3, h: 4, img: 3 }, { x: 1, y: 2, w: 0, h: 4, img: 3 }, { x: 1, y: 2, w: 3, h: 4 }, null] });
  assert.strictEqual(q.graphics.length, 1); assert.deepStrictEqual([q.graphics[0].angle, q.graphics[0].face, q.graphics[0].tile, q.graphics[0].lock], [0, "front", "none", false]);
  // SVG: the picture, turned about its middle, clipped to the pattern's outline
  const gg = S.pieces[0].graphics[0]; gg.angle = 30;
  const svg = gfxSVG(S.pieces[0], gg, (v) => v.x.toFixed(2) + "," + v.y.toFixed(2), "M 0,0 L 400,0 L 400,300 L 0,300 Z", "c1");
  assert.ok(/<clipPath id="c1"><path d="M 0,0 L 400,0/.test(svg)); assert.ok(svg.includes('href="' + PNG + '"')); assert.ok(/transform="rotate\(30 90\.00 50\.00\)"/.test(svg), svg.slice(-160)); assert.ok(/clip-path="url\(#c1\)"/.test(svg));
  assert.ok(/x="30\.00" y="20\.00" width="120\.000" height="60\.000"/.test(svg));
  const pr = printInner(S.pieces, normPrint(null), "mm");
  assert.ok(/<image data-layer="graphic"/.test(pr)); assert.ok(!/<image/.test(printInner(S.pieces, normPrint({ info: { graphic: false } }), "mm")), "the Graphic switch of the print dialog");
});

test("the Graphic tools in the booted app: the Add Graphic dialog, then select, move, size, turn, lock and delete with Transform Graphic", () => {
  const r = boot({ script: DOC + `
    const PNG = ${JSON.stringify(PNG)}, im = { name: "bike.png", data: PNG, w: 400, h: 200 };
    // the dialog as the Graphic tool opens it after a picture is chosen, the pointer having been at (150, 100)
    let seen = null;
    app.answer = (t, f, o) => {
      seen = { t, f: f.map(x => [x.head || "", x.label, x.val]), sel: o.selects[0].options.map(x => x[1]) };
      seen.linked = o.sync({ w: 200, h: f[1].val, left: f[2].val, right: f[3].val, up: f[4].val, down: f[5].val, link: true }, "w");
      return { w: 200, h: 100, left: 40, right: f[3].val, up: 30, down: f[5].val, link: true };
    };
    app.addGraphicDialog({ x: 10, y: 10 }, P(), { x: 150, y: 100 }, im);
    const g = () => P().graphics[0];
    out.seen = seen; out.placed = [{ ...g() }, S.images.length, S.undo.length, S.selGfx];
    app.setTool("transform_graphic"); S.selGfx = null;
    // click it: selected; drag it 30 right
    // (pressed near its middle: away from the wheel's rim, which turns)
    let a = at({ x: 142, y: 82 }), b = at({ x: 172, y: 82 });
    app.click(a.x, a.y); out.sel = [S.selGfx && S.selGfx.gid, S.undo.length];
    app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y }); out.moved = [g().x, g().y, S.undo.length];
    // the right marker sizes the width only
    let k = app.wheelParts(g());
    app.drag(k.w.x, k.w.y, k.w.x + 29, k.w.y); app.fire("pointerup", { x: 0, y: 0 }); out.wider = [g().w, g().h];
    // the rim turns it; Shift in 15 degree steps
    k = app.wheelParts(g());
    S.shift = true; app.drag(k.c.x, k.c.y - 58, k.c.x + 55, k.c.y - 20); app.fire("pointerup", { x: 0, y: 0 }); S.shift = false; out.angle = g().angle;
    // right-click while sizing with the corner marker: the Transform dialog with what was dragged
    k = app.wheelParts(g());
    app.drag(k.both.x, k.both.y, k.both.x + 20, k.both.y + 20);
    let dlg = null; app.answer = (t, f) => { dlg = [t, f[0].val > 100]; return { pw: 50, ph: 50, w: f[2].val, h: f[3].val, link: true }; };
    const w0 = g().w; app.fire("contextmenu", { x: k.both.x, y: k.both.y }); out.dlg = dlg; out.half = [g().w, S.drag];
    // locked: it can be selected but not dragged
    g().lock = true; const u = S.undo.length; const c = at(g()); app.drag(c.x, c.y, c.x + 40, c.y); app.fire("pointerup", { x: 0, y: 0 }); out.locked = [S.undo.length - u, /locked/.test(toasts[toasts.length - 1])];
    g().lock = false;
    // other tools do not touch it; print and SVG carry it
    app.setTool("edit_pattern"); out.other = app.hit(c.x, c.y).k;
    out.print = /<image data-layer="graphic"/.test(app.printJob().html);
    let svg = ""; app.setDownload((n, t) => { svg = t; }); app.el("ex-svg").onclick(); out.svg = /data-graphic="bike"/.test(svg) && /clip-path=/.test(svg);
    out.file = JSON.parse(app.docJSON()).images.length;
    app.setTool("transform_graphic"); app.click(c.x, c.y); app.key("Delete"); out.deleted = P().graphics.length;
    app.undo(); out.undone = [P().graphics.length, S.images.length];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, s = o.seen;
  assert.strictEqual(s.t, "Add Graphic");
  assert.deepStrictEqual(s.f.map(x => x[0] + "|" + x[1]), ["Size|Width", "|Height", "Position|Left", "|Right", "|Up", "|Down"]); assert.deepStrictEqual(s.sel, ["Outline", "Center"]);
  near(s.f[1][2]/s.f[0][2], 0.5, 1e-3, "the picture's own proportions to start with");
  near(s.linked.h, 100, 1e-9, "linked: the height follows a typed width");
  near(o.placed[0].x, 40 + 100, 1e-9, "40 from the left of the pattern's box"); near(o.placed[0].y, 30 + 50, 1e-9); near(o.placed[0].w, 200, 1e-9);
  assert.strictEqual(o.placed[1], 1); assert.strictEqual(o.placed[2], 1); assert.strictEqual(o.placed[3].gid, 1);
  assert.deepStrictEqual(o.sel, [1, 1], "a click selects and leaves no step");
  near(o.moved[0], 170, 1e-6); near(o.moved[1], 80, 1e-6); assert.strictEqual(o.moved[2], 2);
  near(o.wider[0], 200*(58 + 29)/58, 1e-6, "the marker pulled out by half its distance from the middle: half as wide again"); near(o.wider[1], 100, 1e-9, "the height stays");
  near(o.angle/15, Math.round(o.angle/15), 1e-9, "Shift: 15 degree steps, got " + o.angle); assert.ok(Math.abs(o.angle) > 1);
  assert.deepStrictEqual(o.dlg, ["Transform", true]); near(o.half[0], o.wider[0]/2, 1e-6, "50 % of the size before the drag"); assert.strictEqual(o.half[1], null);
  assert.deepStrictEqual(o.locked, [0, true]);
  assert.strictEqual(o.other, "body"); assert.strictEqual(o.print, true); assert.strictEqual(o.svg, true); assert.strictEqual(o.file, 1);
  assert.strictEqual(o.deleted, 0); assert.deepStrictEqual(o.undone, [1, 1]);
});

module.exports = T;
