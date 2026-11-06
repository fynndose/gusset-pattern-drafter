// Round r13: what could be built from the sources alone. 1: quick fixes (stale "not built yet" rows of things built
// earlier, the strain map's key). Batches 2 and on: one feature (or a small group) each, from the inventory's class A list.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  // long options go through a file: a Windows command line holds at most 32 767 characters
  let arg = JSON.stringify(opt || {});
  if (arg.length > 30000) { const f = path.join(require("os").tmpdir(), "pdraft-boot-r13-" + process.pid + ".json"); fs.writeFileSync(f, arg); arg = "@" + f; }
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
  const click = (x, y, o) => { const s = { ...at(x, y), ...(o || {}) }; app.fire("pointermove", s); app.fire("pointerdown", s); app.fire("pointerup", s); };
  const steps = () => app.histSteps().steps.map(s => s.n);
  const sub = (items, n) => items.filter(Boolean).find(x => x.n === n).menu().filter(Boolean);
`;
// a front and a back, sewn at both sides, in the 3D window
const SEWN = `
  const out = {}, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  A.p3 = { pos: [0, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [0, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }, { id: 2, a: [part(A, 3)], b: [part(B, 1, true)] });
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")();
  Object.assign(v3.cam, { az: 0, el: 0, dist: 3000, tx: 0, ty: 1100, tz: 0 });
  const steps = () => app.histSteps().steps.map(s => s.n);
  const sub = (items, n) => items.filter(Boolean).find(x => x.n === n).menu().filter(Boolean);
`;

/* ---------- 1: quick fixes ---------- */
test("r13 / 1: Display > 3D Trims > Show Button and Show All Pipings are real switches (the same as the 3D window's selector), the piping switch hides the piping tube; Fit Maps > Strain Map is the strain map built in r9, on Alt+7", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    S.pipings.push({ id: 1, name: "Piping 1", seam: 1, t0: 0.1, t1: 0.9, d: 5, fabric: "", side: "in" }); app.commit();
    const disp = app.ev("menuDisplay")(), trims = sub(disp, "3D Trims"), fit = sub(disp, "Fit Maps");
    out.trims = trims.filter(x => !x.hd).slice(0, 2).map(x => [x.n, !!x.nb, !!x.on]);
    out.fit = fit.map(x => [x.n, x.k || "", !!x.nb]);
    const tubes = () => v3.group("trims").children.filter(c => c.userData.trim && c.userData.trim.kind === "piping").length;
    app.ev("showTrims3")(); out.tube = tubes();
    trims.find(x => x.n === "Show All Pipings").f(); app.ev("showTrims3")();
    out.hidden = [tubes(), S.ui.show3d.piping];
    out.selector = app.ev("VIEW3D").trim.find(v => v[0] === "piping")[1];
    trims.find(x => x.n === "Show Button").f(); out.buttons = S.ui.show3d.buttons;
    app.key("7", { altKey: true }); out.alt7 = [S.ui.strain3, toasts[toasts.length - 1]];
    app.key("7", { altKey: true }); out.alt7off = S.ui.strain3;
    return out;
  ` });
  const r = o.result;
  assert.deepStrictEqual(r.trims, [["Show Button", false, true], ["Show All Pipings", false, true]], "both real rows, on by default");
  assert.deepStrictEqual(r.fit.find(x => x[0] === "Strain Map"), ["Strain Map", "Alt+7", false]);
  // (the Fit Map is built since Round r14 / 7; the Stress and Pressure Maps since Round r20 continued (4): none of the four is a not-built row now)
  assert.ok(r.fit.every(x => !x[2]), "every fit map is built");
  assert.strictEqual(r.tube, 1, "the piping is drawn");
  assert.deepStrictEqual(r.hidden, [0, false], "and hidden with its switch off");
  assert.strictEqual(r.selector, "Show Piping", "the selector no longer says \"none yet\"");
  assert.strictEqual(r.buttons, false);
  assert.deepStrictEqual(r.alt7, [true, "Strain Map on"]); assert.strictEqual(r.alt7off, false);
});

test("r13 / 1: the Notch tool's tip says what it does now (a notch can be selected since r12)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "drafter-tools.js"), "utf8"), w = {};
  new Function("window", src + "\nwindow.R = TOOL_REGISTRY;")(w);
  const t = w.R.tools.find(x => x.id === "notch");
  assert.ok(!/can't be selected/.test(t.tip), t.tip);
});

/* ---------- 2: a notch's own Length and Flip ---------- */
test("r13 / 2: a notch's own length (only with a Custom angle) and flip are kept by normNotchAt and nRev; junk is dropped", () => {
  const o = boot({ blank: true, script: `
    const norm = app.ev("normNotchAt"), nRev = app.ev("nRev");
    return {
      norm: [norm({ t: 0.3, angle: 10, len: 12 }), norm({ t: 0.3, len: 12 }), norm({ t: 0.3, angle: 10, len: 99 }), norm({ t: 0.3, angle: 10, len: "x" }),
        norm({ t: 0.3, flip: true }), norm({ t: 0.3, flip: "yes" }), norm({ t: 0.3, type: "V", flip: true, angle: 5, len: 0.1 })],
      rev: nRev({ t: 0.25, angle: 10, len: 12, flip: true }) };` }).result;
  assert.deepStrictEqual(o.norm, [{ t: 0.3, angle: 10, len: 12 }, 0.3, { t: 0.3, angle: 10, len: 50 }, { t: 0.3, angle: 10 },
    { t: 0.3, flip: true }, 0.3, { t: 0.3, type: "V", angle: 5, len: 0.5, flip: true }], "a length without a Custom angle is dropped (the field is greyed with Perpendicular), as is a flip that is not true");
  assert.deepStrictEqual(o.rev, { t: 0.75, angle: -10, len: 12, flip: true });
});

test("r13 / 2: the Property Editor's Selected Notch has Length (greyed with Perpendicular) and Flip; each change one undo step, drawn so (its own length; cut outwards when flipped); back to Perpendicular drops the length; saved as version 16 and opened the same", () => {
  const o = boot({ script: DOC + `
    return (async () => {
      app.setTool("notch"); click(100, 0);
      const seg0 = () => S.pieces[0].segs[0].notches, look = (o) => app.ev("setNotchLook")(o), pe = () => app.el("props").innerHTML;
      app.ev("ui")(); out.field = [/id="sn-len"[^>]*disabled/.test(pe()), /id="sn-flip"/.test(pe())];
      const mk = () => app.ev("notchMarks")(A, { ...S.notch, dup: false })[0];
      out.plain = mk().map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
      look({ flip: true }); out.flipped = [JSON.parse(JSON.stringify(seg0())), mk().map(q => [+q.x.toFixed(3), +q.y.toFixed(3)])];
      look({ angle: 15 }); app.ev("ui")(); out.enabled = !/id="sn-len"[^>]*disabled/.test(pe());
      look({ len: 14 }); out.own = [JSON.parse(JSON.stringify(seg0())), +Math.hypot(mk()[1].x - mk()[0].x, mk()[1].y - mk()[0].y).toFixed(3)];
      out.steps = steps();
      // saved (version 16) and opened again
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      const fd = app.fileDoc(file); out.inFile = [fd.v, fd.pieces[0].segs[0].notches];
      app.ev("openFile")("n.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened n/.test(x)), "the file to open");
      out.opened = JSON.parse(JSON.stringify(S.pieces[0].segs[0].notches));
      // back to Perpendicular: the own length goes, the flip stays; unflipped as well: a plain number again
      app.setTool("notch"); click(100, 0);
      look({ angle: 0 }); out.perp = JSON.parse(JSON.stringify(S.pieces[0].segs[0].notches));
      look({ flip: false }); out.back = S.pieces[0].segs[0].notches.slice();
      return out;
    })();` }).result;
  assert.deepStrictEqual(o.field, [true, true], "Length is there and greyed while the angle is Perpendicular; Flip is there");
  // the top line runs left to right at y 0 with the pattern below it: a plain notch goes down into the pattern, a flipped one up
  assert.deepStrictEqual(o.plain, [[100, 0], [100, 6]]);
  assert.deepStrictEqual(o.flipped, [[{ t: 0.5, flip: true }], [[100, 0], [100, -6]]]);
  // (Round r16: Length is greyed with a Custom angle too, as the reference's (r13/3); a length stored on a notch (setNotchLook,
  // an older file) still draws and saves, as the rest of this test shows. It could be typed with Custom before.)
  assert.strictEqual(o.enabled, false, "with a Custom angle Length stays greyed");
  assert.deepStrictEqual(o.own[0], [{ t: 0.5, angle: 15, len: 14, flip: true }]); near(o.own[1], 14, 1e-3, "drawn its own length");
  assert.deepStrictEqual(o.steps, ["Notch", "Notch", "Notch", "Notch"]);
  assert.strictEqual(o.inFile[0], 31);      /* ((Round H1a: version 31) (Round r34: version 30) ((Round r33b: version 29) version 28 since Round r30 (a seam's mirror); 28 since Round r30, 27 since Round r29 (a document's render settings); 26 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1;) */ assert.deepStrictEqual(o.inFile[1], [{ t: 0.5, angle: 15, len: 14, flip: true }]);      // (version 19 since Round perf-2; 18 since Round r15; 17 since Round r14)
  assert.deepStrictEqual(o.opened, o.inFile[1]);
  assert.deepStrictEqual(o.perp, [{ t: 0.5, flip: true }]); assert.deepStrictEqual(o.back, [0.5]);
});

test("r13 / 2: a version 15 file's notches with their own look open as they were; a file of a version after 16 is refused", () => {
  const o = boot({ blank: true, script: `
    const p = app.mkPiece("Old", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:100},{x:0,y:100}], true));
    p.segs[0].notches = [0.25, { t: 0.75, type: "V", angle: 20 }];
    const doc = JSON.parse(app.docJSON()); doc.v = 15; doc.pieces = [JSON.parse(JSON.stringify(p))];
    app.openText("old.pdraft", JSON.stringify(doc), null, true);
    const out = { v15: JSON.parse(JSON.stringify(S.pieces[0].segs[0].notches)) };
    // a container file (every file since version 12) whose document says 17
    const part = (v) => new Map([["document.json", new TextEncoder().encode(JSON.stringify({ ...doc, v }))]]), pd = app.ev("pdraftDoc");
    out.v16 = pd(part(16)).v;
    try { pd(part(32)); out.v17 = "opened"; } catch (e) { out.v17 = e.message; }      // ((Round H1a: 32, one past this build's 31) (Round r34: 31, one past this build's 30) ((Round r33b: 30, one past this build's 29) Round r30: 28 is this build's version; Round r29: 27 was; Round r26: 26 was this build's version; Round r25: 25 was; Round r20: 24 was; the r19 follow-up: 23 was; Round r18: 22 was this build's version; Round r17b: 21 was this build's version; Round build-1: 20 was this build's version (19 since Round perf-2, 18 since Round r15); the one after it is refused)
    return out;` }).result;
  assert.strictEqual(o.v16, 16);
  assert.deepStrictEqual(o.v15, [0.25, { t: 0.75, type: "V", angle: 20 }]);
  assert.ok(/newer version/.test(o.v17), o.v17);
});

/* ---------- 3: Divide Internal Point, Join Overlapping Points, Align ---------- */
const LINES = DOC + `
  const line = (pts) => { const sh = app.mkShape(pts, false); app.addChild(A, "internals", sh); return sh; };
  const menu = (x, y, name) => { const s = at(x, y); app.menuClick(s.x, s.y, name, "edit_pattern"); };
  const P = (sh) => sh.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
`;
// (Round r33 / 4) graded on the size run every document had before r33 (a document starts with none since): oldSizeRun
test("r13 / 3: Divide Internal Point (an internal line's point menu) splits an open line in two at the point: ids kept, a seam across it becomes two parts, grading and a measurement follow their points; one undo step; not at an end; a closed shape opens there", () => {
  const o = boot({ oldSizeRun: true,  script: LINES + `
    const L = line([{x:20,y:100},{x:100,y:100},{x:180,y:100}]); L.fold = "valley";
    const ids = L.segs.map(s => s.id);
    S.seams.push({ id: 1, a: [{ piece: A.id, shape: L.id, sids: ids.slice(), t0: 0.5, t1: 0.5, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[0].id], t0: 0, t1: 1, rev: false }] });
    const z = app.ev("gGroup")(S.grading, A).sizes.find(x => x.id !== app.ev("gGroup")(S.grading, A).base).id;
    const g = app.ev("ensureGrade")(S.grading, A); g.pts[app.ev("ptKey")(A, L, 2)] = { d: { [z]: { dx: 3, dy: 4 } } }; g.pts[app.ev("ptKey")(A, L, 1)] = { d: { [z]: { dx: 1, dy: 1 } } };
    S.measures.push({ id: 1, a: app.ev("mkAnchor")(A, A, 0), b: app.ev("mkAnchor")(A, L, 2), kind: "line" });      // (from the corner, its label clear of the point right-clicked)
    app.commit(); S.undo.length = 0;
    // an end of the line: the row says why it is greyed
    { const q = at(20, 100); S.tool = "edit_pattern"; app.menu.children.length = 0; app.showMenu({ clientX: q.x, clientY: q.y });
      const row = app.menu.children.find(c => /Divide Internal Point/.test(c.innerHTML)); out.atEnd = [A.internals.length, row ? row.innerHTML : "no row"]; app.ev("hideMenu")(); }
    menu(100, 100, "Divide Internal Point");
    const [L1, L2] = A.internals;
    out.lines = [P(L1), P(L2), L1.segs.map(s => s.id), L2.segs.map(s => s.id), L2.fold, L1.id !== L2.id];
    out.seam = JSON.parse(JSON.stringify(S.seams[0].a)).map(x => [x.shape === L1.id ? "L1" : x.shape === L2.id ? "L2" : x.shape, x.sids, x.t0, x.t1]);
    out.grade = Object.keys(A.grade.pts).sort();
    out.keys = [app.ev("ptKey")(A, L2, 1), app.ev("ptKey")(A, L1, 1), app.ev("ptKey")(A, L2, 0)].sort();
    out.meas = [S.measures[0].a.shape === 0, S.measures[0].b.shape === L2.id, !!S.measures[0].b.end];
    out.steps = steps(); app.checkDoc(S.pieces, S.seams);
    app.undo(); const Au = S.pieces.find(q => q.name === "A"); out.undone = [Au.internals.length, P(Au.internals[0]).length, S.seams[0].a.length];
    // a closed internal shape opens at the point: it starts and ends there
    const A2 = S.pieces.find(q => q.name === "A");      // (undo puts new objects in place)
    const C = app.mkShape([{x:40,y:200},{x:160,y:200},{x:160,y:300},{x:40,y:300}], true); app.addChild(A2, "internals", C); app.commit();
    menu(160, 300, "Divide Internal Point");
    const D = A2.internals[A2.internals.length - 1]; out.closed = [D.closed, P(D), D.segs.length];
    return out;
  ` }).result;
  assert.deepStrictEqual(o.atEnd[0], 1); assert.ok(/not at an end/.test(o.atEnd[1]), "at an end the row is greyed and says why: " + o.atEnd[1]);
  assert.deepStrictEqual(o.lines.slice(0, 2), [[[20, 100], [100, 100]], [[100, 100], [180, 100]]]);
  assert.deepStrictEqual([o.lines[2].length, o.lines[3].length, o.lines[4], o.lines[5]], [1, 1, "valley", true], "each half keeps its segment's id; the new half has the line's properties");
  assert.deepStrictEqual(o.seam, [["L1", [o.lines[2][0]], 0.5, 1], ["L2", [o.lines[3][0]], 0, 0.5]], "the seam's run across the point is two parts now");
  assert.deepStrictEqual(o.grade, o.keys, "the end's grading went with it, and the divided point's is on both new ends");
  assert.deepStrictEqual(o.meas, [true, true, true]);
  assert.deepStrictEqual(o.steps, ["Divide Internal Point"]);
  assert.deepStrictEqual(o.undone, [1, 3, 1]);
  assert.deepStrictEqual(o.closed, [false, [[160, 300], [40, 300], [40, 200], [160, 200], [160, 300]], 4]);
});

test("r13 / 3: Join Overlapping Points: two line ends within 0.5 mm become one point and the lines one (the one right-clicked keeps its id); a line running the other way is turned round with its seam; a line's own two ends close it; with no end on it the row says so", () => {
  const o = boot({ script: LINES + `
    const L1 = line([{x:20,y:100},{x:100,y:100}]), L2 = line([{x:100.3,y:100},{x:180,y:100}]);
    const L3 = line([{x:20,y:200},{x:100,y:200}]), L4 = line([{x:180,y:200},{x:100.2,y:200.2}]);
    const L5 = line([{x:20,y:300},{x:100,y:300},{x:100,y:350},{x:20.3,y:300.1}]);
    S.seams.push({ id: 1, a: [{ piece: A.id, shape: L4.id, sids: [L4.segs[0].id], t0: 0.2, t1: 0.6, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[0].id], t0: 0, t1: 1, rev: false }] });
    app.commit(); S.undo.length = 0;
    const ids = [L1, L2, L3, L4].map(l => l.segs[0].id);
    menu(100, 100, "Join Overlapping Points");
    out.a = [A.internals.length, A.internals[0] === L1, P(L1), L1.segs.map(s => s.id)];
    menu(100, 200, "Join Overlapping Points");
    out.b = [A.internals.length, P(L3), L3.segs.map(s => s.id), JSON.parse(JSON.stringify(S.seams[0].a[0]))];
    menu(20, 300, "Join Overlapping Points");
    out.c = [L5.closed, P(L5), L5.segs.length];
    menu(180, 100, "Join Overlapping Points"); out.none = toasts[toasts.length - 1];
    out.steps = steps(); app.checkDoc(S.pieces, S.seams);
    out.ids = ids; out.L3 = L3.id;
    return out;
  ` }).result;
  assert.deepStrictEqual(o.a, [4, true, [[20, 100], [100, 100], [180, 100]], [o.ids[0], o.ids[1]]], "end into start: one line, the meeting point where the line right-clicked had it");
  assert.deepStrictEqual(o.b.slice(0, 3), [3, [[20, 200], [100, 200], [180, 200]], [o.ids[2], o.ids[3]]], "end onto end: the other line turned round");
  const sm = o.b[3];
  assert.strictEqual(sm.shape, o.L3); assert.deepStrictEqual(sm.sids, [o.ids[3]]);
  near(sm.t0, 0.4, 1e-9); near(sm.t1, 0.8, 1e-9); assert.strictEqual(sm.rev, true, "its seam covers the same stretch, sewn the same way");
  assert.deepStrictEqual(o.c, [true, [[20, 300], [100, 300], [100, 350]], 3], "a line's own two ends: it closes");
  assert.ok(/lies on another line end/.test(o.none), o.none);
  assert.deepStrictEqual(o.steps, ["Join Overlapping Points", "Join Overlapping Points", "Join Overlapping Points"]);
});

test("r13 / 3: Align > Center / Middle on the point selected first and the point right-clicked moves both to one x / one y; then Join Overlapping Points joins them; Align with no first point says how", () => {
  const o = boot({ script: LINES + `
    const M1 = line([{x:20,y:150},{x:98,y:152}]), M2 = line([{x:103,y:149},{x:180,y:150}]);
    app.commit(); S.undo.length = 0;
    menu(103, 149, "Align ▸ Left"); out.noFirst = toasts[toasts.length - 1];
    app.setTool("edit_pattern"); click(98, 152);
    menu(103, 149, "Align ▸ Center");
    out.center = [P(M1)[1], P(M2)[0]];
    app.setTool("edit_pattern"); click(100.5, 152);
    menu(100.5, 149, "Align ▸ Middle");
    out.middle = [P(M1)[1], P(M2)[0]];
    menu(100.5, 150.5, "Join Overlapping Points");
    out.joined = [A.internals.length, P(A.internals[0])];
    out.steps = steps().filter(n => n !== "Edit Pattern");      // (a click with Edit Pattern is a step of its own, as before)
    return out;
  ` }).result;
  assert.ok(/select the first point/.test(o.noFirst), o.noFirst);
  assert.deepStrictEqual(o.center, [[100.5, 152], [100.5, 149]]);
  assert.deepStrictEqual(o.middle, [[100.5, 150.5], [100.5, 150.5]]);
  assert.deepStrictEqual(o.joined, [1, [[20, 150], [100.5, 150.5], [180, 150]]]);
  assert.deepStrictEqual(o.steps, ["Align", "Align", "Join Overlapping Points"]);
});

/* ---------- 4: Base Rectangle, Base Ellipse ---------- */
test("r13 / 4: Base Rectangle and Base Ellipse are built tools: a drag inside a pattern makes a dashed baseline of it (closed, four corners / an ellipse), one undo step; a click types the size with Replicate, into the pattern clicked or the selected one; with no pattern they say why", () => {
  const o = boot({ script: DOC + `
    const P = (sh) => sh.pts.map(q => [+q.x.toFixed(3), +q.y.toFixed(3)]);
    out.status = ["base_rectangle", "base_ellipse"].map(id => [app.TOOLS[id].off, app.TOOLS[id].st]);
    app.setTool("base_rectangle");
    const a = at(20, 40), b = at(120, 90);
    app.fire("pointermove", a); app.fire("pointerdown", a); app.fire("pointermove", { x: (a.x + b.x)/2, y: (a.y + b.y)/2 }); app.fire("pointermove", b); app.fire("pointerup", b);
    out.rect = [A.bases.length, A.bases[0] && P(A.bases[0]), A.bases[0] && A.bases[0].closed, S.sel[0] === A.id, steps()];
    // typed: two copies, 60 apart going right, into the pattern under the place
    app.setTool("base_ellipse");
    app.answer = (t, f) => { out.title = t; return { by: "diameter", dw: 30, dh: 20, rw: 15, rh: 10, c: 0, s: 60, a: 90, n: 2, link: false }; };      // (Round r15 / 4: 90° is to the right now; it was 0°)
    const q = at(50, 200); app.ev("shapeNumeric")({ x: 0, y: 0, sx: q.x, sy: q.y }, { x: 30, y: 200 });
    out.ell = [A.bases.length, A.bases.slice(1).map(sh => [sh.closed, sh.segs.length, +Math.min(...sh.pts.map(r => r.x)).toFixed(3), +Math.max(...sh.pts.map(r => r.x)).toFixed(3)]), steps().slice(-1)[0]];
    // outside every pattern, nothing selected: refused with the reason
    S.sel = []; app.setTool("base_rectangle"); const c = at(250, 500);
    app.fire("pointermove", c); app.fire("pointerdown", c); out.none = [toasts[toasts.length - 1], A.bases.length + B.bases.length];
    app.checkDoc(S.pieces, S.seams);
    return out;
  ` }).result;
  assert.deepStrictEqual(o.status, [[false, "built"], [false, "built"]]);
  assert.deepStrictEqual(o.rect, [1, [[20, 40], [120, 40], [120, 90], [20, 90]], true, true, ["Base Rectangle"]]);
  assert.strictEqual(o.title, "Create Ellipse");
  assert.deepStrictEqual(o.ell, [3, [[true, 4, 30, 60], [true, 4, 90, 120]], "Base Ellipse"]);
  // (Round r34 / 3: base lines are drawn only inside a pattern, the third session's wish; the message says so now. It was "attach to a pattern")
  assert.ok(/drawn inside a pattern/.test(o.none[0]), o.none[0]); assert.strictEqual(o.none[1], 3);
});

/* ---------- 5: Rotate ▸ X-Axis, Y-Axis ---------- */
test("r13 / 5: Rotate > Y-Axis on the pattern's menu, then a click on a line of it: the pattern turns (the smallest turn, one undo step) so that line is upright; X-Axis lays one level; a click off its lines keeps waiting, Esc gives it up; Parallel to stays not built", () => {
  const o = boot({ script: DOC + `
    const L = app.mkShape([{x:20,y:100},{x:120,y:150}], false); app.addChild(A, "internals", L); app.commit(); S.undo.length = 0;
    const dir = (sh) => { const [a, b] = [sh.pts[0], sh.pts[sh.pts.length - 1]]; return Math.atan2(b.y - a.y, b.x - a.x)*180/Math.PI; };
    const m = at(100, 300);
    out.rows = app.ev("patternMenu")(A, { x: 0, y: 0 }, { x: 100, y: 300 }, "").find(r => r && r.n === "Rotate").menu().filter(r => r && !r.sep).map(r => [r.n, !!r.nb]);
    app.menuClick(m.x, m.y, "Rotate ▸ Y-Axis", "transform_pattern"); out.waiting = !!S.rotAxis;
    click(150, 380); out.offLine = [!!S.rotAxis, toasts[toasts.length - 1]];
    click(70, 125);
    out.y = [+dir(A.internals[0]).toFixed(6), S.rotAxis, steps(), toasts[toasts.length - 1]];
    app.menuClick(m.x, m.y, "Rotate ▸ X-Axis", "transform_pattern");
    const mid = A.internals[0].pts.reduce((c, q) => ({ x: c.x + q.x/2, y: c.y + q.y/2 }), { x: 0, y: 0 });
    click(mid.x, mid.y);
    out.x = [+Math.abs(dir(A.internals[0])).toFixed(6) % 180, steps().length];
    app.menuClick(m.x, m.y, "Rotate ▸ Y-Axis", "transform_pattern"); app.key("Escape"); out.esc = S.rotAxis;
    return out;
  ` }).result;
  assert.deepStrictEqual(o.rows.slice(-3), [["X-Axis", false], ["Y-Axis", false], ["Parallel to…", false]]);      // (Parallel to… built in Round r17b / 1)
  assert.strictEqual(o.waiting, true);
  assert.deepStrictEqual(o.offLine[0], true); assert.ok(/Click a line/.test(o.offLine[1]), o.offLine[1]);
  // the line drops 50 in 100 on the screen (26.57° below level): to stand upright it turns 63.43° clockwise (90 the other way would be more)
  assert.strictEqual(Math.abs(o.y[0]), 90, "the line is upright: " + o.y[0]); assert.strictEqual(o.y[1], null);
  assert.deepStrictEqual(o.y[2], ["Rotate (Y-Axis)"]); assert.ok(/63.43° clockwise/.test(o.y[3]), o.y[3]);
  assert.strictEqual(o.x[0], 0, "and level again with X-Axis"); assert.strictEqual(o.x[1], 2);
  assert.strictEqual(o.esc, null);
});

/* ---------- 6: Paste with Interval and Number of Shapes ---------- */
test("r13 / 6: a right-click while a paste hangs on the pointer opens a box (Interval, Number of Shapes; every copy previewed): OK sets them all down in a row along the way it was moved, one undo step; Cancel leaves it on the pointer; an Instance Pattern the same; Shift keeps it on a 45° line too", () => {
  const o = boot({ script: DOC + `
    const mv = (x, y) => app.fire("pointermove", at(x, y)), c0 = (p) => { const b = app.ev("bboxOf")([p]); return [+((b.x0 + b.x1)/2).toFixed(3), +((b.y0 + b.y1)/2).toFixed(3)]; };
    const rclick = (x, y) => { const s = at(x, y); app.fire("contextmenu", { x: s.x, y: s.y }); };
    S.sel = [A.id]; app.key("c", { ctrlKey: true }); app.key("v", { ctrlKey: true }); mv(100, 700);
    // Cancel: still on the pointer
    app.answer = () => null; rclick(100, 700); out.cancel = [!!S.place, S.pieces.length];
    let seen = null;
    app.answer = (t, f, opts) => { seen = { t, f: f.map(x => [x.k, x.label, x.val]), pv: opts.preview({ s: 250, n: 3 }).length }; return { s: 250, n: 3 }; };
    rclick(100, 700);
    out.seen = seen; out.made = S.pieces.slice(2).map(p => [p.name, c0(p)]); out.steps = steps(); out.sel = S.sel.length;
    app.undo(); out.undone = S.pieces.length;
    // an Instance Pattern, twice; each linked to A
    S.sel = [A.id]; app.ev("linkedCopy")("instance"); mv(100, 800);
    app.answer = () => ({ s: 300, n: 2 }); rclick(100, 800);
    out.inst = S.pieces.slice(2).map(p => [p.link && p.link.kind, p.link && p.link.of === A.id, c0(p)]);
    // Shift: on the 45° line through where it came from (A's middle is 100, 200)
    S.sel = [A.id]; app.key("c", { ctrlKey: true }); app.key("v", { ctrlKey: true }); S.shift = true; click(400, 480); S.shift = false;
    out.diag = c0(S.pieces[S.pieces.length - 1]);
    return out;
  ` }).result;
  assert.deepStrictEqual(o.cancel, [true, 2]);
  assert.deepStrictEqual(o.seen.t, "Paste"); assert.deepStrictEqual(o.seen.f.map(x => x[1]), ["Interval", "Number of Shapes"]);
  assert.deepStrictEqual(o.seen.f[1][2], 1, "Number of Shapes opens at 1"); assert.deepStrictEqual(o.seen.f[0][2], 500, "Interval: the distance it was moved, from the original's middle to the copy's (Round r15 / 4, the check videos; it was half as much again as A's 400 height)");
  assert.strictEqual(o.seen.pv, 3, "every copy is previewed");
  assert.deepStrictEqual(o.made, [["A copy", [100, 700]], ["A copy", [100, 950]], ["A copy", [100, 1200]]], "250 apart, going on the way the pointer moved it");
  assert.deepStrictEqual(o.steps, ["Paste"]); assert.strictEqual(o.sel, 3); assert.strictEqual(o.undone, 2);
  assert.deepStrictEqual(o.inst, [["instance", true, [100, 800]], ["instance", true, [100, 1100]]]);
  near(o.diag[0] - 100, o.diag[1] - 200, 1e-6, "on the 45° line"); near(o.diag[0], 100 + (300 + 280)/2, 1e-6, "projected onto it");
});

/* ---------- 7: Edit Point of Measure ---------- */
test("r13 / 7: Edit Point of Measure: a click on a measurement selects it (Shift adds); its end dragged onto another point measures from there (one undo step), let go elsewhere nothing changes; Delete deletes the selected; Ctrl+A selects all; picking it shows the measurements", () => {
  const o = boot({ script: DOC + `
    const mk = app.ev("mkAnchor");
    S.measures.push({ id: 1, a: mk(A, A, 0), b: mk(A, A, 1), kind: "line" }, { id: 2, a: mk(B, B, 0), b: mk(B, B, 2), kind: "line" });
    app.commit(); S.undo.length = 0; S.show.measurements = false;
    const len = (id) => +app.ev("measureInfo")(S.measures.find(m => m.id === id), S.pieces).len.toFixed(3);
    out.status = [app.TOOLS.edit_pom.off, app.TOOLS.edit_pom.st];
    app.setTool("edit_pom"); out.shown = S.show.measurements; app.draw();
    click(100, 0); out.sel1 = S.selMeas.slice();
    // its end at (200, 0) dragged to the corner (200, 400)
    const e0 = at(200, 0), e1 = at(200, 400);
    app.fire("pointermove", e0); app.fire("pointerdown", e0); app.fire("pointermove", { x: e0.x, y: (e0.y + e1.y)/2 }); app.fire("pointermove", e1); app.fire("pointerup", e1);
    out.moved = [len(1), steps()];
    // dragged to nowhere: nothing changes
    app.draw(); const e2 = at(200, 400), e3 = at(250, 600);
    app.fire("pointermove", e2); app.fire("pointerdown", e2); app.fire("pointermove", e3); app.fire("pointerup", e3);
    out.nowhere = [len(1), steps().length, toasts[toasts.length - 1]];
    // Shift+click the other one: both selected; Delete
    app.draw(); click(400, 200, { shiftKey: true }); out.sel2 = S.selMeas.slice().sort();
    app.key("Delete"); out.deleted = [S.measures.length, steps().slice(-1)[0]];
    app.undo(); app.setTool("edit_pom"); app.key("a", { ctrlKey: true }); out.all = S.selMeas.slice().sort();
    return out;
  ` }).result;
  assert.deepStrictEqual(o.status, [false, "built"]); assert.strictEqual(o.shown, true);
  assert.deepStrictEqual(o.sel1, [1]);
  assert.deepStrictEqual(o.moved, [447.214, ["Edit Point of Measure"]], "from (0, 0) to (200, 400) now");
  assert.deepStrictEqual(o.nowhere.slice(0, 2), [447.214, 1]); assert.ok(/Let go on a point/.test(o.nowhere[2]), o.nowhere[2]);
  assert.deepStrictEqual(o.sel2, [1, 2]);
  assert.deepStrictEqual(o.deleted, [0, "Delete Point of Measure"]);
  assert.deepStrictEqual(o.all, [1, 2]);
});

/* ---------- 8: Hide Sewing (Selected), Show Sewing (All) ---------- */
test("r13 / 8: Hide Sewing (Selected) on Edit Sewing's menu hides the seam (still sewn, saved, not drawn or picked, marked in the Seams panel), one undo step; Show Sewing (All) on the menu or Settings > Display > Sewing shows every hidden seam again", () => {
  const o = boot({ script: DOC + `
    return (async () => {
      const part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
      S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }); app.commit(); S.undo.length = 0;
      let q = at(200, 200); const hitIt = () => !!app.ev("seamHit")(q.x, q.y);
      // Edit Sewing's own menu (cvMenu opens it with Edit Sewing in hand), a row clicked
      const sewRow = (p, name) => { app.setTool("edit_sewing"); app.menu.children.length = 0; app.ev("editSewMenu")(p.x, p.y, p.x, p.y); app.menu.children.find(c => c.innerHTML.includes("<span>" + name + "</span>")).onclick({ stopPropagation() {} }); };
      out.before = hitIt();
      sewRow(q, "Hide Sewing (Selected)");
      out.hidden = [S.seams[0].hide, S.seams.length, hitIt(), steps()];
      app.setTool("edit_sewing"); S.sel = [A.id]; app.ev("ui")(); out.panel = /hidden<\\/em>/.test(app.el("props").innerHTML);
      // saved and opened: still hidden
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      out.inFile = app.fileDoc(file).seams[0].hide;
      app.ev("openFile")("h.pdraft", file, null, true); await app.wait(() => toasts.some(x => /^Opened h/.test(x)), "the file to open");
      out.opened = S.seams[0].hide; q = at(200, 200);      // (opening fits the view again)
      // Display > Sewing: Show Sewing (All)
      const disp = app.ev("menuDisplay")(), sew = disp.find(x => x && x.n === "Sewing").menu().filter(Boolean);
      out.rows = sew.filter(x => /Sewing \\(/.test(x.n)).map(x => [x.n, !!x.off, !!x.nb]);
      sew.find(x => x.n === "Show Sewing (All)").f();
      out.shown = [S.seams[0].hide, hitIt(), steps().slice(-1)[0]];
      // hidden again, and shown from Edit Sewing's menu on the empty canvas
      sewRow(q, "Hide Sewing (Selected)");
      sewRow(at(250, 600), "Show Sewing (All)"); out.again = S.seams[0].hide;
      return out;
    })();
  ` }).result;
  assert.strictEqual(o.before, true);
  assert.deepStrictEqual(o.hidden, [true, 1, false, ["Hide Sewing"]], "hidden, still there, not picked");
  assert.strictEqual(o.panel, true, "the Seams panel says so");
  assert.strictEqual(o.inFile, true); assert.strictEqual(o.opened, true);
  assert.deepStrictEqual(o.rows, [["Hide Sewing (Selected)", true, false], ["Show Sewing (All)", false, false]], "real rows (Hide greyed with no seam selected)");
  assert.deepStrictEqual(o.shown, [null, true, "Show Sewing (All)"]);      // (no hide: undefined, null in JSON)
  assert.strictEqual(o.again, undefined);
});

test("r13 / 8: a hidden seam is left out of the 3D window's sewing lines and still goes to the simulation", () => {
  const o = boot({ blank: true, three: true, script: SEWN + `
    const n = () => app.ev("ov3Seams")().length;
    out.before = n(); S.seams[0].hide = true; app.commit(); out.after = n();
    out.sim = app.ev("simSeams")(S.pieces.filter(p => p.on).map(p => p.id)).length;
    return out;
  ` }).result;
  assert.ok(o.after < o.before, o.before + " → " + o.after);
  assert.strictEqual(o.sim, 2, "both seams are still sewn");
});

/* ---------- 9: Print Layout: Buffer Spacing, Marker Length, Remnant, Tape Measure ---------- */
test("r13 / 9: Buffer Spacing turns with the pattern, grows its nesting mask on each side, and keeps nested patterns that far apart; it is kept in the layout (linked by default)", () => {
  const o = boot({ blank: true, script: `
    const tb = app.ev("turnBuffer"), B = { l: 1, r: 2, t: 3, b: 4 };
    const out = { turns: [tb(B, 0, false), tb(B, 90, false), tb(B, 180, false), tb(B, 0, true)] };
    const m = app.ev("growMask")({ w: 1, h: 1, rows: [1n] }, 1, 2, 1, 0); out.mask = [m.w, m.h, m.rows.map(String)];
    const sq = (x) => [{ x, y: 0 }, { x: x + 100, y: 0 }, { x: x + 100, y: 100 }, { x, y: 100 }];
    const pack = (buffer) => app.ev("nestPack")([{ key: "a", poly: sq(0) }, { key: "b", poly: sq(0) }], 1000, { gap: 0, rots: [0], buffer });
    const p0 = pack(null).place, p1 = pack({ l: 20, r: 20, t: 0, b: 0 }).place;
    out.plain = [p0.a.x, p0.b.x].sort((a, b) => a - b); out.buf = [p1.a.x, p1.b.x].sort((a, b) => a - b);
    out.norm = [app.ev("normLayout")(null).buffer, app.ev("normLayout")({ buffer: { l: "5", r: -3, t: 500, link: false } }).buffer];
    return out;` }).result;
  assert.deepStrictEqual(o.turns, [{ l: 1, r: 2, t: 3, b: 4 }, { l: 4, r: 3, t: 1, b: 2 }, { l: 2, r: 1, t: 4, b: 3 }, { l: 2, r: 1, t: 3, b: 4 }], "a quarter turn clockwise brings the bottom to the left; a mirror swaps left and right");
  assert.deepStrictEqual(o.mask, [4, 2, ["15", "15"]], "one cell grown to 4 × 2: one to the left, two to the right, one up");
  assert.ok(o.plain[0] < 1e-9 && o.plain[1] - o.plain[0] < 120, "without a buffer side by side: " + o.plain);
  assert.ok(o.buf[0] >= 20 - 1e-9, "its own left buffer from the edge: " + o.buf[0]);
  assert.ok(o.buf[1] - o.buf[0] >= 100 + 40 - 1e-9, "and both buffers between them: " + o.buf);
  assert.deepStrictEqual(o.norm, [{ l: 0, r: 0, t: 0, b: 0, link: true }, { l: 5, r: 0, t: 100, b: 0, link: false }]);
});

test("r13 / 9: Print Layout's Property Editor has Buffer Spacing (four sides, Link) and Marker Length and Remnant; a linked value goes to all four, one undo step; the Tape Measure (Point-to-Point) on the vertical bar measures between two clicks, catching pattern points, and Esc clears it", () => {
  const o = boot({ script: DOC + `
    app.ev("setMode")("layout"); app.ev("ui")();
    const html = app.el("props").innerHTML;
    out.rows = ["Buffer Spacing", "Marker Length", "Remnant", 'id="ly-bf-l"', 'id="ly-bf-link"'].map(t => html.includes(t));
    const el = app.el("ly-bf-t"); el.value = "15"; el.onchange();
    out.buffer = JSON.parse(JSON.stringify(app.ev("layoutOf")().buffer)); out.steps = steps();
    // the tape: two pattern corners as they lie on the layout
    app.ev("layTape")(true);
    const ps = app.ev("layoutPieces")(), a = ps[0].piece.pts[0], b = ps[0].piece.pts[2], lS = app.ev("lS");
    const s1 = lS(a), s2 = lS(b);
    app.ev("layTapeClick")(s1.x + 3, s1.y - 2); app.ev("layTapeClick")(s2.x, s2.y);
    out.tape = [+Math.hypot(S.layTape.b.x - S.layTape.a.x, S.layTape.b.y - S.layTape.a.y).toFixed(3), toasts[toasts.length - 1], steps().length];
    app.key("Escape"); out.esc = S.layTape;
    return out;
  ` }).result;
  assert.deepStrictEqual(o.rows, [true, true, true, true, true]);
  assert.deepStrictEqual(o.buffer, { l: 15, r: 15, t: 15, b: 15, link: true }, "linked: one value to all four");
  assert.strictEqual(o.steps.length, 1, "one undo step");
  near(o.tape[0], Math.hypot(200, 400), 1e-3, "corner to corner, caught 3 px off"); assert.ok(/^Distance: /.test(o.tape[1]), o.tape[1]);
  assert.strictEqual(o.tape[2], 1, "nothing in the history"); assert.strictEqual(o.esc, null);
});

module.exports = T;
