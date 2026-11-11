// Round r20 continued (4), batch 3: the rest of batch 11. A button type dragged onto a placed button (74), Glue Fill (75), Show 3D
// Shadow and Show Light (3D / Render) (77), the 3D background's Grid Properties (81), a pattern's own Rendering Thickness and
// Extrusion Direction (84), Volume Measure's mesh, target, tolerance and Mesh Scale with Edit Volume Measure (72).
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  let arg = JSON.stringify(opt || {});
  if (arg.length > 30000) { const f = path.join(require("os").tmpdir(), "pdraft-boot-r20b11-" + process.pid + ".json"); fs.writeFileSync(f, arg); arg = "@" + f; }
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), arg], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors).slice(0, 600));
  return o;
}
// a front and a back sewn into a tube in 3D, and a pocket lying on the front in 2D
const DOC = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400), sq("Pocket", 50, 50, 100, 120));
  const A = S.pieces[0], B = S.pieces[1], P = S.pieces[2], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 }; P.p3 = { pos: [600, 1100, 300], q: [0, 0, 0, 1], r: 0 };
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] });
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")(); S.undo.length = 0;
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 });
  const steps = () => app.histSteps().steps.map(s => s.n);
  const said = () => String(toasts[toasts.length - 1] || "");
`;

test("74: a button type dragged from the Object Browser onto a placed button gives it that type (one step); a buttonhole type goes onto a buttonhole only; dropped beside, it says where", () => {
  const o = boot({ blank: true, three: true, script: DOC + `
    app.push(); const t1 = app.libAdd("button"), t2 = app.libAdd("button"), h1 = app.libAdd("buttonhole"); app.commit();
    const b = app.ev("addButton")("button", A.id, { x: 150, y: 200 }, t1.id), bh = app.ev("addButton")("hole", A.id, { x: 150, y: 300 }, h1.id);
    const n0 = steps().length, cv = app.ev("cv"), at = (x, y) => app.toS({ x, y }), drop = (kind, id, q) => app.ev("libDrop")({ target: cv, clientX: q.x, clientY: q.y, dataTransfer: { types: [app.ev("LIB_DRAG")], getData: () => kind + ":" + id } });
    drop("button", t2.id, at(150, 200));
    out.one = [S.buttons.find(x => x.id === b).lib === t2.id, steps().length - n0, steps().slice(-1)[0]];
    drop("buttonhole", h1.id, at(150, 200)); out.wrong = [S.buttons.find(x => x.id === b).lib === t2.id, steps().length - n0];
    drop("button", t1.id, at(20, 20)); out.beside = [S.buttons.find(x => x.id === b).lib === t2.id, said()];
    app.undo(); out.undone = S.buttons.find(x => x.id === b).lib === t1.id;
    // the rows of the Object Browser's button tab are draggable
    app.ev("obSelect")("button", null); const rows = Array.from(app.el("ob-items").children).filter(r => /obi/.test(r.className || ""));      // (Round BETA8-1 / C3: the Catalogue… button under the types is no type)
    out.rows = [rows.length, rows.every(r => r.draggable === true)];
    return out;` }).result;
  assert.deepStrictEqual(o.one, [true, 1, "Assign Button Type"], JSON.stringify(o));
  assert.deepStrictEqual(o.wrong, [true, 1], "a buttonhole type is not put on a button: " + JSON.stringify(o));
  assert.strictEqual(o.beside[0], true); assert.ok(/Drop a button type onto a placed button/.test(o.beside[1]), o.beside[1]);
  assert.ok(o.undone);
  assert.ok(o.rows[0] >= 2 && o.rows[1], "every button type a draggable row (the library's own and the two added): " + JSON.stringify(o.rows));
});

test("75: Glue Fill: a click on a piece lying on another in 2D glues it to the one it overlaps most, its outline the area, no map between them; Shift+click takes its glue away; one step each", () => {
  const o = boot({ blank: true, three: true, script: DOC + `
    app.setTool("glue_fill"); out.tool = [S.tool, S.tool3];
    const n0 = steps().length, q = app.toS({ x: 100, y: 110 });
    app.ev("glueFillClick")(q.x, q.y, false);
    const g = S.glues[0];
    out.glue = [S.glues.length, g.kind, g.a === P.id, g.b === A.id, JSON.stringify(g.m), g.poly.length >= 4, steps().slice(n0)];
    // in the solver its points are sewn to the front where they lie on it (not in 3D here: the pocket is beside the tube)
    const q2 = app.toS({ x: 550, y: 200 }); app.ev("glueFillClick")(q2.x, q2.y, false); out.alone = [S.glues.length, said()];
    app.ev("glueFillClick")(q.x, q.y, true); out.sub = [S.glues.length, steps().slice(-1)[0]];
    app.undo(); out.back = S.glues.length;
    out.menu = app.ev("menuMaterials")().filter(Boolean).find(x => x.n === "Gluing");
    out.menu = out.menu ? out.menu.menu().filter(Boolean).map(x => x.n) : null;
    return out;` }).result;
  assert.deepStrictEqual(o.tool, ["glue_fill", "glue_fill"], "a tool of both windows");
  assert.deepStrictEqual(o.glue, [1, "area", true, true, "[1,0,0,0,1,0]", true, ["Glue Fill"]]);
  assert.strictEqual(o.alone[0], 1); assert.ok(/Nothing lies under Back/.test(o.alone[1]), o.alone[1]);
  assert.deepStrictEqual(o.sub, [0, "Glue Fill (Subtract)"]);
  assert.strictEqual(o.back, 1);
  assert.ok(o.menu && o.menu[0] === "Glue Fill", JSON.stringify(o.menu));
});

test("77, 81: Show Light (3D) and Show Light (Render) draw the lights as named marks (left out of a render); Show 3D Shadow is a switch, off by default; Grid Properties sets the floor grid's spacing, its major lines and size", () => {
  const o = boot({ blank: true, three: true, script: DOC + `
    const env = app.ev("env3Frame"), g = () => v3.group("lights3");
    env(); out.none = g().children.length;
    app.ev("setShow3")("lights3", true); env(); out.own = g().children.filter(c => c.isSprite).length;
    app.ev("lightAdd")("spot"); app.ev("lightAdd")("dome");
    app.ev("setShow3")("lights3", false); app.ev("setShow3")("lightsR", true); env(); out.doc = g().children.filter(c => c.isSprite).length;
    app.ev("setShow3")("lightsR", false); env(); out.off = g().children.length;
    out.hide = app.ev("RENDER_HIDE").includes("lights3");
    out.shadow = [app.ev("show3On")("shadow3")]; app.ev("setShow3")("shadow3", true); env(); out.shadow.push(app.ev("show3On")("shadow3"));
    const env3 = app.ev("menuDisplay")().filter(Boolean).find(x => x.n === "Environment").menu().filter(Boolean);
    out.rows = env3.filter(x => /Shadow|Light|Camera/.test(x.n)).map(x => [x.n, !!x.off]);
    // the grid: a line every 50 mm, heavier every 500, 3 m square
    const sc = v3.scene(), fine0 = sc.getObjectByName("grid:fine").geometry.attributes.position.count;
    S.ui.grid3s = { step: 50, major: 500, size: 3000 }; app.ev("gridFade")();
    out.grid = [fine0, sc.getObjectByName("grid:fine").geometry.attributes.position.count, sc.getObjectByName("grid:metre").geometry.attributes.position.count];
    out.norm = [app.ev("normGrid3")({ step: 100, major: 1000, size: 4000 }), JSON.stringify(app.ev("normGrid3")({ step: 1, major: 1e9, size: 1e9 }))];
    S.ui.grid3s = undefined; app.ev("gridFade")(); out.back = sc.getObjectByName("grid:fine").geometry.attributes.position.count;
    return out;` }).result;
  assert.strictEqual(o.none, 0, "nothing while off");
  assert.strictEqual(o.own, 2, "the window's two lights, named");
  assert.strictEqual(o.doc, 2, "the document's two render lights, named");
  assert.strictEqual(o.off, 0);
  assert.ok(o.hide, "a render leaves the marks out");
  assert.deepStrictEqual(o.shadow, [false, true]);
  assert.deepStrictEqual(o.rows, [["Show 3D Shadow", false], ["Show Light (3D)", false], ["Show Light (Render)", false], ["Show Camera (not built yet)", true]], "Show Camera stays not built (Camera Properties is LATER): " + JSON.stringify(o.rows));
  // GridHelper(size, divisions): (divisions + 1) × 2 lines, 2 points each
  assert.deepStrictEqual(o.grid, [(40 + 1)*4, (60 + 1)*4, (6 + 1)*4]);
  assert.strictEqual(o.norm[0], null, "the default is not kept"); assert.strictEqual(o.norm[1], JSON.stringify({ step: 5, major: 20000, size: 20000 }));
  assert.strictEqual(o.back, (40 + 1)*4);
});

test("84: a pattern's own Rendering Thickness and Extrusion Direction (Both, Front, Back) for the Thick styles, kept only when set; its direction goes before Thick Textured Surface (Back)'s", () => {
  const o = boot({ blank: true, three: true, script: DOC + `
    const faces = app.ev("thickFaces"), np = app.ev("normProps");
    out.def = faces(A);
    A.thick3 = { t: 4, dir: "front" }; np(A); out.front = [faces(A), JSON.stringify(A.thick3)];
    A.thick3 = { t: 1.5, dir: "both" }; np(A); out.cleared = A.thick3 === undefined;
    A.thick3 = { dir: "back" }; np(A); out.back = faces(A);
    A.thick3 = { t: 999 }; np(A); out.clamp = A.thick3.t;
    // drawn: the Thick Textured Surface style, the front 3 mm in front of its cloth and nothing behind
    A.thick3 = { t: 3, dir: "front" }; app.commit();
    app.ev("setRender3")("thick"); const it = G3.items.get(A.id); app.ev("extras3")(it);
    const Pt = it.thick.geometry.attributes.position.array, N = it.obj.geometry.attributes.normal.array, n = it.X.length/3;
    out.drawn = [Math.hypot(Pt[0] - it.X[0], Pt[1] - it.X[1], Pt[2] - it.X[2]), Math.hypot(Pt[3*n] - it.X[0], Pt[3*n+1] - it.X[1], Pt[3*n+2] - it.X[2]), +(((Pt[0] - it.X[0])*N[0] + (Pt[1] - it.X[1])*N[1] + (Pt[2] - it.X[2])*N[2])).toFixed(3)];
    app.ev("setRender3")("thickBack"); out.styleBack = [faces(A), faces(B)];
    // the Property Editor's rows
    S.sel = [A.id]; app.ev("ui")(); out.rows = [!!app.el("pp-thick3"), !!app.el("pp-extr")];
    return out;` }).result;
  assert.deepStrictEqual(o.def, [0.75, -0.75], "1.5 mm, half to each side, as before");
  assert.deepStrictEqual(o.front, [[4, 0], JSON.stringify({ t: 4, dir: "front" })]);
  assert.ok(o.cleared, "the defaults are not kept");
  assert.deepStrictEqual(o.back, [0, -1.5]);
  assert.strictEqual(o.clamp, 50);
  near(o.drawn[0], 3, 1e-3, "the front face"); near(o.drawn[1], 0, 1e-3, "the back face on the cloth"); near(o.drawn[2], 3, 1e-3, "along the normal");
  assert.deepStrictEqual(o.styleBack, [[3, 0], [0, -1.5]], "the pattern's own direction first, the style's for the rest");
  assert.deepStrictEqual(o.rows, [true, true]);
});

test("72: Volume Measure makes a measurement mesh as the garment is (it keeps its shape afterwards), named; Target Volume and Tolerance (L or %) say on target, over or under; Mesh Scale changes it by its cube; Edit Volume Measure: Reset, Delete", () => {
  const o = boot({ blank: true, three: true, script: DOC + `
    app.ev("addGarMeas")({ kind: "vol", ids: [A.id, B.id] });
    const m = S.garMeas[0], gv = app.ev("garMeasValue"), L = () => gv(m).v/1e6, text = () => app.ev("garText")(m, gv(m));
    out.made = [m.name, !!m.snap, +L().toFixed(2), m.scale];
    // the cloth stretched afterwards: the measurement mesh stays as it was
    const it = G3.items.get(A.id); for (let v = 0; v < it.X.length; v += 3) it.X[v] *= 1.5; app.ev("itemMoved")(it);
    out.kept = +L().toFixed(2);
    app.ev("volSet")(m, { target: 9.6, tol: 0.5, tolUnit: "L" }); out.on = text();
    app.ev("volSet")(m, { scale: 1.1 }); out.scaled = [+L().toFixed(3), text()];
    app.ev("volSet")(m, { tol: 10, tolUnit: "%" }); out.pct = text();
    app.ev("volSet")(m, { scale: 0.9, x: 20 }); out.under = text(); out.at = gv(m).at.map(v => +v.toFixed(1));
    app.ev("volReset")(m); out.reset = [m.scale, JSON.stringify(m.off)];
    app.ev("showMeasures")(); out.mesh = v3.group("measure").children.filter(c => c.userData && c.userData.vol === m).length;
    out.tool = [!!app.TOOL3.edit_volume_measure, app.ev("TOOLS").edit_volume_measure.n];
    app.ev("volDelete")(m); out.gone = S.garMeas.length;
    return out;` }).result;
  // (r10 / 4: the two panels 240 apart enclose 9.6 l with the group's middle)
  assert.strictEqual(o.made[0], "Volume 1"); assert.strictEqual(o.made[1], true); near(o.made[2], 9.6, 0.2); assert.strictEqual(o.made[3], 1);
  assert.strictEqual(o.kept, o.made[2], "the mesh keeps its shape");
  assert.ok(/Volume 1: ◇ 9\.[0-9]+ l \(on target\)/.test(o.on), o.on);
  near(o.scaled[0], o.made[2]*1.331, 0.01, "by the scale's cube"); assert.ok(/l over\)$/.test(o.scaled[1]), o.scaled[1]);
  assert.ok(/\(3\.[0-9]+ l over\)$/.test(o.pct), "12.8 l against 9.6 ± 10 % (0.96 l): over by about 3.2, " + o.pct);
  assert.ok(/l under\)$/.test(o.under), o.under);
  assert.deepStrictEqual(o.reset, [1, "[0,0,0]"]);
  assert.strictEqual(o.mesh, 1);
  assert.deepStrictEqual(o.tool, [true, "Edit Volume Measure (Garment/Bag)"]);
  assert.strictEqual(o.gone, 0);
});

module.exports = T;
