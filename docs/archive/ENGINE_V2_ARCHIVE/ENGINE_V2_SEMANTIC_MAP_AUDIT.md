# ENGINE_V2 Semantic Map Audit

**Date**: Complete audit of semantic mapping implementation  
**Scope**: Verification of ENGINE_V2 semantic mapping and full detachment of legacy 6-axis system  
**Status**: ✅ **FULLY COMPLIANT** — Legacy system fully detached

---

## 1. Overview

This audit verifies that:

1. The new ENGINE_V2 semantic mapping system (4-axis: Alfa, Beta, Gamma, Delta) is correctly implemented according to `docs/reference/engine_v2/ENGINE_V2_SEMANTIC_MAP.md` and `docs/reference/engine_v2/ENGINE_V2_SEMANTIC_MAP_TASKS.md`.

2. The old 6-axis semantic engine (`lib/semantic.ts` + `semantic/semantic-map.json`) is **fully detached** from the runtime and exists only as legacy reference.

3. All keyword → axes transformations in ENGINE_V2 use the new mapping system exclusively.

**Goal**: Ensure complete separation between ENGINE_V2 (4-axis) and legacy ENGINE_V1 (6-axis) semantic systems.

---

## 2. Files and Functions Reviewed

### 2.1 `lib/types.ts`

**Status**: ✅ **COMPLIANT**

**Types Verified**:
- ✅ `AxesV2` type exists with correct structure:
  ```typescript
  export type AxesV2 = {
    alfa: number;   // Azione ↔ Osservazione
    beta: number;   // Specifico ↔ Ampio
    gamma: number;  // Unico ↔ Composto
    delta: number;  // Regolare ↔ Irregolare
  };
  ```
- ✅ `SemanticMapV2` type exists:
  ```typescript
  export type SemanticMapV2 = Record<string, AxesV2>;
  ```
- ✅ Both types have proper documentation referencing `ENGINE_V2_SEMANTIC_MAP.md`

**Compliance**: Matches `ENGINE_V2_SEMANTIC_MAP.md` section 2.2 and `ENGINE_V2_SEMANTIC_MAP_TASKS.md` section 2.1 exactly.

---

### 2.2 `lib/engine_v2/axes.ts`

**Status**: ✅ **COMPLIANT**

**Note**: The implementation is in `lib/engine_v2/axes.ts` (not a separate `semantic-map.ts` file). This is acceptable as the docs specify "lib/engine_v2/axes.ts (or equivalent engine_v2 mapping module)".

**Functions Verified**:

1. ✅ `normalizeKeywordV2(raw: string): string`
   - Implementation: `return raw.trim().toLowerCase();`
   - Matches `ENGINE_V2_SEMANTIC_MAP.md` section 3.1 exactly
   - No additional logic or magic

2. ✅ `sanitizeAxesV2(raw: any): AxesV2 | null`
   - Validates all 4 axes are present and are numbers
   - Checks for NaN and Infinity
   - Clamps values to [-100, +100]
   - Returns null on validation failure
   - Matches `ENGINE_V2_SEMANTIC_MAP.md` section 3.4 exactly

3. ✅ `fallbackAxesV2(normalized: string): AxesV2`
   - Uses `seedrandom` with fixed prefix `"axes_v2:"`
   - Deterministic: same keyword → same values
   - Values bounded to [-100, +100]
   - Matches `ENGINE_V2_SEMANTIC_MAP.md` section 3.3 exactly

4. ✅ `getSemanticMapV2(): SemanticMapV2`
   - Imports `semantic-map-v2.json` statically
   - Normalizes all keys using `normalizeKeywordV2`
   - Sanitizes all values using `sanitizeAxesV2`
   - Graceful error handling (returns empty map on failure, does not crash)
   - Matches `ENGINE_V2_SEMANTIC_MAP_TASKS.md` section 3.1

5. ✅ `getAxesForKeywordV2(keyword: string, map: SemanticMapV2): AxesV2`
   - Main public API for keyword → axes mapping
   - Normalizes keyword
   - Looks up in map
   - Uses deterministic fallback if not found
   - Matches `ENGINE_V2_SEMANTIC_MAP.md` section 3.2 exactly

**Legacy Function**:
- ⚠️ `getAxesV2ForKeyword(word: string): Promise<AxesV2>` exists as deprecated wrapper
  - Marked with `@deprecated` tag
  - Wraps the new synchronous API
  - Kept for backward compatibility during migration
  - **Status**: Acceptable, but should be removed once all call sites are updated

**No Legacy Code**:
- ✅ No reference to old 6-axis `Axes` type
- ✅ No conversion logic from 6-axis to 4-axis
- ✅ No import of `semantic-map.json` (old 6-axis dictionary)

**Compliance**: Fully matches all requirements in `ENGINE_V2_SEMANTIC_MAP.md` and `ENGINE_V2_SEMANTIC_MAP_TASKS.md`.

---

### 2.3 `lib/engine_v2/engine.ts`

**Status**: ✅ **COMPLIANT**

**Semantic Mapping Integration**:
- ✅ Uses `getSemanticMapV2()` to load the map once per generation
- ✅ Uses `getAxesForKeywordV2(keyword, semanticMap)` for each keyword
- ✅ No calls to old `getAxesForKeyword` from `lib/semantic.ts`
- ✅ No imports from `lib/semantic.ts`
- ✅ Pipeline order matches `ENGINE_V2_GEOMETRY_PIPELINE.md`:
  1. Keyword → 4 Axes (via `getAxesForKeywordV2`)
  2. Alfa/Beta → Normalized coordinates → Pixel coordinates
  3. Mirroring quadrants
  4. Apply Gamma/Delta (curves)

**Code Evidence**:
```typescript
// Line 19-22: Imports
import {
  getAxesForKeywordV2,
  getSemanticMapV2,
} from "./axes";

// Line 109: Load map once
const semanticMap = getSemanticMapV2();

// Line 111-116: Map each keyword
const keywordVectors: Array<{ keyword: string; axes: AxesV2 }> = limitedKeywords.map(
  (keyword) => {
    const axes = getAxesForKeywordV2(keyword, semanticMap);
    return { keyword, axes };
  }
);
```

**Compliance**: ✅ Fully uses new 4-axis semantic mapping system.

---

### 2.4 `app/page.tsx`

**Status**: ✅ **COMPLIANT**

**Semantic Mapping Usage**:
- ✅ Uses `generateEngineV2()` which internally uses the new semantic mapping
- ✅ No direct imports from `lib/semantic.ts`
- ✅ No direct calls to old `getAxesForKeyword`
- ✅ Keywords are passed to ENGINE_V2, which handles semantic mapping internally

**Code Evidence**:
```typescript
// Line 11: Import ENGINE_V2
import { generateEngineV2 } from "../lib/engine_v2/engine";

// Line 187: Call ENGINE_V2 (which uses new semantic mapping)
const connections = await generateEngineV2(
  keywordsList,
  seed,
  canvasWidth,
  canvasHeight
);
```

**Compliance**: ✅ Uses ENGINE_V2 exclusively, which uses new semantic mapping.

---

## 3. Legacy Engine Status

### 3.1 `lib/semantic.ts`

**Status**: ✅ **FULLY DETACHED** from runtime

**File Location**: `lib/semantic.ts`

**Deprecation Markers**:
- ✅ Clear deprecation header with `@deprecated` tag
- ✅ Explicit note: "This module is FULLY DETACHED from ENGINE_V2"
- ✅ References `ENGINE_V2_SEMANTIC_MAP.md` section 4

**Contents**:
- Contains old 6-axis system:
  - `getAxesForKeyword(word: string): Promise<Axes>` — returns 6-axis `Axes` type
  - `fallbackAxes(word: string): Axes` — generates 6-axis values
- Imports `semantic-map.json` (old 6-axis dictionary)

**Runtime Usage**:
- ❌ **NOT imported** anywhere in active code
- ❌ **NOT used** by ENGINE_V2
- ❌ **NOT used** by `app/page.tsx`
- ✅ Exists only as legacy reference

**Verification**: Project-wide search found **ZERO** imports of `lib/semantic.ts` in active runtime code.

---

### 3.2 `semantic/semantic-map.json`

**Status**: ✅ **FULLY DETACHED** from runtime

**File Location**: `semantic/semantic-map.json`

**Contents**: Old 6-axis semantic dictionary (format: `{ keyword: { ordine_caos, conflitto_consenso, ... } }`)

**Runtime Usage**:
- ❌ **NOT imported** by any ENGINE_V2 module
- ✅ Only imported by `lib/semantic.ts` (which is deprecated and unused)
- ✅ Exists only as legacy reference

**Verification**: Project-wide search found **ZERO** imports of `semantic-map.json` in active ENGINE_V2 code. Only reference is in deprecated `lib/semantic.ts`.

---

### 3.3 Confirmation: 6-Axis System Not in Runtime

**Explicit Confirmation**: ✅ **CONFIRMED**

The old 6-axis semantic system (`lib/semantic.ts` + `semantic/semantic-map.json`) is **NOT part of the active runtime**.

**Evidence**:
1. ✅ No imports of `lib/semantic.ts` found in active code
2. ✅ No imports of `semantic-map.json` in ENGINE_V2 modules
3. ✅ ENGINE_V2 uses only `semantic-map-v2.json` via `lib/engine_v2/axes.ts`
4. ✅ All keyword → axes transformations go through `getAxesForKeywordV2`

---

## 4. Search Results

### 4.1 Project-Wide Search for Legacy Semantic Engine

**Search Pattern**: Imports of `lib/semantic` or `semantic-map.json`

**Method**: Full-text grep across entire codebase

**Results**:

#### Active Runtime Code (lib/, app/, components/)
- ✅ **ZERO** imports of `lib/semantic.ts` found
- ✅ **ZERO** imports of `semantic-map.json` found in ENGINE_V2 modules
- ✅ Only reference to `semantic-map.json` is in deprecated `lib/semantic.ts`

#### Documentation Files (docs/)
- Multiple references found, but these are:
  - Historical documentation
  - Implementation reports
  - Migration guides
  - **NOT runtime code**

#### Legacy File Itself
- `lib/semantic.ts` imports `semantic-map.json` (expected, as it's the legacy file)

---

### 4.2 Summary of Search Results

| File/Pattern | Found In | Status | Action |
|--------------|----------|--------|--------|
| `lib/semantic.ts` imports | Active runtime code | ❌ **NONE** | ✅ No action needed |
| `semantic-map.json` imports | ENGINE_V2 modules | ❌ **NONE** | ✅ No action needed |
| `semantic-map.json` imports | `lib/semantic.ts` only | ✅ **1** (legacy) | ✅ Acceptable (deprecated file) |
| `semantic-map-v2.json` imports | `lib/engine_v2/axes.ts` | ✅ **1** (active) | ✅ Correct |

**Conclusion**: ✅ Legacy system is fully detached. No active runtime code uses the old 6-axis system.

---

## 5. Changes Applied

**Status**: ✅ **NO CHANGES NEEDED**

The audit found that the implementation is already fully compliant:

1. ✅ New semantic mapping correctly implemented in `lib/engine_v2/axes.ts`
2. ✅ ENGINE_V2 uses new mapping exclusively
3. ✅ Legacy system fully detached (not imported anywhere)
4. ✅ All verification checks pass

**No code changes were required** — the implementation already matches the documentation requirements.

---

## 6. Final Verification

### 6.1 TypeScript Check

**Command**: `npm run build` (includes TypeScript check)  
**Status**: ✅ **PASSED**

```
✓ Compiled successfully in 538.0ms
✓ Running TypeScript ...
✓ Generating static pages (4/4) in 177.2ms
```

**Result**: No TypeScript errors

---

### 6.2 Linting

**Command**: `read_lints` on ENGINE_V2 modules and app/page.tsx  
**Status**: ✅ **PASSED**

**Files Checked**:
- `lib/engine_v2/axes.ts`
- `lib/engine_v2/engine.ts`
- `app/page.tsx`

**Result**: No linting errors

---

### 6.3 Build

**Command**: `npm run build`  
**Status**: ✅ **PASSED**

**Result**: Production build successful, all routes generated correctly

---

### 6.4 Explicit Confirmations

#### ENGINE_V2 Uses Only New Semantic System

✅ **CONFIRMED**:
- ENGINE_V2 uses `semantic-map-v2.json` (4-axis dictionary)
- ENGINE_V2 uses `getAxesForKeywordV2()` for keyword → axes mapping
- ENGINE_V2 uses `getSemanticMapV2()` to load the dictionary
- All keyword transformations go through the new 4-axis system

**Evidence**:
- `lib/engine_v2/engine.ts` imports only from `./axes` (new system)
- `lib/engine_v2/axes.ts` imports only `semantic-map-v2.json`
- No references to old 6-axis system in ENGINE_V2 code

---

#### Legacy 6-Axis System Fully Detached

✅ **CONFIRMED**:
- `lib/semantic.ts` is **NOT imported** by any active runtime code
- `semantic-map.json` is **NOT imported** by any ENGINE_V2 module
- Legacy files exist only as deprecated reference
- No conversion logic from 6-axis to 4-axis remains in ENGINE_V2

**Evidence**:
- Project-wide search found zero imports of `lib/semantic.ts` in active code
- Project-wide search found zero imports of `semantic-map.json` in ENGINE_V2 modules
- `lib/semantic.ts` is clearly marked as deprecated and detached

---

## 7. Compliance Checklist

- [x] `semantic-map-v2.json` is the only active semantic dictionary
- [x] `getAxesForKeywordV2` is the only active keyword → axes mapping function
- [x] `fallbackAxesV2` is deterministic (same keyword → same values)
- [x] All axis values are clamped to [-100, +100]
- [x] Old 6-axis map (`semantic-map.json`) is fully detached from ENGINE_V2
- [x] `lib/semantic.ts` is fully detached from ENGINE_V2 runtime
- [x] No conversion logic from 6-axis to 4-axis in ENGINE_V2
- [x] TypeScript compilation passes
- [x] Linting passes
- [x] Build passes
- [x] All keyword → axes paths go through new semantic mapping

---

## 8. Summary

The ENGINE_V2 semantic mapping implementation is **fully compliant** with the documentation:

1. ✅ **New System**: Correctly implemented in `lib/engine_v2/axes.ts` with all required functions
2. ✅ **ENGINE_V2 Integration**: Uses new semantic mapping exclusively
3. ✅ **Legacy Detachment**: Old 6-axis system (`lib/semantic.ts` + `semantic-map.json`) is fully detached from runtime
4. ✅ **Verification**: All checks pass (TypeScript, lint, build)

**The implementation is production-ready and fully aligned with ENGINE_V2 specifications.**

---

## 9. Recommendations

### 9.1 Optional Cleanup

1. **Remove Legacy Wrapper**: The deprecated `getAxesV2ForKeyword()` function in `lib/engine_v2/axes.ts` can be removed once all call sites are confirmed to use `getAxesForKeywordV2()` directly. Currently, `lib/engine_v2/engine.ts` already uses the new API, so the wrapper may be removable.

2. **Archive Legacy Files**: The user may manually move `lib/semantic.ts` and `semantic/semantic-map.json` to an `archive/` folder in the future, but this is not required for runtime correctness.

### 9.2 No Action Required

- ✅ No code changes needed
- ✅ No runtime issues
- ✅ Implementation matches documentation exactly

---

**End of Audit Report**
