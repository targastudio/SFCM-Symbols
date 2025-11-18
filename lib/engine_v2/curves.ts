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
 * Generates a deterministically dispersed start point around a base point
 * 
 * Reference: docs/patches/patch_02_Point_Dispersion_at_Line_Origin.md
 * 
 * Creates a point randomly distributed in a circle around the base point.
 * The distribution is uniform in circle area (not uniform in radius).
 * 
 * @param basePoint The base point (from Alfa/Beta axes)
 * @param seed Global seed for deterministic generation
 * @param lineIndex Index of the line (0 to numLines-1)
 * @param pointIndex Index of the keyword/point
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @param dispersionRadius Fraction of canvas diagonal for dispersion radius (default: 0.08 = 8%)
 * @returns A point deterministically dispersed around the base point
 */
function generateDispersedStartPoint(
  basePoint: Point,
  seed: string,
  lineIndex: number,
  pointIndex: number,
  canvasWidth: number,
  canvasHeight: number,
  dispersionRadius: number = 0.08 // 8% of diagonal by default
): Point {
  // Safety checks: if canvas dimensions are invalid, return base point
  if (!canvasWidth || !canvasHeight || canvasWidth <= 0 || canvasHeight <= 0) {
    return basePoint;
  }
  
  // Safety check: if basePoint is invalid, return it as-is
  if (!isFinite(basePoint.x) || !isFinite(basePoint.y)) {
    return basePoint;
  }
  
  // Safety check: if seed is invalid, return base point
  if (!seed || typeof seed !== 'string') {
    return basePoint;
  }
  
  // Safety check: if indices are invalid, return base point
  if (!isFinite(lineIndex) || !isFinite(pointIndex)) {
    return basePoint;
  }
  
  // Calculate canvas diagonal
  const diagonal = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
  
  // Safety check: if diagonal is invalid, return base point
  if (!isFinite(diagonal) || diagonal <= 0) {
    return basePoint;
  }
  
  // Calculate dispersion radius in pixels
  const radius = diagonal * dispersionRadius;
  
  // Safety check: if radius is too small or invalid, return base point
  if (!isFinite(radius) || radius <= 0) {
    return basePoint;
  }
  
  // Generate deterministic PRNG for this specific line
  try {
    const rng = prng(`${seed}:disperse:${pointIndex}:${lineIndex}`);
  
    // Generate random angle (0 to 2π)
    const rngValue1 = rng();
    if (!isFinite(rngValue1) || rngValue1 < 0 || rngValue1 > 1) {
      return basePoint; // Safety fallback
    }
    const angle = rngValue1 * 2 * Math.PI;
    
    // Generate random distance (uniform in circle area)
    // Using Math.sqrt(rng()) ensures uniform distribution in circle area
    // (not uniform in radius, which would cluster points near center)
    const rngValue2 = rng();
    if (!isFinite(rngValue2) || rngValue2 < 0 || rngValue2 > 1) {
      return basePoint; // Safety fallback
    }
    const distance = Math.sqrt(rngValue2) * radius;
    
    // Calculate dispersed point
    const x = basePoint.x + Math.cos(angle) * distance;
    const y = basePoint.y + Math.sin(angle) * distance;
    
    // Safety check: ensure calculated values are finite
    if (!isFinite(x) || !isFinite(y)) {
      return basePoint;
    }
    
    // Clamp to canvas bounds
    return clampToCanvas(x, y, canvasWidth, canvasHeight);
  } catch (error) {
    // If PRNG generation fails, return base point silently
    // This ensures the app continues to work even if dispersion fails
    return basePoint;
  }
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
 * - curvatureScale multiplies the final offset magnitude (0.3-1.7 range)
 */
export function applyDeltaIrregularity(
  delta: number,
  start: Point,
  end: Point,
  baseControl: Point,
  lineLength: number,
  seed: string,
  pointIndex: number,
  curvatureScale: number = 1.0
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
  // Apply curvatureScale multiplier to curve intensity
  const offsetMag = curvFrac * len * curvatureScale;

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
 * @param curvatureScale Optional multiplier for curve intensity (default: 1.0)
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
  lengthScale: number = 1.0,
  curvatureScale: number = 1.0
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
    // Generate a deterministically dispersed start point for this line
    // This creates variation: each line from the same keyword starts from a slightly different point
    // Reference: docs/patches/patch_02_Point_Dispersion_at_Line_Origin.md
    const dispersedStart = generateDispersedStartPoint(
      start, // base point (from Alfa/Beta)
      seed,
      i, // line index
      pointIndex,
      canvasWidth,
      canvasHeight,
      0.08 // 8% of diagonal dispersion radius
    );

    // Get direction and length for this line (using dispersed start point)
    const direction = getLineDirection(axes.gamma, dispersedStart.x, dispersedStart.y, `${seed}:line:${i}`);
    const length = getLineLength(axes.gamma, canvasWidth, canvasHeight, seed, pointIndex * 10 + i, lengthScale);

    // Convert direction from degrees to radians
    const angleRad = (direction * Math.PI) / 180;

    // Calculate end point (from dispersed start)
    const endX = dispersedStart.x + Math.cos(angleRad) * length;
    const endY = dispersedStart.y + Math.sin(angleRad) * length;
    const end = clampToCanvas(endX, endY, canvasWidth, canvasHeight);

    // Base control point is at midpoint (between dispersed start and end)
    const baseControl: Point = {
      x: (dispersedStart.x + end.x) / 2,
      y: (dispersedStart.y + end.y) / 2,
    };

    // Apply Delta irregularity to control point
    const control = applyDeltaIrregularity(
      axes.delta,
      dispersedStart, // Use dispersed start point
      end,
      baseControl,
      length,
      seed,
      pointIndex * 10 + i,
      curvatureScale
    );

    // Clamp control point to canvas
    const clampedControl = clampToCanvas(control.x, control.y, canvasWidth, canvasHeight);

    curves.push({
      start: dispersedStart, // Use dispersed start point
      control: clampedControl,
      end,
      keyword: "", // Will be set by caller
      quadrant,
      isMirrored,
    });
  }

  return curves;
}

