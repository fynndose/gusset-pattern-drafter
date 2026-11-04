// Round G1 / 3: the right-click menus. Each context has its own menu, from the reference files only: an outline line (W56), two or more lines (the screenshot line_selection_data_field), a point and a curve
// point (W57), a pattern (W1, also with Transform Pattern on its line), a sewing line (W75), the 3D window's pattern (W18) and
// background (W17). What the references name and this program has not built is greyed and says so in words; this program's
// own commands that nothing else reaches are under More. A menu is placed to stay whole on the screen (fitMenu()); the
// browser's own menu never opens but in a text field.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-boot-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify({ blank: true, ...opt }));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 30000, maxBuffer: 1 << 28 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after " + (ms || 30000)/1000 + " s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
// two rectangles, A with a curve-point curve on its right side, B beside it; a seam between them; the menu's rows as words
const DOC = `
  const out = {};
  S.view = { s: 1, x: 100, y: 100 };
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("A", 0, 0, 300, 200), sq("B", 400, 0, 300, 200));
  Object.assign(S.pieces[0].segs[1], { curved: true, cps: [{ x: 320, y: 100 }] });
  const part = (p, i) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: false });
  S.seams.push({ id: 1, a: [part(S.pieces[0], 3)], b: [part(S.pieces[1], 1)] });
  app.commit(); S.undo.length = 0;
  const at = (x, y) => app.toS({ x, y });
  // (Round r20 / 10: a long menu has a search field at its top, not a row: left out here)
  const words = (el) => el.children.filter(c => c.className !== "msearch").map(c => c.className === "sep" ? "—" : c.className === "hd" ? "# " + (c.textContent || c.innerHTML) : c.innerHTML.replace(/<span class="k">(.*?)<.span>/, (m, k) => k ? " [" + k + "]" : "").replace(/<[^>]*>/g, ""));
  const rows = (x, y, tool) => { const s = at(x, y), was = S.tool; if (tool) app.setTool(tool); app.menu.children.length = 0; app.showMenu({ clientX: s.x, clientY: s.y }); if (tool) app.setTool(was); return words(app.menu); };
  const sub = (name) => { app.menu.children.find(c => c.innerHTML.includes("<span>" + name + "</span>")).onclick({ stopPropagation() {} }); const subs = app.ev("menuSubs"); return words(subs[subs.length - 1]); };
`;

test("G1 one outline line (W56), two lines (the screenshot), a point and a curve point (W57): each its own menu, in the references' order; what is not built is greyed and says so", () => {
  const r = boot({ script: DOC + `
    app.setTool("edit_pattern");
    out.one = rows(150, 0); out.oneMore = sub("More");
    // two lines: the top of A, Shift+click the top of B
    S.sel = [S.pieces[0].id]; app.ev("setLines")([{ p: S.pieces[0], sh: S.pieces[0], i: 0, kind: "outline" }, { p: S.pieces[1], sh: S.pieces[1], i: 0, kind: "outline" }]);
    out.two = rows(550, 0);
    out.point = rows(0, 200); out.pointMore = sub("More");
    out.cp = rows(320, 100);
    out.curveLine = rows(310, 30);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, NB = " [not built yet]";
  assert.deepStrictEqual(o.one, ["Delete Line [Delete]", "—", "Copy [Ctrl+C]", "Paste [Ctrl+V]", "Mirror Paste [Ctrl+R]", "—", "Delete All Curve Points", "Lock", "—", "Split", "Change Length", "Add Perpendicular Internal Line [▸]",
    "Offset as Internal Line", "Offset as Seamless Block Line" + NB, "Offset Pattern Outline", "Optimize Curve Points [no curve points to spare]", "—",      /* (Round build-1: built; greyed on a straight line, saying why) */ "Merge [select two lines]", "—", "Unfold", "Unfold Pattern Outline Only", "Unfold Symmetric Editing (with Sewing)",
    "Duplicate as Mirrored Internal Line", "Add Guideline along Points", "—", "Roll Up", "—", "Trace as Point of Measure", "Link Lines [U]", "—", "More [▸]"], "W56");
  assert.deepStrictEqual(o.oneMore, ["Distribute Internal Lines between Segments…", "Fullness (Line)…", "Pleats…"], "this program's own, nowhere else");
  assert.deepStrictEqual(o.two, ["Delete Line [Delete]", "—", "Copy [Ctrl+C]", "Paste [Ctrl+V]", "Mirror Paste [Ctrl+R]", "—", "Lock", "—", "Split", "Change Length", "Offset as Internal Line", "Offset as Seamless Block Line" + NB, "Offset Pattern Outline", "—",
    "Merge", "Unfold", "Unfold Pattern Outline Only", "Unfold Symmetric Editing (with Sewing)", "Duplicate as Mirrored Internal Line", "Add Guideline along Points", "—", "Align [▸]", "Match Up [▸]", "Roll Up", "—",
    "Trace as Point of Measure", "Link Lines [U]", "—", "More [▸]"], "the screenshot line_selection_data_field");
  assert.ok(o.two.length < 32 && !o.two.some(t => /Symmetric Pattern|Order|Notch|Seam S/.test(t)), "no pattern's or seam's commands on a line's menu");
  assert.deepStrictEqual(o.point, ["Delete Point [Delete]", "Lock", "Add Notch", "Add Dart", "Add Dart with Fullness" + NB, "Add Perpendicular Internal Line [▸]", "—", "Convert to Curve Point [▸]", "Perpendicular Pattern Corner" + NB, "—", "More [▸]"], "W57 (Add Dart built in Round F / 7)");
  assert.deepStrictEqual(o.pointMore, ["Smooth Curve", "Seam Allowance Corner [▸]", "Segment Length…", "Moving Distance…", "Grading [▸]", "Add Guideline along Points", "Fullness (Point)…"]);
  assert.deepStrictEqual(o.cp, ["Delete Point [Delete]", "Add Notch", "Delete All Curve Points", "Convert to Segment Point [▸]", "Split Curve…", "—", "More [▸]"], "W57's curve point, and Split Curve (the maintainer's checks, E2)");
  assert.ok(o.curveLine.includes("Delete All Curve Points") && o.curveLine.includes("More [▸]"));
});

test("G1 a pattern's menu is W1: inside a pattern with Edit Pattern, anywhere on it with Transform Pattern, for several selected patterns; its submenus; Flip and the rows' history names", () => {
  const r = boot({ script: DOC + `
    app.setTool("edit_pattern");
    out.body = rows(150, 100);
    out.onLine = rows(150, 0, "transform_pattern");
    S.sel = S.pieces.map(p => p.id); out.many = rows(550, 100, "transform_pattern");
    for (const n of ["Select All", "Clone with Linked Editing", "Apply Linked Editing", "Layer Clone", "3D Pattern", "Order", "Rotate", "Flip"]) { rows(150, 100, "transform_pattern"); out[n] = sub(n); }
    rows(150, 100, "transform_pattern"); out.more = sub("More");
    // Flip ▸ Horizontally on both: as one group about the box round both; (Each): each about its own box
    S.sel = S.pieces.map(p => p.id); app.menuClick(at(150, 100).x, at(150, 100).y, "Flip ▸ Horizontally", "transform_pattern");
    out.flip = S.pieces.map(p => Math.min(...p.pts.map(q => q.x))); out.flipStep = app.histSteps().steps.slice(-1)[0].n; app.undo();
    S.sel = S.pieces.map(p => p.id); app.menuClick(at(150, 100).x, at(150, 100).y, "Flip ▸ Horizontally (Each)", "transform_pattern");
    out.each = S.pieces.map(p => Math.round(Math.min(...p.pts.map(q => q.x)))); app.undo();
    S.sel = [S.pieces[0].id]; app.menuClick(at(150, 100).x, at(150, 100).y, "Layer Clone ▸ Under", "transform_pattern"); app.click(at(170, 120).x, at(170, 120).y);
    out.cloneStep = app.histSteps().steps.slice(-1)[0].n;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, NB = " [not built yet]";
  const W1 = ["Select All [▸]", "—", "Delete [Delete]", "Copy [Ctrl+C]", "Paste [Ctrl+V]", "Mirror Paste [Ctrl+R]", "—", "Invert Selection [Ctrl+Shift+I]", "Lock", "—", "Replaced by", "—", "Clone with Linked Editing [▸]", "Apply Linked Editing [▸]", "—",
    "Layer Clone [▸]", "—", "Offset Pattern Outline", "Offset as Internal Line", "Offset as Seamless Block Line" + NB, "—", "Clone as Internal Shape", "Clone as Reference Line", "—", "3D Pattern [▸]", "—", "Order [▸]", "Rotate [▸]", "Flip [▸]", "—",
    "Zoom to Selected [F]", "—", "Export To USD Layer" + NB, "—", "More [▸]"];
  assert.deepStrictEqual(o.body, W1, "W1, inside the pattern with Edit Pattern");
  assert.deepStrictEqual(o.onLine, W1, "Transform Pattern takes the pattern, also on its line");
  assert.deepStrictEqual(o.many, W1, "several selected patterns: the same menu");
  // (Round build-1: Select All ▸ Sewn, Particle Distance, Fabric, Layer are built)
  assert.deepStrictEqual(o["Select All"], ["Sewn [Ctrl+Alt+A]", "Particle Distance", "Fabric", "Layer"]);
  assert.deepStrictEqual(o["Clone with Linked Editing"], ["Symmetric Pattern (with Sewing) [Ctrl+D]", "Symmetric Pattern", "Instance Pattern"]);
  assert.deepStrictEqual(o["Apply Linked Editing"], ["Half Symmetric Pattern (with Sewing)" + NB]);
  assert.deepStrictEqual(o["Layer Clone"], ["Over", "Under"]);
  // (Deactivate, Freeze, Strengthen and Hide 3D Pattern built in Round r14 / 6)
  assert.deepStrictEqual(o["3D Pattern"], ["Deactivate (Pattern Only) [Ctrl+J]", "Deactivate (Pattern & Sewing)", "Freeze [Ctrl+K]", "Strengthen [Ctrl+H]", "Solidify [Ctrl+E]" /* (Round build-1 / 5: built) */, "—", "Archive" /* (built in Round r20 / 9) */, "Hide 3D Pattern [Shift+Q]"]);
  // (Round r30 / 3: the rows show their keys)
  assert.deepStrictEqual(o.Order, ["Bring Forward [Ctrl+]]", "Bring to Front [Ctrl+Shift+]]", "Send Backward [Ctrl+[]", "Send to Back [Ctrl+Shift+[]"]);
  assert.deepStrictEqual(o.Flip, ["Horizontally", "Horizontally (Each)", "Vertically", "Vertically (Each)"]);
  assert.ok(o.Rotate[0] === "Reset Along Grain Direction" && o.Rotate.includes("Parallel to…"), o.Rotate.join(" | "));      // (Parallel to… built in Round r17b / 1)
  assert.deepStrictEqual(o.more, ["Mirror Paste (Position Only)", "Replace (by the Copied Pattern)", "Add Annotation…", "Scale…", "Move…", "Rotate…", "Proportional Grading…"]);
  assert.deepStrictEqual(o.flip, [400, 0], "the two swapped places, mirrored about the box round both");
  assert.deepStrictEqual(o.each, [20, 400], "each in its own place (A reaches to 320 with its curve: its box is 0 to 320)");
  assert.strictEqual(o.flipStep, "Flip Horizontally"); assert.strictEqual(o.cloneStep, "Layer Clone (Under)");
});

test("G1 Edit Sewing's menu on a sewing line is W75; Add Notch on a point puts the notch exactly there; Delete All Curve Points makes the line straight", () => {
  const r = boot({ script: DOC + `
    app.setTool("edit_sewing");
    const s = at(0, 100); app.menu.children.length = 0; app.ev("editSewMenu")(s.x, s.y, s.x, s.y); out.sew = words(app.menu); out.sewMore = sub("More");
    app.setTool("edit_pattern");
    app.menuClick(at(300, 200).x, at(300, 200).y, "Add Notch"); out.notch = [S.pieces[0].segs[2].notches.slice(), app.histSteps().steps.slice(-1)[0].n];
    app.menuClick(at(300, 200).x, at(300, 200).y, "Add Notch"); out.again = [S.pieces[0].segs[2].notches.length, toasts[toasts.length - 1]];
    app.menuClick(at(310, 30).x, at(310, 30).y, "Delete All Curve Points"); out.straight = [!!S.pieces[0].segs[1].curved, S.pieces[0].segs[1].cps];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, NB = " [not built yet]";
  assert.deepStrictEqual(o.sew, ["Select All with Same Property [▸]", "Apply Turned Sewing Line Type" /* (built in Round r17b / 1) */, "Reverse Sewing [Ctrl+B]", "Delete Sewing [Delete]", "—", "Merge [select another first]" /* (built in Round r20 / 3) */, "—",
    "Add Point to Pattern on Start [a point is there]", "Add Point to Pattern on End [a point is there]", "—", "Add Seamline Topstitch", "Add Seamline Rip" + NB, "—", "Deactivate Sewing (Selected)", "—",
    "Hide Sewing (Selected)", "Show Sewing (All) [none hidden]", "—", "Link Line" + NB, "—", "More [▸]"], "W75");      // (Hide / Show Sewing built in Round r13 / 8; Add Seamline Topstitch in Round r14 / 4)
  assert.deepStrictEqual(o.sewMore, ["Check Sewing Length", "Check Sewing Length Settings…"].map((n, k) => k ? n : "  " + n));
  assert.deepStrictEqual(o.notch, [[0], "Add Notch"]);
  assert.deepStrictEqual(o.again, [1, "There is a notch there already"]);
  assert.deepStrictEqual(o.straight, [false, null], "straight, its curve points gone");
});

test("G1 the 3D window's menus: a pattern's is W18, the background's W17, with this program's own under More", () => {
  const r = boot({ three: true, script: DOC + `
    const v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    S.pieces[0].p3 = { pos: [0, 1100, 250], q: [0, 0, 0, 1], r: 0 }; app.commit();
    Object.assign(v3.cam, { az: 0, el: 0.03, dist: 3000, tx: 0, ty: 1100, tz: 0 });
    const p = v3.project(new THREE.Vector3(0, 1100, 250));
    app.menu.children.length = 0; app.TOOL3.select_move.menu({ clientX: p.x, clientY: p.y, button: 2 }); out.pat = words(app.menu); out.patMore = sub("More");
    app.menu.children.length = 0; app.TOOL3.select_move.menu({ clientX: 5, clientY: 5, button: 2 }); out.bg = words(app.menu); out.bgMore = sub("More");
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, NB = " [not built yet]";
  // (Deactivate, Freeze, Strengthen and Hide 3D Pattern built in Round r14 / 6)
  assert.deepStrictEqual(o.pat, ["Copy [Ctrl+C]", "Paste [Ctrl+V]", "Mirror Paste [Ctrl+R]", "—", "Deactivate (Pattern Only) [Ctrl+J]", "Deactivate (Pattern & Sewing)", "—",
    "Freeze [Ctrl+K]", "Strengthen [Ctrl+H]", "Solidify [Ctrl+E]" /* (Round build-1 / 5: built) */, "Flip Normal", "—", "Archive" /* (Flip Normal and Archive built in Round r20 / 9) */, "Hide 3D Pattern [Shift+Q]", "—",
    "Convert [▸]", "Mesh Type [▸]", "—", "Symmetric Arrangement" + NB, "Smart Arrangement" + NB, "Superimpose [▸]", "—", "Reset 2D Arrangement (Selected)", "Reset 3D Arrangement (Selected) [Ctrl+F]", "Move to Ground Center" /* (built in Round r20 / 9) */, "—",
    "Flip [▸]", "Reverse-Arrange [▸]", "—", "Focus Zoom [F]" /* (built in Round r20 / 9) */, "Zoom Extents All", "—", "Export To USD Layer" + NB, "Refresh Textures" + NB, "—", "More [▸]"], "W18");
  assert.deepStrictEqual(o.patMore, ["3D Placement…", "Lay Flat (no curve)"]);
  assert.deepStrictEqual(o.bg.slice(0, 11), ["Front [2]", "3/4 Left [3]", "Back [8]", "Left [6]", "Right [4]", "3/4 Right [1]", "Top [5]", "Bottom [0]", "Custom View" + NB, "—", "Gizmo [▸]"], "W17");
  assert.ok(["Format 3D Background…" /* (built in Round r20 / 11) */, "Paste [Ctrl+V]", "Mirror Paste [Ctrl+R]", "Show/Hide Color" + NB, "Refresh Textures" + NB, "Camera Properties" + NB, "Simulation Properties", "Grid Properties…" /* (built in Round r20 continued (4)) */, "Zoom Extents All"].every(n => o.bg.includes(n)), o.bg.join(" | "));
  assert.ok(o.bgMore.some(n => /Simulate/.test(n)) && o.bgMore.includes("Cloth Density…") && o.bgMore.includes("Reset 3D Arrangement (All)"), o.bgMore.join(" | "));
});

test("G1 a menu is placed to stay whole on the screen: right and down from the pointer where it fits, else left and up, else shifted in; a submenu beside its row, flipped near the edges", () => {
  const G = load(["fitMenu", "MENU_GAP"], { window: { innerWidth: 1000, innerHeight: 800 } });
  const el = (w, h) => ({ offsetWidth: w, offsetHeight: h, style: {} });
  const put = (w, h, x, y, row, above) => { const e = el(w, h); G.fitMenu(e, x, y, row, above); return [parseFloat(e.style.left), parseFloat(e.style.top)]; };
  assert.deepStrictEqual(put(200, 300, 100, 100), [100, 100], "room: at the pointer");
  assert.deepStrictEqual(put(200, 300, 900, 700), [700, 400], "the bottom right corner: to the left of the pointer and above it");
  assert.deepStrictEqual(put(200, 600, 500, 400), [500, 196], "too tall either way from the pointer: shifted in, its bottom 4 px from the window's");
  assert.deepStrictEqual(put(200, 900, 500, 400), [500, 4], "taller than the window: at the top, and it scrolls (the style's max-height)");
  assert.deepStrictEqual(put(150, 100, 0, 0, { left: 600, right: 800, top: 300, bottom: 320 }), [802, 295], "a submenu: to the right of its row");
  assert.deepStrictEqual(put(250, 100, 0, 0, { left: 600, right: 800, top: 300, bottom: 320 }), [348, 295], "no room on the right: on the left of its menu");
  assert.deepStrictEqual(put(150, 300, 0, 0, { left: 600, right: 800, top: 700, bottom: 720 }), [802, 425], "near the bottom: upwards from its row");
  assert.deepStrictEqual(put(200, 100, 100, 500, null, true), [100, 394], "a list that belongs above its button");
});

test("G1 the browser's own menu never opens in the program but in a text field, and not over a dialog that a right-click while dragging opened", () => {
  const r = boot({ script: `
    const ev = (target, button) => { let prevented = false; app.winFire("contextmenu", { target, button: button === undefined ? 2 : button, preventDefault() { prevented = true; } }); return prevented; };
    const press = (target) => app.winFire("mousedown", { target, button: 2 });
    const canvas = { tagName: "CANVAS" }, input = { tagName: "INPUT", type: "text" }, num = { tagName: "INPUT", type: "number" }, box = { tagName: "INPUT", type: "checkbox" }, area = { tagName: "TEXTAREA" }, div = { tagName: "DIV" };
    const out = {};
    press(canvas); out.canvas = ev(canvas);
    press(div); out.panel = ev(div);
    press(input); out.input = ev(input);
    press(num); out.number = ev(num);
    press(area); out.area = ev(area);
    press(box); out.checkbox = ev(box);
    // the right button went down on the canvas (a right-click while dragging) and the menu event comes over the dialog's field
    press(canvas); out.late = ev(input);
    // the menu key on a focused field (no right button)
    out.key = ev(input, 0);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result, { canvas: true, panel: true, input: false, number: false, area: false, checkbox: true, late: true, key: false }, "true: the browser's menu kept out");
});

module.exports = T;
