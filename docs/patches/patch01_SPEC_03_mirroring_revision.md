# patch01_SPEC_03_mirroring_revision  
### Revision to SPEC_03 — ENGINE_V2 Mirroring Logic  
**Date:** 2025-11-16  
**Type:** Spec Patch (Non-breaking, Structural Revision)

---

# 1. Purpose of This Patch
This patch revises the mirroring system defined in SPEC_03_ENGINE_V2.

Old behavior:  
- Mirroring happened BEFORE line generation (on points only).  
New behavior:  
- Mirroring happens AFTER line generation (on final geometry).

This ensures:
- true symmetry,
- consistent final outputs,
- preservation of Gamma/Delta processing,
- deterministic and meaningful structures.

---

# 2. Summary of Changes

### OLD (deprecated)
Mirroring step executed immediately after Alfa/Beta → position projection.

### NEW (this patch)
Mirroring step is now executed:
1. after Alfa/Beta position projection  
2. after cluster generation  
3. after line generation (MST + extras)  
4. after Gamma/Delta (curvature)  
5. **as the final geometry step** before rendering

This produces coherent symmetric structures.

---

# 3. Updated ENGINE_V2 Geometry Pipeline

### 1. Semantic Mapping (unchanged)
keyword → { alfa, beta, gamma, delta }

### 2. Position Projection (unchanged)
Alfa/Beta → normalized → pixel coordinates

### 3. Cluster Generation (unchanged)

### 4. Line Generation (unchanged)

### 5. Curve Processing (unchanged)

---

## **6. NEW Final Mirroring Phase (replaces old mirroring)**
Mirroring now applies on your final connections:

```ts
type Connection = {
  from: { x: number; y: number };
  to:   { x: number; y: number };
  curvature: number;
  curved: boolean;
  dashed: boolean;
}
```

### Mirroring steps:
1. Compute bounding box of all final line coordinates  
2. Determine the principal orientation  
3. Select deterministic mirroring axis  
4. Reflect all geometry across that axis  
5. (Optional) Merge original + mirrored sets  

### Effects:
- Bézier curves mirrored correctly  
- Symmetry applied to *full geometry*, not raw points  
- Outputs more coherent and predictable  

---

# 4. Implementation Notes for Cursor

- Remove mirroring from `position.ts`
- Add `applyFinalMirroring(connections)` into ENGINE_V2 engine
- Ensure control points are mirrored
- Keep behavior deterministic (seed-based)
- Document deprecation of old mirroring

---

# 5. Compatibility
This is a non-breaking patch:
- no API changes
- no structure changes
- no semantic map changes

It **only changes internal geometry ordering**.

---

# 6. Document Updates Required
This patch requires updating:
- ENGINE_V2_GEOMETRY_PIPELINE.md  
- ENGINE_V2_MIGRATION_GUIDE.md (minor)

---

# End of patch01_SPEC_03_mirroring_revision