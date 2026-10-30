// Phase 7: rulers, guidelines, Walk Pattern, custom 2D measurements.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], guides: [], measures: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null };
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", 
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "lineX", "signedArea", "inside", "reflector",
  "affOf", "affApply", "affMul", "mapPiece", "byId", "sync", "syncHalf", "chainIdx",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "addChild",
  "setCurve", "mkShape", "ellipseShape", "rectShape", "mkPiece", "normProps",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "deletePoint",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "validSeams", "makeSeam", "loadSeams", "resolveRefs",
  "cross", "dot", "tAtFrac", "locateOn",
  "RUL", "rulerStep", "rulerTicks", "normGuides", "mkGuide", "guideDir", "guideDist", "guideFoot", "guideThrough", "guideSnap",
  "walkPath", "lenTo", "pathMarks", "pathAt", "pathNearest", "walkPose", "walkAhead", "walkAnchorOf", "walkPartner",
  "mkAnchor", "anchorAt", "measureInfo", "validMeasures",
  "NOTCH_DEFAULT", "normNotch", "migrate", "alignMirrorIds", "loadDoc",
], { S });
const { V, sub, add, mul, dist, segLen, segPt, setCurve, mkShape, ellipseShape, rectShape, mkPiece, addChild, addPoint, deletePoint, makeSeam, cross, dot,
  rulerStep, rulerTicks, normGuides, mkGuide, guideDist, guideFoot, guideThrough, guideSnap,
  walkPath, pathMarks, pathAt, pathNearest, walkPose, walkAhead, walkAnchorOf, walkPartner,
  mkAnchor, anchorAt, measureInfo, validMeasures, loadDoc } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.guides = []; S.measures = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; }
function panel(x = 0, w = 200, h = 300) { const p = mkPiece("P" + (S.pieces.length + 1), rectShape(x, 0, w, h)); S.pieces.push(p); return p; }

/* ---- rulers ---- */

test("rulers: labelled ticks are a 1-2-5 step at least 55 px apart, in the display unit, right through zero", () => {
  assert.deepStrictEqual([0.05, 0.1, 0.5, 1, 3, 6, 12, 30].map(rulerStep), [2000, 1000, 200, 100, 20, 10, 5, 2]);
  assert.strictEqual(rulerStep(0), 10); assert.strictEqual(rulerStep(NaN), 10); assert.strictEqual(rulerStep(-2), 10);
  const t = rulerTicks(1, 18, 300, "mm");                      // 1 px per mm, 0 mm at x = 18
  assert.strictEqual(t.length, 15, "a minor tick every 20 mm from 0 to 280");
  assert.deepStrictEqual(t.filter(x => x.major).map(x => [x.px, x.label]), [[18, "0"], [118, "100"], [218, "200"]]);
  assert.deepStrictEqual(rulerTicks(1, 18, 300, "cm").filter(x => x.major).map(x => x.label), ["0", "10", "20"]);
  const neg = rulerTicks(2, 250, 400, "mm");                   // 0 mm is at x = 250
  assert.deepStrictEqual(neg.filter(x => x.major).map(x => [x.px, x.label]), [[50, "-100"], [150, "-50"], [250, "0"], [350, "50"]]);
  assert.ok(neg.every(x => x.px >= 0 && x.px <= 400), "only what is on the ruler");
  for (const z of [0.07, 0.4, 1.3, 9, 25]) {
    const maj = rulerTicks(z, 33, 900, "mm").filter(x => x.major);
    for (let k = 1; k < maj.length; k++) assert.ok(maj[k].px - maj[k-1].px >= 55 - 1e-6, "zoom " + z + ": labels don't crowd");
  }
});

/* ---- guidelines ---- */

test("guidelines: distance, foot, through two points, and loading only well-formed ones", () => {
  const g = { id: 1, p: V(10, 20), a: Math.PI/2 };             // upright through x = 10
  near(guideDist(g, V(35, -400)), 25, 1e-9); samePt(guideFoot(g, V(35, -400)), V(10, -400));
  const d = guideThrough([g], V(0, 0), V(30, 40));
  assert.strictEqual(d.id, 2); samePt(d.p, V(0, 0)); near(Math.tan(d.a), 4/3, 1e-9);
  near(guideDist(d, V(30, 40)), 0, 1e-9, "passes through the second point"); near(guideDist(d, V(-15, -20)), 0, 1e-9, "and runs on past the first");
  assert.strictEqual(mkGuide([], V(1, 2), 0).id, 1);
  const loaded = normGuides([g, null, { id: 1, p: V(0, 0), a: 0 }, { id: 3, p: { x: "a", y: 0 }, a: 0 }, { id: 4, p: V(5, 5) }, { id: 5, p: V(5, 5), a: 1, junk: true }]);
  assert.deepStrictEqual(loaded, [{ id: 1, p: V(10, 20), a: Math.PI/2 }, { id: 5, p: V(5, 5), a: 1 }], "duplicates and broken ones dropped");
  assert.deepStrictEqual(normGuides(undefined), []);
});

test("snapping to guidelines: onto the nearest one, onto the crossing when two are near, not at all when far", () => {
  const up = { id: 1, p: V(100, 0), a: Math.PI/2 }, level = { id: 2, p: V(0, 50), a: 0 }, slant = { id: 3, p: V(300, 300), a: Math.PI/4 };
  samePt(guideSnap([up, level, slant], V(103, 200), 8), V(100, 200), "onto the upright one");
  samePt(guideSnap([up, level, slant], V(104, 47), 8), V(100, 50), "onto the crossing");
  samePt(guideSnap([up, level, slant], V(405, 400), 8), V(402.5, 402.5), "onto the slanted one");
  assert.strictEqual(guideSnap([up, level, slant], V(150, 120), 8), null);
  assert.strictEqual(guideSnap([], V(0, 0), 8), null);
  samePt(guideSnap([up, { id: 9, p: V(104, 0), a: Math.PI/2 }], V(101, 10), 8), V(100, 10), "two parallel ones: just the nearer");
});

/* ---- walking ---- */

test("walk paths: forward and backward round an outline, along an open line, with the distance to each point", () => {
  reset();
  const p = panel();                                           // 0 top 200, 1 right 300, 2 bottom 200, 3 left 300
  assert.deepStrictEqual(walkPath(p, 1, 1), [{ i: 1, rev: false }, { i: 2, rev: false }, { i: 3, rev: false }, { i: 0, rev: false }]);
  assert.deepStrictEqual(walkPath(p, 1, -1), [{ i: 0, rev: true }, { i: 3, rev: true }, { i: 2, rev: true }, { i: 1, rev: true }]);
  assert.deepStrictEqual(pathMarks(p, walkPath(p, 1, 1)), [0, 300, 500, 800, 1000]);
  const ln = mkShape([V(0, 0), V(30, 0), V(30, 40), V(90, 40)], false);
  assert.deepStrictEqual(walkPath(ln, 1, 1), [{ i: 1, rev: false }, { i: 2, rev: false }]);
  assert.deepStrictEqual(walkPath(ln, 2, -1), [{ i: 1, rev: true }, { i: 0, rev: true }]);
  assert.deepStrictEqual(walkPath(ln, 3, 1), [], "nothing beyond the last point");
  // where the walk is
  const fwd = walkPath(p, 1, 1), back = walkPath(p, 1, -1);
  samePt(pathAt(p, fwd, 120).p, V(200, 120)); samePt(pathAt(p, fwd, 120).tan, V(0, 1));
  samePt(pathAt(p, fwd, 350).p, V(150, 300), "round the corner"); samePt(pathAt(p, fwd, 350).tan, V(-1, 0));
  samePt(pathAt(p, back, 50).p, V(150, 0)); samePt(pathAt(p, back, 50).tan, V(-1, 0), "travelling backward along the top");
  samePt(pathAt(p, back, 260).p, V(0, 60));
  near(pathNearest(p, fwd, V(230, 120)), 120, 1e-9); near(pathNearest(p, back, V(40, -30)), 160, 1e-9);
  near(pathNearest(p, fwd, V(100, 310)), 400, 1e-9);
});

test("walking a curve measures along the curve", () => {
  reset();
  const sh = mkShape([V(0, 0), V(200, 0), V(200, 100)], false);
  setCurve(sh, 0, true); sh.segs[0].c1 = V(10, 80); sh.segs[0].c2 = V(190, 5);
  const L = segLen(sh, 0), path = walkPath(sh, 0, 1), rev = walkPath(sh, 1, -1);
  for (const f of [0.2, 0.5, 0.85]) {
    const at = pathAt(sh, path, f*L);
    near(pathNearest(sh, path, at.p), f*L, 0.05, "there and back at " + f);
    samePt(pathAt(sh, rev, (1-f)*L).p, at.p, "the same place walked from the other end", 0.05);
    near(dot(pathAt(sh, rev, (1-f)*L).tan, at.tan), -1, 1e-6, "facing the other way");
  }
  samePt(pathAt(sh, path, L + 30).p, V(200, 30), "on into the next segment", 1e-6);
});

test("Walk Pattern: the walked edge is laid on the fixed edge at the same distance, facing the same way", () => {
  reset();
  const A = panel(0), B = panel(500, 150, 100);
  // A's right edge walked downward; B's left edge walked upward from its lower-left corner
  const pa = walkPath(A, 1, 1), pb = walkPath(B, 3, 1);
  for (const s of [0, 40, 100]) {
    const pose = walkPose(A, pa, B, pb, s);
    samePt(pose.T(pose.b.p), pose.a.p, "contact at " + s);
    samePt(sub(pose.T(add(pose.b.p, pose.b.tan)), pose.T(pose.b.p)), pose.a.tan, "directions lined up at " + s);
    // two straight edges: every point of B's edge lies on A's edge, the same distance on
    samePt(pose.T(pathAt(B, pb, 100).p), pathAt(A, pa, 100).p, "B's corner lands 100 along A", 1e-9);
    near(dist(pose.T(V(500, 0)), pose.T(V(650, 100))), dist(V(500, 0), V(650, 100)), 1e-9, "rigid");
  }
  // B's edge is 100, A's is 300: at B's corner, A still has 200 to go
  const ah = walkAhead(pathMarks(A, pa), pathMarks(B, pb), 60);
  near(ah.a, 240, 1e-9); near(ah.b, 40, 1e-9); near(ah.diff, 200, 1e-9);
  assert.deepStrictEqual(walkAhead([0, 100], [0, 100], 100), { a: 0, b: 0, diff: 0 }, "both at their end");
});

test("Walk Pattern rolls a curve without slipping: a circle's centre stays one radius off the line, level with the contact", () => {
  reset();
  const line = mkShape([V(0, 0), V(400, 0)], false), wheel = ellipseShape(0, -200, 50, 50);
  const pl = walkPath(line, 0, 1), pw = walkPath(wheel, 2, 1);          // start at the wheel's lowest point (0,-150)
  const c0 = walkPose(line, pl, wheel, pw, 0).T(V(0, -200));
  for (const s of [0, 30, 78.5, 150, 290]) {
    const pose = walkPose(line, pl, wheel, pw, s), c = pose.T(V(0, -200));
    // a four-curve circle is round to about 0.03%, hence the tolerance
    near(c.x, s, 0.15, "centre over the contact at " + s);
    near(Math.abs(c.y), 50, 0.15, "one radius from the line");
    near(c.y, c0.y, 0.1, "always on the same side");
    samePt(pose.T(pose.b.p), V(s, 0), "contact", 1e-9);
  }
});

test("where a walk starts: an edge from its nearer end, a point forward or (Shift) backward", () => {
  reset();
  const p = panel(), hitSeg = (i, t) => ({ k: "seg", p, sh: p, kind: "outline", i, t });
  assert.deepStrictEqual(walkAnchorOf(hitSeg(1, 0.2), false), { pid: p.id, shape: 0, start: 1, dir: 1 });
  assert.deepStrictEqual(walkAnchorOf(hitSeg(1, 0.8), false), { pid: p.id, shape: 0, start: 2, dir: -1 });
  assert.deepStrictEqual(walkAnchorOf(hitSeg(3, 0.9), false), { pid: p.id, shape: 0, start: 0, dir: -1 }, "wraps to point 0");
  assert.deepStrictEqual(walkAnchorOf({ k: "pt", p, sh: p, kind: "outline", i: 2 }, false), { pid: p.id, shape: 0, start: 2, dir: 1 });
  assert.deepStrictEqual(walkAnchorOf({ k: "pt", p, sh: p, kind: "outline", i: 2 }, true), { pid: p.id, shape: 0, start: 2, dir: -1 });
  const ln = p.internals[addChild(p, "internals", mkShape([V(20, 20), V(80, 20), V(80, 90)], false))];
  assert.deepStrictEqual(walkAnchorOf({ k: "seg", p, sh: ln, kind: "internal", i: 1, t: 0.9 }, false), { pid: p.id, shape: ln.id, start: 2, dir: -1 });
});

test("walking a sewn edge finds its partner and the right end and direction, for both seam directions", () => {
  reset();
  const A = panel(0), B = panel(500, 150, 300);
  const sm = makeSeam([], { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, false);     // A right ↔ B left
  const from = (start, dir) => walkPartner({ pid: A.id, shape: 0, start, dir }, [sm], S.pieces);
  // not reversed: A's start (200,0) sews to B's left edge's start (500,300)
  assert.deepStrictEqual(from(1, 1), { pid: B.id, shape: 0, start: 3, dir: 1, seam: 1 });
  assert.deepStrictEqual(from(2, -1), { pid: B.id, shape: 0, start: 0, dir: -1, seam: 1 }, "from the other end, both walk backward");
  sm.b[0].rev = true;                                            // reversed: A's start sews to B's left edge's END (500,0)
  assert.deepStrictEqual(from(1, 1), { pid: B.id, shape: 0, start: 0, dir: -1, seam: 1 });
  assert.deepStrictEqual(from(2, -1), { pid: B.id, shape: 0, start: 3, dir: 1, seam: 1 });
  // and from B's side
  assert.deepStrictEqual(walkPartner({ pid: B.id, shape: 0, start: 0, dir: -1 }, [sm], S.pieces), { pid: A.id, shape: 0, start: 1, dir: 1, seam: 1 });
  assert.strictEqual(from(0, 1), null, "an unsewn edge has no partner"); assert.strictEqual(from(1, -1), null, "walking away from the seam");
  // a run of two segments: its ends are the run's ends
  S.seams = [sm];
  addPoint(A, 1, 0.5);
  assert.deepStrictEqual(sm.a[0].sids.length, 2);
  assert.deepStrictEqual(walkPartner({ pid: A.id, shape: 0, start: 3, dir: -1 }, [sm], S.pieces), { pid: B.id, shape: 0, start: 3, dir: 1, seam: 1 });
  assert.strictEqual(walkPartner({ pid: A.id, shape: 0, start: 2, dir: 1 }, [sm], S.pieces), null, "the middle of a run is not an end");
});

/* ---- measurements ---- */

test("a measurement is tied to its points: it follows them, and survives points added and deleted elsewhere", () => {
  reset();
  const p = panel();
  const ms = { id: 1, a: mkAnchor(p, p, 0), b: mkAnchor(p, p, 2), kind: "line" };       // corner to opposite corner
  near(measureInfo(ms, S.pieces).len, Math.hypot(200, 300), 1e-9);
  p.pts[2] = V(260, 380);
  near(measureInfo(ms, S.pieces).len, Math.hypot(260, 380), 1e-9, "follows the point");
  addPoint(p, 0, 0.5); addPoint(p, 3, 0.5); deletePoint(p, 1);
  samePt(measureInfo(ms, S.pieces).b, V(260, 380), "still the same corner after edits elsewhere");
  near(measureInfo(ms, S.pieces).len, Math.hypot(260, 380), 1e-9);
  // across two patterns
  const q = panel(500);
  near(measureInfo({ id: 2, a: mkAnchor(p, p, 0), b: mkAnchor(q, q, 0), kind: "line" }, S.pieces).len, 500, 1e-9);
  // its point deleted: the measurement goes
  const idx = p.pts.findIndex(r => dist(r, V(260, 380)) < 1e-9);
  deletePoint(p, idx);
  assert.strictEqual(measureInfo(ms, S.pieces), null);
  assert.deepStrictEqual(validMeasures([ms], S.pieces), []);
});

test("measuring along the outline: forward from the first point to the second, through whatever lies between", () => {
  reset();
  const p = panel();
  setCurve(p, 1, true); p.segs[1].c1 = V(240, 100); p.segs[1].c2 = V(240, 200);
  const a = mkAnchor(p, p, 0), b = mkAnchor(p, p, 2), per = [0, 1, 2, 3].reduce((L, i) => L + segLen(p, i), 0);
  const one = measureInfo({ id: 1, a, b, kind: "along" }, S.pieces), other = measureInfo({ id: 2, a: b, b: a, kind: "along" }, S.pieces);
  assert.deepStrictEqual(one.segs, [0, 1]); assert.deepStrictEqual(other.segs, [2, 3]);
  near(one.len, 200 + segLen(p, 1), 1e-9); near(one.len + other.len, per, 1e-9, "the two ways round make the whole outline");
  assert.ok(one.len > Math.hypot(200, 300), "longer than the straight line");
  addPoint(p, 1, 0.4); addPoint(p, 0, 0.5);
  const again = measureInfo({ id: 1, a, b, kind: "along" }, S.pieces);
  assert.strictEqual(again.segs.length, 4, "it takes in the new points between"); near(again.len, one.len, 0.01);
  // points on different shapes fall back to the straight distance; the same point measures nothing along
  const ln = p.internals[addChild(p, "internals", mkShape([V(20, 20), V(80, 20), V(80, 100)], false))];
  near(measureInfo({ id: 3, a, b: mkAnchor(p, ln, 2), kind: "along" }, S.pieces).len, Math.hypot(80, 100), 1e-9);
  // along an open line, and its last point (which starts no segment)
  assert.deepStrictEqual(mkAnchor(p, ln, 2), { piece: p.id, shape: ln.id, sid: ln.segs[1].id, end: true });
  samePt(anchorAt(mkAnchor(p, ln, 2), S.pieces).pt, V(80, 100));
  near(measureInfo({ id: 4, a: mkAnchor(p, ln, 2), b: mkAnchor(p, ln, 0), kind: "along" }, S.pieces).len, 140, 1e-9, "either order on an open line");
});

test("guidelines and measurements are saved with the document", () => {
  reset();
  const p = panel(), q = panel(500);
  const guides = [{ id: 1, p: V(10, 20), a: 0.3 }, { id: 2, p: V(-5, 0), a: Math.PI/2 }];
  const measures = [{ id: 1, a: mkAnchor(p, p, 0), b: mkAnchor(q, q, 2), kind: "line" }, { id: 2, a: mkAnchor(p, p, 1), b: mkAnchor(p, p, 3), kind: "along" }];
  const text = JSON.stringify({ v: 8, nextId: S.nextId, nextSegId: S.nextSegId, nextShapeId: S.nextShapeId, guides, measures, pieces: S.pieces, seams: [] });
  reset(); loadDoc(JSON.parse(text));
  assert.deepStrictEqual(S.guides, guides); assert.deepStrictEqual(S.measures, measures);
  const bad = JSON.parse(text);
  bad.measures.push({ id: 3, a: { piece: 99, shape: 0, sid: 1 }, b: measures[0].b, kind: "line" }, null, { id: "x", a: measures[0].a, b: measures[0].b });
  bad.guides = "none";
  reset(); loadDoc(bad);
  assert.deepStrictEqual(S.measures.map(m => m.id), [1, 2], "a measurement to something that isn't there is dropped"); assert.deepStrictEqual(S.guides, []);
  const old = JSON.parse(text); delete old.guides; delete old.measures;
  reset(); loadDoc(old);
  assert.deepStrictEqual([S.guides, S.measures], [[], []], "older files simply have none");
});

module.exports = T;
