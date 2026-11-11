// Round UI-1: plain undo again (batch A), the orange accent (B), the gizmo's World default (C), small fixes (D), the view shirt (E).
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(require("os").tmpdir(), "pdraft-ui1-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
const DOC = `
  const rect = (k) => { app.push("Rectangle " + k); S.pieces.push(app.mkPiece("R" + k, app.mkShape([{ x: 500*k, y: 0 }, { x: 500*k + 300, y: 0 }, { x: 500*k + 300, y: 200 }, { x: 500*k, y: 200 }], true))); app.commit(); };
  const P = (k) => S.pieces.find(p => p.name === "R" + k);
  const move = (k, n) => { app.push(n || "Move R" + k); P(k).pts.forEach(q => { q.y += 10; }); app.commit(); };
  const move3 = (k) => { const st = app.ev("histState")(); P(k).pts.forEach(q => { q.x += 5; }); app.ev("pushState")(st, "Move (3D)"); app.commit(); };
  const asked = [];
  app.modalAnswer = (t) => { asked.push(t); return "keep"; };
  const off = () => [...S.hoff.keys()].length;
  const back = (n) => { const t = app.ev("histNodes")(); app.ev("treeGo")(t.path[t.at - n]); };
`;

test("ui1 / A1: Ctrl+Z (the key, and undo() as the menu and the panel's ◀ call it) then a change is plain undo: the undone steps are gone, no box, no branch; in the 2D window and with a 3D step alike", () => {
  const r = boot({ blank: true, script: DOC + `
    const out = {};
    rect(1); rect(2); rect(3); rect(4);
    app.key("z", { ctrlKey: true }); app.key("z", { ctrlKey: true }); rect(5); app.runTimers();
    out.key = [asked.length, off(), S.redo.length, S.pieces.map(p => p.name).join(" ")];
    app.undo(); move3(1); app.runTimers();                      // a 3D drag's step (pushState)
    out.three = [asked.length, off(), S.redo.length];
    app.key("z", { ctrlKey: true }); app.key("y", { ctrlKey: true }); app.key("z", { ctrlKey: true }); move(2); app.runTimers();
    out.redo = [asked.length, off(), S.redo.length];
    // the panel open: its ◀ is undo(), the same plain undo
    app.setTimeline(true); app.undo(); move(1); app.runTimers();
    out.after = [asked.length, off()];
    return out;` });
  assert.deepStrictEqual(r.key, [0, 0, 0, "R1 R2 R5"], "Rectangles 3 and 4 gone, no question, no branch");
  assert.deepStrictEqual(r.three, [0, 0, 0]);
  assert.deepStrictEqual(r.redo, [0, 0, 0]);
  assert.deepStrictEqual(r.after, [0, 0]);
});

test("ui1 / A2: with History Groups, Ctrl+Z is still plain undo of the document's last step: no box, nothing kept", () => {
  const r = boot({ blank: true, script: DOC + `
    rect(1); rect(2); rect(3);
    S.sel = [P(1).id, P(2).id]; app.promptAnswer = "Shirt"; app.ev("hgCreate")(S.sel.slice()); app.promptAnswer = undefined;
    move(1, "Shirt 1"); move(3, "Free 1"); move(2, "Shirt 2");
    app.key("z", { ctrlKey: true }); app.key("z", { ctrlKey: true }); move(1, "Shirt 3"); app.runTimers();
    const ys = [1, 2, 3].map(k => P(k).pts[0].y);
    return { asked, off: off(), redo: S.redo.length, ys, last: S.un[S.un.length - 1].n };` });
  assert.deepStrictEqual(r.asked, []);
  assert.strictEqual(r.off, 0); assert.strictEqual(r.redo, 0);
  assert.deepStrictEqual(r.ys, [20, 0, 0], "Free 1 and Shirt 2 undone and gone; Shirt 3 on top of Shirt 1");
  assert.strictEqual(r.last, "Shirt 3");
});

test("ui1 / A3: going back from the History panel (a card's double-click: treeGo) and making a change keeps the old future and asks Keep / Delete; undo and redo after the jump still ask; a step taken back puts the question back; a group's step taken back asks for its lane", () => {
  const r = boot({ blank: true, script: DOC + `
    const out = {};
    rect(1); rect(2); rect(3); rect(4);
    back(2); rect(5); app.runTimers();
    out.jump = [asked.slice(), off()];
    // jump, then Ctrl+Z, then a change: the steps ahead hold the ones jumped over, so it still asks
    asked.length = 0; back(1); app.key("z", { ctrlKey: true }); move(1); app.runTimers();
    out.jumpUndo = [asked.slice()];
    // after that branch is made, plain undo is plain again
    asked.length = 0; app.undo(); move(1); app.runTimers();
    out.plainAgain = [asked.slice()];
    // a step taken back (a command that did nothing) after a jump: the next change still asks
    asked.length = 0; back(1); app.push("Nothing"); app.ev("unpush")(); move(1); app.runTimers();
    out.unpushed = asked.slice();
    // a 3D step after a jump asks too
    asked.length = 0; back(1); move3(1); app.runTimers();
    out.three = asked.slice();
    // a group: double-click in its lane (hgGo), then a change in the lane: the lane's box
    rect(6); S.sel = [P(6).id]; app.promptAnswer = "Pants"; app.ev("hgCreate")(S.sel.slice()); app.promptAnswer = undefined;
    move(6, "Pants 1"); move(6, "Pants 2");
    const t = app.ev("histNodes")(), id = [...t.nodes.values()].find(x => x.n === "Pants 1").id, g = S.hgroups[0].id;
    asked.length = 0; app.ev("hgGo")(g, id); move(6, "Pants 3"); app.runTimers();
    out.lane = asked.slice();
    return out;` });
  assert.deepStrictEqual(r.jump, [["Keep the Old Future?"], 2]);
  assert.deepStrictEqual(r.jumpUndo, [["Keep the Old Future?"]]);
  assert.deepStrictEqual(r.plainAgain, [[]]);
  assert.deepStrictEqual(r.unpushed, ["Keep the Old Future?"]);
  assert.deepStrictEqual(r.three, ["Keep the Old Future?"]);
  assert.deepStrictEqual(r.lane, ["Keep the Old Future of Pants?"]);
});

test("ui1 / A4: the new-project box stays as it was (File ▸ New asks Keep a History?)", () => {
  const r = boot({ blank: true, script: DOC + `
    app.modalAnswer = (t) => { asked.push(t); return "on"; };
    app.ev("newDoc")(true);
    return asked;` });
  assert.deepStrictEqual(r, ["Keep a History?"]);
});

test("ui1 / B1: the UI has one accent, the logo orange, defined once in :root; no yellow or blue is left in the page chrome; the History panel draws with it; the canvases keep their own colours", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8"), css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
  for (const t of ["--accent:      #E8412F", "--accent-line: #F2745F", "--accent-text: #FF9A88", "--sel:     var(--accent-line)"]) assert.ok(root.includes(t), t);
  // the old accents (the selection yellow, the timeline yellow, the blues, the editor's orange-yellow) are gone from the styles
  for (const c of ["#ecfd3f", "#ffd400", "#2f80ed", "#6aa8ff", "#81b2dc", "saband", "#e69f00", "#3a3f4c", "#c9a227", "#f0e442", "#0072b2", "#4a4a1e"]) assert.ok(!css.toLowerCase().includes(c), c + " is still in the page styles");
  // every accent colour is written once, in :root
  for (const c of ["#E8412F", "#F2745F", "#FF9A88"]) assert.strictEqual(css.split(c).length - 1, 1, c + " outside :root");
  const js = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8");
  const hp = js.slice(js.indexOf("function hpDraw()"), js.indexOf("function hpDraw()") + 9000);
  assert.ok(!/#ffd400/.test(hp) && hp.includes('uiAccent("line")'), "the History panel's here frame and selection in the accent");
  assert.ok(/C_SEL = "#ecfd3f"/.test(js) && /C_HOVER = "#2eaaf1"/.test(js), "the 2D canvas keeps its selection yellow and hover blue");
});

test("ui1 / D1 (Round UI-1b / A): the floor shows only the plain grid: no AxesHelper, no axis lines, letters or side words", () => {
  const r = boot({ blank: true, three: true, script: `
    const v3 = app.view3d; app.ev("setLayout")("both");
    const sc = v3.scene(); for (const f of [].concat(app.ev("typeof floorMarks === 'function' ? floorMarks : null") || [])) f();
    const kinds = []; sc.traverse(o => { if (o.type === "AxesHelper" || /^(grid:marks|axis:|side:)/.test(o.name || "") || (o.userData && o.userData.word)) kinds.push(o.type + ":" + o.name); });
    return { kinds, grids: ["grid:fine", "grid:metre"].filter(n => sc.getObjectByName(n)) };` });
  assert.deepStrictEqual(r.kinds, []);
  assert.deepStrictEqual(r.grids, ["grid:fine", "grid:metre"]);
});

test("ui1 / D2: the position readout: each label right before its slot, slots of 8 characters; the History button: bigger, its own icon, framed in the accent while the panel is open", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8");
  // (Round FIX-2 / C11, the maintainer's feedback: the number straight after its label, no wide gap) left-aligned, the slot sized by
  // posShow() from the decimals (fix2.test.js checks the sizes)
  assert.ok(/#s-pos \.pv \{[^}]*text-align: left;[^}]*tabular-nums/.test(html), "left-aligned slots, digits of one width");
  assert.ok(/#s-pos \.pl \{[^}]*margin: 0 0[.]5ch 0 1[.]5ch;/.test(html), "the label half a character before its number");
  assert.ok(/<button id="s-hist"[^>]*><svg class="hist-ic" viewBox="0 0 24 24"[^>]*><g transform="[^"]*">(<path [^>]*\/>){3}<path [^>]*\/><circle [^>]*fill="currentColor"[^>]*\/><\/g><\/svg><span>History<\/span><\/button>/.test(html), "(Round UI-1c / D) the seam ripper's tip: the stub, the curved blade, the pointed prong, the short prong and its ball; then the word");
  assert.ok(!/<rect /.test(/<svg class="hist-ic"[\s\S]*?<\/svg>/.exec(html)[0]), "no handle");
  assert.ok(/#s-hist \.hist-ic \{ width: 20px; height: 20px;/.test(html), "20 px");
  assert.ok(/#status #s-hist \{[^}]*height: 36px/.test(html) && /#status #s-hist\.on \{[^}]*border: 2px solid var\(--accent-line\)/.test(html), "as tall as the layout buttons; open: a thick orange frame");
  // (the test page keeps no classes: the button framed while the panel is open is the real page, scripts/smoke-browser.js clicks it)
});

// (Round UI-1b / B) the view cube replaces UI-1's view shirt (its tests E1, E2 with it)
test("ui1b / B1: the view cube: 26 regions (6 faces, 12 edges, 8 corners), each picked where it lies and named; a region's view (faces as the named views, the front-left edge as 3/4 Left, the upper back corners as 3/4 Back Left / Right); the view buttons gone, the keys kept", () => {
  const r = boot({ blank: true, three: true, script: `
    const v3 = app.view3d, L = app.ev("vcubeLayout"), pick = app.ev("vcubePick"), RC = app.ev("vcubeRegionCam"), name = app.ev("vcubeName");
    const out = {};
    // every region the cube can show, from many sides
    const seen = new Set(); for (let az = -3; az <= 3; az += 0.5) for (let el = -1.4; el <= 1.4; el += 0.35) for (const f of L(az, el).faces) for (const c of f.cells) seen.add(c.sg.join(","));
    out.n = seen.size; out.kinds = [1, 2, 3].map(k => [...seen].filter(x => x.split(",").filter(v => v !== "0").length === k).length);
    // picked where they lie on the canvas
    const at = (p, az, el) => { const { R, U } = app.ev("vcubeBasis")(az, el), K = app.ev("VCUBE_K"); return [app.ev("vcubeCx")() + (p[0]*R[0] + p[1]*R[1] + p[2]*R[2])*K, app.ev("vcubeCy")() - (p[0]*U[0] + p[1]*U[1] + p[2]*U[2])*K]; };
    const pk = (p, az, el) => { const q = at(p, az, el), h = pick(q[0], q[1], az, el); return h && h.kind === "region" ? [h.sg.join(","), h.name] : h && h.kind; };
    out.face = pk([0, 0, 1], 0, 0.03); out.edge = pk([0.85, 0, 1], 0.7, 0.3); out.corner = pk([0.85, 0.85, 1], 0.7, 0.45); out.back = pk([-0.85, -0.85, -1], -2.4, -0.45);
    out.off = pick(3, 3, 0, 0.03);
    // a region's view
    const c = (sg) => { const x = RC(sg); return [+x.az.toFixed(4), +x.el.toFixed(4)]; };
    const named = (n) => { v3.view(n); return [+v3.cam.az.toFixed(4), +v3.cam.el.toFixed(4)]; };
    out.views = { front: [c([0, 0, 1]), named("front")], back: [c([0, 0, -1]), named("back")], left: [c([1, 0, 0]), named("left")], right: [c([-1, 0, 0]), named("right")],
      top: [c([0, 1, 0]), named("top")], bottom: [c([0, -1, 0]), named("bottom")], left34: [c([1, 0, 1]), named("left34")], right34: [c([-1, 0, 1]), named("right34")],
      backleft34: [c([1, 1, -1]), named("backleft34")], backright34: [c([-1, 1, -1]), named("backright34")] };
    out.names = [name([0, 1, 1]), name([-1, -1, -1]), name([1, 0, 0])];
    // the keys as before (with the pointer over the 3D window): 8 Back, 2 Front
    app.ev("setLayout")("both"); S.over3d = true; app.key("8"); out.key8 = +v3.cam.az.toFixed(4); app.key("2"); out.key2 = +v3.cam.az.toFixed(4);
    return out;` });
  assert.strictEqual(r.n, 26); assert.deepStrictEqual(r.kinds, [6, 12, 8]);
  assert.deepStrictEqual(r.face, ["0,0,1", "FRONT"]); assert.deepStrictEqual(r.edge, ["1,0,1", "FRONT LEFT"]);
  assert.deepStrictEqual(r.corner, ["1,1,1", "TOP FRONT LEFT"]); assert.deepStrictEqual(r.back, ["-1,-1,-1", "BOTTOM BACK RIGHT"]);
  assert.strictEqual(r.off, null);
  for (const [n, [got, want]] of Object.entries(r.views)) assert.deepStrictEqual(got, want, n);
  assert.deepStrictEqual(r.names, ["TOP FRONT", "BOTTOM BACK RIGHT", "LEFT"]);
  assert.strictEqual(r.key8, +Math.PI.toFixed(4)); assert.strictEqual(r.key2, 0);
  const js = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8");
  assert.ok(!/vshirt|VSHIRT/.test(js), "the shirt is gone");
  assert.ok(!/b\.onclick = \(\) => cam3d\(k\)/.test(js) && /vcubeMount\(\);/.test(js), "the cube where the buttons were");
});

test("ui1b / B2: looking straight at a face: four arrows step to the next face (Round UI-1c / A: no roll arrows, the camera has no roll); off a face no arrows; the house is the start view exactly", () => {
  const r = boot({ blank: true, three: true, script: `
    const v3 = app.view3d, A = app.ev("vcubeArrows"), go = app.ev("vcubeAct"), out = {};
    app.ev("setLayout")("both");
    out.front = A(0, 0.03).map(a => [a.id, a.name]); out.off = A(0.7, 0.4).length;
    const cam = () => [+v3.cam.az.toFixed(4), +v3.cam.el.toFixed(4)];
    const arrow = (id) => go({ kind: "arrow", ...A(v3.cam.az, v3.cam.el).find(a => a.id === id) });
    v3.view("front"); arrow("right"); out.right = cam();
    v3.view("front"); arrow("up"); out.up = cam();
    v3.view("front"); arrow("down"); out.down = cam();
    out.noRoll = !("roll" in v3.cam);
    v3.view("left"); app.ev("vcubeHome")(); out.home = [cam(), v3.cam.dist, v3.cam.ty];
    return out;` });
  assert.deepStrictEqual(r.front, [["right", "TO LEFT"], ["left", "TO RIGHT"], ["up", "TO TOP"], ["down", "TO BOTTOM"]], "from the front, the screen's right is the avatar's left (+x)");
  assert.strictEqual(r.off, 0);
  assert.deepStrictEqual(r.right, [+(Math.PI/2).toFixed(4), 0.03]);
  assert.strictEqual(r.up[0], 0); assert.ok(r.up[1] > 1.5, "the top, FRONT at the bottom");
  assert.strictEqual(r.down[0], 0); assert.ok(r.down[1] < -1.5, "the bottom");
  assert.strictEqual(r.noRoll, true, "the camera has no roll");
  assert.deepStrictEqual(r.home, [[-0.6, 0.5], 5600, 700], "the start view (no avatar): HOME exactly");
  const js = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8");
  assert.ok(!/rotateZ\(o\.roll\)|ROLL 90/.test(js), "no roll code");
});

test("ui1b / B3: the cube's hover is named, not only coloured; its faces carry their names; the triad is lettered; a drag turns the view through the window's drive; no glide with reduced motion", () => {
  const js = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8"), d = js.slice(js.indexOf("function vcubeTriad"), js.indexOf("function vcubeFrame"));      // (Round UI-1c / B: the triad drawn by vcubeTriad(), before vcubeDraw())
  assert.ok(/const t = hot\.name;/.test(d) && /fillText\(t, /.test(d), "the hovered region's name");
  assert.ok(/fillText\(f\.name, /.test(d), "each face's name on it");
  assert.ok(/strokeText\(t\.n, /.test(d) && /fillText\(t\.n, /.test(d), "the triad's letters (Round UI-1e / A: laid out first, then drawn)");
  const m = js.slice(js.indexOf("function vcubeMount"), js.indexOf("function vcubeMount") + 3000);
  assert.ok(/view3d\.mouse\.drive\("turn", dx, dy\)/.test(m));
  assert.ok(/prefers-reduced-motion: reduce/.test(js.slice(js.indexOf("function vcubeGlide"), js.indexOf("function vcubeGlide") + 600)));
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8");
  for (const id of ["posepanel", "jointpanel", "schpanel"]) assert.ok(new RegExp("#" + id + " \\{[^}]*top: 156px").test(html), id + " starts under the cube");
});

const HOME = (() => { const h = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8"), m = /#cam3d #vhome { position: absolute; left: ([0-9]+)px; top: ([0-9]+)px;/.exec(h); return [+m[1], +m[2]]; })();
test("ui1c / B (Round UI-1d / 0): the triad sits on the corner from which all three positive axes run along the cube's edges (-x, -y, -z) and turns with it: each line its edge's length, just outside it (none sticks out), along its true direction, drawn only while a face beside its edge is seen; no letter ever lands on Home", () => {
  const r = boot({ blank: true, three: true, script: `
    const L = app.ev("vcubeLayout"), T = app.ev("vcubeTriad"), O = app.ev("VCUBE_ORIGIN"), AX = app.ev("VCUBE_AXES"), out = { origin: O, views: [], onHome: [] }, HX = ${HOME[0]}, HY = ${HOME[1]};
    for (let az = -3.1; az <= 3.15; az += 0.25) for (let el = -1.5; el <= 1.55; el += 0.25) {
      const lay = L(az, el), lines = [], texts = []; let cur = null;
      let dash = false; const dashes = [];
      const g = { save() {}, restore() { dash = false; }, arc() {}, setLineDash(d) { dash = d.length > 0; }, beginPath() {}, stroke() {}, strokeText() {}, fillText(t, x, y) { texts.push([t, x, y]); }, moveTo(x, y) { cur = [x, y]; }, lineTo(x, y) { lines.push([cur, [x, y]]); dashes.push(dash); } };
      T(g, lay);
      const want = AX.map(([n, v]) => { const ax = v.indexOf(1), off = O.map((c, i) => (i === ax ? c : c*1.06)); return [lay.pr(off), lay.pr(off.map((c, i) => c + v[i]*2))]; });
      const hid = AX.map(([n, v]) => { const ax = v.indexOf(1); return ![0, 1, 2].filter(i => i !== ax).some(i => O[i]*lay.B[i] > 1e-3); });
      out.dash = (out.dash || 0) + (dashes.every((d, i) => d === hid[i]) ? 0 : 1); out.letters = Math.min(out.letters == null ? 3 : out.letters, texts.length);
      const dev = lines.length === want.length ? Math.max(0, ...lines.map((l, k) => Math.max(Math.hypot(l[0][0] - want[k][0][0], l[0][1] - want[k][0][1]), Math.hypot(l[1][0] - want[k][1][0], l[1][1] - want[k][1][1])))) : 99;
      out.views.push(dev);
      for (const [t, x, y] of texts) if (x > HX - 6 && x < HX + 26 + 6 && y > HY - 7 && y < HY + 26 + 7) out.onHome.push([t, +az.toFixed(2), +el.toFixed(2)]);
    }
    const start = L(-0.6, 0.5), sl = []; let c0 = null;
    T({ save() {}, restore() {}, arc() {}, setLineDash() {}, beginPath() {}, stroke() {}, strokeText() {}, fillText(t) { sl.push(t); }, moveTo() {}, lineTo() {} }, start);
    out.start = sl.filter((t, i) => i % 1 === 0);
    return out;` });
  assert.deepStrictEqual(r.origin, [-1, -1, -1]);
  assert.ok(r.views.every(d => d < 1e-6), "(Round UI-1e / A: every line, from every side) each runs its own edge, true direction: " + Math.max(...r.views));
  assert.deepStrictEqual(r.onHome, [], "no letter on Home");
  assert.deepStrictEqual(r.start, ["X", "Y", "Z"], "(Round UI-1e / A) from the start view all three, X dashed behind the cube");
  assert.strictEqual(r.dash, 0, "dashed exactly where the edge lies behind the cube"); assert.strictEqual(r.letters, 3, "the three letters from every side");
  const js = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8");
  assert.ok(!/p\[0\] - p\[1\] < cs\[0\] - cs\[1\]/.test(js), "never the corner that is bottom left on the screen");
});

test("ui1d / 0: the step arrows sit right by the cube's edges, small; they and the region's name show only while the pointer is over the cube or an arrow, fading in about 150 ms (at once with reduced motion)", () => {
  const r = boot({ blank: true, three: true, script: `
    const A = app.ev("vcubeArrows"), K = app.ev("VCUBE_K"), cx = app.ev("vcubeCx")(), V = app.ev("VCUBE");
    const out = { d: A(0, 0.03).map(a => Math.round(Math.hypot(a.x - cx, a.y - app.ev("vcubeCy")()) - K)), alpha0: V.alpha };
    app.ev("vcubeNear")(true); out.near = [V.near, V.alpha]; app.ev("vcubeNear")(false); out.away = [V.near, V.alpha];
    return out;` });
  assert.ok(r.d.every(d => d > 0 && d <= 10), "within 10 px of the cube's edge: " + r.d);
  assert.strictEqual(r.alpha0, 0, "hidden at start");
  assert.deepStrictEqual(r.near, [true, 1]); assert.deepStrictEqual(r.away, [false, 0]);
  const js = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8"), d = js.slice(js.indexOf("function vcubeDraw"), js.indexOf("function vcubeFrame"));
  assert.ok(/const VCUBE_FADE_MS = 150;/.test(js) && /prefers-reduced-motion: reduce/.test(js.slice(js.indexOf("function vcubeNear"), js.indexOf("function vcubeNear") + 500)));
  assert.ok(/g\.globalAlpha = VCUBE\.alpha;\s*for \(const a of VCUBE\.alpha > 0\.01 \? vcubeArrows/.test(d) && /if \(hot && VCUBE\.alpha > 0\.01\)/.test(d), "the arrows and the name fade together");
});

test("ui1c / C (Round FIX-2 / C4): Home is the house alone (no button background or frame), shown only while the pointer is near the cube, near the cube's top left corner, whole and orange under the pointer, its lines thicker; it says Home (start view)", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.html"), "utf8"), js = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8");
  const rule = (sel) => { const m = new RegExp(sel.replace(/[#:,]/g, (c) => "\\" + c) + " \\{([^}]*)\\}").exec(html); return m ? m[1] : ""; };
  const base = rule("#cam3d #vhome");
  // (Round FIX-2 / C4, the maintainer's feedback: only while the pointer is near the cube, bigger) hidden until --vnear (the arrows' fade), 26 px
  assert.ok(/background: none;/.test(base) && /border: none;/.test(base) && /opacity: calc[(]var[(]--vnear, 0[)] [*] [.]8[)];/.test(base) && /width: 26px;/.test(base), base);
  const left = +/left: ([0-9]+)px/.exec(base)[1], top = +/top: ([0-9]+)px/.exec(base)[1];
  assert.ok(left <= 30 && top <= 30, "at the top left, by the cube's top left corner (Round UI-1d / 0: in the canvas's corner, where no letter of the triad reaches): " + left + ", " + top);
  assert.ok(/opacity: 1; color: var\(--accent\);/.test(rule("#cam3d #vhome:hover, #cam3d #vhome:focus-visible")), "whole and orange under the pointer");
  assert.ok(/stroke-width: 2\.3;/.test(rule("#cam3d #vhome:hover svg")), "thicker, not only coloured");
  assert.ok(js.includes('<button id="vhome" title="Home (start view)"'), "its words");
});

// (Round UI-1e / B, replacing UI-1d / A's tests) Fold Arrangement with two handles: an upright internal line in the middle of a
// draped pattern; a second pattern sewn to the first along its right edge (a seam to fold on)
const FOLD = `
  const out = {}, T3 = app.TOOL3.fold_arrangement, G3 = app.G3, v3 = app.view3d, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const P = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:400}], true));
  app.addChild(P, "internals", app.mkShape([{x:150,y:0},{x:150,y:400}], false));
  const Q = app.mkPiece("B", app.mkShape([{x:400,y:0},{x:700,y:0},{x:700,y:400},{x:400,y:400}], true));
  S.pieces.push(P, Q); P.p3 = { pos: [0, 1100, 300], q: [0, 0, 0, 1], r: 0 }; Q.p3 = { pos: [450, 1100, 300], q: [0, 0, 0, 1], r: 0 };
  S.seams.push({ id: 1, a: [{ piece: P.id, shape: 0, sids: [P.segs[1].id], t0: 0, t1: 1, rev: false }], b: [{ piece: Q.id, shape: 0, sids: [Q.segs[3].id], t0: 0, t1: 1, rev: true }] });
  app.commit(); app.ev("garmentSync")(); app.ev("clothLines")();
  // a drape: every point of A moved off flat a little, as a simulation leaves it
  const itA = () => G3.items.get(P.id), itB = () => G3.items.get(Q.id);
  { const it = itA(); for (let i = 0; i < it.X.length; i += 3) it.X[i+2] += 20*Math.sin(it.X[i]/60) + 7*Math.cos(it.X[i+1]/45); it.draped = true; app.ev("itemMoved")(it); app.ev("clothLines")(); }
  S.undo.length = 0; S.un.length = 0;
  Object.assign(v3.cam, { az: 0.5, el: 0.3, dist: 3000, tx: 200, ty: 1100, tz: 300 });
  app.setTool3("fold_arrangement");
  const ev = (x, y, more) => ({ clientX: x, clientY: y, button: 0, buttons: 1, ...more });
  const steps = () => app.histSteps().steps.slice(0, S.undo.length).map(s => s.n);
  const tipS = (k) => v3.project(app.ev("foldTip")(G3.foldLive, k));
  const lineHit = () => { const k = { kind: "internals", id: P.internals[0].id }, l = itA().lines.find(x => x.id === k.id), m = app.ev("foldAt")(itA(), l.an[Math.floor(l.an.length/2)]); return v3.project(m); };
  const X = (it) => Array.from(it.X);
  // the points of A on each side of the line (x < 150 / x > 150 on the pattern)
  const sideOf = (i) => itA().mesh.xy[2*i] > 150 + 1e-6 ? 1 : itA().mesh.xy[2*i] < 150 - 1e-6 ? 2 : 0;      // (side 1: to the right of the line as drawn, top to bottom)
  const drag = (k, dx, dy, more) => { const s = tipS(k); T3.down(ev(s.x, s.y)); T3.move(ev(s.x + dx*0.4, s.y + dy*0.4, more)); T3.move(ev(s.x + dx, s.y + dy, more)); T3.up(ev(s.x + dx, s.y + dy)); };
`;
test("ui1e / B1: a click on the line: a ring with a handle on each side; handle 1 turns only side 1, rigidly, the drape kept (side 2 and the line bit for bit); handle 2 then side 2 in the same session; Shift 15 degree steps; each release one step; undo puts the cloth back exactly", () => {
  const r = boot({ blank: true, three: true, script: FOLD + `
    const X0 = X(itA()), m = lineHit();
    T3.down(ev(m.x, m.y)); T3.up(ev(m.x, m.y));
    out.ring = [!!G3.foldLive, G3.foldLive && G3.foldLive.sides.map(sd => sd[0].idx.length), steps().length];
    drag(0, 40, -40);
    const X1 = X(itA()), A = G3.foldLive.hinge.A, d = G3.foldLive.hinge.d;
    const dist = (Y, i) => { const v = new THREE.Vector3(Y[3*i] - A.x, Y[3*i+1] - A.y, Y[3*i+2] - A.z); return v.sub(d.clone().multiplyScalar(v.dot(d))).length(); };
    let moved1 = 0, kept2 = true, rigid = 0;
    for (let i = 0; i < X0.length/3; i++) {
      const sd = sideOf(i), ch = Math.hypot(X1[3*i] - X0[3*i], X1[3*i+1] - X0[3*i+1], X1[3*i+2] - X0[3*i+2]);
      if (sd === 1 && ch > 1) moved1++;
      if (sd !== 1 && (X1[3*i] !== X0[3*i] || X1[3*i+1] !== X0[3*i+1] || X1[3*i+2] !== X0[3*i+2])) kept2 = false;
      if (sd === 1) rigid = Math.max(rigid, Math.abs(dist(X1, i) - dist(X0, i)));
    }
    out.side1 = [moved1 > 0, kept2, rigid < 1e-3, G3.foldLive.ang[0] !== 0, G3.foldLive.ang[1], steps()];
    // side 2 in the same session, with Shift
    drag(1, -40, -40, { shiftKey: true });
    out.side2 = [Math.abs(G3.foldLive.ang[1] % 15), G3.foldLive.ang[1] !== 0, steps()];
    const X2 = X(itA());
    app.undo(); out.undo1 = X(itA()).every((v, i) => v === X1[i]);
    app.undo(); out.undo2 = X(itA()).every((v, i) => v === X0[i]);
    app.redo(); app.redo(); out.redo = X(itA()).every((v, i) => v === X2[i]);
    return out;` });
  assert.ok(r.ring[0] && r.ring[1][0] > 10 && r.ring[1][1] > 10 && r.ring[2] === 0, "the ring on the line, both sides found, no step: " + JSON.stringify(r.ring));
  assert.deepStrictEqual(r.side1, [true, true, true, true, 0, ["Fold Arrangement"]], "side 1 turned, side 2 and the line bit for bit, rigid about the hinge, one step");
  assert.deepStrictEqual(r.side2, [0, true, ["Fold Arrangement", "Fold Arrangement"]], "side 2 in the same session, in 15 degree steps");
  assert.deepStrictEqual([r.undo1, r.undo2, r.redo], [true, true, true], "undo and redo give the cloth back exactly");
});

test("ui1e / B2: the right-click box: both angles, the cloth follows every number typed per side, OK one step, Esc puts both back; a seam is a hinge too (its two patterns are the two sides); saved and opened again, the cloth is the same", () => {
  const r = boot({ blank: true, three: true, script: FOLD + `
    const m = lineHit(); T3.down(ev(m.x, m.y)); T3.up(ev(m.x, m.y));
    const X0 = X(itA()), sums = [], sum = () => X(itA()).reduce((a, v, i) => a + v*((i % 7) + 1), 0);
    app.answer = (t, f, o) => { out.fields = f.map(x => x.label); for (const v of [{ a0: 30, a1: 0 }, { a0: 30, a1: -45 }, { a0: 60, a1: -45 }]) { o.preview(v); sums.push(+sum().toFixed(3)); } return { a0: 60, a1: -45 }; };
    T3.menu(ev(m.x, m.y, { button: 2 }));
    out.typed = [new Set(sums).size, G3.foldLive.ang, steps()];
    const X1 = X(itA());
    app.answer = (t, f, o) => { o.preview({ a0: 120, a1: 90 }); out.mid = G3.foldLive.ang.slice(); return null; };
    T3.menu(ev(m.x, m.y, { button: 2 }));
    out.esc = [G3.foldLive.ang, X(itA()).every((v, i) => v === X1[i]), steps().length];
    app.answer = null;
    app.key("Escape"); out.gone = !G3.foldLive;
    // the seam between A and B: side 1 is A, side 2 is B; turning side 2 moves B only
    const XA = X(itA()), XB = X(itB());
    const sm = S.seams[0], sd = app.ev("foldSeamSides")(sm), pa = app.ev("foldAt")(itA(), sd[0][0].an[Math.floor(sd[0][0].an.length/2)]), ps = v3.project(pa);
    T3.down(ev(ps.x, ps.y)); T3.up(ev(ps.x, ps.y));
    out.seam = [G3.foldLive && G3.foldLive.what, G3.foldLive && G3.foldLive.sides.map(s => s.map(x => x.pid === P.id ? "A" : "B"))];
    drag(1, 30, 30);
    out.seamFold = [X(itA()).every((v, i) => v === XA[i]), X(itB()).some((v, i) => Math.abs(v - XB[i]) > 1)];
    // saved and opened again: the same cloth
    const before = [X(itA()), X(itB())];
    let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null);
    app.ev("openFile")("t.pdraft", got, null, true); app.ev("garmentSync")();
    const A2 = G3.items.get(S.pieces[0].id), B2 = G3.items.get(S.pieces[1].id);
    out.reopened = [Array.from(A2.X).every((v, i) => Math.abs(v - before[0][i]) < 1e-3), Array.from(B2.X).every((v, i) => Math.abs(v - before[1][i]) < 1e-3)];
    return out;` });
  assert.deepStrictEqual(r.fields, ["Side 1 (blue, \u25cf)", "Side 2 (orange, \u25a0)"]);
  assert.deepStrictEqual(r.typed, [3, [60, -45], ["Fold Arrangement"]], "every number typed moved the cloth; OK: both kept, one step");
  assert.deepStrictEqual(r.esc, [[60, -45], true, 1], "Esc: both back, the cloth as it was, no step");
  assert.strictEqual(r.gone, true);
  assert.deepStrictEqual(r.seam, ["seam", [["A"], ["B"]]], "the nearer hinge: the seam clicked, not a line near it");
  assert.deepStrictEqual(r.seamFold, [true, true], "handle 2 on the seam: B turns, A stays bit for bit");
  assert.deepStrictEqual(r.reopened, [true, true]);
});

// (Round UI-1d / B) the background image's own right-click menu; a picture 200 x 100 mm at (600, 0), a pattern A beside it
const BG = `
  S.pieces.length = 0; S.seams.length = 0;
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:400},{x:0,y:400}], true));
  S.pieces.push(A); S.sel = []; app.commit();
  const im = app.ev("addImage")("bg.png", "data:image/png;base64,iVBORw0KGgo=", 200, 100);
  S.backdrop = { img: im.id, x: 600, y: 0, w: 200, h: 100, opacity: 0.5, lock: false, hide: false }; app.commit(); S.undo.length = 0; S.un.length = 0;
  const at = (x, y) => app.toS({ x, y }), out = {};
  const steps = () => app.histSteps().steps.slice(0, S.undo.length).map(s => s.n);
  const menu = (x, y) => { app.menu.children.length = 0; const q = at(x, y); app.showMenu({ clientX: q.x, clientY: q.y }); return app.menu.children.map(c => c.innerHTML.replace(/<span class="k">.*$/, "").replace(/<[^>]+>/g, "").trim()).filter(Boolean); };
  const pick = (n) => app.menu.children.find(c => c.innerHTML.replace(/<[^>]+>/g, "").trim().startsWith(n)).onclick({ stopPropagation() {} });
  const bd = () => S.backdrop && [Math.round(S.backdrop.x), Math.round(S.backdrop.y), Math.round(S.backdrop.w), Math.round(S.backdrop.h), S.backdrop.opacity, S.backdrop.angle || 0, !!S.backdrop.lock];
`;
test("ui1d / B1 (Round UI-1e / D): outside edit mode a right-click on the background image is the empty window's menu (Edit Background Image in it); in edit mode a right-click on the image opens its tools (no Lock any more), off it ends editing", () => {
  const r = boot({ blank: true, script: BG + `
    out.outside = menu(700, 50); out.selOut = S.bgMode;
    pick("Edit Background Image"); out.mode = S.bgMode && S.bgMode.k;
    out.rows = menu(700, 50);
    const q = at(400, 600); app.ev("cvMenu")({ clientX: q.x, clientY: q.y, preventDefault() {} }); out.offEnds = S.bgMode;
    return out;` });
  assert.ok(r.outside.includes("Paste") && r.outside.includes("Edit Background Image"), "the empty window's menu: " + r.outside);
  assert.strictEqual(r.selOut, null, "nothing selected by it");
  assert.strictEqual(r.mode, "edit");
  assert.deepStrictEqual(r.rows, ["Scale…", "Opacity…", "Rotate…", "Move/Position…", "Replace Image…", "Delete Background Image"]);
  assert.strictEqual(r.offEnds, null, "a right-click off the image ends editing");
});

test("ui1d / B2 (in edit mode since Round UI-1e / D): Scale… by a percentage or a real width / height (the others follow, proportions kept), Opacity… 0-100 %, Rotate…, Move/Position…: each changes the image as the numbers are typed, one undo step on OK, Cancel puts it back; corners keep the proportions, Alt from the middle", () => {
  const r = boot({ blank: true, script: BG + `
    app.ev("backdropStart")("edit");
    // Scale: a width typed; the box's sync gives the others, the preview shows it at once
    menu(700, 50);
    app.answer = (t, f, o) => { const v = o.sync({ pct: 100, w: 400, h: 100 }, "w"); out.sync = v; o.preview(v); out.live = bd(); return v; };
    pick("Scale"); out.scaled = [bd(), steps()];
    app.answer = (t, f, o) => { o.preview({ pct: 50, w: 200, h: 50 }); out.live2 = bd(); return null; };
    menu(700, 50); pick("Scale"); out.cancel = [bd(), steps().length];
    // Opacity 0 allowed
    app.answer = (t, f, o) => { o.preview({ op: 0 }); out.op0 = S.backdrop.opacity; return { op: 0 }; };
    menu(700, 50); pick("Opacity"); out.op = [S.backdrop.opacity, steps().length];
    app.answer = (t, f, o) => { o.preview({ a: 30 }); out.rot = S.backdrop.angle; return { a: 30 }; };
    menu(700, 50); pick("Rotate"); out.turned = [bd()[5], steps().length];
    app.answer = (t, f, o) => ({ x: 10, y: 20 });
    menu(800, 50); pick("Move/Position"); out.moved = [bd()[0], bd()[1], steps().length];
    app.answer = null;
    app.undo(); app.undo(); app.undo(); app.undo(); out.undone = bd();
    // a corner dragged: the proportions kept; with Alt about the middle
    S.backdrop.angle = 0; delete S.backdrop.angle; app.ev("backdropSelect")();
    const d = { k: "bgc", fixed: { x: 600, y: 0 }, w0: 400, h0: 100 };
    app.ev("backdropScaleTo")(d, { x: 1400, y: 140 }, {}); out.kept = bd().slice(0, 4);
    S.backdrop = { ...S.backdrop, x: 600, y: 0, w: 400, h: 100 };
    const d2 = { k: "bgc", fixed: { x: 600, y: 0 }, w0: 400, h0: 100 };
    app.ev("backdropScaleTo")(d2, { x: 1200, y: 50 }, { altKey: true }); out.mid = bd().slice(0, 4);
    return out;` });
  assert.deepStrictEqual(r.sync, { pct: 200, w: 400, h: 200 }, "a width typed: the percentage and the height follow");
  assert.deepStrictEqual(r.live.slice(0, 4), [500, -50, 400, 200], "shown at once, about the middle");
  assert.deepStrictEqual(r.scaled, [[500, -50, 400, 200, 0.5, 0, false], ["Scale Background Image"]], "OK: one step");
  assert.deepStrictEqual(r.live2.slice(2, 4), [200, 100]); assert.deepStrictEqual(r.cancel, [[500, -50, 400, 200, 0.5, 0, false], 1], "Cancel: as it was, no step");
  assert.strictEqual(r.op0, 0); assert.deepStrictEqual(r.op, [0, 2]);
  assert.strictEqual(r.rot, 30); assert.deepStrictEqual(r.turned, [30, 3]);
  assert.deepStrictEqual(r.moved, [10, 20, 4]);
  assert.deepStrictEqual(r.undone, [600, 0, 200, 100, 0.5, 0, false], "each box one step");
  assert.deepStrictEqual(r.kept, [600, 0, 800, 200], "a corner: the proportions kept (4 : 1)");
  assert.deepStrictEqual(r.mid, [400, -50, 800, 200], "Alt: about the middle (800, 50)");
});

test("ui1d / B3 (Round UI-1e / D): clicks and drags on the background image do nothing to it outside edit mode (a drag is the box that selects patterns); edit mode: the patterns can't be picked, Delete deletes the image (one step), Esc, Enter or a click off it end editing; Lock is gone, a file's stored lock read by nothing", () => {
  const r = boot({ blank: true, script: BG + `
    app.setTool("transform_pattern");
    const click = (x, y) => { const q = at(x, y); app.fire("pointermove", q); app.fire("pointerdown", q); app.fire("pointerup", q); };
    const b0 = bd();
    click(700, 50); out.click = [S.bgMode, JSON.stringify(bd()) === JSON.stringify(b0)];
    const a = at(650, -20), b = at(-20, 500); app.drag(a.x, a.y, b.x, b.y); app.fire("pointerup", b);
    out.box = [S.sel.length, S.bgMode, JSON.stringify(bd()) === JSON.stringify(b0)];
    // edit mode: a click on a pattern does not pick it; Esc ends; Enter ends; a click off it ends
    S.sel = []; app.ev("backdropStart")("edit"); click(100, 100); out.noPattern = [S.sel.length, S.bgMode && S.bgMode.k];
    app.key("Escape"); out.esc = S.bgMode;
    app.ev("backdropStart")("edit"); app.key("Enter"); out.enter = S.bgMode;
    app.ev("backdropStart")("edit"); click(400, 900); out.off = S.bgMode;
    // Delete in edit mode
    app.ev("backdropStart")("edit"); app.key("Delete"); out.deleted = [S.backdrop, steps().slice(-1)[0]];
    app.undo(); out.back = !!S.backdrop;
    // a stored lock does not stop anything
    S.backdrop.lock = true; app.ev("backdropStart")("edit"); out.locked = S.bgMode && S.bgMode.k;
    const js = app.ev("String")(app.ev("backdropMenu"));
    out.noLockRow = !/"Lock"|Unlock/.test(js);
    return out;` });
  assert.deepStrictEqual(r.click, [null, true], "a click on it: nothing selected, nothing moved");
  assert.deepStrictEqual(r.box, [1, null, true], "a drag from it: the box takes the pattern; the image untouched");
  assert.deepStrictEqual(r.noPattern, [0, null], "editing: a click on a pattern (off the image) picks nothing and ends editing");
  assert.deepStrictEqual([r.esc, r.enter, r.off], [null, null, null], "Esc, Enter and a click off it end editing");
  assert.deepStrictEqual(r.deleted, [null, "Delete Background Image"]); assert.strictEqual(r.back, true);
  assert.strictEqual(r.locked, "edit", "a file's lock no longer stops editing");
  assert.strictEqual(r.noLockRow, true);
});

/* Round beta.6 / 0's two tests of the avatar's outline in 2D (the waist on the origin, Edit Avatar Outline and its offset) were replaced
   in Round FIX-3 / A, which changed the rule on purpose (the maintainer's brief: the 2D window's horizontal axis is the 3D floor, the outline
   stands on it, on by default, no offset): fix3.test.js, "FIX-3 / A". */

module.exports = T;
