// Round r29: the Render workspace as the maintainer explained it, Print Layout's trimmed view,
// and Print opening one window. What needs real pixels or a real graphics card is in the browser smoke (PDRAFT_SMOKE_ONLY=r29).
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });

function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-r29-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}
// two sewn rectangles in the 3D window, the workspace's helpers, the fake page's timers run at once, every canvas readable
const SCENE = `
  const out = {}, v3 = app.view3d, G3 = app.G3;
  app.setLayout("both");
  const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:0},{x:x+300,y:0},{x:x+300,y:400},{x:x,y:400}], true));
  S.pieces.push(sq("Front", 0), sq("Back", 400)); S.pieces[0].p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; S.pieces[1].p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  app.commit(); app.ev("garmentSync")();
  app.ev("globalThis.setTimeout = (f) => { f(); return 1; }");
  app.ev("(() => { const ce = document.createElement; document.createElement = (t) => { const e = ce(t); e.toDataURL = (m) => 'data:' + (m || 'image/png') + ';base64,QUJD'; return e; }; })()");
  const RW = app.ev("RWIN"), side = () => app.el("rw-side"), bar = () => app.el("rw-tools").innerHTML, title = () => app.el("rw-tn").textContent;
  const can = (a) => new RegExp('data-act="' + a + '"(?! disabled)').test(bar());
  const quick = (more) => app.ev("saveRender")(app.ev("normRender")({ mode: "quick", ...more }));
`;

/* ---- batch 2: the workspace ---- */
test("r29 / 2: Render opens in the 2D window's place with the tabs 2D Pattern Window and Render, empty with its one line; the tabs switch; ✕ closes it and the tabs go; from the layout 3D alone it brings the 2D window's place back", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("setLayout")("3d");
      const n0 = app.renders.length;
      app.ev("renderWindow")();
      out.opened = [RW.open, RW.front, S.ui.layout, app.el("rwin").style.display, app.el("rw-msg").textContent, title(), app.renders.length - n0, app.el("avtabs").innerHTML];
      app.ev("stageFront")("2d"); out.back = [RW.open, RW.front, app.el("rwin").style.display, app.el("avtabs").innerHTML];
      app.ev("stageFront")("rw"); out.again = app.el("rwin").style.display;
      app.ev("rwinClose")(); out.closed = [RW.open, RW.front, app.el("rwin").style.display];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.opened.slice(0, 7), [true, true, "both", "flex", "Click here to start the Interactive Render.", "Render", 0]);
  assert.ok(/2D Pattern Window/.test(o.opened[7]) && /data-f="rw" class="on"/.test(o.opened[7]), o.opened[7]);
  assert.deepStrictEqual(o.back.slice(0, 3), [true, false, "none"]); assert.ok(/data-f="2d" class="on"/.test(o.back[3]));
  assert.strictEqual(o.again, "flex");
  assert.deepStrictEqual(o.closed, [false, false, "none"]);
});

test("r29 / 2: with the Avatar Editor open too there are three tabs, one in front; closing either leaves the other", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("avEditor")(true); app.ev("renderWindow")();
      out.both = [app.el("avtabs").innerHTML.match(/data-f="[a-z0-9]+"/g), S.aved.front, RW.front];
      app.ev("stageFront")("ed"); out.ed = [S.aved.front, RW.front, app.el("rwin").style.display];
      app.ev("rwinClose")(); out.closeR = [!!S.aved, app.el("avtabs").innerHTML.match(/data-f="[a-z0-9]+"/g)];
      app.ev("renderWindow")(); app.ev("avEditor")(false); out.closeA = [!!S.aved, RW.front, app.el("avtabs").innerHTML.match(/data-f="[a-z0-9]+"/g)];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.both, [['data-f="2d"', 'data-f="ed"', 'data-f="rw"'], "2d", true]);
  assert.deepStrictEqual(o.ed, ["ed", false, "none"]);
  assert.deepStrictEqual(o.closeR, [true, ['data-f="2d"', 'data-f="ed"']]);
  assert.deepStrictEqual(o.closeA, [false, true, ['data-f="2d"', 'data-f="rw"']]);
});

test("r29 / 2: the toolbar's panes are the Property Editor's: Image/Video, Camera, Light, Render, one at a time, each with its open and save; rows of what is not built follow the switch", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("renderWindow")();
      const seen = {};
      for (const p of ["image", "camera", "light", "render"]) { app.el("rw-tools").onclick({ target: { dataset: { act: "p:" + p } } }); seen[p] = side().innerHTML; }
      out.heads = Object.fromEntries(Object.entries(seen).map(([k, h]) => [k, [/<span>([^<]+)<[/]span>/.exec(h)[1], /pane-open/.test(h), /pane-save/.test(h)]]));
      out.image = ["kind", "view", "size", "orient", "w", "h", "ratio", "bg", "bgTex", "nameKind", "fmt"].filter(k => seen.image.includes('data-r="' + k + '"'));
      out.camera = [["camName", "fov", "camType", "near", "far"].filter(k => seen.camera.includes('data-r="' + k + '"')), ["dist", "az", "el"].filter(k => seen.camera.includes('data-cam="' + k + '"'))];
      out.nbOn = /Animation/.test(seen.image) && /not built yet/.test(seen.render);
      S.ui.unbuilt = false; app.el("rw-tools").onclick({ target: { dataset: { act: "p:image" } } }); out.nbOff = /Animation|Colorway|not built yet/.test(side().innerHTML);
      return out;
    });` }).result;
  assert.deepStrictEqual(o.heads, { image: ["Image/Video", true, true], camera: ["Camera", true, true], light: ["Light", true, true], render: ["Render", true, true] });
  assert.deepStrictEqual(o.image, ["kind", "view", "size", "orient", "w", "h", "ratio", "bg", "bgTex", "nameKind", "fmt"]);
  assert.deepStrictEqual(o.camera, [["camName", "fov", "camType", "near", "far"], ["dist", "az", "el"]]);
  assert.strictEqual(o.nbOn, true); assert.strictEqual(o.nbOff, false);
});

test("r29 / 2: a click in the empty window starts the Interactive Render; Final Render waits for Stop; stopped, the picture stays and takes no input, the mouse in the picture drives the one camera only while Interactive runs", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      quick(); app.ev("renderWindow")();
      out.empty = [can("live"), can("stop"), can("render"), can("save")];
      app.ev("rwinViewDown")({ button: 0, clientX: 10, clientY: 10, pointerId: 1 });
      out.live = [RW.live, can("live"), can("stop"), can("render"), /Final Render [(]stop the Interactive/.test(bar()), RW.shown];
      const n0 = S.undo.length;
      // the mouse turns the 3D window's own camera; the wheel zooms it
      const c = v3.cam, a0 = c.az, d0 = c.dist;
      app.ev("rwinViewDown")({ button: 2, clientX: 10, clientY: 10, pointerId: 1, shiftKey: false }); app.ev("rwinViewMove")({ clientX: 60, clientY: 10 }); RW.drag = null;
      out.turned = c.az !== a0; v3.mouse.wheel({ deltaY: -100 }); out.zoomed = c.dist < d0;
      app.ev("rwinWatch")();
      // Final Render refused while it runs
      const r0 = app.renders.length; app.ev("rwinRender")(); out.refused = [app.renders.length - r0, !!RW.result];
      app.el("rw-tools").onclick({ target: { dataset: { act: "stop" } } });
      out.stopped = [RW.live, can("stop"), can("render"), can("save"), RW.shown, /stopped/.test(title())];
      // stopped: no input, no drawing
      const a1 = c.az, r1 = app.renders.length;
      app.ev("rwinViewDown")({ button: 0, clientX: 10, clientY: 10, pointerId: 1 }); app.ev("rwinViewMove")({ clientX: 90, clientY: 10 });
      out.dead = [RW.live, c.az === a1];
      c.az += 0.4; app.ev("rwinWatch")(); out.still = app.renders.length - r1;
      app.ev("rwinRender")(); out.final = [!!RW.result, !!RW.busy, /of 1920/.test(title())];
      out.steps = S.undo.length - n0;
      return out;
    });` }).result;
  assert.deepStrictEqual(o.empty, [true, false, true, false], "empty: Interactive and Final can start, nothing to stop or save");
  assert.deepStrictEqual(o.live, [true, true, true, false, true, true], "running: Stop on, Final greyed and says why");
  assert.deepStrictEqual([o.turned, o.zoomed], [true, true], "both windows drive one camera");
  assert.deepStrictEqual(o.refused, [0, false], "Final Render waits for Stop");
  assert.deepStrictEqual(o.stopped, [false, false, true, true, true, true]);
  assert.deepStrictEqual(o.dead, [false, true]);
  assert.strictEqual(o.still, 0, "the 3D window turned: the stopped picture is left alone");
  assert.deepStrictEqual(o.final, [true, false, true]);
  assert.strictEqual(o.steps, 0, "no history step");
});

test("r29 / 2: while simulating neither Interactive nor Final Render starts, and a box says why", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      quick(); app.ev("renderWindow")();
      const SIM = app.ev("SIM"), was = SIM.on; SIM.on = true;
      const r0 = app.renders.length;
      app.ev("rwinInteractive")(); out.live = [RW.live, app.renders.length - r0, /simulation is running/i.test(JSON.stringify(app.el("body").children.map(c => (c.children || []).map(k => k.innerHTML))))];
      app.ev("closeModal")();
      app.ev("rwinRender")(); out.final = [!!RW.result, app.renders.length - r0];
      app.ev("closeModal")();
      SIM.on = was;
      return out;
    });` }).result;
  assert.deepStrictEqual(o.live, [false, 0, true]);
  assert.deepStrictEqual(o.final, [false, 0]);
});

/* ---- batch 3: the controls ---- */
test("r29 / 3: Image Size: Orientation turns a preset; a size typed is custom, the other side kept or (Maintain Ratio) following; a named size's rows always show", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      quick({ size: "640x480" }); app.ev("renderWindow")();
      const set = (k, v, type) => side().onchange({ target: { dataset: { r: k, ...(type === "num" ? { num: "1" } : {}) }, value: v, type: type === "chk" ? "checkbox" : "text", checked: !!v } });
      const size = () => { const z = app.ev("renderSize")(app.ev("loadRender")()); return z.w + "x" + z.h; };
      out.base = size(); set("orient", "portrait"); out.portrait = size();
      set("w", "1000", "num"); out.typed = [size(), app.ev("loadRender")().size];
      set("ratio", true, "chk"); set("h", "2000", "num"); out.ratio = size();
      set("orient", "landscape"); out.custom = size();
      return out;
    });` }).result;
  assert.strictEqual(o.base, "640x480"); assert.strictEqual(o.portrait, "480x640");
  assert.deepStrictEqual(o.typed, ["1000x640", "custom"]);
  assert.strictEqual(o.ratio, "3125x2000", "Maintain Ratio: 1000 x 640 grown to a height of 2000");
  assert.strictEqual(o.custom, "2000x3125", "a custom size turned");
});

test("r29 / 3: Turntable Images: the cameras go round the axis from where the camera is (Auto the garment's middle, Center the world's, Custom typed), a dotted line in the 3D window while chosen; Custom Views render each view", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const c = v3.cam; Object.assign(c, { az: 0, el: 0.1, dist: 3000, tx: 100, ty: 900, tz: 0 });
      const shots = (m) => app.ev("rwinShots")(app.ev("normRender")({ kind: "turntable", ...m }));
      const fours = shots({ ttCount: 4, ttAxis: "center" });
      out.n = fours.length; out.az = fours.map(s => +(s.az*180/Math.PI).toFixed(3));
      out.t = fours.map(s => [Math.round(s.tx), Math.round(s.tz)]);
      out.cw = shots({ ttCount: 4, ttAxis: "center", ttDir: "cw" }).map(s => +(s.az*180/Math.PI).toFixed(3));
      out.half = shots({ ttCount: 2, ttAngle: 180, ttAxis: "custom", ttX: 100, ttZ: 0 }).map(s => [+(s.az*180/Math.PI).toFixed(3), Math.round(s.tx)]);
      out.custom = shots({ ttCount: "custom", ttN: 7 }).length; out.list = [app.ev("normRender")({ ttCount: 5 }).ttCount, app.ev("normRender")({ ttCount: 360 }).ttCount];
      // the axis, while chosen
      const axis = () => v3.group("rwaxis").children.length;
      quick(); app.ev("renderWindow")(); out.axis0 = axis();
      side().onchange({ target: { dataset: { r: "kind" }, value: "turntable", type: "text" } }); out.axis1 = axis();
      out.inPicture = app.ev("RENDER_HIDE").includes("rwaxis");
      app.ev("rwinClose")(); out.axis2 = axis();
      // custom views: added, each its camera, deleted
      quick(); app.ev("renderWindow")(); RW.pane = "image";
      app.el("rw-tools").onclick({ target: { dataset: { act: "x" } } });
      app.ev("rwinAct")("view-add"); c.az = 1; app.ev("rwinAct")("view-add");
      const r = app.ev("loadRender")(); out.views = [r.view, r.views.map(v => v.name), app.ev("rwinShots")(r).map(s => s.az)];
      app.ev("rwinAct")("view-del:0"); out.left = app.ev("loadRender")().views.map(v => v.name);
      return out;
    });` }).result;
  assert.strictEqual(o.n, 4);
  assert.deepStrictEqual(o.az, [0, -90, -180, -270], "the garment turns counterclockwise seen from above: the camera the other way");
  assert.deepStrictEqual(o.t, [[100, 0], [0, 100], [-100, 0], [0, -100]], "the point looked at goes round the world's middle");
  assert.deepStrictEqual(o.cw, [0, 90, 180, 270]);
  assert.deepStrictEqual(o.half, [[0, 100], [-90, 100]], "an axis through the point looked at leaves it where it is");
  assert.strictEqual(o.custom, 7); assert.deepStrictEqual(o.list, [4, 360]);
  assert.deepStrictEqual([o.axis0, o.axis1, o.inPicture, o.axis2], [0, 1, true, 0]);
  assert.deepStrictEqual(o.views, ["custom", ["View 1", "View 2"], [0, 1]]);
  assert.deepStrictEqual(o.left, ["View 2"]);
});

test("r29 / 3: a series renders one picture a frame, is stopped where it got to, and Save writes every picture as one zip named after the project; a single picture its own file", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const later = []; app.ev("globalThis").requestAnimationFrame = (f) => { later.push(f); return 1; };
      const run = () => { for (let k = 0; k < 40 && later.length; k++) later.shift()(); };
      const files = []; app.setDownload((n, b) => { files.push([n, b && b.length]); });
      quick({ kind: "turntable", ttCount: 4, size: "640x480" }); app.ev("renderWindow")();
      const n0 = app.renders.length; app.ev("rwinRender")();
      out.first = [RW.busy, app.renders.length - n0, !!RW.seq]; run();
      out.done = [RW.busy, app.renders.length - n0, RW.seq.files.map(f => f.name), /4 of 4 images/.test(title())];
      app.ev("rwinSave")(); out.zip = files.slice(); files.length = 0;
      // stopped half way
      quick({ kind: "turntable", ttCount: 8, size: "640x480" });
      app.ev("rwinRender")(); later.shift()(); later.shift()();
      app.el("rw-tools").onclick({ target: { dataset: { act: "stop" } } }); run();
      out.stopped = [RW.busy, RW.seq.files.length > 0 && RW.seq.files.length < 8, /stopped/.test(title()), !!RW.result];
      // paused: nothing is drawn until Resume
      quick({ kind: "turntable", ttCount: 4, size: "640x480" });
      app.ev("rwinRender")(); later.shift()();
      app.el("rw-tools").onclick({ target: { dataset: { act: "pause" } } }); const n1 = app.renders.length; run();
      out.paused = [RW.paused, RW.busy, app.renders.length - n1, /Resume Final Render/.test(bar())];
      app.el("rw-tools").onclick({ target: { dataset: { act: "pause" } } }); run();
      out.resumed = [RW.paused, RW.busy, RW.seq.files.length];
      // the project's name, a custom name
      quick({ size: "640x480", nameKind: "custom", customName: "my look" }); app.ev("rwinRender")(); app.ev("rwinSave")(); out.named = toasts[toasts.length - 1];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.first, [true, 1, true], "one picture at first: the page goes on answering");
  assert.deepStrictEqual(o.done, [false, 4, ["render_1.png", "render_2.png", "render_3.png", "render_4.png"], true]);
  assert.strictEqual(o.zip.length, 1); assert.strictEqual(o.zip[0][0], "render-images.zip");
  assert.deepStrictEqual(o.stopped, [false, true, true, true], "stopped: the pictures so far are kept");
  assert.deepStrictEqual(o.paused, [true, true, 0, true]);
  assert.deepStrictEqual(o.resumed, [false, false, 4]);
  assert.ok(/^Render saved as my look[.]png, 640 . 480 px/.test(o.named), o.named);
});

test("r29 / 3: Pause holds a path traced Final Render and its clock; Resume goes on; Stop while paused keeps it; the bar says samples, time, time left, noise", () => {
  // (Round r32: Path Traced is the desktop app's only, so this boots as the desktop app)
  const o = boot({ blank: true, three: true, desktop: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const upd = { updateFrom() {}, setTextures() {} };
      app.ev("globalThis").THREE_PATHTRACER = {
        PhysicalPathTracingMaterial: class { constructor() { Object.assign(this, { bvh: upd, attributesArray: upd, materialIndexAttribute: upd, textures: upd, materials: upd, lights: upd, envMapInfo: upd }); } dispose() {} },
        PathTracingRenderer: class { constructor() { this.samples = 0; this.tiles = { set() {} }; this.target = { texture: {} }; } setSize() {} reset() { this.samples = 0; } update() { this.samples++; } },
        PathTracingSceneGenerator: class { generate() { return { bvh: { geometry: { attributes: {}, dispose() {} } }, textures: [], materials: [], lights: [] }; } },
        GradientEquirectTexture: class { constructor() { this.topColor = { set() {} }; this.bottomColor = { set() {} }; } update() {} dispose() {} },
        FullScreenQuad: class { constructor(m) { this.material = m; } render() {} dispose() {} },
      };
      app.ev("ptSupport = () => null");
      const later = []; app.ev("globalThis").requestAnimationFrame = (f) => { later.push(f); return 1; };
      const go = (n) => { for (let k = 0; k < n && later.length; k++) later.shift()(); };
      app.ev("saveRender")(app.ev("normRender")({ mode: "quality", samples: 64, size: "custom", w: 300, h: 200, burn: 1.5, lightQ: "high" }));
      app.ev("renderWindow")(); app.ev("rwinRender")(); go(6);
      const run = app.ev("PTRUN"); out.setup = [app.ev("PTCTX").R2.toneMappingExposure, run.mat.bounces];
      out.words = app.el("rw-pt").textContent;
      const s0 = run.samples; app.ev("rwinPause")(); go(20);
      out.paused = [RW.paused, run.samples === s0, /^Paused/.test(app.el("rw-pt").textContent), !!run.pausedAt];
      const t0 = run.t0; app.ev("rwinPause")(); go(3);
      out.resumed = [RW.paused, run.samples > s0, run.t0 >= t0];
      app.ev("rwinPause")(); app.ev("rwinStop")();
      out.stopped = [RW.busy, RW.paused, !!RW.result, RW.lastPT.stopped, app.ev("PTRUN")];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.setup, [1.5*1.2, 16], "Burn Value, Quality: Light");      // (Round r29b: Burn Value is on top of the default mapping's gain, PT_GAIN 1.2)
  assert.ok(/^Final Render: [0-9]+ of 64 samples [^0-9]+[0-9]+:[0-9]+/.test(o.words), o.words);
  assert.deepStrictEqual(o.paused, [true, true, true, true]);
  assert.deepStrictEqual(o.resumed, [false, true, true]);
  assert.deepStrictEqual(o.stopped, [false, false, true, true, null]);
});

test("r29 / 3: Rectangle and Sphere: their rows, kept only when set so a file of lights stays its bytes; our presets are one step and read back; each pane's settings go through a file", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const nl = app.ev("normLight");
      out.plain = Object.keys(nl({ type: "dir" }, 1)).sort().join();
      out.rows = [nl({ type: "rect", w: 500, h: 1000 }, 1).w, nl({ type: "rect", w: 500, h: 1000 }, 1).h, nl({ type: "point", radius: 90 }, 1).radius, nl({ type: "spot", penumbra: 5, shadowR: 2 }, 1).shadowR];
      quick(); app.ev("renderWindow")({ lights: true });
      app.el("rw-tools").onclick({ target: { dataset: { add: "rect" } } });
      out.pane = [RW.pane, /data-l="w"/.test(side().innerHTML), /data-l="h"/.test(side().innerHTML), S.lights[0].type];
      const n0 = S.undo.length; side().onchange({ target: { dataset: { preset: "1" }, value: "soft", type: "text" } });
      out.preset = [S.undo.length - n0, S.lights.length, app.ev("lightPresetOf")(), /value="soft" selected/.test(side().innerHTML)];
      app.undo(); out.undone = [S.lights.length, S.lights[0].type, app.ev("lightPresetOf")()];
      // what shows in the picture: a rectangle and a sphere, not a spot or a directional (frame 142)
      const shapes = app.ev("lightShapes")([nl({ type: "rect" }, 1), nl({ type: "point" }, 2), nl({ type: "spot" }, 3), nl({ type: "dir" }, 4), nl({ type: "rect", on: false }, 5)]);
      out.shapes = shapes.map(m => m.geometry.type);
      // and it casts no shadow in a quick picture (it put the floor in its shadow when it did)
      out.names = shapes.map(m => [m.name, m.castShadow]);
      // the path tracer's rectangle is its area light; the quick drawing's stands in
      out.objs = [app.ev("lightObjects")([nl({ type: "rect" }, 1)], null, true)[0].type, app.ev("lightObjects")([nl({ type: "rect" }, 1)], null, false)[0].type];
      // a pane's file
      const camera = JSON.stringify({ gusset: "render-camera", fov: 22, near: 50 });
      app.ev("rwinPaneText")("camera", camera); out.cam = [app.ev("loadRender")().fov, app.ev("loadRender")().near, v3.camera().fov];
      const toastsWere = toasts.length; app.ev("rwinPaneText")("render", camera); out.wrong = toasts.length - toastsWere;
      return out;
    });` }).result;
  assert.strictEqual(o.plain, "az,color,el,id,intensity,name,on,spread,type", "no new keys unless set: a file's lights save to the same bytes");
  assert.deepStrictEqual(o.rows, [500, null, 90, 2], "1000 is the opening value, so not kept");
  assert.deepStrictEqual(o.pane, ["light", true, true, "rect"]);
  assert.deepStrictEqual(o.preset, [1, 3, "soft", true]);
  assert.deepStrictEqual(o.undone, [1, "rect", "custom"]);
  assert.deepStrictEqual(o.shapes, ["PlaneGeometry", "SphereGeometry"]);
  assert.deepStrictEqual(o.names, [["render:lightshape", false], ["render:lightshape", false]]);
  assert.deepStrictEqual(o.objs, ["RectAreaLight", "DirectionalLight"]);
  assert.deepStrictEqual(o.cam, [22, 50, 22], "the one camera took it");
  assert.strictEqual(o.wrong, 1, "another pane's file is refused");
});

test("r29 / 3: a document's render settings and custom views are in its file (version 27), not in its history, and come back on opening; a document with none takes the machine's last choices but not a lens or a custom view; a new document starts clean", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const saveBytes = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return got; };
      const before = app.fileDoc(saveBytes()); out.none = "render" in before;
      const n0 = S.undo.length;
      app.ev("saveRender")(app.ev("normRender")({ mode: "quick", size: "640x480", orient: "portrait", fov: 25, views: [{ name: "Front 3/4", az: 1, el: 0.2, dist: 2000, tx: 0, ty: 900, tz: 0 }], view: "custom" }));
      out.steps = S.undo.length - n0;
      const bytes = saveBytes(), d = app.fileDoc(bytes);
      out.file = [d.v, d.render.size, d.render.orient, d.render.fov, d.render.views[0].name];
      const hist = app.fileParts(bytes).find(p => p.name === "history.json"); out.inHistory = hist ? /"fov"/.test(hist.data.toString("utf8")) : false;
      app.ev("blankDoc")(); app.ev("showDoc") && 0;
      out.fresh = [S.render, app.ev("loadRender")().size, app.ev("loadRender")().fov, app.ev("loadRender")().views.length, app.ev("loadRender")().view];
      app.ev("openFile")("r.pdraft", new Uint8Array(bytes), null, true);
      out.back = [S.render.size, S.render.fov, S.render.views.length, v3.camera().fov];
      // opened and saved again: the same bytes
      const b1 = saveBytes(); app.ev("openFile")("r.pdraft", b1, null, true); const b2 = saveBytes(); out.same = b1.length === b2.length && b1.every((x, i) => x === b2[i]);
      return out;
    });` }).result;
  assert.strictEqual(o.none, false, "untouched: no key, so older documents keep their bytes");
  assert.strictEqual(o.steps, 0, "no history step");
  assert.deepStrictEqual(o.file, [28, "640x480", "portrait", 25, "Front 3/4"]);      // (Round r30: the file version is 28)
  assert.strictEqual(o.inHistory, false);
  assert.deepStrictEqual(o.fresh, [null, "640x480", 40, 0, "now"], "the machine's size, but no lens or custom view of another document");
  assert.deepStrictEqual(o.back, ["640x480", 25, 1, 25]);
  assert.strictEqual(o.same, true);
});

/* ---- batch 3: Quality Render and Schematic Render ---- */
test("r29 / 3: Quality Render and Schematic Render are switches of the 3D window, on its display buttons and the Render menu, off at every start, never in the file, one at a time; Quality's shadows and pixels go when it does", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      const rows = () => Object.fromEntries(app.MENUS.render().filter(x => x.n).map(x => [x.n, [!!x.on, !!x.nb]]));
      out.start = [S.ui.quality3, S.ui.schem3, rows()["Quality Render (3D Window)"], rows()["Schematic Render"]];
      const R = v3.renderer();
      app.ev("setQuality3")(true); app.ev("env3Frame")(); out.q = [S.ui.quality3, R.shadowMap.enabled, rows()["Quality Render (3D Window)"]];
      app.ev("setSchem3")(true); app.ev("env3Frame")(); out.s = [S.ui.quality3, S.ui.schem3, R.shadowMap.enabled];
      app.ev("setQuality3")(true); out.q2 = [S.ui.quality3, S.ui.schem3];
      app.ev("setQuality3")(false); app.ev("env3Frame")(); out.off = [S.ui.quality3, R.shadowMap.enabled, v3.scene().environment];
      out.prefs = app.ev("UI_PREFS").includes("quality3") || app.ev("UI_PREFS").includes("schem3");
      const d = JSON.parse(app.ev("docJSON")()); out.inFile = /quality3|schem3/.test(JSON.stringify(d.display));
      return out;
    });` }).result;
  assert.deepStrictEqual(o.start, [false, false, [false, false], [false, false]]);
  assert.deepStrictEqual(o.q, [true, true, [true, false]]);
  assert.deepStrictEqual(o.s, [false, true, false], "Schematic takes Quality's place");
  assert.deepStrictEqual(o.q2, [true, false]);
  assert.deepStrictEqual(o.off, [false, false, null]);
  assert.strictEqual(o.prefs, false, "view state: every start looks the same");
  assert.strictEqual(o.inFile, false);
});

test("r29 / 3: Schematic Render is drawn over the 3D window and follows it: small at once, sharp a moment later; its panel's rows and eyes change it; a hidden kind draws no line; Snapshot saves it", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.el("stage3d").clientWidth = 400; app.el("stage3d").clientHeight = 300;
      const n0 = app.renders.length; app.ev("setSchem3")(true); app.ev("env3Frame")();
      const r = app.renders.slice(n0); out.first = [...new Set(r.map(x => x.w + "x" + x.h))];
      out.cv = [app.el("sch3d").style.display, app.el("schpanel").style.display];
      out.rows = ["schSil", "schSeam", "schInt", "schColor", "schFill", "schBright"].filter(k => app.el("schpanel").innerHTML.includes('data-r="' + k + '"'));
      const n1 = app.renders.length; app.ev("env3Frame")(); out.still = app.renders.length - n1;
      const n2 = app.renders.length; v3.cam.az += 0.3; app.ev("env3Frame")(); out.turned = app.renders.length - n2;
      // the panel
      const p = app.el("schpanel");
      p.onchange({ target: { dataset: { r: "schSil", num: "1" }, value: "40", type: "text" } }); out.limit = app.ev("loadRender")().schSil;
      p.onchange({ target: { dataset: { pct: "schStitch" }, value: "150", type: "text" } }); out.pct = app.ev("loadRender")().schStitch;
      p.onclick({ target: { dataset: { eye: "schSeam" } } }); out.eye = app.ev("loadRender")().schHide;
      p.onclick({ target: { dataset: { eye: "schSeam" } } }); out.eye2 = app.ev("loadRender")().schHide;
      p.onclick({ target: { dataset: { x: "1" } } }); out.closed = [S.ui.schem3, p.style.display];
      // Snapshot saves the schematic: four passes a view
      const files = []; app.setDownload((n) => files.push(n));
      const n3 = app.renders.length; app.ev("snap3Save")({ ...app.ev("snap3Default")(), w: 200, h: 100 }); out.snap = [app.renders.length - n3, toasts[toasts.length - 1]];
      app.ev("setSchem3")(false); app.ev("env3Frame")(); out.off = [app.el("sch3d").style.display];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.first, ["200x150", "800x600"], "the window's half at once, then twice its size (here the fake page's timer runs at once)");
  assert.deepStrictEqual(o.cv, ["block", "block"]);
  assert.deepStrictEqual(o.rows, ["schSil", "schSeam", "schInt", "schColor", "schFill", "schBright"]);
  assert.strictEqual(o.still, 0, "nothing changed: nothing drawn");
  assert.ok(o.turned >= 4, "turned: drawn again: " + o.turned);
  assert.strictEqual(o.limit, 10, "only up to 10 pixels, as the maintainer found");
  assert.strictEqual(o.pct, 1.5);
  assert.deepStrictEqual(o.eye, ["schSeam"]); assert.deepStrictEqual(o.eye2, []);
  assert.deepStrictEqual(o.closed, [true, "none"], "the panel closed, the look stays");
  assert.strictEqual(o.snap[0], 4); assert.ok(/^3D snapshot saved as snapshot-3d[.]png/.test(o.snap[1]), o.snap[1]);
  assert.deepStrictEqual(o.off, ["none"]);
});

test("r29 / 3: Save GIF: a real animated GIF: its header, a palette, a frame per picture, its LZW data decodes to the picture's indexes", () => {
  const o = boot({ blank: true, script: `
    const st = app.ev("gifStart")(2000, 1000);
    const W = st.W, H = st.H;
    const ix = new Uint8Array(40); for (let k = 0; k < 40; k++) ix[k] = k % 5 === 0 ? 252 : (k*7) % 200;
    const lzw = app.ev("gifLZW")(ix);
    const rgba = new Uint8ClampedArray(8); rgba.set([255, 0, 0, 255, 0, 0, 0, 0]);
    return { W, H, head: Array.from(st.out.slice(0, 6)), lzw, ix: Array.from(ix), idx: Array.from(app.ev("gifIndex")(rgba, 2, 1)), done: Array.from(app.ev("gifDone")({ out: [1, 2] })) };` }).result;
  assert.deepStrictEqual([o.W, o.H], [800, 400], "at most 800 a side");
  assert.strictEqual(String.fromCharCode(...o.head), "GIF89a");
  assert.strictEqual(o.lzw[0], 8, "minimum code size");
  // a standard LZW decoder over the blocks
  const bytes = []; let i = 1; while (o.lzw[i]) { const n = o.lzw[i++]; for (let k = 0; k < n; k++) bytes.push(o.lzw[i++]); i++; i--; i += 0; if (false) break; if (i >= o.lzw.length) break; }
  let acc = 0, nb = 0, size = 9, p = 0, dict = [], prev = null; const out = [];
  const reset = () => { dict = []; for (let k = 0; k < 256; k++) dict[k] = [k]; dict[256] = []; dict[257] = []; size = 9; prev = null; };
  reset();
  for (;;) {
    while (nb < size && p < bytes.length) { acc |= bytes[p++] << nb; nb += 8; }
    if (nb < size) break;
    const c = acc & ((1 << size) - 1); acc >>>= size; nb -= size;
    if (c === 256) { reset(); continue; }
    if (c === 257) break;
    const e = c < dict.length ? dict[c] : [...prev, prev[0]];
    out.push(...e);
    if (prev) { dict.push([...prev, e[0]]); if (dict.length === (1 << size) && size < 12) size++; }
    prev = e;
  }
  assert.deepStrictEqual(out, o.ix);
  assert.deepStrictEqual(o.idx, [5*42, 252], "a red pixel; a see-through one");
  assert.deepStrictEqual(o.done, [1, 2, 0x3b], "the trailer");
});

/* ---- batch 4: Print Layout's trimmed view; the printed sheets ---- */
const LAY = `
  const out = {}, sq = (n, x, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:0},{x:x+w,y:0},{x:x+w,y:h},{x:x,y:h}], true));
  S.pieces.push(sq("Big", 0, 500, 600)); app.commit();
  const calls = [];
  const ctx = app.ev("lctx");
  const log = () => { calls.length = 0; for (const k of ["fillRect", "strokeRect", "fillText", "moveTo", "lineTo"]) { ctx[k] = (...a) => calls.push([k, ...a]); } };
`;
test("r29 / 4: Print Layout opens trimmed: no grey margin, one sheet of white with thin lines and labels where the pages meet, drawn over the patterns; Paper View shows the whole sheets; a roll stays as it is", () => {
  const o = boot({ blank: true, script: LAY + `
    app.setMode("layout"); const L = app.layoutOf(); Object.assign(L, { paper: "a4", orient: "portrait", cols: 3, margin: 10, overlap: 0 });
    log(); app.ev("drawLayout")();
    const greys = () => calls.filter(c => c[0] === "fillRect").length, labels = () => calls.filter(c => c[0] === "fillText" && /^[A-Z][0-9]+$/.test(c[1])).map(c => c[1]);
    const sheet = app.layoutSheet(), st = app.layoutStats();
    out.trim = [S.layPaper, greys(), labels(), st.rows];
    const z = S.lview.s, a = app.layS({ x: 0, y: 0 });
    // a whole white area, as wide as the sheets' insides together, no gaps
    const big = calls.filter(c => c[0] === "fillRect").map(c => c.slice(1)).find(c => Math.abs(c[2] - 3*190*z) < 1e-6);
    out.white = !!big && Math.abs(big[0] - a.x) < 1e-6 && Math.abs(big[1] - a.y) < 1e-6;
    // the switch
    app.ev("layoutToolsBuild")();
    S.layPaper = true; log(); app.ev("drawLayout")(); out.paper = [labels().length, calls.filter(c => c[0] === "fillRect" && Math.abs(c[3] - 210*z) < 1e-6).length];
    S.layPaper = false;
    // a roll: no pages, whichever
    Object.assign(L, { paper: "roll24" }); log(); app.ev("drawLayout")(); out.roll = labels();
    return out;` }).result;
  assert.strictEqual(o.trim[0], null, "trimmed unless asked");
  assert.ok(o.trim[2].length === 3*o.trim[3] && o.trim[2][0] === "A1" && o.trim[2][2] === "A3", "each page's label: " + o.trim[2]);
  assert.strictEqual(o.white, true, "one white area 3 x 190 mm: the sheets' insides edge to edge");
  assert.strictEqual(o.paper[0], 3*o.trim[3], "Paper View: labelled too");
  assert.ok(o.paper[1] >= 3, "and the whole sheets, 210 mm wide: " + o.paper[1]);
  assert.deepStrictEqual(o.roll, [], "a roll: no tiling");
});

test("r29 / 4: the printed sheets: a cut line at the margin, the page's label, triangles on the edges that meet and on no others, matching across a join at the same place of the drawing; the 50 mm square on the first sheet only; a roll has none of it", () => {
  const o = boot({ blank: true, script: `
    const plan = app.ev("printPlan");
    const st = { paper: "a4", orient: "portrait", mode: "actual", margin: 10, overlap: 0, customW: 500, customH: 700 };
    const p = plan({ x0: 0, y0: 0, x1: 500, y1: 600 }, st);
    const html = app.ev("printHTML")(p, p.tiles, "", st, "T");
    const pages = html.match(/<svg xmlns[\\s\\S]*?<\\/svg>/g);
    const tri = (pg) => (pg.match(/class="align" d="([^"]+)"/g) || []).map(x => x.replace(/^.*d="|"$/g, ""));
    const cuts = pages.filter(pg => /stroke-dasharray="3 2"/.test(pg) && /x="10" y="10" width="190" height="277"/.test(pg)).length;
    const a1 = tri(pages[0]), a2 = tri(pages[1]), b1 = tri(pages[p.cols]);
    const roll = plan({ x0: 0, y0: 0, x1: 500, y1: 600 }, { ...st, paper: "roll24" });
    const rh = app.ev("printHTML")(roll, roll.tiles, "", { ...st, paper: "roll24" }, "T");
    return { cols: p.cols, rows: p.rows, n: pages.length, cuts, a1: a1.length, a2: a2.length, b1: b1.length, first: a1[0], second: a2[0],
      square: pages.map(pg => /data-test="square"[^>]*width="50" height="50"/.test(pg)), labels: pages.map(pg => /data-tile="([A-Z0-9]+)"/.exec(pg)[1]), rollMarks: [/align/.test(rh), /stroke-dasharray="3 2"/.test(rh), /data-test="square"/.test(rh)], rollPages: roll.cols*roll.rows };` }).result;
  assert.strictEqual(o.cuts, o.n, "every sheet has its cut line at the margin");
  assert.deepStrictEqual(o.labels.slice(0, 2), ["A1", "A2"]);
  assert.strictEqual(o.a1, 4, "A1, at a corner of the marker: right edge and foot, two each");
  assert.strictEqual(o.a2, o.cols > 2 ? 6 : 4, "A2: its left edge too");
  assert.ok(o.b1 >= 4);
  assert.deepStrictEqual(o.square, o.square.map((_, k) => k === 0), "the scale test on the first sheet only");
  assert.deepStrictEqual(o.rollMarks, [false, false, true], "a roll: no cut line, no joins; its scale test stays");
  assert.strictEqual(o.rollPages, 1);
  // the two triangles of a join make one diamond: A1's right edge at x = 200, A2's left at x = 10, at the same height
  const pts = (d) => d.replace(/[MLZ]/g, " ").trim().split(/\s+/).map(Number);
  const r = pts(o.first), l = pts(o.second);
  assert.deepStrictEqual([r[0], r[2], r[3]], [200, 196, r[1] + 4], "A1's: based on its right cut line, pointing in");
  assert.deepStrictEqual([l[0], l[2], l[1]], [10, 14, r[1]], "A2's: based on its left cut line, pointing in, at the same height");
});

test("r29 / 4: the Cut-off margin runs 0 to 30, opens at 10, and sets how much of each sheet is printed on; a new layout's sheets butt edge to edge; a file's own overlap stays", () => {
  const o = boot({ blank: true, script: LAY + `
    const nl = app.ev("normLayout");
    out.def = [nl(null).margin, nl(null).overlap, nl({ overlap: 10 }).overlap, nl({ margin: 25 }).margin];
    app.setMode("layout");
    const row = app.ev("layoutProps") && 1;
    const L = app.layoutOf();
    for (const m of [0, 10, 30]) { L.margin = m; const z = app.layoutSheet(); (out.iw = out.iw || []).push(z.iw); }
    out.print = [app.ev("normPrint")({ margin: 99 }).margin, app.ev("normPrint")({}).margin];
    return out;` }).result;
  assert.deepStrictEqual(o.def, [10, 0, 10, 25]);
  assert.deepStrictEqual(o.iw, [210, 190, 150], "A4 less the margin both sides");
  assert.deepStrictEqual(o.print, [30, 10]);
});

test("r29 / 4: A4, A3, Letter, portrait and landscape: each sheet its own size, its cut line at the margin, the join's triangles on its cut lines, the 50 mm square; the pages add up to the marker with nothing lost; with an overlap the triangles lie on the overlap's line", () => {
  const o = boot({ blank: true, script: `
    const out = {};
    for (const [paper, orient] of [["a4", "portrait"], ["a4", "landscape"], ["a3", "portrait"], ["a3", "landscape"], ["letter", "portrait"], ["letter", "landscape"]]) {
      const st = { paper, orient, mode: "actual", margin: 10, overlap: 0, customW: 500, customH: 700 };
      const p = app.ev("printPlan")({ x0: 0, y0: 0, x1: 900, y1: 1000 }, st), html = app.ev("printHTML")(p, p.tiles, "", st, "T");
      const first = html.match(/<svg xmlns[^>]*>/)[0];
      out[paper + "-" + orient] = { pw: p.pw, ph: p.ph, iw: p.iw, ih: p.ih, cols: p.cols, rows: p.rows, n: p.tiles.length,
        size: /width="([0-9.]+)mm" height="([0-9.]+)mm"/.exec(first).slice(1).map(Number), squares: (html.match(/data-test="square"/g) || []).length, tris: (html.match(/class="align"/g) || []).length,
        wholeW: p.cols*p.iw >= 900, wholeH: p.rows*p.ih >= 1000 };
    }
    const st = { paper: "a4", orient: "portrait", mode: "actual", margin: 10, overlap: 12, customW: 500, customH: 700 };
    const p = app.ev("printPlan")({ x0: 0, y0: 0, x1: 500, y1: 280 }, st), html = app.ev("printHTML")(p, p.tiles, "", st, "T");
    out.ov = /class="align" d="M ([0-9.]+) /.exec(html)[1];
    return out;` }).result;
  const sizes = { "a4-portrait": [210, 297], "a4-landscape": [297, 210], "a3-portrait": [297, 420], "a3-landscape": [420, 297], "letter-portrait": [215.9, 279.4], "letter-landscape": [279.4, 215.9] };
  for (const [k, [w, h]] of Object.entries(sizes)) {
    const r = o[k];
    assert.deepStrictEqual(r.size, [w, h], k);
    assert.deepStrictEqual([+r.iw.toFixed(3), +r.ih.toFixed(3)], [+(w - 20).toFixed(3), +(h - 20).toFixed(3)], k + ": less the margin");
    assert.strictEqual(r.squares, 1, k); assert.strictEqual(r.n, r.cols*r.rows, k); assert.ok(r.wholeW && r.wholeH, k);
    // each join has two triangles on each of its two sheets
    assert.strictEqual(r.tris, 4*((r.cols - 1)*r.rows + (r.rows - 1)*r.cols), k);
  }
  assert.strictEqual(o.ov, String(10 + 190 - 12), "on the overlap's line, where the next sheet's edge lies");
});

/* ---- batch 5: Print opens one window ---- */
// a frame as a browser treats it: going into the page it loads; with no pages yet that load is of an empty page (the bug), and given pages it loads again
const FRAME = `
  const printed = [];
  app.ev("(() => { const ce = document.createElement; globalThis.__frames = []; document.createElement = (t) => { const e = ce(t); if (t !== 'iframe') return e; let doc = ''; e.remove = () => {}; e.contentWindow = { focus() {}, print() { globalThis.__prints.push(doc); } };\\n" +
    "Object.defineProperty(e, 'srcdoc', { get: () => doc, set: (v) => { doc = v; if (e.inPage && e.onload) e.onload(); } }); return e; }; const ap = document.body.appendChild; document.body.appendChild = (c) => { const r = ap.call(document.body, c); if (c.contentWindow && !c.inPage) { c.inPage = true; if (c.onload) c.onload(); } return r; }; })()");
  app.ev("globalThis").__prints = printed;
`;
test("r29 / 5: Print opens exactly one print window, with the pages in it: from the Print box and from Print Layout (the first used to be a blank window, and the right one came after its Cancel)", () => {
  const o = boot({ blank: true, script: LAY + FRAME + `
    app.ev("runPrint")("<html>the pages</html>", { pw: 210, ph: 297 });
    out.direct = printed.slice();
    printed.length = 0; app.ev("runPrint")("<html>again</html>", { pw: 210, ph: 297 }); out.again = printed.slice();
    printed.length = 0; app.setMode("layout"); app.layoutCmd("print"); out.layout = [printed.length, /<svg/.test(printed[0] || "")];
    return out;` }).result;
  assert.deepStrictEqual(o.direct, ["<html>the pages</html>"], "once, and not blank");
  assert.deepStrictEqual(o.again, ["<html>again</html>"]);
  assert.deepStrictEqual(o.layout, [1, true]);
});

module.exports = T;
