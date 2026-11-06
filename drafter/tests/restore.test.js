// Round H1a: the full-restore test. The maintainer's rule: on a fresh profile, opening
// a saved file gives an identical state; only user preferences may differ.
//   A (a page with a profile of its own: a collision detail, a render choice, a pose file of its own) builds a rich scene, simulates
//     it, keeps a 3D state, and saves it.
//   B (a fresh page: nothing stored) opens the file.
//   The two states are compared part by part. A difference is a fault unless it is listed in KNOWN, with its reason; a KNOWN entry
//   that no longer differs fails too, so the list only ever shrinks by being taken out.
// And: every piece of state the page holds (S, G3, S.ui, S.prefs, S.avSet, the stored keys) is classified in CLASS as file,
// pref (a preference), view (view state), session (work in progress, not the document) or derived (rebuilt from the file). State
// that is in none fails the test: a new kind of state must be decided on.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const MARTY = path.join(__dirname, "..", "assets", "avatar", "presets", "marty.glb"), hasMarty = fs.existsSync(MARTY);

function boot(opt, ms) {
  const f = path.join(require("os").tmpdir(), "pdraft-restore-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 29 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  return JSON.parse(r.stdout);
}

/* ---------- what every piece of state is ----------
   file: in the .pdraft · pref: a preference of this machine (may differ) · view: view state (never written: every start looks the
   same) · session: work in progress that is not the document (a tool's pick, the selection, a running simulation) · derived:
   rebuilt from the file (caches, what is measured from it). */
const CLASS = {
  S: {
    // the document
    pieces: "file", seams: "file", stitches: "file", puckers: "file", guides: "file", measures: "file", grading: "file", lineLinks: "file", tacks: "file",
    buttons: "file", pipings: "file", bindings: "file", glues: "file", lib: "file", layout: "file", notch: "file", images: "file", backdrop: "file",
    avedit: "file", lights: "file", render: "file", renderSet: "file", cloth: "file", states3: "file", home3: "file", nextId: "file", nextSegId: "file", nextShapeId: "file",
    garMeas: "file", docPose: "file", docAv: "file", docAvFile: "file", avEmbed: "file", drapeIn: "file",
    // the history (in the file: history.json)
    undo: "file", redo: "file", un: "file", rn: "file",
    // preferences
    prefs: "pref", unit: "pref", dec: "pref", print: "pref", poses: "pref", sewCheck: "pref", avSet: "pref", avOwn: "pref", show: "pref", pdfSet: "pref",
    // view state
    ui: "view", view: "view", mode: "view", lview: "view", ob: "view", layFab: "view", layPaper: "view", aved: "view", over3d: "view", mouseOut: "view", g3on: "view",
    // the session: the tools' state, the selection, picks and drafts in progress
    tool: "session", tool3: "session", sel: "session", selPt: "session", selSeg: "session", selInt: "session", selKind: "session", selCp: "session", selCps: "session",
    selSeam: "session", selSeams: "session", selPart: "session", selStitch: "session", selTrim: "session", selMeas: "session", selGfx: "session", selNote: "session",
    selBtn: "session", selPunch: "session", selPucker: "session", selNotch: "session", selHandle: "session", selMore: "session", gradeSel: "session", blockSel: "session",
    drag: "session", draft: "session", mouse: "session", hover: "session", shift: "session", space: "session", marquee: "session", pivot: "session", place: "session",
    walk: "session", replace: "session", rotAxis: "session", pickPoly: "session", traceSel: "session", traceShapes: "session", traceMode: "session", traceOp: "session",
    traceFold: "session", pleatPick: "session", pleatSet: "session", blockDraft: "session", sticker: "session", fastenFrom: "session", zipTarget: "session", noteLink: "session",
    dartCap: "session", only3: "session", added: "session", clip: "session", gradeClip: "session", btnClip: "session", tps: "session", snapG: "session", snapMark: "session",
    laySel: "session", layDrag: "session", layHover: "session", layManual: "session", layTape: "session", avPick: "session", btnPick: "session", spread: "session",
    lockCurve: "session", angKeep: "session", sewBad: "session", busyMin: "session", calcExpr: "session", graphicAt: "session", bgMode: "session", autoAt: "session",
    dirty: "session", drapeWant: "session", docAvAsk: "session", docAvTried: "session", av: "session", avErr: "session", avPresets: "session", known3: "session", bakeWas: "session",
    curvesIn: "session",
    // the last values a dialog of this session opened with (each dialog's own memory, not the document)
    saValue: "session", offDist: "session", offFit: "session", offCount: "session", stitchOffset: "session", pleatDepth: "session", pleatDepthEnd: "session", pleatN: "session",
    pleatType: "session", pleatSpaceA: "session", pleatSpaceB: "session", pleatNotch: "session", perpAng: "session", perpLen: "session", perpExt: "session", fullN: "session",
    distN: "session", dartW: "session", dartD: "session", dartFold: "session", dart2: "session", punchD: "session", noteSize: "session", rollW: "session", rollN: "session",
    spiral: "session", spiralPat: "session",
    // derived from the file
    avMeas: "derived", arr: "derived",
  },
  // the 3D window's own state: all of it is the session's or rebuilt from the file (the cloth: from drape.bin)
  G3: { items: "derived", pool: "derived", poolId: "derived", drapeNow: "derived", restBody: "derived", fresh: "derived", dirty: "derived", look: "session", sel: "session", giz: "session",
    gizHot: "session", gizObj: "session", joint: "session", jointHot: "session", selPin: "session", selTack: "session", selMeas: "session", selVol: "session", isolate: "view",
    probe: "session", probeObj: "session", mapLeg: "view", strain: "derived", strainLeg: "view", strainTop: "view", ov: "derived", ovCache: "derived", ovExtra: "derived",
    hovKey: "session", hotLine: "session", hotPt: "session", garFrom: "session", tackFrom: "session", suitPick: "session", suitLine: "session", ikSlot: "session", ikOpen: "view",
    arrBV: "session", arrPt: "session", blendSel: "session", blendSelOnly: "view", blendFavOnly: "view", sizeHot: "session", stayPid: "session", moved: "session", uid: "derived",
    unsewn: "derived", unsewnKey: "derived", zipKey: "derived", zips: "derived", dot: "derived", dotHot: "session", dotMat: "derived", dotPair: "session", dotSel: "session",
    btnScreen: "derived", tackScreen: "derived", thread: "derived", trimEdge: "derived", trimMats: "derived", tackMats: "derived", glueMats: "derived", lineMat: "derived",
    measMat: "derived", measMats: "derived", pinMat: "derived", unsewnMat: "derived", ring: "derived", ringDark: "derived", ringLight: "derived", light: "derived",
    q3: "derived", q3Env: "derived", q3Hemi: "derived", shadow3: "derived", schPanel: "view", schSig: "derived", schT: "derived" },
};
// S.ui: its preferences are the app's own list (UI_PREFS); everything else in it is view state, named here
CLASS.uiView = ["layout", "arrPts", "timeline", "render", "mesh2", "render3", "wire3", "joints3", "jointMode", "ikEdit", "quality3", "schem3", "bv3", "meas3", "suit3", "show3d", "strain3",
  "fit3", "stress3", "press3", "shadow3", "lights3", "lightsR", "split", "panelW", "obH", "obFold", "obFloat", "float2", "float3"];
// S.avSet (pdraft:avatar): what is loaded is the session's; how it stands is the document's (the avatar record); how it is shown is view state; the collision detail is this machine's
CLASS.avSet = { path: "session", name: "session", height: "file", pose: "file", base: "file", display: "view", showCol: "view", panel: "view", cell: "pref" };
// stored keys (localStorage in the test page: the desktop store and IndexedDB hold the same)
const STORE = { "pdraft:doc": "session", "pdraft:file": "session", "pdraft:prefs": "pref", "pdraft:ui": "pref", "pdraft:view": "pref", "pdraft:avatar": "pref", "pdraft:poses": "pref",
  "pdraft:sewcheck": "pref", "pdraft:library": "pref", "pdraft:flags": "pref", "pdraft:welcome": "pref", "pdraft:render": "pref", "pdraft:snapshot": "pref", "pdraft:ptfail": "pref",
  "pdraft:print": "pref", "pdraft:grainask": "pref", "pdraft:avsizes": "pref" };

/* ---------- differences known and not yet put right ----------
   Each: the path it shows at (a regular expression), why, and where it is to be put right. Kept to the paths it really covers. */
const KNOWN = [
  // (put right in H1a batch 2, file version 31: the garment measurements, the avatar record's collision detail and pose file, the render
  // settings of a document never rendered are in the file now)
  { at: /^history\.(steps|states|at|n)$/, why: "the file keeps only the last 50 done steps of the history (Settings: History in the File)", fix: "H1 (the history's storage, h0 spec §7)" },
  { at: /^history\.drapes$/, why: "the drape of each history step is not in the file: undo past a Simulate after opening leaves the cloth as it is", fix: "H1 (h0 spec §7.3)" },
];

const FNV = `
  const hashF = (X) => { if (!X || !X.length) return null; const b = new Uint8Array(Float32Array.from(X).buffer); let h = 2166136261; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16) + ":" + X.length; };
`;
// the state compared: everything the file is to bring back, in plain data
const DUMP = FNV + `
  const dump = () => {
    const J = app.ev("canonJSON"), G3 = app.ev("G3"), out = {};
    const d = JSON.parse(JSON.stringify(app.ev("docObj")()));
    out.display = d.display; delete d.display;
    for (const k of Object.keys(d)) out["doc." + k] = d[k];
    delete out["doc.render"];
    out.render = app.ev("loadRender")();
    out.cloth = {}; for (const [id, it] of G3.items) out.cloth[id] = it && it.X ? hashF(it.X) : null;
    out.states3 = (S.states3 || []).map(s => ({ name: s.name, p3: s.p3, pool: Object.fromEntries(Object.entries((s.pool && s.pool.cloth) || s.pool || {}).map(([k, v]) => [k, v && v.length ? hashF(v) : (v && v.X ? hashF(v.X) : null)])) }));
    out.images = (S.images || []).map(im => [im.id, im.name, im.data.length]);
    const av = S.av;
    out.avatar = av ? { preset: av.preset || null, hash: av.hash, height: Math.round(av.height*10)/10, pose: S.avSet.pose, base: S.avSet.base || null, cell: S.avSet.cell,
      skin: hashF(Array.from(app.ev("avatarTris")(av)).map(v => Math.round(v*100)/100)) } : null;
    out.avMeas = (S.avMeas || []).map(m => [m.kind, Math.round((m.tape || m.len || m.surface || 0)*10)/10]);
    out.garMeas = (S.garMeas || []).map(m => { const r = app.ev("garMeasValue")(m); return [m.kind, m.name || "", r ? Math.round(r.v*10)/10 : null]; });
    const st = app.histSteps();
    out.history = { at: st.at, n: st.steps.length };
    out["history.steps"] = st.steps.map(s => s.n);
    out["history.states"] = S.undo.map(t => J(JSON.parse(app.ev("histText")(t))));
    out["history.drapes"] = S.undo.map(t => !!(typeof t === "string" ? JSON.parse(t).drape3 : t.drape3));
    return out;
  };
  // the keys of every piece of state the page holds now
  const keysNow = () => ({ S: Object.keys(S), G3: Object.keys(app.ev("G3")), storage: [...app.storage.keys()] });
`;

/* ---------- A: the rich scene ----------
   The T-shirt example on Marty (four patterns, sewn and arranged), then three panels of our own beside it with every other kind of
   document data, a simulation, a 3D state, and enough steps that the history is longer than the file keeps. */
const SCENE = DUMP + `
  return (async () => {
    const at = (x, y) => app.toS({ x, y }), click = (x, y) => { const q = at(x, y); app.click(q.x, q.y); };
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
    const ex = app.ev("shippedExamples")().find(e => /T-shirt/.test(e.name)); app.ev("openExample")(ex, true);
    await app.wait(() => S.av && S.pieces.length >= 4, "the example");
    S.view = { s: 1, x: 0, y: 0 };
    const panel = (name, x0) => { app.push("Rectangle"); const p = app.mkPiece(name, app.mkShape([{ x: x0, y: 0 }, { x: x0 + 400, y: 0 }, { x: x0 + 400, y: 300 }, { x: x0, y: 300 }], true)); S.pieces.push(p); app.commit(); return p; };
    const A = panel("Panel A", 3000), B = panel("Panel B", 3600), C = panel("Panel C", 4200);
    // a dart, notches of two looks, an annotation, pins, a punch mark
    app.ev("addDartAt")(A, 1, 40, 20, 80, false); app.commit();
    app.push("Notch"); A.segs[0].notches = [0.3, { t: 0.6, type: "V", angle: 10 }]; app.commit();
    app.push("Annotation"); A.notes = [{ text: "Cut 2", x: 3200, y: 150, size: 12 }]; app.commit();
    app.push("Pin"); B.pins = [{ x: 3700, y: 100 }]; app.commit();
    // sewn: A to B with a zipper, a topstitch on A
    app.push("Zipper"); S.seams.push({ id: 900, zip: { name: "Zipper 1", type: S.lib.zipper && S.lib.zipper[0] ? S.lib.zipper[0].id : 0 }, a: [{ piece: A.id, shape: 0, sids: [A.segs[A.segs.length - 1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[1].id], t0: 0, t1: 1, rev: true }] }); app.commit();
    app.push("Topstitch"); app.addStitch({ piece: A.id, shape: 0, sids: [A.segs[0].id], t0: 0, t1: 1 }); app.commit();
    // a fabric of our own, given to C
    app.push("Fabric"); app.libAdd("fabric"); const fab = S.lib.fabric[S.lib.fabric.length - 1]; Object.assign(fab, { name: "Wool", physical: "Custom", weight: 210, maxStretch: 15, color: "#335577" }); C.fabric = fab.id; app.commit();
    // pleats on B (two clicks on the outline, the side, the box)
    S.view = { s: 0.25, x: -700, y: 100 };            // (the three panels on the test page's 1000 px canvas)
    app.setTool("pleats");
    app.answer = () => ({ type: "box", n: 2, d0: 5, d1: 5, i0: 40, i1: 40, notch: "both", angles: "0-360", out: 0, inn: 360, rev: false, rev2: false });
    click(3803, 0); click(3798, 300); click(3860, 150); app.answer = null;
    // Seamless Blocking on C, a section given the fabric
    app.setTool("seamless_blocking"); click(4400, 0); click(4350, 150); click(4400, 300);
    const red = app.ev("normLibItem")("fabric", { name: "Red", color: "#cc3311" }, 990); S.lib.fabric.push(red); S.lib.nextId = Math.max(S.lib.nextId, 991); app.commit();
    click(4250, 150); const bf = app.el("blk-f"); if (bf && bf.onchange) { bf.value = "990"; bf.onchange(); }
    // grading: a group of three sizes, a graded point
    app.setTool("transform_pattern");
    const G = S.grading; app.push("Size Group"); const g = app.ev("addSizeGroup")(G, "Run"); g.sizes[0].name = "M";
    const Lz = app.ev("insertSize")(G, S.pieces, g.id, null, "L"); app.ev("ensureGrade")(G, A).group = g.id; app.commit();
    app.push("Grading"); app.ev("setPtDelta")(G, A, A, 2, Lz.id, 12, 20); app.commit();
    // a point of measure
    app.push("Point of Measure"); S.measures.push({ id: 1, a: app.ev("mkAnchor")(C, C, 0), b: app.ev("mkAnchor")(C, C, 1), kind: "line", name: "Width" }); app.commit();
    app.setTool("transform_pattern");
    // lights, the Print Layout's own settings
    app.push("Add Light"); S.lights.push(app.ev("normLight")({ type: "spot", intensity: 3, az: 60, name: "Key" }, 1), app.ev("normLight")({ type: "rect", w: 800, name: "Fill" }, 2)); app.commit();
    app.push("Print Layout"); S.layout = app.ev("normLayout")({ ...S.layout, margin: 12, cols: 4, gap: 7 }); app.commit();
    // the avatar edited and posed: a pose file of this machine's own as the base pose, a slider, a joint turned, the waist sized
    S.poses = app.ev("normPoses")([{ name: "Walk", q: { upperarm_l: [0.2, 0, 0, 0.98], upperarm_r: [-0.2, 0, 0, 0.98] } }]);
    app.setAvatar({ base: "Walk", pose: { armL: [20, 0, 0] } });
    app.push("Turn Joint"); S.avedit.joints = { lowerarm_l: [0, 0, 0.17, 0.985] }; app.commit();
    app.ev("sizeTyped")("waist", 820);
    app.ev("measAdd")({ kind: "tape", type: "basic", at: [{ v: [100, 100, 100], w: [1, 0, 0] }, { v: [2000, 2000, 2000], w: [1, 0, 0] }] });
    // simulated, a 3D state kept, then the garment measurements on the draped cloth
    app.ev("garmentSync")();
    app.ev("simStart")(); for (let i = 0; i < 25; i++) app.ev("simFrame")(); app.ev("simStop")();
    app.ev("state3Add")();
    const T0 = S.pieces[0];
    app.ev("addGarMeas")({ kind: "glin", a: { piece: T0.id, x: T0.pts[0].x, y: T0.pts[0].y }, b: { piece: T0.id, x: T0.pts[2].x, y: T0.pts[2].y } });
    app.ev("addGarMeas")({ kind: "vol", ids: [T0.id] });
    // more steps than the file keeps
    for (let k = 0; k < 55; k++) { app.push("Move"); C.pts.forEach(q => { q.y += 1; }); app.commit(); }
    const file = await new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); app.setDownload(null); });
    return { file: Array.from(file), dump: dump(), keys: keysNow(), ui: Object.keys(S.ui), uiPrefs: app.ev("UI_PREFS"), prefs: Object.keys(S.prefs), avSet: Object.keys(S.avSet) };
  })();`;

/* ---------- B: a fresh page opens it ----------
   Marty is loaded first, as the file loads him on a real page (a built-in avatar by its id: the test page cannot fetch his script;
   the browser smoke check and the desktop one open files that bring him themselves). */
const OPEN = (bytes) => DUMP + `
  return (async () => {
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
    app.ev("openFile")("restore.pdraft", new Uint8Array(${JSON.stringify(bytes)}), null, true);
    await app.wait(() => S.pieces.length > 4, "the file");
    app.ev("garmentSync")();
    return { dump: dump(), keys: keysNow(), ui: Object.keys(S.ui), uiPrefs: app.ev("UI_PREFS"), prefs: Object.keys(S.prefs), avSet: Object.keys(S.avSet) };
  })();`;

// every path at which two plain values differ (objects by key, arrays by index), as far down as `depth`
// (compared with the keys in order: the order an object's keys were made in is no state)
const canon = (v) => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(q => [q, x[q]])) : x);
function diffs(a, b, at, depth, out) {
  const same = canon(a) === canon(b);
  if (same) return out;
  if (depth <= 0 || !a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) { out.push(at); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffs(a[k], b[k], at ? at + "." + k : k, depth - 1, out);
  return out;
}

let RUN = null;
function run() {
  if (RUN) return RUN;
  const PROFILE = { "pdraft:avatar": JSON.stringify({ cell: 14 }), "pdraft:render": JSON.stringify({ samples: 96, w: 1600, h: 1200, size: "custom", bg: "color", bgColor: "#223344" }) };
  const a = boot({ blank: true, three: true, storage: PROFILE, script: SCENE }, 600000);
  assert.deepStrictEqual(a.errors, [], "A: " + JSON.stringify(a.errors));
  const b = boot({ blank: true, three: true, script: OPEN(a.result.file) }, 600000);
  assert.deepStrictEqual(b.errors, [], "B: " + JSON.stringify(b.errors));
  RUN = { A: a.result, B: b.result, size: a.result.file.length };
  return RUN;
}

test("h1a / 1: every piece of state the page holds is classified as file, preference, view, session or derived (a new kind of state must be decided on)" + (hasMarty ? "" : " (Marty is not here: skipped)"), () => {
  if (!hasMarty) return;
  const { A, B } = run(), miss = [];
  if (process.env.PDRAFT_RESTORE_KEYS) console.log("  ui: " + [...new Set([...A.ui, ...B.ui])].join(" ") + "\n  avSet: " + [...new Set([...A.avSet, ...B.avSet])].join(" ") + "\n  prefs: " + [...new Set([...A.prefs, ...B.prefs])].join(" "));
  for (const side of [A, B]) {
    for (const k of side.keys.S) if (!(k in CLASS.S)) miss.push("S." + k);
    for (const k of side.keys.G3) if (!(k in CLASS.G3)) miss.push("G3." + k);
    for (const k of side.keys.storage) if (!(k in STORE)) miss.push("stored " + k);
    for (const k of side.ui) if (!side.uiPrefs.includes(k) && !CLASS.uiView.includes(k)) miss.push("S.ui." + k);
    for (const k of side.avSet) if (!(k in CLASS.avSet)) miss.push("S.avSet." + k);
    // (S.prefs is Settings: every key of it is a preference by what it is)
  }
  const left = [...new Set(miss)].sort();
  assert.deepStrictEqual(left, [], "state not classified (add it to CLASS / STORE with its reason): " + left.join(", "));
});

test("h1a / 2: a rich scene saved and opened on a fresh profile is the same state: every difference is a known one, each named with where it is to be put right" + (hasMarty ? "" : " (Marty is not here: skipped)"), () => {
  if (!hasMarty) return;
  const { A, B, size } = run(), found = [];
  for (const k of new Set([...Object.keys(A.dump), ...Object.keys(B.dump)])) {
    if (k === "display") continue;                  // pref: put back only with Open Files with Their Display Settings
    // (the document's keys a level or two down, so that a difference names what it is: doc.scene.avatar, doc.lib.nextId)
    found.push(...diffs(A.dump[k], B.dump[k], k, /^doc[.]/.test(k) ? 2 : k === "avatar" || k === "history" ? 1 : 0, []));
  }
  const known = found.filter(p => KNOWN.some(x => x.at.test(p))), unknown = found.filter(p => !KNOWN.some(x => x.at.test(p)));
  const stale = KNOWN.filter(x => !found.some(p => x.at.test(p)));
  // PDRAFT_RESTORE_DEEP=1: each unknown difference with its two values
  const valueAt = (side, p) => { const k = Object.keys(side.dump).filter(q => p === q || p.startsWith(q + ".")).sort((x, y) => y.length - x.length)[0]; return p.slice(k.length + 1).split(".").filter(Boolean).reduce((o, q) => o && o[q], side.dump[k]); };
  if (process.env.PDRAFT_RESTORE_DEEP) for (const p of unknown) console.log("  " + p + ": " + String(JSON.stringify(valueAt(A, p))).slice(0, 200) + "  /  " + String(JSON.stringify(valueAt(B, p))).slice(0, 200));
  if (process.env.PDRAFT_RESTORE_REPORT) console.log("  file " + size + " bytes; known differences: " + (known.join(", ") || "none") + "; KNOWN entries that no longer differ: " + (stale.map(x => String(x.at)).join(", ") || "none"));
  assert.deepStrictEqual(unknown, [], "differences after reopening that are not known faults: " + unknown.join(", "));
  assert.deepStrictEqual(stale.map(x => String(x.at)), [], "these KNOWN entries no longer differ: take them out of the list");
  // the scene is what it says: a sanity check that A really built it
  const d = A.dump;
  assert.ok(d["doc.pieces"].length >= 7 && d["doc.seams"].some(s => s.zip) && d["doc.stitches"].length && d["doc.measures"].length && d["doc.lights"].length === 2, "the scene's document: " + JSON.stringify([d["doc.pieces"].length, d["doc.seams"].some(s => s.zip), d["doc.stitches"].length, d["doc.measures"].length, d["doc.lights"].length]));
  assert.ok(d["doc.pieces"].some(p => (p.internals || []).some(x => x.block)) && d["doc.pieces"].some(p => (p.blocks || []).length) && d["doc.pieces"].some(p => (p.internals || []).some(x => x.fold)), "pleats and Seamless Blocking");
  assert.ok(Object.values(d.cloth).some(Boolean) && d.states3.length === 1 && d.garMeas.length === 2 && d.avatar && d.avatar.base === "Walk", "draped, a 3D state, garment measurements, a pose file");
  assert.ok(d.history.n > 60, "a history longer than the file keeps: " + d.history.n);
});

/* Crash recovery is the same rule: what the autosave brings back is the document and its history. RECOVERY_KNOWN as KNOWN. */
const RECOVERY_KNOWN = [
  // (put right in H1a batch 2: the autosave keeps the history, and the 2D origin of 3D in it, as a file does)
];
test("h1a / 3: crash recovery brings back the document and its history: every difference a known one", () => {
  const a = boot({ blank: true, script: `
    const J = app.ev("canonJSON");
    for (let k = 0; k < 4; k++) { app.push("Rectangle"); S.pieces.push(app.mkPiece("R" + k, app.mkShape([{ x: 500*k, y: 0 }, { x: 500*k + 300, y: 0 }, { x: 500*k + 300, y: 200 }, { x: 500*k, y: 200 }], true))); app.commit(); }
    app.push("Move"); S.pieces[1].pts.forEach(q => { q.x += 20; }); app.commit();
    app.undo();                                     // one step undone: the redo side is history too
    app.ev("saveNow")();
    const st = app.histSteps(), d = JSON.parse(JSON.stringify(app.ev("docObj")())); delete d.display; delete d.scene;
    return { seed: app.storage.get("pdraft:doc"), doc: J(d), history: { at: st.at, steps: st.steps.map(s => s.n), states: S.undo.map(t => J(JSON.parse(app.ev("histText")(t)))) } };` });
  assert.deepStrictEqual(a.errors, []);
  assert.ok(typeof a.result.seed === "string" && a.result.seed.length > 100, "an autosave was written");
  const b = boot({ blank: true, seed: a.result.seed, script: `
    const J = app.ev("canonJSON"), st = app.histSteps(), d = JSON.parse(JSON.stringify(app.ev("docObj")())); delete d.display; delete d.scene;
    return { doc: J(d), history: { at: st.at, steps: st.steps.map(s => s.n), states: S.undo.map(t => J(JSON.parse(app.ev("histText")(t)))) } };` });
  assert.deepStrictEqual(b.errors, []);
  assert.ok(b.modals.some(m => m.title === "Recover unsaved work?"), "recovery was offered");
  const found = [];
  if (a.result.doc !== b.result.doc) found.push("doc");
  if (JSON.stringify(a.result.history) !== JSON.stringify(b.result.history)) found.push("history");
  const unknown = found.filter(p => !RECOVERY_KNOWN.some(x => x.at.test(p))), stale = RECOVERY_KNOWN.filter(x => !found.some(p => x.at.test(p)));
  assert.deepStrictEqual(unknown, [], "recovered state differs: " + unknown.join(", "));
  assert.deepStrictEqual(stale.map(x => String(x.at)), [], "these RECOVERY_KNOWN entries no longer differ: take them out of the list");
});

/* (Round H1a / 2) The defaults a file was written with. A version 30 file (written by the last build of version 30) opens with the
   defaults of version 30, the render settings among them (not this machine's last choices), and saves as version 31 with this build's
   defaults said in it. A file written with other defaults (as a later build that changed one will meet this one's files) opens with its
   own: each becomes a value of its own in the document and in every state of its history. */
test("h1a / 4: a file opens with the defaults it was written with: version 30's for an older file, its own from version 31; a default that differs from this build's becomes a value of its own, in the document and its history", () => {
  const v30 = Array.from(fs.readFileSync(path.join(__dirname, "files", "v30", "defaults-sewn-history.pdraft")));
  const o = boot({ blank: true, storage: { "pdraft:render": JSON.stringify({ samples: 96, bg: "color", bgColor: "#223344" }) }, script: `
    const out = {}, J = app.ev("canonJSON");
    const saveBytes = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return got; };
    out.same = J(app.ev("fileDefaults")()) === J(app.ev("DEFAULTS_BY_VERSION")[30]);
    app.ev("openFile")("v30.pdraft", new Uint8Array(${JSON.stringify(v30)}), null, true);
    out.render = [S.render.samples, S.render.bg, J(S.render) === J(app.ev("normRender")(app.ev("DEFAULTS_BY_VERSION")[30].render))];
    const b1 = saveBytes(), d1 = app.fileDoc(b1);
    out.saved = [d1.v, J(d1.defaults) === J(app.ev("fileDefaults")()), d1.render.samples, (d1.lib.fabric || []).some(f => "stretch" in f)];
    // saved again: the same bytes
    app.ev("openFile")("again.pdraft", b1, null, true); const b2 = saveBytes(); out.stable = b1.length === b2.length && b1.every((x, i) => x === b2[i]);
    // written with other defaults: a heavier preset, Solidify's Strength 70, a fold's strength 8, 10 stitches to the inch, a light's radius 80, a glue's Strength 2
    const d = app.fileDoc(b1), def = d.defaults;
    Object.assign(def.fabric["Heavy woven"], { stretch: 9e6, bend: 70000, friction: 0.5 }); def.solid3s = 70; def.foldStrength = 8; def.stitch.spi = 10; def.light.radius = 80; def.glueStrength = 2;
    app.ev("openLoaded")("older.pdraft", d, null, true);
    const den = S.lib.fabric.find(f => f.name === "Denim"), own = S.lib.fabric.find(f => f.name === "Own"), ph = app.fabricPhys(den), po = app.fabricPhys(own);
    const look = () => [S.pieces[0].solid3s, (S.pieces[1].internals[0] || {}).foldStrength, (S.stitches[0] || {}).spi, (S.lights[0] || {}).radius];
    out.filled = [ph.stretch, ph.bend, ph.friction, po.stretch === app.ev("FABRIC_PHYS").Custom.stretch, ...look()];
    app.redo(); out.redo = (S.glues[0] || {}).strength;
    app.undo(); app.undo(); out.undo = [app.fabricPhys(S.lib.fabric.find(f => f.name === "Denim")).stretch, ...look()];
    const d2 = app.fileDoc(saveBytes());
    out.kept = [d2.lib.fabric.find(f => f.name === "Denim").stretch, d2.pieces[0].solid3s];
    return out;` });
  assert.deepStrictEqual(o.errors, []);
  const r = o.result;
  assert.strictEqual(r.same, true, "this build's defaults are version 30's (when a default is changed on purpose, DEFAULTS_BY_VERSION keeps the old one and this expectation changes)");
  assert.deepStrictEqual(r.render, [256, "window", true], "a version 30 file never rendered: version 30's render defaults, not this machine's last choices (96 samples, a colour)");
  assert.deepStrictEqual(r.saved, [31, true, 256, false], "saved as version 31 with the render settings and the defaults said; nothing filled in");
  assert.strictEqual(r.stable, true, "saved, opened and saved again: the same bytes");
  assert.deepStrictEqual(r.filled, [9e6, 70000, 0.5, true, 70, 8, 10, 80], "the file's own defaults, each a value of its own; the Custom fabric as it was");
  assert.strictEqual(r.redo, 2, "a state of its history: the glue's Strength as it was written");
  // (two steps back: the state before Add Light, read from the file's history: no light in it yet)
  assert.deepStrictEqual(r.undo, [9e6, 70, 8, 10, null], "the history's states: the same defaults: " + JSON.stringify(r.undo));
  assert.deepStrictEqual(r.kept, [9e6, 70], "saved again: the filled-in values are the file's own");
});

module.exports = T;
