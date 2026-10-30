// Whole-app boot: the page must always come up drawn and usable — with corrupted
// autosave data, with old-format autosaves, with blocked storage, and on a tiny stage.
// Each boot runs in a child process with a timeout, so a hang is a failure, not a freeze.
"use strict";
const assert = require("assert");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const { pageHTML, pageScripts, liveServerInject } = require("./harness");

function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})],
    { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
const STARTER = "Front bodice";
// Since R4 an autosave is unsaved work that is offered for recovery; the harness answers "Recover" (see boot-child.js),
// and the program says so. Anything else it says is a warning.
const RECOVERED = "Recovered. Save it to keep it.";
const warned = (r) => r.toasts.filter(t => t !== RECOVERED);
// up and drawing, whatever is (or is not) in the document
function assertRuns(r, msg) {
  assert.deepStrictEqual(r.errors, [], msg + ": no errors");
  const v = r.view;
  assert.ok(v && [v.s, v.x, v.y].every(Number.isFinite) && v.s > 0, msg + ": view is finite, got " + JSON.stringify(v));
  assert.ok(r.panelBuilt, msg + ": properties panel was built");
}
function assertUp(r, msg) {
  assert.deepStrictEqual(r.errors, [], msg + ": no errors");
  const v = r.view;
  assert.ok(v && [v.s, v.x, v.y].every(Number.isFinite) && v.s > 0, msg + ": view is finite, got " + JSON.stringify(v));
  assert.ok(r.names.length >= 1, msg + ": a pattern is loaded");
  assert.ok(r.panelBuilt, msg + ": properties panel was built");
}
const backups = (r) => Object.keys(r.storage).filter(k => k.startsWith("pdraft:doc.unreadable."));

const T = [];
const test = (name, fn) => T.push({ name, fn });

// one real autosave written by this build, to derive the corrupted variants from
let GOOD;
const good = () => GOOD || (GOOD = JSON.parse(boot().storage["pdraft:doc"]));
const mutate = (f) => { const d = JSON.parse(JSON.stringify(good())); f(d); return JSON.stringify(d); };

test("fresh start: starter pattern, autosaved", () => {
  const r = boot();
  assertUp(r, "fresh");
  assert.deepStrictEqual(r.names, [STARTER]);
  assert.strictEqual(JSON.parse(r.storage["pdraft:doc"]).v, 26);      // (version 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
  assert.deepStrictEqual(r.toasts, []);
});

test("a valid autosave (v5) and an old v4-era autosave both restore without a backup or warning", () => {
  const v5 = mutate(d => { d.pieces[0].name = "My bodice"; });
  const r5 = boot({ seed: v5 });
  assertUp(r5, "v5"); assert.deepStrictEqual(r5.names, ["My bodice"]);
  assert.deepStrictEqual(backups(r5), []); assert.deepStrictEqual(r5.toasts, [RECOVERED]);
  assert.strictEqual(r5.storage["pdraft:doc"], v5, "recovered work stays in the autosave, untouched, until it is saved or changed");
  // v4: no segment ids, dart by segment index, seam by index
  const v4 = JSON.stringify({ v: 4, nextId: 3, pieces: [
    { id: 1, name: "Old front", on: true, closed: true, internals: [], bases: [], grain: null, anno: null, mirrorOf: null, axis: null, layer: 0,
      pts: [{x:0,y:0},{x:100,y:0},{x:100,y:200},{x:0,y:200}],
      segs: [0,1,2,3].map(() => ({ curved: false, c1: null, c2: null, sa: 10, notches: [] })),
      darts: [{ seg: 2, t: 0.5, width: 20, depth: 60, folded: false }] },
    { id: 2, name: "Old back", on: true, closed: true, internals: [], bases: [], grain: null, anno: null, mirrorOf: null, axis: null, layer: 0, darts: [],
      pts: [{x:200,y:0},{x:300,y:0},{x:300,y:200},{x:200,y:200}],
      segs: [0,1,2,3].map(() => ({ curved: false, c1: null, c2: null, sa: 10, notches: [] })) } ],
    seams: [{ id: 1, a: { piece: 1, seg: 1 }, b: { piece: 2, seg: 3 }, rev: true }] });
  const r4 = boot({ seed: v4 });
  assertUp(r4, "v4"); assert.deepStrictEqual(r4.names, ["Old front", "Old back"]);
  assert.deepStrictEqual(backups(r4), []); assert.deepStrictEqual(warned(r4), []);
  // what it is once the program has it: its next autosave (after any change)
  const saved = JSON.parse(boot({ seed: v4, script: "app.ev('store(); saveNow()');" }).storage["pdraft:doc"]);
  // Round F / 7: the dart is made into the outline as the document comes in: three more points, its legs sewn to each other
  assert.deepStrictEqual([saved.pieces[0].darts.length, saved.pieces[0].pts.length], [0, 7]); assert.strictEqual(saved.seams.length, 2, "the old seam and the dart's legs");
});

test("v6 features render at boot: a locked pattern, layers, and a seam on an internal line", () => {
  const seed = mutate(d => {
    const p = d.pieces[0], it = p.internals[0];
    Object.assign(p, { lock: true, layer: 2, category: "Body", quantity: 2, shrink: { w: 97, h: 99 } });
    d.seams = [{ id: 1, a: { piece: p.id, shape: it.id, sid: it.segs[0].id }, b: { piece: p.id, shape: 0, sid: p.segs[0].id }, rev: false }];
  });
  const r = boot({ seed });
  assertUp(r, "v6"); assert.deepStrictEqual(backups(r), []); assert.deepStrictEqual(warned(r), []);
  const saved = JSON.parse(boot({ seed, script: "app.ev('store(); saveNow()');" }).storage["pdraft:doc"]);
  // the starter's dart is made into its outline (Round F / 7): its legs are a seam of their own
  assert.strictEqual(saved.seams.filter(sm => sm.a[0].shape).length, 1, "the internal-line seam is kept");
  assert.strictEqual(saved.seams.length, 2, "and the starter dart's legs, sewn");
  assert.strictEqual(saved.pieces[0].lock, true); assert.strictEqual(saved.pieces[0].layer, 2);
  // junk property values are coerced on load (see model.test.js), not treated as a corrupt autosave
  const r2 = boot({ seed: mutate(d => { Object.assign(d.pieces[0], { quantity: "lots", layer: null, shrink: "no", lock: 1 }); }) });
  assertUp(r2, "junk props"); assert.deepStrictEqual(backups(r2), []); assert.deepStrictEqual(warned(r2), []);
});

test("Phase 2 menu commands run in the booted app: extend/trim, add point to intersection, convert, undo", () => {
  // the starter's internal line is a V from (96,495) up to (108,330) and back to (120,495); the hem is curved,
  // so both ends sit a little off the outline
  const r = boot({ script: `
    const p = S.pieces[0], it = p.internals[0], out = {};
    const at = (q) => app.toS(q);
    const n0 = p.pts.length;
    let s = at(it.pts[2]); app.menuClick(s.x, s.y, "Extend/Trim to Pattern Outline");
    s = at(it.pts[0]); app.menuClick(s.x, s.y, "Extend/Trim to Pattern Outline");
    out.ends = [S.pieces[0].internals[0].pts[0], S.pieces[0].internals[0].pts[2]];
    out.afterFit = toasts.slice();
    s = at(S.pieces[0].internals[0].pts[1]); app.menuClick(s.x, s.y, "Add Point to Intersection");
    out.added = S.pieces[0].pts.length - n0;
    s = at(S.pieces[0].internals[0].pts[1]); app.menuClick(s.x, s.y, "Convert to Baseline");
    out.lists = [S.pieces[0].internals.length, S.pieces[0].bases.length];
    s = at(S.pieces[0].bases[0].pts[1]); app.menuClick(s.x, s.y, "Convert to Internal Line", "trace");
    out.back = [S.pieces[0].internals.length, S.pieces[0].bases.length];
    for (let k = 0; k < 5; k++) app.undo();
    out.undone = [S.pieces[0].pts.length - n0, S.pieces[0].internals[0].pts[0], S.pieces[0].internals[0].pts[2]];
    return out;` });
  assertUp(r, "script");
  const o = r.result;
  assert.strictEqual(o.afterFit.length, 2, "both ends moved: " + JSON.stringify(r.toasts));
  assert.ok(o.afterFit.every(t => /^(Extended|Trimmed) to the outline$/.test(t)), JSON.stringify(o.afterFit));
  assert.strictEqual(o.added, 2, "a point on the hem at each end of the line");
  assert.deepStrictEqual(o.lists, [0, 1]); assert.deepStrictEqual(o.back, [1, 0]);
  assert.strictEqual(o.undone[0], 0);
  assert.deepStrictEqual(o.undone.slice(1), [{ x: 96, y: 495 }, { x: 120, y: 495 }], "five undos restore the starter");
});

test("Phase 2 dialogs run in the booted app: set length, segment length at a point, offsets", () => {
  const r = boot({ script: `
    const out = {}, titles = [];
    const P = () => S.pieces[0], at = (q) => app.toS(q);
    const mid = (i) => { const a = P().pts[i], b = P().pts[(i+1) % P().pts.length]; return at({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 }); };
    const len = (i) => { const a = P().pts[i], b = P().pts[(i+1) % P().pts.length]; return Math.hypot(b.x-a.x, b.y-a.y); };
    // edge 2 (index 1) is the straight shoulder, edge 6 (index 5) the straight centre front
    app.answer = (t, f, o) => { titles.push(t + "|" + f.map(x => x.k).join(",") + "|" + (o.checks || []).map(c => c.k).join(",")); return { len: 150, start: false, lock: false }; };
    let s = mid(1); app.menuClick(s.x, s.y, "Change Length");
    out.shoulder = len(1); out.p1 = P().pts[1];
    // at point 1 (between the curved neck and the shoulder): change only the shoulder
    app.answer = (t, f) => { titles.push(t + "|" + f.map(x => x.label).join(",")); return { prev: f[0].val, next: 100, lock: true }; };
    s = at(P().pts[1]); app.menuClick(s.x, s.y, "More ▸ Segment Length\\u2026");
    out.shoulder2 = len(1); out.neckHandle = P().segs[0].cps.map(c => [+c.x.toFixed(6), +c.y.toFixed(6)]); out.lockKept = S.lockCurve;
    // an impossible request leaves no undo step behind
    const undoDepth = S.undo.length;
    app.answer = () => ({ len: -4, start: false, lock: false });
    s = mid(1); app.menuClick(s.x, s.y, "Change Length");
    out.noUndoStep = S.undo.length === undoDepth;
    // offsets: three lines in from the centre front, fitted to the outline; then two rings of the whole outline
    app.answer = (t, f, o) => { titles.push(t + "|" + (o.checks || []).map(c => c.k).join(",")); return { d: 20, n: 3, rev: false, fit: true }; };
    s = mid(5); app.menuClick(s.x, s.y, "Offset as Internal Line");
    out.lines = P().internals.slice(1).map(l => [l.closed, l.pts[0].x, l.pts[l.pts.length-1].x]);
    app.answer = () => ({ d: 5, n: 2, rev: false });
    app.menuClick(at({ x: 60, y: 250 }).x, at({ x: 60, y: 250 }).y, "Offset as Internal Line", "transform_pattern");      // (the pattern's menu: Transform Pattern takes the pattern wherever it is clicked)
    out.rings = P().internals.slice(4).map(l => l.closed);
    out.ids = P().internals.map(l => l.id);
    out.titles = titles;
    return out;` });
  assertUp(r, "script");
  const o = r.result, near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, m + ": " + a + " vs " + b);
  near(o.shoulder, 150, 1e-9, "Change Length"); assert.deepStrictEqual(o.p1, { x: 68, y: 12 }, "the start point stayed");
  near(o.shoulder2, 100, 1e-9, "Segment Length");
  // the neck curve of the starter: its two curve points are a third and two thirds of the way along the cubic it was made from
  const cubic = (t) => { const u = 1 - t, f = (a, b, c, d) => +(u*u*u*a + 3*u*u*t*b + 3*u*t*t*c + t*t*t*d).toFixed(6); return [f(0, 6, 40, 68), f(0, 30, 26, 12)]; };
  assert.deepStrictEqual(o.neckHandle, [cubic(1/3), cubic(2/3)], "locked: the neck curve's curve points did not move");
  assert.strictEqual(o.lockKept, true, "the lock choice is remembered");
  assert.strictEqual(o.noUndoStep, true);
  assert.deepStrictEqual(o.lines.map(l => l[0]), [false, false, false]);
  o.lines.forEach((l, k) => { near(l[1], 20*(k+1), 1e-6, "line " + k + " start x"); near(l[2], 20*(k+1), 1e-6, "line " + k + " end x"); });
  assert.deepStrictEqual(o.rings, [true, true]);
  assert.strictEqual(new Set(o.ids).size, 6, "every new shape has its own id");
  assert.deepStrictEqual(o.titles, ["Change Length|len|lock", "Segment Length|Seg 01,Seg 02", "Offset as Internal Line|rev,fit"]);
});

test("Phase 3 commands run in the booted app: distribute, fullness, pleats, slash & spread, and undo back to the start", () => {
  // starter outline: 0 neck (curve), 1 shoulder, 2 armhole (curve), 3 side seam (dart), 4 hem (curve), 5 centre front
  const r = boot({ script: `
    const out = {}, P = () => S.pieces[0], doc = () => JSON.stringify([S.pieces, S.seams]), start = doc();   // undo never rewinds the id counters, so compare pieces and seams
    const select = (i) => { S.sel = [P().id]; S.selKind = "outline"; S.selInt = -1; S.selPt = -1; S.selSeg = i; };
    const onSeg = (i, t) => app.toS(app.segPt(P(), i, t));
    const sound = () => { app.checkDoc(S.pieces, S.seams); return P().pts.length === P().segs.length && new Set(P().segs.map(s => s.id)).size === P().segs.length; };
    const perim = () => P().segs.reduce((L, s, i) => L + app.segLen(P(), i), 0);
    const L0 = perim(), hem0 = app.segLen(P(), 4), n0 = P().pts.length;
    let steps = 0, s;

    // with nothing selected the two-segment commands explain themselves instead of running
    S.selSeg = -1;
    app.answer = () => { throw new Error("dialog opened without a first segment"); };
    s = onSeg(4, 0.5); app.menuClick(s.x, s.y, "More ▸ Pleats\\u2026");
    out.hint = toasts[toasts.length-1];

    select(1); app.answer = () => ({ n: 3, straight: true, perp: false, grad: true });
    s = onSeg(4, 0.5); app.menuClick(s.x, s.y, "More ▸ Distribute Internal Lines between Segments\\u2026"); steps++;
    out.distributed = P().internals.length - 1; out.ok1 = sound();

    select(1); app.answer = (t, f) => { out.fullFields = f.map(x => x.label); return { a: 0, b: 60, n: 3 }; };
    s = onSeg(4, 0.4); app.menuClick(s.x, s.y, "More ▸ Fullness (Line)\\u2026"); steps++;
    out.grewBy = perim() - L0; out.ok2 = sound();

    select(1); app.answer = (t, f, o) => { out.pleatOpts = [o.selects[0].options.map(x => x[0]), o.checks.map(c => c.k)]; return { n: 2, d: 10, d2: 10, sa: 0, sb: 0, lines: 0, type: "box", notch: "both", rev: false }; };
    const hemNow = P().segs.findIndex((x, i) => i > 3 && x.curved);
    s = onSeg(hemNow, 0.4); app.menuClick(s.x, s.y, "More ▸ Pleats\\u2026"); steps++;
    out.folds = P().internals.filter(l => l.fold).length; out.ok3 = sound();
    out.pleatToast = toasts[toasts.length-1];

    for (let k = 0; k < steps; k++) app.undo();
    out.restored = doc() === start;

    // Fullness (Point): add 40 to the hem, hinged at the neck/shoulder point
    select(4); app.answer = () => ({ a: 40, n: 2 });
    s = app.toS(P().pts[1]); app.menuClick(s.x, s.y, "More ▸ Fullness (Point)\\u2026");
    out.pointGrew = perim() - L0; out.pivot = P().pts.filter(q => q.x === 68 && q.y === 12).length; out.ok4 = sound();
    app.undo();

    // Slash & Spread along the internal line (its ends are fitted to the hem first)
    app.answer = () => ({ open: 30, other: 0 });
    s = app.toS(P().internals[0].pts[2]); app.menuClick(s.x, s.y, "Slash & Spread\\u2026");
    out.slashed = [P().internals.length, P().pts.length - n0, toasts[toasts.length-1]]; out.ok5 = sound();
    app.undo();
    out.restored2 = doc() === start;

    // a spread that can't be made rolls the document back and leaves no undo step
    const depth = S.undo.length;
    app.answer = () => ({ open: 99999, other: 0 });
    s = app.toS(P().internals[0].pts[2]); app.menuClick(s.x, s.y, "Slash & Spread\\u2026");
    out.failed = [toasts[toasts.length-1], S.undo.length === depth, doc() === start];
    return out;` });
  assertUp(r, "script");
  const o = r.result, near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, m + ": " + a + " vs " + b);
  assert.ok(/Select the first segment/.test(o.hint), o.hint);
  assert.strictEqual(o.distributed, 3);
  assert.deepStrictEqual(o.fullFields, ["Seg 02", "Seg 05", "Slashes"]);
  near(o.grewBy, 60, 0.05, "Fullness (Line) added 60 to the hem");
  assert.deepStrictEqual(o.pleatOpts, [["knife", "box", "accordion"], ["rev"]]);
  assert.strictEqual(o.folds, 8, "two box pleats: four fold lines each (plus a centre line)");
  assert.strictEqual(o.pleatToast, "2 box pleats — each adds 40.0 mm");
  assert.ok(o.ok1 && o.ok2 && o.ok3 && o.ok4 && o.ok5, "the document stays valid after every command");
  assert.strictEqual(o.restored, true, "undo returns to the starter exactly");
  near(o.pointGrew, 40, 0.05, "Fullness (Point) added 40"); assert.strictEqual(o.pivot, 1);
  assert.strictEqual(o.slashed[0], 0, "the slash line is used up"); assert.strictEqual(o.slashed[2], "Slashed and spread");
  assert.strictEqual(o.restored2, true);
  assert.deepStrictEqual(o.failed, ["That spread can't be made", true, true]);
});

test("Phase 4 dart commands run in the booted app: cap choice, fold, rotate (whole and part), true up, undo", () => {
  const r = boot({ script: `
    const out = {}, P = () => S.pieces[0], doc = () => JSON.stringify([S.pieces, S.seams]), start = doc();
    const apex = () => app.toS(app.dartGeom(P(), P().darts[0]).apex);
    const sound = () => { app.checkDoc(S.pieces, S.seams); return P().pts.length === P().segs.length && new Set(P().segs.map(s => s.id)).size === P().segs.length; };
    out.starterFolded = P().darts[0].folded;
    const a0 = app.dartGeom(P(), P().darts[0]).apex;
    let s = apex(); app.menuClick(s.x, s.y, "Dart Cap 2");
    out.cap = P().darts[0].cap;
    s = apex(); app.menuClick(s.x, s.y, "Unfold Dart Cap");
    out.unfolded = P().darts[0].folded === false;
    s = apex(); app.menuClick(s.x, s.y, "Rotate Dart\\u2026");
    out.waiting = !!(S.draft && S.draft.rotDart); out.prompt = toasts[toasts.length-1];
    S.draft = null;
    // the click on the outline arrives as rotateNumeric(...): move 50% to the shoulder (edge 2)
    app.answer = (t, f) => { out.dlg = t + "|" + f.map(x => x.k + x.unit).join(","); return { pct: 50 }; };
    app.rotateNumeric({ x: 0, y: 0 }, P(), 0, P().segs[1].id, 0.5);
    out.afterSplit = [P().darts.length, toasts[toasts.length-1], sound()];
    out.sameApex = P().darts.every(d => { const g = app.dartGeom(P(), d); return Math.hypot(g.apex.x - a0.x, g.apex.y - a0.y) < 1e-6; });
    app.answer = () => ({ pct: 100 });
    app.rotateNumeric({ x: 0, y: 0 }, P(), 0, P().segs.find(x => x.id === P().darts[1].sid) ? P().segs[0].id : P().segs[0].id, 0.5);
    out.afterWhole = [P().darts.length, toasts[toasts.length-1], sound()];
    s = apex(); app.menuClick(s.x, s.y, "True Up (bake into outline)");
    out.afterTrue = [P().darts.length, sound()];
    // a refused rotation (onto the dart's own edge) rolls back and leaves no undo step
    const depth = S.undo.length, before = doc();
    app.rotateNumeric({ x: 0, y: 0 }, P(), 0, P().darts[0].sid, 0.5);
    out.refused = [toasts[toasts.length-1], S.undo.length === depth, doc() === before];
    while (S.undo.length) app.undo();
    out.restored = doc() === start;
    return out;` });
  assertUp(r, "script");
  const o = r.result;
  assert.strictEqual(o.starterFolded, true, "the starter's dart is folded");
  assert.strictEqual(o.cap, 2); assert.strictEqual(o.unfolded, true);
  assert.strictEqual(o.waiting, true); assert.strictEqual(o.prompt, "Click the outline where the dart should open");
  assert.strictEqual(o.dlg, "Rotate Dart|pct%");
  assert.deepStrictEqual(o.afterSplit, [2, "Dart split — 50% moved", true]);
  assert.strictEqual(o.sameApex, true, "both darts point at the original dart point");
  assert.deepStrictEqual(o.afterWhole, [2, "Dart rotated", true]);
  assert.deepStrictEqual(o.afterTrue, [1, true]);
  assert.deepStrictEqual(o.refused, ["Click a different edge from the one the dart is on", true, true]);
  assert.strictEqual(o.restored, true);
});

test("Phase 5 commands run in the booted app: corner types, round by length, notch settings, notch to intersection", () => {
  const r = boot({ script: `
    const out = {}, P = () => S.pieces[0];
    const corner = () => app.toS(P().pts[4]);                  // side seam meets hem at (168,480)
    let s = corner(); app.menuClick(s.x, s.y, "More ▸ Seam Allowance Corner ▸ Turnback");      // (Round r15 / 3: the reference's names; it was Mirror)
    out.mirror = P().segs[4].corner;
    app.answer = (t, f) => { out.roundDlg = t + "|" + f.map(x => x.k).join(","); return { r: 5 }; };
    s = corner(); app.menuClick(s.x, s.y, "More ▸ Seam Allowance Corner ▸ Round");      // (Round r15 / 3: was Round Corner…; Round r25: no box, the reference's Round has no rows)
    out.round = P().segs[4].corner;
    s = corner(); app.menuClick(s.x, s.y, "More ▸ Seam Allowance Corner ▸ Extension");      // (Round r15 / 3: was Default Corner)
    out.back = P().segs[4].corner === undefined;
    out.undoSteps = S.undo.length;
    // notch settings: a document setting, saved with it, not an undo step
    app.answer = (t, f, o) => { out.notchDlg = [t, f.map(x => x.k), o.selects[0].options.map(x => x[0]), o.colors[0].k, o.checks[0].k]; return { len: 8, width: 2, type: "T", color: "#0000ff", dup: false }; };
    app.menuClick(3, 3, "More ▸ Notch Settings\\u2026");      // (Round r15 / 10: the empty canvas's menu is the reference's; this program's own rows under More ▸)
    out.notch = S.notch; out.saved = JSON.parse(app.docJSON()).notch; out.noUndo = S.undo.length === out.undoSteps;
    // fit the internal line to the hem, then notch where it lands
    const it = () => P().internals[0];
    s = app.toS(it().pts[2]); app.menuClick(s.x, s.y, "Extend/Trim to Pattern Outline");
    s = app.toS(it().pts[0]); app.menuClick(s.x, s.y, "Extend/Trim to Pattern Outline");
    const before = P().segs[4].notches.length;
    s = app.toS(it().pts[1]); app.menuClick(s.x, s.y, "Add Notch to Intersection");
    out.notches = P().segs[4].notches.length - before; out.toast = toasts[toasts.length-1];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assertUp(r, "script");
  const o = r.result;
  // (Round r15 / 3: Turnback starts on Line 1. Round r25, the third check session Number 15: Line 1 is the line coming into the point,
  // whichever way the outline runs; before, it was the line leaving it here)
  assert.deepStrictEqual(o.mirror, { t: "turn", on: "in" });
  // (Round r25: Round asks for no length; it was "Round|r" and { t: "round", r: 5 })
  assert.strictEqual(o.roundDlg, undefined); assert.deepStrictEqual(o.round, { t: "round" });
  assert.strictEqual(o.back, true);
  assert.deepStrictEqual(o.notchDlg, ["Notch Settings", ["len", "width"], ["I", "T", "V"], "color", "dup"]);
  assert.deepStrictEqual(o.notch, { type: "T", len: 8, color: "#0000ff", width: 2, dup: false });
  assert.deepStrictEqual(o.saved, o.notch); assert.strictEqual(o.noUndo, true);
  assert.strictEqual(o.notches, 2); assert.strictEqual(o.toast, "2 notches added");
});

test("Phase 6 commands run in the booted app: symmetric, instance, layer clone, with sewing, position-only paste, symmetric unfold, unlink", () => {
  const r = boot({ script: `
    const out = {}, P = () => S.pieces[0], body = () => app.toS({ x: 8, y: 250 });   // left of where the layer clone lies
    const pick = (i) => { S.sel = [S.pieces[i].id]; };
    // a copy hangs on the pointer until a click sets it down: dx, dy = how far from the pattern that click is
    const onBody = (name, dx, dy) => { S.sel = [P().id]; const s = body(); app.menuClick(s.x, s.y, name);
      if (dx !== undefined) { const b = app.bboxOf([P()]), c = app.toS({ x: (b.x0 + b.x1)/2 + dx, y: (b.y0 + b.y1)/2 + dy }); app.click(c.x, c.y); } };
    const wide = app.bboxOf([P()]).x1 - app.bboxOf([P()]).x0 + 40;
    // a seam that joins the starter to itself, for "with Sewing"
    S.seams.push({ id: 1, a: [{ piece: 1, shape: 0, sids: [P().segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: 1, shape: 0, sids: [P().segs[3].id], t0: 0, t1: 1, rev: false }] });
    onBody("Clone with Linked Editing ▸ Symmetric Pattern", wide, 0);
    onBody("Clone with Linked Editing ▸ Instance Pattern", wide, 0);
    onBody("Layer Clone ▸ Over", 20, 20);
    onBody("Clone with Linked Editing ▸ Symmetric Pattern (with Sewing)", wide, 0);
    out.kinds = S.pieces.slice(1).map(q => [q.name, q.link.kind, q.layer]);
    out.seams = S.seams.map(sm => [sm.a[0].piece, sm.b[0].piece]);
    out.sewToast = toasts[toasts.length-1];
    out.mirrored = S.pieces[1].pts[1].x > P().pts[1].x && Math.abs((S.pieces[2].pts[1].x - S.pieces[2].pts[0].x) - (P().pts[1].x - P().pts[0].x)) < 1e-9;
    // edit the source: every copy follows
    P().pts[1] = { x: 80, y: 30 }; app.commit();
    out.follow = S.pieces.slice(1).map(q => q.pts.length === P().pts.length);
    const before = JSON.stringify(S.pieces[2].pts);
    // unlink the instance from its own menu (right-click its body)
    pick(2); let s = app.toS({ x: S.pieces[2].pts[5].x + 20, y: 250 }); app.menuClick(s.x, s.y, "More ▸ Remove Instance");
    out.unlinked = S.pieces[2].link === undefined && JSON.stringify(S.pieces[2].pts) === before;
    // right-clicking a point of a linked copy offers the pattern menu with the reason, not point editing
    const cp1 = S.pieces[1]; s = app.toS(cp1.pts[2]);
    app.menu.children.length = 0; app.showMenu({ clientX: s.x, clientY: s.y });
    out.copyMenu = app.menu.children.map(c => c.className === "hd" ? "# " + (c.textContent || c.innerHTML) : c.innerHTML.replace(/<[^>]+>/g, "|"));
    out.noPointItems = !app.menu.children.some(c => /Delete Point/.test(c.innerHTML));
    // position-only mirror paste
    S.clip = [JSON.parse(JSON.stringify(P()))];
    const n = S.pieces.length; onBody("More ▸ Mirror Paste (Position Only)");
    const pasted = S.pieces[n];
    out.pasted = [S.pieces.length - n, pasted.pts[1].x - pasted.pts[0].x === P().pts[1].x - P().pts[0].x, pasted.pts[0].x > P().pts[2].x];
    // symmetric unfold of the starter across its centre front (edge 6)
    S.sel = [P().id]; const cf = app.toS(app.segPt(P(), 5, 0.5)); app.menuClick(cf.x, cf.y, "Unfold Symmetric Editing (with Sewing)");
    out.half = [!!P().half, P().pts.length, P().darts.length, P().internals.length];
    app.checkDoc(S.pieces, S.seams);
    S.pieces.slice(1).forEach(q => { q.on = false; });          // the unfolded piece now lies under its own layer clone
    onBody("More ▸ Remove Half Symmetry");
    out.plain = P().half === undefined && P().pts.length === 10;
    return out;` });
  assertUp(r, "script");
  const o = r.result;
  assert.deepStrictEqual(o.kinds, [["Front bodice ⇄", "symmetric", 0], ["Front bodice ≡", "instance", 0], ["Front bodice (over)", "instance", 1], ["Front bodice ⇄", "symmetric", 0]]);
  assert.deepStrictEqual(o.seams, [[1, 1], [5, 5]], "only the with-sewing copy repeats the seam");
  assert.ok(/1 seam repeated/.test(o.sewToast), o.sewToast);
  assert.strictEqual(o.mirrored, true); assert.deepStrictEqual(o.follow, [true, true, true, true]);
  assert.strictEqual(o.unlinked, true);
  assert.ok(!o.copyMenu.some(t => /Linked copy/.test(t)) && o.copyMenu.some(t => /^[|]Delete Point[|]/.test(t)), JSON.stringify(o.copyMenu));      // (the point's menu, W57, since Round G1)
  assert.strictEqual(o.noPointItems, false, "since R4 a linked copy is edited directly: its points have the point commands");
  assert.deepStrictEqual(o.pasted, [1, true, true]);
  assert.deepStrictEqual(o.half, [true, 10, 2, 2], "both halves: 10 points, the dart and the internal line doubled");
  assert.strictEqual(o.plain, true);
});

test("Phase 7 commands run in the booted app: guidelines, Walk Pattern with notches, measurements, undo", () => {
  const r = boot({ script: `
    const out = {}, P = () => S.pieces[0], doc = () => JSON.stringify([S.pieces, S.seams, S.guides, S.measures]), start = doc();
    const onSeg = (i, t) => app.toS(app.segPt(P(), i, t)), onPt = (i) => app.toS(P().pts[i]);
    let s;
    // guideline along the shoulder (edge 2), and one through two points (point 4 selected, point 6 right-clicked)
    s = onSeg(1, 0.4); app.menuClick(s.x, s.y, "Add Guideline along Points");
    S.sel = [P().id]; S.selKind = "outline"; S.selInt = -1; S.selSeg = -1; S.selPt = 3;
    s = onPt(5); app.menuClick(s.x, s.y, "More ▸ Add Guideline along Points");
    out.guides = S.guides.map(g => [g.id, +Math.tan(g.a).toFixed(4)]);
    // right-click the second guideline well away from the pattern: turn it, then delete it
    const far = (g, k) => app.toS({ x: g.p.x + Math.cos(g.a)*k, y: g.p.y + Math.sin(g.a)*k });
    app.answer = (t, f) => { out.dlg = t + "|" + f[0].unit; return { a: 30 }; };
    s = far(S.guides[1], -700); app.menuClick(s.x, s.y, "Rotate Guideline\\u2026");
    out.turned = +(S.guides[1].a*180/Math.PI).toFixed(6);
    s = far(S.guides[1], -200); app.menuClick(s.x, s.y, "Delete Guideline");
    out.left = S.guides.map(g => g.id);
    // pick the remaining guideline up and move it: its new place is where it was dropped
    const g0 = S.guides[0]; s = far(g0, 600);
    out.grabbed = app.grabGuide(s.x, s.y, app.toW(s.x, s.y)); S.drag = null;
    app.menuClick(3, 3, "More ▸ Delete All Guidelines");      // (Round r15 / 10: under More ▸)
    out.none = S.guides.length;

    // Walk Pattern's order: first the edge that is walked (the centre front, from the neck point down), then the
    // edge it is walked along (the shoulder, from its neck end)
    app.setTool("walk");
    s = onSeg(5, 0.9); app.walkClick(s.x, s.y, { shiftKey: false });
    out.first = [S.walk.B.start, S.walk.B.dir, S.walk.A, app.walkLive()];
    s = onSeg(1, 0.2); app.walkClick(s.x, s.y, { shiftKey: false });
    out.second = [S.walk.A.start, S.walk.A.dir, app.walkLive()];
    app.walkMove(app.segPt(P(), 1, 0.5));
    out.walked = S.walk.s;
    const n1 = P().segs[1].notches.length, n5 = P().segs[5].notches.length;
    app.walkClick(0, 0, { shiftKey: false });
    out.notched = [P().segs[1].notches.length - n1, P().segs[5].notches.length - n5, toasts[toasts.length-1]];
    out.nt = [P().segs[1].notches[P().segs[1].notches.length-1], P().segs[5].notches[P().segs[5].notches.length-1]];
    // a sewn edge finds its partner by itself
    S.seams.push({ id: 1, a: [{ piece: 1, shape: 0, sids: [P().segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: 1, shape: 0, sids: [P().segs[3].id], t0: 0, t1: 1, rev: true }] });
    app.setTool("walk");
    s = onSeg(1, 0.1); app.walkClick(s.x, s.y, { shiftKey: false });
    out.auto = [S.walk.A && S.walk.A.start, S.walk.A && S.walk.A.dir, toasts[toasts.length-1]];
    S.seams.length = 0;

    // measurements: neck point to hem corner straight, then armhole ends along the outline
    app.setTool("measure");
    s = onPt(1); app.measureClick(s.x, s.y, { shiftKey: false });
    out.pending = !!(S.draft && S.draft.meas);
    s = onPt(4); app.measureClick(s.x, s.y, { shiftKey: false });
    s = onPt(2); app.measureClick(s.x, s.y, { shiftKey: false });
    s = onPt(4); app.measureClick(s.x, s.y, { shiftKey: true });
    out.measures = S.measures.map(m => [m.id, m.kind, +app.measureInfo(m, S.pieces).len.toFixed(3)]);
    out.expect = [Math.hypot(168-68, 480-12), app.segLen(P(), 2) + app.segLen(P(), 3)].map(x => +x.toFixed(3));
    out.panel = /Measurements/.test(app.el("props").innerHTML);
    // delete the first from its label (drawn at the middle of its line)
    const a = P().pts[1], b = P().pts[4]; s = app.toS({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 });
    app.menuClick(s.x, s.y, "Delete");      // (Round r15 / 10: the reference's row; it was "Delete Measurement")
    out.afterDelete = S.measures.map(m => m.id);
    app.checkDoc(S.pieces, S.seams);
    while (S.undo.length) app.undo();
    out.restored = doc() === start;
    return out;` });
  assertUp(r, "script");
  const o = r.result, near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, m + ": " + a + " vs " + b);
  assert.deepStrictEqual(o.guides, [[1, 0.25], [2, +((495-220)/(0-150)).toFixed(4)]], "one along the shoulder (slope 30/120), one through the two points");
  assert.strictEqual(o.dlg, "Rotate Guideline|°"); near(o.turned, 30, 1e-6, "turned to 30°");
  assert.deepStrictEqual(o.left, [1]); assert.strictEqual(o.grabbed, true); assert.strictEqual(o.none, 0);
  assert.deepStrictEqual(o.first, [0, -1, null, false], "the walked edge: the centre front from the neck point, backward (down the front); nothing to walk along yet");
  assert.deepStrictEqual(o.second, [1, 1, true], "the stationary edge: the shoulder from its neck end, forward");
  near(o.walked, Math.hypot(120, 30)/2, 0.01, "half-way along the shoulder");
  assert.deepStrictEqual(o.notched.slice(0, 2), [1, 1]); assert.ok(/both edges/.test(o.notched[2]), o.notched[2]);
  near(o.nt[0], 0.5, 1e-6, "notch half-way along the shoulder"); near((1 - o.nt[1])*495, Math.hypot(120, 30)/2, 0.01, "and the same distance down the centre front");
  assert.deepStrictEqual(o.auto.slice(0, 2), [4, -1], "sewn reversed to the side seam: its partner starts at the side seam's far end, walking backward");
  assert.ok(/Walking along seam S1/.test(o.auto[2]));
  assert.strictEqual(o.pending, true);
  assert.deepStrictEqual(o.measures.map(m => [m[0], m[1]]), [[1, "line"], [2, "along"]]);
  near(o.measures[0][2], o.expect[0], 0.001, "straight"); near(o.measures[1][2], o.expect[1], 0.001, "along the armhole and side seam");
  assert.strictEqual(o.panel, true); assert.deepStrictEqual(o.afterDelete, [2]);
  assert.strictEqual(o.restored, true, "undo takes guidelines, notches and measurements back out");
});

test("Phase 8 in the booted app: the View menu flips and saves switches, a saved view comes back, annotations and reference lines work", () => {
  const fresh = boot();
  assert.strictEqual(fresh.show.angle, false); assert.strictEqual(fresh.show.sa, true);
  assert.strictEqual(fresh.storage["pdraft:view"], undefined, "nothing is written until a switch is changed");
  const r = boot({ script: `
    const out = {}, P = () => S.pieces[0];
    const items = () => app.menu.children.filter(c => c.className === "mi").map(c => c.innerHTML.replace(/<[^>]+>/g, "").trim());
    const click = (name) => { const it = app.menu.children.filter(c => c.className === "mi").find(c => c.innerHTML.includes(name + "</span>")); it.onclick(); };
    app.menu.children.length = 0; app.showViewMenu(10, 900);
    out.items = items();
    click("Angle"); app.menu.children.length = 0; app.showViewMenu(10, 900);
    click("Grainline");
    out.show = { angle: S.show.angle, grainline: S.show.grainline };
    app.menu.children.length = 0; app.showViewMenu(10, 900);
    out.ticks = items().filter(t => t.startsWith("\\u2713")).length;
    // a reference line is a base line with the ref mark; an annotation is added where the pattern is right-clicked
    let s = app.toS({ x: 20, y: 250 });
    S.sel = [P().id]; app.menuClick(s.x, s.y, "Clone as Reference Line");
    out.ref = P().bases.map(b => b.ref === true);
    app.promptAnswer = "  cut 2 on fold  ";
    app.menuClick(s.x, s.y, "More ▸ Add Annotation\\u2026");
    out.notes = JSON.parse(JSON.stringify(P().notes));
    s = app.toS(P().notes[0]); app.promptAnswer = "cut 1";
    app.menuClick(s.x, s.y, "More ▸ Edit Annotation\\u2026");      // (Round r15 / 10: this program's own row, under More ▸)
    out.edited = P().notes[0].text;
    app.setView("annotations", false);
    app.menu.children.length = 0; app.showMenu({ clientX: s.x, clientY: s.y });
    out.hiddenNote = !app.menu.children.some(c => /Delete Annotation/.test(c.innerHTML));
    app.setView("annotations", true);
    app.menuClick(s.x, s.y, "Delete");      // (Round r15 / 10: the reference's row; it was "Delete Annotation")
    out.gone = P().notes.length;
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assertUp(r, "script");
  const o = r.result;
  assert.deepStrictEqual(o.items.map(t => t.replace(/^[✓  ]+/, "")), ["Sewing", "2D Sewing Lengths" /* (Round r20 / 3) */, "Topstitch", "Puckering", "Baseline", "Seam Allowance", "Grading", "Reference Line", "Symmetric/Instance Lines", "Link Lines", "Pins",
    "Pattern Name", "Annotations", "Line Length", "Angle", "Grainline", "2D Measurements", "Ruler", "Guideline", "Lock All Pattern Outlines", "Lock All Internal Lines", "Lock All Baselines", "Lock All Guidelines", "Show All", "Reset to Defaults"]);      // (Round build-1: Lock All Internal Lines, Lock All Baselines (on from the start) and Lock All Guidelines are built)
  assert.deepStrictEqual(o.show, { angle: true, grainline: false });
  // (Round r17a / 3: Show Sewing is off whenever the program starts: one tick fewer than the sixteen before)
  assert.strictEqual(o.ticks, 16, "sixteen of the twenty-two switches are on (grainline off, pattern lock off, Show Grading off since Round I2, Sewing off since Round r17a; since build-1 / 3 Lock All Baselines on, the other two locks off)");
  assert.deepStrictEqual(o.ref, [true]);
  assert.strictEqual(o.notes.length, 1); assert.strictEqual(o.notes[0].text, "cut 2 on fold");
  assert.ok(Math.abs(o.notes[0].x - 20) < 1e-6 && Math.abs(o.notes[0].y - 250) < 1e-6, "placed where it was clicked");
  assert.strictEqual(o.edited, "cut 1"); assert.strictEqual(o.hiddenNote, true, "a hidden annotation can't be right-clicked"); assert.strictEqual(o.gone, 0);
  // what was saved, and a new session picking it up
  // (Round r23 / 1: every start looks the same) the switches are view state: nothing is written, and a view saved by an
  // older build is not read: the next session starts with the defaults
  assert.strictEqual(r.storage["pdraft:view"], undefined, "nothing written");
  const saved = { ...fresh.show, angle: true, grainline: false };

  const next = boot({ view: JSON.stringify(saved) });
  assertUp(next, "next session");
  assert.deepStrictEqual(next.show, fresh.show, "the next session starts with the defaults, whatever was saved");
  // everything hidden still boots and draws; junk in the saved view is ignored
  const dark = boot({ view: JSON.stringify(Object.fromEntries(Object.keys(saved).map(k => [k, false]))) });
  assertUp(dark, "all hidden"); assert.deepStrictEqual(dark.show, fresh.show);
  const junk = boot({ view: "{{{" });
  assertUp(junk, "junk view"); assert.deepStrictEqual(junk.show, fresh.show);
});

test("Phase 9 in the booted app: New Block adds a sewn skirt, Edit Block redrafts it, it saves, reloads and undoes", () => {
  const r = boot({ script: `
    const out = {}, doc = () => JSON.stringify([S.pieces, S.seams]), start = doc();
    const btn = { currentTarget: { getBoundingClientRect: () => ({ left: 900, top: 600 }) } };
    app.answer = (t, f, o) => { out.simple = [t, f.map(x => x.label), o.selects[0].options.map(x => x[0]), !!o.onSelect, o.wide]; return { level: "simple", "f.length": 550, "f.waistline": 190, "f.hipWidth": 250, "b.waistline": 175, "b.hipWidth": 255 }; };
    app.el("blk").onclick(btn);
    out.added = [S.pieces.length, S.seams.length, S.pieces.slice(1).map(p => p.name), toasts[toasts.length-1]];
    out.diffs = S.seams.map(sm => +app.seamInfo(sm, S.pieces).diff.toFixed(2));
    out.clear = S.pieces[1].pts.every(q => q.x > S.pieces[0].pts.reduce((m, r) => Math.max(m, r.x), -1e9));
    app.checkDoc(S.pieces, S.seams);
    // the panel offers Edit Block for a block piece; the right-click menu too
    const front = S.pieces[1];
    S.sel = [front.id]; app.commit();
    out.panel = /Straight skirt/.test(app.el("props").innerHTML) && /Edit Block/.test(app.el("props").innerHTML);
    // it opens at the level the block was made with, showing the values it was made with; the first answer just switches to General
    const same = (f) => { const v = {}; for (const x of f) v[x.k] = x.val; return v; };
    app.answer = (t, f) => { out.edit = [t, f.length, f.find(x => x.k === "f.length").val]; return { ...same(f), level: "general" }; };
    const c = app.toS({ x: front.pts[0].x + 60, y: front.pts[0].y + 300 });
    app.menuClick(c.x, c.y, "More ▸ Edit Block\\u2026");
    // opened again it is at General: every spec is there, the derived ones showing what they were derived as
    app.answer = (t, f) => { out.general = [f.length, f.find(x => x.k === "b.length").val, f.find(x => x.k === "b.darts").unit]; return { ...same(f), level: "general", "f.length": 700, "b.darts": 2 }; };
    app.menuClick(c.x, c.y, "More ▸ Edit Block\\u2026");
    const legs = (p) => S.seams.filter(sm => sm.a[0].piece === p.id && sm.b[0].piece === p.id).length;
    out.edited = [S.pieces.length, S.seams.length, legs(S.pieces[2]), legs(S.pieces[3]), toasts[toasts.length-1], S.pieces.slice(1).every(p => !p.darts.length)];
    out.diffs2 = S.seams.map(sm => +app.seamInfo(sm, S.pieces).diff.toFixed(2));
    out.saved = JSON.parse(app.docJSON()).pieces[1].block;
    app.checkDoc(S.pieces, S.seams);
    while (S.undo.length) app.undo();
    out.restored = doc() === start;
    return out;` });
  assertUp(r, "script");
  const o = r.result;
  assert.deepStrictEqual(o.simple, ["Straight skirt", ["Front waistline", "Front hip width", "Length", "Back waistline", "Back hip width", "Waist ease", "Hip ease"], ["simple", "general"], true, true]);
  // Round F / 7: a block's darts are made into its outlines, their legs sewn to each other: the skirt's four. (The starter this
  // test boots with is put in by boot-child.js as the program used to start, its dart still a dart object)
  assert.deepStrictEqual(o.added.slice(0, 3), [5, 8 + 4,      // Round r17a / 4: one seam more, the waistband closed at the centre back
    ["Skirt front", "Skirt back", "Skirt back (mirror)", "Skirt waistband"]]);
  assert.ok(/Straight skirt added — side seam .* every measurement met/.test(o.added[3]), o.added[3]);
  assert.ok(o.diffs.every(d => Math.abs(d) <= 0.03), "every seam matches: " + o.diffs);
  assert.strictEqual(o.clear, true, "placed to the right of what was there"); assert.strictEqual(o.panel, true);
  assert.deepStrictEqual(o.edit, ["Straight skirt — edit", 7, 550]);
  assert.deepStrictEqual(o.general, [22, 550, ""], "General asks for all twenty-two; the back length was following the front; a count has no unit");
  assert.deepStrictEqual(o.edited.slice(0, 4), [5, 8 + 6, 2, 2], "two back darts on the back and on its mirror, sewn leg to leg"); assert.ok(/redrafted/.test(o.edited[4]), o.edited[4]);
  assert.strictEqual(o.edited[5], true, "no dart objects on the skirt");
  assert.ok(o.diffs2.every(d => Math.abs(d) <= 0.03), "still matching after the redraft: " + o.diffs2);
  assert.strictEqual(o.saved.type, "skirt"); assert.strictEqual(o.saved.level, "general"); assert.strictEqual(o.saved.given["f.length"], 700);
  assert.strictEqual(o.restored, true);
});

test("Phase 10 in the booted app: sizes, proportional grading, arrow-key nudges, rules, curve grading, undo", () => {
  const fresh = boot();
  assert.deepStrictEqual(JSON.parse(fresh.storage["pdraft:doc"]).grading.groups[0].sizes.map(z => z.name), ["XS", "S", "M", "L", "XL"], "a new document is saved with the placeholder size run");
  const r = boot({ script: `
    const out = {}, P = () => S.pieces[0], G = () => S.grading, doc = () => JSON.stringify([S.pieces, S.grading.groups, S.grading.tables]), start = doc();
    const body = app.toS({ x: 20, y: 250 }), key = { preventDefault() {} };
    out.panel = /Grading/.test(app.el("ob-grading").innerHTML) && /class="chip base"/.test(app.el("ob-grading").innerHTML);
    // with no size picked, or the base, arrows do nothing to the grading
    S.sel = [P().id]; S.selKind = "outline"; S.selInt = -1; S.selPt = 2; S.selSeg = -1;
    out.idle = app.gradeNudge({ key: "ArrowRight" });
    app.answer = (t, f) => { out.propDlg = t + "|" + f.map(x => x.k).join(","); return { w: 24, h: 12 }; };
    app.menuClick(body.x, body.y, "More ▸ Proportional Grading\\u2026");
    out.graded = [Object.keys(P().grade.pts).length, G().nest];
    // pick size L (id 4) and nudge point 3 (the shoulder tip): right once, Shift-down once
    G().active = 4; S.sel = [P().id]; S.selPt = 2; S.selSeg = -1; S.selKind = "outline"; S.selInt = -1;
    const before = app.gradedPiece(G(), P(), 4).pts[2];
    const xlBefore = app.gradedPiece(G(), P(), 5).pts[2];
    out.nudged = [app.gradeNudge({ key: "ArrowRight" }), app.gradeNudge({ key: "ArrowDown", shiftKey: true })];
    const after = app.gradedPiece(G(), P(), 4).pts[2];
    out.moved = [+(after.x - before.x).toFixed(6), +(after.y - before.y).toFixed(6)];
    out.otherSize = app.gradedPiece(G(), P(), 5).pts[2].x - xlBefore.x;
    // the point's menu: its offsets in the header, the typed dialog, save as a rule, assign that rule to another point
    let s = app.toS(P().pts[2]);
    app.menu.children.length = 0; app.showMenu({ clientX: s.x, clientY: s.y });
    // (Round G1: the point's grading commands are under More ▸ Grading, its offsets in that submenu's header)
    const openRow = (el, n) => el.children.find(c => c.innerHTML.includes("<span>" + n + "</span>")).onclick({ stopPropagation() {} }), lastSub = () => app.ev("menuSubs")[app.ev("menuSubs").length - 1];
    openRow(app.menu, "More"); openRow(lastSub(), "Grading");
    out.header = lastSub().children.filter(c => c.className === "hd").map(c => c.textContent || c.innerHTML).find(t => /^Grading/.test(t));
    app.answer = (t, f) => { out.dlg = [t, f.map(x => x.val)]; return { dx: 30, dy: 5 }; };   // typed dY is positive upward
    app.menuClick(s.x, s.y, "More ▸ Grading ▸ Grading\\u2026");
    out.typed = app.gradedPiece(G(), P(), 4).pts[2];
    app.promptAnswer = "shoulder tip";
    app.menuClick(s.x, s.y, "More ▸ Grading ▸ Save as Rule\\u2026");
    out.rule = [G().tables.length, Object.keys(G().tables[0].rules), P().grade.table === G().tables[0].id];
    s = app.toS(P().pts[1]); app.menuClick(s.x, s.y, "More ▸ Grading ▸ Assign Rule: shoulder tip");
    out.assigned = app.gradedPiece(G(), P(), 4).pts[1];
    app.menuClick(s.x, s.y, "More ▸ Grading ▸ Convert to Non-Grade Point");
    out.entries = Object.keys(P().grade.pts).length;
    // curve grading on the armhole (edge 3), by dialog and by arrow key
    s = app.toS(app.segPt(P(), 2, 0.5));
    app.menuClick(s.x, s.y, "More ▸ Convert to Handle Curve");            // Curve Grading is for handle curves: the armhole is made one first
    app.answer = (t) => { out.curveDlg = t; return { ax: 4, ay: 0, bx: 2, by: 0 }; };
    app.menuClick(s.x, s.y, "More ▸ Curve Grading\\u2026");
    S.sel = [P().id]; S.selPt = -1; S.selSeg = 2; S.selKind = "outline"; S.selInt = -1;
    app.gradeNudge({ key: "ArrowRight" });
    out.curve = P().grade.curves["0:" + P().segs[2].id];
    // a new size on the end, from the panel button
    app.promptAnswer = "XXL"; app.el("g-add").onclick();
    out.sizes = G().groups[0].sizes.map(z => z.name);
    out.xxl = Object.keys(G().tables[0].rules["shoulder tip"]).length;
    app.checkDoc(S.pieces, S.seams);
    while (S.undo.length) app.undo();
    out.restored = doc() === start;
    return out;` });
  assertUp(r, "script");
  const o = r.result, near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, m + ": " + a + " vs " + b);
  assert.strictEqual(o.panel, true); assert.strictEqual(o.idle, false);
  assert.strictEqual(o.propDlg, "Proportional Grading|w,h"); assert.deepStrictEqual(o.graded, [6, true], "six grade points, and the nest is shown");
  assert.deepStrictEqual(o.nudged, [true, true]); assert.deepStrictEqual(o.moved, [1, 10], "1 mm right, 10 mm down");
  near(o.otherSize, 0, 1e-9, "XL is untouched by a nudge to L");
  assert.ok(/^Grading · L: dX .* dY .* · grade point$/.test(o.header), o.header);
  assert.strictEqual(o.dlg[0], "Grading · size L");
  near(o.typed.x, 188 + 30, 1e-9, "typed dX"); near(o.typed.y, 42 - 5, 1e-9, "typed dY");
  assert.deepStrictEqual(o.rule, [1, ["shoulder tip"], true]);
  near(o.assigned.x, 68 + 30, 1e-9, "the other point now follows the rule"); assert.strictEqual(o.entries, 5);
  assert.strictEqual(o.curveDlg, "Curve Grading · size L");
  assert.deepStrictEqual(o.curve, { c1: { 4: { dx: 5, dy: 0 } }, c2: { 4: { dx: 3, dy: 0 } } }, "typed 4 and 2, then one arrow press on both");
  assert.deepStrictEqual(o.sizes, ["XS", "S", "M", "L", "XL", "XXL"]); assert.strictEqual(o.xxl, 5, "the rule has a value for the new size");
  assert.strictEqual(o.restored, true, "undo takes sizes, tables and grading back out");
});

test("Phase 11 in the booted app: a print job from the settings, DXF export through its dialog, DXF import back in, undo", () => {
  const r = boot({ script: `
    const out = {}, doc = () => JSON.stringify([S.pieces, S.seams]), start = doc();
    out.printDefault = [S.print.paper, S.print.mode, Object.keys(S.print.lines).length, Object.keys(S.print.info).length];
    const job = app.printJob();
    out.job = [job.plan.cols, job.plan.rows, job.tiles.length, (job.html.match(/<svg /g) || []).length, /@page \\{ size: 210mm 297mm/.test(job.html)];
    S.print.paper = "roll36"; out.roll = [app.printJob().plan.pw, app.printJob().tiles.length];
    S.print.paper = "a4"; S.print.mode = "fit"; out.fit = [app.printJob().tiles.length, app.printJob().plan.scale < 1];
    S.print.selected = true; S.sel = []; out.none = app.printJob();
    // export: the dialog's answer is turned into a file; capture it instead of downloading
    let file = null;
    app.setDownload((name, text) => { file = { name, text }; });
    app.answer = (t, f, o) => { out.exportDlg = [t, f.map(x => x.k), o.selects.map(x => x.k), o.checks.map(x => x.k)]; return { scale: 1, rotate: 0, format: "aama", units: "inch", straight: false, optimise: true, nobase: false, nograde: true, dup: false, selected: false }; };
    app.dxfOutNumeric({ x: 0, y: 0 });
    out.file = [file.name, /ANSI\\/AAMA/.test(file.text), /UNITS: ENGLISH/.test(file.text), toasts[toasts.length-1]];
    // import it again, appended: a second bodice beside the first
    app.answer = (t, f, o) => { out.importDlg = [t, o.checks.map(x => x.k)]; return { scale: 1, angle: 0, append: true, auto: true, swap: false, tosa: true, optimise: true, notches: true, internals: true, anno: true, distribute: false }; };
    app.dxfInNumeric({ x: 0, y: 0 }, file.text, "pattern.dxf");
    const a = S.pieces[0], b = S.pieces[1];
    out.imported = [S.pieces.length, b.name, b.pts.length, b.segs.map(x => x.sa), b.segs.map(x => x.curved), toasts[toasts.length-1]];
    out.lengths = a.segs.map((x, i) => +(app.segLen(a, i) - app.segLen(b, i)).toFixed(2));
    out.apart = Math.min(...b.pts.map(q => q.x)) > Math.max(...a.pts.map(q => q.x));
    app.checkDoc(S.pieces, S.seams);
    // a file that isn't a pattern changes nothing
    const n = S.undo.length;
    app.dxfInNumeric({ x: 0, y: 0 }, "not a dxf", "junk.dxf");
    out.junk = [toasts[toasts.length-1], S.undo.length === n, S.pieces.length];
    while (S.undo.length) app.undo();
    out.restored = doc() === start;
    return out;` });
  assertUp(r, "script");
  const o = r.result;
  assert.deepStrictEqual(o.printDefault, ["a4", "actual", 9, 7]);
  assert.deepStrictEqual(o.job.slice(0, 2), [2, 2]); assert.strictEqual(o.job[2], o.job[3], "a page per sheet"); assert.strictEqual(o.job[4], true);
  assert.deepStrictEqual(o.roll, [914.4, 1]); assert.deepStrictEqual(o.fit, [1, true]); assert.strictEqual(o.none, null);
  assert.deepStrictEqual(o.exportDlg, ["Export DXF", ["scale", "rotate"], ["format", "units"], ["straight", "optimise", "nobase", "nograde", "dup", "selected"]]);
  assert.deepStrictEqual(o.file, ["pattern.dxf", true, true, "1 pattern written as DXF-AAMA, inches"]);
  assert.deepStrictEqual(o.importDlg, ["Import DXF", ["append", "auto", "swap", "tosa", "optimise", "notches", "internals", "anno", "distribute"]]);
  assert.deepStrictEqual(o.imported.slice(0, 5), [2, "Front bodice", 6, [10, 10, 10, 10, 10, 0], [true, false, true, false, true, false]]);
  assert.ok(/1 pattern imported from pattern.dxf/.test(o.imported[5]));
  assert.ok(o.lengths.every(d => Math.abs(d) < 0.3), "every edge of the copy is the length of the original: " + o.lengths);
  assert.strictEqual(o.apart, true, "placed beside what was there");
  assert.deepStrictEqual(o.junk, ["No pattern outline was found in that file", true, 2]);
  assert.strictEqual(o.restored, true);
});

const CORRUPT = {
  "truncated JSON": () => JSON.stringify(good()).slice(0, 300),
  "not JSON": () => "hello",
  "JSON null": () => "null",
  "JSON array": () => "[]",
  "pieces is an object": () => JSON.stringify({ pieces: { a: 1 } }),
  "piece without segs": () => mutate(d => { delete d.pieces[0].segs; }),
  "piece without pts": () => mutate(d => { delete d.pieces[0].pts; }),
  "fewer segments than points": () => mutate(d => { d.pieces[0].segs.pop(); }),
  "curved segment with no handle": () => mutate(d => { d.pieces[0].segs[0].c1 = null; delete d.pieces[0].segs[0].cps; }),
  "curve points that are not points": () => mutate(d => { d.pieces[0].segs[0].cps = [{ x: 1, y: 2, u: 0.5 }, { x: "a", y: 2, u: 0.7 }]; d.pieces[0].segs[0].c1 = null; }),
  "NaN point (saved as null)": () => mutate(d => { d.pieces[0].pts[2] = { x: null, y: null }; }),
  "missing point": () => mutate(d => { d.pieces[0].pts[2] = null; }),
  "darts not a list": () => mutate(d => { d.pieces[0].darts = 5; }),
  "broken grainline": () => mutate(d => { d.pieces[0].grain = { a: null }; }),
  "pattern name null": () => mutate(d => { d.pieces[0].name = null; }),
  "internals null": () => mutate(d => { d.pieces[0].internals = null; }),
  "segment without notches": () => mutate(d => { delete d.pieces[0].segs[1].notches; }),
  "broken internal line": () => mutate(d => { d.pieces[0].internals[0].pts = [{ x: 1 }]; }),
  "hidden piece with bad geometry": () => mutate(d => { d.pieces.push({ ...JSON.parse(JSON.stringify(d.pieces[0])), id: 77, on: false }); delete d.pieces[1].segs[0].cps; d.pieces[1].segs[0].c2 = "x"; }),
};
test("corrupted autosave: boots clean, data moved to a backup key, user told (" + Object.keys(CORRUPT).length + " variants)", () => {
  for (const [name, make] of Object.entries(CORRUPT)) {
    // what is no document at all is moved aside at start; what is one but can't be drawn, when it is recovered (and the document is then blank)
    const raw = make(), r = boot({ seed: raw });
    assertRuns(r, name);
    assert.ok(JSON.stringify(r.names) === JSON.stringify([STARTER]) || r.names.length === 0, name + ": starts clean, not half-loaded: " + r.names);
    const keys = backups(r);
    assert.strictEqual(keys.length, 1, name + ": one backup key");
    assert.strictEqual(r.storage[keys[0]], raw, name + ": backup holds the original data byte for byte");
    assert.notStrictEqual(r.storage["pdraft:doc"], raw, name + ": the main key no longer holds it");
    assert.strictEqual(r.toasts.length, 1, name + ": one message"); assert.ok(r.toasts[0].includes(keys[0]), name + ": message names the backup key");
    // the real start (a blank document): the same, and nothing is left to recover next time
    const b = boot({ seed: raw, blank: true });
    assertRuns(b, name + " (blank start)"); assert.deepStrictEqual(b.names, []); assert.strictEqual(b.storage["pdraft:doc"], undefined, name + ": the main key is cleared");
    assert.strictEqual(b.storage[backups(b)[0]], raw); assert.strictEqual(b.toasts.length, 1);
    assert.ok(r.warnings.some(w => w.includes(keys[0])), name + ": console says what happened");
  }
});

test("render-time safety net: data that slips past checkDoc still can't blank the page", () => {
  const raw = mutate(d => { delete d.pieces[0].segs[1].notches; });
  const r = boot({ seed: raw, skipCheckDoc: true });            // pretend validation missed it
  assertRuns(r, "safety net");
  assert.deepStrictEqual(r.names, [], "a blank document, not the half-drawn one");
  assert.strictEqual(r.storage[backups(r)[0]], raw);
  assert.strictEqual(r.toasts.length, 1);
});

test("a cleared document (no pieces) is not treated as corrupt", () => {
  const r = boot({ seed: JSON.stringify({ v: 5, nextId: 2, pieces: [], seams: [] }) });
  assertUp(r, "cleared"); assert.deepStrictEqual(backups(r), []); assert.deepStrictEqual(r.toasts, []);
});

test("blocked storage: app still boots, indicator shows the problem", () => {
  const r = boot({ blocked: true });
  // (Round build-1: the failure is told in words, for a colour-blind eye: "⚠ Autosave failed — click for details")
  assertUp(r, "blocked"); assert.match(r.saveText, /Autosave failed — click for details/);
});

test("tiny or unlaid-out stage never hangs and keeps a sane zoom (was an infinite loop under 140 px)", () => {
  for (const [w, h] of [[1000, 139], [1000, 100], [1000, 0], [50, 800], [0, 0], [139, 139], [1000, 140]]) {
    const r = boot({ w, h });
    assertUp(r, w + "×" + h);
    assert.ok(r.view.s >= 0.05 && r.view.s <= 30, w + "×" + h + ": zoom " + r.view.s + " within the wheel range");
  }
});

// VS Code Live Server puts its reload <script> before the first "</body>" in the file. While the
// app script was inline, that was the "</body>" inside the print file's string: the injected
// </script> ended the app script there and the page came up blank.
test("served by Live Server (a script injected before the first </body>): every script parses and the app boots", () => {
  const html = pageHTML(), served = liveServerInject(html);
  const own = pageScripts(html), got = pageScripts(served);
  assert.strictEqual(got.length, own.length + 1, "the injected script is one more script, not a cut through one of the page's");
  assert.deepStrictEqual(got.slice(0, own.length), own, "the page's own scripts are untouched");
  assert.ok(got[own.length].code.includes("__liveReload"), "the injected script comes after them");
  for (const s of got) new vm.Script(s.code, { filename: s.src || "inline" });
  assert.ok(own.some(s => s.src === "pattern-drafter.js"), "the app script is a file of its own");
  const r = boot({ liveServer: true, script: `return app.printJob().html.slice(-15);` });
  assertUp(r, "live server"); assert.deepStrictEqual(r.names, [STARTER]);
  assert.strictEqual(r.result, "\n</body></html>", "the print file still ends with real closing tags");
});

test("no script holds a closing tag an HTML tool could mistake for the page's own", () => {
  const html = pageHTML(), tags = /<\/(body|html|head|script)>/i;
  for (const s of pageScripts(html)) assert.ok(!tags.test(s.code), (s.src || "inline script") + " has a raw " + (tags.exec(s.code) || [])[0] + "; write it as <\\/…>");
  assert.ok(html.search(/<\/body>/i) > html.lastIndexOf("</script>"), "the first </body> in the page is the real one");
});

test("Audit pass in the booted app: keys, typed positions for points and notches, typed rotation, one-sided walk notches, pen curve points, Trace + Enter", () => {
  const r = boot({ script: `
    const out = {}, P = () => S.pieces[0], at = { x: 0, y: 0 }, doc = () => JSON.stringify([S.pieces, S.seams]), start = doc();
    out.keys = [app.KEYMAP.R, app.KEYMAP.G, app.KEYMAP.N, app.KEYMAP.Z];
    // Add Point: one point at a typed distance, then three evenly
    const L = app.segLen(P(), 1), n0 = P().pts.length;
    app.answer = (t, f, o) => { out.addDlg = t + "|" + f.map(x => x.k) + "|" + o.radio.groups.map(g => g[0]); return { by: "length", s: 30, n: 2, dir: "current" }; };
    app.addPointNumeric(at, P(), 1, 0.1);
    out.one = [P().pts.length - n0, app.segLen(P(), 1)];
    app.undo();
    app.answer = () => ({ by: "uniform", u: 4 });
    app.addPointNumeric(at, P(), 1, 0.5);
    out.even = [1, 2, 3, 4].map(i => app.segLen(P(), i)); out.L = L;
    app.undo();
    // a notch 20 from the end of the shoulder
    app.answer = () => ({ by: "length", s: 20, n: 2, dir: "reverse" });
    app.notchPosNumeric(at, P(), 1, 0.1);
    out.notch = P().segs[1].notches.map(t => app.lenTo(P(), 1, t));
    app.undo();
    // Rotate by a typed angle: a quarter turn swaps the width and height of the points
    const ext = () => { const xs = P().pts.map(q => q.x), ys = P().pts.map(q => q.y); return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
    S.sel = [P().id]; out.ext0 = ext();
    app.answer = (t, f) => { out.rotDlg = t + "|" + f[0].unit; return { a: 90 }; };
    app.turnNumeric(at); out.ext1 = ext();
    app.undo();
    // Walk Pattern: a notch on the stationary edge only
    app.setTool("walk");
    let s = app.toS(app.segPt(P(), 5, 0.9)); app.walkClick(s.x, s.y, { shiftKey: false });
    s = app.toS(app.segPt(P(), 1, 0.2)); app.walkClick(s.x, s.y, { shiftKey: false });
    app.walkMove(app.segPt(P(), 1, 0.5));
    const n1 = P().segs[1].notches.length, n5 = P().segs[5].notches.length;
    app.walkNotch("a");
    out.walkA = [P().segs[1].notches.length - n1, P().segs[5].notches.length - n5];
    app.walkNotch("b");
    out.walkB = [P().segs[1].notches.length - n1, P().segs[5].notches.length - n5];
    S.walk = null; app.undo(); app.undo();
    // the pen: a Ctrl+click point is a curve point, smooth through it
    const sh = app.draftShape({ pts: [{ x: 0, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 0 }], hs: [null, null, null], auto: [false, true, false] }, false);
    out.pen = [sh.pts.length, sh.segs.length, sh.segs[0].curved, sh.segs[0].cps, app.segPt(sh, 0, app.segCurve(sh, 0).U[1])];
    // + and - zoom
    const z0 = S.view.s; app.zoomBy(1.25); out.zoom = S.view.s/z0; app.zoomBy(0.8);
    // Trace + Enter: the selected baseline becomes an internal line
    app.setTool("edit_pattern");
    const i0 = P().internals.length;
    s = app.toS(P().internals[0].pts[0]); app.menuClick(s.x, s.y, "Convert to Baseline");
    out.based = [P().internals.length - i0, P().bases.length, S.selKind];
    app.setTool("trace"); app.traceToInternal();
    out.back = [P().internals.length - i0, P().bases.length, S.selKind];
    app.undo(); app.undo();
    out.restored = doc() === start;
    return out;` });
  assertUp(r, "script");
  const o = r.result, near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, m + ": " + a + " vs " + b);
  assert.deepStrictEqual(o.keys, ["internal_ellipse", "internal_polygon", "segment_sewing", "edit_pattern"]);
  assert.strictEqual(o.addDlg, "Split Line|l1,r1,l2,r2,s,n,dir,u,total|two,length,uniform");
  assert.strictEqual(o.one[0], 1); near(o.one[1], 30, 1e-9, "the first part is the typed distance");
  o.even.forEach((x, k) => near(x, o.L/4, 1e-9, "even part " + k));
  assert.strictEqual(o.notch.length, 1); near(o.notch[0], o.L - 20, 1e-9, "20 from the end");
  assert.strictEqual(o.rotDlg, "Rotate|°");
  near(o.ext1[0], o.ext0[1], 1e-6, "width after a quarter turn"); near(o.ext1[1], o.ext0[0], 1e-6, "height after a quarter turn");
  assert.deepStrictEqual(o.walkA, [1, 0], "only the stationary edge"); assert.deepStrictEqual(o.walkB, [1, 1], "then the walked edge");
  assert.deepStrictEqual(o.pen.slice(0, 3), [2, 1, true], "a Ctrl+click point does not end the segment: two segment points, one curved segment");
  assert.strictEqual(o.pen[3].length, 1); near(o.pen[3][0].x, 50, 1e-9); near(o.pen[3][0].y, 40, 1e-9); assert.strictEqual(o.pen[3][0].u, undefined, "it is that segment's curve point, and no knot is kept with it");
  near(o.pen[4].x, 50, 1e-9, "and the line runs through it"); near(o.pen[4].y, 40, 1e-9);
  near(o.zoom, 1.25, 1e-9, "zoom step");
  assert.deepStrictEqual(o.based, [-1, 1, "base"]); assert.deepStrictEqual(o.back, [0, 0, "internal"]);
  assert.strictEqual(o.restored, true);
});

test("sewing tools run in the booted app: Segment Sewing 1:N with Shift, M:N with Enter, Free Sewing, Edit Sewing, Check Sewing Length", () => {
  const r = boot({ script: `
    const out = {};
    S.pieces.length = 0; S.seams.length = 0;
    const mk = (n, x, y, w) => { const p = app.mkPiece(n, app.mkShape([{ x, y }, { x: x + w, y }, { x: x + w, y: y + 80 }, { x, y: y + 80 }], true)); S.pieces.push(p); return p; };
    const A = mk("A", 0, 0, 300), B = mk("B", 0, 200, 100), C = mk("C", 150, 200, 190);
    app.commit();
    const at = (x, y) => { const s = app.toS({ x, y }); S.mouse = { x, y, sx: s.x, sy: s.y }; return s; };
    const click = (x, y, shift) => { const s = at(x, y); app.sewClick(s.x, s.y, { shiftKey: !!shift }); };
    const sums = () => S.seams.map(sm => { const i = app.seamInfo(sm, S.pieces); return [sm.a.length + ":" + sm.b.length, +i.la.toFixed(2), +i.lb.toFixed(2)]; });
    out.keys = [app.KEYMAP.B, app.KEYMAP.N, app.KEYMAP.M, !!app.TOOLS.mn_free_sewing.off];

    // Segment Sewing 1:N: the long edge, then Shift+click the two short ones, let go of Shift
    app.setTool("segment_sewing");
    click(30, 0); click(20, 200, true); click(170, 200, true);
    out.beforeShiftUp = S.seams.length;
    app.sewKey("ShiftUp");
    out.oneN = sums(); out.dirs = S.seams[0].b.map(x => x.rev);
    // an edge that is already sewn can be picked again: the new seam is a second layer on it
    click(100, 0); out.refused = S.draft && S.draft.sew ? S.draft.sew.a.length : 0; app.sewKey("Delete"); out.stillOne = S.seams.length;
    app.undo(); out.undone = S.seams.length;

    // M:N Segment Sewing: Enter ends each side; Delete takes a pick back
    app.setTool("mn_segment_sewing");
    click(30, 0); app.sewKey("Enter");
    click(20, 200); click(330, 200); click(20, 280); app.sewKey("Delete");
    out.picked = [S.draft.sew.a.length, S.draft.sew.b.length];
    app.sewKey("Enter");
    out.mn = sums(); out.mnDirs = S.seams[0].b.map(x => x.rev);
    // Unlink M:N from the Edit Sewing menu
    app.setTool("edit_sewing");
    let s = at(150, 0); app.editSewMenu(s.x, s.y, s.x, s.y);
    const pickItem = (name) => { let it = app.menu.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes(name));
      // (Round G1: this program's own commands are under More ▸)
      if (!it) { const more = app.menu.children.find(c => c.innerHTML.includes("<span>More</span>")); if (more) { more.onclick({ stopPropagation() {} }); const subs = app.ev("menuSubs"); it = subs[subs.length - 1].children.find(c => typeof c.onclick === "function" && c.innerHTML.includes(name)); } }
      if (!it) throw new Error("no item " + name); it.onclick({ stopPropagation() {} }); };
    pickItem("Unlink M:N Sewing");
    out.unlinked = sums();
    app.undo(); app.undo(); out.cleared = S.seams.length;

    // Free Sewing: 50..200 on A, then on C from 160; the guide dot marks the matching length and catches the cursor
    app.setTool("free_sewing");
    click(50, 0); click(200, 0);
    click(160, 200);
    out.guides = app.sewGuides().map(g => +app.segPt(g.sh, g.i, g.t).x.toFixed(2));
    click(309, 200);
    out.free = sums(); out.freeT = [S.seams[0].a[0].t0, S.seams[0].a[0].t1].map(v => +v.toFixed(4));
    // a typed length for the first range
    app.undo();
    click(10, 200); app.answer = () => ({ len: 60, back: false }); app.sewLengthNumeric({ x: 0, y: 0 }); app.answer = null;
    click(200, 200); click(260, 200);
    out.typed = sums();
    app.undo(); app.redo(); app.undo(); click(0, 0); app.setTool("free_sewing");
    click(50, 0); click(200, 0); click(160, 200); click(309, 200);

    // Edit Sewing: drag the end of A's range from 200 to 260, then slide the range 20 along
    app.setTool("edit_sewing");
    s = at(200, 0); out.hitEnd = app.seamHit(s.x, s.y).end;
    app.editSewDown(s.x, s.y); s = at(260, 0); app.editSewMove(s.x, s.y); S.drag = null; app.commit();
    out.longer = sums();
    s = at(150, 0); out.hitMid = app.seamHit(s.x, s.y).end;
    app.editSewDown(s.x, s.y); s = at(170, 0); app.editSewMove(s.x, s.y); S.drag = null; app.commit();
    out.slid = [S.seams[0].a[0].t0 * 300, S.seams[0].a[0].t1 * 300].map(v => +v.toFixed(1)).concat(sums()[0][1]);
    // reverse one part; add a point where the sewing line starts
    const sm = S.seams[0];
    app.reverseSewing(sm, sm.a[0]); out.reversed = sm.a[0].rev;
    s = at(150, 0); app.editSewMenu(s.x, s.y, s.x, s.y); pickItem("Add Point to Pattern on End");
    out.points = S.pieces[0].pts.length; out.afterPoint = sums(); out.partNow = [S.seams[0].a[0].sids.length, S.seams[0].a[0].t0, +(S.seams[0].a[0].t1).toFixed(4)];
    // a click on empty canvas deselects
    s = at(-200, -200); app.editSewDown(s.x, s.y); out.deselected = S.selSeam;

    // Check Sewing Length
    app.setSewCheck(true); out.check = [S.sewCheck.on, toasts[toasts.length-1]];
    S.sewCheck.len = 100; app.setSewCheck(true); out.checkOk = toasts[toasts.length-1];
    out.fileV = JSON.parse(app.docJSON()).v;
    return out;
  ` });
  assert.deepStrictEqual(r.errors, [], "no errors");
  const o = r.result;
  assert.deepStrictEqual(o.keys, ["edit_sewing", "segment_sewing", "free_sewing", false]);
  assert.strictEqual(o.beforeShiftUp, 0, "nothing is sewn until Shift is let go");
  assert.deepStrictEqual(o.oneN, [["1:2", 300, 290]]); assert.deepStrictEqual(o.dirs, [false, false]);
  assert.strictEqual(o.refused, 1, "a sewn edge is picked for a second seam"); assert.strictEqual(o.stillOne, 1); assert.strictEqual(o.undone, 0);
  assert.deepStrictEqual(o.picked, [1, 2], "Delete took the third pick back");
  assert.deepStrictEqual(o.mn, [["1:2", 300, 290]]); assert.deepStrictEqual(o.mnDirs, [false, true], "C was clicked near its far end");
  assert.deepStrictEqual(o.unlinked.map(x => x[0]), ["1:1", "1:1"]);
  assert.ok(Math.abs(o.unlinked[0][1] + o.unlinked[1][1] - 300) < 0.01 && o.unlinked[0][2] === 100 && o.unlinked[1][2] === 190);
  assert.strictEqual(o.cleared, 0);
  assert.ok(o.guides.length === 2 && Math.abs(o.guides[0] - 310) < 0.01, "the place on C that is 150 on from the start (the other one is back round the corner): " + o.guides);
  assert.strictEqual(o.free[0][0], "1:1"); assert.ok(Math.abs(o.free[0][1] - 150) < 1e-6 && Math.abs(o.free[0][2] - 150) < 0.01, "the click was caught by the guide");
  assert.deepStrictEqual(o.freeT, [0.1667, 0.6667]);
  assert.ok(Math.abs(o.typed[0][1] - 60) < 0.01 && Math.abs(o.typed[0][2] - 60) < 1e-6, "typed 60, then 60 by clicks");
  assert.strictEqual(o.hitEnd, 1); assert.ok(Math.abs(o.longer[0][1] - 210) < 0.5);
  assert.strictEqual(o.hitMid, null); assert.ok(Math.abs(o.slid[0] - 70) < 0.6 && Math.abs(o.slid[1] - 280) < 0.6 && Math.abs(o.slid[2] - o.longer[0][1]) < 0.06, "slid by 20, same length");
  assert.strictEqual(o.reversed, true);
  assert.strictEqual(o.points, 5); assert.ok(Math.abs(o.afterPoint[0][1] - o.slid[2]) < 1e-6, "the seam did not change");
  assert.strictEqual(o.partNow[0], 1); assert.strictEqual(o.partNow[1], 0, "the range now starts on the new point");
  assert.strictEqual(o.deselected, null);
  assert.strictEqual(o.check[0], true); assert.ok(/1 seam differs/.test(o.check[1]), o.check[1]); assert.ok(/within the limit/.test(o.checkOk));
  assert.strictEqual(JSON.parse(r.storage["pdraft:sewcheck"]).on, true, "the setting is saved per browser"); assert.strictEqual(o.fileV, 26);      // (version 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13; 15 since Round r12)
});

module.exports = T;
