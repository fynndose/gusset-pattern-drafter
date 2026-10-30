// Round r9: 2D fixes (Align, Shift while dragging, the mirror line), simulation control, seams that hold, and the 3D
// additions after them. A test (or more) a batch.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// two rectangles: A 0,0 to 100,50 and B 200,30 to 300,130 (points clockwise on the page from the top left)
const TWO = `
  const rect = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true));
  S.pieces = [rect("A", 0, 0, 100, 50), rect("B", 200, 30, 100, 100)]; app.commit();
  const A = S.pieces[0], B = S.pieces[1], L = (p, i) => ({ p, sh: p, i, kind: "outline", int: -1 });
  const pts = (p) => p.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
`;

/* ---------- 1a ---------- */
// (Round r15 / 6: Align moves the first line itself, as the reference does (the check videos S05: a square became a
// parallelogram), and its pattern is reshaped; it used to move the whole pattern, which Match Up does. Two lines of one pattern
// are allowed now.)
test("r9 / 1a: Align on two lines moves the first line, straight across or up and down only, until it is level with the second; its neighbours follow, so its pattern is reshaped; the second pattern stays; one undo step from the menu", () => {
  const o = boot({ blank: true, script: TWO + `
    const out = {};
    const A0 = pts(A), B0 = pts(B), ap = app.ev("alignPatterns");
    out.left = ap([L(A, 1), L(B, 3)], "left"); out.leftA = pts(A); out.leftB = pts(B);
    out.top = ap([L(A, 0), L(B, 0)], "top"); out.topA = pts(A);
    out.middle = ap([L(A, 1), L(B, 1)], "middle"); out.middleA = pts(A);
    out.same = ap([L(A, 0), L(A, 2)], "left"); out.sameA = pts(A);
    out.A0 = A0; out.B0 = B0;
    // from the menu: select A's right line, Shift+click B's left line, right-click it, Align ▸ Right
    S.pieces = [rect("A", 0, 0, 100, 50), rect("B", 200, 30, 100, 100)]; app.commit();
    const A2 = S.pieces[0], B2 = S.pieces[1]; let undo0 = 0;
    app.setTool("edit_pattern");
    const sa = app.toS({ x: 100, y: 25 }), sb = app.toS({ x: 200, y: 80 });
    app.click(sa.x, sa.y); app.click(sb.x, sb.y, { shiftKey: true }); undo0 = S.undo.length;
    app.menuClick(sb.x, sb.y, "Align \\u25b8 Right");
    out.menuA = pts(A2); out.menuB = pts(B2); out.steps = S.undo.length - undo0;
    return out;` }).result;
  // Left: A's right line (x 100) to B's left line (x 200): A moves 100 across, nothing up or down
  assert.strictEqual(o.left, 1);
  assert.deepStrictEqual(o.leftA, [[0, 0], [200, 0], [200, 50], [0, 50]], "A's right line moved 100 across, the top and bottom stretched");
  assert.deepStrictEqual(o.leftB, o.B0, "the second pattern stays");
  // Top: A's top (y 0) to B's top (y 30): the top line comes down
  assert.deepStrictEqual(o.topA, [[0, 30], [200, 30], [200, 50], [0, 50]]);
  // Middle: A's right line (middle y 40) to B's right line (middle 80): 40 down
  assert.deepStrictEqual(o.middleA, [[0, 30], [200, 70], [200, 90], [0, 50]]);
  assert.strictEqual(o.same, 1, "two lines of one pattern: allowed (here already level)");
  assert.deepStrictEqual(o.sameA, o.middleA, "nothing to move");
  // Right from the menu: A's right line (x 100) to B's left line's right (x 200)
  assert.deepStrictEqual(o.menuA, [[0, 0], [200, 0], [200, 50], [0, 50]]);
  assert.deepStrictEqual(o.menuB, o.B0);
  assert.strictEqual(o.steps, 1, "one undo step");
});

/* ---------- 1b ---------- */
test("r9 / 1b: Edit Pattern with Shift held: a dragged point slides along the line nearest the pointer's direction (its angle kept), a dragged line along itself or a line meeting it; without Shift nothing changes", () => {
  const o = boot({ blank: true, script: TWO + `
    const out = {}, s = (x, y) => app.toS({ x, y }), drag = (a, b, e) => { const p = s(a[0], a[1]), q = s(b[0], b[1]); app.drag(p.x, p.y, q.x, q.y, e); app.fire("pointerup", { x: q.x, y: q.y, ...e }); };
    app.setTool("edit_pattern");
    // A's top right corner (100, 0) pulled to (130, 4) with Shift: along the top line, which stays level
    drag([100, 0], [130, 4], { shiftKey: true }); out.p1 = pts(A);
    // the same corner pulled mostly down: along the right line (which the first drag tipped)
    drag([130, 0], [133, 40], { shiftKey: true }); out.p2 = pts(A);
    // the bottom line (y 50) pulled down and a little across with Shift: along the left line (upright), the nearest
    drag([60, 50], [64, 80], { shiftKey: true }); out.s1 = pts(A);
    // without Shift the corner goes where the pointer puts it
    S.prefs.smart = false; S.snapG = 0; S.prefs.snapPat = false;
    drag([0, 0], [-7, 9]); out.free = pts(A);
    return out;` }).result;
  near(o.p1[1][0], 130, 0.6); near(o.p1[1][1], 0, 1e-6, "kept level");
  assert.deepStrictEqual(o.p1[2], [100, 50], "the corner below did not move");
  // the right line now runs from (130, 0) to (100, 50): the corner pulled mostly down slides along it
  near((o.p2[1][0] - 100)*50 + (o.p2[1][1] - 50)*30, 0, 0.1, "on the right line, its angle kept");
  assert.ok(o.p2[1][1] > 20, "moved down along it");
  near(o.s1[2][0], 100, 1e-6); near(o.s1[3][0], 0, 1e-6, "the bottom line slid straight down, along the upright left line");
  near(o.s1[2][1], 80, 0.6); near(o.s1[3][1], 80, 0.6);
  assert.ok(Math.abs(o.free[0][0]) > 3 && Math.abs(o.free[0][1]) > 3, "without Shift the point moves freely: " + o.free[0]);
});

/* ---------- 1c ---------- */
// (Round r15 / 5: the check videos S03 showed the Axis opening at Local, the first line's direction; this test said upright)
test("r9 / 1c: Mirror Creation's line passes through the first clicked point and opens along the first line drawn (Local)", () => {
  const o = boot({ blank: true, script: `
    const out = {}, s = (x, y) => app.toS({ x, y }), C = (x, y) => { const q = s(x, y); app.click(q.x, q.y); };
    out.def = app.ev("MIRROR_DEFAULT");
    app.setTool("polygon");
    C(100, 100); C(160, 140);                         // a first line that slants
    const m = s(200, 200); app.fire("pointermove", { x: m.x, y: m.y });
    let asked = null;
    app.answer = (t, f) => { asked = f.find(x => x.k === "axis").val; return { len: 0, ang: 0, mirror: "on", axis: asked }; };
    app.showMenu = app.showMenu; app.ev("penNumeric")({ x: 10, y: 10 });
    const ax = app.ev("mirrorAxis")(S.draft);
    out.asked = asked; out.ax = [ax.o.x, ax.o.y, ax.u.x, ax.u.y];
    return out;` }).result;
  assert.strictEqual(o.def, "local");
  assert.strictEqual(o.asked, "local", "the dialog opens at Local");
  assert.deepStrictEqual(o.ax.map(v => +v.toFixed(6)), [100, 100, 0.83205, 0.5547], "through the first clicked point, along the first line");
});

/* ---------- 2 ---------- */
// two patterns standing in front of the camera, sewn at both sides; the in-page solver (no worker in the test)
const SEWN = `
  const out = {}, G3 = app.G3, SIM = app.SIM, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  const X = () => S.pieces.map(p => Array.from(G3.items.get(p.id).X));
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 });
`;
test("r9 / 2: the simulation runs only when switched on: adding, sewing and arranging patterns move no cloth; switched on it drapes; a press in the 2D window stops it with the cloth left as it is; while it runs the cloth is pulled with any 3D tool; the Simulate button shows a pause sign while on", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const x0 = X();
    // sewing, adding a pattern, arranging: nothing runs
    app.push("Sew"); S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] }); app.commit();
    app.push("Rectangle"); S.pieces.push(sq("Third", 900, 0, 100, 100)); app.commit(); app.ev("garmentSync")();
    app.ev("resetArrangement3")(false); app.draw(); app.ev("garmentSync")();
    out.offAfterEdits = [SIM.on, app.ev("view3d.looping()"), JSON.stringify(X().slice(0, 2)) === JSON.stringify(x0)];
    // switched on: the cloth moves; the button's picture and the switch say so
    out.icons = [app.ev("ICON_ON.simulate") !== app.ev("ICON.simulate"), app.ev("toggle3")("simulate")];
    app.simToggle(); out.on = [SIM.on, app.ev("toggle3")("simulate")];
    for (let i = 0; i < 20; i++) app.ev("simFrame")();
    const x1 = X();
    out.moved = Math.max(...x1[0].map((v, k) => Math.abs(v - x0[0][k])));
    // pulled with no tool in hand: a press on the front pattern's cloth grabs it
    v3.tool(null);
    const it = G3.items.get(A.id), q = v3.project(new THREE.Vector3(it.X[0], it.X[1], it.X[2]));
    let mid = null; { let bx = 0, by = 0, n = it.X.length/3; for (let k = 0; k < n; k++) { bx += it.X[3*k]; by += it.X[3*k+1]; } mid = [bx/n, by/n]; }
    const c = v3.project(new THREE.Vector3(mid[0], mid[1], it.X[2]));
    v3.mouse.press({ clientX: c.x, clientY: c.y, button: 0, buttons: 1, shiftKey: false });
    out.grab = !!SIM.grab;
    v3.mouse.move({ clientX: c.x + 40, clientY: c.y, button: 0, buttons: 1 });
    v3.mouse.release({ clientX: c.x + 40, clientY: c.y, button: 0 });
    out.released = !SIM.grab;
    // a press in the 2D window: stopped, the cloth as it was
    for (let i = 0; i < 3; i++) app.ev("simFrame")();
    const x2 = X();
    app.fire("pointerdown", { x: 50, y: 50 }); app.fire("pointerup", { x: 50, y: 50 });
    out.stopped = [SIM.on, JSON.stringify(X()) === JSON.stringify(x2), S.pieces.map(p => G3.items.get(p.id).draped)];
    out.steps = app.histSteps().steps.map(s => s.n).filter(n => n === "Simulate").length;
    return out;` }).result;
  assert.deepStrictEqual(o.offAfterEdits, [false, false, true], "sewing, adding and arranging start nothing and move no cloth");
  assert.deepStrictEqual(o.icons, [true, false]);
  assert.deepStrictEqual(o.on, [true, true]);
  assert.ok(o.moved > 1, "switched on, the cloth moves: " + o.moved);
  assert.strictEqual(o.grab, true, "the cloth is grabbed with no tool in hand"); assert.strictEqual(o.released, true);
  assert.strictEqual(o.stopped[0], false, "a press in the 2D window stops the simulation");
  assert.strictEqual(o.stopped[1], true, "and leaves the cloth where it was");
  assert.deepStrictEqual(o.stopped[2].slice(0, 2), [true, true], "still draped, nothing reset");
  assert.strictEqual(o.steps, 1, "the run is one undo step");
});

/* ---------- 3: seams that hold ---------- */
const C = require("../drafter-sim.js");
function sheet(w, h, res) {
  const pts = [], nx = Math.round(w/res), ny = Math.round(h/res), dx = w/nx, dy = h/ny;
  for (let i = 0; i < nx; i++) pts.push([i*dx, 0]); for (let j = 0; j < ny; j++) pts.push([w, j*dy]);
  for (let i = 0; i < nx; i++) pts.push([w - i*dx, h]); for (let j = 0; j < ny; j++) pts.push([0, h - j*dy]);
  return C.meshPolygon(pts, res);
}
const lay = (m, f) => { const n = m.xy.length/2, X = new Float32Array(3*n); for (let i = 0; i < n; i++) X.set(f(m.xy[2*i], m.xy[2*i+1]), 3*i); return X; };
const edge = (m, f) => Array.from({ length: m.xy.length/2 }, (_, i) => i).filter(i => f(m.xy[2*i], m.xy[2*i+1])).sort((p, q) => m.xy[2*p+1] - m.xy[2*q+1]);
const side = (m, p, vs) => C.seamPath(vs.map(v => ({ a: { p, i: [v], w: [1] }, pos: [m.xy[2*v], m.xy[2*v+1]] })));
function cylinder(r, y0, y1, n) {
  const t = [], P = (a, y) => [r*Math.cos(a), y, r*Math.sin(a)];
  for (let k = 0; k < n; k++) {
    const a = 2*Math.PI*k/n, b = 2*Math.PI*(k + 1)/n, A0 = P(a, y0), B0 = P(b, y0), A1 = P(a, y1), B1 = P(b, y1);
    t.push(...A0, ...A1, ...B1, ...A0, ...B1, ...B0, 0, y1, 0, ...B1, ...A1, 0, y0, 0, ...A0, ...B0);
  }
  return new Float32Array(t);
}
// a medium woven: hardly stretches, limited to 8 %
const FAB = { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 4.35, maxStretch: 0.08 };
const maxGap = (sim) => Math.max(...C.clothSeamGaps(sim).filter(Boolean).map(g => g.max));
const meanX = (sim, k) => { const o = sim.off[k], e = k + 1 < sim.off.length ? sim.off[k+1] : sim.n; let x = 0; for (let i = o; i < e; i++) x += sim.x[3*i]; return x/(e - o); };

test("r9 / 3 acceptance: two rectangles sewn into a tube 15 % smaller round than a cylinder, put on it: after simulating, no seam is open by 1 mm or more; the fabric took the stretch", () => {
  const R = 100, W = 0.85*Math.PI*R, H = 200, res = 10, rr = R + FAB.thick, A = sheet(W, H, res), B = sheet(W, H, res);
  const at = (th0) => (x, y) => { const th = th0 + Math.PI*x/W; return [rr*Math.cos(th), 1100 - y, rr*Math.sin(th)]; };
  const field = C.buildSDF(cylinder(R, 700, 1300, 96), { cell: 8 });
  const lA = edge(A, (x) => x < 1e-6), rA = edge(A, (x) => x > W - 1e-6), lB = edge(B, (x) => x < 1e-6), rB = edge(B, (x) => x > W - 1e-6);
  const seams = [{ id: 1, pairs: C.seamPairs(side(A, 0, rA), side(B, 1, lB), res, true) }, { id: 2, pairs: C.seamPairs(side(A, 0, lA), side(B, 1, rB), res, true) }];
  const sim = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, at(-Math.PI/2)), fab: FAB }, { xy: B.xy, tri: B.tri, X: lay(B, at(Math.PI/2)), fab: FAB }], seams, field, opt: { self: false, ground: false } });
  let worst = 0;
  for (let f = 0; f < 240; f++) { C.clothStep(sim, 1/60); worst = Math.max(worst, maxGap(sim)); }
  assert.ok(worst < 1, "the widest any seam opened over 240 frames: " + worst.toFixed(3) + " mm");
  // the tube is still round the cylinder (it did not slide off or shrink into it) and is stretched
  let inside = 0, ylo = Infinity;
  for (let i = 0; i < sim.n; i++) { if (C.sdfAt(field, sim.x[3*i], sim.x[3*i+1], sim.x[3*i+2]) < -2) inside++; ylo = Math.min(ylo, sim.x[3*i+1]); }
  assert.strictEqual(inside, 0, "no point inside the cylinder"); assert.ok(ylo > 700, "still on the cylinder: " + ylo);
  assert.ok(C.clothStrain(sim) > 0.15, "the fabric stretched instead: " + C.clothStrain(sim));
});

test("r9 / 3 acceptance: one of two patterns sewn edge to edge is pulled 20 cm by the pointer's spring: the other one follows through the seam, and the seam never opens by 1 mm", () => {
  const W = 300, H = 200, res = 10, A = sheet(W, H, res), B = sheet(W, H, res);
  const seams = [{ id: 1, pairs: C.seamPairs(side(A, 0, edge(A, (x) => x > W - 1e-6)), side(B, 1, edge(B, (x) => x < 1e-6)), res, true) }];
  const sim = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, FAB.thick, y]), fab: FAB }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x + W, FAB.thick, y]), fab: FAB }], seams, opt: { self: false } });
  const g = edge(A, (x, y) => x < 1e-6 && Math.abs(y - H/2) < res*0.6)[0], x0 = [sim.x[3*g], sim.x[3*g+1], sim.x[3*g+2]], b0 = meanX(sim, 1);
  let worst = 0;
  for (let f = 0; f < 180; f++) {
    C.clothDrag(sim, { i: [g], w: [1], to: [x0[0] - 200*Math.min(1, f/60), x0[1], x0[2]] });
    C.clothStep(sim, 1/60); worst = Math.max(worst, maxGap(sim));
  }
  C.clothDrag(sim, null);
  assert.strictEqual(sim.drag, null, "let go");
  assert.ok(b0 - meanX(sim, 1) > 150, "the other pattern followed: " + (b0 - meanX(sim, 1)).toFixed(1) + " mm");
  assert.ok(worst < 1, "the widest the seam opened: " + worst.toFixed(3) + " mm");
  // the pull is a spring with a limited force, not a pin: the grabbed point is free to move with the cloth
  assert.ok(sim.w[g] > 0, "the grabbed point is not pinned");
});

test("r9 / 3: every cloth point on either side of a seam gets its partner; a fabric's limit holds a pulled strip to a fraction of the stretch it takes without one; a fabric's Max Stretch comes from its preset and reaches the solver", () => {
  const two = C.seamPath([0, 7, 13, 30].map((s, k) => ({ a: { p: 0, i: [k], w: [1] }, pos: [s, 0] }))), lone = C.seamPath([0, 10, 20, 30].map((s, k) => ({ a: { p: 1, i: [k], w: [1] }, pos: [s, 0] })));
  const pr = C.seamPairs(two, lone, 30, true), held = (side, p) => new Set(pr.filter(q => q[side].i.length === 1).map(q => q[side].i[0]));
  assert.deepStrictEqual([...held(0)].sort(), [0, 1, 2, 3], "every point of the first side is a stitch");
  assert.deepStrictEqual([...held(1)].sort(), [0, 1, 2, 3], "and of the second");
  assert.strictEqual(C.seamPairs(two, lone, 30).length, 2, "without `every` only the even places");
  // a strip pinned at its top and pulled down at its bottom by the pointer as hard as it pulls (1 N): with its fabric's
  // limit it stretches a little, without it several times as much
  const pulled = (maxStretch) => {
    const m = sheet(100, 300, 10), sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x, 1500 - y, 0]), fab: { ...FAB, maxStretch } }], pins: edge(m, (x, y) => y < 1e-6).map(v => ({ p: 0, v })), opt: { ground: false, self: false } });
    const bot = edge(m, (x, y) => y > 300 - 1e-6);
    for (let f = 0; f < 120; f++) { C.clothDrag(sim, { i: bot, to: [50, 600, 0] }); C.clothStep(sim, 1/60); }
    let lo = Infinity; for (let i = 0; i < sim.n; i++) lo = Math.min(lo, sim.x[3*i+1]);
    return [C.clothStrain(sim), 1500 - lo];
  };
  const lim = pulled(0.08), free = pulled(0);
  assert.ok(lim[0] < 0.3 && lim[1] < 300*1.15, "limited: worst edge " + lim[0].toFixed(3) + ", the strip " + lim[1].toFixed(0) + " mm long (300 at rest)");
  assert.ok(free[0] > 2*lim[0], "without a limit it stretches more: " + free[0].toFixed(3));
  const o = boot({ blank: true, script: `
    const ph = app.ev("fabricPhys"), item = app.ev("normLibItem");
    return [item("fabric", { physical: "Single jersey" }, 1).maxStretch, item("fabric", { physical: "Heavy woven" }, 2).maxStretch, item("fabric", { physical: "Heavy woven", maxStretch: 12 }, 3).maxStretch,
      ph(item("fabric", { physical: "Rib knit" }, 4)).maxStretch, app.ev("FILE_VERSION")];` }).result;
  assert.deepStrictEqual(o, [30, 5, 12, 0.5, 26]);      // (the file version: 26 since Round r26; 25 since Round r25; 24 since Round r20; 23 since the r19 follow-up; 22 since Round r18; 21 since Round r17b; 20 since Round build-1; 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
});

/* ---------- 4: the strain map ---------- */
test("r9 / 4: the strain map colours every triangle of the cloth by its stretch on the viridis ramp (its brightness rises all the way, so it reads in order without telling red from green), with a legend in %; it is a switch of the garment's rendering options, kept per machine", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const rows = app.ev("render3Items")().map(r => r.n).filter(Boolean);
    out.row = rows.includes("Strain Map");
    app.ev("setStrainMap")(true);
    const g = v3.group("strain"), it = G3.items.get(A.id), ov = G3.strain.get(A.id), col = ov.geometry.attributes.color.array;
    out.on = [g.visible, G3.strain.size, ov.geometry.attributes.position.count === it.mesh.tri.length];
    out.flat = [col[0], col[1], col[2]].map(v => +v.toFixed(3));
    // stretched 10 % across: half way up the scale
    const c = it.mesh.c; for (let i = 0; i < it.X.length; i += 3) it.X[i] *= 1.1;
    app.ev("garmentLines")();
    out.half = Array.from(ov.geometry.attributes.color.array.slice(0, 3)).map(v => +v.toFixed(3));
    const st0 = app.ev("triStrain")(it.mesh, it.X)[0]; out.want = app.ev("viridis")(st0/0.2).map(v => +v.toFixed(3)); out.st0 = st0;
    out.top = +G3.strainTop.toFixed(3);
    out.legend = app.el("strain3d").innerHTML; out.shown = app.el("strain3d").style.display;
    out.saved = JSON.parse(app.storage.get("pdraft:ui")).strain3;      // (Round r23 / 1: a map is view state, not written)
    app.ev("setStrainMap")(false); out.off = [g.visible, G3.strain.size, app.el("strain3d").style.display];
    // the ramp: brightness (relative luminance) rises from one stop to the next
    out.lum = app.ev("VIRIDIS").map(h => { const c = [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)/255).map(v => v <= 0.03928 ? v/12.92 : Math.pow((v + 0.055)/1.055, 2.4)); return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]; });
    out.mid = app.ev("viridis")(0.5).map(v => +v.toFixed(3));
    return out;` }).result;
  assert.strictEqual(o.row, true);
  assert.deepStrictEqual(o.on, [true, 2, true], "one mesh a pattern, three corners a triangle");
  assert.deepStrictEqual(o.flat, [0x44/255, 0x01/255, 0x54/255].map(v => +v.toFixed(3)), "unstretched: the bottom of the ramp");
  near(o.top, 0.1, 0.002, "10 % stretched");
  assert.deepStrictEqual(o.half, o.want, "the first triangle's colour is its strain's place on the 20 % scale");
  assert.ok(o.st0 > 0.04 && o.st0 < 0.101, "and it is stretched: " + o.st0);
  assert.deepStrictEqual(o.mid, [0x26/255*0.5 + 0x1f/255*0.5, 0x82/255*0.5 + 0x9e/255*0.5, 0x8e/255*0.5 + 0x89/255*0.5].map(v => +v.toFixed(3)), "half way up the ramp: teal");
  assert.ok(/20\+ %/.test(o.legend) && /0 %/.test(o.legend) && /10 %/.test(o.legend) && /Most now: 10[.]0 %/.test(o.legend), o.legend);
  assert.strictEqual(o.shown, "block"); assert.strictEqual(o.saved, undefined);
  assert.deepStrictEqual(o.off, [false, 0, "none"]);
  for (let k = 1; k < o.lum.length; k++) assert.ok(o.lum[k] > o.lum[k-1], "brighter at every stop: " + o.lum.map(v => v.toFixed(3)));
});

/* ---------- 5: tacks ---------- */
test("r9 / 5 solver: a hold pulls a place of the cloth to its point and keeps it there, closing no faster than a seam does", () => {
  const m = sheet(200, 200, 10), corner = edge(m, (x, y) => x < 1e-6 && y < 1e-6)[0];
  const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x, 1000, y]), fab: FAB }], holds: [{ a: { p: 0, i: [corner], w: [1] }, to: [-60, 1100, 0] }], opt: { self: false, ground: false } });
  C.clothStep(sim, 1/60);
  const d1 = Math.hypot(sim.x[3*corner] + 60, sim.x[3*corner+1] - 1100, sim.x[3*corner+2]);
  for (let f = 0; f < 120; f++) C.clothStep(sim, 1/60);
  const d = Math.hypot(sim.x[3*corner] + 60, sim.x[3*corner+1] - 1100, sim.x[3*corner+2]);
  assert.ok(d1 > 1, "not there in one frame: " + d1.toFixed(2)); assert.ok(d < 0.5, "held at its point: " + d.toFixed(3));
});

test("r9 / 5: Tack: a place on one pattern's cloth, then one on the other's, held together in the simulation; one undo step, listed in the Object Browser, in the file; Edit Tack selects it and Delete removes it", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    return (async () => {
      const ev = (q) => { const s = v3.project(new THREE.Vector3(q[0], q[1], q[2])); return { clientX: s.x, clientY: s.y, button: 0, buttons: 1 }; };
      app.ev("view3d.scene()").updateMatrixWorld(true);
      app.setTool3("tack");
      const T3 = app.TOOL3.tack, steps0 = app.histSteps().steps.length;
      out.first = T3.down(ev([30, 1000, 120])); out.waiting = !!G3.tackFrom;
      Object.assign(v3.cam, { az: Math.PI }); app.ev("view3d.scene()").updateMatrixWorld(true);      // from behind: the back is in front
      out.second = T3.down(ev([-40, 1050, -120]));
      Object.assign(v3.cam, { az: 0 });
      out.tacks = JSON.parse(JSON.stringify(S.tacks)); out.step = app.histSteps().steps.slice(steps0).map(s => s.n);
      // the Object Browser's Tack tab
      app.ev("obSelect")("tack", null); out.ob = app.el("ob-items").children.map(c => c.innerHTML).join("");
      // simulated: the two places meet
      app.simToggle(); for (let i = 0; i < 90; i++) app.ev("simFrame")(); app.simToggle();
      const pos = app.ev("tackPos"), t = S.tacks[0], A = pos(t.a), B = pos(t.b);
      out.apart = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      // saved and opened again
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      out.inFile = app.fileDoc(file).tacks;
      app.ev("openFile")("t.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened t/.test(x)), "the file to open");
      out.opened = JSON.parse(JSON.stringify(S.tacks));
      // Edit Tack: a click on it selects it, Delete takes it away
      app.ev("garmentSync")(); app.ev("garmentLines")(); app.ev("view3d.scene()").updateMatrixWorld(true);
      app.setTool3("edit_tack"); const sc = G3.tackScreen[0];
      out.sel = app.TOOL3.edit_tack.down(ev(sc.A)) && G3.selTack;
      S.over3d = true; app.key("Delete"); out.after = S.tacks.length;
      app.undo(); out.undone = S.tacks.length;
      // a tack whose pattern is deleted goes with it
      const gone = S.tacks[0].b.piece; app.push("Delete"); S.pieces = S.pieces.filter(p => p.id !== gone); app.commit(); out.gone = S.tacks.length;
      return out;
    })();` }).result;
  assert.deepStrictEqual([o.first, o.waiting, o.second], [true, true, true]);
  assert.strictEqual(o.tacks.length, 1); assert.ok(o.tacks[0].b && !o.tacks[0].av, "fabric to fabric");
  assert.notStrictEqual(o.tacks[0].a.piece, o.tacks[0].b.piece, "one end on each pattern");
  assert.deepStrictEqual(o.step, ["Tack"]);
  assert.ok(/Tack 1/.test(o.ob) && /Front to Back/.test(o.ob), o.ob);
  assert.ok(o.apart < 1, "the two places held together: " + o.apart);
  assert.deepStrictEqual(o.inFile, o.tacks, "in the file"); assert.deepStrictEqual(o.opened, o.tacks, "and read back");
  assert.strictEqual(o.sel, 1); assert.strictEqual(o.after, 0, "Delete removes it"); assert.strictEqual(o.undone, 1, "undo brings it back");
  assert.strictEqual(o.gone, 0, "a tack whose pattern is gone goes too");
});

test("r9 / 5: Tack on Avatar holds a place of the cloth on the avatar, a cloth's thickness off the skin, and follows the avatar when it is made taller; a file of version 12 opens with no tacks", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    return (async () => {
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      app.ev("setAvatar")({ cell: 20 });
      // the front's cloth: a place on it, and a place on Marty's chest
      const it = G3.items.get(A.id), q = { piece: A.id, x: 150, y: 50 };
      const chest = app.ev("avatarHit")({ o: new THREE.Vector3(0, 1350, 600), d: new THREE.Vector3(0, 0, -1), rc: null });
      out.hit = !!chest;
      const at = app.ev("avatarTriAt")([chest.x, chest.y, chest.z]);
      app.ev("addTack")(q, null, { x: chest.x, y: chest.y, z: chest.z, ...at });
      out.kind = [!!S.tacks[0].av, S.tacks[0].b, Number.isInteger(S.tacks[0].av.t)];
      app.simToggle(); for (let i = 0; i < 120; i++) app.ev("simFrame")(); app.simToggle();
      const P = app.ev("tackPos")(q), f = app.ev("avatarField")(S.av);
      out.d = [Math.hypot(P[0] - chest.x, P[1] - chest.y, P[2] - chest.z), app.ev("SIM3D").sdfAt(f, P[0], P[1], P[2]), app.ev("fabricPhys")(app.ev("fabricOf")(A)).thick];
      // the avatar made 10 % taller: the tack's point on the skin goes up with it
      const before = app.ev("tackAvPoint")(S.tacks[0].av), h0 = S.av.height;
      app.ev("setAvatar")({ height: h0*1.1 });
      const after = app.ev("tackAvPoint")(S.tacks[0].av);
      out.follow = [before[1], after[1], h0];
      // a version 12 document (no tacks in it)
      const d = JSON.parse(app.ev("docJSON")(1)); d.v = 12; delete d.tacks;
      app.ev("loadDoc")(d); out.v12 = S.tacks;
      return out;
    })();` }).result;
  assert.strictEqual(o.hit, true);
  assert.deepStrictEqual(o.kind, [true, null, true]);
  assert.ok(o.d[0] < o.d[2] + 2, "held at the place on the skin, a thickness off it: " + o.d[0].toFixed(2) + " mm (thickness " + o.d[2] + ")");
  assert.ok(o.d[1] > o.d[2] - 2, "and not in the body: " + o.d[1].toFixed(2));
  near(o.follow[1], o.follow[0]*1.1, 3, "the point on the skin follows the avatar's height");
  assert.deepStrictEqual(o.v12, []);
});

/* ---------- 6: shapes ---------- */
test("r9 / 6: Internal Spiral: a click inside a pattern is its centre, a dialog sets turns, spacing, start radius and direction (with a preview); the spiral is an internal line that follows the true spiral, can be sewn and lies on the cloth in 3D; one undo step", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {};
    S.pieces.push(app.mkPiece("Panel", app.mkShape([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }], true))); app.commit();
    const P = S.pieces[0], steps0 = app.histSteps().steps.length;
    app.setTool("internal_spiral");
    let asked = null, pv = null;
    app.answer = (t, f, opts) => { asked = [t, f.map(x => x.k)]; pv = opts.preview({ turns: 2, sp: 30, r0: 15, dir: "ccw" }); out.pvIds = [S.nextSegId, S.nextShapeId]; return { turns: 2, sp: 30, r0: 15, dir: "ccw" }; };
    const ids0 = [S.nextSegId, S.nextShapeId];
    const c = app.toS({ x: 200, y: 200 }); app.click(c.x, c.y);
    out.asked = asked; out.preview = pv && pv.length; out.idsKept = JSON.stringify(out.pvIds) === JSON.stringify(ids0);
    const sh = P.internals[P.internals.length - 1];
    out.shape = [sh.closed, sh.pts.length, sh.segs.every(s => s.curved && s.cps && s.cps.length === 5)];
    // every place along it lies on r = 15 + 30 θ / 2π, turning anticlockwise on the screen (y down: the angle runs the other way)
    let worst = 0, last = 0, wound = 0;
    for (let i = 0; i < sh.segs.length; i++) for (let k = 0; k <= 40; k++) {
      const q = app.segPt(sh, i, k/40), dx = q.x - 200, dy = q.y - 200, ang = Math.atan2(-dy, dx);
      let d = ang - last; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; wound += d; last = ang;
      worst = Math.max(worst, Math.abs(Math.hypot(dx, dy) - (15 + 30*wound/(2*Math.PI))));
    }
    out.worst = worst; out.wound = wound/(2*Math.PI);
    out.steps = app.histSteps().steps.slice(steps0).map(s => s.n);
    // sewn: a seam from the spiral to the panel's top edge becomes matched places on the cloth
    app.ev("setLayout")("both");
    app.push("Sew"); S.seams.push({ id: 1, a: [{ piece: P.id, shape: sh.id, sids: sh.segs.map(s => s.id), t0: 0, t1: 1, rev: false }], b: [{ piece: P.id, shape: 0, sids: [P.segs[0].id], t0: 0, t1: 1, rev: false }] }); app.commit();
    app.ev("garmentSync")();
    const sm = app.simSeams([P.id]);
    out.sewn = sm.length === 1 && sm[0].pairs.length > 10;
    // on the cloth: the internal line is drawn on it
    app.ev("garmentLines")();
    out.lines3 = app.ev("view3d.group")("lines").children.length > 0;
    app.undo(); app.undo(); out.undone = S.pieces[0].internals.length;
    return out;` }).result;
  assert.deepStrictEqual(o.asked, ["Create Internal Spiral", ["turns", "sp", "r0", "dir"]]);
  assert.strictEqual(o.preview, 1); assert.strictEqual(o.idsKept, true, "the preview takes no ids");
  assert.deepStrictEqual(o.shape, [false, 5, true], "an open line: a point every half turn, a curve point every 30° between");
  assert.ok(o.worst < 0.1, "on the true spiral within 0.1 mm: " + o.worst);
  near(o.wound, 2, 0.01, "two turns, anticlockwise");
  assert.deepStrictEqual(o.steps, ["Internal Spiral"]);
  assert.strictEqual(o.sewn, true, "sewable");
  assert.strictEqual(o.lines3, true, "drawn on the cloth");
  assert.strictEqual(o.undone, 0);
});

/* ---------- 7: fill ---------- */
// two 300 mm squares of single jersey lying on each other, sewn all round, no gravity: a cushion
function cushion(fa, fb) {
  const W = 300, res = 15, A = sheet(W, W, res), B = sheet(W, W, res), KNIT = { weight: 160, stretch: 3e5, bend: 4, friction: 0.4, thick: 4.5, maxStretch: 0.3 };
  const loop = (m, p) => C.seamPath([...Array.from(m.loop), m.loop[0]].map(v => ({ a: { p, i: [v], w: [1] }, pos: [m.xy[2*v], m.xy[2*v+1]] })));
  const sim = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 1000 - y, 0]), fab: KNIT, fill: fa }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x, 1000 - y, 0]), fab: KNIT, fill: fb }],
    seams: [{ id: 1, pairs: C.seamPairs(loop(A, 0), loop(B, 1), res, true) }], opt: { gravity: 0, ground: false, self: false } });
  let gap = 0;
  for (let f = 0; f < 300; f++) { C.clothStep(sim, 1/60); gap = Math.max(gap, maxGap(sim)); }
  const cen = (k) => { const o = sim.off[k], e = k ? sim.n : sim.off[1], c = [0, 0, 0]; for (let i = o; i < e; i++) for (let j = 0; j < 3; j++) c[j] += sim.x[3*i+j]/(e - o); return c; };
  const a = cen(0), b = cen(1);
  return { a, b, sep: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), gap, groups: sim.fillGroups || [] };
}
test("r9 / 7 solver: two squares sewn all round with fill swell into a cushion, both faces alike; more fill swells it more; the seam stays shut; fill 0 changes nothing", () => {
  const none = cushion(0, 0), half = cushion(50, 50), full = cushion(100, 100);
  assert.ok(none.sep < 0.5 && none.gap < 1e-6, "fill 0: the two squares stay as they lay: " + none.sep);
  assert.ok(half.sep > 20, "fill 50 swells it: the faces " + half.sep.toFixed(1) + " mm apart");
  near(half.a[2], -half.b[2], 0.15*half.sep, "both faces alike, one each way");
  assert.ok(full.sep > half.sep*1.5, "fill 100 swells it more: " + full.sep.toFixed(1) + " against " + half.sep.toFixed(1));
  assert.ok(half.gap < 1 && full.gap < 1, "the seam never opened by 1 mm: " + half.gap.toFixed(3) + ", " + full.gap.toFixed(3));
  const g = full.groups[0];
  assert.ok(g && Math.abs(g.vol - g.want) < 0.15*g.want, "it settles near its volume: " + (g && (g.vol/1e6).toFixed(2)) + " L of " + (g && (g.want/1e6).toFixed(2)) + " L");
});

test("r9 / 7: Fill is a pattern's property in the Property Editor (a slider and a number, 0 to 100), kept in the file only when it is above 0, and the simulation swells a cushion of two patterns with it", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3, SIM = app.SIM;
    app.ev("setLayout")("both");
    const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:0},{x:x+300,y:0},{x:x+300,y:300},{x:x,y:300}], true));
    S.pieces.push(sq("Top", 0), sq("Under", 400)); app.commit();
    const A = S.pieces[0], B = S.pieces[1];
    // sewn all round (B's outline the other way round, as when it is turned to face A)
    app.push("Sew"); for (let i = 0; i < 4; i++) S.seams.push({ id: i + 1, a: [{ piece: A.id, shape: 0, sids: [A.segs[i].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[[0, 3, 2, 1][i]].id], t0: 0, t1: 1, rev: true }] });
    A.p3 = { pos: [0, 1100, 0], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, 0], q: [0, 1, 0, 0], r: 0 };
    S.cloth = app.normCloth({ ...S.cloth, res: 20, self: false, worker: false });
    app.ev("S.lib.fabric[0].physical = 'Single jersey'"); app.commit();
    // the Property Editor shows Fill for the selected pattern
    S.sel = [A.id]; app.ev("ui")(); out.editor = /id="pp-fill-r"[^>]*type|type="range" id="pp-fill-r"/.test(app.el("props").innerHTML) && /id="pp-fill"/.test(app.el("props").innerHTML);
    out.saved0 = "fill" in JSON.parse(app.docJSON(1)).pieces[0];
    app.push("Fill"); A.fill = 80; B.fill = 80; app.commit();
    out.saved = JSON.parse(app.docJSON(1)).pieces.map(p => p.fill);
    app.ev("garmentSync")();
    const it = (p) => G3.items.get(p.id), cz = (p) => { const X = it(p).X; let z = 0; for (let i = 2; i < X.length; i += 3) z += X[i]; return z/(X.length/3); };
    out.z0 = [cz(A), cz(B)];
    app.simToggle(); for (let i = 0; i < 150; i++) app.ev("simFrame")(); app.simToggle();
    out.z1 = [cz(A), cz(B)];
    out.gaps = app.ev("SIM3D").clothSeamGaps(SIM.sim).filter(Boolean).map(g => g.max);
    return out;` }).result;
  assert.strictEqual(o.editor, true, "a slider and a number in the Property Editor");
  assert.strictEqual(o.saved0, false, "no fill: nothing written");
  assert.deepStrictEqual(o.saved, [80, 80]);
  assert.ok(Math.abs(o.z1[0] - o.z1[1]) > 20, "the two faces swelled apart: " + o.z1.map(v => v.toFixed(1)) + " (from " + o.z0.map(v => v.toFixed(1)) + ")");
  assert.ok(Math.max(...o.gaps) < 1, "every seam shut: " + o.gaps);
});

/* ---------- 8: pleats ---------- */
test("r9 / 8: the Pleat tool (as Round r15 / 9 made it): its box, then a line and its side; knife or box, depth; the pattern is spread by the pleat's width with mountain and valley fold lines in it, and with Fold in 3D its cloth comes out folded to the width it had; one undo step", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3;
    app.ev("setLayout")("both");
    const panel = (x) => { const p = app.mkPiece("Skirt " + x, app.mkShape([{ x, y: 0 }, { x: x + 300, y: 0 }, { x: x + 300, y: 200 }, { x, y: 200 }], true)); S.pieces.push(p); app.commit(); app.addChild(p, "internals", app.mkShape([{ x: x + 150, y: 0 }, { x: x + 150, y: 200 }], false)); app.commit(); return p; };
    const bb = (p) => { const xs = p.pts.map(q => q.x); return Math.max(...xs) - Math.min(...xs); };
    const A = panel(0), B = panel(600);
    // (Round r15 / 9: the Pleat tool is the reference's: its box opens when it is picked, then a click on the line and one on
    // the side the pleats go to; it used to take lines picked one by one and a box with Type, Depth, Direction, Fold in 3D)
    const at = (x, y) => app.toS({ x, y });
    app.answer = (t, f) => { out.dlg = [t, f.map(x => x.k + (x.options ? ":" + x.options.map(z => z[0]).join("/") : ""))]; return { type: "knife", n: 1, d0: 20, d1: 20, i0: 10, i1: 10, notch: "both", angles: "0-360", out: 0, inn: 360, rev: false, rev2: false }; };
    app.setTool("pleats");
    const steps0 = app.histSteps().steps.length;
    let q = at(150, 100); app.click(q.x, q.y);
    out.sel = !!S.pleatPick;
    q = at(200, 100); app.click(q.x, q.y); out.unpicked = S.pleatPick ? 1 : 0;
    const a = S.pieces.find(p => p.name === "Skirt 0");
    out.width = bb(a); out.folds = a.internals.filter(x => x.fold).map(x => x.fold); out.arr = (a.fold || []).map(f => [f.angle, f.side === 1 || f.side === -1]);
    out.steps = app.histSteps().steps.slice(steps0).map(s => s.n);
    // in 3D, folded: the cloth's width across is the pattern's width before the pleat
    app.ev("garmentSync")();
    const X = G3.items.get(a.id).X, xs = []; for (let i = 0; i < X.length; i += 3) xs.push(X[i]);
    out.width3 = Math.max(...xs) - Math.min(...xs);
    // a box pleat on the other panel (always laid folded in 3D now)
    app.answer = () => ({ type: "box", n: 1, d0: 15, d1: 15, i0: 10, i1: 10, notch: "both", angles: "0-360", out: 0, inn: 360 }); app.key("Enter");
    q = at(750, 100); app.click(q.x, q.y); q = at(800, 100); app.click(q.x, q.y);
    const b = S.pieces.find(p => p.name === "Skirt 600");
    out.box = [bb(b), b.internals.filter(x => x.fold).length, (b.fold || []).length];
    app.undo(); out.undone = bb(S.pieces.find(p => p.name === "Skirt 600"));
    return out;` }).result;
  assert.strictEqual(o.sel, true, "the line picked"); assert.strictEqual(o.unpicked, 0, "the click on its side made the pleat");
  assert.deepStrictEqual(o.dlg, ["Pleats", ["type:knife/box/accordion", "n", "d0", "d1", "i0", "i1", "notch:both/start/end/none", "angles:0-360/360-0", "out", "inn"]]);
  near(o.width, 340, 0.01, "a knife pleat of depth 20 lets in 40");
  assert.deepStrictEqual(o.folds.sort(), ["mountain", "valley"]);
  assert.deepStrictEqual(o.arr.map(x => x[1]), [true, true], "two folds in 3D, each with its side");
  assert.deepStrictEqual(o.arr.map(x => Math.sign(x[0])).sort(), [-1, 1], "one each way");
  assert.deepStrictEqual(o.steps, ["Pleats"]);
  near(o.width3, 300, 6, "folded in 3D: as wide as the pattern was");
  near(o.box[0], 360, 0.01, "a box pleat of depth 15 lets in 60"); assert.strictEqual(o.box[1], 4, "its four fold lines"); assert.strictEqual(o.box[2], 4, "laid folded in 3D");
  near(o.undone, 300, 0.01);
});

/* ---------- 9: buttons ---------- */
test("r9 / 9: Button and Buttonhole are placed in 2D (the type from the Object Browser), drawn in 3D as a disc and a slit; Fasten Button joins them and the simulation holds them together; Assign changes a placed one's type; in the file; Delete and undo", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    return (async () => {
      const at = (x, y) => app.toS({ x, y }), click = (x, y) => { const q = at(x, y); app.click(q.x, q.y); };
      // a second, larger button type, picked in the Object Browser
      app.push("Add"); S.lib.button.push(app.ev("normLibItem")("button", { name: "Big", width: 30, shape: "Square" }, S.lib.nextId++)); app.commit();
      const big = S.lib.button[1].id;
      app.ev("obSelect")("button", big);
      app.setTool("button2d"); click(150, 100);
      app.setTool("buttonhole2d"); click(550, 100);
      out.placed = S.buttons.map(b => [b.kind, b.piece === A.id ? "A" : "B", Math.round(b.x), Math.round(b.y), b.lib === big]);
      // fasten: the button, then the buttonhole
      app.setTool("fasten2d"); click(150, 100); click(550, 100);
      out.fastened = S.buttons[0].fasten === S.buttons[1].id;
      out.steps = app.histSteps().steps.map(s => s.n).filter(n => /Button/.test(n));
      // in 3D: a box (Square) for the button, a line for the buttonhole
      app.ev("garmentSync")(); app.ev("garmentLines")();
      out.meshes = v3.group("buttons3").children.map(c => c.geometry.type);
      // simulated: the button's place and the buttonhole's meet
      app.simToggle(); for (let i = 0; i < 90; i++) app.ev("simFrame")(); app.simToggle();
      const P = app.ev("tackPos"), a = P({ piece: A.id, x: S.buttons[0].x, y: S.buttons[0].y }), b = P({ piece: B.id, x: S.buttons[1].x, y: S.buttons[1].y });
      out.apart = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      // Assign: the first button type to the selected button
      S.selBtn = S.buttons[0].id; app.ev("obSelect")("button", S.lib.button[0].id); app.ev("obAssign")(); out.assigned = S.buttons[0].lib === S.lib.button[0].id;
      // the file
      out.inFile = JSON.parse(app.docJSON(1)).buttons.map(b => [b.kind, b.fasten]);
      // Delete the selected one (the buttonhole): the button is unfastened
      app.setTool("buttonhole2d"); click(550, 100); out.sel = S.selBtn === S.buttons[1].id;
      app.key("Delete"); out.afterDel = [S.buttons.length, S.buttons[0].fasten];
      app.undo(); out.undone = [S.buttons.length, S.buttons[0].fasten === S.buttons[1].id];
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.placed, [["button", "A", 150, 100, true], ["hole", "B", 550, 100, false]]);
  assert.strictEqual(o.fastened, true);
  assert.deepStrictEqual(o.steps, ["Button", "Buttonhole", "Fasten Button"]);
  assert.deepStrictEqual(o.meshes, ["BoxGeometry", "BufferGeometry"], "a square button, a buttonhole's slit");
  assert.ok(o.apart < 1, "held together: " + o.apart);
  assert.strictEqual(o.assigned, true);
  assert.deepStrictEqual(o.inFile, [["button", 2], ["hole", null]]);
  assert.strictEqual(o.sel, true); assert.deepStrictEqual(o.afterDel, [1, null]); assert.deepStrictEqual(o.undone, [2, true]);
});

module.exports = T;
