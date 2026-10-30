// Phase 5: seam-allowance corner types, the dart cap in the cut line, notch settings and
// notch marks, Add Notch to Intersection.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null };
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", "normGuides", "mkAnchor", "anchorAt", "measureInfo", "validMeasures", "affOf", "affApply", "affMul", "syncHalf", "mkLinked", 
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "flattenSA",
  "signedArea", "outN", "lineX", "offsetVar", "CORNERS", "cornerPts", "setCorner", "cornerOf", "cornerMirror", "cornerMigrate", "cornerStart", "cornerLine1", "cutLine", "inside", "pieceWind", "reflectAcross", "reflector",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "addChild",
  "setCurve", "mkShape", "rectShape", "mkPiece", "normProps", "mapPiece", "unfold",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "validSeams", "makeSeam", "loadSeams", "resolveRefs", "migrate", "alignMirrorIds",
  "cross", "dot", "blankSeg", "segChords", "bisect", "segHits", "shapeHits", "splitAt",
  "locateOn", "polyCentroid", "chainIdx", "slashSpread",
  "dartGeom", "addDartTo", "nearIdx", "rotateDart",
  "NOTCH_DEFAULT", "normNotch", "notchMarks", "notchIntersections", "loadDoc",
], { S });
const { V, sub, add, mul, dist, segPt, flatten, flattenSA, signedArea, offsetVar, CORNERS, cornerPts, setCorner, cornerOf, cornerMirror, cornerMigrate, cornerStart, cornerLine1, cutLine, inside, reflectAcross,
  setCurve, mkShape, rectShape, mkPiece, addChild, unfold, cross, dot, dartGeom, addDartTo, rotateDart, NOTCH_DEFAULT, normNotch, notchMarks,
  notchIntersections, loadDoc } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.notch = { ...NOTCH_DEFAULT }; }
const unit = (x, y) => { const L = Math.hypot(x, y); return V(x/L, y/L); };
const offLine = (q, a, d) => Math.abs(cross(d, sub(q, a)))/Math.hypot(d.x, d.y);     // distance from q to the line through a along d
const area = (poly) => Math.abs(signedArea(poly));
// distance from q to a closed polygon's boundary
const toPoly = (poly, q) => Math.min(...poly.map((a, i) => { const b = poly[(i+1) % poly.length], r = sub(b, a), L2 = dot(r, r) || 1, t = Math.min(1, Math.max(0, dot(sub(q, a), r)/L2)); return dist(q, V(a.x + r.x*t, a.y + r.y*t)); }));

// A corner at the origin. The incoming edge runs along +x and the outgoing edge turns
// toward +y (down the screen), so with wind = 1 the outside is up and to the right.
const P = V(0, 0), uA = V(1, 0);
const corner = (type, uB, dA, dB, r) => cornerPts(P, uA, uB, dA, dB, 1, type === "default" ? undefined : { t: type, r });

/* ---- corner types ---- */

// (Round r15 / 3: the corner types are the reference's eight now; the old names are still read, as an old file's history holds
// them: default and extend are Extension, perp1 / perp2 Perpendicular, mirror Turnback, unfilled Slant)
test("corner types on a square corner: all the meeting types give the same point; unfilled and round do not", () => {
  const down = V(0, 1), M = V(15, -10);                        // dA = 10 (up), dB = 15 (right)
  for (const t of ["default", "extend", "perp1", "perp2", "mirror", "ext", "perp", "turn"]) {
    const pts = corner(t, down, 10, 15);
    assert.ok(pts.some(q => dist(q, M) < 1e-9), t + " reaches the corner point " + JSON.stringify(pts));
    for (const q of pts) assert.ok(Math.abs(q.y + 10) < 1e-9 || Math.abs(q.x - 15) < 1e-9, t + " stays on the two offset lines");
  }
  assert.deepStrictEqual(corner("right", down, 10, 15), [V(0, -10), V(15, -10), V(15, -10), V(15, 0)]);
  assert.deepStrictEqual(corner("unfilled", down, 10, 15), [V(0, -10), V(15, 0)]);
  assert.deepStrictEqual(corner("default", down, 0, 0), [V(0, 0)], "no allowance: the point itself");
  assert.deepStrictEqual(corner("default", down, 10, 0), [V(0, -10)], "allowance on one edge only: it ends on the other edge's line");
  assert.strictEqual(CORNERS.length, 8);
});

test("Round corner: an arc about the point, or rounded by a length", () => {
  const arc = corner("round", V(0, 1), 10, 10);
  assert.strictEqual(arc.length, 9);
  samePt(arc[0], V(0, -10)); samePt(arc[8], V(10, 0));
  for (const q of arc) near(dist(q, P), 10, 1e-9, "on the circle");
  samePt(arc[4], V(10*Math.SQRT1_2, -10*Math.SQRT1_2), "midway");
  const uneven = corner("round", V(0, 1), 10, 20);
  samePt(uneven[0], V(0, -10)); samePt(uneven[8], V(20, 0)); near(dist(uneven[4], P), 15, 1e-9, "radius grows evenly");
  const byLen = corner("round", V(0, 1), 10, 10, 4);
  samePt(byLen[0], V(6, -10), "starts 4 before the corner"); samePt(byLen[8], V(10, -6), "ends 4 after it");
  assert.ok(byLen.every(q => q.x <= 10 + 1e-9 && q.y >= -10 - 1e-9), "inside the pointed corner");
  near(dist(byLen[4], V(10, -10)), Math.SQRT2, 1e-9, "the middle of the curve is √2 from the corner (a quarter of the way along each 4 mm)");
  samePt(corner("round", V(0, 1), 10, 10, 99)[0], V(0, -10), "a length longer than the corner is clamped");
});

// (Round r15 / 3: Extend Edge of the old set ran on however far; the reference's set has no such type, so an old Extend Edge is an
// Extension now, which cuts a spike straight across as the default always did. This test said Extend Edge ran on to the point.)
test("Extension cuts a very sharp corner straight across; an old Extend Edge is an Extension now", () => {
  const back = unit(-1, 0.12);                                 // the outgoing edge doubles back: a spike
  const d = corner("default", back, 10, 10), e = corner("extend", back, 10, 10);
  assert.strictEqual(d.length, 2, "bevelled"); samePt(d[0], V(0, -10));
  assert.deepStrictEqual(e, d, "Extend Edge is Extension");
  assert.deepStrictEqual(corner("ext", back, 10, 10), d);
  // a gentler corner: the true meeting point
  samePt(corner("default", unit(0.3, 1), 10, 10)[0], corner("extend", unit(0.3, 1), 10, 10)[0]);
});

test("Mirror: the seam's cut line, mirrored in the hem's fold line, is the end of the hem allowance", () => {
  // incoming edge = hem (allowance 40), outgoing edge = a side seam leaning out (allowance 10)
  for (const [uB, dA, dB] of [[unit(0.35, 1), 40, 10], [unit(-0.3, 1), 40, 10], [unit(0.2, 1), 25, 10]]) {
    const [x1, x0] = corner("mirror", uB, dA, dB);
    const nB = V(uB.y, -uB.x), b0 = add(P, mul(nB, dB));
    near(offLine(x0, P, uA), 0, 1e-9, "x0 is on the hem's fold line");
    near(offLine(x0, b0, uB), 0, 1e-9, "x0 is on the side seam's cut line");
    near(offLine(x1, V(0, -dA), uA), 0, 1e-9, "x1 is on the hem's cut line");
    // folding the hem up along its fold line puts x1 exactly on the side seam's cut line
    near(offLine(reflectAcross(x1, P, add(P, uA)), b0, uB), 0, 1e-9, "the hem's end folds onto the seam's cut line");
  }
  // the hem can be the outgoing edge instead: the larger allowance decides
  const uB = unit(0.35, 1), [y0, y1] = corner("mirror", uB, 10, 40);
  near(offLine(y0, P, uB), 0, 1e-9, "on the outgoing (hem) fold line"); near(offLine(y0, V(0, -10), uA), 0, 1e-9, "and on the incoming edge's cut line");
  near(offLine(reflectAcross(y1, P, add(P, uB)), V(0, -10), uA), 0, 1e-9);
});

test("Perpendicular 1 and 2: the allowance ends square to one edge, starting where the other's cut line meets it", () => {
  const uB = unit(0.4, 1), nB = V(uB.y, -uB.x), b0 = add(P, mul(nB, 10));
  const [p1, p0] = corner("perp1", uB, 30, 10);                // square across the incoming edge's allowance (30)
  near(offLine(p0, P, uA), 0, 1e-9, "starts on the incoming edge's seam line"); near(offLine(p0, b0, uB), 0, 1e-9, "where the other cut line meets it");
  near(p1.x, p0.x, 1e-9, "square to the edge"); near(p1.y, -30, 1e-9, "across the whole allowance");
  const [q0, q1] = corner("perp2", uB, 30, 10);                // square across the outgoing edge's allowance (10)
  near(offLine(q0, P, uB), 0, 1e-9, "starts on the outgoing edge's seam line"); near(q0.y, -30, 1e-9, "on the incoming cut line");
  near(dot(sub(q1, q0), uB), 0, 1e-9, "square to the outgoing edge"); near(dist(q0, q1), 10, 1e-9);
});

test("Right Angled on a sharp corner is blunt; inside corners always use the default", () => {
  const uB = unit(-0.6, 1), pts = corner("right", uB, 10, 10);
  assert.strictEqual(pts.length, 4);
  near(dist(pts[0], pts[1]), 10, 1e-9, "the incoming allowance is carried on by the other one's width");
  near(dist(pts[2], pts[3]), 10, 1e-9);
  assert.ok(dist(pts[1], P) < dist(corner("extend", uB, 10, 10)[0], P), "blunter than the full point");
  const inner = V(0, -1);                                      // turns toward the outside: an inside corner
  for (const [t] of CORNERS) assert.deepStrictEqual(cornerPts(P, uA, inner, 10, 10, 1, { t }), cornerPts(P, uA, inner, 10, 10, 1), t + " on an inside corner");
});

/* ---- Round r15 / 3: the reference's eight corner types ---- */

test("r15 / 3: the eight types in the reference's order; Perpendicular: Distance past the corner along its line, then square across; Reverse square to the other line", () => {
  assert.deepStrictEqual(CORNERS.map(c => c[1]), ["Extension", "Perpendicular", "Turnback", "Slant", "Round", "Envelope", "Dart Cap", "Pocket"]);
  const uB = unit(0.4, 1), nB = V(uB.y, -uB.x), b0 = add(P, mul(nB, 10));
  // on the incoming line (allowance 30), no Distance: as Perpendicular 1 was
  assert.deepStrictEqual(cornerPts(P, uA, uB, 30, 10, 1, { t: "perp", on: "in" }), corner("perp1", uB, 30, 10));
  assert.deepStrictEqual(cornerPts(P, uA, uB, 30, 10, 1, { t: "perp", on: "out" }), corner("perp2", uB, 30, 10));
  // Distance 20: the incoming seam line carried on 20 past P, then square up across its allowance (30)
  const [e, E, q] = cornerPts(P, uA, uB, 30, 10, 1, { t: "perp", on: "in", d: 20 });
  samePt(E, V(20, 0), "20 past the corner on the seam line"); samePt(e, V(20, -30), "square across the allowance");
  near(offLine(q, P, uA), 0, 1e-9, "the other cut line still meets the seam line"); near(offLine(q, b0, uB), 0, 1e-9);
  // Reverse: square to the outgoing line instead, out to the incoming cut line
  const r = cornerPts(P, uA, uB, 30, 10, 1, { t: "perp", on: "in", d: 20, rev: true });
  near(r[0].y, -30, 1e-9, "on the incoming cut line"); near(dot(sub(r[0], r[1]), uB), 0, 1e-9, "square to the outgoing line");
  // a square corner: Perpendicular with its Distance at the allowance is the plain corner (the check videos' frame)
  const sq = cornerPts(P, uA, V(0, 1), 10, 10, 1, { t: "perp", on: "out", d: 10 });
  samePt(sq[sq.length - 1], V(10, -10)); assert.ok(sq.every(q => Math.abs(q.y + 10) < 1e-9 || Math.abs(q.x - 10) < 1e-9), "on the two cut lines");
});

test("r15 / 3: Turnback on the chosen hem line; Extension moves the fold line out; with no line, the deeper allowance is the hem as Mirror was", () => {
  const uB = unit(0.35, 1);
  assert.deepStrictEqual(cornerPts(P, uA, uB, 40, 10, 1, { t: "turn" }), corner("mirror", uB, 40, 10));
  assert.deepStrictEqual(cornerPts(P, uA, uB, 40, 10, 1, { t: "turn", on: "in" }), corner("mirror", uB, 40, 10));
  const [x1, x0] = cornerPts(P, uA, uB, 40, 10, 1, { t: "turn", on: "in", e: 5 });
  near(offLine(x0, V(0, -5), uA), 0, 1e-9, "the fold line 5 out"); near(offLine(reflectAcross(x1, V(0, -5), V(1, -5)), add(P, mul(V(uB.y, -uB.x), 10)), uB), 0, 1e-9, "folded about it, onto the seam's cut line");
  const [y0, y1] = cornerPts(P, uA, uB, 40, 10, 1, { t: "turn", on: "out" });
  near(offLine(y0, P, uB), 0, 1e-9, "the hem chosen: the outgoing line, though its allowance is the smaller"); assert.ok(y1);
});

test("r15 / 3: Slant is straight across; Envelope cuts the corner square to its middle at Distance from the point; Pocket cuts a step (Style 1) or a slant (Style 2) at A' / B'", () => {
  const down = V(0, 1);
  assert.deepStrictEqual(cornerPts(P, uA, down, 10, 10, 1, { t: "slant" }), [V(0, -10), V(10, 0)]);
  // Envelope: the check videos' frame, 10 mm allowances and Distance 4: the cut 4 from the corner, across its middle
  const env = cornerPts(P, uA, down, 10, 10, 1, { t: "env", d: 4 });
  assert.strictEqual(env.length, 2);
  for (const q of env) near((q.x - q.y)/Math.SQRT2, 4, 1e-9, "4 from P along the corner's middle");
  near(env[0].y, -10, 1e-9, "from the incoming cut line"); near(env[1].x, 10, 1e-9, "to the outgoing one");
  assert.ok(env[0].x < 0, "nearer than the allowance's width: the cut starts before the corner, as in the frame");
  const env8 = cornerPts(P, uA, down, 10, 10, 1, { t: "env", d: 10 });
  assert.ok(env8[0].x > 0 && env8[0].x < 10, "further out: between the slant and the mitre point");
  assert.deepStrictEqual(cornerPts(P, uA, down, 10, 10, 1, { t: "env", d: 20 }), [V(10, -10)], "past the mitre point: the plain corner");
  assert.deepStrictEqual(cornerPts(P, uA, down, 10, 10, 1, { t: "env" }), env, "4 mm when none is given");
  // Pocket: the frame's step, 5 and 5 on 10 mm allowances
  assert.deepStrictEqual(cornerPts(P, uA, down, 10, 10, 1, { t: "pocket", din: 5, dout: 5 }), [V(5, -10), V(5, -5), V(10, -5)]);
  // (Round r25, session 3 Number 12: Style 2 is a step and then a 45° cut, not a straight cut: from the incoming cut line down to
  // the step's corner, then at 45° out to the outgoing cut line)
  assert.deepStrictEqual(cornerPts(P, uA, down, 10, 10, 1, { t: "pocket", din: 5, dout: 3, st: 2 }).map(q => [+q.x.toFixed(9), +q.y.toFixed(9)]), [[3, -10], [3, -5], [10, 2]]);
  assert.deepStrictEqual(cornerPts(P, uA, down, 10, 10, 1, { t: "pocket", din: 12, dout: 5 }), [V(10, -10)], "deeper than the allowance: the plain corner");
  // Dart Cap is not built: drawn as Extension
  assert.deepStrictEqual(cornerPts(P, uA, down, 10, 10, 1, { t: "dartcap" }), [V(10, -10)]);
});

test("r15 / 3: the old names as a file opens (cornerMigrate): renamed, Right Angled an Envelope through its cut's middle; the mirror image swaps a corner's lines; Line 1 is the line before the point going round against the screen's clock", () => {
  reset();
  const p = mkPiece("Old", mkShape([V(0, 0), V(200, 0), V(200, 300), V(0, 300)], true));      // clockwise on the screen (y down)
  p.segs.forEach(s => s.sa = 10);
  const olds = ["default", "perp1", "mirror", "right"];
  p.segs.forEach((s, i) => s.corner = { t: olds[i] });
  const before = cutLine(p);
  cornerMigrate(p);
  assert.deepStrictEqual(p.segs.map(s => s.corner), [undefined, { t: "perp", on: "in" }, { t: "turn" }, { t: "env", d: +(10*Math.SQRT2).toFixed(3) }]);
  const after = cutLine(p);
  for (const q of before) near(toPoly(after, q), 0, 1e-3, "the cut line is where it was: " + JSON.stringify(q));
  for (const q of after) near(toPoly(before, q), 0, 1e-3, "and nothing else: " + JSON.stringify(q));
  p.segs[0].corner = { t: "unfilled" }; p.segs[1].corner = { t: "extend" }; cornerMigrate(p);
  assert.deepStrictEqual([p.segs[0].corner, p.segs[1].corner], [{ t: "slant" }, undefined]);
  assert.deepStrictEqual(cornerMirror({ t: "pocket", st: 2, din: 3, dout: 7 }), { t: "pocket", st: 2, din: 7, dout: 3 });
  assert.deepStrictEqual(cornerMirror({ t: "perp", on: "in", d: 10 }), { t: "perp", on: "out", d: 10 });
  assert.deepStrictEqual(cornerMirror({ t: "perp1" }), { t: "perp", on: "out" });
  // (Round r25, the third check session Number 15: Line 1 is the line coming into the point in the outline's order, whichever way
  // the outline runs; before, it was worked out from the screen and was the right side, the line leaving the point, here)
  assert.strictEqual(cornerLine1(p), "in", "at the top right corner of a clockwise rectangle Line 1 is the top line, the line coming in");
  const q = mkPiece("Back", mkShape([V(0, 0), V(0, 300), V(200, 300), V(200, 0)], true));
  assert.strictEqual(cornerLine1(q), "in");
  // (Round r25: Slant starts at Distance A / B 10 / 10, session 3 Number 12)
  assert.deepStrictEqual([cornerStart(p, 1, "perp"), cornerStart(p, 1, "env"), cornerStart(p, 1, "pocket"), cornerStart(p, 1, "slant")], [{ on: "in" }, { d: 4 }, { st: 1, din: 5, dout: 5 }, { a: 10, b: 10 }]);
  setCorner(p.segs[1], "pocket", { st: 7, din: 2, dout: -1 }); assert.deepStrictEqual(p.segs[1].corner, { t: "pocket", st: 1, din: 2 }, "junk values left out");
  setCorner(p.segs[1], "ext"); assert.strictEqual(p.segs[1].corner, undefined, "Extension is stored as no corner");
  assert.strictEqual(cornerOf({ t: "nonsense" }), null);
});

/* ---- the cut line ---- */

test("cutLine: an even allowance on a rectangle is the rectangle grown by it, whichever way it was drawn", () => {
  reset();
  for (const pts of [[V(0,0), V(200,0), V(200,300), V(0,300)], [V(0,0), V(0,300), V(200,300), V(200,0)]]) {
    const p = mkPiece("P", mkShape(pts, true));
    p.segs.forEach(s => s.sa = 10);
    const c = cutLine(p);
    assert.strictEqual(c.length, 4);
    near(area(c), 220*320, 1e-6);
    for (const q of c) assert.ok(Math.abs(Math.abs(q.x - 100) - 110) < 1e-9 && Math.abs(Math.abs(q.y - 150) - 160) < 1e-9, JSON.stringify(q));
  }
  // a different allowance on each edge, and none on one
  const p = mkPiece("P", rectShape(0, 0, 200, 300));
  [10, 20, 40, 0].forEach((d, i) => p.segs[i].sa = d);
  const c = cutLine(p), xs = c.map(q => q.x), ys = c.map(q => q.y);
  assert.deepStrictEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [0, 220, -10, 340]);
});

test("cutLine matches the previous construction on a curved bodice (default corners)", () => {
  reset();
  const p = mkPiece("Bodice", mkShape([V(0,0), V(68,12), V(188,42), V(150,220), V(168,480), V(0,495)], true));
  setCurve(p, 0, true); p.segs[0].c1 = V(6,30); p.segs[0].c2 = V(40,26);
  setCurve(p, 2, true); p.segs[2].c1 = V(196,120); p.segs[2].c2 = V(186,190);
  setCurve(p, 4, true); p.segs[4].c1 = V(120,492); p.segs[4].c2 = V(60,500);
  p.segs.forEach((s, i) => s.sa = i === 5 ? 0 : 10);
  const f = flattenSA(p), old = offsetVar(f.pts, f.ds), now = cutLine(p);
  // The one real difference: at the sharp neck / centre-front corner the new corner uses the curve's
  // true direction at the point, the old one used its first chord, so the spike's tip moves along x = 0.
  const tip = now.find(q => q.y < -30), oldTip = old.find(q => q.y < -30);
  near(tip.x, 0, 1e-9); near(oldTip.x, 0, 1e-9); assert.ok(Math.abs(tip.y - oldTip.y) < 12);
  for (const q of now) if (q !== tip) near(toPoly(old, q), 0, 0.2, "new vertex on the old cut line");
  for (const q of old) if (q !== oldTip) near(toPoly(now, q), 0, 0.2, "old vertex on the new cut line");
  near(area(now), area(old), 60, "same area but for the spike");
});

test("corner types change the cut line at their own point only", () => {
  reset();
  const p = mkPiece("Skirt", mkShape([V(40, 0), V(160, 0), V(200, 300), V(0, 300)], true));   // 2 = hem, 1 and 3 = side seams
  p.segs[1].sa = 10; p.segs[2].sa = 40; p.segs[3].sa = 10; p.segs[0].sa = 10;
  const base = cutLine(p);
  setCorner(p.segs[2], "mirror");                              // the corner at (200,300): side seam → hem
  setCorner(p.segs[3], "mirror");                              // the corner at (0,300): hem → side seam
  const mir = cutLine(p);
  assert.deepStrictEqual(p.segs[2].corner, { t: "mirror" });
  assert.ok(area(mir) < area(base), "a mirrored hem on a flared skirt is narrower than the mitred one");
  // the two top corners are untouched
  for (const c of base.filter(q => q.y < 0)) assert.ok(mir.some(q => dist(q, c) < 1e-9), "top corner kept");
  // fold the hem up: every cut-line point below the hem line lands inside the cut line above it
  const hemPts = mir.filter(q => q.y > 300 + 1e-9);
  assert.strictEqual(hemPts.length, 2);
  for (const q of hemPts) near(toPoly(mir, V(q.x, 600 - q.y)), 0, 1e-6, "folded hem corner lies on the side seam's cut line");
  // symmetric piece, symmetric result
  near(Math.min(...mir.map(q => q.x)) + Math.max(...mir.map(q => q.x)), 200, 1e-9);
  setCorner(p.segs[2], "default"); setCorner(p.segs[3], "default");
  assert.strictEqual(p.segs[2].corner, undefined, "default is stored as no corner");
  assert.deepStrictEqual(cutLine(p), base);
  setCorner(p.segs[2], "round", 5); assert.deepStrictEqual(p.segs[2].corner, { t: "round", r: 5 });
  setCorner(p.segs[2], "round", 0); assert.deepStrictEqual(p.segs[2].corner, { t: "round" });
  assert.ok(cutLine(p).length > base.length, "a rounded corner has more points");
  for (const [t] of CORNERS) { setCorner(p.segs[2], t); const c = cutLine(p); assert.ok(c.length >= 4 && c.every(q => Number.isFinite(q.x) && Number.isFinite(q.y)), t); }
});

test("dart-type allowance: a folded dart's cap is part of the cut line; an unfolded dart's is not", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 200, 300)); S.pieces.push(p);
  p.segs.forEach(s => s.sa = 10);
  const plain = cutLine(p);
  addDartTo(p, 0, 0.5, 30, 90, false);
  assert.deepStrictEqual(cutLine(p), plain, "unfolded: the cut line runs straight across the mouth");
  p.darts[0].folded = true;
  const g = dartGeom(p, p.darts[0]), c = cutLine(p);
  const at = (q) => c.findIndex(r => dist(r, q) < 1e-9);
  assert.ok(at(g.capL) >= 0 && at(g.Mc) === at(g.capL) + 1 && at(g.capR) === at(g.Mc) + 1, "capL, cap point, capR in order");
  near(area(c), area(plain) + 30*(-10 - g.Mc.y)/2, 1e-6, "the cut line gained the cap triangle");
  // on a curved edge the cap replaces the samples across the mouth
  setCurve(p, 0, true); p.segs[0].c1 = V(60, -30); p.segs[0].c2 = V(140, -30);
  const g2 = dartGeom(p, p.darts[0]), c2 = cutLine(p);
  assert.ok(c2.some(r => dist(r, g2.Mc) < 1e-9)); assert.ok(c2.every(r => Number.isFinite(r.x)));
  // a rotated dart fills its whole edge: the cap point sits between that edge's two corners
  setCurve(p, 0, false);
  p.grain = { a: V(30, 60), b: V(30, 240) };
  assert.strictEqual(rotateDart(p, 0, p.segs[1].id, 0.5, 1), "");
  const g3 = dartGeom(p, p.darts[0]), c3 = cutLine(p);
  assert.ok(c3.some(r => dist(r, g3.Mc) < 1e-9), "cap point of the rotated dart");
  assert.ok(c3.every(r => Number.isFinite(r.x) && Number.isFinite(r.y)));
});

test("Unfold carries corner types to both halves, swapping the two perpendicular ones on the mirrored half", () => {
  reset();
  const p = mkPiece("Half", mkShape([V(0, 0), V(100, 0), V(120, 300), V(0, 300)], true));     // edge 3 is the fold (centre front)
  p.segs.forEach((s, i) => s.sa = [10, 10, 30, 0][i]);         // a deeper hem, so Mirror knows which edge folds
  // (Round r15 / 3: the reference's names; a corner on one of its two lines says which, and that changes on the mirrored half)
  setCorner(p.segs[1], "perp", { on: "in" }); setCorner(p.segs[2], "turn"); setCorner(p.segs[0], "round", 4); setCorner(p.segs[3], "slant");
  const u = unfold(p, 3);
  const at = (c) => u.segs[u.pts.findIndex(q => dist(q, c) < 1e-9)].corner;
  assert.deepStrictEqual(at(V(100, 0)), { t: "perp", on: "in" }); assert.deepStrictEqual(at(V(120, 300)), { t: "turn" });
  assert.deepStrictEqual(at(V(-100, 0)), { t: "perp", on: "out" }, "mirrored: incoming and outgoing edges change places");
  assert.deepStrictEqual(at(V(-120, 300)), { t: "turn" });
  assert.strictEqual(at(V(0, 0)), undefined, "the points on the fold line are plain points"); assert.strictEqual(at(V(0, 300)), undefined);
  // the unfolded cut line is symmetric about the fold
  const c = cutLine(u);
  for (const q of c) assert.ok(c.some(r => dist(r, V(-q.x, q.y)) < 1e-6), "mirror image of " + JSON.stringify(q));
});

/* ---- notches ---- */

test("notch settings: defaults, coercion of junk, and saving with the document", () => {
  assert.deepStrictEqual(normNotch(undefined), { type: "I", len: 6, color: "#00a37a", width: 2, dup: true });
  assert.deepStrictEqual(normNotch({ type: "I", len: 6, color: "#ff0000", width: 1.4, dup: true }), NOTCH_DEFAULT, "the old, hard-to-see defaults are replaced by the new ones");
  assert.deepStrictEqual(normNotch({ type: "X", len: "abc", color: "red", width: null, dup: "yes" }), { type: "I", len: 6, color: "#00a37a", width: 2, dup: false });
  assert.deepStrictEqual(normNotch({ type: "V", len: "4.5", color: "#00AAff", width: 99, dup: false }), { type: "V", len: 4.5, color: "#00AAff", width: 6, dup: false });
  assert.strictEqual(normNotch({ len: 0 }).len, 0.5, "length is kept above zero");
  reset();
  const p = mkPiece("P", rectShape(0, 0, 100, 100)); S.pieces.push(p);
  const file = JSON.parse(JSON.stringify({ v: 7, nextId: 2, nextSegId: 9, notch: { type: "T", len: 8, color: "#112233", width: 2, dup: false }, pieces: S.pieces, seams: [] }));
  S.notch = null; loadDoc(file);
  assert.deepStrictEqual(S.notch, { type: "T", len: 8, color: "#112233", width: 2, dup: false });
  delete file.notch; loadDoc(file);
  assert.deepStrictEqual(S.notch, NOTCH_DEFAULT, "older files get the defaults");
});

test("notch marks: on the seam line pointing in, duplicated on the cut edge where there is allowance", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 200, 300));           // top edge: outside is up (−y)
  p.segs[0].sa = 10; p.segs[0].notches = [0.25]; p.segs[1].notches = [0.5];
  const I = notchMarks(p, { type: "I", len: 6, dup: false });
  assert.deepStrictEqual(I, [[V(50, 0), V(50, 6)], [V(200, 150), V(194, 150)]], "from the seam line, 6 into the pattern");
  const dup = notchMarks(p, { type: "I", len: 6, dup: true });
  assert.deepStrictEqual(dup, [[V(50, 0), V(50, 6)], [V(50, -10), V(50, -4)], [V(200, 150), V(194, 150)]], "the edge without allowance has just one");
  const Tn = notchMarks(p, { type: "T", len: 6, dup: false });
  assert.deepStrictEqual(Tn.slice(0, 2), [[V(50, 0), V(50, 6)], [V(48, 6), V(52, 6)]], "a bar across the inner end");
  const Vn = notchMarks(p, { type: "V", len: 6, dup: false });
  assert.deepStrictEqual(Vn[0], [V(48, 0), V(50, 6), V(52, 0)], "a wedge with its point inside");
  assert.strictEqual(notchMarks(p, { type: "V", len: 6, dup: true }).length, 3);
  // the other winding: still pointing into the pattern
  const q = mkPiece("Q", mkShape([V(0,0), V(0,300), V(200,300), V(200,0)], true));
  q.segs[3].notches = [0.5];                                    // the top edge, drawn right to left
  assert.deepStrictEqual(notchMarks(q, { type: "I", len: 6, dup: false }), [[V(100, 0), V(100, 6)]]);
});

test("Add Notch to Intersection: a notch wherever an internal line meets the outline, never twice, never on a corner", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 200, 300)); S.pieces.push(p);
  const across = p.internals[addChild(p, "internals", mkShape([V(0, 120), V(200, 180)], false))];     // edge to edge
  const diag = p.internals[addChild(p, "internals", mkShape([V(0, 0), V(100, 300)], false))];         // from a corner to the bottom
  const inner = p.internals[addChild(p, "internals", mkShape([V(50, 50), V(150, 50)], false))];
  assert.strictEqual(notchIntersections(p, across), 2);
  near(p.segs[1].notches[0], 0.6, 1e-9, "on the right edge at y = 180"); near(p.segs[3].notches[0], 0.6, 1e-9, "on the left edge at y = 120");
  assert.strictEqual(notchIntersections(p, across), 0, "already notched");
  assert.strictEqual(notchIntersections(p, diag), 1, "the corner end is skipped");
  samePt(segPt(p, 2, p.segs[2].notches[0]), V(100, 300));
  assert.strictEqual(notchIntersections(p, inner), 0, "a line that doesn't reach the outline adds nothing");
});

module.exports = T;
