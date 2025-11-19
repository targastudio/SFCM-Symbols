import type { BranchedConnection, Point } from "../types";

export type OriginAnchorPoint = {
  point: Point;
  keyword: string;
  index: number;
};

/**
 * Generates dashed straight connections between every pair of keyword anchor points.
 *
 * The output order is deterministic and follows the lexical ordering of the
 * input anchor array (loop i<j). This ensures identical outputs for identical
 * keyword lists and canvas sizes.
 */
export function generateOriginBridges(anchors: OriginAnchorPoint[]): BranchedConnection[] {
  if (anchors.length < 2) {
    return [];
  }

  const bridges: BranchedConnection[] = [];

  for (let i = 0; i < anchors.length - 1; i++) {
    const from = anchors[i];
    for (let j = i + 1; j < anchors.length; j++) {
      const to = anchors[j];
      bridges.push({
        from: from.point,
        to: to.point,
        curved: false,
        curvature: 0,
        dashed: true,
        semanticInfluence: {},
        generationDepth: 0,
      });
    }
  }

  return bridges;
}
