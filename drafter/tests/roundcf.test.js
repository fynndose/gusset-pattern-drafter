// Round CF: the fixes from the maintainer's check of every guess against the other program. A test (or more) a batch.
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

/* ---------- CF1 ---------- */
test("CF1: the marquee is a plain dashed box with no words when Ctrl is held; a rectangle dragged with Ctrl held is drawn from its centre, and letting Ctrl go mid-drag draws it from the corner again", () => {
  const o = boot({ blank: true, script: `
    const out = {}, W = (x, y) => app.ev("toW")(x, y), bb = (p) => { const xs = p.pts.map(q => q.x), ys = p.pts.map(q => q.y); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(v => +v.toFixed(3)); };
    // the marquee's words: none with Ctrl
    const tags = []; const tg = app.ev("tag"); app.ev("(f) => { tag = f; }")((t, p) => { tags.push(t); });
    S.tool = "transform_pattern"; S.marquee = { a: { x: 10, y: 10 }, b: { x: 80, y: 60 }, touch: true }; app.draw(); out.ctrlTags = tags.slice();
    tags.length = 0; S.marquee.touch = false; app.draw(); out.plainTags = tags.slice(); S.marquee = null;
    app.ev("(f) => { tag = f; }")(tg);
    // Ctrl held all the way: from the centre
    app.setTool("rectangle");
    app.fire("pointermove", { x: 300, y: 300 }); app.fire("pointerdown", { x: 300, y: 300, ctrlKey: true });
    app.fire("pointermove", { x: 340, y: 330, ctrlKey: true }); app.fire("pointerup", { x: 340, y: 330, ctrlKey: true });
    const c = W(300, 300), e = W(340, 330);
    out.ctr = bb(S.pieces[0]); out.want = [2*c.x - e.x, 2*c.y - e.y, e.x, e.y].map(v => +v.toFixed(3));
    // Ctrl pressed, then let go before the button: from the corner
    app.setTool("rectangle");
    app.fire("pointermove", { x: 500, y: 300 }); app.fire("pointerdown", { x: 500, y: 300 });
    app.fire("pointermove", { x: 540, y: 330, ctrlKey: true }); out.midCtr = !!S.draft.ctr;
    app.winFire("keyup", { key: "Control" }); out.afterUp = !!S.draft.ctr;
    app.key("Control"); out.afterDown = !!S.draft.ctr; app.winFire("keyup", { key: "Control" });
    app.fire("pointerup", { x: 540, y: 330 });
    const a2 = W(500, 300), b2 = W(540, 330);
    out.corner = bb(S.pieces[1]); out.want2 = [a2.x, a2.y, b2.x, b2.y].map(v => +v.toFixed(3));
    out.n = S.pieces.length; out.steps = app.histSteps().steps.length;
    return out;` }).result;
  assert.deepStrictEqual(o.ctrlTags, [], "no words on the marquee with Ctrl");
  assert.strictEqual(o.plainTags.length, 1, "without Ctrl the recorded tip stays");
  assert.deepStrictEqual(o.ctr, o.want, "drawn from the centre");
  assert.strictEqual(o.midCtr, true); assert.strictEqual(o.afterUp, false, "Ctrl let go: from the corner again, at once"); assert.strictEqual(o.afterDown, true, "and back");
  assert.deepStrictEqual(o.corner, o.want2, "drawn from the corner");
  assert.strictEqual(o.n, 2);
});

/* ---------- CF2 ---------- */
test("CF2: drawing snaps to a pattern point (square), the middle of a line (triangle), an edge (cross), straight across or up and down from the last point (H / V, the rubber band solid), and the x or y of an earlier point (dotted); a polygon drawn by hand closes into an exact rectangle", () => {
  const o = boot({ blank: true, script: `
    const out = {}, W = (x, y) => app.ev("toW")(x, y), snap = app.ev("drawSnap"), mk = () => ({ ...S.snapMark, line: undefined });
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; app.commit();
    const px = 1/S.view.s;
    out.pt = [snap({ x: 200 + 3*px, y: -2*px }), mk()];
    out.mid = [snap({ x: 100 + 5*px, y: 3*px }), mk()];
    out.edge = [snap({ x: 150, y: 100 + 4*px }), mk()];
    out.far = [snap({ x: 150, y: 140 }), mk()];
    out.h = [snap({ x: 400, y: 300 + 4*px }, { x: 300, y: 300 }), mk()];
    out.v = [snap({ x: 300 - 3*px, y: 400 }, { x: 300, y: 300 }), mk()];
    // the fourth corner of a rectangle: straight up from the last point and level with the first
    out.close = [snap({ x: 300 + 4*px, y: 500 - 3*px }, { x: 450, y: 500 }, { pts: [{ x: 300, y: 300 }, { x: 450, y: 300 }, { x: 450, y: 500 }] }), mk()];
    // along H onto the edge of the pattern: where the two cross
    out.hEdge = [snap({ x: -3*px, y: 30 + 4*px }, { x: -100, y: 30 }), mk()];
    // Snap to Pattern off: no points, middles or edges
    S.prefs.snapPts = false; out.off = [snap({ x: 200 + 3*px, y: -2*px }), mk()]; S.prefs.snapPts = true;
    // by hand: four clicks a few pixels off, the fifth on the first point
    app.setTool("polygon");
    const c = [[600, 200], [760, 203], [757, 330], [602, 327], [601, 201]];
    for (const [x, y] of c) { app.fire("pointermove", { x, y }); app.fire("pointerdown", { x, y }); app.fire("pointerup", { x, y }); }
    const p = S.pieces[S.pieces.length - 1], a = W(600, 200);
    out.hand = p.pts.map(q => [+(q.x - a.x).toFixed(6), +(q.y - a.y).toFixed(6)]);
    out.n = S.pieces.length;
    return out;` }).result;
  const xy = (r) => [+r[0].x.toFixed(6), +r[0].y.toFixed(6)];
  assert.deepStrictEqual(xy(o.pt), [200, 0]); assert.strictEqual(o.pt[1].kind, "pt");
  assert.deepStrictEqual(xy(o.mid), [100, 0]); assert.strictEqual(o.mid[1].kind, "mid");
  assert.strictEqual(o.edge[1].kind, "edge", JSON.stringify(o.edge)); near(o.edge[0].y, 100, 1e-6); near(o.edge[0].x, 150, 1e-6);
  assert.strictEqual(o.far[1].kind, null); assert.deepStrictEqual(xy(o.far), [150, 140]);
  assert.strictEqual(o.h[1].hv, "h"); near(o.h[0].y, 300, 1e-9);
  assert.strictEqual(o.v[1].hv, "v"); near(o.v[0].x, 300, 1e-9);
  assert.deepStrictEqual(xy(o.close), [300, 500], "straight up from the last and level with the first: x of the first corner");
  assert.strictEqual(o.close[1].hv, "h"); assert.strictEqual(o.close[1].align.length, 1);
  assert.deepStrictEqual(xy(o.hEdge), [0, 30], "along H onto the edge"); assert.strictEqual(o.hEdge[1].kind, "edge");
  assert.strictEqual(o.off[1].kind, null);
  assert.strictEqual(o.n, 2);
  const [w, h] = [o.hand[1][0], o.hand[2][1]];
  assert.deepStrictEqual(o.hand, [[0, 0], [w, 0], [w, h], [0, h]], "an exact rectangle from clicks a few pixels off");
});

/* ---------- CF3 ---------- */
test("CF3 / E5: Convert to Curve Point ▸ Maintain Curve on a rectangle's corner keeps the shape: curve points are added until the curve is within 0.1 mm of the two lines both ways (checked here point by point), and the toast says how close", () => {
  const o = boot({ blank: true, script: `
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; app.commit();
    app.setTool("edit_pattern");
    const c = app.toS({ x: 200, y: 0 }); app.menuClick(c.x, c.y, "Convert to Curve Point ▸ Maintain Curve", "edit_pattern");
    const sh = S.pieces[0];
    const dl = (q) => Math.min(Math.hypot(Math.max(0, Math.min(200, q.x)) - q.x, q.y), Math.hypot(200 - q.x, Math.max(0, Math.min(100, q.y)) - q.y));
    let w1 = 0; const N = []; for (let k = 0; k <= 20000; k++) { const q = app.segPt(sh, 0, k/20000); N.push(q); w1 = Math.max(w1, dl(q)); }
    let w2 = 0; for (let k = 0; k <= 1500; k++) { const d = k/5, q = d <= 200 ? { x: d, y: 0 } : { x: 200, y: d - 200 }; let b = 1e9; for (const p of N) { const e = Math.hypot(p.x - q.x, p.y - q.y); if (e < b) b = e; } w2 = Math.max(w2, b); }
    return { pts: sh.pts.length, cps: sh.segs[0].cps.length, w1, w2, toast: toasts[toasts.length - 1], steps: app.histSteps().steps.length };` }).result;
  assert.strictEqual(o.pts, 3, "the corner is gone");
  assert.ok(o.cps > 5, "curve points added: " + o.cps);
  assert.ok(o.w1 < 0.1, "the curve is within 0.1 mm of the old lines: " + o.w1);
  assert.ok(o.w2 < 0.1, "the old lines are within 0.1 mm of the curve: " + o.w2);
  assert.ok(/at most 0[.]0[0-9]* mm/.test(o.toast), o.toast);
  assert.strictEqual(o.steps, 1, "one undo step");
});

test("CF3 / C3, E1, E2: the middle catch takes the click from 9 px off the line and over a dart at the middle; Current measures from the end nearer the pointer when the menu opened, also when the middle was caught; Edit Curve Point's right-click on a straight line offers Split Curve", () => {
  const o = boot({ blank: true, script: `
    const out = {};
    const mk = () => { S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; app.commit(); };
    mk(); app.setTool("add_point");
    // 9 px above the middle of the top line, 3 px along: out of reach of the line itself (6 px), within the catch (10 px)
    let q = app.toS({ x: 100, y: 0 }); app.click(q.x + 3, q.y - 9);
    out.off = S.pieces[0].pts.map(p => [+p.x.toFixed(6), +p.y.toFixed(6)]);
    // a dart at the middle of the bottom line: its centre lies at the middle, the click still splits the line there
    mk(); app.ev("addDartTo")(S.pieces[0], 2, 0.5, 20, 60, false); app.commit();
    q = app.toS({ x: 100, y: 100 }); app.setTool("add_point"); app.click(q.x + 2, q.y + 1);
    out.dart = S.pieces[0].pts.map(p => [+p.x.toFixed(6), +p.y.toFixed(6)]);
    // the right-click: the middle caught, the pointer a little right of it on the top line → Current from the right end
    mk(); app.setTool("add_point");
    app.answer = (t, f, op) => { out.l1 = f.find(x => x.k === "l1").val; out.cur = op.preview({ by: "length", s: 30, n: 2, dir: "current", l1: 1, r1: 0, l2: 0, r2: 0, u: 2 }).filter(x => x.ring).map(x => Math.round(x.ring.x)); return null; };
    q = app.toS({ x: 100, y: 0 }); app.fire("contextmenu", { x: q.x + 6, y: q.y, button: 2 }); const right = out.cur;
    app.fire("contextmenu", { x: q.x - 6, y: q.y, button: 2 }); out.cur2 = out.cur; out.cur = right;
    app.answer = undefined;
    // Edit Curve Point: a straight line, no curve point there
    mk(); app.answer = () => ({ by: "uniform", u: 3, l1: 1, r1: 0, l2: 0, r2: 0, s: 1, n: 2, dir: "current" });
    q = app.toS({ x: 50, y: 0 }); app.menuClick(q.x, q.y, "Split Curve…", "edit_curve_point");
    const s0 = S.pieces[0].segs[0];
    out.cps = (s0.cps || []).map(p => [+p.x.toFixed(4), +p.y.toFixed(4)]); out.pts = S.pieces[0].pts.length;
    out.straight = [0.1, 0.3, 0.5, 0.7, 0.9].every(t => Math.abs(app.segPt(S.pieces[0], 0, t).y) < 1e-6);
    return out;` }).result;
  assert.deepStrictEqual(o.off, [[0, 0], [100, 0], [200, 0], [200, 100], [0, 100]], "split exactly at the middle");
  assert.ok(o.dart.some(([x, y]) => x === 100 && y === 100), "split at the middle with a dart there: " + JSON.stringify(o.dart));
  assert.strictEqual(o.l1, 100, "the middle caught");
  const fromRight = o.cur.length === 1 && Math.abs(o.cur[0] - 170) < 1, fromLeft = o.cur2.length === 1 && Math.abs(o.cur2[0] - 30) < 1;
  assert.ok(fromRight, "Current from the right end: " + JSON.stringify(o.cur)); assert.ok(fromLeft, "and from the left: " + JSON.stringify(o.cur2));
  assert.deepStrictEqual(o.cps, [[66.6667, 0], [133.3333, 0]], "a curve point at every cut");
  assert.strictEqual(o.pts, 4, "the line is not split"); assert.ok(o.straight, "and stays straight");
});

/* ---------- CF4 ---------- */
test("CF4 / E6: Retract with several offsets steps in by the distance again and again, as many as fit, the old outlines left as base lines; Offset as Internal Line on several lines: All or Individual distances, Reverse Direction, Extend, a preview, one undo step", () => {
  const o = boot({ blank: true, script: `
    const out = {}, P = () => S.pieces[0], at = { x: 0, y: 0 };
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; app.commit();
    const box = (sh) => { const b = app.bboxOf([sh]); return [b.x0, b.y0, b.x1, b.y1].map(v => Math.round(v*100)/100); };
    app.answer = (t, f, op) => { out.pv = (op.preview({ dir: "retract", d: 10, n: 10, corner: "default" }) || []).length; return { dir: "retract", d: 10, n: 10, corner: "default", inner: false }; };
    app.ev("offsetWholeNumeric")(at, P());
    out.ret = [box(P()), P().bases.map(b => box(b)), toasts[toasts.length - 1]];
    app.undo();
    // two lines: the top (0) and the right (1), Individual 10 and 30, Extend
    const lines = [{ p: P(), sh: P(), i: 0, kind: "outline" }, { p: P(), sh: P(), i: 1, kind: "outline" }];
    app.answer = (t, f, op) => {
      out.dlg = [t, f.map(x => x.k + (x.g ? ":" + x.g : "")), op.radio && op.radio.groups.map(g => g[1]), op.checks.map(c => c.label)];
      const nid = S.nextSegId; out.pvN = op.preview({ mode: "each", d: 10, d0: 10, d1: 30, n: 1, rev: false, fit: true }).length; out.pvIds = S.nextSegId === nid;
      return { mode: "each", d: 10, d0: 10, d1: 30, n: 1, rev: false, fit: true };
    };
    const u0 = app.histSteps().at;
    app.ev("offsetNumeric")(at, P(), P(), 0, lines);
    out.each = P().internals.map(sh => sh.pts.map(q => [Math.round(q.x*100)/100, Math.round(q.y*100)/100]));
    out.steps = app.histSteps().at - u0;
    app.undo();
    app.answer = () => ({ mode: "all", d: 20, d0: 10, d1: 30, n: 2, rev: false, fit: false });
    app.ev("offsetNumeric")(at, P(), P(), 0, [{ p: P(), sh: P(), i: 0, kind: "outline" }, { p: P(), sh: P(), i: 1, kind: "outline" }]);
    out.all = P().internals.length;
    app.undo();
    // Reverse Direction on the top: outward
    app.answer = () => ({ d: 10, n: 1, rev: true, fit: false });
    app.ev("offsetNumeric")(at, P(), P(), 0, null);
    out.rev = P().internals[0].pts.map(q => Math.round(q.y));
    return out;` }).result;
  assert.deepStrictEqual(o.ret[0], [40, 40, 160, 60], "four steps of 10 fit in a height of 100");
  assert.deepStrictEqual(o.ret[1], [[0, 0, 200, 100], [10, 10, 190, 90], [20, 20, 180, 80], [30, 30, 170, 70]], "the old outlines stay as base lines");
  assert.ok(/4 times/.test(o.ret[2]) && /only 4 of 10 fit/.test(o.ret[2]), o.ret[2]);
  assert.strictEqual(o.pv, 4, "the preview shows every offset that fits");
  assert.deepStrictEqual(o.dlg, ["Offset as Internal Line", ["d:all", "d0:each", "d1:each", "n"], ["All", "Individual"], ["Reverse Direction", "Extend"]]);
  assert.strictEqual(o.pvN, 2); assert.ok(o.pvIds, "the preview takes no ids");
  assert.deepStrictEqual(o.each, [[[0, 10], [200, 10]], [[170, 0], [170, 100]]], "each line at its own distance, run on to the outline");
  assert.strictEqual(o.steps, 1);
  assert.strictEqual(o.all, 4, "All: 2 lines each, 20 apart");
  assert.deepStrictEqual(o.rev, [-10, -10], "Reverse Direction: outward");
});

/* ---------- CF5 ---------- */
test("CF5 / E7: Mirror Creation: near the mirror line the drawn end and its mirror image meet and snap together (two triangles point to point), and that click makes the whole; it is off again for the next polygon, after finishing and after Esc", () => {
  const o = boot({ blank: true, script: `
    const out = {}, C = (x, y) => { const q = app.toS({ x, y }); app.fire("pointermove", { x: q.x, y: q.y }); app.click(q.x, q.y); };
    const pts = () => S.pieces[S.pieces.length - 1].pts.map(q => Math.round(q.x*1000)/1000 + "," + Math.round(q.y*1000)/1000);
    app.setTool("polygon"); C(100, 100); C(60, 140);
    app.answer = () => ({ len: 40, ang: 90, mirror: "on", axis: "y" });
    let q = app.toS({ x: 60, y: 140 }); app.fire("contextmenu", { x: q.x, y: q.y, button: 2 }); app.answer = undefined;
    // the pointer 5 px right of the mirror line: the end meets its image there
    q = app.toS({ x: 105, y: 220 }); app.fire("pointermove", { x: q.x, y: q.y }); app.draw(); out.mark = S.snapMark.kind;
    app.click(q.x, q.y);
    out.whole = [S.pieces.length, ...pts()];
    // the next polygon: no mirror
    app.setTool("polygon"); C(300, 100); out.next = S.draft.mirror;
    C(340, 140); C(300, 180); C(300, 100); out.plain = pts();
    // Esc while mirroring: the next one starts without it
    app.setTool("polygon"); C(500, 100); C(460, 140);
    app.answer = () => ({ len: 0, ang: 90, mirror: "on", axis: "y" });
    q = app.toS({ x: 460, y: 140 }); app.fire("contextmenu", { x: q.x, y: q.y, button: 2 }); app.answer = undefined;
    out.on = S.draft.mirror; app.key("Escape"); out.esc = S.draft;
    C(500, 100); out.afterEsc = S.draft.mirror;
    return out;` }).result;
  assert.strictEqual(o.mark, "meet");
  assert.deepStrictEqual(o.whole, [1, "100,100", "60,140", "60,180", "100,220", "140,180", "140,140"], "one click where the ends meet makes the whole");
  assert.strictEqual(o.next, null, "off for the next polygon");
  assert.deepStrictEqual(o.plain, ["300,100", "340,140", "300,180"]);
  assert.strictEqual(o.on, "y"); assert.strictEqual(o.esc, null); assert.strictEqual(o.afterEsc, null, "off after Esc");
});

/* ---------- CF6 ---------- */
test("CF6 / E8: Trace keeps the outline with its curve points and the internal and base lines within it, not the seam allowance, and gets a new name; Shape mode selects internal shapes and whole patterns, never base polygons", () => {
  const o = boot({ blank: true, script: `
    const out = {}, P = () => S.pieces[0];
    S.pieces = [app.mkPiece("Front", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))];
    P().segs.forEach(sg => sg.sa = 10);
    Object.assign(P().segs[2], { curved: true, c1: null, c2: null, cps: [{ x: 100, y: 120 }] });
    app.addChild(P(), "internals", app.mkShape([{ x: 50, y: 25 }, { x: 150, y: 25 }, { x: 150, y: 75 }, { x: 50, y: 75 }], true));
    app.addChild(P(), "internals", app.mkShape([{ x: 20, y: 10 }, { x: 20, y: 90 }], false));
    app.addChild(P(), "bases", app.mkShape([{ x: 170, y: 10 }, { x: 190, y: 50 }, { x: 170, y: 90 }], true));
    app.commit();
    const mid = (sh, i) => app.toS(app.segPt(sh, i, 0.5));
    const pick = (sh, i, shift) => { const q = mid(sh, i); app.click(q.x, q.y, { shiftKey: !!shift }); };
    const run = (name) => app.menu.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes("<span>" + name + "</span>")).onclick();
    const menuAt = (q) => { app.menu.children.length = 0; app.showMenu({ clientX: q.x, clientY: q.y }); };
    app.setTool("trace");
    pick(P(), 0); pick(P(), 1, true); pick(P(), 2, true); pick(P(), 3, true);
    menuAt(mid(P(), 0)); run("Trace as a Pattern");
    let d = app.toS({ x: 400, y: 50 }); app.click(d.x, d.y);
    const q = S.pieces[1];
    out.line = [q.name !== "Front" && !/Front/.test(q.name), q.segs.every(sg => !sg.sa), (q.segs[2].cps || []).length, q.internals.length, q.bases.length];
    // Shape mode
    app.ev("setTraceMode")("shape");
    out.panel = /aria-pressed="true"[^>]*>[^<]*Shape/.test(app.el("tracepanel").innerHTML);
    let c = app.toS({ x: 100, y: 50 }); app.click(c.x, c.y); out.inner = S.traceShapes.map(r => r.id !== 0);
    c = app.toS({ x: 190, y: 50 }); const t0 = toasts.length; app.click(c.x, c.y, { shiftKey: true }); out.base = [S.traceShapes.length, /Base polygons/.test(toasts.slice(t0).join())];
    c = app.toS({ x: 30, y: 50 }); app.click(c.x, c.y, { shiftKey: true }); out.both = S.traceShapes.map(r => r.id === 0);
    menuAt(c); run("Trace as a Pattern");
    d = app.toS({ x: 100, y: 400 }); app.click(d.x, d.y);
    const made = S.pieces.slice(2);
    out.shape = made.map(p => [p.pts.length, p.internals.length, p.bases.length, p.segs.every(sg => !sg.sa)]);
    out.steps = app.histSteps().at;
    return out;` }).result;
  assert.deepStrictEqual(o.line, [true, true, 1, 2, 1], "a new name, no allowance, the curve point, both internal lines and the base line within");
  assert.strictEqual(o.panel, true);
  assert.deepStrictEqual(o.inner, [true], "inside an internal shape: that shape");
  assert.deepStrictEqual(o.base, [1, true], "a base polygon can't be selected");
  assert.deepStrictEqual(o.both, [false, true], "and a whole pattern with Shift");
  assert.deepStrictEqual(o.shape, [[4, 0, 0, true], [4, 2, 1, true]], "the internal shape alone; the whole pattern with what lies within it");
});

/* ---------- CF7 ---------- */
test("CF7: the seam allowance is drawn at one weight whatever the tool; a history entry shows the tool in hand's icon with the step's word, and the kind's glyph stays", () => {
  const o = boot({ blank: true, script: `
    const out = {};
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; S.pieces[0].segs.forEach(sg => sg.sa = 10); app.commit();
    const c = app.ev("ctx"), widths = (tool) => { app.setTool(tool); const ws = []; const st = c.stroke; c.stroke = function () { if (c.strokeStyle === app.ev("C_SALINE")) ws.push(c.lineWidth); return st && st.apply(this, arguments); }; app.draw(); c.stroke = st; return ws; };
    out.sa = [widths("edit_pattern"), widths("seam_allowance")];
    app.setTool("trace"); app.push("Trace as a Pattern");
    const st = app.histSteps().steps.slice(-1)[0], en = app.ev("histEntry")(st);
    out.entry = [st.tool, en.tool, en.word, en.kind.k, /<b>Trace as a Pattern<.b>/.test(en.html), /tl-k/.test(en.html)];
    app.setTool("polygon"); app.push();
    const en2 = app.ev("histEntry")(app.histSteps().steps.slice(-1)[0]); out.own = [en2.kind.k, en2.word, /tl-k/.test(en2.html)];
    return out;` }).result;
  assert.ok(o.sa[0].length && o.sa[1].length, JSON.stringify(o.sa));
  assert.deepStrictEqual(o.sa[1], o.sa[0], "the same weight with the Seam Allowance tool in hand");
  assert.deepStrictEqual(o.entry, ["trace", "Trace", "Trace as a Pattern", "copy", true, true], "Trace's icon, the word, the kind's glyph in the corner");
  assert.deepStrictEqual(o.own, ["tool", "Polygon", false], "a step that is the tool's own: its icon and its name");
});

/* ---------- CF8 ---------- */
test("CF8: Export ▸ BOM (XML) and Tech Pack (JSON) are built and named by their formats; punch marks along a line with the Split dialog (16 over 200 mm), and a mark lines up with another's x or y", () => {
  const o = boot({ blank: true, script: `
    const out = {}, files = {};
    app.setDownload((n, t) => { files[n] = t; });
    S.pieces = [app.mkPiece("Front", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 300 }, { x: 0, y: 300 }], true))];
    app.addChild(S.pieces[0], "internals", app.mkShape([{ x: 20, y: 50 }, { x: 20, y: 250 }], false)); app.commit();
    const ex = app.MENUS.file().find(x => x && x.n === "Export").menu().filter(x => x && x.n);
    out.rows = ex.slice(0, 6).map(x => x.n + (x.off ? ":off" : ""));
    ex.find(x => x.n === "BOM (XML)").f(); ex.find(x => x.n === "Tech Pack (JSON)").f();
    out.xml = files["pattern-bom.xml"]; const tp = JSON.parse(files["pattern-techpack.json"]); out.tp = [tp.unit, tp.patterns.map(p => [p.name, p.area, p.outline]), !!tp.bom];
    // 16 marks over the 200 mm internal line: Uniform Split into 17
    app.setTool("punch_mark");
    app.answer = (t) => { out.title = t; return { by: "uniform", u: 17, l1: 1, r1: 0, l2: 0, r2: 0, s: 1, n: 2, dir: "current" }; };
    const q = app.toS({ x: 20, y: 150 }); app.fire("contextmenu", { x: q.x, y: q.y, button: 2 });
    const pm = S.pieces[0].punches; out.along = [pm.length, pm.every(m => Math.abs(m.x - 20) < 1e-9), +(pm[1].y - pm[0].y).toFixed(4), app.histSteps().at];
    // a click 4 px off the x of a mark: lined up with it
    const c = app.toS({ x: 20 + 4/S.view.s, y: 280 }); app.click(c.x, c.y);
    out.lined = +(pm[pm.length - 1].x).toFixed(6);
    return out;` }).result;
  assert.deepStrictEqual(o.rows.slice(0, 2), ["DXF", "PDF"], "PDF is ours (Print or PDF)");
  assert.ok(o.rows.includes("BOM (XML)") && o.rows.includes("Tech Pack (JSON)"), JSON.stringify(o.rows));
  assert.ok(/<bom unit="mm"/.test(o.xml) && /<pattern name="Front" quantity="1" area="60000[.]0"/.test(o.xml), o.xml);
  assert.deepStrictEqual(o.tp, ["mm", [["Front", 60000, 1000]], true]);
  assert.strictEqual(o.title, "Punch Marks Along Line");
  assert.deepStrictEqual(o.along, [16, true, +(200/17).toFixed(4), 1], "16 marks, evenly, one undo step");
  assert.strictEqual(o.lined, 20, "lined up with the marks' x");
});

module.exports = T;
