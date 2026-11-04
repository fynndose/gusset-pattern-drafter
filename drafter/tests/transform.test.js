// Roadmap 2, batch 3: Transform Pattern (frame, ghost move, anchored scaling, turning
// handle), the Moving Distance and Transform dialogs, Edit Pattern's typed moves, and
// the Transform Point/Segment tool.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], view: { s: 1, x: 0, y: 0 }, nextSegId: 1, nextShapeId: 1, nextId: 1, tps: null, tool: "transform_point" };
const G = load(["V", "cp", "dist", "sub", "add", "clone", "mkShape", "rectShape", "mkPiece", "setCurve", "insertCp", "segPt", "segLen", "isSpline",
  "boxHandles", "HANDLE_OPP", "handleScreen", "turnHandle", "frameHit", "FRAME_PAD", "FRAME_STEM", "tpsSegs", "tpsBox", "tpsApply", "tpsMap"], { S });
const { V, dist, add, clone, rectShape, mkPiece, setCurve, insertCp, segPt, segLen, boxHandles, HANDLE_OPP, handleScreen, turnHandle, frameHit, FRAME_PAD, FRAME_STEM, tpsSegs, tpsBox, tpsApply, tpsMap } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, tol, msg) => assert.ok(dist(p, q) <= tol, (msg || "") + " expected (" + q.x + ", " + q.y + "), got (" + p.x + ", " + p.y + ")");
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
// one 300 x 200 rectangle at (100, 100), selected, and a second pattern out of the way
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:100,y:100},{x:400,y:100},{x:400,y:300},{x:100,y:300}], true));
  const B = app.mkPiece("B", app.mkShape([{x:700,y:100},{x:800,y:100},{x:800,y:200},{x:700,y:200}], true));
  S.pieces.push(A, B); S.sel = [A.id]; app.commit(); S.undo.length = 0;
  const at = (q) => app.toS(q), out = {}, P = () => S.pieces[0], pts = () => P().pts.map(q => [+q.x.toFixed(6), +q.y.toFixed(6)]);
  const box = () => app.bboxOf([P()]);
  const handle = (id) => app.handleScreen(box(), app.boxHandles(box()).find(h => h.id === id));
  const up = (q) => app.fire("pointerup", { x: q.x, y: q.y });
`;

/* ---------- the frame ---------- */
test("the selection frame: eight handles 20 px outside the box, each with the opposite one as its anchor, and a turning handle above the top", () => {
  S.view = { s: 2, x: 10, y: 20 };
  const b = { x0: 100, y0: 50, x1: 300, y1: 150 }, hs = boxHandles(b);
  assert.deepStrictEqual(hs.map(h => h.id), ["nw", "n", "ne", "e", "se", "s", "sw", "w"]);
  samePt(handleScreen(b, hs[0]), V(100*2 + 10 - FRAME_PAD, 50*2 + 20 - FRAME_PAD), 1e-9, "the corner handle is outside the corner both ways");
  samePt(handleScreen(b, hs[1]), V(200*2 + 10, 50*2 + 20 - FRAME_PAD), 1e-9, "a side handle only outward");
  const th = turnHandle(b); samePt(th, V(410, 120 - FRAME_PAD - FRAME_STEM), 1e-9, "the turning handle is on a stem above the top middle handle");
  for (const h of hs) {
    const s = handleScreen(b, h), fh = frameHit(b, s.x + 2, s.y - 2, null), opp = hs.find(x => x.id === HANDLE_OPP[h.id]);
    assert.strictEqual(fh.k, "scale"); assert.strictEqual(fh.id, h.id); samePt(fh.anchor, opp.p, 1e-12, h.id + " is anchored at " + opp.id);
  }
  assert.strictEqual(frameHit(b, th.x, th.y + 3, null).k, "rotate");
  assert.strictEqual(frameHit(b, 410, 220, V(200, 100)).k, "pivot", "the centre mark");
  assert.strictEqual(frameHit(b, 300, 200, V(200, 100)), null, "inside the frame, on nothing");
  const c = handleScreen(b, hs[2]); assert.strictEqual(frameHit(b, c.x + 12, c.y - 8, null).k, "rotate", "just outside a corner handle still turns");
});

/* ---------- Transform Pattern ---------- */
test("moving with Transform Pattern: nothing moves until the button is let go, then exactly that far, in one step; a click leaves none", () => {
  const r = boot({ script: DOC + `
    app.setTool("transform_pattern");
    const a = at({ x: 250, y: 200 }), b = at({ x: 337.5, y: 260.25 });
    app.drag(a.x, a.y, b.x, b.y);
    out.during = [pts()[0], S.drag.k, S.drag.dv, S.undo.length, app.cv.style.cursor];
    up(b);
    out.after = [pts(), S.undo.length];
    app.click(at({ x: 400, y: 300 }).x, at({ x: 400, y: 300 }).y); out.click = [pts()[0], S.undo.length];
    // Shift: straight across
    const c = at({ x: 400, y: 300 }), d = at({ x: 460, y: 320 });
    S.shift = true; app.drag(c.x, c.y, d.x, d.y); up(d); S.shift = false;
    out.shift = pts()[0];
    app.undo(); app.undo(); out.undone = pts()[0];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.during[0], [100, 100], "the pattern has not moved while the button is down");
  assert.strictEqual(o.during[1], "move"); near(o.during[2].x, 87.5, 1e-6); near(o.during[2].y, 60.25, 1e-6); assert.strictEqual(o.during[3], 0); assert.strictEqual(o.during[4], "move");
  near(o.after[0][0][0], 187.5, 1e-6); near(o.after[0][0][1], 160.25, 1e-6); near(o.after[0][2][0], 487.5, 1e-6); assert.strictEqual(o.after[1], 1, "one undo step");
  assert.strictEqual(o.click[1], 1, "a click without a drag leaves no step"); near(o.click[0][0], 187.5, 1e-6);
  near(o.shift[0], 247.5, 1e-6, "Shift: 60 across"); near(o.shift[1], 160.25, 1e-6, "and not down");
  assert.deepStrictEqual(o.undone, [100, 100]);
});

test("right-click while moving: the Moving Distance dialog, the distance first and what was dragged in it; typed values move the pattern", () => {
  const r = boot({ script: DOC + `
    app.setTool("transform_pattern");
    const a = at({ x: 250, y: 200 }), b = at({ x: 280, y: 240 });
    let dlg = null;
    app.drag(a.x, a.y, b.x, b.y);
    app.answer = (t, f) => { dlg = [t, f.map(x => [x.label, x.val, x.unit])]; return { d: 100, x: f[1].val, y: f[2].val }; };
    app.fire("contextmenu", { x: b.x, y: b.y });
    out.dlg = dlg; out.typed = [pts()[0], S.undo.length, S.drag];
    // from the menu, with X and Y typed (Y up)
    app.answer = (t, f) => ({ d: 0, x: -20, y: 15 });
    const m = at({ x: 250, y: 300 }); app.menuClick(m.x, m.y, "More ▸ Move\\u2026");
    out.xy = pts()[0];
    // centimetres: the dialog shows and takes centimetres
    app.setPrefs({ unit: "cm" });
    app.drag(m.x, m.y, m.x + 30*S.view.s, m.y); app.answer = (t, f) => { out.cm = [f[0].val, f[0].unit]; return { d: 5, x: f[1].val, y: f[2].val }; };
    const x0 = pts()[0][0]; app.fire("contextmenu", { x: m.x, y: m.y }); out.cmMoved = pts()[0][0] - x0;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.dlg[0], "Moving Distance"); assert.deepStrictEqual(o.dlg[1].map(x => x[0]), ["Distance Moved", "X-Axis", "Y-Axis"]);
  near(o.dlg[1][0][1], 50, 1e-6, "30 across and 40 down is 50"); near(o.dlg[1][1][1], 30, 1e-6); near(o.dlg[1][2][1], -40, 1e-6, "Y is positive upward");
  near(o.typed[0][0], 160, 1e-6, "100 typed, the same way: 60 across"); near(o.typed[0][1], 180, 1e-6, "and 80 down");
  assert.strictEqual(o.typed[1], 1); assert.strictEqual(o.typed[2], null);
  near(o.xy[0], 140, 1e-6, "X -20"); near(o.xy[1], 165, 1e-6, "Y 15 is up");
  near(o.cm[0], 3, 1e-6, "30 mm shows as 3 cm"); assert.strictEqual(o.cm[1], "cm"); near(o.cmMoved, 50, 1e-6, "5 cm typed is 50 mm");
});

test("scaling: a side handle keeps the opposite side where it is, a corner handle the opposite corner", () => {
  const r = boot({ script: DOC + `
    app.setTool("transform_pattern");
    // pull the top handle up 50: the bottom stays, the top goes
    let h = handle("n"), to = { x: h.x, y: h.y - 50*S.view.s };
    app.drag(h.x, h.y, to.x, to.y); up(to);
    out.top = [box(), S.undo.length];
    // pull the right handle in to half the width: the left side stays
    h = handle("e"); to = { x: h.x - 150*S.view.s, y: h.y };
    app.drag(h.x, h.y, to.x, to.y); up(to);
    out.right = box();
    // the bottom right corner: the top left corner stays; both directions change
    h = handle("se"); to = { x: h.x + 150*S.view.s, y: h.y + 50*S.view.s };
    app.drag(h.x, h.y, to.x, to.y); up(to);
    out.corner = box();
    // Shift on a corner keeps the proportions
    h = handle("se"); to = { x: h.x + 300*S.view.s, y: h.y };
    S.shift = true; app.drag(h.x, h.y, to.x, to.y); up(to); S.shift = false;
    const b = box(); out.shift = [(b.x1 - b.x0)/(b.y1 - b.y0), b.x0, b.y0];
    // pressing a handle without dragging leaves no step
    const n = S.undo.length; h = handle("w"); app.fire("pointerdown", { x: h.x, y: h.y }); up(h); out.press = S.undo.length - n;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, bx = (b, x0, y0, x1, y1, m) => { near(b.x0, x0, 1e-6, m + " left"); near(b.y0, y0, 1e-6, m + " top"); near(b.x1, x1, 1e-6, m + " right"); near(b.y1, y1, 1e-6, m + " bottom"); };
  bx(o.top[0], 100, 50, 400, 300, "top handle"); assert.strictEqual(o.top[1], 1);
  bx(o.right, 100, 50, 250, 300, "right handle");
  bx(o.corner, 100, 50, 400, 350, "corner handle");
  near(o.shift[0], 1, 1e-6, "Shift: width and height by the same factor"); near(o.shift[1], 100, 1e-6); near(o.shift[2], 50, 1e-6, "still anchored at the top left");
  assert.strictEqual(o.press, 0);
});

test("right-click while scaling: the Transform dialog with Percentage and Dimension, linked, applied about the side that was staying", () => {
  const r = boot({ script: DOC + `
    app.setTool("transform_pattern");
    const h = handle("e"), to = { x: h.x + 30*S.view.s, y: h.y };
    app.drag(h.x, h.y, to.x, to.y);
    let seen = null;
    app.answer = (t, f, opts) => {
      seen = { t, f: f.map(x => [x.head || "", x.label, x.val, x.unit]), link: opts.checks[0].val };
      // what the dialog does as you type: a width of 450 with the link on
      seen.typedW = opts.sync({ pw: f[0].val, ph: f[1].val, w: 450, h: f[3].val, link: true }, "w");
      seen.unlinked = opts.sync({ pw: 50, ph: f[1].val, w: f[2].val, h: f[3].val, link: false }, "pw");
      return { pw: 150, ph: 100, w: f[2].val, h: f[3].val, link: false };
    };
    app.fire("contextmenu", { x: to.x, y: to.y });
    out.seen = seen; out.box = box(); out.undo = S.undo.length; out.tool = S.tool;
    // Scale… on the menu: about the middle; only a dimension typed
    app.answer = (t, f) => ({ pw: f[0].val, ph: f[1].val, w: f[2].val, h: 100, link: false });
    const m = at({ x: 300, y: 200 }); app.menuClick(m.x, m.y, "More ▸ Scale\\u2026");
    out.menu = box();
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, s = o.seen;
  assert.strictEqual(s.t, "Transform");
  assert.deepStrictEqual(s.f.map(x => x[0] + "|" + x[1] + "|" + x[3]), ["Percentage|Width|%", "|Height|%", "Dimension|Width|mm", "|Height|mm"]);
  near(s.f[0][2], 110, 1e-6, "dragged 30 wider: 110 %"); near(s.f[1][2], 100, 1e-6); near(s.f[2][2], 330, 1e-6); near(s.f[3][2], 200, 1e-6);
  assert.strictEqual(s.link, true, "linked to start with");
  near(s.typedW.pw, 150, 1e-9, "450 wide is 150 %"); near(s.typedW.ph, 150, 1e-9, "linked: the height follows"); near(s.typedW.h, 300, 1e-9);
  near(s.unlinked.w, 150, 1e-9, "50 % is 150 wide"); near(s.unlinked.ph, 100, 1e-9, "unlinked: the height is left alone");
  near(o.box.x0, 100, 1e-6, "the left side stayed, as in the drag"); near(o.box.x1, 550, 1e-6, "150 % of 300"); near(o.box.y1 - o.box.y0, 200, 1e-6);
  assert.strictEqual(o.undo, 1, "the drag was rolled back: one step for the typed scale"); assert.strictEqual(o.tool, "transform_pattern");
  near(o.menu.y1 - o.menu.y0, 100, 1e-6, "a height of 100 typed"); near((o.menu.y0 + o.menu.y1)/2, 200, 1e-6, "about the middle"); near(o.menu.x1 - o.menu.x0, 450, 1e-6);
});

test("the turning handle turns the selection about its middle; Shift in steps of 15 degrees; right-click types the angle", () => {
  const r = boot({ script: DOC + `
    app.setTool("transform_pattern");
    const c = at({ x: 250, y: 200 }), th = app.turnHandle(box());
    // from straight above the middle to straight right of it: a quarter turn clockwise
    app.drag(th.x, th.y, c.x + 200, c.y); up({ x: c.x + 200, y: c.y });
    out.quarter = [pts(), S.undo.length];
    const th2 = app.turnHandle(box());
    S.shift = true; app.drag(th2.x, th2.y, th2.x + 40, th2.y + 5); S.shift = false;
    out.step = S.drag.turned*180/Math.PI;
    let dlg = null; app.answer = (t, f) => { dlg = [t, f[0].val]; return { a: 90 }; };
    app.fire("contextmenu", { x: th2.x + 40, y: th2.y + 5 });
    out.dlg = dlg; out.typed = [pts(), S.undo.length];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  // (100,100) turned a quarter clockwise about (250,200) is (350,50)
  near(o.quarter[0][0][0], 350, 1e-6); near(o.quarter[0][0][1], 50, 1e-6); assert.strictEqual(o.quarter[1], 1);
  near(o.step/15, Math.round(o.step/15), 1e-9, "Shift turns in 15 degree steps: " + o.step);
  assert.strictEqual(o.dlg[0], "Rotate"); near(o.dlg[1], o.step, 0.01, "the angle turned so far is in the dialog");
  near(o.typed[0][0][0], 400, 1e-6, "another quarter: (350,50) goes to (400,300)"); near(o.typed[0][0][1], 300, 1e-6); assert.strictEqual(o.typed[1], 2);
});

/* ---------- Edit Pattern ---------- */
test("Edit Pattern, right-click while dragging a point: Moving Distance with the choice of line and its length; each field does what it says", () => {
  const r = boot({ script: DOC + `
    app.setTool("edit_pattern");
    const a = at({ x: 400, y: 300 }), b = at({ x: 430, y: 340 });
    let seen = [];
    const drag = () => { app.drag(a.x, a.y, b.x, b.y); };
    // 1: leave everything: the drag's own move is carried out
    drag(); app.answer = (t, f, o) => { seen.push({ t, f: f.map(x => [x.label, x.val]), sel: o.selects[0] }); return { d: f[0].val, x: f[1].val, y: f[2].val, len: f[3].val, line: "1" }; };
    app.fire("contextmenu", { x: b.x, y: b.y });
    out.same = [pts()[2], S.undo.length]; app.undo();
    // 2: a typed length of line 1 (the right side, which ends at this point): the point slides along it
    drag(); app.answer = (t, f) => ({ d: f[0].val, x: f[1].val, y: f[2].val, len: 150, line: "1" });
    app.fire("contextmenu", { x: b.x, y: b.y });
    out.len = [pts()[2], app.segLen(P(), 1)]; app.undo();
    // 3: line 2 chosen: the dialog comes back with that line's length
    drag(); let n = 0;
    app.answer = (t, f, o) => { n++; if (n === 1) { o.onSelect({ d: f[0].val, x: f[1].val, y: f[2].val, len: f[3].val, line: "2" }); return { d: f[0].val, x: f[1].val, y: f[2].val, len: f[3].val, line: "1" }; } seen.push({ second: f[3].val, sel: o.selects[0].val }); return { d: f[0].val, x: f[1].val, y: f[2].val, len: f[3].val, line: "2" }; };
    app.fire("contextmenu", { x: b.x, y: b.y });
    while (S.undo.length) app.undo();
    // 4: typed X and Y, from the point's menu (no drag)
    app.answer = (t, f) => ({ d: 0, x: 12, y: 5, len: f[3].val, line: "1" });
    app.menuClick(a.x, a.y, "More ▸ Moving Distance\\u2026");
    out.xy = pts()[2];
    out.seen = seen;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, s = o.seen[0];
  // (Round r30 / 1: the angle at the point can be typed too, so the dialog ends with an Angle field)
  assert.strictEqual(s.t, "Moving Distance"); assert.deepStrictEqual(s.f.map(x => x[0]), ["Distance Moved", "X-Axis", "Y-Axis", "Length", "Angle"]);
  near(s.f[0][1], 50, 1e-6); near(s.f[1][1], 30, 1e-6); near(s.f[2][1], -40, 1e-6);
  near(s.f[3][1], Math.hypot(30, 240), 1e-3, "the length of line 1 as it would be after the move");
  assert.deepStrictEqual(s.sel.options.map(x => x[0]), ["1", "2"]); assert.ok(/Line 1/.test(s.sel.options[0][1]) && /Line 2/.test(s.sel.options[1][1]));
  near(o.same[0][0], 430, 1e-6); near(o.same[0][1], 340, 1e-6); assert.strictEqual(o.same[1], 1);
  near(o.len[1], 150, 1e-6, "line 1 is 150 long"); assert.ok(o.len[0][1] < 300, "the point slid back along it");
  near(o.seen[1].second, Math.hypot(330, 40), 1e-3, "line 2 (the bottom edge) after the move"); assert.strictEqual(o.seen[1].sel, "2");
  near(o.xy[0], 412, 1e-6); near(o.xy[1], 295, 1e-6, "Y 5 is up");
});

test("Edit Pattern, right-click while dragging a segment: Moving Distance with what was dragged; a typed distance goes the same way", () => {
  const r = boot({ script: DOC + `
    app.setTool("edit_pattern");
    const a = at({ x: 250, y: 300 }), b = at({ x: 250, y: 330 });
    app.drag(a.x, a.y, b.x, b.y);
    out.live = [pts()[2][1], !!S.drag.orig];
    let dlg = null; app.answer = (t, f) => { dlg = [t, f.map(x => x.val)]; return { d: 45, x: f[1].val, y: f[2].val }; };
    app.fire("contextmenu", { x: b.x, y: b.y });
    out.dlg = dlg; out.pts = pts(); out.undo = S.undo.length;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  near(o.live[0], 330, 1e-6, "the segment follows the drag"); assert.strictEqual(o.live[1], true, "and the shape as it was is kept for the picture");
  assert.strictEqual(o.dlg[0], "Moving Distance"); near(o.dlg[1][0], 30, 1e-6); near(o.dlg[1][1], 0, 1e-6); near(o.dlg[1][2], -30, 1e-6);
  near(o.pts[2][1], 345, 1e-6, "45 down from where it was"); near(o.pts[3][1], 345, 1e-6); near(o.pts[0][1], 100, 1e-6, "the top edge stays"); assert.strictEqual(o.undo, 1);
});

/* ---------- Transform Point / Segment ---------- */
test("Transform Point/Segment: what moves with the selected points, and what only follows", () => {
  S.nextSegId = 1; S.nextId = 1;
  const p = mkPiece("P", rectShape(0, 0, 300, 200));
  setCurve(p, 0, true); p.segs[0].c1 = V(100, -60); p.segs[0].c2 = V(200, -60);      // the top: a handle curve
  insertCp(p, 1, 0.5); p.segs[1].cps[0].x = 340;                                      // the right side: a curve point
  setCurve(p, 3, true); p.segs[3].c1 = V(-40, 150); p.segs[3].c2 = V(-40, 50);        // the left side: a handle curve
  const orig = clone({ pts: p.pts, segs: p.segs, closed: true });
  assert.deepStrictEqual(tpsSegs(p, [0, 1]), [0]); assert.deepStrictEqual(tpsSegs(p, [0, 1, 2, 3]), [0, 1, 2, 3]); assert.deepStrictEqual(tpsSegs(p, [0, 2]), []);
  const b = tpsBox({ sh: p, idx: [0, 1] });
  near(b.y0, -45, 1e-6, "the box takes in the curve between two selected points (its crest is at -45)"); near(b.x1, 300, 1e-9);
  // move points 0 and 1 (the top edge) up by 50
  tpsApply(p, orig, [0, 1], (q) => add(q, V(0, -50)));
  samePt(p.pts[0], V(0, -50), 1e-12); samePt(p.pts[1], V(300, -50), 1e-12); samePt(p.pts[2], V(300, 200), 1e-12, "an unselected point stays"); samePt(p.pts[3], V(0, 200), 1e-12);
  samePt(p.segs[0].c1, V(100, -110), 1e-12, "the curve between two selected points goes with them");
  samePt(p.segs[1].cps[0], V(340, 100), 1e-12, "a curve point on an edge with one end selected stays"); samePt(segPt(p, 1, 0), p.pts[1], 1e-12, "and its curve runs to the moved end");
  samePt(p.segs[3].c2, V(-40, 0), 1e-12, "a handle at a selected end comes along"); samePt(p.segs[3].c1, V(-40, 150), 1e-12, "the handle at the other end stays");
  // applying again from the original does not add up
  tpsApply(p, orig, [0, 1], (q) => add(q, V(0, -10)));
  samePt(p.pts[0], V(0, -10), 1e-12); samePt(p.segs[3].c2, V(-40, 40), 1e-12);
  // the three kinds of drag as maps
  const mv = tpsMap({ mode: "move", dv: V(5, 7) }), sc = tpsMap({ mode: "scale", anchor: V(0, 200), fx: 2, fy: 0.5 }), ro = tpsMap({ mode: "rotate", c: V(100, 100), ang: Math.PI/2 });
  samePt(mv(V(1, 1)), V(6, 8), 1e-12); samePt(sc(V(100, 0)), V(200, 100), 1e-12, "scaled about the anchor"); samePt(ro(V(200, 100)), V(100, 200), 1e-9, "a quarter turn clockwise on screen");
  assert.ok(segLen(p, 1) > 0);
});

test("Transform Point/Segment in the booted app: select, add with Shift, move, scale from a side, turn, box-select; only the selection moves", () => {
  const r = boot({ script: DOC + `
    app.setTool("transform_point");
    // click the top edge: its two points are selected; pressing and letting go leaves no undo step
    let m = at({ x: 250, y: 100 }); app.click(m.x, m.y);
    out.seg = [S.tps.idx.slice(), S.undo.length];
    // Shift+click the bottom right point: three points
    m = at({ x: 400, y: 300 }); app.click(m.x, m.y, { shiftKey: true });
    out.three = S.tps.idx.slice().sort();
    // Shift+click it again: back to two
    app.click(m.x, m.y, { shiftKey: true }); out.two = S.tps.idx.slice().sort();
    // drag the top edge up 40: only its two points move
    let a = at({ x: 250, y: 100 }), b = at({ x: 250, y: 60 });
    app.drag(a.x, a.y, b.x, b.y); out.dragging = [S.drag.k, S.drag.mode, app.cv.style.cursor]; up(b);
    out.moved = [pts(), S.undo.length];
    // select all four by a box, then pull the right handle of their frame out by 100: the left side stays
    a = at({ x: 60, y: 20 }); b = at({ x: 450, y: 340 });
    app.fire("pointerdown", { x: a.x, y: a.y }); app.fire("pointermove", { x: b.x, y: b.y }); up(b);
    out.all = S.tps.idx.slice().sort();
    const fb = app.tpsBox(app.tpsSel()), h = app.handleScreen(fb, app.boxHandles(fb).find(x => x.id === "e")), to = { x: h.x + 100*S.view.s, y: h.y };
    app.drag(h.x, h.y, to.x, to.y); up(to);
    out.scaled = pts();
    // the right edge alone, turned a quarter about its middle with the handle; right-click types the angle instead
    m = at(app.segPt(P(), 1, 0.5)); app.click(m.x, m.y);
    const sb = app.tpsBox(app.tpsSel()), th = app.turnHandle(sb), c = at({ x: (sb.x0 + sb.x1)/2, y: (sb.y0 + sb.y1)/2 });
    app.drag(th.x, th.y, c.x + 150, c.y);
    let dlg = null; app.answer = (t, f) => { dlg = [t, f[0].val]; return { a: 90 }; };
    app.fire("contextmenu", { x: c.x + 150, y: c.y });
    out.dlg = dlg; out.turned = pts(); out.undo = S.undo.length;
    // since R4 a linked copy's points can be picked like any other pattern's
    S.sel = [P().id]; app.key("d", { ctrlKey: true });
    { const b = box(), c = at({ x: (b.x0 + b.x1)/2 + (b.x1 - b.x0) + 40, y: (b.y0 + b.y1)/2 }); app.click(c.x, c.y); }      // the copy hangs on the pointer: set it down beside the pattern
    app.setTool("transform_point");
    const copy = S.pieces[S.pieces.length - 1], k = at(copy.pts[0]); app.click(k.x, k.y);
    out.copy = [!!S.tps && S.tps.pid === copy.id, /Linked copy/.test(toasts[toasts.length - 1] || "")];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.seg, [[0, 1], 0]); assert.deepStrictEqual(o.three, [0, 1, 2]); assert.deepStrictEqual(o.two, [0, 1]);
  // (Round r19 / H03: over and while dragging a point, line or mark the pointer is the arrow with a four-way badge, an image with "move" as its fallback; it was the system's "move")
  assert.deepStrictEqual(o.dragging.slice(0, 2), ["tps", "move"]); assert.match(o.dragging[2], /^url[(].*, move$/);
  assert.deepStrictEqual(o.moved[0], [[100, 60], [400, 60], [400, 300], [100, 300]], "the top edge went up; the bottom stayed, the sides stretched"); assert.strictEqual(o.moved[1], 1);
  assert.deepStrictEqual(o.all, [0, 1, 2, 3]);
  assert.deepStrictEqual(o.scaled, [[100, 60], [500, 60], [500, 300], [100, 300]], "the right handle pulled out by 100: the left side stayed");
  assert.strictEqual(o.dlg[0], "Rotate"); near(o.dlg[1], 90, 0.5, "the quarter turn dragged so far");
  // the right edge (500,60)-(500,300) turned a quarter about its middle (500,180): level, from (620,180) to (380,180)
  near(o.turned[1][0], 620, 1e-6); near(o.turned[1][1], 180, 1e-6); near(o.turned[2][0], 380, 1e-6); near(o.turned[2][1], 180, 1e-6);
  assert.deepStrictEqual(o.turned[0], [100, 60], "the other points did not move"); assert.strictEqual(o.undo, 3);
  assert.deepStrictEqual(o.copy, [true, false]);
});

test("Transform Point/Segment: right-click while scaling opens the Transform dialog for the selection, and while moving Moving Distance", () => {
  const r = boot({ script: DOC + `
    app.setTool("transform_point");
    let m = at({ x: 250, y: 100 }); app.click(m.x, m.y); m = at({ x: 400, y: 200 }); app.click(m.x, m.y, { shiftKey: true });
    out.sel = S.tps.idx.slice().sort();
    const fb = app.tpsBox(app.tpsSel()), h = app.handleScreen(fb, app.boxHandles(fb).find(x => x.id === "s")), to = { x: h.x, y: h.y + 20*S.view.s };
    app.drag(h.x, h.y, to.x, to.y);
    let dlg = null; app.answer = (t, f) => { dlg = [t, f.map(x => x.val)]; return { pw: 100, ph: 50, w: f[2].val, h: f[3].val, link: false }; };
    app.fire("contextmenu", { x: to.x, y: to.y });
    out.dlg = dlg; out.scaled = pts(); out.undo = S.undo.length;
    // move by typing: 25 to the left
    const a = at({ x: 250, y: 100 }), b = at({ x: 240, y: 100 });
    app.drag(a.x, a.y, b.x, b.y);
    app.answer = (t, f) => { out.mdlg = [t, f[0].val]; return { d: 25, x: f[1].val, y: f[2].val }; };
    app.fire("contextmenu", { x: b.x, y: b.y });
    out.moved = pts();
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.sel, [0, 1, 2]);
  assert.strictEqual(o.dlg[0], "Transform"); near(o.dlg[1][1], 110, 1e-6, "the selection's box is 200 high; pulled 20 further: 110 %"); near(o.dlg[1][3], 220, 1e-6);
  assert.deepStrictEqual(o.scaled, [[100, 100], [400, 100], [400, 200], [100, 300]], "height to 50 % about the top: the selected bottom right point came up, the unselected one stayed");
  assert.strictEqual(o.undo, 1);
  assert.strictEqual(o.mdlg[0], "Moving Distance"); near(o.mdlg[1], 10, 1e-6);
  assert.deepStrictEqual(o.moved, [[75, 100], [375, 100], [375, 200], [100, 300]]);
});

module.exports = T;
