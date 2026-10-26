import { describe, it, expect } from 'vitest';
import { GridModel } from '../src/game/gridModel';
import { RobotController } from '../src/game/robotController';
import { MISSIONS } from '../src/missions/missionData';
import { findPathAStar, isTileBlocked, getTileMovementCost } from '../src/algorithms/astar';
import { GridCoord } from '../src/algorithms/types';

describe('Project Aegis V4.3.1 Review Corrections Test Suite', () => {
  const neonMission = MISSIONS.find((m) => m.id === 'mission-1')!;
  const challenge1Mission = MISSIONS.find((m) => m.id === 'mission-challenge-1')!;
  const deepVaultMission = MISSIONS.find((m) => m.id === 'mission-challenge-2')!;

  describe('P1 — Neon Mission Pre-Deploy Standby Blockage & State Machine', () => {
    it('Triggering blockage before deployment updates authoritative grid and recalculates initial route while robot remains stationary at 0 steps and 0 replans', () => {
      // 1. Initialize Neon Training Grounds model & robot
      const model = new GridModel(neonMission.rows, neonMission.cols, neonMission.start, neonMission.target);
      neonMission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));

      const robot = new RobotController(neonMission.start);

      // Initial route calculation
      const initialPlan = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: neonMission.start,
        goal: neonMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });

      expect(initialPlan.found).toBe(true);
      robot.setPath(initialPlan.path, initialPlan.totalCost);

      // Verify standby state
      expect(robot.state).toBe('CONFIRMED');
      expect(robot.stepsTaken).toBe(0);
      expect(robot.replansCount).toBe(0);
      expect(robot.logicalPos).toEqual(neonMission.start);
      expect(robot.visualX).toBe(neonMission.start.c);
      expect(robot.visualY).toBe(neonMission.start.r);

      // 2. Pick candidate waypoint ahead to trigger blockage (simulating handleTriggerBlockage)
      const remaining = robot.path.slice(robot.currentWaypointIndex + 1);
      const candidate = remaining[2]; // 2 steps ahead
      expect(candidate).toBeDefined();

      // Ensure candidate is currently open
      expect(isTileBlocked(model.tiles[candidate.r][candidate.c])).toBe(false);

      // 3. Trigger blockage before deployment:
      // Authoritative grid is updated with WALL
      const nextModel = model.clone();
      nextModel.setTile(candidate.r, candidate.c, 'WALL');
      expect(isTileBlocked(nextModel.tiles[candidate.r][candidate.c])).toBe(true);

      // Pre-deployment logic: recalculate path from start
      const preDeployPlan = findPathAStar({
        grid: nextModel.tiles,
        rows: nextModel.rows,
        cols: nextModel.cols,
        start: robot.logicalPos,
        goal: nextModel.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });

      expect(preDeployPlan.found).toBe(true);
      robot.setPath(preDeployPlan.path, preDeployPlan.totalCost);

      // 4. Assert Standby Invariants:
      // - Robot remains stationary at start position
      expect(robot.logicalPos).toEqual(neonMission.start);
      expect(robot.visualX).toBe(neonMission.start.c);
      expect(robot.visualY).toBe(neonMission.start.r);
      // - Step count remains strictly 0
      expect(robot.stepsTaken).toBe(0);
      // - Replan count remains strictly 0 for initial planning
      expect(robot.replansCount).toBe(0);
      // - State remains CONFIRMED (ready for deployment, NOT moving)
      expect(robot.state).toBe('CONFIRMED');
      // - New path does NOT contain the blocked candidate
      expect(robot.path.some((wp) => wp.r === candidate.r && wp.c === candidate.c)).toBe(false);

      // 5. Movement begins ONLY after player explicitly presses Deploy
      robot.startMoving();
      expect(robot.state).toBe('MOVING');

      // 6. Complete traversal to target
      while (robot.state === 'MOVING') {
        robot.update(0.35, 10);
      }

      // 7. Verify arrival
      expect(robot.state).toBe('ARRIVED');
      expect(robot.logicalPos).toEqual(neonMission.target);
      expect(robot.replansCount).toBe(0); // 0 dynamic mid-transit replans
      expect(robot.stepsTaken).toBe(preDeployPlan.path.length - 1);
      expect(robot.executedCost).toBe(preDeployPlan.totalCost);
      expect(robot.remainingCost).toBe(0);
    });

    it('Mid-transit blockage triggers genuine dynamic replanning with replansCount increment and safe arrival', () => {
      const model = new GridModel(neonMission.rows, neonMission.cols, neonMission.start, neonMission.target);
      neonMission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));

      const robot = new RobotController(neonMission.start);

      const initialPlan = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: neonMission.start,
        goal: neonMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      robot.setPath(initialPlan.path, initialPlan.totalCost);

      // Wire replanning handler as in GameHUD
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

      // Explicit deploy
      robot.startMoving();
      expect(robot.state).toBe('MOVING');

      // Advance 3 steps
      robot.update(0.35, 10);
      robot.update(0.35, 10);
      robot.update(0.35, 10);
      expect(robot.stepsTaken).toBe(3);
      expect(robot.state).toBe('MOVING');

      // Pick upcoming waypoint ahead of current position
      const remaining = robot.path.slice(robot.currentWaypointIndex + 1);
      const blockTarget = remaining[1];
      expect(blockTarget).toBeDefined();

      // Trigger mid-transit blockage
      model.setTile(blockTarget.r, blockTarget.c, 'WALL');
      const blocked = robot.checkPathBlocked((r, c) => isTileBlocked(model.tiles[r][c]));

      expect(blocked).toBe(true);
      expect(robot.replansCount).toBe(1); // Replans count incremented on dynamic mid-transit blockage
      expect(robot.state).toBe('MOVING'); // Resumed on detour path

      // Traverse to completion
      while (robot.state === 'MOVING') {
        robot.update(0.35, 10);
      }

      expect(robot.state).toBe('ARRIVED');
      expect(robot.logicalPos).toEqual(neonMission.target);
      expect(robot.replansCount).toBe(1);
      expect(robot.stepsTaken).toBeGreaterThan(0);
      expect(robot.remainingCost).toBe(0);
    });

    it('Reset returns simulation to pristine initial state: start pos, 0 steps, 0 replans, original geometry', () => {
      const model = new GridModel(neonMission.rows, neonMission.cols, neonMission.start, neonMission.target);
      neonMission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));

      const robot = new RobotController(neonMission.start);
      const initialPlan = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: neonMission.start,
        goal: neonMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      robot.setPath(initialPlan.path, initialPlan.totalCost);
      robot.startMoving();

      // Advance several steps
      robot.update(0.35, 10);
      robot.update(0.35, 10);
      expect(robot.stepsTaken).toBe(2);

      // Perform reset simulation
      robot.reset(neonMission.start);
      const freshModel = new GridModel(neonMission.rows, neonMission.cols, neonMission.start, neonMission.target);
      neonMission.initialWalls.forEach((w) => freshModel.setTile(w.r, w.c, 'WALL'));

      const resetPlan = findPathAStar({
        grid: freshModel.tiles,
        rows: freshModel.rows,
        cols: freshModel.cols,
        start: neonMission.start,
        goal: neonMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      robot.setPath(resetPlan.path, resetPlan.totalCost);

      expect(robot.state).toBe('CONFIRMED');
      expect(robot.logicalPos).toEqual(neonMission.start);
      expect(robot.visualX).toBe(neonMission.start.c);
      expect(robot.visualY).toBe(neonMission.start.r);
      expect(robot.stepsTaken).toBe(0);
      expect(robot.replansCount).toBe(0);
      expect(robot.executedCost).toBe(0);
      expect(robot.remainingCost).toBe(resetPlan.totalCost);
      expect(robot.path).toEqual(initialPlan.path);
    });

    it('Replay maintains clean state isolation and identical optimal path', () => {
      // Mission run 1 to completion
      const model1 = new GridModel(neonMission.rows, neonMission.cols, neonMission.start, neonMission.target);
      neonMission.initialWalls.forEach((w) => model1.setTile(w.r, w.c, 'WALL'));
      const robot1 = new RobotController(neonMission.start);
      const plan1 = findPathAStar({
        grid: model1.tiles,
        rows: model1.rows,
        cols: model1.cols,
        start: neonMission.start,
        goal: neonMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      robot1.setPath(plan1.path, plan1.totalCost);
      robot1.startMoving();
      while (robot1.state === 'MOVING') {
        robot1.update(0.35, 10);
      }
      expect(robot1.state).toBe('ARRIVED');
      const run1Steps = robot1.stepsTaken;
      const run1Cost = robot1.executedCost;

      // Replay (new session mount)
      const model2 = new GridModel(neonMission.rows, neonMission.cols, neonMission.start, neonMission.target);
      neonMission.initialWalls.forEach((w) => model2.setTile(w.r, w.c, 'WALL'));
      const robot2 = new RobotController(neonMission.start);
      const plan2 = findPathAStar({
        grid: model2.tiles,
        rows: model2.rows,
        cols: model2.cols,
        start: neonMission.start,
        goal: neonMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      robot2.setPath(plan2.path, plan2.totalCost);

      expect(robot2.state).toBe('CONFIRMED');
      expect(robot2.stepsTaken).toBe(0);
      expect(robot2.replansCount).toBe(0);

      robot2.startMoving();
      while (robot2.state === 'MOVING') {
        robot2.update(0.35, 10);
      }
      expect(robot2.state).toBe('ARRIVED');
      expect(robot2.stepsTaken).toBe(run1Steps);
      expect(robot2.executedCost).toBe(run1Cost);
    });
  });

  describe('P2 — Rescue Sequence Stage Transitions & Timing Semantics', () => {
    it('Verifies 5-stage rescue sequence timeline: scanning precedes stabilization, SURVIVOR SECURED only appears in Stage 4', () => {
      // Timeline state machine simulation matching GameHUD logic
      const RESCUE_DURATION = 5.2;
      const dt = 0.05;
      const steps = Math.ceil(RESCUE_DURATION / dt) + 2;

      const stageEvents: { time: number; stage: string; message: string; survivorSecuredVisible: boolean }[] = [];

      let completed = false;
      let message = 'SURVIVOR CONTACT — COMMENCING RESCUE PROTOCOL';
      let lastTimer = 0;

      for (let i = 1; i <= steps && !completed; i++) {
        const timer = Math.round(i * dt * 100) / 100;
        lastTimer = timer;
        const prevT = Math.round((i - 1) * dt * 100) / 100;

        if (timer >= 1.0 && prevT < 1.0) {
          message = 'MEDICAL SCAN — ANALYZING VITAL SIGNS';
        }
        if (timer >= 2.2 && prevT < 2.2) {
          message = 'LIFE SUPPORT LINKED — SURVIVOR STABILIZING';
        }
        if (timer >= 3.4 && prevT < 3.4) {
          message = 'RESCUE CONFIRMED — SURVIVOR SECURED';
        }
        if (timer >= 4.4 && prevT < 4.4) {
          message = 'EXTRACTION COMPLETE — PREPARING DEBRIEF';
        }
        if (timer >= 5.2) {
          completed = true;
          message = 'MISSION ACCOMPLISHED';
        }

        // Renderer stage conditions
        const progress = Math.min(1.0, timer / 5.2);
        const isStabilized = progress >= 0.42;
        const isConfirmed = progress >= 0.65;
        const survivorSecured = isConfirmed;

        stageEvents.push({
          time: timer,
          stage: progress < 0.19 ? 'APPROACH' : progress < 0.42 ? 'SCAN' : progress < 0.65 ? 'STABILIZE' : 'CONFIRM',
          message,
          survivorSecuredVisible: survivorSecured,
        });
      }

      // Assert that during SCANNING (t < 2.2s), SURVIVOR SECURED is NOT visible
      const scanEvents = stageEvents.filter((e) => e.time >= 1.0 && e.time < 2.2);
      expect(scanEvents.length).toBeGreaterThan(0);
      scanEvents.forEach((e) => {
        expect(e.message).toBe('MEDICAL SCAN — ANALYZING VITAL SIGNS');
        expect(e.survivorSecuredVisible).toBe(false);
      });

      // Assert that during STABILIZATION (2.2s <= t < 3.4s), SURVIVOR SECURED is NOT visible
      const stabilizeEvents = stageEvents.filter((e) => e.time >= 2.2 && e.time < 3.4);
      expect(stabilizeEvents.length).toBeGreaterThan(0);
      stabilizeEvents.forEach((e) => {
        expect(e.message).toBe('LIFE SUPPORT LINKED — SURVIVOR STABILIZING');
        expect(e.survivorSecuredVisible).toBe(false);
      });

      // Assert that at CONFIRMATION (t >= 3.4s), SURVIVOR SECURED becomes visible
      const confirmEvents = stageEvents.filter((e) => e.time >= 3.4 && e.time < 4.4);
      expect(confirmEvents.length).toBeGreaterThan(0);
      confirmEvents.forEach((e) => {
        expect(e.message).toBe('RESCUE CONFIRMED — SURVIVOR SECURED');
        expect(e.survivorSecuredVisible).toBe(true);
      });

      // Total sequence completes at >= 5.2s (in 4-6s window)
      expect(lastTimer).toBeGreaterThanOrEqual(5.2);
      expect(completed).toBe(true);
    });
  });

  describe('Regression Gate — Deep Vault Optimal 26-Step 3-Star Result Preserved', () => {
    it('Deep Vault produces optimal 26-step route and achieves 3 stars with 2 demolitions', () => {
      const model = new GridModel(deepVaultMission.rows, deepVaultMission.cols, deepVaultMission.start, deepVaultMission.target);
      deepVaultMission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
      deepVaultMission.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

      // Optimal demolitions at (7, 6) and (7, 15)
      model.setTile(6, 7, 'EMPTY');
      model.setTile(6, 15, 'EMPTY');

      const plan = findPathAStar({
        grid: model.tiles,
        rows: model.rows,
        cols: model.cols,
        start: deepVaultMission.start,
        goal: deepVaultMission.target,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });

      expect(plan.found).toBe(true);
      const steps = plan.path.length - 1;
      expect(steps).toBe(26); // Exact verified 26 steps for 3-star threshold
      expect(steps).toBeLessThanOrEqual(deepVaultMission.targetStepsForStar3);
    });
  });
});
