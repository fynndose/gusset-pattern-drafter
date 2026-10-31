// Round build-1: features that were "not built yet". Batch 2: sums in number fields, a notch caught at the middle of a line,
// Select All ▸ Sewn / Fabric / Layer (Ctrl+Alt+A), and an autosave failure told in words.
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
// four rectangles side by side, the view 1 : 1 at the origin: A sewn to B, B sewn to C, D alone
const DOC = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  const sq = (n, x) => app.mkPiece(n, app.mkShape([{x,y:100},{x:x+200,y:100},{x:x+200,y:300},{x,y:300}], true));
  const A = sq("A", 0), B = sq("B", 300), C = sq("C", 600), D = sq("D", 900);
  S.pieces.push(A, B, C, D);
  const part = (p, i) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: false });
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3)] }, { id: 2, a: [part(B, 1)], b: [part(C, 3)] });
  S.sel = []; app.commit(); S.undo.length = 0;
  const out = {};
`;

/* ---- sums in number fields ---- */
test("build-1 / 2: numOf reads a number or a sum (10+2, 20*1.5, 1/4, brackets, a decimal comma, a sign after it) and nothing else", () => {
  const o = boot({ script: `
    const f = app.ev("numOf");
    return ["12", "10+2", "20*1.5", "1/4", "(3+4)*2", "-5", "2-3", "12,5", "1,5+2,25", "80 %", " 7 ", "3×4", "10÷4", "1e2", "-(2+3)", "", "abc", "10+", "2**3", "1/0", "(1+2"].map(x => [x, f(x)]);` });
  const got = Object.fromEntries(o.result.map(([k, v]) => [k, v]));
  assert.deepStrictEqual(got, { "12": 12, "10+2": 12, "20*1.5": 30, "1/4": 0.25, "(3+4)*2": 14, "-5": -5, "2-3": -1, "12,5": 12.5, "1,5+2,25": 3.75, "80 %": 80, " 7 ": 7,
    "3×4": 12, "10÷4": 2.5, "1e2": 100, "-(2+3)": -5, "": null, abc: null, "10+": null, "2**3": null, "1/0": null, "(1+2": null });       // (NaN comes back as null in JSON)
});

test("build-1 / 2: a dialog takes a sum: OK reads 10+2 as 12; the field shows 12 once it is left; a plain number is left as typed", () => {
  const o = boot({ script: `
    let got = null; const out = {};
    app.answer = null;
    app.ev("numDialog")("Test", [{ k: "a", label: "Length", val: 5, unit: "mm" }, { k: "b", label: "Ratio", val: 50, unit: "%" }], { x: 10, y: 10 }, (v) => { got = v; });
    const h = app.el("dlg").innerHTML;
    out.fields = (h.match(/data-num="1"/g) || []).length;
    out.noNumberType = !/type="number"/.test(h);
    // the field left: numSettle() (the window's change listener, before the field's own) writes the result in
    const settle = app.ev("numSettle");
    const a = { dataset: { num: "1" }, value: "10+2" }; settle({ type: "change", target: a }); out.left = a.value;
    const p = { dataset: { num: "1", pct: "1" }, value: "40+40 %" }; settle({ type: "change", target: p }); out.pct = p.value;
    const plain = { dataset: { num: "1" }, value: "12.50" }; settle({ type: "change", target: plain }); out.plain = plain.value;
    const bad = { dataset: { num: "1" }, value: "10+" }; settle({ type: "change", target: bad }); out.bad = bad.value;
    const other = { dataset: {}, value: "10+2" }; settle({ type: "change", target: other }); out.text = other.value;
    const k = { dataset: { num: "1" }, value: "3*4" }; settle({ type: "keydown", key: "a", target: k }); out.notEnter = k.value; settle({ type: "keydown", key: "Enter", target: k }); out.enter = k.value;
    return out;` });
  assert.deepStrictEqual(o.result, { fields: 2, noNumberType: true, left: "12", pct: "80 %", plain: "12.50", bad: "10+", text: "10+2", notEnter: "3*4", enter: "12" });
});

test("build-1 / 2: the Property Editor's number fields are text fields that take a sum: a pattern's Layer typed as 1+1 is 2", () => {
  const o = boot({ script: DOC + `
    S.sel = [A.id]; app.ev("ui")();
    const h = app.el("props").innerHTML;
    out.noNumberType = !/type="number"/.test(h); out.some = (h.match(/data-num="1"/g) || []).length > 3;
    const el = app.el("pp-lay"); el.value = "1+1"; el.dataset = { num: "1" };
    app.winFire("change", { target: el }); el.onchange({ target: el });
    out.layer = A.layer;
    return out;` });
  assert.deepStrictEqual(o.result, { noNumberType: true, some: true, layer: 2 });
});

/* ---- a notch caught at the middle ---- */
test("build-1 / 2: the Notch tool catches the middle of a line within 10 px (shown by a diamond), not further off; a curve point still wins", () => {
  const o = boot({ script: DOC + `
    app.setTool("notch");
    app.click(107, 100);                     // 7 px from the top's middle (100, 100)
    out.mid = A.segs[0].notches.map(t => app.ev("nT")(t));
    app.click(170, 300);                     // 30 px from the bottom's middle: where the pointer is
    out.off = A.segs[2].notches.map(t => +app.ev("nT")(t).toFixed(3));
    // the hover: the dot at the middle, with the diamond
    const cx = app.ev("ctx"), lines = []; cx.lineTo = (x, y) => lines.push([Math.round(x), Math.round(y)]);
    app.fire("pointermove", { x: 394, y: 300 }); app.draw();
    out.diamond = lines.some(([x, y]) => x === 409 && y === 300);
    // a curve point within reach is caught before the middle
    Object.assign(B.segs[0], { curved: true, cps: [{ x: 405, y: 98 }] }); app.commit();
    const h = { k: "seg", kind: "outline", p: B, sh: B, i: 0, t: 0.5 };
    out.cp = app.ev("notchPlace")(h, 405, 98).mid === undefined;
    return out;` });
  assert.deepStrictEqual(o.result.mid, [0.5]);
  assert.deepStrictEqual(o.result.off, [0.15]);       // the bottom runs right to left, from x 200: x 170 is 0.15 along it, 70 px from its middle
  assert.strictEqual(o.result.diamond, true, "the catch is shown by a diamond round the dot");
  assert.strictEqual(o.result.cp, true, "a curve point is caught first");
});

/* ---- Select All ▸ Sewn / Fabric / Layer ---- */
test("build-1 / 2: Select All ▸ Sewn (Ctrl+Alt+A) takes every pattern joined by sewing, through any number of seams; no step", () => {
  const o = boot({ script: DOC + `
    S.sel = [A.id]; app.key("a", { ctrlKey: true, altKey: true });
    out.sewn = S.sel.map(id => S.pieces.find(p => p.id === id).name);
    out.undo = S.undo.length; out.tool = S.tool;
    S.sel = [D.id]; app.key("a", { ctrlKey: true, altKey: true }); out.alone = S.sel.map(id => S.pieces.find(p => p.id === id).name);
    // from the menu of C, right-clicked: the same garment
    S.sel = []; app.menuClick(700, 200, "Select All ▸ Sewn", "transform_pattern"); out.menu = S.sel.map(id => S.pieces.find(p => p.id === id).name);
    // a locked pattern is not taken
    B.lock = true; S.sel = [A.id]; app.ev("selectAllWith")("sewn"); out.locked = S.sel.map(id => S.pieces.find(p => p.id === id).name); B.lock = false;
    // the Edit menu has the row, with its key
    out.edit = app.MENUS.edit().filter(Boolean).map(r => r.n + (r.k ? " [" + r.k + "]" : "")).filter(n => /^Select All/.test(n));
    out.steps = S.undo.length;
    return out;` });
  assert.deepStrictEqual(o.result.sewn, ["A", "B", "C"]);
  assert.deepStrictEqual(o.result.alone, ["D"]);
  assert.deepStrictEqual(o.result.menu, ["A", "B", "C"]);
  assert.deepStrictEqual(o.result.locked, ["A", "C"], "B is locked, so it is left out; the seams through it still count");
  assert.deepStrictEqual(o.result.edit, ["Select All [Ctrl+A]", "Select All Sewn [Ctrl+Alt+A]"]);
  assert.strictEqual(o.result.undo, 0); assert.strictEqual(o.result.steps, 0, "selecting makes no step");
  assert.strictEqual(o.result.tool, "transform_pattern");
});

test("build-1 / 2: Select All ▸ Fabric and ▸ Layer take the patterns with the same fabric or layer as the one right-clicked", () => {
  const o = boot({ script: DOC + `
    const L = app.libOf(), f2 = { ...L.fabric[0], id: 999, name: "Mesh" }; L.fabric.push(f2);
    B.fabric = 999; D.fabric = 999; C.layer = 1; D.layer = 1;
    const names = () => S.sel.map(id => S.pieces.find(p => p.id === id).name);
    S.sel = []; app.menuClick(400, 200, "Select All ▸ Fabric", "transform_pattern"); out.fabric = names();
    S.sel = []; app.menuClick(100, 200, "Select All ▸ Fabric", "transform_pattern"); out.fabric0 = names();
    S.sel = []; app.menuClick(700, 200, "Select All ▸ Layer", "transform_pattern"); out.layer = names();
    S.sel = [A.id, C.id]; app.menuClick(100, 200, "Select All ▸ Layer", "transform_pattern"); out.both = names();
    out.steps = S.undo.length;
    return out;` });
  assert.deepStrictEqual(o.result, { fabric: ["B", "D"], fabric0: ["A", "C"], layer: ["C", "D"], both: ["A", "B", "C", "D"], steps: 0 });
});

/* ---- the autosave failure in words ---- */
test("build-1 / 2: an autosave failure says so in words with a sign and a box, and a click says why and offers Save", () => {
  const o = boot({ blocked: true, script: `
    const out = {}, el = app.el("s-save");
    out.text = el.textContent; out.cls = el.className; out.focus = el.tabIndex;
    app.modalAnswer = (title, keys, text) => { out.modal = { title, keys, why: /storage/i.test(text), save: /Save/.test(text) }; return "close"; };
    el.onclick();
    // back to working: no click, no button
    app.ev("saveState")("ok"); out.after = [el.textContent, el.onclick === null, el.tabIndex];
    return out;` });
  assert.strictEqual(o.result.text, "⚠ Autosave failed — click for details");
  assert.strictEqual(o.result.cls, "bad"); assert.strictEqual(o.result.focus, 0);
  assert.deepStrictEqual(o.result.modal, { title: "Autosave failed", keys: ["save", "close"], why: true, save: true });
  assert.deepStrictEqual(o.result.after, ["AUTOSAVED", true, -1]);
});

/* ---- batch 3: Lock All …, Optimize Curve Points, Grading Review's Lock and Information Display ---- */
test("build-1 / 3: Lock All Internal Lines, Unlock All Baselines, Lock All Guidelines: what can be picked; the rows say what a click does; no step", () => {
  const o = boot({ script: DOC + `
    app.addChild(A, "internals", app.mkShape([{x:50,y:150},{x:150,y:150}], false));
    app.addChild(A, "bases", app.mkShape([{x:50,y:250},{x:150,y:250}], false));
    S.guides.push({ id: 77, p: { x: 0, y: 500 }, a: 0 }); app.commit(); S.undo.length = 0;
    app.setTool("edit_pattern");
    const kind = (x, y) => { const h = app.hit(x, y); return h ? h.k + ":" + (h.kind || "") : null; };
    out.before = [kind(100, 150), kind(100, 250), !!app.ev("guideAt")(400, 500)];
    const rows = (bar) => app.ev("lockRows")(bar).map(r => r.n + (r.on ? " ✓" : ""));
    out.rows0 = [rows(true), rows(false)];
    app.ev("setView")("lockInt", true); app.ev("setView")("lockBase", false); app.ev("setView")("lockGuide", true);
    out.after = [kind(100, 150), kind(100, 250), !!app.ev("guideAt")(400, 500)];
    app.setTool("trace"); out.trace = kind(100, 150); app.setTool("edit_pattern");
    out.rows1 = [rows(true), rows(false)];
    // a locked guideline is drawn dashed
    const cx = app.ev("ctx"), dashes = []; cx.setLineDash = (d) => dashes.push(d.join(",")); app.draw(); out.dashed = dashes.includes("8,5");
    // the 2D menu's Lock list
    const lock = app.MENUS["2d"]().filter(Boolean).find(r => r.n === "Lock");
    out.menu = lock.menu().filter(Boolean).map(r => r.n + (r.nb ? " (nb)" : ""));
    out.steps = S.undo.length;
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.before, ["seg:internal", "body:", true], "an internal line and a guideline are picked; a baseline is locked from the start");
  assert.deepStrictEqual(r.rows0, [["Lock All Internal Lines", "Unlock All Baselines", "Lock All Guidelines"], ["Lock All Internal Lines", "Unlock All Baselines", "Lock All Guidelines"]]);
  assert.deepStrictEqual(r.after, ["body:", "seg:base", false], "locked internal lines and guidelines are not picked; unlocked baselines are");
  assert.strictEqual(r.trace, "seg:internal", "Trace still reads a locked internal line");
  assert.deepStrictEqual(r.rows1, [["Lock All Internal Lines ✓", "Lock All Baselines", "Lock All Guidelines ✓"], ["Unlock All Internal Lines", "Lock All Baselines", "Unlock All Guidelines"]]);
  assert.strictEqual(r.dashed, true);
  assert.deepStrictEqual(r.menu, ["Lock All Pattern Outlines", "Lock All Internal Lines", "Lock All Baselines", "Lock All Guidelines"]);
  assert.strictEqual(r.steps, 0, "a view switch, not a step");
});

test("build-1 / 3: Optimize Curve Points takes out curve points while the curve stays within 0.1 mm, keeps a notch where it was, is one step; a graded curve is left", () => {
  const o = boot({ script: DOC + `
    // a rounded corner of many curve points: Convert to Curve Point ▸ Maintain Curve on A's corner, then Convert Only on B's
    app.ev("toCurvePoint")(A, 1, true); app.commit();
    const j = 0, s = A.segs[j]; out.n0 = s.cps.length;
    s.notches.push(0.3); const q0 = app.segPt(A, j, 0.3);
    const ref = JSON.parse(JSON.stringify({ pts: A.pts, segs: A.segs, closed: A.closed }));
    S.undo.length = 0;
    S.sel = [A.id]; S.selSeg = j; S.selKind = "outline"; S.selInt = -1;
    // right-click the line between its curve points (a click on a curve point opens the curve point's menu)
    const at = [0.12, 0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68].map(t => app.segPt(A, j, t)).find(q => { const h = app.hit(q.x, q.y); return h && h.k === "seg"; });
    app.menuClick(at.x, at.y, "Optimize Curve Points", "edit_pattern");
    out.n1 = A.segs[j].cps.length;
    out.dev = app.ev("curveDev")(A, j, (t) => app.segPt(ref, j, t)).worst;
    const q1 = app.segPt(A, j, app.ev("nT")(A.segs[j].notches[0]));
    out.notch = Math.hypot(q1.x - q0.x, q1.y - q0.y);
    out.steps = app.histSteps().steps.slice(-1)[0].n; out.undo = S.undo.length;
    // again: nothing more to take out, and no step
    app.ev("optimizeCurves")([{ p: A, sh: A, i: j }]); out.again = S.undo.length;
    // a straight line's row is greyed with a reason
    app.setTool("edit_pattern"); S.sel = []; S.selSeg = -1; app.menu.children.length = 0; app.ev("showMenu")({ clientX: 750, clientY: 100 });
    out.straight = app.menu.children.filter(c => /Optimize Curve Points/.test(c.innerHTML)).map(c => /no curve points to spare/.test(c.innerHTML)); out.menuRows = app.menu.children.map(c => c.innerHTML.replace(/<[^>]+>/g, "")).slice(0, 30);
    // a curve graded per size is not touched
    A.grade = A.grade || {}; A.grade.curves = { ["0:" + A.segs[j].id]: { cps: A.segs[j].cps.map(() => ({})) } };
    out.graded = app.ev("optimizeCurve")(A, A, j);
    return out;` });
  const r = o.result;
  assert.ok(r.n0 >= 8, "Maintain Curve made many curve points: " + r.n0);
  assert.ok(r.n1 < r.n0 && r.n1 >= 1, r.n0 + " → " + r.n1);
  assert.ok(r.dev <= 0.1, "within 0.1 mm of the shape: " + r.dev);
  assert.ok(r.notch < 0.15, "the notch stays where it was: " + r.notch);
  assert.strictEqual(r.steps, "Optimize Curve Points"); assert.strictEqual(r.undo, 1);
  assert.strictEqual(r.again, 1, "nothing more to take out: no second step");
  assert.deepStrictEqual(r.straight, [true], JSON.stringify(r.menuRows));
  assert.strictEqual(r.graded, 0);
});

test("build-1 / 3: Optimize All Curve Points on the empty canvas does every curve of every shown pattern in one step", () => {
  const o = boot({ script: DOC + `
    app.ev("toCurvePoint")(A, 1, true); app.ev("toCurvePoint")(B, 1, true); app.commit(); S.undo.length = 0;
    out.n0 = [A.segs[0].cps.length, B.segs[0].cps.length];
    app.menuClick(500, 600, "Optimize All Curve Points", "edit_pattern");
    out.n1 = [A.segs[0].cps.length, B.segs[0].cps.length]; out.undo = S.undo.length;
    return out;` });
  const r = o.result;
  assert.ok(r.n1[0] < r.n0[0] && r.n1[1] < r.n0[1], JSON.stringify(r)); assert.strictEqual(r.undo, 1);
});

test("build-1 / 3: Grading Review: the tiles zoom and pan together until Lock (Camera) unlinks them; Information Display writes names, lengths, grainlines", () => {
  const o = boot({ script: DOC + `
    const G = S.grading;
    app.ev("setGradePoint")(G, A, A, 1, true); app.ev("setPtDelta")(G, A, A, 1, 5, 20, 0); app.commit();
    S.sel = [A.id]; app.ev("gradingReview")();
    const st = app.ev("reviewSt"), ids = app.ev("gradingReviewTiles")(G, [A]).tiles.map(t => t.z.id), cam = (z) => JSON.stringify(app.ev("reviewCam")(z));
    out.start = cam(ids[0]);
    app.ev("reviewZoom")(ids[0], 100, 150, 2);
    out.linked = [cam(ids[0]) === cam(ids[3]), app.ev("reviewCam")(ids[3]).z];
    // the point under the pointer stays where it was: (100, 150) is the same place before and after
    app.ev("reviewLock")(true); out.lockedHTML = /id="rv-lock" aria-pressed="true"/.test((app.ev("gradingReview")(), app.el("review").innerHTML));
    app.ev("reviewZoom")(ids[1], 0, 0, 2); app.ev("reviewPan")(ids[1], 10, 0);
    out.apart = [app.ev("reviewCam")(ids[1]).z, app.ev("reviewCam")(ids[0]).z];
    app.ev("reviewLock")(false); out.together = [app.ev("reviewCam")(ids[0]).z, app.ev("reviewCam")(ids[4]).z];
    // Information Display
    const html0 = (app.ev("gradingReview")(), app.el("review").innerHTML);
    out.text0 = (html0.match(/<text /g) || []).length;
    st.info.name = true; st.info.length = true; st.info.grain = true;
    const html1 = (app.ev("gradingReview")(), app.el("review").innerHTML);
    out.names = (html1.match(/>A<[/]text>/g) || []).length; out.lengths = (html1.match(/>200[.]0<[/]text>/g) || []).length; out.grain = (html1.match(/class="rv-grain"/g) || []).length;
    // its list: four ticks and the two rows for what is not built
    app.ev("reviewInfoMenu")({ clientX: 50, clientY: 50 }); out.list = app.menu.children.map(c => c.innerHTML.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
    out.steps = S.undo.length;
    return out;` });
  const r = o.result;
  assert.strictEqual(r.start, JSON.stringify({ z: 1, x: 0, y: 0 }));
  assert.deepStrictEqual(r.linked, [true, 2], "one camera for every tile");
  assert.strictEqual(r.lockedHTML, true, "Lock is shown pressed");
  assert.deepStrictEqual(r.apart, [4, 2], "with Lock on, one tile zooms alone");
  assert.deepStrictEqual(r.together, [4, 4], "Lock off: the last tile moved gives every tile its camera");
  assert.strictEqual(r.text0, 0, "nothing written while Information Display is all off");
  assert.strictEqual(r.names, 5, "the name on each of the five tiles"); assert.ok(r.lengths >= 5, "line lengths: the left side, 200 in every size: " + r.lengths); assert.strictEqual(r.grain, 5);
  assert.ok(r.list.some(x => /Pattern Names/.test(x)) && r.list.some(x => /Grainline/.test(x)) && r.list.some(x => x === "2D Measurements") /* (built in Round r20 / 6) */ && r.list.some(x => /Graphic Dimension [(]not built yet[)]/.test(x)), JSON.stringify(r.list));
  assert.strictEqual(r.steps, 0);
});

/* ---- batch 4: Edit Gluing, Sticker, Edit Zipper ---- */
// A (0..200) is glued onto B (300..500) over its left half: the area on A is x 0..100, its place on B x 300..400 (m a move by 300)
const GLUE = DOC + `
  S.glues = [{ id: 1, name: "Glue 1", kind: "area", a: A.id, b: B.id, poly: [{x:0,y:100},{x:100,y:100},{x:100,y:300},{x:0,y:300}], m: [1, 0, 300, 0, 1, 0] }];
  app.commit(); S.undo.length = 0;
  const g = () => S.glues[0], onB = () => g().poly.map(q => ({ x: +(g().m[0]*q.x + g().m[1]*q.y + g().m[2]).toFixed(3), y: +(g().m[3]*q.x + g().m[4]*q.y + g().m[5]).toFixed(3) }));
`;
test("build-1 / 4: Edit Gluing: a click selects a glue (no step); a drag inside moves its place on the base, a corner scales it, the ring turns it; one step each", () => {
  const o = boot({ script: GLUE + `
    app.setTool("edit_gluing");
    app.click(350, 200); out.sel = S.selTrim; out.selSteps = S.undo.length;
    app.drag(350, 200, 370, 220); app.fire("pointerup", { x: 370, y: 220 });
    out.moved = onB()[0]; out.areaA = g().poly[0]; out.steps1 = S.undo.length;
    // a corner of the frame: (320, 120) is the box's top left now; dragged out from the middle (370, 220) twice as far
    app.drag(320, 120, 270, 20); app.fire("pointerup", { x: 270, y: 20 });
    out.scaled = onB(); out.steps2 = S.undo.length;
    app.undo(); app.undo(); out.back = onB()[0];
    // the ring above the frame turns it: dragged a quarter round about the middle (350, 200)
    const fr = app.ev("glueFrame")(g()); app.drag(fr.turn.x, fr.turn.y, 350 + (200 - fr.turn.y), 200); app.fire("pointerup", { x: 350 + (200 - fr.turn.y), y: 200 });
    out.turned = onB()[0];
    // a click on the glue's area on A selects it too, but there is no frame to drag there
    app.ev("trimSelect")("glue", null); app.click(50, 200); out.selA = S.selTrim && S.selTrim.id;
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.sel, { kind: "glue", id: 1 }); assert.strictEqual(r.selSteps, 0, "selecting makes no step");
  assert.deepStrictEqual(r.moved, { x: 320, y: 120 }, "moved by the drag on the base"); assert.deepStrictEqual(r.areaA, { x: 0, y: 100 }, "the area on the piece glued on stays");
  assert.strictEqual(r.steps1, 1);
  assert.deepStrictEqual(r.scaled[0], { x: 270, y: 20 }, "scaled about its middle by 2"); assert.deepStrictEqual(r.scaled[2], { x: 470, y: 420 });
  assert.strictEqual(r.steps2, 2);
  assert.deepStrictEqual(r.back, { x: 300, y: 100 });
  assert.ok(Math.abs(r.turned.x - 450) < 0.5 && Math.abs(r.turned.y - 150) < 0.5, "a quarter turn clockwise about (350, 200): " + JSON.stringify(r.turned));
  assert.strictEqual(r.selA, 1);
});

test("build-1 / 4: Edit Gluing's right-click: Delete, Rotate ▸ with Ctrl + arrows, Flip; Ctrl+Right turns the selected glue; Delete deletes it", () => {
  const o = boot({ script: GLUE + `
    app.setTool("edit_gluing"); app.click(350, 200);
    app.menu.children.length = 0; app.showMenu({ clientX: 350, clientY: 200 }); out.rows = app.menu.children.map(c => c.innerHTML.replace(/<[^>]+>/g, " ").replace(/ +/g, " ").trim()).filter(Boolean);
    app.key("ArrowRight", { ctrlKey: true }); out.turn45 = onB()[0];
    app.undo();
    app.menuClick(350, 200, "Flip Horizontally"); out.flipped = onB()[0];
    app.undo();
    app.menuClick(350, 200, "Rotate ▸ Clockwise (90°)"); out.r90 = onB()[0];
    app.key("Delete"); out.left = S.glues.length;
    return out;` });
  const r = o.result;
  assert.ok(r.rows.includes("Delete Delete") && r.rows.includes("Rotate ▸") && r.rows.includes("Flip Horizontally") && r.rows.includes("Flip Vertically"), JSON.stringify(r.rows));
  // the area's middle on the base is (350, 200); its corner (300, 100) turned 45° clockwise about it
  const c45 = { x: 350 + (-50*Math.SQRT1_2 + 100*Math.SQRT1_2), y: 200 + (-50*Math.SQRT1_2 - 100*Math.SQRT1_2) };
  assert.ok(Math.abs(r.turn45.x - c45.x) < 1e-3 && Math.abs(r.turn45.y - c45.y) < 1e-3, JSON.stringify(r.turn45));
  assert.deepStrictEqual(r.flipped, { x: 400, y: 100 }, "flipped left to right about its middle");
  assert.deepStrictEqual(r.r90, { x: 450, y: 150 });
  assert.strictEqual(r.left, 0, "Delete with Edit Gluing in hand deletes the selected glue");
});

test("build-1 / 4: the glue's Strength and Thickness: in the Property Editor, kept in the file; Strength below 1 makes its stitches soft in the solver", () => {
  const o = boot({ script: GLUE + `
    app.setTool("edit_gluing"); app.click(350, 200);
    const h = app.el("props").innerHTML;
    out.rows = ["gl-name", "gl-str", "gl-th"].map(id => h.includes('id="' + id + '"'));
    out.shown = /value="1[.]000"/.test(h) && /value="0[.]0"/.test(h);
    const st = app.el("gl-str"); st.value = "0.5"; st.onchange({ target: st });
    const th = app.el("gl-th"); th.value = "1+0.5"; app.winFire("change", { target: Object.assign(th, { dataset: { num: "1" } }) }); th.onchange({ target: th });
    out.g = { strength: g().strength, thick: g().thick }; out.steps = S.undo.length;
    out.norm = app.ev("normGlues")([{ ...g(), strength: 0.25, thick: 2 }, { ...g(), id: 2, strength: 7, thick: -2 }]).map(x => [x.strength ?? "none", x.thick ?? "none"]);
    // what the solver is given: a soft stitch for Strength 0.5, none for Strength 0
    app.ev("glueAreaPairs = () => [['x', 'y']]");
    out.sim = app.ev("simGlues")([]).map(x => [x.id, x.soft]);
    g().strength = 0; out.none = app.ev("simGlues")([]).length;
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.rows, [true, true, true]); assert.strictEqual(r.shown, true, "Strength 1.000 and Thickness 0.0 at first");
  assert.deepStrictEqual(r.g, { strength: 0.5, thick: 1.5 }); assert.strictEqual(r.steps, 2);
  // (Round r25, the third check session Numbers 20 / 35: Strength runs from 0.1 to 10, so 7 is kept; it was put to 1, the top then)
  assert.deepStrictEqual(r.norm, [[0.25, 2], [7, "none"]], "kept only when not the default; out of range is put in range");
  assert.deepStrictEqual(r.sim, [["glue1", 1e-5]], "Strength 0.5: a compliance of (1 − s) / (s · 1e5)"); assert.strictEqual(r.none, 0, "Strength 0: no bond");
});

test("build-1 / 4: the solver: a soft stitch (a glue of low Strength) gives under a load where a hard one holds", () => {
  const C = require("../drafter-sim.js");
  const sq = () => { const pts = []; for (let i = 0; i < 4; i++) pts.push([i*10, 0]); for (let j = 0; j < 4; j++) pts.push([40, j*10]); for (let i = 0; i < 4; i++) pts.push([40 - i*10, 40]); for (let j = 0; j < 4; j++) pts.push([0, 40 - j*10]); return C.meshPolygon(pts, 10); };
  const A = sq(), B = sq(), lay = (m, f) => { const n = m.xy.length/2, X = new Float32Array(3*n); for (let i = 0; i < n; i++) X.set(f(m.xy[2*i], m.xy[2*i+1]), 3*i); return X; };
  const top = (m) => { let best = 0; for (let i = 0; i < m.xy.length/2; i++) if (m.xy[2*i+1] < m.xy[2*best+1] - 1e-9 || (Math.abs(m.xy[2*i+1] - m.xy[2*best+1]) < 1e-9 && m.xy[2*i] < m.xy[2*best])) best = i; return best; };
  const ta = top(A), tb = top(B);
  // A held flat at 800 mm; B hangs below it from one stitch between their top corners
  const run = (soft) => {
    const s = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 800, y]) }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x, 800 - y, 0.5]) }],
      seams: [{ id: 1, pairs: [[{ p: 0, i: [ta], w: [1] }, { p: 1, i: [tb], w: [1] }]], ...(soft ? { soft } : {}) }],
      pins: Array.from({ length: A.xy.length/2 }, (_, v) => ({ p: 0, v })), opt: { ground: false, self: false, easeIn: 0 } });
    for (let f = 0; f < 120; f++) C.clothStep(s, 1/60);
    const i = s.off[0] + ta, j = s.off[1] + tb;
    return Math.hypot(s.x[3*i] - s.x[3*j], s.x[3*i+1] - s.x[3*j+1], s.x[3*i+2] - s.x[3*j+2]);
  };
  const hard = run(0), soft = run((1 - 0.001)/(0.001*1e5));
  assert.ok(hard < 0.05, "a hard stitch holds: " + hard);
  assert.ok(soft > hard + 0.5, "a soft one gives under the hanging piece's weight: " + soft + " against " + hard);
});

test("build-1 / 4: Sticker: a click picks a pattern up as a ghost, a click on another pattern glues it there (one step); Esc gives it up", () => {
  const o = boot({ script: DOC + `
    app.setTool("sticker");
    app.click(100, 200); out.held = S.sticker && S.sticker.a === A.id; out.undo0 = S.undo.length;
    const cx = app.ev("ctx"), dashes = []; cx.setLineDash = (d) => dashes.push(d.join(",")); app.fire("pointermove", { x: 420, y: 230 }); app.draw(); out.ghost = dashes.includes("6,4");
    app.click(150, 150); out.same = !!S.sticker;                       // on itself: not yet
    app.click(420, 230);
    const g = S.glues[0]; out.glue = g && { a: g.a === A.id, b: g.b === B.id, m: g.m, n: g.poly.length, sel: S.selTrim };
    out.steps = app.histSteps().steps.slice(-1)[0].n; out.undo = S.undo.length; out.Astays = A.pts[0];
    app.click(100, 200); app.key("Escape"); out.esc = S.sticker; out.glues = S.glues.length;
    return out;` });
  const r = o.result;
  assert.strictEqual(r.held, true); assert.strictEqual(r.undo0, 0, "picking up is no step"); assert.strictEqual(r.ghost, true, "the ghost is drawn dashed");
  assert.strictEqual(r.same, true, "a click on the same pattern keeps it on the pointer");
  assert.deepStrictEqual(r.glue, { a: true, b: true, m: [1, 0, 320, 0, 1, 30], n: 4, sel: { kind: "glue", id: 1 } });
  assert.strictEqual(r.steps, "Sticker"); assert.strictEqual(r.undo, 1);
  assert.deepStrictEqual(r.Astays, { x: 0, y: 100 }, "the pattern stays where it is in 2D");
  assert.strictEqual(r.esc, null); assert.strictEqual(r.glues, 1);
});

test("build-1 / 4: Edit Zipper picks zippers only; an end dragged shows a dot on the other side where both sides are as long; that end catches the dot", () => {
  const o = boot({ script: DOC + `
    // a zipper between A's right side (x 200, y 100 → 300) and B's left side (x 300, y 300 → 100, so reversed)
    S.seams.push({ id: 9, zip: { name: "Zipper 1", type: 1 }, a: [part(A, 1)], b: [{ ...part(B, 3), rev: true }] }); app.commit(); S.undo.length = 0;
    const len = (side) => { const sm = S.seams.find(x => x.id === 9); return sm[side].reduce((t, x) => t + app.ev("partLen")(app.ev("seamSide")(x, S.pieces), x), 0); };
    app.setTool("edit_zipper");
    out.notSeam = !!app.ev("seamHit")(300, 200, null) && app.ev("seamHit")(300, 200, null).sm.id;      // only the zipper is picked (the plain seams are A–B and B–C)
    // A's side ends at (200, 300): dragged up to (200, 260), 40 shorter
    app.drag(200, 300, 200, 260); app.fire("pointerup", { x: 200, y: 260 });
    out.lens = [+len("a").toFixed(1), +len("b").toFixed(1)]; out.zt = S.zipTarget && { side: S.zipTarget.side, end: S.zipTarget.end };
    const q = app.segPt(B, S.zipTarget.at.i, S.zipTarget.at.t); out.dot = { x: +q.x.toFixed(1), y: +q.y.toFixed(1) };
    // B's matching end (300, 300) dragged to 4 px from the dot: it goes exactly there
    app.drag(300, 300, 304, 262); app.fire("pointerup", { x: 304, y: 262 });
    out.after = [+len("a").toFixed(1), +len("b").toFixed(1)]; out.cleared = S.zipTarget;
    out.undo = S.undo.length;
    return out;` });
  const r = o.result;
  assert.strictEqual(r.notSeam, 9, "the zipper, not the seams beside it");
  // B's side is sewn the other way round (rev), so the end matching A's end in sewing order is B's line's start (end 0)
  assert.deepStrictEqual(r.lens, [160, 200]); assert.deepStrictEqual(r.zt, { side: "b", end: 0 });
  assert.deepStrictEqual(r.dot, { x: 300, y: 260 }, "the dot: as far up B's side as A's end");
  assert.deepStrictEqual(r.after, [160, 160], "caught at the dot: both sides as long"); assert.strictEqual(r.cleared, null);
  assert.strictEqual(r.undo, 2);
});

/* ---- batch 5: Solidify, Particle Distance per pattern, Simulation Shrinkage ---- */
test("build-1 / 5: a pattern's own Particle Distance and Simulation Shrinkage in the Property Editor: kept only when set, in the file (version 20), one step each", () => {
  const o = boot({ script: DOC + `
    S.sel = [A.id]; app.ev("ui")();
    const h = app.el("props").innerHTML;
    out.rows = ["pp-res3", "pp-weft", "pp-warp"].map(id => h.includes('id="' + id + '"'));
    const set = (id, v) => { const el = app.el(id); el.value = v; el.onchange({ target: el }); };
    set("pp-res3", "8"); set("pp-weft", "95"); set("pp-warp", "90");
    out.A = { res3: A.res3, shrink3: A.shrink3 }; out.steps = S.undo.length;
    out.particle = [app.ev("particleOf")(A), app.ev("particleOf")(B)];
    set("pp-res3", ""); set("pp-weft", "100"); set("pp-warp", "100"); out.cleared = [A.res3, A.shrink3];
    set("pp-res3", "3"); out.small = [A.res3, toasts.some(t => /5 to 60 mm/.test(t))];
    set("pp-res3", "12");
    out.doc = app.ev("docObj")().pieces.find(p => p.name === "A").res3; out.v = app.ev("docObj")().v;
    // Select All ▸ Particle Distance: the patterns at the same distance
    S.sel = []; app.menuClick(100, 200, "Select All ▸ Particle Distance", "transform_pattern"); out.same = S.sel.map(id => S.pieces.find(p => p.id === id).name);
    S.sel = []; app.menuClick(400, 200, "Select All ▸ Particle Distance", "transform_pattern"); out.others = S.sel.map(id => S.pieces.find(p => p.id === id).name);
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.rows, [true, true, true]);
  assert.deepStrictEqual(r.A, { res3: 8, shrink3: { weft: 95, warp: 90 } }); assert.strictEqual(r.steps, 3);
  assert.deepStrictEqual(r.particle, [8, 20], "its own, the other the document's");
  assert.deepStrictEqual(r.cleared, [null, null], "back to the document's and to none: nothing kept");
  assert.deepStrictEqual(r.small, [null, true], "under 5 mm is refused and said");
  assert.strictEqual(r.doc, 12); assert.strictEqual(r.v, 27);      // (version 27 since Round r29 (a document's render settings); 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up; 22 since Round r18; 21 since Round r17b)
  assert.deepStrictEqual(r.same, ["A"]); assert.deepStrictEqual(r.others, ["B", "C", "D"]);
});

test("build-1 / 5: in 3D each pattern is meshed at its own Particle Distance; a seam between two is paired at the finer one", () => {
  const o = boot({ three: true, script: DOC + `
    app.ev("garmentSync")(true);
    const n = (p) => app.G3.items.get(p.id).mesh.xy.length/2;
    out.before = [n(A), n(B)];
    A.res3 = 8; app.commit(); app.ev("garmentSync")();
    out.after = [n(A), n(B)]; out.res = app.G3.items.get(A.id).mesh.res;
    const order = S.pieces.filter(p => app.G3.items.has(p.id)).map(p => p.id);
    out.pairs = app.simSeams(order).find(x => x.id === 1).pairs.length;
    delete A.res3; app.commit(); app.ev("garmentSync")();
    out.pairs0 = app.simSeams(S.pieces.filter(p => app.G3.items.has(p.id)).map(p => p.id)).find(x => x.id === 1).pairs.length;
    return out;` });
  const r = o.result;
  assert.ok(r.after[0] > 3*r.before[0], "A at 8 mm has many more points: " + JSON.stringify(r)); assert.strictEqual(r.after[1], r.before[1], "B as it was");
  assert.strictEqual(r.res, 8);
  assert.ok(r.pairs > r.pairs0, "the seam A–B paired more finely: " + r.pairs + " against " + r.pairs0);
});

test("build-1 / 5: Simulation Shrinkage in the solver: a sheet with Warp 80 % draws in by a fifth along its grain and not across it", () => {
  const C = require("../drafter-sim.js");
  const pts = []; for (let i = 0; i < 10; i++) pts.push([i*10, 0]); for (let j = 0; j < 10; j++) pts.push([100, j*10]); for (let i = 0; i < 10; i++) pts.push([100 - i*10, 100]); for (let j = 0; j < 10; j++) pts.push([0, 100 - j*10]);
  const m = C.meshPolygon(pts, 10), n = m.xy.length/2, X = new Float32Array(3*n);
  for (let i = 0; i < n; i++) X.set([m.xy[2*i], 500, m.xy[2*i+1]], 3*i);
  // the grain runs along y on the pattern (warp), so the sheet's extent in z (its y) should go to 80, in x stay 100
  const s = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, shrink: { g: [0, 1], warp: 0.8, weft: 1 }, fab: { stretch: 3e5, bend: 30 } }], opt: { gravity: 0, ground: false, self: false, easeIn: 0 } });
  for (let f = 0; f < 300; f++) C.clothStep(s, 1/60);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) { x0 = Math.min(x0, s.x[3*i]); x1 = Math.max(x1, s.x[3*i]); z0 = Math.min(z0, s.x[3*i+2]); z1 = Math.max(z1, s.x[3*i+2]); }
  assert.ok(Math.abs((z1 - z0) - 80) < 3, "along the grain: " + (z1 - z0));
  assert.ok(Math.abs((x1 - x0) - 100) < 3, "across it: " + (x1 - x0));
});

test("build-1 / 5: Solidify in the solver: a strip bent into an arc keeps its arc when it rests in its 3D shape, and flattens when it rests flat", () => {
  const C = require("../drafter-sim.js");
  const pts = []; for (let i = 0; i < 20; i++) pts.push([i*10, 0]); for (let j = 0; j < 2; j++) pts.push([200, j*10]); for (let i = 0; i < 20; i++) pts.push([200 - i*10, 20]); for (let j = 0; j < 2; j++) pts.push([0, 20 - j*10]);
  const m = C.meshPolygon(pts, 10), n = m.xy.length/2, R = 200/Math.PI;          // half a circle: the strip's length round it
  const X = new Float32Array(3*n);
  for (let i = 0; i < n; i++) { const a = m.xy[2*i]/R; X.set([R*Math.sin(a), 500 + R*(1 - Math.cos(a)), m.xy[2*i+1]], 3*i); }
  const sag = (shape3) => {
    const s = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, ...(shape3 ? { shape3: true } : {}), fab: { stretch: 1e7, bend: 3e4 } }], opt: { gravity: 0, ground: false, self: false, easeIn: 0 } });
    for (let f = 0; f < 200; f++) C.clothStep(s, 1/60);
    // how far apart its two ends are: 2R round the half circle, the strip's 200 mm when it lies flat
    let a = 0, b = 0; for (let i = 0; i < n; i++) { if (m.xy[2*i] < m.xy[2*a] - 1e-9) a = i; if (m.xy[2*i] > m.xy[2*b] + 1e-9) b = i; }
    return Math.hypot(s.x[3*a] - s.x[3*b], s.x[3*a+1] - s.x[3*b+1], s.x[3*a+2] - s.x[3*b+2]);
  };
  const kept = sag(true), flat = sag(false);
  assert.ok(Math.abs(kept - 2*R) < 0.1*2*R, "solidified, it keeps its arc: its ends " + kept.toFixed(1) + " apart, the arc's " + (2*R).toFixed(1));
  assert.ok(flat > kept + 20, "resting flat, it opens out: " + flat.toFixed(1));
});

test("build-1 / 5: Solidify (Ctrl+E) on the selected patterns: one step, its opposite named Unsolidify, SOLID in the list, in the file; the solver gets its shape and stiffness", () => {
  const o = boot({ three: true, script: DOC + `
    S.sel = [A.id]; app.key("e", { ctrlKey: true });
    out.on = A.solid3; out.step = app.histSteps().steps.slice(-1)[0].n;
    out.name = app.ev("state3Name")("solid3");
    app.ev("ui")(); out.list = app.el("list").children.some(c => /SOLID/.test(c.innerHTML || ""));
    out.doc = app.ev("docObj")().pieces.find(p => p.name === "A").solid3;
    app.ev("garmentSync")(true); app.ev("simBuild")();
    const spec = app.SIM.sim; out.built = !!spec;
    app.key("e", { ctrlKey: true }); out.off = A.solid3; out.undo = S.undo.length;
    return out;` });
  const r = o.result;
  assert.strictEqual(r.on, true); assert.strictEqual(r.step, "Solidify"); assert.strictEqual(r.name, "Unsolidify");
  assert.strictEqual(r.list, true, "the pattern list says SOLID in words"); assert.strictEqual(r.doc, true); assert.strictEqual(r.built, true);
  assert.strictEqual(r.off, undefined, "Ctrl+E again unsolidifies"); assert.strictEqual(r.undo, 2);
});

module.exports = T;
