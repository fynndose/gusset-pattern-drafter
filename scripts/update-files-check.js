// node scripts/update-files-check.js <folder of the builds> <version>
// (Round r24) The update check's channel files beside the builds (desktop/build.js with PDRAFT_UPDATE_SOURCE: beta.yml /
// latest.yml for the Windows installer, -mac.yml, -linux.yml), checked before a release carries them, and in the release
// workflow's dry run too:
//   - each names this version, and every file it names is in the folder with that size and SHA-512 (what the app checks
//     the download against);
//   - a test version (0.9.0-beta.5) writes no latest*.yml, so a stable version is never offered a beta; a stable version
//     writes latest*.yml;
//   - each system's build has its file: the installer (.exe but the portable one) a channel file with no suffix, an
//     AppImage a -linux one, a Mac's .zip a -mac one.
// Exit code 1 on any problem. No dependencies: the files' few keys are read line by line.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const [dirArg, version] = process.argv.slice(2);
if (!dirArg || !version) { console.log("node scripts/update-files-check.js <folder> <version>"); process.exit(1); }
const dir = path.resolve(dirArg), files = fs.readdirSync(dir), problems = [];
const pre = /-([a-z]+)/i.exec(version), channel = pre ? pre[1].toLowerCase() : "latest";

// version, files: [{ url, sha512, size }], path, sha512
function readYml(text) {
  const out = { files: [] };
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = /^version:\s*'?([^'\s]+)'?\s*$/.exec(line))) out.version = m[1];
    else if ((m = /^path:\s*'?([^']+?)'?\s*$/.exec(line))) out.path = m[1];
    else if ((m = /^sha512:\s*'?([^'\s]+)'?\s*$/.exec(line))) out.sha512 = m[1];
    else if ((m = /^\s+-\s+url:\s*'?([^']+?)'?\s*$/.exec(line))) out.files.push(cur = { url: m[1] });
    else if (cur && (m = /^\s+sha512:\s*'?([^'\s]+)'?\s*$/.exec(line))) cur.sha512 = m[1];
    else if (cur && (m = /^\s+size:\s*(\d+)\s*$/.exec(line))) cur.size = +m[1];
  }
  return out;
}
const yml = files.filter(f => /\.yml$/.test(f) && !/^builder-/.test(f));
if (!yml.length) problems.push("no channel file (.yml) in " + dir + ": was the build given PDRAFT_UPDATE_SOURCE?");
const sha = new Map();
const sha512 = (f) => { if (!sha.has(f)) sha.set(f, crypto.createHash("sha512").update(fs.readFileSync(path.join(dir, f))).digest("base64")); return sha.get(f); };
for (const y of yml) {
  const d = readYml(fs.readFileSync(path.join(dir, y), "utf8"));
  if (d.version !== version) problems.push(y + " names version " + d.version + ", not " + version);
  if (pre && /^latest/.test(y)) problems.push(y + ": a test version must not write a latest channel file (stable versions would be offered it)");
  if (!d.files.length) problems.push(y + " names no file");
  for (const f of d.files) {
    if (!files.includes(f.url)) { problems.push(y + " names " + f.url + ", which is not here"); continue; }
    if (f.size !== fs.statSync(path.join(dir, f.url)).size) problems.push(y + ": " + f.url + " is " + fs.statSync(path.join(dir, f.url)).size + " bytes, the file says " + f.size);
    if (f.sha512 !== sha512(f.url)) problems.push(y + ": " + f.url + "'s SHA-512 is not the one the file names");
  }
  console.log(y + ": version " + d.version + ", " + d.files.map(f => f.url).join(", "));
}
const has = (re) => yml.some(y => re.test(y));
const want = channel === "latest" ? "latest" : channel;
if (files.some(f => /-setup\.exe$/.test(f)) && !has(new RegExp("^" + want + "\\.yml$"))) problems.push("the Windows installer has no " + want + ".yml");
if (files.some(f => /\.AppImage$/.test(f)) && !has(new RegExp("^" + want + "-linux(-arm64)?\\.yml$"))) problems.push("the AppImage has no " + want + "-linux.yml");
if (files.some(f => /-mac-[\w]+\.zip$/.test(f)) && !has(new RegExp("^" + want + "-mac\\.yml$"))) problems.push("the Mac build has no " + want + "-mac.yml");
if (problems.length) { console.log("\nUPDATE FILES CHECK FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("Update files check passed: " + yml.length + " channel file(s) for " + version + " (channel " + channel + "), every file they name is here and matches.");
