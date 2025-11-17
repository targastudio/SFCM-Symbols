/**
 * SVG Export Helper
 *
 * Prepares an SVG element for export by:
 * - Deep cloning (never mutating the original)
 * - Normalizing root attributes (xmlns, width, height, viewBox)
 * - Inlining computed styles as presentation attributes (for Illustrator/Figma compatibility)
 * - Expanding SVG markers into explicit arrowhead geometry (for tool compatibility)
 * - Ensuring background rectangle exists
 * - Removing animation-only attributes
 * - Serializing to clean XML
 *
 * This ensures the exported SVG works correctly in Illustrator, Figma, and browsers
 * without relying on CSS classes or external stylesheets.
 */

import {
  BASE_STROKE_WIDTH,
  STROKE_COLOR,
  ARROW_WIDTH_PX,
  ARROW_HEIGHT_PX,
  ARROW_MARKER_ID,
  ARROW_MARKER_UNITS,
  BACKGROUND_COLOR,
} from "./svgStyleConfig";

const SVG_NS = "http://www.w3.org/2000/svg";
const ANIMATION_DASHARRAY_THRESHOLD = 1000; // Values >= this are animation patterns

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Normalizes color values to hex format for better compatibility.
 * Converts rgb/rgba strings to #hex format.
 */
function normalizeColor(color: string): string {
  if (color.startsWith("#")) {
    return color;
  }

  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  const namedColors: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    none: "none",
  };
  if (namedColors[color.toLowerCase()]) {
    return namedColors[color.toLowerCase()];
  }

  return color;
}

// ============================================================================
// Root SVG Attribute Normalization
// ============================================================================

/**
 * Normalizes root SVG attributes (xmlns, width, height, viewBox).
 * Ensures all required attributes are present with valid values.
 * Uses the provided canvas dimensions instead of extracting from the SVG.
 */
function normalizeRootAttributes(
  svgClone: SVGSVGElement,
  canvasWidth: number,
  canvasHeight: number
): {
  width: string;
  height: string;
  viewBox: string;
} {
  svgClone.setAttribute("xmlns", SVG_NS);

  // Use provided canvas dimensions
  const width = canvasWidth.toString();
  const height = canvasHeight.toString();
  const viewBox = `0 0 ${canvasWidth} ${canvasHeight}`;

  svgClone.setAttribute("width", width);
  svgClone.setAttribute("height", height);
  svgClone.setAttribute("viewBox", viewBox);

  return { width, height, viewBox };
}

// ============================================================================
// Background Rectangle
// ============================================================================

/**
 * Ensures the background rectangle exists and is properly configured.
 * The background must be black and cover the full canvas.
 */
function ensureBackgroundRect(
  svgClone: SVGSVGElement,
  width: string,
  height: string
): void {
  let bgRect = svgClone.querySelector(`rect[fill="${BACKGROUND_COLOR}"]`) as SVGRectElement | null;

  if (!bgRect) {
    bgRect = document.createElementNS(SVG_NS, "rect");
    bgRect.setAttribute("x", "0");
    bgRect.setAttribute("y", "0");
    bgRect.setAttribute("width", width);
    bgRect.setAttribute("height", height);
    bgRect.setAttribute("fill", BACKGROUND_COLOR);

    // Insert as first child (after defs if present)
    const defs = svgClone.querySelector("defs");
    if (defs && defs.nextSibling) {
      svgClone.insertBefore(bgRect, defs.nextSibling);
    } else if (defs) {
      svgClone.appendChild(bgRect);
    } else {
      svgClone.insertBefore(bgRect, svgClone.firstChild);
    }
  } else {
    // Normalize existing background rect
    bgRect.setAttribute("fill", BACKGROUND_COLOR);
    bgRect.setAttribute("x", "0");
    bgRect.setAttribute("y", "0");
    bgRect.setAttribute("width", width);
    bgRect.setAttribute("height", height);
  }
}

// ============================================================================
// Style Inlining
// ============================================================================

/**
 * Checks if a strokeDasharray value is an animation pattern.
 * Animation patterns use very large numbers (>= 1000), real dashes are small (< 100).
 */
function isAnimationDasharray(dasharray: string): boolean {
  const firstNumberMatch = dasharray.match(/^(\d+)/);
  if (!firstNumberMatch) return false;
  const firstNumber = parseInt(firstNumberMatch[1], 10);
  return firstNumber >= ANIMATION_DASHARRAY_THRESHOLD;
}

/**
 * Checks if an element is a connection element (path or line that's not the background).
 */
function isConnectionElement(element: Element): boolean {
  return (
    (element.tagName === "path" || element.tagName === "line") &&
    element.getAttribute("fill") !== BACKGROUND_COLOR
  );
}

/**
 * Inlines computed styles from the original element onto the cloned element
 * as explicit presentation attributes. This is necessary for Illustrator/Figma
 * which don't always respect CSS classes or computed styles.
 */
function inlineStylesForElement(
  originalElement: Element,
  clonedElement: Element
): void {
  if (
    !(
      originalElement instanceof SVGGraphicsElement &&
      clonedElement instanceof SVGGraphicsElement
    )
  ) {
    return;
  }

  const computed = window.getComputedStyle(originalElement);
  const isConnection = isConnectionElement(clonedElement);
  // Arrowhead paths can be either:
  // 1. Inside markers (marker definitions)
  // 2. Explicit triangles created by expandMarkersIntoGeometry (have fill="#ffffff")
  const isArrowheadPath =
    (clonedElement.tagName === "path" && clonedElement.closest("marker")) ||
    (clonedElement.tagName === "path" && clonedElement.getAttribute("fill") === STROKE_COLOR);

  // Stroke properties - CRITICAL: ensure connections always have visible strokes
  // For Illustrator compatibility, we must set explicit presentation attributes
  // IMPORTANT: Check if attributes were already set explicitly (from step 4) - don't override them
  if (isConnection) {
    // Check if this was explicitly set in step 4 (preserve those values)
    const isExplicitlySet = clonedElement.getAttribute("data-explicit-stroke") === "true";
    
    if (isExplicitlySet) {
      // Already explicitly set in step 4 - preserve those values, don't override
      // Just ensure fill is "none" and remove style
      clonedElement.setAttribute("fill", "none");
      clonedElement.removeAttribute("style");
      // Remove the marker attribute so it doesn't interfere
      clonedElement.removeAttribute("data-explicit-stroke");
    } else {
      // Not explicitly set - set it now
      clonedElement.setAttribute("stroke", STROKE_COLOR);
      clonedElement.setAttribute("stroke-width", BASE_STROKE_WIDTH.toString());
      clonedElement.setAttribute("fill", "none");
      clonedElement.removeAttribute("style");
    }
  } else {
    // For non-connection elements, check if this is an arrowhead path
    if (isArrowheadPath) {
      // Arrowhead paths must be fill-only (no stroke) to avoid duplicate paths in Illustrator
      // Don't apply any stroke attributes from computed styles
      clonedElement.setAttribute("stroke", "none");
      clonedElement.setAttribute("stroke-width", "0");
    } else {
      // For other non-connection elements (background, etc.), use computed values
      const stroke = computed.stroke;
      if (stroke && stroke !== "none" && stroke !== "rgba(0, 0, 0, 0)") {
        clonedElement.setAttribute("stroke", normalizeColor(stroke));
      }

      const strokeWidth = computed.strokeWidth;
      if (strokeWidth && strokeWidth !== "0px" && parseFloat(strokeWidth) > 0) {
        clonedElement.setAttribute("stroke-width", strokeWidth);
      }
    }
  }

  // Stroke linecap and linejoin - only for connection elements, not arrowheads
  if (!isArrowheadPath) {
    const strokeLinecap = computed.strokeLinecap;
    if (strokeLinecap && strokeLinecap !== "butt") {
      clonedElement.setAttribute("stroke-linecap", strokeLinecap);
    }

    const strokeLinejoin = computed.strokeLinejoin;
    if (strokeLinejoin && strokeLinejoin !== "miter") {
      clonedElement.setAttribute("stroke-linejoin", strokeLinejoin);
    }
  } else {
    // Remove stroke-related attributes from arrowhead paths
    clonedElement.removeAttribute("stroke-linecap");
    clonedElement.removeAttribute("stroke-linejoin");
  }

  // Stroke dasharray - remove animation patterns, keep real dashes
  // Arrowhead paths should never have dasharray
  if (isArrowheadPath) {
    // Remove dasharray from arrowhead paths
    clonedElement.removeAttribute("stroke-dasharray");
  } else {
    const strokeDasharray = computed.strokeDasharray;
    if (strokeDasharray && strokeDasharray !== "none") {
      if (!isAnimationDasharray(strokeDasharray)) {
        clonedElement.setAttribute("stroke-dasharray", strokeDasharray);
      } else {
        clonedElement.removeAttribute("stroke-dasharray");
      }
    } else {
      clonedElement.removeAttribute("stroke-dasharray");
    }
  }

  // Remove strokeDashoffset (animation-only)
  clonedElement.removeAttribute("stroke-dashoffset");

  // Fill properties - only set for non-connection elements
  // Connection elements already have fill="none" set above
  if (!isConnection) {
    // For arrowhead paths (both in markers and explicit triangles), ensure fill-only
    if (isArrowheadPath) {
      // This is an arrowhead path - ensure it has fill and no stroke
      // CRITICAL: Explicitly set fill for Illustrator compatibility
      clonedElement.setAttribute("fill", STROKE_COLOR);
      clonedElement.setAttribute("stroke", "none");
      clonedElement.setAttribute("stroke-width", "0");
      // Remove any stroke-related attributes that could create a duplicate path
      clonedElement.removeAttribute("stroke-opacity");
      clonedElement.removeAttribute("stroke-linecap");
      clonedElement.removeAttribute("stroke-linejoin");
      clonedElement.removeAttribute("stroke-dasharray");
      clonedElement.removeAttribute("stroke-dashoffset");
      // Remove style attribute to prevent CSS from adding stroke
      clonedElement.removeAttribute("style");
      // Ensure fill-opacity is not set (defaults to 1.0)
      clonedElement.removeAttribute("fill-opacity");
    } else {
      const fill = computed.fill;
      if (fill && fill !== "none" && fill !== "rgba(0, 0, 0, 0)") {
        clonedElement.setAttribute("fill", normalizeColor(fill));
      } else if (clonedElement.tagName === "path" || clonedElement.tagName === "line") {
        clonedElement.setAttribute("fill", "none");
      }
    }
  }

  // Opacity (only if not 1.0)
  const opacity = computed.opacity;
  if (opacity && opacity !== "1") {
    clonedElement.setAttribute("opacity", opacity);
  } else {
    clonedElement.removeAttribute("opacity");
  }

  const fillOpacity = computed.fillOpacity;
  if (fillOpacity && fillOpacity !== "1") {
    clonedElement.setAttribute("fill-opacity", fillOpacity);
  } else {
    clonedElement.removeAttribute("fill-opacity");
  }

  const strokeOpacity = computed.strokeOpacity;
  if (strokeOpacity && strokeOpacity !== "1") {
    clonedElement.setAttribute("stroke-opacity", strokeOpacity);
  } else {
    clonedElement.removeAttribute("stroke-opacity");
  }

  // Remove class attribute (we've inlined everything as presentation attributes)
  clonedElement.removeAttribute("class");
  
  // Remove style attribute only if we haven't already done so above
  // (connection elements and arrowhead paths have style removed earlier)
  if (!isConnection && !(clonedElement.tagName === "path" && clonedElement.closest("marker"))) {
    clonedElement.removeAttribute("style");
  }
}

/**
 * Recursively walks both the original and cloned SVG trees in parallel,
 * inlining styles for all graphical elements.
 */
function inlineStylesRecursive(
  originalParent: Element,
  clonedParent: Element
): void {
  const originalChildren = Array.from(originalParent.children);
  const clonedChildren = Array.from(clonedParent.children);

  for (let i = 0; i < originalChildren.length && i < clonedChildren.length; i++) {
    const origChild = originalChildren[i];
    const clonedChild = clonedChildren[i];

    // Safety check: ensure tag names match (they should since we cloned)
    if (origChild.tagName !== clonedChild.tagName) {
      console.warn(
        `prepareSvgForExport: Tag name mismatch at index ${i}: ${origChild.tagName} vs ${clonedChild.tagName}`
      );
      continue;
    }

    inlineStylesForElement(origChild, clonedChild);
    inlineStylesRecursive(origChild, clonedChild);
  }
}

// ============================================================================
// Path Parsing Utilities
// ============================================================================

/**
 * Parses SVG path data to extract the endpoint coordinates.
 * Handles both straight paths (M x y L x y) and curves (M x y Q cx cy x y).
 */
function parsePathEndpoint(d: string): { x: number; y: number } | null {
  const commands = d.match(/[MLQ][^MLQZ]*/g);
  if (!commands || commands.length === 0) return null;

  const lastCmd = commands[commands.length - 1];
  const coords = lastCmd
    .substring(1)
    .trim()
    .split(/[\s,]+/)
    .map(parseFloat)
    .filter((n) => !isNaN(n));

  if (coords.length < 2) return null;

  // For Q (quadratic) and L (line) commands, the last two numbers are the endpoint
  return {
    x: coords[coords.length - 2],
    y: coords[coords.length - 1],
  };
}

/**
 * Computes the direction vector for a path's endpoint.
 * For curves, uses the direction from control point to endpoint.
 * For lines, uses the direction from previous point to endpoint.
 */
function computePathDirection(d: string): { x: number; y: number } | null {
  const commands = d.match(/[MLQ][^MLQZ]*/g);
  if (!commands || commands.length === 0) return null;

  const lastCmd = commands[commands.length - 1];
  const coords = lastCmd
    .substring(1)
    .trim()
    .split(/[\s,]+/)
    .map(parseFloat)
    .filter((n) => !isNaN(n));

  if (coords.length < 2) return null;

  const endX = coords[coords.length - 2];
  const endY = coords[coords.length - 1];

  if (lastCmd[0] === "Q" && coords.length >= 4) {
    // For curves, use direction from control point to endpoint
    const cx = coords[coords.length - 4];
    const cy = coords[coords.length - 3];
    const dx = endX - cx;
    const dy = endY - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      return { x: dx / len, y: dy / len };
    }

    // Fallback: use full curve direction
    const firstCmd = commands[0];
    if (!firstCmd) return null;
    const firstCoords = firstCmd
      .substring(1)
      .trim()
      .split(/[\s,]+/)
      .map(parseFloat)
      .filter((n) => !isNaN(n));
    if (firstCoords.length >= 2) {
      const startX = firstCoords[0];
      const startY = firstCoords[1];
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        return { x: dx / len, y: dy / len };
      }
    }
  } else if (lastCmd[0] === "L" || lastCmd[0] === "M") {
    // For lines, use direction from previous point
    if (commands.length >= 2) {
      const prevCmd = commands[commands.length - 2];
      const prevCoords = prevCmd
        .substring(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter((n) => !isNaN(n));
      if (prevCoords.length >= 2) {
        const prevX = prevCoords[prevCoords.length - 2];
        const prevY = prevCoords[prevCoords.length - 1];
        const dx = endX - prevX;
        const dy = endY - prevY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          return { x: dx / len, y: dy / len };
        }
      }
    }
  }

  return null;
}

/**
 * Gets endpoint and direction for a line element.
 */
function getLineEndpointAndDirection(
  elem: SVGLineElement
): { endX: number; endY: number; dirX: number; dirY: number } | null {
  const x1 = parseFloat(elem.getAttribute("x1") || "0");
  const y1 = parseFloat(elem.getAttribute("y1") || "0");
  const x2 = parseFloat(elem.getAttribute("x2") || "0");
  const y2 = parseFloat(elem.getAttribute("y2") || "0");

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return null;

  return {
    endX: x2,
    endY: y2,
    dirX: dx / len,
    dirY: dy / len,
  };
}

/**
 * Gets endpoint and direction for a path element.
 */
function getPathEndpointAndDirection(
  elem: SVGPathElement
): { endX: number; endY: number; dirX: number; dirY: number } | null {
  const d = elem.getAttribute("d");
  if (!d) return null;

  const endpoint = parsePathEndpoint(d);
  if (!endpoint) return null;

  const direction = computePathDirection(d);
  if (!direction) return null;

  return {
    endX: endpoint.x,
    endY: endpoint.y,
    dirX: direction.x,
    dirY: direction.y,
  };
}

// ============================================================================
// Arrowhead Expansion
// ============================================================================

/**
 * Creates an explicit arrowhead triangle at the specified endpoint.
 * This replaces SVG markers with explicit geometry for Illustrator/Figma compatibility.
 * Uses shared styling constants to ensure exact match with preview.
 * 
 * With markerUnits="userSpaceOnUse", the arrowhead dimensions are fixed in px:
 * - ARROW_WIDTH_PX = 14px: length along the line direction (from base to tip)
 * - ARROW_HEIGHT_PX = 19px: height/base span perpendicular to the line
 * - The line endpoint is at the base center, and the tip extends forward
 * - Arrowheads are fill-only (no stroke) to avoid duplicate stroke paths in Illustrator
 */
function createArrowheadTriangle(
  endX: number,
  endY: number,
  dirX: number,
  dirY: number
): SVGPathElement {
  // Arrowhead dimensions from shared constants (in px, userSpaceOnUse)
  // ARROW_WIDTH_PX = 14px: width along the line direction (narrow)
  // ARROW_HEIGHT_PX = 19px: height/base span perpendicular to the line (tall)
  // IMPORTANT: The marker uses viewBox "0 0 19 14" where:
  // - X-axis (19px) becomes height perpendicular to line when rotated (tall)
  // - Y-axis (14px) becomes width along line direction when rotated (narrow)
  // So for explicit triangles, we need:
  // - arrowLength = ARROW_HEIGHT_PX (19px) - extends along line direction (tall when rotated)
  // - arrowWidth = ARROW_WIDTH_PX (14px) - base span perpendicular to line (narrow when rotated)
  const arrowLength = ARROW_HEIGHT_PX; // length along the line (base to tip) = 19px (matches marker X-axis)
  const arrowWidth = ARROW_WIDTH_PX; // width/base span perpendicular to the line = 14px (matches marker Y-axis)

  // With refX=0, the line endpoint is at the base center
  // The tip extends forward from the endpoint by arrowLength
  const baseCenterX = endX;
  const baseCenterY = endY;
  const tipX = endX + dirX * arrowLength;
  const tipY = endY + dirY * arrowLength;

  // Perpendicular direction for arrow width (base)
  const perpX = -dirY;
  const perpY = dirX;

  // Base points: left and right edges of the triangle base
  const baseLeftX = baseCenterX + perpX * (arrowWidth / 2);
  const baseLeftY = baseCenterY + perpY * (arrowWidth / 2);
  const baseRightX = baseCenterX - perpX * (arrowWidth / 2);
  const baseRightY = baseCenterY - perpY * (arrowWidth / 2);

  // Create triangle: base left -> tip -> base right -> close
  // Arrowheads are fill-only (no stroke) to avoid duplicate stroke paths in Illustrator
  const arrowPath = document.createElementNS(SVG_NS, "path");
  arrowPath.setAttribute(
    "d",
    `M ${baseLeftX} ${baseLeftY} L ${tipX} ${tipY} L ${baseRightX} ${baseRightY} Z`
  );
  // CRITICAL: Set all attributes explicitly - don't rely on defaults or computed styles
  // This ensures Illustrator sees fill-only arrowheads
  arrowPath.setAttribute("fill", STROKE_COLOR);
  arrowPath.setAttribute("stroke", "none");
  arrowPath.setAttribute("stroke-width", "0");
  // Mark as arrowhead so we can identify it later
  arrowPath.setAttribute("data-arrowhead", "true");
  // Remove any attributes that could cause a duplicate stroke path
  arrowPath.removeAttribute("style");
  arrowPath.removeAttribute("stroke-opacity");
  arrowPath.removeAttribute("fill-opacity");
  // Ensure no marker attributes that could create additional paths
  arrowPath.removeAttribute("marker-start");
  arrowPath.removeAttribute("marker-end");
  arrowPath.removeAttribute("marker-mid");

  return arrowPath;
}

/**
 * Checks if an element is inside a <defs> block.
 */
function isInsideDefs(elem: Element, svgRoot: SVGSVGElement): boolean {
  let current: Element | null = elem;
  while (current && current !== svgRoot) {
    if (current.tagName === "defs") {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Checks if an element is the background rectangle.
 */
function isBackgroundRect(elem: Element): boolean {
  const fill = elem.getAttribute("fill");
  return fill === BACKGROUND_COLOR || fill === "black";
}

/**
 * Ensures the marker definition in the cloned SVG uses the correct shared styling constants.
 * This guarantees that the marker attributes match the preview exactly.
 */
function ensureMarkerDefinition(svgClone: SVGSVGElement): void {
  const marker = svgClone.querySelector(`marker[id="${ARROW_MARKER_ID}"]`) as SVGMarkerElement | null;
  if (!marker) {
    return;
  }

  // Ensure marker uses userSpaceOnUse (not strokeWidth) to avoid scaling issues
  // ARROW_WIDTH_PX = 14px: length along the line direction
  // ARROW_HEIGHT_PX = 19px: height/base span perpendicular to line
  // refX=0 positions the marker so the line endpoint is at the base center
  // The arrowhead extends forward from the line endpoint (tip at x=ARROW_HEIGHT_PX)
  // viewBox is swapped: "0 0 19 14" so that when rotated, X-axis (19px) becomes perpendicular (tall)
  marker.setAttribute("markerUnits", ARROW_MARKER_UNITS);
  marker.setAttribute("viewBox", `0 0 ${ARROW_HEIGHT_PX} ${ARROW_WIDTH_PX}`);
  marker.setAttribute("refX", "0");
  marker.setAttribute("refY", (ARROW_WIDTH_PX / 2).toString());
  marker.setAttribute("markerWidth", ARROW_HEIGHT_PX.toString());
  marker.setAttribute("markerHeight", ARROW_WIDTH_PX.toString());
  marker.setAttribute("orient", "auto");

  // Ensure the path inside the marker uses the correct dimensions and color
  // Triangle geometry: base vertical (Y-axis in marker coords), tip horizontal (X-axis in marker coords)
  // - Base left: (0, 0)
  // - Base right: (0, ARROW_WIDTH_PX) = (0, 14) - 14px vertical span in marker coords
  // - Tip: (ARROW_HEIGHT_PX, ARROW_WIDTH_PX/2) = (19, 7) - 19px horizontal extent in marker coords
  // When orient="auto" rotates this to align with line:
  // - X-axis (19px) becomes height perpendicular to line → tall appearance
  // - Y-axis (14px) becomes width along the line direction → narrow appearance
  // - Result: tall and narrow arrowhead (19px > 14px)
  // Arrowheads are fill-only (no stroke) for clean appearance in browser, Figma, and Illustrator
  const path = marker.querySelector("path");
  if (path) {
    path.setAttribute("d", `M0,0 L${ARROW_HEIGHT_PX},${ARROW_WIDTH_PX / 2} L0,${ARROW_WIDTH_PX} z`);
    path.setAttribute("fill", STROKE_COLOR);
    path.setAttribute("stroke", "none");
    path.setAttribute("stroke-width", "0");
    // Remove any style attribute that might override
    path.removeAttribute("style");
    // Ensure no stroke-opacity or fill-opacity that could cause issues
    path.removeAttribute("stroke-opacity");
    path.removeAttribute("fill-opacity");
  } else {
    // Create the path if it doesn't exist
    const newPath = document.createElementNS(SVG_NS, "path");
    newPath.setAttribute("d", `M0,0 L${ARROW_HEIGHT_PX},${ARROW_WIDTH_PX / 2} L0,${ARROW_WIDTH_PX} z`);
    newPath.setAttribute("fill", STROKE_COLOR);
    newPath.setAttribute("stroke", "none");
    newPath.setAttribute("stroke-width", "0");
    marker.appendChild(newPath);
  }
}

/**
 * Expands SVG markers into explicit arrowhead geometry for export.
 * This ensures arrowheads render correctly in Illustrator and Figma,
 * which don't always handle SVG markers reliably.
 *
 * Strategy: For each connection with markerEnd, compute the endpoint direction
 * and place an explicit arrowhead triangle at the end of the path/line.
 * Uses shared styling constants to ensure exact match with preview.
 * 
 * NOTE: We preserve the marker definition AND create explicit geometry
 * so that tools that support markers use them, and tools that don't
 * (like Illustrator/Figma) use the explicit triangles.
 */
function expandMarkersIntoGeometry(svgClone: SVGSVGElement): void {
  const marker = svgClone.querySelector(`marker[id="${ARROW_MARKER_ID}"]`);
  if (!marker) {
    return;
  }

  const connections = svgClone.querySelectorAll("path, line");

  connections.forEach((elem) => {
    // Skip elements inside defs or background rect
    if (isInsideDefs(elem, svgClone) || isBackgroundRect(elem)) {
      return;
    }

    // Skip if not a visible connection
    const stroke = elem.getAttribute("stroke");
    if (!stroke || stroke === "none") {
      return;
    }

    // Only expand if this element has a marker-end attribute
    const markerEnd = elem.getAttribute("marker-end");
    if (!markerEnd || !markerEnd.includes(ARROW_MARKER_ID)) {
      return;
    }

    // Get endpoint and direction based on element type
    let endpointData:
      | { endX: number; endY: number; dirX: number; dirY: number }
      | null = null;

    if (elem.tagName === "line") {
      endpointData = getLineEndpointAndDirection(elem as SVGLineElement);
    } else if (elem.tagName === "path") {
      endpointData = getPathEndpointAndDirection(elem as SVGPathElement);
    }

    if (!endpointData) {
      return;
    }

    // Create and insert arrowhead triangle
    // Uses shared styling constants (userSpaceOnUse, no stroke-width scaling)
    const arrowPath = createArrowheadTriangle(
      endpointData.endX,
      endpointData.endY,
      endpointData.dirX,
      endpointData.dirY
    );

    const parent = elem.parentElement || svgClone;
    parent.insertBefore(arrowPath, elem.nextSibling);

    // Remove marker-end attribute to prevent duplicate arrowheads
    // We've created explicit geometry, so we don't need the marker reference
    elem.removeAttribute("marker-end");
  });

  // Preserve the marker definition in <defs> for tools that support SVG markers
  // The expanded geometry is also present for Illustrator/Figma compatibility
  // Both use the same shared styling constants, ensuring visual consistency
}

// ============================================================================
// Animation Cleanup
// ============================================================================

/**
 * Removes animation-only attributes from all elements.
 * This ensures the exported SVG is fully static.
 */
function removeAnimationAttributes(svgClone: SVGSVGElement): void {
  const allElements = svgClone.querySelectorAll("*");
  allElements.forEach((elem) => {
    elem.removeAttribute("stroke-dashoffset");
    // Style attributes are already removed in inlineStylesForElement
  });
}

// ============================================================================
// Final Validation
// ============================================================================

/**
 * Final validation pass: ensures all connections have visible strokes.
 * This is a safety check to catch any edge cases and ensure Illustrator compatibility.
 * Uses explicit presentation attributes (not CSS) for maximum compatibility.
 */
function validateConnectionStrokes(svgClone: SVGSVGElement): void {
  const allConnections = svgClone.querySelectorAll("path, line");

  allConnections.forEach((elem) => {
    // Skip background and defs
    if (isBackgroundRect(elem) || isInsideDefs(elem, svgClone)) {
      return;
    }

    // Ensure stroke is set and not "none" - use explicit attribute for Illustrator
    const stroke = elem.getAttribute("stroke");
    if (!stroke || stroke === "none") {
      elem.setAttribute("stroke", STROKE_COLOR);
    }

    // Ensure stroke-width is set and > 0 - use explicit attribute for Illustrator
    const strokeWidth = elem.getAttribute("stroke-width");
    if (!strokeWidth || parseFloat(strokeWidth) <= 0) {
      elem.setAttribute("stroke-width", BASE_STROKE_WIDTH.toString());
    }

    // Ensure fill is explicitly "none" for connection lines/paths
    const fill = elem.getAttribute("fill");
    if (!fill || fill !== "none") {
      elem.setAttribute("fill", "none");
    }

    // Remove any style attribute that might interfere
    elem.removeAttribute("style");
  });
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Prepares an SVG element for export.
 *
 * @param originalSvg - The SVG element from the DOM (with class "svg-preview")
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @returns A complete SVG XML string ready for download
 *
 * @remarks
 * This function:
 * - Never mutates the original SVG
 * - Ensures compatibility with Illustrator, Figma, and browsers
 * - Inlines all styles as presentation attributes
 * - Expands markers into explicit geometry
 * - Removes animation attributes
 * - Uses the provided canvas dimensions for width, height, and viewBox
 */
export function prepareSvgForExport(
  originalSvg: SVGSVGElement,
  canvasWidth: number,
  canvasHeight: number
): string {
  // 1. Deep clone the SVG (never mutate the original)
  const svgClone = originalSvg.cloneNode(true) as SVGSVGElement;

  // 2. Normalize root attributes using provided canvas dimensions
  const { width, height } = normalizeRootAttributes(svgClone, canvasWidth, canvasHeight);

  // 3. Ensure background rect exists
  ensureBackgroundRect(svgClone, width, height);

  // 3a. Remove preview-only canvas outline (dashed rectangle)
  // This is a visual debugging aid that should not appear in exported SVG
  const allRects = svgClone.querySelectorAll("rect");
  allRects.forEach((rect) => {
    // Skip background rect
    if (isBackgroundRect(rect)) {
      return;
    }
    // Remove any rect with dashed stroke (the preview outline)
    const strokeDasharray = rect.getAttribute("stroke-dasharray");
    if (strokeDasharray && strokeDasharray !== "none") {
      rect.remove();
    }
  });

  // 4. FIRST: Ensure all connection elements have explicit stroke attributes
  // This must happen BEFORE style inlining to ensure Illustrator compatibility
  // Mark connection elements with a data attribute so we can identify them later
  const allConnections = svgClone.querySelectorAll("path, line");
  allConnections.forEach((elem) => {
    if (!isBackgroundRect(elem) && !isInsideDefs(elem, svgClone)) {
      // Force explicit attributes for Illustrator compatibility
      elem.setAttribute("stroke", STROKE_COLOR);
      elem.setAttribute("stroke-width", BASE_STROKE_WIDTH.toString());
      elem.setAttribute("fill", "none");
      elem.removeAttribute("style");
      // Mark as explicitly set so inlineStylesForElement doesn't override
      elem.setAttribute("data-explicit-stroke", "true");
    }
  });

  // 5. Inline styles for all graphical elements
  // We walk both trees in parallel to get computed styles from the original
  inlineStylesRecursive(originalSvg, svgClone);
  inlineStylesForElement(originalSvg, svgClone);

  // 6. Ensure marker definition uses shared styling constants
  ensureMarkerDefinition(svgClone);

  // 7. Expand markers into explicit geometry (for Figma/Illustrator compatibility)
  // This must happen BEFORE removing animation attributes so we can read marker-end
  expandMarkersIntoGeometry(svgClone);

  // 7a. Ensure all arrowhead paths are properly configured (fill-only, no stroke)
  // This must happen after expandMarkersIntoGeometry so we can process the explicit triangles
  const allPathsAfterExpand = svgClone.querySelectorAll("path");
  allPathsAfterExpand.forEach((path) => {
    // Skip paths inside defs (marker definitions)
    if (isInsideDefs(path, svgClone)) {
      return;
    }
    
    // Check if this is an arrowhead path (white fill indicates arrowhead)
    const fill = path.getAttribute("fill");
    const d = path.getAttribute("d") || "";
    const stroke = path.getAttribute("stroke");
    
    // Check if this looks like an arrowhead
    const isWhiteFill = fill === STROKE_COLOR || fill === "#fff" || fill === "#ffffff" || fill === "white";
    const isClosedPath = d.trim().endsWith("Z") || d.trim().endsWith("z");
    const isWhiteStroke = stroke === STROKE_COLOR || stroke === "#fff" || stroke === "#ffffff" || stroke === "white";
    
    if (isWhiteFill || (isClosedPath && isWhiteStroke)) {
      // This is an arrowhead - FORCE it to be fill-only with explicit attributes
      // CRITICAL: Set fill explicitly for Illustrator compatibility
      path.setAttribute("fill", STROKE_COLOR);
      path.setAttribute("stroke", "none");
      path.setAttribute("stroke-width", "0");
      // Remove all stroke-related attributes
      path.removeAttribute("stroke-opacity");
      path.removeAttribute("stroke-linecap");
      path.removeAttribute("stroke-linejoin");
      path.removeAttribute("stroke-dasharray");
      path.removeAttribute("stroke-dashoffset");
      // Remove style attribute that might override
      path.removeAttribute("style");
      // Ensure fill-opacity is not set (or is 1.0)
      path.removeAttribute("fill-opacity");
    } else if (fill && fill !== "none" && fill !== "black" && fill !== BACKGROUND_COLOR) {
      // Check if this might be a stroke-only arrowhead (no fill but has stroke)
      if (stroke && stroke !== "none" && (stroke === STROKE_COLOR || stroke === "#fff" || stroke === "#ffffff" || stroke === "white")) {
        // This might be a duplicate stroke-only arrowhead - remove it
        path.remove();
      }
    }
  });

  // 8. Remove animation-only attributes
  removeAnimationAttributes(svgClone);

  // 9. Final validation: ensure all connections have visible strokes (safety check)
  validateConnectionStrokes(svgClone);
  
  // 9a. Final cleanup: ensure ALL arrowhead paths are fill-only (no stroke)
  // This is a critical safety check to ensure Illustrator sees fill-only arrowheads
  // We need to be aggressive here - find ALL paths that could be arrowheads
  const allPaths = svgClone.querySelectorAll("path");
  allPaths.forEach((path) => {
    // Skip paths inside defs
    if (isInsideDefs(path, svgClone)) {
      return;
    }
    
    // Check if this is an arrowhead path
    // Arrowheads are identified by:
    // 1. Having data-arrowhead="true" attribute (explicit triangles)
    // 2. Having fill="#ffffff" (or white)
    // 3. Being a closed path (ends with Z) with white stroke
    const isMarkedArrowhead = path.getAttribute("data-arrowhead") === "true";
    const fill = path.getAttribute("fill");
    const d = path.getAttribute("d") || "";
    const stroke = path.getAttribute("stroke");
    
    // Check if this looks like an arrowhead:
    // - Has data-arrowhead marker, OR
    // - Has white fill, OR
    // - Is a closed path (ends with Z) with stroke that's white
    const isWhiteFill = fill === STROKE_COLOR || fill === "#fff" || fill === "#ffffff" || fill === "white";
    const isClosedPath = d.trim().endsWith("Z") || d.trim().endsWith("z");
    const isWhiteStroke = stroke === STROKE_COLOR || stroke === "#fff" || stroke === "#ffffff" || stroke === "white";
    
    // If it's marked as arrowhead, has white fill, or is a closed path with white stroke, treat it as an arrowhead
    if (isMarkedArrowhead || isWhiteFill || (isClosedPath && isWhiteStroke)) {
      // This is an arrowhead - FORCE it to be fill-only with explicit attributes
      // CRITICAL: Explicitly set fill for Illustrator - don't rely on computed styles
      path.setAttribute("fill", STROKE_COLOR);
      path.setAttribute("stroke", "none");
      path.setAttribute("stroke-width", "0");
      // Remove all stroke-related attributes
      path.removeAttribute("stroke-opacity");
      path.removeAttribute("stroke-linecap");
      path.removeAttribute("stroke-linejoin");
      path.removeAttribute("stroke-dasharray");
      path.removeAttribute("stroke-dashoffset");
      // Remove style attribute that might override
      path.removeAttribute("style");
      // Ensure fill-opacity is not set (defaults to 1.0)
      path.removeAttribute("fill-opacity");
      // Remove the marker attribute after processing
      path.removeAttribute("data-arrowhead");
    }
  });

  // 10. Serialize to clean XML
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgClone);

  // 11. Prepend XML declaration
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
}
