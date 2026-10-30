// node scripts/site-check.js [site folder] [--shots <folder>] : the website in a real browser (Round r28). Serves the folder, opens each page at
// desktop and phone width: no console error, no sideways scroll, every link inside the site answers. The download page with no releases, with a
// test version, with a final and a newer test version, and when the list fails; each system's big button. The browser app under /app/ boots and loads
// Marty over http. Every file of the folder under 25 MiB. Exit code 1 on any failure.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const args = process.argv.slice(2), shotAt = args.indexOf("--shots"), SHOTS = shotAt >= 0 ? path.resolve(args[shotAt + 1]) : null;
const SITE = path.resolve(args.find((a, i) => !a.startsWith("--") && i !== shotAt + 1) || path.join(__dirname, "..", "website"));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".glb": "model/gltf-binary", ".md": "text/plain; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2" };
const fails = [], say = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails.push(what); };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(SITE, p);
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end("no"); }
  r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "text/plain; charset=utf-8" });
  fs.createReadStream(f).pipe(r);
});

const rel = (version, prerelease) => ({ version, tag: "v" + version, prerelease, date: "2026-11-01", source: "https://example.test/source.zip", files: [
  { os: "windows", kind: "installer", arch: "x64", name: "a-setup.exe", url: "https://example.test/a-setup.exe", size: 104857600, sha256: "ab".repeat(32) },
  { os: "windows", kind: "portable", arch: "x64", name: "a-portable.exe", url: "https://example.test/a-portable.exe", size: 94371840, sha256: "cd".repeat(32) },
  { os: "mac", kind: "dmg", arch: "arm64", name: "a.dmg", url: "https://example.test/a.dmg", size: 125829120, sha256: "ef".repeat(32) },
  { os: "mac", kind: "zip", arch: "arm64", name: "a.zip", url: "https://example.test/a.zip", size: 120000000, sha256: "01".repeat(32) },
  { os: "linux", kind: "appimage", arch: "x64", name: "a.AppImage", url: "https://example.test/a.AppImage", size: 130000000, sha256: "23".repeat(32) }] });
const UA = { windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
  phone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" };

(async () => {
  await new Promise(ok => srv.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + srv.address().port + "/";
  for (const f of walk(SITE)) if (fs.statSync(f).size > 25 * 1048576) say(false, path.relative(SITE, f) + " is over 25 MiB");
  say(true, walk(SITE).length + " files looked at for the 25 MiB limit");
  const launch = { headless: true };
  let browser;
  try { browser = await chromium.launch(launch); }
  catch (e) { browser = await chromium.launch({ ...launch, channel: process.platform === "win32" ? "chrome" : undefined, executablePath: process.env.PDRAFT_CHROME || undefined }); }

  const pages = ["index.html", "features.html", "download.html", "try.html", "help.html", "privacy.html", "contact.html", "legal.html", "404.html"];
  const seen = new Set();
  for (const [label, size] of [["desktop", { width: 1280, height: 860 }], ["phone", { width: 375, height: 760 }]]) {
    const ctx = await browser.newContext({ viewport: size, userAgent: label === "phone" ? UA.phone : UA.windows });
    for (const n of pages) {
      const page = await ctx.newPage(), errs = [];
      page.on("console", m => { if (m.type() === "error" && !/shots\/.*404|404/.test(m.text() + m.location().url)) errs.push(m.text()); });
      page.on("pageerror", e => errs.push(String(e)));
      await page.goto(base + n, { waitUntil: "load" });
      await page.waitForTimeout(1800);
      say(!errs.length, label + " " + n + ": no console error" + (errs.length ? " (" + errs[0] + ")" : ""));
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      say(over <= 0, label + " " + n + ": no sideways scroll" + (over > 0 ? " (" + over + " px)" : ""));
      const font = await page.evaluate(async () => { await document.fonts.ready; return { body: getComputedStyle(document.body).fontFamily, loaded: [...document.fonts].some(f => f.family.includes("Chakra Petch") && f.status === "loaded") }; });
      say(/^"?Chakra Petch/.test(font.body) && font.loaded, label + " " + n + ": the typeface, from this site");
      const away = await page.$$eval("main a[href*='github'], header a[href*='github']", as => as.length);
      say(!away, label + " " + n + ": GitHub in the footer only");
      for (const href of await page.$$eval("a[href]", as => as.map(a => a.href))) {
        const u = href.split("#")[0];
        if (!u.startsWith(base) || seen.has(u)) continue;
        seen.add(u);
        if (n === "404.html" && !/\.[a-z]+$|\/$/.test(u)) continue;            // its pretty addresses are Cloudflare's
        const r = await ctx.request.get(u);
        say(r.ok(), "link " + u.slice(base.length || 0) + " answers");
      }
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, label + "-" + n + ".png"), fullPage: true }); }
      await page.close();
    }
    await ctx.close();
  }

  // the download page, by what downloads.json says and which system asks
  const dl = async (os, body, status) => {
    const ctx = await browser.newContext({ userAgent: UA[os], viewport: os === "phone" ? { width: 375, height: 760 } : { width: 1280, height: 860 } });
    await ctx.addInitScript(() => { try { Object.defineProperty(navigator, "userAgentData", { value: undefined }); } catch (e) {} });
    const page = await ctx.newPage();
    await page.route("**/downloads.json", r => r.fulfill({ status: status || 200, contentType: "application/json", body: JSON.stringify(body) }));
    await page.goto(base + "download.html", { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("#dl-primary").textContent.trim().length > 0);
    return { page, ctx };
  };
  const text = (p, s) => p.$eval(s, e => e.textContent);
  let t;
  t = await dl("windows", { schema: 1, latest: null, stable: null });
  say(/first version is on its way/.test(await text(t.page, "#dl-primary")) && await t.page.$eval("#dl-all", e => e.hidden), "no release yet: says so, no table");
  await t.ctx.close();
  t = await dl("windows", {}, 500);
  say(/could not be loaded/.test(await text(t.page, "#dl-primary")), "the list fails: says so and what to do");
  await t.ctx.close();
  const one = { schema: 1, latest: rel("1.0.0-beta.1", true), stable: null };
  t = await dl("windows", one);
  say(/Download for Windows/.test(await text(t.page, "#dl-primary")) && (await t.page.$eval("#dl-primary a", a => a.href)).endsWith("a-setup.exe") && /Test version/.test(await text(t.page, "#dl-notes")), "Windows: the installer first, marked as a test version");
  say((await t.page.$$("#dl-rows tr")).length === 5 && (await t.page.$eval("#foot-source", a => a.href)).endsWith("source.zip"), "every file in the table, and the footer's link to this version's source code");
  say((await text(t.page, "#dl-rows")).includes("ab".repeat(32)), "the checksums are shown");
  if (SHOTS) await t.page.screenshot({ path: path.join(SHOTS, "download-windows.png"), fullPage: true });
  await t.ctx.close();
  t = await dl("mac", one);
  say(/Apple chip/.test(await text(t.page, "#dl-primary")) && (await t.page.$eval("#dl-primary a", a => a.href)).endsWith("a.dmg") && /Intel Mac/.test(await text(t.page, "#dl-notes")), "Mac: the Apple chip's .dmg first, and what an Intel Mac does");
  await t.ctx.close();
  { const both = rel("1.0.0-beta.1", true); both.files.push({ os: "mac", kind: "dmg", arch: "x64", name: "b.dmg", url: "https://example.test/b.dmg", size: 125829120, sha256: "45".repeat(32) });
    t = await dl("mac", { schema: 1, latest: both, stable: null });
    const hrefs = await t.page.$$eval("#dl-primary a", as => as.map(a => a.href));
    say(hrefs.length === 2 && hrefs[0].endsWith("a.dmg") && hrefs[1].endsWith("b.dmg") && /Intel/.test(await text(t.page, "#dl-primary")), "Mac: both chips offered by name, when both are built");
    await t.ctx.close(); }
  t = await dl("linux", one);
  say((await t.page.$eval("#dl-primary a", a => a.href)).endsWith("a.AppImage"), "Linux: the AppImage");
  await t.ctx.close();
  t = await dl("phone", one);
  say(/needs a computer/.test(await text(t.page, "#dl-primary")) && !(await t.page.$("#dl-primary a")), "a phone: no button, says why");
  { const over = await t.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); say(over <= 0, "a phone: the table of files fits (" + over + ")"); }
  if (SHOTS) await t.page.screenshot({ path: path.join(SHOTS, "download-phone.png"), fullPage: true });
  await t.ctx.close();
  t = await dl("windows", { schema: 1, latest: rel("1.1.0-beta.1", true), stable: rel("1.0.0", false) });
  say((await text(t.page, "#dl-primary")).includes("1.0.0") && /newer test version/.test(await text(t.page, "#dl-notes")) && !/Test version/.test(await text(t.page, "#dl-notes")), "a final version first, the newer test version named under it");
  await t.ctx.close();

  // the browser app, as the Try page opens it
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(base + "try.html");
  await page.click("a.btn");
  await page.waitForFunction(() => document.querySelector("canvas") && performance.getEntriesByName("gusset-ready").length, null, { timeout: 30000 });
  say(page.url() === base + "app/", "Try's button opens /app/");
  await page.waitForTimeout(1500);
  const title = await page.title();
  say(/^Gusset/.test(title), "the app's title: " + title);
  const avatar = await page.evaluate(async () => {
    const r = await fetch("assets/avatar/presets/marty.glb");
    const b = await r.arrayBuffer();
    return { ok: r.ok, size: b.byteLength };
  });
  say(avatar.ok && avatar.size > 500000, "the avatar's file answers over http (" + avatar.size + " bytes)");
  say(!errs.length, "the app: no error" + (errs.length ? " (" + errs[0] + ")" : ""));
  await ctx.close();

  await browser.close();
  srv.close();
  console.log(fails.length ? "\nSITE CHECK FAILED: " + fails.length : "\nSITE CHECK PASSED");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
