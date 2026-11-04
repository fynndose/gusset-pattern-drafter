// Round r29b: the path-traced picture as bright as Quick's, a light's shape in it, the schematic's lines and marks; what needs a graphics card is in
// scripts/pt-check.js (local, on real hardware) and the browser smoke (PDRAFT_SMOKE_ONLY=r29b).
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });

function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-r29b-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}

/* ---- batch 1 ---- */
test("r29b / 1: the default color mapping leaves the 3D window's gray background where Quick has it, keeps mid tones within a few percent, rolls a highlight off, grows with Burn Value and never falls; the shader it is written into is in this three.js", () => {
  const o = boot({ blank: true, script: `
    const f = app.ev("ptToneOf");
    return { bg: f(0.33), mid: f(0.55), one: f(1), up: [0, 0.1, 0.3, 0.6, 1, 1.5, 3].map(x => f(x)), burn: f(0.33, 2), from: app.ev("PT_TONE_FROM"), glsl: app.ev("ptToneGLSL")() };` }).result;
  assert.ok(Math.abs(o.bg - 0.33) < 0.01, "the background, " + o.bg);
  assert.ok(Math.abs(o.mid - 0.55) < 0.05, "mid tones, " + o.mid);
  assert.ok(o.one > 0.8 && o.one < 1, "white light is bright and not yet clipped, " + o.one);
  for (let k = 1; k < o.up.length; k++) assert.ok(o.up[k] >= o.up[k - 1], "never falls");
  assert.ok(o.burn > o.bg*1.4, "Burn Value on top");
  const three = fs.readFileSync(path.join(__dirname, "..", "vendor", "three.min.js"), "utf8");
  assert.ok(three.includes(o.from), "three.js's custom mapping is what the program replaces: a new three.js must be checked here");
  assert.ok(/^vec3 CustomToneMapping/.test(o.glsl) && o.glsl.includes("toneMappingExposure"));
});

test("r29b / 1: the schematic's lines: the avatar in front of the cloth gets no line, the cloth in front of the avatar keeps its own; without a depth to tell by, the line stays", () => {
  const o = boot({ blank: true, script: `
    const W = 6, H = 3, A = app.ev("schId")(1), AV = app.ev("SCH_AV"), schLines = app.ev("schLines");
    const run = (avDepth, front) => {
      const I = new Uint8ClampedArray(4*W*H), D = new Uint8ClampedArray(4*W*H), L = new Uint8ClampedArray(4*W*H);
      const col = [A, A, A, AV, AV, AV], dep = [100, 100, 100, avDepth, avDepth, avDepth];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y*W + x; I.set([...col[x], 255], 4*p); D.set([dep[x], 0, 0, 255], 4*p); }
      const m = schLines(I, D, L, W, H, 25*256, front);
      return Array.from(m.sil.slice(W, 2*W)).join("") + "/" + Array.from(m.seam.slice(W, 2*W)).join("");
    };
    return { hand: run(50, 8*256), skirt: run(150, 8*256), level: run(97, 8*256), none: run(50) };` }).result;
  assert.strictEqual(o.hand, "000000/000000", "a hand before the skirt: the edge is the avatar's");
  assert.strictEqual(o.skirt, "001000/000000", "a hem before the leg: the garment's own edge");
  assert.strictEqual(o.level, "001000/000000", "the waistband on the body, within the margin: the garment's edge");
  assert.strictEqual(o.none, "001000/000000", "the older call: as it was");
});

test("r29b / 1: while the schematic is on the 3D window's frame draws the cloth and avatar into the depth only, the marks as they are, on nothing; all of it put back after the frame and in no snapshot's way", () => {
  const o = boot({ blank: true, three: true, script: `
    const v3 = app.view3d, G3 = app.G3, out = {};
    app.setLayout("both");
    const sq = app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:400}], true));
    S.pieces.push(sq); sq.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; app.commit(); app.ev("garmentSync")();
    return app.wait(() => v3.ready() && G3.items.size > 0, "the 3D window").then(() => {
      const sc = v3.scene(), R = v3.renderer(), marks = app.ev("schem3Marks"), mark = v3.group("gizmo"), THREE = app.ev("THREE");
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial()); mark.add(m);
      const cloth = [...G3.items.values()][0].obj, mat = [].concat(cloth.material)[0], grid = sc.getObjectByName("grid:fine"), bg = sc.background;
      out.off = marks(sc, R);
      S.ui.schem3 = true;
      const back = marks(sc, R);
      out.during = { cloth: mat.colorWrite, mark: m.material.colorWrite, grid: grid.visible, bg: sc.background, light: sc.children.find(c => c.isLight).visible };
      back();
      out.after = { cloth: mat.colorWrite, mark: m.material.colorWrite, grid: grid.visible, bg: sc.background === bg };
      S.ui.schem3 = false;
      return out;
    });` }).result;
  assert.strictEqual(o.off, null, "off: nothing touched");
  assert.deepStrictEqual(o.during, { cloth: false, mark: true, grid: false, bg: null, light: true });
  assert.deepStrictEqual(o.after, { cloth: true, mark: true, grid: true, bg: true });
});

test("r29b / 1: a light's shape: the rectangle and the sphere that are on, not a cone, a directional or a dome; placed where the light is", () => {
  const o = boot({ blank: true, three: true, script: `
    const norm = app.ev("normLight"), box = { x0: -100, x1: 100, y0: 0, y1: 1800, z0: -100, z1: 100 };
    const list = [norm({ type: "rect", az: 0, el: 0 }, 1), norm({ type: "point", az: 90, el: 0, radius: 90 }, 2), norm({ type: "spot" }, 3), norm({ type: "dir" }, 4), norm({ type: "dome" }, 5), norm({ type: "rect", on: false }, 6)];
    const shapes = app.ev("lightShapes")(list, box), lights = app.ev("lightObjects")(list.slice(0, 2), box, true);
    return { n: shapes.length, kinds: shapes.map(m => m.geometry.type), same: shapes.every((m, k) => m.position.distanceTo(lights[k].position) < 1e-6) };` }).result;
  assert.deepStrictEqual(o, { n: 2, kinds: ["PlaneGeometry", "SphereGeometry"], same: true });
});

/* ---- batch 2: getting ready, on weak hardware ---- */
// two sewn rectangles, the workspace, a stand-in for the path tracing library, a clock and timers the test moves itself; a compile that does not end until go() is called
// (Round r32) Path Traced is the desktop app's only (the browser's limits): the tests that render with it boot as the desktop app (desktop: true)
const PREP = `
  const out = {}, v3 = app.view3d, G3 = app.G3, RW = app.ev("RWIN"), G = app.ev("globalThis");
  app.setLayout("both");
  const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:0},{x:x+300,y:0},{x:x+300,y:400},{x:x,y:400}], true));
  S.pieces.push(sq("Front", 0)); S.pieces[0].p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 };
  app.commit(); app.ev("garmentSync")();
  app.ev("(() => { const ce = document.createElement; document.createElement = (t) => { const e = ce(t); e.toDataURL = (m) => 'data:' + (m || 'image/png') + ';base64,QUJD'; return e; }; })()");
  const start = () => {
    const upd = { updateFrom() {}, setTextures() {} };
    G.THREE_PATHTRACER = {
      PhysicalPathTracingMaterial: class { constructor() { Object.assign(this, { bvh: upd, attributesArray: upd, materialIndexAttribute: upd, textures: upd, materials: upd, lights: upd, envMapInfo: upd }); } dispose() {} },
      PathTracingRenderer: class { constructor() { this.samples = 0; this.tiles = { set() {} }; this.target = { texture: {} }; } setSize() {} reset() { this.samples = 0; } update() { this.samples++; } },
      PathTracingSceneGenerator: class { generate() { return { bvh: { geometry: { attributes: {}, dispose() {} } }, textures: [], materials: [], lights: [] }; } },
      GradientEquirectTexture: class { constructor() { this.topColor = { set() {} }; this.bottomColor = { set() {} }; } update() {} dispose() {} },
      FullScreenQuad: class { constructor(m) { this.material = m; } render() {} dispose() {} },
    };
    app.ev("ptSupport = () => null");
    app.ev("ptCard(); PT_PARALLEL = true");      // (Round r32: a graphics card that compiles beside the page, as these tests' cards are; ptParallel())
    app.el("rw-prog").classList = { set: new Set(), add(k) { this.set.add(k); }, remove(k) { this.set.delete(k); }, contains(k) { return this.set.has(k); } };
  };
  let clock = 1000; G.performance = { now: () => clock };
  const later = []; G.requestAnimationFrame = (f) => { later.push(f); return 1; };
  const frames = (n) => { for (let k = 0; k < n && later.length; k++) later.shift()(); };
  const ticks = new Map(); let nextIv = 1;
  G.setInterval = (f) => { ticks.set(nextIv, f); return nextIv++; }; G.clearInterval = (i) => { ticks.delete(i); };
  const wait = (s) => { clock += s*1000; for (const f of [...ticks.values()]) f(); };
  let release = null;
  app.ev("ptCompile = (run, go) => { globalThis.__go = go; }");
  const compiled = () => G.__go();
  const prepping = () => app.el("rw-prog").classList.contains("prep");
  const quality = (more) => app.ev("saveRender")(app.ev("normRender")({ mode: "quality", samples: 64, size: "custom", w: 300, h: 200, ...more }));
  const mark = () => app.storage.get("pdraft:ptfail");
`;
test("r29b / 2: while it prepares: the words, the moving bar and its seconds; then samples, with the bar's own width; a second render does not prepare again", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: PREP + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      start(); quality(); app.ev("renderWindow")(); app.ev("rwinRender")();
      out.prep = [prepping(), app.el("rw-pt").textContent, RW.busy, ticks.size];
      wait(12); out.t12 = app.el("rw-pt").textContent;
      compiled(); frames(4);
      out.after = [prepping(), ticks.size, /^Final Render: /.test(app.el("rw-pt").textContent), app.ev("PTCTX").ready];
      frames(200); out.done = [RW.busy, !!RW.result, mark() === undefined || mark() === null];
      app.ev("rwinRender")(); out.second = [prepping(), ticks.size];
      app.ev("rwinStop")();
      return out;
    });` }).result;
  assert.deepStrictEqual(o.prep.slice(0, 1), [true]);
  assert.ok(/^Preparing the quality renderer/.test(o.prep[1]) && /once each time the program starts/.test(o.prep[1]) && / 0 s$/.test(o.prep[1]), o.prep[1]);
  assert.deepStrictEqual(o.prep.slice(2), [true, 1], "the render is on, one timer for its seconds");
  assert.ok(/ 12 s$/.test(o.t12), "the seconds go on: " + o.t12);
  assert.deepStrictEqual(o.after, [false, 0, true, true], "the first sample ends it: no timer left");
  assert.deepStrictEqual(o.done, [false, true, true], "finished, no mark");
  assert.deepStrictEqual(o.second, [false, 0], "the same session's next render: no preparing");
});

test("r29b / 2: Cancel (the same as Stop) ends preparing at once: nothing running, nothing marked, a later render goes on; a series stopped while preparing ends too; the button is on the page beside the bar", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8");
  assert.ok(/id="rw-prog">.*?<\/div>\s*<button[^>]*id="rw-cancel"[^>]*data-act="stop"/.test(html), "the Cancel button follows the bar, with Stop's action");
  assert.ok(/\.rw-prog\.prep \+ #rw-cancel \{ display: inline-block; \}/.test(html) && /#rw-cancel \{ display: none; \}/.test(html), "seen only while preparing");
  const o = boot({ blank: true, three: true, desktop: true, script: PREP + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      start(); quality(); app.ev("renderWindow")(); app.ev("rwinRender")();
      app.ev("rwinAct")("stop");
      out.one = [app.ev("PTRUN"), RW.busy, prepping(), ticks.size, !mark(), app.ev("loadRender")().mode];
      compiled();                      // (the card finishes behind it)
      out.late = [app.ev("PTRUN"), later.length];
      app.ev("rwinRender")(); out.again = [prepping(), RW.busy]; compiled(); frames(200); out.againDone = [RW.busy, !!RW.result];
      app.ev("ptContext")().ready = false;
      quality({ kind: "turntable", ttCount: 4 }); app.ev("rwinRender")();
      out.seq = [prepping(), RW.busy, !!RW.seq];
      app.ev("rwinAct")("stop");
      out.seqStop = [RW.busy, app.ev("PTRUN"), ticks.size, prepping()];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.one, [null, false, false, 0, true, "quality"], "gone at once, and Path Traced stays the Engine");
  assert.strictEqual(o.late[0], null, "the compile ending later starts nothing");
  assert.deepStrictEqual(o.again, [true, true]); assert.deepStrictEqual(o.againDone, [false, true]);
  assert.deepStrictEqual(o.seq, [true, true, true]);
  assert.deepStrictEqual(o.seqStop, [false, null, 0, false], "before r29b a series stopped here stayed busy for good");
});

test("r29b / 2: past the limit: Quick's picture with one line, the machine's mark; Final Render stays on Quick and the pane says why; Path Traced chosen again takes the mark off and has the longer limit; another graphics card is not held to the mark", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: PREP + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      start(); quality(); app.ev("renderWindow")(); app.ev("rwinRender")();
      wait(119); out.before = [RW.busy, !mark()];
      wait(2);
      out.fell = [RW.busy, !!RW.result, RW.result.mode, app.ev("PTRUN"), ticks.size, prepping(), app.el("toast").textContent, JSON.parse(mark()).why];
      out.engine = app.ev("loadRender")().mode;
      out.hint = app.ev("rwinModeHTML")(app.ev("loadRender")());
      RW.result = null; app.ev("rwinRender")(); out.next = [RW.busy, RW.result && RW.result.mode, app.ev("PTRUN")];
      app.ev("rwinSet")("mode", { value: "quality", dataset: {} });
      out.chosen = [app.ev("loadRender")().mode, mark() == null];
      app.ev("rwinRender")();
      wait(121); out.longer = [RW.busy, mark() == null];
      wait(480); out.gaveUp = [RW.busy, /600 s/.test(JSON.parse(mark()).why)];
      // the mark names the card: on another it does not hold
      app.storage.set("pdraft:ptfail", JSON.stringify({ card: "another card", why: "x" })); app.ev("PT_FAIL = undefined");
      out.other = app.ev("loadRender")().mode;
      return out;
    });` }).result;
  assert.deepStrictEqual(o.before, [true, true], "119 s: still preparing");
  assert.deepStrictEqual(o.fell.slice(0, 6), [false, true, "quick", null, 0, false]);
  assert.ok(/did not get ready here \(not ready after 120 s\): using Quick/.test(o.fell[6]), o.fell[6]);
  assert.strictEqual(o.fell[7], "not ready after 120 s");
  assert.strictEqual(o.engine, "quick"); assert.ok(/did not get ready on this graphics card/.test(o.hint) && /10 minutes/.test(o.hint), o.hint);
  assert.deepStrictEqual(o.next, [false, "quick", null], "the next Final Render: Quick, at once");
  assert.deepStrictEqual(o.chosen, ["quality", true]);
  assert.deepStrictEqual(o.longer, [true, true], "chosen again: past 120 s it goes on"); assert.deepStrictEqual(o.gaveUp, [false, true]);
  assert.strictEqual(o.other, "quality");
});

test("r29b / 2: a shader refused, a context lost or an error while preparing fall back the same way; a series goes on with Quick from where it was; the Interactive preview falls back too; Cancel leaves no mark", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: PREP + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      start(); quality(); app.ev("renderWindow")();
      const reset = () => { app.storage.delete("pdraft:ptfail"); app.ev("PT_FAIL = undefined"); app.ev("PT_PREP_T0 = null"); RW.result = null; };      // (Round r29c: the clock counts from when the card was first asked)
      app.ev("rwinRender")(); app.ev("ptContext")().bad = true; compiled(); frames(4);
      out.refused = [RW.busy, RW.result.mode, JSON.parse(mark()).why]; reset();
      app.ev("ptContext")().ready = false;
      app.ev("rwinRender")(); app.ev("PTCTX").cvs.dispatch = 0; const run = app.ev("PTRUN"); app.ev("ptPrepFail")(run, "the graphics card gave up on it");
      out.lost = [RW.busy, RW.result.mode, JSON.parse(mark()).why]; reset();
      app.ev("rwinRender")(); const r2 = app.ev("PTRUN"); r2.pt.update = () => { throw new Error("boom"); }; compiled(); frames(4);
      out.err = [RW.busy, RW.result.mode, /boom/.test(JSON.parse(mark()).why)]; reset();
      // a series
      quality({ kind: "turntable", ttCount: 4 }); app.ev("rwinRender")();
      wait(121); frames(40);
      out.seq = [RW.busy, RW.seq.files.length, RW.seq.o.mode, !!mark()]; reset();
      // Interactive
      quality({ kind: "image" }); RW.seq = null; const t = G.setTimeout; G.setTimeout = (f) => { f(); return 1; };
      app.ev("rwinInteractive")(); out.live = [RW.live, prepping(), !!app.ev("PTRUN")];
      wait(121); out.liveFell = [RW.live, app.ev("PTRUN"), prepping(), app.ev("loadRender")().mode];
      G.setTimeout = t; return out;
    });` }).result;
  assert.deepStrictEqual(o.refused, [false, "quick", "its shader was refused"]);
  assert.deepStrictEqual(o.lost, [false, "quick", "the graphics card gave up on it"]);
  assert.deepStrictEqual(o.err, [false, "quick", true]);
  assert.deepStrictEqual(o.seq, [false, 4, "quick", true], "all four pictures, with Quick");
  assert.deepStrictEqual(o.live, [true, true, true]);
  assert.deepStrictEqual(o.liveFell, [true, null, false, "quick"], "Interactive goes on, with Quick's picture");
});

/* ---- Round r29c: preparing from the workspace's opening; software WebGL ---- */
// the real ptCompile, on a renderer whose compile the test finishes, counted
const WARM = PREP.replace('app.ev("ptCompile = (run, go) => { globalThis.__go = go; }");', "") + `
  const warmUp = () => {
    start(); const R2 = app.ev("ptContext")().R2; G.__compiles = 0;
    R2.extensions = { has: (n) => n === "KHR_parallel_shader_compile" };
    R2.compileAsync = () => { G.__compiles++; return new Promise((res) => { G.__done = res; }); };
    R2.compile = () => {}; R2.setRenderTarget = R2.setRenderTarget || (() => {});
    quality();
  };
  const settle = () => new Promise((res) => setImmediate(res));
`;
test("r29c / 1: preparing begins when the workspace opens, with its words and Cancel; a Final Render clicked before it is ready goes on from it: the same compile, the same clock; nothing of the avatar's scene is built for it", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: WARM + `
    return app.wait(() => v3.ready(), "the 3D window").then(async () => {
      warmUp(); app.ev("renderWindow")(); app.ev("ptWarm")();
      out.opened = [prepping(), G.__compiles, !!app.ev("WARM"), app.ev("PTRUN"), !!RW.busy, /^Preparing the quality renderer/.test(app.el("rw-pt").textContent)];
      out.meshes = app.ev("WARM").floor ? 1 : 0;
      wait(5); out.t5 = app.el("rw-pt").textContent;
      app.ev("rwinRender")();
      out.taken = [prepping(), G.__compiles, app.ev("WARM"), !!app.ev("PTRUN"), RW.busy, ticks.size];
      wait(2); out.t7 = app.el("rw-pt").textContent;
      G.__done(); await settle(); frames(4);
      out.first = [prepping(), ticks.size, app.ev("PTCTX").ready, G.__compiles, /^Final Render: /.test(app.el("rw-pt").textContent)];
      frames(200); out.done = [RW.busy, !!RW.result];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.opened, [true, 1, true, null, false, true], "preparing, no render running: Final Render is still free to press");
  assert.strictEqual(o.meshes, 1, "a floor of its own");
  assert.ok(/ 5 s$/.test(o.t5), o.t5);
  assert.deepStrictEqual(o.taken, [true, 1, null, true, true, 1], "the render took it over: no second compile, one timer");
  assert.ok(/ 7 s$/.test(o.t7), "the same clock: " + o.t7);
  assert.deepStrictEqual(o.first, [false, 0, true, 1, true]);
  assert.deepStrictEqual(o.done, [false, true]);
});

test("r29c / 1: left alone it finishes by itself and the first render does not prepare; Cancel stops the bar and it is not begun again by itself, yet Final Render and choosing Path Traced still work; closing the workspace lets it go; Quick begins nothing; past the limit: the mark and one line, no picture", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: WARM + `
    return app.wait(() => v3.ready(), "the 3D window").then(async () => {
      warmUp(); app.ev("renderWindow")(); app.ev("ptWarm")();
      G.__done(); await settle();
      out.alone = [app.ev("PTCTX").ready, prepping(), ticks.size, app.ev("WARM"), app.el("rw-prog").classList.contains("on")];
      app.ev("rwinRender")(); out.instant = [prepping(), G.__compiles]; frames(200); out.instantDone = [RW.busy, !!RW.result];
      // Cancel
      app.ev("PTCTX").ready = false; app.ev("PT_PREP_T0 = null"); RW.result = null;
      app.ev("ptWarm")(); out.again = [prepping(), G.__compiles];
      app.ev("rwinAct")("stop"); out.cancel = [prepping(), ticks.size, app.ev("WARM"), app.ev("PT_WARM_OFF"), !mark()];
      app.ev("rwinClose")(); app.ev("renderWindow")(); app.ev("ptWarm")(); out.reopen = [prepping(), app.ev("WARM")];
      app.ev("rwinRender")(); out.final = [prepping(), RW.busy, G.__compiles]; app.ev("rwinStop")();
      app.ev("rwinSet")("mode", { value: "quality", dataset: {} }); out.chosen = [!!app.ev("WARM"), prepping()];
      app.ev("rwinSet")("mode", { value: "quick", dataset: {} }); out.other = [app.ev("WARM"), prepping(), ticks.size];
      app.ev("rwinSet")("mode", { value: "quality", dataset: {} });
      app.ev("rwinClose")(); out.closed = [app.ev("WARM"), ticks.size];
      // Quick
      app.ev("saveRender")(app.ev("normRender")({ mode: "quick" })); app.ev("renderWindow")(); app.ev("ptWarm")(); out.quick = app.ev("WARM"); app.ev("rwinClose")();
      // the limit, with nothing rendering
      quality(); app.ev("PT_PREP_T0 = null"); app.ev("renderWindow")(); app.ev("ptWarm")();
      wait(121); out.limit = [app.ev("WARM"), prepping(), RW.busy, RW.result, /using Quick/.test(app.el("toast").textContent), /not ready after 120 s/.test(mark()), app.ev("loadRender")().mode];
      return out;
    });` }).result;
  assert.deepStrictEqual(o.alone, [true, false, 0, null, false], "ready, the bar gone");
  assert.deepStrictEqual(o.instant, [false, 1]); assert.deepStrictEqual(o.instantDone, [false, true]);
  assert.deepStrictEqual(o.again, [true, 2]);
  assert.deepStrictEqual(o.cancel, [false, 0, null, true, true], "nothing marked");
  assert.deepStrictEqual(o.reopen, [false, null], "not begun again by itself");
  assert.deepStrictEqual(o.final, [true, true, 2], "Final Render goes on from the compile the card is still doing");
  assert.deepStrictEqual(o.chosen, [true, true], "choosing Path Traced begins it again");
  assert.deepStrictEqual(o.other, [null, false, 0], "(Round r29d) another Engine: the bar goes");
  assert.deepStrictEqual(o.closed, [null, 0]);
  assert.strictEqual(o.quick, null);
  assert.deepStrictEqual(o.limit, [null, false, false, null, true, true, "quick"]);
});

test("r29c / 2: on software WebGL Final Render defaults to Quick and nothing prepares; choosing Path Traced asks first, naming the card, the wait and this picture's time; Stay on Quick stays; Use Path Traced takes it, for the session; a graphics card is not asked; the names", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: WARM + `
    return app.wait(() => v3.ready(), "the 3D window").then(async () => {
      warmUp();
      app.ev('PT_CARD = "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"'); app.ev("PT_PARALLEL = false");      // (software WebGL has no parallel compile)
      let asked = null; app.ev("globalThis").__ask = (t, x, b) => { asked = { t, x, b }; }; app.ev("askModal = (t, x, b, o) => globalThis.__ask(t, x, b)");
      out.mode = app.ev("loadRender")().mode;
      app.ev("renderWindow")(); app.ev("ptWarm")(); out.warm = [app.ev("WARM"), G.__compiles];
      out.hint = app.ev("rwinModeHTML")(app.ev("loadRender")());
      app.ev("rwinRender")(); out.final = [!!RW.busy, RW.result && RW.result.mode, app.ev("PTRUN")];
      const set = (w, h, samples) => app.ev("saveRender")(app.ev("normRender")({ mode: "quick", size: "custom", w, h, samples, maxMin: 20 }));
      set(640, 800, 16);
      app.ev("rwinSet")("mode", { value: "quality", dataset: {} });
      out.small = asked.x; out.title = asked.t; out.kept = app.ev("loadRender")().mode;
      asked.b.find(k => k.k === "no").f(); out.stayed = app.ev("loadRender")().mode;
      set(1920, 1080, 256); app.ev("rwinSet")("mode", { value: "quality", dataset: {} }); out.large = asked.x;
      asked.b.find(k => k.k === "go").f();
      out.used = [app.ev("loadRender")().mode, app.ev("WARM")];
      asked = null; app.ev("rwinSet")("mode", { value: "quality", dataset: {} }); out.notAgain = asked;
      app.ev("rwinSet")("mode", { value: "quick", dataset: {} }); app.ev("rwinSet")("mode", { value: "quality", dataset: {} }); out.askedAgain = !!asked;
      const soft = app.ev("PT_SOFT_NAMES");
      out.names = ["ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)", "ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)", "llvmpipe (LLVM 15.0.7, 256 bits)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER (0x000021C4) Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)", "Apple M2"].map(n => soft.test(n));
      out.secs = [[160, 200, 16], [640, 800, 16], [1280, 1600, 16]].map(a => Math.round(app.ev("ptSoftSecs")(...a)));
      out.words = [app.ev("ptSoftTime")(50), app.ev("ptSoftTime")(1340), app.ev("ptSoftTime")(8000)];
      return out;
    });` }).result;
  assert.strictEqual(o.mode, "quick"); assert.deepStrictEqual(o.warm, [null, 0], "nothing prepares");
  assert.ok(/without a graphics card/.test(o.hint) && /SwiftShader/.test(o.hint), o.hint);
  assert.deepStrictEqual(o.final, [false, "quick", null]);
  assert.strictEqual(o.title, "Path Traced without a graphics card");
  // (Round r32: the card links the shader before the page asks about it, ptLinkAsk(): the page answers meanwhile (1 s at most, measured), the 3D window waits)
  assert.ok(/SwiftShader/.test(o.small) && /the 3D window does not redraw meanwhile/.test(o.small) && !/stop answering/.test(o.small), o.small);
  assert.ok(/640 × 800 at 16 samples, would take about 70 seconds in all/.test(o.small), o.small);
  assert.strictEqual(o.kept, "quick", "only asked so far"); assert.strictEqual(o.stayed, "quick");
  assert.ok(/1920 × 1080 at 256 samples, would take about 23 minutes in all; Max. Render Time stops it at 20 minutes/.test(o.large), o.large);
  assert.deepStrictEqual(o.used, ["quality", null], "chosen, and still no background preparing there");
  assert.strictEqual(o.notAgain, null, "said yes: not asked again"); assert.strictEqual(o.askedAgain, true, "gone back to Quick, then chosen again: asked");
  assert.deepStrictEqual(o.names, [true, true, true, false, false, false]);
  assert.deepStrictEqual(o.secs, [49, 68, 130], "the measured 48, 64 and 129 s");
  assert.deepStrictEqual(o.words, ["about 50 seconds", "about 22 minutes", "about 2 hours"]);
});

test("r29c: the box that says the simulation is running closes on its OK (from r29: it threw)", () => {
  const o = boot({ blank: true, three: true, script: `
    return app.wait(() => app.view3d.ready(), "the 3D window").then(() => {
      app.ev("SIM").on = true; const r = app.ev("renderRefused")(); app.ev("SIM").on = false;
      const m = app.ev("modalNow"), ok = app.ev("modalPick")("ok");
      return [r, !!m, ok !== false, app.ev("modalNow")];
    });` }).result;
  assert.deepStrictEqual(o, [true, true, true, null]);
});

test("the release's check of the built app finds the 3D window's canvas: the page has a second one in there since Schematic Render, and the strict locator that found two failed the v1.0.0-beta.2 tag run on three systems", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8"), s = fs.readFileSync(path.join(__dirname, "..", "..", "scripts", "start-built.js"), "utf8");
  assert.ok(/<canvas id="sch3d"/.test(html), "the second canvas is in the page: this test's reason");
  assert.ok(/locator\("#stage3d canvas\[data-engine\]"\)/.test(s), "only the renderer's own");
  assert.ok(!/locator\("#stage3d canvas"\)/.test(s));
});

/* ---- batch 3 ---- */
test("r29b / 3: the examples' Print Layout has Overlap 0, as a new layout has; their other settings as they were", () => {
  const E = require("../examples/examples.js");
  const list = E.PATTERN_EXAMPLES || E;
  const docs = (Array.isArray(list) ? list : Object.values(list)).map(e => e.doc || e), texts = JSON.stringify(docs);
  assert.strictEqual((texts.match(/"overlap":0[,}]/g) || []).length, 3); assert.strictEqual((texts.match(/"overlap":[1-9]/g) || []).length, 0);
  assert.strictEqual((texts.match(/"margin":10,"overlap":0,"cols":3/g) || []).length, 3);
});

test("r29b / 3: Copy Current Image: the picture as a PNG on the clipboard, said; nothing to copy, or no clipboard here: said, nothing thrown", () => {
  const o = boot({ blank: true, three: true, script: PREP + `
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("saveRender")(app.ev("normRender")({ mode: "quick", size: "640x480" })); app.ev("renderWindow")();
      const said = () => app.el("toast").textContent;
      RW.result = null; RW.shown = false; app.ev("rwinCopy")(); out.none = said();
      const nav = G.navigator = {}, written = [];
      RW.result = { c: { toBlob: (f, t) => f({ type: t, size: 9 }) }, w: 10, h: 10 };
      nav.clipboard = undefined; app.ev("rwinCopy")(); out.noClip = said();
      G.ClipboardItem = class { constructor(o) { this.o = o; } };
      nav.clipboard = { write: (l) => { written.push(Object.keys(l[0].o)); return Promise.resolve(); } };
      app.ev("rwinCopy")();
      return Promise.resolve().then(() => null).then(() => {
        out.ok = [written, said()];
        nav.clipboard.write = () => Promise.reject(new Error("denied")); app.ev("rwinCopy")();
        return Promise.resolve().then(() => null).then(() => null);
      }).then(() => { out.refused = said(); return out; });
    });` }).result;
  assert.strictEqual(o.none, "Nothing to copy yet");
  assert.ok(/could not be copied here/.test(o.noClip), o.noClip);
  assert.deepStrictEqual(o.ok, [[["image/png"]], "Picture copied"]);
  assert.ok(/could not be copied here/.test(o.refused), o.refused);
});

test("r29b / 3: Show in Saved Folder: on the toolbar only where there is a desktop shell; it asks the shell, and the shell shows only the file it last wrote, no path from the page", () => {
  const script = `
    const v3 = app.view3d;
    app.setLayout("both");
    return app.wait(() => v3.ready(), "the 3D window").then(() => {
      app.ev("renderWindow")(); app.ev("rwinTools")();
      return { button: /data-act="folder"/.test(app.el("rw-tools").innerHTML) };
    });`;
  assert.strictEqual(boot({ blank: true, three: true, script }).result.button, false, "a browser has no folder to show");
  const main = fs.readFileSync(path.join(__dirname, "..", "..", "desktop", "main.js"), "utf8"), pre = fs.readFileSync(path.join(__dirname, "..", "..", "desktop", "preload.js"), "utf8");
  assert.ok(/ipcMain\.handle\("file:show-saved", \(\) => \{ if \(lastExport\) shell\.showItemInFolder\(lastExport\); return !!lastExport; \}\)/.test(main), "only lastExport");
  assert.ok(/showSaved: \(\) => ipcRenderer\.invoke\("file:show-saved"\)/.test(pre), "no argument passes from the page");
});

module.exports = T;
