// Phase 6: linked copies (symmetric and instance) placed by an affine map, and symmetric
// unfolds whose mirrored half stays live.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null };
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", "normGuides", "mkAnchor", "anchorAt", "measureInfo", "validMeasures", 
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "flattenSA",
  "signedArea", "outN", "lineX", "inside", "reflectAcross", "reflector",
  "affOf", "affApply", "affMul", "mapPiece", "byId", "sync", "mkLinked", "syncHalf", "unfold", "chainIdx",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "addChild",
  "setCurve", "mkShape", "rectShape", "mkPiece", "normProps",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "deletePoint", "dartGeom", "addDartTo",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "seamEnds", "validSeams", "seamOn", "makeSeam", "loadSeams",
  "NOTCH_DEFAULT", "normNotch", "migrate", "resolveRefs", "alignMirrorIds", "loadDoc", "followerMsg",
], { S });
const { V, add, dist, clone, segLen, segPt, signedArea, flatten, reflector, affOf, affApply, affMul, mapPiece, sync, mkLinked, syncHalf, unfold,
  segIx, addChild, setCurve, mkShape, rectShape, mkPiece, addPoint, deletePoint, dartGeom, addDartTo,
  seamInfo, makeSeam, resolveRefs, loadDoc, followerMsg } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; }
const settle = () => { sync(); S.seams = resolveRefs(S.pieces, S.seams); };
// a half front: 0 neck→shoulder, 1 armhole side, 2 hem, 3 centre front (the fold, x = 0)
function halfFront() {
  reset();
  const p = mkPiece("Front", mkShape([V(0, 0), V(100, 10), V(120, 300), V(0, 300)], true));
  S.pieces.push(p);
  return p;
}
const axisX = (x) => reflector(V(x, 0), V(x, 100));
const symmetricIn = (p, x, msg) => { for (const q of p.pts) assert.ok(p.pts.some(r => dist(r, V(2*x - q.x, q.y)) < 1e-9), msg + ": mirror image of " + JSON.stringify(q)); };

/* ---- affine maps ---- */

test("affine maps: read from a function, applied, composed", () => {
  const shift = affOf((q) => V(q.x + 5, q.y - 3)), flip = affOf(axisX(10)), turn = affOf((q) => V(-q.y, q.x));
  assert.deepStrictEqual(shift, [1, 0, 0, 1, 5, -3]);
  samePt(affApply(flip, V(3, 7)), V(17, 7)); samePt(affApply(turn, V(2, 0)), V(0, 2));
  const both = affMul(shift, flip);                            // flip first, then shift
  samePt(affApply(both, V(3, 7)), V(22, 4));
  samePt(affApply(affMul(flip, flip), V(3, 7)), V(3, 7), "a reflection twice is the identity");
});

/* ---- linked copies ---- */

test("Symmetric Pattern: a mirrored copy that follows every edit to its source, including darts added later", () => {
  const p = halfFront();
  const m = mkLinked(p, "symmetric", affOf(axisX(150))); S.pieces.push(m); settle();
  assert.deepStrictEqual(m.link, { of: p.id, kind: "symmetric", m: affOf(axisX(150)) });
  p.pts.forEach((q, i) => samePt(m.pts[i], V(300 - q.x, q.y), "point " + i));
  assert.ok(signedArea(flatten(m, 4))*signedArea(flatten(p, 4)) < 0, "mirrored: the outline runs the other way");
  p.pts[1] = V(110, 25); setCurve(p, 1, true); p.segs[1].c1 = V(130, 100); p.segs[1].c2 = V(140, 200);
  addDartTo(p, 2, 0.5, 20, 80, true);
  addChild(p, "internals", mkShape([V(20, 50), V(60, 90)], false));
  p.grain = { a: V(40, 60), b: V(40, 240) };
  settle();
  samePt(m.pts[1], V(190, 25)); samePt(m.segs[1].c1, V(170, 100)); samePt(m.segs[1].c2, V(160, 200));
  assert.strictEqual(m.darts.length, 1, "the copy has the dart too");
  samePt(dartGeom(m, m.darts[0]).apex, V(300 - dartGeom(p, p.darts[0]).apex.x, dartGeom(p, p.darts[0]).apex.y), "dart point mirrored");
  samePt(m.internals[0].pts[1], V(240, 90)); samePt(m.grain.a, V(260, 60));
  assert.deepStrictEqual(m.segs.map(x => x.id), p.segs.map(x => x.id), "same segment ids, so seams and darts stay on matching edges");
  // its own name and properties are not overwritten
  m.name = "Front left"; m.quantity = 2; settle();
  assert.strictEqual(m.name, "Front left"); assert.strictEqual(m.quantity, 2);
});

test("a linked copy can be moved, turned and flipped, and stays there (it used to snap back)", () => {
  const p = halfFront();
  const m = mkLinked(p, "symmetric", affOf(axisX(150))); S.pieces.push(m); settle();
  mapPiece(m, (q) => V(q.x + 70, q.y + 40)); settle();
  samePt(m.pts[1], V(300 - 100 + 70, 10 + 40), "moved");
  p.pts[1] = V(90, 0); settle();
  samePt(m.pts[1], V(300 - 90 + 70, 0 + 40), "still follows the source from its new place");
  const before = m.pts.map(q => ({ ...q }));
  mapPiece(m, (q) => V(-q.y, q.x)); settle();                  // a quarter turn about the origin
  m.pts.forEach((q, i) => samePt(q, V(-before[i].y, before[i].x), "turned " + i));
  near(segLen(m, 1), segLen(p, 1), 1e-9, "same size as the source");
});

test("Instance Pattern is not mirrored; a copy of a copy links to the original", () => {
  const p = halfFront();
  const inst = mkLinked(p, "instance", affOf((q) => V(q.x + 200, q.y))); S.pieces.push(inst); settle();
  p.pts.forEach((q, i) => samePt(inst.pts[i], V(q.x + 200, q.y), "point " + i));
  assert.ok(signedArea(flatten(inst, 4))*signedArea(flatten(p, 4)) > 0, "same handedness as the source");
  const again = mkLinked(inst, "symmetric", affOf(axisX(400))); S.pieces.push(again); settle();
  assert.strictEqual(again.link.of, p.id, "linked to the original, not to the instance");
  p.pts.forEach((q, i) => samePt(again.pts[i], V(800 - (q.x + 200), q.y), "placed from where the instance is"));
  p.pts[2] = V(150, 320); settle();
  samePt(inst.pts[2], V(350, 320)); samePt(again.pts[2], V(450, 320));
});

test("unlinking, or losing the source, leaves an ordinary pattern with the shape it had", () => {
  const p = halfFront();
  const m = mkLinked(p, "symmetric", affOf(axisX(150))); S.pieces.push(m); settle();
  const shape = JSON.stringify(m.pts);
  delete m.link; p.pts[1] = V(50, 50); settle();
  assert.strictEqual(JSON.stringify(m.pts), shape, "unlinked: no longer follows");
  const m2 = mkLinked(p, "instance", affOf((q) => V(q.x + 300, q.y))); S.pieces.push(m2); settle();
  const shape2 = JSON.stringify(m2.pts);
  S.pieces = S.pieces.filter(x => x !== p); settle();
  assert.strictEqual(m2.link, undefined, "the link is dropped when the source is gone");
  assert.strictEqual(JSON.stringify(m2.pts), shape2);
});

test("files: an old mirrorOf + axis link loads as a symmetric link in the same place; v8 links and halves round-trip", () => {
  const p = halfFront();
  const old = clone(p); old.id = 2; old.name = "Old mirror"; old.mirrorOf = 1; old.axis = { a: V(150, 0), b: V(150, 300) };
  old.pts = p.pts.map(axisX(150));
  reset();
  loadDoc(JSON.parse(JSON.stringify({ v: 7, nextId: 3, nextSegId: 20, pieces: [p, old], seams: [] })));
  const m = S.pieces[1];
  assert.strictEqual(m.mirrorOf, undefined); assert.strictEqual(m.axis, undefined);
  assert.strictEqual(m.link.kind, "symmetric"); assert.strictEqual(m.link.of, 1);
  settle();
  S.pieces[0].pts.forEach((q, i) => samePt(m.pts[i], V(300 - q.x, q.y), "point " + i));
  // v8: a link and a half survive saving; a broken link is dropped, not treated as a corrupt file
  const u = unfold(S.pieces[0], 3); S.pieces.push(u);
  const text = JSON.stringify({ v: 8, nextId: S.nextId, nextSegId: S.nextSegId, nextShapeId: S.nextShapeId, pieces: S.pieces, seams: [] });
  const want = [clone(m.link), clone(u.half)];
  reset(); loadDoc(JSON.parse(text));
  assert.deepStrictEqual([S.pieces[1].link, S.pieces[2].half], want);
  const bad = JSON.parse(text); bad.pieces[1].link = { of: "x", m: [1, 2] }; bad.pieces[2].half = { s: null };
  reset(); loadDoc(bad);
  assert.strictEqual(S.pieces[1].link, undefined); assert.strictEqual(S.pieces[2].half, undefined);
});

/* ---- symmetric unfold ---- */

test("Unfold builds the full piece: mirrored half, darts, internal lines; the kept half keeps its ids", () => {
  const p = halfFront();
  addDartTo(p, 2, 0.25, 20, 80, true); p.darts[0].cap = 1;
  const it = p.internals[addChild(p, "internals", mkShape([V(20, 50), V(60, 90)], false))];
  setCurve(it, 0, true); it.segs[0].c1 = V(30, 50); it.segs[0].c2 = V(60, 70);       // an asymmetric curve
  const u = unfold(p, 3);
  assert.strictEqual(u.pts.length, 6); symmetricIn(u, 0, "outline");
  assert.deepStrictEqual(u.segs.slice(0, 3).map(x => x.id), p.segs.slice(0, 3).map(x => x.id), "kept half: same ids");
  assert.strictEqual(new Set(u.segs.map(x => x.id)).size, 6);
  assert.strictEqual(u.darts.length, 2, "the dart and its mirror image");
  const [d0, d1] = u.darts, g0 = dartGeom(u, d0), g1 = dartGeom(u, d1);
  samePt(g1.apex, V(-g0.apex.x, g0.apex.y), "mirrored dart point"); assert.strictEqual(d1.cap, 2, "pressed the mirrored way");
  near(d1.t, 0.75, 1e-12);
  assert.strictEqual(u.internals.length, 2);
  for (const t of [0, 0.3, 0.7, 1]) samePt(segPt(u.internals[1], 0, t), V(-segPt(u.internals[0], 0, t).x, segPt(u.internals[0], 0, t).y), "mirrored curve at " + t);
  assert.strictEqual(u.internals[0].id, it.id); assert.notStrictEqual(u.internals[1].id, it.id);
  assert.ok(u.half && u.half.s === u.segs[0].id && u.half.m === u.segs[3].id);
  assert.strictEqual(p.pts.length, 4, "the half pattern itself is untouched");
});

test("Symmetric unfold stays live: editing the kept half reshapes the mirrored half, and moving a fold point moves the fold", () => {
  const p = halfFront(), u = unfold(p, 3); S.pieces.push(u);
  const mirrorIds = u.segs.slice(3).map(x => x.id);
  u.pts[1] = V(140, 40);                                       // drag a point of the kept half
  setCurve(u, 1, true); u.segs[1].c1 = V(150, 120); u.segs[1].c2 = V(130, 220);
  u.segs[1].sa = 12; u.segs[1].notches = [0.25];
  settle();
  symmetricIn(u, 0, "after an edit");
  assert.deepStrictEqual(u.segs.slice(3).map(x => x.id), mirrorIds, "mirrored segment ids are stable");
  const ms = u.segs[4];                                        // the mirror of segment 1 (order is reversed)
  assert.ok(ms.curved); samePt(ms.c1, V(-130, 220)); samePt(ms.c2, V(-150, 120)); assert.strictEqual(ms.sa, 12);
  assert.deepStrictEqual(ms.notches, [0.75], "notches mirrored along the edge");
  for (const t of [0.2, 0.5, 0.9]) samePt(segPt(u, 4, 1 - t), V(-segPt(u, 1, t).x, segPt(u, 1, t).y), "curve mirrored at " + t);
  // move the lower fold point: the fold line tilts and the mirror follows it
  u.pts[3] = V(30, 300); settle();
  const R = reflector(u.pts[0], u.pts[3]);
  samePt(u.pts[5], R(u.pts[1]), "mirror of point 1 in the new fold line"); samePt(u.pts[4], R(u.pts[2]));
  // moving the whole piece keeps it symmetric
  mapPiece(u, (q) => V(q.x + 500, q.y - 20)); settle();
  const R2 = reflector(u.pts[0], u.pts[3]);
  samePt(u.pts[5], R2(u.pts[1]), "after a move");
  // a direct edit of the mirrored half does not stick
  u.pts[5] = V(0, 0); settle();
  samePt(u.pts[5], R2(u.pts[1]), "the mirrored half is rebuilt");
});

test("Symmetric unfold: adding and deleting points on the kept half keeps seams on the mirrored half whole", () => {
  const p = halfFront(), u = unfold(p, 3); S.pieces.push(u);
  const q = mkPiece("Q", rectShape(600, 0, 300, 100)); S.pieces.push(q);
  const srcSide = u.segs[1].id, mirSide = u.half.map[srcSide];
  S.seams = [makeSeam([], { piece: u.id, sid: mirSide }, { piece: q.id, sid: q.segs[0].id })];
  const L = seamInfo(S.seams[0], S.pieces).la;
  near(L, segLen(u, 1), 1e-9);
  addPoint(u, 1, 0.3); settle();
  assert.strictEqual(u.pts.length, 8, "a point on each half"); symmetricIn(u, 0, "after add");
  assert.strictEqual(S.seams[0].a[0].sids.length, 2, "the mirrored seam covers both parts");
  near(seamInfo(S.seams[0], S.pieces).la, L, 1e-9);
  // the run is in the mirrored outline's own order
  const ix = S.seams[0].a[0].sids.map(id => segIx(u, id));
  assert.strictEqual(ix[1], ix[0] + 1);
  deletePoint(u, 2); settle();                                 // delete the added point again
  assert.strictEqual(u.pts.length, 6);
  assert.strictEqual(S.seams.length, 1); assert.deepStrictEqual(S.seams[0].a[0].sids, [mirSide]);
  near(seamInfo(S.seams[0], S.pieces).la, L, 1e-9);
  // delete a real corner of the kept half: the mirrored seam moves onto the edge that grew, as on the kept half
  deletePoint(u, 1); settle();
  assert.strictEqual(u.pts.length, 4); symmetricIn(u, 0, "after deleting a corner");
  assert.strictEqual(S.seams.length, 1, "still sewn");
});

test("Symmetric unfold: darts and internal shapes are mirrored, follow changes, and go when their source goes", () => {
  const p = halfFront(), u = unfold(p, 3); S.pieces.push(u);
  addDartTo(u, 2, 0.5, 20, 80, false); settle();
  assert.strictEqual(u.darts.length, 2);
  u.darts[0].width = 30; u.darts[0].folded = true; settle();
  assert.strictEqual(u.darts.length, 2); assert.strictEqual(u.darts[1].width, 30); assert.strictEqual(u.darts[1].folded, true);
  const kid = u.internals[addChild(u, "internals", mkShape([V(30, 100), V(80, 150)], false))]; settle();
  assert.strictEqual(u.internals.length, 2);
  const mirrorId = u.internals[1].id;
  kid.pts[1] = V(90, 200); settle();
  samePt(u.internals[1].pts[1], V(-90, 200)); assert.strictEqual(u.internals[1].id, mirrorId, "the mirrored shape keeps its id");
  u.darts.splice(0, 1); u.internals.splice(0, 1); settle();
  assert.strictEqual(u.darts.length, 0, "no orphaned mirror dart"); assert.strictEqual(u.internals.length, 0);
});

test("the symmetry ends cleanly: deleting a fold point, or removing it on purpose, leaves a plain piece", () => {
  const p = halfFront(), u = unfold(p, 3); S.pieces.push(u);
  const shape = JSON.stringify(u.pts.slice(1));
  deletePoint(u, 0); settle();                                 // the upper fold point
  assert.strictEqual(u.half, undefined);
  assert.strictEqual(JSON.stringify(u.pts), shape, "the remaining outline is unchanged");
  const u2 = unfold(p, 3); S.pieces.push(u2);
  delete u2.half; u2.pts[1] = V(300, 0); settle();
  samePt(u2.pts[5], V(-100, 10), "independent halves: the other side stays");
});

test("what can be edited: both halves and linked copies; only Smooth Curve and Fullness are kept to the first half", () => {
  const p = halfFront(), u = unfold(p, 3); S.pieces.push(u);
  addChild(u, "internals", mkShape([V(30, 100), V(80, 150)], false)); settle();
  const hit = (k, i, sh) => ({ k, p: u, sh: sh || u, kind: sh ? "internal" : "outline", i });
  assert.strictEqual(followerMsg(hit("pt", 1)), "", "a kept-half point"); assert.strictEqual(followerMsg(hit("seg", 2)), "");
  assert.strictEqual(followerMsg(hit("pt", 0)), "", "the fold points"); assert.strictEqual(followerMsg(hit("pt", 3)), "");
  // since R4 the second half is edited directly, with every tool but the two that rebuild a stretch of outline
  S.tool = "edit_pattern";
  for (const h of [hit("pt", 4), hit("seg", 3), hit("seg", 5), { k: "handle", p: u, sh: u, seg: 4, h: "c1" }, hit("seg", 0, u.internals[1])]) assert.strictEqual(followerMsg(h), "");
  S.tool = "smooth_curve";
  assert.ok(/other half/.test(followerMsg(hit("pt", 4)))); assert.ok(followerMsg(hit("seg", 3))); assert.ok(followerMsg(hit("seg", 5)));
  assert.ok(followerMsg({ k: "handle", p: u, sh: u, seg: 4, h: "c1" }));
  assert.strictEqual(followerMsg(hit("seg", 0, u.internals[0])), ""); assert.ok(followerMsg(hit("seg", 0, u.internals[1])), "the mirrored internal line");
  assert.strictEqual(followerMsg(hit("seg", 2)), "", "the first half");
  assert.strictEqual(followerMsg({ k: "body", p: u }), "");
  const m = mkLinked(p, "instance", affOf((q) => V(q.x + 300, q.y))); m.name = "Copy"; S.pieces.push(m); settle();
  assert.strictEqual(followerMsg({ k: "pt", p: m, sh: m, kind: "outline", i: 1 }), "", "a linked copy is edited directly");
  S.tool = "edit_pattern";
  assert.strictEqual(followerMsg({ k: "body", p: m }), "", "a copy can still be picked up and moved");
});

module.exports = T;
