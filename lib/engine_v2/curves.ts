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
 * - Direction: 0° to 180° with clustering (see getLineDirection)
 * - Length: 15% to 50% of canvas diagonal (see getLineLength)
 * 
 * Delta controls:
 * - Curvature magnitude: 5% to 30% of line length (see applyDeltaIrregularity)
 */

import type { AxesV2, Point, Quadrant, DirectionClusterDebug } from "../types";
import { prng, seededRandom } from "../seed";

// Constants from ENGINE_V2_GEOMETRY_PIPELINE.md section 5
const NUM_LINES_MIN = 1; // Minimum number of lines per point
const NUM_LINES_MAX = 7; // Maximum number of lines per point
// Direction clustering constants (patch03)
const LINE_LENGTH_MIN_FRAC = 0.15; // 15% of canvas diagonal
const LINE_LENGTH_MAX_FRAC = 0.50; // 50% of canvas diagonal

// Constants from ENGINE_V2_GEOMETRY_PIPELINE.md section 4
const DELTA_CURVATURE_MIN_FRAC = 0.05; // 5% of line length (minimum curvature)
const DELTA_CURVATURE_MAX_FRAC = 0.30; // 30% of line length (maximum curvature)
const DELTA_CURVATURE_JITTER_RANGE = 0.2; // ±20% jitter on curvature magnitude


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
 * Determines line direction (angle) based on Gamma with clustering
 * 
 * Reference: docs/patches/patch_03_Direction_Clustering.md
 * Angle range: 0° to 180° (patch03: changed from -45° to +45°)
 * Lines are grouped into clusters of similar directions
 * 
 * @param gamma Gamma axis value [-100, +100]
 * @param seed Global seed for deterministic generation
 * @param lineIndex Index of the line (0 to numLines-1)
 * @param clusterCount Number of direction clusters (default: 3)
 * @param clusterSpread Spread angle within each cluster in degrees (default: 30)
 * @returns Direction angle in degrees [0, 180]
 */
export function getLineDirection(
  gamma: number,
  seed: string,
  lineIndex: number,
  clusterCount: number = 3,
  clusterSpread: number = 30
): number {
  // Determine which cluster this line belongs to
  const clusterIndex = Math.floor(seededRandom(`${seed}:cluster:${lineIndex}`) * clusterCount);
  
  // Central angle of the cluster (distributed evenly across 0-180°)
  const clusterAngle = (clusterIndex / clusterCount) * 180;
  
  // Gamma rotates all clusters
  const gammaRotation = (gamma / 100) * 180;
  
  // Variation within the cluster
  const inClusterJitter = (seededRandom(`${seed}:jitter:${lineIndex}`) - 0.5) * clusterSpread;
  
  // Final angle: cluster angle + gamma rotation + jitter, clamped to [0, 180]
  const finalAngle = (clusterAngle + gammaRotation + inClusterJitter) % 180;
  
  // Ensure angle is in [0, 180] range
  return Math.max(0, Math.min(180, finalAngle));
}

/**
 * Determines line direction with debug information (patch03)
 * 
 * Same as getLineDirection but also returns debug information for visualization.
 * 
 * @param gamma Gamma axis value [-100, +100]
 * @param seed Global seed for deterministic generation
 * @param lineIndex Index of the line (0 to numLines-1)
 * @param clusterCount Number of direction clusters (default: 3)
 * @param clusterSpread Spread angle within each cluster in degrees (default: 30)
 * @returns Object with direction and debug information
 */
export function getLineDirectionWithDebug(
  gamma: number,
  seed: string,
  lineIndex: number,
  clusterCount: number = 3,
  clusterSpread: number = 30
): {
  direction: number;
  debug: {
    clusterIndex: number;
    clusterAngle: number;
    gammaRotation: number;
    finalClusterAngle: number;
    inClusterJitter: number;
    finalDirection: number;
  };
} {
  // Determine which cluster this line belongs to
  const clusterIndex = Math.floor(seededRandom(`${seed}:cluster:${lineIndex}`) * clusterCount);
  
  // Central angle of the cluster (distributed evenly across 0-180°)
  const clusterAngle = (clusterIndex / clusterCount) * 180;
  
  // Gamma rotates all clusters
  const gammaRotation = (gamma / 100) * 180;
  
  // Final cluster angle after Gamma rotation
  const finalClusterAngle = (clusterAngle + gammaRotation) % 180;
  
  // Variation within the cluster
  const inClusterJitter = (seededRandom(`${seed}:jitter:${lineIndex}`) - 0.5) * clusterSpread;
  
  // Final angle: cluster angle + gamma rotation + jitter, clamped to [0, 180]
  const finalAngle = (clusterAngle + gammaRotation + inClusterJitter) % 180;
  const finalDirection = Math.max(0, Math.min(180, finalAngle));
  
  return {
    direction: finalDirection,
    debug: {
      clusterIndex,
      clusterAngle,
      gammaRotation,
      finalClusterAngle,
      inClusterJitter,
      finalDirection,
    },
  };
}

/**
 * Computes a per-line length profile multiplier for patch04.
 *
 * Uses a predefined set of length profiles and deterministic PRNG
 * based on seed, pointIndex, lineIndex, clusterIndex and clusterCount.
 *
 * Example profiles (5-step, more varied, DRAMATIC):
 * - 0.5  → very short
 * - 0.8  → short
 * - 1.0  → medium
 * - 1.3  → long
 * - 1.8  → very long
 */
function computeLengthProfileMultiplier(
  seed: string,
  pointIndex: number,
  lineIndex: number,
  clusterIndex: number,
  clusterCount: number
): number {
  const lengthProfiles = [0.5, 0.8, 1.0, 1.3, 1.8];
  const rngValue = seededRandom(
    `${seed}:lenProfile:${pointIndex}:${lineIndex}:${clusterIndex}:${clusterCount}`
  );
  const rawIndex = Math.floor(rngValue * lengthProfiles.length);
  const clampedIndex = Math.max(0, Math.min(lengthProfiles.length - 1, rawIndex));
  return lengthProfiles[clampedIndex];
}

/**
 * Computes a per-line curvature profile multiplier for patch04.
 *
 * Uses a predefined set of curvature profiles and deterministic PRNG
 * based on seed, pointIndex, lineIndex, clusterIndex and clusterCount.
 *
 * Optionally applies an inverse correlation with the length profile:
 * - Shorter lines (lengthProfile < 1) → slightly higher curvature
 * - Longer lines (lengthProfile > 1)  → slightly lower curvature
 */
function computeCurvatureProfileMultiplier(
  seed: string,
  pointIndex: number,
  lineIndex: number,
  clusterIndex: number,
  clusterCount: number,
  lengthProfile?: number
): number {
  const curvatureProfiles = [0.4, 0.75, 1.0, 1.5, 2.0];
  const rngValue = seededRandom(
    `${seed}:curvProfile:${pointIndex}:${lineIndex}:${clusterIndex}:${clusterCount}`
  );
  const rawIndex = Math.floor(rngValue * curvatureProfiles.length);
  const clampedIndex = Math.max(0, Math.min(curvatureProfiles.length - 1, rawIndex));
  const baseProfile = curvatureProfiles[clampedIndex];

  if (lengthProfile !== undefined) {
    // Inverse correlation: shorter lines → slightly more curvature,
    // longer lines → slightly less curvature.
    const correlationFactor = 1.0 + (1.0 - lengthProfile) * 0.5;
    return baseProfile * correlationFactor;
  }

  return baseProfile;
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
 * @param dispersionRadius Fraction of canvas diagonal for dispersion radius (default: 0.02 = 2%)
 * @returns A point deterministically dispersed around the base point
 */
function generateDispersedStartPoint(
  basePoint: Point,
  seed: string,
  lineIndex: number,
  pointIndex: number,
  canvasWidth: number,
  canvasHeight: number,
  dispersionRadius: number = 0.02 // 2% of diagonal by default
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
  } catch {
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
 * @param clusterCount Number of direction clusters (default: 3)
 * @param clusterSpread Spread angle within each cluster in degrees (default: 30)
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
  curvatureScale: number = 1.0,
  clusterCount: number = 3,
  clusterSpread: number = 30
): {
  curves: Array<{
    start: Point;
    control: Point;
    end: Point;
    keyword: string;
    quadrant: Quadrant;
    isMirrored: boolean;
  }>;
  directionClusters: DirectionClusterDebug[];
} {
  const numLines = getNumberOfLines(axes.gamma);
  const curves: Array<{
    start: Point;
    control: Point;
    end: Point;
    keyword: string;
    quadrant: Quadrant;
    isMirrored: boolean;
  }> = [];
  const directionClusters: DirectionClusterDebug[] = [];

  for (let i = 0; i < numLines; i++) {
    // MODIFIED BEHAVIOR (patch_02 refinement):
    // - First line (i === 0): uses exact base point from Alfa/Beta (no dispersion)
    // - Subsequent lines (i > 0): use dispersed points around base point (original patch_02 behavior)
    // This maintains visual correspondence between anchor point and geometry
    // Reference: docs/patches/patch_02_Point_Dispersion_at_Line_Origin.md
    const dispersedStart = i === 0
      ? start // First line: exact anchor point (no dispersion)
      : generateDispersedStartPoint(
          start, // base point (from Alfa/Beta)
          seed,
          i, // line index
          pointIndex,
          canvasWidth,
          canvasHeight,
          0.02 // 2% of diagonal dispersion radius
        );

    // Get direction for this line with clustering (patch03)
    // Use getLineDirectionWithDebug to capture debug information
    const { direction, debug: directionDebug } = getLineDirectionWithDebug(
      axes.gamma,
      seed,
      i, // line index
      clusterCount,
      clusterSpread
    );
    const clusterIndex = directionDebug.clusterIndex;

    // PATCH04: compute per-line length profile multiplier
    const lengthProfile = computeLengthProfileMultiplier(
      seed,
      pointIndex,
      i, // lineIndex
      clusterIndex,
      clusterCount
    );

    // Get base length (Gamma + Slider1) and apply length profile
    const baseLength = getLineLength(
      axes.gamma,
      canvasWidth,
      canvasHeight,
      seed,
      pointIndex * 10 + i,
      lengthScale
    );
    const profiledLength = baseLength * lengthProfile;

    // PATCH04: compute per-line curvature profile multiplier with inverse correlation
    const curvatureProfile = computeCurvatureProfileMultiplier(
      seed,
      pointIndex,
      i, // lineIndex
      clusterIndex,
      clusterCount,
      lengthProfile
    );
    const profiledCurvatureScale = curvatureScale * curvatureProfile;

    // Store debug information for this line, including profile multipliers
    directionClusters.push({
      ...directionDebug,
      lengthProfile,
      curvatureProfile,
    });

    // Convert direction from degrees to radians
    const angleRad = (direction * Math.PI) / 180;

    // Calculate end point (from dispersed start) using profiled length
    const endX = dispersedStart.x + Math.cos(angleRad) * profiledLength;
    const endY = dispersedStart.y + Math.sin(angleRad) * profiledLength;
    const end = clampToCanvas(endX, endY, canvasWidth, canvasHeight);

    // Base control point is at midpoint (between dispersed start and end)
    const baseControl: Point = {
      x: (dispersedStart.x + end.x) / 2,
      y: (dispersedStart.y + end.y) / 2,
    };

    // Apply Delta irregularity to control point using profiled length and curvature
    const control = applyDeltaIrregularity(
      axes.delta,
      dispersedStart, // Use dispersed start point
      end,
      baseControl,
      profiledLength,
      seed,
      pointIndex * 10 + i,
      profiledCurvatureScale
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

  return {
    curves,
    directionClusters,
  };
}
