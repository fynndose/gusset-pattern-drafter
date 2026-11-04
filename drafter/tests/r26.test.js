// Round r26: the fixes from the fourth check session.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null };
const G = load(["V", "cp", "sub", "add", "mul", "vlen", "dist", "clone", "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten", "signedArea", "lineX",
  "CORNERS", "cornerPts", "setCorner", "cornerOf", "cornerMirror", "cornerStart", "cornerLine1", "slantStart", "pocketFits", "cornerAngle", "num0", "ENV_D", "PERP_D", "POCKET_D", "SLANT_D", "PERP_SPIKE", "POCKET_MAX",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "addChild", "mkShape", "mkPiece"], { S });
const { V, cornerPts, cornerStart, cornerMirror, pocketFits, cornerAngle, mkShape, mkPiece } = G;

const test = (name, fn) => module.exports.push({ name, fn });
module.exports = [];
const dir = (deg) => V(Math.cos(deg*Math.PI/180), Math.sin(deg*Math.PI/180));
// the trapezium of corners-60-120.dxf, y down, clockwise on the screen, every line 10 mm
const C120 = { P: V(200, 0), uA: dir(0), uB: dir(60) }, C60 = { P: V(315.47, 200), uA: dir(60), uB: dir(180) };
// what cornerPts gives, as (along the top or bottom line, up) from the corner, the way the frames were measured
const pts = (c, corner) => cornerPts(c.P, c.uA, c.uB, 10, 10, 1, corner).map(q => [q.x - c.P.x, -(q.y - c.P.y)]);
const same = (got, want, tol, what) => {
  assert.strictEqual(got.length, want.length, what + ": " + JSON.stringify(got));
  got.forEach((q, k) => assert.ok(Math.abs(q[0] - want[k][0]) <= tol && Math.abs(q[1] - want[k][1]) <= tol, what + " point " + k + ": " + JSON.stringify(got)));
};

test("r26 / 1: a short Perpendicular is the reference's spike, one straight cut square to its line out to the other cut line (session 4 frames 071, 072)", () => {
  same(pts(C120, { t: "perp", on: "in", d: 2 }), [[2, 10], [2, 16.5]], 0.3, "Line 1 at 120");
  same(pts(C120, { t: "perp", on: "out", d: 2 }), [[13, 10], [7.5, 6.5]], 0.5, "Line 2 at 120");
});

test("r26 / 1: at the offered Distance nothing changed, and Perpendicular still matches the reference's frames on both corners, both lines", () => {
  same(pts(C120, { t: "perp", on: "in" }), [[11.5, 10], [11.5, 0]], 0.3, "Line 1 at 120");
  same(pts(C120, { t: "perp", on: "out" }), [[-5.7, 10], [3, 15]], 0.3, "Line 2 at 120");
  same(pts(C60, { t: "perp", on: "in" }), [[14.6, -5], [5.9, -10]], 0.3, "Line 1 at 60");
  same(pts(C60, { t: "perp", on: "out" }), [[11.6, 0], [11.6, -10]], 0.3, "Line 2 at 60");
  // the flip is exactly the offered Distance: just under it the spike is the offered cut
  const at = pts(C120, { t: "perp", on: "in", d: 11.547 }), under = pts(C120, { t: "perp", on: "in", d: 11.54 });
  assert.ok(Math.abs(at[0][0] - under[0][0]) < 0.01 && Math.abs(at[at.length - 1][1] - under[under.length - 1][1]) < 0.05, "no jump at the flip");
});

test("r26 / 1: square lines never meet: on a 90 degree corner a short Distance is the plain corner (session 3); a nearly square corner stops at the mitre (guess r26/2)", () => {
  const sq = cornerPts(V(0, 0), dir(0), dir(90), 10, 10, 1, { t: "perp", on: "in", d: 2 });
  assert.deepStrictEqual(sq, cornerPts(V(0, 0), dir(0), dir(90), 10, 10, 1), "as Extension");
  const near = cornerPts(V(0, 0), dir(0), dir(89.9), 10, 10, 1, { t: "perp", on: "in", d: 2 });
  assert.deepStrictEqual(near, cornerPts(V(0, 0), dir(0), dir(89.9), 10, 10, 1));
});

test("r26 / 1: Reverse Perpendicular was not recorded: its shape is as in Round r25", () => {
  const r = cornerPts(C120.P, C120.uA, C120.uB, 10, 10, 1, { t: "perp", on: "in", rev: true }).map(q => [q.x - 200, -q.y]);
  same(r, [[22.3, 10], [5, 0], [11.5, 0]], 0.1, "Reverse");
});

test("r26 / 1: Slant starts where the reference's does: 11.5 on 60 and 120 degrees at 10 mm, 10 on a square corner; with unequal allowances each is the other line's over the sine", () => {
  const trap = mkPiece("T", mkShape([V(0, 0), V(200, 0), V(315.47, 200), V(0, 200)], true)); for (const s of trap.segs) s.sa = 10;
  for (const i of [1, 2]) { const c = cornerStart(trap, i, "slant"); assert.ok(Math.abs(c.a - 11.547) < 0.01 && Math.abs(c.b - 11.547) < 0.01, JSON.stringify(c)); }
  assert.deepStrictEqual(cornerStart(trap, 0, "slant"), { a: 10, b: 10 }, "square");
  same(pts(C120, { t: "slant", ...cornerStart(trap, 1, "slant") }), [[-5.7, 10], [11.5, 0]], 0.3, "the frame's cut at 120");
  same(pts(C60, { t: "slant", ...cornerStart(trap, 2, "slant") }), [[11.5, 0], [5.8, -10]], 0.3, "the frame's cut at 60");
  const box = mkPiece("B", mkShape([V(0, 0), V(100, 0), V(100, 100), V(0, 100)], true));
  assert.deepStrictEqual(cornerStart(box, 1, "slant"), { a: 10, b: 10 }, "no allowance to go by");
  box.segs[0].sa = 30; box.segs[1].sa = 10; assert.deepStrictEqual(cornerStart(box, 1, "slant"), { a: 10, b: 30 });
  // a value already in a file is the file's: only the start changed
  assert.deepStrictEqual(pts(C120, { t: "slant", a: 10, b: 10 }).map(q => q.map(v => +v.toFixed(1))), [[-4.2, 10], [10.8, 1.3]]);
  assert.deepStrictEqual(cornerMirror({ t: "slant", a: 5, b: 15 }), { t: "slant", a: 15, b: 5 }, "mirrored, Line 1 is the other line");
});

test("r26 / 1: Pocket Style 1 measures along the lines (session 4 frame 066); on a square corner nothing changed; Style 2 is as it was", () => {
  same(pts(C60, { t: "pocket", st: 1, din: 5, dout: 5 }), [[14.2, -4.3], [7.4, -4.3], [10.6, -10]], 0.3, "the frame at 60");
  const sq = cornerPts(V(0, 0), dir(0), dir(90), 10, 10, 1, { t: "pocket", din: 5, dout: 3 }).map(q => [+q.x.toFixed(6), +q.y.toFixed(6)]);
  assert.deepStrictEqual(sq, [[3, -10], [3, -5], [10, -5]], "din from the incoming line, dout from the outgoing one, as before");
  same(pts(C60, { t: "pocket", st: 2, din: 5, dout: 5 }), [[14.4, -5], [8.7, -5], [3.7, -10]], 0.1, "Style 2");
  assert.strictEqual(cornerPts(V(0, 0), dir(0), dir(90), 10, 10, 1, { t: "pocket", din: 12, dout: 5 }).length, 1, "deeper than the allowance: the plain corner");
});

test("r26 / 1: Pocket is offered up to 90 degrees and greyed at 120 (guess r26/3)", () => {
  const trap = mkPiece("T", mkShape([V(0, 0), V(200, 0), V(315.47, 200), V(0, 200)], true));
  assert.ok(Math.abs(cornerAngle(trap, 1) - 120) < 0.01 && Math.abs(cornerAngle(trap, 2) - 60) < 0.01 && Math.abs(cornerAngle(trap, 0) - 90) < 0.01);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => pocketFits(trap, i)), [true, false, true, true]);
});

/* ---- batch 2 ---- */
const path = require("path"), fs = require("fs"), { spawnSync } = require("child_process");
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-r26-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}

test("r26 / 2: Simulation Shrinkage takes 1 to 1000 %, and a glue's Strength up to 100; its lower limit and Strength 0 as off stay", () => {
  const o = boot({ script: `
    const n = app.ev("normProps"), out = {};
    out.shrink = [[1, 1000], [0.5, 2000]].map(([w, p]) => n({ shrink3: { weft: w, warp: p } }).shrink3);
    const g0 = { id: 1, name: "G", kind: "area", a: S.pieces[0].id, b: 99, poly: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }], m: [1, 0, 0, 0, 1, 0] };
    out.glue = app.ev("normGlues")([{ ...g0, strength: 100 }, { ...g0, id: 2, strength: 500 }, { ...g0, id: 3, strength: 0.05 }, { ...g0, id: 4, strength: 0 }]).map(g => [g.off ?? false, g.strength ?? 1]);
    return out;` }).result;
  assert.deepStrictEqual(o.shrink, [{ weft: 1, warp: 1000 }, { weft: 1, warp: 1000 }]);
  assert.deepStrictEqual(o.glue, [[false, 100], [false, 100], [false, 0.1], [true, 0.1]]);
});

test("r26 / 2: the solver holds at the ends of the range: Weft 1 % and 1000 %, eased in, stay finite and go the right way", () => {
  const C = require("../drafter-sim.js");
  const pts = []; for (let i = 0; i < 30; i++) pts.push([i*10, 0]); for (let j = 0; j < 20; j++) pts.push([300, j*10]); for (let i = 0; i < 30; i++) pts.push([300 - i*10, 200]); for (let j = 0; j < 20; j++) pts.push([0, 200 - j*10]);
  const m = C.meshPolygon(pts, 20), n = m.xy.length/2, X = new Float32Array(3*n);
  for (let i = 0; i < n; i++) X.set([m.xy[2*i], 500, m.xy[2*i+1]], 3*i);
  const width = (weft) => {
    const s = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: X.slice(), shrink: { g: [0, 1], warp: 1, weft }, fab: { stretch: 3e5, bend: 30 } }], opt: { gravity: 0, ground: false, self: false } });
    for (let f = 0; f < 120; f++) C.clothStep(s, 1/60);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 3*n; i++) assert.ok(Number.isFinite(s.x[i]), "finite");
    for (let i = 0; i < n; i++) { lo = Math.min(lo, s.x[3*i]); hi = Math.max(hi, s.x[3*i]); }
    return hi - lo;
  };
  const small = width(0.01), big = width(10);
  assert.ok(small < 300*0.5, "1 %: drawn in: " + small); assert.ok(big > 300*5, "1000 %: grown: " + big);
});

test("r26 / 2: Flip Normal leaves a fold alone; a version 25 file's flipped pattern keeps its fold as it simulated, and no stored angle changes on opening", () => {
  const bytes = Array.from(fs.readFileSync(path.join(__dirname, "files", "v25", "flip-fold-glue-history.pdraft")));
  const o = boot({ blank: true, script: `
    const out = {}, f = app.ev("foldsOf");
    app.ev("openFile")("old.pdraft", new Uint8Array(${JSON.stringify(bytes)}));
    const A = S.pieces[0];
    out.old = [A.flip3, A.foldStay === undefined, A.internals[0].foldAngle, f(A)[0].a0];
    out.glue = [S.glues.length]; out.shrink = S.pieces[1].shrink3; out.corner = A.segs[2].corner;
    // every step of its history: the angle stored stays
    const u = S.undo.length; out.walk = [];
    for (let k = 0; k <= u; k++) { app.histGo(k); out.walk.push(S.pieces[0].internals[0].foldAngle ?? null); }
    app.histGo(u);
    // switched off and on with this build: the new way
    S.sel = [S.pieces[0].id]; app.ev("state3Toggle")("flip3"); const B = S.pieces[0]; out.off = [B.flip3 === undefined, B.foldStay === undefined, f(B)[0].a0];
    app.ev("state3Toggle")("flip3"); const C = S.pieces[0]; out.on = [C.flip3, C.foldStay, f(C)[0].a0, C.internals[0].foldAngle];
    let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
    const d = app.fileDoc(file); out.saved = [d.v, d.pieces[0].foldStay];
    app.ev("openFile")("new.pdraft", file, null, true); out.again = [S.pieces[0].foldStay, f(S.pieces[0])[0].a0];
    return out;` }).result;
  assert.deepStrictEqual(o.old, [true, true, 90, 270], "the fold still goes the way the file simulated it");
  assert.deepStrictEqual(o.walk.filter(a => a !== null).every(a => a === 90), true, "stored angles: " + o.walk);
  assert.deepStrictEqual(o.glue, [1]); assert.deepStrictEqual(o.shrink, { weft: 50, warp: 300 }); assert.deepStrictEqual(o.corner, { t: "slant", a: 10, b: 10 });
  assert.deepStrictEqual(o.off, [true, true, 90]); assert.deepStrictEqual(o.on, [true, true, 90, 90]);
  assert.deepStrictEqual(o.saved, [28, true]);      // (Round r30: 28; Round r29: 27)
  assert.deepStrictEqual(o.again, [true, 90]);
});

/* ---- batch 3 ---- */
test("r26 / 3 DXF: a pattern with a hole is written as the reference's own file: block flag, group 250 on every polyline, the outline's copies on 84 and 87, the hole on 11 and 86; read back it is one outline and one hole", () => {
  const o = boot({ script: `
    const R = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    const p = app.ev("mkPiece")("Hole test", app.ev("mkShape")(R(0, 0, 300, 200), true)), h = app.ev("mkShape")(R(100, 70, 100, 60), true);
    h.hole = true; app.ev("addChild")(p, "internals", h);
    const plain = app.ev("mkPiece")("Plain", app.ev("mkShape")(R(0, 0, 100, 100), true));
    const txt = app.ev("dxfExport")([p, plain], { format: "aama", metric: true }), L = txt.split(String.fromCharCode(10)), polys = [];
    for (let i = 0; i + 1 < L.length; i += 2) if (L[i] === "0" && L[i + 1] === "POLYLINE") { const g = {}; for (let j = i + 2; L[j] !== "0"; j += 2) g[L[j]] = L[j + 1]; polys.push([g["8"], g["70"], g["250"]]); }
    const blocks = []; for (let i = 0; i + 1 < L.length; i += 2) if (L[i] === "0" && L[i + 1] === "BLOCK") blocks.push([L[i + 3], L[i + 5], L[i + 7]]);
    const back = app.ev("dxfImport")(txt, {}).pieces;
    return { polys, blocks, back: back.map(q => [q.name, q.pts.length, q.segs.every(s => !s.sa), q.internals.map(it => [!!it.hole, it.closed, it.pts.length])]) };` }).result;
  assert.deepStrictEqual(o.polys, [["1", "1", "0"], ["14", "1", "2"], ["84", "1", "1"], ["87", "1", "2"], ["11", "1", "1"], ["86", "1", "1"], ["1", "1", null]], "the plain pattern has no group 250 and no copies");
  assert.deepStrictEqual(o.blocks, [["1", "Hole_test_1", "64"], ["0", "Plain_2", "0"]]);
  assert.deepStrictEqual(o.back, [["Hole test", 4, true, [[true, true, 4]]], ["Plain", 4, true, []]], "no allowance read from the seam line, one hole");
});
