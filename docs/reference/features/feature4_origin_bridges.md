# Feature 4 — Origin Bridges
Feature specification
Version: 1.0
Location: `docs/reference/features/feature4_origin_bridges.md`

> **Status**: Temporarily disabled. The UI control has been removed and the feature is hardcoded to `false` in the engine. Backend code remains intact for potential future use.

## Overview
Feature4 introduces **Origin Bridges**, a deterministic network of dashed straight segments that connect the primary Alfa/Beta anchor points of every keyword before curve generation begins. Each pair of keywords receives one dashed bridge so that all anchors are connected with the same stroke color and width as regular ENGINE_V2 lines. Bridges enter the pipeline immediately after Step 3.3 (Point Dispersion) and before Step 3.4 (Direction Clustering) so they can follow the same mirroring, branching and rotation stages as the rest of the geometry.

The feature is controlled by a UI toggle labeled **Bridges**. When enabled, ENGINE_V2 emits `BranchedConnection` records with `curved = false`, `dashed = true`, `curvature = 0` and `generationDepth = 0`, guaranteeing seamless integration with rendering, mirroring, branching and exports.

---

## Goals

### 1. Visual bridges across anchor points
- Connect every pair of keyword anchor points (the Alfa/Beta positions before dispersion) with a dashed straight line.
- Use the same stroke color and width as standard connections so the bridges feel native to the visual language.
- Preserve determinism: the bridge set depends only on the ordered list of keywords and their computed anchors.

### 2. UI toggle for runtime control
- Add a **Bridges** checkbox in `app/page.tsx`, defaulting to **ON** so the feature is visible by default.
- Persist the state via React, thread it into the `generateEngineV2` options object and expose it to the engine as `originBridgesEnabled`.
- Keep the seed untouched: toggling bridges only adds or removes deterministic connections and never alters `generateSeed`.

### 3. Integrate with ENGINE_V2 pipeline
- Extend `EngineV2Options` in `lib/engine_v2/engine.ts` with `originBridgesEnabled?: boolean` (default `true`).
- Implement a helper (e.g. `generateOriginBridges`) that receives the ordered list of anchor points and returns the `BranchedConnection[]` complete graph with `dashed = true`.
- Insert the generated bridges between Point Dispersion and the curve-to-connection conversion so they travel through mirroring, branching and optional rotation alongside the other connections.
- Augment `EngineV2DebugInfo` with telemetry flags (`originBridgesEnabled`, `originBridgesCount`) for overlays.

### 4. Documentation & QA
- Document the behavior in SPEC_04 (pipeline step, UI toggle, determinism notes) and in this reference file.
- Update `docs/README.md` and `docs/changes/CHANGELOG_SFCM_SYMBOLS.md` to register the feature.
- Run `npm run lint` to ensure the TypeScript/React surface remains healthy.

---

## Requirements & Constraints

### Determinism
- No new randomness: bridges depend exclusively on the deterministic anchor coordinates (`axesToNormalizedPosition → normalizedToPixel`).
- The output order follows the input keyword order (lexical order is not altered), ensuring identical ordering given identical keyword arrays.

### Compatibility
- Works for any canvas ratio since anchors are computed in pixel coordinates for the current canvas.
- Bridges share `generationDepth = 0` with primary lines so rendering order and stroke thickness remain consistent.
- Mirroring, branching and the Force Orientation rotation operate on the augmented connection list without any special casing.

### Documentation
- SPEC_04 pipeline, control table and determinism registry updated with the new step and toggle.
- Reference index (`docs/README.md`) points to this document for discoverability.
- Changelog entry describing scope, UI toggle and affected files.

### Testing
- Visual regression: toggle Bridges on/off in the UI to ensure dashed segments appear/disappear deterministically.
- Run `npm run lint` after implementation.

---

## Acceptance Checklist
- [ ] Checkbox **Bridges** available in the UI and defaulting to ON.
- [ ] `originBridgesEnabled` option threaded from `app/page.tsx` to `generateEngineV2`.
- [ ] Deterministic dashed `BranchedConnection[]` added between Step 3.3 and Step 3.4 when the toggle is enabled.
- [ ] SPEC_04, README, changelog and reference docs updated accordingly.
- [ ] Lint/tests executed successfully.
