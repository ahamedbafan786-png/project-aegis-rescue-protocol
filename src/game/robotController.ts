import { coordKey } from '../algorithms/astar';
import { GridCoord, RobotState } from '../algorithms/types';
import { sound } from './soundEngine';

export interface RobotTelemetry {
  currentLogicalCoord: GridCoord;
  visualX: number;
  visualY: number;
  visualAngle: number;
  state: RobotState;
  remainingSteps: number;
  totalStepsTaken: number;
  executedCost: number;
  remainingCost: number;
  initialPlannedCost: number;
  totalMissionCost: number;
  replansCount: number;
  statusMessage: string;
}

export class RobotController {
  public logicalPos: GridCoord;
  public visualX: number;
  public visualY: number;
  public visualAngle: number; // In radians

  public state: RobotState = 'IDLE';
  public path: GridCoord[] = [];
  public currentWaypointIndex: number = 0;

  public transitionProgress: number = 0; // 0.0 to 1.0 between current and next waypoint
  public speedTilesPerSec: number = 3.5;

  public replansCount: number = 0;
  public stepsTaken: number = 0;
  public executedCost: number = 0;
  public remainingCost: number = 0;
  public initialPlannedCost: number = 0;
  public statusMessage: string = 'SYSTEM STANDBY';

  // Dynamic step cost callback for weighted/diagonal terrain
  public stepCostFn?: (from: GridCoord, to: GridCoord) => number;

  // Callbacks
  public onStateChange?: (state: RobotState, msg: string) => void;
  public onArrived?: () => void;
  public onBlocked?: () => void;

  constructor(initialCoord: GridCoord) {
    this.logicalPos = { ...initialCoord };
    this.visualX = initialCoord.c;
    this.visualY = initialCoord.r;
    this.visualAngle = 0;
  }

  public reset(coord: GridCoord): void {
    this.logicalPos = { ...coord };
    this.visualX = coord.c;
    this.visualY = coord.r;
    this.visualAngle = 0;
    this.state = 'IDLE';
    this.path = [];
    this.currentWaypointIndex = 0;
    this.transitionProgress = 0;
    this.replansCount = 0;
    this.stepsTaken = 0;
    this.executedCost = 0;
    this.remainingCost = 0;
    this.initialPlannedCost = 0;
    this.statusMessage = 'SYSTEM STANDBY';
    this.onStateChange?.(this.state, this.statusMessage);
  }

  public setPath(newPath: GridCoord[], routeCost?: number): void {
    if (newPath.length === 0) {
      this.state = 'FAILED';
      this.statusMessage = 'NO SAFE ROUTE AVAILABLE';
      sound.playFailed();
      this.onStateChange?.(this.state, this.statusMessage);
      return;
    }

    this.path = [...newPath];
    this.currentWaypointIndex = 0;
    this.transitionProgress = 0;

    const cost = routeCost ?? Math.max(0, newPath.length - 1);
    if (this.stepsTaken === 0) {
      this.initialPlannedCost = cost;
    }
    this.remainingCost = cost;

    this.state = 'CONFIRMED';
    this.statusMessage = 'ROUTE LOCKED — READY TO DEPLOY';
    sound.playRouteFound();
    this.onStateChange?.(this.state, this.statusMessage);
  }

  public startMoving(): void {
    if (this.path.length <= 1) {
      if (this.path.length === 1 && this.logicalPos.r === this.path[0].r && this.logicalPos.c === this.path[0].c) {
        this.state = 'ARRIVED';
        this.statusMessage = 'TARGET REACHED';
        sound.playVictory();
        this.onArrived?.();
        this.onStateChange?.(this.state, this.statusMessage);
      }
      return;
    }
    this.state = 'MOVING';
    this.statusMessage = 'TRANSITING TO TARGET';
    sound.playDeploy();
    this.onStateChange?.(this.state, this.statusMessage);
  }

  public pause(): void {
    if (this.state === 'MOVING') {
      this.state = 'IDLE';
      this.statusMessage = 'SIMULATION PAUSED';
      this.onStateChange?.(this.state, this.statusMessage);
    }
  }

  public resume(): void {
    if (this.state === 'IDLE' && this.path.length > 0) {
      this.state = 'MOVING';
      this.statusMessage = 'TRANSITING TO TARGET';
      this.onStateChange?.(this.state, this.statusMessage);
    }
  }

  /**
   * Evaluates if any upcoming waypoint in the planned path is blocked.
   * If blocked, immediately halts at current safe integer cell and triggers replanning.
   */
  public checkPathBlocked(isBlockedFn: (r: number, c: number) => boolean): boolean {
    if (this.state !== 'MOVING' && this.state !== 'CONFIRMED') {
      return false;
    }

    const remainingWaypoints = this.path.slice(this.currentWaypointIndex);
    let blockedFound = false;

    for (let i = 0; i < remainingWaypoints.length; i++) {
      const wp = remainingWaypoints[i];
      if (isBlockedFn(wp.r, wp.c)) {
        blockedFound = true;
        break;
      }
    }

    if (blockedFound) {
      // Immediate halt at current valid grid location to prevent clipping/teleportation
      this.state = 'BLOCKED';
      this.replansCount++;
      this.statusMessage = 'PATH BLOCKED — RECALCULATING ROUTE';
      sound.playBlockedAlert();
      this.onStateChange?.(this.state, this.statusMessage);
      this.onBlocked?.();
      return true;
    }

    return false;
  }

  /**
   * Delta-time update step for smooth 60 FPS sub-pixel interpolation
   */
  public update(deltaSec: number, speedMultiplier: number): void {
    if (this.state !== 'MOVING' || this.path.length === 0) {
      return;
    }

    // Instant mode
    if (speedMultiplier >= 100) {
      while (this.currentWaypointIndex < this.path.length - 1) {
        const cur = this.path[this.currentWaypointIndex];
        const nxt = this.path[this.currentWaypointIndex + 1];
        const cost = this.stepCostFn ? this.stepCostFn(cur, nxt) : 1.0;
        this.executedCost += cost;
        this.stepsTaken++;
        this.currentWaypointIndex++;
      }
      this.remainingCost = 0;
      const finalWp = this.path[this.path.length - 1];
      this.logicalPos = { ...finalWp };
      this.visualX = finalWp.c;
      this.visualY = finalWp.r;
      this.state = 'ARRIVED';
      this.statusMessage = 'RESCUE COMPLETE';
      sound.playVictory();
      this.onArrived?.();
      this.onStateChange?.(this.state, this.statusMessage);
      return;
    }

    if (this.currentWaypointIndex >= this.path.length - 1) {
      // Reached destination!
      this.state = 'ARRIVED';
      this.statusMessage = 'RESCUE COMPLETE';
      sound.playVictory();
      this.onArrived?.();
      this.onStateChange?.(this.state, this.statusMessage);
      return;
    }

    const currentWp = this.path[this.currentWaypointIndex];
    const nextWp = this.path[this.currentWaypointIndex + 1];

    // Compute target angle towards next waypoint
    const targetAngle = Math.atan2(nextWp.r - currentWp.r, nextWp.c - currentWp.c);
    this.visualAngle = this.lerpAngle(this.visualAngle, targetAngle, Math.min(1.0, deltaSec * 15.0));

    // Advance along the segment
    const effectiveSpeed = this.speedTilesPerSec * speedMultiplier;
    this.transitionProgress += effectiveSpeed * deltaSec;

    if (this.transitionProgress >= 1.0) {
      // Completed step to next waypoint
      this.transitionProgress = 0;
      const cost = this.stepCostFn ? this.stepCostFn(currentWp, nextWp) : 1.0;
      this.executedCost += cost;
      this.remainingCost = Math.max(0, this.remainingCost - cost);
      this.currentWaypointIndex++;
      this.logicalPos = { ...nextWp };
      this.visualX = nextWp.c;
      this.visualY = nextWp.r;
      this.stepsTaken++;
      sound.playStep();

      // Check if this was the final waypoint
      if (this.currentWaypointIndex >= this.path.length - 1) {
        this.remainingCost = 0;
        this.state = 'ARRIVED';
        this.statusMessage = 'RESCUE COMPLETE';
        sound.playVictory();
        this.onArrived?.();
        this.onStateChange?.(this.state, this.statusMessage);
      }
    } else {
      // Smooth sub-pixel visual position
      this.visualX = currentWp.c + (nextWp.c - currentWp.c) * this.transitionProgress;
      this.visualY = currentWp.r + (nextWp.r - currentWp.r) * this.transitionProgress;
    }
  }

  private lerpAngle(from: number, to: number, t: number): number {
    let diff = to - from;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return from + diff * t;
  }

  public getTelemetry(): RobotTelemetry {
    return {
      currentLogicalCoord: { ...this.logicalPos },
      visualX: this.visualX,
      visualY: this.visualY,
      visualAngle: this.visualAngle,
      state: this.state,
      remainingSteps: Math.max(0, this.path.length - 1 - this.currentWaypointIndex),
      totalStepsTaken: this.stepsTaken,
      executedCost: this.executedCost,
      remainingCost: this.remainingCost,
      initialPlannedCost: this.initialPlannedCost,
      totalMissionCost: this.executedCost + this.remainingCost,
      replansCount: this.replansCount,
      statusMessage: this.statusMessage,
    };
  }
}
