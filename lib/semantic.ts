/**
 * LEGACY ENGINE (ENGINE_V1 / SPEC_02) — kept only for reference, not used by ENGINE_V2 runtime.
 * 
 * This file contains the old 6-axis semantic system:
 * - getAxesForKeyword: Returns 6-axis Axes type (ordine_caos, conflitto_consenso, etc.)
 * - fallbackAxes: Generates 6-axis values for unknown keywords
 * 
 * ENGINE_V2 uses lib/engine_v2/axes.ts instead, which implements the 4-axis system (Alfa, Beta, Gamma, Delta).
 * 
 * IMPORTANT: This module is FULLY DETACHED from ENGINE_V2.
 * - ENGINE_V2 uses semantic-map-v2.json (4 axes) via lib/engine_v2/axes.ts
 * - This module uses semantic-map.json (6 axes) and is NOT imported by any active ENGINE_V2 code
 * 
 * @deprecated This entire module is deprecated. Use lib/engine_v2/axes.ts instead.
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP.md section 4
 */

import type { Axes } from "./types";
import { prng } from "./seed";
import semanticMap from "../semantic/semantic-map.json";

/**
 * Normalizza una keyword per la ricerca nel dizionario
 * @param word Keyword da normalizzare
 * @returns Keyword normalizzata (minuscolo, trim)
 */
function normalizeKeyword(word: string): string {
  return word.toLowerCase().trim();
}

/**
 * Genera valori assi deterministici come fallback quando la keyword non è nel dizionario
 * @param word Keyword
 * @returns Vettore di 6 assi ∈ [-10, +10]
 */
export function fallbackAxes(word: string): Axes {
  const normalized = normalizeKeyword(word);
  const rng = prng(normalized);

  // Genera 6 valori pseudo-casuali deterministici ∈ [-10, +10]
  return {
    ordine_caos: (rng() * 20) - 10,
    conflitto_consenso: (rng() * 20) - 10,
    teoria_pratica: (rng() * 20) - 10,
    individuale_collettivo: (rng() * 20) - 10,
    naturale_artificiale: (rng() * 20) - 10,
    locale_globale: (rng() * 20) - 10,
  };
}

/**
 * Ottiene i valori degli assi per una keyword
 * Prima cerca nel dizionario, poi usa fallback deterministico
 * @param word Keyword
 * @returns Promise che risolve con il vettore degli assi
 */
export async function getAxesForKeyword(word: string): Promise<Axes> {
  const normalized = normalizeKeyword(word);

  // Cerca nel dizionario
  const map = semanticMap as Record<string, Axes>;
  if (map[normalized]) {
    return map[normalized];
  }

  // Fallback deterministico (senza Gemini per ora)
  return fallbackAxes(word);
}

