import React from 'react';
import {
  ArrowRight,
  Shield,
  Star,
} from 'lucide-react';
import { sound } from '../game/soundEngine';
import { MissionDefinition, MISSIONS } from '../missions/missionData';

interface MissionSelectProps {
  onSelectMission: (mission: MissionDefinition) => void;
  completedMissions: Record<string, { stars: number; bestSteps: number }>;
}

export const MissionSelect: React.FC<MissionSelectProps> = ({
  onSelectMission,
  completedMissions,
}) => {
  return (
    <div className="flex-1 w-full bg-[#17233D] text-[#F5F7FF] p-6 sm:p-10 select-none overflow-y-auto">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#2B3B5B] pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#66DAD5] tracking-wider uppercase mb-1">
              <Shield className="w-4 h-4" />
              Tactical Operations Deck
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#F5F7FF]">
              SELECT RESCUE MISSION
            </h2>
            <p className="text-sm text-[#A1ADC7] mt-1">
              Deploy Aegis-1 into active disaster sectors. Choose a scenario to commence autonomous route planning.
            </p>
          </div>
        </div>

        {/* Mission Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MISSIONS.map((mission) => {
            const progress = completedMissions[mission.id];
            const stars = progress?.stars || 0;
            const isPresentation = mission.difficulty === 'PRESENTATION';

            const difficultyColors = {
              CADET: 'text-[#86E3B4] bg-[#86E3B4]/10 border-[#86E3B4]/30',
              TACTICAL: 'text-[#6FAFFF] bg-[#6FAFFF]/10 border-[#6FAFFF]/30',
              EXPERT: 'text-[#A695F2] bg-[#A695F2]/10 border-[#A695F2]/30',
              PRESENTATION: 'text-[#FF9B83] bg-[#FF9B83]/15 border-[#FF9B83]/40',
            };

            const wallSet = new Set(mission.initialWalls.map((w) => `${w.r},${w.c}`));

            return (
              <div
                key={mission.id}
                data-mission-card={mission.id}
                onClick={() => {
                  sound.playClick();
                  onSelectMission(mission);
                }}
                className={`group relative rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between border ${
                  isPresentation
                    ? 'bg-gradient-to-b from-[#2B3B5B]/85 to-[#1F2C47] border-[#FF9B83]/50 hover:border-[#FF9B83] shadow-lg shadow-[#FF9B83]/10 hover:shadow-[#FF9B83]/20'
                    : 'bg-[#1F2C47]/90 hover:bg-[#253554] border-[#2B3B5B] hover:border-[#66DAD5]/60 hover:shadow-xl hover:shadow-[#66DAD5]/10'
                } hover:-translate-y-1`}
              >
                <div>
                  {/* Top Bar / Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[11px] font-mono font-bold text-[#A1ADC7] tracking-wider uppercase">
                      {mission.badgeLabel}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        difficultyColors[mission.difficulty]
                      }`}
                    >
                      {mission.difficulty}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-lg font-bold text-[#F5F7FF] group-hover:text-[#66DAD5] transition-colors leading-tight">
                    {mission.title}
                  </h3>
                  <h4 className="text-xs font-semibold text-[#A1ADC7] mt-0.5 tracking-wide">
                    {mission.subtitle}
                  </h4>

                  {/* Procedural Mini-Map Preview (Eliminates Generic AI Card Look) */}
                  <div className="my-3.5 p-2 bg-[#17233D] rounded-xl border border-[#2B3B5B] flex items-center justify-center">
                    <div
                      className="grid gap-[2px] bg-[#121A2B] p-1.5 rounded-lg border border-[#23324E]"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(22, mission.cols)}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: Math.min(12, mission.rows) }).map((_, r) =>
                        Array.from({ length: Math.min(22, mission.cols) }).map((_, c) => {
                          const isStart = r === mission.start.r && c === mission.start.c;
                          const isTarget = r === mission.target.r && c === mission.target.c;
                          const isWall = wallSet.has(`${r},${c}`);

                          return (
                            <div
                              key={`${r},${c}`}
                              className={`w-2 h-2 rounded-[1.5px] ${
                                isStart
                                  ? 'bg-[#6FAFFF] shadow-sm shadow-[#6FAFFF]'
                                  : isTarget
                                  ? 'bg-[#86E3B4] shadow-sm shadow-[#86E3B4]'
                                  : isWall
                                  ? 'bg-[#3A507A]'
                                  : 'bg-[#1C273D]'
                              }`}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Briefing Text */}
                  <p className="text-xs text-[#A1ADC7]/80 leading-relaxed line-clamp-2">
                    {mission.briefing}
                  </p>
                </div>

                {/* Footer Telemetry & Stars */}
                <div className="mt-4 pt-3 border-t border-[#2B3B5B]/60 flex items-center justify-between">
                  {/* Stars / Completion */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((starIdx) => (
                      <Star
                        key={starIdx}
                        className={`w-3.5 h-3.5 ${
                          starIdx <= stars
                            ? 'text-[#F5CF79] fill-[#F5CF79]'
                            : 'text-[#374565]'
                        }`}
                      />
                    ))}
                    {progress?.bestSteps && (
                      <span className="text-[10px] font-mono text-[#A1ADC7] ml-2">
                        Best: {progress.bestSteps} steps
                      </span>
                    )}
                  </div>

                  {/* Action Link */}
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#66DAD5] group-hover:translate-x-1 transition-transform">
                    {isPresentation ? 'Launch Demo' : 'Deploy'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
