# patch_02_Point_Dispersion_at_Line_Origin
### Dispersione Deterministica dei Punti di Origine delle Linee
**Date:** 2025-01-XX  
**Type:** Feature Enhancement (Non-breaking, Visual Improvement)
**Status:** ✅ Implemented

---

# 1. Purpose of This Patch

This patch addresses the visual limitation where all lines generated from a keyword originate from the same base point, which doesn't produce the desired artistic effect.

**Current behavior:**  
- Each keyword generates a single base point from Alfa/Beta axes
- All lines from that keyword start from the exact same point
- Results in a "star" pattern with all lines radiating from one center

**New behavior:**  
- Each keyword still has a base point (from Alfa/Beta)
- Each line from that keyword starts from a slightly different point
- Points are deterministically dispersed around the base point
- Creates a more organic, varied visual effect

---

# 2. Summary of Changes

### OLD (current implementation)
```typescript
// In generateCurveFromPoint, all lines use the same start point
for (let i = 0; i < numLines; i++) {
  const direction = getLineDirection(axes.gamma, start.x, start.y, ...);
  // All lines start from the same 'start' point
}
```

### NEW (this patch)
```typescript
// Each line gets a deterministically dispersed start point
for (let i = 0; i < numLines; i++) {
  const dispersedStart = generateDispersedStartPoint(
    basePoint,
    seed,
    i,
    pointIndex,
    canvasWidth,
    canvasHeight
  );
  const direction = getLineDirection(axes.gamma, dispersedStart.x, dispersedStart.y, ...);
  // Each line starts from a slightly different point
}
```

---

# 3. Technical Implementation

## 3.1 New Function: `generateDispersedStartPoint`

**Location:** `lib/engine_v2/curves.ts`

**Signature:**
```typescript
function generateDispersedStartPoint(
  basePoint: Point,
  seed: string,
  lineIndex: number,
  pointIndex: number,
  canvasWidth: number,
  canvasHeight: number,
  dispersionRadius: number = 0.02 // 2% of diagonal by default
): Point
```

**Algorithm:**
1. Calculate canvas diagonal: `diagonal = Math.sqrt(canvasWidth² + canvasHeight²)`
2. Calculate dispersion radius in pixels: `radius = diagonal * dispersionRadius`
3. Generate deterministic PRNG: `rng = prng(\`${seed}:disperse:${pointIndex}:${lineIndex}\`)`
4. Generate random angle: `angle = rng() * 2 * Math.PI`
5. Generate random distance (uniform in circle): `distance = Math.sqrt(rng()) * radius`
   - Using `Math.sqrt(rng())` ensures uniform distribution in circle area
6. Calculate dispersed point:
   - `x = basePoint.x + Math.cos(angle) * distance`
   - `y = basePoint.y + Math.sin(angle) * distance`
7. Clamp to canvas bounds if necessary

**Determinism:**
- Same seed + same pointIndex + same lineIndex → same dispersed point
- Uses existing `prng` function from `lib/seed.ts`

## 3.2 Modification to `generateCurveFromPoint`

**Location:** `lib/engine_v2/curves.ts` (around line 245)

**Change:**
- Replace direct use of `start` parameter in the loop
- Generate a dispersed start point for each line iteration
- Use the dispersed point for direction and length calculations

**Code modification:**
```typescript
// BEFORE
for (let i = 0; i < numLines; i++) {
  const direction = getLineDirection(axes.gamma, start.x, start.y, `${seed}:line:${i}`);
  // ... rest of curve generation
}

// AFTER
for (let i = 0; i < numLines; i++) {
  const dispersedStart = generateDispersedStartPoint(
    start, // base point
    seed,
    i, // line index
    pointIndex,
    canvasWidth,
    canvasHeight,
    0.02 // 2% of diagonal
  );
  const direction = getLineDirection(axes.gamma, dispersedStart.x, dispersedStart.y, `${seed}:line:${i}`);
  // ... rest of curve generation using dispersedStart
}
```

---

# 4. Configuration Parameters

## 4.1 Dispersion Radius

**Default:** 2% of canvas diagonal  
**Range:** 1-4% of canvas diagonal (configurable)  
**Effect:**
- 1%: Near-overlapping origins, almost identical start positions
- 2%: Subtle dispersion (default) for readable yet cohesive clusters
- 3%: Noticeable micro-variation without breaking the anchor
- 4%: Maximum recommended spread before clusters feel detached

**Future consideration:** Could be exposed as a slider parameter (Slider3 or Slider4)

---

# 5. Compatibility & Impact

## 5.1 Non-Breaking Changes

- ✅ No changes to function signatures of public APIs
- ✅ No changes to `generateEngineV2` interface
- ✅ No changes to `EngineV2Options` type
- ✅ Determinism preserved (same seed → same output)
- ✅ All existing tests should pass (if any)

## 5.2 Visual Impact

- **Before:** All lines from a keyword start from one point (star pattern)
- **After:** Lines from a keyword start from slightly different points (organic cluster)
- **Artistic effect:** More varied, less mechanical appearance

## 5.3 Performance Impact

- Minimal: One additional function call per line
- PRNG generation is fast (hash-based)
- No additional async operations

---

# 6. Implementation Checklist

- [x] Create `generateDispersedStartPoint` function in `lib/engine_v2/curves.ts`
- [x] Modify loop in `generateCurveFromPoint` to use dispersed points
- [x] Test determinism: same seed produces same dispersed points
- [x] Test visual output: verify dispersion creates desired artistic effect
- [x] Verify build passes without errors
- [x] Test with various canvas sizes
- [x] Test with multiple keywords
- [x] Update documentation

---

# 7. Files to Modify

1. **`lib/engine_v2/curves.ts`**
   - Add `generateDispersedStartPoint` function
   - Modify `generateCurveFromPoint` loop (around line 245)

**No other files need modification** - this is a self-contained change within the curve generation module.

---

# 8. Testing Strategy

## 8.1 Determinism Test
- Generate symbol with specific seed
- Regenerate with same seed
- Verify all dispersed points are identical

## 8.2 Visual Test
- Compare before/after visual output
- Verify dispersion is visible but not excessive
- Check that lines don't appear too scattered

## 8.3 Edge Cases
- Single keyword (1-7 lines)
- Multiple keywords
- Small canvas (dispersion should scale appropriately)
- Large canvas (dispersion should scale appropriately)

---

# 9. Future Enhancements

Potential future improvements:
- Make dispersion radius configurable via slider
- Use different dispersion patterns (e.g., Gaussian instead of uniform)
- Vary dispersion based on Gamma or Delta axes
- Add dispersion intensity parameter

---

# 10. Refinement (2025-01-XX)

### Modified Behavior

**Change:**

- **First line (index 0)**: Now uses the exact base point from Alfa/Beta axes (no dispersion applied)

- **Subsequent lines (index > 0)**: Continue to use dispersed points around the base point (original patch_02 behavior)

**Rationale:**

- Maintains visual correspondence between anchor point and geometry

- First line "anchors" the cluster to the semantic position (Alfa/Beta)

- Subsequent lines create organic variation around this anchor

- Debug overlay anchor point now corresponds to first line's origin point

**Implementation:**

```typescript
// In generateCurveFromPoint loop:
const dispersedStart = i === 0
  ? start // First line: exact anchor point (no dispersion)
  : generateDispersedStartPoint(...); // Other lines: dispersed around base point
```

**Visual Impact:**

- **Before refinement**: All lines started from dispersed points, anchor was disconnected from geometry

- **After refinement**: First line starts from exact anchor point, remaining lines create organic cluster

- Debug overlay anchor point now visually corresponds to first line's origin

- Semantic clarity improved: first line = semantic position (Alfa/Beta), others = variation

**Compatibility:**

- ✅ Non-breaking change (no API modifications)

---

# 11. Refinement — Dispersion Radius Tuning (2025-01-XX → 2025-01-XX)

### Modified Behavior

- Default dispersion radius further reduced from **5%** to **2%** of the canvas diagonal (original release used 8%).
- Recommended adjustable range tightened to **1–4%** to keep the dispersed cluster extremely close to the Alfa/Beta anchor.

### Rationale

- Even with the earlier 5% setting, individual origins still felt too far apart, creating detached-looking clusters.
- 2% keeps every origin visibly tied to the semantic anchor while still allowing micro-variations that separate overlapping lines.
- Updated range guidance captures the practical window where dispersion is still noticeable without visually breaking the main point.

### Implementation

- `generateDispersedStartPoint` default parameter updated to `0.02`.
- `generateCurveFromPoint` now passes `0.02` for dispersed lines (`lineIndex > 0`).

### Documentation

- Specs (pipeline + overview) and this patch doc now describe the 2% default with the 1–4% recommended range.
- Changelog updated with a new entry describing the additional refinement.

### Compatibility

- ✅ Determinism preserved (same seed + indexes → same dispersed point).
- ✅ Fully compatible with previous refinements (first line uses anchor point).
- ✅ No API surface changes; behavior is purely visual.

---

# 12. References

- **Current implementation:** `lib/engine_v2/curves.ts` - `generateCurveFromPoint`
- **PRNG system:** `lib/seed.ts` - `prng` function
- **Position mapping:** `lib/engine_v2/position.ts` - `axesToPixelPosition`
- **Related docs:** `docs/specs/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md`
