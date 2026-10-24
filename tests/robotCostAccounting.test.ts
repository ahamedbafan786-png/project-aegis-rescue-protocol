import { describe, expect, it } from 'vitest';
import { findPathAStar, getTileMovementCost } from '../src/algorithms/astar';
import { GridCoord, TileType } from '../src/algorithms/types';
import { RobotController } from '../src/game/robotController';

describe('RobotController Cost Accounting & Dynamic Replanning Telemetry', () => {
  it('correctly tracks executed cost and remaining cost over uniform terrain', () => {
    const robot = new RobotController({ r: 0, c: 0 });
    const path: GridCoord[] = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: 2 },
      { r: 0, c: 3 },
      { r: 0, c: 4 },
    ];
    // 4 steps, cost = 4.0
    robot.setPath(path, 4.0);

    let tel = robot.getTelemetry();
    expect(tel.totalStepsTaken).toBe(0);
    expect(tel.executedCost).toBe(0);
    expect(tel.remainingCost).toBe(4.0);
    expect(tel.totalMissionCost).toBe(4.0);
    expect(tel.remainingSteps).toBe(4);

    robot.startMoving();

    // Step 1: Advance by 1 step (speed 3.5, deltaSec = 0.3 -> transitionProgress > 1.0)
    robot.update(0.3, 1.0);
    tel = robot.getTelemetry();
    expect(tel.totalStepsTaken).toBe(1);
    expect(tel.executedCost).toBe(1.0);
    expect(tel.remainingCost).toBe(3.0);
    expect(tel.totalMissionCost).toBe(4.0);
    expect(tel.remainingSteps).toBe(3);

    // Step 2: Advance another step
    robot.update(0.3, 1.0);
    tel = robot.getTelemetry();
    expect(tel.totalStepsTaken).toBe(2);
    expect(tel.executedCost).toBe(2.0);
    expect(tel.remainingCost).toBe(2.0);
    expect(tel.totalMissionCost).toBe(4.0);
    expect(tel.remainingSteps).toBe(2);
  });

  it('preserves executed traversal cost upon mid-transit dynamic replanning', () => {
    const robot = new RobotController({ r: 0, c: 0 });
    const initialPath: GridCoord[] = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: 2 },
      { r: 0, c: 3 },
      { r: 0, c: 4 },
    ];
    robot.setPath(initialPath, 4.0);
    robot.startMoving();

    // Robot executes 2 steps to (0, 2)
    robot.update(0.3, 1.0);
    robot.update(0.3, 1.0);

    let tel = robot.getTelemetry();
    expect(tel.totalStepsTaken).toBe(2);
    expect(tel.executedCost).toBe(2.0);

    // Mid-transit blockage occurs ahead at (0, 3)!
    // A* calculates a detour around row 1: (0, 2) -> (1, 2) -> (1, 3) -> (1, 4) -> (0, 4)
    // Detour length = 4 steps, cost = 4.0
    const detourPath: GridCoord[] = [
      { r: 0, c: 2 },
      { r: 1, c: 2 },
      { r: 1, c: 3 },
      { r: 1, c: 4 },
      { r: 0, c: 4 },
    ];
    robot.replansCount++;
    robot.setPath(detourPath, 4.0);
    robot.startMoving();

    // CRITICAL BUG VERIFICATION: executedCost must NOT be reset to 0!
    tel = robot.getTelemetry();
    expect(tel.totalStepsTaken).toBe(2);
    expect(tel.executedCost).toBe(2.0);
    expect(tel.remainingCost).toBe(4.0);
    expect(tel.totalMissionCost).toBe(6.0); // 2 executed + 4 remaining detour = 6 total!
    expect(tel.replansCount).toBe(1);

    // Execute remaining 4 steps to arrival
    for (let i = 0; i < 4; i++) {
      robot.update(0.3, 1.0);
    }

    tel = robot.getTelemetry();
    expect(tel.state).toBe('ARRIVED');
    expect(tel.totalStepsTaken).toBe(6);
    expect(tel.executedCost).toBe(6.0);
    expect(tel.remainingCost).toBe(0);
    expect(tel.totalMissionCost).toBe(6.0);
  });

  it('correctly calculates weighted terrain cost accumulation with custom stepCostFn', () => {
    const grid: TileType[][] = [
      ['START', 'ROUGH_TERRAIN', 'EMPTY', 'TARGET'],
    ];

    const robot = new RobotController({ r: 0, c: 0 });
    robot.stepCostFn = (from, to) => {
      const tile = grid[to.r][to.c];
      return getTileMovementCost(tile); // ROUGH_TERRAIN = 3.0, EMPTY/TARGET = 1.0
    };

    const path: GridCoord[] = [
      { r: 0, c: 0 },
      { r: 0, c: 1 }, // ROUGH_TERRAIN (cost +3.0)
      { r: 0, c: 2 }, // EMPTY (cost +1.0)
      { r: 0, c: 3 }, // TARGET (cost +1.0)
    ];
    // Total cost = 3 + 1 + 1 = 5.0 across 3 movement steps
    robot.setPath(path, 5.0);
    robot.startMoving();

    // Step 1: Enters ROUGH_TERRAIN
    robot.update(0.3, 1.0);
    let tel = robot.getTelemetry();
    expect(tel.totalStepsTaken).toBe(1);
    expect(tel.executedCost).toBe(3.0);
    expect(tel.remainingCost).toBe(2.0);
    expect(tel.totalMissionCost).toBe(5.0);

    // Step 2: Enters EMPTY
    robot.update(0.3, 1.0);
    tel = robot.getTelemetry();
    expect(tel.totalStepsTaken).toBe(2);
    expect(tel.executedCost).toBe(4.0);
    expect(tel.remainingCost).toBe(1.0);

    // Step 3: Enters TARGET
    robot.update(0.3, 1.0);
    tel = robot.getTelemetry();
    expect(tel.state).toBe('ARRIVED');
    expect(tel.totalStepsTaken).toBe(3);
    expect(tel.executedCost).toBe(5.0);
    expect(tel.remainingCost).toBe(0);
    expect(tel.totalMissionCost).toBe(5.0);
  });

  it('resets all state, counters, and telemetry cleanly on robot.reset()', () => {
    const robot = new RobotController({ r: 0, c: 0 });
    const path: GridCoord[] = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: 2 },
    ];
    robot.setPath(path, 2.0);
    robot.startMoving();
    robot.update(0.3, 1.0);
    robot.replansCount = 3;

    // Reset back to start
    robot.reset({ r: 0, c: 0 });

    const tel = robot.getTelemetry();
    expect(tel.totalStepsTaken).toBe(0);
    expect(tel.executedCost).toBe(0);
    expect(tel.remainingCost).toBe(0);
    expect(tel.totalMissionCost).toBe(0);
    expect(tel.replansCount).toBe(0);
    expect(tel.state).toBe('IDLE');
    expect(tel.currentLogicalCoord).toEqual({ r: 0, c: 0 });
  });

  it('computes deterministic presentation detour through row 3 bypass openings', () => {
    // Replicate presentation mission grid: rows=11, cols=21, start=(5,2), target=(5,18)
    const rows = 11;
    const cols = 21;
    const grid: TileType[][] = Array.from({ length: rows }, () => Array(cols).fill('EMPTY'));

    // Divider wall row 4 with bypass at col 7 and col 14
    [4, 5, 6, 8, 9, 10, 11, 12, 13, 15].forEach((c) => {
      grid[4][c] = 'WALL';
    });
    // Divider wall row 6
    [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].forEach((c) => {
      grid[6][c] = 'WALL';
    });

    // Robot is at (5, 6) when blockage at (5, 10) occurs
    grid[5][10] = 'WALL';

    const res = findPathAStar({
      grid,
      rows,
      cols,
      start: { r: 5, c: 6 },
      goal: { r: 5, c: 18 },
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    expect(res.found).toBe(true);
    // Path must pass through col 7 bypass: (5, 6) -> (5, 7) -> (4, 7) -> (3, 7)
    expect(res.path.some((p) => p.r === 4 && p.c === 7)).toBe(true);
    // Path must use upper corridor row 3
    expect(res.path.some((p) => p.r === 3 && p.c === 10)).toBe(true);
    // Path must descend through col 14 bypass: (3, 14) -> (4, 14) -> (5, 14)
    expect(res.path.some((p) => p.r === 4 && p.c === 14)).toBe(true);
    // Path successfully reaches target (5, 18)
    expect(res.path[res.path.length - 1]).toEqual({ r: 5, c: 18 });
  });
});
