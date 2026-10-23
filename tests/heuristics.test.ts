import { describe, expect, it } from 'vitest';
import {
  euclideanDistance,
  manhattanDistance,
  octileDistance,
  SQRT_2,
} from '../src/algorithms/heuristics';

describe('Heuristics Admissibility & Accuracy', () => {
  const p1 = { r: 1, c: 2 };
  const p2 = { r: 4, c: 6 };

  it('calculates Manhattan distance correctly (dr=3, dc=4 -> 7)', () => {
    expect(manhattanDistance(p1, p2)).toBe(7);
  });

  it('calculates Euclidean distance correctly (3, 4, 5 triangle)', () => {
    expect(euclideanDistance(p1, p2)).toBe(5);
  });

  it('calculates Octile distance correctly for diagonal movement', () => {
    // dr = 3, dc = 4 -> min=3, max=4
    // Octile = (3 + 4) + (sqrt(2) - 2) * 3 = 7 + 3*sqrt(2) - 6 = 1 + 3 * sqrt(2)
    const expected = 1 + 3 * SQRT_2;
    expect(octileDistance(p1, p2)).toBeCloseTo(expected, 5);
  });

  it('never inflates heuristic above true distance (admissibility)', () => {
    // In 4-way grid, true shortest distance between (0,0) and (3,3) is 6
    const start = { r: 0, c: 0 };
    const goal = { r: 3, c: 3 };
    expect(manhattanDistance(start, goal)).toBe(6);
    expect(manhattanDistance(start, goal)).toBeLessThanOrEqual(6);

    // In 8-way grid, true distance with sqrt(2) diagonal cost is 3 * sqrt(2) ~ 4.2426
    const trueOctileDist = 3 * SQRT_2;
    expect(octileDistance(start, goal)).toBeCloseTo(trueOctileDist, 5);
    expect(octileDistance(start, goal)).toBeLessThanOrEqual(trueOctileDist + 1e-9);
  });
});
