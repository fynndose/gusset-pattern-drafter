// Makes small .zprj files for the tests, from nothing but the layout described in docs/zprj-format.md: a ZIP
// (with bytes in front of it) holding a .zpac, which is a ZIP (with bytes in front of it) holding a .pac, a
// typed key / value tree. No file of the program that writes real ones is needed, so these tests run anywhere.
"use strict";
const zlib = require("zlib");

/* ---- the .pac tree ---- */
const T = { bool: 0x01, i32: 0x04, u32: 0x05, f32: 0x06, v2: 0x0a, m3: 0x0d, str: 0x0f, list: 0x14, map: 0x16 };
const node = (t, bytes) => ({ t, bytes });
const buf = (n, f) => { const b = Buffer.alloc(n); f(b); return b; };
const bool = (v) => node(T.bool, Buffer.from([v ? 1 : 0]));
const i32 = (v) => node(T.i32, buf(4, b => b.writeInt32LE(v)));
const u32 = (v) => node(T.u32, buf(4, b => b.writeUInt32LE(v)));
const f32 = (v) => node(T.f32, buf(4, b => b.writeFloatLE(v)));
const v2 = (x, y) => node(T.v2, buf(8, b => { b.writeFloatLE(x, 0); b.writeFloatLE(y, 4); }));
const m3 = (a) => node(T.m3, buf(36, b => a.forEach((v, k) => b.writeFloatLE(v, k*4))));
const str = (s) => node(T.str, Buffer.from(s, "utf8"));
const floats = (a) => node(T.str, buf(a.length*4, b => a.forEach((v, k) => b.writeFloatLE(v, k*4))));
// a typed array of places (0x15): u32 count, u8 element type (0x0a, a place), count × 2 float32: a point's place in every size
const places = (a) => node(0x15, buf(5 + a.length*8, b => { b.writeUInt32LE(a.length, 0); b[4] = 0x0a; a.forEach((q, k) => { b.writeFloatLE(q[0], 5 + k*8); b.writeFloatLE(q[1], 9 + k*8); }); }));
// a map: u8 n, n key lengths, n type codes, n u32 sizes, then n × (key, value)
function map(obj) {
  const keys = Object.keys(obj), n = keys.length, vals = keys.map(k => obj[k]);
  if (n > 255) throw new Error("too many keys");
  const head = Buffer.alloc(1 + n*6);
  head[0] = n;
  keys.forEach((k, i) => { head[1 + i] = Buffer.byteLength(k, "latin1"); head[1 + n + i] = vals[i].t; head.writeUInt32LE(vals[i].bytes.length, 1 + 2*n + i*4); });
  return node(T.map, Buffer.concat([head, ...keys.flatMap((k, i) => [Buffer.from(k, "latin1"), vals[i].bytes])]));
}
// a list: u32 count; if any: u8 element type, count u32 sizes, the elements
function list(items) {
  if (!items.length) return node(T.list, buf(4, b => b.writeUInt32LE(0)));
  const head = Buffer.alloc(5 + items.length*4);
  head.writeUInt32LE(items.length, 0); head[4] = items[0].t;
  items.forEach((it, i) => head.writeUInt32LE(it.bytes.length, 5 + i*4));
  return node(T.list, Buffer.concat([head, ...items.map(it => it.bytes)]));
}

/* ---- a pattern, from a plain description ----
   { name, annotation (omit for none), transform: 9 numbers, points: [[x, y]], lines: [{ start, end, cps: [[x, y]], sa: [a, b],
     notches: [{ at: [x, y], alpha, length, angle, type }] }], cut: [x, y, …], inner: [{ name, transform, points, lines }],
     dummy: [{ name, sa: bool, points, lines }], drop: "key to leave out of the outline shape",
     omit: ["keys to leave out of every line and notch of the outline"], dropP: ["keys to leave out of the pattern itself"],
     tape: true (a zipper's tape: the pattern has a mapNewTape) } */
const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];
// sizes (optional): each point's places in every size (arrSizeSpecificPosition; a curve point's key is arrPointSizeSpec)
const pointList = (pts, sizes, key) => list(pts.map((q, i) => map({ v2Position: v2(q[0], q[1]), ...(sizes && sizes[i] ? { [key || "arrSizeSpecificPosition"]: places(sizes[i]) } : {}) })));
function lineList(lines, omit) {
  const cut = (o) => { for (const k of omit || []) delete o[k]; return o; };
  return list(lines.map(l => {
    const o = { uiStartPointIndex: u32(l.start), uiEndPointIndex: u32(l.end), iLineType: i32(l.cps ? 2 : 0) };
    if (l.cps) { o.listPoint = pointList(l.cps, l.cpSizes, "arrPointSizeSpec"); o.uiCtrlPointCnt = u32(l.cps.length); }
    o.fSAStartOffset = f32((l.sa || [0, 0])[0]); o.fSAEndOffset = f32((l.sa || [0, 0])[1]);
    o.listNotch = list((l.notches || []).map(n => map(cut({ v2StartPosition: v2(n.at[0], n.at[1]), fLength: f32(n.length || 7), fLocalAngle: f32(n.angle || 90), uiNotchType: u32(n.type || 4), fAlpha: f32(n.alpha === undefined ? 0.5 : n.alpha) }))));
    return map(cut(o));
  }));
}
function pattern(d) {
  const shape = { mapTransformer2D: map({ m3Matrix: m3(d.transform || ID) }), listPoint: pointList(d.points, d.sizes), listLine: lineList(d.lines, d.omit), baSAPositions: floats(d.cut || d.points.flat()), nSAPointCount: u32((d.cut || d.points.flat()).length/2) };
  if (d.drop) delete shape[d.drop];
  // nameKeys (Round I3 / 1): the pattern's name keys as raw bytes, { qsName: Buffer, qsNameUTF8: Buffer, … }, in place of name
  const o = { mapElement: map(d.nameKeys ? Object.fromEntries(Object.entries(d.nameKeys).map(([k, b]) => [k, node(T.str, Buffer.from(b))])) : { qsName: str(d.name || "Pattern") }), mapShape2D: map(shape) };
  if (d.annotation !== undefined) o.mapAnnoForPatternName = map({ qsText: str(d.annotation) });
  o.listInnerShape = list((d.inner || []).map(s => map({ qsInnerShapeName: str(s.name || "Internal"), mapTransformer2D: map({ m3Matrix: m3(s.transform || ID) }), listPoint: pointList(s.points, s.sizes), listLine: lineList(s.lines) })));
  if (d.gradeRule) o.qsGradeRuleName = str(d.gradeRule);
  // grain: { angle, at: [x, y] }, fabric: an index into the file's fabrics
  // cloth (Round I3 / 2): { rest: [x, y, …] in the 2D window, tri: [a, b, c, …], pos: [x, y, z, …] in 3D } -> mapMesh2D and baPosition3D
  const fsk = {};
  if (d.grain || d.fabric !== undefined) Object.assign(fsk, { iFabricIndex: i32(d.fabric === undefined ? -1 : d.fabric), listGrainLineInfo: list(d.grain ? [map({ fAngle: f32(d.grain.angle), v2Translation: v2(...(d.grain.at || [0, 0])) })] : []) });
  if (d.cloth) fsk.mapMesh2D = map({ baRest: floats(d.cloth.rest), baTri: node(T.str, buf(d.cloth.tri.length*4, b => d.cloth.tri.forEach((v, k) => b.writeUInt32LE(v, k*4)))) });
  if (Object.keys(fsk).length) o.mapFabricShape2D = map(fsk);
  if (d.cloth) o.baPosition3D = floats(d.cloth.pos);
  o.listDummyShape = list((d.dummy || []).map(s => map({ bSeamAllowanceShape: bool(s.sa), qsDummyShapeName: str(s.name || "Baseline"), mapShape2D: map({ listPoint: pointList(s.points), listLine: lineList(s.lines) }) })));
  if (d.tape) o.mapNewTape = map({ fTapeWidth: f32(5) });
  if (d.prints) o.listPrintTexture = list(d.prints.map(x => printTexture(x, x.file)));
  for (const k of d.dropP || []) delete o[k];
  return map(o);
}
// a size table (listRuleTables' element): { name, sizes: ["S", …], base, current, colors: [[r, g, b, a]] }
const v4 = (a) => node(0x0c, buf(16, b => a.forEach((v, k) => b.writeFloatLE(v, k*4))));
const ruleTable = (t) => map({ qsMVGradingItem_GradeRuleName: str(t.name), uiDefaultSizeIndex: u32(t.base), uiCurrentSizeIndex: u32(t.current === undefined ? t.base : t.current),
  listGradingNode: list(t.sizes.map((n, i) => map({ qsMVGradingRuleData_Size: str(n), bMVGradingRuleData_Visible: bool(true), ...(t.colors ? { v4MVGradingRuleData_Color: v4(t.colors[i]) } : {}) }))) });
// a list of int32 as a typed array (0x15, element type 0x04): arrSymmetricIndex, arrInstanceIndex
const ints = (a) => node(0x15, buf(a.length ? 5 + a.length*4 : 4, b => { b.writeUInt32LE(a.length, 0); if (a.length) { b[4] = 0x04; a.forEach((v, k) => b.writeInt32LE(v, 5 + k*4)); } }));
// a seam: { name, a: [run], b: [run] }, run = { pattern, from, to, r0, r1, forward }
const seam = (sm) => { const run = (r) => map({ uiSelfIndex: u32(r.pattern), uiStartIndex: u32(r.from), uiEndIndex: u32(r.to), fRatioStart: f32(r.r0), fRatioEnd: f32(r.r1), bDirection: bool(r.forward), uiDepth: u32(1) });
  return map({ mapElement: map({ qsName: str(sm.name || "Seam") }), listParamLineGroup0: list(sm.a.map(run)), listParamLineGroup1: list(sm.b.map(run)) }); };
// the whole .pac of a file with these patterns. extra: more keys of mapPatternEditor; more: { list: keys of mapPatternList, root: keys of the root,
// symmetric: arrSymmetricIndex as numbers, seams: [seam], fabrics: [{ name, type, content }] }
const pac = (patterns, extra, more) => {
  more = more || {};
  const plist = { listPattern: list(patterns.map(pattern)), ...(more.symmetric ? { arrSymmetricIndex: ints(more.symmetric) } : {}), ...(more.list || {}) };
  const ed = { mapPatternList: map(plist), ...(more.seams ? { mapSeamLinePairGroup: map({ listSeamLinePairGroup: list(more.seams.map(seam)) }) } : {}), ...(extra || {}) };
  // avatar (Round I3 / 2): { id, cm } -> mapAvatar with its height as the first body measurement, in centimetres
  if (more.avatar) more.root = { ...(more.root || {}), mapAvatar: map({ qsAvatarID: str(more.avatar.id || "Avatar"), mapResizingAvatar: map({ listFeatureValues: list([f32(more.avatar.cm), f32(90), f32(80)]) }) }) };
  const root = { qsEncKey: str("owner-tag"), mapPatternEditor: map(ed), ...(more.fabrics ? { listFabric: list(more.fabrics.map(f => map({ qsName: str(f.name), fabricType: str(f.type || "Woven"), fabricContent: str(f.content || "") }))) } : {}), ...(more.root || {}) };
  return map(root).bytes;
};

/* ---- graphics (Round I3 / 3) ----
   graphic({ name, style, overlays: [{ pattern, m, w, h, repeat, uuid, at: [x, y] }] }): an element of listMVGraphic; each overlay
   is the picture on one pattern, its corners round `at` (default its middle at (0, 0)) in its own coordinates, m its placement.
   graphicStyle(file): an element of the root's listGraphicStyle, naming the picture. printTexture(o, file): the same overlay as a
   pattern's own listPrintTexture element (pattern: { prints: [...] }). */
const overlay = (o, extra) => { const [cx, cy] = o.at || [0, 0], w = o.w/2, h = o.h/2;
  return map({ uiParentPatternSelfIndex: u32(o.pattern), qsUuid: str(o.uuid || ""), enRepeatType: i32(o.repeat ? 1 : 0), mapElement: map({ qsName: str(o.name || ""), bVisible: bool(o.visible !== false) }),
    mapShape2D: map({ mapTransformer2D: map({ m3Matrix: m3(o.m || ID) }), listPoint: pointList([[cx - w, cy - h], [cx + w, cy - h], [cx + w, cy + h], [cx - w, cy + h]]) }), ...(extra || {}) }); };
const texture = (file) => map({ listFaceMaterial: list([map({ listTexture: list([map({ qsFileName: str(file), qsFileNameUTF8: str(file) })]) })]) });
const graphic = (g) => map({ mapElement: map({ qsName: str(g.name), qsNameUTF8: str(g.name) }), uiGraphicStyleIndex: u32(g.style || 0), listOverlayFabricShape2D: list((g.overlays || []).map(o => overlay(o))) });
const graphicStyle = (file) => map({ mapGrapghicFabric: map({ mapMaterial2D: texture(file) }), mapElement: map({ qsName: str(file.replace(/[.][a-z]+$/i, "")) }) });
const printTexture = (o, file) => overlay(o, { mapFabricShape2D: map({ mapFabric: map({ mapMaterial2D: texture(file) }) }) });
// a small PNG of w × h pixels, every one of colour rgba
function png(w, h, rgba) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t, "latin1"), d]), c = Buffer.alloc(4); len.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), ...Array.from({ length: w }, () => Buffer.from(rgba))])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/* ---- ZIP, with bytes in front ---- */
// entries: [{ name, data, deflate, encrypted }]; front: bytes put before the archive (its own offsets do not count them)
function zip(entries, front) {
  const locals = [], central = [];
  let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8"), data = e.deflate ? zlib.deflateRawSync(e.data) : e.data, flags = e.encrypted ? 1 : 0, method = e.deflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flags, 8); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, name, data); central.push(ch, name);
    off += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([front || Buffer.alloc(0), ...locals, cd, end]);
}
/* A .zprj holding these patterns. opt: { pac: bytes to use as the pattern data instead; encrypted: "zpac" | "pac" (that entry
   is flagged as encrypted); noZpac; store: keep the inner archive uncompressed } */
// A .zpac on its own (the garment archive a .zprj holds, as such files are also kept): the .pac beside a texture and a
// list of files, with bytes in front. opt: { pac, encrypted: "pac" }
function zpac(patterns, opt) {
  opt = opt || {};
  const data = opt.pac || pac(patterns);
  // opt.files: more entries beside the .pac ([{ name, data }]: the pictures of graphics, a fabric's texture)
  return zip([{ name: "texture.png", data: Buffer.from("not a picture") }, { name: "garment.pac", data, deflate: true, encrypted: opt.encrypted === "pac" }, { name: "files.json", data: Buffer.from("{}") }, ...(opt.files || [])], Buffer.from(" ZPAC \u0000\u0001 inner header bytes "));
}
function zprj(patterns, opt) {
  opt = opt || {};
  const data = opt.pac || pac(patterns);
  const zpac = zip([{ name: "garment.pac", data, deflate: true, encrypted: opt.encrypted === "pac" }, { name: "displaysettings.json", data: Buffer.from("{}") }, ...(opt.files || [])], Buffer.from(" ZPAC \u0000\u0001 inner header bytes "));
  const outer = opt.noZpac ? [{ name: "scene.xml", data: Buffer.from("<x/>") }]
    : [{ name: "garment.zpac", data: zpac, deflate: !opt.store, encrypted: opt.encrypted === "zpac" }, { name: "garment.xml", data: Buffer.from("<x/>"), deflate: true }];
  return zip(outer, Buffer.from(" ZPRJ \u0000\u0002\u0003 header bytes in front of the archive "));
}

module.exports = { ints, seam, places, ruleTable, zprj, zpac, pac, pattern, zip, map, list, str, f32, u32, i32, v2, m3, bool, floats, ID, graphic, graphicStyle, printTexture, texture, png };
