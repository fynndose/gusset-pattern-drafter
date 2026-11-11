// Roadmap R4 (8 Oct 2026). Batch 1: the 3D window starting with the page, the cloth's
// vertex buffer not being deleted under it, and what is yellow and what is blue in Edit Pattern.
"use strict";
const { oldSizeRun } = require("./harness");      // (Round r33 / 4) the size run every document had before r33: a document starts with none since (harness.js)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { load, appSource } = require("./harness");
const { three } = require("./three-env");
const C = require("../drafter-sim.js");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  // the options go in a file: a script that carries a whole pattern file is too long for a command line
  const f = path.join(require("os").tmpdir(), "pdraft-boot-" + process.pid + "-" + (boot.n = (boot.n || 0) + 1) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 20000, maxBuffer: 1 << 28 });
  try { fs.unlinkSync(f); } catch (e) {}
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 20 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
// run a script in the booted app; fails on any error it logged
function run(script, opt) {
  const r = boot({ ...(opt || {}), script });
  assert.deepStrictEqual(r.errors, [], "errors: " + r.errors.join(" | "));
  return r;
}

/* ---------------- batch 1 ---------------- */
test("B1 the 3D window left open last time starts once the page has loaded (three.js comes after the app script)", () => {
  // (Round r23 / 1) every start shows both windows, so the 3D window always waits for three.js
  const r = run("return [app.winFire('load'), app.ev('S.ui.layout')]");
  // (Round r24) two load handlers: this one and the one that says the program has started (the browser's splash goes then)
  assert.deepStrictEqual(r.result, [2, "both"], "the load handlers, and they run without error");

  // the order the page loads its scripts in is what makes this necessary
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8");
  assert.ok(html.indexOf("pattern-drafter.js") < html.indexOf("vendor/three.min.js"));
});

test("B1 lines that borrow the cloth's points give them back before they are disposed (the cloth no longer stops moving)", () => {
  const { THREE } = three();
  const S = { pieces: [], seams: [], stitches: [], images: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, unit: "mm", dec: 1, ui: { render: "front", layout: "both", show3d: {} }, cloth: null, lib: null, av: null, avSet: { cell: 16 },
    undo: [], redo: [], un: [], rn: [], sewCheck: { on: false, useLen: true, len: 2, useRatio: false, ratio: 2 } };
  const groups = {}, view3d = { group: (n) => groups[n] || (groups[n] = new THREE.Group()), ask() {}, ready: () => true, cam: { dist: 5000 }, tool() {}, camera: () => null, loop() {} };
  const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }) });
  const G = load(["V", "mkShape", "mkPiece", "makeSeam", "normCloth", "normLib", "garmentSync", "garmentLines", "G3", "dropItem"],
    { S, THREE, SIM3D: C, view3d, document: { createElement: fakeCanvas }, Image: undefined, ui: () => {}, draw: () => {}, toast: () => {}, refreshRail: () => {}, note3d: () => {} });
  S.cloth = G.normCloth(null); S.lib = G.normLib(null);
  const rect = (x) => { const p = G.mkPiece("r", G.mkShape([G.V(x, 0), G.V(x + 200, 0), G.V(x + 200, 300), G.V(x, 300)], true)); S.pieces.push(p); return p; };
  const a = rect(0), b = rect(300);
  G.garmentSync();
  const it = G.G3.items.get(a.id), pos = it.obj.geometry.attributes.position;
  assert.strictEqual(it.line.geometry.attributes.position, pos, "the outline is drawn from the cloth's own points");
  const old = groups.unsewn.children.slice();
  assert.ok(old.length === 2 && old[0].geometry.attributes.position === pos);
  // what three.js's renderer does on "dispose": it deletes the buffer of every attribute the geometry still holds
  const deleted = [];
  for (const o of old) o.geometry.addEventListener("dispose", (e) => { for (const k of Object.keys(e.target.attributes)) deleted.push(e.target.attributes[k]); });
  S.seams.push(G.makeSeam(S.seams, { piece: a.id, shape: 0, sids: [a.segs[1].id], t0: 0, t1: 1, rev: false }, { piece: b.id, shape: 0, sids: [b.segs[3].id], t0: 0, t1: 1, rev: true }));
  G.garmentLines();
  assert.ok(groups.unsewn.children.every(o => !old.includes(o)), "the unsewn edges were drawn again");
  assert.ok(!deleted.includes(pos), "the cloth's points were not deleted with the old lines");
  assert.strictEqual(it.obj.geometry.attributes.position, pos);
  // taking a pattern's cloth away: its own points go once, with the cloth
  const gone = [];
  it.line.geometry.addEventListener("dispose", (e) => gone.push(...Object.keys(e.target.attributes)));
  G.dropItem(it);
  assert.deepStrictEqual(gone, []);
});

test("B1 Edit Pattern: a selected line stays yellow under the pointer, hover blue is for unselected lines, the rest keeps its colour", () => {
  const strokes = [];
  const ctx = new Proxy({ stroke() { strokes.push([this.strokeStyle, this.lineWidth]); } }, { get: (t, k) => (k in t ? t[k] : () => ({ width: 10 })), set: (t, k, v) => { t[k] = v; return true; } });
  const S = { pieces: [], seams: [], sel: [], tool: "edit_pattern", hover: null, drag: null, selSeg: -1, selPt: -1, selInt: -1, selKind: "outline", view: { s: 1, x: 0, y: 0 }, mouse: { sx: 0, sy: 0 }, show: { length: false, angle: false }, unit: "mm", dec: 1, nextSegId: 1, nextShapeId: 1, nextId: 1, prefs: null, walk: null };
  const G = load(["V", "mkShape", "mkPiece", "drawHover", "partSel", "segSelected", "C_SEL", "C_HOVER"], { S, ctx, anglesShown: () => true, walkLive: () => false, tag: () => {} });
  const p = G.mkPiece("r", G.mkShape([G.V(0, 0), G.V(200, 0), G.V(200, 300), G.V(0, 300)], true));
  S.pieces.push(p); S.sel = [p.id];
  const cols = () => { strokes.length = 0; G.drawHover(); return strokes.map(s => s[0]); };
  S.selSeg = 1; S.hover = { k: "seg", p, sh: p, i: 1, t: 0.5, kind: "outline" };
  assert.deepStrictEqual(cols(), [G.C_SEL], "selected and hovered: yellow only");
  S.hover = { k: "seg", p, sh: p, i: 2, t: 0.5, kind: "outline" };
  assert.deepStrictEqual(cols(), [G.C_SEL, G.C_HOVER], "another line under the pointer is blue, the selected one still yellow");
  S.hover = null;
  assert.deepStrictEqual(cols(), [G.C_SEL]);
  S.selSeg = -1; S.hover = { k: "seg", p, sh: p, i: 2, t: 0.5, kind: "outline" };
  assert.deepStrictEqual(cols(), [G.C_HOVER]);
  // the pattern's own outline: yellow as a whole only when no line or point of it is picked
  assert.strictEqual(G.partSel(), false);
  S.selSeg = 0; assert.strictEqual(G.partSel(), true);
  S.selSeg = -1; S.selPt = 2; assert.strictEqual(G.partSel(), true);
  S.tool = "transform_pattern"; assert.strictEqual(G.partSel(), false, "Transform Pattern selects whole patterns");
  assert.ok(/whole \? C_SEL : C_OUT/.test(appSource()), "drawPiece paints the outline yellow only for a whole-pattern selection");
});

/* ---------------- batch 2: selected lines, the line menu, Merge ---------------- */
function doc() {
  const S = { pieces: [], seams: [], stitches: [], measures: [], lineLinks: [], selMore: [], guides: [], sel: [], grading: null, tool: "edit_pattern", selSeg: -1, selPt: -1, selInt: -1, selKind: "outline",
    show: { lockAll: false, links: true }, unit: "mm", dec: 1, nextSegId: 1, nextShapeId: 1, nextId: 1, undo: [], redo: [], un: [], rn: [], offDist: 10 };
  const toasts = [];
  const G = load(["V", "mkShape", "mkPiece", "addChild", "mergePatterns", "matchUp", "revPart", "partWithout", "makeSeam", "seamInfo", "seamEnds", "validSeams", "resolveRefs", "segLen", "segPt", "signedArea", "flatten", "outlineProblem",
    "dartGeom", "measureInfo", "mkAnchor", "deleteLine", "offsetOutlineSeg", "unfoldOutlineOnly", "unfold", "sewMirroredHalf", "mirroredLine", "alignLines", "rollUp", "linkLines", "unlinkLines", "syncLinks", "normLinks", "linkOf",
    "selLines", "setLines", "toggleLine", "lineAt", "lineRef", "mapPiece", "reflector", "pieceWind", "setSegLength", "byId", "clone", "defaultGrading", "ensureGrade", "notchMarks", "stitchLine", "validStitches"],
    { S, toast: (m) => toasts.push(m), ui: () => {}, draw: () => {}, refreshToggles: () => {} });
  S.grading = oldSizeRun();
  const rect = (name, x, y, w, h, back) => {
    const pts = [G.V(x, y), G.V(x + w, y), G.V(x + w, y + h), G.V(x, y + h)];
    const p = G.mkPiece(name, G.mkShape(back ? [pts[0], pts[3], pts[2], pts[1]] : pts, true)); S.pieces.push(p); return p;
  };
  return { S, G, rect, toasts, area: (p) => Math.abs(G.signedArea(G.flatten(p, 26))) };
}
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= (tol || 1e-6), (msg || "") + ": " + a + " vs " + b);
const samePt = (a, b, msg) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6, (msg || "point") + ": " + JSON.stringify(a) + " vs " + JSON.stringify(b));
// the outline segment of p that runs between two places (either way round)
const segBetween = (p, a, b) => p.segs.findIndex((s, i) => { const u = p.pts[i], v = p.pts[(i + 1) % p.pts.length], d = (q, r) => Math.hypot(q.x - r[0], q.y - r[1]) < 1e-6; return (d(u, a) && d(v, b)) || (d(u, b) && d(v, a)); });

for (const back of [false, true]) test("B2 Merge, the second outline running " + (back ? "the other way round" : "the same way round") + ": one pattern, everything on it where it was", () => {
  const { S, G, rect, area } = doc();
  const A = rect("Front", 0, 0, 200, 300), B = rect("Side", 500, 100, 150, 300, back);
  const ia = segBetween(A, [200, 0], [200, 300]), ib = segBetween(B, [500, 100], [500, 400]), top = segBetween(B, [500, 100], [650, 100]), far = segBetween(B, [650, 100], [650, 400]);
  // on the second pattern: a notch, seam allowance, a dart, an internal line, a note; a seam top to top, a seam between the two merged edges, a measurement, a topstitch
  B.segs[top].notches.push(0.25); B.segs[far].sa = 10;
  B.darts.push({ sid: B.segs[far].id, t: 0.4, width: 20, depth: 60, folded: false, cap: 1 });
  G.addChild(B, "internals", G.mkShape([G.V(520, 150), G.V(620, 350)], false)); B.notes = [{ text: "side", x: 560, y: 200 }];
  const atop = segBetween(A, [0, 0], [200, 0]);
  S.seams.push(G.makeSeam(S.seams, { piece: A.id, sid: A.segs[atop].id, t0: 0.2 }, { piece: B.id, sid: B.segs[top].id, t1: 0.7, rev: true }));
  S.seams.push(G.makeSeam(S.seams, { piece: A.id, sid: A.segs[ia].id }, { piece: B.id, sid: B.segs[ib].id }));
  S.measures.push({ id: 1, a: G.mkAnchor(B, B, top), b: G.mkAnchor(B, B, far), kind: "line" });
  S.stitches.push({ id: 1, name: "t", part: { piece: B.id, shape: 0, sids: [B.segs[far].id], t0: 0, t1: 1, rev: false }, offset: 3, extS: true, extE: false });
  // where things are before, put through the move the merge will make
  const { T } = G.matchUp(A, ia, B, ib);
  const notchW = T(G.segPt(B, top, 0.25)), apexW = T(G.dartGeom(B, B.darts[0]).apex), ends = G.seamEnds(S.seams[0], S.pieces).map(pr => [pr[0], T(pr[1])]), inf0 = G.seamInfo(S.seams[0], S.pieces);
  const mW = G.measureInfo(S.measures[0], S.pieces), lineW = G.stitchLine(S.stitches[0], S.pieces).map(T), intW = B.internals[0].pts.map(T), ids = [...A.segs, ...B.segs].map(s => s.id);
  const farId = B.segs[far].id, topId = B.segs[top].id, bid = B.id;

  assert.strictEqual(G.mergePatterns(A, ia, B, ib), "");
  assert.deepStrictEqual(S.pieces.map(p => p.name), ["Front"]);
  assert.strictEqual(A.pts.length, 6); assert.strictEqual(A.segs.length, 6);
  close(area(A), 200*300 + 150*300, 1e-6, "area");
  assert.strictEqual(G.outlineProblem(A), "");
  const b = G.flatten(A, 8).reduce((m, q) => [Math.min(m[0], q.x), Math.max(m[1], q.x), Math.min(m[2], q.y), Math.max(m[3], q.y)], [1e9, -1e9, 1e9, -1e9]);
  assert.deepStrictEqual(b.map(v => +v.toFixed(6)), [0, 350, 0, 300], "the second pattern was laid against the first, which did not move");
  assert.strictEqual(new Set(A.segs.map(s => s.id)).size, 6);
  assert.ok(A.segs.every(s => ids.includes(s.id)), "the segments keep their ids");
  // notch, seam allowance, dart
  const it = A.segs.findIndex(s => s.id === topId), ifar = A.segs.findIndex(s => s.id === farId);
  samePt(G.segPt(A, it, A.segs[it].notches[0]), notchW, "notch");
  assert.strictEqual(A.segs[ifar].sa, 10);
  assert.strictEqual(A.darts.length, 1); samePt(G.dartGeom(A, A.darts[0]).apex, apexW, "dart point");
  // internal line, note, the old edge as a baseline
  A.internals[0].pts.forEach((q, k) => samePt(q, intW[k], "internal line"));
  assert.strictEqual(A.notes.length, 1);
  assert.strictEqual(A.bases.length, 1); samePt(A.bases[0].pts[0], { x: 200, y: A.bases[0].pts[0].y }); close(G.segLen(A.bases[0], 0), 300);
  // the seam between the two merged edges is gone; the other is now a seam of the pattern to itself, the same stretch sewn the same way
  S.seams = G.resolveRefs(S.pieces, S.seams);
  assert.strictEqual(S.seams.length, 1);
  assert.ok([...S.seams[0].a, ...S.seams[0].b].every(x => x.piece === A.id));
  const inf = G.seamInfo(S.seams[0], S.pieces), e2 = G.seamEnds(S.seams[0], S.pieces);
  close(inf.la, inf0.la); close(inf.lb, inf0.lb);
  e2.forEach((pr, k) => { samePt(pr[0], ends[k][0], "seam end a" + k); samePt(pr[1], ends[k][1], "seam end b" + k); });
  // measurement and topstitch
  const m2 = G.measureInfo(S.measures[0], S.pieces);
  assert.ok(m2 && S.measures[0].a.piece === A.id); close(m2.len, mW.len);
  S.stitches = G.validStitches(S.stitches, S.pieces);
  assert.strictEqual(S.stitches.length, 1);
  const l2 = G.stitchLine(S.stitches[0], S.pieces), same = (u, v) => u.length === v.length && u.every((q, k) => Math.hypot(q.x - v[k].x, q.y - v[k].y) < 1e-6);
  assert.ok(same(l2, lineW) || same(l2, lineW.slice().reverse()), "the topstitch runs where it ran");
  assert.ok(!S.pieces.some(p => p.id === bid));
});

test("B2 Merge: a pasted copy (the same segment ids) gets new ids and its seams follow; unequal lines leave a step; what can't be merged is refused untouched", () => {
  let d = doc();
  const A = d.rect("A", 0, 0, 200, 300), B = d.G.clone(A);
  B.id = d.S.nextId++; B.name = "B"; d.G.mapPiece(B, (q) => d.G.V(q.x + 400, q.y)); d.S.pieces.push(B);
  d.S.seams.push(d.G.makeSeam(d.S.seams, { piece: A.id, sid: A.segs[0].id }, { piece: B.id, sid: B.segs[2].id }));
  assert.strictEqual(d.G.mergePatterns(A, 1, B, 3), "");
  assert.strictEqual(new Set(A.segs.map(s => s.id)).size, A.segs.length, "no id twice");
  d.S.seams = d.G.resolveRefs(d.S.pieces, d.S.seams);
  const inf = d.G.seamInfo(d.S.seams[0], d.S.pieces);
  close(inf.la, 200); close(inf.lb, 200);
  assert.notStrictEqual(d.S.seams[0].a[0].sids[0], d.S.seams[0].b[0].sids[0], "the two sides are two segments");
  close(d.area(A), 2*200*300);

  d = doc();
  const P = d.rect("P", 0, 0, 200, 300), Q = d.rect("Q", 400, 0, 100, 240);
  assert.strictEqual(d.G.mergePatterns(P, 1, Q, 3), "");
  assert.strictEqual(P.pts.length, 4 + 4 - 2 + 1, "one more point: the step");
  close(d.area(P), 200*300 + 100*240); assert.strictEqual(d.G.outlineProblem(P), "");
  assert.ok(/differ by 60/.test(d.G.mergePatterns.note));
  assert.strictEqual(P.bases.length, 2, "both old edges are kept when they are not the same line");

  d = doc();
  const X = d.rect("X", 0, 0, 200, 300), Y = d.rect("Y", 400, 0, 200, 300), before = JSON.stringify(d.S.pieces);
  Y.link = { of: X.id, kind: "instance", m: [1, 0, 0, 1, 400, 0] };
  assert.ok(/linked copy/.test(d.G.mergePatterns(X, 1, Y, 3)));
  delete Y.link; Y.lock = true; assert.ok(/locked/.test(d.G.mergePatterns(X, 1, Y, 3)));
  Y.lock = false;
  assert.ok(/two patterns/.test(d.G.mergePatterns(X, 1, X, 3)));
  assert.strictEqual(JSON.stringify(d.S.pieces), before, "nothing was changed by the refusals");
  // an L-shaped pattern merged where it would lie over itself
  const L = d.G.mkPiece("L", d.G.mkShape([d.G.V(0, 0), d.G.V(300, 0), d.G.V(300, 100), d.G.V(100, 100), d.G.V(100, 300), d.G.V(0, 300)], true)); d.S.pieces.push(L);
  const Z = d.rect("Z", 600, 0, 250, 250), n = d.S.pieces.length;
  assert.ok(/would not be a pattern/.test(d.G.mergePatterns(L, 3, Z, 3)), "laid on the inside corner it crosses the other arm");
  assert.strictEqual(d.S.pieces.length, n);
});

test("B2 seam parts: turned round they cover the same stretch; without a segment what is left stays in sewing order", () => {
  const { G } = doc();
  assert.deepStrictEqual(G.revPart({ piece: 1, shape: 0, sids: [4, 5, 6], t0: 0.25, t1: 0.5, rev: false }), { piece: 1, shape: 0, sids: [6, 5, 4], t0: 0.5, t1: 0.75, rev: true });
  assert.deepStrictEqual(G.revPart(G.revPart({ piece: 1, shape: 0, sids: [4], t0: 0.2, t1: 0.9, rev: true })).t0.toFixed(6), "0.200000");
  const part = { piece: 1, shape: 0, sids: [4, 5, 6], t0: 0.25, t1: 0.5, rev: false };
  assert.deepStrictEqual(G.partWithout(part, 5).map(x => [x.sids, x.t0, x.t1]), [[[4], 0.25, 1], [[6], 0, 0.5]]);
  assert.deepStrictEqual(G.partWithout({ ...part, rev: true }, 5).map(x => x.sids), [[6], [4]], "against the shape's direction the far piece is sewn first");
  assert.deepStrictEqual(G.partWithout(part, 4).map(x => [x.sids, x.t0, x.t1]), [[[5, 6], 0, 0.5]]);
  assert.strictEqual(G.partWithout(part, 9)[0], part);
  assert.deepStrictEqual(G.partWithout({ ...part, sids: [5] }, 5), []);
});

test("B2 several lines selected: Shift+click adds and removes across patterns; the first picked stays first", () => {
  const { S, G, rect } = doc();
  const A = rect("A", 0, 0, 200, 300), B = rect("B", 400, 0, 200, 300);
  const h = (p, i) => ({ k: "seg", p, sh: p, i, t: 0.5, kind: "outline" });
  G.setLines([{ p: A, sh: A, i: 1, kind: "outline", int: -1 }]);
  G.toggleLine(h(B, 3)); G.toggleLine(h(B, 0));
  assert.deepStrictEqual(G.selLines().map(x => [x.p.name, x.i]), [["A", 1], ["B", 3], ["B", 0]]);
  assert.deepStrictEqual(S.sel, [A.id], "the first line's pattern is the selected pattern");
  G.toggleLine(h(B, 3));
  assert.deepStrictEqual(G.selLines().map(x => [x.p.name, x.i]), [["A", 1], ["B", 0]]);
  G.toggleLine(h(A, 1));
  assert.deepStrictEqual(G.selLines().map(x => [x.p.name, x.i]), [["B", 0]], "taking the first out promotes the next");
  assert.deepStrictEqual(S.sel, [B.id]);
  // extras are kept by id: they survive a point being added before them, and go with their segment
  G.toggleLine(h(A, 2));
  const id = A.segs[2].id;
  A.pts.splice(1, 0, G.V(100, 0)); A.segs.splice(1, 0, { id: S.nextSegId++, curved: false, c1: null, c2: null, sa: 0, notches: [] });
  assert.strictEqual(G.selLines()[1].sh.segs[G.selLines()[1].i].id, id);
  S.tool = "transform_pattern";
  assert.strictEqual(G.selLines().length, 1, "another tool: only the one selection is left");
  assert.deepStrictEqual(S.selMore, []);
});

test("B2 line commands: Delete Line, Offset Pattern Outline, Unfold Pattern Outline Only, sewing repeated on an unfolded half", () => {
  let d = doc();
  const A = d.rect("A", 0, 0, 200, 300), keep = A.segs.map(s => s.id);
  // (Round r15 / 6: an outline line can't be deleted from its pattern, as the reference shows: the whole pattern goes (the caller
  // takes it out); it used to join the line's two ends at its middle)
  assert.strictEqual(d.G.deleteLine(A, A, 1), "pattern");
  assert.strictEqual(A.pts.length, 4, "the pattern itself is left to the caller"); assert.deepStrictEqual(A.segs.map(s => s.id), keep);
  // an internal line of three segments: the middle one out leaves two lines
  const ln = d.G.mkShape([d.G.V(10, 10), d.G.V(50, 10), d.G.V(50, 50), d.G.V(90, 50)], false); d.G.addChild(A, "internals", ln);
  d.G.deleteLine(A, ln, 1);
  assert.deepStrictEqual(A.internals.map(c => c.pts.length), [2, 2]); assert.notStrictEqual(A.internals[0].id, A.internals[1].id);
  d.G.deleteLine(A, A.internals[0], 0); assert.strictEqual(A.internals.length, 1);

  d = doc();
  const R = d.rect("R", 0, 0, 200, 300);
  assert.strictEqual(d.G.offsetOutlineSeg(R, 1, 25), true);
  assert.deepStrictEqual(R.pts.map(q => [q.x, q.y]), [[0, 0], [225, 0], [225, 300], [0, 300]], "the right edge moved out, its neighbours got longer");
  d.G.offsetOutlineSeg(R, 1, -25); close(d.area(R), 60000);
  // a slanted neighbour keeps its direction
  const Tz = d.G.mkPiece("T", d.G.mkShape([d.G.V(0, 0), d.G.V(200, 0), d.G.V(300, 300), d.G.V(0, 300)], true)); d.S.pieces.push(Tz);
  d.G.offsetOutlineSeg(Tz, 2, 30);
  close(Tz.pts[2].y, 330); close(Tz.pts[2].x, 310, 1e-9, "slid along the slanted side"); close(Tz.pts[3].x, 0);
  assert.strictEqual(d.G.offsetOutlineSeg(R, 1, -500), false, "an offset that turns the pattern inside out is refused");
  close(d.area(R), 60000);

  d = doc();
  const H = d.rect("H", 0, 0, 100, 300);
  d.G.addChild(H, "internals", d.G.mkShape([d.G.V(20, 50), d.G.V(80, 50)], false));
  d.S.seams.push(d.G.makeSeam(d.S.seams, { piece: H.id, sid: H.segs[0].id }, { piece: H.id, sid: H.segs[2].id }));
  const only = d.G.unfoldOutlineOnly(H, 3);
  close(d.area(only), 2*100*300); assert.strictEqual(only.internals.length, 1, "what is inside was not mirrored"); assert.strictEqual(only.half, undefined);
  const full = d.G.unfold(H, 3);
  Object.assign(H, { pts: full.pts, segs: full.segs, internals: full.internals, bases: full.bases, darts: full.darts, half: full.half });
  assert.strictEqual(d.G.sewMirroredHalf(H), 1);
  const [s1, s2] = d.S.seams.map(sm => d.G.seamInfo(sm, d.S.pieces)), e1 = d.G.seamEnds(d.S.seams[0], d.S.pieces), e2 = d.G.seamEnds(d.S.seams[1], d.S.pieces), M = d.G.reflector(H.pts[d.G.clone(H.segs).findIndex(s => s.id === H.half.s)], H.pts[H.segs.findIndex(s => s.id === H.half.m)]);
  close(s2.la, s1.la); close(s2.lb, s1.lb);
  e1.forEach((pr, k) => { samePt(M(pr[0]), e2[k][0], "mirrored seam end"); samePt(M(pr[1]), e2[k][1], "mirrored seam end"); });
});

test("B2 line commands: Duplicate as Mirrored Internal Line, Align, Roll Up, Match Up", () => {
  const { S, G, rect, area } = doc();
  const A = rect("A", 0, 0, 200, 300);
  G.addChild(A, "internals", G.mkShape([G.V(20, 40), G.V(60, 90)], false));
  const k = G.mirroredLine(A, { p: A, sh: A.internals[0], i: 0, kind: "internal", int: 0 }, G.V(100, 0), G.V(100, 300));
  assert.deepStrictEqual(A.internals[k].pts.map(q => [q.x, q.y]), [[180, 40], [140, 90]]);
  const k2 = G.mirroredLine(A, { p: A, sh: A, i: 0, kind: "outline", int: -1 }, G.V(0, 150), G.V(200, 150));
  assert.deepStrictEqual(A.internals[k2].pts.map(q => [q.x, q.y]), [[0, 300], [200, 300]]); assert.strictEqual(A.internals[k2].closed, false);
  // Align: a slanted line made upright, on its leftmost point
  const Tz = G.mkPiece("T", G.mkShape([G.V(0, 0), G.V(200, 0), G.V(260, 300), G.V(0, 300)], true)); S.pieces.push(Tz);
  assert.strictEqual(G.alignLines([{ p: Tz, sh: Tz, i: 1, kind: "outline" }], "left"), true);
  assert.deepStrictEqual([Tz.pts[1].x, Tz.pts[2].x], [200, 200]);
  assert.strictEqual(G.alignLines([{ p: Tz, sh: Tz, i: 1, kind: "outline" }, { p: Tz, sh: Tz, i: 3, kind: "outline" }], "center"), false, "both sides on one line is no pattern: refused");
  assert.deepStrictEqual([Tz.pts[1].x, Tz.pts[3].x], [200, 0]);
  // Roll Up: fold lines parallel to the hem, inside the pattern, valley then mountain
  const n0 = A.internals.length;
  assert.strictEqual(G.rollUp(A, 2, 30, 2), 2);
  const made = A.internals.slice(n0);
  assert.deepStrictEqual(made.map(l => l.fold), ["valley", "mountain"]);
  assert.deepStrictEqual(made.map(l => l.pts.map(q => +q.y.toFixed(6))), [[270, 270], [240, 240]]);
  assert.deepStrictEqual(made.map(l => l.pts.map(q => +q.x.toFixed(6)).sort((a, b) => a - b)), [[0, 200], [0, 200]], "run out to the outline");
  // Match Up: the second pattern laid against the first line, nothing joined, no overlap
  const B = rect("B", 500, 50, 150, 300), a0 = area(B);
  G.mapPiece(B, G.matchUp(A, 1, B, 3).T);
  close(area(B), a0); close(Math.min(...B.pts.map(q => q.x)), 200); close(Math.max(...B.pts.map(q => q.x)), 350);
  assert.strictEqual(S.pieces.length, 3);
});

test("B2 Link Lines: linked lines keep one length, whichever of them is edited; a link is saved and survives junk", () => {
  const { S, G, rect } = doc();
  const A = rect("A", 0, 0, 200, 300), B = rect("B", 400, 0, 150, 240);
  const la = { p: A, sh: A, i: 1, kind: "outline" }, lb = { p: B, sh: B, i: 3, kind: "outline" };
  assert.strictEqual(G.linkLines([la]), false);
  G.linkLines([la, lb]); G.syncLinks();
  close(G.segLen(B, 3), 300, 1e-6, "the second takes the first's length");
  assert.strictEqual(G.linkOf(lb), S.lineLinks[0]);
  // edit the second: the first follows
  G.setSegLength(B, 3, 260, 1, false); G.syncLinks();
  close(G.segLen(A, 1), 260); close(S.lineLinks[0].len, 260);
  // edit the first
  A.pts[2] = G.V(200, 320); G.syncLinks();
  close(G.segLen(B, 3), 320);
  // nothing edited: nothing moves
  const was = JSON.stringify(S.pieces); G.syncLinks(); assert.strictEqual(JSON.stringify(S.pieces), was);
  // a line that is gone leaves its link, and a link of one is no link
  B.segs[3].id = 999; G.syncLinks(); assert.deepStrictEqual(S.lineLinks, []);
  assert.deepStrictEqual(G.normLinks([{ m: [{ pid: 1, sid: 2 }, { pid: 3, sid: 4, shape: 7 }], len: 12 }, { m: [{ pid: 1, sid: 2 }] }, null, { m: "x" }]), [{ id: 1, len: 12, m: [{ pid: 1, shape: 0, sid: 2 }, { pid: 3, shape: 7, sid: 4 }] }]);
  assert.deepStrictEqual(G.normLinks(undefined), []);
});

test("B2 in the booted app: Shift+click picks lines on two patterns, the line menu has its commands in the expected order, Merge joins them and undo parts them", () => {
  const r = run(`
    const out = {};
    // a second pattern beside the starter, with an upright left edge
    app.ev("(() => { const b = bboxOf([S.pieces[0]]); const p = mkPiece('Side', mkShape([V(b.x1 + 150, b.y0), V(b.x1 + 350, b.y0), V(b.x1 + 350, b.y0 + 300), V(b.x1 + 150, b.y0 + 300)], true)); S.pieces.push(p); commit(); fitAll(); })()");
    const A = S.pieces[0], B = S.pieces[1], mid = (p, i) => app.toS(app.segPt(p, i, 0.5));
    app.ev("setTool('edit_pattern')");
    // the starter's straight centre front is segment 6 (index 5)
    let a = mid(A, 5), b = mid(B, 3);
    app.click(a.x, a.y);
    out.one = [S.sel.slice(), S.selSeg, S.selMore.length];
    app.click(b.x, b.y, { shiftKey: true });
    out.two = app.ev("selLines().map(x => [x.p.name, x.i])");
    out.selStays = S.sel.slice();
    app.click(b.x, b.y, { shiftKey: true });
    out.off = app.ev("selLines().length");
    app.click(b.x, b.y, { shiftKey: true });
    // the menu, opened on one of the selected lines
    app.menu.children.length = 0; app.showMenu({ clientX: b.x, clientY: b.y });
    out.menu = app.menu.children.filter(c => typeof c.onclick === "function").map(c => c.innerHTML.replace(/<span class="k">.*$/, "").replace(/<[^>]+>/g, ""));
    // Align and Match Up are submenus (the screenshot's ▸)
    const subRows = (n) => { app.menu.children.find(c => c.innerHTML.includes("<span>" + n + "</span>")).onclick({ stopPropagation() {} }); const subs = app.ev("menuSubs"); return subs[subs.length - 1].children.filter(c => typeof c.onclick === "function").map(c => c.innerHTML.replace(/<span class="k">.*$/, "").replace(/<[^>]+>/g, "")); };
    out.align = subRows("Align"); out.matchUp = subRows("Match Up");
    out.kept = app.ev("selLines().length");
    const nSeams = S.seams.length, pcs = S.pieces.length, undoAt = S.undo.length;
    app.menuClick(b.x, b.y, "Merge");
    out.merged = [S.pieces.length, S.pieces[0].name, S.pieces[0].pts.length, S.pieces[0].bases.length, S.undo.length - undoAt];
    out.step = app.histSteps().steps.slice(-1)[0].n;
    app.undo();
    out.undone = [S.pieces.length, S.pieces[1].name];
    // U links the selected lines; Delete deletes them
    a = mid(S.pieces[0], 5); b = mid(S.pieces[1], 3);
    app.click(a.x, a.y); app.click(b.x, b.y, { shiftKey: true }); app.key("u");
    out.linked = [S.lineLinks.length, S.lineLinks[0].m.length, +app.segLen(S.pieces[1], 3).toFixed(4) === +app.segLen(S.pieces[0], 5).toFixed(4)];
    app.key("Delete");
    out.deleted = [S.pieces.length, S.lineLinks.length, /can't be without a line of the outline/.test(toasts[toasts.length - 1])];
    app.undo(); out.back = S.pieces.length;
    // a file with links and several selected lines round-trips
    const d = JSON.parse(app.docJSON()); out.saved = Array.isArray(d.links);
    return out;`);
  const o = r.result;
  assert.deepStrictEqual(o.one.slice(1), [5, 0]);
  assert.deepStrictEqual(o.two, [["Front bodice", 5], ["Side", 3]]);
  assert.strictEqual(o.selStays.length, 1); assert.strictEqual(o.off, 1); assert.strictEqual(o.kept, 2);
  // (Round G1: two lines selected, the menu of the screenshot line_selection_data_field)
  const want = ["Delete Line", "Copy", "Paste", "Mirror Paste", "Lock", "Split", "Change Length", "Offset as Internal Line", "Offset as Seamless Block Line", "Offset Pattern Outline", "Merge", "Unfold", "Unfold Pattern Outline Only",
    "Unfold Symmetric Editing (with Sewing)", "Duplicate as Mirrored Internal Line", "Add Guideline along Points", "Align", "Match Up", "Roll Up", "Trace as Point of Measure", "Link Lines", "More"];
  assert.deepStrictEqual(o.menu.slice(0, want.length), want, "the expected order");
  for (const n of ["Roll Up", "Trace as Point of Measure", "Link Lines"]) assert.ok(o.menu.includes(n), n);
  assert.ok(o.menu.indexOf("Roll Up") < o.menu.indexOf("Trace as Point of Measure") && o.menu.indexOf("Trace as Point of Measure") < o.menu.indexOf("Link Lines"));
  assert.deepStrictEqual(o.matchUp, ["Lay Pattern against the Second Line", "Match Length to the First Line"]);      // (Round r15 / 6: the first pattern moves to the second line) assert.ok(o.align.includes("Left") && o.align.includes("Bottom"), o.align.join(" | "));
  // (Round E / E3: the first line's pattern is brought to the second, which keeps its name; the first line is made its length)
  assert.deepStrictEqual(o.merged.slice(0, 2), [1, "Side"]); assert.ok(o.merged[3] >= 1, "the old edge as a baseline"); assert.strictEqual(o.merged[4], 1, "one undo step");
  assert.strictEqual(o.step, "Merge");
  assert.deepStrictEqual(o.undone, [2, "Side"]);
  assert.deepStrictEqual(o.linked, [1, 2, true]);
  // (Round r15 / 6: Delete on outline lines deletes their patterns, and their link; it used to take one line from each)
  assert.deepStrictEqual(o.deleted, [0, 0, true], "both patterns gone, and the link, and it says why"); assert.strictEqual(o.back, 2, "undo brings them back");
  assert.strictEqual(o.saved, true);
});

/* ---------------- batch 3: symmetric patterns, edited from either side ---------------- */
function symDoc() {
  const S = { pieces: [], seams: [], stitches: [], measures: [], lineLinks: [], selMore: [], sel: [], grading: null, tool: "edit_pattern", show: { lockAll: false }, unit: "mm", dec: 1, nextSegId: 1, nextShapeId: 1, nextId: 1 };
  const G = load(["V", "mkShape", "mkPiece", "addChild", "mkLinked", "sync", "syncHalf", "unfold", "mapPiece", "reflector", "affOf", "affInv", "affMul", "affApply", "affRigid", "addPoint", "deletePoint", "makeSeam", "seamInfo", "resolveRefs",
    "segLen", "segPt", "signedArea", "flatten", "dartGeom", "clone", "defaultGrading", "setCurve", "followerMsg", "halfParts", "paramNear", "segIx"], { S, toast: () => {}, ui: () => {}, draw: () => {} });
  S.grading = oldSizeRun();
  const rect = (name, x, y, w, h) => { const p = G.mkPiece(name, G.mkShape([G.V(x, y), G.V(x + w, y), G.V(x + w, y + h), G.V(x, y + h)], true)); S.pieces.push(p); return p; };
  const xy = (p) => p.pts.map(q => [+q.x.toFixed(6), +q.y.toFixed(6)]);
  return { S, G, rect, xy };
}

test("B3 linked copies are edited from either side: an edit on a copy goes to its source and on to the other copies; moving a piece moves only that piece", () => {
  const { S, G, rect, xy } = symDoc();
  const A = rect("Front", 0, 0, 200, 300);
  const sym = G.mkLinked(A, "symmetric", G.affOf(G.reflector(G.V(250, 0), G.V(250, 300)))), ins = G.mkLinked(A, "instance", G.affOf((q) => G.V(q.x + 600, q.y)));
  S.pieces.push(sym, ins); G.sync();
  assert.deepStrictEqual(xy(sym), [[500, 0], [300, 0], [300, 300], [500, 300]]);
  // a point of the mirrored copy is dragged: the source's point goes the mirrored way, the instance follows the source
  sym.pts[1] = G.V(280, -20); G.sync();
  assert.deepStrictEqual(xy(A)[1], [220, -20]); assert.deepStrictEqual(xy(ins)[1], [820, -20]); assert.deepStrictEqual(xy(sym)[1], [280, -20]);
  // … and again while "dragging": the copy's own objects are never swapped under the drag
  const segs = sym.segs; sym.pts[1] = G.V(270, -30); G.sync(); sym.pts[1] = G.V(260, -40); G.sync();
  assert.strictEqual(sym.segs, segs); assert.deepStrictEqual(xy(A)[1], [240, -40]);
  // the source edited: both copies follow, as they always did
  A.pts[2] = G.V(210, 310); G.sync();
  assert.deepStrictEqual(xy(sym)[2], [290, 310]); assert.deepStrictEqual(xy(ins)[2], [810, 310]);
  // a curve bent on the instance arrives on the source and, mirrored, on the symmetric copy
  G.setCurve(ins, 3, true); ins.segs[3].c1 = G.V(560, 200); ins.segs[3].c2 = G.V(560, 100); G.sync();
  assert.ok(A.segs[3].curved && sym.segs[3].curved);
  assert.deepStrictEqual([A.segs[3].c1.x, sym.segs[3].c1.x].map(v => +v.toFixed(6)), [-40, 540]);
  // an internal line drawn on a copy, a notch, a dart
  G.addChild(sym, "internals", G.mkShape([G.V(320, 50), G.V(380, 120)], false)); sym.segs[2].notches.push(0.3);
  sym.darts.push({ sid: sym.segs[2].id, t: 0.6, width: 20, depth: 50, folded: false, cap: 1 }); G.sync();
  assert.deepStrictEqual(A.internals[0].pts.map(q => [+q.x.toFixed(6), q.y]), [[180, 50], [120, 120]]);
  assert.deepStrictEqual(A.segs[2].notches, [0.3]); assert.strictEqual(A.darts.length, 1); assert.strictEqual(ins.darts.length, 1); assert.strictEqual(ins.internals.length, 1);
  // moving, turning or flipping a whole piece is not a shape edit: nothing else moves, whichever piece it is
  const before = [xy(A), xy(sym), xy(ins)];
  G.mapPiece(sym, (q) => G.V(q.x + 77, q.y - 13)); G.sync();
  assert.deepStrictEqual([xy(A), xy(ins)], [before[0], before[2]], "a copy moved");
  G.mapPiece(A, (q) => G.V(-q.y + 900, q.x + 40)); G.sync();
  assert.deepStrictEqual([xy(sym)[0], xy(ins)], [[577, -13], before[2]], "the source turned and moved: its copies stay");
  // … and the tie still holds afterwards, both ways
  A.pts[0] = G.V(A.pts[0].x + 5, A.pts[0].y); G.sync();
  assert.notDeepStrictEqual(xy(ins)[0], before[2][0]);
  const a3 = G.clone(A.pts[3]); ins.pts[3] = G.V(ins.pts[3].x + 9, ins.pts[3].y + 4); G.sync();
  assert.ok(Math.hypot(A.pts[3].x - a3.x, A.pts[3].y - a3.y) > 5, "the source followed its (unturned) copy, through its own turn");
  // scaling the source is a shape edit: the copies take it
  const len = G.segLen(ins, 1); G.mapPiece(A, (q) => G.V(q.x*2, q.y*2)); G.sync();
  close(G.segLen(ins, 1), 2*len, 1e-6, "scaled");
  // both edited at once: the source wins
  A.pts[1] = G.V(A.pts[1].x + 50, A.pts[1].y); const want = G.clone(A.pts[1]); ins.pts[1] = G.V(0, 0); G.sync();
  samePt(A.pts[1], want);
  // unlinked, a copy is its own pattern
  delete ins.link; const a1 = G.clone(A.pts[1]); ins.pts[1] = G.V(1, 2); G.sync();
  samePt(A.pts[1], a1); samePt(ins.pts[1], { x: 1, y: 2 });
  // after undo (new objects) nothing is taken for an edit
  S.pieces = G.clone(S.pieces); const u = JSON.stringify(S.pieces); G.sync();
  assert.strictEqual(JSON.stringify(S.pieces.map(p => p.pts)), JSON.stringify(JSON.parse(u).map(p => p.pts)));
});

test("B3 a point added on a linked copy: the source gets it, and seams on that edge of the source and of the copy cover both parts", () => {
  const { S, G, rect } = symDoc();
  const A = rect("Front", 0, 0, 200, 300), B = rect("Back", 0, 500, 200, 300);
  const c = G.mkLinked(A, "symmetric", G.affOf(G.reflector(G.V(250, 0), G.V(250, 300)))); S.pieces.push(c); G.sync();
  S.seams.push(G.makeSeam(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[1].id }));
  S.seams.push(G.makeSeam(S.seams, { piece: c.id, sid: c.segs[1].id }, { piece: B.id, sid: B.segs[3].id }));
  G.addPoint(c, 1, 0.25); G.sync(); S.seams = G.resolveRefs(S.pieces, S.seams);
  assert.strictEqual(A.pts.length, 5); assert.deepStrictEqual(A.segs.map(s => s.id), c.segs.map(s => s.id));
  samePt(A.pts[2], { x: 200, y: 75 });
  for (const sm of S.seams) { const inf = G.seamInfo(sm, S.pieces); close(inf.la, 300, 1e-6, "still the whole edge"); assert.strictEqual(sm.a[0].sids.length, 2); }
  G.deletePoint(c, 2); G.sync(); S.seams = G.resolveRefs(S.pieces, S.seams);
  assert.strictEqual(A.pts.length, 4);
  for (const sm of S.seams) close(G.seamInfo(sm, S.pieces).la, 300);
});

test("B3 both halves of a symmetric unfold are edited: points, curves, notches, darts and internal lines go across either way", () => {
  const { S, G, rect, xy } = symDoc();
  // a half front: fold on its left edge (x = 0)
  const h = rect("Half", 0, 0, 100, 300);
  G.addChild(h, "internals", G.mkShape([G.V(20, 50), G.V(80, 90)], false));
  const p = G.unfold(h, 3); S.pieces = [p]; G.sync();
  assert.strictEqual(p.pts.length, 6);
  const at = (x, y) => p.pts.findIndex(q => Math.hypot(q.x - x, q.y - y) < 1e-6), segFrom = (x0, y0, x1, y1) => { const i = at(x0, y0); return Math.hypot(p.pts[(i + 1) % 6].x - x1, p.pts[(i + 1) % 6].y - y1) < 1e-6 ? i : (at(x1, y1)); };
  // drag the mirrored half's corner (-100, 0): the first half's (100, 0) goes the mirrored way
  let i = at(-100, 0); assert.ok(i >= 0);
  p.pts[i] = G.V(-130, -20); G.sync();
  assert.ok(at(130, -20) >= 0, "mirrored back: " + JSON.stringify(xy(p))); assert.ok(at(-130, -20) >= 0);
  // the first half edited: the second follows (as before)
  i = at(100, 300); p.pts[i] = G.V(110, 320); G.sync();
  assert.ok(at(-110, 320) >= 0);
  // a curve bent on the second half
  i = segFrom(-130, -20, -110, 320); const sm = p.segs[i];
  sm.curved = true; sm.c1 = G.V(-160, 80); sm.c2 = G.V(-150, 220); G.sync();
  const j = at(130, -20), ss = p.segs[j];
  assert.ok(ss.curved); samePt(ss.c1, { x: 150, y: 220 }, "its mirror image, run the other way"); samePt(ss.c2, { x: 160, y: 80 });
  close(G.segLen(p, j), G.segLen(p, G.segIx(p, sm.id)), 1e-6, "both sides the same length");
  // a notch, seam allowance and a dart put on the second half
  const msg = p.segs[G.segIx(p, p.half.map[ss.id])];
  msg.notches.push(0.2); msg.sa = 12; p.darts.push({ sid: msg.id, t: 0.5, width: 16, depth: 40, folded: false, cap: 1 }); G.sync();
  assert.deepStrictEqual(ss.notches.map(t => +t.toFixed(6)), [0.8]); assert.strictEqual(ss.sa, 12);
  assert.strictEqual(p.darts.length, 2);
  const d1 = p.darts.find(d => d.sid === ss.id), d2 = p.darts.find(d => d.sid === msg.id), g1 = G.dartGeom(p, d1), g2 = G.dartGeom(p, d2);
  close(d1.t, 0.5); samePt(g1.apex, { x: -g2.apex.x, y: g2.apex.y }, "the two darts are mirror images");
  // the mirrored internal line edited, then deleted
  const kid = p.internals.find(c => c.id === p.half.kids[p.internals[0].id]), own = p.internals[0];
  kid.pts[1] = G.V(-60, 140); G.sync();
  samePt(own.pts[1], { x: 60, y: 140 }); assert.strictEqual(p.internals.find(c => c.id === kid.id), kid, "the same object, so a drag holding it goes on");
  p.internals.splice(p.internals.indexOf(kid), 1); G.sync();
  assert.strictEqual(p.internals.length, 0, "deleting either one deletes both");
  // a fold point moved tilts the fold: the first half leads
  i = at(0, 300); p.pts[i] = G.V(20, 300); G.sync();
  assert.ok(G.halfParts(p), "still a symmetric unfold");
  const M = G.reflector(p.pts[G.segIx(p, p.half.s)], p.pts[G.segIx(p, p.half.m)]), g = G.halfParts(p);
  g.sPts.slice(1, -1).forEach((q) => assert.ok(p.pts.some(r => Math.hypot(r.x - M(q).x, r.y - M(q).y) < 1e-6), "mirrored in the tilted fold"));
  // both halves edited at once: the first wins
  const a = at(130, -20) >= 0 ? at(130, -20) : g.src[1]; const first = G.clone(p.pts[g.src[1]]);
  p.pts[g.src[1]] = G.V(first.x + 3, first.y); p.pts[g.mir[1]] = G.V(-999, -999); G.sync();
  assert.ok(!p.pts.some(q => q.x === -999));
});

test("B3 a point added to or deleted from the second half is added to or deleted from the first, and the seams of both halves follow", () => {
  const { S, G, rect } = symDoc();
  const h = rect("Half", 0, 0, 100, 300), B = rect("Back", 400, 0, 100, 300);
  const p = G.unfold(h, 3); S.pieces = [p, B]; G.sync();
  const idx = (x0, y0) => p.pts.findIndex(q => Math.hypot(q.x - x0, q.y - y0) < 1e-6);
  const right = idx(100, 0), left = (idx(-100, 300) + 0), rid = p.segs[right].id, lid = p.half.map[rid];
  assert.strictEqual(p.segs[left].id, lid, "the left side is the mirror of the right side");
  S.seams.push(G.makeSeam(S.seams, { piece: p.id, sid: rid }, { piece: B.id, sid: B.segs[1].id }));
  S.seams.push(G.makeSeam(S.seams, { piece: p.id, sid: lid }, { piece: B.id, sid: B.segs[3].id }));
  // add a point on the LEFT (second) half, a quarter of the way along it (it runs upward: 300 → 0)
  G.addPoint(p, left, 0.25); G.sync(); S.seams = G.resolveRefs(S.pieces, S.seams);
  assert.strictEqual(p.pts.length, 8);
  assert.ok(idx(-100, 225) >= 0 && idx(100, 225) >= 0, "the point is on both sides");
  assert.strictEqual(new Set(p.segs.map(s => s.id)).size, 8);
  for (const sm of S.seams) { close(G.seamInfo(sm, S.pieces).la, 300, 1e-6, "the seam still covers the whole side"); assert.strictEqual(sm.a[0].sids.length, 2); }
  assert.ok(G.halfParts(p) && Object.keys(p.half.map).length === 4);
  // the halves still mirror each other exactly
  const g = G.halfParts(p), M = G.reflector(p.pts[g.is], p.pts[g.im]);
  g.sPts.forEach(q => assert.ok(p.pts.some(r => Math.hypot(r.x - M(q).x, r.y - M(q).y) < 1e-6)));
  // two more on the second half in one go, then delete one of them there
  G.addPoint(p, idx(-100, 225), 0.5); G.addPoint(p, idx(-100, 225), 0.5); G.sync(); S.seams = G.resolveRefs(S.pieces, S.seams);
  assert.strictEqual(p.pts.length, 12);
  for (const sm of S.seams) close(G.seamInfo(sm, S.pieces).la, 300);
  G.deletePoint(p, idx(-100, 225)); G.sync(); S.seams = G.resolveRefs(S.pieces, S.seams);
  assert.strictEqual(p.pts.length, 10); assert.ok(idx(100, 225) < 0 && idx(-100, 225) < 0, "gone from both sides");
  for (const sm of S.seams) close(G.seamInfo(sm, S.pieces).la, 300);
  assert.strictEqual(new Set(p.segs.map(s => s.id)).size, 10);
  // a point added and another deleted on the second half in one step can't be carried back: the first half stays, and it says so
  G.syncHalf.lost = false;
  const k = p.pts.length; G.addPoint(p, idx(-100, 300), 0.5); G.deletePoint(p, idx(-100, 0)); G.sync();
  assert.strictEqual(p.pts.length, k); assert.strictEqual(G.syncHalf.lost, true);
});

test("B3 in the booted app: Edit Pattern drags a point of a symmetric copy and of an unfolded half; Transform Pattern moves one piece alone", () => {
  const r = run(`
    const out = {}, P = () => S.pieces[0], at = (q) => app.toS(q);
    app.key("d", { ctrlKey: true });
    { const b = app.ev("bboxOf([S.pieces[0]])"), c = at({ x: (b.x0 + b.x1)/2 + (b.x1 - b.x0) + 40, y: (b.y0 + b.y1)/2 }); app.click(c.x, c.y); }      // the copy hangs on the pointer: set it down beside the pattern
    app.ev("fitAll()");
    const copy = S.pieces[1], src0 = JSON.stringify(P().pts);
    out.linked = !!copy.link;
    app.ev("setTool('edit_pattern')");
    // drag point 2 of the copy 40 px right
    let a = at(copy.pts[2]); app.drag(a.x, a.y, a.x + 40, a.y); app.fire("pointerup", { x: a.x + 40, y: a.y });
    const moved = 40 / S.view.s;
    // (Round perf-2 / 5: a step is kept in parts; histText() is its text, what snap() gave)
    out.copyMoved = +(copy.pts[2].x - JSON.parse(app.ev("histText(S.undo[S.undo.length - 1])")).pieces[1].pts[2].x).toFixed(4) === +moved.toFixed(4);
    out.srcMirrored = +(JSON.parse(src0)[2].x - P().pts[2].x).toFixed(4) === +moved.toFixed(4);
    out.steps = S.undo.length;
    app.undo(); out.undone = JSON.stringify(P().pts) === src0;
    // the copy picked up with Transform Pattern and moved: the source stays
    app.ev("setTool('transform_pattern')");
    const b = app.ev("bboxOf([S.pieces[1]])"), c = at({ x: (b.x0 + b.x1)/2, y: (b.y0 + b.y1)/2 });
    app.drag(c.x, c.y, c.x + 60, c.y + 30); app.fire("pointerup", { x: c.x + 60, y: c.y + 30 });
    out.copyAway = S.pieces[1].pts[0].x !== copy.pts[0].x || S.pieces[1] === copy;
    out.srcStays = JSON.stringify(P().pts) === src0;
    // … and the source moved: the copy stays
    const copyPts = JSON.stringify(S.pieces[1].pts);
    app.ev("S.sel = [S.pieces[0].id]; push(); mapPiece(S.pieces[0], (q) => V(q.x - 25, q.y + 10)); commit()");
    out.copyStays = JSON.stringify(S.pieces[1].pts.map(q => [+q.x.toFixed(6), +q.y.toFixed(6)])) === JSON.stringify(JSON.parse(copyPts).map(q => [+q.x.toFixed(6), +q.y.toFixed(6)]));
    // the menu on a copy's point has the point commands; unlink ends the tie
    app.ev("setTool('edit_pattern')");
    a = at(S.pieces[1].pts[2]); app.menuClick(a.x, a.y, "More ▸ Unlink Symmetric Pattern", "transform_pattern");      // (the pattern's menu, Round G1)
    out.unlinked = !S.pieces[1].link;
    // a symmetric unfold: drag a point of the second half
    app.ev("S.pieces = [S.pieces[0]]; S.sel = [S.pieces[0].id]; commit(); fitAll()");
    const cf = at(app.segPt(P(), 5, 0.5)); app.menuClick(cf.x, cf.y, "Unfold Symmetric Editing (with Sewing)");
    app.ev("fitAll()");
    const hp = app.ev("halfParts(S.pieces[0])"), mi = hp.mir[2], si = hp.src[hp.src.length - 3];
    const m0 = { ...P().pts[mi] }, s0 = { ...P().pts[si] };
    a = at(P().pts[mi]); app.drag(a.x, a.y, a.x - 30, a.y + 20); app.fire("pointerup", { x: a.x - 30, y: a.y + 20 });
    const dm = { x: P().pts[mi].x - m0.x, y: P().pts[mi].y - m0.y }, ds = { x: P().pts[si].x - s0.x, y: P().pts[si].y - s0.y };
    out.half = [Math.abs(dm.x) > 1, +(dm.x + ds.x).toFixed(4), +(dm.y - ds.y).toFixed(4), !!P().half];
    app.checkDoc(S.pieces, S.seams);
    return out;`);
  const o = r.result;
  assert.strictEqual(o.linked, true);
  assert.strictEqual(o.copyMoved, true, "the copy's point went where it was dragged"); assert.strictEqual(o.srcMirrored, true, "the source's point went the mirrored way");
  assert.strictEqual(o.undone, true);
  assert.strictEqual(o.srcStays, true, "moving the copy leaves the source"); assert.strictEqual(o.copyStays, true, "moving the source leaves the copy");
  assert.strictEqual(o.unlinked, true);
  assert.deepStrictEqual(o.half, [true, 0, 0, true], "the first half's point moved the mirrored way (the fold is upright)");
});

/* ---------------- batch 4: curve drags previewed like a pattern move ---------------- */
test("B4 which drags show a ghost: a point, a curve point, a curve and a handle, once they have moved; a segment drag stays live", () => {
  const S = { drag: null };
  const G = load(["ghostDrag", "GHOST_DRAGS"], { S });
  const sh = { pts: [1, 2, 3], segs: [1, 2, 3], closed: true }, orig = { pts: [1, 2, 3], segs: [1, 2, 3], closed: true };
  for (const k of ["pt", "handle"]) { S.drag = { k, sh, orig }; assert.strictEqual(G.ghostDrag(), S.drag, k); }
  for (const k of ["cp", "bend"]) { S.drag = { k, sh, orig, moved: false }; assert.strictEqual(G.ghostDrag(), null, k + " pressed, not yet dragged"); S.drag.moved = true; assert.strictEqual(G.ghostDrag(), S.drag, k); }
  S.drag = { k: "seg", sh, orig }; assert.strictEqual(G.ghostDrag(), null);
  S.drag = { k: "bend", sh, moved: true }; assert.strictEqual(G.ghostDrag(), null, "nothing to show it against");
  S.drag = { k: "pt", sh, orig: { pts: [1, 2], segs: [1, 2], closed: true } }; assert.strictEqual(G.ghostDrag(), null, "not the same shape any more");
});

test("B4 in the booted app: bending a line and dragging a curve point paint the pattern as it was, the added area grey under it, and the new outline yellow", () => {
  const r = run(`
    const out = {}, P = () => S.pieces[0], at = (q) => app.toS(q);
    // record what is filled and stroked, and whether the pattern being painted has its old shape at that moment
    const rec = [];
    app.ev("ctx").fill = function () { rec.push(["fill", app.ev("ctx").fillStyle, S.pieces[0].segs[1].curved]); };
    app.ev("ctx").stroke = function () { rec.push(["stroke", app.ev("ctx").strokeStyle, app.ev("ctx").lineWidth]); };
    const ADDED = app.ev("C_ADDED"), SEL = app.ev("C_SEL"), white = app.ev("pieceFill(S.pieces[0], 'front')");
    // Edit Curvature: pull the straight shoulder (segment 2) outward
    app.ev("setTool('edit_curvature')");
    const m = at(app.segPt(P(), 1, 0.5)), tn = app.ev("segTan(S.pieces[0], 1, 0.5)"), w = app.ev("pieceWind(S.pieces[0])"), l = Math.hypot(tn.x, tn.y), ox = w*tn.y/l*40, oy = -w*tn.x/l*40;
    const len0 = app.segLen(P(), 1);
    app.fire("pointermove", { x: m.x, y: m.y }); app.fire("pointerdown", { x: m.x, y: m.y });
    out.pressed = [S.drag.k, !!S.drag.orig, app.ev("!!ghostDrag()")];
    app.fire("pointermove", { x: m.x + ox/2, y: m.y + oy/2 }); app.fire("pointermove", { x: m.x + ox, y: m.y + oy });
    out.live = [P().segs[1].curved, app.segLen(P(), 1) > len0 + 1, app.ev("!!ghostDrag()")];
    rec.length = 0; app.ev("draw()");
    const iAdd = rec.findIndex(x => x[0] === "fill" && x[1] === ADDED), iBody = rec.findIndex((x, k) => k > iAdd && x[0] === "fill" && x[1] === white);
    out.bend = { added: iAdd >= 0, bodyAfter: iBody > iAdd, oldShapeWhilePainting: rec[iBody] && rec[iBody][2] === false,
      ghost: rec.some(x => x[0] === "stroke" && x[1] === SEL && x[2] === 1.6), restored: P().segs[1].curved === true };
    app.fire("pointerup", { x: m.x + ox, y: m.y + oy });
    rec.length = 0; app.ev("draw()");
    out.after = [rec.some(x => x[1] === ADDED), S.drag === null, P().segs[1].curved];
    // Edit Curve Point: click the line (a curve point there) and drag it
    app.undo();
    app.ev("setTool('edit_curve_point')");
    const k = at(app.segPt(P(), 1, 0.4));
    app.fire("pointermove", { x: k.x, y: k.y }); app.fire("pointerdown", { x: k.x, y: k.y });
    app.fire("pointermove", { x: k.x + ox/2, y: k.y + oy/2 }); app.fire("pointermove", { x: k.x + ox, y: k.y + oy });
    rec.length = 0; app.ev("draw()");
    const jAdd = rec.findIndex(x => x[0] === "fill" && x[1] === ADDED), jBody = rec.findIndex((x, q) => q > jAdd && x[0] === "fill" && x[1] === white);
    out.cp = { added: jAdd >= 0, oldShapeWhilePainting: rec[jBody] && rec[jBody][2] === false, ghost: rec.some(x => x[0] === "stroke" && x[1] === SEL && x[2] === 1.6), dot: rec.some(x => x[0] === "fill" && x[1] === SEL), live: P().segs[1].cps.length };
    app.fire("pointerup", { x: k.x + ox, y: k.y + oy });
    out.steps = S.undo.length;
    // a segment dragged with Edit Pattern is still live: no grey, no swap
    app.undo(); app.ev("setTool('edit_pattern')");
    app.fire("pointermove", { x: m.x, y: m.y }); app.fire("pointerdown", { x: m.x, y: m.y }); app.fire("pointermove", { x: m.x + 20, y: m.y + 20 });
    rec.length = 0; app.ev("draw()");
    out.seg = [S.drag.k, rec.some(x => x[1] === ADDED)];
    app.fire("pointerup", { x: m.x + 20, y: m.y + 20 });
    return out;`);
  const o = r.result;
  assert.deepStrictEqual(o.pressed, ["bend", true, false], "nothing to preview before the pointer moves");
  assert.deepStrictEqual(o.live, [true, true, true], "the drag still works on the real shape");
  assert.deepStrictEqual(o.bend, { added: true, bodyAfter: true, oldShapeWhilePainting: true, ghost: true, restored: true });
  assert.deepStrictEqual(o.after, [false, true, true], "let go: the pattern has its new shape and the preview is gone");
  assert.deepStrictEqual(o.cp, { added: true, oldShapeWhilePainting: true, ghost: true, dot: true, live: 1 });
  assert.strictEqual(o.steps, 1, "adding the curve point and dragging it are one step");
  assert.deepStrictEqual(o.seg, ["seg", false]);
});

/* ---------------- batch 5: a blank start, recovery, history and drape in the file ---------------- */
// a document with unsaved work, as the autosave of a session that ended without saving
let UNSAVED;
const unsaved = (name) => { UNSAVED = UNSAVED || boot().storage["pdraft:doc"]; const d = JSON.parse(UNSAVED); if (name) d.pieces[0].name = name; return JSON.stringify(d); };

test("B5 the program starts with a blank document: nothing drawn, nothing autosaved, no question; the first change is autosaved as unsaved work", () => {
  const r = run(`
    const out = { pieces: S.pieces.length, undo: S.undo.length, dirty: !!S.dirty, save: app.el("s-save").textContent, stored: app.storage.has("pdraft:doc") };
    app.ev("starterDoc()");
    out.starter = [S.pieces.map(p => p.name), !!S.dirty];
    app.ev("saveNow()"); out.after = [app.el("s-save").textContent, JSON.parse(app.storage.get("pdraft:doc")).pieces.length];
    // File > New asks first, because that work is in no file
    app.modalAnswer = (t, keys) => { out.asked = [t, keys]; return "cancel"; };
    app.ev("newDoc()"); out.cancelled = S.pieces.length;
    app.modalAnswer = () => "discard"; app.ev("newDoc()");
    out.fresh = [S.pieces.length, S.undo.length, !!S.dirty, app.storage.has("pdraft:doc"), app.el("s-save").textContent];
    return out;`, { blank: true });
  assert.deepStrictEqual(r.modals.filter(m => /Recover/.test(m.title)), []);
  const o = r.result;
  assert.deepStrictEqual([o.pieces, o.undo, o.dirty, o.save, o.stored], [0, 0, false, "SAVED", false]);
  assert.deepStrictEqual(o.starter, [["Front bodice"], true]); assert.deepStrictEqual(o.after, ["AUTOSAVED", 1]);
  assert.deepStrictEqual(o.asked, ["Unsaved changes", ["save", "discard", "cancel"]]); assert.strictEqual(o.cancelled, 1);
  assert.deepStrictEqual(o.fresh, [0, 0, false, false, "SAVED"]);
});

test("B5 work a session left unsaved is offered, not loaded: Recover brings it back, Discard keeps one copy aside, and nothing is written over it while the question is open", () => {
  const raw = unsaved("Left unsaved");
  const ask = run(`
    const out = { open: app.ev("!!modalNow"), pieces: S.pieces.length };
    app.ev("starterDoc(true); saveNow()");                       // even work done behind the question is not written over what waits
    out.kept = app.storage.get("pdraft:doc") === ${JSON.stringify(raw)};
    app.key("Enter");                                            // Enter is Recover
    out.after = [app.ev("!!modalNow"), S.pieces.map(p => p.name), !!S.dirty, app.storage.get("pdraft:doc") === ${JSON.stringify(raw)}, app.el("s-save").textContent, toasts.slice(-1)[0]];
    return out;`, { blank: true, seed: raw, recover: "ask" });
  assert.deepStrictEqual(ask.modals.map(m => [m.title, m.keys]), [["Recover unsaved work?", ["recover", "discard"]]]);
  assert.ok(/1 pattern/.test(ask.modals[0].text));
  assert.deepStrictEqual([ask.result.open, ask.result.pieces, ask.result.kept], [true, 0, true]);
  assert.deepStrictEqual(ask.result.after, [false, ["Left unsaved"], true, true, "AUTOSAVED", "Recovered. Save it to keep it."]);
  const no = boot({ blank: true, seed: raw, recover: false });
  assert.deepStrictEqual(no.errors, []); assert.deepStrictEqual(no.names, []); assert.strictEqual(no.dirty, false);
  assert.strictEqual(no.storage["pdraft:doc"], undefined, "nothing is offered again next time");
  assert.strictEqual(no.storage["pdraft:doc.discarded"], raw, "one copy is kept, in case Discard was a slip");
  // Esc does not answer it: it has to be one or the other
  const esc = run(`app.key("Escape"); return app.ev("!!modalNow");`, { blank: true, seed: raw, recover: "ask" });
  assert.strictEqual(esc.result, true);
});

// (Round rename-1) the program is called Gusset: the titles and texts expected below say so (they had the old name)
// (Round r24 follow-up) the name in full in every title: "Gusset – Pattern Drafter" (it was "Gusset")
test("B5 desktop: a file double-clicked while unsaved work waits is opened only if that work is discarded; the remembered file comes back with recovered work", () => {
  const A = "C:\\\\patterns\\\\skirt.pdraft", B = "C:\\\\patterns\\\\other.pdraft", raw = unsaved("Unsaved skirt"), other = unsaved("Double-clicked");
  const script = (pick) => `
    app.desk.onFile({ path: "${B}", name: "other.pdraft", text: ${JSON.stringify(other)} });
    const waiting = S.pieces.length;
    app.modalPick("${pick}");
    return [waiting, S.pieces.map(p => p.name), app.title(), toasts.slice(-1)[0]];`;
  const opt = { blank: true, recover: "ask", desktop: { store: { "pdraft:doc": raw }, local: { "pdraft:file": A.replace(/\\\\/g, "\\") } } };
  const rec = run(script("recover"), opt).result;
  assert.deepStrictEqual(rec.slice(0, 3), [0, ["Unsaved skirt"], "skirt.pdraft \u2014 Gusset \u2013 Pattern Drafter"]); assert.ok(/other\.pdraft was not opened/.test(rec[3]), rec[3]);
  const dis = run(script("discard"), opt).result;
  assert.deepStrictEqual(dis, [0, ["Double-clicked"], "other.pdraft \u2014 Gusset \u2013 Pattern Drafter", "Opened other.pdraft"]);
});

test("B5 history steps are stored as what changed: a moved point costs that pattern's points, and every state comes back exactly", () => {
  const S = { undo: [], redo: [], un: [], rn: [], prefs: { histKeep: 50 } };
  const G = load(["histDelta", "histApply", "HIST_KEYS"], { S });
  const piece = (id, n) => ({ id, name: "P" + id, on: true, pts: Array.from({ length: n }, (_, k) => ({ x: k*10 + id, y: k*7 })), segs: Array.from({ length: n }, (_, k) => ({ id: id*100 + k, curved: false, c1: null, c2: null, sa: 0, notches: [] })), internals: [], bases: [], darts: [], graphics: [{ img: 1, w: 40 }] });
  const st = (pieces, more) => ({ pieces, seams: [], lib: { fabric: [{ id: 1, name: "F" }] }, layout: { paper: "a4" }, stitches: [], guides: [], measures: [], grading: { groups: [] }, links: [], ...more });
  const A = st([1, 2, 3, 4, 5].map(id => piece(id, 40)));
  // a point of pattern 3 moved
  const B = JSON.parse(JSON.stringify(A)); B.pieces[2].pts[5].x += 12;
  const d = G.histDelta(A, B);
  assert.deepStrictEqual(Object.keys(d).sort(), ["ids", "p"]); assert.deepStrictEqual(d.ids, [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(d.p.map(c => [c.id, Object.keys(c.set)]), [[3, ["pts"]]]);
  assert.ok(JSON.stringify(d).length < JSON.stringify(B).length/12, "a twelfth of the whole state or less: " + JSON.stringify(d).length + " of " + JSON.stringify(B).length);
  assert.deepStrictEqual(G.histApply(A, d), B);
  // a pattern added, one deleted, a field removed, the order changed, a seam made, the library changed
  const C = JSON.parse(JSON.stringify(B)); C.pieces.splice(1, 1); C.pieces.push(piece(9, 4)); C.pieces.reverse(); delete C.pieces[1].graphics; C.pieces[1].lock = true;
  C.seams = [{ id: 1, a: [], b: [] }]; C.lib.fabric[0].name = "G";
  const d2 = G.histDelta(B, C);
  assert.deepStrictEqual(Object.keys(d2).sort(), ["ids", "lib", "p", "seams"]);
  assert.deepStrictEqual(G.histApply(B, d2), C);
  // the first state is whole
  assert.deepStrictEqual(G.histApply(null, G.histDelta(null, A)), A);
  // a delta that does not fit the state before it is refused, not guessed at
  assert.throws(() => G.histApply(A, { ids: [1, 77] }), /not there/);
  assert.throws(() => G.histApply(A, { nope: 1 }), /not a history step/);
  assert.throws(() => G.histApply(null, { ids: [1], p: [{ id: 1, all: { id: 1 } }] }), /no pattern/);
});

test("B5 Save writes the history timeline into the file and Open brings it back: steps, names, where the document was, and every state", () => {
  const made = run(`
    const out = {}, P = () => S.pieces[0], at = (q) => app.toS(q);
    let file = null; app.setDownload((name, bytes) => { file = JSON.stringify(app.fileDoc(bytes)); });      // (the file's parts as one document: what Open makes of them)
    // five steps: a point moved, a point added, a pattern renamed (twice), a linked copy
    app.ev("setTool('edit_pattern')");
    let a = at(P().pts[2]); app.drag(a.x, a.y, a.x + 30, a.y + 10); app.fire("pointerup", { x: a.x + 30, y: a.y + 10 });
    app.ev("push('Add Point'); addPoint(S.pieces[0], 1, 0.5); commit()");
    app.ev("push('Rename'); S.pieces[0].name = 'Front A'; commit()");
    app.ev("push('Rename'); S.pieces[0].name = 'Front B'; commit()");
    app.key("d", { ctrlKey: true }); app.click(700, 300);          // (the copy hangs on the pointer until a click sets it down)
    app.undo(); app.undo();                                      // … and two of them undone
    out.before = { at: S.undo.length, redo: S.redo.length, names: app.histSteps().steps.map(s => s.n), name: P().name, n: S.pieces.length };
    out.first = JSON.parse(app.ev("histText")(S.undo[0])).pieces[0].pts[2];      // (Round perf-2 / 5: a step kept in parts, as its text)
    app.saveDoc(false);
    out.file = file; out.clean = [!!S.dirty, app.storage.has("pdraft:doc")];
    const d = JSON.parse(file);
    out.hist = { v: d.history.v, at: d.history.at, head: d.history.head, nodes: d.history.nodes.length, size: JSON.stringify(d.history).length, doc: JSON.stringify(d.pieces).length };
    out.whole = S.undo.concat(S.redo).reduce((n, t) => n + app.ev("histText")(t).length, 0);      // (Round perf-2 / 5: each step as the whole text snap() gave)
    // (Round H1: History in the File above 0 keeps every step, the tree; it kept the last n done steps) with it at 2, all six nodes
    app.ev("setPrefs({ histKeep: 2 })"); app.saveDoc(false);
    const c = JSON.parse(file).history; out.capped = [c.at, c.nodes.map(s => s.n)];
    app.ev("setPrefs({ histKeep: 0 })"); app.saveDoc(false); out.none = JSON.parse(file).history === undefined;
    return out;`);
  const o = made.result, b = o.before;
  assert.deepStrictEqual([b.at, b.redo, b.name, b.n], [3, 2, "Front A", 1]);
  assert.deepStrictEqual(b.names, ["Edit Pattern", "Add Point", "Rename", "Rename", "Symmetric Pattern"]);
  // (Round H1: history v4, the tree, since file version 32: node 0 the start, the steps nodes 1 to 5, the document at node 3, the
  // branch's end node 5; v3 since Round perf-2, file version 19, was 5 steps and 6 states)
  assert.deepStrictEqual([o.hist.v, o.hist.at, o.hist.head, o.hist.nodes], [4, 3, 5, 6]);
  assert.ok(o.hist.size < o.whole/2, "stored as changes it is well under the whole snapshots: " + o.hist.size + " against " + o.whole);
  assert.deepStrictEqual(o.clean, [false, false], "saved: nothing unsaved, nothing to recover");
  assert.deepStrictEqual(o.capped, [3, ["Start", "Edit Pattern", "Add Point", "Rename", "Rename", "Symmetric Pattern"]]); assert.strictEqual(o.none, true);

  // another session opens the file
  const opened = run(`
    const out = {};
    app.ev("openText('saved.pdraft', " + JSON.stringify(${JSON.stringify(o.file)}) + ")");
    out.now = { at: S.undo.length, redo: S.redo.length, names: app.histSteps().steps.map(s => s.n), name: S.pieces[0].name, n: S.pieces.length, dirty: !!S.dirty, toast: toasts.slice(-1)[0] };
    app.redo(); out.redo1 = S.pieces[0].name; app.redo(); out.redo2 = S.pieces.length;
    app.histGo(0); out.first = S.pieces[0].pts[2]; out.firstName = S.pieces[0].name; out.firstPts = S.pieces[0].pts.length;
    app.histGo(2); out.second = S.pieces[0].pts.length;
    app.checkDoc(S.pieces, S.seams);
    // (Round H1) a new edit from there keeps what was undone as a branch (it was discarded): off the path, three steps. (Round UI-1 / A:
    // only when the step was gone to from the History panel, treeGo(); histGo() alone is plain undo, whose future a change discards)
    app.ev("treeGo")(S.un[1].id);
    app.ev("push('Rename'); S.pieces[0].name = 'Fork'; commit()"); out.fork = [S.undo.length, S.redo.length, S.hoff.size];
    // Clear History: the document stays, the timeline is empty
    app.ev("clearHistory()"); out.cleared = [S.undo.length, S.redo.length, S.pieces[0].name];
    return out;`, { blank: true });
  const n = opened.result.now;
  assert.deepStrictEqual([n.at, n.redo, n.name, n.n, n.dirty], [3, 2, "Front A", 1, false]); assert.deepStrictEqual(n.names, b.names);
  assert.strictEqual(n.toast, "Opened saved.pdraft with 5 history steps");
  assert.strictEqual(opened.result.redo1, "Front B"); assert.strictEqual(opened.result.redo2, 2);
  assert.deepStrictEqual(opened.result.first, o.first, "the very first state, as it was"); assert.strictEqual(opened.result.firstName, "Front bodice");
  assert.strictEqual(opened.result.second, opened.result.firstPts + 1, "after step 2 the added point is there");
  assert.deepStrictEqual(opened.result.fork, [3, 0, 3]); assert.deepStrictEqual(opened.result.cleared, [0, 0, "Fork"]);
});

test("B5 a file without a history, with a broken one or from another file version opens with an empty timeline; a file that can't be drawn leaves the document as it was", () => {
  const file = JSON.parse(run(`let f = null; app.setDownload((n, t) => { f = JSON.stringify(app.fileDoc(t)); }); app.ev("push('Rename'); S.pieces[0].name = 'X'; commit()"); app.saveDoc(false); return f;`).result);
  assert.strictEqual(file.history.nodes.length, 2);      // (Round H1: v4, the start and the one step)
  const open = (d) => run(`app.ev("openText('f.pdraft', " + JSON.stringify(${JSON.stringify(JSON.stringify(d))}) + ")"); return [S.pieces.map(p => p.name), S.undo.length, S.redo.length, toasts.slice(-1)[0]];`, { blank: true }).result;
  assert.deepStrictEqual(open(file), [["X"], 1, 0, "Opened f.pdraft with 1 history step"]);
  const { history, ...plain } = file;
  assert.deepStrictEqual(open(plain), [["X"], 0, 0, "Opened f.pdraft"]);
  // (Round H1: v4's: no start, a place that is no node, another file version, a step naming a pattern that is not there, junk, an empty v2)
  for (const bad of [{ ...history, nodes: history.nodes.slice(1) }, { ...history, at: 9 }, { ...history, fv: 10 }, { ...history, nodes: [history.nodes[0], { id: 1, up: 0, n: "X", d: { ids: [12345] } }] }, "junk", { v: 2 }])
    assert.deepStrictEqual(open({ ...plain, history: bad }), [["X"], 0, 0, "Opened f.pdraft"], JSON.stringify(bad).slice(0, 60));
  // a document that can't be drawn: refused with the reason, and what was open stays open with its history
  const broken = JSON.parse(JSON.stringify(plain)); broken.pieces[0].pts[1] = null;
  const r = run(`
    app.ev("push('Rename'); S.pieces[0].name = 'Mine'; commit()");
    app.ev("openText('bad.pdraft', " + JSON.stringify(${JSON.stringify(JSON.stringify(broken))}) + ", null, true)");
    return [S.pieces.map(p => p.name), S.undo.length, toasts.slice(-1)[0]];`).result;
  assert.deepStrictEqual(r.slice(0, 2), [["Mine"], 1]); assert.ok(/Couldn't open bad\.pdraft/.test(r[2]), r[2]);
});

test("B5 the drape is saved with the file and put back on the same mesh only: numbers survive exactly, a changed pattern starts undraped", () => {
  const { THREE } = three();
  const S = { pieces: [], seams: [], stitches: [], images: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, unit: "mm", dec: 1, ui: { render: "front", layout: "both", show3d: {} }, cloth: null, lib: null, av: null, avSet: { cell: 16 },
    undo: [], redo: [], un: [], rn: [], sewCheck: { on: false, useLen: true, len: 2, useRatio: false, ratio: 2 }, drapeIn: null };
  const groups = {}, view3d = { group: (n) => groups[n] || (groups[n] = new THREE.Group()), ask() {}, ready: () => true, cam: { dist: 5000 }, tool() {}, camera: () => null, loop() {} };
  const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }) });
  const G = load(["V", "mkShape", "mkPiece", "normCloth", "normLib", "garmentSync", "G3", "drapeOut", "drapeTake", "normDrape", "b64Of", "bytesOf", "hash32", "pieceSig"],
    { S, THREE, SIM3D: C, view3d, document: { createElement: fakeCanvas }, Image: undefined, ui: () => {}, draw: () => {}, toast: () => {}, refreshRail: () => {}, note3d: () => {} });
  S.cloth = G.normCloth(null); S.lib = G.normLib(null);
  // base64, any length
  for (const n of [0, 1, 2, 3, 4, 5, 61]) { const b = Uint8Array.from({ length: n }, (_, k) => (k*37 + 11) % 256); assert.deepStrictEqual([...G.bytesOf(G.b64Of(b))], [...b]); }
  assert.strictEqual(G.b64Of(Uint8Array.from([77, 97, 110])), "TWFu"); assert.strictEqual(G.b64Of(Uint8Array.from([77])), "TQ==");
  const rect = (x) => { const p = G.mkPiece("r", G.mkShape([G.V(x, 0), G.V(x + 200, 0), G.V(x + 200, 300), G.V(x, 300)], true)); S.pieces.push(p); return p; };
  const a = rect(0), b = rect(300);
  G.garmentSync();
  assert.strictEqual(G.drapeOut(), null, "nothing has been simulated: nothing to save");
  // "simulate": the first pattern's cloth has moved
  const it = G.G3.items.get(a.id);
  for (let k = 0; k < it.X.length; k++) it.X[k] = Math.fround(Math.sin(k)*321.123 + k/7);
  it.draped = true;
  const was = Float32Array.from(it.X), out = G.drapeOut();
  assert.deepStrictEqual(Object.keys(out), [String(a.id)]); assert.strictEqual(out[a.id].n, it.X.length/3);
  // the file is read back in another session: the cloth is made again and takes its drape
  const saved = JSON.parse(JSON.stringify(out));
  S.drapeIn = G.normDrape(saved); G.G3.fresh = true; G.garmentSync();
  const it2 = G.G3.items.get(a.id);
  assert.notStrictEqual(it2, it, "made again for the document"); assert.strictEqual(it2.draped, true);
  assert.deepStrictEqual(Array.from(it2.X), Array.from(was), "to the last bit");
  assert.strictEqual(G.G3.items.get(b.id).draped, false);
  assert.strictEqual(S.drapeIn[a.id], undefined, "taken once: Reset 3D Arrangement is not undone by it later");
  // saved again without the 3D window ever being opened: the drape read from the file is passed on
  S.drapeIn = G.normDrape(saved); G.G3.items.clear();
  assert.deepStrictEqual(G.drapeOut(), saved);
  // the pattern's shape changed since: the drape is not for this mesh
  a.pts[1] = G.V(260, 0);
  assert.strictEqual(G.drapeOut(), null);
  G.G3.fresh = true; G.garmentSync();
  assert.strictEqual(G.G3.items.get(a.id).draped, false);
  // junk in a file is dropped, not trusted
  assert.strictEqual(G.normDrape({ 1: { k: "x", n: 2, x: "AAAA" }, 2: "no", 3: { k: 1, n: 1, x: "" } }), null);
  assert.strictEqual(G.normDrape(null), null);
});

/* ---------------- batch 6: the Load Avatar dialog ---------------- */
test("B6 Load Avatar opens a dialog: Male (Marty) and Female (Jessica) on top, a placeholder for a card whose file is not there, Load your own… below", () => {
  const r = run(`
    const out = {};
    app.ev("loadAvatar()");
    const dlg = app.el("dlg");
    out.open = [dlg.style.display, dlg.className];
    out.first = dlg.innerHTML;
    out.none = app.ev("avatarDialogHTML({})");
    out.one = app.ev("avatarDialogHTML({ male: { name: 'marty.glb', url: 'assets/avatar/presets/marty.glb', thumb: 'assets/avatar/presets/marty.png' } })");
    out.both = app.ev("avatarDialogHTML({ male: { name: 'marty.glb', url: 'assets/avatar/presets/marty.glb' }, female: { name: 'jessica.glb', url: 'assets/avatar/presets/jessica.glb' } })");
    const said = []; app.ev("console").error = (m) => said.push(String(m));
    app.ev("S.avPresets = {}");                                           // (a desktop app whose folder has neither file)
    app.ev("avatarPresetPick('male')"); out.missing = toasts.slice(-1)[0];
    app.ev("avatarPresetPick('female')"); out.missingF = toasts.slice(-1)[0];
    out.said = said.slice();
    out.shown = app.ev("[avatarShown('marty.glb'), avatarShown('C:/x/Marty.FBX'), avatarShown('jessica.glb'), avatarShown('body.fbx'), typeof avatarAuto, avPresetId('Jessica.GLB'), avPresetId('x/marty.glb'), avPresetId('me.glb')]");
    out.menu = app.ev("avatarMenu().map(x => x.n || x.hd)").slice(0, 2);
    out.status = app.el("s-av").textContent;
    return out;`, { blank: true });
  const o = r.result, strip = (h) => h.replace(/<svg[\s\S]*?<\/svg>/g, "[figure]").replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
  assert.deepStrictEqual(o.open, ["block", "avatar"]);
  assert.ok(/Load Avatar/.test(o.first) && /Male/.test(o.first) && /Female/.test(o.first) && /Load your own\u2026/.test(o.first) && !/Remove Avatar/.test(o.first), strip(o.first));
  assert.ok(o.first.indexOf(">Female<") < o.first.indexOf("id=\"av-own\""), "the presets are on top");
  // nothing installed: two placeholder figures, each saying so; neither card is disabled
  assert.strictEqual((o.none.match(/class="avc none"/g) || []).length, 2); assert.strictEqual((o.none.match(/>not installed</g) || []).length, 2); assert.strictEqual((o.none.match(/<svg/g) || []).length, 2);
  assert.ok(!/disabled/.test(o.none) && !/coming soon/.test(o.none), strip(o.none));
  // Marty installed, with his picture: shown by name, not by file name; Jessica's card still a placeholder
  assert.strictEqual((o.one.match(/class="avc none"/g) || []).length, 1);
  assert.ok(/<img alt="" src="assets\/avatar\/presets\/marty\.png">/.test(o.one) && />Male<\/b><i>Marty</.test(o.one) && !/marty\.glb/.test(o.one), strip(o.one));
  assert.ok(/data-k="female" title="[^"]*jessica\.glb[^"]*"/.test(o.one) && />Female<\/b><i>not installed</.test(o.one), strip(o.one));
  // both: Marty on the Male card, Jessica on the Female card
  assert.ok(/>Male<\/b><i>Marty</.test(o.both) && />Female<\/b><i>Jessica</.test(o.both) && /title="Load Jessica"/.test(o.both) && !/class="avc none"/.test(o.both), strip(o.both));
  assert.ok(/Marty/.test(o.missing) && /marty\.glb/.test(o.missing) && /assets\/avatar\/presets/.test(o.missing), o.missing);
  assert.ok(/Jessica/.test(o.missingF) && /jessica\.glb/.test(o.missingF), o.missingF);
  // a preset that can't be had is said in the console as well, never in silence
  assert.strictEqual(o.said.length, 2); assert.ok(/Marty/.test(o.said[0]) && /Jessica/.test(o.said[1]), o.said.join(" | "));
  assert.deepStrictEqual(o.shown, ["Marty", "Marty", "Jessica", "body.fbx", "undefined", "jessica", "marty", null], "no avatar is loaded by itself; the ids are the file names in lower case");
  assert.strictEqual(o.menu[0], "Load Avatar\u2026"); assert.strictEqual(o.status, "NO AVATAR");
});

test("B6 desktop: the dialog lists the presets the shell finds, and a click on one reads that file", () => {
  const r = run(`
    const out = {}, now = (v) => ({ then(f) { return now(f(v)); }, catch() { return this; } }), reads = [];
    app.ev("DESK").avatar = {
      presets: () => now({ male: { path: "C:\\\\app\\\\drafter\\\\assets\\\\avatar\\\\presets\\\\marty.fbx", name: "marty.fbx", thumb: "data:image/png;base64,AAAA" }, female: { path: "C:\\\\app\\\\drafter\\\\assets\\\\avatar\\\\presets\\\\jessica.glb", name: "jessica.glb" } }),
      read: (p) => { reads.push(p); return now({ path: p, name: p.replace(/^.*[\\\\/]/, ""), data: new Uint8Array([1, 2, 3]) }); }, pick: () => now(null) };
    app.ev("loadAvatar()");
    out.html = app.el("dlg").innerHTML;
    const said = []; app.ev("console").error = (m) => said.push(String(m));
    app.ev("avatarPresetPick('male')"); out.reads = reads.slice(); out.toasts = toasts.slice(-2); out.closed = app.el("dlg").style.display; out.said = said.slice();
    app.ev("avatarPresetPick('female')"); out.readF = reads.slice(1); out.toastF = toasts.slice(-2)[0];
    return out;`, { blank: true, desktop: true });
  const o = r.result;
  assert.ok(/>Marty</.test(o.html) && />Jessica</.test(o.html) && /src="data:image\/png;base64,AAAA"/.test(o.html)); assert.strictEqual((o.html.match(/>not installed</g) || []).length, 0); assert.strictEqual((o.html.match(/>coming soon</g) || []).length, 0);
  assert.deepStrictEqual(o.reads, ["C:\\app\\drafter\\assets\\avatar\\presets\\marty.fbx"]);
  assert.strictEqual(o.toasts[0], "Loading Marty\u2026");
  assert.ok(/could not be read as an avatar/.test(o.toasts[1]), "(no three.js in this harness: the bytes went as far as the parser) " + o.toasts[1]);
  assert.ok(o.said.length === 1 && /could not be read as an avatar/.test(o.said[0]), "and in the console: " + o.said.join(" | "));
  assert.notStrictEqual(o.closed, "block");
  assert.deepStrictEqual(o.readF, ["C:\\app\\drafter\\assets\\avatar\\presets\\jessica.glb"]); assert.strictEqual(o.toastF, "Loading Jessica\u2026");
});

test("G1 a page asks for nothing to list the presets; a click reads the .glb over http, falls back to its script, and a page opened from a file loads the script; a failure says how to open the program", () => {
  const mk = (protocol, glb, js) => {
    const asked = [], loaded = [], win = {};
    const G = load(["avatarPresets", "avCanFetch", "presetMissing", "presetBytes", "presetScript"], { S: {}, DESK: null, location: { protocol }, window: win, console: { warn() {}, error() {} },
      atob: (b) => Buffer.from(b, "base64").toString("latin1"),
      fetch: (url, o) => { asked.push([url, (o || {}).method || "GET"]); return Promise.resolve({ ok: glb, status: glb ? 200 : 404, arrayBuffer: () => Promise.resolve(new Uint8Array([7, 8]).buffer) }); },
      document: { createElement: () => ({ remove() {} }), head: { appendChild: (el) => { loaded.push(el.src); setTimeout(() => { if (js) { (win.PDRAFT_AVATARS = win.PDRAFT_AVATARS || {})[el.src.replace(/^.*[/]|[.]js$/g, "")] = Buffer.from([1, 2, 3]).toString("base64"); el.onload(); } else el.onerror(); }); } } } });
    return { G, asked, loaded, win };
  };
  const bytes = (g) => [...new Uint8Array(g[0])];
  return (async () => {
    for (const protocol of ["http:", "file:"]) {
      const t = mk(protocol, true, true);
      assert.deepStrictEqual(await t.G.avatarPresets(), { male: { name: "marty.glb", url: "assets/avatar/presets/marty.glb", script: "assets/avatar/presets/marty.js", thumb: null }, female: { name: "jessica.glb", url: "assets/avatar/presets/jessica.glb", script: "assets/avatar/presets/jessica.js", thumb: null } });
      assert.deepStrictEqual(t.asked, [], "listing the presets asks for nothing");
    }
    // over http: the .glb itself
    let t = mk("http:", true, true), p = (await t.G.avatarPresets()).male, g = await t.G.presetBytes(p);
    assert.deepStrictEqual([bytes(g), g[1], g[2], t.asked, t.loaded], [[7, 8], "marty.glb", null, [["assets/avatar/presets/marty.glb", "GET"]], []]);
    // a server that does not give it: the script
    t = mk("http:", false, true); g = await t.G.presetBytes(p);
    assert.deepStrictEqual([bytes(g), t.loaded], [[1, 2, 3], ["assets/avatar/presets/marty.js"]]);
    assert.deepStrictEqual(t.win.PDRAFT_AVATARS, {}, "the bytes are let go once taken");
    // a page opened from a file: the script, and no fetch at all
    t = mk("file:", true, true); g = await t.G.presetBytes((await t.G.avatarPresets()).female);
    assert.deepStrictEqual([bytes(g), g[1], t.asked, t.loaded], [[1, 2, 3], "jessica.glb", [], ["assets/avatar/presets/jessica.js"]]);
    // nothing to be had: an error saying why and what to do
    t = mk("file:", false, false);
    const e = await t.G.presetBytes(p).then(() => null, (x) => x.message);
    assert.ok(/marty[.]js could not be loaded/.test(e) && /http[.]server/.test(e) && /Load your own/.test(e), e);
    t = mk("http:", false, false);
    const e2 = await t.G.presetBytes(p).then(() => null, (x) => x.message);
    assert.ok(/404/.test(e2) && /marty[.]js could not be loaded/.test(e2) && !/http[.]server/.test(e2), e2);
    assert.ok(/marty[.]js/.test(mk("file:").G.presetMissing("male")) && /jessica[.]glb/.test(mk("http:").G.presetMissing("female")));
  })();
});

test("G1 each preset's script holds exactly the bytes of its .glb (scripts/make-avatar-scripts.js writes it)", () => {
  const dir = path.join(__dirname, "..", "assets", "avatar", "presets");
  for (const n of ["marty", "jessica"]) {
    const glb = path.join(dir, n + ".glb"), js = path.join(dir, n + ".js");
    if (!fs.existsSync(glb)) continue;
    assert.ok(fs.existsSync(js), n + ".js is missing: node scripts/make-avatar-scripts.js");
    const m = /\(window[.]PDRAFT_AVATARS = window[.]PDRAFT_AVATARS [|][|] \{\}\)\["([a-z]+)"\] = "([A-Za-z0-9+/=]+)";/.exec(fs.readFileSync(js, "utf8"));
    assert.ok(m && m[1] === n, n + ".js names " + (m && m[1]));
    assert.ok(Buffer.from(m[2], "base64").equals(fs.readFileSync(glb)), n + ".js differs from " + n + ".glb: node scripts/make-avatar-scripts.js");
  }
});

test("B7 layout settings: the splitter's share is kept between 15 and 85 %, the 2D toolbar docks right or top, the 3D toolbar top or left; junk falls back", () => {
  const G = load(["normUI", "clampSplit", "dockAt", "dockStrip", "DOCKS"], { S: {} });
  const d = G.normUI(null);
  assert.deepStrictEqual([d.split, d.dock2, d.dock3], [0.5, "right", "left"]);      // (Round r23 / 2: the 3D toolbar at the left by default)
  assert.deepStrictEqual([G.normUI({ split: 0.02 }).split, G.normUI({ split: 7 }).split, G.normUI({ split: "x" }).split, G.normUI({ split: 0.3 }).split], [0.15, 0.85, 0.5, 0.3]);
  assert.deepStrictEqual([G.normUI({ dock2: "top" }).dock2, G.normUI({ dock2: "left" }).dock2, G.normUI({ dock3: "top" }).dock3, G.normUI({ dock3: "right" }).dock3], ["top", "right", "top", "left"]);
  assert.deepStrictEqual(G.DOCKS, { "2D": ["right", "top"], "3D": ["top", "left"] });
  // where a dragged toolbar docks: the nearer of the two edges it can have
  const r = { left: 100, top: 50, right: 900, bottom: 650, width: 800, height: 600 };
  assert.strictEqual(G.dockAt("2D", r, 880, 400), "right"); assert.strictEqual(G.dockAt("2D", r, 400, 70), "top"); assert.strictEqual(G.dockAt("2D", r, 700, 100), "top"); assert.strictEqual(G.dockAt("2D", r, 860, 200), "right");
  assert.strictEqual(G.dockAt("3D", r, 120, 400), "left"); assert.strictEqual(G.dockAt("3D", r, 500, 60), "top"); assert.strictEqual(G.dockAt("3D", r, 300, 100), "top");
  assert.deepStrictEqual(G.dockStrip(r, "top"), { left: 100, top: 50, width: 800, height: 36 });
  assert.deepStrictEqual(G.dockStrip(r, "right"), { left: 828, top: 50, width: 72, height: 600 });
  assert.deepStrictEqual(G.dockStrip(r, "left"), { left: 100, top: 50, width: 72, height: 600 });
});

test("B7 in the booted app: a toolbar dragged by its empty part docks at the edge it is let go at, the splitter is dragged, and both are remembered", () => {
  const r = run(`
    const out = {}, rail = app.el("rail"), rail3 = app.el("rail3d"), ui = () => JSON.parse(app.storage.get("pdraft:ui"));
    app.ev("setLayout('both')");
    // the fake page's windows are 1000 x 800 at (0, 0)
    const dragRail = (id, target, x0, y0, x1, y1) => { app.fireOn(id, "pointerdown", { target, button: 0, clientX: x0, clientY: y0, pointerId: 1 }); app.fireOn(id, "pointermove", { clientX: (x0 + x1)/2, clientY: (y0 + y1)/2 }); app.fireOn(id, "pointermove", { clientX: x1, clientY: y1 }); out.hint = app.el("dockhint").style.display; app.fireOn(id, "pointerup", { type: "pointerup", clientX: x1, clientY: y1 }); };
    dragRail("rail", rail, 980, 700, 400, 20);
    out.top = [S.ui.dock2, ui().dock2, out.hint, app.el("dockhint").style.display];
    dragRail("rail", rail, 300, 10, 985, 500);
    out.right = S.ui.dock2;
    // a press on a tool is not a drag of the toolbar; neither is a click on its empty part
    dragRail("rail", { id: "a tool" }, 980, 700, 400, 20); out.tool = S.ui.dock2;
    app.fireOn("rail", "pointerdown", { target: rail, button: 0, clientX: 980, clientY: 700, pointerId: 1 }); app.fireOn("rail", "pointerup", { type: "pointerup", clientX: 400, clientY: 20 }); out.click = S.ui.dock2;
    dragRail("rail3d", rail3, 600, 10, 20, 500); out.left = [S.ui.dock3, ui().dock3];
    dragRail("rail3d", rail3, 20, 600, 500, 8); out.top3 = S.ui.dock3;
    // the splitter
    app.fireOn("split", "pointerdown", { clientX: 500, clientY: 300, pointerId: 1 }); app.fireOn("split", "pointermove", { clientX: 300, clientY: 310 });
    out.split = [S.ui.split, app.el("pane3d").style.flex, app.el("pane2d").style.flex];
    app.fireOn("split", "pointermove", { clientX: 990, clientY: 310 }); app.fireOn("split", "pointerup", { clientX: 990, clientY: 310 });
    out.clamped = [S.ui.split, ui().split];      // (Round r23 / 1: the split is view state, not written; the docks are preferences)
    app.fireOn("split", "dblclick", {}); out.half = [S.ui.split, ui().split];
    // it is there only while both windows are shown
    out.shown = app.el("split").style.display;
    app.ev("setLayout('2d')"); out.hidden = [app.el("split").style.display, app.el("pane2d").style.flex];
    // the Settings menu has the same choices
    out.menu = app.MENUS.settings().map(x => x.n || x.hd).filter(n => /Toolbar|Half/.test(n));
    app.MENUS.settings().find(x => x.n === "3D Toolbar at the Left").f(); out.byMenu = S.ui.dock3;
    return out;`);
  const o = r.result;
  assert.deepStrictEqual(o.top, ["top", "top", "block", "none"], "dragged to the top edge: docked there, saved, the hint shown while dragging and gone after");
  assert.strictEqual(o.right, "right"); assert.strictEqual(o.tool, "right"); assert.strictEqual(o.click, "right");
  assert.deepStrictEqual(o.left, ["left", "left"]); assert.strictEqual(o.top3, "top");
  assert.deepStrictEqual(o.split, [0.3, "0.3 1 0", "0.7 1 0"]); assert.deepStrictEqual(o.clamped, [0.85, null]); assert.deepStrictEqual(o.half, [0.5, null]);
  assert.strictEqual(o.shown, ""); assert.deepStrictEqual(o.hidden, ["none", ""]);
  // (Round r23 / 2: the 3D toolbar's default, the left, first; Reset Toolbars puts both back)
  assert.deepStrictEqual(o.menu, ["Toolbars (or drag one by its empty part)", "2D Toolbar at the Right", "2D Toolbar at the Top", "3D Toolbar at the Left", "3D Toolbar at the Top", "Reset Toolbars", "Windows Half and Half"]);
  assert.strictEqual(o.byMenu, "left");
  // where the toolbars were docked comes back (a preference); the split does not (view state, Round r23 / 1)
  const again = run("return [S.ui.split, S.ui.dock2, S.ui.dock3];", { uiSaved: JSON.stringify({ layout: "both", split: 0.62, dock2: "top", dock3: "left" }) });
  assert.deepStrictEqual(again.result, [0.5, "top", "left"]);
});

test("B7 the page: a splitter between the two windows, a dock hint, and dark scrollbars for everything that scrolls", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8");
  assert.ok(html.indexOf('id="pane3d"') < html.indexOf('id="split"') && html.indexOf('id="split"') < html.indexOf('id="pane2d"'), "the splitter sits between the 3D and the 2D window");
  assert.ok(/<div id="dockhint"><\/div>/.test(html));
  assert.ok(/\* \{ scrollbar-width: thin; scrollbar-color: #56565a #1e1e20; \}/.test(html), "one rule for every scrollbar");
  assert.ok(/::-webkit-scrollbar-thumb \{ background: #56565a/.test(html), "and the same look where only the older rules are known");
  assert.ok(/#split \{[^}]*cursor: col-resize/.test(html) && /#pane2d\.dock-top \{ flex-direction: column; \}/.test(html) && /#pane3d\.dock-left \{ flex-direction: row; \}/.test(html));
  // nothing sets a light scrollbar of its own
  assert.ok(!/scrollbar-color: (?!#56565a|auto)/.test(html));
});

/* ---------------- batch 8: the cloth solver in a worker ---------------- */
const vm = require("vm");
// a worker made from text, run here: messages are queued and delivered by pump(), as a real worker's are delivered later
class FakeWorker {
  constructor(blob) {
    this.q = []; this.out = []; this.onmessage = null; this.dead = false; this.got = [];
    this.self = { postMessage: (m) => this.out.push(structuredClone(m)) };
    vm.runInNewContext(blob.text, { self: this.self, Float32Array, Float64Array, Int32Array, Uint32Array, Uint16Array, Uint8Array, Int8Array, Map, Set, Math, Object, Array, Number, String, Error, Infinity, NaN, performance, Date });
    FakeWorker.last = this;
  }
  postMessage(m) { if (FakeWorker.broken) throw new Error("no worker here"); this.q.push(structuredClone(m)); this.got.push(m.t); }
  pump() { for (const m of this.q.splice(0)) this.self.onmessage({ data: m }); for (const m of this.out.splice(0)) if (this.onmessage && !this.dead) this.onmessage({ data: m }); }
  terminate() { this.dead = true; }
}
const FakeBlob = class { constructor(parts) { this.text = parts.join(""); } };
// a small sheet of cloth as the solver takes it
function sheetSpec(n = 6, gap = 20) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([i*gap, 0]); for (let j = 0; j < n; j++) pts.push([n*gap, j*gap]); for (let i = 0; i < n; i++) pts.push([n*gap - i*gap, n*gap]); for (let j = 0; j < n; j++) pts.push([0, n*gap - j*gap]);
  const m = C.meshPolygon(pts, gap), k = m.xy.length/2, X = new Float32Array(3*k);
  for (let i = 0; i < k; i++) X.set([m.xy[2*i], 400 + 0.2*m.xy[2*i+1], m.xy[2*i+1]], 3*i);
  return { pieces: [{ xy: m.xy, tri: m.tri, X, fab: { weight: 150 } }], seams: [], pins: [{ p: 0, v: 0 }], opt: { substeps: 8 } };
}

test("B8 the worker is this file's own code: built from its text it steps the cloth exactly as the solver does in the page", () => {
  const src = C.workerSource();
  assert.ok(typeof src === "string" && src.length > 20000 && /clothStep/.test(src) && /self\.onmessage/.test(src));
  const w = new FakeWorker({ text: src }), out = [];
  w.onmessage = (e) => out.push(e.data);
  const spec = sheetSpec();
  w.postMessage({ t: "build", id: 7, spec, field: null }); w.pump();
  assert.deepStrictEqual(out[0], { t: "built", id: 7, n: spec.pieces[0].xy.length/2 });
  // the same cloth in the page
  const here = C.clothBuild({ ...sheetSpec(), field: null });
  for (let k = 0; k < 12; k++) { w.postMessage({ t: "step", id: 7 }); w.pump(); C.clothStep(here, 1/60); }
  const frames = out.filter(m => m.t === "frame");
  assert.strictEqual(frames.length, 12); assert.strictEqual(frames[11].frames, 12); assert.ok(frames[11].x instanceof Float32Array);
  assert.deepStrictEqual(Array.from(frames[11].x), Array.from(new Float32Array(here.x)), "to the last bit");
  assert.ok(frames[11].speed > 0 && Math.abs(frames[11].speed - C.clothSpeed(here)) < 1e-9);
  assert.ok(frames[11].x[1] === frames[0].x[1], "the pinned corner has not moved"); assert.ok(frames[11].x[4] < frames[0].x[4], "the rest is falling");
  // several steps in one message; a step for an earlier build is ignored; a pin holds a point where it is put
  w.postMessage({ t: "step", id: 7, n: 3 }); w.pump(); for (let k = 0; k < 3; k++) C.clothStep(here, 1/60);
  assert.deepStrictEqual(Array.from(out[out.length - 1].x), Array.from(new Float32Array(here.x)));
  const before = out.length; w.postMessage({ t: "step", id: 6 }); w.pump(); assert.strictEqual(out.length, before);
  w.postMessage({ t: "pin", i: 5, on: true, to: [1, 2, 3] }); w.postMessage({ t: "step", id: 7 }); w.pump();
  assert.deepStrictEqual(Array.from(out[out.length - 1].x.slice(15, 18)), [1, 2, 3]);
  // a build that can't be made is reported, not thrown away silently; stop forgets the cloth
  w.postMessage({ t: "build", id: 8, spec: { pieces: [{ xy: null }] } }); w.pump();
  assert.strictEqual(out[out.length - 1].t, "error"); assert.strictEqual(out[out.length - 1].id, 8);
  w.postMessage({ t: "stop" }); const n = out.length; w.postMessage({ t: "step", id: 7 }); w.pump(); assert.strictEqual(out.length, n);
});

test("B8 the body's distance field is sent once and kept by the worker until it changes", () => {
  const w = new FakeWorker({ text: C.workerSource() }), out = [];
  w.onmessage = (e) => out.push(e.data);
  // a floor of "body" under the cloth: a field that is negative below y = 300
  const nx = 12, ny = 12, nz = 12, cell = 40, d = new Float32Array(nx*ny*nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) d[(k*ny + j)*nx + i] = (j*cell) - 300;
  const field = { nx, ny, nz, cell, ox: -100, oy: 0, oz: -100, d, tris: 0 };
  const run = (msg) => { w.postMessage(msg); for (let k = 0; k < 90; k++) w.postMessage({ t: "step", id: msg.id }); w.pump(); const x = out[out.length - 1].x; let lo = Infinity; for (let i = 1; i < x.length; i += 3) lo = Math.min(lo, x[i]); return lo; };
  const free = { ...sheetSpec(), pins: [] };
  const on = run({ t: "build", id: 1, spec: free, field });
  assert.ok(on > 295, "the cloth lies on the body: lowest point " + on);
  const still = run({ t: "build", id: 2, spec: free });                 // no field in the message: the one it has is used
  assert.ok(still > 295, "still there without sending it again: " + still);
  const gone = run({ t: "build", id: 3, spec: free, field: null });     // the avatar was removed
  assert.ok(gone < 200, "no body any more: it falls on: " + gone);
});

function simApp(globals) {
  const { THREE } = three();
  const S = { pieces: [], seams: [], stitches: [], images: [], sel: [], nextSegId: 1, nextShapeId: 1, nextId: 1, unit: "mm", dec: 1, ui: { render: "front", layout: "both", show3d: {} }, cloth: null, lib: null, av: null, avSet: { cell: 16 },
    undo: [], redo: [], un: [], rn: [], sewCheck: { on: false, useLen: true, len: 2, useRatio: false, ratio: 2 }, drapeIn: null };
  const groups = {}, toasts = [], view3d = { group: (n) => groups[n] || (groups[n] = new THREE.Group()), ask() {}, ready: () => true, cam: { dist: 5000 }, tool() {}, camera: () => null, loop(f) { view3d.f = f; } };
  const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }) });
  const G = load(["V", "mkShape", "mkPiece", "normCloth", "normLib", "garmentSync", "G3", "SIM", "simStart", "simStop", "simFrame", "simBuild", "simPin", "simRead", "simWorker", "simMessage"],
    { S, THREE, SIM3D: C, view3d, document: { createElement: fakeCanvas }, Image: undefined, ui: () => {}, draw: () => {}, toast: (m) => toasts.push(m), refreshRail: () => {}, note3d: () => {}, setLayout: () => {}, renderTimeline: () => {}, ...globals });      // (a run is a step of the timeline since Round F: this page has none to draw)
  S.cloth = G.normCloth({ substeps: 6, res: 30 }); S.lib = G.normLib(null);
  // (Round FIX-3 / A: the 2D axis is the floor, so they are drawn 1 m above it to hang in the air)
  for (const x of [0, 400]) S.pieces.push(G.mkPiece("r" + x, G.mkShape([G.V(x, -1240), G.V(x + 200, -1240), G.V(x + 200, -1000), G.V(x, -1000)], true)));
  G.garmentSync();
  return { S, G, toasts, view3d, X: () => S.pieces.map(p => Array.from(G.G3.items.get(p.id).X)) };
}

test("B8 in the app the simulation runs in the worker: the page shows what the worker sends, asks for one step at a time, and ends up where the in-page solver does", () => {
  FakeWorker.broken = false;
  const a = simApp({ Worker: FakeWorker, Blob: FakeBlob, URL: { createObjectURL: (b) => b } });
  const start = a.X();
  a.G.simStart();
  const w = FakeWorker.last, sim = a.G.SIM.sim;
  assert.strictEqual(sim.remote, true); assert.deepStrictEqual(w.got, ["build"]);
  assert.strictEqual(sim.n, a.S.pieces.reduce((n, p) => n + a.G.G3.items.get(p.id).X.length/3, 0));
  // a frame of the page: nothing has come yet, so nothing moves, and one step is asked for (not two)
  a.G.simFrame(); a.G.simFrame();
  assert.deepStrictEqual(a.X(), start); assert.deepStrictEqual(w.got, ["build", "step"], "the page does not queue steps while the worker is busy");
  for (let k = 0; k < 20; k++) { w.pump(); a.G.simFrame(); }
  assert.strictEqual(w.got.filter(t => t === "step").length, 21);
  const moved = a.X();
  assert.ok(moved[0][1] < start[0][1] - 1, "the cloth is falling: " + start[0][1] + " -> " + moved[0][1]);
  assert.ok(a.G.G3.items.get(a.S.pieces[0].id).draped);
  // the same twenty steps with the solver in the page (no Worker in this browser)
  const b = simApp({ Worker: undefined, Blob: FakeBlob, URL: {} });
  b.G.simStart();
  assert.ok(!b.G.SIM.sim.remote && b.G.SIM.sim.x instanceof Float64Array);
  for (let k = 0; k < 20; k++) b.G.simFrame();
  assert.deepStrictEqual(moved, b.X(), "the same cloth, to the last bit");
  // Select/Move pulls a point: it is held by the worker, and let go again
  const i = sim.off[1] + 3;
  a.G.simPin(i, true, [10, 900, 20]); assert.strictEqual(sim.w[i], 0);
  for (let k = 0; k < 3; k++) { w.pump(); a.G.simFrame(); }
  assert.deepStrictEqual(a.X()[1].slice(9, 12), [10, 900, 20]);
  a.G.simPin(i, false); assert.ok(sim.w[i] > 0); assert.strictEqual(w.got.filter(t => t === "pin").length, 2);
  // the document changes while it runs: the solver is built again from where the cloth is, and a frame still on its way from the old one is dropped
  w.pump();                                                    // the old build's frame arrives …
  const gen = a.G.SIM.gen; a.S.cloth = a.G.normCloth({ ...a.S.cloth, substeps: 9 });
  a.G.simFrame();                                              // … and is shown; the change is seen, a new build goes out
  assert.strictEqual(a.G.SIM.gen, gen + 1); assert.strictEqual(w.got.filter(t => t === "build").length, 2);
  const held = a.X();
  const asked = w.got.length;
  a.G.simMessage({ t: "frame", id: gen, x: new Float32Array(a.G.SIM.sim.n*3), speed: 0, frames: 1, ms: 1 }); a.G.simFrame();
  assert.deepStrictEqual(a.X(), held, "a stale frame is not shown");
  assert.strictEqual(w.got.length, asked, "and it does not make the page ask for a second step");
  w.pump(); a.G.simFrame(); assert.notDeepStrictEqual(a.X(), held, "the new build's frame is");
  // stopping shows the last frame and tells the worker to forget the cloth
  w.pump(); a.G.simStop();
  assert.strictEqual(a.G.SIM.on, false); assert.strictEqual(w.got[w.got.length - 1], "stop");
});

test("B8 without a worker, with it switched off, or when it fails, the simulation runs in the page as before", () => {
  // switched off in Simulation Settings
  FakeWorker.broken = false; FakeWorker.last = null;
  const off = simApp({ Worker: FakeWorker, Blob: FakeBlob, URL: { createObjectURL: (b) => b } });
  off.S.cloth = off.G.normCloth({ ...off.S.cloth, worker: false });
  off.G.simStart();
  assert.ok(!off.G.SIM.sim.remote); assert.strictEqual(FakeWorker.last, null, "no worker was made");
  // a worker that can't be made
  const none = simApp({ Worker: class { constructor() { throw new Error("blocked"); } }, Blob: FakeBlob, URL: { createObjectURL: (b) => b } });
  none.G.simStart(); assert.ok(!none.G.SIM.sim.remote); none.G.simFrame();
  // a worker that stops answering properly while the cloth is simulated: one message, and on it goes in the page from where the cloth is
  const a = simApp({ Worker: FakeWorker, Blob: FakeBlob, URL: { createObjectURL: (b) => b } });
  a.G.simStart(); const w = FakeWorker.last;
  for (let k = 0; k < 5; k++) { a.G.simFrame(); w.pump(); }
  a.G.simFrame(); const at = a.X();
  a.G.simMessage({ t: "error", message: "out of memory" });
  const said = () => a.toasts.filter(t => /worker/.test(t));
  assert.strictEqual(said().length, 1); assert.ok(/out of memory/.test(said()[0]) && /in the window itself/.test(said()[0]));
  assert.ok(w.dead && !a.G.SIM.sim.remote && a.G.SIM.on);
  assert.deepStrictEqual(Array.from(new Float32Array(a.G.SIM.sim.x.slice(0, 6))), at[0].slice(0, 6), "it goes on from where the cloth was");
  a.G.simFrame(); a.G.simFrame();
  assert.ok(a.X()[0][1] < at[0][1], "and keeps falling");
  assert.strictEqual(said().length, 1);
});

module.exports = T;
