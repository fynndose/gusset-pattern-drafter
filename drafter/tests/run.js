// Runs every *.test.js in this folder. No dependencies.   node drafter/tests/run.js
// With arguments, only the files whose names contain one of them:   node drafter/tests/run.js r11 keys
// --fast leaves out the files in SLOW and runs the files side by side, each in a process of its own (the git pre-commit
// hook runs that: scripts/pre-commit.js). Each file's time is printed.
// A test is { name, fn }; fn may return a promise (the .zprj importer reads asynchronously), which is waited for.
"use strict";
const fs = require("fs");
const path = require("path");
const { syntaxCheck } = require("./harness");

let pass = 0, fail = 0;
const run = async (name, fn) => {
  try { await fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e).toString().split("\n").slice(0, 3).join("\n       ")); }
};

// the release-bar drapes: a third of the whole run
const SLOW = ["bar.test.js"];
const args = process.argv.slice(2), fast = args.includes("--fast"), one = args.indexOf("--file");
const only = args.filter((a, i) => a !== "--fast" && a !== "--file" && !(one >= 0 && i === one + 1));
const want = (f) => (!only.length || only.some(w => f.includes(w))) && !(fast && SLOW.includes(f));
const timed = async (label, list) => { const t0 = Date.now(); console.log(label); for (const t of list) await run(t.name, t.fn); console.log("  (" + label + ": " + ((Date.now() - t0)/1000).toFixed(1) + " s)"); };
const summary = () => { console.log("\n" + pass + " passed, " + fail + " failed" + (fast ? " (fast: " + SLOW.join(", ") + " left out)" : "")); process.exit(fail ? 1 : 0); };

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
  const cp = require("child_process"), width = Math.max(2, Math.floor(require("os").cpus().length/2));
  const outs = new Array(files.length);
  let next = 0, shown = 0;
  const show = () => { while (shown < files.length && outs[shown] !== undefined) process.stdout.write(outs[shown++]); };
  const worker = () => new Promise((done) => {
    const k = next++;
    if (k >= files.length) return done();
    const ch = cp.spawn(process.execPath, [__filename, "--fast", "--file", files[k]], { cwd: process.cwd() });
    let text = "";
    ch.stdout.on("data", (d) => { text += d; }); ch.stderr.on("data", (d) => { text += d; });
    ch.on("close", (code) => {
      const m = /(\d+) passed, (\d+) failed/.exec(text);
      if (m) { pass += +m[1]; fail += +m[2]; } else { fail++; text += "  FAIL " + path.basename(files[k]) + " did not finish (exit " + code + ")\n"; }
      outs[k] = text.replace(/\n\d+ passed, \d+ failed.*\n?$/, "\n"); show();
      worker().then(done);
    });
  });
  await Promise.all(Array.from({ length: width }, worker));
  summary();
})();
