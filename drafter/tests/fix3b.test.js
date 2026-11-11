// Round FIX-3b: what FIX-3 left, and the maintainer's answer to FIX-3's question 1.
// Batch 0: New from Starter Pattern, a new block and a shipped library block come in at body height.
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
  const f = path.join(os.tmpdir(), "pdraft-fix3b-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
const PRESET = (n) => path.join(__dirname, "..", "assets", "avatar", "presets", n + ".glb");
const has = (n) => fs.existsSync(PRESET(n));
// each pattern's 2D top and its 3D height range (its cloth's middle and half its 2D height)
const LOOK = `
  const look = () => S.pieces.map(p => { const b = app.ev("bboxOf")([p]); return { name: p.name, x0: Math.round(b.x0), x1: Math.round(b.x1), y0: Math.round(b.y0), y1: Math.round(b.y1), z: p.p3 ? Math.round(p.p3.pos[1]) : null }; });
  const okAll = (title, fields, opts) => ({ ...Object.fromEntries(fields.map(f => [f.k, f.val])), ...Object.fromEntries(((opts && opts.selects) || []).map(c => [c.k, c.val])) });
`;

test("FIX-3b / 0: New from Starter Pattern puts the bodice at chest height (its top at the neck joint, Marty's with no avatar), the view fitted to it; in 3D it stands between the waist and the neck", () => {
  const r = boot({ blank: true, three: true, script: LOOK + `
    app.ev("starterDoc")(true);
    return { p: look(), undo: S.undo.length, at: app.ev("BODY_AT") };`, });
  const p = r.p[0];
  assert.strictEqual(r.p.length, 1);
  assert.strictEqual(p.y0, -r.at.neck, "the top at the neck joint's height: " + JSON.stringify(p));
  assert.ok(p.z > r.at.waist && p.z < r.at.neck, "in 3D between the waist and the neck: " + JSON.stringify(p));
  assert.ok(p.x0 >= -1, "the centre front stays on the vertical axis (3D x = 0)");
});

test("FIX-3b / 0: a new block (New Block…) on Marty: the skirt's front panel top at his waist height, its pieces' layout kept, the 3D panels over the hips; redrafting leaves it where it is; a sleeve goes beside the shoulder at the upper arm's height" + (has("marty") ? "" : " (Marty is not here: skipped)"), () => {
  if (!has("marty")) return;
  const r = boot({ blank: true, three: true, script: LOOK + `
    return (async () => {
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      const m = app.ev("avatarMeasures")(S.av), B = app.ev("bodyAt")();
      app.answer = okAll;
      app.ev("blockNumeric")({ x: 0, y: 0 }, "skirt", "simple", {}, null, { x: 0, y: 0 });
      const first = look();
      const P = S.pieces[0]; app.ev("blockNumeric")({ x: 0, y: 0 }, "skirt", "simple", P.block.given, P.block.key);
      const again = look();
      app.answer = null;
      const sq = app.mkPiece("Sleeve", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:500},{x:0,y:500}], true));
      const sq2 = app.mkPiece("Sleeve 2", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:500},{x:0,y:500}], true));
      app.ev("bodyPlace")([sq, sq2]);
      const sl = [sq, sq2].map(p => app.ev("bboxOf")([p]));
      return { m, B, first, again, sl };
    })();` });
  const front = r.first.find(p => p.name === "Skirt front");
  assert.strictEqual(r.B.waist, r.m.waistY, "the waist height is the avatar's own, measured");
  assert.strictEqual(front.y0, -r.m.waistY, "the front panel's top at the waist: " + JSON.stringify(front));
  assert.ok(front.z < r.m.waistY && front.z > r.m.waistY - 707, "its cloth's middle below the waist, above the hem: " + front.z);
  assert.ok(Math.abs(front.x0 + front.x1) <= 2, "the front centred on the vertical axis, as drafted at the origin");
  const band = r.first.find(p => /band/i.test(p.name));
  if (band) assert.ok(band.y1 <= front.y0, "the waistband above the panels, as drafted");
  assert.deepStrictEqual(r.again.map(p => [p.name, p.y0]), r.first.map(p => [p.name, p.y0]), "redrafting keeps the pieces where they are");
  assert.ok(Math.abs(r.sl[0].y0 + r.B.arm) < 1e-6 && r.sl[0].x0 >= r.B.armX - 1e-6, "the first sleeve's top at the upper arm, beside the shoulder on +x: " + JSON.stringify([r.sl[0], r.B]));
  assert.ok(r.sl[1].x1 <= -r.B.armX + 1e-6, "the second on the other side");
});

test("FIX-3b / 0: a shipped library block, opened or added, comes in at body height (no avatar: Marty's waist); the user's own library patterns where they were saved", () => {
  const r = boot({ blank: true, three: true, script: LOOK + `
    const e = app.ev("shippedBlocks")()[0];
    app.ev("libraryOpen")(e); const opened = look();
    app.ev("newDoc")(true); app.ev("libraryAdd")(e); const added = look();
    const mine = { name: "Mine", doc: app.ev("clone")(e.doc) };
    app.ev("newDoc")(true); app.ev("libraryAdd")(mine); const own = look();
    return { opened, added, own, at: app.ev("BODY_AT"), raw: Math.round(app.ev("bboxOf")([e.doc.pieces.find(p => p.name === "Skirt front")]).y0) };`, });
  for (const k of ["opened", "added"]) {
    const f = r[k].find(p => p.name === "Skirt front");
    assert.strictEqual(f.y0, -r.at.waist, k + ": the front's top at the waist: " + JSON.stringify(f));
    assert.ok(f.z < r.at.waist && f.z > 0, k + ": in 3D below the waist, above the floor");
  }
  assert.strictEqual(r.own.find(p => p.name === "Skirt front").y0, r.raw, "one's own pattern as saved");
});



// Batch A: the seam's Property Editor (W15); batch B: the Set Sublayer tool and Refresh Seam Allowance
const SEWN = `
  const sq = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:-1400},{x:x+300,y:-1400},{x:x+300,y:-1000},{x:x,y:-1000}], true));
  app.push("Two"); const A = sq("A", 0), B = sq("B", 400); S.pieces.push(A, B);
  const sm = app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true); S.seams.push(sm); app.commit();
  const pr = app.el("props"), el = (id) => app.el(id), set = (id, v) => { const e = el(id); if (typeof v === "boolean") e.checked = v; else e.value = String(v); e.onchange({ target: e }); };
  const pick = () => { app.setTool("edit_sewing"); S.selSeam = S.seams[0].id; S.sel = [A.id]; app.ev("ui")(); };
`;
test("FIX-3b / A: a seam selected with Edit Sewing has the recordings' rows (Name, Tension, Set Sublayer, Topstitch, Puckering, 3D Seamline with its Normal Map's Intensity and Thickness); each change one step, kept on the seam only when set, in the file and back; Topstitch and Puckering make and take away the seamline topstitch and puckering", () => {
  const r = boot({ blank: true, desktop: true, script: SEWN + `
    const out = {}; pick();
    /* the pattern's own Name comes first */ out.rows = (pr.innerHTML.match(/<label[^>]*>[^<]*<[/]label>/g) || []).map(s => s.replace(/<[^>]+>/g, "")).filter(s => /^(Name|Tension|Set Sublayer|Topstitch|Puckering|3D Seamline|Intensity|Thickness)/.test(s));
    const nmShown = () => (pr.innerHTML.match(/id="sp-nm" value="([^"]*)"/) || [])[1]; out.name0 = nmShown();
    const n0 = S.undo.length;
    set("sp-nm", "Side seam"); pick(); set("sp-ten", true); pick(); set("sp-tv", 25); pick(); set("sp-sub", true); pick();
    set("sp-st", true); pick(); set("sp-pk", true); pick(); set("sp-l3i", 40); pick(); set("sp-l3t", 2);
    out.steps = S.undo.length - n0; out.names = S.un.slice(-8).map(x => x.n);
    const s0 = S.seams[0]; out.sm = { name: s0.name, tension: s0.tension, sub: s0.sub, line3: s0.line3 };
    out.made = [S.stitches.filter(st => st.seam === s0.id).length, S.puckers.filter(pk => pk.seam === s0.id).length];
    app.desk.dialog = "C:\\\\x\\\\seam.pdraft"; app.saveDoc(false); const file = app.desk.files.get(app.desk.dialog);
    const d = app.fileDoc(file); out.saved = { name: d.seams[0].name, tension: d.seams[0].tension, sub: d.seams[0].sub, line3: d.seams[0].line3 };
    app.ev("openFile")("seam.pdraft", file, null, true); const o = S.seams[0]; out.opened = { name: o.name, tension: o.tension, sub: o.sub, line3: o.line3 };
    pick(); set("sp-st", false); pick(); set("sp-pk", false); pick(); set("sp-ten", false); pick(); set("sp-nm", "");
    out.off = [S.stitches.length, S.puckers.length, "tension" in S.seams[0], "name" in S.seams[0], (pick(), nmShown())];
    pick(); set("sp-l3k", "none"); out.none = S.seams[0].line3; pick(); out.noRows = !pr.innerHTML.includes("sp-l3i");
    return out;`, });
  assert.deepStrictEqual(r.rows.slice(1), ["Name", "Tension", "Set Sublayer", "Topstitch", "Puckering", "3D Seamline", "Intensity", "Thickness (mm)"], "the rows in W15's order: " + JSON.stringify(r.rows));
  assert.strictEqual(r.name0, "Sewing_1", "named as the reference names a seam until a name is typed");
  assert.strictEqual(r.steps, 8, "one step a change"); assert.deepStrictEqual(r.names, ["Seam Name", "Seam Tension", "Seam Tension", "Set Sublayer", "Seamline Topstitch", "Seamline Puckering", "3D Seamline", "3D Seamline"]);
  assert.deepStrictEqual(r.sm, { name: "Side seam", tension: 25, sub: true, line3: { kind: "plain", i: 40, t: 2 } });
  assert.deepStrictEqual(r.made, [2, 2], "a topstitch and a puckering on each side");
  assert.deepStrictEqual(r.saved, r.sm, "in the file"); assert.deepStrictEqual(r.opened, r.sm, "and back");
  assert.deepStrictEqual(r.off, [0, 0, false, false, "Sewing_1"], "switched off: taken away; the name typed empty: the default again");
  assert.deepStrictEqual(r.none, { kind: "none", i: 40, t: 2 }); assert.ok(r.noRows, "None: no Normal Map rows");
});

test("FIX-3b / A, B: a seam's Tension is an elastic of its sides in the solver (ratio 100 - tension), both sides; Set Sublayer and the Set Sublayer tool put the pattern under one layer nearer the body (its own Layer untouched); the tool's second click on the same pattern takes it away; Refresh Seam Allowance says what it found; a Plain Seam is drawn on the cloth with Show Seamlines off", () => {
  const r = boot({ blank: true, three: true, script: SEWN + `
    const out = {};
    app.ev("garmentSync")();
    const els = () => S.pieces.map(p => app.ev("elasticsOf")(p, app.ev("G3").items.get(p.id).mesh).map(e => [e.i.length, e.r]));
    out.none = els();
    pick(); set("sp-ten", true); pick(); set("sp-tv", 20); out.ten = els();
    const lay = () => [...app.ev("simLayers")(S.pieces.map(p => p.id)).values()];
    out.lay0 = lay(); pick(); set("sp-sub", true); out.laySub = lay(); out.own = S.pieces.map(p => p.layer);
    pick(); set("sp-sub", false);
    app.setTool("set_sublayer"); const n0 = S.undo.length;
    app.ev("sublayerClick")(A); out.firstStep = S.undo.length - n0;
    app.ev("sublayerClick")(B); out.under = [A.under3 === B.id, S.undo.length - n0, lay()];
    S.ui.unbuilt = false; S.sel = [A.id]; app.setTool("transform_pattern"); app.ev("ui")(); out.note = /Sublayer of <b>B<[/]b>/.test(pr.innerHTML);
    app.setTool("set_sublayer"); app.ev("sublayerClick")(A); app.ev("sublayerClick")(A); out.gone = ["under3" in A, lay()];
    app.ev("refreshSA")(); out.toast = app.toasts ? app.toasts[app.toasts.length - 1] : null;
    S.ui.show3d = { ...(S.ui.show3d || {}), sewing3: false }; app.ev("garmentLines")();
    const g = app.view3d.group("seam3d"); out.plain = g ? g.children.length : -1;
    S.ui.show3d.sewing3 = true; app.ev("garmentLines")(); out.plainOn = g ? g.children.length : -1;
    return out;`, });
  assert.deepStrictEqual(r.none, [[], []], "no tension: no elastic");
  assert.ok(r.ten.every(L => L.length === 1 && L[0][0] > 2 && L[0][1] === 80), "each side an elastic at ratio 80: " + JSON.stringify(r.ten));
  assert.deepStrictEqual(r.lay0, [0, 0]); assert.deepStrictEqual(r.laySub, [1, 0], "side B under side A: " + JSON.stringify(r.laySub)); assert.deepStrictEqual(r.own, [0, 0], "the document's Layer untouched");
  assert.strictEqual(r.firstStep, 0, "the first click only picks");
  assert.deepStrictEqual(r.under, [true, 1, [0, 1]], "A under B: B one layer further out; one step");
  assert.ok(r.note, "the Property Editor says it");
  assert.deepStrictEqual(r.gone, [false, [0, 0]], "the same pattern twice: taken away");
  assert.strictEqual(r.plain, 2, "the Plain Seam along both sides while Show Seamlines is off");
  assert.strictEqual(r.plainOn, 0, "with Show Seamlines on, its coloured line instead");
});


// Batch C: Add Dart with Fullness, Perpendicular Pattern Corner (an outline point's menu), Shirring, a pattern's Pressure
test("FIX-3b / C: Add Dart with Fullness on an outline point opens the pattern by the dart's width, hinged on its far side: the outline gains the width, the two legs are sewn to each other and meet Length in; one step; a reason and no step where it cannot be made", () => {
  const r = boot({ blank: true, script: `
    const P = app.mkPiece("Skirt", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:600},{x:0,y:600}], true));
    app.push("Rect"); S.pieces.push(P); app.commit();
    const per0 = P.segs.reduce((s, x, i) => s + app.ev("segLen")(P, i), 0);
    const pt = P.pts.findIndex(q => q.x === 300 && q.y === 0);
    const n0 = S.undo.length;
    app.push("Add Dart with Fullness"); const res = app.ev("addDartFullAt")(P, pt, 30, 120, false); app.commit();
    const legs = res.legs, li = legs.map(id => P.segs.findIndex(s => s.id === id)), L = li.map(i => app.ev("segLen")(P, i));
    const per = P.segs.reduce((s, x, i) => s + app.ev("segLen")(P, i), 0);
    const sewn = S.seams.some(sm => sm.a[0].sids.includes(legs[0]) && sm.b[0].sids.includes(legs[1]) || sm.a[0].sids.includes(legs[1]) && sm.b[0].sids.includes(legs[0]));
    const mouth = [P.pts[li[0]], P.pts[(li[1] + 1) % P.pts.length]];
    const steps = S.undo.length - n0;
    app.push("x"); const tooLong = app.ev("addDartFullAt")(P, 0, 30, 5000, false); app.ev("unpush")();
    return { res: !!legs, L: L.map(v => +v.toFixed(2)), grew: +(per - per0).toFixed(2), sewn, mouth: +Math.hypot(mouth[0].x - mouth[1].x, mouth[0].y - mouth[1].y).toFixed(2), tooLong, n: S.pieces.length, steps };`, });
  assert.ok(r.res && r.n === 1, "made");
  assert.ok(Math.abs(r.L[0] - r.L[1]) < 0.01 && r.L[0] > 119, "two legs alike, Length in: " + r.L);
  assert.ok(Math.abs(r.mouth - 30) < 0.01, "the opening is the dart's width: " + r.mouth);
  assert.ok(r.grew > 0, "the outline gained length (the legs and the opening): " + r.grew);
  assert.ok(r.sewn, "the legs sewn to each other"); assert.strictEqual(r.steps, 1);
  assert.ok(typeof r.tooLong === "string" && r.tooLong.length > 5, "a dart longer than the pattern: a reason");
});

test("FIX-3b / C: Perpendicular Pattern Corner (W60: Length 5 mm, Direction Start / End): the line of Direction gets a point Length from the corner, square to the other line; the rest runs on to where it ran; too long a length is refused", () => {
  const r = boot({ blank: true, script: `
    const P = app.mkPiece("Hem", app.mkShape([{x:0,y:0},{x:400,y:0},{x:600,y:346.41},{x:0,y:346.41}], true));
    app.push("P"); S.pieces.push(P); app.commit();
    const ang = (a, b, c) => { const u = [a.x - b.x, a.y - b.y], v = [c.x - b.x, c.y - b.y]; return Math.acos((u[0]*v[0] + u[1]*v[1])/Math.hypot(u[0], u[1])/Math.hypot(v[0], v[1]))*180/Math.PI; };
    app.push("Perpendicular Pattern Corner"); const e = app.ev("perpCornerAt")(P, 1, 10, "start"); app.commit();
    const A = P.pts[0], C = P.pts[1], Q = P.pts[2];
    const out = { e, n: P.pts.length, square: +ang(A, C, Q).toFixed(3), len: +Math.hypot(Q.x - C.x, Q.y - C.y).toFixed(3), far: [P.pts[3].x, +P.pts[3].y.toFixed(2)] };
    out.bad = app.ev("perpCornerAt")(P, 1, 5000, "start");
    return out;`, });
  assert.strictEqual(r.e, ""); assert.strictEqual(r.n, 5, "one point more");
  assert.ok(Math.abs(r.square - 90) < 1e-6, "square to the other line: " + r.square);
  assert.ok(Math.abs(r.len - 10) < 1e-6, "Length from the corner");
  assert.deepStrictEqual(r.far, [600, 346.41], "the rest runs on to where it ran");
  assert.ok(/shorter/.test(r.bad), "refused: " + r.bad);
});

test("FIX-3b / C: Shirring on an elastic line (Interval 20, Height 80, Direction): only with Elastic on, one step a change, taken away with the elastic, in the file; the cloth Height deep beside the line bends SHIRR_BEND times as easily in the solver (zones), on the side of Direction", () => {
  const r = boot({ blank: true, three: true, script: `
    const P = app.mkPiece("Panel", app.mkShape([{x:0,y:-1400},{x:400,y:-1400},{x:400,y:-1000},{x:0,y:-1000}], true));
    app.push("P"); S.pieces.push(P); app.commit(); app.ev("garmentSync")();
    app.setTool("edit_pattern"); S.sel = [P.id]; S.selKind = "outline"; S.selSeg = 0; S.selPt = -1;
    const out = {};
    app.ev("setShirr")({ on: true }); out.noEl = !P.segs[0].shirr;
    app.ev("setElastic")({ on: true }); const n0 = S.undo.length; app.ev("setShirr")({ on: true }); app.ev("setShirr")({ h: 50 }); out.steps = S.undo.length - n0;
    out.sh = P.segs[0].shirr;
    const it = app.ev("G3").items.get(P.id), fab = app.ev("fabricPhys")(app.ev("fabricOf")(P));
    const z = app.ev("shirrZones")(P, it.mesh, fab, null), soft = z ? z.t.filter(k => k >= 0).length : 0;
    out.zone = [soft > 0, z ? soft < z.t.length : false, z ? z.fabs[0].bend / fab.bend : 0];
    app.ev("setShirr")({ dir: "a" }); const za = app.ev("shirrZones")(P, it.mesh, fab, null); out.sideA = za ? za.t.filter(k => k >= 0).length : 0;
    app.ev("setShirr")({ dir: "b" }); const zb = app.ev("shirrZones")(P, it.mesh, fab, null); out.sideB = zb ? zb.t.filter(k => k >= 0).length : 0;
    app.ev("ui")(); out.rows = ["sh-on", "sh-iv", "sh-h", "sh-dir"].every(id => app.el("props").innerHTML.includes('id="' + id + '"'));
    const d = JSON.parse(app.docJSON()); out.saved = d.pieces[0].segs[0].shirr;
    app.ev("setElastic")({ on: false }); out.gone = "shirr" in P.segs[0];
    return out;`, });
  assert.ok(r.noEl, "no elastic: no shirring");
  assert.strictEqual(r.steps, 2);
  assert.deepStrictEqual(r.sh, { iv: 20, h: 50, dir: "both" });
  assert.ok(r.zone[0] && r.zone[1], "some of the cloth, not all: " + JSON.stringify(r.zone));
  assert.ok(Math.abs(r.zone[2] - 0.05) < 1e-12, "bends SHIRR_BEND times as easily");
  assert.ok((r.sideA > 0) !== (r.sideB > 0), "only one side of an outline line has cloth: " + [r.sideA, r.sideB]);
  assert.ok(r.rows, "the rows in the Elastic section");
  assert.deepStrictEqual(r.saved, { iv: 20, h: 50, dir: "b" }, "in the file");
  assert.strictEqual(r.gone, false, "Elastic off takes the shirring with it");
});

test("FIX-3b / C: a pattern's Pressure (Pa) pushes its cloth along its triangles' normals, the other way when negative; 0 adds nothing (the cloth bit for bit as before); kept on the pattern only when not 0, within the range", () => {
  const C = require("../drafter-sim.js");
  const W = 200, st = 20, cols = W/st + 1, xy = [], X = [], tri = [];
  for (let j = 0; j < cols; j++) for (let i = 0; i < cols; i++) { xy.push(i*st, j*st); X.push(i*st, 1000 - j*st, 0); }
  for (let j = 0; j + 1 < cols; j++) for (let i = 0; i + 1 < cols; i++) { const a = j*cols + i, b = a + 1, c = a + cols, d = c + 1; tri.push(a, d, b, a, c, d); }
  const run = (press) => {
    const sim = C.clothBuild({ pieces: [{ xy: new Float64Array(xy), tri: new Uint32Array(tri), X: new Float32Array(X), fab: { weight: 150, stretch: 2e4, bend: 10, friction: 0.3 }, ...(press !== undefined ? { press } : {}) }], seams: [], pins: [0, cols - 1, cols*(cols - 1), cols*cols - 1].map(v => ({ p: 0, v })), opt: { substeps: 10, self: false, ground: false, gravity: 0 } });
    for (let f = 0; f < 40; f++) C.clothStep(sim, 1/60);
    const mid = Math.floor(cols*cols/2); return { z: sim.x[3*mid + 2], x: Array.from(sim.x) };
  };
  const none = run(), zero = run(0), up = run(20), down = run(-20);
  assert.deepStrictEqual(zero.x, none.x, "0: nothing added");
  assert.ok(Math.abs(up.z) > 1 && Math.sign(up.z) === -Math.sign(down.z), "pushed one way and the other: " + [up.z, down.z]);
  const r = boot({ blank: true, script: `
    const P = app.mkPiece("P", app.mkShape([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], true));
    S.pieces.push(P); P.press3 = "12.5"; app.ev("normProps")(P); const a = P.press3; P.press3 = 0; app.ev("normProps")(P); const b = "press3" in P; P.press3 = 999; app.ev("normProps")(P);
    return [a, b, P.press3];`, });
  assert.deepStrictEqual(r, [12.5, false, 50], "a number, gone at 0, held within the range");
});


// Batch D: grading carried through Slash & Spread (PK §4.5)
test("FIX-3b / D: Slash & Spread carries the grading: the side that turns has its sizes' offsets turned with it, the side that stays keeps them, both copies of the opened point keep the point's grading (the moved one turned), a pivot keeps its own; every size of the spread pattern opens as the base does", () => {
  const r = boot({ blank: true, oldSizeRun: true, script: `
    // 0 (0,0) 1 (100,0) 2 (200,0) 3 (200,300) 4 (100,300) 5 (0,300): slashed from 1 down to 4, opened 40 at the top, hinged at 4
    const P = app.mkPiece("P", app.mkShape([{x:0,y:0},{x:100,y:0},{x:200,y:0},{x:200,y:300},{x:100,y:300},{x:0,y:300}], true));
    S.pieces.push(P); P.grain = { a: { x: 50, y: 50 }, b: { x: 50, y: 250 } };
    const G = S.grading, L = G.groups[0].sizes.find(z => z.name === "L").id;
    app.ev("ensureGrade")(G, P);
    const off = [[-5, -5], [0, -8], [6, -5], [6, 7], [0, 9], [-5, 7]];
    off.forEach(([dx, dy], i) => app.ev("setPtDelta")(G, P, P, i, L, dx, dy));
    app.push("S&S"); app.commit();
    const before = P.pts.map(q => ({ ...q })), key = (i) => app.ev("ptKey")(P, P, i), dOf = (i) => { const en = P.grade.pts[key(i)]; return en ? app.ev("mapDelta")(app.ev("entryMap")(G, P, en), L) : null; };
    const r = app.ev("slashSpread")(P, 1, 4, 40, 0, []);
    app.commit();
    const out = { made: !!r, n: P.pts.length, d: P.pts.map((q, i) => { const d = dOf(i); return d && [+d.x.toFixed(3), +d.y.toFixed(3)]; }), pts: P.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]) };
    // the L size of the spread pattern and the spread of the L size: the turned side's points
    const gL = app.ev("gradedPiece")(G, P, L); out.gl = gL.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
    return out;`, });
  assert.ok(r.made && r.n === 7, "one point more (the opened top): " + r.n);
  // which side turned: the one without the grainline (x > 100); its points turned about (100,300)
  const turned = r.pts.map(([x, y], i) => i).filter(i => r.pts[i][0] > 100.5 || (r.pts[i][0] > 99.5 && r.pts[i][1] < 1 && i !== r.pts.findIndex(q => q[0] === 100 && q[1] === 0)));
  const len = (v) => Math.hypot(v[0], v[1]);
  // every point keeps its offset's length (turned or not); every point is graded
  assert.ok(r.d.every(Boolean), "every point graded, the new copy too: " + JSON.stringify(r.d));
  const lens = r.d.map(len).map(v => +v.toFixed(2)).sort((a, b) => a - b), want = [[-5, -5], [0, -8], [0, -8], [6, -5], [6, 7], [0, 9], [-5, 7]].map(len).map(v => +v.toFixed(2)).sort((a, b) => a - b);
  assert.deepStrictEqual(lens, want, "offsets turned, never stretched; the top point's on both copies: " + JSON.stringify([lens, want, r.d, r.pts]));
  // the fixed side's points keep their offsets exactly
  const fixedIdx = r.pts.findIndex(q => q[0] === 0 && q[1] === 0);
  assert.deepStrictEqual(r.d[fixedIdx], [-5, -5], "the side that stays: as it was");
  const pivot = r.pts.findIndex(q => q[0] === 100 && q[1] === 300);
  assert.deepStrictEqual(r.d[pivot], [0, 9], "the pivot keeps its own");
  const far = r.pts.findIndex(q => q[0] > 150 && q[1] > 250);
  assert.ok(r.d[far][0] !== 6 || r.d[far][1] !== 7, "the turned side's offsets are turned: " + JSON.stringify(r.d[far]));
  assert.ok(turned.length >= 2);
});


// Batch E: the tools that were `partly`
test("FIX-3b / E: Show 2D Sewing is the Show Sewing switch (off at every start; the button says whether it is on); the tools whose missing part was built are `built`; those left `partly` say why in their tip or note", () => {
  const r = boot({ blank: true, script: `
    const T = app.TOOLS, gi = (id) => app.ev("GROUPS").findIndex(g => g.some(x => x.id === id));
    const out = { start: S.show.sewing, tool: S.tool };
    app.pick(gi("show_sewing"), T.show_sewing); out.on = [S.show.sewing, S.tool];
    app.pick(gi("show_sewing"), T.show_sewing); out.off = S.show.sewing;
    out.st = ["edit_curve_point", "trace", "notch", "annotations", "measure", "edit_sewing", "show_sewing", "fold_arrangement", "fullness_point", "fullness_line", "edit_texture", "pattern_drafter", "hi_res", "low_res", "custom_res"].map(id => T[id].st);
    return out;`, });
  assert.strictEqual(r.start, false, "off at the start");
  assert.deepStrictEqual(r.on, [true, r.tool], "on, and the tool in hand stays");
  assert.strictEqual(r.off, false);
  // (Round BETA8-1 / C, roadmap 2.C24: edit_texture moves the fabric's texture with the grainline: built)
  assert.deepStrictEqual(r.st, ["built", "built", "built", "built", "built", "built", "built", "built", "partly", "partly", "built", "partly", "partly", "partly", "partly"]);
});
module.exports = T;
