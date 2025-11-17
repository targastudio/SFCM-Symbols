/**
 * ENGINE_V2 — Quadrant Mirroring (DEPRECATED by patch01)
 * 
 * @deprecated This module is deprecated and replaced by final geometry mirroring.
 * See: docs/patches/patch01_SPEC_03_mirroring_revision.md
 * See: lib/engine_v2/finalMirroring.ts for the new implementation
 * 
 * This old mirroring was applied BEFORE curve generation (on points only).
 * The new final mirroring (patch01) is applied AFTER curve generation (on connections).
 * 
 * This file is kept for reference only and is NOT used by the active ENGINE_V2 pipeline.
 * 
 * ---
 * 
 * Original implementation notes:
 * 
 * Implements quadrant-based mirroring logic as specified in:
 * - docs/SPEC_03_ENGINE_V2.md section 4.2, Step 3 (OLD VERSION)
 * - docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 3 (OLD VERSION)
 * 
 * Mirroring rules:
 * - 1 quadrant occupied → replicate to other 3
 * - 2 quadrants occupied → replicate to remaining 2
 * - 3 quadrants occupied → replicate to last 1
 * - 4 quadrants occupied → no mirroring
 * 
 * Mirroring uses reflection/flip: (x, y) ↔ (1-x, y), (x, 1-y), or both
 * 
 * IMPORTANT: Old behavior - Mirroring occurred BEFORE Gamma/Delta transformations (deprecated).
 */

import type { Point, Quadrant } from "../types";

/**
 * Clamps a value to [0, 1] range
 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Reflects a normalized point horizontally: (x, y) → (1-x, y)
 */
function reflectHorizontal(xNorm: number, yNorm: number): { xNorm: number; yNorm: number } {
  return {
    xNorm: clamp01(1 - xNorm),
    yNorm: clamp01(yNorm),
  };
}

/**
 * Reflects a normalized point vertically: (x, y) → (x, 1-y)
 */
function reflectVertical(xNorm: number, yNorm: number): { xNorm: number; yNorm: number } {
  return {
    xNorm: clamp01(xNorm),
    yNorm: clamp01(1 - yNorm),
  };
}

/**
 * Reflects a normalized point both horizontally and vertically: (x, y) → (1-x, 1-y)
 */
function reflectBoth(xNorm: number, yNorm: number): { xNorm: number; yNorm: number } {
  return {
    xNorm: clamp01(1 - xNorm),
    yNorm: clamp01(1 - yNorm),
  };
}

/**
 * Determines which quadrants are occupied by the given points
 * Returns a Set of quadrant numbers (1, 2, 3, 4)
 */
export function getOccupiedQuadrants(
  points: Array<{ xNorm: number; yNorm: number }>
): Set<Quadrant> {
  const occupied = new Set<Quadrant>();
  
  for (const point of points) {
    const x = clamp01(point.xNorm);
    const y = clamp01(point.yNorm);
    
    if (x >= 0.5 && y < 0.5) occupied.add(1); // top-right
    if (x < 0.5 && y < 0.5) occupied.add(2); // top-left
    if (x < 0.5 && y >= 0.5) occupied.add(3); // bottom-left
    if (x >= 0.5 && y >= 0.5) occupied.add(4); // bottom-right
  }
  
  return occupied;
}

/**
 * Applies mirroring to fill empty quadrants based on occupancy
 * 
 * Strategy:
 * - 1 quadrant → mirror to other 3 (horizontal, vertical, both)
 * - 2 quadrants → mirror to remaining 2
 * - 3 quadrants → mirror to last 1
 * - 4 quadrants → no mirroring
 * 
 * Returns array of mirrored points (normalized coordinates) with metadata
 */
export function applyQuadrantMirroring(
  points: Array<{ xNorm: number; yNorm: number; keyword: string }>
): Array<{ xNorm: number; yNorm: number; keyword: string; isMirrored: boolean }> {
  if (points.length === 0) return [];

  const occupied = getOccupiedQuadrants(points);
  const numOccupied = occupied.size;

  // If all 4 quadrants are occupied, no mirroring needed
  if (numOccupied === 4) {
    return points.map((p) => ({ ...p, isMirrored: false }));
  }

  // Start with original points
  const result: Array<{ xNorm: number; yNorm: number; keyword: string; isMirrored: boolean }> =
    points.map((p) => ({ ...p, isMirrored: false }));

  // Determine which quadrants need to be filled
  const allQuadrants: Quadrant[] = [1, 2, 3, 4];
  const emptyQuadrants = allQuadrants.filter((q) => !occupied.has(q));

  // For each original point, mirror it to fill empty quadrants
  for (const point of points) {
    const { xNorm, yNorm, keyword } = point;

    for (const targetQuadrant of emptyQuadrants) {
      let mirrored: { xNorm: number; yNorm: number };

      // Determine which reflection(s) are needed to reach target quadrant
      // Quadrant 1: top-right (x >= 0.5, y < 0.5)
      // Quadrant 2: top-left (x < 0.5, y < 0.5)
      // Quadrant 3: bottom-left (x < 0.5, y >= 0.5)
      // Quadrant 4: bottom-right (x >= 0.5, y >= 0.5)

      const sourceX = clamp01(xNorm);
      const sourceY = clamp01(yNorm);
      const sourceQuadrant =
        sourceX >= 0.5 && sourceY < 0.5
          ? 1
          : sourceX < 0.5 && sourceY < 0.5
          ? 2
          : sourceX < 0.5 && sourceY >= 0.5
          ? 3
          : 4;

      // If already in target quadrant, skip
      if (sourceQuadrant === targetQuadrant) continue;

      // Apply appropriate reflection(s) to reach target quadrant
      if (targetQuadrant === 1) {
        // Target: top-right (x >= 0.5, y < 0.5)
        if (sourceQuadrant === 2) {
          // From top-left: reflect horizontally
          mirrored = reflectHorizontal(xNorm, yNorm);
        } else if (sourceQuadrant === 3) {
          // From bottom-left: reflect both
          mirrored = reflectBoth(xNorm, yNorm);
        } else {
          // From bottom-right (4): reflect vertically
          mirrored = reflectVertical(xNorm, yNorm);
        }
      } else if (targetQuadrant === 2) {
        // Target: top-left (x < 0.5, y < 0.5)
        if (sourceQuadrant === 1) {
          // From top-right: reflect horizontally
          mirrored = reflectHorizontal(xNorm, yNorm);
        } else if (sourceQuadrant === 3) {
          // From bottom-left: reflect vertically
          mirrored = reflectVertical(xNorm, yNorm);
        } else {
          // From bottom-right (4): reflect both
          mirrored = reflectBoth(xNorm, yNorm);
        }
      } else if (targetQuadrant === 3) {
        // Target: bottom-left (x < 0.5, y >= 0.5)
        if (sourceQuadrant === 1) {
          // From top-right: reflect both
          mirrored = reflectBoth(xNorm, yNorm);
        } else if (sourceQuadrant === 2) {
          // From top-left: reflect vertically
          mirrored = reflectVertical(xNorm, yNorm);
        } else {
          // From bottom-right (4): reflect horizontally
          mirrored = reflectHorizontal(xNorm, yNorm);
        }
      } else {
        // Target: bottom-right (x >= 0.5, y >= 0.5)
        if (sourceQuadrant === 1) {
          // From top-right: reflect vertically
          mirrored = reflectVertical(xNorm, yNorm);
        } else if (sourceQuadrant === 2) {
          // From top-left: reflect both
          mirrored = reflectBoth(xNorm, yNorm);
        } else {
          // From bottom-left (3): reflect horizontally
          mirrored = reflectHorizontal(xNorm, yNorm);
        }
      }

      // Add mirrored point
      result.push({
        xNorm: mirrored.xNorm,
        yNorm: mirrored.yNorm,
        keyword,
        isMirrored: true,
      });
    }
  }

  return result;
}

