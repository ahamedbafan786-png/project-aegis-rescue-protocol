import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react';
import { sound } from '../game/soundEngine';

interface MissionResultsModalProps {
  isOpen: boolean;
  stepsTaken: number;
  replansCount: number;
  pathCost: number;
  targetStepsForStar3: number;
  onClose?: () => void;
  onReplay: () => void;
  onNextMission: () => void;
  onExitToMissions?: () => void;
}

export const MissionResultsModal: React.FC<MissionResultsModalProps> = ({
  isOpen,
  stepsTaken,
  replansCount,
  pathCost,
  targetStepsForStar3,
  onClose,
  onReplay,
  onNextMission,
  onExitToMissions,
}) => {
  useEffect(() => {
    if (isOpen) {
      // Trigger celebratory confetti burst
      confetti({
        particleCount: 65,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#66DAD5', '#86E3B4', '#F5CF79', '#A695F2', '#FF9B83'],
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate Star Rating
  let stars = 1;
  if (stepsTaken <= targetStepsForStar3 * 1.3) stars = 2;
  if (stepsTaken <= targetStepsForStar3 && replansCount <= 2) stars = 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17233D]/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-[#2B3B5B] to-[#1F2C47] border border-[#66DAD5]/40 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Close / Dismiss Button */}
        {onClose && (
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            title="Dismiss dialog and inspect board"
            className="absolute top-4 right-4 p-2 rounded-xl bg-[#17233D]/60 hover:bg-[#17233D] text-[#A1ADC7] hover:text-[#F5F7FF] border border-[#2B3B5B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Subtle background glow */}
        <div className="absolute -top-24 w-48 h-48 bg-[#66DAD5]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Victory Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#66DAD5] to-[#6FAFFF] flex items-center justify-center shadow-lg shadow-[#66DAD5]/30 mb-4">
          <Award className="w-9 h-9 text-[#17233D]" />
        </div>

        <span className="text-xs font-mono font-bold tracking-widest text-[#66DAD5] uppercase">
          Protocol Succeeded
        </span>
        <h2 className="text-2xl font-black text-[#F5F7FF] tracking-tight mt-1">
          RESCUE MISSION COMPLETE
        </h2>

        {/* 3-Star Presentation */}
        <div className="flex items-center gap-3 my-5">
          {[1, 2, 3].map((starIdx) => (
            <div
              key={starIdx}
              className={`p-2 rounded-2xl border transition-all ${
                starIdx <= stars
                  ? 'bg-[#F5CF79]/20 border-[#F5CF79] shadow-lg shadow-[#F5CF79]/25 scale-110'
                  : 'bg-[#17233D]/60 border-[#2B3B5B] text-[#374565]'
              }`}
            >
              <Star
                className={`w-7 h-7 ${
                  starIdx <= stars
                    ? 'text-[#F5CF79] fill-[#F5CF79]'
                    : 'text-[#374565]'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Performance Metrics Cards */}
        <div className="w-full grid grid-cols-3 gap-2.5 my-2">
          <div className="bg-[#17233D]/90 p-3 rounded-xl border border-[#2B3B5B]">
            <span className="text-[10px] text-[#A1ADC7] block uppercase font-mono">Steps Taken</span>
            <span className="text-base font-bold font-mono text-[#6FAFFF]">{stepsTaken}</span>
          </div>

          <div className="bg-[#17233D]/90 p-3 rounded-xl border border-[#2B3B5B]">
            <span className="text-[10px] text-[#A1ADC7] block uppercase font-mono">Route Cost</span>
            <span className="text-base font-bold font-mono text-[#86E3B4]">{pathCost.toFixed(1)}</span>
          </div>

          <div className="bg-[#17233D]/90 p-3 rounded-xl border border-[#2B3B5B]">
            <span className="text-[10px] text-[#A1ADC7] block uppercase font-mono">Replans</span>
            <span className="text-base font-bold font-mono text-[#FF9B83]">{replansCount}</span>
          </div>
        </div>

        <p className="text-xs text-[#A1ADC7] mt-3 leading-relaxed">
          {stars === 3
            ? 'Optimal route executed with high algorithmic efficiency.'
            : 'Mission accomplished. Further search pruning can optimize total steps.'}
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row gap-2.5 mt-6">
          <button
            onClick={() => {
              sound.playClick();
              onReplay();
            }}
            data-action="replay"
            className="flex-1 py-3 px-3 rounded-xl bg-[#2B3B5B] hover:bg-[#374565] border border-[#3E527D] text-[#F5F7FF] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Replay
          </button>

          {onExitToMissions && (
            <button
              onClick={() => {
                sound.playClick();
                onExitToMissions();
              }}
              data-action="exit-to-missions"
              className="py-3 px-3.5 rounded-xl bg-[#17233D] hover:bg-[#202E4B] border border-[#2B3B5B] text-[#A1ADC7] hover:text-[#F5F7FF] font-semibold text-xs tracking-wider uppercase transition-colors"
            >
              Missions
            </button>
          )}

          <button
            onClick={() => {
              sound.playClick();
              onNextMission();
            }}
            data-action="next-mission"
            className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-[#66DAD5] to-[#6FAFFF] hover:from-[#5cc7c2] hover:to-[#5fa4ee] text-[#17233D] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#66DAD5]/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
