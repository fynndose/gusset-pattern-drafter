// Round r10: no dead icons in the 3D window. The tools out of this stage's scope are hidden behind a feature flag (0),
// a picking layer maps the cloth under the pointer onto the flat pattern (1), and the 3D tools that are the same
// operations as in 2D run the 2D tools' own code on it (2, 3); the 3D-only tools follow (4), then r9's leftovers (5),
// the strain beside the seams (6) and the frame time (7). A test (or more) a batch.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const REG = require("../drafter-tools.js");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// the tools Batch 0 put out of this stage's scope (category C of the report)
const LATER = ["select_mesh_brush", "select_mesh_box", "select_mesh_lasso", "fold_garment", "auto_arrangement", "redrape", "auto_sewing", "press", "pen_avatar", "edit_pen_avatar",
  "flatten", "scale_style_line", "add_style_line", "seamline_rip", "seam_taping", "lacing", "avatar_tape_linear",
  "avatar_tape_circ", "edit_avatar_tape", "attach_to_measure"];      // (Round r11 built Piping, Edit Piping, Binding, Select Binding and Gluing)

/* ---------- 0 ---------- */
test("r10 / 0: the tools out of this stage's scope are kept in the registry as \"later\" and are on no toolbar unless the feature flag is on; the menus still name them as not built yet", () => {
  assert.deepStrictEqual(REG.tools.filter(t => t.status === "later").map(t => t.id).sort(), LATER.slice().sort());
  const script = `
    const out = {}, shown = app.ev("shownTools");
    const rail = (win) => app.GROUPS.filter(g => g.win === win).flatMap(g => shown(g)).map(t => t.id);
    out.on = rail("3D"); app.setUnbuilt(false); out.off = rail("3D"); app.setUnbuilt(true);
    out.menu = JSON.stringify(app.ev("menu3D")());
    return out;`;
  const o = boot({ script }).result;
  for (const id of LATER) { assert.ok(!o.on.includes(id), id + " is hidden"); assert.ok(!o.off.includes(id)); }
  assert.ok(o.on.includes("select_move") && o.on.includes("tack"), "the tools that work are there");
  assert.ok(/Press [(]not built yet[)]/.test(o.menu), "a menu still lists it, greyed");
  const f = boot({ storage: { "pdraft:flags": JSON.stringify({ later: true }) }, script }).result;
  for (const id of LATER.filter(id => REG.tools.find(t => t.id === id).win === "3D")) assert.ok(f.on.includes(id), id + " is back with the flag on");
  assert.ok(!f.off.includes("press"), "and still a placeholder: hidden while Show Tools That Are Not Built Yet is off");
});

// two rectangles in front of each other in 3D, the front facing the camera: Front 0,0 to 300,400 and Back 400,0 to 700,400 (2D)
const SEWN = `
  const out = {}, G3 = app.G3, SIM = app.SIM, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 });
  const pos = app.ev("tackPos"), pick3 = app.ev("pick3"), with2D = app.ev("with2D"), AT2 = app.ev("AT2"), hit = app.ev("hit");
  const scr = (pid, x, y) => { const P = pos({ piece: pid, x, y }); return v3.project(new THREE.Vector3(P[0], P[1], P[2])); };
  const at = (q) => ({ clientX: q.x, clientY: q.y, button: 0, buttons: 0 });
  const hitAt = (q) => { const pk = pick3(at(q)); if (!pk) return null; return with2D(pk, at(q), () => { const h = hit(AT2.sx, AT2.sy); return h ? { k: h.k, p: h.p.name, i: h.i, kind: h.kind, x: +pk.x.toFixed(2), y: +pk.y.toFixed(2), edge: pk.edge } : { k: null, x: pk.x, y: pk.y }; }); };
`;

/* ---------- 1 ---------- */
test("r10 / 1: the picking layer: on a simulated garment a place under the pointer maps to the place on the flat pattern, and the 2D picking finds the right line, point or pattern there with the 2D window's tolerances in screen pixels, also just beside the cloth's edge", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    app.push("Sew"); S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] }); app.commit(); app.ev("garmentSync")();
    // a drape: the two panels pulled together at their sides and falling a little
    app.simToggle(); for (let i = 0; i < 14; i++) app.ev("simFrame")(); app.simToggle();
    app.ev("view3d.scene()").updateMatrixWorld(true);
    out.flatMoved = Math.abs(pos({ piece: A.id, x: 0, y: 0 })[0] + 150) > 1;
    // the middle of the front: its place on the flat pattern, and the pattern there
    const mid = scr(A.id, 150, 200), pm = pick3(at(mid));
    out.mid = [pm.piece === A.id, +Math.abs(pm.x - 150).toFixed(3), +Math.abs(pm.y - 200).toFixed(3), hitAt(mid).k];
    // the back, seen from behind
    Object.assign(v3.cam, { az: Math.PI }); app.ev("view3d.scene()").updateMatrixWorld(true);
    const pb = pick3(at(scr(B.id, 550, 100)));
    out.back = [pb.piece === B.id, +Math.abs(pb.x - 550).toFixed(3), +Math.abs(pb.y - 100).toFixed(3)];
    Object.assign(v3.cam, { az: 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
    // the top line: a place on the cloth a few pixels inside it, and one beside the cloth (off its edge) the same distance out
    const e0 = scr(A.id, 150, 0), e1 = scr(A.id, 150, 20), L = Math.hypot(e1.x - e0.x, e1.y - e0.y), u = { x: (e1.x - e0.x)/L, y: (e1.y - e0.y)/L }, px = L/20;
    out.pxPerMm = px;
    const inward = (d) => ({ x: e0.x + u.x*d, y: e0.y + u.y*d });
    out.in4 = hitAt(inward(4)); out.out4 = hitAt(inward(-4)); out.in12 = hitAt(inward(12)); out.out14 = pick3(at(inward(-14)));
    // a corner point: one the camera sees (a corner the drape folded behind other cloth is not under the pointer there)
    // (Round r11 / 1: with bending across the seams the two panels round out at their sides, so the view is turned until one is face-on)
    for (const az of [0, 0.6, -0.6, 1, -1]) for (let i = 0; i < 4 && !out.corner; i++) {
      Object.assign(v3.cam, { az }); app.ev("view3d.scene()").updateMatrixWorld(true);
      const q = A.pts[i], c = scr(A.id, q.x, q.y), pk = pick3(at(c));
      if (!pk || pk.piece !== A.id || Math.hypot(pk.x - q.x, pk.y - q.y) > 3) continue;
      const ci = scr(A.id, q.x + (150 - q.x)*0.05, q.y + (200 - q.y)*0.05), cl = Math.hypot(ci.x - c.x, ci.y - c.y);
      // (Round r11 / 1) and one seen face-on: 3 px in from it must still be near it on the flat pattern (with bending across the
      // seams a corner beside a seam can curl, and then 3 px on the screen is centimetres of cloth seen edge-on)
      const h3 = hitAt({ x: c.x + (ci.x - c.x)/cl*3, y: c.y + (ci.y - c.y)/cl*3 });
      if (!h3 || Math.hypot(h3.x - q.x, h3.y - q.y) > 8) continue;
      out.corner = { ...h3, want: i };
    }
    // nothing of the virtual view is left behind
    out.after = [S.only3 == null, JSON.stringify(S.view)];
    return out;` }).result;
  assert.ok(o.flatMoved, "the cloth was simulated: it is not where it was arranged any more");
  assert.deepStrictEqual(o.mid.slice(0, 1), [true]); assert.ok(o.mid[1] < 0.5 && o.mid[2] < 0.5, "the place on the flat pattern: " + o.mid); assert.strictEqual(o.mid[3], "body");
  assert.ok(o.back[0] && o.back[1] < 0.5 && o.back[2] < 0.5, "the back from behind: " + o.back);
  assert.ok(o.pxPerMm > 0.1, "the cloth is seen big enough to tell pixels: " + o.pxPerMm);
  assert.deepStrictEqual([o.in4.k, o.in4.p, o.in4.i, o.in4.kind, o.in4.edge], ["seg", "Front", 0, "outline", false], "4 px inside the top line: the line");
  assert.deepStrictEqual([o.out4.k, o.out4.p, o.out4.i, o.out4.edge], ["seg", "Front", 0, true], "4 px outside it, beside the cloth: the line too");
  assert.strictEqual(o.in12.k, "body", "12 px inside it: not the line (2D catches a line within 6 px)");
  assert.strictEqual(o.out14, null, "14 px outside: nothing");
  assert.ok(o.corner, "a corner is in view");
  assert.deepStrictEqual([o.corner.k, o.corner.p, o.corner.i], ["pt", "Front", o.corner.want], "3 px from a corner: the point (before the lines) " + JSON.stringify(o.corner));
  assert.deepStrictEqual(o.after, [true, JSON.stringify({ s: 1, x: 0, y: 0 })].map((v, k) => k ? o.after[1] : v));
});

test("r10 / 1: the hover and the selection in 3D: what the 2D tool would highlight there is drawn on the cloth, thin for the hover and thick for the selection, and the 2D window highlights the same line", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    app.ev("view3d.scene()").updateMatrixWorld(true);
    app.setTool("edit_pattern"); S.over3d = true;
    const e0 = scr(A.id, 150, 1), ev = at(e0), pk = pick3(ev);
    with2D(pk, ev, () => { app.ev("cvMove")(app.ev("ev2")(ev)); app.ev("ov3Hover")(); });
    out.ov = G3.ov.map(x => [x.pid === A.id, x.w, x.col, x.pts.length > 1]);
    out.hover2d = S.hover && [S.hover.k, S.hover.i, S.hover.p.name];
    out.mouse = [+S.mouse.x.toFixed(1), +S.mouse.y.toFixed(1)];
    app.ev("ov3Draw")(); out.drawn = app.ev("view3d.group('ov3')").children.map(c => c.type);
    // the selection: the right line selected in 2D is thick in 3D
    S.sel = [A.id]; S.selKind = "outline"; S.selInt = -1; S.selSeg = 1; S.selPt = -1; G3.ov = [];
    out.sel = app.ev("ov3Items")().map(x => [x.w, x.col]);
    app.ev("ov3Draw")(); out.drawnSel = app.ev("view3d.group('ov3')").children.map(c => c.type);
    // the pointer over the 2D window: its hover is shown in 3D
    S.over3d = false; S.selSeg = -1; S.hover = { k: "seg", p: B, sh: B, kind: "outline", int: -1, i: 2 };
    out.from2d = app.ev("ov3Items")().map(x => [x.pid === B.id, x.w]);
    return out;` }).result;
  assert.deepStrictEqual(o.ov, [[true, "thin", "#2eaaf1", true]], "the hovered line, thin, in the hover colour");
  assert.deepStrictEqual(o.hover2d, ["seg", 0, "Front"], "the 2D window's hover is the same line");
  assert.ok(Math.abs(o.mouse[0] - 150) < 2 && Math.abs(o.mouse[1] - 1) < 2, "the 2D pointer's place is the flat place: " + o.mouse);
  assert.deepStrictEqual(o.drawn, ["Line"]);
  assert.deepStrictEqual(o.sel, [["thick", "#ecfd3f"]]); assert.deepStrictEqual(o.drawnSel, ["Mesh"], "thick is a tube, not a 1 px line");
  assert.deepStrictEqual(o.from2d, [[true, "thin"]]);
});

/* ---------- 2 ---------- */
test("r10 / 2: the 3D sewing tools are the 2D ones picked on the cloth: Segment Sewing made with clicks in 3D gives the same seam, undo step and history entry as the same clicks in 2D, and its 2D tool is in hand", () => {
  const body = (in3) => SEWN + `
    app.ev("view3d.scene()").updateMatrixWorld(true);
    const steps0 = app.histSteps().steps.length;
    const click3 = (tool, pid, x, y, az, opt) => {
      Object.assign(v3.cam, { az: az || 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
      const q = scr(pid, x, y), e = { clientX: q.x, clientY: q.y, button: 0, buttons: 1, ...(opt || {}) };
      const T3 = app.TOOL3[tool], took = T3.down(e); T3.up(e); return took;
    };
    const click2 = (x, y, opt) => { const q = app.toS({ x, y }); app.click(q.x, q.y, opt); };
    if (${in3}) {
      app.setTool3("segment_sewing_3d"); out.inHand = [S.tool3, S.tool];
      // the front's right side near its top, then the back's side that faces it (seen from behind)
      out.took = [click3("segment_sewing_3d", A.id, 297, 60), click3("segment_sewing_3d", B.id, 403, 60, Math.PI)];
    } else {
      app.setTool("segment_sewing"); click2(299, 60); click2(401, 60);
    }
    out.seams = JSON.parse(JSON.stringify(S.seams)).map(sm => ({ a: sm.a, b: sm.b }));
    out.steps = app.histSteps().steps.slice(steps0).map(s => s.n);
    out.sel = S.selSeam;
    return out;`;
  const o3 = boot({ blank: true, three: true, script: body(true) }).result, o2 = boot({ blank: true, three: true, script: body(false) }).result;
  assert.deepStrictEqual(o3.inHand, ["segment_sewing_3d", "segment_sewing"], "the 2D tool is in hand too");
  assert.deepStrictEqual(o3.took, [true, true]);
  assert.strictEqual(o3.seams.length, 1, "one seam");
  assert.deepStrictEqual(o3.seams, o2.seams, "the same seam as the same clicks in 2D");
  assert.deepStrictEqual(o3.steps, o2.steps, "the same undo step and history entry: " + o3.steps);
  assert.strictEqual(o3.steps.length, 1);
  assert.strictEqual(o3.sel, o2.sel, "and selected, as in 2D");
});

test("r10 / 2: Free Sewing and M:N Segment Sewing in 3D; Edit Sewing in 3D selects the seam the 2D window then shows as selected (and back), drags its end, and Delete removes it; the seams and the one being made are drawn on the cloth", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    app.ev("view3d.scene()").updateMatrixWorld(true);
    const ev = (pid, x, y, opt) => { const q = scr(pid, x, y); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1, ...(opt || {}) }; };
    const tap = (tool, e) => { const T3 = app.TOOL3[tool]; const took = T3.down(e); if (T3.up) T3.up(e); return took; };
    const cam = (az) => { Object.assign(v3.cam, { az }); app.ev("view3d.scene()").updateMatrixWorld(true); };
    // Free Sewing: the front's top from 50 to 250, then the back's top from 450 to 650 (seen from behind)
    app.setTool3("free_sewing_3d");
    tap("free_sewing_3d", ev(A.id, 50, 2)); tap("free_sewing_3d", ev(A.id, 250, 2));
    out.draftShown = app.ev("ov3Items")().filter(x => x.w === "thick").length;
    cam(Math.PI); tap("free_sewing_3d", ev(B.id, 450, 2));
    // the hover: the stretch so far from where the second side was started
    app.TOOL3.free_sewing_3d.hover(ev(B.id, 600, 2)); out.hoverItems = G3.ov.map(x => x.at ? "dot" : x.w);
    tap("free_sewing_3d", ev(B.id, 650, 2)); cam(0);
    const f = S.seams[0], inf = app.ev("seamInfo")(f, S.pieces);
    out.free = [S.seams.length, +inf.la.toFixed(0), +inf.lb.toFixed(0)];
    // M:N Segment Sewing: the front's bottom, Enter, the back's bottom, Enter
    app.setTool3("mn_segment_sewing_3d");
    tap("mn_segment_sewing_3d", ev(A.id, 150, 398)); app.key("Enter");
    cam(Math.PI); tap("mn_segment_sewing_3d", ev(B.id, 550, 398)); app.key("Enter"); cam(0);
    out.mn = [S.seams.length, S.seams[1] && S.seams[1].a.length, S.seams[1] && S.seams[1].b.length];
    // Edit Sewing: a click on the free seam's line on the front selects it; 2D shows the same seam selected
    app.setTool3("edit_sewing_3d"); S.selSeam = null;
    out.pick = tap("edit_sewing_3d", ev(A.id, 150, 1)); out.selected = S.selSeam === f.id;
    out.thick = app.ev("ov3Items")().filter(x => x.w === "thick").map(x => x.col);
    // and back: selected in 2D (a click on the bottom seam there), thick in 3D
    app.setTool("edit_sewing"); const q = app.toS({ x: 150, y: 400 }); app.click(q.x, q.y); out.sel2 = S.selSeam === S.seams[1].id;
    out.thick2 = app.ev("ov3Items")().filter(x => x.w === "thick").map(x => x.pid === A.id || x.pid === B.id).length;
    // drag the free seam's front end back along the top: from 250 to 210 (not near the corner: an end within 9 px of a point goes to it, as in 2D)
    app.setTool3("edit_sewing_3d"); S.selSeam = null;
    const T3 = app.TOOL3.edit_sewing_3d, a = ev(A.id, 250, 1), b = ev(A.id, 210, 1);
    T3.down(a); out.dragDbg = [JSON.stringify(S.drag && { k: S.drag.k, end: S.drag.end })]; T3.move({ ...b, buttons: 1 }); out.dragDbg.push(JSON.stringify(S.seams.find(x => x.id === f.id).a)); T3.up(b);
    out.dragged = +app.ev("seamInfo")(S.seams.find(x => x.id === f.id), S.pieces).la.toFixed(0);
    // Delete with the pointer over the 3D window
    S.over3d = true; S.selSeam = f.id; app.key("Delete"); out.afterDelete = S.seams.map(x => x.id);
    app.undo(); out.undone = S.seams.length;
    return out;` }).result;
  assert.ok(o.draftShown >= 1, "the first side picked shows thick on the cloth");
  assert.ok(o.hoverItems.includes("thin"), "the stretch under the pointer, thin: " + o.hoverItems);
  assert.deepStrictEqual(o.free, [1, 200, 200], "free sewing: 200 mm a side");
  assert.deepStrictEqual(o.mn, [2, 1, 1]);
  assert.strictEqual(o.pick, true); assert.strictEqual(o.selected, true, "Edit Sewing in 3D selects the seam");
  assert.ok(o.thick.length >= 2, "both sides thick in 3D");
  assert.strictEqual(o.sel2, true); assert.ok(o.thick2 >= 2, "selected in 2D: thick in 3D");
  assert.strictEqual(o.dragged, 160, "the end dragged back 40 mm along the edge on the cloth " + o.dragDbg);
  assert.strictEqual(o.afterDelete.length, 1, "Delete removes the selected seam"); assert.strictEqual(o.undone, 2);
});

/* ---------- 3 ---------- */
// presses, drags and taps of a 3D tool at flat places of the patterns, the camera from the front (az 0) or behind (az π)
const DRIVE = `
  app.ev("view3d.scene()").updateMatrixWorld(true);
  const cam = (az) => { Object.assign(v3.cam, { az }); app.ev("view3d.scene()").updateMatrixWorld(true); };
  const ev = (pid, x, y, opt) => { const q = scr(pid, x, y); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1, ...(opt || {}) }; };
  const tap = (tool, e) => { const T3 = app.TOOL3[tool]; const took = T3.down(e); if (T3.up) T3.up(e); return took; };
  const drag = (tool, a, b) => { const T3 = app.TOOL3[tool]; const took = T3.down(a); if (!took) return false; T3.move({ ...a, clientX: (a.clientX + b.clientX)/2, clientY: (a.clientY + b.clientY)/2 }); T3.move(b); T3.up(b); return took; };
  const steps = () => app.histSteps().steps.map(s => s.n);
`;
test("r10 / 3: Notch and the topstitch tools on the cloth are the 2D tools: a notch where the click is, a topstitch along the segment and between two places, Edit Topstitch selects it (thick in 3D); the same as the same clicks in 2D", () => {
  const body = (in3) => SEWN + DRIVE + `
    const click2 = (x, y) => { const q = app.toS({ x, y }); app.click(q.x, q.y); };
    if (${in3}) {
      app.setTool3("notch_3d"); out.inHand = S.tool; tap("notch_3d", ev(A.id, 150, 1));
      app.setTool3("segment_topstitch_3d"); tap("segment_topstitch_3d", ev(A.id, 299, 200));
      app.setTool3("free_topstitch_3d"); tap("free_topstitch_3d", ev(A.id, 1, 100)); tap("free_topstitch_3d", ev(A.id, 1, 300));
      app.setTool3("edit_topstitch_3d"); S.selStitch = null; out.took = tap("edit_topstitch_3d", ev(A.id, 3, 200)); out.selStitch = S.selStitch;
      out.thick = app.ev("ov3Items")().filter(x => x.w === "thick").map(x => x.col);
      app.setTool3("notch_3d"); out.notchDots = app.ev("ov3Items")().filter(x => x.at).length;
    } else {
      app.setTool("notch"); click2(150, 0);
      app.setTool("segment_topstitch"); click2(300, 200);
      app.setTool("free_topstitch"); click2(0, 100); click2(0, 300);
      app.setTool("edit_topstitch"); S.selStitch = null; click2(3, 200); out.selStitch = S.selStitch;
    }
    out.notches = A.segs.map(g => (g.notches || []).map(u => +u.toFixed(2)));
    out.stitches = JSON.parse(JSON.stringify(S.stitches)).map(st => ({ part: { ...st.part, t0: +st.part.t0.toFixed(2), t1: +st.part.t1.toFixed(2) } }));
    out.steps = steps();
    return out;`;
  const o3 = boot({ blank: true, three: true, script: body(true) }).result, o2 = boot({ blank: true, three: true, script: body(false) }).result;
  assert.strictEqual(o3.inHand, "notch");
  assert.deepStrictEqual(o3.notches, o2.notches, "the same notch: " + JSON.stringify(o3.notches));
  assert.strictEqual(o3.notches[0].length, 1);
  assert.deepStrictEqual(o3.stitches, o2.stitches, "the same two topstitches");
  assert.strictEqual(o3.stitches.length, 2);
  assert.deepStrictEqual(o3.steps, o2.steps, "the same undo steps");
  assert.ok(o3.took && o3.selStitch != null && o3.selStitch === o2.selStitch, "Edit Topstitch (3D) selects the same topstitch");
  assert.ok(o3.thick.includes("#ecfd3f"), "the selected topstitch is thick in 3D");
  assert.ok(o3.notchDots >= 1, "the notches show on the cloth while Notch is in hand");
});

test("r10 / 3: 3D Pen (Garment) draws an internal line on the pattern under the cloth, 3D Base Pen a baseline; Edit 3D Pen (Garment) drags the internal line's point and Edit Style Line the outline's, each taking only its own kind of line", () => {
  const o = boot({ blank: true, three: true, script: SEWN + DRIVE + `
    // nearer, so that a millimetre is about a pixel: Edit Pattern's catches (a line's extension within a few pixels) are then a few mm
    Object.assign(v3.cam, { dist: 1200, ty: 1000 }); app.ev("view3d.scene()").updateMatrixWorld(true);
    app.setTool3("pen_garment"); out.inHand = S.tool;
    tap("pen_garment", ev(A.id, 100, 100)); tap("pen_garment", ev(A.id, 200, 120));
    out.rubber = (() => { app.TOOL3.pen_garment.hover(ev(A.id, 220, 250)); return G3.ov.filter(x => x.w === "thin").length; })();
    out.shown = app.ev("ov3Items")().filter(x => x.w === "thick").length;
    tap("pen_garment", ev(A.id, 200, 300)); app.TOOL3.pen_garment.dbl(ev(A.id, 200, 300));
    const ln = A.internals[A.internals.length - 1];
    out.line = ln && ln.pts.map(q => [Math.round(q.x), Math.round(q.y)]);
    out.penSteps = steps().length;
    // 3D Base Pen: two clicks and Enter
    app.setTool3("base_pen"); tap("base_pen", ev(A.id, 50, 50)); tap("base_pen", ev(A.id, 250, 50)); app.key("Enter");
    out.base = A.bases.map(b => b.pts.map(q => [Math.round(q.x), Math.round(q.y)]));
    // Edit 3D Pen (Garment): the line's first point dragged 30 mm across and up; a press on the outline is not its
    app.setTool3("edit_pen_garment");
    out.notOutline = app.TOOL3.edit_pen_garment.down(ev(A.id, 299, 200)); app.TOOL3.edit_pen_garment.up(ev(A.id, 299, 200));
    out.pen = drag("edit_pen_garment", ev(A.id, 100, 100), ev(A.id, 130, 70));      // (off the line's own direction: near it Edit Pattern holds a point to it)
    out.penPt = [Math.round(A.internals[A.internals.length - 1].pts[0].x), Math.round(A.internals[A.internals.length - 1].pts[0].y)];
    // Edit Style Line: the right side dragged 20 mm in (the pattern gets narrower); a press inside the pattern is not its
    app.setTool3("edit_style_line");
    out.notBody = app.TOOL3.edit_style_line.down(ev(A.id, 150, 200));
    out.style = drag("edit_style_line", ev(A.id, 299, 200), ev(A.id, 279, 200));
    out.width = Math.round(Math.max(...A.pts.map(q => q.x)) - Math.min(...A.pts.map(q => q.x)));
    out.lastSteps = steps().slice(-2);
    return out;` }).result;
  assert.strictEqual(o.inHand, "internal_polygon");
  assert.ok(o.rubber >= 1 && o.shown >= 1, "the line so far thick, the rubber band thin");
  assert.ok(o.line && o.line.length === 3, "an internal line of three points: " + JSON.stringify(o.line));
  [[100, 100], [200, 120], [200, 300]].forEach((q, k) => { near(o.line[k][0], q[0], 1); near(o.line[k][1], q[1], 1); });
  assert.deepStrictEqual(o.base.length, 1); near(o.base[0][0][0], 50, 1); near(o.base[0][1][0], 250, 1);
  assert.strictEqual(o.notOutline, false, "Edit 3D Pen takes internal lines only");
  assert.strictEqual(o.pen, true); near(o.penPt[0], 130, 1.5); near(o.penPt[1], 70, 1.5);
  assert.strictEqual(o.notBody, false, "Edit Style Line takes the outline only");
  assert.strictEqual(o.style, true); near(o.width, 280, 1.5, "the outline's side moved in");
});

test("r10 / 3: Transform Graphic (3D) and Edit Texture (3D) on the cloth; Select/Move Button drags a button or buttonhole along the cloth; Edit Tack drags a tack's end to another place of the cloth: each one undo step", () => {
  const o = boot({ blank: true, three: true, script: SEWN + DRIVE + `
    // a graphic on the front: picked and dragged
    app.push("Graphic"); A.graphics = [{ id: 1, img: 1, x: 150, y: 200, w: 80, h: 60, angle: 0 }]; app.commit(); app.ev("garmentSync")();
    app.setTool3("transform_graphic_3d");
    out.gfx = drag("transform_graphic_3d", ev(A.id, 150, 200), ev(A.id, 180, 220));
    out.gfxAt = [Math.round(A.graphics[0].x), Math.round(A.graphics[0].y)]; out.gfxSel = !!S.selGfx;
    out.gfxThick = app.ev("ov3Items")().some(x => x.w === "thick" && x.col === "#ecfd3f");
    // the grainline: its top end dragged to turn it
    app.setTool3("edit_texture_3d"); const g = app.ev("grainOf")(A);
    out.grain0 = app.ev("grainAngle")(g);
    out.grain = drag("edit_texture_3d", ev(A.id, g.a.x, g.a.y), ev(A.id, g.a.x + 40, g.a.y));
    out.grain1 = app.ev("grainAngle")(app.ev("grainOf")(A));
    // a button: dragged 40 mm down; a press where there is none turns the view
    app.ev("addButton")("button", A.id, { x: 100, y: 250 }, null); const b = S.buttons[0];
    app.setTool3("select_button");
    out.none = app.TOOL3.select_button.down(ev(A.id, 250, 100));
    out.btn = drag("select_button", ev(A.id, 100, 250), ev(A.id, 100, 290));
    out.btnAt = [Math.round(b.x), Math.round(b.y)]; out.btnTool = S.tool;
    // a tack from the front to the back, its front end dragged
    app.ev("addTack")({ piece: A.id, x: 150, y: 100 }, { piece: B.id, x: 550, y: 100 }, null);
    app.ev("garmentLines")(); app.ev("view3d.scene()").updateMatrixWorld(true);
    app.setTool3("edit_tack");
    out.tack = drag("edit_tack", ev(A.id, 150, 100), ev(A.id, 200, 150));
    out.tackA = [Math.round(S.tacks[0].a.x), Math.round(S.tacks[0].a.y)];
    out.steps = steps().slice(-6);
    app.undo(); out.undoneA = [Math.round(S.tacks[0].a.x), Math.round(S.tacks[0].a.y)];
    return out;` }).result;
  assert.strictEqual(o.gfx, true); near(o.gfxAt[0], 180, 1.5); near(o.gfxAt[1], 220, 1.5); assert.ok(o.gfxSel && o.gfxThick, "selected, thick in 3D");
  assert.strictEqual(o.grain, true); assert.ok(Math.abs(o.grain1 - o.grain0) > 5, "the grainline turned: " + o.grain0 + " → " + o.grain1);
  assert.strictEqual(o.none, false, "no button there: the view's");
  assert.strictEqual(o.btn, true); near(o.btnAt[0], 100, 1.5); near(o.btnAt[1], 290, 1.5); assert.strictEqual(o.btnTool, "button2d");
  assert.strictEqual(o.tack, true); near(o.tackA[0], 200, 1.5); near(o.tackA[1], 150, 1.5);
  assert.strictEqual(o.steps[o.steps.length - 1], "Move Tack");
  assert.deepStrictEqual(o.undoneA, [150, 100], "one undo step");
});

/* ---------- 4 ---------- */
test("r10 / 4: the avatar's measures on Marty: Height Measure is the place's height; Surface Tape Measure lies on the skin and is at least the straight length; Surface Circumference Measure follows the skin (at least the taut tape); Edit Measure selects, drags and deletes", () => {
  const o = boot({ blank: true, three: true, script: SEWN + DRIVE + `
    return (async () => {
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      app.ev("setAvatar")({ cell: 20 });
      S.pieces.forEach(p => p.on = false); app.commit(); app.ev("garmentSync")();
      Object.assign(v3.cam, { az: 0, el: 0, dist: 2600, tx: 0, ty: 1100, tz: 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
      // where a ray from the front meets the body at a height (x across)
      const body = (x, y) => app.ev("avatarHit")({ o: new THREE.Vector3(x, y, 1500), d: new THREE.Vector3(0, 0, -1), rc: null });
      const evAt = (P) => { const q = v3.project(P); return { clientX: q.x, clientY: q.y, button: 0, buttons: 1 }; };
      const chest = body(0, 1350), belly = body(0, 1050), hip = body(60, 950), side = body(-90, 1250);
      app.setTool3("height_measure"); tap("height_measure", evAt(side));
      out.height = [S.avMeas[0].kind, Math.round(S.avMeas[0].a[1]), Math.round(side.y)];
      app.setTool3("tape_surface"); tap("tape_surface", evAt(chest)); tap("tape_surface", evAt(belly));
      const st = S.avMeas[1], f = app.ev("avatarField")(S.av), sdf = (q) => app.ev("SIM3D").sdfAt(f, q[0], q[1], q[2]);
      out.stape = [st.kind, Math.round(st.len), Math.round(chest.distanceTo(belly)), Math.max(...st.pts.map(q => Math.abs(sdf(q))))];
      // (Round r18 / 5: a circumference is three clicks round the body, as the reference's manual has it: the plane through them)
      const sideOf = (y) => app.ev("avatarHit")({ o: new THREE.Vector3(1500, y, 0), d: new THREE.Vector3(-1, 0, 0), rc: null });
      app.setTool3("circ_surface"); tap("circ_surface", evAt(hip)); tap("circ_surface", evAt(body(-60, 950))); tap("circ_surface", evAt(sideOf(950)));
      const cg = S.avMeas[2]; out.circ = [cg.kind, !!cg.surf, Math.round(cg.surface), Math.round(cg.tape)];
      out.texts = S.avMeas.map(m => app.ev("measText")(m));
      // Edit Measure: a click on the height's line selects it, a drag of the tape's end measures again, Delete removes the selected one
      app.setTool3("edit_measure_avatar");
      const T3 = app.TOOL3.edit_measure_avatar;
      out.sel = [T3.down(evAt(new THREE.Vector3(side.x, side.y/2, side.z))), app.G3.selMeas]; T3.up({});
      const len0 = S.avMeas[1].len, lower = body(0, 950);
      T3.down(evAt(belly)); T3.move(evAt(lower)); T3.up(evAt(lower));
      out.dragged = [Math.round(len0), Math.round(S.avMeas[1].len)];
      app.G3.selMeas = 0; S.over3d = true; app.key("Delete"); out.afterDelete = S.avMeas.map(m => m.kind);
      return out;
    })();` }).result;
  // (Round r18 / 5: the place is on the skin itself, where the ray meets the body mesh; avatarHit() gives the collision body's, which at
  // Collision Detail 20 lies within a few millimetres of it)
  assert.deepStrictEqual(o.height.slice(0, 1), ["height"]); assert.ok(Math.abs(o.height[1] - o.height[2]) <= 12, "the height of the place clicked: " + o.height);
  assert.strictEqual(o.stape[0], "stape"); assert.ok(o.stape[1] >= o.stape[2] - 1, "along the skin at least as long as straight: " + o.stape);
  assert.ok(o.stape[3] < 2, "every point of it on the skin (within 2 mm): " + o.stape[3]);
  assert.deepStrictEqual(o.circ.slice(0, 2), ["circ", true]); assert.ok(o.circ[2] >= o.circ[3] && o.circ[2] > 500, "along the skin, at least the taut tape: " + o.circ);
  assert.ok(/^↕ /.test(o.texts[0]) && /^⌒ /.test(o.texts[1]) && /^○ /.test(o.texts[2]), "each kind told by its sign, not by colour: " + o.texts);
  assert.deepStrictEqual(o.sel, [true, 0], "the height selected");
  assert.ok(o.dragged[1] > o.dragged[0] + 50, "the tape's end dragged lower: longer " + o.dragged);
  assert.deepStrictEqual(o.afterDelete, ["stape", "circ"]);
});

test("r10 / 4: the garment's measures follow the cloth: Linear Measure between two places, Circumference Measure round two panels sewn into a tube, Volume Measure of what the cloth encloses; Quick Pinching pulls the cloth only while simulating; Pin (Lasso) pins the points inside the drawn shape", () => {
  const o = boot({ blank: true, three: true, script: SEWN + DRIVE + `
    // a tube: the front and back sewn at both sides (no avatar, no simulation needed for the numbers)
    app.push("Sew"); S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] }); app.commit(); app.ev("garmentSync")();
    app.setTool3("linear_garment"); tap("linear_garment", ev(A.id, 50, 100)); tap("linear_garment", ev(A.id, 250, 100));
    const gv = app.ev("garMeasValue");
    out.lin = Math.round(gv(S.garMeas[0]).v);
    app.setTool3("circ_garment"); tap("circ_garment", ev(A.id, 150, 200));
    out.circ = Math.round(gv(S.garMeas[1]).v);
    // the volume: the two panels 240 apart with their sides open. Each panel encloses with the group's middle a pyramid of its
    // area and a third of 120 mm: 2 × 300 × 400 × 120 / 3 = 9.6 l (what is not closed by cloth adds nothing)
    app.setTool3("volume_measure"); tap("volume_measure", ev(A.id, 150, 200));
    out.vol = [S.garMeas[2].ids.length, +(gv(S.garMeas[2]).v/1e6).toFixed(1)];
    // the length follows the cloth: the front moved 0 but stretched in 3D by hand
    const it = G3.items.get(A.id); for (let v = 0; v < it.X.length; v += 3) it.X[v] *= 1.5; app.ev("itemMoved")(it);
    out.linAfter = Math.round(gv(S.garMeas[0]).v);
    app.ev("garmentSync")(true);
    // Quick Pinching: not simulating, it says so; simulating, a press on the cloth grabs it
    app.setTool3("quick_pinching"); const T3 = app.TOOL3.quick_pinching;
    T3.down(ev(A.id, 150, 200)); out.notOn = toasts[toasts.length - 1];
    app.simToggle(); out.grab = [T3.down(ev(A.id, 150, 200)), !!SIM.grab]; T3.up({}); out.released = !SIM.grab; app.simToggle();
    // Pin (Lasso): a square drawn round the middle of the front
    app.ev("garmentSync")(true); app.ev("view3d.scene()").updateMatrixWorld(true);
    app.setTool3("pin_lasso"); const L = app.TOOL3.pin_lasso, c = [[100, 150], [200, 150], [200, 250], [100, 250]].map(q => ev(A.id, q[0], q[1]));
    L.down(c[0]); for (const q of [...c.slice(1), c[0]]) L.move(q); L.up(c[0]);
    out.pins = (A.pins || []).map(q => q.x >= 95 && q.x <= 205 && q.y >= 145 && q.y <= 255);
    return out;` }).result;
  near(o.lin, 200, 2, "Linear Measure");
  near(o.circ, 2*300 + 2*240, 25, "the tape round the tube (two panels 300 wide, 240 apart)");
  assert.strictEqual(o.vol[0], 2, "the patterns sewn together"); near(o.vol[1], 9.6, 0.2, "the volume in litres");
  near(o.linAfter, 300, 3, "follows the cloth");
  assert.ok(/Space first/.test(o.notOn), o.notOn);
  assert.deepStrictEqual(o.grab, [true, true]); assert.strictEqual(o.released, true);
  assert.ok(o.pins.length > 4 && o.pins.every(Boolean), "points inside the lasso pinned, none outside: " + o.pins.length);
});

test("r10: no dead icon in the 3D window: every tool on the 3D toolbar (Show Tools That Are Not Built Yet on) is built, has its how-to line, and picking it puts it in hand or runs it without a \"not built\" note", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const shown = app.ev("shownTools"); out.tools = [];
    S.ui.unbuilt = true;
    for (const g of app.GROUPS.filter(g => g.win === "3D")) for (const t of shown(g)) {
      const n0 = toasts.length;
      if (t.toggle) { out.tools.push([t.id, "switch", !t.off]); continue; }
      app.pick(app.GROUPS.indexOf(g), t);
      const said = toasts.slice(n0).join(" | ");
      out.tools.push([t.id, app.TOOL3[t.id] ? (S.tool3 === t.id ? "in hand" : "not in hand") : app.CMD3[t.id] ? "command" : "none", !t.off, !!(app.HINT[t.id] || app.CMD3[t.id]), /not built/.test(said)]);
      app.ev("hideDlg")(); app.ev("hideMenu")();
    }
    return out;` }).result;
  assert.ok(o.tools.length >= 40, "the 3D toolbar's tools: " + o.tools.length);
  for (const [id, how, on, hint, nb] of o.tools) {
    if (how === "switch") { assert.ok(on, id); continue; }
    assert.ok(on, id + " is not a placeholder");
    assert.ok(how === "in hand" || how === "command", id + ": " + how);
    assert.ok(hint, id + " has its how-to line");
    assert.ok(!nb, id + " says nothing about not being built");
  }
});

/* ---------- 5 ---------- */
test("r10 / 5: a button's weight hangs on the cloth in the solver (its points heavier by the button type's Weight in grams); a buttonhole weighs nothing", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const lib = app.ev("libOf")(); if (!lib.button.length) app.ev("libAdd")("button"); lib.button[0].weight = 12;
    app.ev("addButton")("button", A.id, { x: 150, y: 200 }, null); app.ev("addButton")("hole", B.id, { x: 550, y: 200 }, null);
    const order = S.pieces.map(p => p.id), M = app.ev("simButtonMasses")(order);
    out.masses = M.map(m => [m.a.p, +m.m.toFixed(2), +m.a.w.reduce((a, b) => a + b, 0).toFixed(6)]);
    // the solver: the cloth's mass with the button against without
    const C = app.ev("SIM3D"), it = G3.items.get(A.id), pc = { xy: it.mesh.xy, tri: it.mesh.tri, X: it.X, fab: { weight: 150 } };
    const m0 = C.clothBuild({ pieces: [pc], opt: { self: false } }).mass.reduce((a, b) => a + b, 0);
    const m1 = C.clothBuild({ pieces: [pc], masses: [{ a: { ...M[0].a, p: 0 }, m: 12 }], opt: { self: false } }).mass.reduce((a, b) => a + b, 0);
    out.added = +(m1 - m0).toFixed(6);
    return out;` }).result;
  assert.deepStrictEqual(o.masses, [[0, 12, 1]], "one weight, the button's, spread over its triangle");
  near(o.added, 12, 1e-6, "12 g more cloth");
});

test("r10 / 5: the Spiral pattern: a click and the dialog make a band wound as a spiral (its inner edge the spiral, the outer one Width further out, closed by two straight ends), within 0.1 mm of the true spiral; a band as wide as its spacing is refused; one undo step", () => {
  const o = boot({ blank: true, script: `
    const out = {};
    app.setTool("spiral"); out.inHand = S.tool;
    const q = app.toS({ x: 0, y: 0 }); app.answer = (t, f) => { out.dlg = [t, f.map(x => x.k)]; return { turns: 1.5, sp: 120, r0: 60, wd: 100, dir: "cw" }; }; app.click(q.x, q.y);
    const p = S.pieces[S.pieces.length - 1];
    out.name = p && p.name; out.segs = p && p.segs.length; out.steps = app.histSteps().steps.map(s => s.n).slice(-1);
    // the inner edge against r = 60 + 120 θ / 2π, sampled along every segment
    let worst = 0; const segPt = app.ev("segPt");
    for (let i = 0; i < p.segs.length/2 - 1; i++) for (let k = 0; k <= 20; k++) {
      const P = segPt(p, i, k/20), th0 = Math.atan2(P.y, P.x), r = Math.hypot(P.x, P.y);
      // the turn it is on: the one whose spiral radius is nearest
      let best = Infinity; for (let n = -1; n <= 3; n++) { const th = th0 + 2*Math.PI*n; if (th < -1e-6 || th > 3*Math.PI + 1e-6) continue; best = Math.min(best, Math.abs(r - (60 + 120*th/(2*Math.PI)))); }
      worst = Math.max(worst, best);
    }
    out.worst = worst;
    out.outline = app.ev("outlineProblem")(p);
    // too wide: refused
    const n0 = S.pieces.length; app.answer = () => ({ turns: 2, sp: 50, r0: 20, wd: 60, dir: "cw" }); app.click(q.x, q.y); out.refused = S.pieces.length === n0;
    return out;` }).result;
  assert.strictEqual(o.inHand, "spiral"); assert.deepStrictEqual(o.dlg, ["Create Spiral", ["turns", "sp", "r0", "wd", "dir"]]);
  assert.ok(/^Spiral/.test(o.name), o.name); assert.strictEqual(o.segs, 2*4, "three half turns a side and two ends");
  assert.deepStrictEqual(o.steps, ["Spiral"]);
  assert.ok(o.worst < 0.1, "within 0.1 mm of the spiral: " + o.worst);
  assert.ok(!o.outline, "a pattern outline that does not cross itself: " + o.outline);
  assert.strictEqual(o.refused, true);
});

/* ---------- 7 ---------- */
test("r10 / 7: leaving out the body's field where a point cannot have reached the body gives the same cloth, point for point: a tube dropped over a ball and a cylinder, with and without the shortcut", () => {
  const C = require("../drafter-sim.js");
  const run = (sdfSkip) => {
    const tris = [], N = 32, P = (a, b, r, c) => [c[0] + r*Math.sin(a)*Math.cos(b), c[1] + r*Math.cos(a), c[2] + r*Math.sin(a)*Math.sin(b)];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a0 = Math.PI*i/N, a1 = Math.PI*(i+1)/N, b0 = 2*Math.PI*j/N, b1 = 2*Math.PI*(j+1)/N, c = [0, 1000, 0];
      tris.push(...P(a0, b0, 150, c), ...P(a1, b0, 150, c), ...P(a1, b1, 150, c), ...P(a0, b0, 150, c), ...P(a1, b1, 150, c), ...P(a0, b1, 150, c)); }
    const field = C.buildSDF(new Float32Array(tris), { cell: 10 }), W = 400, H = 300, res = 20, R = W/Math.PI + 10, pieces = [], M = [];
    for (let k = 0; k < 2; k++) { const m = C.meshPolygon([[0, 0], [W, 0], [W, H], [0, H]], res); M.push(m); const X = new Float32Array(m.xy.length*1.5);
      for (let i = 0; i < m.xy.length/2; i++) { const th = Math.PI*k + Math.PI*m.xy[2*i]/W; X.set([R*Math.cos(th), 1150 - m.xy[2*i+1], R*Math.sin(th)], 3*i); }
      pieces.push({ xy: m.xy, tri: m.tri, X, fab: { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 4.35, maxStretch: 0.08 } }); }
    const edge = (m, f) => Array.from({ length: m.xy.length/2 }, (_, i) => i).filter(i => f(m.xy[2*i], m.xy[2*i+1])).sort((p, q) => m.xy[2*p+1] - m.xy[2*q+1]);
    const side = (m, p, vs) => C.seamPath(vs.map(v => ({ a: { p, i: [v], w: [1] }, pos: [m.xy[2*v], m.xy[2*v+1]] })));
    const seams = [0, 1].map(k => ({ id: k + 1, pairs: C.seamPairs(side(M[k], k, edge(M[k], (x) => x > W - 1e-6)), side(M[1-k], 1 - k, edge(M[1-k], (x) => x < 1e-6)), res, true) }));
    const sim = C.clothBuild({ pieces, seams, field, opt: { self: true, ground: true, sdfSkip } });
    for (let f = 0; f < 120; f++) C.clothStep(sim, 1/60);
    return sim.x;
  };
  const a = run(false), b = run(true);
  let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  assert.strictEqual(d, 0, "the largest difference of any point: " + d + " mm");
});

module.exports = T;
