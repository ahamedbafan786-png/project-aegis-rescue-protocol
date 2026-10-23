# PROJECT AEGIS: RESCUE PROTOCOL
### Autonomous Robot Path Planning & Real-Time Dynamic Replanning System

> **Academic Topic**: Robot Path Planning using A* Algorithm  
> **Course**: Design & Analysis of Algorithms (DAA) / Artificial Intelligence / Robotics  
> **Target Audience**: University Lecturer Demonstration & Live Viva Examination  

---

## 1. Executive Summary

**Project Aegis: Rescue Protocol** is an interactive, game-like autonomous robot pathfinding demonstration developed in TypeScript, React 19, and Vite with a custom, delta-time interpolated 2D canvas simulation engine.

The user acts as a tactical mission commander deploying an autonomous rescue droid (**Aegis-1**) across hazardous disaster environments. The core engine implements a mathematically rigorous, **strictly admissible** ($h(n) \le h^*(n)$) A* pathfinding algorithm featuring **real-time mid-transit dynamic replanning**: when the player drops obstacles in front of the robot, it detects the obstruction, halts safely at its nearest valid grid cell without clipping or teleportation, executes an on-the-fly A* recalculation, and maneuvers through an alternate optimal route.

---

## 2. Key Technical Highlights

1. **Pure TypeScript A\* Pathfinding (No Black-Box Libraries)**:
   - Written completely from scratch in `src/algorithms/astar.ts`.
   - Utilizes a custom binary `MinHeap<T>` priority queue (`src/algorithms/minHeap.ts`) guaranteeing $O(\log N)$ extraction of minimum $f$-score nodes.
   - Strictly admissible and consistent heuristics (`src/algorithms/heuristics.ts`) with **zero artificial inflation** above 1.0.
   - Multi-tier tie-breaking: Primary: lowest $f(n)$, Secondary: highest $g(n)$ (deeper search along promising paths), Tertiary: lowest $h(n)$.

2. **Real-Time Dynamic Replanning (The Core Wow Feature)**:
   - Decoupled discrete logical coordinates $(r, c)$ and sub-pixel continuous visual coordinates $(x, y, \theta)$.
   - Active waypoint queue inspection on every tick.
   - When a blockage is detected ahead of the robot, the controller halts progression immediately, emits a warning alert, triggers localized A* recalculation from the current valid cell, and attaches the new route seamlessly.

3. **Comparative Algorithm Arena**:
   - Side-by-side benchmark testing **A\*** against **Dijkstra's Algorithm** and **Breadth-First Search (BFS)** on identical map topographies.
   - Live telemetry measuring expanded node count, route step length, total cost, and execution duration ($ms$) using `performance.now()`.
   - Formally demonstrates why A* expands far fewer nodes than Dijkstra while guaranteeing identical optimal path cost on uniform grids.

4. **Game-Studio Art Direction & Feel**:
   - Styled in **"Soft Neon Adventure / Futuristic Arcade Strategy"** (deep blueberry `#17233D`, midnight blue `#202C49`, soft cyan `#66DAD5`, lavender `#A695F2`, coral `#FF9B83`).
   - Character model for Aegis-1: rounded metallic chassis, directional visor, glowing eye sensor, directional sensor light cone, center power core, and micro-thruster spark particles.
   - Ambient occlusion, beveled 3D-styled obstacle blocks, rough crystalline terrain fields ($3\times$ cost), pulsing beacons, and high-DPI scaling.

5. **Synthesized Audio Engine**:
   - Native browser **Web Audio API** synthesizer (`src/game/soundEngine.ts`) with zero external MP3/WAV dependencies.
   - Procedural sound effects: tactical UI click, deployment pulse, servo movement ticks, route locked chime, warning buzz, scanning sonar chirp, and victory fanfare.

---

## 3. Technology Stack

- **Runtime & Language**: Node.js v24+, TypeScript 5.8+ (Strict Mode)
- **Frontend Framework**: React 19, Vite 8, Tailwind CSS v4
- **Game Engine**: Custom HTML5 Canvas 2D Delta-Time Interpolator & Particle Engine
- **Icons**: Lucide React
- **Celebration Effects**: Canvas Confetti
- **Testing & Verification**: Vitest 5.0 (Automated unit tests covering admissibility, optimality equivalence, and dynamic replanning)

---

## 4. Project File Structure

```
c:\Users\Ahmed\Downloads\DAA project\
├── src\
│   ├── algorithms\
│   │   ├── types.ts          # Core TypeScript interfaces (GridCoord, PathResult, Telemetry)
│   │   ├── minHeap.ts        # Generic binary MinHeap priority queue
│   │   ├── heuristics.ts     # Strictly admissible Manhattan, Octile, Euclidean formulas
│   │   ├── astar.ts          # Pure TypeScript A* pathfinding implementation
│   │   ├── dijkstra.ts       # Dijkstra's algorithm for mathematical comparison
│   │   └── bfs.ts            # Breadth-First Search implementation
│   ├── game\
│   │   ├── gridModel.ts      # Authoritative 2D matrix, walls, maze generator
│   │   ├── robotController.ts# State machine, sub-pixel interpolation, invalidation watcher
│   │   ├── aegisRenderer.ts  # Canvas 2D renderer, beveled tiles, Aegis-1 model, particles
│   │   └── soundEngine.ts    # Web Audio API futuristic sound synthesizer
│   ├── missions\
│   │   └── missionData.ts    # 4 disaster missions + 1 presentation demo scenario
│   ├── components\
│   │   ├── Navbar.tsx        # Top navigation & audio toggle
│   │   ├── MainMenu.tsx      # Title screen with interactive Aegis-1 radar canvas
│   │   ├── MissionSelect.tsx # Mission selection deck with 3-star ratings
│   │   ├── GameHUD.tsx       # Primary tactical commander interface & telemetry
│   │   ├── AlgorithmArena.tsx# 3-way comparative benchmark (A* vs Dijkstra vs BFS)
│   │   ├── AlgorithmAcademy.tsx # Viva study textbook & DSA theory guide
│   │   ├── PresentationMode.tsx # High-contrast 60s live classroom exhibit
│   │   └── MissionResultsModal.tsx # Victory overlay with 3-star debrief
│   ├── App.tsx               # Master state & screen router
│   ├── main.tsx              # React DOM entry point
│   └── index.css             # Tailwind v4 import & game styling
├── tests\
│   ├── minHeap.test.ts       # Binary heap priority queue tests
│   ├── heuristics.test.ts    # Admissibility & distance correctness tests
│   └── astar.test.ts         # Pathfinding, wall avoidance, corner-cutting, replanning tests
├── DEMO_GUIDE.md             # Step-by-step classroom presentation script & viva Q&A
├── PROJECT_STATUS.md         # Implementation status & verification log
└── package.json
```

---

## 5. Local Execution Instructions (Windows Compatible)

### Prerequisites
- Node.js v18 or higher installed
- npm installed

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Unit Tests
```bash
npm run test
```
All 15 test suites verify priority queue ordering, heuristic admissibility, corner-cutting prevention, dynamic replanning, and optimality equivalence against Dijkstra.

### 3. Start Development Server
```bash
npm run dev
```
Open **`http://localhost:5173/`** in any modern web browser (Chrome, Edge, Firefox, Brave).

### 4. Create Production Build
```bash
npm run build
```

---

## 6. How to Demonstrate in Class (1-Minute Quick Guide)

1. Launch `http://localhost:5173/` and click **"PRESENTATION MODE"** (or click the Presentation Mode button in the navigation bar).
2. The high-contrast auditorium screen loads the **Dynamic Rescue** scenario.
3. Click **"Deploy Robot"** — Aegis-1 computes the direct optimal route along the main transit conduit and begins moving forward with glowing thruster particles.
4. While Aegis-1 is moving, click **"TRIGGER BLOCKAGE (DYNAMIC REPLANNING)"**.
5. Observe:
   - A structural collapse blocks the main conduit.
   - Aegis-1 immediately halts safely at its current cell without clipping.
   - The status badge flashes **"PATH BLOCKED — RECALCULATING ROUTE"**.
   - A fresh A* search executes in under $1\text{ ms}$.
   - Aegis-1 turns smoothly and navigates through the upper/lower bypass conduit to complete the rescue!
