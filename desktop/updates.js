// (Round r24) Updates for the desktop app: whether a newer version is out, and (where the app can replace itself) getting it.
// The page asks (preload.js: desktop.updates); nothing is ever downloaded or installed without the user's click.
//   kind        how this copy was installed: "installer" (Windows, the NSIS installer), "appimage" (Linux), "portable"
//               (Windows, the portable .exe), "mac", "linux" (not an AppImage), "source" (run from the project)
//   can install the installer and the AppImage download the new version and restart into it; the rest are told of it and
//               open the release page
//   the source  where the versions are read from: the build's own (desktop/build.js writes the packed package.json's
//               "updateSource": "github:<owner>/<repo>" or a web folder's address), or PDRAFT_UPDATE_URL, a check's own
//               server. None: there is nothing to check, and the page says so
//   channel     a test version (0.9.0-beta.4) reads the beta channel (beta.yml, which a beta build and every stable build
//               write) and so is offered betas and stable versions; a stable version reads latest.yml, which no beta writes,
//               and is offered stable versions only. Never a downgrade.
// What is sent: the request for the channel's file and the download, as any web page asks for a file; nothing about the user.
// electron-updater is loaded only when a check is made, so it costs the start nothing.
"use strict";

function kindOf(app, env, platform) {
  if (!app.isPackaged) return "source";
  if (platform === "win32") return env.PORTABLE_EXECUTABLE_FILE ? "portable" : "installer";
  if (platform === "linux") return env.APPIMAGE ? "appimage" : "linux";
  if (platform === "darwin") return "mac";
  return "other";
}
const INSTALLS = ["installer", "appimage"];

// "github:owner/repo" or an http(s) address → electron-updater's feed; anything else → null
function sourceOf(meta, env) {
  const s = String(env.PDRAFT_UPDATE_URL || (meta && meta.updateSource) || "").trim();
  let m = /^github:([\w.-]+)\/([\w.-]+)$/.exec(s);
  if (m) return { provider: "github", owner: m[1], repo: m[2] };
  if (/^https?:\/\/[^\s]+$/i.test(s)) return { provider: "generic", url: s.endsWith("/") ? s : s + "/" };
  return null;
}
// the page a person downloads a version from
function releasePage(src, version) {
  if (!src) return "";
  if (src.provider === "github") return "https://github.com/" + src.owner + "/" + src.repo + "/releases" + (version ? "/tag/v" + version : "");
  return src.url;
}
// "0.9.0-beta.4" → "beta"; "1.0.0" → "latest"
const channelOf = (version) => { const m = /-([a-z]+)/i.exec(String(version)); return m ? m[1].toLowerCase() : "latest"; };

function make({ app, env, platform, meta, send, openExternal, load, downloadPage }) {
  const kind = kindOf(app, env, platform), src = sourceOf(meta, env), version = app.getVersion();
  const canInstall = INSTALLS.includes(kind) || (kind === "source" && env.PDRAFT_UPDATE_INSTALL === "1");
  let up = null, found = null, downloaded = false;
  // electron-updater, set up the first time it is needed
  const updater = () => {
    if (up) return up;
    up = (load || (() => require("electron-updater").autoUpdater))();
    up.autoDownload = false; up.autoInstallOnAppQuit = false; up.logger = null;
    if (kind === "source") up.forceDevUpdateConfig = true;
    up.setFeedURL(src);
    up.channel = channelOf(version);
    up.allowPrerelease = channelOf(version) !== "latest";
    up.allowDowngrade = false;                                   // (setting the channel allows it: put back)
    up.on("download-progress", (p) => send("update-progress", { percent: Math.round(p.percent || 0), bytes: p.transferred || 0, total: p.total || 0 }));
    return up;
  };
  // (Round r28) the website's download page when config.js names one: a person is sent there, not to where the files are kept
  const page = () => /^https:\/\//i.test(downloadPage || "") ? downloadPage : releasePage(src, found && found.version);
  const state = () => ({ kind, canInstall, source: !!src, version, channel: channelOf(version), page: page() });
  async function check() {
    if (!src) return { status: "nosource", ...state() };
    try {
      const r = await updater().checkForUpdates();
      const info = r && r.updateInfo, newer = !!(r && r.isUpdateAvailable !== false && info && info.version && info.version !== version);
      found = newer ? { version: info.version, date: info.releaseDate || "" } : null;
      return { status: found ? "available" : "none", latest: info ? info.version : "", ...state(), found };
    } catch (e) { return { status: "error", error: String(e && e.message || e).split("\n")[0].slice(0, 300), ...state() }; }
  }
  async function download() {
    if (!found) throw new Error("no update found");
    if (!canInstall) throw new Error("this copy cannot replace itself: open the release page");
    await updater().downloadUpdate();
    downloaded = true;
    return { downloaded: true, version: found.version };
  }
  // the page has asked about unsaved work first; the app restarts into the new version (the installer runs without its pages)
  function install() {
    if (!downloaded) throw new Error("nothing downloaded");
    setImmediate(() => updater().quitAndInstall(true, true));
    return true;
  }
  function openPage() {
    const url = page();
    if (!/^https?:\/\//i.test(url)) throw new Error("no release page for this copy");
    return openExternal(url).then(() => url);
  }
  return { state, check, download, install, openPage };
}

module.exports = { make, kindOf, sourceOf, releasePage, channelOf, INSTALLS };
