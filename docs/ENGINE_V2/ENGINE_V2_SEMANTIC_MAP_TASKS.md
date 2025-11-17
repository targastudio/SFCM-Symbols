# ENGINE_V2 — Semantic Map v2 Tasks (for Cursor)

**Scope:**  
This document describes the concrete steps Cursor must perform to implement the new 4‑axis semantic mapping logic in the codebase, using `semantic/semantic-map-v2.json` and detaching completely from the old 6‑axis map.

**Important constraints:**

- Do **not** create or modify the JSON file `semantic/semantic-map-v2.json`.  
  It will be created and edited manually by the user.
- Do **not** use the old `semantic/semantic-map.json` in ENGINE_V2.
- Do **not** invent new behavior: follow this document and `ENGINE_V2_SEMANTIC_MAP.md` strictly.

---

## 1. Files involved

Cursor should work mainly on these files/modules:

- `docs/ENGINE_V2_SEMANTIC_MAP.md` (this spec)
- `lib/engine_v2/axes.ts` (or equivalent engine_v2 mapping module)
- `lib/engine_v2/engine.ts` (or the ENGINE_V2 orchestrator)
- Any place where keywords are currently converted to axes for ENGINE_V2

The old 6‑axis code (`lib/semantic.ts`, `semantic/semantic-map.json`, and any conversion helpers) must be **detached** from ENGINE_V2.

---

## 2. Implementing the new mapping function

### Task 2.1 — Define AxesV2 and SemanticMapV2 types (if not already present)

1. Open `lib/types.ts` (or the central types file used by ENGINE_V2).
2. Ensure the following types exist and are exported:

```ts
export type AxesV2 = {
  alfa: number;   // Azione ↔ Osservazione
  beta: number;   // Specifico ↔ Ampio
  gamma: number;  // Unico ↔ Composto
  delta: number;  // Regolare ↔ Irregolare
};

export type SemanticMapV2 = Record<string, AxesV2>;
```

3. If there is already an `AxesV2` type, verify that it matches exactly this structure and semantic meaning.

---

### Task 2.2 — Implement keyword normalization

1. Open `lib/engine_v2/axes.ts` (create it if it does not exist yet).  
2. Implement a small normalization helper:

```ts
export function normalizeKeywordV2(raw: string): string {
  return raw.trim().toLowerCase();
}
```

3. This function will be used by all ENGINE_V2 keyword→axes logic.

---

### Task 2.3 — Implement fallbackAxesV2 (deterministic)

Still in `lib/engine_v2/axes.ts`:

1. Import `seedrandom` (it should already be used in ENGINE_V2; if not, follow the existing pattern in the project):

```ts
import seedrandom from "seedrandom";
```

2. Implement the deterministic fallback as specified in `ENGINE_V2_SEMANTIC_MAP.md`:

```ts
export function fallbackAxesV2(normalized: string): AxesV2 {
  const rng = seedrandom(`axes_v2:${normalized}`);

  const randAxis = (): number => {
    // rng() ∈ [0,1) → map to [-100, 100]
    return Math.round((rng() * 200) - 100);
  };

  return {
    alfa: randAxis(),
    beta: randAxis(),
    gamma: randAxis(),
    delta: randAxis()
  };
}
```

3. Ensure this function is **pure and deterministic**:
   - No `Date.now()`, no global state, no non-deterministic calls.

---

### Task 2.4 — Implement sanitizeAxesV2

In the same file (`axes.ts`), add a helper to validate and clamp raw JSON entries:

```ts
export function sanitizeAxesV2(raw: any): AxesV2 | null {
  if (
    typeof raw !== "object" ||
    raw === null ||
    typeof raw.alfa !== "number" ||
    typeof raw.beta !== "number" ||
    typeof raw.gamma !== "number" ||
    typeof raw.delta !== "number"
  ) {
    return null;
  }

  const clamp = (v: number) => Math.max(-100, Math.min(100, v));

  return {
    alfa: clamp(raw.alfa),
    beta: clamp(raw.beta),
    gamma: clamp(raw.gamma),
    delta: clamp(raw.delta)
  };
}
```

This will be used when loading the JSON map.

---

### Task 2.5 — Implement getAxesForKeywordV2

In `lib/engine_v2/axes.ts`, implement the main mapping function:

```ts
export function getAxesForKeywordV2(
  keyword: string,
  map: SemanticMapV2
): AxesV2 {
  const normalized = normalizeKeywordV2(keyword);
  const raw = map[normalized];

  if (raw) {
    const sanitized = sanitizeAxesV2(raw);
    if (sanitized) {
      return sanitized;
    }
  }

  // Fallback for missing or invalid entries
  return fallbackAxesV2(normalized);
}
```

This is the **only** function ENGINE_V2 should call to map a keyword to `AxesV2`.

---

## 3. Loading semantic-map-v2.json

### Task 3.1 — Decide where to load the JSON

The project already has a pattern for loading the old semantic map.  
For ENGINE_V2, we want a clean, explicit loader for the new JSON file:

- Path: `semantic/semantic-map-v2.json`
- Type: `SemanticMapV2`
- Usage: read-only, no writes.

Cursor should:

1. Locate the place where keywords are prepared for ENGINE_V2 (for example in `app/page.tsx` or a dedicated helper).
2. Introduce a loader function, for example in `lib/engine_v2/axes.ts` or in a small `lib/engine_v2/semanticMapLoader.ts`:

```ts
import semanticMapV2 from "../semantic/semantic-map-v2.json"; // adjust path as needed
import type { SemanticMapV2 } from "../types";

export function getSemanticMapV2(): SemanticMapV2 {
  const map = semanticMapV2 as Record<string, unknown>;
  const result: SemanticMapV2 = {};

  for (const [key, value] of Object.entries(map)) {
    const normalizedKey = key.trim().toLowerCase();
    const sanitized = sanitizeAxesV2(value);
    if (sanitized) {
      result[normalizedKey] = sanitized;
    }
  }

  return result;
}
```

3. Ensure the import path is correct given the project structure.

---

### Task 3.2 — Use the map in the ENGINE_V2 pipeline

In the main ENGINE_V2 pipeline (for example in `lib/engine_v2/engine.ts` or in the generation function called from `app/page.tsx`):

1. Load the semantic map once (per generation) via `getSemanticMapV2()`.
2. For each keyword provided by the user:
   - Call `getAxesForKeywordV2(keyword, map)`.
   - Pass the resulting `AxesV2` into the rest of the ENGINE_V2 pipeline (position, mirroring, curves, etc.).

Example (high-level, adjust to actual code):

```ts
import { getSemanticMapV2, getAxesForKeywordV2 } from "./axes";

export function generateEngineV2FromKeywords(keywords: string[], seed: number) {
  const map = getSemanticMapV2();

  const axesList = keywords.map((keyword) => ({
    keyword,
    axes: getAxesForKeywordV2(keyword, map)
  }));

  // Then pass axesList to the rest of the engine_v2 pipeline
  // (position, mirroring, curves, etc.)
}
```

The exact function names and parameters should match the current ENGINE_V2 implementation.

---

## 4. Detaching from the old 6‑axis semantic map

### Task 4.1 — Remove ENGINE_V2 dependencies on the old map

Cursor must:

1. Search the codebase for imports of:

   - `semantic/semantic-map.json`
   - `lib/semantic.ts`
   - Any `Axes` type with 6 fields (`ordine_caos`, `conflitto_consenso`, etc.)

2. For any reference found inside ENGINE_V2 files (or code paths used exclusively by ENGINE_V2):
   - Remove the import and the usage,
   - Replace with the new `getAxesForKeywordV2` and `SemanticMapV2` logic.

3. The old files (`semantic/semantic-map.json`, `lib/semantic.ts`) should be treated as **legacy** and not used by ENGINE_V2.

> Note: The physical move of the old files to an archive folder will be done manually by the user.
> Cursor only needs to ensure that ENGINE_V2 does not reference them.

---

### Task 4.2 — Remove any “mechanical conversion” code

If there is any code that:

- reads 6‑axis values, and
- attempts to derive Alfa/Beta/Gamma/Delta mechanically,

that code should be either:

- deleted, or
- clearly marked as deprecated and unused.

ENGINE_V2 must only depend on:

- `SemanticMapV2` (4 axes)
- `getAxesForKeywordV2`

---

## 5. Safety and verification

### Task 5.1 — TypeScript, lint, build

After implementing all the above tasks, Cursor must:

1. Run TypeScript checks (e.g. `npm run lint` and/or `tsc --noEmit` depending on the project).
2. Run the Next.js build (`npm run build`).
3. Ensure there are **no errors**.

### Task 5.2 — Manual spot checks (logic consistency)

Cursor should also verify in code that:

1. ENGINE_V2 never calls old mapping functions.
2. All keyword → axes transformations for ENGINE_V2 go through:
   - `getSemanticMapV2()`
   - `getAxesForKeywordV2()`

3. In comments, the semantic meaning of the 4 axes is consistent with:
   - `ENGINE_V2_SEMANTIC_MAP.md`
   - `ENGINE_V2_GEOMETRY_PIPELINE.md`

---

## 6. Summary for Cursor

- Use `docs/ENGINE_V2_SEMANTIC_MAP.md` as the **source of truth** for the mapping logic.
- Implement:
  - `normalizeKeywordV2`
  - `fallbackAxesV2`
  - `sanitizeAxesV2`
  - `getAxesForKeywordV2`
  - `getSemanticMapV2` (loader)
- Ensure ENGINE_V2 uses the new map and never touches the old 6‑axis map.
- Do not create or modify `semantic/semantic-map-v2.json` from code.
- Keep everything deterministic and bounded in [-100, +100].