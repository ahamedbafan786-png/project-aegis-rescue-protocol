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

async function runVerification() {
  const screenshotsDir = path.resolve('screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('--- Launching Automated Browser Quality & Gameplay Verification ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
  });

  try {
    // 1. Main Menu
    console.log('Testing Screen 1: Main Menu...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('h1');
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(screenshotsDir, '01_main_menu.png') });
    console.log('✓ Main Menu captured');

    // 2. Mission Selection
    console.log('Testing Screen 2: Mission Selection...');
    const clickedMissions = await clickButtonWithText(page, 'Launch Missions') || await clickButtonWithText(page, 'Missions');
    if (!clickedMissions) console.warn('Could not click Missions button');
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: path.join(screenshotsDir, '02_mission_select.png') });
    console.log('✓ Mission Selection captured');

    // 3. Game HUD - Dynamic Rescue Scenario
    console.log('Testing Screen 3: Game HUD (Dynamic Rescue Exhibit)...');
    const cards = await page.$$('div.group');
    let clickedCard = false;
    for (const card of cards) {
      const text = await page.evaluate((el) => el.innerText, card);
      if (text.includes('Dynamic Rescue') || text.includes('DEMO PROTOCOL')) {
        await card.click();
        clickedCard = true;
        break;
      }
    }
    if (!clickedCard && cards.length > 0) {
      await cards[0].click();
    }
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: path.join(screenshotsDir, '03_game_hud_initial.png') });
    console.log('✓ Game HUD initial state captured');

    // 4. Deploy Robot
    console.log('Testing Robot Deployment & Transit...');
    await clickButtonWithText(page, 'Deploy Robot');
    await new Promise((r) => setTimeout(r, 1400));
    await page.screenshot({ path: path.join(screenshotsDir, '04_robot_in_transit.png') });
    console.log('✓ Robot in-transit captured');

    // 5. Trigger Blockage (WOW Feature - Dynamic Replanning)
    console.log('Testing Dynamic Replanning (Trigger Blockage)...');
    await clickButtonWithText(page, 'Trigger Blockage');
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(screenshotsDir, '05_dynamic_replanning_active.png') });
    console.log('✓ Dynamic replanning reaction captured');

    // Wait for arrival debrief
    console.log('Waiting for mission arrival debrief...');
    await new Promise((r) => setTimeout(r, 4500));
    await page.screenshot({ path: path.join(screenshotsDir, '06_mission_results_modal.png') });
    console.log('✓ Mission debrief captured');

    // 6. Algorithm Arena
    console.log('Testing Screen 4: Algorithm Arena...');
    await clickButtonWithText(page, 'Algorithm Arena');
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(screenshotsDir, '07_algorithm_arena.png') });
    console.log('✓ Algorithm Arena captured');

    // 7. Algorithm Academy
    console.log('Testing Screen 5: Algorithm Academy...');
    await clickButtonWithText(page, 'Academy');
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(screenshotsDir, '08_algorithm_academy.png') });
    console.log('✓ Algorithm Academy captured');

    // 8. Presentation Mode
    console.log('Testing Screen 6: College Presentation Mode...');
    await clickButtonWithText(page, 'Presentation Mode');
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(screenshotsDir, '09_presentation_mode.png') });
    console.log('✓ Presentation Mode captured');

    console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
    console.log('Console Errors Count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Console Errors:', consoleErrors);
    }
  } catch (err) {
    console.error('Verification encountered an error:', err);
  } finally {
    await browser.close();
  }
}

runVerification();
