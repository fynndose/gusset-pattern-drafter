// Round r29d: the update feed on the website, which only a published release reaches, and a feed that cannot be read being no update. The real updater against a real
// feed, its downloads elsewhere, is scripts/update-test.js (Windows, local).
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const F = require(path.join(ROOT, "scripts", "make-update-feed.js")), U = require(path.join(ROOT, "desktop", "updates.js"));

const T = [];
const test = (name, fn) => T.push({ name, fn });
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const REPO = "https://github.com/o/r/releases/download/";
const asset = (tag, name) => ({ name, browser_download_url: REPO + tag + "/" + name });
const rel = (tag, names, more) => ({ tag_name: tag, prerelease: tag.includes("-"), draft: false, assets: names.map(n => asset(tag, n)), ...more });
const YML = ["version: 1.0.0-beta.2", "files:", "  - url: Gusset-1.0.0-beta.2-win-x64-setup.exe", "    sha512: abc+/=", "    size: 114520900", "path: Gusset-1.0.0-beta.2-win-x64-setup.exe", "sha512: abc+/=", "releaseDate: '2026-11-01T00:00:00.000Z'", ""].join("\n");

test("r29d / 1: only what is published reaches the feed: a draft is never read, and a tag with no release is not in the list at all; each channel file from the newest release that has it, by version, not as text", () => {
  const names = (rels) => F.feedPlan(rels).map(p => p.name + " " + p.tag);
  const b1 = rel("v1.0.0-beta.1", ["beta.yml", "beta-mac.yml", "beta-linux.yml", "x.exe", "SHA256SUMS.txt", "builder-debug.yml"]);
  assert.deepStrictEqual(names([b1]), ["beta-linux.yml v1.0.0-beta.1", "beta-mac.yml v1.0.0-beta.1", "beta.yml v1.0.0-beta.1"], "the channel files, nothing else");
  assert.deepStrictEqual(names([b1, rel("v1.0.0-beta.2", ["beta.yml", "beta-mac.yml", "beta-linux.yml"], { draft: true })]), names([b1]), "the draft between a tag and its publishing changes nothing");
  assert.deepStrictEqual(names([rel("v1.0.0-beta.10", ["beta.yml"]), rel("v1.0.0-beta.9", ["beta.yml", "beta-mac.yml"])]), ["beta-mac.yml v1.0.0-beta.9", "beta.yml v1.0.0-beta.10"], "beta.10 is after beta.9; a file only an older one has stays");
  assert.deepStrictEqual(names([]), []);
});

test("r29d / 1: the channels as the app reads them: a stable release serves the beta channel too and its own, no test version ever reaches latest*.yml, and a later test version takes the beta channel only", () => {
  const stable = rel("v1.0.0", ["latest.yml", "latest-mac.yml", "beta.yml", "beta-mac.yml"]);
  const names = (rels) => F.feedPlan(rels).map(p => p.name + " " + p.tag);
  assert.deepStrictEqual(names([stable, rel("v1.0.0-beta.2", ["beta.yml", "latest.yml"])]), ["beta-mac.yml v1.0.0", "beta.yml v1.0.0", "latest-mac.yml v1.0.0", "latest.yml v1.0.0"], "the stable is the newer, and a beta's stray latest.yml is ignored");
  assert.deepStrictEqual(names([stable, rel("v1.1.0-beta.1", ["beta.yml"])]), ["beta-mac.yml v1.0.0", "beta.yml v1.1.0-beta.1", "latest-mac.yml v1.0.0", "latest.yml v1.0.0"]);
  assert.deepStrictEqual(names([rel("v1.0.0-beta.2", ["latest.yml"])]), [], "only a stable release is latest");
});

test("r29d / 1: a channel file's downloads become absolute addresses on the release, and nothing else of it changes; the updater reads them from there, whatever the feed's own address is", () => {
  const base = REPO + "v1.0.0-beta.2/", out = F.absolute(YML, base);
  assert.strictEqual(out, YML.replace("  - url: Gusset-1.0.0-beta.2-win-x64-setup.exe", "  - url: " + base + "Gusset-1.0.0-beta.2-win-x64-setup.exe").replace("path: Gusset-1.0.0-beta.2-win-x64-setup.exe", "path: " + base + "Gusset-1.0.0-beta.2-win-x64-setup.exe"));
  assert.strictEqual(F.absolute(out, "https://elsewhere.invalid/"), out, "already absolute: the same");
  assert.ok(F.looksLikeFeed(out)); assert.ok(!F.looksLikeFeed(YML), "relative addresses would point into the website"); assert.ok(!F.looksLikeFeed("<html>Not Found</html>"));
  assert.strictEqual(F.absolute("  - url: 'a b.exe'\npath: \"a b.exe\"\n", "https://x/"), "  - url: https://x/a%20b.exe\npath: https://x/a%20b.exe\n", "quoted, with a space");
  const CR = F.absolute(YML.replace(/\n/g, "\r\n"), base); assert.ok(F.looksLikeFeed(CR) && !/url: Gusset/.test(CR));
  // what electron-updater's own code does with such an address, where it is installed (a copy of the released files has not installed it)
  const provider = path.join(ROOT, "desktop", "node_modules", "electron-updater", "out", "providers", "Provider.js");
  if (!fs.existsSync(provider)) return;
  const { resolveFiles } = require(provider);
  const r = resolveFiles({ files: [{ url: base + "G.exe", sha512: "x", size: 1 }], path: base + "G.exe", sha512: "x", version: "1" }, new URL("https://gussetdrafter.com/updates/"));
  assert.strictEqual(r[0].url.href, base + "G.exe", "not under the website");
});

test("r29d / 1: writing the feed: from a release's real bytes, a channel gone from every published release goes too; an asset that is not a channel file leaves the feed as it was", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdraft-feed-"));
  try {
    fs.writeFileSync(path.join(dir, "alpha.yml"), "old"); fs.writeFileSync(path.join(dir, "keep.txt"), "x");
    const rels = [rel("v1.0.0-beta.2", ["beta.yml"]), rel("v1.0.0-beta.3", ["beta.yml"], { draft: true })];
    const asked = [];
    await F.write(rels, dir, async (u) => { asked.push(u); return YML; });
    assert.deepStrictEqual(asked, [REPO + "v1.0.0-beta.2/beta.yml"], "the draft is never fetched");
    assert.ok(fs.readFileSync(path.join(dir, "beta.yml"), "utf8").includes("path: " + REPO + "v1.0.0-beta.2/Gusset-"));
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), ["beta.yml", "keep.txt"]);
    const was = fs.readFileSync(path.join(dir, "beta.yml"), "utf8");
    await assert.rejects(F.write(rels, dir, async () => "Not Found"), /not a channel file/);
    assert.strictEqual(fs.readFileSync(path.join(dir, "beta.yml"), "utf8"), was);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("r29d / 1: the workflow writes the feed only on a release published by hand, and commits it with the list; a tag's run does not; every app from now on reads the website; the release keeps its channel files for beta 1", () => {
  const wf = read(".github", "workflows", "release.yml").replace(/\r\n/g, "\n"), job = wf.slice(wf.indexOf("  site-downloads:")), before = wf.slice(0, wf.indexOf("  site-downloads:"));
  assert.ok(job.includes('node scripts/make-update-feed.js --api "$RUNNER_TEMP/releases.json" --repo "$GITHUB_REPOSITORY" --out website/updates'));
  assert.ok(job.includes("git add website/downloads.json website/updates"));
  // (beta.3 release fix: or a release that is out already and got a missing system's files, attach)
  assert.ok(job.includes("github.repository == 'fynndose/gusset-pattern-drafter' && (github.event_name == 'release' || needs.release.outputs.published == 'true')"));
  assert.ok(wf.includes("types: [published]"));
  assert.ok(!before.includes("make-update-feed"), "a tag's run never touches the feed");
  assert.ok(before.includes('gh release upload "$TAG" dist/* --clobber'), "every built file on the release, the channel files with them: beta 1 reads those");
  const b = read("desktop", "build.js").replace(/\r\n/g, "\n"), head = b.slice(b.indexOf("if (src) extra.push("), b.indexOf('...(gh ? ['));
  assert.ok(head.includes('"--config.publish.channel=" + channelOf('), "the channel told for either source: the release has beta.yml as before, no latest.yml");
  assert.ok(read("website", "_headers").replace(/\r\n/g, "\n").includes("/updates/*\n  Cache-Control: no-cache\n"), "never a stale version");
});

test("r29d / 2: a feed that is missing or cannot be read is no update: logged quietly, whatever went wrong; a real answer and a download's failure are as they were", async () => {
  const appOf = (version) => ({ getVersion: () => version, isPackaged: true, getPath: () => "" });
  const make = (result, log) => U.make({ app: appOf("1.0.0-beta.2"), env: {}, platform: "win32", meta: { updateSource: "https://gussetdrafter.com/updates/" }, send() {}, openExternal: async () => {}, log,
    load: () => ({ on() {}, setFeedURL() {}, checkForUpdates: async () => { if (result instanceof Error) throw result; return result; }, downloadUpdate: async () => { throw new Error("disk full"); } }) });
  for (const msg of ['Cannot find latest.yml in the latest release artifacts (https://github.com/o/r/releases/download/v1.0.0-beta.2/latest.yml): HttpError: 404\nmore', 'Cannot find channel "beta.yml" update info: HttpError: 404', "net::ERR_INTERNET_DISCONNECTED", "Cannot parse update info from beta.yml", "connect ETIMEDOUT"]) {
    const logged = [], r = await make(new Error(msg), (l) => logged.push(l)).check();
    assert.strictEqual(r.status, "none", msg); assert.strictEqual(r.unread, true); assert.strictEqual(r.found, null); assert.strictEqual(r.error, undefined);
    assert.strictEqual(logged.length, 1); assert.ok(logged[0].includes(msg.split("\n")[0].slice(0, 40)), logged[0]); assert.ok(!logged[0].includes("more"), "its first line");
  }
  const ok = await make({ isUpdateAvailable: false, updateInfo: { version: "1.0.0-beta.2" } }, () => assert.fail("nothing to log")).check();
  assert.deepStrictEqual([ok.status, ok.unread], ["none", undefined], "really the newest");
  const up = make({ isUpdateAvailable: true, updateInfo: { version: "1.0.0-beta.3" } }, () => {});
  assert.strictEqual((await up.check()).status, "available");
  await assert.rejects(up.download(), /disk full/, "a download the user asked for still says");
});

test("r29d / 2: in the page: at the start no button, no line and nothing for a bug report; asked by hand it says no update, and does not claim to be the newest", () => {
  const f = path.join(os.tmpdir(), "pdraft-r29d-" + process.pid + ".json");
  fs.writeFileSync(f, JSON.stringify({ desktop: { updates: { check: { status: "none", unread: true, latest: "", version: "1.0.0-beta.2", channel: "beta", canInstall: true, found: null } } }, blank: true, script: `
    const el = (id) => app.ev("document").getElementById(id), out = {};
    app.ev("checkUpdates")(false);
    out.start = [el("s-upd").style.display, el("toast").textContent, app.ev("ERRLOG").length];
    app.ev("checkUpdates")(true);
    out.hand = el("toast").textContent; out.errs = app.ev("ERRLOG").length;
    return out;` }));
  let r; try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 }); } finally { fs.unlinkSync(f); }
  const o = JSON.parse(r.stdout); assert.deepStrictEqual(o.errors, []);
  assert.deepStrictEqual(o.result.start, ["none", "", 0]);
  assert.strictEqual(o.result.hand, "No update available"); assert.strictEqual(o.result.errs, 0);
  assert.ok(!/Couldn't check for updates/.test(read("drafter", "pattern-drafter.js")), "the words are gone for every way a check can fail");
});

test("r29d: the public documents say where the check goes: this website for the feed, GitHub for the download", () => {
  const p = read("website", "privacy.html");
  assert.ok(/asks this website at each start/.test(p) && /comes from GitHub/.test(p), "the privacy page");
  assert.ok(/project's website/.test(read("README.md")));
});

module.exports = T;
