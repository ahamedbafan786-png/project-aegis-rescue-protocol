# Project Aegis: Rescue Protocol — Release v4.2.2

**Project Aegis: Rescue Protocol** is a retro-futuristic autonomous rescue robot game engineered to demonstrate real-time pathfinding algorithms, dynamic obstacle replanning, and graph theory principles through interactive, colourful gameplay.

- **Live Application:** [https://project-aegis-theta.vercel.app/](https://project-aegis-theta.vercel.app/)
- **Repository:** [https://github.com/ahamedbafan786-png/project-aegis-rescue-protocol](https://github.com/ahamedbafan786-png/project-aegis-rescue-protocol)

---

## 🚀 Key Features

### 1. Dynamic Pathfinding Engine & Real-Time Replanning
- **A\* Pathfinding ($f(n) = g(n) + h(n)$):** Implemented with an admissible and consistent Manhattan distance heuristic ensuring mathematically optimal paths.
- **Dynamic Replanning:** In-flight route invalidation upon environmental collapse, preserving historical traversed path segments and cumulative energy cost.
- **Dijkstra & BFS Baseline Comparisons:** Unweighted BFS and weighted Dijkstra algorithms available side-by-side in real time.

### 2. Campaign Missions & Challenge Mechanics
- **5 Campaign Scenarios:** *Containment Breach*, *Deep Vault Quarantine*, *Flooded Reactor Core*, *Magnetic Flux Sector*, and *Cryo Stasis Chamber*.
- **Challenge Mode:** Strict resource-management gameplay requiring players to spend limited Repair Charges on designated structural debris while respecting permanent wall immunity.
- **Presentation Mode:** Dedicated educational showcase mode featuring Auto-Hold waypoint pausing, dynamic corridor collapse triggers, and animated telemetry comparison.
- **Sandbox Lab:** Unrestricted laboratory for custom obstacle painting, rough terrain weighting, maze generation, and algorithm experimentation.

### 3. Audiovisual & Responsive Engineering
- **Audio Synthesis:** Zero-asset procedural Web Audio API sound generator producing responsive telemetry beeps, emergency sirens, obstacle breach effects, and victory chimes.
- **Multi-Screen Responsive Design:** Pixel-perfect layout from mobile devices (390×844 iPhone, 543×589 compact foldables) up to 4K desktop displays with responsive sliding HUD drawers.
- **Hardware-Accelerated Canvas Rendering:** Custom isometric-inspired grid rendering with dynamic robot directional sprites, path ribbons, pulse waves, and particle effects.

---

## 🛠️ v4.2.2 Release Improvements & Repository Polish

- **Automated CI/CD Pipeline:** Added official GitHub Actions workflow (`.github/workflows/ci.yml`) testing push and pull requests on Node.js 22 with linting, unit testing, and production builds.
- **Portability & Cleanliness:** Removed all personal workstation paths, standardizing test artifact emission to configurable directories via `process.env.ARTIFACTS_DIR` and `process.env.SCREENSHOTS_DIR`.
- **Strict Verification Assertions:** Hardened automated acceptance testing in `scripts/qaV4_2_1Acceptance.mjs` with exact numeric assertions for route steps, cost calculations, replan counts, charge guards, and weighted arena topology costs.
- **Engine & Version Alignment:** Aligned package metadata to `v4.2.2`, declared explicit Node.js engines requirement (`>=22.12.0`), added `.nvmrc` (Node 22), and synchronized lockfile dependencies across platforms.
- **Branding & Documentation:** Enhanced `index.html` metadata, updated README status badges (CI, TypeScript 6.0, React 19.3), and fixed Markdown formatting.

---

## 🧪 Verification & Quality Assurance

- **Unit Tests:** 54/54 passing (`vitest run`) in 269ms across 6 test suites.
- **Linter:** 0 errors (`oxlint`).
- **Production Build:** Succeeded in 526ms (`tsc -b && vite build`).
- **Browser Acceptance Suite:** 11/11 scenarios passed (`puppeteer` on real browser):
  - Scenario 1: Auto-Hold ON -> Trigger Collapse -> Bypass & Complete (20 steps, 1 replan, cost 20.0).
  - Scenario 2: Moving Trigger Collapse (Auto-Hold OFF).
  - Scenario 2B: Trigger Collapse Before Deploy.
  - Scenario 3 & 6: Designated Debris Demolition & Zero-Charge Bounds Enforcement.
  - Scenario 4: Structural Wall Demolition Immunity.
  - Scenario 5: Sandbox Exploit Removal in Challenge Mode.
  - Scenario 7 & 8: Reset & Replay Charge State Restoration.
  - Scenario 9: Persistent Mobile Repair Counter Visibility.
  - Scenario 10: Unrestricted Sandbox Lab Editing.
  - Scenario 11: Weighted Arena Topological Metric Regression (BFS 30.0 vs A\* 22.0 vs Dijkstra 22.0).
- **GitHub Actions CI:** `build-and-test` passing on `ubuntu-latest`.
