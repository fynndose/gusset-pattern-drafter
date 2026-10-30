/* ================================================================
   zprj-import.js: read the 2D pattern geometry out of a project file (.zprj),
   and the curve that both that file format and this program's curve points use.
   Plain numbers and typed arrays: no page, so all of it runs (and is tested) in Node 18+
   as well as in the browser. The page reaches it as ZPRJ; in Node, require() it.

   THE CURVE
     splineToBeziers(P, d0, d1)   the curve through the points P = [[x, y], …]: a natural
                                  cubic spline, chord-length parameterised, as exact cubic
                                  Béziers [p0, c1, c2, p3], one per span. This is the one
                                  implementation: the importer and the app's curve-point
                                  curves (segCurve() in the app script) both call it.
   THE FILE
     importZprj(buffer)           -> Promise of { pieces, skipped, total, defaults, others }   (ArrayBuffer | Uint8Array):
                                  a .zprj or a .zpac (the garment archive a .zprj holds), told apart by what they hold
     readTree(buffer)             -> Promise of the .pac's key / value tree
     ZprjError                    what it throws: .code is "not-zprj", "encrypted" or "unknown"
   Reads ONLY the user's own pattern data: outlines (straight and curved), seam allowance,
   cut line, notches, internal lines, reference lines, names and 2D-window placement.
   Fabrics, textures, avatar, simulation and 3D are not looked at.
   A file that is encrypted or protected is refused. Nothing here tries to get round that.

   Units: millimetres. Coordinates are piece-local; piece.transform places the piece in the
   2D window: world = [x, y, 1] · M (row-vector, translation in row 3), y down.

   The format was worked out from files saved by their owner (docs/zprj-format.md has all
   of it that is used here); no code or data of the program that writes them is used.
   Like drafter-sim.js, everything is inside one function, make(), so that the same text can
   be run again inside a worker (see IN A WORKER, at the end). Anything added must stay
   inside make().
   ================================================================ */
(function (root) {
'use strict';
function make() {
const Z = {};

class ZprjError extends Error {
  constructor(code, message) { super(message); this.name = "ZprjError"; this.code = code; }
}
Z.ZprjError = ZprjError;
const MSG = {
  "not-zprj": "This is not a project file (.zprj or .zpac)",
  encrypted: "This file is encrypted or protected. Protected files are not opened.",
  unknown: "This file's format is not known (it may come from another program version)",
};
const fail = (code, detail) => new ZprjError(code, MSG[code] + (detail ? ": " + detail : ""));

// ------------------------------------------------------------- ZIP reading
// .zprj and the inner .zpac are ZIPs with extra bytes prepended, so we read the
// central directory ourselves and correct offsets by the prepended length.
// the names of a ZIP's entries, read from its table of contents alone (nothing is unpacked); [] for what is no ZIP
function zipNames(bytes) {
  try {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = [];
    let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) return [];
    let p = e - dv.getUint32(e + 12, true);
    while (p >= 0 && p < e && dv.getUint32(p, true) === 0x02014b50) {
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      out.push(new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl))); p += 46 + nl + xl + cl;
    }
    return out;
  } catch (err) { return []; }
}
// is this a project file (a .zprj or a .zpac), by what it holds: a garment archive or pattern data
Z.isProject = (bytes) => zipNames(bytes).some(n => /\.(zpac|pac)$/i.test(n));
async function unzip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP container (no end-of-central-directory record)');
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOffRecorded = dv.getUint32(eocd + 16, true);
  const cdStart = eocd - cdSize;
  const shift = cdStart - cdOffRecorded;            // bytes prepended before the ZIP
  const files = new Map();
  let p = cdStart;
  while (p < eocd && dv.getUint32(p, true) === 0x02014b50) {
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true) + shift;
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
    files.set(name, { method, compSize, localOff, encrypted: !!(flags & 1) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return {
    names: [...files.keys()],
    encrypted(name) { const f = files.get(name); return !!(f && f.encrypted); },
    async read(name) {
      const f = files.get(name);
      if (!f) throw new Error('missing entry ' + name);
      const lnl = dv.getUint16(f.localOff + 26, true), lel = dv.getUint16(f.localOff + 28, true);
      const data = u8.subarray(f.localOff + 30 + lnl + lel, f.localOff + 30 + lnl + lel + f.compSize);
      if (f.method === 0) return data;
      if (f.method !== 8) throw new Error('unsupported ZIP compression ' + f.method);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    },
  };
}

// --------------------------------------------------------------- .pac parser
// Typed key/value tree. A map is: u8 n, n×u8 key lengths, n×u8 type codes,
// n×u32 value sizes, then n × (key bytes, value bytes).
// A list is: u32 count, u8 element type, count×u32 sizes, then elements.
// Type codes seen: 0x01 bool, 0x04 int32, 0x05 uint32, 0x06 float32,
// 0x0a vec2 (2×f32), 0x0b vec3, 0x0c vec4, 0x0d mat3 (9×f32), 0x0e mat4,
// 0x0f string / raw byte array, 0x14 list, 0x15 typed array, 0x16 map.
const T_LIST = 0x14, T_MAP = 0x16;

function parsePac(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const latin = new TextDecoder('latin1');
  const within = (o, n) => { if (o < 0 || o + n > u8.length) throw new Error('pac value runs past the end of the file'); };
  function map(o) {
    within(o, 1);
    const n = u8[o]; o += 1;
    within(o, n*6);
    const lens = u8.subarray(o, o + n); o += n;
    const types = u8.subarray(o, o + n); o += n;
    const sizes = []; for (let i = 0; i < n; i++, o += 4) sizes.push(dv.getUint32(o, true));
    const out = {};
    for (let i = 0; i < n; i++) {
      within(o, lens[i] + sizes[i]);
      const k = latin.decode(u8.subarray(o, o + lens[i])); o += lens[i];
      out[k] = { t: types[i], v: val(types[i], o, sizes[i]) }; o += sizes[i];
    }
    return [out, o];
  }
  function list(o) {
    within(o, 4);
    const cnt = dv.getUint32(o, true); o += 4;
    if (!cnt) return [];
    within(o, 1 + cnt*4);
    const t = u8[o]; o += 1;
    const sizes = []; for (let i = 0; i < cnt; i++, o += 4) sizes.push(dv.getUint32(o, true));
    const res = [];
    for (const z of sizes) { within(o, z); res.push(val(t, o, z)); o += z; }
    return res;
  }
  function val(t, o, sz) {
    if (t === T_MAP) return map(o)[0];
    if (t === T_LIST) return list(o);
    return u8.subarray(o, o + sz);
  }
  const [root, end] = map(0);
  if (end !== u8.length) throw new Error('pac parse did not consume whole file — unknown format version?');
  return root;
}

// value helpers
const has = (m, k) => k in m;
const dvOf = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const u32 = (b) => dvOf(b).getUint32(0, true);
const i32 = (b) => dvOf(b).getInt32(0, true);
const f32 = (b) => dvOf(b).getFloat32(0, true);
const v2 = (b) => { const d = dvOf(b); return [d.getFloat32(0, true), d.getFloat32(4, true)]; };
const m3 = (b) => { const d = dvOf(b); return Array.from({ length: 9 }, (_, i) => d.getFloat32(i * 4, true)); };
const str = (b) => new TextDecoder('utf-8').decode(b);
const f32arr = (b) => { const d = dvOf(b), a = []; for (let i = 0; i + 4 <= b.length; i += 4) a.push(d.getFloat32(i, true)); return a; };

// ------------------------------------------------------------- curve maths
// A curved line = natural cubic spline through [start, ...curve points, end],
// chord-length parameterised. Converted exactly into cubic Bézier segments [p0, c1, c2, p3].
// d0 / d1 (optional, this program's own addition): the curve's direction and speed dP/dt at
// its start / end, t being the length along the chords. With one given, that end is held to
// it instead of being free. Without them the result is the natural spline, by the code that
// was checked against the files (docs/zprj-format.md, Geometry), untouched.
function splineToBeziers(P, d0, d1) {
  if (d0 || d1) return clampedBeziers(P, d0 || null, d1 || null);
  const n = P.length;
  if (n === 2) return [[P[0], lerp(P[0], P[1], 1 / 3), lerp(P[0], P[1], 2 / 3), P[1]]];
  const h = []; for (let i = 0; i < n - 1; i++) h.push(Math.max(dist(P[i], P[i + 1]), 1e-9));
  const M = Array.from({ length: n }, () => [0, 0]);   // second derivatives, natural ends = 0
  const m = n - 2, cp = new Array(m).fill(0), dp = Array.from({ length: m }, () => [0, 0]);
  for (let i = 0; i < m; i++) {
    const a = h[i], b = 2 * (h[i] + h[i + 1]), c = h[i + 1];
    const rhs = [0, 1].map(k => 6 * ((P[i + 2][k] - P[i + 1][k]) / h[i + 1] - (P[i + 1][k] - P[i][k]) / h[i]));
    const den = i === 0 ? b : b - a * cp[i - 1];
    cp[i] = i < m - 1 ? c / den : 0;
    dp[i] = [0, 1].map(k => (rhs[k] - (i === 0 ? 0 : a * dp[i - 1][k])) / den);
  }
  for (let i = m - 1; i >= 0; i--) M[i + 1] = [0, 1].map(k => dp[i][k] - (i < m - 1 ? cp[i] * M[i + 2][k] : 0));
  return spansOf(P, h, M);
}
// the Bézier of each span, from the points, the chord lengths and the second derivatives
function spansOf(P, h, M) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const hi = h[i];
    const d0 = [0, 1].map(k => (P[i + 1][k] - P[i][k]) / hi - hi * (2 * M[i][k] + M[i + 1][k]) / 6);
    const d1 = [0, 1].map(k => (P[i + 1][k] - P[i][k]) / hi + hi * (M[i][k] + 2 * M[i + 1][k]) / 6);
    out.push([P[i], [P[i][0] + d0[0] * hi / 3, P[i][1] + d0[1] * hi / 3],
              [P[i + 1][0] - d1[0] * hi / 3, P[i + 1][1] - d1[1] * hi / 3], P[i + 1]]);
  }
  return out;
}
// the same spline with one or both ends held to a given dP/dt (the other end free)
function clampedBeziers(P, d0, d1) {
  const n = P.length;
  const h = []; for (let i = 0; i < n - 1; i++) h.push(Math.max(dist(P[i], P[i + 1]), 1e-9));
  const sl = (i, k) => (P[i + 1][k] - P[i][k]) / h[i];
  // a[i]·M[i-1] + b[i]·M[i] + c[i]·M[i+1] = r[i]
  const a = new Array(n).fill(0), b = new Array(n).fill(1), c = new Array(n).fill(0), r = Array.from({ length: n }, () => [0, 0]);
  if (d0) { b[0] = 2 * h[0]; c[0] = h[0]; r[0] = [0, 1].map(k => 6 * (sl(0, k) - d0[k])); }
  for (let i = 1; i < n - 1; i++) { a[i] = h[i - 1]; b[i] = 2 * (h[i - 1] + h[i]); c[i] = h[i]; r[i] = [0, 1].map(k => 6 * (sl(i, k) - sl(i - 1, k))); }
  if (d1) { a[n - 1] = h[n - 2]; b[n - 1] = 2 * h[n - 2]; r[n - 1] = [0, 1].map(k => 6 * (d1[k] - sl(n - 2, k))); }
  for (let i = 1; i < n; i++) { const w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; r[i] = [r[i][0] - w * r[i - 1][0], r[i][1] - w * r[i - 1][1]]; }
  const M = new Array(n);
  M[n - 1] = [r[n - 1][0] / b[n - 1], r[n - 1][1] / b[n - 1]];
  for (let i = n - 2; i >= 0; i--) M[i] = [0, 1].map(k => (r[i][k] - c[i] * M[i + 1][k]) / b[i]);
  return spansOf(P, h, M);
}
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
Z.splineToBeziers = splineToBeziers;

function applyTransform(M, p) {          // M = 9 floats, row-major, row-vector convention
  return [p[0] * M[0] + p[1] * M[3] + M[6], p[0] * M[1] + p[1] * M[4] + M[7]];
}
Z.applyTransform = applyTransform;

function sampleSegments(segments, step = 1) {   // -> polyline points
  const pts = [];
  for (const s of segments) {
    let poly;
    if (s.length === 2) poly = s;
    else {
      const L = dist(s[0], s[1]) + dist(s[1], s[2]) + dist(s[2], s[3]);
      const k = Math.max(4, Math.ceil(L / step));
      poly = Array.from({ length: k + 1 }, (_, i) => bez(s, i / k));
    }
    pts.push(...(pts.length ? poly.slice(1) : poly));
  }
  return pts;
}
Z.sampleSegments = sampleSegments;
function bez([p0, p1, p2, p3], t) {
  const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

// --------------------------------------------------------------- extraction
/* EVERY KEY IS OPTIONAL but what a pattern cannot exist without. The program that writes these files leaves keys out
   now and then (an allowance offset, the stored cut line, a name), so everything is read through a reader R that
   gives a default for a missing key, and counts it:
     R.need(m, k, f)     f(the value), or an error that names the key: only for what nothing can stand in for (the
                         outline's points and lines, a point's position, a line's two ends). The pattern (or the internal
                         or reference shape) it was in is left out and named; everything else comes through.
     R.opt(m, k, f, d)   f(the value), or d when the key is missing or its value can't be read so; counted in R.used[k]
                         (the import report lists them as "defaults used"). DEFAULTS says what each default is.
     R.may(m, k, f, d)   the same, for a key whose absence is ordinary (an annotation, a straight line's curve points):
                         not counted.
   A value of the wrong kind (a list where a number belongs, too few bytes) counts as missing. */
const DEFAULTS = {
  mapElement: "no internal name", qsName: "no internal name", m3Matrix: "placed as drawn (no turn, no move)", mapTransformer2D: "placed as drawn (no turn, no move)",
  iLineType: "straight, or curved where the line has curve points", v2Position: "the curve point is left out", fSAStartOffset: "seam allowance 0", fSAEndOffset: "seam allowance 0",
  listNotch: "no notches", v2StartPosition: "the notch is placed by its share of the line", fAlpha: "the notch is placed by its position", fLength: "the document's notch length",
  fLocalAngle: "square to the line", uiNotchType: "the document's notch type", baSAPositions: "no stored cut line", listInnerShape: "no internal lines", listDummyShape: "no reference lines",
  qsInnerShapeName: "no name", qsDummyShapeName: "no name", bSeamAllowanceShape: "a reference line", listPoint: "no curve points",
  arrSizeSpecificPosition: "not graded: the point moves in proportion between its graded neighbours", arrPointSizeSpec: "not graded: the curve point travels with its line's ends",
  listGrainLineInfo: "no grainline", iFabricIndex: "no fabric",
  uiSelfIndex: "the seam is left out", uiStartIndex: "the seam is left out", uiEndIndex: "the seam is left out", fRatioStart: "from the start of its line", fRatioEnd: "to the end of its line",
  bDirection: "along the line's own direction when the ends say so",
};
Z.DEFAULTS = DEFAULTS;
const isMapV = (m) => !!m && typeof m === 'object' && !(m instanceof Uint8Array) && !Array.isArray(m);
const asList = (v) => { if (!Array.isArray(v)) throw new Error('not a list'); return v; };
const asMap = (v) => { if (!isMapV(v)) throw new Error('not a map'); return v; };
const asPt = (b) => { const q = v2(b); if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) throw new Error('not a place'); return q; };
const asM3 = (b) => { const M = m3(b); if (!M.every(Number.isFinite)) throw new Error('not a placement'); return M; };
const num = (f) => (b) => { const x = f(b); if (!Number.isFinite(x)) throw new Error('not a number'); return x; };
const bool = (b) => { if (!(b instanceof Uint8Array) || !b.length) throw new Error('not a flag'); return !!b[0]; };
const text = (b) => { if (!(b instanceof Uint8Array)) throw new Error('not text'); return str(b); };
/* TEXT (Round I3 / 1). A string key may come twice: the plain key (qsName) and a variant that says its encoding (qsNameUTF8;
   a UTF16 variant is looked for too, though none is in the files known). In the files known both hold the same bytes, and all
   of them are plain ASCII; a name with letters outside ASCII is where they would differ, so the variant that says its encoding
   is read first: UTF8, then UTF16, then the plain key. The plain key is read as UTF-8 when it is valid UTF-8, as UTF-16 (little
   end first) when it looks like it (a byte-order mark, or a zero after every character), else as Latin-1 (Windows-1252).
   A trailing NUL and a byte-order mark are dropped. */
const UTF8 = new TextDecoder('utf-8', { fatal: true });
function looks16(b) {
  if (b.length < 2 || b.length % 2) return false;
  if (b[0] === 0xff && b[1] === 0xfe) return true;
  let odd = 0, even = 0;
  for (let i = 0; i < b.length; i += 2) { if (!b[i]) even++; if (!b[i + 1]) odd++; }
  return odd*2 >= b.length/2 && even < odd;
}
function decodeText(b, kind) {
  if (!(b instanceof Uint8Array)) throw new Error('not text');
  let s;
  if (kind === 'utf16' || (!kind && looks16(b))) s = new TextDecoder('utf-16le').decode(b.length % 2 ? b.subarray(0, b.length - 1) : b);
  else { try { s = UTF8.decode(b); } catch (e) { if (kind === 'utf8') throw new Error('not UTF-8'); s = new TextDecoder('latin1').decode(b); } }
  return s.replace(/^\uFEFF/, '').replace(/\u0000+$/, '');
}
Z.decodeText = decodeText;
// the key's text: its UTF8 variant, its UTF16 variant, the key itself (the first that is there and not empty), or null
function textOf(m, k) {
  if (!isMapV(m)) return null;
  let found = null;
  for (const [key, kind] of [[k + 'UTF8', 'utf8'], [k + 'UTF16', 'utf16'], [k, null]]) {
    if (!(key in m)) continue;
    let s;
    try { s = decodeText(m[key].v, kind); } catch (e) { continue; }
    if (s.trim()) return s;
    if (found === null) found = s;
  }
  return found;
}
Z.textOf = textOf;
function reader() {
  const used = {};
  const read = (m, k, f) => { if (!isMapV(m) || !(k in m)) return { miss: true }; try { return { v: f(m[k].v) }; } catch (e) { return { miss: true, bad: true }; } };
  return {
    used,
    need(m, k, f) { const r = read(m, k, f || ((v) => v)); if (r.miss) throw new Error((r.bad ? 'unreadable key ' : 'missing key ') + k); return r.v; },
    opt(m, k, f, d) { const r = read(m, k, f); if (r.miss) { used[k] = (used[k] || 0) + 1; return d; } return r.v; },
    may(m, k, f, d) { const r = read(m, k, f); return r.miss ? d : r.v; },
    // text (textOf(): the UTF8 / UTF16 variant first): txt is not counted when missing, txtOpt is (under the plain key)
    txt(m, k, d) { const s = textOf(m, k); return s === null ? d : s; },
    txtOpt(m, k, d) { const s = textOf(m, k); if (s === null) { used[k] = (used[k] || 0) + 1; return d; } return s; },
    count(k) { used[k] = (used[k] || 0) + 1; },
    sizes: 0,                 // how many sizes the file is graded in (0: not graded): set before the patterns are read
  };
}
// a typed array of places (0x15: u32 count, u8 element type 0x0a, count × 2 float32): a point's place in every size
function sizePlaces(b) {
  if (!(b instanceof Uint8Array) || b.length < 5) throw new Error('not a list of places');
  const d = dvOf(b), n = d.getUint32(0, true);
  if (!n) return [];
  if (b[4] !== 0x0a || b.length !== 5 + 8 * n) throw new Error('not a list of places');
  const out = [];
  for (let i = 0; i < n; i++) { const q = [d.getFloat32(5 + 8 * i, true), d.getFloat32(9 + 8 * i, true)]; if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) throw new Error('not a place'); out.push(q); }
  return out;
}
// a point's places in the file's sizes (key k), or null: when the file is graded, a point without them is counted
function placesOf(R, m, k) {
  if (R.sizes < 2) return null;
  const v = R.may(m, k, sizePlaces, null);
  if (v && v.length === R.sizes) return v;
  R.count(k); return null;
}
const ID3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const placement = (R, m) => R.opt(R.opt(m, 'mapTransformer2D', asMap, {}), 'm3Matrix', asM3, ID3);
// the points of a shape: every one must have its place. sizes (when the file is graded): each point's places in every size, or null
function shapePoints(R, shape, sizes) {
  return R.need(shape, 'listPoint', asList).map((pt, i) => {
    let q;
    try { q = R.need(asMap(pt), 'v2Position', asPt); } catch (e) { throw new Error('point ' + (i + 1) + ': ' + e.message); }
    if (sizes) sizes.push(placesOf(R, pt, 'arrSizeSpecificPosition'));
    return q;
  });
}
// a line of a shape whose points are pts: its two ends (indices into pts), its curve points and its curve
function lineOf(R, pts, ln) {
  const start = R.need(ln, 'uiStartPointIndex', u32), end = R.need(ln, 'uiEndPointIndex', u32);
  if (!pts[start] || !pts[end]) throw new Error('a line runs to point ' + ((pts[start] ? end : start) + 1) + ', which is not there');
  const listed = R.may(ln, 'listPoint', asList, []);
  const got = listed.map(c => { const at = R.opt(isMapV(c) ? c : {}, 'v2Position', asPt, null); return at && { at, sizes: placesOf(R, c, 'arrPointSizeSpec') }; }).filter(Boolean);
  const cps = got.map(c => c.at);
  const type = R.opt(ln, 'iLineType', num(i32), cps.length ? 2 : 0);
  const a = pts[start], b = pts[end];
  // curveSizes (when the file is graded): each curve point's places in every size, or null
  if (type === 2 && cps.length) return { start, end, curved: true, curvePoints: cps, curveSizes: R.sizes >= 2 ? got.map(c => c.sizes) : null, segments: splineToBeziers([a, ...cps, b]) };
  return { start, end, curved: false, curvePoints: [], curveSizes: null, segments: [[a, b]] };
}
// a helper shape (internal or reference line) with its points and lines kept, so that it can be
// rebuilt as lines with curve points: { points, lines: [{ start, end, curved, curvePoints }] }, through T (or as it is)
function shapeOf(R, shape, T) {
  const X = T ? (q) => applyTransform(T, q) : (q) => q, sizes = R.sizes >= 2 ? [] : null, pts = shapePoints(R, shape, sizes);
  const lines = R.need(shape, 'listLine', asList).map(ln => lineOf(R, pts, asMap(ln)));
  const XS = (a) => a ? a.map(X) : null;
  return {
    shape: { points: pts.map(X), pointSizes: sizes && sizes.map(XS), lines: lines.map(l => ({ start: l.start, end: l.end, curved: l.curved, curvePoints: l.curvePoints.map(X), curveSizes: l.curveSizes && l.curveSizes.map(XS) })) },
    segments: lines.flatMap(l => l.segments).map(s => s.map(X)),
  };
}
/* A pattern's grainline and fabric (mapFabricShape2D): listGrainLineInfo[0] { fAngle (degrees), v2Translation }, and
   iFabricIndex (into the file's listFabric). How fAngle is to be read is a guess, checked on two files only (see the
   app's zprjGrain()); v2Translation is passed on as it is. */
function fabricShape(R, p) {
  const fs = R.may(p, 'mapFabricShape2D', asMap, null);      // none at all: a pattern with neither (not counted)
  if (!fs) return { grain: null, fabric: -1 };
  const info = R.opt(fs, 'listGrainLineInfo', asList, []).filter(isMapV)[0];
  if (!info) R.count('listGrainLineInfo');
  const grain = info ? { angle: R.opt(info, 'fAngle', num(f32), 0), at: R.may(info, 'v2Translation', asPt, [0, 0]) } : null;
  return { grain, fabric: R.opt(fs, 'iFabricIndex', num(i32), -1) };
}
/* THE CLOTH AS THE FILE LAST HAD IT (Round I3 / 2). Each pattern keeps its cloth mesh twice: at rest in the file's 2D window
   (mapFabricShape2D.mapMesh2D: baRest, float32 x, y pairs, the same coordinates as the outline put through its placement;
   baTri, uint32 corner triples) and where its points are in 3D (baPosition3D, float32 x, y, z per point of baRest, in
   millimetres, y up, the floor at 0, the avatar facing +z with its left side at +x; mapMesh3D.baPos3D holds the same where it
   is there). That is the drape as it was last simulated, or the flat cloth where it was arranged. -> { rest, tri, pos } or
   null when any of it is missing or the three do not agree (an ordinary absence: not counted). */
const floatsOf = (b) => { if (!(b instanceof Uint8Array) || b.length % 4) throw new Error('not floats'); const a = new Float32Array(b.slice().buffer); for (const v of a) if (!Number.isFinite(v)) throw new Error('not a number'); return a; };
const uintsOf = (b) => { if (!(b instanceof Uint8Array) || b.length % 4) throw new Error('not numbers'); return new Uint32Array(b.slice().buffer); };
function clothOf(R, p) {
  const fs = R.may(p, 'mapFabricShape2D', asMap, null), ms = fs && R.may(fs, 'mapMesh2D', asMap, null);
  if (!ms) return null;
  const rest = R.may(ms, 'baRest', floatsOf, null), tri = R.may(ms, 'baTri', uintsOf, null);
  const pos = R.may(p, 'baPosition3D', floatsOf, null) || R.may(R.may(p, 'mapMesh3D', asMap, {}), 'baPos3D', floatsOf, null);
  if (!rest || !tri || !pos) return null;
  const n = rest.length/2;
  if (n < 3 || rest.length % 2 || pos.length !== 3*n || !tri.length || tri.length % 3) return null;
  for (const i of tri) if (i >= n) return null;
  return { rest, tri, pos };
}
/* The avatar the file was draped on: mapAvatar.qsAvatarID (its name) and mapAvatar.mapResizingAvatar.listFeatureValues, a list
   of float32 body measurements in centimetres whose first is taken as the height (187.96 in both files known, as the program's
   male template is tall: a guess, see the report). -> { id, height (mm) } or null. Nothing else of the avatar is read. */
function avatarOf(R, root) {
  const av = R.may(root, 'mapAvatar', asMap, null);
  if (!av) return null;
  const vals = R.may(R.may(av, 'mapResizingAvatar', asMap, {}), 'listFeatureValues', asList, []), cm = vals.length ? (() => { try { return num(f32)(vals[0]); } catch (e) { return NaN; } })() : NaN;
  return { id: R.txt(av, 'qsAvatarID', ''), height: cm >= 100 && cm <= 260 ? Math.round(cm*100)/10 : null };
}
/* GRAPHICS (Round I3 / 3): artwork the user put on patterns (a logo, a print). Only what the file lists as a graphic is
   read; a fabric's textures and maps are never looked at.
     mapPatternEditor.listMVGraphic[]          one graphic each: .mapElement.qsName, .uiGraphicStyleIndex
       .listOverlayFabricShape2D[]             where it lies, once per pattern it is on:
          .uiParentPatternSelfIndex            the pattern (its index in listPattern)
          .mapShape2D.mapTransformer2D.m3Matrix   the graphic's own coordinates into the pattern's (as a placement is)
          .mapShape2D.listPoint[].v2Position   its four corners in its own coordinates (±width/2, ±height/2, millimetres)
          .enRepeatType                        0: placed once (other values taken as repeated: a guess, none seen)
          .mapElement.bVisible
     root.listGraphicStyle[uiGraphicStyleIndex].mapGrapghicFabric.mapMaterial2D.listFaceMaterial[0].listTexture[0].qsFileName
                                               the picture: an entry of the garment archive by that name
   (listPattern[].listPrintTexture[] holds the same placement again, with the same qsUuid; one not listed as a graphic is read
   the same way.) -> [{ name, file, pattern, m: placement (9 numbers), w, h, repeat }]; one that can't be read is left out. */
function graphicsOf(R, root, pe, patterns) {
  const styles = R.may(root, 'listGraphicStyle', asList, []), out = [], seen = new Set();
  const fileOf = (k) => {
    const st = styles[k];
    if (!isMapV(st)) return null;
    const fab = R.may(st, 'mapGrapghicFabric', asMap, null) || R.may(st, 'mapGraphicFabric', asMap, null);
    const mat = fab && R.may(fab, 'mapMaterial2D', asMap, null), face = mat && R.may(mat, 'listFaceMaterial', asList, [])[0];
    const tex = isMapV(face) ? R.may(face, 'listTexture', asList, [])[0] : null;
    return isMapV(tex) ? R.txt(tex, 'qsFileName', null) : null;
  };
  const take = (o, name, file, parent) => {
    if (!isMapV(o) || !file) return;
    const id = R.txt(o, 'qsUuid', '');
    if (id && seen.has(id)) return;
    const el = R.may(o, 'mapElement', asMap, {});
    if (!R.may(el, 'bVisible', bool, true)) return;
    const sh = R.may(o, 'mapShape2D', asMap, null);
    if (!sh) return;
    const pattern = R.may(o, 'uiParentPatternSelfIndex', num(u32), parent);
    let pts;
    try { pts = R.may(sh, 'listPoint', asList, []).map(p => asPt(asMap(p).v2Position.v)); } catch (e) { return; }
    if (pts.length < 3 || !(pattern >= 0)) return;
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    if (!(w > 0 && h > 0)) return;
    const m = placement(R, sh), c = [(Math.max(...xs) + Math.min(...xs))/2, (Math.max(...ys) + Math.min(...ys))/2];
    // the placement of the graphic's middle: the corners need not lie round (0, 0)
    const M = c[0] || c[1] ? [m[0], m[1], 0, m[3], m[4], 0, c[0]*m[0] + c[1]*m[3] + m[6], c[0]*m[1] + c[1]*m[4] + m[7], 1] : m;
    if (id) seen.add(id);
    out.push({ name: name || file.replace(/\.[a-z0-9]+$/i, ''), file, pattern, m: M, w, h, repeat: R.may(o, 'enRepeatType', num(i32), 0) !== 0 });
  };
  R.may(pe, 'listMVGraphic', asList, []).forEach((g) => {
    if (!isMapV(g)) return;
    const name = R.txt(R.may(g, 'mapElement', asMap, {}), 'qsName', ''), file = fileOf(R.may(g, 'uiGraphicStyleIndex', num(u32), -1));
    for (const o of R.may(g, 'listOverlayFabricShape2D', asList, [])) take(o, name, file, -1);
  });
  // a pattern's own print placements that no graphic of the list holds (the same graphic is kept there again, by its qsUuid)
  (patterns || []).forEach((p, i) => {
    if (!isMapV(p)) return;
    for (const o of R.may(p, 'listPrintTexture', asList, [])) {
      if (!isMapV(o)) continue;
      const fs = R.may(o, 'mapFabricShape2D', asMap, null), fab = fs && R.may(fs, 'mapFabric', asMap, null), mat = fab && R.may(fab, 'mapMaterial2D', asMap, null);
      const face = mat && R.may(mat, 'listFaceMaterial', asList, [])[0], tex = isMapV(face) ? R.may(face, 'listTexture', asList, [])[0] : null;
      take(o, R.txt(R.may(o, 'mapElement', asMap, {}), 'qsName', ''), isMapV(tex) ? R.txt(tex, 'qsFileName', null) : null, i);
    }
  });
  return out;
}
// a picture's kind and size in pixels from its first bytes (PNG, JPEG, GIF, WebP, BMP), or null
function pictureOf(b) {
  if (!(b instanceof Uint8Array) || b.length < 26) return null;
  const dv = dvOf(b), be32 = (o) => dv.getUint32(o, false);
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: 'png', w: be32(16), h: be32(20) };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { type: 'gif', w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
  if (b[0] === 0x42 && b[1] === 0x4d) return { type: 'bmp', w: Math.abs(dv.getInt32(18, true)), h: Math.abs(dv.getInt32(22, true)) };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const k = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (k === 'VP8X') return { type: 'webp', w: 1 + (b[24] | b[25] << 8 | b[26] << 16), h: 1 + (b[27] | b[28] << 8 | b[29] << 16) };
    if (k === 'VP8 ') return { type: 'webp', w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
    if (k === 'VP8L') { const v = dv.getUint32(21, true); return { type: 'webp', w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let o = 2; o + 9 < b.length;) {
      if (b[o] !== 0xff) { o++; continue; }
      const mk = b[o + 1];
      if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { o += 2; continue; }
      if ((mk >= 0xc0 && mk <= 0xcf) && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { type: 'jpeg', w: dv.getUint16(o + 7, false), h: dv.getUint16(o + 5, false) };
      o += 2 + dv.getUint16(o + 2, false);
    }
  }
  return null;
}
// what a pattern is called: its annotation (the name shown on it), its internal name; either may be missing
const nameOf = (R, p) => isMapV(p) ? R.txt(R.may(p, 'mapElement', asMap, {}), 'qsName', '') : '';
const annoOf = (R, p) => { const a = isMapV(p) ? R.may(p, 'mapAnnoForPatternName', asMap, null) : null; return a ? R.txt(a, 'qsText', null) : null; };
// a zipper's tape is a pattern of the file, made by the zipper tool: it is the zipper's, not a cut pattern
const isTape = (R, p) => isMapV(p) && ('mapNewTape' in p);

function extractPiece(R, p, index) {
  p = asMap(p);
  const sh = R.need(p, 'mapShape2D', asMap);
  const transform = placement(R, sh);
  const pointSizes = R.sizes >= 2 ? [] : null, points = shapePoints(R, sh, pointSizes);
  const left = [];            // parts of this pattern that were left out, and why
  const lines = R.need(sh, 'listLine', asList).map((ln, li) => {
    let geo;
    try { ln = asMap(ln); geo = lineOf(R, points, ln); } catch (e) { throw new Error('line ' + (li + 1) + ': ' + e.message); }
    const notches = [];
    R.opt(ln, 'listNotch', asList, []).forEach(n => {
      if (!isMapV(n)) return;
      const position = R.opt(n, 'v2StartPosition', asPt, null), alpha = R.opt(n, 'fAlpha', num(f32), null);
      if (!position && !(alpha >= 0 && alpha <= 1)) { left.push('a notch on line ' + (li + 1) + ': it has neither a place nor a share of the line'); return; }
      notches.push({
        position,                                              // exact point on the outline (piece-local), or null
        length: R.opt(n, 'fLength', num(f32), null),
        angle: R.opt(n, 'fLocalAngle', num(f32), 90),         // 90 = perpendicular to the line
        type: R.opt(n, 'uiNotchType', num(u32), null),
        alpha,                                                  // relative position along the line, or null
      });
    });
    return { ...geo, seamAllowance: [R.opt(ln, 'fSAStartOffset', num(f32), 0), R.opt(ln, 'fSAEndOffset', num(f32), 0)], notches };
  });
  if (!lines.length) throw new Error('its outline has no lines');
  const sa = R.opt(sh, 'baSAPositions', (b) => { if (!(b instanceof Uint8Array)) throw 0; return f32arr(b); }, []), cutLine = [];
  for (let i = 0; i + 1 < sa.length; i += 2) cutLine.push([sa[i], sa[i + 1]]);
  const internalLines = [];
  R.opt(p, 'listInnerShape', asList, []).forEach((ins, k) => {
    const name = isMapV(ins) ? R.txtOpt(ins, 'qsInnerShapeName', '') : '';
    try { ins = asMap(ins); const got = shapeOf(R, ins, placement(R, ins)); internalLines.push({ name, segments: got.segments, shape: got.shape }); }    // inner shape -> piece-local
    catch (e) { left.push('internal line ' + (name || k + 1) + ': ' + e.message); }
  });
  const referenceLines = [];
  R.opt(p, 'listDummyShape', asList, []).forEach((ds, k) => {
    if (!isMapV(ds) || R.opt(ds, 'bSeamAllowanceShape', bool, false)) return;
    const name = R.txtOpt(ds, 'qsDummyShapeName', '');
    try { const got = shapeOf(R, R.need(ds, 'mapShape2D', asMap), null); referenceLines.push({ name, segments: got.segments, shape: got.shape }); }
    catch (e) { left.push('reference line ' + (name || k + 1) + ': ' + e.message); }
  });
  return {
    index,
    name: nameOf(R, p),
    annotation: annoOf(R, p),     // the name shown on the piece
    transform,
    mirrored: (transform[0] * transform[4] - transform[1] * transform[3]) < 0,
    points, lines,
    pointSizes,             // when the file is graded: each outline point's places in every size (as points are: piece-local), or null
    gradeRule: R.txt(p, 'qsGradeRuleName', null),      // the name of the size table it is graded by
    ...fabricShape(R, p),     // grain: { angle, at } or null; fabric: the index into the file's fabrics, or -1
    hasSeamAllowance: lines.some(l => Math.max(...l.seamAllowance) > 0),
    cutLine,                // the file's own computed cut line (= outline when SA is 0); empty when the file has none
    cloth: clothOf(R, p),   // the cloth at rest in the file's 2D window and in 3D (Round I3 / 2), or null
    internalLines, referenceLines, left,
  };
}
/* every pattern of the file. One that can't be read is left out and named in `skipped` ({ index, name, reason }); the
   rest come through. total: how many patterns the file has; defaults: { key: how many times a default stood in };
   others: what the file holds besides patterns that is not imported ({ zippers: [names], graphics, trims }). */
function extractPieces(root) {
  const R = reader(), pieces = [], skipped = [];
  const pe = R.need(root, 'mapPatternEditor', asMap);
  const pl = R.need(pe, 'mapPatternList', asMap), list = R.need(pl, 'listPattern', asList);
  const grading = gradingOf(R, pe, pl);
  R.sizes = grading ? grading.tables[0].sizes.length : 0;
  list.forEach((p, index) => {
    const name = String(annoOf(R, p) || '').trim() || nameOf(R, p);
    if (isTape(R, p)) { skipped.push({ index, name, reason: 'a zipper tape: zippers are not imported', kind: 'tape' }); return; }
    try { pieces.push(extractPiece(R, p, index)); }
    catch (e) { skipped.push({ index, name, reason: String((e && e.message) || e) }); }
  });
  const zippers = R.may(pe, 'listZipper', asList, []).map((z, k) => (isMapV(z) && R.txt(z, 'qsName', '')) || 'Zipper ' + (k + 1));
  const others = { zippers, graphics: R.may(pe, 'listMVGraphic', asList, []).length, trims: R.may(pe, 'listTrimObject', asList, []).length };
  return { pieces, skipped, total: list.length, defaults: R.used, others, grading, fabrics: fabricsOf(R, root), links: linksOf(R, pl, list.length), seams: seamsOf(R, pe), avatar: avatarOf(R, root), graphics: graphicsOf(R, root, pe, list) };
}
// the file's fabrics, in order (a pattern names one by its index): { name, type ("Woven", "Knit", …), content }
function fabricsOf(R, root) {
  return R.may(root, 'listFabric', asList, []).map((f, k) => isMapV(f) ? { name: (R.txt(f, 'qsName', '') || R.txt(f, 'qsFabricName', '')).trim() || 'Fabric ' + (k + 1), type: R.txt(f, 'fabricType', ''), content: R.txt(f, 'fabricContent', '') } : { name: 'Fabric ' + (k + 1), type: '', content: '' });
}
/* Patterns that are one pattern twice. arrSymmetricIndex (mapPatternList): for each pattern the index of its mirrored
   twin, or -1; a pair is listed when both name each other. listInstance[i].arrInstanceIndex: the patterns that are copies
   of pattern i (empty in the files known: read the same way, as a guess). -> { symmetric: [[i, j]], instances: [[i, j]] } */
function linksOf(R, pl, n) {
  const ints = (b) => { if (!(b instanceof Uint8Array) || b.length < 5) throw new Error('not a list'); const d = dvOf(b), c = d.getUint32(0, true); if (!c) return []; if (b.length !== 5 + 4 * c) throw new Error('not a list of numbers'); return Array.from({ length: c }, (_, i) => d.getInt32(5 + 4 * i, true)); };
  const sym = R.may(pl, 'arrSymmetricIndex', ints, []), symmetric = [], instances = [];
  sym.forEach((j, i) => { if (j > i && j < n && sym[j] === i) symmetric.push([i, j]); });
  R.may(pl, 'listInstance', asList, []).forEach((it, i) => { if (isMapV(it)) for (const j of R.may(it, 'arrInstanceIndex', ints, [])) if (j !== i && j >= 0 && j < n) instances.push([i, j]); });
  return { symmetric, instances };
}
/* The seams (mapSeamLinePairGroup.listSeamLinePairGroup[]): each joins listParamLineGroup0 to listParamLineGroup1, and
   each of those is a list of runs of an outline, sewn in the order given:
     uiSelfIndex   the pattern (its index in the pattern list)
     uiStartIndex  the outline line the run starts on, fRatioStart where on it (a share of the line, 0 at its start)
     uiEndIndex    the line it ends on, fRatioEnd where on that one
     bDirection    1: the run goes along the outline's own direction (line start, start + 1, …), 0: against it
   -> [{ name, a: [run], b: [run] }], run = { pattern, from, to, r0, r1, forward }; a seam that can't be read is left out,
   named in `left`. Only runs on an outline are known; uiDepth (1 in every run seen) is not read. */
function seamsOf(R, pe) {
  const g = R.may(pe, 'mapSeamLinePairGroup', asMap, null), out = [], left = [];
  if (!g) return { list: out, left };
  R.may(g, 'listSeamLinePairGroup', asList, []).forEach((sm, k) => {
    const name = isMapV(sm) ? R.txt(R.may(sm, 'mapElement', asMap, {}), 'qsName', '') || 'Seam ' + (k + 1) : 'Seam ' + (k + 1);
    try {
      sm = asMap(sm);
      const side = (key) => R.need(sm, key, asList).map(r => { r = asMap(r); const r0 = R.opt(r, 'fRatioStart', num(f32), 0), r1 = R.opt(r, 'fRatioEnd', num(f32), 1);
        return { pattern: R.need(r, 'uiSelfIndex', u32), from: R.need(r, 'uiStartIndex', u32), to: R.need(r, 'uiEndIndex', u32), r0, r1, forward: R.opt(r, 'bDirection', bool, r0 <= r1) }; });
      const a = side('listParamLineGroup0'), b = side('listParamLineGroup1');
      if (!a.length || !b.length) throw new Error('a side with nothing on it');
      out.push({ name, a, b });
    } catch (e) { left.push(name + ': ' + String((e && e.message) || e)); }
  });
  return { list: out, left };
}
/* The file's sizes: { tables: [{ name, sizes: [{ name, color }], base, current }] } or null when it has fewer than two.
   A table (listRuleTables) is a size group: its name (qsMVGradingItem_GradeRuleName, which a pattern's qsGradeRuleName
   names), its sizes in order (listGradingNode: qsMVGradingRuleData_Size, v4MVGradingRuleData_Color as red, green, blue,
   alpha from 0 to 1), the base size (uiDefaultSizeIndex: the size the patterns are drawn in) and the size shown when the
   file was saved (uiCurrentSizeIndex). A point's places (arrSizeSpecificPosition, a curve point's arrPointSizeSpec) are in
   that order, one per size. Only the first table's sizes are read for the points: the files known have one table. A file
   with no table but a list of size names (listSizeName) gets one table of those, its first the base. */
function gradingOf(R, pe, pl) {
  const hex = (c) => Array.isArray(c) && c.length >= 3 && c.every(Number.isFinite) ? '#' + c.slice(0, 3).map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('') : null;
  const v4 = (b) => { const d = dvOf(b); if (b.length < 16) throw new Error('not a colour'); return [0, 1, 2, 3].map(i => d.getFloat32(4 * i, true)); };
  const tables = R.may(pe, 'listRuleTables', asList, []).filter(isMapV).map((t, k) => {
    const sizes = R.may(t, 'listGradingNode', asList, []).map((n, i) => ({ name: (isMapV(n) && R.txt(n, 'qsMVGradingRuleData_Size', '').trim()) || 'Size ' + (i + 1), color: isMapV(n) ? hex(R.may(n, 'v4MVGradingRuleData_Color', v4, null)) : null }));
    const base = R.may(t, 'uiDefaultSizeIndex', num(u32), 0), current = R.may(t, 'uiCurrentSizeIndex', num(u32), base);
    return { name: R.txt(t, 'qsMVGradingItem_GradeRuleName', '').trim() || 'Sizes ' + (k + 1), sizes, base: base < sizes.length ? base : 0, current: current < sizes.length ? current : base };
  }).filter(t => t.sizes.length >= 2);
  if (!tables.length) {
    const names = R.may(pl, 'listSizeName', asList, []).map(b => { try { return decodeText(b).trim(); } catch (e) { return ''; } }).filter(Boolean);
    if (names.length >= 2) tables.push({ name: 'Sizes', sizes: names.map(name => ({ name, color: null })), base: 0, current: 0 });
  }
  return tables.length ? { tables } : null;
}

// --------------------------------------------------------------- protection
// Bits of information per byte over (at most) the first 256 KB: pattern data is well under
// 7; compressed or encrypted bytes are close to 8.
function entropy(u8) {
  const n = Math.min(u8.length, 262144), c = new Uint32Array(256);
  if (!n) return 0;
  for (let i = 0; i < n; i++) c[u8[i]]++;
  let e = 0;
  for (let i = 0; i < 256; i++) if (c[i]) { const p = c[i] / n; e -= p * Math.log2(p); }
  return e;
}
Z.entropy = entropy;
function holds(u8, text) {
  const n = Math.min(u8.length, 1 << 22), m = text.length;
  outer: for (let i = 0; i + m <= n; i++) { for (let j = 0; j < m; j++) if (u8[i + j] !== text.charCodeAt(j)) continue outer; return true; }
  return false;
}
// pattern data that can't be read as pattern data: scrambled (refuse, and say so) or merely unfamiliar
const unreadable = (pac, detail) => entropy(pac) > 7.5 && !holds(pac, 'mapPatternEditor') ? fail("encrypted") : fail("unknown", detail);

/* the pattern data of a project file, as its key / value tree (parsePac): refused with a ZprjError if it can't be had.
   Two kinds of file hold it: a .zprj (the whole project: a ZIP holding a .zpac beside the scene, lighting, …) and a
   .zpac on its own (the garment: a ZIP holding the .pac, its textures and a clofiles.json). Both end in the same .pac,
   read the same way; which one it is is told by what the archive holds, not by the file's name. */
async function readTree(buffer) { return (await readArchive(buffer)).tree; }
// the same, with the archive that holds the pattern data (its pictures are beside it): { tree, inner }
async function readArchive(buffer) {
  let outer, zpacName, inner;
  try { outer = await unzip(buffer); zpacName = outer.names.find(n => /\.zpac$/i.test(n)); }
  catch (e) { throw fail("not-zprj"); }
  if (!zpacName) {
    if (!outer.names.some(n => /\.pac$/i.test(n))) throw fail("not-zprj");
    inner = outer;                 // a .zpac: the archive that holds the .pac
  } else if (outer.encrypted(zpacName)) throw fail("encrypted");
  let pacName, pac;
  try { if (!inner) inner = await unzip(await outer.read(zpacName)); pacName = inner.names.find(n => /\.pac$/i.test(n)); }
  catch (e) { throw fail("unknown", "the pattern archive inside it could not be opened"); }
  if (!pacName) throw fail("unknown", "no pattern data inside it");
  if (inner.encrypted(pacName)) throw fail("encrypted");
  try { pac = await inner.read(pacName); }
  catch (e) { throw fail("unknown", "the pattern data could not be unpacked"); }
  let tree;
  try { tree = parsePac(pac); }
  catch (e) { throw unreadable(pac, "the pattern data is not laid out as expected"); }
  if (!has(tree, 'mapPatternEditor')) throw unreadable(pac, "no pattern list in it");
  return { tree, inner };
}
Z.readTree = readTree;
/* The pictures of the file's graphics (Round I3 / 3), from the archive that holds the pattern data: each entry named by a
   graphic (by its name without folders, letters of either case), if it is a picture (PNG, JPEG, GIF, WebP or BMP) of at most
   32 MB. -> [{ file, type, w, h, bytes }]; a graphic whose picture is not among them is left out by the page, and named. */
const PICTURE_MAX = 32 << 20;
async function picturesOf(inner, graphics) {
  const out = [], base = (n) => n.split('/').pop().toLowerCase();
  for (const file of [...new Set((graphics || []).map(g => g.file))]) {
    const name = inner.names.find(n => base(n) === base(file));
    if (!name || inner.encrypted(name)) continue;
    let bytes;
    try { bytes = await inner.read(name); } catch (e) { continue; }
    const pic = bytes.length <= PICTURE_MAX && pictureOf(bytes);
    if (pic && pic.w > 0 && pic.h > 0) out.push({ file, ...pic, bytes });
  }
  return out;
}
Z.pictureOf = pictureOf;
async function importZprj(buffer) {
  const { tree, inner } = await readArchive(buffer);
  let res;
  try { res = extractPieces(tree); }
  catch (e) { throw fail("unknown", String((e && e.message) || e)); }
  res.images = await picturesOf(inner, res.graphics);
  return res;
}
Z.importZprj = importZprj;
Z.parsePac = parsePac;

/* ---------------- IN A WORKER ----------------
   A project file can be tens of megabytes; reading it in the page's own thread would hold the
   window still. workerSource() is the text of a worker: this whole file again (make()) and
   workerMain() to answer messages. The page makes the worker from that text as a Blob, so
   there is no extra file and it works from a double-clicked page too.
     in   { id, buf }                           the file's bytes (the buffer is handed over)
     out  { id, ok: true, result }              what importZprj() gives
          { id, ok: false, code, message }      why not */
function workerMain(Z, self) {
  self.onmessage = (e) => {
    const m = e.data || {};
    Z.importZprj(m.buf).then(
      (result) => self.postMessage({ id: m.id, ok: true, result }),
      (err) => self.postMessage({ id: m.id, ok: false, code: (err && err.code) || "unknown", message: String((err && err.message) || err) }));
  };
}
Z.workerMain = workerMain;
Z.workerSource = () => "'use strict';\nconst ZPRJ = (" + make.toString() + ")();\n(" + workerMain.toString() + ")(ZPRJ, self);\n";
return Z;
}
const Z = make();
if (typeof module !== "undefined" && module.exports) module.exports = Z;
else root.ZPRJ = Z;
})(typeof globalThis !== "undefined" ? globalThis : this);
