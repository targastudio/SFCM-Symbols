/**
 * ENGINE_V2 — Semantic Mapping
 * 
 * Maps keywords to 4 semantic axes (Alfa, Beta, Gamma, Delta).
 * Range: [-100, +100]
 * 
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP.md
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP_TASKS.md
 * 
 * This module implements:
 * - Keyword normalization (trim + lowercase)
 * - Loading and validation of semantic-map-v2.json
 * - Deterministic fallback for missing keywords
 * - Public API: getAxesForKeywordV2
 */

import type { AxesV2, SemanticMapV2 } from "../types";
import seedrandom from "seedrandom";
import semanticMapV2 from "../../semantic/semantic-map-v2.json";

/**
 * Normalizes a keyword for dictionary lookup
 * 
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP.md section 3.1
 * 
 * @param raw Raw keyword string
 * @returns Normalized keyword (trimmed, lowercase)
 */
export function normalizeKeywordV2(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Sanitizes and validates raw axes data from JSON
 * 
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP.md section 3.4
 * 
 * - Validates that all 4 axes are present and are numbers
 * - Clamps values to [-100, +100] range
 * - Returns null if validation fails
 * 
 * @param raw Raw data from JSON (any type)
 * @returns Sanitized AxesV2 or null if invalid
 */
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

  // Check for NaN or Infinity
  if (
    !Number.isFinite(raw.alfa) ||
    !Number.isFinite(raw.beta) ||
    !Number.isFinite(raw.gamma) ||
    !Number.isFinite(raw.delta)
  ) {
    return null;
  }

  const clamp = (v: number) => Math.max(-100, Math.min(100, v));

  return {
    alfa: clamp(raw.alfa),
    beta: clamp(raw.beta),
    gamma: clamp(raw.gamma),
    delta: clamp(raw.delta),
  };
}

/**
 * Generates deterministic 4-axis values as fallback when keyword is not in dictionary
 * 
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP.md section 3.3
 * 
 * Uses seedrandom with a fixed prefix to ensure:
 * - Same keyword → same 4 axis values (deterministic)
 * - Different keywords → different values
 * 
 * @param normalized Normalized keyword (already trimmed and lowercased)
 * @returns Deterministic AxesV2 with values in [-100, +100]
 */
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
    delta: randAxis(),
  };
}

/**
 * Loads and normalizes the semantic-map-v2.json file
 * 
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP_TASKS.md section 3.1
 * 
 * - Reads semantic-map-v2.json
 * - Normalizes all keys using normalizeKeywordV2
 * - Sanitizes all values using sanitizeAxesV2
 * - Returns a clean SemanticMapV2 dictionary
 * 
 * If the file is missing or invalid, returns an empty map (does not crash).
 * 
 * @returns SemanticMapV2 dictionary with normalized keys and sanitized values
 */
export function getSemanticMapV2(): SemanticMapV2 {
  try {
    const map = semanticMapV2 as Record<string, unknown>;
    const result: SemanticMapV2 = {};

    for (const [key, value] of Object.entries(map)) {
      const normalizedKey = normalizeKeywordV2(key);
      const sanitized = sanitizeAxesV2(value);
      if (sanitized) {
        result[normalizedKey] = sanitized;
      } else {
        // Log warning in development (but don't crash)
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[ENGINE_V2] Invalid axes data for keyword "${key}" in semantic-map-v2.json, skipping.`
          );
        }
      }
    }

    return result;
  } catch (error) {
    // File missing or invalid JSON - return empty map
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[ENGINE_V2] Failed to load semantic-map-v2.json:",
        error
      );
    }
    return {};
  }
}

/**
 * Gets 4-axis values for a keyword (main public API)
 * 
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP.md section 3.2
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP_TASKS.md section 2.5
 * 
 * This is the ONLY function ENGINE_V2 should call to map a keyword to AxesV2.
 * 
 * Behavior:
 * 1. Normalize the keyword
 * 2. Look up in semantic-map-v2.json
 * 3. If found and valid, return sanitized value
 * 4. Otherwise, use deterministic fallback
 * 
 * @param keyword Raw keyword string from user input
 * @param map SemanticMapV2 dictionary (typically from getSemanticMapV2())
 * @returns AxesV2 with all 4 axes in [-100, +100]
 */
export function getAxesForKeywordV2(
  keyword: string,
  map: SemanticMapV2
): AxesV2 {
  const normalized = normalizeKeywordV2(keyword);
  const raw = map[normalized];

  if (raw) {
    // Entry exists in map (already sanitized during loading)
    return raw;
  }

  // Fallback for missing keywords
  return fallbackAxesV2(normalized);
}

/**
 * Legacy function name for backward compatibility during migration
 * 
 * @deprecated Use getAxesForKeywordV2 instead
 * This function is kept temporarily to avoid breaking existing code.
 * It will be removed once all call sites are updated.
 */
export async function getAxesV2ForKeyword(word: string): Promise<AxesV2> {
  const map = getSemanticMapV2();
  return getAxesForKeywordV2(word, map);
}
