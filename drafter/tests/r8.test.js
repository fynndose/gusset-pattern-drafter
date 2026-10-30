// Round 8: what the pattern's right-click menu gained. Batch 1: Order. Batch 2: the turns by 45 and 90 degrees
// and Reset Along Grain Direction. Batch 3: Delete Reference Line. Batch 4: Paste, the clone commands and Clone as
// Internal Shape hang on the pointer until a click sets them down. Batch 5: the pivot's visible state.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const S = { pieces: [], seams: [], sel: [], view: { s: 1, x: 0, y: 0 }, nextSegId: 1, nextShapeId: 1, nextId: 1 };
const G = load(["ORDER", "reorder", "frameLook"], { S });
const { ORDER, reorder, frameLook } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
// three 200 x 200 squares that overlap (A lowest, C on top) and one, D, out of the way
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const sq = (n, x, y) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+200,y:y},{x:x+200,y:y+200},{x:x,y:y+200}], true));
  S.pieces.push(sq("A", 100, 100), sq("B", 150, 150), sq("C", 200, 200), sq("D", 700, 100)); app.commit(); S.undo.length = 0;
  const at = (q) => app.toS(q), out = {}, byName = (n) => S.pieces.find(p => p.name === n), names = () => S.pieces.map(p => p.name).join("");
  const pts = (n) => byName(n).pts.map(q => [+q.x.toFixed(6), +q.y.toFixed(6)]);
  const menu = (n, item) => { const p = byName(n); S.sel = [p.id]; const s = at({ x: p.pts[0].x + 20, y: p.pts[0].y + 20 }); app.menuClick(s.x, s.y, item); };
  const rowsOf = (el) => el.children.map(c => c.className === "hd" ? "# " + (c.textContent || c.innerHTML) : c.className === "sep" ? "-" : c.innerHTML.replace(/<span class="k">(.*?)<.span>/, " [$1]").replace(/<[^>]*>/g, "").replace(/ \\[\\]$/, ""));
  const items = (n) => { const p = byName(n); S.sel = [p.id]; const s = at({ x: p.pts[0].x + 20, y: p.pts[0].y + 20 }); app.menu.children.length = 0; app.showMenu({ clientX: s.x, clientY: s.y }); return rowsOf(app.menu); };
  // (Round G1: Order, Rotate and the clones are submenus of the pattern's menu, as in W1) the rows of one, with its name as their title
  const subItems = (n, row) => { items(n); app.menu.children.find(c => c.innerHTML.includes("<span>" + row + "</span>")).onclick({ stopPropagation() {} }); const subs = app.ev("menuSubs"); return ["# " + row, ...rowsOf(subs[subs.length - 1])]; };
`;

/* ---------- batch 1: Order ---------- */
test("Order: to the front and the back, and one step past the next pattern that is shown and on the same layer", () => {
  const mk = (s) => [...s].map((n, k) => ({ id: k + 1, name: n, on: true, layer: 0 }));
  const run = (ps, ids, how) => reorder(ps, ids, how).map(p => p.name).join("");
  assert.deepStrictEqual(ORDER.map(o => o[1]), ["Bring Forward", "Bring to Front", "Send Backward", "Send to Back"]);
  let ps = mk("abcd");
  assert.strictEqual(run(ps, [1], "front"), "bcda"); assert.strictEqual(run(ps, [4], "back"), "dabc");
  assert.strictEqual(run(ps, [1], "forward"), "bacd"); assert.strictEqual(run(ps, [4], "backward"), "abdc");
  assert.strictEqual(run(ps, [4], "forward"), "abcd", "the top one has nowhere to go"); assert.strictEqual(run(ps, [1], "backward"), "abcd");
  assert.strictEqual(run(ps, [1, 2], "forward"), "cabd", "two together keep their order"); assert.strictEqual(run(ps, [3, 1], "front"), "bdac");
  assert.strictEqual(run(ps, [3, 4], "backward"), "acdb"); assert.strictEqual(run(ps, [3, 4], "forward"), "abcd");
  assert.strictEqual(ps.map(p => p.name).join(""), "abcd", "the list given is not changed");
  // a step goes past what is hidden or on another layer: those would show no change
  ps = mk("abcd"); ps[1].on = false;
  assert.strictEqual(run(ps, [1], "forward"), "bcad");
  ps = mk("abcd"); ps[2].layer = 1;
  assert.strictEqual(run(ps, [4], "backward"), "adbc", "d goes under b, the next one down on its own layer"); assert.strictEqual(run(ps, [3], "backward"), "abcd", "alone on its layer");
});

test("Order on the pattern's menu: four commands under their title, each one undo step; the layer number is left alone", () => {
  const r = boot({ script: DOC + `
    out.items = subItems("C", "Order");
    menu("C", "Order ▸ Send to Back"); out.back = [names(), S.undo.length, toasts[toasts.length-1]];
    // (150,150)-(200,200) is inside A and B only; (220,220) inside all three. Nothing selected: the list order decides
    S.sel = []; out.top = app.hit(at({ x: 290, y: 290 }).x, at({ x: 290, y: 290 }).y).p.name;
    menu("C", "Order ▸ Bring Forward"); out.fwd = names();
    menu("A", "Order ▸ Bring to Front"); out.front = names();
    menu("A", "Order ▸ Bring to Front"); out.again = [names(), S.undo.length, toasts[toasts.length-1]];
    menu("B", "Order ▸ Send Backward"); out.bwd = [names(), S.undo.length];
    out.layers = S.pieces.map(p => p.layer);
    app.undo(); app.undo(); app.undo(); app.undo(); out.undone = names();
    // a pattern on a higher layer stays over it, and the program says so
    byName("B").layer = 1; menu("A", "Order ▸ Bring to Front"); out.layered = [names(), toasts[toasts.length-1]];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.items, ["# Order", "Bring Forward", "Bring to Front", "Send Backward", "Send to Back"]);
  assert.strictEqual(o.back[0], "CABD"); assert.strictEqual(o.back[1], 1); assert.ok(/^Sent back/.test(o.back[2]), o.back[2]);
  assert.strictEqual(o.top, "B", "C went under: B is on top where all three overlap");
  assert.strictEqual(o.fwd, "ACBD"); assert.strictEqual(o.front, "CBDA");
  assert.deepStrictEqual(o.again, ["CBDA", 3, "Already in front on its layer"], "nothing to do leaves no undo step");
  assert.deepStrictEqual(o.bwd, ["BCDA", 4]); assert.deepStrictEqual(o.layers, [0, 0, 0, 0]);
  assert.strictEqual(o.undone, "ABCD");
  assert.strictEqual(o.layered[0], "BCDA"); assert.ok(/higher layer stay over it/.test(o.layered[1]), o.layered[1]);
});

/* ---------- batch 2: Rotate ---------- */
test("Rotate: 45 and 90 degrees both ways on Ctrl + the arrow keys and on the menu, about the middle or the pivot, one undo step each", () => {
  const r = boot({ script: DOC + `
    app.setTool("transform_pattern");
    out.items = subItems("A", "Rotate"); out.old = items("A").includes("Rotate 90\\u00b0");
    S.sel = [byName("A").id];
    app.key("ArrowRight", { ctrlKey: true }); out.cw45 = [pts("A")[0], S.undo.length];
    app.key("ArrowLeft", { ctrlKey: true }); out.back = [pts("A"), S.undo.length];
    app.key("ArrowDown", { ctrlKey: true }); out.cw90 = pts("A");
    app.key("ArrowUp", { ctrlKey: true }); app.key("ArrowUp", { ctrlKey: true }); out.ccw90 = pts("A");
    out.steps = app.histSteps().steps.map(s => s.n);
    while (S.undo.length) app.undo();
    // from the menu, and two patterns as one: about the middle of the box round both
    S.sel = [byName("A").id, byName("D").id]; { const s = at({ x: 120, y: 120 }); app.menuClick(s.x, s.y, "Rotate ▸ Clockwise (90\\u00b0)"); }
    out.two = [pts("A")[0], pts("D")[0], S.undo.length]; app.undo();
    // about the pivot when there is one
    S.sel = [byName("A").id]; S.pivot = { x: 100, y: 100 }; app.key("ArrowDown", { ctrlKey: true }); out.pivot = pts("A"); app.undo();
    // not with another tool in hand, and not with Shift or Alt
    S.pivot = null; app.key("ArrowDown", { ctrlKey: true, shiftKey: true }); app.setTool("edit_pattern"); S.sel = [byName("A").id]; app.key("ArrowDown", { ctrlKey: true });
    out.other = [pts("A")[0], S.undo.length];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, h = 100*Math.SQRT2;
  assert.deepStrictEqual(o.items, ["# Rotate", "Reset Along Grain Direction", "-", "Clockwise (45°) [Ctrl+Right]", "Clockwise (90°) [Ctrl+Down]", "Counterclockwise (45°) [Ctrl+Left]", "Counterclockwise (90°) [Ctrl+Up]", "-",
    "X-Axis", "Y-Axis", "Parallel to…"], "W1's Rotate submenu");      // (X-Axis and Y-Axis built in Round r13 / 5, Parallel to… in Round r17b / 1)
  assert.strictEqual(o.old, false, "the one Rotate 90° gave way to these");
  near(o.cw45[0][0], 200, 1e-6, "the top left corner of a square about (200,200) goes to the top"); near(o.cw45[0][1], 200 - h, 1e-6); assert.strictEqual(o.cw45[1], 1);
  near(o.back[0][0][0], 100, 1e-6); near(o.back[0][0][1], 100, 1e-6); assert.strictEqual(o.back[1], 2);
  assert.deepStrictEqual(o.cw90, [[300, 100], [300, 300], [100, 300], [100, 100]], "a quarter turn clockwise, exact");
  assert.deepStrictEqual(o.ccw90, [[100, 300], [100, 100], [300, 100], [300, 300]], "and two the other way");
  assert.deepStrictEqual(o.steps, ["Clockwise (45°)", "Counterclockwise (45°)", "Clockwise (90°)", "Counterclockwise (90°)", "Counterclockwise (90°)"]);
  // A (100..300) and D (700..900 by 100..300): the box is 100..900 by 100..300, its middle (500,200)
  assert.deepStrictEqual(o.two, [[600, -200], [600, 400], 1], "both turned as one, in one step");
  assert.deepStrictEqual(o.pivot, [[100, 100], [100, 300], [-100, 300], [-100, 100]], "about the pivot");
  assert.deepStrictEqual(o.other, [[100, 100], 0]);
});

test("Reset Along Grain Direction: each selected pattern is turned about its own middle until its grainline is upright", () => {
  const r = boot({ script: DOC + `
    const A = byName("A"), D = byName("D"), mid = (n) => { const b = app.bboxOf([byName(n)]); return [(b.x0+b.x1)/2, (b.y0+b.y1)/2]; };
    // a pattern with no grainline of its own has an upright one: nothing to do
    { const p = byName("B"); S.sel = [p.id]; const s = at({ x: 175, y: 325 }); app.menuClick(s.x, s.y, "Rotate ▸ Reset Along Grain Direction"); }
    out.plain = [S.undo.length, pts("B")[0], toasts[toasts.length-1]];
    A.grain = { a: { x: 150, y: 280 }, b: { x: 250, y: 120 } }; D.grain = { a: { x: 800, y: 250 }, b: { x: 760, y: 150 } }; app.commit();
    out.before = [app.grainAngle(app.grainOf(A)), app.grainAngle(app.grainOf(D))];
    S.sel = [A.id, D.id]; { const s = at({ x: 120, y: 120 }); app.menuClick(s.x, s.y, "Rotate ▸ Reset Along Grain Direction"); }
    out.after = [app.grainAngle(app.grainOf(A)), app.grainAngle(app.grainOf(D)), S.undo.length];
    out.mids = [mid("A"), mid("D")]; out.side = [app.segLen(A, 0), app.segLen(D, 0)]; out.up = A.grain.b.y < A.grain.a.y;
    { const s = at({ x: 130, y: 200 }); S.sel = [A.id]; app.menuClick(s.x, s.y, "Rotate ▸ Reset Along Grain Direction"); }
    out.again = [S.undo.length, toasts[toasts.length-1]];
    app.undo(); out.undone = [pts("A")[0], app.grainAngle(app.grainOf(byName("A")))];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.ok(Math.abs(o.before[0]) > 20 && Math.abs(o.before[1]) > 20 && o.before[0]*o.before[1] < 0, "one leans each way: " + o.before);
  near(o.after[0], 0, 1e-9); near(o.after[1], 0, 1e-9); assert.strictEqual(o.after[2], 1, "both in one step");
  near(o.mids[0][0], 200, 1e-6, "A stays about its own middle"); near(o.mids[0][1], 200, 1e-6); near(o.mids[1][0], 800, 1e-6); near(o.mids[1][1], 200, 1e-6);
  near(o.side[0], 200, 1e-9, "turned, not scaled"); near(o.side[1], 200, 1e-9); assert.strictEqual(o.up, true, "the grainline still points the way it did");
  assert.deepStrictEqual(o.again, [1, "Already along the grain"]); assert.deepStrictEqual(o.plain, [0, [150, 150], "Already along the grain"]);
  assert.deepStrictEqual(o.undone[0], [100, 100]); near(o.undone[1], o.before[0], 1e-9);
});

/* ---------- batch 3: Delete Reference Line ---------- */
test("Delete Reference Line is on the pattern's menu once the pattern has one: it takes the reference lines and leaves other baselines", () => {
  const r = boot({ script: DOC + `
    const D = byName("D");
    app.addChild(D, "bases", app.mkShape([{ x: 720, y: 120 }, { x: 880, y: 280 }], false)); app.commit(); S.undo.length = 0;
    out.before = items("D").includes("Delete Reference Line");
    menu("D", "Clone as Reference Line"); menu("D", "Clone as Reference Line");
    out.made = D.bases.map(b => !!b.ref);
    const all = items("D"), k = all.indexOf("Clone as Reference Line"); out.next = all[k + 1];
    out.others = items("A").includes("Delete Reference Line");
    menu("D", "Delete Reference Line");
    out.left = [byName("D").bases.map(b => !!b.ref), S.undo.length, toasts[toasts.length-1], items("D").includes("Delete Reference Line")];
    app.undo(); out.undone = byName("D").bases.length;
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.before, false, "not offered while there is none"); assert.deepStrictEqual(o.made, [false, true, true]);
  assert.strictEqual(o.next, "Delete Reference Line", "right under Clone as Reference Line"); assert.strictEqual(o.others, false, "only on the pattern that has one");
  assert.deepStrictEqual(o.left, [[false], 3, "2 reference lines deleted", false]); assert.strictEqual(o.undone, 3);
});

/* ---------- batch 4: set down by a click ---------- */
// world places for the pointer; hang() = what hangs on the pointer and what the document looks like meanwhile
const PLACE = `
  const move = (x, y) => { const s = at({ x, y }); app.fire("pointermove", { x: s.x, y: s.y }); };
  const click = (x, y) => { const s = at({ x, y }); app.click(s.x, s.y); };
  const hang = () => [!!S.place, S.pieces.length, S.undo.length];
  const last = () => S.pieces[S.pieces.length - 1], r6 = (v) => +v.toFixed(6), lpts = (p) => p.pts.map(q => [r6(q.x), r6(q.y)]);
`;
test("Paste and Mirror Paste hang on the pointer: a click sets the copy down there in one undo step, Esc gives it up (a right-click opens the box for several in a row since Round r13)", () => {
  const r = boot({ script: DOC + PLACE + `
    const A = byName("A");
    S.sel = [A.id]; app.key("c", { ctrlKey: true }); app.key("v", { ctrlKey: true });
    move(600, 500); out.hung = [hang(), app.cv.style.cursor, S.place.shapes.length];
    click(600, 500); out.down = [hang(), last().name, lpts(last()), S.sel.length === 1 && S.sel[0] === last().id, app.histSteps().steps.map(s => s.n)];
    app.undo(); out.undone = S.pieces.length;
    // Esc, and a right-click: nothing was changed, and no menu opens. (Round r13 / 6: the right-click opens the box for several
    // in a row, as the reference has it, and the copy stays on the pointer; Esc still gives it up)
    app.key("v", { ctrlKey: true }); move(600, 500); app.key("Escape"); out.esc = hang();
    app.key("v", { ctrlKey: true }); move(600, 500); { const s = at({ x: 130, y: 130 }); app.fire("contextmenu", { x: s.x, y: s.y }); } out.right = [hang(), app.menu.style.display === "block", /Number of Shapes/.test(app.el("dlg").innerHTML)];
    app.ev("hideDlg")(); app.key("Escape");
    // Shift keeps it level with where it came from
    app.key("v", { ctrlKey: true }); S.shift = true; click(500, 230); S.shift = false; out.level = lpts(last())[0]; app.undo();
    // Mirror Paste: mirrored where it is, then moved. F's right side is the long one
    const F = app.mkPiece("F", app.mkShape([{x:1000,y:100},{x:1100,y:100},{x:1100,y:300},{x:1000,y:200}], true)); S.pieces.push(F); app.commit(); S.undo.length = 0;
    S.sel = [F.id]; app.key("c", { ctrlKey: true }); app.key("r", { ctrlKey: true }); out.mhung = hang();
    click(1050, 500); out.mirror = [last().name, lpts(last()), S.undo.length, app.histSteps().steps.map(s => s.n)];
    app.undo();
    // two patterns copied: they are set down as they lie to each other
    S.sel = [A.id, byName("D").id]; app.key("c", { ctrlKey: true }); app.key("v", { ctrlKey: true }); click(500, 700);
    const n = S.pieces.length; out.two = [S.pieces[n-2].name, lpts(S.pieces[n-2])[0], S.pieces[n-1].name, lpts(S.pieces[n-1])[0], S.undo.length, S.sel.length];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.hung, [[true, 4, 0], "copy", 1], "on the pointer: nothing in the document yet, no undo step");
  assert.deepStrictEqual(o.down, [[false, 5, 1], "A copy", [[500, 400], [700, 400], [700, 600], [500, 600]], true, ["Paste"]], "its middle is where the click was");
  assert.strictEqual(o.undone, 4);
  assert.deepStrictEqual(o.esc, [false, 4, 0]); assert.deepStrictEqual(o.right, [[true, 4, 0], false, true]);      // (Round r13 / 6)
  assert.deepStrictEqual(o.level, [400, 100], "300 across and not down");
  assert.deepStrictEqual(o.mhung, [true, 5, 0]);
  assert.deepStrictEqual(o.mirror, ["F ⇄", [[1100, 400], [1000, 400], [1000, 600], [1100, 500]], 1, ["Mirror Paste"]], "mirrored: the long side is now on the left; 300 further down");
  // A (100..300) and D (700..900): the middle of both is (500,200), so a click at (500,700) is 500 down
  assert.deepStrictEqual(o.two, ["A copy", [100, 600], "D copy", [700, 600], 1, 2]);
});

test("the clone commands hang on the pointer too: Symmetric Pattern, Instance Pattern, Layer Clone and Ctrl+D are linked where the click sets them down", () => {
  const r = boot({ script: DOC + PLACE + `
    const D = byName("D"), m6 = () => last().link.m.map(r6);
    menu("D", "Clone with Linked Editing ▸ Symmetric Pattern"); move(800, 600); out.hung = hang();
    click(800, 600); out.sym = [hang(), last().name, last().link.kind, last().link.of === D.id, m6(), /^Linked/.test(toasts[toasts.length-1])];
    menu("D", "Clone with Linked Editing ▸ Instance Pattern"); click(1100, 200); out.inst = [last().name, last().link.kind, m6(), lpts(last())[0]];
    menu("D", "Layer Clone ▸ Under"); click(820, 220); out.under = [last().name, last().layer, m6()];
    S.sel = [D.id]; app.key("d", { ctrlKey: true }); out.keyHung = hang(); app.key("Escape"); out.esc = hang();
    S.sel = [D.id]; app.key("d", { ctrlKey: true }); click(800, 900);
    out.steps = app.histSteps().steps.map(s => s.n);
    // the copies follow their source from where they were put
    D.pts[1] = { x: 950, y: 100 }; app.commit(); out.follow = [lpts(S.pieces[4])[1], lpts(S.pieces[5])[1]];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.hung, [true, 4, 0]);
  // D is 700..900 by 100..300: mirrored in x = 800 (x to 1600 - x), then 400 down
  assert.deepStrictEqual(o.sym, [[false, 5, 1], "D ⇄", "symmetric", true, [-1, 0, 0, 1, 1600, 400], true]);
  assert.deepStrictEqual(o.inst, ["D ≡", "instance", [1, 0, 0, 1, 300, 0], [1000, 100]]);
  assert.deepStrictEqual(o.under, ["D (under)", -1, [1, 0, 0, 1, 20, 20]]);
  assert.deepStrictEqual(o.keyHung, [true, 7, 3]); assert.deepStrictEqual(o.esc, [false, 7, 3]);
  assert.deepStrictEqual(o.steps, ["Symmetric Pattern", "Instance Pattern", "Layer Clone (Under)", "Symmetric Pattern"]);
  assert.deepStrictEqual(o.follow, [[650, 500], [1250, 100]], "the mirrored copy and the instance both took the moved point");
});

test("Clone as Internal Shape hangs on the pointer and goes into the pattern that is clicked; a click outside every pattern says so and keeps it", () => {
  const r = boot({ script: DOC + PLACE + `
    const A = byName("A"), D = byName("D");
    menu("D", "Clone as Internal Shape"); out.hung = [hang(), S.place.inside];
    click(1500, 900); out.outside = [hang(), toasts[toasts.length-1]];
    click(130, 130);                                             // inside A only
    out.inA = [hang(), A.internals.length, D.internals.length, lpts(A.internals[0]), A.internals[0].closed, S.sel[0] === A.id, S.selKind, S.selInt];
    out.ids = [A.internals[0].id > 0, A.internals[0].segs.map(s => s.id).join() === D.segs.map(s => s.id).join()];
    // into itself, where it is: on its own outline, as the command used to do
    menu("D", "Clone as Internal Shape"); click(800, 200); out.self = [D.internals.length, lpts(D.internals[0]), S.undo.length];
    menu("D", "Clone as Internal Shape"); app.key("Escape"); out.esc = [hang(), D.internals.length];
    app.undo(); app.undo(); out.undone = [A.id && byName("A").internals.length, byName("D").internals.length];
    app.checkDoc(S.pieces, S.seams);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.hung, [[true, 4, 0], true]);
  assert.deepStrictEqual(o.outside, [[true, 4, 0], "Click within a pattern"]);
  assert.deepStrictEqual(o.inA, [[false, 4, 1], 1, 0, [[30, 30], [230, 30], [230, 230], [30, 230]], true, true, "internal", 0], "D's outline, its middle where the click was, as an internal shape of A");
  assert.deepStrictEqual(o.ids, [true, true]);
  assert.deepStrictEqual(o.self, [1, [[700, 100], [900, 100], [900, 300], [700, 300]], 2]);
  assert.deepStrictEqual(o.esc, [[false, 4, 2], 1]); assert.deepStrictEqual(o.undone, [0, 0]);
});

/* ---------- batch 5: the pivot ---------- */
test("the pivot shows by shape and fill, not by colour: rings and a ring while it is off, filled squares and a filled diamond while it is on", () => {
  const off = frameLook(false), on = frameLook(true);
  assert.strictEqual(off.square, false); assert.strictEqual(on.square, true, "the handles change shape");
  assert.strictEqual(off.fill, "#ffffff"); assert.strictEqual(on.fill, "#3a3a3a", "and go from empty to filled: light against dark, which no colour blindness hides");
  assert.notStrictEqual(off.mark, on.mark, "the centre mark changes shape too");
});

test("the pivot: a double-click on the centre mark switches it on and off, the mark is then dragged without Alt, Alt+drag still works, and none of it is an undo step", () => {
  const r = boot({ script: DOC + PLACE + `
    app.setTool("transform_pattern");
    const D = byName("D"), A = byName("A"), dbl = (x, y) => { click(x, y); click(x, y); const s = at({ x, y }); app.fire("dblclick", { x: s.x, y: s.y }); };
    const drag = (x0, y0, x1, y1, e) => { const a = at({ x: x0, y: y0 }), b = at({ x: x1, y: y1 }); app.drag(a.x, a.y, b.x, b.y, e); app.fire("pointerup", { x: b.x, y: b.y }); };
    const piv = () => S.pivot && [r6(S.pivot.x), r6(S.pivot.y)];
    S.sel = [D.id]; out.start = piv();
    dbl(800, 200); out.on = [piv(), S.sel.length === 1 && S.sel[0] === D.id, S.undo.length, /^Pivot on/.test(toasts[toasts.length-1])];
    drag(800, 200, 700, 100); out.dragged = [piv(), pts("D")[0], S.undo.length];
    app.key("ArrowDown", { ctrlKey: true }); out.turned = [pts("D"), S.undo.length]; app.undo();
    dbl(700, 100); out.off = [piv(), /^Pivot off/.test(toasts[toasts.length-1]), S.undo.length];
    // off: a drag that starts on the centre mark moves the pattern, and a double-click elsewhere in it does nothing to the pivot
    drag(800, 200, 830, 240); out.moved = [pts("D")[0], piv(), S.undo.length]; app.undo();
    dbl(760, 160); out.elsewhere = piv();
    // Alt+drag moves the mark straight away, as it always did
    { const a = at({ x: 800, y: 200 }), b = at({ x: 850, y: 250 }); app.fire("pointerdown", { x: a.x, y: a.y, altKey: true }); out.altKind = S.drag.k; app.fire("pointermove", { x: b.x, y: b.y, altKey: true }); app.fire("pointerup", { x: b.x, y: b.y }); }
    out.alt = [piv() !== null, pts("D")[0], S.undo.length];
    // B and C lie over A's middle: a double-click on A's centre mark still leaves A the selected one
    S.sel = [A.id]; S.pivot = null; dbl(200, 200); out.under = [S.sel.length === 1 && S.sel[0] === A.id, piv()];
    // another pattern picked, or another tool: the pivot is forgotten
    click(800, 150); out.other = piv();
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.start, null);
  assert.deepStrictEqual(o.on, [[800, 200], true, 0, true], "on, at the middle; the pattern stays selected");
  assert.deepStrictEqual(o.dragged, [[700, 100], [700, 100], 0], "the mark went to the corner (it catches points); the pattern did not move");
  assert.deepStrictEqual(o.turned, [[[700, 100], [700, 300], [500, 300], [500, 100]], 1], "a quarter turn about the pivot");
  assert.deepStrictEqual(o.off, [null, true, 0]);
  assert.deepStrictEqual(o.moved, [[730, 140], null, 1]); assert.strictEqual(o.elsewhere, null);
  assert.strictEqual(o.altKind, "pivot"); assert.deepStrictEqual(o.alt, [true, [700, 100], 0]);
  assert.deepStrictEqual(o.under, [true, [200, 200]]);
  assert.strictEqual(o.other, null);
});

module.exports = T;
