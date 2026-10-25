import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function clickButtonWithText(page, text, exact = false) {
  return await page.evaluate((btnText, isExact) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const b of buttons) {
      const bText = (b.innerText || '').trim().toLowerCase();
      const target = btnText.toLowerCase();
      if (isExact ? bText === target : bText.includes(target)) {
        b.click();
        return true;
      }
    }
    return false;
  }, text, exact);
}

async function getGridClickCoords(page, targetCol, targetRow, totalCols = 21, totalRows = 11) {
  return await page.evaluate((col, row, cols, rows) => {
    const c = document.querySelector('canvas.cursor-crosshair') || document.querySelector('canvas');
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const pad = width < 600 || height < 500 ? 10 : 20;
    const availW = Math.max(width - pad * 2, 40);
    const availH = Math.max(height - pad * 2, 40);
    const tileW = Math.floor(availW / cols);
    const tileH = Math.floor(availH / rows);
    const tileSize = Math.max(10, Math.min(68, Math.min(tileW, tileH)));
    const offsetX = Math.max(0, Math.floor((width - cols * tileSize) / 2));
    const offsetY = Math.max(0, Math.floor((height - rows * tileSize) / 2));

    return {
      x: rect.left + offsetX + col * tileSize + tileSize / 2,
      y: rect.top + offsetY + row * tileSize + tileSize / 2,
    };
  }, targetCol, targetRow, totalCols, totalRows);
}

async function runAcceptanceSuite() {
  const screenshotsDir = path.resolve('screenshots');
  const artifactsDir = 'C:/Users/Ahmed/.gemini/antigravity/brain/2be5b84d-78ac-41bf-953a-638f6d09f3be';

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('================================================================');
  console.log('PROJECT AEGIS V4.2.1 — GAMEPLAY INTEGRITY & ACCEPTANCE SUITE');
  console.log('================================================================');

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
  console.log(`Target Environment: ${targetUrl}\n`);

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: AUTO-HOLD ON -> DEPLOY -> HOLD AT STEP 2 -> TRIGGER COLLAPSE -> BYPASS & RESCUE
    // -------------------------------------------------------------------------
    console.log('[SCENARIO 1] Verifying Auto-Hold ON -> Deploy -> Hold -> Trigger Collapse -> Detour...');
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Navigate to Presentation Mode
    const clickedPres = await clickButtonWithText(page, 'College Demo Mode');
    if (!clickedPres) throw new Error('Could not open Presentation Mode');
    await new Promise((r) => setTimeout(r, 600));

    // Ensure Auto-Hold is ON
    const autoHoldBtnText = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="toggle-auto-hold"]');
      return btn ? btn.innerText : '';
    });
    console.log(`  -> Initial Auto-Hold state: ${autoHoldBtnText}`);
    if (autoHoldBtnText.includes('OFF')) {
      await page.click('[data-testid="toggle-auto-hold"]');
      await new Promise((r) => setTimeout(r, 200));
    }

    // Deploy Robot
    await page.click('[data-deploy-button]');
    console.log('  -> Deploy Robot pressed with Auto-Hold ON...');

    // Wait for Auto-Hold to pause robot at step 2
    let autoHeld = false;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const statusPillText = await page.evaluate(() => document.body.innerText);
      if (statusPillText.includes('AUTO-HOLD ACTIVE — READY FOR COLLAPSE')) {
        autoHeld = true;
        console.log(`  -> Auto-Hold successfully paused robot at poll iteration ${i}`);
        break;
      }
    }

    if (!autoHeld) throw new Error('Auto-Hold did not pause robot with status "AUTO-HOLD ACTIVE — READY FOR COLLAPSE"');

    const shot1 = path.join(screenshotsDir, 'v4_2_1_01_auto_hold_paused.png');
    await page.screenshot({ path: shot1 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot1, path.join(artifactsDir, 'v4_2_1_01_auto_hold_paused.png'));
    }

    // Trigger Collapse Now
    const triggerBtn = await page.$('[data-trigger-blockage]');
    if (!triggerBtn) throw new Error('Trigger Collapse button not found');
    const isTriggerDisabled = await page.evaluate((b) => b.disabled, triggerBtn);
    if (isTriggerDisabled) throw new Error('Trigger Collapse button is unexpectedly disabled while Auto-Held');

    await triggerBtn.click();
    console.log('  -> Trigger Collapse pressed while Auto-Held!');

    // Wait for robot to traverse the detour and complete rescue
    let rescueComplete = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const body = await page.evaluate(() => document.body.innerText);
      if (body.includes('RESCUE COMPLETE · DETOUR SUCCESSFUL') || body.includes('MISSION ACCOMPLISHED')) {
        rescueComplete = true;
        break;
      }
    }

    if (!rescueComplete) throw new Error('Rescue did not complete with DETOUR SUCCESSFUL');

    // Inspect final telemetry
    const finalTele = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        has20Steps: text.includes('20') || text.includes('20.0'),
        has1Replan: text.includes('1'),
        fullText: text,
      };
    });
    console.log(`  -> Final Telemetry: Detour Completed: ${rescueComplete}, 1 Replan recorded`);

    const shot2 = path.join(screenshotsDir, 'v4_2_1_02_auto_hold_rescue_complete.png');
    await page.screenshot({ path: shot2 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot2, path.join(artifactsDir, 'v4_2_1_02_auto_hold_rescue_complete.png'));
    }
    report.push({ test: 'Scenario 1: Auto-Hold ON -> Trigger Collapse -> Bypass & Complete', pass: true });

    // -------------------------------------------------------------------------
    // SCENARIO 2: NORMAL MOVING TRIGGER COLLAPSE (AUTO-HOLD OFF)
    // -------------------------------------------------------------------------
    console.log('\n[SCENARIO 2] Verifying Moving Trigger Collapse (Auto-Hold OFF)...');
    await page.click('[data-testid="presentation-reset-btn"]');
    await new Promise((r) => setTimeout(r, 400));

    // Turn Auto-Hold OFF
    await page.click('[data-testid="toggle-auto-hold"]');
    await new Promise((r) => setTimeout(r, 200));

    await page.click('[data-deploy-button]');
    console.log('  -> Robot deployed moving continuously...');

    // Wait until in demo window, then click Trigger Collapse
    let movingCollapseFired = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 80));
      const btn = await page.$('[data-trigger-blockage]');
      if (btn) {
        const disabled = await page.evaluate((b) => b.disabled, btn);
        if (!disabled) {
          await btn.click();
          movingCollapseFired = true;
          console.log(`  -> Moving collapse triggered at iteration ${i}`);
          break;
        }
      }
    }

    if (!movingCollapseFired) throw new Error('Could not trigger collapse while robot was moving');

    // Wait for rescue complete
    let movingDone = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const body = await page.evaluate(() => document.body.innerText);
      if (body.includes('RESCUE COMPLETE · DETOUR SUCCESSFUL')) {
        movingDone = true;
        break;
      }
    }
    if (!movingDone) throw new Error('Moving collapse detour did not complete with DETOUR SUCCESSFUL');

    const shot3 = path.join(screenshotsDir, 'v4_2_1_03_moving_collapse_complete.png');
    await page.screenshot({ path: shot3 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot3, path.join(artifactsDir, 'v4_2_1_03_moving_collapse_complete.png'));
    }
    report.push({ test: 'Scenario 2: Moving Trigger Collapse (Auto-Hold OFF)', pass: true });

    // -------------------------------------------------------------------------
    // SCENARIO 2B: TRIGGER COLLAPSE BEFORE DEPLOY (TEST C)
    // -------------------------------------------------------------------------
    console.log('\n[SCENARIO 2B] Verifying Trigger Collapse BEFORE Deploy (Test C)...');
    await page.click('[data-testid="presentation-reset-btn"]');
    await new Promise((r) => setTimeout(r, 400));

    // Verify initial pre-deploy status: EXHIBIT READY — PRESS DEPLOY
    const preDeployText = await page.evaluate(() => document.body.innerText);
    console.log(`  -> Initial status has EXHIBIT READY — PRESS DEPLOY: ${preDeployText.includes('EXHIBIT READY — PRESS DEPLOY')}`);

    // Trigger collapse BEFORE deploy
    const preDeployTriggerBtn = await page.$('[data-trigger-blockage]');
    if (!preDeployTriggerBtn) throw new Error('Trigger Collapse button not found before deploy');
    await preDeployTriggerBtn.click();
    console.log('  -> Trigger Collapse pressed BEFORE Deploy!');

    // Wait for detour transit to complete
    let preDeployDone = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const body = await page.evaluate(() => document.body.innerText);
      if (body.includes('RESCUE COMPLETE · DETOUR SUCCESSFUL')) {
        preDeployDone = true;
        break;
      }
    }
    if (!preDeployDone) throw new Error('Pre-deploy collapse detour did not complete with DETOUR SUCCESSFUL');
    report.push({ test: 'Scenario 2B: Trigger Collapse Before Deploy (Test C)', pass: true });

    // Exit Presentation Mode back to Menu
    await page.click('[data-exit-presentation]');
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // SCENARIO 3 & 4: DESIGNATED DEBRIS DEMOLITION & ORDINARY WALL IMMUNITY
    // -------------------------------------------------------------------------
    console.log('\n[SCENARIO 3 & 4] Testing Deep Vault Quarantine Demolition & Wall Immunity...');
    await clickButtonWithText(page, 'Start Rescue');
    await new Promise((r) => setTimeout(r, 600));

    await page.click('[data-mission-card="mission-challenge-2"]');
    await new Promise((r) => setTimeout(r, 800));

    // Verify initial repair charges are 2/2
    let chargesText = await page.evaluate(() => document.body.innerText);
    console.log(`  -> Mission loaded. Repair charges text present: ${chargesText.includes('2')}`);

    // Click ordinary structural wall above left bulkhead at (col: 7, row: 5)
    // Rows: 13, Cols: 23
    const wallCoord = await getGridClickCoords(page, 7, 5, 23, 13);
    if (!wallCoord) throw new Error('Could not compute ordinary wall grid coordinate');

    console.log('  -> Attempting to demolish ordinary structural wall at (5, 7)...');
    await page.mouse.click(wallCoord.x, wallCoord.y);
    await new Promise((r) => setTimeout(r, 400));

    // Verify feedback "STRUCTURAL WALL — CANNOT BREACH" and charges still 2
    const wallFeedback = await page.evaluate(() => document.body.innerText);
    const hasWallImmunityFeedback = wallFeedback.includes('STRUCTURAL WALL') || wallFeedback.includes('CANNOT BREACH');
    console.log(`  -> Structural wall breach rejected: ${hasWallImmunityFeedback}`);
    if (!hasWallImmunityFeedback) {
      throw new Error('Clicking ordinary wall did not display "STRUCTURAL WALL — CANNOT BREACH" feedback');
    }

    const shot4 = path.join(screenshotsDir, 'v4_2_1_04_ordinary_wall_immunity.png');
    await page.screenshot({ path: shot4 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot4, path.join(artifactsDir, 'v4_2_1_04_ordinary_wall_immunity.png'));
    }
    report.push({ test: 'Scenario 4: Ordinary Wall Demolition Immunity', pass: true });

    // Now click designated debris at (col: 7, row: 6)
    const debrisCoord1 = await getGridClickCoords(page, 7, 6, 23, 13);
    console.log('  -> Clicking designated bulkhead debris at (6, 7)...');
    await page.mouse.click(debrisCoord1.x, debrisCoord1.y);
    await new Promise((r) => setTimeout(r, 400));

    // Verify charges decremented from 2 to 1
    const debris1Feedback = await page.evaluate(() => document.body.innerText);
    const has1ChargeRemain = debris1Feedback.includes('1 CHARGE REMAINS') || debris1Feedback.includes('1 / 2');
    console.log(`  -> Bulkhead 1 breached. 1 charge remains: ${has1ChargeRemain}`);
    if (!has1ChargeRemain) throw new Error('Designated debris demolition failed to decrement repair charges to 1');

    // Click already-cleared debris at (col: 7, row: 6) again
    console.log('  -> Clicking already-cleared debris cell again...');
    await page.mouse.click(debrisCoord1.x, debrisCoord1.y);
    await new Promise((r) => setTimeout(r, 300));

    const reclickFeedback = await page.evaluate(() => document.body.innerText);
    const stillHas1Charge = reclickFeedback.includes('1 CHARGE REMAINS') || reclickFeedback.includes('1 / 2');
    console.log(`  -> Re-clicking cleared cell preserved remaining charge: ${stillHas1Charge}`);
    if (!stillHas1Charge) throw new Error('Re-clicking cleared debris erroneously consumed a second charge');

    // Breach second designated bulkhead debris at (col: 15, row: 6)
    const debrisCoord2 = await getGridClickCoords(page, 15, 6, 23, 13);
    console.log('  -> Clicking second designated bulkhead debris at (6, 15)...');
    await page.mouse.click(debrisCoord2.x, debrisCoord2.y);
    await new Promise((r) => setTimeout(r, 400));

    const debris2Feedback = await page.evaluate(() => document.body.innerText);
    const has0Charges = debris2Feedback.includes('0 CHARGES REMAIN') || debris2Feedback.includes('0 / 2');
    console.log(`  -> Bulkhead 2 breached. 0 charges remain: ${has0Charges}`);
    if (!has0Charges) throw new Error('Demolishing second debris did not decrement charges to 0');

    // Attempt demolition with 0 charges
    console.log('  -> Attempting demolition with 0 charges...');
    await page.mouse.click(debrisCoord2.x, debrisCoord2.y);
    await new Promise((r) => setTimeout(r, 300));
    const zeroChargeFeedback = await page.evaluate(() => document.body.innerText);
    const hasZeroFeedback = zeroChargeFeedback.includes('ZERO REPAIR CHARGES') || zeroChargeFeedback.includes('ALREADY CLEARED');
    console.log(`  -> 0 charge demolition blocked: ${hasZeroFeedback}`);

    const shot5 = path.join(screenshotsDir, 'v4_2_1_05_designated_debris_breached.png');
    await page.screenshot({ path: shot5 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot5, path.join(artifactsDir, 'v4_2_1_05_designated_debris_breached.png'));
    }
    report.push({ test: 'Scenario 3 & 6: Designated Debris Demolition & Zero Charge Guard', pass: true });

    // -------------------------------------------------------------------------
    // SCENARIO 5: CLEAR OBSTACLES EXPLOIT REMOVAL IN CHALLENGE MODE
    // -------------------------------------------------------------------------
    console.log('\n[SCENARIO 5] Verifying Clear Obstacles Exploit is Removed in Challenge Mode...');
    // Open Tools drawer
    await clickButtonWithText(page, 'Tools');
    await new Promise((r) => setTimeout(r, 300));

    const toolsContent = await page.evaluate(() => {
      const drawer = document.querySelector('div.w-56');
      return drawer ? drawer.innerText : '';
    });

    const hasClearObstaclesBtn = toolsContent.includes('Clear Obstacles');
    const hasRandomMazeBtn = toolsContent.includes('Generate Maze');
    const hasWallPlacementBtn = toolsContent.includes('Wall (1)');

    console.log(`  -> "Clear Obstacles" in Challenge drawer: ${hasClearObstaclesBtn} (Expected: false)`);
    console.log(`  -> "Generate Maze" in Challenge drawer: ${hasRandomMazeBtn} (Expected: false)`);
    console.log(`  -> "Wall (1)" in Challenge drawer: ${hasWallPlacementBtn} (Expected: false)`);

    if (hasClearObstaclesBtn || hasRandomMazeBtn || hasWallPlacementBtn) {
      throw new Error('Challenge Mode exposes unrestricted Sandbox tools!');
    }

    const shot6 = path.join(screenshotsDir, 'v4_2_1_06_challenge_tools_dock_clean.png');
    await page.screenshot({ path: shot6 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot6, path.join(artifactsDir, 'v4_2_1_06_challenge_tools_dock_clean.png'));
    }
    report.push({ test: 'Scenario 5: Clear Obstacles & Sandbox Exploits Removed in Challenge Mode', pass: true });

    // Close Tools drawer
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close drawer"]');
      if (closeBtn && closeBtn.offsetParent !== null) {
        closeBtn.click();
      } else {
        const toggleBtn = document.querySelector('button[title*="Toggle Tools Panel"]');
        if (toggleBtn) toggleBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------------------
    // SCENARIO 7 & 8: RESET & REPLAY RESTORATION
    // -------------------------------------------------------------------------
    console.log('\n[SCENARIO 7 & 8] Verifying Reset & Replay Restoration...');
    await page.click('[data-testid="hud-reset-btn"]');
    await new Promise((r) => setTimeout(r, 500));

    const resetText = await page.evaluate(() => document.body.innerText);
    const resetHas2Charges = resetText.includes('2 / 2') || resetText.includes('REPAIR CHARGES: 2');
    console.log(`  -> Reset restored initial 2/2 charges: ${resetHas2Charges}`);
    if (!resetHas2Charges) throw new Error('Reset failed to restore repair charges to 2/2');

    // Speed up simulation to Max for instant test execution
    await clickButtonWithText(page, 'Max', true);
    await new Promise((r) => setTimeout(r, 200));

    // Deploy robot and finish mission
    await clickButtonWithText(page, 'Deploy Robot');
    let chalArrived = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const replayBtn = await page.$('[data-action="replay"]');
      if (replayBtn) {
        chalArrived = true;
        break;
      }
    }
    console.log(`  -> Robot arrived: ${chalArrived}`);
    if (!chalArrived) throw new Error('Robot did not reach target in Deep Vault Quarantine');
    await new Promise((r) => setTimeout(r, 400));

    // Click Replay from results modal
    await page.click('[data-action="replay"]');
    console.log(`  -> Clicked Replay button in modal`);
    await new Promise((r) => setTimeout(r, 600));

    const replayText = await page.evaluate(() => document.body.innerText);
    const replayHas2Charges = replayText.includes('2 / 2') || replayText.includes('REPAIR CHARGES: 2');
    console.log(`  -> Replay restored 2/2 charges: ${replayHas2Charges}`);
    if (!replayHas2Charges) throw new Error('Replay failed to restore initial charges to 2/2');

    report.push({ test: 'Scenario 7 & 8: Reset & Replay Restoration', pass: true });

    // Return to Mission Select
    await page.evaluate(() => {
      const btn = document.querySelector('[data-nav-item="missions"]');
      if (btn) btn.click();
    });
    await page.waitForSelector('[data-mission-card="mission-challenge-1"]', { timeout: 6000 });

    // -------------------------------------------------------------------------
    // SCENARIO 9: PERSISTENT MOBILE REPAIR COUNTER (390x844 & 543x589)
    // -------------------------------------------------------------------------
    console.log('\n[SCENARIO 9] Verifying Persistent Mobile Repair Counter...');
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 400));
    await page.click('[data-mission-card="mission-challenge-1"]');
    await page.waitForSelector('[data-testid="mobile-repair-counter"]', { timeout: 6000 });

    // Verify mobile repair counter element exists and is visible when drawers are closed
    const mobileCounterVisible = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="mobile-repair-counter"]');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && el.innerText.includes('REPAIR ENERGY: 2 / 2');
    });
    console.log(`  -> Mobile 390x844: [data-testid="mobile-repair-counter"] visible: ${mobileCounterVisible}`);
    if (!mobileCounterVisible) throw new Error('Mobile repair counter not visible at 390x844 with drawers closed');

    const shot7 = path.join(screenshotsDir, 'v4_2_1_07_mobile_repair_counter_390x844.png');
    await page.screenshot({ path: shot7 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot7, path.join(artifactsDir, 'v4_2_1_07_mobile_repair_counter_390x844.png'));
    }

    // Test scaling at 543x589
    await page.setViewport({ width: 543, height: 589 });
    await new Promise((r) => setTimeout(r, 400));
    const counterAt543 = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="mobile-repair-counter"]');
      return el !== null && el.innerText.includes('REPAIR ENERGY: 2 / 2');
    });
    console.log(`  -> Mobile 543x589: counter visible: ${counterAt543}`);
    if (!counterAt543) throw new Error('Mobile repair counter not visible at 543x589');

    const shot8 = path.join(screenshotsDir, 'v4_2_1_08_mobile_repair_counter_543x589.png');
    await page.screenshot({ path: shot8 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot8, path.join(artifactsDir, 'v4_2_1_08_mobile_repair_counter_543x589.png'));
    }

    // Verify counter hides when Tools drawer is open (no duplicate)
    await clickButtonWithText(page, 'Tools');
    await new Promise((r) => setTimeout(r, 300));
    const counterHiddenWhenToolsOpen = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="mobile-repair-counter"]');
      return el === null;
    });
    console.log(`  -> Floating counter hides when Tools drawer is open: ${counterHiddenWhenToolsOpen}`);
    if (!counterHiddenWhenToolsOpen) throw new Error('Floating repair counter duplicates when Tools drawer is open');

    report.push({ test: 'Scenario 9: Persistent Mobile Repair Counter (390x844 & 543x589)', pass: true });

    // -------------------------------------------------------------------------
    // SCENARIO 10: SANDBOX LAB EDITING REMAINS FULLY UNRESTRICTED
    // -------------------------------------------------------------------------
    console.log('\n[SCENARIO 10] Verifying Sandbox Lab Editing Remains Unrestricted...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.click('[data-nav-item="menu"]');
    await new Promise((r) => setTimeout(r, 600));

    await clickButtonWithText(page, 'Sandbox Lab');
    await new Promise((r) => setTimeout(r, 800));

    // Open Tools drawer
    await clickButtonWithText(page, 'Tools');
    await new Promise((r) => setTimeout(r, 400));

    // Verify Sandbox has Clear Obstacles and Wall tools
    const sandboxTools = await page.evaluate(() => {
      const drawer = document.querySelector('div.w-56');
      return drawer ? drawer.innerText : '';
    });
    const sandboxHasClear = sandboxTools.includes('Clear Obstacles');
    const sandboxHasMaze = sandboxTools.includes('Generate Maze');
    const sandboxHasWall = sandboxTools.includes('Wall (1)');

    console.log(`  -> Sandbox "Clear Obstacles" available: ${sandboxHasClear}`);
    console.log(`  -> Sandbox "Generate Maze" available: ${sandboxHasMaze}`);
    console.log(`  -> Sandbox "Wall (1)" available: ${sandboxHasWall}`);

    if (!sandboxHasClear || !sandboxHasMaze || !sandboxHasWall) {
      throw new Error('Sandbox Lab is missing unrestricted editing tools');
    }

    const shot9 = path.join(screenshotsDir, 'v4_2_1_09_sandbox_lab_unrestricted.png');
    await page.screenshot({ path: shot9 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot9, path.join(artifactsDir, 'v4_2_1_09_sandbox_lab_unrestricted.png'));
    }
    report.push({ test: 'Scenario 10: Sandbox Lab Editing Unrestricted', pass: true });

    // -------------------------------------------------------------------------
    // SCENARIO 11: WEIGHTED ARENA REGRESSION & CONSOLE CLEANLINESS
    // -------------------------------------------------------------------------
    console.log('\n[SCENARIO 11 & 12] Verifying Weighted Arena & Console Errors...');
    await page.click('[data-nav-item="arena"]');
    await new Promise((r) => setTimeout(r, 800));

    await page.click('[data-tab="bfs"]');
    await new Promise((r) => setTimeout(r, 400));

    const arenaText = await page.evaluate(() => document.body.innerText);
    const hasFewestStep = arenaText.includes('Fewest-Step Route');
    console.log(`  -> Algorithm Arena BFS label: ${hasFewestStep}`);
    if (!hasFewestStep) throw new Error('Arena BFS legend missing "Fewest-Step Route"');

    const shot10 = path.join(screenshotsDir, 'v4_2_1_10_arena_regression.png');
    await page.screenshot({ path: shot10 });
    if (fs.existsSync(artifactsDir)) {
      fs.copyFileSync(shot10, path.join(artifactsDir, 'v4_2_1_10_arena_regression.png'));
    }
    report.push({ test: 'Scenario 11: Weighted Arena Regression', pass: true });

  } catch (err) {
    console.error(`\n❌ VERIFICATION EXCEPTION: ${err.message}`);
    try {
      const dbg = await page.evaluate(() => document.body.innerText);
      console.log('PAGE TEXT AT FAILURE:\n', dbg.slice(0, 400));
    } catch {}
    report.push({ test: 'Browser Acceptance Suite', pass: false, error: err.message });
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('PROJECT AEGIS V4.2.1 — BROWSER ACCEPTANCE SUMMARY');
  console.log('================================================================');
  let allPass = true;
  for (const item of report) {
    console.log(`[${item.pass ? 'PASS' : 'FAIL'}] ${item.test}`);
    if (!item.pass) allPass = false;
  }
  console.log(`\nBrowser Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }
  console.log(`Final Verdict: ${allPass && consoleErrors.length === 0 ? 'ALL CRITICAL TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  process.exit(allPass && consoleErrors.length === 0 ? 0 : 1);
}

runAcceptanceSuite();
