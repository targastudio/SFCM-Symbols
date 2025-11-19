/**
 * ENGINE_V2 — Position Mapping
 * 
 * Maps Alfa/Beta axes to normalized coordinates [0, 1] × [0, 1],
 * then converts to pixel coordinates using canvas dimensions.
 * 
 * Reference: docs/SPEC_03_ENGINE_V2.md section 4.1
 * Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 2
 * 
 * Formulas:
 * - xNorm = 0.5 + (Alfa / 200)
 * - yNorm = 0.5 - (Beta / 200)
 * - xPx = xNorm * canvasWidth
 * - yPx = yNorm * canvasHeight
 */

import type { AxesV2, Point, Quadrant } from "../types";

/**
 * Clamps a value to [0, 1] range
 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Maps Alfa/Beta axes to normalized coordinates [0, 1] × [0, 1]
 * 
 * Reference: docs/SPEC_03_ENGINE_V2.md section 4.1
 * Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 2
 * 
 * Formulas:
 * - xNorm = 0.5 + (Alfa / 200)
 * - yNorm = 0.5 - (Beta / 200)
 * 
 * Then clamped to [0, 1]
 */
export function axesToNormalizedPosition(axes: AxesV2): { xNorm: number; yNorm: number } {
  const xNorm = clamp01(0.5 + axes.alfa / 200);
  const yNorm = clamp01(0.5 - axes.beta / 200);
  return { xNorm, yNorm };
}

/**
 * Converts normalized coordinates to pixel coordinates
 */
export function normalizedToPixel(
  xNorm: number,
  yNorm: number,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const x = clamp01(xNorm) * canvasWidth;
  const y = clamp01(yNorm) * canvasHeight;
  return { x, y };
}

/**
 * Determines which quadrant a normalized point belongs to
 * 
 * Quadrant 1: x > 0.5, y < 0.5 (top-right)
 * Quadrant 2: x < 0.5, y < 0.5 (top-left)
 * Quadrant 3: x < 0.5, y > 0.5 (bottom-left)
 * Quadrant 4: x > 0.5, y > 0.5 (bottom-right)
 * 
 * For points exactly on boundaries, we use >= for x and <= for y to handle edge cases
 */
export function getQuadrant(xNorm: number, yNorm: number): Quadrant {
  const x = clamp01(xNorm);
  const y = clamp01(yNorm);
  
  if (x >= 0.5 && y < 0.5) return 1; // top-right
  if (x < 0.5 && y < 0.5) return 2; // top-left
  if (x < 0.5 && y >= 0.5) return 3; // bottom-left
  return 4; // bottom-right (x >= 0.5 && y >= 0.5)
}

