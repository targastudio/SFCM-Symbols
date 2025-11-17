/**
 * Canvas Size Configuration
 * 
 * Provides a single source of truth for canvas size options and dimensions.
 * Used by:
 * - SvgPreview: for rendering SVG with correct dimensions and viewBox
 * - DownloadSvgButton: for passing dimensions to export
 * - prepareSvgForExport: for setting correct width/height/viewBox in exported SVG
 * 
 * Supported canvas sizes:
 * - square (1:1) - 1080×1080
 * - 4_5 (portrait 4:5) - 1080×1350
 * - 9_16 (portrait 9:16) - 1080×1920
 * - 16_9 (landscape 16:9) - 1920×1080
 * - fit (fit screen) - uses viewport dimensions (fallback 1080×1080)
 * - custom - user-defined width and height
 */

export type CanvasSizeId =
  | "square"
  | "4_5"
  | "9_16"
  | "16_9"
  | "fit"
  | "custom";

export const CANVAS_PRESETS = {
  square: { width: 1080, height: 1080 },
  "4_5": { width: 1080, height: 1350 },
  "9_16": { width: 1080, height: 1920 },
  "16_9": { width: 1920, height: 1080 },
  fit: { responsive: true },
  custom: { custom: true },
} as const;

/**
 * Resolves canvas dimensions based on the selected size option.
 * 
 * @param id - Canvas size option ID
 * @param customWidth - Custom width (required if id === "custom")
 * @param customHeight - Custom height (required if id === "custom")
 * @param viewportWidth - Viewport width (used for "fit" option, fallback 1080)
 * @param viewportHeight - Viewport height (used for "fit" option, fallback 1080)
 * @returns Resolved canvas dimensions { width, height }
 */
export function resolveCanvasSize(
  id: CanvasSizeId,
  customWidth?: number | "",
  customHeight?: number | "",
  viewportWidth?: number,
  viewportHeight?: number
): { width: number; height: number } {
  // Handle preset sizes
  if (id === "square" || id === "4_5" || id === "9_16" || id === "16_9") {
    const preset = CANVAS_PRESETS[id];
    if ("width" in preset && "height" in preset) {
      return { width: preset.width, height: preset.height };
    }
  }

  // Handle "fit" option - use viewport or fallback to 1080×1080
  if (id === "fit") {
    const width = viewportWidth && viewportWidth > 0 ? viewportWidth : 1080;
    const height = viewportHeight && viewportHeight > 0 ? viewportHeight : 1080;
    return { width, height };
  }

  // Handle "custom" option - validate and use custom dimensions
  if (id === "custom") {
    const width =
      typeof customWidth === "number" && customWidth > 0
        ? Math.round(customWidth)
        : 1080;
    const height =
      typeof customHeight === "number" && customHeight > 0
        ? Math.round(customHeight)
        : 1080;
    return { width, height };
  }

  // Fallback to square (1080×1080)
  return { width: 1080, height: 1080 };
}

/**
 * Validates custom canvas dimensions.
 * 
 * @param width - Custom width value
 * @param height - Custom height value
 * @returns true if both values are valid positive numbers
 */
export function validateCustomSize(
  width: number | "",
  height: number | ""
): boolean {
  if (typeof width !== "number" || typeof height !== "number") {
    return false;
  }
  if (width <= 0 || height <= 0) {
    return false;
  }
  // Reasonable upper bound (e.g., 10000px)
  if (width > 10000 || height > 10000) {
    return false;
  }
  return true;
}

