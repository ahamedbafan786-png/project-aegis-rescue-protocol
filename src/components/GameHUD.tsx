import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Compass,
  Eraser,
  Flame,
  Footprints,
  Info,
  Maximize2,
  MapPin,
  Minimize2,
  Move,
  Pause,
  Play,
  RotateCcw,
  Route,
  Settings,
  Shuffle,
  Sparkles,
  Square,
  StepForward,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react';
import { findPathAStar, isTileBlocked } from '../algorithms/astar';
import {
  GridCoord,
  HeuristicType,
  MovementMode,
  PathResult,
  RobotState,
  TileType,
} from '../algorithms/types';
import { AegisRenderer } from '../game/aegisRenderer';
import { GridModel } from '../game/gridModel';
import { RobotController } from '../game/robotController';
import { sound } from '../game/soundEngine';
import { MissionDefinition } from '../missions/missionData';

interface GameHUDProps {
  mission: MissionDefinition;
  onMissionComplete: (stats: { steps: number; replans: number; cost: number }) => void;
  onExit: () => void;
}

export type ToolType = 'wall' | 'rough' | 'eraser' | 'start' | 'target';

export const GameHUD: React.FC<GameHUDProps> = ({
  mission,
  onMissionComplete,
  onExit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<AegisRenderer | null>(null);

  // Models
  const [gridModel, setGridModel] = useState<GridModel>(() => {
    const model = new GridModel(mission.rows, mission.cols, mission.start, mission.target);
    mission.initialWalls.forEach((w) => model.setTile(w.r, w.c, 'WALL'));
    mission.initialRoughTerrain?.forEach((t) => model.setTile(t.r, t.c, 'ROUGH_TERRAIN'));
    return model;
  });

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
    replans: 0,
    executionTimeMs: 0,
  });

  // Step-by-Step Teaching Mode
  const [stepSearchActive, setStepSearchActive] = useState<boolean>(false);
  const [stepSearchFrames, setStepSearchFrames] = useState<PathResult | null>(null);
  const [currentStepFrameIndex, setCurrentStepFrameIndex] = useState<number>(0);

  // Run A* Calculation
  const calculatePath = useCallback(
    (startCoord?: GridCoord) => {
      const from = startCoord || robotRef.current.logicalPos;
      const res = findPathAStar({
        grid: gridModel.tiles,
        rows: gridModel.rows,
        cols: gridModel.cols,
        start: from,
        goal: gridModel.target,
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
    [gridModel, movementMode, heuristicType]
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
    robotRef.current.setPath(initialRes.path);

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
          cost: telemetry.pathCost,
        });
      }

      // Render Canvas
      if (rendererRef.current) {
        rendererRef.current.render(gridModel, robot, activePath, deltaSec);
      }

      // Update Live Telemetry
      const tel = robot.getTelemetry();
      setTelemetry((prev) => ({
        ...prev,
        r: tel.currentLogicalCoord.r,
        c: tel.currentLogicalCoord.c,
        replans: tel.replansCount,
      }));

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gridModel, activePath, speedMultiplier, robotState, telemetry.pathCost, onMissionComplete]);

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
      const newPlan = calculatePath(currentValid);

      if (newPlan.found) {
        robot.setPath(newPlan.path);
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
      const res = calculatePath(robot.logicalPos);
      if (res.found) {
        robot.setPath(res.path);
        robot.startMoving();
      }
    } else if (robot.state === 'MOVING') {
      robot.pause();
    } else if (robot.state === 'ARRIVED' || robot.state === 'FAILED') {
      // Reset and replay
      robot.reset(gridModel.start);
      const res = calculatePath(gridModel.start);
      robot.setPath(res.path);
    }
  };

  // Reset Simulation Handler
  const handleReset = () => {
    sound.playClick();
    const robot = robotRef.current;
    robot.reset(gridModel.start);
    const res = calculatePath(gridModel.start);
    robot.setPath(res.path);
    setRobotState('IDLE');
    setStatusMessage('SYSTEM STANDBY');
  };

  // Dynamic Blockage Trigger (The Core Demonstration Feature)
  const handleTriggerBlockage = () => {
    const robot = robotRef.current;

    // Pick target tile to block
    let blockCoord: GridCoord | null = null;

    if (mission.demoBlockageCoord && !isTileBlocked(gridModel.tiles[mission.demoBlockageCoord.r][mission.demoBlockageCoord.c])) {
      blockCoord = mission.demoBlockageCoord;
    } else if (activePath.length > robot.currentWaypointIndex + 2) {
      // Block the waypoint 2 steps ahead of the robot's current position
      blockCoord = activePath[robot.currentWaypointIndex + 2];
    } else if (activePath.length > robot.currentWaypointIndex + 1) {
      blockCoord = activePath[robot.currentWaypointIndex + 1];
    }

    if (!blockCoord) {
      // Fallback: pick any open cell between robot and target
      const midR = Math.floor((robot.logicalPos.r + gridModel.target.r) / 2);
      const midC = Math.floor((robot.logicalPos.c + gridModel.target.c) / 2);
      blockCoord = { r: midR, c: midC };
    }

    // Place Wall directly into authoritative grid
    const nextModel = gridModel.clone();
    nextModel.setTile(blockCoord.r, blockCoord.c, 'WALL');
    setGridModel(nextModel);

    rendererRef.current?.addDustParticles(blockCoord.r, blockCoord.c, 10);

    // Prompt robot to inspect remaining path
    const isBlocked = robot.checkPathBlocked((r, c) => nextModel.tiles[r][c] === 'WALL' || nextModel.tiles[r][c] === 'DEBRIS');

    // If robot wasn't moving yet, recalculate immediately
    if (!isBlocked && robot.state !== 'MOVING') {
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
      robot.setPath(res.path);
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
      if (changed) rendererRef.current.addDustParticles(coord.r, coord.c, 4);
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
      robot.checkPathBlocked((r, c) => nextModel.tiles[r][c] === 'WALL' || nextModel.tiles[r][c] === 'DEBRIS');

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
        robot.setPath(res.path);
      }
    }
  };

  // Keyboard Shortcuts (Space: Play/Pause, R: Reset, B: Blockage)
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

  return (
    <div className="flex-1 w-full bg-[#17233D] text-[#F5F7FF] flex flex-col select-none overflow-hidden">
      {/* Top Tactical Status Bar */}
      <div className="bg-[#1F2C47] border-b border-[#2B3B5B] px-5 py-2.5 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#66DAD5] uppercase tracking-wider">
                {mission.codename}
              </span>
              <span className="text-sm font-bold text-[#F5F7FF]">{mission.title}</span>
            </div>
            <span className="text-[11px] text-[#A1ADC7]">{mission.subtitle}</span>
          </div>
        </div>

        {/* Dynamic Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 border shadow-sm ${
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
              className={`w-2 h-2 rounded-full ${
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

        {/* Speed Controls */}
        <div className="flex items-center gap-1.5 bg-[#17233D] px-2 py-1 rounded-lg border border-[#2B3B5B]">
          <span className="text-[11px] font-mono text-[#A1ADC7] mr-1.5">Speed:</span>
          {[0.5, 1.0, 2.0, 5.0, 100].map((s) => (
            <button
              key={s}
              onClick={() => {
                sound.playClick();
                setSpeedMultiplier(s);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all ${
                speedMultiplier === s
                  ? 'bg-[#66DAD5] text-[#17233D] font-bold'
                  : 'text-[#A1ADC7] hover:text-[#F5F7FF]'
              }`}
            >
              {s === 100 ? 'Instant' : `${s}x`}
            </button>
          ))}
        </div>
      </div>

      {/* Main HUD Center Area (Grid Canvas + Left & Right Docks) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toolbar Dock */}
        <div className="w-56 bg-[#1F2C47]/95 border-r border-[#2B3B5B] p-3.5 flex flex-col justify-between shrink-0 z-10 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* Terrain Tools */}
            <div>
              <span className="text-[11px] font-mono font-bold text-[#A1ADC7] tracking-wider uppercase block mb-2">
                Terrain Tools
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => {
                    sound.playClick();
                    setActiveTool('wall');
                  }}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    activeTool === 'wall'
                      ? 'bg-[#2B3B5B] border-[#66DAD5] text-[#66DAD5] shadow-sm'
                      : 'bg-[#17233D]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
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
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    activeTool === 'rough'
                      ? 'bg-[#2B3B5B] border-[#F5CF79] text-[#F5CF79] shadow-sm'
                      : 'bg-[#17233D]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
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
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    activeTool === 'eraser'
                      ? 'bg-[#2B3B5B] border-[#FF9B83] text-[#FF9B83] shadow-sm'
                      : 'bg-[#17233D]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
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
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    activeTool === 'start'
                      ? 'bg-[#2B3B5B] border-[#6FAFFF] text-[#6FAFFF] shadow-sm'
                      : 'bg-[#17233D]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
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
                  className={`col-span-2 flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    activeTool === 'target'
                      ? 'bg-[#2B3B5B] border-[#86E3B4] text-[#86E3B4] shadow-sm'
                      : 'bg-[#17233D]/60 border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF]'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Relocate Target
                </button>
              </div>
            </div>

            {/* Map Generation Actions */}
            <div>
              <span className="text-[11px] font-mono font-bold text-[#A1ADC7] tracking-wider uppercase block mb-2">
                Grid Presets
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#17233D] hover:bg-[#253554] border border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF] transition-colors"
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#17233D] hover:bg-[#253554] border border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF] transition-colors"
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#17233D] hover:bg-[#253554] border border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Obstacles
                </button>
              </div>
            </div>

            {/* Heuristic & Movement Settings */}
            <div>
              <span className="text-[11px] font-mono font-bold text-[#A1ADC7] tracking-wider uppercase block mb-2">
                Search Model
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium bg-[#17233D] p-1.5 rounded-lg border border-[#2B3B5B]">
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

                <div className="flex items-center justify-between text-xs font-medium bg-[#17233D] p-1.5 rounded-lg border border-[#2B3B5B]">
                  <span className="text-[#A1ADC7]">Heuristic:</span>
                  <select
                    value={heuristicType}
                    onChange={(e) => {
                      sound.playClick();
                      setHeuristicType(e.target.value as HeuristicType);
                    }}
                    className="bg-transparent font-mono text-[#66DAD5] text-xs font-semibold focus:outline-none"
                  >
                    <option value="manhattan" className="bg-[#17233D] text-[#F5F7FF]">Manhattan</option>
                    <option value="octile" className="bg-[#17233D] text-[#F5F7FF]">Octile</option>
                    <option value="euclidean" className="bg-[#17233D] text-[#F5F7FF]">Euclidean</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Return button */}
          <button
            onClick={() => {
              sound.playClick();
              onExit();
            }}
            className="w-full text-center text-xs text-[#A1ADC7] hover:text-[#F5F7FF] py-2 border-t border-[#2B3B5B] mt-4"
          >
            ← Return to Mission Select
          </button>
        </div>

        {/* Center Canvas Viewport */}
        <div className="flex-1 h-full bg-[#17233D] flex items-center justify-center relative overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className="w-full h-full cursor-crosshair"
          />
        </div>

        {/* Right Telemetry Dock */}
        <div className="w-64 bg-[#1F2C47]/95 border-l border-[#2B3B5B] p-4 flex flex-col justify-between shrink-0 z-10 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* Live Algorithm Math Card */}
            <div className="bg-[#17233D] rounded-xl p-3.5 border border-[#2B3B5B]">
              <span className="text-[11px] font-mono font-bold text-[#66DAD5] tracking-wider uppercase block mb-1">
                A* Cost Formula
              </span>
              <div className="text-center py-2 bg-[#202C49] rounded-lg border border-[#2B3B5B]/80 font-mono text-sm font-bold text-[#F5F7FF]">
                f(n) = g(n) + h(n)
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="bg-[#17233D] p-1.5 rounded border border-[#2B3B5B]">
                  <span className="text-[10px] text-[#A1ADC7] block">g(n)</span>
                  <span className="text-xs font-mono font-bold text-[#6FAFFF]">
                    {telemetry.g.toFixed(1)}
                  </span>
                </div>
                <div className="bg-[#17233D] p-1.5 rounded border border-[#2B3B5B]">
                  <span className="text-[10px] text-[#A1ADC7] block">h(n)</span>
                  <span className="text-xs font-mono font-bold text-[#A695F2]">
                    {telemetry.h.toFixed(1)}
                  </span>
                </div>
                <div className="bg-[#17233D] p-1.5 rounded border border-[#66DAD5]/40">
                  <span className="text-[10px] text-[#66DAD5] font-semibold block">f(n)</span>
                  <span className="text-xs font-mono font-bold text-[#66DAD5]">
                    {telemetry.f.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Mission Statistics */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono font-bold text-[#A1ADC7] tracking-wider uppercase">
                Telemetry Metrics
              </span>

              <div className="bg-[#17233D] p-2.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                <span className="text-[#A1ADC7]">Robot Position:</span>
                <span className="font-mono font-bold text-[#F5F7FF]">
                  ({telemetry.r}, {telemetry.c})
                </span>
              </div>

              <div className="bg-[#17233D] p-2.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                <span className="text-[#A1ADC7]">Nodes Explored:</span>
                <span className="font-mono font-bold text-[#66DAD5]">
                  {telemetry.nodesExpanded}
                </span>
              </div>

              <div className="bg-[#17233D] p-2.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                <span className="text-[#A1ADC7]">Path Length:</span>
                <span className="font-mono font-bold text-[#6FAFFF]">
                  {telemetry.pathLength} tiles
                </span>
              </div>

              <div className="bg-[#17233D] p-2.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                <span className="text-[#A1ADC7]">Total Cost:</span>
                <span className="font-mono font-bold text-[#86E3B4]">
                  {telemetry.pathCost.toFixed(2)}
                </span>
              </div>

              <div className="bg-[#17233D] p-2.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                <span className="text-[#A1ADC7]">Replans Triggered:</span>
                <span className="font-mono font-bold text-[#FF9B83]">
                  {telemetry.replans}
                </span>
              </div>

              <div className="bg-[#17233D] p-2.5 rounded-lg border border-[#2B3B5B] flex items-center justify-between text-xs">
                <span className="text-[#A1ADC7]">Search Runtime:</span>
                <span className="font-mono font-bold text-[#F5CF79]">
                  {telemetry.executionTimeMs.toFixed(2)} ms
                </span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts Info */}
          <div className="text-[10px] text-[#A1ADC7]/70 font-mono mt-4 pt-3 border-t border-[#2B3B5B] flex flex-col gap-1">
            <span>[Space] Deploy / Pause</span>
            <span>[R] Reset Simulation</span>
            <span>[B] Trigger Blockage</span>
          </div>
        </div>
      </div>

      {/* Bottom Command Action Deck */}
      <div className="bg-[#1F2C47] border-t border-[#2B3B5B] px-6 py-3 flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          {/* Main Deploy / Pause Button */}
          <button
            onClick={handleToggleDeploy}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all ${
              robotState === 'MOVING'
                ? 'bg-[#F5CF79] text-[#17233D] hover:bg-[#F5CF79]/90'
                : 'bg-gradient-to-r from-[#66DAD5] to-[#6FAFFF] text-[#17233D] shadow-[#66DAD5]/25 hover:scale-[1.02] active:scale-[0.98]'
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
            className="px-3.5 py-2.5 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-semibold text-xs tracking-wide flex items-center gap-1.5 transition-all"
            title="Advance search visualization by one node"
          >
            <StepForward className="w-4 h-4 text-[#A695F2]" />
            Step Search
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="px-3.5 py-2.5 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-semibold text-xs tracking-wide flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-4 h-4 text-[#A1ADC7]" />
            Reset
          </button>
        </div>

        {/* WOW Feature: Trigger Mid-Transit Blockage */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTriggerBlockage}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF9B83] to-[#FF7B60] hover:from-[#FF7B60] hover:to-[#FF6B50] text-[#17233D] font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-[#FF9B83]/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 border border-[#FF9B83]"
            title="Drop an obstacle directly onto the active path to trigger real-time dynamic replanning"
          >
            <AlertOctagon className="w-4 h-4" />
            Trigger Blockage (Dynamic Replanning)
          </button>
        </div>
      </div>
    </div>
  );
};
