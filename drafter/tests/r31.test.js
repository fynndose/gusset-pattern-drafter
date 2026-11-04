// Round r31: 3D items from the maintainer's user test. Batch 1 the avatar in the file; the later batches add theirs below.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt, ms) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: ms || 120000, maxBuffer: 1 << 28 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
const MARTY = path.join(__dirname, "..", "assets", "avatar", "presets", "marty.glb"), hasMarty = fs.existsSync(MARTY);

/* ---------- Batch 1: the avatar in the file ---------- */
test("r31 / 1: a document on one's own avatar reopens on that avatar: the same body, the same pose, the garment still draped on it; a built-in one by its id only" + (hasMarty ? "" : " (Marty is not here: skipped)"), () => {
  if (!hasMarty) return;
  const r = boot({ blank: true, three: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 20 }) }, script: `
    return (async () => {
      const out = {}, body = app.read("../assets/avatar/presets/marty.glb"), item = (p) => app.ev("G3").items.get(p.id);
      app.ev("setLayout")("both");
      // an avatar of one's own (Marty's bytes under another name stand in for an imported one)
      app.ev("avatarLoaded")(body, "my-body.glb", null, true, true); await app.wait(() => S.av, "the avatar");
      app.ev("avatarDocSet")(null, { armL: [25, 0, 0], armR: [-25, 0, 0] });
      const sq = app.mkPiece("Front", app.mkShape([{x:-150,y:0},{x:150,y:0},{x:150,y:300},{x:-150,y:300}], true));
      app.push("Rectangle"); S.pieces.push(sq); app.commit();
      // a short drape
      app.ev("simStart")(); for (let i = 0; i < 30; i++) app.ev("simFrame")(); app.ev("simStop")();
      const cloth = () => Array.from(item(S.pieces[0]).X);
      const before = cloth(), pose = JSON.stringify(S.avSet.pose), hash = S.av.hash;
      const file = await new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); });
      out.parts = app.fileParts(file); out.size = file.length;
      // closed: no avatar, a new document; then opened again
      app.ev("removeAvatar")(true); app.ev("newDoc")(true); out.empty = [!S.av, S.pieces.length];
      app.ev("openFile")("mine.pdraft", file, null, true); await app.wait(() => S.av && S.av.hash === hash, "the avatar from the file");
      await app.wait(() => item(S.pieces[0]) && item(S.pieces[0]).draped, "the drape");
      const after = cloth();
      out.back = [S.av.name, S.av.preset || null, JSON.stringify(S.avSet.pose) === pose, after.length === before.length && after.every((v, k) => Math.abs(v - before[k]) < 1e-3)];
      return out;
    })();` }, 180000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.parts.map(p => p[0]).sort(), ["avatar/my-body.glb", "document.json", "drape.bin", "history.json"], "the avatar's own file is in, with the drape");
  assert.strictEqual(o.parts.find(p => p[0] === "avatar/my-body.glb")[1], fs.statSync(MARTY).size, "byte for byte");
  assert.deepStrictEqual(o.empty, [true, 0]);
  assert.deepStrictEqual(o.back, ["my-body.glb", null, true, true], "the same avatar, posed as it was, the drape on it point for point");
});

/* ---------- Batch 2: a draped garment edited in 2D stays draped ---------- */
test("r31 / 2: a draped pattern changed in 2D keeps its drape: a lowered neckline, fabric added, the pattern moved and turned in 2D; only a reset goes back to the arrangement" + (hasMarty ? "" : " (Marty is not here: skipped)"), () => {
  if (!hasMarty) return;
  const r = boot({ blank: true, three: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 20 }) }, script: `
    return (async () => {
      const out = {}, body = app.read("../assets/avatar/presets/marty.glb"), G3 = app.ev("G3"), item = (p) => G3.items.get(p.id);
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(body, "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      // a front panel 400 x 600 with a neck at its top middle
      const F = app.mkPiece("Front", app.mkShape([{x:-200,y:0},{x:-60,y:0},{x:0,y:30},{x:60,y:0},{x:200,y:0},{x:200,y:600},{x:-200,y:600}], true));
      app.push("Front"); S.pieces.push(F); app.commit(); app.ev("garmentSync")();
      app.ev("simStart")(); for (let i = 0; i < 60; i++) app.ev("simFrame")(); app.ev("simStop")();
      const P = () => S.pieces[0];
      const snap = () => { const it = item(P()); return { X: Array.from(it.X), xy: Array.from(it.mesh.xy), tri: Array.from(it.mesh.tri) }; };
      const placed = () => { const it = item(P()); return Array.from(app.ev("SIM3D").placeVerts(it.mesh.xy, app.ev("p3C")(P(), it.mesh.c), app.ev("pieceP3")(P(), it.mesh.c))); };
      // how far each point of the cloth now is from the cloth before (its surface: the nearest point of any of its triangles), mean and largest
      const TH = app.ev("THREE"), V3 = (a, b, c) => new TH.Vector3(a, b, c), T3 = new TH.Triangle(), q = new TH.Vector3();
      const onSurf = (A, D) => { let worst = 0, sum = 0; for (let i = 0; i < A.length; i += 3) { const pt = V3(A[i], A[i+1], A[i+2]); let b = Infinity;
        for (let t = 0; t < D.tri.length; t += 3) { const v = (k) => V3(D.X[3*D.tri[t+k]], D.X[3*D.tri[t+k]+1], D.X[3*D.tri[t+k]+2]); T3.set(v(0), v(1), v(2)); T3.closestPointToPoint(pt, q); b = Math.min(b, q.distanceTo(pt)); }
        worst = Math.max(worst, b); sum += b; } return [+(sum/(A.length/3)).toFixed(2), +worst.toFixed(2)]; };
      const meanTo = (A, B) => { let s = 0; for (let i = 0; i < A.length; i += 3) s += Math.hypot(A[i] - B[i], A[i+1] - B[i+1], A[i+2] - B[i+2]); return +(s/(A.length/3)).toFixed(1); };
      const d0 = snap(); out.fell = meanTo(d0.X, placed());
      // the neckline lowered by 40 mm
      app.setTool("edit_pattern"); app.push(); P().pts[2].y += 40; app.commit(); app.ev("garmentSync")();
      let d1 = snap(); out.neck = [item(P()).draped, onSurf(d1.X, d0), meanTo(d1.X, placed())];
      // fabric added: the side made 30 mm wider at the hem
      app.push(); P().pts[5].x += 30; app.commit(); app.ev("garmentSync")();
      const d2 = snap(); out.wider = [item(P()).draped, onSurf(d2.X, d1)];
      // moved and turned in 2D: the cloth stays exactly as it hangs
      app.setTool("transform_pattern"); S.sel = [P().id];
      app.push(); app.ev("mapPiece")(P(), (q) => ({ x: q.x + 500, y: q.y + 120 })); app.commit(); app.ev("garmentSync")();
      const d3 = snap(); out.moved = [item(P()).draped, meanTo(d3.X, d2.X)];
      app.ev("turnSel")(90, "Clockwise 90°"); app.ev("garmentSync")();
      const d4 = snap(); out.turned = [item(P()).draped, onSurf(d4.X, d3)];      // (meshed again turned: its points come in another order)
      // only a reset goes back to the arrangement
      app.ev("resetArrangement3")(false); app.ev("garmentSync")();
      out.reset = [item(P()).draped, meanTo(snap().X, placed())];
      return out;
    })();` }, 240000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.ok(o.fell > 20, "the cloth had fallen away from its arrangement: " + o.fell);
  assert.strictEqual(o.neck[0], true); assert.ok(o.neck[1][0] < 0.5 && o.neck[1][1] < 2, "every point on the cloth as it hung: " + JSON.stringify(o.neck));
  assert.ok(o.neck[2] > 20, "not back at its arrangement: " + o.neck[2]);
  assert.strictEqual(o.wider[0], true); // the new strip (up to 30 mm wide at the hem) carries on past the old edge: its points no further off the old cloth than the width added
  assert.ok(o.wider[1][0] < 1 && o.wider[1][1] <= 30.5, "the new fabric carried on from its draped neighbours, the rest on the cloth as it hung: " + JSON.stringify(o.wider));
  assert.deepStrictEqual(o.moved, [true, 0], "moved in 2D: exactly as it hung");
  assert.strictEqual(o.turned[0], true); assert.ok(o.turned[1][0] < 0.5 && o.turned[1][1] < 2, "turned in 2D: as it hung: " + JSON.stringify(o.turned));
  assert.deepStrictEqual(o.reset, [false, 0], "the reset: at its arrangement");
});

/* ---------- Batch 3: cloth not glued to the body ---------- */
// the solver alone: a 200 mm sheet lying on top of a large ball (a body, nearly level there), pulled sideways at its middle, then let go
function onBall(opt) {
  const C = require("../drafter-sim.js");
  const sheet = (w, h, res) => { const pts = [], nx = Math.round(w/res), ny = Math.round(h/res);
    for (let i = 0; i < nx; i++) pts.push([i*res, 0]); for (let j = 0; j < ny; j++) pts.push([w, j*res]);
    for (let i = 0; i < nx; i++) pts.push([w - i*res, h]); for (let j = 0; j < ny; j++) pts.push([0, h - j*res]); return C.meshPolygon(pts, res); };
  function ball(r, c) {
    let t = [[[1,0,0],[0,1,0],[0,0,1]], [[0,1,0],[-1,0,0],[0,0,1]], [[-1,0,0],[0,-1,0],[0,0,1]], [[0,-1,0],[1,0,0],[0,0,1]], [[0,1,0],[1,0,0],[0,0,-1]], [[-1,0,0],[0,1,0],[0,0,-1]], [[0,-1,0],[-1,0,0],[0,0,-1]], [[1,0,0],[0,-1,0],[0,0,-1]]];
    const mid = (a, b) => { const q = [a[0]+b[0], a[1]+b[1], a[2]+b[2]], l = Math.hypot(...q); return q.map(v => v/l); };
    for (let k = 0; k < 4; k++) t = t.flatMap(([a, b, d]) => { const ab = mid(a, b), bd = mid(b, d), da = mid(d, a); return [[a, ab, da], [ab, b, bd], [da, bd, d], [ab, bd, da]]; });
    return new Float32Array(t.flatMap(q => q.flatMap(p => [p[0]*r + c[0], p[1]*r + c[1], p[2]*r + c[2]])));
  }
  const f = C.buildSDF(ball(1500, [0, -200, 0]), { cell: 25 }), m = sheet(200, 200, 20), n = m.xy.length/2, X = new Float32Array(3*n);
  for (let i = 0; i < n; i++) X.set([m.xy[2*i] - 100, 1306, m.xy[2*i+1] - 100], 3*i);
  const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: { weight: 150, thick: 3, friction: 0.4 } }], field: f, opt: { easeIn: 0, self: false, ...opt } });
  const run = (k) => { for (let j = 0; j < k; j++) C.clothStep(sim, 1/60); };
  run(120);
  // its middle point, pulled 60 mm along x for 40 frames
  let c = 0; for (let i = 0; i < n; i++) if (Math.hypot(m.xy[2*i] - 100, m.xy[2*i+1] - 100) < Math.hypot(m.xy[2*c] - 100, m.xy[2*c+1] - 100)) c = i;
  const mean = () => { let x = 0; for (let i = 0; i < n; i++) x += sim.x[3*i]; return x/n; }, x0 = mean(), at = [sim.x[3*c], sim.x[3*c+1], sim.x[3*c+2]];
  C.clothDrag(sim, { i: [c], w: [1], to: [at[0] + 60, at[1], at[2]] }); run(40);
  const pulled = mean() - x0;
  C.clothDrag(sim, null); run(120);
  let inside = 0; for (let i = 0; i < n; i++) if (C.sdfAt(f, sim.x[3*i], sim.x[3*i+1], sim.x[3*i+2]) < -1) inside++;
  return { pulled: +pulled.toFixed(1), stayed: +(mean() - x0).toFixed(1), inside, speed: +C.clothSpeed(sim).toFixed(1) };
}
test("r31 / 3: cloth on the body follows a pull and stays where it is let go: the pull's spring is stiffer (2e5; it was 5e4 and held the cloth well short of the pointer), still at most 1 N; the body's friction is the fabric's, as before", () => {
  const now = onBall({}), before = onBall({ dragK: 5e4 });
  assert.ok(now.pulled > 55 && now.pulled > before.pulled + 10, "it follows the pointer's 60 mm: " + JSON.stringify({ now, before }));
  assert.ok(now.stayed > 0.8*now.pulled && now.stayed < now.pulled + 10, "and stays there once let go, neither back nor sliding off: " + JSON.stringify(now));
  assert.strictEqual(now.inside, 0, "nothing through the body"); assert.ok(now.speed < 20, "at rest: " + now.speed);
  // at rest it does not creep away by itself
  const still = onBall({ dragMax: 0 });
  assert.ok(Math.abs(still.stayed) < 3, "no pull, no slide: " + JSON.stringify(still));
});

module.exports = T;
