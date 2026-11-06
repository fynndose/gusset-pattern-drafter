/* What changes from one build to the next, in one place: the version (shown in Help ▸ About, in the desktop app's
   title bar, and in a bug report) and the link Help ▸ Send Feedback opens (a web form, or a mailto: address).
   desktop/package.json's "version" must be the same as the version here (drafter/tests/desktop-build.test.js).
   The desktop app reads this file as text and opens no other link than this one. A classic script, so a page opened
   from a file can read it. (Round r24 follow-up) The project's own address, never a person's (release check rule 15). */
var PDRAFT_CONFIG = {
  version: "1.0.0-beta.4",
  feedbackUrl: "mailto:feedback@gussetdrafter.com",
  downloadUrl: "https://gussetdrafter.com/download",      // (Round r28) where the update button sends the portable .exe and a Mac
};
if (typeof module === "object" && module.exports) module.exports = PDRAFT_CONFIG;
