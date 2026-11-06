// Round H1d: the maintainer's answers to the H1c questions (Sew Check out of the bottom bar, a dot for unsaved changes), History Groups
// with time travel per group and the shared lane, Split Off and Cut Off Branch.
"use strict";
const FV = require("./harness").FILE_VERSION;      // this build's file version, read from the app's FILE_VERSION
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(require("os").tmpdir(), "pdraft-h1d-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
const DOC = `
  const rect = (k, y) => { app.push("Rectangle " + k); S.pieces.push(app.mkPiece("R" + k, app.mkShape([{ x: 500*k, y: y || 0 }, { x: 500*k + 300, y: y || 0 }, { x: 500*k + 300, y: (y || 0) + 200 }, { x: 500*k, y: (y || 0) + 200 }], true))); app.commit(); };
  const saveBytes = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return got; };
`;

test("h1d / 0: Sew Check is out of the bottom bar (its toolbar button, the 2D menu and Edit Sewing's right-click keep it; its limits in Settings); a dot after the file's name while there are unsaved changes, gone once saved", () => {
  const r = boot({ script: DOC + `
    const el = app.el;
    const out = {};
    rect(1); out.edited = el("wt-dirty").hidden; out.dirty = S.dirty;
    saveBytes(); out.saved = el("wt-dirty").hidden;
    return out;` });
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8");
  assert.ok(/<button id="s-sew" class="gone"/.test(html), "SEW CHECK is hidden in the bar");
  assert.ok(/<span id="wt-dirty" class="wt-dirty" hidden [^>]*>●</.test(html), "the dot, hidden at start, after the 3D title's name");
  assert.strictEqual(r.dirty, true); assert.strictEqual(r.edited, false, "a dot once something is unsaved");
  assert.strictEqual(r.saved, true, "gone once saved");
});

// a scene with two groups: Shirt (R1, R2) and Pants (R4), R3 in none; steps on each
const GROUPS = DOC + `
  const P = (k) => S.pieces.find(p => p.name === "R" + k);
  const move = (k, dy, n) => { app.push(n || "Move R" + k); P(k).pts.forEach(q => { q.y += dy; }); app.commit(); };
  const ys = () => [1, 2, 3, 4].map(k => P(k) ? P(k).pts[0].y : null).join(" ");
  const nodeOf = (n) => { const t = app.ev("histNodes")(); return [...t.nodes.values()].find(x => x.n === n).id; };
  const lanes = () => { const t = app.ev("histNodes")(), L = app.ev("hgLanes")(t.nodes, t.path, t.at); return L; };
  const laneOf = (n) => lanes().lane.get(nodeOf(n));
  const hereOf = (g) => { const L = lanes(), id = L.hereOf.get(g); return id == null ? null : app.ev("histNodes")().nodes.get(id).n; };
  rect(1); rect(2); rect(3); rect(4);
  S.sel = [P(1).id, P(2).id]; app.promptAnswer = "Shirt"; app.ev("hgCreate")(S.sel.slice());
  S.sel = [P(4).id]; app.promptAnswer = "Pants"; app.ev("hgCreate")(S.sel.slice()); app.promptAnswer = undefined;
  const shirt = S.hgroups.find(g => g.name === "Shirt").id, pants = S.hgroups.find(g => g.name === "Pants").id;
  move(1, 10, "Shirt 1"); move(3, 10, "Free 1"); move(4, 10, "Pants 1"); move(2, 10, "Shirt 2"); move(4, 10, "Pants 2"); move(1, 10, "Shirt 3");
`;

test("h1d / B1: a History Group: each step goes to the lane of the patterns it changed; a pattern in no group, or several groups, is the Shared lane; a new pattern made from a group's pattern joins it", () => {
  const r = boot({ blank: true, script: GROUPS + `
    const out = { lanes: ["Rectangle 1", "Create History Group", "Shirt 1", "Free 1", "Pants 1", "Shirt 2", "Shirt 3"].map(n => { const l = laneOf(n); return l === shirt ? "shirt" : l === pants ? "pants" : l; }) };
    // both groups at once: Shared
    app.push("Both"); P(1).pts[0].x += 1; P(4).pts[0].x += 1; app.commit(); out.both = laneOf("Both");
    // a new pattern made by a step that changed only a Shirt pattern joins the Shirt
    app.push("Cut-like"); P(2).pts[0].x += 1; S.pieces.push(app.mkPiece("R9", app.mkShape([{ x: 0, y: 900 }, { x: 50, y: 900 }, { x: 50, y: 950 }], true))); app.commit();
    out.joined = S.hgroups.find(g => g.id === shirt).pieces.includes(S.pieces.find(p => p.name === "R9").id);
    app.undo(); app.redo();
    out.joinedAfterRedo = S.hgroups.find(g => g.id === shirt).pieces.length;
    out.bands = app.ev("hpLayout")().bands.map(b => b.def ? b.def.name : "Shared");
    return out;` });
  assert.deepStrictEqual(r.lanes, ["s", "shirt", "shirt", "s", "pants", "shirt", "shirt"], "the group's making is its lane's first step; R3 is in no group");
  assert.strictEqual(r.both, "s", "a step on two groups is Shared");
  assert.strictEqual(r.joined, true); assert.strictEqual(r.joinedAfterRedo, 3, "undo and redo change nothing of it");
  assert.deepStrictEqual(r.bands, ["Shared", "Shirt", "Pants"], "a band a lane, Shared first");
});

test("h1d / B2: time travel per group: a double-click in the Shirt's lane takes only the Shirt back (R3 and the Pants stay); it is a step of its own, which Ctrl+Z undoes; each lane has its own position; going on in the lane asks Keep / Delete for the lane's old future", () => {
  const r = boot({ blank: true, script: GROUPS + `
    const out = { before: ys(), shirtAt0: hereOf(shirt), pantsAt0: hereOf(pants) };
    app.ev("hgGo")(shirt, nodeOf("Shirt 1"));
    out.after = ys(); out.shirtAt = hereOf(shirt); out.pantsAt = hereOf(pants); out.step = S.un[S.un.length - 1].n;
    // another double-click in the same lane straight after takes the ⤺ step's place
    const n0 = S.un.length; app.ev("hgGo")(shirt, nodeOf("Shirt 2")); out.again = [ys(), S.un.length - n0, S.un[S.un.length - 1].n];
    app.ev("hgGo")(shirt, nodeOf("Shirt 1"));
    // hatched: the Shirt's old future (Shirt 2, Shirt 3); not the Pants'
    const L = app.ev("hpLayout")(), card = (n) => L.cards.find(c => c.n === n);
    out.later = ["Shirt 1", "Shirt 2", "Shirt 3", "Pants 2"].map(n => card(n).later);
    out.here = L.cards.filter(c => c.here).map(c => c.n).sort();
    app.undo(); out.undone = ys(); app.redo(); out.redone = ys();
    // the first Shirt step after the ⤺: the box for the lane's future; Delete, then Delete again
    let asked = [];
    app.modalAnswer = (t) => { asked.push(t); return t.startsWith("Keep the Old Future of") ? "delete" : t.startsWith("Delete the Future of") ? "delete" : "discard"; };
    move(2, 5, "Shirt 4"); app.runTimers();
    out.asked = asked; out.afterDelete = ys();
    const t = app.ev("histNodes")(); out.names = [...t.nodes.values()].map(x => x.n);
    return out;` });
  assert.strictEqual(r.before, "20 10 10 20");
  assert.strictEqual(r.after, "10 0 10 20", "the Shirt is as after Shirt 1; R3 and the Pants did not move");
  assert.strictEqual(r.step, "⤺ Shirt: Shirt 1");
  assert.strictEqual(r.shirtAt0, "Shirt 3"); assert.strictEqual(r.shirtAt, "⤺ Shirt: Shirt 1"); assert.strictEqual(r.pantsAt, "Pants 2", "each lane its own position");
  assert.deepStrictEqual(r.again, ["10 10 10 20", 0, "⤺ Shirt: Shirt 2"], "in the place of the step before");
  assert.deepStrictEqual(r.later, [false, true, true, false]);
  assert.deepStrictEqual(r.undone, "20 10 10 20", "Ctrl+Z undoes the ⤺ like any step");
  assert.strictEqual(r.redone, "10 0 10 20");
  assert.deepStrictEqual(r.asked, ["Keep the Old Future of Shirt?", "Delete the Future of Shirt?"]);
  assert.strictEqual(r.afterDelete, "10 5 10 20", "the document as it was");
  assert.ok(!r.names.includes("Shirt 2") && !r.names.includes("Shirt 3"), "the Shirt's old future is gone: " + r.names);
  assert.ok(r.names.includes("Pants 2") && r.names.includes("Free 1"), "the other lanes' steps stay");
});

test("h1d / B3: groups, lanes, the ⤺ steps and each lane's position are in the file: saved, opened and saved again, the same bytes and the same lanes; rename and ungroup from the lane's menu", () => {
  const r = boot({ blank: true, script: GROUPS + `
    return (() => {
      app.ev("hgGo")(shirt, nodeOf("Shirt 1"));
      const lay = () => { const L = app.ev("hpLayout")(); return JSON.stringify([L.bands.map(b => [b.def ? b.def.name : "Shared", b.gone]), L.cards.map(c => [c.n, c.lane === "s" ? "s" : "g", c.here, c.later])]); };
      const was = lay(), groups = JSON.stringify(S.hgroups);
      const bytes = saveBytes();
      app.ev("openFile")("g.pdraft", bytes, null, true);
      const again = saveBytes();
      const out = { same: lay() === was, lay: [was, lay()], groups: JSON.stringify(S.hgroups) === groups, bytes: bytes.length === again.length && bytes.every((x, i) => x === again[i]), fv: app.fileDoc(bytes).v };
      { const A = app.fileDoc(bytes), B = app.fileDoc(again), diff = []; const walk = (a, b, p) => { if (JSON.stringify(a) === JSON.stringify(b)) return; if (a && b && typeof a === "object" && typeof b === "object" && diff.length < 6) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p + "." + k); } else diff.push(p + ": " + String(JSON.stringify(a)).slice(0, 200) + " | " + String(JSON.stringify(b)).slice(0, 200)); }; walk(A, B, ""); out.diff = diff; }
      app.promptAnswer = "Shirt (front)"; app.ev("hgRename")(shirt); app.promptAnswer = undefined;
      app.ev("hgUngroup")(pants);
      const L = app.ev("hpLayout")();
      out.bands = L.bands.map(b => (b.def ? b.def.name : "Shared") + (b.gone ? " (ungrouped)" : ""));
      app.undo(); out.back = S.hgroups.map(g => g.name);
      return out;
    })();` });
  assert.strictEqual(r.fv, FV);
  assert.ok(r.same, "the lanes, positions and branches as they were: " + JSON.stringify(r.lay)); assert.ok(r.groups); assert.ok(r.bytes, "saved again, the same bytes: " + JSON.stringify(r.diff));
  assert.deepStrictEqual(r.bands, ["Shared", "Shirt (front)", "Pants (ungrouped)"]);
  assert.deepStrictEqual(r.back, ["Shirt (front)", "Pants"], "Ungroup is a step");
});

test("h1d / C1: Split Off: copies of a group's patterns as they were after a step hang on the pointer; set down, they are a new History Group whose lane keeps its link to that step; one step, undone like any other; Esc leaves the document as it was", () => {
  const r = boot({ blank: true, script: GROUPS + `
    const out = { n0: S.pieces.length };
    const at1 = nodeOf("Shirt 1");
    app.ev("hgSplitOff")(shirt, at1); app.ev("S").place = null; out.esc = [S.pieces.length, S.hgroups.length];      // given up: nothing changed
    app.ev("hgSplitOff")(shirt, at1); S.place.drop({ x: 0, y: 0 }); S.place = null;
    const g = S.hgroups[S.hgroups.length - 1];
    out.group = [g.name, g.pieces.length, g.from && g.from.node === at1 && g.from.group === shirt];
    out.copies = S.pieces.filter(p => /[(]split[)]/.test(p.name)).map(p => p.name + "@" + p.pts[0].y);
    out.lane = laneOf("Split Off") === g.id;
    const L = app.ev("hpLayout")();
    out.bands = L.bands.map(b => b.def ? b.def.name : "Shared"); out.links = L.links.map(k => [k.a.n, k.b.n]);
    // a step on a copy goes to the new lane, the Shirt's stays where it was
    app.push("Split 1"); S.pieces.find(p => p.name === "R1 (split)").pts[0].x += 5; app.commit(); out.split1 = laneOf("Split 1") === g.id;
    app.undo(); app.undo(); out.undone = [S.pieces.length, S.hgroups.length];
    return out;` });
  assert.deepStrictEqual(r.esc, [r.n0, 2], "Esc: nothing changed");
  assert.deepStrictEqual(r.group, ["Shirt (split)", 2, true]);
  assert.deepStrictEqual(r.copies, ["R1 (split)@10", "R2 (split)@0"], "as they were after Shirt 1");
  assert.ok(r.lane); assert.ok(r.split1);
  assert.deepStrictEqual(r.bands, ["Shared", "Shirt", "Pants", "Shirt (split)"]);
  assert.deepStrictEqual(r.links, [["Shirt 1", "Split Off"]], "a dotted cable from the step it came from");
  assert.deepStrictEqual(r.undone, [r.n0, 2], "undone: the copies and their group gone");
});

test("h1d / C2: Cut Off Branch: asked first; the group's lane starts at that step (the steps before it and the split-off link dropped from the lane); one step, undone like any other; only on the branch the group is on; split off, cut off, saved and opened, the same bytes", () => {
  const r = boot({ blank: true, script: GROUPS + `
    const out = {};
    app.ev("hgSplitOff")(shirt, nodeOf("Shirt 1")); S.place.drop({ x: 0, y: 0 }); S.place = null;
    const sg = S.hgroups[S.hgroups.length - 1].id;
    app.push("Split 1"); S.pieces.find(p => p.name === "R1 (split)").pts[0].x += 5; app.commit();
    const shown = () => app.ev("hpLayout")().cards.filter(c => c.lane === shirt).map(c => c.n);
    out.before = shown();
    let asked = []; app.modalAnswer = (t) => { asked.push(t); return t === "Cut Off Branch" ? "cut" : "discard"; };
    app.ev("hgCutOffAsk")(shirt, nodeOf("Shirt 2"));
    out.asked = asked.slice(); out.after = shown(); out.doc = ys(); out.step = S.un[S.un.length - 1].n;
    app.ev("hgCutOffAsk")(sg, nodeOf("Split 1"));
    out.links = app.ev("hpLayout")().links.length; out.from = !!S.hgroups.find(g => g.id === sg).from;
    const bytes = saveBytes(); app.ev("openFile")("c.pdraft", bytes, null, true); const again = saveBytes();
    out.same = bytes.length === again.length && bytes.every((x, i) => x === again[i]); out.reopened = shown();
    app.undo(); app.undo(); out.undone = [shown(), app.ev("hpLayout")().links.length];
    // not on the branch the Shirt is on: refused
    app.ev("hgGo")(shirt, nodeOf("Shirt 1")); asked = [];
    app.ev("hgCutOffAsk")(shirt, nodeOf("Shirt 3")); out.refused = asked.length;
    return out;` });
  assert.deepStrictEqual(r.before, ["Create History Group", "Shirt 1", "Shirt 2", "Shirt 3"]);
  assert.deepStrictEqual(r.asked, ["Cut Off Branch"], "asked first: " + JSON.stringify(r.asked));
  assert.deepStrictEqual(r.after, ["Shirt 2", "Shirt 3", "Cut Off Branch"], "the lane starts at Shirt 2");
  assert.strictEqual(r.doc, "20 10 10 20", "the document did not change");
  assert.strictEqual(r.step, "Cut Off Branch");
  assert.strictEqual(r.links, 0); assert.strictEqual(r.from, false, "the split-off group is on its own");
  assert.ok(r.same, "saved, opened, saved again: the same bytes"); assert.deepStrictEqual(r.reopened, r.after);
  assert.deepStrictEqual(r.undone, [[...r.before, "Cut Off Branch"], 1], "undone: the steps and the link back (the undone step ahead, hatched): " + JSON.stringify(r.undone));
  assert.strictEqual(r.refused, 0, "a step off the group's branch is not asked about");
});

test("h1e / 2: Split Off copies the seams with both ends among the group's patterns (onto the copies, new ids); a seam to a pattern outside the group is not copied; undone with the step", () => {
  const r = boot({ blank: true, script: GROUPS + `
    const sew = (a, b) => { app.push("Sew"); S.seams.push({ id: S.seams.reduce((m, s) => Math.max(m, s.id), 0) + 1, a: [{ piece: P(a).id, shape: 0, sids: [P(a).segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: P(b).id, shape: 0, sids: [P(b).segs[3].id], t0: 0, t1: 1, rev: true }] }); app.commit(); };
    sew(1, 2); sew(2, 3);                                    // R1-R2 within the Shirt, R2-R3 to a pattern in no group
    const n0 = S.seams.length;
    app.ev("hgSplitOff")(shirt, app.ev("histAtId")()); S.place.drop({ x: 0, y: 0 }); S.place = null;
    const copies = new Set(S.pieces.filter(p => /[(]split[)]/.test(p.name)).map(p => p.id)), name = (id) => S.pieces.find(p => p.id === id).name;
    const out = { added: S.seams.length - n0, copied: S.seams.slice(n0).map(sm => [...sm.a, ...sm.b].map(x => name(x.piece))), ids: new Set(S.seams.map(s => s.id)).size === S.seams.length,
      inGroup: S.seams.slice(n0).every(sm => [...sm.a, ...sm.b].every(x => copies.has(x.piece))) };
    app.undo(); out.undone = S.seams.length - n0;
    return out;` });
  assert.strictEqual(r.added, 1, "only the seam within the group");
  assert.deepStrictEqual(r.copied, [["R1 (split)", "R2 (split)"]]);
  assert.ok(r.ids, "a new id"); assert.ok(r.inGroup);
  assert.strictEqual(r.undone, 0);
});

test("h1e / 3: the steps a Cut Off Branch hid stay while undo can reach them, and saved and opened they are still there, still hidden; Condense History drops them for good (a Save State on one too) and counts them", () => {
  const r = boot({ blank: true, script: GROUPS + `
    const out = {};
    S.hsave.set(nodeOf("Shirt 1"), "Old fit");
    app.modalAnswer = (t) => (t === "Cut Off Branch" ? "cut" : "discard"); app.ev("hgCutOffAsk")(shirt, nodeOf("Shirt 2")); app.modalAnswer = undefined;
    const hidden = () => { const t = app.ev("histNodes")(), L = app.ev("hgLanes")(t.nodes, t.path, t.at); return [...L.hidden].map(id => t.nodes.get(id).n).sort(); };
    out.hidden = hidden();
    // undo still reaches them: back past the cut to before Shirt 1, then forward again
    const doc = ys(), n = S.un.length, back = S.un.findIndex(x => x.n === "Shirt 1");
    app.histGo(back); out.reached = ys(); app.histGo(n); out.again = ys() === doc;
    // saved and opened: still there, still hidden
    const bytes = saveBytes(); app.ev("openFile")("h.pdraft", bytes, null, true);
    out.reopened = hidden(); out.inFile = app.fileDoc(bytes).history.nodes.filter(x => x.n === "Shirt 1" || x.n === "Create History Group").length;
    // Condense: gone for good, counted
    const size0 = app.ev("histTextSize")(), all0 = app.ev("histNodes")().nodes.size;
    const c = app.ev("histCondense")();
    const names = [...app.ev("histNodes")().nodes.values()].map(x => x.n);
    out.condensed = { hidden: c.hidden, gone: !names.includes("Shirt 1"), save: [...S.hsave.values()], doc: ys() === doc, smaller: app.ev("histTextSize")() < size0, before: c.before === all0 - 1, left: hidden() };
    out.lane = app.ev("hpLayout")().cards.filter(x => x.lane === shirt).map(x => x.n);
    return out;` });
  assert.deepStrictEqual(r.hidden, ["Create History Group", "Shirt 1"].sort(), "the Shirt's steps before Shirt 2");
  assert.strictEqual(r.reached, "0 0 0 0", "undo goes back through them"); assert.ok(r.again);
  assert.deepStrictEqual(r.reopened, r.hidden, "saved and opened: kept, still hidden"); assert.ok(r.inFile >= 2, "in the file");
  assert.strictEqual(r.condensed.hidden, 2, "counted");
  assert.ok(r.condensed.gone); assert.deepStrictEqual(r.condensed.save, [], "the Save State on a hidden step went with it");
  assert.ok(r.condensed.doc, "the document as it was"); assert.ok(r.condensed.smaller); assert.ok(r.condensed.before);
  assert.deepStrictEqual(r.condensed.left, [], "nothing hidden is left");
  assert.strictEqual(r.lane[0], "Shirt 2", "the lane starts at the cut: " + JSON.stringify(r.lane));
});

module.exports = T;
