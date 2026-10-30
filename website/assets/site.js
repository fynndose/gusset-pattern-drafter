/* The screenshot slots: a slot shows its dashed frame and the file it waits for until assets/shots/<file> is there. */
"use strict";
document.querySelectorAll(".slot img").forEach(function (img) {
  var fill = function () { img.closest(".slot").classList.add("filled"); };
  if (img.complete && img.naturalWidth) fill(); else img.addEventListener("load", fill);
});
