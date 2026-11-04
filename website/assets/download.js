/* The download page: reads downloads.json (written by the release workflow), works out the visitor's system and offers its
   file first; the system's other files are listed under it, each with a line on when to choose it. The pure parts (osOf,
   primaryOf, filesFor, buttonsFor, othersFor, sizeText, versionText) are tested in drafter/tests/r28.test.js and beta3.test.js. */
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

  // when to choose a file that is not the big button (1.0.0-beta.3: the portable starts slower, so the installer is the one offered)
  var WHY = {
    portable: "Starts slower (it unpacks itself each time). Use it if you can't install.",
    zip: "The same app as the disk image, in a .zip archive."
  };

  // the big buttons: the system's best file, and on a Mac the Intel disk image as well (a Mac's browser does not say which chip it has)
  function buttonsFor(rel, os) {
    var files = filesFor(rel, os), out = files.slice(0, 1);
    if (os === "mac") out = out.concat(files.filter(function (f) { return f.arch === "x64" && f.kind === "dmg" && out.indexOf(f) < 0; }).slice(0, 1));
    return out;
  }

  // the system's other files, each with its line
  function othersFor(rel, os) {
    var big = buttonsFor(rel, os);
    return filesFor(rel, os).filter(function (f) { return big.indexOf(f) < 0; }).map(function (f) { return { file: f, why: WHY[f.kind] || "" }; });
  }

  function sizeText(bytes) { return bytes ? Math.round(bytes / 1048576) + " MB" : ""; }
  function versionText(v) { return String(v || "").replace(/-(alpha|beta|rc)\.(\d+)$/, " $1 $2"); }
  function fileLabel(f) {
    return KIND[f.kind] + (f.os === "mac" ? (f.arch === "arm64" ? ", Apple chip" : ", Intel") : "");
  }

  if (typeof module === "object" && module.exports) { module.exports = { osOf: osOf, primaryOf: primaryOf, filesFor: filesFor, buttonsFor: buttonsFor, othersFor: othersFor, sizeText: sizeText, versionText: versionText }; return; }

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
    var main = el("dl-primary"), notes = el("dl-notes"), other = el("dl-other");
    main.textContent = ""; notes.textContent = ""; other.textContent = ""; other.hidden = true;
    var files = filesFor(rel, os);
    if (os === "phone") {
      main.append(make("p", {}, ["Gusset needs a computer with a mouse and a larger screen. Open this page on a Windows, Mac or Linux computer to download it."]));
    } else if (!os || !files.length) {
      main.append(make("p", {}, [os ? "There is no " + SYSTEMS[os] + " version of this release. The list below has what there is, and Gusset also runs in a browser." : "Pick your system from the list below."]));
    } else {
      var big = buttonsFor(rel, os);
      main.append(bigButton(big[0], rel));
      // (a Mac's browser does not say which chip it has: both are offered, by name)
      if (big[1]) main.append(make("a", { cls: "btn quiet", href: big[1].url }, ["Download for Mac with Intel", make("small", {}, [sizeText(big[1].size)])]));
      var rest = othersFor(rel, os);
      if (rest.length) {
        other.append(make("h2", {}, ["Other downloads for " + SYSTEMS[os]]), make("ul", { cls: "other" }, rest.map(function (o) {
          return make("li", {}, [make("a", { href: o.file.url }, [fileLabel(o.file)]), " (" + sizeText(o.file.size) + ")", o.why ? make("br") : "", o.why]);
        })));
        other.hidden = false;
      }
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
