// Phase 4 darts: cap shape, darts counted as sewn shut in seam lengths, True Up with legs
// on corners, Add Dart with Fullness, Rotate Dart (whole and in part).
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1 };
const G = load([
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "flattenSA",
  "signedArea", "outN", "lineX", "offsetVar", "inside", "pieceWind", "reflectAcross",
  "newSegId", "segIx", "ensureSegIds", "newShapeId", "ensureShapeIds", "addChild",
  "setCurve", "mkShape", "rectShape", "mkPiece",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "seamEnds", "validSeams", "makeSeam", "resolveRefs",
  "cross", "dot", "blankSeg", "segChords", "bisect", "segHits", "shapeHits", "splitAt",
  "locateOn", "polyCentroid", "chainIdx", "slashSpread",
  "dartGeom", "applyDart", "addDartTo", "nearIdx", "addDartWithFullness", "rotateDart",
], { S });
const { V, sub, add, mul, dist, clone, segLen, segPt, flatten, signedArea, setCurve, mkShape, rectShape, mkPiece, addChild,
  seamInfo, makeSeam, resolveRefs, segIx, cross, dot, reflectAcross, dartGeom, applyDart, addDartTo, addDartWithFullness, rotateDart } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; }
function sound(p, msg) {
  assert.strictEqual(p.pts.length, p.segs.length, msg + ": points and segments in step");
  assert.strictEqual(new Set(p.segs.map(s => s.id)).size, p.segs.length, msg + ": unique segment ids");
  for (const d of p.darts) { const g = dartGeom(p, d); assert.ok(g && Number.isFinite(g.apex.x) && Number.isFinite(g.M.x), msg + ": dart resolves"); }
}
// 200 × 300 panel: 0 top, 1 right, 2 bottom, 3 left. Grain near the left edge.
function panel() {
  reset();
  const p = mkPiece("Panel", rectShape(0, 0, 200, 300));
  p.grain = { a: V(30, 60), b: V(30, 240) };
  S.pieces.push(p);
  return p;
}
// the cloth itself: the outline's area less every dart's triangle. Rotating or truing a dart never changes it.
const cloth = (p) => Math.abs(signedArea(flatten(p, 60))) - p.darts.reduce((a, d) => a + d.width*d.depth/2, 0);
const dartAngle = (p, d) => { const g = dartGeom(p, d), a = sub(g.legL, g.apex), b = sub(g.legR, g.apex); return Math.abs(Math.atan2(cross(a, b), dot(a, b))); };
// distance from q to the infinite line through a and b
const offLine = (q, a, b) => Math.abs(cross(sub(b, a), sub(q, a)))/dist(a, b);

/* ---- cap ---- */

test("dart cap on a straight seam: the cap point folds onto the seam line, (width/2)·tan(angle) outside it", () => {
  const p = panel();
  p.segs[0].sa = 10;
  addDartTo(p, 0, 0.5, 30, 90, true);
  const d = p.darts[0], g = dartGeom(p, d);
  samePt(g.legL, V(85, 0)); samePt(g.legR, V(115, 0)); samePt(g.apex, V(100, 90));
  const alpha = 2*Math.atan(15/90);
  samePt(g.M, V(100, -15*Math.tan(alpha)), "seam cap point", 1e-9);
  // the defining property: folded along the pressed-side leg, the cap point lies on the seam line (y = 0)
  near(reflectAcross(g.M, g.apex, g.legL).y, 0, 1e-9, "M folds onto the seam");
  // and the cut-line cap point folds onto the cut line (y = −10)
  near(reflectAcross(g.Mc, g.apex, g.legL).y, -10, 1e-9, "Mc folds onto the cut line");
  samePt(g.capL, V(85, -10)); samePt(g.capR, V(115, -10));
  assert.ok(g.Mc.y < g.M.y, "the cut cap is outside the seam cap");
  // on a symmetric dart pressing the other way gives the same cap
  d.cap = 2;
  const g2 = dartGeom(p, d);
  samePt(g2.M, g.M, "cap 2 = cap 1", 1e-9); samePt(g2.Mc, g.Mc, "", 1e-9);
  near(reflectAcross(g2.M, g2.apex, g2.legR).y, 0, 1e-9);
  // no seam allowance: both cap points coincide
  p.segs[0].sa = 0;
  const g3 = dartGeom(p, d); samePt(g3.Mc, g3.M); assert.strictEqual(g3.sa, 0);
});

test("dart cap where the seam turns at the dart: Cap 1 and Cap 2 differ, each folds onto its own side's seam", () => {
  reset();
  // a dart mouth that is a whole segment (40,0)→(80,0) between a rising and a level edge
  const p = mkPiece("P", mkShape([V(0, 30), V(40, 0), V(80, 0), V(200, 0), V(200, 300), V(0, 300)], true));
  S.pieces.push(p);
  p.darts.push({ sid: p.segs[1].id, t: 0.5, width: 40, depth: 100, folded: true });
  const d = p.darts[0];
  const g1 = dartGeom(p, d);
  d.cap = 2;
  const g2 = dartGeom(p, d);
  assert.ok(dist(g1.M, g2.M) > 1, "the two caps are different shapes here");
  near(offLine(reflectAcross(g1.M, g1.apex, g1.legL), p.pts[0], p.pts[1]), 0, 1e-9, "cap 1 folds onto the rising edge before the dart");
  near(offLine(reflectAcross(g2.M, g2.apex, g2.legR), p.pts[2], p.pts[3]), 0, 1e-9, "cap 2 folds onto the level edge after it");
  near(g1.M.x, 60, 1e-9, "both cap points are on the dart's centre line"); near(g2.M.x, 60, 1e-9);
});

/* ---- seams ---- */

test("a dart on a sewn edge is sewn shut: its width comes off the seam's length", () => {
  const p = panel(), q = mkPiece("Q", rectShape(400, 0, 170, 100)); S.pieces.push(q);
  S.seams = [makeSeam([], { piece: p.id, sid: p.segs[0].id }, { piece: q.id, sid: q.segs[0].id })];
  near(seamInfo(S.seams[0], S.pieces).diff, 30, 1e-9, "no dart: 200 against 170");
  addDartTo(p, 0, 0.3, 20, 80); addDartTo(p, 0, 0.7, 10, 60); addDartTo(p, 2, 0.5, 15, 60);   // the third is on another edge
  const inf = seamInfo(S.seams[0], S.pieces);
  near(inf.da, 30, 1e-9); near(inf.db, 0, 1e-9); near(inf.la, 170, 1e-9); near(inf.diff, 0, 1e-9, "two darts take up the difference");
  // True Up bakes one into the outline: the sewn length is the same before and after
  applyDart(p, p.darts[0]); S.seams = resolveRefs(S.pieces, S.seams);
  const inf2 = seamInfo(S.seams[0], S.pieces);
  near(inf2.la, 170, 1e-9); near(inf2.da, 10, 1e-9, "only the live dart is still subtracted");
  sound(p, "after true up");
});

test("True Up of a dart whose legs sit on the corners of its edge leaves no zero-length segments", () => {
  reset();
  const p = mkPiece("P", mkShape([V(0, 0), V(80, 0), V(120, 0), V(200, 0), V(200, 300), V(0, 300)], true));
  S.pieces.push(p);
  const q = mkPiece("Q", rectShape(400, 0, 200, 100)); S.pieces.push(q);
  p.darts.push({ sid: p.segs[1].id, t: 0.5, width: 40, depth: 100, folded: false });
  S.seams = [makeSeam([], { piece: p.id, sids: [p.segs[0].id, p.segs[1].id, p.segs[2].id] }, { piece: q.id, sid: q.segs[0].id })];
  const la = seamInfo(S.seams[0], S.pieces).la, A = cloth(p);
  near(la, 160, 1e-9);
  assert.ok(applyDart(p, p.darts[0]), "made: it gives the ids of the two legs since Round F / 7");
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(p.pts.length, 7, "one point added: the dart point");
  assert.ok(p.segs.every((s, i) => segLen(p, i) > 1), "no sliver segments");
  samePt(p.pts[2], V(100, 100), "dart point");
  near(seamInfo(S.seams[0], S.pieces).la, 160, 1e-9, "seam unchanged: just the two outer edges");
  assert.strictEqual(S.seams[0].a[0].sids.length, 2);
  near(cloth(p), A, 1e-6, "same cloth");
  sound(p, "corner true up");
});

/* ---- add dart with fullness ---- */

test("Add Dart with Fullness: the pattern opens by the dart width, so the seam keeps its sewn length", () => {
  const p = panel(), q = mkPiece("Q", rectShape(400, 0, 200, 100)); S.pieces.push(q);
  S.seams = [makeSeam([], { piece: p.id, sid: p.segs[0].id }, { piece: q.id, sid: q.segs[0].id })];
  const A0 = cloth(p), bottom = p.segs[2].id;
  assert.strictEqual(addDartWithFullness(p, 0, 0.6, 24, 90, true), true);
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(p.darts.length, 1);
  const d = p.darts[0], g = dartGeom(p, d), mouth = segIx(p, d.sid);
  near(segLen(p, mouth), 24, 1e-9, "the dart's mouth is the opening"); near(d.t, 0.5, 1e-12); near(d.width, 24, 1e-12); near(d.depth, 90, 1e-12);
  assert.strictEqual(d.folded, true);
  samePt(g.legL, p.pts[mouth], "legs on the two sides of the opening", 1e-9); samePt(g.legR, p.pts[(mouth+1) % p.pts.length], "", 1e-9);
  near(dist(g.apex, g.legL), dist(g.apex, g.legR), 1e-9, "equal legs");
  const inf = seamInfo(S.seams[0], S.pieces);
  near(inf.la, 200, 1e-9, "sewn length unchanged"); near(inf.diff, 0, 1e-9);
  assert.strictEqual(S.seams[0].a[0].sids.length, 3, "the seam runs through the opening");
  // hinged on the opposite edge: that edge is still 200 long and the hinge is one point
  assert.strictEqual(p.pts.filter(r => dist(r, V(120, 300)) < 1e-9).length, 1, "hinge at (120,300)");
  near(p.segs.reduce((L, x, i) => L + segLen(p, i), 0), 1000 + 24, 1e-9, "every edge keeps its length; only the opening is new");
  assert.ok(segIx(p, bottom) >= 0);
  assert.ok(cloth(p) > A0 + 1000, "fullness was added to the body");
  // the dart point lies on the slash line, 90 from the mouth
  near(offLine(g.apex, V(120, 300), g.C), 0, 1e-6);
  samePt(p.pts.find(r => dist(r, V(0, 0)) < 1e-9), V(0, 0), "the grainline side did not move");
  sound(p, "dart with fullness");
});

/* ---- rotate ---- */

test("Rotate Dart: same dart point, same angle, same cloth; the old edge closes up and stays sewn to length", () => {
  const p = panel(), q = mkPiece("Q", rectShape(400, 0, 180, 100)); S.pieces.push(q);
  addDartTo(p, 0, 0.5, 20, 100, true); p.darts[0].cap = 2;
  S.seams = [makeSeam([], { piece: p.id, sid: p.segs[0].id }, { piece: q.id, sid: q.segs[0].id })];
  const A0 = cloth(p), a0 = dartAngle(p, p.darts[0]), right = p.segs[1].id, bottomL = segLen(p, 2), leftL = segLen(p, 3);
  near(seamInfo(S.seams[0], S.pieces).la, 180, 1e-9);
  assert.strictEqual(rotateDart(p, 0, right, 0.5, 1), "");
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(p.darts.length, 1, "one dart, moved");
  const d = p.darts[0], g = dartGeom(p, d);
  samePt(g.apex, V(100, 100), "the dart point did not move", 1e-9);
  near(dartAngle(p, d), a0, 1e-9, "same angle");
  near(dist(g.apex, g.legL), dist(g.apex, g.legR), 1e-9, "equal legs");
  near(dist(g.apex, g.legL), dist(V(100, 100), V(200, 150)), 1e-9, "legs reach the place that was clicked");
  near(d.width, 2*dist(V(100, 100), V(200, 150))*Math.sin(a0/2), 1e-9, "wider, because the legs are longer");
  assert.strictEqual(d.folded, true); assert.strictEqual(d.cap, 2, "fold settings carry over");
  near(cloth(p), A0, 1e-6, "no cloth gained or lost");
  // the old edge: two parts meeting at the closed dart, sewn length still 180
  const inf = seamInfo(S.seams[0], S.pieces);
  near(inf.la, 180, 1e-9); near(inf.da, 0, 1e-9); assert.strictEqual(S.seams[0].a[0].sids.length, 2);
  assert.ok(p.pts.some(r => dist(r, V(90, 0)) < 1e-9), "the fixed leg point is where it was");
  // the grainline side is untouched, and no other edge changed length
  for (const c of [V(0, 0), V(0, 300), V(200, 300)]) assert.ok(p.pts.some(r => dist(r, c) < 1e-9), "corner " + JSON.stringify(c));
  near(segLen(p, segIx(p, p.segs.find((s, i) => dist(p.pts[i], V(200, 300)) < 1e-9).id)), bottomL, 1e-9);
  near(p.segs.reduce((L, s, i) => L + segLen(p, i), 0), 1000 - 20 + d.width, 1e-9, "perimeter: old mouth out, new mouth in");
  sound(p, "rotated");
  assert.strictEqual(leftL, 300);
});

test("Rotate Dart in part: the intake is shared between the old place and the new one", () => {
  const p = panel(), q = mkPiece("Q", rectShape(400, 0, 180, 100)); S.pieces.push(q);
  addDartTo(p, 0, 0.5, 20, 100);
  S.seams = [makeSeam([], { piece: p.id, sid: p.segs[0].id }, { piece: q.id, sid: q.segs[0].id })];
  const A0 = cloth(p), a0 = dartAngle(p, p.darts[0]);
  assert.strictEqual(rotateDart(p, 0, p.segs[2].id, 0.25, 0.4), "");        // 40% to the bottom edge
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(p.darts.length, 2);
  const [old, nw] = p.darts;
  near(dartAngle(p, old), a0*0.6, 1e-9, "60% stays"); near(dartAngle(p, nw), a0*0.4, 1e-9, "40% moves");
  samePt(dartGeom(p, old).apex, V(100, 100), "", 1e-9); samePt(dartGeom(p, nw).apex, V(100, 100), "both darts share the dart point", 1e-9);
  near(cloth(p), A0, 1e-6);
  const inf = seamInfo(S.seams[0], S.pieces);
  near(inf.la, 180, 1e-9, "the sewn top edge is still 180"); near(inf.da, old.width, 1e-9);
  assert.strictEqual(S.seams[0].a[0].sids.length, 3, "outer part, the remaining mouth, outer part");
  sound(p, "split dart");
});

test("a rotated dart can be rotated again, and back: the angle and the cloth never change", () => {
  const p = panel();
  addDartTo(p, 0, 0.5, 20, 100, true);
  const A0 = cloth(p), a0 = dartAngle(p, p.darts[0]);
  const edgeAt = (c) => p.segs.find((s, i) => dist(p.pts[i], c) < 1e-9).id;       // the edge that starts at corner c
  assert.strictEqual(rotateDart(p, 0, edgeAt(V(200, 0)), 0.6, 1), "");            // to the right edge
  assert.strictEqual(rotateDart(p, 0, edgeAt(V(200, 300)), 0.5, 1), "");          // then to the bottom
  assert.strictEqual(p.darts.length, 1);
  near(dartAngle(p, p.darts[0]), a0, 1e-9); near(cloth(p), A0, 1e-6);
  samePt(dartGeom(p, p.darts[0]).apex, V(100, 100), "dart point", 1e-9);
  sound(p, "twice rotated");
  // True Up still works on the result
  assert.ok(applyDart(p, p.darts[0]), "made: it gives the ids of the two legs since Round F / 7");
  near(cloth(p), A0, 1e-6); sound(p, "trued");
  assert.ok(p.segs.every((s, i) => segLen(p, i) > 0.5), "no sliver segments");
});

test("Rotate Dart carries what is on the part that turns, keeps the grainline side still, and refuses bad targets", () => {
  const p = panel();
  addDartTo(p, 0, 0.5, 20, 100);
  const mov = p.internals[addChild(p, "internals", mkShape([V(150, 40), V(180, 80)], false))];   // between the dart and the right edge
  const stay = p.internals[addChild(p, "internals", mkShape([V(40, 200), V(80, 250)], false))];
  const was = clone(p);
  assert.ok(/different edge/.test(rotateDart(p, 0, p.segs[0].id, 0.9, 1)));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(p)), JSON.parse(JSON.stringify(was)), "refused before anything changed");
  assert.strictEqual(rotateDart(p, 0, p.segs[1].id, 0.5, 1), "");
  assert.deepStrictEqual(stay.pts, was.internals[1].pts, "on the grainline side: not moved");
  assert.notDeepStrictEqual(mov.pts, was.internals[0].pts, "between the old dart and the new: turned");
  near(segLen(mov, 0), segLen(was.internals[0], 0), 1e-9);
  near(dist(mov.pts[0], V(100, 100)), dist(was.internals[0].pts[0], V(100, 100)), 1e-9, "turned about the dart point");
  assert.deepStrictEqual(p.grain, was.grain);
  assert.notStrictEqual(rotateDart(p, 5, p.segs[0].id, 0.5, 1), "", "no such dart");
});

test("Rotate Dart on a pattern with curved edges keeps the cloth and every curve's length", () => {
  reset();
  const p = mkPiece("Bodice", mkShape([V(0, 0), V(68, 12), V(188, 42), V(150, 220), V(168, 480), V(0, 495)], true));
  setCurve(p, 0, true); p.segs[0].c1 = V(6, 30); p.segs[0].c2 = V(40, 26);
  setCurve(p, 2, true); p.segs[2].c1 = V(196, 120); p.segs[2].c2 = V(186, 190);
  p.grain = { a: V(40, 120), b: V(40, 400) };
  S.pieces.push(p);
  addDartTo(p, 3, 0.35, 22, 90, true);                       // a side-seam dart
  const A0 = cloth(p), a0 = dartAngle(p, p.darts[0]), arm = p.segs[2].id, armL = segLen(p, 2), apex = dartGeom(p, p.darts[0]).apex;
  assert.strictEqual(rotateDart(p, 0, p.segs[1].id, 0.5, 1), "");               // to the shoulder
  near(dartAngle(p, p.darts[0]), a0, 1e-9); samePt(dartGeom(p, p.darts[0]).apex, apex, "dart point", 1e-9);
  near(cloth(p), A0, 0.5, "cloth (curves are flattened for the area, hence the tolerance)");
  near(segLen(p, segIx(p, arm)), armL, 1e-9, "the armhole turned rigidly: same length");
  sound(p, "bodice");
});

module.exports = T;
