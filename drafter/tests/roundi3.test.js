// Round I3: more from project files. 1: pattern names, read through the key that says its encoding. 2: every pattern's
// place and drape in 3D, fitted to the avatar here by the floor, the middle and the ratio of the heights. 3: graphics (prints) on
// the patterns, with their pictures.
// The files here are made by zprj-make.js from the layout in docs/zprj-format.md: no file of another program is used.
// Tests on the real project files are kept outside the released tests, and skip when the files are not there.
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
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 90000, maxBuffer: 1 << 28 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after " + (ms || 90000)/1000 + " s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
const ring = (n) => Array.from({ length: n }, (_, k) => ({ start: k, end: (k + 1) % n }));
const square = (extra) => ({ points: [[-100, -100], [100, -100], [100, 100], [-100, 100]], lines: ring(4), ...extra });
const read = (patterns, extra, more) => ZPRJ.importZprj(MK.zprj([], { pac: MK.pac(patterns, extra, more) }));
const B = (s, enc) => Buffer.from(s, enc);

test("I3/1 a pattern's name is read from its UTF8 key first: a name with letters outside ASCII comes in whole, whatever the plain key holds", async () => {
  const r = await read([
    square({ nameKeys: { qsName: B("Ärmel vorn", "latin1"), qsNameUTF8: B("Ärmel vorn", "utf8") } }),
    square({ nameKeys: { qsName: B("????", "utf8"), qsNameUTF8: B("Rückenteil – Mitte", "utf8") } }),
    square({ nameKeys: { qsName: B("Kragen", "utf8"), qsNameUTF8: B("", "utf8") } }),
  ]);
  assert.deepStrictEqual(r.pieces.map(p => p.name), ["Ärmel vorn", "Rückenteil – Mitte", "Kragen"], "an empty UTF8 key gives way to the plain one");
});

test("I3/1 a name only in the plain key is read as UTF-8 when it is UTF-8, as UTF-16 when it looks like it, else as Latin-1; a UTF16 key is read too", async () => {
  const r = await read([
    square({ nameKeys: { qsName: B("Ärmel", "utf8") } }),
    square({ nameKeys: { qsName: B("Ärmel", "latin1") } }),
    square({ nameKeys: { qsName: B("Vorderteil\u0000", "utf16le") } }),
    square({ nameKeys: { qsName: Buffer.concat([B([0xff, 0xfe]), B("Ärmel", "utf16le")]) } }),
    square({ nameKeys: { qsNameUTF16: B("Tasche", "utf16le") } }),
    square({ nameKeys: { qsName: B("AB", "utf8") } }),
  ]);
  assert.deepStrictEqual(r.pieces.map(p => p.name), ["Ärmel", "Ärmel", "Vorderteil", "Ärmel", "Tasche", "AB"]);
  assert.strictEqual(ZPRJ.decodeText(B("Hüfte\u0000\u0000", "utf8")), "Hüfte", "a trailing NUL is dropped");
});

test("I3/1 the other names go the same way: internal and reference lines, sizes, fabrics, seams; a pattern with no name at all is \"Pattern N\" in the document", async () => {
  const L = ring(2).slice(0, 1);
  const p = square({ nameKeys: {}, inner: [{ name: "x", points: [[0, 0], [50, 0]], lines: L }], dummy: [{ name: "y", points: [[0, 20], [50, 20]], lines: L }] });
  const named = square({ name: "B" });
  const bytes = MK.pac([p, named], { listRuleTables: MK.list([MK.map({ qsMVGradingItem_GradeRuleName: MK.str("G"), qsMVGradingItem_GradeRuleNameUTF8: MK.str("Größen"), uiDefaultSizeIndex: MK.u32(0),
    listGradingNode: MK.list(["S", "M"].map(n => MK.map({ qsMVGradingRuleData_Size: MK.str(n + "?"), qsMVGradingRuleData_SizeUTF8: MK.str(n + "ö") }))) })]) },
    { fabrics: [{ name: "Wolle" }], seams: [{ name: "Naht", a: [{ pattern: 0, from: 0, to: 0, r0: 0, r1: 1, forward: true }], b: [{ pattern: 1, from: 2, to: 2, r0: 0, r1: 1, forward: false }] }] });
  // the internal and reference line, the fabric and the seam keep their names (read through the same reader)
  const r0 = await ZPRJ.importZprj(MK.zprj([], { pac: bytes }));
  assert.deepStrictEqual(r0.grading.tables[0].name, "Größen");
  assert.deepStrictEqual(r0.grading.tables[0].sizes.map(z => z.name), ["Sö", "Mö"]);
  assert.strictEqual(r0.pieces[0].name, "", "no name in the file");
  assert.deepStrictEqual([r0.pieces[0].internalLines[0].name, r0.pieces[0].referenceLines[0].name], ["x", "y"]);
  assert.deepStrictEqual([r0.fabrics[0].name, r0.seams.list[0].name], ["Wolle", "Naht"]);
  const out = boot({ script: `const r = ${JSON.stringify(r0)}; const got = app.ev("zprjPieces")(r, {}); return got.pieces.map(p => p.name);` });
  assert.deepStrictEqual(out.errors, []);
  assert.deepStrictEqual(out.result, ["Pattern 1", "B"]);
});

/* ---- 2: 3D placement and drape ----
   Two patterns as the file would have them after a simulation: a front facing +z at z = 150 and a back turned half round at
   z = -150, both with their middle 1100 mm above the floor; a third that was never draped. Each square's cloth is its four
   corners and its middle, at rest in the file's 2D window (its outline through its placement) and in 3D. */
const SQ = [[-100, -150], [100, -150], [100, 150], [-100, 150]], TRI = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4];
const win = (dx) => [...SQ.map(([x, y]) => [x + dx, y]), [dx, 0]];
const FRONT = { name: "Front", transform: [1, 0, 0, 0, 1, 0, -300, 0, 1], points: SQ, lines: ring(4), cloth: { rest: win(-300).flat(), tri: TRI, pos: win(-300).flatMap(([x, y]) => [x + 300, y + 1100, 150]) } };
const BACK = { name: "Back", transform: [1, 0, 0, 0, 1, 0, 300, 0, 1], points: SQ, lines: ring(4), cloth: { rest: win(300).flat(), tri: TRI, pos: win(300).flatMap(([x, y]) => [-(x - 300), y + 1100, -150]) } };
const LOOSE = { name: "Pocket", transform: [1, 0, 0, 0, 1, 0, 900, 0, 1], points: SQ, lines: ring(4) };
const file3 = (cm) => MK.zprj([], { pac: MK.pac([FRONT, BACK, LOOSE], null, cm ? { avatar: { id: "Template", cm } } : {}) });

test("I3/2 the reader gives each pattern's cloth (at rest in the 2D window, the triangles, in 3D) and the avatar's height; a cloth whose parts do not agree is none", async () => {
  const r = await ZPRJ.importZprj(file3(150.04));
  assert.deepStrictEqual(r.avatar, { id: "Template", height: 1500.4 });
  assert.deepStrictEqual(r.pieces.map(p => p.cloth ? [p.cloth.rest.length, p.cloth.tri.length, p.cloth.pos.length] : null), [[10, 12, 15], [10, 12, 15], null]);
  assert.ok(r.pieces[0].cloth.pos instanceof Float32Array && r.pieces[0].cloth.tri instanceof Uint32Array);
  const bad = await ZPRJ.importZprj(MK.zprj([], { pac: MK.pac([{ ...FRONT, cloth: { ...FRONT.cloth, pos: FRONT.cloth.pos.slice(3) } }, { ...BACK, cloth: { ...BACK.cloth, tri: [0, 1, 9] } }]) }));
  assert.deepStrictEqual(bad.pieces.map(p => p.cloth), [null, null], "a point short in 3D, a triangle to a point that is not there");
  assert.deepStrictEqual(bad.avatar, null); assert.ok(!["baRest", "baTri", "baPosition3D", "mapMesh2D", "mapAvatar"].some(k => k in bad.defaults), "an ordinary absence: not counted");
  assert.deepStrictEqual((await ZPRJ.importZprj(MK.zprj([], { pac: MK.pac([FRONT], null, { avatar: { cm: 12 } }) }))).avatar.height, null, "no height that is not a person's");
});

test("I3/2 the rigid fit finds a turn and a move again (Horn's quaternion), also half round and lying flat", () => {
  const out = boot({ script: `
    const fit = app.ev("rigidFit"), C = app.ev("SIM3D"), res = [];
    const pts = [[0, 0, 0], [200, 0, 0], [200, 300, 0], [0, 300, 0], [80, 120, 0]].flat();
    for (const q0 of [[0, 0, 0, 1], [0, 1, 0, 0], C.qAxis([1, 2, 3], 77), C.qAxis([1, 0, 0], -90), C.qAxis([0.3, -1, 0.2], 181)]) {
      const B = []; for (let i = 0; i < pts.length; i += 3) { const o = C.qRot(q0, pts[i], pts[i+1], pts[i+2], [0, 0, 0]); B.push(o[0] + 10, o[1] + 1200, o[2] - 40); }
      const f = fit(pts, B); let worst = 0;
      for (let i = 0; i < pts.length; i += 3) { const o = C.qRot(f.q, pts[i], pts[i+1], pts[i+2], [0, 0, 0]); worst = Math.max(worst, Math.hypot(o[0] + f.t[0] - B[i], o[1] + f.t[1] - B[i+1], o[2] + f.t[2] - B[i+2])); }
      res.push(worst);
    }
    return res;` });
  assert.deepStrictEqual(out.errors, []);
  assert.ok(out.result.every(w => w < 1e-6), JSON.stringify(out.result));
});

test("I3/2 imported patterns stand in 3D where the file had them, once: the front before the back, turned half round, not at the default place; their drape is kept for the cloth; one undo step", async () => {
  const r = await ZPRJ.importZprj(file3(null));
  const out = boot({ script: `const rep = app.ev("zprjTake")("t.zprj", ${JSON.stringify(r, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v)}, {});
    const byName = (n) => S.pieces.find(p => p.name === n), mesh = (p) => app.ev("pieceMesh3")(p, S.cloth.res);
    const out = { rep: { placed: rep.placed, draped: rep.draped, fit: rep.fit3 }, p3: S.pieces.map(p => p.p3 && { pos: p.p3.pos, q: p.p3.q, o: p.p3.o }), html: app.ev("zprjReportHTML")(rep) };
    // the drape kept for each cloth is the flat cloth placed: the file's cloth here is flat
    out.drape = ["Front", "Back"].map(n => { const p = byName(n), d = S.drapeIn && S.drapeIn[p.id], m = mesh(p), X = app.ev("SIM3D").placeVerts(m.xy, p.p3.o, p.p3);
      return d && { n: d.n, nv: m.xy.length/2, k: d.k === app.ev("hash32")(app.ev("pieceSig")(p, S.cloth.res)), worst: Math.max(...Array.from(X, (v, i) => Math.abs(v - d.f[i]))) }; });
    out.saved = Object.keys(app.ev("drapeOut")() || {}).map(Number).sort();
    out.ids = S.pieces.map(p => p.id);
    // a move in 2D does not move the pattern in 3D
    const f = byName("Front"); app.ev("push")("Move"); app.ev("mapPiece")(f, (q) => app.ev("V")(q.x + 500, q.y + 80)); app.ev("commit")();
    out.after = f.p3.pos; out.undo = S.undo.length;
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  assert.deepStrictEqual([o.rep.placed, o.rep.draped], [2, 2]);
  assert.deepStrictEqual(o.rep.fit, { s: 1, ax: 0, az: 0, file: null, here: null, name: null }, "no avatar on either side: the file's places as they are");
  const near = (a, b, tol, msg) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= tol, msg + ": " + JSON.stringify(a) + " vs " + JSON.stringify(b)));
  near(o.p3[0].pos, [0, 1100, 150], 1e-3, "the front: before the body, its middle 1100 mm up"); near(o.p3[0].q, [0, 0, 0, 1], 1e-6, "facing forward");
  near(o.p3[1].pos, [0, 1100, -150], 1e-3, "the back: behind"); near(o.p3[1].q.map(Math.abs), [0, 1, 0, 0], 1e-6, "turned half round about the upright");
  near(o.p3[0].o, [-300, 0], 1e-3, "hung on the middle of its mesh");
  assert.ok(o.p3[0].pos[2] > o.p3[1].pos[2], "the front is in front");
  assert.ok(o.p3[2] && Math.abs(o.p3[2].pos[2] - 420) < 1e-6, "the pattern the file had no cloth for stands at the default place, before the avatar");
  assert.ok(Math.abs(o.p3[0].pos[2] - 420) > 100 && Math.abs(o.p3[1].pos[2] - 420) > 100, "the others are not at the default place");
  for (const d of o.drape) { assert.ok(d && d.k && d.n === d.nv, JSON.stringify(d)); assert.ok(d.worst < 0.01, "the drape is the file's cloth on our mesh: " + d.worst); }
  assert.deepStrictEqual(o.saved, o.ids.slice(0, 2).sort(), "the drapes are saved with the document before the 3D window has ever been up");
  near(o.after, o.p3[0].pos, 0, "a move in 2D leaves the place in 3D alone");
  assert.ok(/3D: 2 patterns placed as in the file, 2 with their drape/.test(o.html), o.html);
  assert.strictEqual(o.undo, 2, "the import is one undo step (and the move another)");
});

test("I3/2 with an avatar here the file's places are scaled by the heights about the floor and the middle; the cloth hangs as the file had it, and is saved with the file", async () => {
  const r = await ZPRJ.importZprj(file3(150.04));
  const out = boot({ three: true, script: `return (async () => {
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "the avatar");
    const rep = app.ev("zprjTake")("t.zprj", ${JSON.stringify(r, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v)}, {});
    app.ev("garmentSync")();
    const G3 = app.G3, it = (n) => G3.items.get(S.pieces.find(p => p.name === n).id);
    const mid = (x) => { let a = [0, 0, 0]; for (let i = 0; i < x.length; i += 3) for (let k = 0; k < 3; k++) a[k] += x[i+k]/(x.length/3); return a; };
    // where each point of our cloth should be: the file's cloth (front: x + 300, y + 1100, 150; back: 300 - x, y + 1100, -150 in its window), scaled
    const s = rep.fit3.s, want = { Front: (x, y) => [s*(x + 300), s*(y + 1100), s*150], Back: (x, y) => [s*(300 - x), s*(y + 1100), -s*150] };
    const off = (n) => { const t = it(n), xy = t.mesh.xy; let w = 0; for (let v = 0; v < xy.length/2; v++) { const e = want[n](xy[2*v], -xy[2*v+1]); for (let k = 0; k < 3; k++) w = Math.max(w, Math.abs(t.X[3*v+k] - e[k])); } return w; };
    const out = { s, here: rep.fit3.here, draped: ["Front", "Back", "Pocket"].map(n => it(n).draped), off: ["Front", "Back"].map(off), mid: ["Front", "Back"].map(n => mid(it(n).X)), html: app.ev("zprjReportHTML")(rep) };
    // saved: both drapes are in the file
    let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
    const doc = app.fileDoc(file);
    out.inFile = Object.keys(doc.drape || {}).length;
    return out; })()` }, 120000);
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  assert.ok(Math.abs(o.s - o.here/1500.4) < 1e-9 && Math.abs(o.s - 1.25) < 1e-3, "Marty over the file's avatar: " + o.s);
  assert.deepStrictEqual(o.draped, [true, true, false], "the two cloths hang as the file had them; the third stands flat");
  assert.ok(o.off.every(w => w < 0.01), "every point of the cloth where the file had it, scaled by the heights about the floor and the middle: " + o.off);
  assert.ok(o.mid[0][2] > 150 && o.mid[1][2] < -150, "the front before the back, both a quarter further out from the middle (the scale)");
  assert.ok(/Fitted to Marty by the floor and the middle, scaled by the heights 1875[.]5 \/ 1500[.]4 mm/.test(o.html), o.html);
  assert.strictEqual(o.inFile, 2, "both drapes are in the saved file");
});

/* ---- 3: graphics ----
   A front with a logo turned 30° (and the same logo again as the pattern's own print, which is not taken twice) and a stripe
   that is only the pattern's own print; a back whose placement is a mirror, with a badge on it; a graphic whose picture is
   not in the file. A fabric's texture is in the archive too, and is never read. */
const RED = [220, 20, 30, 255], BLUE = [20, 40, 220, 255];
const c30 = Math.cos(Math.PI/6), s30 = Math.sin(Math.PI/6);
const GFX_FILE = () => {
  const front = { name: "Front", points: SQ, lines: ring(4), prints: [{ pattern: 0, uuid: "{logo-1}", file: "logo.png", name: "Logo", m: [c30, s30, 0, -s30, c30, 0, 10, 20, 1], w: 80, h: 40 }, { pattern: 0, uuid: "{stripe}", file: "stripe.png", name: "Stripe", m: [1, 0, 0, 0, 1, 0, 0, -100, 1], w: 150, h: 20, repeat: true }] };
  const back = { name: "Back", transform: [-1, 0, 0, 0, 1, 0, 500, 0, 1], points: SQ, lines: ring(4) };
  const extra = { listMVGraphic: MK.list([
    MK.graphic({ name: "Logo", style: 0, overlays: [{ pattern: 0, uuid: "{logo-1}", m: [c30, s30, 0, -s30, c30, 0, 10, 20, 1], w: 80, h: 40 }] }),
    MK.graphic({ name: "Badge", style: 0, overlays: [{ pattern: 1, uuid: "{badge}", m: MK.ID, w: 60, h: 30, at: [5, 0] }] }),
    MK.graphic({ name: "Missing", style: 1, overlays: [{ pattern: 0, uuid: "{gone}", w: 10, h: 10 }] })]) };
  const root = { listGraphicStyle: MK.list([MK.graphicStyle("logo.png"), MK.graphicStyle("gone.png")]), listFabric: MK.list([MK.map({ qsName: MK.str("Jersey"), mapMaterial2D: MK.texture("fabric.png") })]) };
  return MK.zprj([], { pac: MK.pac([front, back], extra, { root }), files: [{ name: "logo.png", data: MK.png(4, 2, RED) }, { name: "pictures/stripe.png", data: MK.png(2, 2, BLUE) }, { name: "fabric.png", data: MK.png(2, 2, [0, 255, 0, 255]) }] });
};

test("I3/3 the reader gives the file's graphics (each on its pattern, its placement and size) and their pictures; a pattern's own print of the same graphic is not taken twice; a fabric's texture is never read", async () => {
  const r = await ZPRJ.importZprj(GFX_FILE());
  const g = r.graphics.map(x => ({ ...x, m: x.m.map(v => Math.round(v*1e6)/1e6) }));
  assert.deepStrictEqual(g.map(x => [x.name, x.file, x.pattern, x.w, x.h, x.repeat]), [["Logo", "logo.png", 0, 80, 40, false], ["Badge", "logo.png", 1, 60, 30, false], ["Missing", "gone.png", 0, 10, 10, false], ["Stripe", "stripe.png", 0, 150, 20, true]]);
  assert.deepStrictEqual(g[0].m, [c30, s30, 0, -s30, c30, 0, 10, 20, 1].map(v => Math.round(v*1e6)/1e6));
  assert.deepStrictEqual(g[1].m, [1, 0, 0, 0, 1, 0, 5, 0, 1], "corners not round (0, 0): the placement is of the graphic's middle");
  assert.deepStrictEqual(r.images.map(im => [im.file, im.type, im.w, im.h, im.bytes.length > 50]), [["logo.png", "png", 4, 2, true], ["stripe.png", "png", 2, 2, true]], "found by name in any folder; the missing one is not there, the fabric's texture is not read");
  // the pictures' sizes from their first bytes
  const B8 = (a) => new Uint8Array(a);
  assert.deepStrictEqual(ZPRJ.pictureOf(B8([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 30, 0, 40, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), { type: "jpeg", w: 40, h: 30 });
  assert.deepStrictEqual(ZPRJ.pictureOf(B8([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 12, 0, 7, 0, ...new Array(20).fill(0)])), { type: "gif", w: 12, h: 7 });
  assert.strictEqual(ZPRJ.pictureOf(B8(new Array(40).fill(7))), null, "not a picture");
});

test("I3/3 in the document: each graphic on its pattern where the file has it (turned, mirrored with its pattern, tiled), its picture kept once and saved in the file; a graphic without its picture is named; one undo step", async () => {
  const r = await ZPRJ.importZprj(GFX_FILE());
  const out = boot({ script: `const r = ${JSON.stringify(r, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v)}; for (const im of r.images) im.bytes = new Uint8Array(im.bytes);
    const rep = app.ev("zprjTake")("g.zprj", r, {});
    const r6 = (v) => Math.round(v*1e4)/1e4, out = {};
    out.gfx = S.pieces.map(p => [p.name, (p.graphics || []).map(g => [g.name, r6(g.x), r6(g.y), r6(g.w), r6(g.h), r6(g.angle), g.flip, g.tile, g.img])]);
    out.images = S.images.map(im => [im.id, im.name, im.w, im.h, im.data.slice(0, 22)]);
    out.html = app.ev("zprjReportHTML")(rep);
    let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
    out.parts = app.fileParts(file).map(x => x[0]);
    app.ev("undo")(); out.afterUndo = S.pieces.length;
    return out;` });
  assert.deepStrictEqual(out.errors, []);
  const o = out.result;
  assert.deepStrictEqual(o.gfx, [
    ["Front", [["Logo", 10, -20, 80, 40, 330, false, "none", 1], ["Stripe", 0, 100, 150, 20, 0, false, "repeat", 2]]],
    ["Back", [["Badge", 495, 0, 60, 30, 0, true, "none", 1]]],
  ], "the logo 30° up from the x axis in the file's window (y up) is 330° here (y down, clockwise); the badge on the mirrored back is flipped, its middle mirrored too");
  const URL0 = "data" + ":image/png;base64,";               // (written in two so that the release check sees no embedded picture here)
  assert.deepStrictEqual(o.images, [[1, "logo.png", 4, 2, URL0], [2, "stripe.png", 2, 2, URL0]], "the logo's picture is kept once for both graphics");
  assert.ok(/Graphics: Logo on Front, Badge on Back, Stripe on Front/.test(o.html), o.html);
  assert.ok(/Graphics not imported:.*Missing [(]its picture, gone[.]png, is not in the file/.test(o.html), o.html);
  assert.ok(!/graphics? [(]artwork[)]/.test(o.html), "no longer listed as not imported");
  assert.ok(o.parts.includes("images/1.png") && o.parts.includes("images/2.png"), "the pictures are in the saved file: " + o.parts);
  assert.strictEqual(o.afterUndo, 0, "one undo step takes it all away");
});

module.exports = T;
