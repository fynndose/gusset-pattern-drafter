// Round REC-SHORT: what the sixth check session (RECORD-SHORT, the maintainer's video of 9 Nov) showed, built where it differs.
// Each sub-step its own tests: B/2 the corner shapes, B/4 Turned, B/5 a section's fabric in the simulation, B/6 the pull; C the
// leftovers (Superimpose's gap, the seam preview).
"use strict";
const FV = require("./harness").FILE_VERSION;      // this build's file version, read from the app's FILE_VERSION
const { load } = require("./harness");
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-recshort-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const nearPt = (q, x, y, tol, msg) => { near(q.x, x, tol, (msg || "") + " x"); near(q.y, y, tol, (msg || "") + " y"); };

/* ---------- B/2: the corner shapes, against session 6's frames (corners-60-120.dxf, 10 mm, mm from the corner, y up) ---------- */
const CP = load(["cornerPts", "pocketStyle", "V", "add", "sub", "mul", "dist", "lineX", "vlen", "reflectAcross", "cornerOf", "cornerMirror", "setCorner"], {});
const S3 = Math.sqrt(3)/2, O = CP.V(0, 0);
// the 60° corner: Line 1 the slanted line coming down into it, Line 2 the bottom line leaving to the left; the 120° corner: Line 1 the
// top line coming in, Line 2 the slanted line leaving down to the right. y up, so the outline's wind is -1 for the outside
const at60 = (c) => CP.cornerPts(O, CP.V(0.5, -S3), CP.V(-1, 0), 10, 10, -1, c), at120 = (c) => CP.cornerPts(O, CP.V(1, 0), CP.V(0.5, -S3), 10, 10, -1, c);
const TOL = 0.6;      // the frames' reading: ±0.4 mm, and 0.5 mm in x for the corner dot's centre (session6-notes.md)

test("recshort / B2 Pocket Style 2 on 60°: the zigzag of the frame at 193 s (a1 square off the corner, across the bottom line, mirrored, in to the bottom cut line)", () => {
  const q = at60({ t: "pocket", st: 2 });
  assert.strictEqual(q.length, 4);
  nearPt(q[0], 8.7, 5, TOL, "on Line 1's cut line, square off the corner"); nearPt(q[1], 5.8, 0, TOL, "on the bottom line carried on");
  nearPt(q[2], 8.7, -5, TOL, "mirrored in it"); nearPt(q[3], 5.8, -10, TOL, "on the bottom cut line");
});
test("recshort / B2 Pocket Style 3 on 60°: the frame at 196 s (from where Line 1's cut line meets the bottom line, mirrored in to a level step 6 mm out, along Line 1 carried on to the bottom cut line)", () => {
  const q = at60({ t: "pocket", st: 3 });
  assert.strictEqual(q.length, 4);
  nearPt(q[0], 11.5, 0, TOL); nearPt(q[1], 8.2, -6, TOL); nearPt(q[2], 3.5, -6, TOL); nearPt(q[3], 5.8, -10, TOL);
});
test("recshort / B2 Envelope 4 on 60° and 120° (frames 014, 015): each cut line stops 4 mm back along its own seam line, the cut bends in to 4 mm out on the corner's middle", () => {
  const a = at60({ t: "env", d: 4 }), b = at120({ t: "env", d: 4 });
  nearPt(a[0], 6.7, 8.5, TOL, "60°, Line 1"); nearPt(a[1], 3.5, -2, TOL, "60°, the middle"); nearPt(a[2], -4, -10, TOL, "60°, Line 2");
  nearPt(b[0], -4.2, 10, TOL, "120°, Line 1"); nearPt(b[2], 10.8, 1.4, TOL, "120°, Line 2");
  near(Math.hypot(b[1].x, b[1].y), 4, 1e-9, "120°: the bend 4 from the corner (under the frame's label)");
});
test("recshort / B2 Round on 60° and 120° (172 s): an arc tangent to both cut lines, one allowance back from where they meet", () => {
  const a = at60({ t: "round" }), b = at120({ t: "round" });
  nearPt(b[0], -4.2, 10, TOL, "120°: leaves the top cut line 4.2 mm before the corner's vertical");
  nearPt(a[a.length - 1], 7.2, -10, TOL, "60°: meets the bottom cut line about 7 mm past the corner");
  for (const arc of [a, b]) {      // one circle: every point the same distance from one centre
    const m = arc[Math.floor(arc.length/2)], c0 = arc[0], c1 = arc[arc.length - 1];
    const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    assert.ok(d(c0, m) > 1 && d(c1, m) > 1, "a real arc");
  }
});
test("recshort / B2 Styles 2 and 3 are kept (setCorner), have no rows, and a mirror image builds them from its other line", () => {
  const seg = {};
  CP.setCorner(seg, "pocket", { st: 3, din: 5, dout: 5 }); assert.deepStrictEqual(seg.corner, { t: "pocket", st: 3, din: 5, dout: 5 });
  CP.setCorner(seg, "pocket", { st: 2, on: "out" }); assert.deepStrictEqual(seg.corner, { t: "pocket", st: 2, on: "out" });
  CP.setCorner(seg, "pocket", { st: 1, on: "out" }); assert.deepStrictEqual(seg.corner, { t: "pocket", st: 1 }, "Style 1 has no line");
  assert.deepStrictEqual(CP.cornerMirror({ t: "pocket", st: 3 }), { t: "pocket", st: 3, din: undefined, dout: undefined, on: "out" });
  assert.deepStrictEqual(CP.cornerMirror({ t: "pocket", st: 3, on: "out" }), { t: "pocket", st: 3, din: undefined, dout: undefined });
  // built from Line 2 it is Line 1's shape mirrored across the corner: on the 60° corner, from the bottom line's side
  const q = at60({ t: "pocket", st: 2, on: "out" });
  assert.strictEqual(q.length, 4); near(q[3].y, -10, 1e-9, "it still ends on the bottom cut line");
  const o = boot({ script: `
    const html = app.ev("cornerPropsHTML");
    S.pieces.length = 0;
    const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:400,y:0},{x:400,y:200},{x:0,y:200}], true));
    for (const s of A.segs) s.sa = 10; S.pieces.push(A); app.commit();
    const rows = (st) => { app.ev("setCorner")(A.segs[1], "pocket", { st, din: 5, dout: 5 }); const h = html(A, 1, ""); return [/value="3"( selected)?>Style 3/.test(h), /Distance A/.test(h), (h.match(/<option value="([0-9])" selected/) || [])[1]]; };
    return { s1: rows(1), s2: rows(2), s3: rows(3) };` }).result;
  assert.deepStrictEqual(o, { s1: [true, true, "1"], s2: [true, false, "2"], s3: [true, false, "3"] }, "Style 3 offered; Distance A / B only for Style 1; the style picked shows");
});

/* ---------- B/4: Turned folds nothing (session 6, 05:34-08:24, frames 037, 038) ---------- */
const SF = load(["seamFold", "seamFoldOf", "FOLD_K", "FOLD_STRENGTH"], {});
test("recshort / B4 a Turned seam gives the solver no fold, whatever its Fold Angle (greyed while Turned is on); off, the angle folds as before", () => {
  assert.strictEqual(SF.seamFold({ turned: true }), null, "Turned: flat and open, no fold");
  assert.strictEqual(SF.seamFold({ turned: true, foldAngle: 90, foldStrength: 40 }), null, "the greyed rows do nothing");
  assert.deepStrictEqual(SF.seamFold({ foldAngle: 90 }), { a: 90, k: SF.FOLD_K*SF.FOLD_STRENGTH }, "not Turned: the Fold Angle as before");
  assert.strictEqual(SF.seamFold({}), null, "180: flat");
  const o = boot({ script: `
    S.pieces.length = 0; S.seams.length = 0;
    const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:400,y:0},{x:400,y:200},{x:0,y:200}], true)), B = app.mkPiece("B", app.mkShape([{x:0,y:260},{x:400,y:260},{x:400,y:460},{x:0,y:460}], true));
    S.pieces.push(A, B); S.seams.push({ id: "t", a: [{ piece: A.id, shape: 0, sids: [A.segs[2].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[0].id], t0: 0, t1: 1, rev: true }], turned: true, foldAngle: 90 }); app.commit();
    return { folds: S.seams.map(s => app.ev("seamFold")(s)), kept: [S.seams[0].turned, S.seams[0].foldAngle] };` }).result;
  assert.deepStrictEqual(o.folds, [null], "the solver's seam has no fold");
  assert.deepStrictEqual(o.kept, [true, 90], "the seam keeps its rows (greyed), as a file holds them");
});

/* ---------- B/5: a section's fabric simulates (session 6, 12:57) ---------- */
const C = require("../drafter-sim.js");
function hangStrip(zones) {
  const W = 200, H = 400, res = 10, pts = [];
  for (let i = 0; i < 20; i++) pts.push([i*10, 0]); for (let j = 0; j < 40; j++) pts.push([W, j*10]);
  for (let i = 0; i < 20; i++) pts.push([W - i*10, H]); for (let j = 0; j < 40; j++) pts.push([0, H - j*10]);
  const m = C.meshPolygon(pts, res), n = m.xy.length/2, X = new Float32Array(3*n);
  for (let i = 0; i < n; i++) X.set([m.xy[2*i], 1500 - m.xy[2*i+1], 0], 3*i);
  const FAB = { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 2.5, maxStretch: 0.08 };
  const zt = zones ? Array.from({ length: m.tri.length/3 }, (_, k) => { const y = (m.xy[2*m.tri[3*k]+1] + m.xy[2*m.tri[3*k+1]+1] + m.xy[2*m.tri[3*k+2]+1])/3; return y > H/2 ? 0 : -1; }) : null;
  const pins = []; for (let i = 0; i < n; i++) if (m.xy[2*i+1] < 1e-6) pins.push({ p: 0, v: i });
  const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: FAB, ...(zt ? { zones: { t: zt, fabs: [{ ...FAB, weight: 600, stretch: 2e3, maxStretch: 0.6 }] } } : {}) }], seams: [], pins, opt: { self: false, ground: false } });
  for (let k = 0; k < 400; k++) C.clothStep(sim, 1/60);
  let low = Infinity, mass = 0; for (let i = 0; i < sim.n; i++) { low = Math.min(low, sim.x[3*i+1]); mass += sim.mass[i]; }
  return { drop: 1500 - low, mass };
}
test("recshort / B5 the solver: a strip hung by its top edge whose lower section is a heavy, stretchy fabric hangs longer and weighs more than the same strip in one fabric", () => {
  const one = hangStrip(false), two = hangStrip(true);
  assert.ok(two.mass > 2*one.mass, "the lower half's weight: " + JSON.stringify({ one, two }));
  assert.ok(two.drop > one.drop + 10, "the stretchy section stretches (17.7 mm more when written): " + JSON.stringify({ one, two }));
});
test("recshort / B5 the app: each triangle whose middle lies in a section with a fabric gets that fabric (sectionZones), the rest the pattern's; none without a section's fabric", () => {
  const o = boot({ script: `
    S.pieces.length = 0; S.seams.length = 0;
    const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:400,y:0},{x:400,y:200},{x:0,y:200}], true));
    S.pieces.push(A); app.commit();
    const lib = app.ev("libOf")(); lib.fabric.push({ ...lib.fabric[0], id: 99, name: "Knit", weight: 400 });
    const mesh = { xy: [10, 10, 100, 10, 10, 100,  300, 150, 390, 150, 390, 190], tri: [0, 1, 2, 3, 4, 5] };
    const zs = () => app.ev("sectionZones")(A, mesh, (f) => ({ weight: f.weight }));
    const none = zs();
    app.ev("addChild")(A, "internals", { ...app.mkShape([{x:200,y:0},{x:200,y:200}], false), block: true });
    const lineOnly = zs();
    app.ev("setSectionFabric")(A, { x: 300, y: 100 }, 99);
    return { none, lineOnly, z: zs() };` }).result;
  assert.strictEqual(o.none, null, "no block line: nothing");
  assert.strictEqual(o.lineOnly, null, "a line but no section's fabric: nothing");
  assert.deepStrictEqual(o.z, { t: [-1, 0], fabs: [{ weight: 400 }] }, "the right section's triangle takes the knit");
});

/* ---------- B/6: the pull (session 6, 13:10-15:34: pinned to the pointer, past the limit, springs back) ---------- */
function sheetMesh(W, H, res) {
  const pts = [], nx = Math.round(W/res), ny = Math.round(H/res), dx = W/nx, dy = H/ny;
  for (let i = 0; i < nx; i++) pts.push([i*dx, 0]); for (let j = 0; j < ny; j++) pts.push([W, j*dy]);
  for (let i = 0; i < nx; i++) pts.push([W - i*dx, H]); for (let j = 0; j < ny; j++) pts.push([0, H - j*dy]);
  return C.meshPolygon(pts, res);
}
const WOVEN = { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 2.5, maxStretch: 0.08 };
test("recshort / B6 a strip hung by its top edge, its bottom middle pulled 300 mm away: held exactly at the pointer, stretched past its Max Stretch while held, back where it hung once let go", () => {
  const m = sheetMesh(200, 400, 10), n = m.xy.length/2, X = new Float32Array(3*n), pins = [];
  for (let i = 0; i < n; i++) { X.set([m.xy[2*i], 1500 - m.xy[2*i+1], 0], 3*i); if (m.xy[2*i+1] < 1e-6) pins.push({ p: 0, v: i }); }
  // (self-collision on, as the program runs: without it the strip pulled this far folds through itself and stays tangled)
  const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: WOVEN }], seams: [], pins, opt: { ground: false } });
  const run = (k) => { for (let j = 0; j < k; j++) C.clothStep(sim, 1/60); };
  run(200);
  let c = 0; for (let i = 0; i < n; i++) if (Math.hypot(m.xy[2*i] - 100, m.xy[2*i+1] - 400) < Math.hypot(m.xy[2*c] - 100, m.xy[2*c+1] - 400)) c = i;
  const rest = [sim.x[3*c], sim.x[3*c+1], sim.x[3*c+2]], to = [rest[0], rest[1], rest[2] + 300];
  for (let k = 1; k <= 60; k++) { C.clothDrag(sim, { i: [c], w: [1], to: [rest[0], rest[1], rest[2] + 300*Math.min(1, k/30)] }); run(1); }
  const err = Math.hypot(sim.x[3*c] - to[0], sim.x[3*c+1] - to[1], sim.x[3*c+2] - to[2]), strain = C.clothStrain(sim);
  C.clothDrag(sim, null); run(600);
  const back = Math.hypot(sim.x[3*c] - rest[0], sim.x[3*c+1] - rest[1], sim.x[3*c+2] - rest[2]);
  assert.ok(err < 0.5, "the place held is where the pointer is: " + err.toFixed(3) + " mm off");
  assert.ok(strain > WOVEN.maxStretch, "stretched past its 8 % while held: " + strain.toFixed(3));
  assert.ok(back < 30, "let go, it hangs where it hung (within 30 of the 300 mm): " + back.toFixed(1));
  assert.ok([...sim.w].some(v => v > 0) && sim.w[c] > 0, "the pinned place has its weight back");
});
test("recshort / B6 let go, the cloth that was held keeps sliding on the body for dragRelease frames (120), then has its whole friction again; dragRelease 0: at once, as r33b", () => {
  const m = sheetMesh(100, 100, 10), n = m.xy.length/2, X = new Float32Array(3*n);
  for (let i = 0; i < n; i++) X.set([m.xy[2*i], 1000, m.xy[2*i+1]], 3*i);
  const go = (opt) => {
    const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X: X.slice(), fab: WOVEN }], seams: [], opt: { self: false, ...opt } });
    C.clothStep(sim, 1/60);
    C.clothDrag(sim, { i: [0], w: [1], to: [sim.x[0] + 20, sim.x[1], sim.x[2]] }); C.clothStep(sim, 1/60);
    const held = [sim.slideLeft || 0, sim.w[0]];
    C.clothDrag(sim, null);
    const let0 = [sim.slideLeft, sim.w[0] > 0, [...sim.dragSlid].some(Boolean)];
    for (let k = 0; k < 130; k++) C.clothStep(sim, 1/60);
    return { held, let0, after: sim.slideLeft };
  };
  const now = go({}), r33b = go({ dragRelease: 0 });
  assert.deepStrictEqual(now.held, [0, 0], "while held: pinned (weight 0), not counting down");
  assert.deepStrictEqual(now.let0, [120, true, true], "let go: 120 frames of sliding for the cloth that was held, its weight back");
  assert.strictEqual(now.after, 0, "then its whole friction again");
  assert.strictEqual(r33b.let0[0], 0, "dragRelease 0: at once");
});

/* ---------- C: the leftovers ---------- */
test("recshort / C3 a seam is previewed before the click that makes it (session 5 06:28): with one side picked and the pointer on the other, its connectors from start to start and end to end, in 2D and as lines between the two cloths in 3D; nothing with no side picked", () => {
  const o = boot({ script: `
    S.pieces.length = 0; S.seams.length = 0;
    const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:400,y:0},{x:400,y:200},{x:0,y:200}], true)), B = app.mkPiece("B", app.mkShape([{x:0,y:300},{x:400,y:300},{x:400,y:500},{x:0,y:500}], true));
    S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
    app.ev("setTool")("segment_sewing");
    const at = (x, y) => app.toS({ x, y }), mv = (x, y) => app.fire("pointermove", at(x, y));
    const click = (x, y) => { const s = at(x, y); app.fire("pointermove", s); app.fire("pointerdown", s); app.fire("pointerup", s); };
    mv(200, 200); const before = app.ev("sewPreview")();
    click(200, 200); mv(200, 300);
    const pv = app.ev("sewPreview")(), links = app.ev("sewPreviewLinks")(pv), items = app.ev("ov3Tool")().filter(x => x.link);
    const r = (q) => [q.pid === A.id ? "A" : q.pid === B.id ? "B" : "?", Math.round(q.at[0]), Math.round(q.at[1])];
    let drawn = 0; const ctx = app.ev("ctx"); const was = ctx.setLineDash; ctx.setLineDash = (d) => { if (d && d[0] === 3 && d[1] === 4) drawn++; return was.call(ctx, d); }; app.ev("draw")(); ctx.setLineDash = was;
    return { before, sides: pv && [pv.a.length, pv.b.length], links: links.map(l => l.map(r)), items: items.length, dash: items[0] && items[0].dash, seams: S.seams.length, drawn };` }).result;
  assert.strictEqual(o.before, null, "no side picked: nothing");
  assert.deepStrictEqual(o.sides, [1, 1], "A's bottom line picked, B's top line under the pointer");
  assert.deepStrictEqual(o.links.map(l => [l[0][0], l[1][0]]), [["A", "B"], ["A", "B"]], "two connectors, A to B");
  assert.strictEqual(o.items, 2, "both drawn in 3D as lines between the two cloths"); assert.deepStrictEqual(o.dash, [6, 6]);
  assert.strictEqual(o.seams, 0, "nothing made before the click");
  assert.ok(o.drawn >= 1, "drawn dotted in 2D");
});

module.exports = T;
