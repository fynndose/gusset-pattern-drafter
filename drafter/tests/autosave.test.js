// The autosave (crash recovery since R4): written only while there is unsaved work, cleared when there is none,
// read back on request, visible state, failure warning, unreadable data.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

function env(storage) {
  const el = { className: "", textContent: "", title: "" };
  const toasts = [], timers = [];
  const S = { pieces: [], seams: [], nextId: 1, nextSegId: 1, nextShapeId: 1 };
  const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", "normGuides", "mkAnchor", "anchorAt", "measureInfo", "validMeasures", "affOf", "affApply", "affMul", "syncHalf", "chainIdx", "reflector", "mkLinked", "AUTOSAVE_KEY", "kv", "saveState", "docJSON", "saveNow", "store", "NOTCH_DEFAULT", "normNotch", "loadDoc", "peekAutosave", "recoverDoc", "markClean",
    "validSeams", "loadSeams", "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "nSeg", "migrate", "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "normProps", "alignMirrorIds",
    "quarantineAutosave", "checkDoc", "V", "cp", "sub", "add", "mul", "vlen", "dist", "bez", "bezTan", "sEnds", "segLen", "segPt", "segTan",
    "flatten", "flattenSA", "signedArea", "outN", "lineX", "offsetVar", "CORNERS", "cornerPts", "cutLine", "inside", "reflectAcross", "dartGeom"], {
    S, localStorage: storage,
    document: { getElementById: () => el },
    toast: (m) => toasts.push(m),
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout: () => {},
    window: { addEventListener() {} },
    saveFailed: false, storeT: null, restoredRaw: null, autosaveHold: "", recoverPending: null,
    // the parts of the program the autosave only passes through: the cloth, the history, the page
    G3: { items: new Map() }, showDoc: () => {}, blankDoc: () => { S.pieces = []; S.seams = []; }, drapeOut: () => null, normDrape: () => null, histPack: () => null, histKeep: () => 0,
    console: { warn: () => {} },
  });
  return { G, S, el, toasts, timers };
}
// storeT / saveFailed are `let`s in the app; passed in here they become shared locals of the loaded functions
const memStore = () => { const m = new Map(); return {
  m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const backupKeys = (ls) => [...ls.m.keys()].filter(k => k.startsWith("pdraft:doc.unreadable."));
const rect = (id) => ({ id, name: "P" + id, on: true, closed: true,
  pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], internals: [], bases: [], darts: [],
  segs: [0, 1, 2].map(() => ({ curved: false, c1: null, c2: null, sa: 0, notches: [] })) });

const T = [];
const test = (name, fn) => T.push({ name, fn });

test("store() shows SAVING…, then writes the unsaved work and shows AUTOSAVED; once it is saved the autosave is cleared", () => {
  const ls = memStore(), { G, S, el, timers } = env(ls);
  S.pieces = [rect(1)]; S.nextId = 2;
  G.store();
  assert.strictEqual(S.dirty, true);
  assert.strictEqual(el.className, "pending"); assert.match(el.textContent, /SAVING/);
  assert.strictEqual(ls.m.size, 0, "debounced, not written yet");
  timers.pop()();
  assert.strictEqual(el.className, "ok"); assert.strictEqual(el.textContent, "AUTOSAVED"); assert.match(el.title, /not saved to a file yet/);
  const d = JSON.parse(ls.m.get("pdraft:doc"));
  assert.strictEqual(d.pieces.length, 1); assert.strictEqual(d.nextId, 2);
  assert.strictEqual(d.history, undefined, "the autosave carries no history");
  // saved to a file (or a new document): nothing is left to recover
  G.markClean();
  assert.strictEqual(S.dirty, false); assert.strictEqual(ls.m.has("pdraft:doc"), false);
  assert.strictEqual(el.textContent, "SAVED"); assert.match(el.title, /Nothing unsaved/);
});

test("what a session left unsaved is found and read back", () => {
  const ls = memStore();
  const a = env(ls); a.S.pieces = [rect(1), rect(5)]; a.S.nextId = 6; a.S.dirty = true; a.G.saveNow();
  const b = env(ls), rec = b.G.peekAutosave();
  assert.ok(rec && rec.d.pieces.length === 2);
  assert.deepStrictEqual(b.S.pieces, [], "found, not loaded: that is for the user to say");
  assert.strictEqual(b.G.recoverDoc(rec), true);
  assert.deepStrictEqual(b.S.pieces.map(p => p.id), [1, 5]); assert.strictEqual(b.S.nextId, 6);
  // nothing unsaved, or an empty document: nothing to offer
  assert.strictEqual(env(memStore()).G.peekAutosave(), null);
  const e = memStore(); e.m.set("pdraft:doc", JSON.stringify({ v: 11, pieces: [] }));
  assert.strictEqual(env(e).G.peekAutosave(), null); assert.strictEqual(e.m.has("pdraft:doc"), false);
});

test("while the question about unsaved work is open, nothing is written over it", () => {
  const ls = memStore(); ls.m.set("pdraft:doc", "the last session");
  const { G, S, timers } = env(ls);
  G.recoverPending = true;
  const H = load(["saveNow"], { S, localStorage: ls, document: { getElementById: () => ({}) }, window: {}, toast: () => {}, clearTimeout: () => {}, saveFailed: false, storeT: null, autosaveHold: "", recoverPending: { rec: 1 },
    docJSON: () => "new work", saveState: () => {} });
  S.dirty = true; H.saveNow();
  assert.strictEqual(ls.m.get("pdraft:doc"), "the last session");
});

test("a failing save turns the indicator red and warns once, then recovers", () => {
  let full = true;
  const ls = { getItem: () => null, setItem: () => { if (full) { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; } }, removeItem: () => {} };
  const { G, S, el, toasts } = env(ls);
  S.pieces = [rect(1)]; S.dirty = true;
  G.saveNow();
  // (Round build-1: the failure is told in words, for a colour-blind eye: "⚠ Autosave failed — click for details")
  assert.strictEqual(el.className, "bad"); assert.match(el.textContent, /Autosave failed — click for details/);
  assert.match(el.title, /full/); assert.strictEqual(toasts.length, 1); assert.match(toasts[0], /Autosave failed/);
  G.store();
  assert.strictEqual(el.className, "bad", "stays red while pending after a failure");
  G.saveNow();
  assert.strictEqual(toasts.length, 1, "no repeated toast while still failing");
  full = false; G.saveNow();
  assert.strictEqual(el.className, "ok");
});

test("blocked storage at start is reported, not swallowed", () => {
  const ls = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } };
  const { G, el } = env(ls);
  assert.strictEqual(G.peekAutosave(), null);
  assert.strictEqual(el.className, "bad"); assert.match(el.title, /unavailable/);
});

test("unreadable autosave is moved to a timestamped backup key and the user is told", () => {
  const ls = memStore(); ls.m.set("pdraft:doc", "{not json");
  const { G, toasts } = env(ls);
  assert.strictEqual(G.peekAutosave(), null);
  const keys = backupKeys(ls);
  assert.strictEqual(keys.length, 1); assert.strictEqual(ls.m.get(keys[0]), "{not json");
  assert.strictEqual(ls.m.has("pdraft:doc"), false, "main key cleared");
  assert.match(toasts[0], /couldn.t be opened/); assert.ok(toasts[0].includes(keys[0]), "toast names the backup key");
});

test("parseable but undrawable autosave is caught by checkDoc when it is recovered, and moved aside", () => {
  const ls = memStore();
  const bad = rect(1); bad.segs[1].curved = true; bad.segs[1].c1 = null;       // curved with no handle
  ls.m.set("pdraft:doc", JSON.stringify({ v: 5, pieces: [bad] }));
  const { G, S, toasts } = env(ls), rec = G.peekAutosave();
  assert.ok(rec, "it is a document, so it is offered");
  assert.strictEqual(G.recoverDoc(rec), false);
  assert.deepStrictEqual(S.pieces, [], "nothing half-loaded is left behind");
  assert.strictEqual(backupKeys(ls).length, 1); assert.strictEqual(toasts.length, 1);
});

test("if the backup can't be written, autosave is held so the old data isn't overwritten", () => {
  const ls = memStore(); ls.m.set("pdraft:doc", "{not json");
  ls.setItem = (k, v) => { if (k !== "pdraft:doc") throw new Error("full"); ls.m.set(k, v); };
  const { G, S, el } = env(ls);
  assert.strictEqual(G.peekAutosave(), null);
  assert.strictEqual(ls.m.get("pdraft:doc"), "{not json", "original left in place");
  S.pieces = [rect(1)]; S.dirty = true; G.saveNow();
  assert.strictEqual(ls.m.get("pdraft:doc"), "{not json", "autosave did not overwrite it");
  assert.strictEqual(el.className, "bad"); assert.match(el.title, /paused/);
});

module.exports = T;
