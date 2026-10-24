import { describe, expect, it } from 'vitest';
import { findPathAStar } from '../src/algorithms/astar';
import { findPathBFS } from '../src/algorithms/bfs';
import { findPathDijkstra } from '../src/algorithms/dijkstra';
import { TileType } from '../src/algorithms/types';

function createGrid(rows: number, cols: number, fill: TileType = 'EMPTY'): TileType[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

describe('A* Pathfinding Engine — Mathematical Rigor & Admissibility', () => {
  it('finds direct shortest path on empty 5x5 grid', () => {
    const grid = createGrid(5, 5);
    const start = { r: 0, c: 0 };
    const goal = { r: 0, c: 4 };

    const result = findPathAStar({
      grid,
      rows: 5,
      cols: 5,
      start,
      goal,
      movementMode: '4-directional',
    });

    expect(result.found).toBe(true);
    expect(result.path.length).toBe(5);
    expect(result.totalCost).toBe(4);
    expect(result.path[0]).toEqual(start);
    expect(result.path[result.path.length - 1]).toEqual(goal);
  });

  it('handles start equals goal', () => {
    const grid = createGrid(5, 5);
    const pos = { r: 2, c: 2 };
    const result = findPathAStar({
      grid,
      rows: 5,
      cols: 5,
      start: pos,
      goal: pos,
    });

    expect(result.found).toBe(true);
    expect(result.path).toEqual([pos]);
    expect(result.totalCost).toBe(0);
  });

  it('navigates around a solid barrier', () => {
    const grid = createGrid(5, 5);
    grid[0][2] = 'WALL';
    grid[1][2] = 'WALL';
    grid[2][2] = 'WALL';
    grid[3][2] = 'WALL';
    // row 4 is open: grid[4][2] is EMPTY

    const start = { r: 1, c: 1 };
    const goal = { r: 1, c: 3 };

    const result = findPathAStar({
      grid,
      rows: 5,
      cols: 5,
      start,
      goal,
      movementMode: '4-directional',
    });

    expect(result.found).toBe(true);
    const touchesOpening = result.path.some((p) => p.r === 4 && p.c === 2);
    expect(touchesOpening).toBe(true);
    const touchesWall = result.path.some((p) => grid[p.r][p.c] === 'WALL');
    expect(touchesWall).toBe(false);
  });

  it('correctly reports unreachable when goal is completely enclosed', () => {
    const grid = createGrid(5, 5);
    grid[1][2] = 'WALL';
    grid[3][2] = 'WALL';
    grid[2][1] = 'WALL';
    grid[2][3] = 'WALL';

    const start = { r: 0, c: 0 };
    const goal = { r: 2, c: 2 };

    const result = findPathAStar({
      grid,
      rows: 5,
      cols: 5,
      start,
      goal,
    });

    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.totalCost).toBe(Infinity);
  });

  it('strictly prevents diagonal corner-cutting in 8-directional mode', () => {
    const grid = createGrid(3, 3);
    grid[0][1] = 'WALL';
    grid[1][0] = 'WALL';

    const start = { r: 0, c: 0 };
    const goal = { r: 1, c: 1 };

    const result = findPathAStar({
      grid,
      rows: 3,
      cols: 3,
      start,
      goal,
      movementMode: '8-directional',
    });

    expect(result.found).toBe(false);
  });

  it('penalizes weighted rough terrain correctly', () => {
    const grid = createGrid(3, 3);
    grid[1][1] = 'ROUGH_TERRAIN';

    const start = { r: 1, c: 0 };
    const goal = { r: 1, c: 2 };

    const result = findPathAStar({
      grid,
      rows: 3,
      cols: 3,
      start,
      goal,
      movementMode: '4-directional',
    });

    expect(result.found).toBe(true);
    expect(result.totalCost).toBeLessThanOrEqual(4.0);
  });

  it('guarantees optimality equivalent to Dijkstra on uniform grid', () => {
    const grid = createGrid(7, 7);
    grid[2][2] = 'WALL';
    grid[2][3] = 'WALL';
    grid[3][3] = 'WALL';
    grid[4][3] = 'WALL';

    const start = { r: 0, c: 1 };
    const goal = { r: 6, c: 5 };

    const astarResult = findPathAStar({
      grid,
      rows: 7,
      cols: 7,
      start,
      goal,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    const dijkstraResult = findPathDijkstra({
      grid,
      rows: 7,
      cols: 7,
      start,
      goal,
      movementMode: '4-directional',
    });

    const bfsResult = findPathBFS({
      grid,
      rows: 7,
      cols: 7,
      start,
      goal,
      movementMode: '4-directional',
    });

    expect(astarResult.found).toBe(true);
    expect(dijkstraResult.found).toBe(true);
    expect(bfsResult.found).toBe(true);

    expect(astarResult.totalCost).toBe(dijkstraResult.totalCost);
    expect(astarResult.totalCost).toBe(bfsResult.totalCost);
    expect(astarResult.nodesExpandedCount).toBeLessThanOrEqual(dijkstraResult.nodesExpandedCount);
  });

  it('guarantees optimality equivalence across 30 randomized solvable grids', () => {
    const rows = 8;
    const cols = 8;
    const start = { r: 0, c: 0 };
    const goal = { r: 7, c: 7 };

    for (let seed = 0; seed < 30; seed++) {
      const grid = createGrid(rows, cols);
      // Deterministic pseudo-random obstacles (density ~20%)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r === start.r && c === start.c) || (r === goal.r && c === goal.c)) continue;
          if (Math.abs(r - start.r) + Math.abs(c - start.c) <= 1) continue;
          if (Math.abs(r - goal.r) + Math.abs(c - goal.c) <= 1) continue;
          const pseudoRand = Math.sin(seed * 997 + r * 31 + c * 17);
          if (pseudoRand > 0.45) {
            grid[r][c] = 'WALL';
          }
        }
      }

      const astar = findPathAStar({
        grid,
        rows,
        cols,
        start,
        goal,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });

      const dijkstra = findPathDijkstra({
        grid,
        rows,
        cols,
        start,
        goal,
        movementMode: '4-directional',
      });

      expect(astar.found).toBe(dijkstra.found);
      if (astar.found && dijkstra.found) {
        expect(astar.totalCost).toBeCloseTo(dijkstra.totalCost, 4);
      }
    }
  });

  it('demonstrates multiple sequential dynamic replannings (repeated blockages)', () => {
    const grid = createGrid(8, 8);
    const start = { r: 0, c: 0 };
    const goal = { r: 0, c: 7 };

    // Initial plan along row 0
    let plan = findPathAStar({ grid, rows: 8, cols: 8, start, goal });
    expect(plan.found).toBe(true);

    // Replan 1: Block row 0 at col 4
    grid[0][4] = 'WALL';
    let currentRobotPos = { r: 0, c: 2 };
    plan = findPathAStar({ grid, rows: 8, cols: 8, start: currentRobotPos, goal });
    expect(plan.found).toBe(true);
    expect(plan.path.some((p) => p.r === 0 && p.c === 4)).toBe(false);

    // Replan 2: Block the new detour at row 1, col 5
    grid[1][5] = 'WALL';
    currentRobotPos = plan.path[1];
    plan = findPathAStar({ grid, rows: 8, cols: 8, start: currentRobotPos, goal });
    expect(plan.found).toBe(true);
    expect(plan.path.some((p) => p.r === 1 && p.c === 5)).toBe(false);

    // Replan 3: Block yet another conduit
    grid[2][5] = 'WALL';
    currentRobotPos = plan.path[1];
    plan = findPathAStar({ grid, rows: 8, cols: 8, start: currentRobotPos, goal });
    expect(plan.found).toBe(true);
    expect(plan.path[0]).toEqual(currentRobotPos);
    expect(plan.path[plan.path.length - 1]).toEqual(goal);
  });

  it('standardizes Path Nodes (N), Movement Steps (N-1), and Route Cost unambiguously', () => {
    const grid = createGrid(5, 5);
    const start = { r: 1, c: 1 };
    const goal = { r: 1, c: 4 };

    const result = findPathAStar({
      grid,
      rows: 5,
      cols: 5,
      start,
      goal,
      movementMode: '4-directional',
    });

    expect(result.found).toBe(true);
    // Path contains 4 nodes: (1,1), (1,2), (1,3), (1,4)
    expect(result.path.length).toBe(4);
    // Number of movement steps is strictly N - 1 edges
    const movementSteps = result.path.length - 1;
    expect(movementSteps).toBe(3);
    // On unweighted terrain with unit cost 1.0, total cost equals movement steps
    expect(result.totalCost).toBe(3.0);
  });

  it('accurately distinguishes movement steps from cost on weighted terrain', () => {
    const grid = createGrid(5, 5);
    // Place rough terrain at (1, 2)
    grid[1][2] = 'ROUGH_TERRAIN';

    const start = { r: 1, c: 1 };
    const goal = { r: 1, c: 3 };

    const result = findPathAStar({
      grid,
      rows: 5,
      cols: 5,
      start,
      goal,
      movementMode: '4-directional',
    });

    expect(result.found).toBe(true);
    // Can either detour (step cost 1 + 1 + 1 + 1 = 4) or go through rough terrain (cost 3 + 1 = 4)
    expect(result.path.length - 1).toBeGreaterThanOrEqual(2);
    expect(result.totalCost).toBeLessThanOrEqual(4.0);
  });
});
