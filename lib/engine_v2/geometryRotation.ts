/**
 * Feature3 — Geometry rotation helper
 *
 * Applies a deterministic 90° clockwise rotation around the canvas center
 * when the Force Orientation toggle requests it and the pre-mirroring
 * bounding box is taller than it is wide.
 */

import type { BranchedConnection, GeometryBoundingBox, Point } from "../types";

/**
 * Determines whether geometry rotation should be applied based on the
 * Force Orientation toggle and the pre-mirroring bounding box.
 */
export function shouldRotateGeometry(
  forceOrientation: boolean | undefined,
  bbox: GeometryBoundingBox | null
): boolean {
  if (!forceOrientation || !bbox) {
    return false;
  }

  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;

  if (width <= 0 || height <= 0) {
    return false;
  }

  return height > width;
}

function rotatePointClockwise(point: Point, centerX: number, centerY: number): Point {
  const dx = point.x - centerX;
  const dy = point.y - centerY;

  return {
    x: centerX + dy,
    y: centerY - dx,
  };
}

/**
 * Returns a new BranchedConnection array rotated 90° clockwise.
 */
export function rotateConnectionsClockwise(
  connections: BranchedConnection[],
  canvasWidth: number,
  canvasHeight: number
): BranchedConnection[] {
  if (connections.length === 0) {
    return connections;
  }

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  return connections.map((conn) => ({
    ...conn,
    from: rotatePointClockwise(conn.from, centerX, centerY),
    to: rotatePointClockwise(conn.to, centerX, centerY),
  }));
}
