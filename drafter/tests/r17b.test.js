// Round r17b: batch 1, the 2D right-click menus' rows that were not built (the background image, Delete All Overlapping Points,
// Grid Properties, the three Merge rows, Rotate ▸ Parallel to…, Extend/Trim & Add Point, a punch mark's Duplicate to Symmetric
// Pattern, Apply Turned Sewing Line Type), and file version 21 (a version 20 file opens unchanged).
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 90000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 90 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// two rectangles side by side, the view 1 : 1 at the origin, A sewn to B
const DOC = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  const sq = (n, x) => app.mkPiece(n, app.mkShape([{x,y:100},{x:x+200,y:100},{x:x+200,y:300},{x,y:300}], true));
  const A = sq("A", 0), B = sq("B", 300);
  S.pieces.push(A, B);
  const part = (p, i) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: false });
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3)] });
  S.sel = []; app.commit(); S.undo.length = 0;
  const out = {};
  // a tiny PNG as a data: URL (the picture's bytes do not matter here)
  const PNG = "data" + ":image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const roundTrip = () => { const files = app.ev("pdraftFiles")(); const parts = new Map(files.map(f => [f.name, f.data])); return { names: files.map(f => f.name), doc: app.ev("pdraftDoc")(parts) }; };
`;

/* ---- the background image ---- */
test("r17b / 1: Add Background Image: one picture under the patterns at 96 ppi, half see-through, its middle at the window's middle; one step; in the file (version 21) with its picture", () => {
  const o = boot({ script: DOC + `
    app.ev("backdropFile")("scan.png", PNG, 960, 480);
    const b = S.backdrop;
    out.b = { w: +b.w.toFixed(3), h: +b.h.toFixed(3), opacity: b.opacity, lock: b.lock, hide: b.hide };
    const c = app.ev("toW")(app.ev("W") / 2, app.ev("H") / 2);
    out.middle = Math.hypot(b.x + b.w/2 - c.x, b.y + b.h/2 - c.y) < 1e-6;
    out.steps = S.un.map(s => s.n);
    app.ev("draw")();
    const rt = roundTrip();
    out.v = rt.doc.v; out.parts = rt.names.filter(n => /^images\\//.test(n)).length; out.saved = rt.doc.backdrop && rt.doc.backdrop.img === b.img;
    // opened again: the same
    app.ev("loadDoc")(rt.doc); out.back = S.backdrop && +S.backdrop.w.toFixed(3);
    out.picture = S.images.some(im => im.id === S.backdrop.img && im.data === PNG);
    // a second picture takes the first one's place, where it was, at its own shape
    app.ev("backdropFile")("other.png", PNG.replace("A", "A"), 100, 100);
    out.replaced = [+S.backdrop.w.toFixed(3), +S.backdrop.h.toFixed(3)];
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.b, { w: 254, h: 127, opacity: 0.5, lock: false, hide: false }, "960 × 480 px at 96 ppi is 254 × 127 mm");
  assert.ok(r.middle);
  assert.deepStrictEqual(r.steps, ["Add Background Image"]);
  assert.strictEqual(r.v, 26); /* (version 26 since Round r26; 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18) */ assert.strictEqual(r.parts, 1, "the picture is a part of its own"); assert.ok(r.saved);
  assert.strictEqual(r.back, 254); assert.ok(r.picture);
  assert.deepStrictEqual(r.replaced, [254, 254], "the new picture's shape at the old width");
});

test("r17b / 1: the background image's commands from More ▸ Background Image: move by a drag, scale to a known length, opacity, lock, hide, remove; one step each, undone and redone", () => {
  const o = boot({ script: DOC + `
    app.ev("backdropFile")("scan.png", PNG, 960, 480);
    S.backdrop.x = 0; S.backdrop.y = 400; app.commit();
    const W0 = S.undo.length;
    const sub = (row) => app.menuClick(900, 900, "More \\u25b8 Background Image \\u25b8 " + row, "edit_pattern");
    // Move: the next drag moves it
    sub("Move Background Image");
    out.mode = S.bgMode && S.bgMode.k;
    app.drag(50, 450, 80, 470); app.fire("pointerup", { x: 80, y: 470 });
    out.moved = [S.backdrop.x, S.backdrop.y]; out.modeAfter = S.bgMode;
    // a drag that does not move takes no step
    sub("Move Background Image"); const n0 = S.undo.length; app.click(100, 500); out.still = S.undo.length === n0;
    // Scale to a Known Length…: two clicks, then the real length (the picture's 100 mm is 200 mm)
    app.answer = (title, fields) => (title === "Scale Background Image" ? { is: fields[0].val, len: 200 } : null);
    sub("Scale to a Known Length\\u2026");
    app.click(30, 420); app.click(130, 420);
    out.scaled = [+S.backdrop.x.toFixed(3), +S.backdrop.w.toFixed(3), +S.backdrop.h.toFixed(3)];
    // Opacity…
    app.answer = (title) => (title === "Background Image Opacity" ? { op: 80 } : null);
    sub("Opacity\\u2026"); out.op = S.backdrop.opacity;
    sub("Lock Background Image"); out.lock = S.backdrop.lock;
    sub("Move Background Image"); out.lockedMove = S.bgMode === null && toasts.some(t => /locked/.test(t));
    sub("Unlock Background Image");
    sub("Hide Background Image"); out.hide = S.backdrop.hide;
    sub("Show Background Image");
    sub("Remove Background Image"); out.removed = S.backdrop;
    out.steps = S.un.slice(W0).map(s => s.n);
    // all of it undone, one step at a time, and redone
    for (let k = 0; k < out.steps.length; k++) app.ev("undo")();
    out.undone = [S.backdrop.x, S.backdrop.y, S.backdrop.w];
    for (let k = 0; k < out.steps.length; k++) app.ev("redo")();
    out.redone = S.backdrop;
    return out;` });
  const r = o.result;
  assert.strictEqual(r.mode, "move");
  assert.deepStrictEqual(r.moved, [30, 420]); assert.strictEqual(r.modeAfter, null);
  assert.ok(r.still);
  assert.deepStrictEqual(r.scaled, [30, 508, 254], "scaled × 2 about the first point clicked (x 30)");
  assert.strictEqual(r.op, 0.8); assert.strictEqual(r.lock, true); assert.ok(r.lockedMove, "a locked picture is not moved");
  assert.strictEqual(r.hide, true); assert.strictEqual(r.removed, null);
  assert.deepStrictEqual(r.steps, ["Move Background Image", "Scale Background Image", "Background Image Opacity", "Lock Background Image", "Unlock Background Image", "Hide Background Image", "Show Background Image", "Remove Background Image"]);
  assert.deepStrictEqual(r.undone, [0, 400, 254]); assert.strictEqual(r.redone, null);
});

test("r17b / 1: the empty window's menu: Add Background Image, Delete All Overlapping Points and Grid Properties are built rows; More ▸ Background Image only once there is one", () => {
  const o = boot({ script: DOC + `
    const rows = () => { app.menu.children.length = 0; S.tool = "edit_pattern"; app.showMenu({ clientX: 900, clientY: 900 }); return app.menu.children.map(c => c.innerHTML.replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim()); };
    const has = (list, n) => list.find(t => t.startsWith(n)) || null;
    let r = rows();
    out.before = ["Add Background Image", "Delete All Overlapping Points", "Grid Properties"].map(n => has(r, n));
    app.menu.children.length = 0; app.showMenu({ clientX: 900, clientY: 900 });
    const more = app.menu.children.find(c => /<span>More<\\/span>/.test(c.innerHTML)); more.onclick({ stopPropagation() {} });
    const subs = app.ev("menuSubs"); out.moreBefore = subs[subs.length - 1].children.some(c => /Background Image/.test(c.innerHTML));
    app.ev("backdropFile")("scan.png", PNG, 96, 96);
    app.menu.children.length = 0; app.showMenu({ clientX: 900, clientY: 900 });
    const more2 = app.menu.children.find(c => /<span>More<\\/span>/.test(c.innerHTML)); more2.onclick({ stopPropagation() {} });
    const subs2 = app.ev("menuSubs"); out.moreAfter = subs2[subs2.length - 1].children.some(c => /Background Image/.test(c.innerHTML));
    return out;` });
  const r = o.result;
  assert.ok(r.before.every(t => t && !/not built/.test(t)), JSON.stringify(r.before));
  assert.strictEqual(r.moreBefore, false); assert.strictEqual(r.moreAfter, true);
});

/* ---- the other rows ---- */
test("r17b / 1: Delete All Overlapping Points takes out a point lying on the next one (an outline's and an internal line's), the seam on that line kept; nothing to delete is no step", () => {
  const o = boot({ script: DOC + `
    // a point 0.2 mm from A's corner on its sewn right side, and an internal line with a doubled point
    app.ev("addPoint")(A, 1, 0.001);
    app.ev("addChild")(A, "internals", app.mkShape([{x:20,y:150},{x:100,y:150},{x:100.3,y:150},{x:180,y:150}], false));
    app.commit(); S.undo.length = 0; S.un.length = 0;
    out.before = [A.pts.length, A.internals[0].pts.length];
    app.menuClick(900, 900, "Delete All Overlapping Points", "edit_pattern");
    out.after = [A.pts.length, A.internals[0].pts.length];
    const sm = S.seams[0], pl = (x) => app.ev("partLen")(app.ev("seamSide")(x, S.pieces), x);
    out.sewn = +sm.a.reduce((t, x) => t + pl(x), 0).toFixed(3);
    out.steps = S.un.map(s => s.n);
    app.menuClick(900, 900, "Delete All Overlapping Points", "edit_pattern");
    out.again = S.un.length; out.said = toasts[toasts.length - 1];
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.before, [5, 4]); assert.deepStrictEqual(r.after, [4, 3]);
  assert.strictEqual(r.sewn, 200, "the side is sewn whole, as before");
  assert.deepStrictEqual(r.steps, ["Delete All Overlapping Points"]);
  assert.strictEqual(r.again, 1); assert.ok(/No points lie on top of each other/.test(r.said));
});

test("r17b / 1: Grid Properties shows or hides the grid and sets Snap to Grid; F12 is the desktop app's key for it and left to a browser", () => {
  const o = boot({ script: DOC + `
    app.answer = (title) => (title === "Grid Properties" ? { show: "off", snap: "5" } : null);
    app.menuClick(900, 900, "Grid Properties", "edit_pattern");
    out.prefs = [S.prefs.gridShow, S.snapG];
    app.ev("draw")();
    app.answer = (title) => (title === "Grid Properties" ? { show: "on", snap: "0" } : null);
    app.ev("gridDialog")({ x: 0, y: 0 });
    out.back = [S.prefs.gridShow, S.snapG];
    const row = app.ev("keyTable")().find(k => k.id === "gridProps");
    out.key = row && [row.k, !!row.desk];
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.prefs, [false, 5]); assert.deepStrictEqual(r.back, [true, 0]);
  assert.deepStrictEqual(r.key, ["F12", true]);
});

test("r17b / 1: Merge to Point, Merge to Average and Intersect & Merge make two line ends one: at the end right-clicked, at their middle, where the lines would cross; one step each", () => {
  const o = boot({ script: DOC + `
    const two = () => { A.internals.length = 0;
      app.ev("addChild")(A, "internals", app.mkShape([{x:20,y:150},{x:80,y:150}], false));
      app.ev("addChild")(A, "internals", app.mkShape([{x:100,y:200},{x:100,y:160}], false)); app.commit(); };
    const res = {};
    for (const how of ["point", "average", "intersect"]) {
      two();
      const [L1, L2] = A.internals;
      const why = app.ev("mergeEnds")(A, "internals", { sh: L1, i: 1 }, { sh: L2, i: 1 }, how);
      app.commit();
      const pts = A.internals[0].pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
      res[how] = { why, lines: A.internals.length, pts: pts[0][0] === 20 ? pts : pts.reverse() };      // (the joined line may run either way)
    }
    out.res = res;
    // parallel lines never meet
    A.internals.length = 0;
    app.ev("addChild")(A, "internals", app.mkShape([{x:20,y:150},{x:80,y:150}], false));
    app.ev("addChild")(A, "internals", app.mkShape([{x:20,y:200},{x:80,y:200}], false)); app.commit();
    out.parallel = app.ev("mergeEnds")(A, "internals", { sh: A.internals[0], i: 1 }, { sh: A.internals[1], i: 1 }, "intersect");
    out.noFirst = app.ev("mergeEnds")(A, "internals", null, { sh: A.internals[1], i: 1 }, "point");
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.res.point, { why: "", lines: 1, pts: [[20, 150], [100, 160], [100, 200]] });
  assert.deepStrictEqual(r.res.average, { why: "", lines: 1, pts: [[20, 150], [90, 155], [100, 200]] });
  assert.deepStrictEqual(r.res.intersect, { why: "", lines: 1, pts: [[20, 150], [100, 150], [100, 200]] });
  assert.ok(/parallel/.test(r.parallel)); assert.ok(/select the first line end/.test(r.noFirst));
});

test("r17b / 1: the Merge rows on an internal line end's menu are built, and one undo step", () => {
  const o = boot({ script: DOC + `
    app.ev("addChild")(A, "internals", app.mkShape([{x:20,y:150},{x:80,y:150}], false));
    app.ev("addChild")(A, "internals", app.mkShape([{x:100,y:200},{x:100,y:160}], false)); app.commit(); S.undo.length = 0; S.un.length = 0;
    app.setTool("edit_pattern");
    app.click(80, 150);                                      // the first line's end, selected
    app.menuClick(100, 160, "Merge to Average", "edit_pattern");
    out.lines = A.internals.length; out.steps = S.un.map(s => s.n);
    out.mid = A.internals[0].pts.some(q => Math.abs(q.x - 90) < 1e-6 && Math.abs(q.y - 155) < 1e-6);
    return out;` });
  assert.deepStrictEqual(o.result, { lines: 1, steps: ["Merge to Average"], mid: true });
});

test("r17b / 1: Rotate ▸ Parallel to…: a line of the selected pattern, then any line: the pattern turns (by at most a quarter) until they are parallel; one step", () => {
  const o = boot({ script: DOC + `
    // B turned 30° so that its lines slant
    B.pts = B.pts.map(q => { const c = { x: 400, y: 200 }, a = Math.PI/6, dx = q.x - c.x, dy = q.y - c.y; return { x: c.x + dx*Math.cos(a) - dy*Math.sin(a), y: c.y + dx*Math.sin(a) + dy*Math.cos(a) }; });
    app.commit(); S.undo.length = 0; S.un.length = 0;
    S.sel = [A.id]; app.setTool("transform_pattern");
    app.menuClick(100, 200, "Rotate \\u25b8 Parallel to\\u2026", "transform_pattern");
    out.waiting = S.rotAxis && S.rotAxis.axis;
    app.click(100, 100);                                     // A's top line
    const [a, b] = [B.pts[0], B.pts[1]], m = { x: (a.x + b.x)/2, y: (a.y + b.y)/2 }, s = app.ev("toS")(m);
    app.click(s.x, s.y);                                     // B's (slanted) top line
    const ang = (p, q) => Math.atan2(q.y - p.y, q.x - p.x)*180/Math.PI;
    out.diff = +(((ang(A.pts[0], A.pts[1]) - ang(B.pts[0], B.pts[1])) % 180 + 180) % 180).toFixed(6);
    out.steps = S.un.map(s => s.n); out.done = S.rotAxis;
    return out;` });
  const r = o.result;
  assert.strictEqual(r.waiting, "par");
  assert.ok(r.diff < 1e-4 || r.diff > 180 - 1e-4, "parallel: " + r.diff);
  assert.deepStrictEqual(r.steps, ["Rotate (Parallel to)"]); assert.strictEqual(r.done, null);
});

test("r17b / 1: Extend/Trim & Add Point ▸ To Pattern Outline: the line runs on to the outline and the outline gets a point there (its seam kept); ▸ To Internal Line likewise", () => {
  const o = boot({ script: DOC + `
    app.ev("addChild")(A, "internals", app.mkShape([{x:50,y:200},{x:150,y:200}], false));
    app.commit(); S.undo.length = 0; S.un.length = 0;
    const L = A.internals[0];
    const fn = app.ev("extendTrimAddPoint");
    app.ev("push")("x"); out.r = fn(A, L, 1, true); app.commit();
    out.end = [L.pts[1].x, L.pts[1].y]; out.outline = A.pts.length; out.at = A.pts.some(q => Math.abs(q.x - 200) < 1e-6 && Math.abs(q.y - 200) < 1e-6);
    const sm = S.seams[0]; out.sewn = +sm.a.reduce((t, x) => t + app.ev("partLen")(app.ev("seamSide")(x, S.pieces), x), 0).toFixed(3);
    // to an internal line: a second line, upright at x 20, gets a point where the first, run back, meets it
    app.ev("addChild")(A, "internals", app.mkShape([{x:20,y:120},{x:20,y:280}], false)); app.commit();
    const U = A.internals[1];
    out.r2 = fn(A, L, 0, false); app.commit();
    out.start = [+L.pts[0].x.toFixed(6), +L.pts[0].y.toFixed(6)]; out.upright = U.pts.map(q => +q.y.toFixed(6));
    // from the menu, one step
    S.undo.length = 0; S.un.length = 0;
    A.internals.splice(0); app.ev("addChild")(A, "internals", app.mkShape([{x:50,y:250},{x:150,y:250}], false)); app.commit();
    app.menuClick(140, 250, "Extend/Trim & Add Point \\u25b8 To Pattern Outline", "edit_pattern");
    out.steps = S.un.map(s => s.n); out.menuEnd = A.internals[0].pts[1].x;
    return out;` });
  const r = o.result;
  assert.strictEqual(r.r, "extend"); assert.deepStrictEqual(r.end, [200, 200]);
  assert.strictEqual(r.outline, 5); assert.ok(r.at, "a point on the outline at (200, 200)");
  assert.strictEqual(r.sewn, 200, "the right side is still sewn whole, now in two parts");
  assert.strictEqual(r.r2, "extend"); assert.deepStrictEqual(r.start, [20, 200]); assert.deepStrictEqual(r.upright, [120, 200, 280]);
  assert.deepStrictEqual(r.steps, ["Extend/Trim & Add Point"]); assert.strictEqual(r.menuEnd, 200);
});

test("r17b / 1: a punch mark's Duplicate to Symmetric Pattern: on a pattern unfolded symmetrically the mark is mirrored across the fold; elsewhere it says why and takes no step", () => {
  const o = boot({ script: DOC + `
    A.punches.push({ x: 50, y: 150, d: 3 }); app.commit(); S.undo.length = 0; S.un.length = 0;
    app.ev("punchToSymmetric")(A, A.punches[0]);
    out.plain = [S.un.length, toasts[toasts.length - 1]];
    // A unfolded about its right side (x 200)
    A.half = { s: A.segs[1].id, m: A.segs[2].id, map: {}, kids: {} };
    const i0 = app.ev("segIx")(A, A.half.s), i1 = app.ev("segIx")(A, A.half.m);
    out.fold = [A.pts[i0], A.pts[i1]].map(q => [q.x, q.y]);
    app.ev("punchToSymmetric")(A, A.punches[0]);
    out.marks = A.punches.map(pm => [+pm.x.toFixed(3), +pm.y.toFixed(3)]); out.steps = S.un.map(s => s.n);
    return out;` });
  const r = o.result;
  assert.strictEqual(r.plain[0], 0); assert.ok(/no symmetric half/.test(r.plain[1]));
  // the fold line runs through A's points at the ends of its seg s and seg m
  const [[ax, ay], [bx, by]] = r.fold, ux = bx - ax, uy = by - ay, L = Math.hypot(ux, uy), vx = 50 - ax, vy = 150 - ay, d = (vx*ux + vy*uy)/(L*L);
  const want = [+(ax + 2*ux*d - vx).toFixed(3), +(ay + 2*uy*d - vy).toFixed(3)];
  assert.deepStrictEqual(r.marks, [[50, 150], want]); assert.deepStrictEqual(r.steps, ["Duplicate to Symmetric Pattern"]);
});

test("r17b / 1: Edit Sewing's Apply Turned Sewing Line Type turns the seam Turned (one step); on a Turned seam the row is greyed", () => {
  const o = boot({ script: DOC + `
    S.undo.length = 0; S.un.length = 0;
    const rows = () => { app.menu.children.length = 0; app.ev("editSewMenu")(0, 0, 200, 200); return app.menu.children.map(c => c.innerHTML.replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim()); };
    let list = rows();
    const row = app.menu.children.find(c => /Apply Turned Sewing Line Type/.test(c.innerHTML));
    out.row = list.find(t => /Apply Turned/.test(t));
    row.onclick({ stopPropagation() {} });
    out.turned = S.seams[0].turned; out.steps = S.un.map(s => s.n);
    list = rows(); out.again = list.find(t => /Apply Turned/.test(t));
    return out;` });
  const r = o.result;
  assert.ok(r.row && !/not built|turned already/.test(r.row), r.row);
  assert.strictEqual(r.turned, true); assert.deepStrictEqual(r.steps, ["Sewing Line Type"]);
  assert.ok(/turned already/.test(r.again), r.again);
});

/* ---- file version 21 ---- */
test("r17b / 1: a version 20 file (written by the build before this round) opens unchanged: the same document but its version, its history replayed; saved again it is version 21", () => {
  const bytes = fs.readFileSync(path.join(__dirname, "files/v20/sewn-curve-history.pdraft"));
  const o = boot({ streams: true, script: `
    const out = {};
    const bytes = new Uint8Array(app.read("files/v20/sewn-curve-history.pdraft"));
    const was = app.fileDoc(bytes);
    app.ev("openFile")("sewn-curve-history.pdraft", bytes, null, true);
    return app.wait(() => S.pieces.length === 2, "the file opened").then(() => {
      const J = app.ev("canonJSON"), now = app.ev("docObj")();
      out.v = [was.v, now.v];
      // (the display settings are written from version 21 on: Round r17b / 2; a version 20 file has none)
      const strip = (d) => { const c = JSON.parse(JSON.stringify(d)); delete c.v; delete c.scene; delete c.drape; delete c.states3; delete c.states3Bin; delete c.history; delete c.display; return J(c); };
      out.display = [!!was.display, !!now.display];
      out.same = strip(was) === strip(now); if (!out.same) { const a = strip(was), b = strip(now); let k = 0; while (a[k] === b[k]) k++; out.diff = [a.slice(k - 60, k + 120), b.slice(k - 60, k + 120)]; }
      out.names = S.pieces.map(p => p.name); out.res3 = S.pieces[0].res3; out.undo = S.un.map(s => s.n);
      app.ev("undo")(); out.undone = S.pieces[0].name;
      return out;
    });` });
  const r = o.result;
  assert.deepStrictEqual(r.v, [20, 26]);      /* (saved again it is this build's version: 26 since Round r26; 25 since Round r25; 24 since Round r20; 23 since the r19 follow-up; 22 since Round r18) */ assert.deepStrictEqual(r.display, [false, true]);
  assert.ok(r.same, "the document as the file has it: " + JSON.stringify(r.diff));
  assert.deepStrictEqual(r.names, ["Front piece", "Back"]); assert.strictEqual(r.res3, 12);
  assert.ok(r.undo.length >= 1, "its history came with it: " + JSON.stringify(r.undo)); assert.strictEqual(r.undone, "Front");
  assert.ok(bytes.length > 100);
});

/* ---- batch 2: the 2D rendering styles and the display settings in the file ---- */
test("r17b / 2: 2D Pattern Rendering Style lists Translucent and Transparent Surface as styles and Show Mesh as a switch, in the reference's order, none of them 'not built'", () => {
  const o = boot({ script: DOC + `
    const list = app.ev("selectorItems")("render");
    out.list = list && list.filter(x => x && x.n).map(x => x.n + (x.on ? " *" : ""));
    return out;` });
  assert.deepStrictEqual(o.result.list, ["Front Texture Surface *", "Monochrome Surface", "Translucent Surface", "Transparent Surface", "Show Mesh", "Back Texture Surface", "Random Color Surface"]);
});

test("r17b / 2: Translucent fills each pattern see-through, Transparent fills nothing; Show Mesh draws the cloth's triangles, kept per pattern as a fresh calculation gives them", () => {
  const o = boot({ script: DOC + `
    // the canvas's calls while drawing: how many fills, and the alpha of the patterns' fills
    const c = app.ev("ctx"), fills = []; c.globalAlpha = 1;      // (the test canvas has no alpha of its own)
    const fillOf = app.ev("pieceFill")(A, "front"), was = c.fill; c.fill = function () { if (c.fillStyle === fillOf) fills.push(+(c.globalAlpha || 1).toFixed(3)); if (was) return was.apply(this, arguments); };
    const count = (k) => { fills.length = 0; app.ev("setRender")(k); app.ev("draw")(); return fills.slice(); };
    out.front = count("front"); out.translucent = count("translucent"); out.transparent = count("transparent");
    app.ev("setRender")("front");
    app.ev("setMesh2")(true); app.ev("draw")();
    const E = app.ev("meshEdges2")(A), F = app.ev("meshEdges2Fresh")(A, app.ev("particleOf")(A));
    out.mesh = [E.length > 40, JSON.stringify(E) === JSON.stringify(F), app.ev("meshEdges2")(A) === E];
    A.pts[2].x += 30; app.commit();
    out.changed = app.ev("meshEdges2")(A) !== E && JSON.stringify(app.ev("meshEdges2")(A)) === JSON.stringify(app.ev("meshEdges2Fresh")(A, 20));
    out.ui = JSON.parse(app.storage.get("pdraft:ui")).mesh2;      // (Round r23 / 1: a display mode is view state, not written)
    return out;` });
  const r = o.result;
  const pats = (l) => l.filter(a => a !== 1).length;
  assert.ok(r.front.length >= 2 && pats(r.front) === 0, JSON.stringify(r));      // (each pattern's fill in its own colour, once a frame; setRender() draws a frame too)
  assert.deepStrictEqual(r.translucent, r.front.map(() => 0.4), "both patterns filled at 40 %");
  assert.deepStrictEqual(r.transparent, [], "the two patterns' fills left out");
  assert.deepStrictEqual(r.mesh, [true, true, true]); assert.strictEqual(r.changed, true); assert.strictEqual(r.ui, undefined);
});

test("r17b / 2: the display settings go into the file; opened again they are put back only with Open Files with Their Display Settings on, and never Show Sewing", () => {
  const o = boot({ script: DOC + `
    app.ev("setView")("grainline", false); app.ev("setView")("sewing", true); app.ev("setRender")("translucent"); app.ev("setMesh2")(true);
    const d = JSON.parse(JSON.stringify(app.ev("docObj")()));
    out.saved = [d.display.show2d.grainline, d.display.show2d.sewing, d.display.render, d.display.mesh2, "lockAll" in d.display.show2d];
    // back to this machine's own settings, then the file opened twice: preference off, then on
    app.ev("setView")("grainline", true); app.ev("setView")("sewing", false); app.ev("setRender")("front"); app.ev("setMesh2")(false);
    app.ev("loadDoc")(JSON.parse(JSON.stringify(d)));
    out.off = [S.show.grainline, S.ui.render, S.ui.mesh2];
    app.ev("setPrefs")({ openDisplay: true });
    app.ev("loadDoc")(JSON.parse(JSON.stringify(d)));
    out.on = [S.show.grainline, S.show.sewing, S.ui.render, S.ui.mesh2];
    out.kept = app.storage.get("pdraft:view");      // (Round r23 / 1: the switches are view state, not written)
    // a file with no display settings changes nothing
    app.ev("setView")("grainline", true); const e = JSON.parse(JSON.stringify(d)); delete e.display; app.ev("loadDoc")(e); out.none = S.show.grainline;
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.saved, [false, true, "translucent", true, false]);
  assert.deepStrictEqual(r.off, [true, "front", false], "the preference off: this computer's own settings stay");
  assert.deepStrictEqual(r.on, [false, false, "translucent", true], "on: the file's, but Show Sewing stays off");
  assert.strictEqual(r.kept, undefined); assert.strictEqual(r.none, true);
});

/* ---- batch 3: the 3D garment rendering styles and the avatar's display ---- */
// a front and a back, sewn at both sides, in the 3D window
const SEWN = `
  const out = {}, G3 = app.G3, v3 = app.view3d;
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] });
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  const it = G3.items.get(A.id), grp = v3.group("garment");
`;
test("r17b / 3: the default style builds nothing beside each pattern's cloth and its outline; Show Wireframe (Alt+W) adds the triangles' edges on the cloth's own points, gone again when it is off", () => {
  const o = boot({ three: true, script: SEWN + `
    const base = grp.children.length;
    out.default = [[...G3.items.values()].some(x => x.wire || x.thick), grp.children.filter(c => c.isLineSegments && c.geometry.attributes.position === it.obj.geometry.attributes.position).length];
    app.key("w", { altKey: true });
    const w = it.wire;
    out.wire = [!!w, w && w.geometry.attributes.position === it.obj.geometry.attributes.position, w && w.geometry.index.count/2, S.ui.wire3];
    // the edges: each triangle edge once
    const T = it.mesh.tri, set = new Set(); for (let k = 0; k < T.length; k += 3) for (const [a, b] of [[T[k], T[k+1]], [T[k+1], T[k+2]], [T[k+2], T[k]]]) set.add(Math.min(a, b) + "," + Math.max(a, b));
    out.edges = set.size;
    out.menu = app.ev("render3Items")().find(x => x && x.n === "Show Wireframe");
    out.menu = out.menu && [out.menu.on, out.menu.k, !!out.menu.nb];
    out.on = [grp.children.length - base, G3.items.size];
    app.key("w", { altKey: true });
    out.off = [!!it.wire, grp.children.length - base];
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.default, [false, 0], "no wireframe, no thick cloth"); assert.strictEqual(r.on[0], r.on[1], "a wireframe a pattern");
  assert.deepStrictEqual(r.wire.slice(0, 2), [true, true]); assert.strictEqual(r.wire[2], r.edges); assert.strictEqual(r.wire[3], true);
  assert.deepStrictEqual(r.menu, [true, "Alt+W", false]);
  assert.deepStrictEqual(r.off, [false, 0]);
});

test("r17b / 3: the Thick styles (Alt+1, Alt+3, and Back) draw the cloth with a thickness that follows it as it moves; Translucent (Alt+5) is see-through; a strain or fit map draws the cloth thin", () => {
  const o = boot({ three: true, script: SEWN + `
    const keys = app.ev("keyTable")().filter(k => /^render3:/.test(k.id)).map(k => [k.id.slice(8), k.k]);
    out.keys = keys;
    app.key("1", { altKey: true });
    const t = it.thick, n = it.X.length/3, P = () => t.geometry.attributes.position.array, N = it.obj.geometry.attributes.normal.array;
    out.thick = [S.ui.render3, !!t, t && t.material === it.obj.material, t && P().length === 6*n];
    const gap = (k) => Math.hypot(P()[3*k] - P()[3*(n+k)], P()[3*k+1] - P()[3*(n+k)+1], P()[3*k+2] - P()[3*(n+k)+2]);
    out.gap = +gap(0).toFixed(6);
    const mid = (k) => [0, 1, 2].map(c => (P()[3*k+c] + P()[3*(n+k)+c])/2 - it.X[3*k+c]);
    out.mid = Math.max(...mid(3).map(Math.abs)) < 1e-4;
    // the cloth moves: the thick cloth goes with it
    for (let i = 0; i < n; i++) it.X[3*i+1] += 50; app.ev("itemMoved")(it);
    out.follows = Math.abs((P()[1] + P()[3*n+1])/2 - it.X[1]) < 1e-4;
    // Back: the front face where the cloth is, the thickness behind it
    app.ev("setRender3")("thickBack");
    out.back = [+Math.hypot(P()[0] - it.X[0], P()[1] - it.X[1], P()[2] - it.X[2]).toFixed(6), +gap(0).toFixed(6)];
    app.ev("setRender3")("thickMono"); out.mono = [!!it.thick, app.ev("style3")()[0]];
    // a map on: thin; off again: thick
    app.ev("setStrainMap")(true); out.mapThin = !it.thick; app.ev("setStrainMap")(false); out.mapBack = !!it.thick;
    app.ev("setFitMap")(true); out.fitThin = !it.thick; app.ev("setFitMap")(false);
    // Translucent
    app.key("5", { altKey: true });
    const m = it.obj.material; out.see = [S.ui.render3, m.transparent, m.opacity, !it.thick];
    // a deactivated pattern stays more see-through than Translucent
    A.off3 = "pattern"; app.commit(); app.ev("garmentSync")(); out.off3 = it.obj.material.opacity;
    delete A.off3; app.commit(); app.ev("garmentSync")();
    app.key("2", { altKey: true }); out.front = [S.ui.render3, it.obj.material.transparent, it.obj.material.opacity, !!it.thick];
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.keys, [["thick", "Alt+1"], ["front", "Alt+2"], ["thickMono", "Alt+3"], ["mono", "Alt+4"], ["translucent", "Alt+5"], ["random", "Alt+9"]], "Thick Textured Surface (Back) has no key");
  assert.deepStrictEqual(r.thick, ["thick", true, true, true]);
  assert.strictEqual(r.gap, 1.5); assert.ok(r.mid, "half to each side"); assert.ok(r.follows);
  assert.deepStrictEqual(r.back, [0, 1.5]);
  assert.deepStrictEqual(r.mono, [true, "mono"]);
  assert.strictEqual(r.mapThin, true); assert.strictEqual(r.mapBack, true); assert.strictEqual(r.fitThin, true);
  assert.deepStrictEqual(r.see, ["translucent", true, 0.5, true]);
  assert.strictEqual(r.off3, 0.35);
  assert.deepStrictEqual(r.front, ["front", false, 1, false]);
});

test("r17b / 3: Isolate Selection and Hide 3D Pattern hide a pattern's wireframe and thick cloth with it, in every style", () => {
  const o = boot({ three: true, script: SEWN + `
    app.ev("setWire3")(true); app.ev("setRender3")("thick");
    const itB = G3.items.get(B.id);
    S.sel = [A.id]; app.ev("isolate3")();
    out.iso = [it.wire.visible, it.thick.visible, itB.obj.visible, itB.wire.visible, itB.thick.visible];
    app.ev("isolate3")();
    A.hide3 = true; app.commit(); app.ev("garmentSync")();
    out.hide = [it.obj.visible, it.wire.visible, it.thick.visible, itB.thick.visible];
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.iso, [true, true, false, false, false]);
  assert.deepStrictEqual(r.hide, [false, false, false, true]);
});

test("r17b / 3: the avatar's Translucent Surface (one see-through grey) and Show Avatar Joints (Shift+X: a line a bone, a dot a joint, seen through the body, following its pose); none of it with no avatar", () => {
  const o = boot({ three: true, blank: true, script: `
    const out = {};
    app.ev("setLayout")("both");
    out.none = (() => { app.ev("setJoints3")(true); const g = app.view3d.group("joints"); return g.children.length; })();
    app.ev("setJoints3")(false);
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      app.ev("setAvatar")({ display: "translucent" });
      const body = app.ev("avatarSolid")(S.av)[0];
      out.see = [body.material.transparent, body.material.opacity, body.material.depthWrite];
      const rows = app.ev("menuDisplay")().filter(Boolean).find(x => x.n === "Avatar Rendering Style").menu().filter(Boolean).map(x => x.n + (x.on ? " *" : ""));
      out.rows = rows;
      app.ev("setAvatar")({ display: "textured" }); out.back = body.material.transparent === true;
      app.key("X", { shiftKey: true });
      const g = app.view3d.group("joints"), [lines, rim, dots] = g.children;
      out.joints = [S.ui.joints3, g.children.length, dots.geometry.attributes.position.count === g.userData.n, lines.geometry.attributes.position.count > 40, dots.material.depthTest];
      const y0 = dots.geometry.attributes.position.array[1];
      app.ev("setAvatar")({ height: 1500 });
      const d2 = app.view3d.group("joints").children[2];
      out.scaled = d2.geometry.attributes.position.array[1] !== y0;
      const ai = app.ev("avatarItems")().filter(Boolean).find(x => x.n === "Show Avatar Joints"); out.item = [ai.on, ai.k, !!ai.nb];
      app.ev("removeAvatar")(); out.gone = app.view3d.group("joints").children.length;
      return out;
    });` });
  const r = o.result;
  assert.strictEqual(r.none, 0);
  assert.deepStrictEqual(r.see, [true, 0.35, false]);
  assert.deepStrictEqual(r.rows, ["Textured Surface", "Monochrome Surface", "Translucent Surface *"]);
  assert.strictEqual(r.back, false);
  assert.deepStrictEqual(r.joints, [true, 3, true, true, false]);
  assert.strictEqual(r.scaled, true); assert.deepStrictEqual(r.item, [true, "Shift+X", false]); assert.strictEqual(r.gone, 0);
});

test("r17b / 3: the 3D display switches go into the file with the rest of the display settings (Show Wireframe, Show Avatar Joints, the style)", () => {
  const o = boot({ three: true, script: SEWN + `
    app.ev("setWire3")(true); app.ev("setJoints3")(true); app.ev("setRender3")("thickBack");
    const d = JSON.parse(JSON.stringify(app.ev("docObj")()));
    out.saved = [d.display.wire3, d.display.joints3, d.display.render3];
    app.ev("setWire3")(false); app.ev("setJoints3")(false); app.ev("setRender3")("front");
    app.ev("setPrefs")({ openDisplay: true }); app.ev("loadDoc")(d);
    out.back = [S.ui.wire3, S.ui.joints3, S.ui.render3];
    return out;` });
  assert.deepStrictEqual(o.result, { saved: [true, true, "thickBack"], back: [true, true, "thickBack"] });
});

/* ---- batch 4: Snapshot ---- */
// the two rectangles alone (the boot's own pattern taken away), A with a notch, a seam allowance, an internal line and a punch mark
const SNAPDOC = DOC + `
  S.pieces.splice(0, S.pieces.length, A); S.seams.length = 0;
  A.segs[0].notches = [0.5]; for (const sg of A.segs) sg.sa = 10;
  app.ev("addChild")(A, "internals", app.mkShape([{x:50,y:200},{x:150,y:200}], false));
  A.punches.push({ x: 100, y: 150, d: 4 });
  app.commit();
  const job = (patch) => { const o = app.ev("snap2Default")(); patch && patch(o); return app.ev("snap2Job")(o); };
  const layers = (j) => [...new Set((j.svg.match(/data-layer="([^"]+)"/g) || []).map(x => x.slice(12, -1)))].sort();
`;
test("r17b / 4: the 2D snapshot's drawing: every kind of line ticked by default and no extra information; a kind left out is not drawn; its own colour and line style; true size at Scale, in pixels at Resolution", () => {
  const o = boot({ script: SNAPDOC + `
    const j0 = job();
    const ob = app.ev("outBounds")([A]);
    out.layers = layers(j0); out.mm = [+j0.wmm.toFixed(3), +j0.hmm.toFixed(3), +(ob.x1 - ob.x0 + 20).toFixed(3), +(ob.y1 - ob.y0 + 20).toFixed(3)]; out.px = [j0.wpx, j0.hpx, j0.ppi, Math.round(j0.wmm/25.4*127)];
    out.noGrid = !/grid|sewing/.test(j0.svg);
    const j1 = job((o) => { o.lines.internal.show = false; o.lines.notchSA.show = false; o.lines.outline.color = "#0072b2"; o.lines.outline.dash = "dotted"; o.scale = 50; o.ppi = 254; });
    out.layers1 = layers(j1);
    out.outline = (j1.svg.match(/<path data-layer="outline"[^>]*>/) || [""])[0];
    out.half = [+j1.wmm.toFixed(3), j1.wpx];
    // Default Line is the kind's usual look: a baseline dashed
    const b = app.ev("snap2Default")().lines.baseline; out.baseDefault = [b.dash, b.color];
    // the extra information and the pictures, when asked for
    const j2 = job((o) => { for (const k of Object.keys(o.info)) o.info[k] = true; o.unit = true; o.texture = true; o.graphic = true; });
    out.layers2 = layers(j2); out.unit = /data-layer="length"[^>]*>[0-9.]+ mm</.test(j2.svg);
    // too large a picture: the resolution comes down until it fits
    const j3 = job((o) => { o.ppi = 1200; o.scale = 1000; });
    out.big = [j3.ppi < 1200, j3.wpx <= 16384, j3.hpx <= 16384];
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.layers, ["internal", "notch", "notchSA", "outline", "punch", "sa"]);
  assert.deepStrictEqual(r.mm.slice(0, 2), r.mm.slice(2), "what is drawn and 10 mm round it"); assert.ok(r.mm[0] >= 240);
  assert.deepStrictEqual([r.px[0], r.px[2]], [r.px[3], 127], "at 127 ppi");
  assert.ok(r.noGrid);
  assert.deepStrictEqual(r.layers1, ["notch", "outline", "punch", "sa"]);
  assert.ok(/stroke="#0072b2"/.test(r.outline) && /stroke-dasharray="0.5 1.5"/.test(r.outline), r.outline);
  assert.deepStrictEqual(r.half, [r.mm[0]/2, Math.round(r.mm[0]/2/25.4*254)], "half the size at Scale 50 %, at 254 ppi");
  assert.deepStrictEqual(r.baseDefault, ["default", "#0066cc"]);
  assert.deepStrictEqual(r.layers2, ["grainline", "internal", "length", "name", "notch", "notchSA", "outline", "punch", "sa", "size", "texture"].filter(k => k !== "size" || r.layers2.includes("size")));
  assert.ok(r.unit, "line lengths with their unit");
  assert.deepStrictEqual(r.big, [true, true, true]);
});

test("r17b / 4: the 2D Snapshot box: File Format, Resolution, Scale, Rotation, the eleven line kinds with a style and a colour each, Add'l Information, Show Images; its choices kept per machine; DXF through the DXF export", () => {
  const o = boot({ script: SNAPDOC + `
    app.menuClick && 0;
    const rows = app.ev("menuFile")().filter(Boolean).find(x => x.n === "Snapshot").menu().filter(Boolean).map(x => x.n || (x.hd && "# " + x.hd));
    out.rows = rows;
    app.ev("snap2Dialog")({ x: 10, y: 10 });
    const h = app.el("dlg").innerHTML;
    out.title = /2D Snapshot/.test(h);
    out.formats = (h.match(/<option value="(pdf|png|jpeg|aama|astm|dxf)"/g) || []).map(x => x.slice(15, -1));
    out.kinds = (h.match(/data-l="[A-Za-z]+"/g) || []).length; out.colours = (h.match(/data-c="/g) || []).length; out.styles = (h.match(/data-d="/g) || []).length;
    out.info = ["Pattern Name", "Pattern Annotations", "Line Length", "Show unit", "Grainline", "Button/Buttonholes", "2D Measurements", "Pattern Texture", "Graphic", "Reset", "Save", "Cancel"].every(t => h.includes(t));
    // a change is kept for the next time
    const dlg = app.el("dlg"); dlg.querySelector = (q) => (q === "#sn-sum" ? { textContent: "" } : { onclick: null });
    dlg.onchange({ target: { dataset: { s: "fmt" }, value: "aama" } });
    out.kept = JSON.parse(app.storage.get("pdraft:snapshot")).d2.fmt;
    // Save as DXF-AAMA: the DXF export's text
    let got = null; app.setDownload((n, t) => { got = [n, /SECTION/.test(String(t))]; });
    app.ev("snap2Save")(app.ev("loadSnap")().d2);
    out.dxf = got;
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.rows, ["2D Patterns (1:1)…", "3D Window…", "# Ours", "2D Window as a Picture"]);
  assert.ok(r.title); assert.deepStrictEqual(r.formats, ["pdf", "png", "jpeg", "dxf", "aama", "astm"], "with Show Tools That Are Not Built Yet on, DXF - Standard too");
  assert.deepStrictEqual([r.kinds, r.colours, r.styles], [11, 11, 11]); assert.ok(r.info);
  assert.strictEqual(r.kept, "aama"); assert.deepStrictEqual(r.dxf, ["pattern-snapshot.dxf", true]);
});

test("r17b / 4: a 2D snapshot as PDF: the desktop app writes it as lines at true size through its PDF writer; a browser's PDF is one page of the patterns' true size with the picture over it", () => {
  const o = boot({ desktop: { store: {} }, script: SNAPDOC + `
    app.desk.dialog = "C:/out/pattern-snapshot.pdf";
    const s = app.ev("snap2Default")(); s.fmt = "pdf";
    app.ev("snap2Save")(s);
    out.calls = app.desk.calls.filter(c => c[0] === "pdf");
    // the browser's PDF: a JPEG of 4 × 2 px on a page of 100 × 50 mm
    const jpg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]), pdf = app.ev("pdfOfJpeg")(jpg, 4, 2, 100, 50), text = new TextDecoder("latin1").decode(pdf);
    out.head = text.slice(0, 8); out.box = /MediaBox \\[0 0 283.465 141.732\\]/.test(text); out.img = /Width 4 \\/Height 2 .*DCTDecode \\/Length 7/.test(text);
    // the cross-reference table points at each object
    const xs = +text.match(/startxref\\n(\\d+)/)[1], tab = text.slice(xs).split("\\n").slice(3, 8).map(l => +l.slice(0, 10));
    out.xref = tab.length === 5 && tab.every((off, k) => text.slice(off).startsWith((k + 1) + " 0 obj"));
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.calls, [["pdf", "pattern-snapshot.pdf", true]]);
  assert.strictEqual(r.head, "%PDF-1.4"); assert.ok(r.box, "100 × 50 mm in points"); assert.ok(r.img); assert.ok(r.xref);
});

test("r17b / 4: the 3D snapshot: a size from a preset at the Resolution or typed in; Multiview's views side by side, one above the other or in a box; each view from its own camera; Transparent Background; Save Separate Images; F10 opens it", () => {
  const o = boot({ three: true, desktop: { store: {} }, script: SEWN + `
    const size = (p) => app.ev("snap3Size")({ ...app.ev("snap3Default")(), ...p });
    out.sizes = [size({}), size({ preset: "a4" }), size({ preset: "a4", orient: "landscape" }), size({ preset: "hd1080", orient: "landscape" }), size({ preset: "hd1080" }), size({ preset: "custom", unit: "mm", w: 100, h: 50, ppi: 254 })];
    const plan = (p) => { const q = app.ev("snap3Plan")({ ...app.ev("snap3Default")(), w: 100, h: 200, ...p }); return [q.W, q.H, q.views.map(v => v.view + "@" + v.x + "," + v.y).join(" ")]; };
    out.plans = [plan({}), plan({ mode: "multi" }), plan({ mode: "multi", layout: "vertical", count: 2 }), plan({ mode: "multi", layout: "box", count: 5 })];
    // the shots: the window's own shot stood in for (a test has no WebGL), so what is asked of it can be read
    const asked = [], fake = () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => "data" + ":image/png;base64,iVBORw0KGgo=" });
    app.view3d.shot = (w, h, name, box, transparent) => { asked.push([w, h, name, !!box, transparent]); return fake(); };
    const files = []; app.setDownload((n) => { files.push(n); }); app.desk.dialog = "C:/out/x.png";
    app.ev("snap3Save")({ ...app.ev("snap3Default")(), mode: "multi", count: 3, w: 100, h: 200, transparent: true });
    out.asked = asked.slice(); out.files = files.slice();
    files.length = 0; asked.length = 0;
    app.ev("snap3Save")({ ...app.ev("snap3Default")(), mode: "multi", count: 2, separate: true, w: 100, h: 200 });
    out.separate = files.slice();
    files.length = 0; asked.length = 0;
    app.ev("snap3Save")({ ...app.ev("snap3Default")(), w: 100, h: 200 });
    out.single = [asked, files.slice()];
    // F10 opens the box; Single and Multiview
    app.key("F10");
    out.f10 = /Single/.test(app.el("dlg").innerHTML) && /Multiview/.test(app.el("dlg").innerHTML) && /Transparent Background/.test(app.el("dlg").innerHTML);
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.sizes, [{ w: 686, h: 931 }, { w: 595, h: 842 }, { w: 842, h: 595 }, { w: 1920, h: 1080 }, { w: 1080, h: 1920 }, { w: 1000, h: 500 }]);
  assert.deepStrictEqual(r.plans, [[100, 200, "null@0,0"], [400, 200, "front@0,0 right@100,0 left@200,0 back@300,0"], [100, 400, "front@0,0 right@0,200"], [300, 400, "front@0,0 right@100,0 left@200,0 back@0,200 back@100,200"]]);
  assert.deepStrictEqual(r.asked, [[100, 200, "front", true, true], [100, 200, "right", true, true], [100, 200, "left", true, true]]);
  assert.deepStrictEqual(r.files, ["snapshot-3d.png"]);
  assert.deepStrictEqual(r.separate, ["snapshot-3d-1-front.png", "snapshot-3d-2-right.png"]);
  assert.deepStrictEqual(r.single, [[[100, 200, null, false, false]], ["snapshot-3d.png"]]);
  assert.strictEqual(r.f10, true);
});

/* ---- batches 5 and 6: Trace's Shape mode and its four buttons ---- */
// A and B two overlapping rectangles (A 0..200 × 0..400, B 100..300 × 100..500), A with an internal line inside it and a hole
const SHAPES = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  const rect = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}], true));
  const A = rect("A", 0, 0, 200, 400), B = rect("B", 100, 100, 200, 400);
  S.pieces.push(A, B);
  app.ev("addChild")(A, "internals", app.mkShape([{x:20,y:20},{x:80,y:20}], false));
  const H = app.mkShape([{x:20,y:300},{x:60,y:300},{x:60,y:340},{x:20,y:340}], true); H.hole = true; app.ev("addChild")(A, "internals", H);
  app.commit(); S.undo.length = 0; S.un.length = 0;
  const out = {}, area = (sh) => Math.round(Math.abs(app.ev("signedArea")(app.ev("flatten")(sh, 32))));
  const pick = (x, y, shift) => app.click(x, y, shift ? { shiftKey: true } : {});
`;
test("r17b / 5: Shape mode's panel has the four buttons (dim until a shape is selected); patterns are picked by clicks, Shift adds, in the order picked; leaving the mode or the tool drops them", () => {
  const o = boot({ script: SHAPES + `
    app.setTool("trace"); app.ev("setTraceMode")("shape");
    const panel = () => app.el("tracepanel").innerHTML;
    out.dim = (panel().match(/data-op="[a-z]+"[^>]*disabled/g) || []).length;
    out.names = (panel().match(/data-op="([a-z]+)"/g) || []).map(x => x.slice(9, -1));
    pick(150, 50); pick(250, 450, true);
    out.sel = S.traceShapes.map(r => S.pieces.find(p => p.id === r.pid).name + (r.id ? "/shape" : ""));
    out.lit = (panel().match(/data-op="[a-z]+"[^>]*disabled/g) || []).length;
    // an internal shape: a click inside the hole picks it, not the pattern
    pick(40, 320, true); out.inner = S.traceShapes.length === 3 && S.traceShapes[2].id === A.internals[1].id;
    app.ev("draw")();
    app.ev("setTraceMode")("line"); out.line = [S.traceShapes.length, /data-op/.test(panel())];
    app.ev("setTraceMode")("shape"); pick(150, 50); app.setTool("edit_pattern"); out.left = S.traceShapes.length;
    out.steps = S.un.length;
    return out;` });
  const r = o.result;
  assert.strictEqual(r.dim, 4); assert.deepStrictEqual(r.names, ["trace", "fill", "trim", "slice"]);
  assert.deepStrictEqual(r.sel, ["A", "B"]); assert.strictEqual(r.lit, 0); assert.strictEqual(r.inner, true);
  assert.deepStrictEqual(r.line, [0, false]); assert.strictEqual(r.left, 0); assert.strictEqual(r.steps, 0, "selecting is no step");
});

test("r17b / 5: Trace makes one pattern of the combined outline that hangs on the pointer until a click sets it down; the internal line and the hole come along; the originals stay; one undo step", () => {
  const o = boot({ script: SHAPES + `
    app.setTool("trace"); app.ev("setTraceMode")("shape"); pick(150, 50); pick(250, 450, true);
    const before = JSON.stringify(S.pieces.map(p => [p.name, p.pts]));
    app.ev("traceOp")("trace");
    out.hanging = [!!S.place, S.pieces.length];
    app.fire("pointermove", { x: 900, y: 300 }); app.click(900, 300);
    const N = S.pieces[2];
    out.made = [S.pieces.length, N && N.pts.length, N && area(N), N && N.internals.map(it => (it.hole ? "hole " : "line ") + it.pts.length)];
    out.same = JSON.stringify(S.pieces.slice(0, 2).map(p => [p.name, p.pts])) === before;
    out.moved = N && Math.min(...N.pts.map(q => q.x)) > 300;
    out.steps = S.un.map(s => s.n); out.sel = !!N && S.sel.length === 1 && S.sel[0] === N.id;
    app.ev("undo")(); out.undone = S.pieces.length;
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.hanging, [true, 2], "nothing in the document before the click");
  assert.deepStrictEqual(r.made, [3, 8, 130000, ["line 2", "hole 4"]]);
  assert.ok(r.same, "the originals as they were"); assert.ok(r.moved, "set down where clicked");
  assert.deepStrictEqual(r.steps, ["Trace"]); assert.ok(r.sel); assert.strictEqual(r.undone, 2);
});

test("r17b / 6: Fill & Trace closes the gap a ring of patterns makes and carries nothing over; Trace keeps the gap as a hole", () => {
  const o = boot({ script: SHAPES + `
    S.pieces.length = 0;
    const r1 = rect("1", 0, 0, 300, 50), r2 = rect("2", 250, 0, 50, 300), r3 = rect("3", 0, 250, 300, 50), r4 = rect("4", 0, 0, 50, 300);
    app.ev("addChild")(r1, "internals", app.mkShape([{x:20,y:20},{x:80,y:20}], false));
    S.pieces.push(r1, r2, r3, r4); app.commit();
    const sel = S.pieces.map(p => ({ p, sh: p, id: 0 }));
    const t = app.ev("traceOpPieces")("trace", sel), f = app.ev("traceOpPieces")("fill", sel);
    out.trace = t.map(q => [area(q), q.internals.map(it => (it.hole ? "hole " + area(it) : "line")).sort()]);
    out.fill = f.map(q => [area(q), q.internals.length]);
    return out;` });
  assert.deepStrictEqual(o.result, { trace: [[90000, ["hole 40000", "line"]]], fill: [[90000, 0]] });
});

test("r17b / 6: Trim: the shape picked last is the cutter (hatched, dashed and named while Trim is under the pointer); each other less what it covers; a cutter inside punches a hole; one shape alone gets the recorded message", () => {
  const o = boot({ script: SHAPES + `
    app.setTool("trace"); app.ev("setTraceMode")("shape");
    pick(150, 50); app.ev("traceOp")("trim");
    pick(250, 450, true);
    S.traceOp = "trim"; app.ev("draw")(); S.traceOp = null;
    const t = app.ev("traceOpPieces")("trim", app.ev("traceShapes")());
    out.trim = t.map(q => [q.pts.length, area(q), q.internals.map(it => (it.hole ? "hole" : "line")).sort()]);
    // B picked first, A last: B less A
    const u = app.ev("traceOpPieces")("trim", [{ p: B, sh: B, id: 0 }, { p: A, sh: A, id: 0 }]);
    out.other = u.map(q => [q.pts.length, area(q)]);
    // a cutter wholly inside
    const C = rect("C", 100, 150, 50, 50); S.pieces.push(C); app.commit();
    const h = app.ev("traceOpPieces")("trim", [{ p: A, sh: A, id: 0 }, { p: C, sh: C, id: 0 }]);
    out.hole = h.map(q => [area(q), q.internals.filter(it => it.hole).map(area).sort((a, b) => a - b)]);
    // the cutter covering everything
    out.none = app.ev("traceOpPieces")("trim", [{ p: C, sh: C, id: 0 }, { p: A, sh: A, id: 0 }]);
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(o.modals.map(m => [m.title, m.text]), [["Information", "Trim needs at least two selected areas: one to keep and one as the cutter."]]);
  assert.deepStrictEqual(r.trim, [[6, 50000, ["hole", "line"]]], "A less B: an L of six corners, its internal line and hole with it");
  assert.deepStrictEqual(r.other, [[6, 50000]]);
  assert.deepStrictEqual(r.hole, [[80000, [1600, 2500]]], "A's own hole and the one the cutter punched");
  assert.ok(/nothing is left/.test(r.none), r.none);
});

test("r17b / 6: Slice makes each region covered by the same shapes its own pattern; Trace and Slice keep a curved line's curve, and the parts add up", () => {
  const o = boot({ script: SHAPES + `
    const s = app.ev("traceOpPieces")("slice", [{ p: A, sh: A, id: 0 }, { p: B, sh: B, id: 0 }]);
    out.slice = s.map(q => area(q)).sort((a, b) => a - b);
    const D = rect("D", 100, 100, 200, 400); D.segs[0].curved = true; D.segs[0].cps = [{ x: 200, y: 50 }]; S.pieces.push(D); app.commit();
    const L = [{ p: A, sh: A, id: 0 }, { p: D, sh: D, id: 0 }];
    const tr = app.ev("traceOpPieces")("trace", L)[0], sl = app.ev("traceOpPieces")("slice", L), tm = app.ev("traceOpPieces")("trim", L)[0];
    out.curved = [tr.segs.some(sg => sg.curved), sl.some(q => q.segs.some(sg => sg.curved))];
    const parts = sl.map(area), total = parts.reduce((a, b) => a + b, 0), shared = area(A) + area(D) - area(tr);
    out.sum = [Math.abs(total - area(tr)) <= 3, parts.some(a => Math.abs(a - shared) <= 3), Math.abs(area(tm) + shared - area(A)) <= 3];
    return out;` });
  const r = o.result;
  assert.deepStrictEqual(r.slice, [30000, 50000, 50000]);
  assert.deepStrictEqual(r.curved, [true, true]); assert.deepStrictEqual(r.sum, [true, true, true], "the slices make the whole; one of them is what A and D share; A less D and that make A");
});

module.exports = T;
