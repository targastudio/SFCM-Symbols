# patch_05_Animation_fix
### Canvas animation reset & stroke dash rebuild
**Date:** 2025-XX-XX
**Type:** Bugfix (Non-breaking, UI Rendering)
**Status:** ✅ Implemented

> Scope: SvgPreview rendering pipeline + animation helpers described in `components/SvgPreview.tsx`.

---

# 1. Problem Statement

The current animation system (client-side only) is showing several user-facing bugs:

1. **Lines appear dashed before the animation starts.** The preview renders the real `dashed` pattern immediately when the component mounts, so users see dotted fragments even while the animation is supposed to draw from 0%. This is visible whenever branching is enabled (many generated lines are dashed by design).
2. **Animation progresses almost instantly or stalls.** The logic in `components/SvgPreview.tsx` uses a fixed `ANIMATION_LENGTH = 1200` for every connection (lines and curves), then toggles `strokeDashoffset` between `0` and `ANIMATION_LENGTH`. Because most paths are shorter than 1200px, SVG renders the stroke as a single dash that instantly covers the entire path as soon as `localProgress > 0`, so the animation jump-cuts to the final state.
3. **Staggering cannot work deterministically.** Even though we compute `start`/`end` windows per connection, they are applied to a stroke with the wrong dash length, so segments either never reveal (offset > line length) or appear fully drawn all at once.

These bugs make the animation feel broken and explain the "dashed flicker" reported by design.

---

# 2. Goals

- Rebuild the animation to use the actual geometric length of each connection, so that the stroke grows proportionally from its start point.
- Ensure dashed branches keep their dotted pattern **only after** the animation finishes (or immediately when animation is disabled).
- Keep staggered windows (`BAND = 0.4`) and the ease-in/out curve, but base them on reliable stroke lengths.
- Preserve determinism and all existing public APIs: no change to `generateEngineV2`, no change to data structures.

---

# 3. Technical Plan

## 3.1 Pre-compute geometry metadata per connection

Inside `SvgPreview`, prepare an ordered list with:

- `pathLength`:
  - Lines → Euclidean distance between `from` and `to`.
  - Curves → approximate quadratic Bézier length using 20 uniform samples between `t=0` and `t=1` after clamping the control point via `computeCurveControl` (already exported from `lib/svgUtils`).
- `pathData`: cached `d` string for curved connections so we do not recompute it during render.
- `staggerStart` and `staggerEnd`: same formula as today, derived from connection index and total count.

This metadata will live only in the React component (no engine changes required).

## 3.2 Stroke animation helper

Replace the existing `getStrokeProps` implementation with a new helper that receives:

```
getStrokeAnimationProps({
  dashed: boolean,
  animationEnabled: boolean,
  animationProgress?: number,
  localProgress: number,
  pathLength: number,
}): { strokeDasharray?: string; strokeDashoffset?: number }
```

Behavior:

- When animation is disabled (or progress undefined) → return `{ strokeDasharray: dashed ? "6 6" : "none", strokeDashoffset: 0 }`.
- When animation is enabled:
  - Clamp `localProgress` to [0, 1].
  - Use `pathLength` as the dash length. Animated strokes use pattern `${pathLength} ${pathLength}` for dashed lines, `${pathLength}` for solid ones.
  - Offset = `(1 - localProgress) * pathLength`. This guarantees full hiding at 0 and full draw at 1.
  - Once `localProgress >= 0.999`, switch back to the real `dashed ? "6 6" : "none"` pattern so branches keep their designed look post-animation.

## 3.3 Rendering updates

- Iterate over the prepared metadata array instead of recomputing inside JSX.
- Keep the existing easing (`easeInOutCubic`). The only difference is that the helper receives the eased value.
- Arrowheads should only appear when animation is disabled, the component has no animation data, or the eased progress for that connection is >= 0.99.

## 3.4 Documentation & changelog

- `docs/proposals/PATCHES_INDEX.md`: add patch05 entry.
- `docs/changes/CHANGELOG_SFCM_SYMBOLS.md`: new section summarizing the animation rebuild.
- Reference patch spec under `docs/proposals/patch_05_Animation_fix.md` (this file) to keep traceability.

---

# 4. Impact

- **Rendering only**: no change to ENGINE_V2 pipeline, determinism unaffected.
- **Performance**: negligible. Each render adds O(n) sampling for curved segments (20 samples max). Typical symbol has < 25 connections, so cost is tiny compared to React reconciliation.
- **UX**: resolves dashed flicker and ensures animation progresses smoothly for each line.

---

# 5. Validation

- Manual verification on at least two seeds (one with branching/dashed lines and one without) to ensure the animation starts from empty canvas and progresses smoothly.
- Toggle animation off/on to confirm dash patterns persist.
- Exported SVGs remain unaffected because we only change preview-time props; export pipeline already strips animation-specific attributes in `lib/prepareSvgForExport.ts`.
