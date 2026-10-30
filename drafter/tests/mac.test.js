// Round desk-2: the same app on a Mac. Cmd does what Ctrl does elsewhere, but the keys a Mac keeps for itself with Cmd
// (Cmd+H hides, Cmd+Q quits, Cmd+W closes the window) leave their commands on the Mac's Control key; the menus, the
// Keyboard Shortcuts dialog, the hints and the toasts write the keys as they are pressed there (Cmd, Control, Option).
// Option with a digit or a letter is read by the key's place. A text field gets Cmd+C, X, V, A, Z from the desktop shell.
// The mouse: Control + a click is a right-click on a Mac, and Alt (Option) + a left drag pans, for a trackpad.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
const ID = `
  const id = (key, mods) => { const code = /^[0-9]$/.test(key) ? "Digit" + key : /^[a-z]$/i.test(key) ? "Key" + key.toUpperCase() : key; const r = app.keyFind({ key, code, ...mods }); return r ? r.id : null; };
  const M = { metaKey: true }, C = { ctrlKey: true };
`;

test("a Mac: Cmd is Ctrl, but Cmd+H, Cmd+Q and Cmd+W are left to the Mac and their commands are on Control; Control does the rest too; Option + a digit by its place", () => {
  const r = boot({ desktop: {}, script: ID + `
    const out = {};
    out.pc = [id("s", C), id("s", M), id("h", C), id("h", M), app.keyOf("save"), app.keyOf("strong3"), app.keyOf("strain3")];
    app.ev("MAC = true");
    out.mac = [id("s", M), id("s", C), id("S", { metaKey: true, shiftKey: true }), id("h", M), id("h", C), id("q", M), id("q", C), id("w", M), id("w", C),
      id("z", M), id("Z", { metaKey: true, shiftKey: true }), id("k", M), id("ArrowRight", M)];
    // Option + 7 gives another sign on a Mac keyboard: the key's place is what counts
    out.option = [app.keyFind({ key: "\\u00b6", code: "Digit7", altKey: true }).id, app.keyFind({ key: "\\u2211", code: "KeyW", altKey: true }) && app.keyFind({ key: "\\u2211", code: "KeyW", altKey: true }).id];
    out.shown = ["save", "saveAs", "strong3", "tool:quick_pinching", "removePins", "strain3", "redo", "turn:90"].map(k => app.keyOf(k));
    out.text = app.ev("macKeys")("Ctrl+B reverses; Ctrl+click for a curve point; Ctrl+H and Ctrl+Shift+V; Alt+drag pans");
    return out;
  ` });
  assert.deepStrictEqual(r.result.pc, ["save", "save", "strong3", "strong3", "Ctrl+S", "Ctrl+H", "Alt+7"], "elsewhere nothing changes: the command key is Ctrl, as before");
  assert.deepStrictEqual(r.result.mac, ["save", "save", "saveAs", null, "strong3", null, "tool:quick_pinching", null, "removePins", "undo", "redo", "freeze3", null],
    "Cmd+H, Q, W go to the Mac; Control+S still saves; Cmd+→ turns only with Transform Pattern in hand");
  assert.deepStrictEqual(r.result.option, ["strain3", "wire3"]);      // (Alt+W is Show Wireframe since Round r17b / 3)
  assert.deepStrictEqual(r.result.shown, ["Cmd+S", "Cmd+Shift+S", "Control+H", "Control+Q", "Control+W", "Option+7", "Cmd+Y", "Cmd+Down"]);
  assert.strictEqual(r.result.text, "Cmd+B reverses; Cmd+click for a curve point; Control+H and Cmd+Shift+V; Option+drag pans");
});

test("a Mac: the Keyboard Shortcuts dialog and a tool's hint write Cmd, Control and Option; the toast too", () => {
  const r = boot({ script: `
    app.ev("MAC = true");
    app.shortcutsDialog();
    const t = app.ev("dlg").innerHTML;
    app.setTool("edit_sewing");
    app.ev("toast")("Ctrl+B reverses it");
    return { dlg: [/Cmd[+]Shift[+]S/.test(t), /Control[+]H/.test(t), /Option[+]7/.test(t), /Ctrl[+]/.test(t), /Option [+] drag/.test(t), /Control [+] click, two-finger click/.test(t)],
      hint: app.ev("document.getElementById('s-hint').textContent"), toast: app.ev("document.getElementById('toast').textContent") };
  ` });
  assert.deepStrictEqual(r.result.dlg, [true, true, true, false, true, true], "no Ctrl+ left in the dialog on a Mac");
  assert.ok(/Cmd[+]B reverses/.test(r.result.hint) && !/Ctrl[+]/.test(r.result.hint), r.result.hint);
  assert.strictEqual(r.result.toast, "Cmd+B reverses it");
});

test("a Mac in the desktop app: Cmd+C, X, V, A and Z in a text field are done by the shell (it has no Edit menu of its own); elsewhere a text field is left alone", () => {
  const r = boot({ desktop: {}, script: `
    const asked = [], field = { tagName: "INPUT", blur() {} };
    app.ev("DESK").edit = (w) => asked.push(w);
    app.key("v", { metaKey: true, target: field });
    app.ev("MAC = true");
    for (const k of ["v", "c", "x", "a", "z"]) app.key(k, { metaKey: true, target: field });
    app.key("z", { metaKey: true, shiftKey: true, target: field });
    app.key("v", { ctrlKey: true, target: field });
    app.key("v", { metaKey: true, target: { tagName: "TEXTAREA" } });
    return asked;
  ` });
  assert.deepStrictEqual(r.result, ["paste", "copy", "cut", "selectAll", "undo", "redo", "paste"], "not off a Mac, not with Control; a text area as a field");
});

test("the mouse: Alt + a left drag pans the 2D window (a trackpad has no middle button), but drags the pivot on Transform Pattern's centre mark; on a Mac, Control + a click is a right-click and not the tool's", () => {
  const r = boot({ script: `
    const out = {};
    S.pieces.length = 0;
    S.pieces.push(app.mkPiece("A", app.mkShape([{x:100,y:100},{x:300,y:100},{x:300,y:300},{x:100,y:300}], true))); app.commit();
    app.setTool("edit_pattern");
    const x0 = S.view.x, y0 = S.view.y;
    app.fire("pointermove", { x: 50, y: 50 }); app.fire("pointerdown", { x: 50, y: 50, altKey: true }); app.fire("pointermove", { x: 90, y: 70, altKey: true });
    out.pan = [S.drag && S.drag.k, S.view.x - x0, S.view.y - y0];
    app.fire("pointerup", { x: 90, y: 70 });
    // the centre mark of the selected pattern with Transform Pattern: Alt drags the pivot
    S.sel = [S.pieces[0].id]; app.setTool("transform_pattern");
    const c = app.toS({ x: 200, y: 200 });
    app.fire("pointermove", { x: c.x, y: c.y }); app.fire("pointerdown", { x: c.x, y: c.y, altKey: true });
    out.pivot = S.drag && S.drag.k;
    app.fire("pointerup", { x: c.x, y: c.y });
    // Control + a click with the Polygon tool: a curve point elsewhere, a right-click on a Mac
    app.setTool("polygon"); S.draft = null;
    app.fire("pointermove", { x: 400, y: 400 }); app.fire("pointerdown", { x: 400, y: 400, ctrlKey: true }); app.fire("pointerup", { x: 400, y: 400, ctrlKey: true });
    out.pc = !!(S.draft && S.draft.pts && S.draft.pts.length);
    S.draft = null; app.ev("MAC = true");
    app.fire("pointermove", { x: 420, y: 400 }); app.fire("pointerdown", { x: 420, y: 400, ctrlKey: true }); app.fire("pointerup", { x: 420, y: 400, ctrlKey: true });
    out.mac = !!(S.draft && S.draft.pts && S.draft.pts.length);
    app.fire("pointermove", { x: 440, y: 400 }); app.fire("pointerdown", { x: 440, y: 400, metaKey: true }); app.fire("pointerup", { x: 440, y: 400, metaKey: true });
    out.cmd = !!(S.draft && S.draft.pts && S.draft.pts.length);
    return out;
  ` });
  assert.deepStrictEqual(r.result.pan, ["pan", 40, 20]);
  assert.strictEqual(r.result.pivot, "pivot");
  assert.deepStrictEqual([r.result.pc, r.result.mac, r.result.cmd], [true, false, true], "Control + a click draws elsewhere; on a Mac it is a right-click, and Cmd + a click draws");
});

module.exports = T;
