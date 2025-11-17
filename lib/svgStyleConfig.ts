/**
 * Base SVG styling configuration.
 * 
 * Keeps preview and exported SVG consistent across browser, Illustrator, and Figma.
 * All values are in px, no pt↔px conversion.
 * 
 * This is the single source of truth for:
 * - Line stroke width
 * - Arrowhead dimensions
 * - Colors
 */

// Canvas dimensions
export const CANVAS_SIZE = 1080; // px

// Line styling
export const BASE_STROKE_WIDTH = 3; // px
export const STROKE_COLOR = "#ffffff";

// Arrowhead styling
// ARROW_WIDTH_PX = 14px: length along the line direction (horizontal extent)
// ARROW_HEIGHT_PX = 19px: height/base span perpendicular to line (vertical extent)
// Arrowheads are tall and narrow (height > width) for clean appearance
export const ARROW_WIDTH_PX = 14; // px - length along the line direction
export const ARROW_HEIGHT_PX = 19; // px - height/base span perpendicular to line

// Background
export const BACKGROUND_COLOR = "#000000";

// Marker configuration
// Using userSpaceOnUse to avoid stroke-width-based scaling
export const ARROW_MARKER_UNITS = "userSpaceOnUse";
export const ARROW_MARKER_ID = "arrowhead";

