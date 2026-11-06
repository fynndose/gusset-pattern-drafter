// Round E: 2D editing, the medium ones. A test (or two) a batch.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 60 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
const nears = (a, b, tol, msg) => { assert.strictEqual(a.length, b.length, (msg || "") + " " + JSON.stringify(a)); a.forEach((x, i) => near(x, b[i], tol, msg)); };

/* ---------- E1 ---------- */
test("E1: where the Split Line dialog cuts a line: two lines from the upper or left end, by length (Current from the clicked end, Reverse from the other, Center with the leftover shared: the maintainer's 457.1 by 381.6), uniform; what does not fit is refused with its reason", () => {
  const o = boot({ script: `
    const c = app.ev("splitCuts"), out = {};
    out.center = c(457.1, { by: "length", s: 381.6, n: 3, dir: "center" }, { flip: false, near: true });
    out.curNearEnd = c(457.1, { by: "length", s: 381.6, n: 2, dir: "current" }, { flip: false, near: false });
    out.curNearStart = c(457.1, { by: "length", s: 381.6, n: 2, dir: "current" }, { flip: false, near: true });
    out.rev = c(457.1, { by: "length", s: 381.6, n: 2, dir: "reverse" }, { flip: false, near: false });
    out.four = c(100, { by: "length", s: 30, n: 4, dir: "current" }, { flip: false, near: true });
    out.center5 = c(100, { by: "length", s: 20, n: 5, dir: "center" }, { flip: false, near: true });
    out.uni = c(90, { by: "uniform", u: 3 }, { flip: false, near: true });
    out.two = c(100, { by: "two", l1: 30 }, { flip: false, near: true });
    out.twoFlip = c(100, { by: "two", l1: 30 }, { flip: true, near: true });
    out.tooLong = c(457.1, { by: "length", s: 381.6, n: 3, dir: "current" }, { flip: false, near: true });
    out.center2 = c(457.1, { by: "length", s: 100, n: 2, dir: "center" }, { flip: false, near: true });
    out.twoOut = c(100, { by: "two", l1: 120 }, { flip: false, near: true });
    out.pieces = app.ev("splitPieces")(457.1, out.center.cuts, false).map(([a, b]) => +(b - a).toFixed(2));
    out.piecesCur = app.ev("splitPieces")(457.1, out.curNearEnd.cuts, false).map(([a, b]) => +(b - a).toFixed(2));
    return out;` }).result;
  nears(o.center.cuts, [37.75, 419.35], 1e-6, "Center");
  assert.deepStrictEqual(o.pieces, [37.75, 381.6, 37.75]);
  nears(o.curNearEnd.cuts, [75.5], 1e-6, "Current, clicked near the end: the piece of 381.6 at the end");
  assert.deepStrictEqual(o.piecesCur, [75.5, 381.6], "the maintainer's example: 75.5 / 381.6");
  nears(o.curNearStart.cuts, [381.6], 1e-6);
  nears(o.rev.cuts, [381.6], 1e-6, "Reverse measures from the other end");
  nears(o.four.cuts, [30, 60, 90], 1e-6, "three pieces of 30 and the leftover of 10: four segments");
  nears(o.center5.cuts, [20, 40, 60, 80], 1e-6, "Center 5: 20 at each end, three of 20 between");
  nears(o.uni.cuts, [30, 60], 1e-6);
  nears(o.two.cuts, [30], 1e-6); nears(o.twoFlip.cuts, [70], 1e-6, "Line 1 from the line's end when that is its left or upper end");
  assert.ok(/no room left/.test(o.tooLong.err), o.tooLong.err);
  assert.ok(/at least 3/.test(o.center2.err), o.center2.err);
  assert.ok(/Line 1/.test(o.twoOut.err), o.twoOut.err);
});

test("E1: Add Point/Split Line's right-click opens Split Line: three radio groups, the four of Two Lines tied, Total Length read-only, the preview in yellow and blue with lengths and rings, Line 1 the left part; OK splits in one undo step", () => {
  const o = boot({ script: `
    const out = {}, at = { x: 0, y: 0 }, P = () => S.pieces[0];
    // a 200 x 100 rectangle; its top runs left to right, its bottom right to left
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; app.commit();
    const top = 0, bottom = 2, n0 = P().pts.length, steps0 = app.histSteps().steps.length;
    app.answer = (t, f, op) => {
      out.title = t; out.keys = f.map(x => x.k + (x.g ? ":" + x.g : "") + (x.ro ? ":ro" : "") + (x.col ? ":" + x.col : "") + (x.options ? ":" + x.options.map(z => z[0]).join("/") : ""));
      out.radio = [op.radio.val, op.radio.groups.map(g => g[1])];
      out.vals = Object.fromEntries(f.map(x => [x.k, x.val]));
      out.sync = op.sync({ l1: 50, l2: 0, r1: 0, r2: 0 }, "l1");
      out.sync2 = op.sync({ l1: 0, l2: 0, r1: 0, r2: 10 }, "r2");
      const pv = op.preview({ by: "two", l1: 50, r1: 0, l2: 0, r2: 0, s: 10, n: 2, dir: "current", u: 2 });
      out.parts = pv.filter(x => x.part).map(x => [x.col, ...[x.part[0].x, x.part[x.part.length - 1].x].map(Math.round).sort((a, b) => a - b)]);
      out.labels = pv.filter(x => x.label).map(x => x.label); out.rings = pv.filter(x => x.ring).map(x => Math.round(x.ring.x));
      out.err = op.check({ by: "length", s: 120, n: 3, dir: "current", l1: 1, r1: 0, l2: 0, r2: 0, u: 2 });
      out.ok = op.check({ by: "uniform", u: 4, s: 1, n: 2, dir: "current", l1: 1, r1: 0, l2: 0, r2: 0 });
      return { by: "two", l1: 50, r1: 25, l2: 150, r2: 75, s: 10, n: 2, dir: "current", u: 2 };
    };
    // right-click the bottom line (drawn right to left) a quarter from its start: Line 1 is still its left part
    app.setTool("add_point");
    const q = app.toS(app.segPt(P(), bottom, 0.25)); app.fire("contextmenu", { x: q.x, y: q.y, button: 2 });
    out.bottom = P().pts.map(p => [Math.round(p.x), Math.round(p.y)]);
    out.steps = app.histSteps().steps.length - steps0;
    app.undo(); out.undone = P().pts.length === n0;
    // the top: Uniform Split into 4
    app.answer = () => ({ by: "uniform", u: 4, l1: 1, r1: 0, l2: 0, r2: 0, s: 1, n: 2, dir: "current" });
    app.addPointNumeric(at, P(), top, 0.5);
    out.uni = P().pts.slice(0, 5).map(p => Math.round(p.x));
    out.toast = toasts[toasts.length - 1];
    out.hint = app.HINT.add_point;
    return out;` }).result;
  assert.strictEqual(o.title, "Split Line");
  assert.deepStrictEqual(o.keys, ["l1:two:#f5c400", "r1:two", "l2:two:#2f80ed", "r2:two", "s:length", "n:length", "dir:length:current/reverse/center", "u:uniform", "total:ro"]);
  assert.deepStrictEqual(o.radio, ["two", ["Split into Two Lines", "Split by Length", "Uniform Split"]]);
  near(o.vals.total, 200, 1e-9); near(o.vals.l1, 150, 0.5, "clicked a quarter from the bottom line's start (its right end): Line 1, the left part, is 150");
  near(o.vals.r1, 75, 0.1); near(o.vals.l2, 50, 0.5);
  nears([o.sync.l2, o.sync.r1, o.sync.r2], [150, 25, 75], 1e-9, "Line 1 typed");
  nears([o.sync2.l1, o.sync2.l2, o.sync2.r1], [180, 20, 90], 1e-9, "Ratio 2 typed");
  assert.deepStrictEqual(o.parts, [["#f5c400", 0, 50], ["#2f80ed", 50, 200]], "Line 1 yellow from the left end, Line 2 blue");
  assert.deepStrictEqual(o.labels, ["50.0", "150.0"]); assert.deepStrictEqual(o.rings, [50]);
  assert.ok(/no room left/.test(o.err), o.err); assert.strictEqual(o.ok, "");
  assert.ok(o.bottom.some(p => p[0] === 50 && p[1] === 100), "the cut 50 from the left: " + JSON.stringify(o.bottom));
  assert.strictEqual(o.steps, 1, "one undo step"); assert.ok(o.undone);
  assert.deepStrictEqual(o.uni, [0, 50, 100, 150, 200]);
  assert.ok(/Split into 4: 50[.]0 [/] 50[.]0/.test(o.toast), o.toast);
  assert.ok(/Split Line/.test(o.hint), o.hint);
});

/* ---------- E2 ---------- */
test("E2: the same dialog for Split on a line's menu, Notch (a notch at every cut) and Split Curve (the curve point put exactly there, or one at every cut); each one undo step", () => {
  const o = boot({ script: `
    const out = {}, P = () => S.pieces[0], titles = [];
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; app.commit();
    const mid = (i, f) => app.toS(app.segPt(P(), i, f));
    // Split on a line's menu (Edit Pattern): Split by Length, Center
    app.answer = (t) => { titles.push(t); return { by: "length", s: 40, n: 4, dir: "center" }; };
    let q = mid(0, 0.3); app.menuClick(q.x, q.y, "Split", "edit_pattern");
    out.split = P().pts.slice(0, 5).map(p => Math.round(p.x)); app.undo();
    // Notch: Uniform Split into 3 on the right side, one undo step
    const st = S.undo.length;
    app.answer = (t) => { titles.push(t); return { by: "uniform", u: 3 }; };
    app.setTool("notch"); q = mid(1, 0.5); app.fire("contextmenu", { x: q.x, y: q.y, button: 2 });
    out.notches = P().segs[1].notches.map(t => Math.round(app.lenTo(P(), 1, t))); out.nSteps = S.undo.length - st;
    out.notchToast = toasts[toasts.length - 1];
    app.undo();
    // Split Curve: a curve point on the top line, then put 150 from the left end
    app.ev("insertCp")(P(), 0, 0.5); app.commit();
    app.answer = (t, f) => { titles.push(t); out.cpOpen = f.find(x => x.k === "l1").val; return { by: "two", l1: 150 }; };
    q = app.toS(P().segs[0].cps[0]); app.menuClick(q.x, q.y, "Split Curve…", "edit_curve_point");
    out.cp = P().segs[0].cps.map(c => [Math.round(c.x), Math.round(c.y)]); out.ptsAfter = P().pts.length;
    app.answer = (t) => { titles.push(t); return { by: "uniform", u: 4 }; };
    q = app.toS(P().segs[0].cps[0]); app.menuClick(q.x, q.y, "Split Curve…", "edit_curve_point");
    out.cps = P().segs[0].cps.map(c => Math.round(c.x));
    out.titles = titles;
    return out;` }).result;
  assert.deepStrictEqual(o.titles, ["Split", "Notch", "Split Curve", "Split Curve"]);
  assert.deepStrictEqual(o.split, [0, 60, 100, 140, 200], "Center, 4 segments: two of 40 in the middle, 60 at each end: " + o.split);
  assert.deepStrictEqual(o.notches, [33, 67]); assert.strictEqual(o.nSteps, 1);
  assert.ok(/2 notches added: 33[.]3 [/] 33[.]3 [/] 33[.]3/.test(o.notchToast), o.notchToast);
  near(o.cpOpen, 100, 0.5, "opens at the curve point");
  assert.deepStrictEqual(o.cp, [[150, 0]], "the curve point put 150 from the left; the line is not split");
  assert.strictEqual(o.ptsAfter, 4);
  assert.deepStrictEqual(o.cps, [50, 100, 150]);
});

/* ---------- E3 ---------- */
test("E3: Merge by the maintainer's rule: the first line's pattern goes to the second, which stays where it is and keeps its name; a first line of another length is made the second's length (both ends alike: a rectangle becomes a trapezoid), so no step is left; one undo step; the other order the other way round", () => {
  const o = boot({ script: `
    const out = {}, R = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true));
    const reset = () => { S.pieces = [R("F", 0, 0, 100, 50), R("S", 200, 0, 100, 30)]; S.seams = []; app.commit(); };
    const line = (p, i) => ({ p, sh: p, i, kind: "outline", int: -1 });
    const box = (p) => { const b = app.bboxOf([p]); return [b.x0, b.y0, b.x1, b.y1].map(v => Math.round(v*10)/10); };
    const lens = (p) => p.pts.map((_, i) => +app.segLen(p, i).toFixed(2)).sort((a, b) => a - b);
    reset();
    const S0 = box(S.pieces[1]), u0 = S.undo.length;
    // F's right side (50) first, S's left side (30) second: F is made to fit S and brought to it
    app.ev("mergeLines")([line(S.pieces[0], 1), line(S.pieces[1], 3)]);
    out.one = [S.pieces.length, S.pieces[0].name, S.pieces[0].pts.length, S.undo.length - u0];
    out.box = box(S.pieces[0]); out.S0 = S0; out.pts = S.pieces[0].pts.map(q => Math.round(q.x) + "," + Math.round(q.y));
    out.lens = lens(S.pieces[0]);
    out.toast = toasts[toasts.length - 1];
    out.bases = S.pieces[0].bases.length;
    app.undo(); out.undone = S.pieces.map(p => p.name + ":" + box(p).join(","));
    // the other order: S's line first grows to 50, S goes to F, F stays
    reset();
    const F0 = box(S.pieces[0]);
    app.ev("mergeLines")([line(S.pieces[1], 3), line(S.pieces[0], 1)]);
    out.two = [S.pieces.length, S.pieces[0].name, box(S.pieces[0]).slice(0, 2).join(",") === F0.slice(0, 2).join(","), box(S.pieces[0])[3]];
    out.toast2 = toasts[toasts.length - 1];
    return out;` }).result;
  assert.deepStrictEqual(o.one, [1, "S", 6, 1], "one pattern, named after the second, in one undo step");
  for (const q of ["300,0", "300,30", "200,0", "200,30"]) assert.ok(o.pts.includes(q), "the second pattern stays where it is: " + q + " in " + o.pts);
  assert.deepStrictEqual(o.box, [100, -10, 300, 40], "the first pattern brought to its left; its far side still 50, its near side 30: a trapezoid");
  assert.ok(o.lens.includes(50) && o.lens.includes(100.5), o.lens);
  assert.ok(/F merged into S — F's line made 30[.]0 mm [(]was 50[.]0[)] to fit/.test(o.toast), o.toast);
  assert.ok(!/step/.test(o.toast), "no step left");
  assert.deepStrictEqual(o.undone, ["F:0,0,100,50", "S:200,0,300,30"]);
  assert.deepStrictEqual(o.two, [1, "F", true, 50], "S's line grew to 50; F stays");
  assert.ok(/S merged into F — S's line made 50[.]0 mm/.test(o.toast2), o.toast2);
});

/* ---------- E4 ---------- */
test("E4: Add Perpendicular Internal Line on a line's and a point's menu (X-Axis, Y-Axis, Local): Angle, Length, Distance from Segment Edge with a slider, Extend, Both; into the pattern; the preview with the axis; one undo step", () => {
  const o = boot({ script: `
    const out = {}, P = () => S.pieces[0], at = { x: 0, y: 0 };
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; app.commit();
    const ends = () => { const sh = P().internals[P().internals.length - 1]; return sh.pts.map(q => Math.round(q.x) + "," + Math.round(q.y)).sort(); };
    const perp = app.ev("perpNumeric");
    // the bottom line runs right to left; the distance counts from its left end, as Split does
    let ans = { ang: 90, len: 30, d: 50, ext: false, both: false };
    app.answer = (t, f, op) => { out.dlg = [t, f.map(x => x.k + (x.range ? ":range" : "")), op.checks.map(c => c.k)];
      const pv = op.preview(ans); out.pv = pv.map(x => x.axis ? "axis" : x.part ? "line" : x.dot ? "dot" : x.label ? "label:" + x.label : "?"); return ans; };
    const u0 = S.undo.length;
    perp(at, P(), P(), 2, "local", false); out.local = ends(); out.steps = S.undo.length - u0;
    app.answer = () => ({ ang: 90, len: 30, d: 50, ext: true, both: false }); perp(at, P(), P(), 2, "local", false); out.ext = ends();
    app.answer = () => ({ ang: 90, len: 30, d: 50, ext: false, both: true }); perp(at, P(), P(), 2, "local", false); out.both = ends();
    // X-Axis, 90: straight up whatever the line; Y-Axis, 90: across
    app.answer = () => ({ ang: 90, len: 20, d: 50, ext: false, both: false }); perp(at, P(), P(), 0, "x", false); out.x = ends();
    app.answer = () => ({ ang: 90, len: 20, d: 50, ext: true, both: false }); perp(at, P(), P(), 1, "y", false); out.y = ends();
    // from a point's menu: the submenu, then Local; it starts at the point
    app.setTool("edit_pattern");
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; app.commit();
    const q = app.toS(P().pts[1]); app.menu.children.length = 0; app.showMenu({ clientX: q.x, clientY: q.y });
    const row = app.menu.children.find(c => /Add Perpendicular Internal Line/.test(c.innerHTML));
    out.row = row ? [/hassub/.test(row.className), /\u25b8|▸/.test(row.innerHTML)] : null;
    row.onclick({ stopPropagation() {} });
    const sub = app.ev("menuSubs")[0];
    out.sub = sub.children.map(c => c.innerHTML.replace(/<[^>]+>/g, "").trim());
    app.answer = (t, f) => { out.ptFields = f.map(x => x.k); return { ang: 90, len: 25, ext: false, both: false }; };
    sub.children.find(c => /Local/.test(c.innerHTML)).onclick();
    out.pt = ends();
    out.hist = app.histSteps().steps.slice(-1)[0].n;
    return out;` }).result;
  assert.deepStrictEqual(o.dlg, ["Add Perpendicular Internal Line", ["ang", "len", "d:range"], ["ext", "both"]]);
  assert.deepStrictEqual(o.pv, ["axis", "line", "dot", "label:30.0", "label:50.0", "label:150.0"], "the axis, the new line with its length, the two parts of the line");
  assert.deepStrictEqual(o.local, ["50,100", "50,70"], "square to the bottom, into the pattern, 50 from its left end");
  assert.strictEqual(o.steps, 1);
  assert.deepStrictEqual(o.ext, ["50,0", "50,100"], "Extend: on to the outline");
  assert.deepStrictEqual(o.both, ["50,130", "50,70"], "Both: out of the pattern as well");
  assert.deepStrictEqual(o.x, ["50,0", "50,20"], "X-Axis 90: up from the top line's foot, turned into the pattern");
  assert.deepStrictEqual(o.y, ["0,50", "200,50"], "Y-Axis 90 from the right side: across, on to the outline");
  assert.deepStrictEqual(o.row, [true, true]);
  assert.deepStrictEqual(o.sub, ["X-Axis", "Y-Axis", "Local"]);
  assert.deepStrictEqual(o.ptFields, ["ang", "len"], "from a point there is no distance along a line");
  assert.deepStrictEqual(o.pt, ["100,0", "100,25"], "from a point on the top, square to the line that leaves it, into the pattern");
  assert.strictEqual(o.hist, "Add Perpendicular Internal Line");
});

/* ---------- E5 ---------- */
test("E5: Convert to Curve Point ▸ Maintain Curve (the two lines one curve of the same shape) or Convert Only (a curve through the point and nothing added); what sits on the lines keeps its place; Convert to Segment Point ▸ Maintain Curve or Convert Only; each one undo step", () => {
  const o = boot({ script: `
    const out = {}, P = () => S.pieces[0];
    const make = (pts) => { S.pieces = [app.mkPiece("R", app.mkShape(pts, true))]; S.seams = []; app.commit(); };
    const dev = (i, f) => Math.max(...Array.from({ length: 201 }, (_, k) => { const q = app.segPt(P(), i, k/200); return f(q); }));
    app.setTool("edit_pattern");
    // a point in the middle of the straight top, with a notch halfway along its right half
    make([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }]);
    P().segs[1].notches.push(0.5);
    let q = app.toS(P().pts[1]), u0 = S.undo.length;
    app.menuClick(q.x, q.y, "Convert to Curve Point \u25b8 Maintain Curve");
    out.m = [P().pts.length, P().segs[0].curved, P().segs[0].cps.length >= 1, +dev(0, (v) => Math.abs(v.y)).toFixed(3), S.undo.length - u0];
    out.notch = P().segs[0].notches.map(t => Math.round(app.segPt(P(), 0, t).x));
    out.hist = app.histSteps().steps.slice(-1)[0].n;
    app.undo(); out.undone = P().pts.length;
    // a bent line, Convert Only: one curve point, the old point, and nothing added
    make([{ x: 0, y: 0 }, { x: 100, y: -30 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }]);
    q = app.toS(P().pts[1]); app.menuClick(q.x, q.y, "Convert to Curve Point \u25b8 Convert Only");
    out.only = [P().pts.length, P().segs[0].cps.map(c => [c.x, c.y])];
    app.undo();
    q = app.toS(P().pts[1]); app.menuClick(q.x, q.y, "Convert to Curve Point \u25b8 Maintain Curve");
    out.maintainAdds = P().segs[0].cps.length;
    // the way back: a curve with three curve points, cut at the middle one
    make([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }]);
    P().segs[0].curved = true; P().segs[0].cps = [{ x: 50, y: -20 }, { x: 100, y: -30 }, { x: 150, y: -20 }]; app.commit();
    app.setTool("edit_curve_point");
    q = app.toS(P().segs[0].cps[1]); app.menuClick(q.x, q.y, "Convert to Segment Point \u25b8 Convert Only");
    out.segOnly = [P().pts.length, Math.round(P().pts[1].x), Math.round(P().pts[1].y), P().segs[0].cps.length, P().segs[1].cps.length];
    app.undo();
    q = app.toS(P().segs[0].cps[1]); app.menuClick(q.x, q.y, "Convert to Segment Point \u25b8 Maintain Curve");
    out.segKeep = [P().pts.length, Math.round(P().pts[1].x), Math.round(P().pts[1].y)];
    // no curve point on a triangle's corner (it would leave two points)
    make([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }]);
    app.setTool("edit_pattern"); app.menu.children.length = 0; q = app.toS(P().pts[1]); app.showMenu({ clientX: q.x, clientY: q.y });
    out.tri = app.menu.children.some(c => /Convert to Curve Point/.test(c.innerHTML));
    return out;` }).result;
  assert.deepStrictEqual(o.m.slice(0, 3), [4, true, true]);
  assert.ok(o.m[3] <= 0.1, "Maintain Curve keeps the straight top within 0.1 mm: " + o.m[3]);
  assert.strictEqual(o.m[4], 1, "one undo step"); assert.strictEqual(o.hist, "Convert to Curve Point");
  assert.deepStrictEqual(o.notch, [150], "the notch keeps its place");
  assert.strictEqual(o.undone, 5);
  assert.deepStrictEqual(o.only, [4, [[100, -30]]], "Convert Only: the curve runs through the old point, nothing added");
  assert.ok(o.maintainAdds > 1, "Maintain Curve adds curve points to hold the bend: " + o.maintainAdds);
  assert.deepStrictEqual(o.segOnly, [5, 100, -30, 1, 1], "Convert Only: the halves keep their own curve points");
  assert.deepStrictEqual(o.segKeep, [5, 100, -30]);
  assert.strictEqual(o.tri, false);
});

/* ---------- E6 ---------- */
test("E6: Offset Pattern Outline for the whole pattern: Extend or Retract, Distance, Number of Offsets with Total Distance, the three corners, Create Internal Line, a preview of every offset; the lines keep their ids (seams stay on), the old outline is left as a base line; one undo step", () => {
  const o = boot({ script: `
    const out = {}, P = () => S.pieces[0], at = { x: 0, y: 0 };
    const make = (pts) => { S.pieces = [app.mkPiece("R", app.mkShape(pts, true))]; S.seams = []; app.commit(); };
    const box = () => { const b = app.bboxOf([P()]); return [b.x0, b.y0, b.x1, b.y1].map(v => Math.round(v*100)/100); };
    const run = (v) => { app.answer = (t, f, op) => { out.dlg = [t, f.map(x => x.k + (x.options ? ":" + x.options.map(z => z[0]).join("/") : "") + (x.ro ? ":ro" : "")), op.checks.map(c => c.k)];
      out.pv = (op.preview(v) || []).length; out.total = op.sync({ ...v, d: v.d }, "d").total; out.err = op.check(v); return v; }; app.ev("offsetWholeNumeric")(at, P()); };
    make([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }]);
    P().segs[1].notches.push(0.5); P().segs[1].sa = 7;
    const ids = P().segs.map(s => s.id), u0 = S.undo.length;
    run({ dir: "extend", d: 10, n: 1, corner: "default", inner: false });
    out.ext = [box(), P().pts.length, P().segs.map(s => s.id).join() === ids.join(), P().segs[1].notches.length, P().segs[1].sa, P().bases.length, P().internals.length, S.undo.length - u0];
    out.toast = toasts[toasts.length - 1];
    app.undo();
    run({ dir: "extend", d: 5, n: 3, corner: "default", inner: true });
    out.three = [box(), P().internals.length, P().bases.length, out.pv, out.total];
    app.undo();
    run({ dir: "retract", d: 10, n: 4, corner: "default", inner: false });
    out.ret = [box(), out.total];
    app.undo();
    run({ dir: "extend", d: 10, n: 1, corner: "unfilled", inner: false });
    out.unf = [box(), P().pts.length];
    app.undo();
    run({ dir: "extend", d: 10, n: 1, corner: "right", inner: false });
    out.right = [box(), P().pts.length];
    app.undo();
    // a sharp triangle: Default runs far out at the point, Right Angled squares it off
    make([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 40 }]);
    run({ dir: "extend", d: 10, n: 1, corner: "default", inner: false }); out.triDef = [box()[2], P().pts.length]; app.undo();
    run({ dir: "extend", d: 10, n: 1, corner: "right", inner: false }); out.triRight = [box()[2], P().pts.length]; app.undo();
    // too far in: refused in the dialog
    make([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }]);
    run({ dir: "retract", d: 60, n: 1, corner: "default", inner: false }); out.tooFar = [out.err, box()];
    return out;` }).result;
  assert.deepStrictEqual(o.dlg, ["Offset Pattern Outline", ["dir:extend/retract", "d", "n", "total:ro", "corner:default/right/unfilled"], ["inner"]]);
  assert.deepStrictEqual(o.ext, [[-10, -10, 210, 110], 4, true, 1, 7, 1, 0, 1], "every line kept with its id, notch and allowance; the old outline a base line; one undo step");
  assert.ok(/extended 1 time by 10[.]0 mm/.test(o.toast), o.toast);
  assert.deepStrictEqual(o.three, [[-15, -15, 215, 115], 3, 3, 3, 15], "three offsets of 5: the old outline and the two between as internal lines and as base lines (Round CF), a preview of each, Total 15");
  assert.deepStrictEqual(o.ret, [[40, 40, 160, 60], 40], "Retract (Round CF / E6): four steps of 10, each from the one before");
  assert.deepStrictEqual(o.unf, [[-10, -10, 210, 110], 8], "Unfilled: a straight line across each corner");
  assert.deepStrictEqual(o.right, [[-10, -10, 210, 110], 4], "a square corner is the same as Default");
  assert.ok(o.triDef[0] > 250 && o.triDef[1] === 3, "Default runs out to a point: " + o.triDef);
  assert.ok(o.triRight[0] < 225 && o.triRight[1] === 5, "Right Angled squares the two sharp corners off: " + o.triRight);
  assert.ok(/cross itself|inside out/.test(o.tooFar[0]), o.tooFar[0]); assert.deepStrictEqual(o.tooFar[1], [0, 0, 200, 100]);
});

/* ---------- E7 ---------- */
test("E7: Mirror Creation while drawing a polygon: Create Polygon's Option (Off / On, Axis Local / X-Axis / Y-Axis), the mirror line through the first point; a click on it, or on the first point, makes the whole; Local is the first line", () => {
  const o = boot({ script: `
    const out = {}, C = (x, y) => { const q = app.toS({ x, y }); app.click(q.x, q.y); };
    const pts = () => S.pieces[S.pieces.length - 1].pts.map(q => Math.round(q.x) + "," + Math.round(q.y));
    S.pieces = []; app.commit();
    // half a shape on the y axis through (100, 100): the right-click dialog switches it on and adds a line 40 down
    app.setTool("polygon"); C(100, 100); C(60, 140);
    app.answer = (t, f) => { out.dlg = [t, f.map(x => x.k + (x.options ? ":" + x.options.map(z => z[0]).join("/") : "") + (x.head ? "#" + x.head : ""))]; return { len: 40, ang: 90, mirror: "on", axis: "y" }; };
    const q = app.toS({ x: 60, y: 140 }); app.fire("contextmenu", { x: q.x, y: q.y, button: 2 });
    out.mirror = S.draft && S.draft.mirror;
    C(101, 220);                                  // within the catch of the mirror line: put on it, and the whole is made
    out.y = [S.pieces.length, ...pts()];
    out.hist = app.histSteps().steps.slice(-1)[0].n;
    // the setting stays for the next polygon: X-Axis this time (set by the dialog), closed on the first point
    app.setTool("polygon"); C(300, 100);
    app.answer = () => ({ len: 50, ang: 0, mirror: "on", axis: "x" });
    let r = app.toS({ x: 300, y: 100 }); app.fire("contextmenu", { x: r.x, y: r.y, button: 2 });
    C(380, 60); C(400, 100);
    out.x = pts();
    // Local: the first line is the mirror line
    app.setTool("polygon"); C(500, 100);
    app.answer = () => ({ len: 100, ang: 90, mirror: "on", axis: "local" });
    r = app.toS({ x: 500, y: 100 }); app.fire("contextmenu", { x: r.x, y: r.y, button: 2 });
    C(540, 150); C(500, 100);
    out.local = pts();
    // switched off again: an ordinary polygon
    app.setTool("polygon"); C(700, 100);
    app.answer = () => ({ len: 50, ang: 0, mirror: "off", axis: "local" });
    r = app.toS({ x: 700, y: 100 }); app.fire("contextmenu", { x: r.x, y: r.y, button: 2 });
    C(720, 150); C(700, 100);
    out.off = pts();
    out.hint = app.HINT.polygon;
    // an open line (internal or base polygon): the mirror image first, then the half, one line through the first point
    out.open = app.ev("mirrorDraft")({ pts: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }], hs: [null, null, null], mirror: "y" }, false).pts.map(q => q.x + "," + q.y);
    return out;` }).result;
  assert.deepStrictEqual(o.open, ["-20,10", "-10,10", "0,0", "10,10", "20,10"]);
  assert.deepStrictEqual(o.dlg, ["Create Polygon", ["len#Length", "ang", "mirror:off/on#Option", "axis:local/y/x"]]);      // (Round r15 / 5: the reference's order, Local, Y-Axis, X-Axis)
  assert.strictEqual(o.mirror, "y");
  assert.deepStrictEqual(o.y, [1, "100,100", "60,140", "60,180", "100,220", "140,180", "140,140"], "the half and its mirror image: the whole");
  assert.deepStrictEqual(o.x, ["350,100", "380,60", "400,100", "380,140"], "mirrored about the x axis through the first point; the lines on it are the fold, not edges");
  assert.deepStrictEqual(o.local, ["500,200", "540,150", "500,100", "460,150"], "Local: mirrored about the first line (down from 500,100), which is the fold and no edge");
  assert.deepStrictEqual(o.off, ["700,100", "750,100", "720,150"]);
  assert.ok(/Mirror Creation/.test(o.hint));
});

/* ---------- E8 ---------- */
test("E8: Trace: the panel (Mode Line, Shape following the not-built switch); Line mode selects lines of every kind (Shift+click for more) and its right-click menu makes a pattern (set down with a click), an internal shape, internal lines, measurements; each one undo step", () => {
  const o = boot({ script: `
    const out = {}, P = () => S.pieces[0];
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))];
    app.addChild(P(), "internals", app.mkShape([{ x: 50, y: 25 }, { x: 150, y: 25 }, { x: 150, y: 75 }, { x: 50, y: 75 }], true));
    app.commit();
    const mid = (sh, i) => app.toS(app.segPt(sh, i, 0.5));
    const pick = (sh, i, shift) => { const q = mid(sh, i); app.click(q.x, q.y, { shiftKey: !!shift }); };
    const rows = () => app.menu.children.filter(c => typeof c.onclick === "function").map(c => c.innerHTML.replace(/<span class="k">.*$/, "").replace(/<[^>]+>/g, "").trim());
    const menuAt = (sh, i) => { const q = mid(sh, i); app.menu.children.length = 0; app.showMenu({ clientX: q.x, clientY: q.y }); };
    const run = (name) => app.menu.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes("<span>" + name + "</span>")).onclick();
    app.setTool("trace");
    const panel = app.el("tracepanel");
    out.panel = [panel.style.display, /Line/.test(panel.innerHTML), /Shape/.test(panel.innerHTML) && !/not built yet/.test(panel.innerHTML), /aria-pressed="true"/.test(panel.innerHTML)];
    // the four sides of the outline, one click and three Shift+clicks
    pick(P(), 0); pick(P(), 1, true); pick(P(), 2, true); pick(P(), 3, true);
    out.sel = S.traceSel.length;
    menuAt(P(), 0); out.rows = rows();
    const u0 = S.undo.length;
    run("Trace as a Pattern");
    out.placing = !!S.place;
    const d = app.toS({ x: 400, y: 50 }); app.click(d.x, d.y);
    out.pattern = [S.pieces.length, S.pieces[1].pts.length, Math.round(app.bboxOf([S.pieces[1]]).x0), S.undo.length - u0, S.pieces[1].segs.every(sg => !P().segs.some(z => z.id === sg.id))];
    // two lines that join: one internal line; two that don't: refused as one shape, two lines as runs
    pick(P(), 0); pick(P(), 1, true); menuAt(P(), 0); run("Trace as an Internal Shape");
    out.joined = P().internals.slice(-1)[0].pts.map(q => q.x + "," + q.y);
    pick(P(), 0); pick(P(), 2, true); menuAt(P(), 0); const n0 = P().internals.length;
    run("Trace as an Internal Shape"); out.refused = [P().internals.length - n0, toasts[toasts.length - 1]];
    menuAt(P(), 0); run("Trace as Internal Lines/Shapes"); out.runs = P().internals.length - n0;
    // Round CF: one line of the closed internal shape traces only that line, and a single line can only go inside a pattern
    const inner = P().internals[0], np = S.pieces.length, ni = P().internals.length; pick(inner, 1); menuAt(inner, 1); run("Trace as a Pattern");
    const d2 = app.toS({ x: 400, y: 300 }); app.click(d2.x, d2.y); const still = !!S.place;
    const d3 = app.toS({ x: 100, y: 50 }); app.click(d3.x, d3.y);
    out.whole = [S.pieces.length - np, still, P().internals.length - ni, P().internals.slice(-1)[0].pts.length];
    // measurements
    const m0 = S.measures.length; pick(P(), 0); pick(P(), 1, true); menuAt(P(), 1); run("Trace as Point of Measure"); out.meas = S.measures.length - m0;
    // the not-built switch off: no (with Link), no Seamless Block, no Shape
    app.setUnbuilt(false); app.setTool("edit_pattern"); app.setTool("trace");
    pick(P(), 0); menuAt(P(), 0); out.rowsOff = rows(); out.shapeOff = /Shape/.test(app.el("tracepanel").innerHTML);
    app.setTool("edit_pattern"); out.hidden = app.el("tracepanel").style.display;
    out.hint = app.HINT.trace;
    return out;` }).result;
  assert.deepStrictEqual(o.panel, ["block", true, true, true]);
  assert.strictEqual(o.sel, 4);
  // (Round r34 / 4: Trace as a Pattern (with Link) is built for whole patterns in Shape mode; in Line mode it is a greyed row pointing there, listed
  // whether the not-built switch is on or off. It was "not built yet")
  assert.deepStrictEqual(o.rows, ["Trace as a Pattern", "Trace as a Pattern (with Link)", "Trace as an Internal Shape", "Trace as Internal Lines/Shapes", "Trace as Seamless Block Line" /* (Round r33b / 2) */, "Trace as Point of Measure"]);
  assert.strictEqual(o.placing, true, "the traced pattern hangs on the pointer");
  assert.deepStrictEqual(o.pattern, [2, 4, 300, 1, true], "set down where clicked, one undo step, segments of its own");
  assert.deepStrictEqual(o.joined, ["0,0", "200,0", "200,100"]);
  assert.strictEqual(o.refused[0], 0); assert.ok(/don't join/.test(o.refused[1]), o.refused[1]);
  assert.strictEqual(o.runs, 2);
  assert.deepStrictEqual(o.whole, [0, true, 1, 2], "Round CF: only the selected line, placed inside a pattern (a click outside one is refused)");
  assert.strictEqual(o.meas, 2);
  assert.deepStrictEqual(o.rowsOff, ["Trace as a Pattern", "Trace as a Pattern (with Link)" /* (Round r34 / 4) */, "Trace as an Internal Shape", "Trace as Internal Lines/Shapes", "Trace as Seamless Block Line" /* (Round r33b / 2) */, "Trace as Point of Measure"]);
  assert.strictEqual(o.shapeOff, true, "Shape mode is built (Round CF)"); assert.strictEqual(o.hidden, "none");
  assert.ok(/outline, internal or base/.test(o.hint));
});

module.exports = T;
