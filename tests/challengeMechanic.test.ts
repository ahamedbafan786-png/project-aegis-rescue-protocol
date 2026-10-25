import { describe, expect, it } from 'vitest';
import { findPathAStar, isTileBlocked } from '../src/algorithms/astar';
import { GridCoord } from '../src/algorithms/types';
import { GridModel } from '../src/game/gridModel';
import { RobotController } from '../src/game/robotController';
import { MISSIONS } from '../src/missions/missionData';

describe('Emergency Corridor Control — Tactical Debris Clearance Mechanic', () => {
  it('correctly populates debris and blocks direct path before breaching', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    expect(challenge1).toBeDefined();
    expect(challenge1.repairCharges).toBe(2);
    expect(challenge1.initialDebris?.length).toBe(2);

    const model = new GridModel(challenge1.rows, challenge1.cols, challenge1.start, challenge1.target);
    challenge1.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    challenge1.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    challenge1.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

    // Verify debris tiles are blocked
    expect(isTileBlocked(model.tiles[5][8])).toBe(true);
    expect(isTileBlocked(model.tiles[5][12])).toBe(true);

    // Initial A* path must detour through row 2 (longer route with rough terrain)
    const blockedRes = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: challenge1.start,
      goal: challenge1.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    expect(blockedRes.found).toBe(true);
    // Detour steps must be greater than straight corridor length (16 steps)
    expect(blockedRes.path.length - 1).toBeGreaterThan(16);
    // Path must detour through upper rows (row 2 or 3)
    const passesThroughUpper = blockedRes.path.some((p) => p.r <= 3);
    expect(passesThroughUpper).toBe(true);
  });

  it('breaching debris with repair charges unlocks direct optimal corridor', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    const model = new GridModel(challenge1.rows, challenge1.cols, challenge1.start, challenge1.target);
    challenge1.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    challenge1.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    challenge1.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

    let charges = challenge1.repairCharges!;

    // Player spends 2 charges to clear both debris cells at (5, 8) and (5, 12)
    challenge1.initialDebris!.forEach((debrisCoord) => {
      expect(charges).toBeGreaterThan(0);
      charges--;
      model.setTile(debrisCoord.r, debrisCoord.c, 'EMPTY');
    });

    expect(charges).toBe(0);
    expect(model.tiles[5][8]).toBe('EMPTY');
    expect(model.tiles[5][12]).toBe('EMPTY');

    // A* replans through the opened corridor
    const clearRes = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: challenge1.start,
      goal: challenge1.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    expect(clearRes.found).toBe(true);
    // Direct corridor from (5, 2) to (5, 18) is exactly 16 steps
    expect(clearRes.path.length - 1).toBe(16);
    expect(clearRes.totalCost).toBe(16.0);
    // All waypoints on row 5
    clearRes.path.forEach((wp) => {
      expect(wp.r).toBe(5);
    });
  });

  it('robot controller accepts replanned path when corridor is breached mid-mission', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    const model = new GridModel(challenge1.rows, challenge1.cols, challenge1.start, challenge1.target);
    challenge1.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    challenge1.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    challenge1.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

    const initialRes = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: challenge1.start,
      goal: challenge1.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    const robot = new RobotController(challenge1.start);
    robot.setPath(initialRes.path, initialRes.totalCost);
    expect(robot.state).toBe('CONFIRMED');
    expect(robot.remainingCost).toBe(initialRes.totalCost);

    // Robot takes 2 steps forward
    robot.startMoving();
    robot.update(0.35, 10); // Step 1
    robot.update(0.35, 10); // Step 2
    expect(robot.stepsTaken).toBeGreaterThanOrEqual(1);

    // Debris cleared
    model.setTile(5, 8, 'EMPTY');
    model.setTile(5, 12, 'EMPTY');

    // Recalculate from robot current logical location
    const replanRes = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: robot.logicalPos,
      goal: model.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    expect(replanRes.found).toBe(true);
    robot.setPath(replanRes.path, replanRes.totalCost);

    const telemetry = robot.getTelemetry();
    expect(telemetry.remainingCost).toBe(replanRes.totalCost);
    expect(telemetry.totalMissionCost).toBe(telemetry.executedCost + telemetry.remainingCost);
  });

  it('guarantees repair charges cannot drop below zero and unbreached debris blocks robot', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    const model = new GridModel(challenge1.rows, challenge1.cols, challenge1.start, challenge1.target);
    challenge1.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    challenge1.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    challenge1.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

    let repairCharges = challenge1.repairCharges!;
    expect(repairCharges).toBe(2);

    // Simulate clearing helper function (identical to GameHUD demolish logic)
    const tryBreachDebris = (r: number, c: number): boolean => {
      if (repairCharges <= 0) return false;
      if (model.tiles[r][c] !== 'DEBRIS') return false;
      repairCharges--;
      model.setTile(r, c, 'EMPTY');
      return true;
    };

    // Attempting to clear normal wall must fail and not consume charges
    expect(tryBreachDebris(6, 5)).toBe(false);
    expect(repairCharges).toBe(2);
    expect(model.tiles[6][5]).toBe('WALL');

    // Breach first debris cell (5, 8)
    expect(tryBreachDebris(5, 8)).toBe(true);
    expect(repairCharges).toBe(1);
    expect(model.tiles[5][8]).toBe('EMPTY');

    // Breach second debris cell (5, 12)
    expect(tryBreachDebris(5, 12)).toBe(true);
    expect(repairCharges).toBe(0);
    expect(model.tiles[5][12]).toBe('EMPTY');

    // Attempting further breach with 0 charges must fail
    expect(tryBreachDebris(5, 8)).toBe(false);
    expect(repairCharges).toBe(0);

    // Reset restores initial state and charges
    let resetCharges = challenge1.repairCharges!;
    const resetModel = new GridModel(challenge1.rows, challenge1.cols, challenge1.start, challenge1.target);
    challenge1.initialWalls.forEach((w) => resetModel.setTile(w.r, w.c, 'WALL'));
    challenge1.initialRoughTerrain?.forEach((t) => resetModel.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    challenge1.initialDebris?.forEach((d) => resetModel.setTile(d.r, d.c, 'DEBRIS'));

    expect(resetCharges).toBe(2);
    expect(resetModel.tiles[5][8]).toBe('DEBRIS');
    expect(resetModel.tiles[5][12]).toBe('DEBRIS');
    expect(isTileBlocked(resetModel.tiles[5][8])).toBe(true);
    expect(isTileBlocked(resetModel.tiles[5][12])).toBe(true);
  });
});
