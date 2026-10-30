// Phase 9: the parametric block framework and its one example, the straight skirt.
// The skirt arrives sewn, so "every seam's difference is zero" is a direct check that
// the draft met its specs.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], guides: [], measures: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null };
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", 
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "signedArea", "lineX", "inside", "reflectAcross", "reflector",
  "affOf", "affApply", "affMul", "mapPiece", "byId", "sync", "mkLinked", "syncHalf", "unfold", "chainIdx", "bboxOf",
  "newSegId", "segIx", "ensureSegIds", "newShapeId", "ensureShapeIds", "addChild",
  "setCurve", "mkShape", "rectShape", "mkPiece",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "dartGeom", "addDartTo",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "seamEnds", "validSeams", "makeSeam", "resolveRefs",
  "cross", "dot", "bisect",
  "BLOCKS", "SPEC_TYPES", "blockInputs", "measureSpec", "buildBlock", "addBlock", "regenBlock", "SKIRT_SHAPE", "draftSkirtHalf", "SKIRT_BLOCK",
], { S });
const { V, dist, segLen, bboxOf, sync, mkShape, mkPiece, addDartTo, setCurve, seamInfo, resolveRefs, dartGeom,
  blockInputs, measureSpec, buildBlock, addBlock, regenBlock, draftSkirtHalf, SKIRT_BLOCK, BLOCKS } = G;
BLOCKS.skirt = SKIRT_BLOCK;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; }
const settle = () => { sync(); S.seams = resolveRefs(S.pieces, S.seams); };
const val = (built, key) => built.report.find(x => x.key === key);
// put a build into the document and return every seam's difference
function seamDiffs(built) {
  reset(); S.pieces = built.pieces; S.seams = built.seams; settle();
  assert.strictEqual(S.seams.length, built.seams.length, "every seam resolves");
  return S.seams.map(sm => seamInfo(sm, S.pieces).diff);
}

/* ---- the framework ---- */

test("spec types measure what they say: straight, across, drop, along the edge, and sewn length with darts off", () => {
  reset();
  const p = mkPiece("P", mkShape([V(0, 0), V(30, 40), V(30, 100), V(0, 100)], true));
  const d = { piece: p, kp: { A: 0, B: 1, C: 2, D: 3 } }, sp = (type, from, to, extra) => ({ type, from, to, ...extra });
  near(measureSpec(sp("straight", "A", "B"), d), 50, 1e-12); near(measureSpec(sp("across", "A", "B"), d), 30, 1e-12); near(measureSpec(sp("drop", "A", "B"), d), 40, 1e-12);
  near(measureSpec(sp("across", "B", "A"), d), 30, 1e-12, "order doesn't matter for a distance");
  near(measureSpec(sp("curve", "A", "C"), d), 110, 1e-12, "two edges"); near(measureSpec(sp("curve", "C", "A"), d), 130, 1e-12, "the other way round the outline");
  near(measureSpec(sp("curve", "A", "A"), d), 0, 1e-12);
  setCurve(p, 1, true); p.segs[1].c1 = V(60, 60); p.segs[1].c2 = V(60, 80);
  near(measureSpec(sp("curve", "B", "C"), d), segLen(p, 1), 1e-12, "a curved edge by its own length"); assert.ok(segLen(p, 1) > 60);
  addDartTo(p, 0, 0.5, 12, 30);
  near(measureSpec(sp("curve", "A", "B"), d), 50, 1e-12, "as drawn"); near(measureSpec(sp("curve", "A", "B", { sewn: true }), d), 38, 1e-12, "as sewn");
  assert.strictEqual(measureSpec({ type: "count" }, d), null, "a count is not a distance");
});

test("levels: Simple asks for few specs, General for all; results are never asked for", () => {
  const simple = blockInputs(SKIRT_BLOCK, "simple").map(s => s.key), general = blockInputs(SKIRT_BLOCK, "general").map(s => s.key);
  assert.deepStrictEqual(simple, ["f.waistline", "f.hipWidth", "f.length", "b.waistline", "b.hipWidth", "ease.waist", "ease.hip"], "the two eases next to the measurements they are added to");
  assert.strictEqual(general.length, 22); assert.ok(simple.every(k => general.includes(k)));
  for (const k of ["f.sideSeam", "b.sideRise", "w.width"]) assert.ok(!general.includes(k), k + " is a result");
  for (const sp of SKIRT_BLOCK.specs) {
    assert.ok(["straight", "curve", "across", "drop", "count"].includes(sp.type), sp.key + " has a known type");
    assert.ok(sp.out || sp.level === "simple" || sp.level === "general", sp.key + " has a level");
    assert.ok(sp.out || Number.isFinite(sp.value) || typeof sp.derive === "function", sp.key + " has a value or a rule");
    assert.ok(SKIRT_BLOCK.parts.some(p => p.key === sp.piece), sp.key + " belongs to a part");
  }
});

test("a spec that is not asked for is derived or defaulted; one typed at General overrides the rule", () => {
  reset();
  const s1 = buildBlock(SKIRT_BLOCK, "simple", { "f.length": 650, "f.hipWidth": 255, "f.hem": 999, "b.length": 111 }).values;
  assert.strictEqual(s1["f.length"], 650); assert.strictEqual(s1["b.length"], 650, "back length follows the front");
  assert.strictEqual(s1["f.hem"], 255 + 40/4, "Simple ignores a General value: the hem follows the hip as it is drafted, with its quarter of the hip ease");
  const g = buildBlock(SKIRT_BLOCK, "general", { "f.length": 650, "f.hem": 230, "b.length": 640, "f.darts": 2.4 }).values;
  assert.strictEqual(g["f.hem"], 230); assert.strictEqual(g["b.length"], 640); assert.strictEqual(g["f.darts"], 2, "a count is a whole number");
  assert.strictEqual(buildBlock(SKIRT_BLOCK, "simple", { "f.length": NaN }).values["f.length"], 707, "junk falls back to the default");
});

/* ---- the skirt ---- */

test("the skirt with its default values: four pieces, eight seams, every measurement met and every seam matching", () => {
  reset();
  const built = buildBlock(SKIRT_BLOCK, "simple", {});
  assert.deepStrictEqual(built.pieces.map(p => p.block.part), ["f", "b", "bl", "w"]);
  assert.deepStrictEqual(built.report.filter(x => !x.ok), [], "every spec met");
  for (const x of built.report) near(x.got, x.want, 0.05, x.name);
  const [Fr, B, BL, W] = built.pieces;
  assert.ok(Fr.half, "the front is a live symmetric unfold"); assert.strictEqual(Fr.pts.length, 8);
  assert.deepStrictEqual([BL.link.of, BL.link.kind], [B.id, "symmetric"], "the left back is a linked mirror of the right");
  assert.strictEqual(Fr.darts.length, 2, "one dart per front half"); assert.strictEqual(B.darts.length, 1);
  const diffs = seamDiffs(built);
  assert.strictEqual(diffs.length, 8);      // (Round r17a / 4: one seam more, the waistband closed at the centre back)
  diffs.forEach((d, k) => near(d, 0, 0.02, "seam " + (k + 1) + " difference"));
  // nothing overlaps: front in the middle, backs either side, waistband above
  const bb = S.pieces.map(p => bboxOf([p]));
  assert.ok(bb[2].x1 < bb[0].x0 && bb[0].x1 < bb[1].x0, "left back | front | right back");
  assert.ok(bb[3].y1 < Math.min(bb[0].y0, bb[1].y0), "waistband above");
  near(bb[3].x1 - bb[3].x0, 777 + 20 + 30, 1e-9, "waistband = the whole waist + the waist ease + the extension");
  assert.deepStrictEqual([built.values["ease.waist"], built.values["ease.hip"]], [20, 40], "the default ease");
  // the default skirt is the preset avatar's: waist 777, hip 965, 707 to the knee, the hip 244 under the waist (Marty, as his body mesh measures)
  const v = built.values;
  near(2*(v["f.waistline"] + v["b.waistline"]), 777, 1e-9, "waist"); near(2*(v["f.hipWidth"] + v["b.hipWidth"]), 965, 1e-9, "hip");
  assert.deepStrictEqual([v["f.waistline"], v["b.waistline"], v["f.hipWidth"], v["b.hipWidth"], v["f.length"], v["f.hipHeight"], v["b.hipHeight"]], [199.5, 189, 239, 243.5, 707, 244, 244]);
});

test("ease: the measurements stay the body's, the skirt is drafted with the waist ease and the hip ease added round the whole waist and hip, a quarter on each half panel; none gives the bare skirt; a block from before has none", () => {
  reset();
  const width = (p) => { const b = bboxOf([p]); return b.x1 - b.x0; };
  const sizes = (given) => {
    const b = buildBlock(SKIRT_BLOCK, "simple", given), [Fr, B, BL, W] = b.pieces;
    assert.deepStrictEqual(b.report.filter(x => !x.ok), [], "every measurement met: " + JSON.stringify(given));
    seamDiffs(b).forEach((d, k) => near(d, 0, 0.02, JSON.stringify(given) + ": seam " + (k + 1)));
    return { waist: 2*(val(b, "f.waistline").got + val(b, "b.waistline").got), hip: width(Fr) + 2*width(B), band: width(W), v: b.values, d: b.drafted };
  };
  const bare = sizes({ "ease.waist": 0, "ease.hip": 0 }), def = sizes({}), more = sizes({ "ease.waist": 36, "ease.hip": 10 });
  near(bare.waist, 777, 0.05, "no ease: the body's waist"); near(bare.hip, 965, 0.05, "and hip"); near(bare.band, 777 + 30, 1e-9);
  near(def.waist, 777 + 20, 0.05, "the default: 20 mm more waist"); near(def.hip, 965 + 40, 0.05, "and 40 mm more hip"); near(def.band, 777 + 20 + 30, 1e-9, "the waistband is as long as the eased waist");
  near(more.waist, 777 + 36, 0.05); near(more.hip, 965 + 10, 0.05);
  // the dialog's measurements are not changed by the ease: what is drafted is
  assert.deepStrictEqual([def.v["f.waistline"], def.v["b.waistline"], def.v["f.hipWidth"], def.v["b.hipWidth"]], [199.5, 189, 239, 243.5]);
  assert.deepStrictEqual([def.d["f.waistline"], def.d["b.waistline"], def.d["f.hipWidth"], def.d["b.hipWidth"]], [204.5, 194, 249, 253.5], "a quarter of each ease on every half panel");
  // a hip height that was given counts at the Simple level too (it is filled from the avatar, and its field is only shown at General)
  assert.strictEqual(buildBlock(SKIRT_BLOCK, "simple", { "f.hipHeight": 284 }).values["f.hipHeight"], 284);
  assert.strictEqual(buildBlock(SKIRT_BLOCK, "simple", { "f.sideRise": 30 }).values["f.sideRise"], 12, "any other General value is still left alone at Simple");
});

test("darts are tied to the waistline: more darts, or wider ones, lengthen the edge and leave the sewn waist alone", () => {
  reset();
  for (const [count, width] of [[0, 20], [1, 20], [2, 20], [2, 35], [1, 8]]) {
    const built = buildBlock(SKIRT_BLOCK, "general", { "f.darts": count, "f.dartWidth": width, "b.darts": count });
    const Fr = built.pieces[0];
    near(val(built, "f.waistline").got, 199.5 + 5, 0.02, count + " × " + width + ": sewn waistline (with its quarter of the waist ease)");
    near(segLen(Fr, 0), 199.5 + 5 + count*width, 0.02, count + " × " + width + ": the edge as drawn");
    assert.strictEqual(Fr.darts.length, 2*count, "darts on both halves");
    seamDiffs(built).forEach((d, k) => near(d, 0, 0.02, count + " × " + width + ": seam " + (k + 1)));
  }
  // dart places and depth
  const two = buildBlock(SKIRT_BLOCK, "general", { "f.darts": 2, "f.dartLength": 75 }).pieces[0];
  assert.deepStrictEqual(two.darts.slice(0, 2).map(d => [+d.t.toFixed(4), d.depth, d.folded]), [[0.3333, 75, true], [0.6667, 75, true]]);
  assert.ok(two.darts.every(d => { const g = dartGeom(two, d); return g && g.apex.y > 0; }), "darts point down into the skirt");
});

test("the back side seam is drafted to the front one (a spec measured along a curve drives the shape)", () => {
  reset();
  for (const given of [{}, { "f.sideRise": 25 }, { "f.hipWidth": 300, "b.hipWidth": 230, "f.waistline": 150 }, { "f.hipHeight": 240, "f.length": 420, "b.darts": 2 }]) {
    const built = buildBlock(SKIRT_BLOCK, "general", given);
    near(val(built, "b.sideSeam").got, val(built, "f.sideSeam").got, 0.02, JSON.stringify(given));
    assert.ok(val(built, "b.sideRise").got >= 0);
    assert.deepStrictEqual(built.report.filter(x => !x.ok), [], JSON.stringify(given));
  }
  // typed at General, it is met on its own account
  const own = buildBlock(SKIRT_BLOCK, "general", { "b.sideSeam": 730 });
  near(val(own, "b.sideSeam").got, 730, 0.02); assert.ok(val(own, "b.sideSeam").ok);
  assert.ok(Math.abs(seamDiffs(own)[0]) > 1, "and the side seams then really do differ, which the seam shows");
  // a length that cannot be reached is reported, not hidden
  const bad = buildBlock(SKIRT_BLOCK, "general", { "b.sideSeam": 2000 });
  assert.deepStrictEqual(bad.report.filter(x => !x.ok).map(x => x.key), ["b.sideSeam"]);
  assert.ok(bad.pieces.every(p => p.pts.every(q => Number.isFinite(q.x) && Number.isFinite(q.y))), "still a drawable skirt");
});

test("across the range of values the draft meets every spec and every seam matches", () => {
  let seed = 4242;
  const rnd = (lo, hi) => { seed = (seed*1103515245 + 12345) % 2147483648; return lo + (hi - lo)*seed/2147483648; };
  for (let k = 0; k < 40; k++) {
    reset();
    const fw = rnd(140, 240), bw = rnd(140, 240);
    const given = { "f.waistline": fw, "b.waistline": bw, "f.hipWidth": fw + rnd(20, 90), "b.hipWidth": bw + rnd(20, 90), "f.length": rnd(380, 900),
      "f.hipHeight": rnd(160, 250), "f.sideRise": rnd(0, 25), "f.darts": Math.floor(rnd(0, 3)), "b.darts": Math.floor(rnd(0, 3)),
      "f.dartWidth": rnd(10, 30), "b.dartWidth": rnd(10, 35), "w.height": rnd(20, 60), "w.extension": k % 4 ? rnd(10, 50) : 0 };
    const built = buildBlock(SKIRT_BLOCK, "general", given);
    assert.deepStrictEqual(built.report.filter(x => !x.ok).map(x => x.key + " " + x.want + " " + x.got), [], "run " + k + ": " + JSON.stringify(given));
    seamDiffs(built).forEach((d, j) => near(d, 0, 0.03, "run " + k + " seam " + (j + 1)));
    const W = S.pieces[3];
    assert.strictEqual(W.pts.length, given["w.extension"] ? 8 : 7, "no zero-length stretch when there is no extension");
  }
});

test("the half panel on its own: keypoints, the level hip, the shape values in one place", () => {
  reset();
  const d = draftSkirtHalf({ name: "H", waistline: 195, hipWidth: 239.5, hipHeight: 210, length: 600, hem: 239.5, rise: 12, dartCount: 1, dartWidth: 20, dartLength: 90 });
  const p = d.piece, at = (k) => p.pts[d.kp[k]];
  assert.deepStrictEqual(d.kp, { A: 0, B: 1, C: 2, D: 3, E: 4 });
  assert.deepStrictEqual([at("A"), at("C"), at("D"), at("E")], [V(0, 0), V(239.5, 210), V(239.5, 600), V(0, 600)]);
  near(at("B").y, -12, 1e-12, "side waist 12 above the centre waist"); assert.ok(at("B").x > 150 && at("B").x < 239.5);
  near(G.segTan(p, 0, 0).y, 0, 1e-12, "the waist leaves the centre line square");
  near(G.segTan(p, 1, 1).x, 0, 1e-12, "the hip curve arrives upright at hip level");
  assert.ok(p.grain && p.grain.a.x === 119.75 && p.grain.b.x === 119.75, "grain down the middle");
  assert.deepStrictEqual(Object.keys(G.SKIRT_SHAPE), ["waistIn", "hipOut", "hipDown", "hipUp"]);
});

test("adding a block to a document, then redrafting it: same pieces in the same places, seams rebuilt, other patterns untouched", () => {
  reset();
  const other = mkPiece("Mine", G.rectShape(-900, 0, 100, 100)); S.pieces.push(other);
  S.seams.push(G.makeSeam([], { piece: other.id, sid: other.segs[0].id }, { piece: other.id, sid: other.segs[2].id }));
  const built = addBlock("skirt", "simple", { "f.length": 500 }, V(1000, 200)); settle();
  // Round F / 7: a block's darts are made into its outlines, each a pair of legs sewn to each other (a seam of its own)
  const legSeams = (p) => S.seams.filter(sm => sm.a[0].piece === p.id && sm.b[0].piece === p.id && sm.a.length === 1 && sm.b.length === 1).length;
  assert.strictEqual(S.pieces.length, 5); assert.strictEqual(S.seams.length, 9 + 4, "the block's seams, and its four darts' legs"); // (Round r17a / 4: one seam more, the waistband closed at the centre back)
  assert.deepStrictEqual(S.seams.map(sm => sm.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], "seam ids carry on from the document's");
  const mine = S.pieces.slice(1), key = mine[0].block.key;
  assert.ok(mine.every(p => p.block.key === key && p.block.type === "skirt" && p.block.level === "simple" && p.block.given["f.length"] === 500));
  near(mine[0].pts[0].x, 1000, 1e-9, "placed where asked"); near(mine[0].pts[0].y, 200, 1e-9);
  // the user moves the front, renames it and sets a property; then redrafts longer with two back darts
  G.mapPiece(mine[0], (q) => V(q.x + 77, q.y + 33)); mine[0].name = "My front"; mine[0].quantity = 2; settle();
  const ids = mine.map(p => p.id), corner = bboxOf([mine[0]]);
  const again = regenBlock(key, "general", { "f.length": 720, "b.darts": 2 }); settle();
  assert.deepStrictEqual(S.pieces.slice(1).map(p => p.id), ids, "the same pieces");
  assert.strictEqual(mine[0].name, "My front"); assert.strictEqual(mine[0].quantity, 2);
  const now = bboxOf([mine[0]]);
  near(now.x0, corner.x0, 1e-6, "front stays where it was put"); near(now.y0, corner.y0, 1e-6);
  near(now.y1 - now.y0, (corner.y1 - corner.y0) + 220, 0.01, "and is 220 longer");
  assert.strictEqual(legSeams(mine[1]), 2); assert.strictEqual(legSeams(mine[2]), 2, "the linked back follows");
  assert.ok(mine.every(p => !p.darts.length), "no dart objects: the darts are lines of the outline");
  assert.strictEqual(S.seams.length, 9 + 6);      // (Round r17a / 4: one seam more, the waistband closed at the centre back)
  assert.strictEqual(S.seams[0].a[0].piece, other.id, "the other pattern's seam is untouched");
  S.seams.slice(1).forEach(sm => near(seamInfo(sm, S.pieces).diff, 0, 0.03, "seam S" + sm.id));
  assert.deepStrictEqual(again.report.filter(x => !x.ok), []);
  assert.ok(mine.every(p => p.block.level === "general" && p.block.given["f.length"] === 720), "the new values are remembered");
  // a part that was deleted stays deleted; a block that is gone can't be redrafted
  S.pieces = S.pieces.filter(p => p.block ? p.block.part !== "w" : true); settle();
  regenBlock(key, "simple", {}); settle();
  assert.strictEqual(S.pieces.length, 4); assert.strictEqual(S.seams.length, 1 + 3 + 4, "only the seams between pieces that are there, and the darts' legs");
  assert.strictEqual(regenBlock("skirt#nope", "simple", {}), null);
});

/* The placeholder values are this project's own (Round r13 / 1: the test used to list the numbers they must not be, which
   put those numbers in a released file; it now says what they are instead). Every number the block starts from is one of
   ours: the four body measures are Marty's body-mesh tape (waist 777, hip 965, waist to hip 244, waist to knee 707), the
   waist and hip are shared out between front and back halves, and the rest are this block's own round numbers. A change
   to any of them has to be made here as well, on purpose. */
const OUR_SKIRT = { "f.waistline": 199.5, "b.waistline": 189, "f.hipWidth": 239, "b.hipWidth": 243.5, "f.length": 707, "f.hipHeight": 244,
  "f.sideRise": 12, "f.darts": 1, "f.dartWidth": 20, "f.dartLength": 90, "b.darts": 1, "b.dartWidth": 30, "b.dartLength": 130,
  "ease.waist": 20, "ease.hip": 40, "w.height": 30, "w.extension": 30 };
test("the placeholder values are this project's own: Marty's body measures and the block's own numbers", () => {
  const given = Object.fromEntries(SKIRT_BLOCK.specs.filter(sp => Number.isFinite(sp.value)).map(sp => [sp.key, sp.value]));
  assert.deepStrictEqual(given, OUR_SKIRT, "every number the block starts from is one of ours");
  // the halves add up to Marty's half waist and half hip
  near(given["f.waistline"] + given["b.waistline"], 777 / 2, 1e-9, "half waist");
  near(given["f.hipWidth"] + given["b.hipWidth"], 965 / 2, 1e-9, "half hip");
  // and what the draft is built from comes from those numbers alone: a value the dialog does not give is one of them, or
  // made from them (a back length, hem or side seam from the front's, the waistband from the waist and the ease)
  const v = buildBlock(SKIRT_BLOCK, "general", {}).values;
  for (const k of Object.keys(OUR_SKIRT)) if (k in v) near(v[k], OUR_SKIRT[k], 1e-9, k);
  assert.strictEqual(v["b.length"], v["f.length"], "the back is as long as the front");
  assert.strictEqual(v["b.hipHeight"], v["f.hipHeight"], "and has its hip at the same height");
});

module.exports = T;
