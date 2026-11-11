// Round r33: the inventory's rows that were built but not wired, pleats as the maintainer explained them, the grading tool,
// the layout and controls, the tools, the simulation's quality and the drag.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-r33-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}
// two rectangles, A at x 0…200 and B at x 300…500, both 400 high
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
  const B = app.mkPiece("B", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:400},{x:300,y:400}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const at = (x, y) => app.toS({ x, y }), out = {};
  const click = (x, y, o) => { const s = { ...at(x, y), ...(o || {}) }; app.fire("pointermove", s); app.fire("pointerdown", s); app.fire("pointerup", s); };
  const steps = () => app.histSteps().steps.map(s => s.n);
  const sub = (items, n) => items.filter(Boolean).find(x => x.n === n).menu().filter(Boolean);
`;

/* ---------- batch 2: the rows of Edit ▸ Context Menu ▸ that were built but said "not built yet" ---------- */
test("r33 / 2: Edit ▸ Context Menu ▸ reaches Solidify, Extend/Trim & Add Point, Clone, Trace, Grading, Reset 3D Position, Hide Avatar, Reset Joints and Display", () => {
  const o = boot({ three: true, script: DOC + `
    S.ui.unbuilt = true;
    const cm = app.MENUS.edit().find(r => r && r.n === "Context Menu").menu().filter(Boolean);
    const nbs = (rows) => rows.filter(r => r && r.nb).map(r => r.n.replace(/ [(]not built yet[)]$/, ""));
    const g3 = sub(cm, "3D Garment"), p2 = sub(cm, "2D Pattern"), mat = sub(cm, "Materials"), av = sub(cm, "Avatar");
    out.nb = { g3: nbs(g3), p2: nbs(p2), mat: nbs(mat), av: nbs(av), top: nbs(cm) };
    // Solidify toggles the selected pattern's state, one step
    S.sel = [A.id]; g3.find(r => r.n === "Solidify").f(); out.solid = [!!A.solid3, steps().slice(-1)[0]];
    // Extend/Trim & Add Point says where it is, as its neighbours do
    const et = p2.find(r => r.n === "Extend/Trim & Add Point"); out.et = [!!et.off, et.note];
    // Clone ▸ Clone as Internal Shape on the selected pattern
    const cl = p2.find(r => r.n === "Clone").menu().filter(Boolean); out.clone = cl.map(r => r.n);
    const n0 = A.internals.length; cl.find(r => r.n === "Clone as Reference Line").f(); out.ref = A.bases.filter(b => b.ref).length;
    // Trace puts the Trace tool in hand
    p2.find(r => r.n === "Trace").f(); out.tool = S.tool;
    // Grading ▸ Proportional Grading…
    out.grading = p2.find(r => r.n === "Grading").menu().filter(Boolean).map(r => r.n);
    out.reset3 = mat.some(r => r.n === "Reset 3D Position" && !r.nb && typeof r.f === "function");
    out.avRows = av.filter(r => !r.nb).map(r => r.n);
    out.display = Array.isArray(cm.find(r => r.n === "Display").menu());
    return out;
  ` }).result;
  for (const n of ["Solidify"]) assert.ok(!o.nb.g3.includes(n), n + " is wired");
  for (const n of ["Extend/Trim & Add Point", "Clone", "Trace", "Grading"]) assert.ok(!o.nb.p2.includes(n), n + " is wired: " + o.nb.p2);
  assert.ok(!o.nb.mat.includes("Reset 3D Position") && o.reset3, "Reset 3D Position is wired");
  for (const n of ["Hide Avatar", "Reset Joints"]) assert.ok(!o.nb.av.includes(n), n + " is wired");
  assert.ok(!o.nb.top.includes("Display") && o.display, "Display is a submenu");
  assert.deepStrictEqual(o.solid, [true, "Solidify"]);
  // (Round BETA8-1 / 0, the beta.8 gate G10: with a line selected the row is that line's own; with nothing selected it says what to select)
  assert.deepStrictEqual(o.et, [true, "select a line"]);
  assert.deepStrictEqual(o.clone, ["Clone with Linked Editing", "Layer Clone", "Clone as Internal Shape", "Clone as Reference Line"]);
  assert.strictEqual(o.ref, 1);
  assert.strictEqual(o.tool, "trace");
  assert.ok(o.grading[0] === "Proportional Grading…", JSON.stringify(o.grading));
  assert.ok(o.avRows.includes("Show Avatar") || o.avRows.includes("Hide Avatar"), JSON.stringify(o.avRows));
  assert.ok(o.avRows.includes("Reset Joints"), JSON.stringify(o.avRows));
});

/* ---------- batch 3: pleats as the maintainer explained them ---------- */
test("r33 / 3: Pleats: two points on the outline (caught at the middle of a line), the side, then the box; its preview follows the values and takes nothing from the document; Number has a stepper; Cancel leaves the pattern; an internal line is a pleat line too", () => {
  const o = boot({ blank: true, script: `
    const out = {}, at = (x, y) => app.toS({ x, y }), click = (x, y) => { const q = at(x, y); app.click(q.x, q.y); };
    const panel = (x) => { const p = app.mkPiece("P" + x, app.mkShape([{ x, y: 0 }, { x: x + 400, y: 0 }, { x: x + 400, y: 200 }, { x, y: 200 }], true)); S.pieces.push(p); app.commit(); return p; };
    const A = panel(0), B = panel(600);
    const wid = (p) => { const xs = p.pts.map(q => q.x); return +(Math.max(...xs) - Math.min(...xs)).toFixed(3); };
    // a seam on A's top edge, which the pleat line splits: the preview must not change it
    S.seams.push({ id: 1, a: [{ piece: A.id, shape: 0, sids: [A.segs[0].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[0].id], t0: 0, t1: 1, rev: true }] }); app.commit();
    S.undo.length = 0;
    let seen = null;
    app.setTool("pleats");
    // the first point: near the middle of the top edge (it catches the middle, x 200); the second: the bottom left corner's
    // neighbour, the middle of the bottom edge (x 200)
    click(203, 0); out.step1 = S.pleatPick && S.pleatPick.step;
    click(198, 200); out.line = S.pleatPick && [S.pleatPick.step, Math.round(S.pleatPick.a.x), Math.round(S.pleatPick.b.x)];
    app.ev("draw")();
    // the side, then the box: answered as Cancel, after trying its preview with 1 and 4 knife pleats
    const before = JSON.stringify(S.seams), ids = [S.nextSegId, S.nextShapeId];
    app.answer = (t, f, opts) => {
      const base = { type: "knife", n: 1, d0: 10, d1: 10, i0: 30, i1: 30, notch: "both", angles: "0-360", out: 0, inn: 360, rev: false, rev2: false };
      const one = opts.preview(base), four = opts.preview({ ...base, n: 4 });
      seen = { title: t, spin: f.find(x => x.k === "n").spin === true, one: one && wid(one[0]), four: four && wid(four[0]), bad: opts.check({ ...base, n: 0 }) };
      return null;
    };
    click(260, 100);
    out.seen = seen; out.after = [JSON.stringify(S.seams) === before, S.nextSegId === ids[0] && S.nextShapeId === ids[1], wid(A), A.internals.length, app.histSteps().steps.length, S.pleatPick];
    // again, OK: three box pleats, one step
    app.answer = () => ({ type: "box", n: 3, d0: 5, d1: 5, i0: 40, i1: 40, notch: "none", angles: "0-360", out: 0, inn: 360, rev: false, rev2: false });
    click(203, 0); click(198, 200); click(260, 100);
    out.made = [wid(A), app.histSteps().steps.map(s => s.n)];
    // an internal line on B is the pleat line: one click on it, then the side
    const L = app.mkShape([{ x: 800, y: 0 }, { x: 800, y: 200 }], false); app.addChild(B, "internals", L); app.commit();
    app.answer = () => ({ type: "knife", n: 1, d0: 10, d1: 10, i0: 10, i1: 10, notch: "both", angles: "0-360", out: 0, inn: 360, rev: false, rev2: false });
    click(800, 120); out.lineStep = S.pleatPick && S.pleatPick.step; click(760, 100);
    out.B = [wid(B), B.internals.filter(x => x.fold).length];
    // a click inside a pattern (not on its outline) starts nothing
    click(1000, 100); out.inside = S.pleatPick;
    return out;
  ` }).result;
  assert.strictEqual(o.step1, "b", "the first point waits for the second");
  assert.deepStrictEqual(o.line, ["side", 200, 200], "both points caught at the lines' middles; then the side");
  assert.strictEqual(o.seen.title, "Pleats");
  assert.strictEqual(o.seen.spin, true, "Number of Pleats has a stepper");
  assert.strictEqual(o.seen.one, 420, "the preview: one knife pleat lets in 2 × 10");
  assert.strictEqual(o.seen.four, 480, "and follows the number: four let in 80");
  assert.ok(o.seen.bad, "a number below 1 is refused in the box");
  assert.deepStrictEqual(o.after, [true, true, 400, 0, 0, null], "the preview changed no seam and took no ids; Cancel left the pattern, no step, the pick given up");
  assert.deepStrictEqual(o.made, [460, ["Pleats"]], "three box pleats of 4 × 5, one step");
  assert.strictEqual(o.lineStep, "side");
  assert.deepStrictEqual(o.B, [420, 2], "the internal line became a knife pleat: 20 let in, two fold lines");
  assert.strictEqual(o.inside, null);
});

/* ---------- batch 4: grading ---------- */
test("r33 / 4: grading starts with no size group; Edit Grading moves selected points in every size, each one step further from the base; (Each) only the size picked; a locked size stays; the table's Distance, Offset and All; Edit Curve Grading on curve points", () => {
  const o = boot({ blank: true, script: DOC + `
    const G = S.grading;
    out.start = [G.groups.length, /[+] Size Group/.test(app.ev("gradingPanel")(null)), /XS/.test(app.ev("gradingPanel")(null))];
    out.review = app.ev("gradingReview")();      // nothing to review without a size group, and no error
    // nothing can be graded yet: the tool says so
    app.setTool("edit_grading"); click(200, 0); app.key("ArrowRight"); out.noGroup = [G.groups.length, !A.grade || !Object.keys(A.grade.pts).length];
    // a group XS, S, M (base), L, XL; A assigned to it
    const g = app.ev("addSizeGroup")(G, "Run"); g.sizes[0].name = "M";
    const ins = app.ev("insertSize"), XS = ins(G, S.pieces, g.id, g.base, "XS"), Sz = ins(G, S.pieces, g.id, g.base, "S"), L = ins(G, S.pieces, g.id, null, "L"), XL = ins(G, S.pieces, g.id, null, "XL");
    app.ev("ensureGrade")(G, A).group = g.id; app.commit(); S.undo.length = 0;
    out.order = g.sizes.map(z => z.name);
    const d = (id, i) => { const v = app.ev("ptDelta")(G, A, A, i == null ? 1 : i, id); return [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100]; };
    // A's top right corner (200, 0), then the arrow
    click(200, 0); out.sel = S.gradeSel.length;
    app.key("ArrowRight");
    out.right = [d(XS.id), d(Sz.id), d(L.id), d(XL.id), steps().slice(-1)[0]];
    // (Each): L only, up by one step
    app.setTool("edit_grading_each"); out.kept = S.gradeSel.length; G.active = L.id; app.key("ArrowUp");
    out.each = [d(XS.id), d(Sz.id), d(L.id), d(XL.id), steps().slice(-1)[0]];
    // a locked size is left as it is
    XL.lock = true; app.setTool("edit_grading"); app.key("ArrowRight"); out.locked = [d(L.id), d(XL.id)];
    // the table: L's Offset X typed as 15 (it was 20), All Y as 4 (up)
    app.ev("gradeTableSet")("o", L.id, "x", 15); out.offset = [d(L.id), d(XL.id)];
    XL.lock = false; app.ev("gradeTableSet")("all", 0, "y", 4); out.all = [d(XS.id), d(Sz.id), d(L.id), d(XL.id)];
    out.table = /Distance X/.test(app.ev("gradeTablePanel")()) && /All/.test(app.ev("gradeTablePanel")());
    // the size L drawn: its top right corner where the offsets say
    const q = app.ev("gradedPiece")(G, A, L.id); out.graded = [Math.round(q.pts[1].x), Math.round(q.pts[1].y)];
    // Edit Curve Grading: a curve point on A's left side; down by one step in every size
    A.segs[3].curved = true; A.segs[3].cps = [{ x: -30, y: 200 }]; app.commit();
    app.setTool("edit_curve_grading"); out.ptCleared = S.gradeSel.length; click(-30, 200); out.cpSel = S.gradeSel.length && S.gradeSel[0].k;
    app.key("ArrowDown");
    const cpd = (id) => { const v = app.ev("cpDelta")(G, A, A, 3, 0, id); return Math.round(v.y * 100) / 100; };
    out.cp = [cpd(XS.id), cpd(L.id), cpd(XL.id)];
    const qx = app.ev("gradedPiece")(G, A, XL.id); out.cpDrawn = Math.round(qx.segs[3].cps[0].y - 200);
    // undo takes the last press back
    // (undo puts back copies of the patterns and the grading)
    app.undo(); { const A2 = S.pieces.find(p => p.name === "A"); out.undone = Math.round(app.ev("cpDelta")(S.grading, A2, A2, 3, 0, XL.id).y * 100) / 100; }
    return out;
  ` }).result;
  assert.deepStrictEqual(o.start, [0, true, false], "no size group at start; the panel offers + Size Group");
  assert.strictEqual(o.review, 0, "Grading Review with no size group opens nothing");
  assert.deepStrictEqual(o.noGroup, [0, true], "nothing graded, no group made behind the user's back");
  assert.deepStrictEqual(o.order, ["XS", "S", "M", "L", "XL"]);
  assert.strictEqual(o.sel, 1);
  assert.deepStrictEqual(o.right, [[-20, 0], [-10, 0], [10, 0], [20, 0], "Edit Grading"], "one step of 10 mm a size, the smaller sizes the other way");
  assert.strictEqual(o.kept, 1, "the selection stays from one grading tool to another");
  assert.deepStrictEqual(o.each, [[-20, 0], [-10, 0], [10, -10], [20, 0], "Edit Grading (Each)"], "only the size picked, up (y down is negative)");
  assert.deepStrictEqual(o.locked, [[20, -10], [20, 0]], "XL locked: left as it was");
  assert.deepStrictEqual(o.offset, [[15, -10], [20, 0]], "L's offset from M set to 15; XL (locked) stays");
  assert.deepStrictEqual(o.all, [[-40, 8], [-20, 4], [15, -4], [20, -8]], "All Y = 4 up: each size 4 more than the one before it, the smaller ones down");
  assert.strictEqual(o.table, true);
  assert.deepStrictEqual(o.graded, [215, -4], "L drawn at its offsets");
  assert.strictEqual(o.ptCleared, 1, "the selection is kept from Edit Grading to Edit Curve Grading too");
  assert.strictEqual(o.cpSel, 0, "the curve point picked");
  // (Round FIX-2 / C6, the maintainer's brief: a corner's grade never moves the whole pattern. Until then one grade point moved the
  // whole outline, so the curve point started at the corner's offsets (XS 8, L -4, XL -8) and ended at -12, 6, 12; now every corner is a
  // grade point once a tool grades the shape, the left side stays, and the curve point starts at 0)
  assert.deepStrictEqual(o.cp, [-20, 10, 20], "the curve point down a step a size from the base");
  assert.strictEqual(o.cpDrawn, 20, "XL draws its curve point where the offsets say");      // (Round FIX-2 / C6: 12 before, as above)
  assert.strictEqual(o.undone, 0, "undo takes the press back");      // (Round FIX-2 / C6: back to where it started, 0; -8 before, as above)
});

/* ---------- batch 5: layout and controls ---------- */
test("r33 / 5: Scene is the first tab and the program opens on Patterns; the bottom bar is 46 px with pictured layout buttons; the arrangement commands are separate buttons and Show Arrangement Points only a display switch; the empty 2D window's menu switches the rulers", () => {
  const REG = (() => { const vm = require("vm"), c = {}; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "drafter-tools.js"), "utf8"), c); return vm.runInContext("TOOL_REGISTRY", c); })();
  const grp = (id) => (REG.tools.find(t => t.id === id) || {}).group;
  assert.strictEqual(REG.tools.some(t => t.id === "arr_points"), false, "Show Arrangement Points is no toolbar button");
  const g = ["fold_arrangement", "reset_2d_arrangement", "reset_3d_arrangement"].map(grp);
  assert.strictEqual(new Set(g).size, 3, "each its own button: " + g);
  for (const k of g) assert.deepStrictEqual(REG.tools.filter(t => t.group === k && t.status !== "later").length, 1, "nothing else shares " + k);
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8");
  assert.ok(/grid-template-rows: 24px 1fr auto 46px;/.test(html), "the bottom bar is 46 px (it was 22)");
  assert.ok(/<button id="s-lay-3d"[^>]*><svg/.test(html) && /<button id="s-lay-2d"[^>]*><svg/.test(html), "the layout buttons have pictures");
  const o = boot({ three: true, script: DOC + `
    out.tabs = app.OB_TABS.slice(0, 2).map(t => t[0]); out.open = app.ev("obState")().tab;
    out.avatar = app.ev("avatarItems")().filter(r => r && r.n).map(r => r.n).slice(0, 3);
    const s = at(900, 800); app.menu.children.length = 0; app.showMenu({ clientX: s.x, clientY: s.y });
    const rows = app.menu.children.map(c => c.innerHTML.replace(/<[^>]+>/g, "").trim());
    out.ruler = rows.some(t => /Show Ruler/.test(t)); const was = !!S.show.ruler;
    app.menu.children.find(c => /Show Ruler/.test(c.innerHTML)).onclick({ stopPropagation() {} }); out.toggled = [was, !!S.show.ruler];
    return out;
  ` }).result;
  assert.deepStrictEqual(o.tabs, ["scene", "patterns"]);
  assert.strictEqual(o.open, "patterns", "the program still opens on Patterns");
  assert.deepStrictEqual(o.avatar, ["Show Avatar", "Show Arrangement Points", "Show Bounding Volumes"], "the Avatar list has it");
  assert.strictEqual(o.ruler, true);
  assert.strictEqual(o.toggled[0], !o.toggled[1], "Show Ruler switches the rulers");
});

/* ---------- batch 6: tools ---------- */
test("r33 / 6: Trace in Line mode offers Cut, Cut & Sew and Convert to Hole on an internal line or shape; the background image edited: a drag moves it, a corner scales it (Shift keeps proportions), the Property Editor has its opacity and size, Esc or a click outside ends it and nothing drags it then; Seamless Blocking has a toolbar slot of its own", () => {
  const REG = (() => { const vm = require("vm"), c = {}; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "drafter-tools.js"), "utf8"), c); return vm.runInContext("TOOL_REGISTRY", c); })();
  const sb = REG.tools.find(t => t.id === "seamless_blocking");
  assert.ok(sb.group !== "internal" && REG.tools.filter(t => t.group === sb.group).length === 1, "Seamless Blocking alone in its slot");
  const o = boot({ script: DOC + `
    const rows = (x, y) => { app.menu.children.length = 0; const s = at(x, y); app.showMenu({ clientX: s.x, clientY: s.y }); return app.menu.children.map(c => c.innerHTML.replace(/<span class="k">.*$/, "").replace(/<[^>]+>/g, "").trim()).filter(Boolean); };
    // a closed internal shape traced from internal lines, and an open line, on A
    app.addChild(A, "internals", app.mkShape([{x:40,y:40},{x:120,y:40},{x:120,y:120},{x:40,y:120}], true));
    app.addChild(A, "internals", app.mkShape([{x:20,y:300},{x:180,y:300}], false)); app.commit();
    app.setTool("trace"); S.traceMode = "line";
    out.shape = rows(80, 40); out.line = rows(100, 300);
    // the background image
    const im = app.ev("addImage")("bg.png", "data:image/png;base64,iVBORw0KGgo=", 200, 100);
    S.backdrop = { img: im.id, x: 600, y: 0, w: 200, h: 100, opacity: 0.5, lock: false, hide: false }; app.commit(); S.undo.length = 0;
    app.setTool("transform_pattern");
    const up = (x, y) => { const s = at(x, y); app.fire("pointerup", s); };
    const drag = (x0, y0, x1, y1, e) => { const a = at(x0, y0), b = at(x1, y1); app.drag(a.x, a.y, b.x, b.y, e); up(x1, y1); };
    app.ev("backdropStart")("edit"); out.mode = S.bgMode && S.bgMode.k;
    out.panel = /Opacity/.test(app.el("props").innerHTML) && /Width/.test(app.el("props").innerHTML);
    drag(700, 50, 720, 70); out.moved = [Math.round(S.backdrop.x), Math.round(S.backdrop.y), steps().slice(-1)[0], S.bgMode && S.bgMode.k];
    // the bottom right corner (820, 120), out to (920, 140) with Shift: the proportions kept (2 : 1)
    drag(820, 120, 920, 140); out.scaled =      // (Round UI-1d / B: a corner keeps the proportions by itself now; Shift lets them go)
      [Math.round(S.backdrop.x), Math.round(S.backdrop.y), Math.round(S.backdrop.w), Math.round(S.backdrop.h), steps().slice(-1)[0]];
    // a click outside ends editing; a drag on the image then does not move it
    click(1500, 900); out.ended = S.bgMode;
    const n = steps().length; drag(700, 60, 760, 80); out.after = [Math.round(S.backdrop.x), Math.round(S.backdrop.y), steps().length === n];
    // Esc ends it too
    app.ev("backdropStart")("edit"); app.key("Escape"); out.esc = S.bgMode;
    out.menu = rows(1500, 900).some(t => /Edit Background Image/.test(t));
    return out;
  ` }).result;
  for (const r of ["Cut", "Cut & Sew", "Convert to Hole"]) assert.ok(o.shape.includes(r), "a closed shape: " + r + " in " + o.shape);
  assert.ok(o.line.includes("Cut") && o.line.includes("Cut & Sew"), "an open line: " + o.line);
  assert.strictEqual(o.mode, "edit"); assert.strictEqual(o.panel, true);
  assert.deepStrictEqual(o.moved, [620, 20, "Move Background Image", "edit"], "moved by the drag, one step, still editing");
  assert.deepStrictEqual(o.scaled, [620, 20, 300, 150, "Scale Background Image"], "the top left corner stays; the proportions kept, 2 : 1 (Round UI-1d / B: without Shift)");
  assert.strictEqual(o.ended, null);
  assert.deepStrictEqual(o.after, [620, 20, true], "not dragged once editing ended");
  assert.strictEqual(o.esc, null);
  assert.strictEqual(o.menu, true, "the empty window's menu offers Edit Background Image");
});

/* ---------- batch 7: simulation quality ---------- */
test("r33 / 7: Simulation Quality: High Accuracy asks first, then halves the particle distance and doubles the steps a frame; in a browser never under 10 mm; Normal puts them back; a preference that is kept, with Arrow Key Movement", () => {
  const run = (desktop) => boot({ three: true, desktop, script: DOC + `
    const o = {}, res = () => app.ev("particleOf")(A), subs = () => app.ev("simSubsteps")();
    o.before = [res(), subs(), app.ev("clothRes")()];
    app.modalAnswer = () => "cancel"; app.ev("setSimQuality")("high"); o.cancelled = [res(), S.prefs.simQuality];
    app.modalAnswer = () => "ok"; app.ev("setSimQuality")("high"); o.high = [res(), subs(), S.prefs.simQuality, (app.ev("menu3D")().find(r => r && r.n === "Simulation Quality") || { menu: () => [] }).menu().map(r => r.n + (r.on ? " *" : ""))];
    A.res3 = 8; o.ownRes = res(); delete A.res3;
    app.ev("setSimQuality")("normal"); o.normal = [res(), subs(), S.prefs.simQuality];
    app.ev("setPrefs")({ gradeStep: 2.5 }); o.kept = app.ev("normPrefs")(JSON.parse(JSON.stringify(S.prefs))).gradeStep;
    return o;
  ` }).result;
  const web = run(false), desk = run(true);
  assert.deepStrictEqual(web.before, [20, 20, 20]);
  assert.deepStrictEqual(web.cancelled, [20, "normal"], "Cancel changes nothing");
  assert.deepStrictEqual(web.high.slice(0, 3), [10, 40, "high"], "half the distance, twice the steps");
  assert.deepStrictEqual(web.high[3], ["Normal", "High Accuracy (slower) *"], "3D ▸ Simulation Quality shows which");
  assert.strictEqual(web.ownRes, 10, "a pattern's own 8 mm halved is 4, but a browser stops at 10");
  assert.strictEqual(desk.ownRes, 5, "the desktop app: 8 halved, never under 5");
  assert.deepStrictEqual(web.normal, [20, 20, "normal"]);
  assert.strictEqual(web.kept, 2.5, "Arrow Key Movement is kept with the preferences");
});

module.exports = T;
