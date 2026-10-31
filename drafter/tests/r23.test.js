// Round r23 (28 Oct 2026): a clean, identical start (batch 1), the toolbars' places (2), the 2D view centred on the origin (3), the
// layout reset (4), lights you can see (5), the render window (6), the quality render (7) and the schematic render (8).
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 60 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}

/* ---- batch 1: every start looks the same ---- */
// what a long session could have left behind: every kind of view state, and preferences
const LEFT = {
  "pdraft:ui": JSON.stringify({ layout: "3d", split: 0.27, panelW: 500, obH: 0.7, obFold: true, obFloat: { x: 10, y: 40 }, float2: { x: 5, y: 5, w: 400, h: 300 },
    timeline: true, render: "mono", mesh2: true, render3: "mono", wire3: true, joints3: true, strain3: true, stress3: true, arrPts: true, bv3: true, suit3: true,
    show3d: { garment: false, shadow3: true, lights3: true, names3: true }, jointMode: "ik", ikEdit: "full",
    unbuilt: false, dock2: "top", dock3: "top", jointSize: 14, jointLimits: false, grid3b: 1.5, ikSym: false, avUnit: "cm", mapUnit: { stress: "Nm" } }),
  "pdraft:view": JSON.stringify({ sewing: true, angle: true, grading: true, sa: false, lockAll: true }),
  "pdraft:prefs": JSON.stringify({ wheelRev: true, labelHalo: false, unit: "cm", gizmo: "l", openDisplay: true }),
  "pdraft:avatar": JSON.stringify({ name: "Marty", height: 1800, display: "grey", showCol: true, panel: true, cell: 14 }),
};
const START = `return { ui: S.ui, show: S.show, prefs: S.prefs, av: S.av, avSet: S.avSet, view3: [app.ev("show3On")("shadow3"), app.ev("show3On")("lights3"), app.ev("mapOn3")()] };`;

test("r23 / 1: a start after a long session looks as a fresh start: both windows, no avatar, no map, default styles and switches, the panels as they start", () => {
  const fresh = boot({ blank: true, script: START }).result, left = boot({ blank: true, storage: LEFT, script: START }).result;
  assert.strictEqual(fresh.ui.layout, "both", "both windows side by side");
  assert.strictEqual(fresh.av, null, "no avatar");
  assert.deepStrictEqual(fresh.view3, [false, false, false], "no map, no shadow, no light marks");
  for (const k of ["layout", "split", "panelW", "obH", "obFold", "obFloat", "float2", "float3", "timeline", "render", "mesh2", "render3", "wire3", "joints3", "strain3", "fit3", "stress3", "press3", "arrPts", "bv3", "suit3", "show3d", "jointMode", "ikEdit"])
    assert.deepStrictEqual(left.ui[k], fresh.ui[k], "view state starts at its default: " + k);
  assert.deepStrictEqual(left.show, fresh.show, "the 2D switches at their defaults");
  assert.deepStrictEqual(left.view3, [false, false, false]);
  assert.strictEqual(left.av, null);
  assert.deepStrictEqual([left.avSet.display, left.avSet.showCol, left.avSet.panel], ["textured", false, false], "the avatar's display style and collision view at their defaults");
});

test("r23 / 1: preferences come back: Settings' choices (wheel, halo, unit, gizmo, display settings on opening), the toolbars' places, show-unbuilt, the joint panel's size and limits, the maps' units, the avatar's collision detail", () => {
  const o = boot({ blank: true, storage: LEFT, script: START }).result;
  assert.deepStrictEqual([o.prefs.wheelRev, o.prefs.labelHalo, o.prefs.unit, o.prefs.gizmo, o.prefs.openDisplay], [true, false, "cm", "l", true]);
  assert.deepStrictEqual([o.ui.dock2, o.ui.dock3, o.ui.unbuilt, o.ui.jointSize, o.ui.jointLimits, o.ui.grid3b, o.ui.ikSym, o.ui.avUnit, o.ui.mapUnit], ["top", "top", false, 14, false, 1.5, false, "cm", { stress: "Nm" }]);
  assert.strictEqual(o.avSet.cell, 14);
});

test("r23 / 1: only preferences are written: view state changed in a session is not kept for the next", () => {
  const r = boot({ blank: true, script: `
    app.setLayout("3d"); app.ev("setPanels")({ panelW: 420 }); app.ev("setView")("angle", true); app.ev("setRender")("mono"); app.setTimeline(true);
    app.setPrefs({ wheelRev: true }); app.ev("setDock")("2D", "top");
    return [JSON.parse(app.storage.get("pdraft:ui")), app.storage.get("pdraft:view") || null, JSON.parse(app.storage.get("pdraft:prefs")).wheelRev];` });
  const [ui, view, wheel] = r.result;
  assert.deepStrictEqual(Object.keys(ui).sort(), app_prefs().sort(), "the window record holds the preferences only");
  assert.strictEqual(ui.dock2, "top"); assert.strictEqual(view, null); assert.strictEqual(wheel, true);
  const next = boot({ blank: true, storage: { "pdraft:ui": JSON.stringify(ui), "pdraft:prefs": JSON.stringify({ wheelRev: true }) }, script: "return [S.ui.layout, S.ui.panelW, S.show.angle, S.ui.render, S.ui.timeline, S.ui.dock2, S.prefs.wheelRev];" });
  assert.deepStrictEqual(next.result, ["both", 276, false, "front", false, "top", true]);
});
// the keys of S.ui that are preferences (UI_PREFS) and are written with their defaults (the maps' units and scales only when set)
const app_prefs = () => ["unbuilt", "dock2", "dock3", "jointSize", "jointLimits", "ikSym", "blendFav", "avW", "avH", "avUnit", "avLinkW", "avLinkH"];

test("r23 / 1: a file's display settings still come back only with Open Files with Their Display Settings (the r17b rule)", () => {
  const o = boot({ blank: true, script: `
    const sq = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], true)); S.pieces.push(sq); app.commit();
    app.ev("setView")("angle", true); app.ev("setRender")("mono");
    const d = JSON.parse(JSON.stringify(app.ev("docObj")()));
    app.ev("setView")("angle", false); app.ev("setRender")("front");
    app.ev("loadDoc")(JSON.parse(JSON.stringify(d))); const off = [S.show.angle, S.ui.render];
    app.setPrefs({ openDisplay: true }); app.ev("loadDoc")(JSON.parse(JSON.stringify(d)));
    return { off, on: [S.show.angle, S.ui.render] };` }).result;
  assert.deepStrictEqual(o.off, [false, "front"]); assert.deepStrictEqual(o.on, [true, "mono"]);
});

/* ---- batch 2: the toolbars' places ---- */
test("r23 / 2: the toolbars start upright along the outer edges (3D at the left of its window, 2D at the right of its); a toolbar moved is kept across starts and left alone by the layout reset", () => {
  const fresh = boot({ blank: true, script: "return [S.ui.dock3, S.ui.dock2];" }).result;
  assert.deepStrictEqual(fresh, ["left", "right"]);
  const r = boot({ blank: true, script: `
    const rail = app.el("rail"), drag = (id, x0, y0, x1, y1) => { app.fireOn(id, "pointerdown", { target: app.el(id), button: 0, clientX: x0, clientY: y0, pointerId: 1 }); app.fireOn(id, "pointermove", { clientX: x1, clientY: y1 }); app.fireOn(id, "pointerup", { type: "pointerup", clientX: x1, clientY: y1 }); };
    drag("rail", 980, 700, 400, 20); drag("rail3d", 20, 600, 500, 8);
    const moved = [S.ui.dock2, S.ui.dock3];
    app.ev("resetLayout")(); const reset = [S.ui.dock2, S.ui.dock3];
    return { moved, reset, saved: app.storage.get("pdraft:ui") };` }).result;
  assert.deepStrictEqual(r.moved, ["top", "top"]);
  assert.deepStrictEqual(r.reset, ["top", "top"], "the layout reset leaves them where they were moved");
  const next = boot({ blank: true, storage: { "pdraft:ui": r.saved }, script: "app.ev('resetLayout')(); return [S.ui.dock2, S.ui.dock3];" }).result;
  assert.deepStrictEqual(next, ["top", "top"], "kept across a restart and a layout reset");
});

test("r23 / 2: Reset Toolbars (Settings, and More ▸ on a right-click on a toolbar's empty part) puts both back; a right-click on a tool opens no toolbar menu", () => {
  const o = boot({ blank: true, storage: { "pdraft:ui": JSON.stringify({ dock2: "top", dock3: "top" }) }, script: `
    const out = {};
    out.start = [S.ui.dock2, S.ui.dock3];
    const row = app.MENUS.settings().find(x => x.n === "Reset Toolbars"); out.row = !!row;
    row.f(); out.settings = [S.ui.dock2, S.ui.dock3, JSON.parse(app.storage.get("pdraft:ui")).dock3];
    app.ev("setDock")("3D", "top");
    app.menu.children.length = 0; app.el("menu").style.display = "none";
    app.fireOn("rail3d", "contextmenu", { target: { id: "a tool" }, clientX: 30, clientY: 300 }); out.onTool = app.el("menu").style.display;
    app.fireOn("rail3d", "contextmenu", { target: app.el("rail3d"), clientX: 30, clientY: 300 });
    out.menu = [app.el("menu").style.display, app.menu.children.some(c => /<span>More<\\/span>/.test(c.innerHTML))];
    out.rows = app.ev("toolbarRows")("3D").map(x => x.n);
    app.ev("toolbarRows")("3D").find(x => x.n === "Reset Toolbars").f(); out.byMenu = [S.ui.dock2, S.ui.dock3];
    return out;` }).result;
  assert.deepStrictEqual(o.start, ["top", "top"]);
  assert.strictEqual(o.row, true);
  assert.deepStrictEqual(o.settings, ["right", "left", "left"], "back, and that is what is kept");
  assert.notStrictEqual(o.onTool, "block", "a tool keeps its own right-click");
  assert.deepStrictEqual(o.menu, ["block", true]);
  assert.deepStrictEqual(o.rows, ["3D Toolbar at the Left", "3D Toolbar at the Top", "Reset Toolbars"]);
  assert.deepStrictEqual(o.byMenu, ["right", "left"]);
});

/* ---- batch 3: the 2D view centred on the origin ---- */
// where the axes cross on the screen, against the drawing area's middle, after each case; the panning first moves it off the middle
const CENTRE = `
  const out = {}, size = (w, h) => { app.cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: w, height: h }); };
  const off = () => { const o = app.toS({ x: 0, y: 0 }), W = app.ev("W"), H = app.ev("H"); return [+(o.x - W/2).toFixed(3), +(o.y - H/2).toFixed(3)]; };
  const pan = () => { S.view.x += 137; S.view.y -= 61; };
  out.start = off();
  pan(); app.ev("resetLayout")(); out.reset = off();
  pan(); app.setLayout("2d"); out.only2d = off();
  app.setLayout("both"); out.both = off();
  // the drawing area made narrower and shorter by the layout (the splitter, a toolbar at the top), then wider again
  const W0 = app.ev("W"), H0 = app.ev("H");
  size(W0*0.6, H0 - 36); app.ev("setSplit")(0.4); out.split = off();
  size(W0 - 70, H0); app.ev("setDock")("2D", "top"); out.dock = off();
  size(W0, H0); app.ev("resize")(); out.back = off();
  return out;`;
for (const [w, h] of [[1000, 800], [1366, 641]])
  test("r23 / 3: the 2D origin sits in the middle of the 2D window (within 1 px) at the start, after the layout reset, on the switch to the 2D window alone and when the layout changes its size; at " + w + " × " + h, () => {
    const o = boot({ blank: true, w, h, script: CENTRE }).result;
    for (const k of ["start", "reset", "only2d", "both", "split", "dock", "back"])
      assert.ok(Math.abs(o[k][0]) <= 1 && Math.abs(o[k][1]) <= 1, k + ": the crossing is " + o[k] + " px off the middle");
  });

/* ---- batch 4: the layout reset ---- */
// everything the reset touches and leaves, moved away from the start first; the reset by its button's own click
const RESET = `
  const out = {};
  const sq = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], true)); S.pieces.push(sq); app.commit();
  const doc = app.ev("snap")(), steps0 = S.undo.length;
  app.setLayout("3d"); app.ev("setSplit")(0.3, true);
  app.ev("setPanels")({ panelW: 480, obH: 0.7, obFold: true, obFloat: { x: 20, y: 60 } });
  S.ui.float2 = { x: 10, y: 10, w: 400, h: 300 }; S.ui.float3 = { x: 30, y: 30, w: 400, h: 300 };
  app.ev("setDock")("2D", "top"); app.ev("setDock")("3D", "top");
  app.setPrefs({ wheelRev: true, unit: "cm" });
  S.view = { s: 3.7, x: 12, y: -40 };
  const v3 = app.view3d; if (v3.ready()) Object.assign(v3.cam, { az: 2.1, el: -0.3, dist: 900, tx: 300, ty: 10, tz: -50 });
  app.fireOn("s-lay-reset", "click", {});
  const o = app.toS({ x: 0, y: 0 });
  out.layout = S.ui.layout; out.split = S.ui.split; out.panels = [S.ui.panelW, S.ui.obH]; out.ob = [S.ui.obFold, S.ui.obFloat];
  out.floats = [S.ui.float2, S.ui.float3];
  out.view2 = [+(o.x - app.ev("W")/2).toFixed(3), +(o.y - app.ev("H")/2).toFixed(3), S.view.s];
  out.cam = v3.ready() ? ["az", "el", "dist", "tx", "ty", "tz"].every(k => Math.abs(v3.cam[k] - v3.home[k]) < 1e-9) : "no 3D";
  out.docks = [S.ui.dock2, S.ui.dock3]; out.prefs = [S.prefs.wheelRev, S.prefs.unit];
  out.doc = app.ev("snap")() === doc; out.steps = S.undo.length - steps0;
  return out;`;
let RES = null;
const reset = () => RES || (RES = boot({ blank: true, three: true, script: RESET.replace('app.fireOn("s-lay-reset", "click", {});', 'app.el("s-lay-reset").onclick();') }).result);
test("r23 / 4: the layout reset switches to both windows side by side", () => assert.strictEqual(reset().layout, "both"));
test("r23 / 4: the layout reset puts the split between the 2D and the 3D window back to half and half", () => assert.strictEqual(reset().split, 0.5));
test("r23 / 4: the layout reset puts the right panel's width and the Object Browser's share of its height (Object Browser over Property Editor) back", () => assert.deepStrictEqual(reset().panels, [276, 0.42]));
test("r23 / 4: the layout reset docks floating windows back: the 2D and 3D windows and the Object Browser, unfolded", () => { assert.deepStrictEqual(reset().floats, [null, null]); assert.deepStrictEqual(reset().ob, [false, null]); });
test("r23 / 4: the layout reset puts the 2D view's origin in the middle at 100 %", () => { const v = reset().view2; assert.ok(Math.abs(v[0]) <= 1 && Math.abs(v[1]) <= 1, String(v)); assert.strictEqual(v[2], 1); });
test("r23 / 4: the layout reset puts the 3D camera where it starts", () => assert.strictEqual(reset().cam, true));
test("r23 / 4: the layout reset leaves the toolbars where they were moved", () => assert.deepStrictEqual(reset().docks, ["top", "top"]));
test("r23 / 4: the layout reset leaves the preferences alone", () => assert.deepStrictEqual(reset().prefs, [true, "cm"]));
test("r23 / 4: the layout reset leaves the document alone: the same document, no undo step", () => { assert.strictEqual(reset().doc, true); assert.strictEqual(reset().steps, 0); });

/* ---- batch 5: lights you can see ---- */
// two sewn patterns in the 3D window, and the four kinds of light
const LIT = `
  const out = {}, v3 = app.view3d, G3 = app.G3;
  app.setLayout("both");
  const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:0},{x:x+300,y:0},{x:x+300,y:400},{x:x,y:400}], true));
  S.pieces.push(sq("Front", 0), sq("Back", 400)); S.pieces[0].p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; S.pieces[1].p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  app.commit(); app.ev("garmentSync")();
  const env = () => app.ev("env3Frame")(), g = () => v3.group("lights3");
  const marks = () => { env(); return g().children.filter(c => c.userData && c.userData.text).map(c => c.userData.text); };
`;
test("r23 / 5: the document's lights are marks in the 3D window, a shape a type (disc with rays, open cone, ball with spikes, half sphere), named, an off light see-through and named so; shown with Show Light (3D) and while the Render window is open, not otherwise", () => {
  const o = boot({ blank: true, three: true, script: LIT + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const d = app.ev("lightAdd")("dir"), sp = app.ev("lightAdd")("spot"), pt = app.ev("lightAdd")("point"), dm = app.ev("lightAdd")("dome");
      app.ev("lightSet")(pt.id, "on", false);
      out.none = marks();
      app.ev("setShow3")("lights3", true); out.shown = marks();
      const kinds = {}; for (const c of g().children) if (c.isGroup && c.userData.lid) { const geo = []; c.traverse((m) => { if (m.geometry && m.geometry.type) geo.push(m.geometry.type); }); kinds[c.userData.lid] = [...new Set(geo)].sort().join(); }
      out.kinds = [kinds[d.id], kinds[sp.id], kinds[pt.id], kinds[dm.id]];
      const off = g().children.find(c => c.isGroup && c.userData.lid === pt.id); let op = 1; off.traverse((m) => { if (m.material && m.isMesh) op = m.material.opacity; }); out.offLook = op;
      out.dashes = g().children.filter(c => c.isLine && c.material && c.material.isLineDashedMaterial).length;
      app.ev("setShow3")("lights3", false); out.offAgain = marks().length;
      app.ev("renderWindow")(); out.window = marks().length;
      app.ev("rwinClose")(); out.closed = marks().length;
      out.hidden = app.ev("RENDER_HIDE").includes("lights3");
      return out;
    });` }).result;
  assert.deepStrictEqual(o.none, [], "off by default");
  assert.deepStrictEqual(o.shown, ["Light 1 (Directional)", "Light 2 (Spot)", "Light 3 (Sphere, off)", "Light 4 (Dome)"]);      // (Round r29: the reference's name for our point light; its key stays "point")
  assert.strictEqual(o.kinds[0], "BufferGeometry,CylinderGeometry", "directional: a disc and three arrows (lines with a head)");
  assert.ok(/ConeGeometry/.test(o.kinds[1]) && !/Cylinder/.test(o.kinds[1]), "spot: a cone: " + o.kinds[1]);
  assert.ok(/SphereGeometry/.test(o.kinds[2]) && /BufferGeometry/.test(o.kinds[2]), "point: a ball and spikes: " + o.kinds[2]);
  assert.strictEqual(o.kinds[3], "SphereGeometry", "dome: a half sphere");
  assert.strictEqual(o.offLook, 0.35, "an off light see-through");
  assert.strictEqual(o.dashes, 3, "a dashed line to the garment from each but the dome");
  assert.strictEqual(o.offAgain, 0); assert.strictEqual(o.window, 4, "shown while the Render window is open"); assert.strictEqual(o.closed, 0);
  assert.strictEqual(o.hidden, true, "a render leaves them out");
});

test("r23 / 5: a click on a light's mark with Select/Move selects it (named with ▶, a cage round it, the Render window's list follows); its gizmo moves it round the garment as one undo step 'Move Light'; the gizmo has no rings on a light; a dome is selected, not moved", () => {
  const o = boot({ blank: true, three: true, script: LIT + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const sp = app.ev("lightAdd")("spot"), dm = app.ev("lightAdd")("dome"); app.ev("renderWindow")({ lights: true });
      app.setTool3("select_move"); env();
      const at = (l) => { const q = v3.project(app.ev("lightPlace")(l)); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1 }; };
      app.TOOL3.select_move.down(at(sp)); app.TOOL3.select_move.d = null;
      out.sel = [G3.light === sp.id, marks().filter(t => /^\\u25b6/.test(t)), /\\u25b6 Light 1/.test(app.el("rw-side").innerHTML)];
      out.handles = app.ev("gizHandles")().map(h => h.kind).join();
      out.giz = !!app.ev("gizAt")();
      // the gizmo's square dragged to the right on the screen
      const was = [sp.az, sp.el], steps = S.undo.length, gz = app.ev("gizGeom")(), e0 = { clientX: gz.o2.x, clientY: gz.o2.y, button: 0, buttons: 1 };
      const h = app.ev("gizHit")(e0); out.hit = h && h.kind;
      const d = app.ev("gizStart")(h, e0, v3.ray(e0));
      app.ev("gizMove")(d, { clientX: gz.o2.x + 120, clientY: gz.o2.y + 5, buttons: 1 }); app.ev("gizEnd")(d, true);
      out.moved = [sp.az !== was[0] || sp.el !== was[1], S.undo.length - steps, S.un[S.un.length - 1].n];
      app.undo(); const back = S.lights.find(l => l.id === sp.id); out.undone = [back.az, back.el].join() === was.join();
      // a dome
      app.TOOL3.select_move.down(at(dm)); app.TOOL3.select_move.d = null; out.dome = [G3.light === dm.id, !!app.ev("gizAt")()];
      // a click on nothing lets it go
      app.TOOL3.select_move.down({ clientX: 2, clientY: 2, button: 0, buttons: 1 }); app.TOOL3.select_move.d = null; out.none = G3.light;
      return out;
    });` }).result;
  assert.deepStrictEqual(o.sel, [true, ["▶ Light 1 (Spot)"], true]);
  assert.strictEqual(o.handles, "free,move,move,move", "the square and three arrows, no rings");
  assert.strictEqual(o.giz, true); assert.strictEqual(o.hit, "free");
  assert.deepStrictEqual(o.moved, [true, 1, "Move Light"]);
  assert.strictEqual(o.undone, true);
  assert.deepStrictEqual(o.dome, [true, false], "a dome is selected; it has no gizmo");
  assert.strictEqual(o.none, null);
});

test("r23 / 5: the light list is reached from Render ▸ Lights… and from the Render window; Add, a pick in the list and a change there are one undo step each; the normal 3D view keeps its own lights", () => {
  const o = boot({ blank: true, three: true, script: LIT + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const rows = app.MENUS.render().filter(x => x.n).map(x => x.n);
      out.rows = rows.filter(n => n === "Render" || n === "Lights\u2026");
      app.MENUS.render().find(x => x.n === "Lights\\u2026").f(); out.open = [app.ev("RWIN").open, /<h3>Lights<\\/h3>/.test(app.el("rw-side").innerHTML)];
      const side = app.el("rw-side"), steps = S.undo.length;
      side.onclick({ target: { dataset: { add: "point" } } }); out.added = [S.lights.length, S.lights[0].type, G3.light === S.lights[0].id, S.undo.length - steps];
      side.onchange({ target: { dataset: { l: "intensity", num: "1" }, value: "7", type: "text" } }); out.changed = [S.lights[0].intensity, S.undo.length - steps];
      side.onclick({ target: { dataset: { add: "dir" } } }); side.onclick({ target: { dataset: { pick: String(S.lights[0].id) } } }); out.picked = G3.light === S.lights[0].id;
      // the 3D window's own frame: its own three lights, none of the document's
      const L = []; v3.scene().traverse((x) => { if (x.isLight && x.visible) L.push(x.type); }); out.frame = L;
      return out;
    });` }).result;
  assert.deepStrictEqual(o.rows, ["Render", "Lights…"]);      // (Round r29: the workspace's row, as the reference names it)
  assert.deepStrictEqual(o.open, [true, true]);
  assert.deepStrictEqual(o.added, [1, "point", true, 1]);
  assert.deepStrictEqual(o.changed, [7, 2]);
  assert.strictEqual(o.picked, true);
  assert.strictEqual(o.frame.length, 3, "the window's three lights: " + o.frame);
  assert.ok(!o.frame.some(l => /PointLight/.test(l)), "no light of the document in the working view");
});

/* ---- batch 6: the Render window with its preview ---- */
// timers run at once (the fake page keeps them otherwise), and every canvas can be read as a data URL
const NOW = `
  app.ev("globalThis.setTimeout = (f) => { f(); return 1; }");
  app.ev("(() => { const ce = document.createElement; document.createElement = (t) => { const e = ce(t); e.toDataURL = (m) => 'data:' + (m || 'image/png') + ',x'; return e; }; })()");
`;
test("r23 / 6, r29: Render (the Render menu, Window ▸ Render) opens the Render workspace, not a dialog: its toolbar, and its settings in panes (Round r29: spread over Image/Video, Render and Light, the engine's rows with the engine that has them)", () => {
  const o = boot({ blank: true, three: true, script: LIT + NOW + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("saveRender")(app.ev("normRender")({ mode: "quick" }));
      app.MENUS.render().find(x => x.n === "Render").f();
      out.open = [app.ev("RWIN").open, app.el("dlg").style.display === "block"];
      const RW = app.ev("RWIN"), pane = (p) => { RW.pane = p; app.ev("rwinSide")(); return app.el("rw-side").innerHTML; };
      const html = pane("render") + pane("image");
      out.fields = ["mode", "view", "size", "ss", "shadows", "soft", "bg", "fmt"].filter(k => html.includes('data-r="' + k + '"'));
      const bar = app.el("rw-tools").innerHTML;
      out.buttons = ["render", "stop", "save", "live"].filter(k => bar.includes('data-act="' + k + '"'));
      out.lights = /<h3>Lights<\\/h3>/.test(pane("light"));
      app.ev("rwinClose")();
      const rows = []; const walk = (L) => { for (const r of L || []) { if (r && r.n) rows.push(r); if (r && typeof r.menu === "function") walk(r.menu()); } };
      walk(app.ev("menuDisplay")()); rows.find(x => x.n === "Render").f(); out.button = app.ev("RWIN").open;
      return out;
    });` }).result;
  assert.deepStrictEqual(o.open, [true, false]);
  assert.deepStrictEqual(o.fields, ["mode", "view", "size", "ss", "shadows", "soft", "bg", "fmt"]);
  assert.deepStrictEqual(o.buttons, ["render", "stop", "save", "live"]);
  assert.strictEqual(o.lights, true); assert.strictEqual(o.button, true);
});

test("r23 / 6, r29: Interactive is drawn at once small and coarse, then sharp at the picture's size; it follows the 3D view turned and a light changed while it runs, and nothing is drawn for it once it is closed; nothing is drawn before it is started (Round r29: the maintainer's window waits for a click)", () => {
  const o = boot({ blank: true, three: true, script: LIT + NOW + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("saveRender")(app.ev("normRender")({ mode: "quick" }));
      const n00 = app.renders.length;
      app.ev("renderWindow")(); app.ev("rwinWatch")(); out.opened = app.renders.length - n00;
      const n0 = app.renders.length;
      app.ev("rwinInteractive")();
      const got = app.renders.slice(n0).map(r => r.w + "x" + r.h + (r.shadows ? "s" : ""));
      out.first = got;
      const n1 = app.renders.length; v3.cam.az += 0.4; app.ev("rwinWatch")(); out.turned = app.renders.length - n1;
      const n2 = app.renders.length; app.ev("rwinWatch")(); out.still = app.renders.length - n2;
      const n3 = app.renders.length; app.ev("lightAdd")("spot"); app.ev("rwinWatch")(); out.light = app.renders.length - n3;
      app.ev("rwinClose")(); const n4 = app.renders.length; v3.cam.az += 0.4; app.ev("rwinWatch")(); out.closed = app.renders.length - n4;
      return out;
    });` }).result;
  assert.strictEqual(o.opened, 0, "opened: nothing drawn until it is started");
  // the preview area is 988 × 788 in the fake page: 1920 × 1080 fits as 987 × 555; coarse a third, no shadows; sharp 2× supersampled with shadows
  assert.deepStrictEqual(o.first, ["329x185", "1974x1110s"]);
  assert.strictEqual(o.turned, 2, "the view turned: coarse and sharp again");
  assert.strictEqual(o.still, 0, "nothing changed: nothing drawn");
  assert.strictEqual(o.light, 2, "a light added: drawn again");
  assert.strictEqual(o.closed, 0, "closed: nothing");
});

test("r23 / 6, r29: Final Render draws the full resolution and shows it (the title says the scale) and it stays, a setting changed or not (Round r29: a stopped window takes no input); Interactive goes back; Save writes PNG or JPEG as chosen; the settings are kept per machine", () => {
  const o = boot({ blank: true, three: true, script: LIT + NOW + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("saveRender")(app.ev("normRender")({ mode: "quick" }));
      app.ev("renderWindow")(); const side = app.el("rw-side");
      const n0 = app.renders.length; side.onclick({ target: { dataset: { act: "render" } } });
      const r = app.renders.slice(n0); out.full = r.map(x => x.w + "x" + x.h); out.title = app.el("rw-tn").textContent; out.result = !!app.ev("RWIN").result;
      const n1 = app.renders.length; v3.cam.az += 0.3; app.ev("rwinWatch")(); out.frozen = app.renders.length - n1;
      side.onclick({ target: { dataset: { act: "save" } } }); out.png = toasts[toasts.length - 1];
      side.onchange({ target: { dataset: { r: "fmt" }, value: "jpeg", type: "select-one" } }); out.reset = !!app.ev("RWIN").result;
      side.onclick({ target: { dataset: { act: "save" } } }); out.jpeg = toasts[toasts.length - 1];
      side.onchange({ target: { dataset: { r: "size" }, value: "1280x720", type: "select-one" } });
      side.onclick({ target: { dataset: { act: "live" } } }); out.live = !app.ev("RWIN").result;
      out.kept = JSON.parse(app.storage.get("pdraft:render"));
      return out;
    });` }).result;
  assert.deepStrictEqual(o.full, ["3840x2160"], "1920 × 1080, 2× supersampled");
  assert.strictEqual(o.title, "Render (51% of 1920 × 1080)");
  assert.strictEqual(o.result, true); assert.strictEqual(o.frozen, 0, "the render stays shown while the view turns");
  assert.ok(/^Render saved as render[.]png, 1920 × 1080 px/.test(o.png), o.png);
  assert.strictEqual(o.reset, true, "a setting changed: the picture stays (Round r29; it went back to the preview until then)");
  assert.ok(/^Render saved as render[.]jpg, 1920 × 1080 px/.test(o.jpeg), o.jpeg);
  assert.strictEqual(o.live, true);
  assert.deepStrictEqual([o.kept.fmt, o.kept.size, o.kept.mode], ["jpeg", "1280x720", "quick"]);
});

/* ---- batch 7: the quality render ---- */
// a stand-in for the path tracing library (the fake page has no WebGL 2): it counts its passes, a pass taking about a millisecond
const PT_STUB = `
  globalThis.__pt = { objs: null, built: 0 };
  const upd = { updateFrom() {}, setTextures() {} };
  app.ev("globalThis").THREE_PATHTRACER = {
    PhysicalPathTracingMaterial: class { constructor() { Object.assign(this, { bvh: upd, attributesArray: upd, materialIndexAttribute: upd, textures: upd, materials: upd, lights: upd, envMapInfo: upd }); } dispose() {} },
    PathTracingRenderer: class { constructor() { this.samples = 0; this.tiles = { set() {} }; this.target = { texture: {} }; __pt.built++; } setSize() {} reset() { this.samples = 0; } update() { const t = Date.now(); while (Date.now() - t < 1) {} this.samples++; } },
    PathTracingSceneGenerator: class { generate(objs) { __pt.objs = objs.map(o => o.type + (o.name ? ":" + o.name : "")); return { bvh: { geometry: { attributes: {}, dispose() {} } }, textures: [], materials: [], lights: [] }; } },
    GradientEquirectTexture: class { constructor() { this.topColor = { set() {} }; this.bottomColor = { set() {} }; } update() {} dispose() {} },
    FullScreenQuad: class { constructor(m) { this.material = m; } render() {} dispose() {} },
  };
  app.ev("ptSupport = () => null");
`;
test("r23 / 7: nothing of the quality render is loaded or asked for until Quality is chosen; where WebGL 2 is missing the window says so and offers Quick", () => {
  const o = boot({ blank: true, three: true, script: LIT + NOW + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const scripts = () => app.el("body").children.filter(c => /three-pathtracer/.test(c.src || "")).length;
      app.ev("saveRender")(app.ev("normRender")({ mode: "quick" }));
      app.ev("renderWindow")(); out.quick = [scripts(), app.ev("typeof THREE_PATHTRACER"), app.ev("ptSupport").said === undefined];
      const side = app.el("rw-side"), RW = app.ev("RWIN"); RW.pane = "render";
      side.onchange({ target: { dataset: { r: "mode" }, value: "quality", type: "select-one" } });
      app.ev("rwinInteractive")();      // (Round r29: asked for only when something is started)
      out.quality = [scripts(), /cannot run here/.test(app.el("rw-msg").textContent), /data-act="use-quick"/.test(side.innerHTML), app.ev("loadRender")().mode];
      app.ev("rwinStop")();
      side.onclick({ target: { dataset: { act: "use-quick" } } }); out.back = app.ev("loadRender")().mode;
      out.samples = [app.ev("normRender")({ samples: 3 }).samples, app.ev("normRender")({ samples: 99999 }).samples, app.ev("normRender")({}).samples];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.quick, [0, "undefined", true], "Quick: no script asked for, no WebGL 2 probed");
  assert.deepStrictEqual(o.quality, [0, true, true, "quality"], "no WebGL 2 here: said so, Use Quick offered, nothing loaded");
  assert.strictEqual(o.back, "quick");
  assert.deepStrictEqual(o.samples, [16, 4096, 256]);
});

test("r23 / 7: a quality render runs pass by pass up to Samples with a progress bar, from the garment, the avatar's and the floor's meshes and the lights (not the working marks or the grid), and is kept as the window's result; Stop keeps it as far as it got", () => {
  const o = boot({ blank: true, three: true, script: LIT + PT_STUB + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("setShow3")("lights3", true); app.ev("env3Frame")();
      app.ev("renderWindow")(); app.ev("saveRender")(app.ev("normRender")({ mode: "quality", samples: 20, size: "custom", w: 300, h: 200 }));
      const RW = app.ev("RWIN");
      app.ev("rwinRender")();
      // the passes run a frame's time at a go (setTimeout here stands for the next frame): run the goes by hand
      const step = () => { const r = app.ev("PTRUN"); if (r) app.ev("ptStep")(r); };
      out.prog = [/Preparing the quality renderer/.test(app.el("rw-pt").textContent)]; step(); out.prog.push(/^Final Render: [0-9]+ of 20 samples/.test(app.el("rw-pt").textContent));      // (Round r29: the reference's name; Round r29b: the words say how often, as measured)
      // (one sample a frame: the work is queued on the graphics card)
      for (let k = 0; k < 40 && app.ev("PTRUN"); k++) step();
      out.done = [!!RW.result, RW.lastPT && RW.lastPT.samples, RW.lastPT && RW.lastPT.stopped, /quality, 20 samples/.test(app.el("rw-tn").textContent), RW.busy];
      out.objs = __pt.objs;
      // stopped half way
      app.ev("saveRender")(app.ev("normRender")({ mode: "quality", samples: 4000, size: "custom", w: 300, h: 200 }));
      app.ev("rwinRender")(); step();
      const got = app.ev("PTRUN").samples; app.el("rw-side").onclick({ target: { dataset: { act: "stop" } } });
      out.stopped = [got > 0 && got < 4000, RW.lastPT.stopped, /stopped/.test(app.el("rw-tn").textContent), !!RW.result, app.ev("PTRUN")];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.prog, [true, true], "the bar says the renderer is being prepared (its shader compiled: up to a minute on Windows), then how many samples of how many");
  assert.deepStrictEqual(o.done, [true, 20, false, true, false]);
  assert.ok(o.objs.filter(x => /^Mesh/.test(x)).length >= 3, "the two cloths and the floor: " + o.objs);
  assert.strictEqual(o.objs.filter(x => /DirectionalLight/.test(x)).length, 2, "the window's own two lights while the document has none: " + o.objs);
  assert.ok(!o.objs.some(x => /grid|lights3|Sprite|Line/.test(x)), "no marks, grid or lines: " + o.objs);
  assert.deepStrictEqual(o.stopped, [true, true, true, true, null]);
});

test("r23 / 7: in Quality the preview is a quick coarse picture at once, then path traced at the preview's size once still; a change starts it again; closing the window ends it", () => {
  const o = boot({ blank: true, three: true, script: LIT + PT_STUB + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const later = []; app.ev("globalThis").setTimeout = (f) => { later.push(f); return later.length; };
      app.ev("saveRender")(app.ev("normRender")({ mode: "quality", samples: 16 }));
      app.ev("renderWindow")(); app.ev("rwinInteractive")();
      out.first = [app.ev("PTRUN"), later.length > 0];
      later.splice(0).forEach(f => f());                 // the still moment
      const r = app.ev("PTRUN"); out.run = [!!r && r.preview, r && r.w + "x" + r.h];
      v3.cam.az += 0.5; app.ev("rwinWatch")(); out.changed = app.ev("PTRUN");
      later.splice(0).forEach(f => f()); out.again = !!app.ev("PTRUN");
      app.ev("rwinClose")(); out.closed = app.ev("PTRUN");
      return out;
    });` }).result;
  assert.deepStrictEqual(o.first, [null, true], "not path traced at once: after a still moment");
  assert.deepStrictEqual(o.run, [true, "987x555"]);
  assert.strictEqual(o.changed, null, "the view turned: the run given up for a quick picture");
  assert.strictEqual(o.again, true); assert.strictEqual(o.closed, null);
});

/* ---- batch 8: the schematic render ---- */
test("r23 / 8: the lines in a view's pixels: the garment against the background or the avatar is silhouette, one pattern against another seamline, a depth jump within a pattern a fold's silhouette; internal lines and topstitches from the lines pass", () => {
  const o = boot({ blank: true, script: `
    // a 6 × 3 picture: background | pattern A | pattern A (far behind) | pattern B | avatar | background, the same in every row
    const W = 6, H = 3, I = new Uint8ClampedArray(4*W*H), D = new Uint8ClampedArray(4*W*H), L = new Uint8ClampedArray(4*W*H);
    const A = app.ev("schId")(1), B = app.ev("schId")(2), AV = app.ev("SCH_AV");
    const col = [[0, 0, 0], A, A, B, AV, [0, 0, 0]], dep = [0, 10, 200, 12, 0, 0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y*W + x; I.set([...col[x], 255], 4*p); D.set([dep[x], 0, 0, 255], 4*p); }
    L.set([255, 0, 0, 255], 4*(1*W + 1)); L.set([0, 0, 255, 255], 4*(1*W + 3));
    const m = app.ev("schLines")(I, D, L, W, H, 25*256);
    const row = (a) => Array.from(a.slice(W, 2*W)).join("");
    return { sil: row(m.sil), seam: row(m.seam), int: row(m.int), stitch: row(m.stitch) };` }).result;
  assert.strictEqual(o.sil, "010100", "A against the background and A folding back (both on A's nearer pixel), B against the avatar (B's pixel)");
  assert.strictEqual(o.seam, "001000", "A meeting B: a seamline");
  assert.strictEqual(o.int, "010000"); assert.strictEqual(o.stitch, "000100");
});

test("r23 / 8: Schematic in the Render window: views (front and back by default), fill, the avatar, four line weights and a colour; four passes a view at twice the size with only the cloth shown; the 3D window as it was afterwards; PNG or JPEG", () => {
  const o = boot({ blank: true, three: true, script: LIT + NOW + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("renderWindow")(); const side = app.el("rw-side"); app.ev("RWIN").pane = "render";
      side.onchange({ target: { dataset: { r: "mode" }, value: "schematic", type: "select-one" } });
      const html = side.innerHTML;
      out.fields = ["schViews", "schFill", "schAvatar", "schSil", "schSeam", "schInt", "schStitch", "schColor"].filter(k => html.includes('data-r="' + k + '"'));
      const d = app.ev("normRender")({ mode: "schematic" }); out.defaults = [d.schViews, d.schFill, d.schAvatar, d.schSil, d.schSeam, d.schInt, d.schStitch, d.schColor];
      out.fmts = app.ev("rwinFormats")().map(f => f[0]);
      const mats = [...G3.items.values()].map(it => it.obj.material);
      app.ev("saveRender")(app.ev("normRender")({ mode: "schematic", size: "1280x720", bg: "white", schFill: "white" }));      // (Round r29: a flat sheet, no lights)
      const n0 = app.renders.length; side.onclick({ target: { dataset: { act: "render" } } });
      const r = app.renders.slice(n0); out.passes = [r.length, [...new Set(r.map(x => x.w + "x" + x.h))], r.some(x => x.grid), r.every(x => x.lights.length === 0)];
      out.result = [!!app.ev("RWIN").result, app.ev("RWIN").result.w, app.ev("RWIN").result.h];
      out.back = [...G3.items.values()].every((it, k) => it.obj.material === mats[k]);
      out.shown = [v3.scene().getObjectByName("grid:fine").visible, !v3.scene().getObjectByName("render:schematic")];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.fields, ["schViews", "schFill", "schAvatar", "schSil", "schSeam", "schInt", "schStitch", "schColor"]);
  assert.deepStrictEqual(o.defaults, ["frontback", "texture", false, 3, 2, 2, 2, "#000000"], "the reference's weights (silhouette 3, seamline 2, internal 2); Garment Texture is its default (Round r29: frame 150)");
  assert.deepStrictEqual(o.fmts, ["png", "jpeg"], "no SVG: the lines are found in pixels");
  assert.deepStrictEqual(o.passes, [8, ["1280x1440"], false, true], "front and back, four passes each, each view 640 × 720 drawn at twice the size, no grid, no lights (flat)");
  assert.deepStrictEqual(o.result, [true, 1280, 720]);
  assert.strictEqual(o.back, true, "each cloth has its own material again");
  assert.deepStrictEqual(o.shown, [true, true], "the grid shown again, the lines taken out");
});

// (found while building batch 8) a picture from a named view moves the camera while it is drawn: the preview's watch, a frame hook,
// must not take that for the view being turned, or the preview draws itself again without end
test("r23 / 6, 8: a preview from a named view (Front) is drawn once, coarse and sharp, not again and again", () => {
  const o = boot({ blank: true, three: true, script: LIT + NOW + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("saveRender")(app.ev("normRender")({ view: "front" }));
      app.ev("saveRender")(app.ev("normRender")({ view: "front", mode: "quick" }));
      const n0 = app.renders.length; app.ev("renderWindow")(); app.ev("rwinInteractive")(); app.ev("rwinWatch")(); app.ev("rwinWatch")();
      return app.renders.length - n0;
    });` }).result;
  assert.strictEqual(o, 2);
});

module.exports = T;
