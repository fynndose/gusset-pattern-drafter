// Round r30: 2D editing fixes from the maintainer's user test. Batch 1 the angles (live while dragging, on internal lines, typed);
// the later batches add theirs below.
"use strict";
const FV = require("./harness").FILE_VERSION;      // (Round H1) this build's file version, read from the app's FILE_VERSION
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
// A: a rectangle 100..400 x 100..300 with an internal line from its top edge (250,100) down to (250,200) and on to (300,250);
// B: a rectangle off to the right; the view 1 : 1 at the origin
const DOC = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  const A = app.mkPiece("A", app.mkShape([{x:100,y:100},{x:400,y:100},{x:400,y:300},{x:100,y:300}], true));
  A.internals.push(app.mkShape([{x:250,y:100},{x:250,y:200},{x:300,y:250}], false));
  const B = app.mkPiece("B", app.mkShape([{x:700,y:100},{x:800,y:100},{x:800,y:200},{x:700,y:200}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const out = {}, up = (x, y, e) => app.fire("pointerup", { x, y, ...e });
  const texts = []; app.ev("ctx").fillText = (t) => texts.push(t);
  const frame = () => { texts.length = 0; app.draw(); return texts.filter(t => /^\\u2220/.test(t)); };
`;

/* ---------- Batch 1: angles ---------- */
test("r30 / 1: dragging a point writes the angle at it and at both neighbours every frame, from the shape as it is now", () => {
  const o = boot({ script: DOC + `
    app.setTool("edit_pattern");
    // A's corner (400,300) dragged to (450,300), not let go
    app.drag(400, 300, 450, 300);
    out.kind = S.drag && S.drag.k; out.mid = frame();
    app.fire("pointermove", { x: 500, y: 300 }); out.later = frame();
    up(500, 300);
    // with Angle shown and A selected: the pattern's own labels are the live ones, not the ghost's (the shape as it was)
    S.undo.length = 0; app.ev("setView")("angle", true); S.sel = [A.id];
    app.drag(400, 100, 380, 100); out.shown = frame(); up(380, 100);
    return out;` }).result;
  assert.strictEqual(o.kind, "pt");
  // at (450,300): to (400,100) and to (100,300): 75.96°; at (400,100): 104.04°; at (100,300) still 90
  assert.ok(o.mid.includes("∠76.0°") && o.mid.includes("∠104.0°") && o.mid.includes("∠90.0°"), JSON.stringify(o.mid));
  // (500,300): atan2(200, 100) = 63.43°, and 116.57° at (400,100)
  assert.ok(o.later.includes("∠63.4°") && o.later.includes("∠116.6°"), "the next frame has the new angles: " + JSON.stringify(o.later));
  assert.ok(!o.later.includes("∠76.0°"), "nothing of the frame before");
  // (380,100) with (500,300) moved before: the outline's four corners are written once each, none stale (no 90 at the moved corner)
  // (380,100) after (500,300): 59.04° at (500,300), 120.96° at (380,100); the two corners not moved 90, and the internal line's end 90 to the top edge
  assert.ok(o.shown.includes("∠59.0°") && o.shown.includes("∠121.0°"), JSON.stringify(o.shown));
  assert.strictEqual(o.shown.filter(t => t === "∠90.0°").length, 3, "no stale 90 at a moved corner: " + JSON.stringify(o.shown));
});
test("r30 / 1: internal lines show their angles (a corner of the line, its end on the outline against the outline) with Angle shown", () => {
  const o = boot({ script: DOC + `
    app.setTool("edit_pattern"); app.ev("setView")("angle", true); S.sel = [A.id];
    out.labels = frame();
    const pa = app.ev("pointAngle");
    out.corner = pa(A.internals[0], 1, A); out.edge = pa(A.internals[0], 0, A); out.free = pa(A.internals[0], 2, A);
    return out;` }).result;
  near(o.corner.deg, 135, 1e-6, "the bend of the internal line"); assert.strictEqual(o.corner.kind, "corner");
  assert.strictEqual(o.edge.kind, "edge"); near(o.edge.deg, 90, 1e-6, "square to the top edge");
  assert.strictEqual(o.free.kind, "level"); near(o.free.deg, 135, 1e-6, "the free end's line to level");
  assert.ok(o.labels.includes("∠135.0°") && o.labels.includes("∠90.0°") && o.labels.includes("∠135.0° to level"), JSON.stringify(o.labels));
});
test("r30 / 1: crowded angle labels are left out rather than written over each other; the halo setting is kept", () => {
  const o = boot({ script: DOC + `
    // a strip 30 by 2: the labels of its two left corners and of its two right corners would lie on each other
    const C = app.mkPiece("C", app.mkShape([{x:600,y:600},{x:630,y:600},{x:630,y:602},{x:600,y:602}], true));
    S.pieces.push(C); app.commit(); app.setTool("edit_pattern"); app.ev("setView")("angle", true); S.sel = [C.id];
    out.n = frame().length;
    const strokes = []; app.ev("ctx").strokeText = (t) => strokes.push(t);
    S.prefs.labelHalo = false; frame(); out.noHalo = strokes.filter(t => /^\\u2220/.test(t)).length;
    S.prefs.labelHalo = true; frame(); out.halo = strokes.filter(t => /^\\u2220/.test(t)).length;
    return out;` }).result;
  assert.strictEqual(o.n, 2, "two of the four labels on a 2 px strip");
  assert.strictEqual(o.noHalo, 0, "no halo when it is switched off"); assert.ok(o.halo > 0, "the halo when on");
});
test("r30 / 1: an angle typed moves the point: Line 1 keeps its length (or Line 2), a free end turns round its neighbour, an end on the outline slides along it; one undo step", () => {
  const o = boot({ script: DOC + `
    const pa = app.ev("pointAngle"), set = app.ev("setPointAngle"), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    // undo puts back new objects: the pattern and its line are found again each time
    const P = () => S.pieces.find(p => p.name === "A"), L = () => P().internals[0];
    // A's corner 2 (400,300) to 60°, Line 1 (from (400,100)) keeps its length 200
    out.ok1 = set(P(), 2, 60, "1"); out.a1 = pa(P(), 2, P()).deg; out.l1 = dist(P().pts[1], P().pts[2]); out.p3 = { ...P().pts[3] }; out.steps = S.undo.length;
    app.undo(); out.back = { ...P().pts[2] };
    // Line 2 (to (100,300)) keeps its length 300
    set(P(), 2, 120, "2"); out.a2 = pa(P(), 2, P()).deg; out.l2 = dist(P().pts[2], P().pts[3]); out.p1 = { ...P().pts[1] }; app.undo();
    // the internal line's free end to 90° to level: it turns round (250,200), 70.7 long
    set(L(), 2, 90, "1"); out.free = pa(L(), 2, P()).deg; out.freeLen = dist(L().pts[1], L().pts[2]); app.undo();
    // its end on the top edge to 60° to the outline: it slides along the edge, (250,200) staying
    set(L(), 0, 60, "1"); out.edge = pa(L(), 0, P()); out.edgeY = L().pts[0].y; out.kept = { ...L().pts[1] }; app.undo();
    // the Moving Distance dialog's Angle field does the same
    app.answer = (title, fields) => { out.fields = fields.map(f => f.k + ":" + f.label + ":" + f.val); return { d: 0, x: 0, y: 0, len: fields.find(f => f.k === "len").val, ang: 45, line: "1" }; };
    app.ev("ptMoveNumeric")({ x: 100, y: 100 }, P(), 2, { x: 0, y: 0 }); out.dlg = pa(P(), 2, P()).deg;
    // an angle no place gives: refused, nothing changed, no step
    app.undo(); const n = S.undo.length; out.none = set(L(), 0, 0.0001, "1"); out.noneSteps = S.undo.length - n;
    return out;` }).result;
  assert.strictEqual(o.ok1, true); near(o.a1, 60, 0.01); near(o.l1, 200, 1e-6, "Line 1 keeps its length"); assert.deepStrictEqual(o.p3, { x: 100, y: 300 }, "Line 2's far point stays");
  assert.strictEqual(o.steps, 1); assert.deepStrictEqual(o.back, { x: 400, y: 300 });
  near(o.a2, 120, 0.01); near(o.l2, 300, 1e-6, "Line 2 keeps its length"); assert.deepStrictEqual(o.p1, { x: 400, y: 100 });
  near(o.free, 90, 0.01); near(o.freeLen, Math.hypot(50, 50), 1e-6);
  assert.strictEqual(o.edge.kind, "edge"); near(o.edge.deg, 60, 0.01); near(o.edgeY, 100, 1e-6, "still on the edge"); assert.deepStrictEqual(o.kept, { x: 250, y: 200 });
  assert.ok(o.fields.some(f => /^ang:Angle:90$/.test(f)), JSON.stringify(o.fields)); near(o.dlg, 45, 0.01);
  assert.strictEqual(o.none, false); assert.strictEqual(o.noneSteps, 0);
});

/* ---------- Batch 2: curve points and handles ---------- */
// A with its top edge a curve through three curve points and its right edge a handle curve (as an older file has them)
const CURVES = DOC + `
  A.segs[0].curved = true; A.segs[0].cps = [{x:175,y:80},{x:250,y:70},{x:325,y:80}];
  A.segs[1].curved = true; A.segs[1].c1 = {x:430,y:150}; A.segs[1].c2 = {x:430,y:250};
  app.commit(); S.undo.length = 0;
  const P = () => S.pieces.find(p => p.name === "A");
`;
test("r30 / 2: Edit Curve Point: a box on empty space selects curve points, Shift+click adds or takes away, Delete removes them all in one step; with none left the line is straight", () => {
  const o = boot({ script: CURVES + `
    app.setTool("edit_curve_point"); S.sel = [A.id];
    // a box round the first two curve points (175,80) and (250,70)
    app.drag(160, 50, 260, 90); up(260, 90);
    out.box = S.selCps.map(e => e.c).sort(); out.boxSteps = S.undo.length;
    // Shift+click on the third adds it, Shift+click on the first takes it away
    app.fire("pointermove", { x: 325, y: 80 }); app.fire("pointerdown", { x: 325, y: 80, shiftKey: true }); up(325, 80, { shiftKey: true });
    app.fire("pointermove", { x: 175, y: 80 }); app.fire("pointerdown", { x: 175, y: 80, shiftKey: true }); up(175, 80, { shiftKey: true });
    out.shift = S.selCps.map(e => e.c).sort(); out.shiftSteps = S.undo.length;
    // all three again (a box round the whole edge) and Delete: one step, a straight line
    app.drag(160, 40, 340, 95); up(340, 95);
    out.all = S.selCps.length;
    app.key("Delete"); out.after = [P().segs[0].curved, P().segs[0].cps, P().segs[0].c1, P().segs[0].e0]; out.delSteps = S.undo.length;
    app.undo(); out.back = P().segs[0].cps.length;
    return out;` }).result;
  assert.deepStrictEqual(o.box, [0, 1]); assert.strictEqual(o.boxSteps, 0, "selecting makes no step");
  assert.deepStrictEqual(o.shift, [1, 2]); assert.strictEqual(o.shiftSteps, 0);
  assert.strictEqual(o.all, 3);
  assert.deepStrictEqual(o.after, [false, null, null, null], "straight, no curvature left: " + JSON.stringify(o)); assert.strictEqual(o.delSteps, 1);
  assert.strictEqual(o.back, 3, "undo brings all three back");
});
test("r30 / 2: no new curve handles: an ellipse, Smooth Curve's corner and an Edit Curvature bend are curve points; a curve-point curve split where it has none keeps none", () => {
  const o = boot({ script: CURVES + `
    const handles = (sh) => sh.segs.filter(g => g.curved && !(g.cps && g.cps.length)).length;
    // the Ellipse tool, dragged on empty space
    app.setTool("ellipse"); app.drag(500, 500, 600, 560); up(600, 560); out.ellipse = handles(S.pieces[S.pieces.length - 1]);
    out.ellipseName = S.pieces[S.pieces.length - 1].name;
    app.ev("smoothPoint")(P(), 3); out.smooth = handles(P()) - 1;      // A's handle edge (1) is the file's own
    // Edit Curvature on B's straight top edge
    app.setTool("edit_curvature"); app.drag(750, 100, 750, 130); up(750, 130);
    const Bp = S.pieces.find(p => p.name === "B"); out.bend = [Bp.segs[0].curved, handles(Bp)];
    // Add Point on A's top edge between its first curve point and the corner: the short half has no curve point
    app.setTool("add_point"); app.fire("pointermove", { x: 130, y: 92 }); app.fire("pointerdown", { x: 130, y: 92 }); up(130, 92);
    out.split = handles(P()) - 1;
    return out;` }).result;
  assert.ok(/^Ellipse/.test(o.ellipseName), o.ellipseName); assert.strictEqual(o.ellipse, 0); assert.strictEqual(o.smooth, 0);
  assert.deepStrictEqual(o.bend, [true, 0]); assert.strictEqual(o.split, 0);
});
test("r30 / 2: a curve handle of an older document: dragged onto its own point, or selected and deleted, it is taken away (both gone: straight); otherwise the file is untouched", () => {
  const o = boot({ script: CURVES + `
    out.kept = [P().segs[1].c1, P().segs[1].c2];
    app.setTool("edit_curve_point"); S.sel = [A.id];
    // the handle at (430,150) dragged to (403,104), within the catch of its point (400,100)
    app.fire("pointermove", { x: 430, y: 150 }); out.hover = S.hover && S.hover.k;
    app.drag(430, 150, 403, 104); up(403, 104);
    out.drop = [P().segs[1].curved, P().segs[1].c1, S.undo.length];
    out.shown = app.ev("handleShown")(P(), 1, "c1");
    // the other one: clicked (selected) and deleted
    app.fire("pointermove", { x: 430, y: 250 }); app.fire("pointerdown", { x: 430, y: 250 }); up(430, 250);
    out.sel = !!app.ev("selHandle")(); out.clickSteps = S.undo.length;
    app.key("Delete"); out.del = [P().segs[1].curved, P().segs[1].c1, P().segs[1].c2, S.undo.length];
    return out;` }).result;
  assert.deepStrictEqual(o.kept, [{ x: 430, y: 150 }, { x: 430, y: 250 }], "nothing converts an older file's handles");
  assert.strictEqual(o.hover, "handle");
  assert.deepStrictEqual(o.drop, [true, { x: 400, y: 100 }, 1], "taken away: it lies on its point"); assert.strictEqual(o.shown, false);
  assert.strictEqual(o.sel, true); assert.strictEqual(o.clickSteps, 1, "a click that only selects makes no step");
  assert.deepStrictEqual(o.del, [false, null, null, 2], "both gone: a straight line");
});

/* ---------- Batch 3: the order of patterns ---------- */
// three overlapping squares in list order X, Y, Z (Z on top)
const STACK = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  for (const [n, x] of [["X", 100], ["Y", 150], ["Z", 200]]) S.pieces.push(app.mkPiece(n, app.mkShape([{x,y:100},{x:x+200,y:100},{x:x+200,y:300},{x,y:300}], true)));
  S.sel = []; app.commit(); S.undo.length = 0; app.setTool("transform_pattern");
  const out = {}, order = () => app.ev("stack")().map(p => p.name).join(""), id = (n) => S.pieces.find(p => p.name === n).id;
  // a key as a German keyboard sends it: the bracket keys give Ü / + (Shift: * for +), the code is the key's place
  const de = (code, shift) => app.key(code === "BracketLeft" ? (shift ? "Ü" : "ü") : (shift ? "*" : "+"), { code, ctrlKey: true, shiftKey: !!shift });
`;
test("r30 / 3: a click that selects a pattern never changes the stacking; the order keys go by the keys' place (a German keyboard's Ü and +), one step each, undone and saved", () => {
  const o = boot({ script: STACK + `
    app.click(160, 200); out.sel = S.sel.length; out.afterClick = order(); out.pick = app.ev("pieceAt")(260, 200).name;
    S.sel = [id("X")];
    de("BracketRight"); out.fwd = order();
    de("BracketRight", true); out.front = order();
    de("BracketLeft"); out.bwd = order();
    de("BracketLeft", true); out.back = order(); out.steps = S.undo.length;
    app.undo(); out.undone = order();
    // a US keyboard's Ctrl+] (key "]") and Ctrl+Shift+] (key "}") do the same
    app.key("]", { code: "BracketRight", ctrlKey: true }); out.us = order();
    app.key("}", { code: "BracketRight", ctrlKey: true, shiftKey: true }); out.usFront = order();
    // the order is the document's: saved and read back
    const doc = JSON.parse(app.ev("docJSON")()); out.saved = (doc.pieces || (doc.doc && doc.doc.pieces) || []).map(p => p.name).join("");
    // + alone still zooms (no Ctrl: the key is read as it is)
    const s0 = S.view.s; app.key("+", { code: "BracketRight" }); out.zoomed = S.view.s > s0;
    // the keys are shown in the pattern's Order menu
    const rows = app.ev("ORDER").map(([k]) => app.ev("keyOf")("order:" + k)); out.keys = rows;
    return out;` }).result;
  assert.strictEqual(o.sel, 1); assert.strictEqual(o.afterClick, "XYZ", "selecting X left it under Y and Z"); assert.strictEqual(o.pick, "Z", "the click goes to the one on top");
  assert.strictEqual(o.fwd, "YXZ"); assert.strictEqual(o.front, "YZX"); assert.strictEqual(o.bwd, "YXZ"); assert.strictEqual(o.back, "XYZ");
  assert.strictEqual(o.steps, 4); assert.strictEqual(o.undone, "YXZ");
  assert.strictEqual(o.us, "YZX"); assert.strictEqual(o.usFront, "YZX", "already in front");
  assert.strictEqual(o.saved, "YZX"); assert.strictEqual(o.zoomed, true);
  assert.deepStrictEqual(o.keys, ["Ctrl+]", "Ctrl+Shift+]", "Ctrl+[", "Ctrl+Shift+["]);
});
test("r30 / 3: Ctrl+[ and Ctrl+] are Superimpose only with the pointer over the 3D window; no other row of the key table has the order keys", () => {
  const o = boot({ script: STACK + `
    const T = app.ev("keyTable")(), same = (k) => T.filter(r => r.k === k).map(r => r.id + ":" + r.w);
    out.rows = ["Ctrl+[", "Ctrl+]", "Ctrl+Shift+[", "Ctrl+Shift+]"].map(same);
    S.over3d = true; S.sel = [id("X")]; const f = app.ev("keyFind"); out.over3 = f({ key: "ü", code: "BracketLeft", ctrlKey: true }).id;
    S.over3d = false; out.over2 = f({ key: "ü", code: "BracketLeft", ctrlKey: true }).id;
    return out;` }).result;
  assert.deepStrictEqual(o.rows, [["superOver:3d", "order:backward:draft"], ["superUnder:3d", "order:forward:draft"], ["order:back:draft"], ["order:front:draft"]]);
  assert.strictEqual(o.over3, "superOver"); assert.strictEqual(o.over2, "order:backward");
});

/* ---------- Batch 4: symmetric sewing ---------- */
// F and its Symmetric Pattern copy F2; K and its copy K2; U an unfolded back (its mirrored half's lines are half.map's).
// sew(a, b): what a sewing tool does, push, a seam, commit
const SYM = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  const sq = (n, x) => app.mkPiece(n, app.mkShape([{x,y:0},{x:x+200,y:0},{x:x+220,y:300},{x,y:300}], true));
  const F = sq("F", 0), K = sq("K", 600); S.pieces.push(F, K); app.commit();
  const F2 = app.ev("mkLinked")(F, "symmetric", [-1, 0, 0, 1, -40, 0]); F2.name = "F2"; S.pieces.push(F2);
  const K2 = app.ev("mkLinked")(K, "symmetric", [-1, 0, 0, 1, 1240, 0]); K2.name = "K2"; S.pieces.push(K2);
  const half = sq("H", 1000), U = app.ev("unfold")(half, 3); U.name = "U"; S.pieces.push(U);
  app.commit(); S.undo.length = 0; S.redo.length = 0;
  const out = {}, part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  const sew = (a, b) => { app.push(); const sm = app.ev("makeSeam")(S.seams, [a], [b]); S.seams.push(sm); app.commit(); return sm; };
  const named = () => S.seams.map(sm => [sm.a, sm.b].map(side => side.map(q => S.pieces.find(p => p.id === q.piece).name).join("+")).join("-") + (sm.mir !== undefined ? "~" + sm.mir : "")).sort();
`;
test("r30 / 4: a seam made on one side of a symmetric pair is made on the other, tied; changing or deleting one changes or deletes the other; one undo step each", () => {
  const o = boot({ script: SYM + `
    app.setTool("segment_sewing");
    const sm = sew(part(F, 1), part(K, 3, true));
    out.made = named(); out.steps = S.undo.length;
    const m = S.seams.find(x => x.id === sm.mir);
    out.mirror = [m.a[0].piece === F2.id, m.b[0].piece === K2.id, m.a[0].sids[0] === F.segs[1].id, m.b[0].rev];
    // the lengths match the original's (the copies are mirror images)
    const inf = (x) => app.ev("seamInfo")(x, S.pieces); out.len = [inf(sm).la, inf(m).la, inf(sm).lb, inf(m).lb].map(v => +v.toFixed(6));
    // changed on one side (shortened, deactivated): the other follows, in the same step
    app.setTool("edit_sewing");
    app.push(); sm.a[0].t1 = 0.5; sm.off = true; app.commit();
    out.changed = [m.a[0].t1, m.off, S.undo.length];
    // deleted on one side: both go; undo brings both back
    app.ev("deleteSewing")(S.seams.find(x => x.id === m.id)); out.deleted = [S.seams.length, S.undo.length];
    app.undo(); out.back = named();
    // undo of the making takes both away at once
    app.undo(); app.undo(); out.unmade = S.seams.length;
    return out;` }).result;
  assert.strictEqual(o.made.length, 2); assert.ok(o.made.every(t => /~[0-9]+$/.test(t)), JSON.stringify(o.made)); assert.strictEqual(o.steps, 1);
  assert.deepStrictEqual(o.mirror, [true, true, true, true]);
  assert.strictEqual(o.len[0], o.len[1]); assert.strictEqual(o.len[2], o.len[3]);
  assert.deepStrictEqual(o.changed, [0.5, true, 2]);
  assert.deepStrictEqual(o.deleted, [0, 3]); assert.strictEqual(o.back.length, 2); assert.strictEqual(o.unmade, 0);
});
test("r30 / 4: an unfolded pattern's mirrored half is sewn too (its lines run the other way); a seam whose parts can't all be mirrored is left alone; Unlink Symmetric Sewing unties a pair", () => {
  const o = boot({ script: SYM + `
    app.setTool("free_sewing");
    // F's side to U's first line, which lies on the half kept: mirrored to F2 and U's mirrored half
    const sm = sew(part(F, 1), part(U, 0, true)), m = S.seams.find(x => x.id === sm.mir);
    out.unfold = m && [S.pieces.find(p => p.id === m.b[0].piece).name, U.half.map[U.segs[0].id] === m.b[0].sids[0], m.b[0].rev];
    const inf = (x) => app.ev("seamInfo")(x, S.pieces); out.len = m && [+inf(sm).lb.toFixed(6), +inf(m).lb.toFixed(6)];
    // F to a plain pattern: nothing to mirror onto
    const P = app.mkPiece("P", app.mkShape([{x:0,y:600},{x:100,y:600},{x:100,y:700},{x:0,y:700}], true)); app.push(); S.pieces.push(P); app.commit();
    const lone = sew(part(F, 3), part(P, 1, true)); out.lone = [lone.mir, S.seams.length];
    // untied: both stay; deleting one leaves the other
    app.setTool("edit_sewing"); app.ev("unlinkSymSewing")(sm); out.untied = [sm.mir, m.mir, S.seams.length];
    app.ev("deleteSewing")(sm); out.after = S.seams.length;
    // a seam made with no sewing tool in hand (a file's, an import's) is not mirrored
    app.setTool("edit_pattern"); sew(part(F, 0), part(K, 0, true)); out.noTool = S.seams.length;
    return out;` }).result;
  assert.deepStrictEqual(o.unfold, ["U", true, false]); assert.strictEqual(o.len[0], o.len[1]);
  assert.deepStrictEqual(o.lone, [null, 3], "no tie; the pair and the lone seam");      // (JSON: no mir comes back as null)
  assert.deepStrictEqual(o.untied, [null, null, 3]);
  assert.strictEqual(o.after, 2); assert.strictEqual(o.noTool, 3);
});
test("r30 / 4: a version 27 file with sewing on one side of a symmetric pair opens unchanged; it is saved as version 28 with nothing added until a seam is made", () => {
  const fs = require("fs");
  const bytes = Array.from(fs.readFileSync(path.join(__dirname, "files", "v27", "symmetric-sewing-history.pdraft")));
  const o = boot({ blank: true, script: `
    const out = {};
    app.ev("openFile")("old.pdraft", new Uint8Array(${JSON.stringify(bytes)}), null, true);
    out.seams = S.seams.map(sm => [sm.a.length, sm.b.length, sm.mir === undefined]);
    // an edit elsewhere (a point moved) changes no sewing
    app.setTool("edit_pattern"); app.push(); S.pieces[1].pts[0].x += 5; app.commit(); out.after = S.seams.length;
    let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null);
    const doc = app.fileDoc(got);
    out.v = doc.v; out.mir = (doc.seams || []).filter(sm => sm.mir !== undefined).length;
    return out;` }).result;
  assert.deepStrictEqual(o.seams, [[1, 1, true]]); assert.strictEqual(o.after, 1);
  assert.strictEqual(o.v, FV); assert.strictEqual(o.mir, 0);      // (Round H1: this build's version read from the app, FV) ((Round H1a: version 31) (Round r34: version 30) (Round r33b: version 29)
});

/* ---------- Batch 5: Trace ▸ Cut, Cut & Sew, Convert to Hole ---------- */
test("r30 / 5: Trace, Shape mode: a right-click on an internal line gives Cut and Cut & Sew; on a closed internal shape Convert to Hole, a real hole (no cloth in 2D or 3D)", () => {
  const o = boot({ script: `
    S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
    const A = app.mkPiece("A", app.mkShape([{x:100,y:100},{x:500,y:100},{x:500,y:400},{x:100,y:400}], true));
    A.internals.push(app.mkShape([{x:300,y:100},{x:300,y:400}], false));                                      // an open line right across
    A.internals.push(app.mkShape([{x:150,y:150},{x:250,y:150},{x:250,y:250},{x:150,y:250}], true));            // a closed shape
    S.pieces.push(A); app.commit(); S.undo.length = 0;
    const out = {}, rows = () => app.menu.children.map(c => String(c.innerHTML).replace(/<[^>]+>/g, "|").split("|").filter(Boolean)[0]).filter(Boolean);
    app.setTool("trace"); app.ev("setTraceMode")("shape");
    const area0 = app.ev("clothArea")(A), tri0 = app.ev("pieceMesh3")(A, 20).tri.length;
    // the closed shape: Convert to Hole
    app.menu.children.length = 0; app.showMenu({ clientX: 200, clientY: 150 }); out.shapeRows = rows();
    app.menuClick(200, 150, "Convert to Hole");
    const B = S.pieces.find(p => p.name === "A");
    out.hole = [B.internals[1].hole === true, +(area0 - app.ev("clothArea")(B)).toFixed(3), app.ev("pieceMesh3")(B, 20).tri.length < tri0, S.undo.length];
    // the open line: Cut & Sew
    app.menu.children.length = 0; app.showMenu({ clientX: 300, clientY: 330 }); out.lineRows = rows();
    app.menuClick(300, 330, "Cut & Sew");
    out.cut = [S.pieces.length, S.seams.length, S.undo.length];
    return out;` }).result;
  assert.ok(o.shapeRows.includes("Convert to Hole") && o.shapeRows.includes("Trace as a Pattern"), JSON.stringify(o.shapeRows));
  assert.deepStrictEqual(o.hole, [true, 10000, true, 1], "a 100 x 100 hole: that much less cloth, fewer triangles, one step");
  assert.ok(o.lineRows.includes("Cut") && o.lineRows.includes("Cut & Sew"), JSON.stringify(o.lineRows));
  assert.deepStrictEqual(o.cut, [2, 1, 2], "cut in two and sewn, one more step");
});

/* ---------- Batch 6: Ctrl follows the line ---------- */
test("r30 / 6: Edit Pattern, Ctrl while dragging a point: it moves along its own line (the extension of a straight line, a curve's direction at that end), never a diagonal; a thin guide line; Shift as before", () => {
  const o = boot({ script: DOC + `
    app.setTool("edit_pattern");
    const P = () => S.pieces.find(p => p.name === "A");
    const cdrag = (x0, y0, x1, y1) => { const e = { ctrlKey: true }; app.fire("pointermove", { x: x0, y: y0, ...e }); app.fire("pointerdown", { x: x0, y: y0, ...e }); app.fire("pointermove", { x: (x0+x1)/2, y: (y0+y1)/2, ...e }); app.fire("pointermove", { x: x1, y: y1, ...e }); };
    // A's corner (400,300) dragged 50 right and 30 down: the bottom edge's extension (the motion is nearer level), not the diagonal
    cdrag(400, 300, 450, 330); out.pt = { ...P().pts[2] };
    // the guide is drawn for the one line followed (d.onLine), thin and solid
    out.ctrl = S.drag.ctrl; out.onLine = S.drag.onLine;
    app.fire("pointerup", { x: 450, y: 330, ctrlKey: true }); out.steps = S.undo.length; app.undo();
    // turned toward the other line: it goes over to that one (down the right edge)
    cdrag(400, 300, 410, 360); out.pt2 = { ...P().pts[2] }; app.fire("pointerup", { x: 410, y: 360, ctrlKey: true }); app.undo();
    // the internal line's free end (300,250) follows its own line's direction (45 degrees down to the right)
    cdrag(300, 250, 340, 270); const L = P().internals[0]; out.end = { ...L.pts[2] }; app.fire("pointerup", { x: 340, y: 270, ctrlKey: true }); app.undo();
    // a curved line: its end moves along the curve's direction at that end
    app.push(); P().segs[0].curved = true; P().segs[0].cps = [{ x: 250, y: 60 }]; app.commit();
    const dir = app.ev("segTan")(P(), 0, 1);
    cdrag(400, 100, 440, 140); const q = P().pts[1]; out.curve = [q.x - 400, q.y - 100, dir.x, dir.y];
    app.fire("pointerup", { x: 440, y: 140, ctrlKey: true });
    return out;` }).result;
  assert.deepStrictEqual(o.pt, { x: 450, y: 300 }, "along the bottom edge's extension: the edge keeps its angle");
  assert.strictEqual(o.ctrl, true); assert.ok(o.onLine === 0 || o.onLine === 1);
  assert.strictEqual(o.steps, 1);
  assert.deepStrictEqual(o.pt2, { x: 400, y: 360 }, "down the right edge's extension");
  near(o.end.x - 300, o.end.y - 250, 1e-9, "on the 45 degree line"); near(o.end.x, 330, 1e-9);
  // the move is along the curve's end direction: the cross product of the move and that direction is 0
  near(o.curve[0]*o.curve[3] - o.curve[1]*o.curve[2], 0, 1e-6, "along the curve's direction at its end"); assert.ok(Math.hypot(o.curve[0], o.curve[1]) > 10);
});

module.exports = T;
