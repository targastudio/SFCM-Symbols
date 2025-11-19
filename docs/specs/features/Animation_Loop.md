# Feature — Animation Loop

## Overview
The **Animation Loop** adds a continuous flowing effect to all lines drawn on the canvas when the animation toggle is enabled. Each cycle animates the lines from zero length to full length, pauses briefly, then retracts them from the origin toward the arrowhead (arrowhead stays visible) before restarting the cycle.

## Expected Behavior
- **Scope**: All lines rendered on the canvas participate in the animation when the toggle is on.
- **Forward phase (0 → 1)**: Lines grow smoothly from the origin toward their arrowheads until they reach 100% of their intended length.
- **Pause**: A short pause occurs once lines reach full length to emphasize the completed geometry.
- **Forward-vanishing phase (1 → 0)**: Lines retract from the origin toward the arrowhead (same direction as growth). The arrowhead remains visible throughout this phase until the line fully retracts, creating a continuous flowing effect.
- **Looping**: The forward, pause, and forward-vanishing phases repeat continuously while the animation toggle remains enabled.
- **Arrowhead tracking**: Arrowheads are present from the first frame and remain attached to the instantaneous endpoint of each stroke. During forward growth they travel from the origin to the arrowhead, and during vanishing they stay anchored at the geometric arrowhead while the stroke retracts underneath.

## Implementation Notes
- Use a single shared animation timeline so every line stays in sync across phases.
- Interpolate line drawing based on normalized progress (0–1) mapped to 0–100% of each line's length.
- Ensure the pause between phases is configurable but defaults to a perceptible beat that preserves the flowing effect.
- Keep the animation deterministic per cycle length so users experience a stable rhythm even with many lines.
- The toggle should gracefully stop the loop, leaving the canvas in a clean state (no partial strokes) when turned off.
- During forward and vanishing phases, the arrowhead geometry updates every frame (position + rotation) so it matches the local tangent at the visible stroke tip.
- Dashes remain visible during the entire animation: the preview renders the final stroke styling at all times and uses per-connection masks to reveal the portion that should be visible for the current phase, so gaps never “pop” into place at the end.

## Timeline Implementation
- `app/page.tsx` owns the loop controller and defines `ANIMATION_LOOP_CONFIG` (forward 1.8 s, pause 0.42 s). The forward-vanishing phase uses the same duration as the forward phase (1.8 s). The `useEffect` driving `animationProgress` iterates the phases deterministically by reusing a single `requestAnimationFrame` timeline.
- The pause duration is configurable through `ANIMATION_LOOP_CONFIG.pauseDurationMs`, satisfying the requirement without introducing new UI controls. Changing the config affects every cycle equally because the phase transitions depend only on elapsed wall-clock time.
- When the **Animazione** toggle is disabled or when the real-time preview bypasses the loop, the controller forces `animationProgress = 1`, ensuring the canvas is left with fully drawn, static lines.

## Rendering Contract
- `components/SvgPreview.tsx` removes staggered offsets and now consumes the global `animationProgress` for every connection. All curves therefore grow/retract in sync, meeting the "single shared timeline" constraint.
- The preview still applies `easeInOutCubic` easing locally so the flowing looks organic, but there is no per-connection delay—each frame reuses the same eased value.
- Stroke styling (solid or dashed) is always applied to the base line; the animation effect comes from per-connection masks whose dash-offset matches the eased progress. During forward-vanishing the mask offset flips sign so the stroke retracts from the origin while the dashed pattern remains in place.
- Arrowheads are rendered as explicit triangles that move independently of the line markers. Their transforms (translate + rotate) follow the eased stroke progress so the arrow tip always sits on the animated endpoint with the correct tangent. Because this is explicit geometry, `prepareSvgForExport` snaps every arrowhead back to its final endpoint before serialization to avoid exporting an intermediate pose.
- `prepareSvgForExport` also strips the preview-only masks after cloning the DOM so exported SVGs contain the fully drawn geometry without animation-specific elements.
