import { describe, expect, it } from 'vitest';
import { calculateStarRating } from '../src/game/scoring';
import { MISSIONS } from '../src/missions/missionData';
import { GridModel } from '../src/game/gridModel';
import { findPathAStar } from '../src/algorithms/astar';

describe('Project Aegis — Mission Scoring & Deep Vault Quarantine Verification', () => {
  const deepVault = MISSIONS.find((m) => m.id === 'mission-challenge-2')!;

  it('verifies Deep Vault Quarantine Manhattan distance and optimal 26-step route', () => {
    expect(deepVault).toBeDefined();
    expect(deepVault.start).toEqual({ r: 2, c: 2 });
    expect(deepVault.target).toEqual({ r: 10, c: 20 });

    // Theoretical Manhattan minimum distance
    const manhattanMin = Math.abs(10 - 2) + Math.abs(20 - 2);
    expect(manhattanMin).toBe(26);

    // targetStepsForStar3 must be configured to match optimal reachable route (26)
    expect(deepVault.targetStepsForStar3).toBe(26);

    // Build the grid model and breach both designated bulkheads
    const model = new GridModel(deepVault.rows, deepVault.cols, deepVault.start, deepVault.target);
    deepVault.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    deepVault.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    deepVault.initialDebris?.forEach((d) => model.setTile(d.r, d.c, 'DEBRIS'));

    // Clear both designated bulkheads at (6, 7) and (6, 15)
    model.setTile(6, 7, 'EMPTY');
    model.setTile(6, 15, 'EMPTY');

    const res = findPathAStar({
      grid: model.tiles,
      rows: model.rows,
      cols: model.cols,
      start: deepVault.start,
      goal: deepVault.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    expect(res.found).toBe(true);
    // Path length includes start cell, so total steps taken = path.length - 1
    const steps = res.path.length - 1;
    expect(steps).toBe(26);
    expect(res.totalCost).toBe(26.0);
  });

  it('reliably awards 3 stars when Deep Vault is completed in 26 steps matching optimal route', () => {
    // 26 steps, 0 replans
    const result0 = calculateStarRating(26, 0, deepVault.targetStepsForStar3);
    expect(result0.stars).toBe(3);
    expect(result0.ratingLabel).toBe('★★★ OPTIMAL RESCUE PROTOCOL');
    expect(result0.explanation).toContain('Optimal route executed');

    // 26 steps, 1 replan
    const result1 = calculateStarRating(26, 1, deepVault.targetStepsForStar3);
    expect(result1.stars).toBe(3);

    // 26 steps, 2 replans (allowed threshold for 3 stars)
    const result2 = calculateStarRating(26, 2, deepVault.targetStepsForStar3);
    expect(result2.stars).toBe(3);
  });

  it('correctly calculates 2 stars for efficient routes or when replans exceed 2', () => {
    // 26 steps but 3 replans (excessive replanning penalizes from 3 to 2 stars)
    const penalised = calculateStarRating(26, 3, deepVault.targetStepsForStar3);
    expect(penalised.stars).toBe(2);
    expect(penalised.ratingLabel).toBe('★★☆ EFFICIENT EXTRACTION');
    expect(penalised.explanation).toContain('excessive dynamic replanning');

    // 27 to 33 steps (within 26 * 1.3 = 33.8)
    const result27 = calculateStarRating(27, 0, deepVault.targetStepsForStar3);
    expect(result27.stars).toBe(2);
    expect(result27.ratingLabel).toBe('★★☆ EFFICIENT EXTRACTION');

    const result33 = calculateStarRating(33, 1, deepVault.targetStepsForStar3);
    expect(result33.stars).toBe(2);
  });

  it('awards 1 star when steps exceed 1.3x threshold', () => {
    // 34 steps > 33.8
    const result34 = calculateStarRating(34, 0, deepVault.targetStepsForStar3);
    expect(result34.stars).toBe(1);
    expect(result34.ratingLabel).toBe('★☆☆ MISSION COMPLETED');
    expect(result34.explanation).toContain('Further search pruning');
  });

  it('strictly validates finite numerical inputs and rejects NaN, Infinity, and negatives', () => {
    expect(() => calculateStarRating(NaN, 0, 26)).toThrow(/Invalid stepsTaken/);
    expect(() => calculateStarRating(26, NaN, 26)).toThrow(/Invalid replansCount/);
    expect(() => calculateStarRating(26, 0, NaN)).toThrow(/Invalid targetStepsForStar3/);

    expect(() => calculateStarRating(Infinity, 0, 26)).toThrow(/Invalid stepsTaken/);
    expect(() => calculateStarRating(26, Infinity, 26)).toThrow(/Invalid replansCount/);
    expect(() => calculateStarRating(26, 0, Infinity)).toThrow(/Invalid targetStepsForStar3/);

    expect(() => calculateStarRating(-1, 0, 26)).toThrow(/Invalid stepsTaken/);
    expect(() => calculateStarRating(26, -1, 26)).toThrow(/Invalid replansCount/);
    expect(() => calculateStarRating(26, 0, 0)).toThrow(/Invalid targetStepsForStar3/);
  });
});
