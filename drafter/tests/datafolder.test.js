// Round r24 follow-up: the app id is the project's own (com.gussetdrafter.gusset-pattern-drafter) and the data folder is
// pinned by a name of its own, package.json's "dataFolder" ("Gusset"), so neither the product name (in full since this round)
// nor the app id moves it. The start of desktop/main.js, up to where it has its folders, is run here against a stand-in for
// Electron's app (vm): which data folder and which old folder it takes for a user's start, for the update test's builds, with
// a stand-in for the system's app-data folder (PDRAFT_APP_DATA, only inside the temp folder) and with PDRAFT_USER_DATA.
// scripts/data-folder-test.js starts the real apps: the data an earlier build wrote is found by this one.
"use strict";
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", ".."), DESK = path.join(ROOT, "desktop");
const MAIN = fs.readFileSync(path.join(DESK, "main.js"), "utf8"), PKG = require(path.join(DESK, "package.json"));
// the old name's folder, by the one file that may name it (release check rule 13)
const OLD = require(path.join(DESK, "migrate.js")).OLD_NAME;
const BUILD = fs.readFileSync(path.join(DESK, "build.js"), "utf8"), TD = require(path.join(DESK, "test-data.js"));
const T = [], test = (name, fn) => T.push({ name, fn });

// the start of main.js (to the line that names the recent-files list), run with a stand-in app; returns its folders
function start({ env = {}, pkg = PKG, appData, name = pkg.productName }) {
  const head = MAIN.slice(0, MAIN.indexOf("const RECENT"));
  const paths = { appData, userData: path.join(appData, name) }, set = [];
  const app = { getName: () => name, getPath: (k) => paths[k], setPath: (k, v) => { set.push(k); paths[k] = v; }, isPackaged: false };
  const proc = { env, platform: process.platform, exit: (c) => { throw new Error("exit " + c); } };
  const req = (m) => m === "electron" ? { app } : m === "./package.json" ? pkg : m === "./migrate.js" ? { OLD_NAME: OLD } : require(m);
  const run = vm.runInNewContext("(function (require, process, performance, __dirname) {" + head + "\nreturn { DATA, OLD_DATA, DATA_FOLDER };})", {});
  const r = run(req, proc, { now: () => 0 }, DESK);
  return { data: r.DATA, old: r.OLD_DATA, folder: r.DATA_FOLDER, appData: paths.appData, set };
}

test("r24 follow-up: the app id is the project's own, the product name the name in full, the data folder pinned to Gusset", () => {
  assert.strictEqual(PKG.build.appId, "com.gussetdrafter.gusset-pattern-drafter");
  assert.strictEqual(PKG.productName, "Gusset – Pattern Drafter");
  assert.strictEqual(PKG.dataFolder, "Gusset", "the folder every build so far has used: %APPDATA%\\Gusset, ~/Library/Application Support/Gusset, ~/.config/Gusset");
  assert.strictEqual(PKG.name, "gusset", "the package name stays: electron-updater's download cache is named after it");
  // the update test's builds: an id, a product name and a data folder of their own
  assert.ok(BUILD.includes('"--config.appId=com.gussetdrafter.gusset-pattern-drafter.test." + slug.replace(/-/g, ""), "--config.extraMetadata.dataFolder=" + q(n),'));
});

test("r24 follow-up: a user's start takes <app data>/Gusset whatever the product name is, and the old folder beside it", () => {
  const A = path.join(os.tmpdir(), "no-such-appdata");
  for (const name of ["Gusset – Pattern Drafter", "Gusset", "Something Else"]) {
    const r = start({ appData: A, name });
    assert.strictEqual(r.data, path.join(A, "Gusset"), name);
    assert.strictEqual(r.old, path.join(A, OLD), name + ": the old name's folder is brought over as before");
  }
  // and the folder is set before anything reads it: before the first getPath("userData") and the one-window lock
  const setAt = MAIN.indexOf('else app.setPath("userData", path.join(APPDATA, DATA_FOLDER));');
  assert.ok(setAt > 0 && setAt < MAIN.indexOf('app.getPath("userData")') && setAt < MAIN.indexOf("requestSingleInstanceLock"));
});

test("r24 follow-up: the update test's build has its own folder and never looks into the old one; a package with no dataFolder keeps Electron's own name", () => {
  const A = path.join(os.tmpdir(), "no-such-appdata");
  const t = start({ appData: A, pkg: { ...PKG, productName: "Gusset Update Test", dataFolder: "Gusset Update Test" } });
  assert.deepStrictEqual([t.data, t.old], [path.join(A, "Gusset Update Test"), null]);
  const none = start({ appData: A, pkg: { ...PKG, dataFolder: undefined }, name: "Gusset Update Test" });
  assert.deepStrictEqual([none.data, none.old], [path.join(A, "Gusset Update Test"), null], "never Gusset's by default");
});

test("r24 follow-up: PDRAFT_APP_DATA stands in for the app-data folder only inside the temp folder; PDRAFT_USER_DATA still wins", () => {
  const S = path.join(os.tmpdir(), "pdraft-appdata-standin");
  const r = start({ appData: "C:\\real-appdata", env: { PDRAFT_APP_DATA: S } });
  assert.deepStrictEqual([r.data, r.old, r.appData], [path.join(S, "Gusset"), path.join(S, OLD), S], "both folders in the stand-in, and Electron's appData too");
  assert.throws(() => start({ appData: "C:\\real-appdata", env: { PDRAFT_APP_DATA: path.join(ROOT, "x") } }), /exit 2/, "a folder outside the temp folder: the app does not start");
  assert.throws(() => start({ appData: "C:\\real-appdata", env: { PDRAFT_APP_DATA: os.tmpdir() } }), /exit 2/, "the temp folder itself neither");
  const u = start({ appData: "C:\\real-appdata", env: { PDRAFT_USER_DATA: path.join(S, "data") } });
  assert.deepStrictEqual([u.data, u.old], [path.join(S, "data"), null], "a check's own data folder, and nothing brought over");
});

// The temp folder's path often holds a link (a Mac's /var is one, a Windows runner's RUNNER~1 a short name), and a
// stand-in does not exist yet: a folder that is not there yet is judged by what its nearest existing parent really is.
test("r24 follow-up: PDRAFT_APP_DATA, a folder not there yet: inside a temp folder reached through a link it is taken, through a link out of the temp folder it is refused", () => {
  const box = fs.mkdtempSync(path.join(os.tmpdir(), "pdraft-tmplink-"));
  const realTemp = path.join(box, "real"), toTemp = path.join(box, "link"), toOut = path.join(realTemp, "out");
  const was = {}, KEYS = ["TEMP", "TMP", "TMPDIR"], setTemp = (d) => { for (const k of KEYS) process.env[k] = d; };
  for (const k of KEYS) was[k] = process.env[k];
  try {
    fs.mkdirSync(realTemp);
    fs.symlinkSync(realTemp, toTemp, "junction");
    fs.symlinkSync(ROOT, toOut, "junction");
    setTemp(toTemp);
    const S = path.join(toTemp, "not", "there", "yet");
    assert.strictEqual(start({ appData: "C:\\real-appdata", env: { PDRAFT_APP_DATA: S } }).data, path.join(S, "Gusset"), "inside the temp folder, its path a link");
    assert.ok(TD.inTemp(S), "the check's own test the same");
    setTemp(realTemp);
    const O = path.join(toOut, "not-there-yet");
    assert.throws(() => start({ appData: "C:\\real-appdata", env: { PDRAFT_APP_DATA: O } }), /exit 2/, "a link out of the temp folder: the app does not start");
    assert.ok(!TD.inTemp(O), "the check's own test the same");
  } finally {
    for (const k of KEYS) { if (was[k] === undefined) delete process.env[k]; else process.env[k] = was[k]; }
    // the links alone, and never a recursive delete: one of them leads to the project
    for (const l of [toOut, toTemp]) { try { fs.unlinkSync(l); } catch (e) { try { fs.rmdirSync(l); } catch (e2) {} } }
    for (const d of [realTemp, box]) { try { fs.rmdirSync(d); } catch (e) {} }
  }
});

module.exports = T;
