# ENGINE_V2 — Semantic Map v2 Specification

**Scope:**  
This document defines how the new 4‑axis semantic dictionary works in ENGINE_V2 and how the mapping logic must be implemented in the codebase. It corresponds to Step 1 del `SPEC_04_COSMOGRAPH_ENGINE`.

**Important constraints:**

- The old 6‑axis `semantic/semantic-map.json` must be **fully detached** from the new engine logic.
- The new dictionary file **`semantic/semantic-map-v2.json`** will be created and maintained **manually** (human editing) by the user.
- Cursor **must not** create or overwrite the JSON file. It may only **read** from it.
- When a keyword is missing in the JSON, the engine must use a **deterministic random fallback** (same word → same 4 values).

The goal is to keep the mapping layer **simple, explicit and robust**, without introducing new semantic complexity into the engine code.

---

## 1. Axes definition (4 semantic axes)

ENGINE_V2 uses **4 semantic axes**. Each axis has a range **[-100, +100]** and a verbal pair that defines its meaning:

### 1.1 Alfa — Azione ↔ Osservazione

- **Azione**: intervento, trasformazione, orientamento attivo verso il mondo.
- **Osservazione**: ricezione, percezione, ascolto, consapevolezza dello stato delle cose.

**Numeric range:**
- -100 → polo **Osservazione** puro
- 0 → equilibrio
- +100 → polo **Azione** puro

---

### 1.2 Beta — Specifico ↔ Ampio

- **Specifico**: circoscritto, concreto, situato, definito nei dettagli.
- **Ampio**: generale, esteso, sistemico, connesso a contesti più vasti.

**Numeric range:**
- -100 → polo **Specifico**
- 0 → equilibrio
- +100 → polo **Ampio**

---

### 1.3 Delta — Regolare ↔ Irregolare

- **Regolare**: costante, ordinato, prevedibile, uniforme.
- **Irregolare**: variabile, discontinuo, oscillante, segnato da deviazioni.

**Numeric range:**
- -100 → polo **Regolare**
- 0 → equilibrio
- +100 → polo **Irregolare**

---

### 1.4 Gamma — Unico ↔ Composto

- **Unico**: unitario, omogeneo, riconoscibile come un singolo insieme.
- **Composto**: plurale, stratificato, ibrido, formato da più elementi interrelati.

**Numeric range:**
- -100 → polo **Unico**
- 0 → equilibrio
- +100 → polo **Composto**

---

## 2. Data model for the new semantic map

The new dictionary is a **single JSON file**:

- Path: `semantic/semantic-map-v2.json`
- Responsibility: **only** ENGINE_V2 reads it; no other module should depend on it directly.

### 2.1 JSON structure

```jsonc
{
  // One top-level entry per keyword (lowercase)
  "azione": {
    "alfa": 90,
    "beta": 10,
    "gamma": 20,
    "delta": 30
  },
  "ascolto": {
    "alfa": -80,
    "beta": -10,
    "gamma": -30,
    "delta": -20
  }
}
```

**Rules:**

1. **Key format**
   - The top‑level keys are **keywords in lowercase**, with whitespace trimmed.
   - Example: `"Pratica "` → `"pratica"`.

2. **Value format**
   - Each entry is an object with exactly 4 numeric fields:
     - `alfa`, `beta`, `gamma`, `delta`
   - Each value must be a number in **[-100, +100]**.

3. **No derived / meta fields**
   - No extra properties like `description`, `tags`, `source`, etc.  
     The engine only cares about the 4 axes.

4. **Ownership**
   - The file is written and maintained **by the user**.
   - Cursor only reads from it and must not overwrite it.

### 2.2 Type used by ENGINE_V2

In TypeScript, the new axes type should be (or remain) something like:

```ts
export type AxesV2 = {
  alfa: number;   // Azione ↔ Osservazione
  beta: number;   // Specifico ↔ Ampio
  gamma: number;  // Unico ↔ Composto
  delta: number;  // Regolare ↔ Irregolare
};
```

The semantic map can be represented as:

```ts
export type SemanticMapV2 = Record<string, AxesV2>;
```

---

## 3. Keyword → AxesV2 mapping logic

The mapping logic is implemented in ENGINE_V2, **not** in the JSON file. The JSON is just data.

### 3.1 Normalization of the input keyword

Any user input keyword must be normalized as follows:

```ts
function normalizeKeyword(raw: string): string {
  return raw.trim().toLowerCase();
}
```

- This function should live in `lib/engine_v2/axes.ts` (or similar).
- All lookups into `semantic-map-v2.json` must use the normalized form.
- Example:
  - Input: `" Pratica "` → normalize → `"pratica"` → lookup key `"pratica"`.

### 3.2 Lookup in semantic-map-v2.json

High-level function signature:

```ts
export function getAxesForKeywordV2(
  keyword: string,
  map: SemanticMapV2
): AxesV2;
```

**Behavior:**

1. Normalize the keyword with `normalizeKeyword`.
2. If `map[normalized]` exists and is valid, **return it**.
3. Otherwise, compute a **deterministic fallback** (see §3.3).

### 3.3 Deterministic fallback for unknown keywords

When a keyword is **not present** in the JSON, the engine must **not fail**.  
Instead, it should generate an **AxesV2** in a repeatable way:

- Same keyword → same 4 axis values.
- Different keyword → almost always different values.

Suggested approach (deterministic PRNG):

```ts
import seedrandom from "seedrandom";

function fallbackAxesV2(normalized: string): AxesV2 {
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

**Properties:**

- Deterministic: `seedrandom` with a fixed prefix (`"axes_v2:"`) ensures that:
  - same normalized keyword → same sequence → same values.
- Bounded: values are integer in **[-100, +100]**.

**Important:** This fallback is a **temporary solution** for when:
- the dictionary is still incomplete, or
- the API‑based enrichment (e.g. Gemini) is not yet integrated.

The engine should be written so that **adding more entries to the JSON later** does *not* break existing behavior for already known keywords.

### 3.4 Validation of loaded JSON

When loading `semantic-map-v2.json`, we strongly recommend a small runtime validation step:

- Ensure the parsed object is indeed a dictionary of `{ [keyword: string]: AxesV2 }`.
- For each entry:
  - `alfa`, `beta`, `gamma`, `delta` must be finite numbers.
  - Clamp to [-100, +100] if needed (defensive programming).

Example (simplified):

```ts
function sanitizeAxesV2(raw: any): AxesV2 | null {
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

The loader may apply this to each entry and skip invalid ones.

---

## 4. Decoupling from the old 6‑axis semantic map

The previous engine used a 6‑axis map at:

- `semantic/semantic-map.json`

and a type similar to:

```ts
type AxesV1 = {
  ordine_caos: number;
  conflitto_consenso: number;
  teoria_pratica: number;
  individuale_collettivo: number;
  naturale_artificiale: number;
  locale_globale: number;
};
```

ENGINE_V2 **must not depend** on this anymore.

### 4.1 Archiving the old map

- The file `semantic/semantic-map.json` should be manually moved to an `archive/` folder (outside of ENGINE_V2’s logic).
- ENGINE_V2 code **must not import** or reference it.

### 4.2 Removal of mechanical conversion (if any)

If there is any function that tries to:

- read the old 6‑axis map, and
- mechanically convert it into 4 axes,

that function must be **removed** or clearly **deprecated** and unused.

ENGINE_V2 should only know one source of truth:

- **`semantic-map-v2.json`** (4 axes).

---

## 5. Responsibility boundaries

To keep the system stable and understandable:

### 5.1 What the JSON controls

- Which keywords exist.
- The exact 4 numerical values (axes) for each known keyword.

### 5.2 What ENGINE_V2 controls

- How to normalize keywords.
- How to handle missing keywords (deterministic fallback).
- How to use the 4 axes in the geometry pipeline:
  - Alfa/Beta → position.
  - Gamma/Delta → line count / line style, etc. (already defined in ENGINE_V2 geometry docs).
- How to remain deterministic.

### 5.3 What Cursor must NOT do

- Must not generate or overwrite `semantic-map-v2.json`.
- Must not auto‑populate the dictionary from external APIs.
- Must not mix old and new maps.

---

## 6. Future integration with external APIs (informative only)

In the future, an internal tool may be created that:

- Queries an LLM (e.g. Gemini) for a given keyword,
- Proposes values for Alfa/Beta/Gamma/Delta,
- Writes them into `semantic-map-v2.json` after manual review.

This is **not part of ENGINE_V2 mapping logic** and must **not** be assumed by the engine.  
ENGINE_V2 only reads the JSON and applies the deterministic fallback described above.

---

## 7. Summary

- The new mapping uses **4 semantic axes**: Alfa, Beta, Gamma, Delta, each in [-100, +100].
- The new dictionary file is **`semantic/semantic-map-v2.json`**, maintained manually.
- ENGINE_V2 exposes a function `getAxesForKeywordV2(keyword, map)` that:
  - normalizes the keyword,
  - looks it up in the JSON,
  - uses a **deterministic random fallback** when missing.
- The old 6‑axis map is **archived** and not used.
- No placeholders, no hidden magic: the mapping layer is explicit and controlled.
