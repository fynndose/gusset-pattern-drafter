// Round r15: the differences the check videos found, one batch per tool area, and the history bug
// (a click that only selects left a step).
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  // long options go through a file: a Windows command line holds at most 32 767 characters
  let arg = JSON.stringify(opt || {});
  if (arg.length > 30000) { const f = path.join(require("os").tmpdir(), "pdraft-boot-r15-" + process.pid + ".json"); fs.writeFileSync(f, arg); arg = "@" + f; }
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), arg], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// two rectangles, A at x 0…200 and B at x 300…500, both 400 high
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
  const B = app.mkPiece("B", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:400},{x:300,y:400}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0; S.un.length = 0;
  const at = (x, y) => app.toS({ x, y }), out = {};
  const click = (x, y, o) => { const s = { ...at(x, y), ...(o || {}) }; app.fire("pointermove", s); app.fire("pointerdown", s); app.fire("pointerup", s); };
  const drag = (x0, y0, x1, y1, o) => { const a = { ...at(x0, y0), ...(o || {}) }, b = { ...at(x1, y1), ...(o || {}) }; app.fire("pointermove", a); app.fire("pointerdown", a); app.fire("pointermove", { ...a, x: (a.x + b.x)/2, y: (a.y + b.y)/2 }); app.fire("pointermove", b); app.fire("pointerup", b); };
  const steps = () => app.histSteps().steps.map(s => s.n);
  const sub = (items, n) => items.filter(Boolean).find(x => x.n === n).menu().filter(Boolean);
`;

/* ---------- 1: a click that only selects is no history step ---------- */
test("r15 / 1: a click that only selects leaves no history step, in Edit Pattern, Transform Pattern and Edit Sewing; a drag is one step; a selecting click after an undo keeps the redo", () => {
  const o = boot({ blank: true, script: DOC + `
    const part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
    S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }); app.commit(); S.undo.length = 0; S.un.length = 0;
    app.setTool("edit_pattern");
    click(200, 0); out.pt = [S.selPt, steps()];                     // a corner
    click(100, 0); out.seg = [S.selSeg, steps()];                   // a line
    click(100, 200); out.piece = [S.sel.slice(), steps()];          // inside the pattern
    click(900, 900); out.empty = steps();                           // nothing there
    drag(200, 0, 220, -20); out.dragged = [steps(), S.pieces[0].pts[1]];
    app.undo(); click(100, 0); out.redo = [steps(), app.histSteps().at];
    app.setTool("transform_pattern"); click(400, 200); out.tp = [S.sel.slice(), steps()];
    app.setTool("edit_sewing"); click(200, 200); out.sew = [S.selSeam, steps()];
    return out;
  ` }).result;
  assert.strictEqual(o.pt[0], 1); assert.deepStrictEqual(o.pt[1], [], "a point selected: no step");
  assert.strictEqual(o.seg[0], 0); assert.deepStrictEqual(o.seg[1], [], "a line selected: no step");
  assert.deepStrictEqual(o.piece[1], [], "a pattern selected: no step");
  assert.deepStrictEqual(o.empty, [], "a click on nothing: no step");
  assert.deepStrictEqual(o.dragged[0], ["Edit Pattern"], "a drag is one step");
  near(o.dragged[1].x, 220, 1e-6);
  assert.deepStrictEqual(o.redo, [["Edit Pattern"], 0], "after an undo, a selecting click keeps the step to redo");
  assert.ok(o.tp[0].length === 1, "Transform Pattern selected B"); assert.deepStrictEqual(o.tp[1], ["Edit Pattern"], "and made no step of its own");
  assert.deepStrictEqual(o.sew[1], ["Edit Pattern"], "Edit Sewing: a click on a seam made no step " + JSON.stringify(o.sew));
});

/* ---------- 2: darts ---------- */
test("r15 / 2: Create Dart (the Dart tool): four arms, Position Outline / Center as radio buttons, and the four distances to the outline from the dart's outline or its middle; typed, they move the dart; Add Dart opens at 20 / 10 / 70 with Shape Dart Cap", () => {
  const o = boot({ script: DOC + `
    let F = null, O = null;
    app.answer = (t, f, opts) => { F = f; O = opts; return null; };
    app.setTool("dart_double"); click(100, 200);
    out.fields = F.map(x => [x.k, x.val, !!x.radios]);
    const v0 = {}; for (const x of F) v0[x.k] = x.val;
    out.center = O.sync({ ...v0, pos: "center" }, "pos");
    out.typed = O.sync({ ...v0, l: 30 }, "l");
    out.wider = O.sync({ ...v0, l: 30, r: 130, wl: 40 }, "wl");      // (after Left 30 was typed)
    out.check = [O.check({ ...v0 }), O.check({ ...v0, l: -30 })];
    // OK with Center and Left 50: the middle 50 from A's left edge
    app.answer = () => ({ ...v0, pos: "center", l: 50, r: 100, u: 200, d: 200 }); app.setTool("dart_double"); click(100, 200);
    out.made = A.internals[0].pts.map(q => [Math.round(q.x), Math.round(q.y)]);
    // Add Dart on an outline point
    let D = null; app.answer = (t, f, opts) => { D = [t, f.map(x => [x.label, x.val]), (opts.checks || []).map(c => [c.label, c.val])]; return null; };
    app.setTool("edit_pattern"); const s = at(500, 400); app.menuClick(s.x, s.y, "Add Dart");
    out.dart = D;
    return out;
  ` }).result;
  assert.deepStrictEqual(o.fields, [["wl", 20, false], ["wr", 20, false], ["up", 130, false], ["down", 140, false], ["pos", "outline", true], ["l", 80, false], ["r", 80, false], ["u", 70, false], ["d", 60, false]]);
  assert.deepStrictEqual(o.center, { l: 100, r: 100, u: 200, d: 200 }, "Center: from the dart's middle");
  assert.strictEqual(o.typed.r, 130, "Left 30: Right follows (200 wide, 40 of dart)"); assert.strictEqual(o.typed.l, undefined, "the field typed is left alone");
  assert.deepStrictEqual([o.wider.l, o.wider.r], [10, 130], "a wider left arm: the left distance from the dart's outline shrinks, the middle stays where Left 30 put it");
  assert.strictEqual(o.check[0], ""); assert.ok(/intersecting/.test(o.check[1]), "outside the outline: the reference's words");
  assert.deepStrictEqual(o.made, [[50, 70], [70, 200], [50, 340], [30, 200]], "the middle at Left 50, Up 200 from the outline");
  assert.deepStrictEqual(o.dart, ["Dart", [["Total Width", 20], ["Dart Arm Width", 10], ["Length", 70]], [["Shape Dart Cap", true]]]);
});

/* ---------- 3: the seam allowance corner types ---------- */
test("r15 / 3: the Seam Allowance tool selects a corner point; the Property Editor's Corner Type picker lists the reference's types with pictures; picking one is one step 'Seam Allowance Corner' with its values; Line 1 / Line 2, Distance; drawn on the pattern; version 18 saved and opened; a version 17 file's corners renamed", () => {
  const o = boot({ script: DOC + `
    return (async () => {
      for (const s of A.segs) s.sa = 10;
      app.commit(); S.undo.length = 0; S.un.length = 0;
      const pe = () => app.el("props").innerHTML, g = (id) => app.el(id);
      app.setTool("seam_allowance"); click(200, 0);
      out.sel = [S.selPt, S.selSeg, steps()];
      out.section = [/Corner Type/.test(pe()), /id="cx-t"/.test(pe()), /Extension/.test(pe())];
      g("cx-t").onclick(); out.open = ["ext", "perp", "turn", "slant", "round", "env", "dartcap", "pocket"].map(k => new RegExp('id="cx-t-' + k + '"').test(pe()));
      out.pictures = (pe().match(/class="cic"/g) || []).length; out.nb = [S.ui.unbuilt, /id="cx-t-dartcap"[^>]*disabled/.test(pe()), /Dart Cap [(]not built yet[)]/.test(pe())];
      S.ui.unbuilt = false; app.ev("ui")(); out.nbOff = /id="cx-t-dartcap"/.test(pe());
      g("cx-t-perp").onclick();
      out.perp = [A.segs[1].corner, steps(), /Intersection Properties/.test(pe()), /id="cx-l1"[^>]*aria-pressed="true"/.test(pe()), (pe().match(/id="cx-d"[^>]*value="([0-9.]+)"/) || [])[1]];
      g("cx-l2").onclick(); out.l2 = A.segs[1].corner;
      g("cx-d").onchange({ target: { value: "25" } }); out.d = A.segs[1].corner;
      g("cx-rev").onchange({ target: { checked: true } }); out.rev = A.segs[1].corner;
      // the two lines drawn with their numbers
      const said = []; const ctx = app.ev("ctx"), ft = ctx.fillText; ctx.fillText = (t, x, y) => { said.push(t); return ft && ft.call(ctx, t, x, y); }; app.ev("draw")(); ctx.fillText = ft;
      out.numbers = ["1", "2"].map(t => said.includes(t));
      // the other types through the picker's code
      app.ev("cornerPick")(A, [2], "pocket"); out.pocket = [A.segs[2].corner, /Distance A [(]/.test((app.setTool("seam_allowance"), click(200, 400), pe()))];
      app.ev("cornerPick")(A, [3], "env"); out.env = A.segs[3].corner;
      out.steps = steps();
      // the Selected Line's Start / End / Intersection are pickers too
      click(100, 0); out.line = ["sl-c0", "sl-c1", "sl-cx"].map(id => new RegExp('id="' + id + '"[^>]*class|class="cpk" id="' + id + '"').test(pe()));
      // saved and opened
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file"); const d = app.fileDoc(file);
      out.v = d.v; out.saved = d.pieces[0].segs.map(s => s.corner || null);
      // a version 17 file: Mirror and Right Angled corners
      const old = JSON.parse(app.docJSON()); old.v = 17; old.pieces[0].segs[1].corner = { t: "mirror" }; old.pieces[0].segs[2].corner = { t: "right" }; old.pieces[0].segs[3].corner = { t: "perp2" };
      app.ev("loadDoc")(old); out.old = S.pieces[0].segs.map(s => s.corner || null);
      return out;
    })();
  ` }).result;
  assert.deepStrictEqual(o.sel, [1, -1, []], "the corner at (200, 0) selected, no step");
  assert.deepStrictEqual(o.section, [true, true, true]);
  assert.deepStrictEqual(o.open, [true, true, true, true, true, true, true, true], "the eight types");
  assert.deepStrictEqual(o.nb, [true, true, true], "Dart Cap greyed and saying so while Show Tools That Are Not Built Yet is on"); assert.strictEqual(o.nbOff, false, "and hidden while it is off");
  assert.ok(o.pictures >= 8, "a picture each, and on the button: " + o.pictures);
  // (Round r25, session 3 Number 15: Line 1 is the incoming line, so Perpendicular starts on "in"; before it was "out", the right side)
  assert.deepStrictEqual(o.perp.slice(0, 4), [{ t: "perp", on: "in" }, ["Seam Allowance Corner"], true, true], "Line 1 at a clockwise rectangle's top right corner: the top line, the line coming in");
  assert.strictEqual(o.perp[4], "10", "Distance shows where the top's cut line meets the side's seam line: 10");
  // (Round r26, guess r26/1: Distance stops at where the other cut line crosses, 10 here; the reference's field took nothing past it)
  assert.deepStrictEqual(o.l2, { t: "perp", on: "out" }); assert.deepStrictEqual(o.d, { t: "perp", on: "out", d: 10 }); assert.deepStrictEqual(o.rev, { t: "perp", on: "out", d: 10, rev: true });
  assert.deepStrictEqual(o.numbers, [true, true], "Line 1 and Line 2 written on the pattern");
  assert.deepStrictEqual(o.pocket, [{ t: "pocket", st: 1, din: 5, dout: 5 }, true]);
  assert.deepStrictEqual(o.env, { t: "env", d: 4 });
  assert.deepStrictEqual(o.steps, Array(6).fill("Seam Allowance Corner"));
  assert.deepStrictEqual(o.line, [true, true, true]);
  assert.strictEqual(o.v, 27);      // (version 27 since Round r29 (a document's render settings); 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2: the history saved as changes)
  assert.deepStrictEqual(o.saved, [null, { t: "perp", on: "out", d: 10, rev: true },      // (Round r25: Line 2 is the outgoing line now)
    { t: "pocket", st: 1, din: 5, dout: 5 }, { t: "env", d: 4 }]);
  assert.deepStrictEqual(o.old, [null, { t: "turn" }, { t: "env", d: 14.142 }, { t: "perp", on: "out" }], "Mirror is Turnback, Right Angled an Envelope at its place, Perpendicular 2 Perpendicular on the outgoing line");
});

/* ---------- 4: selecting and placing ---------- */
test("r15 / 4: placing a Symmetric Pattern, a right-click does nothing (no box, it stays on the pointer, no menu); Esc gives it up; a click sets it down", () => {
  const o = boot({ script: DOC + `
    const rclick = (x, y) => { const s = at(x, y); app.fire("contextmenu", { x: s.x, y: s.y }); };
    let asked = 0; app.answer = () => { asked++; return null; };
    S.sel = [A.id]; app.ev("linkedCopy")("symmetric"); app.fire("pointermove", at(700, 200));
    rclick(700, 200); out.after = [!!S.place, asked, S.pieces.length, !!(app.menu && app.menu.children && app.menu.children.length)];
    app.key("Escape"); out.esc = [!!S.place, S.pieces.length];
    S.sel = [A.id]; app.ev("linkedCopy")("symmetric"); click(700, 200); out.down = [!!S.place, S.pieces.length, S.pieces[2] && S.pieces[2].link && S.pieces[2].link.kind];
    return out;
  ` }).result;
  assert.deepStrictEqual(o.after.slice(0, 3), [true, 0, 2], "still on the pointer, no box, nothing made");
  assert.deepStrictEqual(o.esc, [false, 2]);
  assert.deepStrictEqual(o.down, [false, 3, "symmetric"]);
});

/* ---------- 5: drawing ---------- */
test("r15 / 5: drawing catches whatever is nearest (a level line nearer than a corner wins); with Shift no point is caught, however near, but a line the 45° step crosses is; Mirror Creation's Axis is Local, Y-Axis, X-Axis, opens at Local and is not remembered", () => {
  const o = boot({ blank: true, script: `
    const out = {}, snap = app.ev("drawSnap"), mk = () => [S.snapMark.kind, S.snapMark.hv];
    S.pieces = [app.mkPiece("R", app.mkShape([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], true))]; app.commit();
    const px = 1/S.view.s, r = (q) => [+q.x.toFixed(4), +q.y.toFixed(4)];
    // the corner (200, 0) 11.7 px away, the level line through the last point (400, 3 px down) 1 px away: the level line.
    // (Round r19 / H10: the reaches grew to 12 px for points and 10 for lines; the pointer was 6 px right of the side x = 200, which
    // now catches where the level line crosses that side (r15's rule for an edge with a line in reach), so it is 11 px right of it)
    out.near = [r(snap({ x: 200 + 11*px, y: 4*px }, { x: 400, y: 3*px })), mk()];
    // the corner 3 px away and nothing else near: the corner
    out.pt = [r(snap({ x: 200 + 3*px, y: -2*px }, { x: 500, y: 300 })), mk()];
    // Shift: from (300, 95) up and to the left, the pointer 2 px off the corner (200, 0): the 45° line passes it by, no point caught
    S.shift = true;
    out.shiftPt = [r(snap({ x: 200 + 2*px, y: 0 }, { x: 300, y: 95 })), mk()];
    // Shift: from (300, 150) down-left at 45°, crossing the right side x = 200 near (200, 50): caught on the line
    out.shiftLine = [r(snap({ x: 200 - 2*px, y: 50 - 2*px }, { x: 300, y: 150 })), mk()];
    S.shift = false;
    // Mirror Creation's Axis
    app.setTool("polygon");
    const C = (x, y) => { const q = app.toS({ x, y }); app.click(q.x, q.y); };
    C(500, 100); C(560, 140); app.fire("pointermove", app.toS({ x: 600, y: 200 }));
    let f0 = null; app.answer = (t, f) => { f0 = f.find(x => x.k === "axis"); return { len: 0, ang: 0, mirror: "on", axis: "y" }; };
    app.ev("penNumeric")({ x: 10, y: 10 }); out.first = [f0.val, f0.options.map(x => x[1])];
    app.key("Escape");
    C(700, 100); C(760, 140); app.fire("pointermove", app.toS({ x: 800, y: 200 }));
    let f1 = null; app.answer = (t, f) => { f1 = f.find(x => x.k === "axis"); return null; };
    app.ev("penNumeric")({ x: 10, y: 10 }); out.second = [f1.val];
    return out;
  ` }).result;
  assert.deepStrictEqual(o.near[1], [null, "h"], "the level line, nearer than the corner"); assert.ok(Math.abs(o.near[0][0] - 200) > 1e-3, "not on the corner");
  assert.deepStrictEqual([o.pt[0], o.pt[1][0]], [[200, 0], "pt"]);
  assert.strictEqual(o.shiftPt[1][0], null, "no point with Shift " + JSON.stringify(o.shiftPt)); assert.ok(Math.abs(o.shiftPt[0][0] - 200) > 1e-3 || Math.abs(o.shiftPt[0][1]) > 1e-3, "not on the corner: " + o.shiftPt[0]);
  assert.ok(Math.abs(o.shiftPt[0][0] - 300 + (95 - o.shiftPt[0][1])) < 1e-6, "on the 45° line");
  assert.deepStrictEqual(o.shiftLine, [[200, 50], ["edge", null]], "the 45° line caught where it crosses the side");
  assert.deepStrictEqual(o.first, ["local", ["Local", "Y-Axis", "X-Axis"]]);
  assert.strictEqual(o.second[0], "local", "the next polygon opens at Local again");
});

/* ---------- 6: Edit Pattern's line commands ---------- */
test("r15 / 6: Delete Line on an outline line deletes the pattern (one step, undo brings it back); Align moves the first line and reshapes its pattern, Match Up lays the first pattern against the second line; Align has Bottom for points too; Change Length opens at Start", () => {
  const o = boot({ script: DOC + `
    app.setTool("edit_pattern");
    click(100, 0); const s = at(100, 0); app.menuClick(s.x, s.y, "Delete Line");
    out.del = [S.pieces.map(p => p.name), steps()];
    app.undo(); out.back = S.pieces.map(p => p.name);
    // Match Up: A's right side against B's left side: A moves, B stays
    const A2 = S.pieces[0], B2 = S.pieces[1], B0 = B2.pts.map(q => [q.x, q.y]);
    const L = (p, i) => ({ p, sh: p, i, kind: "outline", int: -1 });
    app.ev("matchUpLines")([L(A2, 0), L(B2, 0)]);
    out.match = [B2.pts.map(q => [q.x, q.y]), A2.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)])];
    out.rows = [app.ev("ALIGN").map(x => x[1]), app.ev("POINT_ALIGN").map(x => x[1])];
    let dir = null; app.answer = (t, f, opts) => { dir = opts.selects[0].val; return { len: 150, move: "end", lock: false }; };
    app.ev("segLengthNumeric")({ x: 0, y: 0 }, B2, 0);
    app.answer = (t, f, opts) => { out.dir2 = opts.selects[0].val; return null; }; app.ev("segLengthNumeric")({ x: 0, y: 0 }, B2, 0);
    out.dir = dir;
    return out;
  ` }).result;
  assert.deepStrictEqual(o.del, [["B"], ["Delete Line"]]);
  assert.deepStrictEqual(o.back, ["A", "B"]);
  assert.deepStrictEqual(o.match[0], [[300, 0], [500, 0], [500, 400], [300, 400]], "B stays");
  assert.ok(o.match[1].some(q => q[0] === 300 && q[1] === 0) && o.match[1].some(q => q[0] === 500 && q[1] === 0), "A's top laid on B's top: " + JSON.stringify(o.match[1]));
  assert.deepStrictEqual(o.rows, [["Left", "Center", "Right", "Top", "Middle", "Bottom"], ["Left", "Center", "Right", "Top", "Middle", "Bottom"]]);
  assert.deepStrictEqual([o.dir, o.dir2], ["start", "start"], "Start every time, also after End was chosen");
});

/* ---------- 7: lines, sewing and topstitch ---------- */
test("r15 / 7: Seamline Topstitch on one part of an M:N seam runs along that part and what it is sewn to; the Topstitch rows in the Property Editor with Placement; Edit Sewing off a seam opens the ordinary menu; a notch's Custom angle is the angle to the line, opening at 90", () => {
  const o = boot({ script: DOC + `
    // A's right side (400 long) sewn to B's left side split in two halves: a 1:2 seam
    const pp = (p, i, t0, t1) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0, t1, rev: false });
    S.seams.push({ id: 1, a: [pp(A, 1, 0, 1)], b: [pp(B, 3, 0, 0.5), pp(B, 3, 0.5, 1)] }); app.commit(); S.undo.length = 0; S.un.length = 0;
    app.setTool("seamline_topstitch");
    const hb = app.ev("seamHit"), s1 = at(300, 100);
    const h = hb(s1.x, s1.y); out.hit = h && [h.side, h.k];
    click(300, 100);
    out.made = S.stitches.map(s => [s.side, s.part.piece === A.id ? "A" : "B", +s.part.t0.toFixed(2), +s.part.t1.toFixed(2), s.name, s.from && [s.from.side, s.from.k]]);
    out.sel = S.selStitch === S.stitches[0].id;
    // the Property Editor with Edit Topstitch
    app.setTool("edit_topstitch"); S.selStitch = S.stitches[0].id; S.sel = [S.stitches[0].part.piece]; app.ev("ui")();
    const pe = app.el("props").innerHTML;
    out.rows = ["Name", "Topstitch Property", "Extend Start", "Extend End", "Corner", "Placement"].map(r => pe.includes(">" + r));
    app.el("st-pl").onchange({ target: { value: "b" } }); out.b = S.stitches.map(s => [s.side, +s.part.t0.toFixed(2)]);
    app.el("st-ee").onchange({ target: { checked: false } }); out.ee = S.stitches.map(s => s.extE);
    out.steps = steps();
    // Edit Sewing: the empty canvas
    app.setTool("edit_sewing"); app.menu.children.length = 0; app.fire("contextmenu", { x: 5, y: 5 });
    out.empty = app.menu.children.map(c => c.innerHTML.replace(/<[^>]+>/g, "")).filter(t => /Show Sewing|Paste/.test(t));
    // the notch's Custom angle
    A.segs[0].notches = [0.5]; app.commit(); app.setTool("notch"); S.sel = [A.id]; S.selNotch = { pid: A.id, sid: A.segs[0].id, k: 0 }; app.ev("ui")();
    const val = () => (app.el("props").innerHTML.match(/id="sn-a"[^>]*value="([-0-9.]+)"/) || [])[1];
    app.el("sn-am").onchange({ target: { value: "c" } }); const h1 = app.el("props").innerHTML;
    out.custom = [/<option value="c" selected>/.test(h1), val(), A.segs[0].notches[0], /id="sn-len"[^>]*disabled/.test(h1)];
    app.el("sn-a").onchange({ target: { value: "75" } }); out.typed = [A.segs[0].notches[0], val()];
    app.el("sn-am").onchange({ target: { value: "p" } }); out.perp = A.segs[0].notches[0];
    return out;
  ` }).result;
  assert.deepStrictEqual(o.hit, ["b", 1], "the upper half of B's side (the side runs up the screen)");
  assert.deepStrictEqual(o.made, [["a", "A", 0, 1, "SeamLine_Topstitch_1", ["b", 1]], ["b", "B", 0.5, 1, "SeamLine_Topstitch_1", ["b", 1]]],
    "the part clicked (B's upper half) and what it is sewn to (A's side), one topstitch");
  assert.strictEqual(o.sel, true, "and it is selected");
  assert.deepStrictEqual(o.rows, [true, true, true, true, true, true]);
  assert.deepStrictEqual(o.b, [["b", 0.5]], "Seam B: B's half only, the same part");
  assert.deepStrictEqual(o.ee, [false]);
  assert.deepStrictEqual(o.steps, ["Seamline Topstitch", "Placement", "Topstitch"]);
  assert.ok(o.empty.some(t => /^Paste/.test(t)) && !o.empty.some(t => /Show Sewing/.test(t)), "the ordinary empty-canvas menu: " + JSON.stringify(o.empty));
  assert.deepStrictEqual(o.custom, [true, "90", 0.5, true], "Custom shows 90, the notch stays square, Length greyed");
  assert.deepStrictEqual(o.typed, [{ t: 0.5, angle: 15 }, "75"], "75 to the line: leant 15 towards the line's end");
  assert.strictEqual(o.perp, 0.5, "Perpendicular again");
});

/* ---------- 8: the 3D window ---------- */
// a front and a back, sewn at both sides, in the 3D window
const SEWN = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] });
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0.6, el: 0.3, dist: 3000, tx: 0, ty: 1100, tz: 0 });
`;
test("r15 / 8: the gizmo's axes follow Gizmo ▸ (Screen, the default; Local; World); Skin Offset 3 mm and Collision Thickness 2.5 mm reach the solver; Symmetric Pinch is off; a fold line set on a draped pattern keeps its drape; Activate; the grid stays under the floor", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    S.sel = [A.id]; app.setTool3("select_move"); G3.giz = { pid: A.id, v: 0 };
    const B3 = () => app.ev("gizBasis")().map(v => v.map(c => +c.toFixed(4)));
    out.def = S.prefs.gizSpace; out.screen = B3();
    const cam = v3.camera(), r = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    out.camAxes = [[r.x, r.y, r.z], [u.x, u.y, u.z]].map(v => v.map(c => +c.toFixed(4)));
    app.setPrefs({ gizSpace: "world" }); out.world = B3();
    A.p3.q = app.ev("SIM3D").qAxis([0, 1, 0], 90); app.commit(); app.setPrefs({ gizSpace: "local" }); out.local = B3();
    out.rows = app.ev("gizSpaceRows")().map(x => [x.n, !!x.on]);
    app.setPrefs({ gizSpace: "screen" });
    // the solver: the cloth's stand-off and the least self distance
    app.ev("simBuild")(); out.thick = app.SIM.sim.thick[0]; out.selfMin = app.SIM.sim.opt.selfMin;
    // a draped pattern: its cloth moved off flat, then a fold line set on it: the cloth stays where it hangs
    const it = G3.items.get(A.id); for (let i = 0; i < it.X.length; i += 3) it.X[i+2] += 50*Math.sin(it.X[i]/100); it.draped = true;
    const before = Array.from(it.X), L = app.mkShape([{x:150,y:0},{x:150,y:400}], false); app.addChild(A, "internals", L); A.internals[0].foldAngle = 90; app.commit(); app.ev("garmentSync")();
    const it2 = G3.items.get(A.id), again = (x, y) => { const xy = it2.mesh.xy; let b = -1, bd = 1e9; for (let v = 0; v < xy.length/2; v++) { const d = Math.hypot(xy[2*v] - x, xy[2*v+1] - y); if (d < bd) { bd = d; b = v; } } return b; };
    out.remeshed = it2 !== it && it2.mesh.xy.length !== it.mesh.xy.length;
    const c0 = again(0, 0), oldC = (() => { const xy = it.mesh.xy; for (let v = 0; v < xy.length/2; v++) if (Math.hypot(xy[2*v], xy[2*v+1]) < 1e-6) return v; return -1; })();
    out.kept = [it2.draped, +Math.abs(it2.X[3*c0+2] - before[3*oldC+2]).toFixed(3)];
    // the state rows' names once set; Symmetric Pinch is off
    S.sel = [A.id]; app.key("j", { ctrlKey: true }); out.off = app.ev("off3Name")("pattern");
    out.pinch = !!S.cloth.symPinch;
    return out;
  ` }).result;
  assert.strictEqual(o.def, "screen", "Screen Coordinate first");
  assert.deepStrictEqual(o.screen.slice(0, 2), o.camAxes, "Screen: X along the screen's right, Y up it");
  assert.deepStrictEqual(o.world, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  assert.deepStrictEqual(o.local[0], [0, 0, -1], "Local: the pattern's own X, turned with it a quarter round");
  assert.deepStrictEqual(o.rows, [["Screen Coordinate", false], ["Local Coordinate", true], ["World Coordinate", false]]);
  assert.strictEqual(o.thick, 3, "3 mm off the skin"); assert.strictEqual(o.selfMin, 2.5);
  assert.strictEqual(o.remeshed, true, "meshed again along the fold line");
  assert.deepStrictEqual(o.kept, [true, 0], "the corner of the cloth hangs where it did");
  assert.strictEqual(o.off, "Activate");
  assert.strictEqual(o.pinch, false);
});

/* ---------- 9: the Pleat tool ---------- */
test("r15 / 9: the Pleat tool: its box opens when it is picked; a click on an outline segment lays the pleat lines square to it, the next click picks the side; Number, Interval, a tapered Depth, Create Notch, the fold angles on the fold lines; an accordion lets nothing in; one undo step; Esc gives a pick up", () => {
  const o = boot({ blank: true, script: `
    const out = {}, at = (x, y) => app.toS({ x, y }), click = (x, y) => { const q = at(x, y); app.click(q.x, q.y); };
    const panel = (x) => { const p = app.mkPiece("P" + x, app.mkShape([{ x, y: 0 }, { x: x + 400, y: 0 }, { x: x + 400, y: 200 }, { x, y: 200 }], true)); S.pieces.push(p); app.commit(); return p; };
    const A = panel(0), B = panel(600), C = panel(1200);
    const wid = (p) => { const xs = p.pts.map(q => q.x); return +(Math.max(...xs) - Math.min(...xs)).toFixed(3); };
    let seen = null;
    app.answer = (t, f, opts) => { seen = [t, f.find(x => x.k === "type").radios, opts.checks.map(c => c.k), opts.sync({ angles: "360-0" }, "angles")]; return { type: "knife", n: 3, d0: 10, d1: 20, i0: 50, i1: 50, notch: "start", angles: "0-360", out: 0, inn: 360, rev: false, rev2: false }; };
    app.setTool("pleats"); out.box = seen;
    // on A's top edge at x 100; the side: to the right
    click(100, 0); out.picked = S.pleatPick && [Math.round(S.pleatPick.a.x), Math.round(S.pleatPick.a.y), Math.round(S.pleatPick.b.x), Math.round(S.pleatPick.b.y)];
    click(160, 100);
    out.A = [wid(A), A.internals.filter(x => x.fold).map(x => [x.fold, x.foldAngle === undefined ? 180 : x.foldAngle]), A.segs.map(s => s.notches.length).reduce((s, n) => s + n, 0)];
    out.steps = app.histSteps().steps.map(s => s.n);
    // an accordion on B: nothing let in, its folds Depth apart, outside and inside by turns
    app.answer = () => ({ type: "accordion", n: 2, d0: 15, d1: 15, i0: 10, i1: 10, notch: "both", angles: "0-360", out: 0, inn: 360, rev2: true });
    app.key("Enter"); click(700, 0); click(650, 100);
    out.B = [wid(B), B.internals.map(x => [Math.round(x.pts[0].x), x.fold, x.foldAngle === undefined ? 180 : x.foldAngle]), B.segs.map(s => s.notches.length).reduce((s, n) => s + n, 0)];
    // Esc gives a pick up
    click(1300, 0); out.esc = [!!S.pleatPick]; app.key("Escape"); out.esc.push(!!S.pleatPick, wid(C));
    app.undo(); const B2 = S.pieces.find(p => p.name === "P600"); out.undone = wid(B2) === 400 && B2.internals.length === 0;      // (undo puts back copies of the patterns)
    return out;
  ` }).result;
  assert.deepStrictEqual(o.box, ["Pleats", true, ["rev", "rev2"], { out: 360, inn: 0 }], "the box, its type as radio buttons, both Reverse Directions; 360 - 0 swaps the angles");
  assert.deepStrictEqual(o.picked, [100, 0, 100, 200], "square to the top edge, across the pattern");
  assert.ok(o.A[0] > 460 && o.A[0] <= 520 + 1e-6, "tapered: between three knife pleats of 2 × 10 at the start and of 2 × 20 at the end let in: " + o.A[0]);
  assert.deepStrictEqual(o.A[1].sort(), [["mountain", 0], ["mountain", 0], ["mountain", 0], ["valley", 360], ["valley", 360], ["valley", 360]], "outside folds at 0, inside at 360");
  assert.strictEqual(o.A[2], 3, "Create Notch Start: one notch a pleat, at the top only");
  assert.deepStrictEqual(o.steps, ["Pleats"]);
  assert.strictEqual(o.B[0], 400, "an accordion lets nothing in");
  assert.deepStrictEqual(o.B[1], [[700, "mountain", 360], [685, "valley", 0], [670, "mountain", 360], [655, "valley", 0]], "towards the left, 15 apart, the angles swapped by Reverse Direction");
  assert.strictEqual(o.B[2], 8, "notches at both ends");
  assert.deepStrictEqual(o.esc, [true, false, 400]);
  assert.strictEqual(o.undone, true);
});

/* ---------- 10: menus and the workspace ---------- */
test("r15 / 10: the right-click menus the check videos showed (an internal line, the empty window, a locked pattern, a measurement, an annotation, a punch mark), ours under More ▸; Edit ▸ Context Menu ▸; a display list closes as the pointer leaves it; the library drops from its button; Export PDF's box; a 3D state opens with a double-click", () => {
  const o = boot({ script: DOC + `
    const rows = (x, y, tool) => { if (tool) app.setTool(tool); app.menu.children.length = 0; const s = at(x, y); app.showMenu({ clientX: s.x, clientY: s.y });
      return app.menu.children.map(c => c.className === "msep" || /sep/.test(c.className || "") ? "|" : c.innerHTML.replace(/<span class="k">.*$/, "").replace(/<[^>]+>/g, "").trim()).filter(t => t !== ""); };
    const L = app.mkShape([{x:100,y:50},{x:100,y:350}], false); app.addChild(A, "internals", L); app.commit();
    out.internal = rows(100, 200, "edit_pattern");
    out.empty = rows(900, 800, "edit_pattern");
    A.lock = true; app.commit(); out.locked = rows(100, 100, "transform_pattern"); A.lock = false; app.commit();
    // a punch mark made a button mark
    A.punches = [{ x: 50, y: 300, d: 10, name: "P1" }]; app.commit(); app.setTool("punch_mark");
    out.punch = rows(50, 300); const ps = at(50, 300); app.menuClick(ps.x, ps.y, "Convert to Button Mark");
    out.button = [A.punches.length, S.buttons.length && [S.buttons[0].kind, S.buttons[0].x, S.buttons[0].y], app.histSteps().steps.slice(-1)[0].n];
    // Edit ▸ Context Menu ▸
    const ed = app.MENUS.edit(), cm = ed.find(r => r && r.n === "Context Menu");
    out.context = cm && cm.menu().map(r => r && r.n);
    out.g3 = cm && cm.menu().find(r => r.n === "3D Garment").menu().slice(0, 5).map(r => r && r.n);
    // the display list: the pointer leaving it for the canvas closes it at once
    app.showViewMenu && 0;
    const btn = { contains: () => false }; app.ev("(b) => { menuHover = b; }")(btn); app.menu.style.display = "block";
    app.ev("listLeave")({ relatedTarget: null }); out.closed = app.menu.style.display !== "block";
    // the library
    app.ev("libraryDialog")(); out.lib = [app.el("dlg").className, /class="dt"/.test(app.el("dlg").innerHTML)]; app.ev("hideDlg")();
    // Export PDF
    let F = null, O = null; app.answer = (t, f, opts) => { F = [t, f.map(x => [x.k, x.val])]; O = opts; return null; };
    app.ev("pdfExportDialog")(); out.pdf = [F, O.checks.map(c => [c.label, c.val])];
    const job = app.ev("pdfJob")({ scale: 50, rot: "none", ml: 100, mr: 100, mt: 100, mb: 100, lines: true, gfxLines: true, internal: true, basenotch: true, punch: true, images: true, info: false });
    out.job = [Math.round(job.plan.pw), Math.round(job.plan.ph), job.plan.scale, /data-layer="punch"/.test(job.html)];
    return out;
  ` }).result;
  assert.deepStrictEqual(o.internal.slice(0, 31), ["Select All", "|", "Delete", "Copy", "Paste", "Mirror Paste", "|", "Lock", "Invert Selection", "|", "Replaced by", "Change Length", "Link to Pattern Outline", "|",
    "Cut", "Cut & Sew", "|", "Offset as Internal Line", "Offset as Seamless Block Line", "|", "Extend/Trim", "Extend/Trim & Add Point", "|", "Convert to Baseline", "|", "Order", "Rotate", "Flip", "|", "Zoom to Selected", "|"].filter((t, k, a) => t !== "|" || a[k-1] !== "|"), JSON.stringify(o.internal));
  assert.strictEqual(o.internal[o.internal.length - 1], "More", "this program's own rows under More ▸");
  assert.deepStrictEqual(o.empty.filter(t => t !== "|").map(t => t.replace(/^✓ /, "")), ["Paste", "Mirror Paste", "Lock All Pattern Outlines", "Lock All Internal Lines", "Unlock All Baselines", "Lock All Guidelines", "Refresh Textures", "Delete All Baselines",      // (Round build-1: Lock All Internal Lines, Lock All Baselines (on from the start) and Lock All Guidelines are built): baselines start locked, so the row says Unlock
    "Delete All Overlapping Points", "Optimize All Curve Points", "Remove All Steam", "Smart Guide", "Snap to Pattern", "Snap to Grid", "Add Background Image", "Grid Properties", "Zoom Extents All", "More"].map(t => t), JSON.stringify(o.empty));
  assert.deepStrictEqual(o.locked.filter(t => t !== "|").slice(1), ["Unlock", "More"], JSON.stringify(o.locked));
  assert.deepStrictEqual(o.punch.filter(t => t !== "|").slice(1), ["Delete", "Duplicate to Symmetric Pattern", "Convert to Button Mark", "Convert to Buttonhole Mark", "More"]);
  assert.deepStrictEqual(o.button, [0, ["button", 50, 300], "Convert to Button Mark"]);
  assert.deepStrictEqual(o.context, ["3D Garment", "2D Pattern", "Sewing", "Materials", "Avatar", "Display (not built yet)"], "Display's rows were not read: not built (the switch is on in this boot)");
  assert.deepStrictEqual(o.g3.slice(1, 5), ["Deactivate (Pattern Only)", "Deactivate (Pattern & Sewing)", "Freeze", "Strengthen"]);
  assert.strictEqual(o.closed, true, "closed at once");
  assert.deepStrictEqual(o.lib, ["library drop", false], "a panel under its button, no title bar");
  assert.deepStrictEqual(o.pdf[0], ["Export PDF", [["scale", 100], ["rot", "none"], ["ml", 100], ["mr", 100], ["mt", 100], ["mb", 100]]]);
  assert.deepStrictEqual(o.pdf[1].map(c => c[0]), ["Show Lines", "Graphic Lines", "Internal Lines", "Baselines/Notches", "Punch Marks", "Show Images", "Show Add'l Information"]);
  assert.deepStrictEqual(o.pdf[1].map(c => c[1]), [true, true, true, true, true, true, false]);
  near(o.job[0], 450, 3, "half the patterns' 500 width and 200 of margins"); near(o.job[1], 400, 3, "half their 400 height and 200 of margins"); assert.deepStrictEqual(o.job.slice(2), [0.5, false], "(no punch mark is left: it became a button)");
});

test("r15 / 10: a 3D state's chip opens the Open Project box on a double-click; Open puts the garment back as the state had it, one undo step", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    app.ev("state3Add")(); const st = S.states3[0];
    A.p3 = { ...A.p3, pos: [200, 1100, 120] }; app.commit(); app.ev("garmentSync")();
    let seen = null; app.answer = (t, f, opts) => { seen = [t, f.map(x => [x.k, x.val, x.options.map(q => q[0])]), opts.checks.map(c => c.label.split(" (")[0])]; return { load: "open", garment: true }; };
    app.ev("state3Open")(st.id, 100, 600);
    out.seen = seen; out.back = A.p3.pos[0]; out.steps = app.histSteps().steps.map(s => s.n).slice(-1);
    return out;
  ` }).result;
  assert.strictEqual(o.seen[0], "Open Project");
  assert.deepStrictEqual(o.seen[1], [["load", "open", ["open", "add"]]], "Load Type Open / Add");
  assert.deepStrictEqual(o.seen[2], ["Content › Object: Garment", "Avatar, Scene and Props", "3D State", "Environment: Custom View", "Render Properties", "Display Settings"]);
  assert.strictEqual(o.back, 0, "the pattern where the state had it");
  assert.ok(/^Go Back to /.test(o.steps[0]), JSON.stringify(o.steps));
});

module.exports = T;
