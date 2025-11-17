/**
 * ENGINE_V2 — Curve Generation
 * 
 * Implements Gamma (number, direction, length) and Delta (curvature, jitter)
 * to generate quadratic curves from points.
 * 
 * Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md sections 3-4
 * 
 * Gamma controls:
 * - Number of lines: 1-7 (see getNumberOfLines)
 * - Direction: -45° to +45° (see getLineDirection)
 * - Length: 15% to 50% of canvas diagonal (see getLineLength)
 * 
 * Delta controls:
 * - Curvature magnitude: 5% to 30% of line length (see applyDeltaIrregularity)
 */

import type { AxesV2, Point, Quadrant } from "../types";
import { prng } from "../seed";

// Constants from ENGINE_V2_GEOMETRY_PIPELINE.md section 5
const GAMMA_NORMALIZED_MIN = -100; // Gamma range minimum
const GAMMA_NORMALIZED_MAX = 100; // Gamma range maximum
const GAMMA_NORMALIZED_RANGE = 200; // Gamma range span (max - min)
const NUM_LINES_MIN = 1; // Minimum number of lines per point
const NUM_LINES_MAX = 7; // Maximum number of lines per point
const DIRECTION_ANGLE_MIN = -45; // Minimum direction angle in degrees
const DIRECTION_ANGLE_MAX = 45; // Maximum direction angle in degrees
const LINE_LENGTH_MIN_FRAC = 0.15; // 15% of canvas diagonal
const LINE_LENGTH_MAX_FRAC = 0.50; // 50% of canvas diagonal
const DIRECTION_JITTER_RANGE = 10; // ±5 degrees jitter

// Constants from ENGINE_V2_GEOMETRY_PIPELINE.md section 4
const DELTA_CURVATURE_MIN_FRAC = 0.05; // 5% of line length (minimum curvature)
const DELTA_CURVATURE_MAX_FRAC = 0.30; // 30% of line length (maximum curvature)
const DELTA_CURVATURE_JITTER_RANGE = 0.2; // ±20% jitter on curvature magnitude

/**
 * Clamps a value to [0, 1] range
 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Clamps a point to stay within exact canvas bounds
 */
function clampToCanvas(
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
 * Determines number of lines to generate from a point based on Gamma
 * 
 * Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 3
 * Formula: t = Math.min(1, Math.abs(gamma) / 100)
 *          lineCount = 1 + Math.round(t * 6)
 * 
 * This gives: 1-7 lines
 * - Gamma ≈ 0    → lineCount ≈ 1
 * - Gamma ≈ ±50  → lineCount ≈ 4
 * - Gamma ≈ ±100 → lineCount = 7
 */
export function getNumberOfLines(gamma: number): number {
  const g = Math.abs(gamma); // [0, 100]
  const t = Math.min(1, g / 100); // [0, 1]
  const lineCount = NUM_LINES_MIN + Math.round(t * (NUM_LINES_MAX - NUM_LINES_MIN));
  return Math.max(NUM_LINES_MIN, Math.min(NUM_LINES_MAX, lineCount));
}

/**
 * Determines line direction (angle) based on Gamma
 * 
 * Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 5
 * Angle range: -45° to +45° (diagonal orientation from center)
 * Uses deterministic RNG based on seed and point position
 */
export function getLineDirection(
  gamma: number,
  startX: number,
  startY: number,
  seed: string
): number {
  // Base angle: map gamma [-100, +100] to [-45°, +45°]
  const normalized = (gamma - GAMMA_NORMALIZED_MIN) / GAMMA_NORMALIZED_RANGE; // [0, 1]
  const baseAngle = DIRECTION_ANGLE_MIN + normalized * (DIRECTION_ANGLE_MAX - DIRECTION_ANGLE_MIN);

  // Add small deterministic jitter based on position and seed
  const rng = prng(`${seed}:direction:${startX}:${startY}`);
  const jitter = (rng() - 0.5) * DIRECTION_JITTER_RANGE; // ±(DIRECTION_JITTER_RANGE/2) degrees

  return baseAngle + jitter;
}

/**
 * Determines line length based on Gamma and canvas dimensions
 * 
 * Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 3
 * Length range: 25% to 60% of canvas diagonal (via |Gamma|)
 * Uses deterministic RNG for small variations
 * 
 * @param lengthScale Optional multiplier for line length (default: 1.0)
 */
export function getLineLength(
  gamma: number,
  canvasWidth: number,
  canvasHeight: number,
  seed: string,
  pointIndex: number,
  lengthScale: number = 1.0
): number {
  // Calculate canvas diagonal
  const diag = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
  
  // Map |gamma| [0, 100] to length fraction [0.15, 0.50] of diagonal
  const g = Math.abs(gamma); // [0, 100]
  const t = Math.min(1, g / 100); // [0, 1]
  const frac = LINE_LENGTH_MIN_FRAC + t * (LINE_LENGTH_MAX_FRAC - LINE_LENGTH_MIN_FRAC); // [0.15, 0.50]
  const baseLength = frac * diag;

  // Add small deterministic variation (±5%)
  const rng = prng(`${seed}:length:${pointIndex}`);
  const variation = (rng() - 0.5) * 0.1; // ±5% variation

  // Apply lengthScale multiplier
  return baseLength * (1 + variation) * lengthScale;
}

/**
 * Applies Delta-based irregularity (curvature and jitter) to curve control point
 * 
 * Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 4
 * Delta controls curvature magnitude: 5% to 30% of line length
 * 
 * Algorithm:
 * - Delta ≈ 0 → almost straight lines (curvature ~5% of length)
 * - |Delta| large → clearly curved lines (curvature ~30% of length)
 * - Uses perpendicular offset from midpoint with deterministic jitter
 */
export function applyDeltaIrregularity(
  delta: number,
  start: Point,
  end: Point,
  baseControl: Point,
  lineLength: number,
  seed: string,
  pointIndex: number
): Point {
  // Calculate line segment vector and length
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  // If line has zero length, return midpoint as-is
  if (len === 0) {
    return baseControl;
  }

  // Compute normalized perpendicular vector (90° rotation, normalized)
  // Perpendicular to (dx, dy) is (-dy, dx) or (dy, -dx)
  // We'll use (-dy, dx) normalized
  const perpX = -dy / len;
  const perpY = dx / len;

  // Map |delta| [0, 100] to curvature fraction [0.05, 0.30] of line length
  const d = Math.min(1, Math.abs(delta) / 100); // [0, 1]
  const curvMin = DELTA_CURVATURE_MIN_FRAC; // 0.05 (5% of length)
  const curvMax = DELTA_CURVATURE_MAX_FRAC; // 0.30 (30% of length)
  const baseCurvFrac = curvMin + (curvMax - curvMin) * d; // [0.05, 0.30]

  // Add deterministic jitter to curvature magnitude (±20%)
  const rng = prng(`${seed}:delta:curv:${pointIndex}:${start.x}:${start.y}`);
  const jitter = (rng() - 0.5) * DELTA_CURVATURE_JITTER_RANGE; // [-0.2, +0.2]
  const curvFrac = baseCurvFrac * (1 + jitter);

  // Calculate offset magnitude
  const offsetMag = curvFrac * len;

  // Determine direction: use sign of delta, with optional jitter-based variation
  // Use a separate RNG for direction to keep it deterministic but independent
  const dirRng = prng(`${seed}:delta:dir:${pointIndex}:${start.x}:${start.y}`);
  const dirSign = delta >= 0 ? 1 : -1;
  // Optionally flip direction based on jitter (50% chance) for more variation
  const finalDir = dirRng() < 0.5 ? dirSign : -dirSign;

  // Apply perpendicular offset to midpoint
  const offsetX = perpX * offsetMag * finalDir;
  const offsetY = perpY * offsetMag * finalDir;

  return {
    x: baseControl.x + offsetX,
    y: baseControl.y + offsetY,
  };
}

/**
 * Generates a quadratic curve from a start point
 * 
 * Uses Gamma for number, direction, and length
 * Uses Delta for curvature/jitter
 * 
 * @param lengthScale Optional multiplier for line length (default: 1.0)
 */
export function generateCurveFromPoint(
  start: Point,
  axes: AxesV2,
  canvasWidth: number,
  canvasHeight: number,
  seed: string,
  pointIndex: number,
  quadrant: Quadrant,
  isMirrored: boolean,
  lengthScale: number = 1.0
): Array<{
  start: Point;
  control: Point;
  end: Point;
  keyword: string;
  quadrant: Quadrant;
  isMirrored: boolean;
}> {
  const numLines = getNumberOfLines(axes.gamma);
  const curves: Array<{
    start: Point;
    control: Point;
    end: Point;
    keyword: string;
    quadrant: Quadrant;
    isMirrored: boolean;
  }> = [];

  for (let i = 0; i < numLines; i++) {
    // Get direction and length for this line
    const direction = getLineDirection(axes.gamma, start.x, start.y, `${seed}:line:${i}`);
    const length = getLineLength(axes.gamma, canvasWidth, canvasHeight, seed, pointIndex * 10 + i, lengthScale);

    // Convert direction from degrees to radians
    const angleRad = (direction * Math.PI) / 180;

    // Calculate end point
    const endX = start.x + Math.cos(angleRad) * length;
    const endY = start.y + Math.sin(angleRad) * length;
    const end = clampToCanvas(endX, endY, canvasWidth, canvasHeight);

    // Base control point is at midpoint
    const baseControl: Point = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };

    // Apply Delta irregularity to control point
    const control = applyDeltaIrregularity(
      axes.delta,
      start,
      end,
      baseControl,
      length,
      seed,
      pointIndex * 10 + i
    );

    // Clamp control point to canvas
    const clampedControl = clampToCanvas(control.x, control.y, canvasWidth, canvasHeight);

    curves.push({
      start,
      control: clampedControl,
      end,
      keyword: "", // Will be set by caller
      quadrant,
      isMirrored,
    });
  }

  return curves;
}

