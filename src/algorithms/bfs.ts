import {
  coordKey,
  getTileMovementCost,
  isTileBlocked,
  parseKey,
} from './astar';
import {
  GridCoord,
  MovementMode,
  PathResult,
  SearchStep,
  TileType,
} from './types';

export interface BFSOptions {
  grid: TileType[][];
  rows: number;
  cols: number;
  start: GridCoord;
  goal: GridCoord;
  movementMode?: MovementMode;
  recordSteps?: boolean;
  maxSteps?: number;
}

export function findPathBFS(options: BFSOptions): PathResult {
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
      hScores: {},
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

  const queue: GridCoord[] = [start];
  const visited = new Set<string>([coordKey(start)]);
  const parentMap = new Map<string, GridCoord>();
  const hopMap: Record<string, number> = { [coordKey(start)]: 0 };
  queueOperations++;

  const searchSteps: SearchStep[] = [];
  const exploredNodes: GridCoord[] = [];
  let found = false;
  let stepsCount = 0;

  const orthogonalDirections = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  const diagonalDirections = [
    { dr: -1, dc: -1 },
    { dr: -1, dc: 1 },
    { dr: 1, dc: -1 },
    { dr: 1, dc: 1 },
  ];

  const directions =
    movementMode === '8-directional'
      ? [...orthogonalDirections, ...diagonalDirections]
      : orthogonalDirections;

  while (queue.length > 0 && stepsCount < maxSteps) {
    stepsCount++;
    const current = queue.shift()!;
    queueOperations++;
    exploredNodes.push(current);

    if (current.r === goal.r && current.c === goal.c) {
      found = true;
      break;
    }

    const neighborsChecked: GridCoord[] = [];

    for (const dir of directions) {
      const nr = current.r + dir.dr;
      const nc = current.c + dir.dc;

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (isTileBlocked(grid[nr][nc])) continue;

      if (dir.dr !== 0 && dir.dc !== 0) {
        const side1 = isTileBlocked(grid[current.r + dir.dr][current.c]);
        const side2 = isTileBlocked(grid[current.r][current.c + dir.dc]);
        if (side1 || side2) continue;
      }

      const neighbor: GridCoord = { r: nr, c: nc };
      const nKey = coordKey(neighbor);

      if (!visited.has(nKey)) {
        visited.add(nKey);
        parentMap.set(nKey, current);
        hopMap[nKey] = (hopMap[coordKey(current)] ?? 0) + 1;
        queue.push(neighbor);
        queueOperations++;
        neighborsChecked.push(neighbor);
      }
    }

    if (recordSteps) {
      searchSteps.push({
        currentNode: current,
        openSetCoords: [...queue],
        closedSetCoords: Array.from(visited).map(parseKey),
        neighborsChecked,
        g: hopMap[coordKey(current)] ?? 0,
        h: 0,
        f: hopMap[coordKey(current)] ?? 0,
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
    // Evaluate the true traversal route cost using the active movement-cost model.
    // BFS minimizes unweighted hops (FIFO), but its returned totalCost must reflect
    // the actual traversal cost of the discovered route across weighted terrain.
    totalCost = 0;
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to = path[i];
      const isDiag = from.r !== to.r && from.c !== to.c;
      const baseCost = getTileMovementCost(grid[to.r][to.c]);
      totalCost += isDiag ? baseCost * Math.SQRT2 : baseCost;
    }
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
    gScores: hopMap,
    hScores: {},
    fScores: hopMap,
  };
}
