// Roadmap 2, batch 4: Smooth Curve, the one Fullness tool, outlines that may not cross
// themselves, the crosshair of the internal tools, notches catching points, punch marks.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const S = { pieces: [], seams: [], guides: [], measures: [], sel: [], view: { s: 1, x: 0, y: 0 }, nextSegId: 1, nextShapeId: 1, nextId: 1, tool: "notch", grading: null, show: { annotations: true, name: true, grainline: true, baseline: true, reference: true }, notch: null, selPunch: null };
const G = load(["segCurve", "V", "cp", "dist", "sub", "add", "mul", "clone", "mkShape", "rectShape", "mkPiece", "setCurve", "insertCp", "addChild", "segPt", "segTan", "segLen", "nSeg", "isSpline", "flatten", "signedArea", "inside", "addPoint",
  "outlineProblem", "crossDist", "notchPlace", "punchLines", "punchPath", "PUNCH_D", "migrate", "mapPiece", "sync", "mkLinked", "unfold", "affOf", "reflector", "checkDoc", "slashSpread", "resolveRefs", "makeSeam", "seamInfo",
  "SMOOTH_K", "placePt", "placePath", "smoothCurve", "smoothLen", "smoothKAt", "smoothKForLen", "smoothApply", "fullnessTurn", "fullnessSide", "hit", "toS", "dxfExport", "defaultGrading"], { S });
const { V, dist, sub, add, clone, mkShape, rectShape, mkPiece, setCurve, insertCp, addChild, segPt, segTan, segLen, nSeg, isSpline, flatten, signedArea, addPoint, outlineProblem, crossDist, notchPlace, punchLines, punchPath, PUNCH_D,
  migrate, mapPiece, sync, mkLinked, unfold, affOf, reflector, checkDoc, slashSpread, makeSeam, seamInfo, SMOOTH_K, placePt, placePath, smoothCurve, smoothLen, smoothKAt, smoothKForLen, smoothApply, fullnessTurn, fullnessSide, hit, dxfExport, defaultGrading } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, tol, msg) => assert.ok(dist(p, q) <= tol, (msg || "") + " expected (" + q.x + ", " + q.y + "), got (" + p.x + ", " + p.y + ")");
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.sel = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.view = { s: 1, x: 0, y: 0 }; S.tool = "notch"; S.grading = defaultGrading(); S.notch = { type: "I", len: 6, color: "#00a37a", width: 2, dup: true }; }
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}], true));
  S.pieces.push(A); S.sel = [A.id]; app.commit(); S.undo.length = 0;
  const at = (q) => app.toS(q), out = {}, P = () => S.pieces[0], pts = () => P().pts.map(q => [+q.x.toFixed(4), +q.y.toFixed(4)]);
  const click = (q, e) => { const s = at(q); app.click(s.x, s.y, e); }, move = (q) => { const s = at(q); app.fire("pointermove", { x: s.x, y: s.y }); };
`;

/* ---------- outlines ---------- */
test("an outline that crosses itself, touches itself or encloses nothing is no pattern", () => {
  reset();
  const ok = (pts) => outlineProblem(mkShape(pts, true));
  assert.strictEqual(ok([V(0, 0), V(100, 0), V(100, 80), V(0, 80)]), "");
  assert.strictEqual(ok([V(0, 0), V(100, 0), V(100, 80), V(50, 30), V(0, 80)]), "", "a notch cut into it is fine");
  assert.strictEqual(ok([V(0, 0), V(100, 80), V(100, 0), V(0, 80)]), "it crosses itself", "a bow tie");
  assert.strictEqual(ok([V(0, 0), V(100, 0), V(100, 80), V(50, 0), V(0, 80)]), "it crosses itself", "a point pulled onto the opposite edge: two parts joined at a point");
  assert.ok(ok([V(0, 0), V(100, 0), V(200, 0)]).length > 0, "three points in a line");
  assert.ok(ok([V(0, 0), V(100, 0), V(100, 0.001)]).length > 0, "a sliver");
  assert.strictEqual(ok([V(0, 0), V(100, 0), V(100, 50), V(40, 50), V(40, 0.004)]).length > 0, true, "an edge resting on another");
  // a curve bulging through the opposite side
  const p = mkPiece("P", rectShape(0, 0, 200, 60));
  assert.strictEqual(outlineProblem(p), "");
  insertCp(p, 0, 0.5); p.segs[0].cps[0].y = 120;
  assert.strictEqual(outlineProblem(p), "it crosses itself", "the top edge curved down through the bottom edge");
  p.segs[0].cps[0].y = 40; assert.strictEqual(outlineProblem(p), "");
  assert.strictEqual(outlineProblem(mkShape([V(0, 0), V(10, 10), V(20, 0), V(10, -10), V(0, 0)], false)), "", "only closed outlines are judged");
});

test("the polygon tool refuses a crossing outline and keeps the drawing; a drag that makes one is taken back", () => {
  const r = boot({ script: DOC + `
    app.setTool("polygon");
    for (const q of [{ x: 600, y: 0 }, { x: 800, y: 200 }, { x: 800, y: 0 }, { x: 600, y: 200 }]) click(q);
    const n = S.pieces.length; click({ x: 600, y: 0 });
    out.refused = [S.pieces.length - n, !!S.draft, toasts[toasts.length - 1], S.undo.length];
    app.key("Backspace"); app.key("Backspace"); app.key("Backspace"); click({ x: 800, y: 0 }); click({ x: 800, y: 200 }); click({ x: 600, y: 200 }); click({ x: 600, y: 0 });
    out.made = [S.pieces.length - n, S.pieces[S.pieces.length - 1].pts.length, S.tool];
    // drag the first pattern's top right corner through its left edge
    S.sel = [P().id]; app.setTool("edit_pattern");
    const a = at({ x: 400, y: 0 }), b = at({ x: -150, y: 150 });
    app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y });
    out.drag = [pts()[1], toasts[toasts.length - 1]];
    // a fair drag is kept
    const c = at({ x: 450, y: -30 }); app.drag(a.x, a.y, c.x, c.y); app.fire("pointerup", { x: c.x, y: c.y });
    out.kept = pts()[1];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.refused[0], 0, "no pattern was made"); assert.strictEqual(o.refused[1], true, "the drawing is still there"); assert.ok(/crosses itself/.test(o.refused[2]), o.refused[2]); assert.strictEqual(o.refused[3], 0);
  assert.deepStrictEqual(o.made, [1, 4, "edit_pattern"], "with the points taken back and put the right way round it closes");
  assert.deepStrictEqual(o.drag[0], [400, 0], "the corner is back where it was"); assert.ok(/Taken back/.test(o.drag[1]), o.drag[1]);
  assert.deepStrictEqual(o.kept, [450, -30]);
});

/* ---------- the crosshair ---------- */
test("the crosshair's four distances: level and upright from the pointer to the outline", () => {
  const sq = [V(0, 0), V(400, 0), V(400, 300), V(0, 300)];
  assert.deepStrictEqual(crossDist(sq, V(100, 50)), { l: 100, r: 300, u: 50, d: 250 });
  // an L shape: the nearest edge each way, not the far one
  const L = [V(0, 0), V(200, 0), V(200, 100), V(100, 100), V(100, 300), V(0, 300)];
  assert.deepStrictEqual(crossDist(L, V(50, 200)), { l: 50, r: 50, u: 200, d: 100 });
  const out = crossDist(sq, V(500, 500));
  assert.strictEqual(out.r, Infinity, "outside, with no outline to the right"); assert.strictEqual(out.d, Infinity);
  // a slanted edge: the exact crossing
  const tri = [V(0, 0), V(300, 0), V(0, 300)];
  near(crossDist(tri, V(50, 100)).r, 150, 1e-9); near(crossDist(tri, V(50, 100)).d, 150, 1e-9);
});

/* ---------- notches ---------- */
test("the Notch tool: on a segment where it is clicked; exactly on a segment point or a curve point when the pointer is near one", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 400, 300)); S.pieces.push(p);
  insertCp(p, 1, 0.37); p.segs[1].cps[0].x = 430;
  let h = hit(200, 2);
  // (Round build-1: the pointer is at the line's middle, so the notch is caught there and says so)
  assert.deepStrictEqual(notchPlace(h, 200, 2), { i: 0, t: 0.5, mid: true });
  h = hit(398, 1); assert.strictEqual(h.k, "pt");
  assert.deepStrictEqual(notchPlace(h, 398, 1), { i: 1, t: 0 }, "on the segment point: at the start of the segment that begins there");
  const c = p.segs[1].cps[0], q = segPt(p, 1, 0.39);
  h = hit(q.x, q.y); assert.strictEqual(h.k, "seg");
  assert.strictEqual(notchPlace(h, q.x, q.y).t, G.segCurve(p, 1).U[1], "near a curve point: exactly on it");
  const far = segPt(p, 1, 0.7); h = hit(far.x, far.y);
  near(notchPlace(h, far.x, far.y).t, 0.7, 1e-3, "away from it: where the pointer is");
  assert.strictEqual(notchPlace(hit(200, 150), 200, 150), null, "not on the pattern's body");
  const r = boot({ script: DOC + `
    app.setTool("notch");
    click({ x: 400, y: 0 }); out.onPoint = [P().segs[1].notches.slice(), P().segs[0].notches.length];
    click({ x: 400, y: 0 }); out.off = [P().segs[1].notches.length, !!S.selNotch];
    app.key("Delete"); out.deleted = P().segs[1].notches.length;
    click({ x: 120, y: 0 }); out.onSeg = P().segs[0].notches.map(t => +t.toFixed(4));
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result.onPoint, [[0], 0]); assert.deepStrictEqual(r.result.off, [1, true], "a second click selects it (Round r12 / 2)"); assert.strictEqual(r.result.deleted, 0, "Delete takes it off"); assert.deepStrictEqual(r.result.onSeg, [0.3]);
});

/* ---------- punch marks ---------- */
test("punch marks: a circle with an eight-spoke star; they load safely and go wherever the pattern goes", () => {
  reset();
  const pm = { x: 50, y: 40, d: 10, name: "pocket" }, lines = punchLines(pm);
  assert.strictEqual(lines.length, 4, "four lines through the middle: eight spokes");
  for (const [a, b] of lines) { samePt(V((a.x + b.x)/2, (a.y + b.y)/2), V(50, 40), 1e-9); assert.ok(dist(a, b) < 10, "inside the circle"); }
  const d = punchPath(pm, (q) => q.x.toFixed(2) + "," + q.y.toFixed(2));
  assert.ok(d.startsWith("M 55.00,40.00"), "the circle starts 5 from the middle"); assert.strictEqual((d.match(/ M /g) || []).length, 4);
  // loading
  const q = migrate({ id: 1, name: "P", on: true, pts: [V(0, 0), V(9, 0), V(9, 9)], segs: [{ notches: [] }, { notches: [] }, { notches: [] }], darts: [],
    punches: [{ x: 1, y: 2 }, { x: 3, y: 4, d: 6, name: "a" }, { x: "x", y: 1 }, null, { x: 5, y: 6, d: -1, name: 7 }] });
  assert.deepStrictEqual(q.punches, [{ x: 1, y: 2, d: PUNCH_D, name: "" }, { x: 3, y: 4, d: 6, name: "a" }, { x: 5, y: 6, d: PUNCH_D, name: "" }]);
  assert.deepStrictEqual(migrate({ id: 2, name: "Old", on: true, pts: [V(0, 0), V(9, 0), V(9, 9)], segs: [{ notches: [] }, { notches: [] }, { notches: [] }], darts: [] }).punches, [], "a file from before punch marks");
  // moving, linked copies, unfolding, slashing
  const p = mkPiece("P", rectShape(0, 0, 400, 300)); S.pieces.push(p);
  p.punches.push({ x: 100, y: 50, d: 10, name: "top" }, { x: 100, y: 250, d: 8, name: "bottom" });
  mapPiece(p, (v) => V(v.x + 10, v.y)); samePt(p.punches[0], V(110, 50), 1e-12); mapPiece(p, (v) => V(v.x - 10, v.y));
  const M = reflector(V(500, 0), V(500, 300)), c = mkLinked(p, "symmetric", affOf(M)); S.pieces.push(c); sync();
  samePt(c.punches[0], V(900, 50), 1e-9, "a linked copy has them, mirrored"); assert.strictEqual(c.punches[1].d, 8);
  const u = unfold(p, 3); assert.strictEqual(u.punches.length, 2, "an unfolded pattern keeps them");
  addPoint(p, 1, 0.5); addPoint(p, 4, 0.5);
  assert.ok(slashSpread(p, 2, 5, 40, 40));
  near(Math.abs(p.punches[1].y - p.punches[0].y), 240, 1e-6, "the one on the moving side went with it: 40 further apart");
  checkDoc(S.pieces, S.seams);
  p.punches[0].d = 0; assert.throws(() => checkDoc(S.pieces, S.seams), /punch mark/);
  p.punches[0].d = 10;
  assert.ok(/\n13\n/.test(dxfExport([p], { format: "aama", optimise: true }, S.grading).replace(/\r/g, "")), "DXF: a drill hole on layer 13");
});

test("the Punch Mark tool in the booted app: place, select, move, name and size, delete; only this tool picks them; SVG and print show them", () => {
  const r = boot({ script: DOC + `
    app.setTool("punch_mark");
    click({ x: 100, y: 80 }); click({ x: 300, y: 200 });
    out.added = [JSON.parse(JSON.stringify(P().punches)), S.undo.length, S.selPunch];
    // press the first one and drag it
    const a = at({ x: 100, y: 80 }), b = at({ x: 140, y: 110 });
    app.fire("pointermove", { x: a.x, y: a.y }); out.hover = [S.hover && S.hover.k, app.cv.style.cursor];
    app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y });
    out.moved = [P().punches[0].x, P().punches[0].y, S.selPunch.ni, S.undo.length];
    // double-click: name and diameter
    app.promptAnswer = "pocket corner"; app.promptNums = { d: 6 };
    app.fire("pointermove", { x: b.x, y: b.y }); app.fire("dblclick", { x: b.x, y: b.y });
    out.edited = { ...P().punches[0] };
    // a click on one selects it without a step; Delete removes it
    const u = S.undo.length; app.click(b.x, b.y); out.click = S.undo.length - u;
    app.key("Delete"); out.deleted = P().punches.length;
    // other tools see through a punch mark
    app.setTool("edit_pattern"); const c = at({ x: 300, y: 200 }); out.other = app.hit(c.x, c.y).k; out.menu = app.hit(c.x, c.y, { menu: true }).k;
    app.menuClick(c.x, c.y, "Delete"); out.menuDel = P().punches.length;      // (Round r15 / 10: the reference's row, "Delete"; it was "Delete Punch Mark")
    app.undo();
    let svg = ""; app.setDownload((n, t) => { svg = t; }); app.el("ex-svg").onclick();
    out.svg = [/data-punch="Punch Mark 2"/.test(svg), /data-diameter="10"/.test(svg)];
    out.print = /data-layer="notch"/.test(app.printJob().html);
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.added[0].length, 2); near(o.added[0][0].x, 100, 1e-6); near(o.added[0][0].y, 80, 1e-6); assert.strictEqual(o.added[0][0].d, 10, "10 mm across by default");
  assert.strictEqual(o.added[0][1].name, "Punch Mark 2"); assert.strictEqual(o.added[1], 2); assert.strictEqual(o.added[2].ni, 1, "the new one is selected");
  // (Round r19 / H03: over and while dragging a point, line or mark the pointer is the arrow with a four-way badge, an image with "move" as its fallback; it was the system's "move")
  assert.strictEqual(o.hover[0], "punch"); assert.match(o.hover[1], /^url[(].*, move$/);
  near(o.moved[0], 140, 1e-6); near(o.moved[1], 110, 1e-6); assert.strictEqual(o.moved[2], 0); assert.strictEqual(o.moved[3], 3);
  assert.strictEqual(o.edited.name, "pocket corner"); assert.strictEqual(o.edited.d, 6);
  assert.strictEqual(o.click, 0); assert.strictEqual(o.deleted, 1);
  assert.strictEqual(o.other, "body"); assert.strictEqual(o.menu, "punch"); assert.strictEqual(o.menuDel, 0);
  assert.deepStrictEqual(o.svg, [true, true]); assert.strictEqual(o.print, true);
});

/* ---------- Smooth Curve ---------- */
test("Smooth Curve: the new curve leaves and arrives along the outline, and its reach is one number", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 400, 300)); S.pieces.push(p);
  // from 100 along the top edge back round the corner (0, 0) to 80 down the left edge: the short way is "ba"
  const a = { i: 0, t: 0.25 }, b = { i: 3, t: 1 - 80/300 };
  const c = smoothCurve(p, a, b, "ba", SMOOTH_K);
  samePt(c.S, V(0, 80), 1e-9, "it starts at the second place (the outline runs up the left edge)"); samePt(c.E, V(100, 0), 1e-9);
  samePt(c.X, V(0, 0), 1e-9, "the two edges meet in the corner");
  near(c.c1.x, 0, 1e-9, "it leaves along the left edge"); near(c.c1.y, 80*(1 - SMOOTH_K), 1e-9); near(c.c2.y, 0, 1e-9, "and arrives along the top edge");
  near(smoothLen(smoothCurve(p, a, b, "ba", 0)), Math.hypot(100, 80), 1e-6, "0: the straight line between the two places");
  samePt(smoothCurve(p, a, b, "ba", 1).c1, V(0, 0), 1e-9, "1: both handles in the corner");
  for (const len of [130, 140, 150]) near(smoothLen(smoothCurve(p, a, b, "ba", smoothKForLen(p, a, b, "ba", len))), len, 1e-6, "a typed length is reached");
  assert.strictEqual(smoothKForLen(p, a, b, "ba", 100), null, "shorter than the straight line: can't be done");
  near(smoothKAt(p, a, b, "ba", V(0, 0)), 1.3, 0.35, "dragged towards the corner: a tight curve");
  assert.ok(smoothKAt(p, a, b, "ba", V(60, 50)) < 0.2, "dragged towards the straight line: nearly straight");
  // the two ways round
  assert.strictEqual(placePath(p, b, a).length, 3, "the short way: the place, the corner, the place");
  assert.ok(placePath(p, a, b).length >= 5, "the long way: round the other three corners");
});

test("Smooth Curve carried out: the corner goes, one curved segment takes its place, and a seam on the edge follows", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 400, 300)), q = mkPiece("Q", rectShape(600, 0, 100, 400)); S.pieces.push(p, q);
  S.seams.push(makeSeam(S.seams, [{ piece: p.id, shape: 0, sids: [p.segs[0].id], t0: 0, t1: 1, rev: false }], [{ piece: q.id, shape: 0, sids: [q.segs[3].id], t0: 0, t1: 1, rev: false }]));
  const a = { i: 0, t: 0.25 }, b = { i: 3, t: 1 - 80/300 }, area = Math.abs(signedArea(flatten(p, 40)));
  assert.strictEqual(smoothApply(p, a, b, "ba", SMOOTH_K), true);
  assert.strictEqual(p.pts.length, 5, "two new points, the corner gone");
  assert.ok(!p.pts.some(v => dist(v, V(0, 0)) < 1e-6), "the corner point is gone");
  const i = p.segs.findIndex(s => s.curved), s = p.segs[i];
  assert.ok(s.c1 && s.c2 && !isSpline(s), "one handle curve");
  samePt(segPt(p, i, 0), V(0, 80), 1e-9); samePt(segPt(p, i, 1), V(100, 0), 1e-9);
  samePt(segTan(p, i, 0), V(0, -1), 1e-9, "tangent to the left edge"); samePt(segTan(p, i, 1), V(1, 0), 1e-9, "and to the top edge");
  const cut = area - Math.abs(signedArea(flatten(p, 40)));
  assert.ok(cut > 0 && cut < 100*80/2, "the corner was rounded off: a little less cloth (" + cut.toFixed(1) + ")");
  S.seams = G.resolveRefs(S.pieces, S.seams);
  assert.strictEqual(S.seams.length, 1, "the seam is still there"); assert.strictEqual(outlineProblem(p), "");
  checkDoc(S.pieces, S.seams);
  // from point to point, the long way refused when it would leave fewer than three points
  reset();
  const t = mkPiece("T", mkShape([V(0, 0), V(100, 0), V(50, 80)], true)); S.pieces.push(t);
  assert.strictEqual(smoothApply(t, { i: 0, t: 0 }, { i: 1, t: 0 }, "ba", 0.5), false, "that would leave two points");
  assert.strictEqual(smoothApply(clone(t), { i: 0, t: 0 }, { i: 1, t: 0 }, "ab", 0.5), true, "the edge itself can be made a curve");
});

test("Smooth Curve in the booted app: two places, the side, a drag or typed curvature, Enter; Esc gives up", () => {
  const r = boot({ script: DOC + `
    app.setTool("smooth_curve");
    click({ x: 100, y: 0 }); out.one = [S.draft.smooth.step, S.undo.length];
    click({ x: 0, y: 80 }); out.two = S.draft.smooth.step;
    move({ x: 4, y: 20 }); click({ x: 4, y: 20 }); out.side = [S.draft.smooth.step, S.draft.smooth.side];
    // drag the curve towards the corner, then type 40 % instead
    const a = at({ x: 40, y: 30 }), b = at({ x: 10, y: 8 });
    app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y });
    out.dragged = S.draft.smooth.k;
    let dlg = null; app.answer = (t, f) => { dlg = [t, f.map(x => x.label)]; return { k: 40, len: f[1].val }; };
    app.fire("contextmenu", { x: b.x, y: b.y });
    out.dlg = dlg; out.k = S.draft.smooth.k; out.before = [pts().length, S.undo.length];
    app.key("Enter");
    out.done = [pts(), S.draft, S.undo.length, P().segs.filter(s => s.curved).length];
    app.undo(); out.undone = pts().length;
    click({ x: 100, y: 0 }); click({ x: 0, y: 80 }); app.key("Escape"); out.esc = [S.draft, pts().length];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.one, ["to", 0]); assert.strictEqual(o.two, "side"); assert.deepStrictEqual(o.side, ["shape", "ba"], "the side by the corner was under the pointer");
  assert.ok(o.dragged > 0.7, "dragged towards the corner: " + o.dragged);
  assert.deepStrictEqual(o.dlg, ["Smooth Curve", ["Curvature", "Curve length"]]); near(o.k, 0.4, 1e-9);
  assert.deepStrictEqual(o.before, [4, 0], "nothing is changed until Enter");
  assert.strictEqual(o.done[0].length, 5); assert.strictEqual(o.done[1], null); assert.strictEqual(o.done[2], 1, "one undo step"); assert.strictEqual(o.done[3], 1);
  assert.ok(!o.done[0].some(q => q[0] === 0 && q[1] === 0), "the corner is gone");
  assert.strictEqual(o.undone, 4); assert.deepStrictEqual(o.esc, [null, 4]);
});

/* ---------- Fullness ---------- */
test("Fullness: one side turns about the hinge; the far end opens by the chord; the opening is an arc; the slash stays as two lines", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 400, 300)); S.pieces.push(p);
  const a = { i: 3, t: 0.5 }, b = { i: 1, t: 0.5 }, ang = 12*Math.PI/180;     // hinge on the left edge at (0,150), slash to (400,150)
  assert.strictEqual(fullnessSide(p, a, b, V(200, 50)), "ab", "above the slash: the side whose outline runs from the hinge round by the top");
  assert.strictEqual(fullnessSide(p, a, b, V(200, 250)), "ba");
  const area = Math.abs(signedArea(flatten(p, 40))), r = fullnessTurn(p, a, b, "ba", ang, false);
  assert.ok(r); samePt(r.H, V(0, 150), 1e-9); samePt(r.far, V(400, 150), 1e-9);
  near(dist(r.far, r.moved), 2*400*Math.sin(ang/2), 1e-6, "the far end opened by the chord of the angle");
  near(dist(r.moved, r.H), 400, 1e-6, "turned about the hinge");
  assert.ok(r.moved.y > 150, "the lower side turned downward, away from the upper one");
  // the upper side did not move
  for (const q of [V(0, 0), V(400, 0), V(400, 150), V(0, 150)]) assert.ok(p.pts.some(v => dist(v, q) < 1e-9), "the fixed side's point (" + q.x + ", " + q.y + ") is where it was");
  // the lower side kept its lengths
  const lens = p.segs.map((s, i) => segLen(p, i)).sort((x, y) => x - y);
  for (const want of [150, 150, 150, 150, 400, 400]) assert.ok(lens.some(l => Math.abs(l - want) < 1e-6), "an edge of " + want);
  // the opening: an arc about the hinge
  const gi = p.segs.findIndex(s => s.curved); assert.ok(gi >= 0, "the opening is a curve");
  for (let k = 0; k <= 10; k++) near(dist(segPt(p, gi, k/10), V(0, 150)), 400, 0.01, "on the circle about the hinge");
  near(segLen(p, gi), 400*ang, 0.01, "as long as the arc");
  near(Math.abs(signedArea(flatten(p, 60))) - area, 400*400*ang/2, 2, "the added cloth is the wedge");
  // the slash stays as two internal lines from the hinge
  assert.strictEqual(p.internals.length, 2);
  samePt(p.internals[0].pts[0], V(0, 150), 1e-9); samePt(p.internals[0].pts[1], V(400, 150), 1e-9); samePt(p.internals[1].pts[1], r.moved, 1e-9);
  assert.strictEqual(outlineProblem(p), ""); checkDoc(S.pieces, S.seams);
});

test("Fullness: the other side, both sides at once, and what can't be done", () => {
  reset();
  const mk = () => { S.pieces = []; const p = mkPiece("P", rectShape(0, 0, 400, 300)); S.pieces.push(p); return p; };
  const a = { i: 3, t: 0.5 }, b = { i: 1, t: 0.5 }, ang = 10*Math.PI/180;
  let p = mk(), r = fullnessTurn(p, a, b, "ab", ang, false);
  assert.ok(r.moved.y < 150, "the upper side turned upward"); assert.ok(p.pts.some(v => dist(v, V(400, 300)) < 1e-9), "the lower side stayed");
  p = mk(); r = fullnessTurn(p, a, b, "ab", ang, true);
  const ends = p.internals.map(it => it.pts[1]), angs = ends.map(q => Math.atan2(q.y - 150, q.x)*180/Math.PI).sort((x, y) => x - y);
  near(angs[0], -5, 1e-6, "one side turned 5 degrees up"); near(angs[1], 5, 1e-6, "the other 5 degrees down");
  samePt(p.internals[0].pts[0], V(0, 150), 1e-9, "the hinge stayed");
  p = mk(); assert.strictEqual(fullnessTurn(p, a, b, "ab", 0, false), false, "no angle");
  p = mk(); assert.strictEqual(fullnessTurn(p, a, a, "ab", ang, false), false, "the two places are one");
  p = mk(); assert.strictEqual(fullnessTurn(p, a, b, "ab", 2, false), false, "more than a quarter turn");
  // from a point to a point, and on a pattern with a curve on the moving side
  p = mk(); insertCp(p, 2, 0.5); p.segs[2].cps[0].y = 340;
  const L = segLen(p, 2);
  r = fullnessTurn(p, { i: 0, t: 0 }, { i: 2, t: 0 }, "ab", ang, false);
  assert.ok(r, "corner to corner"); assert.ok(p.segs.some((s, i) => isSpline(s) && Math.abs(segLen(p, i) - L) < 1e-6), "the curve kept its length whichever side it is on");
  checkDoc(S.pieces, S.seams);
});

test("the Fullness tool in the booted app (Round CF / C4, the maintainer's sequence): the hinge, then the end of the slash; a click chooses the side that turns, the pointer turns it, a click makes it; typed angle; a double-click does nothing more", () => {
  const r = boot({ script: DOC + `
    app.setTool("fullness");
    click({ x: 0, y: 150 }); out.one = S.draft.full.step;
    click({ x: 0, y: 250 }); out.sameSeg = [S.draft.full.step, toasts[toasts.length - 1]];
    click({ x: 400, y: 150 }); out.two = [S.draft.full.step, S.draft.full.side, S.draft.full.a.i, S.draft.full.b.i];
    // the side: a click below the slash, the lower side
    move({ x: 200, y: 190 }); click({ x: 200, y: 190 }); out.side = [S.draft.full.step, !!S.draft.full.side];
    // the pointer 40 below the far end: about atan(40/400) = 5.7 degrees
    move({ x: 400, y: 190 }); out.before = [pts().length, S.undo.length];
    click({ x: 400, y: 190 });
    out.done = [pts().length, P().internals.length, S.draft, S.undo.length, P().segs.filter(s => s.curved).length];
    const far = P().internals[1].pts[1]; out.angle = Math.atan2(far.y - 150, far.x)*180/Math.PI;
    app.undo(); out.undone = [pts().length, P().internals.length];
    // typed: 15 degrees
    click({ x: 0, y: 150 }); click({ x: 400, y: 150 }); click({ x: 200, y: 190 }); move({ x: 400, y: 170 });
    let dlg = null; app.answer = (t, f) => { dlg = [t, f.map(x => x.label)]; return { a: 15, d: f[1].val }; };
    const s = at({ x: 400, y: 170 }); app.fire("contextmenu", { x: s.x, y: s.y });
    const f2 = P().internals[1].pts[1]; out.typed = [dlg, Math.atan2(f2.y - 150, f2.x)*180/Math.PI, S.undo.length];
    app.undo();
    // a double-click on the second place no longer turns both sides
    click({ x: 0, y: 150 }); click({ x: 400, y: 150 }); app.fire("dblclick", at({ x: 400, y: 150 }));
    out.both = [S.draft.full.both, S.draft.full.step];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.one, "to"); assert.strictEqual(o.sameSeg[0], "to", "a place on the same segment is refused"); assert.ok(/another segment/.test(o.sameSeg[1]));
  assert.deepStrictEqual(o.two, ["side", null, 3, 1], "the hinge is on the left edge (3), the end on the right (1); then the side is chosen");
  assert.deepStrictEqual(o.side, ["turn", true]);
  assert.deepStrictEqual(o.before, [4, 0], "the preview changes nothing");
  assert.strictEqual(o.done[0], 7, "the hinge is one new point, the far end two"); assert.strictEqual(o.done[1], 2); assert.strictEqual(o.done[2], null); assert.strictEqual(o.done[3], 1); assert.strictEqual(o.done[4], 1);
  near(o.angle, Math.atan2(40, 400)*180/Math.PI, 0.01, "opened to where the pointer was");
  assert.deepStrictEqual(o.undone, [4, 0]);
  assert.deepStrictEqual(o.typed[0], ["Fullness", ["Angle", "Distance"]]); near(o.typed[1], 15, 1e-6); assert.strictEqual(o.typed[2], 1);
  assert.deepStrictEqual(o.both, [false, "side"]);
});

module.exports = T;
