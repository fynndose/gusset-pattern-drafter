// Roadmap 3D, batch 2: patterns as cloth in the 3D window. The triangulation, the mesh
// of a pattern (every outline edge kept, even triangles, darts cut out), where a flat
// pattern is in 3D (flat and wrapped), arrangement points worked out from an avatar,
// the cloth following the document, and moving patterns in 3D.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");
const { three, rig, RIG_NAMES } = require("./three-env");
const RIG_ROLES = Object.keys(RIG_NAMES);
const C = require("../drafter-sim.js");

const { THREE } = three();
const S = { pieces: [], seams: [], stitches: [], images: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, unit: "mm", dec: 1, ui: { render: "front", layout: "both", show3d: {} }, cloth: { res: 20 }, lib: null, av: null, avSet: { cell: 20 },
  undo: [], redo: [], un: [], rn: [] };
const groups = {};
const view3d = { group: (n) => groups[n] || (groups[n] = new THREE.Group()), ask() {}, ready: () => true, cam: { dist: 5000 }, tool() {}, camera: () => null };
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }) });
const G = load(["V", "mkShape", "mkPiece", "starter", "addDartTo", "segLen", "segPt", "nSeg", "dartGeom", "pieceLoop", "pieceMesh3", "pieceSig", "normCloth", "normP3", "defaultP3", "pieceP3", "G3", "garmentSync", "garmentHit",
  "movePieces3", "placeSig", "arrPoints", "arrangeRadius", "arrangeP3", "avatarSetup", "avatarField", "avatarBox", "poseApply", "posePreset", "normLib", "byId", "bboxOf"],
  { S, THREE, SIM3D: C, view3d, document: { createElement: fakeCanvas }, Image: undefined, ui: () => {}, draw: () => {}, toast: () => {} });
const { V, mkShape, mkPiece, starter, addDartTo, segLen, pieceLoop, pieceMesh3, normCloth, normP3, defaultP3, G3, garmentSync, garmentHit, movePieces3, arrPoints, arrangeRadius, arrangeP3, avatarSetup, avatarField, avatarBox, poseApply, posePreset, normLib } = G;
S.lib = normLib(null);

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
function reset() { S.pieces = []; S.seams = []; S.sel = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.cloth = normCloth(null); S.av = null; for (const it of G3.items.values()) view3d.group("garment").remove(it.obj, it.line); G3.items.clear(); }
const rect = (name, x, y, w, h) => { const p = mkPiece(name, mkShape([V(x, y), V(x + w, y), V(x + w, y + h), V(x, y + h)], true)); S.pieces.push(p); return p; };
// every edge of the outline is an edge of exactly one triangle, and inner edges of two
function edgeUse(tri) {
  const m = new Map();
  for (let t = 0; t < tri.length; t += 3) for (let e = 0; e < 3; e++) { const a = tri[t+e], b = tri[t+(e+1)%3], k = Math.min(a, b) + "_" + Math.max(a, b); m.set(k, (m.get(k) || 0) + 1); }
  return m;
}
let seed = 7;
const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;

test("triangulation: every point is used, the count is right for the hull, and no point lies inside another triangle's circle", () => {
  const n = 300, xy = new Float64Array(2*n);
  for (let i = 0; i < 2*n; i++) xy[i] = rnd()*500;
  const tri = C.delaunay(xy), used = new Set(tri);
  assert.strictEqual(used.size, n);
  const use = edgeUse(tri), hull = [...use.values()].filter(v => v === 1).length;
  assert.strictEqual(tri.length/3, 2*n - 2 - hull, "Euler: 2n - 2 - hull points");
  assert.ok([...use.values()].every(v => v <= 2));
  for (let t = 0; t < tri.length; t += 3) {
    const [a, b, c] = [tri[t], tri[t+1], tri[t+2]], ax = xy[2*a], ay = xy[2*a+1], bx = xy[2*b] - ax, by = xy[2*b+1] - ay, cx = xy[2*c] - ax, cy = xy[2*c+1] - ay, d = 2*(bx*cy - by*cx);
    const ux = (cy*(bx*bx + by*by) - by*(cx*cx + cy*cy))/d, uy = (bx*(cx*cx + cy*cy) - cx*(bx*bx + by*by))/d, r2 = ux*ux + uy*uy;
    for (let p = 0; p < n; p += 7) if (p !== a && p !== b && p !== c) assert.ok((xy[2*p] - ax - ux)**2 + (xy[2*p+1] - ay - uy)**2 > r2*(1 - 1e-9), "empty circle");
  }
  assert.strictEqual(C.delaunay(new Float64Array([0, 0, 1, 1])).length, 0);
});

test("a filled outline: the area is exact, every outline edge is a triangle's edge, triangles are even and all wound the same way", () => {
  const sq = [], n = 10;
  for (let i = 0; i < n; i++) sq.push([20*i, 0]); for (let i = 0; i < n; i++) sq.push([200, 20*i]); for (let i = 0; i < n; i++) sq.push([200 - 20*i, 200]); for (let i = 0; i < n; i++) sq.push([0, 200 - 20*i]);
  const m = C.meshPolygon(sq, 20);
  near(C.triArea2D(m.xy, m.tri), 40000, 1e-6, "area");
  const use = edgeUse(m.tri);
  for (let i = 0; i < m.loop.length; i++) assert.strictEqual(use.get(Math.min(m.loop[i], m.loop[(i+1) % m.loop.length]) + "_" + Math.max(m.loop[i], m.loop[(i+1) % m.loop.length])), 1, "outline edge " + i);
  assert.strictEqual([...use.values()].filter(v => v === 1).length, m.loop.length, "nothing else is on the border");
  assert.deepStrictEqual([...m.src], sq.map((p, i) => i), "no outline point had to be added");
  const q = C.triQuality(m.xy, m.tri);
  assert.ok(q.mean > 0.93 && q.min > 0.45, "even triangles: " + JSON.stringify(q));
  for (let t = 0; t < m.tri.length; t += 3) { const [a, b, c] = [m.tri[t], m.tri[t+1], m.tri[t+2]]; assert.ok((m.xy[2*b] - m.xy[2*a])*(m.xy[2*c+1] - m.xy[2*a+1]) - (m.xy[2*c] - m.xy[2*a])*(m.xy[2*b+1] - m.xy[2*a+1]) < 0, "clockwise on the y-down page"); }
  // half the distance: about four times the triangles
  const fine = C.meshPolygon(sq.flatMap((p, i) => [p, [(p[0] + sq[(i+1) % sq.length][0])/2, (p[1] + sq[(i+1) % sq.length][1])/2]]), 10);
  assert.ok(fine.tri.length > 3.4*m.tri.length && fine.tri.length < 4.8*m.tri.length);
  assert.strictEqual(C.meshPolygon([[0, 0], [10, 0], [20, 0]], 5), null, "no area, no mesh"); assert.strictEqual(C.meshPolygon([[0, 0], [1, 0]], 5), null);
});

test("hollow corners and narrow places: nothing is filled outside the outline, and an outline edge the triangles would cut across is halved", () => {
  // an L
  const L = [[0, 0], [100, 0], [200, 0], [200, 100], [100, 100], [100, 200], [100, 300], [0, 300], [0, 200], [0, 100]];
  const m = C.meshPolygon(L, 25);
  near(C.triArea2D(m.xy, m.tri), 40000, 1e-6, "an L of 200 x 100 and 100 x 200");
  for (let t = 0; t < m.tri.length; t += 3) { const cx = (m.xy[2*m.tri[t]] + m.xy[2*m.tri[t+1]] + m.xy[2*m.tri[t+2]])/3, cy = (m.xy[2*m.tri[t]+1] + m.xy[2*m.tri[t+1]+1] + m.xy[2*m.tri[t+2]+1])/3; assert.ok(!(cx > 100 && cy > 100), "nothing in the hollow"); }
  // a long edge beside a close opposite corner: sampled too coarsely on purpose
  const slot = [[0, 0], [300, 0], [300, 100], [160, 100], [150, 8], [140, 100], [0, 100]];
  const s = C.meshPolygon(slot, 30), use = edgeUse(s.tri);
  near(C.triArea2D(s.xy, s.tri), 30000 - 20*92/2, 1e-6);
  assert.ok(s.loop.length > slot.length, "the long edge under the notch was halved");
  assert.ok([...s.src].some(v => v !== Math.floor(v)) && [...s.src].every((v, i, a) => i === 0 || v > a[i-1]), "added points say where on the outline they are, in order");
  for (let i = 0; i < s.loop.length; i++) assert.strictEqual(use.get(Math.min(s.loop[i], s.loop[(i+1) % s.loop.length]) + "_" + Math.max(s.loop[i], s.loop[(i+1) % s.loop.length])), 1);
});

test("where a flat pattern is in 3D: flat it keeps its lengths and its right is its right; wrapped it lies on a cylinder with lengths along the cloth kept", () => {
  const c = [100, 50], o = [0, 0, 0], flat = { pos: [10, 1000, 300], q: [0, 0, 0, 1], r: 0 };
  assert.deepStrictEqual(C.placePoint(100, 50, c, flat, o).slice(), [10, 1000, 300]);
  assert.deepStrictEqual(C.placePoint(160, 50, c, flat, o).slice(), [70, 1000, 300], "page right is the world's x");
  assert.deepStrictEqual(C.placePoint(100, 90, c, flat, o).slice(), [10, 960, 300], "page down is down");
  const wrap = { pos: [0, 1000, 150], q: [0, 0, 0, 1], r: 150 };
  for (const x of [0, 60, 100, 180, 330]) {
    const p = C.placePoint(x, 20, c, wrap, [0, 0, 0]);
    near(Math.hypot(p[0], p[2]), 150, 1e-9, "on the cylinder round the upright through the origin"); near(p[1], 1030, 1e-9);
    near(Math.atan2(p[0], p[2])*150, x - 100, 1e-9, "the way round is the distance on the pattern");
  }
  // turned to face backward: its right is the world's -x, its face looks along -z
  const back = { pos: [0, 1000, -150], q: C.qAxis([0, 1, 0], 180), r: 150 }, pb = C.placePoint(130, 50, c, back, [0, 0, 0]);
  assert.ok(pb[0] < -29 && pb[2] > -150 && pb[2] < -146);
  const q = C.qFromBasis([0, 0, -1], [0, 1, 0], [1, 0, 0]), v = C.qRot(q, 1, 2, 3, [0, 0, 0]);
  near(v[0], 3, 1e-12); near(v[1], 2, 1e-12); near(v[2], -1, 1e-12);
  const qq = C.qMul(C.qAxis([0, 1, 0], 90), C.qAxis([1, 0, 0], 90)), w = C.qRot(qq, 0, 0, 1, [0, 0, 0]);
  near(w[0], 0, 1e-12); near(w[1], -1, 1e-12); near(w[2], 0, 1e-12, "the second turn is about the turned axis");
  const out = C.placeVerts(new Float64Array([100, 50, 160, 50]), c, flat);
  assert.deepStrictEqual([...out], [10, 1000, 300, 70, 1000, 300]);
});

test("a pattern as cloth: every pattern point is a cloth point, each outline segment is a chain of them, and the area is the pattern's", () => {
  reset();
  const p = starter(); S.pieces.push(p); p.darts = [];
  for (const res of [20, 10]) {
    const m = pieceMesh3(p, res);
    for (const q of p.pts) assert.ok(Array.from({ length: m.loop.length }, (_, k) => Math.hypot(m.xy[2*m.loop[k]] - q.x, m.xy[2*m.loop[k]+1] - q.y)).some(d => d < 1e-9), "a pattern point");
    assert.strictEqual(m.chains.size, p.segs.length);
    p.segs.forEach((sg, i) => {
      const ch = m.chains.get(sg.id);
      assert.ok(ch.length >= 2 && ch[0].t === 0 && ch[ch.length-1].t === 1 && ch.every((e, k) => k === 0 || e.t > ch[k-1].t), "a chain runs from 0 to 1");
      assert.strictEqual(ch[ch.length-1].v, m.chains.get(p.segs[(i+1) % p.segs.length].id)[0].v, "and ends on the next segment's first point");
      let len = 0;
      for (let k = 1; k < ch.length; k++) len += Math.hypot(m.xy[2*ch[k].v] - m.xy[2*ch[k-1].v], m.xy[2*ch[k].v+1] - m.xy[2*ch[k-1].v+1]);
      near(len, segLen(p, i), segLen(p, i)*(res > 15 ? 0.015 : 0.004) + 0.01, "the chain is as long as its edge (chords of a curve are a little short)");
      for (let k = 2; k < ch.length - 1; k++) near(Math.hypot(m.xy[2*ch[k].v] - m.xy[2*ch[k-1].v], m.xy[2*ch[k].v+1] - m.xy[2*ch[k-1].v+1]), len/(ch.length - 1), len/(ch.length - 1)*0.25, "evenly spaced");
    });
    const q = C.triQuality(m.xy, m.tri);
    assert.ok(q.mean > 0.94 && q.min > 0.3, JSON.stringify(q));
    near(m.w, 190.5, 2); near(m.h, 495, 2);
  }
  assert.ok(pieceMesh3(p, 10).tri.length > 3*pieceMesh3(p, 20).tri.length, "the density setting is what it says");
});

test("a dart that is not trued up is cut out of the cloth: two legs of equal length that share the dart point, and the edge's chain jumps its mouth", () => {
  reset();
  const p = rect("P", 0, 0, 300, 400);
  addDartTo(p, 0, 0.5, 30, 120);
  const m = pieceMesh3(p, 15);
  near(C.triArea2D(m.xy, m.tri), 120000 - 30*120/2, 1e-6, "the wedge is gone");
  assert.strictEqual(m.darts.length, 1);
  const d = m.darts[0], P = (v) => [m.xy[2*v], m.xy[2*v+1]], len = (l) => l.slice(1).reduce((s, v, k) => s + Math.hypot(P(v)[0] - P(l[k])[0], P(v)[1] - P(l[k])[1]), 0);
  assert.strictEqual(d.a.length, d.b.length); assert.strictEqual(d.a[d.a.length-1], d.b[d.b.length-1], "one dart point");
  near(len(d.a), len(d.b), 1e-9); near(len(d.a), Math.hypot(15, 120), 1e-9);
  near(P(d.a[0])[0], 135, 1e-9); near(P(d.b[0])[0], 165, 1e-9); near(P(d.a[d.a.length-1])[1], 120, 1e-9, "the dart point is its depth inside");
  const ch = m.chains.get(p.segs[0].id), j = ch.findIndex(e => e.jump);
  assert.ok(j > 0 && ch.filter(e => e.jump).length === 1); assert.strictEqual(ch[j].v, d.b[0]); assert.strictEqual(ch[j-1].v, d.a[0]);
  // a dart too close to the corner to be cut is left as drawn
  const p2 = rect("Q", 400, 0, 100, 100); addDartTo(p2, 0, 0.02, 30, 40);
  assert.strictEqual(pieceMesh3(p2, 15).darts.length, 0);
  // the starter's own dart
  S.pieces.push(starter());
  assert.strictEqual(pieceMesh3(S.pieces[2], 20).darts.length, 1);
});

test("settings and placements are cleaned when read: junk is dropped, a placement's turn is made unit length", () => {
  assert.deepStrictEqual(normCloth(null), { res: 20, substeps: 20, self: true, worker: true }); assert.deepStrictEqual(normCloth({ res: 1, substeps: 99, self: 0 }), { res: 20, substeps: 20, self: true, worker: true }); assert.deepStrictEqual(normCloth({ res: "12", substeps: 6.4, self: false }), { res: 12, substeps: 6, self: false, worker: true });
  assert.strictEqual(normP3(null), null); assert.strictEqual(normP3({ pos: [1, 2], q: [0, 0, 0, 1] }), null); assert.strictEqual(normP3({ pos: [1, 2, 3], q: [0, 0, 0, 0] }), null); assert.strictEqual(normP3({ pos: [1, NaN, 3], q: [0, 0, 0, 1] }), null);
  assert.deepStrictEqual(normP3({ pos: [1, 2, 3], q: [0, 0, 0, 2], r: -5, pt: 7, junk: 1 }), { pos: [1, 2, 3], q: [0, 0, 0, 1], r: 0 });
  assert.deepStrictEqual(normP3({ pos: [1, 2, 3], q: [0, 1, 0, 0], r: 180, pt: "chest_front" }), { pos: [1, 2, 3], q: [0, 1, 0, 0], r: 180, pt: "chest_front" });
});

test("arrangement points are worked out from the avatar: body, neck, arms and legs, each an axis and a way out, the same count on both sides", () => {
  const av = avatarSetup(rig().root, "t.fbx");
  av.pose = posePreset(av, 45, 8); poseApply(av);
  const pts = arrPoints(av), by = Object.fromEntries(pts.map(p => [p.id, p]));
  assert.strictEqual(pts.length, 46); assert.strictEqual(Object.keys(by).length, 46, "unique ids");
  assert.strictEqual(pts.filter(p => p.group === "Left").length, 16); assert.strictEqual(pts.filter(p => p.group === "Right").length, 16);
  const cf = by.chest_front, f = avatarField(av);
  near(cf.out[2], 1, 1e-9); near(cf.up[1], 1, 1e-9); near(cf.side[0], 1, 1e-9, "seen from in front, the pattern's right is the avatar's left: not mirrored");
  near(by.chest_back.side[0], -1, 1e-9); near(by.chest_left.out[0], 1, 1e-9); near(by.chest_right.out[0], -1, 1e-9);
  near(cf.a[0], 0, 12, "the axis is in the middle of the chest"); near(cf.a[2], 0, 12); near(cf.rho, 95, 14, "the chest box is 95 deep");
  near(by.chest_left.rho, 160, 14);
  assert.ok(by.hip_front.a[1] < by.waist_front.a[1] && by.waist_front.a[1] < cf.a[1] && cf.a[1] < by.neck_front.a[1]);
  // limbs: the axis runs up the limb, towards the body
  const ua = by.armL_outer, fa = by.forearmL_front, th = by.thighR_front, sh = by.shinR_inner;
  near(Math.hypot(ua.up[0], ua.up[1]), 1, 1e-6); assert.ok(ua.up[0] < -0.6 && ua.up[1] > 0.6, "left arm at 45 degrees: up the arm is up and inward");
  assert.ok(ua.out[0] > 0.6 && ua.out[1] > 0.6, "outside of the left arm"); near(fa.out[2], 1, 1e-6);
  assert.ok(th.up[1] > 0.95 && th.out[2] > 0.99 && th.a[0] < -60); assert.ok(sh.out[0] > 0.9, "the inside of the right shin looks towards the left leg");
  near(by.armL_front.rho, 42, 12); near(th.rho, 75, 14);
  for (const p of pts) { near(Math.hypot(...p.up), 1, 1e-9); near(p.up[0]*p.out[0] + p.up[1]*p.out[1] + p.up[2]*p.out[2], 0, 1e-9, p.id + " out is square to its axis"); assert.ok(p.rho > 10, p.id + " reaches the body"); assert.ok(C.sdfAt(f, p.a[0] + p.out[0]*(p.rho + 30), p.a[1] + p.out[1]*(p.rho + 30), p.a[2] + p.out[2]*(p.rho + 30)) > 5, p.id + " is shown outside the body"); }
  // a rig with no known bones has none
  assert.strictEqual(arrPoints(avatarSetup(rig({ names: Object.fromEntries(RIG_ROLES.map((k, i) => [k, "b" + i])) }).root, "odd")).length, 0);
  // without arm bones: the body and the legs only
  assert.strictEqual(arrPoints(avatarSetup(rig({ names: { ...RIG_NAMES, armL: "x1", armR: "x2", forearmL: "x3", forearmR: "x4" } }).root, "noarms")).length, 14 + 16);
});

test("placing a pattern at an arrangement point wraps it round the body, clear of it, facing out; a wide pattern gets a wider curve", () => {
  reset();
  const av = avatarSetup(rig().root, "t.fbx");
  av.pose = posePreset(av, 45, 8); poseApply(av); S.av = av;
  const f = avatarField(av), by = Object.fromEntries(arrPoints(av).map(p => [p.id, p]));
  const p = rect("Front", 0, 0, 300, 400), m = pieceMesh3(p, 20);
  const p3 = arrangeP3(av, by.chest_front, m.w, m.h), X = C.placeVerts(m.xy, m.c, p3);
  assert.strictEqual(p3.pt, "chest_front"); assert.ok(p3.r >= 160 + 20 && p3.r < 260, "clear of the chest's widest reach over its span: " + p3.r);
  let lo = Infinity;
  for (let i = 0; i < X.length; i += 3) lo = Math.min(lo, C.sdfAt(f, X[i], X[i+1], X[i+2]));
  assert.ok(lo > 8, "no point of the cloth starts in the body: " + lo);
  near(p3.pos[2], by.chest_front.a[2] + p3.r, 1e-9); near(p3.pos[0], by.chest_front.a[0], 1e-9);
  const right = C.placePoint(m.c[0] + 50, m.c[1], m.c, p3, [0, 0, 0]);
  assert.ok(right[0] > p3.pos[0] + 45 && right[2] < p3.pos[2], "its right goes to the avatar's left and back round the body");
  // on the back it faces backward
  const pb = arrangeP3(av, by.chest_back, m.w, m.h), rb = C.placePoint(m.c[0] + 50, m.c[1], m.c, pb, [0, 0, 0]);
  assert.ok(pb.pos[2] < -150 && rb[0] < pb.pos[0] - 45);
  // a sleeve on the arm: a small radius; a piece far wider than the arm's girth: a cylinder it fits on
  const s1 = arrangeP3(av, by.armL_outer, 150, 200), s2 = arrangeP3(av, by.armL_outer, 900, 200);
  assert.ok(s1.r > 55 && s1.r < 110, "sleeve radius " + s1.r); near(s2.r, 900/(2*Math.PI*0.92), 1e-6);
  assert.ok(arrangeRadius(f, by.chest_front, 300, 400, 60) > arrangeRadius(f, by.chest_front, 300, 400, 10), "a bigger gap, a bigger curve");
});

test("the cloth follows the document: meshed again only when a shape changes, arranged again when its placement does, gone when its pattern is", () => {
  reset();
  const a = rect("A", 0, 0, 200, 300), b = rect("B", 400, 0, 200, 300);
  garmentSync();
  assert.strictEqual(G3.items.size, 2); assert.strictEqual(view3d.group("garment").children.length, 4, "a mesh and an outline each");
  const ia = G3.items.get(a.id), ib = G3.items.get(b.id), cx = (X) => { let s = 0; for (let i = 0; i < X.length; i += 3) s += X[i]; return s/(X.length/3); };
  near(cx(ib.X) - cx(ia.X), 400, 1e-3, "not arranged: laid out as in the 2D window"); near(ia.X[2], 420, 1e-6, "flat, in front");
  near(defaultP3(a, ia.mesh.c).pos[0], -200, 1e-9);
  // arranged: the same cloth, somewhere else
  a.p3 = { pos: [0, 1200, 300], q: [0, 0, 0, 1], r: 200 };
  garmentSync();
  assert.strictEqual(G3.items.get(a.id), ia, "not meshed again"); near(cx(ia.X), 0, 1e-3); assert.ok(Math.max(...ia.X.filter((v, i) => i % 3 === 2)) <= 300 + 1e-6, "curved back from its middle");
  // moved in 3D: the cloth and the placement together, and the next sync leaves it alone
  ia.X[1] += 5;                                                   // as if a simulation had moved a point
  movePieces3([a.id], new THREE.Vector3(10, 0, -20));
  assert.deepStrictEqual(a.p3.pos, [10, 1200, 280]);
  const y = ia.X[1]; garmentSync(); assert.strictEqual(ia.X[1], y, "a drape is kept through a move");
  // a layer stands further out
  b.layer = 2; garmentSync(); near(ib.X[2], 432, 1e-6);
  // a changed shape is meshed again; a hidden pattern has no cloth; a deleted one neither
  a.pts[1] = V(260, 0); garmentSync();
  assert.notStrictEqual(G3.items.get(a.id), ia); assert.ok(G3.items.get(a.id).mesh.w > 250);
  b.on = false; garmentSync(); assert.strictEqual(G3.items.size, 1);
  S.pieces = []; garmentSync(); assert.strictEqual(G3.items.size, 0); assert.strictEqual(view3d.group("garment").children.length, 0);
  // density
  rect("C", 0, 0, 200, 300); garmentSync(); const n20 = G3.items.get(S.pieces[0].id).mesh.tri.length;
  S.cloth = normCloth({ res: 10 }); garmentSync(); assert.ok(G3.items.get(S.pieces[0].id).mesh.tri.length > 3*n20);
});

test("a pattern is picked in 3D by the ray under the pointer: the nearest one, and where on it", () => {
  reset();
  const a = rect("A", 0, 0, 200, 300), b = rect("B", 0, 0, 200, 300);
  a.p3 = { pos: [0, 1000, 300], q: [0, 0, 0, 1], r: 0 }; b.p3 = { pos: [0, 1000, 200], q: [0, 0, 0, 1], r: 0 };
  garmentSync();
  for (const it of G3.items.values()) { it.obj.updateMatrixWorld(true); }
  const ray = (o, d) => { const rc = new THREE.Raycaster(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize()); return { o: rc.ray.origin, d: rc.ray.direction, rc }; };
  const h = garmentHit(ray([20, 1010, 2000], [0, 0, -1]));
  assert.strictEqual(h.p, a, "the one in front"); near(h.point.z, 300, 1e-6); near(h.point.x, 20, 1e-6);
  assert.strictEqual(garmentHit(ray([20, 1010, -2000], [0, 0, 1])).p, b, "from behind, the other");
  assert.strictEqual(garmentHit(ray([500, 1010, 2000], [0, 0, -1])), null);
});

test("3D tools and settings in the booted app: Q is the 3D window's own tool, density and placements are saved with the pattern file, a copy starts unarranged", () => {
  const r = boot({ script: `
    const out = {};
    app.setTool("edit_pattern"); app.key("q"); out.tools = [S.tool, S.tool3, S.ui.layout];
    app.setDensity(12); out.cloth = JSON.parse(app.docJSON()).cloth;
    app.setDensity(2); out.refused = [S.cloth.res, toasts[toasts.length-1]];
    const p = S.pieces[0];
    app.push("Arrange"); p.p3 = { pos: [1, 2, 3], q: [0, 0, 0, 2], r: 150, pt: "chest_front" }; app.commit();
    const doc = JSON.parse(app.docJSON()); out.saved = doc.pieces[0].p3;
    doc.pieces.push({ ...doc.pieces[0], id: 77, p3: { pos: "x" } });
    app.loadDoc(doc); out.loaded = S.pieces.map(q => q.p3 || null); out.resLoaded = S.cloth.res;
    S.sel = [S.pieces[0].id]; app.key("c", { ctrlKey: true }); app.key("v", { ctrlKey: true }); app.click(400, 300);
    { const c = S.pieces[S.pieces.length-1].p3; out.copy = c ? [c.pt || null, JSON.stringify(c.pos) === JSON.stringify(S.pieces[0].p3.pos)] : null; }
    app.resetArrangement2(false); out.reset = S.pieces.map(q => q.p3 ? [q.p3.pt || null, q.p3.r, JSON.stringify(q.p3.q)] : null); app.undo(); out.undone = S.pieces[0].p3.pt === "chest_front";
    out.arr = [S.ui.arrPts, (app.setArrPoints(true), S.ui.arrPts), toasts[toasts.length-1]];
    out.menu = app.MENUS.avatar().filter(x => x.n).map(x => x.n);
    return out;
  ` });
  assert.deepStrictEqual(r.errors, [], "no errors");
  const o = r.result;
  assert.deepStrictEqual(o.tools, ["edit_pattern", "select_move", "both"], "the 2D tool stays in hand");
  assert.deepStrictEqual(o.cloth, { res: 12, substeps: 20, self: true, worker: true }, "the density is in the document");
  assert.strictEqual(o.refused[0], 12); assert.ok(/between 5 and 60/.test(o.refused[1]));
  // (since Round F a place carries the 2D point it hangs on, o, and every pattern has a place: a copy and a reset pattern get the one their 2D place gives)
  const anchor = o.saved.o; assert.ok(Array.isArray(anchor) && anchor.length === 2, "the anchor is saved");
  assert.deepStrictEqual(o.saved, { pos: [1, 2, 3], q: [0, 0, 0, 2], r: 150, pt: "chest_front", o: anchor });
  assert.deepStrictEqual(o.loaded, [{ pos: [1, 2, 3], q: [0, 0, 0, 1], r: 150, pt: "chest_front", o: anchor }, null], "read back cleaned; a broken one is dropped");
  assert.strictEqual(o.resLoaded, 12); assert.deepStrictEqual(o.copy, [null, false], "a pasted copy is not arranged where its source is: it gets the place its own 2D place gives");
  assert.deepStrictEqual(o.reset, [[null, 0, "[0,0,0,1]"], [null, 0, "[0,0,0,1]"], [null, 0, "[0,0,0,1]"]], "reset: every pattern flat, facing forward, where 2D puts it"); assert.strictEqual(o.undone, true);
  assert.strictEqual(o.arr[0], false); assert.strictEqual(o.arr[1], false, "no avatar, no arrangement points"); assert.ok(/load one first/.test(o.arr[2]));
  assert.ok(o.menu.includes("Show Arrangement Points") && o.menu.includes("Cloth Density…"));
});

module.exports = T;
