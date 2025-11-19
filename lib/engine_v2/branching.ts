import type { BranchedConnection, Intersection, Point } from "../types";
import { seededRandom } from "../seed";
import { clampToCanvas, computeCurveControl } from "../svgUtils";

function computeCurvePoint(t: number, p0: Point, p1: Point, p2: Point): Point {
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x;
  const y = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y;
  return { x, y };
}

function getPolylinePoints(
  conn: BranchedConnection,
  canvasWidth: number,
  canvasHeight: number,
  samples = 12
): Point[] {
  if (!conn.curved) {
    return [conn.from, conn.to];
  }

  const control = computeCurveControl(conn, canvasWidth, canvasHeight);
  const controlPoint = { x: control.cx, y: control.cy };
  const points: Point[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    points.push(computeCurvePoint(t, conn.from, controlPoint, conn.to));
  }

  return points;
}

function segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  const x3 = p3.x;
  const y3 = p3.y;
  const x4 = p4.x;
  const y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
}

function normalizeDirection(dir: Point): Point {
  const length = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: dir.x / length, y: dir.y / length };
}

function averageDirection(connections: BranchedConnection[], indices: number[]): Point {
  let sum = { x: 0, y: 0 };

  for (const idx of indices) {
    const conn = connections[idx];
    const dir = normalizeDirection({ x: conn.to.x - conn.from.x, y: conn.to.y - conn.from.y });
    sum = { x: sum.x + dir.x, y: sum.y + dir.y };
  }

  if (sum.x === 0 && sum.y === 0) {
    return { x: 1, y: 0 };
  }

  return normalizeDirection(sum);
}

export function detectIntersections(
  connections: BranchedConnection[],
  canvasWidth: number,
  canvasHeight: number
): Intersection[] {
  const intersectionMap = new Map<string, Set<number>>();

  for (let i = 0; i < connections.length; i++) {
    const points1 = getPolylinePoints(connections[i], canvasWidth, canvasHeight);

    for (let j = i + 1; j < connections.length; j++) {
      const points2 = getPolylinePoints(connections[j], canvasWidth, canvasHeight);

      for (let k = 0; k < points1.length - 1; k++) {
        for (let l = 0; l < points2.length - 1; l++) {
          const intersection = segmentIntersection(points1[k], points1[k + 1], points2[l], points2[l + 1]);

          if (intersection) {
            const key = `${Math.round(intersection.x)},${Math.round(intersection.y)}`;
            if (!intersectionMap.has(key)) {
              intersectionMap.set(key, new Set<number>());
            }
            intersectionMap.get(key)!.add(i);
            intersectionMap.get(key)!.add(j);
          }
        }
      }
    }
  }

  const intersections: Intersection[] = [];

  for (const [key, indices] of intersectionMap.entries()) {
    if (indices.size < 2) continue;
    const [x, y] = key.split(",").map(Number);
    const fromIndices = Array.from(indices).sort((a, b) => a - b);
    intersections.push({
      point: { x, y },
      fromIndices,
    });
  }

  return intersections;
}

export function applyBranching(
  connections: BranchedConnection[],
  canvasWidth: number,
  canvasHeight: number,
  seed: string
): BranchedConnection[] {
  if (connections.length === 0) return connections;

  const intersections = detectIntersections(connections, canvasWidth, canvasHeight);
  if (intersections.length === 0) return connections;

  const result: BranchedConnection[] = [...connections];
  const diag = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
  const maxIntersections = Math.min(30, intersections.length);

  // Shuffle intersections deterministically to avoid biasing towards early connections
  const shuffledIntersections = [...intersections];
  for (let i = shuffledIntersections.length - 1; i > 0; i--) {
    const swapIndex = Math.floor(seededRandom(`${seed}:branching:intersection:shuffle:${i}`) * (i + 1));
    [shuffledIntersections[i], shuffledIntersections[swapIndex]] = [
      shuffledIntersections[swapIndex],
      shuffledIntersections[i],
    ];
  }

  for (let i = 0; i < maxIntersections; i++) {
    const intersection = shuffledIntersections[i];
    const intersectionOrigin = clampToCanvas(
      intersection.point.x,
      intersection.point.y,
      canvasWidth,
      canvasHeight
    );

    const baseDir = averageDirection(connections, intersection.fromIndices);
    const baseAngle = Math.atan2(baseDir.y, baseDir.x);
    const branchesCount = Math.max(1, Math.round(seededRandom(`${seed}:branching:count:${i}`) * 2));

    for (let branchIndex = 0; branchIndex < branchesCount; branchIndex++) {
      const lengthRnd = seededRandom(`${seed}:branching:length:${i}:${branchIndex}`);
      const branchLength = diag * (0.06 + lengthRnd * 0.06);

      const angleJitter = (seededRandom(`${seed}:branching:angle:${i}:${branchIndex}`) - 0.5) * (2 * Math.PI) / 3;
      const angle = baseAngle + angleJitter;

      const unclampedTo = {
        x: intersectionOrigin.x + Math.cos(angle) * branchLength,
        y: intersectionOrigin.y + Math.sin(angle) * branchLength,
      };

      const to = clampToCanvas(unclampedTo.x, unclampedTo.y, canvasWidth, canvasHeight);

      const curvature = (seededRandom(`${seed}:branching:curvature:${i}:${branchIndex}`) - 0.5) * 0.7;
      const curved = Math.abs(curvature) > 0.08;
      const dashed = seededRandom(`${seed}:branching:dashed:${i}:${branchIndex}`) < 0.35;

      result.push({
        from: intersectionOrigin,
        to,
        curved,
        curvature,
        dashed,
        semanticInfluence: {},
        generationDepth: 1,
        generatedFrom: i,
      });
    }
  }

  return result;
}
