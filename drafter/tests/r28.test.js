// Round r28: release prep. The third-party notices against the lock file, what a public copy of the source needs to build
// itself, and the website's download logic and the workflow's list of downloads.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const T = [];
const test = (name, fn) => T.push({ name, fn });
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

test("r28 / 1 THIRD-PARTY-NOTICES.md names every shipped dependency, with its version and license (node scripts/make-notices.js)", () => {
  const t = read("THIRD-PARTY-NOTICES.md"), lock = JSON.parse(read("desktop", "package-lock.json"));
  for (const [k, v] of Object.entries(lock.packages)) {
    if (!k || v.dev || v.devOptional) continue;
    const name = k.replace(/^.*node_modules\//, "");
    assert.ok(t.includes("| " + name + " | " + v.version + " | the desktop app, for the update check | " + v.license + " |"), name + " " + v.version + " is in the table");
    assert.ok(t.includes("### " + name + " " + v.version), name + " has its license text");
  }
  for (const part of ["three.js", "fflate", "three-gpu-pathtracer", "three-mesh-bvh", "Electron", "NSIS", "AppImage"]) assert.ok(t.includes("| " + part), part + " is listed");
  if (fs.existsSync(path.join(ROOT, "desktop", "node_modules", "electron"))) assert.ok(t.includes("| Electron, with Chromium and Node.js | " + JSON.parse(read("desktop", "node_modules", "electron", "package.json")).version + " |"), "Electron's version as installed");      // (no npm install is needed for the tests)
});

test("r28 / 2 the notices are packed beside the licence, and on the installer's licence page", () => {
  const PKG = JSON.parse(read("desktop", "package.json"));
  assert.ok(PKG.build.extraResources.find(r => r.from === "..").filter.includes("THIRD-PARTY-NOTICES.md"));
  assert.ok(/read\("TRADEMARKS\.md"\), "=".repeat\(60\), read\("THIRD-PARTY-NOTICES\.md"\)/.test(read("desktop", "build.js")));
});

test("r28 / 3 the desktop build works from a public copy: no git needed, no package check needed", () => {
  const b = read("desktop", "build.js");
  assert.ok(/catch \(e\) \{ return null; \}/.test(b) && b.includes('(git("rev-parse", "--short", "HEAD") || "source")'), "no git repository: the commit is written as 'source'");
  assert.ok(b.includes("fs.existsSync(PKG_CHECK)"), "the package check only where it is");
});

test("r28 / 4 the download page offers the visitor's system first, a final version over a test version, and never guesses", () => {
  const D = require(path.join(ROOT, "website", "assets", "download.js"));
  const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130", LIN = "Mozilla/5.0 (X11; Linux x86_64) Chrome/130";
  assert.strictEqual(D.osOf(WIN, undefined, 0), "windows");
  assert.strictEqual(D.osOf(MAC, undefined, 0), "mac");
  assert.strictEqual(D.osOf(LIN, undefined, 0), "linux");
  assert.strictEqual(D.osOf(MAC, undefined, 5), "phone", "an iPad says Macintosh, but has a touch screen");
  assert.strictEqual(D.osOf("Mozilla/5.0 (Linux; Android 14) Chrome/130", undefined, 5), "phone", "Android says Linux too");
  assert.strictEqual(D.osOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", undefined, 5), "phone");
  assert.strictEqual(D.osOf("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/130", undefined, 0), "phone", "no build for a Chromebook");
  assert.strictEqual(D.osOf("", "macOS", 0), "mac", "what the browser's own platform says");
  assert.strictEqual(D.osOf("something else", undefined, 0), "");
  const f = (os, kind, arch) => ({ os, kind, arch });
  const rel = { files: [f("mac", "zip", "arm64"), f("mac", "dmg", "x64"), f("mac", "dmg", "arm64"), f("windows", "portable", "x64"), f("windows", "installer", "x64")] };
  assert.deepStrictEqual(D.filesFor(rel, "windows").map(x => x.kind), ["installer", "portable"]);
  assert.deepStrictEqual(D.filesFor(rel, "mac").map(x => x.kind + " " + x.arch), ["dmg arm64", "zip arm64", "dmg x64"]);
  assert.deepStrictEqual(D.filesFor(rel, "linux"), []);
  assert.strictEqual(D.primaryOf({ latest: null, stable: null }), null);
  assert.strictEqual(D.primaryOf({ latest: { version: "1.1.0-beta.1" }, stable: { version: "1.0.0" } }).version, "1.0.0");
  assert.strictEqual(D.primaryOf({ latest: { version: "1.0.0-beta.1" }, stable: null }).version, "1.0.0-beta.1");
  assert.strictEqual(D.versionText("1.0.0-beta.1"), "1.0.0 beta 1");
  assert.strictEqual(D.sizeText(104857600), "100 MB");
});

test("r28 / 5 the update button sends a person to the website's download page when config.js names one, and only an https one", async () => {
  const U = require(path.join(ROOT, "desktop", "updates.js")), opened = [];
  const make = (downloadPage) => U.make({ app: { getVersion: () => "1.0.0-beta.1", isPackaged: true, getPath: () => "" }, env: { PORTABLE_EXECUTABLE_FILE: "x" }, platform: "win32", meta: { updateSource: "github:o/r" }, send() {}, openExternal: (u) => { opened.push(u); return Promise.resolve(); }, downloadPage });
  assert.strictEqual(await make("https://gussetdrafter.com/download").openPage(), "https://gussetdrafter.com/download");
  assert.strictEqual(make("https://gussetdrafter.com/download").state().page, "https://gussetdrafter.com/download");
  assert.ok(/^https:\/\/github\.com\/o\/r\/releases/.test(await make("").openPage()), "without one, the source's release page");
  assert.ok(/github/.test(await make("javascript:alert(1)").openPage()), "only https");
  assert.ok(require(path.join(ROOT, "drafter", "config.js")).downloadUrl.startsWith("https://gussetdrafter.com/"), "the project's own address");
});

test("r28 / 6 the website: every page in American, no other program named, the two addresses and the license on every page, a slot per screenshot", () => {
  // (Round PUB-1, the maintainer's brief: more pages, and the footer links to the source code: GitHub in the footer only)
  const pages = ["index.html", "features.html", "download.html", "try.html", "help.html", "privacy.html", "contact.html", "legal.html"];
  for (const n of pages) {
    const t = read("website", n);
    assert.ok(/feedback@gussetdrafter\.com/.test(t) && /contact@gussetdrafter\.com/.test(t), n + ": both addresses");
    assert.ok(/GNU General Public License/.test(t) && /THIRD-PARTY-NOTICES/.test(t) && /TRADEMARKS/.test(t), n + ": the license, the notices, the name and logo");
    assert.ok(!/colour|licence|centre/i.test(t), n + ": American spelling");
    assert.ok(/name="viewport"/.test(t), n + ": for a phone");
  }
  const idx = read("website", "features.html");
  assert.ok(read("website", "index.html").includes("website/assets/shots/overview.png"));
  for (const shot of ["2d-window", "sewing", "3d-window", "print-layout"]) assert.ok(idx.includes('src="assets/shots/' + shot + '.png"') && idx.includes("website/assets/shots/" + shot + ".png"), shot + "'s slot says where its file goes");
  const help = read("website", "help.html");
  for (const w of ["More info", "Run anyway", "Open Anyway", "xattr -cr"]) assert.ok(help.includes(w), "the help page says " + w);
  assert.ok(help.includes('"/Applications/Gusset – Pattern Drafter.app"'), "the app's real name on a Mac");
  assert.ok(JSON.parse(read("website", "downloads.json")).schema === 1);
});

test("r28 / 7 the list of downloads: pre-releases count (GitHub's latest leaves them out), drafts never, in version order", () => {
  const M = require(path.join(ROOT, "scripts", "make-downloads.js"));
  const a = (name) => ({ name, browser_download_url: "https://example.test/" + name, size: 5, digest: "sha256:" + "ab".repeat(32) });
  const all = (v) => ["win-x64-setup.exe", "win-x64-portable.exe", "mac-arm64.dmg", "mac-arm64.zip", "linux-x86_64.AppImage"].map(s => a("Gusset-" + v + "-" + s))
    .concat(["SHA256SUMS.txt", "beta.yml", "beta-mac.yml", "downloads.json", "Gusset-" + v + "-win-x64-setup.exe.blockmap", "Gusset-" + v + "-mac-arm64.zip.blockmap"].map(a));
  const rel = (tag, prerelease, draft) => ({ tag_name: tag, prerelease: !!prerelease, draft: !!draft, published_at: "2026-11-01T00:00:00Z", assets: all(tag.slice(1)) });
  const list = (rs) => M.listOf(rs.map(r => M.fromApi(r, "o/r")));
  // only pre-releases: the newest is offered, and there is no final version
  let l = list([rel("v1.0.0-beta.2", true), rel("v1.0.0-beta.10", true), rel("v0.9.0-beta.4", true)]);
  assert.strictEqual(l.latest.version, "1.0.0-beta.10", "by version, not as text: beta.10 is after beta.2");
  assert.strictEqual(l.stable, null);
  assert.deepStrictEqual(l.latest.files.map(f => f.os + " " + f.kind + " " + f.arch), ["windows installer x64", "windows portable x64", "mac dmg arm64", "mac zip arm64", "linux appimage x64"], "only what a person downloads");
  assert.strictEqual(l.latest.files[0].sha256, "ab".repeat(32));
  assert.strictEqual(l.latest.source, "https://github.com/o/r/archive/refs/tags/v1.0.0-beta.10.zip");
  // a draft is not listed: its files cannot be fetched yet
  l = list([rel("v1.0.0-beta.1", true), rel("v1.0.0-beta.2", true, true)]);
  assert.strictEqual(l.latest.version, "1.0.0-beta.1");
  // a final version and a newer test version; a final version is after its own betas
  l = list([rel("v1.0.0", false), rel("v1.1.0-beta.1", true), rel("v1.0.0-rc.1", true)]);
  assert.strictEqual(l.latest.version, "1.1.0-beta.1"); assert.strictEqual(l.stable.version, "1.0.0");
  l = list([rel("v1.0.0-rc.1", true), rel("v1.0.0", false), rel("v1.0.0-beta.3", true)]);
  assert.strictEqual(l.latest.version, "1.0.0");
  // nothing out, or a release with no download: an empty list, which the page says in words
  assert.strictEqual(list([]).latest, null);
  assert.strictEqual(list([{ tag_name: "v1.0.0", assets: [a("notes.txt")] }]).latest, null);
  assert.strictEqual(list([{ tag_name: "not-a-version", assets: all("1.0.0") }]).latest, null);
  assert.strictEqual(M.compareVersions("1.0.0-beta.1", "1.0.0-beta.1"), 0);
  assert.ok(M.compareVersions("1.0.0-alpha.1", "1.0.0-beta.1") < 0);
  // the same releases, the same bytes: no commit when nothing changed
  assert.strictEqual(JSON.stringify(list([rel("v1.0.0-beta.1", true)])), JSON.stringify(list([rel("v1.0.0-beta.1", true)])));
});

test("r28 / 8 the list from a folder of builds, as the draft and the dry run make it", () => {
  const os = require("os"), M = require(path.join(ROOT, "scripts", "make-downloads.js"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdraft-r28-dl-"));
  try {
    for (const n of ["Gusset-1.0.0-beta.1-win-x64-setup.exe", "Gusset-1.0.0-beta.1-win-x64-setup.exe.blockmap", "beta.yml", "Gusset-1.0.0-beta.1-mac-arm64.dmg"]) fs.writeFileSync(path.join(dir, n), "xx");
    fs.writeFileSync(path.join(dir, "SHA256SUMS.txt"), "cd".repeat(32) + "  Gusset-1.0.0-beta.1-win-x64-setup.exe\n");
    const r = M.fromDist(dir, "1.0.0-beta.1", "o/r");
    assert.deepStrictEqual(r.files.map(f => f.kind), ["dmg", "installer"]);
    assert.strictEqual(r.prerelease, true); assert.strictEqual(r.tag, "v1.0.0-beta.1");
    const win = r.files.find(f => f.kind === "installer");
    assert.strictEqual(win.url, "https://github.com/o/r/releases/download/v1.0.0-beta.1/Gusset-1.0.0-beta.1-win-x64-setup.exe");
    assert.strictEqual(win.sha256, "cd".repeat(32)); assert.strictEqual(win.size, 2);
    assert.strictEqual(M.fromDist(dir, "1.0.0", "o/r").prerelease, false);
  } finally { fs.rmSync(dir, { recursive: true }); }
});

test("r28 / 9 the workflow: the list is written in the dry run and the tag's run, the site's job only in the public repository, the dry run makes nothing", () => {
  const wf = read(".github", "workflows", "release.yml");
  const rel = wf.slice(wf.indexOf("name: Create or update the draft release"), wf.indexOf("site-downloads:"));
  const made = rel.indexOf("node scripts/make-downloads.js --dist dist");
  assert.ok(made > 0 && made > rel.indexOf("SHA256SUMS.txt") && made < rel.indexOf('echo "Would make'), "after the checksums, before the dry run stops");
  assert.ok(rel.includes('if [ "$DRY" = true ]; then echo "Would make the draft release'), "the dry run still stops there, making nothing");
  // (beta.3 release fix: dry unless a tag was pushed, or attach was ticked in a run by hand from a tag)
  assert.ok(rel.includes("DRY: ${{ github.event_name != 'push' && !inputs.attach }}"), "dry unless a tag");
  // (Round PUB-1b, the maintainer's decision: a draft, which the maintainer publishes by hand)
  assert.ok(rel.includes('gh release create "$TAG" --draft --prerelease="$PRE"'), "a draft");
  assert.ok(!rel.includes("--draft=false"), "never published here");
  const job = wf.slice(wf.indexOf("  site-downloads:"));
  // (beta.3 release fix: or a release that is out already and got a missing system's files)
  assert.ok(job.includes("github.repository == 'fynndose/gusset-pattern-drafter' && (github.event_name == 'release' || needs.release.outputs.published == 'true')"), "on a release published by hand, only in the public repository");
  assert.ok(job.includes("--api ") && job.includes("--out website/downloads.json") && /gh api --paginate --slurp "repos\/\$GITHUB_REPOSITORY\/releases/.test(job), "from all the releases, never /releases/latest");
  assert.ok(!/releases\/latest/.test(wf), "never GitHub's latest");
  assert.ok(wf.includes("if: github.event_name != 'release' && (inputs.probe == '' || inputs.probe == null)"), "a published release builds nothing");
  // (beta.3 release fix: !cancelled(), so that a system whose build never ran does not stop the release)
  assert.ok(wf.includes("github.event_name != 'release' && (startsWith(github.ref, 'refs/tags/v')"), "a published release makes no pre-release");
  assert.ok(wf.includes("PDRAFT_UPDATE_SOURCE: ${{ inputs.update_source || vars.PDRAFT_UPDATE_SOURCE || 'https://gussetdrafter.com/updates/' }}"), "(Round r29d: the website's feed by default; Round PUB-1 had the public repository)");
  assert.ok(!/github:[a-z]/i.test(wf.split("github:<owner>/<repo>").join("").split("github:fynndose/gusset-pattern-drafter").join("")), "names no other repository");
});

test("r28 / 10 the workflow is valid YAML, its jobs as expected", () => {
  let yaml; try { yaml = require(path.join(ROOT, "desktop", "node_modules", "js-yaml")); } catch (e) { return; }      // (there after npm install in desktop/)
  const w = yaml.load(read(".github", "workflows", "release.yml"));
  // (beta.3 release fix: mac-arm64-check, the optional Apple-chip check, which nothing waits for)
  assert.deepStrictEqual(Object.keys(w.jobs), ["plan", "probe", "build", "mac-arm64-check", "release", "site-downloads"]);
  assert.deepStrictEqual(w.on.release.types, ["published"]);      // (Round PUB-1b, the maintainer's brief)
  assert.strictEqual(w.jobs["site-downloads"].permissions.contents, "write");
  assert.strictEqual(w.jobs.build.needs, "plan", "with no plan, no build");
});

test("r28 / 11 the release notes of this version exist where the workflow reads them, and say what a tester of an older build must do", () => {
  const v = require(path.join(ROOT, "drafter", "config.js")).version;
  assert.strictEqual(JSON.parse(read("desktop", "package.json")).version, v);
  const t = read("docs", "release-notes", v + ".md");
  assert.ok(t.includes("Re-read Grainlines from Original File"), "the note on grainlines imported by older builds");
  assert.ok(t.includes("xattr -cr") && t.includes("Run anyway"), "the first start");
  assert.ok(read(".github", "workflows", "release.yml").includes('NOTES="docs/release-notes/$V.md"'));
});

test("r28 / 12 the public documents are in American spelling (the GPL's own text and the fixed notice aside)", () => {
  for (const f of ["README.md", "CONTRIBUTING.md", "TRADEMARKS.md", "ATTRIBUTION.md", "docs/zprj-format.md", "drafter/vendor/README.md"]) {
    const m = /\b(colour|licence|organis|centre|neighbour|towards|grey\b)/i.exec(read(f));
    assert.ok(!m, f + ": " + (m && m[1]));
  }
  assert.ok(read("LICENSE").includes("The license's text follows, unchanged."));
});

test("r28 / 13 a build from a GitHub source writes its version's channel file, as the app and the release's check read it (no latest.yml for a beta)", () => {
  const b = read("desktop", "build.js"), U = require(path.join(ROOT, "desktop", "updates.js"));
  assert.ok(b.includes('"--config.publish.channel=" + channelOf('), "told the channel: electron-builder would write latest.yml");
  const m = /const channelOf = (\(v\) => \{.*?\});/.exec(b), mine = eval(m[1]);
  for (const v of ["1.0.0-beta.1", "1.0.0-rc.2", "1.0.0", "0.9.0-alpha.3"]) assert.strictEqual(mine(v), U.channelOf(v), v);
  assert.strictEqual(mine("1.0.0-beta.1"), "beta"); assert.strictEqual(mine("1.0.0"), "latest");
});

module.exports = T;
