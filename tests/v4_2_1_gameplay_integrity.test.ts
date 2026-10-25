import { describe, expect, it } from 'vitest';
import { findPathAStar, isTileBlocked, getTileMovementCost } from '../src/algorithms/astar';
import { GridCoord } from '../src/algorithms/types';
import { GridModel } from '../src/game/gridModel';
import { RobotController } from '../src/game/robotController';
import {
  canClearObstacles,
  canEditTile,
  canGenerateTopology,
  getGameMode,
  isTileDesignatedDebris,
} from '../src/game/editPermissions';
import { MISSIONS, MissionDefinition } from '../src/missions/missionData';

describe('PROJECT AEGIS V4.2.1 — P0 Auto-Hold Presentation Verification', () => {
  const presentationMission = MISSIONS.find((m) => m.id === 'mission-presentation')!;

  const setupPresentationSimulation = () => {
    const model = new GridModel(
      presentationMission.rows,
      presentationMission.cols,
      presentationMission.start,
      presentationMission.target
    );
    presentationMission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));

    const robot = new RobotController(presentationMission.start);
    robot.stepCostFn = (from, to) => {
      const isDiag = from.r !== to.r && from.c !== to.c;
      const tile = model.tiles[to.r][to.c];
      const weight = getTileMovementCost(tile);
      return isDiag ? weight * Math.SQRT2 : weight;
    };

    const initialPlan = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: presentationMission.start,
      goal: presentationMission.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    robot.setPath(initialPlan.path, initialPlan.totalCost);

    robot.onBlocked = () => {
      const currentValid = robot.logicalPos;
      const newPlan = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: currentValid,
        goal: model.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      if (newPlan.found) {
        robot.setPath(newPlan.path, newPlan.totalCost);
        robot.startMoving();
      }
    };

    return { model, robot, initialPlan };
  };

  it('Test A: Auto-Hold ON -> Deploy -> Hold at Step 2 -> Trigger Collapse -> Genuine Upper Bypass -> Rescue Complete', () => {
    const { model, robot, initialPlan } = setupPresentationSimulation();

    // Verify initial straight plan: 16 movement steps from (5, 2) to (5, 18), cost = 16.0
    expect(initialPlan.found).toBe(true);
    expect(initialPlan.path.length - 1).toBe(16);
    expect(initialPlan.totalCost).toBe(16.0);
    initialPlan.path.forEach((wp) => expect(wp.r).toBe(5));

    // 1. Deploy robot
    robot.startMoving();
    expect(robot.state).toBe('MOVING');

    // 2. Advance 2 steps to reach (5, 4)
    robot.update(0.35, 10); // Step 1: (5, 2) -> (5, 3)
    expect(robot.logicalPos).toEqual({ r: 5, c: 3 });
    expect(robot.stepsTaken).toBe(1);

    robot.update(0.35, 10); // Step 2: (5, 3) -> (5, 4)
    expect(robot.logicalPos).toEqual({ r: 5, c: 4 });
    expect(robot.stepsTaken).toBe(2);
    expect(robot.executedCost).toBe(2.0);

    // 3. Auto-Hold activates at (5, 4)
    robot.autoHoldAtCurrent();
    expect(robot.state).toBe('IDLE');
    expect(robot.statusMessage).toBe('AUTO-HOLD ACTIVE — READY FOR COLLAPSE');
    expect(robot.visualX).toBe(4);
    expect(robot.visualY).toBe(5);
    expect(robot.transitionProgress).toBe(0);

    // 4. Trigger structural collapse at preset coordinate (5, 10)
    const collapseCoord = presentationMission.demoBlockageCoord!;
    expect(collapseCoord).toEqual({ r: 5, c: 10 });
    model.setTile(collapseCoord.r, collapseCoord.c, 'WALL');
    expect(model.tiles[5][10]).toBe('WALL');

    // 5. checkPathBlocked runs while robot is in IDLE auto-hold state
    const blocked = robot.checkPathBlocked((r, c) => isTileBlocked(model.tiles[r][c]));
    expect(blocked).toBe(true);
    expect(robot.replansCount).toBe(1);
    expect(robot.state).toBe('MOVING');

    // 6. Verify replanned route waypoints from (5, 4) through upper bypass at row 3
    const newPath = robot.path;
    expect(newPath[0]).toEqual({ r: 5, c: 4 });
    // Upper bypass traverses row 3 via gaps at (4, 7) and (4, 14)
    expect(newPath.some((wp) => wp.r === 3)).toBe(true);
    // Remaining detour is 18 steps, cost = 18.0
    expect(robot.remainingCost).toBe(18.0);
    // Total mission cost = 2.0 (executed) + 18.0 (remaining) = 20.0
    expect(robot.executedCost + robot.remainingCost).toBe(20.0);

    // 7. Complete traversal along detour
    while (robot.state === 'MOVING') {
      robot.update(0.35, 10);
    }

    // 8. Verify final arrival metrics
    expect(robot.state).toBe('ARRIVED');
    expect(robot.logicalPos).toEqual(presentationMission.target);
    expect(robot.stepsTaken).toBe(20);
    expect(robot.executedCost).toBe(20.0);
    expect(robot.remainingCost).toBe(0);
    expect(robot.replansCount).toBe(1);
    expect(robot.getTelemetry().totalMissionCost).toBe(20.0);
  });

  it('Test B: Auto-Hold OFF -> Deploy -> Trigger Collapse inside valid window -> Genuine Detour', () => {
    const { model, robot } = setupPresentationSimulation();

    robot.startMoving();
    // Advance 3 steps while moving
    robot.update(0.35, 10); // step 1 (5, 3)
    robot.update(0.35, 10); // step 2 (5, 4)
    robot.update(0.35, 10); // step 3 (5, 5)
    expect(robot.stepsTaken).toBe(3);
    expect(robot.state).toBe('MOVING');

    // Trigger collapse mid-transit at (5, 10)
    model.setTile(5, 10, 'WALL');
    const blocked = robot.checkPathBlocked((r, c) => isTileBlocked(model.tiles[r][c]));
    expect(blocked).toBe(true);
    expect(robot.replansCount).toBe(1);

    // Complete transit
    while (robot.state === 'MOVING') {
      robot.update(0.35, 10);
    }

    expect(robot.state).toBe('ARRIVED');
    expect(robot.stepsTaken).toBe(20);
    expect(robot.executedCost).toBe(20.0);
    expect(robot.replansCount).toBe(1);
  });

  it('Test C: Trigger Collapse before Deploy -> Genuine initial route change', () => {
    const { model, robot } = setupPresentationSimulation();

    expect(robot.state).toBe('CONFIRMED');
    expect(robot.stepsTaken).toBe(0);

    // Place obstacle before deploy
    model.setTile(5, 10, 'WALL');
    const blocked = robot.checkPathBlocked((r, c) => isTileBlocked(model.tiles[r][c]));
    expect(blocked).toBe(true);
    expect(robot.replansCount).toBe(1);

    // Should plan detour directly from start (5, 2)
    expect(robot.path[0]).toEqual({ r: 5, c: 2 });
    expect(robot.path.length - 1).toBe(20);
    expect(robot.remainingCost).toBe(20.0);

    while (robot.state === 'MOVING') {
      robot.update(0.35, 10);
    }

    expect(robot.state).toBe('ARRIVED');
    expect(robot.stepsTaken).toBe(20);
    expect(robot.executedCost).toBe(20.0);
  });

  it('Test D: Reset after Auto-Hold -> Fresh simulation with correct state', () => {
    const { model, robot } = setupPresentationSimulation();

    robot.startMoving();
    robot.update(0.35, 10);
    robot.update(0.35, 10);
    robot.autoHoldAtCurrent();
    expect(robot.state).toBe('IDLE');
    expect(robot.stepsTaken).toBe(2);

    // Reset simulation
    robot.reset(presentationMission.start);
    expect(robot.state).toBe('IDLE');
    expect(robot.stepsTaken).toBe(0);
    expect(robot.executedCost).toBe(0);
    expect(robot.replansCount).toBe(0);
    expect(robot.logicalPos).toEqual(presentationMission.start);

    // Re-verify clean path from start
    const resetPlan = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: presentationMission.start,
      goal: presentationMission.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });
    robot.setPath(resetPlan.path, resetPlan.totalCost);
    expect(robot.state).toBe('CONFIRMED');
    expect(robot.remainingCost).toBe(16.0);
  });

  it('Test E: Repeated deployment and resets -> No stale path or replan state', () => {
    for (let iteration = 1; iteration <= 3; iteration++) {
      const { model, robot } = setupPresentationSimulation();

      robot.startMoving();
      robot.update(0.35, 10);
      robot.update(0.35, 10);
      robot.autoHoldAtCurrent();

      model.setTile(5, 10, 'WALL');
      robot.checkPathBlocked((r, c) => isTileBlocked(model.tiles[r][c]));

      while (robot.state === 'MOVING') {
        robot.update(0.35, 10);
      }

      expect(robot.state).toBe('ARRIVED');
      expect(robot.stepsTaken).toBe(20);
      expect(robot.replansCount).toBe(1);

      // Clean reset
      robot.reset(presentationMission.start);
      expect(robot.replansCount).toBe(0);
      expect(robot.stepsTaken).toBe(0);
      expect(robot.executedCost).toBe(0);
    }
  });
});

describe('PROJECT AEGIS V4.2.1 — P0 Authoritative Edit Permissions Matrix', () => {
  const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
  const challenge2 = MISSIONS.find((m) => m.id === 'mission-challenge-2')!;
  const sandboxMission: MissionDefinition = {
    id: 'mission-sandbox',
    title: 'Sandbox Protocol Lab',
    codename: 'LABORATORY',
    subtitle: 'Sandbox Mode',
    briefing: 'Sandbox testing deck',
    difficulty: 'CADET',
    rows: 15,
    cols: 25,
    start: { r: 2, c: 2 },
    target: { r: 12, c: 22 },
    initialWalls: [],
    targetStepsForStar3: 40,
    environmentTheme: 'training',
    badgeLabel: 'SANDBOX',
  };

  it('identifies game modes accurately', () => {
    expect(getGameMode(challenge1)).toBe('CHALLENGE');
    expect(getGameMode(challenge2)).toBe('CHALLENGE');
    expect(getGameMode(sandboxMission)).toBe('SANDBOX');
    const rescueMission = MISSIONS.find((m) => m.id === 'mission-1')!;
    expect(getGameMode(rescueMission)).toBe('RESCUE');
  });

  it('identifies designated debris vs ordinary walls', () => {
    expect(isTileDesignatedDebris({ r: 5, c: 8 }, challenge1)).toBe(true);
    expect(isTileDesignatedDebris({ r: 5, c: 12 }, challenge1)).toBe(true);
    expect(isTileDesignatedDebris({ r: 4, c: 4 }, challenge1)).toBe(false); // Structural wall
    expect(isTileDesignatedDebris({ r: 6, c: 7 }, challenge2)).toBe(true);
    expect(isTileDesignatedDebris({ r: 5, c: 7 }, challenge2)).toBe(false); // Structural wall above left bulkhead
  });

  it('allows demolition of designated debris with 2 charges and decrements charge', () => {
    const res = canEditTile({
      tool: 'demolish',
      coord: { r: 5, c: 8 },
      currentTile: 'DEBRIS',
      mission: challenge1,
      repairCharges: 2,
    });
    expect(res.allowed).toBe(true);
    expect(res.consumesCharge).toBe(true);
    expect(res.newTileType).toBe('EMPTY');
  });

  it('allows demolition of designated debris with 1 charge', () => {
    const res = canEditTile({
      tool: 'demolish',
      coord: { r: 5, c: 12 },
      currentTile: 'DEBRIS',
      mission: challenge1,
      repairCharges: 1,
    });
    expect(res.allowed).toBe(true);
    expect(res.consumesCharge).toBe(true);
    expect(res.newTileType).toBe('EMPTY');
  });

  it('blocks demolition of designated debris when charges are 0', () => {
    const res = canEditTile({
      tool: 'demolish',
      coord: { r: 5, c: 8 },
      currentTile: 'DEBRIS',
      mission: challenge1,
      repairCharges: 0,
    });
    expect(res.allowed).toBe(false);
    expect(res.consumesCharge).toBe(false);
    expect(res.reason).toBe('ZERO REPAIR CHARGES — CONSERVE CHARGES OR DETOUR');
  });

  it('BLOCKS demolition of ordinary walls with available charges in Deep Vault Quarantine', () => {
    // Specifically test the wall above the left gold bulkhead at (5, 7)
    const res = canEditTile({
      tool: 'demolish',
      coord: { r: 5, c: 7 },
      currentTile: 'WALL',
      mission: challenge2,
      repairCharges: 2,
    });
    expect(res.allowed).toBe(false);
    expect(res.consumesCharge).toBe(false);
    expect(res.reason).toBe('STRUCTURAL WALL — CANNOT BREACH');
  });

  it('BLOCKS demolition of ordinary walls with 0 charges', () => {
    const res = canEditTile({
      tool: 'demolish',
      coord: { r: 4, c: 4 },
      currentTile: 'WALL',
      mission: challenge1,
      repairCharges: 0,
    });
    expect(res.allowed).toBe(false);
    expect(res.consumesCharge).toBe(false);
    expect(res.reason).toBe('STRUCTURAL WALL — CANNOT BREACH');
  });

  it('BLOCKS demolition of already-cleared debris without consuming additional charge', () => {
    const res = canEditTile({
      tool: 'demolish',
      coord: { r: 5, c: 8 },
      currentTile: 'EMPTY',
      mission: challenge1,
      repairCharges: 1,
    });
    expect(res.allowed).toBe(false);
    expect(res.consumesCharge).toBe(false);
    expect(res.reason).toBe('DEBRIS ALREADY CLEARED');
  });

  it('BLOCKS demolition of start and goal positions', () => {
    const startRes = canEditTile({
      tool: 'demolish',
      coord: challenge1.start,
      currentTile: 'START',
      mission: challenge1,
      repairCharges: 2,
    });
    expect(startRes.allowed).toBe(false);
    expect(startRes.reason).toBe('CANNOT MODIFY MISSION OBJECTIVE MARKER');

    const goalRes = canEditTile({
      tool: 'demolish',
      coord: challenge1.target,
      currentTile: 'TARGET',
      mission: challenge1,
      repairCharges: 2,
    });
    expect(goalRes.allowed).toBe(false);
    expect(goalRes.reason).toBe('CANNOT MODIFY MISSION OBJECTIVE MARKER');
  });

  it('BLOCKS demolition of robot occupied cell', () => {
    const robotRes = canEditTile({
      tool: 'demolish',
      coord: { r: 5, c: 8 },
      currentTile: 'DEBRIS',
      mission: challenge1,
      repairCharges: 2,
      robotPos: { r: 5, c: 8 },
    });
    expect(robotRes.allowed).toBe(false);
    expect(robotRes.reason).toBe('ROBOT OCCUPYING TILE — ACTION BLOCKED');
  });

  it('BLOCKS Clear Obstacles exploit in Challenge Mode', () => {
    const clear1 = canClearObstacles(challenge1);
    expect(clear1.allowed).toBe(false);
    expect(clear1.reason).toBe('MISSION PROTECTED — CANNOT CLEAR GEOMETRY');

    const clear2 = canClearObstacles(challenge2);
    expect(clear2.allowed).toBe(false);
    expect(clear2.reason).toBe('MISSION PROTECTED — CANNOT CLEAR GEOMETRY');
  });

  it('ALLOWS Clear Obstacles in Sandbox Lab', () => {
    const clearSandbox = canClearObstacles(sandboxMission);
    expect(clearSandbox.allowed).toBe(true);
  });

  it('BLOCKS topology generators in Challenge Mode but ALLOWS in Sandbox', () => {
    expect(canGenerateTopology(challenge1).allowed).toBe(false);
    expect(canGenerateTopology(challenge2).allowed).toBe(false);
    expect(canGenerateTopology(sandboxMission).allowed).toBe(true);
  });

  it('BLOCKS eraser in Challenge Mode but ALLOWS in Sandbox', () => {
    const eraserChallenge = canEditTile({
      tool: 'eraser',
      coord: { r: 4, c: 4 },
      currentTile: 'WALL',
      mission: challenge1,
      repairCharges: 2,
    });
    expect(eraserChallenge.allowed).toBe(false);
    expect(eraserChallenge.reason).toBe('ERASER UNAVAILABLE IN CHALLENGE MODE');

    const eraserSandbox = canEditTile({
      tool: 'eraser',
      coord: { r: 4, c: 4 },
      currentTile: 'WALL',
      mission: sandboxMission,
      repairCharges: 0,
    });
    expect(eraserSandbox.allowed).toBe(true);
    expect(eraserSandbox.newTileType).toBe('EMPTY');
  });
});

describe('PROJECT AEGIS V4.2.1 — P1 Challenge Briefing Accuracy & Route Verification', () => {
  it('untouched Corridor Control produces genuine 24-step detour (cost 24.0)', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    const model = new GridModel(challenge1.rows, challenge1.cols, challenge1.start, challenge1.target);
    challenge1.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    challenge1.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    challenge1.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

    const res = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: challenge1.start,
      goal: challenge1.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    expect(res.found).toBe(true);
    expect(res.path.length - 1).toBe(24);
    expect(res.totalCost).toBe(24.0);

    // Briefing text must mention 24-step northern detour and 16 steps direct corridor
    expect(challenge1.briefing).toContain('24-step northern detour');
    expect(challenge1.briefing).toContain('16 steps, cost 16');
  });

  it('breached Corridor Control produces genuine 16-step direct corridor (cost 16.0)', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    const model = new GridModel(challenge1.rows, challenge1.cols, challenge1.start, challenge1.target);
    challenge1.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    challenge1.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    challenge1.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

    // Breach both debris
    model.setTile(5, 8, 'EMPTY');
    model.setTile(5, 12, 'EMPTY');

    const res = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: challenge1.start,
      goal: challenge1.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    expect(res.found).toBe(true);
    expect(res.path.length - 1).toBe(16);
    expect(res.totalCost).toBe(16.0);
    res.path.forEach((wp) => expect(wp.r).toBe(5));
  });

  it('Deep Vault Quarantine untouched produces 28 steps vs 26 steps when breached', () => {
    const challenge2 = MISSIONS.find((m) => m.id === 'mission-challenge-2')!;
    const model = new GridModel(challenge2.rows, challenge2.cols, challenge2.start, challenge2.target);
    challenge2.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    challenge2.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    challenge2.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

    // Untouched
    const untouchedRes = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: challenge2.start,
      goal: challenge2.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });
    expect(untouchedRes.found).toBe(true);
    expect(untouchedRes.path.length - 1).toBe(28);

    // Breached
    model.setTile(6, 7, 'EMPTY');
    model.setTile(6, 15, 'EMPTY');
    const breachedRes = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: challenge2.start,
      goal: challenge2.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });
    expect(breachedRes.found).toBe(true);
    expect(breachedRes.path.length - 1).toBe(26);
  });

  it('accurately distinguishes empty non-debris terrain from already-cleared debris', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    // (5, 8) is designated debris
    const clearedDebrisRes = canEditTile({
      tool: 'demolish',
      coord: { r: 5, c: 8 },
      currentTile: 'EMPTY',
      mission: challenge1,
      repairCharges: 1,
    });
    expect(clearedDebrisRes.allowed).toBe(false);
    expect(clearedDebrisRes.reason).toBe('DEBRIS ALREADY CLEARED');

    // (5, 3) is empty floor that was never debris
    const clearFloorRes = canEditTile({
      tool: 'demolish',
      coord: { r: 5, c: 3 },
      currentTile: 'EMPTY',
      mission: challenge1,
      repairCharges: 1,
    });
    expect(clearFloorRes.allowed).toBe(false);
    expect(clearFloorRes.reason).toBe('CLEAR TERRAIN — NO DEBRIS');
  });

  it('BLOCKS demolition of rough terrain in Challenge Mode', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    const roughRes = canEditTile({
      tool: 'demolish',
      coord: { r: 2, c: 8 },
      currentTile: 'ROUGH_TERRAIN',
      mission: challenge1,
      repairCharges: 2,
    });
    expect(roughRes.allowed).toBe(false);
    expect(roughRes.reason).toBe('ROUGH TERRAIN — CANNOT DEMOLISH');
  });

  it('BLOCKS non-demolish tools in Challenge Mode even when targeting debris', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    const wallOnDebris = canEditTile({
      tool: 'wall',
      coord: { r: 5, c: 8 },
      currentTile: 'DEBRIS',
      mission: challenge1,
      repairCharges: 2,
    });
    expect(wallOnDebris.allowed).toBe(false);
    expect(wallOnDebris.consumesCharge).toBe(false);
    expect(wallOnDebris.reason).toBe('TERRAIN EDITING UNAVAILABLE IN CHALLENGE MODE');

    const eraserOnDebris = canEditTile({
      tool: 'eraser',
      coord: { r: 5, c: 8 },
      currentTile: 'DEBRIS',
      mission: challenge1,
      repairCharges: 2,
    });
    expect(eraserOnDebris.allowed).toBe(false);
    expect(eraserOnDebris.consumesCharge).toBe(false);
    expect(eraserOnDebris.reason).toBe('ERASER UNAVAILABLE IN CHALLENGE MODE');
  });

  it('guarantees repair charges decrement strictly 2 -> 1 -> 0 under simulated rapid clicks and never become negative', () => {
    const challenge1 = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
    let currentCharges = 2;
    const model = new GridModel(challenge1.rows, challenge1.cols, challenge1.start, challenge1.target);
    challenge1.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

    const clickTargets = [
      { r: 5, c: 8 }, // Debris 1
      { r: 5, c: 8 }, // Rapid re-click on Debris 1
      { r: 5, c: 12 }, // Debris 2
      { r: 5, c: 12 }, // Rapid re-click on Debris 2
      { r: 4, c: 4 },  // Wall
      { r: 5, c: 8 },  // Re-click Debris 1
    ];

    for (const target of clickTargets) {
      const tile = model.tiles[target.r][target.c];
      const perm = canEditTile({
        tool: 'demolish',
        coord: target,
        currentTile: tile,
        mission: challenge1,
        repairCharges: currentCharges,
      });

      if (perm.allowed && perm.consumesCharge) {
        model.setTile(target.r, target.c, 'EMPTY');
        currentCharges = Math.max(0, currentCharges - 1);
      }
      expect(currentCharges).toBeGreaterThanOrEqual(0);
    }

    expect(currentCharges).toBe(0);
    expect(model.tiles[5][8]).toBe('EMPTY');
    expect(model.tiles[5][12]).toBe('EMPTY');
  });
});
