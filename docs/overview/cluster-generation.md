# Cluster Generation and Its Impact on Symbols

This document explains how directional clusters are created in the Engine V2 geometry pipeline and how they influence the resulting symbol generations.

> **SPEC reference**: Matches Step 4 (Direction clustering) and Step 5-6 (Length/curvature profiles) of `docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md`.

## How clusters are generated

1. **Evenly spaced cluster centers**
   - A configurable `clusterCount` sets how many directional groups exist (default 3, range 2–5).
   - Centers are distributed uniformly between 0° and 180° using `clusterAngle = (clusterIndex / clusterCount) * 180`.
2. **Deterministic cluster assignment**
   - Each line receives a `clusterIndex` via a seeded PRNG: `seededRandom(\`${seed}:cluster:${lineIndex}\`)`.
   - The same `seed` and `lineIndex` always yield the same cluster.
3. **Gamma rotation**
   - A `gamma` control rotates all clusters together: `gammaRotation = (gamma / 100) * 180`.
   - This keeps relative spacing intact while shifting the whole pattern.
4. **In-cluster jitter**
   - A `clusterSpread` value (10°–60°, default 30°) defines how wide each cluster can fan out.
   - Each line gets a small, deterministic offset: `(seededRandom(\`${seed}:jitter:${lineIndex}\`) - 0.5) * clusterSpread`.
5. **Final direction**
   - The direction used to draw the line is `(clusterAngle + gammaRotation + jitter) % 180`, clamped to the 0–180° range.

## Parameters that shape clustering

- **clusterCount (Slider3)** – Controls how many directional families appear.
  - Low values (2) create fewer, highly differentiated lobes.
  - High values (5) create more families and richer angular variety.
- **clusterSpread (Slider4)** – Controls variation within each family.
  - Narrow spread (≈10°) keeps lines tightly bundled.
  - Wide spread (≈60°) produces looser, more organic fans.
- **gamma** – Rotates every cluster together without changing their spacing.

## Effects on the generated symbols

- **Directional grouping** – Lines share a color-coded family in debug overlays, making overall structure easier to read.
- **Controlled randomness** – Seeds guarantee the same line lands in the same cluster and receives the same jitter, enabling repeatable renders.
- **Style tuning** – Adjusting `clusterCount` trades clarity for variety, while `clusterSpread` trades precision for looseness.
- **Profile variation** – Downstream length and curvature profiles reuse the `clusterIndex` so that lines inside the same family can still differ in length or curvature, increasing expressiveness without breaking the cluster structure.
