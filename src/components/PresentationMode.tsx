import React, { useState, useEffect, useRef } from 'react';
import {
  AlertOctagon,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileText,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { findPathAStar, isTileBlocked, getTileMovementCost } from '../algorithms/astar';
import { GridCoord, RobotState } from '../algorithms/types';
import { AegisRenderer } from '../game/aegisRenderer';
import { GridModel } from '../game/gridModel';
import { RobotController } from '../game/robotController';
import { sound } from '../game/soundEngine';
import { MISSIONS } from '../missions/missionData';

interface PresentationModeProps {
  onExit: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({ onExit }) => {
  const mission = MISSIONS.find((m) => m.id === 'mission-presentation') || MISSIONS[0];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<AegisRenderer | null>(null);

  const [gridModel, setGridModel] = useState<GridModel>(() => {
    const model = new GridModel(mission.rows, mission.cols, mission.start, mission.target);
    mission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    return model;
  });

  const robotRef = useRef<RobotController>(new RobotController(mission.start));

  const [robotState, setRobotState] = useState<RobotState>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('EXHIBIT READY — PRESS DEPLOY');
  const [activePath, setActivePath] = useState<GridCoord[]>([]);
  // Presenter script collapsed by default per specification
  const [showPresenterNotes, setShowPresenterNotes] = useState<boolean>(false);

  const [telemetry, setTelemetry] = useState({
    r: mission.start.r,
    c: mission.start.c,
    nodesExpanded: 0,
    pathCost: 0,
    stepsTaken: 0,
    executedCost: 0,
    remainingCost: 0,
    totalMissionCost: 0,
    replans: 0,
    runtimeMs: 0,
  });

  // Dynamic step cost callback
  useEffect(() => {
    const robot = robotRef.current;
    robot.stepCostFn = (from, to) => {
      const isDiag = from.r !== to.r && from.c !== to.c;
      const tile = gridModel.tiles[to.r][to.c];
      const weight = getTileMovementCost(tile);
      return isDiag ? weight * Math.SQRT2 : weight;
    };
  }, [gridModel]);

  // Calculate Initial Path
  const computeRoute = (startCoord: GridCoord) => {
    const res = findPathAStar({
      grid: gridModel.tiles,
      rows: gridModel.rows,
      cols: gridModel.cols,
      start: startCoord,
      goal: gridModel.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });

    setActivePath(res.path);
    if (rendererRef.current) {
      rendererRef.current.highlightedExplored.clear();
      res.exploredNodes.forEach((c) => rendererRef.current?.highlightedExplored.add(`${c.r},${c.c}`));
    }

    setTelemetry((prev) => ({
      ...prev,
      nodesExpanded: res.nodesExpandedCount,
      pathCost: res.totalCost,
      runtimeMs: res.executionTimeMs,
    }));

    return res;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new AegisRenderer(canvas);
    rendererRef.current = renderer;

    const handleResize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        renderer.resize(rect.width, rect.height, gridModel.rows, gridModel.cols);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const initialPlan = computeRoute(gridModel.start);
    robotRef.current.setPath(initialPlan.path, initialPlan.totalCost);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 60 FPS Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const deltaSec = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const robot = robotRef.current;
      robot.update(deltaSec, 1.25); // Comfortable presentation speed

      if (robot.state === 'ARRIVED' && robotState !== 'ARRIVED') {
        setRobotState('ARRIVED');
        setStatusMessage('MISSION ACCOMPLISHED');
        rendererRef.current?.addArrivalBurst(gridModel.target.r, gridModel.target.c);
      }

      if (rendererRef.current) {
        rendererRef.current.render(gridModel, robot, activePath, deltaSec, 'facility');
      }

      const tel = robot.getTelemetry();
      setTelemetry((prev) => ({
        ...prev,
        r: tel.currentLogicalCoord.r,
        c: tel.currentLogicalCoord.c,
        replans: tel.replansCount,
        stepsTaken: tel.totalStepsTaken,
        executedCost: tel.executedCost,
        remainingCost: tel.remainingCost,
        totalMissionCost: tel.totalMissionCost,
      }));

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gridModel, activePath, robotState]);

  // Set up robot callbacks
  useEffect(() => {
    const robot = robotRef.current;
    robot.onStateChange = (state, msg) => {
      setRobotState(state);
      setStatusMessage(msg);
    };

    robot.onBlocked = () => {
      const currentValid = robot.logicalPos;
      const newPlan = computeRoute(currentValid);

      if (newPlan.found) {
        robot.setPath(newPlan.path, newPlan.totalCost);
        robot.startMoving();
      } else {
        robot.state = 'FAILED';
        robot.statusMessage = 'NO SAFE ROUTE AVAILABLE';
        setRobotState('FAILED');
        setStatusMessage('NO SAFE ROUTE AVAILABLE');
        sound.playFailed();
      }
    };
  }, [gridModel]);

  const handleDeploy = () => {
    sound.playClick();
    const robot = robotRef.current;
    if (robot.state === 'IDLE' || robot.state === 'CONFIRMED') {
      const res = computeRoute(robot.logicalPos);
      robot.setPath(res.path, res.totalCost);
      robot.startMoving();
    } else if (robot.state === 'MOVING') {
      robot.pause();
    } else if (robot.state === 'ARRIVED' || robot.state === 'FAILED') {
      handleReset();
    }
  };

  const handleReset = () => {
    sound.playClick();
    const next = new GridModel(mission.rows, mission.cols, mission.start, mission.target);
    mission.initialWalls.forEach((w) => next.setTile(w.r, w.c, 'WALL'));
    setGridModel(next);

    const robot = robotRef.current;
    robot.reset(mission.start);
    const res = findPathAStar({
      grid: next.tiles,
      rows: next.rows,
      cols: next.cols,
      start: mission.start,
      goal: mission.target,
      movementMode: '4-directional',
      heuristicType: 'manhattan',
    });
    setActivePath(res.path);
    robot.setPath(res.path, res.totalCost);
    setRobotState('IDLE');
    setStatusMessage('EXHIBIT READY — PRESS DEPLOY');
  };

  // Reliable ahead-cell dynamic blockage trigger
  const handleTriggerBlockage = () => {
    const robot = robotRef.current;
    if (robot.state !== 'MOVING' && robot.state !== 'CONFIRMED' && robot.state !== 'IDLE') {
      return;
    }

    const remaining = robot.path.slice(robot.currentWaypointIndex + 1);
    if (remaining.length === 0) {
      setStatusMessage('TARGET REACHED — NO AHEAD CELLS TO BLOCK');
      return;
    }

    let blockCoord: GridCoord | null = null;

    // Check if preset demo blockage coordinate (5, 11) is ahead in remaining waypoints
    if (
      mission.demoBlockageCoord &&
      remaining.some(
        (wp) => wp.r === mission.demoBlockageCoord!.r && wp.c === mission.demoBlockageCoord!.c
      ) &&
      !isTileBlocked(gridModel.tiles[mission.demoBlockageCoord.r][mission.demoBlockageCoord.c])
    ) {
      blockCoord = mission.demoBlockageCoord;
    } else {
      // Pick 2 steps ahead (or 1 step ahead), avoiding goal destination
      const candidateIdx = remaining.length > 2 ? 2 : (remaining.length > 1 ? 1 : 0);
      const candidate = remaining[candidateIdx];
      if (candidate.r !== gridModel.target.r || candidate.c !== gridModel.target.c) {
        blockCoord = candidate;
      } else if (remaining.length > 1) {
        blockCoord = remaining[0];
      }
    }

    if (!blockCoord || (blockCoord.r === gridModel.target.r && blockCoord.c === gridModel.target.c)) {
      setStatusMessage('TARGET REACHED — CANNOT BLOCK DESTINATION');
      return;
    }

    const nextModel = gridModel.clone();
    nextModel.setTile(blockCoord.r, blockCoord.c, 'WALL');
    setGridModel(nextModel);

    // Particle dust & visual storytelling in renderer
    rendererRef.current?.addDustParticles(blockCoord.r, blockCoord.c, 14);
    rendererRef.current?.triggerBlockageVisual(blockCoord, activePath, robot.logicalPos);

    robot.checkPathBlocked((r, c) => isTileBlocked(nextModel.tiles[r][c]));
  };

  const canTriggerBlockage =
    (robotState === 'MOVING' || robotState === 'CONFIRMED' || robotState === 'IDLE') &&
    activePath.length > robotRef.current.currentWaypointIndex + 1;

  return (
    <div className="flex-1 w-full bg-[#151F36] text-[#F5F7FF] flex flex-col select-none overflow-hidden">
      {/* Top Presentation Bar */}
      <div className="bg-[#1C2844] border-b border-[#2B3B5B] px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => {
              sound.playClick();
              onExit();
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-[#A1ADC7] hover:text-[#F5F7FF] px-2.5 py-1.5 rounded-lg bg-[#151F36] border border-[#2B3B5B] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit Presentation</span>
          </button>

          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-[#FF9B83] tracking-widest uppercase block">
              COLLEGE DEMONSTRATION EXHIBIT
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-[#F5F7FF] leading-tight">
              Autonomous Robot Path Planning · Live A* Replanning
            </h2>
          </div>
        </div>

        {/* Dynamic Status Pill & Script Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowPresenterNotes((v) => !v)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
              showPresenterNotes
                ? 'bg-[#66DAD5]/20 border-[#66DAD5] text-[#66DAD5]'
                : 'bg-[#151F36] border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Presenter Notes</span>
          </button>

          <div
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 border shadow-md ${
              robotState === 'MOVING'
                ? 'bg-[#86E3B4]/20 border-[#86E3B4]/60 text-[#86E3B4]'
                : robotState === 'BLOCKED' || robotState === 'REPLANNING'
                ? 'bg-[#FF9B83]/25 border-[#FF9B83]/80 text-[#FF9B83] animate-pulse'
                : robotState === 'ARRIVED'
                ? 'bg-[#F5CF79]/20 border-[#F5CF79]/60 text-[#F5CF79]'
                : 'bg-[#66DAD5]/20 border-[#66DAD5]/60 text-[#66DAD5]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                robotState === 'MOVING'
                  ? 'bg-[#86E3B4] animate-ping'
                  : robotState === 'BLOCKED'
                  ? 'bg-[#FF9B83]'
                  : 'bg-[#66DAD5]'
              }`}
            />
            {statusMessage}
          </div>
        </div>
      </div>

      {/* Main Full-Scale Canvas */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#151F36]">
        <div className="flex-1 flex items-center justify-center p-3 sm:p-5">
          <canvas ref={canvasRef} className="max-w-full max-h-full rounded-2xl shadow-2xl" />
        </div>

        {/* Presenter Cue Card Drawer (Toggled On Demand) */}
        {showPresenterNotes && (
          <div className="absolute top-4 left-6 max-w-sm bg-[#1C2844]/95 border border-[#3E527D] backdrop-blur-md rounded-2xl p-4 shadow-2xl z-30 text-xs space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#2B3B5B] pb-2">
              <span className="font-bold text-[#66DAD5] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                Presenter Script (60s Viva Demonstration)
              </span>
              <button
                onClick={() => setShowPresenterNotes(false)}
                className="text-[#A1ADC7] hover:text-[#F5F7FF]"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-[#A1ADC7] leading-relaxed">
              <li>
                Click <strong className="text-[#66DAD5]">Deploy Robot</strong> — A* calculates the optimal direct route along the main corridor.
              </li>
              <li>
                While Aegis-1 is moving, click <strong className="text-[#FF9B83]">TRIGGER BLOCKAGE</strong> to simulate an emergency structural collapse.
              </li>
              <li>
                Point out to the lecturer: <strong className="text-[#F5F7FF]">Aegis-1 detects the blockage, halts without clipping, recalculates with A*, and detours through the outer bypass! Traversal costs accumulate continuously without reset.</strong>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* High-Contrast Bottom Presentation Controls */}
      <div className="bg-[#1C2844] border-t border-[#2B3B5B] px-4 sm:px-8 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 z-20 shrink-0">
        <div className="flex items-center gap-3">
          {/* Main Action Button */}
          <button
            onClick={handleDeploy}
            className="px-5 sm:px-7 py-2.5 rounded-xl bg-gradient-to-r from-[#66DAD5] to-[#6FAFFF] hover:from-[#5bc7c2] hover:to-[#5ea0ee] text-[#151F36] font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-[#66DAD5]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {robotState === 'MOVING' ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                Pause
              </>
            ) : robotState === 'ARRIVED' ? (
              <>
                <RotateCcw className="w-4 h-4" />
                Replay
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Deploy Robot
              </>
            )}
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="px-3.5 py-2.5 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Live Presentation Telemetry Counters */}
        <div className="flex items-center gap-3 sm:gap-6 font-mono text-xs">
          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] text-[#A1ADC7] block uppercase">Steps</span>
            <span className="text-sm sm:text-base font-bold text-[#F5F7FF]">{telemetry.stepsTaken}</span>
          </div>

          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] text-[#A1ADC7] block uppercase">Traversed</span>
            <span className="text-sm sm:text-base font-bold text-[#86E3B4]">{telemetry.executedCost.toFixed(1)}</span>
          </div>

          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] text-[#A1ADC7] block uppercase">Total Cost</span>
            <span className="text-sm sm:text-base font-bold text-[#66DAD5]">{telemetry.totalMissionCost.toFixed(1)}</span>
          </div>

          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] text-[#A1ADC7] block uppercase">Replans</span>
            <span className="text-sm sm:text-base font-bold text-[#FF9B83]">{telemetry.replans}</span>
          </div>

          <div className="hidden md:block text-center">
            <span className="text-[10px] text-[#A1ADC7] block uppercase">Runtime</span>
            <span className="text-sm font-bold text-[#F5CF79]">{telemetry.runtimeMs.toFixed(2)} ms</span>
          </div>
        </div>

        {/* Core Demo Button: Trigger Blockage */}
        <div>
          <button
            onClick={handleTriggerBlockage}
            disabled={!canTriggerBlockage}
            className={`px-4 sm:px-6 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-xl flex items-center gap-2 border transition-all ${
              canTriggerBlockage
                ? 'bg-gradient-to-r from-[#FF9B83] to-[#FF7B60] hover:from-[#FF7B60] hover:to-[#FF6B50] text-[#151F36] shadow-[#FF9B83]/35 hover:scale-[1.03] active:scale-[0.97] border-[#FF9B83]'
                : 'bg-[#2B3B5B]/50 border-[#3E527D]/50 text-[#A1ADC7]/60 cursor-not-allowed'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Trigger Blockage</span>
          </button>
        </div>
      </div>
    </div>
  );
};
