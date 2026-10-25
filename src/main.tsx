import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { findPathAStar } from './algorithms/astar';
import { findPathDijkstra } from './algorithms/dijkstra';
import { findPathBFS } from './algorithms/bfs';

// Expose algorithmic engine on window for authoritative browser test harnesses
if (typeof window !== 'undefined') {
  (window as unknown as { __AEGIS_ENGINE__?: unknown }).__AEGIS_ENGINE__ = {
    findPathAStar,
    findPathDijkstra,
    findPathBFS,
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
