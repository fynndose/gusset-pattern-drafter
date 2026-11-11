// Roadmap 3D, batch 4: the 3D tools. Folding cloth along a line, lines lying on the
// cloth, pins, the zipper's tapes and chain, measuring the avatar (a length and a girth),
// and what of it is saved with the pattern.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");
const { three, rig } = require("./three-env");
const C = require("../drafter-sim.js");

const { THREE } = three();
const S = { pieces: [], seams: [], stitches: [], images: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, unit: "mm", dec: 1, ui: { render: "front", layout: "both", show3d: {} }, cloth: null, lib: null, av: null, avSet: { cell: 12 }, avMeas: [],
  undo: [], redo: [], un: [], rn: [], sewCheck: { on: false, useLen: true, len: 2, useRatio: false, ratio: 2 }, show: {} };
const groups = {}, toasts = [];
const view3d = { group: (n) => groups[n] || (groups[n] = new THREE.Group()), ask() {}, ready: () => true, cam: { dist: 5000 }, tool() {}, camera: () => null, loop() {}, project: () => null };
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => k === "measureText" ? () => ({ width: 40 }) : (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }) });
const G = load(["V", "mkShape", "mkPiece", "addChild", "mapPiece", "makeSeam", "normCloth", "normLib", "libOf", "libAdd", "garmentSync", "G3", "SIM", "simBuild", "simSeams", "normFolds", "normPins", "pieceFolds", "piecePins", "clothLineList",
  "zipList", "zipTape", "zipBuild", "simExtras", "avatarSetup", "avatarField", "avatarBox", "poseApply", "posePreset", "avatarHit", "partAxis", "girthAt3", "showMeasures", "anchorPos", "byId", "seamInfo"],
  { S, THREE, SIM3D: C, view3d, document: { createElement: fakeCanvas, getElementById: () => null }, Image: undefined, ui: () => {}, draw: () => {}, toast: (m) => toasts.push(m), refreshRail: () => {}, note3d: () => {}, commit: () => {}, push: () => {} });
const { V, mkShape, mkPiece, addChild, mapPiece, makeSeam, normCloth, normLib, libOf, garmentSync, G3, SIM, simBuild, normFolds, normPins, pieceFolds, piecePins, clothLineList, zipList, zipBuild, avatarSetup, avatarField, avatarBox, poseApply, posePreset,
  avatarHit, partAxis, girthAt3, showMeasures } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
function reset() { S.pieces = []; S.seams = []; S.stitches = []; S.sel = []; S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.cloth = normCloth(null); S.lib = normLib(null); S.av = null; S.avMeas = []; for (const it of G3.items.values()) view3d.group("garment").remove(it.obj, it.line); G3.items.clear(); G3.zipKey = null; G3.zips = []; SIM.on = false; }
const rect = (name, x, y, w, h) => { const p = mkPiece(name, mkShape([V(x, y), V(x + w, y), V(x + w, y + h), V(x, y + h)], true)); S.pieces.push(p); return p; };
const add = (sm) => { sm.id = S.seams.reduce((m, x) => Math.max(m, x.id), 0) + 1; S.seams.push(sm); return sm; };
function ball(r, c) {
  let t = [[[1,0,0],[0,1,0],[0,0,1]], [[0,1,0],[-1,0,0],[0,0,1]], [[-1,0,0],[0,-1,0],[0,0,1]], [[0,-1,0],[1,0,0],[0,0,1]], [[0,1,0],[1,0,0],[0,0,-1]], [[-1,0,0],[0,1,0],[0,0,-1]], [[0,-1,0],[-1,0,0],[0,0,-1]], [[1,0,0],[0,-1,0],[0,0,-1]]];
  const mid = (a, b) => { const q = [a[0]+b[0], a[1]+b[1], a[2]+b[2]], l = Math.hypot(...q); return q.map(v => v/l); };
  for (let k = 0; k < 4; k++) t = t.flatMap(([a, b, d]) => { const ab = mid(a, b), bd = mid(b, d), da = mid(d, a); return [[a, ab, da], [ab, b, bd], [da, bd, d], [ab, bd, da]]; });
  return new Float32Array(t.flatMap(q => q.flatMap(p => [p[0]*r + c[0], p[1]*r + c[1], p[2]*r + c[2]])));
}

test("folding flat cloth along a line: the far side turns about it, towards the face for a positive angle; lengths on each side are kept", () => {
  // four points of a 200 x 100 pattern, its middle at (100, 50); the fold line is upright at x = 150
  const xy = new Float64Array([0, 0, 150, 20, 180, 20, 200, 100]), c = [100, 50], line = { a: [150, 0], b: [150, 100] };
  const flat = C.foldVerts(xy, c, []);
  assert.deepStrictEqual([...flat], [-100, 50, 0, 50, 30, 0, 80, 30, 0, 100, -50, 0], "unfolded: u to the right, v up the page, flat");
  const up = C.foldVerts(xy, c, [{ ...line, angle: 90, side: 1 }]);                  // side 1: to the left of a -> b on the y-down page, here the x > 150 side
  near(up[6], 50, 1e-4, "a point 30 beyond the line stands straight up over it"); near(up[8], 30, 1e-4); near(up[7], 30, 1e-4);
  assert.deepStrictEqual([...up.slice(0, 6)], [...flat.slice(0, 6)], "the other side, and a point on the line, stay");
  const over = C.foldVerts(xy, c, [{ ...line, angle: 180, side: 1 }]);
  near(over[6], 20, 1e-4, "folded right over, it lies 30 inside the line"); near(over[8], 0, 1e-4); near(over[9], 0, 1e-4); near(over[11], 0, 1e-4);
  const back = C.foldVerts(xy, c, [{ ...line, angle: -90, side: 1 }]);
  near(back[8], -30, 1e-4, "a negative angle folds away from the face");
  const other = C.foldVerts(xy, c, [{ ...line, angle: 90, side: -1 }]);
  near(other[2], 150, 1e-4, "the other side: the point 150 before the line stands up"); near(other[0], 50, 1e-4); near(other[6], 80, 1e-9);
  // the fold line the other way round means the other side
  const rev = C.foldVerts(xy, c, [{ a: line.b, b: line.a, angle: 90, side: -1 }]);
  near(rev[8], 30, 1e-4);
  // two folds: the second line lies in cloth the first one moved, and is where the first put it
  const two = C.foldVerts(xy, c, [{ ...line, angle: 90, side: 1 }, { a: [180, 0], b: [180, 100], angle: 90, side: 1 }]);
  near(two[9], 30, 1e-4, "up 30, then level again back over the cloth for 20"); near(two[11], 30, 1e-4); near(two[6], 50, 1e-4);
  near(Math.hypot(two[9] - two[6], two[10] - two[7], two[11] - two[8]), Math.hypot(20, 80), 1e-4, "a length on the moved side is what it was");
  // folded cloth where its pattern is arranged: w is the height off the pattern's own surface
  const flatAt = C.placeLocal(new Float32Array([10, 20, 5]), { pos: [0, 1000, 300], q: [0, 0, 0, 1], r: 0 });
  assert.deepStrictEqual([...flatAt], [10, 1020, 305]);
  const wrapped = C.placeLocal(new Float32Array([0, 0, 12]), { pos: [0, 1000, 150], q: [0, 0, 0, 1], r: 150 });
  near(Math.hypot(wrapped[0], wrapped[2]), 162, 1e-4, "on a wrapped pattern it is that much further from the axis");
});

test("Fold Arrangement on a pattern: the side away from its middle is folded, or the other with flip; lines that are gone or closed are skipped", () => {
  reset();
  const p = rect("P", 0, 0, 300, 200);
  const j = addChild(p, "internals", mkShape([V(220, 0), V(220, 200)], false)), k = addChild(p, "bases", mkShape([V(0, 150), V(300, 150)], false)), q = addChild(p, "internals", mkShape([V(20, 20), V(60, 20), V(60, 60)], true));
  p.fold = normFolds([{ kind: "internals", id: p.internals[j].id, angle: 180 }, { kind: "internals", id: 999, angle: 90 }, { kind: "bases", id: p.bases[k].id, angle: 400, flip: true }, { kind: "nonsense", id: 1, angle: 30 }, { kind: "internals", id: p.internals[q].id, angle: 0 }]);
  assert.deepStrictEqual(p.fold.map(f => [f.kind, f.angle, f.flip]), [["internals", 180, false], ["internals", 90, false], ["bases", 180, true]], "junk dropped, the angle kept within half a turn");
  const fd = pieceFolds(p, [150, 100]);
  assert.strictEqual(fd.length, 2, "the fold whose line is gone is skipped");
  // the strip right of x = 220 is the side away from the middle: it is the one that moves; with flip the other side does
  assert.strictEqual(fd[0].side, 1, "left of the line 220,0 -> 220,200 on the y-down page is the x > 220 side");
  p.fold[2].flip = false; assert.strictEqual(pieceFolds(p, [150, 100])[1].side, -fd[1].side);
  // one fold, right over: by default the pattern stands flat facing +z, cloth at x on the page at 3D x (Round FIX-3 / A: the 2D axes are the floor and
  // the centre line; before, its middle stood at x = 0, so cloth at x was at x - 150)
  p.fold = normFolds([{ kind: "internals", id: p.internals[j].id, angle: 180 }]);
  garmentSync();
  const it = G3.items.get(p.id), m = it.mesh;
  let moved = 0;
  for (let i = 0; i < m.xy.length/2; i++) {
    if (m.xy[2*i] > 221) { moved++; near(it.X[3*i], 220 - (m.xy[2*i] - 220), 1e-3, "mirrored in the line x = 220"); near(it.X[3*i+2], it.X[2], 1e-3, "laid flat on the rest"); }
    else if (m.xy[2*i] < 219) near(it.X[3*i], m.xy[2*i], 1e-3, "the rest stays");
  }
  assert.ok(moved > 5);
  p.fold[0].angle = 90; garmentSync();
  for (let i = 0; i < m.xy.length/2; i++) if (m.xy[2*i] > 221) { near(it.X[3*i], 220, 1e-3, "at a right angle it stands on the line"); near(it.X[3*i+2] - it.X[2], m.xy[2*i] - 220, 1e-3, "towards the face"); }
  delete p.fold; garmentSync();
  for (let i = 0; i < it.X.length; i += 3) near(it.X[i+2], it.X[2], 1e-6, "unfolded: flat again");
});

test("lines lie on the cloth: an internal line, a baseline and a topstitch are held point by point by the triangles under them", () => {
  reset();
  const p = rect("P", 0, 0, 300, 200);
  addChild(p, "internals", mkShape([V(40, 50), V(260, 150)], false)); addChild(p, "bases", mkShape([V(40, 20), V(260, 20), V(260, 60), V(40, 60)], true));
  S.stitches = [{ id: 1, name: "T", part: { piece: p.id, shape: 0, sids: [p.segs[0].id], t0: 0, t1: 1, rev: false }, offset: 5, extS: false, extE: false, corner: "sharp" }];
  garmentSync();
  const it = G3.items.get(p.id), L = clothLineList(p, it), m = it.mesh, at = (a) => [a.i.reduce((s, v, k) => s + a.w[k]*m.xy[2*v], 0), a.i.reduce((s, v, k) => s + a.w[k]*m.xy[2*v+1], 0)];
  assert.deepStrictEqual(L.map(l => [l.kind, l.closed]), [["internals", false], ["bases", true], ["stitch", false]]);
  const il = L[0].an.map(at);
  near(il[0][0], 40, 1e-6); near(il[0][1], 50, 1e-6); near(il[il.length-1][0], 260, 1e-6); near(il[il.length-1][1], 150, 1e-6);
  assert.ok(il.length >= Math.hypot(220, 100)/20, "cut up as finely as the cloth, so it can drape: " + il.length);
  for (const q of il) near((q[1] - 50)/100, (q[0] - 40)/220, 1e-6, "every point on the line");
  for (const q of L[2].an.map(at)) near(q[1], 5, 1e-6, "the topstitch 5 inside the top edge");
  for (const l of L) for (const a of l.an) near(a.w[0] + a.w[1] + a.w[2], 1, 1e-9);
});

test("pins: a pin is a place on the pattern, the nearest cloth point is held, it goes with the pattern, and stays put when the rest falls", () => {
  reset();
  const p = rect("P", 0, 0, 200, 200);
  p.pins = normPins([{ x: 0, y: 0 }, { x: 201, y: 3 }, { x: 100, y: 100 }, { x: "a", y: 1 }, null, { x: 5000, y: 5000 }]);
  assert.strictEqual(p.pins.length, 4);
  garmentSync();
  const it = G3.items.get(p.id), m = it.mesh, vs = piecePins(p, it);
  assert.strictEqual(vs.length, 3, "a pin far off the cloth holds nothing");
  for (const [x, y] of [[0, 0], [200, 0]]) assert.ok(vs.some(v => Math.hypot(m.xy[2*v] - x, m.xy[2*v+1] - y) < 1e-6), "the corner at " + x);
  assert.ok(vs.some(v => Math.hypot(m.xy[2*v] - 100, m.xy[2*v+1] - 100) < 15), "the cloth point nearest the middle");
  mapPiece(p, (q) => V(q.x + 50, q.y - 20));
  assert.deepStrictEqual([p.pins[0].x, p.pins[0].y], [50, -20], "moved with its pattern in the 2D window");
  p.p3 = { pos: [150, 1100, 420], q: [0, 0, 0, 1], r: 0 };      // (Round FIX-3 / A: drawn at the 2D axis it would stand on the floor; hung 1 m up)
  garmentSync(); simBuild();
  const it2 = G3.items.get(p.id), held = piecePins(p, it2), sim = SIM.sim, y0 = held.map(v => sim.x[3*v+1]);
  for (let k = 0; k < 40; k++) C.clothStep(sim, 1/60);
  held.forEach((v, k) => near(sim.x[3*v+1], y0[k], 1e-9, "a pinned point"));
  let lo = Infinity; for (let i = 0; i < sim.n; i++) lo = Math.min(lo, sim.x[3*i+1]);
  assert.ok(lo < Math.min(...y0) - 20, "the rest hangs from the pins");
});

test("a zipper in 3D: a tape on each edge as wide as its type says, joined along the chain; the two edges end two tape widths apart", () => {
  reset();
  const A = rect("A", 0, 0, 200, 300), B = rect("B", 400, 0, 200, 300);
  const zip = add(makeSeam(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true)); zip.zip = { name: "Zipper 1", type: null };
  A.p3 = { pos: [-140, 1000, 0], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [140, 1000, 0], q: [0, 0, 0, 1], r: 0 };      // side by side, 80 between the two edges
  A.pins = [0, 150, 300].map(y => ({ x: 0, y })); B.pins = [0, 150, 300].map(y => ({ x: 600, y }));                  // held by their far edges
  garmentSync();
  const order = S.pieces.map(p => p.id);
  let z = zipList(order)[0];
  assert.strictEqual(z.w, 11, "the default tape is 11 mm a side"); near(z.len, 300, 1e-6); assert.ok(z.n >= 20);
  libOf().zipper.push({ id: 90, name: "Narrow", tapeW: 6, color: "#aa0000" }); zip.zip.type = 90;
  assert.strictEqual(zipList(order)[0].w, 6, "the zipper type's own tape width");
  zip.zip.type = null; libOf().zipper.length = 0;
  zipBuild(order);
  const zo = G3.zips[0], n = zo.z.n, tA = zo.tapes[0], tB = zo.tapes[1];
  assert.strictEqual(view3d.group("zippers").children.length, 4, "two tapes, the chain and the pull");
  near(tA.xy[2*(n + 1) + 1], 11, 1e-9, "the tape is cut 11 wide"); near(tA.xy[2*n], 300, 1e-6);
  // standing still: each tape runs from its edge towards the other edge
  near(tA.X[0], -40, 1e-4, "A's edge"); near(tA.X[3*(n + 1)], -29, 1e-4, "11 towards B"); near(tB.X[0], 40, 1e-4); near(tB.X[3*(n + 1)], 29, 1e-4);
  // the patterns moved to 22 apart and held by their far edges: the zipper closes flat between them, the edges two tapes apart
  A.p3.pos[0] = -111; B.p3.pos[0] = 111; garmentSync(); zipBuild(order);
  S.cloth = normCloth({ self: false }); simBuild();
  SIM.sim.opt.gravity = 0; SIM.sim.opt.ground = false;
  assert.strictEqual(SIM.sim.off.length, 4, "the two patterns and the two tapes");
  assert.ok(SIM.seams.find(s => s.id === zip.id).skip, "the zipper's own edge-to-edge seam is left out");
  for (let k = 0; k < 150; k++) C.clothStep(SIM.sim, 1/60);
  const X = (pc) => C.clothRead(SIM.sim, pc), xa = X(0), xb = X(1), ta = X(2), tb = X(3), mA = G3.items.get(A.id).mesh, mB = G3.items.get(B.id).mesh;
  const edgeA = [...Array(mA.xy.length/2).keys()].filter(i => mA.xy[2*i] > 200 - 1e-6), edgeB = [...Array(mB.xy.length/2).keys()].filter(i => mB.xy[2*i] < 400 + 1e-6);
  const mean = (Xp, vs) => vs.reduce((s, v) => s + Xp[3*v], 0)/vs.length;
  near(mean(xb, edgeB) - mean(xa, edgeA), 22, 2.5, "the edges are held 22 mm apart by the tapes");
  let chain = 0; for (let k = 0; k <= n; k++) chain = Math.max(chain, Math.hypot(ta[3*(n+1+k)] - tb[3*(n+1+k)], ta[3*(n+1+k)+1] - tb[3*(n+1+k)+1], ta[3*(n+1+k)+2] - tb[3*(n+1+k)+2]));
  assert.ok(chain < 1.5, "the chain is shut all the way along: " + chain);
  // with the pattern hidden there is no zipper to build
  B.on = false; garmentSync(); assert.strictEqual(zipList(S.pieces.filter(p => p.on).map(p => p.id)).length, 0);
});

test("a ray finds the body, and a girth is the body's outline in a plane: a tape pulled tight, and the length following the skin", () => {
  const f = C.buildSDF(ball(150, [0, 1000, 0]), { cell: 10 });
  near(C.rayField(f, [0, 1000, 2000], [0, 0, -1]), 1850, 1.2, "from in front to the ball"); near(C.rayField(f, [0, 3000, 0], [0, -1, 0]), 1850, 1.2);
  assert.strictEqual(C.rayField(f, [400, 1000, 2000], [0, 0, -1]), -1, "past it"); assert.strictEqual(C.rayField(f, [0, 1000, 2000], [0, 0, 1]), -1, "away from it");
  const g = C.girth(f, [0, 1000, 150], [0, 1, 0], 120);
  near(g.tape, 2*Math.PI*150, 2*Math.PI*150*0.012, "round the middle"); near(g.surface, g.tape, 2, "a ball has no hollows"); assert.strictEqual(g.pts.length, 120);
  near(g.centre[0], 0, 2); near(g.centre[2], 0, 2);
  const up = C.girth(f, [0, 1090, 120], [0, 1, 0], 120);
  near(up.tape, 2*Math.PI*120, 2*Math.PI*120*0.02, "90 above the middle the ball is 120 wide"); for (const q of up.pts) near(q[1], 1090, 1e-6, "in the plane");
  assert.strictEqual(C.girth(f, [0, 1000, 600], [0, 1, 0]), null, "not at the body");
  // a tape does not follow a hollow: a plus sign's hull is its outer corners
  near(C.hullLength([[0, 3], [1, 1], [3, 0], [1, -1], [0, -3], [-1, -1], [-3, 0], [-1, 1]]), 4*Math.hypot(3, 3), 1e-9);
  near(C.hullLength([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]), 40, 1e-9); assert.strictEqual(C.hullLength([[1, 1]]), 0);
});

test("measuring the avatar: a click is where the ray meets the collision body; a girth goes round the body part clicked, square to its bone", () => {
  reset();
  const av = avatarSetup(rig().root, "t.fbx"); av.pose = posePreset(av, 90, 0); poseApply(av); S.av = av; av.box = avatarBox(av);
  const ray = (o, d) => ({ o: new THREE.Vector3(...o), d: new THREE.Vector3(...d).normalize() });
  const P = avatarHit(ray([0, 1270, 3000], [0, 0, -1]));
  near(P.z, 95, 4, "the front of the chest box"); near(P.y, 1270, 1e-6);
  assert.strictEqual(avatarHit(ray([0, 3000, 3000], [0, 0, -1])), null);
  assert.strictEqual(partAxis(av, P).name, "Body");
  // (Round r18 / 5: addGirth() now makes a measurement of the document, held by the skin, through the history; the girth it measures
  // is girthAt3()'s, tested here as addGirth() was)
  S.avMeas = [girthAt3(P)];
  near(S.avMeas[0].tape, 2*(320 + 190), 2*(320 + 190)*0.04, "round the chest box, 320 by 190"); assert.strictEqual(S.avMeas[0].name, "Body");
  for (const q of S.avMeas[0].pts) near(q[1], 1270, 1e-6);
  // the forearm (a T pose: it runs along x): the plane is square to the arm, not level
  const F = avatarHit(ray([585, 1340, 2000], [0, 0, -1])), part = partAxis(av, F);
  assert.strictEqual(part.name, "Left forearm"); near(Math.abs(part.axis.x), 1, 1e-6);
  S.avMeas.push(girthAt3(F)); showMeasures();
  near(S.avMeas[1].tape, 4*72, 4*72*0.09, "a 72 by 72 forearm (a box this small has its corners rounded by a 12 mm field)"); for (const q of S.avMeas[1].pts) near(q[0], 585, 1e-6, "in the plane across the arm");
  assert.strictEqual(view3d.group("measure").children.length, 4, "an outline and a label each");
});

test("folds and pins in the booted app: saved with the pattern file, cleaned when read, undone, and the tools are where the registry says", () => {
  const r = boot({ script: `
    const out = {};
    const p = S.pieces[0];
    const j = app.addChild ? 0 : 0;
    app.push("Fold"); p.fold = [{ kind: "internals", id: p.internals[0] ? p.internals[0].id : 1, angle: 170 }]; p.pins = [{ x: 10, y: 20 }]; app.commit();
    const doc = JSON.parse(app.docJSON()); out.saved = JSON.parse(JSON.stringify([doc.pieces[0].fold, doc.pieces[0].pins]));
    doc.pieces[0].fold.push({ kind: "bases", id: "x", angle: 5 }, { kind: "internals", id: 3, angle: 999 }); doc.pieces[0].pins.push({ x: null, y: 2 }, "junk");
    app.loadDoc(doc); out.loaded = [S.pieces[0].fold, S.pieces[0].pins];
    out.pf = app.pieceFolds(S.pieces[0], [100, 250]).length;
    S.sel = [S.pieces[0].id]; app.removePins(true); out.noPins = S.pieces[0].pins || null; app.undo(); out.back = S.pieces[0].pins;
    app.unfoldPieces(false); out.unfolded = S.pieces[0].fold || null;
    out.tools = ["fold_arrangement", "pin_box", "tape_basic", "circ_basic"].map(id => [!!app.TOOL3[id], !!app.HINT[id], app.TOOLS[id].off]);
    app.key("w"); out.w = S.tool3;
    app.setTool3("tape_basic"); out.tape = S.tool3; app.TOOL3.tape_basic.down({ clientX: 5, clientY: 5 }); out.noAvatar = toasts[toasts.length-1];
    return out;
  ` });
  assert.deepStrictEqual(r.errors, [], "no errors");
  const o = r.result;
  assert.strictEqual(o.saved[0][0].angle, 170); assert.deepStrictEqual(o.saved[1], [{ x: 10, y: 20 }]);
  assert.deepStrictEqual(o.loaded[0].map(f => [f.kind, f.angle]), [["internals", 170], ["internals", 180]], "a fold with no line id is dropped, an angle is limited");
  assert.deepStrictEqual(o.loaded[1], [{ x: 10, y: 20 }]);
  assert.strictEqual(o.noPins, null); assert.deepStrictEqual(o.back, [{ x: 10, y: 20 }]); assert.strictEqual(o.unfolded, null);
  assert.deepStrictEqual(o.tools, [[true, true, false], [true, true, false], [true, true, false], [true, true, false]]);
  assert.strictEqual(o.w, "pin_box", "W is the pin key"); assert.strictEqual(o.tape, "tape_basic"); assert.ok(/needs an avatar/.test(o.noAvatar));
});

module.exports = T;
