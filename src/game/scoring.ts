/**
 * PROJECT AEGIS — MISSION PERFORMANCE & STAR SCORING ENGINE
 * Evaluates tactical rescue mission performance against optimal algorithmic benchmarks.
 *
 * Scoring Rules:
 * - 3 Stars (Optimal): steps <= targetStepsForStar3 AND replans <= 2
 * - 2 Stars (Efficient): steps <= targetStepsForStar3 * 1.3
 * - 1 Star (Completed): base completion of the mission
 *
 * Enforces strict finite numerical validation on all input parameters.
 */

export interface ScoringResult {
  stars: 1 | 2 | 3;
  ratingLabel: string;
  explanation: string;
  targetStepsForStar3: number;
  efficientStepThreshold: number;
}

export function calculateStarRating(
  stepsTaken: number,
  replansCount: number,
  targetStepsForStar3: number
): ScoringResult {
  if (!Number.isFinite(stepsTaken) || stepsTaken < 0) {
    throw new Error(`Invalid stepsTaken value: ${stepsTaken}. Expected a finite, non-negative number.`);
  }
  if (!Number.isFinite(replansCount) || replansCount < 0) {
    throw new Error(`Invalid replansCount value: ${replansCount}. Expected a finite, non-negative number.`);
  }
  if (!Number.isFinite(targetStepsForStar3) || targetStepsForStar3 <= 0) {
    throw new Error(`Invalid targetStepsForStar3 value: ${targetStepsForStar3}. Expected a finite, positive number.`);
  }

  const efficientThreshold = Math.floor(targetStepsForStar3 * 1.3);

  let stars: 1 | 2 | 3 = 1;
  if (stepsTaken <= targetStepsForStar3 * 1.3) {
    stars = 2;
  }
  if (stepsTaken <= targetStepsForStar3 && replansCount <= 2) {
    stars = 3;
  }

  let ratingLabel = '★☆☆ MISSION COMPLETED';
  let explanation = `Mission accomplished in ${stepsTaken} steps. Further search pruning (target: ≤ ${targetStepsForStar3} steps) can optimize total steps.`;

  if (stars === 3) {
    ratingLabel = '★★★ OPTIMAL RESCUE PROTOCOL';
    explanation = `Optimal route executed with high algorithmic efficiency (≤ ${targetStepsForStar3} steps with minimal replanning).`;
  } else if (stars === 2) {
    ratingLabel = '★★☆ EFFICIENT EXTRACTION';
    if (stepsTaken <= targetStepsForStar3 && replansCount > 2) {
      explanation = `Optimal step count reached (${stepsTaken} steps), but excessive dynamic replanning (${replansCount} replans > 2) reduced star rating.`;
    } else {
      explanation = `Efficient clearance achieved (${stepsTaken} steps ≤ ${efficientThreshold} steps). Refine route to reach 3-star benchmark (≤ ${targetStepsForStar3} steps).`;
    }
  }

  return {
    stars,
    ratingLabel,
    explanation,
    targetStepsForStar3,
    efficientStepThreshold: efficientThreshold,
  };
}
