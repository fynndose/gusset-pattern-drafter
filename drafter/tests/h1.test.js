// Round H1: the history as a tree. Going back and making a step keeps the steps undone as a branch; any node can be gone to; the
// cap keeps Save States and branch points; the file keeps the whole tree and the cloth of Save States and branch points; a step whose
// cloth was not kept asks for a Re-drape.
"use strict";
const FV = require("./harness").FILE_VERSION;      // (Round H1) this build's file version, read from the app's FILE_VERSION
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(require("os").tmpdir(), "pdraft-h1-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
// a rectangle step by step, and what the document is as text (its patterns' names and first points)
const DOC = `
  const rect = (k) => { app.push("Rectangle " + k); S.pieces.push(app.mkPiece("R" + k, app.mkShape([{ x: 500*k, y: 0 }, { x: 500*k + 300, y: 0 }, { x: 500*k + 300, y: 200 }, { x: 500*k, y: 200 }], true))); app.commit(); };
  const doc = () => S.pieces.map(p => p.name + "@" + p.pts[0].x).join(" ");
  const tree = () => { const t = app.ev("histNodes")(); return { path: t.path, at: t.at, off: [...S.hoff.keys()].sort((a, b) => a - b) }; };
  // (Round UI-1 / A) a branch is kept only after going back FROM THE HISTORY PANEL (treeGo()); Ctrl+Z then a change is plain undo, so
  // the tests that make branches go back n steps from the panel where they pressed undo before
  const back = (n) => { const t = app.ev("histNodes")(); app.ev("treeGo")(t.path[t.at - n]); };
  const saveBytes = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return got; };
`;

test("h1 / 1: going back and making a step keeps the steps undone as a branch; a step taken back takes the branch back with it; any node can be gone to, its document exactly as it was", () => {
  const r = boot({ blank: true, script: DOC + `
    const out = {};
    rect(0); rect(1); rect(2); rect(3);                         // nodes 1 to 4
    out.d4 = doc();
    back(2);                                                    // at node 2; 3 and 4 undone (from the panel: Round UI-1 / A)
    out.d2 = doc();
    rect(5);                                                    // node 5: a branch from node 2
    out.fork = tree();
    // a step taken back (a command that could not be done): the branch is the future again
    app.push("Nothing"); app.ev("unpush")();
    out.unpushed = tree();
    // go to node 4 on the other branch: the document as it was there; the path is now 0 1 2 3 4, node 5 off it
    out.d5 = doc();
    app.ev("treeGo")(4); out.at4 = [doc(), tree()];
    app.ev("treeGo")(5); out.at5 = [doc(), tree()];
    app.ev("treeGo")(3); out.at3 = [doc(), tree()];
    // a press that changed nothing after going back: no step, no branch
    app.ev("treeGo")(2); const before = tree(); app.ev("pressMark")(); app.push("Select"); app.ev("pressDrop")(); out.press = [JSON.stringify(tree()) === JSON.stringify(before), S.redo.length];
    return out;` });
  assert.deepStrictEqual(r.fork, { path: [0, 1, 2, 5], at: 3, off: [3, 4] }, "3 and 4 kept, hanging from 2");
  assert.deepStrictEqual(r.unpushed, { path: [0, 1, 2, 5], at: 3, off: [3, 4] }, "the step taken back: the tree as it was");
  assert.deepStrictEqual(r.at4, [r.d4, { path: [0, 1, 2, 3, 4], at: 4, off: [5] }]);
  assert.deepStrictEqual(r.at5, [r.d5, { path: [0, 1, 2, 5], at: 3, off: [3, 4] }]);
  assert.deepStrictEqual(r.at3[1], { path: [0, 1, 2, 3, 4], at: 3, off: [5] }, "a node on a branch: the path runs on to that branch's end");
  assert.deepStrictEqual(r.press, [true, 2], "a click that only selects: no step, the future still the future");
});

test("h1 / 2: at most 500 steps on the path; the oldest plain step goes first, never a Save State or a branch point", () => {
  const r = boot({ blank: true, script: DOC + `
    rect(0); rect(1); rect(2);                                  // nodes 1, 2, 3
    S.hsave.set(1, "First");                                   // a Save State on node 1
    back(1); rect(4);                                           // node 4 from 2: node 2 a branch point (3 off the path)
    for (let k = 0; k < 520; k++) { app.push("Move"); S.pieces[0].pts[0].x += 1; app.commit(); }
    const t = app.ev("histNodes")();
    return { len: S.un.length + S.rn.length, has1: t.path.includes(1), has2: t.path.includes(2), first: S.un.slice(0, 4).map(s => s.n), x: S.pieces[0].pts[0].x };` });
  assert.strictEqual(r.len, 500);
  assert.deepStrictEqual([r.has1, r.has2], [true, true], "the Save State and the branch point stay");
  assert.deepStrictEqual(r.first.slice(0, 2), ["Rectangle 0", "Rectangle 1"]);
  assert.strictEqual(r.x, 520, "the document is the last step's");
});

test("h1 / 3: the file keeps the whole tree (history v4), its Save States, places in the panel and the cloth of Save States and branch points; saved, opened and saved again it is the same bytes; an older file's history is one strand", () => {
  const v30 = Array.from(fs.readFileSync(path.join(__dirname, "files", "v30", "defaults-sewn-history.pdraft")));
  const r = boot({ blank: true, script: DOC + `
    const out = {};
    rect(0); rect(1); rect(2); back(1); rect(3);
    S.hsave.set(1, "Base"); S.hui[3] = { x: 120, y: 40 };
    const t0 = tree(), d0 = doc();
    const b1 = saveBytes(), h = app.fileDoc(b1).history;
    out.file = [h.v, h.fv, h.at, h.head, h.nodes.map(n => [n.id, n.up === undefined ? null : n.up, n.n, n.save || null, n.ui || null])];
    app.ev("openFile")("t.pdraft", b1, null, true);
    out.back = [JSON.stringify(tree()) === JSON.stringify(t0), doc() === d0, S.hsave.get(1), S.hui[3]];
    const b2 = saveBytes(); out.same = b1.length === b2.length && b1.every((x, i) => x === b2[i]);
    app.ev("treeGo")(2); out.two = doc();
    // a version 30 file: its history one strand, nothing off it
    app.ev("openFile")("v30.pdraft", new Uint8Array(${JSON.stringify(v30)}), null, true);
    out.v30 = [S.hoff.size, S.un.length + S.rn.length, app.ev("histNodes")().path.length];
    return out;` });
  assert.strictEqual(r.file[0], 4); assert.strictEqual(r.file[1], FV);
  assert.deepStrictEqual(r.file.slice(2), [4, 4, [[0, null, "Start", null, null], [1, 0, "Rectangle 0", "Base", null], [2, 1, "Rectangle 1", null, null], [3, 2, "Rectangle 2", null, { x: 120, y: 40 }], [4, 2, "Rectangle 3", null, null]]]);
  assert.deepStrictEqual(r.back, [true, true, "Base", { x: 120, y: 40 }]);
  assert.strictEqual(r.same, true, "saved, opened, saved again: the same bytes");
  assert.ok(/^R0@0 R1@500$/.test(r.two), r.two);
  assert.strictEqual(r.v30[0], 0, "an older file's history is one strand: nothing off the path");
  assert.strictEqual(r.v30[2], r.v30[1] + 1);
});

const MARTY = path.join(__dirname, "..", "assets", "avatar", "presets", "marty.glb"), hasMarty = fs.existsSync(MARTY);
test("h1 / 4: a simulated step whose cloth is not kept (in a file only Save States and branch points keep theirs) asks for a Re-drape when it is gone to; a Save State's cloth comes back" + (hasMarty ? "" : " (Marty is not here: skipped)"), () => {
  if (!hasMarty) return;
  const r = boot({ blank: true, three: true, script: DOC + `
    return (async () => {
      const out = {}, G3 = app.ev("G3"), cloth = () => { const it = G3.items.get(S.pieces[0].id); return it && it.X ? Array.from(it.X.slice(0, 6)).map(v => Math.round(v)) : null; };
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      app.push("Rectangle"); S.pieces.push(app.mkPiece("Front", app.mkShape([{ x: -150, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 300 }, { x: -150, y: 300 }], true))); app.commit(); app.ev("garmentSync")();
      app.ev("simStart")(); for (let i = 0; i < 20; i++) app.ev("simFrame")(); app.ev("simStop")();       // node 2: Simulate
      const sim1 = app.ev("histAtId")(); out.c1 = cloth();
      app.ev("simStart")(); for (let i = 0; i < 20; i++) app.ev("simFrame")(); app.ev("simStop")();       // node 3: Simulate again
      out.c2 = cloth();
      S.hsave.set(sim1, "Draped once");
      app.push("Rename"); S.pieces[0].name = "Front B"; app.commit();                                     // node 4
      const b = saveBytes();
      app.ev("openFile")("d.pdraft", b, null, true); app.ev("garmentSync")();
      app.undo();                                                 // to node 3: its cloth was not kept (the current one was node 4's)
      out.at3 = [G3.redrape === true, /Re-drape/.test(app.el("note3d").textContent)];
      app.undo();                                                 // to node 2, the Save State: its cloth comes back, the mark goes
      out.at2 = [G3.redrape === true, JSON.stringify(cloth()) === JSON.stringify(out.c1)];
      out.parts = app.fileParts(b).map(p => p[0]).sort();
      return out;
    })();` });
  assert.ok(r.parts.includes("histcloth.bin"), "the Save State's cloth is in the file: " + r.parts);
  assert.deepStrictEqual(r.at3, [true, true], "a step whose cloth was not kept: the 3D window asks for a Re-drape");
  assert.deepStrictEqual(r.at2, [false, true], "the Save State: its cloth, as it was");
});

test("h1b / 1: the cloth beside the autosave is written once and not again while it does not change; recovery puts it back exactly; a branch point's cloth goes into the file only with Keep Cloth at Branch Points, a Save State's always" + (hasMarty ? "" : " (Marty is not here: skipped)"), () => {
  if (!hasMarty) return;
  const a = boot({ blank: true, three: true, script: DOC + `
    return (async () => {
      const out = {}, G3 = app.ev("G3"), cloth = () => { const it = G3.items.get(S.pieces[0].id); return it && it.X ? Array.from(it.X).map(v => Math.round(v * 100)) : null; };
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      app.push("Rectangle"); S.pieces.push(app.mkPiece("Front", app.mkShape([{ x: -150, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 300 }, { x: -150, y: 300 }], true))); app.commit(); app.ev("garmentSync")();
      app.ev("simStart")(); for (let i = 0; i < 20; i++) app.ev("simFrame")(); app.ev("simStop")();
      const sim = app.ev("histAtId")();
      app.push("Rename"); S.pieces[0].name = "A"; app.commit();
      app.ev("saveNow")();
      const c1 = app.storage.get("pdraft:doccloth"), d1 = app.storage.get("pdraft:doc");
      out.first = [typeof c1 === "string" && c1.length > 1000, !/"drape":{/.test(d1), JSON.parse(d1).clothSig === JSON.parse(c1).sig];
      // a 2D edit: the document's autosave is new, its cloth entry the very same text (not written again)
      app.storage.set("pdraft:doccloth", "MARK" + c1);
      app.push("Rename"); S.pieces[0].name = "B"; app.commit(); app.ev("saveNow")();
      out.kept = app.storage.get("pdraft:doccloth") === "MARK" + c1;
      app.storage.set("pdraft:doccloth", c1);
      // a branch off the simulated step, the cloth at its branch point: only with the setting; a Save State always
      app.ev("treeGo")(sim); app.push("Rename"); S.pieces[0].name = "C"; app.commit();
      const parts = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return app.fileParts(got).map(p => p[0]); };
      out.off = parts().includes("histcloth.bin");
      app.setPrefs({ keepBranchCloth: true }); out.on = parts().includes("histcloth.bin");
      app.setPrefs({ keepBranchCloth: false }); S.hsave.set(sim, "S"); out.save = parts().includes("histcloth.bin");
      app.push("Rename"); S.pieces[0].name = "D"; app.commit(); app.ev("saveNow")();
      out.cloth = cloth(); out.seed = app.storage.get("pdraft:doc"); out.side = app.storage.get("pdraft:doccloth");
      return out;
    })();` });
  assert.deepStrictEqual(a.first, [true, true, true], "the cloth beside the autosave, named by its signature");
  assert.strictEqual(a.kept, true, "a 2D edit leaves the cloth's entry unwritten");
  assert.deepStrictEqual([a.off, a.on, a.save], [false, true, true], "a branch point's cloth only with the setting; a Save State's always");
  // (Marty first, then the answer to the question: the test page cannot fetch his script, as recovery would)
  const b = boot({ blank: true, three: true, recover: "ask", seed: a.seed, storage: { "pdraft:doccloth": a.side }, script: `
    return (async () => {
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      app.modalPick("recover");
      app.ev("setLayout")("both"); app.ev("garmentSync")();
      const it = app.ev("G3").items.get(S.pieces[0].id);
      return { name: S.pieces[0].name, cloth: it && it.X ? Array.from(it.X).map(v => Math.round(v * 100)) : null, save: [...S.hsave.values()] };
    })();` });
  assert.strictEqual(b.name, "D");
  assert.deepStrictEqual(b.cloth, a.cloth, "recovered: the cloth as it was");
  assert.deepStrictEqual(b.save, ["S"]);
});

test("h1b / 3: going back and editing asks Keep or Delete for the old future (Delete asks again); with the project's history off nothing is kept or asked and the file has none; Save States from a card's menu; Condense History keeps the start, Save States, branch points, branch ends and the document's step; a new project asks, and Remember my choice is the preference", () => {
  const r = boot({ blank: true, script: DOC + `
    const out = {};
    app.modalAnswer = () => undefined;                          // (every question left open, answered below by hand)
    rect(0); rect(1); rect(2); rect(3);
    back(2); rect(4); app.runTimers();
    out.asked = app.ev("modalNow") && app.ev("modalNow").title;
    app.modalPick("keep"); out.kept = tree().off;
    // Delete, then Delete again
    back(1); rect(5); app.runTimers(); app.modalPick("delete"); out.second = app.ev("modalNow") && app.ev("modalNow").title; app.modalPick("delete");
    out.deleted = tree().off;
    // the project's history off: the old future goes as it always did, no box, nothing in the file
    app.ev("histSwitch")(false); back(1); rect(6); app.runTimers();
    out.off = [tree().off, !!app.ev("modalNow"), (() => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return app.fileParts(got).map(p => p[0]).includes("history.json"); })()];
    app.ev("histSwitch")(true);
    // a Save State from a card's right-click menu
    app.setTimeline(true);
    const c = app.ev("hpLayout")().cards.find(x => x.n === "Rectangle 1"), p = app.ev("hpToScreen")(c.x + 60, c.y + 34);
    app.menu.children.length = 0; app.promptAnswer = "Fitted"; app.fireOn("hp-cv", "pointerdown", { clientX: p.x, clientY: p.y, button: 2 });
    out.menu = app.menu.children.map(x => (x.innerHTML || "").replace(/<[^>]*>/g, "")).filter(Boolean);
    const row = app.menu.children.find(x => /Add Save State/.test(x.innerHTML)); row.onclick({ stopPropagation() {} }); app.promptAnswer = undefined;
    out.save = [...S.hsave.entries()];
    // Condense: a branch, a run of steps, a Save State
    back(2); rect(7); app.runTimers(); app.modalPick("keep");
    for (let k = 0; k < 4; k++) { app.push("Nudge"); S.pieces[0].pts[0].x += 1; app.commit(); }
    const before = app.ev("histNodes")().nodes.size;
    app.ev("histCondenseAsk")(); out.condenseAsk = app.ev("modalNow") && app.ev("modalNow").title; app.modalPick("condense");
    const t = app.ev("histNodes")(), kids = app.ev("histKids")(t.nodes);
    out.condensed = [before, t.nodes.size, [...t.nodes.values()].every(x => x.id === 0 || x.id === t.path[t.at] || S.hsave.has(x.id) || (kids.get(x.id) || []).length !== 1), S.hsave.size, toasts.slice(-1)[0]];
    // a new project: asked; Remember my choice
    app.ev("newDoc")(true); out.newAsk = app.ev("modalNow") && app.ev("modalNow").title;
    app.el("hist-remember").checked = true; app.modalPick("off");
    out.newOff = [S.histOn, S.prefs.histNew];
    app.ev("newDoc")(true); out.again = [!!app.ev("modalNow"), S.histOn];
    return out;` });
  assert.strictEqual(r.asked, "Keep the Old Future?");
  assert.deepStrictEqual(r.kept, [3, 4]);
  assert.strictEqual(r.second, "Delete the Future?");
  assert.deepStrictEqual(r.deleted, [3, 4], "the step undone before rect 5 (node 5's future) deleted; the earlier branch stays");
  assert.deepStrictEqual(r.off, [[3, 4], false, false]);
  assert.ok(r.menu.includes("Add Save State…") && r.menu.includes("Go to This Step"), JSON.stringify(r.menu));
  assert.strictEqual(r.save.length, 1); assert.strictEqual(r.save[0][1], "Fitted");
  assert.strictEqual(r.condenseAsk, "Condense History");
  assert.ok(r.condensed[1] < r.condensed[0] && r.condensed[2] && r.condensed[3] === 1, JSON.stringify(r.condensed));
  assert.ok(/History condensed: [0-9]+ → [0-9]+ steps, [0-9.]+ MB → [0-9.]+ MB/.test(r.condensed[4]), r.condensed[4]);
  assert.strictEqual(r.newAsk, "Keep a History?");
  assert.deepStrictEqual(r.newOff, [false, "off"]);
  assert.deepStrictEqual(r.again, [false, false], "remembered: not asked again, the history off");
});

module.exports = T;
