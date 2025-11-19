/**
 * Tipi per SFCM Symbol Generator
 * Definizioni come da SPEC_02_GITHUB.md
 */

export type Axes = {
  ordine_caos: number;
  conflitto_consenso: number;
  teoria_pratica: number;
  individuale_collettivo: number;
  naturale_artificiale: number;
  locale_globale: number;
};

export type Point = {
  x: number;
  y: number;
};

export type ClusterPoint = Point & {
  isPrimary: boolean;
};

export type Cluster = {
  keyword: string;
  axes: Axes;
  mutamento: number; // slider 0-1
  points: ClusterPoint[];
};

export type Connection = {
  from: Point;
  to: Point;
  curved: boolean;
  curvature: number; // -0.8 .. 0.8
  dashed: boolean;
  semanticInfluence: Partial<Axes>;
};

export type Intersection = {
  point: Point;
  fromIndices: number[]; // indexes of connections involved
};

export type BranchedConnection = Connection & {
  generationDepth: number; // 0 = MST, 1 = extra, 2 = ramificazioni
  generatedFrom?: number; // opzionale: indice della intersezione sorgente
};

// ============================================================================
// ENGINE_V2 Types (SPEC_03)
// ============================================================================

/**
 * ENGINE_V2 semantic axes (4 axes, range [-100, +100])
 * 
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP.md section 1
 */
export type AxesV2 = {
  alfa: number; // Azione ↔ Osservazione (X position)
  beta: number; // Specifico ↔ Ampio (Y position)
  gamma: number; // Unico ↔ Composto (number, direction, length of lines)
  delta: number; // Regolare ↔ Irregolare (curvature, jitter)
};

/**
 * ENGINE_V2 semantic map type
 * 
 * Dictionary mapping normalized keywords to AxesV2 values.
 * Reference: docs/ENGINE_V2_SEMANTIC_MAP.md section 2.2
 */
export type SemanticMapV2 = Record<string, AxesV2>;

/**
 * Quadrant identifier (1-4)
 * Quadrant 1: x > 0.5, y < 0.5 (top-right)
 * Quadrant 2: x < 0.5, y < 0.5 (top-left)
 * Quadrant 3: x < 0.5, y > 0.5 (bottom-left)
 * Quadrant 4: x > 0.5, y > 0.5 (bottom-right)
 */
export type Quadrant = 1 | 2 | 3 | 4;

/**
 * Per-keyword anchor point debug information
 * 
 * Represents a single keyword's primary anchor point (Alfa/Beta → canvas coordinates)
 * captured BEFORE final mirroring is applied.
 */
export type KeywordAnchorDebug = {
  keyword: string;
  index: number; // 0-based index of the keyword in the input list
  point: Point; // Canvas coordinates BEFORE mirroring
};

/**
 * ENGINE_V2 debug information (optional, for development/debugging)
 * 
 * Contains debug data to visualize the engine's internal state:
 * - Primary anchor point (before mirroring)
 * - Original axes values for the first keyword
 * - Per-keyword anchor points (all keywords' primary positions)
 * - Bounding box of pre-mirroring geometry
 * - Mirroring axis information
 * 
 * This is optional and does not affect engine behavior.
 * Reference: docs/debug/ENGINE_V2_DEBUG_OVERLAY.md
 */
/**
 * Direction clustering debug information (patch03)
 * 
 * Contains debug data for visualizing direction clustering behavior.
 */
export type DirectionClusterDebug = {
  clusterIndex: number; // Index of the cluster (0-based)
  clusterAngle: number; // Central angle of the cluster (before Gamma rotation) in degrees
  gammaRotation: number; // Rotation applied by Gamma in degrees
  finalClusterAngle: number; // Cluster angle after Gamma rotation in degrees
  inClusterJitter: number; // Jitter applied within the cluster in degrees
  finalDirection: number; // Final direction of the line (0-180°) in degrees
  startPoint: Point; // Dispersed start point for this line on the canvas (per-cluster positioning)
  // patch04: optional per-line length/curvature profile multipliers
  lengthProfile?: number;
  curvatureProfile?: number;
};

export type EngineV2DebugInfo = {
  alfa: number;
  beta: number;
  anchor: Point; // Primary anchor point (Alfa/Beta → canvas coordinates) BEFORE mirroring
  anchors?: KeywordAnchorDebug[]; // Per-keyword anchor points (all keywords' primary positions) BEFORE mirroring
  bbox?: { minX: number; minY: number; maxX: number; maxY: number }; // Bounding box of pre-mirroring geometry
  mirrorAxisType?: "vertical" | "horizontal" | "diagonal"; // Type of mirroring axis
  mirrorAxisSegment?: { x1: number; y1: number; x2: number; y2: number }; // Axis line segment for visualization
  // Direction clustering debug (patch03)
  directionClusters?: DirectionClusterDebug[]; // Array of clustering info for each line
  clusterCount?: number; // Number of clusters used
  clusterSpread?: number; // Spread angle within clusters in degrees
  gamma?: number; // Gamma value used for rotation
};
