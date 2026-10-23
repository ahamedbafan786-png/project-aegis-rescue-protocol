import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Code,
  Compass,
  Cpu,
  GraduationCap,
  HelpCircle,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { sound } from '../game/soundEngine';

export const AlgorithmAcademy: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'basics' | 'formula' | 'heuristics' | 'replanning' | 'viva'>('basics');

  return (
    <div className="flex-1 w-full bg-[#17233D] text-[#F5F7FF] p-6 sm:p-10 select-none overflow-y-auto">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="border-b border-[#2B3B5B] pb-6">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#A695F2] tracking-wider uppercase mb-1">
            <GraduationCap className="w-4 h-4" />
            DSA Visual Textbook & Viva Preparation Guide
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#F5F7FF]">
            ALGORITHM ACADEMY
          </h2>
          <p className="text-sm text-[#A1ADC7] mt-1">
            Comprehensive theoretical foundations of A* pathfinding, priority queue data structures, heuristic admissibility, and dynamic replanning.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#2B3B5B] pb-3">
          {[
            { id: 'basics', label: '1. What is A*?' },
            { id: 'formula', label: '2. Cost Formula f = g + h' },
            { id: 'heuristics', label: '3. Admissible Heuristics' },
            { id: 'replanning', label: '4. Dynamic Replanning' },
            { id: 'viva', label: '5. College Viva Q&A' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                sound.playClick();
                setActiveSection(tab.id as typeof activeSection);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all ${
                activeSection === tab.id
                  ? 'bg-[#A695F2] text-[#17233D] shadow-md shadow-[#A695F2]/20'
                  : 'bg-[#1F2C47] text-[#A1ADC7] hover:text-[#F5F7FF] border border-[#2B3B5B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Section Content */}
        <div className="bg-[#1F2C47]/80 rounded-2xl border border-[#2B3B5B] p-6 sm:p-8 space-y-6">
          {activeSection === 'basics' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-[#F5F7FF] flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#66DAD5]" />
                What is A* Pathfinding?
              </h3>
              <p className="text-sm text-[#A1ADC7] leading-relaxed">
                The <strong className="text-[#F5F7FF]">A* (A-Star) Algorithm</strong>, formulated in 1968 by Peter Hart, Nils Nilsson, and Bertram Raphael, is an informed best-first search graph traversal algorithm widely utilized in autonomous robotics, video games, and GPS navigation systems.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-[#17233D] p-4 rounded-xl border border-[#2B3B5B]">
                  <h4 className="text-xs font-bold text-[#6FAFFF] uppercase tracking-wider mb-2">
                    Dijkstra: Exhaustive & Uniform
                  </h4>
                  <p className="text-xs text-[#A1ADC7] leading-relaxed">
                    Dijkstra's algorithm explores nodes uniformly in concentric waves in all directions, regardless of where the target is located. It is guaranteed to find the shortest path, but expands a large number of nodes that point away from the goal.
                  </p>
                </div>
                <div className="bg-[#17233D] p-4 rounded-xl border border-[#66DAD5]/30">
                  <h4 className="text-xs font-bold text-[#66DAD5] uppercase tracking-wider mb-2">
                    A*: Guided & Targeted
                  </h4>
                  <p className="text-xs text-[#A1ADC7] leading-relaxed">
                    A* incorporates a heuristic estimate <code className="text-[#66DAD5]">h(n)</code> of remaining distance to the goal. By focusing search toward the target, A* dramatically prunes the search space while preserving the guarantee of finding the optimal shortest path.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'formula' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-[#F5F7FF] flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#66DAD5]" />
                The Fundamental Cost Formula: f(n) = g(n) + h(n)
              </h3>
              <div className="p-4 bg-[#17233D] rounded-xl border border-[#2B3B5B] text-center">
                <span className="text-2xl font-mono font-extrabold text-[#66DAD5]">
                  f(n) = g(n) + h(n)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#A1ADC7]">
                <div className="bg-[#17233D] p-4 rounded-xl border border-[#2B3B5B]">
                  <strong className="text-sm font-bold text-[#6FAFFF] block mb-1">
                    g(n): Path Cost from Start
                  </strong>
                  The exact accumulated cost incurred to travel from the start node to current node <code className="text-[#F5F7FF]">n</code> along the known path.
                </div>
                <div className="bg-[#17233D] p-4 rounded-xl border border-[#2B3B5B]">
                  <strong className="text-sm font-bold text-[#A695F2] block mb-1">
                    h(n): Heuristic Estimate
                  </strong>
                  The estimated remaining cost to reach the goal from node <code className="text-[#F5F7FF]">n</code>. Calculated using Manhattan or Octile distance.
                </div>
                <div className="bg-[#17233D] p-4 rounded-xl border border-[#66DAD5]/40">
                  <strong className="text-sm font-bold text-[#66DAD5] block mb-1">
                    f(n): Total Estimated Cost
                  </strong>
                  The predicted lowest total cost for a complete path passing through node <code className="text-[#F5F7FF]">n</code>. The priority queue always pops the node with minimum <code className="text-[#66DAD5]">f(n)</code>.
                </div>
              </div>
            </div>
          )}

          {activeSection === 'heuristics' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-[#F5F7FF] flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#66DAD5]" />
                Heuristic Admissibility & Consistency
              </h3>
              <p className="text-sm text-[#A1ADC7] leading-relaxed">
                A heuristic is <strong className="text-[#66DAD5]">admissible</strong> if it never overestimates the true cost to reach the goal:
              </p>
              <div className="p-3 bg-[#17233D] rounded-lg border border-[#2B3B5B] font-mono text-center text-sm font-bold text-[#F5F7FF]">
                h(n) ≤ h*(n)  for all nodes n
              </div>
              <p className="text-xs text-[#A1ADC7] leading-relaxed">
                Where <code className="text-[#F5F7FF]">h*(n)</code> is the true shortest distance to the goal. When <code className="text-[#F5F7FF]">h(n)</code> is admissible, A* is mathematically guaranteed to return the optimal shortest path!
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="bg-[#17233D] p-4 rounded-xl border border-[#2B3B5B]">
                  <h4 className="text-xs font-bold text-[#F5CF79] uppercase tracking-wider mb-1">
                    Manhattan Distance (4-Directional)
                  </h4>
                  <div className="font-mono text-xs text-[#F5F7FF] mb-2">
                    h = |r1 - r2| + |c1 - c2|
                  </div>
                  <p className="text-xs text-[#A1ADC7]">
                    Admissible and consistent on grid networks where movement is restricted to North, South, East, and West.
                  </p>
                </div>
                <div className="bg-[#17233D] p-4 rounded-xl border border-[#2B3B5B]">
                  <h4 className="text-xs font-bold text-[#86E3B4] uppercase tracking-wider mb-1">
                    Octile Distance (8-Directional)
                  </h4>
                  <div className="font-mono text-xs text-[#F5F7FF] mb-2">
                    h = (dr + dc) + (√2 - 2) * min(dr, dc)
                  </div>
                  <p className="text-xs text-[#A1ADC7]">
                    Admissible for 8-way movement where diagonal steps cost √2 ≈ 1.414. Prevents corner cutting across adjacent obstacles.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'replanning' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-[#F5F7FF] flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#FF9B83]" />
                Real-Time Dynamic Replanning Protocol
              </h3>
              <p className="text-sm text-[#A1ADC7] leading-relaxed">
                In real-world robotics, environments are dynamic and unpredictable. Obstacles, falling debris, or closing blast doors can block a robot's path after deployment.
              </p>
              <div className="bg-[#17233D] p-4 rounded-xl border border-[#2B3B5B] space-y-2 text-xs text-[#A1ADC7]">
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[#66DAD5]">1.</span>
                  <span><strong className="text-[#F5F7FF]">Active Invalidation Watcher:</strong> On every simulation tick, Aegis-1 inspects its upcoming waypoint queue.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[#FF9B83]">2.</span>
                  <span><strong className="text-[#F5F7FF]">Safe Decoupled Halting:</strong> If an upcoming waypoint becomes obstructed, the robot halts immediately at its current valid grid coordinate without snapping or clipping.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[#A695F2]">3.</span>
                  <span><strong className="text-[#F5F7FF]">On-The-Fly A* Search:</strong> A fresh search executes with start = current valid position. The new trajectory is confirmed, and the robot resumes transit seamlessly.</span>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'viva' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-[#F5F7FF] flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#F5CF79]" />
                University Lecturer Viva Examination Notes
              </h3>
              <div className="space-y-3 text-xs">
                <div className="bg-[#17233D] p-3.5 rounded-xl border border-[#2B3B5B]">
                  <strong className="text-[#66DAD5] block text-sm mb-1">
                    Q: Why does A* guarantee an optimal shortest path?
                  </strong>
                  <p className="text-[#A1ADC7] leading-relaxed">
                    A* guarantees optimality because our heuristic function <code className="text-[#F5F7FF]">h(n)</code> is strictly admissible (never overestimates the true cost) and consistent (satisfies triangle inequality). When a node is popped from the open set, its <code className="text-[#F5F7FF]">g(n)</code> is guaranteed to be optimal.
                  </p>
                </div>

                <div className="bg-[#17233D] p-3.5 rounded-xl border border-[#2B3B5B]">
                  <strong className="text-[#6FAFFF] block text-sm mb-1">
                    Q: What data structure is used for the Open Set and why?
                  </strong>
                  <p className="text-[#A1ADC7] leading-relaxed">
                    We implemented a custom binary <strong className="text-[#F5F7FF]">MinHeap</strong> in TypeScript. It achieves <code className="text-[#66DAD5]">O(log N)</code> insertion and minimum extraction. A naive array would require <code className="text-[#FF9B83]">O(N)</code> to find the minimum f-score on every iteration, leading to significant latency on larger grids.
                  </p>
                </div>

                <div className="bg-[#17233D] p-3.5 rounded-xl border border-[#2B3B5B]">
                  <strong className="text-[#FF9B83] block text-sm mb-1">
                    Q: How is dynamic replanning different from precomputed pathfinding?
                  </strong>
                  <p className="text-[#A1ADC7] leading-relaxed">
                    Precomputed pathfinding assumes a static world and fails if the route is blocked mid-transit. Our dynamic replanning engine actively monitors the remaining path waypoints and triggers a localized A* search from the robot's current valid position whenever an unexpected obstacle appears.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
