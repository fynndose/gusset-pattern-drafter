// Round r25: the fixes from the third check session (its report and answers are in the private notes, not released).
"use strict";
const assert = require("assert");
const ZPRJ = require("../zprj-import.js");
const MK = require("./zprj-make");
const { boot } = require("./r16.test.js");

const T = [];
const test = (name, fn) => T.push({ name, fn });
module.exports = T;

const ring = (n) => Array.from({ length: n }, (_, k) => ({ start: k, end: (k + 1) % n }));
const readM = (patterns) => ZPRJ.importZprj(MK.zprj([], { pac: MK.pac(patterns) }));
const RECT = (name, transform, angle) => ({ name, annotation: name, transform, points: [[0, 0], [300, 0], [300, 200], [0, 200]], lines: ring(4), grain: { angle } });

/* ---- batch 2: the importer's grain ---- */
test("r25 / 2 a project file's grain angle is measured from up the pattern, anticlockwise, in its own frame, and turned by its placement (session 3, Number 17)", async () => {
  const c = Math.cos(Math.PI/2), s = Math.sin(Math.PI/2);
  const r = await readM([
    RECT("Upright", [1, 0, 0, 0, 1, 0, 0, 0, 1], 0),
    RECT("Thirty", [1, 0, 0, 0, 1, 0, 400, 0, 1], 30),                                 // leans with its top to the left
    RECT("Turned", [c, s, 0, -s, c, 0, 800, 0, 1], 270),                                // the jacket's front: 270, placed turned 90°
    RECT("Mirrored", [-c, -s, 0, -s, c, 0, 1200, 0, 1], -270),                          // and its mirrored twin
    RECT("Across", [1, 0, 0, 0, 1, 0, 1600, 0, 1], 90),
  ]);
  const out = boot({ script: `const r = ${JSON.stringify(r)}; app.ev("zprjTake")("set.zprj", r, {});
    return S.pieces.map(p => { const g = p.grain; return [p.name, +app.ev("grainAngle")(g).toFixed(3), +(g.b.x - g.a.x).toFixed(3), +(g.b.y - g.a.y).toFixed(3)]; });` });
  assert.deepStrictEqual(out.errors, []);
  const g = Object.fromEntries(out.result.filter(x => r.pieces.some(z => z.annotation === x[0])).map(x => [x[0], x[1]]));
  assert.deepStrictEqual(g, { Upright: 0, Thirty: 30, Turned: 0, Mirrored: 0, Across: 90 });
  // 30: our angle's positive side is the top to the left, as the file's anticlockwise
  const th = out.result.find(x => x[0] === "Thirty"), up = th[3] < 0 ? [th[2], th[3]] : [-th[2], -th[3]];
  assert.ok(up[0] < 0, "the top of a 30° grainline is to the left: " + up);
});

/* (r25 follow-up, the maintainer's decision 4) an older file's imported grainlines: offered once, re-read from the original file, one step */
const GRAIN_OLD = (r) => `
  const out = {}, r = ${JSON.stringify(r)};
  app.ev("zprjTake")("set.zprj", r, {});
  out.zsrc = S.pieces.map(p => p.zsrc && [p.zsrc.file, p.zsrc.i]);
  // as a build before r25 left them: no zsrc, the placed-turned patterns' grainlines across (read from level, placement left out)
  const turn = (p) => { const g = p.grain, m = { x: (g.a.x + g.b.x)/2, y: (g.a.y + g.b.y)/2 }, t = (q) => ({ x: m.x - (q.y - m.y), y: m.y + (q.x - m.x) }); p.grain = { a: t(g.a), b: t(g.b) }; };
  for (const p of S.pieces) { delete p.zsrc; if (p.name !== "Upright") turn(p); }
  // then, after the import: Turned moved, Mirrored turned a quarter
  app.push("Move"); const by = (n) => S.pieces.find(p => p.name === n);
  app.ev("mapPiece")(by("Turned"), (q) => ({ x: q.x + 100, y: q.y + 50 })); app.ev("mapPiece")(by("Mirrored"), (q) => ({ x: 2000 - q.y, y: q.x })); app.commit();
  const ang = () => S.pieces.filter(p => p.grain).map(p => [p.name, Math.round(((app.ev("grainAngle")(p.grain) % 180) + 180) % 180)]);
  out.before = ang();
  const d = JSON.parse(app.docJSON(null, { history: true })); d.v = 24; d.history.fv = 24;      // (an older file: its history of the same version)`;
const GRAIN_SET = () => { const c = 0, s = 1; return readM([RECT("Upright", [1, 0, 0, 0, 1, 0, 0, 0, 1], 0), RECT("Turned", [c, s, 0, -s, c, 0, 800, 0, 1], 270), RECT("Mirrored", [-c, -s, 0, -s, c, 0, 1200, 0, 1], -270)]); };

test("r25 follow-up / 4 a file saved before version 25 whose history names a project import offers once to re-read those patterns' grainlines (Not Now: nothing changes; not asked again); a version 25 file is not asked", async () => {
  const r = await GRAIN_SET();
  const o = boot({ blank: true, script: GRAIN_OLD(r) + `
    const asked = []; app.modalAnswer = (t, keys, text) => { asked.push([t, keys, /off by 90/.test(text), /3 patterns/.test(text), /set[.]zprj/.test(text)]); return "no"; };
    app.openText("old.pdraft", JSON.stringify(d), null, true);
    out.asked = asked.slice(); out.after = ang();
    app.openText("old.pdraft", JSON.stringify(d), null, true); out.again = asked.length;
    app.openText("other.pdraft", JSON.stringify(d), null, true); out.other = asked.length;
    const d25 = JSON.parse(JSON.stringify(d)); d25.v = 25; d25.history.fv = 25; app.openText("new.pdraft", JSON.stringify(d25), null, true); out.v25 = asked.length;
    out.imports = app.ev("grainImports")().map(x => [x.file, x.ids.length]);
    return out;` }).result;
  assert.deepStrictEqual(o.zsrc, [["set.zprj", 0], ["set.zprj", 1], ["set.zprj", 2]], "an import now remembers each pattern's file and place in it");
  assert.deepStrictEqual(o.asked, [["Imported grainlines", ["pick", "no"], true, true, true]]);
  assert.deepStrictEqual(o.after, o.before, "Not Now changes nothing");
  assert.strictEqual(o.again, 1, "offered once: the same file is not asked again");
  assert.strictEqual(o.other, 2, "another file is");
  assert.strictEqual(o.v25, 2, "a file of version 25 read its grainlines the new way: not asked");
  assert.deepStrictEqual(o.imports, [["set.zprj", 3]]);
});

test("r25 follow-up / 4 re-read: each pattern found in the original file and fitted as it lies now (moved, turned), its grainline read the r25 way; one step, undone by Undo; a changed pattern is left and named", async () => {
  const r = await GRAIN_SET();
  const o = boot({ blank: true, script: GRAIN_OLD(r) + `
    app.openText("old.pdraft", JSON.stringify(d), null, true);
    const ids = app.ev("grainImports")()[0].ids, n0 = S.undo.length, said = [];
    app.modalAnswer = (t, keys, text) => { said.push([t, text]); return "ok"; };
    out.n = app.ev("grainReread")("set.zprj", ids, r); out.fixed = ang(); out.steps = [S.undo.length - n0, S.un[S.un.length - 1].n];
    out.ids = [S.nextId, S.nextSegId];
    app.undo(); out.undone = ang();
    // a pattern changed since (a point added): left as it was, named
    app.redo(); app.undo(); const T = S.pieces.find(p => p.name === "Turned"); T.pts.push({ x: T.pts[0].x + 1, y: T.pts[0].y - 40 }); T.segs.push({ ...T.segs[0], id: app.ev("newSegId")() }); app.commit();
    out.part = [app.ev("grainReread")("set.zprj", ids, r), ang().find(x => x[0] === "Turned")[1], /Left as they were[^.]*Turned/.test(said[said.length - 1][1])];
    return out;` }).result;
  assert.deepStrictEqual(o.before.map(x => x[1]), [0, 90, 0], "as an older build left them: Turned across; Mirrored, turned a quarter since, upright");
  assert.strictEqual(o.n, 3);
  assert.deepStrictEqual(o.fixed, [["Upright", 0], ["Turned", 0], ["Mirrored", 90]], "Turned upright again; Mirrored's along the pattern, turned with it");
  assert.deepStrictEqual(o.steps, [1, "Re-read Grainlines"]);
  assert.deepStrictEqual(o.undone, o.before, "Undo takes it back");
  assert.deepStrictEqual(o.part, [2, 90, true]);
});

test("r25 follow-up / 4 File ▸ Import ▸ Re-read Grainlines from Original File… works on any open file: through the history's import, or with no record at all on every pattern (one not in the file left and named); one step", async () => {
  const r = await GRAIN_SET();
  const o = boot({ blank: true, script: GRAIN_OLD(r) + `
    const said = []; app.modalAnswer = (t, keys, text) => { said.push([t, text]); return t === "Imported grainlines" ? "no" : "ok"; };
    app.openText("old.pdraft", JSON.stringify(d), null, true);
    const row = app.ev("menuFile")().find(x => x && x.n === "Import").menu().find(x => x && x.n === "Re-read Grainlines from Original File\\u2026");
    app.ev("pickBinary = (accept, done) => done('set.zprj', new ArrayBuffer(8))"); app.ev("zprjRead = (buf, done) => done(null, " + JSON.stringify(r) + ")");
    let n0 = S.undo.length; row.f(); out.hist = [ang(), S.undo.length - n0, said[said.length - 1][0]];
    // no record at all: the history gone, an own pattern beside them, the grainlines turned back as an older build left them
    app.undo(); S.undo = []; S.redo = []; S.un = []; S.rn = [];
    S.pieces.push(app.ev("mkPiece")("Own", app.ev("mkShape")([{ x: 0, y: 900 }, { x: 100, y: 900 }, { x: 100, y: 1000 }], true))); app.commit();
    out.cands = app.ev("grainCandidates")("renamed.zprj").length;
    n0 = S.undo.length; row.f(); out.none = [ang().slice(0, 3), S.undo.length - n0, /Left as they were[^.]*Own/.test(said[said.length - 1][1])];
    return out;` }).result;
  assert.deepStrictEqual(o.hist, [[["Upright", 0], ["Turned", 0], ["Mirrored", 90]], 1, "Grainlines re-read"], "the history's import: re-read, one step");
  assert.strictEqual(o.cands, 4, "no record: every pattern");
  assert.deepStrictEqual(o.none, [[["Upright", 0], ["Turned", 0], ["Mirrored", 90]], 1, true], "found by fitting; the own pattern left and named");
});

test("r25 follow-up / 4 a file whose history names an import none of whose patterns are left: a one-time note, no question", async () => {
  const r = await GRAIN_SET();
  const o = boot({ blank: true, script: GRAIN_OLD(r).replace("const d = JSON.parse", "app.push(\"Delete\"); S.pieces = []; app.commit(); const d = JSON.parse") + `
    const asked = []; app.modalAnswer = (t) => { asked.push(t); return "no"; };
    const notes = () => toasts.filter(t => /grainlines may be off by 90/.test(t)).length;
    app.openText("a.pdraft", JSON.stringify(d), null, true); out.first = [notes(), asked.length];
    app.openText("b.pdraft", JSON.stringify(d), null, true); out.second = notes();
    return out;` }).result;
  assert.deepStrictEqual(o.first, [1, 0]);
  assert.strictEqual(o.second, 1, "once on this machine");
});

/* ---- batch 3: Grain Orientation, a pattern laid along its grain, Manual Nesting; file version 25 ---- */
// two rectangles side by side, the second's grainline at 30° (top to the left); the layout's own Grain Direction 1-way
const LAY = `
  const P = (name, x, w, h) => app.ev("mkPiece")(name, app.ev("mkShape")([{ x, y: 0 }, { x: x + w, y: 0 }, { x: x + w, y: h }, { x, y: h }], true));
  S.pieces = [P("A", 0, 200, 100), P("B", 300, 200, 100)]; S.seams = []; S.sel = [];
  app.ev("grainSet")(S.pieces[1], { x: 400, y: 50 }, 30, 80);
  S.layout = null; app.commit();
  const L = app.ev("layoutOf")(), ga = (g) => app.ev("grainAngle")(g && g.a ? g : app.ev("grainOf")(g));
  const onLay = (name) => app.ev("layoutPieces")().find(x => x.piece.name === name);`;

test("r25 / 3 Print Layout lays every pattern with its grainline along the roll: a 30° grainline stands upright on the marker, a mirrored copy's too; an upright one lies as in the 2D window", () => {
  const o = boot({ script: LAY + `
    const out = {};
    out.a = +ga(onLay("A").piece).toFixed(6);
    out.b = +ga(onLay("B").piece).toFixed(6);
    // the box of the turned rectangle: 200 × 100 turned 30° is 223.2 × 186.6
    const bx = (x) => { const xs = x.poly.map(q => q.x), ys = x.poly.map(q => q.y); return [+(Math.max(...xs) - Math.min(...xs)).toFixed(1), +(Math.max(...ys) - Math.min(...ys)).toFixed(1)]; };
    out.boxB = bx(onLay("B")); out.boxA = bx(onLay("A"));
    // a second copy of B is mirrored (pairs): its grainline is upright too
    S.pieces[1].quantity = 2; app.commit();
    out.pair = app.ev("layoutPieces")().filter(x => x.src.name === "B").map(x => +ga(x.piece).toFixed(6));
    // nested, the grain stays along the roll
    app.ev("layoutCmd")("nest"); out.nested = app.ev("layoutPieces")().map(x => +ga(x.piece).toFixed(6));
    return out;` }).result;
  assert.strictEqual(o.a, 0);
  assert.strictEqual(o.b, 0, "B's 30° grainline stands upright on the marker");
  assert.deepStrictEqual(o.boxA, [200, 100], "an upright grain: as in the 2D window");
  assert.deepStrictEqual(o.boxB, [223.2, 186.6], "B turned by its grain angle");
  assert.deepStrictEqual(o.pair, [0, 0], "and its mirrored copy");
  assert.deepStrictEqual(o.nested, [0, 0, 0]);
});

test("r25 / 3 Grain Orientation (a pattern's own One / Two / Four Way) decides how nesting and the Turn commands may turn it; without one the layout's Grain Direction does; kept in the file, one undo step", () => {
  const o = boot({ script: LAY + `
    const out = {}, A = S.pieces[0], nest = () => { app.ev("nestLayout")(); return Object.fromEntries(app.ev("layoutPieces")().map(x => [x.piece.name, L.place[x.key].rot])); };
    // a roll 150 wide: A (200 × 100) fits only turned a quarter
    L.paper = "rollc"; L.customW = 150 + 2*L.margin; L.grain = "1way"; S.pieces = [A]; app.commit();
    out.oneWay = /wider than the layout/.test(app.ev("nestLayout")());
    A.grainWay = 4; app.commit(); out.fourWay = nest().A;
    L.grain = "any"; A.grainWay = 1; app.commit(); out.ownOne = [/wider than the layout/.test(app.ev("nestLayout")()), L.place[A.id + ":0"].rot];
    // the right-click's Turn rows and R follow the pattern's own
    delete A.grainWay; L.grain = "1way"; L.paper = "a4"; app.commit(); app.ev("layoutCmd")("unnest");
    S.mode = "layout"; S.laySel = A.id + ":0";
    app.ev("keyFind")({ key: "r" }).f(); out.r1 = L.place[A.id + ":0"].rot;
    A.grainWay = 2; app.commit(); app.ev("keyFind")({ key: "r" }).f(); out.r2 = L.place[A.id + ":0"].rot;
    A.grainWay = 4; app.commit(); app.ev("keyFind")({ key: "r" }).f(); out.r4 = L.place[A.id + ":0"].rot;
    S.mode = "draft";
    // normalised: kept only as 1, 2 or 4
    const norm = app.ev("normProps"); out.norm = [norm({ grainWay: 2 }).grainWay, "grainWay" in norm({ grainWay: 3 }), norm({ grainWay: "4" }).grainWay, "grainWay" in norm({})];
    // the Property Editor's row: one step "Grain Orientation"
    S.sel = [A.id]; app.ev("ui")(); const sel = app.el("pp-gway");
    out.row = /id="pp-gway"/.test(app.el("props").innerHTML); if (sel.onchange) { const n = S.undo.length; sel.value = "1"; sel.onchange({ target: sel }); out.step = [S.undo.length - n, A.grainWay, S.un[S.un.length - 1].n]; }
    out.file = JSON.parse(app.ev("docJSON")()).pieces[0].grainWay;
    return out;` }).result;
  assert.strictEqual(o.oneWay, true, "One Way (the layout's 1-way): too wide unturned, left underneath");
  assert.strictEqual(o.fourWay, 90, "Four Way: turned a quarter to fit");
  assert.deepStrictEqual(o.ownOne, [true, 0], "the pattern's own One Way wins over the layout's Any direction: not turned, left underneath");
  assert.deepStrictEqual([o.r1, o.r2, o.r4], [0, 180, 270], "R: none with 1-way, half a turn with Two Way, a quarter with Four Way");
  assert.deepStrictEqual(o.norm, [2, false, 4, false]);
  assert.strictEqual(o.row, true);
  assert.deepStrictEqual(o.step, [1, 1, "Grain Orientation"]);
  assert.strictEqual(o.file, 1);
});

test("r25 / 3 the Grain Direction field's arrows step by 45° (One Way) or 90° (Two / Four Way), as the reference's", () => {
  const o = boot({ script: LAY + `
    const B = S.pieces[1], out = [], ui = app.ev("ui"); S.sel = [B.id]; ui();
    const key = (k) => { app.el("pp-grain").onkeydown({ key: k, preventDefault() {}, stopPropagation() {} }); ui(); };
    key("ArrowUp"); out.push(+ga(B.grain).toFixed(3));
    B.grainWay = 2; app.commit(); ui(); key("ArrowDown"); out.push(+ga(B.grain).toFixed(3));
    return out;` }).result;
  assert.deepStrictEqual(o, [75, -15], "30 + 45 (One Way), then 75 - 90 (Two Way)");
});

test("r25 / 3 Manual Nesting: a pattern dragged into another stops the pattern spacing short of it and slides along; it stays inside the roll; arrows nudge 1 mm, Shift + an arrow selects the neighbour; off, a drag goes anywhere", () => {
  const o = boot({ script: LAY + `
    const out = {}, A = S.pieces[0], B = S.pieces[1], ka = A.id + ":0", kb = B.id + ":0";
    app.ev("grainSet")(B, { x: 400, y: 50 }, 0, 80); app.commit();
    app.ev("layoutCmd")("unnest"); app.setMode("layout");
    L.place[ka] = { x: 0, y: 0, rot: 0, flip: false }; L.place[kb] = { x: 300, y: 0, rot: 0, flip: false }; app.commit();      // both inside the roll (3 A4 sheets across, 550 mm)
    const lp = (k) => app.ev("layoutPieces")().find(x => x.key === k).poly, gapAB = () => app.ev("polyGap")(lp(ka), lp(kb));
    app.ev("layManual")(true);
    out.button = S.layManual === true;
    const s = (q) => ({ x: q.x*S.lview.s + S.lview.x, y: q.y*S.lview.s + S.lview.y });
    const drag = (from, to) => { app.fireLay("pointerdown", s(from)); app.fireLay("pointermove", s(to)); app.fireLay("pointerup", s(to)); };
    const n0 = S.undo.length;
    drag({ x: 400, y: 50 }, { x: 50, y: 70 });
    out.drag = [+L.place[kb].x.toFixed(2), +L.place[kb].y.toFixed(2), +gapAB().toFixed(2), S.undo.length - n0];
    drag({ x: L.place[kb].x + 100, y: 70 }, { x: L.place[kb].x + 100, y: -50 }); out.top = +L.place[kb].y.toFixed(3);
    S.laySel = kb; const x0 = L.place[kb].x;
    app.key("ArrowLeft"); out.left = +(L.place[kb].x - x0).toFixed(3);
    app.key("ArrowRight"); out.right = +(L.place[kb].x - x0).toFixed(3);
    S.laySel = ka; app.key("ArrowLeft"); out.edge = L.place[ka].x;
    app.key("ArrowRight", { shiftKey: true }); out.switched = S.laySel === kb;
    app.ev("layManual")(false);
    drag({ x: L.place[kb].x + 100, y: 50 }, { x: 100, y: 50 }); out.free = +gapAB().toFixed(2);
    app.setMode("draft");
    return out;` }).result;
  assert.strictEqual(o.button, true);
  assert.ok(o.drag[2] >= 5 - 1e-3 && o.drag[2] < 5.5, "stopped the spacing (5 mm) short of A: " + o.drag);
  assert.ok(o.drag[1] > 0, "and slid down along it towards the pointer: " + o.drag);
  assert.strictEqual(o.drag[3], 1, "one step");
  assert.ok(o.top >= 0 && o.top < 0.01, "stopped at the roll's top: " + o.top);
  assert.strictEqual(o.left, 0, "the nudge left would come too near A");
  assert.strictEqual(o.right, 1);
  assert.strictEqual(o.edge, 0, "A stays inside the roll");
  assert.strictEqual(o.switched, true);
  assert.strictEqual(o.free, 0, "off: dragged onto A");
});

test("r25 follow-up / 2 Print Layout marks patterns that overlap another (hatched, ⚠) and counts the pairs in the status bar; touching or held apart is no overlap; the arrow nudge stays", () => {
  const o = boot({ script: LAY + `
    const out = {}, A = S.pieces[0], B = S.pieces[1], ka = A.id + ":0", kb = B.id + ":0";
    app.ev("grainSet")(B, { x: 400, y: 50 }, 0, 80); app.commit();
    app.ev("layoutCmd")("unnest"); app.setMode("layout");
    const st = () => { const el = app.ev("document.getElementById('s-over')"); return el.hidden ? "" : el.textContent; };
    const at = (x, y) => { L.place[kb] = { x, y, rot: 0, flip: false }; app.commit(); app.ev("drawLayout")(); const r = app.ev("layOverlaps")(app.ev("layoutPieces")()); return [r.n, [...r.keys].sort().join(","), st()]; };
    L.place[ka] = { x: 0, y: 0, rot: 0, flip: false };
    out.apart = at(300, 0);
    out.over = at(150, 50);
    out.touch = at(200, 0);
    out.holds = (() => { const r = at(300, 0); B.pts = [{ x: 330, y: 20 }, { x: 380, y: 20 }, { x: 380, y: 60 }, { x: 330, y: 60 }]; app.commit(); return at(50, 20); })();
    out.keys = [ka, kb].sort().join(",");
    S.laySel = kb; const x0 = L.place[kb].x; app.key("ArrowRight"); out.nudge = +(L.place[kb].x - x0).toFixed(3);
    app.setMode("draft"); out.left = st();
    return out;` }).result;
  assert.deepStrictEqual(o.apart, [0, "", ""], "apart: no mark, nothing in the status bar");
  assert.deepStrictEqual(o.over, [1, o.keys, "⚠ 1 overlap"], "both marked, one pair counted");
  assert.deepStrictEqual(o.touch, [0, "", ""], "edge to edge is no overlap");
  assert.deepStrictEqual(o.holds, [1, o.keys, "⚠ 1 overlap"], "a small pattern lying wholly inside a large one overlaps it");
  assert.strictEqual(o.nudge, 1, "the arrow keys still nudge 1 mm");
  assert.strictEqual(o.left, "", "the count is gone outside Print Layout");
});

test("r25 follow-up / 2 polyOverlap: crossing, holding, touching at a corner or along an edge", () => {
  const o = boot({ blank: true, script: `
    const f = app.ev("polyOverlap"), R = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    return [f(R(0, 0, 10, 10), R(5, 5, 10, 10)), f(R(0, 0, 10, 10), R(2, 2, 3, 3)), f(R(2, 2, 3, 3), R(0, 0, 10, 10)), f(R(0, 0, 10, 10), R(10, 10, 5, 5)), f(R(0, 0, 10, 10), R(10, 0, 5, 10)), f(R(0, 0, 10, 10), R(0, 0, 10, 10)), f(R(0, 0, 10, 10), R(20, 0, 5, 5))];` }).result;
  assert.deepStrictEqual(o, [true, true, true, false, false, true, false]);
});

test("r25 / 3 a version 24 file (written by the build before the bump) opens unchanged and is saved as version 25", () => {
  const o = boot({ blank: true, streams: true, script: `
    const out = {};
    const bytes = new Uint8Array(app.read("files/v24/notes-puckering-lights-roll-history.pdraft"));
    const was = app.fileDoc(bytes);
    app.ev("openFile")("notes-puckering-lights-roll-history.pdraft", bytes, null, true);
    return app.wait(() => S.pieces.length === was.pieces.length && S.pieces.length > 0, "the file opened").then(() => {
      const J = app.ev("canonJSON"), now = app.ev("docObj")();
      /* (Round H1a / 2: from version 31 every document says its render settings and the defaults it was written with, as its version) */ const strip = (d) => { const c = JSON.parse(JSON.stringify(d)); delete c.v; delete c.render; delete c.defaults; delete c.scene; delete c.drape; delete c.states3; delete c.states3Bin; delete c.history; return J(c); };
      out.v = [was.v, now.v]; out.same = strip(was) === strip(now); out.steps = S.un.length;
      return new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); })
        .then((again) => new Promise((res) => app.ev("zipUnpack")(again, (e, p) => res(p)))).then((parts) => app.ev("pdraftDoc")(parts))
        .then((d) => { out.again = d.v; return out; });
    });` }).result;
  assert.deepStrictEqual(o.v, [24, 31]);      // ((Round H1a: version 31) (Round r34: version 30) ((Round r33b: version 29) this build's version: 28 since Round r30, 27 since Round r29, 26 since Round r26)
  assert.strictEqual(o.same, true, "the same document");
  assert.ok(o.steps > 0, "its history came with it");
  assert.strictEqual(o.again, 31);      // ((Round H1a: version 31) (Round r34: version 30) ((Round r33b: version 29) Round r30: 28; Round r29: 27)
});

/* ---- batch 4: a hole in a DXF ---- */
test("r25 / 4 DXF: a hole goes out on layer 11 and again on layer 86 (the same loop, from its second point, as the other program writes it); read back it is one hole; a layer-86 loop alone is a hole too; other lines are not", () => {
  const o = boot({ script: `
    const R = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    const p = app.ev("mkPiece")("Hole test", app.ev("mkShape")(R(0, 0, 300, 200), true)), h = app.ev("mkShape")(R(100, 70, 100, 60), true);
    h.hole = true; app.ev("addChild")(p, "internals", h);
    app.ev("addChild")(p, "internals", app.ev("mkShape")([{ x: 20, y: 20 }, { x: 60, y: 20 }], false));
    const txt = app.ev("dxfExport")([p], { format: "aama", metric: true }), doc = app.ev("dxfParse")(txt), ents = Object.values(doc.blocks)[0];
    const loops = (L) => ents.filter(e => e.type === "POLY" && String(e.layer) === L).map(e => e.pts.map(q => [q.x, q.y]));
    const out = { l11: loops("11"), l86: loops("86"), l8: loops("8").length };
    const back = app.ev("dxfImport")(txt, {}).pieces[0];
    out.back = back.internals.map(it => [!!it.hole, it.closed, it.pts.length]);
    // a file with the copy only (its layer-11 loop taken out)
    const NL = String.fromCharCode(10), a = txt.indexOf("0" + NL + "POLYLINE" + NL + "8" + NL + "11" + NL), endS = "SEQEND" + NL + "8" + NL + "11" + NL, b = txt.indexOf(endS, a) + endS.length;
    const only86 = txt.slice(0, a) + txt.slice(b);
    out.only86 = [only86 !== txt, app.ev("dxfImport")(only86, {}).pieces[0].internals.filter(it => it.hole).length];
    return out;` }).result;
  assert.deepStrictEqual(o.l11, [[[100, -70], [200, -70], [200, -130], [100, -130]]], "the cutout (y up in the file)");
  assert.deepStrictEqual(o.l86, [[[200, -70], [200, -130], [100, -130], [100, -70]]], "its copy, from the second point");
  assert.strictEqual(o.l8, 1, "the plain internal line stays on layer 8 alone");
  assert.deepStrictEqual(o.back, [[false, false, 2], [true, true, 4]], "the internal line and one hole, not two (lines are read before holes)");
  assert.deepStrictEqual(o.only86, [true, 1]);
});

/* ---- batch 5: the corner types' rows and Line 1 (shapes on square corners only) ---- */
test("r25 / 5 each corner type on a square corner with 10 mm allowances, as the third check session's frames show it (Number 12): Extension, Perpendicular (either line, Reverse) the plain corner; Slant 10 / 10 from the seam's level to the other; Slant A 5 / B 15; Round a quarter arc; Envelope 4; Pocket Style 1 a 5 × 5 step, Style 2 a 5 mm step then 45°", () => {
  const o = boot({ script: `
    const cp = app.ev("cornerPts"), P = { x: 0, y: 0 }, uA = { x: 1, y: 0 }, uB = { x: 0, y: 1 };       // the incoming line runs right, the outgoing down
    const at = (c) => cp(P, uA, uB, 10, 10, 1, c).map(q => [+q.x.toFixed(6), +q.y.toFixed(6)]);
    // the cut line through the corner from a1 to b0, collinear points left out: what it looks like
    const look = (c) => { const r = [[0, -10], ...at(c), [10, 0]].filter((q, k, a) => !k || q[0] !== a[k-1][0] || q[1] !== a[k-1][1]);
      return r.filter((q, k) => k === 0 || k === r.length - 1 || Math.abs((q[0] - r[k-1][0])*(r[k+1][1] - q[1]) - (q[1] - r[k-1][1])*(r[k+1][0] - q[0])) > 1e-9); };
    const round = at({ t: "round" });
    return { ext: look(null), perpIn: look({ t: "perp", on: "in", d: 10 }), perpOut: look({ t: "perp", on: "out", d: 10 }), rev: look({ t: "perp", on: "in", d: 3, rev: true }),
      slant: at({ t: "slant", a: 10, b: 10 }), slantOld: at({ t: "slant" }), slant515: at({ t: "slant", a: 5, b: 15 }),
      round: [round.length, Math.max(...round.map(q => Math.abs(Math.hypot(q[0], q[1]) - 10))), round[0], round[round.length - 1]],
      pocket1: at({ t: "pocket", st: 1, din: 5, dout: 5 }), pocket2: at({ t: "pocket", st: 2, din: 5, dout: 5 }) };` }).result;
  const plain = [[0, -10], [10, -10], [10, 0]];
  assert.deepStrictEqual([o.ext, o.perpIn, o.perpOut, o.rev], [plain, plain, plain, plain], "on a square corner these are the plain corner (no setting changes it: Number 13)");
  assert.deepStrictEqual(o.slant, [[0, -10], [10, 0]], "Slant 10 / 10: 10 back from where the cut lines meet, on each");
  assert.deepStrictEqual(o.slantOld, o.slant, "a Slant from an older file (no distances) keeps its shape");
  assert.deepStrictEqual(o.slant515, [[5, -10], [10, 5]]);
  assert.strictEqual(o.round[0], 9); assert.ok(o.round[1] < 1e-6, "on the circle of the allowance about the corner"); assert.deepStrictEqual(o.round.slice(2), [[0, -10], [10, 0]]);
  assert.deepStrictEqual(o.pocket1, [[5, -10], [5, -5], [10, -5]], "Style 1: a 5 × 5 step");
  assert.deepStrictEqual(o.pocket2, [[5, -10], [5, -5], [10, 0]], "Style 2: a 5 mm step down, then 45° to the other cut line");
});

test("r25 / 5 Line 1 is the line coming into the point, on any outline (Number 15); a stored corner keeps its line, only its label changes; Slant's Distance A / B, Round without rows, Pocket's rows unprimed; Reverse greys Distance at half the allowance", () => {
  const o = boot({ script: `
    const R = (pts) => app.ev("mkPiece")("R", app.ev("mkShape")(pts.map(([x, y]) => ({ x, y })), true));
    const cw = R([[0, 0], [300, 0], [300, 200], [0, 200]]), ccw = R([[0, 0], [0, 200], [300, 200], [300, 0]]);
    for (const p of [cw, ccw]) for (const s of p.segs) s.sa = 10;
    S.pieces = [cw, ccw]; app.commit();
    const out = {}, l1 = app.ev("cornerLine1"), html = app.ev("cornerPropsHTML");
    out.l1 = [l1(cw), l1(ccw)];
    // a corner of an older file on the outgoing line: still that line, now labelled Line 2
    cw.segs[1].corner = { t: "perp", on: "out" };
    out.oldChip = [/id="cx-l1"[^>]*aria-pressed="false"/.test(html(cw, 1, "")), /id="cx-l2"[^>]*aria-pressed="true"/.test(html(cw, 1, ""))];
    cw.segs[1].corner.rev = true; const h = html(cw, 1, "");
    out.rev = [/id="cx-d" value="5" disabled/.test(h), /half the seam allowance/.test(h)];
    app.ev("cornerPick")(cw, [2], "slant"); out.slant = [cw.segs[2].corner, /Distance A [(]mm[)]/.test(html(cw, 2, "")), /Distance B [(]mm[)]/.test(html(cw, 2, ""))];
    cw.segs[3].corner = { t: "round", r: 4 }; out.roundRows = /cx-r/.test(html(cw, 3, ""));
    app.ev("cornerPick")(cw, [3], "round"); out.roundAgain = cw.segs[3].corner;
    out.menu = app.ev("cornerRows")(cw, 3, { x: 0, y: 0 }).map(r => r.n).filter(Boolean);
    app.ev("cornerPick")(cw, [0], "pocket"); S.ui.unbuilt = false; const ph = html(cw, 0, "");
    out.pocket = [/Distance A [(]/.test(ph), /Distance A'/.test(ph), /Style 3/.test(ph)];
    S.ui.unbuilt = true; out.pocket3 = /value="3" disabled>Style 3 [(]not built yet[)]/.test(html(cw, 0, "")); S.ui.unbuilt = false;
    out.saved = JSON.parse(app.ev("docJSON")()).pieces[0].segs.map(s => s.corner || null);
    return out;` }).result;
  assert.deepStrictEqual(o.l1, ["in", "in"], "clockwise or anticlockwise, Line 1 is the incoming line");
  assert.deepStrictEqual(o.oldChip, [true, true], "a corner on the outgoing line shows as Line 2");
  assert.deepStrictEqual(o.rev, [true, true], "Reverse Perpendicular: Distance greyed at half the 10 mm allowance");
  assert.deepStrictEqual(o.slant, [{ t: "slant", a: 10, b: 10 }, true, true]);
  assert.strictEqual(o.roundRows, false, "Round has no rows");
  assert.deepStrictEqual(o.roundAgain, { t: "round" }, "picked again it starts afresh: an older file's length goes");
  assert.ok(o.menu.includes("Round") && !o.menu.some(n => /^Round./.test(n)), "the menu's Round opens no box: " + o.menu);
  assert.deepStrictEqual(o.pocket, [true, false, false], "Distance A without the prime; Style 3 hidden while the not-built switch is off");
  assert.strictEqual(o.pocket3, true, "and greyed while it is on");
  assert.deepStrictEqual(o.saved[2], { t: "slant", a: 10, b: 10 }, "kept in the file");
});

/* ---- batch 6: the other differences the third check session showed ---- */
test("r25 / 6 Trim with three shapes cuts only the first selected, by the last; the one between is left out (Number 46)", () => {
  const o = boot({ script: `
    const R = (n, x, y, w, h) => app.ev("mkPiece")(n, app.ev("mkShape")([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true));
    const A = R("First", 0, 0, 200, 400), B = R("Second", 100, 100, 200, 400), C = R("Third", 150, 300, 200, 400);
    S.pieces = [A, B, C]; app.commit();
    S.traceShapes = [A, B, C].map(p => ({ pid: p.id, id: 0 })); const made = app.ev("traceOpPieces")("trim", app.ev("traceShapes")());
    const area = (p) => Math.abs(app.ev("signedArea")(app.ev("flatten")(p, 4)));
    return [Array.isArray(made) ? made.length : made, Array.isArray(made) ? Math.round(area(made[0])) : 0];` }).result;
  // the first, 200 × 400, less the corner the third covers (50 × 100)
  assert.deepStrictEqual(o, [1, 80000 - 5000]);
});

test("r25 / 6 Simulation Shrinkage 10 to 300 % (Number 28); Solidify's Strength 0 to 100, 86 by default and then not stored, its bending 10^(3·s/86) times the fabric's (×1000 at 86, as before); in the Property Editor while solidified, one step, kept in the file", () => {
  const o = boot({ script: `
    const n = app.ev("normProps"), out = {};
    out.shrink = [[10, 300], [5, 400], [80, 100]].map(([w, p]) => n({ shrink3: { weft: w, warp: p } }).shrink3 || null);
    out.solid = [n({ solid3s: 86 }), n({ solid3s: 40 }), n({ solid3s: 150 }), n({ solid3s: -3 })].map(q => "solid3s" in q ? q.solid3s : "none");
    const sb = app.ev("solidBend"); out.bend = [sb({}), sb({ solid3s: 86 }), sb({ solid3s: 0 }), +sb({ solid3s: 100 }).toFixed(0)];
    const A = S.pieces[0]; A.solid3 = true; S.sel = [A.id]; app.commit(); app.ev("ui")();
    out.row = [/id="pp-s3s"/.test(app.el("props").innerHTML), /id="pp-s3s-r"/.test(app.el("props").innerHTML)];
    const u = S.undo.length; app.el("pp-s3s").onchange({ target: { value: "50" } }); out.step = [S.undo.length - u, A.solid3s];
    out.file = JSON.parse(app.ev("docJSON")()).pieces[0].solid3s;
    delete A.solid3; app.commit(); app.ev("ui")(); out.gone = /id="pp-s3s"/.test(app.el("props").innerHTML);
    return out;` }).result;
  // (Round r26: 1 to 1000, so 5 and 400 stay as typed; the fourth check session Number 6)
  assert.deepStrictEqual(o.shrink, [{ weft: 10, warp: 300 }, { weft: 5, warp: 400 }, { weft: 80, warp: 100 }]);
  assert.deepStrictEqual(o.solid, ["none", 40, 100, 0]);
  assert.deepStrictEqual(o.bend.slice(0, 3), [1000, 1000, 1]); assert.ok(Math.abs(o.bend[3] - 3079) < 2, "100: " + o.bend[3]);
  assert.deepStrictEqual(o.row, [true, true]); assert.deepStrictEqual(o.step, [1, 50]); assert.strictEqual(o.file, 50);
  assert.strictEqual(o.gone, false, "only while solidified");
});

test("r25 / 6 a glue's Strength from 0.1 to 10 (the reference keeps 2 and makes 0 its least, 0,100: Numbers 20 / 35); 1 and above bond as hard as a seam", () => {
  const o = boot({ script: `
    const g0 = { id: 1, name: "G", kind: "area", a: S.pieces[0].id, b: 99, poly: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }], m: [1, 0, 0, 0, 1, 0] };
    return app.ev("normGlues")([0, 0.5, 2, 20, 1].map((s, k) => ({ ...g0, id: k + 1, strength: s }))).map(g => "strength" in g ? g.strength : "1 (not stored)");` }).result;
  // (Round r26: the top is 100, the fourth check session Number 11)
  assert.deepStrictEqual(o, [0.1, 0.5, 2, 20, "1 (not stored)"]);
});

// (r25 follow-up, the maintainer's decision 3) two squares lying on each other in 3D, 8 mm apart, and (glue) a glue area of A on B
const GLUED = (glue) => `
  const out = {}, G3 = app.G3;
  app.ev("setLayout")("both");
  const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:0},{x:x+300,y:0},{x:x+300,y:300},{x:x,y:300}], true));
  S.pieces = [sq("A", 0), sq("B", 400)]; S.seams = [];
  const A = S.pieces[0], B = S.pieces[1];
  A.p3 = { pos: [0, 1000, 8], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1000, 0], q: [0, 0, 0, 1], r: 0 };
  S.glues = ${glue ? `[{ id: 1, name: "Glue 1", kind: "area", a: A.id, b: B.id, poly: [{x:50,y:50},{x:250,y:50},{x:250,y:250},{x:50,y:250}], m: [1, 0, 400, 0, 1, 0], strength: ${glue} }]` : "[]"};
  S.cloth = app.normCloth({ ...S.cloth, res: 25, self: false, worker: false }); app.commit();
  const run = () => { app.ev("garmentSync")(); app.ev("simStart")(); for (let k = 0; k < 30; k++) app.ev("simFrame")(); const X = S.pieces.map(p => Array.from(G3.items.get(p.id).X)); app.ev("simStop")(); return X; };`;

test("r25 follow-up / 3 a glue saved with Strength 0 opens switched off (kept, drawn, out of the simulation): it simulates bit for bit as before, when it bonded nothing; switched on it bonds at 0.1, one step", () => {
  const old = boot({ blank: true, three: true, script: GLUED(1) + `
    // the file as a build before r25 wrote it: version 24, the glue's Strength 0 (no bond then)
    const d = JSON.parse(app.docJSON()); d.v = 24; d.glues[0].strength = 0;
    app.openText("old.pdraft", JSON.stringify(d), null, true);
    const g = S.glues[0];
    out.glue = [S.glues.length, g.off, g.strength, app.ev("simGlues")(S.pieces.map(p => p.id)).length];
    out.X = run();
    out.saved = (() => { const e = JSON.parse(app.docJSON()).glues[0]; return [e.off, e.strength]; })();
    // switched on: one step, a bond at the least Strength
    S.selTrim = { kind: "glue", id: g.id }; const n0 = S.undo.length;
    app.ev("glueActive")(S.glues[0], true);
    const on = S.glues[0];
    out.on = [on.off ?? "none", on.strength, S.undo.length - n0, app.ev("simGlues")(S.pieces.map(p => p.id)).map(x => +x.soft.toExponential(3))];
    out.Xon = run();
    app.undo(); app.undo(); out.undone = S.glues[0].off;      // the run is a step of its own ("Simulate"), then the switch
    return out;` }).result;
  const none = boot({ blank: true, three: true, script: GLUED(0) + `out.X = run(); return out;` }).result;
  assert.deepStrictEqual(old.glue, [1, true, 0.1, 0], "kept, switched off, its Strength the least when switched on; the solver is given nothing");
  assert.deepStrictEqual(old.X, none.X, "the cloth moves bit for bit as with no glue at all, as a Strength-0 glue did before r25");
  assert.deepStrictEqual(old.saved, [true, 0.1], "saved switched off");
  assert.deepStrictEqual(old.on, ["none", 0.1, 1, [9e-5]], "switched on: one step, a soft bond of Strength 0.1 ((1 − s)/(s · 1e5))");
  assert.notDeepStrictEqual(old.Xon, none.X, "switched on it bonds: the cloth moves otherwise");
  assert.strictEqual(old.undone, true, "undo switches it off again");
});

test("r25 follow-up / 3 normGlues: Strength 0 or less is off, off is kept, a new glue's Strength still runs 0.1 to 10; the Property Editor's Active switch; a raw Strength 0 of an older history step counts as off", () => {
  const o = boot({ script: `
    const g0 = { id: 1, name: "G", kind: "area", a: S.pieces[0].id, b: 99, poly: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }], m: [1, 0, 0, 0, 1, 0] };
    const n = app.ev("normGlues")([{ ...g0, strength: 0 }, { ...g0, id: 2, strength: -1 }, { ...g0, id: 3, strength: 0.05 }, { ...g0, id: 4, off: true, strength: 3 }, { ...g0, id: 5 }]);
    const off = app.ev("glueOff");
    return { norm: n.map(g => [g.off ?? false, g.strength ?? 1]), raw: [off({ strength: 0 }), off({ strength: 0.1 }), off({})] };` }).result;
  assert.deepStrictEqual(o.norm, [[true, 0.1], [true, 0.1], [false, 0.1], [true, 3], [false, 1]]);
  assert.deepStrictEqual(o.raw, [true, false, false]);
});

test("r25 / 6 a corner notch's Direction ▸ Point (Center) cuts along the corner's middle (Number 81); kept only at a corner", () => {
  const o = boot({ script: `
    const P = app.ev("mkPiece")("R", app.ev("mkShape")([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }], true));
    S.pieces = [P]; app.commit();
    const nn = app.ev("normNotchAt"), out = {};
    out.norm = [JSON.stringify(nn({ t: 1, dir: "point" })), JSON.stringify(nn({ t: 0.5, dir: "point" }))];
    P.segs[0].notches = [{ t: 1, dir: "point" }]; app.commit();
    const m = app.ev("notchMarks")(P, { ...S.notch, type: "I" })[0];
    out.dir = [+(m[1].x - m[0].x).toFixed(6), +(m[1].y - m[0].y).toFixed(6)];
    return out;` }).result;
  assert.deepStrictEqual(JSON.parse(o.norm[0]), { t: 1, dir: "point" }); assert.strictEqual(o.norm[1], "0.5", "mid-line it has no Direction");
  // at the top right corner (300, 0) of a clockwise rectangle: into the pattern along the middle, down and to the left at 45°
  assert.ok(o.dir[0] < 0 && o.dir[1] > 0 && Math.abs(Math.abs(o.dir[0]) - Math.abs(o.dir[1])) < 1e-6, "along the corner's middle: " + JSON.stringify(o.dir));
});

test("r25 / 6 Replaced by on an internal line keeps the line's sewing (Number 71: keep ours and its sewing)", () => {
  const o = boot({ script: `
    const R = (n, x, y, w, h) => app.ev("mkPiece")(n, app.ev("mkShape")([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true));
    const A = R("A", 0, 0, 300, 300), B = R("B", 400, 0, 200, 300); S.pieces = [A, B];
    const L = app.mkShape([{ x: 50, y: 50 }, { x: 250, y: 50 }], false), N = app.mkShape([{ x: 50, y: 150 }, { x: 250, y: 200 }], false);
    app.ev("addChild")(A, "internals", L); app.ev("addChild")(A, "internals", N); app.commit();
    S.seams = [{ id: 1, a: [{ piece: A.id, shape: L.id, sids: [L.segs[0].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[0].id], t0: 0, t1: 1, rev: false }] }];
    app.commit();
    const n0 = S.seams.length, sid = L.segs[0].id; app.push("Replaced by"); app.ev("replaceShape")(A, L, N); app.commit();
    return [n0, S.seams.length, S.seams[0].a[0].shape === L.id, L.segs[0].id === sid, L.pts[1].y];` }).result;
  assert.deepStrictEqual(o, [1, 1, true, true, 200], "the seam is still there, on the line that now has the new shape");
});

test("r25 / 6 Pleats Fold and Pleats Sewing are gone (the maintainer's decision, Number 79); the Pleat tool stays", () => {
  const o = boot({ script: `
    const T = app.ev("TOOLS");
    return [!!T.pleats_fold, !!T.pleats_sewing, !!T.pleats];` }).result;
  assert.deepStrictEqual(o, [false, false, true]);
});

test("r25 / 6 the quality render's settings: Noise Threshold 0.050 and Max. Render Time 20 min (the reference's), Color Mapping Reinhard by default (ACES the other); it stops at its samples, its time or its noise, whichever first; the noise estimate is the pixels' standard error", () => {
  const o = boot({ script: `
    const nr = app.ev("normRender"), out = {};
    const d = nr(null); out.def = [d.noise, d.maxMin, d.tone, d.samples];
    out.norm = [nr({ noise: 2 }).noise, nr({ noise: 0.0123 }).noise, nr({ maxMin: -5 }).maxMin, nr({ tone: "aces" }).tone, nr({ tone: "x" }).tone];
    const why = app.ev("ptStopWhy"), o = { samples: 256, noise: 0.05, maxMin: 20 };
    out.why = [why({ samples: 256, target: 256, o, t0: 0 }, 1), why({ samples: 40, target: 256, o, t0: 0 }, 20*60000), why({ samples: 40, target: 256, o, t0: 0, noise: 0.04 }, 1000),
      why({ samples: 40, target: 256, o, t0: 0, noise: 0.06 }, 1000), why({ samples: 40, target: 256, o: { ...o, noise: 0, maxMin: 0 }, t0: 0, noise: 0.001 }, 1e9)];
    let seed = 7; const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; }, gauss = () => Math.sqrt(-2*Math.log(rnd() || 1e-12))*Math.cos(2*Math.PI*rnd());
    const N = 4096, sigma = 0.3, mu = 0.5, m = 64, n = 80, sum = new Float64Array(N*3), A = new Float32Array(N*4), B = new Float32Array(N*4);
    for (let s = 1; s <= n; s++) { for (let i = 0; i < N*3; i++) sum[i] += mu + sigma*gauss(); if (s === m || s === n) { const T = s === m ? A : B; for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) T[i*4 + c] = sum[i*3 + c]/s; } }
    out.est = app.ev("ptNoiseOf")(A, B, m, n); out.truth = sigma/Math.sqrt(n)/mu;
    const h = app.ev("rwinModeHTML")({ ...d, mode: "quality" }); out.html = [/data-r="noise"/.test(h), /data-r="maxMin"/.test(h), /data-r="tone"/.test(h)];
    return out;` }).result;
  assert.deepStrictEqual(o.def, [0.05, 20, "reinhard", 256]);
  assert.deepStrictEqual(o.norm, [1, 0.012, 0, "aces", "reinhard"]);
  assert.deepStrictEqual(o.why, ["samples", "time", "noise", null, null]);
  assert.ok(Math.abs(o.est/o.truth - 1) < 0.15, "the estimate " + o.est + " against " + o.truth);
  assert.deepStrictEqual(o.html, [true, true, true]);
});

test("r25 / 6 Export OBJ asks Single Object (one object, the patterns told apart by material names, as the reference's default) or Multiple Objects (an object a pattern); Single by default since the follow-up (Number 81)", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3;
    app.ev("setLayout")("both");
    const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:0},{x:x+300,y:0},{x:x+300,y:400},{x:x,y:400}], true));
    S.pieces.push(sq("Front", 0), sq("Back", 400));
    S.pieces[0].p3 = { pos: [500, 1100, 120], q: [0, 0, 0, 1], r: 0 }; S.pieces[1].p3 = { pos: [500, 1100, -120], q: [0, 1, 0, 0], r: 0 };
    S.cloth = app.normCloth({ ...S.cloth, res: 25, self: false, worker: false }); app.commit(); app.ev("garmentSync")();
    const lines = (t) => t.split(String.fromCharCode(10)), count = (t, re) => lines(t).filter(l => re.test(l)).length;
    const one = app.ev("objText")(false, "single").text, many = app.ev("objText")(false, "multi").text;
    out.single = [count(one, /^o /), lines(one).filter(l => /^usemtl /.test(l)), count(one, /^v /) === count(many, /^v /), count(one, /^f /) === count(many, /^f /)];
    out.multi = [count(many, /^o /), count(many, /^usemtl /)];
    let file = null, asked = null; app.setDownload((n, b) => { file = [n, String(b).includes("usemtl Front")]; });
    app.answer = (t, f) => { asked = [t, f[0].options.map(x => x[1]), f[0].val]; return { kind: "multi" }; }; app.ev("exportOBJ")(false); app.answer = null;
    out.box = [asked, file, S.prefs.objKind];
    // the choice is a preference: kept for the next start, and the box opens at it
    out.kept = app.ev("loadPrefs")().objKind;
    app.answer = (t, f) => { asked = f[0].val; return { kind: "single" }; }; app.ev("exportOBJ")(false); app.answer = null;
    out.again = [asked, app.ev("loadPrefs")().objKind];
    return out;` }).result;
  assert.deepStrictEqual(o.single, [1, ["usemtl Front", "usemtl Back"], true, true], "one object; each pattern a material name; the same points and triangles");
  assert.deepStrictEqual(o.multi, [2, 0]);
  // (Round r25 follow-up, the maintainer's decision 1) the box opens at Single Object, the reference's default; before, at Multiple Objects
  assert.deepStrictEqual(o.box, [["Export OBJ", ["Single Object", "Multiple Objects"], "single"], ["garment.obj", false], "multi"]);
  assert.strictEqual(o.kept, "multi", "the last choice is written to the preferences");
  assert.deepStrictEqual(o.again, ["multi", "single"], "the box opens at the last choice");
});

test("r25 follow-up / 1 Export OBJ's choice is a preference: Single Object by default, Multiple only when chosen", () => {
  const o = boot({ blank: true, script: `const n = app.ev("normPrefs"); return [n(null).objKind, n({ objKind: "multi" }).objKind, n({ objKind: "x" }).objKind, S.prefs.objKind];` }).result;
  assert.deepStrictEqual(o, ["single", "multi", "single", "single"]);
});
