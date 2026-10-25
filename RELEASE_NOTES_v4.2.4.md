# Project Aegis: Rescue Protocol — Release v4.2.4

**Release Version:** `v4.2.4`  
**Commit:** Maintenance & Scoring Polish  
**Repository:** [ahamedbafan786-png/project-aegis-rescue-protocol](https://github.com/ahamedbafan786-png/project-aegis-rescue-protocol)  
**Live Application:** [https://project-aegis-theta.vercel.app/](https://project-aegis-theta.vercel.app/)

---

## 🎯 Release Highlights

### 1. Deep Vault Quarantine 3-Star Scoring & Transparent Criteria
- **Optimal Benchmark Alignment:** Corrected `targetStepsForStar3` from `22` to `26` for `mission-challenge-2` (`Deep Vault Quarantine`). Because the start `(2, 2)` and target `(10, 20)` have a Manhattan distance of 26 ($|10-2| + |20-2| = 26$), 26 steps is the theoretical and physical minimum in 4-directional grid movement. Players achieving the optimal route with 2 breached bulkheads now reliably receive 3 stars.
- **Centralized Scoring Engine (`src/game/scoring.ts`):** Extracted mission scoring logic into a strictly validated pure TypeScript module enforcing `Number.isFinite()` across all parameters.
- **Debrief Dialog Explanation:** Enhanced `MissionResultsModal.tsx` with a dedicated "Scoring Benchmark Criteria" card displaying the optimal step target ($\le 26$ steps & $\le 2$ replans), the efficient step threshold ($\le 33$ steps), and an explicit contextual explanation.
- **Automated Regression Suite (`tests/scoring.test.ts`):** Added 5 unit tests validating Manhattan minimums, optimal path calculation, 3-star and 2-star thresholds, and negative number rejection.

### 2. Elimination of False-Positive Numeric Assertions
- **Assertion Utilities (`scripts/qaAssertionUtils.mjs`):** Built strict assertion primitives:
  - `assertFinite(val, label)`: Rejects `NaN`, `Infinity`, `-Infinity`, strings, `null`, and `undefined`.
  - `assertExactInt(actual, expected, label)`: Validates integer types and exact equality.
  - `assertFloatClose(actual, expected, tolerance, label)`: Validates finite floats with explicit mathematical tolerance.
  - `assertDimensionsPositive(rect, label)`: Validates that width and height are strictly greater than 0.
  - `assertNonOverlap(rect1, rect2, label1, label2)`: Validates 2D bounding-box non-intersection.
  - `assertInViewportBounds(rect, vpWidth, vpHeight, label)`: Enforces zero viewport clipping.
- **Hardened CI Smoke Test (`scripts/qaSmokeCI.mjs`):** Upgraded Presentation Mode and Arena metrics to use exact scoped numeric assertions.
- **Hardened Acceptance Suite (`scripts/qaV4_2_2Acceptance.mjs`):** Enforced finite integer and float assertions across all 11 test scenarios.

### 3. Complete Mobile Freeze Gate Automation
- **Multi-Viewport & Multi-State Verification:** Tested across all 6 required mobile CSS viewport dimensions:
  - `320×844`
  - `360×800`
  - `375×812`
  - `390×844`
  - `430×932`
  - `543×589`
- **All Repair States (`2/2`, `1/2`, `0/2`):** For every viewport and state, the test suite asserts:
  - Exact `window.innerWidth` and `window.innerHeight` matching.
  - Text and charge state synchronization.
  - Visual display visibility (`display !== 'none'`, `visibility !== 'hidden'`, `opacity !== '0'`).
  - Zero 2D bounding box intersection between the repair badge, Tools drawer toggle, and Telemetry drawer toggle.
  - Zero clipping outside viewport boundaries (`left >= 0`, `top >= 0`, `right <= width`, `bottom <= height`).
  - Strictly positive element dimensions (`width > 0`, `height > 0`).

### 4. Negative Test Harness Verification
- Integrated `runNegativeAssertionSelfTests()` executing 16 deliberate negative test fixtures against the assertion functions themselves.
- Confirmed that mismatched metrics, non-integers, `NaN`, `Infinity`, overlapping bounding boxes, zero dimensions, and clipped rectangles reliably throw descriptive errors.

### 5. Repository & Documentation Synchronization
- Synchronized `README.md` test counts from contradictory figures to the exact count: **68 automated tests across 8 suites**, with 100% passing.
- Updated documentation to clarify verification scope on Chromium desktop and mobile viewports.
- Bumped version in `package.json`, `package-lock.json`, and `src/components/Navbar.tsx` to `4.2.4`.

---

## 🔬 Test Suite Metrics

| Suite | File | Tests | Status |
| :--- | :--- | :--- | :--- |
| Priority Queue Min-Heap | `tests/minHeap.test.ts` | 3 | PASS ✅ |
| Admissible Heuristics | `tests/heuristics.test.ts` | 4 | PASS ✅ |
| Robot Cost Accounting | `tests/robotCostAccounting.test.ts` | 5 | PASS ✅ |
| Tactical Debris Clearance | `tests/challengeMechanic.test.ts` | 4 | PASS ✅ |
| Core A* Pathfinding | `tests/astar.test.ts` | 12 | PASS ✅ |
| Gameplay Integrity V4.2.1 | `tests/v4_2_1_gameplay_integrity.test.ts` | 26 | PASS ✅ |
| Stability & Mobile V4.2.2 | `tests/v4_2_2_stability_mobile.test.ts` | 9 | PASS ✅ |
| Mission Scoring & Deep Vault | `tests/scoring.test.ts` | 5 | PASS ✅ |
| **Total Unit Tests** | **8 Files** | **68 Tests** | **100% Passing ✅** |
| CI Browser Smoke Test | `scripts/qaSmokeCI.mjs` | 7 Checks + 16 Negative Assertions | PASS ✅ |
| Mobile Freeze Gate | `scripts/verifyMobileFreezeGate.mjs` | 420 Assertions (6 viewports × 3 states) | PASS ✅ |
| End-to-End Acceptance | `scripts/qaV4_2_2Acceptance.mjs` | 11 Scenarios | PASS ✅ |
