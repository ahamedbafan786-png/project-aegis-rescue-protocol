import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eraser,
  Flame,
  Layers,
  MapPin,
  Move,
  Pause,
  Play,
  RotateCcw,
  Route,
  Settings2,
  Shuffle,
  Square,
  StepForward,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { findPathAStar, isTileBlocked, getTileMovementCost } from '../algorithms/astar';
import {
  GridCoord,
  HeuristicType,
  MovementMode,
  PathResult,
  RobotState,
  TileType,
} from '../algorithms/types';
import { AegisRenderer, SectorTheme } from '../game/aegisRenderer';
import { GridModel } from '../game/gridModel';
import { RobotController } from '../game/robotController';
import { sound } from '../game/soundEngine';
import { MissionDefinition } from '../missions/missionData';

interface GameHUDProps {
  mission: MissionDefinition;
  onMissionComplete: (stats: { steps: number; replans: number; cost: number }) => void;
  onExit: () => void;
  onReplay?: () => void;
}

export type ToolType = 'wall' | 'rough' | 'eraser' | 'start' | 'target';

export const GameHUD: React.FC<GameHUDProps> = ({
  mission,
  onMissionComplete,
  onExit,
  onReplay,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<AegisRenderer | null>(null);

  // Layout Docks: authoritative single-state drawer exclusivity ('CLOSED' | 'TOOLS' | 'TELEMETRY')
  // Eliminates race conditions and drawer overlap on mobile (390x844 & 543x589)
  type ActiveDrawer = 'CLOSED' | 'TOOLS' | 'TELEMETRY';
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(() => (isMobile ? 'CLOSED' : 'TOOLS'));

  const leftDockOpen = activeDrawer === 'TOOLS';
  const rightDockOpen = activeDrawer === 'TELEMETRY';
  const [analysisModalOpen, setAnalysisModalOpen] = useState<boolean>(false);

  // Models
  const [gridModel, setGridModel] = useState<GridModel>(() => {
    const model = new GridModel(mission.rows, mission.cols, mission.start, mission.target);
    mission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    mission.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    return model;
  });
  const gridModelRef = useRef<GridModel>(gridModel);
  gridModelRef.current = gridModel;

  const robotRef = useRef<RobotController>(new RobotController(mission.start));

  // Controls & Settings
  const [activeTool, setActiveTool] = useState<ToolType>('wall');
  const [movementMode, setMovementMode] = useState<MovementMode>('4-directional');
  const [heuristicType, setHeuristicType] = useState<HeuristicType>('manhattan');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);

  // Simulation State
  const [robotState, setRobotState] = useState<RobotState>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('SYSTEM STANDBY');
  const [activePath, setActivePath] = useState<GridCoord[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Telemetry
  const [telemetry, setTelemetry] = useState({
    r: mission.start.r,
    c: mission.start.c,
    g: 0,
    h: 0,
    f: 0,
    nodesExpanded: 0,
    pathCost: 0,
    pathLength: 0,
    executedCost: 0,
    remainingCost: 0,
    totalMissionCost: 0,
    stepsTaken: 0,
    remainingSteps: 0,
    replans: 0,
    executionTimeMs: 0,
  });

  // Step-by-Step Teaching Mode
  const [stepSearchActive, setStepSearchActive] = useState<boolean>(false);
  const [stepSearchFrames, setStepSearchFrames] = useState<PathResult | null>(null);
  const [currentStepFrameIndex, setCurrentStepFrameIndex] = useState<number>(0);

  // Configure dynamic step cost function for weighted terrain
  useEffect(() => {
    const robot = robotRef.current;
    robot.stepCostFn = (from, to) => {
      const isDiag = from.r !== to.r && from.c !== to.c;
      const tile = gridModelRef.current.tiles[to.r][to.c];
      const weight = getTileMovementCost(tile);
      return isDiag ? weight * Math.SQRT2 : weight;
    };
  }, []);

  // Run A* Calculation
  const calculatePath = useCallback(
    (startCoord?: GridCoord, gridOverride?: TileType[][]) => {
      const from = startCoord || robotRef.current.logicalPos;
      const currentTiles = gridOverride || gridModelRef.current.tiles;
      const res = findPathAStar({
        grid: currentTiles,
        rows: gridModelRef.current.rows,
        cols: gridModelRef.current.cols,
        start: from,
        goal: gridModelRef.current.target,
        movementMode,
        heuristicType,
        recordSteps: true,
      });

      setActivePath(res.path);
      setStepSearchFrames(res);
      setCurrentStepFrameIndex(0);

      // Highlight explored / open nodes in renderer
      if (rendererRef.current) {
        rendererRef.current.highlightedExplored.clear();
        rendererRef.current.highlightedOpen.clear();
        res.exploredNodes.forEach((c) =>
          rendererRef.current?.highlightedExplored.add(`${c.r},${c.c}`)
        );
      }

      setTelemetry((prev) => ({
        ...prev,
        nodesExpanded: res.nodesExpandedCount,
        pathCost: res.totalCost,
        pathLength: res.path.length,
        executionTimeMs: res.executionTimeMs,
        g: res.gScores[`${from.r},${from.c}`] ?? 0,
        h: res.hScores[`${from.r},${from.c}`] ?? 0,
        f: res.fScores[`${from.r},${from.c}`] ?? 0,
      }));

      return res;
    },
    [movementMode, heuristicType]
  );

  // Initialize Canvas & Renderer
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

    // Initial Path Calculation
    const initialRes = calculatePath(gridModel.start);
    robotRef.current.setPath(initialRes.path, initialRes.totalCost);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [gridModel.rows, gridModel.cols]);

  // Main 60 FPS Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const deltaSec = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const robot = robotRef.current;

      // Update Robot Interpolation
      robot.update(deltaSec, speedMultiplier);

      // Check if robot arrived
      if (robot.state === 'ARRIVED' && robotState !== 'ARRIVED') {
        setRobotState('ARRIVED');
        setStatusMessage('MISSION ACCOMPLISHED');
        rendererRef.current?.addArrivalBurst(gridModel.target.r, gridModel.target.c);
        onMissionComplete({
          steps: robot.stepsTaken,
          replans: robot.replansCount,
          cost: robot.executedCost,
        });
      }

      // Render Canvas with Sector Theme
      if (rendererRef.current) {
        rendererRef.current.render(
          gridModel,
          robot,
          activePath,
          deltaSec,
          mission.environmentTheme || 'training'
        );
      }

      // Update Live Telemetry
      const tel = robot.getTelemetry();
      setTelemetry((prev) => ({
        ...prev,
        r: tel.currentLogicalCoord.r,
        c: tel.currentLogicalCoord.c,
        replans: tel.replansCount,
        stepsTaken: tel.totalStepsTaken,
        remainingSteps: tel.remainingSteps,
        executedCost: tel.executedCost,
        remainingCost: tel.remainingCost,
        totalMissionCost: tel.totalMissionCost,
      }));

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gridModel, activePath, speedMultiplier, robotState, onMissionComplete, mission.environmentTheme]);

  // Handle Robot Callbacks
  useEffect(() => {
    const robot = robotRef.current;
    robot.onStateChange = (state, msg) => {
      setRobotState(state);
      setStatusMessage(msg);
    };

    robot.onBlocked = () => {
      // Dynamic Replanning Triggered!
      const currentValid = robot.logicalPos;
      const newPlan = calculatePath(currentValid, gridModelRef.current.tiles);

      if (newPlan.found) {
        setActivePath(newPlan.path);
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
  }, [calculatePath]);

  // Deploy / Pause Handler
  const handleToggleDeploy = () => {
    const robot = robotRef.current;
    if (robot.state === 'IDLE' || robot.state === 'CONFIRMED') {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setActiveDrawer('CLOSED');
      }
      const res = calculatePath(robot.logicalPos);
      if (res.found) {
        robot.setPath(res.path, res.totalCost);
        robot.startMoving();
      }
    } else if (robot.state === 'MOVING') {
      robot.pause();
    } else if (robot.state === 'ARRIVED' || robot.state === 'FAILED') {
      // Clean authoritative replay
      if (onReplay) {
        onReplay();
      } else {
        robot.reset(gridModel.start);
        const res = calculatePath(gridModel.start);
        robot.setPath(res.path, res.totalCost);
      }
    }
  };

  // Reset Simulation Handler
  const handleReset = () => {
    sound.playClick();
    if (onReplay) {
      onReplay();
      return;
    }
    const robot = robotRef.current;
    robot.reset(gridModel.start);
    const res = calculatePath(gridModel.start);
    robot.setPath(res.path, res.totalCost);
    setRobotState('IDLE');
    setStatusMessage('SYSTEM STANDBY');
  };

  // Dynamic Blockage Trigger (Reliably blocks upcoming cell on path)
  const handleTriggerBlockage = () => {
    const robot = robotRef.current;
    if (robot.state !== 'MOVING' && robot.state !== 'CONFIRMED' && robot.state !== 'IDLE') {
      return;
    }

    // Inspect remaining waypoints ahead of the robot
    const remaining = robot.path.slice(robot.currentWaypointIndex + 1);
    if (remaining.length === 0) {
      setStatusMessage('TARGET IN REACH — NO AHEAD CELLS TO BLOCK');
      return;
    }

    let blockCoord: GridCoord | null = null;

    // Check if preset demo blockage coordinate is ahead
    if (
      mission.demoBlockageCoord &&
      remaining.some(
        (wp) => wp.r === mission.demoBlockageCoord!.r && wp.c === mission.demoBlockageCoord!.c
      ) &&
      !isTileBlocked(gridModel.tiles[mission.demoBlockageCoord.r][mission.demoBlockageCoord.c])
    ) {
      blockCoord = mission.demoBlockageCoord;
    } else {
      // Pick 2 steps ahead (or 1 step ahead if only 1 remaining), avoiding target cell
      const candidateIdx = remaining.length > 2 ? 2 : (remaining.length > 1 ? 1 : 0);
      const candidate = remaining[candidateIdx];
      if (candidate.r !== gridModel.target.r || candidate.c !== gridModel.target.c) {
        blockCoord = candidate;
      } else if (remaining.length > 1) {
        blockCoord = remaining[0];
      }
    }

    if (!blockCoord || (blockCoord.r === gridModelRef.current.target.r && blockCoord.c === gridModelRef.current.target.c)) {
      setStatusMessage('TARGET IN REACH — DESTINATION PROTECTED');
      return;
    }

    // Place Wall directly into authoritative grid
    const nextModel = gridModelRef.current.clone();
    nextModel.setTile(blockCoord.r, blockCoord.c, 'WALL');
    gridModelRef.current = nextModel;
    setGridModel(nextModel);

    // Particle dust & visual storytelling in renderer
    rendererRef.current?.addDustParticles(blockCoord.r, blockCoord.c, 14);
    rendererRef.current?.triggerBlockageVisual(blockCoord, activePath, robot.logicalPos);

    // Prompt robot to inspect remaining path
    const isBlocked = robot.checkPathBlocked((r, c) => isTileBlocked(nextModel.tiles[r][c]));

    // If robot was idle, recalculate immediately
    if (!isBlocked && (robot.state === 'IDLE' || robot.state === 'CONFIRMED')) {
      const res = findPathAStar({
        grid: nextModel.tiles,
        rows: nextModel.rows,
        cols: nextModel.cols,
        start: robot.logicalPos,
        goal: nextModel.target,
        movementMode,
        heuristicType,
      });
      setActivePath(res.path);
      robot.setPath(res.path, res.totalCost);
    }
  };

  // Step-by-Step Teaching Mode
  const handleStepForward = () => {
    sound.playClick();
    if (!stepSearchFrames || stepSearchFrames.searchSteps.length === 0) {
      const res = calculatePath(robotRef.current.logicalPos);
      setStepSearchFrames(res);
      setCurrentStepFrameIndex(0);
      return;
    }

    const nextIdx = Math.min(stepSearchFrames.searchSteps.length - 1, currentStepFrameIndex + 1);
    setCurrentStepFrameIndex(nextIdx);
    const frame = stepSearchFrames.searchSteps[nextIdx];

    if (rendererRef.current && frame) {
      rendererRef.current.highlightedExplored.clear();
      rendererRef.current.highlightedOpen.clear();
      frame.closedSetCoords.forEach((c) => rendererRef.current?.highlightedExplored.add(`${c.r},${c.c}`));
      frame.openSetCoords.forEach((c) => rendererRef.current?.highlightedOpen.add(`${c.r},${c.c}`));
    }

    if (frame) {
      setTelemetry((prev) => ({
        ...prev,
        r: frame.currentNode.r,
        c: frame.currentNode.c,
        g: frame.g,
        h: frame.h,
        f: frame.f,
      }));
    }
  };

  // Canvas Mouse & Drawing Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleApplyTool(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const coord = rendererRef.current.screenToGrid(x, y, gridModel.rows, gridModel.cols);
    rendererRef.current.hoverCoord = coord;

    if (isDrawing && coord) {
      handleApplyTool(e);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const handleApplyTool = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const coord = rendererRef.current.screenToGrid(x, y, gridModel.rows, gridModel.cols);
    if (!coord) return;

    const nextModel = gridModel.clone();
    let changed = false;

    if (activeTool === 'wall') {
      changed = nextModel.setTile(coord.r, coord.c, 'WALL');
      if (changed) rendererRef.current.addDustParticles(coord.r, coord.c, 6);
    } else if (activeTool === 'rough') {
      changed = nextModel.setTile(coord.r, coord.c, 'ROUGH_TERRAIN');
    } else if (activeTool === 'eraser') {
      changed = nextModel.setTile(coord.r, coord.c, 'EMPTY');
    } else if (activeTool === 'start') {
      changed = nextModel.setStart(coord.r, coord.c);
      if (changed) robotRef.current.reset(coord);
    } else if (activeTool === 'target') {
      changed = nextModel.setTarget(coord.r, coord.c);
    }

    if (changed) {
      sound.playClick();
      setGridModel(nextModel);

      // Check if robot path is invalidated while moving
      const robot = robotRef.current;
      robot.checkPathBlocked((r, c) => isTileBlocked(nextModel.tiles[r][c]));

      // If robot is idle, update path preview
      if (robot.state === 'IDLE' || robot.state === 'CONFIRMED') {
        const res = findPathAStar({
          grid: nextModel.tiles,
          rows: nextModel.rows,
          cols: nextModel.cols,
          start: robot.logicalPos,
          goal: nextModel.target,
          movementMode,
          heuristicType,
        });
        setActivePath(res.path);
        robot.setPath(res.path, res.totalCost);
      }
    }
  };

  // Keyboard Shortcuts (Space: Play/Pause, R: Reset, B: Blockage, T: Tools, M: Metrics)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleDeploy();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleReset();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        handleTriggerBlockage();
      } else if (e.code === 'KeyT') {
        sound.playClick();
        setActiveDrawer((prev) => (prev === 'TOOLS' ? 'CLOSED' : 'TOOLS'));
      } else if (e.code === 'KeyM') {
        sound.playClick();
        setActiveDrawer((prev) => (prev === 'TELEMETRY' ? 'CLOSED' : 'TELEMETRY'));
      } else if (e.code === 'Digit1') {
        setActiveTool('wall');
      } else if (e.code === 'Digit2') {
        setActiveTool('rough');
      } else if (e.code === 'Digit3') {
        setActiveTool('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gridModel, activePath]);

  // Determine if blockage button should be disabled
  const canTriggerBlockage =
    (robotState === 'MOVING' || robotState === 'CONFIRMED' || robotState === 'IDLE') &&
    activePath.length > robotRef.current.currentWaypointIndex + 1;

  return (
    <div className="flex-1 w-full bg-[#151F36] text-[#F5F7FF] flex flex-col select-none overflow-hidden">
      {/* Top Tactical Status Bar */}
      <div className="bg-[#1C2844] border-b border-[#2B3B5B] px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-mono font-bold text-[#66DAD5] uppercase tracking-wider">
                {mission.codename}
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#F5F7FF]">{mission.title}</span>
            </div>
            <span className="hidden sm:block text-[11px] text-[#A1ADC7]">{mission.subtitle}</span>
          </div>
        </div>

        {/* Dynamic Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 border shadow-sm ${
              robotState === 'MOVING'
                ? 'bg-[#86E3B4]/15 border-[#86E3B4]/40 text-[#86E3B4]'
                : robotState === 'BLOCKED' || robotState === 'REPLANNING'
                ? 'bg-[#FF9B83]/20 border-[#FF9B83]/60 text-[#FF9B83] animate-pulse'
                : robotState === 'ARRIVED'
                ? 'bg-[#F5CF79]/15 border-[#F5CF79]/40 text-[#F5CF79]'
                : robotState === 'FAILED'
                ? 'bg-[#FF9B83]/15 border-[#FF9B83]/40 text-[#FF9B83]'
                : 'bg-[#66DAD5]/15 border-[#66DAD5]/40 text-[#66DAD5]'
            }`}
          >
            <span
              className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${
                robotState === 'MOVING'
                  ? 'bg-[#86E3B4] animate-ping'
                  : robotState === 'BLOCKED' || robotState === 'REPLANNING'
                  ? 'bg-[#FF9B83]'
                  : robotState === 'ARRIVED'
                  ? 'bg-[#F5CF79]'
                  : 'bg-[#66DAD5]'
              }`}
            />
            {statusMessage}
          </div>
        </div>

        {/* Speed Controls & Dock Toggles */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 bg-[#151F36] px-2 py-1 rounded-lg border border-[#2B3B5B]">
            <span className="text-[10px] font-mono text-[#A1ADC7] mr-1">Speed:</span>
            {[0.5, 1.0, 2.0, 5.0, 100].map((s) => (
              <button
                key={s}
                onClick={() => {
                  sound.playClick();
                  setSpeedMultiplier(s);
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                  speedMultiplier === s
                    ? 'bg-[#66DAD5] text-[#151F36] font-bold'
                    : 'text-[#A1ADC7] hover:text-[#F5F7FF]'
                }`}
              >
                {s === 100 ? 'Max' : `${s}x`}
              </button>
            ))}
          </div>

          {/* Dock Toggle Buttons */}
          <button
            onClick={() => {
              sound.playClick();
              setActiveDrawer((prev) => (prev === 'TOOLS' ? 'CLOSED' : 'TOOLS'));
            }}
            title="Toggle Tools Panel (T)"
            className={`p-1.5 rounded-lg border transition-colors ${
              leftDockOpen
                ? 'bg-[#66DAD5]/15 border-[#66DAD5]/50 text-[#66DAD5]'
                : 'bg-[#151F36] border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
            }`}
          >
            <Settings2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveDrawer((prev) => (prev === 'TELEMETRY' ? 'CLOSED' : 'TELEMETRY'));
            }}
            title="Toggle Telemetry Panel (M)"
            className={`p-1.5 rounded-lg border transition-colors ${
              rightDockOpen
                ? 'bg-[#6FAFFF]/15 border-[#6FAFFF]/50 text-[#6FAFFF]'
                : 'bg-[#151F36] border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main HUD Center Area (Grid Canvas Occupies 70-75% on Desktop, 100% on Mobile) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toolbar Dock (Collapsible Floating / Side Panel) */}
        {leftDockOpen && (
          <div className="absolute lg:relative z-30 top-0 left-0 bottom-0 w-56 bg-[#1C2844]/95 backdrop-blur-md border-r border-[#2B3B5B] p-3.5 flex flex-col justify-between shrink-0 overflow-y-auto shadow-2xl lg:shadow-none animate-in slide-in-from-left duration-200">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between border-b border-[#2B3B5B] pb-2">
                <span className="text-[11px] font-mono font-bold text-[#66DAD5] tracking-wider uppercase">
                  Tactical Tools
                </span>
                <button
                  onClick={() => setActiveDrawer('CLOSED')}
                  className="p-1 rounded text-[#A1ADC7] hover:text-[#F5F7FF] lg:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Terrain Tools */}
              <div>
                <span className="text-[10px] font-mono font-semibold text-[#A1ADC7] tracking-wider uppercase block mb-1.5">
                  Terrain Placement
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      sound.playClick();
                      setActiveTool('wall');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      activeTool === 'wall'
                        ? 'bg-[#2B3B5B] border-[#66DAD5] text-[#66DAD5] shadow-sm'
                        : 'bg-[#151F36]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
                    }`}
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Wall (1)
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      setActiveTool('rough');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      activeTool === 'rough'
                        ? 'bg-[#2B3B5B] border-[#F5CF79] text-[#F5CF79] shadow-sm'
                        : 'bg-[#151F36]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Rough (2)
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      setActiveTool('eraser');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      activeTool === 'eraser'
                        ? 'bg-[#2B3B5B] border-[#FF9B83] text-[#FF9B83] shadow-sm'
                        : 'bg-[#151F36]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Eraser (3)
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      setActiveTool('start');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      activeTool === 'start'
                        ? 'bg-[#2B3B5B] border-[#6FAFFF] text-[#6FAFFF] shadow-sm'
                        : 'bg-[#151F36]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
                    }`}
                  >
                    <Move className="w-3.5 h-3.5" />
                    Start
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      setActiveTool('target');
                    }}
                    className={`col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      activeTool === 'target'
                        ? 'bg-[#2B3B5B] border-[#86E3B4] text-[#86E3B4] shadow-sm'
                        : 'bg-[#151F36]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Relocate Target
                  </button>
                </div>
              </div>

              {/* Map Generation Actions */}
              <div>
                <span className="text-[10px] font-mono font-semibold text-[#A1ADC7] tracking-wider uppercase block mb-1.5">
                  Topology Generators
                </span>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      sound.playClick();
                      const next = gridModel.clone();
                      next.generateRandomWalls(0.25);
                      setGridModel(next);
                      calculatePath();
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#151F36] hover:bg-[#253554] border border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF] transition-colors"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Random Obstacles
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      const next = gridModel.clone();
                      next.generateMaze();
                      setGridModel(next);
                      calculatePath();
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#151F36] hover:bg-[#253554] border border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF] transition-colors"
                  >
                    <Route className="w-3.5 h-3.5" />
                    Generate Maze
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      const next = gridModel.clone();
                      next.clearWalls();
                      setGridModel(next);
                      calculatePath();
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#151F36] hover:bg-[#253554] border border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Obstacles
                  </button>
                </div>
              </div>

              {/* Heuristic & Movement Settings */}
              <div>
                <span className="text-[10px] font-mono font-semibold text-[#A1ADC7] tracking-wider uppercase block mb-1.5">
                  Search Model
                </span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-medium bg-[#151F36] p-1.5 rounded-lg border border-[#2B3B5B]">
                    <span className="text-[#A1ADC7]">Movement:</span>
                    <button
                      onClick={() => {
                        sound.playClick();
                        const nextMode = movementMode === '4-directional' ? '8-directional' : '4-directional';
                        setMovementMode(nextMode);
                        if (nextMode === '8-directional') setHeuristicType('octile');
                        else setHeuristicType('manhattan');
                      }}
                      className="font-mono text-[#66DAD5] font-semibold hover:underline"
                    >
                      {movementMode === '4-directional' ? '4-Way' : '8-Way'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium bg-[#151F36] p-1.5 rounded-lg border border-[#2B3B5B]">
                    <span className="text-[#A1ADC7]">Heuristic:</span>
                    <select
                      value={heuristicType}
                      onChange={(e) => {
                        sound.playClick();
                        setHeuristicType(e.target.value as HeuristicType);
                      }}
                      className="bg-transparent font-mono text-[#66DAD5] text-xs font-semibold focus:outline-none"
                    >
                      <option value="manhattan" className="bg-[#151F36] text-[#F5F7FF]">Manhattan</option>
                      <option value="octile" className="bg-[#151F36] text-[#F5F7FF]">Octile</option>
                      <option value="euclidean" className="bg-[#151F36] text-[#F5F7FF]">Euclidean</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Exit mission button */}
            <button
              onClick={() => {
                sound.playClick();
                onExit();
              }}
              className="w-full text-center text-xs text-[#A1ADC7] hover:text-[#F5F7FF] py-2 border-t border-[#2B3B5B] mt-3"
            >
              ← Mission Select
            </button>
          </div>
        )}

        {/* Center Canvas Viewport (The Hero Element) */}
        <div className="flex-1 h-full bg-[#151F36] flex items-center justify-center relative overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className="w-full h-full cursor-crosshair"
          />

          {/* Quick Floating Docks Pills when collapsed */}
          {!leftDockOpen && (
            <button
              onClick={() => {
                sound.playClick();
                setActiveDrawer('TOOLS');
              }}
              className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-lg bg-[#1C2844]/90 hover:bg-[#253554] border border-[#2B3B5B] text-xs font-mono text-[#66DAD5] flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Tools [T]</span>
            </button>
          )}

          {!rightDockOpen && (
            <button
              onClick={() => {
                sound.playClick();
                setActiveDrawer('TELEMETRY');
              }}
              className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg bg-[#1C2844]/90 hover:bg-[#253554] border border-[#2B3B5B] text-xs font-mono text-[#6FAFFF] flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Telemetry [M]</span>
            </button>
          )}
        </div>

        {/* Right Telemetry Dock (Collapsible Floating / Side Panel) */}
        {rightDockOpen && (
          <div className="absolute lg:relative z-30 top-0 right-0 bottom-0 w-60 bg-[#1C2844]/95 backdrop-blur-md border-l border-[#2B3B5B] p-3.5 flex flex-col justify-between shrink-0 overflow-y-auto shadow-2xl lg:shadow-none animate-in slide-in-from-right duration-200">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#2B3B5B] pb-2">
                <span className="text-[11px] font-mono font-bold text-[#6FAFFF] tracking-wider uppercase">
                  A* Telemetry
                </span>
                <button
                  onClick={() => setActiveDrawer('CLOSED')}
                  className="p-1 rounded text-[#A1ADC7] hover:text-[#F5F7FF] lg:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Algorithm Analysis Action (Clutter-Free Math Card) */}
              <button
                onClick={() => setAnalysisModalOpen(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#151F36] hover:bg-[#202E4B] border border-[#2B3B5B] hover:border-[#66DAD5]/50 transition-all text-left group"
                title="View full mathematical breakdown and proof of admissibility"
              >
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#66DAD5] uppercase block">
                    Formula Analysis
                  </span>
                  <span className="text-xs font-mono font-bold text-[#F5F7FF] group-hover:text-[#66DAD5]">
                    f(n) = g(n) + h(n)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#66DAD5]/15 text-[#66DAD5] font-bold">
                  Inspect
                </span>
              </button>

              {/* Standardized Clear Metrics */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono font-semibold text-[#A1ADC7] tracking-wider uppercase">
                  Mission Progression
                </span>

                <div className="bg-[#151F36] px-2.5 py-1.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                  <span className="text-[#A1ADC7]">Movement Steps:</span>
                  <span className="font-mono font-bold text-[#F5F7FF]">
                    {telemetry.stepsTaken}
                  </span>
                </div>

                <div className="bg-[#151F36] px-2.5 py-1.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                  <span className="text-[#A1ADC7]">Executed Traversal Cost:</span>
                  <span className="font-mono font-bold text-[#86E3B4]">
                    {telemetry.executedCost.toFixed(2)}
                  </span>
                </div>

                <div className="bg-[#151F36] px-2.5 py-1.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                  <span className="text-[#A1ADC7]">Remaining Planned Cost:</span>
                  <span className="font-mono font-bold text-[#F5CF79]">
                    {telemetry.remainingCost.toFixed(2)}
                  </span>
                </div>

                <div className="bg-[#151F36] px-2.5 py-1.5 rounded-lg border border-[#66DAD5]/30 flex items-center justify-between text-xs">
                  <span className="text-[#66DAD5] font-semibold">Total Route Cost:</span>
                  <span className="font-mono font-bold text-[#66DAD5]">
                    {telemetry.totalMissionCost.toFixed(2)}
                  </span>
                </div>

                <div className="bg-[#151F36] px-2.5 py-1.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                  <span className="text-[#A1ADC7]">Search Nodes Evaluated:</span>
                  <span className="font-mono font-bold text-[#A695F2]">
                    {telemetry.nodesExpanded}
                  </span>
                </div>

                <div className="bg-[#151F36] px-2.5 py-1.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                  <span className="text-[#A1ADC7]">Replanning Events:</span>
                  <span className="font-mono font-bold text-[#FF9B83]">
                    {telemetry.replans}
                  </span>
                </div>

                <div className="bg-[#151F36] px-2.5 py-1.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                  <span className="text-[#A1ADC7]">Search Compute Time:</span>
                  <span className="font-mono font-bold text-[#A1ADC7]">
                    {telemetry.executionTimeMs.toFixed(2)} ms
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Shortcuts Info */}
            <div className="text-[10px] text-[#A1ADC7]/70 font-mono mt-3 pt-2 border-t border-[#2B3B5B] flex flex-col gap-0.5">
              <span>[Space] Deploy/Pause</span>
              <span>[B] Dynamic Blockage</span>
              <span>[R] Reset Simulation</span>
              <span>[T] Toggle Tools</span>
              <span>[M] Toggle Metrics</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Command Action Deck */}
      <div className="bg-[#1C2844] border-t border-[#2B3B5B] px-4 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3 z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Main Deploy / Pause Button */}
          <button
            onClick={handleToggleDeploy}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all ${
              robotState === 'MOVING'
                ? 'bg-[#F5CF79] text-[#151F36] hover:bg-[#F5CF79]/90'
                : 'bg-gradient-to-r from-[#66DAD5] to-[#6FAFFF] text-[#151F36] shadow-[#66DAD5]/25 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {robotState === 'MOVING' ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                Pause Robot
              </>
            ) : robotState === 'ARRIVED' ? (
              <>
                <RotateCcw className="w-4 h-4" />
                Replay Mission
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Deploy Robot
              </>
            )}
          </button>

          {/* Step Forward (Teaching Mode) */}
          <button
            onClick={handleStepForward}
            className="px-3 py-2 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-semibold text-xs tracking-wide flex items-center gap-1.5 transition-all"
            title="Advance search visualization by one node"
          >
            <StepForward className="w-3.5 h-3.5 text-[#A695F2]" />
            <span className="hidden sm:inline">Step Search</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-semibold text-xs tracking-wide flex items-center gap-1.5 transition-all"
            title="Reset simulation to initial state"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#A1ADC7]" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* WOW Feature: Trigger Mid-Transit Blockage */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerBlockage}
            disabled={!canTriggerBlockage}
            className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 border transition-all ${
              canTriggerBlockage
                ? 'bg-gradient-to-r from-[#FF9B83] to-[#FF7B60] hover:from-[#FF7B60] hover:to-[#FF6B50] text-[#151F36] shadow-[#FF9B83]/30 border-[#FF9B83] hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-[#2B3B5B]/50 border-[#3E527D]/50 text-[#A1ADC7]/60 cursor-not-allowed'
            }`}
            title={
              canTriggerBlockage
                ? 'Drop an obstacle on an upcoming path cell to demonstrate real-time A* dynamic replanning'
                : 'No ahead path cells available to block'
            }
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Trigger Blockage</span>
            <span className="hidden md:inline">(Dynamic Replanning)</span>
          </button>
        </div>
      </div>

      {/* Algorithm Analysis Modal (Clutter reduction + Pure Math clarity) */}
      {analysisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#1C2844] border border-[#3E527D] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2B3B5B] pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#66DAD5]" />
                <h3 className="text-base font-bold text-[#F5F7FF] tracking-wide">
                  A* HEURISTIC EVALUATION
                </h3>
              </div>
              <button
                onClick={() => setAnalysisModalOpen(false)}
                className="p-1 rounded-lg text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#253554] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#151F36] rounded-xl p-4 border border-[#2B3B5B] text-center space-y-2">
              <span className="text-[10px] font-mono font-bold text-[#66DAD5] uppercase tracking-wider block">
                Total Estimated Evaluation Function
              </span>
              <div className="text-lg font-mono font-extrabold text-[#F5F7FF] tracking-wider py-1 bg-[#1C2844] rounded-lg border border-[#2B3B5B]">
                f(n) = g(n) + h(n)
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="bg-[#1C2844] p-2 rounded-lg border border-[#2B3B5B]">
                  <span className="text-[10px] font-mono text-[#A1ADC7] block uppercase">g(n) (Exact)</span>
                  <span className="text-sm font-mono font-bold text-[#6FAFFF]">
                    {telemetry.g.toFixed(1)}
                  </span>
                </div>
                <div className="bg-[#1C2844] p-2 rounded-lg border border-[#2B3B5B]">
                  <span className="text-[10px] font-mono text-[#A1ADC7] block uppercase">h(n) (Heuristic)</span>
                  <span className="text-sm font-mono font-bold text-[#A695F2]">
                    {telemetry.h.toFixed(1)}
                  </span>
                </div>
                <div className="bg-[#1C2844] p-2 rounded-lg border border-[#66DAD5]/40">
                  <span className="text-[10px] font-mono text-[#66DAD5] font-semibold block uppercase">f(n) (Total)</span>
                  <span className="text-sm font-mono font-bold text-[#66DAD5]">
                    {telemetry.f.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-[#A1ADC7] leading-relaxed">
              <p>
                <strong className="text-[#6FAFFF]">Exact Cost g(n):</strong> Accumulated movement cost from Start cell ({gridModel.start.r}, {gridModel.start.c}) to the evaluated node. Orthogonal step = 1.0, diagonal = √2, rough terrain = 3.0×.
              </p>
              <p>
                <strong className="text-[#A695F2]">Heuristic Estimate h(n):</strong> Admissible estimation from node ({telemetry.r}, {telemetry.c}) to Target ({gridModel.target.r}, {gridModel.target.c}).
              </p>
              <p className="bg-[#151F36] p-2.5 rounded-lg border border-[#2B3B5B] text-[11px]">
                <strong className="text-[#86E3B4]">Admissibility Theorem:</strong> Because h(n) ≤ h*(n) (the true optimal cost) without heuristic inflation (weight = 1.00), A* is mathematically guaranteed to return an optimal path equivalent to Dijkstra, while exploring significantly fewer nodes.
              </p>
            </div>

            <button
              onClick={() => setAnalysisModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#66DAD5] to-[#6FAFFF] text-[#151F36] font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity"
            >
              Resume Mission
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
