# SFCM SYMBOLS – Changelog

This changelog documents all significant changes to the SFCM Symbol Generator project.

Entries are listed in reverse chronological order (most recent first).

> **SPEC state**: the canonical reference for ENGINE_V2 is `docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md`.  
> Legacy references to SPEC_03 remain only for historical traceability—when you see `docs/reference/engine_v2/*` below, treat them as archives of the SPEC_03 era.

---

## 2025-02-XX – FEATURE: Branching_beta01 (ENGINE_V2)

### Branching dalle intersezioni post-mirroring

- **Nuovo step geometry**: generazione deterministica di ramificazioni dalle intersezioni tra linee finali (dopo il mirroring).
  - Rilevamento intersezioni con campionamento Bézier (12 campioni per curva) e arrotondamento a 1px per unione di punti vicini.
  - Filtro hard cap: massimo 30 intersezioni considerate; 1–2 rami per intersezione con selezione **mescolata in modo deterministico** per coprire tutti i cluster generati e non solo il primo.
  - Lunghezze rami proporzionali alla diagonale del canvas (6%–12%), offset angolare ±60°, curvatura opzionale (|curvature| > 0.08) e tratteggio deterministico (35%).
  - I rami ereditano `generationDepth = 1` per essere renderizzati dopo le linee primarie.
- **Determinismo**: tutti i random usano `seededRandom` con prefissi espliciti (`branching:count/length/angle/curvature/dashed`).
- **Compatibilità**: nessun nuovo input/UI, canvas bounds sempre rispettati via clamp, funzionamento invariato su tutti i formati.

**Files modified/added:**
- `lib/engine_v2/branching.ts` (nuovo modulo: detection + branching deterministico)
- `lib/engine_v2/engine.ts` (integrazione step Branching_beta01 dopo il mirroring finale)
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (pipeline aggiornata con lo step di branching)
- `docs/reference/features/feature_branching_beta01.md` (specifica della feature)

**Note:** nessun cambiamento alla UI o agli input; output arricchito con rami generati dalle intersezioni mantenendo la compatibilità con l’ordinamento di rendering esistente.

### Debug overlay (ENGINE_V2)

- **Visualizzazione cluster più chiara**: l'overlay ora mostra poligoni semi-trasparenti (o cerchi se <3 punti) costruiti dai punti di partenza dispersi di ciascun cluster, con etichetta del cluster al baricentro e punti singoli per ogni start point.
- **Nuovo dato di debug**: ogni `DirectionClusterDebug` include il `startPoint` (punto di partenza disperso) per poter disegnare le aree per-cluster sul canvas.

## 2025-01-XX – PATCH04: Length & Curvature Clustering

### PATCH04 – Length & Curvature Clustering per Point

**Per-line length and curvature profiles within each Alfa/Beta point (patch04)**

- **Changed behavior**:
  - **Old**: All lines from the same point shared essentially the same base length (Gamma + small ±5% jitter) and curvature (Delta + small ±20% jitter).
  - **New**: Each line from the same point receives:
    - a **length profile multiplier** selected from a discrete set `[0.6, 0.85, 1.0, 1.2, 1.4]` (very short → very long),
    - a **curvature profile multiplier** selected from `[0.5, 0.8, 1.0, 1.3, 1.6]` (very low → very high curvature),
    - with a soft **inverse correlation** between length and curvature (shorter lines tend to be more curved, longer lines more straight).

- **Implementation**:
  - New helpers `computeLengthProfileMultiplier` and `computeCurvatureProfileMultiplier` in `lib/engine_v2/curves.ts`:
    - Use deterministic PRNG (`seededRandom`) with seeds of the form  
      `lenProfile: seed, pointIndex, lineIndex, clusterIndex, clusterCount` and  
      `curvProfile: seed, pointIndex, lineIndex, clusterIndex, clusterCount`.
    - Select discrete multipliers for per-line length/curvature profiles.
  - `generateCurveFromPoint` now:
    - Computes `baseLength` via existing `getLineLength` (Gamma + Slider1) and then `profiledLength = baseLength * lengthProfile`.
    - Uses `profiledLength` for end-point and curvature calculations.
    - Applies curvature profiles via `effectiveCurvatureScale = curvatureScale * curvatureProfile` when calling `applyDeltaIrregularity`.
  - `DirectionClusterDebug` in `lib/types.ts` extended with optional `lengthProfile` and `curvatureProfile` fields.
  - `DebugOverlay` (`components/DebugOverlay.tsx`) updated so that:
    - Direction indicator stroke width encodes `lengthProfile`.
    - Direction indicator opacity encodes `curvatureProfile`.

- **Visual impact**:
  - Lines emerging from the same Alfa/Beta point now show a clear hierarchy of lengths and curvatures (short/long, straight/curved) within each direction cluster.
  - Symbols appear more varied and expressive while preserving direction clustering from patch03 and point dispersion from patch02.

- **Technical details**:
  - Deterministic: same keywords + seed + sliders + canvas size → same profiles and geometry.
  - Slider semantics unchanged:
    - Slider1 (`lengthScale`) remains a **global** length multiplier applied uniformly on top of per-line profiles.
    - Slider2 (`curvatureScale`) remains a **global** curvature multiplier, modulated per-line by `curvatureProfile`.
    - Slider3/Slider4 (`clusterCount`, `clusterSpread`) remain purely directional and are reused only as parameters to the profile selection.

- **Compatibility**:
  - ✅ Non-breaking change (no public API changes).
  - ✅ Determinism preserved.
  - ✅ Slider semantics preserved (global controls on top of per-line variation).
  - ✅ Performance impact negligible (few extra PRNG calls and multiplications per line).

**Files affected:**
- `lib/engine_v2/curves.ts` (length/curvature profiles and integration into `generateCurveFromPoint`)
- `lib/types.ts` (extended `DirectionClusterDebug` with profile fields)
- `components/DebugOverlay.tsx` (visual encoding of profiles)

**Documentation:**
- `docs/proposals/patch_04_Length_and_Curvature_Clustering.md` (patch specification, updated as implemented)
- `docs/proposals/PATCHES_INDEX.md` (added patch04 entry)
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (Gamma/Delta sections updated with profiles and correlation)
- `docs/guides/debugging/engine-v2-debug-overlay.md` (documented profile visualization)

---

## 2025-01-XX – PATCH03: Direction Clustering

### PATCH03 – Direction Clustering

**Clustering of line directions for visual variety (patch03)**

- **Changed behavior**:
  - **Old**: Line directions mapped from Gamma [-100, +100] to angle range [-45°, +45°] with small jitter
  - **New**: Line directions use clustering system with range [0°, 180°]

- **Implementation**:
  - Modified `getLineDirection()` in `lib/engine_v2/curves.ts` to implement clustering
  - Added helper function `seededRandom()` in `lib/seed.ts` for convenience
  - Lines are grouped into clusters of similar directions
  - Cluster assignment: deterministic based on `seed` and `lineIndex`
  - Gamma rotates all clusters together
  - In-cluster jitter: configurable spread within each cluster

- **Clustering algorithm**:
  - Cluster assignment: `clusterIndex = floor(seededRandom(seed:cluster:lineIndex) * clusterCount)`
  - Cluster center: `clusterAngle = (clusterIndex / clusterCount) * 180` (distributed evenly across 0-180°)
  - Gamma rotation: `gammaRotation = (gamma / 100) * 180` (rotates all clusters)
  - In-cluster jitter: `jitter = (seededRandom(seed:jitter:lineIndex) - 0.5) * clusterSpread`
  - Final angle: `(clusterAngle + gammaRotation + jitter) % 180`, clamped to [0, 180]

- **Configuration parameters**:
  - `clusterCount`: Number of direction clusters (default: 3, range: 2-5)
  - `clusterSpread`: Spread angle within each cluster in degrees (default: 30°, range: 10-60°)

- **UI sliders**:
  - **Slider3: "Numero Cluster"** - controls `clusterCount` (0-100 → 2-5 clusters)
  - **Slider4: "Ampiezza Cluster"** - controls `clusterSpread` (0-100 → 10-60°)

- **Visual impact**:
  - **Before**: Lines had similar directions (all within -45° to +45°), uniform appearance
  - **After**: Lines grouped into clusters, full 0-180° directional coverage, more varied patterns

- **Technical details**:
  - Range changed from [-45°, +45°] to [0°, 180°]
  - Deterministic: same seed + lineIndex → same cluster assignment and jitter
  - Seed format: `${seed}:cluster:${lineIndex}` for cluster assignment, `${seed}:jitter:${lineIndex}` for jitter
  - Fully compatible with all existing features (point dispersion, mirroring, other sliders)

- **Compatibility**:
  - ✅ Non-breaking change (no API modifications to public functions)
  - ✅ Determinism preserved (same input → same output)
  - ✅ Works with all canvas sizes and features
  - ✅ Compatible with point dispersion (patch02), mirroring (patch01), and all sliders

**Files affected:**
- `lib/seed.ts` (added `seededRandom` helper)
- `lib/engine_v2/curves.ts` (modified `getLineDirection`, updated `generateCurveFromPoint`)
- `lib/engine_v2/engine.ts` (added clustering options to `EngineV2Options`)
- `app/page.tsx` (added UI sliders for clusterCount and clusterSpread)

**Documentation:**
- `docs/proposals/patch_03_Direction_Clustering.md` (patch specification)
- `docs/proposals/PATCHES_INDEX.md` (updated with patch03 entry)
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (updated direction section)
- `docs/reference/engine_v2/ENGINE_V2_SLIDER_MAPPING.md` (added slider documentation)

---

## 2025-01-XX – PATCH02: Point Dispersion at Line Origin

### PATCH02 – Point Dispersion

**Deterministic dispersion of line origin points (visual enhancement)**

- **Changed behavior**:
  - **Old**: All lines from a keyword started from the exact same base point (Alfa/Beta position)
  - **New**: Each line from a keyword starts from a slightly different point, deterministically dispersed around the base point

- **Implementation**:
  - New function: `generateDispersedStartPoint()` in `lib/engine_v2/curves.ts`
  - Modifies `generateCurveFromPoint()` to generate a unique dispersed start point for each line
  - Dispersion radius: 2% of canvas diagonal (default, adjustable constant)
  - Recommended range: 1–4% to keep clusters micro-dispersed while readable
  - Distribution: uniform in circle area (not uniform in radius)
  - Deterministic: same seed + pointIndex + lineIndex → same dispersed point

- **Visual impact**:
  - **Before**: Star pattern with all lines radiating from one center point
  - **After**: Organic cluster with lines starting from slightly different points
  - Creates more varied, less mechanical appearance

- **Technical details**:
  - Uses existing `prng` function for deterministic randomness
  - Seed format: `${seed}:disperse:${pointIndex}:${lineIndex}`
  - Points are clamped to canvas bounds
  - No performance impact (minimal overhead)

- **Compatibility**:
  - ✅ Non-breaking change (no API modifications)
  - ✅ Determinism preserved (same input → same output)
  - ✅ Works with all canvas sizes (dispersion scales with diagonal)
  - ✅ Compatible with all existing features (sliders, mirroring, etc.)

**Files affected:**
- `lib/engine_v2/curves.ts` (new function + modified loop)

**Documentation:**
- `docs/proposals/patch_02_Point_Dispersion_at_Line_Origin.md` (patch specification)
- `docs/proposals/PATCHES_INDEX.md` (updated with patch02 entry)
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (updated pipeline with dispersion step)

### patch02 Refinement (2025-01-XX)

**Modified behavior:**

- First line (index 0) now starts from exact Alfa/Beta position (no dispersion)

- Subsequent lines (index > 0) continue to use dispersed start points

- Maintains visual correspondence between debug anchor point and geometry

**Rationale:**

- Anchor point in debug overlay now corresponds to first line's origin

- Semantically clearer: first line = semantic position (Alfa/Beta), others = variation around it

- Preserves organic cluster appearance for remaining lines

**Implementation:**

- Changed dispersedStart assignment in `generateCurveFromPoint` to use ternary operator

- `dispersedStart = i === 0 ? start : generateDispersedStartPoint(...)`

**Compatibility:**

- ✅ Non-breaking change (no API modifications)

- ✅ Determinism preserved (same seed → same output)

- ✅ Full backward compatibility maintained

**Files modified:**

- `lib/engine_v2/curves.ts` (dispersedStart assignment logic)

- `docs/proposals/patch_02_Point_Dispersion_at_Line_Origin.md` (refinement section)

- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (section 3 updated)

### patch02 Dispersion Radius Tuning v1 (2025-01-XX)

**Change:**

- Default dispersion radius reduced from 8% → 5% of the canvas diagonal.
- Recommended sliderless tuning range narrowed from 5–15% → 3–10% to prevent overly scattered clusters.

**Rationale:**

- Previous default placed generated origins too far apart, weakening the perceived link to the Alfa/Beta anchor.
- 5% keeps points visually clustered while preserving the organic feel delivered by dispersion.

**Implementation:**

- Updated `generateDispersedStartPoint` default parameter to `0.05`.
- Updated `generateCurveFromPoint` to pass `0.05` when dispersing lines with `index > 0`.
- Refreshed patch/spec documents (pipeline + overview) with the new defaults and range guidance.

**Compatibility:**

- ✅ Determinism preserved (same seed + pointIndex + lineIndex → same dispersed point)
- ✅ Fully compatible with existing patch02 refinement (first line uses anchor point)
- ✅ Non-breaking change (no API or slider updates required)

**Files modified:**

- `lib/engine_v2/curves.ts` (default dispersion constant + call site)
- `docs/proposals/patch_02_Point_Dispersion_at_Line_Origin.md` (configuration + refinement notes)
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (dispersion step)
- `docs/reference/engine_v2/ENGINE_V2_OVERVIEW.md` (pipeline overview)

### patch02 Micro-dispersion Refinement (2025-01-XX)

**Change:**

- Default dispersion radius reduced again from 5% → 2% of the canvas diagonal.
- Recommended range narrowed to 1–4% so dispersed origins remain almost coincident with the anchor.

**Rationale:**

- QA feedback showed 5% still created clusters that felt too loose for compact compositions.
- 2% keeps lines distinguishable without visually detaching them from Alfa/Beta positions.

**Implementation:**

- Updated `generateDispersedStartPoint` default parameter to `0.02`.
- Updated `generateCurveFromPoint` to pass `0.02` when dispersing lines with `index > 0`.
- Refreshed patch/spec docs and overview with the tighter default/range.

**Compatibility:**

- ✅ Determinism preserved (same seed + pointIndex + lineIndex → same dispersed point)
- ✅ Fully compatible with anchor-first-line refinement and all sliders/mirroring
- ✅ Non-breaking change focused purely on visuals

**Files modified:**

- `lib/engine_v2/curves.ts` (dispersion constant + call site)
- `docs/proposals/patch_02_Point_Dispersion_at_Line_Origin.md` (configuration + refinement notes)
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (dispersion step)
- `docs/reference/engine_v2/ENGINE_V2_OVERVIEW.md` (pipeline overview)

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
- `docs/reference/engine_v2/SPEC_03_ENGINE_V2.md` (main specification – archived)
- `docs/reference/engine_v2/ENGINE_V2_OVERVIEW.md` (architecture overview – archived)
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (detailed pipeline – archived)
- `docs/reference/engine_v2/ENGINE_V2_SEMANTIC_MAP.md` (semantic mapping)
- `docs/reference/engine_v2/ENGINE_V2_MIGRATION_GUIDE.md` (migration guide – archived)

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
- `docs/proposals/patch01_SPEC_03_mirroring_revision.md` (patch specification)
- `docs/proposals/patch01_tasks.md` (implementation tasks)

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
- `docs/reference/engine_v2/ENGINE_V2_SLIDER_MAPPING.md` (slider mapping reference)
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (updated with lengthScale note)

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
- `docs/guides/debugging/engine-v2-debug-overlay.md` (debug overlay guide)
- `docs/guides/debugging/README.md` (debug tools overview)

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
