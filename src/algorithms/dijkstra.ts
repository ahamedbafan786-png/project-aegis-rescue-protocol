import {
  coordKey,
  getTileMovementCost,
  isTileBlocked,
  parseKey,
} from './astar';
import { MinHeap } from './minHeap';
import {
  GridCoord,
  MovementMode,
  PathResult,
  SearchStep,
  TileType,
} from './types';
import { SQRT_2 } from './heuristics';

export interface DijkstraOptions {
  grid: TileType[][];
  rows: number;
  cols: number;
  start: GridCoord;
  goal: GridCoord;
  movementMode?: MovementMode;
  recordSteps?: boolean;
  maxSteps?: number;
}

interface DijkstraNode {
  coord: GridCoord;
  key: string;
  dist: number;
}

export function findPathDijkstra(options: DijkstraOptions): PathResult {
  const {
    grid,
    rows,
    cols,
    start,
    goal,
    movementMode = '4-directional',
    recordSteps = false,
    maxSteps = 50000,
  } = options;

  const startTime = performance.now();
  let queueOperations = 0;

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

  const minHeap = new MinHeap<DijkstraNode>((a, b) => a.dist - b.dist);
  const openSetMap = new Map<string, DijkstraNode>();
  const closedSet = new Set<string>();
  const parentMap = new Map<string, GridCoord>();
  const distMap: Record<string, number> = {};

  const startKey = coordKey(start);
  const startNode: DijkstraNode = { coord: start, key: startKey, dist: 0 };
  minHeap.push(startNode);
  openSetMap.set(startKey, startNode);
  distMap[startKey] = 0;
  queueOperations++;

  const searchSteps: SearchStep[] = [];
  const exploredNodes: GridCoord[] = [];
  let found = false;
  let stepsCount = 0;

  const orthogonalDirections = [
    { dr: -1, dc: 0, cost: 1.0 },
    { dr: 1, dc: 0, cost: 1.0 },
    { dr: 0, dc: -1, cost: 1.0 },
    { dr: 0, dc: 1, cost: 1.0 },
  ];

  const diagonalDirections = [
    { dr: -1, dc: -1, cost: SQRT_2 },
    { dr: -1, dc: 1, cost: SQRT_2 },
    { dr: 1, dc: -1, cost: SQRT_2 },
    { dr: 1, dc: 1, cost: SQRT_2 },
  ];

  const directions =
    movementMode === '8-directional'
      ? [...orthogonalDirections, ...diagonalDirections]
      : orthogonalDirections;

  while (!minHeap.isEmpty() && stepsCount < maxSteps) {
    stepsCount++;
    const current = minHeap.pop()!;
    queueOperations++;
    openSetMap.delete(current.key);

    if (closedSet.has(current.key)) {
      continue;
    }

    closedSet.add(current.key);
    exploredNodes.push(current.coord);

    if (current.coord.r === goal.r && current.coord.c === goal.c) {
      found = true;
      break;
    }

    const neighborsChecked: GridCoord[] = [];

    for (const dir of directions) {
      const nr = current.coord.r + dir.dr;
      const nc = current.coord.c + dir.dc;

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (isTileBlocked(grid[nr][nc])) continue;

      if (dir.dr !== 0 && dir.dc !== 0) {
        const side1 = isTileBlocked(grid[current.coord.r + dir.dr][current.coord.c]);
        const side2 = isTileBlocked(grid[current.coord.r][current.coord.c + dir.dc]);
        if (side1 || side2) continue;
      }

      const neighborCoord: GridCoord = { r: nr, c: nc };
      const neighborKey = coordKey(neighborCoord);

      if (closedSet.has(neighborKey)) continue;

      neighborsChecked.push(neighborCoord);

      const terrainMultiplier = getTileMovementCost(grid[nr][nc]);
      const tentativeDist = current.dist + dir.cost * terrainMultiplier;
      const existingDist = distMap[neighborKey];

      if (existingDist === undefined || tentativeDist < existingDist) {
        distMap[neighborKey] = tentativeDist;
        parentMap.set(neighborKey, current.coord);

        const nextNode: DijkstraNode = {
          coord: neighborCoord,
          key: neighborKey,
          dist: tentativeDist,
        };
        minHeap.push(nextNode);
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
        g: current.dist,
        h: 0,
        f: current.dist,
      });
    }
  }

  const path: GridCoord[] = [];
  let totalCost = Infinity;

  if (found) {
    let curr: GridCoord | undefined = goal;
    while (curr) {
      path.unshift(curr);
      curr = parentMap.get(coordKey(curr));
    }
    totalCost = distMap[coordKey(goal)] ?? 0;
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
    gScores: distMap,
    hScores: {},
    fScores: distMap,
  };
}
