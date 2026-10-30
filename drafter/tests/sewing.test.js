// The M:N seam model (file version 9): a seam side is a list of parts, a part may start
// and end part-way along a segment and has its own direction. Covers 1:N and M:N seams,
// free ranges, maintained sewing on ranges, places along a shape, Unlink M:N, twins on
// symmetric patterns, Check Sewing Length and loading older files.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, unit: "mm", saValue: 10 };
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", "normGuides", "mkAnchor", "anchorAt", "measureInfo", "validMeasures", "affOf", "affApply", "affMul", "syncHalf", "chainIdx", "mkLinked",
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten",
  "signedArea", "inside", "reflectAcross", "reflector", "mapPiece", "byId", "sync", "mkPiece", "normProps", "unfold",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "addChild",
  "setCurve", "mkShape", "rectShape", "ellipseShape",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "deletePoint", "lineX", "dartGeom", "applyDart", "addDartTo",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "partsOn", "seamsOn", "seamLanes", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "seamEnds", "validSeams", "seamOn", "makeSeam", "loadSeams",
  "segAdvance", "shapeAdvance", "rangePart", "partPlaces", "partPlace", "subPart", "unlinkSeam", "seamTwins", "sewCheckBad", "normSewCheck",
  "migrate", "resolveRefs", "alignMirrorIds", "NOTCH_DEFAULT", "normNotch", "loadDoc",
], { S });
const { V, mkShape, rectShape, ellipseShape, mkPiece, addPoint, deletePoint, segLen, segPt, sync, clone,
  seamInfo, seamEnds, seamSide, seamOn, seamsOn, seamLanes, makeSeam, loadSeams, validSeams, resolveRefs, segIx, flipSeam, partLen, partEnds, partsOverlap,
  segLenT, segAdvance, shapeAdvance, rangePart, unlinkSeam, seamTwins, sewCheckBad, normSewCheck, loadDoc } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });

function reset() { S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; }
// a pattern with a level top edge of the given width, from (x, y) rightward: edge 0
const strip = (name, x, y, w, h = 80) => { const p = mkPiece(name, mkShape([V(x, y), V(x + w, y), V(x + w, y + h), V(x, y + h)], true)); S.pieces.push(p); return p; };
const top = (p, more) => ({ piece: p.id, sid: p.segs[0].id, ...more });
const settle = () => { sync(); S.seams = resolveRefs(S.pieces, S.seams); };

test("1:N: one edge sewn to two shorter ones; lengths add up and the ends that meet are the outer ones", () => {
  reset();
  const A = strip("A", 0, 0, 300), B = strip("B", 0, 200, 100), C = strip("C", 150, 200, 190);
  const sm = makeSeam([], top(A), [top(B), top(C)]);
  assert.strictEqual(sm.a.length, 1); assert.strictEqual(sm.b.length, 2);
  const inf = seamInfo(sm, S.pieces);
  near(inf.la, 300, 1e-9); near(inf.lb, 290, 1e-9); near(inf.diff, 10, 1e-9);
  assert.strictEqual(inf.B.length, 2); near(inf.B[1].len, 190, 1e-9);
  let [[a0, b0], [a1, b1]] = seamEnds(sm, S.pieces);
  samePt(a0, V(0, 0)); samePt(b0, V(0, 200)); samePt(a1, V(300, 0)); samePt(b1, V(340, 200));
  // C sewn against its direction: the seam now ends at C's start
  sm.b[1].rev = true;
  [[a0, b0], [a1, b1]] = seamEnds(sm, S.pieces);
  samePt(b1, V(150, 200)); near(seamInfo(sm, S.pieces).diff, 10, 1e-9, "direction never changes the difference");
  // turned over: side b is sewn from its other end
  flipSeam(sm);
  assert.deepStrictEqual(sm.b.map(x => [x.piece, x.rev]), [[C.id, false], [B.id, true]]);
  samePt(seamEnds(sm, S.pieces)[0][1], V(150, 200)); samePt(seamEnds(sm, S.pieces)[1][1], V(0, 200));
});

test("M:N: several parts on both sides; within one seam a part can't be used twice and ranges may not overlap", () => {
  reset();
  const A = strip("A", 0, 0, 100), A2 = strip("A2", 120, 0, 200), B = strip("B", 0, 200, 150), C = strip("C", 200, 200, 90), D = strip("D", 300, 200, 60);
  const sm = makeSeam([], [top(A), top(A2)], [top(B), top(C), top(D)]);
  const inf = seamInfo(sm, S.pieces);
  near(inf.la, 300, 1e-9); near(inf.lb, 300, 1e-9);
  assert.strictEqual(makeSeam([], [top(A), top(A)], top(B)), null, "the same edge twice on one side");
  assert.strictEqual(makeSeam([], top(A), [top(B), top(A)]), null, "the same edge on both sides");
  assert.ok(makeSeam([], top(A, { t0: 0, t1: 0.4 }), top(A, { t0: 0.6, t1: 1 })), "two stretches of one edge that don't touch");
  assert.strictEqual(makeSeam([], top(A, { t0: 0, t1: 0.6 }), top(A, { t0: 0.5, t1: 1 })), null, "stretches that overlap");
  assert.ok(partsOverlap(sm.a[0], { piece: A.id, shape: 0, sids: [A.segs[0].id], t0: 0.2, t1: 0.3 }));
  // looking a seam up by place
  const seams = [makeSeam([], top(A, { t0: 0, t1: 0.4 }), top(B)), { ...makeSeam([], top(A, { t0: 0.6, t1: 1 }), top(C)), id: 2 }];
  assert.strictEqual(seamOn(seams, A.id, A.segs[0].id, 0, 0.2).id, 1);
  assert.strictEqual(seamOn(seams, A.id, A.segs[0].id, 0, 0.8).id, 2);
  assert.strictEqual(seamOn(seams, A.id, A.segs[0].id, 0, 0.5), null, "the gap between them is not sewn");
  assert.strictEqual(validSeams(seams, S.pieces).length, 2, "both stay: they share a segment but no edge");
  const clash = [...seams, { id: 3, a: [{ piece: A.id, shape: 0, sids: [A.segs[0].id], t0: 0.3, t1: 0.7 }], b: [{ piece: D.id, shape: 0, sids: [D.segs[0].id] }] }];
  assert.deepStrictEqual(validSeams(clash, S.pieces).map(s => s.id), [1, 2, 3], "a later seam over edge already sewn stays: a second layer");
  assert.deepStrictEqual(seamsOn(clash, A.id, A.segs[0].id, 0, 0.35).map(s => s.id), [1, 3]);
});

test("free ranges: a part can start and end part-way along a segment, on lines and on curves", () => {
  reset();
  const A = strip("A", 0, 0, 300), B = strip("B", 0, 200, 150);
  const sm = makeSeam([], top(A, { t0: 0.25, t1: 0.75 }), top(B));
  const inf = seamInfo(sm, S.pieces);
  near(inf.la, 150, 1e-9); near(inf.diff, 0, 1e-9);
  const X = seamSide(sm.a[0], S.pieces);
  samePt(partEnds(X, sm.a[0])[0], V(75, 0)); samePt(partEnds(X, sm.a[0])[1], V(225, 0));
  sm.a[0].rev = true;
  samePt(partEnds(X, sm.a[0])[0], V(225, 0), "sewn from the other end");
  // a curve: the two halves add up to the whole, and a range over two segments adds its pieces
  const E = mkPiece("E", ellipseShape(600, 300, 120, 80)); S.pieces.push(E);
  near(segLenT(E, 0, 0, 0.5) + segLenT(E, 0, 0.5, 1), segLen(E, 0), 0.01);   // sampled separately
  const part = { piece: E.id, shape: 0, sids: [E.segs[0].id, E.segs[1].id], t0: 0.5, t1: 0.5, rev: false };
  near(partLen(seamSide(part, S.pieces), part), segLenT(E, 0, 0.5, 1) + segLenT(E, 1, 0, 0.5), 1e-9);
  // a dart counts only if it is inside the range
  A.darts = [{ sid: A.segs[0].id, t: 0.5, width: 20, depth: 60 }];
  near(seamInfo(sm, S.pieces).la, 130, 1e-9, "the dart inside the range is sewn shut");
  near(seamInfo(makeSeam([], top(A, { t0: 0.6, t1: 1 }), top(B)), S.pieces).la, 120, 1e-9, "a range beside the dart is not shortened");
});

test("Add Point keeps a free range where it is: inside it, before it, after it, and on a curve", () => {
  reset();
  const A = strip("A", 0, 0, 300), B = strip("B", 0, 200, 210);
  S.seams.push(makeSeam(S.seams, top(A, { t0: 0.2, t1: 0.9 }), top(B)));
  const ends = () => seamEnds(S.seams[0], S.pieces).map(e => e[0]), len = () => seamInfo(S.seams[0], S.pieces).la;
  const check = (msg, n) => {
    settle();
    samePt(ends()[0], V(60, 0), msg + ": start"); samePt(ends()[1], V(270, 0), msg + ": end"); near(len(), 210, 1e-9, msg);
    assert.strictEqual(S.seams[0].a[0].sids.length, n, msg + ": segments in the run");
  };
  addPoint(A, 0, 0.5); check("a point inside the range", 2);
  near(S.seams[0].a[0].t0, 0.4, 1e-12); near(S.seams[0].a[0].t1, 0.8, 1e-12);
  addPoint(A, 0, 0.1); check("a point before the range", 2);
  assert.strictEqual(segIx(A, S.seams[0].a[0].sids[0]), 1, "the range starts on the second piece of the old segment");
  addPoint(A, 2, 0.95); check("a point after the range", 2);
  addPoint(A, 2, 0.5); check("another inside", 3);
  // curved edge
  reset();
  const E = mkPiece("E", ellipseShape(0, 0, 120, 80)), F = strip("F", 300, 0, 100); S.pieces.push(E);
  S.seams.push(makeSeam(S.seams, { piece: E.id, sid: E.segs[0].id, t0: 0.3, t1: 0.8 }, top(F)));
  const e0 = ends(), l0 = len();
  addPoint(E, 0, 0.5); settle();
  samePt(ends()[0], e0[0], "curve start", 1e-9); samePt(ends()[1], e0[1], "curve end", 1e-9); near(len(), l0, 1e-3, "curve length");
});

test("Delete Point keeps a free range where it is when the two edges are in line", () => {
  reset();
  const A = strip("A", 0, 0, 300), B = strip("B", 0, 200, 180);
  addPoint(A, 0, 0.5);                                           // top edge = two segments of 150
  S.seams.push(makeSeam(S.seams, { piece: A.id, sids: [A.segs[0].id, A.segs[1].id], t0: 0.4, t1: 0.6 }, top(B)));
  near(seamInfo(S.seams[0], S.pieces).la, 180, 1e-9);
  deletePoint(A, 1); settle();
  const part = S.seams[0].a[0];
  assert.strictEqual(part.sids.length, 1); near(part.t0, 0.2, 1e-12); near(part.t1, 0.8, 1e-12);
  near(seamInfo(S.seams[0], S.pieces).la, 180, 1e-9);
  samePt(seamEnds(S.seams[0], S.pieces)[0][0], V(60, 0)); samePt(seamEnds(S.seams[0], S.pieces)[1][0], V(240, 0));
  // a range wholly on the edge that grows keeps its place too
  reset();
  const C = strip("C", 0, 0, 300), D = strip("D", 0, 200, 60);
  addPoint(C, 0, 0.5);
  S.seams.push(makeSeam(S.seams, { piece: C.id, sid: C.segs[0].id, t0: 0.2, t1: 0.6 }, top(D)));
  deletePoint(C, 1); settle();
  near(S.seams[0].a[0].t0, 0.1, 1e-12); near(S.seams[0].a[0].t1, 0.3, 1e-12); near(seamInfo(S.seams[0], S.pieces).la, 60, 1e-9);
});

test("places along a shape: going a distance forward and back, round corners, round a closed outline, and stopping at open ends", () => {
  reset();
  const R = strip("R", 0, 0, 300, 100);
  assert.deepStrictEqual(segAdvance(R, 0, 0.5, 60), { t: 0.7, left: 0 });
  near(segAdvance(R, 0, 0.5, 200).left, 50, 1e-9);
  let q = shapeAdvance(R, { i: 0, t: 0.5 }, 200);                 // 150 to the corner, 50 down the right edge
  assert.strictEqual(q.i, 1); near(q.t, 0.5, 1e-9);
  q = shapeAdvance(R, { i: 0, t: 0.5 }, -200);                    // back past the first point onto the left edge
  assert.strictEqual(q.i, 3); near(q.t, 0.5, 1e-9);
  q = shapeAdvance(R, { i: 0, t: 0 }, 800 + 75);                  // once round and on
  assert.strictEqual(q.i, 0); near(q.t, 0.25, 1e-9);
  const ln = mkShape([V(0, 0), V(100, 0), V(100, 50)], false);
  assert.deepStrictEqual(shapeAdvance(ln, { i: 0, t: 0.5 }, 500), { i: 1, t: 1 });
  assert.deepStrictEqual(shapeAdvance(ln, { i: 1, t: 0.5 }, -500), { i: 0, t: 0 });
  // on a curve the distance is arc length
  const E = mkPiece("E", ellipseShape(0, 0, 100, 100));
  const quarter = segLen(E, 0), h = shapeAdvance(E, { i: 0, t: 0 }, quarter / 2);
  near(segLenT(E, 0, 0, h.t), quarter / 2, 0.02);
  // ranges
  assert.deepStrictEqual(rangePart(R.id, 0, R, { i: 3, t: 0.5 }, { i: 0, t: 0.5 }, false).sids, [R.segs[3].id, R.segs[0].id], "wraps over the first point");
  assert.strictEqual(rangePart(R.id, 0, R, { i: 0, t: 0.5 }, { i: 0, t: 0.2 }, false), null, "not all the way round");
  assert.strictEqual(rangePart(1, 5, ln, { i: 1, t: 0.5 }, { i: 0, t: 0.2 }, false), null, "an open line has one direction");
  const r = rangePart(R.id, 0, R, { i: 0, t: 1 }, { i: 2, t: 0 }, true);
  assert.deepStrictEqual([r.sids, r.t0, r.t1, r.rev], [[R.segs[1].id], 0, 1, true], "ends that sit on points give whole segments");
});

test("Unlink M:N Sewing: one 1:1 seam per stretch, matched in proportion, nothing lost", () => {
  reset();
  const A = strip("A", 0, 0, 300), B = strip("B", 0, 200, 100), C = strip("C", 150, 200, 200);
  const sm = makeSeam([], top(A), [top(B), top(C)]);
  let out = unlinkSeam(sm, [sm], S.pieces);
  assert.deepStrictEqual(out.map(s => s.id), [1, 2]);
  let infs = out.map(s => seamInfo(s, S.pieces));
  near(infs[0].la, 100, 1e-6); near(infs[0].lb, 100, 1e-9); near(infs[1].la, 200, 1e-6); near(infs[1].lb, 200, 1e-9);
  samePt(seamEnds(out[0], S.pieces)[1][0], V(100, 0), "A is cut a third of the way along", 1e-6);
  assert.strictEqual(validSeams(out, S.pieces).length, 2, "the pieces don't overlap");
  // the long edge sewn backwards: its far end goes to B
  const back = makeSeam([], top(A, { rev: true }), [top(B), top(C)]);
  out = unlinkSeam(back, [back], S.pieces);
  samePt(seamEnds(out[0], S.pieces)[0][0], V(300, 0)); samePt(seamEnds(out[0], S.pieces)[1][0], V(200, 0), "", 1e-6);
  assert.strictEqual(out[0].a[0].rev, true);
  // 2:3 with different totals: every stretch has the same ratio as the whole seam
  reset();
  const P = strip("P", 0, 0, 100), Q = strip("Q", 120, 0, 200), U = strip("U", 0, 200, 160), W = strip("W", 200, 200, 100), Z = strip("Z", 320, 200, 60);
  const mn = makeSeam([], [top(P), top(Q)], [top(U), top(W), top(Z)]);
  out = unlinkSeam(mn, [mn, { id: 7, a: [], b: [] }], S.pieces);
  assert.deepStrictEqual(out.map(s => s.id), [1, 8, 9, 10], "new ids above every live one");
  infs = out.map(s => seamInfo(s, S.pieces));
  near(infs.reduce((L, i) => L + i.la, 0), 300, 1e-6); near(infs.reduce((L, i) => L + i.lb, 0), 320, 1e-6);
  infs.forEach(i => near(i.lb / i.la, 320 / 300, 1e-6, "ratio"));
});

test("twins on symmetric patterns: the same seam on a linked copy, on the source, and on the other half of an unfold", () => {
  reset();
  const F = strip("F", 0, 0, 100), B = strip("B", 0, 200, 100), B2 = strip("B2", 300, 200, 100), X = strip("X", 600, 0, 50), Y = strip("Y", 600, 200, 50);
  const M = clone(F); M.id = S.nextId++; M.name = "M"; M.link = { of: F.id, kind: "symmetric", m: G.affOf(G.reflector(V(150, 0), V(150, 100))) };
  S.pieces.push(M); sync();
  const s1 = makeSeam([], top(F), top(B)), s2 = { ...makeSeam([], { piece: M.id, sid: F.segs[0].id }, top(B2)), id: 2 }, s3 = { ...makeSeam([], top(X), top(Y)), id: 3 };
  const all = [s1, s2, s3];
  assert.deepStrictEqual(seamTwins(s1, all, S.pieces).map(s => s.id), [2], "from the source to its copy");
  assert.deepStrictEqual(seamTwins(s2, all, S.pieces).map(s => s.id), [1], "from the copy to its source");
  assert.deepStrictEqual(seamTwins(s3, all, S.pieces), [], "an ordinary pattern has none");
  // a symmetric unfold: edge 1 mirrors edge 3
  const H = strip("H", 0, 400, 100);
  H.half = { s: H.segs[0].id, m: H.segs[2].id, map: { [H.segs[1].id]: H.segs[3].id }, kids: {} };
  const h1 = { ...makeSeam([], { piece: H.id, sid: H.segs[1].id }, { piece: X.id, sid: X.segs[1].id }), id: 4 };
  const h2 = { ...makeSeam([], { piece: H.id, sid: H.segs[3].id }, { piece: Y.id, sid: Y.segs[1].id }), id: 5 };
  assert.deepStrictEqual(seamTwins(h1, [h1, h2], S.pieces).map(s => s.id), [5]);
  assert.deepStrictEqual(seamTwins(h2, [h1, h2], S.pieces).map(s => s.id), [4]);
});

test("Check Sewing Length: by length, by ratio, both or neither; settings are cleaned on load", () => {
  const inf = (la, lb) => ({ la, lb, diff: la - lb });
  const byLen = normSewCheck({ on: true, len: 2 });
  assert.deepStrictEqual(byLen, { on: true, useLen: true, len: 2, useRatio: false, ratio: 2 });
  assert.strictEqual(sewCheckBad(inf(100, 97), byLen), true); assert.strictEqual(sewCheckBad(inf(97, 100), byLen), true, "either side longer");
  assert.strictEqual(sewCheckBad(inf(100, 98.5), byLen), false); assert.strictEqual(sewCheckBad(inf(100, 98), byLen), false, "at the limit is fine");
  const byRatio = normSewCheck({ useLen: false, useRatio: true, ratio: 5 });
  assert.strictEqual(sewCheckBad(inf(1000, 960), byRatio), false, "4 % of a long seam");
  assert.strictEqual(sewCheckBad(inf(50, 45), byRatio), true, "10 % of a short one");
  assert.strictEqual(sewCheckBad(inf(100, 50), normSewCheck({ useLen: false })), false, "nothing switched on");
  assert.deepStrictEqual(normSewCheck("junk"), { on: false, useLen: true, len: 2, useRatio: false, ratio: 2 });
  assert.deepStrictEqual(normSewCheck({ len: -3, ratio: "x", on: 1 }), { on: true, useLen: true, len: 2, useRatio: false, ratio: 2 });
});

test("files: a v8 seam (one run per side, one rev) loads as parts; a v9 document round-trips; bad parts go", () => {
  reset();
  const A = strip("A", 0, 0, 300), B = strip("B", 0, 200, 100), C = strip("C", 150, 200, 200);
  const v8 = loadSeams([{ id: 1, a: { piece: A.id, shape: 0, sids: [A.segs[0].id] }, b: { piece: B.id, shape: 0, sids: [B.segs[0].id] }, rev: true }], S.pieces);
  assert.deepStrictEqual(v8, [{ id: 1, a: [{ piece: A.id, shape: 0, sids: [A.segs[0].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[0].id], t0: 0, t1: 1, rev: true }] }]);
  S.seams = [makeSeam([], top(A, { t0: 0.1, t1: 0.9, rev: true }), [top(B), top(C, { rev: true })])];
  const saved = clone(S.seams), text = JSON.stringify({ v: 9, nextId: S.nextId, nextSegId: S.nextSegId, nextShapeId: S.nextShapeId, pieces: S.pieces, seams: S.seams });
  S.pieces = []; S.seams = [];
  loadDoc(JSON.parse(text));
  assert.deepStrictEqual(S.seams, saved);
  // a part on a missing piece goes; the seam stays while each side has a part left
  const P = S.pieces;
  const dirty = loadSeams([{ id: 1, a: [{ piece: P[0].id, sids: [P[0].segs[0].id] }], b: [{ piece: P[1].id, sids: [P[1].segs[0].id] }, { piece: 99, sids: [1] }, null] },
    { id: 2, a: [{ piece: 99, sids: [1] }], b: [{ piece: P[2].id, sids: [P[2].segs[0].id] }] },
    { id: 3, a: [], b: "x" }], P);
  assert.deepStrictEqual(dirty.map(s => [s.id, s.a.length, s.b.length]), [[1, 1, 1]]);
  assert.deepStrictEqual([dirty[0].b[0].t0, dirty[0].b[0].t1, dirty[0].b[0].rev], [0, 1, false], "missing fields get their defaults");
});

module.exports = T;
