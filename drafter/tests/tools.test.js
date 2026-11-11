// The tool registry (drafter-tools.js) and what the app builds from it: toolbars for the
// 2D and 3D windows, keys, our own icons, placeholders for tools that are not built,
// the "show unbuilt tools" switch and the window layout switch.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pageHTML, pageScripts, appSource } = require("./harness");
const REG = require("../drafter-tools.js");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 15000 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot (killed after 15 s)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  return JSON.parse(r.stdout);
}
const BUILT_3D = ["seamline_rip", "edit_rip" /* (Round FIX-4 / A) */, "select_mesh_box", "select_mesh_lasso", "select_mesh_brush" /* (Round FIX-4 / B) */, "simulate", "select_move", "pin_box", "fold_arrangement", "tape_basic", "circ_basic", /* arr_points: no longer a toolbar tool since Round r33 / 5 (a display switch of the Avatar list) */ "reset_2d_arrangement", "reset_3d_arrangement", "redrape" /* (Round r33b / 4) */, "hi_res", "low_res", "custom_res", "tack", "tack_avatar", "edit_tack", "button", "buttonhole", "fasten_button",
  "edit_sewing_3d", "segment_sewing_3d", "mn_segment_sewing_3d", "free_sewing_3d", "mn_free_sewing_3d",
  "edit_topstitch_3d", "segment_topstitch_3d", "free_topstitch_3d", "notch_3d", "pen_garment", "edit_pen_garment", "base_pen", "edit_style_line", "select_button", "graphic_3d", "transform_graphic_3d", "edit_texture_3d",
  "quick_pinching", "pin_lasso", "tape_surface", "circ_surface", "height_measure", "edit_measure_avatar", "linear_garment", "circ_garment", "volume_measure", "edit_volume_measure" /* (Round r20 continued (4)) */, "fill_3d", "piping", "edit_piping", "binding", "select_binding", "gluing", "zipper",
  "edit_zipper", "sticker", "edit_gluing", "glue_fill", "glue_brush" /* (Round BETA8-1 / D, 3.C5: built) */, "steam" /* (Round BETA8-1 / E, 3.A18: built) */];      // (Round build-1 / 4: Edit Zipper, Sticker, Edit Gluing, on the 3D toolbar and working in both windows, as Zipper; Glue Fill the same way since Round r20 continued (4))      // (Zipper: Round r12 / 1, on the 3D toolbar and a tool of both windows; Fill (3D): Round r11 / 2, Piping and Edit Piping: 3, Binding and Select Binding: 4, Gluing: 5; the tacks: Round r9 / 5; buttons: 9; the sewing tools: Round r10 / 2; the other shared tools: 3)
const glyph = (t) => t.icon.split("+")[0], badge = (t) => t.icon.split("+")[1];

test("the registry is well formed: unique ids, a group and window for every tool, a status, a tip, an icon that exists", () => {
  const ids = REG.tools.map(t => t.id);
  assert.strictEqual(new Set(ids).size, ids.length, "ids are unique");
  const groups = new Map(REG.groups.map(g => [g.id, g]));
  assert.strictEqual(groups.size, REG.groups.length, "group ids are unique");
  for (const t of REG.tools) {
    assert.ok(/^[a-z0-9_]+$/.test(t.id), t.id);
    assert.ok(groups.has(t.group), t.id + ": group " + t.group);
    assert.strictEqual(t.win, groups.get(t.group).win);
    assert.ok(["2D", "3D"].includes(t.win), t.id + ": window");
    assert.ok(["built", "partly", "unbuilt", "later"].includes(t.status), t.id + ": status");      // (later: Round r10 / 0)
    assert.ok(t.name && t.tip && t.tip.length <= 130, t.id + ": name and a short tip");
    assert.ok(REG.glyphs[glyph(t)], t.id + ": glyph " + glyph(t));
    if (badge(t)) assert.ok(badge(t) in REG.badges, t.id + ": badge " + badge(t));
    if (t.via) assert.strictEqual(t.status, "partly", t.id + ": only a tool that exists as a command has `via`");
  }
  for (const g of REG.groups) assert.ok(REG.tools.some(t => t.group === g.id), "group " + g.id + " has tools");
  assert.ok(REG.tools.filter(t => t.win === "2D").length >= 50 && REG.tools.filter(t => t.win === "3D").length >= 50, "both windows are covered");
  // what works in the 3D window so far (Roadmap 3D); everything else there is a placeholder
  assert.deepStrictEqual(REG.tools.filter(t => t.win === "3D" && t.status !== "unbuilt" && t.status !== "later").map(t => t.id).sort(), BUILT_3D.slice().sort());
  // every glyph is plain path data: no markup, nothing fetched
  for (const k in REG.glyphs) assert.ok(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]+$/.test(REG.glyphs[k]), "glyph " + k);
  for (const k in REG.badges) assert.ok(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]*$/.test(REG.badges[k]), "badge " + k);
});

test("the tools that worked before keep their ids and keys; the sewing tools are built; no key was reassigned", () => {
  const by = Object.fromEntries(REG.tools.map(t => [t.id, t]));
  const before = { transform_pattern: "A", edit_pattern: "Z", edit_curve_point: "V", edit_curvature: "C", smooth_curve: "", add_point: "X",
    polygon: "H", rectangle: "S", ellipse: "E", internal_polygon: "G", internal_rectangle: "", internal_ellipse: "R",
    base_polygon: "", trace: "I", notch: "", seam_allowance: "", edit_annotations: "", annotations: "", edit_sewing: "B",
    segment_sewing: "N", mn_segment_sewing: "", free_sewing: "M", mn_free_sewing: "", edit_texture: "T", walk: "", measure: "" };
  // Round F / 7: the Dart tool (add_dart) and the base dart are gone, as the maintainer decided: a dart is made with Edit Pattern's
  // right-click on a point (Add Dart). Their ids are kept by no other tool
  assert.ok(!by.add_dart && !by.base_dart, "no Dart tool");
  for (const id in before) {
    assert.ok(by[id], id + " is in the registry");
    assert.notStrictEqual(by[id].status, "unbuilt", id + " works");
    assert.strictEqual(by[id].via, "", id + " is a tool of its own");
    assert.strictEqual(by[id].key, before[id], id + " keeps its key");
  }
  // two tools never share a key, in either window (Round r13 / 1: the check took only the 2D tools, so Zipper, a 3D tool
  // that works in both windows, was never compared with the rest). Edit Pattern is Z (B1 p.5, "Edit Pattern Z"); Zipper's P
  // is the maintainer's decision (the sources give it no key)
  const keys = REG.tools.filter(t => t.key).map(t => t.key);
  assert.strictEqual(new Set(keys).size, keys.length, "a key on two tools: " + keys.filter((k, i) => keys.indexOf(k) !== i).join(" "));
  assert.strictEqual(by.edit_pattern.key, "Z"); assert.strictEqual(by.zipper.key, "P");
});

test("the page: no embedded bitmaps, the registry loads before the app and three.js after it, and every script is safe to serve", () => {
  const html = pageHTML(), scripts = pageScripts(html);
  assert.ok(!/data:image\/png/.test(html), "no embedded bitmaps");
  // (Round desk-1: config.js, the version and the feedback link, and examples/examples.js, File ▸ Open Example, before the app)
  // (Round r24: the start-up splash's few lines, inline before them, are no file)
  assert.ok(scripts[0].src === null && /gussetSplashEnd/.test(scripts[0].code), "the splash's script first");
  assert.deepStrictEqual(scripts.filter(s => s.src).map(s => s.src), ["drafter-tools.js", "drafter-sim.js", "zprj-import.js", "config.js", "blocks/blocks.js", "examples/examples.js", "pattern-drafter.js", "vendor/three.min.js", "vendor/three-loaders.js"]);
  assert.ok(appSource().includes("TOOL_REGISTRY"), "the harness still finds the app script");
  assert.ok(!/<\/(body|html|head|script)/i.test(fs.readFileSync(path.join(__dirname, "..", "drafter-tools.js"), "utf8")));
  for (const id of ["rail", "rail3d", "stage3d", "pane2d", "pane3d", "s-lay-3d", "s-lay-both", "s-lay-2d", "s-unbuilt"]) assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "vendor", "three.LICENSE.txt")), "three.js comes with its licence");
});

test("in the booted app: toolbars from the registry, keys, icons, and placeholders that only show a note", () => {
  const r = boot({ script: `
    const out = {};
    out.count = Object.keys(app.TOOLS).length;
    out.groups = [app.GROUPS.filter(g => g.win === "2D").length, app.GROUPS.filter(g => g.win === "3D").length];
    out.keys = Object.keys(app.KEYMAP).sort().join("");
    out.keyOf = ["A", "B", "M", "J", "Q", "W", ";"].map(k => app.KEYMAP[k]);
    out.conflicts = app.KEY_CONFLICTS.map(c => c.key + " " + c.tool);
    out.selectable = Object.values(app.TOOLS).filter(t => !t.off && !t.toggle).map(t => t.id);
    out.noHint = out.selectable.filter(id => !app.HINT[id]);
    const icon = app.iconSVG("sew+edit", "#fff");
    out.icon = [icon.startsWith("<svg"), icon.includes("mask"), /<image|href|url\\(http/.test(icon)];
    // an unbuilt tool: its key, a click on it and setTool all leave the tool as it is
    const gi = (id) => app.GROUPS.findIndex(g => g.some(t => t.id === id));
    app.setTool("edit_pattern");
    app.pick(gi("auto_fitting"), app.TOOLS.auto_fitting);      /* (Round r33b / 2: Seamless Blocking is built; Round FIX-3b / B: Set Sublayer too, Auto Fitting is the example now) */ out.afterUnbuilt = [S.tool, toasts[toasts.length-1]];
    app.setTool("select_move"); out.after3d = S.tool;
    app.pick(gi("simulate"), app.TOOLS.simulate); out.simNote = toasts[toasts.length-1];
    // a tool that is a right-click command here says where it is
    app.pick(gi("fullness_line"), app.TOOLS.fullness_line); out.via = [S.tool, toasts[toasts.length-1]];
    // a switch flips its setting and is not a mode
    app.pick(gi("check_sewing"), app.TOOLS.check_sewing); out.toggle = [S.tool, S.sewCheck.on];
    app.setTool("check_sewing"); out.toggleNotATool = S.tool;
    // a built one still works
    app.pick(gi("free_sewing"), app.TOOLS.free_sewing); out.built = S.tool;
    // every tool can be clicked without an error
    for (const g of app.GROUPS) for (const t of g) app.pick(app.GROUPS.indexOf(g), t);
    out.survived = !!S.tool;
    // show unbuilt tools off and on; window layouts (no three.js in this fake page: the 3D window says so)
    app.setUnbuilt(false); out.unbuilt = [S.ui.unbuilt, toasts[toasts.length-1]];
    app.setUnbuilt(true);
    app.setLayout("both"); app.setLayout("3d"); out.layout = S.ui.layout; out.note = app.el("note3d").textContent;
    app.setLayout("nonsense"); out.badLayout = S.ui.layout;
    app.setLayout("both");
    return out;
  ` });
  assert.deepStrictEqual(r.errors, [], "no errors");
  const o = r.result;
  assert.strictEqual(o.count, REG.tools.length);
  assert.deepStrictEqual(o.groups, [REG.groups.filter(g => g.win === "2D").length, REG.groups.filter(g => g.win === "3D").length]);
  assert.strictEqual(o.keys, ";ABCEGHIJKLMNPQRSTVWXZ");      // P: Zipper (Round r12 / 1)
  assert.deepStrictEqual(o.keyOf, ["transform_pattern", "edit_sewing", "free_sewing", "edit_topstitch", "select_move", "pin_box", "seamline_topstitch"]);
  assert.deepStrictEqual(o.conflicts, [], "(Round r10 / 4: Quick Pinching is built, its Ctrl+Q a row of the key table)");
  assert.deepStrictEqual(o.noHint, [], "every tool that can be picked has its how-to line");
  assert.strictEqual(o.selectable.length, 1 /* (Round FIX-3b / B: Set Sublayer, the 2D menu) */ + 1 /* (Round FIX-3 / H: Base Dart, 2D ▸ Create) */ + 56 + 3 /* (Round FIX-2 / C1: the 2D toolbar's Glue Fill, Sticker and Edit Gluing) */ /* (Pleats Fold and Pleats Sewing since Round r20, removed in Round r25; the four Puckering tools and Pattern Symbol since r20 / 7; the four grading tools since Round r33 / 4; Seamless Blocking since Round r33b / 2) */ + BUILT_3D.length - 1 /* (the one switch, Simulate, is not counted; Show Arrangement Points, the other, left the toolbar in Round r33 / 5) */, "the 2D tools (one fewer since the Dart tool went, Round F / 7, and one more for the double-pointed Dart, r12; Internal Spiral, Pleats, Button, Buttonhole and Fasten Button since Round r9; Spiral since r10; Fill since r11; Zipper counted with the 3D tools since r12; Base Rectangle, Base Ellipse and Edit Point of Measure since r13; Seamline Topstitch since r14), and the 3D tools and commands that work (the two switches are not counted)");
  assert.deepStrictEqual(o.icon, [true, true, false]);
  assert.strictEqual(o.afterUnbuilt[0], "edit_pattern"); assert.ok(/Auto Fitting is not built yet/.test(o.afterUnbuilt[1]))      /* (Round FIX-3b / B: Set Sublayer built) */;      // (Spiral was the example until Round r10 / 5 built it, Seamless Blocking until Round r33b / 2)
  assert.strictEqual(o.after3d, "edit_pattern"); assert.ok(/3D window is not up/.test(o.simNote), "Simulate is a switch now; with no 3D window it says so: " + o.simNote);
  assert.strictEqual(o.via[0], "edit_pattern"); assert.ok(/right-click command/.test(o.via[1]) && /Fullness [(]Line[)]/.test(o.via[1]));      // (Pleats was the example until it became a tool, Round r9 / 8)
  assert.deepStrictEqual(o.toggle, ["edit_pattern", true]); assert.strictEqual(o.toggleNotATool, "edit_pattern");
  assert.strictEqual(o.built, "free_sewing"); assert.strictEqual(o.survived, true);
  assert.strictEqual(o.unbuilt[0], false); assert.ok(/only the tools that work/.test(o.unbuilt[1]));
  assert.strictEqual(o.layout, "3d"); assert.ok(/three\.min\.js/.test(o.note)); assert.strictEqual(o.badLayout, "both", "an unknown layout falls back to both windows (Round r23 / 1: every start shows both)");
  // (Round r23 / 1: every start looks the same) only the preferences among the window settings are written: the show-unbuilt
  // switch, where the toolbars are docked (the 3D toolbar at the left by default since r23 / 2), the joint panel's size and limits,
  // the IK symmetry, the favourite blend shapes, the Avatar Size tab's choices and the maps' units and scales (only when set)
  assert.deepStrictEqual(JSON.parse(r.storage["pdraft:ui"]), { unbuilt: true, jointSize: 8, jointLimits: true, ikSym: true, blendFav: [], avW: "chest", avH: "total", avUnit: "mm", avLinkW: true, avLinkH: true, dock2: "right", dock3: "left" }, "saved per browser: the preferences only");
  assert.ok(!("ui" in JSON.parse(r.storage["pdraft:doc"])), "and not in the document");
});

// (Round r23 / 1: every start looks the same) a saved layout no longer comes back: every start shows both windows; the
// show-unbuilt choice is a preference and does
test("a saved show-unbuilt choice comes back, a saved layout does not (every start shows both windows); junk falls back to the defaults", () => {
  // (Round FIX-4b / A) a fresh profile as the program has it (freshUnbuilt): Show Tools That Are Not Built Yet starts off since the beta.8
  // gate (G1), so the preference that comes back is "on"
  const ui = (saved) => boot({ uiSaved: saved, freshUnbuilt: true, script: "return S.ui;" });
  const fresh = ui(undefined).result;
  assert.strictEqual(fresh.unbuilt, false, "off in a fresh profile");
  let r = ui(JSON.stringify({ layout: "3d", unbuilt: true, split: 0.3, panelW: 400, strain3: true, timeline: true, render: "mono" }));
  assert.deepStrictEqual(r.errors, []); assert.deepStrictEqual(r.result, { ...fresh, unbuilt: true }, "only the preference comes back");
  assert.strictEqual(fresh.layout, "both"); assert.strictEqual(fresh.dock3, "left"); assert.strictEqual(fresh.dock2, "right");
  r = ui("{not json");
  assert.deepStrictEqual(r.errors, []); assert.deepStrictEqual(r.result, fresh);
  r = ui(JSON.stringify({ layout: 7, unbuilt: "yes", extra: 1 }));
  assert.deepStrictEqual(r.result, fresh);
  // a tiny or hidden 2D window (3D only) must not hang the grid
  r = boot({ w: 0, h: 0, script: "app.setLayout('3d'); return S.ui.layout;" });
  assert.deepStrictEqual(r.errors, []); assert.strictEqual(r.result, "3d");
});

module.exports = T;
