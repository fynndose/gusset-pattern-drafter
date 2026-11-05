// The release job's decisions (beta.3 release fix: the v1.0.0-beta.3 run failed twice because no Apple-chip Mac build machine was free).
// A release is never held up by a build machine that did not come: what was built goes on the draft, and the notes say what is missing.
// A real failure (a test, a check, the build) still stops it.
//   runs <artifact names>       the run's artifacts, one name a line: gusset-<system> (built) and failed-<system>-<attempt> (a step
//                               after Install failed: real). Prints each system; exit 1 if one failed for real and was not built since,
//                               or if nothing was built. A system with neither never ran (no machine, cancelled): it is missing, no failure
//   assets <out> [--release <gh release view --json assets>] [--dist <folder>]
//                               the release's files after this run: [{ name, size }], the release's (but the two remade) and the new ones
//   clash <release json> <folder>  exit 1 if a built file is on the release already (adding never writes over a file)
//   sums <old SHA256SUMS.txt> <new>  one list: the old lines, a new line in place of an old one of the same name; by name
//   missing <assets json>       the notes' section on the systems whose files are not all there (nothing when none is missing)
"use strict";
const fs = require("fs"), path = require("path");

// each system the release offers, and the files it must have (as desktop/package.json names them)
const SYSTEMS = [
  { id: "win-x64", label: "Windows (the installer and the portable .exe)", files: [/-win-x64-setup\.exe$/, /-win-x64-portable\.exe$/] },
  { id: "mac", label: "Mac, Apple chip and Intel (the .dmg and .zip files)", files: [/-mac-arm64\.dmg$/, /-mac-arm64\.zip$/, /-mac-x64\.dmg$/, /-mac-x64\.zip$/] },
  { id: "linux-x64", label: "Linux (the AppImage)", files: [/-linux-(x86_64|x64)\.AppImage$/] },
];
const REMADE = ["SHA256SUMS.txt", "downloads.json"];      // written again by every release run

function runs(names) {
  const built = new Set(), failed = new Set();
  for (const n of names.map(s => s.trim()).filter(Boolean)) {
    let m;
    if ((m = /^gusset-(.+)$/.exec(n))) built.add(m[1]);
    else if ((m = /^failed-(.+)-\d+$/.exec(n))) failed.add(m[1]);
  }
  const real = [...failed].filter(s => !built.has(s));      // (failed once, built by a later attempt: built)
  return { built: [...built].sort(), failed: real.sort(), ok: !real.length && built.size > 0 };
}

function missing(list) {
  const names = list.map(f => f.name);
  return SYSTEMS.filter(s => !s.files.every(re => names.some(n => re.test(n))));
}
function missingText(list) {
  const m = missing(list);
  if (!m.length) return "";
  return "\n## Not in this release yet\n\n" + m.map(s => "- " + s.label).join("\n") +
    "\n\nNo build machine for " + (m.length > 1 ? "these" : "it") + " was available when this release was made. " + (m.length > 1 ? "They" : "It") + " will be added to this release later, and the download page and the update check offer " + (m.length > 1 ? "them" : "it") + " from then on. Until then, the previous version's files are the ones to use there.\n";
}

const sumLines = (file) => (file && fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : []).map(l => /^([0-9a-f]{64}) ([ *])(.+)$/.exec(l)).filter(Boolean);
function sums(oldFile, newFile) {
  const by = new Map();
  for (const m of [...sumLines(oldFile), ...sumLines(newFile)]) by.set(m[3], m[0]);
  return [...by.keys()].sort().map(k => by.get(k)).join("\n") + "\n";
}

function assets(release, dist) {
  const old = release ? (release.assets || []).filter(a => !REMADE.includes(a.name)).map(a => ({ name: a.name, size: a.size })) : [];
  const now = dist ? fs.readdirSync(dist).filter(n => !REMADE.includes(n)).map(name => ({ name, size: fs.statSync(path.join(dist, name)).size })) : [];
  return old.filter(a => !now.some(n => n.name === a.name)).concat(now).sort((a, b) => (a.name < b.name ? -1 : 1));
}
function clash(release, dist) {
  const there = new Set((release.assets || []).map(a => a.name));
  return fs.readdirSync(dist).filter(n => !REMADE.includes(n) && there.has(n));
}

if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2), arg = (n) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : ""; };
  const json = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
  if (cmd === "runs") {
    const r = runs(fs.readFileSync(a, "utf8").split(/\r?\n/));
    console.log("Built: " + (r.built.join(", ") || "nothing"));
    if (r.failed.length) console.log("::error title=A build failed::" + r.failed.join(", ") + ": a test, a check or the build failed (not a missing build machine). Nothing is released: fix it, or re-run the failed jobs.");
    else if (!r.built.length) console.log("::error title=Nothing was built::no system's build finished, so there is nothing to release.");
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === "assets") {
    fs.writeFileSync(a, JSON.stringify(assets(arg("release") ? json(arg("release")) : null, arg("dist") || null), null, 1));
  } else if (cmd === "clash") {
    const c = clash(json(a), b);
    if (c.length) { console.log("::error title=Already on the release::" + c.join(", ") + ": these are on the release already, and adding never writes over a file. Nothing was added."); process.exit(1); }
  } else if (cmd === "sums") {
    process.stdout.write(sums(a, b));
  } else if (cmd === "missing") {
    const m = missing(json(a));
    for (const s of m) console.error("::warning title=Not in this release yet::" + s.label);
    process.stdout.write(missingText(json(a)));
  } else { console.error("node scripts/release-parts.js runs | assets | clash | sums | missing …: see the top of this file"); process.exit(1); }
}
module.exports = { SYSTEMS, runs, missing, missingText, sums, assets, clash };
