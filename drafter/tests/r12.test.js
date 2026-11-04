// Round r12: the wheel setting and the Zipper's place (1), a notch's own type and angle (2), Clone as Pattern and Convert
// to Hole (3), Cut & Sew (4), Replace / Replaced by (5), the double-pointed dart (6), Pattern Information (7).
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  // long options (files as base64) go through a file: a Windows command line holds at most 32 767 characters
  let arg = JSON.stringify(opt || {});
  if (arg.length > 30000) { const f = path.join(require("os").tmpdir(), "pdraft-boot-r12-" + process.pid + ".json"); fs.writeFileSync(f, arg); arg = "@" + f; }
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), arg], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 120 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// two rectangles, A at x 0…200 and B at x 300…500, both 400 high
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
  const B = app.mkPiece("B", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:400},{x:300,y:400}], true));
  S.pieces.push(A, B); S.sel = []; app.commit(); S.undo.length = 0;
  const at = (x, y) => app.toS({ x, y }), out = {};
  const click = (x, y) => { const s = at(x, y); app.fire("pointermove", s); app.fire("pointerdown", s); app.fire("pointerup", s); };
  const steps = () => app.histSteps().steps.map(s => s.n);
`;
// the same two patterns in the 3D window, the front facing the camera
const SEWN = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1];
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 });
  const pos = app.ev("tackPos");
  const scr = (pid, x, y) => { const P = pos({ piece: pid, x, y }); return v3.project(new THREE.Vector3(P[0], P[1], P[2])); };
  const click3 = (tool, pid, x, y, az) => {
    Object.assign(v3.cam, { az: az || 0 }); app.ev("view3d.scene()").updateMatrixWorld(true);
    const q = scr(pid, x, y), e = { clientX: q.x, clientY: q.y, button: 0, buttons: 1 };
    const T3 = app.TOOL3[tool], took = T3.down(e); T3.up(e); return took;
  };
`;

/* ---------- 1: the wheel (keys.test.js has the rest) and the Zipper's place ---------- */
test("r12 / 1: Zipper is on the 3D toolbar (Trims), no longer on the 2D one, with the key P", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "drafter-tools.js"), "utf8"), w = {};
  new Function("window", src + "\nwindow.R = TOOL_REGISTRY;")(w);
  const R = w.R, g = R.groups.find(x => x.id === "zipper"), t = R.tools.find(x => x.id === "zipper");
  assert.deepStrictEqual([g.win, g.section], ["3D", "Trims"]);
  assert.deepStrictEqual([t.win, t.key, t.status], ["3D", "P", "built"]);
  assert.ok(!R.groups.some(x => x.win === "2D" && R.tools.some(y => y.group === x.id && y.id === "zipper")), "not on the 2D toolbar");
});

test("r12 / 1: with the 3D window hidden, Zipper is picked by its key and by Materials/UV > Zipper > Zipper, the 3D window stays hidden, and a zipper is made in the 2D window as before", () => {
  const o = boot({ script: DOC + `
    app.setLayout("2d");
    app.key("P"); out.key = [S.tool, S.tool3, S.ui.layout];
    app.setTool("edit_pattern");
    const zrow = app.ev("menuMaterials")().find(r => r.n === "Zipper"), row = zrow.menu().find(r => r.n === "Zipper");
    out.row = [row.k, S.tool]; row.f(); out.menu = [S.tool, S.tool3, S.ui.layout];
    out.rowOn = zrow.menu().find(r => r.n === "Zipper").on;
    click(200, 50); click(200, 350); click(200, 350); click(300, 50); click(300, 350); click(300, 350);
    const z = S.seams[0], i = app.seamInfo(z, S.pieces);
    out.zip = [S.seams.length, !!z.zip, Math.round(i.la), Math.round(i.lb)]; out.steps = steps();
    out.layoutAfter = S.ui.layout;
    return out;` }).result;
  assert.deepStrictEqual(o.key, ["zipper", "zipper", "2d"], "the key puts it in hand in both windows; the 3D window stays hidden");
  assert.deepStrictEqual(o.row, ["P", "edit_pattern"], "the row names the key");
  assert.deepStrictEqual(o.menu, ["zipper", "zipper", "2d"], "the menu row too");
  assert.strictEqual(o.rowOn, true, "the row shows it is in hand");
  assert.deepStrictEqual(o.zip, [1, true, 300, 300]); assert.deepStrictEqual(o.steps, ["Zipper"]);
  assert.strictEqual(o.layoutAfter, "2d");
});

test("r12 / 1: Zipper from the 3D toolbar is in hand in both windows; clicks on the garment make the zipper the 2D clicks make, and the 2D window still takes clicks with it", () => {
  const body = (in3) => SEWN + `
    app.setTool3("zipper"); out.inHand = [S.tool3, S.tool, S.ui.layout];
    if (${in3}) {
      // the front's right side from 60 to 340 down, a double-click there; the back's left side seen from behind
      out.took = [click3("zipper", A.id, 297, 60), click3("zipper", A.id, 297, 340), click3("zipper", A.id, 297, 340),
        click3("zipper", B.id, 403, 60, Math.PI), click3("zipper", B.id, 403, 340, Math.PI), click3("zipper", B.id, 403, 340, Math.PI)];
    } else {
      const c2 = (x, y) => { const q = app.toS({ x, y }); app.click(q.x, q.y); };
      c2(299, 60); c2(299, 340); c2(299, 340); c2(401, 60); c2(401, 340); c2(401, 340);
    }
    const z = S.seams[0];
    out.zip = z ? [S.seams.length, !!z.zip, z.a.map(p => p.piece === A.id), z.b.map(p => p.piece === B.id)] : null;
    out.len = z ? (() => { const i = app.seamInfo(z, S.pieces); return [Math.round(i.la/10), Math.round(i.lb/10)]; })() : null;
    out.steps = app.histSteps().steps.map(s => s.n);
    return out;`;
  const o3 = boot({ blank: true, three: true, script: body(true) }).result, o2 = boot({ blank: true, three: true, script: body(false) }).result;
  assert.deepStrictEqual(o3.inHand, ["zipper", "zipper", "both"]);
  assert.ok(o3.took.every(Boolean), "every click on the cloth was taken: " + o3.took);
  assert.deepStrictEqual(o3.zip, [1, true, [true], [true]]); assert.deepStrictEqual(o2.zip, o3.zip, "the same zipper as the 2D clicks make");
  assert.deepStrictEqual(o3.len, [28, 28]); assert.deepStrictEqual(o3.len, o2.len);
  assert.deepStrictEqual(o3.steps, ["Zipper"]); assert.deepStrictEqual(o2.steps, ["Zipper"]);
});

/* ---------- 2: a notch's own type and angle ---------- */
test("r12 / 2: a notch's look: a number while it is the document's, { t, type, angle } with its own; junk is dropped; a place moves through nAt() with its look, nRev() turns its lean round", () => {
  const o = boot({ blank: true, script: `
    const nT = app.ev("nT"), nAt = app.ev("nAt"), nRev = app.ev("nRev"), norm = app.ev("normNotchAt");
    return {
      t: [nT(0.25), nT({ t: 0.5, type: "V" })], at: [nAt(0.25, 0.4), nAt({ t: 0.5, type: "V", angle: 10 }, 0.7)],
      rev: [nRev(0.25), nRev({ t: 0.25, type: "L", angle: 10 }), nRev({ t: 0.25, type: "U" })],
      norm: [norm(0.5), norm(1.5), norm(NaN), norm({ t: 0.3 }), norm({ t: 0.3, type: "Box", angle: 95 }), norm({ t: 0.3, type: "Z", angle: "x" }), norm({ t: "a" }), norm(null), norm({ t: 0.3, angle: -20 })],
      types: app.ev("NOTCH_TYPES").map(x => x[0]) };` }).result;
  assert.deepStrictEqual(o.t, [0.25, 0.5]);
  assert.deepStrictEqual(o.at, [0.4, { t: 0.7, type: "V", angle: 10 }]);
  assert.deepStrictEqual(o.rev, [0.75, { t: 0.75, type: "L", angle: -10 }, { t: 0.75, type: "U" }]);
  assert.deepStrictEqual(o.norm, [0.5, 1, null, 0.3, { t: 0.3, type: "Box", angle: 80 }, 0.3, null, null, { t: 0.3, angle: -20 }]);
  assert.deepStrictEqual(o.types, ["I", "T", "V", "L", "U", "Box"], "the six types of the reference");
});

test("r12 / 2: the Notch tool selects a notch; the Property Editor gives it its own type and angle (each one undo step), drawn so; Add Point keeps it; Delete removes it; saved as version 15 and opened again the same", () => {
  const o = boot({ script: DOC + `
    return (async () => {
      app.setTool("notch"); click(100, 0);
      const P = () => S.pieces[0], seg0 = () => P().segs[0].notches;
      out.added = [seg0().slice(), S.selNotch && S.selNotch.k, steps()];
      app.ev("ui")(); out.pe = /Selected Notch/.test(app.el("props").innerHTML) && /As the document \\(I\\)/.test(app.el("props").innerHTML);
      // its own type, then its own angle
      app.ev("setNotchLook")({ type: "V" }); out.typed = JSON.parse(JSON.stringify(seg0()));
      app.ev("setNotchLook")({ angle: 20 }); out.angled = JSON.parse(JSON.stringify(seg0()));
      out.steps = steps();
      // drawn: a V whose middle leans 20 degrees towards the line's end (the line runs left to right along the top)
      const mk = app.ev("notchMarks")(A, { ...S.notch, dup: false }), v = mk[0], len = S.notch.len;
      out.drawn = [mk.length, v.length, +(v[1].x - 100).toFixed(3), +(v[1].y).toFixed(3), +(len*Math.sin(20*Math.PI/180)).toFixed(3), +(len*Math.cos(20*Math.PI/180)).toFixed(3)];
      // every type has a shape
      out.shapes = ["I", "T", "V", "L", "U", "Box"].map(ty => { A.segs[0].notches[0] = { t: 0.5, type: ty }; return app.ev("notchMarks")(A, { ...S.notch, dup: false }).map(l => l.length).join("+"); });
      A.segs[0].notches[0] = { t: 0.5, type: "V", angle: 20 };
      // back to the document's: a plain number again
      app.ev("setNotchLook")({ type: null, angle: 0 }); out.plain = seg0().slice(); app.undo();
      // Add Point before it: the notch keeps its look, at its place
      app.push("Add Point"); app.addPoint(P(), 0, 0.25); app.commit();
      out.split = [JSON.parse(JSON.stringify(P().segs[0].notches)), JSON.parse(JSON.stringify(P().segs[1].notches))];
      out.at = (() => { const n = P().segs[1].notches[0]; const q = app.segPt(P(), 1, n.t); return [+q.x.toFixed(6), +q.y.toFixed(6)]; })();
      // saved and opened again
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      const fd = app.fileDoc(file); out.inFile = [fd.v, fd.pieces[0].segs[1].notches];
      app.ev("openFile")("n.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened n/.test(x)), "the file to open");
      out.opened = JSON.parse(JSON.stringify(S.pieces[0].segs[1].notches));
      app.checkDoc(S.pieces, S.seams);
      // Delete with the Notch tool in hand removes the selected notch
      app.setTool("notch"); click(100, 0); out.sel = !!S.selNotch; app.key("Delete"); out.deleted = [S.pieces[0].segs[1].notches.length, steps().slice(-1)[0]];
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.added, [[0.5], 0, ["Notch"]], "a click adds a notch and selects it");
  assert.strictEqual(o.pe, true, "the Property Editor shows the selected notch");
  assert.deepStrictEqual(o.typed, [{ t: 0.5, type: "V" }]); assert.deepStrictEqual(o.angled, [{ t: 0.5, type: "V", angle: 20 }]);
  assert.deepStrictEqual(o.steps, ["Notch", "Notch", "Notch"]);
  assert.strictEqual(o.drawn[0], 1); assert.strictEqual(o.drawn[1], 3, "a V: three points");
  near(o.drawn[2], o.drawn[4], 1e-3, "the tip leans towards the line's end by len·sin 20°"); near(o.drawn[3], o.drawn[5], 1e-3, "and goes in by len·cos 20°");
  assert.deepStrictEqual(o.shapes, ["2", "2+2", "3", "2+2", "11", "4"], "I, T, V, L, U and Box each drawn their own way");
  assert.deepStrictEqual(o.plain, [0.5]);
  assert.deepStrictEqual(o.split[0], []); assert.strictEqual(o.split[1].length, 1); assert.deepStrictEqual([o.split[1][0].type, o.split[1][0].angle], ["V", 20]);
  near(o.at[0], 100, 1e-6); near(o.at[1], 0, 1e-6);
  assert.strictEqual(o.inFile[0], 28);      /* (version 28 since Round r30 (a seam's mirror); 28 since Round r30, 27 since Round r29 (a document's render settings); 26 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1;) */ assert.deepStrictEqual([o.inFile[1][0].type, o.inFile[1][0].angle], ["V", 20]);      // (version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
  assert.deepStrictEqual(o.opened, o.inFile[1]);
  assert.strictEqual(o.sel, true); assert.deepStrictEqual(o.deleted, [0, "Delete Notch"]);
});

test("r12 / 2: old files open: a version 14 document's plain notches stay numbers, and a version 12 file opens and saves as version 15", () => {
  const v12 = fs.readFileSync(path.join(__dirname, "files", "v12", "skirt-on-the-marty-of-8-oct.pdraft")).toString("base64");
  const o = boot({ blank: true, streams: true, script: `
    return (async () => {
      const out = {};
      const p = app.mkPiece("Old", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:100},{x:0,y:100}], true));
      p.segs[0].notches = [0.25, 0.75]; p.segs[2].notches = [0.5];
      const doc = JSON.parse(app.docJSON()); doc.v = 14; doc.pieces = [JSON.parse(JSON.stringify(p))];
      app.openText("old.pdraft", JSON.stringify(doc), null, true); out.v14 = S.pieces[0].segs.map(s => s.notches);
      app.checkDoc(S.pieces, S.seams);
      const n0 = toasts.length; app.ev("openFile")("s.pdraft", app.ev("bytesOf")(${JSON.stringify(v12)}), null, true); await app.wait(() => toasts.slice(n0).some(x => /^Opened s/.test(x)), "the file");
      out.v12 = [S.pieces.length, S.pieces.every(q => q.segs.every(s => s.notches.every(n => typeof n === "number")))];
      out.saved = JSON.parse(app.docJSON()).v;
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.v14, [[0.25, 0.75], [], [0.5], []]);
  assert.deepStrictEqual(o.v12, [4, true]); assert.strictEqual(o.saved, 28);      // (version 28 since Round r30 (a seam's mirror); 28 since Round r30, 27 since Round r29 (a document's render settings); 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
});

/* ---------- 3: Clone as Pattern, Convert to Hole ---------- */
test("r12 / 3: the mesher cuts holes: no triangle in a hole, the hole's edge is mesh points, the area is the outline's less the hole's; without holes nothing changes", () => {
  const C = require("../drafter-sim.js"), res = 10;
  const ring = (x0, y0, x1, y1) => { const L = [], side = (ax, ay, bx, by) => { const k = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)/res)); for (let j = 0; j < k; j++) L.push([ax + (bx - ax)*j/k, ay + (by - ay)*j/k]); }; side(x0, y0, x1, y0); side(x1, y0, x1, y1); side(x1, y1, x0, y1); side(x0, y1, x0, y0); return L; };
  const out = ring(0, 0, 200, 200), hole = ring(70, 70, 130, 130);
  const a = C.meshPolygon(out, res), b = C.meshPolygon(out, res, []), m = C.meshPolygon(out, res, [hole]);
  assert.deepStrictEqual(Array.from(b.tri), Array.from(a.tri), "no holes: the same mesh"); assert.deepStrictEqual(a.holes, []);
  near(C.triArea2D(m.xy, m.tri), 200*200 - 60*60, 1, "the cloth's area");
  for (let t = 0; t < m.tri.length; t += 3) {
    const gx = (m.xy[2*m.tri[t]] + m.xy[2*m.tri[t+1]] + m.xy[2*m.tri[t+2]])/3, gy = (m.xy[2*m.tri[t]+1] + m.xy[2*m.tri[t+1]+1] + m.xy[2*m.tri[t+2]+1])/3;
    assert.ok(!(gx > 70 && gx < 130 && gy > 70 && gy < 130), "a triangle in the hole at " + gx + "," + gy);
  }
  assert.strictEqual(m.holes.length, 1); assert.strictEqual(m.holes[0].length, hole.length);
  m.holes[0].forEach((v, j) => { assert.strictEqual(m.xy[2*v], hole[j][0]); assert.strictEqual(m.xy[2*v+1], hole[j][1]); });
  assert.ok(C.triQuality(m.xy, m.tri).min > 0.3, "no slivers round the hole");
});

const INNER = `
  const r = app.mkShape([{x:50,y:100},{x:150,y:100},{x:150,y:200},{x:50,y:200}], true);
  app.addChild(A, "internals", r); app.commit(); S.undo.length = 0;
  const rows = (x, y) => { app.menu.children.length = 0; app.showMenu({ clientX: at(x, y).x, clientY: at(x, y).y }); return app.menu.children.filter(c => typeof c.onclick === "function").map(c => c.innerHTML.replace(/<[^>]*>/g, " ").split(" ").filter(Boolean).join(" ")); };
  // (Round r15 / 10: an internal line's menu is the reference's now, and this program's own rows are under More ▸)
  const moreRows = (x, y) => { app.menu.children.length = 0; app.showMenu({ clientX: at(x, y).x, clientY: at(x, y).y }); const m = app.menu.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes("<span>More</span>"));
    if (!m) return []; m.onclick({ stopPropagation() {} }); const subs = app.ev("menuSubs"), sub = subs[subs.length - 1];
    return sub.children.filter(c => typeof c.onclick === "function").map(c => c.innerHTML.replace(/<[^>]*>/g, " ").split(" ").filter(Boolean).join(" ")); };
`;
test("r12 / 3: Clone as Pattern: on a closed internal shape's menu (and Ctrl+Shift+C with it selected); the new pattern hangs on the pointer and a click sets it down; the internal shape stays; Esc gives it up", () => {
  const o = boot({ script: DOC + INNER + `
    app.setTool("edit_pattern");
    out.rows = moreRows(100, 100).filter(t => /Clone as Pattern|Convert to Hole|Trace as Pattern/.test(t));
    app.menuClick(at(100, 100).x, at(100, 100).y, "More ▸ Clone as Pattern", "edit_pattern");
    out.hanging = [!!S.place, S.pieces.length];
    click(700, 150); out.made = [S.pieces.length, S.pieces[2].name, A.internals.length, steps()];
    const q = S.pieces[2], b = app.bboxOf([q]); out.box = [b.x1 - b.x0, b.y1 - b.y0, (b.x0 + b.x1)/2, (b.y0 + b.y1)/2];
    out.closed = [q.pts.length, q.segs.every(s => s.id > 0), new Set(q.segs.map(s => s.id)).size === 4];
    // with the shape selected, the key; Esc gives it up and nothing changed
    S.sel = [A.id]; S.selKind = "internal"; S.selInt = 0;
    app.key("C", { ctrlKey: true, shiftKey: true }); out.keyed = !!S.place;
    app.key("Escape"); out.esc = [!!S.place, S.pieces.length, steps().length];
    // an open internal line has no such rows
    const ln = app.mkShape([{x:20,y:300},{x:180,y:300}], false); app.addChild(A, "internals", ln); app.commit();
    out.open = moreRows(100, 300).filter(t => /Clone as Pattern|Convert to Hole/.test(t));
    app.checkDoc(S.pieces, S.seams);
    return out;` }).result;
  assert.deepStrictEqual(o.rows.map(t => t.replace(/ (Ctrl[+]Shift[+]C|I)$/, "")), ["Clone as Pattern", "Convert to Hole", "Trace as Pattern"]);
  assert.ok(o.rows[0].includes("Ctrl+Shift+C"), "the row shows its key: " + o.rows[0]);
  assert.deepStrictEqual(o.hanging, [true, 2], "on the pointer; nothing made yet");
  assert.deepStrictEqual(o.made, [3, "A 1", 1, ["Clone as Pattern"]], "made where clicked; the internal shape stays");
  assert.deepStrictEqual(o.box.map(x => Math.round(x)), [100, 100, 700, 150]);
  assert.deepStrictEqual(o.closed, [4, true, true]);
  assert.strictEqual(o.keyed, true); assert.deepStrictEqual(o.esc, [false, 3, 1]);
  assert.deepStrictEqual(o.open, []);
});

test("r12 / 3: Convert to Hole: the internal shape becomes a hole (one undo step): not filled, a cut line in print, no cloth there in 3D; saved and opened again; Convert to Internal Shape turns it back", () => {
  const o = boot({ three: true, script: DOC + INNER + `
    return (async () => {
      app.setTool("edit_pattern");
      app.menuClick(at(100, 100).x, at(100, 100).y, "More ▸ Convert to Hole", "edit_pattern");
      out.hole = [A.internals[0].hole, steps()];
      out.rows = moreRows(100, 100).filter(t => /Convert to (Hole|Internal)/.test(t));
      // 3D: A's cloth has a hole where the shape is
      S.cloth = app.normCloth({ ...S.cloth, res: 20 }); app.commit();
      const m = app.pieceMesh3(A, 20); let inHole = 0, area = 0;
      for (let t = 0; t < m.tri.length; t += 3) {
        const P = [0, 1, 2].map(k => [m.xy[2*m.tri[t+k]], m.xy[2*m.tri[t+k]+1]]), gx = (P[0][0] + P[1][0] + P[2][0])/3, gy = (P[0][1] + P[1][1] + P[2][1])/3;
        if (gx > 50 && gx < 150 && gy > 100 && gy < 200) inHole++;
        area += Math.abs((P[1][0] - P[0][0])*(P[2][1] - P[0][1]) - (P[2][0] - P[0][0])*(P[1][1] - P[0][1]))/2;
      }
      out.mesh = [inHole, Math.round(area)];
      // saved and opened again
      const doc = JSON.parse(app.docJSON()); out.inFile = doc.pieces[0].internals.map(it => !!it.hole);
      app.openText("h.pdraft", JSON.stringify(doc), null, true); out.reopened = S.pieces[0].internals.map(it => !!it.hole);
      // undo, then back to an internal shape from the menu
      const P0 = S.pieces[0];
      app.menuClick(at(100, 100).x, at(100, 100).y, "More ▸ Convert to Internal Shape", "edit_pattern");
      out.back = [S.pieces[0].internals[0].hole === undefined, steps().slice(-1)[0]];
      app.undo(); out.undone = S.pieces[0].internals[0].hole;
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.hole, [true, ["Convert to Hole"]]);
  assert.deepStrictEqual(o.rows, ["Convert to Internal Shape"], "a hole's menu turns it back");
  assert.strictEqual(o.mesh[0], 0, "no cloth in the hole"); near(o.mesh[1], 200*400 - 100*100, 50, "the cloth's area");
  assert.deepStrictEqual(o.inFile, [true]); assert.deepStrictEqual(o.reopened, [true]);
  assert.deepStrictEqual(o.back, [true, "Convert to Internal Shape"]); assert.strictEqual(o.undone, true);
});

/* ---------- 4: Cut & Sew ---------- */
test("r12 / 4: Cut & Sew along an internal line: two patterns, the new edges sewn to each other end to end; every other edge keeps its id and its seams (a seam across a cut end becomes two parts); things inside go with their half; one undo step; Cut alone sews nothing", () => {
  const body = (sew) => DOC + `
    // A: 0..200 x 0..400; a line across it at y 150 (short of the edges: it is extended); A's right side sewn to B's left
    const ln = app.mkShape([{x:10,y:150},{x:190,y:150}], false); app.addChild(A, "internals", ln);
    const part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
    S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] });
    A.grain = { a: {x:100,y:250}, b: {x:100,y:350} };
    A.punches.push({ x: 100, y: 50, d: 10, name: "top" }, { x: 100, y: 300, d: 10, name: "low" });
    const top = app.mkShape([{x:50,y:40},{x:150,y:40},{x:150,y:80},{x:50,y:80}], true); app.addChild(A, "internals", top);
    app.commit(); S.undo.length = 0;
    const ids0 = A.segs.map(s => s.id);
    app.setTool("edit_pattern");
    app.menuClick(at(100, 150).x, at(100, 150).y, ${JSON.stringify(sew ? "Cut & Sew" : "Cut")}, "edit_pattern");
    const K = S.pieces.find(p => p.id === A.id), N = S.pieces.find(p => p.id !== A.id && p.id !== B.id);
    const box = (p) => { const b = app.bboxOf([p]); return [b.x0, b.y0, b.x1, b.y1].map(Math.round); };
    out.pieces = S.pieces.map(p => p.name); out.boxes = [box(K), box(N)];
    out.kept = ids0.filter(id => K.segs.some(s => s.id === id) || N.segs.some(s => s.id === id)).length;
    out.punches = [K.punches.map(x => x.name), N.punches.map(x => x.name)]; out.inner = [K.internals.length, N.internals.length];
    out.grain = [!!K.grain, !!N.grain];
    const s1 = S.seams.find(sm => sm.id === 1); out.side = s1.a.map(x => [x.piece === K.id ? "K" : "N", x.sids.length]);
    out.info1 = (() => { const i = app.seamInfo(s1, S.pieces); return [Math.round(i.la), Math.round(i.lb)]; })();
    const ns = S.seams.filter(sm => sm.id !== 1);
    out.newSeam = ns.map(sm => { const i = app.seamInfo(sm, S.pieces); return [Math.round(i.la), Math.round(i.lb), sm.a[0].piece !== sm.b[0].piece]; });
    // the new seam's two starts meet: the same 2D place on both halves
    out.meet = ns.map(sm => { const ends = (pt) => { const p = S.pieces.find(q => q.id === pt.piece), i = p.segs.findIndex(s => s.id === pt.sids[0]), j = p.segs.findIndex(s => s.id === pt.sids[pt.sids.length-1]); const a = app.segPt(p, i, 0), b = app.segPt(p, j, 1); return pt.rev ? b : a; }; const a = ends(sm.a[0]), b = ends(sm.b[0]); return Math.round(Math.hypot(a.x - b.x, a.y - b.y)); });
    out.steps = steps();
    app.checkDoc(S.pieces, S.seams);
    app.undo(); out.undone = [S.pieces.length, S.seams.length, S.pieces[0].internals.length];
    return out;`;
  const o = boot({ script: body(true) }).result, c = boot({ script: body(false) }).result;
  // (Round r16: neither half keeps the name, the upper is "A 1", the lower "A 2" (r12/9a); the grainline's half, the lower,
  // still keeps the pattern's id. It was "A" for the kept half and "A 2" for the other.)
  assert.deepStrictEqual(o.pieces, ["A 2", "A 1", "B"]);
  assert.deepStrictEqual(o.boxes, [[0, 150, 200, 400], [0, 0, 200, 150]], "the grainline's half keeps the pattern");
  assert.strictEqual(o.kept, 4, "every outline segment kept its id");
  assert.deepStrictEqual(o.punches, [["low"], ["top"]]); assert.deepStrictEqual(o.inner, [0, 1], "the line is used up; the shape at the top went with its half");
  assert.deepStrictEqual(o.grain, [true, true]);
  assert.deepStrictEqual(o.side.map(x => x[0]).sort(), ["K", "N"], "the seam across the cut end is two parts, one on each half");
  assert.deepStrictEqual(o.info1, [400, 400], "and still as long");
  assert.deepStrictEqual(o.newSeam, [[200, 200, true]], "the two cut edges sewn to each other"); assert.deepStrictEqual(o.meet, [0], "start to start at the same place");
  assert.deepStrictEqual(o.steps, ["Cut & Sew"]); assert.deepStrictEqual(o.undone, [2, 1, 2]);
  assert.deepStrictEqual(c.pieces, ["A 2", "A 1", "B"], "Cut names the halves as Cut & Sew does"); assert.deepStrictEqual(c.newSeam, [], "Cut sews nothing"); assert.deepStrictEqual(c.steps, ["Cut"]);
});

test("r12 / 4: Cut & Sew is refused on a symmetric copy's source, and on a line that does not reach the outline at both ends; nothing changes", () => {
  const o = boot({ script: DOC + `
    const ln = app.mkShape([{x:10,y:150},{x:190,y:150}], false); app.addChild(A, "internals", ln); app.commit();
    const q = app.ev("mkLinked")(A, "instance", [1, 0, 0, 1, 600, 0]); S.pieces.push(q); app.commit(); S.undo.length = 0;
    app.setTool("edit_pattern");
    app.menuClick(at(100, 150).x, at(100, 150).y, "Cut & Sew", "edit_pattern");
    out.linked = [S.pieces.length, steps().length, toasts[toasts.length - 1]];
    return out;` }).result;
  assert.deepStrictEqual(o.linked.slice(0, 2), [3, 0]); assert.ok(/unlink/.test(o.linked[2]), o.linked[2]);
});

/* ---------- 5: Replace / Replaced by ---------- */
const PENT = `
  const part = (p, i, rev, t1) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: t1 || 1, rev: !!rev });
  // the new shape: a pentagon off to the right, 200 wide and 430 high, with a point on its top
  const C = app.mkPiece("New", app.mkShape([{x:600,y:0},{x:700,y:-30},{x:800,y:0},{x:800,y:400},{x:600,y:400}], true));
  C.segs[0].notches = [0.5]; app.addChild(C, "bases", app.mkShape([{x:620,y:200},{x:780,y:200}], false));
  S.pieces.push(C);
  app.addChild(A, "internals", app.mkShape([{x:50,y:100},{x:150,y:100},{x:150,y:200},{x:50,y:200}], true));
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 0)], b: [part(B, 0, true)] }, { id: 3, a: [part(A, 0, false, 0.5)], b: [part(B, 2)] });
  app.commit(); S.undo.length = 0;
  const ids0 = A.segs.map(s => s.id);
`;
test("r12 / 5: Replace (More, by the copied pattern): the same number of points: the outline, notches, baselines and name are the copied one's, placed where the original was; its segment ids, sewing and internal shapes stay; a different number is refused", () => {
  const o = boot({ script: DOC + PENT + `
    const Q = app.mkPiece("Quad", app.mkShape([{x:600,y:0},{x:820,y:0},{x:800,y:420},{x:620,y:400}], true)); Q.segs[2].notches = [0.25]; S.pieces.push(Q); app.commit(); S.undo.length = 0;
    S.sel = [Q.id]; app.key("C", { ctrlKey: true });
    S.sel = [A.id]; app.setTool("transform_pattern");
    app.menuClick(at(100, 300).x, at(100, 300).y, "More ▸ Replace (by the Copied Pattern)", "transform_pattern");
    const P = S.pieces.find(p => p.id === A.id), b = app.bboxOf([P]);
    out.r = [P.name, P.segs.map(s => s.id).join() === ids0.join(), P.segs[2].notches, P.internals.length, S.seams.length, [b.x0, b.y0, b.x1, b.y1].map(Math.round), steps()];
    // a pattern of another number of points: refused, nothing changes
    S.sel = [C.id]; app.key("C", { ctrlKey: true }); S.sel = [A.id];
    app.menuClick(at(100, 300).x, at(100, 300).y, "More ▸ Replace (by the Copied Pattern)", "transform_pattern");
    out.refused = [steps().length, toasts[toasts.length - 1]];
    app.checkDoc(S.pieces, S.seams);
    return out;` }).result;
  assert.deepStrictEqual(o.r.slice(0, 5), ["Quad", true, [0.25], 1, 3]);
  assert.deepStrictEqual(o.r[5], [-10, -10, 210, 410], "the copied shape, its box's middle where the original's was");
  assert.deepStrictEqual(o.r[6], ["Replace"]);
  assert.strictEqual(o.refused[0], 1); assert.ok(/same number of segment points/.test(o.refused[1]), o.refused[1]);
});

test("r12 / 5: Replaced by with a different number of points: click the new pattern, then pairs of points (Delete takes the last click back); it finishes when every point of the smaller one is matched; a run that gained a segment keeps its first id, whole-run sewing covers the new run, sewing on part of it is dropped and named", () => {
  const o = boot({ script: DOC + PENT + `
    app.setTool("transform_pattern"); S.sel = [A.id];
    app.menuClick(at(100, 300).x, at(100, 300).y, "Replaced by", "transform_pattern");
    out.started = !!S.replace;
    click(700, 200); out.src = S.replace && S.replace.src === C.id;
    click(0, 0); app.key("Delete"); out.backed = S.replace.pending;
    click(0, 0); click(600, 0); click(200, 0); click(800, 0); click(200, 400); click(800, 400); click(0, 400); click(600, 400);
    const P = S.pieces.find(p => p.id === A.id), b = app.bboxOf([P]);
    out.done = [S.replace, P.name, P.pts.length, [b.x0, b.y0, b.x1, b.y1].map(Math.round), steps()];
    out.ids = [P.segs.filter(s => ids0.includes(s.id)).length, P.segs.length];
    out.seams = S.seams.map(sm => [sm.id, sm.a[0].sids.length]);
    out.toast = toasts[toasts.length - 1];
    out.kept = [P.internals.length, P.bases.length, P.segs.some(s => s.notches.length)];
    app.checkDoc(S.pieces, S.seams);
    app.undo(); out.undone = [S.pieces.find(p => p.id === A.id).pts.length, S.seams.length];
    // Esc gives it up
    S.sel = [A.id]; app.menuClick(at(100, 300).x, at(100, 300).y, "Replaced by", "transform_pattern"); app.key("Escape"); out.esc = S.replace;
    return out;` }).result;
  assert.deepStrictEqual([o.started, o.src, o.backed], [true, true, null]);
  assert.strictEqual(o.done[0], null); assert.deepStrictEqual(o.done.slice(1, 3), ["New", 5]);
  assert.deepStrictEqual(o.done[3], [0, -15, 200, 415], "the new shape where the original was");
  assert.deepStrictEqual(o.done[4], ["Replaced by"]);
  assert.deepStrictEqual(o.ids, [4, 5], "four ids kept, one new");
  assert.deepStrictEqual(o.seams, [[1, 1], [2, 2]], "the side seam as it was; the whole-top seam on both new top segments; the half-top one dropped");
  assert.ok(/sewing dropped: 3/.test(o.toast), o.toast);
  assert.deepStrictEqual(o.kept, [1, 1, true], "its internal shape stays; the new one's baseline and notch come");
  assert.deepStrictEqual(o.undone, [4, 3]); assert.strictEqual(o.esc, null);
});

/* ---------- 6: the double-pointed dart ---------- */
test("r12 / 6: the Dart tool: a click inside a pattern opens Create Dart (widths left and right, heights up and down, position); the dart is an upright cut-out shape whose right legs are sewn to its left legs from the top point; one undo step; one that does not fit is refused", () => {
  const o = boot({ script: DOC + `
    let asked = null;
    app.answer = (t, f, opts) => { asked = [t, f.map(x => [x.k, x.label, x.val]), null, (f.find(x => x.k === "pos").options || []).map(x => x[0])]; return { wl: 20, wr: 20, up: 130, down: 140, pos: "center" }; };
    app.setTool("dart_double"); click(100, 200);
    out.asked = asked;
    const it = A.internals[0];
    out.shape = it ? [it.pts.map(q => [Math.round(q.x), Math.round(q.y)]), it.hole, it.closed] : null;
    const sm = S.seams[0], i = app.seamInfo(sm, S.pieces);
    out.seam = [S.seams.length, sm.a.map(p => [p.shape === it.id, p.sids.map(id => it.segs.findIndex(s => s.id === id)), p.rev]), sm.b.map(p => [p.sids.map(id => it.segs.findIndex(s => s.id === id)), p.rev]), Math.round(i.la), Math.round(i.lb)];
    out.steps = steps();
    // (Round r15 / 2: Position is now what the distances to the outline are measured from, Outline or Center, as the check
    // videos showed; the click is always the dart's middle. This part used to put the click at the dart's top point with
    // Position Up.) Outline: Left 50 from the dart's left corner to B's left edge, Up 40 from its top point to B's top edge
    app.answer = () => ({ wl: 10, wr: 30, up: 60, down: 80, pos: "outline", l: 50, u: 40 }); click(400, 150);
    out.up = B.internals[0].pts.map(q => [Math.round(q.x), Math.round(q.y)]);
    // too wide for the pattern: refused, nothing made
    app.answer = () => ({ wl: 150, wr: 150, up: 60, down: 60, pos: "center" }); click(100, 380);
    out.refused = [steps().length, /intersecting/.test(toasts[toasts.length - 1])];      // (Round r15 / 2: the reference's words, "Pattern outlines and/or holes are intersecting.")
    app.undo(); app.undo(); out.undone = [S.pieces[0].internals.length, S.seams.length];
    return out;` }).result;
  assert.deepStrictEqual(o.asked[0], "Create Dart");
  // (Round r15 / 2: the four distances to the outline follow Position, which opens at Outline; they were not there before)
  assert.deepStrictEqual(o.asked[1].map(x => x[1]), ["Width (Left)", "Width (Right)", "Height (Up)", "Height (Down)", "Position", "Left", "Right", "Up", "Down"]);
  assert.deepStrictEqual(o.asked[1].map(x => x[2]), [20, 20, 130, 140, "outline", 80, 80, 70, 60], "the distances from the dart's outline at the click (100, 200)");
  assert.deepStrictEqual(o.asked[3], ["outline", "center"], "Position: Outline or Center");
  assert.deepStrictEqual(o.shape, [[[100, 70], [120, 200], [100, 340], [80, 200]], true, true], "top, right, bottom, left; a hole");
  assert.deepStrictEqual(o.seam.slice(0, 3), [1, [[true, [0, 1], false]], [[[2, 3], true]]], "the right legs from the top, sewn to the left legs from the top");
  assert.strictEqual(o.seam[3], o.seam[4], "the two sides the same length");
  assert.deepStrictEqual(o.steps, ["Dart"]);
  assert.deepStrictEqual(o.up, [[360, 40], [390, 100], [360, 180], [350, 100]], "moved by the distances typed (Round r15 / 2)");
  assert.deepStrictEqual(o.refused, [2, true]); assert.deepStrictEqual(o.undone, [0, 0]);
});

test("r12 / 6: the dart in the simulation: its inside is no cloth, its seam is in the solver, and the cloth hanging from its top edge draws the dart shut", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3;
    app.ev("setLayout")("both");
    const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:400}], true)); S.pieces.push(A);
    A.p3 = { pos: [0, 1300, 200], q: [0, 0, 0, 1], r: 0 };
    S.cloth = app.normCloth({ ...S.cloth, res: 15, substeps: 8, self: false, worker: false });
    app.commit();
    app.push("Dart"); app.ev("addDartDouble")(A, { x: 150, y: 200 }, { wl: 25, wr: 25, up: 120, down: 120, pos: "center" }); app.commit();
    app.ev("garmentSync")();
    const it = G3.items.get(A.id), m = it.mesh;
    out.hole = [m.xy.length/2 > 0, (() => { let n = 0; for (let t = 0; t < m.tri.length; t += 3) { const gx = (m.xy[2*m.tri[t]] + m.xy[2*m.tri[t+1]] + m.xy[2*m.tri[t+2]])/3, gy = (m.xy[2*m.tri[t]+1] + m.xy[2*m.tri[t+1]+1] + m.xy[2*m.tri[t+2]+1])/3; if (Math.abs(gx - 150)/25 + Math.abs(gy - 200)/120 < 0.95) n++; } return n; })()];
    out.seams = app.simSeams([A.id]).map(s => [s.id, s.pairs.length > 3]);
    // the corners of the dart's mouth in the cloth
    const near = (x, y) => { let b = -1, bd = 1e9; for (let v = 0; v < m.xy.length/2; v++) { const d = Math.hypot(m.xy[2*v] - x, m.xy[2*v+1] - y); if (d < bd) { bd = d; b = v; } } return b; };
    const L = near(125, 200), R = near(175, 200), X = new Float32Array(m.xy.length*3/2);
    const gap = () => { app.ev("simRead")(0, X); return Math.hypot(X[3*L] - X[3*R], X[3*L+1] - X[3*R+1], X[3*L+2] - X[3*R+2]); };
    A.pins = [{ x: 10, y: 5 }, { x: 150, y: 5 }, { x: 290, y: 5 }]; app.commit(); app.ev("garmentSync")();
    app.simToggle(); out.before = gap(); for (let k = 0; k < 300; k++) app.ev("simFrame")(); out.after = gap(); app.simToggle();
    return out;` }).result;
  assert.strictEqual(o.hole[1], 0, "no cloth inside the dart");
  assert.deepStrictEqual(o.seams, [[1, true]], "the dart's seam goes to the solver");
  assert.ok(o.before > 40, "open at first: " + o.before);
  assert.ok(o.after < 8, "drawn shut: " + o.after);
});

/* ---------- 7: Pattern Information ---------- */
test("r12 / 7: 2D > Pattern Information opens a window with a row a pattern: the reference's columns and the area, perimeter and size; a field changed is one undo step; saved and opened again; junk is dropped", () => {
  const o = boot({ script: DOC + `
    app.addChild(A, "internals", app.mkShape([{x:50,y:100},{x:150,y:100},{x:150,y:200},{x:50,y:200}], true)); A.internals[0].hole = true; app.commit(); S.undo.length = 0;
    const row = app.ev("menu2D")().find(r => r && r.n === "Pattern Information");
    out.row = [!!row, typeof row.f]; row.f();
    const html = () => app.el("pinfo").innerHTML;
    out.open = [app.ev("pinfoOpen")(), ["Item No.", "Image", "Name", "Type", "Fabric", "Grainline", "Shrinkage", "Mirror", "Cut Amount", "Description", "Stage", "Area", "Perimeter", "Size"].every(h => html().includes("<th>" + h))];
    const rows = app.ev("pinfoRows")();
    out.a = (({ name, area, perimeter, w, h, cut, mirror, type }) => [name, Math.round(area), Math.round(perimeter), w, h, cut, mirror, type])(rows[0]);
    const set = app.ev("pinfoSet");
    set(A, "type", "Lining"); set(A, "itemNo", "SK-01"); set(A, "desc", "front skirt"); set(A, "stage", "Editing"); set(A, "cut", "2"); set(A, "mirror", "v");
    out.info = [JSON.parse(JSON.stringify(A.info)), A.quantity, steps()];
    out.html = [html().includes('value="SK-01"'), html().includes("data-pi=" + JSON.stringify("mirror"))];
    // a symmetric copy: Horizontal, fixed
    const q = app.ev("mkLinked")(B, "symmetric", [-1, 0, 0, 1, 1200, 0]); S.pieces.push(q); app.commit();
    out.sym = app.ev("pinfoRows")().filter(r => r.mirrorFixed).map(r => r.mirror);
    // saved and opened again; junk dropped
    const doc = JSON.parse(app.docJSON()); doc.pieces[1].info = { type: "Hat", stage: 7, itemNo: 12, desc: "ok", mirror: "x" };
    app.openText("i.pdraft", JSON.stringify(doc), null, true);
    out.reopened = S.pieces.map(p => p.info || null);
    app.undo(); app.ev("pinfoView")(true); out.closed = false;
    return out;` }).result;
  assert.deepStrictEqual(o.row, [true, "function"], "a working row, no longer greyed");
  assert.deepStrictEqual(o.open, [true, true]);
  assert.deepStrictEqual(o.a, ["A", 70000, 1200, 200, 400, 1, "", ""], "area less the hole, the seam line's length, its box");
  assert.deepStrictEqual(o.info[0], { itemNo: "SK-01", type: "Lining", desc: "front skirt", stage: "Editing", mirror: "v" });
  assert.strictEqual(o.info[1], 2); assert.deepStrictEqual(o.info[2], Array(6).fill("Pattern Information"));
  assert.deepStrictEqual(o.html, [true, true], "the window shows what was set; Mirror once Cut Amount is 2");
  assert.deepStrictEqual(o.sym, ["h", "h"], "a symmetric pair: Horizontal");
  assert.deepStrictEqual(o.reopened[0], { itemNo: "SK-01", type: "Lining", desc: "front skirt", stage: "Editing", mirror: "v" });
  assert.deepStrictEqual(o.reopened[1], { desc: "ok" }, "junk dropped");
  assert.strictEqual(o.closed, false);
});

module.exports = T;
