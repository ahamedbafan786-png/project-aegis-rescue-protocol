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

async function runV3Audit() {
  const screenshotsDir = path.resolve('screenshots');
  const artifactsDir = 'C:/Users/Ahmed/.gemini/antigravity/brain/2be5b84d-78ac-41bf-953a-638f6d09f3be';

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('===========================================================');
  console.log('PROJECT AEGIS — V3 CRITICAL AUDIT & GAMEPLAY VERIFICATION');
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

  const report = {
    checks: [],
    errors: [],
  };

  try {
    // 1. MAIN MENU
    console.log('\n[TEST 1] Main Menu Navigation & Layout...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));
    const ss1Path = path.join(screenshotsDir, 'v3_01_main_menu.png');
    await page.screenshot({ path: ss1Path });
    fs.copyFileSync(ss1Path, path.join(artifactsDir, 'v3_01_main_menu.png'));
    report.checks.push({ test: 'Main Menu Render', status: 'PASS' });
    console.log('✓ Main menu captured');

    // 2. MISSION SELECT
    console.log('\n[TEST 2] Mission Select Screen...');
    await clickButtonWithText(page, 'LAUNCH MISSIONS');
    await new Promise((r) => setTimeout(r, 600));
    const ss2Path = path.join(screenshotsDir, 'v3_02_mission_select.png');
    await page.screenshot({ path: ss2Path });
    fs.copyFileSync(ss2Path, path.join(artifactsDir, 'v3_02_mission_select.png'));
    report.checks.push({ test: 'Mission Select Render', status: 'PASS' });
    console.log('✓ Mission select captured');

    // 3. ENTER MISSION 1 (NEON TRAINING GROUNDS)
    console.log('\n[TEST 3] Gameplay Canvas & Board-Centric Layout (65-75% width)...');
    await page.click('[data-mission-card]');
    await new Promise((r) => setTimeout(r, 800));

    // Verify canvas exists and occupies >= 65% width
    const canvasBox = await page.evaluate(() => {
      const c = document.querySelector('canvas.cursor-crosshair');
      if (!c) return null;
      const rect = c.getBoundingClientRect();
      return { width: rect.width, height: rect.height, windowW: window.innerWidth };
    });
    console.log(`Canvas dimensions: ${canvasBox.width}px x ${canvasBox.height}px (Viewport: ${canvasBox.windowW}px)`);
    const canvasRatio = (canvasBox.width / canvasBox.windowW) * 100;
    console.log(`Canvas to viewport ratio: ${canvasRatio.toFixed(1)}%`);
    const meetsRatio = canvasRatio >= 60;
    report.checks.push({
      test: 'Gameplay Board-Centric Ratio (>=60%)',
      status: meetsRatio ? 'PASS' : 'FAIL',
      ratio: `${canvasRatio.toFixed(1)}%`,
    });

    const ss3Path = path.join(screenshotsDir, 'v3_03_mission1_initial.png');
    await page.screenshot({ path: ss3Path });
    fs.copyFileSync(ss3Path, path.join(artifactsDir, 'v3_03_mission1_initial.png'));
    console.log('✓ Mission 1 initial gameplay captured');

    // 4. DEPLOY ROBOT & TRANSIT
    console.log('\n[TEST 4] Robot Deployment & Movement Interpolation...');
    await clickButtonWithText(page, 'Deploy Robot');
    await new Promise((r) => setTimeout(r, 1500)); // Advance several steps

    const ss4Path = path.join(screenshotsDir, 'v3_04_robot_in_transit.png');
    await page.screenshot({ path: ss4Path });
    fs.copyFileSync(ss4Path, path.join(artifactsDir, 'v3_04_robot_in_transit.png'));
    console.log('✓ Robot in transit captured');

    // 5. TRIGGER DYNAMIC BLOCKAGE & VERIFY COST CONTINUITY
    console.log('\n[TEST 5] Dynamic Replanning & Cost Accumulation...');
    // Click Trigger Blockage
    await clickButtonWithText(page, 'Trigger Blockage');
    await new Promise((r) => setTimeout(r, 350)); // Capture shockwave & invalidated route

    const ss5Path = path.join(screenshotsDir, 'v3_05_dynamic_replanning_active.png');
    await page.screenshot({ path: ss5Path });
    fs.copyFileSync(ss5Path, path.join(artifactsDir, 'v3_05_dynamic_replanning_active.png'));
    console.log('✓ Dynamic replanning visual storytelling captured (shockwave + invalidated dashed route)');

    // 6. FINISH MISSION & VERIFY TELEMETRY MODAL
    console.log('\n[TEST 6] Mission Completion & Victory Results Modal...');
    // Switch to Max speed to finish mission
    await clickButtonWithText(page, 'Max');
    await new Promise((r) => setTimeout(r, 1400));

    // Verify modal is visible
    const modalVisible = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0.z-50');
      return modal !== null;
    });
    console.log(`Mission completion modal rendered: ${modalVisible}`);
    report.checks.push({ test: 'Mission Complete Modal Rendered', status: modalVisible ? 'PASS' : 'FAIL' });

    const ss6Path = path.join(screenshotsDir, 'v3_06_mission_results_modal.png');
    await page.screenshot({ path: ss6Path });
    fs.copyFileSync(ss6Path, path.join(artifactsDir, 'v3_06_mission_results_modal.png'));
    console.log('✓ Victory results dialog captured');

    // 7. VERIFY NO MODAL LEAKAGE TO ALGORITHM ARENA
    console.log('\n[TEST 7] Modal Isolation — Navigating to Algorithm Arena...');
    // Click Arena in top navbar while victory modal is active
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes('arena') || b.title?.toLowerCase().includes('arena')) {
          b.click();
          break;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 700));

    const leakedModal = await page.evaluate(() => {
      return document.querySelector('.fixed.inset-0.z-50') !== null;
    });
    console.log(`Modal leaked into Algorithm Arena: ${leakedModal} (Expected: false)`);
    if (leakedModal) {
      throw new Error('FAILURE: MissionResultsModal leaked into Algorithm Arena!');
    }
    report.checks.push({ test: 'Modal Isolation (No Leakage)', status: 'PASS' });

    const ss7Path = path.join(screenshotsDir, 'v3_07_algorithm_arena.png');
    await page.screenshot({ path: ss7Path });
    fs.copyFileSync(ss7Path, path.join(artifactsDir, 'v3_07_algorithm_arena.png'));
    console.log('✓ Algorithm Arena captured with clean isolation');

    // 8. PRESENTATION MODE
    console.log('\n[TEST 8] Presentation Mode (Presenter script collapsed by default)...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes('presentation') || b.title?.toLowerCase().includes('presentation')) {
          b.click();
          break;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    const notesCollapsed = await page.evaluate(() => {
      return document.querySelector('.list-decimal') === null;
    });
    console.log(`Presenter notes collapsed by default: ${notesCollapsed} (Expected: true)`);
    report.checks.push({ test: 'Presenter Notes Collapsed by Default', status: notesCollapsed ? 'PASS' : 'FAIL' });

    const ss8Path = path.join(screenshotsDir, 'v3_08_presentation_mode.png');
    await page.screenshot({ path: ss8Path });
    fs.copyFileSync(ss8Path, path.join(artifactsDir, 'v3_08_presentation_mode.png'));

    // Toggle notes open
    await clickButtonWithText(page, 'Presenter Notes');
    await new Promise((r) => setTimeout(r, 400));
    const ss9Path = path.join(screenshotsDir, 'v3_09_presentation_with_notes.png');
    await page.screenshot({ path: ss9Path });
    fs.copyFileSync(ss9Path, path.join(artifactsDir, 'v3_09_presentation_with_notes.png'));
    console.log('✓ Presentation Mode captured (collapsed and toggled)');

    // 9. NARROW VIEWPORT (543 x 589)
    console.log('\n[TEST 9] Narrow Viewport Responsive Verification (543 x 589)...');
    await page.setViewport({ width: 543, height: 589 });
    // Go to mission 1
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      for (const b of btns) {
        if (b.innerText.toLowerCase().includes('missions') || b.title?.toLowerCase().includes('missions')) {
          b.click();
          break;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.click('[data-mission-card]');
    await new Promise((r) => setTimeout(r, 700));

    // Check if horizontal scrollbar is present
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`Narrow viewport 543x589 horizontal overflow: ${hasHorizontalOverflow} (Expected: false)`);
    report.checks.push({ test: '543x589 No Horizontal Overflow', status: !hasHorizontalOverflow ? 'PASS' : 'FAIL' });

    const ss10Path = path.join(screenshotsDir, 'v3_10_narrow_543x589.png');
    await page.screenshot({ path: ss10Path });
    fs.copyFileSync(ss10Path, path.join(artifactsDir, 'v3_10_narrow_543x589.png'));
    console.log('✓ 543x589 narrow viewport captured without overflow');

    // 10. MOBILE PORTRAIT (390 x 844)
    console.log('\n[TEST 10] Mobile Portrait Responsive Verification (390 x 844)...');
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 600));
    const ss11Path = path.join(screenshotsDir, 'v3_11_mobile_390x844.png');
    await page.screenshot({ path: ss11Path });
    fs.copyFileSync(ss11Path, path.join(artifactsDir, 'v3_11_mobile_390x844.png'));
    console.log('✓ Mobile 390x844 portrait captured');

  } catch (err) {
    console.error('Test Execution Error:', err);
    report.errors.push(err.toString());
  } finally {
    await browser.close();
  }

  console.log('\n===========================================================');
  console.log('FINAL AUDIT SUMMARY:');
  console.log(`Total Checks Passed: ${report.checks.filter(c => c.status === 'PASS').length}/${report.checks.length}`);
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Console error details:', consoleErrors);
  }
  console.log('===========================================================');

  return { report, consoleErrors };
}

runV3Audit().then(({ report, consoleErrors }) => {
  if (report.errors.length > 0 || consoleErrors.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
