// Round D: menus, settings, the bill of materials, the minimal library. A test (or two) a batch.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 60 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, []);
  return o;
}
// the names of a list's rows (header rows as "# name"), without the tick
const names = (items) => items.filter(Boolean).map(x => x.hd ? "# " + x.hd : x.sep ? "---" : x.n);

/* ---------- D1 ---------- */
test("D1: the display switches in the recording's lists: an Avatar list (Show Avatar, Show Arrangement Points, the collision mesh), the 3D window's own Garment Rendering Style with Alt+2, Alt+4, Alt+9; the 2D lists named as the Display menu names them; rows ours cannot do follow the not-built switch", () => {
  const o = boot({ script: `
    const out = {}, nm = (items) => items.filter(Boolean).map(x => x.hd ? "# " + x.hd : x.n);
    out.avatar = nm(app.ev("avatarItems")());
    out.render3 = nm(app.ev("render3Items")());
    out.garment3 = app.VIEW3D.garment.map(v => v[1]);
    out.groups2 = app.ev("VIEW_GROUPS").map(g => g[1]);
    // Alt+4: the 3D window's style changes, the 2D window's stays
    app.key("4", { altKey: true }); out.alt4 = [S.ui.render3, S.ui.render, toasts[toasts.length - 1]];
    app.key("9", { altKey: true }); out.alt9 = S.ui.render3;
    app.key("1", { altKey: true }); out.alt1 = [S.ui.render3, toasts[toasts.length - 1]];
    app.ev("setRender")("mono"); out.twoD = [S.ui.render, S.ui.render3];
    // with the switch off, the rows for what ours cannot do are gone
    S.ui.unbuilt = false;
    out.avatarOff = nm(app.ev("avatarItems")()); out.render3Off = nm(app.ev("render3Items")()); out.render2Off = nm(app.selectorItems("render"));
    S.ui.unbuilt = true;
    out.keys = ["render3:front", "render3:mono", "render3:random", "show3:avatar", "arr_points"].map(id => app.keyOf(id));
    return out;` }).result;
  assert.deepStrictEqual(o.avatar, ["# Avatar Display", "Show Avatar", "Show Arrangement Points", "Show Bounding Volumes" /* (built in Round r18 / 8) */, "Show Avatar Joints" /* (built in Round r17b / 3) */, "Show Avatar Measures" /* (Round r18 / 8) */,
    "Show 3D Pen (Avatar) (not built yet)", "Show NURBS Curves (not built yet)", "Show Avatar Fitting Suit" /* (Round r18 / 8) */, "Show Scene and Props (not built yet)", "Show Collision Mesh"], "W25, with ours' collision mesh at the end");
  assert.deepStrictEqual(o.render3, ["# Garment Rendering Style", "Thick Textured Surface", "Textured Surface", "Thick Monochrome Surface", "Monochrome Surface",
    "Translucent Surface", "Thick Textured Surface (Back)", "Random Color Surface", "# Garment Rendering Option", "Show Wireframe", "# More", "Strain Map", "Fit Map", "Stress Map", "Pressure Map"], "W26 (and this program's own under More: Round r9; the Fit Map since Round r14 / 7; every row built since Round r17b / 3; Stress and Pressure since Round r20 continued (4))");
  assert.ok(!o.garment3.includes("Show Avatar"), "Show Avatar has moved to the Avatar list"); assert.deepStrictEqual(o.garment3.slice(0, 5), ["Show Garment", "Show Seamlines", "Show Threads", "Show Internal Lines", "Show Baselines"]);      // (Show Threads since Round r14 / 8)
  assert.deepStrictEqual(o.groups2, ["Sewing", "2D Pattern", "2D Information", "2D Pattern Rendering Style", "Pattern Lock"]);
  assert.deepStrictEqual(o.alt4, ["mono", "front", "3D window: Monochrome Surface"]); assert.strictEqual(o.alt9, "random");
  assert.deepStrictEqual(o.alt1, ["thick", "3D window: Thick Textured Surface"]);      // (built in Round r17b / 3)
  assert.deepStrictEqual(o.twoD, ["mono", "thick"], "the two windows have a style each");      // (Alt+1 picks Thick Textured Surface since Round r17b / 3)
  assert.deepStrictEqual(o.avatarOff, ["# Avatar Display", "Show Avatar", "Show Arrangement Points", "Show Bounding Volumes", "Show Avatar Joints", "Show Avatar Measures", "Show Avatar Fitting Suit", "Show Collision Mesh"]);      // (Show Avatar Joints since Round r17b / 3; Show Bounding Volumes, Show Avatar Measures, Show Avatar Fitting Suit since Round r18 / 8)
  assert.deepStrictEqual(o.render3Off, ["# Garment Rendering Style", "Thick Textured Surface", "Textured Surface", "Thick Monochrome Surface", "Monochrome Surface", "Translucent Surface", "Thick Textured Surface (Back)", "Random Color Surface", "# Garment Rendering Option", "Show Wireframe", "# More", "Strain Map", "Fit Map", "Stress Map", "Pressure Map"]);      // (Stress and Pressure since Round r20 continued (4); the Fit Map since Round r14 / 7; every style and Show Wireframe since Round r17b / 3)
  assert.ok(!o.render2Off.some(n => /not built/.test(n)));
  assert.deepStrictEqual(o.keys, ["Alt+2", "Alt+4", "Alt+9", "Shift+A", "Shift+F"]);
});

/* ---------- D2 ---------- */
test("D2: the 3D, 2D and Materials/UV menus list every tool as W48 to W50 do, in submenus, each with its icon and its key from the key table; a tool picked from a menu is in hand; rows ours cannot do follow the switch", () => {
  const o = boot({ script: `
    const out = {}, top = (items) => items.filter(Boolean).map(x => x.sep ? "---" : x.n + (x.menu ? " >" : ""));
    const subOf = (items, n) => items.find(x => x && x.n === n).menu().filter(Boolean);
    out.top3 = top(app.MENUS["3d"]()); out.top2 = top(app.MENUS["2d"]()); out.topM = top(app.MENUS.materials());
    const sel = subOf(app.MENUS["3d"](), "Select"); out.select = sel.map(x => [x.n, x.k, !!x.ic, !!x.off]);
    const edit = subOf(app.MENUS["2d"](), "Edit"); out.edit = edit.filter(x => !x.sep).map(x => [x.n, x.k]);
    out.topstitch = subOf(app.MENUS.materials(), "Topstitch").map(x => [x.n, x.k]);
    // picked from the menu: the tool is in hand
    subOf(app.MENUS["2d"](), "Create").find(x => x.n === "Rectangle").f(); out.picked = S.tool;
    // the switch off: rows for what is not built are gone, and so is a submenu left empty
    S.ui.unbuilt = false;
    out.selectOff = subOf(app.MENUS["3d"](), "Select").map(x => x.n);
    app.listMenu(app.MENUS["3d"](), 0, 0); out.shownOff = app.menu.children.filter(c => c.className && /mi/.test(c.className)).map(c => c.innerHTML.replace(/<[^>]*>/g, "").replace(/[\u2007\u2713\u25b8]/g, "").trim());
    S.ui.unbuilt = true;
    // Delete All Baselines, Activate Sewing (All): one undo step each
    S.pieces.length = 0; S.seams.length = 0;
    const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], true));
    app.addChild(A, "bases", app.mkShape([{x:10,y:10},{x:90,y:10}], false)); app.addChild(A, "bases", app.mkShape([{x:10,y:20},{x:90,y:20}], false));
    S.pieces.push(A); app.commit(); S.undo.length = 0;
    subOf(app.MENUS["2d"](), "Edit").find(x => x.n === "Delete All Baselines").f(); out.bases = [A.bases.length, S.undo.length];
    return out;` }).result;
  // (Round r33 / 7) Simulation Quality under Simulate
  assert.deepStrictEqual(o.top3, ["Simulate", "Simulation Quality >", "---", "Select >", "Pin >", "Ripping >", "Styleline >", "3D pen >", "Press (not built yet)", "Fold >", "---", "Arrangement >", "---", "Measurement >"]);
  assert.deepStrictEqual(o.top2.slice(0, 7), ["Pattern Drafter", "Pattern Information", "Create >", "Edit >", "Trace", "Lock >", "Pleats >"]);
  assert.deepStrictEqual(o.topM, ["UV Editor (not built yet)", "Graphics >", "Button >", "Zipper >", "Piping >", "Binding >", "Topstitch >", "Puckering >", "Steam >", "Seam Taping (not built yet)", "Gluing >"]);
  assert.deepStrictEqual(o.select, [["Select/Move", "Q", true, false], ["Select Mesh (Brush) (not built yet)", "", true, true], ["Select Mesh (Box) (not built yet)", "", true, true], ["Select Mesh (Lasso) (not built yet)", "", true, true]]);
  assert.deepStrictEqual(o.edit.slice(0, 3), [["Transform Pattern", "A"], ["Transform Point/Segment", ""], ["Edit Pattern", "Z"]]);
  assert.ok(o.edit.some(e => e[0] === "Fullness (Point)") && o.edit.some(e => e[0] === "Add Point/Split Line" && e[1] === "X"));
  assert.deepStrictEqual(o.topstitch, [["Edit Topstitch", "J"], ["Segment Topstitch", "K"], ["Free Topstitch", "L"], ["Seamline Topstitch", ";"]]);      // (Seamline Topstitch built in Round r14 / 4)
  assert.strictEqual(o.picked, "rectangle");
  assert.deepStrictEqual(o.selectOff, ["Select/Move"]);
  // (Round r10 / 3: Styleline and 3D pen hold built tools now, Edit Style Line and the pens, so they stay)
  assert.ok(!o.shownOff.some(n => /Ripping|Press/.test(n)), "submenus with nothing built are left out: " + o.shownOff);
  assert.ok(o.shownOff.some(n => /^Select/.test(n)) && o.shownOff.some(n => /^Arrangement/.test(n)) && o.shownOff.some(n => /^Styleline/.test(n)) && o.shownOff.some(n => /^3D pen/.test(n)));
  assert.deepStrictEqual(o.bases, [0, 1]);
});

/* ---------- D3 ---------- */
test("D3: the File menu in the recording's shape (W40) without the online service's rows; Open, Add, Save As, Import, Import (Add), Export, Snapshot, Information as submenus; keys from the key table; what ours cannot do follows the switch; no other program named", () => {
  const o = boot({ script: `
    const out = {}, top = (items) => items.filter(Boolean).map(x => x.sep ? "---" : x.n + (x.menu ? " >" : ""));
    const subOf = (items, n) => items.find(x => x && x.n === n).menu().filter(Boolean);
    const f = app.MENUS.file();
    out.top = top(f);
    out.open = subOf(f, "Open").filter(x => !x.off && !x.sep).map(x => [x.n, x.k]);
    out.saveAs = subOf(f, "Save As").filter(x => !x.off && !x.sep).map(x => [x.n, x.k]);
    out.imp = subOf(f, "Import").filter(x => !x.off && !x.sep).map(x => [x.n || "# " + x.hd, x.k || ""]);
    out.exp = subOf(f, "Export").filter(x => !x.off && !x.sep && !x.hd).map(x => x.n);
    const all = JSON.stringify(f.filter(Boolean).flatMap(x => x.menu ? x.menu() : [x]));
    out.named = /Adobe|Maya|3ds Max|[C]LO-SET|Upload|Video Capture/.test(all);
    // as drawn, with the switch off
    S.ui.unbuilt = false; app.listMenu(app.MENUS.file(), 0, 0, false, true /* (as the menu bar opens it: no search field, Round r20 / 10) */); S.ui.unbuilt = true;
    out.topOff = app.menu.children.map(c => c.className === "sep" ? "---" : c.innerHTML.replace(/<[^>]*>/g, "").replace(/[\u2007\u2713]/g, "").replace(/\u25b8/, " >").replace(/Ctrl[+]\S+$/, "").trim());
    return out;` }).result;
  assert.deepStrictEqual(o.top, ["New Project", "New Garment (not built yet)", "New from Starter Pattern", "Open >", "Add >", "Save Project", "Save As >", "---", "Import >", "Import (Add) >", "Export >", "---",
    "Snapshot >", "---", "Plotter…", "---", "Information >", "---", "New Block…", "Library…", "Save to Library…", "Open Example >", "---", "Recent (not built yet)", "Quit (not built yet)"]);      // (Round desk-1: Open Example, this program's own row, beside Library; Round r20 / 8: Plotter… is built, it opens the Plotter box)
  assert.deepStrictEqual(o.open, [["Project", "Ctrl+O"], ["Avatar", "Ctrl+Shift+A"], ["Pose", "Ctrl+Shift+P"]]);
  assert.deepStrictEqual(o.saveAs, [["Project", "Ctrl+Shift+S"]]);
  // (Round r25 follow-up: the Import submenu gains Re-read Grainlines from Original File…, a row of our own under Ours)
  assert.deepStrictEqual(o.imp, [["DXF", "Ctrl+Shift+D"], ["# Animation", ""], ["# Script", ""], ["# Ours", ""], ["Import .zprj / .zpac…", ""], ["Pattern File (.pdraft, .json)…", ""], ["Re-read Grainlines from Original File…", ""]]);
  assert.deepStrictEqual(o.exp, ["DXF", "PDF", "Plotter (PLT)", "BOM (XML)", "Tech Pack (JSON)", "OBJ", "OBJ (Selected)", "SVG, true size", "Print or PDF…"], "Round CF: PDF, BOM (XML) and Tech Pack (JSON) are built; Round r20: OBJ, Plotter (PLT)");
  assert.strictEqual(o.named, false, "no other program, no online service, no Video Capture (never seen opened)");
  assert.deepStrictEqual(o.topOff, ["New Project", "New from Starter Pattern", "Open >", "Add >", "Save Project", "Save As >", "---", "Import >", "Import (Add) >", "Export >", "---", "Snapshot >", "---", "Plotter…", "---", "Information >" /* (Round r20 / 11: Garment and File History are built) */, "---", "New Block…", "Library…Y", "Save to Library…", "Open Example >"], "as drawn with the switch off: Information is empty and left out (the key Y written at the row's end; Round r20 / 8: Plotter… is built)");
});

/* ---------- D4 ---------- */
test("D4: File ▸ Add ▸ Project (Ctrl+Shift+O) puts a second document into the open one, beside what is there, as one undo step: new ids for patterns, segments, shapes and seams, its seams and grading kept, a fabric matched by name", () => {
  const o = boot({ streams: true, script: `
    return (async () => {
    const out = {};
    // the document to add: the starter, a second pattern sewn to it, saved as a version 12 file
    app.ev("starterDoc")(true);
    const B = app.mkPiece("Back", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:300},{x:300,y:300}], true)); S.pieces.push(B); app.commit();
    app.ev("push")("Sew"); S.seams.push({ id: 1, a: [{ piece: S.pieces[0].id, shape: 0, sids: [S.pieces[0].segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[3].id], t0: 0, t1: 1, rev: false }] }); app.commit();
    S.lib.fabric[0].name = "Denim"; app.commit();
    const file = await new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); });
    // the open document: one pattern of its own, a fabric of the same name
    app.ev("newDoc")(true);
    const A = app.mkPiece("Mine", app.mkShape([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], true)); S.pieces.push(A); S.lib.fabric[0].name = "Denim"; app.commit(); S.undo.length = 0;
    const before = { ids: S.pieces.map(p => p.id), segs: S.pieces.flatMap(p => p.segs.map(s => s.id)), seams: S.seams.length };
    const bytes = new Uint8Array(file);
    let added = 0; app.ev("readDocBytes")("other.pdraft", bytes, (err, d) => { out.err = err; added = app.ev("addDocument")("other.pdraft", d); });
    await app.wait(() => added || out.err, "the add");
    const ids = S.pieces.map(p => p.id), segs = S.pieces.flatMap(p => [p, ...p.internals, ...p.bases].flatMap(sh => sh.segs.map(s => s.id)));
    out.after = { n: S.pieces.length, names: S.pieces.map(p => p.name), uniqueIds: new Set(ids).size === ids.length, uniqueSegs: new Set(segs).size === segs.length, mineKept: S.pieces[0].pts.map(q => [q.x, q.y]),
      seams: S.seams.length, valid: app.ev("validSeams")(S.seams, S.pieces).length, sel: S.sel.length, steps: S.undo.length, fabrics: S.lib.fabric.map(f => f.name),
      saved: [app.bboxOf([S.pieces[2]]).x0, app.bboxOf([S.pieces[2]]).y0, S.tool], dartsOk: !S.pieces[1].darts.length, toast: toasts[toasts.length - 1] };
    // Round CF: the right-click's Placement ▸ To the Right of the Others, one more undo step
    out.placeRow = !!app.ev("addedSel")(); app.ev("placeAdded")("right"); out.placed = [app.bboxOf(S.pieces.slice(1)).x0 >= app.bboxOf([S.pieces[0]]).x1 + 99, S.undo.length];
    app.undo(); app.undo(); out.undone = [S.pieces.length, S.seams.length];
    out.key = [app.keyFind({ key: "O", code: "KeyO", ctrlKey: true, shiftKey: true }).id, app.keyOf("addProject")];
    out.menu = app.MENUS.file().find(x => x && x.n === "Add").menu().filter(Boolean)[0].k;
    return out; })();` }).result;
  assert.strictEqual(o.err, null);
  assert.deepStrictEqual(o.after.names, ["Mine", "Front bodice", "Back"]);
  assert.deepStrictEqual([o.after.uniqueIds, o.after.uniqueSegs], [true, true], "new ids: nothing collides");
  assert.deepStrictEqual(o.after.mineKept, [[0, 0], [100, 0], [100, 100], [0, 100]], "the open document's pattern is untouched");
  // Round F / 7: the starter's dart is lines of its outline, its legs sewn to each other: a second seam, on its new ids
  assert.deepStrictEqual([o.after.seams, o.after.valid], [2, 2], "the added document's seam and the starter dart's legs, on the added patterns");
  assert.strictEqual(o.after.dartsOk, true, "no dart object: the dart is in the outline");
  assert.deepStrictEqual(o.after.fabrics, ["Denim"], "the fabric matched by name, not added twice");
  assert.deepStrictEqual(o.after.saved, [300, 0, "transform_pattern"], "Round CF: set down where it was in the saved project, Transform Pattern in hand");
  assert.deepStrictEqual(o.placed, [true, 2], "Placement ▸ To the Right of the Others: one undo step"); assert.strictEqual(o.placeRow, true);
  assert.deepStrictEqual([o.after.sel, o.after.steps], [2, 1], "the added patterns selected, one undo step");
  assert.ok(/^Added other[.]pdraft: 2 patterns, 2 seams$/.test(o.after.toast), o.after.toast);
  assert.deepStrictEqual(o.undone, [1, 0]);
  assert.deepStrictEqual(o.key, ["addProject", "Ctrl+Shift+O"]); assert.strictEqual(o.menu, "Ctrl+Shift+O");
});

/* ---------- D5 (the minimal library, D4b) ---------- */
test("D5: the minimal library: the shipped blocks and the user's own patterns in one list (File ▸ Library…, Y); a block opens as a new document or is added to the open one (one undo step); Save to Library keeps the document in the browser's storage and hands it over as a .pdraft", () => {
  const o = boot({ streams: true, script: `
    return (async () => {
    const out = {};
    out.shipped = app.ev("shippedBlocks")().map(b => [b.id, b.name, b.doc.pieces.length]);
    out.dialog = app.ev("libraryDialog")(); out.html = app.el("dlg").innerHTML; app.ev("hideDlg")();
    out.key = [app.keyFind({ key: "y", code: "KeyY" }).id, app.keyOf("library")];
    // open the block as a new document
    app.ev("libraryOpen")(app.ev("shippedBlocks")()[0]); out.opened = [S.pieces.map(p => p.name), S.seams.length, toasts[toasts.length - 1]];
    // add it to the open document: four more patterns, one undo step
    const n0 = S.undo.length; app.ev("libraryAdd")(app.ev("shippedBlocks")()[0]); out.added = [S.pieces.length, S.seams.length, S.undo.length - n0];
    // Save to Library: in the storage under its name, and as a file
    let file = null; app.setDownload((n, b) => { file = [n, b.length > 0]; });
    app.ev("saveToLibrary")("Two skirts"); await app.wait(() => file, "the file");
    out.saved = [file, app.ev("myPatterns")().map(m => [m.name, m.doc.pieces.length]), JSON.parse(app.storage.get("pdraft:library")).length];
    out.listed = app.ev("libraryDialog")(); app.ev("hideDlg")();
    // a second save under the same name takes its place; Delete takes it out
    app.ev("saveToLibrary")("Two skirts"); out.again = app.ev("myPatterns")().length;
    app.ev("libraryDelete")("Two skirts"); out.deleted = app.ev("myPatterns")().length;
    out.menu = app.MENUS.file().filter(x => x && /Library/.test(x.n)).map(x => [x.n, x.k || ""]);
    return out; })();` }).result;
  assert.deepStrictEqual(o.shipped, [["skirt-straight", "Straight skirt", 4]]);
  assert.deepStrictEqual(o.dialog, { blocks: 1, mine: 0 }); assert.ok(/<h3>Blocks<\/h3>/.test(o.html) && /Straight skirt/.test(o.html) && /<h3>My Patterns<\/h3>/.test(o.html) && /Save to Library/.test(o.html));
  assert.deepStrictEqual(o.key, ["library", "Y"]);
  assert.deepStrictEqual(o.opened[0], ["Skirt front", "Skirt back", "Skirt back (mirror)", "Skirt waistband"]); assert.strictEqual(o.opened[1], 8 + 4, "its seams and its darts' legs (Round F / 7); the waistband closed (Round r17a / 4)"); assert.ok(/^Opened Straight skirt/.test(o.opened[2]), o.opened[2]);
  assert.deepStrictEqual(o.added, [8, 2*(8 + 4), 1]);      // (Round r17a / 4: each skirt one seam more, its waistband closed)
  assert.deepStrictEqual(o.saved, [["Two skirts.pdraft", true], [["Two skirts", 8]], 1]);
  assert.deepStrictEqual(o.listed, { blocks: 1, mine: 1 });
  assert.deepStrictEqual([o.again, o.deleted], [1, 0]);
  assert.deepStrictEqual(o.menu, [["Library…", "Y"], ["Save to Library…", ""]]);
});
test("D5: a browser that will not keep anything still gets the file, and the library list says nothing is kept", () => {
  const o = boot({ blocked: true, streams: true, script: `
    return (async () => {
    let file = null; app.setDownload((n) => { file = n; });
    app.ev("starterDoc")(true); app.ev("saveToLibrary")("Mine"); await app.wait(() => file, "the file");
    return { file, said: toasts[toasts.length - 1], mine: app.ev("myPatterns")().length };
    })();` }).result;
  assert.strictEqual(o.file, "Mine.pdraft"); assert.ok(/would not keep it/.test(o.said), o.said); assert.strictEqual(o.mine, 0);
});

/* ---------- D6 ---------- */
test("D6: the bill of materials, counted from the document (Q15): per fabric its name, its area and the patterns cut from it (cut line, times the quantity); zippers and topstitch with their lengths, buttons; Production ▸ BOM shows it in the 2D window's place", () => {
  const o = boot({ script: `
    const out = {};
    S.pieces.length = 0; S.seams.length = 0;
    const A = app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:100},{x:0,y:100}], true));
    const B = app.mkPiece("Back", app.mkShape([{x:300,y:0},{x:400,y:0},{x:400,y:100},{x:300,y:100}], true));
    S.pieces.push(A, B); A.quantity = 2; for (const sg of B.segs) sg.sa = 10;
    const lining = app.libAdd("fabric"); lining.name = "Lining"; B.fabric = lining.id; S.lib.fabric[0].name = "Cotton"; A.fabric = S.lib.fabric[0].id;
    S.seams.push({ id: 1, zip: { name: "Zipper 1", type: S.lib.zipper[0] ? S.lib.zipper[0].id : 0 }, a: [{ piece: A.id, shape: 0, sids: [A.segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: B.id, shape: 0, sids: [B.segs[3].id], t0: 0, t1: 1, rev: false }] });
    S.stitches = [{ id: 1, name: "Hem stitch", preset: "Default Topstitch", part: { piece: A.id, shape: 0, sids: [A.segs[2].id], t0: 0, t1: 1, rev: false }, offset: 5, extS: true, extE: true, corner: "right" }];
    app.commit();
    const b = app.ev("bomData")();
    out.fabrics = b.fabrics.map(f => [f.name, f.patterns.map(p => [p.name, p.quantity, Math.round(p.area)]), Math.round(f.area)]);
    out.zippers = b.zippers.map(z => [z.name, Math.round(z.length)]); out.stitches = b.stitches.map(t => [t.name, Math.round(t.length)]); out.buttons = b.buttons.length;
    out.view = !!app.ev("bomView")(); out.html = app.el("bom").innerHTML;
    out.menu = app.MENUS.production().filter(Boolean).map(x => x.sep ? "---" : x.n + (x.k ? " " + x.k : ""));
    return out;` }).result;
  assert.deepStrictEqual(o.fabrics, [["Cotton", [["Front", 2, 40000]], 40000], ["Lining", [["Back", 1, 14400]], 14400]], "Front 200 x 100, cut twice (a row counts all its copies); Back 100 x 100 with 10 mm allowance all round: 120 x 120");
  assert.deepStrictEqual(o.zippers, [["Zipper 1", 100]]); assert.deepStrictEqual(o.stitches, [["Hem stitch", 200]]);
  assert.ok(o.buttons >= 1, "the library's buttons are listed, none placed");
  assert.strictEqual(o.view, true); assert.ok(/BOM Editor/.test(o.html) && /Update/.test(o.html) && /Cotton, in all/.test(o.html) && /0[.]040 m²/.test(o.html), "the table");
  assert.deepStrictEqual(o.menu, ["Colorway (not built yet) O", "BOM", "---", "Grading Review (3D) (not built yet)", "Grading Review (2D) (Beta)"], "W51's Production menu");
});

/* ---------- D7 ---------- */
test("D7: Settings ▸ Display as W31: the twelve lists, Isolate Selection, Customize Tools and Window, each row with its tick and its key; a row switches what the display buttons switch; what ours cannot do follows the switch", () => {
  const o = boot({ script: `
    const out = {}, subOf = (items, n) => items.find(x => x && x.n === n).menu().filter(Boolean);
    out.settings = app.MENUS.settings().filter(Boolean).slice(0, 7).map(x => x.sep ? "---" : x.n + (x.menu ? " >" : ""));
    const disp = subOf(app.MENUS.settings(), "Display");
    out.lists = disp.filter(x => !x.sep).map(x => x.n + (x.menu ? " >" : ""));
    out.view = subOf(disp, "Viewpoint").filter(x => !x.sep).map(x => [x.n, x.k || ""]);
    out.garment3 = subOf(disp, "3D Garment").filter(x => !x.hd && !x.off).map(x => [x.n, x.k || "", x.on]);
    const info = subOf(disp, "2D Information"); out.info = info.map(x => [x.n, x.k || ""]);
    // a row switches what the display button switches
    info.find(x => x.n === "Show Angle").f(); out.angle = [S.show.angle, app.selectorItems("info").find(x => /Angle/.test(x.n)).on];
    out.avatar = subOf(disp, "Avatar").map(x => x.n);
    out.styles = subOf(disp, "3D Garment Rendering Style").map(x => [x.n, x.k || ""]);
    out.window = subOf(disp, "Window").filter(x => !x.sep).map(x => x.n);
    S.ui.unbuilt = false; out.listsOff = subOf(app.MENUS.settings(), "Display").filter(x => !x.sep && (!x.menu || x.menu().some(r => r && !r.hd && !r.sep))).map(x => x.n); S.ui.unbuilt = true;
    return out;` }).result;
  assert.deepStrictEqual(o.settings, ["Language >", "User Settings…", "---", "Log Out (not built yet)", "---", "Display >", "Preferences >"]);
  assert.deepStrictEqual(o.lists, ["Viewpoint >", "3D Garment >", "3D Trims >", "2D Pattern >", "2D Information >", "Sewing >", "Avatar >", "Environment >", "Avatar Rendering Style >", "3D Garment Rendering Style >",
    "2D Pattern Rendering Style >", "Fit Maps >", "Isolate Selection", "Format 3D Background…" /* (built in Round r20 / 11) */, "Add Background Image (not built yet)", "Customize Tools >", "Window >"]);
  assert.deepStrictEqual(o.view.slice(0, 8), [["Front", "2"], ["3/4 Left", "3"], ["Back", "8"], ["Left", "6"], ["Right", "4"], ["Top", "5"], ["Bottom", "0"], ["3/4 Right", "1"]]);
  assert.deepStrictEqual(o.view.slice(-2), [["Focus Zoom", "F"], ["Zoom Extents All", ""]]);
  assert.deepStrictEqual(o.garment3.slice(0, 6), [["Show Garment", "Shift+W", true], ["Show Archived Pattern", "", false] /* (built in Round r20 / 9, off at first) */, ["Show Pins", "", true], ["Show Pattern Name", "", false] /* (built in Round r20 / 9, off at first) */, ["Show Seamlines", "Shift+S", true], ["Show Internal Lines", "", true]]);
  assert.deepStrictEqual(o.info.map(x => x[0]), ["Show Pattern Name", "Show Annotations", "Show Line Length", "Show Angle", "Show Grainline", "Show 2D Measurements", "Show Ruler", "Show Guideline"]);
  assert.strictEqual(o.info[2][1], "Shift+Z");
  assert.deepStrictEqual(o.angle, [true, true], "one switch, both places");
  assert.deepStrictEqual(o.avatar.slice(0, 2), ["Show Avatar", "Show Arrangement Points"]);
  // (Round r13 / 1: the strain map has the manual's key, Alt+7)
  assert.deepStrictEqual(o.styles.filter(x => !/not built/.test(x[0])), [["Thick Textured Surface", "Alt+1"], ["Textured Surface", "Alt+2"], ["Thick Monochrome Surface", "Alt+3"], ["Monochrome Surface", "Alt+4"], ["Translucent Surface", "Alt+5"], ["Thick Textured Surface (Back)", ""], ["Random Color Surface", "Alt+9"], ["Strain Map", "Alt+7"], ["Fit Map", "Alt+8"], ["Stress Map", "Alt+6"], ["Pressure Map", ""]]);      // (Stress and Pressure since Round r20 continued (4); the Fit Map since Round r14 / 7; the Thick styles and Translucent since Round r17b / 3)
  assert.ok(o.window.includes("BOM Editor") && o.window.includes("Library") && o.window.includes("History") && o.window.includes("Reset to Default Layout"));
  assert.ok(!o.window.some(n => /Omniverse/.test(n)), "a row named after another program is left out");
  // (Round r13 / 1: Fit Maps holds the strain map, a real row, so it stays with the switch off)
  assert.ok(o.listsOff.includes("Fit Maps") && !o.listsOff.includes("Customize Tools") && !o.listsOff.some(n => /not built/.test(n)) && o.listsOff.includes("Environment"), "with the switch off: " + o.listsOff);
});

/* ---------- D8 ---------- */
test("D8: Settings ▸ Preferences as W31: Gizmo (World Coordinate is ours), Smart Guide, Snap to Pattern, Snap to Grid with their ticks switching the settings, Simulation Properties; what ours cannot do follows the switch", () => {
  const o = boot({ script: `
    const out = {}, subOf = (items, n) => items.find(x => x && x.n === n).menu().filter(Boolean);
    const pref = () => subOf(app.MENUS.settings(), "Preferences");
    out.rows = pref().map(x => x.sep ? "---" : x.n + (x.menu ? " >" : "") + (x.on === true ? " [x]" : ""));
    out.gizmo = subOf(pref(), "Gizmo").filter(x => x.n).map(x => x.n + (x.on ? " [x]" : ""));
    pref().find(x => x.n === "Smart Guide").f(); out.smart = S.prefs.smart;
    pref().find(x => x.n === "Snap to Grid").f(); out.grid1 = S.snapG; pref().find(x => x.n === "Snap to Grid").f(); out.grid0 = S.snapG;
    let asked = null; app.answer = (t) => { asked = t; return null; }; pref().find(x => /^Simulation Properties/.test(x.n)).f(); out.sim = asked; app.answer = null;
    S.ui.unbuilt = false; out.off = pref().map(x => x.sep ? "---" : x.n); S.ui.unbuilt = true;
    return out;` }).result;
  assert.deepStrictEqual(o.rows, ["Gizmo >", "---", "3D Grid Brightness…" /* (built in Round r20 / 9) */, "Smart Guide [x]", "Snap to Pattern [x]", "Snap to Grid", "Grid Properties…", "---", "Open Files with Their Display Settings", "---",      /* (Round r17b: Grid Properties built, the display settings of a file) */
    "Camera Properties >", "Simulation Properties…", "---", "Fit Properties (not built yet)"]);
  // (Round r15 / 8: the three coordinates are built, Screen the default)
  assert.deepStrictEqual(o.gizmo, ["Screen Coordinate [x]", "Local Coordinate", "World Coordinate", "Size: Small (110 px)", "Size: Medium (165 px) [x]", "Size: Large (220 px)"], "(Round F / 6: its size as well)");
  assert.strictEqual(o.smart, false, "the tick switches the setting");
  assert.deepStrictEqual([o.grid1, o.grid0], [10, 0]);
  assert.strictEqual(o.sim, "Simulation Settings");
  assert.deepStrictEqual(o.off, ["Gizmo", "---", "3D Grid Brightness…" /* (Round r20 / 9) */, "Smart Guide", "Snap to Pattern", "Snap to Grid", "Grid Properties…", "---", "Open Files with Their Display Settings", "---", "Camera Properties", "Simulation Properties…", "---"]);      // (Round r17b: the two built rows)
});

module.exports = T;
