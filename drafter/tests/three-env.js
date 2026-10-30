// three.js and its loaders (the vendor files the page loads) in a vm context of their
// own, for tests of the 3D code: { THREE, THREE_LOADERS }. No renderer: only the scene
// graph, the maths and the file parsers are used. rig() builds a small rigged body.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let env = null;
function three() {
  if (env) return env;
  const ctx = { console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, TextDecoder, TextEncoder, Uint8Array, Uint8ClampedArray, ArrayBuffer, DataView, Float32Array, Float64Array, Int32Array, Uint16Array,
    Uint32Array, Int16Array, Int8Array, performance, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} }, Blob,
    document: { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(v) {} }), createElement: () => ({ getContext: () => null, style: {} }) },
    navigator: { userAgent: "node" }, atob, btoa };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["three.min.js", "three-loaders.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "vendor", f), "utf8"), ctx, { filename: f });
  return (env = { THREE: ctx.THREE, THREE_LOADERS: ctx.THREE_LOADERS });
}

/* A rigged body of boxes, one box per bone, every corner of a box held by that bone
   alone. Millimetres, y up, facing +z, arms straight out (a T), 1700 tall.
   names(role) gives each bone its name, so the same body can be a L_UpperArm, Mixamo or Blender
   rig. opt.nest: each bone gets a copy of itself inside it, as FBX files loaded by
   three.js have. opt.scale: the whole file in another unit (0.001 = metres). */
const RIG = [                                    // role, parent, where the bone starts, the box it carries (centre offset, half size)
  ["pelvis", null, [0, 900, 0], [0, 0, 0], [150, 60, 90]],
  ["spine", "pelvis", [0, 960, 0], [0, 100, 0], [140, 100, 85]],
  ["chest", "spine", [0, 1160, 0], [0, 110, 0], [160, 110, 95]],
  ["neck", "chest", [0, 1380, 0], [0, 40, 0], [45, 40, 45]],
  ["head", "neck", [0, 1460, 0], [0, 120, 0], [85, 120, 95]],
  ["shoulderL", "chest", [40, 1340, 0], [70, 0, 0], [70, 30, 40]], ["armL", "shoulderL", [180, 1340, 0], [140, 0, 0], [140, 42, 42]],
  ["forearmL", "armL", [460, 1340, 0], [125, 0, 0], [125, 36, 36]], ["handL", "forearmL", [710, 1340, 0], [80, 0, 0], [80, 16, 40]],
  ["shoulderR", "chest", [-40, 1340, 0], [-70, 0, 0], [70, 30, 40]], ["armR", "shoulderR", [-180, 1340, 0], [-140, 0, 0], [140, 42, 42]],
  ["forearmR", "armR", [-460, 1340, 0], [-125, 0, 0], [125, 36, 36]], ["handR", "forearmR", [-710, 1340, 0], [-80, 0, 0], [80, 16, 40]],
  ["thighL", "pelvis", [90, 880, 0], [0, -210, 0], [70, 210, 75]], ["shinL", "thighL", [90, 460, 0], [0, -200, 0], [52, 200, 55]], ["footL", "shinL", [90, 60, 0], [0, -30, 50], [45, 30, 110]],
  ["thighR", "pelvis", [-90, 880, 0], [0, -210, 0], [70, 210, 75]], ["shinR", "thighR", [-90, 460, 0], [0, -200, 0], [52, 200, 55]], ["footR", "shinR", [-90, 60, 0], [0, -30, 50], [45, 30, 110]],
];
const RIG_NAMES = { pelvis: "Pelvis", spine: "Spine", chest: "Spine2", neck: "Neck", head: "Head", shoulderL: "L_Clavicle", armL: "L_UpperArm", forearmL: "L_LowerArm", handL: "L_Hand",
  shoulderR: "R_Clavicle", armR: "R_UpperArm", forearmR: "R_LowerArm", handR: "R_Hand", thighL: "L_UpperLeg", shinL: "L_LowerLeg", footL: "L_Foot", thighR: "R_UpperLeg", shinR: "R_LowerLeg", footR: "R_Foot" };
function rig(opt) {
  const { THREE } = three();
  opt = opt || {};
  const names = opt.names || RIG_NAMES, k = opt.scale || 1, bones = {}, list = [], pos = [], si = [], sw = [], idx = [];
  const root = new THREE.Group();
  for (const [role, parent, at, c, h] of RIG) {
    const b = new THREE.Bone(); b.name = names[role] || role;
    const pa = parent ? RIG.find(r => r[0] === parent)[2] : [0, 0, 0];
    b.position.set((at[0] - pa[0])*k, (at[1] - pa[1])*k, (at[2] - pa[2])*k);
    (parent ? bones[parent] : root).add(b);
    bones[role] = b; list.push(b);
    const base = pos.length/3, bi = list.length - 1;
    for (let v = 0; v < 8; v++) {
      pos.push((at[0] + c[0] + (v & 1 ? h[0] : -h[0]))*k, (at[1] + c[1] + (v & 2 ? h[1] : -h[1]))*k, (at[2] + c[2] + (v & 4 ? h[2] : -h[2]))*k);
      si.push(bi, 0, 0, 0); sw.push(1, 0, 0, 0);
    }
    for (const [a, bb, cc, d] of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) idx.push(base + a, base + bb, base + cc, base + a, base + cc, base + d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial()); mesh.name = "body";
  root.add(mesh); root.updateMatrixWorld(true);
  let skel = list;
  if (opt.nest) skel = list.map((b) => { const inner = new THREE.Bone(); inner.name = b.name; b.add(inner); return inner; });
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(skel));
  return { root, bones, mesh };
}
module.exports = { three, rig, RIG, RIG_NAMES };
