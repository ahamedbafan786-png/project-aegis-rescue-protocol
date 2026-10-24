import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { findPathAStar } from '../algorithms/astar';
import { findPathBFS } from '../algorithms/bfs';
import { findPathDijkstra } from '../algorithms/dijkstra';
import { AlgorithmMetrics, GridCoord, PathResult, TileType } from '../algorithms/types';
import { sound } from '../game/soundEngine';

interface BenchmarkStat {
  median: number;
  variance: number;
  min: number;
  max: number;
}

export const AlgorithmArena: React.FC = () => {
  // Preset arena maps
  const [mapType, setMapType] = useState<'corridor' | 'open' | 'maze' | 'weighted'>('corridor');
  const [activeTab, setActiveTab] = useState<'astar' | 'dijkstra' | 'bfs'>('astar');

  const rows = 13;
  const cols = 21;
  const start: GridCoord = { r: 6, c: 2 };
  const goal: GridCoord = { r: 6, c: 18 };

  // Generate map tiles
  const getArenaGrid = (): TileType[][] => {
    const grid: TileType[][] = Array.from({ length: rows }, () => Array(cols).fill('EMPTY'));

    if (mapType === 'corridor') {
      // Central barrier with upper and lower bypass
      for (let r = 3; r <= 9; r++) {
        grid[r][10] = 'WALL';
      }
      grid[3][10] = 'EMPTY'; // Upper bypass
      grid[9][10] = 'EMPTY'; // Lower bypass
    } else if (mapType === 'maze') {
      // Dense pillars
      for (let r = 2; r < rows - 2; r += 2) {
        for (let c = 4; c < cols - 4; c += 2) {
          grid[r][c] = 'WALL';
        }
      }
    } else if (mapType === 'weighted') {
      // Center highway is rough terrain (cost 3.0), bypass above and below is open (cost 1.0)
      for (let r = 4; r <= 8; r++) {
        for (let c = 7; c <= 13; c++) {
          grid[r][c] = 'ROUGH_TERRAIN';
        }
      }
    }

    grid[start.r][start.c] = 'START';
    grid[goal.r][goal.c] = 'TARGET';
    return grid;
  };

  const [results, setResults] = useState<{
    astar: PathResult | null;
    dijkstra: PathResult | null;
    bfs: PathResult | null;
  }>({
    astar: null,
    dijkstra: null,
    bfs: null,
  });

  const [benchStats, setBenchStats] = useState<{
    astar: BenchmarkStat;
    dijkstra: BenchmarkStat;
    bfs: BenchmarkStat;
  }>({
    astar: { median: 0, variance: 0, min: 0, max: 0 },
    dijkstra: { median: 0, variance: 0, min: 0, max: 0 },
    bfs: { median: 0, variance: 0, min: 0, max: 0 },
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const runBenchmark = () => {
    sound.playDeploy();
    const grid = getArenaGrid();

    const ITERATIONS = 7;
    const astarTimes: number[] = [];
    const dijkstraTimes: number[] = [];
    const bfsTimes: number[] = [];

    let astarRes: PathResult | null = null;
    let dijkstraRes: PathResult | null = null;
    let bfsRes: PathResult | null = null;

    for (let i = 0; i < ITERATIONS; i++) {
      const a = findPathAStar({
        grid,
        rows,
        cols,
        start,
        goal,
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      astarTimes.push(a.executionTimeMs);
      if (i === 0) astarRes = a;

      const d = findPathDijkstra({
        grid,
        rows,
        cols,
        start,
        goal,
        movementMode: '4-directional',
      });
      dijkstraTimes.push(d.executionTimeMs);
      if (i === 0) dijkstraRes = d;

      const b = findPathBFS({
        grid,
        rows,
        cols,
        start,
        goal,
        movementMode: '4-directional',
      });
      bfsTimes.push(b.executionTimeMs);
      if (i === 0) bfsRes = b;
    }

    const calcStats = (times: number[]): BenchmarkStat => {
      const sorted = [...times].sort((x, y) => x - y);
      const median = sorted[Math.floor(sorted.length / 2)];
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const variance = (max - min) / 2;
      return { median, variance, min, max };
    };

    setResults({
      astar: astarRes,
      dijkstra: dijkstraRes,
      bfs: bfsRes,
    });

    setBenchStats({
      astar: calcStats(astarTimes),
      dijkstra: calcStats(dijkstraTimes),
      bfs: calcStats(bfsTimes),
    });
  };

  useEffect(() => {
    runBenchmark();
  }, [mapType]);

  // Render comparative grid view for the active tab
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 700;
    const h = 340;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const pad = 12;
    const availW = w - pad * 2;
    const availH = h - pad * 2;
    const tileSize = Math.floor(Math.min(availW / cols, availH / rows));
    const offsetX = Math.floor((w - cols * tileSize) / 2);
    const offsetY = Math.floor((h - rows * tileSize) / 2);

    ctx.fillStyle = '#151F36';
    ctx.fillRect(0, 0, w, h);

    const grid = getArenaGrid();
    const currentRes = results[activeTab];

    const exploredSet = new Set(currentRes?.exploredNodes.map((p) => `${p.r},${p.c}`) || []);
    const pathSet = new Set(currentRes?.path.map((p) => `${p.r},${p.c}`) || []);

    // Draw tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * tileSize;
        const y = offsetY + r * tileSize;
        const key = `${r},${c}`;

        let fill = '#1E2B47';
        let stroke = '#2B3B5B';

        if (grid[r][c] === 'WALL') {
          fill = '#121A2B';
        } else if (grid[r][c] === 'ROUGH_TERRAIN') {
          fill = pathSet.has(key) ? (activeTab === 'astar' ? '#66DAD5' : activeTab === 'dijkstra' ? '#6FAFFF' : '#A695F2') : 'rgba(245, 207, 121, 0.25)';
          stroke = 'rgba(245, 207, 121, 0.8)';
        } else if (pathSet.has(key)) {
          fill = activeTab === 'astar' ? '#66DAD5' : activeTab === 'dijkstra' ? '#6FAFFF' : '#A695F2';
        } else if (exploredSet.has(key)) {
          fill = 'rgba(166, 149, 242, 0.28)';
        }

        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, tileSize - 2, tileSize - 2, 3);
        ctx.fill();
        ctx.stroke();

        // Start / Target symbols
        if (r === start.r && c === start.c) {
          ctx.fillStyle = '#6FAFFF';
          ctx.beginPath();
          ctx.arc(x + tileSize / 2, y + tileSize / 2, Math.max(0.1, tileSize * 0.35), 0, Math.PI * 2);
          ctx.fill();
        } else if (r === goal.r && c === goal.c) {
          ctx.fillStyle = '#86E3B4';
          ctx.beginPath();
          ctx.arc(x + tileSize / 2, y + tileSize / 2, Math.max(0.1, tileSize * 0.35), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [results, activeTab, mapType]);

  return (
    <div className="flex-1 w-full bg-[#151F36] text-[#F5F7FF] p-4 sm:p-8 select-none overflow-y-auto">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#2B3B5B] pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#6FAFFF] tracking-wider uppercase mb-1">
              <Layers className="w-4 h-4" />
              Comparative Evaluation Arena
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FF]">
              ALGORITHM ARENA
            </h2>
            <p className="text-xs sm:text-sm text-[#A1ADC7] mt-1">
              Rigorous comparative analysis across A*, Dijkstra, and Breadth-First Search on identical map topographies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#A1ADC7]">Topology:</span>
            {(['corridor', 'open', 'maze', 'weighted'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  sound.playClick();
                  setMapType(m);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold capitalize border transition-all ${
                  mapType === m
                    ? 'bg-[#6FAFFF] text-[#151F36] border-[#6FAFFF] font-bold'
                    : 'bg-[#1C2844] text-[#A1ADC7] border-[#2B3B5B] hover:text-[#F5F7FF]'
                }`}
              >
                {m}
              </button>
            ))}

            <button
              onClick={runBenchmark}
              className="ml-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#66DAD5] to-[#6FAFFF] text-[#151F36] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-[#66DAD5]/20 hover:scale-[1.02] transition-transform"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Benchmark (7x)</span>
            </button>
          </div>
        </div>

        {/* Triple Benchmark Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* A* Card */}
          <div
            onClick={() => setActiveTab('astar')}
            className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'astar'
                ? 'bg-[#1C2844] border-[#66DAD5] shadow-lg shadow-[#66DAD5]/15'
                : 'bg-[#1C2844]/60 border-[#2B3B5B] hover:border-[#66DAD5]/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-[#66DAD5] uppercase tracking-wider">
                Heuristic A*
              </span>
              <span className="text-[10px] bg-[#66DAD5]/15 text-[#66DAD5] px-2 py-0.5 rounded font-mono font-bold">
                f = g + h
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Nodes Expanded:</span>
                <span className="font-mono font-bold text-[#66DAD5]">
                  {results.astar?.nodesExpandedCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Path Nodes (N):</span>
                <span className="font-mono font-bold text-[#F5F7FF]">
                  {results.astar?.path.length ?? 0} cells
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Movement Steps:</span>
                <span className="font-mono font-bold text-[#6FAFFF]">
                  {Math.max(0, (results.astar?.path.length ?? 1) - 1)} steps
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Route Cost:</span>
                <span className="font-mono font-bold text-[#86E3B4]">
                  {results.astar?.totalCost.toFixed(1) ?? '0.0'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#A1ADC7]">Runtime (Median):</span>
                <span className="font-mono font-bold text-[#F5CF79]">
                  {benchStats.astar.median.toFixed(2)} ms (±{benchStats.astar.variance.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          {/* Dijkstra Card */}
          <div
            onClick={() => setActiveTab('dijkstra')}
            className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'dijkstra'
                ? 'bg-[#1C2844] border-[#6FAFFF] shadow-lg shadow-[#6FAFFF]/15'
                : 'bg-[#1C2844]/60 border-[#2B3B5B] hover:border-[#6FAFFF]/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-[#6FAFFF] uppercase tracking-wider">
                Dijkstra's Algorithm
              </span>
              <span className="text-[10px] bg-[#6FAFFF]/15 text-[#6FAFFF] px-2 py-0.5 rounded font-mono font-bold">
                h(n) = 0
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Nodes Expanded:</span>
                <span className="font-mono font-bold text-[#6FAFFF]">
                  {results.dijkstra?.nodesExpandedCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Path Nodes (N):</span>
                <span className="font-mono font-bold text-[#F5F7FF]">
                  {results.dijkstra?.path.length ?? 0} cells
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Movement Steps:</span>
                <span className="font-mono font-bold text-[#6FAFFF]">
                  {Math.max(0, (results.dijkstra?.path.length ?? 1) - 1)} steps
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Route Cost:</span>
                <span className="font-mono font-bold text-[#86E3B4]">
                  {results.dijkstra?.totalCost.toFixed(1) ?? '0.0'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#A1ADC7]">Runtime (Median):</span>
                <span className="font-mono font-bold text-[#F5CF79]">
                  {benchStats.dijkstra.median.toFixed(2)} ms (±{benchStats.dijkstra.variance.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          {/* BFS Card */}
          <div
            onClick={() => setActiveTab('bfs')}
            className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'bfs'
                ? 'bg-[#1C2844] border-[#A695F2] shadow-lg shadow-[#A695F2]/15'
                : 'bg-[#1C2844]/60 border-[#2B3B5B] hover:border-[#A695F2]/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-[#A695F2] uppercase tracking-wider">
                Breadth-First Search
              </span>
              <span className="text-[10px] bg-[#A695F2]/15 text-[#A695F2] px-2 py-0.5 rounded font-mono font-bold">
                FIFO Queue
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Nodes Expanded:</span>
                <span className="font-mono font-bold text-[#A695F2]">
                  {results.bfs?.nodesExpandedCount ?? 0}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Path Nodes (N):</span>
                <span className="font-mono font-bold text-[#F5F7FF]">
                  {results.bfs?.path.length ?? 0} cells
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Movement Steps:</span>
                <span className="font-mono font-bold text-[#6FAFFF]">
                  {Math.max(0, (results.bfs?.path.length ?? 1) - 1)} steps
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#2B3B5B]/60">
                <span className="text-[#A1ADC7]">Route Cost:</span>
                <span className="font-mono font-bold text-[#86E3B4]">
                  {results.bfs?.totalCost.toFixed(1) ?? '0.0'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#A1ADC7]">Runtime (Median):</span>
                <span className="font-mono font-bold text-[#F5CF79]">
                  {benchStats.bfs.median.toFixed(2)} ms (±{benchStats.bfs.variance.toFixed(2)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Inspection Map */}
        <div className="bg-[#1C2844] rounded-2xl border border-[#2B3B5B] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-[#A1ADC7] uppercase tracking-wider">
              Visual Exploration Overlay — Inspecting: <strong className="text-[#F5F7FF] uppercase">{activeTab}</strong>
            </span>
            <div className="flex items-center gap-3 text-[11px] font-mono text-[#A1ADC7]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500/50" /> Explored Nodes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#66DAD5]" /> Confirmed Shortest Path
              </span>
            </div>
          </div>

          <div className="w-full flex items-center justify-center bg-[#151F36] rounded-xl overflow-hidden border border-[#2B3B5B]">
            <canvas ref={canvasRef} className="max-w-full" />
          </div>
        </div>

        {/* Academic DSA Synthesis */}
        <div className="bg-[#1C2844]/60 rounded-2xl border border-[#2B3B5B] p-6 space-y-3">
          <h3 className="text-base font-bold text-[#F5F7FF] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#66DAD5]" />
            Data Structures & Algorithms Theory Commentary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#A1ADC7] leading-relaxed">
            <p>
              <strong className="text-[#66DAD5]">Heuristic Search Pruning:</strong> Because Manhattan/Octile heuristics are <strong className="text-[#F5F7FF]">strictly admissible</strong> (h(n) ≤ h*(n) with zero heuristic inflation), A* prioritizes nodes directed toward the destination, reducing exploratory node overhead while mathematically guaranteeing that the final route cost is identical to Dijkstra's optimal shortest path.
            </p>
            <p>
              <strong className="text-[#F5CF79]">Weighted Terrain Dynamics:</strong> On weighted terrain (Rough Terrain cost = 3.0×), standard BFS only counts step hops and naively traverses through rough ground, yielding a suboptimal total cost. In contrast, both A* and Dijkstra compute true cost-optimal detours, with A* expanding significantly fewer search nodes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
