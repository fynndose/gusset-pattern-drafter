// The update feed the app reads from the website, website/updates/ (Round r29d). A tag alone, or a draft, must never look like a version: reading GitHub's
// releases feed directly, the updater sees every pushed tag, and between a tag and its publishing it finds no channel file there. So the feed holds only what is published.
// Made by the release workflow when a release is published by hand, and committed with website/downloads.json. The export never touches it.
//   For each channel file (beta.yml, beta-mac.yml, beta-linux.yml, latest.yml, …) the newest published release that carries it, a stable release never
//   overridden by a test version's: a stable build writes the beta channel's files too, so test versions are offered it, and no test version writes latest*.yml.
//   Each file as the release has it but for where its downloads are: a release's channel file names them beside itself, and here they are on GitHub, as absolute addresses.
// node scripts/make-update-feed.js --api <the releases as the REST API lists them> --repo <owner/repo> --out <folder>
"use strict";
const fs = require("fs"), path = require("path");
const { parseVersion, compareVersions } = require("./make-downloads.js");

const CHANNEL_FILE = /^[a-z]+(-mac|-linux(-arm64)?)?\.yml$/, STABLE_FILE = /^latest(-|\.)/;
const isChannelFile = (name) => CHANNEL_FILE.test(name);

// [{ name, url, base, tag }]: which release each channel file comes from. Drafts are never read
function feedPlan(rels) {
  const seen = new Map();
  const out = rels.filter(r => r && !r.draft && parseVersion(r.tag_name)).sort((a, b) => compareVersions(b.tag_name, a.tag_name));
  for (const r of out) for (const a of r.assets || []) {
    if (!isChannelFile(a.name) || seen.has(a.name)) continue;
    if (r.prerelease && STABLE_FILE.test(a.name)) continue;
    seen.set(a.name, { name: a.name, url: a.browser_download_url, base: a.browser_download_url.slice(0, a.browser_download_url.lastIndexOf("/") + 1), tag: r.tag_name });
  }
  return [...seen.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
}

// a channel file's downloads as absolute addresses, and nothing else of it changed
function absolute(text, base) {
  return String(text).replace(/^(\s*-\s+url:|path:)[ \t]*(['"]?)([^'"\r\n]+)\2[ \t]*$/gm, (all, key, q, name) => (/^https?:\/\//i.test(name) ? all : key + " " + base + encodeURIComponent(name)));
}
const looksLikeFeed = (text) => /^version:\s*\S+/m.test(text) && /^\s*-\s+url:\s*https?:\/\//m.test(text) && /^path:\s*https?:\/\//m.test(text) && /^sha512:/m.test(text);

async function write(rels, out, read) {
  const plan = feedPlan(rels);
  fs.mkdirSync(out, { recursive: true });
  const made = [];
  for (const p of plan) {
    const text = absolute(await read(p.url), p.base);
    if (!looksLikeFeed(text)) throw new Error(p.name + " of " + p.tag + " is not a channel file: the feed is left as it was");      // (before anything is written over: below)
    made.push([p.name, text]);
  }
  for (const n of fs.readdirSync(out)) if (isChannelFile(n) && !made.some(m => m[0] === n)) fs.rmSync(path.join(out, n));      // (a channel no published release carries now)
  for (const [n, t] of made) fs.writeFileSync(path.join(out, n), t);
  return plan;
}

if (require.main === module) {
  const arg = (n) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : ""; };
  const api = arg("api"), repo = arg("repo"), out = arg("out");
  if (!api || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !out) { console.error("node scripts/make-update-feed.js --api <releases.json> --repo <owner/repo> --out <folder>"); process.exit(1); }
  const read = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(r.status + " " + u); return r.text(); };
  write(JSON.parse(fs.readFileSync(api, "utf8")).flat(), out, read).then((p) => { for (const x of p) console.log(x.name + " from " + x.tag); console.log(p.length + " channel files in " + out); }, (e) => { console.error(e.message); process.exit(1); });
}
module.exports = { feedPlan, absolute, looksLikeFeed, write, isChannelFile };
