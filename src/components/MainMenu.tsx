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

  // Decorative hero animation of Aegis-1 in tactical patrol loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    let time = 0;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 320 * dpr;
    canvas.height = 320 * dpr;
    ctx.scale(dpr, dpr);

    const renderHero = () => {
      angle += 0.012;
      time += 0.02;
      ctx.clearRect(0, 0, 320, 320);

      const cx = 160;
      const cy = 160;

      // 1. Concentric tactical radar rings
      ctx.strokeStyle = 'rgba(43, 59, 91, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 125, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(102, 218, 213, 0.22)';
      ctx.beginPath();
      ctx.arc(cx, cy, 95, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating holographic radar sweep
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const sweepGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 125);
      sweepGrad.addColorStop(0, 'rgba(102, 218, 213, 0.35)');
      sweepGrad.addColorStop(0.7, 'rgba(102, 218, 213, 0.08)');
      sweepGrad.addColorStop(1, 'rgba(102, 218, 213, 0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 125, -Math.PI * 0.22, Math.PI * 0.22);
      ctx.closePath();
      ctx.fill();

      // Calibration tick marks on outer ring
      ctx.strokeStyle = 'rgba(102, 218, 213, 0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const tickAngle = (i / 12) * Math.PI * 2;
        const tx1 = Math.cos(tickAngle) * 120;
        const ty1 = Math.sin(tickAngle) * 120;
        const tx2 = Math.cos(tickAngle) * 128;
        const ty2 = Math.sin(tickAngle) * 128;
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.stroke();
      }

      // 2. Robot chassis ("Aegis-1") in hero presentation
      const radius = 34;

      // Volumetric searchlight cones
      const lightLength = 70;
      const lightGradLeft = ctx.createRadialGradient(
        radius * 0.6, -radius * 0.7, 2,
        radius * 1.5, -radius * 0.7, lightLength
      );
      lightGradLeft.addColorStop(0, 'rgba(102, 218, 213, 0.45)');
      lightGradLeft.addColorStop(0.6, 'rgba(102, 218, 213, 0.12)');
      lightGradLeft.addColorStop(1, 'rgba(102, 218, 213, 0)');
      ctx.fillStyle = lightGradLeft;
      ctx.beginPath();
      ctx.moveTo(radius * 0.6, -radius * 0.7);
      ctx.arc(radius * 0.6, -radius * 0.7, lightLength, -Math.PI * 0.16, Math.PI * 0.12);
      ctx.closePath();
      ctx.fill();

      const lightGradRight = ctx.createRadialGradient(
        radius * 0.6, radius * 0.7, 2,
        radius * 1.5, radius * 0.7, lightLength
      );
      lightGradRight.addColorStop(0, 'rgba(102, 218, 213, 0.45)');
      lightGradRight.addColorStop(0.6, 'rgba(102, 218, 213, 0.12)');
      lightGradRight.addColorStop(1, 'rgba(102, 218, 213, 0)');
      ctx.fillStyle = lightGradRight;
      ctx.beginPath();
      ctx.moveTo(radius * 0.6, radius * 0.7);
      ctx.arc(radius * 0.6, radius * 0.7, lightLength, -Math.PI * 0.12, Math.PI * 0.16);
      ctx.closePath();
      ctx.fill();

      // Articulated Side Tread Pods
      ctx.fillStyle = '#141D2E';
      ctx.beginPath();
      ctx.roundRect(-radius * 0.95, -radius * 0.95, radius * 1.9, radius * 0.36, 4);
      ctx.roundRect(-radius * 0.95, radius * 0.6, radius * 1.9, radius * 0.36, 4);
      ctx.fill();

      // Animated tread teeth
      ctx.fillStyle = '#2B3B5B';
      const treadShift = (time * 12) % 6;
      for (let ti = 0; ti < 5; ti++) {
        const toothX = -radius * 0.8 + ti * (radius * 0.38) + treadShift * 0.4;
        if (toothX > -radius * 0.85 && toothX < radius * 0.75) {
          ctx.fillRect(toothX, -radius * 0.93, 2.5, radius * 0.32);
          ctx.fillRect(toothX, radius * 0.62, 2.5, radius * 0.32);
        }
      }

      // Rolling bogie wheels
      ctx.fillStyle = '#1E2C48';
      for (let bi = 0; bi < 3; bi++) {
        const bx = -radius * 0.55 + bi * (radius * 0.55);
        ctx.beginPath();
        ctx.arc(bx, -radius * 0.77, 2.8, 0, Math.PI * 2);
        ctx.arc(bx, radius * 0.78, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Armored Chassis Hull
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;

      const hullGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
      hullGrad.addColorStop(0, '#526C9E');
      hullGrad.addColorStop(0.45, '#31446B');
      hullGrad.addColorStop(1, '#1D2A42');
      ctx.fillStyle = hullGrad;
      ctx.beginPath();
      ctx.roundRect(-radius, -radius * 0.72, radius * 2, radius * 1.44, radius * 0.42);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = '#6FAFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Front visor
      ctx.fillStyle = '#0B1320';
      ctx.beginPath();
      ctx.roundRect(radius * 0.08, -radius * 0.45, radius * 0.8, radius * 0.9, 4);
      ctx.fill();

      // Sweeping sensor eye
      const sweepY = Math.sin(time * 3) * (radius * 0.22);
      ctx.fillStyle = '#66DAD5';
      ctx.shadowColor = '#66DAD5';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(radius * 0.55, sweepY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Central concentric energy core
      const corePulse = (Math.sin(time * 4) + 1) * 0.5;
      ctx.strokeStyle = 'rgba(102, 218, 213, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-radius * 0.2, 0, 5 + corePulse * 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#66DAD5';
      ctx.shadowColor = '#66DAD5';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(-radius * 0.2, 0, 3 + corePulse * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

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
              Autonomous Robot Pathfinding Experience
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none bg-gradient-to-r from-[#F5F7FF] via-[#E2E8F8] to-[#6FAFFF] bg-clip-text text-transparent">
            PROJECT AEGIS
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold tracking-widest text-[#66DAD5] uppercase -mt-1">
            RESCUE PROTOCOL
          </h2>

          <p className="text-base sm:text-lg font-medium text-[#F5CF79] tracking-wide">
            One robot. Impossible terrain. Every second counts.
          </p>

          <p className="text-sm sm:text-base text-[#A1ADC7] leading-relaxed max-w-xl -mt-1">
            Deploy autonomous rescue droid <strong className="text-[#F5F7FF]">Aegis-1</strong> into collapsed disaster sectors. Manage limited repair charges, breach emergency corridors, and watch the admissible <strong className="text-[#66DAD5]">A* Algorithm</strong> calculate guaranteed cost-optimal rescue routes with mid-transit dynamic replanning.
          </p>

          {/* Primary Action Button Grid */}
          <div className="flex flex-wrap gap-3 mt-2 w-full">
            <button
              onClick={() => {
                sound.playClick();
                onSelectScreen('missions');
              }}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#66DAD5] to-[#6FAFFF] text-[#17233D] font-bold text-sm tracking-wider uppercase shadow-lg shadow-[#66DAD5]/25 hover:shadow-[#66DAD5]/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2.5"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Rescue
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onSelectScreen('missions');
              }}
              className="px-5 py-3.5 rounded-xl bg-[#F5CF79]/15 hover:bg-[#F5CF79]/25 border border-[#F5CF79]/50 text-[#F5CF79] font-bold text-sm tracking-wide transition-all flex items-center gap-2 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <Shield className="w-4 h-4" />
              Challenge Missions
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onLaunchSandbox();
              }}
              className="px-4 py-3.5 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-semibold text-sm tracking-wide transition-all flex items-center gap-2"
            >
              <Cpu className="w-4 h-4 text-[#66DAD5]" />
              Sandbox Lab
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onSelectScreen('arena');
              }}
              className="px-4 py-3.5 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-semibold text-sm tracking-wide transition-all flex items-center gap-2"
            >
              <Layers className="w-4 h-4 text-[#6FAFFF]" />
              Algorithm Arena
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onSelectScreen('academy');
              }}
              className="px-4 py-3.5 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-semibold text-sm tracking-wide transition-all flex items-center gap-2"
            >
              <GraduationCap className="w-4 h-4 text-[#A695F2]" />
              How It Works
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onSelectScreen('presentation');
              }}
              className="px-4 py-3.5 rounded-xl bg-[#FF9B83]/15 hover:bg-[#FF9B83]/25 border border-[#FF9B83]/50 text-[#FF9B83] font-bold text-sm tracking-wide transition-all flex items-center gap-2 shadow-sm"
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
                AEGIS-1 DEPLOYED
              </span>
              <span className="text-[#86E3B4]">SYSTEMS OPTIMAL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Specification Badges */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-8 border-t border-[#2B3B5B] pt-6">
        <div className="bg-[#1F2C47]/50 border border-[#2B3B5B] p-3.5 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F5CF79]/10 border border-[#F5CF79]/30 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-[#F5CF79]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F7FF] uppercase">Emergency Corridors</h4>
            <p className="text-[11px] text-[#A1ADC7] leading-tight mt-0.5">
              Demolish heavy debris with limited charges or conserve for optimal detours.
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
              Robot detects mid-transit blockages and recalculates without teleportation.
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
              Benchmark A* against Dijkstra and BFS across diverse biomes in real time.
            </p>
          </div>
        </div>

        <div className="bg-[#1F2C47]/50 border border-[#2B3B5B] p-3.5 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#86E3B4]/10 border border-[#86E3B4]/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#86E3B4]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F7FF] uppercase">Indie Game Feel</h4>
            <p className="text-[11px] text-[#A1ADC7] leading-tight mt-0.5">
              Distinct sector biomes, volumetric headlights, tread tracks, and rescue sequences.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
