// Roadmap R5. Batch 1: the exact curve of .zprj files (see also curves.test.js) and what it does to files of
// earlier builds. Batch 2: the .zprj importer (zprj-import.js) and what the app makes of a file.
"use strict";
const { oldSizeRun } = require("./harness");      // (Round r33 / 4) the size run every document had before r33: a document starts with none since (harness.js)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./harness");
const ZPRJ = require("../zprj-import.js");

const store = new Map();
const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const S = { pieces: [], seams: [], stitches: [], guides: [], measures: [], sel: [], selSeg: -1, selPt: -1, selKind: "outline", selInt: -1, tool: "edit_pattern", selCp: null,
  nextSegId: 1, nextShapeId: 1, nextId: 1, notch: null, grading: null, view: { s: 1, x: 0, y: 0 }, show: null, unit: "mm", dec: 1, prefs: null, shift: false };
const noop = () => {};
const G = load(["V", "cp", "dist", "sub", "add", "mul", "clone", "bez", "mkShape", "rectShape", "mkPiece", "nSeg", "sEnds", "isSpline", "segCurve", "segLen", "segPt", "curveAt", "oldSpline", "knotIn", "curvesIn", "withKnots",
  "holdShape", "CURVE_FIT", "HOLD_MAX", "loadDoc", "checkDoc", "docJSON", "VIEW_DEFAULT", "NOTCH_DEFAULT", "defaultGrading", "seamInfo", "makeSeam", "mkLinked", "affOf", "reflector", "sync", "starter", "dartGeom"],
  { S, localStorage, ui: noop, draw: noop, esc: (s) => String(s) });
const { V, cp, dist, sub, clone, bez, mkShape, rectShape, mkPiece, nSeg, isSpline, segCurve, segLen, segPt, curveAt, oldSpline, curvesIn, CURVE_FIT, loadDoc, checkDoc, docJSON, VIEW_DEFAULT, NOTCH_DEFAULT, defaultGrading, seamInfo } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() {
  S.pieces = []; S.seams = []; S.stitches = []; S.guides = []; S.measures = []; S.sel = []; S.selSeg = S.selPt = S.selInt = -1; S.selKind = "outline"; S.selCp = null;
  S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.show = { ...VIEW_DEFAULT }; S.view = { s: 1, x: 0, y: 0 }; S.notch = { ...NOTCH_DEFAULT }; S.grading = oldSizeRun(); store.clear();
}
// how far two polylines are apart: every point of A to the nearest chord of B
function apart(A, B) {
  let worst = 0;
  for (const q of A) {
    let best = Infinity;
    for (let k = 0; k < B.length - 1; k++) {
      const a = B[k], r = sub(B[k+1], a), L2 = r.x*r.x + r.y*r.y, t = L2 < 1e-18 ? 0 : Math.min(1, Math.max(0, ((q.x-a.x)*r.x + (q.y-a.y)*r.y)/L2));
      best = Math.min(best, dist(q, V(a.x + r.x*t, a.y + r.y*t)));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}
const trace = (sh, i, n = 600) => Array.from({ length: n + 1 }, (_, k) => segPt(sh, i, k/n));

/* ================= batch 1: files of builds before the exact curve ================= */
// A curve-point curve as a build before 8 Oct 2026 drew it: through P at the stored knots us, e0 / e1 as it kept them
const oldTrace = (a, cps, b, e0, e1, n = 3000) => {
  const U = [0, ...cps.map(c => c.u), 1], cv = { B: oldSpline([a, ...cps.map(c => V(c.x, c.y)), b], U, e0 || null, e1 || null), U };
  return Array.from({ length: n + 1 }, (_, k) => { const o = curveAt(cv, k/n), Q = cv.B[o.k]; return bez(Q[0], Q[1], Q[2], Q[3], o.s); });
};
// the documents older builds made, as their files hold them
const OLD = {
  // the starter bodice: three handle curves made into curve points at u = 1/3 and 2/3, with end directions
  "starter bodice": () => {
    const p = mkPiece("Front bodice", mkShape([V(0, 0), V(68, 12), V(188, 42), V(150, 220), V(168, 480), V(0, 495)], true));
    for (const [i, c1, c2] of [[0, V(6, 30), V(40, 26)], [2, V(196, 120), V(186, 190)], [4, V(120, 492), V(60, 500)]]) {
      const a = p.pts[i], b = p.pts[i+1], s = p.segs[i];
      s.curved = true; s.c1 = s.c2 = null; s.cps = [1/3, 2/3].map(u => ({ ...bez(a, c1, c2, b, u), u }));
      s.e0 = { x: 3*(c1.x - a.x), y: 3*(c1.y - a.y) }; s.e1 = { x: 3*(b.x - c2.x), y: 3*(b.y - c2.y) };
    }
    p.segs[2].notches = [0.55]; p.segs.forEach((s, i) => { s.sa = i === 5 ? 0 : 10; });
    return [p];
  },
  // an edge with one curve point put in at 0.55 and dragged far out (a case measured earlier, in millimetres)
  "one point dragged far": () => {
    const p = mkPiece("P", mkShape([V(0, 0), V(260, 175), V(-130, 200)], true)), s = p.segs[0];
    s.curved = true; s.c1 = s.c2 = null; s.cps = [{ x: 272, y: 46, u: 0.55 }]; s.notches = [0.3, 0.8];
    return [p];
  },
  // a wild S through three curve points put in evenly and then dragged about
  "three points dragged about": () => {
    const p = mkPiece("P", rectShape(0, 0, 300, 400)), s = p.segs[1];
    s.curved = true; s.c1 = s.c2 = null; s.cps = [{ x: 360, y: 110, u: 0.25 }, { x: 250, y: 250, u: 0.5 }, { x: 330, y: 340, u: 0.75 }]; s.notches = [0.4];
    return [p];
  },
  // a curve drawn with the pen's Ctrl+click: its knots were the chord lengths already
  "pen curve points": () => {
    const p = mkPiece("P", rectShape(0, 0, 300, 400)), s = p.segs[1], pts = [V(330, 120), V(310, 250), V(322, 330)], run = [p.pts[1], ...pts, p.pts[2]], cum = [0];
    for (let j = 1; j < run.length; j++) cum.push(cum[j-1] + dist(run[j-1], run[j]));
    s.curved = true; s.c1 = s.c2 = null; s.cps = pts.map((q, j) => ({ x: q.x, y: q.y, u: cum[j+1]/cum[cum.length-1] }));
    return [p];
  },
};
const fileOf = (pieces) => JSON.parse(JSON.stringify({ v: 11, nextId: 20, nextSegId: 200, nextShapeId: 5, pieces, seams: [] }));
// every curve-point curve of a file, as an older build drew it: [{ pi, i, run }]
const oldCurves = (file) => file.pieces.flatMap((p, pi) => p.segs.map((s, i) => s.cps ? { pi, i, run: oldTrace(p.pts[i], s.cps, p.pts[(i + 1) % p.pts.length], s.e0, s.e1) } : null).filter(Boolean));

test("B1 files of earlier builds: a curve stays within a tenth of a millimetre of where it was (curve points added where needed), and what sat on it stays put", () => {
  const report = {};
  for (const name of Object.keys(OLD)) {
    reset();
    const file = fileOf(OLD[name]()), before = oldCurves(file);
    const had = file.pieces.reduce((n, p) => n + p.segs.reduce((m, s) => m + (s.cps ? s.cps.length : 0), 0), 0);
    // what sat on the curves, as places
    const marks = file.pieces.flatMap((p, pi) => p.segs.flatMap((s, i) => s.cps ? s.notches.map(t => { const r = before.find(c => c.pi === pi && c.i === i).run; return { pi, i, q: r[Math.round(t*(r.length - 1))] }; }) : []));
    // the same points with the new knots and nothing done about it: how far the curve would have moved
    let plain = 0;
    for (const c of before) {
      const p = clone(file.pieces[c.pi]); S.pieces = [p];
      G.knotIn(p, c.i, false);
      plain = Math.max(plain, apart(trace(p, c.i), c.run));
    }
    reset(); loadDoc(file); checkDoc(S.pieces, S.seams);
    let left = 0, pts = 0;
    for (const c of before) { left = Math.max(left, apart(trace(S.pieces[c.pi], c.i), c.run), apart(c.run.filter((_, k) => k % 5 === 0), trace(S.pieces[c.pi], c.i, 3000))); }
    for (const p of S.pieces) for (const s of p.segs) if (s.cps) { pts += s.cps.length; assert.ok(s.cps.every(q => q.u === undefined), "no knot is kept"); }
    report[name] = { plain: +plain.toFixed(3), left: +left.toFixed(3), added: pts - had };
    // a curve as wild as the S (swinging 110 mm over 400 on three points) would need some thirty curve points for a tenth
    // of a millimetre; it gets the most that are added (HOLD_MAX) and ends up within half a millimetre
    const tol = name === "three points dragged about" ? 0.6 : CURVE_FIT + 0.01;
    assert.ok(left <= tol, name + ": at most " + tol + " mm from the old curve, got " + left);
    near(S.curvesIn.left, left, 0.05, name + ": what is left is reported");
    assert.strictEqual(S.curvesIn.added, pts - had, name + ": the count of added curve points is reported");
    near(S.curvesIn.was, plain, 0.03, name + ": and how far the curve would have moved");
    const m = marks.map(k => { const s = S.pieces[k.pi].segs[k.i]; return Math.min(...s.notches.map(t => dist(segPt(S.pieces[k.pi], k.i, t), k.q))); });
    m.forEach(d => assert.ok(d < tol + 0.3, name + ": a notch stays where it was: " + d));
  }
  // a curve whose knots were the chord lengths already is exactly the same curve, with nothing added
  assert.deepStrictEqual(report["pen curve points"], { plain: 0, left: 0, added: 0 });
  // the numbers of the update report
  assert.ok(report["starter bodice"].plain < 0.3 && report["one point dragged far"].plain > 5, JSON.stringify(report));
  T.report = report;
});

test("B1 the autosave of an earlier build, recovered at the first start of this one: its curves are brought over and the toast says so", () => {
  reset();
  const seed = JSON.stringify(fileOf(OLD["one point dragged far"]()));
  const r = boot({ blank: true, seed, script: `
    const s = S.pieces[0].segs[0];
    return { n: S.pieces.length, cps: s.cps.length, knots: s.cps.some(c => c.u !== undefined), dirty: !!S.dirty, note: S.curvesIn, toast: toasts[toasts.length - 1] };` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.modals.map(m => m.title), ["Recover unsaved work?"]);
  const o = r.result;
  assert.strictEqual(o.n, 1); assert.strictEqual(o.cps, 8, "one curve point, and seven added to keep the shape"); assert.strictEqual(o.knots, false); assert.strictEqual(o.dirty, true);
  assert.ok(o.note.curves === 1 && o.note.added === 7 && o.note.left <= 0.1);
  assert.ok(/^Recovered\. Save it to keep it\. 1 curve was drawn by an older build: now at most 0\.\d+ mm from where it was \(7 curve points added to keep the shape\)$/.test(o.toast), o.toast);
});

test("B1 loading twice changes nothing more: a file saved by this build opens as it is, and an older build draws it the same", () => {
  reset();
  loadDoc(fileOf(OLD["three points dragged about"]()));
  const text = docJSON(), shape = trace(S.pieces[0], 1, 400), n = S.pieces[0].segs[1].cps.length;
  const d = JSON.parse(text);
  assert.ok(d.pieces[0].segs[1].cps.every(c => Number.isFinite(c.u)), "the file carries a knot with every curve point");
  // an older build: the spline at the stored knots
  const s = d.pieces[0].segs[1], old = oldTrace(V(300, 0), s.cps, V(300, 400), s.e0, s.e1, 400);
  assert.ok(apart(old, shape) < 1e-6 && apart(shape, old) < 1e-6, "an older build draws the very same curve from that file");
  reset(); loadDoc(d);
  assert.deepStrictEqual(S.curvesIn, { curves: 0, added: 0, was: 0, left: 0 });
  assert.strictEqual(S.pieces[0].segs[1].cps.length, n);
  trace(S.pieces[0], 1, 400).forEach((q, k) => assert.ok(dist(q, shape[k]) < 1e-9));
});

test("B1 a linked copy and its seams come through: the copy is drawn from its source, a seam on the curve keeps its length", () => {
  reset();
  const [p] = OLD["starter bodice"]();
  const q = mkPiece("Q", rectShape(400, 0, 100, 400));
  const file = fileOf([p, q]);
  file.seams = [{ id: 1, a: [{ piece: p.id, shape: 0, sids: [p.segs[2].id], t0: 0.2, t1: 0.9, rev: false }], b: [{ piece: q.id, shape: 0, sids: [q.segs[3].id], t0: 0, t1: 1, rev: false }] }];
  const run = oldCurves(file).find(c => c.i === 2).run, a = run[Math.round(0.2*3000)], b = run[Math.round(0.9*3000)];
  let L = 0; for (let k = Math.round(0.2*3000); k < Math.round(0.9*3000); k++) L += dist(run[k], run[k+1]);
  loadDoc(file); checkDoc(S.pieces, S.seams);
  const part = S.seams[0].a[0];
  assert.ok(dist(segPt(S.pieces[0], 2, part.t0), a) < 0.2 && dist(segPt(S.pieces[0], 2, part.t1), b) < 0.2, "the sewing range starts and ends where it did");
  near(seamInfo(S.seams[0], S.pieces).la, L, 0.3, "and is as long as it was");
});

/* ================= batch 2: the .zprj importer ================= */
const vm = require("vm");
const os = require("os");
const { spawnSync } = require("child_process");
const MK = require("./zprj-make");
const Z2 = load(["zprjPieces", "zprjShapes", "zprjReportHTML", "ZPRJ_NOT", "paramNear", "tAtFrac", "flatten", "signedArea"], { S, localStorage, ui: noop, draw: noop, esc: (s) => String(s) });
const { zprjPieces, zprjReportHTML } = Z2;
function boot(opt) {
  const file = path.join(os.tmpdir(), "r5-boot-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(file, JSON.stringify(opt || {}));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + file], { encoding: "utf8", timeout: 20000 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 20 s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { try { fs.unlinkSync(file); } catch (e) {} }
}
const ring = (n) => Array.from({ length: n }, (_, k) => ({ start: k, end: (k + 1) % n }));
// the handoff's first test file: a 500 × 500 mm square centred at the origin
const SQUARE = { name: "Pattern_1", annotation: "Square", points: [[-250, -250], [250, -250], [250, 250], [-250, 250]], lines: ring(4) };
// a sleeve-like pattern with everything the importer reads: two curved lines, allowance (one line tapering), a notch on a
// curve, an internal line with a placement of its own, a reference line, the allowance helper shape, and a placement in
// the 2D window that turns it a quarter, mirrors it and moves it
const QUARTER = [0, 1, 0, 1, 0, 0, 400, 100, 1];        // x' = y + 400, y' = x + 100: a mirrored quarter turn
const SLEEVE = {
  name: "JK-SLEEVE_7", annotation: "Sleeve L", transform: QUARTER,
  points: [[0, 0], [300, 0], [320, 400], [-20, 400]],
  lines: [
    { start: 0, end: 1, cps: [[80, -60], [150, -75], [230, -55]], sa: [10, 10], notches: [{ at: [150, -75], alpha: 0.5 }] },
    { start: 1, end: 2, sa: [10, 5] },
    { start: 2, end: 3, cps: [[150, 415]] },
    { start: 3, end: 0, sa: [10, 10], notches: [{ at: [-10, 200], alpha: 0.5 }, { at: [-5, 100], alpha: 0.75 }] },
  ],
  inner: [{ name: "Internal_3", transform: [1, 0, 0, 0, 1, 0, 50, 100, 1], points: [[0, 0], [200, 0], [200, 50]], lines: [{ start: 0, end: 1, cps: [[100, 20]] }, { start: 1, end: 2 }] }],
  dummy: [{ name: "Pattern_77", sa: true, points: [[0, 0], [300, 0], [300, 400]], lines: [{ start: 0, end: 1 }, { start: 1, end: 2 }] },
          { name: "Baseline_2", sa: false, points: [[0, 200], [300, 200]], lines: [{ start: 0, end: 1 }] }],
};
const NO_ANNO = { name: "Pattern_55", points: [[0, 0], [100, 0], [100, 100]], lines: ring(3) };
const BLANK_ANNO = { name: "Collar", annotation: "  ", points: [[0, 0], [100, 0], [100, 100]], lines: ring(3) };
const bezAt = (Q, t) => { const u = 1 - t; return [u*u*u*Q[0][0] + 3*u*u*t*Q[1][0] + 3*u*t*t*Q[2][0] + t*t*t*Q[3][0], u*u*u*Q[0][1] + 3*u*u*t*Q[1][1] + 3*u*t*t*Q[2][1] + t*t*t*Q[3][1]]; };

test("B2 the importer reads a project file: the square of the handoff, exactly", async () => {
  const { pieces, skipped } = await ZPRJ.importZprj(MK.zprj([SQUARE]));
  assert.strictEqual(pieces.length, 1); assert.deepStrictEqual(skipped, []);
  const p = pieces[0];
  assert.deepStrictEqual(p.points, [[-250, -250], [250, -250], [250, 250], [-250, 250]], "corners at ±250");
  assert.strictEqual(p.lines.length, 4); assert.ok(p.lines.every(l => !l.curved && l.segments.length === 1 && l.segments[0].length === 2), "four straight lines");
  assert.strictEqual(p.annotation, "Square"); assert.strictEqual(p.name, "Pattern_1"); assert.strictEqual(p.mirrored, false); assert.strictEqual(p.hasSeamAllowance, false);
  // an ArrayBuffer and an uncompressed inner archive are read the same
  const b = MK.zprj([SQUARE], { store: true }), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  assert.deepStrictEqual((await ZPRJ.importZprj(ab)).pieces[0].points, p.points);
});

test("B2 the importer reads curves, allowance, notches, internal and reference lines, names and placement", async () => {
  const { pieces } = await ZPRJ.importZprj(MK.zprj([SLEEVE, NO_ANNO, BLANK_ANNO]));
  assert.strictEqual(pieces.length, 3);
  const p = pieces[0], L = p.lines;
  assert.deepStrictEqual([p.name, p.annotation, p.mirrored, p.hasSeamAllowance], ["JK-SLEEVE_7", "Sleeve L", true, true]);
  assert.deepStrictEqual(L.map(l => l.curved), [true, false, true, false]);
  assert.deepStrictEqual(L[0].curvePoints, [[80, -60], [150, -75], [230, -55]]);
  assert.deepStrictEqual(L[0].segments, ZPRJ.splineToBeziers([[0, 0], [80, -60], [150, -75], [230, -55], [300, 0]]), "a curved line is the spline through its start, its curve points and its end");
  assert.strictEqual(L[0].segments.length, 4);
  assert.deepStrictEqual(L.map(l => l.seamAllowance), [[10, 10], [10, 5], [0, 0], [10, 10]]);
  assert.deepStrictEqual(L.map(l => l.notches.length), [1, 0, 0, 2]); assert.deepStrictEqual(L[0].notches[0], { position: [150, -75], length: 7, angle: 90, type: 4, alpha: 0.5 });
  assert.strictEqual(p.internalLines.length, 1); assert.strictEqual(p.internalLines[0].name, "Internal_3");
  assert.deepStrictEqual(p.internalLines[0].shape.points, [[50, 100], [250, 100], [250, 150]], "an internal line is put through its own placement, into the pattern's coordinates");
  assert.deepStrictEqual(p.internalLines[0].shape.lines.map(l => [l.start, l.end, l.curved, l.curvePoints]), [[0, 1, true, [[150, 120]]], [1, 2, false, []]]);
  assert.deepStrictEqual(p.referenceLines.map(r => r.name), ["Baseline_2"], "the allowance helper shape is not a reference line");
  assert.deepStrictEqual(ZPRJ.applyTransform(p.transform, [0, 0]), [400, 100]); assert.deepStrictEqual(ZPRJ.applyTransform(p.transform, [300, 0]), [400, 400]);
  assert.strictEqual(pieces[1].annotation, null); assert.strictEqual(pieces[2].annotation, "  ");
});

test("B2 a file that is encrypted, not a project file or of an unknown layout is refused with its reason; one unreadable pattern does not lose the others", async () => {
  const code = async (bytes) => { try { await ZPRJ.importZprj(bytes); return "read"; } catch (e) { assert.ok(e instanceof ZPRJ.ZprjError && e.message.length > 10, "a ZprjError with a message"); return e.code; } };
  assert.strictEqual(await code(Buffer.from("this is a text file, not an archive at all, however long it may be")), "not-zprj");
  assert.strictEqual(await code(Buffer.alloc(0)), "not-zprj");
  assert.strictEqual(await code(MK.zprj([SQUARE], { noZpac: true })), "not-zprj", "an archive with no pattern archive inside");
  assert.strictEqual(await code(MK.zprj([SQUARE], { encrypted: "zpac" })), "encrypted", "the pattern archive is flagged as encrypted");
  assert.strictEqual(await code(MK.zprj([SQUARE], { encrypted: "pac" })), "encrypted", "the pattern data is flagged as encrypted");
  // pattern data that is scrambled: every byte value about equally often, and no key name to be read
  let seed = 3; const noise = Buffer.from(Array.from({ length: 60000 }, () => (seed = (seed*16807) % 2147483647) & 255));
  assert.ok(ZPRJ.entropy(noise) > 7.9 && ZPRJ.entropy(MK.pac([SLEEVE, SQUARE])) < 6.5, "scrambled bytes and pattern data are told apart by a wide margin");
  assert.strictEqual(await code(MK.zprj([], { pac: noise })), "encrypted");
  // pattern data cut short, or a tree without a pattern list: an unknown layout, not "encrypted"
  const whole = MK.pac([SQUARE]);
  assert.strictEqual(await code(MK.zprj([], { pac: whole.subarray(0, whole.length - 9) })), "unknown");
  assert.strictEqual(await code(MK.zprj([], { pac: Buffer.concat([whole, Buffer.from([0])]) })), "unknown", "bytes left over after the tree");
  assert.strictEqual(await code(MK.zprj([], { pac: MK.map({ mapSomethingElse: MK.map({}) }).bytes })), "unknown");
  // one pattern without what it can't exist without (its outline's points): it is left out and named, the others come through
  // (Round I: a part that is merely optional, such as the stored cut line, no longer loses the pattern; see the Round I tests)
  const r = await ZPRJ.importZprj(MK.zprj([SQUARE, { ...NO_ANNO, drop: "listPoint" }, SLEEVE]));
  assert.deepStrictEqual(r.pieces.map(p => p.index), [0, 2]); assert.strictEqual(r.skipped.length, 1); assert.strictEqual(r.skipped[0].index, 1); assert.ok(/listPoint/.test(r.skipped[0].reason));
  assert.strictEqual(r.skipped[0].name, "Pattern_55"); assert.strictEqual(r.total, 3);
});

test("B2 the worker is the importer's own text: it reads a file to the same result, and says why when it cannot", async () => {
  const src = ZPRJ.workerSource();
  assert.ok(typeof src === "string" && /importZprj/.test(src) && /self\.onmessage/.test(src));
  const out = [], self = { postMessage: (m) => out.push(m) };
  vm.runInNewContext(src, { self, Uint8Array, Uint32Array, DataView, TextDecoder, Blob, Response, DecompressionStream, Map, Math, Array, Error, Promise, Number, String, Object, JSON });
  const wait = async (n) => { for (let k = 0; k < 400 && out.length < n; k++) await new Promise(r => setTimeout(r, 5)); assert.ok(out.length >= n, "the worker answered"); };
  const bytes = MK.zprj([SLEEVE, SQUARE]);
  self.onmessage({ data: { id: 4, buf: bytes } }); await wait(1);
  assert.strictEqual(out[0].id, 4); assert.strictEqual(out[0].ok, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(out[0].result)), JSON.parse(JSON.stringify(await ZPRJ.importZprj(bytes))), "the same as read in the page");
  self.onmessage({ data: { id: 5, buf: MK.zprj([SQUARE], { encrypted: "pac" }) } }); await wait(2);
  assert.deepStrictEqual([out[1].id, out[1].ok, out[1].code], [5, false, "encrypted"]); assert.ok(/encrypted or protected/.test(out[1].message));
});

test("B2 patterns of ours from a file: name, placement, curve points (the very same curve), allowance, notches, internal and reference lines", async () => {
  reset();
  const res = await ZPRJ.importZprj(MK.zprj([SLEEVE, NO_ANNO, BLANK_ANNO, SQUARE]));
  const { pieces, report } = zprjPieces(res, {});
  assert.deepStrictEqual(pieces.map(p => p.name), ["Sleeve L", "Pattern_55", "Collar", "Square"], "the annotation is the name; without one, the internal name");
  // (the file's 2D window is y up, ours y down: Round I turned imports over, which before came in upside down)
  const p = pieces[0], X = (q) => { const w = ZPRJ.applyTransform(QUARTER, q); return V(w[0], -w[1]); };
  assert.deepStrictEqual(p.pts, [X([0, 0]), X([300, 0]), X([320, 400]), X([-20, 400])], "placed as in the file's 2D window");
  assert.deepStrictEqual(p.segs.map(s => [s.curved, (s.cps || []).length, s.sa]), [[true, 3, 10], [false, 0, 10], [true, 1, 0], [false, 0, 10]], "curve points, and the wider end of a tapering allowance");
  assert.deepStrictEqual(p.segs[0].cps, [X([80, -60]), X([150, -75]), X([230, -55])]);
  // the pattern's curve is the file's curve: the importer's own Béziers, placed, against ours
  res.pieces[0].lines.forEach((l, i) => { if (!l.curved) return; const cv = segCurve(p, i);
    l.segments.forEach((Q, k) => { for (let j = 0; j <= 8; j++) { const a = X(bezAt(Q, j/8)), P = cv.B[k], b = bez(P[0], P[1], P[2], P[3], j/8); assert.ok(dist(a, b) < 1e-9, "line " + i + ", span " + k); } }); });
  // notches: where the file puts them, as a parameter on the line
  assert.strictEqual(p.segs[0].notches.length, 1); assert.ok(dist(segPt(p, 0, p.segs[0].notches[0]), X([150, -75])) < 1e-3, "the notch on the curve is on its middle curve point");
  assert.strictEqual(p.segs[3].notches.length, 2); p.segs[3].notches.forEach((t, k) => assert.ok(dist(segPt(p, 3, t), X([[-10, 200], [-5, 100]][k])) < 1e-3)); assert.ok(p.segs[3].notches[0] < p.segs[3].notches[1], "in order along the line");
  // internal and reference lines
  assert.strictEqual(p.internals.length, 1); const il = p.internals[0];
  assert.deepStrictEqual([il.closed, il.pts.length, il.segs[0].curved, il.segs[0].cps, il.segs[1].curved], [false, 3, true, [X([150, 120])], false]); assert.deepStrictEqual(il.pts[0], X([50, 100]));
  assert.strictEqual(p.bases.length, 1); assert.strictEqual(p.bases[0].ref, true); assert.deepStrictEqual(p.bases[0].pts, [X([0, 200]), X([300, 200])]);
  assert.ok(Number.isInteger(il.id) && Number.isInteger(p.bases[0].id) && new Set(p.segs.map(s => s.id)).size === 4, "ids as any pattern has them");
  assert.deepStrictEqual(pieces[3].pts, [V(-250, 250), V(250, 250), V(250, -250), V(-250, -250)], "the square's corners at ±250");
  S.pieces = pieces; checkDoc(S.pieces, S.seams);
  assert.deepStrictEqual(report, { patterns: 4, total: 4, lines: 14, curved: 2, curvePoints: 4, notches: 3, saPatterns: 1, saLines: 3, tapered: 1, internals: 1, refs: 1, stretched: 0, skipped: [], left: [], defaults: {}, others: null, graded: 0, sizes: null, baseOff: 0, links: 0, instances: 0, linkLeft: [], grains: 0, seams: 0, seamsTotal: 0, seamLeft: [], fabrics: [], placed: 0, draped: 0, notDraped: [], fit3: null, graphics: [], gfxLeft: [] });   // (Round I3 added the 3D and graphics keys: this file has neither)
  const html = zprjReportHTML(report);
  for (const part of ["Imported 4 of 4 patterns", "14 lines (2 curved", "3 notches", "Seam allowance on 3 lines of 1 pattern", "1 line tapers", "1 internal line", "1 reference line, hidden", "Not imported: notch types"]) assert.ok(html.includes(part), part);
  // each part can be left out
  reset();
  const bare = zprjPieces(res, { sa: false, notches: false, internals: false, refs: false });
  assert.deepStrictEqual(bare.pieces[0].segs.map(s => [s.sa, s.notches.length]), [[0, 0], [0, 0], [0, 0], [0, 0]]); assert.deepStrictEqual([bare.pieces[0].internals.length, bare.pieces[0].bases.length], [0, 0]);
  // what can't be a pattern is left out and named; a pattern stretched by its placement is counted
  reset();
  const odd = zprjPieces({ skipped: [{ index: 6, reason: "missing key listLine" }], pieces: [
    { index: 0, name: "Open", annotation: null, transform: MK.ID, points: [[0, 0], [10, 0], [10, 10]], lines: [{ start: 0, end: 1, curved: false, curvePoints: [], seamAllowance: [0, 0], notches: [] }, { start: 1, end: 2, curved: false, curvePoints: [], seamAllowance: [0, 0], notches: [] }], internalLines: [], referenceLines: [] },
    { ...res.pieces[3], index: 1, transform: [2, 0, 0, 0, 1, 0, 0, 0, 1] }] }, {});
  assert.strictEqual(odd.pieces.length, 1); assert.strictEqual(odd.report.stretched, 1); assert.deepStrictEqual(odd.pieces[0].pts[1], V(500, 250));
  assert.strictEqual(odd.report.skipped.length, 2); assert.ok(/Pattern 7 \(missing key listLine\)/.test(odd.report.skipped[0]) && /Open \(its outline is not one closed run/.test(odd.report.skipped[1]));
});

test("B2 in the booted app: File > Import has the .zprj item; an import is one undo step, reference lines come in hidden, and a report is shown", async () => {
  const res = await ZPRJ.importZprj(MK.zprj([SLEEVE, SQUARE]));
  const r = boot({ blank: true, script: `
    const out = {}, res = ${JSON.stringify(res)};
    out.menu = app.MENUS.file().find(x => x && x.n === "Import").menu().filter(Boolean).map(x => x.n || x.hd || "").filter(n => /zprj|DXF|Ours/.test(n));
    out.ref0 = S.show.reference;
    const rep = app.ev("zprjTake")("sleeve.zprj", res, {});
    out.rep = rep; out.names = S.pieces.map(p => p.name); out.undo = S.undo.length; out.step = app.histSteps().steps.map(s => s.n);
    out.ref1 = S.show.reference; out.savedView = app.storage.get("pdraft:view");      // (Round r23 / 1: the switches are view state, not written)
    out.sel = S.sel.length; out.dirty = !!S.dirty;
    out.curve = S.pieces[0].segs[0].cps.length; out.len = app.segLen(S.pieces[0], 0);
    app.checkDoc(S.pieces, S.seams);
    // a second import is put beside the first, not on top of it
    app.ev("zprjTake")("again.zprj", res, {});
    const bx = (p) => [Math.min(...p.pts.map(q => q.x)), Math.max(...p.pts.map(q => q.x))];
    out.beside = Math.min(...S.pieces.slice(2).map(p => bx(p)[0])) > Math.max(...S.pieces.slice(0, 2).map(p => bx(p)[1]));
    // replacing instead of appending
    app.ev("zprjTake")("fresh.zprj", res, { append: false }); out.fresh = S.pieces.length;
    app.undo(); out.back1 = S.pieces.length; app.undo(); app.undo(); out.back = S.pieces.length;
    // a file with nothing to take, and files that are refused
    out.none = app.ev("zprjTake")("empty.zprj", { pieces: [], skipped: [] }, {}); out.noneUndo = S.undo.length;
    app.ev("zprjRefused")("locked.zprj", { code: "encrypted", message: "x" });
    app.ev("zprjRefused")("notes.txt", { code: "not-zprj", message: "x" });
    app.ev("zprjRefused")("newer.zprj", { code: "unknown", message: "the pattern data is not laid out as expected" });
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.menu, ["DXF", "Ours", "Import .zprj / .zpac…"], "File ▸ Import: DXF first, and ours under their own heading (Round D / D3)");
  assert.deepStrictEqual(o.names, ["Sleeve L", "Square"]); assert.strictEqual(o.rep.patterns, 2);
  assert.strictEqual(o.undo, 1, "one undo step"); assert.deepStrictEqual(o.step, ["Import sleeve.zprj"]);
  assert.deepStrictEqual([o.ref0, o.ref1, o.savedView], [true, false, undefined], "the Reference Line switch is turned off for the session (Round r23 / 1: not written)");
  assert.strictEqual(o.sel, 2); assert.strictEqual(o.dirty, true); assert.strictEqual(o.curve, 3); assert.ok(o.len > 300 && o.len < 400, "the curve has its length: " + o.len);
  assert.strictEqual(o.beside, true); assert.strictEqual(o.fresh, 2); assert.strictEqual(o.back1, 4); assert.strictEqual(o.back, 0, "undo all the way: the blank document");
  assert.strictEqual(o.none, null); assert.strictEqual(o.noneUndo, 0, "nothing to take: no undo step");
  const titles = r.modals.map(m => m.title);
  assert.deepStrictEqual(titles, ["Imported sleeve.zprj", "Imported again.zprj", "Imported fresh.zprj", "Nothing imported", "Not imported: locked.zprj", "Not imported: notes.txt", "Not imported: newer.zprj"]);
  assert.ok(/2 patterns/.test(r.modals[0].text) && /Not imported: notch types/.test(r.modals[0].text));      // (sewing is imported since Round I)
  assert.ok(/encrypted or protected, so it is not opened/.test(r.modals[4].text)); assert.ok(/not a project file \(\.zprj or \.zpac\)/.test(r.modals[5].text)); assert.ok(/layout is not known/.test(r.modals[6].text) && /not laid out as expected/.test(r.modals[6].text));
});

// the test on the real project files moved out in Round I: tests that read other programs' files are not released
module.exports = T;
