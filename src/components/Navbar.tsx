import React from 'react';
import {
  Compass,
  GraduationCap,
  Layers,
  MonitorPlay,
  Play,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { sound } from '../game/soundEngine';

export type ScreenMode = 'menu' | 'missions' | 'game' | 'arena' | 'academy' | 'presentation';

interface NavbarProps {
  currentScreen: ScreenMode;
  onSelectScreen: (screen: ScreenMode) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScreen,
  onSelectScreen,
  isMuted,
  onToggleMute,
}) => {
  return (
    <header className="w-full bg-[#17233D]/95 backdrop-blur-md border-b border-[#2B3B5B] px-4 py-2.5 flex items-center justify-between z-30 select-none">
      {/* Brand Logo & Codename */}
      <div
        onClick={() => {
          sound.playClick();
          onSelectScreen('menu');
        }}
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2D3D5E] to-[#1E2B45] border border-[#66DAD5]/60 flex items-center justify-center shadow-md group-hover:border-[#66DAD5] transition-colors">
          <Zap className="w-5 h-5 text-[#66DAD5] group-hover:scale-110 transition-transform" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wider text-sm text-[#F5F7FF] uppercase">
              Project Aegis
            </span>
            <span className="text-[10px] bg-[#66DAD5]/15 text-[#66DAD5] px-1.5 py-0.5 rounded font-mono font-semibold border border-[#66DAD5]/30">
              A* V2.4
            </span>
          </div>
          <span className="text-[11px] text-[#A1ADC7] tracking-wider block">
            RESCUE PROTOCOL
          </span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <nav className="flex items-center gap-1.5">
        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('missions');
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            currentScreen === 'missions' || currentScreen === 'game'
              ? 'bg-[#66DAD5] text-[#17233D] shadow-md shadow-[#66DAD5]/20 font-bold'
              : 'text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#2B3B5B]/50'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          Missions
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('arena');
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            currentScreen === 'arena'
              ? 'bg-[#6FAFFF] text-[#17233D] shadow-md shadow-[#6FAFFF]/20 font-bold'
              : 'text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#2B3B5B]/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Algorithm Arena
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('academy');
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            currentScreen === 'academy'
              ? 'bg-[#A695F2] text-[#17233D] shadow-md shadow-[#A695F2]/20 font-bold'
              : 'text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#2B3B5B]/50'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Academy
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('presentation');
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            currentScreen === 'presentation'
              ? 'bg-[#FF9B83] text-[#17233D] shadow-md shadow-[#FF9B83]/20 font-bold'
              : 'text-[#FF9B83]/80 hover:text-[#FF9B83] hover:bg-[#FF9B83]/10 border border-[#FF9B83]/30'
          }`}
        >
          <MonitorPlay className="w-3.5 h-3.5" />
          Presentation Mode
        </button>
      </nav>

      {/* Audio & Settings Utility */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            onToggleMute();
            sound.playClick();
          }}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          className={`p-2 rounded-lg border transition-colors ${
            isMuted
              ? 'bg-[#2B3B5B]/40 border-[#374565] text-[#A1ADC7]'
              : 'bg-[#66DAD5]/10 border-[#66DAD5]/40 text-[#66DAD5]'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
