// Screenshots of the real app in a few states, for looking at a change:   npx electron shots.js <output folder>
// (throwaway data folder; nothing of the user's is touched)
"use strict";
const { app } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");

const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), "pdraft-shots"));
const TD = require("./test-data.js"), fresh = TD.fresh("shots"), tmp = fresh.dir;      // a fresh data folder, never the user's
process.env.PDRAFT_USER_DATA = fresh.data;
app.setPath("userData", fresh.data);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

app.once("browser-window-created", (e, win) => win.webContents.once("did-finish-load", async () => {
  const wc = win.webContents, js = (code) => wc.executeJavaScript(code, true);
  const shot = async (name) => { await sleep(350); fs.writeFileSync(path.join(out, name + ".png"), (await wc.capturePage()).toPNG()); console.log(path.join(out, name + ".png")); };
  try {
    await sleep(500);
    await shot("1-blank-start");
    await js("drafterDebug().run('starterDoc', true); drafterDebug().setLayout('both'); 0");
    await shot("2-both-windows-splitter");
    await js("drafterDebug().run('setDock', '2D', 'top'); drafterDebug().run('setDock', '3D', 'left'); drafterDebug().run('setSplit', 0.35, true); 0");
    await shot("3-docked-top-and-left");
    await js("drafterDebug().run('loadAvatar'); 0");
    await sleep(400);
    await shot("4-load-avatar-dialog");
    await js("drafterDebug().run('hideDlg'); drafterDebug().run('askUnsaved', 'start a new document', () => {}); 0");
    await shot("5-unsaved-changes-question");
    await js("drafterDebug().run('closeModal'); drafterDebug().run('setTimeline', true); 0");
    await shot("6-timeline");
  } catch (err) { console.log("FAILED " + err.stack); }
  try { TD.remove(tmp); } catch (e) { console.log(e.message); }
  app.exit(0);
}));
require("./main.js");
