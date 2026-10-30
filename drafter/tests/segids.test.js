// Stable segment ids: darts and seams stay on their edge through Add Point, Delete Point,
// True Up, Unfold, linked Mirror, undo snapshots and loading old files.
"use strict";
const assert = require("assert");
const { load } = require("./harness");

const S = { pieces: [], seams: [], nextSegId: 1, nextShapeId: 1, nextId: 1 };
const G = load(["GRADE_COLS", "defaultGrading", "normGrading", "gSize", "gGroup", "gTable", "isGraded", "mapDelta", "entryMap", "turnGrade", "mirrorGrade", "pruneGrade", "normGuides", "mkAnchor", "anchorAt", "measureInfo", "validMeasures", "affOf", "affApply", "affMul", "syncHalf", "chainIdx", "mkLinked", 
  "V", "cp", "sub", "add", "mul", "vlen", "dist", "clone",
  "bez", "bezTan", "nSeg", "sEnds", "segLen", "segPt", "segTan", "flatten",
  "signedArea", "inside", "reflectAcross", "reflector", "mapPiece", "byId", "sync", "mkPiece", "unfold",
  "newSegId", "segIx", "ensureSegIds", "maxSegId", "newShapeId", "ensureShapeIds", "maxShapeId", "normProps", "setCurve", "mkShape", "rectShape",
  "splitBez", "addPoint", "dartsOn", "seamSidesOn", "deletePoint", "lineX", "dartGeom", "applyDart", "addDartTo",
  "seamParts", "segLenT", "partSpans", "partLen", "partEnds", "sideInfo", "trimPart", "partCover", "partsOverlap", "partOn", "splitParts", "flipSeam", "seamTwist", "seamSide", "seamInfo", "seamEnds", "validSeams", "seamOn", "makeSeam", "loadSeams",
  "migrate", "resolveRefs", "alignMirrorIds", "NOTCH_DEFAULT", "normNotch", "loadDoc",
], { S });
const { V, mkShape, rectShape, mkPiece, addPoint, deletePoint, applyDart, addDartTo, dartGeom,
  seamInfo, seamEnds, seamOn, makeSeam, resolveRefs, segIx, unfold, sync, clone, loadDoc } = G;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " expected " + b + " ±" + tol + ", got " + a);
const samePt = (p, q, msg) => { near(p.x, q.x, 1e-9, (msg || "") + " x"); near(p.y, q.y, 1e-9, (msg || "") + " y"); };
const T = [];
const test = (name, fn) => T.push({ name, fn });

// Front: a 6-point straight-edged bodice. Edge 3 (pts3→pts4) carries a dart and is
// sewn to Back's edge 1; Front edge 4 is sewn to Back edge 2.
function setup() {
  S.pieces = []; S.seams = []; S.nextSegId = 1; S.nextId = 1;
  const F = mkPiece("Front", mkShape([V(0,0), V(70,10), V(190,40), V(150,220), V(170,480), V(0,495)], true));
  const B = mkPiece("Back", mkShape([V(300,0), V(460,30), V(470,480), V(300,495)], true));
  S.pieces.push(F, B);
  addDartTo(F, 3, 0.4, 20, 80);
  S.seams.push(makeSeam(S.seams, { piece: F.id, sid: F.segs[3].id }, { piece: B.id, sid: B.segs[1].id }, false));
  S.seams.push(makeSeam(S.seams, { piece: F.id, sid: F.segs[4].id }, { piece: B.id, sid: B.segs[2].id }, true));
  return { F, B };
}
// world-space fingerprint of what must not move: dart points + both seams' ends and lengths
function snapshot(F) {
  const g = dartGeom(F, F.darts[0]);
  return { C: g.C, legL: g.legL, legR: g.legR, apex: g.apex,
    seams: S.seams.map(sm => ({ ends: seamEnds(sm, S.pieces), inf: seamInfo(sm, S.pieces) })) };
}
function assertUnmoved(F, before, msg) {
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(F.darts.length, 1, msg + ": dart survives");
  const now = snapshot(F);
  for (const k of ["C", "legL", "legR", "apex"]) samePt(now[k], before[k], msg + " dart " + k);
  assert.strictEqual(now.seams.length, before.seams.length, msg + ": seams survive");
  now.seams.forEach((s, j) => {
    s.ends.flat().forEach((q, m) => samePt(q, before.seams[j].ends.flat()[m], msg + " seam S" + (j+1) + " end " + m));
    near(s.inf.diff, before.seams[j].inf.diff, 1e-9, msg + " seam S" + (j+1) + " diff");
  });
}

test("Add Point before the dart and seam edge: both stay on the same edge", () => {
  const { F } = setup(), before = snapshot(F), sid = F.segs[3].id;
  addPoint(F, 1, 0.5);                          // split edge 1 → edge 3 is now index 4
  assert.strictEqual(segIx(F, sid), 4);
  assertUnmoved(F, before, "after add");
  addPoint(F, 0, 0.3); addPoint(F, 0, 0.6);     // two more before it
  assert.strictEqual(segIx(F, sid), 6);
  assertUnmoved(F, before, "after three adds");
});

test("Delete Point before the dart and seam edge: both stay on the same edge", () => {
  const { F } = setup(), before = snapshot(F), sid = F.segs[3].id;
  deletePoint(F, 1);                            // removes edge 1; edge 0 now runs pts0→old pts2
  assert.strictEqual(segIx(F, sid), 2);
  assertUnmoved(F, before, "after delete");
  deletePoint(F, 0);                            // remove the first point too (wraps edge ids)
  assert.strictEqual(segIx(F, sid), 1);
  assertUnmoved(F, before, "after two deletes");
});

test("random mix of adds and deletes elsewhere never moves the dart or seams", () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let run = 0; run < 25; run++) {
    const { F } = setup(), before = snapshot(F), sidD = F.segs[3].id, sidS = F.segs[4].id;
    for (let step = 0; step < 12; step++) {
      const iD = segIx(F, sidD), iS = segIx(F, sidS), n = F.pts.length;
      const protectedPts = new Set([iD, (iD+1) % n, iS, (iS+1) % n]);   // ends of the watched edges
      if (rnd() < 0.55 || n <= 5) {
        let i = Math.floor(rnd() * n); if (i === iD || i === iS) i = (Math.max(iD, iS) + 1) % n;
        if (i === iD || i === iS) continue;
        addPoint(F, i, 0.2 + 0.6 * rnd());
      } else {
        const k = Math.floor(rnd() * n);
        if (protectedPts.has(k)) continue;
        deletePoint(F, k);
      }
      S.seams = resolveRefs(S.pieces, S.seams);
    }
    assertUnmoved(F, before, "run " + run);
  }
});

test("splitting the dart's own edge keeps the dart and notches where they were", () => {
  const { F } = setup();
  F.segs[3].notches = [0.2, 0.8];
  const i = 3, notchW = F.segs[3].notches.map(t => segPtW(F, i, t)), before = dartGeom(F, F.darts[0]);
  addPoint(F, 3, 0.25);                          // split before the dart (dart at 0.4)
  const g = dartGeom(F, F.darts[0]);
  samePt(g.C, before.C, "dart centre"); samePt(g.apex, before.apex, "dart apex");
  assert.strictEqual(F.darts[0].sid, F.segs[4].id, "dart moved to the second half");
  const notchesNow = [...F.segs[3].notches.map(t => segPtW(F, 3, t)), ...F.segs[4].notches.map(t => segPtW(F, 4, t))];
  notchesNow.forEach((q, j) => samePt(q, notchW[j], "notch " + j));
  // the seam covers both halves: the old id plus the new one
  assert.deepStrictEqual(S.seams[0].a[0].sids.map(id => segIx(F, id)), [3, 4]);
});
const segPtW = (p, i, t) => G.segPt(p, i, t);

test("deleting an end point of the dart/seam edge: the dart goes with its edge, sewing is maintained", () => {
  const { F } = setup();
  deletePoint(F, 4);                             // point 4 ends edge 3 → edge 4 is removed, edge 3 grows over it
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(F.darts.length, 1, "dart on edge 3 kept (edge 3 now runs to old point 5)");
  assert.deepStrictEqual(S.seams.map(s => s.id), [1, 2], "edges 3 and 4 had different seams: both stay, each on its stretch of the grown edge");
  assert.deepStrictEqual(S.seams.map(s => s.a[0].sids), [[F.segs[3].id], [F.segs[3].id]]);
  const { F: F2 } = setup();
  deletePoint(F2, 3);                            // removes edge 3 itself; unsewn edge 2 grows over it
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(F2.darts.length, 0, "dart on the removed edge dropped");
  assert.deepStrictEqual(S.seams.map(s => s.id), [1, 2], "seam S1 moves onto the grown edge");
  assert.deepStrictEqual(S.seams[0].a[0].sids.map(id => segIx(F2, id)), [2]);
});

test("True Up keeps later darts and seams on their edges; the trued edge's seam runs either side of the dart", () => {
  const { F } = setup();
  addDartTo(F, 4, 0.5, 16, 60);                  // a second dart on edge 4 (which has seam S2)
  addDartTo(F, 3, 0.8, 10, 40);                  // a third dart on the same edge as the first
  F.segs[3].notches = [0.1];
  const g2 = dartGeom(F, F.darts[1]), g3 = dartGeom(F, F.darts[2]), notch = G.segPt(F, 3, 0.1);
  const s2 = { ends: seamEnds(S.seams[1], S.pieces), diff: seamInfo(S.seams[1], S.pieces).diff };
  const s1 = { ends: seamEnds(S.seams[0], S.pieces), la: seamInfo(S.seams[0], S.pieces).la };
  assert.ok(applyDart(F, F.darts[0]), "made: it gives the ids of the two legs since Round F / 7");
  S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(F.darts.length, 2, "trued dart removed, others kept");
  samePt(dartGeom(F, F.darts[0]).C, g2.C, "dart on later edge");
  samePt(dartGeom(F, F.darts[1]).C, g3.C, "other dart on the trued edge");
  assert.deepStrictEqual(S.seams.map(s => s.id), [1, 2], "seam on the trued edge kept");
  seamEnds(S.seams[1], S.pieces).flat().forEach((q, m) => samePt(q, s2.ends.flat()[m], "S2 end " + m));
  near(seamInfo(S.seams[1], S.pieces).diff, s2.diff, 1e-9);
  // S1 now covers start→leg and leg→end: same ends, and the same sewn length, because the
  // live dart's width was already taken off it
  assert.strictEqual(S.seams[0].a[0].sids.length, 2);
  seamEnds(S.seams[0], S.pieces).flat().forEach((q, m) => samePt(q, s1.ends.flat()[m], "S1 end " + m));
  near(seamInfo(S.seams[0], S.pieces).la, s1.la, 1e-9, "S1 sewn length");
  const nIx = F.segs.findIndex(s => s.notches.length);
  samePt(G.segPt(F, nIx, F.segs[nIx].notches[0]), notch, "notch on trued edge");
});

test("segment ids are unique within every shape after edits and unfold", () => {
  const { F } = setup();
  addPoint(F, 2, 0.5); deletePoint(F, 1); applyDart(F, F.darts[0]);
  const U = unfold(F, 0);
  for (const p of [F, U]) assert.strictEqual(new Set(p.segs.map(s => s.id)).size, p.segs.length, p.name);
  // the unfolded piece's kept half carries the source's ids
  const keep = new Set(F.segs.map(s => s.id));
  assert.strictEqual(U.segs.filter(s => keep.has(s.id)).length, F.segs.length - 1);
});

test("linked mirror: same ids as its source, so its seam and dart follow source edits", () => {
  const { F, B } = setup();
  const M = clone(F); M.id = S.nextId++; M.link = { of: F.id, kind: "symmetric", m: G.affOf(G.reflector(V(250, 0), V(250, 500))) };
  S.pieces.push(M); sync();
  assert.deepStrictEqual(M.segs.map(s => s.id), F.segs.map(s => s.id));
  S.seams.push(makeSeam(S.seams, { piece: M.id, sid: M.segs[3].id }, { piece: B.id, sid: B.segs[3].id }));
  const mBefore = seamEnds(S.seams[2], S.pieces), dBefore = dartGeom(M, M.darts[0]).C;
  addPoint(F, 1, 0.5); addPoint(F, 3 + 1, 0.2);  // one before, one splitting the dart edge (before the dart)
  sync(); S.seams = resolveRefs(S.pieces, S.seams);
  assert.strictEqual(S.seams.length, 3);
  // seam on the mirror: first half of the split edge, starting at the same corner
  samePt(seamEnds(S.seams[2], S.pieces)[0][0], mBefore[0][0], "mirror seam start");
  samePt(dartGeom(M, M.darts[0]).C, dBefore, "mirror dart");
});

test("undo snapshots (JSON) keep ids and references intact", () => {
  const { F } = setup();
  const snap = JSON.stringify({ pieces: S.pieces, seams: S.seams });
  const before = snapshot(F);
  addPoint(F, 1, 0.5); deletePoint(F, 5); S.seams = resolveRefs(S.pieces, S.seams);
  const d = JSON.parse(snap); S.pieces = d.pieces; S.seams = d.seams;
  assertUnmoved(S.pieces[0], before, "after undo");
  assert.ok(S.pieces[0].segs.every(s => Number.isInteger(s.id)));
});

test("old files load: ids assigned, darts and v4 seams converted from indices, mirrors aligned", () => {
  S.pieces = []; S.seams = []; S.nextSegId = 1;
  const raw = (pts) => ({ pts, segs: pts.map(() => ({ curved: false, c1: null, c2: null, notches: [] })), sa: 10 });
  const oldF = { id: 1, name: "Front", on: true, ...raw([V(0,0), V(70,10), V(190,40), V(150,220), V(170,480), V(0,495)]),
    darts: [{ seg: 3, t: 0.4, width: 20, depth: 80, folded: false }] };
  const oldB = { id: 2, name: "Back", on: true, ...raw([V(300,0), V(460,30), V(470,480), V(300,495)]) };
  const oldM = { id: 3, name: "Front ⇄", on: true, mirrorOf: 1, axis: { a: V(250,0), b: V(250,500) },
    ...raw([V(500,0), V(430,10), V(310,40), V(350,220), V(330,480), V(500,495)]),
    darts: [{ seg: 3, t: 0.4, width: 20, depth: 80, folded: false }] };
  const file = JSON.parse(JSON.stringify({ v: 4, nextId: 4, pieces: [oldF, oldB, oldM],
    seams: [{ id: 1, a: { piece: 1, seg: 3 }, b: { piece: 2, seg: 1 }, rev: false },
            { id: 2, a: { piece: 3, seg: 4 }, b: { piece: 2, seg: 2 }, rev: true }] }));
  loadDoc(file);
  const [F, B, M] = S.pieces;
  for (const p of S.pieces) {
    assert.ok(p.segs.every(s => Number.isInteger(s.id)), p.name + " has ids");
    assert.strictEqual(new Set(p.segs.map(s => s.id)).size, p.segs.length);
    assert.ok(p.segs.every(s => s.sa === 10), "v2 piece-level sa still migrates");
  }
  // Round F / 7: the dart, converted from its index, is made into the outline when the file comes in (bakeDarts()): segment 3
  // is cut either side of it and the two legs between are sewn to each other; the seam that ran along segment 3 runs either side
  assert.deepStrictEqual([F.darts.length, F.pts.length], [0, 9], "the dart is three more points of the outline");
  const legs = S.seams.find(s => s.a[0].piece === F.id && s.b[0].piece === F.id);
  assert.deepStrictEqual(legs && [segIx(F, legs.a[0].sids[0]), segIx(F, legs.b[0].sids[0])], [4, 5], "the legs, sewn to each other");
  // (Round r17a / 4: either side as two parts, M:N, the take-up left out; it was one part [3, 6] stepping over the legs)
  assert.deepStrictEqual(S.seams.filter(s => s !== legs && s.a[0].piece === F.id).map(s => [s.a.map(x => x.sids.map(id => segIx(F, id))), segIx(B, s.b[0].sids[0])]), [[[[3], [6]], 1]],
    "the v4 seam converted from indices runs either side of the dart");
  assert.ok(S.nextSegId > Math.max(...S.pieces.flatMap(p => p.segs.map(s => s.id))));
  // the mirror is rebuilt from its source on the first commit; its dart (its legs, sewn) and its seam must survive that
  sync(); S.seams = resolveRefs(S.pieces, S.seams);
  assert.deepStrictEqual([M.darts.length, M.pts.length], [0, 9], "the mirror has the dart's points too");
  assert.strictEqual(S.seams.length, 4, "both seams, and the legs sewn on the pattern and on its mirror");
  assert.ok(S.seams.some(s => s.a[0].piece === M.id && s.b[0].piece === M.id && segIx(M, s.a[0].sids[0]) === 4), "the mirror's legs are sewn");
  assert.ok(S.seams.some(s => s.a[0].piece === M.id && s.b[0].piece === B.id), "mirror seam survives first sync");
});

test("v5 files keep their ids, and the id counter starts above them", () => {
  const { F } = setup();
  const text = JSON.stringify({ v: 5, nextId: S.nextId, nextSegId: S.nextSegId, pieces: S.pieces, seams: S.seams });
  const ids = F.segs.map(s => s.id), counter = S.nextSegId;
  S.pieces = []; S.seams = []; S.nextSegId = 1;
  loadDoc(JSON.parse(text));
  // Round F / 7: the dart takes three new ids from the counter (its two cut points' segments and its second leg)
  assert.strictEqual(S.nextSegId, counter + 3);
  // the segments that were there keep their ids
  const P = S.pieces[0], kept = P.segs.map(s => s.id).filter(id => ids.includes(id));
  assert.deepStrictEqual(kept, ids, "every segment of the file keeps its id, in order");
  assert.deepStrictEqual([P.darts.length, P.segs.length], [0, ids.length + 3]);
  assert.strictEqual(seamOn(S.seams, P.id, ids[3]).id, 1);
});

module.exports = T;
