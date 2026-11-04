// What the page sees of the desktop shell: window.desktop. The page checks for it
// and otherwise behaves as it does in a browser.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const store = (op, key, val) => {
  const r = ipcRenderer.sendSync("store", op, key, val);
  if (r.error) throw new Error(r.error);
  return r.value;
};
// files handed over from outside (double-click, a second launch) wait here until the page asks for them
const waiting = [];
let onFile = null;
ipcRenderer.on("open-file", (e, f) => { if (onFile) onFile(f); else waiting.push(f); });

contextBridge.exposeInMainWorld("desktop", {
  // the autosave, with localStorage's own calls; where(key) is the file a key is kept in
  store: {
    getItem: (k) => store("get", k), setItem: (k, v) => store("set", k, v),
    removeItem: (k) => store("remove", k), where: (k) => store("path", k),
  },
  // each resolves to { path, name, text } or, for a version 12 pattern file, { path, name, data } (its bytes); save: { path, name };
  // null if the dialog was cancelled. What is saved is a pattern file's bytes. save: + kept, the name of the copy of a
  // version 11 original made just now ("<name>.v11.pdraft"), if one was.
  open: () => ipcRenderer.invoke("file:open"),
  openRecent: (file) => ipcRenderer.invoke("file:open-recent", file),
  recent: () => ipcRenderer.invoke("file:recent"),
  save: (file, text) => ipcRenderer.invoke("file:save", file, text),
  saveAs: (suggested, text) => ipcRenderer.invoke("file:save-as", suggested, text),
  onOpenFile: (f) => { onFile = f; for (const x of waiting.splice(0)) f(x); },
  // the avatar: pick() asks for a file, read(path) opens one picked before, or a preset.
  // Each resolves to { path, name, data } (data: the file's bytes), or null.
  // presets(): the ready-made avatars lying in assets/avatar/presets: { male: { path, name, thumb } }
  avatar: { presets: () => ipcRenderer.invoke("avatar:presets"), pick: () => ipcRenderer.invoke("avatar:pick"), read: (file) => ipcRenderer.invoke("avatar:read", file).then((r) => { if (r && r.refused) throw new Error(r.refused); return r; }) },
  // resolves to "" when printed, otherwise the reason
  print: (html, pw, ph) => ipcRenderer.invoke("print", html, pw, ph),
  // an export (DXF, SVG, XML, JSON, a print file) written where the user chooses; pdf: the print file made into a PDF;
  // bugReport: the text and, if given, the open document's bytes beside it. Each resolves to { path, name } or null if cancelled.
  exportFile: (suggested, data) => ipcRenderer.invoke("file:export", suggested, data),
  showSaved: () => ipcRenderer.invoke("file:show-saved"),
  pdf: (suggested, html) => ipcRenderer.invoke("file:pdf", suggested, html),
  bugReport: (suggested, text, doc) => ipcRenderer.invoke("file:bug-report", suggested, text, doc || null),
  copyText: (text) => ipcRenderer.invoke("clipboard:write", text),
  // { version, build, commit, packaged, os, arch, electron, chrome }, and notice: a line to show at the start (what was brought
  // over from the folder of the program's old name, desktop/migrate.js), only in the session that brought it
  info: () => ipcRenderer.invoke("app:info"),
  // opens the feedback link of config.js (and nothing else); resolves to the link
  openFeedback: () => ipcRenderer.invoke("feedback:open"),
  // (Round desk-2, a Mac) copy, cut, paste, selectAll, undo or redo in the text field that has the focus: a Mac app does these
  // through its Edit menu, and the desktop app has none of its own (the page's menus are the menus)
  edit: (what) => ipcRenderer.send("edit", what),
  // (Round r24) updates: state() { kind, canInstall, source, version, channel, page }; check() { status: "available" | "none" |
  // "error" | "nosource", found: { version } }; download() with onProgress(f) getting { percent }; install() restarts into it
  // (the page asks about unsaved work first); page() opens the release page (a copy that cannot replace itself)
  updates: { state: () => ipcRenderer.invoke("updates:state"), check: () => ipcRenderer.invoke("updates:check"), download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"), page: () => ipcRenderer.invoke("updates:page"), onProgress: (f) => ipcRenderer.on("update-progress", (e, p) => f(p)) },
  // (a Mac) the app's first menu: f("about") or f("settings")
  onAppMenu: (f) => ipcRenderer.on("app-menu", (e, what) => f(what)),
  // (Round r32) the page is fully ready: its window is shown and the splash closed; onStartLate(f): the window was shown before that, after f(seconds)
  ready: () => ipcRenderer.send("app:ready"),
  onStartLate: (f) => ipcRenderer.on("start-late", (e, s) => f(s)),
});
