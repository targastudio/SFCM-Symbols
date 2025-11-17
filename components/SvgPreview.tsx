"use client";

import type { BranchedConnection, EngineV2DebugInfo } from "../lib/types";
import { computeCurveControl } from "../lib/svgUtils";
import {
  BASE_STROKE_WIDTH,
  STROKE_COLOR,
  ARROW_WIDTH_PX,
  ARROW_HEIGHT_PX,
  ARROW_MARKER_UNITS,
  ARROW_MARKER_ID,
  BACKGROUND_COLOR,
} from "../lib/svgStyleConfig";
import DebugOverlay from "./DebugOverlay";

type SvgPreviewProps = {
  connections: BranchedConnection[];
  animationEnabled?: boolean;
  animationProgress?: number; // 0..1
  canvasWidth: number;
  canvasHeight: number;
  debugInfo?: EngineV2DebugInfo; // Optional debug info for visualization
  debugMode?: boolean; // If true, renders debug overlay
};

/**
 * Easing function for smooth ease-in / ease-out animation
 */
function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Componente per il rendering SVG statico e animato delle connessioni
 * Fase 3: Rendering + Animazione base
 */
export default function SvgPreview({
  connections,
  animationEnabled = false,
  animationProgress = 1,
  canvasWidth,
  canvasHeight,
  debugInfo,
  debugMode = false,
}: SvgPreviewProps) {
  // Ordina le connessioni per generationDepth (0 = MST, 1 = extra, 2 = ramificazioni)
  const sortedConnections = [...connections].sort(
    (a, b) => a.generationDepth - b.generationDepth
  );

  // Lunghezza approssimata per l'animazione (approssimazione semplice)
  const ANIMATION_LENGTH = 1200;

  // Calcola strokeDasharray e strokeDashoffset in base all'animazione per linea
  const getStrokeProps = (
    dashed: boolean,
    animationEnabled: boolean,
    animationProgress: number | undefined,
    localProgress: number
  ) => {
    // No animation: fully visible, keep original dash pattern
    if (!animationEnabled || animationProgress === undefined) {
      return {
        strokeDasharray: dashed ? "6 6" : "none",
        strokeDashoffset: 0,
      };
    }

    // CRITICAL: When animationProgress is exactly 0, ensure lines are completely hidden
    // This prevents flash when canvas size changes and new connections are set
    if (animationProgress === 0) {
      const dashArray = ANIMATION_LENGTH.toString();
      const pattern = dashed ? `${dashArray} ${dashArray}` : dashArray;
      return {
        strokeDasharray: pattern,
        strokeDashoffset: ANIMATION_LENGTH, // Fully hidden
      };
    }

    // Per-line animation using localProgress
    const effective = Math.max(0, Math.min(1, localProgress));
    const dashArray = ANIMATION_LENGTH.toString();
    const dashOffset = ANIMATION_LENGTH * (1 - effective);

    // For dashed lines we can keep a long pattern so the animation still works
    const pattern = dashed ? `${dashArray} ${dashArray}` : dashArray;

    return {
      strokeDasharray: pattern,
      strokeDashoffset: dashOffset,
    };
  };

  // Compute total for staggered animation
  const total = sortedConnections.length || 1;
  const BAND = 0.4; // fraction of the global timeline allocated to each line

  return (
    <div className="svg-wrapper">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="svg-preview"
      >
        {/* Definizioni: marker per le frecce */}
        <defs>
          {/* 
            Arrowhead marker definition:
            - ARROW_WIDTH_PX = 14px: length along the line direction
            - ARROW_HEIGHT_PX = 19px: height/base span perpendicular to line
            - Triangle geometry (in marker's coordinate system before rotation):
              * Base left: (0, 0)
              * Base right: (0, ARROW_WIDTH_PX) = (0, 14) - 14px vertical span in marker coords
              * Tip: (ARROW_HEIGHT_PX, ARROW_WIDTH_PX/2) = (19, 7) - 19px horizontal extent in marker coords
            - Base center at (0, ARROW_WIDTH_PX/2) = (0, 7) - this is where the line endpoint attaches
            - Tip extends forward to (ARROW_HEIGHT_PX, ARROW_WIDTH_PX/2) = (19, 7)
            - refX=0, refY=ARROW_WIDTH_PX/2 positions the marker so the line stops at the base center
            - viewBox="0 0 19 14" means 19px wide (X) × 14px tall (Y) in marker coords
            - When orient="auto" rotates this to align with line:
              * X-axis (19px) becomes height perpendicular to line → tall appearance
              * Y-axis (14px) becomes width along the line direction → narrow appearance
              * Result: tall and narrow arrowhead (19px > 14px)
            - Uses userSpaceOnUse so dimensions are absolute px (ARROW_WIDTH_PX × ARROW_HEIGHT_PX)
            - Arrowheads are fill-only (no stroke) for clean appearance in browser, Figma, and Illustrator
          */}
          <marker
            id={ARROW_MARKER_ID}
            markerUnits={ARROW_MARKER_UNITS}
            viewBox={`0 0 ${ARROW_HEIGHT_PX} ${ARROW_WIDTH_PX}`}
            refX={0}
            refY={ARROW_WIDTH_PX / 2}
            markerWidth={ARROW_HEIGHT_PX}
            markerHeight={ARROW_WIDTH_PX}
            orient="auto"
          >
            <path
              d={`M0,0 L${ARROW_HEIGHT_PX},${ARROW_WIDTH_PX / 2} L0,${ARROW_WIDTH_PX} z`}
              fill={STROKE_COLOR}
              stroke="none"
              strokeWidth="0"
            />
          </marker>
        </defs>

        {/* Sfondo nero */}
        <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill={BACKGROUND_COLOR} />

        {/* Canvas outline (preview only - removed in export) */}
        <rect
          x="0"
          y="0"
          width={canvasWidth}
          height={canvasHeight}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.5}
          strokeDasharray="4 4"
          opacity="0.25"
          pointerEvents="none"
        />

        {/* Renderizza tutte le connessioni ordinate per generationDepth */}
        {sortedConnections.map((conn, index) => {
          // Compute per-connection localProgress for staggered animation
          const phase = index / total; // 0..1, position of this connection in the sequence
          const start = phase * (1 - BAND);
          const end = start + BAND;

          let localProgress = 1;

          if (animationEnabled && animationProgress !== undefined) {
            if (animationProgress <= start) {
              localProgress = 0;
            } else if (animationProgress >= end) {
              localProgress = 1;
            } else {
              localProgress = (animationProgress - start) / (end - start);
            }
          } else {
            localProgress = 1;
          }

          // Apply easing to localProgress for smooth ease-in / ease-out effect
          const easedProgress = easeInOutCubic(localProgress);

          // Compute stroke properties using easedProgress
          const { strokeDasharray, strokeDashoffset } = getStrokeProps(
            conn.dashed,
            animationEnabled,
            animationProgress,
            easedProgress
          );

          // Arrowhead visibility per connection
          // Show arrowheads when animation is disabled, or when animation is complete
          // For animated connections, show arrowhead when the line is fully drawn
          const showArrowForThisConnection =
            !animationEnabled ||
            animationProgress === undefined ||
            easedProgress >= 0.99;

          if (conn.curved) {
            // Curva Bézier quadratica
            // Pass canvas dimensions to clamp control point and prevent curves from extending outside bounds
            const { cx, cy } = computeCurveControl(conn, canvasWidth, canvasHeight);
            const pathData = `M ${conn.from.x} ${conn.from.y} Q ${cx} ${cy} ${conn.to.x} ${conn.to.y}`;

            return (
              <path
                key={`conn-${index}`}
                d={pathData}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={BASE_STROKE_WIDTH}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                markerEnd={showArrowForThisConnection ? `url(#${ARROW_MARKER_ID})` : undefined}
              />
            );
          } else {
            // Linea retta
            return (
              <line
                key={`conn-${index}`}
                x1={conn.from.x}
                y1={conn.from.y}
                x2={conn.to.x}
                y2={conn.to.y}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={BASE_STROKE_WIDTH}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                markerEnd={showArrowForThisConnection ? `url(#${ARROW_MARKER_ID})` : undefined}
              />
            );
          }
        })}

        {/* Debug overlay (rendered on top, only when debugMode is true) */}
        {debugMode && (
          <DebugOverlay
            width={canvasWidth}
            height={canvasHeight}
            anchor={debugInfo?.anchor}
            anchors={debugInfo?.anchors}
            bbox={debugInfo?.bbox}
            mirrorAxisSegment={debugInfo?.mirrorAxisSegment}
          />
        )}
      </svg>
    </div>
  );
}

