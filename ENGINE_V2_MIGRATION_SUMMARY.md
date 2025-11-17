# ENGINE_V2 Migration Summary

## Overview
Successfully migrated the SFCM Symbol Generator from the old 6-axis engine to ENGINE_V2 (4-axis system) as specified in SPEC_03.

## Files Created

### New ENGINE_V2 Modules (`lib/engine_v2/`)
1. **`axes.ts`** - Keyword → 4 axes mapping (Alfa, Beta, Gamma, Delta)
   - Supports both old 6-axis dictionary format (with conversion) and new 4-axis format
   - Deterministic fallback for unknown keywords
   - Range: [-100, +100]

2. **`position.ts`** - Alfa/Beta → normalized coordinates → pixel coordinates
   - Implements formulas: `xNorm = 0.5 + (Alfa / 200)`, `yNorm = 0.5 - (Beta / 200)`
   - Quadrant detection for mirroring logic

3. **`mirroring.ts`** - Quadrant-based mirroring
   - Detects occupied quadrants
   - Applies reflection rules: 1→3, 2→2, 3→1, 4→0 mirrors
   - Uses horizontal, vertical, and both-axis reflections

4. **`curves.ts`** - Gamma and Delta curve generation
   - Gamma: number of lines (1-3), direction (-45° to +45°), length (2-10% of canvas)
   - Delta: curvature/jitter (0-3% of line length)
   - Generates quadratic curves with deterministic control points

5. **`engine.ts`** - Main orchestrator
   - Complete pipeline: keywords → axes → position → mirroring → curves
   - Converts ENGINE_V2 curves to BranchedConnection format for rendering
   - Canvas-aware (uses canvasWidth/canvasHeight)

## Files Modified

### `lib/types.ts`
- Added ENGINE_V2 types:
  - `AxesV2`: 4-axis system (alfa, beta, gamma, delta)
  - `KeywordVecV2`: Keyword with 4-axis values
  - `Quadrant`: Quadrant identifier (1-4)
  - `EngineV2Curve`: Curve definition with control points

### `app/page.tsx`
- **Removed**: Old engine imports (`generateClusters`, `buildConnections`, `detectIntersections`, `addBranching`, `getAxesForKeyword`)
- **Added**: `generateEngineV2` import
- **Replaced**: Entire generation pipeline with ENGINE_V2 call
- **Updated**: `generateSeed` function to use only keywords and canvas size (sliders removed from seed)
- **Preserved**: All UI elements (sliders remain as placeholders), animation logic, canvas size handling

## Files Unchanged (As Required)

### Preserved Components
- `components/SvgPreview.tsx` - No changes (works with BranchedConnection output)
- `components/DownloadSvgButton.tsx` - No changes
- `lib/prepareSvgForExport.ts` - No changes
- `lib/svgStyleConfig.ts` - No changes (stroke width, arrowheads, colors unchanged)
- `lib/seed.ts` - No changes
- `lib/canvasSizeConfig.ts` - No changes

### Old Engine Code (Not Removed)
- `lib/geometry.ts` - Still exists but is no longer used by `app/page.tsx`
  - Can be archived or removed in future cleanup
  - Contains old cluster/MST/ramification logic

## Key Implementation Details

### 4-Axis Mapping
- **Alfa** (Azione ↔ Osservazione): Controls X position
- **Beta** (Specifico ↔ Ampio): Controls Y position  
- **Gamma** (Unico ↔ Composto): Controls number (1-3), direction, length of lines
- **Delta** (Regolare ↔ Irregolare): Controls curvature and jitter

### Dictionary Compatibility
- ENGINE_V2 can read both old 6-axis format (converts automatically) and new 4-axis format
- Conversion formula maps old 6 axes to new 4 axes using weighted combinations
- Fallback generates 4 axes directly (range [-100, +100])

### Slider Status
- **UI**: All sliders (densità, ramificazione, complessità, mutamento) remain visible
- **Logic**: Completely removed from generation pipeline
- **Seed**: No longer includes slider values
- **Status**: Placeholders as specified in ENGINE_V2_SLIDER_MAPPING.md

### Curve Rendering
- ENGINE_V2 produces quadratic curves (always `curved: true`)
- Control points are calculated from Delta-based jitter
- Curvature value is computed to match `computeCurveControl` formula for compatibility
- All curves have `generationDepth: 0` (no hierarchy)

### Determinism
- Seed based on: `keywords + canvasWidth + canvasHeight`
- All RNG uses `seedrandom` with deterministic seeds
- Same input → same output guaranteed

## Validation

### Build Status
✅ TypeScript compilation: **PASSED**
✅ Next.js build: **PASSED** (no errors)
✅ Linting: **PASSED** (no errors)

### Compatibility
✅ `SvgPreview` - Works with BranchedConnection output
✅ `DownloadSvgButton` - No changes needed
✅ Animation system - Compatible (uses generationDepth)
✅ Canvas size options - Fully supported (1:1, 4:5, 9:16, 16:9, fit, custom)

## Known Limitations / TODOs

1. **Slider Logic**: Sliders are placeholders and do not influence generation (as per spec)
2. **Old Code**: `lib/geometry.ts` still exists but is unused (can be archived/removed)
3. **Dictionary Format**: Currently uses conversion from 6-axis format; can be updated to 4-axis format in `semantic-map.json` later
4. **Curvature Approximation**: The curvature value calculation is an approximation to match `computeCurveControl` formula; actual control points may differ slightly

## Next Steps (Optional)

1. Update `semantic-map.json` to use 4-axis format directly (optional)
2. Archive or remove `lib/geometry.ts` (old engine code)
3. Define new slider behaviors for ENGINE_V2 (future work, as per spec)

## Summary

The migration is **complete and functional**. ENGINE_V2 is fully integrated, all tests pass, and the app maintains backward compatibility with existing preview/export/animation systems. The old engine code is isolated and can be safely removed in a future cleanup pass.
