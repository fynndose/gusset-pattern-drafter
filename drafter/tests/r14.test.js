// Round r14. 1: a right-click while dragging a point acts on the right button's press (the browser's menu event comes at the
// press on Linux, at the release on Windows). Batches 2 and on: one feature (or a small group) each, from the inventory's
// class A list.
"use strict";
const FV = require("./harness").FILE_VERSION;      // (Round H1) this build's file version, read from the app's FILE_VERSION
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  // long options go through a file: a Windows command line holds at most 32 767 characters
  let arg = JSON.stringify(opt || {});
  if (arg.length > 30000) { const f = path.join(require("os").tmpdir(), "pdraft-boot-r14-" + process.pid + ".json"); fs.writeFileSync(f, arg); arg = "@" + f; }
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), arg], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// two rectangles, A at x 0…200 and B at x 300…500, both 400 high
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
  const B = app.mkPiece("B", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:400},{x:300,y:400}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const at = (x, y) => app.toS({ x, y }), out = {};
  const click = (x, y, o) => { const s = { ...at(x, y), ...(o || {}) }; app.fire("pointermove", s); app.fire("pointerdown", s); app.fire("pointerup", s); };
  const steps = () => app.histSteps().steps.map(s => s.n);
  const sub = (items, n) => items.filter(Boolean).find(x => x.n === n).menu().filter(Boolean);
`;
// a front and a back, sewn at both sides, in the 3D window
const SEWN = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] });
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 });
  const steps = () => app.histSteps().steps.map(s => s.n);
  const sub = (items, n) => items.filter(Boolean).find(x => x.n === n).menu().filter(Boolean);
`;

/* ---------- 1: a right-click while dragging a point ---------- */
test("r14 / 1: a right press while dragging a point opens Moving Distance at once (before any menu event); the menu event that follows, at the press (Linux) or at the release (Windows), opens no menu and is kept from the browser", () => {
  const o = boot({ blank: true, script: DOC + `
    app.setTool("edit_pattern");
    const cv = app.ev("cv"), a = at(200, 400), b = at(220, 430);
    let dlg = null; app.answer = (t, f) => { dlg = t; return null; };
    // the left button drags the corner; the right goes down while the left is held (a mousedown, no pointerdown)
    app.fire("pointermove", a); app.fire("pointerdown", a); app.fire("pointermove", b);
    const md = { button: 2, buttons: 3, target: cv, clientX: b.x, clientY: b.y, preventDefault() {}, stopPropagation() {} };
    app.winFire("mousedown", md);
    out.atPress = [dlg, S.drag];
    // the browser's menu event, whenever it comes: swallowed once, not a second dialog or a menu
    dlg = null; let prevented = false, stopped = false;
    app.winFire("contextmenu", { button: 2, target: cv, clientX: b.x, clientY: b.y, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    out.late = [dlg, prevented, stopped, app.ev("menu").style.display];
    // the next right-click on the canvas is an ordinary one again (its menu event is not swallowed)
    app.winFire("mousedown", { ...md, buttons: 2 });
    prevented = false; stopped = false;
    app.winFire("contextmenu", { button: 2, target: cv, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    out.next = [prevented, stopped];
    // a right press with no drag going on: nothing happens at the press (the menu comes with the menu event, as ever)
    dlg = null; app.winFire("mousedown", { ...md, buttons: 2 }); out.noDrag = dlg;
    // the corner did not move: the partial drag was rolled back
    const A2 = S.pieces[0]; out.pt = [A2.pts[2].x, A2.pts[2].y];      // (undo replaces the objects)
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.atPress, ["Moving Distance", null], "the dialog opened at the right press, the drag ended");
  assert.strictEqual(r.late[0], null, "no second dialog");
  assert.deepStrictEqual(r.late.slice(1), [true, true, "none"], "the menu event swallowed: no browser menu, no menu of ours");
  assert.deepStrictEqual(r.next, [true, false], "the next right-click: the browser's menu kept out as ever, the event goes on to the program");
  assert.strictEqual(r.noDrag, null);
  assert.deepStrictEqual(r.pt, [200, 400]);
});

/* ---------- 2: the fold angle of an internal line ---------- */
const C = require("../drafter-sim.js");
// a w × h sheet of cloth as a flat mesh, corner at (0, 0) on the pattern
function sheet(w, h, res, lines) {
  const pts = [], nx = Math.round(w/res), ny = Math.round(h/res);
  for (let i = 0; i < nx; i++) pts.push([i*res, 0]); for (let j = 0; j < ny; j++) pts.push([w, j*res]);
  for (let i = 0; i < nx; i++) pts.push([w - i*res, h]); for (let j = 0; j < ny; j++) pts.push([0, h - j*res]);
  return C.meshPolygon(pts, res, null, lines);
}
// laid as the app lays a pattern facing forward: (x, y on the page) -> (x, -y, 0), its front towards +z
const layFlat = (m) => { const n = m.xy.length/2, X = new Float32Array(3*n); for (let i = 0; i < n; i++) X.set([m.xy[2*i], -m.xy[2*i+1], 0], 3*i); return X; };
// the sheet folded along x = 150 with no gravity: at each fold edge (the cloth is meshed along the line) the angle round the
// edge from one side of the cloth to the other, through the front of the first side: 180 flat, +90 a square corner towards
// the front, -90 towards the back; the mean over the edges whose middle lies in each band of rows (y on the pattern)
function foldRun(folds, rows, frames) {
  const m = sheet(300, 200, 10, folds.map(f => f.L)), sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: layFlat(m), fab: { weight: 150, bend: 1000 }, folds }], opt: { gravity: 0, ground: false, self: false, easeIn: 0 } });
  for (let k = 0; k < (frames || 400); k++) C.clothStep(sim, 1/60);
  const x = sim.x, Q = sim.fQ, out = rows.map(() => []);
  for (let q = 0; q < Q.length/4; q++) {
    const [a, b, c, d] = [0, 1, 2, 3].map(k => 3*Q[4*q + k]), e = [x[b] - x[a], x[b+1] - x[a+1], x[b+2] - x[a+2]], el = Math.hypot(...e), E = e.map(v => v/el);
    const off = (k) => { const r = [x[k] - x[a], x[k+1] - x[a+1], x[k+2] - x[a+2]], t = r[0]*E[0] + r[1]*E[1] + r[2]*E[2]; return r.map((v, i) => v - t*E[i]); };
    const pc = off(c), pd = off(d), rc = Math.hypot(...pc), u = pc.map(v => v/rc), v = [E[1]*u[2] - E[2]*u[1], E[2]*u[0] - E[0]*u[2], E[0]*u[1] - E[1]*u[0]];
    const beta = Math.atan2(pd[0]*v[0] + pd[1]*v[1] + pd[2]*v[2], pd[0]*u[0] + pd[1]*u[1] + pd[2]*u[2])*180/Math.PI;
    const ym = (m.xy[2*Q[4*q]+1] + m.xy[2*Q[4*q+1]+1])/2;
    rows.forEach(([y0, y1], k) => { if (ym >= y0 && ym <= y1) out[k].push(beta); });
  }
  return { edges: Q.length/4, at: out.map(l => l.reduce((s, v) => s + v, 0)/l.length) };
}
test("r14 / 2: the solver folds the cloth along a fold line: 90° is a square corner back towards back, 270° front towards front, 0° folded flat; Variable tapers to flat at the other end; 180° changes nothing", () => {
  const line = Array.from({ length: 21 }, (_, j) => [150, 10*j]), whole = [[0, 200]];
  const f90 = foldRun([{ L: line, a0: 90, a1: 90, k: 2000 }], whole), f270 = foldRun([{ L: line, a0: 270, a1: 270, k: 2000 }], whole);
  assert.strictEqual(f90.edges, 20, "the cloth has an edge from each point of the line to the next");
  near(f90.at[0], -90, 15, "90°: a square corner, towards the back"); near(f270.at[0], 90, 15, "270°: a square corner, towards the front");
  const f0 = foldRun([{ L: line, a0: 0, a1: 0, k: 40000 }], whole), f360 = foldRun([{ L: line, a0: 360, a1: 360, k: 40000 }], whole);
  assert.ok(f0.at[0] < 0 && f0.at[0] > -30, "0°: folded (nearly) flat, back against back: " + f0.at[0]);
  assert.ok(f360.at[0] > 0 && f360.at[0] < 30, "360°: front against front: " + f360.at[0]);
  // Variable: 90° at the line's start (y 0), flat at its end (y 200)
  const v = foldRun([{ L: line, a0: 90, a1: 180, k: 2000 }], [[0, 40], [160, 200]]);
  assert.ok(v.at[0] > -125 && v.at[0] < -80 && Math.abs(v.at[1]) > 150, "the start folded, the end nearly flat: " + v.at.map(a => a.toFixed(1)));
  const flat = foldRun([{ L: line, a0: 180, a1: 180, k: 2000 }], whole);
  assert.strictEqual(flat.edges, 0, "180° all along: no fold");
});

test("r14 / 2: an internal line's Fold in the Property Editor (Uniform / Variable, ⇄, Fold Angle, Fold Strength): each change one undo step 'Fold Angle', kept only when not the default, saved and opened; the line is drawn with its angle written; the solver gets it as a fold of its pattern", () => {
  const o = boot({ script: DOC + `
    return (async () => {
      const L = app.mkShape([{x:100,y:0},{x:100,y:400}], false); app.addChild(A, "internals", L); app.commit(); S.undo.length = 0; S.un.length = 0;
      app.setTool("edit_pattern"); click(100, 200); out.clickSteps = steps();      // (Round r15 / 1: a click that only selects leaves no step; this line used to clear the one it left)
      out.sel = [S.selKind, S.selInt];
      const pe = () => app.el("props").innerHTML, g = (id) => app.el(id);
      app.ev("ui")(); out.fields = ["fo-u", "fo-v", "fo-r", "fo-a", "fo-ar", "fo-k"].map(id => new RegExp('id="' + id + '"').test(pe())).concat([/id="fo-r"[^>]*disabled/.test(pe()), /Fold Rendering/.test(pe())]);
      g("fo-a").onchange({ target: { value: "90" } });
      const it = () => S.pieces[0].internals[0], keys = () => ["foldAngle", "foldStrength", "foldVar"].map(k => it()[k]);      // (a key not there comes back as null)
      out.a = keys(); out.note = /back toward back/.test(pe());      // (Round r27: one spelling in the program's text, the American of the menu rows taken from the references)
      g("fo-v").onclick(); out.v = keys(); g("fo-r").onclick(); out.r = keys();
      g("fo-k").onchange({ target: { value: "100" } }); out.k = keys();
      out.folds = app.ev("foldsOf")(S.pieces[0]).map(f => [f.L.length, f.L[0], f.L[f.L.length - 1], f.a0, f.a1, f.k]);
      out.steps = steps();
      // the label at the line's middle, on the canvas
      const said = []; const ctx = app.ev("ctx"), ft = ctx.fillText; ctx.fillText = (t, x, y) => { said.push(t); return ft && ft.call(ctx, t, x, y); }; app.ev("draw")(); ctx.fillText = ft;
      out.label = said.filter(t => /→/.test(t));      // (the hovered line's own readout also writes degrees)
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      const fd = app.fileDoc(file); out.inFile = [fd.v, ["foldAngle", "foldStrength", "foldVar"].map(k => fd.pieces[0].internals[0][k])];
      app.ev("openFile")("f.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened f/.test(x)), "the file to open");
      out.opened = keys();
      // back to flat and Uniform, strength 5: the keys go
      app.setTool("edit_pattern"); click(100, 200);
      app.ev("setFold")({ angle: 180, strength: 5, v: 0 }); out.flat = keys(); out.noFolds = app.ev("foldsOf")(S.pieces[0]).length;
      app.undo(); out.undone = keys();
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.sel, ["internal", 0]);
  assert.deepStrictEqual(o.clickSteps, [], "the selecting click left no step (Round r15 / 1)");
  assert.deepStrictEqual(o.fields, [true, true, true, true, true, true, true, true], "the fields, ⇄ greyed while Uniform, Fold Rendering (not built yet) with the switch on");
  assert.deepStrictEqual(o.a, [90, null, null]); assert.strictEqual(o.note, true);
  assert.deepStrictEqual(o.v, [90, null, 1], "Variable: the angle at the line's start");
  assert.deepStrictEqual(o.r, [90, null, -1], "⇄: at its end");
  assert.deepStrictEqual(o.k, [90, 100, -1]);
  assert.deepStrictEqual(o.folds, [[21, [100, 0], [100, 400], 180, 90, 40000]], "points the cloth's 20 mm apart; flat at the start, 90° at the end; 100 × FOLD_K");
  assert.deepStrictEqual(o.steps, ["Fold Angle", "Fold Angle", "Fold Angle", "Fold Angle"]);
  assert.deepStrictEqual(o.label, [], "no angle written: a fold line looks like any internal line (Round r15 / 7, the check videos; it was \"180° → 90°\")");
  assert.deepStrictEqual(o.inFile, [FV, [90, 100, -1]]);      // (Round H1: this build's version read from the app, FV) ((Round H1a: version 31) (Round r34: version 30) ((Round r33b: version 29) version 28 since Round r30 (a seam's mirror); 28 since Round r30, 27 since Round r29 (a document's render settings); 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2; 18 since Round r15)
  assert.deepStrictEqual(o.opened, [90, 100, -1]);
  assert.deepStrictEqual(o.flat, [null, null, null]); assert.strictEqual(o.noFolds, 0);
  assert.deepStrictEqual(o.undone, [90, 100, -1]);
});

test("r14 / 2: in the app, a pattern with a fold line is meshed along it and simulated with it (a pattern without one keeps the mesh it had)", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const before = G3.items.get(B.id).mesh.xy.length;
    const L = app.mkShape([{x:150,y:0},{x:150,y:400}], false); L.foldAngle = 90; app.addChild(A, "internals", L); app.commit(); app.ev("garmentSync")();
    const m = G3.items.get(A.id).mesh, onLine = [];
    for (let i = 0; i < m.xy.length/2; i++) if (Math.abs(m.xy[2*i] - 150) < 1e-9) onLine.push(m.xy[2*i+1]);
    out.line = onLine.length; out.B = G3.items.get(B.id).mesh.xy.length === before;
    app.ev("simBuild")(); const sim = app.SIM.sim; out.edges = sim.fB.length;
    for (let k = 0; k < 30; k++) app.ev("SIM3D").clothStep(sim, 1/60);
    out.finite = Array.from(sim.x).every(Number.isFinite);
    return out;` }).result;
  assert.ok(o.line >= 15, "the line's points (25 mm apart here) are mesh points: " + o.line);
  assert.strictEqual(o.B, true);
  assert.ok(o.edges >= 14, "the solver folds across the line's edges: " + o.edges);
  assert.strictEqual(o.finite, true);
});

/* ---------- 3: elastic on a line ---------- */
// one 300 × 100 pattern in the 3D window, no avatar, no gravity: the 3D length of its top line after a run, with the elastic given
const STRIP = (el) => `
  const out = {}, G3 = app.G3;
  app.ev("setLayout")("both");
  const A = app.mkPiece("Strip", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:100},{x:0,y:100}], true));
  ${el ? "A.segs[0].elastic = " + JSON.stringify(el) + ";" : ""}
  S.pieces.push(A); S.cloth = app.normCloth({ ...S.cloth, res: 10, substeps: 10, self: false, worker: false }); app.commit(); app.ev("garmentSync")();
  app.ev("simBuild")(); const sim = app.SIM.sim; sim.opt.gravity = 0; sim.opt.ground = false;
  // a ripple of a millimetre or two: a sheet exactly flat with nothing pulling it out of its plane never leaves it, and can't gather
  for (let i = 0; i < sim.n; i++) sim.x[3*i+2] += 1.5*Math.sin(sim.x[3*i]*0.21)*Math.cos(sim.x[3*i+1]*0.13);
  for (let k = 0; k < 300; k++) app.ev("SIM3D").clothStep(sim, 1/60);
  const ch = G3.items.get(A.id).mesh.chains.get(A.segs[0].id), x = sim.x;
  let len = 0; for (let k = 1; k < ch.length; k++) { const a = 3*ch[k-1].v, b = 3*ch[k].v; len += Math.hypot(x[a] - x[b], x[a+1] - x[b+1], x[a+2] - x[b+2]); }
  out.len = len; out.edges = Array.from(sim.eL).filter((L, c) => Math.abs(L - Math.hypot(sim.rest[2*sim.eI[c]] - sim.rest[2*sim.eJ[c]], sim.rest[2*sim.eI[c]+1] - sim.rest[2*sim.eJ[c]+1])) > 1e-6).length;
  return out;`;
test("r14 / 3: an elastic on a line draws it in, in 3D, to its ratio of the drawn length (Strength 10): ratio 100 leaves it as drawn, 60 gathers it, more strength gathers harder; strength 0 or no elastic: the cloth as it is", () => {
  const none = boot({ blank: true, three: true, script: STRIP(null) }).result, r100 = boot({ blank: true, three: true, script: STRIP({ k: 10, r: 100 }) }).result;
  const r60 = boot({ blank: true, three: true, script: STRIP({ k: 10, r: 60 }) }).result;
  const k0 = boot({ blank: true, three: true, script: STRIP({ k: 0, r: 60 }) }).result;
  assert.strictEqual(none.edges, 0); assert.strictEqual(k0.edges, 0, "strength 0: nothing");
  assert.ok(r60.edges >= 28, "the cloth's edges along the line are the elastic: " + r60.edges);
  near(none.len, 300, 3, "no elastic: as drawn"); near(r100.len, 300, 6, "ratio 100: as drawn");
  assert.ok(r60.len < 0.8*300, "ratio 60: drawn in: " + r60.len.toFixed(1));
  // the strength, in the solver: against a stiff (heavy woven) cloth a weak elastic draws its line in less
  const m = sheet(300, 100, 10), n = m.xy.length/2, top = [];
  for (let i = 0; i < n; i++) if (Math.abs(m.xy[2*i+1]) < 1e-9) top.push(i);
  top.sort((a, b) => m.xy[2*a] - m.xy[2*b]);
  const pull = (k) => {
    const X = layFlat(m); for (let i = 0; i < n; i++) X[3*i+2] = 1.5*Math.sin(m.xy[2*i]*0.21)*Math.cos(m.xy[2*i+1]*0.13);
    const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: { weight: 340, stretch: 1e7, bend: 50000 }, elastics: [{ i: top, r: 60, k }] }], opt: { gravity: 0, ground: false, self: false, easeIn: 0, substeps: 10 } });
    for (let f = 0; f < 300; f++) C.clothStep(sim, 1/60);
    let L = 0; for (let j = 1; j < top.length; j++) { const a = 3*top[j-1], b = 3*top[j]; L += Math.hypot(sim.x[a] - sim.x[b], sim.x[a+1] - sim.x[b+1], sim.x[a+2] - sim.x[b+2]); }
    return L;
  };
  const strong = pull(1e6), weak = pull(1e4);
  assert.ok(weak > strong + 5 && strong < 0.8*300, "strength 10 against 0.1 on a heavy woven: " + strong.toFixed(1) + " / " + weak.toFixed(1));
});

test("r14 / 3: the Elastic section (a selected line, outline or internal): Elastic, Strength, Ratio, Segment Length, and Total Length for several lines; each change one undo step 'Elastic'; strength and ratio greyed while off; drawn with its ratio; saved and opened", () => {
  const o = boot({ script: DOC + `
    return (async () => {
      const L = app.mkShape([{x:20,y:200},{x:180,y:200}], false); app.addChild(A, "internals", L); app.commit(); S.undo.length = 0; S.un.length = 0;
      app.setTool("edit_pattern"); click(100, 0); out.clickSteps = steps();      // (Round r15 / 1: a click that only selects leaves no step; this line used to clear the one it left)
      const pe = () => app.el("props").innerHTML, g = (id) => app.el(id), seg0 = () => S.pieces[0].segs[0].elastic;
      app.ev("ui")(); out.off = ["el-on", "el-k", "el-r", "el-len"].map(id => new RegExp('id="' + id + '"').test(pe())).concat([/id="el-k"[^>]*disabled/.test(pe()), /id="el-tot"/.test(pe())]);
      g("el-on").onchange({ target: { checked: true } }); out.on = seg0();
      g("el-r").onchange({ target: { value: "80" } }); out.r = seg0();
      g("el-len").onchange({ target: { value: "100" } }); out.len = seg0();      // 100 of the 200 mm line: 50 %
      g("el-k").onchange({ target: { value: "20" } }); out.k = seg0();
      // the internal line as well, with Shift: two lines, Total Length
      const s = at(100, 200); app.fire("pointermove", { ...s, shiftKey: true }); app.fire("pointerdown", { ...s, shiftKey: true }); app.fire("pointerup", { ...s, shiftKey: true });
      app.ev("ui")(); out.two = /id="el-tot"/.test(pe());
      g("el-tot").onchange({ target: { value: "180" } });      // 360 mm of line drawn in to 180 mm: 50 % each
      out.both = [seg0(), S.pieces[0].internals[0].segs[0].elastic];
      out.steps = steps();
      const said = []; const ctx = app.ev("ctx"), ft = ctx.fillText; ctx.fillText = (t, x, y) => { said.push(t); return ft && ft.call(ctx, t, x, y); }; app.ev("draw")(); ctx.fillText = ft;
      out.label = said.filter(t => /^Elastic/.test(t));
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      app.ev("openFile")("e.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened e/.test(x)), "the file to open");
      out.opened = [S.pieces[0].segs[0].elastic, S.pieces[0].internals[0].segs[0].elastic];
      app.setTool("edit_pattern"); click(100, 0); app.ev("setElastic")({ on: false }); out.gone = S.pieces[0].segs[0].elastic || null;
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.clickSteps, [], "the selecting click left no step (Round r15 / 1)");
  assert.deepStrictEqual(o.off, [true, true, true, true, true, false], "the fields, Strength greyed while off, no Total Length for one line");
  assert.deepStrictEqual(o.on, { k: 10, r: 80 }, "on: Strength 10, Ratio 80 (Round r15 / 7, the check videos; it was 100)");
  assert.deepStrictEqual(o.r, { k: 10, r: 80 }); assert.deepStrictEqual(o.len, { k: 10, r: 50 }); assert.deepStrictEqual(o.k, { k: 20, r: 50 });
  assert.strictEqual(o.two, true);
  assert.deepStrictEqual(o.both, [{ k: 20, r: 50 }, { k: 10, r: 50 }], "Total Length: one ratio for both; the internal line gets the default strength");
  assert.deepStrictEqual(o.steps, ["Elastic", "Elastic", "Elastic", "Elastic", "Elastic"]);
  assert.deepStrictEqual(o.label, ["Elastic 50 %", "Elastic 50 %"]);
  assert.deepStrictEqual(o.opened, o.both);
  assert.strictEqual(o.gone, null);
});

/* ---------- 4: Seamline Topstitch ---------- */
test("r14 / 4: Seamline Topstitch (;) on a sewing line: a topstitch along both sides of the seam in one step; Placement Seam A / Seam B / Seam Both in Properties…; Edit Sewing's Add Seamline Topstitch the same; it goes with its seam; saved and opened; Add ▸ Project keeps it on the new seam", () => {
  const o = boot({ script: DOC + `
    return (async () => {
      const part = (p, i) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: false });
      S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3)] }); app.commit(); S.undo.length = 0; S.un.length = 0;
      app.key(";"); out.tool = S.tool;
      click(200, 200);
      const sts = () => S.stitches.map(s => [s.part.piece === A.id ? "A" : "B", s.seam, s.side, s.name]);
      out.made = sts(); out.steps = steps();
      // (Round r15 / 7: Placement is a row of the Property Editor with Edit Topstitch, no longer in Properties…) Seam A, then Seam Both again
      let dlg = null; app.answer = (t, f, o2) => { dlg = (o2.selects || []).map(x => [x.label, x.val, x.options.map(q => q[1])]); return { off: 5, extS: true, extE: true, corner: "right" }; };
      app.ev("stitchNumeric")({ x: 10, y: 10 }, S.stitches[0]); out.dlg = dlg;
      app.setTool("edit_topstitch"); S.selStitch = S.stitches[0].id; S.sel = [A.id]; app.ev("ui")();
      app.el("st-pl").onchange({ target: { value: "a" } }); out.a = sts();
      app.el("st-pl").onchange({ target: { value: "both" } }); out.both = sts().concat([S.stitches.map(s => s.offset)]);
      // Edit Sewing's row on the same seam: a second seamline topstitch
      app.setTool("edit_sewing"); const m = at(200, 300); app.menu.children.length = 0; app.ev("editSewMenu")(m.x, m.y, m.x, m.y);
      app.menu.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes("Add Seamline Topstitch")).onclick(); out.menu = S.stitches.length;
      // saved and opened
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      const fd = app.fileDoc(file); out.inFile = fd.stitches.map(s => [s.seam, s.side, s.group]);
      // added to itself as a project: the copies sit on the new seam
      app.ev("addDocument")("again", fd); out.added = S.stitches.slice(4).map(s => [s.seam, s.side, s.group]); out.seams = S.seams.map(x => x.id);
      // the seam deleted: its seamline topstitches go
      S.seams = S.seams.filter(x => x.id !== 1); app.commit(); out.after = S.stitches.length;
      return out;
    })();` }).result;
  assert.strictEqual(o.tool, "seamline_topstitch", "; picks the tool");
  assert.deepStrictEqual(o.made, [["A", 1, "a", "SeamLine_Topstitch_1"], ["B", 1, "b", "SeamLine_Topstitch_1"]]);      // (Round r15 / 7: named as the reference names it)
  assert.deepStrictEqual(o.steps, ["Seamline Topstitch"]);
  assert.deepStrictEqual(o.dlg, [["Corner", "right", ["Right Angled", "Curved", "Smooth"]]], "Properties…: no Placement (Round r15 / 7)");
  assert.deepStrictEqual(o.a, [["A", 1, "a", "SeamLine_Topstitch_1"]], "Seam A: the first side only");
  assert.deepStrictEqual(o.both, [["A", 1, "a", "SeamLine_Topstitch_1"], ["B", 1, "b", "SeamLine_Topstitch_1"], [5, 5]], "Seam Both again, with the offset typed");
  assert.strictEqual(o.menu, 4);
  assert.strictEqual(o.inFile.length, 4); assert.ok(o.inFile.every(s => s[0] === 1));
  assert.deepStrictEqual(o.seams, [1, 2]); assert.ok(o.added.length === 4 && o.added.every(s => s[0] === 2), JSON.stringify(o.added));
  assert.strictEqual(new Set(o.added.map(s => s[2])).size, 2, "two groups, by their new ids");
  assert.strictEqual(o.after, 4, "the first seam's four went with it; the added ones stay");
});

/* ---------- 5: a seam's sewing line type and fold ---------- */
// two 150 × 100 sheets side by side in one plane, A's right edge sewn to B's left edge, no gravity; the seam folded as given:
// the mean angle round the seam (as foldRun measures a fold line) at the folds the solver made for it
function seamFoldRun(fold) {
  const A = sheet(150, 100, 10), B = sheet(150, 100, 10), na = A.xy.length/2, nb = B.xy.length/2, pairs = [];
  for (let i = 0; i < na; i++) if (Math.abs(A.xy[2*i] - 150) < 1e-9) { const y = A.xy[2*i+1]; for (let j = 0; j < nb; j++) if (Math.abs(B.xy[2*j]) < 1e-9 && Math.abs(B.xy[2*j+1] - y) < 1e-9) pairs.push([{ p: 0, i: [i], w: [1] }, { p: 1, i: [j], w: [1] }]); }
  pairs.sort((u, v) => A.xy[2*u[0].i[0]+1] - A.xy[2*v[0].i[0]+1]);
  const XB = layFlat(B); for (let j = 0; j < nb; j++) XB[3*j] += 150;
  const sim = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: layFlat(A), fab: { weight: 150, bend: 1000 } }, { xy: B.xy, tri: B.tri, X: XB, fab: { weight: 150, bend: 1000 } }],
    seams: [{ id: 1, pairs, ...(fold ? { fold } : {}) }], opt: { gravity: 0, ground: false, self: false, easeIn: 0 } });
  for (let k = 0; k < 1200; k++) C.clothStep(sim, 1/60);      // (a seam's fold settles more slowly than a fold line's: its two sides are two cloths)
  const x = sim.x, Q = sim.fQ, angles = [];
  for (let q = 0; q < Q.length/4; q++) {
    if (sim.fSt[q] < 0) continue;
    const [a, b, c, d] = [0, 1, 2, 3].map(k => 3*Q[4*q + k]), e = [x[b] - x[a], x[b+1] - x[a+1], x[b+2] - x[a+2]], el = Math.hypot(...e), E = e.map(v => v/el);
    const off = (k) => { const r = [x[k] - x[a], x[k+1] - x[a+1], x[k+2] - x[a+2]], t = r[0]*E[0] + r[1]*E[1] + r[2]*E[2]; return r.map((v, i) => v - t*E[i]); };
    const pc = off(c), pd = off(d), rc = Math.hypot(...pc), u = pc.map(v => v/rc), v = [E[1]*u[2] - E[2]*u[1], E[2]*u[0] - E[0]*u[2], E[0]*u[1] - E[1]*u[0]];
    angles.push(Math.atan2(pd[0]*v[0] + pd[1]*v[1] + pd[2]*v[2], pd[0]*u[0] + pd[1]*u[1] + pd[2]*u[2])*180/Math.PI);
  }
  return { n: angles.length, at: angles.reduce((s, v) => s + v, 0)/Math.max(1, angles.length), pairs: pairs.length };
}
test("r14 / 5: the solver folds a seam by its angle once it is closed: 90° a square corner back towards back, 270° front towards front, 0° (Turned) folded flat back against back; a seam without a fold has none", () => {
  const flat = seamFoldRun(null), f90 = seamFoldRun({ a: 90, k: 2000 }), f270 = seamFoldRun({ a: 270, k: 2000 }), turned = seamFoldRun({ a: 0, k: 2000 });
  assert.ok(flat.pairs >= 10); assert.strictEqual(flat.n, 0, "no fold on a plain seam");
  assert.ok(f90.n >= 8, "a fold for the stitches along the seam: " + f90.n);
  near(f90.at, -90, 20, "90°: towards the back"); near(f270.at, 90, 20, "270°: towards the front");
  // (REC-SHORT: Turned no longer folds, the sixth check session; angle 0 is still a Fold Angle the solver keeps, back against back)
  assert.ok(turned.at < 0 && turned.at > -40, "Fold Angle 0: back against back, (nearly) flat: " + turned.at.toFixed(1));
});

test("r14 / 5: a seam's Sewing Line Type in the Property Editor (Turned, Fold Strength, Fold Angle greyed while Turned): one undo step each 'Sewing Line Type', kept on the seam only when not the default, in the Seams panel, given to the solver, saved and opened", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    return (async () => {
      app.setTool("edit_sewing"); S.selSeam = 1; S.sel = [A.id]; app.ev("ui")(); S.undo.length = 0; S.un.length = 0;
      const pe = () => app.el("props").innerHTML, g = (id) => app.el(id), keys = () => ["turned", "foldAngle", "foldStrength"].map(k => S.seams[0][k] === undefined ? null : S.seams[0][k]);
      out.fields = ["sf-t", "sf-k", "sf-kr", "sf-a", "sf-ar"].map(id => new RegExp('id="' + id + '"').test(pe())).concat([/id="sf-a"[^>]*disabled/.test(pe())]);
      g("sf-a").onchange({ target: { value: "120" } }); out.a = keys();
      g("sf-k").onchange({ target: { value: "40" } }); out.k = keys();
      g("sf-t").onchange({ target: { checked: true } }); out.t = keys(); out.grey = /id="sf-a"[^>]*disabled/.test(pe());
      out.panel = /turned/.test(pe());
      out.steps = steps();
      out.spec = app.ev("simSeams")(app.SIM.order.length ? app.SIM.order : S.pieces.map(p => p.id)).map(x => x.fold || null);
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      app.ev("openFile")("s.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened s/.test(x)), "the file to open");
      out.opened = keys();
      app.undo(); out.undone = keys();
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.fields, [true, true, true, true, true, false], "the fields; Fold Angle not greyed while Turned is off");
  assert.deepStrictEqual(o.a, [null, 120, null]); assert.deepStrictEqual(o.k, [null, 120, 40]); assert.deepStrictEqual(o.t, [true, 120, 40]);
  assert.strictEqual(o.grey, true, "Turned: the angle greyed");
  assert.strictEqual(o.panel, true, "the Seams panel says turned");
  assert.deepStrictEqual(o.steps, ["Sewing Line Type", "Sewing Line Type", "Sewing Line Type"]);
  // (REC-SHORT: Turned folds nothing, the sixth check session; it was 0°, back against back)
  assert.deepStrictEqual(o.spec, [null, null], "Turned: no fold, whatever the greyed rows say; the other seam flat");
  assert.deepStrictEqual(o.opened, [true, 120, 40]);
});

/* ---------- 6: Freeze, Strengthen, Deactivate, Hide 3D Pattern ---------- */
test("r14 / 6: the 3D pattern states on their keys and menus: Freeze (Ctrl+K) holds every point, Strengthen (Ctrl+H) stiffens, Deactivate (Pattern Only) (Ctrl+J) holds it and lets cloth through, (Pattern & Sewing) leaves its seams out, Hide 3D Pattern (Shift+Q) and Shift+C hide it in 3D; each one undo step, named by its opposite once set, said in the pattern list, saved", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    return (async () => {
      S.sel = [A.id]; app.commit(); S.undo.length = 0; S.un.length = 0;
      const st = (p) => ["freeze3", "strong3", "off3", "hide3"].map(k => p[k] === undefined ? null : p[k]);
      app.key("k", { ctrlKey: true }); out.freeze = st(S.pieces[0]);
      out.names = [app.ev("state3Name")("freeze3"), app.ev("state3Name")("strong3")];
      app.ev("simBuild")(); const sim = app.SIM.sim, nA = G3.items.get(A.id).mesh.xy.length/2;
      out.held = [Array.from(sim.w).slice(0, nA).every(w => w === 0), Array.from(sim.w).slice(nA).some(w => w > 0)];
      app.key("k", { ctrlKey: true }); app.key("h", { ctrlKey: true }); out.strong = st(S.pieces[0]);
      app.ev("simBuild")(); out.stiff = [app.SIM.sim.bA[0] < 1/(1000*50), app.SIM.sim.eA[0] <= 1e-7];      // (bending 100 times the medium woven's 1000; stretch 1e7)
      app.key("h", { ctrlKey: true }); app.key("j", { ctrlKey: true }); out.off = st(S.pieces[0]);
      app.ev("simBuild")(); out.ghost = [app.SIM.sim.ghost ? Array.from(app.SIM.sim.ghost) : null, app.SIM.seams.map(x => !!x.skip)];
      app.ev("garmentSync")(); out.seeThrough = [G3.items.get(A.id).obj.material.transparent, G3.items.get(A.id).obj.material.opacity];
      app.key("j", { ctrlKey: true }); app.ev("deactivate3")("sewing"); out.offSew = st(S.pieces[0]);
      app.ev("simBuild")(); out.sewSkip = app.SIM.seams.map(x => !!x.skip);
      app.ev("deactivate3")("sewing");
      app.key("Q", { shiftKey: true }); out.hide = st(S.pieces[0]); app.ev("garmentSync")(); out.hidden = [G3.items.get(A.id).obj.visible, G3.items.get(B.id).obj.visible];
      app.key("C", { shiftKey: true }); out.all = S.pieces.map(p => !!p.hide3); app.key("C", { shiftKey: true }); out.shown = S.pieces.map(p => !!p.hide3);
      app.ev("ui")(); out.list = (app.el("list").innerHTML.match(/class="lk"[^>]*>([^<]+)</g) || []).map(t => t.replace(/.*>/, ""));
      out.steps = steps();
      S.sel = [A.id]; app.key("k", { ctrlKey: true });
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      out.inFile = app.fileDoc(file).pieces.map(p => p.freeze3 || null);
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.freeze, [true, null, null, null]);
  assert.deepStrictEqual(o.names, ["Unfreeze", "Strengthen"], "a row says its opposite once every selected pattern is so");
  assert.deepStrictEqual(o.held, [true, true], "frozen: every point of it held, the other pattern free");
  assert.deepStrictEqual(o.strong, [null, true, null, null]); assert.deepStrictEqual(o.stiff, [true, true]);
  assert.deepStrictEqual(o.off, [null, null, "pattern", null]);
  assert.deepStrictEqual(o.ghost, [[1, 0], [false, false]], "Pattern Only: passed through, its seams kept");
  assert.deepStrictEqual(o.seeThrough, [true, 0.35]);
  assert.deepStrictEqual(o.offSew, [null, null, "sewing", null]); assert.deepStrictEqual(o.sewSkip, [true, true], "Pattern & Sewing: both its seams left out");
  assert.deepStrictEqual(o.hide, [null, null, null, true]); assert.deepStrictEqual(o.hidden, [false, true]);
  assert.deepStrictEqual(o.all, [true, true]); assert.deepStrictEqual(o.shown, [false, false], "Shift+C hides all, again shows all");
  assert.deepStrictEqual(o.steps, ["Freeze", "Unfreeze", "Strengthen", "Unstrengthen", "Deactivate (Pattern Only)", "Activate", "Deactivate (Pattern & Sewing)", "Activate (Pattern & Sewing)", "Hide 3D Pattern", "Hide All 3D Patterns", "Show All 3D Patterns"]);
  assert.deepStrictEqual(o.inFile, [true, null]);
});

/* ---------- 7: the fit map, Isolate Selection ---------- */
test("r14 / 7: the Fit Map (Alt+8): each triangle by the share of its fabric's Max Stretch it uses, Can't Wear over 100 %, Tight over 80 %, a legend in words with the share of the area and the spots; one map at a time with the strain map", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const lim = app.ev("fabricPhys")(app.ev("fabricOf")(B)).maxStretch, itA = G3.items.get(A.id), itB = G3.items.get(B.id);
    // the front stretched by half, the back by 90 % of its limit, both ways about its own middle (every edge alike)
    const stretch = (it, f) => { const n = it.X.length/3, c = [0, 0]; for (let i = 0; i < n; i++) { c[0] += it.X[3*i]/n; c[1] += it.X[3*i+1]/n; } for (let i = 0; i < n; i++) for (const d of [0, 1]) it.X[3*i+d] = c[d] + (it.X[3*i+d] - c[d])*f; };
    stretch(itA, 1.5); stretch(itB, 1 + 0.9*lim);
    app.key("8", { altKey: true }); out.on = [S.ui.fit3, S.ui.strain3];
    const leg = app.el("strain3d").innerHTML; out.leg = leg.replace(/<[^>]+>/g, "|").split("|").filter(Boolean);
    const col = app.view3d.group("strain").children.map(m => Array.from(m.geometry.attributes.color.array.slice(0, 3)).map(v => Math.round(v*255)));
    out.cols = col;
    app.key("7", { altKey: true }); out.strain = [S.ui.fit3, S.ui.strain3];
    app.key("8", { altKey: true }); out.back = [S.ui.fit3, S.ui.strain3];
    out.menu = app.ev("render3Items")().filter(x => x && /Map/.test(x.n || "")).map(x => [x.n, !!x.on, x.k]);
    return out;` }).result;
  assert.deepStrictEqual(o.on, [true, false]);
  // (Round r15 / 8, the check videos S19: the legend lists Can't Wear and Tight, and cloth that fits is left uncoloured)
  assert.deepStrictEqual(o.leg, ["Fit (of each fabric's Max Stretch)", "Can't Wear (over 100 %): 50.0 % · 1 spot", "Tight (over 80 %): 50.0 % · 1 spot", "Cloth that fits is not colored"]);      // (Round r27: one spelling in the program's text, the American of the menu rows taken from the references)
  assert.deepStrictEqual(o.cols, [[213, 94, 0], [240, 228, 66]], "the front vermilion (Can't Wear), the back yellow (Tight)");
  assert.deepStrictEqual(o.strain, [false, true], "Alt+7: the strain map, the fit map off"); assert.deepStrictEqual(o.back, [true, false]);
  // (Round r20 continued (4): the Stress and Pressure Maps follow them under More)
  assert.deepStrictEqual(o.menu, [["Strain Map", false, "Alt+7"], ["Fit Map", true, "Alt+8"], ["Stress Map", false, "Alt+6"], ["Pressure Map", false, null]]);
});

test("r14 / 7: Isolate Selection (Shift+I) shows only the patterns selected when it was switched on, in the 3D window alone; a new selection changes nothing; Shift+I again shows everything; no undo step, nothing in the document", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    S.sel = [A.id]; app.commit(); S.undo.length = 0; S.un.length = 0; const doc = app.docJSON();
    const vis = () => [A, B].map(p => G3.items.get(p.id).obj.visible);
    app.key("I", { shiftKey: true }); out.iso = vis();
    S.sel = [B.id]; app.commit(); out.still = vis();
    out.row = app.ev("menuDisplay")().filter(Boolean).filter(x => x.n === "Isolate Selection").map(x => [!!x.on, x.k]);
    app.key("I", { shiftKey: true }); out.back = vis();
    out.quiet = [S.undo.length, JSON.parse(app.docJSON()).pieces.length === JSON.parse(doc).pieces.length && !S.pieces.some(p => p.hide3)];
    return out;` }).result;
  assert.deepStrictEqual(o.iso, [true, false]); assert.deepStrictEqual(o.still, [true, false], "the isolation does not follow the selection");
  assert.deepStrictEqual(o.row, [[true, "Shift+I"]]);
  assert.deepStrictEqual(o.back, [true, true]);
  assert.deepStrictEqual(o.quiet, [0, true], "no undo step; no pattern hidden");
});

/* ---------- 8: Show Threads, Symmetric Pinch ---------- */
test("r14 / 8: Show Threads and Show Seamlines are two switches: the threads between the sewn places, and each sewn side drawn along the cloth; each on its own row (Display ▸ 3D Garment, the 3D window's list) and hides only its own", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const kinds = () => [...G3.thread.keys()].map(k => k[0]).sort().join("");
    app.ev("garmentLines")(); out.both = kinds();
    app.ev("setShow3")("threads3", false); app.ev("garmentLines")(); out.noThreads = kinds();
    app.ev("setShow3")("threads3", true); app.ev("setShow3")("sewing3", false); app.ev("garmentLines")(); out.noLines = kinds();
    out.row = sub(app.ev("menuDisplay")(), "3D Garment").filter(x => /Threads|Seamlines/.test(x.n || "")).map(x => [x.n, !!x.on, !!x.nb]);
    out.list = app.ev("VIEW3D").garment.map(v => v[1]).slice(0, 3);
    return out;` }).result;
  assert.strictEqual(o.both, "sssstt", "two seams: a thread object each and a line along each of their two sides");
  assert.strictEqual(o.noThreads, "ssss");
  // (Round FIX-3b / A) with Show Seamlines off each seam's 3D Seamline (Plain Seam) is drawn along its two sides instead (its own objects, "p")
  assert.strictEqual(o.noLines, "pppptt");
  assert.deepStrictEqual(o.row, [["Show Seamlines", false, false], ["Show Threads", true, false]]);
  assert.deepStrictEqual(o.list, ["Show Garment", "Show Seamlines", "Show Threads"]);
});

test("r14 / 8: Symmetric Pinch: pinching a pattern that has a symmetric partner pulls the mirrored place of the partner too, by the move mirrored across the plane between the two places", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    // the back as the front's symmetric linked copy, mirrored about x 350 (the tube's two halves face each other in 3D)
    B.link = { of: A.id, kind: "symmetric", m: [-1, 0, 0, 1, 700, 0] }; app.commit(); app.ev("garmentSync")();
    S.cloth = app.normCloth({ ...S.cloth, worker: false }); app.ev("simStart")();
    const itA = G3.items.get(A.id), kA = app.SIM.order.indexOf(A.id), aA = app.ev("SIM3D").triAnchor(itA.mesh.xy, itA.mesh.tri, 50, 200, kA);
    const pos = (it, a) => { const r = [0, 0, 0]; a.i.forEach((v, j) => { for (let c = 0; c < 3; c++) r[c] += a.w[j]*it.X[3*v + c]; }); return r; };
    const f0 = pos(itA, aA), m = app.ev("symPinchPlace")(A, { x: 50, y: 200 }, f0);
    const kB = app.SIM.order.indexOf(B.id), offB = app.SIM.sim.off[kB], itB = G3.items.get(B.id);
    out.place = m ? [m.d.i.every(i => i >= offB), m.n.map(v => +v.toFixed(2))] : null;
    const bLocal = { i: m.d.i.map(i => i - offB), w: m.d.w };
    out.mirrored = pos(itB, bLocal).map((v, c) => +(v - f0[c]).toFixed(1));
    const g = { from: { x: f0[0], y: f0[1], z: f0[2] }, mirror: m }, to = app.ev("symPinchTo")(g, { x: f0[0] + 50, y: f0[1], z: f0[2] + 30 });
    out.to = to.map((v, c) => +(v - m.from[c]).toFixed(3));
    // the solver gets both pulls; after a few frames both places have moved the same way across
    const offA = app.SIM.sim.off[kA], dA = { i: aA.i.map(v => offA + v), w: aA.w };
    app.ev("simDragTo")(dA, [f0[0] + 50, f0[1], f0[2]], [{ ...m.d, to: app.ev("symPinchTo")(g, { x: f0[0] + 50, y: f0[1], z: f0[2] }) }]);
    out.also = app.SIM.sim.drag.also.length;
    const b0 = pos(itB, bLocal);
    for (let k = 0; k < 20; k++) app.ev("simFrame")();
    out.moved = [pos(itA, aA)[0] - f0[0], pos(itB, bLocal)[0] - b0[0]].map(v => +v.toFixed(1));
    app.ev("simStop")();
    return out;` }).result;
  assert.ok(o.place && o.place[0], "a place on the partner");
  assert.deepStrictEqual(o.place[1], [0, 0, -1], "the plane between the halves: square to z (the front at +z, its mirror the back)");
  assert.ok(Math.abs(o.mirrored[0]) < 1 && Math.abs(o.mirrored[1]) < 1, "the mirrored place lies straight behind the pinched one: " + o.mirrored);
  assert.deepStrictEqual(o.to, [50, 0, -30], "across the same way, out of the plane the other way");
  assert.strictEqual(o.also, 1);
  assert.ok(o.moved[0] > 5 && o.moved[1] > 5, "both places were pulled across: " + o.moved);
});

/* ---------- 9: buttons by position and in a row ---------- */
test("r14 / 9: the Button tool's right-click inside a pattern opens Moving Distance (its place by its distances to the outline); on a button: Copy, Paste…, Delete; Paste puts copies in a row towards the Position, Interval apart, in one step", () => {
  const o = boot({ script: DOC + `
    app.setTool("button2d"); S.undo.length = 0; S.un.length = 0;
    let dlg = null; app.answer = (t, f) => { dlg = [t, f.map(x => x.label)]; return { dm: 0, l: 15, r: f[2].val, u: 20, d: f[4].val }; };
    const s = at(100, 200); app.fire("contextmenu", { x: s.x, y: s.y });
    out.pos = [dlg, S.buttons.map(b => [b.kind, +b.x.toFixed(3), +b.y.toFixed(3)])];
    // on the button: Copy (no Paste before something is copied), Delete
    const b = at(15, 20); app.menu.children.length = 0; app.fire("contextmenu", { x: b.x, y: b.y });
    out.rows = app.menu.children.filter(c => typeof c.onclick === "function").map(c => (c.innerHTML.match(/<span>([^<]*)/) || [])[1]);
    const row = (n) => app.menu.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes("<span>" + n + "</span>")).onclick({ stopPropagation() {} });
    row("Copy");
    // inside the pattern again: Paste… and Moving Distance…; a row of three, 50 apart, towards (15, 200)
    app.answer = (t, f) => { dlg = [t, f.map(x => x.label)]; if (!f[5]) throw new Error("dialog " + t + " " + JSON.stringify(f.map(x => x.label))); return { iv: 50, n: 3, l: 15, r: f[3].val, u: 200, d: f[5].val }; };
    const e = at(100, 300); app.menu.children.length = 0; app.fire("contextmenu", { x: e.x, y: e.y });
    out.rows2 = app.menu.children.filter(c => typeof c.onclick === "function").map(c => (c.innerHTML.match(/<span>([^<]*)/) || [])[1]);
    row("Paste\\u2026");
    out.paste = [dlg, S.buttons.map(x => [+x.x.toFixed(3), +x.y.toFixed(3)])];
    out.steps = steps();
    return out;` }).result;
  assert.deepStrictEqual(o.pos, [["Moving Distance", ["Distance Moved", "Left", "Right", "Up", "Down"]], [["button", 15, 20]]]);
  assert.deepStrictEqual(o.rows, ["Copy", "Delete"]);
  assert.deepStrictEqual(o.rows2, ["Paste…", "Moving Distance…"]);
  assert.deepStrictEqual(o.paste[0], ["Paste", ["Interval", "Number of Buttons", "Left", "Right", "Up", "Down"]]);
  assert.deepStrictEqual(o.paste[1], [[15, 20], [15, 70], [15, 120], [15, 170]], "three copies 50 apart from the copied one towards the Position");
  assert.deepStrictEqual(o.steps, ["Button", "Paste"]);
});

module.exports = T;
