// Round I: the project-file import. I1: no key the importer reads is needed but what a pattern can't exist without; a
// missing one gets a default, is counted and named in the report; one bad pattern is left out and named, the rest come in.
// The files here are made by zprj-make.js from the layout in docs/zprj-format.md: no file of another program is used.
// Tests on real project files are kept outside the released tests, and skip when the files are not there.
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
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after " + (ms || 60000)/1000 + " s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
const ring = (n) => Array.from({ length: n }, (_, k) => ({ start: k, end: (k + 1) % n }));
const SQUARE = { name: "Pattern_1", annotation: "Square", points: [[-250, -250], [250, -250], [250, 250], [-250, 250]], lines: ring(4) };
// everything the importer reads, once: curves, allowance, notches, an internal line, a reference line, a placement
const SLEEVE = {
  name: "SLEEVE_7", annotation: "Sleeve", transform: [0, 1, 0, 1, 0, 0, 400, 100, 1],
  points: [[0, 0], [300, 0], [320, 400], [-20, 400]],
  lines: [
    { start: 0, end: 1, cps: [[80, -60], [150, -75], [230, -55]], sa: [10, 10], notches: [{ at: [150, -75], alpha: 0.5 }] },
    { start: 1, end: 2, sa: [10, 5] },
    { start: 2, end: 3, cps: [[150, 415]] },
    { start: 3, end: 0, sa: [10, 10], notches: [{ at: [-10, 200], alpha: 0.5 }] },
  ],
  inner: [{ name: "Internal_3", transform: [1, 0, 0, 0, 1, 0, 50, 100, 1], points: [[0, 0], [200, 0], [200, 50]], lines: [{ start: 0, end: 1, cps: [[100, 20]] }, { start: 1, end: 2 }] }],
  dummy: [{ name: "Baseline_2", sa: false, points: [[0, 200], [300, 200]], lines: [{ start: 0, end: 1 }] }],
};
const read = (patterns, extra) => ZPRJ.importZprj(MK.zprj([], { pac: MK.pac(patterns, extra) }));

test("I1 a file whose lines have no seam allowance offsets opens: allowance 0, and the report says which default stood in how often", async () => {
  const r = await read([{ ...SLEEVE, omit: ["fSAStartOffset", "fSAEndOffset"] }, SQUARE]);
  assert.strictEqual(r.pieces.length, 2); assert.deepStrictEqual(r.skipped, []); assert.strictEqual(r.total, 2);
  assert.deepStrictEqual(r.pieces[0].lines.map(l => l.seamAllowance), [[0, 0], [0, 0], [0, 0], [0, 0]]);
  assert.deepStrictEqual(r.defaults, { fSAStartOffset: 4, fSAEndOffset: 4 }, "only the sleeve's four lines lacked them");
  assert.ok(ZPRJ.DEFAULTS.fSAStartOffset && /0/.test(ZPRJ.DEFAULTS.fSAStartOffset));
});

test("I1 every optional key, left out one at a time, still gives the pattern, with a default that is counted", async () => {
  const cases = [
    { omit: ["iLineType"], key: "iLineType", check: (p) => assert.deepStrictEqual(p.lines.map(l => l.curved), [true, false, true, false], "a line with curve points is taken as curved") },
    { omit: ["listNotch"], key: "listNotch", check: (p) => assert.deepStrictEqual(p.lines.map(l => l.notches.length), [0, 0, 0, 0]) },
    { omit: ["v2StartPosition"], key: "v2StartPosition", check: (p) => assert.deepStrictEqual(p.lines[0].notches[0].position, null) },
    { omit: ["fAlpha"], key: "fAlpha", check: (p) => assert.deepStrictEqual(p.lines[0].notches[0].position, [150, -75]) },
    { omit: ["fLength", "fLocalAngle", "uiNotchType"], key: "fLength", check: (p) => assert.deepStrictEqual(p.lines[0].notches[0], { position: [150, -75], length: null, angle: 90, type: null, alpha: 0.5 }) },
    { drop: "baSAPositions", key: "baSAPositions", check: (p) => assert.deepStrictEqual(p.cutLine, []) },
    { drop: "mapTransformer2D", key: "mapTransformer2D", check: (p) => assert.deepStrictEqual(p.transform, MK.ID) },
    { dropP: ["listInnerShape"], key: "listInnerShape", check: (p) => assert.strictEqual(p.internalLines.length, 0) },
    { dropP: ["listDummyShape"], key: "listDummyShape", check: (p) => assert.strictEqual(p.referenceLines.length, 0) },
    { dropP: ["mapElement"], key: null, check: (p) => assert.deepStrictEqual([p.name, p.annotation], ["", "Sleeve"]) },
    { dropP: ["mapAnnoForPatternName"], key: null, check: (p) => assert.deepStrictEqual([p.name, p.annotation], ["SLEEVE_7", null]) },
  ];
  for (const c of cases) {
    const r = await read([{ ...SLEEVE, omit: c.omit, drop: c.drop, dropP: c.dropP }]);
    const what = JSON.stringify(c.omit || c.drop || c.dropP);
    assert.strictEqual(r.pieces.length, 1, what + ": the pattern comes through"); assert.deepStrictEqual(r.skipped, [], what);
    if (c.key) assert.ok(r.defaults[c.key] >= 1, what + ": counted as a default"); else assert.ok(!Object.keys(r.defaults).length, what + ": an ordinary absence, not counted");
    c.check(r.pieces[0]);
  }
  // the whole thing in the app's hands: notches without a place go by their share of the line
  const r = await read([{ ...SLEEVE, omit: ["v2StartPosition"] }]);
  const out = boot({ script: `const r = ${JSON.stringify(r)}; app.ev("zprjTake")("x.zprj", r, {}); const p = S.pieces[0]; return { n: p.segs.map(s => s.notches.length), t: p.segs[0].notches[0], at: app.ev("tAtFrac")(p, 0, 0.5) };` });
  assert.deepStrictEqual(out.errors, []); assert.deepStrictEqual(out.result.n, [1, 0, 0, 1]); assert.ok(Math.abs(out.result.t - out.result.at) < 1e-9);
});

test("I1 what a pattern can't exist without loses only that pattern, named with its reason; a bad internal line loses only itself", async () => {
  for (const [d, why] of [[{ drop: "listPoint" }, /missing key listPoint/], [{ drop: "listLine" }, /missing key listLine/], [{ omit: ["uiStartPointIndex"] }, /line 1: missing key uiStartPointIndex/]]) {
    const r = await read([SQUARE, { ...SLEEVE, ...d }, { ...SQUARE, name: "Pattern_9", annotation: "Second" }]);
    assert.deepStrictEqual(r.pieces.map(p => p.annotation), ["Square", "Second"], JSON.stringify(d)); assert.strictEqual(r.total, 3);
    assert.strictEqual(r.skipped.length, 1); assert.strictEqual(r.skipped[0].index, 1); assert.strictEqual(r.skipped[0].name, "Sleeve"); assert.ok(why.test(r.skipped[0].reason), r.skipped[0].reason);
  }
  // a line that runs to a point that is not there
  const bad = { ...SQUARE, annotation: "Broken", lines: [{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 7 }, { start: 7, end: 0 }] };
  const r2 = await read([bad, SQUARE]);
  assert.deepStrictEqual([r2.pieces.length, r2.skipped[0].name], [1, "Broken"]); assert.ok(/point 8, which is not there/.test(r2.skipped[0].reason), r2.skipped[0].reason);
  // an internal line whose points lack their places: the pattern comes in without it, and the report says so
  const r3 = await read([{ ...SLEEVE, inner: [{ name: "Torn", points: [[0, 0], [1, 1]], lines: [{ start: 0, end: 5 }] }, ...SLEEVE.inner] }]);
  assert.strictEqual(r3.pieces.length, 1); assert.deepStrictEqual(r3.pieces[0].internalLines.map(l => l.name), ["Internal_3"]);
  assert.strictEqual(r3.pieces[0].left.length, 1); assert.ok(/internal line Torn: a line runs to point 6/.test(r3.pieces[0].left[0]), r3.pieces[0].left[0]);
  // nothing at all to read: still an unknown layout, not "nothing imported"
  await assert.rejects(ZPRJ.importZprj(MK.zprj([], { pac: MK.map({ mapPatternEditor: MK.map({}) }).bytes })), (e) => e.code === "unknown");
});

test("I1 a zipper's tapes are not cut patterns: they are skipped and named; the zipper, graphics and trims are listed as not imported", async () => {
  const zipper = MK.list([MK.map({ qsName: MK.str("Zip_7") })]), graphics = MK.list([MK.map({ qsName: MK.str("logo") })]);
  const r = await read([SQUARE, { ...SQUARE, name: "ZipperPattern_5", annotation: undefined, tape: true }], { listZipper: zipper, listMVGraphic: graphics, listTrimObject: MK.list([]) });
  assert.strictEqual(r.pieces.length, 1); assert.strictEqual(r.total, 2);
  assert.deepStrictEqual(r.skipped, [{ index: 1, name: "ZipperPattern_5", reason: "a zipper tape: zippers are not imported", kind: "tape" }]);
  assert.deepStrictEqual(r.others, { zippers: ["Zip_7"], graphics: 1, trims: 0 });
});

test("I1 in the app: the report's first line is 'Imported N of M patterns; skipped: name (reason); defaults used: key × count', and 'Nothing imported' only when nothing could be read", async () => {
  const r = await read([{ ...SLEEVE, omit: ["fSAStartOffset", "fSAEndOffset"] }, { ...SQUARE, drop: "listPoint", annotation: "Lost" }, { ...SQUARE, name: "ZipperPattern_5", annotation: undefined, tape: true }], { listZipper: MK.list([MK.map({ qsName: MK.str("Zip_7") })]) });
  const none = await read([{ ...SQUARE, drop: "listPoint" }]);
  const out = boot({ script: `
    const out = {};
    out.rep = app.ev("zprjTake")("swim.zprj", ${JSON.stringify(r)}, {});
    out.summary = app.ev("zprjSummary")(out.rep); out.names = S.pieces.map(p => p.name); out.undo = S.undo.length;
    out.none = app.ev("zprjTake")("none.zprj", ${JSON.stringify(none)}, {}); out.undo2 = S.undo.length;
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  assert.deepStrictEqual(o.names, ["Sleeve"]); assert.strictEqual(o.undo, 1);
  assert.strictEqual(o.summary, "Imported 1 of 3 patterns; skipped: Lost (missing key listPoint), ZipperPattern_5 (a zipper tape: zippers are not imported); defaults used: fSAStartOffset × 4, fSAEndOffset × 4");
  const m = out.modals[0];
  assert.strictEqual(m.title, "Imported swim.zprj");
  for (const part of ["Imported 1 of 3 patterns", "Skipped:", "Lost (missing key listPoint)", "Defaults used where the file has no value:", "fSAStartOffset × 4: seam allowance 0", "1 zipper (Zip_7)", "not imported"]) assert.ok(m.text.includes(part), part + " in: " + m.text);
  assert.strictEqual(o.none, null); assert.strictEqual(o.undo2, 1, "nothing to take: no undo step");
  assert.strictEqual(out.modals[1].title, "Nothing imported"); assert.ok(/Imported 0 of 1 pattern; skipped: Square \(missing key listPoint\)/.test(out.modals[1].text), out.modals[1].text);
});

module.exports = T;

/* ---- I2: a .zpac (the garment archive a .zprj holds) opens the same way ---- */
test("I2 a .zpac is read by the same reader as a .zprj, to the same patterns; which one it is is told by what it holds, not by its name", async () => {
  const a = await ZPRJ.importZprj(MK.zprj([SLEEVE, SQUARE])), b = await ZPRJ.importZprj(MK.zpac([SLEEVE, SQUARE]));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(a)));
  assert.strictEqual(ZPRJ.isProject(MK.zprj([SQUARE])), true); assert.strictEqual(ZPRJ.isProject(MK.zpac([SQUARE])), true);
  assert.strictEqual(ZPRJ.isProject(MK.zip([{ name: "document.json", data: Buffer.from("{}") }])), false, "a pattern file of ours is not a project file");
  assert.strictEqual(ZPRJ.isProject(Buffer.from("plain text")), false); assert.strictEqual(ZPRJ.isProject(Buffer.alloc(0)), false);
  // refused as before: protected pattern data, an archive with neither a .zpac nor a .pac in it
  await assert.rejects(ZPRJ.importZprj(MK.zpac([SQUARE], { encrypted: "pac" })), (e) => e.code === "encrypted");
  await assert.rejects(ZPRJ.importZprj(MK.zip([{ name: "texture.png", data: Buffer.from("x") }])), (e) => e.code === "not-zprj" && /\.zprj or \.zpac/.test(e.message));
});

test("I2 in the app: File > Import takes .zprj and .zpac; File > Open takes them too (the import dialog, Append off); a dropped file goes by its kind", async () => {
  const zpac = MK.zpac([SLEEVE, SQUARE]).toString("base64"), pdraftLike = MK.zip([{ name: "document.json", data: Buffer.from("{}") }]).toString("base64");
  const out = boot({ streams: true, script: `return (async () => {
    const out = { dlg: [], read: [], toasts: [] };
    const bytes = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    out.isProj = [app.ev("zprjFile")("x.zpac", null), app.ev("zprjFile")("x.ZPRJ", null), app.ev("zprjFile")("x.pdraft", bytes("${pdraftLike}")), app.ev("zprjFile")("garment.bin", bytes("${zpac}"))];
    // File > Open with a .zpac: read off the window's thread (here: in the page), then the import dialog, Append off
    app.answer = (title, fields, opts) => { out.dlg.push([title, (opts.checks || []).find(c => c.k === "append").val]); return { append: false, sa: true, notches: true, internals: true, refs: true }; };
    app.ev("openFile")("garment.zpac", bytes("${zpac}"));
    await app.wait(() => S.pieces.length === 2, "the import");
    out.names = S.pieces.map(p => p.name); out.undo = S.undo.length;
    // a drop: a .zpac is imported (Append on, as File > Import), a .txt is refused with a word
    app.ev("globalThis").FileReader = class { readAsArrayBuffer(f) { out.read.push(f.name); this.result = f.bytes.buffer; setTimeout(() => this.onload(), 0); } readAsText(f) { out.read.push(f.name); this.result = ""; setTimeout(() => this.onload(), 0); } };
    app.answer = (title, fields, opts) => { out.dlg.push([title, (opts.checks || []).find(c => c.k === "append").val]); return { append: true, sa: true, notches: true, internals: true, refs: true }; };
    app.ev("dropFiles")([{ name: "dropped.zpac", bytes: bytes("${zpac}") }, { name: "notes.txt", bytes: new Uint8Array(0) }]);
    await app.wait(() => S.pieces.length === 4, "the dropped file");
    out.after = S.pieces.length; out.undo2 = S.undo.length;
    out.menu = app.MENUS.file().find(x => x && x.n === "Import").menu().filter(Boolean).map(x => x.n || "").filter(n => /zprj/.test(n));
    return out; })();` });
  assert.deepStrictEqual(out.errors, [], JSON.stringify(out.errors));
  const o = out.result;
  assert.deepStrictEqual(o.isProj, [true, true, false, true], "by name, or by what the archive holds: " + JSON.stringify(o.isProj));
  assert.deepStrictEqual(o.dlg, [["Open project (.zprj, .zpac)", false], ["Import project (.zprj, .zpac)", true]]);
  assert.deepStrictEqual(o.names, ["Sleeve", "Square"]); assert.strictEqual(o.undo, 1);
  assert.deepStrictEqual(o.read, ["dropped.zpac"], "the text file is not read"); assert.strictEqual(o.after, 4); assert.strictEqual(o.undo2, 2);
  assert.ok(out.toasts.some(t => /Not opened: notes\.txt/.test(t)), JSON.stringify(out.toasts));
  assert.deepStrictEqual(o.menu, ["Import .zprj / .zpac…"]);
});

/* ---- I3: grading from the file: its sizes, its base, every point's and curve point's place in every size ---- */
// a pattern in three sizes S, M, L (M the base: as drawn): the corners move apart, the curve's two curve points each in a
// way of their own (not in proportion to the ends), an internal line moves too; placed with a mirrored quarter turn
const QT = [0, 1, 0, 1, 0, 0, 400, 100, 1];
const GRADED = {
  name: "BODY_1", annotation: "Body", transform: QT, gradeRule: "Body sizes",
  points: [[0, 0], [300, 0], [300, 400], [0, 400]],
  sizes: [[[5, 5], [0, 0], [-6, -5]], [[290, 4], [300, 0], [312, -5]], [[292, 390], [300, 400], [311, 412]], [[6, 392], [0, 400], [-5, 410]]],
  lines: [
    { start: 0, end: 1, cps: [[100, -30], [200, -30]], cpSizes: [[[100, -20], [100, -30], [99, -45]], [[195, -22], [200, -30], [210, -41]]] },
    { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 0 },
  ],
  inner: [{ name: "Pocket", transform: [1, 0, 0, 0, 1, 0, 50, 100, 1], points: [[0, 0], [100, 0]], sizes: [[[2, 1], [0, 0], [-3, -1]], [[96, 1], [100, 0], [104, -1]]], lines: [{ start: 0, end: 1 }] }],
};
const TABLE = MK.list([MK.ruleTable({ name: "Body sizes", sizes: ["S", "M", "L"], base: 1, current: 2, colors: [[1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1]] })]);

test("I3 the importer reads the file's size table (names, colours, base, the size shown) and every point's and curve point's place in every size", async () => {
  const r = await read([GRADED, SQUARE], { listRuleTables: TABLE });
  assert.deepStrictEqual(r.grading, { tables: [{ name: "Body sizes", sizes: [{ name: "S", color: "#ff0000" }, { name: "M", color: "#00ff00" }, { name: "L", color: "#0000ff" }], base: 1, current: 2 }] });
  const p = r.pieces[0];
  assert.strictEqual(p.gradeRule, "Body sizes");
  assert.deepStrictEqual(p.pointSizes[1], [[290, 4], [300, 0], [312, -5]]);
  assert.deepStrictEqual(p.lines[0].curveSizes, GRADED.lines[0].cpSizes);
  assert.deepStrictEqual(p.internalLines[0].shape.pointSizes[1], [[146, 101], [150, 100], [154, 99]], "an internal line's places, through its own placement");
  // the square has no places by size in a graded file: each of its points is counted as not graded
  assert.strictEqual(r.defaults.arrSizeSpecificPosition, 4); assert.deepStrictEqual(r.pieces[1].pointSizes, [null, null, null, null]);
  // a file with one size, or none: not graded, nothing counted
  const one = await read([{ ...GRADED, sizes: GRADED.sizes.map(s => [s[1]]) }], { listRuleTables: MK.list([MK.ruleTable({ name: "One", sizes: ["M"], base: 0 })]) });
  assert.strictEqual(one.grading, null); assert.strictEqual(one.pieces[0].pointSizes, null); assert.deepStrictEqual(one.defaults, {});
});

test("I3 in the app: the file's sizes become the document's size group, and every size of every pattern is the file's outline in that size, curve points too; saved and opened again the same", async () => {
  const r = await read([GRADED, SQUARE], { listRuleTables: TABLE });
  const out = boot({ script: `
    const r = ${JSON.stringify(r)}, out = {};
    out.rep = app.ev("zprjTake")("graded.zprj", r, {});
    const G = S.grading, grp = G.groups[0], gp = app.ev("gradedPiece"), ZPRJ = app.ev("ZPRJ");
    out.groups = G.groups.map(g => [g.name, g.sizes.map(z => [z.name, z.color]), (g.sizes.find(z => z.id === g.base) || {}).name]);
    out.active = (app.ev("gSize")(G, G.active) || {}).name || null;
    const X = (q) => { const w = ZPRJ.applyTransform(r.pieces[0].transform, q); return { x: w[0], y: -w[1] }; };      // (the file's window is y up)
    const off = (doc) => {
      const p = doc.pieces[0], G2 = doc.grading, g2 = G2.groups[0];
      let worst = 0;
      g2.sizes.forEach((z, si) => {
        const q = gp(G2, p, z.id) || p, zp = r.pieces[0];
        zp.lines.forEach((l, i) => { const w = X(zp.pointSizes[l.start][si]); worst = Math.max(worst, Math.hypot(q.pts[i].x - w.x, q.pts[i].y - w.y)); });
        zp.lines[0].curveSizes.forEach((c, j) => { const w = X(c[si]); worst = Math.max(worst, Math.hypot(q.segs[0].cps[j].x - w.x, q.segs[0].cps[j].y - w.y)); });
        const il = q.internals[0], zi = zp.internalLines[0].shape;
        zi.points.forEach((_, j) => { const w = X(zi.pointSizes[j][si]); worst = Math.max(worst, Math.hypot(il.pts[j].x - w.x, il.pts[j].y - w.y)); });
      });
      return worst;
    };
    out.worst = off({ pieces: S.pieces, grading: G });
    out.squareGraded = app.ev("isGraded")(S.pieces[1]);
    // saved and read again
    const doc = JSON.parse(app.ev("docJSON")()), was = JSON.stringify([S.pieces.map(p => p.grade), S.grading]);
    app.ev("loadDoc")(doc); out.worstAgain = off({ pieces: S.pieces, grading: S.grading });
    out.same = JSON.stringify([S.pieces.map(p => p.grade), S.grading]) === was;
    // a size put between S and M: the curve points get theirs, half-way
    const G3 = S.grading, g3 = G3.groups[0];
    const nz = app.ev("insertSize")(G3, S.pieces, g3.id, g3.sizes[1].id, "S/M");
    const mid = gp(G3, S.pieces[0], nz.id), sm = gp(G3, S.pieces[0], g3.sizes[0].id), base = S.pieces[0];
    out.half = Math.hypot(mid.segs[0].cps[1].x - (sm.segs[0].cps[1].x + base.segs[0].cps[1].x)/2, mid.segs[0].cps[1].y - (sm.segs[0].cps[1].y + base.segs[0].cps[1].y)/2);
    // a curve point added to the graded curve: its curve points travel with the ends again, nothing breaks
    S.pieces[0].segs[0].cps.push({ x: S.pieces[0].segs[0].cps[1].x + 1, y: S.pieces[0].segs[0].cps[1].y + 30 });
    out.after = gp(G3, S.pieces[0], g3.sizes[0].id).segs[0].cps.length;
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  assert.deepStrictEqual(o.groups, [["Body sizes", [["S", "#ff0000"], ["M", "#00ff00"], ["L", "#0000ff"]], "M"]], "the placeholder size run gives way to the file's");
  assert.strictEqual(o.active, "L", "the size the file was saved showing");
  assert.ok(o.worst < 1e-3, "every point, curve point and internal line point where the file has it, in every size: " + o.worst);
  assert.ok(o.worstAgain < 1e-3, "the same after saving and reading again: " + o.worstAgain); assert.strictEqual(o.same, true);
  assert.strictEqual(o.squareGraded, false, "a pattern with no places by size is not graded");
  assert.ok(o.half < 1e-6, "a new size between two: half-way, curve points too: " + o.half);
  assert.strictEqual(o.after, 3);
  assert.strictEqual(o.rep.graded, 1); assert.deepStrictEqual(o.rep.sizes, { name: "Body sizes", names: ["S", "M", "L"], base: "M" });
  assert.ok(out.modals[0].text.includes("Grading: 1 pattern in 3 sizes (S, M, L; base M)"), out.modals[0].text);
});

test("I3 grading can be left out of an import; a second graded import into a graded document adds its size group beside the first", async () => {
  const r = await read([GRADED], { listRuleTables: TABLE });
  const out = boot({ script: `
    const r = ${JSON.stringify(r)}, out = {};
    app.ev("zprjTake")("a.zprj", r, { grading: false }); out.off = [app.ev("isGraded")(S.pieces[0]), S.grading.groups.map(g => g.name)];
    app.ev("zprjTake")("b.zprj", r, {}); out.one = S.grading.groups.map(g => g.name);
    app.ev("zprjTake")("c.zprj", r, {}); out.two = S.grading.groups.map(g => g.name); out.groupsOf = S.pieces.map(p => p.grade ? S.grading.groups.findIndex(g => g.id === p.grade.group) : -1);
    app.undo(); out.undone = [S.pieces.length, S.grading.groups.length];
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  // (Round r33 / 4) a document starts with no size group, so grading left out leaves none (before r33: the placeholder "Size Group")
  assert.deepStrictEqual(o.off, [false, []]);
  assert.deepStrictEqual(o.one, ["Body sizes"], "no pattern graded yet: the placeholder size run gives way to the file's");
  assert.deepStrictEqual(o.two, ["Body sizes", "Body sizes"], "a pattern graded: the file's group is added beside it"); assert.deepStrictEqual(o.groupsOf, [-1, 0, 1]);
  assert.deepStrictEqual(o.undone, [2, 1], "one undo step takes the import and its size group back");
});

/* ---- I4: the rest: upright placement, grainlines, symmetric pairs, sewing, fabrics ---- */
const readM = (patterns, more, extra) => ZPRJ.importZprj(MK.zprj([], { pac: MK.pac(patterns, extra, more) }));
// a front panel and its mirrored twin (the same shape in its own coordinates, placed mirrored), and a back sewn to both
const PANEL = { name: "FRONT", annotation: "Front", transform: [1, 0, 0, 0, 1, 0, 0, 0, 1], points: [[0, 0], [200, 0], [220, 500], [0, 500]],
  lines: [{ start: 0, end: 1 }, { start: 1, end: 2, cps: [[215, 250]] }, { start: 2, end: 3 }, { start: 3, end: 0 }], grain: { angle: 270 }, fabric: 0 };
const TWIN = { ...PANEL, name: "FRONT_1", annotation: "Front 1", transform: [-1, 0, 0, 0, 1, 0, -50, 0, 1], grain: { angle: -270 } };
const BACK = { name: "BACK", annotation: "Back", transform: [1, 0, 0, 0, 1, 0, 400, 0, 1], points: [[0, 0], [220, 0], [220, 500], [0, 500]], lines: ring(4), grain: { angle: 0 }, fabric: 1 };
const SEAMS = [
  { name: "side", a: [{ pattern: 0, from: 1, to: 1, r0: 0, r1: 1, forward: true }], b: [{ pattern: 2, from: 3, to: 3, r0: 1, r1: 0, forward: false }] },
  { name: "centre", a: [{ pattern: 0, from: 3, to: 3, r0: 0, r1: 1, forward: true }], b: [{ pattern: 1, from: 3, to: 3, r0: 0, r1: 1, forward: true }] },
  { name: "round", a: [{ pattern: 2, from: 1, to: 3, r0: 0.5, r1: 0.5, forward: true }], b: [{ pattern: 1, from: 2, to: 0, r0: 0.5, r1: 0.5, forward: false }] },
  { name: "to a tape", a: [{ pattern: 3, from: 0, to: 0, r0: 0, r1: 1, forward: true }], b: [{ pattern: 2, from: 0, to: 0, r0: 0, r1: 1, forward: true }] },
];
const MORE = { symmetric: [1, 0, -1, -1], seams: SEAMS, fabrics: [{ name: "Twill", type: "Woven", content: "100% Cotton" }, { name: "Jersey", type: "Knit" }] };
const TAPE = { ...SQUARE, name: "ZipperPattern_9", annotation: undefined, tape: true };

test("I4 the importer reads grainlines, fabrics, symmetric pairs and seams as the file has them", async () => {
  const r = await readM([PANEL, TWIN, BACK, TAPE], MORE);
  assert.deepStrictEqual(r.pieces.map(p => [p.grain, p.fabric]), [[{ angle: 270, at: [0, 0] }, 0], [{ angle: -270, at: [0, 0] }, 0], [{ angle: 0, at: [0, 0] }, 1]]);
  assert.deepStrictEqual(r.fabrics, [{ name: "Twill", type: "Woven", content: "100% Cotton" }, { name: "Jersey", type: "Knit", content: "" }]);
  assert.deepStrictEqual(r.links, { symmetric: [[0, 1]], instances: [] });
  assert.strictEqual(r.seams.list.length, 4); assert.deepStrictEqual(r.seams.list[2].b, [{ pattern: 1, from: 2, to: 0, r0: 0.5, r1: 0.5, forward: false }]);
  // a seam run without its pattern's index: the seam is left out and named, the others come through
  const broken = await readM([PANEL, BACK], { seams: [SEAMS[0], { name: "torn", a: [{ pattern: 0, from: 0, to: 0, r0: 0, r1: 1, forward: true }], b: [] }] });
  assert.strictEqual(broken.seams.list.length, 1); assert.deepStrictEqual(broken.seams.left, ["torn: a side with nothing on it"]);
});

test("I4 in the app: patterns come in upright (the file's 2D window is y up); grainlines; the mirrored twin is a symmetric linked copy; seams sewn where the file sews them; fabrics into the library", async () => {
  const r = await readM([PANEL, TWIN, BACK, TAPE], MORE);
  const out = boot({ script: `
    const r = ${JSON.stringify(r)}, out = {};
    out.rep = app.ev("zprjTake")("set.zprj", r, {});
    app.checkDoc(S.pieces, S.seams);
    const P = (n) => S.pieces.find(p => p.name === n);
    // the file's y = 500 edge (the top in its window) is the top here: smaller y
    out.upright = [P("Front").pts[0].y, P("Front").pts[3].y];
    out.grain = ["Front", "Front 1", "Back"].map(n => Math.round(app.ev("grainAngle")(P(n).grain)));
    out.link = P("Front 1").link && [P("Front 1").link.kind, P("Front 1").link.of === P("Front").id];
    out.twinPts = P("Front 1").pts.map(q => [Math.round(q.x*1000)/1000, Math.round(q.y*1000)/1000]);
    // edited on the source, the twin follows, mirrored
    app.push("x"); P("Front").pts[1].x += 10; app.commit(); out.follows = Math.round(P("Front 1").pts[1].x*1000)/1000;
    const info = app.ev("seamInfo");
    out.seams = S.seams.map(sm => { const i = info(sm, S.pieces); return [sm.a.map(x => S.pieces.find(p => p.id === x.piece).name + (x.rev ? "<" : ">") + x.sids.length).join(), sm.b.map(x => S.pieces.find(p => p.id === x.piece).name + (x.rev ? "<" : ">") + x.sids.length).join(), Math.round(i.la), Math.round(i.lb)]; });
    out.fab = app.ev("libOf")().fabric.map(f => [f.name, f.physical, f.construction]); out.fabOf = S.pieces.map(p => (app.ev("libOf")().fabric.find(f => f.id === p.fabric) || {}).name || null);
    out.undo = S.undo.length; app.undo(); app.undo(); out.back = [S.pieces.length, S.seams.length];
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  assert.deepStrictEqual(o.upright, [0, -500], "the file's top is the top here");
  // Round r25 (the third check session, Number 17): the file's angle is measured from up the pattern in its own frame, anticlockwise, and
  // turned by the placement. These panels are not turned, so 270 and -270 (mirrored) lie across and 0 stands upright; before r25
  // the angle was read from level in the window, which gave [0, 0, 90] (the jacket's 270 came out upright only because its
  // patterns are placed turned 90°)
  assert.deepStrictEqual(o.grain, [90, 90, 0], "unturned: 270 and -270 across, 0 upright");
  assert.deepStrictEqual(o.link, ["symmetric", true]);
  assert.deepStrictEqual(o.twinPts, [[-50, 0], [-250, 0], [-270, -500], [-50, -500]], "the twin as the file places it: mirrored, 50 mm to the left");
  assert.strictEqual(o.follows, -260, "a point moved on the source moves on the twin, mirrored");
  assert.deepStrictEqual(o.seams, [["Front>1", "Back<1", 500, 500], ["Front>1", "Front 1>1", 500, 500], ["Back>3", "Front 1<3", 720, 715]], "the last: half of the back's line 2, all of 3, half of 4 (720); against it, half of the twin's line 3, its curve (made longer by the edit above), half of line 1");
  assert.deepStrictEqual(o.rep.seamLeft, ["to a tape (a pattern that was not imported)"]); assert.strictEqual(o.rep.seams, 3); assert.strictEqual(o.rep.seamsTotal, 4);
  assert.deepStrictEqual(o.fab.slice(-2), [["Twill", "Medium woven", "100% Cotton"], ["Jersey", "Single jersey", ""]], "added after the library's own default fabric"); assert.deepStrictEqual(o.fabOf, ["Twill", "Twill", "Jersey"]);
  assert.deepStrictEqual(o.back, [0, 0], "the import is one undo step, seams, links and fabrics with it");
  const m = out.modals[0].text;
  for (const part of ["1 symmetric pair: linked", "3 grainlines", "3 seams of 4 sewn", "Fabrics: Twill, Jersey", "Seams not sewn:", "to a tape (a pattern that was not imported)"]) assert.ok(m.includes(part), part + " in " + m);
});

test("I4 a pair that is not the same shape stays two patterns, named; links and sewing can be left out of an import", async () => {
  const odd = { ...TWIN, points: [[0, 0], [200, 0], [230, 500], [0, 500]] };
  const r = await readM([PANEL, odd, BACK], { ...MORE, seams: SEAMS.slice(0, 3) });
  const out = boot({ script: `
    const r = ${JSON.stringify(r)}, out = {};
    out.rep = app.ev("zprjTake")("odd.zprj", r, {}); out.links = S.pieces.filter(p => p.link).length;
    app.ev("zprjTake")("bare.zprj", r, { seams: false, links: false }); out.bare = [S.pieces.filter(p => p.link).length, S.seams.length];
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  assert.strictEqual(out.result.links, 0); assert.deepStrictEqual(out.result.rep.linkLeft, ["Front and Front 1 (10 mm apart)"]);
  assert.deepStrictEqual(out.result.bare, [0, 3], "the second import added no seam and no link");
});
