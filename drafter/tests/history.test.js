// Roadmap 2, batch 8: the zipper (a seam with a name and a type, made with two clicks and
// a double-click a side) and the history timeline (every step named, a marker for each,
// a click rolls the document back or forward).
"use strict";
const { oldSizeRun } = require("./harness");      // (Round r33 / 4) the size run every document had before r33: a document starts with none since (harness.js)
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const S = { pieces: [], seams: [], stitches: [], sel: [], undo: [], redo: [], tool: "edit_pattern", mode: "sim", lib: null, nextSegId: 1, nextShapeId: 1, nextId: 1, selPt: -1, selSeg: -1, selInt: -1 };
const G = load(["V", "mkShape", "mkPiece", "push", "histFit", "histSteps", "histClean", "histNote", "loadSeams", "normZip", "makeSeam", "seamInfo", "normLib", "defaultGrading", "snap", "unsnap", "docJSON", "loadDoc"],
  { S, TOOL_REGISTRY: { groups: [], tools: [{ id: "edit_pattern", name: "Edit Pattern" }], glyphs: {}, badges: {} }, ui: () => {}, draw: () => {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
const { V, mkShape, mkPiece, push, histSteps, histClean, histNote, loadSeams, normZip, makeSeam, seamInfo, normLib, defaultGrading, docJSON, loadDoc } = G;

const T = [];
const test = (name, fn) => T.push({ name, fn });
function reset() { S.pieces = []; S.seams = []; S.stitches = []; S.sel = []; S.undo = []; S.redo = []; S.un = []; S.rn = []; S.tool = "edit_pattern"; S.mode = "sim"; S.lib = normLib(null); S.grading = oldSizeRun(); S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; histNote(""); }
const rect = (name, x, y, w, h) => { const p = mkPiece(name, mkShape([V(x, y), V(x + w, y), V(x + w, y + h), V(x, y + h)], true)); S.pieces.push(p); return p; };

test("a step is named after the command, else the tool in hand; an explicit name wins", () => {
  reset();
  push(); assert.deepStrictEqual(histSteps().steps[0], { n: "Edit Pattern", tool: "edit_pattern" });
  histNote("Add Point&hellip;"); push();
  assert.deepStrictEqual(histSteps().steps[1], { n: "Add Point", tool: "edit_pattern" }, "a command's step carries the tool in hand too (Round CF: its icon with the step's word)");
  push("Nest Patterns"); assert.strictEqual(histSteps().steps[2].n, "Nest Patterns");
  histNote(""); S.tool = "no_such_tool"; push(); assert.strictEqual(histSteps().steps[3].n, "Edit");
  S.mode = "layout"; push(); assert.strictEqual(histSteps().steps[4].n, "Print Layout");
  assert.strictEqual(histSteps().at, 5);
});

test("names are tidied: no markup, no ellipsis, not too long", () => {
  assert.strictEqual(histClean("<b>Rotate</b> Dart…"), "Rotate Dart");
  assert.strictEqual(histClean("Move..."), "Move");
  assert.strictEqual(histClean("  Flip   H  "), "Flip H");
  assert.ok(histClean("x".repeat(200)).length <= 48);
  assert.strictEqual(histClean(null), "");
});

test("names keep step with the undo stack: a step taken back by hand, a cleared stack, the 90-step limit", () => {
  reset();
  push("One"); push("Two"); push("Three");
  S.undo.pop();                                              // what a command does when it fails part-way
  assert.deepStrictEqual(histSteps().steps.map(s => s.n), ["One", "Two"]);
  push("Four"); assert.deepStrictEqual(histSteps().steps.map(s => s.n), ["One", "Two", "Four"]);
  S.undo.length = 0; assert.strictEqual(histSteps().steps.length, 0);
  S.undo.push("{}"); assert.strictEqual(histSteps().steps[0].n, "Edit", "a state pushed without a name still has one");
  reset(); for (let k = 0; k < 95; k++) push("S" + k);
  const h = histSteps();
  assert.strictEqual(h.steps.length, 90); assert.strictEqual(S.undo.length, 90);
  assert.strictEqual(h.steps[0].n, "S5"); assert.strictEqual(h.steps[89].n, "S94");
});

test("a new step after going back discards the steps that were undone", () => {
  reset();
  push("A"); push("B");
  S.redo.push("{}"); S.rn.push({ n: "C", tool: "" });
  assert.deepStrictEqual(histSteps().steps.map(s => s.n), ["A", "B", "C"]);
  assert.strictEqual(histSteps().at, 2);
  push("D");
  assert.deepStrictEqual(histSteps().steps.map(s => s.n), ["A", "B", "D"]);
  assert.strictEqual(S.redo.length, 0);
});

test("a zipper is a seam with a name and a type: it is kept through saving, and plain seams gain nothing", () => {
  reset();
  const a = rect("A", 0, 0, 100, 300), b = rect("B", 200, 0, 100, 300);
  const z = makeSeam(S.seams, { piece: a.id, sid: a.segs[1].id }, { piece: b.id, sid: b.segs[3].id }, true);
  z.zip = { name: "Front zip", type: 4 }; S.seams.push(z);
  const s = makeSeam(S.seams, { piece: a.id, sid: a.segs[0].id }, { piece: b.id, sid: b.segs[0].id }, false); S.seams.push(s);
  const text = docJSON();
  S.seams = []; loadDoc(JSON.parse(text));
  assert.strictEqual(S.seams.length, 2);
  assert.deepStrictEqual(S.seams[0].zip, { name: "Front zip", type: 4 });
  assert.ok(!("zip" in S.seams[1]));
  const inf = seamInfo(S.seams[0], S.pieces);
  assert.ok(Math.abs(inf.la - 300) < 1e-6 && Math.abs(inf.diff) < 1e-6);
  assert.deepStrictEqual(normZip({ name: 7, type: "x" }), { name: "Zipper", type: null });
  assert.deepStrictEqual(loadSeams([{ id: 1, a: [{ piece: a.id, sids: [a.segs[1].id] }], b: [{ piece: b.id, sids: [b.segs[3].id] }], zip: true }], S.pieces)[0].zip, { name: "Zipper", type: null });
});

function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
  const B = app.mkPiece("B", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:400},{x:300,y:400}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const at = (x, y) => app.toS({ x, y }), out = {};
  const click = (x, y) => { const s = at(x, y); app.fire("pointermove", s); app.fire("pointerdown", s); app.fire("pointerup", s); };
`;

test("booted app: the Zipper tool — click, double-click, the other side the same; listed, checked, undone", () => {
  const r = boot({ script: DOC + `
    app.setTool("zipper"); out.tool = S.tool;
    // side one: A's right edge from y 50 to y 350 (click, then a double-click = two presses in one place)
    click(200, 50); out.started = !!(S.draft && S.draft.sew && S.draft.sew.start && S.draft.sew.zip);
    click(200, 350); out.afterEnd = [S.draft.sew.a.length, S.draft.sew.side];
    click(200, 350); out.sideDone = [S.draft.sew.a.length, S.draft.sew.side];
    // side two: B's left edge; the guide dot marks 300 mm from the start
    click(300, 50);
    out.guide = app.sewGuides().map(g => { const q = app.segPt(g.sh, g.i, g.t); return Math.round(q.y); }).sort((a, b) => a - b);
    out.readout = app.sewReadout(0).hint;
    click(300, 350); click(300, 350);
    out.made = S.seams.length; const z = S.seams[0];
    out.zip = z.zip; out.info = (() => { const i = app.seamInfo(z, S.pieces); return [Math.round(i.la), Math.round(i.lb)]; })();
    out.lib = app.libOf().zipper.map(x => x.id).includes(z.zip.type);
    out.step = app.histSteps().steps.map(s => s.n);
    out.toast = app.el("toast").textContent;
    // an uneven zipper is made, with a warning
    click(0, 50); click(0, 350); click(0, 350); click(500, 50); click(500, 250); click(500, 250);
    out.uneven = [S.seams.length, /differ by/.test(app.el("toast").textContent), !!S.seams[1].zip, S.seams[1].zip.name];
    // a second stretch on one side: a single click ends a stretch, the next click starts another
    app.undo(); out.afterUndo = S.seams.length;
    // deleting a point of a zipped edge keeps the zipper on the edge (it is a seam)
    app.setTool("edit_pattern"); out.kept = S.seams.filter(s => s.zip).length;
    return out;` });
  const o = r.result;
  assert.deepStrictEqual(r.errors, [], r.errors.join("; "));
  assert.strictEqual(o.tool, "zipper"); assert.ok(o.started);
  assert.deepStrictEqual(o.afterEnd, [1, "a"], "one click ends the stretch, not the side");
  assert.deepStrictEqual(o.sideDone, [1, "b"], "the second click in the same place ends the side");
  assert.ok(o.guide.includes(350), "a dot where the second side is as long as the first: " + o.guide);
  assert.ok(/zipper/i.test(o.readout));
  assert.strictEqual(o.made, 1);
  assert.strictEqual(o.zip.name, "Zipper 1"); assert.ok(o.lib, "its type is a zipper of the library");
  assert.deepStrictEqual(o.info, [300, 300]);
  assert.deepStrictEqual(o.step, ["Zipper"]);
  assert.ok(/on both sides/.test(o.toast), o.toast);
  assert.deepStrictEqual(o.uneven, [2, true, true, "Zipper 2"]);
  assert.strictEqual(o.afterUndo, 1); assert.strictEqual(o.kept, 1);
});

test("booted app: several stretches on one side of a zipper, and Enter instead of the double-click", () => {
  const r = boot({ script: DOC + `
    app.setTool("zipper");
    click(200, 20); click(200, 120);            // first stretch of side one, 100 long
    click(200, 200); click(200, 400);           // a second stretch, 200 long (not where the first ended)
    out.a = S.draft.sew.a.length; app.key("Enter"); out.side = S.draft.sew.side;
    click(300, 50); click(300, 350); app.key("Enter");
    const z = S.seams[0], i = app.seamInfo(z, S.pieces);
    out.parts = [z.a.length, z.b.length]; out.len = [Math.round(i.la), Math.round(i.lb)]; out.zip = !!z.zip;
    return out;` });
  const o = r.result;
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(o.a, 2); assert.strictEqual(o.side, "b");
  assert.deepStrictEqual(o.parts, [2, 1]); assert.deepStrictEqual(o.len, [300, 300]); assert.ok(o.zip);
});

test("booted app: the timeline — a marker per step, a click rolls back and forward, a new edit drops what was undone", () => {
  const r = boot({ script: DOC + `
    const xs = () => S.pieces[0].pts.map(p => p.x).join(",");
    const step = (name, dx) => { app.push(name); S.pieces[0].pts[0].x += dx; app.commit(); };
    const start = xs();
    step("One", 1); step("Two", 10); step("Three", 100);
    out.closed = [app.el("timeline").children.length, S.ui.timeline];
    app.setTimeline(true);
    // the stand-in page keeps old children when innerHTML is cleared: the newest track is the one drawn last
    const track = () => app.el("timeline").children.filter(c => c.className === "tl-track").pop();
    const marks = () => track().children.filter(c => /tl-step/.test(c.className));
    out.open = [S.ui.timeline, JSON.parse(app.storage.get("pdraft:ui")).timeline];      // (Round r23 / 1: shown or not is view state, never written)
    out.marks = marks().map(m => m.className.replace("tl-step", "").trim() + "|" + m.title);
    out.head = track().children.findIndex(c => c.className === "tl-head");
    // click the marker of step 1
    marks()[1].onclick(); out.at1 = [app.histSteps().at, xs() === "1,200,200,0", marks().map(m => m.className.replace("tl-step", "").trim())];
    // forward to step 3, back to the start
    marks()[3].onclick(); out.at3 = [app.histSteps().at, xs() === "111,200,200,0"];
    marks()[0].onclick(); out.at0 = [app.histSteps().at, xs() === start, S.redo.length];
    app.histGo(2); out.at2 = xs();
    // a new edit from step 2: step Three is gone
    step("Four", 1000); out.after = app.histSteps().steps.map(s => s.n); out.count = marks().length;
    // undo and redo move the same line
    app.undo(); out.undo = [app.histSteps().at, app.histSteps().steps.length];
    app.redo(); out.redo = app.histSteps().at;
    // a canvas drag is named after the tool, with its icon
    app.setTool("edit_pattern"); const a = at(200, 400), b = at(230, 430); app.fire("pointermove", a); app.fire("pointerdown", a); app.fire("pointermove", b); app.fire("pointerup", b);
    const last = app.histSteps().steps.slice(-1)[0]; out.drag = [last.n, last.tool];
    // a right-click command is named after the menu item
    app.menuClick(at(250, 200).x, at(250, 200).y, "Flip ▸ Horizontally", "transform_pattern"); out.menu = app.histSteps().steps.slice(-1)[0].n;
    app.setTimeline(false); out.shut = [app.el("timeline").innerHTML, JSON.parse(app.storage.get("pdraft:ui")).timeline];
    return out;` });
  const o = r.result;
  assert.deepStrictEqual(r.errors, [], r.errors.join("; "));
  assert.deepStrictEqual(o.closed, [0, false], "closed until asked for");
  assert.deepStrictEqual(o.open, [true, null]);
  assert.deepStrictEqual(o.marks, ["|Start: before the first step", "|1 · Edit Pattern: One (Edit)", "|2 · Edit Pattern: Two (Edit)", "cur|3 · Edit Pattern: Three (Edit)"], "each marker names the tool in hand, its step and the kind of step (Round C / C8, Round CF)");
  assert.strictEqual(o.head, 4, "the line stands after the step the document is at");
  assert.deepStrictEqual(o.at1, [1, true, ["", "cur", "later", "later"]]);
  assert.deepStrictEqual(o.at3, [3, true]);
  assert.deepStrictEqual(o.at0, [0, true, 3]);
  assert.strictEqual(o.at2, "11,200,200,0");
  assert.deepStrictEqual(o.after, ["One", "Two", "Four"]); assert.strictEqual(o.count, 4);
  assert.deepStrictEqual(o.undo, [2, 3]); assert.strictEqual(o.redo, 3);
  assert.deepStrictEqual(o.drag, ["Edit Pattern", "edit_pattern"]);
  assert.ok(/Flip/.test(o.menu), o.menu);
  assert.deepStrictEqual(o.shut, ["", null]);
});

// (Round r23 / 1: every start looks the same) the timeline shown is view state: it no longer comes back
test("booted app: an open timeline left by an older build does not come back in the next session; the steps do not either", () => {
  const r = boot({ uiSaved: JSON.stringify({ timeline: true }), script: `return [S.ui.timeline, app.histSteps().steps.length, app.el("timeline").children.length > 0];` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result.slice(0, 2), [false, 0]);
});

module.exports = T;
