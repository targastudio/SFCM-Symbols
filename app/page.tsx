"use client";

/**
 * Pagina principale SFCM Symbol Generator
 * UI con form keywords, slider e canvas rendering
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { cyrb53 } from "../lib/seed";
import type {
  BranchedConnection,
  EngineV2DebugInfo,
  RealtimeGenerationDebug,
} from "../lib/types";
import { generateEngineV2 } from "../lib/engine_v2/engine";
import SvgPreview from "../components/SvgPreview";
import DownloadSvgButton from "../components/DownloadSvgButton";
import LayoutDebugOverlay from "../components/LayoutDebugOverlay";
import {
  type CanvasSizeId,
  resolveCanvasSize,
} from "../lib/canvasSizeConfig";
import { REAL_TIME_GENERATION_FLAG } from "../lib/featureFlags";

type GenerationTrigger = "manual" | "slider" | "slider-finalize" | "force-orientation";
const REAL_TIME_MIN_INTERVAL_MS = 16;
const ANIMATION_LOOP_CONFIG = {
  forwardDurationMs: 1800,
  reverseDurationMs: 1800,
  pauseDurationMs: 420,
} as const;

export default function Home() {
  const [keywords, setKeywords] = useState("Azione, Dispositivo, reale, ibrido, politica");
  
  // Slider state variables
  // Slider1: "Lunghezza linee" - controls lengthScale in ENGINE_V2 (0-100, default 50)
  const [lineLengthSlider, setLineLengthSlider] = useState(50);
  // Slider2: "Curvatura linee" - controls curvatureScale in ENGINE_V2 (0-100, default 50)
  const [curvatureSlider, setCurvatureSlider] = useState(50);
  // Slider3: "Numero Cluster" - controls clusterCount in ENGINE_V2 (0-100, default 33 → clusterCount = 3)
  const [clusterCountSlider, setClusterCountSlider] = useState(33);
  // Slider4: "Ampiezza Cluster" - controls clusterSpread in ENGINE_V2 (0-100, default 40 → clusterSpread = 30)
  const [clusterSpreadSlider, setClusterSpreadSlider] = useState(40);
  // Force Orientation toggle (Feature3)
  const [forceOrientation, setForceOrientation] = useState(false);
  const [connections, setConnections] = useState<BranchedConnection[]>([]);
  const [debugInfo, setDebugInfo] = useState<EngineV2DebugInfo | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [animationProgress, setAnimationProgress] = useState(1); // 1 = fully drawn by default
  const [debugMode, setDebugMode] = useState(false); // Debug overlay toggle
  const [layoutDebugMode, setLayoutDebugMode] = useState(false); // Layout debug overlay toggle
  const [realtimePreviewEnabled, setRealtimePreviewEnabled] = useState(REAL_TIME_GENERATION_FLAG);
  const [activeGenerationTrigger, setActiveGenerationTrigger] = useState<GenerationTrigger | null>(null);
  const [hasGeneratedAtLeastOnce, setHasGeneratedAtLeastOnce] = useState(false);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeGenerationDebug | undefined>(undefined);

  // Track if user has generated at least once (to prevent auto-generation on initial mount)
  const hasGeneratedOnceRef = useRef(false);
  const generationInFlightRef = useRef(false);
  const ongoingGenerationTriggerRef = useRef<GenerationTrigger | null>(null);
  const skipAnimationForNextRenderRef = useRef(false);
  const realtimeControllerRef = useRef<{
    pendingReason: GenerationTrigger | null;
    scheduled: boolean;
    frameHandle: number | null;
    lastDispatchTs: number;
    throttleHits: number;
    skippedRenders: number;
    dropCurrentResult: boolean;
  }>({
    pendingReason: null,
    scheduled: false,
    frameHandle: null,
    lastDispatchTs: 0,
    throttleHits: 0,
    skippedRenders: 0,
    dropCurrentResult: false,
  });
  const processRealtimeQueueRef = useRef<() => void>(() => {});
  const sliderDragRef = useRef<string | null>(null);

  // Canvas size - temporarily hardcoded to 1:1 (square)
  // UI removed, backend code remains intact for future use
  const canvasSizeId: CanvasSizeId = "square";
  const realtimeFeatureActive = REAL_TIME_GENERATION_FLAG && realtimePreviewEnabled;


  /**
   * Animation loop: forward → pause → forward-vanishing loop controlled by deterministic durations
   * Phase 1 (forward): Lines grow from origin to arrowhead (0 → 1)
   * Phase 2 (pause): Hold at full length (progress = 1)
   * Phase 3 (forward-vanishing): Lines retract from origin toward arrowhead, arrowhead stays visible (1 → 0)
   */
  useEffect(() => {
    // If animation is disabled or there is nothing to animate, keep progress at 1
    if (!animationEnabled || connections.length === 0) {
      setAnimationProgress(1);
      return;
    }

    // When real-time preview updates connections we skip the animation reset
    if (skipAnimationForNextRenderRef.current) {
      skipAnimationForNextRenderRef.current = false;
      setAnimationProgress(1);
      return;
    }

    let frameId: number | null = null;
    let cancelled = false;
    const forwardDuration = Math.max(1, ANIMATION_LOOP_CONFIG.forwardDurationMs);
    const pauseDuration = Math.max(0, ANIMATION_LOOP_CONFIG.pauseDurationMs);
    // Phase 3 (forward-vanishing) uses the same duration as phase 1
    const vanishingDuration = forwardDuration;
    type LoopPhase = "forward" | "pause" | "forward-vanishing";
    let phase: LoopPhase = "forward";
    let phaseStart = performance.now();

    const runFrame = (now: number) => {
      if (cancelled) {
        return;
      }

      const elapsed = now - phaseStart;

      if (phase === "forward") {
        const normalized = Math.min(1, elapsed / forwardDuration);
        setAnimationProgress(normalized);
        if (normalized >= 1) {
          phase = pauseDuration > 0 ? "pause" : "forward-vanishing";
          phaseStart = now;
        }
      } else if (phase === "pause") {
        setAnimationProgress(1);
        if (elapsed >= pauseDuration) {
          phase = "forward-vanishing";
          phaseStart = now;
        }
      } else {
        // forward-vanishing phase: progress goes from 1 → 0
        const normalized = Math.max(0, 1 - elapsed / vanishingDuration);
        setAnimationProgress(normalized);
        if (normalized <= 0) {
          phase = "forward";
          phaseStart = now;
        }
      }

      frameId = requestAnimationFrame(runFrame);
    };

    // Ensure we start from 0 at the beginning of the forward phase
    setAnimationProgress(0);
    frameId = requestAnimationFrame((now) => {
      phaseStart = now;
      runFrame(now);
    });

    return () => {
      cancelled = true;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [animationEnabled, connections]);

  /**
   * Genera seed globale deterministico da keywords e canvas size
   * 
   * NOTE: Only lineLengthSlider influences generation via lengthScale.
   * Sliders do not influence the seed - they modify geometry post-generation.
   */
  function generateSeed(
    keywords: string[],
    canvasWidth: number,
    canvasHeight: number
  ): string {
    // ENGINE_V2 seed is based on keywords and canvas dimensions only
    const params = `${keywords.join(",")}-${canvasWidth}-${canvasHeight}`;
    return String(cyrb53(params));
  }

  const generateSymbolFromCurrentState = useCallback(
    async (trigger: GenerationTrigger = "manual") => {
      const keywordsList = keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      if (keywordsList.length === 0) {
        return;
      }

      const controller = realtimeControllerRef.current;
      generationInFlightRef.current = true;
      ongoingGenerationTriggerRef.current = trigger;
      setActiveGenerationTrigger(trigger);
      setIsGenerating(true);

      const startedAt = performance.now();

      try {
        const { width: canvasWidth, height: canvasHeight } = resolveCanvasSize(canvasSizeId);
        const seed = generateSeed(keywordsList, canvasWidth, canvasHeight);

        const lengthScale = 0.7 + (lineLengthSlider / 100) * (1.3 - 0.7);
        const curvatureScale = 0.3 + (curvatureSlider / 100) * (1.7 - 0.3);
        const clusterCount = Math.round(2 + (clusterCountSlider / 100) * 3);
        const clusterSpread = 10 + (clusterSpreadSlider / 100) * 50;

        const includeDebug = debugMode;
        const runAnimation = animationEnabled && trigger === "manual";
        const result = await generateEngineV2(
          keywordsList,
          seed,
          canvasWidth,
          canvasHeight,
          includeDebug,
          {
            lengthScale,
            curvatureScale,
            clusterCount,
            clusterSpread,
            forceOrientation,
            originBridgesEnabled: false,
          }
        );

        const completedAt = performance.now();
        const durationMs = completedAt - startedAt;
        const shouldDropResult = trigger !== "manual" && controller.dropCurrentResult;

        if (shouldDropResult) {
          controller.dropCurrentResult = false;
          controller.skippedRenders += 1;
          console.debug(
            `[RealTimeGeneration] Skipped stale render (trigger=${trigger})`
          );
        } else {
          if (includeDebug && result.debug) {
            const realtimePayload: RealtimeGenerationDebug | undefined =
              trigger === "manual"
                ? undefined
                : {
                    enabled: realtimeFeatureActive,
                    lastTrigger: trigger === "slider" || trigger === "slider-finalize" || trigger === "force-orientation" ? trigger : undefined,
                    durationMs,
                    updatedAt: completedAt,
                    throttleHits: controller.throttleHits,
                    skippedRenders: controller.skippedRenders,
                  };
            setDebugInfo({
              ...result.debug,
              ...(realtimePayload && { realtimeGeneration: realtimePayload }),
            });
          } else {
            setDebugInfo(undefined);
          }

          if (runAnimation) {
            setConnections([]);
            requestAnimationFrame(() => {
              setAnimationProgress(0);
              requestAnimationFrame(() => {
                setConnections(result.connections);
              });
            });
          } else {
            skipAnimationForNextRenderRef.current = true;
            setAnimationProgress(1);
            setConnections(result.connections);
          }

          if (!hasGeneratedOnceRef.current) {
            hasGeneratedOnceRef.current = true;
            setHasGeneratedAtLeastOnce(true);
          }

          if (trigger !== "manual") {
            setRealtimeStats({
              enabled: realtimeFeatureActive,
              lastTrigger: trigger === "slider" || trigger === "slider-finalize" || trigger === "force-orientation" ? trigger : undefined,
              durationMs,
              updatedAt: completedAt,
              throttleHits: controller.throttleHits,
              skippedRenders: controller.skippedRenders,
            });
          }
        }
      } catch (error) {
        console.error("Errore durante la generazione:", error);
        if (trigger === "manual") {
          alert("Errore durante la generazione del simbolo");
        }
      } finally {
        generationInFlightRef.current = false;
        ongoingGenerationTriggerRef.current = null;
        controller.dropCurrentResult = false;
        setIsGenerating(false);
        setActiveGenerationTrigger(null);

        if (
          realtimeFeatureActive &&
          controller.pendingReason &&
          !controller.scheduled &&
          typeof requestAnimationFrame !== "undefined"
        ) {
          controller.scheduled = true;
          controller.frameHandle = requestAnimationFrame(() => {
            controller.scheduled = false;
            processRealtimeQueueRef.current();
          });
        }
      }
    },
    [
      keywords,
      lineLengthSlider,
      curvatureSlider,
      clusterCountSlider,
      clusterSpreadSlider,
      forceOrientation,
      debugMode,
      realtimeFeatureActive,
      canvasSizeId,
      animationEnabled,
    ]
  );

  const processRealtimeQueue = useCallback(() => {
    const controller = realtimeControllerRef.current;

    if (!realtimeFeatureActive) {
      controller.pendingReason = null;
      controller.scheduled = false;
      return;
    }

    if (!controller.pendingReason) {
      return;
    }

    if (generationInFlightRef.current) {
      if (!controller.scheduled && typeof requestAnimationFrame !== "undefined") {
        controller.scheduled = true;
        controller.frameHandle = requestAnimationFrame(() => {
          controller.scheduled = false;
          processRealtimeQueueRef.current();
        });
      }
      return;
    }

    const now = performance.now();
    const delta = now - controller.lastDispatchTs;

    if (delta < REAL_TIME_MIN_INTERVAL_MS) {
      controller.throttleHits += 1;
      console.debug(
        `[RealTimeGeneration] Frame throttled (${delta.toFixed(2)}ms)`
      );
      if (!controller.scheduled && typeof requestAnimationFrame !== "undefined") {
        controller.scheduled = true;
        controller.frameHandle = requestAnimationFrame(() => {
          controller.scheduled = false;
          processRealtimeQueueRef.current();
        });
      }
      return;
    }

    const reason = controller.pendingReason;
    controller.pendingReason = null;
    controller.lastDispatchTs = now;

    void generateSymbolFromCurrentState(reason ?? "slider");
  }, [generateSymbolFromCurrentState, realtimeFeatureActive]);

  useEffect(() => {
    processRealtimeQueueRef.current = processRealtimeQueue;
  }, [processRealtimeQueue]);

  const scheduleRealtimeGeneration = useCallback(
    (reason: GenerationTrigger = "slider") => {
      if (!realtimeFeatureActive || !hasGeneratedOnceRef.current) {
        return;
      }

      const controller = realtimeControllerRef.current;
      controller.pendingReason = reason;

      if (
        generationInFlightRef.current &&
        ongoingGenerationTriggerRef.current &&
        ongoingGenerationTriggerRef.current !== "manual"
      ) {
        controller.dropCurrentResult = true;
      }

      if (!controller.scheduled && typeof requestAnimationFrame !== "undefined") {
        controller.scheduled = true;
        controller.frameHandle = requestAnimationFrame(() => {
          controller.scheduled = false;
          processRealtimeQueueRef.current();
        });
      }
    },
    [realtimeFeatureActive]
  );

  useEffect(() => {
    const controller = realtimeControllerRef.current;
    return () => {
      if (controller.frameHandle !== null && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(controller.frameHandle);
      }
    };
  }, []);

  useEffect(() => {
    const controller = realtimeControllerRef.current;
    if (!realtimeFeatureActive) {
      if (controller.frameHandle !== null && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(controller.frameHandle);
        controller.frameHandle = null;
      }
      controller.pendingReason = null;
      controller.dropCurrentResult = false;
    }
  }, [realtimeFeatureActive]);

  useEffect(() => {
    if (!realtimeFeatureActive) {
      sliderDragRef.current = null;
      setRealtimeStats(undefined);
      return;
    }

    const handlePointerUp = () => {
      if (sliderDragRef.current) {
        sliderDragRef.current = null;
        scheduleRealtimeGeneration("slider-finalize");
      }
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [realtimeFeatureActive, scheduleRealtimeGeneration]);

  /**
   * Genera il simbolo (called by "Genera" button)
   */
  async function handleGenerate() {
    // Validate keywords before generating
    const keywordsList = keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywordsList.length === 0) {
      alert("Inserisci almeno una keyword");
      return;
    }

    await generateSymbolFromCurrentState("manual");
  }

  const generationButtonLabel = isGenerating
    ? activeGenerationTrigger && activeGenerationTrigger !== "manual"
      ? "Anteprima in tempo reale..."
      : "Generazione in corso..."
    : "Genera";

  const realtimeIndicatorText =
    isGenerating && activeGenerationTrigger && activeGenerationTrigger !== "manual"
      ? "Aggiornamento in tempo reale..."
      : realtimeStats
      ? `Ultimo update: ${
          realtimeStats.durationMs !== undefined ? `${realtimeStats.durationMs.toFixed(1)} ms` : "n/d"
        }`
      : "In attesa del primo render";

  const realtimeIndicatorMeta =
    realtimeStats && (realtimeStats.throttleHits !== undefined || realtimeStats.skippedRenders !== undefined)
      ? `Throttle ${realtimeStats.throttleHits ?? 0} · Skip ${realtimeStats.skippedRenders ?? 0}`
      : undefined;

  // Resolve effective canvas dimensions for preview/export (hardcoded to square)
  // Note: This is also resolved inside handleGenerate for geometry generation
  // to ensure consistency between generation and preview/export
  const { width: canvasWidth, height: canvasHeight } = resolveCanvasSize("square");

  const connectionsAvailable = connections.length > 0;

  return (
    <div className="page-shell">
      <div className="layout-main">
        <div className="controls-panel">
          <div className="brand-block">
            <img src="/logo.png" alt="Logo" className="brand-logo" />
          </div>

          {/* Form Keywords */}
          <div className="field-group">
            <label htmlFor="keywords" className="field-label">
              Keywords separate dalla virgola
            </label>
            <textarea
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Azione, impronta, specifico"
              className="text-input"
            />
          </div>

          {/* Sliders */}
          <div className="slider-stack">
            <div className="slider-row">
              <div className="slider-label-wrapper">
                <label htmlFor="lineLength" className="field-label">
                  Lunghezza linee
                </label>
                <span className="slider-value">{lineLengthSlider}</span>
              </div>
              <input
                id="lineLength"
                type="range"
                min="0"
                max="100"
                step="1"
                value={lineLengthSlider}
                onChange={(e) => {
                  setLineLengthSlider(parseInt(e.target.value, 10));
                  scheduleRealtimeGeneration("slider");
                }}
                onPointerDown={() => {
                  if (realtimeFeatureActive) {
                    sliderDragRef.current = "lineLength";
                  }
                }}
              />
            </div>

            <div className="slider-row">
              <div className="slider-label-wrapper">
                <label htmlFor="curvature" className="field-label">
                  Curvatura linee
                </label>
                <span className="slider-value">{curvatureSlider}</span>
              </div>
              <input
                id="curvature"
                type="range"
                min="0"
                max="100"
                step="1"
                value={curvatureSlider}
                onChange={(e) => {
                  setCurvatureSlider(parseInt(e.target.value, 10));
                  scheduleRealtimeGeneration("slider");
                }}
                onPointerDown={() => {
                  if (realtimeFeatureActive) {
                    sliderDragRef.current = "curvature";
                  }
                }}
              />
            </div>

            <div className="slider-row">
              <div className="slider-label-wrapper">
                <label htmlFor="clusterCount" className="field-label">
                  Numero cluster
                </label>
                <span className="slider-value">{clusterCountSlider}</span>
              </div>
              <input
                id="clusterCount"
                type="range"
                min="0"
                max="100"
                step="1"
                value={clusterCountSlider}
                onChange={(e) => {
                  setClusterCountSlider(parseInt(e.target.value, 10));
                  scheduleRealtimeGeneration("slider");
                }}
                onPointerDown={() => {
                  if (realtimeFeatureActive) {
                    sliderDragRef.current = "clusterCount";
                  }
                }}
              />
            </div>

            <div className="slider-row">
              <div className="slider-label-wrapper">
                <label htmlFor="clusterSpread" className="field-label">
                  Ampiezza cluster
                </label>
                <span className="slider-value">{clusterSpreadSlider}</span>
              </div>
              <input
                id="clusterSpread"
                type="range"
                min="0"
                max="100"
                step="1"
                value={clusterSpreadSlider}
                onChange={(e) => {
                  setClusterSpreadSlider(parseInt(e.target.value, 10));
                  scheduleRealtimeGeneration("slider");
                }}
                onPointerDown={() => {
                  if (realtimeFeatureActive) {
                    sliderDragRef.current = "clusterSpread";
                  }
                }}
              />
            </div>
          </div>

          <div className="toggle-grid">
            <label className="field-label inline">
              <input
                type="checkbox"
                checked={forceOrientation}
                onChange={(e) => setForceOrientation(e.target.checked)}
                onClick={() => scheduleRealtimeGeneration("force-orientation")}
              />
              Force orientation
            </label>
            <label className="field-label inline">
              <input
                type="checkbox"
                checked={animationEnabled}
                onChange={(e) => setAnimationEnabled(e.target.checked)}
              />
              Animazione
            </label>
            <label className="field-label inline">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
              />
              Debug mode
            </label>
            <label className="field-label inline">
              <input
                type="checkbox"
                checked={realtimePreviewEnabled}
                onChange={(e) => setRealtimePreviewEnabled(e.target.checked)}
                disabled={!REAL_TIME_GENERATION_FLAG}
              />
              Anteprima real-time
            </label>
            <label className="field-label inline">
              <input
                type="checkbox"
                checked={layoutDebugMode}
                onChange={(e) => setLayoutDebugMode(e.target.checked)}
              />
              Layout debug
            </label>
          </div>

          <div className="action-row">
            <button onClick={handleGenerate} disabled={isGenerating} className="primary-button">
              {generationButtonLabel}
            </button>
            {connectionsAvailable ? (
              <DownloadSvgButton
                connections={connections}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            ) : (
              <button className="secondary-button" disabled>
                Download SVG
              </button>
            )}
          </div>
        </div>

        <div className="preview-panel">
          {connectionsAvailable ? (
            <SvgPreview
              connections={connections}
              animationEnabled={animationEnabled}
              animationProgress={animationProgress}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              debugInfo={debugMode ? debugInfo : undefined}
              debugMode={debugMode}
            />
          ) : (
            <div className="preview-placeholder">Genera per vedere l&apos;anteprima</div>
          )}
        </div>
      </div>
      <LayoutDebugOverlay enabled={layoutDebugMode} />
    </div>
  );
}
