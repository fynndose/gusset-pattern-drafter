// Round B / B1 and B2: the pattern file of version 12. A ZIP container read and written by the program's own code
// (document.json, history.json, images/…, drape.bin), packed with the platform's deflate where there is one. Files of
// version 11 and older still open; everything comes back as it was left: the drape point for point, the camera, the
// simulation settings, and what the document was draped on (an avatar's id or name and a hash of its file, never the
// model unless its owner chose so).
// files/v11/*.pdraft were written by the last build that saved version 11 (commit a54b812), each through its own Save.
"use strict";
const FV = require("./harness").FILE_VERSION;      // (Round H1) this build's file version, read from the app's FILE_VERSION
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const T = [];
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + ": " + a + " vs " + b);
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-boot-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 30000, maxBuffer: 1 << 28 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after " + (ms || 30000)/1000 + " s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
const MARTY = path.join(__dirname, "..", "assets", "avatar", "presets", "marty.glb"), hasMarty = fs.existsSync(MARTY);
const V11 = path.join(__dirname, "files", "v11");

/* ---------- the ZIP reader and writer ---------- */
const NAMES = ["zipPack", "zipUnpack", "crc32", "isZip", "fileHash"];
const Z = load(NAMES), ZS = load(NAMES, { CompressionStream: undefined, DecompressionStream: undefined });      // ZS: a browser without the streams
const pack = (G, files) => new Promise((res) => G.zipPack(files, res));
const unpack = (G, b) => new Promise((res, rej) => G.zipUnpack(b, (e, parts) => (e ? rej(e) : res(parts))));
const failsWith = async (job, re) => { let msg = null; try { await job; } catch (e) { msg = e.message; } assert.ok(msg !== null && re.test(msg), "expected an error like " + re + ", got " + msg); };
const bytes = (text) => new Uint8Array(Buffer.from(text, "utf8"));
// an archive's entries read with nothing of the program: Node's own inflate
function partsOf(buf) {
  const b = Buffer.from(buf), out = [];
  let e = b.length - 22;
  while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  let o = b.readUInt32LE(e + 16);
  for (let k = b.readUInt16LE(e + 10); k > 0; k--) {
    const method = b.readUInt16LE(o + 10), cs = b.readUInt32LE(o + 20), nl = b.readUInt16LE(o + 28), at = b.readUInt32LE(o + 42), name = b.toString("utf8", o + 46, o + 46 + nl);
    const d0 = at + 30 + b.readUInt16LE(at + 26) + b.readUInt16LE(at + 28), raw = b.subarray(d0, d0 + cs);
    out.push({ name, method, packed: cs, data: method === 8 ? zlib.inflateRawSync(raw) : raw });
    o += 46 + nl + b.readUInt16LE(o + 30) + b.readUInt16LE(o + 32);
  }
  return out;
}
// an archive made with nothing of the program: Node's own deflate and CRC
function foreignZip(entries) {
  const locals = [], central = [];
  let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8"), data = e.deflate ? zlib.deflateRawSync(e.data) : Buffer.from(e.data), crc = e.crc !== undefined ? e.crc : zlib.crc32(e.data);
    const lh = Buffer.alloc(30), ch = Buffer.alloc(46);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(e.flags || 0, 6); lh.writeUInt16LE(e.deflate ? 8 : 0, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(name.length, 26);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(e.flags || 0, 8); ch.writeUInt16LE(e.deflate ? 8 : 0, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, name, data); central.push(ch, name);
    off += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}
let seed = 5;
const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
const FILES = () => [
  { name: "document.json", data: bytes(JSON.stringify({ pieces: Array.from({ length: 300 }, (_, k) => ({ id: k, name: "Pattern " + k, pts: [k, k + 1, k + 2] })) })) },
  { name: "images/7.png", data: Uint8Array.from({ length: 3000 }, () => Math.floor(rnd()*256)), raw: true },
  { name: "noise.bin", data: Uint8Array.from({ length: 3000 }, () => Math.floor(rnd()*256)) },
  { name: "tiny.txt", data: bytes("hi") },
  { name: "empty", data: new Uint8Array(0) },
  { name: "images/Ärmel é.png", data: bytes("a name that is not ASCII".repeat(20)) },
];

test("the ZIP writer: entries in the order given, packed with the platform's deflate when that makes them smaller, read back byte for byte; Node's own inflate reads them too; the same input gives the same bytes", async () => {
  assert.strictEqual(Z.crc32(bytes("123456789")), 0xcbf43926, "the CRC-32 every ZIP tool uses");
  const files = FILES(), zip = await pack(Z, files);
  assert.strictEqual(Z.isZip(zip), true); assert.strictEqual(Z.isZip(bytes('{"v":11}')), false); assert.strictEqual(Z.isZip(new Uint8Array(2)), false);
  const got = await unpack(Z, zip);
  assert.deepStrictEqual([...got.keys()], files.map(f => f.name));
  for (const f of files) assert.ok(Buffer.from(got.get(f.name)).equals(Buffer.from(f.data)), f.name);
  const node = partsOf(zip);
  assert.deepStrictEqual(node.map(p => [p.name, p.method]), [["document.json", 8], ["images/7.png", 0], ["noise.bin", 0], ["tiny.txt", 0], ["empty", 0], ["images/Ärmel é.png", 8]],
    "text is packed; a picture is stored as it is; what deflate cannot shrink, and what is tiny, is stored");
  for (const [k, f] of files.entries()) assert.ok(node[k].data.equals(Buffer.from(f.data)), "Node reads " + f.name);
  assert.ok(node[0].packed < files[0].data.length/3, "the document shrinks: " + node[0].packed + " of " + files[0].data.length);
  assert.ok(Buffer.from(await pack(Z, FILES().map((f, k) => ({ ...f, data: files[k].data })))).equals(Buffer.from(zip)), "the same bytes every time");
});

test("without the platform's streams: entries are stored, the file is written before the call returns, and either kind of build reads it; a packed file is refused there with the reason", async () => {
  const files = FILES();
  let now = null;
  ZS.zipPack(files, (b) => { now = b; });
  assert.ok(now, "no waiting: Save in a page without the streams finishes at once");
  assert.ok(partsOf(now).every(p => p.method === 0));
  for (const G of [Z, ZS]) { const got = await unpack(G, now); for (const f of files) assert.ok(Buffer.from(got.get(f.name)).equals(Buffer.from(f.data)), f.name); }
  let sync = null;
  ZS.zipUnpack(now, (e, parts) => { sync = parts; });
  assert.ok(sync && sync.size === files.length, "and read at once");
  await failsWith(unpack(ZS, await pack(Z, files)), /packed, and this browser cannot unpack it/);
});

test("the ZIP reader: an archive made by another tool opens (stored and deflated entries); a damaged, a cut-off and a password-protected one are refused, each with its reason", async () => {
  const doc = Buffer.from(JSON.stringify({ hello: "world ".repeat(200) })), pic = Buffer.from([1, 2, 3, 4, 5]);
  const zip = foreignZip([{ name: "document.json", data: doc, deflate: true }, { name: "images/1.png", data: pic }]);
  for (const G of [Z]) { const got = await unpack(G, zip); assert.ok(Buffer.from(got.get("document.json")).equals(doc)); assert.deepStrictEqual([...got.get("images/1.png")], [1, 2, 3, 4, 5]); }
  await failsWith(unpack(Z, foreignZip([{ name: "a.json", data: doc, deflate: true, crc: 12345 }])), /it is damaged \(a\.json\)/);
  const hit = foreignZip([{ name: "a.bin", data: pic }]); hit[36] ^= 0xff;                    // a byte of the stored data
  await failsWith(unpack(Z, hit), /it is damaged \(a\.bin\)/);
  await failsWith(unpack(Z, foreignZip([{ name: "secret.json", data: doc, deflate: true, flags: 1 }])), /protected with a password/);
  await failsWith(unpack(Z, zip.subarray(0, zip.length - 30)), /table of contents is missing/);
  await failsWith(unpack(Z, zip.subarray(60)), /damaged|cut short|table of contents/);
  await failsWith(unpack(Z, bytes("PK\u0003\u0004 and then nothing a ZIP would hold")), /table of contents is missing/);
});

/* ---------- files of version 11 ---------- */
const v11 = fs.existsSync(V11) ? fs.readdirSync(V11).filter(f => f.endsWith(".pdraft")).sort() : [];
test("every version 11 test file opens (" + v11.length + " files): patterns, sewing, history, drape and pictures as they were saved; saved as version 12 and opened again it is the same document, and saved once more the same bytes", () => {
  assert.ok(v11.length >= 3, "the version 11 files are in tests/files/v11");
  for (const f of v11) {
    const was = JSON.parse(fs.readFileSync(path.join(V11, f), "utf8"));
    assert.strictEqual(was.v, 11, f);
    const r = boot({ blank: true, script: `
      const out = {}, name = ${JSON.stringify(f)};
      app.ev("openFile")(name, new Uint8Array(app.read("files/v11/" + name)));
      out.names = S.pieces.map(p => p.name); out.seams = S.seams.length; out.hist = [S.undo.length, S.redo.length]; out.toast = toasts[toasts.length-1]; out.dirty = !!S.dirty;
      out.drape = S.drapeIn ? Object.keys(S.drapeIn).length : 0; out.images = S.images.length; out.res = S.cloth.res;
      out.p3 = S.pieces.map(p => p.p3 ? p.p3.pos : null); out.pins = S.pieces.reduce((n, p) => n + (p.pins || []).length, 0);
      app.checkDoc(S.pieces, S.seams);
      const canon = () => app.ev("canonJSON")(JSON.parse(app.docJSON())), a = canon();          // (the document by its content: a file lists every object's keys in alphabetical order)
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
      out.parts = app.fileParts(file).map(x => x[0]); out.v = app.fileDoc(file).v; out.zip = app.ev("isZip")(file);
      app.ev("openFile")("again.pdraft", file, null, true);
      out.same = canon() === a; out.hist2 = [S.undo.length, S.redo.length]; out.toast2 = toasts[toasts.length-1];
      let again = null; app.setDownload((n, b) => { again = b; }); app.saveDoc(false);
      out.identical = file.length === again.length && file.every((v, i) => v === again[i]);
      // every step of the history can still be walked
      app.histGo(0); app.checkDoc(S.pieces, S.seams); out.first = S.pieces.length; app.histGo(999); app.checkDoc(S.pieces, S.seams); out.last = S.pieces.length;
      return out;` });
    assert.deepStrictEqual(r.errors, [], f);
    const o = r.result, steps = was.history ? was.history.steps.length : 0;
    // Round F / 7: every dart of the file is made into its pattern's outline, its legs sewn to each other (a seam each)
    assert.deepStrictEqual(o.names, was.pieces.map(p => p.name), f); assert.strictEqual(o.seams, was.seams.length + was.pieces.reduce((n, p) => n + (p.darts || []).length, 0), f);
    assert.deepStrictEqual(o.hist, [was.history.at, steps - was.history.at], f + ": its history timeline, where it stood");
    assert.strictEqual(o.toast, "Opened " + f + " with " + steps + " history steps"); assert.strictEqual(o.dirty, false);
    assert.strictEqual(o.drape, Object.keys(was.drape || {}).length, f + ": the drape"); assert.strictEqual(o.images, was.images.length, f); assert.strictEqual(o.res, was.cloth.res);
    // (Round F: every pattern has its place in 3D once the file is open; one the file gave a place keeps it)
    assert.ok(o.p3.every(Boolean), f + ": every pattern has its place in 3D"); was.pieces.forEach((p, k) => { if (p.p3) assert.deepStrictEqual(o.p3[k], p.p3.pos, f + ": the file's place"); }); assert.strictEqual(o.pins, was.pieces.reduce((n, p) => n + (p.pins || []).length, 0));
    assert.deepStrictEqual([o.v, o.zip], [FV, true], "saved as this build's version (Round H1: FILE_VERSION; FV since Round H1a, 30 since Round r34; Round r30; 27 since Round r29; 26 since Round r26; 25 since Round r25; 24 since Round r20; 23 since the r19 follow-up; 22 since Round r18; 21 since Round r17b; 20 since Round build-1; 19 since Round perf-2; 18 since Round r15; 17 since Round r14), a ZIP container");      // (Round H1: this build's version read from the app, FV) ((Round H1a: version 31) (Round r34: version 30) (Round r33b: version 29)
    assert.deepStrictEqual(o.parts, ["document.json", "history.json", ...was.images.map(im => "images/" + im.id + ".png"), ...(was.drape ? ["drape.bin"] : [])], f + ": its parts");
    assert.strictEqual(o.same, true, f + ": the same document after the round trip"); assert.deepStrictEqual(o.hist2, o.hist); assert.strictEqual(o.toast2, "Opened again.pdraft with " + steps + " history steps");
    assert.strictEqual(o.identical, true, f + ": save, reopen, save gives identical bytes");
    assert.ok(o.first >= 0 && o.last === was.pieces.length + (steps - was.history.at > 0 ? o.last - was.pieces.length : 0));
  }
});

test("save, reopen, save gives identical bytes with the platform's deflate too, and the packed file is much smaller than the same document as version 11 text", () => {
  const f = "curves-graphic-block.pdraft", text = fs.readFileSync(path.join(V11, f));
  const r = boot({ blank: true, streams: true, script: `
    return (async () => {
      const out = {}, save = () => new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); });
      const open = async (name, b) => { const n = toasts.length; app.ev("openFile")(name, b, null, true); await app.wait(() => toasts.length > n, "the file to open"); return toasts[toasts.length-1]; };
      out.t1 = await open("old.pdraft", new Uint8Array(app.read("files/v11/${f}")));
      const canon = () => app.ev("canonJSON")(JSON.parse(app.docJSON())), a = canon(), one = await save();
      out.saved = [toasts[toasts.length-1], !!S.dirty];
      out.t2 = await open("new.pdraft", one);
      out.same = canon() === a;
      const two = await save();
      out.identical = one.length === two.length && one.every((v, i) => v === two[i]);
      out.size = one.length; out.b64 = app.ev("b64Of")(one);
      return out;
    })();` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.t1, "Opened old.pdraft with 4 history steps"); assert.strictEqual(o.t2, "Opened new.pdraft with 4 history steps");
  assert.deepStrictEqual(o.saved, ["Saved", false]); assert.strictEqual(o.same, true); assert.strictEqual(o.identical, true);
  const parts = partsOf(Buffer.from(o.b64, "base64"));
  assert.deepStrictEqual(parts.map(p => [p.name, p.method]), [["document.json", 8], ["history.json", 8], ["images/1.png", 0]]);
  assert.strictEqual(JSON.parse(parts[0].data.toString("utf8")).v, FV);      // (Round H1: this build's version read from the app, FV) ((Round H1a: version 31) (Round r34: version 30) ((Round r33b: version 29) version 28 since Round r30 (a seam's mirror); 27 since Round r29 (a document's render settings); 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
  assert.ok(o.size < text.length/3, "version 12: " + o.size + " bytes, version 11: " + text.length);
});

test("a document made in this session (not read from a file) is saved, opened and saved again as the same bytes: document.json and history.json are written with every object's keys in alphabetical order", () => {
  const G = load(["canonJSON"]);
  assert.strictEqual(G.canonJSON({ b: 1, a: [3, { z: null, y: undefined, x: "é" }, undefined], c: { b: 2, a: 1 } }), '{"a":[3,{"x":"é","z":null},null],"b":1,"c":{"a":1,"b":2}}');
  const any = { v: 12, pieces: [{ id: 1, pts: [{ x: 0.1, y: -2e-7 }], name: "a \"b\"" }], n: [1, 2.5, -0, 1e21], t: true, f: false, s: "" };
  assert.deepStrictEqual(JSON.parse(G.canonJSON(any)), JSON.parse(JSON.stringify(any)), "the same content as JSON.stringify gives");
  assert.strictEqual(G.canonJSON(JSON.parse(G.canonJSON(any))), G.canonJSON(any));
  const TAIL = `
    const save = () => { let f; app.setDownload((n, b) => { f = b; }); app.saveDoc(false); return f; };
    const text = (f) => { let p; app.ev("zipUnpack")(f, (e, q) => { p = q; }); return Object.fromEntries([...p].map(([n, d]) => [n, /json$/.test(n) ? new TextDecoder().decode(d) : String(d.length)])); };
    const one = save(), names = S.pieces.map(p => p.name), steps = app.histSteps().steps.length;
    app.ev("openFile")("one.pdraft", one, null, true);
    const two = save(), A = text(one), B = text(two);
    app.ev("openFile")("two.pdraft", two, null, true); const three = save();
    return { same: one.length === two.length && one.every((v, i) => v === two[i]), third: two.length === three.length && two.every((v, i) => v === three[i]), parts: Object.keys(A), names, steps: [steps, app.histSteps().steps.length],
      sorted: Object.keys(JSON.parse(A["document.json"])).join() === Object.keys(JSON.parse(A["document.json"])).sort().join(),
      differ: Object.keys(A).filter(n => A[n] !== B[n]).map(n => { let i = 0; while (i < A[n].length && A[n][i] === B[n][i]) i++; return n + " at " + i + ": " + A[n].slice(Math.max(0, i - 60), i + 40) + " | " + B[n].slice(Math.max(0, i - 60), i + 40); }) };`;
  const DOCS = {
    // the starter pattern, edited: a moved point, an added point, a rename, a symmetric copy; a step undone
    edited: { script: `
      // the program's own starter has its dart made into the outline (Round F / 7); the one boot-child.js puts in still has a
      // dart object, which a file opened is rid of: made the program's way first, so the document is one the program makes
      app.ev("bakeDarts(S.pieces); S.seams = resolveRefs(S.pieces, S.seams); commit(); S.undo.length = 0; histFit()");
      const at = (q) => app.toS(q), P = () => S.pieces[0];
      app.ev("setTool('edit_pattern')");
      let a = at(P().pts[2]); app.drag(a.x, a.y, a.x + 30, a.y + 10); app.fire("pointerup", { x: a.x + 30, y: a.y + 10 });
      app.ev("push('Add Point'); addPoint(S.pieces[0], 1, 0.5); commit()");
      app.ev("push('Rename'); S.pieces[0].name = 'Front A'; commit()");
      app.key("d", { ctrlKey: true }); app.click(700, 300);
      app.ev("push('Rename'); S.pieces[0].name = 'Front B'; commit()");
      app.undo();` },
    // curves, a graphic with its picture, an annotation, a punch mark, the skirt block with its seams and darts, a zipper, a guide, pins, a place in 3D
    full: { blank: true, script: `
      const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
      app.push("Rectangle"); S.pieces.push(sq("Curved", 0, 0, 300, 400)); app.commit();
      const P = S.pieces[0];
      app.push("Curve"); P.segs[0].curved = true; P.segs[0].cps = [{ x: 100, y: -30 }, { x: 200, y: -20 }]; P.segs[0].c1 = P.segs[0].c2 = null;
      P.segs[2].curved = true; P.segs[2].c1 = { x: 200, y: 440 }; P.segs[2].c2 = { x: 100, y: 440 }; app.commit();
      app.push("Graphic"); const im = app.addImage("dot.png", "data:image/png;base64,AAAA", 1, 1); app.placeGraphic(P, im, { w: 60, h: 60, mode: "outline", left: 30, up: 20 }); app.commit();
      app.push("Annotation"); P.notes.push({ text: "cut 2", x: 150, y: 200 }); P.punches.push({ x: 150, y: 300, d: 10, name: "" }); app.commit();
      app.ev("push('Block'); addBlock('skirt', 'simple', {}, V(600, 0)); commit()");
      app.push("Zipper"); app.libAdd("zipper"); S.seams[2].zip = { name: "Zipper 1", type: app.libOf().zipper[0].id }; S.seams[0].off = true; app.commit();
      app.push("Arrange"); P.p3 = { pos: [0, 1150, 220], q: [0, 0, 0, 1], r: 180 }; P.pins = [{ x: 150, y: 40 }]; P.layer = 1; S.guides.push({ id: 1, p: { x: 10, y: 20 }, a: 1 }); app.commit();
      app.setDensity(16);` },
  };
  for (const k of Object.keys(DOCS)) {
    const r = boot({ blank: !!DOCS[k].blank, script: DOCS[k].script + TAIL });
    assert.deepStrictEqual(r.errors, [], k);
    const o = r.result;
    assert.deepStrictEqual(o.differ, [], k + ": what differs between the first save and the second");
    assert.deepStrictEqual([o.same, o.third, o.sorted], [true, true, true], k + ": the same bytes the second time and the third");
    assert.deepStrictEqual(o.steps[0], o.steps[1], k + ": the history as long as it was");
  }
});

test("a file that is no pattern file, a damaged one and one from a newer version are refused with the reason, and the open document stays", () => {
  const junk = foreignZip([{ name: "readme.txt", data: Buffer.from("hello") }]);
  const newer = foreignZip([{ name: "document.json", data: Buffer.from(JSON.stringify({ v: FV + 1, pieces: [] })      /* (Round H1: this build's version read from the app, FV) ((Round H1a: 32, one past this build's 31) (Round r34: 31, one past this build's 30) ((Round r33b: 30, one past this build's 29) one past this build's: 29 since Round r30, 28 since Round r29, 27 since Round r26, 26 since Round r25, 25 since Round r20, 24 since the r19 follow-up, 23 since Round r18, 22 since Round r17b, 21 since Round build-1, 20 since Round perf-2, 19 since Round r15, 18 since Round r14, 17 since Round r13) */), deflate: false }]);
  const cut = foreignZip([{ name: "document.json", data: Buffer.from(JSON.stringify({ v: 12, pieces: [] })), crc: 1 }]);
  const r = boot({ script: `
    const out = [], open = (name, b64) => { app.ev("openFile")(name, app.ev("bytesOf")(b64), null, true); out.push([toasts[toasts.length-1], S.pieces.length, !!S.dirty]); };
    open("junk.pdraft", ${JSON.stringify(Buffer.from(junk).toString("base64"))}); open("newer.pdraft", ${JSON.stringify(Buffer.from(newer).toString("base64"))}); open("cut.pdraft", ${JSON.stringify(Buffer.from(cut).toString("base64"))});
    app.ev("openFile")("words.pdraft", new TextEncoder().encode("not a pattern at all")); out.push([toasts[toasts.length-1], S.pieces.length]);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result, [["Couldn't open junk.pdraft: it is not a pattern file (no document.json in it)", 1, true], ["Couldn't open newer.pdraft: it was saved by a newer version of this program", 1, true],
    ["Couldn't open cut.pdraft: it is damaged (document.json)", 1, true], ["Couldn't read that — expected a pattern file (.pdraft or .json)", 1]]);
});

/* ---------- everything as it was left: the drape, the camera, the simulation settings, the avatar ---------- */
test("the drape after reopening matches point for point" + (hasMarty ? ", on Marty" : " (Marty is not here: without an avatar)") + "; the camera, the simulation settings, the pins and the avatar's record come back; a changed avatar hash gives the note and keeps the drape", () => {
  const r = boot({ blank: true, three: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 20 }) }, script: `
    return (async () => {
      const out = {};
      app.ev("setLayout")("both");
      if (${hasMarty}) { app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty"); app.ev("setAvatar")({ height: 1800, cell: 20 }); }
      const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
      app.push("Rectangle"); S.pieces.push(sq("Front", 0, 0, 500, 500), sq("Back", 600, 0, 500, 500)); app.commit();
      const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
      app.push("Sew"); S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] });
      A.p3 = { pos: [0, 1150, 260], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1150, -260], q: [0, 1, 0, 0], r: 0 }; A.pins = [{ x: 250, y: 20 }];
      S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 12, self: false, worker: false }); app.commit();
      app.ev("simStart")(); for (let i = 0; i < 40; i++) app.ev("simFrame")(); app.ev("simStop")();
      const cloth = () => S.pieces.map(p => { const it = app.G3.items.get(p.id); return it ? [it.draped, Array.from(it.X)] : null; });
      const before = cloth();
      out.moved = before.map(c => c[0]); out.n = before.map(c => c[1].length/3);
      Object.assign(app.view3d.cam, { az: 0.75, el: 0.2, dist: 3210, tx: 12, ty: 900, tz: -34 });
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
      const d = app.fileDoc(file);
      out.parts = app.fileParts(file); out.scene = d.scene; out.drape = Object.values(app.fileDoc(file).drape).map(x => [typeof x.k, x.n]);
      out.inDoc = JSON.stringify(JSON.parse(new TextDecoder().decode(app.ev("zipUnpack") && (() => { let p; app.ev("zipUnpack")(file, (e, q) => { p = q; }); return p.get("document.json"); })())).drape);
      // away from it: another camera, the cloth thrown back, other settings
      Object.assign(app.view3d.cam, { az: -2, el: 1, dist: 9000, tx: 0, ty: 0, tz: 0 }); app.ev("resetArrangement3")(false); S.cloth = app.normCloth(null);
      out.reset = cloth().map(c => c[0]);
      const same = () => { const now = cloth(); return now.every((c, k) => c && c[0] === true && c[1].length === before[k][1].length && c[1].every((v, i) => v === before[k][1][i])); };
      app.ev("openFile")("draped.pdraft", file, null, true);
      out.opened = [toasts[toasts.length-1], same(), { ...app.view3d.cam }, S.cloth, S.pieces[0].pins, S.pieces.map(p => p.p3.pos)];
      // the same file, but draped on another version of the avatar: its hash differs
      if (S.av) {
        const other = app.fileDoc(file); other.scene.avatar.hash = other.scene.avatar.hash.replace(/.$/, (c) => (c === "0" ? "1" : "0"));
        app.ev("resetArrangement3")(false);
        app.ev("openLoaded")("older-marty.pdraft", other, null, true);
        out.other = [toasts[toasts.length-1], same(), Math.round(S.av.height)];
        // … and as tall as it was left: the record's height is put back
        app.ev("setAvatar")({ height: null }); out.h0 = Math.round(S.av.height);
        app.ev("openFile")("draped.pdraft", file, null, true); out.tall = [Math.round(S.av.height), toasts[toasts.length-1], same()];
      }
      return out;
    })();` }, 120000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.moved, [true, true]); assert.ok(o.n[0] > 200, "a real cloth: " + o.n);
  assert.deepStrictEqual(o.parts.map(p => p[0]), ["document.json", "history.json", "drape.bin"]);
  assert.strictEqual(o.parts[2][1], 12*(o.n[0] + o.n[1]), "drape.bin: three 32-bit floats a point, nothing else");
  assert.deepStrictEqual(o.drape, [["string", o.n[0]], ["string", o.n[1]]]);
  assert.ok(/^\{"\d+":\{"k":"[0-9a-z]+","n":\d+,"o":0\},"\d+":\{"k":"[0-9a-z]+","n":\d+,"o":\d+\}\}$/.test(o.inDoc), "document.json names the drape, it does not hold it: " + o.inDoc);
  assert.deepStrictEqual(o.scene.camera, { az: 0.75, el: 0.2, dist: 3210, tx: 12, ty: 900, tz: -34 });
  assert.deepStrictEqual(o.reset, [false, false]);
  assert.strictEqual(o.opened[0], "Opened draped.pdraft with 3 history steps", "(since Round F the simulation run is one of them)");
  assert.strictEqual(o.opened[1], true, "every point of the drape where it was");
  assert.deepStrictEqual(o.opened[2], { az: 0.75, el: 0.2, dist: 3210, tx: 12, ty: 900, tz: -34 }, "the camera");
  assert.deepStrictEqual(o.opened[3], { res: 25, substeps: 12, self: false, worker: false }, "the simulation settings");
  assert.deepStrictEqual(o.opened[4], [{ x: 250, y: 20 }]); assert.deepStrictEqual(o.opened[5], [[0, 1150, 260], [0, 1150, -260]]);
  if (!hasMarty) return assert.strictEqual(o.scene.avatar, undefined);
  const av = o.scene.avatar;
  assert.deepStrictEqual([av.preset, av.name, av.height, av.pose, av.embed, av.file], ["marty", "Marty", 1800, {}, undefined, undefined], "a built-in avatar: its id, never its file");
  assert.ok(/^[0-9a-z]+-[0-9a-f]{16}$/.test(av.hash), av.hash);
  assert.strictEqual(av.hash, Z.fileHash(new Uint8Array(fs.readFileSync(MARTY))), "the hash is of the avatar file's bytes");
  assert.deepStrictEqual(o.other, ["This drape was made on a different version of Marty; re-simulate to fit", true, 1800], "the note, and the saved drape is kept");
  assert.strictEqual(o.h0, 1875); assert.deepStrictEqual(o.tall, [1800, "Opened draped.pdraft with 3 history steps", true], "the same avatar: stood as tall as it was left, no note, the drape kept");
});

test("a file saved on the Marty of 8 Oct 2026 (the release-bar skirt of that day) opened on the Marty of today" + (hasMarty ? "" : " (Marty is not here: skipped)") + ": the note about a different version, the saved drape kept point for point, and today's Marty left as he stands", () => {
  if (!hasMarty) return;
  const OLD = path.join(__dirname, "files", "v12", "skirt-on-the-marty-of-8-oct.pdraft"), parts = partsOf(fs.readFileSync(OLD)), part = Object.fromEntries(parts.map(p => [p.name, p]));
  const doc = JSON.parse(part["document.json"].data.toString("utf8"));
  assert.deepStrictEqual([doc.v, doc.scene.avatar.preset, doc.scene.avatar.height], [12, "marty", 1766.7], "what the file says it was draped on");
  assert.notStrictEqual(doc.scene.avatar.hash, Z.fileHash(new Uint8Array(fs.readFileSync(MARTY))), "today's Marty is another file");
  const r = boot({ blank: true, three: true, streams: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 20 }) }, script: `
    return (async () => {
      const out = {};
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      const n0 = toasts.length;
      app.ev("openFile")("skirt.pdraft", new Uint8Array(app.read("files/v12/skirt-on-the-marty-of-8-oct.pdraft")), null, true);
      await app.wait(() => toasts.slice(n0).some(t => /different version/.test(t)), "the note");
      out.toasts = toasts.slice(n0);
      out.names = S.pieces.map(p => p.name); out.seams = S.seams.length;
      out.cloth = S.pieces.map(p => { const it = app.G3.items.get(p.id); return [it.draped, it.X.length/3, Array.from(it.X.subarray(0, 6))]; });
      out.sum = S.pieces.map(p => { const it = app.G3.items.get(p.id); let s = 0; for (const v of it.X) s += v; return s; });
      out.av = [S.av.name, Math.round(S.av.height*10)/10, S.avSet.height, JSON.parse(app.storage.get("pdraft:avatar")).height, !!S.avOwn];
      // saved again here, the record is today's Marty
      const file = await new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); });
      const n1 = toasts.length; app.ev("openFile")("again.pdraft", file, null, true); await app.wait(() => toasts.slice(n1).some(t => /^Opened again/.test(t)), "the file to open");
      out.again = toasts.slice(n1);
      return out;
    })();` }, 120000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.toasts.filter(t => !/^Opened/.test(t)), ["This drape was made on a different version of Marty; re-simulate to fit"]);
  assert.deepStrictEqual(o.names, ["Skirt front", "Skirt back", "Skirt back (mirror)", "Skirt waistband"]);
  assert.strictEqual(o.seams, 7 + 4, "its seams, and its four darts made into the outlines with their legs sewn (Round F / 7)");
  // the drape is what the file holds, number for number
  const bin = part["drape.bin"].data, f32 = new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.length)), ids = Object.keys(doc.drape);
  assert.strictEqual(ids.length, 4);
  // Round F / 7: a pattern whose darts were made into its outline as the file opened has its cloth made again, and the drape
  // is carried over to it spot for spot (drapeCarry()): the same points, to rounding of the 32-bit floats; the others exactly
  const darted = (p) => (p.darts || []).length > 0 || !!(p.link && (doc.pieces.find(q => q.id === p.link.of).darts || []).length > 0);
  assert.deepStrictEqual(doc.pieces.map(darted), [true, true, true, false]);
  o.cloth.forEach((c, k) => {
    const d = doc.drape[doc.pieces[k].id], at = d.o/4, carried = darted(doc.pieces[k]);
    assert.deepStrictEqual([c[0], c[1]], [true, d.n], doc.pieces[k].name + ": draped, every point");
    let sum = 0; for (let i = 0; i < 3*d.n; i++) sum += f32[at + i];
    if (carried) {
      c[2].forEach((v, i) => near(v, f32[at + i], 1e-3, doc.pieces[k].name + ": its first points as saved"));
      near(o.sum[k], sum, 1e-3*3*d.n, "and all the others");
    } else {
      assert.deepStrictEqual(c[2], Array.from(f32.subarray(at, at + 6)), "its first points as saved");
      assert.strictEqual(o.sum[k], sum, "and all the others");
    }
  });
  assert.deepStrictEqual(o.av, ["Marty", 1875.5, null, null, false], "today's Marty is not scaled to the old one's height");
  assert.deepStrictEqual(o.again, ["Opened again.pdraft with 15 history steps"], "saved here and opened again: nothing to say");
});

test("the avatar a document was left on, against the one that is here: the same one is stood and posed as it was left; another version gives the note; another avatar is named; a built-in one that is not loaded is loaded", async () => {
  const mk = (av, rec, more) => {
    const S = { av, docAv: null, docAvAsk: false, docAvTried: false, docAvFile: null, avEmbed: null, avSet: { pose: {}, base: null, height: null }, poses: [] }, said = [], set = [], loaded = [];
    const G = load(["avatarCheck", "normAvRec", "avatarRecord", "avatarEmbedded", "avPresetId"], { S, view3d: { ready: () => !(more && more.down) }, toast: (m) => said.push(m), avatarDocSet: (height, pose, base) => { set.push({ height, pose, base }); if (S.av) S.av.height = height || S.av.height0; },
      avatarLoaded: (buf, name, p, quiet) => { loaded.push([name, quiet]); if (more && more.gives) { S.av = more.gives; G.avatarCheck(); } }, DESK: (more && more.desk) || null, avatarPresets: () => Promise.resolve((more && more.presets) || {}),
      fetch: () => Promise.reject(new Error("no network")), toBuffer: (d) => d, clone: (x) => JSON.parse(JSON.stringify(x)), ...((more && more.globals) || {}) });
    S.docAv = G.normAvRec(rec); S.docAvAsk = !!S.docAv;
    return { S, G, said, set, loaded };
  };
  const H = "abc-0123456789abcdef", H2 = "abc-0123456789abcdee", marty = (hash, h) => ({ preset: "marty", name: "Marty", hash, height0: 1767, height: h || 1767, file: { name: "marty.glb", buf: new ArrayBuffer(4) } });
  // the same avatar, the same file: nothing is said
  let t = mk(marty(H), { preset: "marty", name: "Marty", hash: H, height: 1767, pose: {} }); t.G.avatarCheck();
  assert.deepStrictEqual([t.said, t.set, t.S.docAvAsk], [[], [], false]);
  // … stood taller and posed when it was saved: put back
  t = mk(marty(H), { preset: "marty", name: "Marty", hash: H, height: 1820, pose: { armL: [0, 0, 30] } }); t.G.avatarCheck();
  assert.deepStrictEqual(t.set, [{ height: 1820, pose: { armL: [0, 0, 30] }, base: null }]); assert.deepStrictEqual(t.said, []);
  // another version of the same avatar
  t = mk(marty(H2), { preset: "marty", name: "Marty", hash: H, height: 1767, pose: {} }); t.G.avatarCheck();
  assert.deepStrictEqual(t.said, ["This drape was made on a different version of Marty; re-simulate to fit"]);
  t.G.avatarCheck(); assert.strictEqual(t.said.length, 1, "said once");
  // one's own avatar, by its name; another file under that name is another version of it
  const mine = (hash) => ({ preset: null, name: "me.fbx", hash, height0: 1700, height: 1700, file: { name: "me.fbx", buf: new ArrayBuffer(4) } });
  t = mk(mine(H2), { name: "me.fbx", hash: H, height: 1700, pose: {} }); t.G.avatarCheck();
  assert.deepStrictEqual(t.said, ["This drape was made on a different version of me.fbx; re-simulate to fit"]);
  // a different avatar altogether: named, nothing loaded in its place (one's own avatar is on no other machine)
  t = mk(marty(H), { name: "me.fbx", hash: H2, height: 1700, pose: {} }); t.G.avatarCheck();
  assert.deepStrictEqual([t.said.length, t.loaded.length], [1, 0]); assert.ok(/^This document was left on me\.fbx, which could not be loaded here: load it/.test(t.said[0]), t.said[0]);
  t = mk(null, { name: "me.fbx", hash: H2, height: 1700, pose: {} }); t.G.avatarCheck();
  assert.ok(/^This document was left on me\.fbx, which could not be loaded here/.test(t.said[0]), t.said[0]);
  // a built-in avatar that is not the one here: the desktop app loads it, and then compares
  const reads = [];
  t = mk(mine(H2), { preset: "marty", name: "Marty", hash: H, height: 1767, pose: {} }, { presets: { male: { name: "marty.glb", path: "C:\\app\\marty.glb" } }, gives: marty(H2),
    desk: { avatar: { read: (p) => { reads.push(p); return Promise.resolve({ data: new ArrayBuffer(4), name: "marty.glb", path: p }); } } } });
  t.G.avatarCheck(); await new Promise((res) => setImmediate(res)); await new Promise((res) => setImmediate(res));
  assert.deepStrictEqual(reads, ["C:\\app\\marty.glb"]); assert.deepStrictEqual(t.loaded, [["marty.glb", true]]);
  assert.deepStrictEqual(t.said, ["This drape was made on a different version of Marty; re-simulate to fit"], "the Marty of this build is not the Marty the file was draped on");
  // … and where it cannot be read (a page opened from a file): said, once
  t = mk(null, { preset: "marty", name: "Marty", hash: H, height: 1767, pose: {} }); t.G.avatarCheck(); await new Promise((res) => setImmediate(res)); await new Promise((res) => setImmediate(res));
  assert.strictEqual(t.said.length, 1); assert.ok(/^This document was left on Marty, which could not be loaded here: load it/.test(t.said[0]), t.said[0]);
  // the 3D window is not up: nothing yet, the question stays for when an avatar is loaded
  t = mk(null, { preset: "marty", name: "Marty", hash: H, height: 1767, pose: {} }, { down: true }); t.G.avatarCheck();
  assert.deepStrictEqual([t.said, t.S.docAvAsk], [[], true]);
  // with no avatar loaded the file's own record is what is saved again
  assert.deepStrictEqual(t.G.avatarRecord(), { name: "Marty", hash: H, height: 1767, pose: {}, preset: "marty" });
  // junk in a file is no record
  for (const bad of [null, "x", {}, { name: "a" }, { name: "a", hash: "zz" }, { name: "", hash: H }]) assert.strictEqual(t.G.normAvRec(bad), null);
  assert.deepStrictEqual(t.G.normAvRec({ name: "a", hash: H, height: 99999, pose: { armL: [1, 2, "x"], nose: [1, 2, 3] }, preset: "../x", embed: true, file: "avatar/a" }), { name: "a", hash: H, height: null, pose: {} });
});

test("a file's avatar height and pose are put on the avatar for that document only" + (hasMarty ? "" : " (Marty is not here: skipped)") + ": this machine's saved avatar settings stay as they were, and a new document starts from them", () => {
  if (!hasMarty) return;
  const r = boot({ blank: true, three: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 20 }) }, script: `
    return (async () => {
      const out = {}, saved = () => { const o = JSON.parse(app.storage.get("pdraft:avatar")); return [o.height, JSON.stringify(o.pose), o.cell]; }, tall = () => Math.round(S.av.height);
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
      app.push("Rectangle"); S.pieces.push(sq("Front", 0, 0, 300, 300)); app.commit();
      // a document left on Marty stood 1800 mm tall
      app.ev("setAvatar")({ height: 1800 });
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false);
      out.rec = app.fileDoc(file).scene.avatar.height;
      // this machine's own Marty is as his file has him
      app.ev("setAvatar")({ height: null }); out.own = [tall(), saved()];
      // the file is opened: 1800 for this document, and nothing of that is saved for the machine
      app.ev("openFile")("tall.pdraft", file, null, true);
      out.opened = [tall(), saved(), S.avSet.height];
      // a setting that is not the document's is still saved, and does not take the document's height with it
      app.ev("setAvatar")({ cell: 16 }); out.cell = [tall(), saved()];
      // a new document: the machine's own again
      const again = async () => { app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty"); };
      app.ev("newDoc")(true); out.gone = !S.av; await again(); out.fresh = [tall(), saved(), S.avSet.height];
      // opened again, then another file without a record: the machine's own again
      app.ev("openFile")("tall.pdraft", file, null, true); out.again = tall();
      const plain = app.fileDoc(file); delete plain.scene.avatar; app.ev("openLoaded")("plain.pdraft", plain, null, true); out.plainGone = !S.av; await again(); out.plain = [tall(), saved()];
      // with the file open, a height set by hand is the user's own: it is saved, and a new document keeps it
      app.ev("openFile")("tall.pdraft", file, null, true); app.ev("setAvatar")({ height: 1700 }); out.byHand = [tall(), saved()];
      app.ev("newDoc")(true); await again(); out.kept = [tall(), saved()];
      return out;
    })();` }, 120000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.rec, 1800); assert.deepStrictEqual(o.own, [1875, [null, "{}", 20]]);
  assert.deepStrictEqual(o.opened, [1800, [null, "{}", 20], 1800], "the avatar stands as the file left it; what is saved for this machine has not changed");
  assert.deepStrictEqual(o.cell, [1800, [null, "{}", 16]]);
  assert.deepStrictEqual([o.gone, o.plainGone], [true, false], "a new document has no avatar; a file that names none leaves the one that is there");
  assert.deepStrictEqual(o.fresh, [1875, [null, "{}", 16], null], "added again, he stands as this machine has him");
  assert.strictEqual(o.again, 1800); assert.deepStrictEqual(o.plain, [1875, [null, "{}", 16]]);
  assert.deepStrictEqual(o.byHand, [1700, [1700, "{}", 16]], "set by hand: the user's own from now on"); assert.deepStrictEqual(o.kept, [1700, [1700, "{}", 16]]);
});

// (Round r31 / 1, the maintainer's decision of 4 Nov: one's own avatar is always kept in the pattern file, with no question; until then
// it was off by default and asked before it was switched on, Avatar ▸ Keep This Avatar in the Pattern File, which is gone)
test("one's own avatar is always kept in the pattern file" + (hasMarty ? "" : " (Marty is not here: skipped)") + ": read back from the file, saved into it again, and never a built-in avatar", () => {
  if (!hasMarty) return;
  const size = fs.statSync(MARTY).size;
  const r = boot({ blank: true, three: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 20 }) }, script: `
    return (async () => {
      const out = {}, body = app.read("../assets/avatar/presets/marty.glb");
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(body, "my-scan.glb", null, true, true); await app.wait(() => S.av, "the avatar");
      const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
      app.push("Rectangle"); S.pieces.push(sq("Front", 0, 0, 300, 300)); app.commit();
      const save = () => { let f = null; app.setDownload((n, b) => { f = b; }); app.saveDoc(false); return f; };
      const asked = []; app.modalAnswer = (title) => { asked.push(title); return "cancel"; };
      let f = save();
      const rec = app.fileDoc(f).scene.avatar;
      out.kept = [app.fileParts(f), rec.embed, rec.file, rec.preset, asked.length, !!app.MENUS.avatar().find(x => /Keep This Avatar/.test(x.n))];
      // another session with no avatar: it is read out of the file, and saved into it again
      app.ev("removeAvatar")(true); out.gone = !S.av;
      app.ev("openFile")("with-avatar.pdraft", f, null, true); await app.wait(() => S.av, "the avatar from the file");
      out.back = [S.av.name, S.av.hash === rec.hash, app.storage.has("pdraft-avatar")];
      out.again = app.fileParts(save()).map(p => p[0]);
      // a built-in avatar is never put in a file
      app.ev("avatarLoaded")(body, "marty.glb", null, true); await app.wait(() => S.av && S.av.preset === "marty", "Marty");
      out.preset = [app.fileParts(save()).map(p => p[0]), app.fileDoc(save()).scene.avatar.embed];
      return out;
    })();` }, 120000);
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.kept[0].map(p => p[0]), ["document.json", "history.json", "avatar/my-scan.glb"]); assert.strictEqual(o.kept[0][2][1], size, "the file itself, byte for byte");
  assert.deepStrictEqual(o.kept.slice(1), [true, "avatar/my-scan.glb", null, 0, false], "no question, no menu item");
  assert.strictEqual(o.gone, true); assert.deepStrictEqual(o.back, ["my-scan.glb", true, false], "loaded from the file, not remembered on this machine");
  assert.deepStrictEqual(o.again, ["document.json", "history.json", "avatar/my-scan.glb"]);
  assert.deepStrictEqual(o.preset, [["document.json", "history.json"], null], "a built-in avatar: its id, no file");
});

module.exports = T;
