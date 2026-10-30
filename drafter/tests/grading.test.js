// Phase 10: size groups and sizes, grade and non-grade points, rule tables, curve grading,
// inserting sizes, and grading following a piece through turns, linked copies and
// symmetric unfolds.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], guides: [], measures: [], grading: null, sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null };
const G0 = load([
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "signedArea", "lineX", "inside", "reflectAcross", "reflector",
  "affOf", "affApply", "affMul", "mapPiece", "byId", "sync", "mkLinked", "syncHalf", "unfold", "chainIdx", "bboxOf",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "addChild",
  "setCurve", "mkShape", "rectShape", "mkPiece", "normProps",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "deletePoint", "dartGeom", "addDartTo",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "validSeams", "makeSeam", "loadSeams", "resolveRefs",
  "cross", "dot", "locateOn",
  "GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "ensureGrade", "ptKey", "mapDelta", "entryMap",
  "shapeDeltas", "gradedPiece", "ptDelta", "setPtDelta", "setGradePoint", "newTable", "saveRule", "assignRule", "unusedTables", "gradeMaps",
  "insertSize", "deleteSize", "pruneGrade", "turnGrade", "mirrorGrade", "gradeProportional",
  "normGuides", "mkAnchor", "anchorAt", "measureInfo", "validMeasures", "NOTCH_DEFAULT", "normNotch", "migrate", "alignMirrorIds", "loadDoc",
], { S });
const { V, add, dist, clone, segLen, segPt, bboxOf, mapPiece, sync, mkLinked, unfold, affOf, reflector, addChild, addPoint, deletePoint, setCurve, mkShape, rectShape, mkPiece, addDartTo, dartGeom,
  defaultGrading, normGrading, gSize, gGroup, isGraded, ensureGrade, ptKey, shapeDeltas, gradedPiece, ptDelta, setPtDelta, setGradePoint, newTable, saveRule, assignRule,
  unusedTables, insertSize, deleteSize, pruneGrade, gradeProportional, loadDoc } = G0;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });
// sizes: 1 XS, 2 S, 3 M (base), 4 L, 5 XL
function reset() { S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.grading = defaultGrading(); return S.grading; }
function panel(w = 200, h = 100) { const p = mkPiece("P" + (S.pieces.length + 1), rectShape(0, 0, w, h)); S.pieces.push(p); return p; }
// grade a point with the same step per size: step × (size − base)
const stepped = (G, p, sh, i, sx, sy) => { for (const z of [1, 2, 4, 5]) setPtDelta(G, p, sh, i, z, sx*(z - 3), sy*(z - 3)); };

test("a new document has a placeholder size run with a base; a file's own grading is kept, a broken one replaced", () => {
  const G = defaultGrading();
  assert.deepStrictEqual(G.groups[0].sizes.map(z => z.name), ["XS", "S", "M", "L", "XL"]);
  assert.strictEqual(gSize(G, G.groups[0].base).name, "M"); assert.strictEqual(G.groups[0].name, "Size Group", "called as the file's program calls its own (Round I2; it was \"Sizes (placeholder)\")");
  assert.strictEqual(new Set(G.groups[0].sizes.map(z => z.color)).size, 5, "a colour per size");
  assert.deepStrictEqual(normGrading(undefined), defaultGrading()); assert.deepStrictEqual(normGrading({ groups: [] }), defaultGrading());
  const mine = { groups: [{ id: 7, name: "EU", base: 99, sizes: [{ id: 8, name: "36", color: "#123456" }, { id: 9, name: "38" }, null, { id: "x", name: "40" }] }],
    tables: [{ id: 12, name: "Bodice", rules: { A: { 9: { dx: 5, dy: 0 } } } }, { name: "no id" }], active: 9, nest: true, nextId: 3 };
  const n = normGrading(mine);
  assert.deepStrictEqual(n.groups[0].sizes.map(z => [z.id, z.name, z.color]), [[8, "36", "#123456"], [9, "38", "#f08c00"]]);
  assert.strictEqual(n.groups[0].base, 8, "a base that isn't one of the sizes falls back to the first");
  assert.strictEqual(n.tables.length, 1); assert.strictEqual(n.active, 9); assert.strictEqual(n.nest, true);
  assert.strictEqual(n.nextId, 13, "new ids start above everything in the file");
});

test("grade points take their own offset; non-grade points move in proportion along the outline between them", () => {
  const G = reset(), p = panel();                              // 0 (0,0) · 1 (200,0) · 2 (200,100) · 3 (0,100)
  assert.strictEqual(shapeDeltas(G, ensureGrade(G, p) && p, p, 4), null, "no grade points: not graded");
  assert.strictEqual(isGraded(p), false);
  setGradePoint(G, p, p, 0, true);                             // stays put in every size
  setPtDelta(G, p, p, 2, 4, 30, 15);                           // the opposite corner moves out in L
  const d = shapeDeltas(G, p, p, 4);
  samePt(d[0], V(0, 0)); samePt(d[2], V(30, 15));
  samePt(d[1], V(20, 10), "two thirds of the way from point 0 to point 2 (200 of 300 mm)");
  samePt(d[3], V(10, 5), "one third of the way back from point 2 to point 0");
  assert.deepStrictEqual(shapeDeltas(G, p, p, 5).map(v => [v.x, v.y]), [[0, 0], [0, 0], [0, 0], [0, 0]], "a size with no values doesn't move");
  // one grade point alone carries the whole shape
  setGradePoint(G, p, p, 0, false);
  assert.deepStrictEqual(shapeDeltas(G, p, p, 4).map(v => [v.x, v.y]), [[30, 15], [30, 15], [30, 15], [30, 15]]);
  // an open line: beyond its end grade points, points move with the nearest one
  const ln = p.internals[addChild(p, "internals", mkShape([V(10, 50), V(60, 50), V(110, 50), V(160, 50)], false))];
  setPtDelta(G, p, ln, 1, 4, 4, 0); setPtDelta(G, p, ln, 3, 4, 12, 0);
  assert.deepStrictEqual(shapeDeltas(G, p, ln, 4).map(v => v.x), [4, 4, 8, 12]);
  assert.strictEqual(ptKey(p, ln, 3), ln.id + ":" + ln.segs[2].id + ":e", "the last point of an open line has its own key");
  assert.strictEqual(setPtDelta(G, p, p, 2, 3, 9, 9), false, "the base size is the drawing itself: it has no offset");
});

test("a pattern in one size: points, curves with their handles, internal shapes, the grainline, darts", () => {
  const G = reset(), p = panel(200, 300);
  setCurve(p, 1, true); p.segs[1].c1 = V(230, 100); p.segs[1].c2 = V(230, 200);
  p.grain = { a: V(40, 60), b: V(40, 240) };
  addDartTo(p, 0, 0.5, 20, 60);
  const pocket = p.internals[addChild(p, "internals", rectShape(120, 180, 50, 60))];
  const mark = p.internals[addChild(p, "internals", mkShape([V(20, 280), V(60, 280)], false))];
  for (const i of [0, 3]) setGradePoint(G, p, p, i, true);      // the left edge is fixed
  for (const i of [1, 2]) stepped(G, p, p, i, 10, 0);           // the right edge moves 10 per size
  setPtDelta(G, p, mark, 0, 4, 0, 7); setPtDelta(G, p, mark, 1, 4, 3, 7);
  const before = JSON.stringify(p);
  assert.strictEqual(gradedPiece(G, p, 3), null, "the base size is the pattern as drawn");
  assert.strictEqual(gradedPiece(G, p, 77), null, "not one of its sizes");
  const L = gradedPiece(G, p, 4), XS = gradedPiece(G, p, 1);
  assert.strictEqual(JSON.stringify(p), before, "the pattern itself is not changed");
  assert.deepStrictEqual(L.pts.map(q => q.x), [0, 210, 210, 0]); assert.deepStrictEqual(XS.pts.map(q => q.x), [0, 180, 180, 0]);
  samePt(L.segs[1].c1, V(240, 100), "a handle travels with its end point"); samePt(L.segs[1].c2, V(240, 200));
  near(segLen(L, 1), segLen(p, 1), 1e-9, "so the curve keeps its shape");
  // the pocket has no grading of its own: it moves as a whole, by the outline's offset at the nearest place (the right edge)
  L.internals[0].pts.forEach((q, i) => samePt(q, add(pocket.pts[i], V(10, 0)), "pocket point " + i, 0.05));
  assert.deepStrictEqual(L.internals[1].pts, [V(20, 287), V(63, 287)], "the mark line has its own grade points");
  samePt(L.grain.a, V(40, 60), "the grainline is nearest the fixed edge");
  near(dartGeom(L, L.darts[0]).C.x, 105, 1e-9, "the dart stays half-way along its edge");
  assert.strictEqual(L.grade, undefined);
  // curve grading: extra movement of the two handles, on top of following the ends
  p.grade.curves["0:" + p.segs[1].id] = { c1: { 4: { dx: 6, dy: 0 } }, c2: { 4: { dx: 6, dy: -2 } } };
  const L2 = gradedPiece(G, p, 4);
  samePt(L2.segs[1].c1, V(246, 100)); samePt(L2.segs[1].c2, V(246, 198));
  assert.ok(segLen(L2, 1) > segLen(L, 1), "the edge is fuller in this size");
  samePt(gradedPiece(G, p, 2).segs[1].c1, V(220, 100), "other sizes are not affected");
});

test("converting a point to a grade point, or back, at the moment it is done", () => {
  const G = reset(), p = panel();
  setGradePoint(G, p, p, 0, true); stepped(G, p, p, 2, 12, 6);
  const shape = (z) => JSON.stringify(gradedPiece(G, p, z).pts.map(q => [+q.x.toFixed(9), +q.y.toFixed(9)]));
  const was = [1, 2, 4, 5].map(shape);
  setGradePoint(G, p, p, 1, true);
  assert.deepStrictEqual([1, 2, 4, 5].map(shape), was, "becoming a grade point moves nothing: it starts with the offsets it had");
  assert.deepStrictEqual(p.grade.pts[ptKey(p, p, 1)].d[4], { dx: 8, dy: 4 });
  setPtDelta(G, p, p, 1, 4, 20, 0);
  samePt(gradedPiece(G, p, 4).pts[1], V(220, 0), "now it has its own"); samePt(gradedPiece(G, p, 5).pts[1], V(216, 8), "and keeps the rest");
  setGradePoint(G, p, p, 1, false);
  assert.deepStrictEqual([1, 2, 4, 5].map(shape), was, "back to moving in proportion");
});

test("rule tables: one named rule drives points on several patterns; a point edited by hand is cut loose with its values", () => {
  const G = reset(), a = panel(), b = panel();
  stepped(G, a, a, 2, 10, 5);
  const t = saveRule(G, a, a, 2, "side hem");
  assert.strictEqual(G.tables.length, 1, "a table is made when the pattern has none"); assert.strictEqual(a.grade.table, t.id);
  assert.deepStrictEqual(a.grade.pts[ptKey(a, a, 2)], { rule: "side hem" });
  assert.deepStrictEqual(t.rules["side hem"][5], { dx: 20, dy: 10 });
  ensureGrade(G, b).table = t.id;
  assignRule(G, b, b, 1, "side hem"); assignRule(G, b, b, 2, "side hem");
  samePt(gradedPiece(G, b, 5).pts[2], V(220, 110));
  t.rules["side hem"][5] = { dx: 30, dy: 0 };                    // edit the rule once
  samePt(gradedPiece(G, a, 5).pts[2], V(230, 100), "pattern a follows"); samePt(gradedPiece(G, b, 5).pts[1], V(230, 0), "and both points of pattern b");
  setPtDelta(G, b, b, 1, 5, 44, 0);                              // nudge one point
  assert.strictEqual(b.grade.pts[ptKey(b, b, 1)].rule, undefined, "cut loose from the rule");
  assert.deepStrictEqual(b.grade.pts[ptKey(b, b, 1)].d[4], { dx: 10, dy: 5 }, "keeping the rule's values for the other sizes");
  samePt(gradedPiece(G, b, 5).pts[2], V(230, 100), "the other point still follows the rule");
  // a rule the table doesn't have gives no movement, not an error
  assignRule(G, b, b, 3, "missing"); samePt(gradedPiece(G, b, 5).pts[3], V(0, 100));
  // unused tables
  const spare = newTable(G, "Spare");
  assert.deepStrictEqual(unusedTables(G, S.pieces), [spare]);
});

test("inserting a size: between two it is half-way, on an end it is one more step; everything graded gets a value", () => {
  const G = reset(), p = panel();
  setCurve(p, 1, true);
  stepped(G, p, p, 2, 10, 4); setGradePoint(G, p, p, 0, true);
  const t = saveRule(G, p, p, 2, "R");
  setPtDelta(G, p, p, 1, 4, 7, 0); setPtDelta(G, p, p, 1, 5, 21, 0);
  p.grade.curves["0:" + p.segs[1].id] = { c1: { 4: { dx: 2, dy: 0 }, 5: { dx: 6, dy: 0 } }, c2: {} };
  const mid = insertSize(G, S.pieces, 1, 5, "L/XL");            // between L and XL
  assert.deepStrictEqual(G.groups[0].sizes.map(z => z.name), ["XS", "S", "M", "L", "L/XL", "XL"]);
  assert.deepStrictEqual(t.rules.R[mid.id], { dx: 15, dy: 6 }, "rule: half-way between 10 and 20");
  assert.deepStrictEqual(p.grade.pts[ptKey(p, p, 1)].d[mid.id], { dx: 14, dy: 0 }, "a point's own offsets too");
  assert.deepStrictEqual(p.grade.curves["0:" + p.segs[1].id].c1[mid.id], { dx: 4, dy: 0 }, "and curve grading");
  const half = insertSize(G, S.pieces, 1, 4, "M/L");            // between the base and L
  assert.deepStrictEqual(t.rules.R[half.id], { dx: 5, dy: 2 }, "half-way from the base (which is zero) to L");
  const big = insertSize(G, S.pieces, 1, null, "XXL");          // on the end
  assert.deepStrictEqual(t.rules.R[big.id], { dx: 25, dy: 10 }, "XL plus the step from L/XL to XL");
  const small = insertSize(G, S.pieces, 1, 1, "XXS");           // at the front
  assert.deepStrictEqual(t.rules.R[small.id], { dx: -30, dy: -12 }, "XS minus the step from S to XS");
  assert.strictEqual(new Set(G.groups[0].sizes.map(z => z.id)).size, 9); assert.ok(G.groups[0].sizes.every(z => /^#/.test(z.color)));
  samePt(gradedPiece(G, p, mid.id).pts[2], V(215, 106));
  // a rule that has a value in one size only gets no made-up value for a new size beside a size it says nothing about
  t.rules.sparse = { 4: { dx: 5, dy: 0 } };
  const far = insertSize(G, S.pieces, 1, null, "3XL");
  assert.strictEqual(t.rules.sparse[far.id], undefined, "XXL has no value in this rule, so neither does 3XL");
  assert.ok(t.rules.R[far.id], "a fully graded rule still gets one");
  // deleting: not the base, and the offsets go with the size
  assert.strictEqual(deleteSize(G, S.pieces, 3), false, "the base size stays");
  G.active = mid.id;
  assert.strictEqual(deleteSize(G, S.pieces, mid.id), true);
  assert.strictEqual(t.rules.R[mid.id], undefined); assert.strictEqual(G.active, null); assert.strictEqual(gradedPiece(G, p, mid.id), null);
});

test("size groups: a pattern is graded in its own group's sizes only", () => {
  const G = reset(), p = panel(), q = panel();
  G.groups.push({ id: 20, name: "Petite", base: 21, sizes: [{ id: 21, name: "P-M", color: "#111111" }, { id: 22, name: "P-L", color: "#222222" }] });
  ensureGrade(G, q).group = 20;
  setGradePoint(G, p, p, 0, true); setPtDelta(G, p, p, 2, 4, 10, 0);
  setGradePoint(G, q, q, 0, true); setPtDelta(G, q, q, 2, 22, 6, 0);
  assert.strictEqual(gGroup(G, p).id, 1); assert.strictEqual(gGroup(G, q).id, 20);
  assert.ok(gradedPiece(G, p, 4)); assert.strictEqual(gradedPiece(G, p, 22), null, "P-L is not one of pattern p's sizes");
  samePt(gradedPiece(G, q, 22).pts[2], V(206, 100)); assert.strictEqual(gradedPiece(G, q, 4), null);
  assert.deepStrictEqual(q.grade.pts[ptKey(q, q, 0)], { d: { 22: { dx: 0, dy: 0 } } }, "a grade point holds offsets for its own group's sizes");
  insertSize(G, S.pieces, 20, null, "P-XL");
  assert.strictEqual(Object.keys(p.grade.pts[ptKey(p, p, 2)].d).length, 4, "a new size in one group leaves the other group's offsets alone");
});

test("grading survives edits: added points move in proportion, a deleted grade point's entry is dropped", () => {
  const G = reset(), p = panel();
  setGradePoint(G, p, p, 0, true); setPtDelta(G, p, p, 1, 4, 20, 0); setPtDelta(G, p, p, 2, 4, 20, 0); setGradePoint(G, p, p, 3, true);
  addPoint(p, 0, 0.25);                                         // a new point on the top edge
  samePt(gradedPiece(G, p, 4).pts[1], V(55, 0), "a quarter of the way along, so a quarter of the growth");
  const key = ptKey(p, p, 2);
  deletePoint(p, 2); pruneGrade(p);
  assert.strictEqual(p.grade.pts[key], undefined);
  assert.strictEqual(Object.keys(p.grade.pts).length, 3);
  assert.ok(gradedPiece(G, p, 4).pts.every(q => Number.isFinite(q.x)));
});

test("turning or flipping a graded pattern turns its grading with it; moving it changes nothing", () => {
  const G = reset(), p = panel();
  setCurve(p, 1, true); p.segs[1].c1 = V(230, 30); p.segs[1].c2 = V(215, 80);
  setGradePoint(G, p, p, 0, true); stepped(G, p, p, 2, 10, 4); setPtDelta(G, p, p, 1, 4, 14, -3);
  saveRule(G, p, p, 2, "R");
  p.grade.curves["0:" + p.segs[1].id] = { c1: { 4: { dx: 5, dy: 1 } }, c2: { 4: { dx: 2, dy: 2 } } };
  const want = gradedPiece(G, p, 4);
  const maps = { move: (q) => V(q.x + 70, q.y - 40), turn: (q) => V(-q.y, q.x), flip: reflector(V(300, 0), V(300, 100)), slant: (q) => { const c = Math.cos(0.4), s2 = Math.sin(0.4); return V(q.x*c - q.y*s2 + 9, q.x*s2 + q.y*c); } };
  for (const [name, f] of Object.entries(maps)) {
    const q = clone(p); q.id = 50; S.pieces.push(q);
    mapPiece(q, f);
    const got = gradedPiece(G, q, 4);
    want.pts.forEach((r, i) => samePt(got.pts[i], f(r), name + ": point " + i, 1e-9));
    samePt(got.segs[1].c1, f(want.segs[1].c1), name + ": handle", 1e-9); samePt(got.segs[1].c2, f(want.segs[1].c2), name + ": handle", 1e-9);
    assert.strictEqual(q.grade.pts[ptKey(q, q, 2)].rule, name === "move" ? "R" : undefined, name + ": a turned point is cut loose from the shared rule");
    S.pieces.pop();
  }
});

test("a linked copy is graded as its source; a symmetric unfold is graded symmetrically", () => {
  const G = reset();
  const p = mkPiece("Half", mkShape([V(0, 0), V(100, 10), V(120, 300), V(0, 300)], true)); S.pieces.push(p);
  setCurve(p, 1, true); p.segs[1].c1 = V(125, 100); p.segs[1].c2 = V(128, 200);
  setGradePoint(G, p, p, 0, true); setGradePoint(G, p, p, 3, true);
  stepped(G, p, p, 1, 8, -2); stepped(G, p, p, 2, 10, 0);
  saveRule(G, p, p, 2, "hem");
  p.grade.curves["0:" + p.segs[1].id] = { c1: { 4: { dx: 3, dy: 0 } }, c2: { 4: { dx: 1, dy: 0 } } };
  const kid = p.internals[addChild(p, "internals", mkShape([V(30, 100), V(80, 150)], false))];
  setPtDelta(G, p, kid, 1, 4, 5, 5);
  // a mirrored linked copy
  const m = mkLinked(p, "symmetric", affOf(reflector(V(200, 0), V(200, 100)))); S.pieces.push(m); sync();
  const gp = gradedPiece(G, p, 4), gm = gradedPiece(G, m, 4);
  gp.pts.forEach((q, i) => samePt(gm.pts[i], V(400 - q.x, q.y), "copy point " + i));
  samePt(gm.segs[1].c1, V(400 - gp.segs[1].c1.x, gp.segs[1].c1.y), "copy handle");
  samePt(gm.internals[0].pts[1], V(400 - gp.internals[0].pts[1].x, gp.internals[0].pts[1].y), "copy internal line");
  // the symmetric unfold of the same half, across its centre line (x = 0)
  const u = unfold(p, 3); S.pieces.push(u); sync();
  for (const z of [1, 2, 4, 5]) {
    const g = gradedPiece(G, u, z);
    for (const q of g.pts) assert.ok(g.pts.some(r => dist(r, V(-q.x, q.y)) < 1e-9), "size " + z + ": mirror image of " + JSON.stringify(q));
    g.pts.slice(0, 4).forEach((q, i) => samePt(q, gradedPiece(G, p, z).pts[i], "size " + z + ": the edited half is graded as the half pattern was"));
  }
  const g4 = gradedPiece(G, u, 4);
  for (const t of [0.25, 0.5, 0.8]) samePt(segPt(g4, 4, 1 - t), V(-segPt(g4, 1, t).x, segPt(g4, 1, t).y), "mirrored curve, with its curve grading, at " + t);
  samePt(g4.internals[1].pts[1], V(-g4.internals[0].pts[1].x, g4.internals[0].pts[1].y), "mirrored internal line");
  // editing the source half's grading reaches the mirrored half on the next sync
  setPtDelta(G, u, u, 1, 4, 30, 0); sync();
  const g5 = gradedPiece(G, u, 4);
  samePt(g5.pts[5], V(-g5.pts[1].x, g5.pts[1].y), "after an edit");
  assert.strictEqual(Object.keys(u.grade.pts).filter(k => k.startsWith("0:")).length, 6, "four on the edited half (two on the fold) and two mirrored");
});

test("Proportional Grading: every point a grade point, the pattern grows evenly about its middle", () => {
  const G = reset(), p = panel(200, 300);
  gradeProportional(G, p, 20, 12);
  assert.strictEqual(Object.keys(p.grade.pts).length, 4);
  for (const [z, k] of [[1, -2], [2, -1], [4, 1], [5, 2]]) {
    const b = bboxOf([gradedPiece(G, p, z)]);
    near(b.x1 - b.x0, 200 + 20*k, 1e-9, "width in size " + z); near(b.y1 - b.y0, 300 + 12*k, 1e-9, "height in size " + z);
    near((b.x0 + b.x1)/2, 100, 1e-9, "about the middle"); near((b.y0 + b.y1)/2, 150, 1e-9);
  }
  gradeProportional(G, p, 0, 0);
  assert.deepStrictEqual(gradedPiece(G, p, 5).pts, p.pts, "it replaces what was there");
});

test("grading is saved with the document and is part of every undo snapshot", () => {
  const G = reset(), p = panel();
  setGradePoint(G, p, p, 0, true); stepped(G, p, p, 2, 10, 5); saveRule(G, p, p, 2, "R");
  insertSize(G, S.pieces, 1, null, "XXL"); G.active = 4; G.nest = true;
  const want = gradedPiece(G, p, 5).pts;
  const text = JSON.stringify({ v: 8, nextId: S.nextId, nextSegId: S.nextSegId, nextShapeId: S.nextShapeId, grading: S.grading, pieces: S.pieces, seams: [] });
  S.pieces = []; S.grading = null;
  loadDoc(JSON.parse(text));
  assert.deepStrictEqual(S.grading, G);
  assert.deepStrictEqual(gradedPiece(S.grading, S.pieces[0], 5).pts, want);
  const old = JSON.parse(text); delete old.grading; delete old.pieces[0].grade;
  loadDoc(old);
  assert.deepStrictEqual(S.grading, defaultGrading(), "a file from before grading gets the placeholder size run");
  assert.strictEqual(gradedPiece(S.grading, S.pieces[0], 4), null);
  const src = require("./harness").appSource();
  // (Round perf-2 / 5) the snapshot is made from snapObj(), which every undo step is kept from (in parts) and snap() writes out
  assert.ok(/const snapObj = \(\) => \(\{[^}]*grading: S\.grading/.test(src) && /const snap = \(\) => JSON\.stringify\(snapObj\(\)\)/.test(src), "undo snapshots carry the grading");
});

module.exports = T;
