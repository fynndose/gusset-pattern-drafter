# vendor

Third-party code the page loads. All of it is MIT licensed.

| File | What | License |
|---|---|---|
| `three.min.js` | three.js r159, the classic (non-module) build | MIT, `three.LICENSE.txt` |
| `three-pathtracer.js` | three-gpu-pathtracer 0.0.17 and three-mesh-bvh 0.7.0, with three.js r159's `FullScreenQuad`: the Render window's Quality mode (Round r23). Loaded only when Quality is chosen, never at the start | MIT (© Garrett Johnson), `three-pathtracer.LICENSE.txt` |
| `three-loaders.js` | three.js r159 `FBXLoader` and `GLTFLoader` with what they import (`NURBSCurve`, `BufferGeometryUtils`, and fflate for unpacking FBX data) | MIT (three.js authors; fflate © Arjun Barrett) |

## Why `three-loaders.js` is a bundle

three.js ships its loaders only as ES modules since r148. A page opened from a file (double-click, no server) cannot load modules, so the two loaders are bundled into one classic script that reads the global `THREE` and sets `THREE_LOADERS = { FBXLoader, GLTFLoader }`.

## How it was made

In an empty folder:

```
npm install three@0.159.0 esbuild
```

`three-global.js`: one line per export of three, `export const X = globalThis.THREE.X;` (generate the list from `Object.keys(require("three"))`).

`entry.js`:

```js
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
globalThis.THREE_LOADERS = { FBXLoader, GLTFLoader };
```

Bundle with esbuild (`bundle: true, format: "iife", minify: true, target: "es2019"`) and a resolve plugin that sends the bare import `three` (exactly that, not `three/examples/…`) to `three-global.js`. The loaders must match the three.js build beside them: rebuild both together.

## How `three-pathtracer.js` was made (Round r23)

The path tracer's npm build (`build/index.umd.cjs`) asks for three.js's `Pass.js` and `BufferGeometryUtils.js` on the global `THREE`, which the classic build lacks, and its `index.js` imports the UV unwrapper and its WebAssembly. So the four parts the Render window uses are bundled from the package's sources, with the same `three-global.js` as above:

```
npm install three@0.159.0 three-gpu-pathtracer@0.0.17 three-mesh-bvh@0.7.0 esbuild@0.19.12
```

`entry.js`:

```js
import { PathTracingRenderer } from "three-gpu-pathtracer/src/core/PathTracingRenderer.js";
import { PathTracingSceneGenerator } from "three-gpu-pathtracer/src/core/PathTracingSceneGenerator.js";
import { PhysicalPathTracingMaterial } from "three-gpu-pathtracer/src/materials/pathtracing/PhysicalPathTracingMaterial.js";
import { GradientEquirectTexture } from "three-gpu-pathtracer/src/textures/GradientEquirectTexture.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
globalThis.THREE_PATHTRACER = { PathTracingRenderer, PathTracingSceneGenerator, PhysicalPathTracingMaterial, GradientEquirectTexture, FullScreenQuad, version: "three-gpu-pathtracer 0.0.17, three-mesh-bvh 0.7.0" };
```

Bundled as `three-loaders.js` is (`bundle: true, format: "iife", minify: true, target: "es2019"`, the bare `three` sent to `three-global.js`); three-mesh-bvh is bundled in. A one-line comment naming both libraries and their license file is put before it. It needs WebGL 2 with float render targets; the page checks that before loading it.
