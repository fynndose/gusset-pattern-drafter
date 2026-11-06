// Round r11: bending across the seams (1), Fill as a tool (2), piping (3), binding (4), gluing (5). A test (or more) a batch.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const C = require("../drafter-sim.js");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  // long options (files as base64) go through a file: a Windows command line holds at most 32 767 characters
  let arg = JSON.stringify(opt || {});
  if (arg.length > 30000) { const f = path.join(require("os").tmpdir(), "pdraft-boot-" + process.pid + ".json"); require("fs").writeFileSync(f, arg); arg = "@" + f; }
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), arg], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}

/* ---------- 1: bending across the seams ---------- */
// a rectangle meshed as the program meshes a pattern: its outline cut into steps of the particle distance (pieceLoop())
function sheet(w, h, res) {
  const L = [], side = (x0, y0, x1, y1) => { const k = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)/res)); for (let j = 0; j < k; j++) L.push([x0 + (x1 - x0)*j/k, y0 + (y1 - y0)*j/k]); };
  side(0, 0, w, 0); side(w, 0, w, h); side(w, h, 0, h); side(0, h, 0, 0);
  return C.meshPolygon(L, res);
}
const lay = (m, f) => { const n = m.xy.length/2, X = new Float32Array(3*n); for (let i = 0; i < n; i++) X.set(f(m.xy[2*i], m.xy[2*i+1]), 3*i); return X; };
const edge = (m, f) => Array.from({ length: m.xy.length/2 }, (_, i) => i).filter(i => f(m.xy[2*i], m.xy[2*i+1])).sort((p, q) => m.xy[2*p+1] - m.xy[2*q+1]);
const side = (m, p, vs) => C.seamPath(vs.map(v => ({ a: { p, i: [v], w: [1] }, pos: [m.xy[2*v], m.xy[2*v+1]] })));
const FAB = { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 4.35, maxStretch: 0.08 };
function cylinder(r, y0, y1, n) { const t = [], P = (a, y) => [r*Math.cos(a), y, r*Math.sin(a)]; for (let k = 0; k < n; k++) { const a = 2*Math.PI*k/n, b = 2*Math.PI*(k + 1)/n, A0 = P(a, y0), B0 = P(b, y0), A1 = P(a, y1), B1 = P(b, y1); t.push(...A0, ...A1, ...B1, ...A0, ...B1, ...B0, 0, y1, 0, ...B1, ...A1, 0, y0, 0, ...A0, ...B0); } return new Float32Array(t); }
const strains = (sim) => { const a = []; for (let c = 0; c < sim.eI.length; c++) { const i = sim.eI[c], j = sim.eJ[c]; a.push(Math.hypot(sim.x[3*i] - sim.x[3*j], sim.x[3*i+1] - sim.x[3*j+1], sim.x[3*i+2] - sim.x[3*j+2])/sim.eL[c] - 1); } return a.sort((p, q) => p - q); };

test("r11 / 1: bending across a seam: two patterns sewn edge to edge and laid flat get one bending link a stitch, each at rest (the distance it keeps is the flat one); with seamBend 0 there are none", () => {
  const W = 200, H = 200, res = 10, A = sheet(W, H, res), B = sheet(W, H, res);
  const seams = [{ id: 1, pairs: C.seamPairs(side(A, 0, edge(A, (x) => x > W - 1e-6)), side(B, 1, edge(B, (x) => x < 1e-6)), res, true) }];
  const pieces = [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 500, y]), fab: FAB }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x + W, 500, y]), fab: FAB }];
  const sim = C.clothBuild({ pieces, seams, opt: { self: false, ground: false } });
  assert.strictEqual(sim.opt.seamBend, 5, "on by default, five times the softer fabric's bending");
  const stitches = sim.sOf.length;
  assert.ok(sim.xI.length >= stitches - 3 && sim.xI.length <= stitches, sim.xI.length + " bending links for " + stitches + " stitches (none at the seam's two ends)");
  for (let c = 0; c < sim.xI.length; c++) {
    const i = sim.xI[c], j = sim.xJ[c], d = Math.hypot(sim.x[3*i] - sim.x[3*j], sim.x[3*i+1] - sim.x[3*j+1], sim.x[3*i+2] - sim.x[3*j+2]);
    near(d, sim.xL[c], 1e-4, "link " + c + " is at rest when the two lie flat");
    assert.ok(sim.piece[i] !== sim.piece[j], "a link runs across the seam, from one pattern to the other");
    near(sim.xA[c], 1/(5*FAB.bend), 1e-12, "its compliance");
  }
  assert.strictEqual(C.clothBuild({ pieces, seams, opt: { seamBend: 0 } }).xI.length, 0);
});

test("r11 / 1: a sewn edge resists folding: one pattern held flat, the one sewn to it hangs over the edge and droops less with bending across the seam than without", () => {
  const W = 200, H = 200, res = 10, run = (seamBend) => {
    const A = sheet(W, H, res), B = sheet(W, H, res);
    const seams = [{ id: 1, pairs: C.seamPairs(side(A, 0, edge(A, (x) => x > W - 1e-6)), side(B, 1, edge(B, (x) => x < 1e-6)), res, true) }];
    const sim = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 500, y]), fab: FAB }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x + W, 500, y]), fab: FAB }], seams,
      pins: Array.from({ length: A.xy.length/2 }, (_, v) => ({ p: 0, v })), opt: { self: false, ground: false, seamBend, easeIn: 0 } });
    for (let f = 0; f < 60; f++) C.clothStep(sim, 1/60);
    // how far the hanging pattern's cloth 10 to 25 mm past the seam has dropped below the held one: the kink at the seam
    let y = 0, n = 0; for (let i = sim.off[1]; i < sim.n; i++) if (sim.rest[2*i] > 10 && sim.rest[2*i] < 25 && sim.rest[2*i+1] > 30 && sim.rest[2*i+1] < H - 30) { y += 500 - sim.x[3*i+1]; n++; }
    return y/n;
  };
  const hinge = run(0), stiff = run(5);
  assert.ok(stiff < hinge - 1, "the drop just past the seam: " + stiff.toFixed(2) + " mm with bending across the seam, " + hinge.toFixed(2) + " without");
});

test("r11 / 1: two patterns sewn into a tube 15 % smaller round than a cylinder (r9's acceptance tube, meshed as the program meshes): with bending across the seams the largest stretch and the 95th percentile are lower, every seam stays shut and no ridge stands at the seams", () => {
  const run = (seamBend) => {
    const R = 100, W = 0.85*Math.PI*R, H = 200, res = 10, rr = R + FAB.thick, M = [sheet(W, H, res), sheet(W, H, res)];
    const pieces = M.map((m, k) => ({ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => { const th = Math.PI*k + Math.PI*x/W; return [rr*Math.cos(th), 1100 - y, rr*Math.sin(th)]; }), fab: FAB }));
    const seams = [0, 1].map(k => ({ id: k + 1, pairs: C.seamPairs(side(M[k], k, edge(M[k], (x) => x > W - 1e-6)), side(M[1-k], 1 - k, edge(M[1-k], (x) => x < 1e-6)), res, true) }));
    const sim = C.clothBuild({ pieces, seams, field: C.buildSDF(cylinder(R, 700, 1300, 96), { cell: 8 }), opt: { self: false, ground: false, seamBend } });
    let gap = 0;
    for (let f = 0; f < 240; f++) { C.clothStep(sim, 1/60); for (const g of C.clothSeamGaps(sim)) if (g) gap = Math.max(gap, g.max); }
    // the mean radius of the cloth within 20 mm of a seam on the flat pattern, and of the rest
    let a = 0, na = 0, b = 0, nb = 0;
    for (let i = 0; i < sim.n; i++) { const d = Math.min(sim.rest[2*i], W - sim.rest[2*i]), r = Math.hypot(sim.x[3*i], sim.x[3*i+2]); if (d < 20) { a += r; na++; } else { b += r; nb++; } }
    const s = strains(sim);
    return { gap, max: s[s.length - 1], p95: s[Math.floor(0.95*(s.length - 1))], ridge: a/na - b/nb };
  };
  const off = run(0), on = run(5);
  assert.ok(on.gap < 1 && off.gap < 1, "the seams stay shut: " + on.gap + ", " + off.gap);
  assert.ok(on.max < off.max - 0.05, "the largest stretch: " + on.max.toFixed(3) + " with, " + off.max.toFixed(3) + " without");
  assert.ok(on.p95 <= off.p95 + 1e-9, "the 95th percentile: " + on.p95.toFixed(3) + " with, " + off.p95.toFixed(3) + " without");
  assert.ok(Math.abs(on.ridge) < 1, "no ridge: the cloth beside the seams stands " + on.ridge.toFixed(2) + " mm further out than the rest");
});

/* ---------- 2: Fill as a tool ---------- */
test("r11 / 2: the solver takes a new fill while it runs (clothFill), the same in the worker as in the page, to the last bit: two panels sewn at their sides swell once given fill", () => {
  const vm = require("vm");
  const W = 200, H = 200, res = 10, spec = () => {
    const A = sheet(W, H, res), B = sheet(W, H, res);
    const seams = [{ id: 1, pairs: C.seamPairs(side(A, 0, edge(A, (x) => x > W - 1e-6)), side(B, 1, edge(B, (x) => x > W - 1e-6)), res, true) }, { id: 2, pairs: C.seamPairs(side(A, 0, edge(A, (x) => x < 1e-6)), side(B, 1, edge(B, (x) => x < 1e-6)), res, true) }];
    return { pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 1000 - y, 3]), fab: FAB }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x, 1000 - y, -3]), fab: FAB }], seams, opt: { self: false, ground: false, gravity: 0 } };
  };
  const here = C.clothBuild({ ...spec(), field: null }), out = [], self = { postMessage: (m) => out.push(m) };
  vm.runInNewContext(C.workerSource(), { self, Float32Array, Float64Array, Int32Array, Uint32Array, Uint16Array, Uint8Array, Int8Array, Map, Set, Math, Object, Array, Number, String, Error, Infinity, NaN, performance, Date });
  const send = (m) => self.onmessage({ data: structuredClone(m) });
  send({ t: "build", id: 3, spec: spec(), field: null });
  for (let f = 0; f < 10; f++) { send({ t: "step", id: 3 }); C.clothStep(here, 1/60); }
  assert.strictEqual(here.fillF, null, "no fill yet");
  C.clothFill(here, [60, 60]); send({ t: "fill", id: 3, fills: [60, 60] }); send({ t: "fill", id: 2, fills: [100, 100] });      // (one for an earlier build: dropped)
  for (let f = 0; f < 60; f++) { send({ t: "step", id: 3 }); C.clothStep(here, 1/60); }
  assert.deepStrictEqual(Array.from(out[out.length - 1].x), Array.from(new Float32Array(here.x)), "the worker's cloth is the page's");
  assert.ok(here.fillGroups.length === 1 && here.fillGroups[0].vol > 1e5, "it swelled: " + JSON.stringify(here.fillGroups));
  C.clothFill(here, [0, 0]); assert.strictEqual(here.fillF, null, "fill taken away again");
});

// two rectangles in front of each other in 3D, sewn at both sides (as r10's tests): Front 0,0 to 300,400 and Back 400,0 to 700,400 (2D)
const SEWN = `
  const out = {}, G3 = app.G3, SIM = app.SIM, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] });
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 });
  const steps = () => app.histSteps().steps.map(s => s.n);
`;

test("r11 / 2: Fill (2D): a click on a pattern opens a box with a slider and a number; every change goes to the pattern at once (the same value as the Property Editor's field), all of them one undo step \"Fill\"; the Object Browser marks the pattern; Cancel takes it back", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    app.setTool("fill");
    const n0 = steps().length, at = app.toS({ x: 150, y: 200 });
    let asked = null; const seen = [];
    app.answer = (title, fields, opts) => { asked = [title, fields.map(f => [f.k, f.val, f.unit, f.range])]; opts.preview({ fill: 30 }); seen.push(A.fill); opts.preview({ fill: 60 }); seen.push(A.fill); return { fill: 60 }; };
    app.click(at.x, at.y);
    out.asked = asked; out.seen = seen; out.fill = A.fill; out.steps = steps().slice(n0);
    S.sel = [A.id]; app.ev("ui")();
    out.pe = (app.el("props").innerHTML.match(/id="pp-fill"[^>]*value="([0-9]+)"/) || [])[1]; out.ob = app.el("list").children.slice(-2).map(c => c.innerHTML).join(" ");      // (the page stand-in keeps every row ever added: the last two are the list now)
    // Cancel: the change made while the box was open is taken back, and no step is left
    app.answer = (title, fields, opts) => { opts.preview({ fill: 90 }); out.during = A.fill; return null; };
    app.click(at.x, at.y);
    out.cancel = [A.fill, steps().slice(n0)];
    app.undo(); out.undone = [S.pieces[0].fill === undefined, S.pieces[1].fill === undefined, /FILL/.test(app.el("list").children.slice(-2).map(c => c.innerHTML).join(" "))];
    // a locked pattern says so
    S.pieces[0].lock = true; app.commit(); app.answer = () => { out.lockedAsked = true; return null; }; app.click(at.x, at.y); out.locked = toasts[toasts.length - 1];
    return out;` }).result;
  assert.deepStrictEqual(o.asked, ["Fill \u2014 Front", [["fill", 0, "%", [0, 100]]]]);
  assert.deepStrictEqual(o.seen, [30, 60], "each change is on the pattern at once");
  assert.strictEqual(o.fill, 60); assert.deepStrictEqual(o.steps, ["Fill"], "one undo step for the whole box");
  assert.strictEqual(o.pe, "60", "the Property Editor's Fill shows the same value"); assert.ok(/FILL 60/.test(o.ob), "the Object Browser marks the pattern: " + o.ob);
  assert.strictEqual(o.during, 90); assert.deepStrictEqual(o.cancel, [60, ["Fill"]], "Cancel puts the value back and leaves no step");
  assert.deepStrictEqual(o.undone, [true, true, false], "undo: no fill, no mark");
  assert.ok(!o.lockedAsked && /locked/.test(o.locked), "a locked pattern: " + o.locked);
});

test("r11 / 2: Fill (3D) while simulating: a click on the cloth opens the box; the slider's value reaches the running solver without building it again, the simulation goes on, and the cloth swells; a press in 2D with Fill in hand does not stop it either", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    app.ev("setTool3")("fill_3d"); out.tool2 = S.tool;
    app.simToggle(); for (let i = 0; i < 20; i++) app.ev("simFrame")();
    const sim0 = SIM.sim, vol = () => { app.ev("simFrame")(); const g = (SIM.sim.fillGroups || [])[0]; return g ? g.vol : 0; };
    const c = A.p3.pos, s = v3.project(new THREE.Vector3(c[0], c[1], c[2] + 5)), e = { clientX: s.x, clientY: s.y, button: 0, buttons: 1 };
    let title = null;
    app.answer = (t, fields, opts) => { title = t; opts.preview({ fill: 80 }); return { fill: 80 }; };
    out.down = app.TOOL3.fill_3d.down(e);
    out.title = title; out.fill = [A.fill, B.fill];
    out.v0 = SIM.sim.fillGroups ? SIM.sim.fillGroups.length : 0;
    let v1 = 0; for (let i = 0; i < 60; i++) v1 = vol();
    out.after = { on: SIM.on, same: SIM.sim === sim0, solverFill: Array.from(SIM.sim.fill), v1 };
    // a click in 2D with Fill in hand opens the box on the other pattern and the simulation goes on
    app.answer = (t, fields, opts) => { opts.preview({ fill: 40 }); return { fill: 40 }; };
    const b = app.toS({ x: 550, y: 200 }); app.click(b.x, b.y); app.ev("simFrame")();
    out.twoD = { on: SIM.on, same: SIM.sim === sim0, solverFill: Array.from(SIM.sim.fill), B: B.fill };
    app.simToggle();
    out.steps = steps().filter(n => n === "Fill" || n === "Simulate");
    return out;` }).result;
  assert.strictEqual(o.tool2, "fill", "the 2D Fill is in hand too"); assert.strictEqual(o.down, true);
  assert.strictEqual(o.title, "Fill \u2014 Front"); assert.deepStrictEqual(o.fill, [80, null], "(no fill on the back: none in the result)");
  assert.strictEqual(o.v0, 0, "no fill before");
  assert.deepStrictEqual([o.after.on, o.after.same, o.after.solverFill], [true, true, [80, 0]], "still simulating, the same solver, which has the new fill");
  assert.ok(o.after.v1 > 1e5, "the cloth swells: " + o.after.v1 + " mm³");
  assert.deepStrictEqual([o.twoD.on, o.twoD.same, o.twoD.solverFill, o.twoD.B], [true, true, [80, 40], 40], "a click in 2D with Fill: the simulation goes on");
  assert.deepStrictEqual(o.steps, ["Simulate", "Fill", "Fill"]);
});

/* ---------- 3: piping ---------- */
test("r11 / 3: a rod in the solver (what piping and binding are): its weight hangs on the cloth at its nodes, and it holds its line of the cloth to its own length and limit (a rod a tenth shorter than the edge gathers it)", () => {
  const W = 200, H = 200, res = 10, m = sheet(W, H, res);
  // the sheet held along its top edge, hanging out flat over nothing; the rod along its bottom edge
  const bottom = edge(m, (x, y) => y > H - 1e-6).sort((p, q) => m.xy[2*p] - m.xy[2*q]), top = edge(m, (x, y) => y < 1e-6);
  const nodes = bottom.map(v => ({ p: 0, i: [v], w: [1] })), d = (i, j) => Math.hypot(m.xy[2*bottom[i]] - m.xy[2*bottom[j]], m.xy[2*bottom[i]+1] - m.xy[2*bottom[j]+1]);
  const rod = { a: nodes, m: 0.05, k: 2e5, ks: 4e7, lim: 0.02, S: nodes.slice(1).map((_, j) => 0.9*d(j, j + 1)), L: nodes.slice(2).map((_, j) => 0.9*d(j, j + 2)) };
  const run = (rods) => {
    const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x, 1000, y]), fab: { ...FAB, maxStretch: 0 } }], rods, pins: top.map(v => ({ p: 0, v })), opt: { self: false, ground: false, easeIn: 0 } });
    const mass = sim.mass.reduce((a, b) => a + b, 0);
    for (let f = 0; f < 90; f++) C.clothStep(sim, 1/60);
    let y = 0, worst = -Infinity; for (const v of bottom) y += sim.x[3*v+1];
    for (let j = 0; j + 1 < bottom.length; j++) { const a = 3*bottom[j], b = 3*bottom[j+1]; worst = Math.max(worst, Math.hypot(sim.x[a] - sim.x[b], sim.x[a+1] - sim.x[b+1], sim.x[a+2] - sim.x[b+2])/d(j, j + 1) - 1); }
    return { mass, y: y/bottom.length, worst };
  };
  const without = run([]), withRod = run([rod]);
  near(withRod.mass - without.mass, 0.05*nodes.length, 1e-9, "its weight, every node's");
  assert.ok(withRod.worst <= 0.9*1.02*1.01 - 1, "the edge is held to the rod's length and its 2 % limit (within 1 % of it): " + withRod.worst.toFixed(4));
  assert.ok(Math.abs(without.worst) < 0.02, "(without it the edge keeps its own length: " + without.worst.toFixed(4) + ")");
});

test("r11 / 3: Piping (3D): a click on a seam on the cloth opens its box (cord diameter, from, to, fabric, side); it is one undo step, listed in the Object Browser, drawn as beads along both edges in 2D and as a tube in 3D, a rod in the solver; Edit Piping changes it, Delete removes it; it is saved (version 14) and opened again; a seam deleted takes its piping with it", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    return (async () => {
      const pos = app.ev("tackPos"), scr = (pid, x, y) => { const P = pos({ piece: pid, x, y }); return v3.project(new THREE.Vector3(P[0], P[1], P[2])); };
      const ev = (q) => ({ clientX: q.x, clientY: q.y, button: 0, buttons: 1 });
      app.ev("view3d.scene()").updateMatrixWorld(true);
      app.setTool3("piping");
      // a click on the cloth away from any seam: no piping, it says why
      let asked = null; app.answer = (t, f, opts) => { asked = [t, f.map(x => [x.k, x.val, x.unit]), (opts.selects || []).map(c => [c.k, c.val, c.options.length])]; return { d: 5, t0: 10, t1: 90, fabric: c0.val, side: "out" }; };
      const c0 = { val: "" };
      out.miss = app.TOOL3.piping.down(ev(scr(A.id, 150, 200))); out.missSaid = toasts[toasts.length - 1];
      // the seam at the front's right side
      app.answer = (t, f, opts) => { asked = [t, f.map(x => [x.k, x.val, x.unit]), (opts.selects || []).map(c => [c.k, c.val, c.options.length])]; return { d: 5, t0: 10, t1: 90, fabric: opts.selects[0].val, side: "in" }; };
      const n0 = steps().length;
      out.hit = app.TOOL3.piping.down(ev(scr(A.id, 299.5, 200)));
      out.asked = asked; out.pipings = JSON.parse(JSON.stringify(S.pipings)); out.steps = steps().slice(n0);
      // drawn: 2D (no error), 3D a tube
      app.draw(); app.ev("garmentLines")();
      const g = v3.group("trims"); out.tube = g.children.filter(c => c.userData.trim).map(c => [c.userData.trim.kind, c.geometry.attributes.position.count]);
      // the Object Browser's Piping tab
      app.ev("obSelect")("piping", null); out.ob = app.el("ob-items").children.slice(-1).map(c => c.innerHTML).join("");
      // the solver: one rod along the seam, its weight a node
      const rods = app.ev("simRods")(app.SIM.order.length ? app.SIM.order : S.pieces.map(p => p.id));
      out.rod = rods.map(r => [r.a.length, +r.m.toFixed(5), r.S.length, r.L.length]);
      out.perMm = app.ev("pipingMassPerMm")(S.pipings[0]);
      app.simToggle(); for (let i = 0; i < 10; i++) app.ev("simFrame")(); out.simRods = app.SIM.sim.rI.length; app.simToggle();
      // Edit Piping: a click on it opens it; the diameter changed
      app.setTool3("edit_piping");
      app.answer = (t, f, opts) => { out.editTitle = t; return { d: 6, t0: 10, t1: 90, fabric: opts.selects[0].val, side: "out" }; };
      out.edit = app.TOOL3.edit_piping.down(ev(scr(A.id, 299.5, 200))); out.edited = [S.pipings[0].d, S.pipings[0].side, steps().slice(-1)[0]];
      // saved and opened again
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      out.inFile = [app.fileDoc(file).v, app.fileDoc(file).pipings];
      app.ev("openFile")("p.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened p/.test(x)), "the file to open");
      out.opened = JSON.parse(JSON.stringify(S.pipings));
      // Delete with Edit Piping in hand removes the selected one; undo brings it back
      app.setTool3("edit_piping"); app.ev("trimSelect")("piping", S.pipings[0].id); S.over3d = true; app.key("Delete"); out.deleted = [S.pipings.length, steps().slice(-1)[0]];
      app.undo(); out.undone = S.pipings.length;
      // the seam deleted: its piping goes with it
      app.push("Delete"); S.seams = S.seams.filter(sm => sm.id !== S.pipings[0].seam); app.commit(); out.withSeam = S.pipings.length;
      return out;
    })();` }).result;
  assert.strictEqual(o.miss, true); assert.ok(/into a seam/.test(o.missSaid), o.missSaid);
  assert.strictEqual(o.hit, true);
  assert.deepStrictEqual(o.asked.slice(0, 2), ["Piping \u2014 seam 1", [["d", 4, "mm"], ["t0", 0, "%"], ["t1", 100, "%"]]]); assert.deepStrictEqual(o.asked[2].map(c => c[0]), ["fabric", "side"]);
  assert.deepStrictEqual(o.pipings.map(t => [t.id, t.seam, t.d, t.t0, t.t1, t.side, t.name]), [[1, 1, 5, 0.1, 0.9, "in", "Piping 1"]]); assert.deepStrictEqual(o.steps, ["Piping"]);
  assert.ok(o.tube.length === 1 && o.tube[0][0] === "piping" && o.tube[0][1] > 50, "a tube in 3D: " + JSON.stringify(o.tube));
  assert.ok(/Piping 1/.test(o.ob) && /\u00d8 5/.test(o.ob) && /inside/.test(o.ob), "listed: " + o.ob);
  assert.strictEqual(o.rod.length, 1); assert.ok(o.rod[0][0] >= 15 && o.rod[0][2] === o.rod[0][0] - 1 && o.rod[0][3] === o.rod[0][0] - 2, "a rod of nodes along 80 % of the seam: " + o.rod);
  near(o.rod[0][1], o.perMm*320/(o.rod[0][0] - 1), 1e-4, "its weight a node: the cord and its strip");
  assert.ok(o.simRods > 0, "the running solver has its links");
  assert.deepStrictEqual([o.edit, o.editTitle, o.edited], [true, "Edit Piping \u2014 seam 1", [6, "out", "Edit Piping"]]);
  assert.strictEqual(o.inFile[0], 31);      /* ((Round H1a: version 31) (Round r34: version 30) ((Round r33b: version 29) version 28 since Round r30 (a seam's mirror); 28 since Round r30, 27 since Round r29 (a document's render settings); 26 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1;) */ assert.deepStrictEqual(o.inFile[1].map(t => [t.id, t.seam, t.d]), [[1, 1, 6]]);      // (version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
  assert.deepStrictEqual(o.opened, o.inFile[1], "opened as saved");
  assert.deepStrictEqual(o.deleted, [0, "Delete Piping"]); assert.strictEqual(o.undone, 1); assert.strictEqual(o.withSeam, 0);
});

test("r11 / 3: files of version 13 and older open with no piping, binding or gluing (version 11 text and version 12)", () => {
  const fs = require("fs"), files = ["v11/sewn-arranged-draped.pdraft", "v12/skirt-on-the-marty-of-8-oct.pdraft"].map(f => fs.readFileSync(path.join(__dirname, "files", f)).toString("base64"));
  const o = boot({ blank: true, streams: true, script: `
    return (async () => {
      const out = [];
      for (const [k, b] of ${JSON.stringify(files)}.entries()) {
        const n0 = toasts.length; app.ev("openFile")("f" + k + ".pdraft", app.ev("bytesOf")(b), null, true); await app.wait(() => toasts.slice(n0).some(x => /^Opened f/.test(x)), "the file");
        out.push([S.pieces.length > 0, S.pipings, S.bindings, S.glues]);
      }
      return out;
    })();` }).result;
  assert.deepStrictEqual(o, [[true, [], [], []], [true, [], [], []]]);
});

/* ---------- 4: binding ---------- */
test("r11 / 4: Binding (3D): a click on a free edge on the cloth opens its box (width, fabric, run on); it runs on along the free edge up to a sewn one, or is the one line; a sewn edge is refused; one undo step, listed, a rod in the solver, a strip in 3D; Add Point on it keeps it on the whole edge; Select Binding changes it, Delete removes it; saved and opened again", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    return (async () => {
      const pos = app.ev("tackPos"), scr = (pid, x, y) => { const P = pos({ piece: pid, x, y }); return v3.project(new THREE.Vector3(P[0], P[1], P[2])); };
      const ev = (q) => ({ clientX: q.x, clientY: q.y, button: 0, buttons: 1 });
      app.ev("view3d.scene()").updateMatrixWorld(true);
      app.setTool3("binding");
      // a sewn edge (the front's right side) is refused
      let asked = null; app.answer = () => { asked = "asked"; return null; };
      out.sewn = [app.TOOL3.binding.down(ev(scr(A.id, 299.5, 200))), asked, toasts[toasts.length - 1]];
      // the front's hem: its two sides are sewn, so it is the one line
      app.answer = (t, f, opts) => { asked = [t, f.map(x => [x.k, x.val, x.unit]), (opts.selects || []).map(c => c.k), (opts.checks || []).map(c => [c.k, c.label, c.val])]; return { w: 12, fabric: opts.selects[0].val, runOn: true }; };
      const n0 = steps().length;
      out.hit = app.TOOL3.binding.down(ev(scr(A.id, 150, 399.5)));
      out.asked = asked; out.b1 = S.bindings.map(b => [b.id, b.w, b.part.sids.map(id => A.segs.findIndex(s => s.id === id))]); out.steps = steps().slice(n0);
      // the back's left side unsewn: its hem runs on round its free edges (hem, left side, top) up to the sewn right side
      app.push("Delete Sewing"); S.seams = S.seams.filter(sm => sm.id !== 1); app.commit();
      Object.assign(v3.cam, { az: Math.PI }); app.ev("view3d.scene()").updateMatrixWorld(true);      // from behind: the back is in front
      out.back = app.TOOL3.binding.down(ev(scr(B.id, 550, 399.5)));
      Object.assign(v3.cam, { az: 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
      out.b2 = S.bindings.slice(1).map(b => b.part.sids.map(id => B.segs.findIndex(s => s.id === id)));
      // unticked: the line clicked only (the front's left side, now free)
      app.answer = (t, f, opts) => ({ w: 8, fabric: opts.selects[0].val, runOn: false });
      app.TOOL3.binding.down(ev(scr(A.id, 299.5, 300)));
      out.b3 = S.bindings.slice(2).map(b => [b.w, b.part.sids.map(id => A.segs.findIndex(s => s.id === id))]);
      app.draw(); app.ev("garmentLines")();
      out.strips = v3.group("trims").children.filter(c => c.userData.trim && c.userData.trim.kind === "binding").length;
      const order = S.pieces.map(p => p.id), rods = app.ev("simRods")(order);
      out.rods = rods.length; out.perMm = app.ev("bindingMassPerMm")(S.bindings[0]); out.fw = app.ev("fabricPhys")(app.ev("trimFab")(S.bindings[0])).weight;
      app.ev("obSelect")("binding", null); out.ob = app.el("ob-items").children.slice(-3).map(c => c.innerHTML).join(" ");
      // Add Point on the front's hem: the binding stays on the whole hem (both halves)
      const fa = S.pieces[0]; app.push("Add Point"); app.ev("addPoint")(fa, 2, 0.5); app.commit();
      out.split = [S.pieces[0].segs.length, S.bindings[0].part.sids.map(id => S.pieces[0].segs.findIndex(s => s.id === id))];
      // Select Binding: a click on it opens it; Delete removes the selected one
      app.setTool3("select_binding");
      app.answer = (t, f, opts) => { out.editTitle = t; return { w: 15, fabric: opts.selects[0].val }; };
      app.ev("garmentSync")(); app.ev("view3d.scene()").updateMatrixWorld(true);
      out.sel = app.TOOL3.select_binding.down(ev(scr(S.pieces[0].id, 100, 399.5))); out.edited = S.bindings[0].w;
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      out.inFile = app.fileDoc(file).bindings.map(b => [b.id, b.w]);
      app.ev("openFile")("b.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened b/.test(x)), "the file to open");
      out.opened = S.bindings.map(b => [b.id, b.w]);
      app.setTool3("select_binding"); app.ev("trimSelect")("binding", S.bindings[0].id); app.key("Delete"); out.deleted = [S.bindings.length, steps().slice(-1)[0]];
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.sewn.slice(0, 2), [true, null]); assert.ok(/sewn/.test(o.sewn[2]), o.sewn[2]);
  assert.strictEqual(o.hit, true);
  assert.deepStrictEqual(o.asked, ["Binding \u2014 Front", [["w", 10, "mm"]], ["fabric"], [["runOn", "Run on along the free edge (1 line)", true]]]);
  assert.deepStrictEqual(o.b1, [[1, 12, [2]]]); assert.deepStrictEqual(o.steps, ["Binding"]);
  assert.strictEqual(o.back, true); assert.deepStrictEqual(o.b2, [[2, 3, 0]], "the hem, then the free left side and the top, in the outline's order (the right side is sewn)");
  assert.deepStrictEqual(o.b3, [[8, [1]]], "run on unticked: the one line");
  assert.strictEqual(o.strips, 3); assert.strictEqual(o.rods, 3);
  near(o.perMm, o.fw*1e-6*(2*12 + 2), 1e-12, "two faces of 12 mm and the fold, in its fabric's weight (" + o.fw + " g/m²)");
  assert.ok(/Binding 1/.test(o.ob) && /Binding 3/.test(o.ob), o.ob);
  assert.deepStrictEqual(o.split, [5, [2, 3]], "Add Point on the hem: the binding covers both halves");
  assert.deepStrictEqual([o.sel, o.editTitle, o.edited], [true, "Edit Binding \u2014 Front", 15]);
  assert.deepStrictEqual(o.inFile, [[1, 15], [2, 12], [3, 8]]); assert.deepStrictEqual(o.opened, o.inFile);
  assert.deepStrictEqual(o.deleted, [2, "Delete Binding"]);
});

/* ---------- 5: gluing ---------- */
// two rectangles lying on each other in 3D, the front 4 mm before the back, both facing forward: Upper 0,0 to 300,400, Under 400,0 to 700,400 (2D)
const LAYERS = `
  const out = {}, G3 = app.G3, SIM = app.SIM, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Upper", 0, 0, 300, 400), sq("Under", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1];
  A.p3 = { pos: [0, 1100, 124], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 };
  A.pins = Array.from({ length: 13 }, (_, k) => ({ x: 25*k, y: 0 }));            // the upper layer hangs from its top edge; the under one is free
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
  const steps = () => app.histSteps().steps.map(s => s.n), pos = app.ev("tackPos"), scr = (pid, x, y) => { const P = pos({ piece: pid, x, y }); return v3.project(new THREE.Vector3(P[0], P[1], P[2])); };
  const ev = (q, more) => ({ clientX: q.x, clientY: q.y, button: 0, buttons: 1, ...more });
  // how far the under layer's middle has dropped
  const midY = (p) => { const X = G3.items.get(p.id).X; let y = 0; for (let i = 1; i < X.length; i += 3) y += X[i]; return y/(X.length/3); };
`;
test("r11 / 5: Gluing, an area: a box dragged over two layers lying on each other bonds the one pressed on to the one under it there (its place on the other fitted once, flat to flat); in the simulation the layers move as one there: the free under layer hangs on the pinned upper one instead of falling; listed, drawn, saved; Delete removes it", () => {
  const o = boot({ blank: true, three: true, script: LAYERS + `
    return (async () => {
      // without glue: the under layer falls away
      app.simToggle(); for (let i = 0; i < 40; i++) app.ev("simFrame")(); out.fallen = midY(B); app.simToggle(); app.undo();
      app.ev("garmentSync")(); app.ev("view3d.scene()").updateMatrixWorld(true);
      app.setTool3("gluing");
      const a = scr(A.id, 80, 120), b = scr(A.id, 220, 280), n0 = app.histSteps().at;
      out.down = app.TOOL3.gluing.down(ev(a)); app.TOOL3.gluing.move(ev({ x: (a.x + b.x)/2, y: (a.y + b.y)/2 })); app.TOOL3.gluing.move(ev(b)); app.TOOL3.gluing.up(ev(b));
      out.glues = S.glues.map(g => [g.kind, g.a === A.id, g.b === B.id, g.poly.length >= 3, g.m.map(v => +v.toFixed(1))]);
      out.poly = S.glues[0] ? S.glues[0].poly.map(q => [Math.round(q.x), Math.round(q.y)]) : null;
      out.steps = steps().slice(n0); out.said = toasts[toasts.length - 1];      // (the steps done: the undone Simulate is gone)
      out.pairs = app.ev("simGlues")(S.pieces.map(p => p.id)).map(g => g.pairs.length);
      app.draw(); app.ev("garmentLines")(); out.drawn = v3.group("trims").children.filter(c => c.userData.glue != null).length;
      app.ev("obSelect")("glue", null); out.ob = app.el("ob-items").children.slice(-1).map(c => c.innerHTML).join("");
      // with glue: the under layer is held where it is glued
      app.simToggle(); for (let i = 0; i < 40; i++) app.ev("simFrame")(); out.held = midY(S.pieces[1]); app.simToggle();
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      out.inFile = app.fileDoc(file).glues.map(g => [g.id, g.kind, g.m.length]);
      app.ev("openFile")("g.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened g/.test(x)), "the file to open");
      out.opened = S.glues.map(g => [g.id, g.kind, g.m.length]);
      app.setTool3("gluing"); app.ev("trimSelect")("glue", S.glues[0].id); app.key("Delete"); out.deleted = [S.glues.length, steps().slice(-1)[0]];
      return out;
    })();` }).result;
  assert.strictEqual(o.down, true);
  assert.deepStrictEqual(o.glues, [["area", true, true, true, [1, 0, 400, 0, 1, 0]]], "the upper layer glued to the under one, a place on it 400 mm to the right on the flat patterns");
  assert.ok(o.poly.every(([x, y]) => x >= 70 && x <= 230 && y >= 110 && y <= 290), "the area is what the box took: " + JSON.stringify(o.poly));
  assert.deepStrictEqual(o.steps, ["Gluing"]); assert.ok(/^Glued Upper to Under over [0-9.]+ cm/.test(o.said), o.said);
  assert.ok(o.pairs.length === 1 && o.pairs[0] >= 20, "the area's cloth points, each bonded: " + o.pairs);
  assert.strictEqual(o.drawn, 2, "its outline on both layers in 3D"); assert.ok(/Glue 1/.test(o.ob) && /area/.test(o.ob), o.ob);
  assert.ok(o.fallen < 1100 - 150, "without glue the under layer falls: its middle at " + o.fallen.toFixed(0));
  assert.ok(o.held > 1100 - 60, "glued, it hangs with the upper one: its middle at " + o.held.toFixed(0));
  assert.deepStrictEqual(o.inFile, [[1, "area", 6]]); assert.deepStrictEqual(o.opened, o.inFile);
  assert.deepStrictEqual(o.deleted, [0, "Delete Gluing"]);
});

test("r11 / 5: Gluing, a line: a click on a seam bonds it instead of stitching: no stitches drawn in 3D, a wave in 2D, twice the bending across it in the solver; a click on it again selects it; Delete takes the bond away and the seam stays, stitched", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const pos = app.ev("tackPos"), scr = (pid, x, y) => { const P = pos({ piece: pid, x, y }); return v3.project(new THREE.Vector3(P[0], P[1], P[2])); };
    const ev = (q) => ({ clientX: q.x, clientY: q.y, button: 0, buttons: 1 });
    app.ev("view3d.scene()").updateMatrixWorld(true); app.ev("garmentLines")();
    out.threadsBefore = [...G3.thread.keys()].filter(k => k[0] === "t").map(k => k.slice(1).split(":")[0]).sort();      // (the threads, keyed t… since Round r14 / 8)
    app.setTool3("gluing");
    const q = scr(A.id, 299.5, 200); app.TOOL3.gluing.down(ev(q)); app.TOOL3.gluing.up(ev(q));
    out.glues = S.glues.map(g => [g.id, g.kind, g.seam]); out.step = steps().slice(-1)[0];
    app.draw(); app.ev("garmentLines")();
    out.threads = [...G3.thread.keys()].filter(k => k[0] === "t").map(k => k.slice(1).split(":")[0]).sort();
    out.dots = v3.group("trims").children.filter(c => c.userData.glue != null).length;
    // the solver: the glued seam's bending across is twice the other's (its compliance half)
    app.simToggle(); app.ev("simFrame")();
    const sim = SIM.sim, by = {}; for (let c = 0; c < sim.xI.length; c++) { const sm = SIM.seams.filter(x => !x.skip)[sim.sOf[sim.xS[c]]]; (by[sm.id] = by[sm.id] || []).push(sim.xA[c]); }
    out.comp = Object.keys(by).sort().map(k => +(by[k][0]*1e5).toFixed(4)); app.simToggle();
    let asked = null; app.answer = (t) => { asked = t; return {}; };
    S.selTrim = null; app.ev("view3d.scene()").updateMatrixWorld(true);
    const q2 = scr(A.id, 299.5, 200);                     // (where the seam is now: the simulation moved it)
    app.TOOL3.gluing.down(ev(q2)); app.TOOL3.gluing.up(ev(q2)); out.again = [S.glues.length, asked];
    app.key("Delete"); out.deleted = [S.glues.length, S.seams.length];
    return out;` }).result;
  assert.deepStrictEqual(o.threadsBefore, ["1", "2"]);
  assert.deepStrictEqual(o.glues, [[1, "line", 1]]); assert.strictEqual(o.step, "Gluing");
  assert.deepStrictEqual(o.threads, ["2"], "the glued seam has no stitches in 3D"); assert.strictEqual(o.dots, 1, "it shows as dots along it");
  assert.strictEqual(o.comp.length, 2); near(o.comp[0]*2, o.comp[1], 1e-6, "seam 1 glued: half the compliance across it of seam 2: " + o.comp);
  assert.deepStrictEqual(o.again, [1, "Gluing \u2014 Glue 1"], "a click on it again selects it");
  assert.deepStrictEqual(o.deleted, [0, 2], "the bond gone, both seams stay");
});

module.exports = T;
