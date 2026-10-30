// Round perf-1: the performance marks behind the debug flag "perf" (perfInstall()). Off, nothing is wrapped; on, the
// functions are timed and counted, every call of a logged name is kept, and the program does what it did without them.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 60 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
const FLAG = { "pdraft:flags": JSON.stringify({ perf: true }) };
// the starter pattern: a point dragged with Edit Pattern, undone and redone; what the document is after each
const EDIT = `
  const p = S.pieces[0], q = app.toS(p.pts[1]);
  app.setTool("edit_pattern"); S.sel = [p.id]; app.draw();
  app.drag(q.x, q.y, q.x + 30, q.y + 20); app.fire("pointerup", { x: q.x + 30, y: q.y + 20 });
  const moved = JSON.stringify(p.pts[1]);
  app.undo(); const back = JSON.stringify(S.pieces[0].pts[1]);
  app.redo(); const again = JSON.stringify(S.pieces[0].pts[1]);
  app.ev("saveNow")();                                        // the autosave, as its timer would run it
`;

test("perf-1: without the flag nothing is wrapped and there is no drafterPerf()", () => {
  const o = boot({ performance: true, script: `return [app.ev("typeof window.drafterPerf"), app.ev("PERF.on"), app.ev("draw.name"), app.ev("cutLine.name")];` });
  assert.deepStrictEqual(o.result, ["undefined", false, "draw", "cutLine"]);
});

test("perf-1: with the flag the 2D window's frame, its parts and the document's steps are timed and counted; a logged name keeps every call", () => {
  const o = boot({ performance: true, storage: FLAG, script: `
    const P = app.ev("window.drafterPerf")();
    P.reset(); P.log(["draw", "cvMove"]); P.top(true); P.inEvent(true); P.inEvent(false);
    ${EDIT}
    const tops = P.top(false);
    const rep = Object.fromEntries(P.report().map(r => [r.name, r])), logs = P.logs();
    return { on: P.on, names: Object.keys(rep), draw: rep.draw, cut: rep["cutLine (seam allowance)"], seg: rep.segCurve, undo: rep.undo, commit: rep.commit,
      logged: [logs.draw.length, logs.cvMove.length], moved, back, again,
      after: (P.reset(), P.report().length), tops: [tops.length, tops.map(t => t[0]).filter((n, i, a) => a.indexOf(n) === i).sort().join(), tops.every(t => t.length === 4 && t[2] >= 0 && t[3] === 0)], again2: P.top(false).length };
  ` });
  const r = o.result;
  assert.strictEqual(r.on, true);
  for (const n of ["draw", "drawPiece", "cutLine (seam allowance)", "notchMarks (notches)", "hit (hit-testing)", "cvDown", "cvMove", "cvUp", "commit", "push", "undo", "redo", "saveNow (autosave)"])
    assert.ok(r.names.includes(n), n + " is measured: " + r.names.join(", "));
  assert.ok(r.draw.n >= 3 && r.draw.total > 0 && r.draw.self <= r.draw.total + 1e-9 && r.draw.max <= r.draw.total + 1e-9, JSON.stringify(r.draw));
  assert.ok(r.cut.n >= r.draw.n, "the seam allowance is made at least once a frame: " + JSON.stringify(r.cut));
  assert.ok(r.seg.n > 0 && r.seg.total === 0, "a hot helper is counted, not timed: " + JSON.stringify(r.seg));
  assert.strictEqual(r.undo.n, 1); assert.ok(r.commit.n >= 3);
  assert.strictEqual(r.logged[0], r.draw.n, "every outermost draw is logged once");
  assert.ok(r.logged[1] >= 1);
  assert.strictEqual(r.after, 0, "reset empties the report");
  // (Round perf-2) the outermost calls: the handlers and what the script called itself (undo, redo, the autosave), each once, none inside another
  assert.ok(/cvDown/.test(r.tops[1]) && /cvMove/.test(r.tops[1]) && /cvUp/.test(r.tops[1]) && /undo/.test(r.tops[1]) && !/drawPiece|cutLine/.test(r.tops[1]), r.tops[1]);
  assert.strictEqual(r.tops[2], true); assert.strictEqual(r.again2, 0, "switched off, nothing is kept");
  // the same edit without the marks gives the same document
  const plain = boot({ script: EDIT + "return { moved, back, again };" }).result;
  assert.deepStrictEqual([r.moved, r.back, r.again], [plain.moved, plain.back, plain.again]);
  assert.notStrictEqual(r.moved, r.back);
});

test("perf-1: with the flag but no performance.now() (an old page) nothing is wrapped", () => {
  const o = boot({ storage: FLAG, script: `return [app.ev("typeof window.drafterPerf"), app.ev("PERF.on")];` });
  assert.deepStrictEqual(o.result, ["undefined", false]);
});

test("perf-1: seamLanes() compares a part only with the parts on its own pattern and shape, and gives the very lanes it gave before", () => {
  const { load } = require("./harness");
  const { seamLanes, partsOverlap, seamParts } = load(["seamLanes", "partsOverlap", "seamParts"], {});
  // the lanes as they were made before Round perf-1: every part against every earlier part of the document
  const before = (seams) => {
    const lanes = new Map(), seen = [];
    for (const sm of seams) for (const part of seamParts(sm)) {
      const taken = new Set(seen.filter(q => partsOverlap(part, q)).map(q => lanes.get(q)));
      let n = 0;
      while (taken.has(n)) n++;
      lanes.set(part, n); seen.push(part);
    }
    return lanes;
  };
  // many seams on three patterns, each with its outline and two internal shapes, their parts on runs of the same few
  // segments, so that they overlap in layers (several lanes) within a shape and never across shapes
  let seed = 7;
  const rnd = () => (seed = (seed*1103515245 + 12345) % 2147483648)/2147483648;
  const part = () => { const s = Math.floor(rnd()*6), k = 1 + Math.floor(rnd()*3); return { piece: 1 + Math.floor(rnd()*3), shape: [0, 11, 12][Math.floor(rnd()*3)], sids: Array.from({ length: k }, (_, j) => 100 + (s + j) % 8), t0: +(rnd()*0.6).toFixed(2), t1: +(0.4 + rnd()*0.6).toFixed(2), rev: rnd() < 0.5 }; };
  const seams = Array.from({ length: 300 }, (_, id) => ({ id: id + 1, a: [part()], b: rnd() < 0.3 ? [part(), part()] : [part()] }));
  const A = before(seams), B = seamLanes(seams), all = seams.flatMap(seamParts);
  assert.deepStrictEqual(all.map(p => B.get(p)), all.map(p => A.get(p)));
  assert.ok(Math.max(...all.map(p => B.get(p))) >= 3, "the case has layers: lanes up to " + Math.max(...all.map(p => B.get(p))));
});

module.exports = T;
