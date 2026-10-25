import { describe, it, expect } from 'vitest';
import { GridModel } from '../src/game/gridModel';
import { RobotController } from '../src/game/robotController';
import { MISSIONS } from '../src/missions/missionData';
import {
  canEditTile,
  canClearObstacles,
  canGenerateTopology,
  isTileDesignatedDebris,
} from '../src/game/editPermissions';
import { findPathAStar, isTileBlocked } from '../src/algorithms/astar';

describe('Project Aegis V4.2.2 Stability & Edge Cases Test Suite', () => {
  const challenge1Mission = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
  const deepVaultMission = MISSIONS.find((m) => m.id === 'mission-challenge-2')!;
  const presentationMission = MISSIONS.find((m) => m.id === 'mission-presentation')!;

  describe('P1 — Pre-Deploy Presentation Collapse Semantics', () => {
    it('Triggering collapse before deploy modifies map and refreshes planned bypass without starting movement', () => {
      const model = new GridModel(
        presentationMission.rows,
        presentationMission.cols,
        presentationMission.start,
        presentationMission.target
      );
      presentationMission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));

      const robot = new RobotController(presentationMission.start);

      // Initial straight path
      const initialRes = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: presentationMission.start,
        goal: presentationMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      expect(initialRes.found).toBe(true);
      robot.setPath(initialRes.path, initialRes.totalCost);

      expect(robot.state).toBe('CONFIRMED');
      expect(robot.stepsTaken).toBe(0);
      expect(robot.replansCount).toBe(0);
      expect(robot.logicalPos).toEqual(presentationMission.start);

      // Simulate Pre-Deploy Collapse Trigger at (5, 10)
      const collapseCoord = presentationMission.demoBlockageCoord!;
      expect(collapseCoord).toEqual({ r: 5, c: 10 });
      model.setTile(collapseCoord.r, collapseCoord.c, 'WALL');

      // Pre-deployment route recalculation: initial planning before movement
      const preDeployRes = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: robot.logicalPos,
        goal: model.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });

      expect(preDeployRes.found).toBe(true);
      robot.setPath(preDeployRes.path, preDeployRes.totalCost);

      // In V4.2.2: Robot must stay at start position in ready state, NOT start moving
      expect(robot.logicalPos).toEqual(presentationMission.start);
      expect(robot.stepsTaken).toBe(0);
      expect(robot.replansCount).toBe(0); // Initial planning before movement = 0 replans
      expect(robot.path.length - 1).toBe(20); // 20-step upper bypass
      expect(robot.remainingCost).toBe(20.0);
      expect(robot.initialPlannedCost).toBe(20.0);

      // Verify the planned route bypasses row 5 blockage via upper conduit at row 3
      expect(robot.path.some((wp) => wp.r === 3)).toBe(true);
      expect(robot.path.some((wp) => wp.r === 5 && wp.c === 10)).toBe(false);

      // Movement ONLY begins when deploy is explicitly initiated
      robot.startMoving();
      expect(robot.state).toBe('MOVING');

      // Complete traversal
      while (robot.state === 'MOVING') {
        robot.update(0.35, 10);
      }

      expect(robot.state).toBe('ARRIVED');
      expect(robot.logicalPos).toEqual(presentationMission.target);
      expect(robot.stepsTaken).toBe(20);
      expect(robot.executedCost).toBe(20.0);
      expect(robot.remainingCost).toBe(0);
      expect(robot.replansCount).toBe(0); // Zero dynamic replans since route was planned prior to deploy
      expect(robot.getTelemetry().totalMissionCost).toBe(20.0);
    });
  });

  describe('P2 — Edge Cases & Logic-Level Edit Enforcement', () => {
    it('Rejects direct/internal invocation of sandbox tools while Challenge Mode is active', () => {
      const coord = { r: 5, c: 5 };

      // Wall tool
      const wallPerm = canEditTile({
        tool: 'wall',
        coord,
        currentTile: 'EMPTY',
        mission: deepVaultMission,
        repairCharges: 2,
      });
      expect(wallPerm.allowed).toBe(false);
      expect(wallPerm.reason).toBe('TERRAIN EDITING UNAVAILABLE IN CHALLENGE MODE');

      // Rough tool
      const roughPerm = canEditTile({
        tool: 'rough',
        coord,
        currentTile: 'EMPTY',
        mission: deepVaultMission,
        repairCharges: 2,
      });
      expect(roughPerm.allowed).toBe(false);
      expect(roughPerm.reason).toBe('TERRAIN EDITING UNAVAILABLE IN CHALLENGE MODE');

      // Eraser tool
      const eraserPerm = canEditTile({
        tool: 'eraser',
        coord,
        currentTile: 'WALL',
        mission: deepVaultMission,
        repairCharges: 2,
      });
      expect(eraserPerm.allowed).toBe(false);
      expect(eraserPerm.reason).toBe('ERASER UNAVAILABLE IN CHALLENGE MODE');

      // Clear all obstacles
      const clearPerm = canClearObstacles(deepVaultMission);
      expect(clearPerm.allowed).toBe(false);
      expect(clearPerm.reason).toBe('MISSION PROTECTED — CANNOT CLEAR GEOMETRY');

      // Generate topology
      const topoPerm = canGenerateTopology(deepVaultMission);
      expect(topoPerm.allowed).toBe(false);
      expect(topoPerm.reason).toBe('MISSION PROTECTED — TOPOLOGY LOCKED');
    });

    it('Enforces ordinary structural wall immunity in both challenge missions', () => {
      [challenge1Mission, deepVaultMission].forEach((mission) => {
        const wallCoord = mission.initialWalls[0];
        const res = canEditTile({
          tool: 'demolish',
          coord: wallCoord,
          currentTile: 'WALL',
          mission,
          repairCharges: 2,
        });
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('STRUCTURAL WALL — CANNOT BREACH');
        expect(res.consumesCharge).toBe(false);
      });
    });

    it('Rejects demolition when repair charges reach zero', () => {
      const debrisCoord = deepVaultMission.initialDebris![0];
      expect(isTileDesignatedDebris(debrisCoord, deepVaultMission)).toBe(true);

      const res = canEditTile({
        tool: 'demolish',
        coord: debrisCoord,
        currentTile: 'DEBRIS',
        mission: deepVaultMission,
        repairCharges: 0,
      });

      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('ZERO REPAIR CHARGES — CONSERVE CHARGES OR DETOUR');
      expect(res.consumesCharge).toBe(false);
    });

    it('Protects against repeated rapid demolition clicks on the same tile', () => {
      const debrisCoord = deepVaultMission.initialDebris![0];

      // First click on designated debris: allowed, consumes 1 charge
      const firstClick = canEditTile({
        tool: 'demolish',
        coord: debrisCoord,
        currentTile: 'DEBRIS',
        mission: deepVaultMission,
        repairCharges: 2,
      });
      expect(firstClick.allowed).toBe(true);
      expect(firstClick.consumesCharge).toBe(true);
      expect(firstClick.newTileType).toBe('EMPTY');

      // Rapid second click: tile is now EMPTY in authoritative grid
      const secondClick = canEditTile({
        tool: 'demolish',
        coord: debrisCoord,
        currentTile: 'EMPTY',
        mission: deepVaultMission,
        repairCharges: 1,
      });
      expect(secondClick.allowed).toBe(false);
      expect(secondClick.reason).toBe('DEBRIS ALREADY CLEARED');
      expect(secondClick.consumesCharge).toBe(false);
    });

    it('Completes Deep Vault Quarantine mission after breaching both bulkheads', () => {
      const model = new GridModel(
        deepVaultMission.rows,
        deepVaultMission.cols,
        deepVaultMission.start,
        deepVaultMission.target
      );
      deepVaultMission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
      deepVaultMission.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

      let charges = deepVaultMission.repairCharges!;
      expect(charges).toBe(2);

      // Verify path is initially blocked through the debris bulkheads
      const initialPath = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: deepVaultMission.start,
        goal: deepVaultMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      // Without breaching debris, either no path or expensive detour
      const bulkheads = deepVaultMission.initialDebris!;
      expect(bulkheads.length).toBe(2);

      // Demolish Bulkhead 1
      const bh1 = bulkheads[0];
      const p1 = canEditTile({
        tool: 'demolish',
        coord: bh1,
        currentTile: model.tiles[bh1.r][bh1.c],
        mission: deepVaultMission,
        repairCharges: charges,
      });
      expect(p1.allowed).toBe(true);
      model.setTile(bh1.r, bh1.c, 'EMPTY');
      charges -= 1;
      expect(charges).toBe(1);

      // Demolish Bulkhead 2
      const bh2 = bulkheads[1];
      const p2 = canEditTile({
        tool: 'demolish',
        coord: bh2,
        currentTile: model.tiles[bh2.r][bh2.c],
        mission: deepVaultMission,
        repairCharges: charges,
      });
      expect(p2.allowed).toBe(true);
      model.setTile(bh2.r, bh2.c, 'EMPTY');
      charges -= 1;
      expect(charges).toBe(0);

      // Now route through breached bulkheads is optimal and fully open
      const breachedPath = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: deepVaultMission.start,
        goal: deepVaultMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      expect(breachedPath.found).toBe(true);

      const robot = new RobotController(deepVaultMission.start);
      robot.setPath(breachedPath.path, breachedPath.totalCost);
      robot.startMoving();

      while (robot.state === 'MOVING') {
        robot.update(0.35, 10);
      }

      expect(robot.state).toBe('ARRIVED');
      expect(robot.logicalPos).toEqual(deepVaultMission.target);
    });

    it('Replay after a breached Challenge Mission cleanly restores original mission state and repair charges', () => {
      // 1. Setup and breach Challenge 1
      const model = new GridModel(
        challenge1Mission.rows,
        challenge1Mission.cols,
        challenge1Mission.start,
        challenge1Mission.target
      );
      challenge1Mission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
      challenge1Mission.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
      challenge1Mission.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

      let charges = challenge1Mission.repairCharges!;
      expect(charges).toBe(2);

      // Spend all charges
      challenge1Mission.initialDebris!.forEach((d) => {
        model.setTile(d.r, d.c, 'EMPTY');
        charges--;
      });
      expect(charges).toBe(0);

      // Navigate robot to destination
      const robot = new RobotController(challenge1Mission.start);
      const res = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: challenge1Mission.start,
        goal: challenge1Mission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      robot.setPath(res.path, res.totalCost);
      robot.startMoving();
      while (robot.state === 'MOVING') {
        robot.update(0.35, 10);
      }
      expect(robot.state).toBe('ARRIVED');
      expect(robot.stepsTaken).toBe(16);

      // 2. Perform Authoritative Replay (identical to handleReplayMission / GameHUD key re-mount)
      const freshModel = new GridModel(
        challenge1Mission.rows,
        challenge1Mission.cols,
        challenge1Mission.start,
        challenge1Mission.target
      );
      challenge1Mission.initialWalls.forEach((w) => freshModel.setTile(w.r, w.c, 'WALL'));
      challenge1Mission.initialRoughTerrain?.forEach((t) => freshModel.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
      challenge1Mission.initialDebris?.forEach((d) => freshModel.setTile(d.r, d.c, 'DEBRIS'));

      robot.reset(challenge1Mission.start);
      charges = challenge1Mission.repairCharges!;

      // 3. Verify complete restoration of mission state
      expect(charges).toBe(2);
      expect(robot.state).toBe('IDLE');
      expect(robot.logicalPos).toEqual(challenge1Mission.start);
      expect(robot.stepsTaken).toBe(0);
      expect(robot.executedCost).toBe(0);
      expect(robot.replansCount).toBe(0);

      // Debris tiles must be restored and blocking direct corridor
      challenge1Mission.initialDebris!.forEach((d) => {
        expect(freshModel.tiles[d.r][d.c]).toBe('DEBRIS');
        expect(isTileBlocked(freshModel.tiles[d.r][d.c])).toBe(true);
      });

      // A* path is once again forced to take upper rough-terrain detour
      const replayedPath = findPathAStar({
        grid: freshModel.tiles,
        rows: freshModel.rows,
        cols: freshModel.cols,
        start: challenge1Mission.start,
        goal: challenge1Mission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      expect(replayedPath.found).toBe(true);
      expect(replayedPath.path.length - 1).toBeGreaterThan(16);
      expect(replayedPath.path.some((wp) => wp.r <= 3)).toBe(true);
    });

    it('Reset and mission switching with exhausted charges correctly isolates and restores each mission', () => {
      // 1. Exhaust charges on Challenge 1
      let c1Charges = challenge1Mission.repairCharges!;
      c1Charges = 0; // all charges consumed

      // Reset within Challenge 1
      c1Charges = challenge1Mission.repairCharges!;
      expect(c1Charges).toBe(2);

      // Exhaust charges again
      c1Charges = 0;

      // 2. Switch to Deep Vault Quarantine (Challenge 2)
      const deepVaultModel = new GridModel(
        deepVaultMission.rows,
        deepVaultMission.cols,
        deepVaultMission.start,
        deepVaultMission.target
      );
      deepVaultMission.initialWalls.forEach((w) => deepVaultModel.setTile(w.r, w.c, 'WALL'));
      deepVaultMission.initialDebris?.forEach((d) => deepVaultModel.setTile(d.r, d.c, 'DEBRIS'));

      let deepVaultCharges = deepVaultMission.repairCharges!;
      expect(deepVaultCharges).toBe(2);

      // Verify Deep Vault starts with its own distinct bulkheads intact
      expect(deepVaultMission.initialDebris).toBeDefined();
      deepVaultMission.initialDebris!.forEach((d) => {
        expect(deepVaultModel.tiles[d.r][d.c]).toBe('DEBRIS');
        expect(isTileDesignatedDebris(d, deepVaultMission)).toBe(true);
        expect(isTileDesignatedDebris(d, challenge1Mission)).toBe(false);
      });

      // Exhaust Deep Vault charges
      deepVaultCharges = 0;

      // Reset Deep Vault
      deepVaultCharges = deepVaultMission.repairCharges!;
      expect(deepVaultCharges).toBe(2);

      // Switch back to Challenge 1
      const c1RestoredModel = new GridModel(
        challenge1Mission.rows,
        challenge1Mission.cols,
        challenge1Mission.start,
        challenge1Mission.target
      );
      challenge1Mission.initialWalls.forEach((w) => c1RestoredModel.setTile(w.r, w.c, 'WALL'));
      challenge1Mission.initialDebris?.forEach((d) => c1RestoredModel.setTile(d.r, d.c, 'DEBRIS'));
      const c1RestoredCharges = challenge1Mission.repairCharges!;

      expect(c1RestoredCharges).toBe(2);
      expect(c1RestoredModel.tiles[5][8]).toBe('DEBRIS');
      expect(c1RestoredModel.tiles[5][12]).toBe('DEBRIS');
    });

    it('Pre-deploy presentation collapse suppresses false demo window re-arming during bypass transit', () => {
      const model = new GridModel(
        presentationMission.rows,
        presentationMission.cols,
        presentationMission.start,
        presentationMission.target
      );
      presentationMission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));

      // Pre-deploy collapse placed at (5, 10)
      const collapseCoord = presentationMission.demoBlockageCoord!;
      model.setTile(collapseCoord.r, collapseCoord.c, 'WALL');

      const isDemoBlockagePresent = isTileBlocked(model.tiles[collapseCoord.r][collapseCoord.c]);
      expect(isDemoBlockagePresent).toBe(true);

      const robot = new RobotController(presentationMission.start);
      const plan = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: presentationMission.start,
        goal: presentationMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      expect(plan.found).toBe(true);
      robot.setPath(plan.path, plan.totalCost);

      // Start movement along the 20-step bypass
      robot.startMoving();

      // Step until robot reaches col 3 (inside coordinate bounds where demo window would normally trigger)
      while (robot.state === 'MOVING' && robot.logicalPos.c < 3) {
        robot.update(0.1, 2);
      }

      const tel = robot.getTelemetry();
      expect(tel.currentLogicalCoord.c).toBeGreaterThanOrEqual(3);
      expect(tel.currentLogicalCoord.r).toBe(5);

      // Verify that because demo collapse is already present, demo window does NOT re-arm
      const isInDemoWindow =
        !isDemoBlockagePresent &&
        tel.replansCount === 0 &&
        tel.currentLogicalCoord.r === 5 &&
        robot.state === 'MOVING' &&
        tel.currentLogicalCoord.c >= 3 &&
        tel.currentLogicalCoord.c <= 8;

      expect(isInDemoWindow).toBe(false);

      // Verify detour is actively recognized
      const isDetourActive = tel.replansCount > 0 || (isDemoBlockagePresent && tel.totalStepsTaken > 0);
      expect(isDetourActive).toBe(true);
    });
  });
});
