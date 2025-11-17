# ENGINE_V2 Debug Overlay

**Purpose**: Internal debug tool for visualizing ENGINE_V2 geometry and alignment.

This overlay is **not part of the public ENGINE_V2 specification** and is intended for development/debugging purposes only.

---

## What It Visualizes

The debug overlay renders:

1. **Canvas Quadrant Lines**:
   - Vertical line at `x = width / 2` (center of canvas)
   - Horizontal line at `y = height / 2` (center of canvas)
   - Both lines are dashed and semi-transparent gray
   - Divides the canvas into 4 quadrants (1: top-right, 2: top-left, 3: bottom-left, 4: bottom-right)

2. **Bounding Box (Yellow Rectangle)**:
   - Rectangle showing the bounding box of **pre-mirroring geometry**
   - Computed from all points (from, to, control) in connections **before** final mirroring is applied
   - Uses yellow dashed stroke (`#ffff00`, 60% opacity)
   - Represents the spatial extent of the original geometry before reflection
   - The center of this bbox is used to determine the mirroring axis

3. **Mirroring Axis (Cyan Line)**:
   - Line showing the **actual symmetry axis** used by `applyFinalMirroring`
   - Type determined by bbox aspect ratio:
     - **Vertical** (horizontal reflection): when `bbox.width > bbox.height`
     - **Horizontal** (vertical reflection): when `bbox.height > bbox.width`
     - **Diagonal** (diagonal reflection): when `bbox.width ≈ bbox.height`
   - Uses cyan dashed stroke (`#00ffff`, 70% opacity, thicker line)
   - Extends through and beyond the bbox for visibility
   - This is the axis across which all geometry is reflected in the final mirroring step

4. **Per-Keyword Anchor Points (Orange)**:
   - One highlighted point for each keyword in the input list
   - Each point represents the primary position (Alfa/Beta → canvas coordinates) for that keyword
   - Visualized as:
     - **Outer circle**: Stroke circle (6px radius) around each keyword anchor
     - **Inner dot**: Filled circle (2.5px radius) at each anchor center
     - **Text label**: Index number (1-based) displayed next to each point (e.g., "1", "2", "3")
   - All per-keyword anchor visualization uses orange color (`#ff8800`) for visibility
   - Points are captured **BEFORE** final mirroring is applied
   - Labels show the keyword's position in the input list (first keyword = "1", second = "2", etc.)

5. **Primary Anchor Point (Green)**:
   - The primary point generated from Alfa/Beta axes (BEFORE mirroring)
   - This is the same as the first keyword's anchor point
   - Visualized as:
     - **Crosshairs**: Vertical and horizontal dashed lines passing through the anchor point
     - **Outer circle**: Stroke circle (8px radius) around the anchor
     - **Center dot**: Filled circle (3px radius) at the anchor position
   - All anchor visualization uses green color for visibility

6. **Axes Values**:
   - Alfa and Beta values from the first keyword are captured (exposed in debug info)
   - These represent the original semantic axes that generated the anchor point

---

## Usage

### Enabling/Disabling the Overlay

The debug overlay is controlled by the **"Debug mode"** checkbox in the UI (located in the left-side controls panel, below the "Animazione" checkbox).

**To enable**:
1. Check the "Debug mode" checkbox in the UI
2. Generate or regenerate a symbol
3. The debug overlay will appear showing all debug visualization elements

**To disable**:
1. Uncheck the "Debug mode" checkbox
2. The overlay will be hidden immediately (if a symbol is already generated, it will disappear)
3. No debug info will be captured during generation when the checkbox is unchecked

**Note**: The debug overlay is safe to leave enabled in production environments. It only affects visualization and does not change the core ENGINE_V2 behavior or geometry generation.

---

## Technical Details

### Debug Data Flow

1. **Engine Capture** (`lib/engine_v2/engine.ts`):
   - When `includeDebug = true`, captures:
     - Primary anchor point (first basePoint's pixel coordinates, BEFORE mirroring)
     - **Per-keyword anchor points**: All keywords' primary positions (from `basePoints` array, BEFORE mirroring)
     - Alfa and Beta values from first keyword
     - **Bounding box** of pre-mirroring geometry (via `computeMirroringDebugInfo`)
     - **Mirroring axis type** and **axis segment** for visualization
   - All mirroring debug info is captured **BEFORE** `applyFinalMirroring` is called
   - Per-keyword anchors are mapped from `basePoints` with their index and keyword string
   - Returns optional `debug` field in `EngineV2Result`

2. **State Management** (`app/page.tsx`):
   - Stores `debugInfo` in component state
   - Stores `debugMode` as a React state variable (controlled by UI checkbox)
   - Only updates `debugInfo` when `debugMode === true`
   - Passes `debugInfo` and `debugMode` to `SvgPreview`

3. **Rendering** (`components/SvgPreview.tsx`):
   - Conditionally renders `<DebugOverlay />` when `debugMode === true`
   - Debug overlay is rendered AFTER all connections (on top)

4. **Visualization** (`components/DebugOverlay.tsx`):
   - Pure React component with no side effects
   - Renders quadrant lines and anchor visualization
   - Uses `pointerEvents="none"` to avoid interfering with interactions

### Coordinate System

- All coordinates are in **canvas pixel space** (not normalized)
- Anchor point is the **primary point** from Alfa/Beta → position mapping
- Anchor is captured **BEFORE** final mirroring is applied
- Bounding box and mirroring axis are computed from **pre-mirroring geometry** (connections before mirroring)
- This allows inspection of the original geometry before mirroring transforms

### Interpreting the Visual Elements

The debug overlay helps visualize:

1. **Geometry Extent** (Yellow bbox):
   - Shows where the original geometry (before mirroring) is located
   - The bbox center is the reference point for mirroring

2. **Mirroring Strategy** (Cyan axis):
   - **Vertical axis**: Geometry is wider than tall → horizontal reflection (left/right mirror)
   - **Horizontal axis**: Geometry is taller than wide → vertical reflection (top/bottom mirror)
   - **Diagonal axis**: Geometry is approximately square → diagonal reflection (top-left ↔ bottom-right)

3. **Relationship Between Elements**:
   - **Canvas center** (gray quadrant lines): Reference for canvas coordinate system
   - **Primary anchor point** (green): First keyword's semantic position (Alfa/Beta → position)
   - **Per-keyword anchors** (orange): All keywords' primary positions with numbered labels
   - **Bbox center**: Center of pre-mirroring geometry (may differ from individual anchors if multiple keywords)
   - **Mirroring axis** (cyan): The line across which geometry is reflected
   - Offsets between these elements show how geometry distribution affects mirroring behavior
   - The per-keyword anchors show how multiple keywords spread across the canvas space

---

## Removing Debug Code

All debug functionality is isolated and easy to remove:

### Files to Remove

1. `components/DebugOverlay.tsx` - The debug overlay component
2. `docs/debug/` - This entire folder

### Code Changes to Revert

1. **`lib/types.ts`**:
   - Remove `KeywordAnchorDebug` type definition
   - Remove `EngineV2DebugInfo` type definition (including bbox, mirrorAxisType, mirrorAxisSegment, anchors fields)

2. **`lib/engine_v2/finalMirroring.ts`**:
   - Remove `computeMirroringDebugInfo` function (used only for debug visualization)

3. **`lib/engine_v2/engine.ts`**:
   - Remove `EngineV2DebugInfo` import
   - Remove `computeMirroringDebugInfo` import from `finalMirroring`
   - Remove `EngineV2Result` type (or simplify to just return `BranchedConnection[]`)
   - Remove `includeDebug` parameter from `generateEngineV2`
   - Remove debug capture logic (including `computeMirroringDebugInfo` call)
   - Change return type back to `Promise<BranchedConnection[]>`

3. **`components/SvgPreview.tsx`**:
   - Remove `EngineV2DebugInfo` import
   - Remove `DebugOverlay` import
   - Remove `debugInfo` and `debugMode` props
   - Remove debug overlay rendering (including bbox, mirrorAxisSegment, and anchors props)

4. **`components/DebugOverlay.tsx`**:
   - This entire file can be deleted (if removing all debug functionality)

5. **`app/page.tsx`**:
   - Remove `debugMode` state
   - Remove "Debug mode" checkbox from UI
   - Remove `EngineV2DebugInfo` import
   - Remove `debugInfo` state
   - Update `generateEngineV2` call to not use `includeDebug` (or pass `false`)
   - Update to use return value directly (if changed to return array)
   - Remove `debugInfo` and `debugMode` props from `SvgPreview`

### Verification

After removal:
- ✅ App should work exactly as before (no visual changes when debug was disabled)
- ✅ No TypeScript errors
- ✅ Build passes
- ✅ No debug-related code remains

---

## Notes

- The debug overlay **does not affect** the core ENGINE_V2 pipeline
- Debug data capture has **no side effects** (pure data extraction)
- When `DEBUG_MODE === false`, **zero overhead** (no debug data captured, no overlay rendered)
- The overlay uses non-intrusive colors (gray for quadrants, green for anchor) that don't interfere with normal visualization

---

**End of ENGINE_V2_DEBUG_OVERLAY.md**

