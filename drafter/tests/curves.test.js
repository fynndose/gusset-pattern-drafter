// Roadmap 2, batch 2, and Roadmap R5, batch 1: the curve point model. A curved segment is a
// handle curve (one cubic Bézier) or a curve-point curve (the curve of .zprj files: the natural cubic spline
// through its curve points, by chord length; ZPRJ.splineToBeziers() in zprj-import.js); every
// other part of the program must work on both. These tests check the spline itself, the
// operations that must not change a shape (adding a curve point, Add Point), and then
// each consumer in turn: lengths, picking, seams, seam allowance, notches and darts,
// walking, grading, offsets, slash & spread, symmetry, DXF, SVG, files.
"use strict";
const { oldSizeRun } = require("./harness");      // (Round r33 / 4) the size run every document had before r33: a document starts with none since (harness.js)
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");
const ZPRJ = require("../zprj-import.js");

const store = new Map();
const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const S = { pieces: [], seams: [], guides: [], measures: [], sel: [], selSeg: -1, selPt: -1, selKind: "outline", selInt: -1, tool: "edit_curve_point", selCp: null,
  nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null, grading: null, view: { s: 1, x: 0, y: 0 }, show: null, unit: "mm", dec: 1, prefs: null, shift: false };
const noop = () => {};
const G = load(["V", "cp", "dist", "sub", "add", "mul", "vlen", "clone", "bez", "bezTan", "mkShape", "rectShape", "mkPiece", "setCurve", "addChild", "nSeg", "sEnds",
  "isSpline", "chordKnots", "cpT", "retime", "knotMap", "knotIn", "withKnots", "CURVE_FIT", "segCurve", "curveAt", "segLen", "segPt", "segTan", "segTs", "flatten", "mapSeg", "revCurve", "insertCp", "deleteCp", "endMoved", "toHandles", "toCurvePoints", "segPathD",
  "lenTo", "tAtFrac", "addPoint", "deletePoint", "splitBez", "cutLine", "signedArea", "inside", "notchMarks", "NOTCH_DEFAULT", "dartGeom", "addDartTo",
  "VIEW_DEFAULT", "segNear", "hit", "toS", "mapPiece", "sync", "mkLinked", "unfold", "syncHalf", "affOf", "reflector",
  "seamInfo", "makeSeam", "validSeams", "rangePart", "partLen", "seamSide", "resolveRefs",
  "walkPath", "pathAt", "pathMarks", "walkPose",
  "defaultGrading", "normGrading", "gGroup", "ensureGrade", "setPtDelta", "gradedPiece", "ptKey",
  "offsetSeg", "offsetErr", "segHits", "slashSpread", "setSegLength", "moveSeg", "bendSeg",
  "shapeVerts", "dxfExport", "dxfParse", "dxfImport", "printInner", "normPrint", "printDefault",
  "normCurve", "oldSpline", "curvesIn", "migrate", "loadDoc", "checkDoc", "docJSON", "normProps",
], { S, localStorage, ui: noop, draw: noop, esc: (s) => String(s) });
const { V, cp, dist, sub, add, mul, vlen, clone, bez, mkShape, rectShape, mkPiece, setCurve, addChild, nSeg, sEnds, isSpline, chordKnots, cpT, knotIn, withKnots, CURVE_FIT, segCurve, segLen, segPt, segTan, segTs, flatten, mapSeg,
  insertCp, deleteCp, toHandles, toCurvePoints, segPathD, lenTo, tAtFrac, addPoint, deletePoint, cutLine, signedArea, notchMarks, NOTCH_DEFAULT, dartGeom, addDartTo, VIEW_DEFAULT, segNear, hit,
  mapPiece, sync, mkLinked, unfold, affOf, reflector, seamInfo, makeSeam, rangePart, partLen, seamSide, resolveRefs, walkPath, pathAt, pathMarks,
  defaultGrading, ensureGrade, setPtDelta, gradedPiece, offsetSeg, segHits, slashSpread, setSegLength, moveSeg, shapeVerts, dxfExport, dxfParse, dxfImport, printInner, normPrint,
  normCurve, migrate, loadDoc, checkDoc, docJSON } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, tol, msg) => assert.ok(dist(p, q) <= tol, (msg || "") + " expected (" + q.x + ", " + q.y + ") ±" + tol + ", got (" + p.x + ", " + p.y + ")");
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() {
  S.pieces = []; S.seams = []; S.guides = []; S.measures = []; S.sel = []; S.selSeg = S.selPt = S.selInt = -1; S.selKind = "outline"; S.selCp = null; S.tool = "edit_curve_point";
  S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.show = { ...VIEW_DEFAULT }; S.view = { s: 1, x: 0, y: 0 }; S.notch = { ...NOTCH_DEFAULT }; S.grading = oldSizeRun(); store.clear();
}
// the points of segment i at n evenly spaced parameters
const trace = (sh, i, n = 200) => Array.from({ length: n + 1 }, (_, k) => segPt(sh, i, k/n));
// how far two polylines are apart: every point of A to the nearest chord of B
function apart(A, B) {
  let worst = 0;
  for (const q of A) {
    let best = Infinity;
    for (let k = 0; k < B.length - 1; k++) {
      const a = B[k], r = sub(B[k+1], a), L2 = r.x*r.x + r.y*r.y, t = L2 < 1e-18 ? 0 : Math.min(1, Math.max(0, ((q.x-a.x)*r.x + (q.y-a.y)*r.y)/L2));
      best = Math.min(best, dist(q, V(a.x + r.x*t, a.y + r.y*t)));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}
// a 300 x 400 pattern whose right edge (segment 1) is a curve through the given curve points
function curved(cps) {
  const p = mkPiece("P", rectShape(0, 0, 300, 400));
  const s = p.segs[1];
  s.curved = true; s.c1 = s.c2 = null; s.cps = (cps || [V(360, 110), V(250, 250), V(330, 340)]).map(q => ({ x: q.x, y: q.y }));
  S.pieces.push(p);
  return p;
}
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}

/* ---------- the spline ---------- */
// the function that was checked against real project files, word for word: what the shared implementation is held to
function refSpline(P) {
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]), lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const n = P.length;
  if (n === 2) return [[P[0], lerp(P[0], P[1], 1 / 3), lerp(P[0], P[1], 2 / 3), P[1]]];
  const h = []; for (let i = 0; i < n - 1; i++) h.push(Math.max(dist(P[i], P[i + 1]), 1e-9));
  const M = Array.from({ length: n }, () => [0, 0]);
  const m = n - 2, cp = new Array(m).fill(0), dp = Array.from({ length: m }, () => [0, 0]);
  for (let i = 0; i < m; i++) {
    const a = h[i], b = 2 * (h[i] + h[i + 1]), c = h[i + 1];
    const rhs = [0, 1].map(k => 6 * ((P[i + 2][k] - P[i + 1][k]) / h[i + 1] - (P[i + 1][k] - P[i][k]) / h[i]));
    const den = i === 0 ? b : b - a * cp[i - 1];
    cp[i] = i < m - 1 ? c / den : 0;
    dp[i] = [0, 1].map(k => (rhs[k] - (i === 0 ? 0 : a * dp[i - 1][k])) / den);
  }
  for (let i = m - 1; i >= 0; i--) M[i + 1] = [0, 1].map(k => dp[i][k] - (i < m - 1 ? cp[i] * M[i + 2][k] : 0));
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const hi = h[i];
    const d0 = [0, 1].map(k => (P[i + 1][k] - P[i][k]) / hi - hi * (2 * M[i][k] + M[i + 1][k]) / 6);
    const d1 = [0, 1].map(k => (P[i + 1][k] - P[i][k]) / hi + hi * (M[i][k] + 2 * M[i + 1][k]) / 6);
    out.push([P[i], [P[i][0] + d0[0] * hi / 3, P[i][1] + d0[1] * hi / 3], [P[i + 1][0] - d1[0] * hi / 3, P[i + 1][1] - d1[1] * hi / 3], P[i + 1]]);
  }
  return out;
}
const A2 = (q) => [q.x, q.y], V2 = (a) => V(a[0], a[1]);
test("the spline is the one proven against real project files: natural, chord-length, through every point, direction and curvature continuous", () => {
  const P = [V(0, 0), V(60, 90), V(180, 40), V(240, 160), V(400, 150)], B = ZPRJ.splineToBeziers(P.map(A2)).map(Q => Q.map(V2));
  assert.strictEqual(B.length, 4);
  const h = P.slice(1).map((q, k) => dist(P[k], q));
  const d1 = (Q, t) => G.bezTan(Q[0], Q[1], Q[2], Q[3], t);
  const d2 = (Q, t) => { const a = sub(add(Q[2], Q[0]), mul(Q[1], 2)), b = sub(add(Q[3], Q[1]), mul(Q[2], 2)); return V(6*((1-t)*a.x + t*b.x), 6*((1-t)*a.y + t*b.y)); };
  for (let k = 0; k < 4; k++) { samePt(B[k][0], P[k], 1e-12); samePt(B[k][3], P[k+1], 1e-12); }
  for (let k = 0; k < 3; k++) {
    // the parameter is the length along the chords: each span is as long in it as its chord
    samePt(mul(d1(B[k], 1), 1/h[k]), mul(d1(B[k+1], 0), 1/h[k+1]), 1e-9, "first derivative at point " + (k + 1));
    samePt(mul(d2(B[k], 1), 1/(h[k]*h[k])), mul(d2(B[k+1], 0), 1/(h[k+1]*h[k+1])), 1e-9, "second derivative at point " + (k + 1));
  }
  near(vlen(d2(B[0], 0)), 0, 1e-9, "no curvature at the start"); near(vlen(d2(B[3], 1)), 0, 1e-9, "nor at the end");
  // points in a line: a straight line
  for (const Q of ZPRJ.splineToBeziers([[0, 0], [30, 40], [90, 120]])) for (let k = 0; k <= 10; k++) { const q = bez(V2(Q[0]), V2(Q[1]), V2(Q[2]), V2(Q[3]), k/10); near(q.y*3 - q.x*4, 0, 1e-9, "on the line"); }
  // and it is the handoff's function to the last bit, on 400 random runs of 2 to 9 points
  let seed = 11; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
  for (let run = 0; run < 400; run++) {
    const pts = Array.from({ length: 2 + Math.floor(rnd()*8) }, () => [rnd()*600 - 300, rnd()*600 - 300]);
    assert.deepStrictEqual(ZPRJ.splineToBeziers(pts), refSpline(pts), "run " + run);
  }
});

test("an end can be held to a direction (this program's own addition); with none given the curve is the natural one", () => {
  const P = [[0, 0], [60, 90], [180, 40], [240, 160], [400, 150]], d0 = [0.8, -0.6], d1 = [0.2, 1.1];
  const h = P.slice(1).map((q, k) => Math.hypot(q[0] - P[k][0], q[1] - P[k][1]));
  const C = ZPRJ.splineToBeziers(P, d0, d1), dP = (Q, end, hh) => end ? [(Q[3][0] - Q[2][0])*3/hh, (Q[3][1] - Q[2][1])*3/hh] : [(Q[1][0] - Q[0][0])*3/hh, (Q[1][1] - Q[0][1])*3/hh];
  dP(C[0], 0, h[0]).forEach((v, k) => near(v, d0[k], 1e-9, "the start leaves as told")); dP(C[3], 1, h[3]).forEach((v, k) => near(v, d1[k], 1e-9, "the end arrives as told"));
  for (let k = 0; k < 3; k++) dP(C[k], 1, h[k]).forEach((v, j) => near(v, dP(C[k+1], 0, h[k+1])[j], 1e-9, "direction continuous at point " + (k + 1)));
  // one end held, the other free: no curvature at the free one
  const D = ZPRJ.splineToBeziers(P, d0, null), Q = D[3];
  near(Math.hypot(Q[3][0] - 2*Q[2][0] + Q[1][0], Q[3][1] - 2*Q[2][1] + Q[1][1]), 0, 1e-9);
  // held to the direction the natural curve has anyway: the natural curve
  const N = ZPRJ.splineToBeziers(P), E = ZPRJ.splineToBeziers(P, dP(N[0], 0, h[0]), dP(N[3], 1, h[3]));
  N.forEach((Qn, k) => Qn.forEach((q, j) => { near(E[k][j][0], q[0], 1e-9); near(E[k][j][1], q[1], 1e-9); }));
  // two points: one cubic with both handles as told
  const two = ZPRJ.splineToBeziers([[0, 0], [100, 0]], [0, 1], [0, -1])[0];
  near(two[1][1], 100/3, 1e-9); near(two[2][1], 100/3, 1e-9);
});

test("a segment's curve is that spline through its start, its curve points and its end; its knots are the chord lengths", () => {
  reset();
  const p = curved(), s = p.segs[1], P = [p.pts[1], ...s.cps, p.pts[2]], cv = segCurve(p, 1);
  const want = ZPRJ.splineToBeziers(P.map(A2));
  cv.B.forEach((Q, k) => Q.forEach((q, j) => samePt(q, V2(want[k][j]), 1e-12, "piece " + k)));
  let cum = 0; const tot = P.slice(1).reduce((a, q, k) => a + dist(P[k], q), 0);
  s.cps.forEach((c, k) => { cum += dist(P[k], P[k+1]); near(cv.U[k+1], cum/tot, 1e-12, "knot " + k); near(cpT(p, 1, k), cum/tot, 1e-12); samePt(segPt(p, 1, cpT(p, 1, k)), c, 1e-9, "the curve goes through it"); });
  assert.ok(s.cps.every(c => c.u === undefined), "no knot is stored with a curve point");
  // each line is a spline of its own: the corner where it meets the next line stays a corner
  insertCp(p, 2, 0.5); p.segs[2].cps[0].y += 40;
  assert.ok(dist(segTan(p, 1, 1), segTan(p, 2, 0)) > 0.3, "a kink between two lines is correct");
});

test("a curve's pieces are worked out once and again only when its numbers change", () => {
  reset();
  const p = curved();
  const a = segCurve(p, 1); assert.strictEqual(segCurve(p, 1), a, "the same answer object while nothing changes");
  p.segs[1].cps[1].x += 5;
  const b = segCurve(p, 1); assert.notStrictEqual(b, a); assert.strictEqual(b.B.length, 4);
  p.pts[2] = V(310, 420);
  assert.notStrictEqual(segCurve(p, 1), b, "an end point moved");
  assert.strictEqual(segCurve(p, 0), null, "a straight segment has no curve");
  setCurve(p, 3, true);
  assert.strictEqual(segCurve(p, 3).B.length, 1, "a handle curve is one piece");
});

/* ---------- operations that must not change the shape ---------- */
test("adding a curve point: exact on a straight segment, the curve is drawn again through one more point otherwise, and what sits on it keeps its place", () => {
  reset();
  const p = curved();
  setCurve(p, 3, true); p.segs[3].c1 = V(-80, 300); p.segs[3].c2 = V(60, 90);
  p.segs[1].notches = [0.2, 0.61]; p.segs[3].notches = [0.5]; p.segs[0].notches = [0.3];
  // how far the curve may shift: nothing on a straight line; a little on a handle curve; on this wild S (swinging 110 mm
  // over 400) a few millimetres, as any curve drawn through one more point does
  const shift = { 0: 1e-9, 1: 4.5, 3: 1.2 };
  for (const i of [0, 1, 3]) for (const t of [0.07, 0.31, 0.5, 0.83, 0.99]) {
    const q = clone(p), before = trace(q, i, 600), places = q.segs[i].notches.map(u => segPt(q, i, u));
    const c = insertCp(q, i, t);
    assert.ok(isSpline(q.segs[i]), "it is a curve-point curve now"); samePt(q.segs[i].cps[c], segPt(p, i, t), 1e-9, "the new point is where it was clicked");
    samePt(segPt(q, i, cpT(q, i, c)), q.segs[i].cps[c], 1e-9, "and the curve goes through it");
    const d = apart(trace(q, i, 600), before);
    assert.ok(d <= shift[i], "segment " + i + " at t " + t + ": the curve shifted " + d);
    q.segs[i].notches.forEach((u, k) => assert.ok(dist(segPt(q, i, u), places[k]) <= d + 0.6, "notch " + k + " stays where it was, on the curve as it is now: " + dist(segPt(q, i, u), places[k])));
  }
  // on a gentle curve, as a neckline or an armhole is, the shift is a fraction of a millimetre
  const g = curved([V(322, 130), V(318, 270)]), was = trace(g, 1, 600);
  insertCp(g, 1, 0.5);
  assert.ok(apart(trace(g, 1, 600), was) < 0.2, "a gentle curve: " + apart(trace(g, 1, 600), was));
  // points are kept in order along the curve
  const q = clone(p);
  for (let k = 1; k <= 12; k++) insertCp(q, 1, (k*0.6180339887) % 1);
  assert.strictEqual(q.segs[1].cps.length, 15);
  const U = segCurve(q, 1).U;
  for (let k = 1; k < U.length; k++) assert.ok(U[k] > U[k-1], "knots rise");
});

test("Add Point on a curve-point curve: both halves stay on the whole (curve points are added where needed), lengths add up, notches stay", () => {
  reset();
  for (const t of [0.08, 0.27, 0.5, 0.64, 0.9]) {
    reset();
    const p = curved(), whole = trace(p, 1, 3000), L = segLen(p, 1), n = p.segs[1].cps.length;
    p.segs[1].notches = [0.15, 0.55, 0.8];
    const places = p.segs[1].notches.map(u => segPt(p, 1, u));
    addPoint(p, 1, t);
    assert.strictEqual(p.pts.length, 5); samePt(p.pts[2], whole[Math.round(t*3000)], 1e-6, "the new point is on the curve");
    const both = [...trace(p, 1, 300), ...trace(p, 2, 300)];
    // this S is as wild as a pattern curve gets; the halves are held to within a third of a millimetre of it
    assert.ok(apart(both, whole) < 0.35, "t " + t + ": the halves lie on the old curve (" + apart(both, whole) + ")");
    assert.ok(apart(whole, both) < 0.35, "and cover all of it");
    near(segLen(p, 1) + segLen(p, 2), L, 0.5, "the lengths add up");
    assert.ok((p.segs[1].cps || []).length + (p.segs[2].cps || []).length >= n - 1, "no curve point lost");
    const now = [...p.segs[1].notches.map(u => segPt(p, 1, u)), ...p.segs[2].notches.map(u => segPt(p, 2, u))];
    places.forEach((q, k) => samePt(now[k], q, 0.35, "notch " + k + " stays put"));
    // direction is continuous through the new point
    samePt(segTan(p, 1, 1), segTan(p, 2, 0), 1e-5);
  }
  // a gentle curve keeps its shape to a tenth of a millimetre, with few or no curve points added
  reset();
  const g = curved([V(322, 130), V(318, 270)]), gw = trace(g, 1, 3000);
  addPoint(g, 1, 0.4);
  assert.ok(apart([...trace(g, 1, 300), ...trace(g, 2, 300)], gw) <= 0.1 + 1e-9);
  assert.ok((g.segs[1].cps || []).length + (g.segs[2].cps || []).length <= 5);
  // cutting exactly on a curve point: it becomes the segment point, the rest stay
  reset();
  const p = curved(), whole = trace(p, 1, 3000), u = cpT(p, 1, 1), at = cp(p.segs[1].cps[1]);
  addPoint(p, 1, u);
  samePt(p.pts[2], at, 1e-9); assert.ok(p.segs[1].cps.length >= 1 && p.segs[2].cps.length >= 1);
  assert.ok(apart([...trace(p, 1, 300), ...trace(p, 2, 300)], whole) < 0.35);
  // a half with no curve point left is a single cubic: a handle curve, exactly the stretch it replaces
  reset();
  const one = curved([V(360, 200)]), ow = trace(one, 1, 3000);
  addPoint(one, 1, 0.3);
  assert.strictEqual(isSpline(one.segs[1]), false); assert.ok(one.segs[1].curved && one.segs[1].c1 && one.segs[1].c2, "the short half is a handle curve");
  assert.ok(apart(trace(one, 1, 300), ow) < 1e-3, "and it retraces the whole exactly");
  assert.ok(one.segs[2].cps.length >= 1);
});

test("three splits in a row and a random run of splits: the outline stays where it was", () => {
  reset();
  const p = curved(), whole = trace(p, 1, 3000), L = segLen(p, 1);
  addPoint(p, 1, 0.5); addPoint(p, 1, 0.5); addPoint(p, 2, 0.4); addPoint(p, 3, 0.9);
  const parts = [1, 2, 3, 4, 5].flatMap(i => trace(p, i, 200));
  assert.ok(apart(parts, whole) < 0.5, "four splits: " + apart(parts, whole)); near([1, 2, 3, 4, 5].reduce((a, i) => a + segLen(p, i), 0), L, 0.8);
  let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
  let worst = 0;
  for (let run = 0; run < 12; run++) {
    reset();
    const q = curved([V(320 + rnd()*80, 80), V(240 + rnd()*60, 200), V(330 + rnd()*40, 320)]), ref = trace(q, 1, 3000);
    for (let k = 0; k < 6; k++) { const i = 1 + Math.floor(rnd()*(q.pts.length - 3)); if (i >= 1 && i <= q.pts.length - 3) addPoint(q, i, 0.1 + rnd()*0.8); }
    const all = []; for (let i = 1; i <= q.pts.length - 3; i++) all.push(...trace(q, i, 150));
    worst = Math.max(worst, apart(all, ref));
    checkDoc(S.pieces, S.seams);
  }
  assert.ok(worst < 0.8, "six random splits of a wild curve, twelve times: at worst " + worst);
});

test("a handle curve becomes curve points to within a tenth of a millimetre, and a one-piece curve becomes handles", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 300, 400)); S.pieces.push(p);
  setCurve(p, 1, true); p.segs[1].c1 = V(420, 60); p.segs[1].c2 = V(180, 330);
  p.segs[1].notches = [0.3];
  const before = trace(p, 1, 2000), notch = segPt(p, 1, 0.3);
  toCurvePoints(p, 1);
  assert.ok(p.segs[1].cps.length >= 2 && p.segs[1].cps.length <= 13, p.segs[1].cps.length + " curve points"); assert.strictEqual(p.segs[1].c1, null);
  assert.ok(apart(trace(p, 1, 400), before) <= CURVE_FIT + 1e-6, "the same shape: " + apart(trace(p, 1, 400), before));
  const d0 = sub(V(420, 60), V(300, 0)); samePt(segTan(p, 1, 0), mul(d0, 1/vlen(d0)), 1e-9, "it leaves as the handle curve did");
  assert.ok(dist(segPt(p, 1, p.segs[1].notches[0]), notch) < 0.3, "the notch stays where it was");
  // a gentle handle curve needs only two
  reset();
  const g = mkPiece("G", rectShape(0, 0, 300, 400)); S.pieces.push(g);
  setCurve(g, 1, true); g.segs[1].c1 = V(318, 130); g.segs[1].c2 = V(318, 270);
  toCurvePoints(g, 1);
  assert.strictEqual(g.segs[1].cps.length, 2);
  // (Round r30 / 2, the maintainer's decision: taking every curve point out leaves a straight line; it used to leave a handle curve
  // that left and arrived as the curve-point curve did)
  deleteCp(g, 1, 1); deleteCp(g, 1, 0);
  assert.strictEqual(isSpline(g.segs[1]), false); assert.strictEqual(g.segs[1].curved, false); assert.strictEqual(g.segs[1].c1, null);
  // a curve-point curve with several pieces is fitted
  reset();
  const q = curved([V(340, 130), V(350, 270)]), was = trace(q, 1);
  toHandles(q, 1);
  assert.strictEqual(isSpline(q.segs[1]), false); assert.ok(apart(trace(q, 1), was) < 3, "a single cubic near it: " + apart(trace(q, 1), was));
  // the last curve point of a plain curve taken out: straight again
  reset();
  const r = curved([V(360, 200)]);
  deleteCp(r, 1, 0);
  assert.strictEqual(r.segs[1].curved, false); assert.strictEqual(r.segs[1].cps, undefined);
});

/* ---------- reshaping ---------- */
test("moving a curve point: the curve goes through it and the knots follow the points; taking one out keeps what sits on the curve in place", () => {
  reset();
  const p = curved(), U0 = segCurve(p, 1).U.slice();
  p.segs[1].cps[1].x = 180; p.segs[1].cps[1].y = 230;
  const s = p.segs[1], P = [p.pts[1], ...s.cps, p.pts[2]], U = segCurve(p, 1).U;
  assert.ok(Math.abs(U[2] - U0[2]) > 1e-3, "the knots moved with the point");
  let cum = 0; const tot = P.slice(1).reduce((a, q, k) => a + dist(P[k], q), 0);
  s.cps.forEach((c, k) => { cum += dist(P[k], P[k+1]); near(U[k+1], cum/tot, 1e-12, "point " + k + " at its share of the chord length"); samePt(segPt(p, 1, U[k+1]), c, 1e-9, "the curve goes through it"); });
  samePt(segPt(p, 1, 0), p.pts[1], 1e-12); samePt(segPt(p, 1, 1), p.pts[2], 1e-12);
  // it is exactly the curve the file format's own function draws through those points
  const want = ZPRJ.splineToBeziers(P.map(A2));
  segCurve(p, 1).B.forEach((Q, k) => Q.forEach((q, j) => samePt(q, V2(want[k][j]), 1e-12)));
  // an end direction (from a split) keeps its angle when a curve point is moved
  addPoint(p, 1, 0.5);
  const dir = segTan(p, 1, 1);
  p.segs[1].cps[0].x += 40;
  samePt(segTan(p, 1, 1), dir, 1e-9, "the curve still arrives at the split point the same way");
  samePt(segTan(p, 2, 0), dir, 1e-5, "and leaves it the same way: the join stays smooth");
  // a notch between two curve points keeps its place between them when a third is taken out
  reset();
  const d = curved(); d.segs[1].notches = [cpT(d, 1, 1)*0.5 + cpT(d, 1, 2)*0.5];
  deleteCp(d, 1, 0);
  near(d.segs[1].notches[0], cpT(d, 1, 0)*0.5 + cpT(d, 1, 1)*0.5, 1e-9, "half-way between the same two curve points");
  // two curve points on top of each other do not break anything
  const q = curved([V(350, 150), V(350, 150), V(340, 300)]);
  assert.ok(Number.isFinite(segLen(q, 1)));
  checkDoc(S.pieces, S.seams);
});

test("moving a segment point or a whole segment: curve points stay where they are, or travel with their segment", () => {
  reset();
  const p = curved(), cps = p.segs[1].cps.map(cp);
  // the end point of the curve moves: the curve points stay put and the curve still runs through them
  const dv = V(30, 25); p.pts[2] = add(p.pts[2], dv); G.endMoved(p, 1, 1, dv); G.endMoved(p, 2, 0, dv);
  p.segs[1].cps.forEach((c, k) => { samePt(c, cps[k], 1e-12); samePt(segPt(p, 1, cpT(p, 1, k)), c, 1e-9); });
  samePt(segPt(p, 1, 1), p.pts[2], 1e-12);
  // the whole segment moves: its curve points go with it, and its shape is the same
  const before = trace(p, 1);
  moveSeg(p, 1, V(-12, 40));
  trace(p, 1).forEach((q, k) => samePt(q, add(before[k], V(-12, 40)), 1e-9));
  // a neighbour that is a curve-point curve follows the shared point
  reset();
  const q = curved(); insertCp(q, 2, 0.5); q.segs[2].cps[0].y += 30;
  const mid = cp(q.segs[2].cps[0]);
  moveSeg(q, 1, V(20, 0));
  samePt(q.segs[2].cps[0], mid, 1e-12, "the neighbour's curve point stays"); samePt(segPt(q, 2, 0), q.pts[2], 1e-12, "and its curve starts at the moved point");
  // Set Length scales a curve about its fixed end: exact length, same shape
  reset();
  const r = curved(), L = segLen(r, 1);
  assert.strictEqual(setSegLength(r, 1, L*1.25, 1, false), true);
  near(segLen(r, 1), L*1.25, 0.02);
});

test("Delete Point between two curves: one curve through all their curve points; a turn, flip or scale keeps the shape exactly", () => {
  reset();
  const p = curved(); insertCp(p, 2, 0.4); p.segs[2].cps[0].y += 40;
  const through = [...p.segs[1].cps, ...p.segs[2].cps].map(cp), id = p.segs[1].id;
  deletePoint(p, 2);
  assert.strictEqual(p.pts.length, 3); assert.strictEqual(p.segs[1].id, id, "the first segment is the one that grows");
  assert.strictEqual(p.segs[1].cps.length, 4);
  through.forEach((q, k) => { samePt(p.segs[1].cps[k], q, 1e-12); samePt(segPt(p, 1, cpT(p, 1, k)), q, 1e-9, "the merged curve runs through curve point " + k); });
  checkDoc(S.pieces, S.seams);
  // a move, turn, flip or even scaling of the pattern maps the curve exactly: the chord lengths keep their proportions
  reset();
  const a = curved(); addPoint(a, 1, 0.37);
  for (const f of [(q) => V(q.x + 50, q.y - 20), (q) => V(-q.y, q.x), (q) => V(600 - q.x, q.y), (q) => V(q.x*1.7, q.y*1.7)]) {
    const b = clone(a), want = [1, 2].flatMap(i => trace(a, i, 60)).map(f);
    mapPiece(b, f);
    [1, 2].flatMap(i => trace(b, i, 60)).forEach((q, k) => samePt(q, want[k], 1e-7));
  }
  // stretched one way only, the chords change their proportions: the curve still goes through the mapped curve points
  const st = clone(a), f2 = (q) => V(q.x*1.7, q.y*0.6); mapPiece(st, f2);
  a.segs[2].cps.forEach((c, k) => { samePt(st.segs[2].cps[k], f2(c), 1e-9); samePt(segPt(st, 2, cpT(st, 2, k)), f2(c), 1e-9); });
});

/* ---------- lengths, places, picking ---------- */
test("lengths and places along a curve-point curve: arc length, length up to a place, place at a share of the length", () => {
  reset();
  const p = curved(), fine = trace(p, 1, 20000);
  let L = 0; for (let k = 1; k < fine.length; k++) L += dist(fine[k-1], fine[k]);
  near(segLen(p, 1), L, L*2e-4, "arc length"); near(lenTo(p, 1, 1), segLen(p, 1), 1e-9); near(lenTo(p, 1, 0), 0, 1e-12);
  let acc = 0;
  for (const t of [0.1, 0.33, 0.5, 0.77, 0.95]) {
    acc = 0; for (let k = 1; k <= Math.round(t*20000); k++) acc += dist(fine[k-1], fine[k]);
    near(lenTo(p, 1, t), acc, 0.03, "length up to " + t);
    near(lenTo(p, 1, tAtFrac(p, 1, t)), t*segLen(p, 1), 0.05, "the place at " + t + " of the length");
  }
  // sampling: every curve point is one of the samples, and they rise
  const ts = segTs(p, 1, 26);
  p.segs[1].cps.forEach((c, k) => assert.ok(ts.some(t => Math.abs(t - cpT(p, 1, k)) < 1e-12), "a sample on each curve point"));
  for (let k = 1; k < ts.length; k++) assert.ok(ts[k] > ts[k-1]);
  assert.strictEqual(flatten(p, 26).length, 4 + ts.length);
});

test("picking: a curve-point curve is picked along its whole length at any zoom; its curve points only with Edit Curve Point", () => {
  reset();
  const p = curved();
  for (const s of [0.3, 1, 8]) {
    S.view = { s, x: 20, y: 30 };
    for (let k = 1; k < 100; k++) {
      const q = segPt(p, 1, k/100), tn = segTan(p, 1, k/100), n = segNear(p, 1, q.x*s + 20 + tn.y*3, q.y*s + 30 - tn.x*3);
      assert.ok(n.d <= 3.001, "3 px off at t " + k/100 + ", zoom " + s + ": " + n.d);
    }
  }
  S.view = { s: 1, x: 0, y: 0 };
  const c = p.segs[1].cps[1];
  S.tool = "edit_curve_point";
  let h = hit(c.x + 2, c.y - 1); assert.strictEqual(h.k, "cp"); assert.strictEqual(h.i, 1); assert.strictEqual(h.c, 1);
  for (const tool of ["edit_pattern", "transform_pattern", "add_point", "notch", "segment_sewing"]) { S.tool = tool; assert.strictEqual(hit(c.x + 2, c.y - 1).k, "seg", tool + " sees the line, not the curve point"); }
  S.tool = "edit_pattern"; assert.strictEqual(hit(c.x + 2, c.y - 1, { menu: true }).k, "cp", "a right-click reaches it with any tool");
});

/* ---------- seams, allowance, notches, darts, walking ---------- */
test("seams on a curve-point curve: its arc length, part of it by Free Sewing, kept through Add Point and curve points added", () => {
  reset();
  const p = curved([V(322, 130), V(318, 270)]), q = mkPiece("Q", rectShape(500, 0, 100, 500)); S.pieces.push(q);
  const part = (pc, i) => ({ piece: pc.id, shape: 0, sids: [pc.segs[i].id], t0: 0, t1: 1, rev: false });
  S.seams.push(makeSeam(S.seams, [part(p, 1)], [part(q, 3)]));
  let inf = seamInfo(S.seams[0], S.pieces);
  near(inf.la, segLen(p, 1), 1e-9); near(inf.diff, segLen(p, 1) - 500, 1e-9);
  const L = inf.la;
  insertCp(p, 1, 0.42); S.seams = resolveRefs(S.pieces, S.seams);
  near(seamInfo(S.seams[0], S.pieces).la, L, 0.2, "a curve point added: the same length, to what the curve shifts");
  addPoint(p, 1, 0.6); S.seams = resolveRefs(S.pieces, S.seams);
  inf = seamInfo(S.seams[0], S.pieces);
  assert.strictEqual(S.seams[0].a[0].sids.length, 2, "Add Point: the seam runs over both halves"); near(inf.la, L, 0.25);
  // a free range over part of the curve
  reset();
  const r = curved([V(322, 130), V(318, 270)]), X = { p: r, sh: r, ix: [1] };
  const fr = rangePart(r.id, 0, r, { i: 1, t: 0.2 }, { i: 1, t: 0.7 }, false);
  near(partLen(seamSide(fr, S.pieces), fr), lenTo(r, 1, 0.7) - lenTo(r, 1, 0.2), 0.05);
  const place = [segPt(r, 1, 0.2), segPt(r, 1, 0.7)];
  S.seams.push({ id: 9, a: [fr], b: [{ piece: r.id, shape: 0, sids: [r.segs[3].id], t0: 0, t1: 1, rev: false }] });
  insertCp(r, 1, 0.45);
  samePt(segPt(r, 1, fr.t0), place[0], 0.3, "the range starts where it did"); samePt(segPt(r, 1, fr.t1), place[1], 0.3, "and ends where it did");
  assert.ok(Math.abs(fr.t1 - 0.7) > 1e-7, "its parameters were moved to keep it there");
  assert.ok(X);
});

test("seam allowance along a curve-point curve: the cut line is the allowance away from it everywhere", () => {
  reset();
  const p = curved([V(330, 120), V(280, 250), V(320, 330)]);
  p.segs[1].sa = 12;
  const cut = cutLine(p), seam = trace(p, 1, 2000);
  const on = cut.filter(q => q.x > 262 && q.y > 30 && q.y < 370);
  assert.ok(on.length > 30, "plenty of cut-line points along the curve: " + on.length);
  for (const q of on) near(Math.min(...seam.map(r => dist(q, r))), 12, 0.05, "12 from the seam line");
  const band = Math.abs(signedArea(cut)) - Math.abs(signedArea(flatten(p, 60)));
  near(band, 12*segLen(p, 1), 12*segLen(p, 1)*0.08, "the band's area is about allowance times length");
});

test("notches and darts on a curve-point curve sit on the curve and stay there when it is split", () => {
  reset();
  const p = curved([V(330, 120), V(310, 250), V(320, 330)]);
  p.segs[1].notches = [0.25, 0.75];
  const marks = notchMarks(p, { ...S.notch, dup: false });
  marks.forEach((ln, k) => samePt(ln[0], segPt(p, 1, p.segs[1].notches[k]), 1e-9, "the notch starts on the curve"));
  addDartTo(p, 1, 0.5, 20, 60, false);
  const g0 = dartGeom(p, p.darts[0]);
  assert.ok(g0 && Number.isFinite(g0.apex.x)); near(dist(g0.C, segPt(p, 1, 0.5)), 0, 1e-6, "the dart's middle is on the curve");
  addPoint(p, 1, 0.2);
  const g1 = dartGeom(p, p.darts[0]);
  samePt(g1.apex, g0.apex, 0.25, "the dart point stays"); samePt(g1.C, g0.C, 0.15);
  checkDoc(S.pieces, S.seams);
});

test("walking along a curve-point curve goes by arc length", () => {
  reset();
  const p = curved(), path = walkPath(p, 1, 1), marks = pathMarks(p, path);
  near(marks[1], segLen(p, 1), 1e-9);
  for (const f of [0.2, 0.5, 0.9]) { const at = pathAt(p, path, f*marks[1]); assert.strictEqual(at.i, 1); near(lenTo(p, 1, at.t), f*marks[1], 0.05); samePt(at.p, segPt(p, 1, at.t), 1e-12); }
});

/* ---------- grading, offsets, slash, symmetry ---------- */
test("grading: curve points travel with the two ends of their segment, each by its place between them", () => {
  reset();
  const p = curved(), G0 = S.grading, grp = G0.groups[0], z = grp.sizes.find(x => x.id !== grp.base).id;
  ensureGrade(G0, p);
  setPtDelta(G0, p, p, 1, z, 10, 0); setPtDelta(G0, p, p, 2, z, 30, 0); setPtDelta(G0, p, p, 0, z, 0, 0); setPtDelta(G0, p, p, 3, z, 0, 0);
  const g = gradedPiece(G0, p, z);
  assert.ok(g && isSpline(g.segs[1]));
  g.segs[1].cps.forEach((c, k) => { const o = p.segs[1].cps[k]; near(c.x - o.x, 10 + 20*cpT(p, 1, k), 1e-9, "curve point " + k + " moves between the two ends' amounts"); near(c.y, o.y, 1e-9); });
  samePt(segPt(g, 1, 0), add(p.pts[1], V(10, 0)), 1e-9); samePt(segPt(g, 1, 1), add(p.pts[2], V(30, 0)), 1e-9);
  // the same step at both ends: the curve is simply moved
  setPtDelta(G0, p, p, 2, z, 10, 0);
  const g2 = gradedPiece(G0, p, z), a = trace(p, 1, 50), b = trace(g2, 1, 50);
  b.forEach((q, k) => samePt(q, add(a[k], V(10, 0)), 1e-9));
});

test("Offset as Internal Line, intersections and Slash & Spread work on a curve-point curve", () => {
  reset();
  const p = curved([V(330, 120), V(290, 250), V(320, 330)]);
  const off = offsetSeg(p, 1, 15), seam = trace(p, 1, 3000);
  assert.ok(off.segs.length >= 4, "at least a piece per span");
  for (let i = 0; i < nSeg(off); i++) for (let k = 0; k <= 12; k++) near(Math.min(...seam.map(r => dist(segPt(off, i, k/12), r))), 15, 0.06, "the offset line is 15 from the curve");
  // a line across the curve meets it once, at a point on both
  const line = mkShape([V(200, 200), V(420, 215)], false), hits = segHits(p, 1, line, 0);
  assert.strictEqual(hits.length, 1); samePt(segPt(p, 1, hits[0].t), hits[0].p, 1e-6); near(hits[0].p.y - 200, (hits[0].p.x - 200)*15/220, 1e-6);
  // slash from the top edge to the bottom edge: the curve is on the side that moves, and keeps its shape
  const L = segLen(p, 1);
  addPoint(p, 0, 0.5); addPoint(p, 3, 0.5);
  const before = segLen(p, 2);
  assert.ok(slashSpread(p, 1, 4, 0, 40));
  const curve = p.segs.findIndex(s => isSpline(s));
  near(segLen(p, curve), before, 1e-6, "moved rigidly: same length"); near(before, L, 1e-6);
  checkDoc(S.pieces, S.seams);
});

test("symmetry: a linked copy and the mirrored half of an unfold are mirror images of a curve-point curve", () => {
  reset();
  const p = curved(), M = reflector(V(500, 0), V(500, 400));
  const c = mkLinked(p, "symmetric", affOf(M)); S.pieces.push(c); sync();
  trace(c, 1, 40).forEach((q, k) => samePt(q, M(segPt(p, 1, k/40)), 1e-9));
  p.segs[1].cps[0].x += 25; sync();
  trace(c, 1, 40).forEach((q, k) => samePt(q, M(segPt(p, 1, k/40)), 1e-9, "the copy follows an edit"));
  // unfold across the left edge (segment 3): the curve's mirror image runs the other way on the new half
  const u = unfold(p, 3); S.pieces.push(u);
  const F = reflector(p.pts[3], p.pts[0]), mi = u.segs.findIndex((s, i) => isSpline(s) && i !== u.segs.findIndex(x => x.id === p.segs[1].id));
  assert.ok(mi >= 0, "the mirrored half has a curve-point curve too");
  const src = u.segs.findIndex(x => x.id === p.segs[1].id);
  trace(u, mi, 40).forEach((q, k) => samePt(q, F(segPt(u, src, 1 - k/40)), 1e-9, "mirror image, run the other way"));
  u.segs[src].cps[1].y += 15; G.syncHalf(u);
  const mi2 = u.segs.findIndex((s, i) => isSpline(s) && i !== src);
  trace(u, mi2, 40).forEach((q, k) => samePt(q, F(segPt(u, src, 1 - k/40)), 1e-9, "and it follows edits"));
  checkDoc(S.pieces, S.seams);
});

/* ---------- output and files ---------- */
test("SVG and print: a curve-point curve is written as its cubic pieces, exactly", () => {
  reset();
  const p = curved();
  const d = segPathD(p, 1, (q) => q.x.toFixed(4) + "," + q.y.toFixed(4));
  assert.strictEqual((d.match(/ C /g) || []).length, 4, "one cubic per span");
  assert.ok(d.endsWith(p.pts[2].x.toFixed(4) + "," + p.pts[2].y.toFixed(4)));
  assert.strictEqual(segPathD(p, 0, (q) => q.x + "," + q.y), " L 300,0");
  const svg = printInner([p], normPrint(null), "mm");
  assert.ok((svg.match(/ C /g) || []).length >= 4, "the print drawing has the curve");
  assert.ok(!/NaN|undefined|null/.test(svg));
});

test("DXF: a curve-point curve goes out as points on the curve (the curve points among them) and comes back within tolerance", () => {
  reset();
  const p = curved([V(330, 120), V(290, 250), V(320, 330)]);
  const seam = trace(p, 1, 3000);
  for (const opt of [true, false]) {
    const vs = shapeVerts(p, opt), mids = vs.filter(v => !v.turn);
    assert.strictEqual(vs.filter(v => v.turn).length, 4);
    assert.ok(mids.length >= 6);
    assert.ok(apart(mids.map(v => v.p), seam) < 1e-3, "every vertex is on the curve");
    if (opt) for (const c of p.segs[1].cps) assert.ok(mids.some(v => dist(v.p, c) < 1e-9), "each curve point is a vertex");
    // the polyline stays within the export's tolerance of the curve
    const run = [p.pts[1], ...mids.map(v => v.p), p.pts[2]];
    assert.ok(apart(seam, run) < (opt ? 0.11 : 0.6), "polyline within tolerance: " + apart(seam, run));
  }
  const text = dxfExport(S.pieces, { format: "aama", unit: "mm", scale: 1, rotate: 0, straight: false, optimise: true, noBase: false, noGrade: true, dupNotch: false }, S.grading);
  const back = dxfImport(text, { append: false, autoScale: true, scale: 1, angle: 0, swap: false, toSA: true, optimise: true, notches: true, internals: true, annotations: true, distribute: false });
  assert.ok(back && back.pieces && back.pieces.length === 1);
  const b = back.pieces[0], pts = []; for (let i = 0; i < nSeg(b); i++) pts.push(...trace(b, i, 80));
  // the pattern is back where it was to within the fit (compare outlines, wherever the importer put it)
  const o = sub(b.pts.reduce((m, q) => (q.x + q.y < m.x + m.y ? q : m)), p.pts[0]);
  const ref = []; for (let i = 0; i < nSeg(p); i++) ref.push(...trace(p, i, 400));
  assert.ok(apart(pts.map(q => sub(q, o)), ref) < 0.6, "outline back within 0.6 mm: " + apart(pts.map(q => sub(q, o)), ref));
});

test("files: curve points are saved and read back; junk is dropped; a file from before curve points opens unchanged", () => {
  reset();
  const p = curved(); addPoint(p, 1, 0.4); S.nextId = 5;
  const text = docJSON(), d = JSON.parse(text);
  assert.strictEqual(d.v, 31);      // ((Round H1a: version 31) (Round r34: version 30) ((Round r33b: version 29) version 28 since Round r30 (a seam's mirror); 28 since Round r30, 27 since Round r29 (a document's render settings); 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
  const want = [1, 2].flatMap(i => trace(p, i, 50));
  reset(); loadDoc(JSON.parse(text)); checkDoc(S.pieces, S.seams);
  const q = S.pieces[0];
  [1, 2].flatMap(i => trace(q, i, 50)).forEach((r, k) => samePt(r, want[k], 1e-12, "the same curve after a save and a load"));
  assert.ok(q.segs[1].e1 && q.segs[2].e0, "end directions are kept");
  assert.ok(S.curvesIn.curves === 0 && S.curvesIn.added === 0, "a file of this build needs nothing brought over");
  assert.ok([q.segs[1], q.segs[2]].every(sg => sg.cps.every(c => c.u === undefined)), "no knot is kept in memory");
  // the file itself carries each curve point's knot, so a build from before 8 Oct 2026 draws the very same curve
  const fp = d.pieces[0];
  for (const i of [1, 2]) {
    const sg = fp.segs[i], Pn = [fp.pts[i], ...sg.cps, fp.pts[i+1]].map(c => V(c.x, c.y)), old = G.oldSpline(Pn, [0, ...sg.cps.map(c => c.u), 1], sg.e0 || null, sg.e1 || null);
    segCurve(q, i).B.forEach((Q, k) => Q.forEach((v, j) => samePt(old[k][j], v, 1e-9, "as an older build draws it")));
  }
  // junk
  const bad = (cps) => normCurve({ curved: true, c1: null, c2: null, cps, e0: { x: 1, y: 2 }, notches: [] });
  for (const cps of [[], "x", [{ x: 1, y: NaN, u: 0.5 }], [{ x: 1 }], [null]]) {
    const s = bad(cps); assert.strictEqual(s.cps, undefined, JSON.stringify(cps) + " is dropped"); assert.strictEqual(s.e0, undefined);
  }
  const ok = normCurve({ curved: false, cps: [{ x: 1, y: 2, u: 0.5, extra: 1 }], e0: { x: "a", y: 0 }, notches: [] });
  assert.deepStrictEqual(ok.cps, [{ x: 1, y: 2, u: 0.5 }]); assert.strictEqual(ok.curved, true); assert.strictEqual(ok.e0, undefined, "a bad end direction is dropped, the points kept");
  // a v9 file: handle curves stay handle curves, byte for byte
  reset();
  const old = mkPiece("Old", rectShape(0, 0, 100, 100)); setCurve(old, 0, true); old.segs[0].c1 = V(30, -40); old.segs[0].c2 = V(70, -40);
  const v9 = JSON.parse(JSON.stringify({ v: 9, nextId: 2, nextSegId: 9, nextShapeId: 1, pieces: [old], seams: [] })), segs = JSON.stringify(v9.pieces[0].segs);
  loadDoc(v9); checkDoc(S.pieces, S.seams);
  assert.strictEqual(JSON.stringify(S.pieces[0].segs), segs);
  assert.strictEqual(isSpline(S.pieces[0].segs[0]), false);
});

/* ---------- the tool ---------- */
const RECT = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:400}], true));
  S.pieces.push(A); S.sel = [A.id]; app.commit(); S.undo.length = 0;
  const at = (q) => app.toS(q), out = {}, P = () => S.pieces[0];
  const trace = (i) => Array.from({ length: 41 }, (_, k) => app.segPt(P(), i, k/40));
  app.setTool("edit_curve_point");
`;
test("Edit Curve Point in the booted app: a click adds a point without changing the shape, a drag reshapes, Delete removes, each one undo step", () => {
  const r = boot({ script: RECT + `
    // hover: the line is under the pointer, and the tool can move nothing yet
    let s = at({ x: 300, y: 160 }); app.fire("pointermove", { x: s.x, y: s.y });
    out.hover = [S.hover.k, S.hover.i, +S.hover.t.toFixed(6)];
    // a click on the straight right edge: a curve point exactly there, the edge still straight
    app.click(s.x, s.y);
    out.added = [P().segs[1].cps.length, { ...P().segs[1].cps[0] }, S.undo.length, { ...S.selCp }, app.segLen(P(), 1)];
    // press it and drag: the curve runs through where it is dropped
    const s2 = at({ x: 360, y: 190 });
    app.drag(s.x, s.y, s2.x, s2.y); out.cursor = app.cv.style.cursor; out.dragging = [S.drag.k, !!S.drag.orig];
    app.fire("pointerup", { x: s2.x, y: s2.y });
    out.moved = [{ ...P().segs[1].cps[0] }, S.undo.length, app.segPt(P(), 1, app.segCurve(P(), 1).U[1])];
    // click and drag in one motion on the top edge: add and move together, one step
    const t = at({ x: 120, y: 0 }), t2 = at({ x: 130, y: -45 });
    app.drag(t.x, t.y, t2.x, t2.y); app.fire("pointerup", { x: t2.x, y: t2.y });
    out.oneMotion = [P().segs[0].cps.length, { ...P().segs[0].cps[0] }, S.undo.length];
    // a click on an existing curve point selects it and leaves no step; Delete takes it out
    app.click(s2.x, s2.y); out.select = [{ ...S.selCp }, S.undo.length];
    app.key("Delete"); out.deleted = [P().segs[1].curved, P().segs[1].cps === undefined, S.undo.length];
    app.undo(); out.undeleted = P().segs[1].cps.length;
    // other tools do not see curve points
    app.setTool("edit_pattern"); app.fire("pointermove", { x: s2.x, y: s2.y }); out.other = S.hover && S.hover.k;
    app.checkDoc(S.pieces, S.seams);
    while (S.undo.length) app.undo();
    out.back = P().segs.map(x => [x.curved, x.cps === undefined]);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.hover, ["seg", 1, 0.4]);
  assert.strictEqual(o.added[0], 1); near(o.added[1].x, 300, 1e-6); near(o.added[1].y, 160, 1e-6); assert.strictEqual(o.added[1].u, undefined, "no knot is stored");
  assert.strictEqual(o.added[2], 1, "one undo step"); assert.deepStrictEqual(o.added[3], { i: 1, c: 0 }, "and it is selected"); near(o.added[4], 400, 1e-9, "the edge is exactly as long as it was");
  // (Round r19 / H03: over and while dragging a point, line or mark the pointer is the arrow with a four-way badge, an image with "move" as its fallback; it was the system's "move")
  assert.match(o.cursor, /^url[(].*[)] 1 1, move$/); assert.deepStrictEqual(o.dragging, ["cp", true]);
  near(o.moved[0].x, 360, 1e-6); near(o.moved[0].y, 190, 1e-6); assert.strictEqual(o.moved[1], 2); near(o.moved[2].x, 360, 1e-6, "the curve goes through it");
  assert.strictEqual(o.oneMotion[0], 1); near(o.oneMotion[1].y, -45, 1e-6); assert.strictEqual(o.oneMotion[2], 3, "adding and dragging in one press is one step");
  assert.deepStrictEqual(o.select, [{ i: 1, c: 0 }, 3]);
  assert.deepStrictEqual(o.deleted, [false, true, 4], "the last curve point out: the edge is straight again");
  assert.strictEqual(o.undeleted, 1); assert.strictEqual(o.other, "seg");
  assert.deepStrictEqual(o.back, [[false, true], [false, true], [false, true], [false, true]], "undo all the way: the rectangle");
});

test("Edit Curve Point in the booted app: the right-click dialogs, the menu commands, and a seam, a notch and a linked copy coming along", () => {
  const r = boot({ script: RECT + `
    const B = app.mkPiece("B", app.mkShape([{x:500,y:0},{x:600,y:0},{x:600,y:400},{x:500,y:400}], true)); S.pieces.push(B);
    S.seams.push({ id: 1, a: [{ piece: A.id, shape: 0, sids: [A.segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[3].id], t0: 0, t1: 1, rev: true }] });
    A.segs[1].notches = [0.25]; app.commit(); S.undo.length = 0;
    const notch = () => app.segPt(P(), 1, P().segs[1].notches[0]);
    let s = at({ x: 300, y: 200 }), s2 = at({ x: 340, y: 230 });
    // right-click while dragging: the drag is rolled back and the distance is typed instead
    app.drag(s.x, s.y, s2.x, s2.y);
    let dlg = null; app.answer = (t, f) => { dlg = [t, f.map(x => [x.label, x.val])]; return { d: 50, x: f[1].val, y: f[2].val }; };
    app.fire("contextmenu", { x: s2.x, y: s2.y });
    out.dlg = dlg; out.typed = [{ ...P().segs[1].cps[0] }, S.undo.length, S.drag];
    // typed X and Y win over the distance
    app.answer = (t, f) => ({ d: 999, x: 30, y: 40 });
    const c = at(P().segs[1].cps[0]); app.menuClick(c.x, c.y, "More ▸ Moving Distance\\u2026");
    out.xy = { ...P().segs[1].cps[0] };
    out.seam = app.seamInfo(S.seams[0], S.pieces).la - app.segLen(P(), 1);
    out.notchOn = (() => { const n = notch(); const near = Array.from({ length: 2001 }, (_, k) => app.segPt(P(), 1, k/2000)).reduce((m, q) => Math.min(m, Math.hypot(q.x - n.x, q.y - n.y)), 9); return near; })();
    // menu: Add Curve Point on the left edge, Convert to Segment Point, Convert to Straight
    let m = at({ x: 0, y: 120 }); { const was = S.tool; app.setTool("edit_curve_point"); app.click(m.x, m.y); S.drag = null; app.setTool(was); }      // (Round G1: no longer on the line's menu; the tool adds it)
    out.menuAdd = P().segs[3].cps.length;
    const before = trace(1), len = app.segLen(P(), 1), c2 = at(P().segs[1].cps[0]);
    app.menuClick(c2.x, c2.y, "Convert to Segment Point \u25b8 Maintain Curve");
    out.split = [P().pts.length, S.seams[0].a[0].sids.length, app.segLen(P(), 1) + app.segLen(P(), 2) - len];
    out.splitShape = Math.max(...before.map(q => Math.min(...[1, 2].flatMap(i => Array.from({ length: 801 }, (_, k) => app.segPt(P(), i, k/800))).map(v => Math.hypot(v.x - q.x, v.y - q.y)))));
    m = at(app.segPt(P(), 1, 0.5)); app.menuClick(m.x, m.y, "Delete All Curve Points");
    out.straight = [P().segs[1].curved, P().segs[1].cps === undefined];
    // since R4 a linked copy is edited directly: a click on its line gives it a curve point, and its source gets it too
    while (S.undo.length) app.undo();
    S.sel = [P().id]; app.key("d", { ctrlKey: true });
    { const b = app.bboxOf([P()]), c = at({ x: (b.x0 + b.x1)/2 + (b.x1 - b.x0) + 40, y: (b.y0 + b.y1)/2 }); app.click(c.x, c.y); }      // the copy hangs on the pointer: set it down beside the pattern
    const copy = S.pieces[S.pieces.length - 1], n0 = toasts.length;
    app.setTool("edit_curve_point");
    const k = at(app.segPt(copy, 1, 0.5)); app.click(k.x, k.y);
    app.fire("pointerup", { x: k.x, y: k.y });
    out.copy = [copy.segs[1].curved, /Linked copy/.test(toasts[toasts.length - 1] || ""), P().segs[1].curved && P().segs[1].cps.length];
    app.undo();
    s = at({ x: 300, y: 200 }); s2 = at({ x: 350, y: 200 }); app.drag(s.x, s.y, s2.x, s2.y); app.fire("pointerup", { x: s2.x, y: s2.y });
    const cp2 = S.pieces[S.pieces.length - 1];
    out.follows = [cp2.segs[1].cps.length, Math.abs(app.segLen(cp2, 1) - app.segLen(P(), 1))];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.dlg[0], "Moving Distance"); assert.deepStrictEqual(o.dlg[1].map(x => x[0]), ["Distance Moved", "X-Axis", "Y-Axis"]);
  near(o.dlg[1][0][1], 50, 1e-6, "the drag so far: 40 across and 30 down is 50"); near(o.dlg[1][1][1], 40, 1e-6); near(o.dlg[1][2][1], -30, 1e-6, "Y is positive upward");
  near(o.typed[0].x, 340, 1e-6, "the same distance typed: the same place"); near(o.typed[0].y, 230, 1e-6);
  assert.strictEqual(o.typed[1], 1, "the press that added the point and the typed move are one step"); assert.strictEqual(o.typed[2], null);
  near(o.xy.x, 370, 1e-6, "X 30 and Y 40 (up) from where it was"); near(o.xy.y, 190, 1e-6);
  near(o.seam, 0, 1e-9, "the seam measures the curve"); assert.ok(o.notchOn < 0.05, "the notch is on the curve: " + o.notchOn);
  assert.strictEqual(o.menuAdd, 1);
  assert.strictEqual(o.split[0], 5); assert.strictEqual(o.split[1], 2, "the seam runs over both halves"); near(o.split[2], 0, 0.02); assert.ok(o.splitShape < 0.3, "the shape is kept (sampled every half millimetre): " + o.splitShape);
  assert.deepStrictEqual(o.straight, [false, true]);
  assert.deepStrictEqual(o.copy, [true, false, 1], "a click on a linked copy's line adds a curve point there, and on its source");
  assert.strictEqual(o.follows[0], 1); near(o.follows[1], 0, 1e-9, "the copy follows its source");
});

test("Edit Curvature bends a curve-point curve into one curve with no curve points; Edit Pattern moves its ends and keeps the points", () => {
  const r = boot({ script: RECT + `
    let s = at({ x: 300, y: 200 }), s2 = at({ x: 360, y: 200 });
    app.drag(s.x, s.y, s2.x, s2.y); app.fire("pointerup", { x: s2.x, y: s2.y });
    const pt = { ...P().segs[1].cps[0] };
    // Edit Pattern: drag the curve's end point; the curve point stays and the curve still goes through it
    app.setTool("edit_pattern");
    let a = at({ x: 300, y: 400 }), b = at({ x: 330, y: 430 });
    app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y });
    out.end = [P().pts[2], P().segs[1].cps[0], app.segPt(P(), 1, app.segCurve(P(), 1).U[1]), pt];
    // Edit Curvature: one bent curve (Round r30 / 2: let go, it is curve points of that shape, no handles; it was a handle curve)
    app.setTool("edit_curvature");
    a = at(app.segPt(P(), 1, 0.5)); b = { x: a.x + 20, y: a.y };
    app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y });
    out.bent = [P().segs[1].curved, Array.isArray(P().segs[1].cps) && P().segs[1].cps.length > 0, P().segs[1].c1 == null];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  near(o.end[0].x, 330, 1e-6); near(o.end[1].x, o.end[3].x, 1e-9, "the curve point did not move"); near(o.end[2].x, o.end[3].x, 1e-6, "and the curve goes through it"); near(o.end[2].y, o.end[3].y, 1e-6);
  assert.deepStrictEqual(o.bent, [true, true, true]);
});

module.exports = T;
