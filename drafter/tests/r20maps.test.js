// Round r20 continued (4), batch 2: the Stress Map and the Pressure Map (Fit Maps; A10 p.37). The solver's forces (only while a
// map shows them), Laplace's law on a tight tube, the maps' values, units, scale, legend and probe, and the pictures.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const C = require("../drafter-sim.js");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  let arg = JSON.stringify(opt || {});
  if (arg.length > 30000) { const f = path.join(require("os").tmpdir(), "pdraft-boot-r20maps-" + process.pid + ".json"); fs.writeFileSync(f, arg); arg = "@" + f; }
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), arg], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}

// two panels sewn into a tube 15 % small round a cylinder of radius 100 (as scripts/strain-tube.js), single jersey
function tube(forces) {
  const FAB = { weight: 160, stretch: 3e5, bend: 4, friction: 0.4, thick: 3, maxStretch: 0.3 };
  const R = 100, K = 2, W = 0.85*2*Math.PI*R/K, H = 200, res = 10, rr = R + FAB.thick, M = [], pieces = [];
  const sheet = () => { const L = [], side = (x0, y0, x1, y1) => { const k = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)/res)); for (let j = 0; j < k; j++) L.push([x0 + (x1 - x0)*j/k, y0 + (y1 - y0)*j/k]); }; side(0, 0, W, 0); side(W, 0, W, H); side(W, H, 0, H); side(0, H, 0, 0); return C.meshPolygon(L, res); };
  const lay = (m, f) => { const n = m.xy.length/2, X = new Float32Array(3*n); for (let i = 0; i < n; i++) X.set(f(m.xy[2*i], m.xy[2*i+1]), 3*i); return X; };
  const edge = (m, f) => Array.from({ length: m.xy.length/2 }, (_, i) => i).filter(i => f(m.xy[2*i])).sort((p, q) => m.xy[2*p+1] - m.xy[2*q+1]);
  const side = (m, p, vs) => C.seamPath(vs.map(v => ({ a: { p, i: [v], w: [1] }, pos: [m.xy[2*v], m.xy[2*v+1]] })));
  const cyl = (r, y0, y1, n) => { const t = [], P = (a, y) => [r*Math.cos(a), y, r*Math.sin(a)]; for (let k = 0; k < n; k++) { const a = 2*Math.PI*k/n, b = 2*Math.PI*(k + 1)/n, A0 = P(a, y0), B0 = P(b, y0), A1 = P(a, y1), B1 = P(b, y1); t.push(...A0, ...A1, ...B1, ...A0, ...B1, ...B0, 0, y1, 0, ...B1, ...A1, 0, y0, 0, ...A0, ...B0); } return new Float32Array(t); };
  for (let k = 0; k < K; k++) { const m = sheet(); M.push(m); const th0 = 2*Math.PI*k/K; pieces.push({ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => { const th = th0 + 2*Math.PI/K*x/W; return [rr*Math.cos(th), 1100 - y, rr*Math.sin(th)]; }), fab: FAB }); }
  const seams = [];
  for (let k = 0; k < K; k++) { const a = M[k], b = M[(k + 1) % K]; seams.push({ id: k + 1, pairs: C.seamPairs(side(a, k, edge(a, (x) => x > W - 1e-6)), side(b, (k + 1) % K, edge(b, (x) => x < 1e-6)), res, true) }); }
  const sim = C.clothBuild({ pieces, seams, field: C.buildSDF(cyl(R, 700, 1300, 96), { cell: 8 }), opt: { self: false, ground: false } });
  if (forces) C.clothForces(sim, true);
  return { sim, pieces, W, rr };
}

test("solver: the forces are added up only while asked for, and change nothing: the cloth moves exactly the same with them on as off", () => {
  const a = tube(false), b = tube(true);
  for (let f = 0; f < 60; f++) { C.clothStep(a.sim, 1/60); C.clothStep(b.sim, 1/60); }
  assert.strictEqual(a.sim.press, undefined, "off: nothing kept");
  assert.ok(!a.sim.eFrc && C.clothTension(a.sim) === null);
  assert.ok(b.sim.press instanceof Float64Array && b.sim.eFrc instanceof Float64Array);
  for (let i = 0; i < a.sim.x.length; i++) if (a.sim.x[i] !== b.sim.x[i]) assert.fail("point " + (i/3 | 0) + " differs");
  C.clothForces(b.sim, false);
  assert.strictEqual(b.sim.press, null);
});

test("solver: the contact pressure on a tight tube is the solver's own tension over the radius (Laplace's law, p = T / r), within 5 %; the cloth off the body has none", () => {
  const { sim, pieces, W, rr } = tube(true);
  const acc = new Float64Array(sim.n);
  let nf = 0;
  for (let f = 0; f < 200; f++) { C.clothStep(sim, 1/60); if (f >= 140) { for (let i = 0; i < sim.n; i++) acc[i] += sim.press[i]; nf++; } }
  // the middle band, away from the tube's ends and its seams
  const area = new Float64Array(sim.n), x = sim.x, mid = (xx, y) => y >= 50 && y <= 150 && xx >= 30 && xx <= W - 30;
  pieces.forEach((pc, k) => { const o = sim.off[k], Tr = pc.tri; for (let t = 0; t < Tr.length; t += 3) { const [a, b, c] = [o + Tr[t], o + Tr[t+1], o + Tr[t+2]], u = [x[3*b]-x[3*a], x[3*b+1]-x[3*a+1], x[3*b+2]-x[3*a+2]], v = [x[3*c]-x[3*a], x[3*c+1]-x[3*a+1], x[3*c+2]-x[3*a+2]], ar = Math.hypot(u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])/6; area[a] += ar; area[b] += ar; area[c] += ar; } });
  let F = 0, A = 0;
  for (let i = 0; i < sim.n; i++) if (mid(sim.rest[2*i], sim.rest[2*i+1])) { F += acc[i]/nf; A += area[i]; }
  const Tn = C.clothTension(sim);
  let s = 0, c = 0, q = 0;
  pieces.forEach(pc => { const Tr = pc.tri; for (let t = 0; t < Tr.length; t += 3, q++) { const xm = (pc.xy[2*Tr[t]] + pc.xy[2*Tr[t+1]] + pc.xy[2*Tr[t+2]])/3, ym = (pc.xy[2*Tr[t]+1] + pc.xy[2*Tr[t+1]+1] + pc.xy[2*Tr[t+2]+1])/3; if (mid(xm, ym)) { s += Tn[q]; c++; } } });
  const p = F/A, T = s/c;           // Pa (g·mm/s² over mm²); g/s² (1e-3 N/m)
  assert.ok(T*1e-3 > 2 && T*1e-3 < 50, "a tight jersey tube's tension in N/m: " + T*1e-3);
  near(p/(T/rr), 1, 0.05, "pressure over Laplace's");
  // the tube's ends lie on the cylinder too; nothing pushes the cloth anywhere it is not touching: every value is 0 or more
  assert.ok([...sim.press].every(v => v >= 0));
});

const SEWN = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE"), SIM = app.SIM;
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] });
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 });
  const leg = () => app.el("strain3d").innerHTML.replace(/<select[^]*?<\\/select>/g, "").replace(/<[^>]+>/g, "|").split("|").map(s => s.trim()).filter(Boolean);
`;

test("Stress Map (Alt+6), % strain: every triangle's larger principal stretch less one, on the viridis ramp between the legend's Min and Max; one map at a time; the scale per unit, kept per machine", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const itA = G3.items.get(A.id), itB = G3.items.get(B.id);
    // the front stretched by 12 % across only, the back left as it is: its principal strain is 12, its other is 0
    { const n = itA.X.length/3; let cx = 0; for (let i = 0; i < n; i++) cx += itA.X[3*i]/n; for (let i = 0; i < n; i++) itA.X[3*i] = cx + (itA.X[3*i] - cx)*1.12; }
    app.key("7", { altKey: true });
    app.key("6", { altKey: true }); out.on = [S.ui.stress3, S.ui.strain3, S.ui.fit3, !!S.ui.press3];
    S.ui.mapUnit = { stress: "pct" }; app.ev("strainShow")();
    const vA = Array.from(itA.mapVals), vB = Array.from(itB.mapVals);
    out.vals = [Math.min(...vA), Math.max(...vA), Math.max(...vB.map(Math.abs))];
    out.leg = leg();
    const g = v3.group("strain"), colA = g.children.find(m => m.userData.mesh === itA.mesh).geometry.attributes.color.array;
    out.col = Array.from(colA.slice(0, 3)).map(v => Math.round(v*255));
    // the scale: Max 12 puts the front at the top of the ramp (yellow), typed in the legend
    app.ev("mapRangeSet")("stress", "pct", [0, 12]); out.col12 = Array.from(g.children.find(m => m.userData.mesh === itA.mesh).geometry.attributes.color.array.slice(0, 3)).map(v => Math.round(v*255));
    out.range = [JSON.stringify(S.ui.mapRange), JSON.stringify(app.ev("normUI")(JSON.parse(JSON.stringify(S.ui))).mapRange)];
    out.ticks = leg().slice(1, 6);
    app.ev("mapRangeSet")("stress", "pct", null); out.reset = S.ui.mapRange["stress:pct"] === undefined;
    // kPa needs the simulation's forces: none yet
    S.ui.mapUnit = { stress: "kPa" }; app.ev("strainShow")(); out.noSim = leg().slice(-1)[0];
    app.key("6", { altKey: true }); out.off = [!!S.ui.stress3, app.el("strain3d").style.display];
    out.defaults = app.ev("normUI")({}).stress3 === undefined && app.ev("normUI")({}).mapRange === undefined;
    return out;` }).result;
  assert.deepStrictEqual(o.on, [true, false, false, false], "Alt+6: the stress map on, the strain map off");
  near(o.vals[0], 12, 0.05, "every triangle of the front"); near(o.vals[1], 12, 0.05); near(o.vals[2], 0, 0.01, "the back is not stretched");
  assert.deepStrictEqual(o.leg.slice(0, 6), ["Stress (% strain)", "0.00", "5.00", "10.0", "15.0", "20.0+"]);
  assert.ok(/Most now: 12\.0 %/.test(o.leg.join(" ")), o.leg.join(" | "));
  assert.ok(o.col[1] > o.col[0] && o.col[1] > o.col[2], "12 of 20: the ramp's green, " + o.col);
  assert.deepStrictEqual(o.col12, [253, 231, 37], "at its Max: the ramp's yellow");
  assert.deepStrictEqual(JSON.parse(o.range[0]), { "stress:pct": [0, 12] }); assert.strictEqual(o.range[0], o.range[1], "kept as it was set");
  assert.deepStrictEqual(o.ticks, ["0.00", "3.00", "6.00", "9.00", "12.0+"]);
  assert.ok(o.reset);
  assert.strictEqual(o.noSim, "Simulate to measure: the force comes from the simulation");
  assert.deepStrictEqual(o.off, [false, "none"]);
  assert.ok(o.defaults, "nothing of it in the settings while it is the default");
});

test("Stress (N/m, kPa) and Pressure (kPa, mmHg) come from the simulation: the solver adds the forces up only while one of them is shown; kPa is N/m over the fabric's thickness; the values stay after the run; the probe reads the value where the cloth is clicked", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    app.ev("simStart")(); for (let i = 0; i < 10; i++) app.ev("simFrame")();
    out.offRun = [SIM.forces, SIM.sim.press === undefined || SIM.sim.press === null];
    app.key("6", { altKey: true }); S.ui.mapUnit = { stress: "Nm" }; app.ev("mapForcesSync")();
    out.onRun = [SIM.forces, SIM.sim.press instanceof Float64Array];
    for (let i = 0; i < 20; i++) app.ev("simFrame")();
    app.ev("simStop")();
    const itA = G3.items.get(A.id), p = A;
    out.tens = [!!itA.tens, itA.tens.length === itA.mesh.tri.length/3, Array.from(itA.tens).every(Number.isFinite), Math.max(...itA.tens) > 0];
    app.ev("strainShow")(); const nm = Array.from(itA.mapVals);
    S.ui.mapUnit = { stress: "kPa" }; app.ev("strainShow")(); const kpa = Array.from(itA.mapVals);
    const th = app.ev("fabricPhys")(app.ev("fabricOf")(p)).thickness;
    out.kpa = Math.max(...nm.map((v, k) => Math.abs(kpa[k] - v/th)));
    out.leg = leg()[0];
    // the probe: a press on the front's cloth with the stress map on
    const X = itA.X, n = X.length/3; let m = [0, 0, 0]; for (let i = 0; i < n; i++) for (let d = 0; d < 3; d++) m[d] += X[3*i+d]/n;
    v3.tool(null);
    const c = v3.project(new THREE.Vector3(m[0], m[1], m[2] + 50));
    v3.mouse.press({ clientX: c.x, clientY: c.y, button: 0, buttons: 1, shiftKey: false }); v3.mouse.release({ clientX: c.x, clientY: c.y, button: 0 });
    out.probe = [!!G3.probe && G3.probe.id === A.id, leg().filter(s => /^Clicked/.test(s))[0] || "", G3.probeObj && G3.probeObj.visible];
    // pressure: the forces stay on; no avatar here, so nothing touches a body and the probe says so
    app.ev("setMap3")("press3", true); out.press = [S.ui.press3, !!S.ui.stress3, SIM.forces, leg()[0]];
    out.pprobe = leg().filter(s => /^Clicked/.test(s))[0] || "";
    S.ui.mapUnit = { press: "mmHg" }; app.ev("strainShow")(); out.mmhg = leg()[0];
    app.ev("setMap3")("press3", false); out.offAll = [SIM.forces, G3.probe, G3.probeObj.visible];
    return out;` }).result;
  assert.deepStrictEqual(o.offRun, [false, true], "no map: the solver adds nothing up");
  assert.deepStrictEqual(o.onRun, [true, true], "switched on while it runs");
  assert.deepStrictEqual(o.tens, [true, true, true, true]);
  assert.ok(o.kpa < 1e-6, "kPa = N/m ÷ thickness in mm: " + o.kpa);
  assert.strictEqual(o.leg, "Stress (kPa)");
  assert.strictEqual(o.probe[0], true); assert.ok(/^Clicked: [0-9.]+ kPa$/.test(o.probe[1]), o.probe[1]); assert.strictEqual(o.probe[2], true);
  assert.deepStrictEqual(o.press, [true, false, true, "Pressure (kPa)"]);
  assert.ok(/^Clicked: 0\.00 kPa \(0\.00 mmHg\), not touching$/.test(o.pprobe), o.pprobe);
  assert.strictEqual(o.mmhg, "Pressure (mmHg)");
  assert.deepStrictEqual(o.offAll, [false, null, false], "all maps off: no forces, no probe");
});

test("the pictures: a 3D Snapshot or a Render with a map shown can carry it and its legend, drawn into the picture; the boxes offer it only while a map is on", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    // (Round r23 / 6: Render… opens the Render window; what its settings column offers is read without opening it, which would draw a preview the fake page cannot paint)
    out.boxOff = [app.ev("snap3Dialog")() && /The 3D Map/.test(app.el("dlg").innerHTML), /3D map/.test(app.ev("rwinRenderHTML")())];
    app.ev("hideDlg")();
    app.key("6", { altKey: true }); S.ui.mapUnit = { stress: "pct" }; app.ev("strainShow")();
    out.boxOn = [app.ev("snap3Dialog")() && /The 3D Map and Its Legend/.test(app.el("dlg").innerHTML), /The 3D map shown and its legend/.test(app.ev("rwinRenderHTML")())];
    app.ev("hideDlg")();
    out.defaults = [app.ev("loadSnap")().d3.map, app.ev("loadRender")().map];
    // the legend painted: its title, ticks and lines as text, at the picture's bottom right
    const said = [], rects = [];
    const g = { save() {}, restore() {}, fillRect: (x, y, w, h) => rects.push([x, y, w, h]), strokeRect() {}, fillText: (s, x, y) => said.push([s, x, y]), createLinearGradient: () => ({ addColorStop() {} }) };
    app.ev("mapLegendPaint")(g, 1400, 1000);
    out.said = said.map(s => s[0]); out.box = rects[0].map(Math.round);
    return out;` }).result;
  assert.deepStrictEqual(o.boxOff, [false, false], "no map: no such row");
  assert.deepStrictEqual(o.boxOn, [true, true]);
  assert.deepStrictEqual(o.defaults, [true, true], "on unless unticked");
  assert.deepStrictEqual(o.said.slice(0, 6), ["Stress (% strain)", "0.00", "5.00", "10.0", "15.0", "20.0+"]);
  assert.ok(/^Most now/.test(o.said[6]), o.said.join(" | "));
  assert.ok(o.box[0] + o.box[2] <= 1400 && o.box[1] + o.box[3] <= 1000 && o.box[0] > 900 && o.box[1] > 700, "bottom right: " + o.box);
});

test("the menus: Settings ▸ Display ▸ Fit Maps has Stress Map (Alt+6) and Pressure Map as built rows, and the 3D window's Garment Rendering Style list under More", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const rows = app.ev("render3Items")().filter(x => x && /Map$/.test(x.n || "")).map(x => [x.n, x.k || "", !!x.off]);
    out.rows = rows;
    app.ev("render3Items")().find(x => x && x.n === "Pressure Map").f(); out.press = [!!S.ui.press3, !!S.ui.stress3];
    out.key = app.keyOf("stress3");
    return out;` }).result;
  assert.deepStrictEqual(o.rows, [["Strain Map", "Alt+7", false], ["Fit Map", "Alt+8", false], ["Stress Map", "Alt+6", false], ["Pressure Map", "", false]]);
  assert.deepStrictEqual(o.press, [true, false]);
  assert.strictEqual(o.key, "Alt+6");
});

module.exports = T;
