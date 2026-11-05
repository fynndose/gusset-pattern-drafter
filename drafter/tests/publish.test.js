// Round PUB-1: what freezes with the first public release, the update source's default, and the workflow's release path.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const T = [], test = (name, fn) => T.push({ name, fn });
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const lf = (s) => s.replace(/\r\n/g, "\n");

test("pub / 1 the app id, the data folder and the file extension are frozen: changing one strands every installed copy", () => {
  const P = JSON.parse(read("desktop", "package.json"));
  assert.strictEqual(P.build.appId, "com.gussetdrafter.gusset-pattern-drafter");
  assert.strictEqual(P.dataFolder, "Gusset");
  assert.strictEqual(P.name, "gusset");
  assert.ok(P.build.fileAssociations.some(a => [].concat(a.ext).includes("pdraft")));
  assert.ok(/setPath\("userData"/.test(read("desktop", "main.js")), "set before anything reads it");
});

test("pub / 1b the program names no other program: About has no such notice, the import is named by its file types (Round PUB-1b)", () => {
  const app = read("drafter", "pattern-drafter.js");
  assert.ok(app.includes('{ n: "Import .zprj / .zpac…", f: zprjOpen }'));
  assert.ok(!/trademark of/i.test(app));
  for (const f of ["drafter/pattern-drafter.js", "drafter/zprj-import.js", "docs/zprj-format.md", "README.md", "website/features.html", "website/index.html"]) assert.ok(!/\bclo\b/i.test(read(f)), f);
  assert.ok(read("website", "features.html").includes("project files"));
});

test("pub / 2 Electron is at or above the version with the certificate-trust fix (44.10)", () => {
  const v = /(\d+)\.(\d+)\.(\d+)/.exec(JSON.parse(read("desktop", "package.json")).devDependencies.electron);
  assert.ok(+v[1] > 44 || (+v[1] === 44 && +v[2] >= 10), v[0]);
});

test("pub / 3 the update source: the public repository by default, an override, none for a test build unless told", () => {
  const b = lf(read("desktop", "build.js"));
  const m = /const DEFAULT_SOURCE = "([^"]+)", asked = String\(process\.env\.PDRAFT_UPDATE_SOURCE \|\| ""\)\.trim\(\);\nconst src = (.*?), gh =/.exec(b);
  assert.ok(m, "as written in build.js");
  assert.strictEqual(m[1], "https://gussetdrafter.com/updates/");      // (Round r29d: the website's feed, which only published releases reach; it was the public repository)
  const src = (asked, name) => { const DEFAULT_SOURCE = m[1], process = { env: { PDRAFT_BUILD_NAME: name } }; return eval(m[2]); };
  assert.strictEqual(src("", undefined), m[1]);
  assert.strictEqual(src("github:a/b", undefined), "github:a/b");
  assert.strictEqual(src("none", undefined), "");
  assert.strictEqual(src("", "Gusset Update Test"), "");
  assert.strictEqual(src("http://127.0.0.1:47821/", "Gusset Update Test"), "http://127.0.0.1:47821/");
  const U = require(path.join(ROOT, "desktop", "updates.js"));
  const fed = U.sourceOf({ updateSource: m[1] }, {});
  assert.deepStrictEqual(fed, { provider: "generic", url: m[1] });
});

test("pub / 4 the release path: a tag builds every system and makes a draft, the job that checks the channel files can see the source, the version must match, the list follows the maintainer's publishing", () => {
  const wf = lf(read(".github", "workflows", "release.yml"));
  assert.ok(wf.indexOf("\nenv:\n  PDRAFT_UPDATE_SOURCE:") > 0 && wf.indexOf("\nenv:\n  PDRAFT_UPDATE_SOURCE:") < wf.indexOf("\njobs:"), "for the whole workflow: the release job read an empty variable while it was set on the build job alone");
  // (beta.3 release fix: both Mac apps are built by one job on the Intel Mac, the Apple-chip one cross-built, since no Apple-chip machine came for
  // the v1.0.0-beta.3 run; the Apple-chip machine only runs the optional check, which in a private repository runs only when named)
  for (const os of ['name: "win-x64"', 'name: "mac", arch: "x64,arm64"', 'name: "linux-x64"']) assert.ok(wf.includes(os), os);
  assert.ok(wf.includes('want.includes("mac-arm64-check") || process.env.PRIVATE_REPO !== "true"'), "the optional Apple-chip check counts ten times only in a private repository");
  assert.ok(wf.includes('elif [ "$V" != "$CONFIG" ]; then echo "The tag says'), "a tag that is not the program's version stops");
  // (Round PUB-1b, the maintainer's decision: a draft, published by hand; that starts the job that writes the list)
  assert.ok(wf.includes('gh release create "$TAG" --draft '), "a tag makes a draft");
  assert.ok(!wf.includes("--draft=false"), "the workflow never publishes");
  assert.ok(wf.includes("types: [published]"), "published by hand starts the list");
  // (beta.3 release fix: also after a missing system's files were added to a release that is out already)
  assert.ok(wf.includes("if: ${{ !cancelled() && github.repository == 'fynndose/gusset-pattern-drafter' && (github.event_name == 'release' || needs.release.outputs.published == 'true') }}"), "on that event, in the public repository only");
  assert.ok(/--sums "\$RUNNER_TEMP\/SHA256SUMS\.txt"/.test(wf), "with every checksum");
  assert.ok(/git push/.test(wf.slice(wf.indexOf("  site-downloads:"))));
  // (beta.3 release fix: by hand is a dry run even when started from a tag, unless attach is ticked; before, a run by hand from a tag made or edited the release)
  assert.ok(wf.includes("DRY: ${{ github.event_name != 'push' && !inputs.attach }}"), "by hand: a dry run");
});

test("pub / 5 the list of downloads gives each version, each file's address, size and checksum", () => {
  const cp = require("child_process"), os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdraft-pub-dl-"));
  try {
    const name = "Gusset-1.0.0-beta.1-win-x64-setup.exe", sum = "ef".repeat(32);
    fs.writeFileSync(path.join(dir, "r.json"), JSON.stringify([[{ tag_name: "v1.0.0-beta.1", prerelease: true, published_at: "2026-11-01T00:00:00Z", assets: [{ name, browser_download_url: "https://example.test/" + name, size: 7 }] }]]));
    fs.writeFileSync(path.join(dir, "SHA256SUMS.txt"), sum + "  " + name + "\n");
    cp.execFileSync(process.execPath, [path.join(ROOT, "scripts", "make-downloads.js"), "--api", path.join(dir, "r.json"), "--sums", path.join(dir, "SHA256SUMS.txt"), "--repo", "o/r", "--out", path.join(dir, "o.json")], { stdio: "pipe" });
    const l = JSON.parse(fs.readFileSync(path.join(dir, "o.json"), "utf8"));
    assert.strictEqual(l.latest.version, "1.0.0-beta.1");
    assert.deepStrictEqual(l.latest.files[0], { os: "windows", kind: "installer", arch: "x64", name, url: "https://example.test/" + name, size: 7, sha256: sum });
  } finally { fs.rmSync(dir, { recursive: true }); }
});

test("pub / 6 the README: what it is, the website, how to build, the license and the trademark note, the address, and no other program's name", () => {
  const r = read("README.md");
  for (const w of ["https://gussetdrafter.com", "npm run dist", "GNU General Public License", "TRADEMARKS.md", "contact@gussetdrafter.com", "Screenshots will go here"]) assert.ok(r.includes(w), w);
  assert.ok(!/\bCLO\b/.test(r));
});

test("pub / 7 the website: its pages, the brand, the unsigned-app help, what Send Feedback sends, a stub for the legal text, GitHub only as the footer's link", () => {
  const css = read("website", "assets", "site.css");
  for (const c of ["#E8412F", "#FAFAF7", "#1F1F1F", "Chakra Petch"]) assert.ok(css.includes(c), c);
  assert.ok(!/fonts\.g|googleapis|https?:\/\//.test(css), "nothing fetched from elsewhere");
  for (const w of [400, 500, 600, 700]) assert.ok(fs.existsSync(path.join(ROOT, "website", "assets", "fonts", "chakra-petch-latin-" + w + "-normal.woff2")), w);
  assert.ok(/SIL Open Font License/.test(read("website", "assets", "fonts", "OFL.txt")));
  const pages = fs.readdirSync(path.join(ROOT, "website")).filter(f => f.endsWith(".html"));
  assert.deepStrictEqual(pages.sort(), ["404.html", "contact.html", "download.html", "features.html", "help.html", "index.html", "legal.html", "privacy.html", "try.html"]);
  for (const n of pages) {
    const t = read("website", n);
    assert.ok(t.includes("gusset-mark.svg") && t.includes("gusset-wordmark-white.svg"), n + ": the mark and the wordmark");
    assert.ok(/<footer[\s\S]*Source code on GitHub/.test(t), n + ": the source code, in the footer");
    assert.ok(!/href="[^"]*github/i.test(t.slice(0, t.indexOf("<footer"))), n + ": no link to GitHub above the footer");
    assert.ok(!/<script src="https?:|<link[^>]+href="https?:/.test(t), n + ": no script or style from elsewhere");
  }
  const help = read("website", "help.html");
  for (const w of ["More info", "Run anyway", "Open Anyway", "xattr -cr", "chmod +x", "--no-sandbox"]) assert.ok(help.includes(w), w);
  const priv = read("website", "privacy.html");
  for (const w of ["no analytics", "Send Feedback", "update check", "It holds no pattern"]) assert.ok(priv.includes(w), w);
  const legal = read("website", "legal.html");
  assert.ok(legal.includes("TODO") && legal.includes("noindex") && /has not been written yet/.test(legal), "a stub, with no text made up");
  const dl = read("website", "assets", "download.js");
  assert.ok(dl.includes('el("foot-source")'), "this version's source code, from the footer");
});

module.exports = T;
