// Phase 8: view settings (defaults, saving, loading), hidden things not being clickable,
// corner angles, reference lines apart from baselines, and free annotations.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const store = new Map();
const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const S = { pieces: [], seams: [], guides: [], measures: [], sel: [], selSeg: -1, selKind: "outline", selInt: -1,
  nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null, view: { s: 1, x: 0, y: 0 }, show: null };
const noop = () => {};
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", 
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "flattenSA", "signedArea", "lineX", "inside", "reflectAcross", "reflector",
  "CORNERS", "cornerPts", "cutLine",
  "affOf", "affApply", "affMul", "mapPiece", "byId", "selPieces", "primary", "stack", "sync", "mkLinked", "syncHalf", "unfold", "chainIdx",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "addChild",
  "setCurve", "mkShape", "rectShape", "mkPiece", "normProps",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "dartGeom",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "validSeams", "makeSeam", "loadSeams", "resolveRefs",
  "cross", "dot", "blankSeg", "bisect", "polyCentroid", "slashSpread",
  "VIEW", "VIEW_DEFAULT", "VIEW_KEY", "loadView", "saveView", "setView", "shapeShown", "cornerAngle",
  "toS", "toW", "RP", "nearT", "subShapes", "hit",
  "normGuides", "mkAnchor", "anchorAt", "measureInfo", "validMeasures", "NOTCH_DEFAULT", "normNotch", "migrate", "alignMirrorIds", "loadDoc", "checkDoc",
], { S, localStorage, ui: noop, draw: noop });
const { V, dist, mapPiece, sync, mkLinked, unfold, affOf, addChild, addPoint, setCurve, mkShape, rectShape, mkPiece, slashSpread,
  VIEW, VIEW_DEFAULT, VIEW_KEY, loadView, saveView, setView, shapeShown, cornerAngle, hit, loadDoc, checkDoc } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.sel = []; S.selSeg = -1; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.show = { ...VIEW_DEFAULT }; store.clear(); }

test("view settings: the switches in their four groups, their defaults, and what a browser with nothing saved gets", () => {
  reset();
  const group = (g) => VIEW.filter(v => v[2] === g).map(v => v[0]);
  assert.deepStrictEqual(group("sewing"), ["sewing", "sewLen" /* (Round r20 / 3: Show 2D Sewing Lengths) */, "topstitch", "puckering"]);
  assert.deepStrictEqual(group("garment"), ["baseline", "sa", "grading", "reference", "symmetric", "links", "pins"]);
  assert.deepStrictEqual(group("info"), ["name", "annotations", "length", "angle", "grainline", "measurements", "ruler", "guides"]);
  // (Round build-1: Lock All Internal Lines, Lock All Baselines (on from the start) and Lock All Guidelines are built)
  assert.deepStrictEqual(group("lock"), ["lockAll", "lockInt", "lockBase", "lockGuide"]); assert.strictEqual(VIEW.length, 23);
  assert.strictEqual(VIEW_DEFAULT.lockAll, false, "patterns start unlocked");
  assert.deepStrictEqual(Object.keys(VIEW_DEFAULT).sort(), VIEW.map(v => v[0]).sort(), "a default for every switch");
  assert.deepStrictEqual(loadView(), VIEW_DEFAULT);
  assert.strictEqual(VIEW_DEFAULT.angle, false, "angles start hidden"); assert.strictEqual(VIEW_DEFAULT.length, true);
});

// (Round r23 / 1: every start looks the same) the switches are view state: changed for the session, never written, and a
// view an older build saved is not read
test("view settings change for the session only: nothing is written, and what an older build saved is not read", () => {
  reset();
  setView("grainline", false); setView("angle", true);
  assert.deepStrictEqual(S.show, { ...VIEW_DEFAULT, grainline: false, angle: true });
  assert.strictEqual(store.get(VIEW_KEY), undefined, "nothing written");
  S.show = null;
  assert.deepStrictEqual(loadView(), VIEW_DEFAULT, "the next session starts with the defaults");
  store.set(VIEW_KEY, JSON.stringify({ sa: false, angle: true }));
  assert.deepStrictEqual(loadView(), VIEW_DEFAULT, "an older build's saved view is not read");
  store.set(VIEW_KEY, "{not json");
  assert.deepStrictEqual(loadView(), VIEW_DEFAULT);
  S.show = { ...VIEW_DEFAULT };
  setView("name", false); assert.strictEqual(S.show.name, false);
});

test("the view settings are not part of the document: a file opens the same whatever is hidden", () => {
  reset();
  S.pieces.push(mkPiece("P", rectShape(0, 0, 100, 100)));
  const text = JSON.stringify({ v: 8, nextId: 2, nextSegId: 9, pieces: S.pieces, seams: [] });
  setView("sa", false); setView("ruler", false);
  loadDoc(JSON.parse(text));
  assert.strictEqual(S.show.sa, false, "opening a file leaves the view as it was"); assert.strictEqual(S.show.ruler, false);
  assert.ok(!/"show"|"sa":false/.test(text));
});

test("corner angles: 90 on a square, the same whichever way the outline runs, over 180 on an inside corner, by tangent on curves", () => {
  reset();
  const sq = mkPiece("sq", rectShape(0, 0, 200, 100));
  for (let i = 0; i < 4; i++) near(cornerAngle(sq, i), 90, 1e-9, "corner " + i);
  const other = mkPiece("ccw", mkShape([V(0, 0), V(0, 100), V(200, 100), V(200, 0)], true));
  for (let i = 0; i < 4; i++) near(cornerAngle(other, i), 90, 1e-9, "other winding, corner " + i);
  // an L shape: five right angles and one 270
  const L = mkPiece("L", mkShape([V(0, 0), V(200, 0), V(200, 100), V(100, 100), V(100, 200), V(0, 200)], true));
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map(i => Math.round(cornerAngle(L, i))), [90, 90, 90, 270, 90, 90]);
  near([0, 1, 2, 3, 4, 5].reduce((a, i) => a + cornerAngle(L, i), 0), 180*(6 - 2), 1e-9, "inside angles of a hexagon add up to 720");
  // a triangle 3-4-5
  const tri = mkPiece("tri", mkShape([V(0, 0), V(40, 0), V(0, 30)], true));
  near(cornerAngle(tri, 0), 90, 1e-9); near(cornerAngle(tri, 1), Math.atan2(30, 40)*180/Math.PI, 1e-9); near(cornerAngle(tri, 2), Math.atan2(40, 30)*180/Math.PI, 1e-9);
  // a point added on a straight edge is 180; a curve changes the angle at its ends
  addPoint(sq, 0, 0.5); near(cornerAngle(sq, 1), 180, 1e-9);
  setCurve(sq, 2, true); sq.segs[2].c1 = V(260, 30); sq.segs[2].c2 = V(260, 70);        // the right edge bulges out
  assert.ok(cornerAngle(sq, 2) > 120 && cornerAngle(sq, 3) > 120, "the corners open up where the edge leaves at a slant");
});

test("hidden things can't be clicked: baselines, reference lines, the grainline, the name, annotations", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 400, 400)); S.pieces.push(p);
  addChild(p, "bases", mkShape([V(50, 50), V(150, 50)], false));                          // a baseline
  addChild(p, "bases", { ...mkShape([V(50, 100), V(150, 100)], false), ref: true });       // a reference line
  addChild(p, "internals", mkShape([V(50, 150), V(150, 150)], false));
  p.grain = { a: V(300, 100), b: V(300, 300) }; p.anno = V(200, 250); p.notes = [{ text: "cut on fold", x: 200, y: 330 }];
  const at = (x, y, tool) => { S.tool = tool || "edit_pattern"; const h = hit(x, y); return h ? h.k + (h.kind ? ":" + h.kind : "") : null; };
  // each thing has the tool that can pick it: baselines Trace, the grainline Edit Texture, names and notes the annotation tools
  assert.strictEqual(at(100, 50, "trace"), "seg:base"); assert.strictEqual(at(100, 100, "trace"), "seg:base"); assert.strictEqual(at(100, 150), "seg:internal");
  assert.strictEqual(at(300, 100, "edit_texture"), "grain"); assert.strictEqual(at(200, 250, "edit_annotations"), "anno"); assert.strictEqual(at(200, 330, "edit_annotations"), "note");
  for (const tool of ["edit_pattern", "edit_curve_point", "transform_pattern", "add_point", "notch", "segment_sewing", "internal_polygon"]) {
    assert.strictEqual(at(100, 50, tool), "body", "a baseline can't be picked with " + tool);
    assert.strictEqual(at(50, 50, tool), "body", "nor its points");
    assert.strictEqual(at(300, 100, tool), "body", "nor the grainline"); assert.strictEqual(at(200, 330, tool), "body", "nor a note");
  }
  S.tool = "edit_pattern"; assert.strictEqual(hit(200, 330, { menu: true }).k, "note", "a right-click reaches a note with any tool");
  assert.strictEqual(shapeShown("base", p.bases[0]), true); assert.strictEqual(shapeShown("internal", p.internals[0]), true);
  S.show.baseline = false;
  assert.strictEqual(at(100, 50, "trace"), "body", "baseline hidden"); assert.strictEqual(at(50, 50, "trace"), "body", "and its points");
  assert.strictEqual(at(100, 100, "trace"), "seg:base", "the reference line is a separate switch");
  S.show.reference = false; assert.strictEqual(at(100, 100, "trace"), "body");
  S.show.baseline = true; assert.strictEqual(at(100, 50, "trace"), "seg:base"); assert.strictEqual(at(100, 100, "trace"), "body");
  S.show.grainline = false; assert.strictEqual(at(300, 100, "edit_texture"), "grain", "Edit Texture shows every grainline whatever the switch says"); assert.strictEqual(at(300, 100, "edit_pattern"), "body");
  S.show.name = false; assert.strictEqual(at(200, 250, "edit_annotations"), "body");
  S.show.annotations = false; assert.strictEqual(at(200, 330, "edit_annotations"), "body");
  assert.strictEqual(at(100, 150), "seg:internal", "internal lines are always there");
  assert.strictEqual(at(0, 0), "pt:outline");
});

test("annotations belong to their pattern: they move, turn, copy, unfold and spread with it, and are checked on load", () => {
  reset();
  const p = mkPiece("P", rectShape(0, 0, 200, 300)); S.pieces.push(p);
  p.grain = { a: V(40, 60), b: V(40, 240) };
  p.notes = [{ text: "left", x: 50, y: 150 }, { text: "right", x: 150, y: 150 }];
  mapPiece(p, (q) => V(q.x + 30, q.y - 10));
  assert.deepStrictEqual(p.notes, [{ text: "left", x: 80, y: 140 }, { text: "right", x: 180, y: 140 }]);
  mapPiece(p, (q) => V(q.x - 30, q.y + 10));
  // a linked copy shows them in its own place; they are the source's, not its own
  const m = mkLinked(p, "symmetric", affOf(G.reflector(V(300, 0), V(300, 300)))); S.pieces.push(m); sync();
  assert.deepStrictEqual(m.notes, [{ text: "left", x: 550, y: 150 }, { text: "right", x: 450, y: 150 }]);
  p.notes[0].text = "LEFT"; sync();
  assert.strictEqual(m.notes[0].text, "LEFT");
  // unfold keeps them (they are not mirrored: a note is not a shape)
  assert.deepStrictEqual(unfold(p, 3).notes, p.notes);
  // slash & spread: the note on the side that moves goes with it, the other stays
  addPoint(p, 2, 0.5); addPoint(p, 0, 0.5);
  const top = p.pts.findIndex(q => dist(q, V(100, 0)) < 1e-9), bot = p.pts.findIndex(q => dist(q, V(100, 300)) < 1e-9);
  const r = slashSpread(p, top, bot, 40, 0, []);
  assert.deepStrictEqual(p.notes[0], { text: "LEFT", x: 50, y: 150 }, "on the grainline side: not moved");
  samePt(p.notes[1], r.T(V(150, 150)), "on the moving side");
  // files: older ones have none; broken ones are dropped on load; a broken one that got through is caught
  const old = JSON.parse(JSON.stringify(p)); delete old.notes;
  S.pieces = []; loadDoc({ v: 7, nextId: 2, nextSegId: 50, pieces: [old], seams: [] });
  assert.deepStrictEqual(S.pieces[0].notes, []);
  old.notes = [{ text: "ok", x: 1, y: 2, extra: 1 }, { text: 5, x: 1, y: 2 }, { text: "no place" }, null];
  S.pieces = []; loadDoc({ v: 8, nextId: 2, nextSegId: 50, pieces: [old], seams: [] });
  assert.deepStrictEqual(S.pieces[0].notes, [{ text: "ok", x: 1, y: 2 }]);
  checkDoc(S.pieces, S.seams);
  S.pieces[0].notes.push({ text: "bad", x: NaN, y: 0 });
  assert.throws(() => checkDoc(S.pieces, S.seams), /annotation/);
});

module.exports = T;
