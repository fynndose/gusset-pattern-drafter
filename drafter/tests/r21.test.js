// Round r21: stabilise. Every kind of document data added in r17b–r20 made by its own command, then: one history step, undo, redo
// and undo again each the exact state before / after, saved as a file and opened again the same document, and its history (in the
// file) undone after opening back to the state before.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });

// (the options through a file: a Windows command line holds at most 32 767 characters, and the test files ride in them)
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-r21-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}

/* The audit, in the page: audit(name, fn, opt) runs fn (the command, as a user would give it) and records what is wrong with it:
   - steps: the history steps it made (one expected; opt.steps for another number);
   - same: it changed nothing in the document;
   - undo / redo / undo 2: the document after each, compared with the state before / after the command (canonJSON of docObj());
   - file: saved (the real container, history included) and opened again: the document is the state after the command;
   - file undo: the history the file brought undone once: the state before the command.
   The document compared is everything a file holds but the 3D window's camera and avatar record and the display settings (per
   machine: not in undo). opt.noFile leaves the file out (for what is not in the file by design). */
const AUDIT = `
  const J = app.ev("canonJSON");
  // (images: the pictures the document or a step of its history shows, not in undo: what each names is checked by pics())
  const docRaw = () => { const d = JSON.parse(JSON.stringify(app.ev("docObj")())); if (d.scene) { delete d.scene.camera; delete d.scene.avatar; } delete d.display; delete d.images; delete d.nextId; delete d.nextSegId; delete d.nextShapeId; return d; };      // (the id counters only go up: an id once given is never given again, undo or not)
  const pics = () => { const d = app.ev("docObj")(), have = new Set(d.images.map(im => im.id)), want = [...d.pieces.flatMap(p => (p.graphics || []).map(g => g.img)), ...(d.backdrop ? [d.backdrop.img] : [])]; const miss = want.filter(id => !have.has(id)); return miss.length ? "pictures missing " + miss : ""; };
  const docNow = () => J(docRaw());
  // which top-level parts differ (and, for pieces, which keys of which piece)
  const diff = (a, b) => {
    const A = JSON.parse(a), B = JSON.parse(b), out = [];
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      if (J(A[k]) === J(B[k])) continue;
      if (k === "pieces" && Array.isArray(A[k]) && Array.isArray(B[k]) && A[k].length === B[k].length) {
        A[k].forEach((p, i) => { for (const q of new Set([...Object.keys(p), ...Object.keys(B[k][i])])) if (J(p[q]) !== J(B[k][i][q])) out.push("pieces[" + i + "]." + q); });
      } else if (A[k] && B[k] && typeof A[k] === "object" && !Array.isArray(A[k])) {
        for (const q of new Set([...Object.keys(A[k]), ...Object.keys(B[k])])) if (J(A[k][q]) !== J(B[k][q])) out.push(k + "." + q);
      } else out.push(k);
    }
    return out.join(", ");
  };
  const saveBytes = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); if (!got) throw new Error("nothing saved"); return got; };
  const reopen = (bytes) => { app.ev("openFile")("audit.pdraft", bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), null, true); };
  const report = [];
  function audit(name, fn, opt) {
    opt = opt || {};
    const r = { name, problems: [] }, bad = (m) => r.problems.push(m);
    try {
      if (opt.prep) { opt.prep(); app.commit(); }
      const b0 = docNow(), u0 = S.undo.length, n0 = S.un.length;
      fn();
      const a0 = docNow(), steps = S.undo.length - u0;
      r.steps = S.un.slice(n0).map(s => s.n);
      if (steps !== (opt.steps || 1)) bad("steps " + steps + " " + JSON.stringify(r.steps));
      if (a0 === b0) bad("no change");
      if (steps < 1) { report.push(r); return; }
      for (let k = 0; k < steps; k++) app.undo();
      if (docNow() !== b0) bad("undo: " + diff(b0, docNow()));
      for (let k = 0; k < steps; k++) app.redo();
      if (docNow() !== a0) bad("redo: " + diff(a0, docNow()));
      for (let k = 0; k < steps; k++) app.undo();
      if (docNow() !== b0) bad("undo 2: " + diff(b0, docNow()));
      for (let k = 0; k < steps; k++) app.redo();
      if (!opt.noFile) {
        reopen(saveBytes());
        if (docNow() !== a0) bad("file: " + diff(a0, docNow()));
        if (pics()) bad("file: " + pics());
        for (let k = 0; k < steps; k++) app.undo();
        if (docNow() !== b0) bad("file undo: " + diff(b0, docNow()));
        if (pics()) bad("file undo: " + pics());
        for (let k = 0; k < steps; k++) app.redo();
        if (docNow() !== a0) bad("file redo: " + diff(a0, docNow()));
      }
      if (opt.check) { const m = opt.check(); if (m) bad(m); }
    } catch (e) { bad("threw " + (e && e.stack ? e.stack.split("\\n").slice(0, 3).join(" | ") : e)); }
    report.push(r);
  }
  const P = (k) => S.pieces[k];
  const sc = (x, y) => app.toS({ x, y });      // (opening a file fits the view: places are given on the pattern)
  const PNG1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const at = (sh, i, t) => app.toS(app.segPt(sh, i, t == null ? 0.5 : t));
  const pick = (n) => { const it = app.menu.children.find(c => typeof c.onclick === "function" && c.innerHTML.includes(n + "<" + "/span>")); if (!it) throw new Error("no row " + n); it.onclick({ stopPropagation() {} }); };
`;

// two rectangles side by side, sewn on their facing sides, a fabric each; nothing in the history
const DOC2 = `
  S.pieces.length = 0; S.seams.length = 0; S.view = { s: 1, x: 0, y: 0 };
  S.pieces.push(app.mkPiece("A", app.mkShape([{x:100,y:100},{x:400,y:100},{x:400,y:300},{x:100,y:300}], true)),
                app.mkPiece("B", app.mkShape([{x:500,y:100},{x:800,y:100},{x:800,y:300},{x:500,y:300}], true)));
  S.seams.push(app.ev("makeSeam")(S.seams, { piece: P(0).id, sid: P(0).segs[1].id }, { piece: P(1).id, sid: P(1).segs[3].id }, true));
  S.sel = []; app.commit(); S.undo.length = 0; S.un.length = 0; S.redo.length = 0; S.rn.length = 0;
`;

const show = (rep) => rep.filter(r => r.problems.length).map(r => r.name + ": " + r.problems.join("; ")).join("\n");

test("r21 / 1, 2: the 2D document data of r17b–r20 (annotations, puckering, symbols, topstitch specification, a size's lock, a corner notch's direction, points of measure, graphics, render thickness, glue fill, a button's type): one step each, undo / redo / undo exact, saved and opened the same, the file's history undone", () => {
  const o = boot({ script: AUDIT + DOC2 + `
    // annotations (r20 / 4)
    audit("Annotation: Rotate", () => app.ev("noteTurn")(P(0), P(0).notes[0], 90), { prep: () => { P(0).notes = [{ text: "Cut 2", x: 250, y: 200, size: 10 }]; } });
    audit("Annotation: Colour", () => app.ev("noteColor")(P(0), P(0).notes[0], app.ev("NOTE_COLORS")[2][0]));
    audit("Annotation: Link to a line", () => { const p = P(0); S.noteLink = { pid: p.id, ni: 0 }; const q = at(p, 0, 0.5); app.ev("noteLinkClick")(q.x, q.y); });
    audit("Annotation: Copy", () => app.ev("noteCopy")(P(0), P(0).notes[0]));
    // puckering (r20 / 7)
    audit("Puckering: Segment", () => { app.setTool("segment_puckering"); const q = at(P(0), 2, 0.5); app.ev("puckerDown")(q.x, q.y); });
    audit("Puckering: Free", () => { app.setTool("free_puckering"); const a = at(P(1), 2, 0.2), b = at(P(1), 2, 0.7); app.ev("puckerDown")(a.x, a.y); app.ev("puckerDown")(b.x, b.y); });
    audit("Puckering: Seamline", () => { app.setTool("seamline_puckering"); const q = at(P(0), 1, 0.5); app.ev("puckerDown")(q.x, q.y); }, { check: () => S.puckers.length === 4 ? "" : "puckers " + S.puckers.length });
    audit("Puckering: Properties", () => { app.setTool("edit_puckering"); const q = at(P(0), 2, 0.5); app.ev("puckerMenu")(q.x, q.y, q.x, q.y); app.answer = () => ({ w: 8, d: 70 }); pick("Properties…"); app.answer = null; });
    audit("Puckering: Delete", () => { const q = at(P(0), 2, 0.5); app.ev("puckerMenu")(q.x, q.y, q.x, q.y); pick("Delete Puckering"); });
    // pattern symbols (r20 / 7)
    audit("Pattern Symbol", () => { app.setTool("pattern_symbol"); const q = at(P(0), 0, 0.5); app.ev("symbolClick")(q.x, q.y, { clientX: q.x, clientY: q.y }); pick("Gather"); });
    // a topstitch and its specification (r20 / 7)
    audit("Topstitch", () => { app.setTool("segment_topstitch"); const q = at(P(1), 0, 0.5); app.click(q.x, q.y); });
    audit("Topstitch specification: Stitch Count", () => { app.setTool("edit_topstitch"); S.selStitch = S.stitches[0].id; app.ev("ui")(); S.sel = [S.stitches[0].part.piece]; app.ev("ui")(); app.el("st-cnt").onchange({ target: { value: "3" } }); });
    audit("Topstitch specification: Stitch Length", () => { app.setTool("edit_topstitch"); S.selStitch = S.stitches[0].id; S.sel = [S.stitches[0].part.piece]; app.ev("ui")(); app.el("st-len").onchange({ target: { value: "2.54" } }); });
    // a size's Lock (r20 / 6; the Grading panel's own statement, the panel's buttons are found by a query the test page lacks)
    audit("Grading: Lock Size", () => { const z = S.grading.groups[0].sizes[1]; app.push(z.lock ? "Unlock Size" : "Lock Size"); z.lock = true; app.commit(); });
    // a corner notch's direction (r20 / 6)
    audit("Notch at a corner: Segment 2", () => {
      const p = P(1); app.setTool("notch"); S.sel = [p.id]; S.selNotch = { pid: p.id, sid: p.segs[1].id, k: 0 }; app.ev("ui")();
      const el = app.el("sn-dir"); if (!el || !el.onchange) throw new Error("no Direction field"); el.value = "other"; el.onchange({ target: el });
    }, { prep: () => { P(1).segs[1].notches = [0]; } });
    // points of measure (r20 / 6): one, then renamed
    audit("Point of Measure", () => { app.setTool("measure"); const a = at(P(0), 0, 0), b = at(P(0), 0, 1); app.click(a.x, a.y); app.click(b.x, b.y); });
    audit("Point of Measure: Rename", () => {
      app.promptAnswer = "Across"; app.ev("pomRename")(S.measures[0]); app.promptAnswer = undefined;
    });
    audit("Point of Measure: Names from CSV", () => app.ev("pomNamesText")("name\\nWaist\\n"));
    // a graphic's Custom Measurements, Tile and Face (r20 / 7)
    audit("Graphic", () => { S.images.push({ id: 1, name: "logo.png", data: PNG1, w: 1, h: 1 }); app.push("Graphic"); app.ev("placeGraphic")(P(0), S.images[0], { w: 20, h: 10, mode: "center" }); app.commit(); });
    audit("Graphic: Custom Measurements", () => {
      app.answer = () => ({ l: 50, u: 30 }); app.ev("gfxMeasNumeric")({ x: 0, y: 0 }, P(0), P(0).graphics[0]); app.answer = null;
    });
    // a pattern's Rendering Thickness and Extrusion Direction (r20 continued (4))
    audit("Rendering Thickness", () => { S.sel = [P(0).id]; app.setTool("transform"); app.ev("ui")(); const el = app.el("pp-thick3"); el.value = "4"; el.onchange({ target: el }); });
    audit("Extrusion Direction", () => { S.sel = [P(0).id]; app.ev("ui")(); const el = app.el("pp-extr"); el.value = "front"; el.onchange({ target: el }); });
    // Fold Rendering of an internal line (r20 / 9)
    audit("Fold Rendering", () => {
      const p = P(1); app.setTool("edit_pattern"); S.sel = [p.id]; S.selKind = "internal"; S.selInt = 0; app.ev("ui")(); const el = app.el("fo-rd"); if (!el || !el.onchange) throw new Error("no Fold Rendering field"); el.checked = true; el.onchange({ target: el });
    }, { prep: () => { P(1).internals.push(app.mkShape([{ x: 650, y: 110 }, { x: 650, y: 290 }], false)); } });
    // Glue Fill (r20 continued (4)): a small piece lying on A
    audit("Glue Fill", () => { app.setTool("glue_fill"); const q = sc(200, 200); app.ev("glueFillClick")(q.x, q.y, false); },
      { prep: () => { S.pieces.push(app.mkPiece("Pocket", app.mkShape([{x:150,y:150},{x:250,y:150},{x:250,y:250},{x:150,y:250}], true))); } });
    audit("Glue Fill (Subtract)", () => { const q = sc(200, 200); app.ev("glueFillClick")(q.x, q.y, true); });
    // a button (a 3D tool: placed by its function), then a type dropped on it (r20 continued (4))
        audit("Assign Button Type", () => { const L = app.libOf(); app.ev("buttonDropType")("button", L.button[1].id, S.buttons[0].id); },
      { prep: () => { const L = app.libOf(); while (L.button.length < 2) app.libAdd("button"); app.ev("addButton")("button", P(1).id, { x: 700, y: 200 }, L.button[0].id); } });
    return report;` });
  const rep = o.result;
  assert.strictEqual(rep.filter(r => r.problems.length).length, 0, show(rep) + "\n" + JSON.stringify(o.toasts.slice(-10)));
});

test("r21 / 1, 2: the background image, the lights, each fabric's roll and nesting in Print Layout (r17b–r19): one step each, undo / redo / undo exact, saved and opened the same, the file's history undone", () => {
  const o = boot({ script: AUDIT + DOC2 + `
    // the background image (r17b / 1)
    audit("Background Image: Add", () => app.ev("backdropFile")("plan.png", PNG1, 200, 100));
    audit("Background Image: Move", () => { app.ev("backdropStart")("move"); const a = sc(150, 150), b = sc(180, 170); app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", { x: b.x, y: b.y }); });
    audit("Background Image: Scale", () => { app.ev("backdropStart")("scale"); const a = sc(110, 110), b = sc(210, 110); app.answer = () => ({ len: 50 }); app.click(a.x, a.y); app.click(b.x, b.y); app.answer = null; });
    audit("Background Image: Opacity", () => { app.answer = () => ({ op: 40 }); app.ev("backdropOpacity")({ x: 10, y: 10 }); app.answer = null; });
    const bgRow = (n) => app.ev("backdropRows")({ x: 10, y: 10 }).find(r => r.n === n).f();
    audit("Background Image: Lock", () => bgRow("Lock Background Image"));
    audit("Background Image: Hide", () => bgRow("Hide Background Image"));
    audit("Background Image: Remove", () => bgRow("Remove Background Image"));
    // the document's lights (r19 follow-up, H22)
    audit("Light: Add", () => app.ev("lightAdd")("spot"));
    audit("Light: Edit", () => app.ev("lightSet")(S.lights[0].id, "intensity", 2.5));
    audit("Light: Add a second", () => app.ev("lightAdd")("point"));
    audit("Light: Delete", () => app.ev("lightDelete")(S.lights[0].id));
    // a fabric's own roll (r19 follow-up, H25), nesting, the default roll
    const props = app.el("props"), change = (id, v) => { app.ev("layoutProps")(props); const e = app.el(id); e.value = v; e.onchange(); };
    audit("Roll: Paper", () => { const lib = app.libOf(); S.layFab = lib.fabric[1].id; change("ly-paper", "rollc"); },
      { prep: () => { const lib = app.libOf(); while (lib.fabric.length < 2) app.libAdd("fabric"); P(0).fabric = lib.fabric[0].id; P(1).fabric = lib.fabric[1].id; app.setMode("layout"); } });      // (entering Print Layout lays the patterns out where they lie, no step: before the command)
    audit("Roll: Width", () => { app.setMode("layout"); S.layFab = app.libOf().fabric[1].id; change("ly-cw", "640"); });
    audit("Roll: Margin", () => { app.setMode("layout"); S.layFab = app.libOf().fabric[1].id; change("ly-margin", "0"); });
    audit("Nest Patterns", () => { app.setMode("layout"); S.layFab = null; app.layoutCmd("nest"); },
      { prep: () => { app.setMode("2d"); const c = app.mkPiece("C", app.mkShape([{x:100,y:900},{x:250,y:900},{x:250,y:1000},{x:100,y:1000}], true)); c.fabric = app.libOf().fabric[0].id; S.pieces.push(c); app.commit(); app.setMode("layout"); } });
    audit("Default Roll", () => { app.setMode("layout"); S.layFab = app.libOf().fabric[1].id; app.ev("layoutProps")(props); app.el("ly-roll-def").onclick(); });
    app.setMode("2d");
    return report;` });
  const rep = o.result;
  assert.strictEqual(rep.filter(r => r.problems.length).length, 0, show(rep) + "\n" + JSON.stringify(o.toasts.slice(-10)));
});

test("r21 / 1: the display settings kept with the file (r17b / 2) come back on opening with the preference on, not with it off; not in the history", () => {
  const o = boot({ script: AUDIT + DOC2 + `
    const out = {};
    app.ev("setRender")("transparent"); S.ui.wire3 = true; S.show.grainline = false;
    const bytes = saveBytes();
    app.ev("setRender")("front"); S.ui.wire3 = false; S.show.grainline = true;
    app.ev("setPrefs")({ openDisplay: false }); reopen(bytes); out.off = [S.ui.render, !!S.ui.wire3, S.show.grainline];
    app.ev("setPrefs")({ openDisplay: true }); reopen(bytes); out.on = [S.ui.render, !!S.ui.wire3, S.show.grainline, S.undo.length];
    return out;` });
  assert.deepStrictEqual(o.result.off, ["front", false, true], "the preference off: the machine's own");
  assert.deepStrictEqual(o.result.on, ["transparent", true, false, 0], "on: the file's; no step");
});

// two panels in 3D, facing each other front and back, sewn on one side; nothing in the history
const DOC3 = `
  const G3 = app.G3; app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  P(0).p3 = { pos: [500, 1100, 120], q: [0, 0, 0, 1], r: 0 }; P(1).p3 = { pos: [500, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  S.seams.push(app.ev("makeSeam")(S.seams, { piece: P(0).id, sid: P(0).segs[1].id }, { piece: P(1).id, sid: P(1).segs[3].id }, true));
  app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0; S.redo.length = 0; S.rn.length = 0;
`;

test("r21 / 1, 2: the 3D commands of r20 on patterns (Archive, Flip Normal, Superimpose, Move to Ground Center) one step each, exact, saved and opened; a volume measure changes neither the document nor its history", () => {
  const o = boot({ blank: true, three: true, script: AUDIT + DOC3 + `
    const sel = () => { S.sel = [P(0).id]; app.ev("garmentSync")(); };
    audit("Archive", () => { sel(); app.ev("state3Toggle")("arch3"); });
    audit("Unarchive", () => { sel(); app.ev("state3Toggle")("arch3"); });
    audit("Flip Normal", () => { sel(); app.ev("state3Toggle")("flip3"); });
    audit("Superimpose (Over)", () => { sel(); app.ev("superimpose3")("over"); });
    audit("Superimpose (Under)", () => { sel(); app.ev("superimpose3")("under"); });
    audit("Move to Ground Center", () => { S.sel = [P(0).id, P(1).id]; app.ev("garmentSync")(); app.ev("moveToGround3")(); });
    // a volume measure: not in the file and no step (guess r10 / 4: garment measurements are the session's)
    const before = docNow(), u = S.undo.length;
    app.ev("garmentSync")(); app.ev("addGarMeas")({ kind: "vol", ids: [P(0).id, P(1).id] });
    const m = (S.garMeas || [])[0]; if (m) { app.ev("volSet")(m, { target: 10, scale: 1.1 }); app.ev("volReset")(m); app.ev("volDelete")(m); }
    report.push({ name: "Volume Measure", steps: [], problems: [m ? "" : "no measure", docNow() === before ? "" : "the document changed", S.undo.length === u ? "" : "a step"].filter(Boolean) });
    return report;` });
  const rep = o.result;
  assert.strictEqual(rep.filter(r => r.problems.length).length, 0, show(rep) + "\n" + JSON.stringify(o.toasts.slice(-10)));
});

test("r21 / 1, 2: the avatar's edits of r18–r20 on Marty (a joint turned and reset, the IK locks, Avatar Size, avatar measures, arrangement, the IK mapping and T-pose, the fitting suit and its deletions, every measure deleted, a blend weight and Reset, pins attached to the avatar): one step each, exact, saved and opened", () => {
  const o = boot({ blank: true, three: true, script: AUDIT + DOC3 + `
    const T3 = app.TOOL3.select_move, v3 = app.view3d, THREE = app.ev("THREE");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      S.undo.length = S.un.length = 0; S.redo.length = S.rn.length = 0;
      app.setTool3("select_move"); app.setPrefs({ gizSpace: "world" }); S.ui.jointLimits = false;
      const cam = () => { Object.assign(v3.cam, { az: 0, el: 0.05, dist: 2600, tx: 300, ty: 1150, tz: 0 }); v3.scene().updateMatrixWorld(true); };
      const wp = (n) => S.av.bones.get(n).getWorldPosition(new THREE.Vector3());
      const ev = (x, y) => ({ clientX: x, clientY: y, button: 0, buttons: 1 });
      // a joint turned by its ring (r18 / 2)
      audit("Turn Joint", () => {
        cam(); app.ev("setJoints3")(true);
        const e0 = v3.project(wp("lowerarm_l")); T3.down(ev(e0.x, e0.y)); T3.up(ev(e0.x, e0.y));
        if (app.G3.joint !== "lowerarm_l") throw new Error("the elbow not selected: " + app.G3.joint);
        const geom = app.ev("gizGeom")(), ax = app.ev("GIZ_AX").find(a => a.k === "z"), p0 = v3.project(app.ev("gizRingPt")(geom, ax, 0.6));
        T3.down(ev(p0.x, p0.y)); const tp = T3.d.tpx;
        for (let k = 1; k <= 12; k++) T3.move(ev(p0.x + tp.x*6*k, p0.y + tp.y*6*k));
        T3.up(ev(p0.x + tp.x*72, p0.y + tp.y*72));
      });
      audit("Constrain Joint Rotation", () => { app.G3.joint = "lowerarm_l"; app.ev("ikLock")("lockR"); });
      audit("Constrain Joint Translation", () => { app.G3.joint = "hand_l"; app.ev("ikLock")("lockT"); });
      // the IK tab's buttons (r18 / 7), wired on a stand-in for the tab
      const wire = (tab, a) => { const b = {}; app.ev("AVED_WIRE")[tab]({ querySelectorAll: () => [], querySelector: (s) => { const m = s.match(/data-a="([^"]+)"/); return m && m[1] === a ? b : null; } }); b.onclick(); };
      const ikBtn = (a) => { const b = {}; app.ev("AVED_WIRE").ik({ querySelectorAll: () => [], querySelector: (s) => { const m = s.match(/data-a="([^"]+)"/); return m && m[1] === a ? b : null; } }); b.onclick(); };
      audit("IK Joint Mapping", () => app.ev("ikMapSet")({ wrist_l: "" }));
      audit("Auto Mapping", () => ikBtn("auto"));
      audit("Set T-Pose", () => ikBtn("tpose"));
      audit("Reset Joint", () => { app.G3.joint = "lowerarm_l"; app.ev("jointReset")(); });
      audit("Reset Pose", () => ikBtn("rpose"));
      // Avatar Size (r18 / 4)
      audit("Avatar Size", () => app.ev("sizeTyped")("waist", 820));
      // the avatar's measurements (r18 / 5)
      audit("Avatar Measure", () => app.ev("measAdd")({ kind: "tape", type: "basic", at: [{ v: [100, 100, 100], w: [1, 0, 0] }, { v: [2000, 2000, 2000], w: [1, 0, 0] }] }));
      audit("Avatar Measure: Rename", () => app.ev("measSet")(0, { name: "Front" }));
      audit("Delete Avatar Measure", () => app.ev("measDelete")(0));
      // arrangement (r18 / 6)
      audit("Arrangement Point", () => app.ev("arrEdit")((set) => { const q = set.pts.find(x => x.id === "armL_back"); q.x = 60; q.y = 80; }));
      // the fitting suit (r18 / 8): the waist by three places round it
      audit("Fitting Suit Line", () => {
        cam(); Object.assign(v3.cam, { tx: 0 }); v3.scene().updateMatrixWorld(true);
        const hit = (o, d) => app.ev("avatarHit")({ o: new THREE.Vector3(...o), d: new THREE.Vector3(...d), rc: null });
        const evp = (P) => { const q = v3.project(P); return ev(q.x, q.y); };
        const wy = app.ev("sizeMeasure")(S.av).levels.waistY;
        app.ev("avEditor")(true, "suit"); app.ev("suitArm")("waist");
        for (const P of [hit([60, wy, 1500], [0, 0, -1]), hit([-60, wy, 1500], [0, 0, -1])]) { T3.down(evp(P)); T3.up({}); }
        Object.assign(v3.cam, { az: Math.PI }); v3.scene().updateMatrixWorld(true);
        { const P = hit([0, wy, -1500], [0, 0, 1]); T3.down(evp(P)); T3.up({}); }
        cam(); app.ev("avEditor")(false);
      });
      audit("Delete Fitting Suit Line", () => { app.G3.suitLine = "waist"; wire("suit", "del"); },
        { prep: () => { const s = S.avedit.suit[0]; S.avedit = app.ev("normAvEdit")({ ...S.avedit, suit: [s, { ...s, key: "knee" }] }); } });
      audit("Delete Fitting Suit Lines", () => wire("suit", "reset"));
      audit("Delete Avatar Measures", () => app.ev("measDeleteAll")(),
        { prep: () => { const m = { kind: "tape", type: "basic", at: [{ v: [100, 100, 100], w: [1, 0, 0] }, { v: [2000, 2000, 2000], w: [1, 0, 0] }] }; app.ev("measAdd")(m); app.ev("measAdd")(m); } });
      // a blend weight (r18 / 8; Marty has no blend shapes: the weight is kept in the document all the same)
      audit("Blend Shape", () => app.ev("blendSet")("body", "Belly", 40));
      audit("Reset Blend Shapes", () => wire("blend", "reset"));
      // pins attached to the avatar and back (r20 / 9)
      audit("Attach All Pins to Avatar", () => app.ev("attachPins3")(), { prep: () => { P(0).pins = [{ x: 150, y: 50 }]; app.ev("garmentSync")(); } });
      audit("Detach All Pins from Avatar", () => app.ev("detachPins3")());
      return report;
    });` });
  const rep = o.result;
  assert.strictEqual(rep.filter(r => r.problems.length).length, 0, show(rep) + "\n" + JSON.stringify(o.toasts.slice(-12)));
});

test("r21 / 2: the line and shape commands of r17b–r20 (Trace's Fill & Trace, Slice and Trim, Duplicate to Symmetric Pattern, points merged, divided, joined and aligned, Delete All Overlapping Points, Extend/Trim & Add Point, Replaced by, Optimize Curve Points, Pleats Fold, Merge Sewing, Edit Gluing, Sticker, Unlink): one step each, exact, saved and opened", () => {
  const o = boot({ script: AUDIT + DOC2 + `
    const ln = (pts) => app.mkShape(pts.map(([x, y]) => ({ x, y })), false);
    const fresh = () => { S.undo.length = S.un.length = 0; S.redo.length = S.rn.length = 0; };
    // two internal lines in A whose ends meet near (210, 200), a third across at x 300
    S.pieces[0].internals.push(ln([[150, 150], [200, 200]]), ln([[260, 250], [210, 200.2]]), ln([[300, 120], [300, 200], [300, 280]]));
    app.commit(); fresh();
    const L = () => P(0).internals;
    audit("Merge to Point", () => app.ev("pointCommand")(P(0), "Merge to Point", () => app.ev("mergeEnds")(P(0), "internals", { sh: L()[0], i: 1 }, { sh: L()[1], i: 1 }, "point")));
    audit("Divide Internal Point", () => app.ev("pointCommand")(P(0), "Divide Internal Point", () => app.ev("divideInternalPoint")(P(0), "internals", L().findIndex(l => l.pts.length === 3 && l.pts[0].x === 300), 1)));
    audit("Join Overlapping Points", () => app.ev("pointCommand")(P(0), "Join Overlapping Points", () => app.ev("joinOverlapping")(P(0), "internals", L().length - 2, 1)),
      { prep: () => { L().push(ln([[120, 260], [160, 270]]), ln([[160, 270], [200, 290]])); } });
    audit("Align ▸ Left", () => { app.push("Align Left"); app.ev("alignPoints")({ sh: L()[0], i: 0 }, { sh: L()[L().length - 1], i: 0 }, "left"); app.commit(); });
    audit("Delete All Overlapping Points", () => app.ev("deleteOverlapping")(),
      { prep: () => { const b = P(1); b.internals.push(ln([[600, 150], [650, 150], [650, 150.1], [700, 150]])); } });
    // Extend/Trim & Add Point (r17b / 1: the internal line menu's own statement)
    audit("Extend/Trim & Add Point", () => { const p = P(1), l = p.internals[p.internals.length - 1]; app.push("Extend/Trim & Add Point"); if (!app.ev("extendTrimAddPoint")(p, l, 1, true)) throw new Error("nothing to extend to"); app.commit(); });
    // Replaced by (r20 / 3): the line across A takes the shape of a new one
    audit("Replaced by", () => { const p = P(0), old = L()[L().length - 1]; app.ev("replaceShapeStart")(p, old); const nw = L()[L().length - 2]; const q = at(nw, 0, 0.5); app.ev("replaceClick")(q.x, q.y); });
    // Optimize Curve Points (build-1 / 3): a curve of many curve points on a line of B
    audit("Optimize Curve Points (menu)", () => { const p = P(1); app.push("Optimize Curve Points"); const n = app.ev("optimizeCurve")(p, p, 0); app.commit(); if (!n) throw new Error("nothing"); },
      { prep: () => { const s = P(1).segs[0]; s.curved = true; s.cps = [550, 600, 650, 700, 750].map(x => ({ x, y: 100 - 0.0004*(x - 500)*(800 - x) })); } });
    // Merge Sewing (r20 / 3, 4a): a second seam beside the first, merged
    audit("Merge Sewing", () => app.ev("mergeSewing")(S.seams[1], S.seams[0]),
      { prep: () => { S.seams.push(app.ev("makeSeam")(S.seams, { piece: P(0).id, sid: P(0).segs[2].id }, { piece: P(1).id, sid: P(1).segs[2].id }, true)); } });
    // Sticker (build-1 / 4) and Edit Gluing's turn and flip
    audit("Sticker", () => { app.setTool("sticker"); let q = sc(200, 200); app.ev("stickerClick")(q.x, q.y, { x: 200, y: 200 }); q = sc(650, 200); app.ev("stickerClick")(q.x, q.y, { x: 650, y: 200 }); },
      { prep: () => { S.pieces.push(app.mkPiece("Label", app.mkShape([{x:180,y:180},{x:220,y:180},{x:220,y:220},{x:180,y:220}], true))); } });
    const glue = () => S.glues[S.glues.length - 1];
    audit("Edit Gluing: Turn", () => app.ev("glueTurn")(glue(), 90));
    audit("Edit Gluing: Flip", () => app.ev("glueFlip")(glue(), true));
    // Trace (r17b / 5, 6): Fill & Trace of A, set down by a click
    audit("Trace: Fill & Trace", () => { app.setTool("trace"); app.ev("setTraceMode")("shape"); S.traceShapes = [{ pid: P(0).id, shape: 0 }]; app.ev("traceOp")("fill"); const q = sc(200, 700); app.click(q.x, q.y); });
    const lab = () => S.pieces.find(p => p.name === "Label");
    audit("Trace: Slice", () => { app.setTool("trace"); app.ev("setTraceMode")("shape"); S.traceShapes = [{ pid: P(0).id, shape: 0 }, { pid: lab().id, shape: 0 }]; app.ev("traceOp")("slice"); const q = sc(200, 900); app.click(q.x, q.y); });
    audit("Trace: Trim", () => { app.setTool("trace"); app.ev("setTraceMode")("shape"); S.traceShapes = [{ pid: P(0).id, shape: 0 }, { pid: lab().id, shape: 0 }]; app.ev("traceOp")("trim"); const q = sc(200, 1300); app.click(q.x, q.y); });
    // a punch mark's Duplicate to Symmetric Pattern (r17b / 1) on a pattern unfolded about its right side
    const half = () => S.pieces.find(p => p.half);
    audit("Duplicate to Symmetric Pattern", () => app.ev("punchToSymmetric")(half(), half().punches[0]),
      { prep: () => { const u = app.ev("unfold")(P(1), 1); u.name = "Unfolded"; S.pieces.push(u); app.commit(); app.push("Punch"); half().punches.push({ x: 550, y: 150, d: 3, name: "Punch Mark 1" }); } });
    // Unlink (an annotation's menu, r20 / 4): the menu's own statement
    audit("Unlink Annotation", () => { const nt = P(0).notes[0]; app.push("Unlink Annotation"); delete nt.link; app.commit(); },
      { prep: () => { P(0).notes = [{ text: "Cut 2", x: 250, y: 200, size: 10, link: { sid: P(0).segs[0].id } }]; } });
    return report;` });
  const rep = o.result;
  assert.strictEqual(rep.filter(r => r.problems.length).length, 0, show(rep) + "\n" + JSON.stringify(o.toasts.slice(-12)));
});

test("r21 / 2: a command that cannot be done takes its step back and leaves the redo list as it was (before, a failed command emptied it)", () => {
  const o = boot({ script: AUDIT + DOC2 + `
    const out = {};
    app.push("Internal Line"); S.pieces[0].internals.push(app.mkShape([{ x: 150, y: 150 }, { x: 250, y: 250 }], false)); app.commit();
    app.undo(); out.before = [S.undo.length, S.redo.length, S.rn.length];
    // Optimize Curve Points on a straight line: nothing to take out
    const sh = S.pieces[0]; app.push("Optimize Curve Points"); const n = app.ev("optimizeCurve")(sh, sh, 0);
    if (!n) app.ev("unpush")();
    out.after = [S.undo.length, S.redo.length, S.rn.length, S.un.length];
    app.redo(); out.redone = S.pieces[0].internals.length;
    // a point command that fails is rolled back (rollback()): the redo list kept too
    app.undo(); out.before2 = S.redo.length;
    app.ev("pointCommand")(S.pieces[0], "Divide Internal Point", () => app.ev("divideInternalPoint")(S.pieces[0], "internals", 9, 1));
    out.after2 = [S.undo.length, S.redo.length];
    return out;` });
  assert.deepStrictEqual(o.result.before, [0, 1, 1]);
  assert.deepStrictEqual(o.result.after, [0, 1, 1, 0], "no step, the redo list kept with its name");
  assert.strictEqual(o.result.redone, 1, "the redo still brings the line back");
  assert.deepStrictEqual([o.result.before2, ...o.result.after2], [1, 0, 1], "rolled back: no step, the redo list kept");
});

/* ---- Batch 2: every test file of versions 11, 12 and 18 to 24 and every example, opened ---- */
// (versions 18 and 19 were written by the last builds that saved them, a626be6^ and 66feee4^: a small sewn document with a
// history, its last step undone)
const FILES = fs.readdirSync(path.join(__dirname, "files")).filter(d => /^v[0-9]+$/.test(d)).sort((a, b) => a.slice(1) - b.slice(1))
  .flatMap(d => fs.readdirSync(path.join(__dirname, "files", d)).filter(n => n.endsWith(".pdraft")).map(n => d + "/" + n));
const WALK = `
  // the document opened: saved and opened again the same (and the same bytes when saved once more), its history walked to its
  // start and to its end, each state one the program can draw (checkDoc()), and back where it was
  function walk(name) {
    const r = { name, problems: [] }, bad = (m) => r.problems.push(m);
    try {
      const d0 = docNow(), u = S.undo.length, rd = S.redo.length; r.steps = [u, rd];
      app.checkDoc(S.pieces, S.seams);
      const b1 = saveBytes(); reopen(b1);
      if (docNow() !== d0) bad("saved and opened: " + diff(d0, docNow()));
      if (S.undo.length !== u || S.redo.length !== rd) bad("history " + [S.undo.length, S.redo.length] + " for " + [u, rd]);
      const b2 = saveBytes();
      if (b1.length !== b2.length || b1.some((x, i) => x !== b2[i])) bad("saved again: other bytes (" + b1.length + ", " + b2.length + ")");
      for (let k = 0; k < u; k++) { app.undo(); app.checkDoc(S.pieces, S.seams); }
      for (let k = 0; k < u + rd; k++) { app.redo(); app.checkDoc(S.pieces, S.seams); }
      for (let k = 0; k < rd; k++) app.undo();
      if (docNow() !== d0) bad("history walked: " + diff(d0, docNow()));
    } catch (e) { bad("threw " + (e && e.stack ? e.stack.split(String.fromCharCode(10)).slice(0, 3).join(" | ") : e)); }
    report.push(r);
  }
`;
test("r21 / 3: every test file (versions 11, 12, 18 to 24) opens with no error, saves and opens again the same, saves again to the same bytes, and its whole history undoes and redoes", () => {
  const files = FILES.map(n => [n, Array.from(fs.readFileSync(path.join(__dirname, "files", n)))]);
  assert.ok(["v18", "v19", "v20", "v21", "v22", "v23", "v24", "v25", "v26", "v27"].every(v => files.some(([n]) => n.startsWith(v + "/"))), "a file of each version: " + files.map(x => x[0]));
  const o = boot({ blank: true, three: true, script: AUDIT + WALK + `
    const files = ${JSON.stringify(files)};
    for (const [n, b] of files) { app.ev("openFile")(n, new Uint8Array(b), null, true); walk(n); }
    return report;` });
  const rep = o.result;
  assert.strictEqual(rep.length, files.length);
  assert.strictEqual(rep.filter(r => r.problems.length).length, 0, show(rep));
  assert.deepStrictEqual(o.warnings, [], "no warning in the console");
});
test("r21 / 3: every example (File ▸ Open Example) opens with no error, saves and opens again the same and to the same bytes", () => {
  const o = boot({ blank: true, three: true, script: AUDIT + WALK + `
    for (const e of app.ev("shippedExamples")()) { app.ev("openExample")(e, true); walk(e.id); }
    return report;` });
  const rep = o.result;
  assert.strictEqual(rep.length, 3);
  assert.strictEqual(rep.filter(r => r.problems.length).length, 0, show(rep));
});

module.exports = T;
