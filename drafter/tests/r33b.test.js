// Round r33b: the pull takes a handful of cloth (the sleeve that would not move), Seamless Blocking, the background image
// turned, Re-drape.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-r33b-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}

/* ---------- batch 1: the pull takes a handful of cloth ---------- */
// the solver alone: a tube of two panels sewn together, 3 % smaller round than an upright cylinder (an arm in a sleeve), draped, then
// pulled 60 mm up along the cylinder at one place of its top edge, held, let go
const C = require("../drafter-sim.js");
function sheet(w, h, res) {
  const pts = [], nx = Math.round(w/res), ny = Math.round(h/res), dx = w/nx, dy = h/ny;
  for (let i = 0; i < nx; i++) pts.push([i*dx, 0]); for (let j = 0; j < ny; j++) pts.push([w, j*dy]);
  for (let i = 0; i < nx; i++) pts.push([w - i*dx, h]); for (let j = 0; j < ny; j++) pts.push([0, h - j*dy]);
  return C.meshPolygon(pts, res);
}
const lay = (m, f) => { const n = m.xy.length/2, X = new Float32Array(3*n); for (let i = 0; i < n; i++) X.set(f(m.xy[2*i], m.xy[2*i+1]), 3*i); return X; };
const edge = (m, f) => Array.from({ length: m.xy.length/2 }, (_, i) => i).filter(i => f(m.xy[2*i], m.xy[2*i+1])).sort((p, q) => m.xy[2*p+1] - m.xy[2*q+1]);
const side = (m, p, vs) => C.seamPath(vs.map(v => ({ a: { p, i: [v], w: [1] }, pos: [m.xy[2*v], m.xy[2*v+1]] })));
function cylinder(r, y0, y1, n) {
  const t = [], P = (a, y) => [r*Math.cos(a), y, r*Math.sin(a)];
  for (let k = 0; k < n; k++) {
    const a = 2*Math.PI*k/n, b = 2*Math.PI*(k + 1)/n, A0 = P(a, y0), B0 = P(b, y0), A1 = P(a, y1), B1 = P(b, y1);
    t.push(...A0, ...A1, ...B1, ...A0, ...B1, ...B0, 0, y1, 0, ...B1, ...A1, 0, y0, 0, ...A0, ...B0);
  }
  return new Float32Array(t);
}
const FAB = { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 4.35, maxStretch: 0.08 };
const field = C.buildSDF(cylinder(60, 600, 1400, 96), { cell: 8 });
function pullTube(opt) {
  const R = 60, W = 0.97*Math.PI*R, H = 200, res = 10, rr = R + FAB.thick, A = sheet(W, H, res), B = sheet(W, H, res);
  const at = (th0) => (x, y) => { const th = th0 + Math.PI*x/W; return [rr*Math.cos(th), 1100 - y, rr*Math.sin(th)]; };
  const lA = edge(A, (x) => x < 1e-6), rA = edge(A, (x) => x > W - 1e-6), lB = edge(B, (x) => x < 1e-6), rB = edge(B, (x) => x > W - 1e-6);
  const seams = [{ id: 1, pairs: C.seamPairs(side(A, 0, rA), side(B, 1, lB), res, true) }, { id: 2, pairs: C.seamPairs(side(A, 0, lA), side(B, 1, rB), res, true) }];
  const sim = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, at(-Math.PI/2)), fab: FAB }, { xy: B.xy, tri: B.tri, X: lay(B, at(Math.PI/2)), fab: FAB }], seams, field, opt: { self: false, ground: false, ...opt } });
  const run = (k) => { for (let j = 0; j < k; j++) C.clothStep(sim, 1/60); };
  run(150);
  // the top edge's middle of panel A; the far side (panel B) watched
  const top = A.xy.length/2, c = edge(A, (x, y) => y < 1e-6).sort((p, q) => Math.abs(A.xy[2*p] - W/2) - Math.abs(A.xy[2*q] - W/2))[0];
  const meanY = (o, e) => { let y = 0; for (let i = o; i < e; i++) y += sim.x[3*i+1]; return y/(e - o); };
  const nB = sim.n - top, yA = meanY(0, top), yB = meanY(top, sim.n), at0 = [sim.x[3*c], sim.x[3*c+1], sim.x[3*c+2]];
  let gap = 0;
  for (let k = 1; k <= 60; k++) { C.clothDrag(sim, { i: [c], w: [1], to: [at0[0], at0[1] + 60*Math.min(1, k/20), at0[2]] }); run(1); gap = Math.max(gap, ...C.clothSeamGaps(sim).filter(Boolean).map(g => g.max)); }
  const held = { place: sim.x[3*c+1] - at0[1], A: meanY(0, top) - yA, B: meanY(top, sim.n) - yB, strain: C.clothStrain(sim) };
  C.clothDrag(sim, null); run(120);
  let inside = 0; for (let i = 0; i < sim.n; i++) if (C.sdfAt(field, sim.x[3*i], sim.x[3*i+1], sim.x[3*i+2]) < -2) inside++;
  const r1 = (v) => +v.toFixed(1);
  return { place: r1(held.place), A: r1(held.A), B: r1(held.B), strain: +held.strain.toFixed(3), stayedA: r1(meanY(0, top) - yA), stayedB: r1(meanY(top, sim.n) - yB), gap: +gap.toFixed(2), inside, nB, dragNow: sim.drag };
}
test("r33b / 1: the pull takes a handful of cloth and lets it slide while held: a snug tube on a cylinder (a sleeve on an arm) pulled up at one place moves as a whole, the far side too, and stays up once let go; no seam opens, nothing goes into the cylinder, its fabric's limit holds; one point and no sliding (as before) moves it far less", () => {
  const now = pullTube({}), before = pullTube({ dragReach: 0, dragMax: 1e6, dragSlideReach: 0, dragLimitIters: 0 });
  const both = JSON.stringify({ now, before });
  assert.ok(now.B > 2*before.B + 5, "the far side follows: " + both);
  assert.ok(now.A > 2*before.A + 5, "the pulled panel as a whole: " + both);
  assert.ok(now.stayedA > 0.6*now.A, "and stays up once let go: " + both);
  // (the snug tube is stretched round the cylinder before any pull: its worst edge is the same with the old pull; the pull adds little)
  assert.ok(now.strain < before.strain + 0.04, "the pull stretches the fabric hardly more than the tube already is: " + both);
  assert.ok(now.gap < 1, "no seam opens: " + both);
  assert.strictEqual(now.inside, 0, "nothing through the cylinder");
  assert.strictEqual(now.dragNow, null, "let go");
});

/* ---------- batches 2 and 3: Seamless Blocking, the background image turned (file version 29) ---------- */
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:400,y:0},{x:400,y:200},{x:0,y:200}], true));
  S.pieces.push(A); S.sel = []; app.commit(); S.undo.length = 0;
  const at = (x, y) => app.toS({ x, y }), out = {};
  const click = (x, y, o) => { const s = { ...at(x, y), ...(o || {}) }; app.fire("pointermove", s); app.fire("pointerdown", s); app.fire("pointerup", s); };
  const steps = () => app.histSteps().steps.map(s => s.n);
  const saveBytes = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return got; };
`;
test("r33b / 2: Seamless Blocking: from the outline through a point to the outline makes a block line and two sections without cutting the pattern; a section given a fabric shows its colour in 2D and on the cloth, the simulation keeps the pattern's own fabric and the Property Editor says so; the section's place moves with the pattern; saved as version 29; Backspace and Esc; Trace makes block lines", () => {
  const o = boot({ blank: true, three: true, script: DOC + `
    app.setTool("seamless_blocking");
    click(200, 0); out.started = !!S.blockDraft;
    click(150, 60); click(160, 120); app.key("Backspace"); out.afterBack = S.blockDraft && S.blockDraft.pts.length;
    click(200, 200);
    const ln = A.internals.find(x => x.block);
    out.line = [!!ln, ln && ln.pts.length, S.pieces.length, app.ev("blockSections")(A).length, steps().slice(-1)[0]];
    // a second line begun and given up
    click(0, 100); app.key("Escape"); out.esc = S.blockDraft;
    // a fabric of the library for the left section
    const red = app.ev("normLibItem")("fabric", { name: "Red", color: "#cc3311" }, 99); S.lib.fabric.push(red); app.commit();
    click(60, 100); out.selected = !!S.blockSel;
    out.panel = /Section fabric/.test(app.el("props").innerHTML) && /simulation uses the pattern/i.test(app.el("props").innerHTML);
    app.el("blk-f").value = "99"; app.el("blk-f").onchange();
    out.looks = app.ev("sectionLooks")(A, "front").map(x => x.color);
    out.blocks = JSON.parse(JSON.stringify(A.blocks)); out.step = steps().slice(-1)[0];
    out.sim = A.fabric === undefined || A.fabric !== 99;
    out.sig = /cc3311/.test(app.ev("paintSig")(A));
    // moved in 2D: the section's place goes with it, the look stays
    app.push(); app.ev("mapPiece")(A, (q) => ({ x: q.x + 1000, y: q.y + 50 })); app.commit();
    out.moved = [Math.round(A.blocks[0].at.x), app.ev("sectionLooks")(A, "front").length];
    // saved: version 29, the line and the section kept
    const b = saveBytes(), d = app.fileDoc(b);
    out.file = [d.v, (d.pieces[0].internals || []).some(x => x.block), (d.pieces[0].blocks || []).length];
    // Trace: an open internal line reaching the outline at both ends made a block line
    app.addChild(A, "internals", app.mkShape([{x:1320,y:50},{x:1320,y:250}], false)); app.commit();      // (in the right section: a block line runs to the outline or another block line, not across one)
    const L2 = A.internals[A.internals.length - 1];
    app.ev("traceAsBlock")([{ p: A, sh: L2, i: 0, kind: "internal" }]); out.traced = [!!L2.block || !!A.internals[A.internals.length - 1].block, app.ev("blockSections")(S.pieces[0]).length];
    return out;
  ` }).result;
  assert.strictEqual(o.started, true, "a click on the outline starts a line");
  assert.strictEqual(o.afterBack, 2, "Backspace took the last point away");
  assert.deepStrictEqual(o.line, [true, 3, 1, 2, "Seamless Blocking"], "a block line through one point, the pattern not cut, two sections, one step");
  assert.strictEqual(o.esc, null, "Esc gives a line up");
  assert.strictEqual(o.selected, true); assert.strictEqual(o.panel, true, "the section's fabric and the one line about the simulation");
  assert.deepStrictEqual(o.looks, ["#cc3311"], "the left section in the fabric's colour");
  assert.strictEqual(o.blocks.length, 1); assert.strictEqual(o.blocks[0].fabric, 99, "the full fabric reference: its id in the library");
  assert.strictEqual(o.step, "Section Fabric");
  assert.strictEqual(o.sim, true, "the pattern's own fabric is unchanged (the simulation's)");
  assert.strictEqual(o.sig, true, "the cloth's picture in 3D has the section's colour");
  assert.deepStrictEqual(o.moved, [1060, 1], "the section's place moved with the pattern");
  assert.deepStrictEqual(o.file, [31, true, 1], "saved as version 31 (Round H1a; 30 in r34) with the line and the section");      // (Round H1a: version 31) (Round r34: version 30; 29 in Round r33b)
  assert.deepStrictEqual(o.traced, [true, 3], "Trace as Seamless Block Line: a third section");
});
test("r33b / 3: the background image turns: the ring dragged a quarter round (Shift in steps of 15°), the Angle typed in the Property Editor; a turned picture moves and scales along its own sides; saved with its angle, none when 0", () => {
  const o = boot({ blank: true, script: DOC + `
    const im = app.ev("addImage")("bg.png", "data" + ":image/png;base64,QUJD", 200, 100);
    S.backdrop = { img: im.id, x: 0, y: 0, w: 200, h: 100, opacity: 0.5, lock: false, hide: false }; app.commit(); S.undo.length = 0;
    app.setTool("transform_pattern"); app.ev("backdropStart")("edit");
    // the ring: above the top edge's middle (100, 0), 28 px on the screen; dragged round to the right of the middle (100, 50), with Shift
    const rh = app.ev("bgRotHandle")(S.backdrop), a = app.toS(rh), b = at(190, 47);
    app.drag(a.x, a.y, b.x, b.y, { shiftKey: true }); app.fire("pointerup", b);
    out.turned = [S.backdrop.angle, steps().slice(-1)[0]];
    out.corners = app.ev("bgCorners")(S.backdrop).map(q => [Math.round(q.x), Math.round(q.y)]);
    // the Angle field
    app.el("bgp-a").value = "30"; app.el("bgp-a").onchange(); out.typed = S.backdrop.angle;
    // saved with it; turned back to 0, saved without it
    out.saved = app.fileDoc(saveBytes()).backdrop.angle;
    app.el("bgp-a").value = "0"; app.el("bgp-a").onchange(); out.zero = "angle" in app.fileDoc(saveBytes()).backdrop;
    return out;
  ` }).result;
  assert.deepStrictEqual(o.turned, [90, "Rotate Background Image"], "a quarter round, clockwise, in a step of 15°; one step");
  assert.deepStrictEqual(o.corners, [[150, -50], [150, 150], [50, 150], [50, -50]], "turned about its middle (100, 50): its top left corner now at the top right");
  assert.strictEqual(o.typed, 30);
  assert.strictEqual(o.saved, 30, "in the file");
  assert.strictEqual(o.zero, false, "0 is not written");
});

/* ---------- batch 4: Re-drape ---------- */
test("r33b / 4: Re-drape: the T-shirt draped on Marty, Marty made 125 mm shorter, 3D ▸ Arrangement ▸ Re-drape carries the garment down with his shoulders at once and simulates it from there: nothing in the body, the seams shut; two steps, undone back to the cloth as it hung; Auto 3D Arrangement stays not built", () => {
  const o = boot({ blank: true, three: true, storage: { "pdraft:avatar": JSON.stringify({ cell: 12 }) }, script: `
    return (async () => {
      const out = {};
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av && S.av.preset === "marty", "Marty");
      app.ev("openExample")(app.ev("shippedExamples")().find(e => e.id === "tshirt-marty"), true); await app.wait(() => S.av && S.av.preset === "marty" && S.pieces.length, "the example");
      const SIM = app.ev("SIM"), C = app.ev("SIM3D"), G3 = app.ev("G3");
      app.ev("garmentSync")();
      const frames = (n) => { for (let i = 0; i < n; i++) app.ev("simFrame")(); };
      app.ev("simStart")(); frames(200); app.ev("simStop")();
      out.kept = !!(G3.restBody && G3.restBody.T.length);
      // the collar: the front's highest point
      const front = S.pieces.find(p => /front/i.test(p.name)), top = () => { const X = G3.items.get(front.id).X; let y = -Infinity; for (let i = 1; i < X.length; i += 3) y = Math.max(y, X[i]); return y; };
      const y0 = top(), n0 = app.histSteps().steps.length;
      app.ev("setAvatar")({ height: 1750 });
      const row = app.ev("menu3D")().find(r => r && r.n === "Arrangement").menu().filter(Boolean);
      out.rows = row.map(r => r.n + (r.nb ? " (nb)" : ""));
      S.ui.unbuilt = true; out.auto = app.ev("menu3D")().find(r => r && r.n === "Arrangement").menu().filter(Boolean).find(r => /Auto 3D/.test(r.n)).nb === true;
      row.find(r => /Re-drape/.test(r.n)).f();
      out.carried = +(top() - y0).toFixed(1); out.on = SIM.on; out.toast = toasts[toasts.length - 1];
      frames(150);
      const f = app.ev("avatarField")(S.av), x = SIM.sim.x; let inBody = 0; for (let i = 0; i < SIM.sim.n; i++) if (C.sdfAt(f, x[3*i], x[3*i+1], x[3*i+2]) < -3) inBody++;
      out.inBody = inBody; out.gap = Math.max(...C.clothSeamGaps(SIM.sim).filter(Boolean).map(g => g.max));
      out.settled = +(top() - y0).toFixed(1);
      app.ev("simStop")();
      out.steps = app.histSteps().steps.slice(n0).map(s => s.n);
      app.undo(); app.undo(); { const fr = S.pieces.find(p => /front/i.test(p.name)); const X = G3.items.get(fr.id).X; let y = -Infinity; for (let i = 1; i < X.length; i += 3) y = Math.max(y, X[i]); out.undone = +(y - y0).toFixed(1); }
      return out;
    })();` }).result;
  assert.strictEqual(o.kept, true, "the body the garment rested on is kept when the run stops");
  assert.ok(o.rows.includes("Re-drape 3D Arrangement") && !o.rows.includes("Re-drape 3D Arrangement (nb)"), JSON.stringify(o.rows));
  assert.strictEqual(o.auto, true, "Auto 3D Arrangement stays not built");
  assert.ok(o.carried < -80 && o.carried > -140, "carried down with the shoulders at once: " + o.carried + " (" + o.toast + ")");
  assert.strictEqual(o.on, true, "and simulating");
  assert.strictEqual(o.inBody, 0, "nothing in the body");
  assert.ok(o.gap < 3, "the seams shut: " + o.gap);
  assert.ok(o.settled < -80, "it stays down on the shorter body: " + o.settled);
  assert.deepStrictEqual(o.steps, ["Re-drape", "Simulate"]);
  assert.ok(Math.abs(o.undone) < 1, "undone: the cloth as it hung on the taller body: " + o.undone);
});

module.exports = T;
