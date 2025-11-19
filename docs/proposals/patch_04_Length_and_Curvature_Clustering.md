# patch_04_Length_and_Curvature_Clustering
### Clustering di Lunghezze e Curvature per Punto (ENGINE_V2)
**Date:** 2025-01-XX  
**Type:** Feature Enhancement (Non-breaking, Visual Improvement)
**Status:** ✅ Implemented (ENGINE_V2 runtime + debug overlay)

> SPEC_04 reference: Step 5–6 (Length & curvature profiles) in `docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md`.

---

# 1. Purpose of This Patch

This patch addresses a limitation in the current ENGINE_V2 behavior:

**Current behavior (before patch04):**
- Lines generated from the same **Alfa/Beta point** (i.e., same keyword) already have:
  - Different **origins** (patch02 – point dispersion)
  - Different **directions** (patch03 – direction clustering)
- However, they still tend to have:
  - Very similar **lengths** (all lines share the same base length from Gamma, with only small ±5% variation)
  - Similar **curvature** (all lines share the same base curvature from Delta, with only small ±20% jitter)

**Problem:**
- Lines from the same point lack **structural diversity** in length and curvature
- Visual appearance is too uniform despite direction clustering
- No clear distinction between "short/curved" vs "long/straight" lines within the same point

**New behavior (after patch04):**
- For **each point generated from Alfa/Beta**:
  - Create **clusters of lines** that differ **not only in direction**, but also:
    - in **length** (clearly short / medium / long lines)
    - in **curvature** (clearly straight-ish / medium / highly curved)
- While maintaining:
  - The current **keyword → AxesV2** mapping logic
  - The current **Alfa/Beta → point** mapping logic
  - Full **determinism** (same seed → same geometry)
  - All existing **slider semantics** (see section 6)

**Goal:**
Each point should generate a **visually diverse set of lines** with recognizable length and curvature profiles, creating more expressive and artistically interesting symbols.

---

# 2. Summary of Changes

### OLD (current implementation)

```typescript
// In generateCurveFromPoint:
for (let i = 0; i < numLines; i++) {
  // All lines share the same base length (from Gamma)
  const length = getLineLength(
    axes.gamma,
    canvasWidth,
    canvasHeight,
    seed,
    pointIndex,  // Same pointIndex for all lines
    lengthScale
  );
  // Only small ±5% variation via PRNG
  
  // All lines share the same base curvature (from Delta)
  const control = applyDeltaIrregularity(
    axes.delta,
    start,
    end,
    baseControl,
    length,
    seed,
    pointIndex,  // Same pointIndex for all lines
    curvatureScale
  );
  // Only small ±20% jitter variation
}
```

**Result:** All lines from the same point have essentially the same length and curvature profile.

### NEW (this patch)

```typescript
// In generateCurveFromPoint:
for (let i = 0; i < numLines; i++) {
  const { direction, debug: directionDebug } = getLineDirectionWithDebug(...);
  const clusterIndex = directionDebug.clusterIndex;
  
  // Each line gets a length profile multiplier
  const lengthProfile = computeLengthProfileMultiplier(
    seed,
    pointIndex,
    i,              // lineIndex
    clusterIndex,
    clusterCount
  );
  const baseLength = getLineLength(...);
  const profiledLength = baseLength * lengthProfile; // e.g., 0.7x, 1.0x, 1.3x
  
  // Each line gets a curvature profile multiplier
  const curvatureProfile = computeCurvatureProfileMultiplier(
    seed,
    pointIndex,
    i,              // lineIndex
    clusterIndex,
    clusterCount
  );
  const baseCurvature = applyDeltaIrregularity(...);
  const profiledCurvature = baseCurvature * curvatureProfile; // e.g., 0.7x, 1.0x, 1.4x
}
```

**Result:** Lines from the same point have clearly distinct length and curvature profiles, creating visual clusters of variety.

---

# 3. Technical Implementation

## 3.1 New Helper Functions

### 3.1.1 `computeLengthProfileMultiplier`

**Location:** `lib/engine_v2/curves.ts`

**Signature:**
```typescript
function computeLengthProfileMultiplier(
  seed: string,
  pointIndex: number,
  lineIndex: number,
  clusterIndex: number,
  clusterCount: number
): number
```

**Algorithm:**
1. Define canonical length profiles (implementation default: more-varied 5-step set `[0.5, 0.8, 1.0, 1.3, 1.8]` → very short / short / medium / long / very long)
2. Use deterministic PRNG to select a profile for this line:
   ```typescript
   const rng = seededRandom(
     `${seed}:lenProfile:${pointIndex}:${lineIndex}:${clusterIndex}:${clusterCount}`
   );
   const profileIndex = Math.floor(rng * lengthProfiles.length);
   return lengthProfiles[Math.min(lengthProfiles.length - 1, Math.max(0, profileIndex))];
   ```

**Profile Options:**
- **Conservative**: `[0.7, 1.0, 1.3]` (short, medium, long)
- **More varied**: `[0.5, 0.8, 1.0, 1.3, 1.8]` (very short, short, medium, long, very long)
- **Default (implemented)**: `[0.5, 0.8, 1.0, 1.3, 1.8]` (5 profiles, more dramatic variety)

**Determinism:**
- Same `seed` + same `pointIndex` + same `lineIndex` + same `clusterIndex` → same profile

### 3.1.2 `computeCurvatureProfileMultiplier`

**Location:** `lib/engine_v2/curves.ts`

**Signature:**
```typescript
function computeCurvatureProfileMultiplier(
  seed: string,
  pointIndex: number,
  lineIndex: number,
  clusterIndex: number,
  clusterCount: number
): number
```

**Algorithm:**
1. Define canonical curvature profiles (implementation default: more-varied 5-step set `[0.4, 0.75, 1.0, 1.5, 2.0]` → very low / low / medium / high / very high)
2. Use deterministic PRNG to select a base profile:
   ```typescript
   const rng = seededRandom(
     `${seed}:curvProfile:${pointIndex}:${lineIndex}:${clusterIndex}:${clusterCount}`
   );
   const profileIndex = Math.floor(rng * curvatureProfiles.length);
   const baseProfile = curvatureProfiles[Math.min(curvatureProfiles.length - 1, Math.max(0, profileIndex))];
   ```

**Profile Options:**
- **Conservative**: `[0.7, 1.0, 1.4]` (low, medium, high curvature)
- **More varied**: `[0.4, 0.75, 1.0, 1.5, 2.0]` (very low, low, medium, high, very high)
- **Default (implemented)**: `[0.4, 0.75, 1.0, 1.5, 2.0]` (5 profiles, more dramatic variety)

**Optional Correlation with Length:**
- We can optionally correlate curvature inversely with length:
  - Short lines → higher curvature multiplier
  - Long lines → lower curvature multiplier
- This creates more natural-looking patterns (short curved lines, long straight lines)

**Determinism:**
- Same `seed` + same `pointIndex` + same `lineIndex` + same `clusterIndex` → same profile

### 3.1.3 `getLineLengthProfiled`

**Location:** `lib/engine_v2/curves.ts`

**Signature:**
```typescript
function getLineLengthProfiled(
  gamma: number,
  canvasWidth: number,
  canvasHeight: number,
  seed: string,
  pointIndex: number,
  lineIndex: number,
  clusterIndex: number,
  clusterCount: number,
  lengthScale: number
): number
```

**Implementation:**
```typescript
// Get base length from Gamma (existing logic)
const baseLength = getLineLength(
  gamma,
  canvasWidth,
  canvasHeight,
  seed,
  pointIndex,
  lengthScale
);

// Apply length profile multiplier
const lengthProfile = computeLengthProfileMultiplier(
  seed,
  pointIndex,
  lineIndex,
  clusterIndex,
  clusterCount
);

return baseLength * lengthProfile;
```

### 3.1.4 `applyDeltaIrregularityProfiled`

**Location:** `lib/engine_v2/curves.ts`

**Modification to existing function:**
- Add optional `curvatureProfileMultiplier` parameter
- Apply multiplier to the curvature magnitude before final offset calculation

**Alternative approach:**
- Keep `applyDeltaIrregularity` unchanged
- Apply curvature profile multiplier to `curvatureScale` parameter:
  ```typescript
  const curvatureProfile = computeCurvatureProfileMultiplier(...);
  const profiledCurvatureScale = curvatureScale * curvatureProfile;
  const control = applyDeltaIrregularity(..., profiledCurvatureScale);
  ```

**Recommended:** Apply to `curvatureScale` (cleaner, maintains existing function signature).

## 3.2 Modification to `generateCurveFromPoint`

**Location:** `lib/engine_v2/curves.ts`

**Current structure:**
```typescript
export function generateCurveFromPoint(
  axes: AxesV2,
  start: Point,
  canvasWidth: number,
  canvasHeight: number,
  seed: string,
  pointIndex: number,
  lengthScale: number = 1.0,
  curvatureScale: number = 1.0,
  clusterCount: number = 3,
  clusterSpread: number = 30
): { curves: Connection[]; directionClusters: DirectionClusterDebug[] } {
  const numLines = getNumberOfLines(axes.gamma);
  const curves: Connection[] = [];
  const directionClusters: DirectionClusterDebug[] = [];
  
  for (let i = 0; i < numLines; i++) {
    // Get direction with clustering (patch03)
    const { direction, debug: directionDebug } = getLineDirectionWithDebug(...);
    directionClusters.push(directionDebug);
    
    // Get length (current: same for all lines)
    const length = getLineLength(
      axes.gamma,
      canvasWidth,
      canvasHeight,
      seed,
      pointIndex,  // Same for all lines
      lengthScale
    );
    
    // Calculate end point
    const end = {
      x: dispersedStart.x + Math.cos(direction * Math.PI / 180) * length,
      y: dispersedStart.y + Math.sin(direction * Math.PI / 180) * length,
    };
    
    // Apply curvature (current: same for all lines)
    const control = applyDeltaIrregularity(
      axes.delta,
      dispersedStart,
      end,
      baseControl,
      length,
      seed,
      pointIndex,  // Same for all lines
      curvatureScale
    );
    
    curves.push({ from: dispersedStart, to: end, control });
  }
  
  return { curves, directionClusters };
}
```

**Proposed changes:**
```typescript
export function generateCurveFromPoint(
  // ... same parameters ...
): { curves: Connection[]; directionClusters: DirectionClusterDebug[] } {
  const numLines = getNumberOfLines(axes.gamma);
  const curves: Connection[] = [];
  const directionClusters: DirectionClusterDebug[] = [];
  
  for (let i = 0; i < numLines; i++) {
    // Get direction with clustering (patch03) - UNCHANGED
    const { direction, debug: directionDebug } = getLineDirectionWithDebug(
      axes.gamma,
      seed,
      i,
      clusterCount,
      clusterSpread
    );
    directionClusters.push(directionDebug);
    const clusterIndex = directionDebug.clusterIndex;
    
    // PATCH04: Get length with profile multiplier
    const baseLength = getLineLength(
      axes.gamma,
      canvasWidth,
      canvasHeight,
      seed,
      pointIndex,
      lengthScale
    );
    const lengthProfile = computeLengthProfileMultiplier(
      seed,
      pointIndex,
      i,              // lineIndex
      clusterIndex,
      clusterCount
    );
    const profiledLength = baseLength * lengthProfile;
    
    // Calculate end point using profiled length
    const end = {
      x: dispersedStart.x + Math.cos(direction * Math.PI / 180) * profiledLength,
      y: dispersedStart.y + Math.sin(direction * Math.PI / 180) * profiledLength,
    };
    
    // PATCH04: Apply curvature with profile multiplier
    const curvatureProfile = computeCurvatureProfileMultiplier(
      seed,
      pointIndex,
      i,              // lineIndex
      clusterIndex,
      clusterCount
    );
    const profiledCurvatureScale = curvatureScale * curvatureProfile;
    
    // Apply curvature (existing function, with profiled scale)
    const control = applyDeltaIrregularity(
      axes.delta,
      dispersedStart,
      end,
      baseControl,
      profiledLength,  // Use profiled length for curvature calculation
      seed,
      pointIndex,
      profiledCurvatureScale
    );
    
    curves.push({ from: dispersedStart, to: end, control });
  }
  
  return { curves, directionClusters };
}
```

---

# 4. Behavior Details

## 4.1 Length Profiles

**Profile Selection:**
- Each line gets assigned a length profile multiplier deterministically
- Profiles are selected from a predefined set (e.g., `[0.7, 1.0, 1.3]`)
- Selection is based on `seed`, `pointIndex`, `lineIndex`, and `clusterIndex`

**Example with 3 profiles:**
- Line 0: `lengthProfile = 0.7` → 70% of base length (short)
- Line 1: `lengthProfile = 1.0` → 100% of base length (medium)
- Line 2: `lengthProfile = 1.3` → 130% of base length (long)
- Line 3: `lengthProfile = 0.7` → 70% of base length (short, again)
- Line 4: `lengthProfile = 1.0` → 100% of base length (medium, again)

**Visual Impact:**
- Lines from the same point will have clearly different lengths
- Creates visual hierarchy: some lines are "primary" (long), others are "secondary" (short)
- More expressive and varied appearance

## 4.2 Curvature Profiles

**Profile Selection:**
- Each line gets assigned a curvature profile multiplier deterministically
- Profiles are selected from a predefined set (e.g., `[0.7, 1.0, 1.4]`)
- Selection is based on `seed`, `pointIndex`, `lineIndex`, and `clusterIndex`

**Example with 3 profiles:**
- Line 0: `curvatureProfile = 1.4` → 140% of base curvature (highly curved)
- Line 1: `curvatureProfile = 1.0` → 100% of base curvature (medium)
- Line 2: `curvatureProfile = 0.7` → 70% of base curvature (low curvature, almost straight)
- Line 3: `curvatureProfile = 1.4` → 140% of base curvature (highly curved, again)

**Visual Impact:**
- Lines from the same point will have clearly different curvatures
- Some lines are almost straight, others are highly curved
- Creates visual variety and interest

## 4.3 Profile Correlation (Optional)

**Inverse Correlation:**
- We can optionally correlate curvature inversely with length:
  - Short lines → higher curvature multiplier
  - Long lines → lower curvature multiplier
- This creates more natural-looking patterns:
  - Short, curved lines (decorative, secondary)
  - Long, straight lines (primary, structural)

**Implementation (enabled in current code, DRAMATIC correlation):**
```typescript
function computeCurvatureProfileMultiplier(
  seed: string,
  pointIndex: number,
  lineIndex: number,
  clusterIndex: number,
  clusterCount: number,
  lengthProfile?: number  // Optional: use length profile to influence curvature
): number {
  const baseProfile = /* select from [0.4, 0.75, 1.0, 1.5, 2.0] */;
  
  // Inverse correlation with length (enabled)
  if (lengthProfile !== undefined) {
    // If line is short (low lengthProfile), increase curvature
    // If line is long (high lengthProfile), decrease curvature
    const correlationFactor = 1.0 + (1.0 - lengthProfile) * 0.5; // implementation: 0.5
    return baseProfile * correlationFactor;
  }
  
  return baseProfile;
}
```

**Implementation note:** In the current ENGINE_V2 implementation, the inverse correlation is **enabled** with `correlationFactor = 1.0 + (1.0 - lengthProfile) * 0.5` for a more dramatic effect.

## 4.4 Determinism

**Preserved:** ✅

- Same `seed` + same `pointIndex` + same `lineIndex` + same `clusterIndex` → same length profile
- Same `seed` + same `pointIndex` + same `lineIndex` + same `clusterIndex` → same curvature profile
- **Result:** Same input → same output (fully deterministic)

**Seed format:**
- Length profile: `${seed}:lenProfile:${pointIndex}:${lineIndex}:${clusterIndex}:${clusterCount}`
- Curvature profile: `${seed}:curvProfile:${pointIndex}:${lineIndex}:${clusterIndex}:${clusterCount}`

---

# 5. Interaction with Sliders (ENGINE_V2_SLIDER_MAPPING)

**⚠️ CRITICAL:** Patch04 **must not change** the semantics of existing sliders. The new profile logic sits **on top of** the current slider mappings.

## 5.1 Slider1 – "Lunghezza linee" (`lengthScale`)

**Current behavior (before patch04):**
- **Role:** Global length scaler for all lines
- **Mapping:** `lengthScale = 0.7 + (slider / 100) * (1.3 - 0.7)` → [0.7, 1.3]
- **Effect:** Multiplies the base line length determined by Gamma (15–50% diagonal)

**After patch04:**
- **Role:** **UNCHANGED** – Still global length scaler
- **Mapping:** **UNCHANGED** – Same formula
- **Effect:** 
  ```typescript
  const baseLength = getLineLength(...);              // Gamma-based
  const profileLength = baseLength * lengthProfile;   // patch04 profile
  const finalLength = profileLength * lengthScale;     // Slider1 (unchanged)
  ```
- **Result:** Slider1 still **scales all lengths uniformly**, without changing the relative differences introduced by profiles

**Example:**
- Without Slider1: Line A = 100px (profile 1.0), Line B = 70px (profile 0.7)
- With Slider1 = 50% (lengthScale = 1.0): Line A = 100px, Line B = 70px (unchanged ratios)
- With Slider1 = 100% (lengthScale = 1.3): Line A = 130px, Line B = 91px (both scaled, ratios preserved)

## 5.2 Slider2 – "Curvatura linee" (`curvatureScale`)

**Current behavior (before patch04):**
- **Role:** Global curvature scaler
- **Mapping:** `curvatureScale = 0.3 + (slider / 100) * (1.7 - 0.3)` → [0.3, 1.7]
- **Effect:** Scales the curvature magnitude determined by Delta

**After patch04:**
- **Role:** **UNCHANGED** – Still global curvature scaler
- **Mapping:** **UNCHANGED** – Same formula
- **Effect:**
  ```typescript
  const baseCurvFrac = /* Delta-based */;
  const profileCurvFrac = baseCurvFrac * curvatureProfile;  // patch04 profile
  const finalCurvFrac = profileCurvFrac * curvatureScale;  // Slider2 (unchanged)
  ```
- **Result:** Slider2 still controls the **global intensity of curvature**, while relative differences between lines (due to profiles) remain intact

**Example:**
- Without Slider2: Line A = high curvature (profile 1.4), Line B = low curvature (profile 0.7)
- With Slider2 = 50% (curvatureScale = 1.0): Line A = high, Line B = low (unchanged ratios)
- With Slider2 = 100% (curvatureScale = 1.7): Line A = very high, Line B = medium (both scaled, ratios preserved)

## 5.3 Slider3 – "Numero Cluster" (`clusterCount`)

**Current behavior (before patch04):**
- **Role:** Controls the number of **direction clusters**
- **Mapping:** `clusterCount = Math.round(2 + (slider / 100) * 3)` → [2, 5]
- **Effect:** Determines how many clusters of directions exist (0–180°), patch03

**After patch04:**
- **Role:** **UNCHANGED** – Still controls number of direction clusters
- **Mapping:** **UNCHANGED** – Same formula
- **Effect:** 
  - `clusterCount` remains **purely directional**
  - We **reuse** `clusterIndex` (derived from direction clustering) as a **parameter** to the length/curvature profiles
  - But we **do not change** the meaning of the slider:
    - It still answers: "How many directional groups do we have?"
  - Profiles are designed to work for any `clusterCount` in the [2–5] range

**Example:**
- Slider3 = 0% (clusterCount = 2): 2 direction clusters, profiles still distribute across 2 clusters
- Slider3 = 100% (clusterCount = 5): 5 direction clusters, profiles still distribute across 5 clusters

## 5.4 Slider4 – "Ampiezza Cluster" (`clusterSpread`)

**Current behavior (before patch04):**
- **Role:** Controls the directional **spread inside each cluster**
- **Mapping:** `clusterSpread = 10 + (slider / 100) * 50` → [10°, 60°]
- **Effect:** Controls in-cluster jitter in `getLineDirection`

**After patch04:**
- **Role:** **UNCHANGED** – Still controls directional spread
- **Mapping:** **UNCHANGED** – Same formula
- **Effect:**
  - `clusterSpread` remains **strictly directional**
  - Length/curvature profiles do **not** change `clusterSpread`
  - Profiles only use the angle context and `clusterIndex` as parameters
  - The combination is:
    - Slider3 & Slider4 → directional structure of clusters
    - Patch04 profiles → structural diversity of length & curvature **within** those direction clusters

**Example:**
- Slider4 = 0% (clusterSpread = 10°): Tight direction clusters, profiles still create length/curvature variety
- Slider4 = 100% (clusterSpread = 60°): Wide direction clusters, profiles still create length/curvature variety

## 5.5 Summary: Slider Interaction

**Key Principle:**
- Patch04 introduces **per-line profiles** for length and curvature
- **Does NOT alter** the mapping or semantics of existing sliders
- Sliders continue to operate as **global, semantic-level controls**
- Profiles provide **fine-grained, per-line variation** on top of slider controls

**Visual Result:**
- Slider1 controls overall length scale, but lines still have distinct length profiles
- Slider2 controls overall curvature intensity, but lines still have distinct curvature profiles
- Slider3 & Slider4 control directional structure, profiles add length/curvature variety within that structure

---

# 6. Determinism & Mapping Invariance

## 6.1 Mapping Invariance

**Preserved:** ✅

- **Keyword → Axes mapping:** Remains exactly as today
  - `lib/engine_v2/axes.ts` + `semantic/semantic-map-v2.json`
  - No changes to `getAxesForKeywordV2` or `fallbackAxesV2`

- **Alfa/Beta → Point mapping:** Remains unchanged
  - `lib/engine_v2/position.ts` - `axesToNormalizedPosition`, `normalizedToPixel`
  - No changes to point generation logic

- **Gamma/Delta → Semantic baseline:** Remains as defined
  - Gamma still determines base length (15–50% diagonal)
  - Delta still determines base curvature (5–30% of length)
  - Profiles **modulate around** these baselines, they don't replace them

## 6.2 New Randomness

**All new variations (profiles) use deterministic PRNG:**

- **Length profiles:**
  - Seed: `${seed}:lenProfile:${pointIndex}:${lineIndex}:${clusterIndex}`
  - Uses `seededRandom` from `lib/seed.ts`

- **Curvature profiles:**
  - Seed: `${seed}:curvProfile:${pointIndex}:${lineIndex}:${clusterIndex}`
  - Uses `seededRandom` from `lib/seed.ts`

## 6.3 Guarantee

**Same input → same output:**

- Same keywords + same seed + same canvas size + same slider values → same:
  - Cluster assignments (patch03)
  - Length profiles (patch04)
  - Curvature profiles (patch04)
  - Final geometry

**Determinism test:**
1. Generate symbol with specific inputs
2. Regenerate with same inputs
3. Verify: All line lengths and curvatures are identical

---

# 7. Impact Analysis

## 7.1 Visual Impact

**Before patch04:**
- Lines from same point have similar lengths (only ±5% variation)
- Lines from same point have similar curvatures (only ±20% jitter)
- Limited visual variety despite direction clustering

**After patch04 (implemented with 5-step profiles + stronger inverse correlation):**
- Lines from same point have **clearly distinct lengths** (e.g., 0.5x, 0.8x, 1.0x, 1.3x, 1.8x)
- Lines from same point have **clearly distinct curvatures** (e.g., 0.4x, 0.75x, 1.0x, 1.5x, 2.0x, further modulated by inverse correlation with length)
- Symbols appear **more varied and expressive**
- Direction clusters have **internal structural diversity**

## 7.2 Backward Compatibility

**Preserved:** ✅

- **Determinism:** Fully preserved (same seed → same output)
- **Global slider behavior:** Fully preserved (sliders work as before)
- **No public API changes:** Changes are internal to `curves.ts` and debug structures
- **No breaking changes:** Existing code continues to work

## 7.3 Performance Impact

**Minimal:**
- Additional overhead per line:
  - 2 PRNG calls (length profile, curvature profile)
  - 2 multiplications (apply profile multipliers)
- Negligible compared to overall engine cost
- No async operations, no network calls

## 7.4 Debug Impact (Optional)

**Extension to debug structures:**

- `DirectionClusterDebug` (already exists) could be extended with:
  - `lengthProfile?: number`
  - `curvatureProfile?: number`

- Debug overlay could visualize:
  - Line thickness proportional to length profile
  - Line alpha/color proportional to curvature profile
  - Legends describing profile distribution

**Recommendation:** Add debug fields as optional enhancement, not required for core functionality.

---

# 8. Testing Strategy

## 8.1 Determinism Test

**Steps:**
1. Generate symbol with specific `seed`, keywords, canvas size, slider values
2. Note the geometry (line lengths, curvatures)
3. Regenerate with same inputs
4. Verify: Geometry is identical

**Expected:** Same seed → same profiles → same lengths/curvatures → same geometry

## 8.2 Visual Test Matrix

**Test combinations of Gamma/Delta:**

- **Gamma low / Delta low:**
  - Verify: Lines have distinct length profiles despite low Gamma
  - Verify: Lines have distinct curvature profiles despite low Delta

- **Gamma high / Delta low:**
  - Verify: Lines have distinct length profiles (some short, some long)
  - Verify: Lines have distinct curvature profiles (some curved, some straight)

- **Gamma low / Delta high:**
  - Verify: Lines have distinct length profiles
  - Verify: Lines have distinct curvature profiles (some very curved, some less curved)

- **Gamma high / Delta high:**
  - Verify: Lines have distinct length profiles
  - Verify: Lines have distinct curvature profiles

**For each combination:**
- Generate multiple symbols with different seeds
- Verify visually: Multiple length profiles per point, multiple curvature profiles per point
- Verify: Direction clusters remain coherent (patch03)

## 8.3 Slider Interaction Tests

**Test Slider1 (lengthScale):**
1. Fix all other sliders
2. Vary Slider1 from 0% to 100%
3. Verify: All lengths globally scale up/down
4. Verify: Relative length profiles remain (e.g., short lines stay shorter than long lines)

**Test Slider2 (curvatureScale):**
1. Fix all other sliders
2. Vary Slider2 from 0% to 100%
3. Verify: All curvatures globally scale up/down
4. Verify: Relative curvature profiles remain (e.g., high-curvature lines stay more curved than low-curvature lines)

**Test Slider3 (clusterCount):**
1. Fix all other sliders
2. Vary Slider3 from 0% to 100%
3. Verify: Number of direction clusters changes
4. Verify: Length/curvature profiles still distribute sensibly across clusters

**Test Slider4 (clusterSpread):**
1. Fix all other sliders
2. Vary Slider4 from 0% to 100%
3. Verify: Direction jitter inside clusters changes
4. Verify: Length/curvature profiles remain visually consistent

## 8.4 Edge Cases

**Single line (Gamma ≈ 0, numLines = 1):**
- Profiles reduce to trivial case (single profile selected)
- No errors, geometry still valid

**Many lines (Gamma ≈ ±100, numLines = 7):**
- Profiles should produce visually distinct sets of lines
- Verify: At least 2–3 distinct length profiles visible
- Verify: At least 2–3 distinct curvature profiles visible

**Extreme canvas sizes:**
- Small canvas (e.g., 100x100): Profiles scale correctly with base lengths
- Large canvas (e.g., 2000x2000): Profiles scale correctly with base lengths

**Multiple keywords:**
- Each keyword should have its own set of profiles
- Profiles should be independent per point

---

# 9. Implementation Checklist

**Before implementation:**
- [x] Review and approve this design document
- [x] Decide on concrete numeric ranges for profiles:
  - [x] Length profiles: more varied `[0.5, 0.8, 1.0, 1.3, 1.8]`
  - [x] Curvature profiles: more varied `[0.4, 0.75, 1.0, 1.5, 2.0]`
  - [x] Add inverse correlation between length and curvature

**Implementation:**
- [x] Create `computeLengthProfileMultiplier` function in `lib/engine_v2/curves.ts`
- [x] Create `computeCurvatureProfileMultiplier` function in `lib/engine_v2/curves.ts`
- [x] Apply length profiles inline in `generateCurveFromPoint`
- [x] Apply curvature profiles inline in `generateCurveFromPoint` via `curvatureScale * curvatureProfile`
- [x] Ensure determinism: test with same seed multiple times (see section 8)

**Testing:**
- [ ] Determinism test: same seed → same output
- [ ] Visual test: verify distinct length/curvature profiles per point
- [ ] Slider interaction tests: verify sliders still work as expected
- [ ] Edge case tests: single line, many lines, extreme canvas sizes

**Documentation:**
- [x] Update `ENGINE_V2_GEOMETRY_PIPELINE.md` (section 4, Gamma/Delta behavior)
- [ ] Update `ENGINE_V2_SLIDER_MAPPING.md` (add note about patch04, if needed)
- [x] Update `PATCHES_INDEX.md` (add patch04 entry)
- [ ] Update `CHANGELOG_SFCM_SYMBOLS.md` (add patch04 entry)

**Optional enhancements:**
- [ ] Extend `DirectionClusterDebug` with profile information
- [ ] Add debug visualization for profiles in `DebugOverlay`
- [ ] Add inverse correlation between length and curvature

---

# 10. Files to Modify

**Code:**
- `lib/engine_v2/curves.ts`
  - Add `computeLengthProfileMultiplier` function
  - Add `computeCurvatureProfileMultiplier` function
  - Modify `generateCurveFromPoint` to use profiles
  - Optionally: Add `getLineLengthProfiled` wrapper

**Documentation:**
- `docs/proposals/patch_04_Length_and_Curvature_Clustering.md` (this file)
- `docs/proposals/PATCHES_INDEX.md` (add patch04 entry)
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` (update Gamma/Delta sections)
- `docs/changes/CHANGELOG_SFCM_SYMBOLS.md` (add patch04 entry)

**Optional (debug):**
- `lib/types.ts` (extend `DirectionClusterDebug` with profile fields)
- `components/DebugOverlay.tsx` (add profile visualization)

---

# 11. References

- **Current implementation:** `lib/engine_v2/curves.ts` - `getLineLength`, `applyDeltaIrregularity`, `generateCurveFromPoint`
- **PRNG system:** `lib/seed.ts` - `seededRandom`, `prng` functions
- **Direction clustering:** `docs/proposals/patch_03_Direction_Clustering.md`
- **Point dispersion:** `docs/proposals/patch_02_Point_Dispersion_at_Line_Origin.md`
- **Slider mapping:** `docs/reference/engine_v2/ENGINE_V2_SLIDER_MAPPING.md`
- **Geometry pipeline:** `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md`

---

# 12. Next Steps

1. **Review this design document** as the baseline spec for patch04
2. **Decide on concrete numeric ranges** for profiles (see section 3.1)
3. **Approve implementation approach** (profile selection, correlation, etc.)
4. **Once approved:** Implement helpers and integration (see section 9)
5. **Test thoroughly** (see section 8)
6. **Update documentation** (see section 9)

**Status:** This document reflects the implemented behavior of patch04 in ENGINE_V2 and debug overlay.
