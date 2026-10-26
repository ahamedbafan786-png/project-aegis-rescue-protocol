import React from 'react';
import {
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
    <header className="w-full bg-[#17233D]/95 backdrop-blur-md border-b border-[#2B3B5B] px-2 sm:px-4 py-1.5 sm:py-2 grid grid-cols-[1fr_auto] sm:flex sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 z-30 select-none shrink-0">
      {/* Brand Logo & Codename */}
      <button
        onClick={() => {
          sound.playClick();
          onSelectScreen('menu');
        }}
        data-nav-item="menu"
        aria-label="Project Aegis Main Menu"
        className="col-start-1 row-start-1 sm:col-auto sm:row-auto flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0 min-h-[44px] px-1 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#66DAD5]"
      >
        <div className="w-9 h-9 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-[#2D3D5E] to-[#1E2B45] border border-[#66DAD5]/60 flex items-center justify-center shadow-md group-hover:border-[#66DAD5] transition-colors shrink-0">
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-[#66DAD5] group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold tracking-wider text-xs sm:text-sm text-[#F5F7FF] uppercase whitespace-nowrap">
              Project Aegis
            </span>
            <span className="text-[10px] bg-[#66DAD5]/15 text-[#66DAD5] px-1.5 py-0.5 rounded font-mono font-semibold border border-[#66DAD5]/30 whitespace-nowrap">
              A* V4.3.1
            </span>
          </div>
          <span className="hidden sm:block text-[10px] text-[#A1ADC7] tracking-wider uppercase">
            RESCUE PROTOCOL
          </span>
        </div>
      </button>

      {/* Audio Mute Button (Single authoritative element: Col 2 Row 1 on mobile, Far Right on desktop) */}
      <div className="col-start-2 row-start-1 sm:col-auto sm:row-auto sm:order-last flex items-center shrink-0">
        <button
          onClick={() => {
            onToggleMute();
            sound.playClick();
          }}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          className={`w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#66DAD5] ${
            isMuted
              ? 'bg-[#2B3B5B]/50 border-[#374565] text-[#A1ADC7]'
              : 'bg-[#66DAD5]/15 border-[#66DAD5]/50 text-[#66DAD5]'
          }`}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation Buttons: Row 2 on mobile (col-span-2), Center on desktop */}
      <nav
        aria-label="Primary Navigation"
        className="col-span-2 sm:col-span-1 row-start-2 sm:row-auto grid grid-cols-4 sm:flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto"
      >
        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('missions');
          }}
          data-nav-item="missions"
          aria-label="Missions"
          title="Missions"
          className={`min-h-[44px] h-[44px] flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap shrink-0 ${
            currentScreen === 'missions' || currentScreen === 'game'
              ? 'bg-[#66DAD5] text-[#17233D] shadow-md shadow-[#66DAD5]/20 font-bold'
              : 'text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#2B3B5B]/50 border border-transparent'
          }`}
        >
          <Play className="w-4 h-4 shrink-0" />
          <span className="truncate">Missions</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('arena');
          }}
          data-nav-item="arena"
          aria-label="Algorithm Arena"
          title="Algorithm Arena"
          className={`min-h-[44px] h-[44px] flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap shrink-0 ${
            currentScreen === 'arena'
              ? 'bg-[#6FAFFF] text-[#17233D] shadow-md shadow-[#6FAFFF]/20 font-bold'
              : 'text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#2B3B5B]/50 border border-transparent'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span className="truncate">Arena</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('academy');
          }}
          data-nav-item="academy"
          aria-label="Algorithm Academy"
          title="Algorithm Academy"
          className={`min-h-[44px] h-[44px] flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap shrink-0 ${
            currentScreen === 'academy'
              ? 'bg-[#A695F2] text-[#17233D] shadow-md shadow-[#A695F2]/20 font-bold'
              : 'text-[#A1ADC7] hover:text-[#F5F7FF] hover:bg-[#2B3B5B]/50 border border-transparent'
          }`}
        >
          <GraduationCap className="w-4 h-4 shrink-0" />
          <span className="truncate">Academy</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onSelectScreen('presentation');
          }}
          data-nav-item="presentation"
          aria-label="Presentation Mode"
          title="Presentation Mode"
          className={`min-h-[44px] h-[44px] flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap shrink-0 ${
            currentScreen === 'presentation'
              ? 'bg-[#FF9B83] text-[#17233D] shadow-md shadow-[#FF9B83]/20 font-bold'
              : 'text-[#FF9B83]/90 hover:text-[#FF9B83] hover:bg-[#FF9B83]/10 border border-[#FF9B83]/30'
          }`}
        >
          <MonitorPlay className="w-4 h-4 shrink-0" />
          <span className="truncate">Exhibit</span>
        </button>
      </nav>
    </header>
  );
};
