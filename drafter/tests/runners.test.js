// beta.3 release fix: the v1.0.0-beta.3 run failed twice because no Apple-chip Mac build machine was free. A release is never held up by one kind of
// build machine: both Mac apps are built on the Intel Mac (the Apple-chip one cross-built), a system whose build never ran is missing from the draft
// (its notes say so) and is added later by a run by hand from the tag with attach; a real failure still stops it.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const crypto = require("crypto"), fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const P = require(path.join(ROOT, "scripts", "release-parts.js"));

const T = [];
const test = (name, fn) => T.push({ name, fn });
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8").replace(/\r\n/g, "\n");
const V = "1.0.0-beta.3", ALL = ["win-x64-setup.exe", "win-x64-portable.exe", "mac-arm64.dmg", "mac-arm64.zip", "mac-x64.dmg", "mac-x64.zip", "linux-x86_64.AppImage"].map(s => "Gusset-" + V + "-" + s);
const tmp = (fn) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "pdraft-runners-")); try { return fn(d); } finally { fs.rmSync(d, { recursive: true, force: true }); } };
const node = (script, args) => spawnSync(process.execPath, [path.join(ROOT, "scripts", script), ...args], { encoding: "utf8" });

test("runners / 1 a system whose build never ran is missing, not a failure; a step that failed after Install stops the release, unless a later attempt built it; nothing built stops it", () => {
  assert.deepStrictEqual(P.runs(["gusset-win-x64", "gusset-linux-x64", "checks-win-x64", "checks-linux-x64"]), { built: ["linux-x64", "win-x64"], failed: [], ok: true }, "the Mac's machine never came: the release goes on");
  assert.deepStrictEqual(P.runs(["gusset-win-x64", "failed-mac-1", "gusset-linux-x64"]).ok, false, "a test failed on the Mac: no release");
  assert.deepStrictEqual(P.runs(["gusset-win-x64", "failed-mac-1", "gusset-mac", "gusset-linux-x64"]), { built: ["linux-x64", "mac", "win-x64"], failed: [], ok: true }, "re-run, and built the second time");
  assert.strictEqual(P.runs(["checks-win-x64", ""]).ok, false, "nothing to release");
  tmp((d) => {
    fs.writeFileSync(path.join(d, "a.txt"), "gusset-win-x64\nfailed-linux-x64-2\n");
    const r = node("release-parts.js", ["runs", path.join(d, "a.txt")]);
    assert.strictEqual(r.status, 1); assert.ok(/linux-x64: a test, a check or the build failed/.test(r.stdout), r.stdout);
  });
});

test("runners / 2 the notes name each system whose files are not all on the release, and nothing when all are", () => {
  const list = (names) => names.map(name => ({ name, size: 1 }));
  assert.strictEqual(P.missingText(list(ALL)), "");
  const noMac = P.missingText(list(ALL.filter(n => !/-mac-/.test(n))));
  assert.ok(noMac.startsWith("\n## Not in this release yet\n\n- Mac, Apple chip and Intel"), noMac);
  assert.ok(noMac.includes("It will be added to this release later") && !/Windows|Linux/.test(noMac), noMac);
  assert.deepStrictEqual(P.missing(list(ALL.filter(n => !/arm64\.zip$/.test(n)))).map(s => s.id), ["mac"], "one Mac file short is the Mac missing");
  assert.ok(/these[\s\S]*They will be added/.test(P.missingText(list(ALL.filter(n => /-mac-/.test(n))))), "two missing");
});

test("runners / 3 adding a system's files later: never over a file there, the checksums one list, the release's file list whole, the draft's list of downloads from it", () => tmp((d) => {
  const dist = path.join(d, "dist"); fs.mkdirSync(dist);
  const mac = ALL.filter(n => /-mac-/.test(n));
  for (const n of mac) fs.writeFileSync(path.join(dist, n), n);
  fs.writeFileSync(path.join(dist, "beta-mac.yml"), "x");
  const release = { isDraft: true, assets: ALL.filter(n => !/-mac-/.test(n)).concat(["beta.yml", "SHA256SUMS.txt", "downloads.json"]).map(name => ({ name, size: 5 })) };
  assert.deepStrictEqual(P.clash(release, dist), []);
  assert.deepStrictEqual(P.clash({ assets: [{ name: mac[0] }, { name: "SHA256SUMS.txt" }] }, dist), [mac[0]], "a file there already: refused (the two remade lists aside)");
  const all = P.assets(release, dist);
  assert.deepStrictEqual(all.map(a => a.name), ALL.concat(["beta.yml", "beta-mac.yml"]).sort(), "the old and the new, not the two remade lists");
  assert.strictEqual(all.find(a => a.name === mac[0]).size, mac[0].length);
  const h = (c) => c.repeat(64), old = path.join(d, "old.txt"), now = path.join(d, "new.txt");
  fs.writeFileSync(old, h("a") + "  " + ALL[0] + "\n" + h("b") + "  beta.yml\n");
  fs.writeFileSync(now, h("c") + "  " + mac[0] + "\n" + h("d") + "  beta.yml\n");
  assert.strictEqual(P.sums(old, now), [h("d") + "  beta.yml", h("c") + "  " + mac[0], h("a") + "  " + ALL[0]].sort((x, y) => (x.slice(66) < y.slice(66) ? -1 : 1)).join("\n") + "\n");
  assert.strictEqual(P.sums(path.join(d, "none.txt"), now).split("\n").length, 3, "no old list: the new one");
  fs.writeFileSync(path.join(d, "assets.json"), JSON.stringify(all));
  fs.writeFileSync(path.join(d, "SUMS.txt"), h("e") + "  " + mac[2] + "\n");
  const r = node("make-downloads.js", ["--assets", path.join(d, "assets.json"), "--sums", path.join(d, "SUMS.txt"), "--version", V, "--repo", "o/r", "--out", path.join(d, "dl.json")]);
  assert.strictEqual(r.status, 0, r.stderr);
  const l = JSON.parse(fs.readFileSync(path.join(d, "dl.json"), "utf8"));
  assert.strictEqual(l.latest.files.length, 7, "every download: the Mac's added");
  assert.strictEqual(l.latest.files.find(f => f.name === mac[2]).sha256, h("e"));
  assert.strictEqual(l.latest.files.find(f => f.name === mac[2]).url, "https://github.com/o/r/releases/download/v" + V + "/" + mac[2]);
}));

test("runners / 4 the update files check: every Mac zip named by the -mac.yml (beta.2's named the Intel one only, since its two Mac jobs each wrote one)", () => tmp((d) => {
  const zips = ["arm64", "x64"].map(a => "Gusset-" + V + "-mac-" + a + ".zip");
  const ent = (n) => { const b = Buffer.from(n); fs.writeFileSync(path.join(d, n), b); return "  - url: " + n + "\n    sha512: " + crypto.createHash("sha512").update(b).digest("base64") + "\n    size: " + b.length + "\n"; };
  const e = zips.map(ent);
  const yml = (ents) => "version: " + V + "\nfiles:\n" + ents.join("") + "path: " + zips[1] + "\nsha512: x\nreleaseDate: '2026-11-05T00:00:00.000Z'\n";
  fs.writeFileSync(path.join(d, "beta-mac.yml"), yml([e[1]]));
  let r = node("update-files-check.js", [d, V]);
  assert.strictEqual(r.status, 1); assert.ok(r.stdout.includes(zips[0] + " is not named by its channel file (beta-mac.yml)"), r.stdout);
  fs.writeFileSync(path.join(d, "beta-mac.yml"), yml(e));
  r = node("update-files-check.js", [d, V]);
  assert.strictEqual(r.status, 0, r.stdout);
}));

test("runners / 5 build.js builds several arches in one run: one channel file for both, each arch's unpacked app and its package check, unpacked.json the one this machine can start", () => {
  const b = read("desktop", "build.js");
  assert.ok(b.includes('.slice(7) || process.arch).split(",")'), "--arch=x64,arm64");
  assert.ok(b.includes('FOR[1] + " " + arches.map(a => "--" + a).join(" ") + " --publish never'), "one electron-builder run for every arch");
  assert.ok(b.includes('"unpacked-" + arch + ".json"') && b.includes('JSON.stringify(apps[process.arch] || apps[arches[0]], null, 1)'));
  assert.ok(/for \(const arch of arches\) \{\n  const chk = /.test(b), "the package check on each");
  const dirOf = eval("(SYSTEM, stage) => " + /const dirOf = \(arch\) => (path\.join\(stage, .*?\));/.exec(b)[1].replace(/^/, "(arch) => "));
  const at = (sys, arch) => path.basename(dirOf(sys, "S")(arch));
  assert.deepStrictEqual([at("mac", "x64"), at("mac", "arm64"), at("win", "x64"), at("win", "arm64"), at("linux", "x64"), at("linux", "arm64")],
    ["mac", "mac-arm64", "win-unpacked", "win-arm64-unpacked", "linux-unpacked", "linux-arm64-unpacked"], "as electron-builder names them");
});

test("runners / 6 the workflow: both Mac apps on the Intel Mac, the Apple-chip one checked without running it; nothing waits for the optional Apple-chip check", () => {
  let yaml; try { yaml = require(path.join(ROOT, "desktop", "node_modules", "js-yaml")); } catch (e) { return; }      // (there after npm install in desktop/)
  const wf = read(".github", "workflows", "release.yml"), w = yaml.load(wf), J = w.jobs;
  assert.ok(wf.includes('{ os: "macos-15-intel", name: "mac", arch: "x64,arm64", nogl: "1" }'));
  assert.ok(!/name: "mac-arm64"|name: "mac-x64"/.test(wf), "no Mac job of one arch: two such jobs each wrote beta-mac.yml");
  const step = (job, name) => J[job].steps.find(s => s.name === name);
  assert.strictEqual(step("build", "Build (and the package check on what the app holds)").run, "node desktop/build.js ${BUILD_ARCH:+--arch=$BUILD_ARCH}");
  const arm = step("build", "The Apple-chip app, checked without running it");
  assert.strictEqual(arm.if, "matrix.name == 'mac'");
  for (const s of ["lipo -archs", "codesign --verify --deep", "hdiutil verify", "unzip -tq", "q < 0.75 || q > 1.25"]) assert.ok(arm.run.includes(s), s);
  assert.deepStrictEqual(J["mac-arm64-check"].needs, ["plan", "build"]);
  assert.strictEqual(J["mac-arm64-check"].if, "${{ !cancelled() && needs.plan.outputs.armcheck == 'true' }}");
  assert.ok(J["mac-arm64-check"].steps.some(s => /ditto -x -k dist\/\*-mac-arm64\.zip/.test(s.run || "")), "the very zip the release carries");
  assert.ok(J["mac-arm64-check"].steps.some(s => /start-built\.js/.test(s.run || "")), "started on an Apple chip");
  assert.deepStrictEqual(J.release.needs, ["plan", "build"], "the release never waits for the optional check");
  assert.strictEqual(J["site-downloads"].needs, "release");
});

test("runners / 7 the workflow: a build that never ran does not stop the release, a real failure does; a run by hand from a tag with attach adds files to its release without writing over any", () => {
  let yaml; try { yaml = require(path.join(ROOT, "desktop", "node_modules", "js-yaml")); } catch (e) { return; }
  const w = yaml.load(read(".github", "workflows", "release.yml")), J = w.jobs;
  assert.ok(J.release.if.startsWith("${{ !cancelled() && needs.plan.result == 'success'"), "the release runs though a build failed (not when the run was cancelled)");
  assert.strictEqual(J.build.strategy["fail-fast"], false);
  const marks = J.build.steps.filter(s => /^failure\(\)/.test(s.if || ""));
  assert.strictEqual(marks.length, 2);
  for (const s of marks) assert.strictEqual(s.if, "failure() && steps.install.outcome == 'success'", "no machine, no network: no mark");
  assert.strictEqual(marks[1].with.name, "failed-${{ matrix.name }}-${{ github.run_attempt }}");
  assert.ok(J.build.steps.findIndex(s => s.id === "install") < J.build.steps.findIndex(s => /^Unit tests/.test(s.name || "")));
  const gate = J.release.steps.find(s => /Which systems were built/.test(s.name || ""));
  assert.ok(gate.run.includes("node scripts/release-parts.js runs"));
  assert.strictEqual(J.release.permissions.actions, "read");
  assert.strictEqual(w.on.workflow_dispatch.inputs.attach.type, "boolean");
  assert.strictEqual(w.on.workflow_dispatch.inputs.attach.default, false);
  const r = J.release.steps.find(s => s.id === "r");
  assert.strictEqual(r.env.ATTACH, "${{ github.event_name == 'workflow_dispatch' && inputs.attach == true }}");
  assert.ok(r.run.indexOf('[ "$GITHUB_REF_TYPE" != tag ]') < r.run.indexOf('V="${TAG#v}"'), "attach only from a tag, before anything");
  assert.ok(r.run.includes('node scripts/release-parts.js clash "$RUNNER_TEMP/release.json" dist'));
  const add = r.run.slice(r.run.indexOf('if [ "$ATTACH" = true ]; then\n  gh release upload'));
  const up = add.split("\n")[1].split("#")[0].trim();      // (the command, not its comment)
  assert.strictEqual(up, 'gh release upload "$TAG" $(for f in $NEW; do echo "dist/$f"; done)', "the built files without --clobber");
  assert.ok(add.includes("gh release upload \"$TAG\" dist/SHA256SUMS.txt dist/downloads.json --clobber"), "the two lists made again");
  assert.ok(add.includes('echo "published=true" >> "$GITHUB_OUTPUT"'), "out already: the website's list and the feed again");
  assert.ok(r.run.includes('node scripts/release-parts.js missing "$RUNNER_TEMP/assets.json"'), "the notes say what is missing");
  assert.ok(!r.run.includes("--draft=false") && !/gh release edit[^\n]*--draft/.test(r.run), "never published here");
});

test("runners / 8 a Mac whose file is missing: the feed keeps the newest release that has it, a Mac copy never downloads (it opens the download page), and the download page says there is no Mac version", () => {
  const F = require(path.join(ROOT, "scripts", "make-update-feed.js")), U = require(path.join(ROOT, "desktop", "updates.js")), D = require(path.join(ROOT, "website", "assets", "download.js"));
  const R = "https://github.com/o/r/releases/download/";
  const rel = (tag, names) => ({ tag_name: tag, prerelease: true, draft: false, assets: names.map(name => ({ name, browser_download_url: R + tag + "/" + name })) });
  const plan = F.feedPlan([rel("v1.0.0-beta.2", ["beta.yml", "beta-mac.yml", "beta-linux.yml"]), rel("v1.0.0-beta.3", ["beta.yml", "beta-linux.yml"])]);
  assert.deepStrictEqual(plan.map(p => p.name + " " + p.tag), ["beta-linux.yml v1.0.0-beta.3", "beta-mac.yml v1.0.0-beta.2", "beta.yml v1.0.0-beta.3"], "a Mac is offered nothing it cannot get");
  assert.strictEqual(U.kindOf({ isPackaged: true }, {}, "darwin"), "mac");
  assert.ok(!U.INSTALLS.includes("mac"), "a Mac is told and opens the page: electron-updater's arch choice (at download) never runs");
  const dl = { version: V, files: ALL.filter(n => !/-mac-/.test(n)).map(name => ({ os: /win/.test(name) ? "windows" : "linux", kind: /setup/.test(name) ? "installer" : /portable/.test(name) ? "portable" : "appimage", arch: "x64", name, url: "u", size: 1 })) };
  assert.deepStrictEqual(D.filesFor(dl, "mac"), []); assert.deepStrictEqual(D.buttonsFor(dl, "mac"), []);
  assert.ok(read("website", "assets", "download.js").includes('"There is no " + SYSTEMS[os] + " version of this release.'), "said in words, the table below");
});

module.exports = T;
