// Phase 3: Distribute Internal Lines between Segments, Slash & Spread, Fullness (line and
// point), Pleats.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1 };
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", "affOf", "affApply", "affMul", "syncHalf", "mkLinked", 
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "flattenSA",
  "signedArea", "outN", "lineX", "offsetVar", "CORNERS", "cornerPts", "cutLine", "inside", "pieceWind", "reflectAcross",
  "newSegId", "segIx", "ensureSegIds", "newShapeId", "ensureShapeIds", "addChild",
  "setCurve", "mkShape", "ellipseShape", "rectShape", "mkPiece", "mapPiece", "reflector", "byId", "sync",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "dartGeom", "addDartTo",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "seamEnds", "validSeams", "makeSeam", "resolveRefs",
  "cross", "dot", "blankSeg", "segChords", "bisect", "segHits", "shapeHits", "distToShape", "splitAt", "extendTrim",
  "FOLD_DASH", "tAtFrac", "lineDivisions", "pairFlip", "distributeLines", "locateOn", "polyCentroid", "chainIdx",
  "slashSpread", "slashLine", "divideSeg", "fullnessLine", "fullnessPoint", "pleatPattern", "pleatIntake", "addPleats",
], { S });
const { V, cp, sub, add, mul, dist, clone, segLen, segPt, segTan, flatten, signedArea, inside, setCurve, mkShape, rectShape, mkPiece, addChild,
  addPoint, dartGeom, addDartTo, seamInfo, seamEnds, makeSeam, resolveRefs, segIx, cross, dot, distToShape,
  tAtFrac, lineDivisions, distributeLines, locateOn, slashSpread, slashLine, divideSeg, fullnessLine, fullnessPoint,
  pleatPattern, pleatIntake, addPleats } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; }
const area = (p) => Math.abs(signedArea(flatten(p, 40)));
const perim = (p) => p.segs.reduce((L, s, i) => L + segLen(p, i), 0);
// every invariant a piece must keep to be drawable and editable
function sound(p, msg) {
  assert.strictEqual(p.pts.length, p.segs.length, msg + ": points and segments in step");
  assert.strictEqual(new Set(p.segs.map(s => s.id)).size, p.segs.length, msg + ": unique segment ids");
  for (let i = 0; i < p.segs.length; i++) assert.ok(Number.isFinite(segLen(p, i)), msg + ": finite lengths");
  const ids = [...p.internals, ...p.bases].map(c => c.id);
  assert.strictEqual(new Set(ids).size, ids.length, msg + ": unique child ids");
}
// a 200 × 300 panel: 0 top (0,0)→(200,0), 1 right, 2 bottom (200,300)→(0,300), 3 left
function panel(grainX) {
  reset();
  const p = mkPiece("Panel", rectShape(0, 0, 200, 300));
  if (grainX !== undefined) p.grain = { a: V(grainX, 60), b: V(grainX, 240) };
  S.pieces.push(p);
  return p;
}
// the panel with points added mid-top (100,0) and mid-bottom (100,300); returns their indices
function midCut(p) {
  addPoint(p, 2, 0.5); addPoint(p, 0, 0.5);
  return { top: p.pts.findIndex(q => dist(q, V(100, 0)) < 1e-9), bot: p.pts.findIndex(q => dist(q, V(100, 300)) < 1e-9) };
}

/* ---- distribute ---- */

test("tAtFrac: fractions of arc length, not of the parameter", () => {
  reset();
  const sh = mkShape([V(0, 0), V(200, 0)], false);
  near(tAtFrac(sh, 0, 0.3), 0.3, 1e-12);
  setCurve(sh, 0, true); sh.segs[0].c1 = V(10, 80); sh.segs[0].c2 = V(190, 5);      // very uneven speed
  const L = segLen(sh, 0);
  for (const f of [0.25, 0.5, 0.8]) {
    const t = tAtFrac(sh, 0, f), part = { pts: [sh.pts[0], sh.pts[1]], segs: [clone(sh.segs[0])], closed: false };
    addPoint(part, 0, t);
    near(segLen(part, 0), f*L, 0.02, "length up to the division at " + f);
  }
  near(tAtFrac(sh, 0, 0), 0, 1e-12); near(tAtFrac(sh, 0, 1), 1, 1e-12);
});

test("Distribute Internal Lines: evenly spaced, ends on both segments, lines never cross", () => {
  const p = panel();
  const lines = distributeLines(p, 0, p, 2, 3, { straight: true, perp: false, graduated: true });
  assert.strictEqual(lines.length, 3);
  lines.forEach((ln, k) => {
    samePt(ln.pts[0], V(50*(k+1), 0), "top end " + k); samePt(ln.pts[1], V(50*(k+1), 300), "bottom end " + k);
    assert.strictEqual(ln.closed, false); assert.strictEqual(ln.segs[0].curved, false);
  });
  // adjacent segments work too (top and right): lines fan across the corner without crossing
  const fan = distributeLines(p, 0, p, 1, 2, { straight: true, perp: false, graduated: true });
  for (const ln of fan) { near(ln.pts[0].y, 0, 1e-9); near(ln.pts[1].x, 200, 1e-9); }
  assert.ok(G.segHits(fan[0], 0, fan[1], 0).length === 0, "the two lines don't cross");
});

test("Distribute: graduated divides each segment by its own length; otherwise equal gaps, centred", () => {
  reset();
  const p = mkPiece("Trap", mkShape([V(50, 0), V(150, 0), V(200, 300), V(0, 300)], true));   // top 100, bottom 200
  const grad = distributeLines(p, 0, p, 2, 3, { straight: true, graduated: true });
  assert.deepStrictEqual(grad.map(l => [l.pts[0].x, l.pts[1].x]), [[75, 50], [100, 100], [125, 150]]);
  const even = distributeLines(p, 0, p, 2, 3, { straight: true, graduated: false });        // gap = 100/4 = 25 on both
  assert.deepStrictEqual(even.map(l => [l.pts[0].x, l.pts[1].x]), [[75, 75], [100, 100], [125, 125]]);
  assert.deepStrictEqual(lineDivisions(100, 200, 1, false), { fa: [0.5], fb: [0.5] });
});

test("Distribute perpendicular: each line leaves the first segment square and stops on the second", () => {
  reset();
  const p = mkPiece("P", mkShape([V(0, 0), V(200, 20), V(200, 300), V(0, 300)], true));       // slanted top
  const lines = distributeLines(p, 0, p, 2, 3, { straight: true, perp: true, graduated: true });
  assert.strictEqual(lines.length, 3);
  const tn = segTan(p, 0, 0.5);
  for (const ln of lines) {
    near(dot(sub(ln.pts[1], ln.pts[0]), tn), 0, 1e-6, "square to the top edge");
    near(ln.pts[1].y, 300, 1e-6, "ends on the bottom edge");
    near(distToShape(p, ln.pts[0]), 0, 1e-9);
  }
  // lines that miss the second segment are left out
  const q = mkPiece("Q", mkShape([V(0, 0), V(400, 0), V(400, 100), V(250, 100), V(250, 300), V(0, 300)], true));
  assert.strictEqual(distributeLines(q, 0, q, 4, 3, { straight: true, perp: true, graduated: true }).length, 2, "the right-hand line misses the lower edge");
});

test("Distribute, not straight: a curve that leaves both segments square", () => {
  reset();
  const p = mkPiece("P", mkShape([V(0, 0), V(200, 60), V(180, 300), V(0, 260)], true));
  for (const ln of distributeLines(p, 0, p, 2, 2, { straight: false, perp: false, graduated: true })) {
    assert.ok(ln.segs[0].curved);
    near(dot(segTan(ln, 0, 0), segTan(p, 0, 0.5)), 0, 1e-9, "square at the first segment");
    near(dot(segTan(ln, 0, 1), segTan(p, 2, 0.5)), 0, 1e-9, "square at the second");
    assert.ok(inside(flatten(p, 8), segPt(ln, 0, 0.5)), "runs through the pattern");
  }
});

/* ---- slash & spread ---- */

test("Slash & Spread, hinged: the gap is exactly the typed spread, the pivot stays one point, every length is kept", () => {
  for (const grainX of [50, 150, undefined]) {
    const p = panel(grainX), { top, bot } = midCut(p);
    const was = clone(p), A0 = area(p), ids = p.segs.map(s => s.id), lens = p.segs.map((s, i) => segLen(p, i));
    const r = slashSpread(p, top, bot, 40, 0, []);
    assert.ok(r && r.a && r.b === null, "opened at the top, closed at the bottom");
    sound(p, "grain " + grainX);
    assert.strictEqual(p.pts.length, was.pts.length + 1, "one new point (the top is now two points)");
    const gi = p.segs.indexOf(r.a.seg);
    near(segLen(p, gi), 40, 1e-9, "gap");
    assert.strictEqual(p.pts.filter(q => dist(q, V(100, 300)) < 1e-9).length, 1, "pivot still a single, unmoved point");
    ids.forEach((id, k) => near(segLen(p, segIx(p, id)), lens[k], 1e-9, "segment " + id + " keeps its length"));
    near(perim(p), 1000 + 40, 1e-9);
    // the wedge added is the triangle pivot–top–top': ½·d²·sin θ with 2·d·sin(θ/2) = 40, d = 300
    const th = 2*Math.asin(40/600);
    near(area(p), A0 + 0.5*300*300*Math.sin(th), 1e-6, "area grows by the wedge");
    // the side holding the grainline has not moved
    const fixedLeft = grainX !== 150;
    for (const q of was.pts) if (fixedLeft ? q.x <= 100 : q.x >= 100) assert.ok(p.pts.some(r2 => dist(r2, q) < 1e-9), "fixed point " + JSON.stringify(q) + " still there");
    assert.deepStrictEqual(p.grain, was.grain);
  }
});

test("Slash & Spread from both edges: equal openings shift the side sideways; unequal ones are both exact", () => {
  let p = panel(50), c = midCut(p);
  const A0 = area(p);
  let r = slashSpread(p, c.top, c.bot, 30, 30, []);
  assert.ok(r.a && r.b);
  near(segLen(p, p.segs.indexOf(r.a.seg)), 30, 1e-9); near(segLen(p, p.segs.indexOf(r.b.seg)), 30, 1e-9);
  near(area(p), A0 + 30*300, 1e-6, "a 30 × 300 strip was let in");
  assert.ok(p.pts.some(q => dist(q, V(230, 0)) < 1e-9) && p.pts.some(q => dist(q, V(230, 300)) < 1e-9), "the right side moved 30 to the right");
  sound(p, "parallel");
  for (const [sa, sb] of [[50, 20], [10, 45], [80, 5]]) {
    p = panel(50); c = midCut(p);
    r = slashSpread(p, c.top, c.bot, sa, sb, []);
    near(segLen(p, p.segs.indexOf(r.a.seg)), sa, 1e-9, "top opening"); near(segLen(p, p.segs.indexOf(r.b.seg)), sb, 1e-9, "bottom opening");
    near(perim(p), 1000 + sa + sb, 1e-9);
    assert.ok(area(p) > 200*300, "opened, not overlapped");
    sound(p, sa + "/" + sb);
  }
  // refused: nothing to open, the same point twice, a spread larger than the cut can swing
  p = panel(50); c = midCut(p);
  const before = JSON.stringify(p);
  assert.strictEqual(slashSpread(p, c.top, c.bot, 0, 0, []), null);
  assert.strictEqual(slashSpread(p, c.top, c.top, 10, 0, []), null);
  assert.strictEqual(slashSpread(p, c.top, c.bot, 5000, 0, []), null);
  assert.strictEqual(JSON.stringify(p), before, "a refused spread changes nothing");
});

test("Slash & Spread carries what is on the moving side: curves, internal lines, base lines, darts, notches", () => {
  const p = panel(50), { top, bot } = midCut(p);
  const ri = p.pts.findIndex(q => dist(q, V(200, 0)) < 1e-9);                // right edge starts here
  setCurve(p, ri, true); p.segs[ri].c1 = V(230, 100); p.segs[ri].c2 = V(230, 200);
  p.segs[ri].notches = [0.4];
  addDartTo(p, ri, 0.6, 20, 50);
  const mov = p.internals[addChild(p, "internals", mkShape([V(130, 100), V(170, 180)], false))];
  const stay = p.internals[addChild(p, "internals", mkShape([V(20, 100), V(70, 180)], false))];
  const base = p.bases[addChild(p, "bases", mkShape([V(120, 250), V(180, 250)], false))];
  const was = clone(p), g0 = dartGeom(p, p.darts[0]), notch0 = segPt(p, ri, 0.4), L0 = segLen(p, ri);
  const r = slashSpread(p, top, bot, 60, 0, []);
  const i2 = segIx(p, was.segs[ri].id);
  near(segLen(p, i2), L0, 1e-9, "the curve keeps its length");
  samePt(segPt(p, i2, 0.4), r.T(notch0), "the notch rides on its segment");
  const g1 = dartGeom(p, p.darts[0]);
  samePt(g1.apex, r.T(g0.apex), "dart apex", 1e-6); samePt(g1.legL, r.T(g0.legL), "dart leg", 1e-6);
  samePt(mov.pts[0], r.T(was.internals[0].pts[0]), "internal line on the moving side"); samePt(mov.pts[1], r.T(was.internals[0].pts[1]));
  near(segLen(mov, 0), segLen(was.internals[0], 0), 1e-9);
  assert.deepStrictEqual(stay.pts, was.internals[1].pts, "internal line on the fixed side stays");
  samePt(base.pts[0], r.T(was.bases[0].pts[0]), "base line on the moving side");
  // T is a rigid motion: distances between any two points are kept
  near(dist(r.T(V(3, 4)), r.T(V(60, 80))), dist(V(3, 4), V(60, 80)), 1e-9);
  sound(p, "carried");
});

test("Slash & Spread on a sewn edge: the seam takes the new segment into its run and grows by the opening", () => {
  const p = panel(50), q = mkPiece("Q", rectShape(400, 0, 200, 100));
  S.pieces.push(q);
  S.seams = [makeSeam([], { piece: p.id, sid: p.segs[0].id }, { piece: q.id, sid: q.segs[0].id }),
             makeSeam([{ id: 1 }], { piece: p.id, sid: p.segs[2].id }, { piece: q.id, sid: q.segs[2].id })];
  const { top, bot } = midCut(p);
  slashSpread(p, top, bot, 40, 0, []);
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(S.seams.length, 2);
  assert.strictEqual(S.seams[0].a[0].sids.length, 3, "top: first half, the opening, second half");
  near(seamInfo(S.seams[0], S.pieces).la, 240, 1e-9, "the top seam is 40 longer");
  near(seamInfo(S.seams[0], S.pieces).diff, 40, 1e-9, "which shows as the fullness to ease in");
  assert.strictEqual(S.seams[1].a[0].sids.length, 2, "bottom (the pivot): just the two halves");
  near(seamInfo(S.seams[1], S.pieces).la, 200, 1e-9);
  const e = seamEnds(S.seams[0], S.pieces);
  samePt(e[0][0], V(0, 0), "seam still starts at the corner");
});

test("Slash & Spread along an internal line: its ends are fitted to the outline first and the line is used up", () => {
  let p = panel(50);
  addChild(p, "internals", mkShape([V(20, 20), V(40, 40)], false));
  const j = addChild(p, "internals", mkShape([V(120, 40), V(120, 200)], false));      // stops short of both edges
  assert.strictEqual(slashLine(p, "internals", j, 50, 0), "");
  assert.strictEqual(p.internals.length, 1, "the slash line is gone, the other internal stays");
  assert.ok(p.pts.some(q => dist(q, V(120, 300)) < 1e-9), "pivot on the bottom edge");
  const gap = p.segs.findIndex((s, i) => Math.abs(segLen(p, i) - 50) < 1e-9 && dist(p.pts[i], V(120, 0)) < 1e-9 || dist(p.pts[(i+1) % p.pts.length], V(120, 0)) < 1e-9 && Math.abs(segLen(p, i) - 50) < 1e-9);
  assert.ok(gap >= 0, "a 50 mm opening at the top, starting from (120,0)");
  near(perim(p), 1050, 1e-9); sound(p, "slashLine");
  // a bent slash line still divides the piece correctly
  p = panel(50);
  const k = addChild(p, "internals", mkShape([V(150, 0), V(110, 150), V(150, 300)], false));
  const inner = p.internals[addChild(p, "internals", mkShape([V(125, 140), V(135, 160)], false))];   // right of the bend, left of the chord
  const was = clone(inner);
  assert.strictEqual(slashLine(p, "internals", k, 0, 30), "");
  assert.notDeepStrictEqual(inner.pts, was.pts, "a shape between the bend and the straight chord is on the moving side");
  near(segLen(inner, 0), segLen(was, 0), 1e-9);
  // errors: a closed shape, a line that can't reach the outline
  p = panel(50);
  assert.ok(slashLine(p, "internals", addChild(p, "internals", rectShape(50, 50, 20, 20)), 10, 0));
  const out = addChild(p, "internals", mkShape([V(300, 10), V(400, 10)], false));
  assert.ok(/reach the outline/.test(slashLine(p, "internals", out, 10, 0)));
});

test("regression: the pattern label survives a cut, and a linked mirror follows it", () => {
  const p = panel(50);
  p.anno = V(160, 150);                                        // the label sits on the side that will move
  const M = clone(p); M.id = S.nextId++; M.link = { of: p.id, kind: "symmetric", m: G.affOf(G.reflector(V(300, 0), V(300, 300))) };
  S.pieces.push(M); G.sync();
  const { top, bot } = midCut(p);
  const r = slashSpread(p, top, bot, 40, 0, []);
  samePt(p.anno, r.T(V(160, 150)), "the label moved with its side");
  G.sync(); S.seams = resolveRefs(S.pieces, S.seams);
  const R = G.reflector(V(300, 0), V(300, 300));
  assert.strictEqual(M.pts.length, p.pts.length);
  p.pts.forEach((q, i) => samePt(M.pts[i], R(q), "mirror point " + i));
  samePt(M.anno, R(p.anno), "mirror label");
  // a label on the fixed side stays put
  const p2 = panel(50); p2.anno = V(40, 150);
  const c2 = midCut(p2); slashSpread(p2, c2.top, c2.bot, 40, 0, []);
  assert.deepStrictEqual(p2.anno, V(40, 150));
});

/* ---- fullness ---- */

test("divideSeg: points at fractions of length; returns the segment that starts at each", () => {
  const p = panel(), sid = p.segs[0].id;
  const ids = divideSeg(p, sid, [0.25, 0.5, 0.9]);
  assert.deepStrictEqual(ids.map(id => p.pts[segIx(p, id)].x), [50, 100, 180]);
  assert.strictEqual(segIx(p, sid), 0, "the first part keeps the id");
  sound(p, "divideSeg");
});

test("Fullness (Line): the chosen segment grows by exactly the amount; 0 on the other side keeps it as the pivot", () => {
  const p = panel(100), top = p.segs[0].id, bottom = p.segs[2].id, A0 = area(p);
  const q = mkPiece("Q", rectShape(400, 0, 200, 100)); S.pieces.push(q);
  S.seams = [makeSeam([], { piece: p.id, sid: top }, { piece: q.id, sid: q.segs[0].id }),
             makeSeam([{ id: 1 }], { piece: p.id, sid: bottom }, { piece: q.id, sid: q.segs[2].id })];
  const gaps = fullnessLine(p, top, bottom, 60, 0, 4);      // slashes at x = 40, 80, 120, 160; the grain is in the middle strip
  assert.strictEqual(gaps.length, 4);
  S.seams = resolveRefs(S.pieces, S.seams);
  near(seamInfo(S.seams[0], S.pieces).la, 260, 1e-9, "top is 60 longer");
  near(seamInfo(S.seams[1], S.pieces).la, 200, 1e-9, "bottom unchanged");
  gaps.forEach(g => { near(segLen(p, p.segs.indexOf(g.a.seg)), 15, 1e-9, "each slash opens 15"); assert.strictEqual(g.b, null); });
  assert.ok(area(p) > A0); near(perim(p), 1060, 1e-9); sound(p, "flare");
  // the strip holding the grainline has not moved: its four corners are where they were
  for (const c of [V(80, 0), V(120, 0), V(80, 300), V(120, 300)]) assert.ok(p.pts.some(r => dist(r, c) < 1e-9), "corner " + JSON.stringify(c));
  // the flare is symmetric about the grain strip
  const xs = p.pts.map(r => r.x);
  near(Math.min(...xs) + Math.max(...xs), 200, 1e-6, "left and right sides swung out equally");
});

test("Fullness (Line) on both segments: parallel strips, area grows by amount × height", () => {
  const p = panel(100), top = p.segs[0].id, bottom = p.segs[2].id;
  const gaps = fullnessLine(p, top, bottom, 60, 60, 4);
  assert.strictEqual(gaps.length, 4);
  near(area(p), 200*300 + 60*300, 1e-6);
  const xs = p.pts.map(r => r.x);
  near(Math.max(...xs) - Math.min(...xs), 260, 1e-9, "the panel is 60 wider");
  assert.ok(p.pts.every(r => Math.abs(r.y) < 1e-9 || Math.abs(r.y - 300) < 1e-9), "top and bottom stay straight and level");
  sound(p, "parallel fullness");
  // unequal amounts: each side grows by its own amount
  const p2 = panel(100), t2 = p2.segs[0].id, b2 = p2.segs[2].id;
  fullnessLine(p2, t2, b2, 90, 30, 3);
  near(perim(p2), 1000 + 120, 1e-9);
  // refused: the same segment twice
  const p3 = panel(100);
  assert.strictEqual(fullnessLine(p3, p3.segs[0].id, p3.segs[0].id, 10, 0, 2), null);
});

test("Fullness (Line) on a curved hem: the hem grows by the amount measured along the curve", () => {
  reset();
  const p = mkPiece("Skirt", mkShape([V(40, 0), V(160, 0), V(200, 300), V(0, 300)], true));
  setCurve(p, 2, true); p.segs[2].c1 = V(140, 325); p.segs[2].c2 = V(60, 325);
  p.grain = { a: V(100, 50), b: V(100, 250) };
  S.pieces.push(p);
  const hem = p.segs[2].id, waist = p.segs[0].id, L0 = perim(p), hemL = segLen(p, 2);
  const q = mkPiece("Q", rectShape(400, 0, 200, 100)); S.pieces.push(q);
  S.seams = [makeSeam([], { piece: p.id, sid: hem }, { piece: q.id, sid: q.segs[0].id })];
  assert.ok(fullnessLine(p, hem, waist, 80, 0, 4));
  S.seams = resolveRefs(S.pieces, S.seams);
  near(seamInfo(S.seams[0], S.pieces).la, hemL + 80, 0.02, "hem seam length (curve length estimate gets finer on the parts)");
  near(perim(p), L0 + 80, 0.02);
  sound(p, "curved hem");
});

test("Fullness (Point): the segment grows by the amount, the pivot point does not move", () => {
  const p = panel(), bottom = p.segs[2].id, L0 = perim(p);
  const out = fullnessPoint(p, bottom, 0, 50, 2);                     // pivot at the top-left corner (0,0)
  assert.strictEqual(out.length, 2);
  out.forEach(g => { assert.strictEqual(g.a, null, "closed at the pivot"); near(segLen(p, p.segs.indexOf(g.b.seg)), 25, 1e-9); });
  assert.strictEqual(p.pts.filter(q => dist(q, V(0, 0)) < 1e-9).length, 1, "pivot is still one point at (0,0)");
  near(perim(p), L0 + 50, 1e-9);
  sound(p, "point fullness");
  // every slash ran from the pivot: the distance from (0,0) to each opening corner is unchanged from the original
  const d1 = Math.hypot(200 - 200/3, 300), d2 = Math.hypot(200 - 400/3, 300);
  for (const g of out) { const i = p.segs.indexOf(g.b.seg), e = G.sEnds(p, i); near(dist(e[0], V(0, 0)), dist(e[1], V(0, 0)), 1e-9, "both sides of an opening are the same distance from the pivot"); }
  assert.ok(out.some(g => Math.abs(dist(G.sEnds(p, p.segs.indexOf(g.b.seg))[0], V(0, 0)) - d1) < 1e-6));
  assert.ok(out.some(g => Math.abs(dist(G.sEnds(p, p.segs.indexOf(g.b.seg))[0], V(0, 0)) - d2) < 1e-6));
  // the pivot can't be an end of the segment itself
  const p2 = panel();
  assert.strictEqual(fullnessPoint(p2, p2.segs[2].id, 2, 50, 2), null);
  assert.strictEqual(fullnessPoint(p2, p2.segs[2].id, 3, 50, 2), null);
});

/* ---- pleats ---- */

test("pleat patterns: line positions and folds for each type, custom line counts, reverse", () => {
  assert.deepStrictEqual(pleatPattern("knife", 0, false), [[0, "mountain"], [0.5, "valley"], [1, null]]);
  assert.deepStrictEqual(pleatPattern("knife", 0, true), [[0, null], [0.5, "valley"], [1, "mountain"]], "reversed: it folds the other way");
  assert.deepStrictEqual(pleatPattern("box", 0, false).map(x => x[1]), ["mountain", "valley", null, "valley", "mountain"]);
  assert.deepStrictEqual(pleatPattern("box", 0, true).map(x => x[1]), ["valley", "mountain", null, "mountain", "valley"]);
  assert.deepStrictEqual(pleatPattern("accordion", 0, false), [[0, "valley"], [0.5, "mountain"], [1, "valley"]]);
  assert.deepStrictEqual(pleatPattern("accordion", 3, true).map(x => x[1]), ["mountain", "valley", "mountain"]);
  assert.deepStrictEqual(pleatPattern("accordion", 5, false), [[0, "mountain"], [0.25, "valley"], [0.5, "mountain"], [0.75, "valley"], [1, "mountain"]]);
  assert.deepStrictEqual(pleatPattern("knife", 2, false), [[0, "mountain"], [1, "valley"]]);
  assert.strictEqual(pleatIntake("knife", 20), 40); assert.strictEqual(pleatIntake("box", 20), 80); assert.strictEqual(pleatIntake("accordion", 20), 40);
});

test("Knife pleats: the panel widens by pleats × 2 × depth, with three fold lines and notches per pleat", () => {
  const p = panel(20), top = p.segs[0].id, bottom = p.segs[2].id;       // grain near the left edge: everything else shifts right
  assert.strictEqual(addPleats(p, top, bottom, 2, 15, "knife", 0, false), 6);
  const xs = p.pts.map(q => q.x);
  near(Math.max(...xs) - Math.min(...xs), 200 + 2*30, 1e-9, "width");
  near(area(p), (200 + 60)*300, 1e-6);
  assert.strictEqual(p.internals.length, 6);
  // slashes were at x = 66.67 and 133.33; the first strip is 66.67..96.67, the second (shifted by 30) 163.33..193.33
  const expect = [[200/3, "mountain"], [200/3 + 15, "valley"], [200/3 + 30, undefined], [400/3 + 30, "mountain"], [400/3 + 45, "valley"], [400/3 + 60, undefined]];
  const got = p.internals.map(l => [l.pts[0].x, l.fold]).sort((a, b) => a[0] - b[0]);
  got.forEach((g, k) => { near(g[0], expect[k][0], 1e-9, "line " + k); assert.strictEqual(g[1], expect[k][1], "fold " + k); });
  for (const l of p.internals) { near(l.pts[0].x, l.pts[1].x, 1e-9, "vertical"); near(Math.abs(l.pts[0].y - l.pts[1].y), 300, 1e-9, "edge to edge"); }
  // each new outline segment is 30 long with one notch in the middle, where the inner fold lands
  const gapSegs = p.segs.filter((s, i) => Math.abs(segLen(p, i) - 30) < 1e-9);
  assert.strictEqual(gapSegs.length, 4); assert.ok(gapSegs.every(s => s.notches.length === 1 && Math.abs(s.notches[0] - 0.5) < 1e-12));
  sound(p, "knife");
});

test("Box and accordion pleats, reverse fold, custom lines", () => {
  let p = panel(20);
  assert.strictEqual(addPleats(p, p.segs[0].id, p.segs[2].id, 1, 10, "box", 0, false), 5);
  near(Math.max(...p.pts.map(q => q.x)), 240, 1e-9, "a box pleat lets in 4 × depth");
  assert.deepStrictEqual(p.internals.slice().sort((a, b) => a.pts[0].x - b.pts[0].x).map(l => [l.pts[0].x, l.fold]),
    [[100, "mountain"], [110, "valley"], [120, undefined], [130, "valley"], [140, "mountain"]]);
  assert.deepStrictEqual(p.segs.filter((s, i) => Math.abs(segLen(p, i) - 40) < 1e-9).map(s => s.notches.slice().sort()), [[0.25, 0.5, 0.75], [0.25, 0.5, 0.75]]);
  p = panel(20);
  addPleats(p, p.segs[0].id, p.segs[2].id, 1, 10, "box", 0, true);
  assert.deepStrictEqual(p.internals.slice().sort((a, b) => a.pts[0].x - b.pts[0].x).map(l => l.fold), ["valley", "mountain", undefined, "mountain", "valley"]);
  p = panel(20);
  assert.strictEqual(addPleats(p, p.segs[0].id, p.segs[2].id, 3, 8, "accordion", 0, false), 9);
  near(Math.max(...p.pts.map(q => q.x)), 200 + 3*16, 1e-9);
  p = panel(20);
  assert.strictEqual(addPleats(p, p.segs[0].id, p.segs[2].id, 2, 8, "accordion", 5, false), 10, "five lines per pleat");
  // a knife pleat reversed, with the grain on the other side, mirrors the fold order
  p = panel(180);
  addPleats(p, p.segs[0].id, p.segs[2].id, 1, 10, "knife", 0, false);
  const a = p.internals.slice().sort((x, y) => x.pts[0].x - y.pts[0].x).map(l => l.fold);
  p = panel(180);
  addPleats(p, p.segs[0].id, p.segs[2].id, 1, 10, "knife", 0, true);
  const b = p.internals.slice().sort((x, y) => x.pts[0].x - y.pts[0].x).map(l => l.fold);
  assert.deepStrictEqual(b, a.slice().reverse());
  assert.strictEqual(addPleats(panel(20), 1, 3, 1, 0, "knife", 0, false), null, "zero depth refused");
});

test("pleats on a trapezoid keep every strip parallel-sided and the piece sound", () => {
  reset();
  const p = mkPiece("Skirt", mkShape([V(40, 0), V(160, 0), V(200, 300), V(0, 300)], true));
  p.grain = { a: V(100, 50), b: V(100, 250) }; S.pieces.push(p);
  const A0 = area(p), waist = segLen(p, 0), hem = segLen(p, 2);
  assert.strictEqual(addPleats(p, p.segs[0].id, p.segs[2].id, 4, 12, "knife", 0, false), 12);
  sound(p, "trapezoid pleats");
  near(perim(p), 2*Math.hypot(40, 300) + waist + hem + 2*4*24, 1e-9, "waist and hem each grow by 4 × 24");
  assert.ok(area(p) > A0 + 4*24*290, "four strips about 300 tall were let in");
  for (const l of p.internals) assert.ok(l.pts.every(q => distToShape(p, q) < 1e-6), "fold lines end on the outline");
});

test("Pleats with a depth and a spacing at each end, and notches at the start, the end or both", () => {
  // tapered: 15 deep at the start (top), 5 at the end (bottom): the top grows by 30, the bottom by 10
  let p = panel(20);
  assert.strictEqual(addPleats(p, p.segs[0].id, p.segs[2].id, 1, 15, "knife", 0, false, { depthEnd: 5 }), 3);
  const lens = p.segs.map((s, i) => segLen(p, i));
  assert.ok(lens.some(L => Math.abs(L - 30) < 1e-9) && lens.some(L => Math.abs(L - 10) < 1e-9), "openings of 30 and 10: " + lens.map(L => L.toFixed(2)));
  near(lens.reduce((a, b) => a + b, 0), 1000 + 30 + 10, 1e-9, "nothing else changed length (the moved side only turned)");
  sound(p, "tapered");
  // the same depth at both ends is what the plain call does
  const q1 = panel(20), q2 = panel(20);
  addPleats(q1, q1.segs[0].id, q1.segs[2].id, 2, 12, "box", 0, false);
  addPleats(q2, q2.segs[0].id, q2.segs[2].id, 2, 12, "box", 0, false, { depthEnd: 12, spaceA: 0, spaceB: 0, notch: "both" });
  assert.deepStrictEqual(q2.pts, q1.pts);
  // spacing: two pleats 40 apart, centred on a 200 edge, are slashed at 80 and 120
  p = panel(20);
  assert.strictEqual(addPleats(p, p.segs[0].id, p.segs[2].id, 2, 10, "knife", 0, false, { spaceA: 40, spaceB: 40 }), 6);
  const xs = p.internals.map(l => l.pts[0].x).sort((a, b) => a - b);
  [80, 90, 100, 140, 150, 160].forEach((x, k) => near(xs[k], x, 1e-9, "fold line " + k));
  // a spacing that does not fit on the segment is refused
  assert.strictEqual(addPleats(panel(20), 1, 3, 2, 10, "knife", 0, false, { spaceA: 300 }), null);
  assert.strictEqual(addPleats(panel(20), 1, 3, 1, 10, "knife", 0, false, { depthEnd: 0 }), null, "a depth of 0 at one end is refused");
  // notches at the start only
  for (const [where, want] of [["start", [1, 0]], ["end", [0, 1]], ["both", [1, 1]]]) {
    p = panel(20);
    addPleats(p, p.segs[0].id, p.segs[2].id, 1, 10, "knife", 0, false, { notch: where });
    const gap = p.segs.map((s, i) => [s, i]).filter(([s, i]) => Math.abs(segLen(p, i) - 20) < 1e-9);
    assert.strictEqual(gap.length, 2, "two new segments");
    const top = gap.find(([s, i]) => Math.abs(p.pts[i].y) < 1e-9), bot = gap.find(([s, i]) => Math.abs(p.pts[i].y) > 1);
    assert.deepStrictEqual([top[0].notches.length, bot[0].notches.length], want, "notches: " + where);
  }
});

module.exports = T;
