// Runs the desktop smoke check (desktop/smoke.js, unchanged) where it can run, and says plainly why when it cannot.
//   npm run smoke:desktop
// On Linux with no display it runs under a virtual one (xvfb-run); with no graphics card WebGL comes from
// Chromium's software renderer (SwiftShader), and as root Chromium's sandbox is switched off. It never builds anything.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = path.join(__dirname, "..", "desktop");
const skip = (why, fix) => { console.log("Desktop smoke check SKIPPED: " + why + (fix ? "\n  To run it: " + fix : "")); process.exit(0); };

let bin = null;
try { bin = require(path.join(dir, "node_modules", "electron")); } catch (e) {}
if (!bin) skip("Electron is not installed in desktop/.", "npm install in desktop/ (it downloads the Electron binary from GitHub).");
if (typeof bin !== "string" || !fs.existsSync(bin)) skip("the Electron package is there but its binary is not (" + bin + "): its download failed.", "node desktop/node_modules/electron/install.js, or npm install in desktop/ again.");

const linux = process.platform === "linux", args = [];
if (linux && typeof process.getuid === "function" && process.getuid() === 0) args.push("--no-sandbox");
// (Round desk-2) PDRAFT_SOFT_GL=1 does the same on any system: a build machine's Mac has no graphics card for WebGL either
if (linux || process.env.PDRAFT_SOFT_GL === "1") args.push("--enable-unsafe-swiftshader", "--use-angle=swiftshader");
// (Round desk-2) Chromium stops drawing a window it takes for unseen (on Windows: covered, or the screens asleep), and with it
// the check's mouse, the worker's frames and the 3D window: the check's window is always drawn
args.push("--disable-features=CalculateNativeWinOcclusion", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows");
args.push("smoke.js");
let cmd = bin, cmdArgs = args;
if (linux && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
  const x = spawnSync("sh", ["-c", "command -v xvfb-run"], { encoding: "utf8" });
  if (x.status !== 0) skip("there is no display and no xvfb-run to make one.", "install xvfb (apt-get install xvfb), or run it on a desktop.");
  cmd = "xvfb-run"; cmdArgs = ["-a", bin, ...args];
}
// a fresh data folder in the temp folder (never the user's own), deleted here once the app has exited
const TD = require(path.join(dir, "test-data.js")), fresh = TD.fresh("smoke");
const env = { ...process.env, PDRAFT_SMOKE_DIR: fresh.dir }; delete env.ELECTRON_RUN_AS_NODE;
const r = spawnSync(cmd, cmdArgs, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 480000*Math.max(1, +process.env.PDRAFT_SMOKE_SLOW || 1), maxBuffer: 1 << 26 });
// Chromium's own complaints about the missing system bus and GPU in a container are not the check's
const quiet = (s) => String(s || "").split("\n").filter(l => l && !/^\[\d+:\d+\/[\d.]+:(ERROR|WARNING|INFO):|dbus|Fontconfig/.test(l)).join("\n");
const out = quiet(r.stdout), err = quiet(r.stderr);
if (out) console.log(out);
if (err) console.error(err);
if (r.error) { console.error("Desktop smoke check could not run: " + r.error.message); process.exit(1); }
try { TD.remove(fresh.dir); } catch (e) { console.error(e.message); }
process.exit(r.status === null ? 1 : r.status);
