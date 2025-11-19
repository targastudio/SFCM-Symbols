# Feature — Real_Time_Generation
Feature specification
Version: 1.0
Location: `docs/specs/features/Real_Time_Generation.md`

## Overview
Real_Time_Generation enables continuous regeneration of the ENGINE_V2 geometry while sliders are being moved. Instead of waiting for a mouse-up event, the geometry updates in real time during slider drags so users can observe how length, curvature, clustering, and other controls sculpt the symbol.

---

## Goals

### 1. Regenerate geometry during slider drags
- Trigger ENGINE_V2 regeneration on pointer move/drag events for sliders (not only on change/end events).
- Keep updates deterministic: identical keyword, slider position, canvas size, and seed must always yield the same geometry regardless of interaction speed.
- Ensure seeded randomness remains unchanged: slider-driven values are already deterministic inputs; the regeneration loop must reuse the existing seed derivation logic.

### 2. Provide responsive UI feedback
- Target perceptible real-time feedback (<100 ms perceived latency) between slider movement and canvas redraw on typical project datasets/canvas sizes.
- Debounce/throttle regeneration to avoid request storms: suggest ~60–120 Hz cap (e.g., `requestAnimationFrame` or a 8–16 ms throttle) while dragging, with a final authoritative render when drag ends.
- Keep the debug overlay synchronized so visual diagnostics (clusters, start points, bbox) update alongside the geometry.

### 3. Preserve UX clarity and control
- Display a brief loading/processing indicator when regeneration is in-flight to reassure users on slower devices.
- Avoid blocking text input/keyword editing while real-time updates run.
- Maintain current slider semantics; no new slider-specific state should be introduced beyond the transient interaction state needed for throttling.

### 4. Guard performance and resource usage
- Reuse cached values where possible (axes mapping, precomputed canvas metrics) to minimize work per update.
- Ensure memory usage stays stable by canceling in-progress async generation when a newer drag event arrives.
- Keep the feature opt-in via a feature flag or configuration toggle to allow staged rollout or A/B testing.

---

## Requirements & Constraints

### Determinism
- Regeneration frequency must not change the output: the same slider position produces the same geometry regardless of how often regeneration was triggered.
- All PRNG seeds and prefixes remain untouched; slider movements only re-run the deterministic pipeline.

### Compatibility
- Works across all existing sliders (lengthScale, curvatureScale, clusterCount, clusterSpread, Force Orientation toggle, etc.) without altering their meaning.
- Compatible with current rendering order (primary lines → mirroring → branching → optional rotation) and with existing debug/preview components.
- No change to persisted settings or saved presets.

### Performance
- Target <100 ms visual response for slider-driven updates on reference hardware; document any deviations or known heavy canvases.
- Throttling/debouncing strategy must prevent runaway renders during fast drags while ensuring the final slider position is always rendered.

### Telemetry & Debugging
- Expose timing metrics (e.g., generation duration, throttling hit rate) in debug telemetry to validate responsiveness.
- Log when renders are skipped or superseded due to throttling/cancelation to aid profiling.

### Documentation
- Update README/SPEC indices as needed to reference this feature document after implementation.

### Testing
- Add interaction tests (or manual QA steps) that simulate slider drags and confirm real-time canvas updates without crashes or visual stalls.
- Include performance checks to ensure throttling keeps UI responsive under rapid slider movements.

---

## Implementation Notes (v1.0)

### Scheduler & Determinism
- `app/page.tsx:130-360` introduces a generation trigger enum so the same `generateSymbolFromCurrentState` pipeline can distinguish manual renders, slider drags, drag-finalization frames and Force Orientation toggles.
- A `scheduleRealtimeGeneration` helper (`app/page.tsx:331-355`) accumulates the latest slider intent, drops intermediate requests and throttles dispatch to `~16 ms` via `requestAnimationFrame`.
- When a newer drag arrives, `realtimeControllerRef.dropCurrentResult` marks the running render as stale so its result is skipped (`app/page.tsx:184-237`). Skips and throttles are logged through `console.debug` as required by the spec.
- Pointer events are captured globally to fire a final, unthrottled render after drag end (`app/page.tsx:380-399`).
- Animation is bypassed for slider-driven renders so the preview does not restart on every frame: `skipAnimationForNextRenderRef` flags the next render as “no animation” and manual renders still use the staged double `requestAnimationFrame` (`app/page.tsx:64-111`, `app/page.tsx:204-222`).

### Feature flag & UI toggle
- The feature is gated by `NEXT_PUBLIC_REAL_TIME_GENERATION` through `lib/featureFlags.ts`. The UI exposes a user-facing toggle that defaults to the flag value (`app/page.tsx:420-452`) so staging/AB testing can disable the behavior without code changes.

### Telemetry & Debug Overlay
- `EngineV2DebugInfo` now carries `realtimeGeneration` telemetry (`lib/types.ts:145-173`), populated in `app/page.tsx:195-236`.
- `components/DebugOverlay.tsx:21-118` renders the timing, throttle and skip counters so QA can verify responsiveness alongside geometry updates.

### Manual QA Steps
1. Generate a symbol once, enable “Anteprima real-time”, then drag each slider slowly and confirm the canvas updates continuously without waiting for mouse-up.
2. Drag Slider1 and Slider2 quickly back and forth, observing that the in-panel status shows “Aggiornamento in tempo reale…” and the debug overlay increments throttle/skip counters rather than freezing.
3. Toggle Force Orientation repeatedly while dragging Slider4 to ensure the feature schedules a new render and the final position matches the last slider value.

## Acceptance Checklist
- [x] Slider drags trigger visible, real-time geometry regeneration (not just on release).
- [x] Deterministic outputs: same inputs + slider position → same geometry independent of drag speed.
- [x] Throttling/debouncing in place to keep UI responsive and prevent render backlog.
- [x] Debug overlay and any telemetry update in lockstep with geometry changes.
- [x] Documentation references (README/SPEC indices) updated to include Real_Time_Generation.
- [x] Tests or documented manual QA steps cover rapid slider drag scenarios.
