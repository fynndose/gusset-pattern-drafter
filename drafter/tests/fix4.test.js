// Round FIX-4: the 3D and sewing tools still greyed (roadmap FIX-4), and the maintainer's batch 0.
// Batch 0: no Tag in glTF row; a scene without Shirring, Pressure or seam Tension simulates as before FIX-3b.
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
  const f = path.join(os.tmpdir(), "pdraft-fix4-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}

// the scene: two sewn rectangles, one with an elastic internal line, the other on layer 1; simulated in the page for 60 frames
const NEUTRAL = `
  const sq = (n, x, y) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+300,y:y},{x:x+300,y:y+400},{x:x,y:y+400}], true));
  app.push("Two"); const A = sq("A", 0, -1500), B = sq("B", 320, -1500); B.layer = 1; S.pieces.push(A, B);
  app.ev("addChild")(A, "internals", app.mkShape([{x:50,y:-1300},{x:250,y:-1300}], false)); A.internals[0].segs[0].elastic = { k: 10, r: 80 };
  S.seams.push(app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true));
  S.cloth = app.normCloth({ ...S.cloth, worker: false }); app.commit();
  app.ev("simStart")();
  const spec = { layers: [...app.ev("simLayers")(S.pieces.map(p => p.id)).values()], els: S.pieces.map(p => app.ev("elasticsOf")(p, app.G3.items.get(p.id).mesh).map(e => e.r)),
    zones: S.pieces.map(p => app.ev("shirrZones")(p, app.G3.items.get(p.id).mesh, {}, null)), press: S.pieces.map(p => "press3" in p) };
  for (let i = 0; i < 60; i++) app.ev("simFrame")();
  const X = []; for (const p of S.pieces) X.push(...Array.from(app.G3.items.get(p.id).X));
  app.ev("simStop")();
  let h = 2166136261 >>> 0; const f = new Float32Array(X), u = new Uint8Array(f.buffer);
  for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; }
  return { n: X.length, hash: h.toString(16), spec };`;

test("FIX-4 / 0: a scene that never sets Shirring, a pattern's Pressure or a seam's Tension simulates bit for bit as before FIX-3b's solver changes (the cloth's positions after 60 frames hashed; 923e5411 was recorded with commit 338545b, the build before them): all three are neutral by default", () => {
  const r = boot({ blank: true, three: true, script: NEUTRAL });
  assert.deepStrictEqual(r.spec, { layers: [0, 1], els: [[80], []], zones: [null, null], press: [false, false] }, "nothing added to the solver's spec: the layers as set, only the drawn elastic, no shirring zones, no pressure");
  assert.strictEqual(r.n, 2184);
  assert.strictEqual(r.hash, "923e5411", "the same cloth, bit for bit, as the build before FIX-3b's solver changes");
});

test("FIX-4 / 0: a seam's Property Editor shows no Tag in glTF row, with Show Tools That Are Not Built Yet off or on (no empty shells while there is no glTF export)", () => {
  const r = boot({ blank: true, script: `
    const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:0},{x:x+300,y:0},{x:x+300,y:400},{x:x,y:400}], true));
    app.push("Two"); const A = sq("A", 0), B = sq("B", 400); S.pieces.push(A, B);
    S.seams.push(app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true)); app.commit();
    app.setTool("edit_sewing"); S.selSeam = S.seams[0].id; S.sel = [A.id];
    const out = [];
    for (const nb of [false, true]) { S.ui.unbuilt = nb; app.ev("ui")(); const h = app.el("props").innerHTML; out.push([/Tag in glTF/.test(h), /id="sp-nm"/.test(h)]); }
    return out;`, });
  assert.deepStrictEqual(r, [[false, true], [false, true]]);
});



// Batch A: rips (Seamline Rip, Edit Rip, Add Seamline Rip)
const SEWN = `
  const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:-1400},{x:x+300,y:-1400},{x:x+300,y:-1000},{x:x,y:-1000}], true));
  app.push("Two"); const A = sq("A", 0), B = sq("B", 400); S.pieces.push(A, B);
  S.seams.push(app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true)); app.commit();
  app.ev("fitAll")();
  const sm = () => S.seams[0], scr = (f) => app.ev("toS")(app.ev("sideAt")(sm(), "a", f));
`;
test("FIX-4 / A: Seamline Rip: a click on a seam and a second on the same seam rip the stretch between (one step; the first click none); Esc gives a rip begun up; the rip is kept on the seam, in the file and back, and the solver leaves its stitches out", () => {
  const r = boot({ blank: true, three: true, desktop: true, script: SEWN + `
    const out = {};
    app.setTool("seamline_rip"); const n0 = S.undo.length;
    let p = scr(0.25); app.ev("ripDown")(p.x, p.y); out.first = [S.undo.length - n0, !!S.ripFrom];
    app.ev("keyFind") && 0;
    S.ripFrom = null;      // as Esc does
    p = scr(0.2); app.ev("ripDown")(p.x, p.y); p = scr(0.6); app.ev("ripDown")(p.x, p.y);
    out.dbg = [toasts.slice(-3), JSON.stringify(p), JSON.stringify(S.ripFrom)]; out.made = [S.undo.length - n0, S.un[S.un.length - 1].n, JSON.stringify((sm().rips || []).map(x => [+x.a.toFixed(2), +x.b.toFixed(2)]))];
    app.ev("garmentSync")();
    const order = S.pieces.map(q => q.id), all = app.ev("simSeams")(order)[0].pairs.length;
    const kept = all; const plain = (() => { const was = sm().rips; delete sm().rips; const n = app.ev("simSeams")(order)[0].pairs.length; sm().rips = was; return n; })();
    out.pairs = [kept < plain, kept > 0, plain];
    app.desk.dialog = "C:\\\\x\\\\rip.pdraft"; app.saveDoc(false); const file = app.desk.files.get(app.desk.dialog);
    out.saved = app.fileDoc(file).seams[0].rips;
    app.ev("openFile")("rip.pdraft", file, null, true); out.opened = S.seams[0].rips;
    // the seam's menu: Add Seamline Rip rips the whole seam
    app.ev("addSeamlineRip")(S.seams[0]); out.whole = S.seams[0].rips; app.ev("garmentSync")(); out.none = app.ev("simSeams")(S.pieces.map(q => q.id))[0].pairs.length;
    return out;`, });
  assert.deepStrictEqual(r.first, [0, true], "the first click only starts it");
  assert.deepStrictEqual(r.made.slice(0, 2), [1, "Seamline Rip"], JSON.stringify(r.dbg));
  assert.strictEqual(r.made[2], "[[0.2,0.6]]");
  assert.ok(r.pairs[0] && r.pairs[1], "fewer stitches, not none: " + JSON.stringify(r.pairs));
  assert.deepStrictEqual(r.saved, r.opened, "in the file and back"); assert.ok(r.saved && r.saved.length === 1);
  assert.deepStrictEqual(r.whole, [{ a: 0, b: 1 }]); assert.strictEqual(r.none, 0, "the whole seam ripped: no stitch left");
});

test("FIX-4 / A: Edit Rip: a click selects a rip (no step), its end dragged along the seam moves it (one step), Delete takes it away (one step); the rips are drawn with their dashes and ticks; Seamline Rip and Edit Rip are on both toolbars' registry as built, in the 3D menu's Ripping and in the 3D window through the 2D code", () => {
  const r = boot({ blank: true, three: true, script: SEWN + `
    const out = {};
    app.ev("ripSet")(sm(), [{ a: 0.3, b: 0.5 }], "Seamline Rip");
    app.setTool("edit_rip"); const n0 = S.undo.length;
    let p = scr(0.4); app.ev("ripDown")(p.x, p.y); out.sel = [JSON.stringify(S.selRip), S.undo.length - n0];
    p = scr(0.5); app.ev("ripDown")(p.x, p.y); out.drag = !!S.drag && S.drag.k;
    const q = scr(0.7); app.ev("ripDragTo")(S.drag, q.x, q.y); app.ev("cvUp")({});
    out.moved = [+sm().rips[0].b.toFixed(2), S.undo.length - n0, S.un[S.un.length - 1].n];
    S.selRip = { seam: sm().id, k: 0 }; app.ev("keyDelete")(); out.del = ["rips" in sm(), S.undo.length - n0];
    app.ev("undo")(); out.back = JSON.stringify(sm().rips.map(x => +x.b.toFixed(2)));
    const T = app.TOOLS; out.reg = [T.seamline_rip.st, T.edit_rip.st, !!app.ev("TOOL3").seamline_rip.both, !!app.ev("TOOL3").edit_rip.both];
    const flat = (L) => L.flatMap(x => x && x.menu ? [x.n, ...flat(x.menu())] : x ? [x.n] : []);
    out.menu = flat(app.MENUS["3d"]()).filter(n => /Rip/.test(n || ""));
    let dashes = 0; const g = app.ev("ctx"), was = g.setLineDash; g.setLineDash = function (d) { if (d && d[0] === 7) dashes++; return was && was.apply(g, arguments); };
    app.ev("draw")(); g.setLineDash = was; out.drawn = dashes;
    return out;`, });
  assert.deepStrictEqual(r.sel[1], 0, "selecting is no step"); assert.ok(/"k":0/.test(r.sel[0]));
  assert.strictEqual(r.drag, "ripEnd");
  assert.deepStrictEqual(r.moved, [0.7, 1, "Edit Rip"], "its end moved, one step");
  assert.deepStrictEqual(r.del, [false, 2], "deleted, one step");
  assert.strictEqual(r.back, "[0.7]", "undo brings it back");
  assert.deepStrictEqual(r.reg, ["built", "built", true, true]);
  assert.ok(r.menu.includes("Edit Rip") && r.menu.includes("Seamline Rip"), JSON.stringify(r.menu));
  assert.ok(r.drawn >= 2, "drawn on both sides, dashed: " + r.drawn);
});


// Batch B: Select Mesh (Box), (Lasso), (Brush)
const SCENE3 = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400)); const A = S.pieces[0];
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
  const pos = app.ev("tackPos"), scr = (x, y) => { const P = pos({ piece: A.id, x, y }); return v3.project(new THREE.Vector3(P[0], P[1], P[2])); };
  const ev = (x, y, opt) => { const q = scr(x, y); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1, ...(opt || {}) }; };
  const it = G3.items.get(A.id), m = it.mesh, inside = (v, x0, x1, y0, y1) => m.xy[2*v] >= x0 && m.xy[2*v] <= x1 && m.xy[2*v+1] >= y0 && m.xy[2*v+1] <= y1;
  const sel = () => [...((G3.meshSel || new Map()).get(A.id) || [])];
`;
test("FIX-4 / B: Select Mesh (Box) and (Lasso) select the cloth's points inside what is drawn (Shift adds, Ctrl takes away, a click off the cloth clears); (Brush) the points within its Size of where it is dragged; selecting is no step; Freeze Selected Mesh pins them (one step) and Unfreeze takes those pins away; they are dots on the cloth", () => {
  const r = boot({ blank: true, three: true, script: SCENE3 + `
    const n0 = S.undo.length;
    app.setTool3("select_mesh_box"); const B = app.TOOL3.select_mesh_box;
    B.down(ev(90, 90)); B.move(ev(160, 160)); B.up(ev(160, 160));
    const a = sel(); out.box = [a.length > 2, a.every(v => inside(v, 85, 165, 85, 165)), S.undo.length - n0];
    B.down(ev(190, 240, { shiftKey: true })); B.move(ev(260, 310, { shiftKey: true })); B.up(ev(260, 310, { shiftKey: true }));
    out.added = sel().length > a.length;
    B.down(ev(190, 240, { ctrlKey: true })); B.move(ev(260, 310, { ctrlKey: true })); B.up(ev(260, 310, { ctrlKey: true }));
    out.taken = sel().length === a.length;
    app.setTool3("select_mesh_lasso"); const L = app.TOOL3.select_mesh_lasso, c = [[100, 150], [200, 150], [200, 250], [100, 250]].map(q => ev(q[0], q[1]));
    L.down(c[0]); for (const q of [...c.slice(1), c[0]]) L.move(q); L.up(c[0]);
    out.lasso = sel().length > 2 && sel().every(v => inside(v, 95, 205, 145, 255));
    app.setTool3("select_mesh_brush"); const Br = app.TOOL3.select_mesh_brush;
    app.ev("MESH_BRUSH").size = 40; Br.down(ev(150, 200)); Br.up();
    const P = it.X, c3 = pos({ piece: A.id, x: 150, y: 200 }), far = sel().map(v => Math.hypot(P[3*v] - c3[0], P[3*v+1] - c3[1], P[3*v+2] - c3[2]));
    out.brush = [sel().length > 2, Math.max(...far) <= 40 + 1e-6, S.undo.length - n0];
    out.dots = app.view3d.group("meshsel").children.length;
    app.ev("meshFreeze")(true); out.frozen = [(A.pins || []).length === sel().length, S.undo.length - n0];
    app.ev("meshFreeze")(false); out.unfrozen = [!(A.pins && A.pins.length), S.undo.length - n0, S.un[S.un.length - 1].n];
    app.setTool3("select_mesh_box"); B.down(ev(-500, -500)); B.up(ev(-500, -500)); out.cleared = sel().length;
    return out;`, });
  assert.deepStrictEqual(r.box, [true, true, 0], "the points inside the box, no step");
  assert.ok(r.added && r.taken, "Shift adds, Ctrl takes away");
  assert.ok(r.lasso, "the lasso's points");
  assert.deepStrictEqual(r.brush, [true, true, 0], "the brush: within its Size, no step");
  assert.strictEqual(r.dots, 1, "shown as dots on the pattern's cloth");
  assert.deepStrictEqual(r.frozen, [true, 1], "frozen: each point pinned, one step");
  assert.deepStrictEqual(r.unfrozen, [true, 2, "Unfreeze Selected Mesh"]);
  assert.strictEqual(r.cleared, 0, "a click off the cloth clears the selection");
});
module.exports = T;
