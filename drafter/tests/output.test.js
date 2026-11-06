// Phase 11: print layout (paper, tiling, shrink to fit, layers) and DXF-AAMA / ASTM
// export and import, including a round trip through the file format.
"use strict";
const { oldSizeRun } = require("./harness");      // (Round r33 / 4) the size run every document had before r33: a document starts with none since (harness.js)
const assert = require("assert");
const { load } = require("./harness");

const store = new Map();
const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); } };
const S = { pieces: [], seams: [], guides: [], measures: [], grading: null, print: null, notch: null, sel: [], unit: "mm", nextSegId: 1, nextShapeId: 1, nextId: 1 };
const G = load([
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "flattenSA", "signedArea", "lineX", "inside", "reflectAcross", "reflector", "bboxOf",
  "CORNERS", "cornerPts", "setCorner", "cutLine", "hasSA",
  "affOf", "affApply", "affMul", "mapPiece", "byId", "selPieces", "stack", "sync", "syncHalf", "unfold", "chainIdx",
  "newSegId", "segIx", "newShapeId", "ensureShapeIds", "addChild", "setCurve", "mkShape", "ellipseShape", "rectShape", "mkPiece",
  "splitBez", "addPoint", "dartsOn", "seamParts", "partCover", "splitParts", "seamSidesOn", "dartGeom", "addDartTo", "cross", "dot", "locateOn",
  "NOTCH_DEFAULT", "normNotch", "notchMarks", "mkAnchor", "anchorAt", "measureInfo",
  "GRADE_COLS", "defaultGrading", "gSize", "gGroup", "gTable", "isGraded", "ensureGrade", "ptKey", "mapDelta", "entryMap", "shapeDeltas", "gradedPiece", "ptDelta", "setPtDelta",
  "setGradePoint", "turnGrade", "mirrorGrade", "gradeProportional",
  "FOLD_DASH", "fmt",
  "PAPERS", "PRINT_LINES", "PRINT_INFO", "PRINT_DASH", "PRINT_KEY", "printDefault", "normPrint", "loadPrint", "savePrint", "shrunkPiece", "outBounds", "printPlan", "usedTiles",
  "printPieces", "printInner", "printHTML", "printJob",
  "dxfNum", "DXF_TOL", "flatBez", "shapeVerts", "dxfExport", "dxfParse", "fitCubic", "polyToShape", "dxfImport",
], { S, localStorage, esc: (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) });
const { V, dist, segLen, segPt, bboxOf, cutLine, mapPiece, unfold, addChild, setCurve, mkShape, rectShape, mkPiece, addDartTo, defaultGrading, gradeProportional, NOTCH_DEFAULT,
  PAPERS, printDefault, normPrint, loadPrint, savePrint, shrunkPiece, outBounds, printPlan, usedTiles, printInner, printHTML, printJob,
  flatBez, shapeVerts, dxfExport, dxfParse, fitCubic, dxfImport, locateOn } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg, tol = 1e-9) => { near(p.x, q.x, tol, (msg || "") + " x"); near(p.y, q.y, tol, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() {
  S.pieces = []; S.seams = []; S.measures = []; S.sel = []; S.unit = "mm"; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1;
  S.grading = oldSizeRun(); S.print = printDefault(); S.notch = { ...NOTCH_DEFAULT, dup: false }; store.clear();
}
const count = (text, re) => (text.match(re) || []).length;
// a bodice with curves, allowance, a notch, a grainline, an internal line, a note
function bodice() {
  const p = mkPiece("Front bodice", mkShape([V(0, 0), V(68, 12), V(188, 42), V(150, 220), V(168, 480), V(0, 495)], true));
  setCurve(p, 0, true); p.segs[0].c1 = V(6, 30); p.segs[0].c2 = V(40, 26);
  setCurve(p, 2, true); p.segs[2].c1 = V(196, 120); p.segs[2].c2 = V(186, 190);
  setCurve(p, 4, true); p.segs[4].c1 = V(120, 492); p.segs[4].c2 = V(60, 500);
  p.segs.forEach((x, i) => { x.sa = i === 5 ? 0 : 10; });
  p.segs[3].notches = [0.45]; p.segs[1].notches = [0.5];
  p.grain = { a: V(60, 120), b: V(60, 400) };
  addChild(p, "internals", mkShape([V(30, 300), V(120, 320)], false));
  addChild(p, "bases", mkShape([V(20, 200), V(140, 200)], false));
  p.notes = [{ text: "cut 1 on fold", x: 80, y: 250 }]; p.quantity = 2; p.category = "Body";
  S.pieces.push(p);
  return p;
}
// how far q is from a piece's true outline
const off = (p, q) => locateOn(p, q).d;

/* ---- print ---- */

test("paper: the presets, and settings kept per browser with junk falling back to defaults", () => {
  reset();
  assert.deepStrictEqual(PAPERS.map(p => p[0]), ["a4", "a3", "b5", "b4", "letter", "legal", "tabloid", "roll24", "roll36", "roll44", "rollc", "full", "custom"]);      // (rollc since the r19 follow-up, H25: a roll of a width typed)
  assert.deepStrictEqual(PAPERS.filter(p => /^roll[0-9]/.test(p[0])).map(p => +(p[2]/25.4).toFixed(3)), [24, 36, 44], "roll widths in inches");      // (the numbered rolls: rollc, since the r19 follow-up, takes its width from the layout)
  assert.deepStrictEqual(loadPrint(), printDefault());
  S.print.paper = "a3"; S.print.lines.sa.color = "#ff0000"; S.print.lines.baseline.show = false; S.print.info.length = true; savePrint();
  const back = loadPrint();
  assert.strictEqual(back.paper, "a3"); assert.strictEqual(back.lines.sa.color, "#ff0000"); assert.strictEqual(back.lines.baseline.show, false); assert.strictEqual(back.info.length, true);
  assert.deepStrictEqual(normPrint({ paper: "a9", orient: 3, margin: "x", overlap: 999, lines: { outline: { color: "red", dash: "wavy", show: "no" } }, info: { name: 0 } }),
    { ...printDefault(), overlap: 50 }, "unknown values are ignored, numbers are kept in range");
  store.set("pdraft:print", "{{{"); assert.deepStrictEqual(loadPrint(), printDefault());
});

test("actual size on A4: enough overlapping sheets to cover the drawing, at scale 1", () => {
  const b = { x0: -50, y0: 20, x1: 350, y1: 520 }, st = { ...printDefault(), paper: "a4", margin: 10, overlap: 10 };       // 400 × 500
  const pl = printPlan(b, st);
  assert.deepStrictEqual([pl.pw, pl.ph, pl.iw, pl.ih, pl.scale], [210, 297, 190, 277, 1]);
  assert.deepStrictEqual([pl.cols, pl.rows, pl.tiles.length], [3, 2, 6], "190 + 180 + 180 covers 400; 277 + 267 covers 500");
  assert.deepStrictEqual(pl.tiles.map(t => [t.col, t.row, t.x, t.y]), [[0, 0, -50, 20], [1, 0, 130, 20], [2, 0, 310, 20], [0, 1, -50, 287], [1, 1, 130, 287], [2, 1, 310, 287]]);
  const last = pl.tiles[5];
  assert.ok(last.x + last.w >= b.x1 && last.y + last.h >= b.y1, "the last sheet reaches the far corner");
  near(pl.tiles[0].x + pl.tiles[0].w - pl.tiles[1].x, 10, 1e-9, "neighbours share the overlap");
  // landscape swaps the sheet; a drawing that fits needs one
  const land = printPlan(b, { ...st, orient: "landscape" });
  assert.deepStrictEqual([land.pw, land.ph, land.cols, land.rows], [297, 210, 2, 3]);
  assert.deepStrictEqual([printPlan({ x0: 0, y0: 0, x1: 150, y1: 200 }, st).cols, printPlan({ x0: 0, y0: 0, x1: 190, y1: 277 }, st).tiles.length], [1, 1]);
  // no overlap: plain division
  assert.deepStrictEqual([printPlan(b, { ...st, overlap: 0 }).cols, printPlan(b, { ...st, overlap: 0 }).rows], [3, 2]);
  assert.strictEqual(printPlan(b, { ...st, margin: 105 }), null, "margins that leave no room");
});

test("shrink to fit, rolls, one big sheet and custom paper", () => {
  const b = { x0: 0, y0: 0, x1: 400, y1: 500 }, st = printDefault();
  const fit = printPlan(b, { ...st, mode: "fit" });
  assert.strictEqual(fit.tiles.length, 1); near(fit.scale, Math.min(190/400, 277/500), 1e-12);
  assert.ok(400*fit.scale <= 190 + 1e-9 && 500*fit.scale <= 277 + 1e-9, "it fits the printable area");
  assert.strictEqual(printPlan({ x0: 0, y0: 0, x1: 100, y1: 100 }, { ...st, mode: "fit" }).scale, 1, "never enlarged");
  // a 24 in roll: as long as the drawing, tiled only across its width
  const roll = printPlan({ x0: 0, y0: 0, x1: 500, y1: 2000 }, { ...st, paper: "roll24" });
  assert.deepStrictEqual([roll.pw, roll.ph, roll.cols, roll.rows], [609.6, 2020, 1, 1]);
  const wide = printPlan({ x0: 0, y0: 0, x1: 1500, y1: 800 }, { ...st, paper: "roll24" });
  assert.deepStrictEqual([wide.cols, wide.rows, wide.ph], [3, 1, 820], "wider than the roll: strips side by side");
  assert.deepStrictEqual([printPlan(b, { ...st, paper: "roll36", orient: "landscape" }).pw], [914.4], "a roll has no orientation");
  const rollFit = printPlan({ x0: 0, y0: 0, x1: 1179.2, y1: 800 }, { ...st, paper: "roll24", mode: "fit" });
  near(rollFit.scale, 0.5, 1e-9); near(rollFit.ph, 420, 1e-9);
  const full = printPlan(b, { ...st, paper: "full" });
  assert.deepStrictEqual([full.pw, full.ph, full.tiles.length, full.scale], [420, 520, 1, 1]);
  const cust = printPlan(b, { ...st, paper: "custom", customW: 320, customH: 280, margin: 10, overlap: 0 });
  assert.deepStrictEqual([cust.pw, cust.ph, cust.cols, cust.rows], [320, 280, 2, 2]);
});

test("blank sheets are found, shrinkage is applied, and bounds take in the cut line", () => {
  reset();
  const a = mkPiece("A", rectShape(0, 0, 100, 100)), b = mkPiece("B", rectShape(500, 500, 100, 100));
  a.segs.forEach(x => { x.sa = 10; });
  const bounds = outBounds([a, b]);
  assert.deepStrictEqual(bounds, { x0: -12, y0: -12, x1: 602, y1: 602 }, "allowance and a 2 mm rim");
  const pl = printPlan(bounds, printDefault());
  assert.strictEqual(pl.tiles.length, 12); assert.strictEqual(usedTiles(pl, [a, b]).length, 5, "one square is on one sheet, the other straddles four; seven are blank");
  // shrinkage: 104 % wide, 98 % high, about the middle
  a.shrink = { w: 104, h: 98 };
  const s2 = shrunkPiece(a), bb = bboxOf([s2]);
  near(bb.x1 - bb.x0, 104, 1e-9); near(bb.y1 - bb.y0, 98, 1e-9); near((bb.x0 + bb.x1)/2, 50, 1e-9);
  assert.strictEqual(bboxOf([a]).x1, 100, "the pattern itself is not changed"); assert.strictEqual(shrunkPiece(b), b, "100 % is left alone");
});

test("the drawing for print: one layer at a time, each with its colour and line style; hidden layers are not there", () => {
  reset();
  const p = bodice();
  addDartTo(p, 3, 0.7, 18, 60, true);
  p.bases.push({ ...mkShape([V(10, 10), V(40, 10)], false), id: 99, ref: true });
  const st = printDefault();
  st.lines.sa.color = "#aa0000"; st.lines.baseline.dash = "dotted"; st.info.length = true;
  const svg = printInner([p], st, "mm");
  const layer = (k) => count(svg, new RegExp('data-layer="' + k + '"', "g"));
  assert.deepStrictEqual(["outline", "sa", "internal", "baseline", "reference", "notch", "dart", "grainline", "name", "annotation", "length"].map(layer), [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 6]);
  assert.ok(/data-layer="sa"[^>]*stroke="#aa0000"/.test(svg)); assert.ok(/data-layer="baseline"[^>]*stroke-dasharray="0.5 1.5"/.test(svg));
  assert.ok(!/data-layer="outline"[^>]*stroke-dasharray/.test(svg), "solid has no dashes");
  assert.ok(/Front bodice  ×2/.test(svg), "the quantity is printed with the name");
  assert.ok(/ C /.test(svg), "curves are true curves, not polylines");
  for (const k of ["sa", "internal", "notch", "dart"]) st.lines[k].show = false;
  st.info.name = false; st.info.grainline = false; st.info.length = false;
  const less = printInner([p], st, "mm");
  assert.deepStrictEqual(["outline", "sa", "internal", "notch", "dart", "grainline", "name", "length", "baseline"].map(k => count(less, new RegExp('data-layer="' + k + '"', "g"))), [1, 0, 0, 0, 0, 0, 0, 0, 1]);
});

test("the print file: one page per sheet at the paper's size, each showing its own part, with labels and a scale check", () => {
  reset();
  bodice();
  S.print = { ...printDefault(), paper: "a4" };
  const job = printJob();
  assert.deepStrictEqual([job.plan.cols, job.plan.rows], [2, 3], "the bodice with its allowance (and the spike at the neck point) is 2 sheets wide and 3 tall");
  assert.strictEqual(count(job.html, /<svg /g), job.tiles.length);
  assert.ok(/@page \{ size: 210mm 297mm; margin: 0 \}/.test(job.html));
  assert.strictEqual(count(job.html, /<g id="pat">/g), 1, "the drawing is in the file once"); assert.strictEqual(count(job.html, /<use href="#pat"/g), job.tiles.length);
  assert.deepStrictEqual(job.html.match(/data-tile="[A-Z]\d"/g), job.tiles.map(t => 'data-tile="' + "ABC"[t.row] + (t.col + 1) + '"'), "labelled by row letter and column number");
  assert.ok(job.tiles.length >= 5 && job.tiles.length <= 6); assert.ok(/A1 · 1 of 6/.test(job.html)); assert.ok(/50 mm — check with a ruler/.test(job.html)); assert.strictEqual(count(job.html, /h 50 m 0 -2/g), 1, "the scale check is on the first sheet only");
  const t = job.plan.tiles[1];
  assert.ok(job.html.includes("translate(10 10) scale(1) translate(" + +(-t.x).toFixed(3) + " " + +(-t.y).toFixed(3) + ")"), "the second sheet is shifted by one sheet less the overlap");
  // shrink to fit: one page, the scale in the transform, no scale check line
  S.print.mode = "fit";
  const fit = printJob();
  assert.strictEqual(count(fit.html, /<svg /g), 1); assert.ok(fit.plan.scale < 1); assert.ok(fit.html.includes("scale(" + +fit.plan.scale.toFixed(3) + ")")); assert.ok(!/check with a ruler/.test(fit.html));
  // a picked size is what gets printed; selected only; nothing to print
  S.print.mode = "actual"; S.print.paper = "full";
  gradeProportional(S.grading, S.pieces[0], 40, 20); S.grading.active = 5;
  const big = printJob();
  near(big.plan.pw, printJobWidth() + 80, 4, "XL is two steps of 40 wider (the cut line's corners shift a little)");
  assert.ok(/Size XL/.test(big.html));
  S.print.selected = true; S.sel = [];
  assert.strictEqual(printJob(), null);
  function printJobWidth() { S.grading.active = null; const w = printJob().plan.pw; S.grading.active = 5; return w; }
});

/* ---- DXF ---- */

test("curve points for DXF: a polyline within 0.1 mm of the curve and fewer points than a fixed 26 per curve", () => {
  reset();
  const p = bodice();
  const a = p.pts[2], x = p.segs[2], b = p.pts[3], mid = flatBez(a, x.c1, x.c2, b, 0.1), poly = [a, ...mid, b];
  assert.ok(mid.length >= 3 && mid.length < 25, mid.length + " points"); assert.strictEqual(G.DXF_TOL, 0.1);
  for (let k = 0; k <= 200; k++) {
    const q = G.bez(a, x.c1, x.c2, b, k/200);
    let d = Infinity;
    for (let i = 0; i < poly.length - 1; i++) { const u = poly[i], w = poly[i+1], r = G.sub(w, u), t = Math.min(1, Math.max(0, G.dot(G.sub(q, u), r)/(G.dot(r, r) || 1))); d = Math.min(d, dist(q, V(u.x + r.x*t, u.y + r.y*t))); }
    assert.ok(d < 0.1, "at " + k/200 + ": " + d);
  }
  for (const q of mid) near(off(p, q), 0, 1e-6, "every point is on the curve");
  const v = shapeVerts(p, true), fixed = shapeVerts(p, false);
  assert.strictEqual(v.filter(q => q.turn).length, 6, "six real points"); assert.strictEqual(fixed.length, 6 + 3*25);
  assert.ok(v.length <= fixed.length, v.length + " against " + fixed.length);
});

test("DXF-AAMA export: a block per pattern, parts on their layers, y upward, text records", () => {
  reset();
  const p = bodice();
  addDartTo(p, 3, 0.7, 18, 60, true);
  const text = dxfExport([p], { format: "aama", metric: true, sample: "M" }, S.grading), doc = dxfParse(text);
  assert.ok(/^0\nSECTION\n2\nHEADER/.test(text) && /0\nEOF\n$/.test(text));
  assert.deepStrictEqual(Object.keys(doc.blocks), ["Front_bodice_1"]); assert.deepStrictEqual(doc.inserts, [{ name: "Front_bodice_1", x: 0, y: 0 }]);
  assert.strictEqual(doc.units, "METRIC"); assert.strictEqual(doc.sample, "M");
  assert.ok(doc.top.some(e => e.text === "ANSI/AAMA"));
  const ents = doc.blocks.Front_bodice_1, on = (L, type) => ents.filter(e => String(e.layer) === String(L) && (!type || e.type === type));
  assert.strictEqual(on(1, "POLY").length, 1, "boundary = the cut line"); assert.strictEqual(on(14, "POLY").length, 1, "sew line");
  assert.ok(on(1)[0].closed && on(14)[0].closed);
  assert.strictEqual(on(2, "POINT").length, 6, "turn points"); assert.ok(on(3, "POINT").length > 6, "curve points");
  assert.strictEqual(on(4, "POINT").length, 2, "notches"); assert.strictEqual(on(7, "POLY").length, 1, "grain line");
  assert.strictEqual(on(8, "POLY").length, 3, "internal line, baseline, dart legs"); assert.strictEqual(on(13, "POINT").length, 1, "dart point as a drill hole");
  assert.deepStrictEqual(on(15, "TEXT").map(e => e.text), ["Piece Name: Front bodice", "Size: M", "Quantity: 2", "Category: Body", "Annotation: cut 1 on fold"]);
  // y is flipped: the hem (y = 495 on screen) is at the bottom in the file
  const ys = on(14)[0].pts.map(q => q.y);
  assert.ok(Math.min(...ys) < -495 && Math.min(...ys) > -498, "the hem curve dips just below −495: " + Math.min(...ys)); near(Math.max(...ys), 0, 1e-9);
  // since r16 the grainline is written bottom to top (grainUp(): DXF pattern files have it so), so it starts at b, the lower end
  samePt(on(7)[0].pts[0], V(60, -400)); samePt(on(7)[0].pts[1], V(60, -120));
  // every sew-line vertex is on the pattern outline
  for (const q of on(14)[0].pts) near(off(p, V(q.x, -q.y)), 0, 1e-3);
});

test("DXF export options: units, scale, rotate, straight, baselines, duplicate notches, ASTM, grading", () => {
  reset();
  const p = bodice();
  const parse = (o) => dxfParse(dxfExport([p], { format: "aama", metric: true, sample: "M", ...o }, S.grading)), ents = (d) => d.blocks[Object.keys(d.blocks)[0]];
  const L = (d, layer, type) => ents(d).filter(e => String(e.layer) === String(layer) && (!type || e.type === type));
  const inch = parse({ metric: false });
  assert.strictEqual(inch.units, "ENGLISH"); samePt(L(inch, 7)[0].pts[1], V(60/25.4, -120/25.4), "inches", 1e-3);          // (the line ends at the upper end since r16)
  samePt(L(parse({ scale: 2 }), 7)[0].pts[1], V(120, -240), "scale");
  samePt(L(parse({ rotate: 90 }), 7)[0].pts[1], V(-120, -60), "a quarter turn", 1e-3);
  const straight = parse({ toStraight: true });
  assert.strictEqual(L(straight, 3, "POINT").length, 0, "no curve points"); assert.ok(L(straight, 2, "POINT").length > 6, "every vertex is a turn point");
  assert.ok(L(parse({ optimise: false }), 3, "POINT").length === 75, "unoptimised: 25 per curve");
  assert.strictEqual(L(parse({ baselines: false }), 8, "POLY").length, 1, "without the baseline");
  assert.strictEqual(L(parse({ dupNotch: true }), 4, "POINT").length, 4, "notches again on the cut edge");
  assert.ok(parse({ format: "astm" }).top.some(e => /^ASTM\/D13/.test(e.text)));
  // grading: every size as a block of its own
  gradeProportional(S.grading, p, 20, 10);
  const graded = parse({ grading: true }), names = Object.keys(graded.blocks);
  assert.deepStrictEqual(names, ["Front_bodice_1", "Front_bodice_1_XS", "Front_bodice_1_S", "Front_bodice_1_L", "Front_bodice_1_XL"]);
  assert.ok(graded.blocks.Front_bodice_1_XL.some(e => e.text === "Size: XL")); assert.ok(graded.blocks.Front_bodice_1.some(e => e.text === "Size: M"));
  assert.strictEqual(Object.keys(parse({ grading: false }).blocks).length, 1, "without grading: the base size only");
});

test("a curve through curve points: fitted to within a few hundredths of a millimetre", () => {
  reset();
  const p = bodice();
  for (const i of [0, 2, 4]) {
    const a = p.pts[i], b = p.pts[(i + 1) % 6], x = p.segs[i], run = [a, ...flatBez(a, x.c1, x.c2, b, G.DXF_TOL), b], fit = fitCubic(run);
    assert.ok(fit.err < 0.1, "edge " + i + ": the points lie on the fitted curve (" + fit.err.toFixed(3) + ")");
    let worst = 0;
    for (let k = 0; k <= 50; k++) worst = Math.max(worst, off(p, G.bez(a, fit.c1, fit.c2, b, k/50)));
    assert.ok(worst < 0.25, "edge " + i + ": the fitted curve is within 0.25 mm of the original outline (" + worst.toFixed(3) + ")");
  }
});

test("DXF round trip: export, import, and the pattern is back — outline, curves, allowance, notches, grain, internal lines, text", () => {
  reset();
  const p = bodice(), text = dxfExport([p], { format: "aama", metric: true, sample: "M" }, S.grading);
  const res = dxfImport(text, { autoScale: true, scale: 1, angle: 0, annotations: true, internals: true, swap: false, notches: true, distribute: false, optimise: true, toSA: true });
  assert.strictEqual(res.pieces.length, 1); assert.strictEqual(res.skipped, 0);
  const q = res.pieces[0];
  assert.strictEqual(q.name, "Front bodice"); assert.strictEqual(q.quantity, 2); assert.strictEqual(q.category, "Body");
  assert.strictEqual(q.pts.length, 6, "six points again, not a polyline of dozens");
  q.pts.forEach((r, i) => samePt(r, p.pts[i], "point " + i, 1e-3));
  assert.deepStrictEqual(q.segs.map(x => x.curved), [true, false, true, false, true, false]);
  for (let i = 0; i < 6; i++) { near(segLen(q, i), segLen(p, i), 0.3, "edge " + i + " length"); for (let k = 1; k < 10; k++) near(off(p, segPt(q, i, k/10)), 0, 0.3, "edge " + i + " shape"); }
  assert.deepStrictEqual(q.segs.map(x => x.sa), [10, 10, 10, 10, 10, 0], "seam allowance read from the gap between cut line and sew line");
  assert.deepStrictEqual(q.segs.map(x => x.notches.length), [0, 1, 0, 1, 0, 0]);
  samePt(segPt(q, 3, q.segs[3].notches[0]), segPt(p, 3, 0.45), "notch", 0.01);
  // the same line; since r16 it comes back with its ends the other way round (written bottom to top), which is the same grain
  samePt(q.grain.a, p.grain.b, "grain", 1e-3); samePt(q.grain.b, p.grain.a, "grain", 1e-3);
  assert.strictEqual(q.internals.length, 2, "the internal line and the baseline (DXF has one layer for both)");
  samePt(q.internals[0].pts[1], V(120, 320), "internal line", 1e-3);
  assert.deepStrictEqual(q.notes, [{ text: "cut 1 on fold", x: 80, y: 250 }]);
  near(Math.abs(G.signedArea(cutLine(q))), Math.abs(G.signedArea(cutLine(p))), 60, "the cut line encloses the same area");
});

test("DXF import options: inch files, scale and angle, swap, keep every point, leave things out, distribute, other sizes", () => {
  reset();
  const p = bodice(), r2 = mkPiece("Square", rectShape(400, 0, 100, 100)); S.pieces.push(r2);
  const base = { autoScale: true, scale: 1, angle: 0, annotations: true, internals: true, swap: false, notches: true, distribute: false, optimise: true, toSA: true };
  const inchFile = dxfExport([p, r2], { format: "aama", metric: false, sample: "M" }, S.grading);
  const fromInch = dxfImport(inchFile, base).pieces;
  assert.strictEqual(fromInch.length, 2); fromInch[0].pts.forEach((q, i) => samePt(q, p.pts[i], "inch file back to mm, point " + i, 0.01));
  samePt(fromInch[1].pts[2], V(500, 100), "second pattern in its place", 0.01);
  near(dxfImport(inchFile, { ...base, autoScale: false }).pieces[0].pts[4].x, 168/25.4, 1e-3, "auto scale off: the numbers as they are");
  const mm = dxfExport([p, r2], { format: "aama", metric: true, sample: "M" }, S.grading);
  samePt(dxfImport(mm, { ...base, scale: 2 }).pieces[1].pts[2], V(1000, 200), "scale", 1e-3);
  samePt(dxfImport(mm, { ...base, angle: 90 }).pieces[1].pts[2], V(-100, 500), "angle", 1e-3);
  // swap: the cut line becomes the outline, so the piece is bigger and has no allowance
  const sw = dxfImport(mm, { ...base, swap: true }).pieces[0];
  assert.ok(Math.abs(G.signedArea(flattenOf(sw))) > Math.abs(G.signedArea(flattenOf(p))) + 5000); assert.ok(sw.segs.every(x => !x.sa));
  // keep every point; no seam allowance; nothing extra
  const all = dxfImport(mm, { ...base, optimise: false }).pieces[0];
  assert.ok(all.pts.length > 20 && all.segs.every(x => !x.curved), all.pts.length + " points, all straight");
  for (const q of all.pts) near(off(p, q), 0, 1e-3, "each on the original outline");
  assert.ok(dxfImport(mm, { ...base, toSA: false }).pieces[0].segs.every(x => x.sa === 0));
  const bare = dxfImport(mm, { ...base, notches: false, internals: false, annotations: false }).pieces[0];
  assert.deepStrictEqual([bare.internals.length, bare.notes.length, bare.segs.reduce((k, x) => k + x.notches.length, 0)], [0, 0, 0]);
  // distribute: side by side from the origin, not overlapping
  const row = dxfImport(mm, { ...base, distribute: true }).pieces, b0 = outBounds([row[0]]), b1 = outBounds([row[1]]);
  near(b0.x0, 0, 1e-6); near(b0.y0, 0, 1e-6); near(b1.x0, b0.x1 + 30, 1e-6);
  // a graded file: the other sizes are left out
  gradeProportional(S.grading, p, 20, 10);
  const graded = dxfImport(dxfExport([p], { format: "aama", metric: true, sample: "M", grading: true }, S.grading), base);
  assert.strictEqual(graded.pieces.length, 1); assert.strictEqual(graded.skipped, 4);
  function flattenOf(x) { return G.flatten(x, 20); }
});

test("DXF import of other programs' files: plain polylines, LWPOLYLINE, lines, and files with nothing in them", () => {
  reset();
  const base = { autoScale: true, scale: 1, angle: 0, annotations: true, internals: true, swap: false, notches: true, distribute: false, optimise: true, toSA: true };
  const lw = ["0", "SECTION", "2", "ENTITIES", "0", "LWPOLYLINE", "8", "0", "90", "4", "70", "1", "10", "0", "20", "0", "10", "100", "20", "0", "10", "100", "20", "50", "10", "0", "20", "50", "0", "ENDSEC", "0", "EOF"].join("\r\n");
  const one = dxfImport(lw, base);
  assert.strictEqual(one.pieces.length, 1, "a closed polyline on any layer, outside any block");
  assert.deepStrictEqual(one.pieces[0].pts, [V(0, -0), V(100, -0), V(100, -50), V(0, -50)].map(q => V(q.x, q.y === 0 ? 0 : q.y)));
  assert.strictEqual(one.pieces[0].name, "Imported");
  const empty = dxfImport("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n", base);
  assert.deepStrictEqual([empty.pieces.length, empty.note], [0, "No pattern outline was found in that file"]);
  assert.strictEqual(dxfImport("this is not a dxf file at all", base).pieces.length, 0);
  assert.strictEqual(dxfImport("", base).pieces.length, 0);
  const doc = dxfParse("  0\nSECTION\n  2\nBLOCKS\n  0\nBLOCK\n  2\nP1\n  0\nLINE\n  8\n7\n 10\n1.5\n 20\n2\n 11\n3\n 21\n4\n  0\nENDBLK\n  0\nENDSEC\n  0\nEOF\n");
  assert.deepStrictEqual(doc.blocks.P1, [{ type: "POLY", layer: "7", closed: false, pts: [V(1.5, 2), V(3, 4)] }], "padded group codes, as other programs write them");
});

module.exports = T;
