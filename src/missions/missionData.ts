import { GridCoord, TileType } from '../algorithms/types';

export interface MissionDefinition {
  id: string;
  title: string;
  codename: string;
  subtitle: string;
  briefing: string;
  difficulty: 'CADET' | 'TACTICAL' | 'EXPERT' | 'PRESENTATION' | 'CHALLENGE';
  rows: number;
  cols: number;
  start: GridCoord;
  target: GridCoord;
  initialWalls: GridCoord[];
  initialRoughTerrain?: GridCoord[];
  initialDebris?: GridCoord[];
  repairCharges?: number;
  targetStepsForStar3: number;
  environmentTheme: 'training' | 'facility' | 'canyon' | 'maze' | 'presentation';
  badgeLabel: string;
  demoBlockageCoord?: GridCoord;
}

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'mission-1',
    title: 'Neon Training Grounds',
    codename: 'PROTOCOL ALPHA',
    subtitle: 'Basic Orientation & Obstacle Avoidance',
    briefing: 'Cadet unit Aegis-1 must establish a direct route to the stranded beacon. Navigate around the primary training barrier and avoid unnecessary detours.',
    difficulty: 'CADET',
    rows: 12,
    cols: 18,
    start: { r: 2, c: 2 },
    target: { r: 9, c: 15 },
    targetStepsForStar3: 24,
    environmentTheme: 'training',
    badgeLabel: 'SECTOR 01',
    initialWalls: [
      // Central vertical barrier with upper and lower gap
      { r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 },
      { r: 5, c: 8 }, { r: 6, c: 8 }, { r: 7, c: 8 },
      { r: 8, c: 8 },
      // Secondary minor obstacles
      { r: 4, c: 12 }, { r: 5, c: 12 },
    ],
  },
  {
    id: 'mission-2',
    title: 'Collapsed Research Facility',
    codename: 'SECTOR QUARANTINE',
    subtitle: 'Corridors, Debris & Alternate Routes',
    briefing: 'Structural breach detected in Sub-level 4. Standard access corridors are collapsed with heavy debris. Calculate safe passage through surviving blast chambers.',
    difficulty: 'TACTICAL',
    rows: 14,
    cols: 20,
    start: { r: 1, c: 2 },
    target: { r: 12, c: 17 },
    targetStepsForStar3: 32,
    environmentTheme: 'facility',
    badgeLabel: 'SECTOR 04',
    initialWalls: [
      // Outer chamber walls
      { r: 3, c: 1 }, { r: 3, c: 2 }, { r: 3, c: 3 }, { r: 3, c: 4 }, { r: 3, c: 5 }, { r: 3, c: 6 },
      { r: 3, c: 9 }, { r: 3, c: 10 }, { r: 3, c: 11 }, { r: 3, c: 12 }, { r: 3, c: 13 }, { r: 3, c: 14 },
      // Vertical dividers
      { r: 4, c: 6 }, { r: 5, c: 6 }, { r: 6, c: 6 }, { r: 7, c: 6 },
      { r: 7, c: 9 }, { r: 8, c: 9 }, { r: 9, c: 9 }, { r: 10, c: 9 },
      // Lower chamber
      { r: 10, c: 1 }, { r: 10, c: 2 }, { r: 10, c: 3 }, { r: 10, c: 4 }, { r: 10, c: 5 },
      { r: 8, c: 13 }, { r: 8, c: 14 }, { r: 8, c: 15 }, { r: 8, c: 16 }, { r: 8, c: 17 },
      { r: 10, c: 13 }, { r: 11, c: 13 },
    ],
  },
  {
    id: 'mission-3',
    title: 'Crystal Canyon',
    codename: 'MINERAL OVERRIDE',
    subtitle: 'High-Friction Terrain Navigation',
    briefing: 'The canyon basin is choked with high-density crystalline fields. Rough terrain increases traversal energy cost (3x). A* will evaluate whether to detour or power through.',
    difficulty: 'EXPERT',
    rows: 14,
    cols: 22,
    start: { r: 1, c: 1 },
    target: { r: 12, c: 20 },
    targetStepsForStar3: 36,
    environmentTheme: 'canyon',
    badgeLabel: 'CANYON-X',
    initialWalls: [
      // Ridges
      { r: 3, c: 3 }, { r: 4, c: 3 }, { r: 5, c: 3 }, { r: 6, c: 3 },
      { r: 8, c: 7 }, { r: 9, c: 7 }, { r: 10, c: 7 },
      { r: 2, c: 14 }, { r: 3, c: 14 }, { r: 4, c: 14 }, { r: 5, c: 14 },
      { r: 7, c: 17 }, { r: 8, c: 17 }, { r: 9, c: 17 }, { r: 10, c: 17 },
    ],
    initialRoughTerrain: [
      // High-cost crystal fields
      { r: 5, c: 8 }, { r: 5, c: 9 }, { r: 5, c: 10 }, { r: 5, c: 11 }, { r: 5, c: 12 },
      { r: 6, c: 8 }, { r: 6, c: 9 }, { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 },
      { r: 7, c: 8 }, { r: 7, c: 9 }, { r: 7, c: 10 }, { r: 7, c: 11 }, { r: 7, c: 12 },
    ],
  },
  {
    id: 'mission-4',
    title: 'The Maze Protocol',
    codename: 'NEURAL LABYRINTH',
    subtitle: 'Complex Algorithmic Pruning Challenge',
    briefing: 'Deep within the mainframe grid, a convoluted labyrinth tests the heuristic pruning efficiency of A*. Observe how directed search dramatically outpaces unguided expansion.',
    difficulty: 'EXPERT',
    rows: 15,
    cols: 25,
    start: { r: 1, c: 1 },
    target: { r: 13, c: 23 },
    targetStepsForStar3: 45,
    environmentTheme: 'maze',
    badgeLabel: 'LABYRINTH',
    initialWalls: [
      // Maze spines
      { r: 1, c: 3 }, { r: 2, c: 3 }, { r: 3, c: 3 }, { r: 4, c: 3 }, { r: 5, c: 3 }, { r: 6, c: 3 },
      { r: 8, c: 3 }, { r: 9, c: 3 }, { r: 10, c: 3 }, { r: 11, c: 3 }, { r: 12, c: 3 }, { r: 13, c: 3 },
      // Wall 2
      { r: 3, c: 6 }, { r: 4, c: 6 }, { r: 5, c: 6 }, { r: 6, c: 6 }, { r: 7, c: 6 }, { r: 8, c: 6 }, { r: 9, c: 6 }, { r: 10, c: 6 }, { r: 11, c: 6 },
      // Wall 3
      { r: 1, c: 9 }, { r: 2, c: 9 }, { r: 3, c: 9 }, { r: 4, c: 9 }, { r: 5, c: 9 }, { r: 6, c: 9 },
      { r: 9, c: 9 }, { r: 10, c: 9 }, { r: 11, c: 9 }, { r: 12, c: 9 }, { r: 13, c: 9 },
      // Wall 4
      { r: 3, c: 13 }, { r: 4, c: 13 }, { r: 5, c: 13 }, { r: 6, c: 13 }, { r: 7, c: 13 }, { r: 8, c: 13 }, { r: 9, c: 13 }, { r: 10, c: 13 }, { r: 11, c: 13 },
      // Wall 5
      { r: 1, c: 17 }, { r: 2, c: 17 }, { r: 3, c: 17 }, { r: 4, c: 17 }, { r: 5, c: 17 }, { r: 6, c: 17 },
      { r: 8, c: 17 }, { r: 9, c: 17 }, { r: 10, c: 17 }, { r: 11, c: 17 }, { r: 12, c: 17 }, { r: 13, c: 17 },
      // Wall 6
      { r: 3, c: 20 }, { r: 4, c: 20 }, { r: 5, c: 20 }, { r: 6, c: 20 }, { r: 7, c: 20 }, { r: 8, c: 20 }, { r: 9, c: 20 }, { r: 10, c: 20 },
    ],
  },
  {
    id: 'mission-presentation',
    title: 'Dynamic Rescue (Live College Demo)',
    codename: 'VIVA EXHIBIT',
    subtitle: 'Real-Time Mid-Transit Replanning Showcase',
    briefing: 'Designed specifically for rapid classroom demonstration. Deploy Aegis-1 along the main transit conduit, then trigger an emergency structural collapse. Watch the robot instantly detect the obstruction, halt safely, compute an alternate optimal path, and reach the stranded survivor.',
    difficulty: 'PRESENTATION',
    rows: 11,
    cols: 21,
    start: { r: 5, c: 2 },
    target: { r: 5, c: 18 },
    targetStepsForStar3: 25,
    environmentTheme: 'presentation',
    badgeLabel: 'DEMO PROTOCOL',
    demoBlockageCoord: { r: 5, c: 10 }, // Directly blocks highway ahead of Aegis-1
    initialWalls: [
      // Top divider wall with intentional bypass openings at col 7 and col 14 into row 3
      { r: 4, c: 4 }, { r: 4, c: 5 }, { r: 4, c: 6 },
      { r: 4, c: 8 }, { r: 4, c: 9 }, { r: 4, c: 10 }, { r: 4, c: 11 }, { r: 4, c: 12 }, { r: 4, c: 13 },
      { r: 4, c: 15 },
      // Bottom divider wall separating main highway from lower corridor
      { r: 6, c: 4 }, { r: 6, c: 5 }, { r: 6, c: 6 }, { r: 6, c: 7 }, { r: 6, c: 8 }, { r: 6, c: 9 },
      { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 }, { r: 6, c: 14 }, { r: 6, c: 15 },
      // Outer barrier bounds for aesthetic structure
      { r: 1, c: 8 }, { r: 1, c: 9 }, { r: 1, c: 10 }, { r: 1, c: 11 }, { r: 1, c: 12 },
      { r: 9, c: 8 }, { r: 9, c: 9 }, { r: 9, c: 10 }, { r: 9, c: 11 }, { r: 9, c: 12 },
    ],
  },
  {
    id: 'mission-challenge-1',
    title: 'Corridor Control: Breach & Clear',
    codename: 'CONDUIT BREACH',
    subtitle: 'Tactical Resource Management & Debris Clearance',
    briefing: 'Heavy structural blast doors and debris choke the primary conduit. You have 2 Emergency Repair Charges. Decide whether to expend charges to blast open the direct corridor (16 steps) or conserve them and let A* navigate the 28-step rough terrain detour.',
    difficulty: 'CHALLENGE',
    rows: 11,
    cols: 21,
    start: { r: 5, c: 2 },
    target: { r: 5, c: 18 },
    repairCharges: 2,
    targetStepsForStar3: 18,
    environmentTheme: 'facility',
    badgeLabel: 'CHALLENGE 01',
    initialDebris: [
      { r: 5, c: 8 },
      { r: 5, c: 12 },
    ],
    initialWalls: [
      // Top divider wall with access into row 2
      { r: 4, c: 4 }, { r: 4, c: 5 }, { r: 4, c: 6 },
      { r: 4, c: 8 }, { r: 4, c: 9 }, { r: 4, c: 10 }, { r: 4, c: 11 }, { r: 4, c: 12 }, { r: 4, c: 13 },
      { r: 4, c: 15 },
      // Bottom divider wall (sealed lower quadrant)
      { r: 6, c: 4 }, { r: 6, c: 5 }, { r: 6, c: 6 }, { r: 6, c: 7 }, { r: 6, c: 8 }, { r: 6, c: 9 },
      { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 }, { r: 6, c: 14 }, { r: 6, c: 15 },
      { r: 6, c: 16 },
      { r: 7, c: 4 }, { r: 7, c: 16 },
      { r: 8, c: 4 }, { r: 8, c: 5 }, { r: 8, c: 6 }, { r: 8, c: 7 }, { r: 8, c: 8 }, { r: 8, c: 9 },
      { r: 8, c: 10 }, { r: 8, c: 11 }, { r: 8, c: 12 }, { r: 8, c: 13 }, { r: 8, c: 14 }, { r: 8, c: 15 },
      { r: 8, c: 16 },
    ],
    initialRoughTerrain: [
      // Upper detour field
      { r: 2, c: 8 }, { r: 2, c: 9 }, { r: 2, c: 10 }, { r: 2, c: 11 }, { r: 2, c: 12 },
      { r: 3, c: 8 }, { r: 3, c: 9 }, { r: 3, c: 10 }, { r: 3, c: 11 }, { r: 3, c: 12 },
    ],
  },
  {
    id: 'mission-challenge-2',
    title: 'Deep Vault Quarantine',
    codename: 'BULKHEAD OVERRIDE',
    subtitle: 'Dual-Junction Breaching Strategy',
    briefing: 'Sub-level quarantine sealed two primary security bulkheads. With 2 demolition charges, strategically breach the debris to establish an optimal direct route through the mineral canyon before survivor life support terminates.',
    difficulty: 'CHALLENGE',
    rows: 13,
    cols: 23,
    start: { r: 2, c: 2 },
    target: { r: 10, c: 20 },
    repairCharges: 2,
    targetStepsForStar3: 22,
    environmentTheme: 'canyon',
    badgeLabel: 'CHALLENGE 02',
    initialDebris: [
      { r: 6, c: 7 },
      { r: 6, c: 15 },
    ],
    initialWalls: [
      // Vertical barrier 1
      { r: 2, c: 7 }, { r: 3, c: 7 }, { r: 4, c: 7 }, { r: 5, c: 7 },
      { r: 7, c: 7 }, { r: 8, c: 7 }, { r: 9, c: 7 },
      // Vertical barrier 2
      { r: 3, c: 15 }, { r: 4, c: 15 }, { r: 5, c: 15 },
      { r: 7, c: 15 }, { r: 8, c: 15 }, { r: 9, c: 15 }, { r: 10, c: 15 },
    ],
    initialRoughTerrain: [
      { r: 1, c: 10 }, { r: 1, c: 11 }, { r: 1, c: 12 },
      { r: 11, c: 10 }, { r: 11, c: 11 }, { r: 11, c: 12 },
    ],
  },
];
