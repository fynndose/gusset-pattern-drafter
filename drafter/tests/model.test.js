// Document model v6: per-pattern properties, child shape ids, seams on internal lines,
// layer stacking and lock.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], selSeg: -1, selKind: "outline", selInt: -1,
  nextSegId: 1, nextShapeId: 1, nextId: 1, view: { s: 1, x: 0, y: 0 },
  show: { baseline: true, reference: true, sa: true, symmetric: true, grainline: true, length: true, name: true, angle: false, annotations: true, measurements: true, ruler: true, guides: true } };
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", "normGuides", "mkAnchor", "anchorAt", "measureInfo", "validMeasures", "affOf", "affApply", "affMul", "syncHalf", "chainIdx", "mkLinked", 
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "flattenSA",
  "signedArea", "outN", "lineX", "offsetVar", "CORNERS", "cornerPts", "cutLine", "inside",
  "reflectAcross", "reflector", "mapPiece", "byId", "selPieces", "primary", "freeSel", "pickable", "stack",
  "sync", "mkPiece", "normProps", "unfold",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "addChild",
  "setCurve", "mkShape", "rectShape",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "dartGeom",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "seamEnds", "validSeams", "seamOn", "makeSeam", "loadSeams",
  "migrate", "resolveRefs", "alignMirrorIds", "NOTCH_DEFAULT", "normNotch", "loadDoc",
  "toS", "toW", "RP", "nearT", "subShapes", "shapeShown", "hit", "pieceAt", "lockedAt",
], { S });
const { V, mkShape, rectShape, mkPiece, normProps, addChild, addPoint, unfold, sync, clone, stack, freeSel, pickable,
  seamInfo, seamOn, makeSeam, loadSeams, resolveRefs, migrate, loadDoc, hit, pieceAt, lockedAt } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.sel = []; S.selSeg = -1; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; }
const DEFAULTS = { category: "", classification: "", quantity: 1, lock: false, layer: 0, shrink: { w: 100, h: 100 } };
const props = (p) => ({ category: p.category, classification: p.classification, quantity: p.quantity, lock: p.lock, layer: p.layer, shrink: p.shrink });
// a 200 × 300 panel with two internal lines: a 120 mm horizontal and a 90 mm vertical
function panel(x = 0) {
  const p = mkPiece("Panel", rectShape(x, 0, 200, 300));
  addChild(p, "internals", mkShape([V(x + 40, 100), V(x + 160, 100)], false));
  addChild(p, "internals", mkShape([V(x + 100, 150), V(x + 100, 240)], false));
  S.pieces.push(p);
  return p;
}

test("a new pattern has every property at its default", () => {
  reset();
  assert.deepStrictEqual(props(mkPiece("P", rectShape(0, 0, 10, 10))), DEFAULTS);
});

test("normProps coerces junk into valid values and keeps good ones", () => {
  const bad = normProps({ category: 5, classification: null, quantity: "0", lock: "yes", layer: "2.6", shrink: { w: -3, h: "abc" } });
  assert.deepStrictEqual(props(bad), { ...DEFAULTS, layer: 3 });
  const empty = normProps({ quantity: "", layer: null, shrink: null });
  assert.deepStrictEqual(props(empty), DEFAULTS);
  const good = normProps({ category: "Sleeve", classification: "Shell", quantity: "2", lock: true, layer: -1, shrink: { w: "97.5", h: 103 } });
  assert.deepStrictEqual(props(good), { category: "Sleeve", classification: "Shell", quantity: 2, lock: true, layer: -1, shrink: { w: 97.5, h: 103 } });
});

test("a v5 file loads: properties filled in, children get unique ids, the counter moves above them", () => {
  reset();
  const p = panel();
  const old = JSON.parse(JSON.stringify(p));
  for (const k of Object.keys(DEFAULTS)) delete old[k];
  old.layer = 0;                                      // v5 pieces had layer only
  old.internals.forEach(it => delete it.id);
  old.bases.push({ pts: [V(0, 0), V(50, 50)], closed: false, segs: [{ id: 900, curved: false, c1: null, c2: null, sa: 0, notches: [] }] });
  reset();
  loadDoc({ v: 5, nextId: 2, nextSegId: 50, pieces: [old], seams: [] });
  const q = S.pieces[0];
  assert.deepStrictEqual(props(q), DEFAULTS);
  const ids = [...q.internals, ...q.bases].map(it => it.id);
  assert.ok(ids.every(Number.isInteger), "every child has an id");
  assert.strictEqual(new Set(ids).size, 3, "child ids are unique");
  assert.ok(S.nextShapeId > Math.max(...ids), "next id is above every id in the file");
});

test("a v6 file round-trips: properties and child ids unchanged, new ids never collide", () => {
  reset();
  const p = panel();
  Object.assign(p, { category: "Body", classification: "Shell", quantity: 2, lock: true, layer: 3, shrink: { w: 98, h: 101.5 } });
  const ids = p.internals.map(it => it.id);
  const text = JSON.stringify({ v: 6, nextId: S.nextId, nextSegId: S.nextSegId, nextShapeId: S.nextShapeId, pieces: S.pieces, seams: [] });
  reset();
  loadDoc(JSON.parse(text));
  const q = S.pieces[0];
  assert.deepStrictEqual(props(q), { category: "Body", classification: "Shell", quantity: 2, lock: true, layer: 3, shrink: { w: 98, h: 101.5 } });
  assert.deepStrictEqual(q.internals.map(it => it.id), ids);
  addChild(q, "bases", mkShape([V(0, 0), V(9, 9)], false));
  assert.ok(!ids.includes(q.bases[0].id), "a new child gets a fresh id");
  // a file that lost its counter still starts above the ids it holds
  reset();
  const d = JSON.parse(text); delete d.nextShapeId;
  loadDoc(d);
  assert.ok(S.nextShapeId > Math.max(...ids));
});

test("a seam can pair an internal line with an outline edge, with arc lengths from the right shapes", () => {
  reset();
  const A = panel(), B = mkPiece("B", rectShape(400, 0, 110, 50)); S.pieces.push(B);
  const it = A.internals[0];
  const sm = makeSeam([], { piece: A.id, shape: it.id, sid: it.segs[0].id }, { piece: B.id, sid: B.segs[0].id }, false);
  assert.deepStrictEqual(sm.a, [{ piece: A.id, shape: it.id, sids: [it.segs[0].id], t0: 0, t1: 1, rev: false }]);
  assert.strictEqual(sm.b[0].shape, 0, "an outline side is shape 0");
  const inf = seamInfo(sm, S.pieces);
  near(inf.la, 120, 1e-9); near(inf.lb, 110, 1e-9); near(inf.diff, 10, 1e-9);
  assert.strictEqual(inf.sa, it); assert.strictEqual(inf.sb, B);
});

test("an internal segment and an outline segment with the same id are different seam sides", () => {
  reset();
  const A = panel(), B = mkPiece("B", rectShape(400, 0, 200, 50)); S.pieces.push(B);
  // Clone as Internal Shape copies the outline's segment ids
  const j = addChild(A, "internals", { pts: A.pts.map(G.cp), segs: clone(A.segs), closed: true });
  const cl = A.internals[j], sid = A.segs[0].id;
  assert.strictEqual(cl.segs[0].id, sid);
  const seams = [makeSeam([], { piece: A.id, shape: cl.id, sid }, { piece: B.id, sid: B.segs[0].id })];
  assert.strictEqual(seamOn(seams, A.id, sid), null, "the outline edge is not sewn");
  assert.strictEqual(seamOn(seams, A.id, sid, cl.id).id, 1, "the internal copy is");
  // outline to its own internal copy is a real pair, not "the same segment"
  assert.ok(makeSeam(seams, { piece: A.id, sid }, { piece: A.id, shape: cl.id, sid }));
  assert.strictEqual(makeSeam(seams, { piece: A.id, shape: cl.id, sid }, { piece: A.id, shape: cl.id, sid }), null);
});

test("an internal-line seam follows its shape through reordering and edits, and goes when the shape goes", () => {
  reset();
  const A = panel(), B = mkPiece("B", rectShape(400, 0, 90, 50)); S.pieces.push(B);
  const it = A.internals[1];                          // the 90 mm vertical line
  S.seams = [makeSeam([], { piece: A.id, shape: it.id, sid: it.segs[0].id }, { piece: B.id, sid: B.segs[0].id })];
  addPoint(A, 0, 0.5);                                // an outline edit
  A.internals.splice(0, 1);                           // the line is now internals[0]
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(S.seams.length, 1);
  assert.strictEqual(seamInfo(S.seams[0], S.pieces).sa, it);
  near(seamInfo(S.seams[0], S.pieces).diff, 0, 1e-9);
  // split the sewn internal line: the seam covers both halves (same rule as outline edges)
  addPoint(it, 0, 0.5);
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(S.seams[0].a[0].sids.length, 2);
  near(seamInfo(S.seams[0], S.pieces).la, 90, 1e-9);
  // moved to the base lines: base lines can't be sewn, so the seam is dropped
  const snapshot = JSON.stringify({ pieces: S.pieces, seams: S.seams });
  A.bases.push(A.internals.pop());
  assert.deepStrictEqual(resolveRefs(S.pieces, S.seams), []);
  // undo (a JSON snapshot) brings it back; deleting the shape drops it too
  const back = JSON.parse(snapshot);
  assert.strictEqual(resolveRefs(back.pieces, back.seams).length, 1);
  back.pieces[0].internals.length = 0;
  assert.deepStrictEqual(resolveRefs(back.pieces, back.seams), []);
});

test("seams from v5 files (no shape) load onto the outline; internal seams round-trip", () => {
  reset();
  const A = panel(), B = mkPiece("B", rectShape(400, 0, 90, 50)); S.pieces.push(B);
  const it = A.internals[0];
  const v5 = loadSeams([{ id: 1, a: { piece: A.id, sid: A.segs[1].id }, b: { piece: B.id, sid: B.segs[1].id }, rev: true }], S.pieces);
  assert.deepStrictEqual(v5, [{ id: 1, a: [{ piece: A.id, shape: 0, sids: [A.segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[1].id], t0: 0, t1: 1, rev: true }] }]);
  const seams = [makeSeam([], { piece: A.id, shape: it.id, sid: it.segs[0].id }, { piece: B.id, sid: B.segs[0].id })];
  const doc = JSON.parse(JSON.stringify({ pieces: S.pieces, seams }));
  assert.deepStrictEqual(loadSeams(doc.seams, doc.pieces), seams);
  // a side naming a shape that doesn't exist is rejected
  assert.deepStrictEqual(loadSeams([{ id: 3, a: { piece: A.id, shape: 777, sid: it.segs[0].id }, b: seams[0].b }], S.pieces), []);
});

test("unfold: child ids stay unique within the new piece and properties carry over", () => {
  reset();
  const A = panel();
  addChild(A, "bases", mkShape([V(10, 10), V(60, 10)], false));
  Object.assign(A, { category: "Body", classification: "Shell", quantity: 4, lock: true, layer: 2, shrink: { w: 97, h: 99 } });
  const U = unfold(A, 1);
  const ids = [...U.internals, ...U.bases].map(it => it.id);
  assert.strictEqual(ids.length, 6);
  assert.strictEqual(new Set(ids).size, 6, "unique child ids");
  assert.deepStrictEqual(props(U), { category: "Body", classification: "Shell", quantity: 1, lock: false, layer: 2, shrink: { w: 97, h: 99 } });
  assert.notStrictEqual(U.shrink, A.shrink, "shrink is a copy, not shared");
});

test("linked mirror: children keep the source's ids, so a seam on the mirror's internal line survives sync", () => {
  reset();
  const A = panel(), B = mkPiece("B", rectShape(600, 0, 120, 50)); S.pieces.push(B);
  const M = clone(A); M.id = S.nextId++; M.link = { of: A.id, kind: "symmetric", m: G.affOf(G.reflector(V(220, 0), V(220, 300))) };
  S.pieces.push(M); sync();
  const it = M.internals[0];
  assert.strictEqual(it.id, A.internals[0].id);
  S.seams = [makeSeam([], { piece: M.id, shape: it.id, sid: it.segs[0].id }, { piece: B.id, sid: B.segs[0].id })];
  A.internals[0].pts[1] = V(180, 100);                // lengthen the source's line to 140
  addChild(A, "internals", mkShape([V(20, 20), V(30, 30)], false));
  sync(); S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(S.seams.length, 1);
  near(seamInfo(S.seams[0], S.pieces).la, 140, 1e-9, "mirror side follows the source");
  assert.strictEqual(new Set(M.internals.map(x => x.id)).size, 3);
});

test("stacking: layer first, then selected over unselected, then list order", () => {
  reset();
  const a = mkPiece("a", rectShape(0, 0, 100, 100)), b = mkPiece("b", rectShape(50, 50, 100, 100)), c = mkPiece("c", rectShape(60, 60, 100, 100));
  S.pieces.push(a, b, c);
  const names = () => stack().map(p => p.name).join("");
  assert.strictEqual(names(), "abc");
  S.sel = [a.id];
  assert.strictEqual(names(), "bca", "selected goes on top within a layer");
  b.layer = 1;
  assert.strictEqual(names(), "cab", "a higher layer beats selection");
  a.layer = 1;
  assert.strictEqual(names(), "cba");
  c.layer = -1; a.layer = 0; b.layer = 0; S.sel = [];
  assert.strictEqual(names(), "cab");
  // clicks go to the top of the stack: (70,70) is inside all three (view is 1:1)
  a.layer = b.layer = c.layer = 0;
  assert.strictEqual(pieceAt(70, 70).name, "c");
  a.layer = 5;
  assert.strictEqual(pieceAt(70, 70).name, "a");
  assert.strictEqual(hit(70, 70).p.name, "a");
});

test("lock: the canvas can't reach a locked pattern, and it is left out of edits and select-all", () => {
  reset();
  const a = mkPiece("a", rectShape(0, 0, 100, 100)), b = mkPiece("b", rectShape(200, 0, 100, 100));
  S.pieces.push(a, b);
  assert.strictEqual(hit(0, 0).k, "pt");              // a corner point of a
  assert.strictEqual(hit(50, 0).k, "seg");
  assert.strictEqual(hit(50, 50).k, "body");
  a.lock = true;
  for (const [x, y] of [[0, 0], [50, 0], [50, 50]]) assert.strictEqual(hit(x, y), null, "locked: nothing to grab at " + x + "," + y);
  assert.strictEqual(pieceAt(50, 50), null);
  assert.strictEqual(lockedAt(50, 50), a, "the right-click menu can still find it");
  assert.strictEqual(lockedAt(250, 50), null);
  assert.strictEqual(hit(250, 50).p, b, "other patterns are unaffected");
  // a locked pattern under an unlocked one doesn't block it, and is skipped when on top
  b.pts.forEach(q => { q.x -= 150; });                // b now overlaps a at x 50..100
  a.layer = 9;
  assert.strictEqual(pieceAt(75, 50), b);
  S.sel = [a.id, b.id];
  assert.deepStrictEqual(freeSel().map(p => p.name), ["b"]);
  assert.deepStrictEqual(pickable(), [b.id]);
  // curve handles of a locked, selected pattern can't be grabbed either
  G.setCurve(a, 0, true); S.sel = [a.id]; S.selSeg = 0;
  assert.strictEqual(hit(a.segs[0].c1.x, a.segs[0].c1.y), null);
  a.lock = false;
  assert.strictEqual(hit(a.segs[0].c1.x, a.segs[0].c1.y).k, "handle");
});

module.exports = T;
