// Round perf-2: big files fast. Batch 1: a click that only selects runs no document update and takes no undo step of the
// document; a drag's step is taken when it first moves, and the steps are what they were.
"use strict";
const FV = require("./harness").FILE_VERSION;      // (Round H1) this build's file version, read from the app's FILE_VERSION
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms = 60000) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: ms, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after " + ms/1000 + " s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// the marks count push() and commit(); the starter pattern, its first point's screen place, a click (down and up, no move)
const FLAG = { performance: true, storage: { "pdraft:flags": JSON.stringify({ perf: true }) } };
const LIB = `
  const P = app.ev("window.drafterPerf")(), n = (k) => (P.report().find(r => r.name === k) || { n: 0 }).n;
  const p = S.pieces[0], snap = () => app.ev("snap()");
  const click = (q) => { app.fire("pointermove", { x: q.x, y: q.y }); app.fire("pointerdown", { x: q.x, y: q.y }); app.fire("pointerup", { x: q.x, y: q.y }); };
  const drag = (q, dx, dy) => { app.fire("pointermove", { x: q.x, y: q.y }); app.fire("pointerdown", { x: q.x, y: q.y }); app.fire("pointermove", { x: q.x + dx/2, y: q.y + dy/2 }); app.fire("pointermove", { x: q.x + dx, y: q.y + dy }); app.fire("pointerup", { x: q.x + dx, y: q.y + dy }); };
  const mid = (i) => app.toS(app.segPt(p, i, 0.5)), pt = (i) => app.toS(p.pts[i]);
  app.setTool("edit_pattern"); S.sel = []; app.draw();
`;

test("perf-2 / 1: a click on a line or a point that only selects calls neither commit() nor push(), keeps the undo and redo lists, and selects", () => {
  const o = boot({ ...FLAG, script: LIB + `
    // a step to undo, so that there is a redo list a click must leave alone
    app.ev("push")("Rename"); p.name = "Renamed"; app.commit(); app.undo();
    const u0 = S.undo.length, r0 = S.redo.length, doc0 = snap();
    P.reset();
    click(mid(1));
    const line = { sel: S.sel.slice(), seg: S.selSeg, kind: S.selKind, commits: n("commit"), pushes: n("push"), draws: n("draw") };
    P.reset();
    click(pt(2));
    const point = { selPt: S.selPt, commits: n("commit"), pushes: n("push") };
    return { line, point, steps: [S.undo.length - u0, S.redo.length - r0], same: snap() === doc0, dirty: S.dirty };
  ` }).result;
  assert.deepStrictEqual(o.line.sel.length, 1); assert.strictEqual(o.line.seg, 1); assert.strictEqual(o.line.kind, "outline");
  assert.deepStrictEqual([o.line.commits, o.line.pushes], [0, 0], "a selecting click on a line: no commit, no push");
  assert.ok(o.line.draws >= 1, "it is drawn");
  assert.strictEqual(o.point.selPt, 2); assert.deepStrictEqual([o.point.commits, o.point.pushes], [0, 0], "a selecting click on a point: no commit, no push");
  assert.deepStrictEqual(o.steps, [0, 0], "undo and redo lists as they were");
  assert.strictEqual(o.same, true);
});

test("perf-2 / 1: a drag of a point, of a line and of a curvature makes one step; undo and redo give exactly the documents before and after", () => {
  const o = boot({ ...FLAG, script: LIB + `
    const out = [];
    const one = (name, setup, q, dx, dy) => {
      setup(); const u0 = S.undo.length, before = snap();
      drag(q(), dx, dy);
      const after = snap(), made = S.undo.length - u0, step = S.un[S.un.length - 1].n;
      app.undo(); const back = snap(); app.redo(); const again = snap();
      out.push({ name, made, step, changed: after !== before, back: back === before, again: again === after, redo: S.redo.length });
    };
    one("point", () => { app.setTool("edit_pattern"); S.sel = [p.id]; }, () => pt(2), 30, 20);
    one("line", () => { app.setTool("edit_pattern"); S.sel = [p.id]; }, () => mid(0), 10, 25);
    one("curvature", () => { app.setTool("edit_curvature"); S.sel = [p.id]; }, () => mid(2), 15, 30);
    return out;
  ` }).result;
  for (const r of o) {
    assert.deepStrictEqual([r.made, r.changed, r.back, r.again, r.redo], [1, true, true, true, 0], JSON.stringify(r));
  }
  assert.strictEqual(o[0].step, "Edit Pattern");
});

test("perf-2 / 1: a press without a move on Edit Curvature or a point makes no step and no commit; Undo pressed while a press waits undoes nothing of the earlier steps", () => {
  const o = boot({ ...FLAG, script: LIB + `
    app.ev("push")("Rename"); p.name = "Renamed"; app.commit();
    const u0 = S.undo.length;
    app.setTool("edit_curvature"); S.sel = [p.id]; P.reset();
    click(mid(2));
    const curv = [S.undo.length - u0, n("commit"), n("push")];
    // the pointer goes down on a point and Undo comes before it moves: the press's own step is taken back (nothing changed);
    // the rename stays, as it did when the press took its step at once
    app.setTool("edit_pattern"); S.sel = [p.id];
    const q = pt(2); app.fire("pointermove", { x: q.x, y: q.y }); app.fire("pointerdown", { x: q.x, y: q.y });
    app.undo();
    const mid1 = [S.undo.length - u0, p.name === "Renamed" || S.pieces[0].name === "Renamed"];
    app.fire("pointerup", { x: q.x, y: q.y });
    return { curv, mid1, name: S.pieces[0].name };
  ` }).result;
  assert.deepStrictEqual(o.curv, [0, 0, 0]);
  assert.deepStrictEqual(o.mid1, [0, true], "Undo took the waiting press step, not the rename");
  assert.strictEqual(o.name, "Renamed");
});

/* ---- Batch 2: the geometry caches ---- */
// every cache against a fresh calculation, as JSON: the seam allowance and the notch marks of every pattern, every seam's lengths,
// every part's drawing, the lanes, the dart warnings, a pattern by id. checks(label) adds one entry per kind; bad lists any that differ
const CACHE = `
  const ev = app.ev, J = JSON.stringify, bad = [], counts = {};
  const checks = (label) => {
    const note = (kind, ok, what) => { counts[kind] = (counts[kind] || 0) + 1; if (!ok) bad.push(label + ": " + kind + " " + what); };
    for (const p of S.pieces) {
      note("cutLine", J(ev("cutLine")(p)) === J(ev("cutLineFresh")(p)), p.name);
      for (const st of [S.notch, { ...S.notch, dup: false }]) note("notchMarks", J(ev("notchMarks")(p, st)) === J(ev("notchMarksFresh")(p, st)), p.name);
      note("pieceOf", ev("pieceOf")(S.pieces, p.id) === S.pieces.find(q => q.id === p.id), p.name);
    }
    for (const sm of S.seams) {
      note("seamInfo", J(ev("seamInfo")(sm, S.pieces)) === J(ev("seamInfoFresh")(sm, S.pieces)), "seam " + sm.id);
      for (const part of ev("seamParts")(sm)) { const X = ev("seamSide")(part, S.pieces); if (X) note("partGeom", J(ev("partGeom")(X, part)) === J(ev("partGeomFresh")(X, part)), "seam " + sm.id); }
    }
    const L = ev("seamLanes")(S.seams), L2 = ev("seamLanesFresh")(S.seams);
    note("seamLanes", S.seams.flatMap(ev("seamParts")).every(q => L.get(q) === L2.get(q)), "");
    note("seamDartWarnings", J(ev("seamDartWarnings")(S.seams, S.pieces)) === J(ev("seamDartWarningsFresh")(S.seams, S.pieces)), "");
  };
  // the skirt block (darts, M:N waist seams) and the T-shirt, added as File > Add > Project adds them
  S.pieces.length = 0; S.seams.length = 0;
  // (the skirt example is graded on its size run: with its size group the document keeps the grading, so a graded size can be checked)
  S.grading = JSON.parse(J(ev("PATTERN_EXAMPLES")[0].doc.grading));
  for (const ex of ev("PATTERN_EXAMPLES").slice(0, 2)) ev("addDocument")(ex.name, JSON.parse(J(ex.doc)));
  for (const p of S.pieces) p.segs.forEach((sg, i) => { sg.sa = 10; if (i % 3 === 1) sg.corner = { t: ["perp", "turn", "slant", "round", "env"][i % 5], ...(i % 5 === 3 ? { r: 6 } : {}) }; if (!sg.notches.length) sg.notches.push(0.4); });
  app.commit(); app.setTool("edit_pattern"); app.draw();
`;
test("perf-2 / 2: every geometry cache gives what a fresh calculation gives: after drawing, a point dragged, the allowance, a corner type, a notch, undo, redo", () => {
  const o = boot({ script: CACHE + `
    checks("drawn");
    const p = S.pieces[0], q = app.toS(p.pts[2]);
    S.sel = [p.id]; app.draw();
    app.fire("pointermove", { x: q.x, y: q.y }); app.fire("pointerdown", { x: q.x, y: q.y }); app.fire("pointermove", { x: q.x + 20, y: q.y + 12 });
    checks("while a point is dragged");
    app.fire("pointerup", { x: q.x + 20, y: q.y + 12 });
    checks("a point dragged");
    app.ev("push")(); p.segs[1].sa = 25; app.commit(); checks("an allowance changed");
    app.ev("push")(); p.segs[2].corner = { t: "round", r: 12 }; app.commit(); checks("a corner type changed");
    app.ev("push")(); p.segs[0].notches.push(0.8); app.commit(); checks("a notch added");
    app.ev("push")(); p.segs[0].notches[0] = { t: 0.3, type: "V", angle: 20 }; app.commit(); checks("a notch's own look");
    // a point moved in place with no commit and no step (as a drag does between frames): the next frame sees it
    p.pts[1].x += 7; app.draw(); checks("a point moved in place");
    app.undo(); checks("undo"); app.undo(); checks("undo twice"); app.redo(); checks("redo");
    return { bad, counts };
  ` }).result;
  assert.deepStrictEqual(o.bad, []);
  assert.ok(o.counts.cutLine >= 8*10 && o.counts.seamInfo > 50 && o.counts.partGeom > 100, JSON.stringify(o.counts));
});

test("perf-2 / 2: the caches after a file is opened, a size picked in grading, the unit changed, and the seams edited", () => {
  const o = boot({ streams: true, script: "return (async () => {" + CACHE + `
    checks("drawn");
    // the document saved and opened again: new objects, the same shapes
    let got = null; app.setDownload((n, d) => { got = d; }); app.saveDoc(false); await app.wait(() => got, "the file");
    const was = S.pieces[0]; app.ev("openFile")("x.pdraft", got, null, true); await app.wait(() => S.pieces.length && S.pieces[0] !== was, "opened");
    await new Promise(r => setTimeout(r, 50)); app.draw();
    checks("opened");
    // a graded size is a copy (gradedPiece()): its cut line is its own
    // (the skirt block is graded on its size run: a size other than the base gives a copy)
    // the first pattern graded proportionally (its dialog answered: 24 × 12 mm a size), then size L (id 4) as a copy
    const gp = S.pieces[0];
    app.answer = () => ({ w: 24, h: 12 }); app.ev("proportionalNumeric")({ x: 0, y: 0 }, gp); app.answer = null;
    const g = app.gradedPiece(S.grading, S.pieces.find(q => q.id === gp.id), 4);
    if (!g) bad.push("no graded copy to check");
    if (g) { const J = JSON.stringify; if (J(app.ev("cutLine")(g)) !== J(app.ev("cutLineFresh")(g))) bad.push("a graded copy's cut line"); }
    S.unit = "in"; app.draw(); checks("unit inches"); S.unit = "mm";
    // a seam's part shortened in place (as Edit Sewing drags its end), and a seam deleted
    const sm = S.seams.find(x => x.a[0].sids.length === 1);
    sm.a[0].t1 = 0.6; app.draw(); checks("a seam's part shortened");
    app.ev("push")(); S.seams.splice(S.seams.indexOf(sm), 1); app.commit(); checks("a seam deleted");
    return { bad, n: S.pieces.length };
  ` + "})();" }).result;
  assert.deepStrictEqual(o.bad, []);
  assert.ok(o.n >= 8);
});

test("perf-2 / 2: a cached seam allowance cannot be changed by whoever asks for it (frozen)", () => {
  const o = boot({ script: `const p = S.pieces[0]; p.segs.forEach(s => s.sa = 10); app.commit(); const c = app.ev("cutLine")(p); let threw = false; try { c.push({ x: 0, y: 0 }); } catch (e) { threw = true; } return [Object.isFrozen(c), threw, app.ev("cutLine")(p) === c];` }).result;
  assert.deepStrictEqual(o, [true, true, true]);
});

/* ---- Batch 3: drawing ---- */
// a document of many patterns (the two examples ten times, in a grid), Edit Pattern
const MANY = `
  const ev = app.ev, J = JSON.stringify, V = ev("V");
  S.pieces.length = 0; S.seams.length = 0;
  for (let k = 0; k < 10; k++) for (const ex of ev("PATTERN_EXAMPLES").slice(0, 2)) {
    const before = new Set(S.pieces.map(p => p.id)); ev("addDocument")(ex.name, JSON.parse(J(ex.doc)));
    for (const p of S.pieces.filter(p => !before.has(p.id))) ev("mapPiece")(p, (q) => V(q.x + (k % 5)*3200, q.y + Math.floor(k/5)*1600 + (ex.id === "tshirt-marty" ? 3200 : 0)));
  }
  for (const p of S.pieces) p.segs.forEach((sg, i) => { sg.sa = 10; if (i % 3 === 1) sg.corner = { t: "perp", on: "in" }; });
  app.commit(); app.setTool("edit_pattern"); S.sel = []; ev("fitAll")(); app.draw();
`;
test("perf-2 / 3: picking and snapping look only at the patterns near the place, and find what looking at every pattern finds", () => {
  const o = boot({ script: MANY + `
    const out = [], bad = [];
    const probe = (label) => {
      const at = [];
      for (let k = 0; k < 100; k++) at.push({ x: (k*37) % 1000, y: (k*53) % 800 });
      for (const s of S.pieces.slice(0, 20)) for (const i of [0, 1, 2]) { const q = app.toS(s.pts[i % s.pts.length]); at.push({ x: q.x + 2, y: q.y - 1 }); const m = app.toS(app.segPt(s, i % s.segs.length, 0.5)); at.push({ x: m.x + 3, y: m.y + 3 }); }
      for (const q of at) {
        S.mouse = { x: app.toW(q.x, q.y).x, y: app.toW(q.x, q.y).y, sx: q.x, sy: q.y };
        const pick = (h) => h && J([h.k, h.p && h.p.id, h.kind, h.int, h.i, h.c, h.t && +h.t.toFixed(9)]);
        for (const [name, f] of [["hit", () => pick(app.hit(q.x, q.y))], ["hit (menu)", () => pick(app.hit(q.x, q.y, { menu: true }))], ["pieceAt", () => (ev("pieceAt")(q.x, q.y) || {}).id],
          ["snapW", () => ev("snapW")(app.toW(q.x, q.y), null, true)], ["drawSnap", () => [ev("drawSnap")(app.toW(q.x, q.y), null, {}), S.snapMark && S.snapMark.kind]]]) {
          let a, b;
          try { a = J(f()); } finally {}
          ev("near = (l) => l.slice()"); try { b = J(f()); } finally { ev("near = globalThis.__n"); }
          out.push(name); if (a !== b) bad.push(label + " " + name + " at " + q.x + "," + q.y + ": " + a + " / " + b);
        }
      }
    };
    ev("globalThis.__n = near");                               // (kept inside the page, where the app can be given it back)
    probe("fit all");
    app.ev("zoomTo")(S.pieces.slice(0, 4)); app.draw(); probe("one garment");
    // a point moved in place, no commit: the box sees it at once
    S.pieces[1].pts[0].x -= 300; S.pieces[1].pts[0].y -= 200; probe("a point moved in place");
    app.setTool("edit_curve_point"); probe("Edit Curve Point");
    return { n: out.length, bad: bad.slice(0, 8), hits: out.length };
  ` }, 180000).result;             // (about half a minute: every place picked twice, on 80 patterns)
  assert.deepStrictEqual(o.bad, []);
  assert.ok(o.n > 4000, "places compared: " + o.n);
});

test("perf-2 / 3: patterns outside the window are not drawn, and what reaches the window is drawn exactly as when every pattern is drawn", () => {
  const o = boot({ script: MANY + `
    const cx = app.ev("ctx"), W = 1000, H = 800, rec = [];
    // every line, arc, box and text that reaches the window, in screen pixels (the transform of a turned name is followed)
    let T = [1, 0, 0, 1, 0, 0], stackT = [], last = null;
    const tp = (x, y) => [T[0]*x + T[2]*y + T[4], T[1]*x + T[3]*y + T[5]];
    const inWin = (pts, r) => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return Math.max(...xs) + r >= 0 && Math.min(...xs) - r <= W && Math.max(...ys) + r >= 0 && Math.min(...ys) - r <= H; };
    const put = (kind, pts, r) => { if (inWin(pts, r)) rec.push(kind + ":" + pts.map(p => p.map(v => v.toFixed(2)).join(",")).join(" ")); };
    cx.save = () => { stackT.push(T.slice()); }; cx.restore = () => { T = stackT.pop() || [1, 0, 0, 1, 0, 0]; };
    cx.translate = (x, y) => { T[4] += T[0]*x + T[2]*y; T[5] += T[1]*x + T[3]*y; };
    cx.rotate = (a) => { const c = Math.cos(a), s = Math.sin(a), [a0, b0, c0, d0] = T; T[0] = a0*c + c0*s; T[1] = b0*c + d0*s; T[2] = -a0*s + c0*c; T[3] = -b0*s + d0*c; };
    cx.moveTo = (x, y) => { last = tp(x, y); }; cx.lineTo = (x, y) => { const p = tp(x, y); put("line", [last, p], 4); last = p; };
    cx.bezierCurveTo = (a, b, c, d, x, y) => { const p = tp(x, y); put("curve", [last, tp(a, b), tp(c, d), p], 4); last = p; };
    cx.arc = (x, y, r) => put("arc", [tp(x, y)], r + 2);
    cx.rect = (x, y, w, h) => put("rect", [tp(x, y), tp(x + w, y + h)], 2); cx.fillRect = cx.rect; cx.strokeRect = cx.rect;
    cx.fillText = (t, x, y) => put("text " + t, [tp(x, y)], 40); cx.strokeText = cx.fillText;
    const frame = () => { rec.length = 0; T = [1, 0, 0, 1, 0, 0]; app.draw(); return rec.slice().sort(); };
    const out = [], bad = [];
    const iv = app.ev("inView");
    for (const [label, view] of [["fit all", null], ["one garment", S.pieces.slice(0, 4)], ["one pattern", S.pieces.slice(5, 6)], ["between garments", S.pieces.slice(8, 12)]]) {
      if (view) app.ev("zoomTo")(view); else app.ev("fitAll")();
      for (const sewing of [true, false]) {
        S.show.sewing = sewing; S.view.x += 37;
        const culled = S.pieces.filter(p => !iv(p)).length, a = frame();
        app.ev("globalThis.__iv = inView"); app.ev("inView = () => true"); const b = frame(); app.ev("inView = globalThis.__iv");
        out.push([label, sewing, culled, a.length]);
        if (J(a) !== J(b)) { const A = new Set(a), B = new Set(b); bad.push(label + " (sewing " + sewing + "): only culled " + a.filter(x => !B.has(x)).slice(0, 3).join(" | ") + " ; only all " + b.filter(x => !A.has(x)).slice(0, 3).join(" | ")); }
      }
    }
    return { out, bad };
  ` }).result;
  assert.deepStrictEqual(o.bad, []);
  assert.ok(o.out.some(r => r[2] > 20), "patterns were left out somewhere: " + JSON.stringify(o.out));
});

test("perf-2 / 3: what the pointer changes asks for one frame, drawn at the next screen frame; draw() draws at once; a press draws a waiting frame first", () => {
  const o = boot({ ...FLAG, script: `
    // (a screen frame stood in for inside the page: what is asked for waits in q until run())
    app.ev("globalThis.__q = []; globalThis.requestAnimationFrame = (f) => { __q.push(f); return __q.length; }; globalThis.cancelAnimationFrame = () => {}");
    const q = app.ev("__q"), P = app.ev("window.drafterPerf")(), n = () => (P.report().find(r => r.name === "draw") || { n: 0 }).n;
    const run = () => { const fs = q.splice(0); for (const f of fs) f(); };
    app.setTool("edit_pattern"); app.draw(); run(); P.reset();
    for (let k = 0; k < 5; k++) app.fire("pointermove", { x: 300 + k*4, y: 300 });
    const asked = [n(), q.length];
    run(); const one = n();
    app.fire("pointermove", { x: 340, y: 300 }); const before = n();
    app.fire("pointerdown", { x: 340, y: 300 }); const atPress = n();
    app.fire("pointerup", { x: 340, y: 300 }); run();
    P.reset(); app.draw(); const now = n();
    return { asked, one, before, atPress, now };
  ` }).result;
  assert.deepStrictEqual(o.asked, [0, 1], "five moves: nothing drawn yet, one frame asked for");
  assert.strictEqual(o.one, 1, "the frame drawn once");
  assert.ok(o.atPress > o.before, "the press drew the waiting frame first");
  assert.strictEqual(o.now, 1, "draw() draws at once");
});

/* ---- Batch 4: the cloth's self-collision ---- */
const C = require("../drafter-sim.js");
// a w × h sheet as the program meshes a pattern, and its points laid out by f(x, y) -> [x, y, z]
function sheet(w, h, res, x0 = 0, y0 = 0) {
  const pts = [], nx = Math.round(w/res), ny = Math.round(h/res);
  for (let i = 0; i < nx; i++) pts.push([x0 + i*res, y0]); for (let j = 0; j < ny; j++) pts.push([x0 + w, y0 + j*res]);
  for (let i = 0; i < nx; i++) pts.push([x0 + w - i*res, y0 + h]); for (let j = 0; j < ny; j++) pts.push([x0, y0 + h - j*res]);
  return C.meshPolygon(pts, res);
}
const lay = (m, f) => { const X = new Float32Array(3*(m.xy.length >> 1)); for (let v = 0; v < m.xy.length >> 1; v++) X.set(f(m.xy[2*v], m.xy[2*v+1]), 3*v); return X; };
// the pairs as the search made them before Round perf-2 (every point within the reach, of a pattern too, unless within 1.2 × the
// collision distance on the pattern), with the same reach and the same cells (the reach from the speeds relative to the mean
// velocity, as the search has it now: what is compared is which pairs it leaves out)
function pairsBefore(sim, dt) {
  const n = sim.n, d = sim.opt.selfDist, x = sim.x, sp = new Float32Array(n);
  let mx = 0, my = 0, mz = 0, mw = 0;
  for (let i = 0; i < n; i++) if (sim.w[i] > 0) { mx += sim.v[3*i]; my += sim.v[3*i+1]; mz += sim.v[3*i+2]; mw++; }
  if (mw) { mx /= mw; my /= mw; mz /= mw; }
  for (let i = 0; i < n; i++) sp[i] = Math.abs(sim.v[3*i] - mx) + Math.abs(sim.v[3*i+1] - my) + Math.abs(sim.v[3*i+2] - mz);
  const s = Array.from(sp).sort((a, b) => a - b), vm = s[Math.floor(0.99*(n - 1))];          // (the solver's quantile(): element floor(q·(n−1)))
  const reach = Math.min(5*d, 1.3*d + 2*vm*dt), r2 = reach*reach, flat = (1.2*d)*(1.2*d), out = new Set();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = x[3*j] - x[3*i], dy = x[3*j+1] - x[3*i+1], dz = x[3*j+2] - x[3*i+2];
    if (dx*dx + dy*dy + dz*dz > r2) continue;
    if (sim.piece[i] === sim.piece[j]) { const fx = sim.rest[2*i] - sim.rest[2*j], fy = sim.rest[2*i+1] - sim.rest[2*j+1]; if (fx*fx + fy*fy < flat) continue; }
    if (sim.noHit.has(i*n + j) || (sim.w[i] === 0 && sim.w[j] === 0)) continue;
    out.add(i*n + j);
  }
  return { out, reach };
}
const pairsNow = (sim, dt) => { C.selfPairs(sim, dt); const out = new Set(); for (let c = 0; c < sim.nPairs; c++) out.add(sim.pairs[2*c]*sim.n + sim.pairs[2*c+1]); return out; };

test("perf-2 / 4: the pairs are the ones found before less the same pattern's neighbours (no further apart on the pattern than now plus the collision distance); every pair between patterns and layers stays", () => {
  const A = sheet(200, 200, 10), B = sheet(200, 200, 10), F = sheet(400, 40, 10);
  // A flat; B a second layer 5 mm above it and moving; F a strip folded back on itself, its second half 6 mm above its first
  const sim = C.clothBuild({ pieces: [
    { xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 500, y]) },
    { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x + 3, 505, y + 4]), layer: 1 },
    { xy: F.xy, tri: F.tri, X: lay(F, (x, y) => (x <= 200 ? [x + 600, 500, y] : [1000 - x, 506, y])) }], opt: { ground: false } });
  for (let i = 0; i < sim.n; i++) { sim.v[3*i+1] = sim.piece[i] === 1 ? -900 : 0; }       // a layer coming down: a wider reach
  const dt = 1/60, before = pairsBefore(sim, dt).out, now = pairsNow(sim, dt), d = sim.opt.selfDist;
  let left = 0, across = 0, fold = 0, keptSame = 0;
  for (const k of now) assert.ok(before.has(k), "a pair the search did not find before: " + k);
  for (const k of before) {
    const i = Math.floor(k/sim.n), j = k % sim.n;
    if (sim.piece[i] !== sim.piece[j]) { assert.ok(now.has(k), "a pair between patterns was left out"); across++; continue; }
    const fx = sim.rest[2*i] - sim.rest[2*j], fy = sim.rest[2*i+1] - sim.rest[2*j+1], cur = Math.hypot(sim.x[3*i] - sim.x[3*j], sim.x[3*i+1] - sim.x[3*j+1], sim.x[3*i+2] - sim.x[3*j+2]);
    const neighbours = Math.hypot(fx, fy) <= cur + d;
    assert.strictEqual(now.has(k), !neighbours, "pair " + i + "-" + j + ": on the pattern " + Math.hypot(fx, fy).toFixed(1) + ", now " + cur.toFixed(1));
    if (neighbours) left++; else { keptSame++; if (sim.piece[i] === 2) fold++; }
  }
  assert.ok(across > 300, "pairs between the two layers: " + across);
  assert.ok(fold > 40, "the strip's two halves, brought together by its fold: " + fold);
  assert.ok(left > 5*keptSame, "within a pattern, the neighbours were most of the pairs: " + left + " left out, " + keptSame + " kept");
});

test("perf-2 / 4: cloth moving as a whole is searched as cloth at rest (the reach is the collision distance); a layer coming down onto one at rest is still searched as far as its speed reaches", () => {
  const A = sheet(200, 200, 10), B = sheet(200, 200, 10);
  const build = () => C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 500, y]) }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x + 3, 512, y + 4]) }], opt: { ground: false } });
  const rest = build(), whole = build(), onto = build();
  for (let i = 0; i < whole.n; i++) { whole.v[3*i+1] = -4000; whole.v[3*i] = 700; }
  for (let i = 0; i < onto.n; i++) onto.v[3*i+1] = onto.piece[i] === 1 ? -4000 : 0;
  const P = (sim) => [...pairsNow(sim, 1/60)].sort().join();
  assert.strictEqual(P(whole), P(rest), "falling as a whole: the same pairs as at rest");
  const n0 = pairsNow(rest, 1/60).size, n1 = pairsNow(onto, 1/60).size;
  assert.ok(n1 > 2*n0, "a layer coming down onto one at rest: searched further (" + n1 + " pairs, at rest " + n0 + ")");
});

test("perf-2 / 4: the pair buffer grows as it must (it starts at 2 here) and holds every pair", () => {
  const A = sheet(200, 200, 10), B = sheet(200, 200, 10);
  const sim = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 500, y]) }, { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x, 504, y]) }], opt: { ground: false } });
  const want = pairsNow(sim, 1/60);
  sim.pairBuf = new Int32Array(2);
  const got = pairsNow(sim, 1/60);
  assert.ok(sim.pairs.length >= 2*sim.nPairs && sim.nPairs > 400);
  assert.deepStrictEqual([...got].sort(), [...want].sort());
});

test("perf-2 / 4: two layers dropped on the floor stay layered, and two patterns that overlap side by side stay apart, at the collision distance", () => {
  const res = 10, A = sheet(200, 200, res), B = sheet(200, 200, res), D = sheet(200, 200, res);
  const sim = C.clothBuild({ pieces: [
    { xy: A.xy, tri: A.tri, X: lay(A, (x, y) => [x, 60, y]), fab: { thick: 2.5 } },
    { xy: B.xy, tri: B.tri, X: lay(B, (x, y) => [x + 5, 80, y + 5]), fab: { thick: 2.5 }, layer: 1 },
    { xy: D.xy, tri: D.tri, X: lay(D, (x, y) => [x + 150, 120, y + 50]), fab: { thick: 2.5 } }], opt: { easeIn: 0 } });
  for (let f = 0; f < 150; f++) C.clothStep(sim, 1/60);
  const d = sim.opt.selfDist, x = sim.x, of = (k) => { const out = []; for (let i = 0; i < sim.n; i++) if (sim.piece[i] === k) out.push(i); return out; };
  const P = [of(0), of(1), of(2)], meanY = (l) => l.reduce((a, i) => a + x[3*i+1], 0)/l.length;
  let closest = Infinity;
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) for (const i of P[a]) for (const j of P[b]) closest = Math.min(closest, Math.hypot(x[3*i] - x[3*j], x[3*i+1] - x[3*j+1], x[3*i+2] - x[3*j+2]));
  assert.ok(meanY(P[1]) > meanY(P[0]) + 0.5*d, "the second layer lies on the first: " + meanY(P[0]).toFixed(1) + " / " + meanY(P[1]).toFixed(1));
  assert.ok(closest > 0.8*d, "no two points of different patterns closer than 0.8 × " + d.toFixed(1) + " mm: " + closest.toFixed(2));
  assert.ok(C.clothSpeed(sim) < 50, "at rest: " + C.clothSpeed(sim).toFixed(1));
});

/* ---- Batch 5: the history as changes, file version 19, the autosave in IndexedDB ---- */
// 48 patterns (the two examples six times); edit(k): the k-th of a mix of edits, each a step as the tools make them
const HIST = `
  const ev = app.ev, J = JSON.stringify, V = ev("V");
  S.pieces.length = 0; S.seams.length = 0;
  for (let k = 0; k < 6; k++) for (const ex of ev("PATTERN_EXAMPLES").slice(0, 2)) {
    const before = new Set(S.pieces.map(p => p.id)); ev("addDocument")(ex.name, JSON.parse(J(ex.doc)));
    for (const p of S.pieces.filter(p => !before.has(p.id))) ev("mapPiece")(p, (q) => V(q.x + k*3000, q.y));
  }
  S.undo.length = 0; S.redo.length = 0; S.un.length = 0; S.rn.length = 0; app.commit();
  let seed = 3; const rnd = () => (seed = (seed*1103515245 + 12345) % 2147483648)/2147483648;
  const edit = (k) => {
    const p = S.pieces[Math.floor(rnd()*S.pieces.length)], i = Math.floor(rnd()*p.pts.length);
    ev("push")("Edit " + k);
    const kind = k % 6;
    if (kind === 0) { p.pts[i].x += 5 + rnd()*20; p.pts[i].y -= rnd()*10; }
    else if (kind === 1) p.segs[i % p.segs.length].sa = 5 + Math.round(rnd()*20);
    else if (kind === 2 && S.seams.length > 20) S.seams.splice(Math.floor(rnd()*S.seams.length), 1);
    else if (kind === 3) p.segs[i % p.segs.length].notches.push(+(rnd()*0.8 + 0.1).toFixed(3));
    else if (kind === 4) p.name = p.name + " " + k;
    else ev("mapPiece")(p, (q) => V(q.x + 40, q.y + 10));
    app.commit();
  };
`;
test("perf-2 / 5: 60 edits on 48 patterns, undone and redone all the way, at random, and after Save and Open: every document is exactly the one before the step (snap()'s text)", () => {
  const o = boot({ streams: true, script: "return (async () => {" + HIST + `
    const N = 60, before = [], bad = [], snap = () => ev("snap()"), canon = (t) => ev("canonJSON")(JSON.parse(t));
    for (let k = 0; k < N; k++) { before.push(snap()); edit(k); }
    const after = snap(), at = (j) => (j === N ? after : before[j]);          // the document after j steps
    for (let j = N - 1; j >= 0; j--) { app.undo(); if (snap() !== at(j)) bad.push("undo to " + j); }
    for (let j = 1; j <= N; j++) { app.redo(); if (snap() !== at(j)) bad.push("redo to " + j); }
    let pos = N;
    for (let k = 0; k < 80; k++) { if (rnd() < 0.5 && pos > 0) { app.undo(); pos--; } else if (pos < N) { app.redo(); pos++; } if (snap() !== at(pos)) bad.push("walk at " + pos); }
    while (pos < N) { app.redo(); pos++; }
    // Save, then Open: the file keeps the last 50 steps; undone from the file, each is the document before its step (key order from the file)
    let got = null; app.setDownload((n, d) => { got = d; }); app.saveDoc(false); await app.wait(() => got, "the file");
    const was = S.pieces[0]; app.ev("openFile")("h.pdraft", got, null, true); await app.wait(() => S.pieces[0] !== was, "opened");
    const kept = S.undo.length;
    for (let j = N - 1; j >= N - kept; j--) { app.undo(); if (canon(snap()) !== canon(at(j))) bad.push("undo from the file to " + j); }
    for (let j = N - kept + 1; j <= N; j++) { app.redo(); if (canon(snap()) !== canon(at(j))) bad.push("redo from the file to " + j); }
    return { bad: bad.slice(0, 10), kept, steps: N };
  })();` }, 180000).result;
  assert.deepStrictEqual(o.bad, []);
  // (Round H1: the file keeps every step, up to the 500 the history keeps; it kept the last 50)
  assert.strictEqual(o.kept, 60, "the file keeps every step");
});

test("perf-2 / 5: a step keeps only what it changed: 30 point moves on one pattern hold little more text than one copy of the document", () => {
  const o = boot({ script: HIST + `
    S.undo.length = 0; S.un.length = 0;
    const p = S.pieces[3];
    for (let k = 0; k < 30; k++) { ev("push")("Move"); p.pts[k % p.pts.length].x += 3; app.commit(); }
    const seen = new Set(); let all = 0;
    for (const st of S.undo) for (const v of Object.values(st.k)) for (const t of (typeof v === "string" ? [v] : v.t)) { seen.add(t); all += t.length; }
    let uniq = 0; for (const t of seen) uniq += t.length;
    return { steps: S.undo.length, doc: ev("snap()").length, uniq, all, kind: typeof S.undo[0] };
  ` }).result;
  assert.strictEqual(o.kind, "object", "a step is kept in parts");
  assert.strictEqual(o.steps, 30);
  assert.ok(o.uniq < 1.6*o.doc, "the texts kept " + o.uniq + " (one copy " + o.doc + ", 30 copies " + o.all + ")");
  assert.ok(o.all > 25*o.doc, "as whole copies it would be 30 × the document");
});

test("perf-2 / 5: a version 18 file with its v2 history opens, its steps undo to the same documents, and it is saved again as version 19 with the history as v3", () => {
  const o = boot({ script: HIST + `
    const N = 12, before = [], canon = (t) => ev("canonJSON")(JSON.parse(t)), snap = () => ev("snap()");
    for (let k = 0; k < N; k++) { before.push(snap()); edit(k); }
    const after = snap();
    // the file as version 18 wrote it: document.json at version 18, history.json v2 (histDelta(): the v2 writer, kept for this)
    const states = [...S.undo, ev("histState")()].map(st => { const d = ev("histObj")(st); delete d.drape3; return d; });
    const hist = { v: 2, fv: 18, at: N, steps: S.un.map(s => ({ n: s.n })), states: states.map((s, k) => ev("histDelta")(k ? states[k-1] : null, s)) };
    const doc = ev("docObj")(); doc.v = 18;
    const files = [{ name: "document.json", data: ev("utf8Of")(ev("canonJSON")(doc)) }, { name: "history.json", data: ev("utf8Of")(ev("canonJSON")(hist)) }];
    let bytes = null; ev("zipPack")(files, (b) => { bytes = b; });
    const was = S.pieces[0]; ev("openFile")("old.pdraft", bytes, null, true);
    const opened = S.pieces[0] !== was, kept = S.undo.length, bad = [];
    for (let j = N - 1; j >= 0; j--) { app.undo(); if (canon(snap()) !== canon(before[j])) bad.push("undo to " + j); }
    for (let j = 1; j <= N; j++) { app.redo(); if (canon(snap()) !== canon(j === N ? after : before[j])) bad.push("redo to " + j); }
    let out = null; app.setDownload((n, d) => { out = d; }); app.saveDoc(false);
    const parts = Object.fromEntries(app.fileParts(out).map(([n]) => [n, true])), d2 = app.fileDoc(out);
    return { opened, kept, bad, v: d2.v, hv: d2.history && d2.history.v, hfv: d2.history && d2.history.fv, parts: Object.keys(parts) };
  ` }).result;
  assert.deepStrictEqual([o.opened, o.kept], [true, 12]);
  assert.deepStrictEqual(o.bad, []);
  // (Round H1: the history is saved as v4, the tree, since file version 32; it was v3 from version 19)
  assert.deepStrictEqual([o.v, o.hv, o.hfv], [FV, 4, FV]);      // (Round H1: this build's version read from the app, FV) ((Round H1a: version 31) (Round r34: version 30) ((Round r33b: version 29) version 28 since Round r30 (a seam's mirror); 28 since Round r30, 27 since Round r29 (a document's render settings); 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; the history keeps its v3 layout)
});

test("perf-2 / 5: in a browser the autosave is kept in IndexedDB, offered at the start from there (or from an older version's localStorage, then moved over), and a full storage says so", () => {
  const J = JSON.stringify, wait = "await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));";
  // written there, not to localStorage
  const a = boot({ blank: true, idb: {}, script: `return (async () => { ${wait} app.ev("push")("Rect"); S.pieces.push(app.mkPiece("A", app.mkShape([{x:0,y:0},{x:100,y:0},{x:100,y:50},{x:0,y:50}], true))); app.commit(); app.ev("saveNow")(); ${wait} return null; })();` });
  assert.ok(a.idb["pdraft:doc"] && JSON.parse(a.idb["pdraft:doc"]).pieces.length === 1, "the autosave is in IndexedDB");
  assert.strictEqual(a.storage["pdraft:doc"], undefined, "not in localStorage");
  assert.strictEqual(a.saveText, "AUTOSAVED");
  // offered at the start from IndexedDB
  const b = boot({ blank: true, idb: { store: { "pdraft:doc": a.idb["pdraft:doc"] } }, script: `return (async () => { ${wait} return S.pieces.map(p => p.name); })();` });
  assert.ok(b.modals.some(m => m.title === "Recover unsaved work?"), "offered");
  assert.deepStrictEqual(b.result, ["A"], "recovered");
  // an older version's autosave in localStorage: offered, and the next autosave moves it over
  const c = boot({ blank: true, idb: {}, seed: a.idb["pdraft:doc"], script: `return (async () => { ${wait} app.ev("saveNow")(); ${wait} return S.pieces.map(p => p.name); })();` });
  assert.ok(c.modals.some(m => m.title === "Recover unsaved work?"));
  assert.deepStrictEqual(c.result, ["A"]);
  assert.ok(c.idb["pdraft:doc"] && c.storage["pdraft:doc"] === undefined, "moved over to IndexedDB");
  // a full storage: the message says why and how large, the save button says it failed
  const d = boot({ blank: true, idb: { full: true }, script: `return (async () => { ${wait} app.ev("push")("Rect"); S.pieces.push(app.mkPiece("A", app.mkShape([{x:0,y:0},{x:100,y:0},{x:100,y:50},{x:0,y:50}], true))); app.commit(); app.ev("saveNow")(); ${wait} return app.el("s-save").title; })();` });
  assert.ok(d.toasts.some(t => /^Autosave failed: This browser's storage is full: the autosave is [0-9.]+ MB — use Save to keep your work[.]$/.test(t)), J(d.toasts));
  // (Round build-1: the failure is told in words, for a colour-blind eye: "⚠ Autosave failed — click for details")
  assert.strictEqual(d.saveText, "⚠ Autosave failed — click for details");
  assert.ok(/storage is full/.test(d.result));
});

module.exports = T;
