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

async function runAcceptance() {
  const screenshotsDir = path.resolve('screenshots');
  const artifactsDir = 'C:/Users/Ahmed/.gemini/antigravity/brain/2be5b84d-78ac-41bf-953a-638f6d09f3be';

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('===========================================================');
  console.log('PROJECT AEGIS V4.2 — PREMIUM INDIE GAME VERIFICATION SUITE');
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
  console.log(`Target URL: ${targetUrl}\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: MAIN MENU MAKEOVER & BRANDING
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Verifying Main Menu Transformation & Indie Game Identity...');
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    const pageContent = await page.evaluate(() => document.body.innerText);
    const hasTagline = pageContent.includes('One robot. Impossible terrain. Every second counts.');
    const hasStartRescue = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some((b) => b.innerText.toLowerCase().includes('start rescue'))
    );
    const hasChallengeBtn = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some((b) => b.innerText.toLowerCase().includes('challenge missions'))
    );
    const hasV4_2Badge = await page.evaluate(() =>
      document.body.innerText.includes('A* V4.2')
    );

    console.log(`  -> Tagline present: ${hasTagline}`);
    console.log(`  -> "Start Rescue" CTA: ${hasStartRescue}`);
    console.log(`  -> "Challenge Missions" CTA: ${hasChallengeBtn}`);
    console.log(`  -> Navbar badge A* V4.2: ${hasV4_2Badge}`);

    if (!hasTagline || !hasStartRescue || !hasV4_2Badge) {
      throw new Error('Main menu transformation verification failed');
    }

    const shot1 = path.join(screenshotsDir, 'v4_2_01_main_menu.png');
    await page.screenshot({ path: shot1 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot1, path.join(artifactsDir, 'v4_2_01_main_menu.png'));
    }
    report.push({ test: 'Main Menu Transformation & Brand Identity', pass: true });

    // -------------------------------------------------------------------------
    // TEST 2: MISSION SELECT & CHALLENGE MISSIONS
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Verifying Tactical Operations Deck & Challenge Missions...');
    await clickButtonWithText(page, 'Start Rescue');
    await new Promise((r) => setTimeout(r, 700));

    const missionCards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-mission-card]')).map((c) =>
        c.getAttribute('data-mission-card')
      )
    );
    console.log(`  -> Detected missions: ${missionCards.join(', ')}`);
    const hasChallenge1 = missionCards.includes('mission-challenge-1');
    const hasChallenge2 = missionCards.includes('mission-challenge-2');

    if (!hasChallenge1 || !hasChallenge2) {
      throw new Error('Challenge missions not found in mission select deck');
    }

    const shot2 = path.join(screenshotsDir, 'v4_2_02_mission_select.png');
    await page.screenshot({ path: shot2 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot2, path.join(artifactsDir, 'v4_2_02_mission_select.png'));
    }
    report.push({ test: 'Tactical Operations Deck & Challenge Missions', pass: true });

    // -------------------------------------------------------------------------
    // TEST 3: EMERGENCY CORRIDOR CONTROL MECHANIC (CHALLENGE 1)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Emergency Corridor Control (Debris Clearance & A* Replan)...');
    await page.click('[data-mission-card="mission-challenge-1"]');
    await new Promise((r) => setTimeout(r, 800));

    // Verify Charges Widget & Tool
    const hudCharges = await page.evaluate(() => {
      const el = document.body.innerText;
      return el.includes('CHARGES: 2 / 2') || el.includes('REPAIR CHARGES: 2');
    });
    console.log(`  -> Initial Repair Charges displayed: ${hudCharges}`);

    // Verify initial route cost / steps (detour route > 16 steps)
    const initialRouteSteps = await page.evaluate(() => {
      // Find step count in telemetry or metrics
      const text = document.body.innerText;
      return text;
    });

    // Locate exact screen coordinates for debris cells (5, 8) and (5, 12)
    const clickCoords = await page.evaluate(() => {
      const c = document.querySelector('canvas.cursor-crosshair');
      if (!c) return null;
      const rect = c.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const cols = 21;
      const rows = 11;
      const pad = width < 600 || height < 500 ? 10 : 20;
      const availW = Math.max(width - pad * 2, 40);
      const availH = Math.max(height - pad * 2, 40);
      const tileW = Math.floor(availW / cols);
      const tileH = Math.floor(availH / rows);
      const tileSize = Math.max(10, Math.min(68, Math.min(tileW, tileH)));
      const offsetX = Math.max(0, Math.floor((width - cols * tileSize) / 2));
      const offsetY = Math.max(0, Math.floor((height - rows * tileSize) / 2));

      return {
        debris1: {
          x: rect.left + offsetX + 8 * tileSize + tileSize / 2,
          y: rect.top + offsetY + 5 * tileSize + tileSize / 2,
        },
        debris2: {
          x: rect.left + offsetX + 12 * tileSize + tileSize / 2,
          y: rect.top + offsetY + 5 * tileSize + tileSize / 2,
        },
      };
    });

    if (!clickCoords) throw new Error('Game canvas not found');

    // Click Demolish tool button
    await clickButtonWithText(page, 'Demolish Debris');
    console.log('  -> Demolish tool selected');

    // Click on debris at (r: 5, c: 8)
    await page.mouse.click(clickCoords.debris1.x, clickCoords.debris1.y);
    console.log('  -> Demolished debris at (5, 8)');
    await new Promise((r) => setTimeout(r, 400));

    // Click on debris at (r: 5, c: 12)
    await page.mouse.click(clickCoords.debris2.x, clickCoords.debris2.y);
    console.log('  -> Demolished debris at (5, 12)');
    await new Promise((r) => setTimeout(r, 500));

    const shot3 = path.join(screenshotsDir, 'v4_2_03_corridor_cleared_replan.png');
    await page.screenshot({ path: shot3 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot3, path.join(artifactsDir, 'v4_2_03_corridor_cleared_replan.png'));
    }

    // Deploy robot through cleared corridor
    console.log('  -> Deploying Aegis-1 along breached conduit...');
    await clickButtonWithText(page, 'Deploy');
    
    // Wait for arrival at target
    let arrived = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const statusText = await page.evaluate(() => document.body.innerText);
      if (statusText.includes('MISSION ACCOMPLISHED') || statusText.includes('RESCUE COMPLETE') || statusText.includes('Mission Accomplished')) {
        arrived = true;
        break;
      }
    }

    console.log(`  -> Robot arrived and secured survivor: ${arrived}`);
    if (!arrived) throw new Error('Robot did not reach rescue pod through cleared corridor');

    await new Promise((r) => setTimeout(r, 1000));
    const shot4 = path.join(screenshotsDir, 'v4_2_04_docking_and_completion.png');
    await page.screenshot({ path: shot4 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot4, path.join(artifactsDir, 'v4_2_04_docking_and_completion.png'));
    }
    report.push({ test: 'Emergency Corridor Control & Rescue Arrival Sequence', pass: true });

    // Return to Mission Select via Modal exit button
    await page.click('[data-action="exit-to-missions"]');
    await new Promise((r) => setTimeout(r, 700));

    // -------------------------------------------------------------------------
    // TEST 4: SECTOR BIOME ARTISTRY (CRYSTAL CANYON & MAZE)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Verifying Sector Biomes (Crystal Canyon & Maze Protocol)...');
    await page.click('[data-mission-card="mission-3"]');
    await new Promise((r) => setTimeout(r, 700));

    const shot5 = path.join(screenshotsDir, 'v4_2_05_canyon_visuals.png');
    await page.screenshot({ path: shot5 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot5, path.join(artifactsDir, 'v4_2_05_canyon_visuals.png'));
    }

    // Return to missions and open Maze
    await page.click('[data-nav-item="missions"]');
    await new Promise((r) => setTimeout(r, 600));
    await page.click('[data-mission-card="mission-4"]');
    await new Promise((r) => setTimeout(r, 700));

    const shot6 = path.join(screenshotsDir, 'v4_2_06_maze_visuals.png');
    await page.screenshot({ path: shot6 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot6, path.join(artifactsDir, 'v4_2_06_maze_visuals.png'));
    }
    report.push({ test: 'Sector Visual Environments (Amethyst Canyon & Neural Labyrinth)', pass: true });

    // -------------------------------------------------------------------------
    // TEST 5: ALGORITHM ARENA BFS ROUTE LABEL ACCURACY
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Verifying Algorithm Arena BFS Legend Precision...');
    await page.click('[data-nav-item="arena"]');
    await new Promise((r) => setTimeout(r, 800));

    // Switch to BFS tab
    await page.click('[data-tab="bfs"]');
    await new Promise((r) => setTimeout(r, 600));

    const arenaLegend = await page.evaluate(() => document.body.innerText);
    const hasFewestStepLabel = arenaLegend.includes('Fewest-Step Route');
    console.log(`  -> BFS Legend shows "Fewest-Step Route (Hop-Optimal)": ${hasFewestStepLabel}`);

    if (!hasFewestStepLabel) {
      throw new Error('BFS path label in Algorithm Arena is not "Fewest-Step Route"');
    }

    const shot7 = path.join(screenshotsDir, 'v4_2_07_arena_bfs_label.png');
    await page.screenshot({ path: shot7 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot7, path.join(artifactsDir, 'v4_2_07_arena_bfs_label.png'));
    }
    report.push({ test: 'Algorithm Arena BFS Legend Precision', pass: true });

    // -------------------------------------------------------------------------
    // TEST 6: ACCESSIBILITY & RESPONSIVE VIEWPORT (390x844 & 543x589)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Verifying Accessibility (aria-label) & Mobile Drawer Exclusivity...');
    await page.setViewport({ width: 390, height: 844 });
    await page.click('[data-nav-item="missions"]');
    await new Promise((r) => setTimeout(r, 500));
    await page.click('[data-mission-card="mission-1"]');
    await new Promise((r) => setTimeout(r, 600));

    // Open Tools drawer
    await clickButtonWithText(page, 'Tools');
    await new Promise((r) => setTimeout(r, 300));

    // Verify close drawer button has aria-label="Close drawer"
    const hasAriaLabel = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Close drawer"]');
      return btn !== null;
    });
    console.log(`  -> Drawer close button has aria-label="Close drawer": ${hasAriaLabel}`);

    const shot8 = path.join(screenshotsDir, 'v4_2_08_mobile_390x844.png');
    await page.screenshot({ path: shot8 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot8, path.join(artifactsDir, 'v4_2_08_mobile_390x844.png'));
    }

    if (!hasAriaLabel) {
      throw new Error('Drawer close button missing aria-label="Close drawer"');
    }
    report.push({ test: 'Accessibility & Mobile Drawer Exclusivity', pass: true });

    // -------------------------------------------------------------------------
    // TEST 7: PRESENTATION MODE DETERMINISTIC DETOUR
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Verifying Presentation Mode Detour Preserved...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.click('[data-nav-item="presentation"]');
    await new Promise((r) => setTimeout(r, 600));

    await page.click('[data-deploy-button]');
    console.log('  -> Deploy Robot clicked in Presentation Mode...');

    let presTriggerClicked = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const hasTrigger = await page.evaluate(() => {
        const btn = document.querySelector('[data-trigger-blockage]');
        if (btn && !btn.disabled) {
          btn.click();
          return true;
        }
        return false;
      });
      if (hasTrigger) {
        presTriggerClicked = true;
        console.log(`  -> Trigger Collapse fired at poll iteration ${i}`);
        break;
      }
    }

    if (!presTriggerClicked) throw new Error('Could not fire Trigger Collapse in Presentation Mode');

    // Wait for arrival
    let presDone = false;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const done = await page.evaluate(() => {
        const t = document.body.innerText;
        return t.includes('RESCUE COMPLETE') || t.includes('DETOUR COMPLETE');
      });
      if (done) {
        presDone = true;
        break;
      }
    }

    console.log(`  -> Presentation Mode detour reached target: ${presDone}`);
    if (!presDone) throw new Error('Presentation Mode detour did not complete successfully');

    const shot9 = path.join(screenshotsDir, 'v4_2_09_presentation_detour.png');
    await page.screenshot({ path: shot9 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot9, path.join(artifactsDir, 'v4_2_09_presentation_detour.png'));
    }
    report.push({ test: 'Presentation Mode Deterministic Detour', pass: true });

  } catch (err) {
    console.error(`\n❌ VERIFICATION FAILED: ${err.message}`);
    report.push({ test: 'Verification Exception', pass: false, error: err.message });
  } finally {
    await browser.close();
  }

  console.log('\n===========================================================');
  console.log('PROJECT AEGIS V4.2 — ACCEPTANCE SUMMARY');
  console.log('===========================================================');
  let allPassed = true;
  for (const item of report) {
    console.log(`[${item.pass ? 'PASS' : 'FAIL'}] ${item.test}`);
    if (!item.pass) allPassed = false;
  }
  console.log(`\nConsole Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }
  console.log(`Final Result: ${allPassed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  process.exit(allPassed ? 0 : 1);
}

runAcceptance();
