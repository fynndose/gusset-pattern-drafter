// Pulls named top-level declarations out of the drafter's app script so the
// geometry can be tested headlessly in Node against the code that actually ships.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HTML = path.join(__dirname, "..", "pattern-drafter.html");

const pageHTML = () => fs.readFileSync(HTML, "utf8");

// The page's scripts as a browser reads them: a script element ends at the first
// "</script" after it opens, whatever the JavaScript inside meant by it; a src is
// read from the file next to the page.   -> [{ src, code }]
function pageScripts(html = pageHTML()) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].map(m => {
    const src = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]);
    return src ? { src: src[1], code: fs.readFileSync(path.join(path.dirname(HTML), src[1]), "utf8") } : { src: null, code: m[2] };
  });
}

// What VS Code Live Server does to a page it serves: its reload script goes in
// before the first "</body>" in the file, wherever that is.
function liveServerInject(html = pageHTML(), tag = '<script>globalThis.__liveReload = true;</script>') {
  const at = html.search(/<\/body>/i);
  if (at < 0) throw new Error("no </body> in the page");
  return html.slice(0, at) + tag + "\n" + html.slice(at);
}

function appSource(html) {
  const app = pageScripts(html).find(s => s.code.includes('"use strict"'));
  if (!app) throw new Error("app script not found");
  return app.code;
}

// skip a string literal starting at src[i] (a quote); returns the index of its closing quote
function skipString(src, i) {
  const c = src[i];
  for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
  return i;
}

// the code with every string literal emptied (a template string as a whole)
function noStrings(code) {
  let out = "";
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(code, i); out += c + c; continue; }
    out += c;
  }
  return out;
}

// end index (exclusive) of the balanced {...} starting at src[open]
function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(src, i); continue; }
    if (c === "/" && src[i+1] === "/") { i = src.indexOf("\n", i); continue; }
    if (c === "/" && src[i+1] === "*") { i = src.indexOf("*/", i) + 1; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i + 1;
  }
  throw new Error("unbalanced braces from " + open);
}

// a const / let statement starting at `at`: it runs to the first ';' at bracket depth 0
// (bounded string skipping: a quote inside a regex literal would otherwise run off the end)
function statementAt(src, at) {
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(src, i); continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0) return src.slice(at, i + 1);
  }
  throw new Error("unterminated statement at " + at);
}

function extract(src, name) {
  const fn = new RegExp("^(?:async )?function " + name + "\\(", "m").exec(src);
  if (fn) return src.slice(fn.index, matchBrace(src, src.indexOf("{", src.indexOf(")", fn.index))));
  const k = new RegExp("^(?:const|let) " + name + " = ", "m").exec(src);
  if (!k) throw new Error("declaration not found: " + name);
  return statementAt(src, k.index);
}

// Every top-level declaration of the app script: name -> { pos, fn, text }. A statement
// that declares several names (const A = 1, B = 2;) is listed under each of them.
let declCache = null;
function declIndex(src) {
  if (declCache && declCache.src === src) return declCache.idx;
  const idx = new Map();
  for (const m of src.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/gm)) idx.set(m[1], { pos: m.index, fn: true });
  for (const m of src.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*) = /gm)) {
    let text;
    try { text = statementAt(src, m.index); } catch (e) { continue; }
    const entry = { pos: m.index, fn: false, text };
    if (!idx.has(m[1])) idx.set(m[1], entry);
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"' || c === "'" || c === "`") { i = skipString(text, i); continue; }
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth--;
      else if (c === "," && depth === 0) { const d = /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(text.slice(i + 1)); if (d && !idx.has(d[1])) idx.set(d[1], entry); }
    }
  }
  declCache = { src, idx };
  return idx;
}

/* load(names, globals) -> { name: value }. The named declarations are taken from the app
   script together with everything they refer to (functions, and constants that do not
   touch the page), in the script's own order. So a test names what it uses and keeps
   working when the code underneath is split into more helpers. A name passed in
   `globals` is the test's stand-in and is never taken from the script. */
function load(names, globals = {}) {
  globals = { ZPRJ: require("../zprj-import.js"), ...globals };      // the curve every curve-point curve is drawn with
  const src = appSource(), idx = declIndex(src), g = new Set(Object.keys(globals));
  const parts = new Map(), queue = names.map(n => [n, true]);
  while (queue.length) {
    const [n, asked] = queue.pop(), d = idx.get(n);
    if (!d) { if (asked) throw new Error("declaration not found: " + n); continue; }
    if (parts.has(d.pos) || (!asked && g.has(n))) continue;
    const code = d.fn ? extract(src, n) : d.text;
    // (Round H1a: a word inside a string, as a render background "window", touches no page: the strings are left out of that look)
    if (!asked && !d.fn && /\b(document|window|localStorage)\b/.test(noStrings(code))) continue;
    parts.set(d.pos, code);
    for (const id of new Set(code.match(/[A-Za-z_$][\w$]*/g) || [])) if (idx.has(id) && !g.has(id)) queue.push([id, false]);
  }
  const body = [...parts.keys()].sort((x, y) => x - y).map(k => parts.get(k)).join("\n") + "\nreturn {" + names.join(",") + "};";
  const gk = [...g];
  return new Function(...gk, body)(...gk.map(k => globals[k]));
}

// whole app script must still parse
function syntaxCheck() { new vm.Script(appSource(), { filename: "pattern-drafter.js" }); }

/* (Round r33 / 4) Until r33 every new document had a placeholder size run, XS to XL in "Size Group" with M its base (ids 1–5,
   the group 1); since then a document starts with no size group. Tests that grade on a run use this one, the very object the
   old defaultGrading() returned (a fresh copy each call), so their numbers stay as they were. */
const OLD_SIZE_COLS = ["#e03131", "#f08c00", "#2f9e44", "#1971c2", "#9c36b5"];
function oldSizeRun() {
  const sizes = ["XS", "S", "M", "L", "XL"].map((name, i) => ({ id: i + 1, name, color: OLD_SIZE_COLS[i] }));
  return { groups: [{ id: 1, name: "Size Group", sizes, base: 3 }], tables: [], active: null, nest: false, nextId: 6 };
}
// the same as a line of script for a booted app (boot-child.js): S.grading set to it
const OLD_SIZE_RUN_JS = "S.grading = " + JSON.stringify(oldSizeRun()) + ";";
// (Round H1) this build's file version, read from the app's FILE_VERSION: the tests compare with it, never with a number of their own
const FILE_VERSION = +/FILE_VERSION = ([0-9]+)/.exec(appSource())[1];
module.exports = { load, syntaxCheck, appSource, extract, pageHTML, pageScripts, liveServerInject, oldSizeRun, OLD_SIZE_RUN_JS, FILE_VERSION };
