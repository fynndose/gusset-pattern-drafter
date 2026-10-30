// Round B / B6 and B7. B6: the two reset buttons of the 3D toolbar act on every pattern and say so in their names; the
// form for the selected patterns is on a pattern's right-click menu. B7: both lengths of a seam and their difference at
// the pointer, and Deactivate / Activate Sewing: a seam that stays in the document, is left out of the simulation and is
// drawn white and dotted.
// The tests run in the booted app with three.js and a renderer that draws nothing.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-boot-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify({ blank: true, three: true, ...opt }));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 30000, maxBuffer: 1 << 28 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after " + (ms || 30000)/1000 + " s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
// three patterns: Front and Back arranged, sewn at both sides; Pocket beside them, sewn to nothing
const DOC = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 420), sq("Pocket", 800, 0, 100, 100));
  const part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  S.seams.push({ id: 1, a: [part(S.pieces[0], 1)], b: [part(S.pieces[1], 3, true)] }, { id: 2, a: [part(S.pieces[0], 3)], b: [part(S.pieces[1], 1, true)] });
  S.pieces[0].p3 = { pos: [0, 1100, 250], q: [0, 0, 0, 1], r: 0 }; S.pieces[1].p3 = { pos: [0, 1100, -250], q: [0, 1, 0, 0], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, worker: false, self: false }); app.commit(); S.undo.length = 0; S.un.length = 0;
  const P = (k) => S.pieces[k], it = (k) => G3.items.get(S.pieces[k].id);
  const steps = () => app.histSteps().steps.map(s => s.n);
  // as if draped: every cloth a little off where its arrangement puts it
  const drape = () => { for (let k = 0; k < 3; k++) { const c = it(k); for (let i = 0; i < c.X.length; i++) c.X[i] += 7; c.draped = true; } };
  const placed = (k) => { const c = it(k), p = P(k), X = app.ev("SIM3D").placeVerts(c.mesh.xy, c.mesh.c, app.ev("pieceP3")(p, c.mesh.c)); return Array.from(c.X).every((v, i) => Math.abs(v - X[i]) < 0.01); };
`;

/* ---------- B6 ---------- */
test("the two reset buttons act on all patterns, whatever is selected, and are named \"(All)\"; the right-click menu has the form for the selected patterns", () => {
  const r = boot({ script: DOC + `
    out.names = ["reset_3d_arrangement", "reset_2d_arrangement"].map(id => [app.TOOLS[id].n, app.TOOLS[id].tip, app.HINT[id]]);
    // Reset 3D Arrangement (All), with one pattern selected: every cloth goes back, not only that one
    drape(); S.sel = [P(0).id];
    out.draped = [0, 1, 2].map(k => [it(k).draped, placed(k)]);
    app.CMD3.reset_3d_arrangement();
    out.all3 = [0, 1, 2].map(k => [it(k).draped, placed(k)]); out.said = toasts[toasts.length-1]; out.steps3 = steps().length;
    // the selected form: from the pattern's menu (and on Ctrl+F)
    drape(); S.sel = [P(1).id]; app.ev("resetArrangement3")(true);
    out.sel3 = [0, 1, 2].map(k => it(k).draped);
    drape(); S.sel = [P(0).id]; app.key("f", { ctrlKey: true }); out.key3 = [0, 1, 2].map(k => it(k).draped);
    // Reset 2D Arrangement (All), with one selected: every pattern stands flat in front again; one undo step
    S.sel = [P(0).id]; app.CMD3.reset_2d_arrangement();
    // (since Round F every pattern has a place in 3D: "back in front" is the place the 2D window gives it, flat, facing forward)
    const home = (p) => JSON.stringify(p.p3.q) === "[0,0,0,1]" && !p.p3.r && p.p3.pos[2] === 420;
    out.all2 = [S.pieces.map(home), steps()];
    app.undo(); out.undone = S.pieces.map(p => !home(p));
    S.sel = [P(1).id]; app.ev("resetArrangement2")(true); out.sel2 = S.pieces.map(home);
    // the menus say which is which
    const mid = v3.project(new THREE.Vector3(0, 1100, 250));
    Object.assign(v3.cam, { az: 0, el: 0.03, dist: 3000, tx: 0, ty: 1100, tz: 0 });
    const at = v3.project(new THREE.Vector3(0, 1100, 250));
    app.menu.children.length = 0; app.TOOL3.select_move.menu({ clientX: at.x, clientY: at.y, button: 2 });
    out.menu = app.menu.children.map(c => c.innerHTML.replace(/<span class="k">.*$/, "").replace(/<[^>]*>/g, "")).filter(t => /^Reset/.test(t));
    out.avatar = app.MENUS.avatar().filter(x => x.n && /^Reset/.test(x.n)).map(x => x.n);
    out.key = app.keyTable().filter(x => x.id === "reset3d").map(x => x.n);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.names.map(n => n[0]), ["Reset 3D Arrangement (All)", "Reset 2D Arrangement (All)"]);
  assert.ok(/all patterns/i.test(o.names[0][1]) && /all patterns/i.test(o.names[1][1])); assert.ok(o.names.every(n => /every pattern/.test(n[2]) && /selected patterns only: right-click/.test(n[2])), o.names.map(n => n[2]).join(" | "));
  assert.deepStrictEqual(o.draped, [[true, false], [true, false], [true, false]]);
  assert.deepStrictEqual(o.all3, [[false, true], [false, true], [false, true]], "all three back where they are arranged, though one was selected");
  assert.strictEqual(o.said, "Back to the arrangement"); assert.strictEqual(o.steps3, 0, "the drape is not the document's: no undo step");
  assert.deepStrictEqual(o.sel3, [true, false, true], "the selected form: that pattern only"); assert.deepStrictEqual(o.key3, [false, true, true]);
  assert.deepStrictEqual(o.all2, [[true, true, true], ["Reset 2D Arrangement"]], "every pattern, one undo step"); assert.deepStrictEqual(o.undone, [true, true, false]);
  assert.deepStrictEqual(o.sel2, [false, true, true]);
  assert.deepStrictEqual(o.menu, ["Reset 2D Arrangement (Selected)", "Reset 3D Arrangement (Selected)"], "the pattern's menu in 3D has the selected forms, in W18's order (the (All) forms are the toolbar's, and under More on the background's menu)");
  assert.deepStrictEqual(o.avatar, ["Reset 3D Arrangement (All)", "Reset 2D Arrangement (All)"]); assert.deepStrictEqual(o.key, ["Reset 3D Arrangement (Selected)"]);
});

/* ---------- B7 ---------- */
// what the 2D window draws: every text written, and every line stroked with its colour and its dashes
const DRAWN = `
  const ctx = app.ev("ctx"), texts = [], strokes = []; let dash = "";
  ctx.fillText = (t) => { texts.push(String(t)); }; ctx.setLineDash = (d) => { dash = d.join(" "); }; ctx.stroke = () => { strokes.push(ctx.strokeStyle + "|" + dash + "|" + ctx.lineWidth); };
  const redraw = () => { texts.length = 0; strokes.length = 0; app.draw(); };
  // the middle of a seam's first stretch on its first side, on the screen
  const onSeam = (id, side, f) => { const sm = S.seams.find(x => x.id === id), X = app.ev("seamSide")(sm[side || "a"][0], S.pieces), m = app.ev("partPlace")(X, sm[side || "a"][0], f === undefined ? 0.5 : f); return app.toS(app.segPt(X.sh, m.i, m.t)); };
  const at = (q) => app.fire("pointermove", { x: q.x, y: q.y });
`;
test("with Edit Sewing the difference and both lengths of the seam under the pointer are written at the pointer, and each side's length beside it; while an end is dragged they follow", () => {
  const r = boot({ script: DOC + DRAWN + `
    app.setTool("edit_sewing");
    let q = onSeam(1); at(q); redraw();
    out.over = [app.ev("sewAtPointer")().text, app.ev("sewAtPointer")().differ, texts.filter(t => /[(]/.test(t)), texts.filter(t => /^4[02]0[.]0$/.test(t)).sort()];
    q = onSeam(1, "b"); at(q); out.otherSide = app.ev("sewAtPointer")().text;
    at({ x: 5, y: 5 }); redraw(); out.away = [app.ev("sewAtPointer")(), texts.filter(t => /[(]/.test(t))];
    // every seam can be read this way, not only a bad one or the selected one
    q = onSeam(2); at(q); out.second = [app.ev("sewAtPointer")().sm.id, app.ev("sewAtPointer")().text, S.selSeam];
    // an end dragged along its edge: the label counts with it
    const e1 = onSeam(1, "b", 1), mid = onSeam(1, "b", 0.6);
    at(e1); app.fire("pointerdown", { x: e1.x, y: e1.y }); app.fire("pointermove", { x: mid.x, y: mid.y }); redraw();
    const live = app.ev("sewAtPointer")();
    out.drag = [live.sm.id, live.la, Math.round(live.lb), live.text === texts.find(t => /[(]/.test(t)), /^[+]/.test(live.text)];
    app.fire("pointerup", { x: mid.x, y: mid.y });
    // equal sides are written in blue, sides that differ by more than a millimetre in red
    out.col = [live.differ, (() => { S.seams[1].b[0].t1 = 400/420; at(onSeam(2)); return app.ev("sewAtPointer")(); })()].map(x => (x === true ? "red" : x.differ ? "red" : "blue " + x.text));
    // the seam's right-click menu is W75's, with no title row (Round G1): the numbers are the pointer's
    const m2 = onSeam(1); app.menu.children.length = 0; app.ev("editSewMenu")(m2.x, m2.y, m2.x, m2.y);
    out.menu = app.menu.children.filter(c => c.className !== "msearch")[0].innerHTML;      // (Round r20 / 10: past the search field at the top)
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.over.slice(0, 2), ["-20.0 (400.0 / 420.0)", true], "the difference, then (this seam's first side / its second side)");
  assert.deepStrictEqual(o.over[2], ["-20.0 (400.0 / 420.0)"], "written on the canvas at the pointer"); assert.deepStrictEqual(o.over[3], ["400.0", "420.0"], "and each side's own length beside it");
  assert.strictEqual(o.otherSide, "-20.0 (400.0 / 420.0)", "the same seam from its other side");
  assert.deepStrictEqual(o.away, [null, []]);
  assert.deepStrictEqual(o.second, [2, "-20.0 (400.0 / 420.0)", null], "a seam that is neither selected nor marked bad");
  assert.deepStrictEqual(o.drag.slice(0, 2), [1, 400]); assert.ok(o.drag[2] > 230 && o.drag[2] < 270, "the dragged side is shorter now: " + o.drag[2]); assert.deepStrictEqual(o.drag.slice(3), [true, true]);
  assert.deepStrictEqual(o.col, ["red", "blue 0.0 (400.0 / 400.0)"]);
  assert.ok(/^<span>Select All with Same Property<.span>/.test(o.menu), o.menu);
});

test("Deactivate Sewing (Selected): the seam stays in the document, is drawn white and dotted in both windows, the simulation leaves it out, Activate Sewing brings it back; one undo step each, kept in the file", () => {
  const r = boot({ script: DOC + DRAWN + `
    app.setTool("edit_sewing");
    let q = onSeam(1); const menuNow = () => { q = onSeam(1); app.menu.children.length = 0; app.ev("editSewMenu")(q.x, q.y, q.x, q.y); return app.menu.children.filter(c => c.className !== "msearch" /* (Round r20 / 10) */).map(c => c.innerHTML.replace(/<span class="k">.*$/, "").replace(/<[^>]*>/g, "")); };
    const pick = (name) => { menuNow(); app.menu.children.find(c => c.innerHTML.includes("<span>" + name + "</span>")).onclick(); };
    const lines = () => { at({ x: 5, y: 5 }); S.selSeam = null; redraw(); return [...new Set(strokes.filter(x => /^#(ffffff|1c1c1e)[|]0.1 8[|]/.test(x) || /^#[0-9a-f]{6}[|][|]3$/.test(x)))].sort(); };
    out.before = [menuNow().filter(t => /activate Sewing [(]/i.test(t)), lines()];
    pick("Deactivate Sewing (Selected)");
    out.off = [S.seams.map(sm => sm.off === true), S.seams.length, steps(), toasts[toasts.length-1]];
    out.menu = [menuNow()[0], menuNow().filter(t => /activate Sewing [(]/i.test(t))];
    out.lines = lines();
    // told by its line, not by its colour: white dots (with a dark rim), where a sewn seam is a whole line
    S.sel = [P(0).id]; out.panel = [(app.ev("seamsPanel")(P(0)).match(/class="soff"/g) || []).length, />off</.test(app.ev("seamsPanel")(P(0)))];
    at(q); out.pointer = app.ev("sewAtPointer")().text;
    // Check Sewing Length does not mark it: it is not sewn
    app.setSewCheck(true); S.selSeam = null; at({ x: 5, y: 5 }); redraw(); out.check = [strokes.some(x => /^#e01515[|][|]6$/.test(x)), texts.filter(t => /^Δ/.test(t)).length]; app.setSewCheck(false);
    // the simulation: the deactivated seam pulls nothing, the other one closes
    const seamsNow = app.simSeams(S.pieces.map(p => p.id));
    out.sim = seamsNow.map(sm => [sm.id, !!sm.skip, !!sm.off, sm.bad]);
    const gap = (id) => { const sm = app.SIM.seams.find(x => x.id === id), a = [0, 0, 0], b = [0, 0, 0], order = app.SIM.order; let d = 0; for (const [A, B] of sm.pairs) { app.ev("anchorPos")(A, order, a); app.ev("anchorPos")(B, order, b); d += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); } return d/sm.pairs.length; };
    app.ev("simStart")(); const g0 = [gap(1), gap(2)];
    for (let i = 0; i < 60; i++) app.ev("simFrame")();
    out.gaps = [g0, [gap(1), gap(2)]];
    app.ev("simStop")();
    // in 3D its threads are white and dotted
    out.thread = [...G3.thread].map(([k, o3]) => [k.replace(/:.*?([^0-9]*)$/, ":$1"), o3.material.type, "#" + o3.material.color.getHexString(), o3.material.dashSize || 0]);
    // undo, redo; saved and opened again
    // (since Round F the simulation run is a step of its own: the first undo takes the run back, the second the activation)
    app.undo(); app.undo(); out.undone = S.seams.map(sm => sm.off === true); app.redo(); app.redo(); out.redone = S.seams.map(sm => sm.off === true);
    let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
    out.inFile = app.fileDoc(file).seams.map(sm => sm.off);
    app.ev("openFile")("off.pdraft", file, null, true); out.opened = [S.seams.map(sm => sm.off === true), toasts[toasts.length-1]];
    // junk in a file is no flag
    const d = app.fileDoc(file); d.seams[0].off = "yes"; d.seams[1].off = 1; app.loadDoc(d); out.junk = S.seams.map(sm => sm.off);
    app.ev("openFile")("off.pdraft", file, null, true);
    // Activate Sewing (Selected)
    app.setTool("edit_sewing"); pick("Activate Sewing (Selected)");
    out.on = [S.seams.map(sm => sm.off === true), toasts[toasts.length-1], app.histSteps().steps.map(x => x.n).slice(-1)[0], lines()];
    // a deactivated zipper has no tapes
    S.seams[1].zip = { name: "Zipper 1", type: app.libOf().zipper.length ? app.libOf().zipper[0].id : 1 }; app.commit();
    const order = S.pieces.map(p => p.id); out.zip = [app.zipList(order).length]; S.seams[1].off = true; app.commit(); out.zip.push(app.zipList(order).length);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.before[0], ["Deactivate Sewing (Selected)"]); assert.strictEqual(o.before[1].filter(x => /0.1 8/.test(x)).length, 0, "nothing dotted yet");
  assert.deepStrictEqual(o.off.slice(0, 3), [[true, false], 2, ["Deactivate Sewing"]], "the seam is still there, flagged; one undo step");
  assert.ok(/^Seam S1 is deactivated: it stays in the pattern, drawn white and dotted, and the simulation leaves it out$/.test(o.off[3]), o.off[3]);
  assert.strictEqual(o.menu[0], "Select All with Same Property", "W75's first row (Round G1: no title row; the row below says the state)"); assert.deepStrictEqual(o.menu[1], ["Activate Sewing (Selected)"]);
  assert.ok(o.lines.includes("#ffffff|0.1 8|3") && o.lines.includes("#1c1c1e|0.1 8|6"), "white dots with a dark rim: " + o.lines.join("  "));
  assert.strictEqual(o.lines.filter(x => /^#[0-9a-f]{6}[|][|]3$/.test(x)).length, 1, "the seam that is still sewn is a whole line in its own colour");
  assert.deepStrictEqual(o.panel, [1, true], "the Seams panel says off beside it"); assert.strictEqual(o.pointer, "-20.0 (400.0 / 420.0) · deactivated");
  assert.deepStrictEqual(o.check, [true, 1], "of the two uneven seams only the sewn one is marked by Check Sewing Length");
  assert.deepStrictEqual(o.sim, [[1, true, true, false], [2, false, false, true]], "listed for drawing, skipped by the solver");
  assert.ok(o.gaps[1][1] < o.gaps[0][1]*0.5, "the sewn seam closes: " + o.gaps[0][1] + " -> " + o.gaps[1][1]);
  assert.ok(o.gaps[1][0] > o.gaps[1][1]*3, "the deactivated seam is pulled by nothing: " + o.gaps[1][0] + " against " + o.gaps[1][1]);
  const th = Object.fromEntries(o.thread.map(t => [t[0], t.slice(1)]));
  assert.deepStrictEqual(th["t1:o"], ["LineDashedMaterial", "#ffffff", 1.5], "white and dotted in the 3D window: " + JSON.stringify(o.thread)); assert.ok(th["t2:b"] || th["t2:"], "the sewn seam keeps its own thread");      // (the threads' keys start with t since Round r14 / 8)
  assert.deepStrictEqual(o.undone, [false, false]); assert.deepStrictEqual(o.redone, [true, false]);
  assert.deepStrictEqual(o.inFile, [true, null]); assert.deepStrictEqual(o.opened[0], [true, false]); assert.deepStrictEqual(o.junk, [null, null]);
  assert.deepStrictEqual(o.on.slice(0, 3), [[false, false], "Seam S1 is sewn again", "Activate Sewing"]); assert.strictEqual(o.on[3].filter(x => /0.1 8/.test(x)).length, 0);
  assert.deepStrictEqual(o.zip, [1, 0]);
});

module.exports = T;
