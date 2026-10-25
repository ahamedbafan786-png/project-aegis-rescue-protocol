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
    <header className="w-full bg-[#17233D]/95 backdrop-blur-md border-b border-[#2B3B5B] px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between z-30 select-none">
      {/* Brand Logo & Codename */}
      <div
        onClick={() => {
          sound.playClick();
          onSelectScreen('menu');
        }}
        className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0"
      >
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-[#2D3D5E] to-[#1E2B45] border border-[#66DAD5]/60 flex items-center justify-center shadow-md group-hover:border-[#66DAD5] transition-colors">
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-[#66DAD5] group-hover:scale-110 transition-transform" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold tracking-wider text-xs sm:text-sm text-[#F5F7FF] uppercase">
              Project Aegis
            </span>
            <span className="hidden sm:inline-block text-[10px] bg-[#66DAD5]/15 text-[#66DAD5] px-1.5 py-0.5 rounded font-mono font-semibold border border-[#66DAD5]/30">
              A* V4.2
            </span>
          </div>
          <span className="hidden sm:block text-[10px] text-[#A1ADC7] tracking-wider">
            RESCUE PROTOCOL
          </span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('missions');
          }}
          data-nav-item="missions"
          title="Missions"
          className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap shrink-0 ${
            currentScreen === 'missions' || currentScreen === 'game'
              ? 'bg-[#66DAD5] text-[#17233D] shadow-md shadow-[#66DAD5]/20 font-bold'
              : 'text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#2B3B5B]/50'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Missions</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('arena');
          }}
          data-nav-item="arena"
          title="Algorithm Arena"
          className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap shrink-0 ${
            currentScreen === 'arena'
              ? 'bg-[#6FAFFF] text-[#17233D] shadow-md shadow-[#6FAFFF]/20 font-bold'
              : 'text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#2B3B5B]/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Arena</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('academy');
          }}
          data-nav-item="academy"
          title="Algorithm Academy"
          className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap shrink-0 ${
            currentScreen === 'academy'
              ? 'bg-[#A695F2] text-[#17233D] shadow-md shadow-[#A695F2]/20 font-bold'
              : 'text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#2B3B5B]/50'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Academy</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('presentation');
          }}
          data-nav-item="presentation"
          title="Presentation Mode"
          className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap shrink-0 ${
            currentScreen === 'presentation'
              ? 'bg-[#FF9B83] text-[#17233D] shadow-md shadow-[#FF9B83]/20 font-bold'
              : 'text-[#FF9B83]/80 hover:text-[#FF9B83] hover:bg-[#FF9B83]/10 border border-[#FF9B83]/30'
          }`}
        >
          <MonitorPlay className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Presentation</span>
        </button>
      </nav>

      {/* Audio & Settings Utility */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          onClick={() => {
            onToggleMute();
            sound.playClick();
          }}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          className={`p-1.5 sm:p-2 rounded-lg border transition-colors ${
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
