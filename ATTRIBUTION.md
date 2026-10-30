# Attribution

What in this project was made by others, and under which terms. The project itself is under the GNU General Public License, version 3 or any later version (`LICENSE`); everything below may be combined with it.

## Avatars

Marty and Jessica avatars: created by the Gusset – Pattern Drafter authors in Blender, based on the MakeHuman base mesh, underwear proxies and rig (MakeHuman system assets, CC0 1.0) via MPFB. No other third-party assets.

The avatars (`drafter/assets/avatar/presets/`) are covered by the project's license.

Where to look:

- MakeHuman: <http://www.makehumancommunity.org/>
- MPFB: <https://static.makehumancommunity.org/mpfb.html>

No avatar of any other origin is part of this project. An avatar you load yourself (`.fbx`, `.glb`) stays on your machine and is never copied into the project.

## Code

Every shipped dependency, with its version and license text, is in `THIRD-PARTY-NOTICES.md`. In short:

| What | Where | License |
|---|---|---|
| three.js r159 (the classic build) | `drafter/vendor/three.min.js` | MIT, `drafter/vendor/three.LICENSE.txt` |
| three-gpu-pathtracer 0.0.17 and three-mesh-bvh 0.7.0 (the Quality render) | `drafter/vendor/three-pathtracer.js` | MIT, `drafter/vendor/three-pathtracer.LICENSE.txt` |
| three.js r159 `FBXLoader` and `GLTFLoader` with what they import, and fflate | `drafter/vendor/three-loaders.js` (how it was bundled: `drafter/vendor/README.md`) | MIT (three.js authors; fflate © Arjun Barrett) |
| Electron (the desktop app's runtime; installed by `npm install`, not in this repository, and packed into the built app) | `desktop/package.json` | MIT. It contains Chromium and Node.js and their parts (BSD-style, MIT, Apache-2.0, LGPL and similar); the full list is `LICENSES.chromium.html` in the built app |
| electron-updater (the desktop app's update check: asks whether a newer version is out and, on the user's click, gets it; packed into the built app with what it needs) | `desktop/package.json` (`dependencies`) | MIT. What it needs is MIT, ISC, BlueOak-1.0.0 and Python-2.0: `THIRD-PARTY-NOTICES.md` |
| electron-builder (packs the desktop app; a build tool, no part of it is in the app except the self-extracting start-up program of the portable and installer files, NSIS, zlib/libpng license) | `desktop/package.json` | MIT |

## Other

- The colors of the Random Color rendering style are the color-blind-safe palette of Masataka Okabe and Kei Ito (*Color Universal Design*, 2002), which is free to use.
- The tool icons are this project's own line drawings (`drafter/drafter-tools.js`).
