import React, { useState, useEffect } from 'react';
import { AlgorithmAcademy } from './components/AlgorithmAcademy';
import { AlgorithmArena } from './components/AlgorithmArena';
import { GameHUD } from './components/GameHUD';
import { MainMenu } from './components/MainMenu';
import { MissionResultsModal } from './components/MissionResultsModal';
import { MissionSelect } from './components/MissionSelect';
import { Navbar, ScreenMode } from './components/Navbar';
import { PresentationMode } from './components/PresentationMode';
import { sound } from './game/soundEngine';
import { MissionDefinition, MISSIONS } from './missions/missionData';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenMode>('menu');
  const [currentMission, setCurrentMission] = useState<MissionDefinition>(MISSIONS[0]);
  const [missionSessionId, setMissionSessionId] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted);

  // Persistence for completed missions & stars
  const [completedMissions, setCompletedMissions] = useState<
    Record<string, { stars: number; bestSteps: number }>
  >(() => {
    try {
      const saved = localStorage.getItem('aegis_mission_progress');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Mission Results Modal state
  const [resultsModalOpen, setResultsModalOpen] = useState<boolean>(false);
  const [latestResults, setLatestResults] = useState<{
    steps: number;
    replans: number;
    cost: number;
  }>({ steps: 0, replans: 0, cost: 0 });

  const handleToggleMute = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  const handleNavigateScreen = (screen: ScreenMode) => {
    setResultsModalOpen(false);
    setCurrentScreen(screen);
  };

  const handleSelectMission = (mission: MissionDefinition) => {
    setResultsModalOpen(false);
    setCurrentMission(mission);
    setMissionSessionId((id) => id + 1);
    setCurrentScreen('game');
  };

  const handleLaunchSandbox = () => {
    setResultsModalOpen(false);
    // Generate a spacious sandbox mission
    const sandboxMission: MissionDefinition = {
      id: 'mission-sandbox',
      title: 'Sandbox Protocol Lab',
      codename: 'LABORATORY',
      subtitle: 'Unrestricted Map Construction & Heuristic Testing',
      briefing: 'Freeform experimental testing deck. Paint walls, configure terrain friction, manipulate start/target coords, and observe algorithmic behavior.',
      difficulty: 'CADET',
      rows: 15,
      cols: 25,
      start: { r: 2, c: 2 },
      target: { r: 12, c: 22 },
      initialWalls: [],
      targetStepsForStar3: 40,
      environmentTheme: 'training',
      badgeLabel: 'SANDBOX',
    };
    setCurrentMission(sandboxMission);
    setMissionSessionId((id) => id + 1);
    setCurrentScreen('game');
  };

  const handleMissionComplete = (stats: { steps: number; replans: number; cost: number }) => {
    setLatestResults(stats);
    setResultsModalOpen(true);

    // Calculate star rating
    let stars = 1;
    if (stats.steps <= currentMission.targetStepsForStar3 * 1.3) stars = 2;
    if (stats.steps <= currentMission.targetStepsForStar3 && stats.replans <= 2) stars = 3;

    setCompletedMissions((prev) => {
      const existing = prev[currentMission.id];
      const bestStars = Math.max(existing?.stars || 0, stars);
      const bestSteps = existing?.bestSteps
        ? Math.min(existing.bestSteps, stats.steps)
        : stats.steps;

      const updated = {
        ...prev,
        [currentMission.id]: { stars: bestStars, bestSteps },
      };

      try {
        localStorage.setItem('aegis_mission_progress', JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }

      return updated;
    });
  };

  const handleNextMission = () => {
    setResultsModalOpen(false);
    const currentIndex = MISSIONS.findIndex((m) => m.id === currentMission.id);
    if (currentIndex >= 0 && currentIndex < MISSIONS.length - 1) {
      const nextM = MISSIONS[currentIndex + 1];
      setCurrentMission(nextM);
      setMissionSessionId((id) => id + 1);
      setCurrentScreen('game');
    } else {
      setCurrentScreen('missions');
    }
  };

  const handleReplayMission = () => {
    setResultsModalOpen(false);
    setMissionSessionId((id) => id + 1);
  };

  return (
    <div className="w-full h-screen flex flex-col bg-[#17233D] text-[#F5F7FF] overflow-hidden">
      {/* Universal Top Navigation Header */}
      <Navbar
        currentScreen={currentScreen}
        onSelectScreen={handleNavigateScreen}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Primary Dynamic Screen Viewport */}
      <main className="flex-1 flex overflow-hidden">
        {currentScreen === 'menu' && (
          <MainMenu
            onSelectScreen={handleNavigateScreen}
            onLaunchSandbox={handleLaunchSandbox}
          />
        )}

        {currentScreen === 'missions' && (
          <MissionSelect
            onSelectMission={handleSelectMission}
            completedMissions={completedMissions}
          />
        )}

        {currentScreen === 'game' && (
          <GameHUD
            key={`${currentMission.id}-${missionSessionId}`}
            mission={currentMission}
            onMissionComplete={handleMissionComplete}
            onReplay={handleReplayMission}
            onExit={() => {
              setResultsModalOpen(false);
              setCurrentScreen('missions');
            }}
          />
        )}

        {currentScreen === 'arena' && <AlgorithmArena />}

        {currentScreen === 'academy' && <AlgorithmAcademy />}

        {currentScreen === 'presentation' && (
          <PresentationMode onExit={() => {
            setResultsModalOpen(false);
            setCurrentScreen('menu');
          }} />
        )}
      </main>

      {/* Mission Results Modal — strictly isolated to active game screen */}
      {currentScreen === 'game' && (
        <MissionResultsModal
          isOpen={resultsModalOpen}
          stepsTaken={latestResults.steps}
          replansCount={latestResults.replans}
          pathCost={latestResults.cost}
          targetStepsForStar3={currentMission.targetStepsForStar3}
          onClose={() => setResultsModalOpen(false)}
          onReplay={handleReplayMission}
          onNextMission={handleNextMission}
        />
      )}
    </div>
  );
}

export default App;
