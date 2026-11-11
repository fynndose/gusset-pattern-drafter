// Runs every *.test.js in this folder. No dependencies.   node drafter/tests/run.js
// With arguments, only the files whose names contain one of them:   node drafter/tests/run.js r11 keys
// The tiers (Round AUDIT-1):
//   --fast   the pre-commit tier (the git pre-commit hook, scripts/pre-commit.js; target under 2 minutes): every file but those
//            in SLOW, side by side, each in a process of its own
//   --full   the round's tier (`npm test`; target under 10 minutes): every file, the private ones too, side by side
//   --nobar  every test but the release-bar drapes, side by side: what --fast was until Round AUDIT-1, the release workflow's
//            tests on each build machine (.github/workflows/release.yml)
//   (none)   every file one after the other in this process, as before (the slowest way; a failing file's output in place)
// Side by side, the files start longest first (their times of the last side-by-side run, kept in the system's temp folder,
// gusset-test-times.json; a file never timed by its size), so a long file does not start last and hold up the end.
// The release tier is scripts/test-release.js (the full tier and every check a release needs). Each file's time is printed.
// A test is { name, fn }; fn may return a promise (the .zprj importer reads asynchronously), which is waited for.
"use strict";
const fs = require("fs");
const path = require("path");
const { syntaxCheck } = require("./harness");

let pass = 0, fail = 0;
const run = async (name, fn) => {
  const t0 = Date.now(), ms = () => process.env.PDRAFT_TEST_MS ? " [" + (Date.now() - t0) + " ms]" : "";
  try { await fn(); pass++; console.log("  ok   " + name + ms()); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e).toString().split("\n").slice(0, 3).join("\n       ")); }
};

// left out of the pre-commit tier: the release-bar drapes and the slowest simulation files (Round AUDIT-1's measure: together
// about a third of the whole run's time); the full tier runs them
const SLOW = ["bar.test.js"];
// and these tests of other files, by the start of their names (each took 9 s or more with the files side by side): stress files,
// solver drapes and avatar loads. The full tier runs them; the pre-commit tier runs the rest of their files
const SLOW_TESTS = ["BETA8-1 / PULL-1:", "perf-2 / 5:", "perf-2 / 3:", "POLISH-1 / A2:", "POLISH-1 / A3:", "r33b / 4:", "r33b / 1:", "G1 a page asks for nothing",
  "the avatar a document was left on", "r14 / 2:", "r14 / 5:", "h1a / 1:", "corrupted autosave:", "r11 / 1:", "r21 / 1, 2:", "r9 / 7 solver",
  "recshort / B6", "recshort / B5", "what a session left unsaved", "body measurements do not depend on Collision Detail",
  "r18 / 4: the Avatar Editor", "r18 / 6:", "build-1 / 3: Optimize All Curve Points", "r31 / 3:"];
const slowTest = (n) => SLOW_TESTS.some(p => n.startsWith(p));
const args = process.argv.slice(2), nobar = args.includes("--nobar"), full = args.includes("--full") || nobar, fast = args.includes("--fast") || full, one = args.indexOf("--file");
const only = args.filter((a, i) => !["--fast", "--full", "--nobar", "--file"].includes(a) && !(one >= 0 && i === one + 1));
const want = (f) => (!only.length || only.some(w => f.includes(w))) && !((fast && !full || nobar) && SLOW.includes(f));
let skipped = 0;
const timed = async (label, list) => { const t0 = Date.now(); console.log(label); for (const t of list) { if (fast && !full && slowTest(t.name)) { skipped++; continue; } await run(t.name, t.fn); } console.log("  (" + label + ": " + ((Date.now() - t0)/1000).toFixed(1) + " s)"); };
const summary = () => { console.log("\n" + pass + " passed, " + fail + " failed" + (fast && !full ? " (fast: " + SLOW.join(", ") + " and " + skipped + " slow tests left out)" : nobar ? " (" + SLOW.join(", ") + " left out)" : full ? " (full)" : "")); process.exit(fail ? 1 : 0); };

// one file only, as a worker of --fast: its tests and the count
if (one >= 0) (async () => { const f = args[one + 1]; await timed(path.relative(path.join(__dirname, "..", ".."), f).replace(/\\/g, "/").replace(/^drafter\/tests\//, ""), require(f)); summary(); })();
else (async () => {
  await run("app script parses", syntaxCheck);
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js") && want(f)).sort().map(f => path.join(__dirname, f));
  // tests on files that are not ours to release (other programs' project files): they live beside the project in a local
  // folder that is never released, and are run when that folder is there; a public copy says it left them out
  const priv = path.join(__dirname, "..", "..", "private", "tests");
  if (!fs.existsSync(priv)) console.log("  note: the tests on other programs' project files are left out: they and their files are not part of the public source");
  else files.push(...fs.readdirSync(priv).filter(f => f.endsWith(".test.js") && want(f)).sort().map(f => path.join(priv, f)));
  if (!fast) {
    for (const f of files) await timed(f.startsWith(priv) ? "local tests: " + path.basename(f) : path.basename(f), require(f));
    return summary();
  }
  // side by side: half the processors (the tests start child processes of their own); the output in file order
  const cp = require("child_process"), os = require("os"), width = +process.env.PDRAFT_TEST_JOBS || Math.max(2, Math.floor(os.cpus().length/2));
  const TIMES = path.join(os.tmpdir(), "gusset-test-times.json");
  let times = {}; try { times = JSON.parse(fs.readFileSync(TIMES, "utf8")); } catch (e) {}
  const guess = (f) => times[path.basename(f)] ?? fs.statSync(f).size / 2000;      // ms; about 2 bytes of test a millisecond
  const order = files.map((f, k) => k).sort((a, b) => guess(files[b]) - guess(files[a]));
  const outs = new Array(files.length), took = {};
  let next = 0, shown = 0;
  const show = () => { while (shown < files.length && outs[shown] !== undefined) process.stdout.write(outs[shown++]); };
  const worker = () => new Promise((done) => {
    if (next >= files.length) return done();
    const k = order[next++], t0 = Date.now();
    const ch = cp.spawn(process.execPath, [__filename, full ? "--full" : "--fast", "--file", files[k]], { cwd: process.cwd() });
    let text = "";
    ch.stdout.on("data", (d) => { text += d; }); ch.stderr.on("data", (d) => { text += d; });
    ch.on("close", (code) => {
      took[path.basename(files[k])] = Date.now() - t0;
      const m = /(\d+) passed, (\d+) failed/.exec(text);
      const sk = /and (\d+) slow tests left out/.exec(text); if (sk) skipped += +sk[1];
      if (m) { pass += +m[1]; fail += +m[2]; } else { fail++; text += "  FAIL " + path.basename(files[k]) + " did not finish (exit " + code + ")\n"; }
      outs[k] = text.replace(/\n\d+ passed, \d+ failed.*\n?$/, "\n"); show();
      worker().then(done);
    });
  });
  await Promise.all(Array.from({ length: width }, worker));
  try { fs.writeFileSync(TIMES, JSON.stringify({ ...times, ...took })); } catch (e) {}
  summary();
})();
