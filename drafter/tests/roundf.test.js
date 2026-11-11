// Round F. F1: 2D and 3D are independent: nothing done in the 2D window moves a pattern in the 3D window; a new pattern comes
// into 3D once, where its place in 2D puts it; only Reset 2D Arrangement gives a pattern its place from 2D again.
// The tests run in the booted app with three.js and a renderer that draws nothing.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-boot-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify({ blank: true, three: true, ...opt }));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 60000, maxBuffer: 1 << 28 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after " + (ms || 60000)/1000 + " s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
// a skirt-like document: front, back and a waistband laid out in 2D; where each pattern's corners are in 3D
const DOC = `
  const out = {}, G3 = app.G3;
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  app.push("Rectangle"); S.pieces.push(sq("Front", 0, 100, 300, 500), sq("Back", 400, 100, 300, 500), sq("Waistband", 0, 0, 700, 60)); app.commit();
  const P = (n) => S.pieces.find(p => p.name === n), it = (n) => G3.items.get(P(n).id);
  // the cloth point nearest a 2D place of a pattern, in 3D
  const at3 = (n, q) => { const m = it(n).mesh; let best = 0, bd = Infinity; for (let i = 0; i < m.xy.length/2; i++) { const d = Math.hypot(m.xy[2*i] - q.x, m.xy[2*i+1] - q.y); if (d < bd) { bd = d; best = i; } } return [0, 1, 2].map(k => +it(n).X[3*best + k].toFixed(3)); };
  const corners = (n) => P(n).pts.map(q => at3(n, q));
  const all3 = () => ["Front", "Back", "Waistband"].map(n => corners(n));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
`;

test("F1 a pattern moved in 2D stays where it is in 3D; drawing a new pattern moves no other pattern in 3D", () => {
  const r = boot({ script: DOC + `
    const before = all3();
    // move the front in 2D (Transform Pattern's Move…): its cloth stays, and the others too
    S.sel = [P("Front").id]; app.push("Move"); app.ev("mapPiece")(P("Front"), (q) => ({ x: q.x + 900, y: q.y + 250 })); app.commit();
    out.moved = [P("Front").pts[0].x, same(all3(), before)];
    // a new polygon pattern drawn beside them: nobody else moves in 3D
    app.push("Polygon"); S.pieces.push(app.mkPiece("New", app.mkShape([{x:1200,y:900},{x:1400,y:900},{x:1300,y:1100}], true))); app.commit();
    out.added = [S.pieces.length, same(all3(), before), !!P("New").p3, !!G3.items.get(P("New").id)];
    // a new internal polygon inside the front (a shape inside a pattern): nobody moves
    app.push("Internal Polygon"); app.ev("addChild")(P("Front"), "internals", { pts: [{x:950,y:450},{x:1050,y:450},{x:1000,y:520}], segs: [{}, {}, {}], closed: true }); app.commit();
    out.internal = same(all3(), before);
    // undo all of it: still nowhere else
    app.undo(); app.undo(); app.undo(); out.undone = same(all3(), before);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.moved, [900, true], "moved 900 mm in 2D, not at all in 3D");
  assert.deepStrictEqual(o.added, [4, true, true, true], "the new pattern is in 3D with a place of its own; the front, back and waistband did not move");
  assert.strictEqual(o.internal, true); assert.strictEqual(o.undone, true);
});

test("F1 a shape edit changes the cloth where it is: the points that did not move stay in 3D; a turn in 2D is made up for in 3D", () => {
  const r = boot({ script: DOC + `
    const before = corners("Back");
    // the back's bottom right corner dragged out 120 mm: its box and middle change, its other three corners stay put in 3D
    app.push("Edit"); P("Back").pts[2] = { x: 820, y: 650 }; app.commit();
    const after = corners("Back");
    out.edit = [same(after.slice(0, 2), before.slice(0, 2)), same(after[3], before[3]), !same(after[2], before[2])];
    app.undo();
    // turned 90 degrees in 2D (Transform Pattern, Ctrl + an arrow): the cloth stands as it stood
    S.sel = [P("Back").id]; app.setTool("transform_pattern"); app.key("ArrowDown", { ctrlKey: true });
    const turned = P("Back").pts, now = turned.map(q => at3("Back", q));
    out.turn = [Math.max(...now.map((v, k) => Math.hypot(v[0] - before[k][0], v[1] - before[k][1], v[2] - before[k][2])))];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.edit, [true, true, true], "three corners where they were, the dragged one moved");
  assert.ok(o.turn[0] < 0.01, "every corner where it was in 3D after the turn in 2D: " + o.turn[0]);
});

test("F1 a new pattern comes into 3D where its place in 2D puts it, beside the others as in 2D; a pasted copy is placed afresh; Reset 2D Arrangement gives places from 2D again", () => {
  const r = boot({ script: DOC + `
    const front = P("Front").p3.pos, back = P("Back").p3.pos;
    out.layout = [+(back[0] - front[0]).toFixed(3), +(front[1] - P("Waistband").p3.pos[1]).toFixed(3)];
    // move the back in 3D (as the gizmo does), then paste a copy of it: the copy comes where its 2D place puts it, not onto the back
    app.push("Move in 3D"); P("Back").p3 = { ...P("Back").p3, pos: [P("Back").p3.pos[0], P("Back").p3.pos[1], -300] }; app.commit();
    S.clip = [JSON.parse(JSON.stringify(P("Back")))]; S.sel = [P("Back").id];
    app.push("Paste"); const c = JSON.parse(JSON.stringify(P("Back"))); c.id = 99; c.name = "Back copy"; app.ev("mapPiece")(c, (q) => ({ x: q.x + 400, y: q.y })); S.pieces.push(c); app.commit();
    out.copy = [P("Back copy").p3.pos[2] !== -300, +(P("Back copy").p3.pos[0] - back[0]).toFixed(3)];
    // Reset 2D Arrangement (All): the back stands in front again, where 2D puts it
    app.ev("resetArrangement2")(false);
    out.reset = [P("Back").p3.pos[2] === P("Front").p3.pos[2], JSON.stringify(P("Back").p3.q)];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.layout, [400, -320], "400 mm apart in 2D, 400 mm apart in 3D; the front's middle 320 mm below the waistband's, as in 2D");
  assert.deepStrictEqual(o.copy, [true, 400], "the copy where its 2D place puts it, 400 mm right of the back's 2D place");
  assert.deepStrictEqual(o.reset, [true, "[0,0,0,1]"]);
});

test("F1 files: a place saved without its 2D anchor (every file before Round F) opens where it was shown; the anchor is kept in the file; a file with no places gets each pattern the place it was shown in", () => {
  const r = boot({ streams: false, script: DOC + `
    const doc = JSON.parse(app.docJSON());
    // as a file of before Round F: the front with a place and no anchor, the others with none
    doc.pieces.forEach(p => { if (p.name === "Front") p.p3 = { pos: [10, 1200, 300], q: [0, 0, 0, 1], r: 0 }; else delete p.p3; });
    app.ev("openFile")("old.pdraft", new TextEncoder().encode(JSON.stringify(doc)), null, true);
    const c = app.ev("meshC")(P("Front"));
    out.anchor = [P("Front").p3.o, c, P("Front").p3.pos];
    out.mid = at3("Front", { x: c[0], y: c[1] });
    out.others = [!!P("Back").p3, !!P("Waistband").p3, +(P("Back").p3.pos[0] - P("Waistband").p3.pos[0]).toFixed(3)];
    let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
    out.saved = app.fileDoc(file).pieces.map(p => p.p3 && p.p3.o);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.anchor[0], o.anchor[1], "the anchor is the middle of its cloth, as the place was always read"); assert.deepStrictEqual(o.anchor[2], [10, 1200, 300]);
  assert.ok(Math.hypot(o.mid[0] - 10, o.mid[1] - 1200, o.mid[2] - 300) < 15, "the middle of the front is where the file put it: " + o.mid);
  assert.deepStrictEqual(o.others.slice(0, 2), [true, true]); assert.strictEqual(o.others[2], 200, "laid out as in 2D: the back's middle (550) 200 mm right of the waistband's (350)");
  assert.ok(o.saved.every(a => Array.isArray(a) && a.length === 2), "every place is saved with its anchor");
});

test("F2 a simulation run is one undo step: Ctrl+Z puts the cloth back as it was before the run, Ctrl+Y as the run left it; the step is in the timeline; an edit after it undoes on its own; nothing of it goes into the saved history", () => {
  const r = boot({ script: DOC + `
    S.cloth = app.normCloth({ ...S.cloth, worker: false, self: false }); app.commit();
    const X = () => ["Front", "Back", "Waistband"].map(n => Array.from(it(n).X)), diff = (a, b) => Math.max(...a.map((x, k) => Math.max(...x.map((v, i) => Math.abs(v - b[k][i])))));
    const flat = X(), steps0 = S.undo.length;
    app.ev("simStart")(); for (let i = 0; i < 30; i++) app.ev("simFrame")(); app.ev("simStop")();
    const run1 = X();
    out.run = [S.undo.length - steps0, app.histSteps().steps.slice(-1)[0].n, diff(run1, flat) > 5];
    // undo: the cloth as it was before the run (flat, where it was arranged); redo: as the run left it
    app.key("z", { ctrlKey: true }); out.undo = [diff(X(), flat), it("Front").draped];
    app.key("y", { ctrlKey: true }); out.redo = [diff(X(), run1), it("Front").draped];
    // a second run on top: undo goes back to the end of the first run, a second undo to flat
    app.ev("simStart")(); for (let i = 0; i < 20; i++) app.ev("simFrame")(); app.ev("simStop")();
    const run2 = X(); out.run2 = diff(run2, run1) > 0.01;
    app.undo(); out.back1 = diff(X(), run1); app.undo(); out.back0 = diff(X(), flat);
    app.redo(); app.redo(); out.fwd = diff(X(), run2);
    // an edit in 2D after the run (a notch: no shape change) undoes on its own and leaves the drape
    app.push("Notch"); P("Front").segs[0].notches.push(0.5); app.commit(); app.undo(); out.notch = [P("Front").segs[0].notches.length, diff(X(), run2)];
    // undo while the simulation runs: it stops first, then the run is undone
    app.ev("simStart")(); for (let i = 0; i < 5; i++) app.ev("simFrame")(); app.undo(); out.during = [app.ev("SIM").on, diff(X(), run2)];
    // the saved history has the steps and no drape references
    let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
    const h = app.fileDoc(file).history;
    // (Round H1: v4, the tree: its nodes; a step that had a cloth not kept says so, drape: 1, and names no snapshot)
    out.saved = [h.nodes.some(s => s.n === "Simulate"), JSON.stringify(h).includes("drape3")];
    return out;` }, 120000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.run, [1, "Simulate", true], "one step, named Simulate, and the cloth moved");
  assert.ok(o.undo[0] < 1e-3 && o.undo[1] === false, "undo: flat as before the run " + o.undo);
  assert.ok(o.redo[0] < 1e-3 && o.redo[1] === true, "redo: as the run left it " + o.redo);
  assert.strictEqual(o.run2, true); assert.ok(o.back1 < 1e-3 && o.back0 < 1e-3 && o.fwd < 1e-3, [o.back1, o.back0, o.fwd].join());
  assert.deepStrictEqual(o.notch, [0, 0]);
  assert.deepStrictEqual(o.during, [false, 0], "stopped, and the third run taken back to the end of the second");
  assert.deepStrictEqual(o.saved, [true, false]);
});

test("F3 Create Polygon: click point 1, move, right-click, Mirror Creation on: the mirror line passes through point 1 (along the first line with Local, along X or Y); while the dialog is open the line's end stays where the right-click was; Length and Angle are in the dialog", () => {
  const r = boot({ three: false, script: `
    const out = {}, C = (x, y) => { const q = app.toS({ x, y }); app.click(q.x, q.y); }, M = (x, y) => { const q = app.toS({ x, y }); app.fire("pointermove", { x: q.x, y: q.y }); };
    const R = (x, y) => { const q = app.toS({ x, y }); app.fire("contextmenu", { x: q.x, y: q.y, button: 2 }); };
    const on = (ax, q) => Math.abs((q.x - ax.o.x)*ax.u.y - (q.y - ax.o.y)*ax.u.x) < 1e-6;
    out.axes = [];
    for (const axis of ["local", "x", "y"]) {
      app.setTool("polygon"); C(200, 100); M(260, 160);
      app.answer = (t, f) => { out.fields = f.map(x => x.label); return { len: 100, ang: 45, mirror: "on", axis }; };
      R(260, 160);
      const d = S.draft, ax = app.ev("mirrorAxis")(d);
      out.axes.push([axis, ax.o.x, ax.o.y, on(ax, { x: 200, y: 100 }), axis === "local" ? on(ax, d.pts[1]) : null, d.pts.length]);
      app.key("Escape");
    }
    // the dialog left open: the line's end stays where the right-click was, whatever the pointer does over the window
    app.setTool("polygon"); C(200, 100); M(300, 100);
    app.answer = null; R(300, 100);
    const held = S.draft.fix && [Math.round(S.draft.fix.x), Math.round(S.draft.fix.y)];
    M(500, 400); M(450, 380);
    out.held = [held, S.draft.fix && [Math.round(S.draft.fix.x), Math.round(S.draft.fix.y)], app.el("dlg").style.display];
    app.ev("hideDlg")(); app.key("Escape");
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.fields, ["Length", "Angle", "Mirror Creation", "Axis"], "Length and Angle in Create Polygon");
  for (const a of o.axes) assert.deepStrictEqual(a.slice(1, 4), [200, 100, true], a[0] + ": the mirror line passes through point 1");
  assert.strictEqual(o.axes[0][4], true, "Local: along the first line (point 1 to the point the dialog added)");
  assert.ok(o.axes.every(a => a[5] === 2), "the dialog added one line");
  assert.deepStrictEqual(o.held, [[300, 100], [300, 100], "block"], "held where the right-click was while the dialog is open");
});

test("F4 Transform Pattern's cursors: each handle of the frame its resize cursor (the corner's diagonal, up and down, across), the turning handle a turning cursor that stays while dragging, the four-way arrows over the body", () => {
  const r = boot({ three: false, script: `
    const out = {}, cur = () => app.el("c").style.cursor, at = (q) => { S.mouse = { ...app.toW(q.x, q.y), sx: q.x, sy: q.y }; app.ev("draw")(); return cur(); };
    S.pieces.push(app.mkPiece("A", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:200},{x:0,y:200}], true))); app.commit();
    app.setTool("transform_pattern"); S.sel = [S.pieces[0].id];
    const b = app.bboxOf([S.pieces[0]]), hs = app.ev("boxHandles")(b);
    out.handles = Object.fromEntries(hs.map(h => [h.id, at(app.ev("handleScreen")(b, h))]));
    out.turn = /^url[(]/.test(at(app.ev("turnHandle")(b)));
    out.body = at(app.toS({ x: 150, y: 100 }));
    // dragging the turning handle: its cursor stays, also away from the handle
    const t = app.ev("turnHandle")(b); app.fire("pointermove", { x: t.x, y: t.y }); app.fire("pointerdown", { x: t.x, y: t.y }); app.fire("pointermove", { x: t.x + 80, y: t.y + 60 });
    out.turning = [S.drag && S.drag.k, /^url[(]/.test(cur())]; app.fire("pointerup", { x: t.x + 80, y: t.y + 60 });
    // dragging a side handle: across
    const e = app.ev("handleScreen")(app.bboxOf([S.pieces[0]]), app.ev("boxHandles")(app.bboxOf([S.pieces[0]])).find(h => h.id === "e"));
    app.fire("pointermove", { x: e.x, y: e.y }); app.fire("pointerdown", { x: e.x, y: e.y }); app.fire("pointermove", { x: e.x + 40, y: e.y + 30 });
    out.scaling = [S.drag && S.drag.k, cur()]; app.fire("pointerup", { x: e.x + 40, y: e.y + 30 });
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.handles, { nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize", se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize" });
  assert.strictEqual(o.turn, true, "the turning handle: the turning cursor"); assert.strictEqual(o.body, "move");
  assert.deepStrictEqual(o.turning, ["rotate", true], "and it stays while turning"); assert.deepStrictEqual(o.scaling, ["scale", "ew-resize"]);
});

test("F5 a % field shows its sign after the number and reads a plain number; other fields stay number fields", () => {
  const r = boot({ three: false, script: `
    app.answer = null;
    app.ev("numDialog")("Test", [{ k: "a", label: "Ratio", val: 50, unit: "%" }, { k: "b", label: "Length", val: 12.5, unit: "mm" }], { x: 10, y: 10 }, () => {});
    const h = app.el("dlg").innerHTML;
    // (Round build-1: every number field is a text field read through numOf(), data-num, so that a sum can be typed: the
    // test looks for that instead of type="number")
    const out = { pct: /<input type="text" inputmode="decimal" data-num="1" data-pct="1" data-i="0" value="50 %"/.test(h), mm: /<input type="text" inputmode="decimal" data-num="1" step="0.1" data-i="1" value="12.5"/.test(h),
      text: [app.ev("pctText")(30), app.ev("pctText")("12.5 %"), app.ev("pctText")("x")] };
    const el = { dataset: { pct: "1" }, value: "" }; app.ev("putVal")(el, 7.25); out.put = el.value;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result, { pct: true, mm: true, text: ["30 %", "12.5 %", "x"], put: "7.25 %" });
});

test("F6 the floor grid fades out as the camera goes under the floor and comes back above it; the gizmo is grabbed from further off; its size is a preference kept per machine", () => {
  const r = boot({ script: `
    const out = {}, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    const grid = () => { v3.project(new THREE.Vector3(0, 0, 0)); app.ev("gridFade")(); const g = v3.scene().getObjectByName("grid:fine"), m = v3.scene().getObjectByName("grid:metre"); return [+g.material.opacity.toFixed(3), g.visible, +m.material.opacity.toFixed(3)]; };
    const at = (el) => { Object.assign(v3.cam, { az: 0.3, el, dist: 3000, tx: 0, ty: 900, tz: 0 }); return grid(); };
    out.above = at(0.4); out.level = at(-0.3); out.just = at(-0.32); out.below = at(-1.2); out.back = at(0.2);
    out.pick = app.ev("GIZ").pick;
    app.setPrefs({ gizmo: "l" }); out.saved = JSON.parse(app.storage.get("pdraft:prefs")).gizmo; app.setPrefs({ gizmo: "huge" }); out.junk = S.prefs.gizmo;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  // (Round r15 / 8, the check videos S16: the reference's grid stays under the floor; it used to fade out there)
  assert.deepStrictEqual(o.above, [1, true, 1], "above the floor: the whole grid");
  assert.deepStrictEqual(o.just, [1, true, 1], "just under the floor: still whole");
  assert.deepStrictEqual(o.below, [1, true, 1], "well under the floor: still whole");
  assert.deepStrictEqual(o.back, [1, true, 1], "and above again");
  assert.strictEqual(o.pick, 11, "grabbed within 11 px (was 7)");
  assert.deepStrictEqual([o.saved, o.junk], ["l", "m"]);
});

// F7: a dart is made with Edit Pattern's right-click on a point (Add Dart); its legs and its point are ordinary lines and points
test("F7 Add Dart on a point's menu (Edit Pattern): the dialog's widths and length; the point moves in along the corner's middle, two new points one arm each side; the legs are straight outline lines, sewn to each other, and the seam along the edge leaves them out; one undo step; Shape Dart Cap puts Edit Curve Point in hand and Enter ends it", () => {
  const r = boot({ script: `
    const out = {};
    S.view = { s: 1, x: 100, y: 100 };
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces = [sq("P", 0, 0, 200, 300), sq("Q", 400, 0, 200, 100)];
    // a waist made of two lines, with a point between them at (100, 0); sewn to Q's top
    app.ev("addPoint")(S.pieces[0], 0, 0.5);
    const P = S.pieces[0], Q = S.pieces[1];
    S.seams = [{ id: 1, a: [{ piece: P.id, shape: 0, sids: [P.segs[0].id, P.segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: Q.id, shape: 0, sids: [Q.segs[0].id], t0: 0, t1: 1, rev: false }] }];
    app.commit(); S.undo.length = 0;
    app.setTool("edit_pattern");
    const s = app.toS({ x: 100, y: 0 });
    app.answer = (t, f, o) => { out.dialog = [t, f.map(x => x.label + "=" + x.val), (o.checks || []).map(c => c.label + "=" + c.val), !!o.preview]; return { total: 30, arm: 10, len: 90, cap: true }; };
    app.menuClick(s.x, s.y, "Add Dart");
    out.pts = P.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
    out.darts = P.darts.length;
    out.straight = P.segs.filter((sg, i) => !sg.curved).length;
    const legs = S.seams.find(sm => sm.a[0].piece === P.id && sm.b[0].piece === P.id);
    out.legs = legs && [legs.a[0].sids.map(id => app.ev("segIx")(P, id)), legs.b[0].sids.map(id => app.ev("segIx")(P, id)), legs.b[0].rev];
    out.waist = S.seams.find(sm => sm.id === 1).a.map(x => x.sids.map(id => app.ev("segIx")(P, id)));
    out.waistLen = +app.seamInfo(S.seams.find(sm => sm.id === 1), S.pieces).la.toFixed(3);
    out.tool = S.tool; out.cap = !!S.dartCap; out.steps = app.histSteps().steps.map(x => x.n);
    app.key("Enter"); out.after = [S.tool, !!S.dartCap];
    // the legs are ordinary: the dart's point is dragged with Edit Pattern like any other point
    const a = app.toS(P.pts[2]); app.drag(a.x, a.y, a.x + 5, a.y); app.fire("pointerup", { x: a.x + 5, y: a.y });
    out.moved = [+P.pts[2].x.toFixed(3), +P.pts[2].y.toFixed(3)];
    app.undo(); app.undo(); out.undone = [S.pieces[0].pts.length, S.seams.length];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  // (Round r15 / 2: Length opens at 70 mm, as the check videos showed (F/10); it was a third of the way across, at most 80)
  assert.deepStrictEqual(o.dialog.slice(0, 3), ["Dart", ["Total Width=20", "Dart Arm Width=10", "Length=70"], ["Shape Dart Cap=true"]], "W61's fields; the cap shaping on");
  assert.strictEqual(o.dialog[3], true, "a preview while the dialog is open");
  // (Round r16: Total Width and Dart Arm Width are tied, Total = 2 × Arm (F/9), so OK takes each arm as half the total; the
  // answer's arm of 10 is one the dialog can no longer show beside a total of 30. It was 10 before the point and 20 after it.)
  assert.deepStrictEqual(o.pts, [[0, 0], [85, 0], [100, 90], [115, 0], [200, 0], [200, 300], [0, 300]], "an arm of 15 either side of the point; the point 90 in");
  assert.strictEqual(o.darts, 0, "no dart object: the dart is lines of the outline");
  assert.deepStrictEqual(o.legs, [[1], [2], true], "the two legs sewn to each other, the second the other way round");
  // (Round r17a / 4: either side of the dart as two parts, M:N, the take-up left out; it was one part stepping over the legs)
  assert.deepStrictEqual(o.waist, [[0], [3]], "the waist seam runs either side of the dart");
  assert.strictEqual(o.waistLen, 170, "its sewn length is the waist less the dart's width");
  assert.deepStrictEqual([o.tool, o.cap], ["edit_curve_point", true], "Shape Dart Cap: Edit Curve Point in hand");
  assert.ok(o.steps.includes("Add Dart"), "one step in the history: " + o.steps);
  assert.deepStrictEqual(o.after, ["edit_pattern", false], "Enter ends it, back to Edit Pattern");
  assert.deepStrictEqual(o.moved, [105, 90], "the dart's point is an ordinary point");
  assert.deepStrictEqual(o.undone, [5, 1], "undone: the point and the waist seam as they were");
});

test("F7 the Dart tool is gone: not in the registry, not in the 2D menu; a file's darts (version 11) are made into the outline as it opens, sewn leg to leg, and they are lines Edit Pattern edits", () => {
  const r = boot({ blank: true, script: `
    const out = {};
    out.registry = app.ev("TOOL_REGISTRY").tools.filter(t => /dart/i.test(t.id)).map(t => t.id);
    out.menu = JSON.stringify(app.MENUS["2d"] ? app.MENUS["2d"]() : []).includes('"Dart"');
    app.ev("openFile")("starter-history.pdraft", new Uint8Array(app.read("files/v11/starter-history.pdraft")), null, true);
    const P = S.pieces[0], M = S.pieces[1];
    out.darts = S.pieces.map(p => p.darts.length);
    out.pts = S.pieces.map(p => p.pts.length);
    out.legs = S.pieces.map(p => S.seams.filter(sm => sm.a[0].piece === p.id && sm.b[0].piece === p.id).length);
    out.valid = app.ev("validSeams")(S.seams, S.pieces).length === S.seams.length;
    out.equal = S.seams.filter(sm => sm.a[0].piece === sm.b[0].piece).map(sm => { const i = app.seamInfo(sm, S.pieces); return Math.abs(i.la - i.lb) < 1e-6; });
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.registry, ["dart_double", "base_dart_double"], "no Dart tool of the old kind and no base dart tool of the old kind; the double-pointed Dart inside a pattern (Round r12 / 6) and, since Round FIX-3 / H, its baseline form Base Dart (2D ▸ Create; the old base_dart id stays unused)");
  assert.strictEqual(o.menu, false, "no Dart row in the 2D menu");
  assert.deepStrictEqual(o.darts, [0, 0], "no dart objects");
  assert.deepStrictEqual(o.pts, [10, 10], "the pattern (seven points in the file) and its linked mirror: three more points each");
  assert.deepStrictEqual(o.legs, [1, 1], "the legs sewn, on the pattern and on its mirror");
  assert.strictEqual(o.valid, true);
  assert.deepStrictEqual(o.equal, [true, true], "each pair of legs the same length");
});

// F9: Hi-Res Properties (W14, Q20)
test("F9 Hi-Res Garment opens Hi-Res Properties: Particle Distance works (8 mm offered); the fields with nothing behind them are greyed and say so, only with Show Tools That Are Not Built Yet on; Reset puts 8 back", () => {
  const r = boot({ blank: true, three: true, script: `
    const out = {};
    app.ev("setLayout")("both");
    let seen = null; app.answer = (t, f, o) => { seen = [t, f.map(x => x.label + (x.ro ? " [ro]" : "")), o.reset, o.hint]; return { res: 10 }; };
    S.ui.unbuilt = true; app.ev("CMD3").hi_res(); out.on = seen; out.res = S.cloth.res;
    S.ui.unbuilt = false; app.ev("CMD3").hi_res(); out.off = seen;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, NB = " (not built yet) [ro]";
  // (Round BETA8-1 / I, roadmap 3.C8, on purpose: Add'l Thickness - Collision and Simulation Quality are built, real rows either way;
  // Reset puts them back too; Tolerance and Skin Offset stay greyed behind the switch)
  assert.deepStrictEqual(o.on.slice(0, 3), ["Hi-Res Properties", ["Particle Distance", "Tolerance" + NB, "\u2013 [ro]", "Add'l Thickness - Collision", "Skin Offset" + NB, "Simulation Quality"], { res: 8, thick: 0, quality: "normal" }]);
  assert.ok(/lower than 7 mm/.test(o.on[3]), o.on[3]);
  assert.strictEqual(o.res, 10, "OK sets the distance between the cloth's points");
  assert.deepStrictEqual(o.off[1], ["Particle Distance", "Add'l Thickness - Collision", "Simulation Quality"], "only what works while the switch is off");
});

// F10: 3D states (W46, Q21)
const STATES = `
  const out = {};
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  app.push("Rectangle"); S.pieces.push(sq("A", 0, 0, 200, 300)); app.commit(); app.garmentSync();
  const it = () => app.G3.items.get(S.pieces[0].id), X = () => Array.from(it().X), far = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  // a "drape": the cloth moved down 100 mm, as a simulation would leave it
  const drop = (dy) => { const x = it().X; for (let i = 1; i < x.length; i += 3) x[i] -= dy; it().draped = true; app.ev("itemMoved")(it()); };
`;
test("F10 3D State + keeps the garment as it is; Look at It shows it with the document untouched, Back to Now returns; Go Back to It is one undo step; the states are saved in the file and come back", () => {
  const r = boot({ blank: true, three: true, script: `
    return (async () => {` + STATES + `
    drop(100); const s1 = X();
    app.ev("state3Add")(); out.made = S.states3.map(s => s.name);
    drop(50); const now = X();
    app.ev("look3")(S.states3[0].id); out.look = [far(X(), s1) < 1e-3, S.undo.length, !!app.G3.look];
    out.note = app.el("note3d").textContent.slice(0, 40);
    app.ev("look3End")(); out.back = [far(X(), now) < 1e-3, !!app.G3.look];
    const steps = S.undo.length;
    app.ev("state3Back")(S.states3[0].id); out.goBack = [far(X(), s1) < 1e-3, S.undo.length - steps, app.histSteps().steps.slice(-1)[0].n];
    app.undo(); out.undone = far(X(), now) < 1e-3;
    app.redo(); out.redone = far(X(), s1) < 1e-3;
    // saved and opened again
    const file = await new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); });
    out.parts = app.fileParts(file).map(x => x[0]);
    out.inDoc = app.fileDoc(file).states3.map(s => [s.id, s.name, Object.keys(s.cloth).length]);
    app.ev("newDoc")(true); out.blank = S.states3.length;
    app.ev("openFile")("s.pdraft", file, null, true); await app.wait(() => S.pieces.length, "the file");
    app.garmentSync();
    out.reopened = S.states3.map(s => s.name);
    app.ev("look3")(S.states3[0].id); out.lookAgain = far(X(), s1) < 1e-3; app.ev("look3End")();
    const again = await new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); });
    out.same = again.length === file.length && again.every((v, i) => v === file[i]);
    return out; })();` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.made, ["3D State_1"]);
  assert.deepStrictEqual(o.look, [true, o.look[1], true], "looked at: the cloth as the state has it");
  assert.ok(/^Looking at 3D State_1/.test(o.note), o.note);
  assert.deepStrictEqual(o.back, [true, false], "Back to Now: as it was");
  assert.deepStrictEqual(o.goBack, [true, 1, "Go Back to 3D State_1"], "Go Back to It: one step");
  assert.deepStrictEqual([o.undone, o.redone], [true, true]);
  assert.ok(o.parts.includes("states3.bin"), o.parts); assert.deepStrictEqual(o.inDoc, [[1, "3D State_1", 1]]);
  assert.strictEqual(o.blank, 0, "a new document has none");
  assert.deepStrictEqual(o.reopened, ["3D State_1"]); assert.strictEqual(o.lookAgain, true, "the state's cloth, point for point, from the file");
  assert.strictEqual(o.same, true, "saved again: the same bytes");
});

test("F10 a step ends a look; the timeline has 3D State + and a chip a state with its menu; crash recovery keeps the states; files without states open as before", () => {
  const r = boot({ blank: true, three: true, script: STATES + `
    drop(100); app.ev("state3Add")(); drop(30); const now = X();
    app.ev("setTimeline")(true);
    // (Round H1b / 2: the chips are in the History panel's header row)
    const head = () => app.el("timeline").children.filter(c => c.className === "hp-head").pop() || { children: [] };
    out.chips = head().children.filter(c => /tl-s3/.test(c.className)).map(c => c.innerHTML);
    app.el("timeline").children.length = 0; app.ev("look3")(1);                // (the fake page keeps old children when innerHTML is emptied)
    out.chipsLook = head().children.filter(c => /tl-s3/.test(c.className)).map(c => c.innerHTML);
    app.push("Rename"); S.pieces[0].name = "B"; app.commit(); out.ended = [!app.G3.look, far(X(), now) < 1e-3];
    app.menu.children.length = 0; app.ev("state3Menu")(1, 100, 100); out.menu = app.menu.children.map(c => (c.innerHTML || "").replace(/<[^>]*>/g, "")).filter(Boolean);
    const j = JSON.parse(app.docJSON()); out.json = j.states3.map(s => [s.name, Object.keys(s.cloth).map(k => typeof s.cloth[k].x)]);
    app.ev("loadDoc")(j); out.fromJson = S.states3.map(s => s.name);
    delete j.states3; app.ev("loadDoc")(j); out.none = S.states3.length;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.chips, ["3D State +", "3D State_1"]);
  assert.deepStrictEqual(o.chipsLook, ["3D State +", "\u25c9 3D State_1", "Back to Now"], "the state looked at marked by a sign, not by colour alone");
  assert.deepStrictEqual(o.ended, [true, true], "a step ends the look, on the garment as it was");
  assert.deepStrictEqual(o.menu, ["Look at It", "Go Back to It", "Rename\u2026", "Delete"]);
  assert.deepStrictEqual(o.json, [["3D State_1", ["string"]]], "crash recovery: the cloth as base64");
  assert.deepStrictEqual([o.fromJson, o.none], [["3D State_1"], 0]);
});

module.exports = T;
