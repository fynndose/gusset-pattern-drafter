// Round r16: DXF both ways (grainline direction, corners and curve ends, holes), the differences of the second check
// session (Add Dart, Cut & Sew names, Notch Length, Link Lines), corner pictures, grade points and graded notches.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  // long options go through a file: a Windows command line holds at most 32 767 characters
  let arg = JSON.stringify(opt || {});
  if (arg.length > 30000) { const f = path.join(require("os").tmpdir(), "pdraft-boot-r16-" + process.pid + ".json"); fs.writeFileSync(f, arg); arg = "@" + f; }
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), arg], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
module.exports = T;
module.exports.boot = boot;

// the skirt block as it comes (no avatar: Marty's numbers), and the DXF options the Export DXF box opens with
const SKIRT = `
  const E = (n) => app.ev(n); S.pieces.length = 0; S.seams.length = 0;
  E("addBlock")("skirt", "simple", {}, { x: 0, y: 0 }); E("commit")();
  const OUT = { format: "aama", metric: true, scale: 1, rotate: 0, optimise: true, grading: false };
  const IN = { optimise: true, toSA: true, notches: true, internals: true, annotations: true };
  // the grainline LINEs (layer 7) of a DXF text, as [x1, y1, x2, y2]
  const grainLines = (text) => { const L = text.split(/\\r?\\n/), got = [];
    for (let i = 0; i + 1 < L.length; i += 2) if (L[i].trim() === "0" && L[i+1].trim() === "LINE") {
      const e = {}; let j = i + 2; for (; j + 1 < L.length && L[j].trim() !== "0"; j += 2) e[L[j].trim()] = L[j+1].trim();
      if (e["8"] === "7") got.push([+e["10"], +e["20"], +e["11"], +e["21"]]); }
    return got; };`;

/* ---- Batch 1: the grainline goes out bottom to top ---- */
test("r16 / B1 DXF: every grainline is written bottom to top (DXF y up), as DXF pattern files have it, whichever way its ends lie in ours; a level one right to left; read back, the angle is unchanged", () => {
  const o = boot({ blank: true, script: SKIRT + `
    const out = {};
    const text = E("dxfExport")(S.pieces, OUT, S.grading);
    out.lines = grainLines(text);
    // the skirt's own grainlines run top to bottom in ours (a at the hip, b towards the hem)
    out.ours = S.pieces.map(p => { const g = E("grainOf")(p); return g.b.y > g.a.y; });
    const back = E("dxfImport")(text, IN);
    out.angles = S.pieces.map((p, k) => [E("grainAngle")(E("grainOf")(p)), E("grainAngle")(back.pieces[k].grain)]);
    // a grainline turned 30° and one at -60°, each drawn both ways round in ours
    const p = S.pieces[0], mid = { x: 120, y: 400 };
    out.turned = [30, -60, 0].map(deg => [false, true].map(flip => {
      E("grainSet")(p, mid, deg, 300); if (flip) p.grain = { a: p.grain.b, b: p.grain.a };
      const t = E("dxfExport")([p], OUT, S.grading), [ln] = grainLines(t), q = E("dxfImport")(t, IN).pieces[0];
      return [+(ln[3] - ln[1]).toFixed(3), +E("grainAngle")(q.grain).toFixed(6)]; }));
    // turned with the export's Rotate the line turns with the pattern and still reads as the pattern's own grain
    out.rot = grainLines(E("dxfExport")([S.pieces[0]], { ...OUT, rotate: 90 }, S.grading))[0];
    return out;` }).result;
  assert.deepStrictEqual(o.ours, [true, true, true, false], "the three skirt panels' grainlines run downwards in ours; the waistband's is level");
  assert.strictEqual(o.lines.length, 4);
  for (const [x1, y1, x2, y2] of o.lines.slice(0, 3)) assert.ok(y2 > y1 && Math.abs(x2 - x1) < 1e-6, "an upright grainline runs upwards in the file: " + [x1, y1, x2, y2]);
  const [wx1, wy1, wx2, wy2] = o.lines[3];
  assert.ok(wx2 < wx1 && Math.abs(wy2 - wy1) < 1e-6, "the waistband's level grainline runs right to left (grainAngle's +90°): " + o.lines[3]);
  for (const [a, b] of o.angles) near(b, a, 1e-6, "the grain angle read back");
  for (const [k, deg] of [[0, 30], [1, -60], [2, 0]]) for (const [dy, ang] of o.turned[k]) {
    assert.ok(dy > 0, "drawn upwards at " + deg + "°, whichever end came first in ours");
    near(ang, deg, 1e-4, "read back at " + deg + "°");
  }
  assert.ok(o.rot[2] > o.rot[0] && Math.abs(o.rot[3] - o.rot[1]) < 1e-6, "with Rotate 90° (clockwise on the screen, y down) the upward line turns with the pattern and points right: " + o.rot);
});

/* ---- Batch 2: corners and curve ends ---- */
// the angle inside the outline at each point, from the two lines' own directions there (segTan), in degrees
const ANGLES = `
  const angles = (p) => p.pts.map((_, i) => { const n = p.pts.length, t0 = E("segTan")(p, (i + n - 1) % n, 1), t1 = E("segTan")(p, i, 0);
    return Math.acos(Math.max(-1, Math.min(1, -(t0.x*t1.x + t0.y*t1.y))))*180/Math.PI; });`;
test("r16 / B2 DXF: the skirt exported and read back keeps every point of its outline (the hip point between the side's curve and its straight part among them, on layer 2) and every corner's angle to 0.05°", () => {
  const o = boot({ blank: true, script: SKIRT + ANGLES + `
    const text = E("dxfExport")(S.pieces, OUT, S.grading), back = E("dxfImport")(text, IN);
    // the hip point of the back: where the side's curve meets its straight part, the line going on smoothly (180°)
    const B = S.pieces[1], hip = B.pts.findIndex((q, i) => i > 0 && Math.abs(angles(B)[i] - 180) < 1e-6 && B.segs[i - 1].curved && !B.segs[i].curved);
    const layer2 = text.split("Skirt_back_2")[1].split("ENDBLK")[0].split(/\\n/).reduce((acc, l, i, L) => { if (l === "POINT" && L[i + 2] === "2") acc.push([+L[i + 4], +L[i + 6]]); return acc; }, []);
    return { hip: hip >= 0 ? [B.pts[hip].x, B.pts[hip].y] : null, layer2,
      pieces: S.pieces.map((p, k) => { const q = back.pieces[k];
        return { name: p.name, n: [p.pts.length, q.pts.length], far: Math.max(...p.pts.map((v, i) => q.pts[i] ? Math.hypot(v.x - q.pts[i].x, v.y - q.pts[i].y) : 1e9)),
          a: angles(p), b: angles(q), lens: p.segs.map((_, i) => E("segLen")(p, i) - E("segLen")(q, i)) }; }) };` }).result;
  assert.ok(o.hip, "the back has a hip point");
  assert.ok(o.layer2.some(([x, y]) => Math.abs(x - o.hip[0]) < 1e-3 && Math.abs(y + o.hip[1]) < 1e-3), "it is written as a turn point (layer 2)");
  for (const p of o.pieces) {
    assert.strictEqual(p.n[1], p.n[0], p.name + ": every point comes back");
    assert.ok(p.far < 0.01, p.name + ": in its place, " + p.far);
    p.a.forEach((a, i) => near(p.b[i], a, 0.05, p.name + " corner " + i + ":"));
    p.lens.forEach((d, i) => near(d, 0, 0.3, p.name + " line " + i + " length:"));
  }
});

test("r16 / B2 DXF: each curve's first and last written point lies 1 mm from its corner, on the curve; a curve-point curve and a handle curve meeting lines smoothly or at an angle come back with their corners to 0.05°", () => {
  const o = boot({ blank: true, script: `const E = (n) => app.ev(n);` + ANGLES + `
    S.pieces.length = 0;
    // a square whose top is a curve-point curve, whose right side leaves the top corner smoothly as a handle curve, then straight
    const sh = app.mkShape([{x:0,y:0},{x:300,y:0},{x:320,y:200},{x:320,y:500},{x:0,y:500}], true);
    sh.segs[0].curved = true; sh.segs[0].cps = [{x:80,y:-30},{x:160,y:-38},{x:240,y:-25}];
    sh.segs[1].curved = true; sh.segs[1].c1 = {x:310,y:40}; sh.segs[1].c2 = {x:320,y:140};
    const p = app.mkPiece("Test", sh); S.pieces.push(p); E("commit")();
    const text = E("dxfExport")([p], { format: "aama", metric: true, optimise: true }, S.grading), back = E("dxfImport")(text, { optimise: true });
    const doc = E("dxfParse")(text), line = doc.blocks[Object.keys(doc.blocks)[0]].find(e => e.layer === "1").pts.map(q => ({ x: q.x, y: -q.y }));
    const first = (i) => { const k = line.findIndex(q => Math.hypot(q.x - p.pts[i].x, q.y - p.pts[i].y) < 1e-3); return [Math.hypot(line[k + 1].x - line[k].x, line[k + 1].y - line[k].y), E("locateOn")(p, line[k + 1]).d]; };
    const last = (i) => { const k = line.findIndex(q => Math.hypot(q.x - p.pts[i].x, q.y - p.pts[i].y) < 1e-3); return Math.hypot(line[k - 1].x - line[k].x, line[k - 1].y - line[k].y); };
    return { first: [first(0), first(1)], last: [last(1), last(2)], a: angles(p), b: angles(back.pieces[0]), n: back.pieces[0].pts.length };` }).result;
  for (const [d, off] of o.first) { near(d, 1, 0.01, "the first point after a corner"); assert.ok(off < 1e-3, "on the curve: " + off); }
  for (const d of o.last) near(d, 1, 0.01, "the last point before a corner");
  assert.strictEqual(o.n, 5);
  near(o.a[2], 180, 1e-6, "the handle curve leaves into the straight side smoothly");
  o.a.forEach((a, i) => near(o.b[i], a, 0.05, "corner " + i + ":"));
});

/* ---- Batch 3: holes ---- */
test("r16 / B3 DXF: a hole goes out as an internal cutout (a closed polyline on layer 11, its corners on layer 2), not as an internal line; read back from layer 11 it is a hole again, the internal line still a line", () => {
  const o = boot({ blank: true, script: `const E = (n) => app.ev(n);
    S.pieces.length = 0;
    const p = app.mkPiece("Holed", app.mkShape([{x:0,y:0},{x:400,y:0},{x:400,y:500},{x:0,y:500}], true));
    E("addChild")(p, "internals", Object.assign(app.mkShape([{x:150,y:200},{x:250,y:200},{x:250,y:260},{x:150,y:260}], true), { hole: true }));
    E("addChild")(p, "internals", app.mkShape([{x:200,y:300},{x:200,y:450}], false));
    S.pieces.push(p); E("commit")();
    const text = E("dxfExport")([p], { format: "aama", metric: true, optimise: true }, S.grading), doc = E("dxfParse")(text);
    const ents = doc.blocks[Object.keys(doc.blocks)[0]], on = (L, t) => ents.filter(e => e.layer === String(L) && (!t || e.type === t));
    const back = E("dxfImport")(text, { optimise: true }).pieces[0], off = E("dxfImport")(text, { optimise: true, internals: false }).pieces[0];
    const kids = (q) => q.internals.map(it => [!!it.hole, it.closed, it.pts.map(v => [+v.x.toFixed(3), +v.y.toFixed(3)])]);
    return { l11: on(11, "POLY").map(e => [e.closed, e.pts.map(v => [v.x, v.y])]), l8: on(8, "POLY").length,
      l2: on(2, "POINT").map(e => [e.p.x, e.p.y]), back: kids(back), off: kids(off), holes: E("holesOf")(back).length };` }).result;
  assert.deepStrictEqual(o.l11, [[true, [[150, -200], [250, -200], [250, -260], [150, -260]]]], "the hole on layer 11, closed, y up");
  assert.strictEqual(o.l8, 1, "only the internal line on layer 8");
  for (const q of o.l11[0][1]) assert.ok(o.l2.some(r => r[0] === q[0] && r[1] === q[1]), "the hole's corner " + q + " is a turn point");
  assert.deepStrictEqual(o.back, [[false, false, [[200, 300], [200, 450]]], [true, true, [[150, 200], [250, 200], [250, 260], [150, 260]]]], "read back: the line, then the hole");
  assert.strictEqual(o.holes, 1);
  assert.deepStrictEqual(o.off, [[true, true, [[150, 200], [250, 200], [250, 260], [150, 260]]]], "a hole is part of the cut piece: read with Trace internal lines off too");
});

/* ---- Batch 4: the differences of the second check session ---- */
// a 200 × 300 rectangle A at the origin, Edit Pattern in hand; at(x, y) its screen place
const RECT = `
  const E = (n) => app.ev(n); S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("Test", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true));
  S.pieces.push(A); S.sel = []; app.commit(); S.undo.length = 0; S.un.length = 0;
  const at = (x, y) => app.toS({ x, y }), out = {};`;
test("r16 / B4 Add Dart (F/9): Total Width and Dart Arm Width are tied both ways, Total = 2 × Arm (typing Arm 5 makes Total 10, Total 30 makes Arm 15), and the dart is even about the point", () => {
  const o = boot({ blank: true, script: RECT + `
    E("addPoint")(A, 0, 0.5); app.commit(); app.setTool("edit_pattern");
    const s = at(100, 0);
    app.answer = (t, f, opts) => { out.dialog = f.map(x => [x.k, x.val]);
      out.sync = [opts.sync({ total: 20, arm: 5, len: 70 }, "arm"), opts.sync({ total: 30, arm: 10, len: 70 }, "total"), opts.sync({ total: 20, arm: 10, len: 50 }, "len")];
      return { total: 10, arm: 5, len: 70, cap: false }; };
    app.menuClick(s.x, s.y, "Add Dart");
    out.pts = A.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
    return out;` }).result;
  assert.deepStrictEqual(o.dialog, [["total", 20], ["arm", 10], ["len", 70]]);
  assert.deepStrictEqual(o.sync, [{ total: 10 }, { arm: 15 }, {}], "Arm 5 → Total 10; Total 30 → Arm 15; Length leaves both alone");
  assert.deepStrictEqual(o.pts, [[0, 0], [95, 0], [100, 70], [105, 0], [200, 0], [200, 300], [0, 300]], "5 mm either side of the point, the opening 10 mm, as the check video showed");
});

test("r16 / B4 Cut & Sew (r12/9a): neither half keeps the old name; cut across, the upper half is \"Test 1\" and the lower \"Test 2\"; cut up and down, the left is 1 and the right 2; the grainline's half keeps the pattern's id; Cut names them so too; undo brings \"Test\" back", () => {
  const run = (line, grain, cmd) => boot({ blank: true, script: RECT + `
    E("addChild")(A, "internals", app.mkShape(${JSON.stringify(line)}, false));
    A.grain = ${JSON.stringify(grain)}; app.commit(); S.undo.length = 0;
    app.setTool("edit_pattern");
    const m = ${JSON.stringify(line)}, mid = at((m[0].x + m[1].x)/2, (m[0].y + m[1].y)/2);
    app.menuClick(mid.x, mid.y, ${JSON.stringify(cmd)}, "edit_pattern");
    out.halves = S.pieces.map(p => { const b = app.bboxOf([p]); return [p.name, p.id === A.id, Math.round(b.x0), Math.round(b.y0)]; });
    app.undo(); out.undone = S.pieces.map(p => p.name);
    return out;` }).result;
  const across = run([{x:10,y:150},{x:190,y:150}], { a: {x:100,y:250}, b: {x:100,y:280} }, "Cut & Sew");
  assert.deepStrictEqual(across.halves, [["Test 2", true, 0, 150], ["Test 1", false, 0, 0]], "the lower half (with the grainline) keeps the id and is Test 2; the upper is Test 1");
  assert.deepStrictEqual(across.undone, ["Test"]);
  const upDown = run([{x:100,y:10},{x:100,y:290}], { a: {x:150,y:100}, b: {x:150,y:200} }, "Cut & Sew");
  assert.deepStrictEqual(upDown.halves, [["Test 2", true, 100, 0], ["Test 1", false, 0, 0]], "side by side: the left is 1, the right (with the grainline) 2");
  const cut = run([{x:10,y:150},{x:190,y:150}], { a: {x:100,y:20}, b: {x:100,y:60} }, "Cut");
  assert.deepStrictEqual(cut.halves, [["Test 1", true, 0, 0], ["Test 2", false, 0, 150]], "Cut alike; here the upper half has the grainline and keeps the id");
});

test("r16 / B4 Notch Length (r13/3): greyed in the Property Editor with a Custom angle too; a length stored on a notch (an older file's) is shown, drawn, saved and opened as it was; Notch Settings still sets the document's length", () => {
  const o = boot({ blank: true, script: RECT + `
    return (async () => {
      app.setTool("notch"); const s = at(100, 0); app.click(s.x, s.y);
      const look = (v) => E("setNotchLook")(v), pe = () => app.el("props").innerHTML, seg0 = () => A.segs[0].notches;
      look({ angle: 30 }); E("ui")(); out.custom = [/id="sn-len"[^>]*disabled/.test(pe()), /<option value="c" selected>/.test(pe())];
      look({ len: 14 }); E("ui")(); out.stored = [JSON.parse(JSON.stringify(seg0())), /id="sn-len"[^>]*value="14"[^>]*disabled/.test(pe())];
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      app.ev("openFile")("n.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened n/.test(x)), "the file to open");
      out.opened = JSON.parse(JSON.stringify(S.pieces[0].segs[0].notches));
      app.answer = (t, f) => { out.settings = [t, f.find(x => x.k === "len").ro !== true]; return null; };
      E("notchNumeric")({ x: 0, y: 0 });
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.custom, [true, true], "Custom angle, Length greyed");
  assert.deepStrictEqual(o.stored, [[{ t: 0.5, angle: 30, len: 14 }], true], "a stored length is shown, greyed");
  assert.deepStrictEqual(o.opened, [{ t: 0.5, angle: 30, len: 14 }], "kept in the file");
  assert.deepStrictEqual(o.settings, ["Notch Settings", true], "the document's length can be typed in Notch Settings");
});

test("r16 / B4 Link Lines (R4/link-lines): linked lines change together, by as much; Change Length on one leaves the other as it was, and afterwards they still change together, keeping their difference", () => {
  const o = boot({ blank: true, script: RECT + `
    const B = app.mkPiece("B", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:300},{x:300,y:300}], true)); S.pieces.push(B); app.commit();
    // (read through S.pieces: undo puts new objects in their place)
    const L = () => S.pieces.map(p => +E("segLen")(p, 1).toFixed(3));
    E("linkLines")([{ p: A, sh: A, i: 1 }, { p: B, sh: B, i: 1 }]); app.commit(); out.linked = L();
    // an ordinary edit: A's right side made 20 longer by moving its bottom corner down (what a drag does): B's follows
    E("push")(); A.pts[2] = { x: 200, y: 320 }; A.pts[3] = { x: 0, y: 320 }; app.commit(); out.edit = L();
    // Change Length on B's right side: 250; A's stays
    app.answer = () => ({ len: 250, move: "end", lock: false }); E("segLengthNumeric")({ x: 0, y: 0 }, B, 1); out.change = L();
    out.steps = app.histSteps().steps.map(x => x.n).slice(-1);
    // again an ordinary edit on A: 10 shorter; B's 10 shorter too
    E("push")(); A.pts[2] = { x: 200, y: 310 }; A.pts[3] = { x: 0, y: 310 }; app.commit(); out.after = L();
    app.undo(); out.undone = L();
    return out;` }).result;
  assert.deepStrictEqual(o.linked, [300, 300]);
  assert.deepStrictEqual(o.edit, [320, 320], "B's side follows A's");
  assert.deepStrictEqual(o.change, [320, 250], "Change Length leaves the linked line alone");
  assert.deepStrictEqual(o.after, [310, 240], "still linked: both 10 shorter");
  assert.deepStrictEqual(o.undone, [320, 250]);
});

/* ---- Batch 5: the corner pictures ---- */
test("r16 / B5 the corner pictures as the reference's list draws them: Perpendicular cuts square to the level line and Turnback turns back on it; Envelope on a square corner; Pocket a whole pocket stepped at its two upper corners; Dart Cap a dart with its cap above", () => {
  const { load } = require("./harness");
  const { cornerIcon } = load(["cornerIcon"]);
  // the pictures' paths as point lists: [seam, cut]; and the dots
  const parse = (t) => { const svg = cornerIcon(t), paths = [...svg.matchAll(/d="M([^"]+)"/g)].map(m => m[1].replace(/ Z$/, "").split(" L").map(q => q.split(" ").map(Number)));
    return { svg, seam: paths[0], cut: paths[1], dots: [...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)"/g)].map(m => [+m[1], +m[2]]) }; };
  for (const t of ["ext", "perp", "turn", "slant", "round", "env", "dartcap", "pocket"]) assert.match(parse(t).svg, /^<svg class="cic" viewBox="0 0 32 30"/, t);
  const perp = parse("perp"), P = perp.dots[0];
  // Perpendicular: the cut's last stretch before the level line's cut line is upright (square to the level line), right of the point
  const k = perp.cut.length - 2, [x1, y1] = perp.cut[k - 1], [x2, y2] = perp.cut[k];
  assert.ok(Math.abs(x1 - x2) < 0.05 && y2 > y1 && x1 > P[0], "an upright drop right of the corner point: " + JSON.stringify(perp.cut));
  near(y1, P[1], 0.05, "from the level line's seam line");
  // Turnback: the slanted line's cut line ends on the level line's seam line, then turns back down to the left
  const turn = parse("turn"), [tx0, ty0] = turn.cut[1], [tx1, ty1] = turn.cut[2];
  near(ty0, P[1], 0.05, "Turnback turns at the level line's seam line"); assert.ok(tx1 < tx0 && ty1 > ty0, "and goes back down to the left");
  const env = parse("env");
  assert.ok(Math.abs(env.seam[0][0] - env.seam[1][0]) < 1e-9 && Math.abs(env.seam[1][1] - env.seam[2][1]) < 1e-9, "Envelope on a square corner: an upright line and a level one");
  // (REC-SHORT, the sixth check session: Envelope's cut bends in to the corner's middle, a shallow V: one point more than the straight cut)
  assert.ok(env.cut.length === 5, "its cut line cut off across the corner, bent in at its middle: " + JSON.stringify(env.cut));
  const pocket = parse("pocket");
  assert.match(pocket.svg, / Z"/); assert.strictEqual(pocket.seam.length, 5, "a five-sided pocket"); assert.strictEqual(pocket.dots.length, 2, "its two upper corners marked");
  assert.ok(Math.max(...pocket.seam.map(q => q[1])) === pocket.seam[3][1] && pocket.seam[3][0] === 16, "pointing down");
  assert.strictEqual(pocket.cut.length, 2*3 + 3, "a step (three points) at each upper corner, a point at each other corner");
  const cap = parse("dartcap");
  assert.strictEqual(cap.dots.length, 1); assert.ok(cap.dots[0][1] > 20, "the dart's point at the bottom");
  assert.ok(Math.min(...cap.cut.map(q => q[1])) < Math.min(...cap.seam.map(q => q[1])), "the cap above the outline");
});

/* ---- Batch 6: grade points and graded notches ---- */
// (Round r33 / 4) graded on the size run every document had before r33 (a document starts with none since): oldSizeRun
test("r16 / B6 with Show Grading on, every size's grade points are dots in that size's colour (I2/1) and every size's notches are drawn, graded with their line (I2/7), on a pattern that is not selected; with it off only the size picked, with its dots and notches", () => {
  const o = boot({ oldSizeRun: true,  blank: true, script: RECT + `
    const G = S.grading, grp = G.groups[0], L = grp.sizes.find(z => z.id === 4), look = (z) => E("gradeLook")(G, grp, z);
    A.segs[1].notches.push(0.5);                                     // a notch half way down the right side
    E("setPtDelta")(G, A, A, 2, 4, 30, 60); E("setPtDelta")(G, A, A, 1, 4, 30, 0);   // in L: the right side 30 out, its bottom 60 down
    app.commit(); S.sel = [];
    const c = app.ev("ctx"), marks = [], lines = []; let path = [], cur = [];
    c.beginPath = () => { path = []; cur = []; }; c.arc = (x, y, r) => path.push({ x, y, r }); c.moveTo = (x, y) => { cur = [[x, y]]; }; c.lineTo = (x, y) => cur.push([x, y]);
    c.fill = () => path.forEach(a => marks.push({ ...a, fill: c.fillStyle })); c.stroke = () => { if (cur.length === 2) lines.push({ pts: cur.slice(), col: c.strokeStyle }); };
    const drawn = () => { marks.length = 0; lines.length = 0; E("draw")(); return { marks: marks.slice(), lines: lines.slice() }; };
    const scr = (x, y) => app.toS({ x, y }), near = (m, q, r) => Math.hypot(m.x - q.x, m.y - q.y) < 1 && m.r === r;
    const Lq = E("gradedPiece")(G, A, 4), nL = E("notchMarks")(Lq, { ...S.notch, dup: false })[0].map(q => app.toS(q));
    const hasNotch = (d, col) => d.lines.some(l => l.col === col && Math.hypot(l.pts[0][0] - nL[0].x, l.pts[0][1] - nL[0].y) < 0.5 && Math.hypot(l.pts[1][0] - nL[1].x, l.pts[1][1] - nL[1].y) < 0.5);
    S.show.grading = true; let d = drawn();
    out.on = { dotL: d.marks.some(m => near(m, scr(230, 360), 3) && m.fill === look(L).color), dotBase: d.marks.some(m => near(m, scr(200, 300), 3) && m.fill === "#1a1a1a"),
      notchL: hasNotch(d, look(L).color), noRing: !d.marks.some(m => m.r === 6), Lnotch: Lq.pts.length && [+(Lq.pts[1].x).toFixed(1), +(Lq.pts[2].y).toFixed(1)] };
    S.show.grading = false; G.active = null; d = drawn(); out.off = [d.marks.filter(m => m.r === 3).length, hasNotch(d, look(L).color)];
    G.active = 4; d = drawn(); out.picked = [d.marks.some(m => near(m, scr(230, 360), 3) && m.fill === look(L).color), hasNotch(d, look(L).color)];
    return out;` }).result;
  assert.deepStrictEqual(o.on, { dotL: true, dotBase: true, notchL: true, noRing: true, Lnotch: [230, 360] }, "L's grade point a dot in L's colour where L has it, the base's dark; L's notch at its graded place; no ring");
  assert.deepStrictEqual(o.off, [0, false], "off, with no size picked: none");
  assert.deepStrictEqual(o.picked, [true, true], "the size picked: its dots and its notch");
});

/* ---- Batch 7: a project file saved showing a size that is not its table's base ---- */
test("r16 / B7 a project file drawn in the size it was saved showing (L), whose size table names M as its base, opens with L as the base, so every size, the base too, is the file's outline in that size; one drawn in its table's base (M) keeps M and shows L", async () => {
  const ZPRJ = require("../zprj-import.js"), MK = require("./zprj-make");
  const ring = (n) => Array.from({ length: n }, (_, i) => ({ start: i, end: (i + 1) % n }));
  const sizes = [[[5, 5], [0, 0], [-6, -5]], [[290, 4], [300, 0], [312, -5]], [[292, 390], [300, 400], [311, 412]], [[6, 392], [0, 400], [-5, 410]]];
  const pat = (k) => ({ name: "BODY_1", annotation: "Body", transform: [1, 0, 0, 0, 1, 0, 0, 0, 1], gradeRule: "Body sizes", points: sizes.map(s => s[k]), sizes, lines: ring(4) });
  const table = MK.list([MK.ruleTable({ name: "Body sizes", sizes: ["S", "M", "L"], base: 1, current: 2, colors: [[1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1]] })]);
  const run = async (k) => { const r = await ZPRJ.importZprj(MK.zprj([], { pac: MK.pac([pat(k)], { listRuleTables: table }) }));
    return boot({ blank: true, script: `const r = ${JSON.stringify(r)}; app.ev("zprjTake")("t.zprj", r, {});
      const G = S.grading, g = G.groups[0], P = S.pieces[0], X = (q) => [+q.x.toFixed(3), +(-q.y).toFixed(3)];
      return { base: g.sizes.find(z => z.id === g.base).name, shown: G.active == null ? null : g.sizes.find(z => z.id === G.active).name,
        outlines: g.sizes.map(z => (app.ev("gradedPiece")(G, P, z.id) || P).pts.map(X)) };` }).result; };
  const L = await run(2), M = await run(1);
  // (the file's 2D window is y up: X() turns y back)
  const want = [0, 1, 2].map(k => sizes.map(s => s[k]));
  assert.deepStrictEqual([L.base, L.shown], ["L", null], "drawn in L, the size it was saved showing: L is the base, and shown");
  assert.deepStrictEqual(L.outlines, want, "every size the file's, M (the table's base) too");
  assert.deepStrictEqual([M.base, M.shown], ["M", "L"], "drawn in M: M stays the base, L is shown");
  assert.deepStrictEqual(M.outlines, want);
});

module.exports.SKIRT = SKIRT;
