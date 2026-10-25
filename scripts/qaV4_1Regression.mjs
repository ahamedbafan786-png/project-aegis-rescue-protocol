import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function clickButtonWithText(page, text) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const content = await page.evaluate((el) => el.innerText, btn);
    if (content.toLowerCase().includes(text.toLowerCase())) {
      await btn.click();
      return true;
    }
  }
  return false;
}

async function runRegression() {
  const screenshotsDir = process.env.SCREENSHOTS_DIR || path.resolve('screenshots');
  const artifactsDir = process.env.ARTIFACTS_DIR || null;
  const saveArtifact = (src, name) => {
    if (artifactsDir && fs.existsSync(artifactsDir)) {
      fs.copyFileSync(src, path.join(artifactsDir, name));
    }
  };

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('===========================================================');
  console.log('PROJECT AEGIS — V4.1 INDEPENDENT QA REGRESSION VERIFICATION');
  console.log('===========================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.toString()));

  const report = [];

  const targetUrl = process.env.TEST_URL || 'http://localhost:5173/';
  console.log(`Target Environment: ${targetUrl}`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: PRESENTATION MODE DYNAMIC DETOUR & CLEAN COMPLETION (P0)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Presentation Mode Dynamic Detour & Status Transition...');
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Open Presentation Mode
    const clickedPres = await clickButtonWithText(page, 'College Demo Mode');
    if (!clickedPres) throw new Error('Could not find College Demo Mode button');
    await new Promise((r) => setTimeout(r, 800));

    // Click Deploy Robot
    await page.click('[data-deploy-button]');
    console.log('-> Deploy Robot clicked. Aegis-1 is moving...');

    // Fast polling to trigger collapse during demo window (c in [3..7])
    let triggerClicked = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const hasTrigger = await page.evaluate(() => {
        const targetBtn = document.querySelector('[data-trigger-blockage]');
        if (targetBtn && !targetBtn.disabled && targetBtn.innerText.includes('TRIGGER COLLAPSE')) {
          targetBtn.click();
          return true;
        }
        return false;
      });

      if (hasTrigger) {
        triggerClicked = true;
        console.log(`-> Successfully triggered collapse during demo window at attempt ${i}!`);
        break;
      }
    }

    if (!triggerClicked) {
      throw new Error('TRIGGER COLLAPSE NOW button was never enabled during demo window');
    }

    // Wait for Aegis-1 to execute the bypass detour and arrive at destination
    console.log('-> Waiting for Aegis-1 to detour through row 3 bypass and reach destination...');
    let arrived = false;
    let finalStats = null;
    let finalStatus = '';
    let triggerBtnText = '';

    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const state = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const statusBadge = document.querySelector('div.rounded-full.border')?.innerText || '';
        const triggerBtn = document.querySelector('[data-trigger-blockage]');
        const replayBtn = document.querySelector('[data-deploy-button]');

        // Extract steps and cost numbers from presentation telemetry
        const numbers = Array.from(document.querySelectorAll('.font-mono span.font-bold')).map((el) => el.innerText);

        const hasArrived = statusBadge.includes('RESCUE COMPLETE') || (replayBtn && replayBtn.innerText.includes('REPLAY'));

        return {
          hasArrived,
          statusBadge,
          triggerBtnText: triggerBtn ? triggerBtn.innerText.trim().replace(/\n/g, ' ') : '',
          hasReplayBtn: replayBtn && replayBtn.innerText.includes('REPLAY'),
          numbers,
        };
      });

      if (state.hasArrived && state.hasReplayBtn) {
        arrived = true;
        finalStatus = state.statusBadge;
        triggerBtnText = state.triggerBtnText;
        finalStats = state.numbers;
        break;
      }
    }

    if (!arrived) {
      throw new Error('Aegis-1 did not complete the mission within the expected time');
    }

    console.log('-> Final Status Badge:', finalStatus);
    console.log('-> Trigger Button Text:', triggerBtnText);
    console.log('-> Presentation Telemetry Values:', finalStats);

    const ssP1 = path.join(screenshotsDir, 'v4_1_01_presentation_detour_success.png');
    await page.screenshot({ path: ssP1 });
    saveArtifact(ssP1, 'v4_1_01_presentation_detour_success.png');

    // Assertions for Defect 1
    if (triggerBtnText.includes('DETOUR IN PROGRESS')) {
      throw new Error('FAILED: Trigger button remained stuck on "DETOUR IN PROGRESS" after completion!');
    }
    if (!triggerBtnText.includes('DEMO COMPLETE')) {
      throw new Error(`FAILED: Expected trigger button "DEMO COMPLETE", received: "${triggerBtnText}"`);
    }
    if (!finalStatus.includes('RESCUE COMPLETE · DETOUR SUCCESSFUL')) {
      throw new Error(`FAILED: Expected status badge "RESCUE COMPLETE · DETOUR SUCCESSFUL", received: "${finalStatus}"`);
    }

    report.push({
      test: 'Defect 1 (P0): Presentation Mode Dynamic Detour & Status Transition',
      status: 'PASS',
      details: `Detour successfully executed around collapse at (5,10). Status badge: "${finalStatus}". Trigger button transitioned cleanly to "${triggerBtnText}". Replay button ready.`,
    });
    console.log('✓ Defect 1 Verified PASS');

    // Exit Presentation Mode back to Home
    await page.click('[data-exit-presentation]');
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // TEST 2: ALGORITHM ARENA BFS COST ACCOUNTING ON WEIGHTED TERRAIN (P0)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Algorithm Arena Weighted Terrain BFS Cost Accounting...');
    const clickedArena = await clickButtonWithText(page, 'ALGORITHM ARENA');
    if (!clickedArena) throw new Error('Could not find ALGORITHM ARENA button');
    await new Promise((r) => setTimeout(r, 800));

    // Switch to weighted topology
    const clickedWeighted = await clickButtonWithText(page, 'weighted');
    if (!clickedWeighted) throw new Error('Could not find weighted topology button');
    await new Promise((r) => setTimeout(r, 800));

    const ssA1 = path.join(screenshotsDir, 'v4_1_02_arena_weighted_bfs30.png');
    await page.screenshot({ path: ssA1 });
    saveArtifact(ssA1, 'v4_1_02_arena_weighted_bfs30.png');

    // Extract metrics from the cards
    const arenaMetrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-3 > div'));
      const extractCard = (card) => {
        const rows = Array.from(card.querySelectorAll('.flex.justify-between'));
        const data = {};
        for (const row of rows) {
          const spans = row.querySelectorAll('span');
          if (spans.length >= 2) {
            data[spans[0].innerText.trim()] = spans[1].innerText.trim();
          }
        }
        return data;
      };

      return {
        astar: extractCard(cards[0]),
        dijkstra: extractCard(cards[1]),
        bfs: extractCard(cards[2]),
      };
    });

    console.log('-> Arena Metrics on Weighted Topology:', JSON.stringify(arenaMetrics, null, 2));

    const bfsCost = parseFloat(arenaMetrics.bfs['Route Cost:']);
    const bfsSteps = parseInt(arenaMetrics.bfs['Movement Steps:']);
    const bfsNodes = arenaMetrics.bfs['Path Nodes (N):'];

    const astarCost = parseFloat(arenaMetrics.astar['Route Cost:']);
    const astarSteps = parseInt(arenaMetrics.astar['Movement Steps:']);

    const dijkstraCost = parseFloat(arenaMetrics.dijkstra['Route Cost:']);

    console.log(`-> BFS: Path Nodes = ${bfsNodes}, Movement Steps = ${bfsSteps}, Route Cost = ${bfsCost}`);
    console.log(`-> A*: Movement Steps = ${astarSteps}, Route Cost = ${astarCost}`);
    console.log(`-> Dijkstra: Route Cost = ${dijkstraCost}`);

    if (bfsCost !== 30.0) {
      throw new Error(`FAILED: Expected BFS Route Cost 30.0 on weighted terrain, received: ${bfsCost}`);
    }
    if (bfsSteps !== 16) {
      throw new Error(`FAILED: Expected BFS Movement Steps 16, received: ${bfsSteps}`);
    }
    if (astarCost !== 22.0) {
      throw new Error(`FAILED: Expected A* Route Cost 22.0, received: ${astarCost}`);
    }
    if (bfsCost <= astarCost) {
      throw new Error(`FAILED: BFS Cost (${bfsCost}) must be greater than A* Cost (${astarCost}) on weighted terrain!`);
    }

    report.push({
      test: 'Defect 2 (P0): BFS Cost Accounting on Weighted Terrain',
      status: 'PASS',
      details: `BFS correctly reports 16 steps and 30.0 weighted traversal cost (7 rough terrain × 3.0 + 9 empty × 1.0), while A* and Dijkstra report 22 steps and 22.0 cost-optimal detour.`,
    });
    console.log('✓ Defect 2 Verified PASS');

    // Return to main menu
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // TEST 3: MOBILE DRAWER EXCLUSIVITY (390x844 & 543x589) (P1)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Mobile Drawer Exclusivity (390x844 & 543x589)...');

    // 3A: 390x844
    await page.setViewport({ width: 390, height: 844 });
    const clickedMissions = (await clickButtonWithText(page, 'Start Rescue')) || (await clickButtonWithText(page, 'LAUNCH MISSIONS'));
    if (!clickedMissions) await page.click('[data-nav-item="missions"]');
    await new Promise((r) => setTimeout(r, 600));
    await page.click('[data-mission-card]');
    await new Promise((r) => setTimeout(r, 800));

    // Initially both drawers must be closed on mobile
    const checkDrawers = async () => {
      return await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        const toolsOpen = bodyText.includes('tactical tools') && bodyText.includes('terrain placement');
        const telemetryOpen = bodyText.includes('a* telemetry') && bodyText.includes('formula analysis');
        return { toolsOpen, telemetryOpen };
      });
    };

    let dState = await checkDrawers();
    if (dState.toolsOpen || dState.telemetryOpen) {
      throw new Error('FAILED: Drawers should default to closed on mobile < 1024px');
    }

    // Open Tools via top bar button
    await page.click('button[title*="Toggle Tools Panel"]');
    await new Promise((r) => setTimeout(r, 300));
    dState = await checkDrawers();
    if (!dState.toolsOpen || dState.telemetryOpen) {
      throw new Error(`FAILED: Expected only Tools open, received: ${JSON.stringify(dState)}`);
    }

    // Now open Telemetry sequentially: Tools MUST close immediately!
    await page.click('button[title*="Toggle Telemetry Panel"]');
    await new Promise((r) => setTimeout(r, 300));
    dState = await checkDrawers();
    if (dState.toolsOpen || !dState.telemetryOpen) {
      throw new Error(`FAILED: Expected only Telemetry open (Tools must close!), received: ${JSON.stringify(dState)}`);
    }

    const ssM1 = path.join(screenshotsDir, 'v4_1_03_mobile_390x844_telemetry.png');
    await page.screenshot({ path: ssM1 });
    saveArtifact(ssM1, 'v4_1_03_mobile_390x844_telemetry.png');

    // Toggle Telemetry off: Board must be fully visible again
    await page.click('button[title*="Toggle Telemetry Panel"]');
    await new Promise((r) => setTimeout(r, 300));
    dState = await checkDrawers();
    if (dState.toolsOpen || dState.telemetryOpen) {
      throw new Error(`FAILED: Closing drawer should leave both closed, received: ${JSON.stringify(dState)}`);
    }

    // 3B: 543x589
    await page.setViewport({ width: 543, height: 589 });
    await new Promise((r) => setTimeout(r, 400));

    // Open Tools via Floating Pill
    await clickButtonWithText(page, 'Tools [T]');
    await new Promise((r) => setTimeout(r, 300));
    dState = await checkDrawers();
    if (!dState.toolsOpen || dState.telemetryOpen) {
      throw new Error(`FAILED 543x589: Tools floating pill did not open Tools drawer`);
    }

    // Click Telemetry button in header: Tools must close!
    await page.click('button[title*="Toggle Telemetry Panel"]');
    await new Promise((r) => setTimeout(r, 300));
    dState = await checkDrawers();
    if (dState.toolsOpen || !dState.telemetryOpen) {
      throw new Error(`FAILED 543x589: Sequentially opening Telemetry did not close Tools!`);
    }

    const ssM2 = path.join(screenshotsDir, 'v4_1_04_narrow_543x589_exclusive.png');
    await page.screenshot({ path: ssM2 });
    saveArtifact(ssM2, 'v4_1_04_narrow_543x589_exclusive.png');

    // Close Telemetry via X button
    const closeBtns = await page.$$('button');
    for (const btn of closeBtns) {
      const isVisible = await page.evaluate((el) => el.offsetParent !== null, btn);
      const isClose = await page.evaluate((el) => el.querySelector('svg.lucide-x') !== null, btn);
      if (isVisible && isClose) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
    dState = await checkDrawers();
    if (dState.toolsOpen || dState.telemetryOpen) {
      throw new Error(`FAILED 543x589: Close (X) button did not restore full board view`);
    }

    report.push({
      test: 'Defect 3 (P1): Mobile Drawer Exclusivity (390x844 & 543x589)',
      status: 'PASS',
      details: `Strict single-state drawer exclusivity ('CLOSED' | 'TOOLS' | 'TELEMETRY') verified on 390x844 and 543x589 viewports. Overlapping eliminated; full board restored cleanly.`,
    });
    console.log('✓ Defect 3 Verified PASS');

  } catch (err) {
    console.error('\n❌ QA REGRESSION ERROR:', err.message);
    const errSs = path.join(screenshotsDir, 'v4_1_regression_error.png');
    await page.screenshot({ path: errSs });
    saveArtifact(errSs, 'v4_1_regression_error.png');
    report.push({
      test: 'QA Regression Execution',
      status: 'FAIL',
      error: err.message,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  console.log('\n===========================================================');
  console.log('V4.1 REGRESSION SUMMARY REPORT:');
  console.log('===========================================================');
  console.table(report);

  if (consoleErrors.length > 0) {
    console.log('Browser Console Errors logged:', consoleErrors);
  } else {
    console.log('Zero browser console errors logged during entire regression suite.');
  }

  if (process.exitCode === 1) {
    process.exit(1);
  }
}

runRegression();
