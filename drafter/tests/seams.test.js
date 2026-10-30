// Seam pairing: length difference, direction, pruning, JSON round-trip.
// (Segment-id stability under edits lives in segids.test.js.)
// Run:  node drafter/tests/run.js
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], nextSegId: 1 };
const G = load([
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan",
  "newSegId", "segIx", "ensureSegIds", "setCurve", "mkShape", "ellipseShape", "rectShape",
  "SEAM_COLS", "seamCol", "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "seamEnds", "validSeams", "seamOn",
  "seamRev", "makeSeam", "loadSeams",
], { S });
const { V, rectShape, ellipseShape, setCurve, segLen, seamInfo, seamEnds,
  validSeams, seamOn, seamRev, makeSeam, loadSeams, seamCol } = G;

const piece = (id, sh, extra) => ({ id, name: "P" + id, on: true, closed: true, pts: sh.pts, segs: sh.segs,
  internals: [], bases: [], darts: [], mirrorOf: null, axis: null, ...extra });
const side = (p, k) => ({ piece: p.id, shape: 0, sids: [p.segs[k].id] });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);

const T = [];
const test = (name, fn) => T.push({ name, fn });

test("straight segments: diff = A − B, sign flips when sides swap", () => {
  const A = piece(1, rectShape(0, 0, 100, 50));     // seg 0 top edge = 100
  const B = piece(2, rectShape(200, 0, 98, 40));    // seg 0 = 98, seg 1 = 40
  const pcs = [A, B];
  const inf = seamInfo(makeSeam([], side(A, 0), side(B, 0), false), pcs);
  near(inf.la, 100, 1e-9); near(inf.lb, 98, 1e-9); near(inf.diff, 2, 1e-9);
  assert.deepStrictEqual([inf.ia, inf.ib], [0, 0]);
  near(seamInfo(makeSeam([], side(B, 0), side(A, 0), false), pcs).diff, -2, 1e-9);
  near(seamInfo(makeSeam([], side(A, 1), side(B, 1)), pcs).diff, 10, 1e-9);
});

test("curved side: quarter-ellipse arc vs straight edge matches Ramanujan within 0.1%", () => {
  const a = 120, b = 70;
  const h = ((a - b) / (a + b)) ** 2;
  const quarter = Math.PI * (a + b) * (1 + 3*h / (10 + Math.sqrt(4 - 3*h))) / 4;
  const E = piece(1, ellipseShape(0, 0, a, b));
  const R = piece(2, rectShape(300, 0, 150, 20));   // seg 0 = 150
  const inf = seamInfo(makeSeam([], side(E, 0), side(R, 0)), [E, R]);
  near(inf.la, quarter, quarter * 1e-3, "arc length");
  near(inf.diff, quarter - 150, quarter * 1e-3, "diff");
});

test("diff is arc length, not chord: bending a side changes the difference", () => {
  const A = piece(1, rectShape(0, 0, 100, 50)), B = piece(2, rectShape(200, 0, 100, 50));
  const sm = makeSeam([], side(A, 0), side(B, 0));
  near(seamInfo(sm, [A, B]).diff, 0, 1e-9);
  setCurve(B, 0, true); B.segs[0].c1 = V(230, -30); B.segs[0].c2 = V(270, -30);
  const inf = seamInfo(sm, [A, B]);
  assert.ok(inf.lb > 100 + 1, "curved side should be longer than its chord");
  near(inf.diff, 100 - inf.lb, 1e-9);
  near(inf.lb, segLen(B, 0), 1e-12, "uses the same arc length as the panel");
});

test("diff tracks live edits (moving a point)", () => {
  const A = piece(1, rectShape(0, 0, 100, 50)), B = piece(2, rectShape(200, 0, 100, 50));
  const sm = makeSeam([], side(A, 0), side(B, 0));
  B.pts[1] = V(310, 0);                              // B top edge now 110
  near(seamInfo(sm, [A, B]).diff, -10, 1e-9);
});

test("same-piece seam (e.g. a tube) works; a segment can't be sewn to itself", () => {
  const P = piece(1, rectShape(0, 0, 80, 60));
  P.pts[2] = V(80, 65);                              // seg 1 now 65; seg 3 (pts3→pts0) untouched
  const inf = seamInfo(makeSeam([], side(P, 1), side(P, 3), true), [P]);
  near(inf.la, 65, 1e-9); near(inf.lb, 60, 1e-9); near(inf.diff, 5, 1e-9);
  assert.strictEqual(makeSeam([], side(P, 2), side(P, 2)), null);
});

test("direction flag pairs the ends, and never changes the difference", () => {
  const A = piece(1, rectShape(0, 0, 100, 50)), B = piece(2, rectShape(200, 0, 90, 50));
  const fwd = makeSeam([], side(A, 0), side(B, 0), false);
  const rev = makeSeam([], side(A, 0), side(B, 0), true);
  const pcs = [A, B];
  near(seamInfo(fwd, pcs).diff, seamInfo(rev, pcs).diff, 0);
  const [[a0, bf0], [a1, bf1]] = seamEnds(fwd, pcs);
  assert.deepStrictEqual([a0, bf0, a1, bf1], [V(0, 0), V(200, 0), V(100, 0), V(290, 0)]);
  const [[, br0], [, br1]] = seamEnds(rev, pcs);
  assert.deepStrictEqual([br0, br1], [V(290, 0), V(200, 0)]);
  // click-derived direction: the clicked ends meet
  assert.strictEqual(seamRev(0.1, 0.2), false);
  assert.strictEqual(seamRev(0.9, 0.8), false);
  assert.strictEqual(seamRev(0.1, 0.9), true);
  assert.strictEqual(seamRev(0.7, 0.3), true);
});

test("ids are unique, colours are stable per id and paired sides share one", () => {
  const seams = [];
  for (let i = 0; i < 3; i++) seams.push(makeSeam(seams, { piece: 1, sid: 10 + i }, { piece: 2, sid: 20 + i }));
  assert.deepStrictEqual(seams.map(s => s.id), [1, 2, 3]);
  seams.splice(0, 1);
  assert.strictEqual(makeSeam(seams, { piece: 1, sid: 15 }, { piece: 2, sid: 25 }).id, 4, "never reuses a live id");
  assert.notStrictEqual(seamCol(seams[0]), seamCol(seams[1]));
  assert.strictEqual(seamCol({ id: 1 }), seamCol({ id: 1 + G.SEAM_COLS.length }));
});

test("dangling seams are dropped: deleted piece or segment id gone", () => {
  const A = piece(1, rectShape(0, 0, 100, 50)), B = piece(2, rectShape(200, 0, 90, 50));
  const seams = [
    { id: 1, a: [side(A, 0)], b: [side(B, 0)] },
    { id: 2, a: [side(A, 1)], b: [{ piece: 9, shape: 0, sids: [B.segs[0].id] }] },  // piece gone
    { id: 3, a: [{ piece: 1, shape: 0, sids: [99999] }], b: [side(B, 1)] },           // no such segment
  ];
  assert.deepStrictEqual(validSeams(seams, [A, B]).map(s => s.id), [1]);
  assert.strictEqual(seamInfo({ id: 2, a: [side(A, 1)], b: [{ piece: 9, shape: 0, sids: [B.segs[0].id] }] }, [A, B]), null);
  assert.strictEqual(seamOn(seams, 2, B.segs[0].id).id, 1);
  assert.strictEqual(seamOn(seams, 2, B.segs[3].id), null);
});

test("JSON save/load round-trip preserves seams and their difference; junk is rejected", () => {
  const A = piece(1, ellipseShape(0, 0, 60, 40)), B = piece(2, rectShape(200, 0, 90, 50));
  const seams = [makeSeam([], side(A, 1), side(B, 2), true)];
  const doc = JSON.parse(JSON.stringify({ v: 5, pieces: [A, B], seams }));
  const back = loadSeams(doc.seams, doc.pieces);
  assert.deepStrictEqual(back, seams);
  near(seamInfo(back[0], doc.pieces).diff, seamInfo(seams[0], [A, B]).diff, 1e-12);
  assert.deepStrictEqual(loadSeams(undefined, doc.pieces), [], "v3 files have no seams");
  assert.deepStrictEqual(loadSeams([null, { id: 2, a: { piece: 1 } }, { id: "x", a: side(A, 0), b: side(B, 0) }], doc.pieces), []);
  const extra = loadSeams([{ id: 5, a: side(A, 0), b: side(B, 0), rev: 1, junk: true }], doc.pieces);
  assert.deepStrictEqual(extra, [{ id: 5, a: [{ ...side(A, 0), t0: 0, t1: 1, rev: false }], b: [{ ...side(B, 0), t0: 0, t1: 1, rev: true }] }]);
});

module.exports = T;
