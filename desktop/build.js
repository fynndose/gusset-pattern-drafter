// Builds the desktop app with electron-builder and puts what it made in desktop/dist, each file with its SHA-256 beside it.
//   node build.js [win | portable | nsis | mac | linux] [--arch=x64 | --arch=arm64 | --arch=x64,arm64]
// With no target: on Windows the installer and the portable .exe (win, Round r24), the .dmg and .zip on a Mac, the AppImage on Linux (a .deb would need a public homepage); with no arch,
// this computer's. A system's app is built on that system only (a Mac's on a Mac: it is signed there, ad hoc). Several arches are built in one
// run (beta.3 release fix: the release workflow builds the Apple-chip Mac app on the Intel Mac, --arch=x64,arm64): then one channel file names
// every arch's download (two runs each wrote their own -mac.yml, and the release kept only one of them), each arch's unpacked app gets
// unpacked-<arch>.json, unpacked.json is this computer's arch (the one that can be started here), and the package check runs on each.
// The page and its files are taken from ../drafter as they are at the time of the build (extraResources in
// package.json: the list the tests keep in step with what the page loads). The build is made from a committed
// state only (PDRAFT_ALLOW_DIRTY=1 to build from changed files, for a try), and the date and the commit are written
// into the packed package.json (Help > About and a bug report show them). Before anything is kept, what the app
// holds is checked (scripts/package-check.js: nothing private, no tests, no other program named, no path of this
// machine, no e-mail address but the feedback link's); if that fails nothing is kept.
// The build itself is staged in the system temp folder (or PDRAFT_STAGE), so that a folder-syncing or scanning program
// watching the project cannot lock freshly unpacked files part-way through (electron-builder then fails with EPERM).
// The stage gets unpacked.json: { app, exe, resources } of the unpacked app, for starting and checking the very files
// the build packed (PDRAFT_KEEP_STAGE=1 keeps the stage).
// (Round r24) Updates: PDRAFT_UPDATE_SOURCE ("github:<owner>/<repo>", or a web folder's http(s) address) is where the app
// looks for newer versions (desktop/updates.js): it is written into the packed package.json ("updateSource") and given to
// electron-builder as where the versions are published, so it writes the channel files beside the builds (beta.yml or
// latest.yml, -mac.yml, -linux.yml; every channel at or below the version's: generateUpdatesFilesForAllChannels) and the
// blockmaps; they are kept with the builds. Without it the source is the website's update feed (DEFAULT_SOURCE, Round r29d; the public repository from Round PUB-1 to beta 1: a fork's build sets its own,
// "none" builds an app that does not look; a test build of another name has none unless told). The installer's licence page is made here: LICENSE, then ATTRIBUTION.md and TRADEMARKS.md.
// For the update check's own test only (scripts/update-test.js): PDRAFT_BUILD_VERSION (another version), PDRAFT_BUILD_NAME (an
// app of another name and id: its own install, shortcuts and data folder, never Gusset's), PDRAFT_OUT (where the files go).
"use strict";
const { spawnSync, execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SYSTEM = { win32: "win", darwin: "mac", linux: "linux" }[process.platform];
const target = process.argv.slice(2).find(a => !a.startsWith("--")) || { win: "win", mac: "mac", linux: "linux" }[SYSTEM];
const arches = ((process.argv.find(a => a.startsWith("--arch=")) || "").slice(7) || process.arch).split(",").map(a => a.trim()).filter(Boolean);
const FOR = { win: ["win", "--win nsis portable"], portable: ["win", "--win portable"], nsis: ["win", "--win nsis"], mac: ["mac", "--mac"], linux: ["linux", "--linux"] }[target];
if (!FOR) { console.error("Unknown target " + target + ": win, portable, nsis, mac or linux"); process.exit(1); }
if (FOR[0] !== SYSTEM) { console.error("The " + FOR[0] + " app is built on " + FOR[0] + " only (this is " + SYSTEM + ")"); process.exit(1); }
for (const arch of arches) if (!["x64", "arm64"].includes(arch)) { console.error("Unknown arch " + arch + ": x64 or arm64"); process.exit(1); }
const ROOT = path.join(__dirname, "..");
const stage = process.env.PDRAFT_STAGE ? path.resolve(process.env.PDRAFT_STAGE) : path.join(os.tmpdir(), "pdraft-desktop-build");
const out = process.env.PDRAFT_OUT ? path.resolve(process.env.PDRAFT_OUT) : path.join(__dirname, "dist");
// (Round r28) a copy of the source that is no git repository (a downloaded archive of the public repository) builds too
const git = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch (e) { return null; } };

const dirty = git("status", "--porcelain") || "";
if (dirty && process.env.PDRAFT_ALLOW_DIRTY !== "1") { console.error("The project has changes that are not committed:\n" + dirty + "\nCommit them first (a build is made from a commit), or set PDRAFT_ALLOW_DIRTY=1 for a try."); process.exit(1); }
const commit = (git("rev-parse", "--short", "HEAD") || "source") + (dirty ? "-dirty" : ""), date = new Date().toISOString().slice(0, 10);
console.log("Building " + target + " " + arches.join(" and ") + " from " + commit + " on " + date);
fs.rmSync(stage, { recursive: true, force: true });

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.CSC_IDENTITY_AUTO_DISCOVERY = "false";               // a Mac: no certificate is looked for; the app is signed ad hoc (mac.identity "-")
// the update source, the installer's licence page, and the test build's own version and name
const q = (s) => "\"" + String(s).replace(/"/g, "") + "\"";
const extra = [];
const channelOf = (v) => { const m = /-([a-z]+)/i.exec(String(v)); return m ? m[1].toLowerCase() : "latest"; };      // (as desktop/updates.js reads it)
const DEFAULT_SOURCE = "https://gussetdrafter.com/updates/", asked = String(process.env.PDRAFT_UPDATE_SOURCE || "").trim();
const src = asked === "none" || (!asked && process.env.PDRAFT_BUILD_NAME) ? "" : asked || DEFAULT_SOURCE, gh = /^github:([\w.-]+)\/([\w.-]+)$/.exec(src);
if (src && !gh && !/^https?:\/\/\S+$/i.test(src)) { console.error("PDRAFT_UPDATE_SOURCE must be github:<owner>/<repo> or an http(s) address, not " + src); process.exit(1); }
if (src) extra.push("--config.extraMetadata.updateSource=" + q(src), "--config.generateUpdatesFilesForAllChannels=true",
  // (Round r28: electron-builder writes only the channel it is told, latest.yml if it is told none, whatever the version says; Round r29d: the same for either source, so the release's files stay as they were and the GitHub source's older apps still find them)
  "--config.publish.channel=" + channelOf(process.env.PDRAFT_BUILD_VERSION || require("./package.json").version),
  ...(gh ? ["--config.publish.provider=github", "--config.publish.owner=" + gh[1], "--config.publish.repo=" + gh[2], "--config.publish.releaseType=prerelease"]
    : ["--config.publish.provider=generic", "--config.publish.url=" + q(src)]));
if (FOR[0] === "win") {
  const lic = path.join(os.tmpdir(), "pdraft-installer-licence.txt"), read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");
  fs.writeFileSync(lic, "﻿" + ["Gusset – Pattern Drafter is free software under the GNU General Public License, version 3 or (at your option) any later version: the license follows. Below it, the parts made by others and their licenses (ATTRIBUTION.md), the name and logo, which the license does not cover (TRADEMARKS.md), and every shipped dependency's license (THIRD-PARTY-NOTICES.md).",
    read("LICENSE"), "=".repeat(60), read("ATTRIBUTION.md"), "=".repeat(60), read("TRADEMARKS.md"), "=".repeat(60), read("THIRD-PARTY-NOTICES.md")].join("\n\n").replace(/\n/g, "\r\n"));
  extra.push("--config.nsis.license=" + q(lic));
}
if (process.env.PDRAFT_BUILD_VERSION) extra.push("--config.extraMetadata.version=" + q(process.env.PDRAFT_BUILD_VERSION));
// (and its package name: the folder it is installed into and electron-updater's download cache are named after it; and its data
// folder, %APPDATA%\<name>: never Gusset's, Round r24 follow-up)
if (process.env.PDRAFT_BUILD_NAME) { const n = process.env.PDRAFT_BUILD_NAME, slug = n.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  extra.push("--config.productName=" + q(n), "--config.extraMetadata.productName=" + q(n), "--config.extraMetadata.name=" + q(slug), "--config.appId=com.gussetdrafter.gusset-pattern-drafter.test." + slug.replace(/-/g, ""), "--config.extraMetadata.dataFolder=" + q(n),
    "--config.nsis.shortcutName=" + q(n), "--config.nsis.uninstallDisplayName=" + q(n), "--config.win.executableName=" + q(n)); }
const r = spawnSync("npx electron-builder " + FOR[1] + " " + arches.map(a => "--" + a).join(" ") + " --publish never \"--config.directories.output=" + stage + "\" --config.extraMetadata.buildDate=" + date + " --config.extraMetadata.buildCommit=" + commit + (extra.length ? " " + extra.join(" ") : ""),
  { cwd: __dirname, stdio: "inherit", shell: true, env });
if (r.status !== 0) process.exit(r.status || 1);

// each arch's unpacked app: win-unpacked, linux-unpacked, mac (with the .app in it) for x64; win-arm64-unpacked, linux-arm64-unpacked, mac-arm64 for arm64
// (the program file: Windows and Linux by its executableName, a Mac by the product name, as electron-builder names them)
const PKGB = require("./package.json"), PRODUCT = process.env.PDRAFT_BUILD_NAME || PKGB.productName, EXE = PKGB.build.linux.executableName,
  WIN_EXE = process.env.PDRAFT_BUILD_NAME || PKGB.build.win.executableName || PRODUCT;
const dirOf = (arch) => path.join(stage, SYSTEM === "mac" ? (arch === "x64" ? "mac" : "mac-" + arch) : SYSTEM + (arch === "x64" ? "" : "-" + arch) + "-unpacked");
const unpackedOf = (dir) => SYSTEM === "mac"
  ? { app: path.join(dir, PRODUCT + ".app"), exe: path.join(dir, PRODUCT + ".app", "Contents", "MacOS", PRODUCT), resources: path.join(dir, PRODUCT + ".app", "Contents", "Resources") }
  : { app: dir, exe: path.join(dir, SYSTEM === "win" ? WIN_EXE + ".exe" : EXE), resources: path.join(dir, "resources") };
const apps = {};
for (const arch of arches) {
  let dir = dirOf(arch);
  // (one arch: whatever unpacked folder electron-builder left, as before)
  if (!fs.existsSync(dir) && arches.length === 1) dir = fs.readdirSync(stage).map(d => path.join(stage, d)).find(d => fs.statSync(d).isDirectory() && /(-unpacked|^mac(-arm64|-universal)?)$/.test(path.basename(d)));
  if (!dir || !fs.existsSync(dir)) { console.error("electron-builder finished but left no unpacked " + arch + " app in " + stage); process.exit(1); }
  apps[arch] = unpackedOf(dir);
  fs.writeFileSync(path.join(stage, "unpacked-" + arch + ".json"), JSON.stringify(apps[arch], null, 1));
}
fs.writeFileSync(path.join(stage, "unpacked.json"), JSON.stringify(apps[process.arch] || apps[arches[0]], null, 1));

// what each app holds, checked before anything is kept
// (Round r28: scripts/package-check.js stays in the private repository; the public source has only what its build needs)
const PKG_CHECK = path.join(ROOT, "scripts", "package-check.js");
for (const arch of arches) {
  const chk = fs.existsSync(PKG_CHECK) ? spawnSync(process.execPath, [PKG_CHECK, apps[arch].app], { stdio: "inherit" }) : { status: 0 };
  if (chk.status !== 0) { console.error("\nThe built " + arch + " app failed the package check: nothing was kept (the build is in " + stage + ")."); process.exit(1); }
}

fs.mkdirSync(out, { recursive: true });
// (Round r24) and the update check's channel files and blockmaps, which the release carries beside the builds
const made = fs.readdirSync(stage).filter(f => /\.(exe|dmg|zip|AppImage|deb|yml|blockmap)$/.test(f) && !/^builder-(debug|effective-config)\.yml$/.test(f) && fs.statSync(path.join(stage, f)).isFile());
if (!made.length) { console.error("electron-builder finished but made nothing to keep in " + stage); process.exit(1); }
for (const f of made) {
  const to = path.join(out, f);
  fs.copyFileSync(path.join(stage, f), to);
  if (/\.(yml|blockmap)$/.test(f)) { console.log("\n" + to); continue; }
  const sum = crypto.createHash("sha256").update(fs.readFileSync(to)).digest("hex");
  fs.writeFileSync(to + ".sha256", sum + " *" + f + "\n");                    // the format sha256sum -c reads
  console.log("\n" + to + "  (" + (fs.statSync(to).size/1048576).toFixed(1) + " MB)\nSHA-256 " + sum);
}
if (process.env.PDRAFT_KEEP_STAGE === "1") console.log("The unpacked app is kept in " + arches.map(a => apps[a].app).join(" and "));
else fs.rmSync(stage, { recursive: true, force: true });
