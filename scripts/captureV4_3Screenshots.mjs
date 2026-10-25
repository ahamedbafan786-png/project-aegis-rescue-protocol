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

async function captureScreenshots() {
  const screenshotsDir = path.resolve('screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const targetUrl = process.env.TEST_URL || 'http://localhost:5173/';
  console.log('================================================================');
  console.log('PROJECT AEGIS V4.3 — SCREENSHOT CAPTURE SUITE');
  console.log(`Target: ${targetUrl}`);
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Main Menu with animated hero Aegis-1 diorama
    console.log('[1/11] Capturing Main Menu...');
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_01_main_menu.png') });
    console.log('  -> Saved v4_3_01_main_menu.png');

    // 2. Mission Select Deck
    console.log('[2/11] Capturing Mission Select Deck...');
    await clickButtonWithText(page, 'Start Rescue');
    await page.waitForSelector('[data-mission-card="mission-1"]', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_02_mission_select.png') });
    console.log('  -> Saved v4_3_02_mission_select.png');

    // 3. Sector 01: Neon Training Grounds
    console.log('[3/11] Capturing Sector 01: Neon Training Grounds...');
    await page.click('[data-mission-card="mission-1"]');
    await page.waitForSelector('canvas', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_03_neon_training_grounds.png') });
    console.log('  -> Saved v4_3_03_neon_training_grounds.png');

    // Deploy robot on Mission 1 to capture transit & rescue
    console.log('[4/11] Capturing Robot in Transit...');
    await clickButtonWithText(page, 'Deploy Robot');
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_07_robot_in_transit.png') });
    console.log('  -> Saved v4_3_07_robot_in_transit.png');

    // Wait for rescue sequence
    console.log('[5/11] Capturing Cinematic Rescue Docking...');
    let rescueSeen = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const hasRescue = await page.evaluate(() => {
        return document.body.innerText.includes('RESCUE PROTOCOL ENGAGED') ||
          document.body.innerText.includes('SURVIVOR CONTACT') ||
          document.body.innerText.includes('VITALS OPTIMAL');
      });
      if (hasRescue) {
        rescueSeen = true;
        await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_08_cinematic_rescue_docking.png') });
        console.log('  -> Saved v4_3_08_cinematic_rescue_docking.png');
        break;
      }
    }
    if (!rescueSeen) {
      await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_08_cinematic_rescue_docking.png') });
      console.log('  -> Fallback capture v4_3_08_cinematic_rescue_docking.png');
    }

    // Wait for results modal
    console.log('[6/11] Capturing Mission Results Modal...');
    await page.waitForSelector('[data-results-stars]', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_09_mission_results_modal.png') });
    console.log('  -> Saved v4_3_09_mission_results_modal.png');

    // Return to Mission Select
    await page.click('[data-action="exit-to-missions"]');
    await page.waitForSelector('[data-mission-card="mission-2"]', { timeout: 6000 });

    // 4. Sector 02: Collapsed Research Facility
    console.log('[7/11] Capturing Sector 02: Collapsed Research Facility...');
    await page.click('[data-mission-card="mission-2"]');
    await page.waitForSelector('canvas', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_04_collapsed_facility.png') });
    console.log('  -> Saved v4_3_04_collapsed_facility.png');

    // Return to Mission Select
    await page.evaluate(() => {
      const btn = document.querySelector('[data-nav-item="missions"]');
      if (btn) btn.click();
    });
    await page.waitForSelector('[data-mission-card="mission-3"]', { timeout: 6000 });

    // 5. Sector 03: Crystal Canyon
    console.log('[8/11] Capturing Sector 03: Crystal Canyon...');
    await page.click('[data-mission-card="mission-3"]');
    await page.waitForSelector('canvas', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_05_crystal_canyon.png') });
    console.log('  -> Saved v4_3_05_crystal_canyon.png');

    // Return to Mission Select
    await page.evaluate(() => {
      const btn = document.querySelector('[data-nav-item="missions"]');
      if (btn) btn.click();
    });
    await page.waitForSelector('[data-mission-card="mission-4"]', { timeout: 6000 });

    // 6. Sector 04: Maze Protocol
    console.log('[9/11] Capturing Sector 04: Maze Protocol...');
    await page.click('[data-mission-card="mission-4"]');
    await page.waitForSelector('canvas', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_06_maze_protocol.png') });
    console.log('  -> Saved v4_3_06_maze_protocol.png');

    // 7. Mobile Viewport 390x844
    console.log('[10/11] Capturing Mobile Viewport (390x844)...');
    await page.setViewport({ width: 390, height: 844 });
    await page.evaluate(() => {
      const btn = document.querySelector('[data-nav-item="missions"]');
      if (btn) btn.click();
    });
    await page.waitForSelector('[data-mission-card="mission-challenge-1"]', { timeout: 6000 });
    await page.click('[data-mission-card="mission-challenge-1"]');
    await page.waitForSelector('[data-testid="mobile-repair-counter"]', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_10_mobile_390x844.png') });
    console.log('  -> Saved v4_3_10_mobile_390x844.png');

    // 8. Mobile Viewport 320x844
    console.log('[11/11] Capturing Narrow Mobile Viewport (320x844)...');
    await page.setViewport({ width: 320, height: 844 });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_11_mobile_320x844.png') });
    console.log('  -> Saved v4_3_11_mobile_320x844.png');

    console.log('\n================================================================');
    console.log('ALL V4.3 SCREENSHOTS CAPTURED SUCCESSFULLY ✅');
    console.log('================================================================');
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
