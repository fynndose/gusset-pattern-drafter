// Round A: the keys and the mouse. A1: one key table that the key handler, the menus and the Keyboard Shortcuts
// dialog all read. A2: a key is a command's only with exactly its modifiers held. A3: the 3D view keys.
// A4: Shift + a letter flips a display switch; Shift+H and Shift+V turn and flip the selected patterns in the 3D window.
// A5: the Ctrl keys for importing, the avatar, the pose and Reset 3D Arrangement; New and Remove All Pins in the desktop app.
// A6: Edit Curvature opens no menu on a right-click. A7: the view controls: which button turns and pans the 3D view,
// which way the wheel zooms.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const { load } = require("./harness");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
// two squares, and what the tests ask about the document
const DOC = `
  S.pieces.length = 0; S.seams.length = 0;
  const sq = (n, x, y) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+200,y:y},{x:x+200,y:y+200},{x:x,y:y+200}], true));
  S.pieces.push(sq("A", 100, 100), sq("B", 500, 100)); app.commit(); S.undo.length = 0;
  const out = {}, ev = (key, mods) => ({ key, code: key === " " ? "Space" : key, ...mods });
  const C = { ctrlKey: true }, SH = { shiftKey: true }, AL = { altKey: true }, CS = { ctrlKey: true, shiftKey: true }, CA = { ctrlKey: true, altKey: true };
  const last = () => { const h = app.histSteps(); return h.steps[h.at - 1].n; };
  // the event a row's key makes, with more modifiers held if asked
  const evOf = (k, extra) => {
    const key0 = k.endsWith("+") ? "+" : k.split("+").pop(), mods = k.slice(0, k.length - key0.length).split("+").filter(Boolean).concat(extra || []);
    const key = key0 === "Space" ? " " : key0.length === 1 && !mods.includes("Shift") ? key0.toLowerCase() : key0;
    return ev(key, { ctrlKey: mods.includes("Ctrl"), shiftKey: mods.includes("Shift"), altKey: mods.includes("Alt") });
  };
  const id = (key, mods) => { const r = app.keyFind(ev(key, mods)); return r ? r.id : null; };
`;

/* ---------- A1: the key table ---------- */
test("the key table: every row is whole, and no two rows claim one key in one place", () => {
  const r = boot({ script: DOC + `
    const rows = app.keyTable();
    out.n = rows.length;
    out.bad = rows.filter(x => !x.id || !x.k || !x.n || typeof x.f !== "function" || !["draft", "3d", "layout", "any"].includes(x.w)).map(x => x.id + " " + x.k);
    out.secs = [...new Set(rows.map(x => x.sec))].filter(s => !app.ev("KEY_SECTIONS").includes(s));
    // two rows with the same key clash unless they apply in different places or one of them has a condition
    const meet = (a, b) => a === b || a === "any" || b === "any" || (a === "3d" && b === "draft") || (a === "draft" && b === "3d");
    out.clash = [];
    rows.forEach((a, i) => rows.forEach((b, j) => { if (j > i && a.k === b.k && meet(a.w, b.w) && !a.when && !b.when && !(a.w === "3d" && b.w === "draft") && !!a.desk === !!b.desk) out.clash.push(a.k + ": " + a.id + " / " + b.id); }));
    // a tool key is in the table exactly when it is in the registry's map
    out.tools = Object.keys(app.KEYMAP).every(k => rows.some(x => x.k === k && x.id === "tool:" + app.KEYMAP[k]));
    out.same = app.keyTable() === rows;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.ok(o.n > 60, "rows: " + o.n);
  assert.deepStrictEqual(o.bad, []); assert.deepStrictEqual(o.secs, [], "every heading is one the dialog knows");
  assert.deepStrictEqual(o.clash, []);
  assert.strictEqual(o.tools, true); assert.strictEqual(o.same, true, "made once");
});

test("the key table: an event is written as the table writes it", () => {
  const r = boot({ script: DOC + `
    return [app.keyCombo(ev("z", C)), app.keyCombo(ev("Z", CS)), app.keyCombo(ev("a", { metaKey: true })), app.keyCombo(ev("+", SH)), app.keyCombo(ev("2", {})), app.keyCombo(ev(" ", {})),
      app.keyCombo(ev("ArrowLeft", SH)), app.keyCombo(ev("f", SH)), app.keyCombo(ev("a", CA)), app.keyCombo(ev("Escape", {})), app.keyCombo(ev("F1", {}))];` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result, ["Ctrl+Z", "Ctrl+Shift+Z", "Ctrl+A", "+", "2", "Space", "Shift+ArrowLeft", "Shift+F", "Ctrl+Alt+A", "Escape", "F1"]);
});

test("the menus and the Keyboard Shortcuts dialog show the table's keys", () => {
  const r = boot({ script: DOC + `
    const keyIn = (items, n) => (items.find(x => x.n && x.n.replace(/\\u2026/, "") === n) || {}).k;
    // the File menu in its shape since Round D / D3: Open ▸ Project, Save Project, Save As ▸ Project
    const subOf = (items, n) => items.find(x => x && x.n === n).menu().filter(Boolean);
    out.file = [keyIn(subOf(app.MENUS.file(), "Open"), "Project"), keyIn(app.MENUS.file(), "Save Project"), keyIn(subOf(app.MENUS.file(), "Save As"), "Project")];
    out.edit = ["Undo", "Redo", "Copy", "Paste", "Mirror Paste", "Delete", "Select All", "Invert Selection"].map(n => keyIn(app.MENUS.edit(), n));
    out.of = ["undo", "redo", "mirror", "delete", "escape", "turn:45", "zoomOut", "simulate", "arr_points", "tool:edit_pattern", "nothing"].map(app.keyOf);
    out.avatar = app.avatarMenu().filter(x => /^(Front|Back|Top)$/.test(x.n || "")).map(x => x.n + " " + x.k);
    const rows = app.shortcutsDialog();
    out.rows = rows.length;
    const find = (k) => (rows.find(x => x[0] === k) || [null, null])[1];
    out.dlg = [find("Ctrl+Y / Ctrl+Shift+Z"), find("Ctrl+R / Ctrl+Shift+V"), find("Esc"), find("Ctrl+Right"), find("Z"), find("2"), find("Space"), find("Backspace"), find("="), !!find("Arrow keys")];
    // every command of the table is in the dialog
    const listed = new Set(rows.map(x => x[0]));
    out.missing = app.keyTable().filter(x => !x.alias && !x.desk && ![...listed].some(k => k.split(" / ").includes(x.as || app.ev("keyShow")(x.k)))).map(x => x.id);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.file, ["Ctrl+O", "Ctrl+S", "Ctrl+Shift+S"]);
  assert.deepStrictEqual(o.edit, ["Ctrl+Z", "Ctrl+Y", "Ctrl+C", "Ctrl+V", "Ctrl+R", "Delete", "Ctrl+A", "Ctrl+Shift+I"]);
  assert.deepStrictEqual(o.of, ["Ctrl+Z", "Ctrl+Y", "Ctrl+R", "Delete", "Esc", "Ctrl+Right", "−", "Space", "Shift+F", "Z", ""]);
  assert.deepStrictEqual(o.avatar, ["Front 2", "Back 8", "Top 5"]);
  assert.deepStrictEqual(o.dlg, ["Redo", "Mirror Paste", "Give up what is being done", "Transform Pattern: turn clockwise (45°)", "Edit Pattern", "Front view", "Simulate / stop simulating", null, null, true]);
  assert.deepStrictEqual(o.missing, []);
  assert.ok(o.rows >= 55, "rows: " + o.rows);
});

test("a key goes to the row for where the program is: the 2D window, the 3D window, Print Layout", () => {
  const r = boot({ script: DOC + `
    out.draft = [id("f"), id("z", C), id("s", C), id("p", C), id("2"), id("z")];
    S.over3d = true; out.over3d = [id("2"), id("F", SH), id("f"), id("z", C)]; S.over3d = false;
    out.away = id("F", SH);
    app.setMode("layout"); out.layout = [id("f"), id("z", C), id("s", C), id("p", C), id("o", C), id("Delete"), id("a")]; app.setMode("draft");
    // a row with a condition is the key's only while it holds
    app.setTool("edit_pattern"); out.turnOff = id("ArrowRight", C);
    S.sel = [S.pieces[0].id]; app.setTool("transform_pattern"); out.turnOn = id("ArrowRight", C);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.draft, ["zoomSel", "undo", "save", null, null, "tool:edit_pattern"]);
  assert.deepStrictEqual(o.over3d, ["view:front", "arr_points", "zoomSel", "undo"]);
  assert.strictEqual(o.away, null, "Shift+F away from the 3D window is no key");
  assert.deepStrictEqual(o.layout, ["layFit", "undo", "save", "layPrint", null, null, null]);
  assert.strictEqual(o.turnOff, null); assert.strictEqual(o.turnOn, "turn:45");
});

test("the keys do what they did: undo and redo, select all, the views, the zoom, a tool, Delete, and the history's name for a key's step", () => {
  const r = boot({ script: DOC + `
    app.key("a", C); out.all = [S.sel.length, S.tool];
    app.key("Delete"); out.deleted = [S.pieces.length, last()];
    app.key("z", C); out.undone = S.pieces.length; app.key("y", C); out.redone = S.pieces.length; app.key("z", C);
    app.key("Z", CS); out.redone2 = S.pieces.length; app.key("z", C);
    app.key("z"); out.tool = S.tool;
    const s0 = S.view.s; app.key("+"); out.zin = S.view.s > s0; app.key("-"); out.zout = Math.abs(S.view.s - s0) < 1e-9;
    S.over3d = true; app.key("8"); out.back = app.view3d.cam.az; S.over3d = false;
    S.sel = [S.pieces[0].id]; app.setTool("transform_pattern");
    const x0 = S.pieces[0].pts[0].x; app.key("ArrowRight"); app.key("ArrowRight", SH); out.nudged = [S.pieces[0].pts[0].x - x0, last()];
    // a key in a text field is the field's
    const n = S.pieces.length; for (const f of [() => app.key("Delete", { target: { tagName: "INPUT", blur() {} } })]) f(); out.inField = S.pieces.length === n;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.all, [2, "transform_pattern"]); assert.deepStrictEqual(o.deleted, [0, "Delete"]);
  assert.deepStrictEqual([o.undone, o.redone, o.redone2], [2, 0, 0]);
  assert.strictEqual(o.tool, "edit_pattern"); assert.strictEqual(o.zin, true); assert.strictEqual(o.zout, true);
  assert.ok(Math.abs(o.back - Math.PI) < 1e-9);
  assert.deepStrictEqual(o.nudged, [11, "Nudge"]); assert.strictEqual(o.inField, true);
});

/* ---------- A2: exact modifiers ---------- */
test("every key of the table fires its command, and with one more modifier held it does not (Enter, Esc, Delete, the arrows and Space do not mind Shift or Alt)", () => {
  const r = boot({ desktop: true, script: DOC + `      // (as the desktop app, so that its two own keys are in reach too)
    S.sel = [S.pieces[0].id]; S.laySel = "x";
    out.tested = 0; out.bad = []; out.loose = [];
    for (const row of app.keyTable()) {
      app.setMode(row.w === "layout" ? "layout" : "draft"); S.over3d = row.w === "3d";
      if (row.w !== "layout") S.tool = /^turn:|^nudge/.test(row.id) ? "transform_pattern" : "edit_pattern";
      // (Round r12 / 3) Clone as Pattern's key wants a closed internal shape selected
      if (row.id === "cloneAsPattern") { const P0 = S.pieces[0]; if (!P0.internals.some(it => it.closed)) app.addChild(P0, "internals", app.mkShape([{x:20,y:20},{x:40,y:20},{x:40,y:40}], true)); S.selKind = "internal"; S.selInt = P0.internals.findIndex(it => it.closed); }
      else { S.selKind = "outline"; S.selInt = -1; }
      // (Round H1b / 2) Link Lines with two lines selected, as a user gives it (since Round H1c U is Link Lines' alone; the History panel is D)
      if (row.id === "linkLines") { const P0 = S.pieces[0]; app.ev("setLines")([{ p: P0, sh: P0, i: 0, kind: "outline", int: -1 }, { p: P0, sh: P0, i: 1, kind: "outline", int: -1 }]); }
      else if (S.selSeg >= 0) app.ev("setLines")([]);
      if (app.keyFind(evOf(row.k)) !== row) { out.bad.push(row.k + " does not reach " + row.id); continue; }
      out.tested++;
      const letter = /(^|[+])([A-Z]|[A-Z][A-Za-z0-9]+)$/.test(row.k);      // Shift is part of a key's name for letters and named keys only
      for (const m of ["Shift", "Alt", "Ctrl"]) {
        if (row.k.split("+").includes(m) || (m === "Shift" && !letter)) continue;
        const got = app.keyFind(evOf(row.k, [m]));
        if (row.l && m !== "Ctrl") { if (got !== row) out.loose.push(m + "+" + row.k); }
        else if (got && got.id === row.id && !(row.id === "reverse" && m === "Shift")) out.bad.push(m + "+" + row.k + " still does " + row.id);
      }
    }
    app.setMode("draft"); S.over3d = false; S.laySel = null;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.result.bad, []); assert.deepStrictEqual(r.result.loose, []);
  assert.ok(r.result.tested > 60, "rows tested: " + r.result.tested);
});

test("a letter with Shift or Alt held picks no tool; the Ctrl keys want exactly their modifiers; Ctrl+Shift+V and Ctrl+Shift+B are as they were", () => {
  const r = boot({ script: DOC + `
    app.setTool("transform_pattern");
    app.key("Z", SH); out.shiftZ = S.tool; app.key("z", AL); out.altZ = S.tool; app.key("z"); out.z = S.tool;
    app.setTool("edit_pattern");
    out.letters = [id("G", SH), id("u", AL), id("F", SH), id("f", AL), id("u", C), id("+", AL), id("-", AL), id("+", C)];
    app.setMode("layout"); S.laySel = "x"; out.layout = [id("f"), id("F", SH), id("f", AL), id("r"), id("R", SH), id("r", AL)]; S.laySel = null; app.setMode("draft");
    out.ctrl = [id("o", C), id("O", CS), id("d", C), id("D", CS), id("a", C), id("A", CS), id("a", CA), id("r", C), id("R", CS), id("i", C), id("I", CS), id("y", C), id("Y", CS), id("c", C), id("C", CS)];
    out.kept = [id("V", CS), id("B", CS), id("b", C), id("v", C), id("Z", CS), id("S", CS)];
    out.held = [id("Enter", SH), id("Escape", SH), id("Delete", SH), id("Backspace", AL), id("ArrowLeft", SH), id("ArrowLeft", AL), id(" ", SH), id("Enter", C), id("Delete", C)];
    // in the app: Ctrl+A selects all, Ctrl+Alt+A leaves the selection alone (Ctrl+Shift+A is Load Avatar since A5)
    S.sel = []; app.key("a", CA); app.key("A", { ctrlKey: true, altKey: true, shiftKey: true }); out.notAll = S.sel.length; app.key("a", C); out.all = S.sel.length;
    // Ctrl+D hangs a symmetric copy on the pointer, Ctrl+Alt+D nothing (Ctrl+Shift+D is Import DXF since A5)
    S.sel = [S.pieces[0].id]; app.key("d", CA); out.noCopy = !S.place; app.key("d", C); out.copy = !!S.place; app.key("Escape", SH); out.gaveUp = !S.place;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual([o.shiftZ, o.altZ, o.z], ["transform_pattern", "transform_pattern", "edit_pattern"]);
  assert.deepStrictEqual(o.letters, [null, null, null, null, null, null, null, null]);
  assert.deepStrictEqual(o.layout, ["layFit", null, null, "layTurn", null, null]);
  // (Round build-1: Ctrl+Alt+A is Select All Sewn, built; with nothing selected it still selects nothing)
  assert.deepStrictEqual(o.ctrl, ["open", "addProject", "symmetric", "importDXF", "selectAll", "loadAvatar", "selectSewn", "mirror", null, null, "invert", "redo", null, "copy", null]);
  assert.deepStrictEqual(o.kept, ["mirror", "reverse", "reverse", "paste", "redo", "saveAs"]);
  assert.deepStrictEqual(o.held, ["enter", "escape", "delete", "delete", "nudge", "nudge", "simulate", null, null]);
  assert.deepStrictEqual([o.notAll, o.all], [0, 2]); assert.deepStrictEqual([o.noCopy, o.copy, o.gaveUp], [true, true, true]);
});

/* ---------- A3: the 3D view keys ---------- */
test("the 3D views: Left on 6 and Right on 4, the two 3/4 views on 3 and 1, Bottom on 0; Left shows the avatar's own left side", () => {
  const r = boot({ script: DOC + `
    const cam = () => { const c = app.view3d.cam; return [c.dist*Math.cos(c.el)*Math.sin(c.az), c.dist*Math.sin(c.el), c.dist*Math.cos(c.el)*Math.cos(c.az)].map(v => +(v/c.dist).toFixed(3)); };
    out.names = app.ev("CAM_VIEWS").map(v => v[1] + " " + app.keyOf("view:" + v[0]));
    out.menu = app.avatarMenu().filter(x => /^view/.test("view") && app.ev("CAM_VIEWS").some(v => v[1] === x.n)).map(x => x.n + " " + x.k);
    S.over3d = true; out.at = {};
    for (const k of ["2", "3", "8", "6", "4", "1", "5", "0"]) { app.key(k); out.at[k] = cam(); }
    // with a modifier held, or with the pointer somewhere else, the key is no view
    app.key("2"); const front = cam();
    app.key("6", C); app.key("6", AL); app.key("8", CA); out.held = JSON.stringify(cam()) === JSON.stringify(front);
    S.over3d = false; app.key("6"); out.away = JSON.stringify(cam()) === JSON.stringify(front);
    out.ids = [id("6"), id("4")]; S.over3d = true; out.ids3 = [id("6"), id("4"), id("1"), id("3"), id("0"), id("6", C), id("6", AL), id("7"), id("9")]; S.over3d = false;
    out.rows = app.shortcutsDialog().filter(x => /^[0-9]$/.test(x[0])).map(x => x[0] + " " + x[1]);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.names, ["Front 2", "3/4 Left 3", "Back 8", "Left 6", "Right 4", "3/4 Right 1", "Top 5", "Bottom 0"]);
  assert.deepStrictEqual(o.menu, o.names, "the Avatar menu lists the same views with the same keys");
  // the avatar faces +z with y up, so its left is up x forward = (0,1,0) x (0,0,1) = +x: the camera of "Left" stands there
  const up = [0, 1, 0], fwd = [0, 0, 1], left = [up[1]*fwd[2] - up[2]*fwd[1], up[2]*fwd[0] - up[0]*fwd[2], up[0]*fwd[1] - up[1]*fwd[0]];
  assert.deepStrictEqual(left, [1, 0, 0]);
  assert.ok(o.at["6"][0] > 0.99, "Left: the camera is at the avatar's left, " + o.at["6"]); assert.ok(o.at["4"][0] < -0.99, "Right: " + o.at["4"]);
  assert.ok(o.at["2"][2] > 0.99 && o.at["8"][2] < -0.99, "Front looks at the face, Back at the back");
  assert.ok(o.at["3"][0] > 0.7 && o.at["3"][2] > 0.7, "3/4 Left: between the front and the left, " + o.at["3"]);
  assert.ok(o.at["1"][0] < -0.7 && o.at["1"][2] > 0.7, "3/4 Right: " + o.at["1"]);
  assert.ok(o.at["5"][1] > 0.99 && o.at["0"][1] < -0.99, "Top from above, Bottom from below");
  assert.strictEqual(o.held, true); assert.strictEqual(o.away, true);
  // (Round r20 continued (4)) Alt+6 is the Stress Map now (A10 p.37): still no view, but a row of its own
  assert.deepStrictEqual(o.ids, [null, null]); assert.deepStrictEqual(o.ids3, ["view:left", "view:right", "view:right34", "view:left34", "view:bottom", null, "stress3", null, null]);
  assert.deepStrictEqual(o.rows, ["2 Front view", "3 3/4 Left view", "8 Back view", "6 Left view", "4 Right view", "1 3/4 Right view", "5 Top view", "0 Bottom view"]);
});

/* ---------- A4: Shift + letter ---------- */
test("Shift+W, Shift+S and Shift+A flip Show Garment, Show Sewing and Show Avatar of the 3D window; Shift+Z the line lengths; Shift+T is Front Texture Surface", () => {
  const r = boot({ script: DOC + `
    const SA = { shiftKey: true, altKey: true }, on = (k) => (S.ui.show3d || {})[k] !== false;
    out.start = [on("garment"), on("sewing3"), on("avatar"), S.show.length];
    app.key("W", SH); app.key("S", SH); app.key("A", SH); app.key("Z", SH);
    out.off = [on("garment"), on("sewing3"), on("avatar"), S.show.length]; out.said = toasts.slice(-4);
    out.saved = [JSON.parse(app.storage.get("pdraft:ui")).show3d, app.storage.get("pdraft:view")];
    app.key("W", SH); app.key("S", SH); app.key("A", SH); app.key("Z", SH);
    out.on = [on("garment"), on("sewing3"), on("avatar"), S.show.length];
    // with one more modifier held, nothing is switched
    app.key("W", CS); app.key("W", SA); app.key("S", SA); app.key("A", SA); app.key("Z", SA); app.key("Z", CA);
    out.held = [on("garment"), on("sewing3"), on("avatar"), S.show.length];
    app.setRender("mono"); app.key("T", SA); out.mono = S.ui.render; app.key("T", SH); out.front = [S.ui.render, toasts[toasts.length-1]];
    // the plain letters are the tools they were, and the tool in hand is left alone by the Shift keys
    app.setTool("edit_pattern"); const t3 = S.tool3;
    for (const k of ["W", "S", "A", "Z", "T"]) app.key(k, SH);
    out.tools = [S.tool, S.tool3 === t3]; for (const k of ["W", "S", "A", "Z", "T"]) app.key(k, SH);
    out.plain = ["w", "s", "a", "z", "t"].map(k => id(k));
    // the lists show the keys
    const key = (items, n) => (items.find(x => x.n === n) || {}).k;
    out.lists = [key(app.selectorItems("info"), "Show Line Length"), key(app.selectorItems("info"), "Show Angle"), key(app.selectorItems("render"), "Front Texture Surface"), key(app.selectorItems("render"), "Monochrome Surface")];
    out.rows = app.shortcutsDialog().filter(x => /^Shift[+][WSAZT]$/.test(x[0])).map(x => x[0] + " " + x[1]);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.start, [true, true, true, true]); assert.deepStrictEqual(o.off, [false, false, false, false]);
  assert.deepStrictEqual(o.said, ["Garment: hidden", "Seamlines: hidden", "Avatar: hidden", "Line Length: hidden"]);
  assert.deepStrictEqual(o.saved, [null, null], "view state: kept for the session only (Round r23 / 1)");
  assert.deepStrictEqual(o.on, [true, true, true, true]); assert.deepStrictEqual(o.held, [true, true, true, true]);
  assert.strictEqual(o.mono, "mono"); assert.deepStrictEqual(o.front, ["front", "Front Texture Surface"]);
  assert.deepStrictEqual(o.tools, ["edit_pattern", true]);
  assert.deepStrictEqual(o.plain, ["tool:pin_box", "tool:rectangle", "tool:transform_pattern", "tool:edit_pattern", "tool:edit_texture"]);
  assert.deepStrictEqual(o.lists, ["Shift+Z", "", "Shift+T", ""]);
  assert.deepStrictEqual(o.rows, ["Shift+W Show Garment (3D window)", "Shift+S Show Seamlines (3D window)", "Shift+A Show Avatar (3D window)", "Shift+Z Show Line Length (2D window)", "Shift+T Front Texture Surface (2D window)"]);
});

test("Shift+H and Shift+V are Turn Half Round and Flip Over, in the 3D window only", () => {
  const r = boot({ script: DOC + `
    out.away = [id("H", SH), id("V", SH)];
    S.over3d = true;
    out.over = [id("H", SH), id("V", SH), id("H", CS), id("V", { shiftKey: true, altKey: true }), id("h"), id("v")];
    // the key reaches the same command as the 3D menu (here no cloth is up, so it says what it needs)
    const n = toasts.length; app.key("H", SH); app.key("V", SH); out.said = toasts.slice(n);
    app.key("H", CS); out.heldSaid = toasts.length - n;
    S.over3d = false; app.key("H", SH); out.awaySaid = toasts.length - n;
    S.ui.layout = "3d"; out.only3d = [id("H", SH), id("V", SH)]; S.ui.layout = "both";
    app.setMode("layout"); S.over3d = true; out.layout = [id("H", SH), id("V", SH)]; S.over3d = false; app.setMode("draft");
    out.of = [app.keyOf("turnHalf"), app.keyOf("flipOver")];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.away, [null, null]);
  assert.deepStrictEqual(o.over.slice(0, 4), ["turnHalf", "flipOver", null, null]); assert.ok(o.over[4] !== "turnHalf" && o.over[5] !== "flipOver");
  assert.deepStrictEqual(o.said, ["Select a pattern in the 3D window first", "Select a pattern in the 3D window first"]);
  assert.strictEqual(o.heldSaid, 2); assert.strictEqual(o.awaySaid, 2);
  assert.deepStrictEqual(o.only3d, ["turnHalf", "flipOver"], "with only the 3D window shown the pointer need not be over it");
  assert.deepStrictEqual(o.layout, [null, null]); assert.deepStrictEqual(o.of, ["Shift+H", "Shift+V"]);
});

/* ---------- A5: the Ctrl keys ---------- */
test("Ctrl+Shift+D and Ctrl+Shift+F import a DXF, into an emptied document or added to it; Ctrl+Shift+A opens Load Avatar; Ctrl+Shift+P asks for a pose file; Ctrl+F resets the selected patterns' 3D arrangement", () => {
  const r = boot({ script: DOC + `
    const SCA = { ctrlKey: true, shiftKey: true, altKey: true };
    out.ids = [id("D", CS), id("F", CS), id("A", CS), id("P", CS), id("f", C)];
    out.held = [id("D", SCA), id("F", SCA), id("A", SCA), id("P", SCA), id("f", CA), id("p", C)];
    app.setMode("layout"); out.layout = [id("D", CS), id("A", CS), id("f", C)]; app.setMode("draft");
    // the two imports end in the same dialog; only its "Append" tick starts differently
    let ticks = []; app.answer = (title, fields, opts) => { if (title === "Import DXF") ticks.push(opts.checks.find(c => c.k === "append").val); return { scale: 1, angle: 0 }; };
    let picks = 0; app.el("file-dxf").click = () => { picks++; };
    app.key("D", CS); app.dxfInNumeric({ x: 0, y: 0 }, "0", "a.dxf");
    app.key("F", CS); app.dxfInNumeric({ x: 0, y: 0 }, "0", "b.dxf");
    app.key("D", CS); app.openText("x.txt", "not a pattern"); app.dxfInNumeric({ x: 0, y: 0 }, "0", "c.dxf");      // a pick that came to nothing does not leave the next import emptying the document
    app.key("D", SCA);
    out.dxf = [ticks, picks]; app.answer = null;
    // Ctrl+F: the browser's Find is kept out (preventDefault), and with nothing selected in 3D the command says so
    let stopped = 0; const n = toasts.length;
    app.key("f", { ctrlKey: true, preventDefault() { stopped++; } }); out.reset = [stopped, toasts.slice(n)];
    app.key("f", { ctrlKey: true, altKey: true, preventDefault() { stopped++; } }); out.resetHeld = [stopped, toasts.length - n];
    // the menus show the keys
    const key = (items, name) => (items.find(x => x.n === name) || {}).k;
    const subOf = (items, n) => items.find(x => x && x.n === n).menu().filter(Boolean);
    out.menus = [key(subOf(app.MENUS.file(), "Import"), "DXF"), key(subOf(app.MENUS.file(), "Import (Add)"), "DXF"), key(app.avatarMenu(), "Load Avatar…"), key(app.MENUS.file(), "New Project")];
    out.rows = app.shortcutsDialog().filter(x => /^Ctrl[+](Shift[+][DFAP]|F|N|W)$/.test(x[0])).map(x => x[0] + " " + x[1]);
    // Ctrl+Shift+A: the Load Avatar dialog
    app.ev("hideDlg")(); app.key("A", SCA); out.noDlg = app.el("dlg").style.display !== "block";
    app.key("A", CS); out.dlg = [app.el("dlg").style.display, app.el("dlg").className];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.ids, ["importDXF", "addDXF", "loadAvatar", "loadPose", "reset3d"]);
  assert.deepStrictEqual(o.held, [null, null, null, null, null, null]); assert.deepStrictEqual(o.layout, [null, null, null]);
  assert.deepStrictEqual(o.dxf, [[false, true, true], 3], "Import starts unticked, Import (Add) ticked; three file pickers were opened");
  assert.deepStrictEqual(o.reset, [1, ["Select a pattern in the 3D window first"]]); assert.deepStrictEqual(o.resetHeld, [1, 1]);
  assert.deepStrictEqual(o.menus, ["Ctrl+Shift+D", "Ctrl+Shift+F", "Ctrl+Shift+A", ""], "New has no key in a browser");
  assert.deepStrictEqual(o.rows, ["Ctrl+Shift+D Import DXF", "Ctrl+Shift+F Import DXF, added to this document", "Ctrl+Shift+A Load Avatar", "Ctrl+Shift+P Load Pose File", "Ctrl+F Reset 3D Arrangement (Selected)"]);
  assert.strictEqual(o.noDlg, true); assert.deepStrictEqual(o.dlg, ["block", "avatar"]);
});

test("Import DXF without Append asks about unsaved work as Open does (Save / Don't Save / Cancel) before it takes the document's place, and is one undo step; with Append, or with nothing unsaved, it does not ask", () => {
  const r = boot({ script: DOC + `
    let file = null, saved = 0;
    app.setDownload((name, text) => { if (/[.]dxf$/.test(name)) file = text; else saved++; });
    app.answer = () => ({ scale: 1, rotate: 0, format: "aama", units: "mm", straight: false, optimise: true, nobase: false, nograde: true, dup: false, selected: false });
    app.dxfOutNumeric({ x: 0, y: 0 });
    const imp = (append) => { app.answer = () => ({ scale: 1, angle: 0, append, auto: true, swap: false, tosa: true, optimise: true, notches: true, internals: true, anno: true, distribute: false }); app.dxfInNumeric({ x: 0, y: 0 }, file, "two.dxf"); };
    const asked = []; let pick = "cancel";
    app.modalAnswer = (title, keys, text) => { asked.push([title, keys.join(), text]); return pick; };
    const state = () => [S.pieces.length, S.undo.length, asked.length, saved, S.dirty];
    S.pieces.push(sq("C", 900, 100)); app.commit(); S.undo.length = 0;
    out.start = state();
    imp(false); out.cancel = state();
    pick = "discard"; imp(false); out.discard = state(); out.sel = S.sel.length;
    app.undo(); out.undone = [S.pieces.length, S.pieces.map(p => p.name).join()]; app.redo();
    pick = "save"; imp(false); out.save = state();
    imp(true); out.append = state();
    app.ev("markClean")(); imp(false); out.clean = state();
    out.q = asked[0];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.start, [3, 0, 0, 0, true]);
  assert.deepStrictEqual(o.cancel, [3, 0, 1, 0, true], "Cancel: asked, and nothing changed");
  assert.deepStrictEqual(o.discard, [2, 1, 2, 0, true], "Don't Save: the two imported patterns in the document's place, one undo step"); assert.strictEqual(o.sel, 2);
  assert.deepStrictEqual(o.undone, [3, "A,B,C"], "one undo brings the document back");
  assert.deepStrictEqual(o.save, [2, 2, 3, 1, true], "Save: saved first, then imported");
  assert.deepStrictEqual(o.append, [4, 3, 3, 1, true], "with Append nothing is replaced and nothing is asked");
  assert.deepStrictEqual(o.clean.slice(0, 4), [2, 4, 3, 1], "nothing unsaved: not asked");
  assert.deepStrictEqual(o.q.slice(0, 2), ["Unsaved changes", "save,discard,cancel"]); assert.ok(/before you import two\.dxf in its place\?$/.test(o.q[2]), o.q[2]);
});

test("Ctrl+N is New and Ctrl+W Remove All Pins in the desktop app only: in a browser they are no keys of ours", () => {
  const script = DOC + `
    S.pieces[0].pins = [{ x: 150, y: 150 }]; app.commit();
    out.ids = [id("n", C), id("w", C), id("N", CS), id("W", CS), id("n", CA), id("w", CA)];
    let stopped = 0; const P = { ctrlKey: true, preventDefault() { stopped++; } };
    app.key("w", { ...P, altKey: true }); app.key("W", { ...P, shiftKey: true }); out.pinsHeld = (S.pieces[0].pins || []).length;
    app.key("w", P); out.pins = (S.pieces[0].pins || []).length;
    app.key("n", { ...P, altKey: true }); app.key("N", { ...P, shiftKey: true }); out.piecesHeld = S.pieces.length;
    app.key("n", P); out.pieces = S.pieces.length; out.stopped = stopped;
    out.said = toasts[toasts.length-1];
    out.menu = (app.MENUS.file().find(x => x && x.n === "New Project") || {}).k;
    out.rows = app.shortcutsDialog().filter(x => /^Ctrl[+][NW]$/.test(x[0])).map(x => x[0] + " " + x[1]);
    return out;`;
  const web = boot({ script }), desk = boot({ desktop: true, script });
  assert.deepStrictEqual(web.errors, []); assert.deepStrictEqual(desk.errors, []);
  const w = web.result, d = desk.result;
  assert.deepStrictEqual(w.ids, [null, null, null, null, null, null]);
  assert.deepStrictEqual([w.pins, w.pieces, w.stopped, w.menu, w.rows], [1, 2, 0, "", []], "in a browser the keys are left to it: nothing is removed, nothing is stopped, no key is shown");
  assert.deepStrictEqual(d.ids, ["new", "removePins", null, null, null, null]);
  assert.deepStrictEqual([d.pinsHeld, d.pins], [1, 0], "Ctrl+W takes the pins, with Alt or Shift held as well it does not");
  assert.deepStrictEqual([d.piecesHeld, d.pieces], [2, 0], "Ctrl+N starts a new document (the harness answers Don't Save)");
  assert.strictEqual(d.stopped, 2); assert.strictEqual(d.said, "New document");
  assert.strictEqual(d.menu, "Ctrl+N"); assert.deepStrictEqual(d.rows, ["Ctrl+N New", "Ctrl+W Remove All Pins"]);
  assert.ok(desk.modals.some(m => m.title === "Unsaved changes"), "it asks about unsaved work first");
});

test("the keys kept for commands that are not built yet say so and change nothing; the browser keeps them too", () => {
  const r = boot({ script: DOC + `
    const kept = app.ev("KEYS_KEPT"), before = app.docJSON(), tool = S.tool, sel = S.sel.length;
    out.n = kept.length; out.said = []; out.stopped = 0;
    for (const [k, name] of kept) {
      const n = toasts.length; app.key(evOf(k).key, { ...evOf(k), preventDefault() { out.stopped++; } });
      out.said.push(toasts.length === n + 1 && toasts[n] === name + " is not built yet");
    }
    out.quiet = [app.docJSON() === before, S.tool === tool, S.sel.length === sel, S.undo.length];
    // with one more modifier held the key is not the kept one
    out.held = [id("O", SH), id("y", AL), id("X", { shiftKey: true, altKey: true }), id("j", CA), id("F10", SH), id("1", CA)];
    out.rows = app.shortcutsDialog().filter(x => / [(]not built yet[)]$/.test(x[1]) && !/^[A-Z;]$/.test(x[0])).length;
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.strictEqual(o.n, 2 /* (Round r20 / 9: Ctrl+[ and Ctrl+] are Superimpose Over / Under; r20 / 11: F9 Show 3D Garment Window Size) */, "Alt+1, Alt+3, Alt+5, Alt+W and Shift+X the 3D and avatar display since Round r17b / 3, F10 the 3D snapshot since r17b / 4; Alt+2, Alt+4 and Alt+9 are 3D rendering styles since Round D / D1, Ctrl+Shift+O is Add Project since D4, Y the Library since D5; Shift+Q, Shift+C, Ctrl+J, Ctrl+H and Ctrl+K the 3D pattern states since Round r14 / 6, Shift+I Isolate Selection since r14 / 7, Ctrl+Alt+A Select All Sewn since build-1 / 2, Ctrl+E Solidify since build-1 / 5"); assert.ok(o.said.every(Boolean), "each says it is not built yet: " + o.said);
  assert.strictEqual(o.stopped, 0, "none is taken from the browser"); assert.deepStrictEqual(o.quiet, [true, true, true, 0]);
  assert.deepStrictEqual(o.held, [null, null, null, null, null, null]); assert.strictEqual(o.rows, 1 /* (Round r20 / 9: Ctrl+[ and Ctrl+] are built; r20 / 11: F9) */, "listed under their own heading (O and Y are single letters, counted apart; six fewer since Round r14 / 6 and 7, two fewer since build-1: Ctrl+Alt+A, Ctrl+E; six fewer since Round r17b: Alt+1, Alt+3, Alt+5, Alt+W, Shift+X, F10)");
});

/* ---------- A6: Edit Curvature has no right-click ---------- */
test("a right-click with Edit Curvature in hand opens no menu, on a line, a point, a pattern or empty space; with Edit Pattern the same click opens it", () => {
  const r = boot({ script: DOC + `
    const at = (q) => app.toS(q), places = { line: at({ x: 200, y: 100 }), point: at({ x: 100, y: 100 }), body: at({ x: 200, y: 200 }), empty: at({ x: 420, y: 420 }) };
    const rightClick = (tool, s) => { app.setTool(tool); app.hideMenu(); app.menu.children.length = 0; app.fire("contextmenu", { x: s.x, y: s.y, button: 2 }); return [app.menu.style.display === "block", app.menu.children.length > 0]; };
    out.curv = Object.keys(places).map(k => rightClick("edit_curvature", places[k]));
    out.edit = Object.keys(places).map(k => rightClick("edit_pattern", places[k])[0]);
    // nothing was selected, changed or left half done by the right-clicks of Edit Curvature
    app.setTool("edit_curvature"); S.sel = []; const before = app.docJSON(), u = S.undo.length;
    for (const k of Object.keys(places)) app.fire("contextmenu", { x: places[k].x, y: places[k].y, button: 2 });
    out.quiet = [app.docJSON() === before, S.undo.length === u, S.sel.length, !S.drag];
    // the tool still bends a line with the left button
    const a = at({ x: 200, y: 100 }), b = at({ x: 200, y: 60 });
    app.fire("pointermove", { x: a.x, y: a.y }); app.fire("pointerdown", { x: a.x, y: a.y }); app.fire("pointermove", { x: b.x, y: b.y }); app.fire("pointerup", { x: b.x, y: b.y });
    out.bent = !!S.pieces[0].segs[0].curved;
    out.hint = /right-click does nothing/.test(app.HINT.edit_curvature);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  assert.deepStrictEqual(o.curv, [[false, false], [false, false], [false, false], [false, false]], "no menu anywhere");
  assert.deepStrictEqual(o.edit, [true, true, true, true], "Edit Pattern still has its menus");
  assert.deepStrictEqual(o.quiet, [true, true, 0, true]); assert.strictEqual(o.bent, true); assert.strictEqual(o.hint, true);
});

/* ---------- A7: the view controls ---------- */
test("view controls: two ready-made sets named by what they do and a custom one; a new installation starts with the right button turning the view and the wheel forward zooming in", () => {
  const S = { prefs: null };
  const { VIEW_PRESETS, normViewCtl, viewCtl, viewDrag, viewHelp, normPrefs, PREFS_DEFAULT } = load(["VIEW_PRESETS", "normViewCtl", "viewCtl", "viewDrag", "viewHelp", "normPrefs", "PREFS_DEFAULT"], { S });
  assert.deepStrictEqual(VIEW_PRESETS.map(p => p[0] + ": " + p[1]), ["right: Right button turns the view", "left: Left button turns the view", "custom: Custom"]);
  assert.deepStrictEqual(viewCtl(), { preset: "right", turn: "right", pan: "middle", menu: "right", wheel: "in" }, "with nothing saved");
  assert.deepStrictEqual(PREFS_DEFAULT.view.preset, "right"); assert.strictEqual(normPrefs({ unit: "cm" }).view.preset, "right", "preferences saved before there was such a setting");
  assert.deepStrictEqual(normViewCtl({ preset: "sideways", turn: "thumb", pan: 7, menu: "left", wheel: "up" }), { preset: "right", turn: "right", pan: "middle", menu: "right" }, "junk falls back");
  // a ready-made set is what it is, whatever else is stored beside it
  S.prefs = normPrefs({ view: { preset: "left", turn: "middle", pan: "left", wheel: "out" } });
  assert.deepStrictEqual(viewCtl(), { preset: "left", turn: "left", pan: "right", menu: "right", wheel: "in" });
  S.prefs = normPrefs({ view: { preset: "right", wheel: "out" } }); assert.strictEqual(viewCtl().wheel, "in", "a leftover of the custom set does not turn a ready-made set's wheel round");
  // (Round r12 / 1) the wheel is its own setting, in every set; a custom set saved with the wheel turned round keeps it
  S.prefs = normPrefs({ view: { preset: "custom", turn: "middle", pan: "left", menu: "middle", wheel: "out" } });
  assert.strictEqual(S.prefs.wheelRev, true, "an earlier custom choice of the wheel is kept");
  assert.deepStrictEqual(viewCtl(), { preset: "custom", turn: "middle", pan: "left", menu: "middle", wheel: "out" });
  S.prefs = normPrefs({ view: { preset: "right" }, wheelRev: true }); assert.strictEqual(viewCtl().wheel, "out", "reversed in a ready-made set");
  S.prefs = normPrefs({ view: { preset: "custom", wheel: "out" }, wheelRev: false }); assert.strictEqual(viewCtl().wheel, "in", "the setting wins once it is saved");
  assert.strictEqual(normPrefs(null).wheelRev, false, "off by default: forward zooms in");
  assert.strictEqual(normViewCtl({ preset: "custom", turn: "left", pan: "left" }).pan, "middle", "one button cannot both turn and pan"); assert.strictEqual(normViewCtl({ preset: "custom", turn: "middle", pan: "middle" }).pan, "right");
  // what a press starts: [left, middle, right], then the left button with Shift
  const starts = (c) => [0, 1, 2].map(b => viewDrag(b, false, c)).concat([viewDrag(0, true, c)]);
  const R = VIEW_PRESETS[0][2], L = VIEW_PRESETS[1][2];
  assert.deepStrictEqual(starts(R), [null, "pan", "turn", null], "right button turns: the left button is left to the tool, the middle one pans");
  assert.deepStrictEqual(starts(L), ["turn", "pan", "pan", "pan"], "left button turns: the right or the middle one pans, and so does Shift with the left");
  assert.strictEqual(viewDrag(2, true, R), "pan", "Shift makes a turn a pan");
  assert.deepStrictEqual(starts({ turn: "middle", pan: "left", menu: "right", wheel: "in" }), ["pan", "turn", null, "pan"]);
  assert.deepStrictEqual(starts({ turn: "left", pan: "right", menu: "middle", wheel: "in" }), ["turn", null, "pan", "pan"], "a middle button that opens the menu does not pan");
  // in words, and no other program is named
  S.prefs = normPrefs(null); assert.strictEqual(viewHelp(), "right-drag to turn the view, middle-drag to pan, wheel forward to zoom in, double-click to reset");
  S.prefs = normPrefs({ view: { preset: "left" } }); assert.strictEqual(viewHelp(), "drag to turn the view, right-drag to pan, wheel forward to zoom in, double-click to reset");
  S.prefs = normPrefs({ view: { preset: "custom", wheel: "out" } }); assert.ok(/wheel back to zoom in/.test(viewHelp()));
  S.prefs = normPrefs({ view: { preset: "left" }, wheelRev: true }); assert.ok(/wheel back to zoom in/.test(viewHelp()));
});

test("the wheel: forward zooms in and backward out in the 2D window, the 3D window and Print Layout, in every set; the setting Reverse the wheel turns it round in all of them, in every set (Round r12 / 1)", () => {
  const r = boot({ script: DOC + `
    const zoom = () => {
      const o = {};
      let s = S.view.s; app.fire("wheel", { x: 300, y: 300, deltaY: -100 }); o.d2in = S.view.s > s; s = S.view.s; app.fire("wheel", { x: 300, y: 300, deltaY: 100 }); o.d2out = S.view.s < s;
      let d = app.view3d.cam.dist; app.view3d.mouse.wheel({ deltaY: -100 }); o.d3in = app.view3d.cam.dist < d; d = app.view3d.cam.dist; app.view3d.mouse.wheel({ deltaY: 100 }); o.d3out = app.view3d.cam.dist > d;
      app.setMode("layout"); s = S.lview.s; app.fireLay("wheel", { x: 300, y: 300, deltaY: -100 }); o.layIn = S.lview.s > s; s = S.lview.s; app.fireLay("wheel", { x: 300, y: 300, deltaY: 100 }); o.layOut = S.lview.s < s; app.setMode("draft");
      return Object.values(o).join(" ");
    };
    out.start = [S.prefs.view.preset, zoom()];
    app.setPrefs({ view: { preset: "left" } }); out.left = zoom();
    app.setPrefs({ view: { preset: "left", wheel: "out" } }); out.leftStill = zoom();
    app.setPrefs({ view: { preset: "custom" } }); out.custom = zoom();
    app.setPrefs({ wheelRev: true }); out.turned = zoom();
    app.setPrefs({ view: { preset: "right" } }); out.turnedRight = zoom();
    app.setPrefs({ view: { preset: "left" } }); out.turnedLeft = zoom();
    out.saved = JSON.parse(app.storage.get("pdraft:prefs"));
    out.saved = [out.saved.view.preset, out.saved.wheelRev];
    app.setPrefs({ wheelRev: false }); out.back = zoom();
    // the setting is a check box in Settings
    app.settingsDialog({ x: 10, y: 10 }); const html = app.el("dlg").innerHTML; app.ev("hideDlg")();
    out.box = [/<input type="checkbox" data-p="wheelRev">/.test(html), /Reverse the wheel: forward zooms out, backward zooms in/.test(html)];
    app.setPrefs({ wheelRev: true }); app.settingsDialog({ x: 10, y: 10 }); out.boxOn = /data-p="wheelRev" checked/.test(app.el("dlg").innerHTML); app.ev("hideDlg")();
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, all = "true true true true true true", none = "false false false false false false";
  assert.deepStrictEqual(o.start, ["right", all], "a new installation: the right-button set, forward zooms in");
  assert.strictEqual(o.left, all); assert.strictEqual(o.leftStill, all, "a ready-made set cannot be turned round");
  assert.strictEqual(o.custom, all); assert.strictEqual(o.turned, none, "reversed: every window the other way");
  assert.strictEqual(o.turnedRight, none); assert.strictEqual(o.turnedLeft, none, "reversed in the ready-made sets too");
  assert.deepStrictEqual(o.saved, ["left", true], "kept per machine"); assert.strictEqual(o.back, all);
  assert.deepStrictEqual(o.box, [true, true], "a check box in Settings, off"); assert.strictEqual(o.boxOn, true, "ticked while reversed");
});

test("the mouse in the 3D window: with the right-button set a right drag turns, a middle drag pans and a left drag on empty space does nothing; with the left-button set the left turns; a click of the menu button opens the menu", () => {
  const r = boot({ script: DOC + `
    const cam = app.view3d.cam, M = app.view3d.mouse;
    let menus = 0, tool = { menu() { menus++; } };
    app.view3d.tool(tool);
    // a drag of 60 px to the right with one button: has the view turned, has it moved sideways?
    const dragged = (button, mods) => {
      const a0 = cam.az, t0 = [cam.tx, cam.ty, cam.tz].join();
      M.press({ button, clientX: 300, clientY: 300, ...mods }); M.move({ clientX: 330, clientY: 300 }); M.move({ clientX: 360, clientY: 300 }); M.release({ button, clientX: 360, clientY: 300 });
      const got = cam.az !== a0 ? "turn" : [cam.tx, cam.ty, cam.tz].join() !== t0 ? "pan" : "nothing";
      return got;
    };
    const click = (button) => { const n = menus; M.press({ button, clientX: 300, clientY: 300 }); M.release({ button, clientX: 300, clientY: 300 }); return menus - n; };
    const all = () => [dragged(0), dragged(1), dragged(2), dragged(0, { shiftKey: true }), click(0), click(1), click(2)].join(" ");
    out.right = all();
    const m0 = menus; out.dragNoMenu = [dragged(2), menus - m0];          // a right drag turns and opens no menu
    app.setPrefs({ view: { preset: "left" } }); out.left = all();
    app.setPrefs({ view: { preset: "custom", turn: "middle", pan: "left", menu: "right" } }); out.custom = all();
    app.setPrefs({ view: { preset: "custom", turn: "left", pan: "right", menu: "middle" } }); out.midMenu = all();
    // the tool in hand is offered the left button first, whatever the set: what it takes is not the view's
    app.setPrefs({ view: { preset: "left" } });
    let taken = 0; app.view3d.tool({ down() { taken++; return true; }, move() {}, up() {} });
    out.toolFirst = [dragged(0), taken, dragged(2)];
    app.setPrefs({ view: { preset: "right" } }); out.toolFirstRight = [dragged(0), taken, dragged(2)];
    // the Settings dialog and the list of shortcuts say it in words
    app.view3d.tool(null);
    app.settingsDialog({ x: 10, y: 10 }); const html = app.el("dlg").innerHTML; app.ev("hideDlg")();
    out.dlg = [/View controls/.test(html), /Right button turns the view/.test(html), /Left button turns the view/.test(html), /Reverse the wheel/.test(html), /forward zooms out/.test(html)];
    const rows = app.shortcutsDialog(); app.ev("hideDlg")();
    out.rows = rows.filter(x => /3D window: (turn|pan)|^Wheel/.test(x[0] + x[1])).map(x => x[0] + " | " + x[1]);
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result;
  //                         left    middle right  Shift+left   clicks: left middle right
  assert.strictEqual(o.right, "nothing pan turn nothing 0 0 1");
  assert.deepStrictEqual(o.dragNoMenu, ["turn", 0]);
  assert.strictEqual(o.left, "turn pan pan pan 0 0 1");
  assert.strictEqual(o.custom, "pan turn nothing pan 0 0 1");
  assert.strictEqual(o.midMenu, "turn nothing pan pan 0 1 0");
  assert.deepStrictEqual(o.toolFirst, ["nothing", 1, "pan"]); assert.deepStrictEqual(o.toolFirstRight, ["nothing", 2, "turn"]);
  assert.deepStrictEqual(o.dlg, [true, true, true, true, true]);
  assert.deepStrictEqual(o.rows, ["Right button + drag | 3D window: turn the view (Settings: View controls)", "Middle button + drag | 3D window: pan the view", "Wheel forward | Zoom in (2D window, 3D window, Print Layout)"]);
});

test("G1 the 3D view turns all the way under the floor as over the head, symmetric, with only a hair kept off each pole; panning and the wheel are as they were", () => {
  const r = boot({ script: DOC + `
    const cam = app.view3d.cam, M = app.view3d.mouse;
    app.setPrefs({ view: { preset: "right" } });
    const turn = (dy) => { M.press({ button: 2, clientX: 300, clientY: 300 }); for (let k = 1; k <= 20; k++) M.move({ clientX: 300, clientY: 300 + dy*k/20 }); M.release({ button: 2, clientX: 300, clientY: 300 + dy }); return cam.el; };
    cam.el = 0.2;
    out.down = turn(-2000);                       // far past the bottom
    out.downMore = turn(-500);
    out.up = turn(4000);                          // far past the top
    cam.el = 0.2; out.below = turn(-100);         // a little: under the floor, no stop at it
    out.back = turn(100);
    const t0 = [cam.tx, cam.ty, cam.tz]; M.press({ button: 1, clientX: 300, clientY: 300 }); M.move({ clientX: 340, clientY: 330 }); M.release({ button: 1, clientX: 340, clientY: 330 });
    out.panned = [cam.tx, cam.ty, cam.tz].some((v, k) => Math.abs(v - t0[k]) > 1e-6) && Math.abs(cam.el - out.back) < 1e-12;
    const d = cam.dist; M.wheel({ deltaY: -100 }); out.zoom = cam.dist < d;
    out.views = [app.ev("orbitEl")(-9), app.ev("orbitEl")(9), app.ev("orbitEl")(-0.4)];
    return out;` });
  assert.deepStrictEqual(r.errors, []);
  const o = r.result, pole = Math.PI/2 - 0.001;
  assert.ok(Math.abs(o.down + pole) < 1e-9 && Math.abs(o.downMore + pole) < 1e-9, "straight under the avatar, a hair off the pole: " + o.down);
  assert.ok(Math.abs(o.up - pole) < 1e-9, "and straight over it: " + o.up);
  assert.ok(Math.abs(o.below - (0.2 - 0.8)) < 1e-9 && o.below < -0.3, "under the floor (the old stop was at -0.3): " + o.below);
  assert.ok(Math.abs(o.back - 0.2) < 1e-9, "and back");
  assert.ok(o.panned && o.zoom, "pan and zoom as before");
  assert.deepStrictEqual(o.views, [-pole, pole, -0.4]);
});

module.exports = T;
