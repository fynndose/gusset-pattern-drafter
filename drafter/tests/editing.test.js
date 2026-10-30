// Phase 2 editing geometry: typed segment lengths (with and without locked curve points),
// curvature edits that keep handle angles, intersections, Add Point to Intersection,
// Extend/Trim, Offset as Internal Line, and internal ↔ baseline conversion.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1 };
const G = load([
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "flattenSA",
  "signedArea", "outN", "lineX", "offsetVar", "inside", "pieceWind",
  "newSegId", "segIx", "ensureSegIds", "newShapeId", "ensureShapeIds", "addChild",
  "setCurve", "mkShape", "ellipseShape", "rectShape", "mkPiece",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "validSeams", "makeSeam", "resolveRefs",
  "cross", "dot", "blankSeg", "setSegLength", "setPointLengths", "bendSeg", "alongHandle",
  "segChords", "bisect", "segHits", "shapeHits", "distToShape", "nearEnd", "splitAt", "intersectPoints",
  "extendTrim", "OFFSET_TOL", "bezDir", "offsetBez", "offsetErr", "offsetSeg", "offsetLines", "offsetOutline", "convertChild",
], { S });
const { V, cp, sub, add, mul, vlen, dist, clone, bez, segLen, segPt, segTan, flatten, inside, setCurve, mkShape, ellipseShape, rectShape, mkPiece, addChild,
  seamInfo, makeSeam, resolveRefs, cross, dot, setSegLength, setPointLengths, bendSeg, alongHandle, segHits, shapeHits, distToShape, nearEnd,
  splitAt, intersectPoints, extendTrim, offsetSeg, offsetLines, offsetOutline, convertChild } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; }
const line = (...pts) => mkShape(pts, false);
// a hem-like curve from (0,0) to (200,0) bulging down, with a straight segment either side
function curveShape() {
  const sh = mkShape([V(-80, -40), V(0, 0), V(200, 0), V(260, -60)], false);
  setCurve(sh, 1, true); sh.segs[1].c1 = V(60, 40); sh.segs[1].c2 = V(150, 35);
  setCurve(sh, 2, true); sh.segs[2].c1 = V(220, -10); sh.segs[2].c2 = V(250, -30);
  return sh;
}
const ang = (v) => Math.atan2(v.y, v.x);
const perim = (sh) => sh.segs.reduce((L, s, i) => L + segLen(sh, i), 0);

/* ---- typed lengths ---- */

test("Change Length on a straight segment: exact length, same direction, the other end stays", () => {
  reset();
  const sh = rectShape(0, 0, 100, 50);                        // seg 0: (0,0)→(100,0)
  assert.strictEqual(setSegLength(sh, 0, 137.5, 1, false), true);
  samePt(sh.pts[0], V(0, 0)); samePt(sh.pts[1], V(137.5, 0));
  near(segLen(sh, 0), 137.5, 1e-12);
  assert.strictEqual(setSegLength(sh, 1, 20, 0, false), true); // move seg 1's START point (which is pts[1])
  samePt(sh.pts[2], V(100, 50), "seg 1's end stays");
  near(segLen(sh, 1), 20, 1e-9);
  near(cross(sub(sh.pts[1], sh.pts[2]), sub(V(137.5, 0), V(100, 50))), 0, 1e-9, "still on the old line");
  assert.strictEqual(setSegLength(sh, 0, 0, 1, false), false, "zero length refused");
  assert.strictEqual(setSegLength(sh, 0, -5, 1, false), false);
});

test("Change Length on a curve, curve points free: exact arc length, same shape, neighbour's handle follows", () => {
  reset();
  const sh = curveShape(), L0 = segLen(sh, 1), was = clone(sh);
  assert.strictEqual(setSegLength(sh, 1, L0 * 1.25, 1, false), true);
  near(segLen(sh, 1), L0 * 1.25, 1e-9, "arc length");
  samePt(sh.pts[1], was.pts[1], "start stays");
  // a pure scale about the start: every handle is 1.25× as far from it, in the same direction
  for (const h of ["c1", "c2"]) samePt(sub(sh.segs[1][h], sh.pts[1]), mul(sub(was.segs[1][h], was.pts[1]), 1.25), h, 1e-9);
  const dv = sub(sh.pts[2], was.pts[2]);
  samePt(sh.segs[2].c1, add(was.segs[2].c1, dv), "next segment's near handle travels with the point");
  samePt(sh.segs[2].c2, was.segs[2].c2, "its far handle stays");
  samePt(sh.pts[3], was.pts[3]);
});

test("Change Length with Lock Curve Points: no handle moves, the length is still reached", () => {
  reset();
  const sh = curveShape(), L0 = segLen(sh, 1), was = clone(sh);
  for (const L of [L0 + 30, L0 - 25]) {
    const s2 = clone(was);
    assert.strictEqual(setSegLength(s2, 1, L, 1, true), true);
    near(segLen(s2, 1), L, 1e-6, "arc length " + L);
    for (const k of [1, 2]) for (const h of ["c1", "c2"]) samePt(s2.segs[k][h], was.segs[k][h], "handle " + k + h);
    samePt(s2.pts[1], was.pts[1]);
    near(cross(sub(s2.pts[2], was.pts[1]), sub(was.pts[2], was.pts[1])), 0, 1e-6, "the point stayed on the chord line");
  }
  // a length shorter than the locked handles allow is refused and nothing changes
  const s3 = clone(was);
  assert.strictEqual(setSegLength(s3, 1, 5, 1, true), false);
  assert.deepStrictEqual(s3, was);
});

test("Segment Length at a point: one length slides the point, two lengths meet where the circles cross", () => {
  reset();
  const sh = mkShape([V(0, 0), V(40, 30), V(100, 0), V(50, -80)], true);
  // only the previous segment (0→1, length 50): point 1 slides along it
  let s2 = clone(sh);
  assert.strictEqual(setPointLengths(s2, 1, 75, null, false), "");
  samePt(s2.pts[1], V(60, 45)); near(segLen(s2, 0), 75, 1e-9);
  // only the next segment (1→2): point 1 slides along that one, point 2 stays
  s2 = clone(sh);
  const L1 = segLen(sh, 1);
  assert.strictEqual(setPointLengths(s2, 1, null, L1 + 10, false), "");
  near(segLen(s2, 1), L1 + 10, 1e-9); samePt(s2.pts[2], sh.pts[2]);
  // both: a 3-4-5 triangle on the base (0,0)–(100,0) scaled ×20 → 60 and 80
  s2 = clone(sh);
  assert.strictEqual(setPointLengths(s2, 1, 60, 80, false), "");
  near(segLen(s2, 0), 60, 1e-9); near(segLen(s2, 1), 80, 1e-9);
  samePt(s2.pts[1], V(36, 48), "on the side the point was already on");
  samePt(s2.pts[0], sh.pts[0]); samePt(s2.pts[2], sh.pts[2]);
  // point 0 of a closed shape wraps to the last segment
  s2 = clone(sh);
  assert.strictEqual(setPointLengths(s2, 0, segLen(sh, 3) + 5, null, false), "");
  near(segLen(s2, 3), segLen(sh, 3) + 5, 1e-9); samePt(s2.pts[3], sh.pts[3]);
  // impossible and unsupported requests say why and change nothing
  s2 = clone(sh);
  assert.notStrictEqual(setPointLengths(s2, 1, 10, 20, false), "");
  setCurve(s2, 0, true);
  assert.ok(/curve/.test(setPointLengths(s2, 1, 60, 80, false)));
  assert.deepStrictEqual(s2.pts, sh.pts);
  assert.strictEqual(setPointLengths(s2, 1, null, null, false), "");
});

/* ---- curvature ---- */

test("Edit Curvature, free: the curve point follows the cursor exactly", () => {
  reset();
  const sh = curveShape(), [a, b] = [sh.pts[1], sh.pts[2]], s = sh.segs[1];
  for (const t of [0.2, 0.5, 0.8]) {
    const dv = V(7, -12), before = bez(a, s.c1, s.c2, b, t);
    const nh = bendSeg(a, s, b, t, dv, false);
    samePt(bez(a, nh.c1, nh.c2, b, t), add(before, dv), "t=" + t, 1e-9);
  }
});

test("Edit Curvature keeping handle angles: both end tangents are unchanged and the point still follows", () => {
  reset();
  const sh = curveShape(), [a, b] = [sh.pts[1], sh.pts[2]], s = sh.segs[1];
  const a1 = ang(sub(s.c1, a)), a2 = ang(sub(s.c2, b));
  for (const t of [0.25, 0.5, 0.7]) for (const dv of [V(4, 9), V(-6, 3), V(0, -8)]) {
    const before = bez(a, s.c1, s.c2, b, t), nh = bendSeg(a, s, b, t, dv, true);
    near(ang(sub(nh.c1, a)), a1, 1e-9, "c1 angle"); near(ang(sub(nh.c2, b)), a2, 1e-9, "c2 angle");
    samePt(bez(a, nh.c1, nh.c2, b, t), add(before, dv), "curve point t=" + t, 1e-9);
  }
  // a pull that would drag a handle through its anchor is clamped: the angle never flips
  const big = bendSeg(a, s, b, 0.5, V(0, -400), true);
  near(ang(sub(big.c1, a)), a1, 1e-9); near(ang(sub(big.c2, b)), a2, 1e-9);
  // parallel handles (a symmetric arc with vertical handles): angles kept, no blow-up
  const p = { c1: V(0, 60), c2: V(200, 60) }, par = bendSeg(V(0, 0), p, V(200, 0), 0.5, V(15, 20), true);
  near(par.c1.x, 0, 1e-9); near(par.c2.x, 200, 1e-9);
  assert.ok(par.c1.y > 60 && par.c1.y < 120 && par.c2.y > 60 && par.c2.y < 120, "handles lengthen moderately");
});

test("a handle dragged with Shift keeps its angle and only changes length", () => {
  const an = V(10, 10), h0 = V(40, 50);                       // direction (3,4)/5
  samePt(alongHandle(an, h0, V(100, 0)), add(an, mul(V(0.6, 0.8), dot(V(90, -10), V(0.6, 0.8)))));
  samePt(alongHandle(an, h0, V(-200, -200)), add(an, mul(V(0.6, 0.8), 0.5)), "never crosses the anchor");
  samePt(alongHandle(an, an, V(3, 4)), V(3, 4), "a zero-length handle is free");
});

/* ---- intersections ---- */

test("segment intersections: exact on straight lines, on the true curve for beziers", () => {
  reset();
  const A = line(V(0, 0), V(100, 100)), B = line(V(0, 80), V(100, 20));
  const [h] = segHits(A, 0, B, 0);
  samePt(h.p, V(50, 50), "crossing", 1e-9); near(h.t, 0.5, 1e-9); near(h.u, 0.5, 1e-9);
  assert.deepStrictEqual(segHits(A, 0, line(V(0, 10), V(100, 110)), 0), [], "parallel lines don't meet");
  assert.deepStrictEqual(segHits(A, 0, line(V(200, 0), V(300, 5)), 0), [], "apart");
  // a line across the curved hem: two crossings, each on both shapes
  const C = curveShape(), cut = line(V(-20, 20), V(240, 22));
  const hits = shapeHits(cut, C).filter(x => x.j === 1);
  assert.strictEqual(hits.length, 2);
  for (const x of hits) {
    samePt(segPt(C, 1, x.u), x.p, "on the curve", 1e-6);
    samePt(segPt(cut, 0, x.t), x.p, "on the line", 1e-9);
  }
  // curve against curve
  const D = mkShape([V(100, -60), V(100, 90)], false); setCurve(D, 0, true); D.segs[0].c1 = V(60, -10); D.segs[0].c2 = V(140, 40);
  const cc = shapeHits(D, C);
  assert.strictEqual(cc.length, 1);
  near(dist(segPt(D, 0, cc[0].t), segPt(C, cc[0].j, cc[0].u)), 0, 0.01, "both curves agree on the point");
  // a line through a corner is one hit, not one per segment
  const R = rectShape(0, 0, 100, 100);
  assert.strictEqual(shapeHits(line(V(-50, 50), V(150, 50)), R).length, 2);
  assert.strictEqual(shapeHits(line(V(-20, -20), V(30, 30)), R).length, 1, "through the corner (0,0)");
  assert.deepStrictEqual(shapeHits(R, R), []);
});

test("splitAt: several points on one segment land exactly, existing points are skipped, seams follow", () => {
  reset();
  const P = mkPiece("P", rectShape(0, 0, 200, 100)), Q = mkPiece("Q", rectShape(300, 0, 200, 100));
  S.pieces.push(P, Q);
  S.seams = [makeSeam([], { piece: P.id, sid: P.segs[0].id }, { piece: Q.id, sid: Q.segs[0].id })];
  const L = perim(P);
  const k = splitAt(P, [{ i: 0, t: 0.25 }, { i: 0, t: 0.75 }, { i: 0, t: 0.5 }, { i: 0, t: 0 }, { i: 0, t: 1 }, { i: 2, t: 0.5 }, { i: 0, t: 0.5 }]);
  assert.strictEqual(k, 4, "three on the top edge, one on the bottom; the corners and the duplicate are skipped");
  assert.deepStrictEqual(P.pts.slice(0, 5).map(q => q.x), [0, 50, 100, 150, 200]);
  samePt(P.pts[6], V(100, 100));
  near(perim(P), L, 1e-9);
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(S.seams[0].a[0].sids.length, 4, "the seam covers all four parts");
  near(seamInfo(S.seams[0], S.pieces).la, 200, 1e-9);
  // on a curve the points sit on the original curve
  const C = curveShape(), was = clone(C);
  splitAt(C, [{ i: 1, t: 0.3 }, { i: 1, t: 0.8 }]);
  samePt(C.pts[2], segPt(was, 1, 0.3), "first", 1e-9); samePt(C.pts[3], segPt(was, 1, 0.8), "second", 1e-9);
});

test("Add Point to Intersection: points appear on both shapes exactly where they meet", () => {
  reset();
  const P = mkPiece("P", rectShape(0, 0, 200, 300)); S.pieces.push(P);
  const a = P.internals[addChild(P, "internals", line(V(0, 100), V(200, 160)))];     // edge to edge, ends on the outline
  const b = P.internals[addChild(P, "internals", line(V(100, 20), V(100, 280)))];    // crosses a at (100,130)
  const c = P.bases[addChild(P, "bases", line(V(20, 250), V(180, 250)))];            // a base line crossing b
  const n0 = P.pts.length;
  assert.strictEqual(intersectPoints(P, a), 4, "two on the outline, one on b, one on a itself");
  assert.strictEqual(P.pts.length, n0 + 2);
  assert.ok(P.pts.some(q => dist(q, V(0, 100)) < 1e-9) && P.pts.some(q => dist(q, V(200, 160)) < 1e-9));
  assert.strictEqual(a.pts.length, 3); samePt(a.pts[1], V(100, 130));
  assert.strictEqual(b.pts.length, 3); samePt(b.pts[1], V(100, 130));
  assert.strictEqual(c.pts.length, 2, "shapes that a doesn't touch are left alone");
  assert.strictEqual(intersectPoints(P, a), 0, "a second run adds nothing");
  assert.strictEqual(intersectPoints(P, b), 2, "b meets the base line: one point each");
  samePt(c.pts[1], V(100, 250));
  for (const sh of [P, a, b, c]) assert.strictEqual(new Set(sh.segs.map(s => s.id)).size, sh.segs.length, "unique segment ids");
});

/* ---- extend / trim ---- */

test("Extend to the outline: an end inside the pattern runs straight on until it meets the edge", () => {
  reset();
  const P = mkPiece("P", rectShape(0, 0, 200, 300));
  const ln = line(V(50, 100), V(90, 130));                    // direction (4,3)
  assert.strictEqual(extendTrim(ln, 1, [P], P), "extend");
  samePt(ln.pts[1], V(200, 212.5), "meets the right edge", 1e-9);
  samePt(ln.pts[0], V(50, 100));
  assert.strictEqual(extendTrim(ln, 0, [P], P), "extend");
  samePt(ln.pts[0], V(0, 62.5), "the other end meets the left edge", 1e-9);
  assert.strictEqual(ln.pts.length, 2, "a straight end is lengthened, no point added");
  assert.strictEqual(extendTrim(ln, 1, [P], P), null, "already on the outline: nothing to do");
  assert.strictEqual(extendTrim(ln, 0, [P], P), null);
  assert.strictEqual(nearEnd(ln, 0, 0.9), 1); assert.strictEqual(nearEnd(ln, 0, 0.2), 0);
});

test("Trim to the outline: an end outside the pattern is cut back to the nearest crossing", () => {
  reset();
  const P = mkPiece("P", rectShape(0, 0, 200, 300));
  const ln = line(V(-40, 150), V(60, 150), V(260, 250));      // starts outside left, ends outside right
  const id1 = ln.segs[1].id;
  assert.strictEqual(extendTrim(ln, 1, [P], P), "trim");
  samePt(ln.pts[2], V(200, 220), "cut at the right edge", 1e-9);
  assert.strictEqual(ln.segs[1].id, id1, "the kept part keeps its id");
  assert.strictEqual(extendTrim(ln, 0, [P], P), "trim");
  samePt(ln.pts[0], V(0, 150), "cut at the left edge", 1e-9);
  assert.strictEqual(ln.pts.length, 3);
  // a line that leaves and re-enters: only the tail beyond the LAST crossing goes
  const zig = line(V(100, 50), V(250, 50), V(250, 100), V(100, 100), V(100, 200), V(300, 200));
  assert.strictEqual(extendTrim(zig, 1, [P], P), "trim");
  samePt(zig.pts[zig.pts.length - 1], V(200, 200)); assert.strictEqual(zig.pts.length, 6);
  // wholly outside with no crossing, or a closed shape: nothing happens
  assert.strictEqual(extendTrim(line(V(300, 0), V(400, 0)), 1, [P], P), null);
  assert.strictEqual(extendTrim(rectShape(10, 10, 20, 20), 1, [P], P), null);
});

test("Extend/Trim on curves: a trimmed curve keeps its shape, an extended one continues along its tangent", () => {
  reset();
  const P = mkPiece("P", rectShape(0, 0, 200, 300));
  const c = mkShape([V(40, 60), V(260, 200)], false);
  setCurve(c, 0, true); c.segs[0].c1 = V(120, 40); c.segs[0].c2 = V(200, 120);
  const was = clone(c);
  assert.strictEqual(extendTrim(c, 1, [P], P), "trim");
  near(c.pts[1].x, 200, 1e-6, "end on the right edge");
  assert.strictEqual(c.segs.length, 1); assert.ok(c.segs[0].curved);
  // the kept part is the original up to parameter k, so its handle is k× the original's
  const k = dist(c.segs[0].c1, c.pts[0]) / dist(was.segs[0].c1, was.pts[0]);
  for (const x of [0.25, 0.5, 1]) samePt(segPt(c, 0, x), segPt(was, 0, k*x), "retraces the original at " + x, 1e-9);
  // extend the other (inside) end: a straight piece is added, tangent to the curve
  const tan0 = segTan(was, 0, 0);
  assert.strictEqual(extendTrim(c, 0, [P], P), "extend");
  assert.strictEqual(c.segs.length, 2); assert.strictEqual(c.segs[0].curved, false);
  near(distToShape(P, c.pts[0]), 0, 1e-9, "new end on the outline");
  near(cross(sub(c.pts[1], c.pts[0]), tan0), 0, 1e-6, "collinear with the curve's start tangent");
  samePt(c.pts[1], was.pts[0], "the curve itself is untouched");
  assert.strictEqual(new Set(c.segs.map(s => s.id)).size, 2);
  // against a curved outline the end lands on the curve
  const E = mkPiece("E", ellipseShape(100, 100, 100, 80)), r = line(V(100, 100), V(120, 110));
  assert.strictEqual(extendTrim(r, 1, [E], E), "extend");
  near(distToShape(E, r.pts[1]), 0, 0.01);                   // distToShape measures to 64 chords per curve, hence the tolerance
  near(cross(sub(r.pts[1], V(100, 100)), V(20, 10)), 0, 1e-6);
  const [eh] = shapeHits(line(V(100, 100), V(400, 250)), E);
  samePt(r.pts[1], eh.p, "exactly where the line meets the true curve", 1e-9);
  samePt(segPt(E, eh.j, eh.u), eh.p, "which is on the bezier itself", 1e-9);
});

test("Extend/Trim to an internal line: trims at a crossing, otherwise extends to the first line it meets", () => {
  reset();
  const wall = line(V(150, 0), V(150, 300)), far = line(V(180, 0), V(180, 300));
  const short = line(V(20, 100), V(100, 100));
  assert.strictEqual(extendTrim(short, 1, [short, far, wall], null), "extend");
  samePt(short.pts[1], V(150, 100), "stops at the nearer line", 1e-9);
  assert.strictEqual(extendTrim(short, 0, [short, far, wall], null), null, "nothing behind the start");
  const long = line(V(20, 200), V(190, 200));                 // crosses both
  assert.strictEqual(extendTrim(long, 1, [long, wall, far], null), "trim");
  samePt(long.pts[1], V(180, 200), "trimmed at the crossing nearest that end", 1e-9);
  assert.strictEqual(extendTrim(long, 1, [long, wall, far], null), null, "its end is now on a target");
  assert.strictEqual(extendTrim(line(V(0, 0), V(10, 0)), 1, [], null), null);
});

test("trimming a sewn internal line keeps the seam on what is left", () => {
  reset();
  const P = mkPiece("P", rectShape(0, 0, 200, 300)), Q = mkPiece("Q", rectShape(400, 0, 100, 100));
  S.pieces.push(P, Q);
  const ln = P.internals[addChild(P, "internals", line(V(-50, 150), V(250, 150)))];
  S.seams = [makeSeam([], { piece: P.id, shape: ln.id, sid: ln.segs[0].id }, { piece: Q.id, sid: Q.segs[0].id })];
  extendTrim(ln, 0, [P], P); extendTrim(ln, 1, [P], P);
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(S.seams.length, 1);
  near(seamInfo(S.seams[0], S.pieces).la, 200, 1e-9, "the seam is now the trimmed length");
});

/* ---- offsets ---- */

test("offsetSeg: a straight segment is exactly parallel; a curve stays within 0.06 mm of a true parallel", () => {
  reset();
  const sh = line(V(0, 0), V(30, 40));                        // unit normal to the right = (0.8, -0.6)
  const o = offsetSeg(sh, 0, 10);
  samePt(o.pts[0], V(8, -6)); samePt(o.pts[1], V(38, 34));
  samePt(offsetSeg(sh, 0, -10).pts[0], V(-8, 6), "negative = the other side");
  samePt(offsetSeg(sh, 0, -10).pts[1], V(22, 46));
  // true distance from a point to a curved segment, by dense sampling
  const toCurve = (sh, i, q) => { let b = Infinity; for (let j = 0; j <= 4000; j++) b = Math.min(b, dist(q, segPt(sh, i, j/4000))); return b; };
  const arm = mkShape([V(188, 42), V(150, 220)], false); setCurve(arm, 0, true); arm.segs[0].c1 = V(196, 120); arm.segs[0].c2 = V(186, 190);
  const neck = mkShape([V(0, 0), V(68, 12)], false); setCurve(neck, 0, true); neck.segs[0].c1 = V(6, 30); neck.segs[0].c2 = V(40, 26);
  const C = curveShape();
  for (const [name, src, i, ds] of [["hem", C, 1, [10, -10, 25, 60]], ["armhole", arm, 0, [10, -15, 40]], ["neckline", neck, 0, [10, -10, -25]]]) for (const d of ds) {
    const oc = offsetSeg(src, i, d), m = oc.segs.length;
    assert.ok(oc.segs.every(s => s.curved) && m <= 16, name + " " + d + ": " + m + " curved pieces");
    for (let k = 0; k < m; k++) for (let j = 0; j <= 10; j++)
      near(toCurve(src, i, segPt(oc, k, j/10)), Math.abs(d), 0.06, name + " d=" + d + " piece " + k + " at " + j/10);
    near(dot(segTan(oc, 0, 0), segTan(src, i, 0)), 1, 1e-6, "same start tangent");
    near(dot(segTan(oc, m-1, 1), segTan(src, i, 1)), 1, 1e-6, "same end tangent");
    for (let k = 1; k < m; k++) near(dot(segTan(oc, k-1, 1), segTan(oc, k, 0)), 1, 1e-6, "pieces join smoothly");
    assert.strictEqual(new Set(oc.segs.map(s => s.id)).size, m);
  }
});

test("Offset as Internal Line: count lines, evenly spaced, inward whichever way the outline is drawn", () => {
  reset();
  for (const pts of [[V(0,0), V(200,0), V(200,300), V(0,300)], [V(0,0), V(0,300), V(200,300), V(200,0)]]) {
    const P = mkPiece("P", mkShape(pts, true)), poly = flatten(P, 8);
    for (let i = 0; i < 4; i++) {
      const lines = offsetLines(P, P, i, 15, 3, false, false);
      assert.strictEqual(lines.length, 3);
      lines.forEach((ln, k) => {
        const mid = segPt(ln, 0, 0.5);
        assert.ok(inside(poly, mid), "edge " + i + " line " + k + " is inside");
        near(distToShape({ pts: G.sEnds(P, i), segs: [P.segs[i]], closed: false }, mid), 15*(k+1), 1e-9, "spacing");
        assert.strictEqual(ln.closed, false);
      });
      assert.ok(!inside(poly, segPt(offsetLines(P, P, i, 15, 1, true, false)[0], 0, 0.5)), "reverse goes outward");
    }
  }
  // an internal line offsets to one side; reverse gives the other
  const P = mkPiece("P", rectShape(0, 0, 200, 300)), ln = line(V(50, 50), V(50, 250));
  near(offsetLines(P, ln, 0, 20, 1, false, false)[0].pts[0].x, 70, 1e-9);
  near(offsetLines(P, ln, 0, 20, 2, true, false)[1].pts[0].x, 10, 1e-9);
  const ids = offsetLines(P, P, 0, 10, 4, false, false).map(l => l.segs[0].id);
  assert.strictEqual(new Set(ids).size, 4, "every new line has its own segment id");
});

test("Offset with Extend to outline: both ends of each line finish on the outline", () => {
  reset();
  // a trapezoid: offsetting the slanted side inward leaves one end short and one end over
  const P = mkPiece("P", mkShape([V(0, 0), V(200, 0), V(260, 300), V(0, 300)], true));
  for (let i = 0; i < 4; i++) for (const ln of offsetLines(P, P, i, 20, 3, false, true)) {
    near(distToShape(P, ln.pts[0]), 0, 1e-6, "edge " + i + " start on outline");
    near(distToShape(P, ln.pts[ln.pts.length-1]), 0, 1e-6, "edge " + i + " end on outline");
    assert.ok(inside(flatten(P, 8), segPt(ln, 0, 0.5)));
    assert.strictEqual(ln.pts.length, 2, "still one straight line");
  }
  // without the option the line is just the moved edge, same length
  near(segLen(offsetLines(P, P, 0, 20, 1, false, false)[0], 0), 200, 1e-9);
  // a curved edge of the starter-like bodice: ends land on the outline too
  const B = mkPiece("B", mkShape([V(0,0), V(68,12), V(188,42), V(150,220), V(168,480), V(0,495)], true));
  setCurve(B, 2, true); B.segs[2].c1 = V(196,120); B.segs[2].c2 = V(186,190);
  const [arm] = offsetLines(B, B, 2, 15, 1, false, true);
  near(distToShape(B, arm.pts[0]), 0, 1e-3); near(distToShape(B, arm.pts[arm.pts.length-1]), 0, 1e-3);
});

test("Offset Outline: closed shapes, each inside the last", () => {
  reset();
  const P = mkPiece("P", rectShape(0, 0, 200, 300));
  const rings = offsetOutline(P, 10, 3, false);
  assert.strictEqual(rings.length, 3);
  rings.forEach((r, k) => {
    assert.strictEqual(r.closed, true);
    const xs = r.pts.map(q => q.x), ys = r.pts.map(q => q.y);
    near(Math.min(...xs), 10*(k+1), 1e-9); near(Math.max(...xs), 200 - 10*(k+1), 1e-9);
    near(Math.min(...ys), 10*(k+1), 1e-9); near(Math.max(...ys), 300 - 10*(k+1), 1e-9);
  });
  near(Math.min(...offsetOutline(P, 10, 1, true)[0].pts.map(q => q.x)), -10, 1e-9, "reverse goes outward");
});

/* ---- internal ↔ baseline ---- */

test("Convert to Baseline and back: same shape and id; a seam on it is dropped (baselines can't be sewn)", () => {
  reset();
  const P = mkPiece("P", rectShape(0, 0, 200, 300)), Q = mkPiece("Q", rectShape(400, 0, 100, 100));
  S.pieces.push(P, Q);
  addChild(P, "internals", line(V(10, 10), V(20, 20)));
  const ln = P.internals[addChild(P, "internals", line(V(20, 100), V(120, 100)))], id = ln.id;
  S.seams = [makeSeam([], { piece: P.id, shape: id, sid: ln.segs[0].id }, { piece: Q.id, sid: Q.segs[0].id })];
  assert.strictEqual(convertChild(P, "internals", 1), 0);
  assert.strictEqual(P.bases[0], ln); assert.strictEqual(ln.id, id); assert.strictEqual(P.internals.length, 1);
  assert.deepStrictEqual(resolveRefs(S.pieces, S.seams.map(clone)), [], "the seam goes");
  assert.strictEqual(convertChild(P, "bases", 0), 1);
  assert.strictEqual(P.internals[1], ln); assert.strictEqual(P.bases.length, 0);
  assert.strictEqual(resolveRefs(S.pieces, S.seams).length, 1, "converted back before the seam was pruned: it still resolves");
});

module.exports = T;
