"use client";

/**
 * Pagina principale SFCM Symbol Generator
 * UI con form keywords, slider e canvas rendering
 */

import { useState, useEffect, useRef } from "react";
import { cyrb53 } from "../lib/seed";
import type { BranchedConnection, EngineV2DebugInfo } from "../lib/types";
import { generateEngineV2 } from "../lib/engine_v2/engine";
import SvgPreview from "../components/SvgPreview";
import DownloadSvgButton from "../components/DownloadSvgButton";
import {
  type CanvasSizeId,
  resolveCanvasSize,
  validateCustomSize,
} from "../lib/canvasSizeConfig";

export default function Home() {
  const [keywords, setKeywords] = useState("ordine, caos, conflitto, consenso");
  
  // Slider state variables
  // Slider1: "Lunghezza linee" - controls lengthScale in ENGINE_V2 (0-100, default 50)
  const [lineLengthSlider, setLineLengthSlider] = useState(50);
  // Slider2: "Curvatura linee" - controls curvatureScale in ENGINE_V2 (0-100, default 50)
  const [curvatureSlider, setCurvatureSlider] = useState(50);
  // Slider3: "Numero Cluster" - controls clusterCount in ENGINE_V2 (0-100, default 33 → clusterCount = 3)
  const [clusterCountSlider, setClusterCountSlider] = useState(33);
  // Slider4: "Ampiezza Cluster" - controls clusterSpread in ENGINE_V2 (0-100, default 40 → clusterSpread = 30)
  const [clusterSpreadSlider, setClusterSpreadSlider] = useState(40);
  // Placeholder sliders (ENGINE_V2 placeholders - no effect on generation yet)
  // NOTE: These sliders are kept in the UI for future mapping according to ENGINE_V2_SLIDER_MAPPING.md.
  const [complessita, setComplessita] = useState(0.5);
  const [mutamento, setMutamento] = useState(0.5);
  const [connections, setConnections] = useState<BranchedConnection[]>([]);
  const [debugInfo, setDebugInfo] = useState<EngineV2DebugInfo | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [animationProgress, setAnimationProgress] = useState(1); // 1 = fully drawn by default
  const [debugMode, setDebugMode] = useState(false); // Debug overlay toggle

  // Track if user has generated at least once (to prevent auto-generation on initial mount)
  const hasGeneratedOnceRef = useRef(false);

  // Canvas size state
  const [canvasSizeId, setCanvasSizeId] = useState<CanvasSizeId>("square");
  const [customWidth, setCustomWidth] = useState<number | "">("");
  const [customHeight, setCustomHeight] = useState<number | "">("");
  const [viewportWidth, setViewportWidth] = useState<number>(1080);
  const [viewportHeight, setViewportHeight] = useState<number>(1080);

  /**
   * Update viewport dimensions for "fit screen" option
   * Uses useEffect to avoid SSR/hydration issues with window object
   */
  useEffect(() => {
    if (canvasSizeId === "fit") {
      const updateViewport = () => {
        if (typeof window !== "undefined") {
          setViewportWidth(window.innerWidth);
          setViewportHeight(window.innerHeight);
        }
      };
      updateViewport();
      if (typeof window !== "undefined") {
        window.addEventListener("resize", updateViewport);
        return () => window.removeEventListener("resize", updateViewport);
      }
    }
  }, [canvasSizeId]);

  /**
   * Auto-regenerate symbol when canvas size changes (if keywords exist)
   * Only triggers after user has generated at least once manually
   */
  useEffect(() => {
    // Skip if user hasn't generated at least once (prevent auto-generation on initial mount)
    if (!hasGeneratedOnceRef.current) {
      return;
    }

    // Skip if no keywords (empty or whitespace-only)
    const keywordsList = keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywordsList.length === 0) {
      return; // No keywords - do nothing
    }

    // Skip if generation is already in progress
    if (isGenerating) {
      return;
    }

    // Skip if custom size is selected but invalid
    if (canvasSizeId === "custom" && !validateCustomSize(customWidth, customHeight)) {
      return;
    }

    // Auto-trigger generation with current state
    generateSymbolFromCurrentState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSizeId, customWidth, customHeight, viewportWidth, viewportHeight]);

  /**
   * Animation loop: animates animationProgress from 0 to 1 when animationEnabled is true
   */
  useEffect(() => {
    // If animation is disabled, always show fully drawn symbol
    if (!animationEnabled) {
      setAnimationProgress(1);
      return;
    }

    // If there are no connections, nothing to animate
    if (connections.length === 0) {
      setAnimationProgress(1);
      return;
    }

    let frameId: number;
    const duration = 3000; // 3 seconds for full animation
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      setAnimationProgress(t);

      if (t < 1 && animationEnabled) {
        frameId = requestAnimationFrame(tick);
      }
    };

    // Ensure we start from 0 whenever this effect runs
    setAnimationProgress(0);
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [animationEnabled, connections]);

  /**
   * Genera seed globale deterministico da keywords e canvas size
   * 
   * NOTE: Only lineLengthSlider influences generation via lengthScale.
   * Other sliders (ramificazione, complessità, mutamento) are placeholders
   * and do not influence generation. They are kept in the UI but not used in the seed.
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

  /**
   * Core generation logic - extracted for reuse by handleGenerate and auto-regeneration
   * Uses current component state (keywords, sliders, canvas dimensions) to generate symbol
   */
  async function generateSymbolFromCurrentState() {
    // 1. Normalizza e splitta keywords
    const keywordsList = keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywordsList.length === 0) {
      return; // No keywords - do nothing
    }

    setIsGenerating(true);
    try {
      // Resolve canvas dimensions for geometry generation
      const { width: canvasWidth, height: canvasHeight } = resolveCanvasSize(
        canvasSizeId,
        customWidth,
        customHeight,
        viewportWidth,
        viewportHeight
      );

      // Generate seed (based on keywords and canvas size only)
      // NOTE: Sliders (lengthScale, curvatureScale) do not affect seed - they modify geometry post-generation
      const seed = generateSeed(keywordsList, canvasWidth, canvasHeight);

      // Map Slider1 (0-100) to lengthScale (0.7-1.3)
      // Formula: lengthScale = 0.7 + (slider / 100) * (1.3 - 0.7)
      // s = 0   → lengthScale = 0.7   (shorter lines)
      // s = 50  → lengthScale = 1.0   (baseline)
      // s = 100 → lengthScale = 1.3   (longer lines)
      const s = lineLengthSlider; // 0..100
      const lengthScale = 0.7 + (s / 100) * (1.3 - 0.7);

      // Map Slider2 "Curvatura linee" (0-100) to curvatureScale (0.3-1.7)
      // Formula: curvatureScale = 0.3 + (slider / 100) * (1.7 - 0.3)
      // s = 0   → curvatureScale = 0.3   (curve meno marcate)
      // s = 50  → curvatureScale = 1.0   (baseline)
      // s = 100 → curvatureScale = 1.7   (curve molto marcate)
      const curvatureScale = 0.3 + (curvatureSlider / 100) * (1.7 - 0.3);

      // Map Slider3 "Numero Cluster" (0-100) to clusterCount (2-5)
      // Formula: clusterCount = Math.round(2 + (slider / 100) * 3)
      // s = 0   → clusterCount = 2
      // s = 33  → clusterCount = 3 (default)
      // s = 100 → clusterCount = 5
      const clusterCount = Math.round(2 + (clusterCountSlider / 100) * 3);

      // Map Slider4 "Ampiezza Cluster" (0-100) to clusterSpread (10-60)
      // Formula: clusterSpread = 10 + (slider / 100) * 50
      // s = 0   → clusterSpread = 10  (cluster stretti)
      // s = 40  → clusterSpread = 30  (default)
      // s = 100 → clusterSpread = 60  (cluster ampi)
      const clusterSpread = 10 + (clusterSpreadSlider / 100) * 50;

      // ENGINE_V2: Generate connections using the new 4-axis engine
      // includeDebug: only capture debug info when debugMode is enabled
      const result = await generateEngineV2(
        keywordsList,
        seed,
        canvasWidth,
        canvasHeight,
        debugMode,
        { lengthScale, curvatureScale, clusterCount, clusterSpread }
      );

      // CRITICAL: Reset animation state BEFORE setting new connections
      // This prevents ghost lines/flash when canvas size changes:
      // Strategy:
      // 1. Clear old connections immediately (empty array = no visible lines)
      // 2. Reset animation progress to 0 (ensures animation starts from empty)
      // 3. Set animation enabled
      // 4. Set new connections in next frame (after state updates are batched)
      // This ensures no frame shows fully drawn lines before animation starts
      setConnections([]);
      if (debugMode) {
        setDebugInfo(result.debug);
      } else {
        setDebugInfo(undefined);
      }
      
      // Use flushSync or double RAF to ensure state updates happen in correct order
      // First RAF: ensure connections are cleared and animation state is reset
      requestAnimationFrame(() => {
        setAnimationProgress(0);
        setAnimationEnabled(true);
        
        // Second RAF: set new connections after animation state is ready
        requestAnimationFrame(() => {
          setConnections(result.connections);
        });
      });
      
      // Mark that generation has happened at least once
      hasGeneratedOnceRef.current = true;
    } catch (error) {
      console.error("Errore durante la generazione:", error);
      alert("Errore durante la generazione del simbolo");
    } finally {
      setIsGenerating(false);
    }
  }

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

    await generateSymbolFromCurrentState();
  }

  // Validate custom size for enabling generate button
  const isCustomSizeValid =
    canvasSizeId !== "custom" ||
    validateCustomSize(customWidth, customHeight);

  // Resolve effective canvas dimensions for preview/export
  // Note: This is also resolved inside handleGenerate for geometry generation
  // to ensure consistency between generation and preview/export
  const { width: canvasWidth, height: canvasHeight } = resolveCanvasSize(
    canvasSizeId,
    customWidth,
    customHeight,
    viewportWidth,
    viewportHeight
  );

  return (
    <div className="page-shell">
      <div className="layout-main">
        <div className="controls-panel">
          <h1 style={{ fontSize: "2rem" }}>
            SFCM Symbol Generator
          </h1>

          {/* Form Keywords */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label htmlFor="keywords" style={{ fontSize: "1.1rem" }}>
              Keywords (separate da virgola):
            </label>
            <textarea
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="es: ordine, caos, conflitto, consenso"
              style={{
                padding: "0.75rem",
                fontSize: "1rem",
                fontFamily: "Times New Roman, serif",
                backgroundColor: "#111",
                color: "#fff",
                border: "1px solid #333",
                borderRadius: "4px",
                minHeight: "80px",
                resize: "vertical",
              }}
            />
          </div>

          {/* Sliders */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Slider1: Lunghezza linee - controls lengthScale in ENGINE_V2 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="lineLength" style={{ fontSize: "1rem" }}>
                Lunghezza linee: {lineLengthSlider}
              </label>
              <input
                id="lineLength"
                type="range"
                min="0"
                max="100"
                step="1"
                value={lineLengthSlider}
                onChange={(e) => setLineLengthSlider(parseInt(e.target.value, 10))}
                style={{ width: "100%" }}
              />
            </div>

            {/* Slider2: Curvatura linee - controls curvatureScale in ENGINE_V2 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="curvature" style={{ fontSize: "1rem" }}>
                Curvatura linee: {curvatureSlider}
              </label>
              <input
                id="curvature"
                type="range"
                min="0"
                max="100"
                step="1"
                value={curvatureSlider}
                onChange={(e) => setCurvatureSlider(parseInt(e.target.value, 10))}
                style={{ width: "100%" }}
              />
            </div>

            {/* Slider3: Numero Cluster - controls clusterCount in ENGINE_V2 (patch03) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="clusterCount" style={{ fontSize: "1rem" }}>
                Numero Cluster: {Math.round(2 + (clusterCountSlider / 100) * 3)}
              </label>
              <input
                id="clusterCount"
                type="range"
                min="0"
                max="100"
                step="1"
                value={clusterCountSlider}
                onChange={(e) => setClusterCountSlider(parseInt(e.target.value, 10))}
                style={{ width: "100%" }}
              />
            </div>

            {/* Slider4: Ampiezza Cluster - controls clusterSpread in ENGINE_V2 (patch03) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="clusterSpread" style={{ fontSize: "1rem" }}>
                Ampiezza Cluster: {Math.round(10 + (clusterSpreadSlider / 100) * 50)}°
              </label>
              <input
                id="clusterSpread"
                type="range"
                min="0"
                max="100"
                step="1"
                value={clusterSpreadSlider}
                onChange={(e) => setClusterSpreadSlider(parseInt(e.target.value, 10))}
                style={{ width: "100%" }}
              />
            </div>

            {/* Placeholder sliders (ENGINE_V2 placeholders - no effect on generation yet) */}
            {/* These sliders are kept in the UI for future mapping according to ENGINE_V2_SLIDER_MAPPING.md. */}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="complessita" style={{ fontSize: "1rem" }}>
                Complessità: {complessita.toFixed(2)}
              </label>
              <input
                id="complessita"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={complessita}
                onChange={(e) => setComplessita(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="mutamento" style={{ fontSize: "1rem" }}>
                Mutamento: {mutamento.toFixed(2)}
              </label>
              <input
                id="mutamento"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={mutamento}
                onChange={(e) => setMutamento(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>

          </div>

          {/* Canvas Size Selection */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ fontSize: "1rem", fontWeight: "bold" }}>
              Canvas Size:
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {(["square", "4_5", "9_16", "16_9", "fit", "custom"] as const).map(
                (id) => (
                  <label
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.95rem",
                    }}
                  >
                    <input
                      type="radio"
                      name="canvasSize"
                      value={id}
                      checked={canvasSizeId === id}
                      onChange={(e) => setCanvasSizeId(e.target.value as CanvasSizeId)}
                    />
                    <span>
                      {id === "square"
                        ? "1:1 (1080×1080)"
                        : id === "4_5"
                        ? "4:5 (1080×1350)"
                        : id === "9_16"
                        ? "9:16 (1080×1920)"
                        : id === "16_9"
                        ? "16:9 (1920×1080)"
                        : id === "fit"
                        ? "Fit Screen"
                        : "Custom"}
                    </span>
                  </label>
                )
              )}
            </div>

            {/* Custom size inputs */}
            {canvasSizeId === "custom" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  marginLeft: "1.5rem",
                  padding: "0.75rem",
                  border: "1px solid #333",
                  borderRadius: "4px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label htmlFor="customWidth" style={{ fontSize: "0.9rem" }}>
                    Width (px):
                  </label>
                  <input
                    id="customWidth"
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={customWidth}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomWidth(val === "" ? "" : parseInt(val, 10));
                    }}
                    placeholder="1080"
                    style={{
                      padding: "0.5rem",
                      fontSize: "0.9rem",
                      fontFamily: "Times New Roman, serif",
                      backgroundColor: "#111",
                      color: "#fff",
                      border: "1px solid #333",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label htmlFor="customHeight" style={{ fontSize: "0.9rem" }}>
                    Height (px):
                  </label>
                  <input
                    id="customHeight"
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={customHeight}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomHeight(val === "" ? "" : parseInt(val, 10));
                    }}
                    placeholder="1080"
                    style={{
                      padding: "0.5rem",
                      fontSize: "0.9rem",
                      fontFamily: "Times New Roman, serif",
                      backgroundColor: "#111",
                      color: "#fff",
                      border: "1px solid #333",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                {!isCustomSizeValid && (
                  <div style={{ fontSize: "0.85rem", color: "#ff6b6b" }}>
                    Please enter valid width and height (1-10000px)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Animation Control */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={animationEnabled}
                onChange={(e) => setAnimationEnabled(e.target.checked)}
              />
              Animazione
            </label>
          </div>

          {/* Debug Mode Control */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
              />
              Debug mode
            </label>
          </div>

          {/* Pulsante Genera */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !isCustomSizeValid}
            style={{
              padding: "1rem 2rem",
              fontSize: "1.1rem",
              fontFamily: "Times New Roman, serif",
              backgroundColor: isGenerating ? "#333" : "#fff",
              color: isGenerating ? "#666" : "#000",
              border: "none",
              borderRadius: "4px",
              cursor: isGenerating ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {isGenerating ? "Generazione in corso..." : "Genera"}
          </button>
        </div>

        <div className="preview-panel">
          {connections.length > 0 && (
            <SvgPreview
              connections={connections}
              animationEnabled={animationEnabled}
              animationProgress={animationProgress}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              debugInfo={debugMode ? debugInfo : undefined}
              debugMode={debugMode}
            />
          )}
        </div>
      </div>
      {connections.length > 0 && (
        <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center" }}>
          <DownloadSvgButton
            connections={connections}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
        </div>
      )}
    </div>
  );
}
