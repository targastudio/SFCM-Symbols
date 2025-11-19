/**
 * ENGINE_V2 — Main Engine
 * 
 * Orchestrates the complete ENGINE_V2 pipeline as specified in:
 * - docs/SPEC_03_ENGINE_V2.md section 4.2
 * - docs/ENGINE_V2_GEOMETRY_PIPELINE.md
 * - docs/patches/patch01_SPEC_03_mirroring_revision.md (patch01: final mirroring)
 * 
 * Pipeline order (must match docs exactly):
 * 1. Keyword → 4 Axes (Alfa, Beta, Gamma, Delta) via axes.ts
 * 2. Alfa/Beta → Normalized coordinates → Pixel coordinates via position.ts
 * 3. Apply Gamma (number, direction, length) and Delta (curvature, jitter) via curves.ts
 * 4. Convert to BranchedConnection format for rendering
 * 5. Final geometry mirroring (patch01) via finalMirroring.ts - applied AFTER curve generation
 * 6. Branching from intersections (Branching_beta01) via branching.ts - applied AFTER mirroring
 * 
 * Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md for complete pipeline specification
 * Reference: docs/patches/patch01_SPEC_03_mirroring_revision.md for mirroring revision
 */

import type {
  AxesV2,
  BranchedConnection,
  EngineV2DebugInfo,
  GeometryBoundingBox,
  KeywordAnchorDebug,
  Point,
} from "../types";
import {
  getAxesForKeywordV2,
  getSemanticMapV2,
} from "./axes";
import { axesToNormalizedPosition, normalizedToPixel, getQuadrant } from "./position";
import { generateCurveFromPoint } from "./curves";
import { applyFinalMirroring, computeMirroringDebugInfo, computeBoundingBox } from "./finalMirroring";
import { applyBranching } from "./branching";
import { rotateConnectionsClockwise, shouldRotateGeometry } from "./geometryRotation";

/**
 * ENGINE_V2 options type
 * 
 * Contains optional parameters for ENGINE_V2 generation.
 */
type EngineV2Options = {
  lengthScale?: number; // Multiplier for line length (default: 1.0)
  curvatureScale?: number; // Multiplier for curve intensity (default: 1.0)
  clusterCount?: number; // Number of direction clusters (default: 3)
  clusterSpread?: number; // Spread angle within each cluster in degrees (default: 30)
  forceOrientation?: boolean; // Feature3 toggle for geometry rotation
};

/**
 * ENGINE_V2 result type
 * 
 * Contains the generated connections and optional debug information.
 * The debug field is only populated for debugging/development purposes.
 */
type EngineV2Result = {
  connections: BranchedConnection[];
  debug?: EngineV2DebugInfo;
};

/**
 * Converts an ENGINE_V2 curve to a BranchedConnection for rendering
 * 
 * ENGINE_V2 always produces quadratic curves, so we set:
 * - curved: true
 * - curvature: calculated from control point position
 * - dashed: false (not used in ENGINE_V2)
 * - generationDepth: 0 (all curves are primary, no hierarchy)
 */
function curveToBranchedConnection(
  curve: {
    start: Point;
    control: Point;
    end: Point;
    keyword: string;
    quadrant: number;
    isMirrored: boolean;
  }
): BranchedConnection {
  // Calculate curvature value that will produce the same control point in computeCurveControl
  // The formula in computeCurveControl is:
  //   cx = mx + (to.y - from.y) * curvature
  //   cy = my - (to.x - from.x) * curvature
  // Where mx, my is the midpoint
  
  const midX = (curve.start.x + curve.end.x) / 2;
  const midY = (curve.start.y + curve.end.y) / 2;
  const dx = curve.end.x - curve.start.x;
  const dy = curve.end.y - curve.start.y;
  
  // Calculate curvature from the actual control point
  // We have two equations, use the one that's more stable
  let curvature = 0;
  
  if (Math.abs(dy) > Math.abs(dx)) {
    // Use y-component equation: cx = mx + dy * curvature
    curvature = (curve.control.x - midX) / dy;
  } else if (Math.abs(dx) > 0) {
    // Use x-component equation: cy = my - dx * curvature
    curvature = -(curve.control.y - midY) / dx;
  }
  
  // Clamp to [-0.8, +0.8] range (matching old system)
  curvature = Math.max(-0.8, Math.min(0.8, curvature));

  return {
    from: curve.start,
    to: curve.end,
    curved: true, // ENGINE_V2 always uses curves
    curvature,
    dashed: false, // ENGINE_V2 doesn't use dashed lines
    semanticInfluence: {}, // Not used in ENGINE_V2
    generationDepth: 0, // All curves are primary (no hierarchy)
  };
}

/**
 * Main ENGINE_V2 generation function
 * 
 * @param keywords List of keywords (max 10)
 * @param seed Global seed for deterministic generation
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @param includeDebug Optional: if true, includes debug information in result
 * @param options Optional: ENGINE_V2 options (lengthScale, etc.)
 * @returns EngineV2Result with connections and optional debug info
 */
export async function generateEngineV2(
  keywords: string[],
  seed: string,
  canvasWidth: number,
  canvasHeight: number,
  includeDebug: boolean = false,
  options: EngineV2Options = {}
): Promise<EngineV2Result> {
  // Normalize options with defaults
  const lengthScale = options.lengthScale ?? 1.0;
  const curvatureScale = options.curvatureScale ?? 1.0;
  const clusterCount = options.clusterCount ?? 3;
  const clusterSpread = options.clusterSpread ?? 30;
  const forceOrientation = options.forceOrientation ?? false;
  if (keywords.length === 0) {
    return { connections: [] };
  }

  // Limit to max 10 keywords
  const limitedKeywords = keywords.slice(0, 10);

  // Step 1: Keyword → 4 Axes
  // Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 1
  // Reference: docs/ENGINE_V2_SEMANTIC_MAP.md section 3.2
  // Load semantic map once for all keywords
  const semanticMap = getSemanticMapV2();
  
  // IMPORTANT: All keywords (both known and unknown) go through the same path.
  // - Known keywords: getAxesForKeywordV2 returns mapped axes from semantic-map-v2.json
  // - Unknown keywords: getAxesForKeywordV2 uses deterministic fallback (fallbackAxesV2)
  // Both paths return AxesV2 with all 4 axes (including Gamma), ensuring consistent behavior.
  const keywordVectors: Array<{ keyword: string; axes: AxesV2 }> = limitedKeywords.map(
    (keyword) => {
      const axes = getAxesForKeywordV2(keyword, semanticMap);
      return { keyword, axes };
    }
  );

  // Step 2: Alfa/Beta → Normalized coordinates → Pixel coordinates
  // Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 2
  const basePoints = keywordVectors.map((kv, index) => {
    const { xNorm, yNorm } = axesToNormalizedPosition(kv.axes);
    const pixel = normalizedToPixel(xNorm, yNorm, canvasWidth, canvasHeight);
    return {
      xNorm,
      yNorm,
      pixel,
      keyword: kv.keyword,
      axes: kv.axes,
      index,
      quadrant: getQuadrant(xNorm, yNorm),
    };
  });

  // NOTE: Old quadrant mirroring (Step 3) has been removed per patch01.
  // Mirroring is now applied as a final geometry step AFTER curve generation.
  // See: docs/patches/patch01_SPEC_03_mirroring_revision.md
  // Old code: lib/engine_v2/mirroring.ts (deprecated)

  // Step 3: Apply Gamma and Delta to generate curves
  // Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md sections 4-6
  // IMPORTANT: All curves are generated through the same pipeline (generateCurveFromPoint),
  // regardless of whether the keyword was found in the dictionary or generated via fallback.
  // The lengthScale parameter is applied uniformly to all lines, ensuring Slider1 affects
  // every curve in the generated symbol.
  const allCurves: Array<{
    start: Point;
    control: Point;
    end: Point;
    keyword: string;
    quadrant: number;
    isMirrored: boolean;
  }> = [];
  
  // Collect direction clustering debug info (patch03)
  const allDirectionClusters: import("../types").DirectionClusterDebug[] = [];

  for (let i = 0; i < basePoints.length; i++) {
    const point = basePoints[i];
    const result = generateCurveFromPoint(
      point.pixel,
      point.axes,
      canvasWidth,
      canvasHeight,
      seed,
      i,
      point.quadrant,
      false, // isMirrored: always false now (mirroring happens at final step)
      lengthScale, // Applied to ALL curves, including those from unknown keywords
      curvatureScale, // Applied to ALL curves, including those from unknown keywords
      clusterCount, // Direction clustering (patch03)
      clusterSpread // Direction clustering spread (patch03)
    );

    // Set keyword for each curve
    result.curves.forEach((c) => {
      c.keyword = point.keyword;
    });

    allCurves.push(...result.curves);
    
    // Collect direction clustering debug info
    if (includeDebug) {
      allDirectionClusters.push(...result.directionClusters);
    }
  }

  // Step 4: Convert to BranchedConnection format for rendering
  // Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 8
  const connections = allCurves.map(curveToBranchedConnection);

  const preMirroringBbox: GeometryBoundingBox | null = computeBoundingBox(
    connections,
    canvasWidth,
    canvasHeight
  );

  // Capture mirroring debug info BEFORE applying mirroring
  // This captures the bbox and axis of the pre-mirroring geometry
  const mirroringDebugInfo = includeDebug
    ? computeMirroringDebugInfo(connections, canvasWidth, canvasHeight, seed)
    : null;

  // Step 5: Final geometry mirroring (patch01)
  // Reference: docs/patches/patch01_SPEC_03_mirroring_revision.md
  // Reference: docs/ENGINE_V2_GEOMETRY_PIPELINE.md section 5
  // Mirroring is applied AFTER curve generation as a final geometry step
  const mirroredConnections = applyFinalMirroring(connections, canvasWidth, canvasHeight, seed);

  // Step 6: Branching (Branching_beta01) - generate new lines from intersections AFTER mirroring
  const branchedConnections = applyBranching(
    mirroredConnections,
    canvasWidth,
    canvasHeight,
    seed
  );

  const rotationApplied = shouldRotateGeometry(forceOrientation, preMirroringBbox);
  const rotatedConnections = rotationApplied
    ? rotateConnectionsClockwise(branchedConnections, canvasWidth, canvasHeight)
    : branchedConnections;

  // Capture debug info (anchor point BEFORE mirroring, plus mirroring info, plus clustering debug)
  const debug: EngineV2DebugInfo | undefined = includeDebug && basePoints.length > 0
    ? {
        alfa: keywordVectors[0].axes.alfa,
        beta: keywordVectors[0].axes.beta,
        anchor: basePoints[0].pixel, // Primary anchor point in canvas coordinates (BEFORE mirroring)
        // Per-keyword anchor points (all keywords' primary positions BEFORE mirroring)
        anchors: basePoints.map((bp, idx) => ({
          keyword: bp.keyword,
          index: idx,
          point: bp.pixel,
        })) as KeywordAnchorDebug[],
        ...(mirroringDebugInfo && {
          bbox: mirroringDebugInfo.bbox,
          mirrorAxisType: mirroringDebugInfo.mirrorAxisType,
          mirrorAxisSegment: mirroringDebugInfo.mirrorAxisSegment,
        }),
        // Direction clustering debug (patch03)
        directionClusters: allDirectionClusters.length > 0 ? allDirectionClusters : undefined,
        clusterCount,
        clusterSpread,
        gamma: keywordVectors[0].axes.gamma, // Use first keyword's gamma value
        forceOrientationEnabled: forceOrientation,
        forceOrientationApplied: rotationApplied,
      }
    : undefined;

  return {
    connections: rotatedConnections,
    debug,
  };
}

