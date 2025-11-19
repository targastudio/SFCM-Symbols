/**
 * ENGINE_V2 — Final Geometry Mirroring (patch01)
 * 
 * Implements final-geometry mirroring on connections as specified in:
 * - docs/patches/patch01_SPEC_03_mirroring_revision.md
 * - docs/patches/patch01_tasks.md
 * - docs/ENGINE_V2/ENGINE_V2_GEOMETRY_PIPELINE.md section 5
 * 
 * This replaces the old pre-line mirroring (deprecated in mirroring.ts).
 * Mirroring is now applied AFTER Gamma/Delta curve generation as a final geometry step.
 * 
 * Algorithm:
 * 1. Compute bounding box of all points (from, to, control)
 * 2. Select deterministic symmetry axis TYPE (vertical/horizontal/diagonal) based on bbox aspect ratio
 * 3. Reflect all geometry across the chosen axis, which is ALWAYS centered on the canvas (not bbox)
 * 4. Merge original + mirrored connections
 * 
 * Important: The bbox is used ONLY to determine the axis orientation (vertical/horizontal/diagonal).
 * The actual axis position is always centered on the canvas (canvasWidth/2, canvasHeight/2).
 */

import type { BranchedConnection, GeometryBoundingBox, Point } from "../types";
import { computeCurveControl } from "../svgUtils";


/**
 * Computes bounding box from all points in connections
 * Returns { minX, minY, maxX, maxY } or null if no connections
 */
export function computeBoundingBox(
  connections: BranchedConnection[],
  canvasWidth: number,
  canvasHeight: number
): GeometryBoundingBox | null {
  if (connections.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const conn of connections) {
    // Include from and to points
    minX = Math.min(minX, conn.from.x, conn.to.x);
    minY = Math.min(minY, conn.from.y, conn.to.y);
    maxX = Math.max(maxX, conn.from.x, conn.to.x);
    maxY = Math.max(maxY, conn.from.y, conn.to.y);

    // Include control point if curved
    if (conn.curved) {
      const control = computeCurveControl(conn, canvasWidth, canvasHeight);
      minX = Math.min(minX, control.cx);
      minY = Math.min(minY, control.cy);
      maxX = Math.max(maxX, control.cx);
      maxY = Math.max(maxY, control.cy);
    }
  }

  // Clamp to canvas bounds
  minX = Math.max(0, Math.min(canvasWidth, minX));
  minY = Math.max(0, Math.min(canvasHeight, minY));
  maxX = Math.max(0, Math.min(canvasWidth, maxX));
  maxY = Math.max(0, Math.min(canvasHeight, maxY));

  return { minX, minY, maxX, maxY };
}

/**
 * Determines the symmetry axis based on bounding box dimensions
 * 
 * Rules (from patch01 docs):
 * - If width > height → vertical axis (reflect horizontally)
 * - If height > width → horizontal axis (reflect vertically)
 * - If width ≈ height → diagonal axis (top-left → bottom-right)
 * 
 * Returns axis type: 'vertical' | 'horizontal' | 'diagonal'
 */
function determineAxis(
  bbox: GeometryBoundingBox
): 'vertical' | 'horizontal' | 'diagonal' {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  
  // Use a small epsilon for "approximately equal" comparison
  const epsilon = 0.01; // 1% tolerance
  
  if (Math.abs(width - height) < epsilon * Math.max(width, height)) {
    // Approximately equal → diagonal axis
    return 'diagonal';
  }
  
  if (width > height) {
    // Width dominant → vertical axis (horizontal reflection)
    return 'vertical';
  }
  
  // Height dominant → horizontal axis (vertical reflection)
  return 'horizontal';
}

/**
 * Reflects a point across a vertical axis (horizontal reflection)
 * 
 * Vertical axis goes through the center X of the canvas
 */
function reflectVertical(
  point: Point,
  canvasCenterX: number
): Point {
  return {
    x: 2 * canvasCenterX - point.x,
    y: point.y,
  };
}

/**
 * Reflects a point across a horizontal axis (vertical reflection)
 * 
 * Horizontal axis goes through the center Y of the canvas
 */
function reflectHorizontal(
  point: Point,
  canvasCenterY: number
): Point {
  return {
    x: point.x,
    y: 2 * canvasCenterY - point.y,
  };
}

/**
 * Reflects a point across a diagonal axis (top-left → bottom-right)
 * 
 * Diagonal axis passes through the canvas center (canvasWidth/2, canvasHeight/2)
 * Reflection formula: (x, y) reflected across diagonal through (cx, cy) is:
 *   reflectedX = cx + cy - y
 *   reflectedY = cx + cy - x
 * 
 * This preserves the diagonal symmetry: swapping x and y relative to the center
 */
function reflectDiagonal(
  point: Point,
  canvasCenterX: number,
  canvasCenterY: number
): Point {
  // Diagonal reflection through canvas center: (x, y) → (cx + cy - y, cx + cy - x)
  return {
    x: canvasCenterX + canvasCenterY - point.y,
    y: canvasCenterX + canvasCenterY - point.x,
  };
}

/**
 * Recomputes curvature from a control point position
 * 
 * Inverse of computeCurveControl formula:
 *   cx = mx + (to.y - from.y) * curvature
 *   cy = my - (to.x - from.x) * curvature
 * 
 * Where mx, my is the midpoint.
 * 
 * Returns curvature value clamped to [-0.8, +0.8]
 */
function curvatureFromControl(
  from: Point,
  to: Point,
  control: Point
): number {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  // Calculate curvature from control point
  // Use the more stable equation based on which component is larger
  let curvature = 0;
  
  if (Math.abs(dy) > Math.abs(dx)) {
    // Use y-component equation: cx = mx + dy * curvature
    curvature = (control.x - midX) / dy;
  } else if (Math.abs(dx) > 0) {
    // Use x-component equation: cy = my - dx * curvature
    curvature = -(control.y - midY) / dx;
  }
  
  // Clamp to [-0.8, +0.8] range (matching engine.ts)
  return Math.max(-0.8, Math.min(0.8, curvature));
}

/**
 * Computes mirroring debug information (bbox, axis type, axis segment)
 * 
 * This function computes the same information used by applyFinalMirroring
 * but does not apply the mirroring. Used for debug visualization.
 * 
 * @param connections Array of BranchedConnection objects (after Gamma/Delta generation)
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @param seed Global seed for determinism (used for axis selection if needed)
 * @returns Debug info object or null if no geometry
 */
export function computeMirroringDebugInfo(
  connections: BranchedConnection[],
  canvasWidth: number,
  canvasHeight: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _seed: string
): {
  bbox: GeometryBoundingBox;
  mirrorAxisType: "vertical" | "horizontal" | "diagonal";
  mirrorAxisSegment: { x1: number; y1: number; x2: number; y2: number };
} | null {
  if (connections.length === 0) {
    return null;
  }

  // Step 1: Compute bounding box
  const bbox = computeBoundingBox(connections, canvasWidth, canvasHeight);
  if (!bbox) {
    return null;
  }

  // Step 2: Determine symmetry axis (bbox is used ONLY for orientation decision)
  const axisType = determineAxis(bbox);
  
  // Calculate canvas center (axis position is always based on canvas, not bbox)
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;
  
  // Compute axis segment for visualization (centered on canvas)
  let mirrorAxisSegment: { x1: number; y1: number; x2: number; y2: number };

  if (axisType === 'vertical') {
    // Vertical axis: line from top to bottom through canvas center X
    mirrorAxisSegment = {
      x1: canvasCenterX,
      y1: 0,
      x2: canvasCenterX,
      y2: canvasHeight,
    };
  } else if (axisType === 'horizontal') {
    // Horizontal axis: line from left to right through canvas center Y
    mirrorAxisSegment = {
      x1: 0,
      y1: canvasCenterY,
      x2: canvasWidth,
      y2: canvasCenterY,
    };
  } else {
    // Diagonal axis: main diagonal of the canvas (top-left → bottom-right)
    // The diagonal passes through (0, 0) and (canvasWidth, canvasHeight)
    // This is the main diagonal of the canvas, which naturally goes through the center
    mirrorAxisSegment = {
      x1: 0,
      y1: 0,
      x2: canvasWidth,
      y2: canvasHeight,
    };
  }

  return {
    bbox,
    mirrorAxisType: axisType,
    mirrorAxisSegment,
  };
}

/**
 * Applies final geometry mirroring to connections
 * 
 * This is the main public API for patch01 final mirroring.
 * 
 * @param connections Array of BranchedConnection objects (after Gamma/Delta generation)
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @param seed Global seed for determinism (used for axis selection if needed)
 * @returns Array of original + mirrored connections
 */
export function applyFinalMirroring(
  connections: BranchedConnection[],
  canvasWidth: number,
  canvasHeight: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _seed: string
): BranchedConnection[] {
  if (connections.length === 0) {
    return [];
  }

  // Step 1: Compute bounding box
  const bbox = computeBoundingBox(connections, canvasWidth, canvasHeight);
  if (!bbox) {
    return connections; // No geometry to mirror
  }

  // Step 2: Determine symmetry axis (bbox is used ONLY for orientation decision)
  const axisType = determineAxis(bbox);
  
  // Calculate canvas center (axis position is always based on canvas, not bbox)
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;

  // Step 3 & 4: Reflect all connections and merge
  const mirrored: BranchedConnection[] = [];

  for (const conn of connections) {
    // Reflect from and to points
    let mirroredFrom: Point;
    let mirroredTo: Point;

    if (axisType === 'vertical') {
      mirroredFrom = reflectVertical(conn.from, canvasCenterX);
      mirroredTo = reflectVertical(conn.to, canvasCenterX);
    } else if (axisType === 'horizontal') {
      mirroredFrom = reflectHorizontal(conn.from, canvasCenterY);
      mirroredTo = reflectHorizontal(conn.to, canvasCenterY);
    } else {
      // diagonal
      mirroredFrom = reflectDiagonal(conn.from, canvasCenterX, canvasCenterY);
      mirroredTo = reflectDiagonal(conn.to, canvasCenterX, canvasCenterY);
    }

    // Reflect control point if curved
    let mirroredCurvature = conn.curvature;
    if (conn.curved) {
      const originalControlObj = computeCurveControl(conn, canvasWidth, canvasHeight);
      // Convert { cx, cy } to { x, y } Point format
      const originalControl: Point = {
        x: originalControlObj.cx,
        y: originalControlObj.cy,
      };
      let mirroredControl: Point;

      if (axisType === 'vertical') {
        mirroredControl = reflectVertical(originalControl, canvasCenterX);
      } else if (axisType === 'horizontal') {
        mirroredControl = reflectHorizontal(originalControl, canvasCenterY);
      } else {
        // diagonal
        mirroredControl = reflectDiagonal(originalControl, canvasCenterX, canvasCenterY);
      }

      // Recompute curvature for mirrored curve
      mirroredCurvature = curvatureFromControl(mirroredFrom, mirroredTo, mirroredControl);
    }

    // Create mirrored connection
    const mirroredConn: BranchedConnection = {
      from: mirroredFrom,
      to: mirroredTo,
      curved: conn.curved,
      curvature: mirroredCurvature,
      dashed: conn.dashed,
      semanticInfluence: conn.semanticInfluence,
      generationDepth: conn.generationDepth,
      generatedFrom: conn.generatedFrom,
    };

    mirrored.push(mirroredConn);
  }

  // Merge original + mirrored connections
  return [...connections, ...mirrored];
}

