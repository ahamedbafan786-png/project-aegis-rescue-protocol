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
import { GridCoord, RobotState, TileType } from '../algorithms/types';
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<AegisRenderer | null>(null);

  const [gridModel, setGridModel] = useState<GridModel>(() => {
    const model = new GridModel(mission.rows, mission.cols, mission.start, mission.target);
    mission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    return model;
  });
  // Maintain an authoritative mutable ref to prevent stale grid closures during synchronous replanning
  const gridModelRef = useRef<GridModel>(gridModel);
  gridModelRef.current = gridModel;

  const robotRef = useRef<RobotController>(new RobotController(mission.start));

  const [robotState, setRobotState] = useState<RobotState>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('EXHIBIT READY — PRESS DEPLOY');
  const [activePath, setActivePath] = useState<GridCoord[]>([]);
  // Presenter script collapsed by default per specification
  const [showPresenterNotes, setShowPresenterNotes] = useState<boolean>(false);
  // Presenter Auto-Hold at Demo Window so trigger is never missed during live presentations
  const [holdAtWindow, setHoldAtWindow] = useState<boolean>(true);
  const hasAutoHeldRef = useRef<boolean>(false);

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
      const tile = gridModelRef.current.tiles[to.r][to.c];
      const weight = getTileMovementCost(tile);
      return isDiag ? weight * Math.SQRT2 : weight;
    };
  }, []);

  // Calculate Initial / Replanned Path
  const computeRoute = (startCoord: GridCoord, gridOverride?: TileType[][]) => {
    const currentTiles = gridOverride || gridModelRef.current.tiles;
    const res = findPathAStar({
      grid: currentTiles,
      rows: gridModelRef.current.rows,
      cols: gridModelRef.current.cols,
      start: startCoord,
      goal: gridModelRef.current.target,
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
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderer = new AegisRenderer(canvas);
    rendererRef.current = renderer;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        renderer.resize(rect.width, rect.height, gridModel.rows, gridModel.cols);
      }
    };

    handleResize();
    const ro = new ResizeObserver(() => handleResize());
    ro.observe(container);
    window.addEventListener('resize', handleResize);

    const initialPlan = computeRoute(gridModel.start);
    robotRef.current.setPath(initialPlan.path, initialPlan.totalCost);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
    };
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

      // Presenter Auto-Hold: pauses inside the demo window so the presenter never misses the blockage
      // (Only activates if demo blockage has not already been triggered pre-deployment)
      const isDemoBlockagePresentInGrid =
        mission.demoBlockageCoord &&
        isTileBlocked(gridModelRef.current.tiles[mission.demoBlockageCoord.r][mission.demoBlockageCoord.c]);

      if (
        holdAtWindow &&
        !isDemoBlockagePresentInGrid &&
        robot.state === 'MOVING' &&
        robot.logicalPos.r === 5 &&
        robot.logicalPos.c >= 4 &&
        robot.logicalPos.c <= 6 &&
        robot.replansCount === 0 &&
        !hasAutoHeldRef.current
      ) {
        hasAutoHeldRef.current = true;
        robot.autoHoldAtCurrent();
        setRobotState('IDLE');
        setStatusMessage('AUTO-HOLD ACTIVE — READY FOR COLLAPSE');
      }

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
      const newPlan = computeRoute(currentValid, gridModelRef.current.tiles);

      if (newPlan.found) {
        setActivePath(newPlan.path);
        robot.setPath(newPlan.path, newPlan.totalCost);
        robot.startMoving();
        hasAutoHeldRef.current = false;
        setRobotState('MOVING');
        setStatusMessage('DYNAMIC REPLAN: A* DETOUR VIA BYPASS');
      } else {
        robot.state = 'FAILED';
        robot.statusMessage = 'NO SAFE ROUTE AVAILABLE';
        setRobotState('FAILED');
        setStatusMessage('NO SAFE ROUTE AVAILABLE');
        sound.playFailed();
      }
    };
  }, []);

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
    hasAutoHeldRef.current = false;
    const next = new GridModel(mission.rows, mission.cols, mission.start, mission.target);
    mission.initialWalls.forEach((w) => next.setTile(w.r, w.c, 'WALL'));
    gridModelRef.current = next;
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
    robot.state = 'IDLE';
    robot.statusMessage = 'EXHIBIT READY — PRESS DEPLOY';
    setRobotState('IDLE');
    setStatusMessage('EXHIBIT READY — PRESS DEPLOY');

    rendererRef.current?.resetVisualEffects();
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

    // Check if preset demo blockage coordinate (5, 10) is ahead in remaining waypoints
    if (
      mission.demoBlockageCoord &&
      remaining.some(
        (wp) => wp.r === mission.demoBlockageCoord!.r && wp.c === mission.demoBlockageCoord!.c
      ) &&
      !isTileBlocked(gridModelRef.current.tiles[mission.demoBlockageCoord.r][mission.demoBlockageCoord.c])
    ) {
      blockCoord = mission.demoBlockageCoord;
    } else {
      // Pick 2 steps ahead (or 1 step ahead), avoiding goal destination
      const candidateIdx = remaining.length > 2 ? 2 : (remaining.length > 1 ? 1 : 0);
      const candidate = remaining[candidateIdx];
      if (candidate.r !== gridModelRef.current.target.r || candidate.c !== gridModelRef.current.target.c) {
        blockCoord = candidate;
      } else if (remaining.length > 1) {
        blockCoord = remaining[0];
      }
    }

    if (!blockCoord || (blockCoord.r === gridModelRef.current.target.r && blockCoord.c === gridModelRef.current.target.c)) {
      setStatusMessage('TARGET REACHED — CANNOT BLOCK DESTINATION');
      return;
    }

    const nextModel = gridModelRef.current.clone();
    nextModel.setTile(blockCoord.r, blockCoord.c, 'WALL');
    // Crucial: immediately update gridModelRef synchronously before invoking checkPathBlocked
    gridModelRef.current = nextModel;
    setGridModel(nextModel);

    // Particle dust & visual storytelling in renderer
    rendererRef.current?.addDustParticles(blockCoord.r, blockCoord.c, 16);
    rendererRef.current?.triggerBlockageVisual(blockCoord, activePath, robot.logicalPos);

    const isPreDeployment =
      (robot.state === 'IDLE' || robot.state === 'CONFIRMED') &&
      robot.stepsTaken === 0 &&
      !hasAutoHeldRef.current;

    if (isPreDeployment) {
      // Pre-deployment planning: calculate new path around the collapse,
      // update path and visual display, but DO NOT start moving or increment replan counter.
      const newPlan = computeRoute(robot.logicalPos, nextModel.tiles);
      if (newPlan.found) {
        setActivePath(newPlan.path);
        robot.setPath(newPlan.path, newPlan.totalCost);
        // Retain ready-to-deploy state at start
        robot.state = 'IDLE';
        robot.statusMessage = 'BYPASS ROUTE LOCKED — PRESS DEPLOY';
        setRobotState('IDLE');
        setStatusMessage('BYPASS ROUTE LOCKED — PRESS DEPLOY');
      } else {
        robot.state = 'FAILED';
        robot.statusMessage = 'NO SAFE ROUTE AVAILABLE';
        setRobotState('FAILED');
        setStatusMessage('NO SAFE ROUTE AVAILABLE');
        sound.playFailed();
      }
      return;
    }

    const isBlocked = robot.checkPathBlocked((r, c) => isTileBlocked(nextModel.tiles[r][c]));

    // If blockage invalidated path, clear auto-hold state and ensure moving state
    if (isBlocked) {
      hasAutoHeldRef.current = false;
      setRobotState('MOVING');
      setStatusMessage('DYNAMIC REPLAN: A* DETOUR VIA BYPASS');
    }
  };

  const isDemoBlockagePresent =
    mission.demoBlockageCoord !== undefined &&
    isTileBlocked(gridModel.tiles[mission.demoBlockageCoord.r][mission.demoBlockageCoord.c]);

  // Pre-deploy state: robot at start, not yet deployed
  const isPreDeploy =
    (robotState === 'IDLE' || robotState === 'CONFIRMED') &&
    telemetry.stepsTaken === 0 &&
    telemetry.replans === 0 &&
    !hasAutoHeldRef.current;

  // Demo window detection: while moving through transit conduit or paused in auto-hold
  // (Only active if demo blockage has not already occurred pre-deployment)
  const isInDemoWindow =
    !isDemoBlockagePresent &&
    telemetry.replans === 0 &&
    telemetry.r === 5 &&
    ((robotState === 'MOVING' && telemetry.c >= 3 && telemetry.c <= 8) ||
      (hasAutoHeldRef.current && robotState === 'IDLE'));

  const isPastDemoWindow =
    !isDemoBlockagePresent &&
    telemetry.replans === 0 &&
    telemetry.stepsTaken > 0 &&
    ((telemetry.r === 5 && telemetry.c > 8) || telemetry.r !== 5) &&
    (robotState === 'MOVING' || robotState === 'IDLE');

  const isDetourActive = telemetry.replans > 0 || (isDemoBlockagePresent && telemetry.stepsTaken > 0);

  // Compute status pill display
  let statusBadgeColor = 'bg-[#66DAD5]/20 border-[#66DAD5]/60 text-[#66DAD5]';
  let statusBadgeDot = 'bg-[#66DAD5]';
  let displayStatus = statusMessage;

  if (robotState === 'ARRIVED') {
    statusBadgeColor = 'bg-[#86E3B4]/20 border-[#86E3B4]/60 text-[#86E3B4]';
    statusBadgeDot = 'bg-[#86E3B4]';
    displayStatus = isDetourActive || isDemoBlockagePresent
      ? 'RESCUE COMPLETE · DETOUR SUCCESSFUL'
      : 'RESCUE COMPLETE · DESTINATION REACHED';
  } else if (isPreDeploy && isDemoBlockagePresent) {
    statusBadgeColor = 'bg-[#86E3B4]/25 border-[#86E3B4] text-[#86E3B4]';
    statusBadgeDot = 'bg-[#86E3B4]';
    displayStatus = 'BYPASS ROUTE LOCKED — READY TO DEPLOY';
  } else if (hasAutoHeldRef.current && robotState === 'IDLE' && telemetry.replans === 0) {
    statusBadgeColor = 'bg-[#FF9B83]/25 border-[#FF9B83] text-[#FF9B83] animate-pulse';
    statusBadgeDot = 'bg-[#FF9B83] animate-ping';
    displayStatus = 'AUTO-HOLD ACTIVE — READY FOR COLLAPSE';
  } else if (isInDemoWindow && robotState === 'MOVING') {
    statusBadgeColor = 'bg-[#86E3B4]/25 border-[#86E3B4] text-[#86E3B4] animate-pulse';
    statusBadgeDot = 'bg-[#86E3B4] animate-ping';
    displayStatus = 'DEMO READY: TRIGGER COLLAPSE NOW';
  } else if (isDetourActive && robotState === 'MOVING') {
    statusBadgeColor = 'bg-[#66DAD5]/25 border-[#66DAD5] text-[#66DAD5]';
    statusBadgeDot = 'bg-[#66DAD5] animate-ping';
    displayStatus = telemetry.replans > 0
      ? 'DYNAMIC REPLAN: A* DETOUR VIA BYPASS'
      : 'NAVIGATING BYPASS · DETOUR ACTIVE';
  } else if (robotState === 'BLOCKED' || robotState === 'REPLANNING') {
    statusBadgeColor = 'bg-[#FF9B83]/25 border-[#FF9B83]/80 text-[#FF9B83] animate-pulse';
    statusBadgeDot = 'bg-[#FF9B83]';
  } else if (robotState === 'MOVING') {
    statusBadgeColor = 'bg-[#6FAFFF]/20 border-[#6FAFFF]/60 text-[#6FAFFF]';
    statusBadgeDot = 'bg-[#6FAFFF] animate-ping';
  }

  // Compute trigger button states
  let triggerButtonContent: React.ReactNode = (
    <>
      <AlertOctagon className="w-4 h-4" />
      <span>Trigger Blockage</span>
    </>
  );
  let triggerButtonClass = 'bg-[#2B3B5B]/50 border-[#3E527D]/50 text-[#A1ADC7]/60 cursor-not-allowed';
  let triggerButtonDisabled = true;
  let triggerButtonTitle = 'Deploy Aegis-1 first, then trigger collapse during demo window';

  if (robotState === 'ARRIVED') {
    triggerButtonDisabled = true;
    triggerButtonClass = 'bg-[#86E3B4]/20 border-[#86E3B4]/60 text-[#86E3B4] cursor-default';
    triggerButtonTitle = 'Demonstration complete! Click Replay to run again.';
    triggerButtonContent = (
      <>
        <Sparkles className="w-4 h-4 text-[#86E3B4]" />
        <span>DEMO COMPLETE</span>
      </>
    );
  } else if (isPreDeploy && isDemoBlockagePresent) {
    // Pre-deployment collapse already triggered: bypass is calculated and locked
    triggerButtonDisabled = true;
    triggerButtonClass = 'bg-[#86E3B4]/20 border-[#86E3B4]/60 text-[#86E3B4] cursor-default';
    triggerButtonTitle = 'Bypass route locked around collapse at (5, 10). Click Deploy Robot to begin transit.';
    triggerButtonContent = (
      <>
        <Sparkles className="w-4 h-4 text-[#86E3B4]" />
        <span>BYPASS LOCKED</span>
      </>
    );
  } else if (isInDemoWindow) {
    triggerButtonDisabled = false;
    triggerButtonClass =
      'bg-gradient-to-r from-[#FF9B83] to-[#FF7B60] hover:from-[#FF7B60] hover:to-[#FF6B50] text-[#151F36] shadow-lg shadow-[#FF9B83]/40 border-[#FF9B83] animate-pulse hover:scale-[1.03] active:scale-[0.97]';
    triggerButtonTitle =
      'Trigger structural collapse at (5, 10) to demonstrate mid-transit A* replanning through the bypass!';
    triggerButtonContent = (
      <>
        <AlertOctagon className="w-4 h-4 animate-bounce" />
        <span>TRIGGER COLLAPSE NOW</span>
      </>
    );
  } else if (isPreDeploy) {
    // Allows triggering collapse before deployment (Scenario C)
    triggerButtonDisabled = false;
    triggerButtonClass =
      'bg-[#FF9B83]/20 hover:bg-[#FF9B83]/30 border-[#FF9B83] text-[#FF9B83] hover:scale-[1.02] active:scale-[0.98]';
    triggerButtonTitle =
      'Trigger structural collapse at (5, 10) before deployment to demonstrate initial bypass planning!';
    triggerButtonContent = (
      <>
        <AlertOctagon className="w-4 h-4" />
        <span>TRIGGER COLLAPSE NOW</span>
      </>
    );
  } else if (isDetourActive && (robotState === 'MOVING' || (robotState === 'IDLE' && telemetry.stepsTaken > 0))) {
    triggerButtonDisabled = true;
    triggerButtonClass = 'bg-[#86E3B4]/20 border-[#86E3B4]/60 text-[#86E3B4] cursor-default';
    triggerButtonTitle =
      telemetry.replans > 0
        ? 'A* has successfully replanned around the collapse!'
        : 'Aegis-1 is navigating the planned bypass route around the collapse at (5, 10).';
    triggerButtonContent = (
      <>
        <Sparkles className="w-4 h-4 text-[#86E3B4]" />
        <span>DETOUR IN PROGRESS</span>
      </>
    );
  } else if (isPastDemoWindow) {
    triggerButtonDisabled = true;
    triggerButtonClass = 'bg-[#2B3B5B]/40 border-[#3E527D]/40 text-[#A1ADC7]/50 cursor-not-allowed';
    triggerButtonTitle =
      'Demo window passed — Aegis-1 already past bypass opening. Click Reset Demo to demonstrate again.';
    triggerButtonContent = (
      <>
        <AlertOctagon className="w-4 h-4 opacity-50" />
        <span>Window Passed (Reset to retry)</span>
      </>
    );
  } else if (robotState === 'IDLE' || robotState === 'CONFIRMED') {
    triggerButtonDisabled = true;
    triggerButtonClass = 'bg-[#2B3B5B]/40 border-[#3E527D]/40 text-[#A1ADC7]/50 cursor-not-allowed';
    triggerButtonTitle = 'Click Deploy Robot first, then trigger collapse while robot is in transit';
    triggerButtonContent = (
      <>
        <AlertOctagon className="w-4 h-4" />
        <span>Trigger Blockage</span>
      </>
    );
  }

  return (
    <div className="flex-1 w-full bg-[#151F36] text-[#F5F7FF] flex flex-col select-none overflow-hidden min-h-0">
      {/* Top Presentation Bar */}
      <div className="bg-[#1C2844] border-b border-[#2B3B5B] px-3 sm:px-6 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => {
              sound.playClick();
              onExit();
            }}
            data-exit-presentation
            title="Exit Presentation"
            className="flex items-center gap-1.5 text-xs font-bold text-[#A1ADC7] hover:text-[#F5F7FF] px-2.5 py-1.5 rounded-lg bg-[#151F36] border border-[#2B3B5B] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit Presentation</span>
          </button>

          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-[#FF9B83] tracking-widest uppercase block">
              COLLEGE DEMONSTRATION EXHIBIT
            </span>
            <h2 className="text-xs sm:text-base font-extrabold text-[#F5F7FF] leading-tight">
              Autonomous Robot Path Planning · Live A* Replanning
            </h2>
          </div>
        </div>

        {/* Dynamic Status Pill, Auto-Hold Toggle & Script Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setHoldAtWindow((p) => !p)}
            data-testid="toggle-auto-hold"
            title={
              holdAtWindow
                ? 'Presenter Auto-Hold Active: Automatically pauses Aegis-1 at demo window to guarantee live trigger timing'
                : 'Presenter Auto-Hold Off: Aegis-1 moves continuously through corridor'
            }
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
              holdAtWindow
                ? 'bg-[#FF9B83]/20 border-[#FF9B83] text-[#FF9B83]'
                : 'bg-[#151F36] border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                holdAtWindow ? 'bg-[#FF9B83] animate-pulse' : 'bg-[#A1ADC7]'
              }`}
            />
            <span className="hidden sm:inline">Auto-Hold</span>{' '}
            <span className="font-bold">{holdAtWindow ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowPresenterNotes((v) => !v)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
              showPresenterNotes
                ? 'bg-[#66DAD5]/20 border-[#66DAD5] text-[#66DAD5]'
                : 'bg-[#151F36] border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Presenter Notes</span>
          </button>

          <div
            className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 border shadow-md ${statusBadgeColor}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusBadgeDot}`} />
            {displayStatus}
          </div>
        </div>
      </div>

      {/* Main Full-Scale Canvas */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#151F36] min-h-0">
        <div
          ref={containerRef}
          className="flex-1 w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden min-h-0"
        >
          <canvas ref={canvasRef} className="block rounded-xl shadow-2xl" />
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
                While Aegis-1 is in the demo window, click <strong className="text-[#FF9B83]">TRIGGER COLLAPSE NOW</strong> to simulate an emergency structural collapse.
              </li>
              <li>
                Point out to the lecturer: <strong className="text-[#F5F7FF]">Aegis-1 detects the blockage, halts without clipping, recalculates with A*, and detours through the outer bypass! Traversal costs accumulate continuously without reset.</strong>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* High-Contrast Bottom Presentation Controls */}
      <div className="bg-[#1C2844] border-t border-[#2B3B5B] px-3 sm:px-6 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-4 z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Main Action Button */}
          <button
            onClick={handleDeploy}
            data-deploy-button
            className="px-4 sm:px-7 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#66DAD5] to-[#6FAFFF] hover:from-[#5bc7c2] hover:to-[#5ea0ee] text-[#151F36] font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-[#66DAD5]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
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
            data-testid="presentation-reset-btn"
            className="px-3 py-2 sm:py-2.5 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Live Presentation Telemetry Counters */}
        <div className="flex items-center gap-2 sm:gap-6 font-mono text-xs">
          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] text-[#A1ADC7] block uppercase">Steps</span>
            <span data-telemetry="steps" className="text-xs sm:text-base font-bold text-[#F5F7FF]">{telemetry.stepsTaken}</span>
          </div>

          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] text-[#A1ADC7] block uppercase">Traversed</span>
            <span data-telemetry="traversed" className="text-xs sm:text-base font-bold text-[#86E3B4]">
              {telemetry.executedCost.toFixed(1)}
            </span>
          </div>

          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] text-[#A1ADC7] block uppercase">Total Cost</span>
            <span data-telemetry="total-cost" className="text-xs sm:text-base font-bold text-[#66DAD5]">
              {telemetry.totalMissionCost.toFixed(1)}
            </span>
          </div>

          <div className="text-center">
            <span className="text-[9px] sm:text-[10px] text-[#A1ADC7] block uppercase">Replans</span>
            <span data-telemetry="replans" className="text-xs sm:text-base font-bold text-[#FF9B83]">{telemetry.replans}</span>
          </div>

          <div className="hidden md:block text-center">
            <span className="text-[10px] text-[#A1ADC7] block uppercase">Runtime</span>
            <span data-telemetry="runtime" className="text-sm font-bold text-[#F5CF79]">{telemetry.runtimeMs.toFixed(2)} ms</span>
          </div>
        </div>

        {/* Core Demo Button: Trigger Blockage */}
        <div>
          <button
            onClick={handleTriggerBlockage}
            disabled={triggerButtonDisabled}
            title={triggerButtonTitle}
            data-trigger-blockage
            className={`px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-xl flex items-center gap-2 border transition-all ${triggerButtonClass}`}
          >
            {triggerButtonContent}
          </button>
        </div>
      </div>
    </div>
  );
};
