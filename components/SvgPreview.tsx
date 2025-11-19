"use client";

import { useRef, useEffect } from "react";
import type { BranchedConnection, EngineV2DebugInfo } from "../lib/types";
import { computeCurveControl } from "../lib/svgUtils";
import {
  BASE_STROKE_WIDTH,
  STROKE_COLOR,
  ARROW_WIDTH_PX,
  ARROW_HEIGHT_PX,
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

type ConnectionGeometry =
  | {
      type: "line";
      length: number;
    }
  | {
      type: "curve";
      length: number;
      pathData: string;
      controlPoint: { x: number; y: number };
    };

type PreparedConnection = {
  connection: BranchedConnection;
  geometry: ConnectionGeometry;
};

const DASHED_PATTERN = "6 6";
const SOLID_PATTERN = "none";
const CURVE_SAMPLES = 20;
const COMPLETION_THRESHOLD = 0.999;
const ARROWHEAD_PATH_D = `M0,0 L${ARROW_HEIGHT_PX},${ARROW_WIDTH_PX / 2} L0,${ARROW_WIDTH_PX} z`;

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
  // Track previous progress to detect vanishing phase (progress decreasing from 1)
  const prevProgressRef = useRef<number>(animationProgress);
  const isVanishingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!animationEnabled || animationProgress === undefined) {
      prevProgressRef.current = animationProgress ?? 1;
      isVanishingRef.current = false;
      return;
    }

    // Detect vanishing phase: progress was at or near 1, now decreasing
    if (prevProgressRef.current >= 0.99 && animationProgress < prevProgressRef.current) {
      isVanishingRef.current = true;
    }
    // Reset vanishing flag when we reach 0 (start of new forward phase)
    if (animationProgress <= 0.01) {
      isVanishingRef.current = false;
    }

    prevProgressRef.current = animationProgress;
  }, [animationEnabled, animationProgress]);

  // Ordina le connessioni per generationDepth (0 = MST, 1 = extra, 2 = ramificazioni)
  const sortedConnections = [...connections].sort(
    (a, b) => a.generationDepth - b.generationDepth
  );

  const preparedConnections: PreparedConnection[] = sortedConnections.map(
    (conn) => {
      const geometry = conn.curved
        ? getCurveGeometry(conn, canvasWidth, canvasHeight)
        : getLineGeometry(conn);

      return {
        connection: conn,
        geometry,
      };
    }
  );

  const animationActive = animationEnabled && animationProgress !== undefined;

  const connectionRenderData = preparedConnections.map(
    ({ connection: conn, geometry }, index) => {
      const baseProgress = animationActive ? animationProgress ?? 1 : 1;
      const easedProgress = easeInOutCubic(baseProgress);
      const maskId = animationActive ? `connection-mask-${index}` : undefined;

      const maskStrokeProps = animationActive
        ? getStrokeAnimationProps({
            dashed: false,
            animationEnabled,
            animationProgress,
            localProgress: easedProgress,
            pathLength: geometry.length,
            isVanishing: isVanishingRef.current,
          })
        : null;

      const arrowheadState = getArrowheadState({
        connection: conn,
        geometry,
        animationEnabled,
        animationProgress,
        localProgress: easedProgress,
        isVanishing: isVanishingRef.current,
      });

      return {
        connection: conn,
        geometry,
        index,
        maskId,
        maskStrokeProps,
        arrowheadState,
      };
    }
  );

  return (
    <div className="svg-wrapper">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="svg-preview"
      >
        {animationActive && (
          <defs>
            {connectionRenderData.map(({ connection, geometry, maskId, maskStrokeProps }) => {
              if (!maskId || !maskStrokeProps) {
                return null;
              }

              const dasharray =
                maskStrokeProps.strokeDasharray === SOLID_PATTERN
                  ? undefined
                  : maskStrokeProps.strokeDasharray;
              const dashoffset =
                dasharray !== undefined ? maskStrokeProps.strokeDashoffset : undefined;
              const maskStrokeWidth = BASE_STROKE_WIDTH + 2;

              return (
                <mask
                  id={maskId}
                  maskUnits="userSpaceOnUse"
                  maskContentUnits="userSpaceOnUse"
                  key={maskId}
                  data-animation-mask="true"
                >
                  <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="black" />
                  {connection.curved && geometry.type === "curve" ? (
                    <path
                      d={geometry.pathData}
                      fill="none"
                      stroke="white"
                      strokeWidth={maskStrokeWidth}
                      strokeDasharray={dasharray}
                      strokeDashoffset={dashoffset}
                      strokeLinecap="round"
                    />
                  ) : (
                    <line
                      x1={connection.from.x}
                      y1={connection.from.y}
                      x2={connection.to.x}
                      y2={connection.to.y}
                      stroke="white"
                      strokeWidth={maskStrokeWidth}
                      strokeDasharray={dasharray}
                      strokeDashoffset={dashoffset}
                      strokeLinecap="round"
                    />
                  )}
                </mask>
              );
            })}
          </defs>
        )}
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
        {connectionRenderData.map(({ connection: conn, geometry, index, maskId, arrowheadState }) => {
          const connectionDomId = `connection-${index}`;
          const strokeDasharray = conn.dashed ? DASHED_PATTERN : SOLID_PATTERN;

          const connectionElement =
            conn.curved && geometry.type === "curve" ? (
              <path
                d={geometry.pathData}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={BASE_STROKE_WIDTH}
                strokeDasharray={strokeDasharray}
                data-connection-id={connectionDomId}
                mask={maskId ? `url(#${maskId})` : undefined}
              />
            ) : (
              <line
                x1={conn.from.x}
                y1={conn.from.y}
                x2={conn.to.x}
                y2={conn.to.y}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={BASE_STROKE_WIDTH}
                strokeDasharray={strokeDasharray}
                data-connection-id={connectionDomId}
                mask={maskId ? `url(#${maskId})` : undefined}
              />
            );

          return (
            <g key={connectionDomId}>
              {connectionElement}
              {arrowheadState && (
                <path
                  d={ARROWHEAD_PATH_D}
                  fill={STROKE_COLOR}
                  stroke="none"
                  strokeWidth={0}
                  transform={`translate(${arrowheadState.x} ${arrowheadState.y}) rotate(${arrowheadState.angleDeg}) translate(0 ${-ARROW_WIDTH_PX / 2})`}
                  data-arrowhead="true"
                  data-arrowhead-dynamic="true"
                  data-arrow-connection-id={connectionDomId}
                />
              )}
            </g>
          );
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
            directionClusters={debugInfo?.directionClusters}
            clusterCount={debugInfo?.clusterCount}
            clusterSpread={debugInfo?.clusterSpread}
            gamma={debugInfo?.gamma}
            realtimeGeneration={debugInfo?.realtimeGeneration}
          />
        )}
      </svg>
    </div>
  );
}

type StrokeAnimationParams = {
  dashed: boolean;
  animationEnabled: boolean;
  animationProgress?: number;
  localProgress: number;
  pathLength: number;
  isVanishing: boolean;
};

function getStrokeAnimationProps({
  dashed,
  animationEnabled,
  animationProgress,
  localProgress,
  pathLength,
  isVanishing,
}: StrokeAnimationParams) {
  // No animation: fully visible, keep original dash pattern
  if (!animationEnabled || animationProgress === undefined) {
    return {
      strokeDasharray: dashed ? DASHED_PATTERN : SOLID_PATTERN,
      strokeDashoffset: 0,
    };
  }

  const effectiveLength = Math.max(0, pathLength);

  if (effectiveLength === 0) {
    return {
      strokeDasharray: dashed ? DASHED_PATTERN : SOLID_PATTERN,
      strokeDashoffset: 0,
    };
  }

  const clamped = Math.max(0, Math.min(1, localProgress));

  if (clamped >= COMPLETION_THRESHOLD) {
    return {
      strokeDasharray: dashed ? DASHED_PATTERN : SOLID_PATTERN,
      strokeDashoffset: 0,
    };
  }

  const dashValue = effectiveLength;
  const dashArray = dashed
    ? `${dashValue} ${dashValue}`
    : `${dashValue}`;
  // Forward phase uses positive offsets (dash slides from full hidden → fully visible),
  // vanishing phase uses negative offsets so the stroke retracts from the origin
  // while the arrowhead (path end) stays visible.
  const dashOffset = isVanishing
    ? (clamped - 1) * dashValue
    : (1 - clamped) * dashValue;

  return {
    strokeDasharray: dashArray,
    strokeDashoffset: dashOffset,
  };
}

type ArrowheadState = {
  x: number;
  y: number;
  angleDeg: number;
};

type ArrowheadParams = {
  connection: BranchedConnection;
  geometry: ConnectionGeometry;
  animationEnabled: boolean;
  animationProgress?: number;
  localProgress: number;
  isVanishing: boolean;
};

function getArrowheadState({
  connection,
  geometry,
  animationEnabled,
  animationProgress,
  localProgress,
  isVanishing,
}: ArrowheadParams): ArrowheadState | null {
  const clamped = Math.max(0, Math.min(1, localProgress));
  const stickToArrowhead =
    !animationEnabled || animationProgress === undefined || isVanishing;
  const tipProgress = stickToArrowhead ? 1 : clamped;

  if (geometry.type === "line") {
    const dx = connection.to.x - connection.from.x;
    const dy = connection.to.y - connection.from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      return null;
    }

    const x = connection.from.x + dx * tipProgress;
    const y = connection.from.y + dy * tipProgress;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    return { x, y, angleDeg };
  }

  const controlPoint = geometry.controlPoint;
  const point = getQuadraticPoint(connection.from, controlPoint, connection.to, tipProgress);
  const tangent = getQuadraticTangent(connection.from, controlPoint, connection.to, tipProgress);
  let angleDx = tangent.x;
  let angleDy = tangent.y;

  if (Math.abs(angleDx) < 1e-5 && Math.abs(angleDy) < 1e-5) {
    angleDx = connection.to.x - connection.from.x;
    angleDy = connection.to.y - connection.from.y;
  }

  if (Math.abs(angleDx) < 1e-5 && Math.abs(angleDy) < 1e-5) {
    return null;
  }

  const angleDeg = (Math.atan2(angleDy, angleDx) * 180) / Math.PI;
  return {
    x: point.x,
    y: point.y,
    angleDeg,
  };
}

function getLineGeometry(connection: BranchedConnection): ConnectionGeometry {
  const dx = connection.to.x - connection.from.x;
  const dy = connection.to.y - connection.from.y;
  const length = Math.hypot(dx, dy);
  return { type: "line", length };
}

function getCurveGeometry(
  connection: BranchedConnection,
  canvasWidth: number,
  canvasHeight: number
): ConnectionGeometry {
  const { cx, cy } = computeCurveControl(connection, canvasWidth, canvasHeight);
  const controlPoint = { x: cx, y: cy };
  const length = approximateQuadraticBezierLength(
    connection.from,
    controlPoint,
    connection.to
  );
  const pathData = `M ${connection.from.x} ${connection.from.y} Q ${cx} ${cy} ${connection.to.x} ${connection.to.y}`;
  return { type: "curve", length, pathData, controlPoint };
}

function approximateQuadraticBezierLength(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  samples: number = CURVE_SAMPLES
): number {
  if (samples <= 0) {
    return 0;
  }

  let length = 0;
  let prevPoint = p0;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = getQuadraticPoint(p0, p1, p2, t);
    length += Math.hypot(point.x - prevPoint.x, point.y - prevPoint.y);
    prevPoint = point;
  }

  return length;
}

function getQuadraticPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const mt = 1 - t;
  const x =
    mt * mt * p0.x +
    2 * mt * t * p1.x +
    t * t * p2.x;
  const y =
    mt * mt * p0.y +
    2 * mt * t * p1.y +
    t * t * p2.y;
  return { x, y };
}

function getQuadraticTangent(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const mt = 1 - t;
  const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  return { x: dx, y: dy };
}
