// A data folder of its own for every check that starts the desktop app (Round desk-2), so that no check ever reads,
// moves or deletes the user's own (%APPDATA%\Gusset, ~/Library/Application Support/Gusset, ~/.config/Gusset: their unsaved
// work, library and settings), nor the one of the program's old name (desktop/migrate.js). The app takes it from
// PDRAFT_USER_DATA (desktop/main.js), and its one-window lock then holds within that folder only, so a check runs beside an
// open app; given PDRAFT_USER_DATA and not PDRAFT_OLD_USER_DATA (a stand-in for the old folder) it brings nothing over.
//   fresh(tag)   a new, empty folder in the system's temp folder: { dir, data, env }; env is process.env with
//                PDRAFT_USER_DATA = data (and no ELECTRON_RUN_AS_NODE), to start the app with
//   remove(dir)  deletes dir, and only if it lies inside the system's temp folder; anything else is refused (thrown)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

function inTemp(dir) {
  // a folder not there yet is judged by what its nearest existing parent really is (the temp folder's path often holds a link)
  const real = (p) => { try { return fs.realpathSync.native(p); } catch (e) { const up = path.dirname(p); return up === p ? p : path.join(real(up), path.basename(p)); } };
  const t = real(os.tmpdir()), d = real(dir), win = process.platform === "win32";
  const rel = path.relative(win ? t.toLowerCase() : t, win ? d.toLowerCase() : d);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}
function fresh(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdraft-" + (tag || "check") + "-"));
  const data = path.join(dir, "data");
  fs.mkdirSync(data);
  const env = { ...process.env, PDRAFT_USER_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  return { dir, data, env };
}
function remove(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  if (!inTemp(dir)) throw new Error("refused to delete " + dir + ": not inside the system's temp folder " + os.tmpdir());
  fs.rmSync(dir, { recursive: true, force: true });
}
module.exports = { fresh, remove, inTemp };
