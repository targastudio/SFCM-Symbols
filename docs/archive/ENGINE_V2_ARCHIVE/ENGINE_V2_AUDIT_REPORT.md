# ENGINE_V2 Audit Report

**Date**: Generated during migration audit  
**Scope**: Complete codebase comparison against SPEC_03_ENGINE_V2 and related documentation  
**Status**: **PARTIALLY COMPLIANT** (with identified issues)

---

## Executive Summary

The codebase has been successfully migrated to ENGINE_V2 architecture, with the new 4-axis system (Alfa, Beta, Gamma, Delta) implemented and integrated. However, several issues and inconsistencies have been identified that require attention:

1. **Critical**: `SvgPreview.tsx` still imports from deprecated `lib/geometry.ts`
2. **Warning**: Seed generation formula differs from SPEC_03 specification
3. **Warning**: Position formula implementation differs in form (but mathematically equivalent)
4. **Info**: Old engine code (`lib/geometry.ts`, `lib/semantic.ts`) still exists but is isolated
5. **Info**: Sliders correctly implemented as placeholders (no logic)

**Overall Compliance**: **PARTIALLY COMPLIANT** — Core ENGINE_V2 is functional, but cleanup and spec alignment needed.

---

## 1. High-Level Compliance Report

### ✅ Fully Compliant Areas

- **4-Axis System**: Correctly implemented (Alfa, Beta, Gamma, Delta, range [-100, +100])
- **Pipeline Order**: Correct sequence (Keyword → Axes → Position → Mirroring → Gamma/Delta → Curves)
- **Quadrant Mirroring**: Implemented with correct logic (1→3, 2→2, 3→1, 4→0)
- **Gamma/Delta Curve Generation**: Formulas match ENGINE_V2_GEOMETRY_PIPELINE.md
- **Slider Placeholders**: UI preserved, logic completely removed (as per ENGINE_V2_SLIDER_MAPPING.md)
- **Canvas Size Support**: Fully functional across all presets
- **Determinism**: Seed-based RNG correctly implemented
- **Output Format**: BranchedConnection[] compatible with existing rendering

### ⚠️ Partially Compliant Areas

- **Seed Generation**: Formula differs from SPEC_03 (but may be intentional per slider mapping)
- **Position Formulas**: Implementation uses different form than spec (but mathematically equivalent)
- **Old Code Cleanup**: Deprecated modules still exist (acceptable per migration guide, but should be documented)

### ❌ Non-Compliant Areas

- **SvgPreview Dependency**: Still imports `computeCurveControl` from deprecated `lib/geometry.ts`
- **No Documentation**: Missing explicit deprecation markers on old code

---

## 2. File-by-File Inspection

### `app/page.tsx`

**Status**: ✅ **COMPLIANT** (with minor note)

**Current Implementation**:
- Uses `generateEngineV2` from `lib/engine_v2/engine`
- Sliders (densità, ramificazione, complessità, mutamento) are state variables but not used in generation
- Seed generation: `hash(keywords + canvasWidth + canvasHeight)` (sliders excluded)
- No imports from old geometry or semantic modules

**SPEC_03 Requirements**:
- ✅ Should use ENGINE_V2 pipeline
- ✅ Sliders should be placeholders (no logic)
- ⚠️ Seed formula in SPEC_03 says: `hash(keywords_normalizzate + valori_assi + slider + canvasSize)`
  - **Issue**: Implementation excludes `valori_assi` and `slider` from seed
  - **Note**: This may be intentional per ENGINE_V2_SLIDER_MAPPING.md (sliders removed), but SPEC_03 formula is ambiguous

**Lines of Interest**:
- Lines 22-25: Slider state variables (correctly unused in generation)
- Lines 141-149: `generateSeed` function (excludes sliders, matches ENGINE_V2_SLIDER_MAPPING.md)
- Lines 182-187: ENGINE_V2 generation call (correct)

**Action Items**:
- [ ] Clarify SPEC_03 seed formula: should it include `valori_assi`? (Currently axes are derived from keywords, so including them would be redundant)
- [ ] Document that slider exclusion from seed is intentional per ENGINE_V2_SLIDER_MAPPING.md

---

### `lib/engine_v2/axes.ts`

**Status**: ✅ **COMPLIANT**

**Current Implementation**:
- Maps keywords to 4 axes (Alfa, Beta, Gamma, Delta)
- Supports both old 6-axis dictionary format (with conversion) and new 4-axis format
- Deterministic fallback for unknown keywords
- Range: [-100, +100] correctly enforced

**SPEC_03 Requirements**:
- ✅ Keyword → 4 axes mapping
- ✅ Dictionary lookup with fallback
- ✅ Range [-100, +100]

**Lines of Interest**:
- Lines 35-66: `convert6AxesTo4Axes` function (converts old format, acceptable per migration guide)
- Lines 92-137: `getAxesV2ForKeyword` function (correct implementation)

**Action Items**: None (fully compliant)

---

### `lib/engine_v2/position.ts`

**Status**: ⚠️ **PARTIALLY COMPLIANT** (formula form differs, but mathematically equivalent)

**Current Implementation**:
```typescript
xNorm = clamp01(0.5 + axes.alfa / 200);
yNorm = clamp01(0.5 - axes.beta / 200);
```

**SPEC_03 Requirements** (from SPEC_03_ENGINE_V2.md):
```
xNorm = 0.5 + (Alfa / 200)
yNorm = 0.5 - (Beta / 200)
```

**ENGINE_V2_GEOMETRY_PIPELINE.md** says:
```
xNorm = 0.5 + (Alfa / 100) * 0.5
yNorm = 0.5 - (Beta / 100) * 0.5
```

**Analysis**:
- SPEC_03 formula: `0.5 + (Alfa / 200)` = `0.5 + Alfa/200`
- ENGINE_V2_GEOMETRY_PIPELINE formula: `0.5 + (Alfa / 100) * 0.5` = `0.5 + Alfa/200`
- Implementation: `0.5 + axes.alfa / 200` = `0.5 + Alfa/200`
- **All three are mathematically equivalent** ✅

**Issue**: There's a discrepancy between SPEC_03 and ENGINE_V2_GEOMETRY_PIPELINE in the written form, but both resolve to the same formula. The implementation matches SPEC_03 exactly.

**Lines of Interest**:
- Lines 26-30: `axesToNormalizedPosition` (correct, matches SPEC_03)

**Action Items**:
- [ ] Resolve documentation inconsistency: ENGINE_V2_GEOMETRY_PIPELINE.md shows `(Alfa / 100) * 0.5` while SPEC_03 shows `(Alfa / 200)`. Both are correct, but should be consistent.
- [ ] Implementation is correct as-is (matches SPEC_03)

---

### `lib/engine_v2/mirroring.ts`

**Status**: ✅ **COMPLIANT**

**Current Implementation**:
- Detects occupied quadrants correctly
- Applies mirroring rules: 1→3, 2→2, 3→1, 4→0
- Uses reflection: horizontal, vertical, both
- Operates on normalized coordinates [0, 1] × [0, 1]

**SPEC_03 Requirements**:
- ✅ Mirroring before Gamma/Delta (correct order in engine.ts)
- ✅ Rules match spec exactly
- ✅ Reflection formulas: (1-x, y), (x, 1-y), (1-x, 1-y)

**Lines of Interest**:
- Lines 56-72: `getOccupiedQuadrants` (correct)
- Lines 85-195: `applyQuadrantMirroring` (correct logic)

**Action Items**: None (fully compliant)

---

### `lib/engine_v2/curves.ts`

**Status**: ✅ **COMPLIANT**

**Current Implementation**:
- Gamma controls: number of lines (1-3), direction (-45° to +45°), length (2-10% of canvas min)
- Delta controls: jitter (0-3% of line length)
- Formulas match ENGINE_V2_GEOMETRY_PIPELINE.md exactly

**SPEC_03 Requirements**:
- ✅ Number of lines: `L = 1 + floor( ((Gamma +100)/200) * 2 )` ✅ (line 41-44)
- ✅ Direction: -45° to +45° ✅ (line 60)
- ✅ Length: 2% to 10% of canvas min dimension ✅ (line 86)
- ✅ Delta jitter: 0 to 3% of line length ✅ (line 113)

**Lines of Interest**:
- Lines 41-44: `getNumberOfLines` (matches spec formula)
- Lines 53-67: `getLineDirection` (correct angle range)
- Lines 75-93: `getLineLength` (correct percentage range)
- Lines 102-128: `applyDeltaIrregularity` (correct jitter range)

**Action Items**: None (fully compliant)

---

### `lib/engine_v2/engine.ts`

**Status**: ✅ **COMPLIANT**

**Current Implementation**:
- Orchestrates complete pipeline in correct order
- Converts ENGINE_V2 curves to BranchedConnection format
- Canvas-aware (uses canvasWidth/canvasHeight)
- Limits keywords to max 10

**SPEC_03 Requirements**:
- ✅ Step 1: Keyword → 4 Axes
- ✅ Step 2: Alfa/Beta → Normalized → Pixel
- ✅ Step 3: Mirroring (before Gamma/Delta)
- ✅ Step 4: Apply Gamma
- ✅ Step 5: Apply Delta
- ✅ Step 6: Output quadratic curves

**Lines of Interest**:
- Lines 96-102: Step 1 (correct)
- Lines 104-116: Step 2 (correct)
- Lines 118-124: Step 3 (correct, before Gamma/Delta)
- Lines 158-187: Steps 4 & 5 (correct)
- Lines 189-192: Step 6 (correct)

**Action Items**: None (fully compliant)

---

### `components/SvgPreview.tsx`

**Status**: ❌ **NON-COMPLIANT** (imports deprecated code)

**Current Implementation**:
- Line 4: `import { computeCurveControl } from "../lib/geometry";`
- Line 205: Uses `computeCurveControl(conn, canvasWidth, canvasHeight)`
- Renders BranchedConnection[] correctly
- Animation system works correctly

**SPEC_03 Requirements**:
- ✅ Should not depend on old engine code
- ✅ Should work with BranchedConnection output (works correctly)
- ❌ **VIOLATION**: Imports from deprecated `lib/geometry.ts`

**Issue**: 
- `computeCurveControl` is a utility function from the old engine
- ENGINE_V2 already calculates curvature values in `engine.ts` (line 37-61)
- The curvature value in BranchedConnection should be sufficient for rendering
- However, `computeCurveControl` is used to clamp control points to canvas bounds

**Analysis**:
- The function `computeCurveControl` in `lib/geometry.ts` (lines 1359-1378) calculates control point from curvature value
- ENGINE_V2 generates actual control points and converts them to curvature values
- When rendering, SvgPreview recalculates control points from curvature (which may differ slightly due to approximation)

**Lines of Interest**:
- Line 4: Import from deprecated module
- Line 205: Usage of deprecated function

**Action Items**:
- [ ] **CRITICAL**: Extract `computeCurveControl` to a shared utility (e.g., `lib/svgUtils.ts`) or inline the logic in SvgPreview
- [ ] Remove dependency on `lib/geometry.ts` from SvgPreview
- [ ] Consider: ENGINE_V2 could store actual control points in BranchedConnection to avoid recalculation

---

### `lib/types.ts`

**Status**: ✅ **COMPLIANT**

**Current Implementation**:
- Contains both old types (Axes, Cluster, etc.) and new ENGINE_V2 types (AxesV2, Quadrant, EngineV2Curve)
- Old types preserved for backward compatibility (acceptable per migration guide)

**SPEC_03 Requirements**:
- ✅ ENGINE_V2 types defined correctly
- ✅ Old types can remain (not actively harmful)

**Lines of Interest**:
- Lines 6-53: Old types (deprecated but harmless)
- Lines 55-96: ENGINE_V2 types (correct)

**Action Items**:
- [ ] Optional: Add `@deprecated` JSDoc tags to old types for clarity

---

### `lib/semantic.ts`

**Status**: ⚠️ **ISOLATED** (not used, but still exists)

**Current Implementation**:
- Contains old 6-axis semantic system (`getAxesForKeyword`, `fallbackAxes`)
- Not imported by ENGINE_V2 (which uses `lib/engine_v2/axes.ts` instead)
- Not imported by `app/page.tsx`

**SPEC_03 Requirements**:
- ✅ Should not be used by ENGINE_V2 (correct)
- ⚠️ Still exists in codebase (acceptable per migration guide, but should be documented)

**Lines of Interest**:
- Entire file: Old 6-axis system (isolated, not used)

**Action Items**:
- [ ] Add deprecation notice at top of file
- [ ] Consider archiving to `lib/archive/` or removing after verification

---

### `lib/geometry.ts`

**Status**: ⚠️ **ISOLATED** (partially used, should be fully deprecated)

**Current Implementation**:
- Contains entire old engine: clusters, MST, connections, branching, replication
- **Still imported by**: `components/SvgPreview.tsx` (line 4: `computeCurveControl`)
- **Not imported by**: `app/page.tsx` (correct)

**SPEC_03 Requirements**:
- ❌ Should not be used by any active code
- ⚠️ Still exists (acceptable per migration guide, but dependency should be removed)

**Functions Still Referenced**:
- `computeCurveControl` (used by SvgPreview)

**Functions Not Used** (deprecated):
- `generateClusters`
- `buildConnections`
- `detectIntersections`
- `addBranching`
- All other old engine functions

**Action Items**:
- [ ] **CRITICAL**: Extract `computeCurveControl` to shared utility
- [ ] Remove import from SvgPreview
- [ ] Add deprecation notice at top of `lib/geometry.ts`
- [ ] Consider archiving entire file after extraction

---

### `lib/svgStyleConfig.ts`

**Status**: ✅ **COMPLIANT**

**Current Implementation**:
- Stroke width: 3px ✅
- Arrowheads: 14×19px ✅
- Colors: #ffffff (white), #000000 (black) ✅
- All constants match SPEC_03 requirements

**SPEC_03 Requirements**:
- ✅ Arrowheads: 14×19px, fill-only white
- ✅ Stroke: 3px
- ✅ Background: black (#000)
- ✅ Lines: white (#fff)

**Action Items**: None (fully compliant)

---

### `semantic/semantic-map.json`

**Status**: ⚠️ **LEGACY FORMAT** (works via conversion, but not optimal)

**Current Implementation**:
- Contains 6-axis format (old): `ordine_caos`, `conflitto_consenso`, etc.
- ENGINE_V2 converts this to 4-axis format via `convert6AxesTo4Axes`

**SPEC_03 Requirements**:
- ✅ Dictionary lookup works (via conversion)
- ⚠️ Not in native 4-axis format (acceptable, but not optimal)

**Action Items**:
- [ ] Optional: Migrate dictionary to 4-axis format for direct lookup (future optimization)
- [ ] Current conversion approach is acceptable per migration guide

---

## 3. Architecture-Level Issues

### 3.1 Determinism

**Status**: ✅ **COMPLIANT**

- Seed generation: `cyrb53(keywords + canvasWidth + canvasHeight)`
- All RNG uses `seedrandom` with deterministic seeds
- Same input → same output guaranteed
- **Note**: SPEC_03 formula mentions `valori_assi + slider` in seed, but implementation excludes them (may be intentional per slider mapping)

**Action Items**:
- [ ] Clarify SPEC_03 seed formula intent

---

### 3.2 Seed Generation

**Status**: ⚠️ **SPEC MISMATCH** (but may be intentional)

**SPEC_03 Formula** (line 122):
```
hash(keywords_normalizzate + valori_assi + slider + canvasSize)
```

**Current Implementation** (`app/page.tsx` line 147):
```typescript
const params = `${keywords.join(",")}-${canvasWidth}-${canvasHeight}`;
return String(cyrb53(params));
```

**Analysis**:
- Missing: `valori_assi` (axes values)
- Missing: `slider` (intentional per ENGINE_V2_SLIDER_MAPPING.md)
- Present: `keywords` (normalized via join)
- Present: `canvasSize` (as canvasWidth/canvasHeight)

**Issue**: SPEC_03 mentions `valori_assi` in seed, but axes are derived from keywords deterministically, so including them would be redundant. However, the spec explicitly mentions them.

**Action Items**:
- [ ] Clarify with spec author: Should axes values be included in seed? (Currently they're deterministic from keywords, so it's redundant)
- [ ] Document that slider exclusion is intentional per ENGINE_V2_SLIDER_MAPPING.md

---

### 3.3 Keyword → Axes Mapping

**Status**: ✅ **COMPLIANT**

- Uses `getAxesV2ForKeyword` from `lib/engine_v2/axes.ts`
- Supports dictionary lookup (6-axis with conversion, or 4-axis native)
- Deterministic fallback for unknown keywords
- Range [-100, +100] correctly enforced

**Action Items**: None

---

### 3.4 Normalized Coordinate System

**Status**: ✅ **COMPLIANT**

- Formulas match SPEC_03 (mathematically equivalent to ENGINE_V2_GEOMETRY_PIPELINE.md)
- Clamping to [0, 1] correctly implemented
- Conversion to pixel coordinates correct

**Action Items**:
- [ ] Resolve documentation inconsistency between SPEC_03 and ENGINE_V2_GEOMETRY_PIPELINE.md (both correct, but different written forms)

---

### 3.5 Curve Generation

**Status**: ✅ **COMPLIANT**

- Gamma formulas match spec exactly
- Delta formulas match spec exactly
- All curves are quadratic (single control point)
- Control points clamped to canvas bounds

**Action Items**: None

---

### 3.6 Export Pipeline

**Status**: ✅ **COMPLIANT**

- `DownloadSvgButton.tsx` and `prepareSvgForExport.ts` unchanged (as required)
- Works with BranchedConnection[] output
- No changes needed per SPEC_03

**Action Items**: None

---

### 3.7 Styling Constants

**Status**: ✅ **COMPLIANT**

- All constants match SPEC_03 requirements
- No changes needed

**Action Items**: None

---

### 3.8 Canvas Size Interaction

**Status**: ✅ **COMPLIANT**

- All canvas sizes supported (1:1, 4:5, 9:16, 16:9, fit, custom)
- Geometry correctly scales to canvas dimensions
- Auto-regeneration on canvas size change works

**Action Items**: None

---

### 3.9 Render/Update Flow

**Status**: ✅ **COMPLIANT**

- Animation system works correctly
- State management correct
- No hydration issues

**Action Items**: None

---

## 4. Required Fixes (Prioritized)

### Priority 1: Critical (Breaks SPEC_03 Compliance)

1. **Extract `computeCurveControl` from `lib/geometry.ts`**
   - **File**: `components/SvgPreview.tsx` (line 4)
   - **Issue**: Imports from deprecated module
   - **Fix**: Move function to `lib/svgUtils.ts` or inline in SvgPreview
   - **Impact**: Removes dependency on old engine code

### Priority 2: High (Spec Alignment)

2. **Clarify Seed Generation Formula**
   - **File**: `app/page.tsx` (line 141-149), `docs/SPEC_03_ENGINE_V2.md` (line 122)
   - **Issue**: SPEC_03 mentions `valori_assi + slider` in seed, but implementation excludes them
   - **Fix**: Update SPEC_03 to match implementation, or update implementation to match spec
   - **Impact**: Ensures spec accuracy

3. **Resolve Position Formula Documentation Inconsistency**
   - **Files**: `docs/SPEC_03_ENGINE_V2.md`, `docs/ENGINE_V2_GEOMETRY_PIPELINE.md`
   - **Issue**: Different written forms (but mathematically equivalent)
   - **Fix**: Standardize documentation to one form
   - **Impact**: Prevents confusion

### Priority 3: Medium (Code Cleanup)

4. **Add Deprecation Markers**
   - **Files**: `lib/geometry.ts`, `lib/semantic.ts`
   - **Issue**: No explicit deprecation notices
   - **Fix**: Add `@deprecated` JSDoc tags and file-level notices
   - **Impact**: Clear documentation of deprecated code

5. **Archive or Remove Old Engine Code**
   - **Files**: `lib/geometry.ts` (after extracting `computeCurveControl`), `lib/semantic.ts`
   - **Issue**: Old code still in active codebase
   - **Fix**: Move to `lib/archive/` or remove after verification
   - **Impact**: Cleaner codebase

### Priority 4: Low (Future Optimization)

6. **Migrate Dictionary to 4-Axis Format**
   - **File**: `semantic/semantic-map.json`
   - **Issue**: Uses 6-axis format (works via conversion)
   - **Fix**: Convert entries to 4-axis format for direct lookup
   - **Impact**: Performance optimization (minor)

---

## 5. Safety Warnings

### ⚠️ Warning 1: Curvature Approximation

**Location**: `lib/engine_v2/engine.ts` (lines 37-61)

**Issue**: ENGINE_V2 generates actual control points, then converts them to curvature values to match `computeCurveControl` formula. This is an approximation that may not perfectly reproduce the original control point when rendered.

**Impact**: 
- Slight visual differences possible (likely imperceptible)
- Control points may be slightly different after round-trip conversion

**Mitigation**: 
- Current approach is acceptable for compatibility
- Future: Consider storing actual control points in BranchedConnection

---

### ⚠️ Warning 2: Old Code Still Imported

**Location**: `components/SvgPreview.tsx` (line 4)

**Issue**: Still imports `computeCurveControl` from deprecated `lib/geometry.ts`

**Impact**:
- Creates dependency on old engine code
- If `lib/geometry.ts` is removed, SvgPreview will break

**Mitigation**: Extract function before removing old code

---

### ⚠️ Warning 3: Seed Formula Ambiguity

**Location**: `docs/SPEC_03_ENGINE_V2.md` (line 122) vs `app/page.tsx` (line 147)

**Issue**: SPEC_03 formula includes `valori_assi + slider`, but implementation excludes them

**Impact**:
- Potential non-determinism if spec is interpreted differently
- Confusion about correct seed formula

**Mitigation**: Clarify spec or align implementation

---

### ✅ No Issues Detected For:

- Determinism (correctly implemented)
- Preview/export consistency (unchanged, works correctly)
- Hydration (no SSR issues)
- Non-spec-compliant outputs (all outputs match spec)

---

## 6. Summary of Findings

### Compliance Status

| Area | Status | Notes |
|------|--------|-------|
| 4-Axis System | ✅ Compliant | Correctly implemented |
| Pipeline Order | ✅ Compliant | Matches spec exactly |
| Mirroring Logic | ✅ Compliant | Rules match spec |
| Gamma/Delta Formulas | ✅ Compliant | All formulas correct |
| Slider Placeholders | ✅ Compliant | Logic removed, UI preserved |
| Seed Generation | ⚠️ Spec Mismatch | Formula differs (may be intentional) |
| Position Formulas | ⚠️ Doc Inconsistency | Math correct, written form differs |
| Old Code Cleanup | ⚠️ Incomplete | Still exists, one import remains |
| SvgPreview Dependency | ❌ Non-Compliant | Imports from deprecated module |

### Files Requiring Action

1. **`components/SvgPreview.tsx`** — Extract `computeCurveControl` dependency
2. **`docs/SPEC_03_ENGINE_V2.md`** — Clarify seed formula
3. **`docs/ENGINE_V2_GEOMETRY_PIPELINE.md`** — Standardize position formula notation
4. **`lib/geometry.ts`** — Add deprecation notice, extract `computeCurveControl`
5. **`lib/semantic.ts`** — Add deprecation notice

### Files Fully Compliant

- `lib/engine_v2/axes.ts`
- `lib/engine_v2/position.ts`
- `lib/engine_v2/mirroring.ts`
- `lib/engine_v2/curves.ts`
- `lib/engine_v2/engine.ts`
- `app/page.tsx` (except seed formula clarification)
- `lib/types.ts`
- `lib/svgStyleConfig.ts`
- `components/DownloadSvgButton.tsx`
- `lib/prepareSvgForExport.ts`

---

## 7. Conclusion

The ENGINE_V2 migration is **functionally complete** and **mostly compliant** with SPEC_03. The core engine correctly implements the 4-axis system, pipeline order, mirroring, and curve generation. However, one critical issue remains: `SvgPreview.tsx` still depends on deprecated code from `lib/geometry.ts`.

**Recommended Next Steps**:
1. Extract `computeCurveControl` to resolve SvgPreview dependency (Priority 1)
2. Clarify seed generation formula in SPEC_03 (Priority 2)
3. Add deprecation markers to old code (Priority 3)
4. Archive or remove old engine code after verification (Priority 3)

The codebase is **production-ready** after addressing Priority 1, and **fully compliant** after addressing Priority 2.

---

**End of Audit Report**

