// The website's list of downloads, website/downloads.json (Round r28). GitHub's "latest release" leaves out pre-releases, so its
// /releases/latest address finds nothing while every version is a beta: this list is worked out from all of the releases instead.
//   latest: the newest release that is out, a pre-release or not; stable: the newest that is not a pre-release (or null).
//   Each: { version, tag, prerelease, date, source (the source code's .zip), files: [{ os, kind, arch, name, url, size, sha256 }] }.
//   Drafts are never listed: their files cannot be fetched yet. A release with no file a person downloads is left out.
// node scripts/make-downloads.js --api <the releases as the REST API lists them> --repo <owner/repo> --out <file>
//   every release that is out; run by the release workflow when a release is published by hand. --sums <SHA256SUMS.txt> fills in a checksum the API does not give yet.
// node scripts/make-downloads.js --dist <folder of the builds> --version <v> --repo <owner/repo> --out <file>
//   this build alone, as it will be once published (with SHA256SUMS.txt from that folder): the workflow attaches it to the draft
//   and prints it in a dry run, so that the list is checked before anything is published.
"use strict";
const fs = require("fs"), path = require("path");

// what a built file is, by the names desktop/package.json gives them; anything else (blockmaps, channel files, checksums) is no download
function classify(name) {
  let m;
  if ((m = /-win-(x64|arm64)-setup\.exe$/.exec(name))) return { os: "windows", kind: "installer", arch: m[1] };
  if ((m = /-win-(x64|arm64)-portable\.exe$/.exec(name))) return { os: "windows", kind: "portable", arch: m[1] };
  if ((m = /-mac-(x64|arm64)\.(dmg|zip)$/.exec(name))) return { os: "mac", kind: m[2], arch: m[1] };
  if ((m = /-linux-(x86_64|x64|arm64)\.AppImage$/.exec(name))) return { os: "linux", kind: "appimage", arch: m[1] === "x86_64" ? "x64" : m[1] };
  return null;
}

// semantic version order: 1.0.0-beta.2 < 1.0.0-beta.10 < 1.0.0-rc.1 < 1.0.0. null for what is not a version
function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(v));
  return m ? { nums: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] } : null;
}
function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] - y.nums[i];
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) return +p - +q;
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

const sourceZip = (repo, tag) => "https://github.com/" + repo + "/archive/refs/tags/" + tag + ".zip";

// one release of the REST API's list → the site's, or null
function fromApi(r, repo) {
  if (r.draft || !parseVersion(r.tag_name)) return null;
  const files = (r.assets || []).map(a => {
    const c = classify(a.name);
    return c && { ...c, name: a.name, url: a.browser_download_url, size: a.size, sha256: /^sha256:/.test(a.digest || "") ? a.digest.slice(7) : "" };
  }).filter(Boolean);
  if (!files.length) return null;
  return { version: r.tag_name.replace(/^v/, ""), tag: r.tag_name, prerelease: !!r.prerelease, date: r.published_at || r.created_at || "", source: sourceZip(repo, r.tag_name), files };
}

// the list, from the site's releases
function listOf(rels) {
  const sorted = rels.filter(Boolean).sort((a, b) => compareVersions(b.version, a.version));
  const latest = sorted[0] || null, stable = sorted.find(r => !r.prerelease) || null;
  // (the date of what is listed, not the time of the run: an unchanged list stays the same bytes, and makes no commit)
  return { schema: 1, generated: latest ? latest.date : null, latest, stable };
}

// one version from a list of its files, [{ name, size }], and their checksums { name: sha256 }
function fromFiles(list, version, repo, sums) {
  const tag = "v" + version;
  const files = list.map(({ name, size }) => {
    const c = classify(name);
    return c && { ...c, name, url: "https://github.com/" + repo + "/releases/download/" + tag + "/" + encodeURIComponent(name), size, sha256: (sums || {})[name] || "" };
  }).filter(Boolean).sort((a, b) => (a.name < b.name ? -1 : 1));
  return files.length ? { version, tag, prerelease: version.includes("-"), date: "", source: sourceZip(repo, tag), files } : null;
}
const sumsOf = (file) => { const s = {}; if (file && fs.existsSync(file)) for (const l of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(l); if (m) s[m[2]] = m[1]; } return s; };

function fromDist(dir, version, repo) {
  return fromFiles(fs.readdirSync(dir).map(name => ({ name, size: fs.statSync(path.join(dir, name)).size })), version, repo, sumsOf(path.join(dir, "SHA256SUMS.txt")));
}

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : ""; };
  const repo = arg("repo"), out = arg("out");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !out || !(arg("api") || ((arg("dist") || arg("assets")) && arg("version")))) { console.error("node scripts/make-downloads.js (--api <releases.json> | --dist <folder> --version <v> | --assets <files.json> --version <v> --sums <SHA256SUMS.txt>) --repo <owner/repo> --out <file>"); process.exit(1); }
  let rels;
  const readSums = sumsOf;
  if (arg("api")) {
    // (gh api --paginate --slurp gives a list of pages, each a list of releases)
    const sums = readSums(arg("sums"));
    rels = JSON.parse(fs.readFileSync(arg("api"), "utf8")).flat().map(r => fromApi(r, repo));
    for (const r of rels) for (const f of r ? r.files : []) if (!f.sha256 && sums[f.name]) f.sha256 = sums[f.name];
  } else {
    // (--assets, beta.3 release fix: a draft that got a system's files later, by its whole list of files [{ name, size }])
    rels = [arg("assets") ? fromFiles(JSON.parse(fs.readFileSync(arg("assets"), "utf8")), arg("version"), repo, readSums(arg("sums"))) : fromDist(arg("dist"), arg("version"), repo)];
    if (!rels[0]) { console.error("no file a person downloads in " + (arg("assets") || arg("dist"))); process.exit(1); }
  }
  const list = listOf(rels);
  fs.writeFileSync(out, JSON.stringify(list, null, 2) + "\n");
  console.log(out + ": latest " + (list.latest ? list.latest.version + " (" + list.latest.files.length + " files)" : "none") + ", stable " + (list.stable ? list.stable.version : "none"));
}
module.exports = { classify, parseVersion, compareVersions, fromApi, fromDist, fromFiles, listOf };
