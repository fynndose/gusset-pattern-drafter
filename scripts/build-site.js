// node scripts/build-site.js : builds the browser app into website/app/ (Round r28), the folder the website's Try in Browser page
// opens: the files the desktop build packs of drafter/ (desktop/package.json, extraResources: the list the tests keep in step with what
// the page loads) but the desktop app's splash window, the page as index.html so that /app/ opens it, and the licenses
// beside it. website/app/ is a build output: ignored in the working repository, made afresh here and by the public export,
// which reads the same files from the commit it exports. Fails if a file is over Cloudflare Pages' limit (MAX_FILE, 25 MiB).
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), MAX_FILE = 25 * 1024 * 1024;
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "desktop", "package.json"), "utf8"));
const FROM_APP = PKG.build.extraResources.find(r => r.from === "../drafter").filter.filter(f => f !== "splash.html");
const ROOT_DOCS = ["LICENSE", "ATTRIBUTION.md", "TRADEMARKS.md", "THIRD-PARTY-NOTICES.md"];

// [where it lands under website/app/, the project file it is]
const PLAN = () => [...FROM_APP.map(f => [f === "pattern-drafter.html" ? "index.html" : f, "drafter/" + f]), ...ROOT_DOCS.map(f => [f, f])];

// read(project file) gives its bytes; writes the app under <siteDir>/app, which must be gone or be left by an earlier build
function build(siteDir, read) {
  const app = path.join(siteDir, "app");
  if (fs.existsSync(app)) {
    if (!fs.existsSync(path.join(app, "index.html"))) throw new Error(app + " is not an earlier build: nothing removed");
    fs.rmSync(app, { recursive: true });
  }
  let bytes = 0;
  for (const [to, from] of PLAN()) {
    const b = read(from);
    if (b.length > MAX_FILE) throw new Error(from + " is " + (b.length / 1048576).toFixed(1) + " MiB, over the 25 MiB a Cloudflare Pages file may be");
    const at = path.join(app, to);
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.writeFileSync(at, b);
    bytes += b.length;
  }
  return { files: PLAN().length, bytes };
}

if (require.main === module) {
  const r = build(path.join(ROOT, "website"), (f) => fs.readFileSync(path.join(ROOT, f)));
  console.log("website/app/: " + r.files + " files, " + (r.bytes / 1048576).toFixed(1) + " MiB.");
}
module.exports = { build, PLAN, MAX_FILE };
