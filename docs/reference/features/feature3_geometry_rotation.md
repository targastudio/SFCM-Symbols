# Feature 3 — Force Orientation Geometry Rotation
Feature specification
Version: 1.0
Location: `docs/reference/features/feature3_geometry_rotation.md`

## Overview
Feature3 adds an optional 90° clockwise rotation to the ENGINE_V2 output whenever:
1. The UI toggle **Force Orientation** is enabled.
2. The bounding box of the **pre-mirroring** geometry is taller than it is wide (height > width).

The rotation is applied **after** mirroring and branching so that the final symbol (primary lines + mirrored duplicates + branches) is rotated as a whole around the canvas center. This keeps determinism intact because rotation depends only on inputs that are already part of the deterministic pipeline (keywords, canvas size, slider state).

---

## Goals

### 1. Surface Force Orientation in the UI
- Add a checkbox labeled **Force Orientation** below the cluster sliders in `app/page.tsx`.
- Persist its state as `forceOrientation` using React state.
- Include helper text explaining that it rotates the geometry clockwise when the pre-mirroring bounding box is taller than wide.

### 2. Thread the toggle through ENGINE_V2
- Pass `forceOrientation` to `generateEngineV2` via the options object.
- Extend `EngineV2Options` (in `lib/engine_v2/engine.ts`) with `forceOrientation?: boolean`.
- Ensure the option defaults to `false` so existing callers remain untouched.

### 3. Evaluate the bounding box after curve generation
- Reuse the same bounding box computation used by final mirroring (`computeBoundingBox` in `lib/engine_v2/finalMirroring.ts`).
- Capture the bbox immediately after converting curves to `BranchedConnection[]` and before mirroring.
- Use this bbox both for the Force Orientation predicate and for debug overlay telemetry.

### 4. Apply rotation after the full geometry pipeline
- Introduce `lib/engine_v2/geometryRotation.ts` with two helpers:
  - `shouldRotateGeometry(forceOrientation, bbox)` → `boolean` (true only when toggle is on and height > width).
  - `rotateConnectionsClockwise(connections, canvasWidth, canvasHeight)` → rotated `BranchedConnection[]`.
- Invoke `rotateConnectionsClockwise` after branching so the final symbol (lines + mirrored copies + branches) rotates together.
- Rotation happens around the canvas center using the standard 90° clockwise matrix: `(x, y) → (cx + (y - cy), cy - (x - cx))`.

### 5. Telemetry and Debugging
- Extend `EngineV2DebugInfo` with `forceOrientationEnabled` and `forceOrientationApplied` booleans so the debug overlay/SVG preview can display the current state.
- The debug overlay already visualizes the bbox, so no extra drawings are required.

---

## Requirements & Constraints

### Determinism
- Rotation is purely geometric; it must not introduce randomness.
- The rotation condition is derived from deterministic inputs (bbox of deterministic geometry + toggle state), so equal inputs always yield equal outputs.

### Compatibility
- Works for all canvas formats because rotation is around the canvas center and clamped to the same coordinate space.
- Branching output maintains `generationDepth`/`generatedFrom` metadata.
- No change to seeds or slider semantics.

### Documentation
- Update:
  - `docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md` with the new optional rotation step and UI toggle.
  - `docs/changes/CHANGELOG_SFCM_SYMBOLS.md` with an entry describing Feature3.
  - `docs/README.md` feature index to reference this file.

### Testing
- Run `npm run lint` to ensure TS/ESLint coverage.
- Manually verify Force Orientation in the UI by toggling it on/off and observing the rotation only when the bbox is taller than wide.

---

## Acceptance Checklist
- [ ] Checkbox labeled "Force Orientation" in the control panel.
- [ ] `forceOrientation` option consumed by `generateEngineV2`.
- [ ] Rotation applied after branching when `height > width` and toggle is on.
- [ ] Debug info exposes rotation state for overlays.
- [ ] Documentation + changelog updated as outlined above.
