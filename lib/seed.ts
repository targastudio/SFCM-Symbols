/**
 * PRNG deterministico per SFCM Symbol Generator
 * Usa cyrb53 hash + seedrandom
 */

import seedrandom from "seedrandom";

/**
 * Hash function cyrb53 per generare seed deterministici
 * @param str Stringa da hasharre
 * @param seed Seed opzionale (default 0)
 * @returns Numero hash
 */
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Genera un PRNG deterministico da una stringa seed
 * @param seed Stringa seed
 * @returns Funzione PRNG di seedrandom
 */
export function prng(seed: string) {
  return seedrandom(String(cyrb53(seed)));
}

/**
 * Helper function that wraps prng to directly return a random number [0, 1)
 * This is a convenience wrapper for cases where we need a single random value
 * @param seed Stringa seed
 * @returns Numero casuale deterministico [0, 1)
 */
export function seededRandom(seed: string): number {
  return prng(seed)();
}

