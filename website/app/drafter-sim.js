/* ================================================================
   drafter-sim.js: the mathematics of the 3D window
   Plain numbers and typed arrays: no page, no three.js, so all of it runs (and is
   tested) in Node as well as in the browser. The page reaches it as SIM3D.
   Millimetres, y up, as the 3D window.

   COLLISION BODY
     buildSDF(tris, opt)      a signed distance field of a triangle soup: a box of
                              samples `cell` apart, negative inside the body
     sdfSample(f, x, y, z, g) the distance at a place, and its gradient into g
     surfaceNets(f, iso)      the field's surface as a closed triangle mesh
   The avatar's skin is thousands of triangles; a piece of cloth asks "am I inside the
   body, and which way is out" for every particle many times a second. The field answers
   that in a handful of multiplications, and its surface is the simplified, closed
   collision mesh the Avatar menu can show.
   Further down: CLOTH MESH (patterns as triangles, and where they are in 3D).
   ================================================================ */
(function (root) {
'use strict';
// everything this file is, as one function: so that the same code can be run again inside a worker (see THE SOLVER IN A WORKER, at the end)
function make() {
const C = {};

/* ---------------- the signed distance field ---------------- */
// squared distance from point p to triangle abc; the closest point goes into q
function closestOnTri(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, q) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx*apx + aby*apy + abz*apz, d2 = acx*apx + acy*apy + acz*apz;
  let u, v;                                                   // closest = a + ab*u + ac*v
  if (d1 <= 0 && d2 <= 0) { u = 0; v = 0; }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx*bpx + aby*bpy + abz*bpz, d4 = acx*bpx + acy*bpy + acz*bpz;
    if (d3 >= 0 && d4 <= d3) { u = 1; v = 0; }
    else {
      const vc = d1*d4 - d3*d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { u = d1 / (d1 - d3); v = 0; }
      else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
        const d5 = abx*cpx + aby*cpy + abz*cpz, d6 = acx*cpx + acy*cpy + acz*cpz;
        if (d6 >= 0 && d5 <= d6) { u = 0; v = 1; }
        else {
          const vb = d5*d2 - d1*d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { u = 0; v = d2 / (d2 - d6); }
          else {
            const va = d3*d6 - d5*d4;
            if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 1 - w; v = w; }
            else { const den = 1 / (va + vb + vc); u = vb*den; v = vc*den; }
          }
        }
      }
    }
  }
  q[0] = ax + abx*u + acx*v; q[1] = ay + aby*u + acy*v; q[2] = az + abz*u + acz*v;
  const dx = px - q[0], dy = py - q[1], dz = pz - q[2];
  return dx*dx + dy*dy + dz*dz;
}
C.closestOnTri = closestOnTri;

/* tris: 9 numbers a triangle (world millimetres). opt: { cell (10), pad (3 cells of
   air round the body), band (2 cells: how far from the skin the distance is exact),
   maxNodes (the cell grows until the box has no more samples than this) }.
   Near the skin the distance is the exact distance to the nearest triangle. Its sign
   comes from that triangle's facing where the sample is next to the skin, and
   otherwise from a flood fill: what can be reached from the corner of the box without
   passing the skin is outside. Further out the distance is carried on from sample to
   sample (close enough: it only has to say "far"). */
C.buildSDF = function (tris, opt) {
  opt = opt || {};
  const nT = Math.floor(tris.length / 9);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < nT*9; i += 3) {
    const x = tris[i], y = tris[i+1], z = tris[i+2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  if (!nT || !isFinite(x0 + x1 + y0 + y1 + z0 + z1)) return null;
  let cell = opt.cell > 0 ? opt.cell : 10;
  const pad = opt.pad > 0 ? Math.round(opt.pad) : 3, band = opt.band > 0 ? Math.round(opt.band) : 2, maxN = opt.maxNodes > 0 ? opt.maxNodes : 4e6;
  let nx, ny, nz;
  for (;;) {
    nx = Math.ceil((x1 - x0)/cell) + 2*pad + 1; ny = Math.ceil((y1 - y0)/cell) + 2*pad + 1; nz = Math.ceil((z1 - z0)/cell) + 2*pad + 1;
    if (nx*ny*nz <= maxN) break;
    cell *= 1.2;
  }
  const ox = x0 - pad*cell, oy = y0 - pad*cell, oz = z0 - pad*cell, sxy = nx*ny, N = sxy*nz;
  const FAR = 1e18, d2 = new Float32Array(N).fill(FAR), sg = new Int8Array(N);
  const mx = nx - 1, my = ny - 1, mz = nz - 1, solid = new Uint8Array(mx*my*mz), q = [0, 0, 0], inv = 1/cell;
  const clampI = (v, hi) => v < 0 ? 0 : v > hi ? hi : v;
  for (let t = 0; t < nT; t++) {
    const o = t*9, ax = tris[o], ay = tris[o+1], az = tris[o+2], bx = tris[o+3], by = tris[o+4], bz = tris[o+5], cx = tris[o+6], cy = tris[o+7], cz = tris[o+8];
    const nxx = (by - ay)*(cz - az) - (bz - az)*(cy - ay), nyy = (bz - az)*(cx - ax) - (bx - ax)*(cz - az), nzz = (bx - ax)*(cy - ay) - (by - ay)*(cx - ax);
    if (nxx*nxx + nyy*nyy + nzz*nzz < 1e-18) continue;        // no area
    // the cells the triangle passes through: sampled finer than half a cell
    const e = Math.sqrt(Math.max((bx-ax)**2 + (by-ay)**2 + (bz-az)**2, (cx-ax)**2 + (cy-ay)**2 + (cz-az)**2, (cx-bx)**2 + (cy-by)**2 + (cz-bz)**2));
    const m = Math.max(1, Math.ceil(e*inv*2.5));
    for (let i = 0; i <= m; i++) for (let j = 0; j <= m - i; j++) {
      const u = i/m, v = j/m;
      const ci = clampI(Math.floor((ax + (bx-ax)*u + (cx-ax)*v - ox)*inv), mx - 1), cj = clampI(Math.floor((ay + (by-ay)*u + (cy-ay)*v - oy)*inv), my - 1), ck = clampI(Math.floor((az + (bz-az)*u + (cz-az)*v - oz)*inv), mz - 1);
      solid[ci + cj*mx + ck*mx*my] = 1;
    }
    // exact distance for the samples within `band` cells of it
    const i0 = clampI(Math.floor((Math.min(ax, bx, cx) - ox)*inv) - band + 1, nx - 1), i1 = clampI(Math.ceil((Math.max(ax, bx, cx) - ox)*inv) + band - 1, nx - 1);
    const j0 = clampI(Math.floor((Math.min(ay, by, cy) - oy)*inv) - band + 1, ny - 1), j1 = clampI(Math.ceil((Math.max(ay, by, cy) - oy)*inv) + band - 1, ny - 1);
    const k0 = clampI(Math.floor((Math.min(az, bz, cz) - oz)*inv) - band + 1, nz - 1), k1 = clampI(Math.ceil((Math.max(az, bz, cz) - oz)*inv) + band - 1, nz - 1);
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = ox + i*cell, py = oy + j*cell, pz = oz + k*cell, id = i + j*nx + k*sxy;
      const dd = closestOnTri(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, q);
      if (dd < d2[id]) { d2[id] = dd; sg[id] = (px - q[0])*nxx + (py - q[1])*nyy + (pz - q[2])*nzz >= 0 ? 1 : -1; }
    }
  }
  // flood the air from the corner of the box, cell to cell, never through a cell the skin is in
  const air = new Uint8Array(mx*my*mz), stack = new Int32Array(mx*my*mz);
  let top = 0;
  if (!solid[0]) { air[0] = 1; stack[top++] = 0; }
  const mxy = mx*my;
  while (top) {
    const c = stack[--top], ci = c % mx, cj = Math.floor(c / mx) % my, ck = Math.floor(c / mxy);
    if (ci > 0 && !air[c-1] && !solid[c-1]) { air[c-1] = 1; stack[top++] = c-1; }
    if (ci < mx-1 && !air[c+1] && !solid[c+1]) { air[c+1] = 1; stack[top++] = c+1; }
    if (cj > 0 && !air[c-mx] && !solid[c-mx]) { air[c-mx] = 1; stack[top++] = c-mx; }
    if (cj < my-1 && !air[c+mx] && !solid[c+mx]) { air[c+mx] = 1; stack[top++] = c+mx; }
    if (ck > 0 && !air[c-mxy] && !solid[c-mxy]) { air[c-mxy] = 1; stack[top++] = c-mxy; }
    if (ck < mz-1 && !air[c+mxy] && !solid[c+mxy]) { air[c+mxy] = 1; stack[top++] = c+mxy; }
  }
  // each sample's sign: beside the skin the nearest triangle's facing says; elsewhere the flood does
  const d = new Float32Array(N), sign = new Int8Array(N);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let touch = false, open = false;
    for (let c = 0; c < 8; c++) {
      const ci = i - (c & 1), cj = j - ((c >> 1) & 1), ck = k - ((c >> 2) & 1);
      if (ci < 0 || cj < 0 || ck < 0 || ci >= mx || cj >= my || ck >= mz) { open = true; continue; }
      const id = ci + cj*mx + ck*mxy;
      if (solid[id]) touch = true; else if (air[id]) open = true;
    }
    const id = i + j*nx + k*sxy;
    sign[id] = touch && sg[id] ? sg[id] : open ? 1 : -1;
    d[id] = d2[id] < FAR ? Math.sqrt(d2[id]) : 1e9;
  }
  // carry the distance on to the samples the band did not reach: two sweeps each way
  const W = [];
  for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (dk > 0 || (dk === 0 && (dj > 0 || (dj === 0 && di >= 0)))) continue;      // the 13 neighbours "before" a sample
    W.push([di, dj, dk, cell*Math.sqrt(di*di + dj*dj + dk*dk)]);
  }
  for (let pass = 0; pass < 2; pass++) for (let dir = 0; dir < 2; dir++) {
    const s = dir ? -1 : 1;
    for (let kk = 0; kk < nz; kk++) for (let jj = 0; jj < ny; jj++) for (let ii = 0; ii < nx; ii++) {
      const i = dir ? nx - 1 - ii : ii, j = dir ? ny - 1 - jj : jj, k = dir ? nz - 1 - kk : kk, id = i + j*nx + k*sxy;
      let best = d[id];
      for (let w = 0; w < 13; w++) {
        const ni = i + s*W[w][0], nj = j + s*W[w][1], nk = k + s*W[w][2];
        if (ni < 0 || nj < 0 || nk < 0 || ni >= nx || nj >= ny || nk >= nz) continue;
        const v = d[ni + nj*nx + nk*sxy] + W[w][3];
        if (v < best) best = v;
      }
      d[id] = best;
    }
  }
  for (let id = 0; id < N; id++) d[id] *= sign[id];
  return { nx, ny, nz, cell, ox, oy, oz, d, tris: nT };
};

/* The distance at a place (trilinear between the eight samples round it) and, into g,
   the direction it grows in (unit length where the field is smooth). Outside the box
   the distance to the box is added, so "far away" stays far. */
C.sdfSample = function (f, x, y, z, g) {
  let fx = (x - f.ox)/f.cell, fy = (y - f.oy)/f.cell, fz = (z - f.oz)/f.cell, out = 0, gx = 0, gy = 0, gz = 0;
  const hx = f.nx - 1.0001, hy = f.ny - 1.0001, hz = f.nz - 1.0001;
  if (fx < 0) { out += fx*fx; gx = -1; fx = 0; } else if (fx > hx) { out += (fx - hx)*(fx - hx); gx = 1; fx = hx; }
  if (fy < 0) { out += fy*fy; gy = -1; fy = 0; } else if (fy > hy) { out += (fy - hy)*(fy - hy); gy = 1; fy = hy; }
  if (fz < 0) { out += fz*fz; gz = -1; fz = 0; } else if (fz > hz) { out += (fz - hz)*(fz - hz); gz = 1; fz = hz; }
  const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), u = fx - i, v = fy - j, w = fz - k;
  const d = f.d, nx = f.nx, sxy = nx*f.ny, id = i + j*nx + k*sxy;
  const c000 = d[id], c100 = d[id+1], c010 = d[id+nx], c110 = d[id+nx+1], c001 = d[id+sxy], c101 = d[id+sxy+1], c011 = d[id+sxy+nx], c111 = d[id+sxy+nx+1];
  const c00 = c000 + (c100 - c000)*u, c10 = c010 + (c110 - c010)*u, c01 = c001 + (c101 - c001)*u, c11 = c011 + (c111 - c011)*u;
  const c0 = c00 + (c10 - c00)*v, c1 = c01 + (c11 - c01)*v;
  if (g) {
    if (out > 0) { const l = Math.hypot(gx, gy, gz) || 1; g[0] = gx/l; g[1] = gy/l; g[2] = gz/l; }
    else {
      const dx = ((c100 - c000)*(1-v) + (c110 - c010)*v)*(1-w) + ((c101 - c001)*(1-v) + (c111 - c011)*v)*w;
      const dy = (c10 - c00)*(1-w) + (c11 - c01)*w, dz = c1 - c0, l = Math.hypot(dx, dy, dz);
      if (l > 1e-9) { g[0] = dx/l; g[1] = dy/l; g[2] = dz/l; } else { g[0] = 0; g[1] = 1; g[2] = 0; }
    }
  }
  return c0 + (c1 - c0)*w + (out > 0 ? Math.sqrt(out)*f.cell : 0);
};
C.sdfAt = (f, x, y, z) => C.sdfSample(f, x, y, z, null);

/* The surface of the field (where it equals iso) as a triangle mesh: one corner in
   every cell the surface passes through, placed at the average of where it crosses
   that cell's edges, and a four-sided face round every sample-to-sample edge it
   crosses ("surface nets"). The field is positive all round the box, so the mesh is
   closed. -> { pos: Float32Array (xyz), idx: Uint32Array } with outward-facing triangles. */
C.surfaceNets = function (f, iso) {
  iso = iso || 0;
  const nx = f.nx, ny = f.ny, nz = f.nz, sxy = nx*ny, d = f.d, mx = nx - 1, my = ny - 1, mz = nz - 1, mxy = mx*my;
  const vid = new Int32Array(mx*my*mz).fill(-1), pos = [], idx = [];
  const CO = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]], ED = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]], val = new Float64Array(8);
  for (let k = 0; k < mz; k++) for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { val[c] = d[(i + CO[c][0]) + (j + CO[c][1])*nx + (k + CO[c][2])*sxy] - iso; if (val[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let e = 0; e < 12; e++) {
      const a = ED[e][0], b = ED[e][1];
      if ((val[a] < 0) === (val[b] < 0)) continue;
      const t = val[a]/(val[a] - val[b]);
      sx += CO[a][0] + (CO[b][0] - CO[a][0])*t; sy += CO[a][1] + (CO[b][1] - CO[a][1])*t; sz += CO[a][2] + (CO[b][2] - CO[a][2])*t; n++;
    }
    vid[i + j*mx + k*mxy] = pos.length/3;
    pos.push(f.ox + (i + sx/n)*f.cell, f.oy + (j + sy/n)*f.cell, f.oz + (k + sz/n)*f.cell);
  }
  const quad = (a, b, c, e, flip) => { if (a < 0 || b < 0 || c < 0 || e < 0) return; if (flip) idx.push(a, c, b, a, e, c); else idx.push(a, b, c, a, c, e); };
  const cellV = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= mx || j >= my || k >= mz) ? -1 : vid[i + j*mx + k*mxy];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v0 = d[i + j*nx + k*sxy] - iso, in0 = v0 < 0;
    if (i < nx-1 && in0 !== (d[i+1 + j*nx + k*sxy] - iso < 0)) quad(cellV(i, j-1, k-1), cellV(i, j, k-1), cellV(i, j, k), cellV(i, j-1, k), !in0);
    if (j < ny-1 && in0 !== (d[i + (j+1)*nx + k*sxy] - iso < 0)) quad(cellV(i-1, j, k-1), cellV(i-1, j, k), cellV(i, j, k), cellV(i, j, k-1), !in0);
    if (k < nz-1 && in0 !== (d[i + j*nx + (k+1)*sxy] - iso < 0)) quad(cellV(i-1, j-1, k), cellV(i, j-1, k), cellV(i, j, k), cellV(i-1, j, k), !in0);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
};
// the volume a closed mesh encloses (positive when its triangles face outward) and its area
C.meshVolume = function (pos, idx) {
  let v = 0, a = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const i = idx[t]*3, j = idx[t+1]*3, k = idx[t+2]*3;
    const ax = pos[i], ay = pos[i+1], az = pos[i+2], bx = pos[j], by = pos[j+1], bz = pos[j+2], cx = pos[k], cy = pos[k+1], cz = pos[k+2];
    v += (ax*(by*cz - bz*cy) + ay*(bz*cx - bx*cz) + az*(bx*cy - by*cx))/6;
    a += Math.hypot((by-ay)*(cz-az) - (bz-az)*(cy-ay), (bz-az)*(cx-ax) - (bx-ax)*(cz-az), (bx-ax)*(cy-ay) - (by-ay)*(cx-ax))/2;
  }
  return { volume: v, area: a };
};
// is the mesh closed: every edge is used as often one way as the other (no open border).
// Where the body nearly touches itself an edge can carry two sheets; that is still closed.
C.meshClosed = function (idx) {
  const m = new Map();
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = idx[t+e], b = idx[t+(e+1)%3], key = a < b ? a + "_" + b : b + "_" + a;
    m.set(key, (m.get(key) || 0) + (a < b ? 1 : -1));
  }
  for (const v of m.values()) if (v !== 0) return false;
  return m.size > 0;
};

/* ================================================================
   CLOTH MESH
     delaunay(xy)                 the Delaunay triangulation of points in the plane
     meshPolygon(loop, res, holes) a closed outline filled with even triangles, with holes cut out (Round r12 / 3)
     placeVerts(xy, c, p3, out)   the flat mesh put where a pattern is arranged in 3D
   A pattern becomes cloth by sampling its outline (the caller does that, so that every
   pattern point is a mesh point), filling the inside with a honeycomb of points `res`
   apart and triangulating the lot. The triangles are close to equilateral, which is
   what a cloth solver wants: no direction is stiffer than another.
   ================================================================ */
/* Bowyer and Watson's method, the points taken left to right so that triangles whose
   circle the sweep has passed are finished and need not be looked at again.
   xy: 2 numbers a point. -> Uint32Array, 3 point numbers a triangle. */
C.delaunay = function (xy) {
  const n = xy.length >> 1;
  if (n < 3) return new Uint32Array(0);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { const x = xy[2*i], y = xy[2*i+1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const span = Math.max(x1 - x0, y1 - y0, 1e-9), mx = (x0 + x1)/2, my = (y0 + y1)/2;
  const P = new Float64Array(2*(n + 3));
  P.set(xy.subarray ? xy.subarray(0, 2*n) : xy.slice(0, 2*n));
  P[2*n] = mx - 100*span; P[2*n+1] = my - 50*span; P[2*n+2] = mx; P[2*n+3] = my + 100*span; P[2*n+4] = mx + 100*span; P[2*n+5] = my - 50*span;      // a triangle round everything
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => P[2*a] - P[2*b] || P[2*a+1] - P[2*b+1]);
  // open triangles: corners and circle (centre, radius squared)
  let ta = [n], tb = [n+1], tc = [n+2], cx = [], cy = [], cr = [];
  const circle = (a, b, c) => {
    const ax = P[2*a], ay = P[2*a+1], bx = P[2*b] - ax, by = P[2*b+1] - ay, ux = P[2*c] - ax, uy = P[2*c+1] - ay, d = 2*(bx*uy - by*ux);
    if (Math.abs(d) < 1e-18) return [ax + (bx + ux)/2, ay + (by + uy)/2, Infinity];           // in a line: never finished, always replaced
    const b2 = bx*bx + by*by, u2 = ux*ux + uy*uy, px = (uy*b2 - by*u2)/d, py = (bx*u2 - ux*b2)/d;
    return [ax + px, ay + py, px*px + py*py];
  };
  { const c = circle(n, n+1, n+2); cx.push(c[0]); cy.push(c[1]); cr.push(c[2]); }
  const done = [], ea = [], eb = [];
  for (let s = 0; s < n; s++) {
    const p = order[s], px = P[2*p], py = P[2*p+1];
    ea.length = 0; eb.length = 0;
    let w = 0;
    for (let t = 0; t < ta.length; t++) {
      const dx = px - cx[t], dy = py - cy[t], r2 = cr[t];
      if (dx > 0 && dx*dx > r2*(1 + 1e-12) + 1e-18) { done.push(ta[t], tb[t], tc[t]); continue; }       // the sweep is past its circle
      if (dx*dx + dy*dy < r2*(1 - 1e-12)) { ea.push(ta[t], tb[t], tc[t]); eb.push(tb[t], tc[t], ta[t]); continue; }   // the point is in its circle: it goes
      ta[w] = ta[t]; tb[w] = tb[t]; tc[w] = tc[t]; cx[w] = cx[t]; cy[w] = cy[t]; cr[w] = cr[t]; w++;
    }
    ta.length = tb.length = tc.length = cx.length = cy.length = cr.length = w;
    // the edges of the hole: those that belonged to one removed triangle only
    const m = ea.length, seen = new Map();
    for (let e = 0; e < m; e++) { const a = ea[e], b = eb[e], k = a < b ? a*(n + 3) + b : b*(n + 3) + a; seen.set(k, (seen.get(k) || 0) + 1); }
    for (let e = 0; e < m; e++) {
      const a = ea[e], b = eb[e], k = a < b ? a*(n + 3) + b : b*(n + 3) + a;
      if (seen.get(k) !== 1) continue;
      const c = circle(a, b, p);
      ta.push(a); tb.push(b); tc.push(p); cx.push(c[0]); cy.push(c[1]); cr.push(c[2]);
    }
  }
  for (let t = 0; t < ta.length; t++) done.push(ta[t], tb[t], tc[t]);
  const out = [];
  for (let t = 0; t < done.length; t += 3) if (done[t] < n && done[t+1] < n && done[t+2] < n) out.push(done[t], done[t+1], done[t+2]);
  return new Uint32Array(out);
};
function inPoly(loop, x, y) {
  let c = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const xi = loop[i][0], yi = loop[i][1], xj = loop[j][0], yj = loop[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi)*(y - yi)/(yj - yi) + xi) c = !c;
  }
  return c;
}
C.inPoly = inPoly;
// the squared distance from (x, y) to an open line of points
function distToLine2(P, x, y) {
  let best = Infinity;
  for (let i = 0; i + 1 < P.length; i++) {
    const ax = P[i][0], ay = P[i][1], bx = P[i+1][0] - ax, by = P[i+1][1] - ay, l2 = bx*bx + by*by;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax)*bx + (y - ay)*by)/l2)) : 0, dx = x - ax - bx*t, dy = y - ay - by*t, d = dx*dx + dy*dy;
    if (d < best) best = d;
  }
  return best;
}
function distToLoop2(loop, x, y) {
  let best = Infinity;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const ax = loop[j][0], ay = loop[j][1], bx = loop[i][0] - ax, by = loop[i][1] - ay, l2 = bx*bx + by*by;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax)*bx + (y - ay)*by)/l2)) : 0, dx = x - ax - bx*t, dy = y - ay - by*t, d = dx*dx + dy*dy;
    if (d < best) best = d;
  }
  return best;
}
/* loop: the outline as [x, y] points in order (not repeated at the end), already
   sampled as finely as the cloth should be. res: how far apart the points inside are.
   -> { xy (2 a point), tri (3 a triangle, anticlockwise with y up, that is clockwise on
        the 2D window's y-down page), loop (the outline's points in order, as point
        numbers), src (for each of those, where it was on the outline given: i, or
        i + a fraction for a point this had to add between i and i + 1) }
   Every edge of the outline is an edge of a triangle: where the triangulation would cut
   a corner off (a narrow neck, the mouth of a dart), the outline edge is halved until
   it does not. Returns null for an outline that encloses nothing.
   holes (Round r12 / 3, optional): closed loops inside the outline, sampled as the outline is: their points are mesh
   points too (after the outline's, before the inside's), no point of the honeycomb lies in or close to one, and no
   triangle in one is kept. -> also holes: [Uint32Array of each hole's point numbers in order].
   lines (Round r14 / 2, optional): open lines inside the outline (fold lines), sampled as the outline is: their points are
   mesh points too (after the holes', before the inside's; a point too near the outline or an earlier line's point is left
   out), and no point of the honeycomb lies close to one, so the cloth has an edge from each of a line's points to the next. */
C.meshPolygon = function (loop, res, holes, lines) {
  if (!loop || loop.length < 3 || !(res > 0)) return null;
  const H = (holes || []).filter(h => h && h.length >= 3).map(h => h.map(p => [p[0], p[1]]));
  const near2 = (0.3*res)*(0.3*res), lp0 = [];
  for (const ln of lines || []) for (const q of ln || []) {
    if (!inPoly(loop, q[0], q[1]) || distToLoop2(loop, q[0], q[1]) < near2 || H.some(h => inPoly(h, q[0], q[1]) || distToLoop2(h, q[0], q[1]) < near2)) continue;
    if (lp0.some(o => (o[0] - q[0])**2 + (o[1] - q[1])**2 < near2)) continue;
    lp0.push([q[0], q[1]]);
  }
  const onLine = (x, y, k2) => (lines || []).some(ln => ln && ln.length > 1 && distToLine2(ln, x, y) < k2);
  const inHole = (x, y) => H.some(h => inPoly(h, x, y));
  let src = loop.map((p, i) => i), L = loop.map(p => [p[0], p[1]]);
  let area = 0;
  for (let i = 0, j = L.length - 1; i < L.length; j = i++) area += L[j][0]*L[i][1] - L[i][0]*L[j][1];
  if (Math.abs(area) < 1e-9) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of L) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  // the honeycomb inside: rows res·√3/2 apart, every other row shifted half a step, clear of the outline
  const inner = [], h = res*Math.sqrt(3)/2, keep = (0.62*res)*(0.62*res);
  for (let r = 0, y = y0 + h/2; y < y1; y += h, r++) for (let x = x0 + (r & 1 ? res/2 : 0) + res*0.25; x < x1; x += res) {
    // a hair off the exact honeycomb, the same every time: four points on one circle have no single triangulation
    const jx = x + res*1e-3*Math.sin(12.9898*r + 78.233*x), jy = y + res*1e-3*Math.sin(39.346*r + 11.135*x);
    if (inPoly(L, jx, jy) && distToLoop2(L, jx, jy) > keep && !inHole(jx, jy) && H.every(h => distToLoop2(h, jx, jy) > keep) && !onLine(jx, jy, keep)) inner.push(jx, jy);
  }
  let xy, tri, nb;
  for (let round = 0; round < 8; round++) {
    nb = L.length;
    const hp = []; for (const h of H) for (const p of h) hp.push(p[0], p[1]);
    for (const p of lp0) hp.push(p[0], p[1]);
    xy = new Float64Array(2*nb + hp.length + inner.length);
    for (let i = 0; i < nb; i++) { xy[2*i] = L[i][0]; xy[2*i+1] = L[i][1]; }
    xy.set(hp, 2*nb); xy.set(inner, 2*nb + hp.length);
    const all = C.delaunay(xy), keepT = [], edges = new Set(), N = xy.length/2;
    for (let t = 0; t < all.length; t += 3) {
      const a = all[t], b = all[t+1], c = all[t+2];
      const gx = (xy[2*a] + xy[2*b] + xy[2*c])/3, gy = (xy[2*a+1] + xy[2*b+1] + xy[2*c+1])/3;
      if (!inPoly(L, gx, gy) || inHole(gx, gy)) continue;
      // anticlockwise with y up
      const s = (xy[2*b] - xy[2*a])*(xy[2*c+1] - xy[2*a+1]) - (xy[2*c] - xy[2*a])*(xy[2*b+1] - xy[2*a+1]);
      if (Math.abs(s) < 1e-12) continue;
      if (s < 0) keepT.push(a, b, c); else keepT.push(a, c, b);
      edges.add(a < b ? a*N + b : b*N + a); edges.add(b < c ? b*N + c : c*N + b); edges.add(a < c ? a*N + c : c*N + a);
    }
    tri = new Uint32Array(keepT);
    const miss = [];
    for (let i = 0; i < nb; i++) { const j = (i + 1) % nb; if (!edges.has(i < j ? i*N + j : j*N + i)) miss.push(i); }
    if (!miss.length || round === 7) break;
    // halve the outline edges that are missing, from the back so the numbers before stay right
    for (let k = miss.length - 1; k >= 0; k--) {
      const i = miss[k], j = (i + 1) % L.length, sj = j === 0 ? Math.floor(src[i]) + 1 : src[j];
      L.splice(i + 1, 0, [(L[i][0] + L[j][0])/2, (L[i][1] + L[j][1])/2]);
      src.splice(i + 1, 0, (src[i] + sj)/2);
    }
  }
  const lp = new Uint32Array(nb);
  for (let i = 0; i < nb; i++) lp[i] = i;
  const hl = []; let k0 = nb;
  for (const h of H) { hl.push(Uint32Array.from(h, (_, j) => k0 + j)); k0 += h.length; }
  return { xy, tri, loop: lp, src: Float64Array.from(src), holes: hl };
};
// the shape of a triangle: 1 for equilateral, towards 0 for a sliver (4·√3·area / sum of squared sides)
C.triQuality = function (xy, tri) {
  let min = 1, sum = 0;
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t], b = tri[t+1], c = tri[t+2], ax = xy[2*a], ay = xy[2*a+1], bx = xy[2*b], by = xy[2*b+1], cx = xy[2*c], cy = xy[2*c+1];
    const ar = Math.abs((bx - ax)*(cy - ay) - (cx - ax)*(by - ay))/2, q = 4*Math.sqrt(3)*ar/((bx-ax)**2 + (by-ay)**2 + (cx-bx)**2 + (cy-by)**2 + (ax-cx)**2 + (ay-cy)**2);
    if (q < min) min = q; sum += q;
  }
  return { min, mean: tri.length ? sum/(tri.length/3) : 0 };
};
C.triArea2D = function (xy, tri) {
  let s = 0;
  for (let t = 0; t < tri.length; t += 3) { const a = tri[t], b = tri[t+1], c = tri[t+2]; s += Math.abs((xy[2*b] - xy[2*a])*(xy[2*c+1] - xy[2*a+1]) - (xy[2*c] - xy[2*a])*(xy[2*b+1] - xy[2*a+1]))/2; }
  return s;
};

/* ---------------- where a flat pattern is in 3D ----------------
   A placement p3 = { pos: [x, y, z], q: [x, y, z, w], r }.
   A pattern's own axes: u to the right of the 2D page, v up the page (2D y is down),
   measured from c, the middle of its box. q turns (u, v, outward) into the world: the
   pattern's face looks along "outward". pos is where c goes.
   r = 0: flat. r > 0: wrapped round a cylinder of that radius whose axis runs along v,
   r behind pos: that is "curved to the body". Lengths along the cloth stay as drawn. */
function qRot(q, x, y, z, o) {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const ix = qw*x + qy*z - qz*y, iy = qw*y + qz*x - qx*z, iz = qw*z + qx*y - qy*x, iw = -qx*x - qy*y - qz*z;
  o[0] = ix*qw + iw*-qx + iy*-qz - iz*-qy; o[1] = iy*qw + iw*-qy + iz*-qx - ix*-qz; o[2] = iz*qw + iw*-qz + ix*-qy - iy*-qx;
  return o;
}
C.qRot = qRot;
// the quaternion whose turn takes x, y, z to the three unit vectors given (which must be square to each other, right-handed)
C.qFromBasis = function (ex, ey, ez) {
  const m00 = ex[0], m10 = ex[1], m20 = ex[2], m01 = ey[0], m11 = ey[1], m21 = ey[2], m02 = ez[0], m12 = ez[1], m22 = ez[2], tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) { const s = 0.5/Math.sqrt(tr + 1); w = 0.25/s; x = (m21 - m12)*s; y = (m02 - m20)*s; z = (m10 - m01)*s; }
  else if (m00 > m11 && m00 > m22) { const s = 2*Math.sqrt(1 + m00 - m11 - m22); w = (m21 - m12)/s; x = 0.25*s; y = (m01 + m10)/s; z = (m02 + m20)/s; }
  else if (m11 > m22) { const s = 2*Math.sqrt(1 + m11 - m00 - m22); w = (m02 - m20)/s; x = (m01 + m10)/s; y = 0.25*s; z = (m12 + m21)/s; }
  else { const s = 2*Math.sqrt(1 + m22 - m00 - m11); w = (m10 - m01)/s; x = (m02 + m20)/s; y = (m12 + m21)/s; z = 0.25*s; }
  const l = Math.hypot(x, y, z, w) || 1;
  return [x/l, y/l, z/l, w/l];
};
C.qMul = (a, b) => [a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1], a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0], a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3], a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
C.qAxis = (ax, deg) => { const h = deg*Math.PI/360, s = Math.sin(h), l = Math.hypot(ax[0], ax[1], ax[2]) || 1; return [ax[0]/l*s, ax[1]/l*s, ax[2]/l*s, Math.cos(h)]; };
// one point of the pattern (x, y on the 2D page) in the world
C.placePoint = function (x, y, c, p3, o) {
  const u = x - c[0], v = -(y - c[1]), r = p3.r > 0 ? p3.r : 0;
  if (r) { const a = u/r; qRot(p3.q, r*Math.sin(a), v, r*Math.cos(a) - r, o); }
  else qRot(p3.q, u, v, 0, o);
  o[0] += p3.pos[0]; o[1] += p3.pos[1]; o[2] += p3.pos[2];
  return o;
};
// every point of a flat mesh: out gets 3 numbers a point
C.placeVerts = function (xy, c, p3, out) {
  const n = xy.length >> 1, o = [0, 0, 0];
  out = out || new Float32Array(3*n);
  for (let i = 0; i < n; i++) { C.placePoint(xy[2*i], xy[2*i+1], c, p3, o); out[3*i] = o[0]; out[3*i+1] = o[1]; out[3*i+2] = o[2]; }
  return out;
};
/* How far the body reaches from a point on an axis, looking along a direction: marching
   out through the field until it is outside for good (a gap of `gap` mm of air). 0 if
   the start is not in the body at all. */
C.bodyReach = function (f, ax, ay, az, dx, dy, dz, max, gap) {
  const g = null, step = Math.max(2, f.cell/2);
  max = max || 600; gap = gap === undefined ? 0 : gap;
  let last = 0, inside = false, air = 0;
  for (let t = 0; t <= max; t += step) {
    const d = C.sdfSample(f, ax + dx*t, ay + dy*t, az + dz*t, g);
    if (d < 0) { inside = true; last = t - d; air = 0; }            // inside: the skin is at least this much further
    else if (inside) { air += step; if (air > gap) break; }
  }
  return inside ? last : 0;
};

/* ================================================================
   CLOTH SIMULATION (XPBD, "small steps")
     clothBuild(spec)        cloth ready to simulate
     clothStep(sim, dt)      one frame: `substeps` small steps of dt / substeps
     seamPath(), seamPairs() the two sides of a seam as matching points
   Units: millimetres, seconds, grams. Each cloth point (particle) has a mass from the
   fabric's weight and the cloth round it. A small step lets gravity move the points,
   then puts right, one after another:
     stretch   every triangle edge keeps its length on the flat pattern
     bend      across every inner edge, the two far corners keep their distance
     drag      the place the pointer holds is pulled towards it by a spring whose force is
               limited (clothDrag), so the cloth round it, and whatever is sewn to it, follows
     seams     matched points of the two sides are pulled together
     self      points of cloth keep `selfDist` apart (basic: point against point)
     limit     no edge is longer than its fabric's maxStretch allows (strain limiting)
     body      a point inside the avatar's skin (the distance field) is pushed out
     ground    nothing goes below the floor
     seams     once more, last: a seam that has closed is held shut exactly (Round r9 / 3)
   Seams have no softness and are put right last in every small step: what does not fit
   (a pattern too small for the body, a pull on one piece) goes into the fabric's stretch,
   never into a gap in a seam. A seam that has not yet closed (patterns arranged apart)
   closes no faster than maxPull a small step; once its gap has been under seamClose it is
   held shut from then on.
   Each of these is a constraint with a compliance (softness, 1 / stiffness): 0 is rigid.
   Velocities are what the positions did in the step. This is position based dynamics
   in Macklin and Müller's extended form; it cannot blow up, which matters more here
   than accuracy: this is a proof of concept to see a garment hang, not a fitting tool.
   How stiff the cloth really is depends on the number of small steps: with too few a
   waistband stretches under the garment's weight and slides over the hips. 20 a frame
   holds a skirt up; fewer is faster and stretchier.
   ================================================================ */
/* spec = {
     pieces: [{ xy, tri, X, fab: { weight g/m2, stretch, bend, friction, thick }, layer, fill, zones? }]
     zones (REC-SHORT: Seamless Blocking's sections): { t: [a fabric's index in fabs for each triangle, -1 for the pattern's own],
               fabs: [fab, …] }: a triangle's mass, its edges' stretch, bending and limit, its points' friction and thickness from
               its own fabric (an edge between two fabrics takes the mean of their compliances)
             fill: 0 to 100, how full of filling the pattern is (Round r9 / 7): see FILL below
             folds (Round r14 / 2, optional): the pattern's fold lines, see FOLD LINES below
             elastics (Round r14 / 3, optional): [{ i: [mesh points along the line, in order], r: % of its length, k: stiffness }]
             ghost (Round r14 / 6, optional): true = no other cloth collides with it (a deactivated pattern; it is pinned as well)
             shape3 (Round build-1, optional): true = it rests in the 3D shape X it has now, not flat (a solidified pattern)
             shrink (Round build-1, optional): { g: [the grain's direction on xy], warp, weft }: its rest lengths along the grain
               times warp and across it times weft (Simulation Shrinkage; 1 = as cut)
             xy: the flat mesh (2 a point), X: where its points are now (3 a point)
     seams:  [{ id, k, pairs: [[A, B], …] }]  A, B anchors { p: piece number, i: [points], w: [weights] }
     pins:   [{ p, v }]  points held where they are
     holds:  [{ a: anchor, to: [x, y, z] }]  a place of the cloth held at a point of the world, as a seam holds
             (a tack on the avatar, Round r9 / 5): closed at no more than maxPull a step, then held there
     field:  the body's distance field, or null
     opt:    { substeps 20, stretchIters 2, gravity 9810, easeIn 45 (frames), damping 2.5 (1/s), selfDist, selfMin 2.5 (mm: selfDist is never less, Round r15 / 8), self true, ground true, maxPull 6, seamSlip 3 (mm: a seam open by more slides on the body),
               seamClose 1 (mm: a seam once closed this far is held shut), seamIters 2, interleave true (a seam pass after each stretch pass), limitEach true (the strain limit after each stretch pass as well),
               dragK 2e5 (g/s², the drag spring; Round r31 / 3: 5e4 held cloth on a level body 45 mm along a 60 mm pull, which felt
               glued), dragMax 3e6 (g·mm/s², the most it pulls, all its points together: 3 N; Round r33b / 1, was 1 N on one point,
               where 3 N stretched a woven strip past its Max Stretch: spread over the reach it does not), dragReach 100 (mm, the cloth
               the pull takes, Round r33b / 1; 0: one place), dragSlide 0.2 (the friction of the cloth held, as a share of its own),
               dragPin true (REC-SHORT, the sixth check session 13:59-15:09: the place grabbed is held at the pointer exactly, a pin
               that moves; the handful round it still follows on its springs), dragLimitIters 0 (REC-SHORT: while held the pulled
               pattern's cloth may stretch past its Max Stretch, as the reference's spike shows; Round r33b had 12 more passes of it),
               dragRelease 120 (REC-SHORT: frames after letting go during which the cloth that was held still slides, so it springs
               back to where it hangs; the reference's "took itself exactly back again"),
               bodyStatic / bodyKinetic (Round r31 / 3): the body's own friction, static and kinetic, in place of the fabric's
               one coefficient; null (the default): the fabric's for both. The reference's avatar has 0.80 / 0.05, but in this
               solver cloth still settling counts as sliding, and at 0.05 a tube on the hips sank 186 mm (cloth.test.js),
               sdfSkip true (Round r10 / 7: the body's field is not looked up where a point cannot have reached the body; the same answer),
               seamBend 5 (Round r11 / 1: bending across each closed stitch, this many times the softer fabric's bending; 0: none, a seam is a free hinge),
               seamRamp 0, seamSoft 1e-3 (Round r11 / 1, tried and left off: seams soft for the first seamRamp frames, compliance seamSoft falling to none) } }
   fab.maxStretch: the most an edge may stretch, as a fraction (0.1 = 10 %); none or 0: no limit
   spec.masses: [{ a: anchor, m: grams }], weights hung on the cloth (buttons, Round r10 / 5)
   spec.rods: [{ a: [anchor, …], m: grams a node, k: bending stiffness, ks: stretch stiffness, lim: the most it may stretch (a
             fraction, 0: no limit), S: [rest length from node j to j+1, …], L: [rest length from node j to j+2, …] }]: a cord or
             a strip lying along a line of the cloth (piping, binding: Round r11 / 3, 4). Its weight hangs on the cloth at its
             nodes; it keeps its length (to its limit) and resists bending, node to node and over every other node. */
C.clothBuild = function (spec) {
  const opt = Object.assign({ substeps: 20, stretchIters: 2, gravity: 9810, easeIn: 45, damping: 2.5, self: true, ground: true, maxPull: 6, seamSlip: 3, maxSpeed: 5000, seamClose: 1, seamIters: 2, interleave: true, limitEach: true, dragK: 2e5, dragMax: 2e6, dragReach: 100, dragSlide: 0.2, dragSlideReach: 300, dragLimitIters: 0, dragPin: true, dragRelease: 120, sdfSkip: true, bodyStatic: null, bodyKinetic: 0.05, seamRamp: 0, seamSoft: 1e-3, seamBend: 5 }, spec.opt || {});
  const off = [];
  let n = 0;
  for (const pc of spec.pieces) { off.push(n); n += pc.xy.length >> 1; }
  const x = new Float64Array(3*n), p = new Float64Array(3*n), v = new Float64Array(3*n), w = new Float64Array(n), mass = new Float64Array(n);
  const rest = new Float64Array(2*n), piece = new Int32Array(n), thick = new Float64Array(n), fric = new Float64Array(n);
  const eI = [], eJ = [], eL = [], eA = [], eM = [], bI = [], bJ = [], bL = [], bA = [], bnd = [], bendK = new Float64Array(n), fQ = [], fB = [], fK = [];
  const eF = [], bF = [];        // (Round build-1) the flat rest lengths beside eL / bL, which Simulation Shrinkage eases away from (SHRINK_EASE)
  let res = 0, resN = 0;
  spec.pieces.forEach((pc, k) => {
    const o = off[k], m = pc.xy.length >> 1, f = pc.fab || {};
    // a fabric's numbers, with the solver's own defaults (REC-SHORT: per section, zones)
    const num = (g) => ({ dens: (g.weight > 0 ? g.weight : 150)*1e-6, ks: g.stretch > 0 ? g.stretch : 3e5, kb: g.bend > 0 ? g.bend : 30, ms: g.maxStretch > 0 ? 1 + g.maxStretch : 0,
      th: (g.thick > 0 ? g.thick : 2.5) + (pc.layer || 0)*1.5, fr: g.friction >= 0 ? g.friction : 0.3 });
    const F0 = num(f), { dens, ks, kb, ms } = F0;
    const zt = pc.zones && Array.isArray(pc.zones.fabs) && pc.zones.fabs.length && pc.zones.t ? pc.zones.t : null, ZF = zt ? pc.zones.fabs.map(num) : null;
    const zf = (t) => { const z = zt ? zt[t] : -1; return z >= 0 && ZF[z] ? ZF[z] : F0; };       // triangle t's (its index /3) numbers
    for (let i = 0; i < m; i++) {
      x[3*(o+i)] = pc.X[3*i]; x[3*(o+i)+1] = pc.X[3*i+1]; x[3*(o+i)+2] = pc.X[3*i+2];
      rest[2*(o+i)] = pc.xy[2*i]; rest[2*(o+i)+1] = pc.xy[2*i+1];
      piece[o+i] = k; thick[o+i] = F0.th; fric[o+i] = F0.fr;
    }
    // edges, each with the corner(s) across it (and, with zones, the fabric of each triangle beside it)
    const E = new Map(), T = pc.tri, EZ = zt ? new Map() : null;
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t], b = T[t+1], c = T[t+2], g = zf(t/3);
      const ar = Math.abs((pc.xy[2*b] - pc.xy[2*a])*(pc.xy[2*c+1] - pc.xy[2*a+1]) - (pc.xy[2*c] - pc.xy[2*a])*(pc.xy[2*b+1] - pc.xy[2*a+1]))/2;
      mass[o+a] += ar*g.dens/3; mass[o+b] += ar*g.dens/3; mass[o+c] += ar*g.dens/3;
      if (g !== F0) for (const u of [a, b, c]) { thick[o+u] = g.th; fric[o+u] = g.fr; }        // a section's point: its fabric's surface
      for (const [u, q, r] of [[a, b, c], [b, c, a], [c, a, b]]) { const key = u < q ? u*m + q : q*m + u, e = E.get(key); if (e) e.push(r); else E.set(key, [u, q, r]); if (EZ) (EZ.get(key) || (EZ.set(key, []), EZ.get(key))).push(g); }
    }
    // an edge's numbers: its triangles' fabric, the mean compliance where two meet
    const ez = (e) => { if (!EZ) return F0; const z = EZ.get(e[0] < e[1] ? e[0]*m + e[1] : e[1]*m + e[0]); if (!z || z.length < 2 || z[0] === z[1]) return z ? z[0] : F0;
      return { ks: 2/(1/z[0].ks + 1/z[1].ks), kb: 2/(1/z[0].kb + 1/z[1].kb), ms: z[0].ms && z[1].ms ? (z[0].ms + z[1].ms)/2 : 0 }; };
    // (Round build-1) the rest of the cloth: its flat pattern, or with shape3 (Solidify) the 3D shape it has when the solver is
    // built, so it holds that shape; with shrink { g: [grain x, y], warp, weft } (Simulation Shrinkage, 1 = none) every length
    // along the grain times warp and across it times weft
    const sh = pc.shrink && Array.isArray(pc.shrink.g) && (pc.shrink.warp !== 1 || pc.shrink.weft !== 1) ? pc.shrink : null;
    const gx = sh ? sh.g[0]/(Math.hypot(sh.g[0], sh.g[1]) || 1) : 0, gy = sh ? sh.g[1]/(Math.hypot(sh.g[0], sh.g[1]) || 1) : 0;
    const d2 = pc.shape3 ? (a, b) => Math.hypot(pc.X[3*a] - pc.X[3*b], pc.X[3*a+1] - pc.X[3*b+1], pc.X[3*a+2] - pc.X[3*b+2])
      : sh ? (a, b) => { const dx = pc.xy[2*a] - pc.xy[2*b], dy = pc.xy[2*a+1] - pc.xy[2*b+1], al = dx*gx + dy*gy, ac = dx*gy - dy*gx; return Math.hypot(al*sh.warp, ac*sh.weft); }
      : (a, b) => Math.hypot(pc.xy[2*a] - pc.xy[2*b], pc.xy[2*a+1] - pc.xy[2*b+1]);
    const dF = sh ? (a, b) => Math.hypot(pc.xy[2*a] - pc.xy[2*b], pc.xy[2*a+1] - pc.xy[2*b+1]) : d2;
    const folds = Array.isArray(pc.folds) ? pc.folds.filter(f => f && Array.isArray(f.L) && f.L.length > 1) : [];
    const fm = folds.length ? foldMap(pc.xy, folds) : null;
    // (Round r14 / 3) elastics: the cloth's edges along an elastic line are the elastic, ratio r % of their length long and
    // as stiff as the elastic is, so the cloth beside them is drawn in
    const ex = new Map();
    for (const el of pc.elastics || []) if (el && Array.isArray(el.i) && el.r > 0 && el.k > 0) for (let j = 0; j + 1 < el.i.length; j++) { const u = el.i[j], q = el.i[j+1]; if (u !== q) ex.set(u < q ? u*m + q : q*m + u, el); }
    for (const e of E.values()) {
      const L = d2(e[0], e[1]), el = ex.size ? ex.get(e[0] < e[1] ? e[0]*m + e[1] : e[1]*m + e[0]) : null, Le = el ? L*el.r/100 : L;
      const { ks, kb, ms } = ez(e);
      eI.push(o + e[0]); eJ.push(o + e[1]); eL.push(Le); eA.push(1/(el ? el.k : ks)); eM.push(ms ? Le*ms : 0); res += L; resN++;
      eF.push(sh ? dF(e[0], e[1])*(el ? el.r/100 : 1) : Le);
      if (e.length === 4) {
        // (Round r14 / 2) the pair across an edge of a fold line keeps the distance it has with the cloth folded there
        const fd = fm ? foldAt(pc.xy, e[0], e[1], e[2], e[3], folds, fm) : null;
        bI.push(o + e[2]); bJ.push(o + e[3]); bL.push(fd ? fd.L : d2(e[2], e[3])); bA.push(1/(fd ? Math.max(kb, fd.k) : kb)); bF.push(fd ? fd.L : dF(e[2], e[3]));
        if (fd) { fQ.push(o + e[0], o + e[1], o + e[2], o + e[3]); fB.push(fd.b0); fK.push(Math.max(kb, fd.k)*fd.lever*fd.lever); }      // its stiffness in the angle: the bending's, times the lever squared
      }
      else for (const [u, q] of [[e[0], e[1]], [e[1], e[0]]]) (bnd[o + u] || (bnd[o + u] = [])).push(o + q, o + e[2]);   // a border edge: its other end and the corner across it
    }
    for (let i = 0; i < m; i++) bendK[o + i] = kb;
  });
  // (Round r10 / 5) a weight hung on the cloth, a button's: its mass shared out on the points of its triangle by its place there
  for (const am of spec.masses || []) if (am && am.a && am.m > 0) for (let k = 0; k < am.a.i.length; k++) { const i = off[am.a.p] + am.a.i[k]; if (i < n) mass[i] += am.m*am.a.w[k]; }
  // (Round r11 / 3) rods: their nodes, their weight on the cloth, and their links (stretch j to j+1, bend j to j+2)
  const rN = [], rW = [], rI = [], rJ = [], rL = [], rA = [], rM = [];
  for (const rd of spec.rods || []) {
    if (!rd || !Array.isArray(rd.a) || rd.a.length < 2) continue;
    const base = rN.length/3;
    for (const an of rd.a) for (let k = 0; k < 3; k++) { rN.push(an && k < an.i.length ? off[an.p] + an.i[k] : -1); rW.push(an && k < an.i.length ? an.w[k] : 0); }
    for (const an of rd.a) if (an && rd.m > 0) for (let k = 0; k < an.i.length; k++) { const i = off[an.p] + an.i[k]; if (i < n) mass[i] += rd.m*an.w[k]; }
    for (let j = 0; j + 1 < rd.a.length; j++) if (rd.S && rd.S[j] > 0) { rI.push(base + j); rJ.push(base + j + 1); rL.push(rd.S[j]); rA.push(1/(rd.ks > 0 ? rd.ks : 1e6)); rM.push(rd.lim > 0 ? rd.S[j]*(1 + rd.lim) : 0); }
    for (let j = 0; j + 2 < rd.a.length; j++) if (rd.L && rd.L[j] > 0) { rI.push(base + j); rJ.push(base + j + 2); rL.push(rd.L[j]); rA.push(1/(rd.k > 0 ? rd.k : 1e3)); rM.push(0); }
  }
  for (let i = 0; i < n; i++) w[i] = mass[i] > 0 ? 1/mass[i] : 0;
  res = resN ? res/resN : 20;
  // seams: up to three points a side
  const sIdx = [], sW = [], sA = [], sOf = [], sBend = [], sFold = [], noHit = new Set();
  (spec.seams || []).forEach((sm, si) => {
    sBend[si] = sm.bend > 0 ? sm.bend : 1;                       // (Round r11 / 5) a seam's own factor on the bending across it: a glued seam's is 2
    sFold[si] = sm.fold && Number.isFinite(sm.fold.a) ? sm.fold : null;      // (Round r14 / 5) a seam's fold
    for (const [A, B] of sm.pairs) {
      const ia = [], wa = [];
      for (const [an, sign] of [[A, 1], [B, -1]]) for (let k = 0; k < 3; k++) { ia.push(k < an.i.length ? off[an.p] + an.i[k] : -1); wa.push(k < an.i.length ? sign*an.w[k] : 0); }
      // no softness: a seam holds (Round r9 / 3); (Round build-1) a glue of Strength below 1 has a compliance, sm.soft (mm/N)
      sIdx.push(...ia); sW.push(...wa); sA.push(sm.soft > 0 && Number.isFinite(sm.soft) ? sm.soft : 0); sOf.push(si);
      // points that are sewn to each other must be able to meet
      for (let a = 0; a < 3; a++) for (let b = 3; b < 6; b++) if (ia[a] >= 0 && ia[b] >= 0) noHit.add(ia[a] < ia[b] ? ia[a]*n + ia[b] : ia[b]*n + ia[a]);
    }
  });
  const across = opt.seamBend || sFold.some(Boolean) ? seamBends(sIdx, sW, sOf, bnd, rest, bendK, opt.seamBend || 0, sBend, sFold) : { I: [], J: [], L: [], A: [], S: [], Q: [], B0: [], K: [], FS: [] };
  // (Round r14 / 5) the seams' folds join the fold lines' (foldStep()), each only once its stitch has closed
  const fSt = fB.map(() => -1);
  for (let q = 0; q < across.B0.length; q++) { fQ.push(...across.Q.slice(4*q, 4*q + 4)); fB.push(across.B0[q]); fK.push(across.K[q]); fSt.push(across.FS[q]); }
  // holds: up to three points, and where they go
  const hIdx = [], hW = [], hTo = [];
  for (const hd of spec.holds || []) {
    if (!hd || !hd.a || !hd.to) continue;
    for (let k = 0; k < 3; k++) { hIdx.push(k < hd.a.i.length ? off[hd.a.p] + hd.a.i[k] : -1); hW.push(k < hd.a.i.length ? hd.a.w[k] : 0); }
    hTo.push(hd.to[0], hd.to[1], hd.to[2]);
  }
  // FILL: the patterns with fill, and the groups they are sewn into (a pattern and everything sewn to it, through seams)
  const np = spec.pieces.length, fill = spec.pieces.map(pc => pc.fill > 0 ? Math.min(100, pc.fill) : 0), grp = Array.from({ length: np }, (_, k) => k);
  const root = (k) => { while (grp[k] !== k) k = grp[k] = grp[grp[k]]; return k; };
  const pieceOf = (i) => { let k = 0; while (k + 1 < np && off[k+1] <= i) k++; return k; };
  // (Round r11 / 2) the groups always, so that fill can be given to a pattern while the cloth is simulated (clothFill())
  for (let c = 0; c < sIdx.length; c += 6) { const a = sIdx[c], b = sIdx[c+3]; if (a >= 0 && b >= 0) { const ra = root(pieceOf(a)), rb = root(pieceOf(b)); if (ra !== rb) grp[ra] = rb; } }
  const sim = { n, off, x, p, v, w, w0: Float64Array.from(w), mass, rest, piece, thick, fric, res,
    fill, fillGrp: fill.map((f, k) => root(k)), fillF: fill.some(f => f > 0) ? new Float64Array(3*n) : null, fillTri: spec.pieces.map(pc => pc.tri), fillArea: spec.pieces.map(pc => C.triArea2D(pc.xy, pc.tri)),
    hIdx: Int32Array.from(hIdx), hW: Float64Array.from(hW), hTo: Float64Array.from(hTo), hClosed: new Uint8Array(hTo.length/3),
    eI: Int32Array.from(eI), eJ: Int32Array.from(eJ), eL: Float64Array.from(eL), eA: Float64Array.from(eA), eM: Float64Array.from(eM), limit: eM.some(v => v > 0),
    sClosed: new Uint8Array(sA.length), drag: null,
    bI: Int32Array.from(bI), bJ: Int32Array.from(bJ), bL: Float64Array.from(bL), bA: Float64Array.from(bA), fQ: Int32Array.from(fQ), fB: Float64Array.from(fB), fK: Float64Array.from(fK), fSt: Int32Array.from(fSt),
    rN: Int32Array.from(rN), rW: Float64Array.from(rW), rI: Int32Array.from(rI), rJ: Int32Array.from(rJ), rL: Float64Array.from(rL), rA: Float64Array.from(rA), rM: Float64Array.from(rM),
    xI: Int32Array.from(across.I), xJ: Int32Array.from(across.J), xL: Float64Array.from(across.L), xA: Float64Array.from(across.A), xS: Int32Array.from(across.S),
    sIdx: Int32Array.from(sIdx), sW: Float64Array.from(sW), sA: Float64Array.from(sA), sOf: Int32Array.from(sOf), noHit,
    field: spec.field || null, opt, pairs: new Int32Array(0), nPairs: 0, time: 0, frames: 0, g: [0, 0, 0],
    ghost: spec.pieces.some(pc => pc.ghost) ? Uint8Array.from(spec.pieces, pc => pc.ghost ? 1 : 0) : null };
  // (Round build-1) Simulation Shrinkage comes in over the first SHRINK_EASE frames, from the cut lengths to the shrunk ones: all at
  // once, a flat sheet's triangles fold over and it never comes back to its shape
  if (spec.pieces.some(pc => pc.shrink)) Object.assign(sim, { eF: Float64Array.from(eF), eT: Float64Array.from(eL), bF: Float64Array.from(bF), bT: Float64Array.from(bL) });
  // (Round r15 / 8) never below the patterns' Collision Thickness (opt.selfMin, 2.5 mm by default; it was 3 mm)
  opt.selfDist = opt.selfDist > 0 ? opt.selfDist : Math.min(14, Math.max(opt.selfMin > 0 ? opt.selfMin : 2.5, 0.7*res));
  for (const pn of spec.pins || []) C.clothPin(sim, off[pn.p] + pn.v, true);
  return sim;
};
/* FOLD LINES (Round r14 / 2). An internal line with a fold angle: 180° lies flat, 90° is a square corner back towards back,
   270° front towards front, 0° and 360° folded flat (back against back, front against front). The pattern is meshed along
   the line (meshPolygon's lines), so the cloth has edges on it: the bending pair across each such edge keeps the distance its
   two corners have with the cloth folded about that edge by the angle there. That distance is the same either way round, so
   a second, one-sided step says which way: the far corner stays on the side of its near triangle's front (above 180°) or back
   (below). A fold = { L: [[x, y], …] the line on the flat pattern, as it was given to meshPolygon, a0, a1: its angle in
   degrees at its start and its end (equal: Uniform; one of them 180: Variable), k: its stiffness (never less than the
   fabric's own bending) }. foldMap(): which mesh point is which point of which fold line. */
function foldMap(xy, folds) {
  const key = (x, y) => Math.round(x*1e4) + "," + Math.round(y*1e4), at = new Map(), out = new Map();
  folds.forEach((f, k) => {
    let run = 0;
    const cum = [0];
    for (let j = 1; j < f.L.length; j++) cum.push(run += Math.hypot(f.L[j][0] - f.L[j-1][0], f.L[j][1] - f.L[j-1][1]));
    f.cum = cum;
    f.L.forEach((q, j) => { const kk = key(q[0], q[1]); if (!at.has(kk)) at.set(kk, [k, j]); });
  });
  for (let i = 0, n = xy.length >> 1; i < n; i++) { const hit = at.get(key(xy[2*i], xy[2*i+1])); if (hit) out.set(i, hit); }
  return out;
}
// the fold across inner edge a–b (corners c and d), or null if a–b is no piece of a fold line
function foldAt(xy, a, b, c, d, folds, fm) {
  const A = fm.get(a), B = fm.get(b);
  if (!A || !B || A[0] !== B[0] || Math.abs(A[1] - B[1]) !== 1) return null;
  const f = folds[A[0]], tot = f.cum[f.cum.length - 1], fr = tot > 0 ? (f.cum[A[1]] + f.cum[B[1]])/2/tot : 0;
  const deg = Math.max(0, Math.min(360, f.a0 + ((f.a1 === undefined ? f.a0 : f.a1) - f.a0)*fr));
  if (Math.abs(deg - 180) < 0.5) return null;
  const ax = xy[2*a], ay = xy[2*a+1], ux = xy[2*b] - ax, uy = xy[2*b+1] - ay, len = Math.hypot(ux, uy);
  if (!(len > 0)) return null;
  const nx = ux/len, ny = uy/len, cx = xy[2*c] - ax, cy = xy[2*c+1] - ay, dx = xy[2*d] - ax, dy = xy[2*d+1] - ay;
  const hc = Math.abs(cx*ny - cy*nx), hd = Math.abs(dx*ny - dy*nx), along = (cx - dx)*nx + (cy - dy)*ny, th = deg*Math.PI/180;
  // b0: the angle d stands at from c's side, through the front (see foldStep()); 0° and 360° kept a hair off folded flat
  const g = Math.max(1, Math.min(359, deg))*Math.PI/180;
  return { L: Math.sqrt(Math.max(0, along*along + hc*hc + hd*hd - 2*hc*hd*Math.cos(th))), k: f.k > 0 ? f.k : 0, b0: g > Math.PI ? 2*Math.PI - g : -g, lever: (hc + hd)/2 };
}
/* the fold lines' own step: across each fold edge a–b the cloth is turned towards its angle. In the plane square to the edge,
   b the angle from corner c's side round to corner d's, through the front of triangle a, b, c (whose corners are in the
   mesh's winding, so its normal is the cloth's front): flat is 180°, a fold towards the front (270° in the source's terms)
   brings d round to +90°, one towards the back (90°) to -90°. A constraint on that angle (XPBD), its gradients as in Bridson,
   Marino and Fedkiw (2003): d moves square to its own side, c square to its, and the edge's two ends take the opposite
   share by where c's and d's feet lie along it, so the cloth is neither pushed nor turned as a whole. */
function foldStep(sim, h2) {
  const x = sim.x, w = sim.w, Q = sim.fQ, B0 = sim.fB, K = sim.fK, St = sim.fSt, o = [0, 0, 0];
  for (let q = 0; q < B0.length; q++) {
    if (St && St[q] >= 0 && !sim.sClosed[St[q]]) continue;      // a seam's fold waits until its stitch has closed
    const ia = Q[4*q], ib = Q[4*q+1], ic = Q[4*q+2], id = Q[4*q+3], a = 3*ia, b = 3*ib, c = 3*ic, d = 3*id;
    let ex = x[b] - x[a], ey = x[b+1] - x[a+1], ez = x[b+2] - x[a+2];
    const el2 = ex*ex + ey*ey + ez*ez;
    if (el2 < 1e-18) continue;
    // a corner's offset from the edge, square to it (in o), its length; and how far along the edge its foot is (0 at a, 1 at b)
    // (Round POLISH-1 / A2, F26: the wavy crease) e is a unit vector by the time this runs: the foot along it is r·e, its share of the
    // edge r·e / |edge|. It divided by |edge|² instead, so the "square" offset kept most of its part along the edge, the angle each
    // edge measured was off by its triangles' shape, and the fold's own angle was no resting state (the cloth came to rest anywhere)
    const flat = (k) => { const rx = x[k] - x[a], ry = x[k+1] - x[a+1], rz = x[k+2] - x[a+2], t = rx*ex + ry*ey + rz*ez; o[0] = rx - t*ex; o[1] = ry - t*ey; o[2] = rz - t*ez; return t/el; };
    const el = Math.sqrt(el2); ex /= el; ey /= el; ez /= el;
    const sc = flat(c), rc = Math.hypot(o[0], o[1], o[2]);
    if (rc < 1e-9) continue;
    const ux = o[0]/rc, uy = o[1]/rc, uz = o[2]/rc, vx = ey*uz - ez*uy, vy = ez*ux - ex*uz, vz = ex*uy - ey*ux;      // u: towards c, v = e × u: the front
    const sd = flat(d), rd = Math.hypot(o[0], o[1], o[2]);
    if (rd < 1e-9) continue;
    const pu = o[0]*ux + o[1]*uy + o[2]*uz, pv = o[0]*vx + o[1]*vy + o[2]*vz, beta = Math.atan2(pv, pu);
    let C = beta - B0[q];
    while (C > Math.PI) C -= 2*Math.PI;
    while (C <= -Math.PI) C += 2*Math.PI;
    C = Math.max(-0.5, Math.min(0.5, C));                        // a big turn a step at most: the gradient is the slope at this angle
    // the gradients: d along e × (its offset), over its distance; c along -v over its distance
    const gdx = (ey*o[2] - ez*o[1])/(rd*rd), gdy = (ez*o[0] - ex*o[2])/(rd*rd), gdz = (ex*o[1] - ey*o[0])/(rd*rd);
    const gcx = -vx/rc, gcy = -vy/rc, gcz = -vz/rc;
    const gax = -((1 - sc)*gcx + (1 - sd)*gdx), gay = -((1 - sc)*gcy + (1 - sd)*gdy), gaz = -((1 - sc)*gcz + (1 - sd)*gdz);
    const gbx = -(sc*gcx + sd*gdx), gby = -(sc*gcy + sd*gdy), gbz = -(sc*gcz + sd*gdz);
    const wa = w[ia], wb = w[ib], wc = w[ic], wd = w[id];
    const den = wa*(gax*gax + gay*gay + gaz*gaz) + wb*(gbx*gbx + gby*gby + gbz*gbz) + wc/(rc*rc) + wd/(rd*rd) + 1/(K[q]*h2);
    if (!(den > 0)) continue;
    const dl = -C/den;
    x[a] += wa*dl*gax; x[a+1] += wa*dl*gay; x[a+2] += wa*dl*gaz;
    x[b] += wb*dl*gbx; x[b+1] += wb*dl*gby; x[b+2] += wb*dl*gbz;
    x[c] += wc*dl*gcx; x[c+1] += wc*dl*gcy; x[c+2] += wc*dl*gcz;
    x[d] += wd*dl*gdx; x[d+1] += wd*dl*gdy; x[d+2] += wd*dl*gdz;
  }
}

/* BENDING ACROSS A SEAM (Round r11 / 1). Inside a pattern the cloth resists folding along each edge by keeping the distance
   between the two corners across it; across a seam there was nothing, so a sewn edge could kink freely and a ridge stood up at
   every seam. Here the same constraint is put across each stitch: from the cloth point beside the sewn place on one side (the
   corner of the border triangle there, the one most square to the seam) to the one on the other side, at the distance the two
   would have if the seam lay flat (the two patterns unfolded into one plane about the seam line, with the seam's direction
   matched on both sides). Its stiffness is the softer of the two fabrics' bending times `k` (opt.seamBend), times the seam's own
   `bend` (Round r11 / 5: a glued seam, 2). Only once that stitch
   has closed: a seam still open is not pulled shut by it. -> { I, J, L, A, S } (S: the stitch it belongs to)
   (Round r14 / 5) A seam with a fold (sFold[seam] = { a: its angle in degrees as a fold line's, k: its stiffness }): the
   distance is the one the two corners have with the seam folded so, and the seam also gets a fold line's own step (foldStep()):
   its hinge the sewn places before and after the stitch on the first side, its corners the two found here. -> also
   Q (4 a fold: hinge, hinge, corner on the first side, corner on the second), B0, K, FS (the stitch). */
function seamBends(sIdx, sW, sOf, bnd, rest, bendK, k, sBend, sFold) {
  const m = sOf.length, out = { I: [], J: [], L: [], A: [], S: [], Q: [], B0: [], K: [], FS: [] }, seen = new Set();
  const main = (c, side) => { let b = -1, bw = 0; for (let q = 0; q < 3; q++) { const i = sIdx[6*c + 3*side + q], wq = Math.abs(sW[6*c + 3*side + q]); if (i >= 0 && wq > bw) { bw = wq; b = i; } } return b; };
  const pos = (c, side) => { let x = 0, y = 0, t = 0; for (let q = 0; q < 3; q++) { const i = sIdx[6*c + 3*side + q]; if (i < 0) continue; const wq = Math.abs(sW[6*c + 3*side + q]); x += wq*rest[2*i]; y += wq*rest[2*i+1]; t += wq; } return t > 0 ? [x/t, y/t] : null; };
  for (let c = 0; c < m; c++) {
    // the seam's direction at this stitch on each side, from the stitches before and after it (so both run the same way)
    const pc = c > 0 && sOf[c-1] === sOf[c] ? c - 1 : c, nc = c + 1 < m && sOf[c+1] === sOf[c] ? c + 1 : c;
    if (pc === nc) continue;
    const corner = [], ok = [0, 1].every(side => {
      const i = main(c, side), P = pos(c, side), A = pos(pc, side), B = pos(nc, side);
      if (i < 0 || !P || !A || !B || !bnd[i]) return false;
      let tx = B[0] - A[0], ty = B[1] - A[1];
      const tl = Math.hypot(tx, ty);
      if (tl < 1e-9) return false;
      tx /= tl; ty /= tl;
      let best = -1, bs = Infinity, al = 0, ac = 0, bq = -1;
      for (let e = 0; e < bnd[i].length; e += 2) {
        const r = bnd[i][e+1], dx = rest[2*r] - P[0], dy = rest[2*r+1] - P[1], d = Math.hypot(dx, dy);
        if (d < 1e-9) continue;
        const along = dx*tx + dy*ty, sq = Math.abs(along)/d;
        if (sq < bs) { bs = sq; best = r; al = along; ac = Math.abs(dx*ty - dy*tx); bq = bnd[i][e]; }
      }
      if (best < 0 || bs > 0.8) return false;
      corner.push([best, al, ac, bendK[i], i, bq]);      // (and the border edge i–bq whose triangle's corner it is)
      return true;
    });
    if (!ok || corner[0][0] === corner[1][0]) continue;
    const a = corner[0], b = corner[1], key = Math.min(a[0], b[0]) + ":" + Math.max(a[0], b[0]);
    if (seen.has(key)) continue;
    seen.add(key);
    const fd = sFold && sFold[sOf[c]], kk = Math.min(a[3], b[3])*k*((sBend && sBend[sOf[c]]) || 1);
    if (!fd && !kk) continue;                                    // (no bending across seams, opt.seamBend 0: only a seam's own fold)
    if (!fd) { out.I.push(a[0]); out.J.push(b[0]); out.L.push(Math.hypot(a[1] - b[1], a[2] + b[2])); out.A.push(1/kk); out.S.push(c); continue; }
    const deg = Math.max(0, Math.min(360, fd.a)), g = Math.max(1, Math.min(359, deg))*Math.PI/180, kf = Math.max(kk, fd.k || 0);
    out.I.push(a[0]); out.J.push(b[0]); out.L.push(Math.sqrt(Math.max(0, (a[1] - b[1])**2 + a[2]*a[2] + b[2]*b[2] - 2*a[2]*b[2]*Math.cos(deg*Math.PI/180)))); out.A.push(1/kf); out.S.push(c);
    // the hinge: the first side's border edge whose triangle the corner is of, in the order that makes hinge, hinge, corner
    // the cloth's own winding (clockwise on the page: its normal the front)
    let h0 = a[4], h1 = a[5];
    if (h0 < 0 || h1 < 0 || h0 === h1) continue;
    if ((rest[2*h1] - rest[2*h0])*(rest[2*a[0]+1] - rest[2*h0+1]) - (rest[2*a[0]] - rest[2*h0])*(rest[2*h1+1] - rest[2*h0+1]) > 0) [h0, h1] = [h1, h0];
    const lever = (a[2] + b[2])/2;
    out.Q.push(h0, h1, a[0], b[0]); out.B0.push(g > Math.PI ? 2*Math.PI - g : -g); out.K.push(kf*lever*lever); out.FS.push(c);
  }
  return out;
}
/* (Round r11 / 2) the patterns' fill changed while the cloth is simulated: fills[k] for pattern k, 0 to 100. Nothing else of the
   solver is built again: the cloth goes on from where it is, and a pattern's outward side, once decided, is kept. */
C.clothFill = function (sim, fills) {
  for (let k = 0; k < sim.fill.length; k++) sim.fill[k] = fills[k] > 0 ? Math.min(100, fills[k]) : 0;
  if (sim.fill.some(f => f > 0)) { if (!sim.fillF) sim.fillF = new Float64Array(3*sim.n); }
  else sim.fillF = null;
  sim.fillGroups = [];
};
// hold a point where it is (or let it go). to: [x, y, z] moves it there as well.
C.clothPin = function (sim, i, on, to) {
  if (i < 0 || i >= sim.n) return;
  sim.w[i] = on ? 0 : sim.w0[i];
  if (to) { sim.x[3*i] = to[0]; sim.x[3*i+1] = to[1]; sim.x[3*i+2] = to[2]; }
  sim.v[3*i] = sim.v[3*i+1] = sim.v[3*i+2] = 0;
};
/* The pointer's pull (Round r9 / 3): d = { i: [points], w: [weights], to: [x, y, z] } (the place under the pointer, as a
   mix of cloth points, and where the pointer is now), or null to let go. Not a pin: the place is pulled towards `to` by a
   spring of stiffness opt.dragK whose force is never more than opt.dragMax, so the cloth round it stretches and follows,
   and a pattern sewn to it is pulled along through the seam. (Round r14 / 8) d.also: more places pulled the same way at the
   same time, each { i, w, to } (Symmetric Pinch: the mirrored place on the other side). */
/* (Round r33b / 1, the maintainer's user test: "I can pull the fabric but not move the sleeve as a whole") The pull takes the cloth
   within opt.dragReach mm of the grabbed place, on its pattern, as a hand takes a handful: each point is drawn towards where it
   was when grabbed plus the pointer's move, on a spring of dragK × its weight (1 at the place, falling to 0 at the reach); together they give no more than opt.dragMax. While it is held that cloth slides on the body with
   opt.dragSlide of its friction (a hand lifts what it pulls); let go, it has its whole friction again and stays where it was
   left. The reach is taken once, when the place is grabbed, and kept while the same place is pulled (each pointer move sends
   the same place again). dragReach 0: the one place alone, as before r33b. */
C.clothDrag = function (sim, d) {
  const was = sim.drag;
  // (REC-SHORT) the pinned points of the last pull get their own weight back; let go, the held cloth slides a while longer
  if (was) for (const g of [was, ...(was.also || [])]) if (g.pinned) for (const i of g.pinned) sim.w[i] = sim.w0[i];
  if (was && !(d && d.i && d.i.length && d.to)) sim.slideLeft = sim.opt.dragRelease > 0 ? sim.opt.dragRelease : 0;
  const one = (q, old) => {
    if (!(q && q.i && q.i.length && q.to)) return null;
    const g = { i: q.i.slice(), w: q.w ? q.w.slice() : q.i.map(() => 1/q.i.length), to: q.to.slice() };
    const same = old && old.i.length === g.i.length && old.i.every((v, k) => v === g.i[k]) && old.w.every((v, k) => Math.abs(v - g.w[k]) < 1e-9);
    if (same) { g.reach = old.reach; g.from = old.from; g.edges = old.edges; g.p0 = old.p0; g.same = true; } else { dragReach(sim, g); g.p0 = g.i.map(i => [sim.x[3*i], sim.x[3*i+1], sim.x[3*i+2]]); }
    return g;
  };
  sim.drag = one(d, was);
  if (sim.drag && d && Array.isArray(d.also)) sim.drag.also = d.also.map((q, k) => one(q, was && was.also && was.also[k])).filter(Boolean);
  if (sim.drag) {
    sim.slideLeft = 0;
    // (REC-SHORT) dragPin: the grabbed place's points are held where the pointer puts them (each moved as the pointer moved since it took
    // them), their weight 0 while held so nothing else moves them; points held by a pin of their own are left alone
    if (sim.opt.dragPin) for (const g of [sim.drag, ...(sim.drag.also || [])]) {
      g.pinned = g.i.filter(i => sim.w[i] > 0 || (was && was.pinned && was.pinned.includes(i)));
      for (const i of g.pinned) sim.w[i] = 0;
    }
  }
  // the cloth that slides while held
  if (!sim.drag && was) return;            // (REC-SHORT) let go: the cloth that was held keeps its mark while it still slides (dragRelease)
  if (!sim.dragSlid || sim.dragSlid.length !== sim.n) sim.dragSlid = new Uint8Array(sim.n); else sim.dragSlid.fill(0);
  // (the cloth round it, on every pattern within opt.dragSlideReach, slides too: a sleeve pulled takes the shoulder with it)
  const SR = sim.opt.dragSlideReach, x = sim.x;
  if (sim.drag) for (const g of [sim.drag, ...(sim.drag.also || [])]) {
    if (g.reach) { const R = g.reach; for (let k = 0; k < R.i.length; k++) if (R.wt[k] > 0.05) sim.dragSlid[R.i[k]] = 1; }
    if (SR > 0 && g.from) for (let i = 0; i < sim.n; i++) { const dx = x[3*i] - g.from[0], dy = x[3*i+1] - g.from[1], dz = x[3*i+2] - g.from[2]; if (dx*dx + dy*dy + dz*dz < SR*SR) sim.dragSlid[i] = 1; }
  }
};
// (REC-SHORT) while the pointer holds a place, the limited edges of the patterns it holds are free of their limit: a mark per edge
function dragFree(sim) {
  const f = new Uint8Array(sim.eI.length), on = new Set();
  for (const g of [sim.drag, ...(sim.drag.also || [])]) if (g.i.length) on.add(sim.piece[g.i[0]]);
  for (let c = 0; c < f.length; c++) if (on.has(sim.piece[sim.eI[c]])) f[c] = 1;
  return f;
}
// the points within reach of a grabbed place, on its pattern, with their weights and where they are now
function dragReach(sim, g) {
  const x = sim.x, R = sim.opt.dragReach;
  const from = [0, 0, 0];
  for (let k = 0; k < g.i.length; k++) for (let c = 0; c < 3; c++) from[c] += g.w[k]*x[3*g.i[k] + c];
  g.from = from; g.reach = null;
  if (!(R > 0)) return;
  const pc = sim.piece[g.i[0]], o0 = sim.off[pc], o1 = pc + 1 < sim.off.length ? sim.off[pc + 1] : sim.n, I = [], W = [];
  for (let i = o0; i < o1; i++) {
    if (sim.w[i] === 0) continue;
    const dx = x[3*i] - from[0], dy = x[3*i+1] - from[1], dz = x[3*i+2] - from[2], dd = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (dd >= R) continue;
    const f = 1 - (dd/R)*(dd/R); I.push(i); W.push(f*f);
  }
  if (!I.length) return;
  const X0 = new Float64Array(3*I.length);
  I.forEach((i, k) => { X0[3*k] = x[3*i]; X0[3*k+1] = x[3*i+1]; X0[3*k+2] = x[3*i+2]; });
  g.reach = { i: Int32Array.from(I), wt: Float64Array.from(W), x0: X0, sum: W.reduce((a, b) => a + b, 0) };
  // the pulled pattern's limited edges: the extra passes of its limit while it is pulled go over these alone
  const E = []; for (let c = 0; c < sim.eI.length; c++) if (sim.eM[c] > 0 && sim.eI[c] >= o0 && sim.eI[c] < o1 && sim.eJ[c] >= o0 && sim.eJ[c] < o1) E.push(c);
  g.edges = Int32Array.from(E);
}
// the spring's pull in one small step (XPBD, a soft constraint whose multiplier is capped by the most force it may give)
function dragStep(sim, h) {
  const d0 = sim.drag;
  if (!d0) return;
  for (const d of [d0, ...(d0.also || [])]) dragOne(sim, d, h);
}
function dragOne(sim, d, h) {
  const x = sim.x, w = sim.w;
  if (d.pinned && d.pinned.length) {        // (REC-SHORT) the place grabbed follows the pointer exactly
    const mx = d.to[0] - d.from[0], my = d.to[1] - d.from[1], mz = d.to[2] - d.from[2];
    for (const i of d.pinned) { const k = d.i.indexOf(i), p0 = d.p0[k]; x[3*i] = p0[0] + mx; x[3*i+1] = p0[1] + my; x[3*i+2] = p0[2] + mz; }
  }
  if (d.reach) {
    // (Round r33b / 1) the handful: each point towards its own place moved as the pointer moved, held the more firmly the nearer it is
    const R = d.reach, mx = d.to[0] - d.from[0], my = d.to[1] - d.from[1], mz = d.to[2] - d.from[2], capAll = sim.opt.dragMax*h*h;
    for (let k = 0; k < R.i.length; k++) {
      const i = R.i[k], q = R.wt[k];
      if (w[i] === 0) continue;
      const dx = x[3*i] - (R.x0[3*k] + mx), dy = x[3*i+1] - (R.x0[3*k+1] + my), dz = x[3*i+2] - (R.x0[3*k+2] + mz), len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (len < 1e-9) continue;
      let lam = len/(w[i] + 1/(sim.opt.dragK*q*h*h));
      const cap = capAll*q/R.sum;
      if (lam > cap) lam = cap;
      const s = lam*w[i]/len; x[3*i] -= s*dx; x[3*i+1] -= s*dy; x[3*i+2] -= s*dz;
    }
    return;
  }
  let px = 0, py = 0, pz = 0, den = 0;
  for (let k = 0; k < d.i.length; k++) { const i = d.i[k], q = d.w[k]; px += q*x[3*i]; py += q*x[3*i+1]; pz += q*x[3*i+2]; den += q*q*w[i]; }
  const dx = px - d.to[0], dy = py - d.to[1], dz = pz - d.to[2], len = Math.sqrt(dx*dx + dy*dy + dz*dz);
  if (len < 1e-9 || den <= 0) return;
  const at = 1/(sim.opt.dragK*h*h);
  let lam = len/(den + at);
  const cap = sim.opt.dragMax*h*h;
  if (lam > cap) lam = cap;
  for (let k = 0; k < d.i.length; k++) { const i = d.i[k], q = lam*d.w[k]*w[i]/len; x[3*i] -= q*dx; x[3*i+1] -= q*dy; x[3*i+2] -= q*dz; }
}
/* Every seam's matched places pulled together (one pass). A seam that has closed (its gap once under seamClose) is held
   shut: the whole correction. One still closing moves no more than maxPull a small step. mark: note the places of seams
   still open by more than seamSlip (they slide on the body: see the body below). */
function seamStep(sim, mark, h2) {
  const o = sim.opt, x = sim.x, w = sim.w, SI = sim.sIdx, SW = sim.sW, SA = sim.sA, closed = sim.sClosed, open = sim.sOpen, slip = o.seamSlip, shut = o.seamClose, m = sim.sA.length;
  // (Round r11 / 1, opt.seamRamp frames, off by default) soft at first: a compliance opt.seamSoft that falls to none over the ramp
  const ramp = o.seamRamp > 0 && sim.frames < o.seamRamp && h2 ? o.seamSoft*Math.pow(1 - sim.frames/o.seamRamp, 2)*h2 : 0;
  for (let c = 0; c < m; c++) {
    let dx = 0, dy = 0, dz = 0, den = 0;
    for (let k = 0; k < 6; k++) { const i = SI[6*c+k]; if (i < 0) continue; const q = SW[6*c+k]; dx += q*x[3*i]; dy += q*x[3*i+1]; dz += q*x[3*i+2]; den += q*q*w[i]; }
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 1e-9 || den <= 0) { closed[c] = 1; continue; }
    if (mark && len > slip) for (let k = 0; k < 6; k++) { const i = SI[6*c+k]; if (i >= 0) open[i] = 1; }
    if (!closed[c] && len <= shut) closed[c] = 1;
    const soft = SA[c] > 0 && h2 ? SA[c]*h2 : 0;               // (Round build-1) a soft stitch (a glue's Strength below 1: its compliance, h2 = 1/h²); 0 for every seam
    const lam = -(closed[c] ? len/(den + ramp + soft) : Math.min(len/(den + ramp + soft), o.maxPull/den))/len;
    for (let k = 0; k < 6; k++) { const i = SI[6*c+k]; if (i < 0) continue; const q = lam*SW[6*c+k]*w[i]; x[3*i] += q*dx; x[3*i+1] += q*dy; x[3*i+2] += q*dz; }
  }
}
/* FILL (Round r9 / 7; provisional: compare in the other program). A pattern with fill is pushed outward, away from the
   patterns it is sewn to, as if filled: two rectangles sewn all round with fill swell into a cushion. Each group of
   patterns sewn together has a volume: what its filled patterns' cloth encloses, measured from the group's middle, each
   pattern's side taken so that its outward is away from that middle (a pattern on its own: its face). The group is filled
   up to a target volume: fill % of FILL_SHAPE times the volume of a ball with the filled cloth's area, shared out between
   its filled patterns by their areas. While a pattern's part of the volume is short of its share, its cloth is pushed out
   along its normals with a pressure in proportion to what is missing, up to FILL_PA (the pressure's force on a point is
   the pressure times its share of the area along the normal: the volume's own gradient); past it, drawn in the same way.
   So more fill swells it more, and it settles at its volume. The push is taken back out of the rest of the group (below).
   Worked out once a frame. */
const FILL_PA = 5, FILL_SHAPE = 0.5;                        // g / (mm s²), that is Pa (about three times a medium cloth's own weight on its area); the share of a ball's volume a full cushion reaches
C.FILL_PA = FILL_PA; C.FILL_SHAPE = FILL_SHAPE;
function fillForces(sim) {
  const x = sim.x, F = sim.fillF, np = sim.fill.length, groups = new Map();
  F.fill(0);
  for (let k = 0; k < np; k++) {
    const g = sim.fillGrp[k], e = groups.get(g) || { pieces: [], filled: [], cx: 0, cy: 0, cz: 0, m: 0, area: 0, fill: 0, vol: 0 };
    groups.set(g, e); e.pieces.push(k);
    if (sim.fill[k] > 0) { e.filled.push(k); e.area += sim.fillArea[k]; e.fill = Math.max(e.fill, sim.fill[k]); }
  }
  for (const e of groups.values()) {
    if (!e.filled.length) continue;
    // the group's middle, from all its cloth
    for (const k of e.pieces) { const o = sim.off[k], end = k + 1 < np ? sim.off[k+1] : sim.n; for (let i = o; i < end; i++) { e.cx += x[3*i]; e.cy += x[3*i+1]; e.cz += x[3*i+2]; e.m++; } }
    e.cx /= e.m; e.cy /= e.m; e.cz /= e.m;
    const sgn = [];
    for (const k of e.filled) {
      const o = sim.off[k], T = sim.fillTri[k], end = k + 1 < np ? sim.off[k+1] : sim.n;
      let nx = 0, ny = 0, nz = 0, px = 0, py = 0, pz = 0;
      for (let t = 0; t < T.length; t += 3) {
        const a = 3*(o + T[t]), b = 3*(o + T[t+1]), c = 3*(o + T[t+2]);
        const ux = x[b] - x[a], uy = x[b+1] - x[a+1], uz = x[b+2] - x[a+2], vx = x[c] - x[a], vy = x[c+1] - x[a+1], vz = x[c+2] - x[a+2];
        nx += uy*vz - uz*vy; ny += uz*vx - ux*vz; nz += ux*vy - uy*vx;
      }
      for (let i = o; i < end; i++) { px += x[3*i]; py += x[3*i+1]; pz += x[3*i+2]; }
      px = px/(end - o) - e.cx; py = py/(end - o) - e.cy; pz = pz/(end - o) - e.cz;
      // which way is out is decided on the first frame and kept: once the cloth is crumpled its mean normal can turn round
      // Where that can't tell (patterns lying on each other, or side by side facing the same way, as the 2D window lays them
      // out), the first filled pattern goes out along its face and each other one opposite to the first.
      const S0 = sim.fillSgn || (sim.fillSgn = []);
      if (S0[k] === undefined) {
        const nl = Math.hypot(nx, ny, nz) || 1, d = (nx*px + ny*py + nz*pz)/nl, pl = Math.hypot(px, py, pz);
        if (e.pieces.length > 1 && Math.abs(d) > 0.2*pl && Math.abs(d) > 0.5) S0[k] = d > 0 ? 1 : -1;
        else if (!e.first) S0[k] = 1;
        else S0[k] = (nx*e.first[0] + ny*e.first[1] + nz*e.first[2]) > 0 ? -1 : 1;
        if (!e.first) e.first = [S0[k]*nx/nl, S0[k]*ny/nl, S0[k]*nz/nl];
      }
      sgn[k] = S0[k];
      // this pattern's part of the volume: the cones from the middle to its triangles
      let vk = 0;
      for (let t = 0; t < T.length; t += 3) {
        const a = 3*(o + T[t]), b = 3*(o + T[t+1]), c = 3*(o + T[t+2]);
        const ax = x[a] - e.cx, ay = x[a+1] - e.cy, az = x[a+2] - e.cz, bx = x[b] - e.cx, by = x[b+1] - e.cy, bz = x[b+2] - e.cz, cx = x[c] - e.cx, cy = x[c+1] - e.cy, cz = x[c+2] - e.cz;
        vk += sgn[k]*(ax*(by*cz - bz*cy) + ay*(bz*cx - bx*cz) + az*(bx*cy - by*cx))/6;
      }
      e.vol += vk; (e.vk || (e.vk = {}))[k] = vk;
    }
    // the target, shared out between the filled patterns by their areas: each swells to its own share, so two alike swell alike
    const want = e.fill/100*FILL_SHAPE*Math.pow(e.area, 1.5)/(6*Math.sqrt(Math.PI));
    e.want = want; e.P = 0;
    if (!(want > 0)) continue;
    for (const k of e.filled) {
      const wk = want*sim.fillArea[k]/e.area, P = FILL_PA*Math.max(-1, Math.min(1, (wk - e.vk[k])/wk));
      e.P = Math.max(e.P, P);
      if (!P) continue;
      const o = sim.off[k], T = sim.fillTri[k], q = sgn[k]*P/6;
      for (let t = 0; t < T.length; t += 3) {
        const ia = o + T[t], ib = o + T[t+1], ic = o + T[t+2], a = 3*ia, b = 3*ib, c = 3*ic;
        const ux = x[b] - x[a], uy = x[b+1] - x[a+1], uz = x[b+2] - x[a+2], vx = x[c] - x[a], vy = x[c+1] - x[a+1], vz = x[c+2] - x[a+2];
        const fx = q*(uy*vz - uz*vy), fy = q*(uz*vx - ux*vz), fz = q*(ux*vy - uy*vx);
        for (const j of [a, b, c]) { F[j] += fx; F[j+1] += fy; F[j+2] += fz; }
      }
    }
    // the filling presses on what it is sewn to as much as on the filled patterns: the net push is taken back out of the
    // rest of the group, by mass (from the filled patterns themselves when nothing else is sewn to them), so nothing flies off
    let tx = 0, ty = 0, tz = 0, mm = 0;
    for (const k of e.filled) { const o = sim.off[k], end = k + 1 < np ? sim.off[k+1] : sim.n; for (let i = o; i < end; i++) { tx += F[3*i]; ty += F[3*i+1]; tz += F[3*i+2]; } }
    const back = e.pieces.length > e.filled.length ? e.pieces.filter(k => !(sim.fill[k] > 0)) : e.filled;
    for (const k of back) { const o = sim.off[k], end = k + 1 < np ? sim.off[k+1] : sim.n; for (let i = o; i < end; i++) if (sim.w[i] > 0) mm += sim.mass[i]; }
    if (mm > 0) for (const k of back) { const o = sim.off[k], end = k + 1 < np ? sim.off[k+1] : sim.n; for (let i = o; i < end; i++) if (sim.w[i] > 0) { const q = sim.mass[i]/mm; F[3*i] -= tx*q; F[3*i+1] -= ty*q; F[3*i+2] -= tz*q; } }
  }
  sim.fillGroups = [...groups.values()].filter(e => e.filled.length).map(e => ({ pieces: e.filled.slice(), vol: e.vol, want: e.want, P: e.P }));
}
// the holds, one pass: as a seam whose other side does not move
function holdStep(sim) {
  const o = sim.opt, x = sim.x, w = sim.w, I = sim.hIdx, W = sim.hW, To = sim.hTo, closed = sim.hClosed, m = closed.length;
  for (let c = 0; c < m; c++) {
    let dx = -To[3*c], dy = -To[3*c+1], dz = -To[3*c+2], den = 0;
    for (let k = 0; k < 3; k++) { const i = I[3*c+k]; if (i < 0) continue; const q = W[3*c+k]; dx += q*x[3*i]; dy += q*x[3*i+1]; dz += q*x[3*i+2]; den += q*q*w[i]; }
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 1e-9 || den <= 0) { closed[c] = 1; continue; }
    if (!closed[c] && len <= o.seamClose) closed[c] = 1;
    const lam = -(closed[c] ? len/den : Math.min(len/den, o.maxPull/den))/len;
    for (let k = 0; k < 3; k++) { const i = I[3*c+k]; if (i < 0) continue; const q = lam*W[3*c+k]*w[i]; x[3*i] += q*dx; x[3*i+1] += q*dy; x[3*i+2] += q*dz; }
  }
}
// bending across the seams (Round r11 / 1), one pass: as the bending inside a pattern, for the stitches that have closed
function acrossStep(sim, h2) {
  const I = sim.xI, J = sim.xJ, L = sim.xL, A = sim.xA, S = sim.xS, x = sim.x, w = sim.w, shut = sim.sClosed;
  for (let c = 0; c < I.length; c++) {
    if (!shut[S[c]]) continue;
    const i = I[c], j = J[c], wi = w[i], wj = w[j], ws = wi + wj;
    if (ws === 0) continue;
    const a = 3*i, b = 3*j, dx = x[a] - x[b], dy = x[a+1] - x[b+1], dz = x[a+2] - x[b+2], len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 1e-9) continue;
    const k = -(len - L[c])/(ws + A[c]*h2)/len;
    x[a] += wi*k*dx; x[a+1] += wi*k*dy; x[a+2] += wi*k*dz; x[b] -= wj*k*dx; x[b+1] -= wj*k*dy; x[b+2] -= wj*k*dz;
  }
}
/* the rods (Round r11 / 3), one pass: each link a distance between two places of the cloth (each a mix of up to three points),
   kept with its compliance; one longer than its limit is brought back to it */
function rodStep(sim, h2, limitOnly, back) {
  const N = sim.rN, W = sim.rW, I = sim.rI, J = sim.rJ, L = sim.rL, A = sim.rA, M = sim.rM, x = sim.x, w = sim.w, m = I.length;
  for (let cc = 0; cc < m; cc++) {
    const c = back ? m - 1 - cc : cc;
    if (limitOnly && !(M[c] > 0)) continue;
    const u = 3*I[c], v = 3*J[c];
    let dx = 0, dy = 0, dz = 0, den = 0;
    for (let k = 0; k < 6; k++) { const nd = k < 3 ? u + k : v + k - 3, i = N[nd]; if (i < 0) continue; const q = (k < 3 ? 1 : -1)*W[nd]; dx += q*x[3*i]; dy += q*x[3*i+1]; dz += q*x[3*i+2]; den += q*q*w[i]; }
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 1e-9 || den <= 0) continue;
    let lam = limitOnly ? 0 : -(len - L[c])/(den + A[c]*h2);
    if (M[c] > 0 && len + lam*den > M[c]) lam = -(len - M[c])/den;        // past its limit: back to it, whatever the compliance
    for (let k = 0; k < 6; k++) { const nd = k < 3 ? u + k : v + k - 3, i = N[nd]; if (i < 0) continue; const q = (k < 3 ? 1 : -1)*W[nd]*w[i]*lam/len; x[3*i] += q*dx; x[3*i+1] += q*dy; x[3*i+2] += q*dz; }
  }
}
// strain limiting: an edge longer than its fabric allows is brought back to that length
function limitStep(sim, back, only) {
  const I = sim.eI, J = sim.eJ, M = sim.eM, x = sim.x, w = sim.w, m = only ? only.length : I.length;
  const free = !only && sim.drag && sim.opt.dragPin ? sim.drag.free || (sim.drag.free = dragFree(sim)) : null;      // (REC-SHORT)
  for (let cc = 0; cc < m; cc++) {
    const c = only ? only[back ? m - 1 - cc : cc] : back ? m - 1 - cc : cc;
    const L = M[c];
    if (!L || free && free[c]) continue;
    const i = I[c], j = J[c], a = 3*i, b = 3*j, dx = x[a] - x[b], dy = x[a+1] - x[b+1], dz = x[a+2] - x[b+2], l2 = dx*dx + dy*dy + dz*dz;
    if (l2 <= L*L) continue;
    const ws = w[i] + w[j];
    if (ws === 0) continue;
    const len = Math.sqrt(l2), k = -(len - L)/ws/len;
    if (sim.eFrc) sim.eFrc[c] += (len - L)/ws*sim.h2now;          // (r20 continued (4)) the limit's pull is a force of the cloth too
    x[a] += w[i]*k*dx; x[a+1] += w[i]*k*dy; x[a+2] += w[i]*k*dz; x[b] -= w[j]*k*dx; x[b+1] -= w[j]*k*dy; x[b+2] -= w[j]*k*dz;
  }
}
/* The pairs of points near enough to each other to collide in the coming frame: a grid
   of cells one collision distance wide, each point looked up against its own and the 26
   cells round it (a cell is as wide as two points can come near in a frame). Left out: points that are sewn to each other, and points of one
   pattern that are closer on the flat pattern than they would have to be pushed apart. */
// the value a fraction q of the way up a list of numbers (the list's order is changed)
function quantile(a, q) {
  let lo = 0, hi = a.length - 1;
  const k = Math.min(hi, Math.max(0, Math.floor(q*hi)));
  while (lo < hi) {                                            // Hoare's selection
    const piv = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) { while (a[i] < piv) i++; while (a[j] > piv) j--; if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; } }
    if (k <= j) hi = j; else if (k >= i) lo = i; else break;
  }
  return a[k];
}
function selfPairs(sim, dt) {
  const n = sim.n, d = sim.opt.selfDist, x = sim.x;
  // near enough = the collision distance plus what two points can close on each other in the frame, so that a
  // fast piece is caught in the small step in which it arrives and is stopped there instead of being found deep inside later
  // (Round r9 / 3) the speed of the fastest points but a few, not of the very fastest: a seam snapping shut moves a handful of
  // points fast, and their speed would widen the search for every point of the cloth
  // (Round perf-2 / 4) the speeds relative to the cloth's mean velocity: two points close on each other only as fast as they move
  // apart from each other (|vi − vj| ≤ |vi − v̄| + |vj − v̄|, as it was with their speeds), so cloth falling as a whole is searched
  // at the collision distance; a pattern falling onto one at rest is still searched as far as their speeds reach
  let mx = 0, my = 0, mz = 0, mw = 0;
  for (let i = 0; i < n; i++) if (sim.w[i] > 0) { mx += sim.v[3*i]; my += sim.v[3*i+1]; mz += sim.v[3*i+2]; mw++; }
  if (mw) { mx /= mw; my /= mw; mz /= mw; }
  const sp = sim.spd || (sim.spd = new Float32Array(n));
  for (let i = 0; i < n; i++) sp[i] = Math.abs(sim.v[3*i] - mx) + Math.abs(sim.v[3*i+1] - my) + Math.abs(sim.v[3*i+2] - mz);
  const vm = n ? quantile(sp, 0.99) : 0;
  const reach = Math.min(5*d, 1.3*d + 2*vm*(dt || 0)), inv = 1/reach;
  const size = 2*n + 1, start = new Int32Array(size + 1), ent = new Int32Array(n), cell = new Int32Array(n);
  const hash = (i, j, k) => { const h = (Math.imul(i, 92837111) ^ Math.imul(j, 689287499) ^ Math.imul(k, 283923481)) % size; return h < 0 ? h + size : h; };
  for (let i = 0; i < n; i++) { cell[i] = hash(Math.floor(x[3*i]*inv), Math.floor(x[3*i+1]*inv), Math.floor(x[3*i+2]*inv)); start[cell[i]]++; }
  let s = 0;
  for (let c = 0; c < size; c++) { s += start[c]; start[c] = s; }
  start[size] = s;
  for (let i = 0; i < n; i++) ent[--start[cell[i]]] = i;
  // (Round perf-2 / 4) the pairs go into one buffer kept with the cloth and doubled when full: never an array of numbers (a
  // document of 300 patterns overflowed one) and no copy; sim.nPairs says how many it holds
  let P = sim.pairBuf || (sim.pairBuf = new Int32Array(1 << 16)), m = 0;
  const r2 = reach*reach, flat = (d*1.2)*(d*1.2);
  for (let i = 0; i < n; i++) {
    const xi = x[3*i], yi = x[3*i+1], zi = x[3*i+2], ci = Math.floor(xi*inv), cj = Math.floor(yi*inv), ck = Math.floor(zi*inv);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const h = hash(ci + a, cj + b, ck + c);
      for (let e = start[h]; e < start[h+1]; e++) {
        const j = ent[e];
        if (j <= i) continue;
        // two cells can share a slot: only a point that is really in this cell counts, so no pair is listed twice
        if (Math.floor(x[3*j]*inv) !== ci + a || Math.floor(x[3*j+1]*inv) !== cj + b || Math.floor(x[3*j+2]*inv) !== ck + c) continue;
        const dx = x[3*j] - xi, dy = x[3*j+1] - yi, dz = x[3*j+2] - zi;
        if (dx*dx + dy*dy + dz*dz > r2) continue;
        if (sim.piece[i] === sim.piece[j]) {
          const fx = sim.rest[2*i] - sim.rest[2*j], fy = sim.rest[2*i+1] - sim.rest[2*j+1], rr = fx*fx + fy*fy;
          if (rr < flat) continue;
          // (Round perf-2 / 4) neighbours on cloth that is not folded between them: no further apart on the pattern than they are
          // now plus the collision distance. They were listed by the thousand (every point of a pattern within the reach) and
          // pushed only if squeezed under the collision distance, which their stretch keeps them from; points a fold brings
          // together are far apart on the pattern and stay in the list
          const lim = Math.sqrt(dx*dx + dy*dy + dz*dz) + d;
          if (rr <= lim*lim) continue;
        }
        if (sim.noHit.has(i*n + j)) continue;
        if (sim.w[i] === 0 && sim.w[j] === 0) continue;
        if (sim.ghost && (sim.ghost[sim.piece[i]] || sim.ghost[sim.piece[j]])) continue;      // (Round r14 / 6) a deactivated pattern is passed through
        if (2*m + 2 > P.length) { const Q = new Int32Array(2*P.length); Q.set(P); P = sim.pairBuf = Q; }
        P[2*m] = i; P[2*m+1] = j; m++;
      }
    }
  }
  sim.pairs = P; sim.nPairs = m;
}
// how much a distance field can change per millimetre moved (Round r10 / 7): trilinear between samples changes along each axis by
// at most the largest step between two neighbouring samples, so by √3 times that in any direction (outside the box by 1 more).
// Worked out once a field; near the skin the samples' steps can be steeper than 1, so it is not taken to be 1
function sdfLip(f) {
  if (f.lip) return f.lip;
  const d = f.d, nx = f.nx, ny = f.ny, nz = f.nz, sxy = nx*ny;
  let m = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const id = i + j*nx + k*sxy, v = d[id];
    if (i + 1 < nx) { const q = Math.abs(d[id+1] - v); if (q > m) m = q; }
    if (j + 1 < ny) { const q = Math.abs(d[id+nx] - v); if (q > m) m = q; }
    if (k + 1 < nz) { const q = Math.abs(d[id+sxy] - v); if (q > m) m = q; }
  }
  return (f.lip = Math.sqrt(3)*m/f.cell + 1);
}
const SHRINK_EASE = 60;
C.clothStep = function (sim, dt) {
  if (sim.eT && sim.frames < SHRINK_EASE) {
    const f = Math.min(1, (sim.frames + 1)/SHRINK_EASE);
    for (let c = 0; c < sim.eT.length; c++) sim.eL[c] = sim.eF[c] + (sim.eT[c] - sim.eF[c])*f;
    for (let c = 0; c < sim.bT.length; c++) sim.bL[c] = sim.bF[c] + (sim.bT[c] - sim.bF[c])*f;
  }
  const o = sim.opt, sub = Math.max(1, o.substeps | 0), h = dt/sub, h2 = 1/(h*h), n = sim.n, x = sim.x, p = sim.p, v = sim.v, w = sim.w, g = sim.g;
  // gravity comes in over the first easeIn frames, so that seams have closed before the cloth can fall off the body
  const gy = -o.gravity*h*(o.easeIn > 0 ? Math.min(1, (sim.frames + 1)/o.easeIn) : 1), damp = Math.max(0, 1 - o.damping*h), vmax = o.maxSpeed, f = sim.field, sd = o.selfDist;
  if (o.self) selfPairs(sim, dt); else sim.nPairs = 0;
  // where each point was when the body's field was last looked up there, and the distance it gave (another field: look again)
  if (sim.sdFor !== f) { sim.sdFor = f; sim.sdD = new Float64Array(n).fill(-Infinity); sim.sdP = new Float64Array(3*n); }
  const SD = sim.sdD, SP = sim.sdP, SDF_LIP = f ? sdfLip(f) : 0;
  if (sim.fillF) fillForces(sim);
  const FF = sim.fillF, PR = sim.press, EF = sim.eFrc;
  if (PR) PR.fill(0);
  if (EF) { EF.fill(0); sim.h2now = h2; }
  for (let s = 0; s < sub; s++) {
    for (let i = 0; i < n; i++) {
      const k = 3*i;
      if (w[i] === 0) { p[k] = x[k]; p[k+1] = x[k+1]; p[k+2] = x[k+2]; v[k] = v[k+1] = v[k+2] = 0; continue; }
      v[k+1] += gy;
      if (FF) { const q = h*w[i]; v[k] += q*FF[k]; v[k+1] += q*FF[k+1]; v[k+2] += q*FF[k+2]; }
      const sp = Math.hypot(v[k], v[k+1], v[k+2]);
      if (sp > vmax) { const q = vmax/sp; v[k] *= q; v[k+1] *= q; v[k+2] *= q; }
      p[k] = x[k]; p[k+1] = x[k+1]; p[k+2] = x[k+2];
      x[k] += v[k]*h; x[k+1] += v[k+1]*h; x[k+2] += v[k+2]*h;
    }
    // the pointer's pull first, so that everything after it (the fabric, its limit, the seams) has its say over it
    dragStep(sim, h);
    // stretch (gone over o.stretchIters times: cloth under load is stiff, and once is not enough), then bend:
    // the same constraint, a distance kept. Every other time the edges are taken in the opposite order.
    // (Bending as a kept distance is weak near flat: it shapes folds and wrinkles more than it holds cloth up.)
    for (let pass = 0; pass <= o.stretchIters; pass++) {
      const bend = pass === o.stretchIters, I = bend ? sim.bI : sim.eI, J = bend ? sim.bJ : sim.eJ, L = bend ? sim.bL : sim.eL, A = bend ? sim.bA : sim.eA, m = I.length, back = pass & 1;
      for (let cc = 0; cc < m; cc++) {
        const c = back ? m - 1 - cc : cc;
        const i = I[c], j = J[c], wi = w[i], wj = w[j], ws = wi + wj;
        if (ws === 0) continue;
        const a = 3*i, b = 3*j, dx = x[a] - x[b], dy = x[a+1] - x[b+1], dz = x[a+2] - x[b+2], len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (len < 1e-9) continue;
        const k = -(len - L[c])/(ws + A[c]*h2)/len;
        if (EF && !bend) EF[c] -= k*len*h2;
        x[a] += wi*k*dx; x[a+1] += wi*k*dy; x[a+2] += wi*k*dz; x[b] -= wj*k*dx; x[b+1] -= wj*k*dy; x[b+2] -= wj*k*dz;
      }
      if (bend && sim.fB.length) foldStep(sim, h2);
      if (bend && sim.xI.length) acrossStep(sim, h2);
      if (bend && sim.rI.length) rodStep(sim, h2);
      if (o.limitEach && sim.limit && !bend) limitStep(sim, !!back);        // the fabric's limit at every pass: one pass at the end can't pull a long run of edges back
      if (o.interleave && !bend) seamStep(sim, false, h2);         // the seams between the stretch passes as well: the stretch a seam forces is shared out instead of piling up beside it
    }
    // the seams: the two matched places are pulled together (a seam still closing no faster than maxPull a step). A place
    // whose seam is still open by more than o.seamSlip is marked: the body does not hold it by friction (below).
    const open = sim.sOpen || (sim.sOpen = new Uint8Array(n));
    open.fill(0);
    for (let it = 0; it < o.seamIters; it++) { seamStep(sim, it === 0, h2); holdStep(sim); }
    // cloth against cloth
    const P = sim.pairs;
    for (let c = 0; c < sim.nPairs; c++) {
      const i = P[2*c], j = P[2*c+1], a = 3*i, b = 3*j, dx = x[a] - x[b], dy = x[a+1] - x[b+1], dz = x[a+2] - x[b+2], l2 = dx*dx + dy*dy + dz*dz;
      if (l2 >= sd*sd || l2 < 1e-12) continue;
      const wi = w[i], wj = w[j], ws = wi + wj;
      if (ws === 0) continue;
      const len = Math.sqrt(l2), k = (sd - len)/len/ws;
      x[a] += wi*k*dx; x[a+1] += wi*k*dy; x[a+2] += wi*k*dz; x[b] -= wj*k*dx; x[b+1] -= wj*k*dy; x[b+2] -= wj*k*dz;
    }
    // no edge longer than its fabric allows
    if (sim.limit) { limitStep(sim, false); limitStep(sim, true); }
    // (Round r33b / 1) while the pointer pulls, more passes: its pull, spread over a handful of cloth, is stronger than one point's, and the limit must still hold
    if (sim.limit && sim.drag && o.dragLimitIters > 0) for (const g of [sim.drag, ...(sim.drag.also || [])]) if (g.edges && g.edges.length) for (let it = 0; it < o.dragLimitIters; it++) { limitStep(sim, false, g.edges); limitStep(sim, true, g.edges); }
    if (sim.rI.length) for (let it = 0; it < 6; it++) rodStep(sim, h2, true, it & 1);      // (Round r11 / 3) and no rod longer than its limit (a chain: both ways, three times; within about 1 % of it)
    // the body and the floor, with friction: what a point slid along the surface is held back
    for (let i = 0; i < n; i++) {
      if (w[i] === 0) continue;
      const k = 3*i, th = sim.thick[i];
      let push = 0;
      if (f) {
        // (Round r10 / 7) a point that was far from the body when the field was last looked up there, and has not moved enough
        // since to reach it, cannot touch it now: the lookup is left out (the field's distance changes by at most sdfLip() per
        // millimetre moved), so the answer is the same as with the lookup, only sooner
        const q3 = 3*i;
        if (!o.sdfSkip || SD[i] - SDF_LIP*Math.sqrt((x[k] - SP[q3])*(x[k] - SP[q3]) + (x[k+1] - SP[q3+1])*(x[k+1] - SP[q3+1]) + (x[k+2] - SP[q3+2])*(x[k+2] - SP[q3+2])) <= th + 0.5) {
          const d = C.sdfSample(f, x[k], x[k+1], x[k+2], g);
          SD[i] = d; SP[q3] = x[k]; SP[q3+1] = x[k+1]; SP[q3+2] = x[k+2];
          if (d < th) { push = th - d; x[k] += g[0]*push; x[k+1] += g[1]*push; x[k+2] += g[2]*push; if (PR) PR[i] += push*sim.mass[i]*h2; }
        }
      }
      if (o.ground && x[k+1] < th) { push = th - x[k+1]; x[k+1] = th; g[0] = 0; g[1] = 1; g[2] = 0; }
      if (push > 0) {
        const mx = x[k] - p[k], my = x[k+1] - p[k+1], mz = x[k+2] - p[k+2], dn = mx*g[0] + my*g[1] + mz*g[2];
        const tx = mx - dn*g[0], ty = my - dn*g[1], tz = mz - dn*g[2], tl = Math.sqrt(tx*tx + ty*ty + tz*tz);
        // Coulomb: a slide smaller than friction times the push is stopped altogether. That is what holds a
        // waistband up: cloth pulled tight against the body pushes hard, so it does not slide.
        // Not for a place on a seam that is still open: there it is the seam's own pull that presses the cloth
        // against the body, and held by that the two edges would stay where they first touched, one before a hip
        // and one behind it, and never meet. A seam is sewn before the garment is put on: until it has closed, its
        // edges slide round the body.
        // (Round r31 / 3) with opt.bodyStatic set, against the body two coefficients: a slide smaller than static times the push is
        // stopped, a larger one held back by kinetic times the push only. Off by default (null: the fabric's one coefficient for both,
        // as always): at the reference's 0.05 kinetic a garment still settling slides down the body. The floor keeps the fabric's.
        if (tl > 1e-9 && !open[i]) {
          const onBody = !(o.ground && x[k+1] <= th + 1e-9 && g[1] === 1), held = sim.dragSlid && sim.dragSlid[i] && (sim.drag || sim.slideLeft > 0) ? o.dragSlide : 1;      // (Round r33b / 1) held by the pointer: it slides
          const ms = (onBody && o.bodyStatic != null ? o.bodyStatic : sim.fric[i])*held, mk = (onBody && o.bodyStatic != null ? o.bodyKinetic : sim.fric[i])*held;
          const q = tl <= ms*push ? 1 : Math.min(1, mk*push/tl); x[k] -= tx*q; x[k+1] -= ty*q; x[k+2] -= tz*q;
        }
      }
    }
    // the seams last: nothing done after them in this step, not the body's push, not the fabric's limit, can leave a sewn seam open
    for (let it = 0; it < o.seamIters; it++) { seamStep(sim, false, h2); holdStep(sim); }
    for (let i = 0; i < n; i++) {
      if (w[i] === 0) continue;
      const k = 3*i;
      v[k] = (x[k] - p[k])/h*damp; v[k+1] = (x[k+1] - p[k+1])/h*damp; v[k+2] = (x[k+2] - p[k+2])/h*damp;
    }
  }
  if (PR) for (let i = 0; i < n; i++) PR[i] /= sub;
  if (EF) for (let c = 0; c < EF.length; c++) EF[c] /= sub;
  sim.time += dt; sim.frames++;
  if (sim.slideLeft > 0 && !sim.drag) sim.slideLeft--;
  return sim;
};
// one pattern's points, as they are now, into a Float32Array (3 a point)
C.clothRead = function (sim, k, out) {
  const o = sim.off[k], m = (k + 1 < sim.off.length ? sim.off[k+1] : sim.n) - o;
  out = out || new Float32Array(3*m);
  for (let i = 0; i < 3*m; i++) out[i] = sim.x[3*o + i];
  return out;
};
/* (Round r20 continued (4)) THE CLOTH'S FORCES, for the Stress and Pressure Maps. With them on, clothStep() adds up, in every small
   step, the force each correction stands for (XPBD: a correction's multiplier over the small step squared; g·mm/s², which is
   1e-6 N) and leaves the mean over the frame's small steps:
     sim.press[i]  the body's push on point i (the floor's is not counted): the contact force
     sim.eFrc[c]   the pull along edge c of the cloth: its stretch passes and the fabric's limit (+ pulling, - pushing)
   Nothing the solver does is changed: with them off nothing is added up, and the cloth moves the same either way. These are the
   forces the solver really applies, which are softer than a fabric's stretch stiffness (stretch) alone would give: at a cloth's
   mass and the small step, the mass term outweighs the compliance (an edge's 1 / (w h² + α) is well under its stretch). */
C.clothForces = function (sim, on) { sim.press = on ? new Float64Array(sim.n) : null; sim.eFrc = on ? new Float64Array(sim.eI.length) : null; return sim; };
/* the tension of every triangle, each pattern's triangles after the one before's (sim.fillTri): the largest principal value of the
   membrane stress of the edge forces, sum over its edges of f |l| (l^ l^) / area, each edge shared out between the triangles on it,
   in g/s² (1e-3 N/m: force per width). null while the forces are off. */
C.clothTension = function (sim, out) {
  if (!sim.eFrc) return null;
  const n = sim.n, x = sim.x, F = sim.eFrc;
  if (!sim.tEdge) {
    const by = new Map();
    for (let c = 0; c < sim.eI.length; c++) { const a = sim.eI[c], b = sim.eJ[c]; by.set(a < b ? a*n + b : b*n + a, c); }
    let nT = 0; for (const T of sim.fillTri) nT += T.length/3;
    const te = new Int32Array(3*nT).fill(-1), share = new Uint8Array(sim.eI.length);
    let q = 0;
    sim.fillTri.forEach((T, k) => { const o = sim.off[k]; for (let t = 0; t < T.length; t += 3, q++) for (let e = 0; e < 3; e++) { const a = o + T[t+e], b = o + T[t+(e+1)%3], c = by.get(a < b ? a*n + b : b*n + a); if (c !== undefined) { te[3*q+e] = c; share[c]++; } } });
    sim.tEdge = te; sim.tShare = share; sim.tN = nT;
  }
  out = out || new Float32Array(sim.tN);
  const te = sim.tEdge, sh = sim.tShare;
  let q = 0;
  sim.fillTri.forEach((T, k) => {
    const o = sim.off[k];
    for (let t = 0; t < T.length; t += 3, q++) {
      const a = 3*(o + T[t]), b = 3*(o + T[t+1]), c = 3*(o + T[t+2]);
      const ux = x[b] - x[a], uy = x[b+1] - x[a+1], uz = x[b+2] - x[a+2], vx = x[c] - x[a], vy = x[c+1] - x[a+1], vz = x[c+2] - x[a+2];
      const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx, A2 = Math.sqrt(nx*nx + ny*ny + nz*nz), ul = Math.hypot(ux, uy, uz);
      if (A2 < 1e-12 || ul < 1e-12) { out[q] = 0; continue; }
      // the triangle's own frame: e1 along its first edge, e2 across it in its plane
      const e1 = [ux/ul, uy/ul, uz/ul], e2 = [(ny*e1[2] - nz*e1[1])/A2, (nz*e1[0] - nx*e1[2])/A2, (nx*e1[1] - ny*e1[0])/A2];
      let sxx = 0, syy = 0, sxy = 0;
      for (let e = 0; e < 3; e++) {
        const ce = te[3*q+e];
        if (ce < 0 || !sh[ce]) continue;
        const i = 3*sim.eI[ce], j = 3*sim.eJ[ce], dx = x[j] - x[i], dy = x[j+1] - x[i+1], dz = x[j+2] - x[i+2], l = Math.hypot(dx, dy, dz);
        if (l < 1e-12) continue;
        const p = (dx*e1[0] + dy*e1[1] + dz*e1[2])/l, r = (dx*e2[0] + dy*e2[1] + dz*e2[2])/l, s = F[ce]*l/sh[ce];
        sxx += s*p*p; syy += s*r*r; sxy += s*p*r;
      }
      const A = A2/2, m = (sxx + syy)/2, d = Math.sqrt((sxx - syy)*(sxx - syy)/4 + sxy*sxy);
      out[q] = (m + d)/A;
    }
  });
  return out;
};
// one pattern's contact forces, as clothRead() reads its points (zeros while it is off)
C.clothPressRead = function (sim, k, out) {
  const o = sim.off[k], m = (k + 1 < sim.off.length ? sim.off[k+1] : sim.n) - o;
  out = out || new Float32Array(m);
  for (let i = 0; i < m; i++) out[i] = sim.press ? sim.press[o + i] : 0;
  return out;
};
// how fast the cloth is moving: the mean speed of its free points, mm/s (settled when small)
C.clothSpeed = function (sim) {
  let s = 0, m = 0;
  for (let i = 0; i < sim.n; i++) if (sim.w[i] > 0) { s += Math.hypot(sim.v[3*i], sim.v[3*i+1], sim.v[3*i+2]); m++; }
  return m ? s/m : 0;
};
// the furthest any edge is from its length on the pattern, as a fraction of it
C.clothStrain = function (sim) {
  let worst = 0;
  for (let c = 0; c < sim.eI.length; c++) {
    const a = 3*sim.eI[c], b = 3*sim.eJ[c], len = Math.hypot(sim.x[a] - sim.x[b], sim.x[a+1] - sim.x[b+1], sim.x[a+2] - sim.x[b+2]);
    worst = Math.max(worst, Math.abs(len - sim.eL[c])/sim.eL[c]);
  }
  return worst;
};
// how far apart each seam's matched places are now: [{ seam, max, mean }]
C.clothSeamGaps = function (sim) {
  const out = [];
  for (let c = 0; c < sim.sA.length; c++) {
    let dx = 0, dy = 0, dz = 0;
    for (let k = 0; k < 6; k++) { const i = sim.sIdx[6*c+k]; if (i < 0) continue; const q = sim.sW[6*c+k]; dx += q*sim.x[3*i]; dy += q*sim.x[3*i+1]; dz += q*sim.x[3*i+2]; }
    const d = Math.hypot(dx, dy, dz), s = sim.sOf[c], e = out[s] || (out[s] = { seam: s, max: 0, mean: 0, n: 0 });
    e.max = Math.max(e.max, d); e.mean += d; e.n++;
  }
  for (const e of out) if (e) e.mean /= e.n;
  return out;
};

/* ---- seams as matching points ----
   A side of a seam is a path: the places it runs through in sewing order, each an anchor
   (cloth points with weights) and how far along the side it is.
   seamPath(nodes): nodes = [{ a: anchor, pos: [x, y] on the flat pattern, jump }], in order.
   jump: no cloth between the node before and this one (the mouth of a dart, or the step
   from one stretch of edge to the next), so that step has no length. */
C.seamPath = function (nodes) {
  const out = [];
  let s = 0;
  nodes.forEach((nd, k) => {
    if (k && !nd.jump) s += Math.hypot(nd.pos[0] - nodes[k-1].pos[0], nd.pos[1] - nodes[k-1].pos[1]);
    out.push({ a: nd.a, s, jump: !!nd.jump });
  });
  return { nodes: out, len: s };
};
// the anchor a distance s along a path: between two single cloth points it is a mix of the two, otherwise the nearer node's
C.pathAt = function (path, s) {
  const N = path.nodes;
  if (s <= 0) return N[0].a;
  if (s >= path.len) return N[N.length-1].a;
  let k = 1;
  while (k < N.length - 1 && N[k].s < s) k++;
  const a = N[k-1], b = N[k], span = b.s - a.s;
  if (span < 1e-9) return s - a.s < 1e-9 ? a.a : b.a;
  const t = (s - a.s)/span;
  if (t < 1e-6) return a.a;
  if (t > 1 - 1e-6) return b.a;
  if (a.a.i.length === 1 && b.a.i.length === 1 && a.a.p === b.a.p) return { p: a.a.p, i: [a.a.i[0], b.a.i[0]], w: [1 - t, t] };
  return t < 0.5 ? a.a : b.a;
};
/* The two sides matched in proportion to their lengths: places about `spacing` apart
   along the longer side, each with the place the same share of the way along the other,
   and the two ends of every stretch a side is made of.
   -> [[anchorA, anchorB], …] */
C.seamPairs = function (A, B, spacing, every) {
  const n = Math.max(1, Math.ceil(Math.max(A.len, B.len)/Math.max(spacing, 1e-6))), out = [];
  /* every (Round r9 / 3): besides the even places, every cloth point on either side gets its partner at the same share of
     the way along the other: no stretch of either edge is left between two stitches unheld */
  const fr = [];
  for (let k = 0; k <= n; k++) fr.push(k/n);
  if (every) for (const [P, Q] of [[A, B], [B, A]]) if (P.len > 0) for (const nd of P.nodes) if (!nd.jump) fr.push(nd.s/P.len);
  fr.sort((a, b) => a - b);
  for (let k = 0; k < fr.length; k++) if (!k || fr[k] - fr[k-1] > 1e-9) out.push([C.pathAt(A, A.len*fr[k]), C.pathAt(B, B.len*fr[k])]);
  // where a side steps from one stretch of cloth to the next (two edges of a 1:N seam, the two lips of a dart's
  // mouth), the end of the one and the start of the other are both sewn to the same place of the other side
  const steps = (P, Q, flip) => P.nodes.forEach((nd, k) => {
    if (!k || !nd.jump || !(P.len > 0)) return;
    const at = C.pathAt(Q, Q.len*nd.s/P.len);
    for (const a of [P.nodes[k-1].a, nd.a]) out.push(flip ? [at, a] : [a, at]);
  });
  steps(A, B, false); steps(B, A, true);
  // the same two places twice (an even place that falls on a step) are one stitch
  const key = (a) => a.p + ":" + a.i.join(",") + ":" + a.w.map(v => v.toFixed(9)).join(","), seen = new Set();
  return out.filter(([a, b]) => { const k = key(a) + "|" + key(b); if (seen.has(k)) return false; seen.add(k); return true; });
};
// the triangle of a flat mesh a point is in, as an anchor (the nearest triangle if it is in none)
C.triAnchor = function (xy, tri, x, y, p) {
  let best = null, bd = Infinity;
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t], b = tri[t+1], c = tri[t+2], ax = xy[2*a], ay = xy[2*a+1], bx = xy[2*b] - ax, by = xy[2*b+1] - ay, cx = xy[2*c] - ax, cy = xy[2*c+1] - ay, d = bx*cy - by*cx;
    if (Math.abs(d) < 1e-12) continue;
    const u = ((x - ax)*cy - (y - ay)*cx)/d, v = (bx*(y - ay) - by*(x - ax))/d, w0 = 1 - u - v;
    const out = Math.max(0, -u, -v, -w0);
    if (out < bd) { bd = out; const cu = Math.max(0, u), cv = Math.max(0, v), cw = Math.max(0, w0), sum = cu + cv + cw; best = { p, i: [a, b, c], w: [cw/sum, cu/sum, cv/sum] }; if (out === 0) break; }
  }
  return best;
};

/* ================================================================
   3D TOOLS: folds, measuring
     foldVerts(xy, c, folds)        a flat mesh folded along straight lines: (u, v, w) a point
     placeLocal(uvw, p3, out)       folded cloth put where its pattern is arranged
     rayField(f, o, d, max)         where a ray first meets the body (the distance field)
     girth(f, p, axis, n)           the body's outline in a plane, and its length
   ================================================================ */
/* A pattern's own axes are u (right on the page), v (up the page) and w (out of its
   face), from c, the middle of its box. A fold = { a: [x, y], b: [x, y], angle, side }:
   the cloth on one side of the line a -> b (side = 1: to its left looking along it on the
   page, where y is down; -1: to its right) is turned about the line by `angle` degrees,
   towards the face for a positive angle. Folds are made in the order given; a fold line
   lying in cloth an earlier fold moved is where that fold put it. -> Float32Array (u, v, w). */
C.foldVerts = function (xy, c, folds, out) {
  const n = xy.length >> 1;
  out = out || new Float32Array(3*n);
  for (let i = 0; i < n; i++) { out[3*i] = xy[2*i] - c[0]; out[3*i+1] = -(xy[2*i+1] - c[1]); out[3*i+2] = 0; }
  const done = [];
  // which side of the fold's line a flat point is on: 1 or -1 as the fold's own `side`
  const sideOf = (fd, x, y) => ((fd.b[0] - fd.a[0])*(y - fd.a[1]) - (fd.b[1] - fd.a[1])*(x - fd.a[0])) < 0 ? 1 : -1;
  const turn = (fd, A, d, p) => {                              // p turned about the line through A along d
    const th = fd.angle*Math.PI/180*fd.sgn, cs = Math.cos(th), sn = Math.sin(th);
    const rx = p[0] - A[0], ry = p[1] - A[1], rz = p[2] - A[2], dot = d[0]*rx + d[1]*ry + d[2]*rz;
    const cx = d[1]*rz - d[2]*ry, cy = d[2]*rx - d[0]*rz, cz = d[0]*ry - d[1]*rx;
    return [A[0] + rx*cs + cx*sn + d[0]*dot*(1 - cs), A[1] + ry*cs + cy*sn + d[1]*dot*(1 - cs), A[2] + rz*cs + cz*sn + d[2]*dot*(1 - cs)];
  };
  for (const fd of folds || []) {
    const len = Math.hypot(fd.b[0] - fd.a[0], fd.b[1] - fd.a[1]);
    if (!(len > 1e-9) || !fd.angle) continue;
    // the line's two ends as they stand after the folds before this one
    const at = (q) => { let p = [q[0] - c[0], -(q[1] - c[1]), 0]; for (const e of done) if (sideOf(e, q[0], q[1]) === e.side) p = turn(e, e.A, e.d, p); return p; };
    const A = at(fd.a), B = at(fd.b), d = [(B[0] - A[0])/len, (B[1] - A[1])/len, (B[2] - A[2])/len];
    // on the flat page the moved side lies to one hand of the line; turning it towards the face is this way round
    const e = { a: fd.a, b: fd.b, angle: fd.angle, side: fd.side === -1 ? -1 : 1, A, d, sgn: fd.side === -1 ? -1 : 1 };
    for (let i = 0; i < n; i++) {
      if (sideOf(e, xy[2*i], xy[2*i+1]) !== e.side) continue;
      const p = turn(e, A, d, [out[3*i], out[3*i+1], out[3*i+2]]);
      out[3*i] = p[0]; out[3*i+1] = p[1]; out[3*i+2] = p[2];
    }
    done.push(e);
  }
  return out;
};
// folded cloth in the world: as placePoint, with w the height above the pattern's own surface
C.placeLocal = function (uvw, p3, out) {
  const n = Math.floor(uvw.length/3), o = [0, 0, 0], r = p3.r > 0 ? p3.r : 0;
  out = out || new Float32Array(3*n);
  for (let i = 0; i < n; i++) {
    const u = uvw[3*i], v = uvw[3*i+1], w = uvw[3*i+2];
    if (r) { const a = u/r; qRot(p3.q, (r + w)*Math.sin(a), v, (r + w)*Math.cos(a) - r, o); } else qRot(p3.q, u, v, w, o);
    out[3*i] = o[0] + p3.pos[0]; out[3*i+1] = o[1] + p3.pos[1]; out[3*i+2] = o[2] + p3.pos[2];
  }
  return out;
};
/* Where a ray first meets the body: stepping along it by the distance the field gives
   (never past the skin), until within `eps` of it. -> the distance along the ray, or -1. */
C.rayField = function (f, o, d, max, eps) {
  max = max || 20000; eps = eps || 0.4;
  // first to the box of samples: outside it the field only says "far"
  const lo = [f.ox, f.oy, f.oz], hi = [f.ox + (f.nx - 1)*f.cell, f.oy + (f.ny - 1)*f.cell, f.oz + (f.nz - 1)*f.cell];
  let t0 = 0, t1 = max;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-12) { if (o[k] < lo[k] || o[k] > hi[k]) return -1; continue; }
    let a = (lo[k] - o[k])/d[k], b = (hi[k] - o[k])/d[k];
    if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a; if (b < t1) t1 = b;
  }
  if (t0 > t1) return -1;
  let t = t0;
  for (let it = 0; it < 400 && t <= t1; it++) {
    const dist = C.sdfSample(f, o[0] + d[0]*t, o[1] + d[1]*t, o[2] + d[2]*t, null);
    if (dist < eps) return t;
    t += Math.max(dist*0.9, 0.5);
  }
  return -1;
};
// the length round the convex hull of points in a plane (2 numbers a point): a tape pulled tight
C.hullLength = function (pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 2) return 0;
  const cr = (o, a, b) => (a[0] - o[0])*(b[1] - o[1]) - (a[1] - o[1])*(b[0] - o[0]), H = [];
  for (const p of P) { while (H.length >= 2 && cr(H[H.length-2], H[H.length-1], p) <= 0) H.pop(); H.push(p); }
  const lower = H.length + 1;
  for (let i = P.length - 2; i >= 0; i--) { const p = P[i]; while (H.length >= lower && cr(H[H.length-2], H[H.length-1], p) <= 0) H.pop(); H.push(p); }
  let L = 0;
  for (let i = 1; i < H.length; i++) L += Math.hypot(H[i][0] - H[i-1][0], H[i][1] - H[i-1][1]);
  return L;
};
/* The body's outline in the plane through p square to `axis` (a unit vector): from the
   middle of the body there, how far it reaches in n directions. -> { pts: [[x, y, z], …]
   (the outline, in order), surface (its length, following the skin), tape (the length of
   a tape pulled tight round it), centre } or null if p is not at the body. */
C.girth = function (f, p, axis, n) {
  n = n || 96;
  // two directions square to the axis
  const t = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let e1 = [axis[1]*t[2] - axis[2]*t[1], axis[2]*t[0] - axis[0]*t[2], axis[0]*t[1] - axis[1]*t[0]];
  const l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map(v => v/l1);
  const e2 = [axis[1]*e1[2] - axis[2]*e1[1], axis[2]*e1[0] - axis[0]*e1[2], axis[0]*e1[1] - axis[1]*e1[0]];
  const g = [0, 0, 0];
  // from the skin, a little way in; then to the middle of the body in the plane
  let c = p.slice();
  const d0 = C.sdfSample(f, c[0], c[1], c[2], g);
  if (d0 > 60) return null;
  { const gp = g[0]*axis[0] + g[1]*axis[1] + g[2]*axis[2], ix = g[0] - gp*axis[0], iy = g[1] - gp*axis[1], iz = g[2] - gp*axis[2], il = Math.hypot(ix, iy, iz) || 1, step = d0 + 15;
    c = [c[0] - ix/il*step, c[1] - iy/il*step, c[2] - iz/il*step]; }
  if (C.sdfSample(f, c[0], c[1], c[2], null) > 0) return null;
  for (let round = 0; round < 3; round++) for (const e of [e1, e2]) {
    const a = C.bodyReach(f, c[0], c[1], c[2], e[0], e[1], e[2], 600, 0), b = C.bodyReach(f, c[0], c[1], c[2], -e[0], -e[1], -e[2], 600, 0);
    if (a > 0 && b > 0) c = [c[0] + e[0]*(a - b)/2, c[1] + e[1]*(a - b)/2, c[2] + e[2]*(a - b)/2];
  }
  const pts = [], flat = [];
  for (let k = 0; k < n; k++) {
    const th = 2*Math.PI*k/n, cs = Math.cos(th), sn = Math.sin(th), d = [e1[0]*cs + e2[0]*sn, e1[1]*cs + e2[1]*sn, e1[2]*cs + e2[2]*sn];
    const r = C.bodyReach(f, c[0], c[1], c[2], d[0], d[1], d[2], 600, 0);
    pts.push([c[0] + d[0]*r, c[1] + d[1]*r, c[2] + d[2]*r]); flat.push([r*cs, r*sn]);
  }
  let surface = 0;
  for (let k = 0; k < n; k++) { const a = flat[k], b = flat[(k + 1) % n]; surface += Math.hypot(a[0] - b[0], a[1] - b[1]); }
  return { pts, surface, tape: C.hullLength(flat), centre: c };
};

C.selfPairs = selfPairs;                                    // (Round perf-2 / 4) for the tests: the pairs of a cloth now
return C;
}
const C = make();

/* ================================================================
   THE SOLVER IN A WORKER
   The cloth solver is plain arithmetic on arrays, so it can run off the page's own
   thread: the window then stays responsive however long a step takes.
     workerSource()        the text of a worker: this whole file again (make()), and
                           workerMain() to answer messages. The page makes the worker
                           from that text (a Blob), so there is no extra file to load,
                           and it works from a file, over http and in the desktop app.
     workerMain(C, self)   the worker's side. Messages in:
       { t: "build", id, spec, field? }  clothBuild(spec). The body's distance field is
                                         large, so it is sent only when it has changed
                                         (field: null = no body) and kept otherwise.
       { t: "step", id, n?, dt? }        n steps of dt (1 of 1/60), then a frame out
       { t: "pin", i, on, to? }          clothPin
       { t: "drag", d }                  clothDrag (d null: let go)
       { t: "forces", on }               clothForces: the contact and edge forces added up (the Stress and Pressure Maps)
       { t: "stop" }                     forget the cloth
     Messages out:
       { t: "built", id, n }
       { t: "frame", id, x, speed, frames, ms, press?, tens? }   x: every point, 3 numbers each, as 32-bit; press: each
                                                  point's contact force, tens: each triangle's tension, only while they are on
                                                  (its buffer is handed over, not copied)
       { t: "error", id, message }
   id is whatever the page gave with the build: a frame of an earlier build can be told
   from one of the current build.
   ================================================================ */
function workerMain(C, self) {
  let sim = null, field = null, id = 0;
  const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  self.onmessage = (e) => {
    const m = e.data || {};
    try {
      if (m.t === "build") {
        if (m.field !== undefined) field = m.field;
        id = m.id; sim = C.clothBuild(Object.assign({}, m.spec, { field }));
        if (m.forces) C.clothForces(sim, true);
        self.postMessage({ t: "built", id, n: sim.n });
      } else if (m.t === "step") {
        if (!sim || m.id !== id) return;
        const t0 = now();
        for (let k = 0; k < (m.n > 0 ? m.n : 1); k++) C.clothStep(sim, m.dt > 0 ? m.dt : 1/60);
        const x = new Float32Array(sim.x), press = sim.press ? new Float32Array(sim.press) : null, tens = sim.eFrc ? C.clothTension(sim) : null;
        self.postMessage({ t: "frame", id, x, speed: C.clothSpeed(sim), frames: sim.frames, ms: now() - t0, fill: sim.fillGroups || null, press, tens }, press ? [x.buffer, press.buffer, tens.buffer] : [x.buffer]);      // (fill: Round r11 / 2; press, tens: r20 continued (4))
      } else if (m.t === "pin") { if (sim) C.clothPin(sim, m.i, !!m.on, m.to || undefined); }
      else if (m.t === "drag") { if (sim) C.clothDrag(sim, m.d || null); }
      else if (m.t === "forces") { if (sim) C.clothForces(sim, !!m.on); }
      else if (m.t === "fill") { if (sim && m.id === id) C.clothFill(sim, m.fills || []); }
      else if (m.t === "stop") sim = null;
    } catch (err) { self.postMessage({ t: "error", id: m.id, message: String((err && err.message) || err) }); }
  };
}
C.workerMain = workerMain;
C.workerSource = () => "'use strict';\nconst SIM3D = (" + make.toString() + ")();\n(" + workerMain.toString() + ")(SIM3D, self);\n";

if (typeof module !== "undefined" && module.exports) module.exports = C;
root.SIM3D = C;
})(typeof globalThis !== "undefined" ? globalThis : this);
