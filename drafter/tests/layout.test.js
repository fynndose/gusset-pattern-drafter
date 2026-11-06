// Roadmap 2, batch 7: Print Layout. The layout's settings, where copies lie, turning a
// pattern, the nesting (nothing overlaps, the gap is kept, the grain setting is obeyed,
// the strip is not left), the consumption figures, and the mode in the booted app.
"use strict";
const { oldSizeRun } = require("./harness");      // (Round r33 / 4) the size run every document had before r33: a document starts with none since (harness.js)
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const S = { pieces: [], seams: [], stitches: [], images: [], sel: [], show: {}, ui: { render: "front" }, lib: null, layout: null, print: null, unit: "mm", dec: 1,
  nextSegId: 1, nextShapeId: 1, nextId: 1, undo: [], redo: [], notch: { type: "I", len: 5, color: "#000", width: 1, dup: false } };
const G = load(["V", "mkShape", "rectShape", "mkPiece", "normLayout", "layoutOf", "layoutSheet", "layoutOutline", "turnPoly", "placeMap", "layoutCopies", "defaultPlaces", "layoutSync",
  "layoutPieces", "nestMask", "nestPack", "nestLayout", "layoutStats", "layoutJob", "layoutPrintSt", "GRAINS", "PAPERS", "printDefault", "normLib", "defaultGrading",
  "signedArea", "inside", "docJSON", "loadDoc", "snap", "unsnap", "cutLine", "dist"],
  { S, esc: (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])), ui: () => {}, draw: () => {}, drawLayout: () => {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
const { V, mkShape, mkPiece, normLayout, layoutOf, layoutSheet, turnPoly, placeMap, layoutCopies, defaultPlaces, layoutSync, layoutPieces, nestMask, nestPack, nestLayout, layoutStats, layoutJob,
  printDefault, normLib, defaultGrading, signedArea, inside, docJSON, loadDoc, snap, unsnap, dist } = G;

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= (tol ?? 1e-6), (msg || "") + " expected " + b + ", got " + a);
function reset() {
  S.pieces = []; S.seams = []; S.stitches = []; S.images = []; S.sel = []; S.lib = normLib(null); S.layout = normLayout(null); S.print = printDefault();
  S.nextSegId = 1; S.nextShapeId = 1; S.nextId = 1; S.grading = oldSizeRun(); S.undo = []; S.redo = [];
}
const poly = (pts) => pts.map(([x, y]) => V(x, y));
function add(name, pts, qty) { const p = mkPiece(name, mkShape(poly(pts), true)); p.quantity = qty || 1; S.pieces.push(p); return p; }
const rect = (name, x, y, w, h, qty) => add(name, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], qty);
// the smallest distance between two polygons' outlines (0 if they cross or one holds the other)
function segDist(a, b, c, d) {
  const pd = (p, u, v) => { const l = dist(u, v) ** 2 || 1, t = Math.max(0, Math.min(1, ((p.x - u.x)*(v.x - u.x) + (p.y - u.y)*(v.y - u.y))/l)); return dist(p, V(u.x + (v.x - u.x)*t, u.y + (v.y - u.y)*t)); };
  const o = (p, q, r) => Math.sign((q.x - p.x)*(r.y - p.y) - (q.y - p.y)*(r.x - p.x));
  if (o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b)) return 0;
  return Math.min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b));
}
function polyDist(A, B) {
  if (inside(A, B[0]) || inside(B, A[0])) return 0;
  let m = Infinity;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) m = Math.min(m, segDist(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length]));
  return m;
}
function minGap(ps) { let m = Infinity; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) m = Math.min(m, polyDist(ps[i].poly, ps[j].poly)); return m; }

test("layout settings: defaults, and junk falls back to them", () => {
  const d = normLayout(null);
  assert.deepStrictEqual([d.paper, d.orient, d.cols, d.grain, d.gap, d.outline, d.pairs, d.lock], ["a4", "portrait", 3, "1way", 5, "sa", true, false]);
  const j = normLayout({ paper: "nope", orient: 7, cols: "x", grain: "sideways", gap: -4, margin: 900, place: { "3:0": { x: 1, y: 2, rot: 45, flip: 1 }, "bad": { x: 1, y: 1 }, "4:1": { x: "a", y: 0 } } });
  assert.deepStrictEqual([j.paper, j.orient, j.cols, j.grain, j.gap, j.margin], ["a4", "portrait", 3, "1way", 0, 50]);
  assert.deepStrictEqual(j.place, { "3:0": { x: 1, y: 2, rot: 0, flip: false } }, "a bad turn becomes none; bad keys and places are dropped");
  assert.strictEqual(normLayout({ paper: "full" }).paper, "a4", "the one-sheet paper of the print dialog is not a layout paper");
});

test("the layout's width: sheets across less their overlaps; a roll is one sheet wide", () => {
  reset();
  S.layout = normLayout({ paper: "a4", cols: 3, margin: 10, overlap: 10 });
  let s = layoutSheet();
  near(s.iw, 190); near(s.ih, 277); near(s.width, 3*180 + 10);
  S.layout = normLayout({ paper: "a4", orient: "landscape", cols: 2, margin: 5, overlap: 0 });
  s = layoutSheet(); near(s.iw, 287); near(s.width, 574);
  S.layout = normLayout({ paper: "roll36", cols: 5, margin: 0 });
  s = layoutSheet(); assert.ok(s.roll); assert.strictEqual(s.cols, 1); near(s.width, 914.4, 0.01);
});

test("a copy for every piece to cut; every second one mirrored if pairs is on", () => {
  reset(); rect("A", 0, 0, 100, 50, 3); rect("B", 200, 0, 40, 40, 1); S.pieces[1].on = true;
  let c = layoutCopies();
  assert.deepStrictEqual(c.map(x => x.key), ["1:0", "1:1", "1:2", "2:0"]);
  assert.deepStrictEqual(c.map(x => x.pair), [false, true, false, false]);
  S.layout.pairs = false; assert.ok(layoutCopies().every(x => !x.pair));
  S.pieces[1].on = false; assert.strictEqual(layoutCopies().length, 3, "a hidden pattern is not laid out");
});

test("turning a polygon: quarter turns and the mirror keep its size and area", () => {
  const L = poly([[0, 0], [100, 0], [100, 20], [30, 20], [30, 60], [0, 60]]), a0 = Math.abs(signedArea(L));
  for (const rot of [0, 90, 180, 270]) for (const flip of [false, true]) {
    const t = turnPoly(L, rot, flip).pts, w = Math.max(...t.map(q => q.x)), h = Math.max(...t.map(q => q.y));
    near(Math.min(...t.map(q => q.x)), 0); near(Math.min(...t.map(q => q.y)), 0);
    near(w, rot % 180 ? 60 : 100, 1e-6); near(h, rot % 180 ? 100 : 60, 1e-6);
    near(Math.abs(signedArea(t)), a0, 1e-6);
    assert.strictEqual(Math.sign(signedArea(t)), (flip ? -1 : 1)*Math.sign(signedArea(L)), "a mirror turns the winding over, a turn does not");
  }
  const t = turnPoly(L, 180, false).pts;
  near(t[0].x, 100); near(t[0].y, 60);
});

test("a placed copy: the pattern itself is untouched, and its lines keep their lengths", () => {
  reset(); const p = add("A", [[50, 50], [250, 60], [240, 300], [40, 280]]); p.segs[0].sa = 10;
  const before = JSON.stringify(p);
  S.layout.place = { "1:0": { x: 30, y: 40, rot: 180, flip: true } };
  const [x] = layoutPieces();
  assert.strictEqual(JSON.stringify(p), before);
  near(Math.min(...x.poly.map(q => q.x)), 30, 1e-6); near(Math.min(...x.poly.map(q => q.y)), 40, 1e-6);
  for (let i = 0; i < 4; i++) near(dist(x.piece.pts[i], x.piece.pts[(i + 1) % 4]), dist(p.pts[i], p.pts[(i + 1) % 4]), 1e-6);
  assert.strictEqual(x.piece.segs[0].sa, 10);
  const f = placeMap(p, S.layout.place["1:0"]), q = f(p.pts[2]);
  near(q.x, x.piece.pts[2].x, 1e-9); near(q.y, x.piece.pts[2].y, 1e-9);
});

test("with nothing placed the copies lie as the patterns do in the 2D window", () => {
  reset(); rect("A", 100, 200, 100, 50, 2); rect("B", 400, 260, 40, 40);
  const ps = layoutPieces(), a = ps[0].poly, b = ps[2].poly;
  near(Math.min(...a.map(q => q.x)), 0); near(Math.min(...a.map(q => q.y)), 0);
  near(Math.min(...b.map(q => q.x)), 300); near(Math.min(...b.map(q => q.y)), 60);
  assert.ok(Math.min(...ps[1].poly.map(q => q.y)) >= 100, "the second copy of A lies under everything");
  const row = defaultPlaces(layoutCopies(), "row");
  assert.deepStrictEqual(Object.values(row).map(q => q.y), [0, 0, 0]);
  assert.ok(row["1:1"].x >= 100 && row["2:0"].x >= row["1:1"].x + 100);
});

test("a new pattern, a raised quantity and a deleted pattern keep the others where they are", () => {
  reset(); rect("A", 0, 0, 100, 50); rect("B", 200, 0, 40, 40);
  layoutSync(); S.layout.place["1:0"] = { x: 77, y: 88, rot: 0, flip: false };
  S.pieces[0].quantity = 2; rect("C", 0, 300, 30, 30);
  layoutSync();
  assert.deepStrictEqual(S.layout.place["1:0"], { x: 77, y: 88, rot: 0, flip: false });
  assert.ok(S.layout.place["1:1"] && S.layout.place["3:0"]);
  assert.ok(S.layout.place["1:1"].y > 88 + 50, "new copies go underneath what is there");
  assert.ok(minGap(layoutPieces()) > 0, "and not onto each other");
  S.pieces.splice(1, 1); layoutSync();
  assert.strictEqual(S.layout.place["2:0"], undefined);
});

test("the nesting grid: a square takes its own cells plus the gap around it", () => {
  const m = nestMask(poly([[0, 0], [40, 0], [40, 40], [0, 40]]), 10, 0);
  assert.strictEqual(m.w, 4); assert.strictEqual(m.h, 4);
  assert.ok(m.rows.every(r => r === 0b1111n));
  const g = nestMask(poly([[0, 0], [40, 0], [40, 40], [0, 40]]), 10, 5);
  assert.strictEqual(g.w, 5, "5 mm either side");
  const tri = nestMask(poly([[0, 0], [100, 0], [0, 100]]), 10, 0);
  assert.ok(tri.rows[0] > tri.rows[9], "a triangle's grid narrows");
  assert.strictEqual(tri.rows[9] >> 9n & 1n, 0n, "the far corner of its box is free");
});

test("nesting rectangles: all on the strip, none overlapping, the gap kept", () => {
  const items = [];
  for (let i = 0; i < 12; i++) items.push({ key: "k" + i, poly: poly([[0, 0], [60 + 17*(i % 4), 0], [60 + 17*(i % 4), 40 + 23*(i % 3)], [0, 40 + 23*(i % 3)]]) });
  const r = nestPack(items, 400, { gap: 6, rots: [0] });
  const placed = items.map(it => { const pl = r.place[it.key]; assert.ok(pl, it.key + " placed"); return { poly: it.poly.map(q => V(q.x + pl.x, q.y + pl.y)) }; });
  for (const x of placed) for (const q of x.poly) assert.ok(q.x >= -1e-9 && q.x <= 400 + 1e-9 && q.y >= -1e-9 && q.y <= r.length + 1e-9, "inside the strip");
  assert.ok(minGap(placed) >= 6 - 1e-6, "gap " + minGap(placed));
  const area = items.reduce((s, it) => s + Math.abs(signedArea(it.poly)), 0);
  assert.ok(r.length < area/400*1.75, "length " + r.length + " for " + (area/400).toFixed(0) + " of cloth: not wasteful");
});

test("nesting tucks one shape into the hollow of another", () => {
  // two L shapes of 100 x 100 with a 60 x 60 corner missing: with half turns allowed they interlock
  const L = [[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]];
  const one = nestPack([{ key: "a", poly: poly(L) }, { key: "b", poly: poly(L) }], 150, { gap: 0, rots: [0, 180], cell: 5 });
  const none = nestPack([{ key: "a", poly: poly(L) }, { key: "b", poly: poly(L) }], 150, { gap: 0, rots: [0], cell: 5 });
  assert.ok(one.length <= 145, "interlocked: " + one.length);
  assert.ok(one.length < none.length || none.length <= 145, "turning helps (" + one.length + " against " + none.length + ")");
  const turned = Object.values(one.place).filter(q => q.rot === 180).length;
  assert.ok(turned >= 1 || one.length <= 145);
});

test("grain direction: 1-way never turns, 2-way only by half turns, Any may lie across", () => {
  reset(); rect("Long", 0, 0, 500, 60, 3);
  S.layout = normLayout({ paper: "custom", customW: 220, customH: 2000, cols: 1, margin: 10, overlap: 0, gap: 5, pairs: false, grain: "1way" });
  const note = nestLayout();
  // (Round r19 / H26: a pattern wider than the sheets across raises Sheets across before nesting, so it fits; it used to be left
  // underneath with "wider than the layout". 500 mm + 2 × 5 spacing on 200 mm sheets: 3 across)
  assert.ok(/Sheets across raised to 3/.test(note) && !/wider than the layout/.test(note), "a 500 mm pattern on a 200 mm sheet: " + note);
  assert.strictEqual(S.layout.cols, 3);
  assert.ok(Object.values(S.layout.place).every(q => q.rot === 0));
  S.layout.grain = "2way"; nestLayout();
  assert.ok(Object.values(S.layout.place).every(q => q.rot === 0 || q.rot === 180));
  S.layout.grain = "any"; S.layout.cols = 1;      // (r19 / H26: back to one sheet, where only a quarter turn makes it fit: no sheets added for Any)
  assert.strictEqual(nestLayout(), "");
  assert.ok(Object.values(S.layout.place).every(q => q.rot === 90 || q.rot === 270), "turned across to fit");
  const st = layoutStats();
  assert.ok(!st.over && st.length <= 505, "length " + st.length);
});

test("nesting real patterns: seam allowance kept clear, every copy inside, mirrored pairs", () => {
  reset();
  const a = add("Front", [[0, 0], [220, 20], [260, 180], [240, 520], [10, 500]], 2), b = add("Sleeve", [[400, 0], [560, 40], [600, 300], [380, 320]], 2); rect("Cuff", 0, 700, 240, 70, 2);
  a.segs.forEach(s => { s.sa = 10; }); b.segs.forEach(s => { s.sa = 10; });
  S.layout = normLayout({ paper: "roll36", margin: 0, gap: 8, grain: "2way" });
  assert.strictEqual(nestLayout(), "");
  const ps = layoutPieces(), st = layoutStats();
  assert.strictEqual(ps.length, 6);
  for (const x of ps) for (const q of x.poly) assert.ok(q.x >= -1e-6 && q.x <= st.width + 1e-6 && q.y >= -1e-6, "on the roll");
  assert.ok(minGap(ps) >= 8 - 1e-6, "cut lines stay " + minGap(ps).toFixed(2) + " apart");
  assert.ok(!st.over);
  assert.deepStrictEqual(ps.map(x => S.layout.place[x.key].flip), [false, true, false, true, false, true]);
  // the cut line is what is kept clear: it is bigger than the seam line
  assert.ok(Math.abs(signedArea(ps[0].poly)) > Math.abs(signedArea(a.pts)) + 1000);
  S.layout.outline = "seam";
  near(Math.abs(signedArea(layoutPieces()[0].poly)), Math.abs(signedArea(a.pts)), 1);
});

test("consumption and wastage: placed area over width times length", () => {
  reset(); rect("A", 0, 0, 100, 200); rect("B", 300, 0, 100, 200);
  S.layout = normLayout({ paper: "custom", customW: 400, customH: 1000, cols: 1, margin: 0, overlap: 0, gap: 0 });
  S.layout.place = { "1:0": { x: 0, y: 0, rot: 0, flip: false }, "2:0": { x: 100, y: 0, rot: 0, flip: false } };
  let st = layoutStats();
  near(st.width, 400); near(st.length, 200); near(st.placed, 40000); near(st.use, 50); near(st.waste, 50);
  assert.deepStrictEqual([st.count, st.patterns, st.rows, st.sheets, st.over], [2, 2, 1, 1, false]);
  S.layout.place["2:0"].x = 350; st = layoutStats(); assert.ok(st.over, "a pattern past the right edge is reported");
  S.layout.place["2:0"] = { x: 0, y: 1500, rot: 0, flip: false }; st = layoutStats();
  near(st.length, 1700); assert.strictEqual(st.rows, 2, "1700 mm needs two 1000 mm sheets");
});

test("the print job is the arrangement: sheets from the layout's corner, patterns where they lie", () => {
  reset(); const p = rect("A", 500, 500, 100, 150); p.segs.forEach(s => { s.sa = 10; });
  S.layout = normLayout({ paper: "a4", cols: 2, margin: 10, overlap: 10, name: "Shirt" });
  S.layout.place = { "1:0": { x: 200, y: 20, rot: 0, flip: false } };
  const job = layoutJob();
  assert.ok(job && job.plan.scale === 1, "actual size");
  near(job.plan.pw, 210); near(job.plan.ph, 297);
  assert.strictEqual(job.plan.cols, 2);
  near(job.plan.tiles[0].x, 0); near(job.plan.tiles[0].y, 0);
  assert.strictEqual(job.tiles.length, 1, "only the sheet the pattern lies on (blank ones are left out)");
  assert.strictEqual(job.tiles[0].col, 1);
  assert.ok(job.html.includes("Shirt") && /50 mm/.test(job.html), "titled, with the scale check");
  near(job.pieces[0].pts[0].x, 210, 1e-6); near(job.pieces[0].pts[0].y, 30, 1e-6);
  reset(); assert.strictEqual(layoutJob(), null, "nothing to print without patterns");
});

test("the layout is saved in the file and is part of undo", () => {
  reset(); rect("A", 0, 0, 100, 50, 2);
  S.layout = normLayout({ paper: "a3", cols: 2, grain: "any", gap: 12, name: "Trial", place: { "1:0": { x: 5, y: 6, rot: 90, flip: true } } });
  const before = snap();
  S.layout.place["1:0"].x = 99; S.layout.grain = "1way";
  unsnap(before);
  assert.strictEqual(S.layout.place["1:0"].x, 5); assert.strictEqual(S.layout.grain, "any");
  const text = docJSON();
  S.layout = normLayout(null);
  loadDoc(JSON.parse(text));
  assert.deepStrictEqual([S.layout.paper, S.layout.cols, S.layout.grain, S.layout.gap, S.layout.name], ["a3", 2, "any", 12, "Trial"]);
  assert.deepStrictEqual(S.layout.place["1:0"], { x: 5, y: 6, rot: 90, flip: true });
  const old = JSON.parse(text); delete old.layout; loadDoc(old);
  assert.strictEqual(S.layout.paper, "a4", "a file without a layout gets the default one");
});

function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:160,y:0},{x:160,y:200},{x:0,y:200}], true)); A.quantity = 2;
  const B = app.mkPiece("B", app.mkShape([{x:300,y:0},{x:400,y:0},{x:400,y:120},{x:300,y:120}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const out = {}, L = () => app.layoutOf(), mid = (key) => { const x = app.layoutPieces().find(p => p.key === key).poly; return app.layS({ x: (x[0].x + x[2].x)/2, y: (x[0].y + x[2].y)/2 }); };
`;

test("booted app: Print Layout mode, dragging a pattern, turning it, nesting, undo, and back", () => {
  const r = boot({ script: DOC + `
    const geo = JSON.stringify(S.pieces);
    app.setMode("layout");
    out.mode = S.mode; out.pane = app.el("layoutPane").style.display; out.pane2d = app.el("pane2d").style.display;
    out.props = app.el("props").innerHTML.includes("Print Layout") && app.el("props").innerHTML.includes("Grain Direction");
    out.copies = Object.keys(L().place).sort();
    // drag the first copy of A by 40 px
    const m = mid(A.id + ":0"), x0 = L().place[A.id + ":0"].x, z = S.lview.s;
    app.fireLay("pointermove", m); app.fireLay("pointerdown", m); app.fireLay("pointermove", { x: m.x + 40, y: m.y + 20 }); app.fireLay("pointerup", { x: m.x + 40, y: m.y + 20 });
    out.moved = [(L().place[A.id + ":0"].x - x0)*z, S.laySel, S.undo.length];
    out.draftSame = JSON.stringify(S.pieces) === geo;
    app.undo(); out.undone = L().place[A.id + ":0"].x === x0;
    // the keys: R turns by half a turn under 2-way, not at all under 1-way
    S.laySel = A.id + ":0"; L().grain = "2way"; app.key("r"); out.rot = L().place[A.id + ":0"].rot;
    // a locked arrangement can't be dragged
    L().lock = true; const p0 = JSON.stringify(L().place); const m2 = mid(B.id + ":0");
    app.fireLay("pointerdown", m2); app.fireLay("pointermove", { x: m2.x + 30, y: m2.y }); app.fireLay("pointerup", { x: m2.x + 30, y: m2.y });
    out.locked = JSON.stringify(L().place) === p0; L().lock = false;
    // nest, then the figures
    app.layoutCmd("nest"); const st = app.layoutStats();
    out.nest = [st.count, st.over, st.use > 20, Object.values(L().place).every(q => q.rot === 0 || q.rot === 180)];
    app.layoutCmd("row"); out.row = Object.values(L().place).every(q => q.y === 0);
    app.layoutCmd("unnest"); out.un = L().place[B.id + ":0"].x;
    // the wheel zooms about the cursor
    const s0 = S.lview.s; app.fireLay("wheel", { x: 300, y: 300, deltaY: -200 }); out.zoom = S.lview.s > s0;
    // print: the desktop shell gets the layout's sheets
    app.layoutCmd("print"); out.print = app.desk.calls.filter(c => c[0] === "print").map(c => [c[1], c[2], c[3]]);
    // keys of the draft do nothing here
    const t0 = S.tool; app.key("h"); out.toolKept = S.tool === t0;
    app.setMode("sim"); out.back = [S.mode, app.el("layoutPane").style.display, app.el("pane2d").style.display];
    out.draftSameEnd = JSON.stringify(S.pieces) === geo;
    return out;`, desktop: true });
  const o = r.result;
  assert.deepStrictEqual(r.errors, [], r.errors.join("; "));
  assert.strictEqual(o.mode, "layout"); assert.strictEqual(o.pane, "flex"); assert.strictEqual(o.pane2d, "none");
  assert.ok(o.props, "the Property Editor shows the layout");
  assert.strictEqual(o.copies.length, 3, "two of A, one of B");
  near(o.moved[0], 40, 1e-6); assert.ok(o.moved[1]); assert.strictEqual(o.moved[2], 1, "one undo step for the drag");
  assert.ok(o.draftSame && o.draftSameEnd, "the draft is never moved by the layout");
  assert.ok(o.undone);
  assert.strictEqual(o.rot, 180);
  assert.ok(o.locked, "locked: nothing moves");
  assert.deepStrictEqual(o.nest, [3, false, true, true]);
  assert.ok(o.row); near(o.un, 300, 1e-6);
  assert.ok(o.zoom);
  assert.deepStrictEqual(o.print, [[210, 297, true]], "A4 sheets to the printer");
  assert.ok(o.toolKept);
  assert.deepStrictEqual(o.back, ["sim", "none", ""]);
});

test("booted app: the layout comes back from the autosave, and the mode does not", () => {
  const a = boot({ script: DOC + `app.setMode("layout"); app.layoutOf().name = "Kept"; app.layoutOf().cols = 2; app.layoutCmd("nest"); app.setMode("sim"); return app.docJSON();` });
  assert.deepStrictEqual(a.errors, []);
  const b = boot({ seed: a.result, script: `return [S.mode, app.layoutOf().name, app.layoutOf().cols, Object.keys(app.layoutOf().place).length];` });
  assert.deepStrictEqual(b.errors, []);
  assert.deepStrictEqual(b.result, ["sim", "Kept", 2, 3]);
});

module.exports = T;
