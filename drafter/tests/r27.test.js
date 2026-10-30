// Round r27: the big sweep: the exports' round trips on a whole garment, and what the command walk (scripts/sweep-browser.js) found.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-r27-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}

// the T-shirt example: every pattern's outline, written and read back
test("r27 / 3: DXF round trip on a whole garment: every pattern comes back with its outline's length within 0.5 %, its area within 1 % and its notches", () => {
  const o = boot({ three: true, blank: true, script: `
    const e = app.ev("shippedExamples")()[2]; app.ev("openExample")(e, true);
    const J = app.ev("dxfExport"), I = app.ev("dxfImport"), len = (p) => p.segs.reduce((a, s, i) => a + app.ev("segLen")(p, i), 0), area = (p) => Math.abs(app.ev("signedArea")(app.ev("flatten")(p, 20)));
    const text = J(S.pieces, { format: "aama", metric: true, sample: "M" }, S.grading), back = I(text, {});
    const list = Array.isArray(back) ? back : back.pieces;
    return { n: S.pieces.length, m: list.length, rows: S.pieces.map((p, i) => [p.name, len(p), len(list[i]), area(p), area(list[i]), p.segs.reduce((a, s) => a + (s.notches || []).length, 0), list[i].segs.reduce((a, s) => a + (s.notches || []).length, 0)]) };` });
  const r = o.result;
  assert.strictEqual(r.m, r.n);
  for (const [n, l0, l1, a0, a1, n0, n1] of r.rows) {
    assert.ok(Math.abs(l1 - l0)/l0 < 0.005, n + " outline " + l0 + " came back " + l1);
    assert.ok(Math.abs(a1 - a0)/a0 < 0.01, n + " area " + a0 + " came back " + a1);
    assert.strictEqual(n1, n0, n + " notches");
  }
});

test("r27 / 3: OBJ round trip on a whole garment: as many vertices and faces as the cloth, every index in range, every number finite; Single and Multiple agree", () => {
  const o = boot({ three: true, blank: true, script: `
    const e = app.ev("shippedExamples")()[2]; app.ev("openExample")(e, true);
    app.ev("setLayout")("both"); app.ev("garmentSync")();
    const G3 = app.ev("G3"); let v = 0, f = 0; for (const it of G3.items.values()) { v += it.X.length/3; f += it.mesh.tri.length/3; }
    return { v, f, one: app.ev("objText")(false, "single").text, many: app.ev("objText")(false, "multi").text };` });
  const { v, f } = o.result;
  assert.ok(v > 0);
  for (const text of [o.result.one, o.result.many]) {
    const L = text.split("\n"), V = L.filter(l => l.startsWith("v ")), F = L.filter(l => l.startsWith("f "));
    assert.strictEqual(V.length, v); assert.strictEqual(F.length, f);
    for (const l of V) assert.ok(l.split(" ").slice(1).every(x => Number.isFinite(+x)), l);
    for (const l of F) for (const c of l.split(" ").slice(1)) { const k = +c.split("/")[0]; assert.ok(k >= 1 && k <= v, l); }
  }
  assert.strictEqual(o.result.one.split("\n").filter(l => l.startsWith("v ")).join(), o.result.many.split("\n").filter(l => l.startsWith("v ")).join(), "the same vertices");
});

test("r27 / 3: PLT round trip on a whole garment: starts and ends as a plotter expects, and the outlines drawn come back at the marker's size (40 units a mm)", () => {
  const o = boot({ blank: true, script: `
    const e = app.ev("shippedExamples")()[2]; app.ev("openExample")(e, true);
    app.setMode("layout"); S.layout.paper = "rollc"; S.layout.customW = 1500; S.layout.margin = 10; app.layoutCmd("row");
    const r = app.ev("pltText")(app.ev("layFabNow")());
    return { text: r.text, n: r.n, length: r.length, width: r.width, count: S.pieces.length };` });
  const L = o.result.text.split("\n");
  assert.deepStrictEqual(L.slice(0, 2), ["IN;", "PA;"]);
  assert.strictEqual(L[L.length - 2], "PU;SP0;");
  assert.ok(o.result.n >= 1);
  const xy = o.result.text.match(/-?\d+,-?\d+/g).map(c => c.split(",").map(Number)), X = xy.map(c => c[0]), Y = xy.map(c => c[1]);
  assert.ok(Math.min(...X) >= 0 && Math.min(...Y) >= 0, "nothing off the roll");
  assert.ok(Math.max(...Y)/40 <= o.result.width + 10 + 1, "within the roll's width");
  assert.ok(Math.abs(Math.max(...X)/40 - o.result.length) <= 25, "the marker's length: " + Math.max(...X)/40 + " of " + o.result.length);
});

test("r27 / 3: PDF: the file's own numbers: the header, every object in the cross-reference at its place, the page's size in points at the size asked for", () => {
  const o = boot({ blank: true, script: `
    const pdf = app.ev("pdfOfJpeg")(new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]), 4, 2, 100, 50);
    return { bytes: Array.from(pdf) };` });
  const text = Buffer.from(o.result.bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-"));
  assert.ok(/%%EOF\s*$/.test(text));
  const xr = +/startxref\s+(\d+)/.exec(text)[1];
  assert.ok(text.slice(xr).startsWith("xref"));
  const rows = text.slice(xr).split("\n").filter(l => /^\d{10} \d{5} n/.test(l.trim()));
  rows.forEach((l, i) => assert.ok(text.slice(+l.slice(0, 10)).startsWith((i + 1) + " 0 obj"), "object " + (i + 1)));
  const box = /MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)/.exec(text);
  assert.ok(Math.abs(+box[1] - 100*72/25.4) < 0.5 && Math.abs(+box[2] - 50*72/25.4) < 0.5, box[0]);
});

// ---- what the command walk found ----
const RECT = `
  app.ev("openExample")(app.ev("shippedExamples")()[0], true);
  const P = S.pieces[0], J = app.ev("canonJSON");
`;
test("r27 / walk: Copy Grading on a pattern that is not graded does not throw (the point's menu, More ▸ Grading)", () => {
  const o = boot({ blank: true, script: RECT + `
    delete P.grade;
    return app.ev("ptDelta")(S.grading, P, P, 0, "x");` });
  assert.deepStrictEqual({ x: o.result.x, y: o.result.y }, { x: 0, y: 0 });
});
test("r27 / walk: Trace as Pattern on an open internal line makes no pattern and no step (it made one that could not be drawn, and the window stopped drawing); a closed one still does", () => {
  const o = boot({ blank: true, script: RECT + `
    const V = app.ev("V"), mk = app.ev("mkShape"), add = app.ev("addChild"), n = S.pieces.length, u = S.undo.length;
    add(P, "internals", mk([V(10, 10), V(40, 20)], false));
    const a = P.internals.length - 1; app.ev("traceSub")(P, "internal", a);
    const open = [S.pieces.length - n, S.undo.length - u, toasts[toasts.length - 1]];
    add(P, "internals", mk([V(10, 10), V(40, 10), V(40, 40)], true));
    app.ev("traceSub")(P, "internal", P.internals.length - 1); app.ev("draw")();
    return { open, closed: S.pieces.length - n };` });
  assert.strictEqual(o.result.open[0], 0); assert.strictEqual(o.result.open[1], 0); assert.ok(/does not close round/.test(o.result.open[2]));
  assert.strictEqual(o.result.closed, 1);
});
test("r27 / walk: a pattern with no pins cut in two keeps no empty list of pins: the document made is the document a file brings back", () => {
  const o = boot({ blank: true, script: RECT + `
    const V = app.ev("V"), b = app.ev("bboxOf")([P]), mk = app.ev("mkShape"), add = app.ev("addChild");
    S.seams = []; add(P, "internals", mk([V(b.x0 - 5, (b.y0 + b.y1)/2), V(b.x1 + 5, (b.y0 + b.y1)/2)], false));
    const m = app.ev("cutAlong")(P, P.internals.length - 1, false);
    return { m, pins: S.pieces.map(p => "pins" in p) };` });
  assert.ok(o.result.pins.every(x => !x), JSON.stringify(o.result));
});
test("r27 / walk: Reset 2D Arrangement (All) comes back whole on undo, with the 2D place new patterns are laid out about (scene.home), and in a file's history too", () => {
  const o = boot({ blank: true, three: true, script: RECT + `
    S.home3 = [11, 22]; app.commit();
    const u = S.undo.length; app.ev("resetArrangement2")(false);
    const after = S.home3 && S.home3.slice(); app.undo();
    return { steps: S.undo.length - u, back: S.home3 && S.home3.slice(), after };` });
  assert.deepStrictEqual(o.result.back, [11, 22]);
  assert.notDeepStrictEqual(o.result.after, [11, 22]);
});
test("r27 / walk: 3D Grid Brightness… opens (with no place given it threw)", () => {
  const o = boot({ blank: true, three: true, script: `app.ev("grid3Dialog")(); return true;` });
  assert.strictEqual(o.result, true);
});

module.exports = T;
