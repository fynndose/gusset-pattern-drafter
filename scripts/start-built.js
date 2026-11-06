// node scripts/start-built.js <unpacked.json | the app's executable> <work folder>
// Starts the built desktop app itself (the executable electron-builder made, not Electron from node_modules) with no app
// data from earlier runs, and drives it with Playwright as a tester would: the window and its title, the welcome box,
// the developer tools kept shut, an example on Marty, simulating in the worker, Save and Open with the keys, a DXF
// through the menus, Send Feedback (the link recorded, not opened), and on a Mac the app's own menu. A log and
// screenshots go to the work folder. Exit code 1 if a step failed. On Linux with no display it needs xvfb-run around it.
// (Round desk-2: the release workflow runs it on every system; desk-1's fresh-start test was its Windows-only start.)
"use strict";
const fs = require("fs"), path = require("path");
const { _electron } = require("playwright");
const [given, workArg] = process.argv.slice(2);
if (!given || !workArg) { console.log("node scripts/start-built.js <unpacked.json | executable> <work folder>"); process.exit(1); }
const exe = /\.json$/i.test(given) ? JSON.parse(fs.readFileSync(given, "utf8")).exe : given;
const work = path.resolve(workArg), shots = path.join(work, "shots");
fs.mkdirSync(shots, { recursive: true });
const VERSION = require("../drafter/config.js").version, FEEDBACK = require("../drafter/config.js").feedbackUrl;
const MAC = process.platform === "darwin", LINUX = process.platform === "linux", NOGL = process.env.PDRAFT_NO_WEBGL === "1";
const log = [];
const step = (n, ok, more) => { const l = (ok ? "ok   " : "FAIL ") + n + (more ? " (" + more + ")" : ""); log.push(l); console.log(l); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(f, ms = 20000) { for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) { const v = await f().catch(() => null); if (v) return v; } return null; }

// a fresh data folder in the system's temp folder (PDRAFT_USER_DATA, desktop/test-data.js), deleted afterwards: the user's
// own is never read, moved or deleted, and an app the user has open is not in the way (its one-window lock is in its folder)
const TD = require("../desktop/test-data.js"), fresh = TD.fresh("start"), env = fresh.env;
// Linux in a build machine: no graphics card (WebGL from Chromium's software renderer), and no sandbox helper set up
// (PDRAFT_SOFT_GL=1: software WebGL on any system, for a build machine's Mac, which has no graphics card either)
const args = [...(LINUX ? ["--no-sandbox"] : []), ...(LINUX || process.env.PDRAFT_SOFT_GL === "1" ? ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] : [])];

(async () => {
  const t0 = Date.now();
  const app = await _electron.launch({ executablePath: exe, args, env, timeout: 90000 });
  // the page's window (Round r24: the splash's comes first, and goes)
  let page = null;
  for (const s = Date.now(); !page && Date.now() - s < 60000; await sleep(50)) page = app.windows().find(p => /pattern-drafter.html/.test(p.url())) || null;
  if (!page) throw new Error("no window with the page");
  await page.waitForLoadState("load");
  const info = await app.evaluate(({ app }) => ({ userData: app.getPath("userData"), packaged: app.isPackaged, version: app.getVersion(), name: app.name }));
  step("starts: a window in " + ((Date.now() - t0)/1000).toFixed(1) + " s, the built app, version " + info.version, info.packaged === true && info.version === VERSION, "data folder " + info.userData);
  step("its data folder is the fresh one this check made (PDRAFT_USER_DATA), nothing in it to recover", path.resolve(info.userData) === path.resolve(fresh.data) && !fs.existsSync(path.join(info.userData, "autosave.json")));
  const title = await until(async () => { const t = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => /pattern-drafter.html/.test(w.webContents.getURL())).getTitle()); return /[(]Beta[)]/.test(t) && t; });      // (Round r27: since r24 the title says "(Beta)")
  step("the title bar says BETA, not the version", title === "Gusset – Pattern Drafter (Beta)", title);
  if (MAC) {
    const menu = await app.evaluate(({ Menu }) => { const m = Menu.getApplicationMenu(); return m && m.items.map(i => i.label + ": " + (i.submenu ? i.submenu.items.filter(x => x.type !== "separator").map(x => x.label).join(", ") : "")); });
    step("a Mac: the app's own menu and Window, nothing doubling the page's menus", !!menu && menu.length === 2 && /About .*Settings.*Hide .*Quit /.test(menu[0]) && /^Window/.test(menu[1]), menu && menu.join(" | "));
  }
  const w = await until(() => page.evaluate(() => { const m = document.getElementById("modal"); return m && m.querySelector(".dt").textContent; }));
  await page.screenshot({ path: path.join(shots, "1-welcome.png") });
  step("the welcome box shows", w === "Welcome to Gusset – Pattern Drafter", w);
  await page.keyboard.press("F12"); await page.keyboard.press(MAC ? "Meta+Alt+I" : "Control+Shift+I"); await sleep(300);
  const dev = await app.evaluate(({ BrowserWindow }) => { const wc = BrowserWindow.getAllWindows().find(w => /pattern-drafter.html/.test(w.webContents.getURL())).webContents; wc.openDevTools(); return new Promise(r => setTimeout(() => r(wc.isDevToolsOpened()), 500)); });
  step("the developer tools stay closed (the keys, and even when asked for from the main process)", dev === false);
  // (PDRAFT_NO_WEBGL=1: a machine with no WebGL at all, the Intel Mac build machine: the example and the simulation are not
  // checked there; the starter pattern is saved and opened instead)
  if (!NOGL) {
    await page.getByRole("button", { name: "Open an Example" }).click();
    const ex = await until(() => page.evaluate(() => { const d = drafterDebug(); return d.S.av && d.S.av.name === "Marty" && d.G3.items.size === 4 && d.S.pieces.map(p => p.name).join(", "); }), 60000);
    await sleep(800); await page.screenshot({ path: path.join(shots, "2-example.png") });
    step("Open an Example: the skirt on Marty, Marty loaded", !!ex, ex);
    const c3 = await page.locator("#stage3d canvas[data-engine]").boundingBox();      // (the renderer's own canvas: Schematic Render's picture is a canvas in there too)
    await page.mouse.move(c3.x + c3.width*0.5, c3.y + c3.height*0.2);
    await page.keyboard.press("Space");
    const ticks = await until(() => page.evaluate(() => drafterDebug().SIM.tick > 150 && drafterDebug().SIM.tick), 180000);
    await page.keyboard.press("Space"); await sleep(500);
    const sim = await page.evaluate(() => ({ on: drafterDebug().SIM.on, worker: !!drafterDebug().SIM.wk, draped: [...drafterDebug().G3.items.values()].every(it => it.draped) }));
    await page.screenshot({ path: path.join(shots, "3-simulated.png") });
    step("simulates (Space on, Space off), in the worker", !!ticks && sim.draped && !sim.on && sim.worker, ticks + " steps");
  } else {
    step("--   not checked: an example on Marty and simulating (no WebGL on this machine)", true);
    await page.getByRole("button", { name: "Start Drafting" }).click();          // the welcome box closed, as the example's button closes it
    await page.evaluate(() => drafterDebug().run("starterDoc", true));
    step("New from Starter Pattern asks whether to keep a history (a fresh profile), and Enable answers it", await keepHistory());
  }
  const file = path.join(work, "skirt.pdraft");
  // (Round H1b / 3) a new project asks whether to keep a history while Settings > Preferences > History for New Projects is Ask Each
  // Time, as it is on this fresh profile: answered Enable, as a tester would (release beta.5: before, the box stood in front of the keys)
  async function keepHistory() {
    const hq = await until(() => page.evaluate(() => { const m = document.getElementById("modal"); return !!m && /Keep a History/.test(m.textContent); }), 5000);
    if (hq) { await page.getByRole("button", { name: "Enable", exact: true }).click(); await sleep(200); }
    return !!hq && await page.evaluate(() => !document.getElementById("modal") && drafterDebug().S.histOn !== false);
  }
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] }); }, file);
  await page.keyboard.press("ControlOrMeta+s");
  const saved = await until(() => Promise.resolve(fs.existsSync(file) && fs.statSync(file).size > 1000));
  step((MAC ? "Cmd" : "Ctrl") + "+S saves (Save As the first time)", !!saved, saved ? (fs.statSync(file).size/1024).toFixed(0) + " KB" : "");
  await page.evaluate(() => drafterDebug().run("newDoc", true));
  step("File > New asks whether to keep a history (a fresh profile), and Enable answers it", await keepHistory());
  await page.keyboard.press("ControlOrMeta+o");
  const re = await until(() => page.evaluate((nogl) => { const d = drafterDebug(); return (nogl ? d.S.pieces.length === 1 : d.S.pieces.length === 4 && [...d.G3.items.values()].filter(it => it.draped).length === 4) && document.title; }, NOGL));
  step((MAC ? "Cmd" : "Ctrl") + "+O opens it again" + (NOGL ? "" : ", with its drape"), re === "skirt.pdraft — Gusset – Pattern Drafter (Beta)" || re === "skirt.pdraft — Gusset – Pattern Drafter", re);
  const dxf = path.join(work, "skirt.dxf");
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, dxf);
  await page.click("#menubar .mb[data-m=file]");
  await page.locator("#menu .mi", { hasText: /^Export/ }).first().hover(); await sleep(300);
  await page.locator(".mi", { hasText: /^DXF$/ }).last().click();
  await page.click("#dlg-ok");
  const dx = await until(() => Promise.resolve(fs.existsSync(dxf) && fs.readFileSync(dxf, "utf8")));
  step("File > Export > DXF writes the file where it is told", !!dx && /ENTITIES/.test(dx), dx ? (dx.length/1024).toFixed(0) + " KB" : "");
  await app.evaluate(({ shell }) => { global.__opened = []; shell.openExternal = async (u) => { global.__opened.push(u); }; });
  await page.click("#menubar .mb[data-m=help]");
  await page.locator("#menu .mi", { hasText: /^Send Feedback/ }).click();
  const url = await until(() => app.evaluate(() => global.__opened[0]));
  const clip = await app.evaluate(async ({ clipboard }) => await clipboard.readText());
  await page.screenshot({ path: path.join(shots, "4-feedback.png") });
  const head = "Gusset: bug information\nVersion: " + VERSION + " (desktop app, built ";
  step("Help > Send Feedback copies the bug information and opens the link", url === FEEDBACK && clip.startsWith(head), (clip.split("\n")[2] || "").replace(/^System: /, ""));
  fs.writeFileSync(path.join(work, "bug-info.txt"), clip);
  await page.keyboard.press("Enter");
  await app.close();
  fs.writeFileSync(path.join(work, "start-built.log"), log.join("\n") + "\n");
  const bad = log.filter(l => l.startsWith("FAIL")).length;
  console.log(bad ? bad + " STEP(S) FAILED" : "ALL " + log.length + " STEPS PASSED");
  done(bad ? 1 : 0);
})().catch((e) => { console.log("FAIL " + e.stack); fs.writeFileSync(path.join(work, "start-built.log"), log.join("\n") + "\nFAIL " + e.stack + "\n"); done(1); });
// the fresh data folder goes, and only it (TD.remove() deletes nothing outside the system's temp folder)
function done(code) { try { TD.remove(fresh.dir); } catch (e) { console.log(e.message); } process.exit(code); }
