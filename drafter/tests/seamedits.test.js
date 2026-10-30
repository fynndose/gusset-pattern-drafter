// Phase 1: sewing is maintained through Add Point and Delete Point on the sewn edge
// itself, plus four regression cases known from other pattern programs.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, unit: "mm", saValue: 10 };
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", "normGuides", "mkAnchor", "anchorAt", "measureInfo", "validMeasures", "affOf", "affApply", "affMul", "syncHalf", "chainIdx", "mkLinked", 
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten",
  "signedArea", "inside", "reflectAcross", "reflector", "mapPiece", "byId", "sync", "mkPiece", "normProps", "unfold",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "addChild",
  "setCurve", "mkShape", "rectShape",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "deletePoint", "lineX", "dartGeom", "applyDart", "addDartTo",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "seamEnds", "validSeams", "seamOn", "makeSeam", "loadSeams",
  "migrate", "resolveRefs", "alignMirrorIds", "NOTCH_DEFAULT", "normNotch", "loadDoc",
  "fmt", "toDisp", "fromDisp", "saShown", "saTyped",
], { S });
const { V, cp, mkShape, rectShape, mkPiece, addChild, addPoint, deletePoint, setCurve, segLen, mapPiece, reflector, unfold, sync, clone,
  seamInfo, seamEnds, seamOn, makeSeam, loadSeams, resolveRefs, segIx, loadDoc, fmt, toDisp, fromDisp, saShown, saTyped } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });

// Front: 6 straight edges. Back: 4. S1 = Front edge 3 ↔ Back edge 1.
function setup() {
  S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.unit = "mm"; S.saValue = 10;
  const F = mkPiece("Front", mkShape([V(0,0), V(70,10), V(190,40), V(150,220), V(170,480), V(0,495)], true));
  const B = mkPiece("Back", mkShape([V(300,0), V(460,30), V(470,480), V(300,495)], true));
  S.pieces.push(F, B);
  S.seams.push(makeSeam(S.seams, { piece: F.id, sid: F.segs[3].id }, { piece: B.id, sid: B.segs[1].id }, false));
  return { F, B };
}
const settle = () => { sync(); S.seams = resolveRefs(S.pieces, S.seams); };
const state = (k = 0) => ({ ends: seamEnds(S.seams[k], S.pieces), inf: seamInfo(S.seams[k], S.pieces) });
function assertSame(before, msg, tol = 1e-9, k = 0) {
  assert.ok(S.seams[k], msg + ": seam survives");
  const now = state(k);
  now.ends.flat().forEach((q, m) => samePt(q, before.ends.flat()[m], msg + " end " + m, tol));
  near(now.inf.la, before.inf.la, tol, msg + " length a");
  near(now.inf.lb, before.inf.lb, tol, msg + " length b");
}
const run = (sh, side) => side[0].sids.map(id => segIx(sh, id));

test("Add Point on a sewn edge: the seam covers both halves, same ends and length", () => {
  const { F, B } = setup(), before = state();
  addPoint(F, 3, 0.3); settle();
  assert.deepStrictEqual(run(F, S.seams[0].a), [3, 4]);
  assertSame(before, "one split");
  addPoint(F, 4, 0.5); addPoint(F, 3, 0.5); settle();        // split each half again
  assert.deepStrictEqual(run(F, S.seams[0].a), [3, 4, 5, 6]);
  assertSame(before, "three splits");
  addPoint(B, 1, 0.8); settle();                              // and the partner side
  assert.deepStrictEqual(run(B, S.seams[0].b), [1, 2]);
  assertSame(before, "partner split");
  assert.strictEqual(seamOn(S.seams, F.id, F.segs[5].id).id, 1, "every part counts as sewn");
  assert.strictEqual(seamOn(S.seams, F.id, F.segs[2].id), null);
});

test("Add Point on a sewn curved edge keeps the seam's arc length", () => {
  const { F } = setup();
  setCurve(F, 3, true); F.segs[3].c1 = V(120, 300); F.segs[3].c2 = V(200, 400);
  const before = state();
  addPoint(F, 3, 0.37); addPoint(F, 4, 0.6); settle();
  assert.strictEqual(S.seams[0].a[0].sids.length, 3);
  assertSame(before, "curved", 0.01);                          // 64-sample length estimate gets finer on shorter parts
});

test("Delete Point inside a sewn run: the run shrinks, the seam stays", () => {
  const { F } = setup(), before = state();
  addPoint(F, 3, 0.3); addPoint(F, 4, 0.5); settle();          // run = edges 3,4,5
  deletePoint(F, 5); settle();                                 // the point between edges 4 and 5
  assert.deepStrictEqual(run(F, S.seams[0].a), [3, 4]);
  assertSame(before, "after one delete");
  deletePoint(F, 4); settle();
  assert.deepStrictEqual(run(F, S.seams[0].a), [3]);
  assertSame(before, "back to one edge");
});

test("Delete the start point of a sewn edge: the seam moves onto the edge that grew over it", () => {
  const { F } = setup();
  const id2 = F.segs[2].id, p2 = cp(F.pts[2]), p4 = cp(F.pts[4]);
  deletePoint(F, 3); settle();                                 // edge 3 goes, unsewn edge 2 now runs pts2 → old pts4
  assert.strictEqual(S.seams.length, 1);
  assert.deepStrictEqual(S.seams[0].a[0].sids, [id2]);
  const e = seamEnds(S.seams[0], S.pieces);
  samePt(e[0][0], p2, "start"); samePt(e[1][0], p4, "end");
  near(seamInfo(S.seams[0], S.pieces).la, Math.hypot(p4.x - p2.x, p4.y - p2.y), 1e-9);
});

test("Delete the end point of a sewn edge: the seam stays and covers the longer edge", () => {
  const { F } = setup();
  const id3 = F.segs[3].id, p3 = cp(F.pts[3]), p5 = cp(F.pts[5]);
  deletePoint(F, 4); settle();                                 // edge 4 goes, sewn edge 3 now runs pts3 → old pts5
  assert.deepStrictEqual(S.seams[0].a[0].sids, [id3]);
  const e = seamEnds(S.seams[0], S.pieces);
  samePt(e[0][0], p3, "start"); samePt(e[1][0], p5, "end");
});

test("Delete Point 0 on a closed outline wraps: a seam on edge 0 moves to the last edge", () => {
  const { F, B } = setup();
  S.seams = [makeSeam([], { piece: F.id, sid: F.segs[0].id }, { piece: B.id, sid: B.segs[0].id })];
  const last = F.segs[5].id, p5 = cp(F.pts[5]), p1 = cp(F.pts[1]);
  deletePoint(F, 0); settle();
  assert.deepStrictEqual(S.seams[0].a[0].sids, [last]);
  const e = seamEnds(S.seams[0], S.pieces);
  samePt(e[0][0], p5, "start"); samePt(e[1][0], p1, "end");
});

test("two seams meeting at the deleted point: each keeps exactly its own stretch of the grown edge", () => {
  const { F, B } = setup();
  S.seams.push(makeSeam(S.seams, { piece: F.id, sid: F.segs[4].id }, { piece: B.id, sid: B.segs[2].id }, true));
  addPoint(F, 4, 0.5); settle();                               // S2 run = edges 4,5
  const keepId = F.segs[5].id;
  deletePoint(F, 4); settle();                                 // edge 4 (S2) goes; edge 3 (S1) grows
  assert.deepStrictEqual(S.seams.map(s => s.id), [1, 2]);
  assert.deepStrictEqual(S.seams[1].a[0].sids, [F.segs[3].id, keepId], "S2 now starts part-way along the grown edge");
  const l3 = segLen(F, 3);
  near(seamInfo(S.seams[0], S.pieces).la + seamInfo(S.seams[1], S.pieces).la, l3 + segLen(F, 4), 1e-6, "together they cover the grown edge and the rest of S2");
  // the same when the second seam was on the deleted segment alone
  const r = setup();
  S.seams.push(makeSeam(S.seams, { piece: r.F.id, sid: r.F.segs[4].id }, { piece: r.B.id, sid: r.B.segs[2].id }, true));
  deletePoint(r.F, 4); settle();
  assert.deepStrictEqual(S.seams.map(s => s.id), [1, 2]);
  assert.deepStrictEqual(S.seams.map(s => s.a[0].sids), [[r.F.segs[3].id], [r.F.segs[3].id]], "both on the one grown edge, end to end");
  assert.ok(Math.abs(S.seams[0].a[0].t1 - S.seams[1].a[0].t0) < 1e-12 && S.seams[0].a[0].t1 > 0 && S.seams[0].a[0].t1 < 1);
  near(seamInfo(S.seams[0], S.pieces).la + seamInfo(S.seams[1], S.pieces).la, segLen(r.F, 3), 1e-6, "together they cover the grown edge");
});

test("sewn internal line: interior deletes keep the seam; deleting an end point removes only that end segment", () => {
  const { F, B } = setup();
  const j = addChild(F, "internals", mkShape([V(20,100), V(60,100), V(100,100), V(140,100)], false));
  const it = F.internals[j];
  S.seams = [makeSeam([], { piece: F.id, shape: it.id, sid: it.segs[1].id }, { piece: B.id, sid: B.segs[0].id })];
  addPoint(it, 1, 0.5); settle();
  assert.strictEqual(S.seams[0].a[0].sids.length, 2);
  near(seamInfo(S.seams[0], S.pieces).la, 40, 1e-9);
  deletePoint(it, 2); settle();                                // the added point
  near(seamInfo(S.seams[0], S.pieces).la, 40, 1e-9);
  deletePoint(it, 1); settle();                                // start of the sewn segment: segment 0 grows over it
  assert.strictEqual(S.seams.length, 1);
  near(seamInfo(S.seams[0], S.pieces).la, 80, 1e-9);           // now 20 → 100
  deletePoint(it, 0); settle();                                // an end point: that segment is gone, and so is the seam
  assert.strictEqual(S.seams.length, 0);
  assert.strictEqual(it.segs.length, 1);
  // a run over the first two segments loses just the end one
  const r = setup();
  const k = addChild(r.F, "internals", mkShape([V(20,100), V(60,100), V(100,100)], false)), ln = r.F.internals[k];
  S.seams = [makeSeam([], { piece: r.F.id, shape: ln.id, sids: [ln.segs[0].id, ln.segs[1].id] }, { piece: r.B.id, sid: r.B.segs[0].id })];
  deletePoint(ln, 2); settle();                                // the last point
  assert.strictEqual(S.seams[0].a[0].sids.length, 1);
  near(seamInfo(S.seams[0], S.pieces).la, 40, 1e-9);
});

test("linked mirror: its seam follows splits and deletes made on the source edge", () => {
  const { F, B } = setup();
  const M = clone(F); M.id = S.nextId++; M.link = { of: F.id, kind: "symmetric", m: G.affOf(G.reflector(V(250, 0), V(250, 500))) };
  S.pieces.push(M); sync();
  S.seams.push(makeSeam(S.seams, { piece: M.id, sid: M.segs[3].id }, { piece: B.id, sid: B.segs[3].id }));
  const before = state(1);
  addPoint(F, 3, 0.4); settle();
  assert.deepStrictEqual(run(M, S.seams[1].a), [3, 4], "the mirror's run grew too");
  assertSame(before, "mirror after split", 1e-9, 1);
  deletePoint(F, 4); settle();
  assert.deepStrictEqual(run(M, S.seams[1].a), [3]);
  assertSame(before, "mirror after delete", 1e-9, 1);
  deletePoint(F, 3); settle();                                 // start of the sewn edge on the source
  assert.strictEqual(S.seams.length, 2, "both the source's and the mirror's seams survive");
  assert.deepStrictEqual(run(M, S.seams[1].a), [2]);
});

test("random adds and deletes on and around a sewn edge never move the seam (40 runs × 30 edits)", () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let r = 0; r < 40; r++) {
    const { F, B } = setup();
    S.seams.push(makeSeam(S.seams, { piece: F.id, sid: F.segs[5].id }, { piece: B.id, sid: B.segs[3].id }, true));
    const corners = new Set([...F.pts, ...B.pts]);              // original points: never deleted
    const b0 = state(0), b1 = state(1);
    for (let e = 0; e < 30; e++) {
      const p = rnd() < 0.7 ? F : B;
      const extra = p.pts.map((q, i) => corners.has(q) ? -1 : i).filter(i => i >= 0);
      if (extra.length && rnd() < 0.4) deletePoint(p, extra[Math.floor(rnd() * extra.length)]);   // an added point lies on a straight edge
      else addPoint(p, Math.floor(rnd() * p.segs.length), 0.1 + rnd() * 0.8);
      settle();
      assertSame(b0, "run " + r + " edit " + e + " S1", 1e-7, 0);
      assertSame(b1, "run " + r + " edit " + e + " S2", 1e-7, 1);
      for (const p2 of [F, B]) assert.strictEqual(new Set(p2.segs.map(s => s.id)).size, p2.segs.length, "unique ids");
    }
  }
});

test("undo (a JSON snapshot) restores runs exactly", () => {
  const { F } = setup();
  addPoint(F, 3, 0.5); settle();
  const snap = JSON.stringify({ pieces: S.pieces, seams: S.seams }), before = state();
  deletePoint(S.pieces[0], 3); deletePoint(S.pieces[0], 3); settle();
  const d = JSON.parse(snap); S.pieces = d.pieces; S.seams = d.seams; settle();
  assert.strictEqual(S.seams[0].a[0].sids.length, 2);
  assertSame(before, "after undo");
});

test("files: v6 seams (one sid per side) load as runs; v7 runs round-trip; bad runs are cleaned", () => {
  const { F, B } = setup();
  const v6 = loadSeams([{ id: 1, a: { piece: F.id, shape: 0, sid: F.segs[3].id }, b: { piece: B.id, shape: 0, sid: B.segs[1].id }, rev: true }], S.pieces);
  assert.deepStrictEqual(v6, [{ id: 1, a: [{ piece: F.id, shape: 0, sids: [F.segs[3].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[1].id], t0: 0, t1: 1, rev: true }] }]);
  addPoint(F, 3, 0.5); settle();
  const text = JSON.stringify({ v: 7, nextId: S.nextId, nextSegId: S.nextSegId, nextShapeId: S.nextShapeId, pieces: S.pieces, seams: S.seams });
  const saved = JSON.parse(JSON.stringify(S.seams)), before = state();
  S.pieces = []; S.seams = [];
  loadDoc(JSON.parse(text));
  assert.deepStrictEqual(S.seams, saved);
  assertSame(before, "after reload");
  const F2 = S.pieces[0], B2 = S.pieces[1];
  // ids that don't exist are trimmed; a segment already in a seam may be in a second one too (layers, v11)
  const dirty = loadSeams([
    { id: 1, a: { piece: F2.id, shape: 0, sids: [F2.segs[3].id, 99999, "x"] }, b: { piece: B2.id, shape: 0, sids: [B2.segs[1].id] }, rev: false },
    { id: 2, a: { piece: F2.id, shape: 0, sids: [F2.segs[3].id, F2.segs[4].id] }, b: { piece: B2.id, shape: 0, sids: [B2.segs[2].id] }, rev: false },
    { id: 3, a: { piece: F2.id, shape: 0, sids: [] }, b: { piece: B2.id, shape: 0, sids: [B2.segs[3].id] }, rev: false },
    { id: 4, a: { piece: F2.id, shape: 0, sids: [F2.segs[3].id] }, b: { piece: B2.id, shape: 0, sids: [B2.segs[0].id] }, rev: false },
  ], S.pieces);
  assert.deepStrictEqual(dirty.map(s => [s.id, s.a[0].sids]), [[1, [F2.segs[3].id]], [2, [F2.segs[3].id, F2.segs[4].id]], [4, [F2.segs[3].id]]]);
  // makeSeam refuses runs of one seam that overlap on the same shape
  assert.strictEqual(makeSeam([], { piece: 1, sids: [5, 6] }, { piece: 1, sids: [6, 7] }), null);
  assert.ok(makeSeam([], { piece: 1, sids: [5, 6] }, { piece: 1, sids: [7] }));
});

/* ---- regression cases known from other pattern programs ---- */

test("regression: the typed move distance is the moved distance, in mm and in cm", () => {
  const { F } = setup();
  setCurve(F, 0, true);
  addChild(F, "internals", mkShape([V(20,100), V(60,100)], false));
  F.grain = { a: V(60,120), b: V(60,400) }; F.anno = V(80, 200);
  for (const [unit, typed, mm] of [["mm", 12.5, 12.5], ["cm", 12.5, 125], ["cm", -0.3, -3]]) {
    S.unit = unit;
    const was = JSON.parse(JSON.stringify(F));
    const d = V(fromDisp(typed), fromDisp(typed / 2));
    mapPiece(F, (q) => G.add(q, d));
    const moved = (a, b, what) => { near(b.x - a.x, mm, 1e-9, unit + " " + what + " dx"); near(b.y - a.y, mm / 2, 1e-9, unit + " " + what + " dy"); };
    F.pts.forEach((q, i) => moved(was.pts[i], q, "point " + i));
    moved(was.segs[0].c1, F.segs[0].c1, "handle"); moved(was.segs[0].c2, F.segs[0].c2, "handle");
    F.internals[0].pts.forEach((q, i) => moved(was.internals[0].pts[i], q, "internal " + i));
    moved(was.grain.a, F.grain.a, "grain"); moved(was.anno, F.anno, "label");
    near(toDisp(F.pts[0].x - was.pts[0].x), typed, 1e-9, "shown back in " + unit);
  }
});

test("regression: curve points stay symmetric on a linked mirror after delete + undo", () => {
  const { F } = setup();
  setCurve(F, 1, true); F.segs[1].c1 = V(100, 0); F.segs[1].c2 = V(170, 10);
  setCurve(F, 2, true); F.segs[2].c1 = V(200, 100); F.segs[2].c2 = V(140, 160);
  const M = clone(F); M.id = S.nextId++; M.link = { of: F.id, kind: "symmetric", m: G.affOf(G.reflector(V(250, 0), V(250, 500))) };
  S.pieces.push(M); sync();
  const symmetric = (msg) => {
    const [f, , m] = S.pieces, R = reflector(V(250, 0), V(250, 500));
    assert.strictEqual(m.pts.length, f.pts.length, msg);
    f.pts.forEach((q, i) => samePt(m.pts[i], R(q), msg + " point " + i));
    f.segs.forEach((s, i) => {
      assert.strictEqual(m.segs[i].curved, s.curved, msg + " curve flag " + i);
      if (s.curved) { samePt(m.segs[i].c1, R(s.c1), msg + " c1 " + i); samePt(m.segs[i].c2, R(s.c2), msg + " c2 " + i); }
    });
  };
  symmetric("before");
  const snap = JSON.stringify({ pieces: S.pieces, seams: S.seams });
  deletePoint(F, 2); settle();
  symmetric("after delete");
  const d = JSON.parse(snap); S.pieces = d.pieces; S.seams = d.seams; settle();
  symmetric("after undo");
  assert.strictEqual(JSON.stringify({ pieces: S.pieces, seams: S.seams }), snap, "undo restores the document exactly");
});

test("regression: seam allowance values follow the display unit", () => {
  setup();
  S.unit = "mm"; S.saValue = 12.5;
  assert.strictEqual(fmt(12.5), "12.5"); assert.strictEqual(saShown(), 12.5); assert.strictEqual(saTyped("15"), 15);
  S.unit = "cm";
  assert.strictEqual(fmt(12.5), "1.3", "the table shows cm to one decimal");
  assert.strictEqual(saShown(), 1.25, "the SA box shows cm, not mm");
  assert.strictEqual(saTyped("1.5"), 15, "typing 1.5 cm sets 15 mm");
  assert.strictEqual(saTyped("-2"), 0); assert.strictEqual(saTyped("abc"), 0);
  S.saValue = saTyped(String(saShown()));
  assert.strictEqual(S.saValue, 12.5, "showing then re-entering the value doesn't change it");
});

test("regression: you can't unfold across a curved line", () => {
  const { F } = setup();
  assert.ok(unfold(F, 5), "a straight edge unfolds");
  setCurve(F, 5, true);
  assert.strictEqual(unfold(F, 5), null, "a curved edge is refused");
  setCurve(F, 5, false);
  assert.ok(unfold(F, 5));
});

module.exports = T;
