// Round B / B4 and B5: the gizmo of the 3D window. A handle on the selected pattern where it was clicked: three arrows
// that move it along one axis, a square at the middle that moves it freely in the plane of the screen, three rings that
// turn it about one axis. A right-click while a handle is dragged takes a typed value. Each drag or typed value is one
// undo step; the cloth moves as it is, and the pattern's place in 3D with it.
// The tests run in the booted app with three.js and a renderer that draws nothing: the 3D window is 1000 x 800 pixels.
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
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 30000, maxBuffer: 1 << 28 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after " + (ms || 30000)/1000 + " s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
// two patterns standing in front of where an avatar would be, the camera looking at them a little from the side and from above,
// and what the tests do with the mouse: the tool's own handlers, with events as the 3D window gives them
const DOC = `
  const out = {}, T3 = app.TOOL3.select_move, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("A", 0, 0, 300, 400), sq("B", 400, 0, 300, 400));
  S.pieces[0].p3 = { pos: [0, 1100, 300], q: [0, 0, 0, 1], r: 0 }; S.pieces[1].p3 = { pos: [600, 1100, 300], q: [0, 0, 0, 1], r: 0 }; app.commit(); S.undo.length = 0; S.un.length = 0;
  const A = S.pieces[0], B = S.pieces[1], itA = () => G3.items.get(A.id), itB = () => G3.items.get(B.id);
  // (Round r15 / 8: Gizmo ▸ opens at Screen Coordinate; these tests are of the 3D window's own axes, World Coordinate)
  app.setPrefs({ gizSpace: "world" });
  const cam = (az, el) => Object.assign(v3.cam, { az, el, dist: 3000, tx: 0, ty: 1100, tz: 0 });
  cam(0.6, 0.4);
  const ev = (x, y, more) => ({ clientX: x, clientY: y, button: 0, buttons: 1, ...more });
  const scr = (q) => v3.project(new THREE.Vector3(q[0], q[1], q[2]));
  const press = (x, y, more) => T3.down(ev(x, y, more)), drag = (x, y, more) => T3.move(ev(x, y, more)), let_go = (x, y) => T3.up(ev(x, y));
  const click = (x, y, more) => { if (press(x, y, more)) let_go(x, y); };
  // select A by a click on its middle: the gizmo goes there
  const mid = scr([0, 1100, 300]); click(mid.x, mid.y);
  const geom = () => app.ev("gizGeom")(), hit = (x, y) => { const h = app.ev("gizHit")(ev(x, y)); return h ? h.id : null; };
  // a place on a handle, on the screen: k of the way along an arrow
  const onArrow = (k, f) => { const g = geom(), ax = app.ev("GIZ_AX").find(a => a.k === k); return v3.project(app.ev("gizTip")(g, ax, f || 0.7)); };
  // (undo puts other objects in the document: a pattern is looked up by its id every time)
  const now = (p) => S.pieces.find(q => q.id === p.id), pos = (p) => (now(p).p3 ? now(p).p3.pos.map(v => +v.toFixed(6)) : null), copy = (it) => Array.from(it.X);
  // a place on a ring, on the screen: at angle f round it
  const onRing = (k, f) => v3.project(app.ev("gizRingPt")(geom(), app.ev("GIZ_AX").find(a => a.k === k), f));
  const quat = (p) => now(p).p3.q.map(v => +v.toFixed(6));
  const steps = () => app.histSteps().steps.map(s => s.n);
  const note = () => app.el("note3d").textContent, read = () => [app.el("giz3d").textContent, app.el("giz3d").style.display];
`;

/* ---------- B4: moving ---------- */
test("the gizmo appears on a clicked pattern where it was clicked, always the same size on the screen; every axis has its letter and its own shape, not only its colour", () => {
  const r = boot({ script: DOC + `
    const g = geom(), it = itA(), v = G3.giz.v;
    out.giz = [G3.giz.pid === A.id, Math.hypot(it.X[3*v] - 0, it.X[3*v+1] - 1100) < 30, Math.hypot(g.o2.x - mid.x, g.o2.y - mid.y) < 20];
    // the length of an arrow on the screen, near and far
    const len = () => { const q = geom(), a = scr([q.O.x, q.O.y + q.s, q.O.z]); return Math.hypot(a.x - q.o2.x, a.y - q.o2.y); };
    cam(0, 0.03); out.near = len(); v3.cam.dist = 9000; out.far = len();
    // (Round F / 6) its size in Preferences: Small as it was before, Large
    app.setPrefs({ gizmo: "s" }); out.small = len(); app.setPrefs({ gizmo: "l" }); out.large = len(); app.setPrefs({ gizmo: "m" }); cam(0.6, 0.4);
    out.handles = app.ev("gizHandles")().map(h => h.id);
    app.ev("gizFrame")();
    const o = G3.gizObj;
    out.drawn = [o.grp.visible, +o.grp.scale.x.toFixed(6) === +g.s.toFixed(6), o.grp.position.distanceTo(g.O) < 1e-9];
    out.axes = app.ev("GIZ_AX").map(ax => { const grp = o.parts["move:" + ax.k].g, mesh = grp.children.find(c => c.isMesh && c.geometry.type !== "CylinderGeometry"), lab = grp.children.find(c => c.isSprite);
      return [ax.n, mesh.geometry.type, !!lab, "#" + ax.col.toString(16).padStart(6, "0"), mesh.material.depthTest, lab.position.toArray().map(Math.round).join()]; });
    // hovered: the handle under the pointer is drawn thick, the square larger
    const a = onArrow("x"); T3.hover(ev(a.x, a.y)); app.ev("gizFrame")();
    out.hover = [G3.gizHot, o.parts["move:x"].thick.visible, o.parts["move:y"].thick.visible];
    T3.hover(ev(g.o2.x, g.o2.y)); app.ev("gizFrame")(); out.hoverSq = [G3.gizHot, +o.parts.free.g.scale.x.toFixed(2), o.parts["move:x"].thick.visible];
    T3.hover(ev(5, 5)); app.ev("gizFrame")(); out.hoverOff = [G3.gizHot, +o.parts.free.g.scale.x.toFixed(2)];
    // what picks what
    const ax = onArrow("x"), ay = onArrow("y"), az = onArrow("z");
    out.pick = [hit(g.o2.x, g.o2.y), hit(ax.x, ax.y), hit(ay.x, ay.y), hit(az.x, az.y), hit(ax.x + 3, ax.y + 3), hit(g.o2.x + 200, g.o2.y + 200)];
    // not there without a selection, for a pattern that is not selected, or while the simulation runs
    S.sel = [B.id]; out.other = [!!geom(), (app.ev("gizFrame")(), o.grp.visible)]; S.sel = [A.id]; out.back = !!geom();
    S.cloth = app.normCloth({ ...S.cloth, worker: false }); app.ev("simStart")(); out.sim = [!!geom(), hit(ax.x, ax.y)]; app.ev("simStop")(); out.after = !!geom();
    // … or with another 3D tool in hand
    app.setTool3("pin_box"); out.otherTool = [S.tool3, !!geom()]; app.setTool3("select_move"); out.toolBack = !!geom();
    // a click on the other pattern moves the gizmo there
    const mb = (() => { const it2 = itB(); return v3.project(new THREE.Vector3(it2.X[0] + 100, it2.X[1] - 100, it2.X[2])); })();
    click(mb.x, mb.y); out.moved = [G3.giz.pid === B.id, S.sel.join() === String(B.id)];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.giz, [true, true, true], "on the clicked pattern, at the point of its cloth nearest to the click");
  near(o.near, 82.5, 0.6, "an arrow is half of 165 px long (Medium, the default since Round F: half as big again as before)"); near(o.far, 82.5, 0.6, "the same from three times as far");
  near(o.small, 55, 0.6, "Small: 110 px across"); near(o.large, 110, 0.6, "Large: 220 px across");
  assert.deepStrictEqual(o.handles, ["free", "move:x", "move:y", "move:z", "turn:x", "turn:y", "turn:z"]);
  assert.deepStrictEqual(o.drawn, [true, true, true]);
  assert.deepStrictEqual(o.axes.map(a => a.slice(0, 3)), [["X", "BoxGeometry", true], ["Y", "ConeGeometry", true], ["Z", "SphereGeometry", true]], "a letter and a shape of its own each");
  assert.deepStrictEqual(o.axes.map(a => a[3]), ["#d55e00", "#009e73", "#0072b2"], "vermilion, bluish green and blue: a set that stays apart for colour-blind eyes");
  assert.ok(o.axes.every(a => a[4] === false), "drawn over everything");
  assert.deepStrictEqual(o.axes.map(a => a[5]), ["1,0,0", "0,1,0", "0,0,1"], "the letter beyond the arrow's end");
  assert.deepStrictEqual(o.hover, ["move:x", true, false], "the hovered arrow is drawn thick, the others are not");
  assert.deepStrictEqual(o.hoverSq, ["free", 0.3, false]); assert.deepStrictEqual(o.hoverOff, ["", 0.22]);
  assert.deepStrictEqual(o.pick, ["free", "move:x", "move:y", "move:z", "move:x", null]);
  assert.deepStrictEqual(o.other, [false, false]); assert.strictEqual(o.back, true);
  assert.deepStrictEqual(o.sim, [false, null], "while the simulation runs there is no gizmo: a drag pulls the cloth"); assert.strictEqual(o.after, true);
  assert.deepStrictEqual(o.otherTool, ["pin_box", false], "the gizmo is Select/Move's own"); assert.strictEqual(o.toolBack, true);
  assert.deepStrictEqual(o.moved, [true, true]);
});

test("an arrow moves the pattern along its axis only, however the pointer wanders; the square at the middle moves it freely in the plane of the screen; each drag is one undo step and keeps a drape", () => {
  const r = boot({ script: DOC + `
    const wpp = v3.wpp(geom().O);
    // as if draped: every point a little off where the arrangement puts it
    const it = itA(); for (let i = 0; i < it.X.length; i++) it.X[i] += Math.sin(i)*3; it.draped = true;
    const X0 = copy(it), p0 = pos(A);
    // X: along the arrow, and well off to the side as well
    let a = onArrow("x"), g = geom(), dir = { x: (a.x - g.o2.x), y: (a.y - g.o2.y) }, L = Math.hypot(dir.x, dir.y);
    out.press = press(a.x, a.y);
    drag(a.x + dir.x/L*80 + 31, a.y + dir.y/L*80 - 47);
    out.live = [note(), read()];
    const dX = pos(A)[0] - p0[0];
    out.x = [dX > 20, pos(A)[1] === p0[1], pos(A)[2] === p0[2]];
    out.cloth = copy(it).every((v, i) => Math.abs(v - (X0[i] + (i % 3 === 0 ? dX : 0))) < 1e-3);
    out.before = steps(); let_go(0, 0); out.after = [steps(), !T3.d, note().slice(0, 5), read()[1], it.draped];
    out.kept = copy(itA()).every((v, i) => Math.abs(v - (X0[i] + (i % 3 === 0 ? dX : 0))) < 1e-3);          // the document was brought up to date: the cloth is not thrown back
    out.same = itA() === it;
    app.undo(); out.undone = [pos(A), steps().length, app.histSteps().at];
    app.redo(); out.redone = Math.abs(pos(A)[0] - p0[0] - dX) < 1e-6;
    // Y: straight up the screen is up in the scene
    a = onArrow("y"); const y0 = pos(A)[1];
    press(a.x, a.y); drag(a.x, a.y - 100); let_go(a.x, a.y - 100);
    out.y = [pos(A)[1] - y0, pos(A)[0] - p0[0] - dX, pos(A)[2] - p0[2], 100*wpp];
    // Z
    a = onArrow("z"); g = geom(); dir = { x: a.x - g.o2.x, y: a.y - g.o2.y }; const z0 = pos(A)[2], x1 = pos(A)[0], y1 = pos(A)[1];
    press(a.x, a.y); drag(a.x + dir.x, a.y + dir.y); let_go(0, 0);
    out.z = [pos(A)[2] - z0 > 10, pos(A)[0] === x1, pos(A)[1] === y1];
    // the square: freely, in the plane of the screen
    g = geom(); const q0 = pos(A);
    press(g.o2.x, g.o2.y); drag(g.o2.x + 60, g.o2.y - 80); out.freeNote = read()[0]; let_go(0, 0);
    const by = pos(A).map((v, i) => v - q0[i]), view = v3.camera().getWorldDirection(new THREE.Vector3());
    out.free = [Math.hypot(by[0], by[1], by[2]), 100*v3.wpp(new THREE.Vector3(q0[0], q0[1], q0[2])), by[0]*view.x + by[1]*view.y + by[2]*view.z];
    out.steps = steps();
    // the gizmo went with the pattern
    out.follows = Math.hypot(geom().o2.x - (g.o2.x + 60), geom().o2.y - (g.o2.y - 80)) < 2;
    // a press and a release in one place moves nothing and is no step
    a = onArrow("x"); const n = steps().length, q1 = pos(A); press(a.x, a.y); let_go(a.x, a.y); out.click = [steps().length === n, pos(A).join() === q1.join()];
    // both selected patterns move together; a locked one stays
    S.sel = [A.id, B.id]; const b0 = itB().X[0]; a = onArrow("x"); g = geom(); press(a.x, a.y); drag(a.x + (a.x - g.o2.x), a.y + (a.y - g.o2.y)); let_go(0, 0);
    out.both = [itB().X[0] - b0 > 10, pos(B)[0] > 610, steps().length === n + 1];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.press, true);
  assert.ok(/^Moved \d+\.\d mm along X · right-click to type the value, Esc gives it up$/.test(o.live[0]), o.live[0]); assert.ok(/^Moved \d+\.\d mm along X$/.test(o.live[1][0])); assert.strictEqual(o.live[1][1], "block");
  assert.deepStrictEqual(o.x, [true, true, true], "along X only: Y and Z are untouched"); assert.strictEqual(o.cloth, true, "the cloth moved as it was, the drape with it");
  assert.deepStrictEqual(o.before, []); assert.deepStrictEqual(o.after, [["Move in 3D"], true, "No av", "none", true]);
  assert.strictEqual(o.kept, true); assert.strictEqual(o.same, true);
  assert.deepStrictEqual(o.undone, [[0, 1100, 300], 1, 0]); assert.strictEqual(o.redone, true);
  near(o.y[0], o.y[3], 0.03*o.y[3], "100 px up the screen is about 100 px of the scene up (the camera looks a little down)"); near(o.y[1], 0, 1e-6); near(o.y[2], 0, 1e-6);
  assert.deepStrictEqual(o.z, [true, true, true]);
  assert.ok(/^Moved \d+\.\d mm$/.test(o.freeNote), o.freeNote);
  near(o.free[0], o.free[1], 2, "100 px on the screen"); near(o.free[2], 0, 1e-3, "nothing of it towards or away from the viewer");
  assert.deepStrictEqual(o.steps, ["Move in 3D", "Move in 3D", "Move in 3D", "Move in 3D"]);
  assert.strictEqual(o.follows, true); assert.deepStrictEqual(o.click, [true, true]); assert.deepStrictEqual(o.both, [true, true, true]);
});

test("a right-click while an arrow or the square is dragged opens a small box for the distance: Enter applies it exactly as one undo step, Esc goes back to dragging; Esc without the box gives the drag up", () => {
  const r = boot({ script: DOC + `
    const asked = []; let answer = { v: 250 };
    app.answer = (title, fields, opts) => { asked.push([title, fields.map(f => [f.label, f.unit, f.val]), typeof opts.onCancel, T3.d && T3.d.typing]); return answer; };
    // an arrow: dragged a little, then the right button as well (the left still down): 250 mm typed
    let a = onArrow("x"), g = geom(); const dir = { x: a.x - g.o2.x, y: a.y - g.o2.y };
    press(a.x, a.y); drag(a.x + dir.x*0.5, a.y + dir.y*0.5); const live = pos(A)[0];
    drag(a.x + dir.x*0.5, a.y + dir.y*0.5, { button: 2, buttons: 3 });
    out.typed = [pos(A), !T3.d, steps(), read()[1], live > 5 && live !== 250];
    app.undo(); out.undone = pos(A); app.redo();
    // a minus sign goes the other way; along Y
    answer = { v: -40.5 }; a = onArrow("y"); press(a.x, a.y); drag(a.x, a.y - 30); drag(a.x, a.y - 30, { button: 2, buttons: 3 });
    out.minus = [pos(A), steps().length];
    // Esc in the box: back to dragging, nothing lost, nothing applied; then the drag goes on and is let go as usual
    answer = null; a = onArrow("x"); g = geom(); press(a.x, a.y); drag(a.x + 40, a.y); const at40 = pos(A)[0];
    drag(a.x + 40, a.y, { button: 2, buttons: 3 });
    out.esc = [!!T3.d, T3.d && T3.d.typing, pos(A)[0] === at40, steps().length];
    drag(a.x + 80, a.y); out.goesOn = pos(A)[0] > at40; let_go(0, 0); out.escSteps = steps().length;
    // the square: the typed distance goes the way it was dragged; with nothing dragged yet there is no way to go
    answer = { v: 100 }; g = geom(); let q0 = pos(A);
    press(g.o2.x, g.o2.y); drag(g.o2.x + 30, g.o2.y); drag(g.o2.x + 30, g.o2.y, { button: 2, buttons: 3 });
    const by = pos(A).map((v, i) => v - q0[i]); out.free = [Math.hypot(by[0], by[1], by[2]), by[0] > 0, !T3.d];
    g = geom(); q0 = pos(A); press(g.o2.x, g.o2.y); drag(g.o2.x, g.o2.y, { button: 2, buttons: 3 });
    out.noWay = [toasts[toasts.length-1], !!T3.d, pos(A).join() === q0.join()]; let_go(0, 0);
    out.asked = asked;
    // Esc with no box open: everything back where it was, no step
    const n = steps().length, X0 = copy(itA()); q0 = pos(A);
    a = onArrow("z"); g = geom(); press(a.x, a.y); drag(a.x + (a.x - g.o2.x), a.y + (a.y - g.o2.y)); out.midway = pos(A).join() !== q0.join();
    app.key("Escape"); out.gaveUp = [pos(A).join() === q0.join(), copy(itA()).every((v, i) => v === X0[i]), !T3.d, steps().length === n, read()[1]];
    let_go(0, 0); out.stillNone = steps().length === n;
    // a pattern put back to where its place in the 2D window puts it (Reset 2D Arrangement takes its place away; since Round F
    // every pattern has a place again at once) keeps that place exactly when a drag on it is given up
    delete now(B).p3; app.commit(); const b0 = pos(B).join(); S.sel = []; const mb = v3.project(new THREE.Vector3(itB().X[0] + 100, itB().X[1] - 100, itB().X[2])); click(mb.x, mb.y); out.onB = G3.giz.pid === B.id;
    a = onArrow("x"); press(a.x, a.y); drag(a.x + 50, a.y); out.bMoved = pos(B).join() !== b0; app.key("Escape"); out.bBack = pos(B).join() === b0;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.typed, [[250, 1100, 300], true, ["Move in 3D"], "none", true], "exactly 250 mm from where the drag began, not from where the pointer was");
  assert.deepStrictEqual(o.undone, [0, 1100, 300], "one undo step for the drag and the typed value together");
  assert.deepStrictEqual(o.minus, [[250, 1059.5, 300], 2]);
  assert.deepStrictEqual(o.esc, [true, false, true, 2], "Esc returns to dragging"); assert.strictEqual(o.goesOn, true); assert.strictEqual(o.escSteps, 3);
  near(o.free[0], 100, 1e-6, "100 mm"); assert.deepStrictEqual(o.free.slice(1), [true, true]);
  assert.deepStrictEqual(o.noWay, ["Drag the square a little first: the distance goes the way it was dragged", true, true]);
  assert.deepStrictEqual(o.asked.map(a => a[0]), ["Move along X", "Move along Y", "Move along X", "Move", "Move"]);
  assert.deepStrictEqual(o.asked[0][1][0].slice(0, 2), ["Distance", "mm"]); assert.ok(o.asked[0][1][0][2] > 5, "the box starts with the distance dragged so far");
  assert.ok(o.asked.every(a => a[2] === "function" && a[3] === true));
  assert.strictEqual(o.midway, true); assert.deepStrictEqual(o.gaveUp, [true, true, true, true, "none"]); assert.strictEqual(o.stillNone, true);
  assert.deepStrictEqual([o.onB, o.bMoved, o.bBack], [true, true, true]);
});

test("the button let go while the box is open: after Esc the handle follows the pointer without a button, a click sets it down, a right-click opens the box again", () => {
  const r = boot({ script: DOC + `
    let a = onArrow("x"), g = geom();
    press(a.x, a.y); drag(a.x + 40, a.y);
    drag(a.x + 40, a.y, { button: 2, buttons: 3 });                    // the box opens (the program's own dialog, not answered by the test)
    out.open = [app.el("dlg").style.display, T3.d.typing];
    drag(a.x + 90, a.y); const held = pos(A)[0]; out.still = held;       // while typing the pointer moves nothing
    let_go(a.x + 90, a.y); out.inHand = [!!T3.d, T3.d.loose, steps().length];
    app.el("q:dlg").onclick();                                           // Cancel (what Esc does)
    out.back = [app.el("dlg").style.display, T3.d.typing, /click to set it down/.test(note())];
    T3.hover(ev(a.x + 140, a.y)); out.follows = pos(A)[0] > held;
    T3.menu(ev(a.x + 140, a.y)); out.again = [app.el("dlg").style.display, T3.d.typing];
    app.el("q:dlg").onclick();
    press(a.x + 140, a.y); let_go(a.x + 140, a.y);
    out.down = [!T3.d, steps(), pos(A)[0] > held];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.open, ["block", true]); assert.deepStrictEqual(o.inHand, [true, true, 0]);
  assert.deepStrictEqual(o.back, ["none", false, true]); assert.strictEqual(o.follows, true); assert.deepStrictEqual(o.again, ["block", true]);
  assert.deepStrictEqual(o.down, [true, ["Move in 3D"], true]);
});

test("several patterns selected: a plain click on one of them leaves that one selected (and gives it the gizmo), a drag on it moves them all together", () => {
  const r = boot({ script: DOC + `
    const onB = () => v3.project(new THREE.Vector3(itB().X[0] + 100, itB().X[1] - 100, itB().X[2]));
    S.sel = [A.id, B.id];
    let q = onB(); const a0 = pos(A), b0 = pos(B);
    press(q.x, q.y); drag(q.x + 60, q.y); let_go(q.x + 60, q.y);
    out.dragged = [S.sel.length, pos(A)[0] - a0[0] > 20, Math.abs((pos(A)[0] - a0[0]) - (pos(B)[0] - b0[0])) < 1e-6, steps()];
    // (somewhere else on it: where it was taken hold of, the gizmo's square now lies)
    q = v3.project(new THREE.Vector3(itB().X[0] + 220, itB().X[1] - 300, itB().X[2])); out.free = hit(q.x, q.y); click(q.x, q.y);
    out.clicked = [S.sel.join() === String(B.id), G3.giz.pid === B.id, steps().length];
    // with Ctrl a click adds and takes away, as before
    const m = scr(pos(A)); click(m.x, m.y, { ctrlKey: true }); out.ctrl = S.sel.length; click(m.x, m.y, { ctrlKey: true }); out.ctrlOff = S.sel.join() === String(B.id);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.dragged, [2, true, true, ["Move in 3D"]], "a drag moves both and keeps both selected");
  assert.strictEqual(o.free, null); assert.deepStrictEqual(o.clicked, [true, true, 1], "a click without a drag: that pattern alone, and no undo step");
  assert.deepStrictEqual([o.ctrl, o.ctrlOff], [2, true]);
});

/* ---------- B5: turning ---------- */
test("the three rings: each in a line of its own (whole, dashed, dotted) with its axis's shape and letter on it; a ring is picked along its whole length, an arrow goes before a ring where they cross", () => {
  const r = boot({ script: DOC + `
    app.ev("gizFrame")();
    const o = G3.gizObj;
    // (Round F / 6) a ring is a tube: X one whole piece, Y in dashes (pieces of tube), Z in dots
    out.rings = app.ev("GIZ_AX").map(ax => { const g = o.parts["turn:" + ax.k].g, tube = g.children[0], mk = g.children.find(c => c.isMesh), lab = g.children.find(c => c.isSprite), m0 = tube.children[0];
      const style = tube.children.length === 1 && m0.geometry.type === "TorusGeometry" ? "whole" : tube.children.every(c => c.geometry.type === "TorusGeometry") ? "dashed" : tube.children.every(c => c.geometry.type === "SphereGeometry") ? "dotted" : "?";
      return [ax.n, style, tube.children.length, mk.geometry.type, !!lab, m0.material.depthTest, "#" + m0.material.color.getHexString()]; });
    out.pick = [];
    for (const k of ["x", "y", "z"]) for (const f of [0.4, 2.2, 4.1, 5.6]) { const q = onRing(k, f); out.pick.push(hit(q.x, q.y)); }
    // where a ring crosses an arrow, the arrow is meant
    const ax = app.ev("GIZ_AX")[0], cross = v3.project(app.ev("gizTip")(geom(), ax, app.ev("GIZ").ring)); out.cross = hit(cross.x, cross.y);
    // hovered: drawn thick
    const q = onRing("y", 2.2); T3.hover(ev(q.x, q.y)); app.ev("gizFrame")();
    out.hover = [G3.gizHot, o.parts["turn:y"].thick.visible, o.parts["turn:x"].thick.visible, o.parts["move:y"].thick.visible];
    // while one is dragged the other handles stand back
    press(q.x, q.y); drag(q.x + 30, q.y); app.ev("gizFrame")();
    out.dragging = [o.parts["turn:y"].g.visible, o.parts["turn:x"].g.visible, o.parts["move:x"].g.visible, o.parts["turn:y"].thick.visible];
    app.key("Escape"); app.ev("gizFrame")(); out.afterEsc = [o.parts["turn:x"].g.visible, o.parts["move:x"].g.visible];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.rings.map(x => x.slice(0, 5)), [["X", "whole", 1, "BoxGeometry", true], ["Y", "dashed", 24, "ConeGeometry", true], ["Z", "dotted", 40, "SphereGeometry", true]],
    "X whole, Y dashed, Z dotted; the axis's shape and letter on each");
  assert.ok(o.rings.every(x => x[5] === false)); assert.deepStrictEqual(o.rings.map(x => x[6]), ["#d55e00", "#009e73", "#0072b2"]);
  assert.deepStrictEqual(o.pick, ["turn:x", "turn:x", "turn:x", "turn:x", "turn:y", "turn:y", "turn:y", "turn:y", "turn:z", "turn:z", "turn:z", "turn:z"].map((id, k) => (o.pick[k] && o.pick[k].startsWith("move") ? o.pick[k] : id)),
    "every place on a ring picks that ring (unless an arrow lies across it there)");
  assert.ok(o.pick.filter(id => id.startsWith("turn")).length >= 10, o.pick.join());
  assert.strictEqual(o.cross, "move:x");
  assert.deepStrictEqual(o.hover, ["turn:y", true, false, false]);
  assert.deepStrictEqual(o.dragging, [true, false, false, true]); assert.deepStrictEqual(o.afterEsc, [true, true]);
});

test("a ring turns the pattern about its axis, round the place the gizmo sits on, with the angle written while it turns; Shift goes in steps of 15°; the cloth turns as it is and agrees with the pattern's place in 3D; one undo step", () => {
  const r = boot({ script: DOC + `
    const C = app.ev("SIM3D"), it = itA(), O = geom().O.clone(), X0 = copy(it), q0 = quat(A), p0 = pos(A);
    const far = (X) => { const d = []; for (let i = 0; i < X.length; i += 3) d.push(Math.hypot(X[i] - O.x, X[i+1] - O.y, X[i+2] - O.z)); return d; };
    const d0 = far(X0);
    // the Y ring, taken at its near side and pulled along the way it runs on the screen
    const f = 0.9, a = onRing("y", f), b = onRing("y", f + 0.3), dir = { x: b.x - a.x, y: b.y - a.y }, L = Math.hypot(dir.x, dir.y);
    out.hit = hit(a.x, a.y);
    // the place taken follows the pointer: a little way along the ring turns it by the angle that moves that place as far
    const tn = (() => { const b1 = onRing("y", f + 0.01), l = Math.hypot(b1.x - a.x, b1.y - a.y); return { x: (b1.x - a.x)/l, y: (b1.y - a.y)/l }; })();
    press(a.x, a.y); drag(a.x + tn.x*10, a.y + tn.y*10);
    const took = v3.project(app.ev("gizRingPt")({ O, s: geom().s }, app.ev("GIZ_AX")[1], f + T3.d.val.deg*Math.PI/180));
    out.follows = Math.hypot(took.x - (a.x + tn.x*10), took.y - (a.y + tn.y*10));
    drag(a.x + dir.x/L*40, a.y + dir.y/L*40);
    out.live = [note(), read()];
    const deg = T3.d.val.deg;
    out.deg = deg;
    out.anchor = geom().O.distanceTo(O);
    out.rigid = far(copy(it)).every((d, i) => Math.abs(d - d0[i]) < 0.01);
    out.yKept = copy(it).every((v, i) => i % 3 !== 1 || Math.abs(v - X0[i]) < 0.01);
    // with Shift: whole steps of 15 degrees
    drag(a.x + dir.x/L*40, a.y + dir.y/L*40, { shiftKey: true }); out.shift = [T3.d.val.deg, note()];
    drag(a.x + dir.x/L*40, a.y + dir.y/L*40);
    let_go(0, 0);
    out.steps = steps();
    // what the document holds: the turn, as the pattern's place in 3D; the cloth is exactly what that place gives
    const want = C.qMul(C.qAxis([0, 1, 0], deg), q0).map(v => +v.toFixed(6));
    out.q = [quat(A), want];
    const p = now(A), again = C.placeVerts(it.mesh.xy, it.mesh.c, p.p3);
    out.agree = Math.max(...copy(itA()).map((v, i) => Math.abs(v - again[i])));
    out.same = itA() === it;
    out.pos = [Math.hypot(p.p3.pos[0] - O.x, p.p3.pos[1] - O.y, p.p3.pos[2] - O.z), Math.hypot(p0[0] - O.x, p0[1] - O.y, p0[2] - O.z)];
    app.undo(); out.undone = [quat(A), pos(A)]; app.redo(); out.redone = quat(A).join() === want.join();
    // turned the other way round the ring: a negative angle
    const a2 = onRing("y", f), b2 = onRing("y", f - 0.3), dir2 = { x: b2.x - a2.x, y: b2.y - a2.y }, L2 = Math.hypot(dir2.x, dir2.y);
    press(a2.x, a2.y); drag(a2.x + dir2.x/L2*30, a2.y + dir2.y/L2*30); out.back = [T3.d.val.deg < 0, note()]; app.key("Escape");
    out.gaveUp = [quat(A).join() === want.join(), steps().length];
    // a drape is turned as it hangs, and stays
    const itd = itA(); for (let i = 0; i < itd.X.length; i++) itd.X[i] += Math.sin(i)*4; itd.draped = true;
    const D0 = copy(itd), O2 = geom().O.clone(), gap = (X) => Math.hypot(X[0] - X[30], X[1] - X[31], X[2] - X[32]);
    const c = onRing("x", 1.0), e2 = onRing("x", 1.3), dc = { x: e2.x - c.x, y: e2.y - c.y }, Lc = Math.hypot(dc.x, dc.y);
    press(c.x, c.y); drag(c.x + dc.x/Lc*50, c.y + dc.y/Lc*50); let_go(0, 0);
    out.drape = [itA() === itd, itd.draped, Math.abs(gap(copy(itd)) - gap(D0)) < 0.01, copy(itd).some((v, i) => Math.abs(v - D0[i]) > 5), geom().O.distanceTo(O2) < 0.01];
    out.steps2 = steps();
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.hit, "turn:y");
  assert.ok(/^Turned \d+\.\d° about Y · right-click to type the value, Esc gives it up$/.test(o.live[0]), o.live[0]); assert.ok(/^Turned \d+\.\d° about Y$/.test(o.live[1][0]), o.live[1][0]); assert.strictEqual(o.live[1][1], "block");
  assert.ok(o.deg > 5 && o.deg < 120, "a positive angle, anticlockwise seen from above: " + o.deg);
  assert.ok(o.follows < 1.5, "the place taken stays under the pointer: " + o.follows + " px off after 10 px");
  near(o.anchor, 0, 1e-3, "the place the gizmo sits on does not move"); assert.strictEqual(o.rigid, true, "every point keeps its distance from it"); assert.strictEqual(o.yKept, true, "about Y: no point changes its height");
  assert.strictEqual(o.shift[0] % 15, 0); assert.ok(/^Turned \d+\.0° about Y/.test(o.shift[1]), o.shift[1]);
  assert.deepStrictEqual(o.steps, ["Turn in 3D"]);
  assert.deepStrictEqual(o.q[0], o.q[1], "the turn is in the pattern's place in 3D");
  assert.ok(o.agree < 0.01, "the cloth is where that place puts it: " + o.agree); assert.strictEqual(o.same, true, "the cloth was not made again");
  near(o.pos[0], o.pos[1], 1e-3, "the pattern's middle went round the gizmo");
  assert.deepStrictEqual(o.undone, [[0, 0, 0, 1], [0, 1100, 300]]); assert.strictEqual(o.redone, true);
  assert.strictEqual(o.back[0], true); assert.ok(/^Turned −\d+\.\d° about Y/.test(o.back[1]), o.back[1]); assert.deepStrictEqual(o.gaveUp, [true, 1]);
  assert.deepStrictEqual(o.drape, [true, true, true, true, true], "the draped cloth is turned as it hangs");
  assert.deepStrictEqual(o.steps2, ["Turn in 3D", "Turn in 3D"]);
});

test("a right-click while a ring is dragged opens the box for the angle: Enter turns by exactly that, as one undo step, Esc goes back to turning; the turn is saved with the pattern's place in 3D and comes back from the file", () => {
  const r = boot({ script: DOC + `
    const C = app.ev("SIM3D"), asked = []; let answer = { v: 90 };
    app.answer = (title, fields, opts) => { asked.push([title, fields.map(f => [f.label, f.unit, f.val]), opts.hint]); return answer; };
    const O = geom().O.clone();
    let a = onRing("y", 0.9);
    press(a.x, a.y); drag(a.x + 25, a.y + 5); drag(a.x + 25, a.y + 5, { button: 2, buttons: 3 });
    out.typed = [quat(A), C.qAxis([0, 1, 0], 90).map(v => +v.toFixed(6)), !T3.d, steps()];
    // a quarter turn about Y round the gizmo: what was to the avatar's left of it is now in front of it
    const it = itA(); out.O = geom().O.distanceTo(O);
    app.undo(); out.undone = quat(A); app.redo();
    // Esc in the box: back to turning
    answer = null; a = onRing("z", 2.0); press(a.x, a.y); drag(a.x, a.y + 30); const live = T3.d.val.deg;
    drag(a.x, a.y + 30, { button: 2, buttons: 3 }); out.esc = [!!T3.d, T3.d.typing, T3.d.val.deg === live, steps().length]; app.key("Escape");
    // a negative angle about X, typed
    answer = { v: -45 }; a = onRing("x", 1.0); press(a.x, a.y); drag(a.x + 10, a.y + 10); drag(a.x + 10, a.y + 10, { button: 2, buttons: 3 });
    const want = C.qMul(C.qAxis([1, 0, 0], -45), C.qAxis([0, 1, 0], 90)).map(v => +v.toFixed(6));
    out.two = [quat(A), want, steps()];
    out.asked = asked;
    // saved and opened again: the same turn, and the cloth stands as it was turned
    const before = copy(itA());
    let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
    out.inFile = app.fileDoc(file).pieces[0].p3.q.map(v => +v.toFixed(6));
    app.resetArrangement2(false); out.reset = JSON.stringify(quat(S.pieces[0])) === "[0,0,0,1]";      // (since Round F: back to the place the 2D window gives it, unturned)
    app.ev("openFile")("turned.pdraft", file, null, true);
    out.opened = [quat(S.pieces[0]), Math.max(...copy(G3.items.get(S.pieces[0].id)).map((v, i) => Math.abs(v - before[i]))), app.histSteps().steps.map(x => x.n)];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.typed[0], o.typed[1], "exactly 90° about Y, from how it stood when the drag began"); assert.deepStrictEqual(o.typed.slice(2), [true, ["Turn in 3D"]]);
  near(o.O, 0, 1e-3); assert.deepStrictEqual(o.undone, [0, 0, 0, 1], "one undo step");
  assert.deepStrictEqual(o.esc, [true, false, true, 1], "Esc returns to turning");
  assert.deepStrictEqual(o.two[0], o.two[1], "a second turn about X goes on top of the first"); assert.deepStrictEqual(o.two[2], ["Turn in 3D", "Turn in 3D"]);
  assert.deepStrictEqual(o.asked.map(a => a[0]), ["Turn about Y", "Turn about Z", "Turn about X"]);
  assert.deepStrictEqual(o.asked[0][1][0].slice(0, 2), ["Angle", "°"]); assert.ok(/about the Y axis/.test(o.asked[0][2]));
  assert.deepStrictEqual(o.inFile, o.two[1], "the turn is in the file, with the pattern's place in 3D"); assert.strictEqual(o.reset, true);
  assert.deepStrictEqual(o.opened[0], o.two[1]); assert.ok(o.opened[1] < 0.01, "the cloth stands as it was turned: " + o.opened[1]);
  assert.deepStrictEqual(o.opened[2], ["Turn in 3D", "Turn in 3D"]);
});

module.exports = T;
