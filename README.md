# Gusset – Pattern Drafter

**Gusset – Pattern Drafter** (Gusset for short) is a free program for drafting sewing patterns. It has a 2D window where the pattern is drawn and a 3D window where the pieces can be placed around an avatar and draped. Everything runs on your own machine: one HTML page and its scripts, no installation, no account, no cloud.

**[Download it or try it in your browser at gussetdrafter.com](https://gussetdrafter.com).** The rest of this page is for people who want to read or change the code.

<!-- SCREENSHOTS: PLACEHOLDER. Put two or three pictures here before publishing: the 2D window with a pattern, the 3D window with the avatar, the print layout. -->
> *Screenshots will go here.*

## Who it is for

- People who sew and want to draft or alter their own patterns and print them true to size.
- Pattern-making students who want a tool they can take apart.
- Developers who want a small, dependency-free code base for pattern geometry to build on.

It is not a production CAD system. See [Status](#status) before you rely on it.

## What it does

**Drafting**
- Polygons, rectangles, circles, internal lines and shapes, base and reference lines, guides.
- Curves either with handles or through curve points; lengths, offsets and angles can be typed.
- Add, move and delete points; extend, trim, split at intersections, merge, smooth a curve.
- Slash and spread, fullness, pleats; darts (add, rotate, fold, cap).
- Symmetric pieces that unfold about a line and stay in step; linked copies.
- A parametric straight skirt block as a starting point.

**Sewing and marking**
- Seams between any edges or internal lines (one to one, one to many, many to many, layered), with a length check; both lengths and their difference are written at the pointer. A seam can be deactivated: it stays in the pattern and the simulation leaves it out.
- Seam allowance per edge with a choice of corners, notches, topstitch, zippers.
- Grainlines, annotations, punch marks, pictures placed on a piece.

**Grading**
- Size groups and tables, with the nest shown on the pattern. The size run that comes with it is a placeholder.

**Output**
- Printing true to size, tiled over several sheets or fitted to one, with a 50 mm check line.
- A print layout with automatic nesting of the pieces on a width of cloth.
- DXF export and import (AAMA / ASTM style) and SVG export.

**3D window**
- Two preset avatars ("Marty" and "Jessica"), each with a skeleton: pose sliders, and arrangement points that wrap a piece around the body or a limb. Or your own `.fbx` / `.glb` / `.gltf`.
- Pieces placed around the body, sewn and draped by a cloth simulation; pins, folds, zipper tapes.
- A gizmo on the selected piece: arrows move it along one axis, rings turn it about one, the square in the middle moves it freely. A right-click while dragging takes a typed distance or angle.
- Measuring the avatar: girths and lengths.

**Workspace**
- Menu bar, dockable toolbars, an Object Browser and a Property Editor, a history timeline with undo that is saved in the file, recovery of unsaved work after a crash.
- A library of fabrics, buttons, buttonholes, topstitches, trims and zippers. The five fabric presets (Light woven, Medium woven, Heavy woven, Single jersey, Rib knit) are **approximate starting points**, not measured fabrics.

## Running it

### In a browser

Download or clone the repository and double-click `drafter/pattern-drafter.html`. That is all: there is nothing to install and nothing to build. A current Chrome, Edge or Firefox will do.

The 3D window starts empty: add an avatar with **Avatar → Load Avatar…**. Its two cards work from a double-clicked page and from a web server alike.

### As a desktop program

The desktop program is the same page in an Electron shell, with real file dialogs, a recent-files list and `.pdraft` files that open on a double-click. Ready-made programs for Windows, Macs (Apple chip and Intel) and Linux are on the [download page](https://gussetdrafter.com/download). To build one yourself:

```
cd desktop
npm install
npm start            # run from source
npm run dist         # this system's app, into desktop/dist/ (Windows: the portable .exe)
npm run dist:installer   # Windows: the installer
```

A build looks for updates at this repository. A fork sets its own source when building: `PDRAFT_UPDATE_SOURCE=github:<owner>/<repo>`, or `none` for a build that does not look.

The portable `.exe` (`Gusset-<version>-win-x64-portable.exe`) needs no installation: put it anywhere and start it. It keeps its settings, recent files and unsaved work in `%APPDATA%\Gusset` (`~/Library/Application Support/Gusset` on a Mac, `~/.config/Gusset` on Linux).

## The `.pdraft` file

A document is saved as a `.pdraft` file. It is a ZIP container, so any ZIP tool opens it, and what is in it can be read, compared and converted with ordinary tools:

- `document.json`: the document, plain JSON (UTF-8) with a version number; every object's keys are in alphabetical order, so the same document is always the same text
- `history.json`: the undo history, if it is kept
- `images/`: the pictures placed on patterns
- `drape.bin`: the points of the draped cloth (32-bit floats, x y z)

- Lengths are millimetres, y points down. The choice of mm, cm or inches only changes what is displayed.
- The file holds the pieces with their points, lines and curves, the seams, topstitches, guides and measurements, the grading tables, the library, the print layout, where each pattern is arranged in 3D, the simulation settings and the camera, and optionally the undo history and the draped cloth. Opened again, a document is as it was left.
- It notes which avatar the garment was draped on (its name, height and pose), not the avatar itself. Your own avatar goes into the file only if you choose **Avatar → Keep This Avatar in the Pattern File**.
- Files written by every earlier version (plain JSON, `.pdraft` or `.json`) still open; they are brought up to date when they are read. A version of the program from before the container cannot open the new files.

## Importing project files

**File → Import → Import .zprj / .zpac…** reads the 2D patterns (outlines, curves, internal lines, notches, seam allowances, grainlines, every size of a graded pattern, symmetric pairs as linked copies, the seams, and each pattern's fabric by name) out of a project file (`.zprj`) or a garment file (`.zpac`), so that you can go on working with your own files. File → Open and dropping the file on the window take them too. A pattern that cannot be read is skipped and named, and a value the file leaves out is given a default; the report after the import lists both. Not imported: the fabrics' physical properties and colors (a fabric comes in by its name, with a preset of ours by its kind), notch types, topstitches, zippers, trims and everything 3D. A file that is encrypted or protected is refused. The layout as far as it is known is described in [`docs/zprj-format.md`](docs/zprj-format.md).

DXF files in the AAMA / ASTM style can be imported and exported as well.

## Status

This is an early release by one person. It is usable for drafting and printing patterns, and it has a test suite of over a thousand tests, but:

- **The simulation is a proof of concept.** It shows roughly how a garment hangs. It is not accurate enough to judge fit.
- **The fabric presets, the size run and parts of the skirt block are placeholder values**, to be replaced by real ones.
- **DXF output has not been tried on a cutter.**
- **Printing true to size depends on printing at 100 %.** Measure the 50 mm check line on the first sheet.
- The `.zprj` import is known for files written in 2026 only.
- The desktop program is used every day on Windows only. The Mac and Linux builds are checked automatically, on build machines.

## Reporting a bug

Open an issue in this repository's issue tracker, or write to [feedback@gussetdrafter.com](mailto:feedback@gussetdrafter.com). It helps a great deal if you say:

1. what you did, step by step, and what you expected;
2. whether it was the browser (which one) or the desktop program, and the version;
3. and, if you can share it, attach the `.pdraft` file it happened with.

Please do not attach project files of other programs that are not your own to share.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). The short version: `node drafter/tests/run.js` must pass, and nothing from commercial pattern software may come in. This repository holds one commit per release, plus the website's list of downloads, which the release workflow keeps up to date.

## Contact

Questions, permission requests (the name and the logo: [`TRADEMARKS.md`](TRADEMARKS.md)): [contact@gussetdrafter.com](mailto:contact@gussetdrafter.com). Feedback on the program: Help ▸ Send Feedback, or [feedback@gussetdrafter.com](mailto:feedback@gussetdrafter.com).

## License

Copyright © 2026 The Gusset – Pattern Drafter authors

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. The full text is in [`LICENSE`](LICENSE).

What was made by others (three.js, the avatars' source material, the desktop runtime) and under which terms is listed in [`ATTRIBUTION.md`](ATTRIBUTION.md), and every shipped dependency's license in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

The license covers the code only. The logo and the app icon are not under it: all rights reserved. What you may do with them (talk about the program with the unchanged logo; a fork takes its own name and icon) is in [`TRADEMARKS.md`](TRADEMARKS.md).

The `.zprj` import exists only so that users can open their own files. Other names and file formats belong to their owners; this project is not affiliated with or endorsed by them.
