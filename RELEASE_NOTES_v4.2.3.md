# Project Aegis: Rescue Protocol — Release v4.2.3

**Project Aegis: Rescue Protocol** is an autonomous search-and-rescue pathfinding game and academic algorithms demonstration built in pure TypeScript, React 19, and HTML5 Canvas.

- **Live Application:** [https://project-aegis-theta.vercel.app/](https://project-aegis-theta.vercel.app/)
- **Repository:** [https://github.com/ahamedbafan786-png/project-aegis-rescue-protocol](https://github.com/ahamedbafan786-png/project-aegis-rescue-protocol)

---

## 🎯 v4.2.3 QA Trustworthiness Hotfix

This release hardens the testing architecture and documentation integrity, completely eliminating false-positive test checks, adding automated CI browser smoke tests, and synchronizing system metadata.

### 1. Elimination of False-Positive Browser Tests
- **Scoped Telemetry Selectors:** Replaced coarse whole-page text matching (`text.includes('20')`, `text.includes('1')`) in `qaV4_2_1Acceptance.mjs` and `qaV4_2_2Acceptance.mjs` with scoped data selectors:
  - `[data-telemetry="steps"]` (exact integer parsing)
  - `[data-telemetry="replans"]` (exact integer parsing)
  - `[data-telemetry="total-cost"]` (exact floating-point parsing)
- **Algorithm Arena Scoped Metrics:** Replaced card text searching with dedicated scoped selectors (`[data-tab="..."] [data-metric="cost"]` and `[data-metric="steps"]`), strictly asserting BFS route cost of 30.0 vs A* cost of 22.0 vs Dijkstra cost of 22.0.
- **Rigorous Mobile HUD Verification:** Enforced geometric assertions across 6 test viewports (320px, 360px, 375px, 390px, 430px, 543px):
  - Element actually visible in computed styles (`display !== 'none'`, `visibility !== 'hidden'`).
  - Positive non-zero dimensions (`width > 0 && height > 0`).
  - Exact charge value verification (`2/2`, `1/2`, `0/2`).
  - Exact 2D bounding-box intersection checks preventing overlap with Tools and Telemetry drawer buttons.
  - Viewport boundary checks preventing horizontal or vertical clipping.
  - Fail-fast process exit (`process.exit(1)`) on any discrepancy.

### 2. Legacy QA Script Repair & Provenance
- **Unreachable Goal Verification:** Fixed legacy placeholder in `scripts/finalQARun.mjs` to authoritatively test pathfinding against an enclosed unreachable goal, strictly verifying `found === false` and `path.length === 0`.
- **Failure Propagation:** Ensured all caught exceptions and browser console errors in `finalQARun.mjs`, `verifyApp.mjs`, and historical regression suites propagate directly to `process.exit(1)`.
- **Historical Classification:** Marked historical test scripts (`qaV3Audit.mjs`, `qaV4Acceptance.mjs`, `qaV4_1Regression.mjs`, `qaV4_2Acceptance.mjs`, `finalQARun.mjs`, `verifyApp.mjs`) with clear legacy provenance notices, designating `qaV4_2_2Acceptance.mjs` and `qaSmokeCI.mjs` as current authoritative suites.

### 3. Personal Path Remediation & Portability
- **Sanitized Reports:** Replaced workstation-specific paths in `GITHUB_RELEASE_READINESS_REPORT.md` with portable project-relative references.
- **Cleanliness Audit:** Verified 0 occurrences of personal paths, usernames, or local machine directories across all currently tracked repository files.
- **Historical Exposure Disclosure:** Older Git commits prior to v4.2.2 retain historical path references; per working agreements, historical commits are preserved without rewriting or force-pushing history.

### 4. Node.js Engine & Tooling Alignment
- **Engine Range:** Aligned `package.json` engines to `"node": "^22.12.0 || ^24.0.0 || >=26.0.0", "npm": ">=10.0.0"` matching Vitest, Vite, Puppeteer, and Oxlint.
- **Documentation & NVM:** Updated `.nvmrc` (Node 22 LTS) and README prerequisites to specify tested Node.js 22 LTS support.

### 5. Documentation & Rendering Corrections
- **TypeScript Table:** Corrected language entry in README technology table to `TypeScript 6.0` (`typescript@6.0.3` installed).
- **Mathematical Rendering:** Corrected KaTeX formula rendering by replacing `$3\times$` with clean Unicode `3× movement cost`.
- **Genuine OpenGraph & Twitter Metadata:** Added valid `<meta property="og:...">` and `<meta name="twitter:...">` tags to `index.html`.

### 6. GitHub Actions CI Pipeline Enhancement
- **Browser Smoke Test Job:** Added dedicated `browser-smoke-test` CI job running a local preview server on Node 22 and executing `scripts/qaSmokeCI.mjs` with real headless browser assertions.
- **Runtime Warning Mitigation:** Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` to workflow configuration to target modern Node 24 runtime environments.

---

## 🧪 Verification Summary

- **Unit Tests:** **63/63 passing** (`npm test`) across 7 test suites in 292ms.
- **Linter:** **0 errors** (`npm run lint`).
- **Production Build:** Succeeded in 604ms (`npm run build`).
- **CI Browser Smoke Test:** **7/7 checks passed** with 0 console errors (`npm run test:smoke`).
- **Browser Acceptance Suite:** **11/11 scenarios passed** with exact scoped metrics (`npm run test:e2e`).
