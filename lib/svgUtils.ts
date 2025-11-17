/**
 * SVG Rendering Utilities
 * 
 * Shared utilities for SVG rendering that are independent of the generation engine.
 * These functions work with the BranchedConnection type used by both ENGINE_V1 and ENGINE_V2.
 */

import type { Connection, Point } from "./types";

/**
 * Clamps a point to stay within exact canvas bounds [0, canvasWidth] × [0, canvasHeight].
 * 
 * @param x X coordinate
 * @param y Y coordinate
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Clamped point { x, y } within [0, canvasWidth] × [0, canvasHeight]
 */
export function clampToCanvas(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number
): Point {
  return {
    x: Math.max(0, Math.min(canvasWidth, x)),
    y: Math.max(0, Math.min(canvasHeight, y)),
  };
}

/**
 * Computes the control point for a quadratic Bézier curve from a Connection's curvature value.
 * 
 * Formula:
 *   cx = mx + (to.y - from.y) * curvature
 *   cy = my - (to.x - from.x) * curvature
 * Where mx, my is the midpoint between from and to.
 * 
 * This is used by SvgPreview to render curved connections.
 * The control point is clamped to canvas bounds to prevent curves from extending outside the canvas.
 * 
 * @param c Connection with from, to, and curvature values
 * @param canvasWidth Optional canvas width for clamping
 * @param canvasHeight Optional canvas height for clamping
 * @returns Control point { cx, cy } for the quadratic Bézier curve
 */
export function computeCurveControl(
  c: Connection,
  canvasWidth?: number,
  canvasHeight?: number
): { cx: number; cy: number } {
  const mx = (c.from.x + c.to.x) / 2;
  const my = (c.from.y + c.to.y) / 2;
  let cx = mx + (c.to.y - c.from.y) * c.curvature;
  let cy = my - (c.to.x - c.from.x) * c.curvature;
  
  // Clamp control point to canvas bounds if dimensions provided
  // This prevents curves from extending outside the canvas area
  if (canvasWidth !== undefined && canvasHeight !== undefined) {
    const clamped = clampToCanvas(cx, cy, canvasWidth, canvasHeight);
    cx = clamped.x;
    cy = clamped.y;
  }
  
  return { cx, cy };
}

