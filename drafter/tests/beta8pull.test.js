// Round BETA8-1 / A, B: PULL-1, the pull that took the skirt off the avatar (the maintainer's hand test: the skirt simulated on Jessica,
// pulled with the mouse; after a short pull the whole skirt came off, the cloth through her body). Wanted: the garment can be pulled
// anywhere AROUND the avatar, never through it; collision wins over the pull; a pointer inside or behind the body makes the pulled cloth
// slide along the skin towards it.
//
// The skirt example on Jessica, simulated as the program does (its own settings), then pulled at a place on the front, the pointer
// moved (a) slowly sideways round the hips, (b) fast sideways, (c) straight into the body and out the other side, (d) a short sharp
// pull outwards and let go; and (e) the top of the skirt pulled through the body, (f) pulled hard sideways. Every frame, held and
// after letting go: the deepest cloth point inside the body. Pass: none deeper than 3 mm (the skin offset, SKIN_OFFSET) at any frame,
// and the top of the skirt still all round her (36 of 36 ten-degree sectors) and no more than 60 mm lower once settled.
//
// (Batch A) FIXED false: the test is expected to fail on that build and checks that it does (the bug is there); batch B made the fix
// and FIXED true. The diagnosis is in the round's report (PULL-1).
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const FIXED = true;      // (batch B: the fix; the test as it is meant to be)
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-beta8pull-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 900000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
// the scene and the measuring, in the page (the solver in the page: the worker runs the same code)
const PULL = `
  return (async () => {
    app.ev("setLayout")("both");
    const ex = app.ev("shippedExamples")().find(e => e.id === "skirt-jessica");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/jessica.glb"), "jessica.glb", null, true); await app.wait(() => S.av && S.av.preset === "jessica", "Jessica");
    app.ev("openExample")(ex, true); await app.wait(() => S.av && S.av.preset === "jessica" && S.pieces.length, "the example");
    const SIM = app.ev("SIM"), C = app.ev("SIM3D"), fr = (n) => { for (let i = 0; i < n; i++) app.ev("simFrame")(); };
    app.ev("garmentSync")();
    app.ev("simStart")(); fr(300);
    const sim = SIM.sim, x = sim.x, f = sim.field, n = sim.n;
    const deepest = () => { let d = 0; for (let i = 0; i < n; i++) { const s = C.sdfAt(f, x[3*i], x[3*i+1], x[3*i+2]); if (-s > d) d = -s; } return d; };
    let yMax = -1e9; for (let i = 0; i < n; i++) yMax = Math.max(yMax, x[3*i+1]);
    const top = []; for (let i = 0; i < n; i++) if (x[3*i+1] > yMax - 40) top.push(i);
    let cx = 0, cz = 0; for (const i of top) { cx += x[3*i]; cz += x[3*i+2]; } cx /= top.length; cz /= top.length;
    const around = () => { const bins = new Set(); let y = 0; for (const i of top) { bins.add(Math.floor((Math.atan2(x[3*i+2]-cz, x[3*i]-cx) + Math.PI)/(Math.PI/18))); y += x[3*i+1]; } return [bins.size, y/top.length]; };
    const [, yTop0] = around(), draped = deepest();
    // a grab as the program makes one: a triangle's three corners, the place their middle (the front point at that height, two nearest of its pattern)
    const grabAt = (Y) => {
      let b = -1; for (let i = 0; i < n; i++) if (Math.abs(x[3*i+1] - Y) < 15 && (b < 0 || x[3*i+2] > x[3*b+2])) b = i;
      const nb = []; for (let i = 0; i < n; i++) if (i !== b && sim.piece[i] === sim.piece[b]) nb.push(i);
      const d = (i) => Math.hypot(x[3*i]-x[3*b], x[3*i+1]-x[3*b+1], x[3*i+2]-x[3*b+2]); nb.sort((p, q) => d(p) - d(q));
      return [b, nb[0], nb[1]];
    };
    const X0 = Float64Array.from(x);
    const arc = (p, R, a) => { const a0 = Math.atan2(p[2]-cz, p[0]-cx); return [cx + R*Math.cos(a0 + a), p[1], cz + R*Math.sin(a0 + a)]; };
    const CASES = {
      a_slowAround: [yMax - 120, (k, p, r) => k <= 120 ? arc(p, r + 30, (k/120)*2.1) : k <= 150 ? arc(p, r + 30, 2.1) : null],
      b_fastAround: [yMax - 120, (k, p, r) => k <= 12 ? arc(p, r + 30, (k/12)*2.1) : k <= 40 ? arc(p, r + 30, 2.1) : null],
      c_through:    [yMax - 120, (k, p, r) => { if (k > 70) return null; const s = Math.min(1, k/40), L = 2*r + 100; return [p[0] + (cx - p[0])/r*L*s, p[1], p[2] + (cz - p[2])/r*L*s]; }],
      d_sharp:      [yMax - 120, (k, p, r) => { if (k > 3) return null; const s = k/3; return [p[0] + (p[0] - cx)/r*150*s, p[1] + 40*s, p[2] + (p[2] - cz)/r*150*s]; }],
      e_topThrough: [yMax - 15,  (k, p, r) => { if (k > 70) return null; const s = Math.min(1, k/40), L = 2*r + 100; return [p[0] + (cx - p[0])/r*L*s, p[1], p[2] + (cz - p[2])/r*L*s]; }],
      f_topSideways: [yMax - 15, (k, p, r) => { if (k > 40) return null; return [p[0] + 400*Math.min(1, k/5), p[1], p[2]]; }],
    };
    const out = { n, draped: +draped.toFixed(1) };
    for (const [name, [Y, path]] of Object.entries(CASES)) {
      C.clothDrag(sim, null); sim.slideLeft = 0; x.set(X0); sim.v.fill(0); fr(20);
      const tri = grabAt(Y), place = { i: tri, w: [1/3, 1/3, 1/3] }, P = () => [0, 1, 2].map(c => tri.reduce((s, i) => s + x[3*i + c], 0)/3);
      const p = P(), r = Math.hypot(p[0] - cx, p[2] - cz);
      let deep = 0, at = 0, k = 1;
      for (; ; k++) { const to = path(k, p, r); if (!to) break; app.ev("simDragTo")(place, to); fr(1); const d = deepest(); if (d > deep) { deep = d; at = k; } }
      app.ev("simDragTo")(null);
      for (let j = 0; j < 150; j++) { fr(1); const d = deepest(); if (d > deep) { deep = d; at = k + j; } }
      const [bins, yTop] = around();
      out[name] = { deepest: +deep.toFixed(1), frame: at, around: bins, lower: +(yTop0 - yTop).toFixed(0) };
    }
    app.ev("simStop")();
    return out;
  })();`;

test("BETA8-1 / PULL-1: the skirt on Jessica pulled round her hips slowly and fast, into her body and out the other side, a short sharp pull, its top pulled through her and hard sideways: no cloth point deeper than 3 mm inside her at any frame, the skirt still all round her and in place once let go" + (FIXED ? "" : " [batch A: expected to fail on this build; checks that it does]"), () => {
  const o = boot({ blank: true, three: true, script: PULL });
  const cases = Object.keys(o).filter(k => /^[a-f]_/.test(k)), all = JSON.stringify(o);
  if (process.env.PDRAFT_PULL_REPORT) console.log("  PULL-1 " + all);      // PDRAFT_PULL_REPORT=1 in front: the numbers
  assert.ok(o.draped <= 3, "draped, nothing inside: " + all);
  const bad = cases.filter(k => o[k].deepest > 3 || o[k].around < 36 || o[k].lower > 60);
  if (!FIXED) {
    // the bug: the place held at the pointer goes into her body (it is pinned there, and a pinned point meets no body); the cloth round
    // it follows it in. (Whether the top pulled through her also leaves the skirt off her varies from run to run: in the batch A scratch
    // run it covered 14 of the 36 sectors after letting go)
    assert.ok(bad.length >= 3, "expected to fail on this build: " + all);
    assert.ok(o.c_through.deepest > 30 && o.e_topThrough.deepest > 30, "into the body and through: " + all);
    return;
  }
  assert.deepStrictEqual(bad, [], "every case: " + all);
});

module.exports = T;
