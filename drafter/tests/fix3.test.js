// Round FIX-3: the maintainer's feedback of 10 Nov and the roadmap's FIX-3 rows.
// Batch A: the 2D window's horizontal axis is the 3D floor; the avatar's outline stands on it, on by default, a fill with no line.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
// long scripts go through a file (Windows' command line limit)
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-fix3-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o.result;
}
const PRESET = (n) => path.join(__dirname, "..", "assets", "avatar", "presets", n + ".glb");
const has = (n) => fs.existsSync(PRESET(n));

// the outline as built, and the avatar's own posed triangles, compared: lowest point, top, the front's x range
const LOOK = `
  const look = (mode) => {
    app.ev("draw")(); app.runTimers(); app.ev("draw")();
    const o = mode ? app.ev("avOutBuild")(mode, false) : app.ev("avOutNow")();
    const T = app.ev("avatarTris")(S.av);
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < T.length; i += 3) { if (T[i+1] < y0) y0 = T[i+1]; if (T[i+1] > y1) y1 = T[i+1]; if (T[i] < x0) x0 = T[i]; if (T[i] > x1) x1 = T[i]; }
    let bottom = 0; for (let x = 0; x < o.w; x++) bottom += o.mask[x];
    return { mode: o.mode, box: o.box, height: o.height, tall: +(y1 - y0).toFixed(1), floor: +o.floor.toFixed(2), lowest: +y0.toFixed(2), bottom, x: [+x0.toFixed(1), +x1.toFixed(1)] };
  };
`;
const onLine = (v) => v.box.y1 === 0 && v.bottom > 0 && Math.abs(v.floor - v.lowest) < 1e-6 && Math.abs(v.height - v.tall) <= 1.5;

test("FIX-3 / A: the avatar's outline stands on the 2D window's horizontal axis (the 3D floor), on by default once Marty is loaded, at his true x seen from the front, mirrored from the back; still on the line after an Avatar Size change, a new height and a pose that lifts a leg" + (has("marty") ? "" : " (Marty is not here: skipped)"), () => {
  if (!has("marty")) return;
  const r = boot({ blank: true, three: true, script: LOOK + `
    return (async () => {
      const out = { start: S.ui.avOut, none: app.ev("avOutNow")() };
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      out.marty = look(); out.back = look("back"); out.side = look("side");
      app.ev("sizeTyped")("waist", 900); out.sized = look();
      app.ev("setAvatar")({ height: 1700 }); out.tall = look();
      app.ev("setAvatar")({ pose: { thighL: [-60, 0, 0] } }); out.posed = look();
      return out;
    })();` });
  assert.strictEqual(r.start, "front", "Front by default (the maintainer's brief)");
  assert.strictEqual(r.none, null, "nothing drawn while there is no avatar");
  for (const k of ["marty", "sized", "tall", "posed"]) assert.ok(onLine(r[k]), k + ": the lowest point on the line, as tall as the avatar: " + JSON.stringify(r[k]));
  assert.strictEqual(r.marty.mode, "front");
  assert.ok(Math.abs(r.marty.box.x0 - r.marty.x[0]) <= 2 && Math.abs(r.marty.box.x1 - r.marty.x[1]) <= 2, "the front at the avatar's own x (the vertical axis is 3D x = 0): " + JSON.stringify([r.marty.box, r.marty.x]));
  assert.ok(Math.abs(r.back.box.x0 + r.marty.box.x1) <= 2 && Math.abs(r.back.box.x1 + r.marty.box.x0) <= 2, "the back mirrored: " + JSON.stringify([r.back.box, r.marty.box]));
  assert.ok(onLine(r.back) && onLine(r.side) && r.side.box.x1 - r.side.box.x0 < r.back.box.x1 - r.back.box.x0, "back and side on the line, the side narrower");
  assert.ok(Math.abs(r.tall.height - 1700) <= 1.5, "the new height: " + r.tall.height);
});

test("FIX-3 / A: Jessica's outline on the line too; the outline is drawn as a fill with no line round it and never printed; a file's own choice (Off) comes back with it, a file with none opens at Front; a stored offset from beta.6 is kept in the file and moves nothing" + (has("jessica") ? "" : " (Jessica is not here: skipped)"), () => {
  if (!has("jessica")) return;
  const r = boot({ blank: true, three: true, script: LOOK + `
    return (async () => {
      const out = {};
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/jessica.glb"), "jessica.glb", null, true); await app.wait(() => S.av, "Jessica");
      out.jess = look();
      app.push("Rectangle"); S.pieces.push(app.mkPiece("Front", app.mkShape([{ x: -150, y: -1300 }, { x: 150, y: -1300 }, { x: 150, y: -900 }, { x: -150, y: -900 }], true))); app.commit();
      const printOn = app.ev("printInner")(S.pieces, S.print);
      app.ev("setAvOut")("off"); const printOff = app.ev("printInner")(S.pieces, S.print);
      out.print = printOn === printOff;
      // Off saved: in the file's display settings, and back on opening even with the display settings preference off
      let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null);
      out.fileOff = (app.fileDoc(got).display || {}).avOut;
      app.ev("setAvOut")("back");
      app.ev("openFile")("o.pdraft", got, null, true); await app.wait(() => S.av, "Jessica again");
      out.reopenedOff = S.ui.avOut;
      // Front (the default) is not written; a file with none opens at Front whatever the session had
      app.ev("setAvOut")("front"); S.avedit.outline = { dy: 40 };
      let got2 = null; app.setDownload((n, b) => { got2 = b; }); app.saveDoc(false); app.setDownload(null);
      const d2 = app.fileDoc(got2); out.fileFront = (d2.display || {}).avOut === undefined; out.dy = (d2.avedit || {}).outline;
      app.ev("setAvOut")("side");
      app.ev("openFile")("o2.pdraft", got2, null, true); await app.wait(() => S.av, "Jessica a third time");
      out.reopenedFront = S.ui.avOut; out.after = look();
      let got3 = null; app.setDownload((n, b) => { got3 = b; }); app.saveDoc(false); app.setDownload(null);
      out.dy2 = (app.fileDoc(got3).avedit || {}).outline;
      return out;
    })();` });
  assert.ok(onLine(r.jess), "Jessica on the line: " + JSON.stringify(r.jess));
  assert.strictEqual(r.print, true, "the printed drawing is the same with the outline on and off");
  assert.strictEqual(r.fileOff, "off");
  assert.strictEqual(r.reopenedOff, "off", "the file's own choice wins on opening");
  assert.strictEqual(r.fileFront, true, "Front, the default, is not written");
  assert.strictEqual(r.reopenedFront, "front", "a file with none opens at Front");
  assert.deepStrictEqual([r.dy, r.dy2], [{ dy: 40 }, { dy: 40 }], "beta.6's stored offset is kept as it was");
  assert.ok(onLine(r.after), "and moves nothing: " + JSON.stringify(r.after));
});

test("FIX-3 / A: a new pattern stands in 3D where its 2D place says, the 2D axes being the floor and the centre line: above the line above the floor, below it under the floor; Edit Avatar Outline is gone", () => {
  const r = boot({ blank: true, three: true, script: `
    const mk = (n, x0, y0, x1, y1) => { app.push("Rectangle"); S.pieces.push(app.mkPiece(n, app.mkShape([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], true))); app.commit(); return S.pieces[S.pieces.length - 1]; };
    const a = mk("Above", 100, -900, 300, -500), b = mk("Below", -400, 100, -200, 300);
    const out = { a: a.p3.pos.map(v => Math.round(v)), b: b.p3.pos.map(v => Math.round(v)), home: S.home3 };
    out.rows = app.ev("avOutRows")().map(x => x.n).filter(Boolean);
    return out;` });
  assert.deepStrictEqual(r.a.slice(0, 2), [200, 700], "the middle 700 mm above the floor, 200 mm to x: " + r.a);
  assert.deepStrictEqual(r.b.slice(0, 2), [-300, -200], "below the line: under the floor: " + r.b);
  assert.strictEqual(r.a[2], r.b[2], "both in front of the avatar's place");
  assert.strictEqual(r.home, null, "no layout middle is kept any more");
  assert.deepStrictEqual(r.rows, ["Off", "Front", "Back", "Side (Left)", "Include Objects"]);
});

// Batch B: the arrangement points as the reference lays them out
const ARR = `
  const arrLook = () => {
    S.arr = null; const L = app.ev("arrList")(), f = app.ev("avatarField")(S.av), C = app.ev("SIM3D");
    const set = app.ev("arrSet")(S.av), raw = new Map(set.pts.map(p => [p.id, p]));
    const facing = (p) => { const q = raw.get(p.id); if (/(outer|inner)$/.test(p.id)) return "side"; if (q.bv === "body" && (q.x === 25 || q.x === 75)) return "side"; return q.x > 25 && q.x < 75 ? "back" : "front"; };
    const count = { front: 0, back: 0, side: 0 };
    for (const p of L) count[facing(p)]++;
    // a point's mirror: x negated, the same height and depth (the body is not perfectly symmetric)
    const twin = (id) => id.replace(/L_/, "#_").replace(/R_/, "L_").replace("#_", "R_").replace(/_left$/, "_#").replace(/_right$/, "_left").replace(/_#$/, "_right");
    let worst = 0; const unpaired = [];
    for (const p of L) { const q = L.find(x => x.id === twin(p.id)); if (!q) { unpaired.push(p.id); continue; } worst = Math.max(worst, Math.abs(p.a[0] + q.a[0]), Math.abs(p.a[1] - q.a[1]), Math.abs(p.a[2] - q.a[2])); }
    // on the body: the surface is rho out from the axis point along the point's way out (the field there near zero)
    let off = 0, inside = 0;
    for (const p of L) { const at = [0, 1, 2].map(c => p.a[c] + p.out[c]*p.rho), d = C.sdfAt(f, at[0], at[1], at[2]); off = Math.max(off, Math.abs(d)); if (!(p.rho > 0)) inside++; }
    const ids = L.map(p => p.id);
    const Y = ["head_front", "neck_front", "upperchest_front", "chest_front", "torso_front", "waist_front", "hip_front", "crotch_front", "kneeL_front", "ankleL_front", "shoulderL_front", "elbowL_front", "wristL_front"];
    return { n: L.length, count, worst: +worst.toFixed(1), unpaired, off: +off.toFixed(1), inside, ids: ids.length === new Set(ids).size, y: Object.fromEntries(Y.map(k => [k, Math.round(L.find(p => p.id === k).a[1])])) };
  };
`;
test("FIX-3 / B: 116 arrangement points on Marty and on Jessica (36 front, 36 back, 44 on the sides), the rows top to bottom as the reference's, every left point mirrored by a right one, every point on the body's surface, and still so after an Avatar Size change; the 50 before keep their ids" + (has("marty") && has("jessica") ? "" : " (the presets are not here: skipped)"), () => {
  if (!has("marty") || !has("jessica")) return;
  const r = boot({ blank: true, three: true, script: ARR + `
    return (async () => {
      const out = {};
      app.ev("setLayout")("both");
      for (const n of ["marty", "jessica"]) {
        app.ev("avatarLoaded")(app.read("../assets/avatar/presets/" + n + ".glb"), n + ".glb", null, true); await app.wait(() => S.av && S.av.preset === n, n);
        out[n] = arrLook();
      }
      app.ev("sizeTyped")("waist", 800); out.sized = arrLook();
      return out;
    })();` });
  for (const k of ["marty", "jessica", "sized"]) {
    const v = r[k];
    assert.strictEqual(v.n, 116, k);
    assert.deepStrictEqual(v.count, { front: 36, back: 36, side: 44 }, k + ": per side");
    assert.strictEqual(v.ids, true, k + ": every id once");
    // the points on the middle line have no twin; every other one has
    assert.deepStrictEqual(v.unpaired.filter(id => !/^[a-z]+_(front|back)$/.test(id)), [], k + ": every left or right point has its twin");
    assert.ok(v.worst <= 8, k + ": mirrored within 8 mm: " + v.worst);
    assert.ok(v.off <= 4 && v.inside === 0, k + ": every point on the body's surface: " + JSON.stringify([v.off, v.inside]));
    const y = v.y, order = ["head_front", "neck_front", "upperchest_front", "chest_front", "torso_front", "waist_front", "hip_front", "crotch_front", "kneeL_front", "ankleL_front"];
    for (let i = 1; i < order.length; i++) assert.ok(y[order[i]] < y[order[i-1]], k + ": " + order[i] + " below " + order[i-1] + ": " + JSON.stringify(y));
    assert.ok(y.shoulderL_front > y.elbowL_front && y.elbowL_front > y.wristL_front, k + ": down the arm");
  }
});

// Batch C: the tack tools show what they do before and between the clicks
test("FIX-3 / C: Tack shows a dot where the click would land before the first click, then the first place as a square, a line from it following the pointer and the dot under it; the second click makes the tack and clears the marks; Tack on Avatar the same, its line dashed and following the pointer off the body; Esc gives it up and clears them", () => {
  const r = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("setLayout")("both");
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces.push(sq("Front", 0, -1300, 300, 400)); const A = S.pieces[0];
    A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 };
    app.commit(); app.ev("garmentSync")();
    Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
    const pos = app.ev("tackPos"), scr = (x, y) => { const P = pos({ piece: A.id, x, y }); return v3.project(new THREE.Vector3(P[0], P[1], P[2])); };
    const at = (q) => ({ clientX: q.x, clientY: q.y, button: 0, buttons: 0, preventDefault() {} });
    const marks = () => { const g = v3.group("tacklive"); return { pts: g.children.filter(c => c.isPoints).length, lines: g.children.filter(c => c.isLine).length, dashed: g.children.some(c => c.isLine && c.material.isLineDashedMaterial) }; };
    app.setTool3("tack"); const T = app.TOOL3.tack;
    out.none = marks();
    T.hover(at(scr(150, -1200))); out.hover = [marks(), !!(G3.tackLive && G3.tackLive.hot)];
    T.down(at(scr(150, -1200))); out.first = [marks(), !!G3.tackFrom, S.tacks.length];
    T.hover(at(scr(150, -1000))); const L = G3.tackLive, P = pos({ piece: A.id, x: 150, y: -1000 });
    out.moving = [marks(), +Math.hypot(L.to[0] - P[0], L.to[1] - P[1], L.to[2] - P[2]).toFixed(1)];
    T.down(at(scr(150, -1000))); out.made = [marks(), S.tacks.length, !!G3.tackFrom, S.un[S.un.length - 1].n];
    // Tack on Avatar with no avatar: the first click marks, the line follows the pointer off the cloth at the first place's depth (dashed); Esc clears
    app.setTool3("tack_avatar"); const U = app.TOOL3.tack_avatar;
    U.down(at(scr(100, -1100))); U.hover(at({ x: scr(100, -1100).x + 300, y: scr(100, -1100).y }));
    const F = pos({ piece: A.id, x: 100, y: -1100 }), to = G3.tackLive.to;
    out.avatar = [marks(), G3.tackLive.hot, +Math.abs(to[2] - F[2]).toFixed(1)];
    app.key("Escape"); out.esc = [marks(), !!G3.tackFrom];
    return out;` });
  assert.deepStrictEqual(r.none, { pts: 0, lines: 0, dashed: false }, "nothing before the pointer is over the cloth");
  assert.deepStrictEqual(r.hover, [{ pts: 2, lines: 0, dashed: false }, true], "before the first click: the dot (a ring and its middle) under the pointer");
  assert.deepStrictEqual([r.first[1], r.first[2]], [true, 0]);
  assert.ok(r.first[0].pts >= 2, "after the first click: its place marked: " + JSON.stringify(r.first[0]));
  assert.deepStrictEqual(r.moving[0], { pts: 4, lines: 1, dashed: false }, "the first place, the line to the pointer, the dot under it");
  assert.ok(r.moving[1] < 2, "the line ends at the cloth under the pointer: " + r.moving[1]);
  assert.deepStrictEqual(r.made, [{ pts: 0, lines: 0, dashed: false }, 1, false, "Tack"], "the second click makes the tack and clears the marks");
  assert.deepStrictEqual(r.avatar[0], { pts: 2, lines: 1, dashed: true }, "Tack on Avatar: the first place and a dashed line, no dot off the body");
  assert.strictEqual(r.avatar[1], null);
  assert.ok(r.avatar[2] < 1, "off the body the line follows the pointer at the first place's depth: " + r.avatar[2]);
  assert.deepStrictEqual(r.esc, [{ pts: 0, lines: 0, dashed: false }, false], "Esc gives it up and clears the marks");
});

// FIX-3 rows: the tack's Property Editor (3.C10, 3.D2)
test("FIX-3 / F (3.C10, 3.D2): a tack selected with Edit Tack has its Property Editor (Name, Activate, Thread Length; Tack Strength only greyed with Show Tools That Are Not Built Yet); each change one step and in the file; switched off it holds nothing and is drawn dotted; its thread holds the two places that far apart and no further", () => {
  const r = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3;
    app.ev("setLayout")("both");
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces.push(sq("A", 0, -1300, 300, 400), sq("B", 400, -1300, 300, 400)); app.commit();
    const A = S.pieces[0], B = S.pieces[1];
    app.ev("addTack")({ piece: A.id, x: 150, y: -1100 }, { piece: B.id, x: 550, y: -1100 }, null);
    S.ui.unbuilt = false; app.setTool3("edit_tack"); G3.selTack = S.tacks[0].id; app.ev("ui")();
    const pr = app.el("props"), html = pr.innerHTML;
    out.rows = (html.match(/<label[^>]*>[^<]*<[/]label>/g) || []).map(s => s.replace(/<[^>]+>/g, ""));
    S.ui.unbuilt = true; app.ev("ui")(); out.nb = /Tack Strength/.test(app.el("props").innerHTML); S.ui.unbuilt = false; app.ev("ui")();
    const type = (id, v) => { const el = app.el(id); if (typeof v === "boolean") el.checked = v; else el.value = String(v); el.onchange(); };
    const n0 = S.undo.length;
    type("tk-name", "Shoulder tack"); type("tk-len", 40); type("tk-on", false);
    out.steps = [S.undo.length - n0, S.un.slice(-3).map(u => u.n)];
    out.tack = JSON.parse(JSON.stringify(S.tacks[0]));
    out.simOff = app.ev("simTacks")(app.SIM.order.length ? app.SIM.order : S.pieces.map(p => p.id)).seams.length;
    app.ev("showTacks")(); out.dotted = app.view3d.group("tacks").children.some(c => c.isLine && c.material.isLineDashedMaterial && c.material.dashSize < 2);
    type("tk-on", true);
    out.simOn = app.ev("simTacks")(S.pieces.map(p => p.id)).seams.map(s => s.len);
    let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null);
    out.file = app.fileDoc(got).tacks[0];
    return out;` });
  assert.deepStrictEqual(r.rows, ["Name", "Activate", "Thread Length (mm)"], "the rows of W16 (Tack Strength is greyed in the reference: only with the switch on)");
  assert.strictEqual(r.nb, true);
  assert.deepStrictEqual(r.steps, [3, ["Rename Tack", "Thread Length", "Deactivate Tack"]]);
  assert.deepStrictEqual([r.tack.name, r.tack.len, r.tack.off], ["Shoulder tack", 40, true]);
  assert.strictEqual(r.simOff, 0, "switched off: no stitch in the simulation");
  assert.strictEqual(r.dotted, true, "drawn dotted (and grey, smaller ends)");
  assert.deepStrictEqual(r.simOn, [40], "on again: a stitch with its thread");
  assert.deepStrictEqual([r.file.name, r.file.len, r.file.off], ["Shoulder tack", 40, undefined === r.file.off ? undefined : r.file.off], "in the file");
  // the thread in the solver: two loose points tied by 40 mm fall apart no further than 40 mm, and a stitch of 0 holds them together
  const C = require("../drafter-sim.js");
  const two = (len) => {
    const xy = new Float64Array([0, 0, 10, 0, 0, 10, 100, 0, 110, 0, 100, 10]), tri = new Uint32Array([0, 1, 2]);
    const sim = C.clothBuild({ pieces: [{ xy: xy.slice(0, 6), tri, X: new Float32Array([0, 1000, 0, 10, 1000, 0, 0, 1010, 0]), fab: {} }, { xy: xy.slice(6), tri, X: new Float32Array([100, 1000, 0, 110, 1000, 0, 100, 1010, 0]), fab: {} }],
      seams: [{ id: "t", pairs: [[{ p: 0, i: [0], w: [1] }, { p: 1, i: [0], w: [1] }]], ...(len ? { len } : {}) }], pins: [{ p: 0, v: 0 }, { p: 0, v: 1 }, { p: 0, v: 2 }], opt: { self: false, ground: false } });
    for (let f = 0; f < 120; f++) C.clothStep(sim, 1/60);
    const a = 0, b = 3*sim.off[1]; return Math.hypot(sim.x[a] - sim.x[b], sim.x[a+1] - sim.x[b+1], sim.x[a+2] - sim.x[b+2]);
  };
  const d40 = two(40), d0 = two(0);
  assert.ok(d40 <= 40 + 1.5 && d40 > 30, "a 40 mm thread: hangs at its length: " + d40.toFixed(2));
  assert.ok(d0 < 1.5, "no thread: held together: " + d0.toFixed(2));
});

// FIX-3 rows: the DXF export's options (1.S15b) and Base Dart (3.A15, 3.C26)
test("FIX-3 / H (1.S15b): Export DXF without seam allowance writes the seam line as the outline and no seam line of its own; the Text Codec writes the names in UTF-8 or Windows-1252 (a character it has not as ?); (3.A15) 2D ▸ Create ▸ Base Dart draws the Dart's shape as a closed baseline, not cut and not sewn, one step", () => {
  const r = boot({ blank: true, script: `
    const out = {};
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    app.push("Rectangle"); const P = sq("Größe €", 0, -600, 300, 400); for (const s of P.segs) s.sa = 10; S.pieces.push(P); app.commit();
    const ex = app.ev("dxfExport"), layer = (t, L) => (t.match(new RegExp("POLYLINE\\\\r?\\\\n *8\\\\r?\\\\n" + L + "\\\\r?\\\\n", "g")) || []).length;
    const withSA = ex([P], { format: "aama", metric: true, scale: 1, optimise: true }), noSA = ex([P], { format: "aama", metric: true, scale: 1, optimise: true, noSA: true });
    // layer 1's first vertex: the cut line 10 mm out with the allowance, the seam line without
    const firstX = (t) => { const i = t.indexOf("POLYLINE"), j = t.indexOf("VERTEX", i), m = t.slice(j).match(/\\n *10\\r?\\n *([-0-9.]+)/); return +m[1]; };
    out.sa = [layer(withSA, 1), layer(withSA, 14), firstX(withSA)]; out.nosa = [layer(noSA, 1), layer(noSA, 14), firstX(noSA)];
    const enc = app.ev("dxfEncode"), b = enc("Gr\\u00f6\\u00dfe \\u20ac \\u4e2d", "cp1252");
    out.cp = Array.from(b); out.utf = enc("x", "utf8");
    // Base Dart
    S.view = { s: 1, x: 300, y: 800 }; app.setTool("base_dart_double"); const c = app.toS({ x: 150, y: -400 });
    app.answer = (t, fields, o) => { out.title = t; return { wl: 20, wr: 20, up: 80, down: 80, pos: "center", l: undefined, r: undefined, u: undefined, d: undefined }; };
    const n0 = S.undo.length, seams0 = S.seams.length; app.click(c.x, c.y); app.answer = null;
    out.base = [S.undo.length - n0, S.un[S.un.length - 1].n, P.bases.length, (P.bases[0] || {}).closed, !!(P.bases[0] || {}).hole, P.internals.length, S.seams.length - seams0];
    out.menu = app.MENUS["2d"]().find(x => x.n === "Create").menu().some(x => x && x.n === "Base Dart");
    return out;` });
  assert.deepStrictEqual(r.sa.slice(0, 2), [1, 1], "with the allowance: the cut line on 1, the seam line on 14");
  assert.deepStrictEqual(r.nosa.slice(0, 2), [1, 0], "without: the outline only, no seam line of its own");
  assert.ok(Math.abs(r.sa[2] - r.nosa[2]) > 5, "the outline is the seam line: " + [r.sa[2], r.nosa[2]]);
  assert.deepStrictEqual(r.cp, [71, 114, 0xf6, 0xdf, 101, 32, 0x80, 32, 63], "Windows-1252: ö, ß, € in their bytes, a character it has not as ?");
  assert.strictEqual(r.utf, "x", "UTF-8: the text as it was");
  assert.strictEqual(r.title, "Create Dart");
  assert.deepStrictEqual(r.base, [1, "Base Dart", 1, true, false, 0, 0], "one step; a closed baseline, no hole, no internal shape, no seam");
  assert.strictEqual(r.menu, true, "2D ▸ Create ▸ Base Dart");
});

// FIX-3 rows: the gizmo's tack (1.S16a)
test("FIX-3 / G (1.S16a): the gizmo's tack: the dot at its middle; dragged onto another pattern the selected one is turned to face as that pattern faces there and laid 3 mm in front of it; over nothing it follows the pointer; one step, undone exactly; the square sits in the corner between X and Y", () => {
  const r = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE"), T3 = app.TOOL3.select_move;
    app.ev("setLayout")("both");
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces.push(sq("A", 0, -1300, 300, 400), sq("B", 400, -1300, 300, 400));
    const A = S.pieces[0], B = S.pieces[1];
    // B stands turned 40 degrees about the vertical, to the right of A
    const qB = app.ev("SIM3D").qAxis([0, 1, 0], 40);
    A.p3 = { pos: [-300, 1100, 300], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [350, 1100, 100], q: qB, r: 0 }; app.commit();
    app.setPrefs({ gizSpace: "world" });
    Object.assign(v3.cam, { az: 0, el: 0.05, dist: 3000, tx: 0, ty: 1100, tz: 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
    app.setTool3("select_move");
    const ev = (q, more) => ({ clientX: q.x, clientY: q.y, button: 0, buttons: 1, ...more });
    const mid = v3.project(new THREE.Vector3(-300, 1100, 300)); T3.down(ev(mid)); T3.up(ev(mid));
    const g = app.ev("gizGeom")();
    out.hits = [(app.ev("gizHit")(ev(g.o2)) || {}).id, (app.ev("gizHit")(ev(v3.project(app.ev("gizSqAt")(g)))) || {}).id];
    const n0 = app.histSteps().at, X0 = Array.from(G3.items.get(A.id).X);
    // the tack dragged onto B's middle
    const onB = v3.project(new THREE.Vector3(350, 1100, 100));
    T3.down(ev(g.o2)); T3.move(ev({ x: g.o2.x + 40, y: g.o2.y })); T3.move(ev(onB));
    out.read = app.el("giz3d").textContent;
    T3.up(ev(onB));
    // A's face now: the turn of its placement applied to +z, against B's
    const rot = (q) => { const o = [0, 0, 0]; app.ev("SIM3D").qRot(q, 0, 0, 1, o); return o; }, nA = rot(A.p3.q), nB = rot(B.p3.q);
    out.face = +(nA[0]*nB[0] + nA[1]*nB[1] + nA[2]*nB[2]).toFixed(4);
    // where the gizmo's point is now: on B's plane, 3 mm in front of it (along B's face, toward the camera)
    const X = G3.items.get(A.id).X, v = G3.giz.v, P = [X[3*v], X[3*v+1], X[3*v+2]], d = (P[0] - 350)*nB[0] + (P[1] - 1100)*nB[1] + (P[2] - 100)*nB[2];
    out.gap = +Math.abs(d).toFixed(2);
    out.step = [app.histSteps().at - n0, app.histSteps().steps[app.histSteps().at - 1].n];
    app.undo(); out.undone = Array.from(G3.items.get(A.id).X).every((x, i) => Math.abs(x - X0[i]) < 1e-6);
    // over nothing: it follows the pointer in the plane of the screen, its face unchanged
    app.redo(); app.undo();
    const g2 = app.ev("gizGeom")(); T3.down(ev(g2.o2)); T3.move(ev({ x: g2.o2.x, y: g2.o2.y - 120 })); T3.up(ev({ x: g2.o2.x, y: g2.o2.y - 120 }));
    const A2 = S.pieces.find(p => p.id === A.id); out.free = [A2.p3.pos[1] > 1100 + 20, A2.p3.q.map(q => +q.toFixed(6)).join()];
    return out;` });
  assert.deepStrictEqual(r.hits, ["tack", "free"], "the middle is the tack, the square in its corner moves in the plane of the screen");
  assert.ok(/^Laid on B/.test(r.read), "written beside the pointer: " + r.read);
  assert.ok(r.face > 0.999, "A now faces as B does there: " + r.face);
  assert.ok(Math.abs(r.gap - 3) < 0.5, "3 mm in front of B: " + r.gap);
  assert.deepStrictEqual(r.step, [1, "Tack in 3D"]);
  assert.strictEqual(r.undone, true);
  assert.deepStrictEqual(r.free, [true, "0,0,0,1"], "over nothing: moved, not turned");
});

// Batch D: the fabric's Detail rows
test("FIX-3 / D: the fabric's Property Editor has the recordings' Detail rows (Stretch-Weft / -Warp, Shear (Right) / (Left), Bending-Weft / -Warp / -Bias (Right) / (Left), Internal Damping, Friction) and no Buckling rows; a row typed is one step, kept only when not the preset's, in the file and back on opening; a preset chosen brings its own friction", () => {
  const r = boot({ blank: true, script: `
    const out = {}, pr = app.el("props");
    app.push("Fabric"); app.libAdd("fabric"); const fab = S.lib.fabric[S.lib.fabric.length - 1]; app.commit();
    app.ev("libProps")(pr, "fabric", fab);
    const html = pr.innerHTML;
    out.rows = (html.match(/<label>[^<]*<[/]label>/g) || []).map(s => s.replace(/<[^>]+>/g, "")).filter(s => /Stretch-|Shear|Bending|Damping|Friction|Buckling/.test(s));
    const type = (k, v) => { const el = app.el("ld-" + k); el.value = String(v); el.onchange(); };
    const n0 = S.undo.length;
    type("stretchWarp", 150); out.step = [S.undo.length - n0, S.un[S.un.length - 1].n, JSON.stringify(fab.dir)];
    type("stretchWarp", 100); out.back100 = "dir" in fab;
    type("bendBiasL", 40); type("damping", 70); type("friction", 0.8);
    out.phys = app.fabricPhys(fab);
    let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null);
    const saved = app.fileDoc(got).lib.fabric.find(f => f.id === fab.id); out.saved = [saved.dir, saved.friction];
    app.ev("openFile")("o.pdraft", got, null, true);
    const again = S.lib.fabric.find(f => f.id === fab.id); out.reopened = [again.dir, again.friction];
    // a preset chosen: its own friction again
    app.ev("libProps")(pr, "fabric", again); const ph = app.el("lp-physical"); ph.value = "Heavy woven"; ph.onchange();
    out.preset = [S.lib.fabric.find(f => f.id === fab.id).friction, app.fabricPhys(S.lib.fabric.find(f => f.id === fab.id)).friction, JSON.stringify(S.lib.fabric.find(f => f.id === fab.id).dir)];
    return out;` });
  assert.deepStrictEqual(r.rows, ["Stretch-Weft (%)", "Stretch-Warp (%)", "Shear (Right) (%)", "Shear (Left) (%)", "Bending-Weft (%)", "Bending-Warp (%)", "Bending-Bias (Right) (%)", "Bending-Bias (Left) (%)", "Internal Damping (%)", "Friction"], "the rows, in the recordings' order; no Buckling rows (nothing behind them in this solver)");
  assert.deepStrictEqual(r.step, [1, "Fabric Stretch-Warp", '{"stretchWarp":150}'], "one step, kept as typed");
  assert.strictEqual(r.back100, false, "100 % is the preset: not kept");
  assert.deepStrictEqual(r.phys.dir, { bL: 0.4 }); assert.strictEqual(r.phys.damp, 0.7); assert.strictEqual(r.phys.friction, 0.8);
  assert.deepStrictEqual(r.saved, [{ bendBiasL: 40, damping: 70 }, 0.8], "in the file");
  assert.deepStrictEqual(r.reopened, r.saved, "back on opening");
  assert.deepStrictEqual(r.preset, [null, 0.45, '{"bendBiasL":40,"damping":70}'], "a preset chosen brings its own friction; the shares stay");
});

test("FIX-3 / D: the solver takes the Detail rows: every share 100 % is the cloth exactly as before; a cloth edge's stiffness by its way along the grain (warp along, weft across, the two biases between); a strip hung from its top with a soft warp stretches further down than at 100 %; a fabric's Internal Damping its points' share of the damping", () => {
  const C = require("../drafter-sim.js");
  // the mix: exact at every share 1; along / across / the biases
  for (const a of [0, 0.3, 1, 2.2]) assert.ok(Math.abs(C.dirK(7, { a: 1, c: 1, r: 1, l: 1 }, Math.cos(a), Math.sin(a)) - 7) < 1e-12);
  const D = { a: 2, c: 0.5, r: 3, l: 0.25 }, q = Math.SQRT1_2;
  assert.ok(Math.abs(C.dirK(10, D, 1, 0) - 20) < 1e-12 && Math.abs(C.dirK(10, D, 0, 1) - 5) < 1e-12, "warp along, weft across");
  assert.ok(C.dirK(10, D, q, q) > C.dirK(10, D, q, -q), "the right bias stiffer than the left here");
  assert.strictEqual(C.dirOf({ warp: 1, weft: 1 }), null, "every share 1: nothing to mix");
  // a strip 100 wide, 300 long, the grain down it, hung from its top row
  const W = 100, H = 300, st = 20, cols = W/st + 1, rows = H/st + 1, xy = [], X = [], tri = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { xy.push(i*st, j*st); X.push(i*st, 2000 - j*st, 0); }
  for (let j = 0; j + 1 < rows; j++) for (let i = 0; i + 1 < cols; i++) { const a = j*cols + i, b = a + 1, c = a + cols, d = c + 1; tri.push(a, b, d, a, d, c); }
  const hang = (fab) => {
    const sim = C.clothBuild({ pieces: [{ xy: new Float64Array(xy), tri: new Uint32Array(tri), X: new Float32Array(X), fab, g: [0, 1] }], seams: [], pins: Array.from({ length: cols }, (_, i) => ({ p: 0, v: i })), opt: { substeps: 10, self: false, ground: false } });
    for (let f = 0; f < 90; f++) C.clothStep(sim, 1/60);
    let lo = Infinity; for (let i = 0; i < sim.n; i++) lo = Math.min(lo, sim.x[3*i+1]);
    return { sim, drop: 2000 - lo };
  };
  const base = { weight: 300, stretch: 2e4, bend: 10, friction: 0.3 };
  const plain = hang(base), same = hang({ ...base, dir: { warp: 1, weft: 1, shR: 1, shL: 1, bWarp: 1, bWeft: 1, bR: 1, bL: 1 }, damp: 1 }), soft = hang({ ...base, dir: { warp: 0.2 } });
  assert.deepStrictEqual(Array.from(same.sim.x), Array.from(plain.sim.x), "every share 1: bit for bit the same cloth");
  assert.strictEqual(same.sim.dmp, null);
  assert.ok(soft.drop > plain.drop + 5, "a soft warp: the strip hangs longer: " + [plain.drop.toFixed(1), soft.drop.toFixed(1)]);
  const damp = hang({ ...base, damp: 3 });
  assert.ok(damp.sim.dmp && damp.sim.dmp[0] === 3, "the points' share of the damping");
});

module.exports = T;
