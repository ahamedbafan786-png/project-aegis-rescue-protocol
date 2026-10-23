export interface GridCoord {
  r: number;
  c: number;
}

export type TileType = 'EMPTY' | 'WALL' | 'DEBRIS' | 'ROUGH_TERRAIN' | 'START' | 'TARGET';

export type MovementMode = '4-directional' | '8-directional';

export type HeuristicType = 'manhattan' | 'octile' | 'euclidean';

export type AlgorithmType = 'astar' | 'dijkstra' | 'bfs';

export type RobotState =
  | 'IDLE'
  | 'SCANNING'
  | 'CONFIRMED'
  | 'MOVING'
  | 'BLOCKED'
  | 'REPLANNING'
  | 'ARRIVED'
  | 'FAILED';

export interface SearchStep {
  currentNode: GridCoord;
  openSetCoords: GridCoord[];
  closedSetCoords: GridCoord[];
  neighborsChecked: GridCoord[];
  g: number;
  h: number;
  f: number;
  description?: string;
}

export interface PathResult {
  path: GridCoord[];
  found: boolean;
  exploredNodes: GridCoord[];
  searchSteps: SearchStep[];
  executionTimeMs: number;
  totalCost: number;
  nodesExpandedCount: number;
  queueOperationsCount: number;
  gScores: Record<string, number>;
  hScores: Record<string, number>;
  fScores: Record<string, number>;
}

export interface AlgorithmMetrics {
  name: string;
  algorithm: AlgorithmType;
  found: boolean;
  nodesExpanded: number;
  pathLength: number;
  totalCost: number;
  executionTimeMs: number;
  queueOperations: number;
}
