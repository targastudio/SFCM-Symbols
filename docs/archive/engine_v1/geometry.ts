/**
 * LEGACY ENGINE (ENGINE_V1 / SPEC_02) — kept only for reference, not used by ENGINE_V2 runtime.
 * 
 * This file contains the old 6-axis engine implementation:
 * - Hexagonal projection (6 axes → 2D coordinates)
 * - Cluster generation
 * - MST (Minimum Spanning Tree) connections
 * - Branching/ramification logic
 * - Old mirroring/replication
 * 
 * ENGINE_V2 (SPEC_03) has completely replaced this engine.
 * 
 * NOTE: The `computeCurveControl` function has been moved to `lib/svgUtils.ts` for use by SvgPreview.
 * This file is kept for historical reference only and should not be imported by any active code.
 * 
 * @deprecated This entire module is deprecated. Use lib/engine_v2/ instead.
 */

import type {
  Axes,
  Point,
  Cluster,
  ClusterPoint,
  Connection,
  Intersection,
  BranchedConnection,
} from "./types";
import { prng } from "./seed";
import seedrandom from "seedrandom";

// Connection density constants
const MAX_CONNECTIONS_PER_NODE = 4; // Maximum connections per node within a cluster
const MIN_INTER_CLUSTER_CONNECTIONS = 2; // Minimum inter-cluster connections regardless of densità
// Note: Distance thresholds are now in normalized space [0, 1] and will be scaled to canvas dimensions
const INTRA_CLUSTER_MIN_DIST_NORM = 0.028; // ~30px normalized for 1080×1080
const INTRA_CLUSTER_PREFERRED_DIST_NORM = 0.056; // ~60px normalized for 1080×1080

/**
 * Normalized point in [0, 1] × [0, 1] coordinate space
 */
type NormalizedPoint = {
  xNorm: number; // [0, 1]
  yNorm: number; // [0, 1]
};

/**
 * Clamps a value to [0, 1] range
 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Converts normalized coordinates [0, 1] × [0, 1] to pixel coordinates
 * @param xNorm Normalized x coordinate [0, 1]
 * @param yNorm Normalized y coordinate [0, 1]
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Pixel coordinates clamped to [0, canvasWidth] × [0, canvasHeight]
 */
function normalizedToPixel(
  xNorm: number,
  yNorm: number,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const x = clamp01(xNorm) * canvasWidth;
  const y = clamp01(yNorm) * canvasHeight;
  return { x, y };
}

/**
 * Clamps a point to stay within exact canvas bounds [0, canvasWidth] × [0, canvasHeight].
 * This is the central clamping utility used throughout geometry generation.
 * 
 * CRITICAL: Uses exact bounds (no margins) to match the dashed canvas outline.
 * All geometry must stay within these exact bounds.
 * 
 * @param x X coordinate
 * @param y Y coordinate
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Clamped point { x, y } within [0, canvasWidth] × [0, canvasHeight]
 */
function clampToCanvas(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(canvasWidth, x)),
    y: Math.max(0, Math.min(canvasHeight, y)),
  };
}

/**
 * Calculates semantic distance between two clusters based on their axes.
 * Used to identify the most semantically distant clusters for full-canvas distribution.
 */
function semanticDistance(axes1: Axes, axes2: Axes): number {
  const dx = axes1.ordine_caos - axes2.ordine_caos;
  const dy = axes1.conflitto_consenso - axes2.conflitto_consenso;
  const dz = axes1.teoria_pratica - axes2.teoria_pratica;
  const dw = axes1.individuale_collettivo - axes2.individuale_collettivo;
  const du = axes1.naturale_artificiale - axes2.naturale_artificiale;
  const dv = axes1.locale_globale - axes2.locale_globale;
  return Math.sqrt(dx * dx + dy * dy + dz * dz + dw * dw + du * du + dv * dv);
}

/**
 * Projects semantic axes to normalized 2D coordinates [0, 1] × [0, 1] using hexagonal projection.
 * This is the core semantic-to-spatial mapping that operates in normalized space.
 * 
 * @param axes Semantic axes vector
 * @returns Normalized point { xNorm, yNorm } in [0, 1] × [0, 1]
 */
export function projectHexNormalized(axes: Axes): NormalizedPoint {
  const rad = (deg: number) => (Math.PI / 180) * deg;
  
  // Base scale factor for semantic offset (normalized, independent of canvas size)
  // This determines how much semantic variation maps to spatial variation
  const SEMANTIC_SCALE = 0.037; // Maps [-10, +10] axes to roughly [-0.37, +0.37] normalized offset

  // Componenti degli assi con i loro angoli (0°, 60°, 120°, 180°, 240°, 300°)
  const comps = [
    { a: axes.ordine_caos, ang: 0 },
    { a: axes.conflitto_consenso, ang: 60 },
    { a: axes.teoria_pratica, ang: 120 },
    { a: axes.individuale_collettivo, ang: 180 },
    { a: axes.naturale_artificiale, ang: 240 },
    { a: axes.locale_globale, ang: 300 },
  ];

  // Calculate semantic offset in normalized space (centered at 0.5, 0.5)
  const sx = comps.reduce((s, c) => s + c.a * Math.cos(rad(c.ang)), 0) * SEMANTIC_SCALE;
  const sy = comps.reduce((s, c) => s + c.a * Math.sin(rad(c.ang)), 0) * SEMANTIC_SCALE;

  // Map semantic offset to normalized [0, 1] space
  // Center at 0.5, 0.5 and spread based on semantic offset
  // Clamp to ensure we stay in [0, 1] × [0, 1]
  const xNorm = clamp01(0.5 + sx);
  const yNorm = clamp01(0.5 + sy);

  return { xNorm, yNorm };
}

/**
 * Legacy function: Projects axes to pixel coordinates (for backward compatibility during migration).
 * Now uses normalized projection internally.
 * 
 * @deprecated Use projectHexNormalized + normalizedToPixel instead
 */
export function projectHex(
  axes: Axes,
  canvasWidth: number,
  canvasHeight: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _scale?: number // Ignored, kept for API compatibility
): Point {
  const normalized = projectHexNormalized(axes);
  return normalizedToPixel(normalized.xNorm, normalized.yNorm, canvasWidth, canvasHeight);
}

/**
 * Spreads a cluster's normalized positions to use the full canvas area.
 * Used to ensure at least two clusters exploit the entire available canvas.
 * 
 * @param cluster Cluster with normalized points
 * @param mode Distribution mode: "left", "right", "top", "bottom", or "center"
 * @param seed Seed for deterministic jitter
 * @returns Cluster with redistributed normalized points
 */
function spreadClusterOverCanvas(
  cluster: Cluster & { normalizedPoints: NormalizedPoint[] },
  mode: "left" | "right" | "top" | "bottom" | "center",
  seed: string
): Cluster & { normalizedPoints: NormalizedPoint[] } {
  const rng = seedrandom(seed + `:spread:${mode}`);
  
  // Find bounding box of current cluster points
  const xs = cluster.normalizedPoints.map(p => p.xNorm);
  const ys = cluster.normalizedPoints.map(p => p.yNorm);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 0.1; // Avoid division by zero
  const height = maxY - minY || 0.1;

  // Target bounding box based on mode
  let targetMinX: number, targetMaxX: number, targetMinY: number, targetMaxY: number;
  
  switch (mode) {
    case "left":
      // Spread across left 60% of canvas, full height
      targetMinX = 0.05;
      targetMaxX = 0.65;
      targetMinY = 0.05;
      targetMaxY = 0.95;
      break;
    case "right":
      // Spread across right 60% of canvas, full height
      targetMinX = 0.35;
      targetMaxX = 0.95;
      targetMinY = 0.05;
      targetMaxY = 0.95;
      break;
    case "top":
      // Spread across top 60% of canvas, full width
      targetMinX = 0.05;
      targetMaxX = 0.95;
      targetMinY = 0.05;
      targetMaxY = 0.65;
      break;
    case "bottom":
      // Spread across bottom 60% of canvas, full width
      targetMinX = 0.05;
      targetMaxX = 0.95;
      targetMinY = 0.35;
      targetMaxY = 0.95;
      break;
    case "center":
    default:
      // Spread across center 80% of canvas
      targetMinX = 0.1;
      targetMaxX = 0.9;
      targetMinY = 0.1;
      targetMaxY = 0.9;
      break;
  }

  // Map each point from current bounding box to target bounding box
  const spreadPoints = cluster.normalizedPoints.map((p) => {
    // Normalize point position within current bounding box
    const relX = width > 0 ? (p.xNorm - minX) / width : 0.5;
    const relY = height > 0 ? (p.yNorm - minY) / height : 0.5;
    
    // Map to target bounding box
    const newX = targetMinX + relX * (targetMaxX - targetMinX);
    const newY = targetMinY + relY * (targetMaxY - targetMinY);
    
    // Add small jitter to avoid perfect alignment (preserves organic feel)
    const jitterX = (rng() - 0.5) * 0.02; // ±1% jitter
    const jitterY = (rng() - 0.5) * 0.02;
    
    return {
      xNorm: clamp01(newX + jitterX),
      yNorm: clamp01(newY + jitterY),
    };
  });

  return {
    ...cluster,
    normalizedPoints: spreadPoints,
  };
}

/**
 * Generates a cluster in normalized coordinate space [0, 1] × [0, 1].
 * All geometry is generated in normalized space and will be scaled to pixel coordinates later.
 * 
 * @param keyword Keyword
 * @param axes Semantic axes vector
 * @param mutamento Slider mutamento [0, 1]
 * @param seed Global seed for determinism
 * @returns Cluster with normalized points (will be converted to pixels later)
 */
function generateClusterNormalized(
  keyword: string,
  axes: Axes,
  mutamento: number,
  seed: string
): Cluster & { normalizedPoints: NormalizedPoint[] } {
  // Generate primary point using normalized hexagonal projection
  const primaryNormalized = projectHexNormalized(axes);
  const normalizedPoints: NormalizedPoint[] = [primaryNormalized];

  // Calculate number of sub-points based on mutamento
  // mutamento basso (≈ 0): 3–6 sottopunti
  // mutamento alto (≈ 1): 10–15 sottopunti
  const minSubpoints = 3;
  const maxSubpoints = 15;
  const numSubpoints = Math.floor(
    minSubpoints + mutamento * (maxSubpoints - minSubpoints)
  );

  // PRNG deterministico per questo cluster
  const clusterSeed = `${seed}-${keyword}-${mutamento}`;
  const rng = prng(clusterSeed);

  // Parameters for sub-points in normalized space
  // These are relative to the normalized [0, 1] space, not pixels
  const minRadiusNorm = 0.046; // ~50px normalized for 1080×1080
  const maxRadiusNorm = 0.111; // ~120px normalized for 1080×1080
  
  // Semantic influences
  const ordineCaos = axes.ordine_caos; // [-10, +10] → radial jitter
  const conflittoConsenso = axes.conflitto_consenso; // angle relative to center
  const teoriaPratica = axes.teoria_pratica; // distance from center
  const individualeCollettivo = axes.individuale_collettivo; // cluster density
  const localeGlobale = axes.locale_globale; // dispersion amplitude

  // Generate sub-points in normalized space
  for (let i = 0; i < numSubpoints; i++) {
    // Base radius influenced by Locale–Globale
    // più globale → raggio più ampio
    const globalFactor = (localeGlobale + 10) / 20; // [0, 1]
    const baseRadiusNorm = minRadiusNorm + (maxRadiusNorm - minRadiusNorm) * globalFactor;
    
    // Radial jitter influenced by Ordine–Caos
    // più caos → più jitter
    const chaosFactor = (-ordineCaos + 10) / 20; // [0, 1], più caos = più alto
    const radiusJitterNorm = (rng() - 0.5) * 0.028 * chaosFactor; // ~30px normalized
    const minAllowedRadiusNorm = 0.019; // ~20px normalized
    const maxAllowedRadiusNorm = 0.139; // ~150px normalized
    const radiusNorm = Math.max(
      minAllowedRadiusNorm,
      Math.min(maxAllowedRadiusNorm, baseRadiusNorm + radiusJitterNorm)
    );

    // Base angle
    const baseAngle = (rng() * Math.PI * 2);
    
    // Modify angle based on Conflitto–Consenso
    // più consenso → converge verso il centro (angolo verso il centro)
    const consensusFactor = (conflittoConsenso + 10) / 20; // [0, 1]
    // In normalized space, center is at (0.5, 0.5)
    const angleToCenter = Math.atan2(
      0.5 - primaryNormalized.yNorm,
      0.5 - primaryNormalized.xNorm
    );
    const angle = baseAngle * (1 - consensusFactor * 0.5) + 
                  angleToCenter * (consensusFactor * 0.5);

    // Distance from primary center influenced by Teoria–Pratica
    // più pratica → più esterno
    const praticaFactor = (teoriaPratica + 10) / 20; // [0, 1]
    const distanceFactor = 0.7 + praticaFactor * 0.3; // [0.7, 1.0]
    const finalRadiusNorm = radiusNorm * distanceFactor;

    // Cluster density influenced by Individuale–Collettivo
    // più collettivo → cluster più stretto
    const collettivoFactor = (individualeCollettivo + 10) / 20; // [0, 1]
    const densityFactor = 0.5 + (1 - collettivoFactor) * 0.5; // più collettivo = più stretto
    const clusterRadiusNorm = finalRadiusNorm * densityFactor;

    // Calculate final position in normalized space
    const xNorm = clamp01(primaryNormalized.xNorm + Math.cos(angle) * clusterRadiusNorm);
    const yNorm = clamp01(primaryNormalized.yNorm + Math.sin(angle) * clusterRadiusNorm);

    normalizedPoints.push({ xNorm, yNorm });
  }

  return {
    keyword,
    axes: axes,
    mutamento,
    points: [], // Will be populated when converting to pixels
    normalizedPoints,
  };
}

/**
 * Converts a cluster with normalized points to pixel coordinates.
 * 
 * @param clusterWithNorm Cluster with normalizedPoints
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Cluster with pixel coordinates
 */
function convertClusterToPixels(
  clusterWithNorm: Cluster & { normalizedPoints: NormalizedPoint[] },
  canvasWidth: number,
  canvasHeight: number
): Cluster {
  const points: ClusterPoint[] = clusterWithNorm.normalizedPoints.map((p, i) => {
    const pixel = normalizedToPixel(p.xNorm, p.yNorm, canvasWidth, canvasHeight);
    return {
      ...pixel,
      isPrimary: i === 0,
    };
  });

  return {
    keyword: clusterWithNorm.keyword,
    axes: clusterWithNorm.axes,
    mutamento: clusterWithNorm.mutamento,
    points,
  };
}

/**
 * Generates clusters with normalized coordinates and ensures at least two clusters use the full canvas.
 * This is the main entry point for cluster generation.
 * 
 * @param keywordVectors Array of { keyword, axes } pairs
 * @param mutamento Slider mutamento [0, 1]
 * @param seed Global seed for determinism
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Array of clusters with pixel coordinates
 */
export function generateClusters(
  keywordVectors: Array<{ keyword: string; axes: Axes }>,
  mutamento: number,
  seed: string,
  canvasWidth: number,
  canvasHeight: number
): Cluster[] {
  // Step 1: Generate all clusters in normalized space
  const clustersWithNorm = keywordVectors.map((kv) =>
    generateClusterNormalized(kv.keyword, kv.axes, mutamento, seed)
  );

  // Step 2: If we have at least 2 clusters, identify the two most semantically distant
  // and spread them over the full canvas
  if (clustersWithNorm.length >= 2) {
    // Find the pair with maximum semantic distance
    let maxDist = -1;
    let clusterAIdx = 0;
    let clusterBIdx = 1;

    for (let i = 0; i < clustersWithNorm.length; i++) {
      for (let j = i + 1; j < clustersWithNorm.length; j++) {
        const dist = semanticDistance(
          clustersWithNorm[i].axes,
          clustersWithNorm[j].axes
        );
        if (dist > maxDist) {
          maxDist = dist;
          clusterAIdx = i;
          clusterBIdx = j;
        }
      }
    }

    // Spread the two most distant clusters over the full canvas
    // Use different modes to ensure they cover different areas
    const modes: Array<"left" | "right" | "top" | "bottom"> = ["left", "right", "top", "bottom"];
    const modeA = modes[clusterAIdx % modes.length];
    const modeB = modes[clusterBIdx % modes.length];

    clustersWithNorm[clusterAIdx] = spreadClusterOverCanvas(
      clustersWithNorm[clusterAIdx],
      modeA,
      seed
    );
    clustersWithNorm[clusterBIdx] = spreadClusterOverCanvas(
      clustersWithNorm[clusterBIdx],
      modeB,
      seed
    );
  }

  // Step 3: Convert all clusters from normalized to pixel coordinates
  return clustersWithNorm.map((cluster) =>
    convertClusterToPixels(cluster, canvasWidth, canvasHeight)
  );
}

/**
 * Legacy function: Generates a single cluster (for backward compatibility).
 * Now uses normalized generation internally.
 * 
 * @deprecated Use generateClusters instead for full-canvas distribution
 */
export function generateCluster(
  keyword: string,
  axes: Axes,
  mutamento: number,
  seed: string,
  canvasWidth: number,
  canvasHeight: number
): Cluster {
  const clusterWithNorm = generateClusterNormalized(keyword, axes, mutamento, seed);
  return convertClusterToPixels(clusterWithNorm, canvasWidth, canvasHeight);
}

/**
 * Calcola la distanza euclidea tra due punti
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calcola la curvatura da un valore medio di Naturale–Artificiale con varietà
 * @param meanNatArt Media dell'asse Naturale–Artificiale ∈ [-10, +10]
 * @param complessita Slider complessità [0, 1] - aumenta varietà di curvatura
 * @param mutamento Slider mutamento [0, 1] - aumenta irregolarità
 * @param seed Seed per determinismo nella varietà
 * @returns Curvatura ∈ [-0.8, 0.8] con orientamento e ampiezza variabili
 */
export function curvatureFor(
  meanNatArt: number,
  complessita: number = 0.5,
  mutamento: number = 0.5,
  seed?: string
): number {
  // meanNatArt in [-10, 10]
  const clamped = Math.max(-10, Math.min(10, meanNatArt));
  
  // Base magnitude from semantic axis
  // Map |clamped| from [0, 10] to [0.2, 0.8]
  const baseMagnitude = 0.2 + (1 - Math.abs(clamped) / 10) * 0.6;
  
  // Add variety based on complessità and mutamento
  let magnitude = baseMagnitude;
  let orientationSign = clamped >= 0 ? -1 : 1; // Base sign from semantics
  
  if (seed) {
    const rng = seedrandom(seed);
    
    // Vary amplitude: higher complessità = more variation
    const amplitudeVariation = (rng() - 0.5) * complessita * 0.4; // ±0.2 at max complessità
    magnitude = Math.max(0.1, Math.min(0.9, baseMagnitude + amplitudeVariation));
    
    // Randomly flip orientation: higher mutamento = more likely to flip
    // This breaks the "all curves bend the same way" pattern
    if (rng() < mutamento * 0.6) {
      orientationSign *= -1;
    }
    
    // Add small random offset to break parallel arcs
    const orientationJitter = (rng() - 0.5) * mutamento * 0.3;
    orientationSign *= (1 + orientationJitter);
  }
  
  const value = orientationSign * magnitude;
  
  // Final clamp to [-0.8, 0.8] for safety
  return Math.max(-0.8, Math.min(0.8, value));
}

/**
 * Costruisce un Minimum Spanning Tree (MST) deterministico usando l'algoritmo di Prim
 * @param points Array di punti
 * @param seed Seed per determinismo (per ordinare edge con stesso peso)
 * @returns Array di connessioni MST
 */
function buildMST(
  points: Point[],
  seed: string
): Array<{ from: number; to: number; weight: number }> {
  if (points.length < 2) return [];

  const rng = prng(seed);
  const n = points.length;
  const mst: Array<{ from: number; to: number; weight: number }> = [];
  const visited = new Set<number>();
  const minEdge = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);

  // Inizia dal primo punto
  minEdge[0] = 0;

  for (let i = 0; i < n - 1; i++) {
    // Trova il punto non visitato con peso minimo
    let u = -1;
    let minWeight = Infinity;
    for (let v = 0; v < n; v++) {
      if (!visited.has(v) && minEdge[v] < minWeight) {
        minWeight = minEdge[v];
        u = v;
      }
    }

    if (u === -1) break;
    visited.add(u);

    // Aggiungi l'arco al MST se ha un parent
    if (parent[u] !== -1) {
      mst.push({
        from: parent[u],
        to: u,
        weight: minWeight,
      });
    }

    // Aggiorna i pesi minimi per i punti adiacenti
    for (let v = 0; v < n; v++) {
      if (!visited.has(v)) {
        const dist = distance(points[u], points[v]);
        // Aggiungi un piccolo jitter deterministico per risolvere pareggi
        const jitter = rng() * 0.0001;
        const weight = dist + jitter;
        if (weight < minEdge[v]) {
          minEdge[v] = weight;
          parent[v] = u;
        }
      }
    }
  }

  return mst;
}

/**
 * Costruisce le connessioni tra tutti i punti dei cluster
 * All geometry is generated in [0, canvasWidth] × [0, canvasHeight] coordinate space.
 * 
 * @param clusters Array di cluster
 * @param densita Slider densità [0, 1]
 * @param complessita Slider complessità [0, 1]
 * @param mutamento Slider mutamento [0, 1] - influenza varietà di curvatura
 * @param seed Seed globale per determinismo
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Array di connessioni con ramificazioni (BranchedConnection)
 */
export function buildConnections(
  clusters: Cluster[],
  densita: number,
  complessita: number,
  mutamento: number,
  seed: string,
  canvasWidth: number,
  canvasHeight: number
): BranchedConnection[] {
  // Raccogli tutti i punti con riferimento al cluster
  type PointWithCluster = Point & {
    clusterIndex: number;
    axes: Axes;
    isPrimary: boolean;
  };

  const allPoints: PointWithCluster[] = [];
  clusters.forEach((cluster, clusterIdx) => {
    cluster.points.forEach((point) => {
      allPoints.push({
        x: point.x,
        y: point.y,
        clusterIndex: clusterIdx,
        axes: cluster.axes,
        isPrimary: point.isPrimary,
      });
    });
  });

  if (allPoints.length < 2) return [];

  const connections: BranchedConnection[] = [];

  // Helper per creare una connessione
  const createConnection = (
    from: PointWithCluster,
    to: PointWithCluster,
    generationDepth: number,
    forceCurved: boolean = false,
    connectionSeed?: string
  ): BranchedConnection => {
    const meanAxes = averageAxes(from.axes, to.axes);

    // Direzione: da punto con x minore a x maggiore
    let fromPoint = from;
    let toPoint = to;
    if (from.x > to.x || (from.x === to.x && from.y > to.y)) {
      fromPoint = to;
      toPoint = from;
    }

    // CRITICAL: Clamp both endpoints to exact canvas bounds
    // This ensures no connection endpoints go outside [0, canvasWidth] × [0, canvasHeight]
    const clampedFrom = clampToCanvas(fromPoint.x, fromPoint.y, canvasWidth, canvasHeight);
    const clampedTo = clampToCanvas(toPoint.x, toPoint.y, canvasWidth, canvasHeight);
    fromPoint = { ...fromPoint, x: clampedFrom.x, y: clampedFrom.y };
    toPoint = { ...toPoint, x: clampedTo.x, y: clampedTo.y };

    // Calcola distanza del bordo
    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const dist = Math.hypot(dx, dy);

    // Curvatura da Naturale–Artificiale con varietà
    const meanNatArt =
      (from.axes.naturale_artificiale + to.axes.naturale_artificiale) / 2;
    const curvature = curvatureFor(meanNatArt, complessita, mutamento, connectionSeed);
    
    // Distance thresholds for deciding if curved - scale from normalized to pixel space
    // Base values: 80px and 220px normalized for 1080×1080
    // Scale to actual canvas dimensions using average dimension
    const avgCanvasDim = (canvasWidth + canvasHeight) / 2;
    const baseScale = avgCanvasDim / 1080; // Scale factor relative to 1080×1080
    const SHORT_DIST = 80 * baseScale;   // short, local connections
    const MEDIUM_DIST = 150 * baseScale; // medium connections (new threshold)
    const LONG_DIST = 220 * baseScale;   // long, global connections
    
    // Decide curved basandosi su distanza e semantica
    // IMPORTANT: Default to false (straight) for better balance, then set to true based on conditions
    let curved = false;
    
    if (forceCurved) {
      // Bridge connections: always curved
      curved = true;
    } else if (dist <= SHORT_DIST) {
      // Very short edges: mostly straight, unless strongly "Naturale"
      if (meanNatArt <= -3) {
        // Strongly "Naturale" -> curved
        curved = true;
      } else {
        // Otherwise straight
        curved = false;
      }
    } else if (dist >= LONG_DIST) {
      // Very long edges: always curved
      curved = true;
    } else if (dist <= MEDIUM_DIST) {
      // Short-to-medium distances: prefer straight unless strongly "Naturale"
      if (meanNatArt <= -5) {
        // Very strongly "Naturale" -> curved
        curved = true;
      } else {
        // Otherwise straight
        curved = false;
      }
    } else {
      // Medium-to-long distances: use semantics to decide
      // More "Naturale" (negative) -> more likely curved
      // More "Artificiale" (positive) -> more likely straight
      if (meanNatArt >= 3) {
        // Strongly "Artificiale" -> straight
        curved = false;
      } else if (meanNatArt <= -3) {
        // Strongly "Naturale" -> curved
        curved = true;
      } else {
        // Neutral range: prefer straight for better balance
        // Only make curved if distance is very close to LONG_DIST
        const distRatio = (dist - MEDIUM_DIST) / (LONG_DIST - MEDIUM_DIST);
        curved = distRatio > 0.7; // Only if more than 70% of the way to LONG_DIST
      }
    }

    // Tratteggio da Teoria–Pratica (più teoria → più tratteggiato)
    // Use dashed lines for connections that are more "teoria" (negative values)
    // Make threshold more lenient: < 2 instead of < 0 to ensure we get dashed lines
    // Also make some connections dashed based on generationDepth for variety
    const meanTeoriaPratica =
      (from.axes.teoria_pratica + to.axes.teoria_pratica) / 2;
    // Use a more lenient threshold OR make some connections dashed based on other factors
    const isTeoria = meanTeoriaPratica < 2; // More lenient: any connection leaning toward teoria
    const isSecondary = generationDepth > 0; // Extra connections and branches
    // Make dashed if: leaning toward teoria OR it's a secondary connection (for visual variety)
    const dashed = isTeoria || (isSecondary && meanTeoriaPratica < 4);

    return {
      from: fromPoint,
      to: toPoint,
      curved,
      curvature,
      dashed,
      semanticInfluence: meanAxes,
      generationDepth,
      generatedFrom: undefined,
    };
  };

  // 1. Costruisci MST (generationDepth = 0)
  const mstEdges = buildMST(
    allPoints.map((p) => ({ x: p.x, y: p.y })),
    `${seed}-mst`
  );

  // Set per tracciare connessioni esistenti (per evitare duplicati)
  const existingConnections = new Set<string>();
  const connectionKey = (i: number, j: number) => {
    return i < j ? `${i}-${j}` : `${j}-${i}`;
  };

  // Aggiungi connessioni MST
  for (const edge of mstEdges) {
    const key = connectionKey(edge.from, edge.to);
    existingConnections.add(key);
    connections.push(
      createConnection(
        allPoints[edge.from],
        allPoints[edge.to],
        0,
        false,
        `${seed}-mst-${edge.from}-${edge.to}`
      )
    );
  }

  // 2. Aggiungi CONNESSIONI INTRA-CLUSTER (within same cluster) e INTER-CLUSTER (between clusters)
  // Separate intra-cluster from inter-cluster to control density better
  
  // Track connections per node to enforce MAX_CONNECTIONS_PER_NODE limit
  const connectionsPerNode = new Map<number, number>();
  allPoints.forEach((_, idx) => connectionsPerNode.set(idx, 0));

  // Count existing MST connections per node
  for (const edge of mstEdges) {
    connectionsPerNode.set(edge.from, (connectionsPerNode.get(edge.from) || 0) + 1);
    connectionsPerNode.set(edge.to, (connectionsPerNode.get(edge.to) || 0) + 1);
  }

  const intraClusterConnections: BranchedConnection[] = [];
  const interClusterConnections: BranchedConnection[] = [];

  // Separate neighbors into intra-cluster and inter-cluster
  for (let i = 0; i < allPoints.length; i++) {
    const pointI = allPoints[i];
    const currentConnections = connectionsPerNode.get(i) || 0;
    
    // Skip if node already has max connections
    if (currentConnections >= MAX_CONNECTIONS_PER_NODE) continue;

    const intraNeighbors: Array<{ index: number; dist: number; score: number }> = [];
    const interNeighbors: Array<{ index: number; dist: number }> = [];

    for (let j = 0; j < allPoints.length; j++) {
      if (i === j) continue;

      const key = connectionKey(i, j);
      if (existingConnections.has(key)) continue;

      const pointJ = allPoints[j];
      const dist = distance(pointI, pointJ);
      const isSameCluster = pointI.clusterIndex === pointJ.clusterIndex;

      if (isSameCluster) {
        // Intra-cluster: bias towards medium-range distances, avoid ultra-short
        // Scale thresholds from normalized to pixel space
        const avgCanvasDim = (canvasWidth + canvasHeight) / 2;
        const baseScale = avgCanvasDim / 1080;
        const minDist = INTRA_CLUSTER_MIN_DIST_NORM * avgCanvasDim; // Convert normalized to pixels
        const preferredDist = INTRA_CLUSTER_PREFERRED_DIST_NORM * avgCanvasDim;
        if (dist >= minDist) {
          // Score: prefer distances around preferred distance
          const distFromPreferred = Math.abs(dist - preferredDist);
          const score = 1 / (1 + distFromPreferred / (20 * baseScale)); // Higher score for preferred distance
          intraNeighbors.push({ index: j, dist, score });
        }
      } else {
        // Inter-cluster: all distances are candidates
        interNeighbors.push({ index: j, dist });
      }
    }

    // Sort intra-cluster by score (prefer medium-range), then by distance
    intraNeighbors.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.1) return b.score - a.score;
      return a.dist - b.dist;
    });

    // Sort inter-cluster by distance
    interNeighbors.sort((a, b) => a.dist - b.dist);

    // Add intra-cluster connections (limited by MAX_CONNECTIONS_PER_NODE)
    const maxIntraForNode = Math.max(1, MAX_CONNECTIONS_PER_NODE - currentConnections);
    const numIntra = Math.min(
      Math.round(1 + densita * 2), // 1-3 intra-cluster connections based on densità
      maxIntraForNode,
      intraNeighbors.length
    );

    for (let k = 0; k < numIntra; k++) {
      const neighbor = intraNeighbors[k];
      const key = connectionKey(i, neighbor.index);
      if (existingConnections.has(key)) continue;

      const neighborConnections = connectionsPerNode.get(neighbor.index) || 0;
      if (neighborConnections >= MAX_CONNECTIONS_PER_NODE) continue;

      existingConnections.add(key);
      connectionsPerNode.set(i, (connectionsPerNode.get(i) || 0) + 1);
      connectionsPerNode.set(neighbor.index, neighborConnections + 1);
      intraClusterConnections.push(
        createConnection(
          allPoints[i],
          allPoints[neighbor.index],
          1,
          false,
          `${seed}-intra-${i}-${neighbor.index}`
        )
      );
    }
  }

  connections.push(...intraClusterConnections);

  // Add inter-cluster connections (prioritize these)
  // Ensure minimum inter-cluster connections regardless of densità
  const minInterCluster = densita > 0 ? MIN_INTER_CLUSTER_CONNECTIONS : 0;
  const maxInterCluster = Math.round(
    minInterCluster + (densita + complessita) * 4
  );

  // Collect all inter-cluster candidate pairs
  const interClusterCandidates: Array<{
    pointA: number;
    pointB: number;
    dist: number;
  }> = [];

  for (let i = 0; i < allPoints.length; i++) {
    for (let j = i + 1; j < allPoints.length; j++) {
      if (allPoints[i].clusterIndex === allPoints[j].clusterIndex) continue;

      const key = connectionKey(i, j);
      if (existingConnections.has(key)) continue;

      const dist = distance(allPoints[i], allPoints[j]);
      interClusterCandidates.push({ pointA: i, pointB: j, dist });
    }
  }

  // Sort by distance
  interClusterCandidates.sort((a, b) => a.dist - b.dist);

  // Add inter-cluster connections
  const numInterCluster = Math.min(maxInterCluster, interClusterCandidates.length);
  for (let i = 0; i < numInterCluster; i++) {
    const candidate = interClusterCandidates[i];
    const key = connectionKey(candidate.pointA, candidate.pointB);
    if (existingConnections.has(key)) continue;

    existingConnections.add(key);
    interClusterConnections.push(
      createConnection(
        allPoints[candidate.pointA],
        allPoints[candidate.pointB],
        1,
        true, // forceCurved: inter-cluster connections should be curved
        `${seed}-inter-${candidate.pointA}-${candidate.pointB}`
      )
    );
  }

  connections.push(...interClusterConnections);

  // 3. Aggiungi CONNESSIONI BRIDGE tra cluster (long arcs)
  if (clusters.length >= 2) {
    // Calcola centroide per ogni cluster
    const centroids: Point[] = clusters.map((cluster) => {
      const sumX = cluster.points.reduce((s, p) => s + p.x, 0);
      const sumY = cluster.points.reduce((s, p) => s + p.y, 0);
      return {
        x: sumX / cluster.points.length,
        y: sumY / cluster.points.length,
      };
    });

    // Trova il punto rappresentativo per ogni cluster (primary point o nearest to centroid)
    const representativePoints: number[] = clusters.map((cluster, clusterIdx) => {
      const centroid = centroids[clusterIdx];
      let bestPointIdx = -1;
      let bestDist = Infinity;

      // Cerca il primary point o il più vicino al centroide
      for (let i = 0; i < allPoints.length; i++) {
        if (allPoints[i].clusterIndex !== clusterIdx) continue;

        if (allPoints[i].isPrimary) {
          bestPointIdx = i;
          break;
        }

        const dist = distance(allPoints[i], centroid);
        if (dist < bestDist) {
          bestDist = dist;
          bestPointIdx = i;
        }
      }

      return bestPointIdx;
    });

    // Costruisci candidati per bridge (tutte le coppie di cluster)
    const bridgeCandidates: Array<{
      clusterA: number;
      clusterB: number;
      pointA: number;
      pointB: number;
      dist: number;
    }> = [];

    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const pointA = representativePoints[a];
        const pointB = representativePoints[b];
        if (pointA < 0 || pointB < 0) continue;

        const dist = distance(allPoints[pointA], allPoints[pointB]);
        bridgeCandidates.push({
          clusterA: a,
          clusterB: b,
          pointA,
          pointB,
          dist,
        });
      }
    }

    // Ordina per distanza (più vicine prima)
    bridgeCandidates.sort((a, b) => a.dist - b.dist);

    // Calcola numero di bridge da aggiungere
    const minBridges = 2;
    const maxBridges = 6;
    const numBridges = Math.min(
      minBridges + Math.round(((densita + complessita) * (maxBridges - minBridges)) / 2),
      bridgeCandidates.length
    );

    const bridgeConnections: BranchedConnection[] = [];

    for (let i = 0; i < numBridges; i++) {
      const candidate = bridgeCandidates[i];
      const key = connectionKey(candidate.pointA, candidate.pointB);
      if (existingConnections.has(key)) continue;

      existingConnections.add(key);
      bridgeConnections.push(
        createConnection(
          allPoints[candidate.pointA],
          allPoints[candidate.pointB],
          1,
          true, // forceCurved = true: bridge connections should always be curved
          `${seed}-bridge-${candidate.pointA}-${candidate.pointB}`
        )
      );
    }

    connections.push(...bridgeConnections);
  }

  // 4. Applica cap globale basato su complessita
  const baseMax = allPoints.length * 2;
  const factor = 1 + complessita * 3;
  const maxConnections = Math.round(baseMax * factor);

  if (connections.length > maxConnections) {
    // Mantieni tutte le MST (generationDepth = 0)
    const mstConnections = connections.filter((c) => c.generationDepth === 0);
    const extraConnections = connections.filter((c) => c.generationDepth > 0);

    // Ordina le extra per distanza (più corte prima, per mantenere le locali)
    extraConnections.sort((a, b) => {
      const distA = distance(a.from, a.to);
      const distB = distance(b.from, b.to);
      return distA - distB;
    });

    // Tronca le extra per rispettare il cap
    const allowedExtra = maxConnections - mstConnections.length;
    const trimmedExtra = extraConnections.slice(0, Math.max(0, allowedExtra));

    return [...mstConnections, ...trimmedExtra];
  }

  return connections;
}

/**
 * Calcola la media di due vettori di assi
 */
function averageAxes(a1: Axes, a2: Axes): Axes {
  return {
    ordine_caos: (a1.ordine_caos + a2.ordine_caos) / 2,
    conflitto_consenso: (a1.conflitto_consenso + a2.conflitto_consenso) / 2,
    teoria_pratica: (a1.teoria_pratica + a2.teoria_pratica) / 2,
    individuale_collettivo:
      (a1.individuale_collettivo + a2.individuale_collettivo) / 2,
    naturale_artificiale:
      (a1.naturale_artificiale + a2.naturale_artificiale) / 2,
    locale_globale: (a1.locale_globale + a2.locale_globale) / 2,
  };
}

/**
 * Ottiene punti approssimati di una connessione (per rilevamento intersezioni)
 * Per curve, approssima usando il punto di controllo Bézier
 */
function getConnectionPoints(conn: Connection): Point[] {
  if (conn.curved) {
    // Per curve, usa il punto di controllo Bézier come punto intermedio
    const mx = (conn.from.x + conn.to.x) / 2;
    const my = (conn.from.y + conn.to.y) / 2;
    const cx = mx + (conn.to.y - conn.from.y) * conn.curvature;
    const cy = my - (conn.to.x - conn.from.x) * conn.curvature;
    return [conn.from, { x: cx, y: cy }, conn.to];
  } else {
    return [conn.from, conn.to];
  }
}

/**
 * Verifica se due segmenti lineari si intersecano e calcola il punto di intersezione
 * @returns Punto di intersezione o null se non si intersecano
 */
function segmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const x1 = p1.x,
    y1 = p1.y;
  const x2 = p2.x,
    y2 = p2.y;
  const x3 = p3.x,
    y3 = p3.y;
  const x4 = p4.x,
    y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null; // Linee parallele

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Verifica che l'intersezione sia dentro entrambi i segmenti
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
}

/**
 * Rileva tutte le intersezioni tra connessioni
 * @param connections Array di connessioni
 * @returns Array di intersezioni
 */
export function detectIntersections(
  connections: Connection[]
): Intersection[] {
  const intersections: Intersection[] = [];
  const intersectionMap = new Map<string, number[]>(); // point key -> connection indices

  for (let i = 0; i < connections.length; i++) {
    const conn1 = connections[i];
    const points1 = getConnectionPoints(conn1);

    for (let j = i + 1; j < connections.length; j++) {
      const conn2 = connections[j];
      const points2 = getConnectionPoints(conn2);

      // Verifica intersezioni tra tutti i segmenti delle due connessioni
      for (let k = 0; k < points1.length - 1; k++) {
        for (let l = 0; l < points2.length - 1; l++) {
          const intersection = segmentIntersection(
            points1[k],
            points1[k + 1],
            points2[l],
            points2[l + 1]
          );

          if (intersection) {
            // Arrotonda per raggruppare intersezioni vicine
            const key = `${Math.round(intersection.x)},${Math.round(intersection.y)}`;
            if (!intersectionMap.has(key)) {
              intersectionMap.set(key, []);
            }
            const indices = intersectionMap.get(key)!;
            if (!indices.includes(i)) indices.push(i);
            if (!indices.includes(j)) indices.push(j);
          }
        }
      }
    }
  }

  // Converti la mappa in array di Intersection
  intersectionMap.forEach((indices, key) => {
    const [x, y] = key.split(",").map(Number);
    intersections.push({
      point: { x, y },
      fromIndices: indices,
    });
  });

  return intersections;
}

/**
 * Aggiunge ramificazioni dalle intersezioni
 * All geometry is generated in [0, canvasWidth] × [0, canvasHeight] coordinate space.
 * 
 * @param connections Connessioni esistenti
 * @param intersections Intersezioni rilevate
 * @param ramificazione Slider ramificazione [0, 1]
 * @param seed Seed globale per determinismo
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Array di connessioni con ramificazioni (BranchedConnection)
 */
export function addBranching(
  connections: BranchedConnection[],
  intersections: Intersection[],
  ramificazione: number,
  seed: string,
  canvasWidth: number,
  canvasHeight: number
): BranchedConnection[] {
  // Le connessioni esistenti sono già BranchedConnection
  const branched: BranchedConnection[] = [...connections];

  if (ramificazione === 0 || intersections.length === 0) {
    return branched;
  }

  // Seeded PRNG for deterministic intersection selection
  const rng = seedrandom(seed + ":branching");

  // Compute effective branching ratio: 0% at ramificazione=0, 70% at ramificazione=1
  const MAX_RATIO = 0.7; // 70% at maximum
  const branchingRatio = ramificazione * MAX_RATIO;

  // Select only a subset of intersections based on branchingRatio
  const selectedIntersections = intersections.filter(() => {
    if (branchingRatio <= 0) return false;
    const r = rng();
    return r < branchingRatio;
  });

  if (selectedIntersections.length === 0) {
    return branched;
  }

  const rngBranches = prng(`${seed}-branching`);
  const maxBranchesPerIntersection = Math.floor(1 + ramificazione * 4); // 1-5 ramificazioni
  const maxTotalBranches = Math.floor(connections.length * 2 * ramificazione); // Limite globale

  let totalBranches = 0;

  for (const intersection of selectedIntersections) {
    if (totalBranches >= maxTotalBranches) break;

    // Ottieni le connessioni coinvolte
    const involvedConnections = intersection.fromIndices.map(
      (idx) => connections[idx]
    );

    if (involvedConnections.length < 2) continue;

    // Calcola media degli assi semantici delle connessioni coinvolte
    let meanAxes: Axes | null = null;
    for (const conn of involvedConnections) {
      if (conn.semanticInfluence) {
        const axes = conn.semanticInfluence as Partial<Axes>;
        const fullAxes: Axes = {
          ordine_caos: axes.ordine_caos ?? 0,
          conflitto_consenso: axes.conflitto_consenso ?? 0,
          teoria_pratica: axes.teoria_pratica ?? 0,
          individuale_collettivo: axes.individuale_collettivo ?? 0,
          naturale_artificiale: axes.naturale_artificiale ?? 0,
          locale_globale: axes.locale_globale ?? 0,
        };
        if (!meanAxes) {
          meanAxes = fullAxes;
        } else {
          meanAxes = averageAxes(meanAxes, fullAxes);
        }
      }
    }

    if (!meanAxes) continue;

    // Calcola direzioni normalizzate delle connessioni incidenti
    const directions: Point[] = [];
    for (const conn of involvedConnections) {
      const dx = conn.to.x - conn.from.x;
      const dy = conn.to.y - conn.from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        directions.push({ x: dx / len, y: dy / len });
      }
    }

    // Somma delle direzioni
    const sumDir = directions.reduce(
      (acc, dir) => ({ x: acc.x + dir.x, y: acc.y + dir.y }),
      { x: 0, y: 0 }
    );
    const sumLen = Math.sqrt(sumDir.x * sumDir.x + sumDir.y * sumDir.y);
    const baseDir = sumLen > 0
      ? { x: sumDir.x / sumLen, y: sumDir.y / sumLen }
      : { x: 1, y: 0 };

    // Numero di ramificazioni per questa intersezione
    const numBranches = Math.floor(
      1 + rngBranches() * (maxBranchesPerIntersection - 1) * ramificazione
    );

    for (let i = 0; i < numBranches && totalBranches < maxTotalBranches; i++) {
      // Offset angolare deterministico
      const angleOffset = (rngBranches() - 0.5) * Math.PI * 0.5; // ±45°
      
      // Influenze semantiche
      const ordineCaos = meanAxes.ordine_caos;
      const chaosFactor = (-ordineCaos + 10) / 20; // [0, 1]
      const angleJitter = (rngBranches() - 0.5) * Math.PI * 0.3 * chaosFactor;
      const finalAngle = Math.atan2(baseDir.y, baseDir.x) + angleOffset + angleJitter;

      // Lunghezza influenzata da Locale–Globale - scale from normalized to pixel space
      const localeGlobale = meanAxes.locale_globale;
      const globalFactor = (localeGlobale + 10) / 20; // [0, 1]
      const avgCanvasDim = (canvasWidth + canvasHeight) / 2;
      const baseScale = avgCanvasDim / 1080;
      // Base values: 30px and 150px normalized for 1080×1080
      const minLength = 30 * baseScale;
      const maxLength = 150 * baseScale;
      const length = minLength + (maxLength - minLength) * globalFactor;

      // Punto di destinazione
      const toPoint: Point = {
        x: intersection.point.x + Math.cos(finalAngle) * length,
        y: intersection.point.y + Math.sin(finalAngle) * length,
      };

      // Clamp al canvas (exact bounds)
      const clampedTo = clampToCanvas(toPoint.x, toPoint.y, canvasWidth, canvasHeight);

      // Curvatura da Naturale–Artificiale con varietà (usando mutamento per irregolarità)
      const meanNatArt = meanAxes.naturale_artificiale;
      const branchSeed = `${seed}-branch-${intersection.point.x}-${intersection.point.y}-${i}`;
      // Use higher complessità (0.7) and ramificazione as mutamento for branches
      const curvature = curvatureFor(meanNatArt, 0.7, ramificazione, branchSeed);
      const curved = Math.abs(curvature) > 0.1;

      // Tratteggio da Teoria–Pratica
      // Use dashed lines for branches that are more "teoria" (negative values)
      // Make threshold more lenient: < 2 to ensure we get dashed lines
      // Branches are secondary connections, so make them more likely to be dashed
      const meanTeoriaPratica = meanAxes.teoria_pratica;
      const dashed = meanTeoriaPratica < 2; // More lenient threshold to ensure dashed lines appear

      // Trova l'indice dell'intersezione
      const intersectionIndex = intersections.findIndex(
        (i) =>
          Math.abs(i.point.x - intersection.point.x) < 1 &&
          Math.abs(i.point.y - intersection.point.y) < 1
      );

      branched.push({
        from: intersection.point,
        to: clampedTo,
        curved,
        curvature,
        dashed,
        semanticInfluence: meanAxes,
        generationDepth: 2, // Ramificazioni
        generatedFrom: intersectionIndex >= 0 ? intersectionIndex : undefined,
      });

      totalBranches++;
    }
  }

  return branched;
}

/**
 * Calcola il punto di controllo per una curva Bézier quadratica
 * The control point is clamped to canvas bounds to prevent curves from extending outside.
 * 
 * @param c Connessione
 * @param canvasWidth Canvas width in pixels (optional, for clamping)
 * @param canvasHeight Canvas height in pixels (optional, for clamping)
 * @returns Punto di controllo { cx, cy }
 */
export function computeCurveControl(
  c: Connection,
  canvasWidth?: number,
  canvasHeight?: number
): { cx: number; cy: number } {
  const mx = (c.from.x + c.to.x) / 2;
  const my = (c.from.y + c.to.y) / 2;
  let cx = mx + (c.to.y - c.from.y) * c.curvature;
  let cy = my - (c.to.x - c.from.x) * c.curvature;
  
  // Clamp control point to canvas bounds if dimensions provided
  // This prevents curves from extending outside the canvas area
  if (canvasWidth !== undefined && canvasHeight !== undefined) {
    const clamped = clampToCanvas(cx, cy, canvasWidth, canvasHeight);
    cx = clamped.x;
    cy = clamped.y;
  }
  
  return { cx, cy };
}

/**
 * Replicates a pattern using mirroring transforms instead of rotation.
 * This avoids swastika-like or spiral/pinwheel patterns that can emerge
 * from rotational symmetry.
 * All geometry is generated in [0, canvasWidth] × [0, canvasHeight] coordinate space.
 *
 * Strategy:
 * - Base pattern (no transform)
 * - Vertical mirror (flip across X-axis)
 * - Horizontal mirror (flip across Y-axis)
 * - Both mirrors (flip X and Y, equivalent to 180° rotation - safe)
 *
 * Additional replicas use small random jitter to break perfect symmetry
 * while maintaining a neutral, abstract aesthetic.
 *
 * @param connections Array of connections to replicate
 * @param replicas Number of replicas to create (0 = none, just return original)
 * @param seed Seed for deterministic randomness
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Array with original connections plus mirrored replicas
 */
export function replicatePattern(
  connections: BranchedConnection[],
  replicas: number,
  seed: string,
  canvasWidth: number,
  canvasHeight: number
): BranchedConnection[] {
  if (replicas <= 0) return connections;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  const result: BranchedConnection[] = [...connections];

  const rng = seedrandom(seed + ":replicas");

  /**
   * Mirrors a point across the vertical axis (X-axis flip)
   * Result is clamped to canvas bounds to prevent geometry from extending outside.
   */
  const mirrorVertical = (p: Point): Point => {
    const mirrored = {
      x: centerX - (p.x - centerX), // Flip X around center
      y: p.y,
    };
    // Clamp to canvas bounds
    return clampToCanvas(mirrored.x, mirrored.y, canvasWidth, canvasHeight);
  };

  /**
   * Mirrors a point across the horizontal axis (Y-axis flip)
   * Result is clamped to canvas bounds to prevent geometry from extending outside.
   */
  const mirrorHorizontal = (p: Point): Point => {
    const mirrored = {
      x: p.x,
      y: centerY - (p.y - centerY), // Flip Y around center
    };
    // Clamp to canvas bounds
    return clampToCanvas(mirrored.x, mirrored.y, canvasWidth, canvasHeight);
  };

  /**
   * Mirrors a point across both axes (X and Y flip, equivalent to 180° rotation)
   * Result is clamped to canvas bounds to prevent geometry from extending outside.
   */
  const mirrorBoth = (p: Point): Point => {
    const mirrored = {
      x: centerX - (p.x - centerX),
      y: centerY - (p.y - centerY),
    };
    // Clamp to canvas bounds
    return clampToCanvas(mirrored.x, mirrored.y, canvasWidth, canvasHeight);
  };

  /**
   * Applies a small random jitter to break perfect symmetry
   * Result is clamped to exact canvas bounds
   */
  const applyJitter = (p: Point, maxOffset: number): Point => {
    const offsetX = (rng() - 0.5) * maxOffset;
    const offsetY = (rng() - 0.5) * maxOffset;
    return clampToCanvas(p.x + offsetX, p.y + offsetY, canvasWidth, canvasHeight);
  };

  // Primary mirroring transforms (safe, neutral symmetries)
  const transforms: Array<(p: Point) => Point> = [
    mirrorVertical,   // Replica 1: vertical mirror
    mirrorHorizontal, // Replica 2: horizontal mirror
    mirrorBoth,       // Replica 3: both mirrors (cross symmetry)
  ];

  // Apply primary mirroring transforms
  for (let i = 0; i < Math.min(replicas, transforms.length); i++) {
    const transform = transforms[i];
    for (const c of connections) {
      // Transform and clamp both endpoints to ensure they stay within canvas bounds
      const transformedFrom = transform(c.from);
      const transformedTo = transform(c.to);
      result.push({
        ...c,
        from: transformedFrom,
        to: transformedTo,
        generationDepth: c.generationDepth + 1,
      });
    }
  }

  // For additional replicas beyond the primary 3, use jittered versions
  // of the primary transforms to maintain variety without rotational arms
  if (replicas > transforms.length) {
    const extraReplicas = replicas - transforms.length;
    for (let k = 0; k < extraReplicas; k++) {
      // Use a combination of mirroring with small jitter
      const baseTransform = transforms[k % transforms.length];
      const jitterAmount = 8 + rng() * 12; // 8-20px jitter

      for (const c of connections) {
        const transformedFrom = baseTransform(c.from);
        const transformedTo = baseTransform(c.to);
        result.push({
          ...c,
          from: applyJitter(transformedFrom, jitterAmount),
          to: applyJitter(transformedTo, jitterAmount),
          generationDepth: c.generationDepth + 1,
        });
      }
    }
  }

  return result;
}

