// Round r20: the "not built" backlog. Batch 1, the r18 follow-up: the IK slots in this program's own names (and the names files of
// version 22 and 23 wrote read on opening), joint limits for FK and IK.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const T = [];
const test = (name, fn) => T.push({ name, fn });

const G = load(["ikLabel", "ikOldId", "ikSlotOf", "IK_SLOTS_ALL", "IK_REQ", "IK_OLD"], {});

test("IK slots: this program's names, shown in words; the names of version 22 / 23 files read as the new ones", () => {
  assert.strictEqual(G.IK_REQ.length, 15);
  for (const k of G.IK_SLOTS_ALL) assert.ok(/^[a-z]+(_[a-z0-9]+)*$/.test(k), k);
  assert.deepStrictEqual(["wrist_l", "thumb_2_r", "chest_1", "neck_2", "root", "hips_move", "lowerarm_roll_l"].map(G.ikLabel),
    ["Left Wrist", "Right Thumb 2", "Chest 1", "Neck (upper)", "Reference", "Hips Translation", "Left Forearm Roll"]);
  // the old keys, as version 22 and 23 wrote them
  const old = { LeftWrist: "wrist_l", RightAnkle: "ankle_r", Head: "head", Waist: "waist", Hips: "hips", LeftCollar: "collar_l", LeftToe: "toe_l",
    RightHandPinky3: "pinky_3_r", LeftForeArmRoll: "lowerarm_roll_l", RightUpLegRoll: "thigh_roll_r", Reference: "root" };
  old["Neck" + 1] = "neck_2"; old["Spine" + 2] = "chest_2"; old["Hips" + "Translation"] = "hips_move";
  for (const [k, v] of Object.entries(old)) assert.strictEqual(G.ikSlotOf(k), v, k);
  assert.strictEqual(G.ikSlotOf("wrist_l"), "wrist_l");
  assert.strictEqual(G.ikSlotOf("Nonsense"), null);
  // every slot has exactly one old name and they do not collide
  assert.strictEqual(Object.keys(G.IK_OLD).length, G.IK_SLOTS_ALL.length);
});

// joint limits, on the test rig (arms straight out along ±x, legs down, every bone unturned at rest)
const { three, rig } = require("./three-env");
const { THREE, THREE_LOADERS } = three();
const C = require("../drafter-sim.js");
const S = { av: null, avSet: null, poses: [], ui: {} };
const L = load(["normAvatar", "avatarSetup", "jointLimit", "jointLimitTurn", "jointLimitOf", "jointFrame", "boneRole"], { S, THREE, THREE_LOADERS, SIM3D: C, view3d: {}, toast: () => {} });
S.avSet = L.normAvatar(null);
// the angle between a bone's rest direction and where q points it
function bent(av, b, q) {
  const fr = L.jointFrame(av, b), d = fr.d0.clone().applyQuaternion(q.clone().multiply(fr.q0.clone().invert()));
  return Math.acos(Math.max(-1, Math.min(1, d.dot(fr.d0))))*180/Math.PI;
}
const turn = (av, b, ax, deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...ax).normalize(), deg*Math.PI/180).multiply(av.rest.get(b));

test("joint limits: the elbow and knee bend one way, a cone and a twist elsewhere; off, nothing is held", () => {
  const av = L.avatarSetup(rig().root, "t.fbx");
  const el = av.roles.forearmL, kn = av.roles.shinL, arm = av.roles.armL, nk = av.roles.neck;
  S.ui = {};
  // the left forearm points +x; bending it forward (towards +z) is a turn about -y
  const flex = L.jointLimit(av, el, turn(av, el, [0, -1, 0], 90));
  assert.ok(Math.abs(bent(av, el, flex) - 90) < 0.5, "90° of flexion stays: " + bent(av, el, flex));
  const deep = L.jointLimit(av, el, turn(av, el, [0, -1, 0], 170));
  assert.ok(Math.abs(bent(av, el, deep) - 150) < 0.5, "flexion stops at 150°: " + bent(av, el, deep));
  const back = L.jointLimit(av, el, turn(av, el, [0, 1, 0], 40));
  assert.ok(bent(av, el, back) <= 5.01, "the elbow does not bend backwards: " + bent(av, el, back));
  const side = L.jointLimit(av, el, turn(av, el, [0, 0, 1], 60));
  assert.ok(bent(av, el, side) < 0.5, "nor sideways: " + bent(av, el, side));
  // the knee (the shin points down) bends back (towards -z) only
  const kf = L.jointLimit(av, kn, turn(av, kn, [1, 0, 0], 100)), kb = L.jointLimit(av, kn, turn(av, kn, [-1, 0, 0], 60));
  const fr = L.jointFrame(av, kn), dir = (q) => fr.d0.clone().applyQuaternion(q.clone().multiply(fr.q0.clone().invert()));
  assert.ok(dir(kf).z < -0.9 || Math.abs(bent(av, kn, kf) - 100) < 0.5, "a knee bent back stays");
  assert.ok(bent(av, kn, kb) <= 5.01, "a knee does not bend forward: " + bent(av, kn, kb));
  // a cone joint: the upper arm forward 100 stays, back 120 stops at 60; its twist stops at 80
  assert.ok(Math.abs(bent(av, arm, L.jointLimit(av, arm, turn(av, arm, [0, -1, 0], 100))) - 100) < 0.5);
  assert.ok(Math.abs(bent(av, arm, L.jointLimit(av, arm, turn(av, arm, [0, 1, 0], 120))) - 60) < 0.5);
  const tw = L.jointLimit(av, arm, turn(av, arm, [1, 0, 0], 150)), fa = L.jointFrame(av, arm);
  const t = tw.clone().multiply(fa.q0.clone().invert());
  assert.ok(Math.abs(2*Math.atan2(t.x, t.w)*180/Math.PI) <= 80.01, "the twist stops at 80°");
  // the neck within 30° forward
  assert.ok(Math.abs(bent(av, nk, L.jointLimit(av, nk, turn(av, nk, [1, 0, 0], 80))) - 30) < 0.5);
  // a turn by hand on top of a base: the same, as the turn J the document keeps
  const base = av.rest.get(el).clone(), J = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 40*Math.PI/180);
  const J2 = L.jointLimitTurn(av, el, base, J);
  assert.ok(bent(av, el, base.clone().multiply(J2)) <= 5.01);
  // off: nothing is held
  S.ui = { jointLimits: false };
  assert.ok(Math.abs(bent(av, el, L.jointLimit(av, el, turn(av, el, [0, 1, 0], 40))) - 40) < 0.5);
  S.ui = {};
});

test("joint limits in the app: on by default, a switch on the Avatar Joint panel; Marty's forearm turned by FK stays in its elbow's hinge plane (off, it swings out of it)", () => {
  const path = require("path"), { spawnSync } = require("child_process");
  const script = `
    const out = {}, T3 = app.TOOL3.select_move, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    out.def = S.ui.jointLimits !== false;
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      app.setTool3("select_move"); app.setPrefs({ gizSpace: "world" });
      Object.assign(v3.cam, { az: 0, el: 0.05, dist: 2600, tx: 300, ty: 1150, tz: 0 }); v3.scene().updateMatrixWorld(true);
      app.ev("setJoints3")(true);
      out.row = /id="jp-lim" checked/.test(app.el("jointpanel").innerHTML);
      const wp = (n) => S.av.bones.get(n).getWorldPosition(new THREE.Vector3());
      const ev = (x, y) => ({ clientX: x, clientY: y, button: 0, buttons: 1 });
      const e0 = v3.project(wp("lowerarm_l"));
      T3.down(ev(e0.x, e0.y)); T3.up(ev(e0.x, e0.y));
      // the Z ring (front-back): the forearm swung in the body's own plane, which an elbow cannot do
      const swing = () => {
        const hand0 = wp("hand_l"), geom = app.ev("gizGeom")(), ax = app.ev("GIZ_AX").find(a => a.k === "z"), p0 = v3.project(app.ev("gizRingPt")(geom, ax, 0.6));
        T3.down(ev(p0.x, p0.y)); const tp = T3.d.tpx;
        for (let k = 1; k <= 12; k++) T3.move(ev(p0.x + tp.x*6*k, p0.y + tp.y*6*k));
        T3.up(ev(p0.x + tp.x*72, p0.y + tp.y*72));
        // how far the forearm has left its hinge's plane (degrees): the plane of its rest direction and forward
        const b = S.av.bones.get("lowerarm_l"), fr = app.ev("jointFrame")(S.av, b), h = new THREE.Vector3().crossVectors(fr.d0, fr.fwd).normalize();
        const d = fr.d0.clone().applyQuaternion(b.quaternion.clone().multiply(fr.q0.clone().invert()));
        return [+wp("hand_l").distanceTo(hand0).toFixed(1), +(Math.asin(Math.min(1, Math.abs(d.dot(h))))*180/Math.PI).toFixed(2)];
      };
      out.held = swing();
      app.ev("jointReset")();
      app.ev("setJointLimits")(false); out.off = S.ui.jointLimits === false;
      out.free = swing();
      app.ev("setJointLimits")(true); out.on = S.ui.jointLimits === true;
      // IK with the limits: the left hand pulled in and up reaches the pointer, the elbow bends forward within its hinge
      app.ev("jointReset")();
      app.ev("setJointMode")("ik");
      const O = wp("hand_l"), sc = v3.project(O);
      T3.down(ev(sc.x, sc.y));
      const q0 = app.ev("dragPlane")(v3.ray(ev(sc.x, sc.y)), O);
      for (let k = 1; k <= 8; k++) T3.move(ev(sc.x - 60*k/8, sc.y - 50*k/8));
      const want = app.ev("dragPlane")(v3.ray(ev(sc.x - 60, sc.y - 50)), O).sub(q0).add(O);
      T3.up(ev(sc.x - 60, sc.y - 50));
      const b = S.av.bones.get("lowerarm_l"), fr = app.ev("jointFrame")(S.av, b), h = new THREE.Vector3().crossVectors(fr.d0, fr.fwd).normalize();
      const dl = b.quaternion.clone().multiply(fr.q0.clone().invert());
      const lim = app.ev("jointLimit")(S.av, b, b.quaternion);
      out.ik = [+wp("hand_l").distanceTo(want).toFixed(1), +(b.quaternion.angleTo(lim)*180/Math.PI).toFixed(3), S.un[S.un.length - 1].n];
      return out;
    });`;
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify({ three: true, script })], { encoding: "utf8", timeout: 180000, maxBuffer: 1 << 26 });
  assert.strictEqual(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  const x = o.result;
  assert.strictEqual(x.def, true); assert.strictEqual(x.row, true, "the Limits switch, ticked");
  assert.ok(x.held[1] < 0.5, "with limits on the forearm stays in its hinge's plane: " + x.held);
  assert.ok(x.free[1] > 20 && x.free[0] > 40, "with limits off it swings out of it: " + x.free);
  assert.strictEqual(x.off, true); assert.strictEqual(x.on, true);
  assert.ok(x.ik[0] < 5, "IK within the limits reaches a place the arm can reach: " + x.ik);
  assert.ok(x.ik[1] < 0.1, "and the elbow is within its limits (to rounding): " + x.ik); assert.strictEqual(x.ik[2], "Move Joint");
});


/* ---- Batch 3: 2D sewing and lines ---- */
const path3 = require("path"), { spawnSync: spawn3 } = require("child_process");
function boot(opt) {
  const r = spawn3(process.execPath, [path3.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
// two rectangles, A (100..400 x 100..300) and B (500..800 x 100..300), the view 1 : 1 at the origin; every text drawn caught
const DOC = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  const A = app.mkPiece("A", app.mkShape([{x:100,y:100},{x:400,y:100},{x:400,y:300},{x:100,y:300}], true));
  const B = app.mkPiece("B", app.mkShape([{x:500,y:100},{x:800,y:100},{x:800,y:300},{x:500,y:300}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const out = {}, cx = app.ev("ctx"), texts = [];
  cx.fillText = (t, x, y) => texts.push(t);
  const drawn = () => { texts.length = 0; app.draw(); return texts.slice(); };
  const sew = (a, b) => app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[a].id }, { piece: B.id, sid: B.segs[b].id }, true);
`;

test("r20 / 3: Show 2D Sewing Lengths writes every shown seam's two lengths and their difference; off, only the selected seam's", () => {
  const o = boot({ script: DOC + `
    S.seams.push(sew(1, 3)); S.seams.push(sew(2, 2)); app.commit(); app.ev("setView")("sewing", true); app.setTool("edit_pattern");
    // (r20 / 3b) every label but the selected seam's is stamped as a picture of itself: counted by its stamps
    let stamps = 0; const dI = cx.drawImage; cx.drawImage = function () { stamps++; if (dI) return dI.apply(this, arguments); };
    const lens = () => { stamps = 0; const t = drawn().filter(t => /^A /.test(t)).length; return t + stamps; };
    out.off = lens(); out.def = S.show.sewLen;
    app.ev("setView")("sewLen", true); out.on = lens();
    S.seams[1].hide = true; out.hidden = lens(); S.seams[1].hide = false;
    S.selSeam = S.seams[0].id; out.sel = lens();
    // kept: the same words until the pattern changes, then worked out again
    S.selSeam = null; const w1 = app.ev("seamLenWorld")(S.seams[0]); out.kept = w1 === app.ev("seamLenWorld")(S.seams[0]);
    A.pts[2].y = 350; app.commit();      /* (the right side, sewn, now 250 long) */ const w2 = app.ev("seamLenWorld")(S.seams[0]); out.redone = w2 !== w1 && w2.txt !== w1.txt; out.dbg = [w1 && w1.txt, w2 && w2.txt, A.pts[2].y, S.pieces[0] === A];
    out.row = app.ev("menuDisplay")().some(r => r.n === "Sewing" && typeof r.menu === "function" && r.menu().some(x => x.n === "Show 2D Sewing Lengths" && !x.nb && !/not built/.test(x.note || "")));
    return out;` });
  assert.strictEqual(o.def, false, "off by default");
  assert.strictEqual(o.off, 0); assert.strictEqual(o.on, 2, "both seams' lengths"); assert.strictEqual(o.hidden, 1, "a hidden seam's not");
  assert.strictEqual(o.sel, 2, "the selected seam's once, the other's too");
  assert.strictEqual(o.kept, true, "kept while nothing changes"); assert.strictEqual(o.redone, true, "worked out again when the pattern changes: " + JSON.stringify(o.dbg));
  assert.strictEqual(o.row, true, "a built row of Settings ▸ Display ▸ Sewing");
});

test("r20 / 3c: Show 2D Sewing Lengths leaves a label out when it is longer on the screen than its seam, or when it would overlap one already written", () => {
  const o = boot({ script: DOC + `
    S.seams.push(sew(1, 3)); S.seams.push(sew(2, 2)); app.commit(); app.ev("setView")("sewing", true); app.ev("setView")("sewLen", true); app.setTool("edit_pattern");
    let stamps = 0; const dI = cx.drawImage; cx.drawImage = function () { stamps++; if (dI) return dI.apply(this, arguments); };
    const n = () => { stamps = 0; app.draw(); return stamps; };
    out.both = n();
    /* zoomed out: the 200 and 300 mm seams are 10 and 15 px on the screen, a label 26 px wide */ S.view.s = 0.05; out.far = n(); S.view.s = 1;
    /* a second seam on the first one's sides: its label would sit on the first's */ S.seams.push(sew(1, 3)); app.commit(); out.layered = n();
    return out;` });
  assert.strictEqual(o.both, 2, "both labels as before");
  assert.strictEqual(o.far, 0, "none longer than its seam");
  assert.strictEqual(o.layered, 2, "the third seam's label, on the first's, is left out");
});

test("r20 / 3: Edit Sewing ▸ Merge makes the seam selected before and the one right-clicked one M:N seam (one step, undone); overlapping sides are refused", () => {
  const o = boot({ script: DOC + `
    S.seams.push(sew(1, 3)); S.seams.push(sew(2, 2)); S.seams.push(sew(1, 0)); app.commit(); S.undo.length = 0;
    const [s1, s2, s3] = S.seams, ids = [s1.id, s2.id];
    app.ev("mergeSewing")(s1, s2);
    const m = S.seams.find(x => x.id === s2.id);
    out.after = [S.seams.length, m.a.length, m.b.length, S.un[S.un.length - 1].n];
    app.undo(); out.undo = S.seams.map(x => x.id).slice(0, 2).join() === ids.join() && S.seams.length === 3;
    const n = S.undo.length; app.ev("mergeSewing")(S.seams[0], S.seams[2]); out.refused = [S.seams.length, S.undo.length === n];
    return out;` });
  assert.deepStrictEqual(o.after, [2, 2, 2, "Merge Sewing"], "one seam of two parts a side, one step: " + JSON.stringify(o));
  assert.strictEqual(o.undo, true, "undo brings both back");
  assert.deepStrictEqual(o.refused, [3, true], "the same side twice in one seam: refused, no step");
});

test("r20 / 3: Replaced by on an internal line: the line takes the clicked line's points and curve, keeps its id and first segment's id; one step, undone", () => {
  const o = boot({ script: DOC + `
    const la = app.mkShape([{x:150,y:200},{x:350,y:200}], false), lb = app.mkShape([{x:550,y:200},{x:650,y:250},{x:750,y:200}], false);
    app.ev("addChild")(A, "internals", la); app.ev("addChild")(B, "internals", lb); app.commit(); S.undo.length = 0;
    const id = la.id, sid = la.segs[0].id;
    app.ev("replaceShapeStart")(A, la);
    app.ev("replaceClick")(650, 250);
    const L = A.internals.find(x => x.id === id);
    out.got = [L.pts.length, L.pts[2].x, L.segs[0].id === sid, L.segs[1].id !== lb.segs[1].id, S.un[S.un.length - 1].n, B.internals.length, S.replace];
    app.undo(); const U = S.pieces.find(p => p.name === "A").internals.find(x => x.id === id); out.undo = [U.pts.length, U.pts[1].x];     // (undo makes the patterns afresh)
    return out;` });
  assert.deepStrictEqual(o.got, [3, 750, true, true, "Replaced by", 1, null]);
  assert.deepStrictEqual(o.undo, [2, 350], JSON.stringify(o));
});

/* ---- Batch 9 (first part): the 3D view and the pattern menu ---- */
const SEWN3 = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1];
  A.p3 = { pos: [500, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [500, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
  const frame = () => { for (const f of [app.ev("gridFade"), app.ev("names3Frame")]) f(); };
`;
test("r20 / 9: Focus Zoom in 3D brings the view round the selected cloth; Move to Ground Center stands it on the floor's middle (one step, undone)", () => {
  const o = boot({ blank: true, three: true, script: SEWN3 + `
    S.sel = [A.id];
    const b = app.ev("clothBox3")([A]);
    app.ev("focusZoom3")();
    out.zoom = [Math.abs(v3.cam.tx - (b.x0 + b.x1)/2) < 1e-6, Math.abs(v3.cam.ty - (b.y0 + b.y1)/2) < 1e-6, v3.cam.dist >= 600];
    S.sel = [A.id, B.id];
    app.ev("moveToGround3")();
    const c = app.ev("clothBox3")([A, B]);
    out.ground = [+c.y0.toFixed(6), +((c.x0 + c.x1)/2).toFixed(6), +((c.z0 + c.z1)/2).toFixed(6), S.un[S.un.length - 1].n, S.undo.length];
    app.undo(); const A2 = S.pieces[0]; out.undone = +A2.p3.pos[0].toFixed(3);
    const rows = []; const walk = (L) => { for (const r of L || []) { if (r && r.n) rows.push(r); if (r && typeof r.menu === "function") walk(r.menu()); } };
    walk(app.ev("menu3D")()); walk(app.ev("menuDisplay")()); walk(app.ev("menuPreferences")());
    const row = (n) => rows.find(r => r.n === n);
    out.rows = ["Edit Measure (Garment)", "Show Ground Grid", "Show 2D Grid", "Show Frame Rate", "3D Grid Brightness…", "Show Pattern Name", "Show Garment Measurements"].map(n => !!row(n) && !row(n).nb && !/not built/.test(row(n).note || ""));
    return out;` });
  assert.deepStrictEqual(o.zoom, [true, true, true]);
  assert.deepStrictEqual(o.ground.slice(0, 3), [0, 0, 0], "lowest point on the floor, the box's middle over the floor's middle");
  assert.deepStrictEqual(o.ground.slice(3), ["Move to Ground Center", 1]);
  assert.strictEqual(o.undone, 500, "undo puts it back");
  assert.deepStrictEqual(o.rows, [true, true, true, true, true, true, true], "built rows: " + JSON.stringify(o));
});
test("r20 / 9: Show Ground Grid hides the floor grid, 3D Grid Brightness lightens it; Show Pattern Name puts a name over each cloth; Show Frame Rate shows the rate; all off by default but the grid", () => {
  const o = boot({ blank: true, three: true, script: SEWN3 + `
    const sc = v3.scene(), g = () => sc.getObjectByName("grid:fine");
    frame(); out.grid = [g().visible]; app.ev("setShow3")("ground3", false); frame(); out.grid.push(g().visible); app.ev("setShow3")("ground3", true); frame(); out.grid.push(g().visible);
    S.ui.grid3b = 1.5; frame(); out.bright = +[].concat(g().material)[0].color.r.toFixed(2);
    const names = () => (sc.getObjectByName("names3") || { children: [] }).children.length;
    frame(); out.names = [names()]; app.ev("setShow3")("names3", true); frame(); out.names.push(names());
    const F = () => app.ev("FPS3");
    out.fps = [!!F()]; app.ev("setShow3")("fps3", true); frame(); frame(); out.fps.push(!!F() && / fps$/.test(F().el.textContent));
    app.ev("setShow3")("fps3", false); frame(); out.fps.push(!!F());
    return out;` });
  assert.deepStrictEqual(o.grid, [true, false, true], JSON.stringify(o));
  assert.ok(o.bright > 1.2, "lighter: " + o.bright);
  assert.deepStrictEqual(o.names, [0, 2], "none by default, one a pattern when on: " + JSON.stringify(o));
  assert.deepStrictEqual(o.fps, [false, true, false], JSON.stringify(o));
});

/* ---- Batch 6 (part): the POM tab ---- */
test("r20 / 6: the POM tab: each point of measure's length in every shown size of a graded pattern; ✎ renames (one step); Names from CSV names them in order", () => {
  const o = boot({ blank: true, script: `
    const out = {};
    app.ev("addBlock")("skirt", "simple", null, { x: 0, y: 0 });
    const A = S.pieces[0], G = S.grading, g = G.groups[0], base = g.base;
    // the front graded: its second point 10 mm further right a size from the base
    for (const z of g.sizes) if (z.id !== base) { const k = g.sizes.findIndex(x => x.id === z.id) - g.sizes.findIndex(x => x.id === base); app.ev("setPtDelta")(G, A, A, 1, z.id, 10*k, 0); }
    S.measures.push({ id: 1, a: { piece: A.id, sid: A.segs[0].id, t: 0 }, b: { piece: A.id, sid: A.segs[1].id, t: 0 } }, { id: 2, a: { piece: A.id, sid: A.segs[0].id, t: 0 }, b: { piece: A.id, sid: A.segs[2].id, t: 0 } });
    app.commit(); S.undo.length = 0; S.un.length = 0;
    const z = app.ev("pomSizes")(S.measures[0]);
    out.sizes = [z.length, z.filter(x => x.base).length, new Set(z.map(x => x.len.toFixed(3))).size > 1];
    app.answer = () => null;
    const ask = app.ev("askText"); 
    const NL = String.fromCharCode(10); app.ev("pomNamesText")(["name", "Waist", "Hip,extra", "Left over", ""].join(NL));
    out.names = [S.measures.map(m => m.name), S.un[S.un.length - 1].n];
    app.undo(); out.undone = S.measures.map(m => m.name || "");
    return out;` });
  assert.ok(o.sizes[0] >= 3 && o.sizes[1] === 1, "every shown size, the base one of them: " + o.sizes);
  assert.strictEqual(o.sizes[2], true, "the sizes' lengths differ");
  assert.deepStrictEqual(o.names, [["Waist", "Hip"], "Names from CSV"], "the header line left out, the first column taken");
  assert.deepStrictEqual(o.undone, ["", ""]);
});

/* ---- Batch 4a (r20 continued): several seams selected with Edit Sewing ---- */
test("r20 / 4: Edit Sewing holds several seams: Shift+click adds and takes away, a box takes the seams inside it; no step", () => {
  const o = boot({ script: DOC + `
    S.seams.push(sew(1, 3)); S.seams.push(sew(2, 2)); S.seams.push(sew(0, 0)); app.commit(); S.undo.length = 0; app.setTool("edit_sewing");
    const [a, b, c] = S.seams, ids = () => app.ev("seamSelIds")().slice().sort();
    app.ev("seamSelSet")([a.id]);
    // Shift+click: through editSewDown with a seam under the pointer
    const at = (sm) => { const X = app.ev("seamSide")(sm.a[0], S.pieces), q = app.ev("segPt")(X.sh, X.i, 0.5); return app.ev("toS")(q); };
    let q = at(b); app.ev("editSewDown")(q.x, q.y, null, { shiftKey: true }); out.add = ids();
    app.ev("editSewDown")(q.x, q.y, null, { shiftKey: true }); out.off = ids();
    // a box round everything
    app.ev("editSewDown")(5, 5, null, {}); S.marquee.b = { x: 1200, y: 900 }; app.ev("cvUp")({});
    out.box = ids(); out.steps = S.undo.length;
    // drawn as selected
    out.hot = S.seams.map(sm => app.ev("seamIsSel")(sm));
    return out;` });
  assert.deepStrictEqual(o.add.length, 2, "Shift adds: " + JSON.stringify(o)); assert.deepStrictEqual(o.off.length, 1, "Shift again takes it away");
  assert.strictEqual(o.box.length, 3, "the box takes all three"); assert.strictEqual(o.steps, 0, "selecting is no step");
  assert.deepStrictEqual(o.hot, [true, true, true]);
});
test("r20 / 4: on several seams Delete, Hide, Deactivate, Merge and the Sewing Line Type act on all (one step each); mixed values show as —; Select All with Same Property", () => {
  const o = boot({ script: DOC + `
    S.seams.push(sew(1, 3)); S.seams.push(sew(2, 2)); S.seams.push(sew(0, 0)); S.seams[2].foldStrength = 40; app.commit(); S.undo.length = 0; app.setTool("edit_sewing");
    const [a, b, c] = S.seams;
    app.ev("seamSelSet")([a.id, c.id], a.id);
    S.sel = [S.pieces[0].id]; app.ev("ui")();
    const pe = app.el("props").innerHTML; out.pe = [/2 seams/.test(pe), /id="sf-k"[^>]*value="—"/.test(pe) || /value="—"/.test(pe)];
    app.ev("setSeamFold")(app.ev("seamSelList")(), { angle: 90 }); out.fold = [S.seams.map(x => x.foldAngle || 180), S.seams.map(x => x.foldStrength || 5), S.un[S.un.length - 1].n, S.undo.length];
    app.ev("toggleSewing")(S.seams[0]); out.off = [S.seams.map(x => !!x.off), S.undo.length];
    app.undo(); app.undo();
    // Select All with Same Property ▸ Fold Strength, from b (5): a and b, not c (40)
    app.ev("seamsSameProp")(S.seams[1], "strength"); out.same = app.ev("seamSelIds")().length;
    app.ev("seamSelSet")(S.seams.map(x => x.id)); app.ev("hideSewing")(S.seams[0]); out.hide = [S.seams.every(x => x.hide), S.undo.length]; app.undo();
    app.ev("seamSelSet")(S.seams.map(x => x.id)); app.ev("deleteSewing")(app.ev("seamSelList")()); out.del = [S.seams.length, S.undo.length]; app.undo();
    // Merge: a and b selected, right-click b ▸ Merge: one seam (c stays)
    app.ev("seamSelSet")([S.seams[0].id, S.seams[1].id], S.seams[1].id); app.ev("mergeSewingAll")(S.seams[1]); out.merge = [S.seams.length, S.un[S.un.length - 1].n];
    return out;` });
  assert.deepStrictEqual(o.pe, [true, true], "the section says 2 seams; Fold Strength mixed: — " + JSON.stringify(o));
  assert.deepStrictEqual(o.fold.slice(0, 3), [[90, 180, 90], [5, 5, 40], "Sewing Line Type"], "the angle reached both selected, each kept its own strength");
  assert.deepStrictEqual(o.off[0], [true, false, true]);
  assert.strictEqual(o.same, 2);
  assert.strictEqual(o.hide[0], true); assert.strictEqual(o.del[0], 0);
  assert.deepStrictEqual(o.merge, [2, "Merge Sewing"]);
});

/* ---- Batch 4: annotations; file version 24 ---- */
test("r20 / 4: a version 23 file (written by the build before the bump: two patterns, annotations, a seam, a history) opens unchanged and is saved as this build's version (24 then; 25 since Round r25)", () => {
  const o = boot({ blank: true, streams: true, script: `
    const out = {};
    const bytes = new Uint8Array(app.read("files/v23/annotations-sewn-history.pdraft"));
    const was = app.fileDoc(bytes);
    app.ev("openFile")("annotations-sewn-history.pdraft", bytes, null, true);
    return app.wait(() => S.pieces.length === 2, "the file opened").then(() => {
      const J = app.ev("canonJSON"), now = app.ev("docObj")();
      const strip = (d) => { const c = JSON.parse(JSON.stringify(d)); delete c.v; delete c.scene; delete c.drape; delete c.states3; delete c.states3Bin; delete c.history; return J(c); };
      out.v = [was.v, now.v]; out.same = strip(was) === strip(now);
      out.undo = S.un.map(x => x.n);
      return new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); })
        .then((again) => new Promise((res) => app.ev("zipUnpack")(again, (e, p) => res(p)))).then((parts) => app.ev("pdraftDoc")(parts))
        .then((d) => { out.again = d.v; app.ev("undo")(); out.undone = S.pieces[1].name; return out; });
    });` });
  assert.deepStrictEqual(o.v, [23, 27]);      // (Round r29: saved as 27)
  assert.strictEqual(o.same, true, "the same document");
  assert.deepStrictEqual(o.undo, ["Rectangle", "Rectangle", "Annotation", "Segment Sewing", "Rename"], "its history came with it");
  assert.strictEqual(o.again, 27);      // (Round r29: this build's version) assert.strictEqual(o.undone, "Back");
});
test("r20 / 4: an annotation's Orientation, colour, Link to a line, Copy and Rotate: each one step, kept in the file, undone", () => {
  const o = boot({ blank: true, streams: true, script: DOC + `
    A.notes = [{ text: "Cut 2", x: 250, y: 200, size: 10 }]; app.commit(); S.undo.length = 0; S.un.length = 0;
    const nt = () => S.pieces[0].notes[0];
    app.ev("noteTurn")(S.pieces[0], nt(), 90); out.turn = nt().angle;
    app.ev("noteColor")(S.pieces[0], nt(), "#d55e00"); out.col = nt().color;
    app.ev("noteCopy")(S.pieces[0], nt()); out.copy = [S.pieces[0].notes.length, S.pieces[0].notes[1].angle, S.pieces[0].notes[1].color];
    app.ev("noteLinkStart")(S.pieces[0], nt());
    const q = app.ev("toS")({ x: 250, y: 100 }); app.ev("noteLinkClick")(q.x, q.y);
    const P = S.pieces[0], pose = app.ev("notePose")(P, nt());
    out.link = [!!nt().link, Math.round(pose.at.x), Math.round(pose.at.y), Math.round(pose.rot*180/Math.PI)];
    out.steps = S.un.map(x => x.n);
    out.norm = app.ev("normNote")({ text: "x", x: 1, y: 2, angle: 360, color: "#1c4f8a", link: { sid: "a" } });
    return new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); })
      .then((b) => new Promise((res) => app.ev("zipUnpack")(b, (e, p) => res(p)))).then((parts) => app.ev("pdraftDoc")(parts))
      .then((d) => { out.file = [d.v, d.pieces[0].notes[0].angle, d.pieces[0].notes[0].color, !!d.pieces[0].notes[0].link]; app.undo(); out.undone = !!S.pieces[0].notes[0].link; return out; });` });
  assert.strictEqual(o.turn, 90); assert.strictEqual(o.col, "#d55e00");
  assert.deepStrictEqual(o.copy, [2, 90, "#d55e00"]);
  assert.deepStrictEqual(o.link, [true, 250, 100, 90], "at the top line's middle, along it, turned 90 more");
  assert.deepStrictEqual(o.steps, ["Rotate Annotation", "Annotation Color", "Copy Annotation", "Link Annotation"]);      // (Round r27: one spelling, the American of the rows from the references)
  assert.deepStrictEqual(o.norm, { text: "x", x: 1, y: 2 }, "the defaults and junk are not kept");
  assert.deepStrictEqual(o.file, [27, 90, "#d55e00", true]);      // (the file's version: 27 since Round r29; 26 since Round r26, 25 since Round r25) assert.strictEqual(o.undone, false);
});

/* ---- Batch 6 (rest), 11 (part) ---- */
test("r20 / 6, 11: Show Grading writes every shown size's name; Grading Review's 2D Measurements in each tile's size; Window ▸ Render opens the Render box", () => {
  const o = boot({ blank: true, script: `
    const out = {};
    app.ev("addBlock")("skirt", "simple", null, { x: 0, y: 0 });
    const A = S.pieces[0], G = S.grading, g = G.groups[0], base = g.base;
    for (const z of g.sizes) if (z.id !== base) { const k = g.sizes.findIndex(x => x.id === z.id) - g.sizes.findIndex(x => x.id === base); app.ev("setPtDelta")(G, A, A, 1, z.id, 10*k, 0); }
    S.measures.push({ id: 1, a: { piece: A.id, sid: A.segs[0].id, t: 0 }, b: { piece: A.id, sid: A.segs[1].id, t: 0 } }); app.commit();
    const cx = app.ev("ctx"), texts = []; cx.fillText = (s) => texts.push(s);
    const names = g.sizes.map(z => z.name);
    app.ev("setView")("grading", true); texts.length = 0; app.draw(); out.names = names.filter(n => texts.includes(n)).length;
    app.ev("setView")("grading", false); texts.length = 0; app.draw(); out.namesOff = names.filter(n => texts.includes(n)).length;
    app.ev("gradingReview")(); app.ev("reviewSt").info.meas = true; app.ev("gradingReview")();
    const html = app.el("review").innerHTML; out.meas = (html.match(/stroke="#0072b2"/g) || []).length;
    let opened = false; const was = app.ev("renderDialog"); 
    const rows = []; const walk = (L) => { for (const r of L || []) { if (r && r.n) rows.push(r); if (r && typeof r.menu === "function") walk(r.menu()); } };
    walk(app.ev("menuDisplay")()); const r = rows.find(x => x.n === "Render"); out.render = !!r && typeof r.f === "function" && !r.nb;
    return out;` });
  assert.ok(o.names >= 4, "every shown size's name: " + o.names); assert.ok(o.namesOff <= 1, "off: the picked size's at most");
  assert.ok(o.meas >= 4, "a measurement in each tile: " + o.meas);
  assert.strictEqual(o.render, true);
});

/* ---- Batch 5: pleats ---- */
// (Round r25: Pleats Fold and Pleats Sewing were removed, the maintainer's decision after the third check session; their test went with them)

/* ---- Batch 6 (rest): a size's Lock, the Calculator NotePad, a notch's Direction ---- */
test("r20 / 6: a locked size takes no grading edit (one step to lock, kept in the file); the Calculator NotePad works sums of named points of measure; a corner notch's Direction ▸ Segment 2 cuts it square to the other line", () => {
  const o = boot({ blank: true, streams: true, script: DOC + `
    const G = S.grading, g = G.groups[0], z = g.sizes.find(x => x.id !== g.base);
    z.lock = true; app.commit();
    out.lock = [app.ev("setPtDelta")(G, A, A, 1, z.id, 10, 0), !!(A.grade && A.grade.pts && Object.keys(A.grade.pts).length)];
    out.norm = app.ev("normGrading")(JSON.parse(JSON.stringify(G))).groups[0].sizes.filter(x => x.lock).length;
    S.measures.push({ id: 1, name: "Top", a: { piece: A.id, sid: A.segs[0].id, t: 0 }, b: { piece: A.id, sid: A.segs[1].id, t: 0 } }, { id: 2, name: "Side", a: { piece: A.id, sid: A.segs[1].id, t: 0 }, b: { piece: A.id, sid: A.segs[2].id, t: 0 } });
    app.commit();
    out.calc = [app.ev("calcEval")("[Top] - [Side]/2").v, app.ev("calcEval")("([top] + 10) * 2").v, app.ev("calcEval")("[Nope]").err];
    // a notch at the corner between the top and the right side, cut square to the right side
    A.segs[0].notches = [{ t: 1, dir: "other" }]; app.commit();
    const st = { ...S.notch, dup: false, type: "I" }, end = (m) => JSON.stringify(m).match(/-?[0-9.]+/g).map(Number);
    const with2 = app.ev("notchMarksFresh")(A, st); A.segs[0].notches = [{ t: 1 }]; const with1 = app.ev("notchMarksFresh")(A, st); A.segs[0].notches = [{ t: 1, dir: "other" }];
    out.differ = JSON.stringify(with1) !== JSON.stringify(with2);
    out.nd = [JSON.stringify(A.segs[0].notches[0]), app.ev("normNotchAt")({ t: 0.5, dir: "other" })];
    return out;` });
  assert.deepStrictEqual(o.lock, [false, false], "the locked size's offset is refused");
  assert.strictEqual(o.norm, 1, "kept by the file's reading");
  assert.deepStrictEqual(o.calc, [200, 620, "No point of measure called Nope"]);
  assert.deepStrictEqual([JSON.parse(o.nd[0]), o.nd[1]], [{ t: 1, dir: "other" }, 0.5], "kept at a corner; mid-line a notch has no Direction: " + JSON.stringify(o.nd));
  assert.strictEqual(o.differ, true, "Segment 2 cuts the corner notch another way");
});

test("r20 / 9: File ▸ Export ▸ OBJ writes each pattern's draped cloth as an object (points, texture places, triangles); OBJ (Selected) only the selected", () => {
  const o = boot({ blank: true, three: true, script: SEWN3 + `
    const r = app.ev("objText")(false), L = r.text.split(String.fromCharCode(10));
    const pts = [...G3.items.values()].reduce((n, it) => n + it.X.length/3, 0), tris = [...G3.items.values()].reduce((n, it) => n + it.mesh.tri.length/3, 0);
    out.all = [r.n, L.filter(l => /^o /.test(l)).length, L.filter(l => /^v /.test(l)).length === pts, L.filter(l => /^vt /.test(l)).length === pts, L.filter(l => /^f /.test(l)).length === tris];
    // every face's index within the points written
    out.ok = L.filter(l => /^f /.test(l)).every(l => l.slice(2).split(" ").every(x => +x.split("/")[0] >= 1 && +x.split("/")[0] <= pts));
    S.sel = [A.id]; out.sel = app.ev("objText")(true).n;
    let file = null; app.setDownload((n, b) => { file = n; }); app.answer = () => ({ kind: "multi" }); app.ev("exportOBJ")(false); app.answer = null; out.file = file;      // (Round r25: the box asks Single or Multiple Objects first)
    return out;` });
  assert.deepStrictEqual(o.all, [2, 2, true, true, true]); assert.strictEqual(o.ok, true);
  assert.strictEqual(o.sel, 1); assert.strictEqual(o.file, "garment.obj");
});

test("r20 / 8: Plotter (PLT) writes Print Layout's marker as HP-GL: the roll's width across, its length along X, a pen per line kind, the outline cut with the cutter when asked; the Plotter box's settings are kept", () => {
  const o = boot({ script: DOC + `
    app.setMode("layout"); S.layout.paper = "rollc"; S.layout.customW = 1500; S.layout.margin = 10; app.layoutCmd("row");
    let file = null, text = ""; app.setDownload((n, b) => { file = n; text = typeof b === "string" ? b : ""; });
    const pt = app.ev("pltText"), NL = String.fromCharCode(10);
    const r = pt(app.ev("layFabNow")()), L = r.text.split(NL);
    out.head = [L[0], L[1]]; out.end = L[L.length - 2];
    // every coordinate: X along the roll (0 .. its length), Y across it (within the roll's width), in plotter units (40 a mm)
    const xy = r.text.match(/-?[0-9]+,-?[0-9]+/g).map(c => c.split(",").map(Number));
    out.across = Math.max(...xy.map(c => c[1])) <= (1500 + 10)*40 && Math.min(...xy.map(c => c[1])) >= 0;
    out.pens = [...new Set(r.text.match(/SP[0-9]/g))];
    out.label = /LBA/.test(r.text) && /LBB/.test(r.text);
    // the outline's own pen; the cutter on the outline
    S.print.plot = { ...S.print.plot, pens: { outline: 3 }, cut: true, cutter: 4 };
    const r2 = pt(app.ev("layFabNow")()).text;
    out.pens2 = [...new Set(r2.match(/SP[0-9]/g))]; out.cutLast = r2.lastIndexOf("SP4;") > r2.lastIndexOf("SP3;");
    // the box: Unit typed, a line's pen chosen, kept in the print's settings
    app.ev("plotterDialog")(); const dlg = app.el("dlg");
    dlg.onchange({ target: { dataset: { pl: "unit" }, value: "0.1" } }); dlg.onchange({ target: { dataset: { pp: "notch" }, value: "5" } });
    dlg.onchange({ target: { dataset: { pl: "dev" }, value: "plt" } });
    out.kept = [S.print.plot.unit, S.print.plot.pens.notch, S.print.plot.dev, JSON.parse(app.ev("localStorage").getItem("pdraft:print")).plot.unit];
    const r3 = pt(app.ev("layFabNow")()).text, xy3 = r3.match(/-?[0-9]+,-?[0-9]+/g).map(c => c.split(",").map(Number));
    out.unit = Math.max(...xy3.map(c => c[1])) <= (1500 + 10)*10;
    app.ev("exportPLT")(); out.file = file; out.written = /^IN;/.test(text);
    out.rows = app.ev("menuFile")().find(x => x.n === "Export").menu().some(x => x.n === "Plotter (PLT)" && typeof x.f === "function" && !x.nb);
    return out;` });
  assert.deepStrictEqual(o.head, ["IN;", "PA;"]); assert.strictEqual(o.end, "PU;SP0;");
  assert.strictEqual(o.across, true, "within the roll's width");
  assert.deepStrictEqual(o.pens, ["SP1", "SP0"], "every line with the Pen (1), then the pen put away");
  assert.strictEqual(o.label, true, "each pattern's name as a label");
  assert.deepStrictEqual(o.pens2, ["SP3", "SP1", "SP4", "SP0"]); assert.strictEqual(o.cutLast, true, "cut after everything is drawn");
  assert.deepStrictEqual(o.kept, [0.1, 5, "plt", 0.1]); assert.strictEqual(o.unit, true, "10 units a mm");
  assert.strictEqual(o.file, "pattern-layout.plt"); assert.strictEqual(o.written, true); assert.strictEqual(o.rows, true);
});

/* ---- Batch 7 ---- */
const pick = `const row = (n) => { const it = app.menu.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes(n + "<" + "/span>")); if (!it) throw new Error("no row " + n); it.onclick({ stopPropagation() {} }); };`;
const round = `const again = () => { const d = JSON.parse(JSON.stringify(app.ev("docObj")())); app.loadDoc(d); return d; };`;
test("r20 / 7: a topstitch's specification: Stitch Count rows a Distance apart, stitches per inch and thread; one step each, kept in the file only when set", () => {
  const o = boot({ script: DOC + pick + round + `
    app.setTool("segment_topstitch"); app.click(400, 200); const st = S.stitches[0];
    const rows = () => app.ev("stitchRows")(S.stitches[0]).length;
    out.one = [rows(), "count" in st];
    app.setTool("edit_topstitch"); S.selStitch = st.id; app.ev("ui")();
    const g = (id) => app.el(id), n = S.un.length;
    g("st-cnt").onchange({ target: { value: "3" } }); g("st-gap").onchange({ target: { value: "4" } }); g("st-len").onchange({ target: { value: "2.54" } });
    out.set = [S.stitches[0].count, S.stitches[0].gap, S.stitches[0].spi, rows(), S.un.length - n];
    const r = app.ev("stitchRows")(S.stitches[0]), dx = Math.abs(r[1][0].x - r[0][0].x);
    out.gap = +dx.toFixed(3);
    const d = again(); out.file = [d.stitches[0].count, d.stitches[0].spi, S.stitches[0].count];
    app.undo(); out.undo = S.stitches[0].spi === undefined;
    return out;` });
  assert.deepStrictEqual(o.one, [1, false], "one row by default, nothing kept");
  assert.deepStrictEqual(o.set, [3, 4, 10, 3, 3], "three rows, 4 mm apart, 2.54 mm stitches = 10 to the inch; a step each");
  assert.strictEqual(o.gap, 4, "the second row 4 mm further in");
  assert.deepStrictEqual(o.file, [3, 10, 3]); assert.strictEqual(o.undo, true);
});

test("r20 / 7: puckering: Segment, Free and Seamline Puckering mark the edge, Edit Puckering selects, changes and deletes; one step each, kept in the file, drawn with Show Puckerings", () => {
  const o = boot({ script: DOC + pick + round + `
    S.seams.push(sew(1, 3)); app.commit(); app.ev("setView")("sewing", true);
    app.setTool("segment_puckering"); app.click(250, 100); out.seg = [S.puckers.length, S.un[S.un.length - 1].n];
    app.setTool("free_puckering"); app.click(100, 150); app.click(100, 250); out.free = [S.puckers.length, +(S.puckers[1].part.t1 - S.puckers[1].part.t0).toFixed(2)];
    app.setTool("seamline_puckering"); app.click(400, 200); out.seam = [S.puckers.length, S.puckers.slice(2).map(x => x.side).join("")];
    // drawn as a wave: more points than its edge
    out.wave = app.ev("puckerWave")(S.puckers[0]).length > 20;
    app.setTool("edit_puckering"); app.click(250, 102); out.sel = S.selPucker === S.puckers[0].id;
    app.ev("puckerMenu")(250, 102, 250, 102); app.answer = () => ({ w: 8, d: 70 }); row("Properties…"); app.answer = null; out.look = app.ev("puckerLook")(S.puckers[0]);
    const d = again(); out.file = [d.puckers.length, S.puckers.length, S.puckers[2].seam === S.seams[0].id];
    S.selPucker = S.puckers[0].id; app.key("Delete"); out.del = S.puckers.length;
    app.undo(); out.undo = S.puckers.length;
    // the seam goes: its puckering with it
    S.seams.length = 0; app.commit(); out.gone = S.puckers.length;
    return out;` });
  assert.deepStrictEqual(o.seg, [1, "Segment Puckering"]);
  assert.deepStrictEqual(o.free, [2, 0.5], "half the left side");
  assert.deepStrictEqual(o.seam, [4, "ab"], "both sides of the seam");
  assert.strictEqual(o.wave, true); assert.strictEqual(o.sel, true); assert.deepStrictEqual(o.look, { width: 8, density: 70 });
  assert.deepStrictEqual(o.file, [4, 4, true]);
  assert.strictEqual(o.del, 3); assert.strictEqual(o.undo, 4); assert.strictEqual(o.gone, 2);
});

test("r20 / 7: Pattern Symbol marks a line with Place on Fold, Gather, Ease or Stretch (one step, None takes it off), drawn in 2D and in print", () => {
  const o = boot({ script: DOC + pick + round + `
    app.setTool("pattern_symbol"); app.ev("symbolClick")(250, 300, { clientX: 250, clientY: 300 }); row("Gather");
    out.sym = [A.segs[2].sym, S.un[S.un.length - 1].n];
    out.print = (app.ev("printInner")([A], S.print, "mm").match(/data-layer="internal"/g) || []).length;
    out.paths = app.ev("patternSymbols")(A).length;
    const d = again(); out.file = d.pieces[0].segs[2].sym;
    app.ev("symbolClick")(250, 300, { clientX: 250, clientY: 300 }); row("None"); out.none = S.pieces[0].segs[2].sym === undefined;
    return out;` });
  assert.deepStrictEqual(o.sym, ["gather", "Pattern Symbol"]); assert.ok(o.print >= 1, "in print"); assert.strictEqual(o.paths, 1);
  assert.strictEqual(o.file, "gather"); assert.strictEqual(o.none, true);
});

test("r20 / 7: a graphic's Custom Measurements place it by its distances to the outline (one step); Tile X / Y / Pattern repeat it; Face Both and Back are kept", () => {
  const o = boot({ script: DOC + pick + round + `
    S.images.push({ id: 1, name: "logo.png", data: "", w: 10, h: 10 /* (no picture: the placement is what is tested) */ });
    app.push(); const g = app.ev("placeGraphic")(A, S.images[0], { w: 20, h: 10, mode: "center" }); app.commit();
    app.answer = (fields) => ({ l: 50, u: 30 }); app.ev("gfxMeasNumeric")({ x: 0, y: 0 }, A, S.pieces[0].graphics[0]); app.answer = null;
    const g1 = S.pieces[0].graphics[0]; out.at = [g1.x, g1.y, S.un[S.un.length - 1].n];
    const tiles = (t) => { g1.tile = t; return app.ev("gfxTiles")(S.pieces[0], g1).length; };
    out.tiles = [tiles("none"), tiles("x") > 10, tiles("y") > 15, tiles("repeat") > tiles("x")];
    g1.tile = "x"; g1.face = "both"; const d = again(); out.file = [d.pieces[0].graphics[0].tile, d.pieces[0].graphics[0].face, S.pieces[0].graphics[0].face];
    return out;` });
  assert.deepStrictEqual(o.at, [150, 130, "Custom Measurements"], "50 from the left side, 30 from the top");
  assert.deepStrictEqual(o.tiles, [1, true, true, true]);
  assert.deepStrictEqual(o.file, ["x", "both", "both"]);
});

/* ---- Batch 9, the rest ---- */
const SEW9 = `
    S.seams.push(app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true)); app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
`;
test("r20 / 9: Archive takes a pattern out of the 3D garment (not simulated, its seams left out, hidden unless Show Archived Pattern); Flip Normal swaps its faces (its folds the other way); one step each", () => {
  const o = boot({ blank: true, three: true, script: SEWN3 + SEW9 + `
    S.sel = [A.id]; app.ev("state3Toggle")("arch3");
    const it = G3.items.get(A.id); app.ev("garmentSync")();
    out.arch = [!!S.pieces[0].arch3, S.un[S.un.length - 1].n, app.simSeams(S.pieces.map(p => p.id)).every(x => x.skip), it.obj.visible];
    app.ev("setShow3")("arch3", true); app.ev("garmentSync")(); out.shown = [G3.items.get(A.id).obj.visible, G3.items.get(A.id).obj.material.opacity < 1];
    out.name = app.ev("state3Name")("arch3");
    app.undo(); out.undone = !S.pieces[0].arch3;
    // Flip Normal: a fold at 90 folds at 270
    const a = S.pieces[0]; a.internals.push(app.mkShape([{ x: 150, y: 0 }, { x: 150, y: 400 }], false)); app.commit(); const ln = a.internals[0]; ln.foldAngle = 90; app.commit();
    S.sel = [a.id]; const before = app.ev("foldsOf")(a)[0].a0; app.ev("state3Toggle")("flip3"); out.flip = [before, app.ev("foldsOf")(S.pieces[0])[0].a0, S.un[S.un.length - 1].n];
    return out;` });
  assert.deepStrictEqual(o.arch, [true, "Archive", true, false]);
  assert.deepStrictEqual(o.shown, [true, true], "with Show Archived Pattern, see-through");
  assert.strictEqual(o.name, "Unarchive"); assert.strictEqual(o.undone, true);
  // (Round r26, the fourth check session Number 13a: Flip Normal leaves a fold alone; it turned it, 270, until then)
  assert.deepStrictEqual(o.flip, [90, 90, "Flip Normal"]);
});

test("r20 / 9: Fold Rendering draws a fold line on the cloth as a crease; Show Graphics switches the cloth's graphics; Detach All Pins from Avatar makes the pins' tacks pins again", () => {
  const o = boot({ blank: true, three: true, script: SEWN3 + `
    const a = S.pieces[0]; a.internals.push(app.mkShape([{ x: 150, y: 0 }, { x: 150, y: 400 }], false)); a.internals[0].foldRender = true; app.commit();
    out.crease = app.ev("clothLineList")(a, G3.items.get(a.id)).map(l => l.kind);
    const sig = app.ev("paintSig"); const s0 = sig(a); app.ev("setShow3")("gfx3", false); out.gfx = [s0 !== sig(a), app.ev("show3")("gfx3")];
    // attach needs an avatar: it says so and changes nothing
    a.pins = [{ x: 10, y: 10 }]; app.commit(); const n = S.un.length; app.ev("attachPins3")(); out.noav = [S.un.length === n, !!S.pieces[0].pins];
    // pins' tacks back to pins
    S.tacks = [{ id: 1, a: { piece: a.id, x: 20, y: 30 }, b: null, av: { x: 0, y: 1000, z: 0 }, pin: true }, { id: 2, a: { piece: a.id, x: 50, y: 30 }, b: null, av: { x: 0, y: 1000, z: 0 } }];
    delete S.pieces[0].pins; app.commit();
    const kept = app.ev("normTacks")(JSON.parse(JSON.stringify(S.tacks)))[0].pin;
    app.ev("detachPins3")(); out.detach = [S.tacks.length, S.pieces[0].pins, S.un[S.un.length - 1].n, kept];
    return out;` });
  assert.ok(o.crease.includes("crease"), "a crease"); assert.deepStrictEqual(o.gfx, [true, false], JSON.stringify(o));
  assert.deepStrictEqual(o.noav, [true, true], JSON.stringify(o));
  assert.deepStrictEqual(o.detach, [1, [{ x: 20, y: 30 }], "Detach All Pins from Avatar", true], JSON.stringify(o));
});

test("r20 / 9: Superimpose (Over) lays a pattern onto the one it is sewn to, facing as it faces, 8 mm outwards; Under 8 mm inwards; Ctrl+[ and Ctrl+] are its keys; one step", () => {
  const o = boot({ blank: true, three: true, script: SEWN3 + SEW9 + `
    const fr = app.ev("clothFrame3"), cen = (p) => fr(G3.items.get(p.id));
    S.sel = [A.id]; app.ev("superimpose3")("over");
    const a = cen(S.pieces[0]), b = cen(S.pieces[1]), d = [0, 1, 2].map(k => a.c[k] - b.c[k]);
    out.over = [+Math.hypot(...d).toFixed(1), +Math.abs(a.n[0]*b.n[0] + a.n[1]*b.n[1] + a.n[2]*b.n[2]).toFixed(3), S.un[S.un.length - 1].n];
    // outwards: further from the axis (x 0, z 0) than the target
    out.out = Math.hypot(a.c[0], a.c[2]) > Math.hypot(b.c[0], b.c[2]);
    app.undo(); S.sel = [S.pieces[0].id]; app.ev("superimpose3")("under");
    const a2 = cen(S.pieces[0]), b2 = cen(S.pieces[1]); out.under = Math.hypot(a2.c[0], a2.c[2]) < Math.hypot(b2.c[0], b2.c[2]);
    out.keys = [app.keyOf("superOver"), app.keyOf("superUnder")];
    return out;` });
  assert.deepStrictEqual(o.over, [8, 1, "Superimpose (Over)"]); assert.strictEqual(o.out, true); assert.strictEqual(o.under, true);
  assert.deepStrictEqual(o.keys, ["Ctrl+[", "Ctrl+]"]);
});

/* ---- Batch 10 ---- */
test("r20 / 10: a long right-click menu has a search field: what is typed keeps the rows (its submenus' too) whose names hold it, Enter runs the first; the menu bar's menus have none", () => {
  const o = boot({ script: DOC + `
    const rows = Array.from({ length: 12 }, (_, k) => ({ n: "Row " + k, f: () => { out.ran = k; } }));
    rows.push({ n: "Sub", menu: () => [{ n: "Deep Row", f: () => { out.ran = "deep"; } }, { n: "Grey", off: true, f: () => {} }] });
    app.menu.children.length = 0; app.ev("listMenu")(rows, 10, 10);
    const box = app.menu.children[0]; out.box = box.className;
    const inp = box.querySelector("input"); inp.value = "deep"; inp.oninput();
    out.found = app.menu.children.filter(c => /mi/.test(c.className || "")).map(c => c.innerHTML.replace(/<[^>]*>/g, ""));
    inp.value = "deep"; inp.onkeydown({ key: "Enter" });
    // a short menu: none
    app.menu.children.length = 0; app.ev("listMenu")(rows.slice(0, 3), 10, 10); out.short = app.menu.children.some(c => c.className === "msearch");
    app.menu.children.length = 0; app.ev("listMenu")(rows, 10, 10, false, true); out.bar = app.menu.children.some(c => c.className === "msearch");
    return out;` });
  assert.strictEqual(o.box, "msearch");
  assert.deepStrictEqual(o.found, ["Sub ▸ Deep Row"]); assert.strictEqual(o.ran, "deep");
  assert.strictEqual(o.short, false); assert.strictEqual(o.bar, false);
});

test("r20 / 10: Blend Shape's Show Selected Only lists the rows selected by a click on their names; with Show Favorites Only, both apply", () => {
  const o = boot({ script: DOC + `
    S.av = { name: "Own", meshes: [{ name: "Body", morphTargetDictionary: { Tall: 0, Wide: 1, Long: 2 }, morphTargetInfluences: [0, 0, 0] }] };
    const body = app.ev("AVED_BODY").blend, G = app.G3, n = () => (body().match(/data-bm=/g) || []).length;
    out.all = n(); G.blendSel = ["Body/Wide", "Body/Long"]; G.blendSelOnly = true; out.sel = n(); out.marked = /aria-selected="true"[^>]*>▸ Wide/.test(body());
    S.ui.blendFav = ["Body/Long"]; G.blendFavOnly = true; out.both = n();
    S.av = null;
    return out;` });
  assert.deepStrictEqual([o.all, o.sel, o.both], [3, 2, 1]); assert.strictEqual(o.marked, true, "selected by a mark as well, not by colour alone");
});

/* ---- Batch 11 ---- */
test("r20 / 11: File ▸ Information ▸ Garment counts the document, File History lists its steps; Show Auto Save Time writes when the autosave ran; F9 shows the 3D window's size; Format 3D Background keeps a colour", () => {
  const o = boot({ script: DOC + `
    S.seams.push(sew(1, 3)); app.commit(); app.push("Rename"); app.commit();
    const g = app.ev("infoGarment")(); out.garment = [/Patterns<[/]label><span class="w">2</.test(g), /Seams<[/]label><span class="w">1 /.test(g), /m²/.test(g)];
    const h = app.ev("infoHistory")(); out.hist = /Rename/.test(h) && /step/.test(h);
    S.ui.autoTime = true; app.ev("saveState")("ok"); out.time = /^AUTOSAVED [0-9][0-9]:[0-9][0-9]:[0-9][0-9]$/.test(app.el("s-save").textContent);
    out.f9 = app.keyOf("size3");
    app.promptAnswer = "#ffffff"; app.ev("bg3Dialog")(); out.bg = S.ui.bg3; app.promptAnswer = "reset"; app.ev("bg3Dialog")(); out.reset = S.ui.bg3 === undefined; app.promptAnswer = undefined;
    out.rows = app.ev("menuFile")().find(x => x.n === "Information").menu().map(x => x.n);
    return out;` });
  assert.deepStrictEqual(o.garment, [true, true, true]); assert.strictEqual(o.hist, true); assert.strictEqual(o.time, true);
  assert.strictEqual(o.f9, "F9"); assert.strictEqual(o.bg, "#ffffff"); assert.strictEqual(o.reset, true);
  assert.deepStrictEqual(o.rows, ["Garment…", "File History…"]);
});

module.exports = T;
