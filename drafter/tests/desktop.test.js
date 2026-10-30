// The desktop app's side of the page: with window.desktop present (a stand-in for
// desktop/preload.js, see boot-child.js) autosave goes to its store, Save writes in
// place, Open and Recent use real paths, and Print goes to the shell. Without it the
// page behaves as it always did in a browser.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
const T = [];
const test = (name, fn) => T.push({ name, fn });
const A = "C:\\patterns\\skirt.pdraft", B = "C:\\patterns\\copy.pdraft";
let DOC;
const doc = (name) => { DOC = DOC || boot().storage["pdraft:doc"]; const d = JSON.parse(DOC); if (name) d.pieces[0].name = name; return JSON.stringify(d); };

test("in a browser: Save downloads pattern.pdraft, unsaved work is autosaved in localStorage until then, the title is left alone", () => {
  const r = boot({ script: `
    let file = null; app.setDownload((name, bytes) => { file = [name, app.fileDoc(bytes).v]; });
    const unsaved = JSON.parse(app.storage.get("pdraft:doc")).v;
    app.saveDoc(false); const a = file; file = null; app.saveDoc(true);
    return { unsaved, a, b: file, toast: toasts[toasts.length-1] };` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result, { unsaved: 26, a: ["pattern.pdraft", 26], b: ["pattern.pdraft", 26], toast: "Saved" });      // (version 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
  assert.strictEqual(r.storage["pdraft:doc"], undefined, "saved: nothing is left to recover");
  assert.strictEqual(r.saveText, "SAVED");
  assert.strictEqual(r.desk, undefined); assert.strictEqual(r.title, undefined);
});

test("desktop: autosave goes to the shell's store and comes back from it; localStorage holds no document", () => {
  const r = boot({ desktop: true });
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(JSON.parse(r.desk.store["pdraft:doc"]).v, 26);      // (version 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
  assert.strictEqual(r.storage["pdraft:doc"], undefined);
  assert.strictEqual(r.saveText, "AUTOSAVED");
  const again = boot({ desktop: { store: { "pdraft:doc": doc("From the file") } } });
  assert.deepStrictEqual(again.names, ["From the file"]); assert.deepStrictEqual(again.toasts, ["Recovered. Save it to keep it."]);
});

test("desktop: an unreadable autosave file is kept beside it and the toast gives its path", () => {
  const r = boot({ desktop: { store: { "pdraft:doc": "{not json" } } });
  assert.deepStrictEqual(r.errors, []);
  const keys = Object.keys(r.desk.store).filter(k => k.startsWith("pdraft:doc.unreadable."));
  assert.strictEqual(keys.length, 1); assert.strictEqual(r.desk.store[keys[0]], "{not json");
  assert.strictEqual(JSON.parse(r.desk.store["pdraft:doc"]).v, 26, "a fresh autosave was written");      // (version 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; 20 since Round build-1; version 19 since Round perf-2; 18 since Round r15; 17 since Round r14; 16 since Round r13)
  assert.strictEqual(r.toasts.length, 1);
  assert.ok(r.toasts[0].includes("C:\\data\\" + keys[0].replace("pdraft:doc", "autosave") + ".json"), r.toasts[0]);
});

// (Round rename-1) the program is called Gusset: the titles and texts expected below say so (they had the old name)
// (Round r24 follow-up) the name in full in every title: "Gusset – Pattern Drafter" (it was "Gusset")
test("desktop: Save asks where the first time, then writes in place; Save As picks a new file; a cancelled dialog changes nothing", () => {
  const r = boot({ desktop: true, script: `
    const out = {}, d = app.desk, calls = () => d.calls.map(c => c[0]).join(" ");
    app.saveDoc(false); out.cancelled = [calls(), d.files.size, app.title(), toasts.length];
    d.dialog = ${JSON.stringify(A)}; app.saveDoc(false);
    out.first = [calls(), app.fileDoc(d.files.get(d.dialog)).v, app.title(), toasts[toasts.length-1]];
    S.pieces[0].name = "Renamed"; d.dialog = null; app.saveDoc(false);
    out.inPlace = [d.calls[d.calls.length-1], app.fileDoc(d.files.get(${JSON.stringify(A)})).pieces[0].name];
    d.dialog = ${JSON.stringify(B)}; app.saveDoc(true);
    out.as = [d.calls[d.calls.length-1], d.files.has(${JSON.stringify(B)}), app.title()];
    d.dialog = null; app.saveDoc(false); out.then = d.calls[d.calls.length-1];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.cancelled, ["saveAs", 0, "Gusset \u2013 Pattern Drafter", 0]);
  assert.deepStrictEqual(o.first, ["saveAs saveAs", 26, "skirt.pdraft \u2014 Gusset \u2013 Pattern Drafter", "Saved skirt.pdraft"]);      // (version 26 since Round r26 (the wider shrinkage and glue ranges, Flip Normal's foldStay); 25 since Round r25 (a pattern's Grain Orientation, a Slant corner's distances, Solidify's Strength, a notch's Point direction); version 24 since Round r20 (an annotation's angle, colour, line); 23 since the r19 follow-up (the lights, a roll per fabric); 22 since Round r18; 21 since Round r17b; version 18 since Round r15; 17 since Round r14; 16 since Round r13)
  assert.deepStrictEqual(o.inPlace, [["save", A], "Renamed"]);
  assert.deepStrictEqual(o.as, [["saveAs", A], true, "copy.pdraft \u2014 Gusset \u2013 Pattern Drafter"], "Save As starts from the current file");
  assert.deepStrictEqual(o.then, ["save", B], "and Save now goes to the new one");
  assert.strictEqual(r.storage["pdraft:file"], B, "the path is remembered for the next session");
});

test("desktop: a save that fails says why and keeps the file it had", () => {
  const r = boot({ desktop: { readonly: true, store: { "pdraft:doc": doc() }, local: { "pdraft:file": A } }, script: `
    app.saveDoc(false); return [toasts[toasts.length-1], app.title()];` });
  assert.deepStrictEqual(r.result, ["Couldn't save: EPERM: operation not permitted", "skirt.pdraft \u2014 Gusset \u2013 Pattern Drafter"]);
});

test("desktop: Open loads a document and makes it the file Save writes; a .dxf goes to the import dialog; junk is refused", () => {
  const r = boot({ desktop: { files: { [A]: doc("Opened one"), "C:\\x\\notes.json": "{\"a\":1}", "C:\\x\\p.dxf": "0\nEOF\n" } }, script: `
    const out = {}, d = app.desk;
    d.dialog = ${JSON.stringify(A)}; app.openDoc();
    out.opened = [S.pieces.map(p => p.name), app.title(), toasts[toasts.length-1], S.undo.length];
    app.saveDoc(false); out.save = d.calls[d.calls.length-1];
    d.dialog = "C:\\\\x\\\\notes.json"; app.openDoc(); out.junk = [toasts[toasts.length-1], app.title(), S.pieces.length];
    app.answer = (t) => { out.dxfDlg = t; return { scale: 1, angle: 0, append: true, auto: true, swap: false, tosa: true, optimise: true, notches: true, internals: true, anno: true, distribute: false }; };
    d.dialog = "C:\\\\x\\\\p.dxf"; app.openDoc(); out.dxf = [app.title(), S.pieces.length];
    app.undo(); out.undone = S.pieces.map(p => p.name);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.opened, [["Opened one"], "skirt.pdraft \u2014 Gusset \u2013 Pattern Drafter", "Opened skirt.pdraft", 0], "Open replaces the document and its history");
  assert.deepStrictEqual(r.modals.map(m => m.title), ["Unsaved changes"], "the starter had not been saved: it asked first (the harness answers Don't Save)");
  assert.deepStrictEqual(o.save, ["save", A]);
  assert.deepStrictEqual(o.junk, ["Couldn't read that \u2014 expected a pattern file (.pdraft or .json)", "skirt.pdraft \u2014 Gusset \u2013 Pattern Drafter", 1]);
  assert.match(o.dxfDlg, /DXF/); assert.deepStrictEqual(o.dxf, ["skirt.pdraft \u2014 Gusset \u2013 Pattern Drafter", 1], "a DXF does not become the document's file");
  assert.deepStrictEqual(o.undone, ["Opened one"], "Ctrl+Z takes back the DXF import and stops at the opened document");
});

test("desktop: the file is remembered with its unsaved work, and a file handed over later replaces the document", () => {
  const kept = boot({ desktop: { store: { "pdraft:doc": doc("Autosaved") }, local: { "pdraft:file": A } }, script: `
    app.saveDoc(false); return app.desk.calls[0];` });
  assert.strictEqual(kept.title, "skirt.pdraft \u2014 Gusset \u2013 Pattern Drafter"); assert.deepStrictEqual(kept.result, ["save", A]);
  const stale = boot({ desktop: { local: { "pdraft:file": A } } });
  assert.strictEqual(stale.title, "Gusset \u2013 Pattern Drafter", "nothing was recovered, so the document is not that file");
  assert.strictEqual(stale.storage["pdraft:file"], undefined);
  const handed = boot({ desktop: { store: { "pdraft:doc": doc("Autosaved") } }, script: `
    app.desk.onFile({ path: ${JSON.stringify(B)}, name: "copy.pdraft", text: ${JSON.stringify(doc("Double-clicked"))} });
    const now = S.pieces.map(p => p.name); app.undo();
    return [now, app.title(), S.pieces.map(p => p.name)];` });
  assert.deepStrictEqual(handed.result, [["Double-clicked"], "copy.pdraft \u2014 Gusset \u2013 Pattern Drafter", ["Double-clicked"]]);
});

test("desktop: Recent lists the shell's files and opens the one clicked; a file that has gone is reported", () => {
  const r = boot({ desktop: { files: { [A]: doc("Recent one") } }, script: `
    const d = app.desk, out = {};
    d.recent = [${JSON.stringify(A)}, "C:\\\\gone\\\\old.json"];
    app.menu.children.length = 0; app.showRecentMenu(900, 300);
    out.items = app.menu.children.map(c => [c.className, c.innerHTML.replace(/<[^>]+>/g, ""), c.title]);
    app.menu.children[1].onclick(); out.opened = [S.pieces.map(p => p.name), app.title()];
    app.menu.children[2].onclick(); out.gone = toasts[toasts.length-1];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result.items, [["hd", "Recent files", ""], ["mi", "skirt.pdraft", A], ["mi", "old.json", "C:\\gone\\old.json"]]);
  assert.deepStrictEqual(r.result.opened, [["Recent one"], "skirt.pdraft \u2014 Gusset \u2013 Pattern Drafter"]);
  assert.strictEqual(r.result.gone, "Couldn't open: ENOENT: no such file");
});

test("desktop: Print hands the pages and the sheet size to the shell; the 50 mm check line is 50 units of a millimetre viewBox", () => {
  const r = boot({ desktop: true, script: `
    const job = app.printJob(); app.runPrint(job.html, job.plan);
    S.print.orient = "landscape"; const wide = app.printJob(); app.runPrint(wide.html, wide.plan);
    const svg = /<svg [^>]*class="page"[^>]*>/.exec(job.html)[0];
    return { calls: app.desk.calls, svg, line: / h 50 m 0 -2 v 4 m -50 0 v -4/.test(job.html), page: /@page \\{ size: 210mm 297mm; margin: 0 \\}/.test(job.html), scale: job.plan.scale };` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.calls, [["print", 210, 297, true], ["print", 297, 210, true]]);
  assert.ok(o.svg.includes('width="210mm" height="297mm" viewBox="0 0 210 297"'), o.svg);
  assert.ok(o.line && o.page); assert.strictEqual(o.scale, 1);
});

/* ---------- a version 11 file saved as version 12: the original is kept beside it ---------- */
test("the shell keeps the original of a version 11 .pdraft as <name>.v11.pdraft the first time version 12 is written over it: once, without asking, and never over a copy that is there", () => {
  const fs = require("fs"), os = require("os"), { extract } = require("./harness");
  const keepV11 = new Function("fs", "path", extract(fs.readFileSync(path.join(__dirname, "..", "..", "desktop", "main.js"), "utf8"), "keepV11") + "\nreturn keepV11;")(fs, path);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdraft-keep-")), at = (n) => path.join(dir, n), read = (n) => fs.readFileSync(at(n), "utf8");
  const v12 = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]), v11 = '{"v":11,"pieces":[]}';
  try {
    fs.writeFileSync(at("skirt.pdraft"), v11);
    assert.strictEqual(keepV11(at("skirt.pdraft"), v12), at("skirt.v11.pdraft"), "the copy's path");
    assert.strictEqual(read("skirt.v11.pdraft"), v11, "the original, byte for byte"); assert.strictEqual(read("skirt.pdraft"), v11, "the file itself is not touched by this: the save follows");
    // saved: the file is version 12 now, and the next save keeps nothing
    fs.writeFileSync(at("skirt.pdraft"), v12);
    assert.strictEqual(keepV11(at("skirt.pdraft"), v12), null); assert.deepStrictEqual(fs.readdirSync(dir).sort(), ["skirt.pdraft", "skirt.v11.pdraft"]);
    // a copy that is already there is never written over
    fs.writeFileSync(at("coat.pdraft"), '{"v":11,"pieces":[],"newer":true}'); fs.writeFileSync(at("coat.v11.pdraft"), "the copy from before");
    assert.strictEqual(keepV11(at("coat.pdraft"), v12), null); assert.strictEqual(read("coat.v11.pdraft"), "the copy from before");
    // nothing to keep: a new file, a .json (Save writes a .pdraft beside that anyway), text being written, an empty file
    assert.strictEqual(keepV11(at("new.pdraft"), v12), null);
    fs.writeFileSync(at("old.json"), v11); assert.strictEqual(keepV11(at("old.json"), v12), null);
    fs.writeFileSync(at("text.pdraft"), v11); assert.strictEqual(keepV11(at("text.pdraft"), "plain text"), null);
    fs.writeFileSync(at("empty.pdraft"), ""); assert.strictEqual(keepV11(at("empty.pdraft"), v12), null);
    assert.deepStrictEqual(fs.readdirSync(dir).filter(n => /v11/.test(n)).sort(), ["coat.v11.pdraft", "skirt.v11.pdraft"]);
    // upper case in the name
    fs.writeFileSync(at("Dress.PDRAFT"), v11); assert.strictEqual(path.basename(keepV11(at("Dress.PDRAFT"), v12)), "Dress.v11.pdraft");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("desktop: a version 11 file is opened and saved: the toast names the copy that was kept, and a second save keeps nothing more", () => {
  const old = JSON.stringify({ ...JSON.parse(doc("An old one")), v: 11 }), K = A.replace(/pdraft$/, "v11.pdraft");
  const r = boot({ desktop: { files: { [A]: old } }, script: `
    const d = app.desk, out = {};
    d.dialog = ${JSON.stringify(A)}; app.openDoc();
    out.opened = [S.pieces[0].name, app.title()];
    app.ev("push('Rename'); S.pieces[0].name = 'Saved by the new build'; commit()");
    app.saveDoc(false);
    out.first = [d.calls[d.calls.length-1], toasts[toasts.length-1], typeof d.files.get(${JSON.stringify(A)}) !== "string", d.files.get(${JSON.stringify(K)}) === ${JSON.stringify(old)}, app.fileDoc(d.files.get(${JSON.stringify(A)})).v];
    app.ev("push('Rename'); S.pieces[0].name = 'Again'; commit()");
    app.saveDoc(false);
    out.second = [toasts[toasts.length-1], d.files.get(${JSON.stringify(K)}) === ${JSON.stringify(old)}, [...d.files.keys()].length];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.opened, ["An old one", "skirt.pdraft \u2014 Gusset \u2013 Pattern Drafter"]);
  assert.deepStrictEqual(o.first[0], ["save", A], "saved in place, no dialog");
  assert.strictEqual(o.first[1], "Saved skirt.pdraft. It was a file of an earlier version, which earlier builds can still open: the original is kept beside it as skirt.v11.pdraft");
  assert.deepStrictEqual(o.first.slice(2), [true, true, 26], "the file is version 26 now (Round r26; 25 since Round r25; 24 since Round r20; 23 since the r19 follow-up; 22 since Round r18; 21 since Round r17b; 20 since Round build-1; 19 since Round perf-2; 18 since Round r15; 17 since Round r14), and the copy is the original text");
  assert.deepStrictEqual(o.second, ["Saved skirt.pdraft", true, 2], "once a file");
});

module.exports = T;
