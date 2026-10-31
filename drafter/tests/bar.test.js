// Round B / B8 and B3d: the release bar as a test. One run in the booted app for each garment, on a preset avatar:
//   drafted   a skirt from the block (the Block button and its dialog, as it comes); a T-shirt drawn from scratch with the Polygon tool
//   sewn      the block's own seams; the T-shirt's with Segment Sewing, a click an edge
//   arranged  with the gizmo: a pattern is clicked in the 3D window, an arrow or a ring is dragged, a right-click takes the value;
//             the T-shirt's sleeves with arrangement points: the sleeve is clicked, then the point on its arm
//   draped    by the simulation (the solver in the page: the test has no worker)
//   saved and opened again: the same drape, point for point, and the camera, the settings and the avatar's record with it
//   printed   the sheet plan at true size
// The file is saved as the program saves it in a browser and in the desktop app: packed with the platform's deflate.
// THE AVATARS are Marty and Jessica as they are since Round B / B3 (a skeleton each, an A-pose). Each is loaded by the test:
// the program starts with none. Nothing here is fitted to them by hand: the block's dialog is taken as it comes, which is
// with the loaded avatar's own measurements in it, and the T-shirt is an ordinary one. A seam that does not close in this
// test is a fault of the program, not a number to change here.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const has = (id) => fs.existsSync(path.join(__dirname, "..", "assets", "avatar", "presets", id + ".glb"));
function boot(script) {
  const f = path.join(os.tmpdir(), "pdraft-boot-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify({ blank: true, three: true, streams: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 12 }) }, script: "return (async () => {" + script + " return out; })();" }));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 });
    if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed after 300 s)");
    if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
    return JSON.parse(r.stdout);
  } finally { fs.rmSync(f, { force: true }); }
}
// a saved file's parts, read with Node's own inflate
function partsOf(buf) {
  const b = Buffer.from(buf), out = {};
  let e = b.length - 22;
  while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  let o = b.readUInt32LE(e + 16);
  for (let k = b.readUInt16LE(e + 10); k > 0; k--) {
    const method = b.readUInt16LE(o + 10), cs = b.readUInt32LE(o + 20), nl = b.readUInt16LE(o + 28), at = b.readUInt32LE(o + 42), name = b.toString("utf8", o + 46, o + 46 + nl);
    const d0 = at + 30 + b.readUInt16LE(at + 26) + b.readUInt16LE(at + 28), raw = b.subarray(d0, d0 + cs);
    out[name] = { method, packed: cs, data: method === 8 ? zlib.inflateRawSync(raw) : raw };
    o += 46 + nl + b.readUInt16LE(o + 30) + b.readUInt16LE(o + 32);
  }
  return out;
}

/* What both garments do in the booted app. The mouse in the 3D window is the Select/Move tool's own handlers, with events as
   the window gives them (it is 1000 x 800 pixels); every place clicked is worked out from where the thing is on the screen. */
const LIB = (avatar) => `
  const out = {}, T3 = app.TOOL3.select_move, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE"), C = app.ev("SIM3D");
  app.ev("setLayout")("both");
  app.ev("avatarLoaded")(app.read("../assets/avatar/presets/${avatar}.glb"), "${avatar}.glb", null, true); await app.wait(() => S.av, "the avatar");
  const byName = (n) => S.pieces.find(p => p.name === n), item = (p) => G3.items.get(p.id);
  const cam = (az, el, dist) => Object.assign(v3.cam, { az, el, dist: dist || 4200, tx: 0, ty: 1000, tz: 0 });
  const ev = (x, y, more) => ({ clientX: x, clientY: y, button: 0, buttons: 1, ...more });
  const geom = () => app.ev("gizGeom")(), AX = (k) => app.ev("GIZ_AX").find(a => a.k === k);
  // (Round r15 / 8: Gizmo ▸ opens at Screen Coordinate; the patterns are arranged along the 3D window's own axes, so World
  // Coordinate is chosen first, as one would in the program. A setting of the gizmo only: nothing of the skirt or its fit)
  app.setPrefs({ gizSpace: "world" });
  // the middle of a pattern's cloth as it stands
  const mid3 = (p) => { const it = item(p), n = it.X.length/3; let x = 0, y = 0, z = 0; for (let i = 0; i < it.X.length; i += 3) { x += it.X[i]; y += it.X[i+1]; z += it.X[i+2]; } return new THREE.Vector3(x/n, y/n, z/n); };
  // the dialogs: a typed distance or angle for the gizmo's box; any other dialog (the block's) is taken as it comes, nothing typed over
  let typed = null; const asked = [], given = [];
  app.answer = (title, fields, opts) => { asked.push(title); if (typed !== null && /^(Move|Turn)/.test(title)) return { v: typed }; given.push(fields.map(f => [f.k, f.val])); return { ...Object.fromEntries(fields.map(f => [f.k, f.val])), ...Object.fromEntries((opts.selects || []).map(c => [c.k, c.val])) }; };
  // a click on a pattern in the 3D window, seen from the front: it is selected and gets the gizmo.
  // (Somewhere on its cloth where no handle of the gizmo on the pattern picked before lies over it.)
  const pick = (p) => {
    cam(0, 0.03, 6000);
    const it = item(p), n = it.X.length/3, tries = [mid3(p)];
    for (let k = 0; k < 40; k++) { const v = Math.floor((k + 0.5)/40*n); tries.push(new THREE.Vector3((it.X[3*v] + 3*tries[0].x)/4, (it.X[3*v+1] + 3*tries[0].y)/4, (it.X[3*v+2] + 3*tries[0].z)/4)); }
    for (const q of tries) {
      const s = v3.project(q), e = ev(s.x, s.y), h = app.ev("garmentHit")(v3.ray(e));
      if (app.ev("gizHit")(e) || !h || h.p.id !== p.id) continue;
      if (T3.down(e)) T3.up(e);
      break;
    }
    if (S.sel.join() !== String(p.id) || !G3.giz || G3.giz.pid !== p.id) throw new Error("the click did not select " + p.name);
  };
  // an arrow of the gizmo dragged a little, then a right-click and the distance typed; the same for a ring and its angle
  const move = (axis, mm) => {
    if (Math.abs(mm) < 1e-6) return;
    cam(0.6, 0.35, 6000);
    const g = geom(), a = v3.project(app.ev("gizTip")(g, AX(axis), 0.45)), b = v3.project(app.ev("gizTip")(g, AX(axis), 0.9));
    if (app.ev("gizHit")(ev(a.x, a.y)).id !== "move:" + axis) throw new Error("the " + axis + " arrow was not under the pointer");
    typed = mm; T3.down(ev(a.x, a.y)); T3.move(ev(b.x, b.y)); T3.move(ev(b.x, b.y, { button: 2, buttons: 3 })); typed = null;
    if (T3.d) throw new Error("the typed distance did not end the drag");
  };
  const turn = (axis, deg) => {
    if (Math.abs(deg) < 1e-6) return;
    cam(0.6, 0.35, 6000);
    const g = geom(); let a = null;
    for (let f = 0.3; f < 6.2 && !a; f += 0.37) { const q = v3.project(app.ev("gizRingPt")(g, AX(axis), f)), h = app.ev("gizHit")(ev(q.x, q.y)); if (h && h.id === "turn:" + axis) a = q; }
    if (!a) throw new Error("the " + axis + " ring was not under the pointer");
    typed = deg; T3.down(ev(a.x, a.y)); T3.move(ev(a.x + 9, a.y + 4)); T3.move(ev(a.x + 9, a.y + 4, { button: 2, buttons: 3 })); typed = null;
    if (T3.d) throw new Error("the typed angle did not end the drag");
  };
  // one pattern arranged with the gizmo: turned first (about the place the gizmo sits on), then moved until the middle of its cloth is at "to"
  const arrange = (p, to, turns) => {
    pick(p);
    for (const [axis, deg] of turns || []) turn(axis, deg);
    for (const [k, axis] of [[0, "x"], [1, "y"], [2, "z"]]) move(axis, to[k] - mid3(p).getComponent(k));
  };
  // an arrangement point: the pattern is clicked, then the blue point (the points are shown with Shift+F)
  const onPoint = (p, id) => {
    if (!S.ui.arrPts) app.setArrPoints(true);
    pick(p);
    v3.scene().updateMatrixWorld(true);                         // (as a drawn frame does)
    const dot = v3.group("arr").children.find(c => c.userData.pt.id === id), q = v3.project(dot.position), e = ev(q.x, q.y);
    if (app.ev("arrHit")(v3.ray(e)) !== dot.userData.pt) throw new Error("the point " + id + " was not under the pointer");
    T3.down(e); T3.up(e);
  };
  // every seam as it hangs: [id, the mean distance between the places sewn together, the largest] in mm
  const seamGaps = () => app.SIM.seams.filter(sm => !sm.dart).map(sm => { const a = [0, 0, 0], b = [0, 0, 0]; let d = 0, worst = 0; for (const [A, B] of sm.pairs) { app.ev("anchorPos")(A, app.SIM.order, a); app.ev("anchorPos")(B, app.SIM.order, b); const g = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); d += g; worst = Math.max(worst, g); } return [sm.id, +(d/sm.pairs.length).toFixed(1), +worst.toFixed(1)]; });
  // (out.ms: the mean time of a frame of the solver, for the report)
  const simulate = (frames) => { app.ev("simStart")(); const t0 = Date.now(); for (let i = 0; i < frames; i++) app.ev("simFrame")(); out.ms = +((Date.now() - t0)/frames).toFixed(2); const speed = app.ev("simSpeed")(); app.ev("simStop")(); return speed; };
  const cloth = () => S.pieces.map(p => { const it = item(p); return it ? [it.draped, Array.from(it.X)] : null; });
  // the lowest and the highest point of the cloth, and how many of its numbers are not numbers
  const extent = () => { let y0 = Infinity, y1 = -Infinity, bad = 0; for (const p of S.pieces) { const it = item(p); for (let i = 0; i < it.X.length; i += 3) { if (!Number.isFinite(it.X[i] + it.X[i+1] + it.X[i+2])) bad++; y0 = Math.min(y0, it.X[i+1]); y1 = Math.max(y1, it.X[i+1]); } } return [Math.round(y0), Math.round(y1), bad]; };
  // how many points of the cloth are more than 3 mm inside the body
  const inBody = () => { const f = app.ev("avatarField")(S.av); let n = 0, all = 0; for (const p of S.pieces) { const it = item(p); for (let i = 0; i < it.X.length; i += 3) { all++; if (C.sdfAt(f, it.X[i], it.X[i+1], it.X[i+2]) < -3) n++; } } return [n, all]; };
  // (Round r11 / 1, for the report) a ridge at the seams: the cloth's points by how far they are on the flat pattern from the nearest
  // sewn point of their own pattern (bands 0-10, 10-20, 20-40, 40-80, 80+ mm), each band's median distance from the body's skin and
  // the share of its points lying on the body (within the cloth's stand-off and 3 mm)
  const ridge = () => {
    const f = app.ev("avatarField")(S.av), order = app.SIM.order, sewn = order.map(() => []), B = [10, 20, 40, 80, Infinity], d = B.map(() => []), on = B.map(() => 0);
    for (const sm of app.SIM.seams) if (!sm.dart) for (const pr of sm.pairs) for (const a of pr) { const it = G3.items.get(order[a.p]); let x = 0, y = 0; a.i.forEach((v, k) => { x += a.w[k]*it.mesh.xy[2*v]; y += a.w[k]*it.mesh.xy[2*v+1]; }); sewn[a.p].push(x, y); }
    const th = app.SIM.sim.thick[0];
    order.forEach((id, k) => { const it = G3.items.get(id), xy = it.mesh.xy, sw = sewn[k]; if (!sw.length) return;
      for (let i = 0; i < xy.length/2; i++) { let m = Infinity; for (let j = 0; j < sw.length; j += 2) m = Math.min(m, Math.hypot(xy[2*i] - sw[j], xy[2*i+1] - sw[j+1])); const b = B.findIndex(v => m < v), s = C.sdfAt(f, it.X[3*i], it.X[3*i+1], it.X[3*i+2]); d[b].push(s); if (s < th + 3) on[b]++; } });
    return d.map((a, b) => { a.sort((p, q) => p - q); return [+(a[a.length >> 1] || 0).toFixed(1), Math.round(100*on[b]/(a.length || 1))]; });
  };
  const seamList = () => S.seams.map(sm => { const i = app.seamInfo(sm, S.pieces), nm = (x) => S.pieces.find(p => p.id === x.piece).name; return [sm.id, sm.a.map(nm).join("+"), sm.b.map(nm).join("+"), +i.la.toFixed(1), +i.lb.toFixed(1)]; });
`;
// simulated, saved, opened again, printed
const TAIL = (frames) => `
  out.placed = S.pieces.map(p => [p.name, !!p.p3]);
  out.steps = app.histSteps().steps.map(s => s.n);
  out.speed = simulate(${frames});
  out.gaps = seamGaps(); out.extent = extent(); out.inBody = inBody(); out.n = app.SIM.sim.n; out.ridge = ridge();
  // ---- saved, and opened again: the same drape, point for point ----
  const before = cloth(), stepsBefore = app.histSteps().steps.length;
  Object.assign(v3.cam, { az: 0.45, el: 0.25, dist: 3600, tx: 0, ty: 1050, tz: 0 });
  const file = await new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); });
  out.saved = [toasts[toasts.length-1], !!S.dirty];
  out.v11 = new TextEncoder().encode(app.docJSON(1, { history: true })).length;          // the same document as text, which is what a version 11 file was
  out.size = file.length; out.file = app.ev("b64Of")(file);
  app.ev("resetArrangement3")(false); Object.assign(v3.cam, { az: -2, el: 1, dist: 9000, tx: 0, ty: 0, tz: 0 });
  out.reset = cloth().map(c => c[0]);
  const n0 = toasts.length; app.ev("openFile")("bar.pdraft", file, null, true); await app.wait(() => toasts.slice(n0).some(t => /^Opened bar/.test(t)), "the file to open");
  const after = cloth();
  out.same = after.length === before.length && after.every((c, k) => c && c[0] === true && c[1].length === before[k][1].length && c[1].every((v, i) => v === before[k][1][i]));
  out.points = before.reduce((n, c) => n + c[1].length/3, 0);
  out.opened = { toast: toasts.slice(n0).find(t => /^Opened bar/.test(t)), others: toasts.slice(n0).filter(t => !/^Opened bar/.test(t)), cam: { ...v3.cam }, steps: app.histSteps().steps.length === stepsBefore,
    seams: S.seams.length, placed: S.pieces.every(p => !!p.p3), cloth: S.cloth, avatar: [S.av.name, S.av.preset], dirty: !!S.dirty };
  // ---- printed: the sheet plan at true size ----
  const job = app.printJob(), bounds = app.ev("outBounds")(job.pieces), tl = job.plan.tiles;
  out.print = { paper: [job.plan.pw, job.plan.ph], scale: job.plan.scale, sheets: [job.plan.cols, job.plan.rows, job.tiles.length], inner: [job.plan.iw, job.plan.ih], step: tl.length > 1 ? tl[1].x - tl[0].x : 0, overlap: S.print.overlap,
    covers: [Math.min(...tl.map(t => t.x)) <= bounds.x0, Math.min(...tl.map(t => t.y)) <= bounds.y0, Math.max(...tl.map(t => t.x + t.w)) >= bounds.x1, Math.max(...tl.map(t => t.y + t.h)) >= bounds.y1],
    size: [Math.round(bounds.x1 - bounds.x0), Math.round(bounds.y1 - bounds.y0)],
    pages: (job.html.match(/<svg [^>]*class="page"[^>]*>/g) || []).map(s => /width="210mm" height="297mm" viewBox="0 0 210 297"/.test(s)),
    uses: [...new Set(job.html.match(/scale[(][0-9.]+[)]/g) || [])], line: / h 50 m 0 -2 v 4 m -50 0 v -4/.test(job.html), page: /@page [{] size: 210mm 297mm; margin: 0 [}]/.test(job.html) };
`;
// what holds for both garments once they are draped, saved, opened again and printed
function checkBar(r, what, nPieces, av) {
  assert.deepStrictEqual(r.errors, [], what);
  const o = r.result;
  // PDRAFT_BAR_REPORT=1 node drafter/tests/run.js : the numbers of the run, for the update report and for looking at again on another avatar
  if (process.env.PDRAFT_BAR_REPORT) console.log("       " + what + ": " + JSON.stringify({ body: o.body, given: o.given, points: o.points, gaps: o.gaps, extent: o.extent, speed: +o.speed.toFixed(1), ms: o.ms, ridge: o.ridge, v12: o.size, v11: o.v11, sheets: o.print.sheets, pattern: o.print.size }));
  assert.ok(o.placed.every(p => p[1]), what + ": every pattern has its place in 3D from the gizmo");
  assert.deepStrictEqual(o.extent[2], 0, what + ": every point of the cloth is a number"); assert.strictEqual(o.inBody[0], 0, what + ": no point of the cloth is in the body");
  assert.ok(o.speed < 25, what + ": the cloth has come to rest, near enough: " + o.speed + " mm/s");
  // saved
  assert.deepStrictEqual(o.saved, ["Saved", false]);
  const parts = partsOf(Buffer.from(o.file, "base64")), doc = JSON.parse(parts["document.json"].data.toString("utf8"));
  assert.deepStrictEqual(Object.keys(parts), ["document.json", "history.json", "drape.bin"]); assert.strictEqual(parts["document.json"].method, 8, "packed");
  assert.strictEqual(doc.v, 27);      // (version 27 since Round r29 (a document's render settings); 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18: the avatar edits; 21 since Round r17b: the background image and the display settings; 20 since Round build-1; version 19 since Round perf-2: the history saved as changes; 18 since Round r15: the seam allowance corner types; 17 since Round r14: an internal line's fold angle; 16 since Round r13) assert.strictEqual(Object.keys(doc.drape).length, nPieces, what + ": a drape for every pattern");
  assert.strictEqual(parts["drape.bin"].data.length, 12*o.points, "three 32-bit floats a point");
  assert.deepStrictEqual([doc.scene.avatar.preset, doc.scene.avatar.name, doc.scene.avatar.height], av, what + ": what it was draped on");
  assert.deepStrictEqual(doc.scene.camera, { az: 0.45, el: 0.25, dist: 3600, tx: 0, ty: 1050, tz: 0 });
  assert.ok(o.size < o.v11, what + ": version 12 (" + o.size + " bytes) is smaller than the same document as version 11 text (" + o.v11 + " bytes)");
  // opened again
  assert.deepStrictEqual(o.reset, Array(nPieces).fill(false), "thrown back before the file is opened");
  assert.strictEqual(o.same, true, what + ": the drape after reopening is the same, point for point (" + o.points + " points)");
  assert.ok(/^Opened bar\.pdraft with \d+ history steps$/.test(o.opened.toast), o.opened.toast); assert.deepStrictEqual(o.opened.others, [], "the same avatar: nothing to say about it");
  assert.deepStrictEqual(o.opened.cam, { az: 0.45, el: 0.25, dist: 3600, tx: 0, ty: 1050, tz: 0 }, "the camera"); assert.strictEqual(o.opened.steps, true, "the history");
  assert.deepStrictEqual([o.opened.placed, o.opened.cloth.res, o.opened.cloth.worker, o.opened.avatar, o.opened.dirty], [true, 20, false, [av[1], av[0]], false]);
  // printed
  const p = o.print;
  assert.deepStrictEqual(p.paper, [210, 297]); assert.strictEqual(p.scale, 1, what + ": printed at true size");
  assert.deepStrictEqual(p.uses, ["scale(1)"], "every sheet draws the pattern at 1 : 1"); assert.ok(p.pages.length === p.sheets[2] && p.pages.every(Boolean), "every sheet is A4 in millimetres, one unit a millimetre");
  assert.ok(p.line && p.page, "the 50 mm line to check with a ruler, and the paper size for the printer");
  assert.deepStrictEqual(p.covers, [true, true, true, true], "the sheets cover the whole pattern"); near(p.step, p.inner[0] - p.overlap, 1e-6, "sheets overlap by what the settings say");
  assert.ok(p.sheets[0]*p.sheets[1] >= Math.ceil(p.size[0]/p.inner[0])*Math.ceil(p.size[1]/p.inner[1]), "enough sheets: " + p.sheets + " for " + p.size + " mm");
  return o;
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const gap = (o, id) => o.gaps.find(g => g[0] === id);
const skip = (id) => (has(id) ? "" : " (" + id + ".glb is not here: skipped)");
const MARTY = ["marty", "Marty", 1875.5], JESSICA = ["jessica", "Jessica", 1755.8];

/* THE SKIRT, on both avatars. The block's dialog as it comes: with an avatar loaded it is filled with that avatar's own
   waist, hip, hip height and length to the knee, with the default ease beside them (waist 20 mm, hip 40 mm), and nothing
   is typed over any of it. So each gets a skirt of her or his own size. On both every seam must close. */
const SKIRT = `
    // ---- drafted: the Block button and its dialog, as it comes ----
    out.body = app.ev("avatarMeasures")(S.av); out.offered = app.ev("blockBody")(app.ev("BLOCKS").skirt);
    app.el("blk").onclick({ currentTarget: { getBoundingClientRect: () => ({ left: 600, top: 400 }) } });
    out.asked = asked.slice(); out.given = given[0]; out.added = toasts[toasts.length-1];
    out.pieces = S.pieces.map(p => { const b = app.bboxOf([p]); return [p.name, +(b.x1 - b.x0).toFixed(1), Math.round(b.y1 - b.y0), (p.darts || []).length]; });
    out.block = S.pieces[0].block.given;
    // ---- sewn: the block comes sewn; every seam's two sides are the same length ----
    out.seams = seamList();
    // ---- arranged with the gizmo: the front before the body, the two halves of the back turned half round behind it, the waistband before the waist ----
    S.cloth = app.normCloth({ ...S.cloth, res: 20, worker: false }); app.commit();
    const front = byName("Skirt front"), band = byName("Skirt waistband"), backs = [byName("Skirt back"), byName("Skirt back (mirror)")];
    // which side of the front a half of the back is sewn to: +1 the wearer's left (the pattern's right)
    const sideOf = (b) => { const sm = S.seams.find(s => s.a.concat(s.b).some(x => x.piece === front.id) && s.a.concat(s.b).some(x => x.piece === b.id)), part = sm.a.concat(sm.b).find(x => x.piece === front.id), X = app.ev("seamSide")(part, S.pieces), m = app.ev("partPlace")(X, part, 0.5), q = app.segPt(X.sh, m.i, m.t), bb = app.bboxOf([front]); return q.x > (bb.x0 + bb.x1)/2 ? 1 : -1; };
    // the skirt's top at the avatar's waist: the middle of a panel half the skirt's length below it
    const waist = out.body.waistY, half = out.pieces[0][2]/2;
    arrange(front, [0, waist - half, 190]);
    for (const b of backs) arrange(b, [sideOf(b)*125, waist - half, -160], [["y", 180]]);
    arrange(band, [0, waist + 15, 190]);
    out.turned = backs.map(b => S.pieces.find(p => p.id === b.id).p3.q.map(v => +v.toFixed(6)));
`;
function skirtChecks(o, who, measured) {
  assert.deepStrictEqual(o.asked, ["Straight skirt"]); assert.ok(/^Straight skirt added/.test(o.added), o.added);
  // the dialog was filled from the avatar: what it offered is what the avatar measures, and that is what the skirt was drafted from
  const g = Object.fromEntries(o.given), b = o.body;
  assert.deepStrictEqual(Object.keys(g), ["f.waistline", "f.hipWidth", "f.length", "b.waistline", "b.hipWidth", "ease.waist", "ease.hip"]);
  for (const k of Object.keys(o.offered)) if (k in g) assert.strictEqual(g[k], o.offered[k], who + ": " + k + " is offered as measured, nothing typed");
  assert.deepStrictEqual([g["ease.waist"], g["ease.hip"]], [20, 40], "the default ease, as the dialog offers it");
  near(2*(g["f.waistline"] + g["b.waistline"]), b.waist, 0.01, who + ": the skirt's waist is the avatar's"); near(2*(g["f.hipWidth"] + g["b.hipWidth"]), b.hip, 0.01, who + ": its hip");
  assert.strictEqual(g["f.length"], b.knee, "to the knee"); assert.strictEqual(o.block["f.hipHeight"], b.hipHeight, "the hip as far under the waist as on the avatar");
  assert.deepStrictEqual([b.waist, b.hip, b.hipHeight], [measured.waist, measured.hip, measured.hipHeight], who + ": waist, hip and waist to hip as the body mesh measures");
  // Round F / 7: a dart is made into the outline (its legs are lines of the outline, sewn to each other), no longer kept as a
  // dart object; the block's darts are as many sewn pairs of legs as it had darts. (Round r17a / 4: the waistband has a seam
  // to itself as well, its first end to the line across it at the centre back: it was not closed, which was a fault of the
  // block's pattern, not of the solver)
  assert.deepStrictEqual(o.pieces.map(p => [p[0], o.seams.filter(s => s[1] === p[0] && s[2] === p[0]).length]), [["Skirt front", 2], ["Skirt back", 1], ["Skirt back (mirror)", 1], ["Skirt waistband", 1]], "the block's darts, sewn leg to leg, and the waistband closed");
  // (Round r17a / 4) the waist is sewn M:N: each stretch of the waistband to its panel's waist either side of the dart, the take-up left out
  assert.deepStrictEqual(o.seams.filter(s => s[1] === "Skirt waistband" && s[2] !== "Skirt waistband").map(s => s[2]), ["Skirt back (mirror)+Skirt back (mirror)", "Skirt front+Skirt front", "Skirt front+Skirt front", "Skirt back+Skirt back"], "the waist sewn between the darts");
  near(o.pieces[0][1], 2*(g["f.hipWidth"] + 10), 0.2, "the front is as wide as its two hip widths, each with a quarter of the hip ease"); near(o.pieces[3][1], b.waist + 20 + 30, 0.2, "the waistband is the waist, the waist ease and its underlap");
  assert.strictEqual(o.seams.length, 12, "two side seams, the centre back, four on the waistband, the waistband's own at the centre back (Round r17a / 4), and the four darts' legs (Round F / 7)"); assert.ok(o.seams.every(s => Math.abs(s[3] - s[4]) < 0.05), "every seam's sides agree: " + JSON.stringify(o.seams));
  assert.deepStrictEqual(o.turned, [[0, 1, 0, 0], [0, 1, 0, 0]], "the halves of the back were turned half round with the Y ring");
  assert.deepStrictEqual(o.steps.filter(n => n === "Turn in 3D").length, 2); assert.strictEqual(o.steps.filter(n => n === "Move in 3D").length, 12, "three arrows a pattern, each one undo step");
  // draped: THE SIDE SEAMS CLOSE, and so does every other seam
  for (const id of [1, 2]) assert.ok(gap(o, id)[1] < 1 && gap(o, id)[2] < 4, who + ": side seam " + id + " is closed: " + gap(o, id) + " (mean and largest gap in mm)");
  for (const id of [4, 5, 6, 7, 8]) assert.ok(gap(o, id)[1] < 2 && gap(o, id)[2] < 5, who + ": waistband seam " + id + " is closed: " + gap(o, id));
  // (Round r17a / 4) THE CENTRE BACK CLOSES as the side seams do, now that the waistband is closed there (before: closed but for
  // a place at its top, 8.5 mm on Marty, 9.6 on Jessica, where the band's two ends were free; the bound was mean 3, largest 30)
  assert.ok(gap(o, 3)[1] < 1 && gap(o, 3)[2] < 4, who + ": the centre back seam is closed, its top too: " + gap(o, 3));
}
/* (Round r26) THE WAISTBAND AS THE REFERENCE CLOSED IT (the fourth check session, Number 1): the same block with its Waistband extension 0, so
   the band is the waist's own length and its two short ends are sewn to each other, a 30 mm seam. The test above stays as it is: its
   label is the maintainer's to lift, and the block's default is his. out.band: the band's two long edges as they hang, in mm. */
const NO_END = `app.ev("BLOCKS").skirt.specs.find(sp => sp.key === "w.extension").value = 0;`;
const BAND_LEN = `
  { const p = byName("Skirt waistband"), it = item(p), xy = it.mesh.xy, b = app.bboxOf([p]), edge = (y) => { const k = []; for (let i = 0; i < xy.length/2; i++) if (Math.abs(xy[2*i+1] - y) < 0.01) k.push(i); k.sort((u, v) => xy[2*u] - xy[2*v]); let L = 0; for (let j = 1; j < k.length; j++) L += Math.hypot(it.X[3*k[j]] - it.X[3*k[j-1]], it.X[3*k[j]+1] - it.X[3*k[j-1]+1], it.X[3*k[j]+2] - it.X[3*k[j-1]+2]); return +L.toFixed(1); };
    out.band = { flat: +(b.x1 - b.x0).toFixed(1), edges: [edge(b.y0), edge(b.y1)], ends: S.seams.filter(sm => sm.a.concat(sm.b).every(x => x.piece === p.id)).map(sm => { const i = app.seamInfo(sm, S.pieces); return [+i.la.toFixed(1), +i.lb.toFixed(1)]; }) }; }
`;
function bandChecks(o, who, waist) {
  if (process.env.PDRAFT_BAR_REPORT) console.log("       the band sewn end to end, " + who + ": " + JSON.stringify({ gaps: o.gaps, extent: o.extent, speed: +o.speed.toFixed(1), band: o.band, seams: o.seams.map(s => [s[0], s[1], s[2]]) }));
  near(o.band.flat, waist + 20, 0.2, who + ": the band is the eased waist, with no end beyond it");
  assert.deepStrictEqual(o.band.ends, [[30, 30]], who + ": its two short ends sewn to each other");
  assert.ok(o.seams.every(s => Math.abs(s[3] - s[4]) < 0.05), who + ": every seam's sides agree: " + JSON.stringify(o.seams));
  assert.ok(o.gaps.every(g => g[1] < 2 && g[2] < 5), who + ": every seam is closed: " + JSON.stringify(o.gaps));
  assert.ok(gap(o, 3)[1] < 1 && gap(o, 3)[2] < 4, who + ": the centre back is closed, its top too: " + gap(o, 3));
}
test("r26 / 4: the waistband as the reference closed it, on Marty" + skip("marty") + ": the band the waist's length, its ends sewn together: every seam closes", () => {
  if (!has("marty")) return;
  const r = boot(LIB("marty") + NO_END + SKIRT + TAIL(500) + BAND_LEN); assert.deepStrictEqual(r.errors, [], "Marty");
  bandChecks(r.result, "Marty", 777);
});
test("r26 / 4: the waistband as the reference closed it, on Jessica" + skip("jessica") + ": the band the waist's length, its ends sewn together: every seam closes", () => {
  if (!has("jessica")) return;
  const r = boot(LIB("jessica") + NO_END + SKIRT + TAIL(500) + BAND_LEN); assert.deepStrictEqual(r.errors, [], "Jessica");
  bandChecks(r.result, "Jessica", 597);
});
test("[blocked: the maintainer's comparison test] the release bar, a skirt from the block on Marty" + skip("marty") + ": the block's dialog as it comes, filled with his measurements, sewn by the block, arranged with the gizmo, draped: the side seams close; saved and opened again with the same drape point for point, printed at true size", () => {
  if (!has("marty")) return;
  const o = checkBar(boot(LIB("marty") + SKIRT + TAIL(500)), "the skirt on Marty", 4, MARTY);
  skirtChecks(o, "Marty", { waist: 777, hip: 965, hipHeight: 244 });
  assert.ok(o.speed < 1, "the cloth has come to rest: " + o.speed + " mm/s");
  assert.ok(o.extent[0] > 440 && o.extent[0] < 560 && o.extent[1] > 1190 && o.extent[1] < 1280, "it hangs from the waist to the knee: " + o.extent);
});
test("the release bar, a skirt from the block on Jessica" + skip("jessica") + ": the block's dialog as it comes, filled with her measurements, arranged with the gizmo, draped: the side seams close; saved and opened again with the same drape point for point, printed at true size", () => {
  if (!has("jessica")) return;
  const o = checkBar(boot(LIB("jessica") + SKIRT + TAIL(500)), "the skirt on Jessica", 4, JESSICA);
  skirtChecks(o, "Jessica", { waist: 597, hip: 943, hipHeight: 284 });
  assert.ok(o.extent[0] > 470 && o.extent[0] < 600 && o.extent[1] > 1110 && o.extent[1] < 1190, "her own size: it hangs from her waist to the knee: " + o.extent);
});

/* THE T-SHIRT. Four patterns drawn with the Polygon tool: a front with a V neck, a back, two sleeves, an ordinary straight
   armhole. The front and the back are arranged with the gizmo; each sleeve is put on the arrangement point on the outside of
   its arm, which wraps it round the arm. */
test("the release bar, a T-shirt drawn from scratch on Marty" + skip("marty") + ": drawn with the Polygon tool, sewn with Segment Sewing (1:N for the sleeve caps), the body arranged with the gizmo and the sleeves with arrangement points, draped: every seam closes; saved and opened again with the same drape point for point, printed at true size", () => {
  if (!has("marty")) return;
  const o = checkBar(boot(LIB("marty") + `
    // ---- drawn from scratch: the Polygon tool, a click a point, the first point again to close ----
    const clickW = (q) => { const s = app.toS(q); app.click(s.x, s.y); };
    // neck point, (the front's V), neck point, shoulder tip, underarm, hem, hem, underarm, shoulder tip
    const BACK = [[180, 0], [420, 0], [570, 60], [600, 280], [600, 720], [0, 720], [0, 280], [30, 60]];
    const FRONT = [[180, 0], [300, 100], [420, 0], [570, 60], [600, 280], [600, 720], [0, 720], [0, 280], [30, 60]];
    const SLEEVE = [[0, 0], [445, 0], [405, 220], [40, 220]];                    // the cap on top (as long as the two armholes), the hem below
    const OFF = { Front: 0, Back: 800, "Left sleeve": 1600, "Right sleeve": 2200 };
    const drawn = (name, pts) => {
      app.setTool("polygon");
      for (const [x, y] of pts) clickW({ x: x + OFF[name], y });
      clickW({ x: pts[0][0] + OFF[name], y: pts[0][1] });
      app.ev("push")("Rename"); S.pieces[S.pieces.length - 1].name = name; app.commit();
    };
    drawn("Front", FRONT); drawn("Back", BACK); drawn("Left sleeve", SLEEVE); drawn("Right sleeve", SLEEVE);
    out.drawn = S.pieces.map(p => [p.name, p.pts.map(q => [q.x - OFF[p.name], q.y].join()).join(" ")]);
    // ---- sewn: Segment Sewing, a click on each edge near the end it is sewn from ----
    // a place on the edge from point a to point b of a pattern as it was drawn, a fifth of the way along
    const on = (name, pts, a, b) => ({ x: OFF[name] + pts[a][0] + (pts[b][0] - pts[a][0])*0.2, y: pts[a][1] + (pts[b][1] - pts[a][1])*0.2 });
    const sewAt = (q, shift) => { const s = app.toS(q); S.mouse = { x: q.x, y: q.y, sx: s.x, sy: s.y }; app.sewClick(s.x, s.y, { shiftKey: !!shift }); };
    const pair = (A, B) => { sewAt(A); sewAt(B); };
    app.setTool("segment_sewing");
    pair(on("Front", FRONT, 3, 2), on("Back", BACK, 7, 0));            // the wearer's left shoulder, from the tip
    pair(on("Front", FRONT, 8, 0), on("Back", BACK, 2, 1));            // the right shoulder
    pair(on("Front", FRONT, 4, 5), on("Back", BACK, 6, 5));            // the left side, from the underarm
    pair(on("Front", FRONT, 7, 6), on("Back", BACK, 3, 4));            // the right side
    // a sleeve's cap to the two armholes (1:N, with Shift): from one underarm over the shoulder tip to the other
    sewAt(on("Left sleeve", SLEEVE, 0, 1)); sewAt(on("Front", FRONT, 4, 3), true); sewAt(on("Back", BACK, 7, 6), true); app.sewKey("ShiftUp");
    sewAt(on("Right sleeve", SLEEVE, 0, 1)); sewAt(on("Back", BACK, 3, 2), true); sewAt(on("Front", FRONT, 8, 7), true); app.sewKey("ShiftUp");
    // a sleeve's two underarm edges to each other, from the cap
    pair(on("Left sleeve", SLEEVE, 1, 2), on("Left sleeve", SLEEVE, 0, 3));
    pair(on("Right sleeve", SLEEVE, 1, 2), on("Right sleeve", SLEEVE, 0, 3));
    out.seams = seamList();
    // the ends that meet, as places on the patterns: the first side's end / the second side's, for both ends of a seam
    out.ends = S.seams.map(sm => app.ev("seamEnds")(sm, S.pieces).map(([u, v]) => [Math.round(u.x), Math.round(u.y), Math.round(v.x), Math.round(v.y)].join("/")).join("  "));
    app.setSewCheck(true); out.bad = S.seams.filter(sm => app.ev("sewCheckBad")(app.seamInfo(sm, S.pieces), S.sewCheck)).length; app.setSewCheck(false);
    // ---- arranged: the front and the back with the gizmo ----
    S.cloth = app.normCloth({ ...S.cloth, res: 20, worker: false }); app.commit();
    arrange(byName("Front"), [0, 1188, 180]);
    arrange(byName("Back"), [0, 1188, -170], [["y", 180]]);
    // ---- … and each sleeve with the arrangement point on the outside of its arm ----
    out.arr = app.ev("arrList")().length;
    onPoint(byName("Left sleeve"), "armL_outer"); onPoint(byName("Right sleeve"), "armR_outer");
    out.sleeves = ["Left sleeve", "Right sleeve"].map(n => { const p = byName(n).p3; return [p.pt, p.r > 50 && p.r < 150]; });
    out.said = toasts.slice(-2);
    out.asked = [...new Set(asked)];
  ` + TAIL(600)), "the T-shirt on Marty", 4, MARTY);
  assert.deepStrictEqual(o.drawn, [["Front", "180,0 300,100 420,0 570,60 600,280 600,720 0,720 0,280 30,60"], ["Back", "180,0 420,0 570,60 600,280 600,720 0,720 0,280 30,60"],
    ["Left sleeve", "0,0 445,0 405,220 40,220"], ["Right sleeve", "0,0 445,0 405,220 40,220"]], "every point where it was clicked");
  assert.deepStrictEqual(o.seams.map(s => s.slice(1, 3)), [["Front", "Back"], ["Front", "Back"], ["Front", "Back"], ["Front", "Back"], ["Left sleeve", "Front+Back"], ["Right sleeve", "Back+Front"],
    ["Left sleeve", "Left sleeve"], ["Right sleeve", "Right sleeve"]], "two shoulders, two sides, two caps (each to two armholes), two underarms");
  assert.ok(o.seams.every(s => Math.abs(s[3] - s[4]) < 2), "every seam's sides agree within Check Sewing Length's 2 mm: " + JSON.stringify(o.seams)); assert.strictEqual(o.bad, 0);
  // sewn the right way round: shoulder tip to shoulder tip, underarm to underarm, the cap from the front underarm to the back one
  assert.deepStrictEqual(o.ends, ["570/60/830/60  420/0/980/0", "30/60/1370/60  180/0/1220/0", "600/280/800/280  600/720/800/720", "0/280/1400/280  0/720/1400/720",
    "1600/0/600/280  2045/0/800/280", "2200/0/1400/280  2645/0/0/280", "2045/0/1600/0  2005/220/1640/220", "2645/0/2200/0  2605/220/2240/220"]);
  // arranged: the gizmo's boxes for the body, an arrangement point a sleeve; no 3D Placement
  assert.deepStrictEqual(o.asked.slice().sort(), ["Move along X", "Move along Y", "Move along Z", "Turn about Y"].filter(t => o.asked.includes(t)), "only the gizmo's boxes were used: " + o.asked);
  assert.strictEqual(o.arr, 46, "Marty has every arrangement point");
  assert.deepStrictEqual(o.sleeves, [["armL_outer", true], ["armR_outer", true]], "each sleeve is on its arm's point, wrapped round the arm");
  assert.deepStrictEqual(o.said, ["Left sleeve → Left upper arm outside", "Right sleeve → Right upper arm outside"]);
  assert.strictEqual(o.steps.filter(n => n === "Arrange in 3D").length, 2); assert.strictEqual(o.steps.filter(n => n === "Turn in 3D").length, 1, "the back, half round"); assert.strictEqual(o.steps.filter(n => n === "3D Placement").length, 0);
  assert.strictEqual(o.steps.filter(n => n === "Polygon").length, 4); assert.strictEqual(o.steps.filter(n => n === "Segment Sewing").length, 8);
  // draped: every seam closes (the largest gaps are at the underarm, where four seams meet)
  for (const id of [1, 2, 5, 6]) assert.ok(gap(o, id)[1] < 1.5 && gap(o, id)[2] < 5, "seam " + id + " is closed: " + gap(o, id));
  for (const id of [3, 4, 7, 8]) assert.ok(gap(o, id)[1] < 3 && gap(o, id)[2] < 25, "seam " + id + " is closed: " + gap(o, id));
  assert.ok(o.extent[0] > 880 && o.extent[0] < 990 && o.extent[1] > 1580 && o.extent[1] < 1690, "it hangs from the shoulders to the hips: " + o.extent);
});

module.exports = T;
