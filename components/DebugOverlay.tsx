/**
 * DebugOverlay — Visual debug layer for ENGINE_V2
 * 
 * Renders debug visualization for ENGINE_V2 geometry:
 * - Canvas quadrant lines (vertical/horizontal at center)
 * - Primary anchor point (Alfa/Beta → canvas coordinates BEFORE mirroring)
 * - Crosshairs at anchor point
 * 
 * This component is for development/debugging only.
 * Reference: docs/debug/ENGINE_V2_DEBUG_OVERLAY.md
 */

import type { KeywordAnchorDebug, Point, DirectionClusterDebug } from "../lib/types";

type DebugOverlayProps = {
  width: number;
  height: number;
  anchor?: Point;
  anchors?: KeywordAnchorDebug[];
  bbox?: { minX: number; minY: number; maxX: number; maxY: number };
  mirrorAxisSegment?: { x1: number; y1: number; x2: number; y2: number };
  // Direction clustering debug (patch03)
  directionClusters?: DirectionClusterDebug[];
  clusterCount?: number;
  clusterSpread?: number;
  gamma?: number;
};

export default function DebugOverlay({
  width,
  height,
  anchor,
  anchors,
  bbox,
  mirrorAxisSegment,
  directionClusters,
  clusterCount,
  clusterSpread,
  gamma,
}: DebugOverlayProps) {
  const centerX = width / 2;
  const centerY = height / 2;

  // Debug overlay colors (neutral, non-intrusive)
  const QUADRANT_LINE_COLOR = "#666666"; // Gray
  const QUADRANT_LINE_OPACITY = 0.4;
  const QUADRANT_LINE_WIDTH = 1;
  const ANCHOR_CROSSHAIR_COLOR = "#00ff00"; // Green
  const ANCHOR_CROSSHAIR_OPACITY = 0.6;
  const ANCHOR_CROSSHAIR_WIDTH = 1;
  const ANCHOR_CIRCLE_STROKE_COLOR = "#00ff00"; // Green
  const ANCHOR_CIRCLE_STROKE_WIDTH = 2;
  const ANCHOR_CIRCLE_STROKE_OPACITY = 0.8;
  const ANCHOR_CIRCLE_RADIUS = 8;
  const ANCHOR_DOT_RADIUS = 3;
  const ANCHOR_DOT_COLOR = "#00ff00"; // Green
  const BBOX_COLOR = "#ffff00"; // Yellow
  const BBOX_OPACITY = 0.6;
  const BBOX_STROKE_WIDTH = 1.5;
  const MIRROR_AXIS_COLOR = "#00ffff"; // Cyan
  const MIRROR_AXIS_OPACITY = 0.7;
  const MIRROR_AXIS_WIDTH = 2;
  const KEYWORD_ANCHOR_OUTER_COLOR = "#ff8800"; // Orange
  const KEYWORD_ANCHOR_OUTER_OPACITY = 0.8;
  const KEYWORD_ANCHOR_OUTER_RADIUS = 6;
  const KEYWORD_ANCHOR_OUTER_STROKE_WIDTH = 1.5;
  const KEYWORD_ANCHOR_INNER_COLOR = "#ff8800"; // Orange
  const KEYWORD_ANCHOR_INNER_OPACITY = 0.9;
  const KEYWORD_ANCHOR_INNER_RADIUS = 2.5;
  const KEYWORD_LABEL_COLOR = "#ff8800"; // Orange
  const KEYWORD_LABEL_OPACITY = 0.9;
  const KEYWORD_LABEL_FONT_SIZE = 12;
  const KEYWORD_LABEL_OFFSET_X = 8;
  const KEYWORD_LABEL_OFFSET_Y = -8;
  
  // Direction clustering debug colors (patch03)
  const CLUSTER_CENTER_COLOR = "#ff00ff"; // Magenta
  const CLUSTER_CENTER_OPACITY = 0.7;
  const CLUSTER_CENTER_WIDTH = 2;
  const CLUSTER_CENTER_LENGTH = 50; // Length of cluster center indicator line
  const DIRECTION_LINE_OPACITY_BASE = 0.25;
  const DIRECTION_LINE_OPACITY_MAX = 1.0;
  const DIRECTION_LINE_WIDTH_BASE = 0.6;
  const DIRECTION_LINE_WIDTH_MAX = 3.0;
  const DIRECTION_LINE_LENGTH = 30; // Length of direction indicator line
  const GAMMA_ROTATION_COLOR = "#ff8800"; // Orange
  const GAMMA_ROTATION_OPACITY = 0.6;
  
  // Helper function to convert angle (degrees) to point on circle
  const angleToPoint = (angleDeg: number, centerX: number, centerY: number, radius: number): Point => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: centerX + Math.cos(angleRad) * radius,
      y: centerY - Math.sin(angleRad) * radius, // Negative because SVG Y increases downward
    };
  };
  
  // Get unique cluster centers (before Gamma rotation)
  const uniqueClusterCenters = directionClusters && clusterCount
    ? Array.from({ length: clusterCount }, (_, i) => {
        const clusterAngle = (i / clusterCount) * 180;
        return { clusterIndex: i, clusterAngle };
      })
    : [];
  
  // Get unique final cluster centers (after Gamma rotation)
  const uniqueFinalClusterCenters = directionClusters && clusterCount && gamma !== undefined
    ? Array.from({ length: clusterCount }, (_, i) => {
        const clusterAngle = (i / clusterCount) * 180;
        const gammaRotation = (gamma / 100) * 180;
        const finalClusterAngle = (clusterAngle + gammaRotation) % 180;
        return { clusterIndex: i, finalClusterAngle };
      })
    : [];

  return (
    <g pointerEvents="none">
      {/* Quadrant lines: vertical and horizontal at canvas center */}
      <line
        x1={centerX}
        y1={0}
        x2={centerX}
        y2={height}
        stroke={QUADRANT_LINE_COLOR}
        strokeWidth={QUADRANT_LINE_WIDTH}
        strokeDasharray="4 4"
        opacity={QUADRANT_LINE_OPACITY}
      />
      <line
        x1={0}
        y1={centerY}
        x2={width}
        y2={centerY}
        stroke={QUADRANT_LINE_COLOR}
        strokeWidth={QUADRANT_LINE_WIDTH}
        strokeDasharray="4 4"
        opacity={QUADRANT_LINE_OPACITY}
      />

      {/* Bounding box of pre-mirroring geometry (if provided) */}
      {bbox && (
        <rect
          x={bbox.minX}
          y={bbox.minY}
          width={bbox.maxX - bbox.minX}
          height={bbox.maxY - bbox.minY}
          fill="none"
          stroke={BBOX_COLOR}
          strokeWidth={BBOX_STROKE_WIDTH}
          strokeDasharray="5 5"
          opacity={BBOX_OPACITY}
        />
      )}

      {/* Mirroring axis line (if provided) */}
      {mirrorAxisSegment && (
        <line
          x1={mirrorAxisSegment.x1}
          y1={mirrorAxisSegment.y1}
          x2={mirrorAxisSegment.x2}
          y2={mirrorAxisSegment.y2}
          stroke={MIRROR_AXIS_COLOR}
          strokeWidth={MIRROR_AXIS_WIDTH}
          strokeDasharray="8 4"
          opacity={MIRROR_AXIS_OPACITY}
        />
      )}

      {/* Per-keyword anchor points (if provided) */}
      {anchors && anchors.length > 0 && (
        <>
          {anchors.map((kwAnchor) => (
            <g key={kwAnchor.index}>
              {/* Outer circle stroke around keyword anchor */}
              <circle
                cx={kwAnchor.point.x}
                cy={kwAnchor.point.y}
                r={KEYWORD_ANCHOR_OUTER_RADIUS}
                fill="none"
                stroke={KEYWORD_ANCHOR_OUTER_COLOR}
                strokeWidth={KEYWORD_ANCHOR_OUTER_STROKE_WIDTH}
                opacity={KEYWORD_ANCHOR_OUTER_OPACITY}
              />
              {/* Filled circle at keyword anchor center */}
              <circle
                cx={kwAnchor.point.x}
                cy={kwAnchor.point.y}
                r={KEYWORD_ANCHOR_INNER_RADIUS}
                fill={KEYWORD_ANCHOR_INNER_COLOR}
                opacity={KEYWORD_ANCHOR_INNER_OPACITY}
              />
              {/* Text label with index (1-based) */}
              <text
                x={kwAnchor.point.x + KEYWORD_LABEL_OFFSET_X}
                y={kwAnchor.point.y + KEYWORD_LABEL_OFFSET_Y}
                fill={KEYWORD_LABEL_COLOR}
                fontSize={KEYWORD_LABEL_FONT_SIZE}
                opacity={KEYWORD_LABEL_OPACITY}
                fontWeight="bold"
                fontFamily="monospace"
              >
                {String(kwAnchor.index + 1)}
              </text>
            </g>
          ))}
        </>
      )}

      {/* Primary anchor point visualization (if provided) */}
      {anchor && (
        <>
          {/* Crosshairs: vertical line through anchor */}
          <line
            x1={anchor.x}
            y1={0}
            x2={anchor.x}
            y2={height}
            stroke={ANCHOR_CROSSHAIR_COLOR}
            strokeWidth={ANCHOR_CROSSHAIR_WIDTH}
            strokeDasharray="2 2"
            opacity={ANCHOR_CROSSHAIR_OPACITY}
          />
          {/* Crosshairs: horizontal line through anchor */}
          <line
            x1={0}
            y1={anchor.y}
            x2={width}
            y2={anchor.y}
            stroke={ANCHOR_CROSSHAIR_COLOR}
            strokeWidth={ANCHOR_CROSSHAIR_WIDTH}
            strokeDasharray="2 2"
            opacity={ANCHOR_CROSSHAIR_OPACITY}
          />
          {/* Outer circle stroke around anchor */}
          <circle
            cx={anchor.x}
            cy={anchor.y}
            r={ANCHOR_CIRCLE_RADIUS}
            fill="none"
            stroke={ANCHOR_CIRCLE_STROKE_COLOR}
            strokeWidth={ANCHOR_CIRCLE_STROKE_WIDTH}
            opacity={ANCHOR_CIRCLE_STROKE_OPACITY}
          />
          {/* Filled circle at anchor center */}
          <circle
            cx={anchor.x}
            cy={anchor.y}
            r={ANCHOR_DOT_RADIUS}
            fill={ANCHOR_DOT_COLOR}
            opacity={ANCHOR_CROSSHAIR_OPACITY}
          />
        </>
      )}

      {/* Direction clustering visualization (patch03) */}
      {directionClusters && directionClusters.length > 0 && anchor && (
        <>
          {/* Cluster centers (before Gamma rotation) - shown as dashed lines */}
          {uniqueClusterCenters.map(({ clusterIndex, clusterAngle }) => {
            const startPoint = angleToPoint(clusterAngle, anchor.x, anchor.y, 10);
            const endPoint = angleToPoint(clusterAngle, anchor.x, anchor.y, CLUSTER_CENTER_LENGTH);
            return (
              <line
                key={`cluster-center-${clusterIndex}`}
                x1={startPoint.x}
                y1={startPoint.y}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke={CLUSTER_CENTER_COLOR}
                strokeWidth={CLUSTER_CENTER_WIDTH}
                strokeDasharray="4 4"
                opacity={CLUSTER_CENTER_OPACITY}
              />
            );
          })}
          
          {/* Final cluster centers (after Gamma rotation) - shown as solid lines */}
          {uniqueFinalClusterCenters.map(({ clusterIndex, finalClusterAngle }) => {
            const startPoint = angleToPoint(finalClusterAngle, anchor.x, anchor.y, 10);
            const endPoint = angleToPoint(finalClusterAngle, anchor.x, anchor.y, CLUSTER_CENTER_LENGTH);
            return (
              <line
                key={`final-cluster-center-${clusterIndex}`}
                x1={startPoint.x}
                y1={startPoint.y}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke={CLUSTER_CENTER_COLOR}
                strokeWidth={CLUSTER_CENTER_WIDTH}
                opacity={CLUSTER_CENTER_OPACITY * 1.2}
              />
            );
          })}
          
          {/* Direction indicators for each line - small lines showing final direction */}
          {directionClusters.map((clusterDebug, index) => {
            const startPoint = angleToPoint(clusterDebug.finalDirection, anchor.x, anchor.y, 5);
            const endPoint = angleToPoint(clusterDebug.finalDirection, anchor.x, anchor.y, DIRECTION_LINE_LENGTH);
            // Use different hues for different clusters
            const clusterColorHue = (clusterDebug.clusterIndex / (clusterCount || 3)) * 360;

            // patch04: encode length/curvature profiles visually
            const lengthProfile = clusterDebug.lengthProfile ?? 1.0;
            const curvatureProfile = clusterDebug.curvatureProfile ?? 1.0;

            // Map lengthProfile to stroke width within an amplified range
            const clampedLengthProfile = Math.max(0.3, Math.min(2.0, lengthProfile));
            const strokeWidth =
              DIRECTION_LINE_WIDTH_BASE +
              (DIRECTION_LINE_WIDTH_MAX - DIRECTION_LINE_WIDTH_BASE) *
                ((clampedLengthProfile - 0.4) / (1.8 - 0.4));

            // Map curvatureProfile to opacity (more curved → more opaque, more dramatic)
            const clampedCurvProfile = Math.max(0.3, Math.min(2.0, curvatureProfile));
            const opacity =
              DIRECTION_LINE_OPACITY_BASE +
              (DIRECTION_LINE_OPACITY_MAX - DIRECTION_LINE_OPACITY_BASE) *
                ((clampedCurvProfile - 0.4) / (1.8 - 0.4));

            return (
              <line
                key={`direction-${index}`}
                x1={startPoint.x}
                y1={startPoint.y}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke={`hsl(${clusterColorHue}, 70%, 60%)`}
                strokeWidth={strokeWidth}
                opacity={opacity}
              />
            );
          })}
          
          {/* Gamma rotation indicator - arc showing rotation */}
          {gamma !== undefined && anchor && (
            <>
              <text
                x={anchor.x + 60}
                y={anchor.y - 60}
                fill={GAMMA_ROTATION_COLOR}
                fontSize={11}
                opacity={GAMMA_ROTATION_OPACITY}
                fontFamily="monospace"
              >
                γ: {gamma.toFixed(1)}° ({((gamma / 100) * 180).toFixed(1)}° rot)
              </text>
              {clusterCount !== undefined && (
                <text
                  x={anchor.x + 60}
                  y={anchor.y - 45}
                  fill={GAMMA_ROTATION_COLOR}
                  fontSize={11}
                  opacity={GAMMA_ROTATION_OPACITY}
                  fontFamily="monospace"
                >
                  Clusters: {clusterCount}, Spread: {clusterSpread?.toFixed(0)}°
                </text>
              )}
            </>
          )}
        </>
      )}
    </g>
  );
}

