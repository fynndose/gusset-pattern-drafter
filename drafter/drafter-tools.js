/* ================================================================
   TOOL REGISTRY — the one list of tools the toolbars are built from.
   Every 2D and 3D toolbar tool is here, built or not.

   A tool:  [ id, name, key, group, status, icon, tip, more ]
     id      what the app calls it (S.tool); never change the id of a built tool
     key     its shortcut, "" if none. A key is only bound if the tool is built, or
             if nothing built uses it (then it shows the "not built yet" note)
     group   the toolbar slot it sits in: tools of one group share a button and open
             as a list when the button is held. The first is the one shown.
     status  "built"    works here
             "partly"   works in part, or in another way than the name suggests (the tip or `via` says how)
             "unbuilt"  a placeholder: marked, and a click only shows a note
             "later"    a placeholder that is out of this stage's scope (Round r10 / 0): kept here, but left
                        off the toolbars unless the feature flag `later` is on (featureOn() in the app;
                        a menu still lists it as "not built yet" while Show Tools That Are Not Built Yet is on)
     icon    "glyph" or "glyph+badge", drawn from GLYPHS / BADGES below
     tip     one short line, this project's own words
     more    { via: "…" }  the tool has no mode of its own here; the text says where
                           the command is instead (a click shows it)
             { toggle: "name" }  a switch, not a mode
   A group: [ id, window ("2D" | "3D"), section ]   sections are separated by a rule.

   Icons are this project's own line drawings on a 24 × 24 grid, one stroke
   weight, no artwork from anywhere else.
   This file must not contain the strict-mode directive string: the test harness
   tells the app script from the others by it.
   ================================================================ */
var TOOL_REGISTRY = (function () {
  var GROUPS = [
    // ---- 2D window ----
    ["select", "2D", "Select"],
    ["edit", "2D", "Edit"],
    ["pattern", "2D", "Create"], ["internal", "2D", "Create"], ["base", "2D", "Create"], ["trace", "2D", "Create"],
    ["fullness", "2D", "Shape"], ["pleats", "2D", "Shape"],
    ["notch", "2D", "Markings"], ["allowance", "2D", "Markings"], ["annotation", "2D", "Markings"], ["measure", "2D", "Markings"],
    ["edit_sew", "2D", "Sewing"], ["seg_sew", "2D", "Sewing"], ["free_sew", "2D", "Sewing"], ["check_sew", "2D", "Sewing"],
    ["topstitch", "2D", "Stitch"], ["puckering", "2D", "Stitch"],
    ["texture", "2D", "Material"], ["graphic2", "2D", "Material"], ["button2", "2D", "Material"], ["layer", "2D", "Material"], ["drafter", "2D", "Material"],
    // ---- 3D window ----
    ["simulate", "3D", "Simulate"], ["select3", "3D", "Simulate"], ["mesh", "3D", "Simulate"], ["pin", "3D", "Simulate"],
    ["arrange", "3D", "Arrange"], ["resolution", "3D", "Arrange"],
    ["edit_sew3", "3D", "Sewing"], ["seg_sew3", "3D", "Sewing"], ["free_sew3", "3D", "Sewing"], ["auto_sew", "3D", "Sewing"], ["tack", "3D", "Sewing"], ["press", "3D", "Sewing"], ["stitch3", "3D", "Sewing"], ["notch3", "3D", "Sewing"],
    ["pen_garment", "3D", "Draw"], ["pen_avatar", "3D", "Draw"], ["style_line", "3D", "Draw"],
    // Zipper (Round r12 / 1, the maintainer's decision): on the 3D toolbar, and in hand it works on the 2D patterns as well
    ["button", "3D", "Trims"], ["zipper", "3D", "Trims"], ["fill3", "3D", "Trims"], ["piping", "3D", "Trims"], ["bond", "3D", "Trims"], ["graphic3", "3D", "Trims"],
    ["measure_avatar", "3D", "Measure"], ["measure_garment", "3D", "Measure"], ["avatar_tape", "3D", "Measure"],
  ];

  var MENU = "Here it is a right-click command: ";
  var TOOLS = [
    // ---------------- 2D: select and edit ----------------
    ["transform_pattern", "Transform Pattern", "A", "select", "built", "arrow", "Select, move, scale and turn whole patterns."],
    ["edit_pattern", "Edit Pattern", "Z", "edit", "built", "node", "Move points and segments."],
    ["transform_point", "Transform Point/Segment", "", "edit", "built", "node+box", "Move, scale or turn selected points and segments in their own box."],
    ["edit_curve_point", "Edit Curve Point", "V", "edit", "partly", "curvept", "Add and drag curve points: the curve runs through them."],
    ["edit_curvature", "Edit Curvature", "C", "edit", "built", "curve", "Drag a segment to bend it."],
    ["smooth_curve", "Smooth Curve", "", "edit", "built", "smooth", "Replace a stretch of outline, such as a corner, by one smooth curve."],
    ["add_point", "Add Point / Split Line", "X", "edit", "built", "addpt", "Add a point on a segment."],
    // ---------------- 2D: create ----------------
    ["polygon", "Polygon", "H", "pattern", "built", "polygon", "Draw a pattern point by point."],
    ["rectangle", "Rectangle", "S", "pattern", "built", "rect", "Draw a rectangular pattern."],
    ["ellipse", "Ellipse", "E", "pattern", "built", "ellipse", "Draw an elliptical pattern."],
    ["spiral", "Spiral", "", "pattern", "built", "spiral", "A spiral pattern from a dialog, for flounces."],
    ["internal_polygon", "Internal Polygon / Line", "G", "internal", "built", "polygon+in", "Draw a line or shape inside a pattern."],
    ["internal_rectangle", "Internal Rectangle", "", "internal", "built", "rect+in", "Draw a rectangle inside a pattern."],
    ["internal_ellipse", "Internal Ellipse", "R", "internal", "built", "ellipse+in", "Draw an ellipse inside a pattern."],
    ["internal_spiral", "Internal Spiral", "", "internal", "built", "spiral+in", "Draw a spiral line inside a pattern."],
    // the double-pointed dart (Round r12 / 6): a cut-out dart inside a pattern, its legs sewn to each other
    ["dart_double", "Dart", "", "internal", "built", "dart+in", "A double-pointed dart inside a pattern, sewn."],
    ["seamless_blocking", "Seamless Blocking", "", "internal", "unbuilt", "split", "Divide a pattern for a second fabric without cutting it."],
    ["base_polygon", "Base Polygon / Line", "", "base", "built", "polygon+dash", "Draw a baseline (reference only)."],
    ["base_rectangle", "Base Rectangle", "", "base", "built", "rect+dash", "A rectangular baseline."],
    ["base_ellipse", "Base Ellipse", "", "base", "built", "ellipse+dash", "An elliptical baseline."],
    ["trace", "Trace", "I", "trace", "partly", "trace", "Turn a closed internal shape or baseline into a pattern; Enter turns a baseline into an internal line."],
    // ---------------- 2D: shape ----------------
    ["fullness", "Fullness", "", "fullness", "built", "fan", "Slash from one edge to another and turn one side to add fullness."],
    ["fullness_point", "Fullness (Point)", "", "fullness", "partly", "fan", "Slash and spread from a point.", { via: MENU + "select the segment to grow, then right-click the outline point to pivot on, More ▸ Fullness (Point)…" }],
    ["fullness_line", "Fullness (Line)", "", "fullness", "partly", "spread", "Add fullness between two segments.", { via: MENU + "select one segment, right-click the other, More ▸ Fullness (Line)…" }],
    ["pleats", "Pleats", "", "pleats", "built", "pleats", "Click a segment or internal line, then the side: knife, box or accordion pleats as the Pleats box sets them."],
    // ---------------- 2D: markings ----------------
    ["notch", "Notch", "", "notch", "partly", "notch", "Add notches; click one to select it and change its look in the Property Editor."],
    ["punch_mark", "Punch Mark", "", "notch", "built", "punch", "Mark a drill hole inside a pattern."],
    ["seam_allowance", "Seam Allowance", "", "allowance", "built", "allowance", "Add or remove seam allowance, edge by edge."],
    ["edit_annotations", "Edit Annotation", "", "annotation", "built", "text+edit", "Drag a pattern name or an annotation."],
    ["annotations", "Pattern Annotation", "", "annotation", "partly", "text", "Name a pattern, or click inside one to type a note (notes are also on the right-click menu)."],
    ["pattern_symbol", "Pattern Symbol", "", "annotation", "built", "symbol", "Mark a segment with a fold or gather symbol."],
    ["walk", "Walk Pattern", "", "measure", "built", "walk", "Roll one edge along another to compare and notch them."],
    ["measure", "Point of Measure", "", "measure", "partly", "ruler", "Measure between two points, straight or along the outline."],
    ["edit_pom", "Edit Point of Measure", "", "measure", "built", "ruler+edit", "Select measurements, move their ends, delete them."],
    // ---------------- 2D: sewing ----------------
    ["edit_sewing", "Edit Sewing", "B", "edit_sew", "partly", "sew+edit", "Select, lengthen, slide, reverse, deactivate and delete sewing lines; both lengths at the pointer."],
    ["segment_sewing", "Segment Sewing", "N", "seg_sew", "built", "sew", "Sew whole segments together; Shift for 1:N."],
    ["mn_segment_sewing", "M:N Segment Sewing", "", "seg_sew", "built", "sew+mn", "Sew several segments to several; Enter ends each side."],
    ["free_sewing", "Free Sewing", "M", "free_sew", "built", "sewfree", "Sew any two stretches of line, point to point."],
    ["mn_free_sewing", "M:N Free Sewing", "", "free_sew", "built", "sewfree+mn", "Free sewing of several stretches to several."],
    ["check_sewing", "Check Sewing Length", "", "check_sew", "built", "sew+check", "Paint seams whose two sides differ in length.", { toggle: "sewCheck" }],
    ["show_sewing", "Show 2D Sewing", "", "check_sew", "partly", "sew+eye", "Show sewing lines while other tools are in use.", { via: "Sewing lines are always shown here; there is nothing to switch on." }],
    // ---------------- 2D: stitch ----------------
    ["edit_topstitch", "Edit Topstitch", "J", "topstitch", "built", "stitch+edit", "Select and change topstitches."],
    ["segment_topstitch", "Segment Topstitch", "K", "topstitch", "built", "stitch", "Topstitch along a whole segment."],
    ["free_topstitch", "Free Topstitch", "L", "topstitch", "built", "stitchfree", "Topstitch between two places on a line."],
    ["seamline_topstitch", "Seamline Topstitch", ";", "topstitch", "built", "stitch+sew", "Topstitch along both sides of a seam: click a sewing line. Edit Topstitch ▸ Properties… sets its Placement (Seam A, B or Both)."],
    ["edit_puckering", "Edit Puckering", "", "puckering", "built", "pucker+edit", "Select and change puckering."],
    ["segment_puckering", "Segment Puckering", "", "puckering", "built", "pucker", "Puckering along a whole segment."],
    ["free_puckering", "Free Puckering", "", "puckering", "built", "puckerfree", "Puckering between two places on a line."],
    ["seamline_puckering", "Seamline Puckering", "", "puckering", "built", "pucker+sew", "Puckering along a sewn seam."],
    // ---------------- 2D: material ----------------
    ["edit_texture", "Edit Texture (Grainline)", "T", "texture", "partly", "grain", "Set the grainline (the fabric texture itself is not moved)."],
    ["edit_uv", "Edit UV", "", "texture", "unbuilt", "uv", "Lay patterns out for texture export."],
    ["transform_graphic", "Transform Graphic", "", "graphic2", "built", "image+box", "Move, scale and turn a placed graphic."],
    ["graphic", "Graphic", "", "graphic2", "built", "image", "Place an image on a pattern."],
    ["button2d", "Button", "", "button2", "built", "button", "Place a button on a pattern."],
    ["buttonhole2d", "Buttonhole", "", "button2", "built", "buttonhole", "Place a buttonhole on a pattern."],
    ["fasten2d", "Fasten Button", "", "button2", "built", "button+check", "Fasten a button to a buttonhole."],
    ["set_sublayer", "Set Sublayer", "", "layer", "unbuilt", "layers", "Say which of two patterns lies on top in 3D."],
    ["fill", "Fill", "", "layer", "built", "puff", "Give a pattern filling: click it, set how full."],
    ["pattern_drafter", "Pattern Drafter", "", "drafter", "partly", "blocks", "Draft a block from measurements.", { via: "Here it is File ▸ New Block… (one skirt block, placeholder values)." }],
    ["auto_fitting", "Auto Fitting", "", "drafter", "unbuilt", "body+check", "Refit patterns to a resized avatar."],

    // ---------------- 3D: simulate and select ----------------
    ["simulate", "Simulate", "Space", "simulate", "built", "play", "Drape the garment: seams pull together and the cloth hangs on the avatar.", { toggle: "simulate" }],
    ["quick_pinching", "Quick Pinching", "Ctrl+Q", "simulate", "built", "pinch", "Pull the cloth by one point while simulating."],
    ["select_move", "Select/Move", "Q", "select3", "built", "move3d", "Select and place patterns in 3D."],
    ["select_mesh_brush", "Select Mesh (Brush)", "", "mesh", "later", "mesh+brush", "Paint a part of the cloth to select it."],
    ["select_mesh_box", "Select Mesh (Box)", "", "mesh", "later", "mesh+box", "Box-select a part of the cloth."],
    ["select_mesh_lasso", "Select Mesh (Lasso)", "", "mesh", "later", "mesh+lasso", "Lasso a part of the cloth."],
    ["pin_box", "Pin (Box)", "W", "pin", "built", "pin+box", "Pin cloth points in place: click one, or drag a box over the cloth."],
    ["pin_lasso", "Pin (Lasso)", "", "pin", "built", "pin+lasso", "Pin a lassoed part of the cloth in place."],
    // ---------------- 3D: arrange ----------------
    ["arr_points", "Show Arrangement Points", "Shift+F", "arrange", "built", "body+eye", "Blue points round the avatar: click one to put the selected pattern there.", { toggle: "arrPts" }],
    ["fold_arrangement", "Fold Arrangement", "", "arrange", "partly", "foldline", "Fold cloth along internal lines before simulating."],
    ["fold_garment", "Fold 3D Garment", "", "arrange", "later", "foldshirt", "Fold a finished garment."],
    ["auto_arrangement", "Auto 3D Arrangement", "", "arrange", "later", "body+plus", "Place patterns round the avatar automatically."],
    ["redrape", "Re-drape 3D Arrangement", "", "arrange", "later", "body+reset", "Drape again after the avatar changed size."],
    ["reset_2d_arrangement", "Reset 2D Arrangement (All)", "", "arrange", "built", "reset+flat", "Lay all patterns out flat, as in the 2D window."],
    ["reset_3d_arrangement", "Reset 3D Arrangement (All)", "", "arrange", "built", "reset", "Put all patterns back where they were arranged before simulating."],
    ["hi_res", "Hi-Res Garment", "", "resolution", "partly", "gridfine", "Finer cloth mesh for a finished look."],
    ["low_res", "Low-Res Garment", "", "resolution", "partly", "gridcoarse", "Coarser cloth mesh for speed."],
    ["custom_res", "Custom Resolution", "", "resolution", "partly", "gridfine+edit", "Type the distance between the cloth's points."],
    // ---------------- 3D: sewing ----------------
    ["edit_sewing_3d", "Edit Sewing (3D)", "", "edit_sew3", "built", "sew+edit", "Edit Sewing on the garment: the 2D tool, picked on the cloth."],
    ["segment_sewing_3d", "Segment Sewing (3D)", "", "seg_sew3", "built", "sew", "Segment Sewing on the garment: the 2D tool, picked on the cloth."],
    ["mn_segment_sewing_3d", "M:N Segment Sewing (3D)", "", "seg_sew3", "built", "sew+mn", "M:N sewing on the garment."],
    ["free_sewing_3d", "Free Sewing (3D)", "", "free_sew3", "built", "sewfree", "Free sewing on the garment."],
    ["mn_free_sewing_3d", "M:N Free Sewing (3D)", "", "free_sew3", "built", "sewfree+mn", "M:N free sewing on the garment."],
    ["auto_sewing", "Auto Sewing", "", "auto_sew", "later", "sew+plus", "Sew patterns from where they are arranged."],
    ["tack", "Tack", "", "tack", "built", "tack", "Hold two spots of the garment together."],
    ["tack_avatar", "Tack on Avatar", "", "tack", "built", "tack+body", "Hold a spot of the garment to the avatar."],
    ["edit_tack", "Edit Tack", "", "tack", "built", "tack+edit", "Select, move or delete tacks."],
    ["press", "Press", "", "press", "later", "iron", "Press two sewn layers flat at the edge."],
    // the 2D tools picked on the cloth (Round r10 / 3; not in the reference's 3D toolbar list: compare in the other program)
    ["edit_topstitch_3d", "Edit Topstitch (3D)", "", "stitch3", "built", "stitch+edit", "Edit Topstitch on the garment: the 2D tool, picked on the cloth."],
    ["segment_topstitch_3d", "Segment Topstitch (3D)", "", "stitch3", "built", "stitch", "Segment Topstitch on the garment: the 2D tool, picked on the cloth."],
    ["free_topstitch_3d", "Free Topstitch (3D)", "", "stitch3", "built", "stitchfree", "Free Topstitch on the garment: the 2D tool, picked on the cloth."],
    ["notch_3d", "Notch (3D)", "", "notch3", "built", "notch", "Notch on the garment: the 2D tool, picked on the cloth."],
    // ---------------- 3D: draw ----------------
    ["pen_garment", "3D Pen (Garment)", "", "pen_garment", "built", "pen", "Draw lines on the garment."],
    ["edit_pen_garment", "Edit 3D Pen (Garment)", "", "pen_garment", "built", "pen+edit", "Edit lines drawn on the garment."],
    ["base_pen", "3D Base Pen", "", "pen_garment", "built", "pen+dash", "Draw baselines over the garment."],
    ["pen_avatar", "3D Pen (Avatar)", "", "pen_avatar", "later", "pen+body", "Draw shapes on the avatar."],
    ["edit_pen_avatar", "Edit 3D Pen (Avatar)", "", "pen_avatar", "later", "body+edit", "Edit shapes drawn on the avatar."],
    ["flatten", "Flatten", "", "pen_avatar", "later", "flatten", "Turn shapes on the avatar into flat patterns."],
    ["edit_style_line", "Edit Style Line", "", "style_line", "built", "shirt+edit", "Move outline points directly on the garment."],
    ["scale_style_line", "Scale Style Line", "", "style_line", "later", "shirt+box", "Scale part of the garment's outline."],
    ["add_style_line", "Add Style Line", "", "style_line", "later", "shirt+plus", "Add a line to the garment's outline."],
    ["seamline_rip", "Seamline Rip", "", "style_line", "later", "rip", "Let a stretch of seam tear open."],
    // ---------------- 3D: trims ----------------
    ["button", "Button", "", "button", "built", "button", "Place a button."],
    ["buttonhole", "Buttonhole", "", "button", "built", "buttonhole", "Place a buttonhole."],
    ["select_button", "Select/Move Button", "", "button", "built", "button+edit", "Move buttons and buttonholes."],
    ["fasten_button", "Fasten Button", "", "button", "built", "button+check", "Fasten a button to its buttonhole."],
    ["zipper", "Zipper", "P", "zipper", "built", "zipper", "A zipper between two edges, on the 2D patterns or on the garment: click its start, double-click its end, on each side."],
    ["edit_zipper", "Edit Zipper", "", "zipper", "built", "zipper+edit", "Drag an end of a zipper; then the other side's end to the dot, so both sides are as long."],
    ["fill_3d", "Fill (3D)", "", "fill3", "built", "puff", "Give a pattern filling: click it on the garment, set how full."],
    ["piping", "Piping", "", "piping", "built", "piping", "A cord in a strip of fabric, sewn into a seam."],
    ["edit_piping", "Edit Piping", "", "piping", "built", "piping+edit", "Select a piping to change or delete it."],
    ["binding", "Binding", "", "piping", "built", "binding", "A strip of fabric wrapped round a free edge."],
    ["select_binding", "Select Binding", "", "piping", "built", "binding+edit", "Select a binding to change or delete it."],
    ["seam_taping", "Seam Taping", "", "bond", "later", "tape", "Tape edges so they keep their length."],
    ["gluing", "Gluing", "", "bond", "built", "drop", "Bond two layers over an area, or a seam instead of stitching it."],
    ["glue_fill", "Glue Fill", "", "bond", "built", "drop+box", "Click a piece lying on another pattern: it is glued where it overlaps. Shift+click: Subtract."],
    ["sticker", "Sticker", "", "bond", "built", "drop+plus", "Click a piece, then where it goes on another pattern: it is glued there."],
    ["edit_gluing", "Edit Gluing", "", "bond", "built", "drop+edit", "Select a glue to move, turn, scale or delete it, and set its strength."],
    ["lacing", "Lacing", "", "bond", "later", "lace", "Thread a lace through holes."],
    ["graphic_3d", "Graphic (3D)", "", "graphic3", "built", "image", "Place an image on the garment."],
    ["transform_graphic_3d", "Transform Graphic (3D)", "", "graphic3", "built", "image+box", "Move a graphic on the garment."],
    ["edit_texture_3d", "Edit Texture (3D)", "", "graphic3", "built", "grain", "Move the fabric texture on the garment."],
    // ---------------- 3D: measure ----------------
    ["tape_basic", "Basic Tape Measure (Avatar)", "", "measure_avatar", "built", "ruler+body", "A straight length on the avatar."],
    ["tape_surface", "Surface Tape Measure (Avatar)", "", "measure_avatar", "built", "flatten+body", "A length along the avatar's surface."],
    ["circ_basic", "Basic Circumference Measure (Avatar)", "", "measure_avatar", "built", "ring+body", "A girth of the avatar."],
    ["circ_surface", "Surface Circumference Measure (Avatar)", "", "measure_avatar", "built", "ring", "A girth following the avatar's surface."],
    ["height_measure", "Height Measure (Avatar)", "", "measure_avatar", "built", "height", "The height of a spot above the floor."],
    ["edit_measure_avatar", "Edit Measure (Avatar)", "", "measure_avatar", "built", "ring+edit", "Move or delete avatar measurements."],
    ["linear_garment", "Linear Measure (Garment)", "", "measure_garment", "built", "ruler", "A length on the garment."],
    ["circ_garment", "Circumference Measure (Garment)", "", "measure_garment", "built", "ring+shirt", "A girth of the garment."],
    ["volume_measure", "Volume Measure (Garment/Bag)", "", "measure_garment", "built", "cube", "The space patterns enclose."],
    ["edit_volume_measure", "Edit Volume Measure (Garment/Bag)", "", "measure_garment", "built", "cube+edit", "A volume's target, tolerance and measurement mesh."],
    ["avatar_tape_linear", "Linear Avatar Tape", "", "avatar_tape", "later", "tape+body", "A tape on the avatar to fix seams to."],
    ["avatar_tape_circ", "Circumference Avatar Tape", "", "avatar_tape", "later", "ring+dash", "A tape round the avatar."],
    ["edit_avatar_tape", "Edit Avatar Tape", "", "avatar_tape", "later", "tape+edit", "Select or delete avatar tapes."],
    ["attach_to_measure", "Attach to Measure", "", "avatar_tape", "later", "tape+sew", "Fix a seam or edge to an avatar tape."],
  ];

  // Line drawings, 24 × 24, drawn with one stroke. Each is SVG path data.
  var GLYPHS = {
    arrow: "M6 3l11 9-5 .8 3 6-2 1-3-6-4 3.6z",
    node: "M4 19L12 7l8 12M10 5h4v4h-4z",
    curve: "M4 19C7 5 17 5 20 19",
    curvept: "M4 19C7 5 17 5 20 19M6 7h12M5 7h.01M19 7h.01M12 8.5h.01",
    smooth: "M4 20V11a7 7 0 0 1 7-7h9M4 4h3M4 4v3",
    addpt: "M4 20L20 4M12 8v8M8 12h8",
    polygon: "M4 9l8-5 8 5-3 11H7z",
    rect: "M4 6h16v12H4z",
    ellipse: "M4 12a8 6 0 1 0 16 0a8 6 0 1 0-16 0",
    spiral: "M12 12a1.5 1.5 0 1 1 1.5 1.5a3.5 3.5 0 1 1-3.5-3.5a5.5 5.5 0 1 1 5.5 5.5a7.5 7.5 0 0 1-7.5-7.5",
    dart: "M3 6h6l3 13 3-13h6",
    split: "M4 5h16v14H4zM4 14c5-6 11 2 16-4",
    trace: "M5 5h14v14H5zM9 12l2.5 2.5L16 9",
    fan: "M12 20L4 7M12 20V4M12 20l8-13M5 6a12 12 0 0 1 14 0",
    spread: "M4 5h6v14H4zM14 5h6v14h-6zM10 12h4M11.5 10.5L10 12l1.5 1.5M12.5 10.5L14 12l-1.5 1.5",
    pleats: "M3 8l3.5 9 3.5-9 3.5 9 3.5-9 3.5 9",
    notch: "M3 16h18M12 16V8M10 8h4",
    punch: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 8v8M8 12h8M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6",
    allowance: "M8 20V8h12M4 20V4h16",
    text: "M6 19L12 5l6 14M8.5 14h7",
    symbol: "M6 9v7h12V9M4 11l2-2 2 2M16 11l2-2 2 2",
    walk: "M3 19h18M7 19a5 5 0 0 1 10 0M12 14V6M9 8.5l3-3 3 3",
    ruler: "M3 17L17 3l4 4L7 21zM7.5 13.5l2 2M10.5 10.5l2 2M13.5 7.5l2 2",
    sew: "M6 4v16M18 4v16M6 8h12M6 12h12M6 16h12",
    sewfree: "M6 4v16M18 4v16M6 9l12 3M6 13l12 3M6 9h.01M6 13h.01M18 12h.01M18 16h.01",
    stitch: "M4 19L19 4M8 20l2-2M12 16l2-2M16 12l2-2M20 8l1-1",
    stitchfree: "M4 19L19 4M9 19l2-2M13 15l2-2M9 19h.01M15 13h.01",
    pucker: "M3 9h18M3 15c2-4 4 4 6 0s4 4 6 0 4 4 6 0",
    puckerfree: "M3 9h18M7 15c1.5-3 3 3 5 0s3.500 3 5 0M7 15h.01M17 15h.01",
    grain: "M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4",
    uv: "M4 4h16v16H4zM4 12h16M12 4v16",
    image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
    layers: "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4",
    puff: "M6 17a4 4 0 0 1 0-8 6 6 0 0 1 11.500-1A4.500 4.500 0 0 1 18 17zM9 13h.01M13 13h.01",
    blocks: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM16.500 13v7M13 16.500h7",
    body: "M12 3.500a2 2 0 1 0 .01 0M8 21v-7l-2-4 2.500-2h7l2.500 2-2 4v7M12 15v6",
    play: "M7 4l12 8-12 8z",
    pause: "M7 4h3.500v16H7zM13.500 4H17v16h-3.500z",
    pinch: "M8 20v-6l-2-3 1.500-1 2.500 3V5a1.500 1.500 0 0 1 3 0v5l4 1.500a2 2 0 0 1 1.200 2.200L17 20z",
    move3d: "M12 3v18M3 12h18M12 3l-2.500 2.500M12 3l2.500 2.500M12 21l-2.500-2.500M12 21l2.500-2.500M3 12l2.500-2.500M3 12l2.500 2.500M21 12l-2.500-2.500M21 12l-2.500 2.500",
    mesh: "M4 20L12 4l8 16zM8 12h8M12 4v16M8 12l4 8 4-8",
    pin: "M12 21v-7M8.500 4h7l-1 6 3 4h-11l3-4z",
    foldline: "M4 6h16v12H4zM12 3v2M12 7v2M12 11v2M12 15v2M12 19v2",
    foldshirt: "M5 7h14v12H5zM5 7l7 5 7-5",
    reset: "M5 12a7 7 0 1 0 2.200-5.100M5 4v4h4",
    gridfine: "M4 4h16v16H4zM4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16",
    gridcoarse: "M4 4h16v16H4zM4 12h16M12 4v16",
    tack: "M7 8a2 2 0 1 0 .01 0M17 14a2 2 0 1 0 .01 0M8.700 9l6.600 4",
    iron: "M4 17h16l-2-7H9.500A5.500 5.500 0 0 0 4 15.500zM12 10V7h5",
    pen: "M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3",
    flatten: "M4 13c4-8 12-8 16 0M4 19h16M12 9v6M10 13l2 2 2-2",
    shirt: "M9 4L4 7l2 4 2.500-1.500V20h7V9.500L18 11l2-4-5-3a3 3 0 0 1-6 0z",
    rip: "M3 12h5l2-4 2.500 8 2-4H21",
    button: "M12 4a8 8 0 1 0 .01 0M10 10h.01M14 10h.01M10 14h.01M14 14h.01",
    buttonhole: "M5 9.500h14v5H5zM8 12h8",
    zipper: "M12 3v18M9 5h3M12 8h3M9 11h3M12 14h3M9 17h3M12 20h3",
    piping: "M4 7c6 0 6 9 16 9M4 10c6 0 6 9 16 9",
    binding: "M4 5v14M4 5h7a4 4 0 0 1 0 8H4M11 13h9",
    tape: "M3 9h18v6H3zM7 9v3M11 9v3M15 9v3M19 9v3",
    drop: "M12 3.500s6 6.500 6 10.500a6 6 0 0 1-12 0c0-4 6-10.500 6-10.500z",
    lace: "M8 4l8 4-8 4 8 4-8 4M16 4l-8 4 8 4-8 4 8 4",
    ring: "M4 12a8 4 0 1 0 16 0a8 4 0 1 0-16 0M4 12v3a8 4 0 0 0 16 0v-3",
    height: "M12 3v18M8 3h8M8 21h8M10 6l2-2.500L14 6M10 18l2 2.500L14 18",
    cube: "M12 3l8 4v10l-8 4-8-4V7zM12 12l8-5M12 12v9M12 12L4 7",
  };
  // A badge is drawn small in the lower right corner, over a cleared patch.
  var BADGES = {
    edit: "M15 22l1-3.500 5-5 2.500 2.500-5 5z",
    plus: "M19 14.500v7M15.500 18h7",
    check: "M15 18.500l2.500 2.500 5-5.500",
    box: "M15 14.500h7.500V22H15z",
    mn: "M15 15v6.500M18.500 15v6.500M22 15v6.500",
    eye: "M14.500 18.500q4.200-4.500 8.500 0q-4.200 4.500-8.500 0M18.700 18.500h.01",
    sew: "M15.500 14.500V22M21.500 14.500V22M15.500 17h6M15.500 19.500h6",
    fold: "M15 21.500l3.500-6.500 3.500 6.500",
    brush: "M15 22c2 0 2.500-1.500 2.500-2.500l4.500-5 1 1-5 4.500",
    lasso: "M15 17.500a4 2.700 0 1 0 4 2.700c0 1.200-1 2-2 2",
    reset: "M15.500 18.500a3.500 3.500 0 1 0 1-2.500M15.200 14.500v2.200h2.200",
    flat: "M14.500 21.500h8.500M16 18.500h5.500",
    body: "M19 14a1.200 1.200 0 1 0 .01 0M16.500 22v-3.500l1-1.500h3l1 1.500V22",
    shirt: "M17 15l-2.500 1.500 1 2 1-.500V22h5v-4l1 .500 1-2L21 15z",
    // "in" and "dash" change how the glyph itself is drawn; see iconSVG in the app
    "in": "", dash: "",
  };

  var tools = TOOLS.map(function (t) {
    var more = t[7] || {};
    return { id: t[0], name: t[1], key: t[2], group: t[3], status: t[4], icon: t[5], tip: t[6], via: more.via || "", toggle: more.toggle || "" };
  });
  var groups = GROUPS.map(function (g) { return { id: g[0], win: g[1], section: g[2] }; });
  var winOf = {};
  groups.forEach(function (g) { winOf[g.id] = g.win; });
  tools.forEach(function (t) { t.win = winOf[t.group]; });
  return { groups: groups, tools: tools, glyphs: GLYPHS, badges: BADGES };
})();
if (typeof module !== "undefined" && module.exports) module.exports = TOOL_REGISTRY;
