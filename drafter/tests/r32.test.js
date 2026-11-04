// Round r32: the Render workspace does not hold the page (batch 2); the browser's heavy settings locked (batch 3). What needs a real graphics card
// is in scripts/render-block.js (local: the longest main-thread block on opening, switching the Engine and Final Render).
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });

function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-r32-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}
const APP = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8");

/* ---- batch 1: the start: the splash until the page is fully ready ---- */
const ROOT = path.join(__dirname, "..", "..");
const MAIN = fs.readFileSync(path.join(ROOT, "desktop", "main.js"), "utf8"), PRE = fs.readFileSync(path.join(ROOT, "desktop", "preload.js"), "utf8");
test("r32 / 1: fully ready is the 2D window drawn, the 3D window drawn once and the unsaved work's check answered (its box may be up); asked on a timer, a hidden window having no frames; done once, then the mark, the browser's splash and the desktop app told", () => {
  const o = boot({ three: true, desktop: true, script: `
    const out = {}, G = app.ev("globalThis"), timeouts = [];
    return app.wait(() => app.view3d.ready(), "the 3D window").then(() => {
      G.setTimeout = (f) => { timeouts.push(f); return timeouts.length; }; G.requestAnimationFrame = undefined;
      const run = (n) => { for (let k = 0; k < n; k++) for (const f of timeouts.splice(0)) f(); };
      const R = app.view3d.renderer(); R.info = R.info || { render: { frame: 0 } }; const frame = R.info.render.frame;
      let done = 0; app.ev('recoverPending = "reading"'); R.info.render.frame = 0;
      app.ev("startReady")(() => { done++; });
      run(5); out.reading = done;
      app.ev("recoverPending = { rec: 1 }"); run(5); out.no3d = done;          // the recovery box up counts as answered; the 3D window not drawn yet
      R.info.render.frame = frame || 1; run(5); out.ready = done; run(20); out.once = done;
      app.ev("recoverPending = null");
      // the 2D-only layout does not wait for the 3D window
      R.info.render.frame = 0; app.ev('S.ui.layout = "2d"'); done = 0; app.ev("startReady")(() => { done++; }); run(5); out.twoD = done;
      return out;
    });` }).result;
  assert.deepStrictEqual(o, { reading: 0, no3d: 0, ready: 1, once: 1, twoD: 1 });
  const src = APP.slice(APP.indexOf("const started = () => {"), APP.indexOf("const started = () => {") + 900);
  assert.ok(/startReady\(\(\) => \{\s*try \{ performance\.mark\("gusset-usable"\); \} catch \(e\) \{\}\s*if \(typeof window\.gussetSplashEnd === "function"\) window\.gussetSplashEnd\(\);\s*if \(DESK && DESK\.ready\) DESK\.ready\(\);/.test(src), src);
  assert.ok(/const START_WAIT = 30000;/.test(APP), "the page gives up waiting when the shell does");
  assert.ok(/DESK\.onStartLate\(\(s\) => toast\("Gusset took more than " \+ s \+ " s to get ready, so its window is shown now/.test(APP), "one line when it came late");
});

test("r32 / 1: the shell: the splash made as soon as the old folder is brought over (a window made before that would fill the new data folder, and nothing would be copied); the page's window hidden until its own page says it is ready, then shown and the splash closed in the same moment, at least SPLASH_MIN after the splash came; after SPLASH_LATE shown anyway and the page told; the bridge", () => {
  const ready = MAIN.slice(MAIN.indexOf("app.whenReady().then("));
  assert.ok(ready.indexOf("bringOver();") < ready.indexOf("showSplash();") && ready.indexOf("showSplash();") < ready.indexOf("loadLists();"), "the splash right after the copy");
  const up = MAIN.slice(MAIN.indexOf("function pageUp(w, late) {"), MAIN.indexOf("\n}", MAIN.indexOf("function pageUp(w, late) {")));
  assert.ok(/if \(!w\.isVisible\(\)\) w\.show\(\);\s*if \(splash\) splash\.destroy\(\);/.test(up), "shown and closed together: " + up);
  assert.ok(/Math\.max\(0, SPLASH_MIN - \(Date\.now\(\) - splashAt\)\)/.test(up) && /if \(late\) w\.webContents\.send\("start-late", SPLASH_LATE\/1000\)/.test(up));
  assert.ok(/const ready = \(e\) => \{ if \(e\.sender !== w\.webContents\) return; ipcMain\.removeListener\("app:ready", ready\); clearTimeout\(late\);/.test(MAIN), "only its own page, once");
  assert.ok(/const w = win, late = setTimeout\(\(\) => pageUp\(w, true\), SPLASH_LATE\);/.test(MAIN));
  assert.ok(!/ready-to-show", up/.test(MAIN), "not at its first paint");
  assert.ok(PRE.includes('ready: () => ipcRenderer.send("app:ready"),') && PRE.includes('onStartLate: (f) => ipcRenderer.on("start-late", (e, s) => f(s)),'));
});

test("r32 / 1: the portable .exe shows a picture while it unpacks itself: desktop/icons/splash.bmp, a 24-bit BMP of the splash window's size on its dark grey, named in the build and made by make-icons.js", () => {
  const b = fs.readFileSync(path.join(ROOT, "desktop", "icons", "splash.bmp"));
  assert.strictEqual(b.toString("latin1", 0, 2), "BM"); assert.strictEqual(b.readUInt16LE(28), 24);
  const w = b.readInt32LE(18), h = b.readInt32LE(22), row = Math.ceil(w*3/4)*4;
  assert.deepStrictEqual([w, h, b.length], [260, 240, 54 + row*h]);
  const px = (x, y) => { const o = 54 + (h - 1 - y)*row + 3*x; return [b[o + 2], b[o + 1], b[o]]; };
  assert.deepStrictEqual([px(0, 0), px(w - 1, h - 1)], [[31, 31, 31], [31, 31, 31]], "the splash's #1F1F1F");
  let red = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g] = px(x, y); if (r > 180 && g < 110) red++; }
  assert.ok(red > 3000, "the red mark in it: " + red + " px");
  const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "desktop", "package.json"), "utf8"));
  assert.strictEqual(PKG.build.portable.splashImage, "icons/splash.bmp");
  // (release beta.3: make-icons.js is a local script, not in the public tree, where the export runs these tests: checked only where it is)
  const MAKER = path.join(ROOT, "scripts", "make-icons.js");
  if (fs.existsSync(MAKER)) assert.ok(/fs\.writeFileSync\(path\.join\(DIR, "splash\.bmp"\), sp\)/.test(fs.readFileSync(MAKER, "utf8")));
});

/* ---- batch 2: the Render workspace ---- */
// a pattern in 3D, the workspace, a stand-in for the path tracing library, a clock and frames the test moves; the card's own compile, linking and fence
// recorded in order (gl), its answers set by the test (G.__linked, G.__signal)
// (desktop: true: Path Traced is the desktop app's only, batch 3)
const PREP = `
  const out = {}, v3 = app.view3d, RW = app.ev("RWIN"), G = app.ev("globalThis");
  app.setLayout("both");
  S.pieces.push(app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:400}], true))); S.pieces[0].p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 };
  app.commit(); app.ev("garmentSync")();
  app.ev("(() => { const ce = document.createElement; document.createElement = (t) => { const e = ce(t); e.toDataURL = (m) => 'data:' + (m || 'image/png') + ';base64,QUJD'; return e; }; })()");
  const log = []; G.__linked = true; G.__signal = true; G.__envs = [];
  const upd = { updateFrom() {}, setTextures() {} };
  G.THREE_PATHTRACER = {
    PhysicalPathTracingMaterial: class { constructor() { Object.assign(this, { bvh: upd, attributesArray: upd, materialIndexAttribute: upd, textures: upd, materials: upd, lights: upd, envMapInfo: upd }); } dispose() {} },
    PathTracingRenderer: class { constructor() { this.samples = 0; this.tiles = { set() {} }; this.target = { texture: {} }; } setSize() {} reset() { this.samples = 0; } update() { this.samples++; } },
    PathTracingSceneGenerator: class { generate() { return { bvh: { geometry: { attributes: {}, dispose() {} } }, textures: [], materials: [], lights: [] }; } },
    GradientEquirectTexture: class { constructor(res) { this.res = res; this.top = this.bottom = null; this.topColor = { set: (c) => { this.top = c; } }; this.bottomColor = { set: (c) => { this.bottom = c; } }; this.gone = false; G.__envs.push(this); } update() {} dispose() { this.gone = true; } },
    FullScreenQuad: class { constructor(m) { this.material = m; } render() {} dispose() {} },
  };
  app.ev("ptSupport = () => null");
  app.el("rw-prog").classList = { set: new Set(), add(k) { this.set.add(k); }, remove(k) { this.set.delete(k); }, contains(k) { return this.set.has(k); } };
  let clock = 1000; G.performance = { now: () => clock };
  const later = []; G.requestAnimationFrame = (f) => { later.push(f); return 1; };
  const frames = (n) => { for (let k = 0; k < n && later.length; k++) later.shift()(); };
  const ticks = new Map(); let nextIv = 1;
  G.setInterval = (f) => { ticks.set(nextIv, f); return nextIv++; }; G.clearInterval = (i) => { ticks.delete(i); };
  // the page's timers, run by the test (each frame's fence passes on one); settle() also lets promises (compileAsync's) come through
  const timeouts = []; G.setTimeout = (f) => { timeouts.push(f); return timeouts.length; }; G.clearTimeout = () => {};
  const settle = async () => { for (let k = 0; k < 4; k++) { await new Promise((res) => setImmediate(res)); for (const f of timeouts.splice(0)) f(); } };
  const go = async (n) => { for (let k = 0; k < n; k++) { frames(4); await settle(); } };
  const prepping = () => app.el("rw-prog").classList.contains("prep");
  const quality = (more) => app.ev("saveRender")(app.ev("normRender")({ mode: "quality", samples: 8, size: "custom", w: 300, h: 200, ...more }));
  // the card: parallel or not (G.__par), its program, its fence
  const card = (par) => {
    app.ev("ptCard()"); app.ev("PT_PARALLEL = " + par);
    const ctx = app.ev("ptContext")(), R2 = ctx.R2, prog = { name: "the path tracer's program" };
    const gl = { LINK_STATUS: 1, SYNC_GPU_COMMANDS_COMPLETE: 2, SYNC_STATUS: 3, SIGNALED: 4,
      useProgram: (p) => log.push(p ? "use" : "use none"), getProgramParameter: (p, k) => { log.push("ask"); return G.__linked; },
      fenceSync: () => { log.push("fence"); return {}; }, flush: () => {}, getSyncParameter: () => (G.__signal ? 4 : 0), isContextLost: () => false, deleteSync: () => log.push("passed") };
    R2.getContext = () => gl; R2.properties = { get: () => ({ currentProgram: { program: prog } }) };
    const reset = R2.resetState; R2.resetState = () => { log.push("reset"); };
    R2.extensions = { has: (n) => par && n === "KHR_parallel_shader_compile" };
    R2.compileAsync = () => { log.push("compileAsync"); return new Promise((res) => { G.__done = res; }); };
    R2.compile = () => log.push("compile"); R2.setRenderTarget = () => {};
    return ctx;
  };
`;
test("r32 / 2: a card without the parallel compile: nothing prepares when the workspace opens or Path Traced is chosen; Final Render prepares then, with its words and Cancel; Interactive shows Quick's picture until it is ready, then path traces; the pane says so; a card with it still prepares on opening", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: PREP + `
    return app.wait(() => v3.ready(), "the 3D window").then(async () => {
      card(false); quality();
      app.ev("renderWindow")(); app.ev("ptWarm")();
      out.opened = [app.ev("WARM"), prepping(), log.length];
      app.ev("rwinSet")("mode", { value: "quick", dataset: {} }); app.ev("rwinSet")("mode", { value: "quality", dataset: {} });
      out.chosen = [app.ev("WARM"), prepping(), log.length];
      out.hint = app.ev("rwinModeHTML")(app.ev("loadRender")());
      // Interactive, while nothing is prepared: Quick's picture, no run
      const t = G.setTimeout; G.setTimeout = (f) => { f(); return 1; };
      app.ev("rwinInteractive")(); out.live = [RW.live, !!app.ev("PTRUN"), prepping()];
      app.ev("rwinStop")(); G.setTimeout = t;
      // Final Render: it prepares, with its words, and Cancel shows
      app.ev("rwinRender")(); out.final = [RW.busy, prepping(), /^Preparing the quality renderer/.test(app.el("rw-pt").textContent), log.slice()];
      await go(2); out.ready = [app.ev("PTCTX").ready, prepping()];
      await go(20); out.done = [RW.busy, !!RW.result];
      out.hintAfter = app.ev("rwinModeHTML")(app.ev("loadRender")());
      // Interactive now path traces
      G.setTimeout = (f) => { f(); return 1; }; app.ev("rwinInteractive")(); out.live2 = [RW.live, !!app.ev("PTRUN")]; app.ev("rwinStop")(); G.setTimeout = t;
      // a card with it: opening prepares
      app.ev("rwinClose")(); app.ev("PTCTX").ready = false; app.ev("PT_PREP_T0 = null"); app.ev("PT_PARALLEL = true"); app.ev("PTCTX").R2.extensions = { has: () => true };
      app.ev("renderWindow")(); app.ev("ptWarm")(); out.par = [!!app.ev("WARM"), prepping()];
      app.ev("rwinClose")();
      return out;
    });` }).result;
  assert.deepStrictEqual(o.opened, [null, false, 0], "opening asks nothing of the card");
  assert.deepStrictEqual(o.chosen, [null, false, 0], "nor does choosing Path Traced");
  assert.ok(/prepares the path tracer only when Final Render is clicked/.test(o.hint) && /Interactive shows Quick/.test(o.hint), o.hint);
  assert.deepStrictEqual(o.live, [true, false, false], "Interactive: Quick's picture, nothing prepared");
  assert.deepStrictEqual(o.final.slice(0, 3), [true, true, true]);
  assert.deepStrictEqual(o.final[3], ["compile", "use", "use none", "reset", "fence"], "the card links it first, then the fence; the page asks nothing yet");
  assert.deepStrictEqual(o.ready, [true, false]); assert.deepStrictEqual(o.done, [false, true]);
  assert.ok(!/only when Final Render is clicked/.test(o.hintAfter), "ready: the line goes");
  assert.deepStrictEqual(o.live2, [true, true], "ready: Interactive path traces");
  assert.deepStrictEqual(o.par, [true, true], "with the parallel compile: preparing on opening, as since r29c");
});

test("r32 / 2: the page asks whether the shader linked only once the card has passed the fence (or the parallel compile is done); a program the card refused falls back as a refused shader does, to Quick with the machine's mark; the path tracer's renderer skips three.js's own check of each program", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: PREP + `
    return app.wait(() => v3.ready(), "the 3D window").then(async () => {
      card(false); quality(); app.ev("renderWindow")();
      G.__signal = false; app.ev("rwinRender")();
      await settle(); out.waiting = [log.slice(), prepping()];
      G.__signal = true; await settle();
      out.passed = log.slice(log.indexOf("passed"));
      await go(20); out.done = [RW.busy, RW.result && RW.result.mode];
      // refused: Quick, marked
      log.length = 0; RW.result = null; app.ev("PTCTX").ready = false; app.ev("PT_PREP_T0 = null"); G.__linked = false;
      app.ev("rwinRender")(); await go(3);
      out.refused = [RW.busy, RW.result && RW.result.mode, JSON.parse(app.storage.get("pdraft:ptfail")).why];
      // with the parallel compile: asked once compileAsync is done
      app.storage.delete("pdraft:ptfail"); app.ev("PT_FAIL = undefined"); app.ev("PTCTX = null"); app.ev("PT_PREP_T0 = null"); G.__linked = true; log.length = 0; RW.result = null;
      card(true); app.ev("rwinRender")(); await settle();
      out.parWait = log.slice(); G.__done(); await settle(); out.parDone = log.slice();
      await go(20);
      return out;
    });` }).result;
  assert.deepStrictEqual(o.waiting, [["compile", "use", "use none", "reset", "fence"], true], "the card still compiling: nothing asked, the page free");
  assert.deepStrictEqual(o.passed, ["passed", "ask"], "asked once, after the fence");
  assert.deepStrictEqual(o.done, [false, "quality"]);
  assert.ok(/if [(]ctx[.]R2[.]debug[)] ctx[.]R2[.]debug[.]checkShaderErrors = false;/.test(APP), "three.js's per-program check (its log and status at the first draw) is off");
  assert.deepStrictEqual(o.refused, [false, "quick", "its shader was refused"]);
  assert.deepStrictEqual(o.parWait, ["compileAsync"]); assert.deepStrictEqual(o.parDone, ["compileAsync", "ask"]);
});

test("r32 / 2: the sky and the background are pictures of 64 pixels, made once per pair of colours and kept between renders; a new colour makes a new one and lets the old go; no run lets them go", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: PREP + `
    return app.wait(() => v3.ready(), "the 3D window").then(async () => {
      card(true); quality({ bg: "white" }); app.ev("renderWindow")();
      const envs = () => G.__envs.map(e => [e.res, e.top, e.bottom, e.gone]);
      const run = async () => { app.ev("rwinRender")(); await settle(); if (G.__done) G.__done(); await go(20); };
      await run(); out.one = envs();
      await run(); out.two = envs().length;
      quality({ bg: "color", bgColor: "#336699" }); await run(); out.three = envs();
      return out;
    });` }).result;
  assert.strictEqual(o.one.length, 2, "the sky and the background"); assert.ok(o.one.every(e => e[0] === 64 && !e[3]), JSON.stringify(o.one));
  assert.strictEqual(o.one[1][1], "#ffffff"); assert.strictEqual(o.one[1][2], "#ffffff");
  assert.strictEqual(o.two, 2, "the same colours: kept, none made");
  assert.strictEqual(o.three.length, 4); assert.deepStrictEqual(o.three.map(e => e[3]), [true, true, false, false], "new colours: new pictures, the old let go");
  assert.ok(/new THREE_PATHTRACER[.]GradientEquirectTexture[(]PT_ENV_RES[)]/.test(APP) && !/new P[.]GradientEquirectTexture[(][)]/.test(APP), "every gradient at PT_ENV_RES");
});

/* ---- batch 3: the browser's limits ---- */
// what a box said: its title, its text, its buttons
const BOX = `const box = () => { const m = app.ev("modalNow"); if (!m) return null; const t = { title: m.title, text: m.host.children[0].innerHTML, keys: m.buttons.map(b => b.n) }; return t; };
  const opened = []; app.ev("globalThis").window.open = (u) => { opened.push(u); };`;
test("r32 / 3: the browser: a particle distance under 10 mm is the desktop app's only: the box with the lock, why and the way to the download page, nothing changed; 10 mm and over as before; the three dialogs and the Property Editor say so with the lock; the desktop app: no limit and no lock", () => {
  const run = (desktop) => boot({ desktop, script: BOX + `
    const out = {};
    app.ev("setDensity")(8); out.small = [app.ev("S.cloth.res"), box()];
    if (box()) { app.ev("modalPick")("get"); out.opened = opened.slice(); }
    app.ev("closeModal")();
    app.ev("setDensity")(12); out.ok = [app.ev("S.cloth.res"), box() && box().title];
    let hint = null; app.answer = (t, f, o) => { hint = o.hint; return null; };
    app.ev("densityDialog")(); out.hints = [hint]; app.ev("hiResDialog")(); out.hints.push(hint); app.ev("simSettingsDialog")(); out.hints.push(hint);
    return out;` }).result;
  const b = run(false);
  assert.deepStrictEqual(b.small[0], 20, "nothing changed");
  assert.strictEqual(b.small[1].title, "Only in the desktop app");
  assert.ok(/<svg class="lock"/.test(b.small[1].text) && /A particle distance under 10 mm/.test(b.small[1].text) && /Only in the desktop app: this is too heavy for a browser and could crash the tab[.] The desktop app is free:/.test(b.small[1].text), b.small[1].text);
  assert.deepStrictEqual(b.small[1].keys, ["Get the Desktop App", "OK"]);
  assert.deepStrictEqual(b.opened, ["https://gussetdrafter.com/download"]);
  assert.deepStrictEqual(b.ok, [12, null]);
  for (const h of b.hints) assert.ok(/class="hint locked"><svg class="lock"/.test(h) && /Under 10 mm: only in the desktop app/.test(h), h);
  const d = run(true);
  assert.deepStrictEqual([d.small[0], d.small[1]], [8, null], "the desktop app: 8 mm taken, no box");
  for (const h of d.hints) assert.ok(!/lock/.test(h), h);
  assert.ok(/resLockHint\(\) [+]/.test(APP.slice(APP.indexOf('id="pp-res3"'), APP.indexOf('id="pp-res3"') + 400)), "the Property Editor's row has the line");
});

test("r32 / 3: a file asking for 5 mm and Path Traced at 6000 x 6000, opened in a browser: it opens, the session meshes at 10 mm, renders with Quick at 4096 a side, one line says so; the file keeps 5 mm, Path Traced and its size, also after another render setting is changed; another Engine chosen is kept; the desktop app runs them as they are", () => {
  const run = (desktop) => boot({ desktop, three: true, script: BOX + `
    const out = {};
    return app.wait(() => app.view3d.ready(), "the 3D window").then(() => {
      const doc = JSON.parse(app.docJSON()); doc.cloth = { ...doc.cloth, res: 5 };
      doc.render = { mode: "quality", size: "custom", w: 6000, h: 6000 };
      app.ev("loadDoc")(doc); app.ev("showDoc")();
      for (const f of app.ev("globalThis").__timers || []) f();
      out.res = [app.ev("S.cloth.res"), app.ev("clothRes()"), app.ev("particleOf")(null)];
      const o = app.ev("loadRender")(); out.render = [o.mode, o.w, o.h];
      out.held = app.ev("browserHeld")();
      app.ev("renderWindow")(); app.ev("rwinSet")("samples", { value: "64", dataset: { num: "1" } });
      out.saved = [app.ev("S.render").mode, app.ev("S.render").w, app.ev("S.render").h, app.ev("S.render").samples];
      app.ev("rwinSet")("mode", { value: "quality", dataset: {} }); out.box = box() && box().title; app.ev("closeModal")();
      app.ev("rwinSet")("w", { value: "5000", dataset: { num: "1" } }); out.wBox = box() && box().text; app.ev("closeModal")();
      out.w = [app.ev("loadRender")().w, app.ev("S.render").w];
      app.ev("rwinSet")("mode", { value: "schematic", dataset: {} }); out.other = app.ev("S.render").mode;
      out.options = app.ev("rwinRenderHTML")(app.ev("loadRender")());
      out.saveDoc = JSON.parse(app.docJSON()).cloth.res;
      out.snap = app.ev("snap3Size")({ preset: "custom", unit: "px", w: 6000, h: 3000, ppi: 300 });
      app.ev("rwinClose")();
      return out;
    });` }).result;
  const b = run(false);
  assert.deepStrictEqual(b.res, [5, 10, 10], "the file keeps 5 mm; the session meshes at 10");
  assert.deepStrictEqual(b.render, ["quick", 4096, 4096]);
  assert.deepStrictEqual(b.held, ["a particle distance of 5 mm (here 10 mm)", "Path Traced (here Quick)", "a 6000 × 6000 picture (here at most 4096 a side)"]);
  assert.deepStrictEqual(b.saved, ["quality", 6000, 6000, 64], "Samples changed: the Engine and size the file asked for stay");
  assert.strictEqual(b.box, "Only in the desktop app");
  assert.ok(/A picture over 4096 pixels a side/.test(b.wBox), b.wBox);
  assert.deepStrictEqual(b.w, [4096, 4096], "a size typed past the limit: set at the limit");
  assert.strictEqual(b.other, "schematic", "another Engine chosen here is the document's");
  assert.ok(/🔒 Path Traced [(]desktop app only[)]/.test(b.options) && /Path Traced: only in the desktop app[.]/.test(b.options) && /Quick [(]as the 3D window[)]/.test(b.options) && /Schematic/.test(b.options), "Quick and Schematic stay");
  assert.strictEqual(b.saveDoc, 5);
  assert.deepStrictEqual(b.snap, { w: 4096, h: 3000 });
  const d = run(true);
  assert.deepStrictEqual([d.res, d.render, d.held, d.box, d.snap], [[5, 5, 5], ["quality", 6000, 6000], [], null, { w: 6000, h: 3000 }]);
  assert.ok(!/🔒/.test(d.options));
  assert.ok(/function browserHeldNote[(][)] [{]\s*const held = browserHeld[(][)];\s*if [(]held[.]length[)] setTimeout[(][(][)] => toast[(]"Only in the desktop app: " [+] held[.]join[(]", "[)] [+] "[.] The file keeps its own settings[.]"/.test(APP), "the one line");
  assert.ok(/function showDoc[(][)] [{]\s*browserHeldNote[(][)];/.test(APP), "on every document shown");
  // a file opened says it in its own "Opened …" line (openLoaded() does not go through showDoc())
  assert.ok(/const held = browserHeld[(][)], heldText = held[.]length [?] "[.] Only in the desktop app: " [+] held[.]join[(]", "[)] [+] "[.] The file keeps its own settings[.]" : "";\s*toast[(]"Opened " [+] name/.test(APP), "the opened line");
});

module.exports = T;
