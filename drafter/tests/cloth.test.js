// Roadmap 3D, batch 3: the cloth simulation. The solver on its own (hanging, lying on a
// body, the floor, seams 1:1, uneven, M:N and layered, cloth against cloth, pins, fabric),
// seams of the document turned into matched places on the cloth, unsewn edges, fabric
// presets, a sewn tube on an avatar, and Space in the booted app.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");
const { three, rig } = require("./three-env");
const C = require("../drafter-sim.js");

const { THREE } = three();
const S = { pieces: [], seams: [], stitches: [], images: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, unit: "mm", dec: 1, ui: { render: "front", layout: "both", show3d: {} }, cloth: null, lib: null, av: null, avSet: { cell: 16 },
  undo: [], redo: [], un: [], rn: [], sewCheck: { on: false, useLen: true, len: 2, useRatio: false, ratio: 2 } };
const groups = {};
const view3d = { group: (n) => groups[n] || (groups[n] = new THREE.Group()), ask() {}, ready: () => true, cam: { dist: 5000 }, tool() {}, camera: () => null, loop() {} };
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }) });
const G = load(["V", "mkShape", "mkPiece", "addChild", "addDartTo", "makeSeam", "seamInfo", "seamEnds", "normCloth", "normLib", "garmentSync", "G3", "SIM", "simSeams", "sidePath", "partNodes", "simBuild", "unsewnEdges", "fabricPhys",
  "FABRIC_PHYS", "avatarSetup", "avatarField", "avatarBox", "arrPoints", "arrangeP3", "poseApply", "posePreset", "byId"],
  { S, THREE, SIM3D: C, view3d, document: { createElement: fakeCanvas }, Image: undefined, ui: () => {}, draw: () => {}, toast: () => {}, refreshRail: () => {}, note3d: () => {} });
const { V, mkShape, mkPiece, addChild, addDartTo, makeSeam, seamInfo, seamEnds, normCloth, normLib, garmentSync, G3, SIM, simSeams, simBuild, unsewnEdges, fabricPhys, FABRIC_PHYS, avatarSetup, avatarField, avatarBox, arrPoints, arrangeP3, poseApply, posePreset } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
// a w × h sheet of cloth as a flat mesh, corner at (x0, y0) on the pattern
function sheet(w, h, res, x0 = 0, y0 = 0) {
  const pts = [], nx = Math.round(w/res), ny = Math.round(h/res);
  for (let i = 0; i < nx; i++) pts.push([x0 + i*res, y0]); for (let j = 0; j < ny; j++) pts.push([x0 + w, y0 + j*res]);
  for (let i = 0; i < nx; i++) pts.push([x0 + w - i*res, y0 + h]); for (let j = 0; j < ny; j++) pts.push([x0, y0 + h - j*res]);
  return C.meshPolygon(pts, res);
}
// where its points start: f(x, y on the pattern) -> [x, y, z]
const lay = (m, f) => { const n = m.xy.length/2, X = new Float32Array(3*n); for (let i = 0; i < n; i++) X.set(f(m.xy[2*i], m.xy[2*i+1]), 3*i); return X; };
const edgeOf = (m, f) => Array.from({ length: m.xy.length/2 }, (_, i) => i).filter(i => f(m.xy[2*i], m.xy[2*i+1]));
const run = (sim, frames) => { for (let k = 0; k < frames; k++) C.clothStep(sim, 1/60); return sim; };
const meanStrain = (sim) => { let s = 0; for (let c = 0; c < sim.eI.length; c++) { const a = 3*sim.eI[c], b = 3*sim.eJ[c]; s += Math.abs(Math.hypot(sim.x[a] - sim.x[b], sim.x[a+1] - sim.x[b+1], sim.x[a+2] - sim.x[b+2]) - sim.eL[c])/sim.eL[c]; } return s/sim.eI.length; };
function ball(r, c) {
  let t = [[[1,0,0],[0,1,0],[0,0,1]], [[0,1,0],[-1,0,0],[0,0,1]], [[-1,0,0],[0,-1,0],[0,0,1]], [[0,-1,0],[1,0,0],[0,0,1]], [[0,1,0],[1,0,0],[0,0,-1]], [[-1,0,0],[0,1,0],[0,0,-1]], [[0,-1,0],[-1,0,0],[0,0,-1]], [[1,0,0],[0,-1,0],[0,0,-1]]];
  const mid = (a, b) => { const q = [a[0]+b[0], a[1]+b[1], a[2]+b[2]], l = Math.hypot(...q); return q.map(v => v/l); };
  for (let k = 0; k < 4; k++) t = t.flatMap(([a, b, d]) => { const ab = mid(a, b), bd = mid(b, d), da = mid(d, a); return [[a, ab, da], [ab, b, bd], [da, bd, d], [ab, bd, da]]; });
  return new Float32Array(t.flatMap(q => q.flatMap(p => [p[0]*r + c[0], p[1]*r + c[1], p[2]*r + c[2]])));
}
const one = (p, v) => ({ p, i: [v], w: [1] });

test("cloth pinned along its top edge hangs straight down, keeps its lengths and comes to rest", () => {
  const m = sheet(200, 300, 20), X = lay(m, (x, y) => [x, 1500, y]);                         // laid out level, pinned along one side
  const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: { weight: 150 } }], pins: edgeOf(m, (x, y) => y < 1e-6).map(v => ({ p: 0, v })), opt: { ground: false, self: false } });
  assert.strictEqual(sim.n, m.xy.length/2); assert.ok(sim.eI.length > sim.n*2.5 && sim.bI.length > sim.n*2);
  near(sim.mass.reduce((a, b) => a + b, 0), 200*300*150e-6, 1e-9, "9 grams of cloth");
  run(sim, 300);
  let lo = Infinity, zmax = 0;
  for (let i = 0; i < sim.n; i++) { lo = Math.min(lo, sim.x[3*i+1]); zmax = Math.max(zmax, Math.abs(sim.x[3*i+2])); }
  near(1500 - lo, 300, 9, "it hangs its own length");
  assert.ok(zmax < 40, "it has swung down under the pins: " + zmax);
  assert.ok(meanStrain(sim) < 0.01 && C.clothStrain(sim) < 0.08, "lengths kept: mean " + meanStrain(sim) + ", worst " + C.clothStrain(sim));
  assert.ok(C.clothSpeed(sim) < 12, "at rest: " + C.clothSpeed(sim));
  for (const v of edgeOf(m, (x, y) => y < 1e-6)) near(sim.x[3*v+1], 1500, 1e-9, "a pinned point");
});

test("cloth dropped on a body lies on it: no point inside the skin, the corners hang lower than the middle, and it stops", () => {
  const f = C.buildSDF(ball(150, [0, 1200, 0]), { cell: 10 }), m = sheet(400, 400, 20);
  const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x - 200, 1420, y - 200]), fab: { weight: 150, thick: 3 } }], field: f, opt: { easeIn: 0 } });
  run(sim, 200);
  let minD = Infinity, lo = Infinity, hi = -Infinity;
  for (let i = 0; i < sim.n; i++) { minD = Math.min(minD, C.sdfAt(f, sim.x[3*i], sim.x[3*i+1], sim.x[3*i+2])); lo = Math.min(lo, sim.x[3*i+1]); hi = Math.max(hi, sim.x[3*i+1]); }
  assert.ok(minD > 3 - 0.2, "every point is its thickness clear of the skin: " + minD);
  near(hi, 1350 + 3, 3, "the middle rests on top of the ball"); assert.ok(lo < 1200, "the corners hang below the ball's middle: " + lo);
  assert.ok(C.clothSpeed(sim) < 6 && meanStrain(sim) < 0.02);
  // with nothing under it, it lands on the floor and stays there
  const s2 = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x, 300, y]), fab: { thick: 3 } }], opt: { easeIn: 0 } });
  run(s2, 120);
  for (let i = 0; i < s2.n; i += 7) near(s2.x[3*i+1], 3, 0.5, "on the floor");
  // gravity comes in gently when asked
  const a = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x, 900, y]) }], opt: { easeIn: 45, ground: false } }), b = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x, 900, y]) }], opt: { easeIn: 0, ground: false } });
  run(a, 6); run(b, 6);
  assert.ok(900 - a.x[1] < (900 - b.x[1])*0.2 && 900 - b.x[1] > 30, "after six frames it has fallen " + (900 - a.x[1]) + " against " + (900 - b.x[1]));
});

test("a seam pulls its two sides together, place for place; an uneven seam is matched in proportion to the two lengths", () => {
  const A = sheet(200, 100, 20), B = sheet(200, 100, 20, 0, 300), top = edgeOf(A, (x, y) => y < 1e-6).sort((p, q) => A.xy[2*p] - A.xy[2*q]), bot = edgeOf(B, (x, y) => y > 400 - 1e-6).sort((p, q) => B.xy[2*p] - B.xy[2*q]);
  const pathA = C.seamPath(top.map(v => ({ a: one(0, v), pos: [A.xy[2*v], A.xy[2*v+1]] }))), pathB = C.seamPath(bot.map(v => ({ a: one(1, v), pos: [B.xy[2*v], B.xy[2*v+1]] })));
  near(pathA.len, 200, 1e-9); near(pathB.len, 200, 1e-9);
  const pairs = C.seamPairs(pathA, pathB, 20);
  assert.strictEqual(pairs.length, 11); assert.deepStrictEqual(pairs[0], [one(0, top[0]), one(1, bot[0])]); assert.deepStrictEqual(pairs[10], [one(0, top[10]), one(1, bot[10])]);
  const build = (pr, gap) => C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 500, y]) }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x, 500, y - 400 - gap]) }], seams: [{ id: 1, pairs: pr }], opt: { gravity: 0, ground: false, self: false } });
  const sim = run(build(pairs, 150), 90), g = C.clothSeamGaps(sim)[0];
  assert.ok(g.max < 0.5, "150 mm apart, sewn shut: " + g.max); assert.ok(C.clothStrain(sim) < 0.02, "and neither piece was stretched to do it");
  // a place between two cloth points is a mix of the two
  const mix = C.pathAt(pathA, 30);
  assert.deepStrictEqual(mix.i, [top[1], top[2]]); near(mix.w[0], 0.5, 1e-9); near(mix.w[1], 0.5, 1e-9);
  // 160 of one edge against the whole 200 of the other: every place the same share of the way along
  const part = C.seamPath(top.slice(0, 9).map(v => ({ a: one(0, v), pos: [A.xy[2*v], A.xy[2*v+1]] })));
  const up = C.seamPairs(part, pathB, 20);
  assert.strictEqual(up.length, 11); assert.deepStrictEqual(up[5][0].i, [top[4]]); assert.deepStrictEqual(up[5][1].i, [bot[5]]);
  assert.deepStrictEqual(up[1][0].i, [top[0], top[1]]); near(up[1][0].w[1], 0.8, 1e-9, "16 of the way along a 20 edge"); assert.deepStrictEqual(up[10], [one(0, top[8]), one(1, bot[10])]);
  // the longer side is eased in: it has to ripple, so it starts with the faintest wave (flat cloth pushed end-on would stay flat)
  const s2 = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 500, y]) }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x, 500 + 2*Math.sin(x/9), y - 400 - 40]) }], seams: [{ id: 1, pairs: up }], opt: { gravity: 0, ground: false, self: false } });
  run(s2, 240);
  assert.ok(C.clothSeamGaps(s2)[0].max < 6, "the long side is eased onto the short one: " + C.clothSeamGaps(s2)[0].max);
  // the ends of every stretch are sewn as well as the even places
  const two = C.seamPath([{ a: one(0, 0), pos: [0, 0] }, { a: one(0, 1), pos: [40, 0] }, { a: one(1, 0), pos: [500, 0], jump: true }, { a: one(1, 1), pos: [540, 0] }]), lone = C.seamPath([{ a: one(2, 0), pos: [0, 0] }, { a: one(2, 1), pos: [80, 0] }]);
  const pr = C.seamPairs(two, lone, 80);
  assert.strictEqual(pr.length, 4); assert.deepStrictEqual(pr.slice(2).map(p => [p[0].p, p[0].i[0], p[1].i, p[1].w]), [[0, 1, [0, 1], [0.5, 0.5]], [1, 0, [0, 1], [0.5, 0.5]]], "both ends at the step meet the middle of the other side");
  // a step with no cloth in it (the mouth of a dart) has no length
  const jump = C.seamPath([{ a: one(0, 0), pos: [0, 0] }, { a: one(0, 1), pos: [30, 0] }, { a: one(0, 2), pos: [60, 0], jump: true }, { a: one(0, 3), pos: [100, 0] }]);
  near(jump.len, 70, 1e-9); assert.deepStrictEqual(C.pathAt(jump, 30).i, [1]); assert.deepStrictEqual(C.pathAt(jump, 50).i, [2, 3]);
});

test("M:N and layered seams: two short edges on one long one, and three pieces sewn along the same edge, all meet", () => {
  const L = sheet(200, 60, 20), a = sheet(100, 60, 20, 0, 200), b = sheet(100, 60, 20, 300, 200), c = sheet(200, 60, 20, 0, 500);
  const order = (m, f, key) => edgeOf(m, f).sort((p, q) => m.xy[2*p + key] - m.xy[2*q + key]);
  const nodes = (m, p, vs) => vs.map(v => ({ a: one(p, v), pos: [m.xy[2*v], m.xy[2*v+1]] }));
  const long = C.seamPath(nodes(L, 0, order(L, (x, y) => y > 60 - 1e-6, 0)));
  // side b: piece a's top edge, then piece b's (a step with no length between them)
  const nb = [...nodes(a, 1, order(a, (x, y) => y < 200 + 1e-6, 0)), ...nodes(b, 2, order(b, (x, y) => y < 200 + 1e-6, 0)).map((nd, k) => ({ ...nd, jump: k === 0 }))], two = C.seamPath(nb);
  near(two.len, 200, 1e-9, "the two short edges together");
  const third = C.seamPath(nodes(c, 3, order(c, (x, y) => y < 500 + 1e-6, 0)));
  const sim = C.clothBuild({ pieces: [{ xy: L.xy, tri: L.tri, X: lay(L, (x, y) => [x, 600, y]) }, { xy: a.xy, tri: a.tri, X: lay(a, (x, y) => [x - 30, 600, y - 100]) }, { xy: b.xy, tri: b.tri, X: lay(b, (x, y) => [x - 170, 600, y - 100]) },
      { xy: c.xy, tri: c.tri, X: lay(c, (x, y) => [x, 640, y - 420]) }],
    seams: [{ id: 1, pairs: C.seamPairs(long, two, 20) }, { id: 2, pairs: C.seamPairs(long, third, 20) }], opt: { gravity: 0, ground: false, self: false } });
  run(sim, 150);
  const g = C.clothSeamGaps(sim);
  assert.ok(g[0].max < 1 && g[1].max < 1, "both seams on the long edge are shut: " + g[0].max + ", " + g[1].max);
  // the two short pieces lie end to end along the long edge
  const ra = edgeOf(a, (x, y) => x > 100 - 1e-6 && y < 200 + 1e-6)[0], lb = edgeOf(b, (x, y) => x < 300 + 1e-6 && y < 200 + 1e-6)[0];
  assert.ok(Math.hypot(sim.x[3*(sim.off[1] + ra)] - sim.x[3*(sim.off[2] + lb)], sim.x[3*(sim.off[1] + ra)+1] - sim.x[3*(sim.off[2] + lb)+1], sim.x[3*(sim.off[1] + ra)+2] - sim.x[3*(sim.off[2] + lb)+2]) < 2);
  // an anchor inside a triangle: its three corners, weights adding to one
  const an = C.triAnchor(L.xy, L.tri, 77, 31, 0);
  near(an.w[0] + an.w[1] + an.w[2], 1, 1e-12); near(an.i.reduce((s, v, k) => s + an.w[k]*L.xy[2*v], 0), 77, 1e-9); near(an.i.reduce((s, v, k) => s + an.w[k]*L.xy[2*v+1], 0), 31, 1e-9);
  assert.ok(C.triAnchor(L.xy, L.tri, 500, 31, 0).w.every(w => w >= 0), "a point off the cloth takes the nearest triangle");
});

test("cloth against cloth: a piece dropped on another stays on top of it; without self-collision it falls through", () => {
  const base = sheet(300, 300, 20), top = sheet(140, 140, 20);
  const make = (self) => C.clothBuild({ pieces: [{ xy: base.xy, tri: base.tri, X: lay(base, (x, y) => [x, 400, y]) }, { xy: top.xy, tri: top.tri, X: lay(top, (x, y) => [x + 83, 470, y + 77]) }],
    pins: Array.from({ length: base.xy.length/2 }, (_, v) => ({ p: 0, v })), opt: { self, ground: false, easeIn: 0 } });
  const on = run(make(true), 100), off = run(make(false), 100);
  let lo = Infinity;
  for (let i = on.off[1]; i < on.n; i++) lo = Math.min(lo, on.x[3*i+1]);
  assert.ok(on.nPairs > 20, "pairs of near points are found: " + on.nPairs);
  assert.ok(lo > 400 + on.opt.selfDist*0.5, "it rests above the pinned sheet: " + (lo - 400) + " mm, collision distance " + on.opt.selfDist);
  assert.ok(off.x[3*off.off[1]+1] < 0, "with it off the top piece is long gone");
  // points that are sewn to each other are never pushed apart, and neighbours on one pattern are left alone
  const s = C.clothBuild({ pieces: [{ xy: top.xy, tri: top.tri, X: lay(top, (x, y) => [x, 400, y]) }, { xy: top.xy, tri: top.tri, X: lay(top, (x, y) => [x, 403, y]) }], seams: [{ id: 1, pairs: [[one(0, 0), one(1, 0)]] }], opt: { gravity: 0, ground: false } });
  C.clothStep(s, 1/60);
  const P = Array.from({ length: s.nPairs }, (_, k) => [s.pairs[2*k], s.pairs[2*k+1]]);
  assert.ok(!P.some(([i, j]) => i === 0 && j === s.off[1]), "the sewn pair"); assert.ok(P.every(([i, j]) => s.piece[i] !== s.piece[j]), "no pair within one flat pattern at this spacing");
  assert.strictEqual(new Set(P.map(p => p.join())).size, P.length, "no pair twice");
});

test("pins and fabric: a pinned point stays and can be led about; stiffer cloth sags less; heavier cloth weighs more", () => {
  const m = sheet(200, 60, 20), held = edgeOf(m, (x, y) => x < 21);                 // two rows held: a clamp, not a hinge
  const tip = edgeOf(m, (x, y) => x > 200 - 1e-6)[0];
  const sag = (bend) => { const s = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x, 800, y]), fab: { bend } }], pins: held.map(v => ({ p: 0, v })), opt: { ground: false, self: false, easeIn: 0 } }); run(s, 150); return 800 - s.x[3*tip+1]; };
  const soft = sag(3), stiff = sag(5e6);
  assert.ok(soft > 150, "chiffon held by one end hangs down: " + soft); assert.ok(stiff < soft - 2, "stiffer cloth droops less, if only a little (bending as a kept distance is weak near flat): " + stiff + " against " + soft);
  const s = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x, 800, y]), fab: { weight: 300 } }], opt: { ground: false, self: false } });
  near(s.mass.reduce((a, b) => a + b, 0), 200*60*300e-6, 1e-9);
  C.clothPin(s, tip, true, [200, 900, 0]); run(s, 60);
  near(s.x[3*tip+1], 900, 1e-9, "led to a new place, it stays there"); assert.ok(s.x[3*held[0]+1] < 880, "and the rest hangs from it");
  C.clothPin(s, tip, false); run(s, 30);
  assert.ok(s.x[3*tip+1] < 700, "let go, it falls");
  const out = C.clothRead(s, 0);
  assert.strictEqual(out.length, 3*s.n); near(out[3*tip+1], s.x[3*tip+1], 1e-3);
  // presets tell fabrics apart; weight and thickness are the fabric's own
  assert.deepStrictEqual(Object.keys(FABRIC_PHYS), ["Custom", "Light woven", "Medium woven", "Heavy woven", "Single jersey", "Rib knit"]);
  for (const [name, k] of Object.entries(FABRIC_PHYS)) {
    assert.ok(k.weight >= 60 && k.weight <= 450 && k.thickness > 0.1 && k.thickness < 1.5, name + ": a weight in g/m² and a thickness in mm one finds in a shop");
    assert.ok(k.stretch > 0 && k.bend > 0 && k.friction > 0.1 && k.friction < 0.7, name + ": stiffness and friction");
    assert.deepStrictEqual(Object.keys(k), ["weight", "thickness", "stretch", "bend", "friction", "maxStretch"]);
    assert.ok(k.maxStretch >= 5 && k.maxStretch <= 60, name + ": a strain limit in % (Round r9)");
  }
  const P = FABRIC_PHYS, hv = fabricPhys({ physical: "Heavy woven", weight: 400, thickness: 1 }), lt = fabricPhys({ physical: "Light woven", weight: 70, thickness: 0.1 }), gen = fabricPhys(null);
  assert.ok(P["Light woven"].weight < P["Medium woven"].weight && P["Medium woven"].weight < P["Heavy woven"].weight && P["Single jersey"].weight < P["Rib knit"].weight, "light, medium, heavy by weight");
  assert.ok(P["Light woven"].bend < P["Medium woven"].bend && P["Medium woven"].bend < P["Heavy woven"].bend && P["Single jersey"].bend < P["Light woven"].bend, "… and by how stiffly they bend; jersey is the limpest");
  assert.ok(hv.bend > 50*lt.bend && hv.stretch > lt.stretch && hv.friction > lt.friction); assert.strictEqual(hv.weight, 400, "the weight typed wins over the preset's");
  // (Round r15 / 8: every cloth is kept the avatar's Skin Offset, 3 mm, off the skin, as the reference's default; it used to be 4 mm and
  // the fabric's own thickness, so a thicker fabric stood further off)
  assert.deepStrictEqual([hv.thick, lt.thick], [3, 3]);
  assert.deepStrictEqual([gen.weight, gen.stretch, gen.bend], [P.Custom.weight, P.Custom.stretch, P.Custom.bend]);
  assert.strictEqual(fabricPhys({ physical: "Rib knit" }).weight, 240, "with no weight typed, the preset's own");
  assert.ok(fabricPhys({ physical: "Single jersey" }).stretch < P["Medium woven"].stretch/5 && fabricPhys({ physical: "Rib knit" }).stretch < fabricPhys({ physical: "Single jersey" }).stretch, "a knit stretches, a rib more");
  assert.deepStrictEqual(fabricPhys({ physical: "Nonsense" }), fabricPhys({ physical: "Custom" }));
  // in the solver, at the usual mesh: a strip of the heavy woven held level by one end stands out further than the same strip of jersey
  const droop = (name) => { const k = fabricPhys({ physical: name }); const q = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x, 800, y]), fab: k }], pins: held.map(v => ({ p: 0, v })), opt: { ground: false, self: false, easeIn: 0 } }); run(q, 150); return 800 - q.x[3*edgeOf(m, (x) => x > 100 - 1e-6 && x < 100 + 1e-6)[0] + 1]; };
  const dH = droop("Heavy woven"), dM = droop("Medium woven"), dJ = droop("Single jersey");
  assert.ok(dH < dM - 2 && dM < dJ - 1, "60 mm out from the clamp: heavy woven " + dH.toFixed(1) + " < medium woven " + dM.toFixed(1) + " < single jersey " + dJ.toFixed(1) + " mm down");
});

function reset() { S.pieces = []; S.seams = []; S.sel = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.cloth = normCloth(null); S.lib = normLib(null); S.av = null; for (const it of G3.items.values()) view3d.group("garment").remove(it.obj, it.line); G3.items.clear(); SIM.on = false; }
const rect = (name, x, y, w, h) => { const p = mkPiece(name, mkShape([V(x, y), V(x + w, y), V(x + w, y + h), V(x, y + h)], true)); S.pieces.push(p); return p; };
const add = (sm) => { sm.id = S.seams.reduce((m, x) => Math.max(m, x.id), 0) + 1; S.seams.push(sm); return sm; };
const where2 = (an, order) => { const m = G3.items.get(order[an.p]).mesh; return [an.i.reduce((s, v, k) => s + an.w[k]*m.xy[2*v], 0), an.i.reduce((s, v, k) => s + an.w[k]*m.xy[2*v+1], 0)]; };

test("the document's seams become matched places on the cloth: lengths as in the 2D window, the ends that meet, reversed and free ranges, 1:N", () => {
  reset();
  const A = rect("A", 0, 0, 300, 200), B = rect("B", 0, 400, 300, 200), Cc = rect("C", 400, 400, 150, 200);
  add(makeSeam(S.seams, { piece: A.id, sid: A.segs[2].id }, { piece: B.id, sid: B.segs[0].id }, true));               // A's bottom (runs right to left) to B's top, turned to match
  add(makeSeam(S.seams, { piece: A.id, sid: A.segs[1].id, t0: 0.25, t1: 0.75 }, { piece: B.id, sid: B.segs[1].id }));  // half of A's right edge to the whole of B's
  add(makeSeam(S.seams, { piece: A.id, sid: A.segs[0].id }, [{ piece: B.id, sid: B.segs[2].id }, { piece: Cc.id, sid: Cc.segs[0].id }]));   // 1:2
  garmentSync();
  const order = S.pieces.map(p => p.id), sm = simSeams(order);
  assert.strictEqual(sm.length, 3);
  S.seams.forEach((s, k) => { const inf = seamInfo(s, S.pieces); near(sm[k].la, inf.la, 1e-6, "side a of S" + s.id); near(sm[k].lb, inf.lb, 1e-6, "side b of S" + s.id); });
  // the points the 2D window joins with its dashed connectors are pairs: the first one, and one of the others (Round r9: the
  // pairs run in order along the seam, every cloth point of either side among them)
  S.seams.forEach((s, k) => {
    const ends = seamEnds(s, S.pieces), pr = sm[k].pairs, is = (pair, e) => { const a = where2(pair[0], order), b = where2(pair[1], order); return Math.hypot(a[0] - e[0].x, a[1] - e[0].y) < 1e-6 && Math.hypot(b[0] - e[1].x, b[1] - e[1].y) < 1e-6; };
    assert.ok(is(pr[0], ends[0]), "S" + s.id + " starts where the 2D window's connector does");
    assert.ok(pr.some(q => is(q, ends[1])), "S" + s.id + " ends where the 2D window's connector does");
  });
  assert.strictEqual(sm[0].pairs.length, 16); assert.strictEqual(sm[0].bad, false);
  near(sm[1].la, 100, 1e-6); near(sm[1].lb, 200, 1e-6); assert.strictEqual(sm[1].bad, true, "a seam whose sides differ is marked");
  // 1:2: every place of the long edge meets the place the same share of the way along B's edge and then C's (300 + 150)
  for (const [a, b] of sm[2].pairs) { const xa = where2(a, order)[0], q = where2(b, order), sb = b.p === 1 ? 300 - q[0] : 300 + (q[0] - 400); near(xa/300, sb/450, 1e-6, "in proportion"); }
  const at200 = sm[2].pairs.filter(([a]) => Math.abs(where2(a, order)[0] - 200) < 1e-6).map(([, b]) => b.p + ":" + where2(b, order).map(v => Math.round(v)).join(","));
  assert.deepStrictEqual(at200.sort(), ["1:0,600", "2:400,400"], "where B's edge ends and C's begins, both corners are sewn to the same place two thirds along A");
  // a pattern with no cloth (hidden): its seams are left out, the rest stay
  B.on = false; garmentSync();
  assert.strictEqual(simSeams(S.pieces.filter(p => p.on).map(p => p.id)).length, 0);
});

test("darts, internal lines and layers: a cut-out dart is a seam between its legs, a seam on an internal line runs through the triangles, layered seams are separate", () => {
  reset();
  const A = rect("A", 0, 0, 300, 400), B = rect("B", 400, 0, 200, 100), Cc = rect("C", 400, 300, 200, 100);
  addDartTo(A, 0, 0.5, 30, 120);
  const j = addChild(A, "internals", mkShape([V(50, 250), V(250, 250)], false)), line = A.internals[j];
  add(makeSeam(S.seams, { piece: A.id, shape: line.id, sid: line.segs[0].id }, { piece: B.id, sid: B.segs[2].id }));    // a pocket top sewn on a line inside A
  add(makeSeam(S.seams, { piece: A.id, sid: A.segs[2].id }, { piece: B.id, sid: B.segs[0].id }));
  add(makeSeam(S.seams, { piece: A.id, sid: A.segs[2].id }, { piece: Cc.id, sid: Cc.segs[0].id }));                      // a second layer on A's bottom edge
  garmentSync();
  const order = S.pieces.map(p => p.id), sm = simSeams(order), dart = sm.find(s => s.dart);
  assert.strictEqual(sm.length, 4); assert.ok(dart, "the dart");
  near(dart.la, Math.hypot(15, 120), 1e-6); near(dart.lb, dart.la, 1e-9);
  const dl = dart.pairs[dart.pairs.length-1]; assert.deepStrictEqual(dl[0].i, dl[1].i, "the two legs end on the one dart point");
  near(Math.abs(where2(dart.pairs[0][0], order)[0] - where2(dart.pairs[0][1], order)[0]), 30, 1e-6, "and start 30 apart at its mouth");
  const inner = sm[0];
  near(inner.la, 200, 1e-6); assert.ok(inner.pairs.every(([a]) => a.i.length === 3), "places inside the cloth are held by a triangle each");
  near(where2(inner.pairs[0][0], order)[1], 250, 1e-6); near(where2(inner.pairs[inner.pairs.length-1][0], order)[0], 250, 1e-6);
  assert.strictEqual(sm[1].pairs.length, sm[2].pairs.length); assert.notStrictEqual(sm[1].id, sm[2].id);
  // A's top edge is sewn across the dart: its length is the edge less the dart's width
  add(makeSeam(S.seams, { piece: A.id, sid: A.segs[0].id }, { piece: Cc.id, sid: Cc.segs[2].id }));
  const topSeam = simSeams(order).find(s => s.id === 4);
  near(topSeam.la, 270, 1e-6, "300 less the 30 the dart takes"); near(topSeam.la, seamInfo(S.seams[3], S.pieces).la, 1e-6);
  // unsewn edges: A's two sides and nothing of its bottom; with only half the top sewn, the other half is free
  const un = unsewnEdges(A, G3.items.get(A.id).mesh), m = G3.items.get(A.id).mesh, len = (ix) => { let s = 0; for (let k = 0; k < ix.length; k += 2) s += Math.hypot(m.xy[2*ix[k]] - m.xy[2*ix[k+1]], m.xy[2*ix[k]+1] - m.xy[2*ix[k+1]+1]); return s; };
  near(len(un), 800, 1e-6, "the two sides of 400");
  S.seams.pop(); near(len(unsewnEdges(A, m)), 800 + 270, 1e-6, "and the top again, without its dart's mouth");
  add(makeSeam(S.seams, { piece: A.id, sid: A.segs[1].id, t0: 0, t1: 0.5 }, { piece: Cc.id, sid: Cc.segs[1].id }));
  near(len(unsewnEdges(A, m)), 800 + 270 - 200, 1e-6, "half of one side sewn");
});

test("a front and a back sewn at the sides close into a tube round an avatar and stay on it: no point in the body, the seams shut", () => {
  reset();
  const av = avatarSetup(rig().root, "t.fbx"); av.pose = posePreset(av, 60, 8); poseApply(av); S.av = av; av.box = avatarBox(av);
  const f = avatarField(av), pts = Object.fromEntries(arrPoints(av).map(p => [p.id, p]));
  const F = rect("Front", 0, 0, 485, 160), B = rect("Back", 600, 0, 485, 160);
  add(makeSeam(S.seams, { piece: F.id, sid: F.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true));
  add(makeSeam(S.seams, { piece: F.id, sid: F.segs[3].id }, { piece: B.id, sid: B.segs[1].id }, true));
  garmentSync();
  F.p3 = arrangeP3(av, pts.waist_front, 485, 160); B.p3 = arrangeP3(av, pts.waist_back, 485, 160);
  garmentSync(); simBuild();
  const sim = SIM.sim;
  assert.strictEqual(SIM.seams.length, 2); assert.strictEqual(sim.field, f);
  const start = C.clothSeamGaps(sim).map(g => g.max);
  assert.ok(start[0] > 40 && start[1] > 40, "the side seams start well apart: " + start);
  let cy = 0;
  for (let i = 0; i < sim.n; i++) cy += sim.x[3*i+1]/sim.n;
  run(sim, 150);
  const gaps = C.clothSeamGaps(sim).map(g => g.max);
  assert.ok(gaps[0] < 3 && gaps[1] < 3, "the side seams are shut: " + gaps);
  let minD = Infinity, cy2 = 0;
  for (let i = 0; i < sim.n; i++) { minD = Math.min(minD, C.sdfAt(f, sim.x[3*i], sim.x[3*i+1], sim.x[3*i+2])); cy2 += sim.x[3*i+1]/sim.n; }
  assert.ok(minD > 1, "nothing is in the body: " + minD);
  assert.ok(cy - cy2 < 170, "a tube of 970 round a waist box of 900 above a hip box of 960 stays up on the hips: it sank " + (cy - cy2));
  assert.ok(meanStrain(sim) < 0.05, "mean strain " + meanStrain(sim));
});

test("a front and a back that start well off to one side of the body still close on both sides: the edges of a seam that is open slide round the body, they are not held where they first touch it", () => {
  // a ball of 150 mm; two panels of 500 x 80, one before it and one behind, both 180 mm to one side; a seam down each side
  const f = C.buildSDF(ball(150, [0, 1200, 0]), { cell: 10 }), W = 500, A = sheet(W, 80, 20), B = sheet(W, 80, 20);
  const side = (m, x) => edgeOf(m, (px) => Math.abs(px - x) < 1e-6).sort((p, q) => m.xy[2*p+1] - m.xy[2*q+1]);
  const path = (m, k, vs) => C.seamPath(vs.map(v => ({ a: one(k, v), pos: [m.xy[2*v], m.xy[2*v+1]] })));
  const build = (opt) => C.clothBuild({ pieces: [A, B].map((m, k) => ({ xy: m.xy, tri: m.tri, X: lay(m, (x, y) => [x - W/2 + 180, 1240 - y, k ? -200 : 200]), fab: { weight: 150, thick: 4.5, friction: 0.5 } })),
    seams: [{ id: 1, pairs: C.seamPairs(path(A, 0, side(A, 0)), path(B, 1, side(B, 0)), 20) }, { id: 2, pairs: C.seamPairs(path(A, 0, side(A, W)), path(B, 1, side(B, W)), 20) }], field: f, opt: { gravity: 0, ground: false, self: false, ...opt } });
  const sim = run(build({}), 400), gaps = C.clothSeamGaps(sim).map(g => g.max);
  assert.ok(gaps[0] < 1 && gaps[1] < 1, "both seams are shut: " + gaps);
  let minD = Infinity;
  for (let i = 0; i < sim.n; i++) minD = Math.min(minD, C.sdfAt(f, sim.x[3*i], sim.x[3*i+1], sim.x[3*i+2]));
  assert.ok(minD > 1, "nothing is in the body: " + minD);
  assert.ok(C.clothStrain(sim) < 0.05, "and the cloth was not stretched to do it: " + C.clothStrain(sim));
  // before Round F the body held every point that pressed on it and the far seam's edges stayed one before the ball and one
  // behind it. Since Round r9 the seams are put right after the body in every small step, so even with the body's friction
  // holding every point the seams are pulled shut
  const held = C.clothSeamGaps(run(build({ seamSlip: Infinity }), 400)).map(g => g.max);
  assert.ok(Math.max(...held) < 1, "with friction holding every point, both seams still shut: " + held);
  // a seam that has closed is held as before: its points are no longer marked
  assert.strictEqual(sim.sOpen.reduce((n, v) => n + v, 0), 0, "no point is sliding once every seam is shut");
});

test("Space in the booted app: Simulate is a switch of the 3D toolbar and the menus; the 2D window is panned with the middle button", () => {
  const r = boot({ script: `
    const out = {};
    out.tool = [app.TOOLS.simulate.off, app.TOOLS.simulate.toggle, app.TOOLS.simulate.key];
    app.key(" "); out.space = [S.space || false, app.SIM.on, toasts[toasts.length-1]];
    out.menu = app.MENUS.avatar().filter(x => x.n).map(x => x.n);
    S.pieces[0].fabric = S.lib.fabric[0].id; S.lib.fabric[0].physical = "Denim";
    out.phys = app.fabricPhys(S.lib.fabric[0]);
    out.settings = JSON.parse(app.docJSON()).cloth;
    out.sewing3 = (S.ui.show3d || {}).sewing3 !== false; app.show3dChanged();
    return out;
  ` });
  assert.deepStrictEqual(r.errors, [], "no errors");
  const o = r.result;
  assert.deepStrictEqual(o.tool, [false, "simulate", "Space"]);
  assert.strictEqual(o.space[0], false, "Space is not held for panning any more"); assert.strictEqual(o.space[1], false); assert.ok(/3D window is not up/.test(o.space[2]), o.space[2]);
  assert.ok(o.menu.includes("Simulate") && o.menu.includes("Simulation Settings…"));
  assert.ok(o.phys.bend > 100 && o.phys.weight === 150);
  assert.deepStrictEqual(o.settings, { res: 20, substeps: 20, self: true, worker: true });
});

module.exports = T;
