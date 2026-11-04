// Roadmap 2, batch 1 (bugs and global feel): picking, sewn segments, baselines only in
// Trace, the seam allowance's cut line, point dragging without a grid, Walk Pattern
// between two patterns, annotations, cursors, preferences (units, colours) and .pdraft.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const store = new Map();
const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const S = { pieces: [], seams: [], guides: [], measures: [], sel: [], selSeg: -1, selPt: -1, selKind: "outline", selInt: -1, tool: "edit_pattern",
  nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null, view: { s: 1, x: 0, y: 0 }, show: null, unit: "mm", dec: 1, prefs: null, shift: false };
const noop = () => {};
const el = () => ({ classList: { toggle: noop }, textContent: "" });
const G = load(["V", "dist", "sub", "add", "mul", "clone", "mkShape", "rectShape", "mkPiece", "setCurve", "addChild", "segPt", "segLen", "flatten", "signedArea", "inside",
  "VIEW_DEFAULT", "segNear", "nearT", "hit", "toS", "cutLine", "cleanLoops", "cornerPts", "dragLines", "dragOnLines", "snapW",
  "walkPath", "walkSide", "walkInside", "walkFlip", "walkPose", "pathAt",
  "PREFS_DEFAULT", "COLORS", "normPrefs", "loadPrefs", "savePrefs", "applyPrefs", "fmt", "toDisp", "fromDisp", "rulerTicks", "noteBox", "NOTE_SIZE", "migrate", "normNotch", "NOTCH_DEFAULT",
], { S, localStorage, ui: noop, draw: noop, document: { getElementById: el } });
const { V, dist, mkShape, rectShape, mkPiece, setCurve, addChild, segPt, signedArea, inside, flatten, VIEW_DEFAULT, segNear, hit, cutLine, cleanLoops, dragLines, dragOnLines, snapW,
  walkPath, walkFlip, PREFS_DEFAULT, COLORS, normPrefs, loadPrefs, savePrefs, applyPrefs, fmt, toDisp, fromDisp, rulerTicks, noteBox, migrate } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() {
  S.pieces = []; S.seams = []; S.sel = []; S.selSeg = S.selPt = S.selInt = -1; S.selKind = "outline"; S.tool = "edit_pattern"; S.shift = false;
  S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.show = { ...VIEW_DEFAULT }; S.view = { s: 1, x: 0, y: 0 }; S.unit = "mm"; S.dec = 1; S.prefs = normPrefs(null); store.clear();
}
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
// a two-pattern document to boot with: a 300 x 260 rectangle with a baseline, and a 200 x 250 one to its right
const TWO = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:260},{x:0,y:260}], true));
  const B = app.mkPiece("B", app.mkShape([{x:420,y:0},{x:620,y:0},{x:620,y:250},{x:420,y:250}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const at = (q) => app.toS(q), out = {};
`;

/* ---------- picking ---------- */
test("picking a segment has the same reach in pixels at every zoom, with no gaps along a long or a curved edge", () => {
  reset();
  const p = mkPiece("P", mkShape([V(0, 0), V(4000, 0), V(4000, 3000), V(0, 3000)], true)); S.pieces.push(p);
  setCurve(p, 1, true); p.segs[1].c1 = V(5200, 800); p.segs[1].c2 = V(2600, 2100);
  for (const s of [0.05, 0.2, 1, 4, 30]) {
    S.view = { s, x: 40, y: 60 };
    for (let k = 1; k < 200; k++) {
      const t = k/200;
      for (const i of [0, 1]) {
        const q = segPt(p, i, t), tn = G.sub(segPt(p, i, Math.min(1, t + 1e-4)), segPt(p, i, Math.max(0, t - 1e-4))), L = Math.hypot(tn.x, tn.y) || 1;
        const sx = q.x*s + 40, sy = q.y*s + 60, nx = -tn.y/L, ny = tn.x/L;
        // (on the inside of a bend another part of the curve can be nearer than the place below the cursor, never farther)
        const d4 = segNear(p, i, sx + nx*4, sy + ny*4).d;
        assert.ok(d4 <= 4.001 && d4 > 2, "4 px off segment " + i + " at t " + t + ", zoom " + s + ": " + d4);
        if (i === 0 || s >= 1) assert.ok(segNear(p, i, sx + nx*9, sy + ny*9).d > 6, "9 px off is out of reach");
      }
    }
  }
});

test("picking takes a point before a segment before the pattern, and the nearest of each", () => {
  reset();
  const p = mkPiece("P", mkShape([V(0, 0), V(8, 0), V(300, 0), V(300, 200), V(0, 200)], true)); S.pieces.push(p);
  const k = (x, y) => { const h = hit(x, y); return h ? h.k + (h.i === undefined ? "" : h.i) : null; };
  assert.strictEqual(k(3, 1), "pt0", "two points 8 px apart: the nearer one");
  assert.strictEqual(k(5, 1), "pt1");
  assert.strictEqual(k(150, 4), "seg1", "a segment within 6 px");
  assert.strictEqual(k(150, 9), "body", "past that, the pattern itself");
  assert.strictEqual(k(297, 4), "pt2", "a point wins over the segments that meet at it");
  assert.strictEqual(k(500, 500), null);
  // a second pattern on top, its edge 3 px from the first one's: the nearer edge is taken, not the first one found
  const q = mkPiece("Q", rectShape(100, -103, 100, 100)); S.pieces.push(q);
  assert.strictEqual(hit(150, -2).p, q); assert.strictEqual(hit(150, -1).p, p, "1 px from P's edge, 2 px from Q's");
});

test("a sewn segment is picked like any other: a seam never takes the click", () => {
  reset();
  const a = mkPiece("A", rectShape(0, 0, 100, 100)), b = mkPiece("B", rectShape(200, 0, 100, 100)); S.pieces.push(a, b);
  S.seams.push({ id: 1, a: [{ piece: a.id, shape: 0, sids: [a.segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: b.id, shape: 0, sids: [b.segs[3].id], t0: 0, t1: 1, rev: false }] });
  const h = hit(100, 50); assert.strictEqual(h.k, "seg"); assert.strictEqual(h.i, 1); assert.strictEqual(h.p, a);
  assert.strictEqual(hit(100, 0).k, "pt", "and so are its points");
  const r = boot({ script: TWO + `
    S.seams.push({ id: 1, a: [{ piece: A.id, shape: 0, sids: [A.segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[3].id], t0: 0, t1: 1, rev: false }] });
    app.commit(); app.setTool("edit_pattern");
    let s = at({ x: 300, y: 130 }); app.click(s.x, s.y);
    out.seg = [S.sel.slice(), S.selSeg, S.selPt];
    s = at({ x: 300, y: 260 }); app.click(s.x, s.y);
    out.pt = [S.selSeg, S.selPt];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.result.seg[1], 1, "the sewn segment is selected by a click"); assert.strictEqual(r.result.pt[1], 2, "and its end point");
});

test("a baseline is drawn everywhere but can be picked, selected and dragged only with the Trace tool", () => {
  const r = boot({ script: TWO + `
    A.bases.push(Object.assign(app.mkShape([{x:60,y:60},{x:200,y:60},{x:200,y:180}], false), { id: S.nextShapeId++ })); app.commit();
    const base = () => S.pieces[0].bases[0], pt1 = () => ({ ...base().pts[1] });
    out.tries = {};
    for (const tool of ["edit_pattern", "edit_curve_point", "add_point", "notch", "seam_allowance"]) {
      app.setTool(tool);
      const s = at({ x: 200, y: 60 }), s2 = at({ x: 240, y: 90 });
      app.fire("pointermove", { x: s.x, y: s.y });
      const hov = S.hover && S.hover.kind;
      app.drag(s.x, s.y, s2.x, s2.y); app.fire("pointerup", { x: s2.x, y: s2.y });
      out.tries[tool] = [hov || null, S.selKind, pt1(), base().pts.length];
      while (S.undo.length) app.undo();
    }
    app.setTool("trace");
    const s = at({ x: 200, y: 60 }), s2 = at({ x: 240, y: 90 });
    app.fire("pointermove", { x: s.x, y: s.y }); out.hover = S.hover && S.hover.kind; out.cursor = app.cv.style.cursor;
    app.drag(s.x, s.y, s2.x, s2.y); app.fire("pointerup", { x: s2.x, y: s2.y });
    out.trace = [S.selKind, pt1()];
    // leaving Trace lets go of it
    app.setTool("edit_pattern"); out.after = [S.selKind, S.selInt];
    // in Trace, Delete removes the selected baseline
    app.setTool("trace"); const m = at({ x: 130, y: 60 }); app.click(m.x, m.y); app.key("Delete");
    out.deleted = S.pieces[0].bases.length;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  for (const [tool, v] of Object.entries(o.tries)) {
    assert.notStrictEqual(v[0], "base", tool + " does not hover a baseline"); assert.notStrictEqual(v[1], "base", tool + " does not select it");
    assert.deepStrictEqual(v[2], { x: 200, y: 60 }, tool + " does not move its point"); assert.strictEqual(v[3], 3, tool + " adds nothing to it");
  }
  assert.strictEqual(o.hover, "base"); // (Round r19 / H03: over and while dragging a point, line or mark the pointer is the arrow with a four-way badge, an image with "move" as its fallback; it was the system's "move")
  assert.match(o.cursor, /^url[(].*, move$/, "over a baseline point in Trace the pointer says it can be moved");
  assert.strictEqual(o.trace[0], "base"); near(o.trace[1].x, 240, 1e-6); near(o.trace[1].y, 90, 1e-6);
  assert.deepStrictEqual(o.after, ["outline", -1]);
  assert.strictEqual(o.deleted, 0);
});

/* ---------- the seam allowance's cut line ---------- */
test("an allowance on one edge runs on to the lines of the edges beside it, however sharp the corner", () => {
  reset();
  // a sliver: the corner at (400, 0) is 7 degrees. The old limit (6 allowances) stopped the band square there.
  const p = mkPiece("P", mkShape([V(0, 0), V(400, 0), V(0, 50)], true)); S.pieces.push(p);
  p.segs[1].sa = 10;
  const cut = cutLine(p), area = Math.abs(signedArea(cut)) - Math.abs(signedArea(p.pts));
  const tip = cut.reduce((m, q) => (q.x > m.x ? q : m), cut[0]);
  near(tip.y, 0, 1e-6, "the cut line meets the top edge's line"); assert.ok(tip.x > 400 + 60, "beyond the corner, past the old limit: " + tip.x);
  for (const q of cut) assert.ok(q.y >= -1e-6, "nothing of the band is above the top edge, which has no allowance");
  assert.ok(area > 10*segLenOf(p, 1) - 1, "the band covers the whole edge: " + area);
  // an even allowance still gives the rectangle grown by it
  const r = mkPiece("R", rectShape(0, 0, 100, 60)); r.segs.forEach(s => s.sa = 10);
  near(Math.abs(signedArea(cutLine(r))), 120*80, 1e-6);
});
function segLenOf(p, i) { return G.segLen(p, i); }

test("the cut line never crosses itself: an allowance wider than an inside corner or curve is cut off where it meets itself", () => {
  // a V cut 30 wide and 80 deep with a 25 allowance all round: the two legs' allowances overlap
  reset();
  const p = mkPiece("P", mkShape([V(0, 0), V(300, 0), V(300, 200), V(165, 200), V(150, 120), V(135, 200), V(0, 200)], true)); S.pieces.push(p);
  p.segs.forEach(s => s.sa = 25);
  const crossings = (pts) => {
    let k = 0; const n = pts.length;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = pts[i], b = pts[(i+1)%n], c = pts[j], d = pts[(j+1)%n];
      const o = (p1, p2, p3) => (p2.x-p1.x)*(p3.y-p1.y) - (p2.y-p1.y)*(p3.x-p1.x);
      if (o(a, b, c)*o(a, b, d) < -1e-9 && o(c, d, a)*o(c, d, b) < -1e-9) k++;
    }
    return k;
  };
  const cut = cutLine(p);
  assert.strictEqual(crossings(cut), 0, "no crossing left");
  near(Math.abs(signedArea(cut)), 350*250, 1, "the V is closed over: what is left is the outer rectangle");
  // the same on a tight inside curve
  reset();
  const c = mkPiece("C", mkShape([V(0, 0), V(300, 0), V(300, 200), V(170, 200), V(130, 200), V(0, 200)], true)); S.pieces.push(c);
  setCurve(c, 3, true); c.segs[3].c1 = V(170, 150); c.segs[3].c2 = V(130, 150);
  c.segs.forEach(s => s.sa = 30);
  assert.strictEqual(crossings(cutLine(c)), 0);
  // cleanLoops leaves a polygon that does not cross itself exactly as it was
  const sq = [V(0, 0), V(10, 0), V(10, 10), V(5, 4), V(0, 10)];
  assert.deepStrictEqual(cleanLoops(sq), sq);
  const bow = cleanLoops([V(0, 0), V(100, 0), V(100, 50), V(60, 50), V(40, 70), V(60, 70), V(40, 50), V(0, 50)]);
  assert.strictEqual(crossings(bow), 0); assert.strictEqual(bow.length, 7, "the small loop is replaced by its crossing point");
});

/* ---------- dragging a point ---------- */
test("a dragged point: no grid by default; it catches the extensions of its edges, and Ctrl holds it to a line", () => {
  reset();
  assert.strictEqual(normPrefs(null).grid, 0, "grid snap is off unless switched on"); assert.strictEqual(normPrefs(null).smart, true);
  const p = mkPiece("P", rectShape(0, 0, 300, 200)); S.pieces.push(p);
  const lines = dragLines(p, 2);                                       // the corner at (300, 200)
  assert.strictEqual(lines.length, 4, "two edge extensions and the two diagonals between them");
  near(Math.abs(lines[0].y), 1, 1e-9, "first the incoming edge (the right side, vertical)"); near(Math.abs(lines[1].x), 1, 1e-9, "then the outgoing edge (the bottom, level)");
  for (const u of lines.slice(2)) near(Math.abs(u.x), Math.SQRT1_2, 1e-9, "a diagonal");
  const d = { sh: p, i: 2, orig: { pts: p.pts.map(q => ({ ...q })) }, lines, onLine: -1 };
  // moved freely: stays where the cursor puts it, to a fraction of a millimetre
  let q = dragOnLines(d, V(337.3, 251.9), false);
  assert.deepStrictEqual(q, V(337.3, 251.9)); assert.strictEqual(d.onLine, -1);
  // 4 px from the extension of the right side: caught onto it
  q = dragOnLines(d, V(304, 260), false);
  near(q.x, 300, 1e-9); near(q.y, 260, 1e-9); assert.strictEqual(d.onLine, 0);
  q = dragOnLines(d, V(380, 197), false); near(q.y, 200, 1e-9, "and the bottom edge's"); assert.strictEqual(d.onLine, 1);
  // a diagonal is not caught by itself, only with Ctrl
  q = dragOnLines(d, V(350, 252), false); assert.deepStrictEqual(q, V(350, 252));
  q = dragOnLines(d, V(350, 252), true); near(q.x - 300, q.y - 200, 1e-9, "Ctrl: on the diagonal"); assert.strictEqual(d.onLine >= 2, true);
  q = dragOnLines(d, V(310, 290), true); near(q.x, 300, 1e-9, "Ctrl near the vertical: held to it, however far off");
  // with the preference off nothing is caught without Ctrl
  S.prefs = normPrefs({ smart: false });
  assert.deepStrictEqual(dragOnLines(d, V(304, 260), false), V(304, 260));
  // a point being dragged does not catch on itself
  S.prefs = normPrefs(null);
  assert.deepStrictEqual(snapW(V(303, 203), null, false, p.pts[2]), V(303, 203), "its own old place is not a snap target");
  near(snapW(V(303, 3), null, false, p.pts[2]).x, 300, 1e-9, "another point still is");
  S.prefs = normPrefs({ snapPts: false });
  assert.deepStrictEqual(snapW(V(303, 3), null, false, p.pts[2]), V(303, 3), "unless that is switched off");
});

test("dragging a point in the booted app: free movement, the original kept for the feedback, Ctrl on a line, and one undo step", () => {
  const r = boot({ script: TWO + `
    app.setTool("edit_pattern");
    const a = at({ x: 300, y: 260 }), b = at({ x: 337.3, y: 291.9 });
    app.drag(a.x, a.y, b.x, b.y);
    out.free = { ...S.pieces[0].pts[2] }; out.orig = S.drag && S.drag.orig && S.drag.orig.pts[2]; out.lines = S.drag && S.drag.lines.length; out.cursor = app.cv.style.cursor;
    const c = at({ x: 352, y: 300 }); app.fire("pointermove", { x: c.x, y: c.y, ctrlKey: true });
    out.ctrl = { ...S.pieces[0].pts[2] }; out.on = S.drag.onLine; out.dirs = S.drag.lines.slice(0, 2);
    app.fire("pointerup", { x: c.x, y: c.y });
    out.undo = S.undo.length; app.undo(); out.back = { ...S.pieces[0].pts[2] };
    out.snap = [S.snapG, app.el("s-snap").textContent];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  near(o.free.x, 337.3, 1e-6, "no 5 mm steps"); near(o.free.y, 291.9, 1e-6);
  assert.deepStrictEqual(o.orig, { x: 300, y: 260 }, "where it was is kept while it is dragged"); assert.strictEqual(o.lines, 4); // (Round r19 / H03: over and while dragging a point, line or mark the pointer is the arrow with a four-way badge, an image with "move" as its fallback; it was the system's "move")
  assert.match(o.cursor, /^url[(].*, move$/);
  // (Round r30 / 6, the maintainer's user test: Ctrl follows one of the point's own lines, the one nearest the motion, never a
  // diagonal between them; here it was the diagonal)
  assert.ok(o.on === 0 || o.on === 1, "Ctrl holds it to one of its own lines: " + o.on);
  const u = o.dirs[o.on]; near((o.ctrl.x - 300)*u.y - (o.ctrl.y - 260)*u.x, 0, 1e-6, "on that line's extension");
  assert.strictEqual(o.undo, 1); assert.deepStrictEqual(o.back, { x: 300, y: 260 });
  assert.deepStrictEqual(o.snap, [0, "GRID OFF"]);
});

/* ---------- Walk Pattern ---------- */
test("Walk Pattern: the walked pattern is shown mirrored exactly when it would otherwise lie on top of the stationary one", () => {
  reset();
  const a = mkPiece("A", rectShape(0, 0, 100, 100)), b = mkPiece("B", rectShape(300, 0, 100, 100)); S.pieces.push(a, b);
  const side = (p, start, dir) => ({ p, sh: p, path: walkPath(p, start, dir) });
  // both drawn the same way round: walked the same way they overlap, walked opposite ways they lie side by side
  assert.strictEqual(walkFlip(side(a, 1, 1), 1, side(b, 0, 1), 1), true);
  assert.strictEqual(walkFlip(side(a, 1, 1), 1, side(b, 0, -1), -1), false);
  b.pts.reverse();                                                     // B drawn the other way round
  assert.strictEqual(walkFlip(side(a, 1, 1), 1, side(b, 0, 1), 1), false);
  const line = { p: a, sh: mkShape([V(0, 0), V(50, 0)], false), path: [] };
  assert.strictEqual(walkFlip(side(a, 1, 1), 1, line, 1), false, "an open line has no inside: never mirrored");
});

test("Walk Pattern in the booted app: click the pattern to walk, then the pattern to walk along; it follows the cursor either way; Enter ends", () => {
  const r = boot({ script: TWO + `
    app.setTool("walk");
    // walked: B's left edge (segment 3), clicked near its lower end; stationary: A's right edge (segment 1), clicked at its top point
    let s = at({ x: 420, y: 230 }); app.click(s.x, s.y);
    out.first = [!!S.walk, app.walkLive(), S.walk.B.pid === B.id, S.walk.B.start, S.walk.B.dir];
    s = at({ x: 300, y: 0 }); app.click(s.x, s.y);
    out.second = [app.walkLive(), S.walk.A.pid === A.id, S.walk.A.start];
    s = at({ x: 303, y: 120 }); app.fire("pointermove", { x: s.x, y: s.y });
    out.down = [S.walk.s, S.walk.A.dir];
    s = at({ x: 180, y: 4 }); app.fire("pointermove", { x: s.x, y: s.y });
    out.left = [S.walk.s, S.walk.A.dir];
    s = at({ x: 303, y: 100 }); app.fire("pointermove", { x: s.x, y: s.y });
    const n1 = S.pieces[0].segs[1].notches.length, n3 = S.pieces[1].segs[3].notches.length;
    app.fire("pointerdown", { x: s.x, y: s.y }); app.fire("pointerup", { x: s.x, y: s.y });
    out.notched = [S.pieces[0].segs[1].notches.length - n1, S.pieces[1].segs[3].notches.length - n3, S.pieces[0].segs[1].notches[0], S.pieces[1].segs[3].notches[0]];
    app.key("Enter"); out.ended = S.walk;
    // a walk can be given up before the second click
    s = at({ x: 420, y: 230 }); app.click(s.x, s.y); app.key("Escape"); out.esc = S.walk;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.first, [true, false, true, 3, 1], "the first click picks the walked pattern: B's left edge from its lower end, and nothing is walked yet");
  assert.deepStrictEqual(o.second, [true, true, 1]);
  near(o.down[0], 120, 0.01, "moving down A's right edge walks 120"); assert.strictEqual(o.down[1], 1);
  near(o.left[0], 120, 0.01, "moving along A's top edge walks the other way from the same point"); assert.strictEqual(o.left[1], -1);
  assert.deepStrictEqual(o.notched.slice(0, 2), [1, 1], "a click notches both");
  near(o.notched[2]*260, 100, 0.01, "100 down the stationary edge"); near(o.notched[3]*250, 100, 0.01, "and 100 along the walked one, from the end it started at");
  assert.strictEqual(o.ended, null); assert.strictEqual(o.esc, null);
});

/* ---------- annotations ---------- */
test("annotations in the booted app: typed in the program's own dialog, placed where clicked, sized, moved, edited and deleted", () => {
  const r = boot({ script: TWO + `
    out.prompt = typeof prompt === "undefined" ? "none" : "there";
    app.setTool("annotations");
    app.promptAnswer = "cut on fold"; app.promptNums = { size: 12 };
    let s = at({ x: 100, y: 80 }); app.click(s.x, s.y);
    out.added = JSON.parse(JSON.stringify(S.pieces[0].notes));
    app.promptAnswer = null; s = at({ x: 200, y: 200 }); app.click(s.x, s.y);
    out.cancelled = S.pieces[0].notes.length;
    // Edit Annotations: click selects, drag moves, double-click edits, Delete removes
    app.setTool("edit_annotations");
    s = at({ x: 100, y: 80 }); const s2 = at({ x: 160, y: 140 });
    app.drag(s.x, s.y, s2.x, s2.y); app.fire("pointerup", { x: s2.x, y: s2.y });
    out.moved = [S.pieces[0].notes[0].x, S.pieces[0].notes[0].y, S.selNote && S.selNote.ni];
    app.promptAnswer = "cut 2"; app.promptNums = { size: 20 };
    app.fire("pointermove", { x: s2.x, y: s2.y }); app.fire("dblclick", { x: s2.x, y: s2.y });
    out.edited = { ...S.pieces[0].notes[0] };
    // a plain click on it selects without leaving an undo step behind
    const u0 = S.undo.length; app.click(s2.x, s2.y); out.clickUndo = S.undo.length - u0;
    app.key("Delete"); out.deleted = S.pieces[0].notes.length;
    app.undo(); out.undone = S.pieces[0].notes.length;
    // with any other tool a note is not in the way of the pattern under it
    app.setTool("edit_pattern"); out.under = app.hit(s2.x, s2.y).k;
    // renaming through the same dialog (the grading size names use it too)
    app.setTool("annotations"); app.promptAnswer = "  Front  ";
    S.pieces[0].anno = { x: 150, y: 30 }; const n = at({ x: 150, y: 30 }); app.click(n.x, n.y); out.name = S.pieces[0].name;
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.added.length, 1); assert.strictEqual(o.added[0].text, "cut on fold"); assert.strictEqual(o.added[0].size, 12);
  near(o.added[0].x, 100, 1e-6, "where it was clicked"); near(o.added[0].y, 80, 1e-6);
  assert.strictEqual(o.cancelled, 1, "a cancelled dialog adds nothing");
  near(o.moved[0], 160, 1e-6); near(o.moved[1], 140, 1e-6); assert.strictEqual(o.moved[2], 0, "and it is the selected one");
  assert.strictEqual(o.edited.text, "cut 2"); assert.strictEqual(o.edited.size, 20);
  assert.strictEqual(o.clickUndo, 0); assert.strictEqual(o.deleted, 0); assert.strictEqual(o.undone, 1);
  assert.strictEqual(o.under, "body"); assert.strictEqual(o.name, "Front");
});

test("an annotation's size: a text height in millimetres, kept by files, defaulted for older ones", () => {
  reset();
  S.view = { s: 2, x: 0, y: 0 };
  const b = noteBox({ text: "abc", x: 100, y: 50, size: 10 });
  assert.strictEqual(b.px, 20, "10 mm at 2 px per mm"); assert.ok(b.x < 200 && b.x + b.w > 200 && b.y < 100 && b.y + b.h > 100, "the box is centred on the note");
  assert.strictEqual(noteBox({ text: "abc", x: 0, y: 0 }).px, G.NOTE_SIZE*2, "a note without a size takes the default");
  S.view = { s: 0.1, x: 0, y: 0 };
  assert.strictEqual(noteBox({ text: "abc", x: 0, y: 0, size: 10 }).px, 7, "never too small to read on screen");
  const p = migrate({ id: 1, name: "P", on: true, pts: [V(0, 0), V(9, 0), V(9, 9)], segs: [{ notches: [] }, { notches: [] }, { notches: [] }], darts: [],
    notes: [{ text: "a", x: 1, y: 2 }, { text: "b", x: 3, y: 4, size: 14 }, { text: "c", x: 5, y: 6, size: -3 }, { x: 1, y: 1 }] });
  assert.deepStrictEqual(p.notes, [{ text: "a", x: 1, y: 2 }, { text: "b", x: 3, y: 4, size: 14 }, { text: "c", x: 5, y: 6 }]);
});

/* ---------- preferences ---------- */
test("preferences: defaults, junk, units with decimals (mm, cm, inches), and the colours", () => {
  reset();
  assert.deepStrictEqual(normPrefs(undefined), PREFS_DEFAULT);
  assert.deepStrictEqual(normPrefs({ unit: "yd", decimals: 9, grid: 3, smart: "x", snapPts: 0, colors: { hover: "blue", selection: "#ABCDEF" } }),
    { ...PREFS_DEFAULT, smart: true, snapPts: true, colors: { ...PREFS_DEFAULT.colors, selection: "#abcdef" } }, "anything not understood falls back; smart and point snap are on unless switched off");
  assert.strictEqual(normPrefs({ snapPts: false }).snapPts, false);
  for (const k of ["outline", "internal", "baseline", "punch", "hover", "selection", "saLine"]) assert.ok(COLORS.some(c => c[0] === k), "a colour setting for " + k);
  assert.notStrictEqual(PREFS_DEFAULT.colors.hover, PREFS_DEFAULT.colors.selection);
  S.prefs = normPrefs({ unit: "cm", decimals: 2 }); applyPrefs();
  assert.strictEqual(fmt(123.456), "12.35"); near(fromDisp(toDisp(77.7)), 77.7, 1e-12);
  S.prefs = normPrefs({ unit: "in", decimals: 1 }); applyPrefs();
  assert.strictEqual(fmt(25.4), "1.00", "an inch is shown to at least two decimals"); near(fromDisp(2), 50.8, 1e-12); near(toDisp(254), 10, 1e-12);
  S.prefs = normPrefs({ unit: "mm", decimals: 0 }); applyPrefs();
  assert.strictEqual(fmt(12.6), "13"); assert.strictEqual(S.snapG, 0);
  S.prefs = normPrefs({ grid: 5, colors: { hover: "#112233" } }); applyPrefs(); savePrefs();
  assert.strictEqual(S.snapG, 5); assert.strictEqual(loadPrefs().colors.hover, "#112233"); assert.strictEqual(loadPrefs().grid, 5);
  store.set("pdraft:prefs", "{not json"); assert.deepStrictEqual(loadPrefs(), PREFS_DEFAULT);
  // the ruler in inches: a label every whole number of inches
  const ticks = rulerTicks(4, 0, 800, "in").filter(t => t.major);
  near(ticks[1].px - ticks[0].px, 25.4*4, 1e-6, "one inch apart at this zoom"); assert.strictEqual(ticks[1].label, "1");
});

test("preferences in the booted app: saved ones come back, the status bar follows, a pattern file is .pdraft, and old defaults for notches are replaced", () => {
  const r = boot({ prefs: JSON.stringify({ unit: "in", decimals: 2, grid: 1, colors: { selection: "#ff00ff" } }), script: `
    const out = { unit: [S.unit, S.dec, S.snapG, app.el("s-unit").textContent, app.el("s-snap").textContent], sel: S.prefs.colors.selection, notch: { ...S.notch } };
    app.setPrefs({ unit: "mm", grid: 0 }); out.after = [S.unit, S.snapG];
    let file = null; app.setDownload((name) => { file = name; }); app.saveDoc(false); out.file = file;
    out.cursor = /^url\\("data:image\\/svg\\+xml,/.test(app.toolCursor("edit_pattern")) && app.toolCursor("notch") !== app.toolCursor("edit_pattern");
    const v0 = S.view.x; app.fire("pointerdown", { x: 300, y: 300, button: 1 }); app.fire("pointermove", { x: 310, y: 300, button: 1 }); out.pan = app.cv.style.cursor; out.panned = S.view.x - v0; app.fire("pointerup", { x: 310, y: 300, button: 1 });
    app.key(" "); app.fire("pointerdown", { x: 300, y: 300 }); out.spaceDrag = S.drag ? S.drag.k : null; app.fire("pointerup", { x: 300, y: 300 });
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.unit, ["in", 2, 1, "IN", "GRID 1"]); assert.strictEqual(o.sel, "#ff00ff");
  assert.deepStrictEqual(o.after, ["mm", 0]); assert.strictEqual(JSON.parse(r.storage["pdraft:prefs"]).unit, "mm", "a change is saved at once");
  assert.strictEqual(o.file, "pattern.pdraft"); assert.strictEqual(o.cursor, true, "each tool has its own pointer"); assert.strictEqual(o.pan, "grabbing"); assert.strictEqual(o.panned, 10, "the middle button pans"); assert.notStrictEqual(o.spaceDrag, "pan", "Space no longer pans: it is Simulate");
  assert.strictEqual(o.notch.color, "#00a37a"); assert.strictEqual(o.notch.width, 2);
});

module.exports = T;
