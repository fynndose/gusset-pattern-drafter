// Exact curve splitting (Add Point on a curved segment, de Casteljau):
// the two halves must retrace the original curve, keep its arc length, and
// keep darts and notches exactly where they were.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], nextSegId: 1, nextId: 1 };
const G = load([
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten",
  "signedArea", "inside", "reflectAcross", "mkPiece", "newSegId", "segIx",
  "setCurve", "mkShape", "ellipseShape", "splitBez", "addPoint", "dartsOn", "seamParts", "partCover", "splitParts", "seamSidesOn", "lineX", "dartGeom", "addDartTo",
], { S });
const { V, bez, segPt, segLen, mkShape, ellipseShape, setCurve, mkPiece, splitBez, addPoint, addDartTo, dartGeom, segIx } = G;

const TOL = 0.001;                                  // mm
const T = [];
const test = (name, fn) => T.push({ name, fn });
const ks = [0.05, 0.1, 0.25, 0.37, 0.5, 0.73, 0.9, 0.97];

// high-resolution arc length, so sampling error can't hide or fake a change
function arc(p0, c1, c2, p3, n = 20000) {
  let L = 0, pv = p0;
  for (let j = 1; j <= n; j++) { const q = bez(p0, c1, c2, p3, j/n); L += Math.hypot(q.x-pv.x, q.y-pv.y); pv = q; }
  return L;
}
// max distance between the original curve and the two halves, over matching parameters
function maxDev(orig, L, R, k, n = 400) {
  let m = 0;
  for (let j = 0; j <= n; j++) {
    const u = j/n, o = bez(...orig, u);
    const h = u <= k ? bez(...L, u/k) : bez(...R, (u-k)/(1-k));
    m = Math.max(m, Math.hypot(o.x-h.x, o.y-h.y));
  }
  return m;
}
// the halves must also cover the same point set: every half sample lies on the original
function maxOffCurve(orig, halves, n = 200) {
  const dense = Array.from({ length: 20001 }, (_, j) => bez(...orig, j/20000));
  let m = 0;
  for (const h of halves) for (let j = 0; j <= n; j++) {
    const q = bez(...h, j/n);
    let best = Infinity; for (const o of dense) best = Math.min(best, (o.x-q.x)**2 + (o.y-q.y)**2);
    m = Math.max(m, Math.sqrt(best));
  }
  return m;
}

// the starter's neckline, an S-curve, and a strongly asymmetric loop-ish curve
const CURVES = {
  neckline: [V(0,0), V(6,30), V(40,26), V(68,12)],
  sCurve: [V(0,0), V(120,-90), V(-20,160), V(200,80)],
  tight: [V(0,0), V(300,0), V(-100,150), V(150,150)],
};

for (const [name, c] of Object.entries(CURVES)) {
  test("splitBez on " + name + ": halves match the original within 0.001 mm at t = " + ks.join(", "), () => {
    const L0 = arc(...c);
    for (const k of ks) {
      const [L, R] = splitBez(...c, k);
      const dev = maxDev(c, L, R, k);
      assert.ok(dev < TOL, name + " k=" + k + ": parameter-matched deviation " + dev);
      const off = maxOffCurve(c, [L, R]);
      assert.ok(off < TOL, name + " k=" + k + ": half point off the original by " + off);
      const sum = arc(...L) + arc(...R);
      assert.ok(Math.abs(sum - L0) < TOL, name + " k=" + k + ": arc " + L0 + " vs halves " + sum);
      assert.deepStrictEqual(L[3], R[0], "halves meet");
      assert.deepStrictEqual([L[0], R[3]], [c[0], c[3]], "ends unchanged");
    }
  });
}

test("Add Point on a curved outline segment keeps the curve, its length and the rest of the piece", () => {
  for (const k of ks) {
    S.nextSegId = 1;
    const P = mkPiece("Front", mkShape([V(0,0), V(68,12), V(188,42), V(150,220), V(168,480), V(0,495)], true));
    setCurve(P, 0, true); P.segs[0].c1 = V(6,30); P.segs[0].c2 = V(40,26);
    const orig = [P.pts[0], P.segs[0].c1, P.segs[0].c2, P.pts[1]].map(q => V(q.x, q.y));
    const id0 = P.segs[0].id, perim0 = P.segs.reduce((s, _, i) => s + segLen(P, i), 0);
    const others = P.pts.slice(1).map(q => V(q.x, q.y));
    addPoint(P, 0, k);
    assert.strictEqual(P.segs.length, 7);
    assert.strictEqual(P.segs[0].id, id0, "first half keeps the id");
    assert.notStrictEqual(P.segs[1].id, id0);
    assert.ok(P.segs[0].curved && P.segs[1].curved, "both halves stay curved");
    const L = [P.pts[0], P.segs[0].c1, P.segs[0].c2, P.pts[1]], R = [P.pts[1], P.segs[1].c1, P.segs[1].c2, P.pts[2]];
    assert.ok(maxDev(orig, L, R, k) < TOL, "k=" + k + " halves retrace the curve");
    assert.ok(Math.abs(arc(...L) + arc(...R) - arc(...orig)) < TOL, "k=" + k + " arc length unchanged");
    // panel lengths (64-chord sampling) — the split can only make the estimate finer, never visibly different
    const perim = P.segs.reduce((s, _, i) => s + segLen(P, i), 0);
    assert.ok(Math.abs(perim - perim0) < 0.01, "k=" + k + " perimeter " + perim0 + " → " + perim);
    assert.deepStrictEqual(P.pts.slice(2), others, "other points untouched");
  }
});

test("darts and notches on a split curve stay exactly where they were (both halves)", () => {
  for (const k of [0.2, 0.45, 0.6, 0.85]) {
    S.nextSegId = 1; S.pieces = [];
    const P = mkPiece("Side", mkShape([V(0,0), V(200,0), V(220,300), V(0,320)], true));
    setCurve(P, 1, true); P.segs[1].c1 = V(260,80); P.segs[1].c2 = V(170,220);   // bulging side seam
    S.pieces.push(P);
    P.segs[1].notches = [0.15, 0.5, 0.9];
    addDartTo(P, 1, 0.3, 14, 50); addDartTo(P, 1, 0.7, 10, 40);
    const notchW = P.segs[1].notches.map(t => segPt(P, 1, t));
    const dartW = P.darts.map(d => dartGeom(P, d));
    addPoint(P, 1, k);
    const notchesNow = [...P.segs[1].notches.map(t => segPt(P, 1, t)), ...P.segs[2].notches.map(t => segPt(P, 2, t))];
    assert.strictEqual(notchesNow.length, 3);
    notchesNow.forEach((q, j) => assert.ok(Math.hypot(q.x-notchW[j].x, q.y-notchW[j].y) < 1e-9, "k=" + k + " notch " + j));
    P.darts.forEach((d, j) => {
      const g = dartGeom(P, d), w = dartW[j];
      const want = [0.3, 0.7][j] <= k ? 1 : 2;              // first half is segment 1, second is 2
      assert.strictEqual(segIx(P, d.sid), want, "k=" + k + " dart " + j + " on the right half");
      for (const key of ["C", "legL", "legR", "apex"])
        assert.ok(Math.hypot(g[key].x-w[key].x, g[key].y-w[key].y) < 1e-9, "k=" + k + " dart " + j + " " + key + " moved");
    });
  }
});

test("repeated splits of the same curve still retrace it", () => {
  S.nextSegId = 1;
  const P = mkPiece("E", ellipseShape(0, 0, 120, 70));
  const orig = [P.pts[0], P.segs[0].c1, P.segs[0].c2, P.pts[1]].map(q => V(q.x, q.y));
  const L0 = arc(...orig);
  addPoint(P, 0, 0.5); addPoint(P, 0, 0.3); addPoint(P, 2, 0.6);   // four pieces of one quarter
  let sum = 0;
  for (let i = 0; i < 4; i++) sum += arc(P.pts[i], P.segs[i].c1, P.segs[i].c2, P.pts[i+1]);
  assert.ok(Math.abs(sum - L0) < TOL, "arc " + L0 + " vs " + sum);
  const halves = [0, 1, 2, 3].map(i => [P.pts[i], P.segs[i].c1, P.segs[i].c2, P.pts[i+1]]);
  const off = maxOffCurve(orig, halves);
  assert.ok(off < TOL, "pieces stay on the original quarter (off by " + off + ")");
});

module.exports = T;
