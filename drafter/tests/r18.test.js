// Round r18: the avatar. Batch 1, the rig fitted to its skin (the joints of Marty's and Jessica's hands lay down the arm, outside
// the hand); later batches: posing (FK, IK), the Avatar Editor's tabs, file version 22.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { load } = require("./harness");
const { three, rig } = require("./three-env");
const C = require("../drafter-sim.js");

const { THREE, THREE_LOADERS } = three();
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
const S = { av: null, avSet: null, poses: [], ui: {} };
const G = load(["normAvatar", "avatarSetup", "avatarBox", "avatarVerts", "avatarParse", "avatarSolid", "avatarTris", "rigFit"], { S, THREE, THREE_LOADERS, SIM3D: C, view3d: {} });
S.avSet = G.normAvatar(null);
const PRESET = (n) => path.join(__dirname, "..", "assets", "avatar", "presets", n + ".glb");
const hasPreset = (n) => fs.existsSync(PRESET(n));
// a preset as the app sets it up (avatarSetup(): read as metres, stood on the floor, its rig fitted)
function preset(id) {
  const buf = fs.readFileSync(PRESET(id));
  return new Promise((res, rej) => G.avatarParse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), id + ".glb", (err, root) => err ? rej(err) : res(G.avatarSetup(root, id))));
}
// the generalised winding number of a closed-ish triangle soup round p: about 1 inside, about 0 outside
function winding(T, p) {
  let w = 0;
  for (let t = 0; t < T.length; t += 9) {
    const a = [T[t]-p.x, T[t+1]-p.y, T[t+2]-p.z], b = [T[t+3]-p.x, T[t+4]-p.y, T[t+5]-p.z], c = [T[t+6]-p.x, T[t+7]-p.y, T[t+8]-p.z];
    const la = Math.hypot(...a), lb = Math.hypot(...b), lc = Math.hypot(...c);
    const det = a[0]*(b[1]*c[2]-b[2]*c[1]) - a[1]*(b[0]*c[2]-b[2]*c[0]) + a[2]*(b[0]*c[1]-b[1]*c[0]);
    const den = la*lb*lc + (a[0]*b[0]+a[1]*b[1]+a[2]*b[2])*lc + (b[0]*c[0]+b[1]*c[1]+b[2]*c[2])*la + (c[0]*a[0]+c[1]*a[1]+c[2]*a[2])*lb;
    w += 2*Math.atan2(det, den);
  }
  return w/(4*Math.PI);
}

/* ---- batch 1: the rig fitted to its skin ---- */
const MOVED = { marty: [-87.8, 102.4, -2.5], jessica: [-74.9, 75.3, -40.7] };
for (const id of ["marty", "jessica"]) test("r18 / 1: " + id + "'s joints all lie inside the body: the hand and its fingers were one vector down the arm (the file's forearm bone too long) and are moved back to their weight rings; the skin is bound again and not one vertex moves" + (hasPreset(id) ? "" : " (" + id + ".glb is not here: skipped)"), async () => {
  if (!hasPreset(id)) return;
  const av = await preset(id);
  // what was moved: the two hands (each with its fingers), by the vector their weight rings say, mirrored left and right
  assert.deepStrictEqual(av.rigFit.map(x => x.bone), ["hand_l", "hand_r"]);
  const m = MOVED[id];
  for (const [x, s] of [[av.rigFit[0], 1], [av.rigFit[1], -1]]) for (let c = 0; c < 3; c++) assert.ok(Math.abs(x.by[c] - (c === 0 ? s*m[c] : m[c])) < 3, id + " " + x.bone + " moved " + x.by);
  // the body as it stands: the skin bound again where it was, every vertex where the file has it (the rest pose)
  const body = G.avatarSolid(av)[0], P = body.geometry.attributes.position, v = new THREE.Vector3(), r = new THREE.Vector3();
  let far = 0;
  for (let i = 0; i < P.count; i++) { body.getVertexPosition(i, v); r.fromBufferAttribute(P, i); far = Math.max(far, v.distanceTo(r)); }
  assert.ok(far*av.unit < 0.01, "no vertex moved: " + far*av.unit + " mm");
  // every joint that moves any skin lies inside the body (Root stands on the floor between the feet and moves none)
  const Tr = G.avatarTris(av), si = body.geometry.attributes.skinIndex, sw = body.geometry.attributes.skinWeight, used = new Set();
  for (let i = 0; i < si.count; i++) for (let j = 0; j < 4; j++) if (sw.getComponent(i, j) > 0) used.add(body.skeleton.bones[si.getComponent(i, j)]);
  const outside = [];
  for (const b of new Set(av.bones.values())) {
    if (!used.has(b)) continue;
    const p = b.getWorldPosition(new THREE.Vector3()), w = winding(Tr, p);
    if (w < 0.5) outside.push(b.name + " (winding " + w.toFixed(2) + ")");
  }
  assert.deepStrictEqual(outside, [], "joints outside the body");
  assert.strictEqual(used.size, 52, "every bone but Root moves skin");
  // the hand's joint is now where its ring is: well inside the wrist, not on the skin
  const hand = av.bones.get("hand_l").getWorldPosition(new THREE.Vector3());
  let near = Infinity;
  for (let t = 0; t < Tr.length; t += 3) near = Math.min(near, Math.hypot(Tr[t] - hand.x, Tr[t+1] - hand.y, Tr[t+2] - hand.z));
  assert.ok(near > 12, "the wrist joint is inside the wrist, " + near.toFixed(1) + " mm from the nearest vertex (it was 4)");
});

test("r18 / 1: a rig that fits its skin is left alone (the test body's bones each move their own box), and so is one with nested copies of its bones", () => {
  for (const opt of [{}, { nest: true }, { scale: 0.001 }]) {
    const { root } = rig(opt), av = G.avatarSetup(root, "test");
    assert.deepStrictEqual(av.rigFit, [], JSON.stringify(opt));
  }
});

/* A rig whose hand is off: the test body with its hand chain made longer by 80 mm along the arm, its skin bound with the bones
   there (as the files were): the hand is moved back, and nothing else. */
test("r18 / 1: a hand chain bound 80 mm down the arm from its skin is moved back by 80 mm; the shoulder, elbow and legs stay", () => {
  const { root, bones, mesh } = rig({});
  // fingers for the hand, so its chain has enough rings: three bones in a row beyond the hand, each moving a box that blends with the one before
  const hand = bones.handL;
  let parent = hand, x = 735;
  const P = mesh.geometry.attributes.position, idx = Array.from(mesh.geometry.index.array), pos = Array.from(P.array), si = Array.from(mesh.geometry.attributes.skinIndex.array), sw = Array.from(mesh.geometry.attributes.skinWeight.array);
  const list = mesh.skeleton.bones.slice();
  for (let k = 0; k < 3; k++) {
    const b = new THREE.Bone(); b.name = "finger" + k; b.position.set(25, 0, 0); parent.add(b); list.push(b);
    // a ring of 8 vertices at the joint, half the finger's weight and half its parent's, and a box beyond it
    const pk = list.indexOf(parent), bk = list.length - 1, base = pos.length/3;
    for (let a = 0; a < 8; a++) { const f = a/8*2*Math.PI; pos.push(x, 1340 + 10*Math.cos(f), 10*Math.sin(f)); si.push(pk, bk, 0, 0); sw.push(0.5, 0.5, 0, 0); }
    for (let a = 0; a < 8; a++) idx.push(base + a, base + (a + 1) % 8, base);
    parent = b; x += 25;
  }
  // the hand's own ring: where the forearm's skin blends into the hand's (at the wrist, x = 710)
  { const fk = list.indexOf(bones.forearmL), hk = list.indexOf(hand), base = pos.length/3;
    for (let a = 0; a < 8; a++) { const f = a/8*2*Math.PI; pos.push(710, 1340 + 20*Math.cos(f), 20*Math.sin(f)); si.push(fk, hk, 0, 0); sw.push(0.5, 0.5, 0, 0); }
    for (let a = 0; a < 8; a++) idx.push(base + a, base + (a + 1) % 8, base); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4)); geo.setIndex(idx);
  const m2 = new THREE.SkinnedMesh(geo, mesh.material); m2.name = "body";
  root.remove(mesh); root.add(m2);
  hand.position.x += 80;                                      // the file's mistake: the hand chain 80 mm further out than its skin
  root.updateMatrixWorld(true); m2.bind(new THREE.Skeleton(list));
  const before = Object.fromEntries(["armL", "forearmL", "thighL", "shinR"].map(r => [r, bones[r].getWorldPosition(new THREE.Vector3()).toArray()]));
  const av = G.avatarSetup(root, "test");
  assert.deepStrictEqual(av.rigFit.map(x => x.bone), [hand.name]);
  assert.ok(Math.abs(av.rigFit[0].by[0] + 80) < 1 && Math.abs(av.rigFit[0].by[1]) < 1 && Math.abs(av.rigFit[0].by[2]) < 1, "back by 80 mm: " + av.rigFit[0].by);
  for (const r of Object.keys(before)) assert.deepStrictEqual(bones[r].getWorldPosition(new THREE.Vector3()).toArray().map(v => Math.round(v)), before[r].map(v => Math.round(v)), r + " stays");
  assert.strictEqual(Math.round(hand.getWorldPosition(new THREE.Vector3()).x), 710, "the wrist joint at its ring");
});

/* ---- batch 2: the Avatar Joint panel, FK posing, file version 22 ---- */
test("r18 / 2: a version 21 file (written by the build before this round: Marty at 1800 mm with two pose sliders, two sewn patterns, a history) opens unchanged; saved again it is version 22, with no avatar edits in it", () => {
  const o = boot({ streams: true, script: `
    const out = {};
    const bytes = new Uint8Array(app.read("files/v21/marty-posed-history.pdraft"));
    app.ev("openFile")("marty-posed-history.pdraft", bytes, null, true);
    return app.wait(() => S.pieces.length === 2, "the file opened").then(() => {
      const J = app.ev("canonJSON"), now = app.ev("docObj")();
      out.v = now.v; out.avedit = "avedit" in now; out.joints = S.avedit;
      out.names = S.pieces.map(p => p.name); out.seams = S.seams.length; out.undo = S.un.map(s => s.n);
      out.rec = S.docAv;
      return new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); })
        .then((again) => new Promise((res) => app.ev("zipUnpack")(again, (e, p) => res(p))))
        .then((parts) => app.ev("pdraftDoc")(parts)).then((d) => { out.again = d ? [d.v, "avedit" in d, J(d.scene.avatar)] : null; app.ev("undo")(); out.undone = S.pieces[0].pts[2].x; return out; });
    });` });
  const r = o.result;
  assert.strictEqual(r.v, 28); /* (this build's version: 28 since Round r30, 27 since Round r29, 26 since Round r26, 25 since Round r25, 24 since Round r20) */ assert.strictEqual(r.avedit, false, "nothing of the avatar was edited by hand"); assert.deepStrictEqual(r.joints, { joints: {} });
  assert.deepStrictEqual(r.names, ["Front piece", "Back"]); assert.strictEqual(r.seams, 1);
  assert.deepStrictEqual(r.undo, ["Rename", "Move point"], "its history came with it");
  assert.deepStrictEqual([r.rec.preset, r.rec.name, r.rec.height, r.rec.pose], ["marty", "Marty", 1800, { armL: [0, 0, 12], forearmR: [20, 0, 0] }], "the avatar record as it was");
  assert.ok(r.again && r.again[0] === 28 && r.again[1] === false, "saved again: version 28 (Round r30), no avatar edits: " + JSON.stringify(r.again));
  assert.strictEqual(r.undone, 200, "undo takes the point back where it was");
});

test("r18 / 2: the joints and the pose sliders compose: a joint's turn by hand is in its own frame, after the sliders, and the bones below it go with it (the test body)", () => {
  const Gp = load(["normAvatar", "avatarSetup", "avatarBox", "avatarVerts", "avatarSolid", "rigFit", "poseApply", "boneRole", "POSE_BONES", "normAvEdit"], { S, THREE, SIM3D: C, view3d: {} });
  const { root } = rig({}), av = Gp.avatarSetup(root, "test");
  const at = (n) => av.bones.get(n).getWorldPosition(new THREE.Vector3());
  const hand0 = at("L_Hand"), fore0 = at("L_LowerArm");
  // the forearm turned by hand 90° about its own Z (its frame is the world's here): the hand swings from +x to +y round the elbow
  av.joints = { L_LowerArm: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI/2).toArray() };
  Gp.poseApply(av);
  const hand1 = at("L_Hand"), fore1 = at("L_LowerArm");
  assert.ok(fore1.distanceTo(fore0) < 1e-6, "the elbow stays");
  assert.ok(Math.abs(hand1.x - fore0.x) < 1e-6 && Math.abs(hand1.y - (fore0.y + (hand0.x - fore0.x))) < 1e-6, "the hand turned up round the elbow: " + hand1.toArray());
  // with a slider on the upper arm as well: the slider first, the joint's own turn on top (the hand is the elbow's length out along the turned forearm)
  av.pose = { armL: [0, 0, -30] }; Gp.poseApply(av);
  const e2 = at("L_LowerArm"), h2 = at("L_Hand");
  assert.ok(e2.distanceTo(fore0) > 10, "the slider moved the elbow");
  assert.ok(Math.abs(h2.distanceTo(e2) - hand0.distanceTo(fore0)) < 1e-6, "the forearm keeps its length");
  // normAvEdit: junk and turns of nothing are dropped
  const n = Gp.normAvEdit({ joints: { a: [0, 0, 0, 1], b: [0, 0, 0, 2], c: [1, 2], d: "x", "": [0, 0, 1, 0], e: [0, 0, 2, 0] } });
  assert.deepStrictEqual(n, { joints: { e: [0, 0, 1, 0] } });
});

test("r18 / 2: FK in the booted app: Show Avatar Joints opens the Avatar Joint panel (FK, Joint, Size 8); a click on Marty's elbow selects it (Name and Matrix in the Property Editor, a gizmo of rings only); a ring turns the forearm and the hand with it, the skin bends, the collision body is the posed one; one undo step 'Turn Joint'; Joint's reset; saved in the file and opened again", () => {
  const o = boot({ three: true, script: `
    const out = {}, T3 = app.TOOL3.select_move, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      app.setTool3("select_move"); app.setPrefs({ gizSpace: "world" });
      // (Round r20 / 1b) the turn below, about the front-back axis, is one an elbow cannot make: this test is of FK itself, so the
      // joint limits are off for it (r20.test.js has the limits)
      S.ui.jointLimits = false;
      Object.assign(v3.cam, { az: 0, el: 0.05, dist: 2600, tx: 300, ty: 1150, tz: 0 }); v3.scene().updateMatrixWorld(true);
      out.noPanel = app.el("jointpanel").style.display;
      app.ev("setJoints3")(true);
      const panel = app.el("jointpanel");
      out.panel = [panel.style.display, /Avatar Joint/.test(panel.innerHTML), /data-m="fk" class="on"/.test(panel.innerHTML), />Joint</.test(panel.innerHTML), /id="jp-size" value="8"/.test(panel.innerHTML)];
      const wp = (n) => S.av.bones.get(n).getWorldPosition(new THREE.Vector3());
      const ev = (x, y, more) => ({ clientX: x, clientY: y, button: 0, buttons: 1, ...more });
      const body = app.ev("avatarSolid")(S.av)[0], vtx = (i) => { const v = new THREE.Vector3(); body.getVertexPosition(i, v); return v.applyMatrix4(body.matrixWorld); };
      // a vertex of the hand's skin: the one most held by hand_l
      const si = body.geometry.attributes.skinIndex, sw = body.geometry.attributes.skinWeight, hk = body.skeleton.bones.indexOf(S.av.bones.get("hand_l"));
      let hv = -1, best = 0; for (let i = 0; i < si.count; i++) for (let j = 0; j < 4; j++) if (si.getComponent(i, j) === hk && sw.getComponent(i, j) > best) { best = sw.getComponent(i, j); hv = i; }
      const e0 = v3.project(wp("lowerarm_l"));
      T3.down(ev(e0.x, e0.y)); T3.up(ev(e0.x, e0.y));
      out.sel = G3.joint; out.stepsAfterClick = S.undo.length;
      out.handles = app.ev("gizHandles")().map(h => h.id);
      const pe = app.el("props").innerHTML; out.pe = [/Avatar Joint/.test(pe), /lowerarm_l/.test(pe), /Matrix/.test(pe), /Turn X/.test(pe)];
      const hand0 = wp("hand_l"), elbow0 = wp("lowerarm_l"), sh0 = wp("upperarm_l"), skin0 = vtx(hv), sig0 = app.ev("simSig")();
      // the Z ring (the world's front-back axis) taken and dragged
      const geom = app.ev("gizGeom")(), ax = app.ev("GIZ_AX").find(a => a.k === "z"), p0 = v3.project(app.ev("gizRingPt")(geom, ax, 0.6));
      T3.down(ev(p0.x, p0.y)); out.taken = !!(T3.d && T3.d.joint);
      const tp = T3.d.tpx;                                    // the way the ring runs on the screen where it was taken
      for (let k = 1; k <= 12; k++) T3.move(ev(p0.x + tp.x*6*k, p0.y + tp.y*6*k));
      out.during = S.undo.length;
      T3.up(ev(p0.x + tp.x*72, p0.y + tp.y*72));
      const hand1 = wp("hand_l"), skin1 = vtx(hv);
      out.moved = [+hand1.distanceTo(hand0).toFixed(1), +wp("lowerarm_l").distanceTo(elbow0).toFixed(3), +wp("upperarm_l").distanceTo(sh0).toFixed(3), +skin1.distanceTo(skin0).toFixed(1)];
      out.forearm = [+hand1.distanceTo(elbow0).toFixed(2), +hand0.distanceTo(elbow0).toFixed(2)];
      out.step = [S.undo.length, S.un[S.un.length - 1].n]; out.joints = Object.keys(S.avedit.joints);
      out.sig = app.ev("simSig")() !== sig0;
      // the collision body is the posed skin: inside where the hand is now, and where it was is outside now
      const f = app.ev("avatarField")(S.av), C = app.ev("SIM3D");
      out.field = [C.sdfAt(f, hand1.x, hand1.y, hand1.z) < 0, C.sdfAt(f, hand0.x, hand0.y, hand0.z) > 0];
      out.inFile = app.ev("docObj")().avedit;
      // undo, redo
      app.undo(); out.undo = [+wp("hand_l").distanceTo(hand0).toFixed(3), Object.keys(S.avedit.joints).length];
      app.ev("redo")(); out.redo = +wp("hand_l").distanceTo(hand1).toFixed(3);
      // Joint's reset: the selected joint back as it came, one step
      app.ev("jointReset")(); out.reset = [+wp("hand_l").distanceTo(hand0).toFixed(3), S.un[S.un.length - 1].n, Object.keys(S.avedit.joints).length];
      app.undo(); out.resetUndone = +wp("hand_l").distanceTo(hand1).toFixed(3);
      // a click away from every joint lets the joint go
      T3.down(ev(5, 5)); T3.up(ev(5, 5)); out.letGo = G3.joint;
      // saved and opened again: the pose comes back
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
      out.fileAvedit = app.fileDoc(file).avedit;
      app.ev("jointReset")(); out.blank = [Object.keys(S.avedit.joints).length];
      app.ev("openFile")("posed.pdraft", file, null, true);
      return app.wait(() => S.av && Object.keys(S.avedit.joints).length, "the posed file").then(() => { out.reopened = +wp("hand_l").distanceTo(hand1).toFixed(2); return out; });
    });` }, 120000);
  const r = o.result;
  assert.strictEqual(r.noPanel, "none", "no panel while the joints are not shown");
  assert.deepStrictEqual(r.panel, ["block", true, true, true, true]);
  assert.strictEqual(r.sel, "lowerarm_l"); assert.strictEqual(r.stepsAfterClick, 0, "selecting a joint is no step");
  assert.deepStrictEqual(r.handles, ["turn:x", "turn:y", "turn:z"], "a joint is turned, not moved: the rings only");
  assert.deepStrictEqual(r.pe, [true, true, true, true]);
  assert.strictEqual(r.taken, true); assert.strictEqual(r.during, 0, "no step while dragging");
  assert.ok(r.moved[0] > 40, "the hand swung round the elbow: " + r.moved); assert.ok(r.moved[1] < 0.01 && r.moved[2] < 0.01, "the elbow and the shoulder stay: " + r.moved);
  assert.ok(r.moved[3] > 40, "the hand's skin bent with it: " + r.moved);
  assert.ok(Math.abs(r.forearm[0] - r.forearm[1]) < 0.01, "the forearm keeps its length");
  assert.deepStrictEqual(r.step, [1, "Turn Joint"]); assert.deepStrictEqual(r.joints, ["lowerarm_l"]);
  assert.strictEqual(r.sig, true, "the simulation is built again for the new pose"); assert.deepStrictEqual(r.field, [true, true]);
  assert.ok(r.inFile && r.inFile.joints && r.inFile.joints.lowerarm_l, "in the document: " + JSON.stringify(r.inFile));
  assert.deepStrictEqual(r.undo, [0, 0]); assert.strictEqual(r.redo, 0);
  assert.deepStrictEqual(r.reset, [0, "Reset Joint", 0]); assert.strictEqual(r.resetUndone, 0);
  assert.strictEqual(r.letGo, null);
  assert.ok(r.fileAvedit && r.fileAvedit.joints.lowerarm_l, "the pose is in the file");
  assert.deepStrictEqual(r.blank, [0], "every joint reset before the file is opened again");
  assert.ok(r.reopened < 0.5, "opened again, the hand is where it was turned to: " + r.reopened);
});

/* ---- batch 3: IK ---- */
test("r18 / 3: IK on Marty: Edit Body Part moves the hand to the pointer with the forearm and upper arm (the shoulder, the spine and the hips stay); Edit Full Body bends the spine for a reach the arm cannot make; a joint locked for translation stays (the elbow: only the forearm turns; the other hand, while the spine bends); one locked for rotation keeps how it stands; one step each, Esc gives a drag up", () => {
  const o = boot({ three: true, script: `
    const out = {}, T3 = app.TOOL3.select_move, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      app.setTool3("select_move");
      Object.assign(v3.cam, { az: 0, el: 0.05, dist: 2600, tx: 300, ty: 1150, tz: 0 }); v3.scene().updateMatrixWorld(true);
      app.ev("setJoints3")(true); app.ev("setJointMode")("ik");
      // (Round r20 / 1b) the Full Body reach below (the left hand far past the right side) is more than the spine's ranges of
      // motion allow: this test is of the IK solver itself, so the joint limits are off for it (r20.test.js has IK with them)
      S.ui.jointLimits = false;
      out.handles = app.ev("gizHandles")().length; out.noGiz = app.ev("gizJoint")();
      const wp = (n) => S.av.bones.get(n).getWorldPosition(new THREE.Vector3()), wq = (n) => S.av.bones.get(n).getWorldQuaternion(new THREE.Quaternion());
      const ev = (x, y, more) => ({ clientX: x, clientY: y, button: 0, buttons: 1, ...more });
      const r2 = (v) => +v.toFixed(2);
      // a drag of a joint by (dx, dy) pixels: where the joint should end (its start moved as the pointer moved in the plane through it)
      const drag = (name, dx, dy, keep) => {
        const O = wp(name), s = v3.project(O);
        T3.down(ev(s.x, s.y));
        const q0 = app.ev("dragPlane")(v3.ray(ev(s.x, s.y)), O);
        for (let k = 1; k <= 8; k++) T3.move(ev(s.x + dx*k/8, s.y + dy*k/8));
        const want = app.ev("dragPlane")(v3.ray(ev(s.x + dx, s.y + dy)), O).sub(q0).add(O);
        if (keep === false) app.key("Escape"); else T3.up(ev(s.x + dx, s.y + dy));
        return want;
      };
      const still = (names, before) => names.map(n => r2(wp(n).distanceTo(before[n])));
      const snap = () => Object.fromEntries(["pelvis", "spine_01", "spine_03", "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "hand_r", "foot_l"].map(n => [n, wp(n)]));
      // ---- Edit Body Part (the default): the left hand pulled in towards the body and up
      out.edit = S.ui.ikEdit;
      let b0 = snap(); let want = drag("hand_l", -60, -50);
      out.part = { reach: r2(wp("hand_l").distanceTo(want)), elbow: r2(wp("lowerarm_l").distanceTo(b0.lowerarm_l)), stay: still(["upperarm_l", "clavicle_l", "spine_03", "pelvis", "hand_r", "foot_l"], b0),
        turned: Object.keys(S.avedit.joints).sort(), step: [S.undo.length, S.un[S.un.length - 1].n], sel: G3.joint };
      // undo
      app.undo(); out.partUndone = [r2(wp("hand_l").distanceTo(b0.hand_l)), Object.keys(S.avedit.joints).length];
      // a press that does not move: the joint selected, no step
      { const s = v3.project(wp("lowerarm_l")); T3.down(ev(s.x, s.y)); T3.up(ev(s.x, s.y)); out.click = [G3.joint, S.undo.length]; }
      // ---- Esc gives a drag up
      b0 = snap(); drag("hand_l", -60, -50, false); out.esc = [r2(wp("hand_l").distanceTo(b0.hand_l)), S.undo.length, T3.d];
      // ---- Edit Full Body: far over to the right of the body, out of the arm's reach without the spine
      S.ui.ikEdit = "full";
      b0 = snap(); want = drag("hand_l", -420, 60);
      out.full = { spine: r2(wp("spine_03").distanceTo(b0.spine_03)), hips: still(["pelvis", "foot_l"], b0), turned: Object.keys(S.avedit.joints).filter(n => /spine/.test(n)).length, gap: r2(wp("hand_l").distanceTo(want)) };
      app.undo();
      // ---- Constrain Joint Translation on the right hand: it stays while the spine bends for the left
      app.ev("jointSelect")("hand_r"); app.ev("ikLock")("lockT");
      out.lockStep = [S.un[S.un.length - 1].n, (S.avedit.lockT || []).slice()];
      out.marks = app.ev("view3d").group("joints").children.filter(c => c.userData.mark).map(c => c.userData.mark);
      b0 = snap(); drag("hand_l", -420, 60);
      out.keptT = { right: r2(wp("hand_r").distanceTo(b0.hand_r)), spine: r2(wp("spine_03").distanceTo(b0.spine_03)) };
      app.undo();
      // ---- the elbow locked for translation: dragging the hand turns the forearm alone
      S.ui.ikEdit = "part"; app.ev("jointSelect")("lowerarm_l"); app.ev("ikLock")("lockT");
      b0 = snap(); drag("hand_l", 0, -80);
      out.elbowKept = [r2(wp("lowerarm_l").distanceTo(b0.lowerarm_l)), r2(wp("hand_l").distanceTo(wp("lowerarm_l")) - b0.hand_l.distanceTo(b0.lowerarm_l)), r2(wp("hand_l").distanceTo(b0.hand_l)) > 20];
      app.undo();
      // ---- Constrain Joint Rotation on the left hand: it keeps how it stands in the scene while the arm moves it
      app.ev("jointSelect")("hand_l"); app.ev("ikLock")("lockR");
      const hq = wq("hand_l"); b0 = snap(); drag("hand_l", -60, -50);
      out.keptR = [+(2*Math.acos(Math.min(1, Math.abs(hq.dot(wq("hand_l"))))) * 180/Math.PI).toFixed(2), r2(wp("hand_l").distanceTo(b0.hand_l)) > 20];
      out.inFile = app.ev("docObj")().avedit;
      return out;
    });` });
  const r = o.result;
  assert.strictEqual(r.handles, 7, "no joint gizmo in IK (the pattern gizmo's handles are listed)"); assert.strictEqual(r.noGiz, null);
  assert.strictEqual(r.edit, "part", "Edit Body Part at the start");
  assert.ok(r.part.reach < 2, "the hand reached the pointer: " + r.part.reach + " mm off"); assert.ok(r.part.elbow > 5, "the elbow moved with it");
  assert.deepStrictEqual(r.part.stay, [0, 0, 0, 0, 0, 0], "the shoulder, the collar, the spine, the hips, the other hand and a foot stay");
  assert.deepStrictEqual(r.part.turned, ["lowerarm_l", "upperarm_l"]); assert.deepStrictEqual(r.part.step, [1, "Move Joint"]); assert.strictEqual(r.part.sel, "hand_l");
  assert.deepStrictEqual(r.partUndone, [0, 0]);
  assert.deepStrictEqual(r.click, ["lowerarm_l", 0], "a press that does not move selects and is no step");
  assert.deepStrictEqual(r.esc, [0, 0, null], "Esc: the hand back, no step");
  assert.ok(r.full.spine > 3 && r.full.turned >= 2, "Edit Full Body bent the spine: " + JSON.stringify(r.full)); assert.deepStrictEqual(r.full.hips, [0, 0], "the hips and the feet stay");
  assert.ok(r.full.gap < 15, "and the hand got close to the pointer: " + r.full.gap);
  assert.deepStrictEqual(r.lockStep, ["Constrain Joint Translation", ["hand_r"]]);
  assert.deepStrictEqual(r.marks, ["T"], "the locked joint is marked T");
  assert.ok(r.keptT.spine > 3 && r.keptT.right < 2, "the right hand stayed while the spine bent: " + JSON.stringify(r.keptT));
  assert.ok(r.elbowKept[0] < 0.01 && Math.abs(r.elbowKept[1]) < 0.01 && r.elbowKept[2], "the elbow stayed, the forearm kept its length, the hand moved: " + r.elbowKept);
  assert.ok(r.keptR[0] < 0.5 && r.keptR[1], "the hand moved and kept how it stands: " + r.keptR);
  assert.deepStrictEqual([r.inFile.lockR, r.inFile.lockT], [["hand_l"], ["hand_r", "lowerarm_l"]], "the locks are in the document");
});

/* ---- batch 4: the Avatar Editor, Avatar Size ---- */
const GS = load(["normAvatar", "avatarSetup", "avatarParse", "sizeMeasure", "avatarResize", "sizeBase", "avatarScale", "avBody"], { S, THREE, THREE_LOADERS, SIM3D: C, view3d: {} });
function presetS(id) {
  const buf = fs.readFileSync(PRESET(id));
  return new Promise((res, rej) => GS.avatarParse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), id + ".glb", (err, root) => err ? rej(err) : res(GS.avatarSetup(root, id))));
}
// the body-mesh measures known since Round B (avatar.test.js): waist, hip, chest / bust
const KNOWN = { marty: { waist: 777, lowHip: 965, chest: 980, total: 1875.5 }, jessica: { waist: 597, lowHip: 942, chest: 823, total: 1755.8 } };
const SIZES = {
  smaller: (v) => ({ chest: v.chest - 40, waist: v.waist - 40, highHip: v.highHip - 40, lowHip: v.lowHip - 40, neck: v.neck - 10, bicep: v.bicep - 15, thigh: v.thigh - 20 }),
  "larger and taller": (v) => ({ chest: v.chest + 80, waist: v.waist + 80, highHip: v.highHip + 80, lowHip: v.lowHip + 80, neck: v.neck + 20, bicep: v.bicep + 30, thigh: v.thigh + 40, total: v.total + 60, hps: v.hps + 52, inseam: v.inseam + 28, arm: v.arm + 20 }),
  "other proportions": (v) => ({ total: v.total - 80, inseam: v.inseam - 50, hps: v.hps - 75, waist: v.waist + 60, lowHip: v.lowHip + 30, shoulder: v.shoulder - 15, hand: v.hand + 10, head: v.head + 10 }),
};
for (const id of ["marty", "jessica"]) test("r18 / 4: " + id + " measured on the skin (every Avatar Size measurement found; the trunk's girths as the block dialog has them) and reshaped to three sizes: every target met within 5 mm; back to the avatar as it came, every vertex where it was" + (hasPreset(id) ? "" : " (not here: skipped)"), async () => {
  if (!hasPreset(id)) return;
  const av = await presetS(id), v0 = GS.sizeBase(av).m.values;
  for (const k of ["chest", "weight", "total", "hps", "inseam", "neck", "bicep", "waist", "highHip", "lowHip", "thigh", "shoulder", "arm", "hand", "head"]) assert.ok(v0[k] > 0, id + ": " + k + " measured");
  for (const [k, v] of Object.entries(KNOWN[id])) assert.ok(Math.abs(v0[k] - v) < 4, id + " " + k + " " + v0[k] + " (known " + v + ")");
  assert.ok(v0.inseam < v0.hps && v0.hps < v0.total, "the crotch below the shoulder below the head");
  const B = GS.avBody(av), pos0 = B.meshes.map(m => m.geometry.attributes.position.array.slice());
  for (const [name, mk] of Object.entries(SIZES)) {
    const t = mk(v0), a = GS.avatarResize(av, { t });
    for (const k of Object.keys(t)) assert.ok(Math.abs(a[k] - t[k]) < 5, id + " " + name + ": " + k + " wanted " + t[k].toFixed(1) + ", measured " + a[k].toFixed(1));
    // what was not asked for stays within a few millimetres (the across-shoulder drifts most: the trunk's width carries it)
    for (const k of ["total", "inseam", "hps", "head", "hand"]) if (!(k in t)) assert.ok(Math.abs(a[k] - v0[k]) < 3, id + " " + name + ": " + k + " stays, moved " + (a[k] - v0[k]).toFixed(1));
    assert.ok(Math.abs(av.height0 - a.total) < 0.01, "its height is the reshaped one");
  }
  GS.avatarResize(av, null);
  let far = 0;
  B.meshes.forEach((m, k) => { const A = m.geometry.attributes.position.array; for (let i = 0; i < A.length; i++) far = Math.max(far, Math.abs(A[i] - pos0[k][i])); });
  assert.strictEqual(far, 0, "back as it came, to the bit");
  assert.ok(Math.abs(av.height0 - KNOWN[id].total) < 0.2);
});

test("r18 / 4: the Avatar Editor in the booted app: Avatar ▸ Avatar Editor opens it in the 2D window's place with its six tabs and the two tabs at the bottom; Avatar Size reshapes Marty to a typed waist (one step 'Avatar Size'), a linked chest takes the girths along, an unlinked one does not; undo; the size is in the file; a posed and sized avatar; a height typed sets Scale to Height back; a size file read", () => {
  const o = boot({ three: true, script: `
    const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      const menu = app.MENUS.avatar().filter(x => x.n).map(x => x.n);
      out.menu = menu.includes("Avatar Editor");
      app.MENUS.avatar().find(x => x.n === "Avatar Editor").f();
      const el = app.el("aved"), bar = app.el("avtabs");
      out.open = [!!S.aved, S.aved.tab, S.aved.front, /Avatar Size/.test(el.innerHTML), /Measure/.test(el.innerHTML), /Blend Shape/.test(el.innerHTML), /2D Pattern Window/.test(bar.innerHTML), /Neck Base/.test(el.innerHTML), /Across Shoulder \\(Curvilinear\\)/.test(el.innerHTML), /Flat/.test(el.innerHTML)];
      out.lines = v3.group("sizelines").children.length;
      const now = (k) => +S.av.sizeNow[k].toFixed(1);
      out.base = [now("waist"), now("chest"), now("neck")];
      // a waist typed
      app.ev("sizeTyped")("waist", 820);
      out.waist = [now("waist"), S.un[S.un.length - 1].n, S.undo.length, S.avedit.size.t.waist];
      // the chest, linked: the girths below follow in proportion
      app.ev("sizeTyped")("chest", 1029);
      out.linked = [now("chest"), +(S.avedit.size.t.neck/out.base[2]).toFixed(3), now("neck")];
      // unlinked: the chest alone
      S.ui.avLinkW = false; const nk = S.avedit.size.t.neck;
      app.ev("sizeTyped")("chest", 1000);
      out.unlinked = [now("chest"), S.avedit.size.t.neck === nk];
      out.inFile = app.ev("docObj")().avedit.size.t;
      // undo three steps: the avatar as it came
      app.undo(); app.undo(); app.undo(); out.undone = [now("waist"), !!S.avedit.size];
      app.ev("redo")(); out.redone = now("waist");
      // posed and sized: a joint turned on the sized avatar; the size kept, the hand moved, the measurements the same (taken in the rest pose)
      const wp = (n) => S.av.bones.get(n).getWorldPosition(new THREE.Vector3());
      const h0 = wp("hand_l"); app.push("Turn Joint"); S.avedit.joints = { lowerarm_l: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.8).toArray() }; app.commit();
      out.posed = [+wp("hand_l").distanceTo(h0).toFixed(0) > 40, now("waist")];
      // the collision body is the sized one: the waist's front is further out than Marty's own
      const f = app.ev("avatarField")(S.av), C = app.ev("SIM3D"); out.field = C.sdfAt(f, 0, S.av.size0.m.levels.waistY, 150) < 200;
      // a height typed: Scale to Height set back
      app.ev("setAvatar")({ height: 1800 }); out.scaled = Math.round(S.av.height);
      app.ev("sizeTyped")("total", 1900);
      out.height = [S.avSet.height, Math.round(S.av.height), now("total")];
      // a size file read
      app.ev("sizeFileText")("x.json", JSON.stringify({ gusset: "avatar-size", v: 1, name: "Test size", size: { t: { waist: 760 } } }));
      out.file = [now("waist"), S.avedit.size.preset];
      app.ev("sizeFileText")("bad.json", "{"); out.bad = toasts[toasts.length - 1];
      // the 2D window in front, then the editor again; closing it
      app.ev("avEditorFront")("2d"); out.front2d = [S.aved.front, app.el("aved").style.display];
      app.ev("avEditorFront")("ed"); app.ev("avEditor")(false); out.closed = [S.aved, v3.group("sizelines").children.length];
      return out;
    });` });
  const r = o.result;
  assert.strictEqual(r.menu, true);
  assert.deepStrictEqual(r.open, [true, "size", "ed", true, true, true, true, true, true, true]);
  assert.ok(r.lines >= 10, "the measurements' lines on the avatar: " + r.lines);
  assert.ok(Math.abs(r.base[0] - 777) < 3);
  assert.ok(Math.abs(r.waist[0] - 820) < 2, "the waist reshaped: " + r.waist); assert.deepStrictEqual(r.waist.slice(1), ["Avatar Size", 1, 820]);
  assert.ok(Math.abs(r.linked[0] - 1029) < 3 && Math.abs(r.linked[1] - 1029/r.base[1]) < 0.003 && r.linked[2] > r.base[2] + 10, "linked: the neck follows the chest: " + r.linked);
  assert.ok(Math.abs(r.unlinked[0] - 1000) < 3 && r.unlinked[1], "unlinked: the chest alone: " + r.unlinked);
  assert.ok(Math.abs(r.inFile.waist - 820*1029/r.base[1]) < 0.2 && r.inFile.chest === 1000, "in the file (the waist went with the linked chest): " + JSON.stringify(r.inFile));
  assert.ok(Math.abs(r.undone[0] - 777) < 1 && r.undone[1] === false, "undone: " + r.undone); assert.ok(Math.abs(r.redone - 820) < 2);
  assert.deepStrictEqual(r.posed, [true, r.redone], "posed: the hand moved, the size kept");
  assert.strictEqual(r.field, true);
  assert.strictEqual(r.scaled, 1800);
  assert.ok(r.height[0] === null && Math.abs(r.height[1] - 1900) < 2 && Math.abs(r.height[2] - 1900) < 2, "Scale to Height set back, the avatar 1900 tall: " + r.height);
  assert.ok(Math.abs(r.file[0] - 760) < 2 && r.file[1] === "file:Test size", "a size file: " + r.file);
  assert.ok(/not an avatar size file/.test(r.bad));
  assert.deepStrictEqual(r.front2d, ["2d", "none"]); assert.deepStrictEqual(r.closed, [null, 0]);
});

/* ---- batch 5: the Measure tab ---- */
test("r18 / 5: the avatar's measurements are the document's: a circumference made by three clicks round Marty's waist (Basic: taut; Surface: along the skin, longer); the Measure tab lists it with its colour, Name, Measurement Type, both lengths, Show, Show Length; it follows the pose and the size; one step each; in the file; Delete", () => {
  const o = boot({ three: true, script: `
    const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      Object.assign(v3.cam, { az: 0.35, el: 0.05, dist: 2600, tx: 0, ty: 1150, tz: 0 }); v3.scene().updateMatrixWorld(true);
      const ev = (P) => { const q = v3.project(P); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1 }; };
      const hit = (o, d) => app.ev("avatarHit")({ o: new THREE.Vector3(...o), d: new THREE.Vector3(...d), rc: null });
      const y = S.av.sizeNow ? 0 : 0, wy = app.ev("sizeMeasure")(S.av).levels.waistY;
      const A = hit([60, wy, 1500], [0, 0, -1]), B = hit([-60, wy, 1500], [0, 0, -1]), Cs = hit([1500, wy, 0], [-1, 0, 0]);
      app.setTool3("circ_basic");
      const T = app.TOOL3.circ_basic;
      T.down(ev(A)); T.down(ev(B)); out.picked = S.avPick.length; out.before = S.undo.length; T.down(ev(Cs));
      const m = S.avMeas[0], rec = S.avedit.meas[0];
      out.made = [rec.kind, rec.type, rec.at.length, rec.name, S.un[S.un.length - 1].n, m.kind, Math.round(m.tape), Math.round(m.surface)];
      out.waist = Math.round(app.ev("sizeMeasure")(S.av).values.waist);
      // the Measure tab
      app.ev("avEditor")(true, "measure");
      const html = app.el("aved").innerHTML;
      out.tab = [/Circumference 1/.test(html), /ae-dot/.test(html), /Measurement Type/.test(html), /Basic Length/.test(html), /Surface Length/.test(html), /Show Length/.test(html), /<option value="basic" selected>Basic/.test(html)];
      // Surface: the length along the skin
      app.ev("measSet")(0, { type: "surface" }, "Measurement Type"); out.surface = [S.avMeas[0].surf, S.un[S.un.length - 1].n, /girth along the skin/.test(app.ev("measName")(S.avMeas[0]))];
      // posed: an arm turned does not change it; the size: a wider waist makes it longer
      const t0 = Math.round(S.avMeas[0].tape);
      app.ev("sizeTyped")("waist", out.waist + 60); out.sized = Math.round(S.avMeas[0].tape) - t0;
      // hidden, its length not written
      app.ev("measSet")(0, { show: false }); out.hidden = v3.group("measure").children.length;
      app.ev("measSet")(0, { show: true, showLen: false }); out.noLabel = v3.group("measure").children.filter(c => c.isSprite).length;
      // in the file
      out.inFile = JSON.stringify(app.ev("docObj")().avedit.meas.map(r => [r.kind, r.type, r.at.length, r.showLen]));
      // a tape and a height
      app.setTool3("tape_basic"); const tb = app.TOOL3.tape_basic; tb.down(ev(A)); tb.down(ev(hit([0, wy + 300, 1500], [0, 0, -1])));
      app.setTool3("height_measure"); app.TOOL3.height_measure.down(ev(A));
      out.kinds = S.avMeas.map(x => x.kind);
      // undo takes the height back; Delete in the tab
      app.undo(); out.undone = S.avMeas.length;
      G3.selMeas = 0; app.ev("avEditorRender")(); app.ev("measDelete")(0); out.deleted = [S.avMeas.map(x => x.kind), S.un[S.un.length - 1].n];
      // a measurements file read back
      app.ev("measFileText")(JSON.stringify({ gusset: "avatar-measurements", v: 1, avatar: "Marty", meas: [{ id: 9, kind: "height", type: "basic", name: "H", at: [{ v: [10, 11, 12], w: [1, 0, 0] }] }] }));
      out.read = [S.avMeas.length, S.avedit.meas[S.avedit.meas.length - 1].id];
      // the pose: a tape from a place on the left hand to the waist is longer or shorter once the forearm is turned
      const BB = app.ev("avBody")(S.av), hand = S.av.bones.get("hand_l"); let hv = -1; for (let i = 0; i < BB.nv; i++) if (BB.own[i] === hand) { hv = i; break; }
      const wv = S.avedit.meas[0].at[0].v[0];
      app.ev("measAdd")({ kind: "tape", type: "basic", at: [{ v: [hv, hv, hv], w: [1, 0, 0] }, { v: [wv, wv, wv], w: [1, 0, 0] }] });
      const L0 = app.ev("measLen")(S.avMeas[S.avMeas.length - 1].a, S.avMeas[S.avMeas.length - 1].b);
      app.push("Turn Joint"); S.avedit.joints = { lowerarm_l: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.8).toArray() }; app.commit();
      out.posed = Math.round(Math.abs(app.ev("measLen")(S.avMeas[S.avMeas.length - 1].a, S.avMeas[S.avMeas.length - 1].b) - L0));
      return out;
    });` });
  const r = o.result;
  assert.strictEqual(r.picked, 2); assert.strictEqual(r.before, 0, "no step until the third click");
  assert.deepStrictEqual(r.made.slice(0, 6), ["circ", "basic", 3, "Circumference 1", "Avatar Measure", "circ"]);
  assert.ok(Math.abs(r.made[6] - r.waist) < 25, "round the waist, taut: " + r.made[6] + " (the waist measures " + r.waist + ")"); assert.ok(r.made[7] >= r.made[6], "along the skin at least as long as taut: " + r.made);
  assert.deepStrictEqual(r.tab, [true, true, true, true, true, true, true]);
  assert.deepStrictEqual(r.surface, [true, "Measurement Type", true]);
  assert.ok(r.sized > 40, "the measurement follows the size: " + r.sized + " mm longer");
  assert.strictEqual(r.hidden, 0, "hidden: not drawn"); assert.strictEqual(r.noLabel, 0, "Show Length off: no length written");
  assert.strictEqual(r.inFile, '[["circ","surface",3,false]]');
  assert.deepStrictEqual(r.kinds, ["circ", "tape", "height"]); assert.strictEqual(r.undone, 2);
  assert.deepStrictEqual(r.deleted, [["tape"], "Delete Avatar Measure"]);
  assert.deepStrictEqual(r.read, [2, 3], "read in with the next free id");
  assert.ok(r.posed > 30, "a tape from the hand follows the forearm turned: " + r.posed + " mm");
});

/* ---- batch 6: the Arrangement tab ---- */
test("r18 / 6: arrangement points come from bounding volumes and points: the defaults put all 46 where they always were; the Arrangement tab lists volumes (Joint Name 0 / 1, Shape, Height, Lengths) and points (Arrangement BV, X, Y, Offset, Wrap Direction); selecting a point marks its partner; an edit moves the point, follows the pose, is one step and is in the file; not assigned takes a point away", () => {
  const o = boot({ three: true, script: `
    const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      const r = (a) => a.map(v => Math.round(v*1000)/1000);
      const list = () => { S.arr = null; return app.ev("arrList")(); };
      // the points as the program always worked them out (the code before Round r18, kept here as it was) against the new defaults
      const av = S.av, R = av.roles, f = app.ev("avatarField")(av), C = app.ev("SIM3D");
      const rq = av.root.getWorldQuaternion(new THREE.Quaternion()), U = new THREE.Vector3(0, 1, 0).applyQuaternion(rq), F = new THREE.Vector3(0, 0, 1).applyQuaternion(rq), Lx = new THREE.Vector3(1, 0, 0).applyQuaternion(rq);
      const at = (b) => b.getWorldPosition(new THREE.Vector3()), reach = (P, d) => C.bodyReach(f, P.x, P.y, P.z, d.x, d.y, d.z, 500, 0);
      const centre = (P, e1, e2) => { const c = P.clone(); for (const e of [e1, e2]) { const a = reach(c, e), b = reach(c, e.clone().negate()); if (a > 0 && b > 0) c.addScaledVector(e, (a - b)/2); } return c; };
      const old = [];
      const add = (id, P, up, dir) => { const side = up.clone().cross(dir).normalize(), o = side.clone().cross(up).normalize(); old.push([id, P.toArray(), up.toArray(), o.toArray(), reach(P, o)]); };
      const P0 = at(R.pelvis), top = at(R.neck), H = top.clone().sub(P0).dot(U);
      for (const [key, k] of [["chest", 0.62], ["waist", 0.2], ["hip", -0.12]]) { const P = centre(P0.clone().addScaledVector(U, H*k), F, Lx); for (const [dk, d] of [["front", F], ["back", F.clone().negate()], ["left", Lx], ["right", Lx.clone().negate()]]) add(key + "_" + dk, P, U, d); }
      const Pn = centre(top.clone().lerp(at(R.head), 0.3), F, Lx); add("neck_front", Pn, U, F); add("neck_back", Pn, U, F.clone().negate());
      for (const s of ["L", "R"]) for (const [a, b, key] of [["arm", "forearm", "arm"], ["forearm", "hand", "forearm"], ["thigh", "shin", "thigh"], ["shin", "foot", "shin"]]) {
        const A = at(R[a + s]), B = at(R[b + s]), up = A.clone().sub(B).normalize(), fwd = F.clone().addScaledVector(up, -F.dot(up)).normalize();
        let outer = up.clone().cross(fwd).normalize(); if (outer.dot(Lx)*(s === "L" ? 1 : -1) < 0) outer.negate();
        const P = centre(A.clone().add(B).multiplyScalar(0.5), fwd, outer);
        for (const [dk, d] of [["front", fwd], ["back", fwd.clone().negate()], ["outer", outer], ["inner", outer.clone().negate()]]) add(key + s + "_" + dk, P, up, d);
      }
      const now = list();
      out.n = [old.length, now.length];
      out.same = old.every((x, i) => { const p = now[i]; return p.id === x[0] && [[p.a, x[1]], [p.up, x[2]], [p.out, x[3]]].every(([u, w]) => u.every((v, c) => Math.abs(v - w[c]) < 1e-6)) && Math.abs(p.rho - x[4]) < 1e-6 && p.gap === 25; });
      // the tab
      app.ev("avEditor")(true, "arrange");
      let html = app.el("aved").innerHTML;
      out.tab = [/Bounding Volume/.test(html), /Joint Name 0/.test(html), /Length X \\(mm\\)/.test(html), /Wrap Direction/.test(html), /not assigned/.test(html), (html.match(/data-pt="/g) || []).length, (html.match(/data-bv="/g) || []).length];
      out.bvShown = v3.group("arrbv").children.length;
      // a point selected: it and its partner marked
      G3.arrPt = "armL_back"; G3.arrBV = "armL"; app.ev("avEditorRender")(); app.ev("showArrPoints")();
      out.partner = app.ev("arrPartner")("armL_back"); out.bodyPartner = app.ev("arrPartner")("waist_left");
      out.rings = v3.group("arr").children.filter(c => c.userData.ring).length;
      // the point moved round the arm and up it: one step; the point is somewhere else, and its partner is not changed
      const p0 = list().find(p => p.id === "armL_back").a.slice(), q0 = list().find(p => p.id === "armR_back").a.slice();
      app.ev("arrEdit")((set) => { const q = set.pts.find(x => x.id === "armL_back"); q.x = 60; q.y = 80; });
      const p1 = list().find(p => p.id === "armL_back");
      out.moved = [Math.round(Math.hypot(p1.a[0] - p0[0], p1.a[1] - p0[1], p1.a[2] - p0[2])), S.un[S.un.length - 1].n, list().find(p => p.id === "armR_back").a.every((v, c) => Math.abs(v - q0[c]) < 1e-6)];
      out.inFile = app.ev("docObj")().avedit.arrange.pts.find(x => x.id === "armL_back");
      // the pose: the arm raised, the point goes with it
      app.push("Turn Joint"); S.avedit.joints = { upperarm_l: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.6).toArray() }; app.commit();
      { const p2 = list().find(p => p.id === "armL_back").a; out.posed = Math.round(Math.hypot(p2[0] - p1.a[0], p2[1] - p1.a[1], p2[2] - p1.a[2])); }
      // not assigned: the point is not offered
      app.ev("arrEdit")((set) => { set.pts.find(x => x.id === "chest_front").bv = ""; });
      out.unassigned = [list().length, list().some(p => p.id === "chest_front")];
      // Offset: the pattern put further out
      app.ev("arrEdit")((set) => { set.pts.find(x => x.id === "waist_front").off = 100; });
      out.gap = list().find(p => p.id === "waist_front").gap;
      // undo all the way back: the defaults again
      for (let k = 0; k < 4; k++) app.undo();
      out.back = [!!S.avedit.arrange, list().length];
      return out;
    });` });
  const r = o.result;
  assert.deepStrictEqual(r.n, [46, 46]); assert.strictEqual(r.same, true, "every default point exactly where it always was");
  assert.deepStrictEqual(r.tab, [true, true, true, true, true, 46, 10], "46 points on 10 volumes: the body, the neck, four on each side");
  assert.strictEqual(r.bvShown, 10, "the volumes drawn while the tab is in front");
  assert.strictEqual(r.partner, "armR_back"); assert.strictEqual(r.bodyPartner, "waist_right"); assert.strictEqual(r.rings, 2, "the point and its partner ringed");
  assert.ok(r.moved[0] > 30 && r.moved[1] === "Arrangement" && r.moved[2], "moved, one step, its partner left alone: " + r.moved);
  assert.deepStrictEqual([r.inFile.x, r.inFile.y], [60, 80]);
  assert.ok(r.posed > 25, "the point follows the arm turned at the shoulder: " + r.posed + " mm");
  assert.deepStrictEqual(r.unassigned, [45, false]);
  assert.strictEqual(r.gap, 50);
  assert.deepStrictEqual(r.back, [false, 46]);
});

/* ---- batch 7: the IK Joint tab ---- */
test("r18 / 7: the IK Joint tab: Marty's joints mapped from their names, Complete; the reference's names read too; a row picked takes the joint clicked in 3D (and its other side with Symmetry Mapping); a missing wrist is not Complete; Set T-Pose and Reset Pose; the IK solver uses the mapping; saved in the file", () => {
  const Gb = load(["normAvatar", "avatarSetup", "boneRole", "ikAuto", "jointBones", "IK_REQ", "FINGERS"], { S, THREE, SIM3D: C, view3d: {} });
  // a rig named in the L_ / R_ style (L_UpperArm the upper arm, L_Clavicle the collar, Spine, Joint the root)
  const { root } = rig({}), av = Gb.avatarSetup(root, "t"), M = Gb.ikAuto(av);
  assert.deepStrictEqual(Gb.IK_REQ.filter(k => !M[k]), [], "every required joint of the test body found by name");
  assert.deepStrictEqual([M.shoulder_l, M.elbow_l, M.wrist_l, M.hip_l, M.knee_l, M.ankle_l, M.waist, M.hips, M.collar_l], ["L_UpperArm", "L_LowerArm", "L_Hand", "L_UpperLeg", "L_LowerLeg", "L_Foot", "Spine", "Pelvis", "L_Clavicle"]);
  const o = boot({ three: true, script: `
    const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      const M = app.ev("ikMapOf")(S.av);
      out.map = ["head", "waist", "hips", "shoulder_l", "elbow_l", "wrist_l", "hip_l", "knee_l", "ankle_l", "wrist_r", "collar_l", "chest_1", "neck", "index_1_l", "toe_l", "root"].map(k => M[k] || "");
      app.ev("avEditor")(true, "ik");
      let html = app.el("aved").innerHTML;
      out.tab = [/Complete/.test(html), /Auto Mapping/.test(html), /Set T-Pose/.test(html), /Reset Pose/.test(html), /Optional/.test(html), /HipsTranslation/.test(html), (html.match(/<circle/g) || []).length];
      // a row picked, then a joint clicked in 3D: mapped, and its other side with it (Symmetry Mapping is on)
      app.ev("setJoints3")(true); app.setTool3("select_move");
      Object.assign(v3.cam, { az: 0, el: 0.05, dist: 2600, tx: 300, ty: 1150, tz: 0 }); v3.scene().updateMatrixWorld(true);
      G3.ikSlot = "wrist_l";
      const p = v3.project(S.av.bones.get("lowerarm_l").getWorldPosition(new THREE.Vector3()));
      app.TOOL3.select_move.down({ clientX: p.x, clientY: p.y, button: 0, buttons: 1 }); app.TOOL3.select_move.up({});
      const M2 = app.ev("ikMapOf")(S.av);
      out.picked = [M2.wrist_l, M2.wrist_r, S.un[S.un.length - 1].n, G3.ikSlot];
      // the solver uses it: the left forearm is now the "wrist", so dragging it turns two joints above it (the upper arm and the collar)
      out.chain = app.ev("ikChain")(S.av, S.av.bones.get("lowerarm_l"), "part").map(b => b.name);
      app.undo();
      out.back = app.ev("ikMapOf")(S.av).wrist_l;
      // a required joint unmapped: not Complete
      app.ev("ikMapSet")({ wrist_l: "" }); html = app.el("aved").innerHTML; out.missing = [/1 missing/.test(html), !app.ev("ikComplete")(app.ev("ikMapOf")(S.av))];
      // Set T-Pose and Reset Pose
      app.push("Turn Joint"); S.avedit.joints = { upperarm_l: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.7).toArray() }; app.commit();
      const tq = JSON.stringify(S.avedit.joints);
      app.ev("AVED_WIRE").ik; app.ev("push")("Set T-Pose"); S.avedit = app.ev("normAvEdit")({ ...S.avedit, ik: { ...(S.avedit.ik || {}), tpose: { ...S.avedit.joints } } }); app.commit();
      app.push("Turn Joint"); S.avedit.joints = {}; app.commit();
      app.ev("push")("Reset Pose"); S.avedit = app.ev("normAvEdit")({ ...S.avedit, joints: { ...S.avedit.ik.tpose } }); app.commit();
      out.reset = JSON.stringify(S.avedit.joints) === tq;
      out.inFile = Object.keys(app.ev("docObj")().avedit.ik).sort();
      return out;
    });` });
  const r = o.result;
  assert.deepStrictEqual(r.map, ["head", "spine_01", "pelvis", "upperarm_l", "lowerarm_l", "hand_l", "thigh_l", "calf_l", "foot_l", "hand_r", "clavicle_l", "spine_02", "neck_01", "index_01_l", "ball_l", "Root"]);
  assert.deepStrictEqual(r.tab, [true, true, true, true, true, true, 15]);
  assert.deepStrictEqual(r.picked, ["lowerarm_l", "lowerarm_r", "IK Joint Mapping", null], "the joint clicked, and its other side");
  assert.deepStrictEqual(r.chain, ["upperarm_l", "clavicle_l"], "the solver takes the mapping: a 'wrist' bends the two joints above it");
  assert.strictEqual(r.back, "hand_l");
  assert.deepStrictEqual(r.missing, [true, true]);
  assert.strictEqual(r.reset, true, "Reset Pose puts the T-pose that was set back");
  assert.deepStrictEqual(r.inFile, ["map", "tpose"]);
});

/* ---- batch 8: the Fitting Suit and Blend Shape tabs ---- */
test("r18 / 8: the Fitting Suit tab: a line picked, three places clicked round Marty's waist: the line drawn on the avatar (the right side; an Elbow's left side mirrored from it), one step, in the file, following the pose; Drape Fitting Suit is not built; Show Avatar Fitting Suit, Show Bounding Volumes and Show Avatar Measures are switches now", () => {
  const o = boot({ three: true, script: `
    const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      Object.assign(v3.cam, { az: 0, el: 0.05, dist: 2600, tx: 0, ty: 1150, tz: 0 }); v3.scene().updateMatrixWorld(true);
      const ev = (P) => { const q = v3.project(P); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1 }; };
      const hit = (o, d) => app.ev("avatarHit")({ o: new THREE.Vector3(...o), d: new THREE.Vector3(...d), rc: null });
      app.ev("avEditor")(true, "suit");
      let html = app.el("aved").innerHTML;
      out.tab = [/Upper Body/.test(html), /Lower Body/.test(html), /Mid Neck/.test(html), /Armhole \\(R\\)/.test(html), /Armhole \\(L\\)/.test(html), /Ankle \\(L\\)/.test(html), /Drape Fitting Suit \\(not built yet\\)/.test(html)];
      // the waist: picked, then three places clicked round it
      const wy = app.ev("sizeMeasure")(S.av).levels.waistY;
      app.ev("suitArm")("waist");
      const T3 = app.TOOL3.select_move;
      // two places on the front, then the camera turned round for the third, on the back
      for (const P of [hit([60, wy, 1500], [0, 0, -1]), hit([-60, wy, 1500], [0, 0, -1])]) { T3.down(ev(P)); T3.up({}); }
      Object.assign(v3.cam, { az: Math.PI }); v3.scene().updateMatrixWorld(true);
      { const P = hit([0, wy, -1500], [0, 0, 1]); T3.down(ev(P)); T3.up({}); }
      Object.assign(v3.cam, { az: 0 }); v3.scene().updateMatrixWorld(true);
      out.waist = [S.avedit.suit.map(x => x.key), S.un[S.un.length - 1].n, v3.group("suit").children.filter(c => c.userData.suit).map(c => c.userData.suit)];
      const loop = (k) => { const c = v3.group("suit").children.find(x => x.userData.suit === k), a = c.geometry.attributes.position; let y0 = Infinity, y1 = -Infinity, L = 0; for (let i = 0; i < a.count; i++) { y0 = Math.min(y0, a.getY(i)); y1 = Math.max(y1, a.getY(i)); const j = (i + 1) % a.count; L += Math.hypot(a.getX(j) - a.getX(i), a.getY(j) - a.getY(i), a.getZ(j) - a.getZ(i)); } return [Math.round(y1 - y0), Math.round(L)]; };
      out.waistLoop = loop("waistR");
      // the right elbow: its left side made from it
      const E = S.av.bones.get("lowerarm_r").getWorldPosition(new THREE.Vector3());
      app.ev("suitArm")("elbow");
      // round the elbow: its front, its outer side (seen from the avatar's right), its back (seen from behind)
      const views = [[0, [E.x, E.y + 10, 1500], [0, 0, -1]], [-Math.PI/2, [-1500, E.y, E.z], [1, 0, 0]], [Math.PI, [E.x, E.y - 10, -1500], [0, 0, 1]]];
      for (const [az, o, dd] of views) { Object.assign(v3.cam, { az }); v3.scene().updateMatrixWorld(true); const P = hit(o, dd); T3.down(ev(P)); T3.up({}); }
      Object.assign(v3.cam, { az: 0 }); v3.scene().updateMatrixWorld(true);
      out.elbow = v3.group("suit").children.filter(c => c.userData.suit).map(c => c.userData.suit).sort();
      out.inFile = app.ev("docObj")().avedit.suit.map(x => [x.key, x.at.length, x.mir ? x.mir.length : 0]);
      // posed: the left forearm turned: its mirrored elbow line moves with the arm, the right one does not
      const pos = (k) => { const c = v3.group("suit").children.find(x => x.userData.suit === k).geometry.attributes.position; return [c.getX(0), c.getY(0), c.getZ(0)]; };
      const r0 = pos("elbowR"), l0 = pos("elbowL");
      app.push("Turn Joint"); S.avedit.joints = { upperarm_l: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.6).toArray() }; app.commit();
      const d = (a, b) => Math.round(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      out.posed = [d(pos("elbowR"), r0), d(pos("elbowL"), l0)];
      // closed: not drawn, unless Show Avatar Fitting Suit
      app.ev("avEditor")(false); out.closed = v3.group("suit").children.length;
      const row = (n) => app.ev("avatarItems")().find(x => x.n === n);
      row("Show Avatar Fitting Suit").f(); out.shown = v3.group("suit").children.length > 0;
      row("Show Bounding Volumes").f(); out.bvs = v3.group("arrbv").children.length;
      out.measRow = typeof row("Show Avatar Measures").f === "function" && !row("Show Avatar Measures").nb;
      return out;
    });` });
  const r = o.result;
  assert.deepStrictEqual(r.tab, [true, true, true, true, true, true, true]);
  assert.deepStrictEqual(r.waist, [["waist"], "Fitting Suit Line", ["waistR"]]);
  assert.ok(r.waistLoop[0] < 40 && r.waistLoop[1] > 600 && r.waistLoop[1] < 1000, "a loop round the waist, nearly level: " + r.waistLoop);
  assert.deepStrictEqual(r.elbow, ["elbowL", "elbowR", "waistR"]);
  assert.deepStrictEqual(r.inFile, [["waist", 3, 0], ["elbow", 3, 3]]);
  assert.ok(r.posed[0] < 1 && r.posed[1] > 20, "the left elbow's line goes with the arm, the right one stays: " + r.posed);
  assert.strictEqual(r.closed, 0); assert.strictEqual(r.shown, true); assert.strictEqual(r.bvs, 10); assert.strictEqual(r.measRow, true);
});

test("r18 / 8: Blend Shape: an avatar's morph targets are listed by mesh, each a weight 0 to 100; a weight set moves the skin (and the collision body); one step; in the file; Reset; Marty has none and says so", () => {
  // the test body with a morph target on its mesh: "Belly" pushes the chest box forward by 50 mm
  const Gb = load(["normAvatar", "avatarSetup", "blendTargets", "blendApply", "normAvEdit"], { S, THREE, SIM3D: C, view3d: {} });
  const { root, mesh } = rig({}), P = mesh.geometry.attributes.position, d = new Float32Array(P.count*3);
  for (let i = 0; i < P.count; i++) if (P.getY(i) > 1160 && P.getY(i) < 1380 && Math.abs(P.getX(i)) < 170) d[3*i+2] = 50;
  mesh.geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(d, 3)]; mesh.geometry.morphTargetsRelative = true; mesh.updateMorphTargets(); mesh.morphTargetDictionary = { Belly: 0 }; mesh.morphTargetInfluences = [0];
  const av = Gb.avatarSetup(root, "t");
  assert.deepStrictEqual(Gb.blendTargets(av).map(g => [g.name, g.keys]), [["body", ["Belly"]]]);
  let k = -1; for (let i = 0; i < P.count; i++) if (d[3*i+2] && P.getZ(i) > 0) { k = i; break; }
  const z = () => { const v = new THREE.Vector3(); mesh.getVertexPosition(k, v); return v.z; }, z0 = z();
  S.avedit = Gb.normAvEdit({ blend: { body: { Belly: 50 } } }); Gb.blendApply(av);
  assert.ok(Math.abs(z() - z0 - 25) < 1e-6, "half the target's 50 mm: " + (z() - z0));
  S.avedit = Gb.normAvEdit({ blend: { body: { Belly: 0 } } });
  assert.deepStrictEqual(S.avedit, { joints: {} }, "a weight of 0 is no entry");
  S.avedit = { joints: {} };
  const o = boot({ three: true, script: `
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => { app.ev("avEditor")(true, "blend"); const h = app.el("aved").innerHTML; return [/Deformable Parameters/.test(h), /Marty has no blend shapes/.test(h)]; });` });
  assert.deepStrictEqual(o.result, [true, true]);
});

module.exports = T;
