// Roadmap 3D, batch 1: the avatar. The collision field (distance, sign, gradient, its
// closed surface), bone names of three kinds of rig, units and height, the pose (sliders,
// the worked-out presets, pose files), the skin following the bones, and the menu and
// settings in the booted app. The preset avatar (Marty) is used as well when its file is there.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");
const { three, rig, RIG_NAMES } = require("./three-env");
const C = require("../drafter-sim.js");

const { THREE, THREE_LOADERS } = three();
const S = { av: null, avSet: null, poses: [], ui: { layout: "both" } };
const view3d = { group: () => null, ask() {}, view() {}, cam: {}, home: {} };
const G = load(["boneRole", "normAvatar", "normPoses", "avatarSetup", "avatarScale", "avatarBox", "avatarTris", "avatarVerts", "poseApply", "posePreset", "limbAngle", "poseFromRoot", "avatarField", "avatarParse", "arrPoints", "POSE_BONES", "CAM_VIEWS"],
  { S, THREE, THREE_LOADERS, SIM3D: C, view3d });
const { boneRole, normAvatar, normPoses, avatarSetup, avatarScale, avatarBox, avatarTris, poseApply, posePreset, limbAngle, poseFromRoot, avatarField, avatarParse, arrPoints, POSE_BONES } = G;
S.avSet = normAvatar(null);

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
// a ball of triangles: an octahedron split n times and pushed out to radius r, round centre c
function ball(r, n, c) {
  c = c || [0, 0, 0];
  let tris = [[[1,0,0],[0,1,0],[0,0,1]], [[0,1,0],[-1,0,0],[0,0,1]], [[-1,0,0],[0,-1,0],[0,0,1]], [[0,-1,0],[1,0,0],[0,0,1]], [[0,1,0],[1,0,0],[0,0,-1]], [[-1,0,0],[0,1,0],[0,0,-1]], [[0,-1,0],[-1,0,0],[0,0,-1]], [[1,0,0],[0,-1,0],[0,0,-1]]];
  const mid = (a, b) => { const m = [a[0]+b[0], a[1]+b[1], a[2]+b[2]], l = Math.hypot(...m); return m.map(v => v/l); };
  for (let k = 0; k < n; k++) tris = tris.flatMap(([a, b, d]) => { const ab = mid(a, b), bd = mid(b, d), da = mid(d, a); return [[a, ab, da], [ab, b, bd], [da, bd, d], [ab, bd, da]]; });
  return new Float32Array(tris.flatMap(t => t.flatMap(p => [p[0]*r + c[0], p[1]*r + c[1], p[2]*r + c[2]])));
}
const pos = (b) => b.getWorldPosition(new THREE.Vector3());

test("collision field of a ball: the distance is right near the skin, negative inside, and the gradient points outward", () => {
  const f = C.buildSDF(ball(100, 4, [20, 300, -40]), { cell: 10 }), g = [0, 0, 0];
  assert.ok(f && f.nx > 20);
  for (const [x, y, z] of [[1, 0, 0], [0, 1, 0], [0, 0, -1], [0.6, 0.64, 0.48], [-0.36, 0.8, -0.48]]) for (const rr of [70, 90, 100, 108, 125]) {
    const d = C.sdfSample(f, 20 + x*rr, 300 + y*rr, -40 + z*rr, g);
    near(d, rr - 100, 1.6, "at radius " + rr);
    if (Math.abs(rr - 100) > 3) near(g[0]*x + g[1]*y + g[2]*z, 1, 0.06, "the gradient is radial at radius " + rr);
  }
  assert.ok(C.sdfAt(f, 20, 300, -40) < -60, "deep inside is well negative");
  assert.ok(C.sdfAt(f, 20, 300, 400) > 300 && C.sdfAt(f, 5000, 300, -40) > 4000, "far outside (also outside the box) is far");
  near(C.closestOnTri(0, 0, 5, -10, -10, 0, 10, -10, 0, 0, 10, 0, g), 25, 1e-9, "a point over a triangle's face");
  near(C.closestOnTri(30, -10, 0, -10, -10, 0, 10, -10, 0, 0, 10, 0, g), 400, 1e-9, "… and beyond one of its corners");
});

test("the collision mesh is closed, faces outward and has the body's volume; a coarser cell gives fewer triangles", () => {
  const tris = ball(100, 4), f = C.buildSDF(tris, { cell: 8 }), net = C.surfaceNets(f, 0), mv = C.meshVolume(net.pos, net.idx);
  assert.strictEqual(C.meshClosed(net.idx), true);
  near(mv.volume, 4/3*Math.PI*1e6, 0.03*4/3*Math.PI*1e6, "volume");
  near(mv.area, 4*Math.PI*1e4, 0.04*4*Math.PI*1e4, "area");
  const coarse = C.surfaceNets(C.buildSDF(tris, { cell: 20 }), 0);
  assert.ok(coarse.idx.length < net.idx.length/3 && C.meshClosed(coarse.idx));
  // two balls that touch are still one closed body; a mesh with a hole in it is not closed
  const two = new Float32Array([...ball(60, 3, [0, 0, 0]), ...ball(60, 3, [100, 0, 0])]);
  const n2 = C.surfaceNets(C.buildSDF(two, { cell: 8 }), 0);
  assert.strictEqual(C.meshClosed(n2.idx), true);
  assert.strictEqual(C.meshClosed(net.idx.slice(3)), false);
  // the box of samples never grows past the limit: the cell does
  const lim = C.buildSDF(tris, { cell: 2, maxNodes: 50000 });
  assert.ok(lim.nx*lim.ny*lim.nz <= 50000 && lim.cell > 2);
  assert.strictEqual(C.buildSDF(new Float32Array(0)), null);
});

test("bone names: L_UpperArm style, Mixamo's and Blender's main bones are known, in-between and finger bones are not", () => {
  const want = { L_UpperArm: "armL", R_LowerArm: "forearmR", L_UpperLeg: "thighL", R_LowerLeg: "shinR", L_Foot: "footL", L_Clavicle: "shoulderL", L_Hand: "handL", Neck: "neck", Head: "head", Pelvis: "pelvis", Spine: "spine", Spine2: "spine",
    "mixamorig:LeftArm": "armL", "mixamorig:RightForeArm": "forearmR", "mixamorig:LeftUpLeg": "thighL", "mixamorig:RightLeg": "shinR", mixamorigLeftFoot: "footL", "mixamorig:Hips": "pelvis", "mixamorig:Spine1": "spine",
    "upper_arm.L": "armL", "forearm.R": "forearmR", "thigh.L": "thighL", "shin.R": "shinR", "foot.L": "footL", "hand.R": "handR", "shoulder.L": "shoulderL", chest: "chest" };
  for (const k of Object.keys(want)) assert.strictEqual(boneRole(k), want[k], k);
  for (const k of ["L_UpperArm_Twist", "L_LowerArm_Twist", "L_UpperLeg1", "Neck1", "L_Index1", "Head_End", "jaw", "Left_eye", "L_Toe", "Joint", "L_Breast", "Arm", "leg"]) assert.strictEqual(boneRole(k), null, k);
});

test("an avatar is set up from a file's scene: main bones, height, the outermost of nested bones, and files in metres or centimetres", () => {
  const av = avatarSetup(rig().root, "t.fbx");
  assert.strictEqual(Object.keys(av.roles).length, 19, "every main bone and the pelvis");
  assert.deepStrictEqual(POSE_BONES.filter(([r]) => !av.roles[r]), []);
  assert.strictEqual(av.unit, 1); near(av.height, 1700, 1e-3, "height");
  near(avatarBox(av).x1 - avatarBox(av).x0, 1740, 1e-3, "arm span");
  const m = avatarSetup(rig({ scale: 0.001 }).root, "m.glb"), cm = avatarSetup(rig({ scale: 0.1 }).root, "cm.fbx");
  assert.strictEqual(m.unit, 1000); near(m.height, 1700, 1e-2); assert.strictEqual(cm.unit, 10); near(cm.height, 1700, 1e-2);
  const nested = rig({ nest: true }), an = avatarSetup(nested.root, "n.fbx");
  assert.strictEqual(an.roles.armL, nested.bones.armL, "the outer bone of the name, not the copy inside it");
  assert.strictEqual(an.bones.size, 19);
  // names this program does not know: it loads, with no main bones
  const odd = avatarSetup(rig({ names: Object.fromEntries(Object.keys(RIG_NAMES).map((k, i) => [k, "b" + i])) }).root, "odd.fbx");
  assert.strictEqual(Object.keys(odd.roles).length, 0); near(odd.height, 1700, 1e-3);
  assert.strictEqual(avatarSetup(new THREE.Group(), "empty").meshes.length, 0);
});

test("pose: a slider turns its bone about the avatar's own axes, the skin follows, children ride along, and zero puts it all back", () => {
  for (const names of [RIG_NAMES, null]) for (const nest of [false, true]) {
    const r = rig({ nest, names: names || Object.fromEntries(Object.keys(RIG_NAMES).map(k => [k, /L$|R$/.test(k) ? "mixamorig:" + (k.endsWith("L") ? "Left" : "Right") + { shoulder: "Shoulder", arm: "Arm", forearm: "ForeArm", hand: "Hand", thigh: "UpLeg", shin: "Leg", foot: "Foot" }[k.slice(0, -1)] : "mixamorig:" + { pelvis: "Hips", spine: "Spine", chest: "Spine2", neck: "Neck", head: "Head" }[k]])) });
    const av = avatarSetup(r.root, "t.fbx"), b0 = avatarBox(av), hand0 = pos(av.roles.handL), handR0 = pos(av.roles.handR);
    av.pose = { armL: [0, 0, -90] }; poseApply(av);                         // about the front-back axis: the left arm swings down
    const hand = pos(av.roles.handL), sh = pos(av.roles.armL);
    near(hand.x, sh.x, 1e-6, "the hand hangs under the shoulder"); near(hand.y, sh.y - 530, 1e-6); near(hand.z, 0, 1e-6);
    assert.ok(pos(av.roles.handR).distanceTo(handR0) < 1e-9, "the right arm did not move");
    const b1 = avatarBox(av);
    near(b1.x1, 180 + 42, 1e-3, "the skin went with the arm"); near(b1.x0, b0.x0, 1e-6);
    av.pose = { armL: [0, 0, -90], forearmL: [0, 90, 0] }; poseApply(av);   // the forearm's own turn is still about the avatar's upright axis
    const h2 = pos(av.roles.handL), el = pos(av.roles.forearmL);
    near(el.y, sh.y - 280, 1e-6); near(h2.y, el.y, 1e-6, "elbow bent level"); near(Math.abs(h2.z - el.z) + Math.abs(h2.x - el.x), 250, 1e-6);
    av.pose = {}; poseApply(av);
    assert.ok(pos(av.roles.handL).distanceTo(hand0) < 1e-9); near(avatarBox(av).x1, b0.x1, 1e-6);
  }
});

test("pose presets are worked out from where the bones point: A is 45° from straight down, T level, arms down 12°, both arms straight", () => {
  const av = avatarSetup(rig({ nest: true }).root, "t.fbx");
  near(limbAngle(av, "armL", "forearmL"), 90, 1e-6, "the rig comes as a T");
  for (const [arm, leg] of [[45, 8], [90, 8], [12, 4]]) {
    av.pose = posePreset(av, arm, leg); poseApply(av);
    for (const s of ["L", "R"]) {
      near(limbAngle(av, "arm" + s, "forearm" + s), arm, 0.06, "upper arm " + s); near(limbAngle(av, "forearm" + s, "hand" + s), arm, 0.12, "forearm " + s);
      near(limbAngle(av, "thigh" + s, "shin" + s), leg, 0.06, "thigh " + s); near(limbAngle(av, "shin" + s, "foot" + s), leg, 0.12, "shin " + s);
    }
    assert.ok(pos(av.roles.handL).x > 0 && pos(av.roles.handR).x < 0 && Math.abs(pos(av.roles.handL).z) < 2, "arms out to their own sides, in the body's plane");
    near(pos(av.roles.handL).x, -pos(av.roles.handR).x, 1e-6, "the same both sides");
    assert.ok(pos(av.roles.footL).x > pos(av.roles.thighL).x + 20 && pos(av.roles.footR).x < pos(av.roles.thighR).x - 20, "each leg out to its own side");
  }
  // from another starting pose the result is the same place
  const a2 = avatarSetup(rig().root, "t.fbx");
  a2.rest.get(a2.roles.armL).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.2, -0.9)));
  a2.pose = posePreset(a2, 45, 8); poseApply(a2);
  near(limbAngle(a2, "armL", "forearmL"), 45, 0.06); near(limbAngle(a2, "forearmL", "handL"), 45, 0.12);
  // a rig with no arm bones gets no arm angles
  const odd = avatarSetup(rig({ names: { ...RIG_NAMES, armL: "x1", armR: "x2" } }).root, "odd.fbx"), pp = posePreset(odd, 45, 8);
  assert.ok(!pp.armL && !pp.armR && pp.thighL);
});

test("a pose file's bone rotations become the base pose by bone name; an animation's first key wins; sliders go on top", () => {
  const src = rig(), bent = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.1, -1.1));
  src.bones.armL.quaternion.copy(bent); src.bones.thighR.quaternion.setFromEuler(new THREE.Euler(-0.5, 0, 0.1)); src.root.updateMatrixWorld(true);
  const want = pos(src.bones.handL), q = poseFromRoot(src.root);
  assert.strictEqual(Object.keys(q).length, 19);
  const av = avatarSetup(rig({ nest: true }).root, "t.fbx");
  av.baseQ = q; poseApply(av);
  assert.ok(pos(av.roles.handL).distanceTo(want) < 1e-4, "the same pose on another copy of the rig");
  assert.ok(pos(av.roles.footR).distanceTo(pos(src.bones.footR)) < 1e-4);
  av.pose = { head: [20, 0, 0] }; poseApply(av);
  assert.ok(pos(av.roles.handL).distanceTo(want) < 1e-4, "a slider elsewhere leaves it");
  av.baseQ = null; av.pose = {}; poseApply(av);
  near(limbAngle(av, "armL", "forearmL"), 90, 1e-6, "and without the file the rig's own pose is back");
  // an animation in the file
  const anim = rig(), key = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.7));
  anim.root.animations = [{ tracks: [{ name: RIG_NAMES.armL + ".quaternion", values: new Float32Array([...key.toArray(), 0, 0, 0, 1]) }, { name: "nobody.quaternion", values: new Float32Array(4) }] }];
  const qa = poseFromRoot(anim.root);
  near(qa[RIG_NAMES.armL][2], key.z, 1e-6); assert.ok(!("nobody" in qa));
  assert.deepStrictEqual(normPoses([{ name: "a", q: qa }, { name: "a", q: qa }, { name: "", q: qa }, { name: "b", q: { x: [1, 2] } }, null]).map(p => p.name), ["a"]);
});

test("the collision body follows the pose and the height: skin triangles, a field that is rebuilt, a closed mesh", () => {
  const av = avatarSetup(rig().root, "t.fbx");
  S.avSet = normAvatar({ cell: 20 });
  const tris = avatarTris(av);
  assert.strictEqual(tris.length, 19*12*9);
  const f = avatarField(av);
  assert.strictEqual(avatarField(av), f, "kept while nothing changes");
  assert.ok(C.sdfAt(f, 0, 1270, 0) < -40, "inside the chest"); assert.ok(C.sdfAt(f, 500, 1340, 0) < 0, "inside the left arm"); assert.ok(C.sdfAt(f, 500, 1100, 0) > 100, "under it is air");
  av.pose = { armL: [0, 0, -90] }; poseApply(av);
  const f2 = avatarField(av);
  assert.notStrictEqual(f2, f); assert.ok(C.sdfAt(f2, 500, 1340, 0) > 100, "the arm has gone from there"); assert.ok(C.sdfAt(f2, 180, 1000, 0) < 0, "and hangs here");
  const net = C.surfaceNets(f2, 0);
  assert.strictEqual(C.meshClosed(net.idx), true); assert.ok(C.meshVolume(net.pos, net.idx).volume > 0);
  // scaled to a height: the skin scales about the floor
  av.scale = 0.5; avatarScale(av); av.pose = {}; poseApply(av);
  near(avatarBox(av).h, 850, 1e-3);
});

test("a loaded avatar stands on the floor: its lowest point is at y = 0 wherever the file has its origin, in any unit, and stays there when it is scaled", () => {
  for (const [dy, unit] of [[-27, 1], [340, 1], [-0.027, 0.001], [12, 0.1], [0, 1]]) {
    const r = rig(), g = new THREE.Group();
    // the file's own origin is somewhere else, and the file is in another unit
    r.root.position.y += dy/unit; g.add(r.root); g.scale.setScalar(unit); g.position.y = 3*unit;
    const av = avatarSetup(g, "t.glb"), b = avatarBox(av);
    near(b.y0, 0, 1e-3, "lowest point, origin moved by " + dy + " in unit " + unit); near(b.h, 1700, 0.5, "its height is not changed by that");
    for (const k of [0.5, 1.2]) { av.scale = k; avatarScale(av); const c = avatarBox(av); near(c.y0, 0, 1e-3, "scaled by " + k); near(c.h, 1700*k, 0.5); }
    // a pose does not move it: a lifted arm leaves the soles where they are
    av.scale = 1; avatarScale(av); av.pose = { armL: [0, 0, -90] }; poseApply(av); near(avatarBox(av).y0, 0, 1e-3, "posed");
  }
});

test("avatar settings are cleaned when read: junk falls back, angles are limited, a path is only ever text", () => {
  const d = normAvatar(null);
  assert.deepStrictEqual(d, { path: null, name: "", height: null, display: "textured", showCol: false, cell: 10, pose: {}, base: null, panel: false });
  const n = normAvatar({ path: 5, name: "a.fbx", height: 99999, display: "x-ray", showCol: 1, cell: 0.1, pose: { armL: [0, 0, 400], bogus: [1, 2, 3], head: [0, 0, 0], neck: "x", shinR: [1, NaN, 2] }, base: 3 });
  assert.deepStrictEqual(n, { path: null, name: "a.fbx", height: null, display: "textured", showCol: false, cell: 10, pose: { armL: [0, 0, 180] }, base: null, panel: false });
  assert.deepStrictEqual(normAvatar({ height: 1750, display: "grey", cell: 8, showCol: true, base: "walk", panel: true, path: "C:/a.fbx" }),
    { path: "C:/a.fbx", name: "", height: 1750, display: "grey", showCol: true, cell: 8, pose: {}, base: "walk", panel: true });
});

test("a file is read by what it is: a binary FBX through the FBX reader, glTF by its first bytes, junk is an error and not a crash", () => {
  let got = null;
  avatarParse(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer, "junk.fbx", (err, root) => { got = [!!err, !!root]; });
  assert.deepStrictEqual(got, [true, false]);
  const seen = [];
  const fake = load(["avatarParse"], { THREE, THREE_LOADERS: { GLTFLoader: class { parse(buf, p, ok) { seen.push("gltf"); ok({ scene: new THREE.Group(), animations: [1] }); } }, FBXLoader: class { parse() { seen.push("fbx"); return new THREE.Group(); } } } }).avatarParse;
  const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]).buffer;
  fake(glb, "scan.bin", (e, r) => seen.push(r.animations.length)); fake(glb.slice(4), "a.glb", () => {}); fake(glb.slice(4), "a.fbx", () => {});
  assert.deepStrictEqual(seen, ["gltf", 1, "gltf", "fbx"]);
});

/* ---- no avatar at start ----
   A session starts with an empty 3D scene, and so does a new document: nothing is loaded by itself and nothing is
   remembered from the last session. An avatar comes from the user (the cards, a file of one's own) or with a
   document that names one. */
const hasPreset = (id) => fs.existsSync(path.join(__dirname, "..", "assets", "avatar", "presets", id + ".glb"));
function bootFile(opt, ms) {
  const os = require("os"), f = path.join(os.tmpdir(), "pdraft-boot-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt));
  try {
    const r = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 60000, maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
// the desktop shell's avatar bridge, as far as the page uses it: the two presets, read from the real files; every call is kept
const BRIDGE = `
  const calls = [], later = (v) => new Promise((res) => setImmediate(() => res(v)));
  const presetPath = (n) => "C:\\\\app\\\\drafter\\\\assets\\\\avatar\\\\presets\\\\" + n + ".glb";
  app.ev("DESK").avatar = {
    presets: () => { calls.push("presets"); return later({ male: { name: "marty.glb", path: presetPath("marty") }, female: { name: "jessica.glb", path: presetPath("jessica") } }); },
    read: (p) => { calls.push("read " + String(p).replace(/^.*[/\\\\]/, "")); const n = /jessica/.test(p) ? "jessica" : "marty"; return later({ path: p, name: n + ".glb", data: new Uint8Array(app.read("../assets/avatar/presets/" + n + ".glb")) }); },
    pick: () => later(null) };
  const scene = () => [S.av ? S.av.name : null, app.view3d.group("avatar").children.length, app.el("s-av").textContent];
`;
test("the program starts with no avatar, in a browser and in the desktop app, whatever avatar the last session had; simulating with none does not fail: the cloth falls to the floor", () => {
  const last = { "pdraft:avatar": JSON.stringify({ name: "Marty", path: "C:\\app\\drafter\\assets\\avatar\\presets\\marty.glb", height: 1800, cell: 20 }) };
  const script = (desk) => `
    return (async () => {
      const out = {}; let fetched = 0; ${desk ? BRIDGE : "const calls = [], scene = () => [S.av ? S.av.name : null, app.view3d.group('avatar').children.length, app.el('s-av').textContent];"}
      app.ev("setLayout")("both");
      out.up = app.view3d.ready();
      for (let i = 0; i < 20; i++) await new Promise((res) => setImmediate(res));          // (time for anything that would load one)
      out.start = scene(); out.calls = calls.slice(); out.note = app.el("note3d").textContent;
      out.kept = [S.avSet.name, S.avSet.height];                                             // how an avatar of that name stood last is still known, for when it is loaded again
      out.menu = app.MENUS.avatar().filter(x => x.n || x.hd).slice(0, 2).map(x => x.n || x.hd);
      // simulating with no avatar: the cloth falls and lies on the floor
      const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
      app.push("Rectangle"); S.pieces.push(sq("Cloth", 0, -1200, 200, 200));      /* (Round FIX-3 / A: drawn 1 m above the 2D axis, the floor, so that it stands that high) */ S.cloth = app.normCloth({ ...S.cloth, worker: false }); app.commit();
      const it = () => app.G3.items.get(S.pieces[0].id), low = () => { let y = Infinity; for (let i = 1; i < it().X.length; i += 3) y = Math.min(y, it().X[i]); return y; };
      const y0 = low();
      app.ev("simStart")(); out.said = toasts[toasts.length-1];
      for (let i = 0; i < 150; i++) app.ev("simFrame")();
      const lowNow = low(); let high = -Infinity, bad = 0; for (let i = 0; i < it().X.length; i++) { if (!Number.isFinite(it().X[i])) bad++; if (i % 3 === 1) high = Math.max(high, it().X[i]); }
      app.ev("simStop")();
      out.fell = [y0 > 800, lowNow < 10 && lowNow >= 0, high < 250, bad, !!S.av];
      return out;
    })();`;
  for (const desk of [false, true]) {
    const r = bootFile({ blank: true, three: true, desktop: desk ? { local: last } : false, storage: desk ? {} : last, script: script(desk) });
    assert.deepStrictEqual(r.errors, [], desk ? "desktop" : "browser");
    const o = r.result;
    assert.strictEqual(o.up, true);
    assert.deepStrictEqual(o.start, [null, 0, "NO AVATAR"], (desk ? "the desktop app" : "a browser") + ": the 3D scene is empty");
    assert.deepStrictEqual(o.calls, [], "nothing was asked of the shell: no preset looked for, no file read");
    assert.ok(/^No avatar \(Avatar → Load Avatar…\)/.test(o.note), o.note);
    assert.deepStrictEqual(o.kept, ["Marty", 1800]);
    assert.deepStrictEqual(o.menu, ["Load Avatar\u2026", "No avatar is loaded"]);
    assert.ok(/^Simulating without an avatar: the cloth falls to the floor/.test(o.said), o.said);
    assert.deepStrictEqual(o.fell, [true, true, true, 0, false], "it fell from where it stood and lies on the floor; no avatar appeared");
  }
});

test("File > New starts with no avatar; a file that names an avatar brings it for that document; a file with no avatar record (version 11 and older) leaves the scene's avatar as it is" + (hasPreset("marty") && hasPreset("jessica") ? "" : " (the preset files are not here: skipped)"), () => {
  if (!hasPreset("marty") || !hasPreset("jessica")) return;
  const r = bootFile({ blank: true, three: true, desktop: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 20 }) }, script: `
    return (async () => {
      const out = {}; ${BRIDGE}
      app.ev("setLayout")("both");
      // the user adds one: the Female card
      S.avPresets = { male: { name: "marty.glb", path: presetPath("marty") }, female: { name: "jessica.glb", path: presetPath("jessica") } }; app.ev("avatarPresetPick")("female");
      await app.wait(() => S.av, "Jessica"); out.picked = scene();
      const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
      app.push("Rectangle"); S.pieces.push(sq("Front", 0, 0, 300, 300)); app.commit();
      let file = null; app.desk.dialog = "C:\\\\patterns\\\\on-jessica.pdraft"; app.saveDoc(false); file = app.desk.files.get(app.desk.dialog);
      out.rec = app.fileDoc(file).scene.avatar.preset;
      // File > New: an empty scene again
      app.ev("newDoc")(true); out.fresh = [scene(), S.pieces.length, toasts[toasts.length-1]];
      // … and New from Starter Pattern too
      calls.length = 0;
      // the file is opened: its avatar comes with it
      app.ev("openFile")("on-jessica.pdraft", file, null, true); await app.wait(() => S.av, "the file's avatar");
      out.opened = [scene(), calls.slice(), toasts.filter(t => /different version|could not be loaded/.test(t)).length];
      // another file's avatar takes its place: a document left on Marty
      const onMarty = app.fileDoc(file); onMarty.scene.avatar = { preset: "marty", name: "Marty", hash: app.ev("fileHash")(new Uint8Array(app.read("../assets/avatar/presets/marty.glb"))), height: 1875.5, pose: {} };
      app.ev("openLoaded")("on-marty.pdraft", onMarty, null, true); await app.wait(() => S.av && S.av.name === "Marty", "Marty");
      out.other = [scene(), app.view3d.group("avatar").children.length];
      // a file with no avatar record: the avatar in the scene stays as it is (here Marty, from the document before)
      const none = app.fileDoc(file); delete none.scene.avatar; app.ev("openLoaded")("none.pdraft", none, null, true);
      out.none = scene(); out.noneSaid = toasts[toasts.length-1];
      // a real file of version 11, with Jessica in the scene, scaled: she stays, as tall as she stood
      app.ev("avatarPresetPick")("female"); await app.wait(() => S.av && S.av.name === "Jessica", "Jessica");
      app.ev("setAvatar")({ height: 1700 }); const before = [S.av, Math.round(S.av.height), app.storage.get("pdraft:avatar")];
      calls.length = 0;
      app.ev("openFile")("starter-history.pdraft", new Uint8Array(app.read("files/v11/starter-history.pdraft")), null, true);
      out.v11 = [scene().slice(0, 2), S.av === before[0], Math.round(S.av.height), app.storage.get("pdraft:avatar") === before[2], calls.slice(), toasts[toasts.length-1], S.pieces.map(p => p.name)];
      app.ev("setAvatar")({ height: null });
      // … and with nothing in the scene, nothing comes
      app.ev("newDoc")(true); app.ev("openFile")("starter-history.pdraft", new Uint8Array(app.read("files/v11/starter-history.pdraft")), null, true);
      out.v11empty = [scene(), calls.slice()];
      // a file left on an avatar that is not to be had here (somebody's own): an empty scene, and it says so
      app.ev("avatarPresetPick")("female"); await app.wait(() => S.av, "Jessica again");
      const theirs = app.fileDoc(file); theirs.scene.avatar = { name: "their-scan.fbx", hash: "abc-0123456789abcdef", height: 1700, pose: {} };
      app.ev("openLoaded")("theirs.pdraft", theirs, null, true);
      out.theirs = [scene(), toasts[toasts.length-1]];
      // the starter pattern is a new document as well
      app.ev("avatarPresetPick")("female"); await app.wait(() => S.av, "Jessica once more");
      app.ev("starterDoc")(true); out.starter = scene();
      out.stored = Object.keys(JSON.parse(app.storage.get("pdraft:avatar") || "{}")).sort().join();
      return out;
    })();` }, 120000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.picked.slice(0, 2), ["Jessica", 1]); assert.strictEqual(o.rec, "jessica");
  assert.deepStrictEqual(o.fresh, [[null, 0, "NO AVATAR"], 0, "New document"], "File > New: no avatar");
  assert.deepStrictEqual(o.opened[0].slice(0, 2), ["Jessica", 1], "the file's own avatar is loaded for it"); assert.deepStrictEqual(o.opened[1], ["presets", "read jessica.glb"]); assert.strictEqual(o.opened[2], 0);
  assert.deepStrictEqual(o.other, [["Marty", 1, "AVATAR 1875 MM"], 1], "one avatar in the scene: the document's");
  assert.deepStrictEqual(o.none, ["Marty", 1, "AVATAR 1875 MM"], "no record, no change: the avatar that was there stays"); assert.strictEqual(o.noneSaid, "Opened none.pdraft with 1 history step", "and nothing is said about an avatar");
  assert.deepStrictEqual(o.v11.slice(0, 5), [["Jessica", 1], true, 1700, true, []], "a version 11 file: the same avatar, not loaded again, as tall as it stood, nothing saved, nothing asked of the shell");
  assert.strictEqual(o.v11[5], "Opened starter-history.pdraft with 5 history steps"); assert.deepStrictEqual(o.v11[6], ["Front A", "Front A ⇄"]);
  assert.deepStrictEqual(o.v11empty, [[null, 0, "NO AVATAR"], []], "an empty scene stays empty");
  assert.deepStrictEqual(o.theirs[0], [null, 0, "NO AVATAR"]); assert.ok(/^This document was left on their-scan\.fbx, which could not be loaded here/.test(o.theirs[1]), o.theirs[1]);
  assert.deepStrictEqual(o.starter, [null, 0, "NO AVATAR"]);
});

test("the skirt block's dialog is filled from the loaded avatar's measurements (waist, hip, hip height, length to the knee) and can be typed over; with no avatar it has the block's own, which are Marty's" + (hasPreset("jessica") ? "" : " (jessica.glb is not here: skipped)"), () => {
  if (!hasPreset("jessica") || !hasPreset("marty")) return;
  const r = bootFile({ blank: true, three: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 12 }) }, script: `
    return (async () => {
      const out = {}, seen = []; let reply = null;
      app.answer = (title, fields, opts) => { seen.push({ title, f: Object.fromEntries(fields.map(x => [x.k, x.val])), labels: fields.map(x => x.label), hint: opts.hint }); return reply ? { ...Object.fromEntries(fields.map(x => [x.k, x.val])), level: opts.selects[0].val, ...reply } : null; };
      const open = (level) => { app.ev("blockNumeric")({ x: 0, y: 0 }, "skirt", level || "simple", {}, null, { x: 0, y: 0 }); return seen[seen.length-1]; };
      const load = async (id) => { app.ev("avatarLoaded")(app.read("../assets/avatar/presets/" + id + ".glb"), id + ".glb", null, true); await app.wait(() => S.av && S.av.preset === id, id); };
      app.ev("setLayout")("both");
      // no avatar: the block's own
      out.none = [open().f, open("general").f["f.hipHeight"], open().hint, app.ev("blockBody")(app.ev("BLOCKS").skirt)];
      // Jessica: hers
      await load("jessica");
      const m = app.ev("avatarMeasures")(S.av); out.m = m;
      const j = open(); out.jess = [j.f, open("general").f["f.hipHeight"], j.hint, j.labels];
      // typed over: the length; the rest stays hers. The block keeps what it was made from.
      reply = { "f.length": 500 }; open(); reply = null;
      const P = S.pieces[0]; out.made = [S.pieces.length, P.block.given, Math.round(app.bboxOf([P]).y1 - app.bboxOf([P]).y0)];
      // Edit Block… with another avatar loaded: the block's own numbers, not that avatar's
      await load("marty");
      app.ev("blockNumeric")({ x: 0, y: 0 }, "skirt", "simple", P.block.given, P.block.key); out.edit = seen[seen.length-1].f;
      // a block made before there was ease (its record has none): redrafted, it has none
      const old = { ...P.block.given }; delete old["ease.waist"]; delete old["ease.hip"];
      app.ev("blockNumeric")({ x: 0, y: 0 }, "skirt", "simple", old, P.block.key); out.oldEase = [seen[seen.length-1].f["ease.waist"], seen[seen.length-1].f["ease.hip"]];
      out.width = Math.round(app.bboxOf([P]).x1 - app.bboxOf([P]).x0);
      // a new block now: Marty's
      const mm = app.ev("avatarMeasures")(S.av); out.mm = mm; out.marty = open().f;
      // the avatar scaled: the measurements follow
      app.ev("setAvatar")({ height: 1700 }); const small = app.ev("avatarMeasures")(S.av); out.small = [small.waist < mm.waist - 40, small.hip < mm.hip - 40, open().f["f.length"] < mm.knee - 40];
      return out;
    })();` }, 120000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.none[0], { "f.waistline": 199.5, "f.hipWidth": 239, "f.length": 707, "b.waistline": 189, "b.hipWidth": 243.5, "ease.waist": 20, "ease.hip": 40 }, "no avatar: waist 777, hip 965, to the knee 707; ease 20 and 40");
  assert.strictEqual(o.none[1], 244); assert.ok(/^With no avatar loaded, waist, hip, hip height and length are the block's own \(Marty's\)\. They are the body's: the skirt is drafted with the waist ease and the hip ease added/.test(o.none[2]), o.none[2]); assert.strictEqual(o.none[3], null);
  // Jessica as the tape measures her
  assert.deepStrictEqual([o.m.waist, o.m.hip, o.m.hipHeight, o.m.knee], [597, 943, 284, 635], "her waist, hip, waist to hip, waist to knee");
  const f = o.jess[0];
  near(2*(f["f.waistline"] + f["b.waistline"]), o.m.waist, 0.01, "the dialog's waist is hers"); near(2*(f["f.hipWidth"] + f["b.hipWidth"]), o.m.hip, 0.01, "its hip"); assert.strictEqual(f["f.length"], o.m.knee); assert.strictEqual(o.jess[1], o.m.hipHeight);
  assert.ok(f["f.waistline"] - f["b.waistline"] > 9 && f["f.waistline"] - f["b.waistline"] < 11 && f["b.hipWidth"] - f["f.hipWidth"] > 4 && f["b.hipWidth"] - f["f.hipWidth"] < 6, "shared out between front and back as the block's own are");
  assert.ok(/^Waist, hip, hip height and length are measured on Jessica: type over them/.test(o.jess[2]), o.jess[2]);
  assert.deepStrictEqual([f["ease.waist"], f["ease.hip"]], [20, 40], "the default ease, beside her measurements");
  assert.deepStrictEqual(o.jess[3].slice(-2), ["Waist ease", "Hip ease"]);
  assert.ok(o.jess[3].every(l => !/auto/.test(l)), "they are values of the block, to be typed over: " + o.jess[3]);
  // typed over
  assert.strictEqual(o.made[0], 4); assert.strictEqual(o.made[1]["f.length"], 500); assert.strictEqual(o.made[1]["f.waistline"], f["f.waistline"]); assert.strictEqual(o.made[1]["f.hipHeight"], o.m.hipHeight);
  near(o.made[2], 500, 15, "the skirt is as long as was typed");
  assert.deepStrictEqual(o.edit, { ...f, "f.length": 500 }, "Edit Block shows what the block was made from, whoever is loaded now");
  assert.deepStrictEqual(o.oldEase, [0, 0]); assert.strictEqual(o.width, Math.round(2*(f["f.hipWidth"] + 10)), "the front is her hip width and a quarter of the hip ease, twice");
  assert.deepStrictEqual([o.mm.waist, o.mm.hip, o.mm.hipHeight, o.mm.knee], [777, 965, 244, 707], "Marty's: the block's own numbers are these"); near(2*(o.marty["f.waistline"] + o.marty["b.waistline"]), o.mm.waist, 0.01);
  assert.deepStrictEqual(o.small, [true, true, true], "a smaller Marty measures smaller");
});

test("the tape round the trunk is taken on the body mesh itself: a box measures its four sides, a hollow is bridged, an arm held out and a pair of legs are not taken in", () => {
  const { bodyGirth } = load(["bodyGirth"], { S, THREE, SIM3D: C });
  // an upright prism over an outline in x, z (two triangles a side), from y0 to y1
  const prism = (pts, y0, y1) => { const T = []; for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; T.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]); } return T; };
  const box = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const trunk = prism(box(-150, 150, -100, 100), 800, 1500), arm = prism(box(260, 340, -40, 40), 900, 1400);
  near(bodyGirth(new Float32Array(trunk), 1000), 1000, 1e-3, "a 300 x 200 trunk");
  near(bodyGirth(new Float32Array(trunk.concat(arm)), 1000), 1000, 1e-3, "an arm beside it is not measured with it");
  // a hollow in the back (the small of the back): the tape goes straight across it
  const hollow = prism([[-150, -100], [-50, -100], [0, -40], [50, -100], [150, -100], [150, 100], [-150, 100]], 800, 1500);
  near(bodyGirth(new Float32Array(hollow), 1000), 1000, 1e-3, "taut over the hollow");
  // two legs: neither crosses the middle line, so there is no trunk at that height
  const legs = prism(box(-160, -20, -80, 80), 0, 800).concat(prism(box(20, 160, -80, 80), 0, 800));
  assert.strictEqual(bodyGirth(new Float32Array(legs.concat(trunk)), 500), 0); near(bodyGirth(new Float32Array(legs.concat(trunk)), 900), 1000, 1e-3);
  assert.strictEqual(bodyGirth(new Float32Array(trunk), 2000), 0, "above the body: nothing");
});

test("body measurements do not depend on Collision Detail or on what is shown: the block's dialog offers the same numbers at every setting" + (hasPreset("jessica") ? "" : " (jessica.glb is not here: skipped)"), () => {
  if (!hasPreset("jessica")) return;
  const r = bootFile({ blank: true, three: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 10 }) }, script: `
    return (async () => {
      const out = { m: [], dlg: [], cells: [] }; let fields = null;
      app.answer = (title, f) => { fields = f.map(x => x.val).join(); return null; };
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/jessica.glb"), "jessica.glb", null, true); await app.wait(() => S.av, "Jessica");
      const look = (what) => { S.av.meas = null; const m = app.ev("avatarMeasures")(S.av); app.el("blk").onclick({ currentTarget: { getBoundingClientRect: () => ({ left: 600, top: 400 }) } }); out.m.push(what + ": " + [m.waist, m.hip, m.hipHeight, m.knee].join()); out.dlg.push(fields); };
      for (const cell of [4, 10, 25, 40]) { app.ev("setAvatar")({ cell }); app.ev("avatarField")(S.av); out.cells.push(S.avSet.cell); look("detail " + cell); }
      app.ev("setAvatar")({ showCol: true }); look("collision mesh shown");
      app.ev("setAvatar")({ display: "hidden" }); look("avatar hidden");
      app.ev("setAvatar")({ display: "grey", showCol: false }); look("grey");
      S.ui.show3d = { ...(S.ui.show3d || {}), avatar: false }; app.ev("show3dChanged")(); look("Show Avatar off");
      // measured without the collision body ever having been made
      S.av.sdf = null; S.av.meas = null; app.ev("avatarMeasures")(S.av); out.noField = S.av.sdf === null;
      return out;
    })();` }, 120000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.cells, [4, 10, 25, 40]);
  assert.deepStrictEqual([...new Set(o.m.map(x => x.replace(/^.*: /, "")))], ["597,943,284,635"], "the same at every setting: " + o.m.join(" | "));
  assert.deepStrictEqual([...new Set(o.dlg)], ["154.5,233.5,635,144,238,20,40"], "and so is what the dialog offers");
  assert.strictEqual(o.m.length, 8); assert.strictEqual(o.noField, true, "the collision body is not needed for it");
});

// the two preset avatars, when their files are there (assets/avatar/presets/marty.glb and jessica.glb)
const PRESET = (n) => path.join(__dirname, "..", "assets", "avatar", "presets", n + ".glb");
/* What each file is known to hold (Round B / B3a) and how the body measures. The girths are taken as the Avatar menu's
   tape takes them, on the collision body (sampled every 8 mm): the hip at its widest, the waist at its narrowest, the
   chest or bust at its fullest below the arms. */
const PRESETS = {
  marty: { name: "Marty", height: 1875.5, body: "Marty_body", meshes: 2, verts: 14517, hip: 962, waist: 776, chest: 980, arm: 50 },
  jessica: { name: "Jessica", height: 1755.8, body: "Jessica_body", meshes: 3, verts: 14517, hip: 934, waist: 594, chest: 812, arm: 45 },
};
for (const id of Object.keys(PRESETS)) {
  const here = fs.existsSync(PRESET(id)), want = PRESETS[id];
  test("the preset avatar " + want.name + (here ? "" : " (not here: skipped)") + ": loads at its height with every main bone known by name, so it has pose sliders and every arrangement point; the cloth collides with the body mesh only, not the underwear; hip, waist and chest measure as they should", () => {
    if (!here) return;
    const buf = fs.readFileSync(PRESET(id));
    // a .glb is parsed in its own time: the runner waits for the promise
    return new Promise((done, fail) => avatarParse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), id + ".glb", (err, root) => { try { assert.strictEqual(err, null); presetChecks(root, id, want); done(); } catch (e) { fail(e); } }));
  });
}
function presetChecks(root, id, want) {
  const { avatarSolid, avatarTris, avPresetId, mannequin, MANNEQUIN } = load(["avatarSolid", "avatarTris", "avPresetId", "mannequin", "MANNEQUIN"], { S, THREE, SIM3D: C });
  const av = avatarSetup(root, want.name);
  av.preset = avPresetId(id + ".glb");
  assert.strictEqual(av.preset, id);
  near(av.height, want.height, 0.2, "its height in mm"); assert.strictEqual(av.unit, 1000, "the file is in metres");
  // the skeleton: every main bone found, by this rig's names
  assert.strictEqual(av.bones.size, 53);
  assert.deepStrictEqual(POSE_BONES.filter(([r]) => !av.roles[r]).map(([r]) => r), [], "every bone the pose sliders turn");
  assert.deepStrictEqual([av.roles.neck.name, av.roles.armL.name, av.roles.forearmR.name, av.roles.shinL.name, av.roles.pelvis.name], ["neck_01", "upperarm_l", "lowerarm_r", "calf_l", "pelvis"]);
  // an A-pose: the arms held out, this far below level
  const at = (r) => av.roles[r].getWorldPosition(new THREE.Vector3()), sh = at("armL"), el = at("forearmL");
  near(Math.atan2(sh.y - el.y, el.x - sh.x)*180/Math.PI, want.arm, 2, "the arm's angle below level");
  // the body is the one large mesh; the underwear is in the file, is drawn, and is no part of the collision body
  assert.strictEqual(av.meshes.length, want.meshes);
  const solid = avatarSolid(av);
  assert.deepStrictEqual(solid.map(m => [m.name, m.geometry.attributes.position.count]), [[want.body, want.verts]], "collision and measuring: the body mesh only");
  const under = av.meshes.filter(m => !solid.includes(m));
  assert.ok(under.length === want.meshes - 1 && under.every(m => /underwear/.test(m.material.name)), "the underwear: " + under.map(m => m.material.name));
  // Round F / 8: a built-in avatar is a mannequin: the body in one matte grey plastic with no picture, nothing else shown
  assert.strictEqual(mannequin(av), true);
  assert.ok(under.every(m => m.visible === false), "the underwear is not shown");
  const mt = solid[0].userData.mat0;
  assert.deepStrictEqual([mt.type, mt.name, mt.color.getHex(), !!mt.map, mt.metalness, mt.roughness], ["MeshStandardMaterial", "mannequin", MANNEQUIN, false, 0, 0.55]);
  assert.strictEqual(solid[0].visible, true);
  // the grey stands apart from the 3D window's background and a white cloth (relative luminance, as WCAG counts it). (Round r15 / 8,
  // the check videos S16: a light grey like the reference's mannequin, the maintainer's wish; it used to be darker than the background, the 2D
  // window and a white cloth by 1.8, 3 and 5. The shading of the 3D window does the rest, as in the reference)
  const lum = (hex) => { const c = [hex >> 16, (hex >> 8) & 255, hex & 255].map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v + 0.055)/1.055, 2.4); }); return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05)/(Math.min(x, y) + 0.05); };
  for (const [bg, min] of [[0x9c9c9f, 1.5], [0xffffff, 1.5]]) assert.ok(ratio(MANNEQUIN, bg) >= min, "against #" + bg.toString(16) + ": " + ratio(MANNEQUIN, bg).toFixed(2));
  assert.ok(lum(MANNEQUIN) > lum(0x9c9c9f), "lighter than the background, as the reference's");
  assert.strictEqual(avatarTris(av).length, 9*solid[0].geometry.index.count/3, "the collision body's triangles are the body mesh's, and no more");
  // stood on the floor, on the middle line
  const box = avatarBox(av);
  assert.ok(Math.abs(box.x0 + box.x1) < 5, "it stands on the middle line"); assert.ok(Math.abs(box.y0) < 0.01, "its lowest point is on the floor, got " + box.y0);
  // the collision body: closed, a person's volume
  S.avSet = normAvatar({ cell: 8 });
  const f = avatarField(av), net = C.surfaceNets(f, 0), mv = C.meshVolume(net.pos, net.idx);
  assert.strictEqual(C.meshClosed(net.idx), true);
  assert.ok(mv.volume > 45e6 && mv.volume < 110e6, "a person's volume in mm³: " + mv.volume);
  // measured with the tape, level round the body, every 5 mm of height
  const tape = (y) => { const t = C.rayField(f, [0, y, 900], [0, 0, -1]); const g = t > 0 ? C.girth(f, [0, y, 900 - t], [0, 1, 0], 120) : null; return g ? g.tape : 0; };
  const h = av.height, rows = [];
  for (let y = Math.round(0.44*h); y <= 0.80*h; y += 5) rows.push([y, tape(y)]);
  const best = (lo, hi, max) => rows.filter(r => r[0] >= lo*h && r[0] <= hi*h && r[1] > 0).reduce((p, q) => (!p || (max ? q[1] > p[1] : q[1] < p[1]) ? q : p), null);
  const hip = best(0.47, 0.56, true), waist = best(0.56, 0.68, false);
  // the chest or bust: the fullest place above the waist before the tape takes the arms in as well (where it jumps)
  let chest = null;
  for (const r of rows) { if (r[0] <= waist[0]) continue; if (chest && r[1] > chest[1]*1.15) break; if (!chest || r[1] > chest[1]) chest = r; }
  near(hip[1], want.hip, 6, "hip girth"); near(waist[1], want.waist, 6, "waist girth"); near(chest[1], want.chest, 8, id === "jessica" ? "bust girth" : "chest girth");
  assert.ok(hip[0] < waist[0] && waist[0] < chest[0], "hip below waist below chest: " + [hip[0], waist[0], chest[0]]);
  // arrangement points: all of them, since the skeleton is whole
  S.avSet = normAvatar({ cell: 14 }); av.sdf = null;
  assert.strictEqual(arrPoints(av).length, 116, "a full skeleton gives every arrangement point"); /* (Round FIX-3 / B: the reference's layout, 116 points: 36 front, 36 back, 44 on the sides) */ // (Round FIX-2 / C12: four more on chest and back, left and right of the centre ones: 50)
}

test("the avatar in the booted app: the menu, the status bar, saved settings coming back, and the camera keys over the 3D window", () => {
  const r = boot({ storage: { "pdraft:avatar": JSON.stringify({ name: "Marty", height: 1800, display: "grey", cell: 8, pose: { armL: [0, 0, 10] } }), "pdraft:poses": JSON.stringify([{ name: "walk", q: { Pelvis: [0, 0, 0, 1] } }, "junk"]) }, script: `
    const out = {};
    out.set = S.avSet; out.poses = S.poses.map(p => p.name);
    out.menu = app.MENUS.avatar().filter(x => x.n).map(x => x.n);
    out.status = app.el("s-av").textContent;
    const c0 = { ...app.view3d.cam };
    app.key("8"); out.noHover = app.view3d.cam.az === c0.az;
    S.over3d = true; app.key("8"); out.back = app.view3d.cam.az; app.key("5"); out.top = app.view3d.cam.el; app.key("2"); out.front = [app.view3d.cam.az, app.view3d.cam.el];
    S.over3d = false;
    out.layout = S.ui.layout;
    out.err = toasts.filter(t => /could not/.test(t)).length;
    return out;
  ` });
  assert.deepStrictEqual(r.errors, [], "no errors");
  const o = r.result;
  assert.strictEqual(o.set.height, 1800); assert.strictEqual(o.set.display, "textured", "how the avatar is drawn is view state: every start at its default (Round r23 / 1)"); assert.strictEqual(o.set.cell, 8); assert.deepStrictEqual(o.set.pose, { armL: [0, 0, 10] });
  assert.deepStrictEqual(o.poses, ["walk"]);
  assert.ok(/^Load Avatar/.test(o.menu[0]) && o.menu.includes("Front") && o.menu.includes("Top"), o.menu.join());
  assert.strictEqual(o.status, "NO AVATAR");
  assert.strictEqual(o.noHover, true, "the number keys are only camera keys with the pointer over the 3D window");
  near(o.back, Math.PI, 1e-9); near(o.top, Math.PI/2, 0.01); near(o.front[0], 0, 1e-9); near(o.front[1], 0.03, 1e-9);
  assert.strictEqual(o.layout, "both", "a camera view brings the 3D window up");
});

module.exports = T;
