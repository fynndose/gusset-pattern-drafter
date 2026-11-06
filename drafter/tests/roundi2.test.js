// Round I2. I2-1: an imported point looks and behaves as a point drawn here (no ring unless Show Grading is on, no dots on
// hidden reference lines). I2-2: Show Grading as the file's program shows it: every size at once over the base.
// The files are made by zprj-make.js: no file of another program is used.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ZPRJ = require("../zprj-import.js");
const MK = require("./zprj-make");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-boot-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify({ blank: true, ...opt }));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 60000, maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
// a graded pattern in S, M, L (M the base) with a curve and a reference line, as an import brings it
const GRADED = {
  name: "BODY", annotation: "Body", points: [[0, 0], [300, 0], [300, 400], [0, 400]],
  sizes: [[[5, 5], [0, 0], [-6, -5]], [[290, 4], [300, 0], [312, -5]], [[292, 390], [300, 400], [311, 412]], [[6, 392], [0, 400], [-5, 410]]],
  lines: [{ start: 0, end: 1, cps: [[100, -30], [200, -30]], cpSizes: [[[100, -20], [100, -30], [99, -45]], [[195, -22], [200, -30], [210, -41]]] }, { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 0 }],
  dummy: [{ name: "Ref", sa: false, points: [[50, 200], [250, 200]], lines: [{ start: 0, end: 1 }] }],
};
const TABLE = { listRuleTables: MK.list([MK.ruleTable({ name: "Body sizes", sizes: ["S", "M", "L"], base: 1 })]) };
const read = () => ZPRJ.importZprj(MK.zprj([], { pac: MK.pac([GRADED], TABLE) }));
// what the 2D window paints within 8 px of a place: every circle, with its radius and the fill and line it got
const RECORD = `
  const ctx = app.ev("ctx"), marks = []; let path = [];
  ctx.beginPath = () => { path = []; }; ctx.arc = (x, y, r) => path.push({ x, y, r });
  ctx.fill = () => path.forEach(a => marks.push({ ...a, fill: ctx.fillStyle })); ctx.stroke = () => path.forEach(a => marks.push({ ...a, line: ctx.strokeStyle, w: ctx.lineWidth }));
  const at = (q) => { marks.length = 0; app.ev("draw")(); const s = app.ev("toS")(q); return marks.filter(m => Math.hypot(m.x - s.x, m.y - s.y) < 8).map(m => [Math.round(m.r * 10) / 10, m.fill || null, m.line || null, m.w || null]).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1); };
`;

test("I2-1 an imported point is drawn as a native point is (black, hover blue, selected yellow, the same size); no ring round it while Show Grading is off (the default); no dot on a hidden reference line", async () => {
  const r = await read();
  const out = boot({ script: RECORD + `
    const r = ${JSON.stringify(r)}, out = {};
    out.view = S.show.grading;
    app.ev("zprjTake")("graded.zprj", r, {});
    const imp = S.pieces[0];
    app.push("Rectangle"); S.pieces.push(app.mkPiece("Mine", app.mkShape([{x:600,y:-400},{x:900,y:-400},{x:900,y:0},{x:600,y:0}], true))); app.commit();
    const nat = S.pieces[1];
    app.ev("setTool")("edit_pattern");
    const look = (p, i) => { S.sel = [p.id]; S.selPt = -1; S.hover = null; const plain = at(p.pts[i]);
      S.hover = { k: "pt", p, kind: "outline", int: -1, i }; const hover = at(p.pts[i]); S.hover = null;
      S.selPt = i; S.selKind = "outline"; S.selInt = -1; const sel = at(p.pts[i]); S.selPt = -1; return { plain, hover, sel }; };
    out.imp = look(imp, 1); out.nat = look(nat, 1);
    out.graded = app.ev("isGraded")(imp);
    // the hidden reference line (reference lines come in hidden): nothing drawn where its points are
    S.sel = [imp.id]; out.refShown = S.show.reference; out.ref = at(imp.bases[0].pts[0]);
    // the curve points: only with Edit Curve Point
    out.cp = at(imp.segs[0].cps[0]); app.ev("setTool")("edit_curve_point"); out.cpEdit = at(imp.segs[0].cps[0]); app.ev("setTool")("edit_pattern");
    // Show Grading on: a ring round each grade point of the selected pattern (a guess), still none on the hidden line
    S.show.grading = true; out.ring = at(imp.pts[1]); out.refRing = at(imp.bases[0].pts[0]);
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  assert.strictEqual(o.view, false, "Show Grading is off in a fresh window"); assert.strictEqual(o.graded, true);
  assert.deepStrictEqual(o.imp, o.nat, "an imported point and a native one are painted alike, plain, under the pointer and selected");
  assert.deepStrictEqual(o.nat.plain.map(m => m[1]).filter(Boolean), ["#1a1a1a"]); assert.deepStrictEqual(o.nat.sel.map(m => m[1]).filter(Boolean), ["#ecfd3f"]);
  assert.ok(o.nat.plain.every(m => m[0] < 6), "no ring: every circle drawn there is the point itself: " + JSON.stringify(o.nat.plain));
  assert.deepStrictEqual([o.refShown, o.ref], [false, []], "no dot where the hidden reference line's point is");
  assert.deepStrictEqual([o.cp.length, o.cpEdit.length > 0], [0, true], "curve points only under Edit Curve Point");
  // (Round r16, I2/1: every size's grade points are dots in that size's colour, on every graded pattern; the base's here, dark.
  // It was a green ring of 6 px round the selected pattern's grade points.)
  assert.ok(o.ring.some(m => m[0] === 3 && m[1] === "#1a1a1a"), "with Show Grading on, the grade point has its dot: " + JSON.stringify(o.ring));
  assert.ok(!o.ring.some(m => m[0] === 6), "no ring");
  assert.deepStrictEqual(o.refRing, []);
});

test("I2-1 picking a size in the Grading panel shows that size with Show Grading off, and does not turn Show Grading on", async () => {
  const r = await read();
  const out = boot({ script: RECORD + `
    const r = ${JSON.stringify(r)};
    app.ev("zprjTake")("graded.zprj", r, {});
    const G = S.grading, z = G.groups[0].sizes[0];
    G.active = z.id; const q = app.ev("gradedPiece")(G, S.pieces[0], z.id);
    const lines = []; const c2 = app.ev("ctx"); c2.stroke = () => lines.push(c2.strokeStyle); app.ev("draw")();
    return { view: S.show.grading, drawnInItsColour: lines.filter(c => c === app.ev("gradeLook")(G, G.groups[0], z).color).length, moved: q.pts[1] };` });
  assert.deepStrictEqual(out.errors, []);
  assert.strictEqual(out.result.view, false); assert.ok(out.result.drawnInItsColour >= 1, "the picked size's outline is drawn");
});


/* ---- I2-2: Show Grading as the file's program shows it ---- */
// a colour's hue (degrees) and lightness (0 to 1)
const hsl = (c) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return { h: null, l }; const d = mx - mn; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return { h, l }; };

test("I2-2 each size's line: the base dark and thick, smaller sizes in blues and dashed, larger ones in oranges and solid, lighter the further from the base: no red against green, and the dashes say it without colour", async () => {
  const out = boot({ script: `
    const G = S.grading, look = app.ev("gradeLook");
    const g = { id: 1, name: "Size Group", base: 15, sizes: [44, 46, 48, 50, 52, 54, 56, 58].map((n, i) => ({ id: 12 + i, name: String(n), color: "#000000" })) };
    return g.sizes.map(z => [z.name, look(G, g, z)]);` });
  assert.deepStrictEqual(out.errors, []);
  const L = Object.fromEntries(out.result);
  assert.deepStrictEqual([L["50"].kind, L["50"].color, L["50"].width, L["50"].dash], ["base", "#1a1a1a", 2.4, []]);
  for (const n of ["44", "46", "48"]) { assert.strictEqual(L[n].kind, "smaller"); assert.ok(L[n].dash.length === 2, n + " dashed"); const h = hsl(L[n].color).h; assert.ok(h >= 195 && h <= 225, n + " is a blue: " + h); }
  for (const n of ["52", "54", "56", "58"]) { assert.strictEqual(L[n].kind, "larger"); assert.deepStrictEqual(L[n].dash, [], n + " solid"); const h = hsl(L[n].color).h; assert.ok(h >= 15 && h <= 35, n + " is an orange: " + h); }
  assert.ok(hsl(L["44"].color).l > hsl(L["48"].color).l && hsl(L["58"].color).l > hsl(L["52"].color).l, "the further from the base, the lighter");
  assert.ok(Object.values(L).every(x => x.width >= 1.2 && x.width < L["50"].width || x.kind === "base"), "the base is the thickest");
});

test("I2-2 with Show Grading on every size but the hidden ones is drawn at once over the base, in its own line, the base emphasised; off, only the size picked", async () => {
  const r = await read();
  const out = boot({ script: `
    const r = ${JSON.stringify(r)}, out = {};
    app.ev("zprjTake")("graded.zprj", r, {});
    const G = S.grading, g = G.groups[0], look = app.ev("gradeLook"), c = app.ev("ctx"), lines = [];
    c.stroke = () => lines.push([c.strokeStyle, c.lineWidth, (c.__dash || []).length]); c.setLineDash = (d) => { c.__dash = d; };
    const drawn = () => { lines.length = 0; app.ev("draw")(); return lines.slice(); };
    const col = (n) => look(G, g, g.sizes.find(z => z.name === n)).color;
    S.sel = [];
    S.show.grading = true; let L = drawn();
    out.on = ["S", "L"].map(n => L.filter(x => x[0] === col(n)).length > 0); out.base = L.some(x => x[0] === "#1a1a1a" && x[1] === 2.4); out.sDashed = L.some(x => x[0] === col("S") && x[2] === 2);
    g.sizes[0].hidden = true; L = drawn(); out.hidden = L.filter(x => x[0] === col("S")).length;
    delete g.sizes[0].hidden; S.show.grading = false; L = drawn(); out.off = ["S", "L"].map(n => L.filter(x => x[0] === col(n)).length);
    G.active = g.sizes[2].id; L = drawn(); out.picked = [L.filter(x => x[0] === col("L") && x[1] === 2.2).length > 0, L.filter(x => x[0] === col("S")).length];
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  assert.deepStrictEqual(o.on, [true, true], "both other sizes drawn"); assert.strictEqual(o.base, true, "the base drawn thick and dark"); assert.strictEqual(o.sDashed, true, "the smaller size dashed");
  assert.strictEqual(o.hidden, 0, "a hidden size is not drawn");
  assert.deepStrictEqual(o.off, [0, 0], "Show Grading off: no other size"); assert.deepStrictEqual(o.picked, [true, 0], "the size picked is drawn (thicker), the others not");
});

// (Round r33 / 4) graded on the size run every document had before r33 (a document starts with none since): oldSizeRun
test("I2-2 the Grading tab is laid out as the Size panel: + Add and Assign; the group as a tree; a row a size with its line, an eye, the base box and (Base), delete; the eye hides a size, in undo and in the file", async () => {
  const r = await read();
  const out = boot({ oldSizeRun: true,  script: `
    const r = ${JSON.stringify(r)}, out = {};
    out.fresh = app.ev("gradingPanel")(null);
    app.ev("zprjTake")("graded.zprj", r, {});
    const p = S.pieces[0], G = S.grading, g = G.groups[0];
    S.ui.unbuilt = false; const html = app.ev("gradingPanel")(p);
    out.has = ["Size</span>", 'id="g-add"', 'id="g-assign"', "\u25be Body sizes", "(Base)", 'data-act="eye"', 'class="gbase"', 'data-act="delsize"', 'data-act="menu"', 'id="g-review"', "More"].map(k => html.includes(k));
    out.rows = (html.match(/data-zrow=/g) || []).length; out.checked = (html.match(/class="gbase"[^>]*checked/g) || []).length;
    out.nb = [html.includes("Pair Avatar"), html.includes("not built yet")];
    S.ui.unbuilt = true; const nbHtml = app.ev("gradingPanel")(p); out.nbOn = [nbHtml.includes("Pair Avatar"), nbHtml.includes("Lock (not built yet)")];
    // the eye: one undo step, kept in the file
    app.push("Hide size"); g.sizes[2].hidden = true; app.commit();
    const doc = JSON.parse(app.ev("docJSON")()); out.saved = doc.grading.groups[0].sizes.map(z => !!z.hidden);
    app.undo(); out.undone = S.grading.groups[0].sizes.map(z => !!z.hidden);
    // a file with the old name of the placeholder group
    out.renamed = app.ev("normGrading")({ groups: [{ id: 1, name: "Sizes (placeholder)", base: 1, sizes: [{ id: 1, name: "M", color: "#123456" }] }] }).groups[0].name;
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  assert.ok(!/placeholder/.test(o.fresh) && o.fresh.includes("\u25be Size Group"), "a new document's group is called Size Group, not (placeholder)");
  assert.deepStrictEqual(o.has, Array(11).fill(true));
  assert.strictEqual(o.rows, 3); assert.strictEqual(o.checked, 1, "the base box ticked on the base alone");
  assert.deepStrictEqual(o.nb, [false, false], "what is not built is not shown while Show Tools That Are Not Built Yet is off"); assert.deepStrictEqual(o.nbOn, [true, false]);      // (a size's Lock is built since Round r20 / 6)
  assert.deepStrictEqual(o.saved, [false, false, true]); assert.deepStrictEqual(o.undone, [false, false, false]);
  assert.strictEqual(o.renamed, "Size Group");
});

module.exports = T;
