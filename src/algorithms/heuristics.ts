import { GridCoord, HeuristicType } from './types';

export const SQRT_2 = Math.SQRT2; // ~1.4142135623730951

/**
 * Strictly Admissible Heuristics for Grid-based Pathfinding
 * Guaranteed: h(n) <= h*(n) at all times (zero heuristic inflation).
 */
export function manhattanDistance(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

export function octileDistance(a: GridCoord, b: GridCoord): number {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  // D = 1.0, D2 = sqrt(2)
  // Formula: D * (dr + dc) + (D2 - 2 * D) * min(dr, dc)
  return (dr + dc) + (SQRT_2 - 2) * Math.min(dr, dc);
}

export function euclideanDistance(a: GridCoord, b: GridCoord): number {
  const dr = a.r - b.r;
  const dc = a.c - b.c;
  return Math.sqrt(dr * dr + dc * dc);
}

export function calculateHeuristic(
  type: HeuristicType,
  current: GridCoord,
  goal: GridCoord
): number {
  switch (type) {
    case 'manhattan':
      return manhattanDistance(current, goal);
    case 'octile':
      return octileDistance(current, goal);
    case 'euclidean':
      return euclideanDistance(current, goal);
    default:
      return manhattanDistance(current, goal);
  }
}
