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

import type { KeywordAnchorDebug, Point } from "../lib/types";

type DebugOverlayProps = {
  width: number;
  height: number;
  anchor?: Point;
  anchors?: KeywordAnchorDebug[];
  bbox?: { minX: number; minY: number; maxX: number; maxY: number };
  mirrorAxisSegment?: { x1: number; y1: number; x2: number; y2: number };
};

export default function DebugOverlay({
  width,
  height,
  anchor,
  anchors,
  bbox,
  mirrorAxisSegment,
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
    </g>
  );
}

