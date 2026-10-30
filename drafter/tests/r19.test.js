// Round r19: the housekeeping video (26 Oct 2026). Batch 2, the 2D
// canvas: a pressed line yellow at once (H02), the Σ clear of the pointer (H05), crisper small numbers (H06), the pointer (H03,
// H04) and Transform Pattern's polygon selection (H01).
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
// A (100..400 x 100..300) and B (500..800 x 100..300), the view 1 : 1 at the origin; every text drawn recorded with its font,
// place and alignment, and every line stroked with its colour
const DOC = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  const A = app.mkPiece("A", app.mkShape([{x:100,y:100},{x:400,y:100},{x:400,y:300},{x:100,y:300}], true));
  const B = app.mkPiece("B", app.mkShape([{x:500,y:100},{x:800,y:100},{x:800,y:300},{x:500,y:300}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const out = {}, cx = app.ev("ctx"), texts = [], strokes = [];
  cx.fillText = (t, x, y) => texts.push({ t, x, y, font: cx.font, align: cx.textAlign });
  cx.stroke = () => strokes.push(cx.strokeStyle);
  const drawn = () => { texts.length = 0; strokes.length = 0; app.draw(); return texts.slice(); };
`;

/* ---- Batch 2 ---- */
test("r19 / H02: a line pressed with Edit Pattern shows as selected at once; where it was, the guide lines and the length at the pointer come with the first move", () => {
  const o = boot({ script: DOC + `
    app.setTool("edit_pattern");
    app.fire("pointermove", { x: 250, y: 100 }); app.fire("pointerdown", { x: 250, y: 100 });
    out.pressed = [S.selSeg, S.drag && S.drag.k];
    let t = drawn(); out.tagPressed = t.some(x => x.t === "300.0 mm"); out.greyPressed = strokes.includes("#555");
    app.fire("pointermove", { x: 250, y: 110 });
    t = drawn(); out.tagMoved = t.some(x => x.t === "300.0 mm"); out.greyMoved = strokes.includes("#555");
    app.fire("pointerup", { x: 250, y: 110 });
    // a point pressed: no dashed guide lines until it moves
    app.fire("pointermove", { x: 400, y: 300 }); app.fire("pointerdown", { x: 400, y: 300 });
    out.pt = [S.drag && S.drag.k, !!(S.drag && S.drag.moved)]; drawn(); out.ptGrey = strokes.filter(s => s === "#4a4a4a").length;
    app.fire("pointermove", { x: 410, y: 305 }); out.ptMoved = !!S.drag.moved; drawn(); out.ptGreyMoved = strokes.filter(s => s === "#4a4a4a").length;
    app.fire("pointerup", { x: 410, y: 305 });
    return out;` }).result;
  assert.deepStrictEqual(o.pressed, [0, "seg"], "the press selects the line");
  assert.strictEqual(o.tagPressed, false, "no length at the pointer while only pressed"); assert.strictEqual(o.greyPressed, false, "no outline-as-it-was over the yellow");
  assert.strictEqual(o.tagMoved, true); assert.strictEqual(o.greyMoved, true, "after the first move the feedback is as before");
  assert.deepStrictEqual(o.pt, ["pt", false]); assert.strictEqual(o.ptGrey, 0, "a pressed point draws no guide lines");
  assert.strictEqual(o.ptMoved, true); assert.ok(o.ptGreyMoved > 0, "dragged, its guide lines are drawn");
});

test("r19 / H05, H06: the Σ of the selected lines starts right of the pointer, below its drawing; the small numbers in a proportional face on whole pixels", () => {
  const o = boot({ script: DOC + `
    app.setTool("edit_pattern");
    app.click(250, 100); app.click(400, 200, { shiftKey: true });
    S.mouse = { ...app.toW(603.4, 400.6), sx: 603.4, sy: 400.6 };
    const t = drawn(), sum = t.find(x => x.t.startsWith("Σ"));
    out.sum = sum && [sum.t, sum.x, sum.y, sum.align, sum.font];
    out.cursorPx = app.ev("CURSOR_PX");
    out.whole = t.filter(x => /Segoe/.test(x.font)).every(x => Number.isInteger(x.x) && Number.isInteger(x.y));
    return out;` }).result;
  assert.ok(o.sum, "the Σ is drawn");
  assert.strictEqual(o.sum[0], "Σ 500.0 mm");
  assert.deepStrictEqual(o.sum.slice(1, 4), [613, 401 + o.cursorPx + 8, "left"], "left-aligned 10 px right of the tip, below the pointer's " + o.cursorPx + " px image");
  assert.match(o.sum[4], /^12px "Segoe UI"/, "a size larger than the readouts");
  assert.strictEqual(o.whole, true, "every number on whole pixels");
});

test("r19 / H03, H04: the pointer is a 24 px image, the tool a small badge; over and while dragging a point it is the arrow with a four-way badge", () => {
  const o = boot({ script: DOC + `
    app.setTool("edit_pattern"); app.fire("pointermove", { x: 600, y: 200 }); app.draw();
    out.tool = app.cv.style.cursor;
    app.fire("pointermove", { x: 400, y: 300 }); app.draw(); out.overPoint = app.cv.style.cursor;
    app.setTool("transform_pattern"); app.fire("pointermove", { x: 250, y: 200 }); app.draw(); out.body = app.cv.style.cursor;
    out.move = app.ev("MOVE_CURSOR");
    return out;` }).result;
  const svg = (c) => decodeURIComponent(c.match(/data:image[/]svg[+]xml,([^"]+)"/)[1]);
  assert.match(svg(o.tool), /width="24" height="24"/, "24 px, the system arrow's size");
  assert.match(o.tool, / 1 1, default$/, "the hot spot at the arrow's tip");
  assert.strictEqual(o.overPoint, o.move, "over a point: the arrow with the move badge");
  assert.match(o.move, /, move$/);
  assert.strictEqual(o.body, "move", "Transform Pattern's body keeps the system's move cursor");
});

test("r19 / H01: Transform Pattern's polygon selection: a double-click on empty space starts it, clicks add corners, a click on the first corner closes it and takes the patterns wholly inside; no undo step; Esc gives it up", () => {
  const o = boot({ script: DOC + `
    app.setTool("transform_pattern");
    const u0 = S.undo.length;
    // a polygon round A (wholly) and over half of B
    app.click(50, 50); app.click(50, 50); app.fire("dblclick", { x: 50, y: 50 });
    out.started = !!S.pickPoly && S.pickPoly.pts.length;
    for (const [x, y] of [[650, 50], [650, 350], [50, 350]]) { app.fire("pointermove", { x, y }); app.click(x, y); }
    out.corners = S.pickPoly.pts.length;
    app.fire("pointermove", { x: 54, y: 47 }); drawn(); out.closeRing = strokes.length > 0;
    app.click(54, 47);
    out.sel = S.sel.map(id => S.pieces.find(p => p.id === id).name); out.after = S.pickPoly; out.steps = S.undo.length - u0;
    // round both, closed by a double-click; then one given up with Esc
    app.click(20, 20); app.click(20, 20); app.fire("dblclick", { x: 20, y: 20 });
    for (const [x, y] of [[900, 20], [900, 400]]) app.click(x, y);
    app.click(20, 400); app.click(20, 400); app.fire("dblclick", { x: 20, y: 400 });
    out.both = S.sel.map(id => S.pieces.find(p => p.id === id).name).sort();
    app.click(20, 20); app.click(20, 20); app.fire("dblclick", { x: 20, y: 20 }); app.click(900, 20);
    app.key("Escape"); out.esc = [S.pickPoly, S.sel.length];
    // a double-click on a pattern does not start one
    app.fire("pointermove", { x: 250, y: 200 }); app.fire("dblclick", { x: 250, y: 200 }); out.onPattern = S.pickPoly;
    return out;` }).result;
  assert.strictEqual(o.started, 1, "the double-click's place is the first corner");
  assert.strictEqual(o.corners, 4);
  assert.deepStrictEqual(o.sel, ["A"], "only the pattern wholly inside");
  assert.strictEqual(o.after, null); assert.strictEqual(o.steps, 0, "selecting is no undo step");
  assert.deepStrictEqual(o.both, ["A", "B"], "a double-click closes it too");
  assert.deepStrictEqual(o.esc, [null, 0], "Esc gives it up, nothing selected");
  assert.strictEqual(o.onPattern, null);
});

/* ---- Batch 3 ---- */
test("r19 / H08, H09, H10: the base tools show the distances to the outline; a pattern's base line catches while drawing inside it; the catches reach 12 px (points) and 10 px (lines)", () => {
  const o = boot({ script: DOC + `
    A.bases.push(app.mkShape([{ x: 150, y: 150 }, { x: 350, y: 150 }], false)); app.commit();
    // H08: Base Polygon over A: dashed lines to the outline with their lengths
    app.setTool("base_polygon"); app.fire("pointermove", { x: 250, y: 200 });
    out.cross = drawn().map(x => x.t).filter(t => /^1[05]0[.]0$/.test(t)).sort();
    // H09: drawing an internal polygon inside A, 3 px below the base line: caught on it
    const snap = app.ev("drawSnap");
    const q = snap({ x: 200, y: 153 }, null, { host: A });
    out.base = [S.snapMark.kind, Math.round(q.y*1000)/1000];
    // H10: a corner 11 px away is caught; an edge 9 px away is caught
    snap({ x: 400 + 11, y: 300 + 1 }, null, {}); out.pt11 = S.snapMark.kind;
    const e = snap({ x: 560, y: 100 - 9 }, null, {}); out.edge9 = [S.snapMark.kind, Math.round(e.y)];
    out.reach = [app.ev("SNAP_PX"), app.ev("SNAP_LINE_PX")];
    return out;` }).result;
  assert.deepStrictEqual(o.cross, ["100.0", "100.0", "150.0", "150.0"], "left, right, up and down to A's outline");
  assert.deepStrictEqual(o.base, ["edge", 150], "the base line caught inside its pattern");
  assert.strictEqual(o.pt11, "pt"); assert.deepStrictEqual(o.edge9, ["edge", 100]);
  assert.deepStrictEqual(o.reach, [12, 10]);
});

test("r19 / H12: the grid's rungs fainter, a few steps darker than the window's grey; the axes through the origin darker than any rung", () => {
  const o = boot({ script: DOC + `
    const cols = []; cx.stroke = () => cols.push(cx.strokeStyle); app.ev("grid")();
    out.grid = [...new Set(cols.filter(c => /^#[a-f0-9]{6}$/.test(c) && c[1] === c[3] && c[3] === c[5] && parseInt(c.slice(1, 3), 16) >= 128 && parseInt(c.slice(1, 3), 16) < 198))];
    return out;` }).result;
  const v = o.grid.map(c => parseInt(c.slice(1, 3), 16));
  assert.ok(v.includes(0x80), "the axes: " + o.grid);
  for (const g of v.filter(x => x !== 0x80)) assert.ok(g >= 184 && g <= 194, "a rung within 4 to 14 steps of the window's 198: " + g);
});

/* ---- Batch 4 ---- */
test("r19 / H18, H21: each window its own title (the 3D one the document's file), none in the menu bar; the mode is one drop-down naming the mode in use", () => {
  const o = boot({ script: `
    const out = {}, el = app.el;
    // (follow-up: the title's text is in a span of its own, beside the button that takes the window out)
    out.titles = [el("wt3d-n").textContent, el("wt2d-n").textContent, el("title").textContent];
    app.ev("setFile")("C:/patterns/skirt.pdraft"); out.file = el("wt3d-n").textContent; app.ev("setFile")(null); out.none = el("wt3d-n").textContent;
    out.mode = el("mode-btn").textContent;
    app.menu.children.length = 0; app.ev("modeMenu")(); out.rows = app.menu.children.map(c => c.innerHTML.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
    app.ev("setMode")("layout"); out.layout = el("mode-btn").textContent; app.ev("setMode")("sim");
    return out;` }).result;
  assert.deepStrictEqual(o.titles, ["3D Garment Window", "2D Pattern Window", ""]);
  assert.strictEqual(o.file, "skirt.pdraft"); assert.strictEqual(o.none, "3D Garment Window");
  assert.strictEqual(o.mode, "SIMULATION ▾"); assert.strictEqual(o.layout, "PRINT LAYOUT ▾");
  assert.deepStrictEqual(o.rows, ["Mode", "✓ Simulation", "Print Layout"], "both modes, the one in use ticked");
});

test("r19 / H13, H14, H15, H19: the panel's width and the Object Browser's height are set, kept within bounds and saved per machine; the Object Browser floats or folds; Reset puts the layout back", () => {
  const o = boot({ script: `
    const out = {}, el = app.el, set = app.ev("setPanels");
    set({ panelW: 380, obH: 0.6 });
    out.set = [el("app").style.gridTemplateColumns, el("ob").style.flex, JSON.parse(app.storage.get("pdraft:ui")).panelW];      // (Round r23 / 1: panel sizes are view state, not written)
    set({ panelW: 5000, obH: 2 }); out.clamped = [S.ui.panelW, S.ui.obH];
    set({ obFloat: { x: 300, y: 80 } }); out.float = [el("ob").style.left, el("ob").style.top, el("ob").style.flex, el("ob-grip").style.display];
    set({ obFloat: null, obFold: true }); out.fold = [el("ob").style.flex, el("ob-fold").textContent];
    app.ev("setLayout")("both"); set({ split: 0.3 });
    app.ev("resetLayout")();
    out.reset = [S.ui.layout, S.ui.panelW, S.ui.obH, S.ui.obFold, S.ui.obFloat, S.ui.split, el("app").style.gridTemplateColumns];
    return out;` }).result;
  assert.deepStrictEqual(o.set, ["1fr 380px", "0 0 60%", null]);
  assert.deepStrictEqual(o.clamped, [640, 0.85]);
  assert.deepStrictEqual(o.float, ["300px", "80px", "", "none"], "floating: placed by its own left and top, no grip under it");
  assert.deepStrictEqual(o.fold, ["", "▸"]);
  assert.deepStrictEqual(o.reset, ["both", 276, 0.42, false, null, 0.5, "1fr 276px"]);      // (Round r23 / 4: the reset shows both windows, as every start does)
});

test("r19 / H31, H33: the Library button is a small bookshelf with its name as the tooltip; the library's head is a title strip that moves it", () => {
  const fs = require("fs"), html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8");
  const b = html.match(/<button id="s-lib"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(b && /title="Library/.test(b[0]), "the tooltip names it");
  assert.strictEqual(b[1].replace(/<svg[\s\S]*<\/svg>/, "").trim(), "", "nothing but the drawing");
  const o = boot({ script: `app.ev("libraryDialog")(); return /class="lb-head dt"/.test(app.el("dlg").innerHTML);` }).result;
  assert.strictEqual(o, true);
});

/* ---- Batch 5 ---- */
test("r19 / H16, H17: the Scene tab is a tree with counts whose rows open their lists (a way back first); the POM tab lists the points of measure, a click selects one with Edit Point of Measure (its × is checked by hand: the fake page has no button to click)", () => {
  const o = boot({ script: DOC + `
    // (the fake page's element keeps its children when its HTML is set to nothing: cleared by hand before each list)
    const clear = () => { app.el("ob-items").children.length = 0; };
    const text = () => app.el("ob-items").children.map(c => c.innerHTML.replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim());
    clear(); app.ev("obSelect")("scene", null); out.scene = text();
    // a row of the tree opens its list, with the way back to the Scene first
    const tk = app.el("ob-items").children.find(c => /Tacks/.test(c.innerHTML)); clear(); tk.onclick(); out.tack = [S.ob.tab, text()[0], app.el("ob-name").textContent];
    // two points of measure on A
    S.measures.push({ id: 1, a: { piece: A.id, sid: A.segs[0].id, t: 0 }, b: { piece: A.id, sid: A.segs[1].id, t: 0 } }); app.commit();
    S.measures.push({ id: 2, a: { piece: A.id, sid: A.segs[0].id, t: 0 }, b: { piece: A.id, sid: A.segs[2].id, t: 0 } }); app.commit();
    clear(); app.ev("obSelect")("pom", null); out.pom = text();
    app.el("ob-items").children[2].onclick(); out.pick = [S.tool, S.selMeas];
    return out;` }).result;
  for (const g of ["2D Pattern", "Patterns 2", "Sewing", "Seams 0", "3D Form", "Tacks 0", "Piping 0", "Binding 0", "Gluing 0", "Material", "Environment", "Avatar none"]) assert.ok(o.scene.includes(g), g + " in " + JSON.stringify(o.scene));
  assert.deepStrictEqual(o.tack, ["tack", "‹ Scene", "Scene › Tack"]);
  // (Round r20 / 6: the Names from CSV… button stands first)
  assert.strictEqual(o.pom.length, 3); assert.match(o.pom[0], /Names from CSV/); assert.match(o.pom[1], /Measurement 1 ↔? ?.*mm/);
  assert.deepStrictEqual(o.pick, ["edit_pom", [2]]);
});

/* ---- Batch 6 ---- */
test("r19 / H23, H24, H26, H27, H30: Print Layout: a tab per fabric shows, nests and prints only its patterns; the header names the fabric and the grade; Sheets across rises to the widest pattern; every sheet's frame a dashed cut line; the tape keeps every measurement", () => {
  const o = boot({ script: DOC + `
    const lib = app.libOf(); while (lib.fabric.length < 2) app.libAdd("fabric");
    const [f1, f2] = lib.fabric; A.fabric = f1.id; B.fabric = f2.id;
    // B made 900 mm wide: wider than three A4 sheets across
    B.pts = [{x:500,y:100},{x:1400,y:100},{x:1400,y:300},{x:500,y:300}]; app.commit();
    app.setMode("layout");
    out.fabs = app.ev("layoutFabrics")().map(f => f.name);
    S.layFab = f1.id; out.tab1 = app.layoutPieces().map(x => x.src.name);
    app.layoutCmd("nest"); const keepA = JSON.stringify(S.layout.place[A.id + ":0"]);
    S.layFab = f2.id; out.tab2 = app.layoutPieces().map(x => x.src.name);
    const cols0 = S.layout.cols; app.layoutCmd("nest"); out.cols = [cols0, S.layout.cols];
    out.keptA = JSON.stringify(S.layout.place[A.id + ":0"]) === keepA;
    out.job = app.layoutJob().pieces.map(p => p.name);
    S.layFab = null; out.all = app.layoutPieces().map(x => x.src.name).sort();
    // the header: the tab's fabric, Grade
    const cx2 = app.ev("lctx"), hd = []; if (cx2) cx2.fillText = (t) => hd.push(t);
    S.layFab = f2.id; app.ev("drawLayout")(); out.header = hd.filter(t => /^(Fabric|Grade):/.test(t));
    // the printed sheets
    S.layFab = null; const html = app.layoutJob().html; out.pages = (html.match(/class="page"/g) || []).length; out.dashed = (html.match(/stroke-dasharray="3 2"\\/>/g) || []).length;
    // the tape: three measurements, all kept; Esc clears them
    app.ev("layTape")(true); const T = S.layTape;
    for (const [x, y] of [[10, 10], [60, 10], [10, 50], [10, 90], [80, 80], [90, 90]]) app.ev("layTapeClick")(x, y);
    out.tape = [T.list.length, !!T.a, !!T.b];
    app.key("Escape"); out.tapeEsc = S.layTape;
    return out;` }).result;
  assert.deepStrictEqual(o.fabs.length, 2);
  assert.deepStrictEqual(o.tab1, ["A"]); assert.deepStrictEqual(o.tab2, ["B"]);
  assert.ok(o.cols[1] > o.cols[0], "Sheets across raised for the 900 mm pattern: " + o.cols);
  assert.strictEqual(o.keptA, true, "nesting B's tab leaves A where it was");
  assert.deepStrictEqual(o.job, ["B"], "the tab prints its own patterns");
  assert.deepStrictEqual(o.all, ["A", "B"]);
  assert.deepStrictEqual(o.header, ["Fabric: " + o.fabs[1], "Grade: None"]);
  assert.ok(o.pages > 0 && o.dashed === o.pages, "a dashed frame on each of the " + o.pages + " sheets (" + o.dashed + ")");
  assert.deepStrictEqual(o.tape, [2, true, true], "two kept, the third the last one"); assert.strictEqual(o.tapeEsc, null);
});

test("r19 / H28: Print Layout's commands on a bar at the right, in the reference's order; the three not built follow the switch", () => {
  const o = boot({ script: `
    const out = {}, bar = app.el("lay-tools"), cmds = () => bar.children.filter(c => c.dataset && c.dataset.cmd).map(c => c.dataset.cmd + (c.disabled ? "-" : ""));
    bar.children.length = 0; app.setUnbuilt(true); out.on = cmds();
    bar.children.length = 0; app.setUnbuilt(false); out.off = cmds();
    return out;` }).result;
  // (Round r25 / 3: Manual Nesting is built, so it is on the bar either way)
  assert.deepStrictEqual(o.on, ["nest", "stop-", "settings", "unnest", "unnestAdd-", "labels", "manual", "row", "snap", "tape", "plotter", "print", "file"]);
  assert.deepStrictEqual(o.off, ["nest", "settings", "unnest", "labels", "manual", "row", "snap", "tape", "plotter", "print", "file"]);
});

/* ---- Batch 7 ---- */
test("r19 / H29: the Plotter box: Options and Port (greyed, not built, only with the switch on), Line Options and Add'l Information with Select All, the first sheet as a preview; Select All changes the print's settings", () => {
  const o = boot({ script: DOC + `
    app.setMode("layout"); const dlg = app.el("dlg"), html = () => dlg.innerHTML;
    app.setUnbuilt(true); app.ev("plotterDialog")();
    /* (Round r20 / 8: Pen, Cutter, Unit and Cut on Outline are built for the HP-GL file; only the Port stays greyed) */ out.on = ["Options", "Port", "Line Options", "Select All", "Add’l Information", "Pen</label>", "Cutter</label>", "Serial Port (not built yet)", "Pattern outline", "Seam allowance", "Pattern name", "Plot", "Save", "Reset", "Cancel"].filter(t => !html().includes(t));
    out.preview = /class="page"/.test(html());
    app.setUnbuilt(false); app.ev("plotterDialog")(); out.off = [/Pen \(not built yet\)/.test(html()), /<h3>Port/.test(html())];
    // Select All off for the lines: every line kind off, in the print's settings; Reset brings the defaults back
    dlg.onchange({ target: { dataset: { all: "lines" }, checked: false } });
    out.allOff = Object.values(S.print.lines).every(l => !l.show);
    // (Reset is checked by hand: the fake page's querySelector() gives every button the same element)
    return out;` }).result;
  assert.deepStrictEqual(o.on, [], "everything of the box is there with the switch on");
  assert.strictEqual(o.preview, true, "the first sheet as the preview");
  assert.deepStrictEqual(o.off, [false, false], "the rows not built are left out with the switch off");
  assert.strictEqual(o.allOff, true);
});

/* ---- Follow-up (the maintainer's decisions of 26 Oct) ---- */
test("r19 follow-up / H07: the halo behind the small numbers is a preference, on by default; off, the numbers are drawn without it", () => {
  const o = boot({ script: DOC + `
    const halos = []; cx.strokeText = (t) => halos.push(t);
    const count = () => { halos.length = 0; app.ev("lbl")("300.0", { x: 10, y: 10 }); return halos.length; };
    out.def = [S.prefs.labelHalo, count()];
    app.ev("setPrefs")({ labelHalo: false }); out.off = [S.prefs.labelHalo, count(), JSON.parse(app.storage.get("pdraft:prefs")).labelHalo];
    app.ev("settingsDialog")({ x: 10, y: 10 }); out.row = /data-p="labelHalo"/.test(app.el("dlg").innerHTML);
    return out;` }).result;
  assert.deepStrictEqual(o.def, [true, 1], "on by default: one halo stroke");
  assert.deepStrictEqual(o.off, [false, 0, false], "off: none, and kept per machine");
  assert.strictEqual(o.row, true, "the Settings box has the switch (Settings ▸ Preferences keeps the reference's rows, W31)");
});

test("r19 follow-up / H20: a window taken out floats with its own place and size, the other has the room; the same button or Reset puts it back; kept per machine", () => {
  const o = boot({ script: `
    const out = {}, el = app.el;
    app.ev("setLayout")("both");
    app.ev("winFloat")("2d");
    const f = S.ui.float2; out.out = [!!f, el("pane2d").style.left === f.x + "px", el("pane2d").style.width === f.w + "px", el("split").style.display, el("pane3d").style.flex, JSON.parse(app.storage.get("pdraft:ui")).float2 !== null];
    app.ev("winFloat")("2d"); out.back = [S.ui.float2, el("pane2d").style.left, el("split").style.display];
    app.ev("winFloat")("3d"); app.ev("resetLayout")(); out.reset = [S.ui.float3, S.ui.layout];
    out.junk = [app.ev("normUI")({ float2: { x: 1, y: 2, w: 10, h: "x" } }).float2, app.ev("normUI")({ float3: { x: 1, y: 2, w: 10, h: 20 } }).float3];
    return out;` }).result;
  assert.deepStrictEqual(o.out, [true, true, true, "none", "", true], "out: its own place and size, no splitter, the 3D window has the room, saved");
  assert.deepStrictEqual(o.back, [null, "", ""], "back in its place, the splitter again");
  assert.deepStrictEqual(o.reset, [null, "both"]);      // (Round r23 / 4)
  assert.deepStrictEqual(o.junk, [null, { x: 1, y: 2, w: 240, h: 180 }], "junk is docked; a size is at least 240 × 180");
});

test("r19 follow-up / version 23: a version 22 file (written by the build before the follow-up: two fabrics, a Print Layout of its own, a history) opens unchanged: the same document but its version, its history replayed; saved again it is version 23", () => {
  // (a blank start, as the program starts: the loader keeps the opening session's own shape counter when it is higher)
  const o = boot({ blank: true, streams: true, script: `
    const out = {};
    const bytes = new Uint8Array(app.read("files/v22/two-fabrics-layout-history.pdraft"));
    const was = app.fileDoc(bytes);
    app.ev("openFile")("two-fabrics-layout-history.pdraft", bytes, null, true);
    return app.wait(() => S.pieces.length === 2, "the file opened").then(() => {
      const J = app.ev("canonJSON"), now = app.ev("docObj")();
      out.v = [was.v, now.v];
      const strip = (d) => { const c = JSON.parse(JSON.stringify(d)); delete c.v; delete c.scene; delete c.drape; delete c.states3; delete c.states3Bin; delete c.history; return J(c); };
      out.same = strip(was) === strip(now); if (!out.same) { const a = strip(was), b = strip(now); let k = 0; while (a[k] === b[k]) k++; out.diff = [a.slice(k - 60, k + 120), b.slice(k - 60, k + 120)]; }
      out.names = S.pieces.map(p => p.name); out.layout = [S.layout.name, S.layout.paper, S.layout.margin, S.layout.cols, Object.keys(S.layout.place).length];
      out.lights = [S.lights.length, "lights" in now]; out.undo = S.un.map(s => s.n);
      return new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); })
        .then((again) => new Promise((res) => app.ev("zipUnpack")(again, (e, p) => res(p)))).then((parts) => app.ev("pdraftDoc")(parts))
        .then((d) => { out.again = [d.v, "lights" in d]; app.ev("undo")(); out.undone = S.pieces[1].name; return out; });
    });` });
  const r = o.result;
  assert.deepStrictEqual(r.v, [22, 26]);      // (opened, this build's version: 26 since Round r26, 25 since Round r25, 24 since Round r20)
  assert.ok(r.same, "the document as the file has it: " + JSON.stringify(r.diff));
  assert.deepStrictEqual(r.names, ["Front", "Back piece"]);
  assert.deepStrictEqual(r.layout, ["Two fabrics", "a3", 12, 2, 2], "the layout as it was");
  assert.deepStrictEqual(r.lights, [0, false], "no lights, none written");
  assert.deepStrictEqual(r.undo, ["Rectangle", "Assign Fabric", "Segment Sewing", "Print Layout", "Nest Patterns", "Rename"], "its history came with it");
  assert.deepStrictEqual(r.again, [26, false]);      // (saved again: version 26 since Round r26, 25 since Round r25, 24 since Round r20) assert.strictEqual(r.undone, "Back");
});

test("r19 follow-up / H22: lights are added, edited and deleted, each one undo step, saved in the file and read back; junk is dropped", () => {
  const o = boot({ blank: true, script: `
    const out = {};
    const a = app.ev("lightAdd")("spot"); app.ev("lightSet")(a.id, "intensity", 5); app.ev("lightSet")(a.id, "color", "#FFAA00"); app.ev("lightSet")(a.id, "az", 400);
    const b = app.ev("lightAdd")("dome");
    out.lights = S.lights.map(l => [l.id, l.type, l.intensity, l.color, l.az, l.name]);
    out.steps = S.un.map(s => s.n);
    return new Promise((res) => { app.setDownload((n, f) => res(f)); app.saveDoc(false); }).then((f) => {
      out.file = app.fileDoc(new Uint8Array(f)).lights.map(l => [l.id, l.type]);
      app.ev("lightDelete")(b.id); out.deleted = S.lights.length; app.ev("undo")(); out.back = S.lights.length; app.ev("undo")(); app.ev("undo")(); out.undone = S.lights[0].intensity;
      out.junk = app.ev("normLights")([{ id: 1, type: "laser", intensity: -3, color: "red" }, { id: 1 }, "x", { name: "no id" }]);
      return out;
    });` }).result;
  assert.deepStrictEqual(o.lights, [[1, "spot", 5, "#ffaa00", 180, "Light 1"], [2, "dome", 2, "#ffffff", -60, "Light 2"]], "values kept within bounds, the colour in small letters");
  assert.deepStrictEqual(o.steps, ["Add Light", "Edit Light", "Edit Light", "Edit Light", "Add Light"]);
  assert.deepStrictEqual(o.file, [[1, "spot"], [2, "dome"]]);
  assert.deepStrictEqual([o.deleted, o.back, o.undone], [1, 2, 5], "Delete and undo; two more undos take the second light and the angle back, the intensity stays 5");
  assert.deepStrictEqual(o.junk, [{ id: 1, name: "Light", type: "dir", on: true, intensity: 0, color: "#ffffff", az: 30, el: 45, spread: 30 }], "a second id 1 and things without an id are dropped");
});

test("r19 follow-up / H22: a render is drawn once at its size × the supersampling, without the grid, with soft shadows and the document's lights (the window's own when there are none); the 3D window's next frame is as before: no shadows, its own lights, the grid", () => {
  const o = boot({ three: true, script: DOC + `
    app.ev("setLayout")("both");
    return app.wait(() => app.view3d.ready(), "the 3D window").then(() => {
      const last = () => { const r = app.renders[app.renders.length - 1]; return [r.w, r.h, r.lights.length, r.shadows, r.grid, r.casters]; };
      // the 3D window as the render left it: [its visible lights, the shadow map on, the grid shown, things the render added, meshes casting shadows]
      const state = () => { const sc = app.view3d.scene(), L = [], extra = [], cast = []; let grid = false;
        sc.traverse((x) => { if (x.isLight && x.visible) L.push(x.type); if (/^grid:/.test(x.name || "") && x.visible) grid = true; if (/^render:/.test(x.name || "")) extra.push(x.name); if (x.castShadow) cast.push(x.type); });
        return [L.length, app.gl().shadowMap.enabled, grid, extra, cast]; };
      const norm = app.ev("normRender");
      out.own = [!!app.ev("renderShot")(norm({ ss: 2, shadows: true, bg: "white" }), { w: 200, h: 100 }), last()];
      out.after1 = state();
      const s = app.ev("lightAdd")("spot"); app.ev("lightSet")(s.id, "intensity", 5); app.ev("lightAdd")("dome"); const off = app.ev("lightAdd")("point"); app.ev("lightSet")(off.id, "on", false);
      app.ev("renderShot")(norm({ ss: 4, shadows: true }), { w: 160, h: 90 });
      const r = app.renders[app.renders.length - 1]; out.doc = [r.w, r.h, r.lights, r.shadows, r.grid, r.casters];
      app.ev("renderShot")(norm({ ss: 1, shadows: false }), { w: 160, h: 90 }); out.plain = last();
      out.after2 = state();
      return out;
    });` }).result;
  assert.deepStrictEqual(o.own, [true, [400, 200, 3, true, false, ["DirectionalLight"]]], "2× supersampled, the window's three lights, its sun casting the shadows, no grid");
  assert.deepStrictEqual(o.doc, [640, 360, ["HemisphereLight:2", "SpotLight:5"], true, false, ["SpotLight"]], "4×; the document's lights that are on, instead of the window's");
  assert.deepStrictEqual(o.plain, [160, 90, 2, false, false, []], "no supersampling, no shadows");
  for (const a of [o.after1, o.after2]) assert.deepStrictEqual(a, [3, false, true, [], []], "afterwards the 3D window as it was: its three lights, no shadow map, the grid, nothing of the render's, nothing casting shadows");
});

test("r19 follow-up / H25: a fabric's tab sets its own roll (paper, width, margins) in the Property Editor; All shows each fabric's marker on its own roll, one below the other, nests and prints each on its own; saved in the file; Use the default takes it back", () => {
  const o = boot({ script: DOC + `
    const lib = app.libOf(); while (lib.fabric.length < 2) app.libAdd("fabric");
    const [f1, f2] = lib.fabric; A.fabric = f1.id; B.fabric = f2.id; app.commit();
    app.setMode("layout");
    const props = app.el("props"), change = (id, v) => { app.ev("layoutProps")(props); const e = app.el(id); e.value = v; e.onchange(); };
    S.layFab = f2.id;
    change("ly-paper", "rollc"); change("ly-cw", "500"); change("ly-margin", "0");
    const L = S.layout;
    out.roll = L.rolls && L.rolls[String(f2.id)] && [L.rolls[String(f2.id)].paper, L.rolls[String(f2.id)].customW, L.rolls[String(f2.id)].margin];
    out.base = [L.paper, L.margin];
    out.sheets = [app.ev("layoutSheet")(f2.id).width, app.ev("layoutSheet")(f2.id).roll, app.ev("layoutSheet")(f1.id).roll];
    out.steps = S.un.slice(-3).map(s => s.n);
    // All: fabric 2's marker below fabric 1's
    S.layFab = null; app.layoutCmd("nest");
    const offs = app.ev("layoutOffsets")(), ps = app.layoutPieces();
    out.offs = [offs.get(f1.id), offs.get(f2.id) > 0];
    const pb = ps.find(x => x.src === B), pa = ps.find(x => x.src === A);
    out.bBelow = Math.min(...pb.poly.map(q => q.y)) >= offs.get(f2.id) - 1e-6 && Math.min(...pa.poly.map(q => q.y)) < offs.get(f2.id);
    out.bOnRoll = Math.max(...app.layoutPieces(f2.id)[0].poly.map(q => q.x)) <= 500 + 1e-6;
    const job = app.layoutJob(); out.job = [/@page g0/.test(job.html), /@page g1/.test(job.html), /url[(]#clip1_0[)]/.test(job.html), (job.html.match(/class="page"/g) || []).length === job.tiles.length];
    // in the file, and read back
    const doc = JSON.parse(app.ev("docJSON")()), d = doc.doc || doc; out.file = d.layout.rolls ? Object.keys(d.layout.rolls) : null;
    out.norm = app.ev("normLayout")({ rolls: { "7": { paper: "rollc", customW: 9999999 }, junk: { paper: "a3" } } }).rolls;
    // Use the default: the roll is gone, one undo step
    S.layFab = f2.id; app.ev("layoutProps")(props); app.el("ly-roll-def").onclick(); out.def = [!!(S.layout.rolls && S.layout.rolls[String(f2.id)]), S.un[S.un.length - 1].n];
    app.ev("undo")(); out.undone = !!S.layout.rolls[String(f2.id)];
    return out;` }).result;
  assert.deepStrictEqual(o.roll, ["rollc", 500, 0], "fabric 2's own roll, 500 mm wide, no margin");
  assert.deepStrictEqual(o.base, ["a4", 10], "the layout's own (the default) untouched");
  assert.deepStrictEqual(o.sheets, [500, true, false]);
  assert.deepStrictEqual(o.steps, ["Print Layout", "Print Layout", "Print Layout"], "each change one undo step");
  assert.deepStrictEqual(o.offs, [0, true]); assert.strictEqual(o.bBelow, true, "in All fabric 2's marker is below fabric 1's");
  assert.strictEqual(o.bOnRoll, true, "nested on its own 500 mm roll");
  assert.deepStrictEqual(o.job, [true, true, true, true], "printed: each fabric's pages at their own size, their drawings kept apart");
  assert.ok(o.file && o.file.length === 1, "the roll in the file: " + JSON.stringify(o.file));
  assert.deepStrictEqual(Object.keys(o.norm), ["7"]); assert.strictEqual(o.norm["7"].customW, 5000, "a width within bounds; a key that is no fabric dropped");
  assert.deepStrictEqual(o.def, [false, "Default Roll"]); assert.strictEqual(o.undone, true);
});

module.exports = T;
