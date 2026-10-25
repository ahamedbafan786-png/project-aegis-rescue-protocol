import { GridCoord, TileType } from '../algorithms/types';
import { MissionDefinition } from '../missions/missionData';

export type GameMode = 'SANDBOX' | 'CHALLENGE' | 'RESCUE' | 'PRESENTATION';

export type ToolType =
  | 'wall'
  | 'rough'
  | 'eraser'
  | 'start'
  | 'target'
  | 'demolish';

export interface EditPermissionResult {
  allowed: boolean;
  reason?: string;
  consumesCharge?: boolean;
  newTileType?: TileType;
}

/**
 * Centrally determines the authoritative game mode for a mission definition.
 */
export function getGameMode(mission: MissionDefinition): GameMode {
  if (mission.id === 'mission-sandbox') return 'SANDBOX';
  if (mission.id === 'mission-presentation') return 'PRESENTATION';
  if (mission.difficulty === 'CHALLENGE') return 'CHALLENGE';
  return 'RESCUE';
}

/**
 * Checks whether a specific grid cell is designated repairable debris in the mission definition.
 */
export function isTileDesignatedDebris(
  coord: GridCoord,
  mission: MissionDefinition
): boolean {
  if (!mission.initialDebris || mission.initialDebris.length === 0) {
    return false;
  }
  return mission.initialDebris.some((d) => d.r === coord.r && d.c === coord.c);
}

/**
 * Checks whether a tile is a protected structural wall belonging to the mission's initial geometry.
 */
export function isInitialMissionWall(
  coord: GridCoord,
  mission: MissionDefinition
): boolean {
  return mission.initialWalls.some((w) => w.r === coord.r && w.c === coord.c);
}

/**
 * Authoritative domain-layer validation for editing a tile on the grid.
 * Enforces mode-based restrictions, obstacle permissions, and repair charge rules.
 */
export function canEditTile(params: {
  tool: ToolType;
  coord: GridCoord;
  currentTile: TileType;
  mission: MissionDefinition;
  repairCharges: number;
  robotPos?: GridCoord;
}): EditPermissionResult {
  const { tool, coord, currentTile, mission, repairCharges, robotPos } = params;
  const mode = getGameMode(mission);

  // Bounds check
  if (coord.r < 0 || coord.r >= mission.rows || coord.c < 0 || coord.c >= mission.cols) {
    return { allowed: false, reason: 'OUT OF BOUNDS' };
  }

  // Objective markers check (Start / Target)
  const isStart = coord.r === mission.start.r && coord.c === mission.start.c;
  const isTarget = coord.r === mission.target.r && coord.c === mission.target.c;

  if (isStart || isTarget) {
    if (mode !== 'SANDBOX') {
      return { allowed: false, reason: 'CANNOT MODIFY MISSION OBJECTIVE MARKER' };
    }
  }

  // Robot occupancy check: cannot modify the tile the robot is physically occupying
  if (robotPos && coord.r === robotPos.r && coord.c === robotPos.c) {
    return { allowed: false, reason: 'ROBOT OCCUPYING TILE — ACTION BLOCKED' };
  }

  // 1. DEMOLITION / BREACH ACTIONS
  if (tool === 'demolish' || (mode === 'CHALLENGE' && currentTile === 'DEBRIS')) {
    if (mode === 'CHALLENGE') {
      // Ordinary structural wall check
      if (currentTile === 'WALL') {
        return {
          allowed: false,
          reason: 'STRUCTURAL WALL — CANNOT BREACH',
          consumesCharge: false,
        };
      }

      // Already cleared check
      if (currentTile === 'EMPTY') {
        return {
          allowed: false,
          reason: 'DEBRIS ALREADY CLEARED',
          consumesCharge: false,
        };
      }

      // Check if designated debris
      const isDesignated = isTileDesignatedDebris(coord, mission) || currentTile === 'DEBRIS';
      if (!isDesignated) {
        return {
          allowed: false,
          reason: 'STRUCTURAL WALL — CANNOT BREACH',
          consumesCharge: false,
        };
      }

      // Check repair charge availability
      if (repairCharges <= 0) {
        return {
          allowed: false,
          reason: 'ZERO REPAIR CHARGES — CONSERVE CHARGES OR DETOUR',
          consumesCharge: false,
        };
      }

      // Approved demolition of designated debris
      return {
        allowed: true,
        newTileType: 'EMPTY',
        consumesCharge: true,
      };
    }

    if (mode === 'SANDBOX') {
      return {
        allowed: true,
        newTileType: 'EMPTY',
        consumesCharge: false,
      };
    }

    // Rescue mode has no demolition charges
    return {
      allowed: false,
      reason: 'STRUCTURAL WALL — CANNOT BREACH',
      consumesCharge: false,
    };
  }

  // 2. ERASER TOOL
  if (tool === 'eraser') {
    if (mode === 'CHALLENGE') {
      return {
        allowed: false,
        reason: 'ERASER UNAVAILABLE IN CHALLENGE MODE',
      };
    }

    if (mode === 'RESCUE') {
      // In rescue missions, cannot erase protected initial geometry
      if (isInitialMissionWall(coord, mission) || isTileDesignatedDebris(coord, mission)) {
        return {
          allowed: false,
          reason: 'MISSION GEOMETRY PROTECTED',
        };
      }
      return {
        allowed: true,
        newTileType: 'EMPTY',
        consumesCharge: false,
      };
    }

    // Sandbox is unrestricted
    return {
      allowed: true,
      newTileType: 'EMPTY',
      consumesCharge: false,
    };
  }

  // 3. WALL AND ROUGH TERRAIN PLACEMENT
  if (tool === 'wall' || tool === 'rough') {
    if (mode === 'CHALLENGE') {
      return {
        allowed: false,
        reason: 'TERRAIN EDITING UNAVAILABLE IN CHALLENGE MODE',
      };
    }

    return {
      allowed: true,
      newTileType: tool === 'wall' ? 'WALL' : 'ROUGH_TERRAIN',
      consumesCharge: false,
    };
  }

  // 4. OBJECTIVE RELOCATION (Start / Target)
  if (tool === 'start' || tool === 'target') {
    if (mode !== 'SANDBOX') {
      return {
        allowed: false,
        reason: 'MISSION OBJECTIVES LOCKED',
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Authoritative check for "Clear All Obstacles".
 * Only Sandbox Lab may clear all obstacles.
 */
export function canClearObstacles(mission: MissionDefinition): EditPermissionResult {
  const mode = getGameMode(mission);
  if (mode !== 'SANDBOX') {
    return {
      allowed: false,
      reason: 'MISSION PROTECTED — CANNOT CLEAR GEOMETRY',
    };
  }
  return { allowed: true };
}

/**
 * Authoritative check for "Generate Maze" and "Random Obstacles".
 * Only Sandbox Lab may regenerate topology.
 */
export function canGenerateTopology(mission: MissionDefinition): EditPermissionResult {
  const mode = getGameMode(mission);
  if (mode !== 'SANDBOX') {
    return {
      allowed: false,
      reason: 'MISSION PROTECTED — TOPOLOGY LOCKED',
    };
  }
  return { allowed: true };
}
