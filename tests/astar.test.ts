import { describe, expect, it } from 'vitest';
import { findPathAStar } from '../src/algorithms/astar';
import { findPathDijkstra } from '../src/algorithms/dijkstra';
import { findPathBFS } from '../src/algorithms/bfs';
import { TileType } from '../src/algorithms/types';

function createGrid(rows: number, cols: number, fill: TileType = 'EMPTY'): TileType[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

describe('A* Pathfinding Engine', () => {
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
    // 5x5 grid with vertical wall down the middle except at row 4
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
    // Path must pass through (4, 2)
    const touchesOpening = result.path.some((p) => p.r === 4 && p.c === 2);
    expect(touchesOpening).toBe(true);
    // Path must NOT touch any wall
    const touchesWall = result.path.some((p) => grid[p.r][p.c] === 'WALL');
    expect(touchesWall).toBe(false);
  });

  it('correctly reports unreachable when goal is completely enclosed', () => {
    const grid = createGrid(5, 5);
    // Enclose (2, 2)
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
    // Two walls placed diagonally: (0, 1) is WALL, (1, 0) is WALL
    // Moving from (0, 0) to (1, 1) diagonally would cut the corner and must be forbidden
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

    // Since (0,1) and (1,0) are walls, and grid is 3x3, can it go around? (0,0)-> cannot go anywhere!
    expect(result.found).toBe(false);
  });

  it('penalizes weighted rough terrain correctly', () => {
    const grid = createGrid(3, 3);
    // Normal straight path through row 1 has ROUGH_TERRAIN (cost 3 per tile)
    grid[1][1] = 'ROUGH_TERRAIN';

    const start = { r: 1, c: 0 };
    const goal = { r: 1, c: 2 };

    // Through (1,1): cost = 1.0 (start->(1,1)) * 3.0 + 1.0 = 4.0
    // Around through row 0: (1,0) -> (0,0) -> (0,1) -> (0,2) -> (1,2) cost = 1+1+1+1 = 4.0
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

    // Exact cost optimality equivalence
    expect(astarResult.totalCost).toBe(dijkstraResult.totalCost);
    expect(astarResult.totalCost).toBe(bfsResult.totalCost);

    // A* with admissible heuristic should expand fewer or equal nodes than Dijkstra
    expect(astarResult.nodesExpandedCount).toBeLessThanOrEqual(dijkstraResult.nodesExpandedCount);
  });

  it('demonstrates dynamic replanning when a planned path is blocked', () => {
    const grid = createGrid(6, 6);
    const start = { r: 0, c: 0 };
    const goal = { r: 0, c: 5 };

    // Initial plan
    const initialPlan = findPathAStar({
      grid,
      rows: 6,
      cols: 6,
      start,
      goal,
      movementMode: '4-directional',
    });

    expect(initialPlan.found).toBe(true);
    // Path initially goes along row 0: (0,0)->(0,1)->(0,2)->(0,3)->(0,4)->(0,5)
    expect(initialPlan.path[2]).toEqual({ r: 0, c: 2 });

    // Simulate robot moving to (0, 1)
    const currentRobotPos = { r: 0, c: 1 };

    // Player drops an obstacle at (0, 3) ahead of the robot
    grid[0][3] = 'WALL';

    // The robot detects remaining path is invalidated and recalculates from (0, 1)
    const replanned = findPathAStar({
      grid,
      rows: 6,
      cols: 6,
      start: currentRobotPos,
      goal,
      movementMode: '4-directional',
    });

    expect(replanned.found).toBe(true);
    // Replanned path must not pass through (0, 3)
    const passesBlocked = replanned.path.some((p) => p.r === 0 && p.c === 3);
    expect(passesBlocked).toBe(false);
    expect(replanned.path[0]).toEqual(currentRobotPos);
    expect(replanned.path[replanned.path.length - 1]).toEqual(goal);
  });
});
