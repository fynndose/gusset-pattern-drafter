// Round r17a: the canvas's small labels (hover readouts in the selected line's style, each value once), the running sum of
// the selected lines, the sewing display (Show Sewing off at start, the selected seam's connectors and lengths, a seam across
// a dart's opening flagged), and the skirt block's waist sewn between its darts with its waistband closed at the centre back.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 60 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// two patterns: A (100..400 x 100..300) and B, a curve along its top (500..800); the view 1 : 1 at the origin. Every text drawn
// is recorded with its font, and every box (strokeRect) counted
const DOC = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  const A = app.mkPiece("A", app.mkShape([{x:100,y:100},{x:400,y:100},{x:400,y:300},{x:100,y:300}], true));
  const B = app.mkPiece("B", app.mkShape([{x:500,y:100},{x:800,y:100},{x:800,y:300},{x:500,y:300}], true));
  Object.assign(B.segs[0], { curved: true, c1: {x:600,y:40}, c2: {x:700,y:40} });
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const out = {}, cx = app.ev("ctx"), texts = [];
  let boxes = 0;
  cx.fillText = (t, x, y) => texts.push({ t, x, y, font: cx.font, col: cx.fillStyle });
  cx.strokeRect = () => { boxes++; };
  const drawn = () => { texts.length = 0; boxes = 0; app.draw(); return texts.slice(); };
  // what the pointer adds: the texts drawn now less those drawn with the pointer away from everything (the ruler, the names)
  const added = () => { const m = S.mouse, h = S.hover; S.hover = null; const base = drawn().map(x => x.t), b0 = boxes; S.mouse = m; S.hover = h; const now = drawn();
    for (const t of base) { const k = now.findIndex(x => x.t === t); if (k >= 0) now.splice(k, 1); } boxes -= b0; return now; };
`;

/* ---- Batch 1: hover labels ---- */
test("r17a / 1: Edit Pattern's hover readout is the length once and an angle at each end, plain small text with no box, off the line and its points", () => {
  const o = boot({ script: DOC + `
    app.setTool("edit_pattern");
    app.fire("pointermove", { x: 250, y: 100 });
    out.hover = [S.hover && S.hover.k, S.hover && S.hover.i];
    const t = added(); out.texts = t.map(x => x.t); out.fonts = [...new Set(t.map(x => x.font))]; out.boxes = boxes;
    out.labels = app.ev("segLabels")(A, A, 0, S.hover.t).map(l => [l.k, l.txt, Math.round(l.at.x), Math.round(l.at.y), l.col]);
    // the same line on the selected pattern, with Line Length on: its length is written already, beside its middle
    S.sel = [A.id]; app.ev("setView")("length", true);
    out.selLabels = app.ev("segLabels")(A, A, 0, S.hover.t).map(l => l.k);
    out.selTexts = drawn().map(x => x.t).filter(x => x === "300.0");
    // and with Angle on as well, the corner angles are written already too
    app.ev("setView")("angle", true); out.angLabels = app.ev("segLabels")(A, A, 0, S.hover.t).map(l => l.k); app.ev("setView")("angle", false);
    // zoomed far in: the middle of the line is out of the window, the length goes beside the place under the pointer
    S.sel = []; S.view = { s: 40, x: -100*40 + 30, y: -100*40 + 300 };
    const sx = app.toS({ x: 102, y: 100 }); app.fire("pointermove", { x: sx.x, y: sx.y });
    out.zoomHover = S.hover && S.hover.k;
    const zl = app.ev("segLabels")(A, A, 0, S.hover.t).find(l => l.k === "len"); out.zoom = [Math.round(zl.at.x), Math.round(zl.at.y)];
    return out;` }).result;
  assert.deepStrictEqual(o.hover, ["seg", 0]);
  assert.deepStrictEqual(o.texts.slice().sort(), ["300.0", "∠90.0°", "∠90.0°"].sort(), "three values, the length once: " + JSON.stringify(o.texts));
  assert.strictEqual(o.boxes, 0, "no boxes round them");
  // (Round r19 / H06, the housekeeping video: "ours are a little bit blurry") a proportional face, two pixels larger; it was
  // "9px ui-monospace, monospace", a size smaller than the 10 px they had before r17a. Still one face and size for them all
  assert.deepStrictEqual(o.fonts, ['11px "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif']);
  // the length beside the middle, outside the pattern (above its top edge), 11 px off the line; the angles inside the line from their ends
  assert.deepStrictEqual(o.labels[0].slice(0, 4), ["len", "300.0", 250, 89]);
  for (const l of o.labels.slice(1)) {
    assert.strictEqual(l[0], "ang");
    assert.ok(l[3] - 100 >= 8, "an angle is not on the line: " + l);
    assert.ok(Math.min(Math.hypot(l[2] - 100, l[3] - 100), Math.hypot(l[2] - 400, l[3] - 100)) >= 20, "nor on the corner point: " + l);
  }
  assert.notStrictEqual(o.labels[0][4], o.labels[1][4], "length and angle in two colours, and the angle has its sign as well");
  assert.deepStrictEqual(o.selLabels, ["ang", "ang"], "the selected pattern's length is not written a second time");
  assert.deepStrictEqual(o.selTexts, ["300.0", "300.0"], "the two 300 mm lines of A, each once");
  assert.deepStrictEqual(o.angLabels, [], "nor its corner angles while Angle shows them");
  assert.strictEqual(o.zoomHover, "seg");
  assert.ok(o.zoom[0] > 0 && o.zoom[0] < 1000 && o.zoom[1] > 0 && o.zoom[1] < 800, "zoomed in, the length stays in the window: " + o.zoom);
});
test("r17a / 1: the other tools' hover values are plain labels too: Add Point's two distances, Line Length's length beside the middle", () => {
  const o = boot({ script: DOC + `
    app.setTool("add_point"); app.fire("pointermove", { x: 175, y: 100 });
    out.add = added().map(x => x.t); out.addBoxes = boxes;
    app.setTool("notch"); app.fire("pointermove", { x: 175, y: 100 });
    out.notch = added().map(x => x.t);
    return out;` }).result;
  assert.deepStrictEqual(o.add, ["75.0", "225.0"]); assert.strictEqual(o.addBoxes, 0);
  assert.strictEqual(o.notch.length, 2, JSON.stringify(o.notch));
});

/* ---- Batch 2: the running sum of the selected lines ---- */
test("r17a / 2: two lines or more selected (Shift+click), their whole length beside the pointer: straight, curved, internal, on two patterns, in the display unit; no undo step; gone at one line, off the window and with another tool", () => {
  const o = boot({ script: DOC + `
    app.ev("addChild")(A, "internals", app.mkShape([{x:150,y:200},{x:250,y:200}], false)); app.commit(); S.undo.length = 0;
    const sum = () => { const r = app.ev("selLinesSum")(); return r && [r.n, +r.len.toFixed(3)]; };
    const label = () => drawn().map(x => x.t).filter(x => /^\\u03a3/.test(x));
    const at = (x, y) => app.fire("pointermove", { x, y });
    app.setTool("edit_pattern");
    app.click(250, 100); out.one = [sum(), label()];
    app.click(400, 200, { shiftKey: true }); at(600, 400); out.two = [sum(), label()];
    app.click(650, 55, { shiftKey: true }); at(600, 400); out.curve = [sum(), label(), +app.ev("segLen")(B, 0).toFixed(3)];
    app.click(200, 200, { shiftKey: true }); at(600, 400); out.internal = [sum(), label()];
    S.unit = "cm"; out.cm = label(); S.unit = "in"; out.inch = label(); S.unit = "mm";
    out.undo = S.undo.length;
    app.fire("pointerleave", { x: 1200, y: 400 }); out.left = label().length;
    at(600, 400); out.back = label().length;
    app.click(400, 200, { shiftKey: true }); app.click(650, 55, { shiftKey: true }); app.click(200, 200, { shiftKey: true }); at(600, 400); out.oneAgain = [sum(), label()];
    app.click(400, 200, { shiftKey: true }); at(600, 400); out.again = sum();
    app.setTool("add_point"); out.tool = [sum(), label()];
    return out;` }).result;
  assert.deepStrictEqual(o.one, [null, []], "one line: no sum");
  assert.deepStrictEqual(o.two, [[2, 500], ["Σ 500.0 mm"]], "300 + 200 mm: " + JSON.stringify(o.two));
  assert.ok(o.curve[2] > 300.5, "the curve is longer than its chord: " + o.curve[2]);
  assert.deepStrictEqual(o.curve.slice(0, 2), [[3, +(500 + o.curve[2]).toFixed(3)], ["Σ " + (500 + o.curve[2]).toFixed(1) + " mm"]], "the curve counted along itself, on another pattern");
  assert.deepStrictEqual(o.internal[0], [4, +(600 + o.curve[2]).toFixed(3)], "an internal line counts too");
  assert.deepStrictEqual(o.cm, ["Σ " + ((600 + o.curve[2])/10).toFixed(1) + " cm"]); assert.deepStrictEqual(o.inch, ["Σ " + ((600 + o.curve[2])/25.4).toFixed(2) + " in"]);
  assert.strictEqual(o.undo, 0, "selecting lines is no undo step");
  assert.deepStrictEqual([o.left, o.back], [0, 1], "off the 2D window it goes, and comes back with the pointer");
  assert.deepStrictEqual(o.oneAgain, [null, []], "back to one line: gone");
  assert.deepStrictEqual(o.again, [2, 500]);
  assert.deepStrictEqual(o.tool, [null, []], "another tool: gone");
});

/* ---- Batch 3: the sewing display ---- */
test("r17a / 3: Show Sewing is off when the program starts, also when it was left on; it can be switched on; the sewing tools show the seams either way", () => {
  const SEAM = DOC + `
    S.seams.push(app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true)); app.commit();
    const strokes = []; cx.stroke = () => strokes.push(cx.lineWidth);
    const seamDrawn = () => { strokes.length = 0; app.ev("drawSeams")(); return strokes.length; };
    app.setTool("edit_pattern"); out.start = [S.show.sewing, seamDrawn()];
    app.setTool("segment_sewing"); out.tool = seamDrawn() > 0;
    app.setTool("edit_sewing"); out.edit = seamDrawn() > 0;
    app.setTool("edit_pattern"); app.ev("setView")("sewing", true); out.on = [S.show.sewing, seamDrawn() > 0];
    return out;`;
  const fresh = boot({ script: SEAM }).result, kept = boot({ view: JSON.stringify({ sewing: true, length: false }), script: SEAM + `` }).result;
  assert.deepStrictEqual(fresh.start, [false, 0], "a fresh start: no seams drawn with Edit Pattern");
  assert.deepStrictEqual([fresh.tool, fresh.edit], [true, true], "the sewing tools still show them");
  assert.deepStrictEqual(fresh.on, [true, true], "switched on, they show");
  assert.deepStrictEqual(kept.start, [false, 0], "left on in the last session: off again at the start");
  const again = boot({ view: JSON.stringify({ sewing: true, length: false }), script: `return [S.show.sewing, S.show.length];` }).result;
  // (Round r23 / 1: every start looks the same) since r23 every switch starts at its default, not only Show Sewing
  assert.deepStrictEqual(again, [false, true], "Show Sewing off, and the other switches at their defaults too");
});
test("r17a / 3: a selected seam's connectors are drawn thick on a dark rim (1:1 and M:N), and its two lengths and their difference are written between its sides", () => {
  const o = boot({ script: DOC + `
    // A's right side to B's left side (200 / 200); A's top to B's top and bottom (M:N)
    S.seams.push(app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true));
    S.seams.push(app.ev("makeSeam")(S.seams, [{ piece: A.id, sid: A.segs[0].id }], [{ piece: B.id, sid: B.segs[0].id }, { piece: B.id, sid: B.segs[2].id }]));
    app.commit(); app.ev("setView")("sewing", true); app.setTool("edit_pattern");
    const strokes = []; cx.stroke = () => strokes.push([cx.lineWidth, cx.strokeStyle]);
    const thick = () => { strokes.length = 0; app.ev("drawSeams")(); return strokes.filter(s => s[0] === 2.4).length; };
    out.none = thick();
    S.selSeam = S.seams[0].id; out.one = [thick(), strokes.filter(s => s[0] === 4.6 && s[1] === "#1c1c1e").length];
    S.selSeam = S.seams[1].id; out.mn = thick();
    out.look = [app.ev("connectorLook")(true, false), app.ev("connectorLook")(false, false)];
    S.selSeam = S.seams[0].id; out.label = app.ev("seamLenLabel")(S.seams[0]);
    out.text = drawn().map(x => x.t).filter(t => /^A /.test(t));
    S.selSeam = S.seams[1].id; out.mnLabel = app.ev("seamLenLabel")(S.seams[1]).txt;
    S.selSeam = null; out.after = drawn().map(x => x.t).filter(t => /^A /.test(t));
    return out;` }).result;
  assert.strictEqual(o.none, 0, "no seam selected: every connector thin");
  assert.deepStrictEqual(o.one, [2, 2], "the selected seam's two connectors, thick, each on a dark rim");
  assert.strictEqual(o.mn, 2, "an M:N seam's connectors the same");
  assert.ok(o.look[0].w > 2*o.look[1].w && o.look[0].dash[0] > o.look[1].dash[0], "told by thickness and dashes, not only by colour");
  assert.strictEqual(o.label.txt, "A 200.0 · B 200.0 · Δ 0.0");
  near(o.label.at.x, 450, 1, "half-way between the two sides"); near(o.label.at.y, 200, 1);
  assert.deepStrictEqual(o.text, ["A 200.0 · B 200.0 · Δ 0.0"], "written once, while it is selected");
  assert.ok(/^A 300[.]0 · B [0-9.]+ · Δ -[0-9.]+$/.test(o.mnLabel), "M:N: side B is both its stretches: " + o.mnLabel);
  assert.deepStrictEqual(o.after, [], "not selected: not written");
});
test("r17a / 3: a seam that runs across a dart's opening, or into a dart's legs, is flagged where it does; the dart's own seam and an ordinary seam are not", () => {
  const o = boot({ script: DOC + `
    // a dart on A's top edge: a point at its middle, then Add Dart there (its legs sewn to each other)
    app.ev("addPoint")(A, 0, 0.5); const r = app.ev("addDartAt")(A, 1, 40, 20, 80, false); app.commit();
    out.legs = r.legs.length;
    const n = A.pts.length, ids = A.segs.map(s => s.id), legSet = new Set(r.legs);
    const before = A.segs[0].id, after = A.segs[3].id;
    const warn = () => app.ev("seamDartWarnings")(S.seams, S.pieces).map(w => [w.seam, w.k, Math.round(w.at.x), Math.round(w.at.y)]);
    out.dartOnly = warn();
    // as a file from before this round may have it: A's top sewn to B's top as one part that steps over the dart's legs
    const gapSeam = { id: 50, a: [{ piece: A.id, shape: 0, sids: [before, after], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[0].id], t0: 0, t1: 1, rev: false }] };
    S.seams.push(gapSeam); out.gap = warn();
    // a seam over a leg itself: A's left part of the top and the first leg, to B's bottom
    S.seams = S.seams.filter(s => s.id !== 50);
    S.seams.push({ id: 51, a: [{ piece: A.id, shape: 0, sids: [before, r.legs[0]], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[2].id], t0: 0, t1: 1, rev: false }] });
    out.leg = warn();
    app.ev("setView")("sewing", true); app.setTool("edit_pattern"); out.text = drawn().map(x => x.t).filter(t => /^\\u26a0/.test(t));
    return out;` }).result;
  assert.strictEqual(o.legs, 2);
  assert.deepStrictEqual(o.dartOnly, [], "the dart's legs sewn to each other: no warning");
  assert.deepStrictEqual(o.gap.map(w => w.slice(0, 2)), [[50, "gap"]], "one part stepping over the dart: flagged");
  near(o.gap[0][2], 250, 0.5, "at the opening's middle"); near(o.gap[0][3], 100, 0.5);
  assert.deepStrictEqual(o.leg.map(w => w.slice(0, 2)), [[51, "leg"]], "sewn into a leg: flagged");
  assert.deepStrictEqual(o.text, ["⚠ sewn into a dart"], "the warning is written on the pattern");
});

/* ---- Batch 4: the skirt block's waist and waistband ---- */
test("r17a / 4: a dart made on a sewn line cuts the seam into the stretches either side of it (M:N, the take-up left out), in sewing order also when sewn backwards", () => {
  const o = boot({ script: DOC + `
    // A's top sewn to B's bottom, B's side backwards; then a dart at the middle of A's top
    const sm = app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[0].id }, { piece: B.id, sid: B.segs[2].id }, true); S.seams.push(sm);
    const top = A.segs[0].id;
    app.ev("addPoint")(A, 0, 0.5); const r = app.ev("addDartAt")(A, 1, 40, 20, 80, false); app.commit();
    const s0 = S.seams.find(x => x.id === sm.id);
    out.a = s0.a.map(p => [p.sids.map(id => A.segs.findIndex(g => g.id === id)), p.rev]);
    out.legsIn = s0.a.some(p => p.sids.some(id => r.legs.includes(id)));
    const inf = app.seamInfo(s0, S.pieces); out.len = [+inf.la.toFixed(3), +inf.lb.toFixed(3)];
    out.warn = app.ev("seamDartWarnings")(S.seams, S.pieces).length;
    // a side sewn backwards: its stretches come in sewing order
    const sm2 = { id: 60, a: [{ piece: B.id, shape: 0, sids: [B.segs[0].id], t0: 0, t1: 1, rev: false }], b: [{ piece: A.id, shape: 0, sids: [A.segs[4].id, A.segs[5].id, A.segs[6].id], t0: 0, t1: 1, rev: true }] };
    S.seams.push(sm2); const endsOf = () => app.ev("seamEnds")(S.seams.find(x => x.id === 60), S.pieces).map(e => [Math.round(e[1].x), Math.round(e[1].y)]);
    out.bEnds0 = endsOf(); app.ev("addPoint")(A, 5, 0.5); const r2 = app.ev("addDartAt")(A, 6, 30, 15, 50, false); app.commit();
    const s2 = S.seams.find(x => x.id === 60);
    out.b = s2.b.map(p => [p.sids.length, p.rev]);
    out.bEnds = endsOf();
    return out;` }).result;
  assert.deepStrictEqual(o.a, [[[0], false], [[3], false]], "two parts, the stretches before and after the dart's legs");
  assert.strictEqual(o.legsIn, false, "the legs are left out");
  near(o.len[0], 260, 0.01, "the top less the dart's 40 mm"); assert.strictEqual(o.warn, 0, "not across the dart's opening: no warning");
  assert.ok(o.b.length === 2 && o.b.every(p => p[1] === true), "sewn backwards, two stretches each backwards: " + JSON.stringify(o.b));
  assert.deepStrictEqual(o.bEnds, o.bEnds0, "still sewn from where it was sewn from to where it ended");
});
test("r17a / 4: the skirt block's waistband is closed at the centre back, its first end to the line across it where the waist ends, top to top; with no extension end to end; the waist is sewn between the darts", () => {
  const o = boot({ script: `
    S.pieces.length = 0; S.seams.length = 0;
    const out = {}, add = (given) => { S.pieces.length = 0; S.seams.length = 0; app.ev("addBlock")("skirt", "general", given, { x: 0, y: 0 }); app.commit(); };
    const band = () => S.pieces.find(p => p.name === "Skirt waistband"), nm = (id) => S.pieces.find(p => p.id === id).name;
    const own = () => S.seams.filter(sm => sm.a.concat(sm.b).every(x => x.piece === band().id));
    add({});
    const W = band(), sm = own();
    out.ext = [W.internals.length, sm.length, sm[0] && sm[0].b[0].shape === W.internals[0].id];
    out.at = W.internals[0].pts.map(q => [Math.round(q.x - W.pts[0].x), Math.round(q.y - W.pts[0].y)]);
    out.ends = app.ev("seamEnds")(sm[0], S.pieces).map(([u, v]) => [Math.round(u.x - W.pts[0].x), Math.round(u.y - W.pts[0].y), Math.round(v.x - W.pts[0].x), Math.round(v.y - W.pts[0].y)]);
    const inf = app.seamInfo(sm[0], S.pieces); out.len = [inf.la, inf.lb];
    // the waist: each waistband stretch to its panel's waist either side of the dart, the lengths agreeing
    out.waist = S.seams.filter(x => x.a.length === 1 && x.a[0].piece === W.id && x.b.every(p => p.piece !== W.id)).map(x => { const i = app.seamInfo(x, S.pieces); return [x.b.map(p => nm(p.piece)).join("+"), +(i.la - i.lb).toFixed(3)]; });
    out.band = +app.ev("segLen")(W, 0).toFixed(1) + +app.ev("segLen")(W, 1).toFixed(1) + +app.ev("segLen")(W, 2).toFixed(1) + +app.ev("segLen")(W, 3).toFixed(1);
    out.warn = app.ev("seamDartWarnings")(S.seams, S.pieces).length;
    add({ "w.extension": 0 });
    const W0 = band(), s0 = own();
    out.none = [W0.internals.length, s0.length, s0[0] && s0[0].b[0].shape];
    const w = W0.pts[0], x = Math.max(...W0.pts.map(q => q.x)) - w.x;
    out.ends0 = app.ev("seamEnds")(s0[0], S.pieces).map(([u, v]) => [Math.round(u.x - w.x), Math.round(u.y - w.y), Math.round(v.x - w.x), Math.round(v.y - w.y)]); out.x0 = Math.round(x);
    return out;` }).result;
  assert.deepStrictEqual(o.ext, [1, 1, true], "a line across the band, and its first end sewn to it");
  assert.deepStrictEqual(o.at, [[797, 0], [797, 30]], "where the eased waist (777 + 20) ends, across the band's height");
  assert.deepStrictEqual(o.ends, [[0, 30, 797, 30], [0, 0, 797, 0]], "bottom to bottom, top to top: the band is a ring, not turned over");
  assert.deepStrictEqual(o.len, [30, 30]);
  assert.deepStrictEqual(o.waist, [["Skirt back (mirror)+Skirt back (mirror)", 0], ["Skirt front+Skirt front", 0], ["Skirt front+Skirt front", 0], ["Skirt back+Skirt back", 0]], "M:N, the lengths agreeing");
  assert.strictEqual(o.band, 797, "the band's sewn waist is the skirt's waist without the dart intakes");
  assert.strictEqual(o.warn, 0, "nothing sewn across a dart");
  assert.deepStrictEqual(o.none, [0, 1, 0], "no extension: no line, the two ends sewn to each other");
  assert.deepStrictEqual(o.ends0, [[0, 30, o.x0, 30], [0, 0, o.x0, 0]], "end to end, top to top");
});

module.exports = T;
