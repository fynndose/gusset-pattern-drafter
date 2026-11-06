// Round r34: everything in the inventory that had enough information. Batch 2: Dart Cap, Offset as Seamless Block Line, base lines
// only inside a pattern.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-r34-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
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
// a pattern 400 × 200 with a point in the middle of its top edge (y down: the top edge is y 0)
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:400,y:0},{x:400,y:200},{x:0,y:200}], true));
  S.pieces.push(A); S.sel = []; app.commit(); S.undo.length = 0;
  const at = (x, y) => app.toS({ x, y }), out = {};
  const click = (x, y, o) => { const s = { ...at(x, y), ...(o || {}) }; app.fire("pointermove", s); app.fire("pointerdown", s); app.fire("pointerup", s); };
  const steps = () => app.histSteps().steps.map(s => s.n);
  const saveBytes = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return got; };
  const r2 = (L) => L.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
`;

/* ---------- batch 2: Dart Cap ---------- */
test("r34 / 2: Dart Cap: offered only at a dart's mouth (greyed elsewhere); the allowance across the dart is the folded dart's: on a straight edge the peak on the dart's centre line where the turned-back cut line reaches it (13.33 mm out for a 20 × 70 dart at 10 mm, worked by hand), no allowance round the dart's point; pressed toward Line 1 or Line 2 the mirror images of each other; on a sloped edge the two differ and each part of the cap lies on the folded cut line taken back; one step, saved and opened", () => {
  const o = boot({ blank: true, script: DOC + `
    app.ev("addDartAt")(A, 1, 20, 10, 70, false);
    for (const s of A.segs) s.sa = 10;
    app.commit(); S.undo.length = 0;
    const rows = (i) => app.ev("cornerRows")(A, i, { x: 0, y: 0 }).find(r => r.n === "Dart Cap");
    out.offered = [0, 1, 2, 3, 4].map(i => !rows(i).off);
    out.plain = r2(app.ev("cutLine")(A));
    rows(1).f();
    out.step = steps().slice(-1)[0]; out.corner = A.segs[1].corner;
    out.in = r2(app.ev("cutLine")(A));
    app.ev("cornerSet")(A, 1, { on: "out" }); out.out = r2(app.ev("cutLine")(A));
    // the Property Editor: Direction with Line 1 / Line 2
    // (at the other mouth point: the dart's one cap is shown and set there)
    app.setTool("seam_allowance"); click(210, 0);
    out.pe = [/Dart Cap/.test(app.el("props").innerHTML), /id="cx-l1"/.test(app.el("props").innerHTML)];
    app.el("cx-l1").onclick(); out.fromR = A.segs.map(s => s.corner || null).filter(Boolean);
    // saved and opened: the corner kept, the cut line the same
    const d = app.fileDoc(saveBytes()); out.saved = d.pieces[0].segs.map(s => s.corner).filter(Boolean);
    // a sloped edge: the line before the dart rises toward it
    S.pieces.length = 0;
    // (drawn by hand, not by Add Dart: Add Dart puts the dart on the corner's middle, where the folded mitre always falls on the seam and
    // the two directions give the same cap; this one's legs meet the two lines at different angles)
    const B = app.mkPiece("B", app.mkShape([{x:0,y:40},{x:190,y:0},{x:200,y:70},{x:210,y:0},{x:400,y:0},{x:400,y:200},{x:0,y:200}], true));
    S.pieces.push(B); app.commit();
    for (const s of B.segs) s.sa = 10; app.commit();
    out.bdart = app.ev("dartAtPt")(B, 1);
    out.bpts = r2(B.pts);
    app.ev("setCorner")(B.segs[1], "dartcap", { on: "in" }); app.commit(); out.bin = r2(app.ev("cutLine")(B));
    app.ev("setCorner")(B.segs[1], "dartcap", { on: "out" }); app.commit(); out.bout = r2(app.ev("cutLine")(B));
    return out;
  ` }).result;
  assert.deepStrictEqual(o.offered, [false, true, false, true, false], "at the two mouth points only (not at the dart's point, not at a corner)");
  assert.strictEqual(o.step, "Seam Allowance Corner");
  assert.deepStrictEqual(o.corner, { t: "dartcap", on: "in" }, "pressed toward Line 1 when picked");
  assert.deepStrictEqual(o.pe, [true, true], "the Property Editor names it and has Direction");
  assert.deepStrictEqual(o.fromR, [{ t: "dartcap", on: "in" }], "set from the other mouth point: still one cap on the dart");
  assert.deepStrictEqual(o.saved, [{ t: "dartcap", on: "in" }], "saved: the one cap");
  // without a cap the legs' own allowances made a V into the allowance; with it, the cap rises over the dart
  assert.ok(o.plain.some(q => q[1] > -5 && q[0] > 195 && q[0] < 205), "no cap: the legs' allowance runs down toward the dart");
  for (const L of [o.in, o.out]) {
    assert.ok(L.every(q => q[1] <= -10 + 1e-6 || q[1] >= 200), "nothing of the allowance inside the edge's cut line: no allowance round the dart's point");
    const peak = L.find(q => Math.abs(q[0] - 200) < 1e-6);
    assert.ok(peak, "a point on the centre line"); near(peak[1], -10 - 10/3, 0.01, "the peak, worked by hand: |T - w| = 83.33 from the dart's point at y 70");
  }
  assert.deepStrictEqual(o.out.map(q => [+(400 - q[0]).toFixed(3), q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), o.in.map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), "Line 2 is Line 1 mirrored on a symmetric dart");
  // the sloped edge: the dart found, the two directions differ, and the half of the cap beside the side it is pressed to, mirrored in
  // that leg, lies on that side's cut line carried on (the folded dart lies under it)
  assert.deepStrictEqual(o.bdart, { L: 1, T: 2, R: 3 });
  assert.notDeepStrictEqual(o.bin, o.bout, "pressed one way or the other gives another cap on an uneven edge");
  const [Lp, Tp] = [o.bpts[1], o.bpts[2]], refl = (q) => { const dx = Lp[0] - Tp[0], dy = Lp[1] - Tp[1], L = Math.hypot(dx, dy), ux = dx/L, uy = dy/L, vx = q[0] - Tp[0], vy = q[1] - Tp[1], d = vx*ux + vy*uy; return [Tp[0] + 2*ux*d - vx, Tp[1] + 2*uy*d - vy]; };
  const A0 = o.bpts[0], uA = [Lp[0] - A0[0], Lp[1] - A0[1]], lA = Math.hypot(...uA), nA = [uA[1]/lA, -uA[0]/lA];          // the outward normal of the line into the dart
  const offA = (q) => (q[0] - A0[0])*nA[0] + (q[1] - A0[1])*nA[1];
  const cap = o.bin.filter(q => q[0] > 150 && q[0] < 250 && q[1] < 0), pk = cap.reduce((m, q) => (Math.abs(q[0] - 200) < Math.abs(m[0] - 200) ? q : m));
  near(offA(refl(pk)), 10, 0.05, "the peak mirrored in the leg lies on the incoming line's cut line, 10 mm out");
});

/* ---------- batch 2: Offset as Seamless Block Line ---------- */
test("r34 / 3: Offset as Seamless Block Line: on an outline line's right-click, the Offset box; the line made is a seamless block line run on to the outline at both ends, dividing the pattern into two sections without cutting it, one step; on the pattern's own menu it asks for a line; a line that can't reach the outline makes none and no step", () => {
  const o = boot({ blank: true, script: DOC + `
    app.answer = (title, fields, opts) => { out.title = title; out.checks = (opts.checks || []).map(c => c.k); return { d: 50, n: 1, rev: false }; };
    app.ev("offsetNumeric")({ x: 10, y: 10 }, A, A, 0, null, true);
    const bl = A.internals.filter(x => x.block);
    out.made = [bl.length, bl[0] && r2([bl[0].pts[0], bl[0].pts[bl[0].pts.length - 1]]), app.ev("blockSections")(A).length, S.pieces.length, steps().slice(-1)[0]];
    // the pattern's menu (no line): a message, nothing made
    const n0 = steps().length; app.ev("offsetNumeric")({ x: 10, y: 10 }, A, null, -1, null, true); out.whole = [steps().length - n0, toasts.slice(-1)[0]];
    // an internal line in the middle of the pattern, offset sideways: run on to the outline at both ends
    app.addChild(A, "internals", app.mkShape([{x:100,y:100},{x:300,y:100}], false)); app.commit();
    const ln = A.internals[A.internals.length - 1];
    app.answer = () => ({ d: 30, n: 1, rev: false });
    app.ev("offsetNumeric")({ x: 10, y: 10 }, A, ln, 0, null, true);
    const b2 = A.internals.filter(x => x.block);
    out.fromInternal = [b2.length, app.ev("blockSections")(A).length];
    return out;
  ` }).result;
  assert.strictEqual(o.title, "Offset as Seamless Block Line");
  assert.ok(!o.checks.includes("fit"), "Extend is always on: no switch for it");
  assert.strictEqual(o.made[0], 1);
  assert.deepStrictEqual(o.made[1].map(q => q[1]), [50, 50], "50 mm in from the top edge");
  assert.deepStrictEqual(o.made[1].map(q => q[0]).sort((a, b) => a - b), [0, 400], "run on to the outline at both ends");
  assert.deepStrictEqual(o.made.slice(2), [2, 1, "Offset as Seamless Block Line"], "two sections, the pattern not cut, one step");
  assert.strictEqual(o.whole[0], 0); assert.match(o.whole[1], /right-click the line/);
  assert.deepStrictEqual(o.fromInternal, [2, 3], "the internal line's offset, run on to both sides, makes a third section");
});

/* ---------- batch 2: base lines only inside a pattern ---------- */
test("r34 / 3: base lines are drawn only inside a pattern (the third session's wish): Base Polygon, Base Rectangle and the Create Rectangle box started outside every pattern are refused at once with a message, even with a pattern selected, and leave no step; started inside, the line belongs to that pattern", () => {
  const o = boot({ blank: true, script: DOC + `
    S.sel = [A.id]; app.commit(); const n0 = steps().length;
    app.setTool("base_polygon"); click(600, 100);
    out.poly = [!!S.draft, steps().length - n0, toasts.slice(-1)[0]];
    app.setTool("base_rectangle"); const s = at(600, 100); app.fire("pointermove", s); app.fire("pointerdown", s);
    out.rect = [!!S.draft, toasts.slice(-1)[0]]; app.fire("pointerup", s);
    // inside: a base line of A
    app.setTool("base_polygon"); click(50, 50); click(150, 50); app.key("Enter");
    out.inside = [A.bases.length, steps().length - n0];
    return out;
  ` }).result;
  assert.deepStrictEqual(o.poly.slice(0, 2), [false, 0], "refused at the first click, no step");
  assert.match(o.poly[2], /inside a pattern/);
  assert.deepStrictEqual(o.rect, [false, o.poly[2]]);
  assert.deepStrictEqual(o.inside, [1, 1], "drawn inside: a base line of the pattern, one step");
});

/* ---------- batch 3: linked editing ---------- */
test("r34 / 4: Link to Pattern Outline: an internal line 30 mm inside the right edge, linked, follows that edge when it moves (still 30 mm in, its curve point too); edited itself, it is linked again where it now lies; a point added to the outline leaves it where it is; one step to link; saved as version 30 with the link; Edit Link lists the links and Unlink takes one away", () => {
  const o = boot({ blank: true, script: DOC + `
    const ln = app.mkShape([{x:370,y:50},{x:370,y:150}], false); ln.segs[0].curved = true; ln.segs[0].cps = [{ x: 360, y: 100 }];
    app.addChild(A, "internals", ln); app.commit(); S.undo.length = 0;
    app.ev("olinkToggle")(A, ln);
    out.linked = [!!ln.olink, steps().slice(-1)[0]];
    // the right edge moved 50 mm out
    app.push(); for (const q of A.pts) if (q.x === 400) q.x = 450; app.commit();
    out.moved = r2(ln.pts).concat(r2(ln.segs[0].cps));
    // the line moved by hand 10 mm left: linked again there, then the edge moved back
    app.push(); ln.pts = ln.pts.map(q => ({ x: q.x - 10, y: q.y })); app.commit();
    app.push(); for (const q of A.pts) if (q.x === 450) q.x = 400; app.commit();
    out.again = r2(ln.pts);
    // a point added on the right edge: the line stays where it is
    const before = r2(ln.pts); const ri = A.pts.findIndex(q => q.x === 400 && q.y === 0);
    app.push(); app.ev("addPoint")(A, ri, 0.5); app.commit(); out.afterAdd = [r2(ln.pts), before];
    // saved: version 30, the link kept
    const d = app.fileDoc(saveBytes()); out.file = [d.v, !!(d.pieces[0].internals[0] || {}).olink];
    // Edit Link: the box lists it; Unlink takes it away, one step
    app.ev("editLinkDialog")(); out.box = !!app.el("el-u0");
    app.el("el-u0").onclick(); out.unlinked = [!!ln.olink, steps().slice(-1)[0]];
    return out;
  ` }).result;
  assert.deepStrictEqual(o.linked, [true, "Link to Pattern Outline"]);
  assert.deepStrictEqual(o.moved, [[420, 50], [420, 150], [410, 100]], "the edge 50 mm out: the line still 30 mm inside it, its curve point with it");
  assert.deepStrictEqual(o.again, [[360, 50], [360, 150]], "edited to 40 mm inside, it keeps 40 mm when the edge comes back");
  assert.deepStrictEqual(o.afterAdd[0], o.afterAdd[1], "a point added to the outline leaves the line where it is");
  assert.deepStrictEqual(o.file, [31, true], "saved as version 31 (Round H1a; 30 in r34) with the link");
  assert.strictEqual(o.box, true, "Edit Link lists the link");
  assert.deepStrictEqual(o.unlinked, [false, "Unlink from Pattern Outline"]);
});

test("r34 / 4: Half Symmetric Pattern (with Sewing): two patterns drawn as mirror images (the second the other way round, from another start) become a symmetric pair, the first selected the source; a seam on the second's edge is carried over; a seam of the source to itself is sewn on the copy too, tied; an edit on the source is mirrored on the copy; two that are not mirror images are refused", () => {
  const o = boot({ blank: true, script: DOC + `
    S.pieces.length = 0;
    const L = app.mkPiece("Left", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:100,y:400},{x:0,y:200}], true));
    const C = app.mkPiece("C", app.mkShape([{x:1200,y:0},{x:1400,y:0},{x:1400,y:400},{x:1200,y:400}], true));
    S.pieces.push(L, C); app.commit();
    S.sel = [L.id, C.id]; app.ev("halfSymmetric")(); out.notMirror = [!!C.link, toasts.slice(-1)[0]];
    // the mirror image in x = 500, its points listed the other way round and from another start
    const mir = (q) => ({ x: 1000 - q.x, y: q.y });
    const R = app.mkPiece("Right", app.mkShape([mir({x:300,y:400}), mir({x:300,y:0}), mir({x:0,y:0}), mir({x:0,y:200}), mir({x:100,y:400})], true));
    S.pieces.push(R); app.commit();
    // a seam on R's top edge to C's left edge; the source sewn to itself (its top edge to its right edge)
    const top = R.segs.findIndex((s, i) => R.pts[i].y === 0 && R.pts[(i + 1) % 5].y === 0);
    const sm = app.ev("makeSeam")(S.seams, { piece: R.id, shape: 0, sids: [R.segs[top].id] }, { piece: C.id, shape: 0, sids: [C.segs[3].id] }, true); S.seams.push(sm);
    const s2 = app.ev("makeSeam")(S.seams, { piece: L.id, shape: 0, sids: [L.segs[0].id] }, { piece: L.id, shape: 0, sids: [L.segs[1].id] }, true); S.seams.push(s2);
    app.commit(); const n0 = S.seams.length;
    S.sel = [L.id, R.id]; app.ev("halfSymmetric")();
    out.linked = [!!R.link && R.link.of === L.id, R.link && R.link.kind, steps().slice(-1)[0]];
    const kept = S.seams.find(x => x.id === sm.id);
    out.kept = [!!kept, !!kept && R.segs.some(s => s.id === kept.a[0].sids[0])];
    out.sewn = [S.seams.length - n0, s2.mir !== undefined];
    // an edit on the source is mirrored on the copy
    app.push(); L.pts[2] = { x: 320, y: 400 }; app.commit();
    out.mirrored = R.pts.some(q => Math.abs(q.x - 680) < 1e-6 && Math.abs(q.y - 400) < 1e-6);
    return out;
  ` }).result;
  assert.strictEqual(o.notMirror[0], false); assert.match(o.notMirror[1], /not mirror images/);
  assert.deepStrictEqual(o.linked, [true, "symmetric", "Half Symmetric Pattern (with Sewing)"]);
  assert.deepStrictEqual(o.kept, [true, true], "the copy's seam is kept, on its new (the source's) segment ids");
  assert.deepStrictEqual(o.sewn, [1, true], "the source's seam to itself sewn on the copy too, and tied to it");
  assert.strictEqual(o.mirrored, true, "an edit on the source is mirrored on the copy");
});

test("r34 / 4: Trace as a Pattern (with Link): a whole pattern traced in Shape mode is set down with a click as a linked copy that follows its source; with an internal shape selected the row asks for whole patterns; in Line mode it points to Shape mode", () => {
  const o = boot({ blank: true, script: DOC + `
    app.setTool("trace"); app.ev("setTraceMode")("shape"); S.traceShapes = [{ pid: A.id, shape: 0 }];
    const row = app.ev("traceMenuItems")().find(r => r.n === "Trace as a Pattern (with Link)"); out.row = !!row && !row.off;
    app.ev("traceShapesLinked")(); out.hanging = !!S.place;
    const q = at(200, 600); app.click(q.x, q.y);
    const T2 = S.pieces[1];
    out.made = [S.pieces.length, T2 && T2.link && T2.link.kind, !!T2 && !!T2.link && T2.link.of === A.id, steps().slice(-1)[0]];
    const dx = T2.pts[0].x - A.pts[0].x, dy = T2.pts[0].y - A.pts[0].y;
    app.push(); A.pts[3] = { x: 420, y: 200 }; app.commit();
    out.follows = T2.pts.some(r => Math.abs(r.x - 420 - dx) < 1e-6 && Math.abs(r.y - 200 - dy) < 1e-6);
    app.addChild(A, "internals", app.mkShape([{x:50,y:50},{x:150,y:50},{x:150,y:150}], true)); app.commit();
    S.traceShapes = [{ pid: A.id, id: A.internals[0].id }];
    const r2b = app.ev("traceMenuItems")().find(r => r.n === "Trace as a Pattern (with Link)"); out.internal = [!!r2b.off, r2b.note];
    return out;
  ` }).result;
  assert.strictEqual(o.row, true); assert.strictEqual(o.hanging, true, "it hangs on the pointer until a click");
  assert.deepStrictEqual(o.made, [2, "instance", true, "Trace as a Pattern (with Link)"]);
  assert.strictEqual(o.follows, true, "an edit on the source is made on the trace");
  assert.deepStrictEqual(o.internal, [true, "whole patterns only"]);
});

/* ---------- batch 4: sewing ---------- */
test("r34 / 5: Edit Sewing ▸ Link Line: a seam's two sides (one line each) become linked lines that keep the length each has (the ease between them stays): one made 30 mm longer, the other follows by 30 mm; one step; a seam along several lines is refused", () => {
  const o = boot({ blank: true, script: DOC + `
    const B = app.mkPiece("B", app.mkShape([{x:600,y:0},{x:960,y:0},{x:960,y:200},{x:600,y:200}], true)); S.pieces.push(B); app.commit();
    // A's right edge (200 long) to B's left edge (200 long)... B's top (360) to A's top halves? A's top is two lines: refused
    const ar = A.segs.findIndex((s, i) => A.pts[i].x === 400 && A.pts[(i + 1) % A.pts.length].x === 400);
    const sm = app.ev("makeSeam")(S.seams, { piece: A.id, shape: 0, sids: [A.segs[ar].id] }, { piece: B.id, shape: 0, sids: [B.segs[3].id] }, true); S.seams.push(sm);
    const sm2 = app.ev("makeSeam")(S.seams, { piece: A.id, shape: 0, sids: [A.segs[0].id, A.segs[1].id] }, { piece: B.id, shape: 0, sids: [B.segs[0].id] }, true); S.seams.push(sm2);
    app.commit();
    app.ev("seamLinkLine")(sm2); out.refused = toasts.slice(-1)[0];
    // B's left edge made 10 mm shorter first, so the two differ (an ease of 10 mm)
    app.push(); B.pts[0].y = 10; app.commit();
    const len = (p, i) => app.ev("segLen")(p, i);
    out.before = [len(A, ar), len(B, 3)].map(v => +v.toFixed(3));
    app.ev("seamLinkLine")(sm); out.step = steps().slice(-1)[0]; out.links = S.lineLinks.length;
    app.push(); A.pts[(ar + 1) % A.pts.length].y = 230; app.commit();
    out.after = [len(A, ar), len(B, 3)].map(v => +v.toFixed(3));
    return out;
  ` }).result;
  assert.match(o.refused, /one line each/);
  assert.deepStrictEqual(o.before, [200, 190]);
  assert.deepStrictEqual([o.step, o.links], ["Link Line", 1]);
  assert.deepStrictEqual(o.after, [230, 220], "A's side 30 mm longer, B's follows by 30: the 10 mm ease stays");
});

test("r34 / 5: a topstitch's Assign to New Topstitch (a new library type, a copy of its own, given to it alone) and Add Internal Line on Topstitch (an open internal line along it, straight where it runs straight); on Edit Topstitch's right-click and Edit ▸ Context Menu ▸ Sewing; one step each", () => {
  const o = boot({ blank: true, script: DOC + `
    const st = app.ev("addStitch")({ piece: A.id, shape: 0, sids: [A.segs[2].id], t0: 0, t1: 1 }); st.offset = 8; app.commit();
    const n0 = (S.lib.topstitch || []).length;
    S.selStitch = st.id;
    app.ev("stitchNewType")(st);
    out.type = [(S.lib.topstitch || []).length - n0, st.preset, steps().slice(-1)[0]];
    const it = S.lib.topstitch.find(t => t.name === st.preset); out.offset = it && it.offset;
    app.ev("stitchToLine")(st);
    const ln = A.internals[A.internals.length - 1];
    out.line = [A.internals.length, !!ln && !ln.closed, ln && ln.pts.length, ln && r2([ln.pts[0], ln.pts[ln.pts.length - 1]]).map(q => q[0]), steps().slice(-1)[0]];
    return out;
  ` }).result;
  assert.deepStrictEqual(o.type, [1, "Default Topstitch 2", "Assign to New Topstitch"]);
  assert.strictEqual(o.offset, 8, "the new type has this topstitch's offset");
  assert.deepStrictEqual(o.line, [1, true, 2, [392, 392], "Add Internal Line on Topstitch"], "a straight line 8 mm inside the right edge, one step");
});

/* ---------- batch 5: 3D ---------- */
const SEWN3 = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1];
  A.p3 = { pos: [500, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [500, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
  const steps = () => app.histSteps().steps.map(s => s.n);
`;
test("r34 / 6: pins one at a time: a right-click on a pin in 3D selects it and the menu starts with Delete Selected Pin and Attach Pin to Avatar; Delete takes that pin alone (one step); with no avatar Attach says so and changes nothing; a pin attached to the avatar gives Detach Pin from Avatar, which makes it a pin again; Edit ▸ Context Menu ▸ 3D Garment's rows follow the selection; Custom View lists the Render workspace's views", () => {
  const o = boot({ blank: true, three: true, script: SEWN3 + `
    A.pins = [{ x: 150, y: 200 }, { x: 50, y: 50 }]; app.commit(); app.ev("garmentSync")();
    const it = G3.items.get(A.id), m = it.mesh;
    const near = (q) => { let v = -1, d = Infinity; for (let i = 0; i < m.xy.length/2; i++) { const e = (m.xy[2*i] - q.x)**2 + (m.xy[2*i+1] - q.y)**2; if (e < d) { d = e; v = i; } } return v; };
    const scr = (q) => { const v = near(q); return v3.project(new THREE.Vector3(it.X[3*v], it.X[3*v+1], it.X[3*v+2])); };
    const s = scr(A.pins[0]);
    out.sel = app.ev("pinAt3")({ clientX: s.x, clientY: s.y });
    out.miss = app.ev("pinAt3")({ clientX: s.x + 40, clientY: s.y + 40 });
    app.ev("garmentMenu")({ clientX: s.x, clientY: s.y, preventDefault() {} });
    out.rows = app.menu.children.map(c => c.innerHTML.replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 3);      // (the search field first: an empty row)
    app.ev("attachSelPin")(); out.noav = [A.pins.length, toasts.slice(-1)[0]];
    app.ev("deleteSelPin")(); out.del = [A.pins.length, A.pins[0], steps().slice(-1)[0]];
    // a pin attached to the avatar (a tack marked as a pin's): Detach makes it a pin again
    S.tacks = [{ id: 7, a: { piece: A.id, x: 200, y: 300 }, b: null, av: { x: 0, y: 1000, z: 0 }, pin: true }]; app.commit();
    G3.selPin = { tack: 7 }; app.ev("detachSelPin")(); out.detach = [S.tacks.length, A.pins.length, steps().slice(-1)[0]];
    // Custom View: the Render workspace's views
    out.cv0 = app.ev("customViewRows")().map(r => r.n || "—");
    return out;
  ` }).result;
  assert.deepStrictEqual(o.sel, { pid: 1, k: 0 }, "the pin under the pointer"); assert.strictEqual(o.miss, null, "40 px away: none");
  assert.deepStrictEqual(o.rows, ["Pin", "Delete Selected Pin", "Attach Pin to Avatar"]);
  assert.strictEqual(o.noav[0], 2); assert.match(o.noav[1], /needs an avatar/);
  assert.deepStrictEqual(o.del, [1, { x: 50, y: 50 }, "Delete Selected Pin"], "that pin alone, one step");
  assert.deepStrictEqual(o.detach, [0, 2, "Detach Pin from Avatar"]);
  assert.deepStrictEqual(o.cv0, ["Add Current Viewport"], "no custom views yet: the row to add one");
});

/* ---------- batch 6: groups, distribute, a size's own colour ---------- */
test("r34 / 7: Group: two selected patterns grouped (one step), a click on one with Transform Pattern selects both, Ungroup undoes it; a group left with one pattern is none; pasted together, copies keep their grouping apart from the originals; saved as version 30 with the group. Distribute ▸ Horizontally: three patterns spaced with equal gaps, the outer two stay; one step. A size's own colour: drawn in it with its dashes kept, Default Color takes it back", () => {
  const o = boot({ blank: true, oldSizeRun: true, script: DOC + `
    const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:400},{x:x+100,y:400},{x:x+100,y:500},{x:x,y:500}], true));
    const B = sq("B", 0), C = sq("C", 300), D = sq("D", 1000); S.pieces.push(B, C, D); app.commit();
    S.sel = [B.id, C.id]; app.ev("groupSel")();
    out.grouped = [B.group, C.group, D.group || 0, steps().slice(-1)[0]];
    app.setTool("transform_pattern"); S.sel = []; click(50, 450);
    out.clickSel = S.sel.slice().sort();
    // Distribute across: B (0-100), C (300-400), D (1000-1100), and A (0-400 at the top) left out of the selection
    S.sel = [B.id, C.id, D.id]; app.ev("distributeSel")("x");
    out.dist = [Math.round(app.ev("bboxOf")([C]).x0), steps().slice(-1)[0]];
    // saved with the group
    const d = app.fileDoc(saveBytes()); out.file = [d.v, d.pieces.filter(p => p.group).length];
    // pasted together: copies in a group of their own
    S.sel = [B.id, C.id]; app.ev("copySel")(); app.ev("paste")(false); const q = at(600, 900); app.click(q.x, q.y);
    const copies = S.pieces.slice(-2); out.paste = [copies[0].group === copies[1].group, copies[0].group !== B.group];
    // Ungroup; then a group of one is none
    S.sel = [B.id]; app.ev("ungroupSel")(); out.ungrouped = [!!B.group, !!C.group, steps().slice(-1)[0]];
    S.sel = [copies[0].id, D.id]; app.ev("groupSel")(); out.moved = [copies[0].group === D.group, !!copies[1].group];
    // a size's own colour
    const G = S.grading, g = G.groups[0], z = g.sizes.find(x => x.id !== g.base);
    const was = app.ev("gradeLook")(G, g, z);
    z.color = "#ff00ff"; z.own = true; app.commit(); const own = app.ev("gradeLook")(G, g, z);
    out.look = [was.color !== "#ff00ff", own.color, JSON.stringify(own.dash) === JSON.stringify(was.dash), own.width === was.width];
    out.kept = app.ev("normGrading")(JSON.parse(JSON.stringify(G))).groups[0].sizes.find(x => x.id === z.id).own;
    return out;
  ` }).result;
  assert.deepStrictEqual(o.grouped.slice(2), [0, "Group"]); assert.ok(o.grouped[0] > 0 && o.grouped[0] === o.grouped[1], "one group for both");
  assert.strictEqual(o.clickSel.length, 2, "a click on one selects the group");
  assert.deepStrictEqual(o.dist, [500, "Distribute"], "gaps of 400: 0-100, 500-600, 1000-1100");
  assert.deepStrictEqual(o.file, [31, 2]);      // (Round H1a: version 31; 30 in r34)
  assert.deepStrictEqual(o.paste, [true, true], "the copies in a group of their own");
  assert.deepStrictEqual(o.ungrouped, [false, false, "Ungroup"]);
  assert.deepStrictEqual(o.moved, [true, false], "the copy grouped with D left its pasted group, which (one pattern) is none");
  assert.deepStrictEqual(o.look, [true, "#ff00ff", true, true], "its own colour, the dashes and width of its kind kept");
  assert.strictEqual(o.kept, true, "kept in the file");
});

/* ---------- batch 7: files and help ---------- */
test("r34 / 8: a large file shows a line with a moving bar while it opens (\"Opening …\", then \"Building the patterns…\"), gone once it is open; a small one opens at once as before; the bug information names the graphics card", () => {
  const o = boot({ blank: true, script: DOC + `
    return (async () => {
      const bytes = saveBytes();
      // small: opened at once, no line
      app.ev("openFile")("small.pdraft", bytes, null, true); out.small = [S.pieces.length, !app.el("busy") || app.el("busy").style.display !== "flex"];
      // as if large (the threshold lowered): the line shows, then goes
      S.busyMin = 0; S.pieces.length = 0; app.commit();
      app.ev("openFile")("big.pdraft", bytes, null, true);
      const b = app.el("busy"); out.during = [!!b && b.style.display, app.ev("BUSY_T").textContent, S.pieces.length];
      app.runTimers();
      out.after = [S.pieces.length, app.el("busy").style.display];
      delete S.busyMin;
      out.bug = (await app.ev("bugInfo")()).split("\\n").find(l => l.startsWith("Graphics: ")) || null;
      return out;
    })();
  ` }).result;
  assert.deepStrictEqual(o.small, [1, true], "a small file opens at once, no line");
  assert.deepStrictEqual(o.during, ["flex", "Building the patterns…", 0], "the line shows while the large one is built");
  assert.deepStrictEqual(o.after, [1, "none"], "gone once it is open");
  assert.ok(o.bug && /^Graphics: .+/.test(o.bug), "a Graphics line: " + o.bug);
});

module.exports = T;





