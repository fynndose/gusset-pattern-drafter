// Round POLISH-1: the decided polish items before beta.7. A1 each pull while simulating its own undo step (F24); A2 the fold
// line's crease straight (F26); A3 the example skirt's waistband no longer flips into itself (F31); A4 the README's key list
// made from the app's key table.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 180000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 180 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
const SEWN = `
  const out = {}, G3 = app.G3, SIM = app.SIM, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 });
  const pos = app.ev("tackPos");
  const scr = (pid, x, y) => { const P = pos({ piece: pid, x, y }); return v3.project(new THREE.Vector3(P[0], P[1], P[2])); };
  const ev = (pid, x, y, opt) => { const q = scr(pid, x, y); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1, ...(opt || {}) }; };
`;

/* ---------- A1 ---------- */
test("POLISH-1 / A1: while simulating, each pull with the mouse is its own undo step \"Pull\": undo puts the cloth back as it hung before that pull (the simulation stops first), undo again before the one before, redo forward again; a press that does not move is no step", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    app.push("Sew"); S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] }); app.commit(); app.ev("garmentSync")();
    app.ev("view3d.scene()").updateMatrixWorld(true);
    const steps = () => app.ev("histSteps")().steps.slice(0, app.ev("histSteps")().at).map(s => s.n);
    const X = () => Array.from(G3.items.get(A.id).X);
    const far = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
    app.setTool3("quick_pinching"); const T3 = app.TOOL3.quick_pinching;
    app.simToggle(); for (let i = 0; i < 6; i++) app.ev("simFrame")();
    // a press with no move: no step
    const n0 = steps().length; T3.down(ev(A.id, 150, 200)); T3.up({}); out.still = steps().length - n0;
    // pull 1
    const x0 = X(); T3.down(ev(A.id, 150, 200)); for (let i = 0; i < 8; i++) { const e = ev(A.id, 150, 200); e.clientX += 6*i; T3.move(e); app.ev("simFrame")(); } T3.up({});
    for (let i = 0; i < 4; i++) app.ev("simFrame")();
    // pull 2
    const x1 = X(); T3.down(ev(A.id, 100, 300)); for (let i = 0; i < 8; i++) { const e = ev(A.id, 100, 300); e.clientY += 6*i; T3.move(e); app.ev("simFrame")(); } T3.up({});
    for (let i = 0; i < 4; i++) app.ev("simFrame")();
    const x2 = X();
    out.steps = steps().slice(-3); out.on = SIM.on;
    out.moved = [far(x0, x1) > 1, far(x1, x2) > 1];
    app.undo(); out.stopped = !SIM.on; out.u1 = far(X(), x1); out.after1 = steps().slice(-2);
    app.undo(); out.u2 = far(X(), x0); out.after2 = steps().slice(-1);
    app.redo(); out.r1 = far(X(), x1);
    app.redo(); out.r2 = far(X(), x2);
    return out;` }).result;
  assert.strictEqual(o.still, 0, "a press that does not move makes no step");
  assert.deepStrictEqual(o.steps, ["Simulate", "Pull", "Pull"], "each pull a step of its own");
  assert.strictEqual(o.on, true, "the simulation still runs after the pulls");
  assert.deepStrictEqual(o.moved, [true, true], "both pulls moved the cloth");
  assert.strictEqual(o.stopped, true, "undo stops the simulation first");
  assert.ok(o.u1 < 1e-3, "undo: the cloth as it hung before the second pull, off by " + o.u1);
  assert.deepStrictEqual(o.after1, ["Simulate", "Pull"]);
  assert.ok(o.u2 < 1e-3, "undo again: before the first pull, off by " + o.u2);
  assert.deepStrictEqual(o.after2, ["Simulate"]);
  assert.ok(o.r1 < 1e-3 && o.r2 < 1e-3, "redo forward again: " + o.r1 + ", " + o.r2);
});

/* ---------- A2 ---------- */
const C = require("../drafter-sim.js");
function sheet(w, h, res, lines) {
  const pts = [], nx = Math.round(w/res), ny = Math.round(h/res);
  for (let i = 0; i < nx; i++) pts.push([i*res, 0]); for (let j = 0; j < ny; j++) pts.push([w, j*res]);
  for (let i = 0; i < nx; i++) pts.push([w - i*res, h]); for (let j = 0; j < ny; j++) pts.push([0, h - j*res]);
  return C.meshPolygon(pts, res, null, lines);
}
// a 300 × 200 sheet folded along x = 150 with no gravity: each fold edge's angle (as r14 / 2 measures it) and how far the crease's
// points stand off the straight line between its two ends
function crease(deg, bend, k, X0) {
  const line = Array.from({ length: 21 }, (_, j) => [150, 10*j]), m = sheet(300, 200, 10, [line]), n = m.xy.length/2;
  const X = X0 ? X0(m) : Float32Array.from({ length: 3*n }, (_, i) => (i % 3 === 0 ? m.xy[2*(i/3|0)] : i % 3 === 1 ? -m.xy[2*(i/3|0)+1] : 0));
  const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: { weight: 150, bend }, folds: [{ L: line, a0: deg, a1: deg, k }] }], opt: { gravity: 0, ground: false, self: false, easeIn: 0 } });
  for (let f = 0; f < 400; f++) C.clothStep(sim, 1/60);
  const x = sim.x, Q = sim.fQ, bs = [];
  for (let q = 0; q < Q.length/4; q++) {
    const [a, b, c, d] = [0, 1, 2, 3].map(j => 3*Q[4*q + j]), e = [x[b] - x[a], x[b+1] - x[a+1], x[b+2] - x[a+2]], el = Math.hypot(...e), E = e.map(v => v/el);
    const off = (j) => { const r = [x[j] - x[a], x[j+1] - x[a+1], x[j+2] - x[a+2]], t = r[0]*E[0] + r[1]*E[1] + r[2]*E[2]; return r.map((v, i) => v - t*E[i]); };
    const pc = off(c), pd = off(d), rc = Math.hypot(...pc), u = pc.map(v => v/rc), v = [E[1]*u[2] - E[2]*u[1], E[2]*u[0] - E[0]*u[2], E[0]*u[1] - E[1]*u[0]];
    bs.push(Math.atan2(pd[0]*v[0] + pd[1]*v[1] + pd[2]*v[2], pd[0]*u[0] + pd[1]*u[1] + pd[2]*u[2])*180/Math.PI);
  }
  const key = (a, b) => Math.round(a*1e4) + "," + Math.round(b*1e4), ix = new Map();
  for (let i = 0; i < n; i++) ix.set(key(m.xy[2*i], m.xy[2*i+1]), i);
  const P = line.map(q => ix.get(key(q[0], q[1]))).map(i => [x[3*i], x[3*i+1], x[3*i+2]]), A = P[0], AB = P[P.length - 1].map((v, i) => v - A[i]), ab2 = AB[0]*AB[0] + AB[1]*AB[1] + AB[2]*AB[2];
  let dev = 0;
  for (const p of P) { const r = p.map((v, i) => v - A[i]), t = (r[0]*AB[0] + r[1]*AB[1] + r[2]*AB[2])/ab2; dev = Math.max(dev, Math.hypot(...r.map((v, i) => v - t*AB[i]))); }
  return { min: Math.min(...bs), max: Math.max(...bs), dev };
}
test("POLISH-1 / A2: a fold line's crease is straight and every one of its edges rests at the fold's angle (F26: they came to rest anywhere from 78° to 138° with the crease 36 mm off straight, because foldStep() measured each corner's offset with the edge's length divided in twice); the folded shape is a resting state, either way it starts", () => {
  for (const [deg, want] of [[270, 90], [90, -90]]) for (const [bend, k] of [[1000, 2000], [100, 2000], [5000, 2000], [1000, 20000]]) {
    const r = crease(deg, bend, k);
    assert.ok(r.min > want - 1 && r.max < want + 1, deg + "° (bend " + bend + ", k " + k + "): every edge at " + want + " ±1, got " + r.min.toFixed(1) + " to " + r.max.toFixed(1));
    assert.ok(r.dev < 0.5, deg + "° (bend " + bend + ", k " + k + "): the crease straight, " + r.dev.toFixed(2) + " mm off");
  }
  // started folded already, square towards the front: it stays (it moved 160 mm before)
  const folded = (m) => { const n = m.xy.length/2, X = new Float32Array(3*n); for (let i = 0; i < n; i++) { const x = m.xy[2*i], y = m.xy[2*i+1]; X.set(x <= 150 ? [x, -y, 0] : [150, -y, x - 150], 3*i); } return X; };
  const r = crease(270, 1000, 2000, folded);
  assert.ok(r.min > 89 && r.max < 91 && r.dev < 0.5, "a square fold put in place rests there: " + r.min.toFixed(1) + " to " + r.max.toFixed(1) + ", " + r.dev.toFixed(2) + " mm");
});

/* ---------- A3 ---------- */
// the example opened on its avatar and simulated in the page; each of the waistband's triangles facing out from the body (by its
// front, as every other pattern) or in, leaving out the closure's 30 mm extension, which laps under the other end
const BAND = (ex, av, frames) => `return (async () => {
  app.ev("avatarLoaded")(app.read("../assets/avatar/presets/${av}.glb"), "${av}.glb", null, true); await app.wait(() => S.av, "the avatar");
  app.ev("openExample")(app.ev("shippedExamples")().find(e => e.id === "${ex}"), true);
  await app.wait(() => S.pieces.length, "the document");
  app.ev("setLayout")("both"); app.ev("garmentSync")(); S.cloth.worker = false;
  const band = S.pieces.find(p => /waistband/.test(p.name)), G3 = app.ev("G3"), lineX = band.internals[0].pts[0].x;
  const out = { p3: band.p3 };
  app.ev("simStart")(); for (let i = 0; i < ${frames}; i++) app.ev("simFrame")();
  const it = G3.items.get(band.id), X = it.X, T = it.mesh.tri, xy = it.mesh.xy, n = X.length/3;
  let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += X[3*i]; cz += X[3*i+2]; } cx /= n; cz /= n;
  out.inward = 0; out.of = 0;
  for (let t = 0; t < T.length; t += 3) {
    if ((xy[2*T[t]] + xy[2*T[t+1]] + xy[2*T[t+2]])/3 > lineX - 5) continue;
    const a = 3*T[t], b = 3*T[t+1], c = 3*T[t+2], u = [X[b]-X[a], X[b+1]-X[a+1], X[b+2]-X[a+2]], v = [X[c]-X[a], X[c+1]-X[a+1], X[c+2]-X[a+2]];
    const nx = u[1]*v[2] - u[2]*v[1], nz = u[0]*v[1] - u[1]*v[0], mx = (X[a]+X[b]+X[c])/3 - cx, mz = (X[a+2]+X[b+2]+X[c+2])/3 - cz;
    out.of++; if (nx*mx + nz*mz <= 0) out.inward++;
  }
  app.ev("simStop")();
  return out;
})();`;
for (const [ex, av] of [["skirt-marty", "marty"], ["skirt-jessica", "jessica"]]) test("POLISH-1 / A3: the example " + ex + "'s waistband starts wrapped round the waist (Waist front, its curve its own length round + 25 mm) and simulates with none of it turned over into itself (F31; before, flat in front, about two thirds of it ended facing in with half twists)", () => {
  const o = boot({ blank: true, three: true, streams: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 12 }) }, script: BAND(ex, av, 300) }).result;
  assert.strictEqual(o.p3.pt, "waist_front", "on the Waist front arrangement point");
  assert.ok(o.p3.r > 100 && o.p3.r < 170, "wrapped at its own size: " + o.p3.r);
  assert.ok(o.of > 50, "the band's triangles counted: " + o.of);
  assert.strictEqual(o.inward, 0, o.inward + " of " + o.of + " of the band's triangles face in after 300 frames");
});

/* ---------- A4 ---------- */
test("POLISH-1 / A4: the README's key list is the app's own (its keys markers hold shortcutsMarkdown(), made from the key table: node scripts/readme-keys.js writes it); the Keyboard Shortcuts dialog shows the same rows; every key of the table that is not an alias is in the README, the desktop app's own marked", () => {
  const fs = require("fs");
  const o = boot({ blank: true, script: `
    const rows = app.ev("shortcutsDialog")(); app.ev("hideDlg")();
    return { md: app.ev("shortcutsMarkdown")(), dialog: rows, list: app.ev("shortcutRows")(false).flatMap(s => s.list), keys: app.ev("keyTable")().filter(r => !r.alias).map(r => ({ n: r.n, desk: !!r.desk })) };` }).result;
  const text = fs.readFileSync(path.join(__dirname, "..", "..", "README.md"), "utf8").replace(/\r\n/g, "\n");
  const a = text.indexOf("<!-- keys:start -->\n"), b = text.indexOf("\n<!-- keys:end -->");
  assert.ok(a >= 0 && b > a, "the README has its keys markers");
  assert.strictEqual(text.slice(a + "<!-- keys:start -->\n".length, b), o.md, "the README's key list is the app's: run node scripts/readme-keys.js");
  assert.deepStrictEqual(o.dialog, o.list, "the dialog lists the same rows");
  for (const k of o.keys) assert.ok(o.md.includes("| " + k.n.replace(/[|]/g, "\\|") + (k.desk ? " (desktop app only)" : "") + " |"), "in the README: " + k.n);
});

module.exports = T;
