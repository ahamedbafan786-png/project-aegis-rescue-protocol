import React, { useEffect, useRef } from 'react';
import {
  Compass,
  Cpu,
  GraduationCap,
  Layers,
  MonitorPlay,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { sound } from '../game/soundEngine';
import { ScreenMode } from './Navbar';

interface MainMenuProps {
  onSelectScreen: (screen: ScreenMode) => void;
  onLaunchSandbox: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onSelectScreen,
  onLaunchSandbox,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Decorative hero animation of Aegis-1 in patrol loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 320 * dpr;
    canvas.height = 320 * dpr;
    ctx.scale(dpr, dpr);

    const renderHero = () => {
      angle += 0.015;
      ctx.clearRect(0, 0, 320, 320);

      const cx = 160;
      const cy = 160;

      // Concentric tactical rings
      ctx.strokeStyle = 'rgba(43, 59, 91, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(102, 218, 213, 0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, 90, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating radar sweep
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const sweepGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 120);
      sweepGrad.addColorStop(0, 'rgba(102, 218, 213, 0.35)');
      sweepGrad.addColorStop(1, 'rgba(102, 218, 213, 0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 120, -Math.PI * 0.25, Math.PI * 0.25);
      ctx.closePath();
      ctx.fill();

      // Robot chassis ("Aegis-1")
      const radius = 32;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;

      const hullGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
      hullGrad.addColorStop(0, '#465A84');
      hullGrad.addColorStop(0.5, '#2D3D5E');
      hullGrad.addColorStop(1, '#1E2B45');
      ctx.fillStyle = hullGrad;
      ctx.beginPath();
      ctx.roundRect(-radius, -radius * 0.8, radius * 2, radius * 1.6, 12);
      ctx.fill();

      ctx.strokeStyle = '#6FAFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Front visor
      ctx.fillStyle = '#101B2E';
      ctx.beginPath();
      ctx.roundRect(radius * 0.1, -radius * 0.5, radius * 0.8, radius * 1.0, 4);
      ctx.fill();

      // Sensor eye
      ctx.fillStyle = '#66DAD5';
      ctx.shadowColor = '#66DAD5';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(radius * 0.55, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Center power core
      ctx.beginPath();
      ctx.arc(-radius * 0.2, 0, 5 + Math.sin(angle * 4) * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(renderHero);
    };

    renderHero();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="flex-1 w-full bg-gradient-to-b from-[#17233D] via-[#1D2A47] to-[#141E34] text-[#F5F7FF] flex flex-col justify-between p-6 sm:p-10 select-none overflow-y-auto">
      {/* Hero Header & Title */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto">
        <div className="lg:col-span-7 flex flex-col items-start gap-4">
          <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#66DAD5]/10 border border-[#66DAD5]/30">
            <Sparkles className="w-3.5 h-3.5 text-[#66DAD5]" />
            <span className="text-xs font-semibold tracking-wider text-[#66DAD5] uppercase">
              Autonomous Robot Pathfinding System
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none bg-gradient-to-r from-[#F5F7FF] via-[#E2E8F8] to-[#6FAFFF] bg-clip-text text-transparent">
            PROJECT AEGIS
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold tracking-widest text-[#66DAD5] uppercase -mt-1">
            RESCUE PROTOCOL
          </h2>

          <p className="text-sm sm:text-base text-[#A1ADC7] leading-relaxed max-w-xl">
            Command intelligent rescue droid <strong className="text-[#F5F7FF]">Aegis-1</strong> across dangerous disaster environments. Powered by a mathematically rigorous, admissible <strong className="text-[#66DAD5]">A* Pathfinding Algorithm</strong> featuring true <strong className="text-[#FF9B83]">real-time dynamic replanning</strong> when obstacles appear mid-transit.
          </p>

          {/* Primary Action Button Grid */}
          <div className="flex flex-wrap gap-3.5 mt-2 w-full">
            <button
              onClick={() => {
                sound.playClick();
                onSelectScreen('missions');
              }}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#66DAD5] to-[#6FAFFF] text-[#17233D] font-bold text-sm tracking-wider uppercase shadow-lg shadow-[#66DAD5]/25 hover:shadow-[#66DAD5]/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2.5"
            >
              <Play className="w-4 h-4 fill-current" />
              Launch Missions
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onLaunchSandbox();
              }}
              className="px-5 py-3.5 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-semibold text-sm tracking-wide transition-all flex items-center gap-2"
            >
              <Cpu className="w-4 h-4 text-[#66DAD5]" />
              Sandbox Lab
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onSelectScreen('arena');
              }}
              className="px-5 py-3.5 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-semibold text-sm tracking-wide transition-all flex items-center gap-2"
            >
              <Layers className="w-4 h-4 text-[#6FAFFF]" />
              Algorithm Arena
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onSelectScreen('presentation');
              }}
              className="px-5 py-3.5 rounded-xl bg-[#FF9B83]/15 hover:bg-[#FF9B83]/25 border border-[#FF9B83]/50 text-[#FF9B83] font-bold text-sm tracking-wide transition-all flex items-center gap-2 shadow-sm"
            >
              <MonitorPlay className="w-4 h-4" />
              College Demo Mode
            </button>
          </div>
        </div>

        {/* Hero Character Canvas */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          <div className="w-[300px] h-[300px] sm:w-[320px] sm:h-[320px] rounded-3xl bg-[#1F2C47]/80 border border-[#2B3B5B] shadow-2xl flex items-center justify-center p-2 relative overflow-hidden">
            <canvas ref={canvasRef} className="w-[300px] h-[300px] relative z-10" />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-[#A1ADC7] bg-[#17233D]/80 px-3 py-1.5 rounded-lg border border-[#2B3B5B] z-20">
              <span className="flex items-center gap-1.5 text-[#66DAD5]">
                <span className="w-2 h-2 rounded-full bg-[#66DAD5] animate-ping" />
                AEGIS-1 ONLINE
              </span>
              <span>HEURISTIC: ADMISSIBLE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Specification Badges */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-8 border-t border-[#2B3B5B] pt-6">
        <div className="bg-[#1F2C47]/50 border border-[#2B3B5B] p-3.5 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#66DAD5]/10 border border-[#66DAD5]/30 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-[#66DAD5]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F7FF] uppercase">Pure TypeScript A*</h4>
            <p className="text-[11px] text-[#A1ADC7] leading-tight mt-0.5">
              Custom binary MinHeap priority queue with optimal tie-breaking.
            </p>
          </div>
        </div>

        <div className="bg-[#1F2C47]/50 border border-[#2B3B5B] p-3.5 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF9B83]/10 border border-[#FF9B83]/30 flex items-center justify-center shrink-0">
            <RotateCcw className="w-4 h-4 text-[#FF9B83]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F7FF] uppercase">Dynamic Replanning</h4>
            <p className="text-[11px] text-[#A1ADC7] leading-tight mt-0.5">
              Robot detects blockages mid-transit and recalculates without teleportation.
            </p>
          </div>
        </div>

        <div className="bg-[#1F2C47]/50 border border-[#2B3B5B] p-3.5 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#6FAFFF]/10 border border-[#6FAFFF]/30 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-[#6FAFFF]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F7FF] uppercase">Algorithm Arena</h4>
            <p className="text-[11px] text-[#A1ADC7] leading-tight mt-0.5">
              Side-by-side benchmark comparing A*, Dijkstra, and BFS on equal maps.
            </p>
          </div>
        </div>

        <div className="bg-[#1F2C47]/50 border border-[#2B3B5B] p-3.5 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#A695F2]/10 border border-[#A695F2]/30 flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-[#A695F2]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F7FF] uppercase">Viva Ready</h4>
            <p className="text-[11px] text-[#A1ADC7] leading-tight mt-0.5">
              Built-in Algorithm Academy and 1-Click College Presentation Exhibit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
