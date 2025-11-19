# patch01_tasks — Implement Final Geometry Mirroring

> SPEC_04 note: questa patch costituisce l'attuale Step 7 del Cosmograph Engine. Il file rimane per traccia storica del rollout.

**Target:** ENGINE_V2  
**Patch:** patch01_SPEC_03_mirroring_revision  
**Status:** REQUIRED

---

# 1. Remove Old Mirroring
Remove any mirroring logic from:
- lib/engine_v2/position.ts
- lib/engine_v2/mirroring.ts (deprecated)
- Any place where mirroring was applied BEFORE line generation

DO NOT delete the files yet — mark all old mirroring code as:
```ts
/** @deprecated replaced by patch01 final mirroring */
```

---

# 2. Create New Module
Create:

```
lib/engine_v2/finalMirroring.ts
```

with this API:

```ts
export function applyFinalMirroring(
  connections: EngineV2Connection[],
  seed: string
): EngineV2Connection[];
```

---

# 3. New Mirroring Algorithm (based on patch01)
Implement:

### Step 1 — Compute bounding box
From all `from`, `to`, and control points (if curved).

### Step 2 — Compute principal direction
Use deterministic seed-based rule:
- If width > height → mirror vertically
- If height > width → mirror horizontally
- If equal → diagonal reflection
No randomness.

### Step 3 — Reflect geometry
Mirror:
- from.x / from.y
- to.x / to.y
- curved control points (cx/cy)

### Step 4 — Optionally merge
Combine original + mirrored sets consistently.

Seed must ensure determinism.

---

# 4. Insert New Step in ENGINE_V2 Pipeline
In:

```
lib/engine_v2/engine.ts
```

Add:

```ts
const mirrored = applyFinalMirroring(connections, seed);
return mirrored;
```

as the LAST transformation before returning.

This step must happen AFTER:
- semantic mapping
- projection
- clusters
- MST
- extra lines
- curvature logic

---

# 5. Update Docs in Repo
Update these files to reference the new final mirroring:

- docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md  
- docs/proposals/patch01_SPEC_03_mirroring_revision.md (already there)

Remove old mirroring references.

---

# 6. Verification (Cursor must run)
Cursor must run:
- TypeScript check
- Lint
- Build
- Render preview with example seeds

Confirm:
- Determinism preserved  
- No leftover references to old mirroring  
- Final output is symmetric and respects patch01

---

# End of patch01_tasks
