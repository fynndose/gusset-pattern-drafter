# The .zprj project file, as far as the importer reads it

What `drafter/zprj-import.js` relies on. It was worked out by looking at project files saved by their owner (a 500 × 500 mm square, then a jacket of 33 patterns), changing one thing at a time. No program code was decompiled or copied, and nothing encrypted was opened. Checked on files written in 2026 only; other versions may differ.

The importer takes the user's own pattern data and nothing else: outlines, curve points, seam allowance, notches, internal lines, reference lines, names, 2D placement, grading, grainlines, symmetric pairs, sewing, which fabric a pattern is cut from (by name), each pattern's place and drape in 3D, and the graphics on the patterns with their pictures. Fabrics, textures, avatars (but for the height of the one the garment was draped on) and render data are not looked at.

## Container

```
file.zprj        a ZIP archive with a binary header in front of it
 ├─ <name>.zpac  pattern and garment data: a ZIP again, also with bytes in front
 │    └─ <name>.pac   the pattern data (see below); beside it textures and settings (not read)
 └─ other entries     lighting, materials, render presets, scene, camera (not read)
```

The bytes in front shift every offset the archive records. The importer finds the end-of-central-directory record, takes the central directory to end right before it, and corrects offsets by the difference to the recorded one.

**Protection.** If the `.zpac` or the `.pac` entry is flagged as encrypted, or the `.pac` is not readable as the tree below and looks scrambled (more than 7.5 bits of information per byte and no key name in it), the file is refused as "encrypted or protected". The importer never tries to open such a file. Pattern data that is merely unfamiliar (cut short, bytes left over, no pattern list) is refused as "unknown layout".

## The .pac tree

One root **map**, little-endian throughout.

| Type | Code | Layout |
|---|---|---|
| map | `0x16` | `u8 n`, `n × u8` key lengths, `n × u8` type codes, `n × u32` value sizes, then `n ×` (key bytes in Latin-1, value bytes) |
| list | `0x14` | `u32 count`; if not zero: `u8` element type, `count × u32` sizes, the elements |
| bool | `0x01` | 1 byte |
| int32 / uint32 / float32 | `0x04` / `0x05` / `0x06` | 4 bytes |
| vec2, vec3, vec4 | `0x0a`, `0x0b`, `0x0c` | 2, 3, 4 × float32 |
| mat3, mat4 | `0x0d`, `0x0e` | 9, 16 × float32 |
| string or raw bytes | `0x0f` | as many bytes as the size says (text is UTF-8) |
| typed array | `0x15` | `u32 count`, `u8` element type, data |

Key names carry their type as a prefix: `b` bool, `i` int, `ui` uint, `f` float, `qs` string, `v2` vec2, `m3` mat3, `ba` byte array, `map`, `list`, `arr`. The parser must use up the file to its last byte; if it does not, the layout is not this one.

**Text.** A string key comes twice: the plain key (`qsName`) and the same key with `UTF8` added (`qsNameUTF8`). In the files known both hold the same bytes, all plain ASCII. The importer reads the `UTF8` key first, then a `UTF16` key (none seen), then the plain key, the first that is there and not empty; the plain key is read as UTF-8 when it is valid UTF-8, as UTF-16 (little end first) when it starts with a byte-order mark or has a zero after every character, else as Latin-1. A trailing NUL is dropped. Every name is read so: patterns, internal and reference lines, sizes and size tables, fabrics, seams, zippers.

## Where the patterns are

```
root.mapPatternEditor.mapPatternList.listPattern[]      one map per pattern
  .mapElement.qsName                    its name, as the object browser shows it (also .qsNameUTF8, read first); a pattern
                                        with none is called "Pattern N" (N its place in the list)
  .mapAnnoForPatternName.qsText         the annotation shown on the pattern: the name people use
  .mapShape2D                           the outline
     .mapTransformer2D.m3Matrix         placement in the 2D window
     .listPoint[].v2Position            outline points, in the pattern's own millimetres
     .listLine[]                        outline lines, in order, closing on itself
        .uiStartPointIndex, .uiEndPointIndex
        .iLineType                      0 straight, 2 curve
        .listPoint[].v2Position         curve points (curved lines only)
        .fSAStartOffset, .fSAEndOffset  seam allowance at the line's two ends, mm
        .listNotch[]                    .v2StartPosition (the place on the outline), .fLength, .fLocalAngle (90 = square to the line),
                                        .uiNotchType, .fAlpha (share of the line)
     .baSAPositions                     the program's own computed cut line: float32 x, y pairs
  .listInnerShape[]                     internal lines: .qsInnerShapeName, own .mapTransformer2D (into the pattern's coordinates),
                                        .listPoint, .listLine as above
  .listDummyShape[]                     reference and base lines: .qsDummyShapeName, .mapShape2D; the one with
                                        .bSeamAllowanceShape = 1 is the allowance helper and is skipped
```

## Missing keys

The program that writes these files leaves keys out now and then: a file may have no `fSAStartOffset` / `fSAEndOffset` on its lines, no `baSAPositions`, no annotation. So **every key the importer reads is optional except what a pattern cannot exist without**: the outline's `listPoint` with each point's `v2Position`, its `listLine`, and each line's `uiStartPointIndex` and `uiEndPointIndex`. A missing optional key gets a default (`ZPRJ.DEFAULTS` lists them: an allowance offset 0, no stored cut line, no notches, placed as drawn, a curve point without a place left out, …), and each default is counted; the import report says which keys and how often. A value of the wrong kind counts as missing.

A pattern without what it cannot exist without is left out and named with its reason; the other patterns come through. An internal or reference shape that cannot be read is left out of its pattern alone. A pattern with a `mapNewTape` is a zipper's tape (made by the zipper tool) and is skipped as such. Only a file with no pattern list at all is refused.

## Geometry

- **Lines.** A straight line runs from its start point to its end point. A curved line is a **natural cubic spline through [start point, ...curve points, end point], parameterised by chord length**: knots `t0 = 0`, `t(i+1) = t(i) + |P(i+1) − P(i)|`, second derivative zero at both ends. Each line is a spline of its own, so directions are not continuous from one line to the next: a corner between two lines is real.
- **As Béziers.** With `M` the second derivatives (from the tridiagonal system with `M0 = M(n−1) = 0`) and `h = t(i+1) − t(i)`:
  `S'(t_i) = (P(i+1) − P_i)/h − h(2M_i + M(i+1))/6`, `S'(t(i+1)) = (P(i+1) − P_i)/h + h(M_i + 2M(i+1))/6`, and the span is the cubic `[P_i, P_i + S'(t_i)·h/3, P(i+1) − S'(t(i+1))·h/3, P(i+1)]`. Where a pattern has no seam allowance its stored cut line is the program's own sampled outline, and this curve lies on it to under a thousandth of a millimetre.
- **Placement.** `m3Matrix` is 9 floats, row-major, for row vectors: `x' = x·M[0] + y·M[3] + M[6]`, `y' = x·M[1] + y·M[4] + M[7]`. **The 2D window is y-up**: the resting cloth of each pattern (`mapFabricShape2D.mapMesh2D.baRest`, float32 x, y pairs) is in window coordinates, and its y follows height on the body in 3D (`mapMesh3D.baPos3D`) at a correlation of 0.999 on every pattern of a jacket. This program's window is y-down, so the importer turns the window over top to bottom (before Round I it did not, and patterns came in upside down). A negative determinant of the upper-left 2 × 2 means the pattern is mirrored; left and right of a pair are separate patterns with the same local shape.
- **Seam allowance** is per line, and may differ at a line's two ends (a taper).

## Grading

```
root.mapPatternEditor.listRuleTables[]                 one size table (a size group) each; the files known have one
  .qsMVGradingItem_GradeRuleName        its name ("Size Group"); a pattern's .qsGradeRuleName names the table it is graded by
  .listGradingNode[]                    its sizes, in order: .qsMVGradingRuleData_Size (the size's name),
                                        .v4MVGradingRuleData_Color (red, green, blue, alpha, 0 to 1), .bMVGradingRuleData_Visible
  .uiDefaultSizeIndex                   the base size: the size the patterns are drawn in (v2Position)
  .uiCurrentSizeIndex                   the size shown when the file was saved
root.mapPatternEditor.mapPatternList.listSizeName      a list of size names (empty in the files known; read only when there is no table)
...listPoint[].arrSizeSpecificPosition  a point's place in every size: typed array (0x15) of vec2, one per size, in the table's order
...listLine[].listPoint[].arrPointSizeSpec             the same for a curve point
```

Each place is absolute, in the pattern's own coordinates (as `v2Position`), and the base size's place is `v2Position` itself. So the importer takes every point and every curve point as a grade point with its own offset in each size: its place in that size less its place as drawn, both through the pattern's placement. Internal and reference lines have the same arrays. Notches have none: they keep their share of their line. `iGradeRuleIdentifier` (−1 where it is present) and `bGradedPoint` are not read. A file with a single size is not graded.

## Grainline and fabric

`listPattern[].mapFabricShape2D`: `.iFabricIndex` (an index into the root's `listFabric[]`: `.qsName`, `.fabricType` "Woven" / "Knit", `.fabricContent`), `.listGrainLineInfo[0]` (`.fAngle` in degrees, `.v2Translation`), `.m3LtoUV` (pattern to texture coordinates, not read). `fAngle` is measured from up the pattern (its own +y, y up), anticlockwise positive, in the pattern's own coordinates; the pattern's placement (`m3Matrix`) then turns and mirrors the line with the pattern. So a jacket's 270 on a pattern placed turned by 90° (and −270 on its mirrored twin) is a line straight up and down in the window, and 0.8 on an unturned pattern leans 0.8° with its top to the left. Checked against what the program that wrote the files shows, on three files.

## Symmetric pairs and copies

`mapPatternList.arrSymmetricIndex`: typed array (0x15) of int32, one per pattern: the index of its mirrored twin, or −1 (a pair names each other). `mapPatternList.listInstance[i].arrInstanceIndex`: the copies of pattern i (empty in the files known). The two of a pair have exactly the same points and curve points in their own coordinates (and the same places in every size); only their placements differ, by a mirror. `listPattern[].mapSymmetry` (`iSymmetryStatus`, `m3LocalSymmetricMatrix`) is not needed for that and not read. A pattern of one half unfolded (`mapShape2D.bHalfSymmetric`) is not in the files known and not read.

## Sewing

```
root.mapPatternEditor.mapSeamLinePairGroup.listSeamLinePairGroup[]     one seam each
  .mapElement.qsName
  .listParamLineGroup0[], .listParamLineGroup1[]      its two sides: runs of outline, sewn in this order
     .uiSelfIndex        the pattern (index in listPattern)
     .uiStartIndex       the outline line the run starts on (index in its listLine), .fRatioStart where on it
     .uiEndIndex         the line it ends on, .fRatioEnd where on that one (a share of the line's length, 0 at its start point)
     .bDirection         1: along the outline's own direction (start, start + 1, …, end), 0: against it
     .uiDepth            1 in every run seen; not read
```

Read so, the two sides of a jacket's side seams have the same length to a tenth of a millimetre and their ends meet at the same height. `arrSelfIndex` pairs a seam with its mirror image on the other half; `mapSeamLinePairGroupWithHalfSymmetry` holds the same seams again for a half-symmetric view; neither is read. A seam to a pattern that is not imported (a zipper's tape) is left out.

## 3D: the cloth as it was last simulated, and the avatar's height

```
listPattern[].mapFabricShape2D.mapMesh2D
   .baRest                 the pattern's cloth mesh at rest: float32 x, y pairs, in the 2D window (the outline put through
                           the pattern's placement lies on it exactly)
   .baTri                  its triangles: uint32 point numbers, three each
listPattern[].baPosition3D the same points in 3D: float32 x, y, z each (mapMesh3D.baPos3D holds the same, where it is there)
root.mapAvatar.qsAvatarID  the avatar's name
root.mapAvatar.mapResizingAvatar.listFeatureValues   float32 body measurements in centimetres; the first is taken as the height
```

The 3D space is millimetres, y up, the floor at y = 0 (gravity −9800 along y in the simulation settings), the avatar facing +z with its left side at +x: the same as this program's. Seen from outside, each pattern's resting cloth (its window x and y, y up) goes to its cloth in 3D by a turn, not a mirror, with the outside facing outward: so the window shows every pattern from outside. `baPosition3D` is the cloth as last simulated (the jacket's: within 0.3 % of its rest lengths; a skin-tight swimsuit's: stretched 3 to 17 %).

The importer gives each pattern its place in 3D once: the flat pattern turned and moved to lie as near as it can to that cloth (a rigid fit over all its points). And it gives its own cloth the file's drape: every point of it takes the place of the same spot of the file's cloth (the file's triangle there, weighted). The file's avatar is not this program's, so the points are first fitted by the floor and by the upright axis through the origin, scaled about them by the ratio of the two avatars' heights; no body is morphed onto another.

The `.zprj` also holds a `.pos` entry inside its `.zpac` (175 KB in swimskin, a header that starts " POS" and names the program) and the avatar itself (`<name>_0.avt`). Neither is read: the avatar is never imported, and `baPosition3D` already holds every pattern's points.

## Graphics (prints and logos)

```
mapPatternEditor.listMVGraphic[]                   one graphic each: .mapElement.qsName, .uiGraphicStyleIndex
  .listOverlayFabricShape2D[]                      where it lies, once per pattern it is on:
     .uiParentPatternSelfIndex                     the pattern (index in listPattern)
     .mapShape2D.mapTransformer2D.m3Matrix         the graphic's own coordinates into the pattern's
     .mapShape2D.listPoint[].v2Position            its corners in its own coordinates (±width/2, ±height/2, mm)
     .enRepeatType                                 0: placed once
     .mapElement.bVisible, .qsUuid
root.listGraphicStyle[uiGraphicStyleIndex]
  .mapGrapghicFabric.mapMaterial2D.listFaceMaterial[0].listTexture[0].qsFileName    the picture: an entry of the garment archive
listPattern[].listPrintTexture[]                   the same placement again on the pattern itself (same qsUuid)
```

The importer takes a graphic's placement (its middle, size and turn, through the pattern's placement into the window) and its picture (the archive entry of that name, if it is a PNG, JPEG, GIF, WebP or BMP). Only pictures that a graphic names are read: a fabric's textures and maps (named in `listFabric`), the zipper's (`listZipperStyle`, `listZipper`) and the seams' are never looked at. Which way up the picture lies (its top toward the window's +y) is assumed, not checked.

## Known to be in the file, not read

Notch types, seam allowance corner options, the fabrics' physical properties and colors, topstitches, zippers (`listZipper`: tape, teeth, slider, puller, stoppers), trims, arrangement (`mapArrange`: the arrangement point a pattern was put on, its height and arc length on it), the avatar, the rest of the 3D scene.
