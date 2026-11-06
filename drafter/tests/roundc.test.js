// Round C: the small ones. C1 the Ctrl marquee and Edit Pattern's readout under the pointer; the later batches add theirs below.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 30000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 30 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// three patterns: A (100..400 x 100..300), B (700..800 x 100..200), C a triangle far off; the view 1 : 1 at the origin
const DOC = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  const A = app.mkPiece("A", app.mkShape([{x:100,y:100},{x:400,y:100},{x:400,y:300},{x:100,y:300}], true));
  const B = app.mkPiece("B", app.mkShape([{x:700,y:100},{x:800,y:100},{x:800,y:200},{x:700,y:200}], true));
  const C = app.mkPiece("C", app.mkShape([{x:100,y:600},{x:300,y:600},{x:100,y:700}], true));
  S.pieces.push(A, B, C); S.sel = []; app.commit(); S.undo.length = 0;
  const out = {}, up = (x, y, e) => app.fire("pointerup", { x, y, ...e });
  const names = () => S.sel.map(id => S.pieces.find(p => p.id === id).name).sort().join();
`;

/* ---------- C1 ---------- */
// (Round r15 / 4: Ctrl held changes nothing but the tip, as the check videos showed (C#1); this test said that with Ctrl the box
// took every pattern it touched)
test("C1: a marquee takes the patterns wholly inside it, with Ctrl held as well; the tip says to hold Ctrl, as in the recording", () => {
  const o = boot({ script: DOC + `
    app.setTool("transform_pattern");
    // from empty space above A: a box from x 250 to 750, across the right half of A and the left half of B
    const tx = []; app.ev("ctx").fillText = (t) => tx.push(t);
    app.drag(250, 50, 750, 180); out.dashed = !S.marquee.touch; app.draw(); out.tip = tx.some(t => /^Hold the Ctrl key while dragging/.test(t)); up(750, 180); out.plain = names();
    app.drag(560, 50, 900, 250); up(900, 250); out.wholeB = names();
    app.drag(250, 50, 750, 180, { ctrlKey: true }); out.solid = S.marquee.touch; up(750, 180, { ctrlKey: true }); out.ctrl = names();
    // a box across an edge of C with none of C's points in it
    out.edge = app.ev("marqueeTakes")(C, { a: { x: 150, y: 640 }, b: { x: 260, y: 660 } }) ? "C" : "";
    // a box wholly inside A, from a press on empty space? (the press would be on A itself, so this one is checked with the function)
    out.within = app.ev("marqueeTakes")(A, { a: { x: 200, y: 150 }, b: { x: 220, y: 170 } });
    out.none = app.ev("marqueeTakes")(C, { a: { x: 500, y: 500 }, b: { x: 600, y: 560 } });
    out.hint = app.HINT.transform_pattern;
    return out;` }).result;
  assert.strictEqual(o.dashed, true); assert.strictEqual(o.tip, true, "the pointer says to hold Ctrl, as in the recording"); assert.strictEqual(o.plain, "", "without Ctrl nothing lies wholly inside");
  assert.strictEqual(o.wholeB, "B");
  assert.strictEqual(o.solid, true, "Ctrl is noticed (the tip goes)"); assert.strictEqual(o.ctrl, "", "with Ctrl, still only what lies wholly inside");
  assert.strictEqual(o.edge, "", "an edge across the box takes nothing");
  assert.deepStrictEqual([o.within, o.none], [false, false], "a box inside a pattern takes nothing");
  assert.ok(/the box takes the patterns wholly inside it/.test(o.hint));
});
test("C1: Edit Pattern, a line under the pointer: its length at the pointer and the angle at each end (inside angles on an outline, the angle to the level at the free end of an open line)", () => {
  const o = boot({ script: DOC + `
    const texts = []; app.ev("ctx").fillText = (t) => texts.push(t);
    app.setTool("edit_pattern");
    app.fire("pointermove", { x: 250, y: 100 });
    out.hover = [S.hover && S.hover.k, S.hover && S.hover.i];
    texts.length = 0; app.draw(); out.square = texts.slice();
    // C's long side: from (300,600) to (100,700)
    app.fire("pointermove", { x: 200, y: 650 }); texts.length = 0; app.draw(); out.tri = texts.slice();
    out.triAngles = app.ev("segEndAngles")(C, 1).map(a => [+a.deg.toFixed(3), a.kind]);
    // an open line: (0,0) - (100,0) - (100,100)
    const L = app.mkShape([{x:0,y:0},{x:100,y:0},{x:100,y:-100}], false);
    out.open = [0, 1].map(i => app.ev("segEndAngles")(L, i).map(a => [+a.deg.toFixed(3), a.kind]));
    // other tools are as they were
    app.setTool("add_point"); app.fire("pointermove", { x: 250, y: 100 }); texts.length = 0; app.draw(); out.other = texts.filter(t => /^L |\\u2220/.test(t));
    out.hint = app.HINT.edit_pattern;
    return out;` }).result;
  assert.deepStrictEqual(o.hover, ["seg", 0]);
  // (Round r17a / 1: the readout was four boxes with the length twice, "L 300.0 mm" at the pointer and "300.0 mm" beside
  // the line; now each value once, plain, in the style of the selected line's length: the length beside the line's middle)
  assert.strictEqual(o.square.filter(t => t === "300.0").length, 1, "the length once: " + JSON.stringify(o.square));
  assert.ok(!o.square.some(t => /^L |mm$/.test(t)), "no L ... mm at the pointer any more: " + JSON.stringify(o.square));
  assert.strictEqual(o.square.filter(t => t === "∠90.0°").length, 2, "a square corner at each end: " + JSON.stringify(o.square));
  // the triangle's corners: at (300,600) atan(100/200) = 26.565°, at (100,700) 63.435°
  assert.deepStrictEqual(o.triAngles, [[26.565, "corner"], [63.435, "corner"]]);
  assert.ok(o.tri.includes("∠26.6°") && o.tri.includes("∠63.4°"), JSON.stringify(o.tri));
  assert.deepStrictEqual(o.open, [[[0, "level"], [90, "corner"]], [[90, "corner"], [90, "level"]]]);
  assert.deepStrictEqual(o.other, [], "only Edit Pattern writes the readout");
  assert.ok(/length and the angle at each end/.test(o.hint));
});

/* ---------- C2 ---------- */
test("C2: Change Length moves the end point, the start point or both ends (half each, the middle stays); the dialog shows the change before OK, on copies; OK is one undo step", () => {
  const o = boot({ script: DOC + `
    const pts = (sh) => sh.pts.map(q => [+q.x.toFixed(6), +q.y.toFixed(6)]);
    // the dialog as the page builds it, without the answer hook: its kinds of field and the preview up at once
    app.ev("segLengthNumeric")({ x: 300, y: 300 }, A, 0);
    out.html = app.el("dlg").innerHTML; out.previewAtOpen = (app.ev("dlgPreview") || []).length;
    app.ev("hideDlg")(); out.afterCancel = [app.ev("dlgPreview"), S.undo.length];
    // the same dialog answered: the preview for each choice, then OK with Both
    let seen = null;
    app.answer = (title, fields, opts) => { seen = { title, fields: fields.map(f => [f.k, f.val]), selects: (opts.selects || []).map(c => [c.k, c.val, c.options.map(x => x[0])]),
      pv: ["end", "start", "both"].map(m => pts(opts.preview({ len: 400, move: m, lock: false })[0])), unreachable: opts.preview({ len: -5, move: "end", lock: false }),
      extras: opts.preview({ len: 400, move: "end", lock: false }).slice(1).filter(x => x.dot || (x.label && /^[+]/.test(x.label))).map(x => x.dot ? ["dot", x.dot.x, x.dot.y] : ["label", x.label]),
      lengths: opts.preview({ len: 400, move: "end", lock: false }).filter(x => x.label && !/^[+]/.test(x.label)).map(x => x.label) };
      return { len: 400, move: "both", lock: false }; };
    out.before = pts(A);
    app.ev("segLengthNumeric")({ x: 300, y: 300 }, A, 0);
    out.seen = seen; out.after = pts(A); out.len = +app.segLen(A, 0).toFixed(6); out.steps = S.undo.length;
    app.undo(); out.undone = pts(S.pieces[0]);
    // (Round r15 / 6: the choice is not remembered: Start again, as the reference opens; it used to be remembered)
    app.answer = (title, fields, opts) => { out.again = opts.selects[0].val; return null; };
    app.ev("segLengthNumeric")({ x: 300, y: 300 }, A, 0);
    return out;` }).result;
  assert.ok(/>Direction</.test(o.html) && />Both</.test(o.html) && />Start</.test(o.html) && />End</.test(o.html) && /Lock Curve Points/.test(o.html), "the choice is in the dialog");
  assert.ok(o.previewAtOpen >= 1, "the preview is up as soon as the dialog opens"); assert.deepStrictEqual(o.afterCancel, [null, 0], "closing the dialog lets the preview go and leaves no step");
  assert.deepStrictEqual(o.seen.selects, [["move", "start", ["start", "both", "end"]]], "Direction: Start, Both, End, as W58");
  assert.deepStrictEqual(o.seen.extras, [["dot", 500, 100], ["label", "+100.0"]], "a dot where the moved end goes, with the change written there");
  assert.deepStrictEqual(o.seen.lengths, ["400.0", "223.6", "300.0", "200.0"], "every line of the pattern labelled with its length");
  assert.deepStrictEqual(o.seen.pv.map(p => p.slice(0, 2)), [[[100, 100], [500, 100]], [[0, 100], [400, 100]], [[50, 100], [450, 100]]], "End, Start, Both: Both moves 50 each way, the middle stays at 250");
  assert.strictEqual(o.seen.unreachable, null, "nothing to show for a length that cannot be");
  assert.deepStrictEqual(o.before, [[100, 100], [400, 100], [400, 300], [100, 300]], "the preview changed copies, not the document");
  assert.deepStrictEqual(o.after.slice(0, 2), [[50, 100], [450, 100]]); assert.strictEqual(o.len, 400); assert.strictEqual(o.steps, 1, "one undo step");
  assert.deepStrictEqual(o.undone, o.before); assert.strictEqual(o.again, "start");
});
test("C2: the preview is general: numDialog draws what opts.preview returns, dashed, and lets it go on OK and on Cancel", () => {
  const o = boot({ script: DOC + `
    const dashes = []; const c = app.ev("ctx"); c.setLineDash = (d) => dashes.push(d.join(","));
    let got = 0;
    app.ev("numDialog")("Test", [{ k: "a", label: "A", val: 1 }], { x: 0, y: 0 }, () => { got++; }, { preview: (v) => [app.ev("previewCopy")(B, B).p] });
    out.up = (app.ev("dlgPreview") || []).length; dashes.length = 0; app.draw(); out.dashed = dashes.includes("7,4");
    app.el("dlg-x").onclick && app.el("dlg-x").onclick();
    app.ev("hideDlg")(); out.gone = app.ev("dlgPreview");
    return out;` }).result;
  assert.deepStrictEqual([o.up, o.dashed, o.gone], [1, true, null]);
});

/* ---------- C3 ---------- */
test("C3: Add Point/Split Line catches at the middle of a line within 10 px (by length, also on a curve), shown by a diamond and the word; further off the point goes where clicked", () => {
  const o = boot({ script: DOC + `
    const texts = []; app.ev("ctx").fillText = (t) => texts.push(t);
    app.setTool("add_point");
    app.fire("pointermove", { x: 256, y: 101 }); texts.length = 0; app.draw(); out.label = texts.includes("Middle");
    out.guide = app.ev("midGuide")({ ...app.ev("hit")(256, 101), kind: "outline" }).map(q => [+q.x.toFixed(6), +q.y.toFixed(6)]);
    app.click(256, 101); out.caught = [A.pts.length, A.pts[1].x, A.pts[1].y, S.undo.length];
    app.click(370, 100); out.free = [A.pts.length, A.pts[2].x];
    app.fire("pointermove", { x: 280, y: 100 }); texts.length = 0; app.draw(); out.noLabel = texts.includes("Middle");
    // a curved edge: B's top made into a curve; its middle by length is caught
    app.ev("setCurve")(B, 0, true); B.segs[0].c1 = { x: 720, y: 40 }; B.segs[0].c2 = { x: 740, y: 40 }; app.commit();
    const tm = app.ev("tAtFrac")(B, 0, 0.5), m = app.segPt(B, 0, tm), sm = app.toS(m);
    app.click(sm.x + 6, sm.y + 3);
    out.curve = [+app.segLen(B, 0).toFixed(6), +app.segLen(B, 1).toFixed(6)];
    out.hint = app.HINT.add_point;
    return out;` }).result;
  assert.strictEqual(o.label, true, "the word shows the catch");
  assert.deepStrictEqual(o.guide, [[250, 100], [250, 200]], "the guide line from the middle straight into the pattern, to its centre line");
  assert.deepStrictEqual(o.caught, [5, 250, 100, 1], "a click 6 px off the middle puts the point exactly at the middle, one undo step");
  assert.deepStrictEqual(o.free, [6, 370], "a click further off puts it where clicked");
  assert.strictEqual(o.noLabel, false);
  near(o.curve[0], o.curve[1], 1e-3, "the curve is split into two halves of the same length");
  assert.ok(/catches exactly at the middle/.test(o.hint));
});

/* ---------- C4 ---------- */
test("C4 (as the maintainer checked it in Round CF): Fullness, the first click is the hinge and stays, the second the end of the slash; a click chooses the side that turns (drawn thick and named), the pointer turns it with the spread shown, a click makes it; no double-click", () => {
  const o = boot({ script: DOC + `
    const texts = []; app.ev("ctx").fillText = (t) => texts.push(t);
    app.setTool("fullness");
    app.click(100, 200); out.first = S.draft.full.step;
    app.click(400, 200);                                           // the hinge (A's left edge), then the end (its right edge)
    out.step = [S.draft.full.step, S.draft.full.side];
    app.fire("pointermove", { x: 250, y: 260 }); texts.length = 0; app.draw(); out.named = texts.includes("Turns");
    app.click(250, 260); out.side = [S.draft.full.step, S.draft.full.side];
    app.fire("pointermove", { x: 400, y: 160 }); texts.length = 0; app.draw(); out.still = S.draft.full.side;
    app.fire("pointermove", { x: 400, y: 245 });
    app.click(400, 245);
    out.done = [S.draft, S.undo.length, A.internals.length];
    const far = A.internals[1].pts[1], hinge = A.internals[1].pts[0]; out.far = [+far.x.toFixed(3), +far.y.toFixed(3)]; out.hinge = [+hinge.x.toFixed(3), +hinge.y.toFixed(3)];
    out.hint = app.HINT.fullness;
    return out;` }).result;
  assert.strictEqual(o.first, "to");
  assert.deepStrictEqual(o.step, ["side", null], "a click chooses the side");
  assert.strictEqual(o.named, true);
  assert.strictEqual(o.side[0], "turn"); assert.ok(o.side[1], "the side is fixed by the click");
  assert.strictEqual(o.still, o.side[1], "and no longer follows the pointer");
  assert.strictEqual(o.done[0], null); assert.strictEqual(o.done[1], 1, "one undo step"); assert.strictEqual(o.done[2], 2);
  assert.ok(o.far[1] > 200 + 30, "the lower side turned down towards the pointer: " + o.far);
  assert.deepStrictEqual(o.hinge, [100, 200], "the first place is the hinge and stays where it is");
  assert.ok(/start segment \(the hinge/.test(o.hint) && !/Double-click/.test(o.hint), o.hint);
});

/* ---------- C5 ---------- */
test("C5: a punch mark placed by its distances to the outline (Left, Right, Up, Down, along the window's axes, also in a turned pattern), with preview lines; moved the same way; one undo step each", () => {
  const o = boot({ script: DOC + `
    app.setTool("punch_mark");
    let seen = null, answer = null;
    app.answer = (title, fields, opts) => { const shown = Object.fromEntries(fields.map(f => [f.k, f.val])), v = answer(shown);
      const pv = opts.preview(v); seen = { title, labels: fields.map(f => f.label), shown, pv: pv && [pv.length, !!pv[0].punch, pv.slice(1).map(l => l.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]))], sync: opts.sync({ ...shown, l: 50 }, "l") }; return v; };
    // inside A at (200, 150): 100 to the left, 200 to the right, 50 up, 150 down
    answer = (sh) => ({ ...sh, l: 50, u: 30 });
    app.fire("contextmenu", { x: 200, y: 150 });
    out.first = { seen, mark: A.punches.map(m => [m.x, m.y]), steps: S.undo.length };
    // only Right and Down changed: they decide
    answer = (sh) => ({ ...sh, r: 100, d: 100 });
    app.fire("contextmenu", { x: 200, y: 150 });
    out.second = [A.punches[1].x, A.punches[1].y, S.undo.length];
    // a turned pattern: a square turned 45 degrees about (600, 500), corners 100 from the middle
    const D = app.mkPiece("D", app.mkShape([{x:600,y:400},{x:700,y:500},{x:600,y:600},{x:500,y:500}], true)); S.pieces.push(D); app.commit();
    answer = (sh) => { out.dShown = sh; return { ...sh, l: 50 }; };
    app.fire("contextmenu", { x: 600, y: 500 });
    out.turned = [D.punches[0].x, D.punches[0].y];
    // outside the pattern: refused, no step
    const n = S.undo.length; answer = (sh) => ({ ...sh, l: 500 });
    app.fire("contextmenu", { x: 200, y: 150 }); out.outside = [S.undo.length - n, toasts[toasts.length - 1], seen.pv];
    // an existing mark moved by its own menu
    answer = (sh) => ({ ...sh, u: 100 });
    app.ev("punchPosNumeric")({ x: 0, y: 0 }, A, { x: A.punches[0].x, y: A.punches[0].y }, A.punches[0]);
    out.moved = [A.punches[0].x, A.punches[0].y, A.punches.length, seen.title];
    out.hint = app.HINT.punch_mark;
    return out;` }).result;
  const f = o.first;
  assert.strictEqual(f.seen.title, "Add Punch Mark"); assert.deepStrictEqual(f.seen.labels, ["Diameter", "Left", "Right", "Up", "Down"], "Size, then Position, as W73");
  assert.deepStrictEqual(f.seen.shown, { dia: 10, l: 100, r: 200, u: 50, d: 150 });
  assert.deepStrictEqual(f.mark, [[150, 130]], "50 from the left edge, 30 from the top"); assert.strictEqual(f.steps, 1);
  assert.deepStrictEqual(f.seen.pv[0], 5, "the preview: the mark and its four lines"); assert.strictEqual(f.seen.pv[1], true);
  assert.deepStrictEqual(f.seen.pv[2], [[[150, 130], [100, 130]], [[150, 130], [400, 130]], [[150, 130], [150, 100]], [[150, 130], [150, 300]]]);
  assert.strictEqual(f.seen.sync.r, 250, "Left and Right go together");
  assert.deepStrictEqual(o.second, [300, 200, 2], "Right 100 and Down 100");
  assert.deepStrictEqual(o.dShown, { dia: 10, l: 100, r: 100, u: 100, d: 100 }, "in the turned square, along the window's axes");
  assert.deepStrictEqual(o.turned, [550, 500]);
  assert.strictEqual(o.outside[0], 0); assert.ok(/outside the pattern/.test(o.outside[1])); assert.strictEqual(o.outside[2], null, "and no preview for it");
  assert.deepStrictEqual(o.moved, [150, 200, 2, "Punch Mark Position"]);
  assert.ok(/Right-click inside a pattern to place one by those distances/.test(o.hint));
});

/* ---------- C6 ---------- */
test("C6: the seam allowance is one thin line with no fill, on screen, in print and in SVG; the view's Seam Allowance switch hides it in all three", () => {
  const o = boot({ script: DOC + `
    for (const sg of A.segs) sg.sa = 10; app.commit();
    const c = app.ev("ctx"); let fills = 0, strokes = [];
    c.fill = () => { fills++; }; c.stroke = () => { strokes.push(c.lineWidth); };
    const drawA = () => { fills = 0; strokes = []; app.ev("drawPiece")(A); return [fills, strokes.slice()]; };
    const drawB = () => { fills = 0; strokes = []; app.ev("drawPiece")(B); return [fills, strokes.slice()]; };
    app.setTool("edit_pattern");
    out.screen = { withSA: drawA(), without: drawB() };
    const svg = () => { let got = null; app.setDownload((n, t) => { got = t; }); app.el("ex-svg").onclick(); return got; };
    const pr = () => app.ev("printInner")([A], app.ev("S.print") || S.print, S.unit);
    out.svg = svg(); out.print = pr();
    app.setView("sa", false);
    out.hidden = { screen: drawA(), svg: svg(), print: pr() };
    app.setView("sa", true);
    return out;` }).result;
  const [fA, sA] = o.screen.withSA, [fB, sB] = o.screen.without;
  assert.strictEqual(fA, fB, "no fill for the seam allowance: as many fills as a pattern without one");
  assert.strictEqual(sA.length, sB.length + 1, "one more line"); assert.ok(sA[0] < 1.3, "thinner than the outline: " + sA[0]);
  const poly = /<polygon [^>]*data-seam-allowance="1"[^>]*>/.exec(o.svg);
  assert.ok(poly && /stroke-width="0[.]2"/.test(poly[0]) && /fill="none"/.test(poly[0]), "SVG: " + (poly && poly[0]));
  const pl = /<path data-layer="sa"[^>]*>/.exec(o.print);
  assert.ok(pl && /fill="none"/.test(pl[0]) && /stroke-width="0[.]2"/.test(pl[0]), "print: " + (pl && pl[0]));
  assert.strictEqual(o.hidden.screen[1].length, sB.length, "hidden on screen");
  assert.ok(!/data-seam-allowance/.test(o.hidden.svg) && !/stroke-dasharray="3 2"/.test(o.hidden.svg.split("<g id=")[1]), "hidden in SVG, and the seam line is then a plain outline");
  assert.ok(!/data-layer="sa"/.test(o.hidden.print), "hidden in print");
});

/* ---------- C7 ---------- */
test("C7: Create Rectangle as W67: Size (Width, Height, one link beside the two, 500 x 500), Replicate (Interval 750, Angle 90, Number of Shapes 1); every shape previewed; Interval the step from one to the next along Angle; OK one undo step", () => {
  const o = boot({ script: DOC + `
    S.pieces.length = 0; app.commit(); S.undo.length = 0;
    app.setTool("rectangle");
    let seen = null;
    app.answer = (title, fields, opts) => { const v = { w: 50, h: 30, s: 80, a: 90, n: 3, link: false };
      seen = { title, fields: fields.map(f => [f.k, f.label, f.val, f.head || ""]), link: opts.link, pv: opts.preview(v).map(sh => sh.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)])), ids: S.nextSegId }; return v; };
    const ids0 = S.nextSegId;
    app.ev("shapeNumeric")({ x: 0, y: 0, sx: 0, sy: 0 }, { x: 100, y: 500 });
    out.seen = seen; out.idsKept = seen.ids === ids0;
    out.made = S.pieces.map(p => p.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]));
    out.steps = S.undo.length; out.sel = S.sel.length;
    app.undo(); out.undone = S.pieces.length;
    app.answer = null; app.ev("shapeNumeric")({ x: 0, y: 0, sx: 0, sy: 0 }, { x: 0, y: 0 }); out.dlg = app.el("dlg").innerHTML;
    return out;` }).result;
  assert.strictEqual(o.seen.title, "Create Rectangle");
  assert.deepStrictEqual(o.seen.fields, [["w", "Width", 500, "Size"], ["h", "Height", 500, ""], ["s", "Interval", 750, "Replicate"], ["a", "Angle", 90, ""], ["n", "Number of Shapes", 1, ""]]);
  assert.deepStrictEqual(o.seen.link.keys, ["w", "h"], "the link ties width and height, not Replicate's fields");
  assert.strictEqual(o.seen.pv.length, 3, "Number of Shapes counts them all");
  // (Round r15 / 4: Angle as the reference counts it, 0° up, clockwise: 90° is to the right; it was up)
  assert.deepStrictEqual(o.seen.pv.map(p => p[0]), [[100, 500], [180, 500], [260, 500]], "each 80 further on at 90 degrees: to the right");
  assert.strictEqual(o.idsKept, true, "a preview takes no ids from the document");
  assert.strictEqual(o.made.length, 3); assert.deepStrictEqual(o.made[2], [[260, 500], [310, 500], [310, 530], [260, 530]]);
  assert.strictEqual(o.steps, 1, "one undo step for all three"); assert.strictEqual(o.sel, 3); assert.strictEqual(o.undone, 0);
  assert.ok(/<h3>Size<\/h3>/.test(o.dlg) && /<h3>Replicate<\/h3>/.test(o.dlg) && /<svg/.test(o.dlg), "the groups and the link icon");
});
test("C7: Create Ellipse as W68: Diameter, Radius or Circumference chosen by a radio button, the others greyed; the link beside the radius; the three follow each other; a circumference is a circle", () => {
  const o = boot({ script: DOC + `
    S.pieces.length = 0; app.commit(); S.undo.length = 0;
    app.setTool("ellipse");
    const size = (sh) => { const b = app.bboxOf([sh]); return [+(b.x1 - b.x0).toFixed(3), +(b.y1 - b.y0).toFixed(3)]; };
    let answer = null, seen = null;
    app.answer = (title, fields, opts) => { seen = { title, fields: fields.map(f => [f.k, f.label, f.val, f.g || ""]), radio: opts.radio, link: opts.link.keys, sync: opts.sync({ dw: 80, dh: 50 }, "dw") }; return answer(); };
    answer = () => ({ by: "radius", dw: 20, dh: 20, rw: 40, rh: 25, c: 62.83, s: 30, a: 90, n: 1 });
    app.ev("shapeNumeric")({ x: 0, y: 0, sx: 0, sy: 0 }, { x: 0, y: 0 });
    out.seen = seen; out.radius = size(S.pieces[0]);
    answer = () => ({ by: "circumference", dw: 20, dh: 20, rw: 10, rh: 10, c: 100*Math.PI, s: 30, a: 90, n: 2 });      // (Round r15 / 4: 90° is to the right now; it was 0°)
    app.ev("shapeNumeric")({ x: 0, y: 0, sx: 0, sy: 0 }, { x: 300, y: 0 });
    out.circle = [size(S.pieces[1]), S.pieces.length, app.bboxOf([S.pieces[2]]).x0 - app.bboxOf([S.pieces[1]]).x0];
    app.answer = null; app.ev("shapeNumeric")({ x: 0, y: 0, sx: 0, sy: 0 }, { x: 0, y: 0 }); out.dlg = app.el("dlg").innerHTML;
    return out;` }).result;
  assert.strictEqual(o.seen.title, "Create Ellipse");
  assert.deepStrictEqual(o.seen.fields.slice(0, 5).map(f => [f[0], f[1], f[2], f[3]]), [["dw", "Width", 20, "diameter"], ["dh", "Height", 20, "diameter"], ["rw", "Width", 10, "radius"], ["rh", "Height", 10, "radius"], ["c", "Circumference", 62.83, "circumference"]]);
  assert.deepStrictEqual(o.seen.fields.slice(5).map(f => [f[1], f[2]]), [["Interval", 30], ["Angle", 90], ["Number of Shapes", 1]]);
  assert.deepStrictEqual([o.seen.radio.k, o.seen.radio.val], ["by", "diameter"]); assert.deepStrictEqual(o.seen.link, ["rw", "rh"], "the link beside the radius");
  assert.deepStrictEqual([o.seen.sync.rw, o.seen.sync.rh], [40, 25]); near(o.seen.sync.c, 206.93, 0.01, "a diameter typed fills in the circumference");
  assert.deepStrictEqual(o.radius, [80, 50]);
  near(o.circle[0][0], 100, 0.01); near(o.circle[0][1], 100, 0.01); assert.strictEqual(o.circle[1], 3); near(o.circle[2], 30, 1e-6, "the second 30 further on to the right (angle 90)");
  assert.strictEqual((o.dlg.match(/type="radio"/g) || []).length, 3); assert.strictEqual((o.dlg.match(/ disabled/g) || []).length, 3, "radius and circumference greyed while diameter is chosen");
});

/* ---------- C8 ---------- */
test("C8: the timeline gives every kind of step its own glyph and names the kind: a tool's icon for a tool's step, a shape a kind for the others", () => {
  const o = boot({ script: DOC + `
    const kind = (n, tool) => { const k = app.ev("histKind")({ n, tool: tool || "" }); return [k.k, k.name, k.icon]; };
    out.kinds = ["Move in 3D", "Segment Sewing", "Delete", "Paste", "Transform Pattern", "Grading", "Nest Patterns", "Assign Fabric", "Import DXF", "Change Length", "Rename"].map(n => kind(n));
    out.tool = kind("Polygon", "polygon");
    out.glyphs = app.ev("HIST_KINDS").map(x => x[3]);
    // the markers carry the kind in their tooltip
    app.ev("push")("Move in 3D"); app.commit(); app.ev("push")("Delete"); app.commit();
    S.ui.timeline = true; const made = []; const ce = app.ev("document").createElement; app.ev("document").createElement = (t) => { const e = ce(t); made.push(e); return e; };
    app.ev("renderTimeline")(); app.ev("document").createElement = ce;
    out.titles = made.filter(e => e.className && /tl-step/.test(e.className)).map(e => [e.title, e.dataset.kind || ""]);
    return out;` }).result;
  assert.deepStrictEqual(o.kinds.map(k => k[0]), ["3D", "sewing", "delete", "copy", "move", "grading", "layout", "material", "file", "typed", "edit"]);
  assert.strictEqual(new Set(o.glyphs).size, o.glyphs.length, "every kind its own shape");
  assert.strictEqual(o.tool[0], "tool"); assert.strictEqual(o.tool[1], "Polygon");
  assert.ok(o.titles.length >= 3);
  const last = o.titles.slice(-2);
  assert.ok(/Move in 3D [(]3D window[)]$/.test(last[0][0]) && last[0][1] === "3D", JSON.stringify(last));
  assert.ok(/Delete [(]Delete[)]$/.test(last[1][0]) && last[1][1] === "delete", JSON.stringify(last));
});
// (Round r33 / 4) graded on the size run every document had before r33 (a document starts with none since): oldSizeRun
test("C8: Grading Review (2D): a tile a size of the size run, every tile at one scale, the patterns as they are in that size; the base and the shown size marked by word and frame; on the 2D menu and the Grading panel", () => {
  const o = boot({ oldSizeRun: true,  script: DOC + `
    const G = S.grading;
    app.ev("setGradePoint")(G, A, A, 1, true); app.ev("setPtDelta")(G, A, A, 1, 5, 20, 0); app.commit();
    S.sel = [A.id];
    const r = app.ev("gradingReviewTiles")(G, [A]);
    out.tiles = r.tiles.map(t => [t.z.name, t.base, t.shown, +t.pieces[0].pts[1].x.toFixed(6)]);
    out.box = r.box;
    out.n = app.ev("gradingReview")(); out.html = app.el("review").innerHTML;
    G.active = 5; app.ev("gradingReview")(); out.html2 = app.el("review").innerHTML;
    let saved = null; app.setDownload((n, t) => { saved = [n, (t.match(/<text /g) || []).length]; }); app.ev("reviewSave")(); out.saved = saved;
    S.ui.unbuilt = false; app.ev("gradingReview")(); out.noUnbuilt = (app.el("review").innerHTML.match(/not built yet/g) || []).length; S.ui.unbuilt = true;
    out.menu = app.MENUS.production().some(x => x && /^Grading Review [(]2D[)] [(]Beta[)]/.test(x.n || ""));      // in the Production menu since Round D / D6, as W51 has it
    out.panel = app.ev("gradingPanel")(A).includes('id="g-review"');
    out.steps = S.undo.length;
    return out;` }).result;
  assert.deepStrictEqual(o.tiles.map(t => t[0]), ["XS", "S", "M", "L", "XL"]);
  assert.deepStrictEqual(o.tiles.map(t => t[1]), [false, false, true, false, false], "M is the base");
  assert.deepStrictEqual(o.tiles.map(t => t[2]), [false, false, true, false, false], "with no size picked, the base is the one shown");
  assert.strictEqual(o.tiles[4][3], 420, "XL: the graded point 20 further out"); assert.strictEqual(o.tiles[2][3], 400);
  assert.strictEqual(o.box.x1, 420, "one scale for all: the box holds the largest size");
  assert.strictEqual(o.n, 5);
  assert.strictEqual((o.html.match(/class="rv-tile[ "]/g) || []).length, 5); assert.ok(/M [(]base[)] · Shown/.test(o.html) && /rv-tile base shown/.test(o.html));
  assert.ok(/XL · Shown/.test(o.html2) && /rv-tile shown/.test(o.html2) && /M [(]base[)]</.test(o.html2));
  assert.ok(/Grading Review [(]2D[)] [(]Beta[)]/.test(o.html) && /W: <input[^>]*id="rv-w"[^>]*value="200"/.test(o.html) && /H: <input[^>]*id="rv-h"[^>]*value="300"/.test(o.html), "the top row of W55");
  assert.ok(/title="Reset Layout"/.test(o.html) && /title="Full Screen"/.test(o.html) && /title="Save Snapshot/.test(o.html), "the button column");
  // (Round build-1: Lock (Camera) and Information Display are built, so the column has no row for what is not built)
  assert.strictEqual((o.html.match(/not built yet/g) || []).length, 0, "Lock and Information Display are built"); assert.ok(/id="rv-lock"/.test(o.html) && /id="rv-info"/.test(o.html)); assert.strictEqual(o.noUnbuilt, 0, "hidden with the switch off");
  assert.deepStrictEqual(o.saved, ["grading-review.svg", 5]);
  assert.deepStrictEqual([o.menu, o.panel], [true, true]);
});

module.exports = T;
