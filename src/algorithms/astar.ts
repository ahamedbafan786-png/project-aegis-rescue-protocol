import { calculateHeuristic, SQRT_2 } from './heuristics';
import { MinHeap } from './minHeap';
import {
  GridCoord,
  HeuristicType,
  MovementMode,
  PathResult,
  SearchStep,
  TileType,
} from './types';

export interface AStarOptions {
  grid: TileType[][];
  rows: number;
  cols: number;
  start: GridCoord;
  goal: GridCoord;
  movementMode?: MovementMode;
  heuristicType?: HeuristicType;
  recordSteps?: boolean;
  maxSteps?: number;
}

interface HeapNode {
  coord: GridCoord;
  key: string;
  g: number;
  h: number;
  f: number;
}

export function coordKey(c: GridCoord): string {
  return `${c.r},${c.c}`;
}

export function parseKey(key: string): GridCoord {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
}

export function isTileBlocked(tile: TileType): boolean {
  return tile === 'WALL' || tile === 'DEBRIS';
}

export function getTileMovementCost(tile: TileType): number {
  switch (tile) {
    case 'ROUGH_TERRAIN':
      return 3.0; // High-friction terrain
    default:
      return 1.0; // Normal traversable ground
  }
}

/**
 * Pure A* Pathfinding Algorithm
 * Strictly admissible heuristics & optimal tie-breaking
 */
export function findPathAStar(options: AStarOptions): PathResult {
  const {
    grid,
    rows,
    cols,
    start,
    goal,
    movementMode = '4-directional',
    heuristicType = movementMode === '8-directional' ? 'octile' : 'manhattan',
    recordSteps = false,
    maxSteps = 50000,
  } = options;

  const startTime = performance.now();
  let queueOperations = 0;

  // Edge case: Start equals Goal
  if (start.r === goal.r && start.c === goal.c) {
    const elapsed = performance.now() - startTime;
    return {
      path: [start],
      found: true,
      exploredNodes: [start],
      searchSteps: [],
      executionTimeMs: elapsed,
      totalCost: 0,
      nodesExpandedCount: 1,
      queueOperationsCount: 0,
      gScores: { [coordKey(start)]: 0 },
      hScores: { [coordKey(start)]: 0 },
      fScores: { [coordKey(start)]: 0 },
    };
  }

  // Edge case: Goal is blocked or Start is blocked
  if (isTileBlocked(grid[start.r][start.c]) || isTileBlocked(grid[goal.r][goal.c])) {
    const elapsed = performance.now() - startTime;
    return {
      path: [],
      found: false,
      exploredNodes: [],
      searchSteps: [],
      executionTimeMs: elapsed,
      totalCost: Infinity,
      nodesExpandedCount: 0,
      queueOperationsCount: 0,
      gScores: {},
      hScores: {},
      fScores: {},
    };
  }

  // Comparator with strict tie-breaking:
  // Primary: Lowest f
  // Secondary: Highest g (searches deeper along promising branch)
  // Tertiary: Lowest h
  const comparator = (a: HeapNode, b: HeapNode): number => {
    if (Math.abs(a.f - b.f) > 0.00001) {
      return a.f - b.f;
    }
    if (Math.abs(a.g - b.g) > 0.00001) {
      return b.g - a.g; // Higher g first
    }
    return a.h - b.h;
  };

  const openHeap = new MinHeap<HeapNode>(comparator);
  const openSetMap = new Map<string, HeapNode>();
  const closedSet = new Set<string>();
  const parentMap = new Map<string, GridCoord>();

  const gScoreMap: Record<string, number> = {};
  const hScoreMap: Record<string, number> = {};
  const fScoreMap: Record<string, number> = {};

  const startKey = coordKey(start);
  const startH = calculateHeuristic(heuristicType, start, goal);
  const startNode: HeapNode = {
    coord: start,
    key: startKey,
    g: 0,
    h: startH,
    f: startH,
  };

  openHeap.push(startNode);
  openSetMap.set(startKey, startNode);
  queueOperations++;

  gScoreMap[startKey] = 0;
  hScoreMap[startKey] = startH;
  fScoreMap[startKey] = startH;

  const searchSteps: SearchStep[] = [];
  const exploredNodes: GridCoord[] = [];
  let found = false;
  let stepsCount = 0;

  // Directions
  const orthogonalDirections = [
    { dr: -1, dc: 0, cost: 1.0 }, // North
    { dr: 1, dc: 0, cost: 1.0 },  // South
    { dr: 0, dc: -1, cost: 1.0 }, // West
    { dr: 0, dc: 1, cost: 1.0 },  // East
  ];

  const diagonalDirections = [
    { dr: -1, dc: -1, cost: SQRT_2 }, // North-West
    { dr: -1, dc: 1, cost: SQRT_2 },  // North-East
    { dr: 1, dc: -1, cost: SQRT_2 },   // South-West
    { dr: 1, dc: 1, cost: SQRT_2 },    // South-East
  ];

  const directions =
    movementMode === '8-directional'
      ? [...orthogonalDirections, ...diagonalDirections]
      : orthogonalDirections;

  while (!openHeap.isEmpty() && stepsCount < maxSteps) {
    stepsCount++;
    const current = openHeap.pop()!;
    queueOperations++;
    openSetMap.delete(current.key);

    // If already evaluated with a better g, skip
    if (closedSet.has(current.key)) {
      continue;
    }

    closedSet.add(current.key);
    exploredNodes.push(current.coord);

    // Goal Check
    if (current.coord.r === goal.r && current.coord.c === goal.c) {
      found = true;
      break;
    }

    const neighborsChecked: GridCoord[] = [];

    for (const dir of directions) {
      const nr = current.coord.r + dir.dr;
      const nc = current.coord.c + dir.dc;

      // Bounds check
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
        continue;
      }

      // Blocked check
      if (isTileBlocked(grid[nr][nc])) {
        continue;
      }

      // Corner-cutting check for diagonal moves:
      // Cannot move diagonally if either adjacent orthogonal tile is blocked
      if (dir.dr !== 0 && dir.dc !== 0) {
        const side1Blocked = isTileBlocked(grid[current.coord.r + dir.dr][current.coord.c]);
        const side2Blocked = isTileBlocked(grid[current.coord.r][current.coord.c + dir.dc]);
        if (side1Blocked || side2Blocked) {
          continue; // Diagonal corner-cutting strictly prevented
        }
      }

      const neighborCoord: GridCoord = { r: nr, c: nc };
      const neighborKey = coordKey(neighborCoord);

      if (closedSet.has(neighborKey)) {
        continue;
      }

      neighborsChecked.push(neighborCoord);

      // Edge movement cost (orthogonal: 1, diagonal: sqrt(2)) * terrain multiplier
      const terrainMultiplier = getTileMovementCost(grid[nr][nc]);
      const moveCost = dir.cost * terrainMultiplier;
      const tentativeG = current.g + moveCost;

      const existingG = gScoreMap[neighborKey];

      if (existingG === undefined || tentativeG < existingG) {
        parentMap.set(neighborKey, current.coord);
        const h = calculateHeuristic(heuristicType, neighborCoord, goal);
        const f = tentativeG + h;

        gScoreMap[neighborKey] = tentativeG;
        hScoreMap[neighborKey] = h;
        fScoreMap[neighborKey] = f;

        const nextNode: HeapNode = {
          coord: neighborCoord,
          key: neighborKey,
          g: tentativeG,
          h,
          f,
        };

        openHeap.push(nextNode);
        openSetMap.set(neighborKey, nextNode);
        queueOperations++;
      }
    }

    if (recordSteps) {
      searchSteps.push({
        currentNode: current.coord,
        openSetCoords: Array.from(openSetMap.values()).map((n) => n.coord),
        closedSetCoords: Array.from(closedSet).map(parseKey),
        neighborsChecked,
        g: current.g,
        h: current.h,
        f: current.f,
      });
    }
  }

  // Reconstruct path
  const path: GridCoord[] = [];
  let totalCost = Infinity;

  if (found) {
    let curr: GridCoord | undefined = goal;
    while (curr) {
      path.unshift(curr);
      curr = parentMap.get(coordKey(curr));
    }
    totalCost = gScoreMap[coordKey(goal)] ?? 0;
  }

  const executionTimeMs = performance.now() - startTime;

  return {
    path,
    found,
    exploredNodes,
    searchSteps,
    executionTimeMs,
    totalCost,
    nodesExpandedCount: exploredNodes.length,
    queueOperationsCount: queueOperations,
    gScores: gScoreMap,
    hScores: hScoreMap,
    fScores: fScoreMap,
  };
}
