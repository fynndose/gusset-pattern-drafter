// Roadmap 3D, batch 0: several seams on one stretch of edge (layers, file version 11)
// and the ghost shown while one point is dragged. Covers a collar sewn to body and
// facing, a zipper inside a seam, lanes, edits under layered seams, old files, and the
// tools in the booted app.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const S = { pieces: [], seams: [], stitches: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, unit: "mm", saValue: 10 };
const G = load(["V", "mkShape", "mkPiece", "addPoint", "deletePoint", "segLen", "sync", "clone", "seamInfo", "seamEnds", "seamOn", "seamsOn", "partsOn", "seamLanes", "makeSeam",
  "loadSeams", "validSeams", "resolveRefs", "segIx", "partsOverlap", "normZip", "unlinkSeam", "seamParts"], { S, stitchSidesOn: () => [], libOf: () => ({ zipper: [] }) });
const { V, mkShape, mkPiece, addPoint, deletePoint, segLen, sync, clone, seamInfo, seamOn, seamsOn, partsOn, seamLanes, makeSeam, loadSeams, validSeams, resolveRefs, seamParts } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; }
const strip = (name, x, y, w, h = 80) => { const p = mkPiece(name, mkShape([V(x, y), V(x + w, y), V(x + w, y + h), V(x, y + h)], true)); S.pieces.push(p); return p; };
const top = (p, more) => ({ piece: p.id, sid: p.segs[0].id, ...more });
const settle = () => { sync(); S.seams = resolveRefs(S.pieces, S.seams); };
const next = (sm) => { sm.id = S.seams.reduce((m, x) => Math.max(m, x.id), 0) + 1; S.seams.push(sm); return sm; };
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}

test("a collar edge sewn to the body and to the facing: two seams on one edge, each with its own lengths", () => {
  reset();
  const collar = strip("Collar", 0, 0, 300), body = strip("Body", 0, 200, 300), facing = strip("Facing", 0, 400, 290);
  next(makeSeam(S.seams, top(collar), top(body)));
  next(makeSeam(S.seams, top(collar), top(facing)));
  settle();
  assert.deepStrictEqual(S.seams.map(s => s.id), [1, 2], "both stay");
  near(seamInfo(S.seams[0], S.pieces).diff, 0, 1e-9); near(seamInfo(S.seams[1], S.pieces).diff, 10, 1e-9);
  assert.deepStrictEqual(seamsOn(S.seams, collar.id, collar.segs[0].id).map(s => s.id), [1, 2]);
  assert.strictEqual(seamOn(S.seams, collar.id, collar.segs[0].id).id, 1, "the seam made first is the first");
  assert.strictEqual(partsOn(S.seams, body.id, body.segs[0].id).length, 1);
  // one seam still may not use a stretch twice
  assert.strictEqual(makeSeam(S.seams, top(collar), top(collar)), null);
  assert.strictEqual(makeSeam(S.seams, [top(collar, { t0: 0, t1: 0.6 }), top(collar, { t0: 0.5, t1: 1 })], top(body)), null);
});

test("lanes: layered parts get different lanes, parts that share no edge the same one, and a freed lane is used again", () => {
  reset();
  const A = strip("A", 0, 0, 300), B = strip("B", 0, 200, 300), C = strip("C", 0, 400, 300), D = strip("D", 0, 600, 300);
  next(makeSeam(S.seams, top(A), top(B)));
  next(makeSeam(S.seams, top(A, { t0: 0, t1: 0.5 }), top(C)));
  next(makeSeam(S.seams, top(A, { t0: 0.5, t1: 1 }), top(D)));
  let L = seamLanes(S.seams);
  assert.deepStrictEqual(S.seams.map(s => [L.get(s.a[0]), L.get(s.b[0])]), [[0, 0], [1, 0], [1, 0]], "the two half-length seams don't touch each other");
  next(makeSeam(S.seams, top(A, { t0: 0.4, t1: 0.6 }), { piece: D.id, sid: D.segs[2].id }));
  L = seamLanes(S.seams);
  assert.strictEqual(L.get(S.seams[3].a[0]), 2, "over both halves and the whole: the third lane");
  S.seams.splice(1, 2);
  assert.strictEqual(seamLanes(S.seams).get(S.seams[1].a[0]), 1);
});

test("Add Point and Delete Point under layered seams: every layer keeps its edge and its length", () => {
  reset();
  const A = strip("A", 0, 0, 300), B = strip("B", 0, 200, 300), C = strip("C", 0, 400, 150);
  next(makeSeam(S.seams, top(A), top(B)));
  next(makeSeam(S.seams, top(A, { t0: 0.25, t1: 0.75 }), top(C)));
  const zip = next(makeSeam(S.seams, top(A, { t0: 0.1, t1: 0.3 }), top(B, { t0: 0.1, t1: 0.3 }))); zip.zip = { name: "Zipper 1", type: null };
  const lens = () => S.seams.map(sm => { const i = seamInfo(sm, S.pieces); return [+i.la.toFixed(6), +i.lb.toFixed(6)]; });
  const before = lens();
  addPoint(A, 0, 0.5); settle();
  assert.deepStrictEqual(lens(), before, "a point in the middle of all three");
  assert.deepStrictEqual(S.seams.map(s => s.a[0].sids.length), [2, 2, 1]);
  addPoint(A, 0, 0.4); settle();                              // at 0.2 of the old edge: inside the zipper
  assert.deepStrictEqual(lens(), before);
  deletePoint(A, 1); settle(); deletePoint(A, 1); settle();
  assert.deepStrictEqual(lens(), before, "and both points deleted again");
  assert.deepStrictEqual(S.seams.map(s => s.id), [1, 2, 3]);
  assert.ok(S.seams[2].zip, "the zipper is still a zipper, inside the seam");
});

test("two parts meeting at a deleted point keep their own stretches, also when a third seam lies over both", () => {
  reset();
  const A = mkPiece("A", mkShape([V(0, 0), V(100, 0), V(300, 0), V(300, 80), V(0, 80)], true)); S.pieces.push(A);
  const B = strip("B", 0, 200, 100), C = strip("C", 150, 200, 200), D = strip("D", 0, 400, 300);
  next(makeSeam(S.seams, { piece: A.id, sid: A.segs[0].id }, top(B)));
  next(makeSeam(S.seams, { piece: A.id, sid: A.segs[1].id }, top(C)));
  next(makeSeam(S.seams, { piece: A.id, sids: [A.segs[0].id, A.segs[1].id] }, top(D)));
  deletePoint(A, 1); settle();
  const i = S.seams.map(sm => seamInfo(sm, S.pieces));
  near(i[0].la, 100, 1e-9); near(i[1].la, 200, 1e-9); near(i[2].la, 300, 1e-9);
  assert.deepStrictEqual(S.seams.map(s => [s.a[0].sids.length, +s.a[0].t0.toFixed(6), +s.a[0].t1.toFixed(6)]), [[1, 0, 0.333333], [1, 0.333333, 1], [1, 0, 1]]);
  assert.deepStrictEqual(seamsOn(S.seams, A.id, A.segs[0].id, 0, 0.2).map(s => s.id), [1, 3]);
  assert.deepStrictEqual(seamsOn(S.seams, A.id, A.segs[0].id, 0, 0.8).map(s => s.id), [2, 3]);
});

test("files: a v10 document opens with the same seams; a layered v11 document round-trips; undo snapshots keep layers", () => {
  reset();
  const A = strip("A", 0, 0, 300), B = strip("B", 0, 200, 300), C = strip("C", 0, 400, 300);
  next(makeSeam(S.seams, top(A), top(B)));
  const v10 = JSON.parse(JSON.stringify({ v: 10, pieces: S.pieces, seams: S.seams }));
  assert.deepStrictEqual(loadSeams(v10.seams, S.pieces), S.seams, "an old file's seams are untouched");
  next(makeSeam(S.seams, top(A), top(C))); S.seams[1].zip = { name: "Zipper 1", type: 3 };
  const text = JSON.stringify(S.seams), back = loadSeams(JSON.parse(text), S.pieces);
  assert.deepStrictEqual(back, JSON.parse(text));
  assert.deepStrictEqual(validSeams(clone(S.seams), S.pieces).length, 2);
  // a seam whose own two sides claim the same edge is still cleaned on load
  const bad = loadSeams([{ id: 9, a: [{ piece: A.id, shape: 0, sids: [A.segs[0].id], t0: 0, t1: 1 }], b: [{ piece: A.id, shape: 0, sids: [A.segs[0].id], t0: 0, t1: 1 }] }], S.pieces);
  assert.strictEqual(bad.length, 0);
});

test("layers in the booted app: sewing a sewn edge again, the readout, picking a layer by its lane, the segment menu, a zipper in a seam", () => {
  const r = boot({ script: `
    const out = {};
    S.pieces.length = 0; S.seams.length = 0;
    const mk = (n, x, y, w) => { const p = app.mkPiece(n, app.mkShape([{ x, y }, { x: x + w, y }, { x: x + w, y: y + 80 }, { x, y: y + 80 }], true)); S.pieces.push(p); return p; };
    const A = mk("Collar", 0, 0, 300), B = mk("Body", 0, 200, 300), C = mk("Facing", 0, 400, 300);
    app.commit();
    const at = (x, y) => { const s = app.toS({ x, y }); S.mouse = { x, y, sx: s.x, sy: s.y }; return s; };
    const click = (x, y) => { const s = at(x, y); app.sewClick(s.x, s.y, {}); };
    app.setTool("segment_sewing");
    click(30, 0); click(30, 200);
    at(30, 0); out.layerSeen = app.sewLayers({ piece: A.id, shape: 0, sids: [A.segs[0].id], t0: 0, t1: 1 });
    click(30, 0); click(30, 400);
    out.seams = S.seams.map(sm => [sm.id, sm.a[0].piece, sm.b[0].piece]);
    out.toast = toasts[toasts.length-1];
    out.on = app.seamsOn(S.seams, A.id, A.segs[0].id).map(s => s.id);
    const L = app.seamLanes(S.seams); out.lanes = S.seams.map(sm => L.get(sm.a[0]));
    // Edit Sewing: on the edge itself the first seam, one lane beside it the second
    app.setTool("edit_sewing");
    let s = at(150, 0); out.hit0 = app.seamHit(s.x, s.y).sm.id;
    const far = [app.seamHit(s.x, s.y + 5), app.seamHit(s.x, s.y - 5)].filter(Boolean).map(h => h.sm.id);
    out.hitLane = far.includes(2);
    // the segment menu is the line's (W56, Round G1): the seams are Edit Sewing's, each by its lane, with its own menu
    s = at(150, 0); app.showMenu({ clientX: s.x, clientY: s.y, preventDefault() {} });
    out.menu = [...app.menu.children].map(c => c.textContent || c.innerHTML).filter(t => /Seam S|Delete Seam/.test(t)).length;
    const lane2 = [s.y + 5, s.y - 5].find(y => { const h = app.seamHit(s.x, y); return h && h.sm.id === 2; });
    app.editSewMenu(s.x, lane2, s.x, lane2); out.sewMenu = [S.selSeam, app.menu.children.some(c => /Delete Sewing/.test(c.innerHTML))];
    app.editSewMenu(s.x, s.y, s.x, s.y); out.sewMenu.push(S.selSeam);
    // a zipper inside the seam
    app.setTool("zipper");
    const zc = (x, y) => { const q = at(x, y); app.sewClick(q.x, q.y, {}); };
    zc(50, 0); zc(150, 0); app.sewKey("Enter"); zc(50, 200); zc(150, 200); app.sewKey("Enter");
    out.zip = S.seams.filter(sm => sm.zip).length; out.count = S.seams.length;
    out.back = JSON.parse(app.docJSON()).seams.length;
    app.undo(); out.undone = S.seams.length;
    return out;
  ` });
  assert.deepStrictEqual(r.errors, [], "no errors");
  const o = r.result;
  assert.strictEqual(o.layerSeen, 1, "the sewn edge counts one seam before the second is made");
  assert.strictEqual(o.seams.length, 2); assert.deepStrictEqual(o.on, [1, 2]); assert.deepStrictEqual(o.lanes, [0, 1]);
  assert.ok(/Seam S2/.test(o.toast), o.toast);
  assert.strictEqual(o.hit0, 1); assert.strictEqual(o.hitLane, true, "the second layer is picked beside the edge");
  assert.strictEqual(o.menu, 0, "the segment menu is the line's, with no seam rows");
  assert.deepStrictEqual(o.sewMenu, [2, true, 1], "Edit Sewing's menu works on the seam of the lane right-clicked");
  assert.strictEqual(o.zip, 1); assert.strictEqual(o.count, 3); assert.strictEqual(o.back, 3); assert.strictEqual(o.undone, 2);
});

test("dragging one point shows a ghost: the pattern is painted as it was, the shape is live again after each paint, one undo step", () => {
  const r = boot({ script: `
    const out = {};
    S.pieces.length = 0; S.seams.length = 0;
    const p = app.mkPiece("P", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true)); S.pieces.push(p);
    app.commit(); app.setTool("edit_pattern");
    const P = () => S.pieces[0], sc = (x, y) => app.toS({ x, y });
    const a = sc(200, 0), b = sc(230, -40), depth = S.undo.length;
    app.fire("pointermove", { x: a.x, y: a.y }); app.fire("pointerdown", { x: a.x, y: a.y });
    app.fire("pointermove", { x: (a.x + b.x)/2, y: (a.y + b.y)/2 }); app.fire("pointermove", { x: b.x, y: b.y });
    const d = app.ghostDrag();
    out.ghost = !!d;
    out.live = [P().pts[1].x, P().pts[1].y]; out.was = d ? [d.orig.pts[1].x, d.orig.pts[1].y] : null;
    // what the patterns are painted from while the ghost is up: seen from inside a paint
    let seen = null; const stack = S.pieces; const pts0 = P().pts;
    Object.defineProperty(P(), "on", { configurable: true, get() { if (!seen && S.drag) seen = [this.pts[1].x, this.pts[1].y]; return true; } });
    app.draw();
    Object.defineProperty(P(), "on", { configurable: true, writable: true, value: true });
    out.painted = seen; out.sameAfter = P().pts === pts0 && P().pts[1].x === out.live[0];
    app.fire("pointerup", { x: b.x, y: b.y });
    out.done = [Math.round(P().pts[1].x), Math.round(P().pts[1].y), S.undo.length - depth, !!app.ghostDrag()];
    app.undo(); out.undone = [P().pts[1].x, P().pts[1].y];
    return out;
  ` });
  assert.deepStrictEqual(r.errors, [], "no errors");
  const o = r.result;
  assert.strictEqual(o.ghost, true);
  assert.deepStrictEqual(o.was, [200, 0]);
  assert.ok(Math.abs(o.live[0] - 230) < 6 && Math.abs(o.live[1] + 40) < 6, "the drag works on the real shape: " + o.live);
  assert.deepStrictEqual(o.painted, [200, 0], "the pattern is painted with its point where it was");
  assert.strictEqual(o.sameAfter, true, "and the live shape is back when the paint is over");
  assert.deepStrictEqual(o.done.slice(2), [1, false], "one undo step, no ghost left");
  assert.deepStrictEqual(o.undone, [200, 0]);
});

module.exports = T;
