# SFCM SYMBOLS – Changelog

This changelog documents all significant changes to the SFCM Symbol Generator project.

Entries are listed in reverse chronological order (most recent first).

---

## 2025-11-16 – ENGINE_V2 + Mirroring Patch01 + Slider1

### ENGINE_V2

**Complete migration to new 4-axis semantic system**

- **New semantic axes** (replacing old 6-axis system):
  - **Alfa** (Azione ↔ Osservazione): Controls horizontal position (X coordinate)
  - **Beta** (Specifico ↔ Ampio): Controls vertical position (Y coordinate)
  - **Gamma** (Unico ↔ Composto): Controls number of lines (1–7), direction, and base length (15%–50% of canvas diagonal)
  - **Delta** (Regolare ↔ Irregolare): Controls curvature (5%–30% of line length) and deterministic jitter

- **New geometry pipeline**:
  1. Keyword → 4 semantic axes (via `semantic-map-v2.json` or deterministic fallback)
  2. Alfa/Beta → normalized coordinates → pixel coordinates (primary anchor point)
  3. Gamma → generates 1–7 quadratic curves per keyword (base length: 15%–50% of canvas diagonal)
  4. Delta → applies curvature and irregularity to control points
  5. Final mirroring (see PATCH01 below)
  6. Output: array of `BranchedConnection` objects for rendering

- **Key architectural changes**:
  - Removed cluster generation, MST building, and branching logic
  - All curves are single-segment quadratic Bézier curves (one control point)
  - Deterministic generation: same keyword + seed → same geometry
  - Canvas-aware: geometry adapts to any canvas size (1:1, 4:5, 9:16, 16:9, fit screen, custom)
  - Unified path for all keywords: known keywords use dictionary mapping, unknown keywords use deterministic seed-based fallback

- **Semantic mapping**:
  - New dictionary format: `semantic/semantic-map-v2.json` (4-axis values per keyword)
  - Keyword normalization: trim + lowercase
  - Deterministic fallback for missing keywords (seed-based, stable)
  - All axis values clamped to [-100, +100] range

- **Preserved from previous version**:
  - UI structure and layout
  - SVG preview and rendering (React components)
  - Animation system (stroke-dasharray based)
  - SVG export (Illustrator/Figma compatible)
  - Arrowhead styling (3px stroke, 14×19px)
  - Canvas size options
  - Determinism and seed-based generation

**Files affected:**
- `lib/engine_v2/` (new module structure)
- `lib/engine_v2/engine.ts` (main orchestrator)
- `lib/engine_v2/axes.ts` (semantic mapping)
- `lib/engine_v2/position.ts` (Alfa/Beta → coordinates)
- `lib/engine_v2/curves.ts` (Gamma/Delta → curves)
- `lib/engine_v2/finalMirroring.ts` (final geometry mirroring)
- `lib/types.ts` (new `AxesV2` and `SemanticMapV2` types)
- `app/page.tsx` (wired to ENGINE_V2)

**Documentation:**
- `docs/ENGINE_V2/SPEC_03_ENGINE_V2.md` (main specification)
- `docs/ENGINE_V2/ENGINE_V2_OVERVIEW.md` (architecture overview)
- `docs/ENGINE_V2/ENGINE_V2_GEOMETRY_PIPELINE.md` (detailed pipeline)
- `docs/ENGINE_V2/ENGINE_V2_SEMANTIC_MAP.md` (semantic mapping)
- `docs/ENGINE_V2/ENGINE_V2_MIGRATION_GUIDE.md` (migration guide)

---

### PATCH01 – Final Mirroring

**Revision to SPEC_03 mirroring logic (non-breaking structural change)**

- **Changed behavior**:
  - **Old**: Mirroring applied BEFORE line generation (on points only)
  - **New**: Mirroring applied AFTER line generation (on final geometry/connections)

- **New mirroring algorithm**:
  1. Compute bounding box of all pre-mirroring geometry (from, to, control points)
  2. Determine axis type based on bbox dimensions:
     - `width > height` → vertical axis
     - `height > width` → horizontal axis
     - `width ≈ height` → diagonal axis (top-left → bottom-right)
  3. Axis position always centered on canvas (not bbox):
     - Vertical: `x = canvasWidth / 2`
     - Horizontal: `y = canvasHeight / 2`
     - Diagonal: main canvas diagonal through center
  4. Reflect all connections (including control points for curved lines) across the chosen axis
  5. Merge original + mirrored connections into final array

- **Benefits**:
  - True symmetry on final geometry
  - Consistent and predictable outputs
  - Preserves Gamma/Delta processing (curvature and irregularity)
  - Deterministic axis selection
  - Works correctly with quadratic Bézier curves

- **Implementation**:
  - New module: `lib/engine_v2/finalMirroring.ts`
  - Function: `applyFinalMirroring(connections, canvasWidth, canvasHeight, seed)`
  - Integrated into ENGINE_V2 pipeline as final step before rendering
  - Old mirroring code deprecated (marked in `lib/engine_v2/mirroring.ts`)

**Files affected:**
- `lib/engine_v2/finalMirroring.ts` (new)
- `lib/engine_v2/engine.ts` (calls final mirroring)
- `lib/engine_v2/mirroring.ts` (deprecated, kept for reference)

**Documentation:**
- `docs/patches/patch01_SPEC_03_mirroring_revision.md` (patch specification)
- `docs/patches/patch01_tasks.md` (implementation tasks)

---

### Slider1 – "Lunghezza linee"

**First active UI slider controlling line length**

- **UI implementation**:
  - Label: "Lunghezza linee" (replaces old "Densità" placeholder)
  - Range: 0–100 (integer)
  - Default: 50 (center position)

- **Engine mapping**:
  - Parameter: `lengthScale` (in `EngineV2Options`)
  - Formula: `lengthScale = 0.7 + (slider / 100) * (1.3 - 0.7)`
    - `slider = 0`   → `lengthScale = 0.7`   (shorter lines)
    - `slider = 50`  → `lengthScale = 1.0`   (baseline behavior)
    - `slider = 100` → `lengthScale = 1.3`   (longer lines)

- **Effect on geometry**:
  - Scales the base line length determined by Gamma (which sets base length in range 15%–50% of canvas diagonal)
  - Applied uniformly to ALL lines, including those from unknown keywords (fallback generation)
  - Does NOT affect:
    - Number of lines (still controlled by Gamma)
    - Curvature (still controlled by Delta)

- **Implementation details**:
  - `lengthScale` passed to `generateEngineV2()` via options
  - Applied in `getLineLength()` function: `finalLength = baseLength * (1 + variation) * lengthScale`
  - Single unified path ensures all curves (known and unknown keywords) use the same length computation

**Files affected:**
- `app/page.tsx` (UI slider + state management)
- `lib/engine_v2/engine.ts` (accepts `lengthScale` in options)
- `lib/engine_v2/curves.ts` (applies `lengthScale` in `getLineLength()`)
- `lib/types.ts` (`EngineV2Options` type)

**Documentation:**
- `docs/ENGINE_V2/ENGINE_V2_SLIDER_MAPPING.md` (slider mapping reference)
- `docs/ENGINE_V2/ENGINE_V2_GEOMETRY_PIPELINE.md` (updated with lengthScale note)

---

### Debug Overlay (Optional)

**Visual debug tool for ENGINE_V2 inspection**

- **Features**:
  - Canvas quadrant visualization (vertical/horizontal center lines)
  - Primary anchor point display (from Alfa/Beta, before mirroring)
  - Per-keyword anchor points (all keywords' primary positions)
  - Geometry bounding box (pre-mirroring)
  - Mirroring axis visualization (cyan line showing actual reflection axis)

- **Control**:
  - UI toggle: "Debug mode" checkbox in main interface
  - Controlled by `debugMode` React state
  - Fully optional: can be disabled/removed without affecting core engine

- **Implementation**:
  - Debug data exposed via optional `debug` field in `EngineV2Result`
  - `DebugOverlay` React component rendered conditionally
  - All debug elements behind `debugMode` flag

**Files affected:**
- `components/DebugOverlay.tsx` (new component)
- `app/page.tsx` (debug mode toggle + overlay rendering)
- `lib/engine_v2/engine.ts` (captures debug data)
- `lib/engine_v2/types.ts` (`EngineV2DebugInfo` type)

**Documentation:**
- `docs/debug/ENGINE_V2_DEBUG_OVERLAY.md` (debug overlay guide)
- `docs/debug/README.md` (debug tools overview)

---

### Other Changes

- **Placeholder sliders**: Old sliders (Ramificazione, Complessità, Mutamento) remain in UI but have no active logic (placeholders for future implementation)
- **Legacy code**: Old 6-axis engine code (`lib/geometry.ts`, `lib/semantic.ts` with old mapping) marked as deprecated but kept for reference
- **Type safety**: Full TypeScript coverage for ENGINE_V2 types and functions

---

## Future Entries

Future changelog entries should follow this structure:

```markdown
## YYYY-MM-DD – [Feature/Change Title]

### [Category]

- Description of change
- Technical details
- Files affected
- Documentation references
```

---

