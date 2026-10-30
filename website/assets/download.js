/* The download page: reads downloads.json (written by the release workflow), works out the visitor's system and offers its
   file first. The pure parts (osOf, primaryOf, filesFor, sizeText, versionText) are tested in drafter/tests/r28.test.js. */
"use strict";
(function (root) {
  var SYSTEMS = { windows: "Windows", mac: "Mac", linux: "Linux" };
  var KIND = {
    installer: "Installer (recommended)", portable: "Portable .exe, no installation",
    dmg: "Disk image (.dmg)", zip: "Archive (.zip)", appimage: "AppImage"
  };

  // "windows", "mac", "linux" or "phone" from what the browser says about itself
  function osOf(ua, platform, touchPoints) {
    var s = (platform || "") + " " + (ua || "");
    if (/iPhone|iPad|iPod|Android/i.test(s)) return "phone";
    if (/Mac/i.test(s)) return touchPoints > 1 ? "phone" : "mac";       // an iPad says Mac, but has a touch screen
    if (/Win/i.test(s)) return "windows";
    if (/CrOS/i.test(s)) return "phone";
    if (/Linux|X11/i.test(s)) return "linux";
    return "";
  }

  // the version to offer first: a final one when there is one, else the newest test version
  function primaryOf(data) {
    if (!data) return null;
    return data.stable || data.latest || null;
  }

  // a system's files, best first: the kinds in KIND's order, and on a Mac the Apple chip's first
  function filesFor(rel, os) {
    var order = Object.keys(KIND);
    return ((rel && rel.files) || []).filter(function (f) { return f.os === os; }).sort(function (a, b) {
      return (a.arch === "arm64" ? 0 : 1) - (b.arch === "arm64" ? 0 : 1) || order.indexOf(a.kind) - order.indexOf(b.kind);
    });
  }

  function sizeText(bytes) { return bytes ? Math.round(bytes / 1048576) + " MB" : ""; }
  function versionText(v) { return String(v || "").replace(/-(alpha|beta|rc)\.(\d+)$/, " $1 $2"); }
  function fileLabel(f) {
    return KIND[f.kind] + (f.os === "mac" ? (f.arch === "arm64" ? ", Apple chip" : ", Intel") : "");
  }

  if (typeof module === "object" && module.exports) { module.exports = { osOf: osOf, primaryOf: primaryOf, filesFor: filesFor, sizeText: sizeText, versionText: versionText }; return; }

  var el = function (id) { return root.document.getElementById(id); };
  var make = function (tag, props, kids) {
    var e = root.document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) { if (k === "cls") e.className = props[k]; else e[k] = props[k]; });
    (kids || []).forEach(function (k) { e.append(k); });
    return e;
  };

  function bigButton(f, rel) {
    return make("a", { cls: "btn", href: f.url }, ["Download for " + SYSTEMS[f.os] + (f.os === "mac" && f.arch === "arm64" ? " with Apple chip" : ""),
      make("small", {}, [fileLabel(f).replace(", Apple chip", "") + ", " + sizeText(f.size) + ", version " + versionText(rel.version)])]);
  }

  function showMain(rel, os, data) {
    var main = el("dl-primary"), notes = el("dl-notes");
    main.textContent = ""; notes.textContent = "";
    var files = filesFor(rel, os);
    if (os === "phone") {
      main.append(make("p", {}, ["Gusset needs a computer with a mouse and a larger screen. Open this page on a Windows, Mac or Linux computer to download it."]));
    } else if (!os || !files.length) {
      main.append(make("p", {}, [os ? "There is no " + SYSTEMS[os] + " version of this release. The list below has what there is, and Gusset also runs in a browser." : "Pick your system from the list below."]));
    } else {
      main.append(bigButton(files[0], rel));
      if (files[1] && os !== "mac") main.append(make("a", { cls: "btn quiet", href: files[1].url }, [KIND[files[1].kind], make("small", {}, [sizeText(files[1].size)])]));
      // (a Mac's browser does not say which chip it has: both are offered, by name)
      var intel = os === "mac" && files.filter(function (f) { return f.arch === "x64" && f.kind === "dmg"; })[0];
      if (intel) main.append(make("a", { cls: "btn quiet", href: intel.url }, ["Download for Mac with Intel", make("small", {}, [sizeText(intel.size)])]));
    }
    if (os === "mac" && files.some(function (f) { return f.arch === "x64"; }))
      notes.append(make("p", {}, ["Not sure which you have? The Apple menu, About This Mac, tells you."]));
    if (os === "mac" && !files.some(function (f) { return f.arch === "x64"; }))
      notes.append(make("p", {}, ["This version is for Macs with an Apple chip (M1 or newer). The Apple menu, About This Mac, tells you which you have. On an Intel Mac, use Gusset in a browser."]));
    if (rel.prerelease)
      notes.append(make("p", {}, [make("span", { cls: "tag" }, ["Test version"]), " Some things are missing and some will go wrong. Save your work often."]));
    if (data.stable && data.latest && data.latest.version !== data.stable.version && data.latest.prerelease) {
      var t = filesFor(data.latest, os)[0];
      if (t) notes.append(make("p", {}, ["A newer test version is out: ", make("a", { href: t.url }, ["version " + versionText(data.latest.version)]), "."]));
    }
  }

  function showTable(rel) {
    var body = el("dl-rows");
    body.textContent = "";
    ["windows", "mac", "linux"].forEach(function (os) {
      filesFor(rel, os).forEach(function (f, i) {
        body.append(make("tr", {}, [make("td", { cls: "sys" }, [i ? "" : SYSTEMS[os]]), make("td", {}, [make("a", { href: f.url }, [fileLabel(f)])]), make("td", {}, [sizeText(f.size)]), make("td", { cls: "sum" }, [f.sha256 || ""])]));
      });
    });
    el("dl-all").hidden = false;
    // the footer's link goes to the source code of exactly this version (the GPL's written directions beside the program)
    if (rel.source) { var src = el("foot-source"); src.href = rel.source; src.textContent = "Source code of version " + versionText(rel.version) + " (.zip, on GitHub)"; }
  }

  function empty(text) {
    el("dl-primary").textContent = "";
    el("dl-primary").append(make("p", {}, [text]));
  }

  function start() {
    var uaData = root.navigator.userAgentData;
    var os = osOf(root.navigator.userAgent, uaData && uaData.platform, root.navigator.maxTouchPoints);
    root.fetch("downloads.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("answered " + r.status);
      return r.json();
    }).then(function (data) {
      var rel = primaryOf(data);
      if (!rel) return empty("The first version is on its way. Until then, Gusset runs in your browser.");
      showMain(rel, os, data);
      showTable(rel);
    }).catch(function () {
      empty("The list of downloads could not be loaded. Reload this page, or use Gusset in your browser.");
    });
  }
  start();
})(typeof window === "object" ? window : this);
