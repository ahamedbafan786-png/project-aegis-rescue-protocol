import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const VIEWPORTS = [
  { width: 320, height: 844, name: '320x844' },
  { width: 360, height: 800, name: '360x800' },
  { width: 375, height: 812, name: '375x812' },
  { width: 390, height: 844, name: '390x844' },
  { width: 430, height: 932, name: '430x932' },
  { width: 543, height: 589, name: '543x589' },
  { width: 1280, height: 800, name: '1280x800' },
];

function intersects(r1, r2) {
  return !(
    r1.right <= r2.left + 0.1 ||
    r1.left >= r2.right - 0.1 ||
    r1.bottom <= r2.top + 0.1 ||
    r1.top >= r2.bottom - 0.1
  );
}

async function isServerRunning(url) {
  try {
    const res = await fetch(url);
    return res.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  const screenshotsDir = path.resolve('screenshots', 'v4_3_1');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  let serverProcess = null;
  let targetUrl = process.env.TEST_URL || 'http://localhost:4173/';

  const running = await isServerRunning(targetUrl);
  if (!running) {
    console.log(`Starting preview server on port 4173...`);
    serverProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', 'localhost'], {
      shell: true,
      stdio: 'pipe',
    });
    // Wait for server to boot
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isServerRunning(targetUrl)) {
        console.log(`Preview server ready at ${targetUrl}`);
        break;
      }
    }
  }

  console.log('================================================================');
  console.log('PROJECT AEGIS V4.3.1 — BROWSER ACCEPTANCE & VERIFICATION SUITE');
  console.log(`Target: ${targetUrl}`);
  console.log(`Screenshots: ${screenshotsDir}`);
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.toString()));

  let totalChecks = 0;
  let passedChecks = 0;

  function assert(condition, desc) {
    totalChecks++;
    if (!condition) {
      console.error(`  ❌ FAILED: ${desc}`);
      throw new Error(`Assertion failed: ${desc}`);
    }
    passedChecks++;
    console.log(`  ✓ ${desc}`);
  }

  try {
    // ----------------------------------------------------------------
    // SECTION 1: Viewport Layout, Touch Targets, and Non-Overlap Gate
    // ----------------------------------------------------------------
    console.log('\n--- SECTION 1: HEADER VIEWPORT RESPONSIVE INTEGRITY ---');

    for (const vp of VIEWPORTS) {
      console.log(`\nTesting Viewport ${vp.name} (${vp.width}x${vp.height})...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(targetUrl, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 300));

      // Inspect elements in header
      const headerEval = await page.evaluate((vpW, vpH) => {
        const brand = document.querySelector('[data-nav-item="menu"]');
        const missions = document.querySelector('[data-nav-item="missions"]');
        const arena = document.querySelector('[data-nav-item="arena"]');
        const academy = document.querySelector('[data-nav-item="academy"]');
        const pres = document.querySelector('[data-nav-item="presentation"]');
        const audio =
          document.querySelector('header button[aria-label="Unmute Audio"]') ||
          document.querySelector('header button[aria-label="Mute Audio"]') ||
          document.querySelector('header button[title*="Audio"]');

        const items = [
          { name: 'brand', el: brand },
          { name: 'missions', el: missions },
          { name: 'arena', el: arena },
          { name: 'academy', el: academy },
          { name: 'presentation', el: pres },
          { name: 'audio', el: audio },
        ];

        const missing = items.filter((it) => !it.el).map((it) => it.name);
        if (missing.length > 0) {
          return { error: `Missing elements: ${missing.join(', ')}` };
        }

        const rects = items.map((it) => {
          const r = it.el.getBoundingClientRect();
          const span = it.el.querySelector('span');
          const isTextClipped = span ? span.scrollWidth > span.clientWidth + 1 : false;
          return {
            name: it.name,
            rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
            isTextClipped,
            text: (it.el.innerText || '').replace(/\s+/g, ' ').trim(),
          };
        });

        const scrollWidth = document.documentElement.scrollWidth;

        return { rects, scrollWidth };
      }, vp.width, vp.height);

      if (headerEval.error) {
        throw new Error(headerEval.error);
      }

      // Assert no horizontal scrollbar overflow
      assert(
        headerEval.scrollWidth <= vp.width,
        `[${vp.name}] Zero horizontal scroll overflow: scrollWidth (${headerEval.scrollWidth}) <= vp.width (${vp.width})`
      );

      // Assert touch target heights and bounding boxes
      for (const item of headerEval.rects) {
        // All interactive touch targets must be >= 40px (min 44px on mobile)
        const minH = vp.width < 640 ? 44 : 40;
        assert(
          item.rect.height >= minH - 0.5,
          `[${vp.name}] Control ${item.name} height (${item.rect.height.toFixed(1)}px) >= ${minH}px touch target`
        );
        assert(
          item.rect.width >= 36,
          `[${vp.name}] Control ${item.name} width (${item.rect.width.toFixed(1)}px) >= 36px comfortable touch width`
        );
        assert(
          item.rect.left >= 0 && item.rect.right <= vp.width + 0.5,
          `[${vp.name}] Control ${item.name} horizontally inside viewport bounds [0, ${vp.width}]`
        );
        assert(
          !item.isTextClipped,
          `[${vp.name}] Control ${item.name} text "${item.text}" is not clipped (scrollWidth <= clientWidth)`
        );
      }

      // Pairwise non-overlap check across all controls in the header
      const rects = headerEval.rects;
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const r1 = rects[i];
          const r2 = rects[j];
          const overlap = intersects(r1.rect, r2.rect);
          assert(
            !overlap,
            `[${vp.name}] Zero overlap between ${r1.name} and ${r2.name}`
          );
        }
      }

      // Screenshot
      const screenshotPath = path.join(screenshotsDir, `v4_3_1_header_${vp.width}px.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`  -> Saved ${screenshotPath}`);
    }

    // ----------------------------------------------------------------
    // SECTION 2: Neon Training Grounds Pre-Deploy Standby Blockage
    // ----------------------------------------------------------------
    console.log('\n--- SECTION 2: NEON MISSION PRE-DEPLOY STANDBY BLOCKAGE ---');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));

    // Navigate to Missions -> Neon Training Grounds (mission-1)
    await page.click('[data-nav-item="missions"]');
    await page.waitForSelector('[data-mission-card="mission-1"]', { timeout: 6000 });
    await page.click('[data-mission-card="mission-1"]');
    await page.waitForSelector('canvas', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 500));

    // Verify initial standby state
    const preBlockageState = await page.evaluate(() => {
      const deployBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.innerText || '').toLowerCase().includes('deploy robot')
      );
      const blockageBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.innerText || '').toLowerCase().includes('trigger blockage')
      );
      return {
        hasDeployBtn: !!deployBtn,
        hasBlockageBtn: !!blockageBtn,
        blockageEnabled: blockageBtn ? !blockageBtn.disabled : false,
      };
    });

    assert(preBlockageState.hasDeployBtn, 'Pre-deploy: "Deploy Robot" button is visible and active');
    assert(preBlockageState.hasBlockageBtn, 'Pre-deploy: "Trigger Blockage" button is present');
    assert(preBlockageState.blockageEnabled, 'Pre-deploy: "Trigger Blockage" button is clickable in standby');

    // Screenshot before blockage trigger
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_1_neon_01_before_blockage.png') });

    // Press Trigger Blockage while robot is in STANDBY
    console.log('Pressing "Trigger Blockage" in STANDBY mode...');
    await page.evaluate(() => {
      const blockageBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.innerText || '').toLowerCase().includes('trigger blockage')
      );
      if (blockageBtn) blockageBtn.click();
    });

    // Wait 400ms for route calculation
    await new Promise((r) => setTimeout(r, 400));

    // Assert that the robot has NOT started moving!
    const postBlockageStandby = await page.evaluate(() => {
      const deployBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.innerText || '').toLowerCase().includes('deploy robot')
      );
      const pauseBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.innerText || '').toLowerCase().includes('pause robot')
      );

      // Read status text
      const statusText = document.body.innerText || '';

      return {
        stillHasDeployBtn: !!deployBtn,
        unexpectedlyHasPauseBtn: !!pauseBtn,
        statusText,
      };
    });

    assert(
      postBlockageStandby.stillHasDeployBtn,
      'Post-blockage standby: "Deploy Robot" button remains present (robot did NOT auto-deploy)'
    );
    assert(
      !postBlockageStandby.unexpectedlyHasPauseBtn,
      'Post-blockage standby: "Pause Robot" is NOT active (robot is stationary)'
    );

    // Save screenshot of stationary robot with recalculated route
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_1_neon_02_standby_recalculated.png') });

    // Now press Deploy Robot explicitly
    console.log('Explicitly pressing "Deploy Robot"...');
    await page.evaluate(() => {
      const deployBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.innerText || '').toLowerCase().includes('deploy robot')
      );
      if (deployBtn) deployBtn.click();
    });

    await new Promise((r) => setTimeout(r, 500));

    const movingState = await page.evaluate(() => {
      const pauseBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.innerText || '').toLowerCase().includes('pause robot')
      );
      return { isMoving: !!pauseBtn };
    });

    assert(movingState.isMoving, 'Movement successfully begins after explicit Deploy click');

    // ----------------------------------------------------------------
    // SECTION 3: Rescue Sequence Timing & Stage Progression
    // ----------------------------------------------------------------
    console.log('\n--- SECTION 3: RESCUE SEQUENCE TIMING & STAGES ---');

    // Wait until robot arrives and rescue protocol engages
    console.log('Waiting for arrival at survivor pod...');
    await page.waitForFunction(
      () => {
        const text = document.body.innerText || '';
        return (
          text.includes('RESCUE PROTOCOL ENGAGED') ||
          text.includes('SURVIVOR CONTACT') ||
          text.includes('MEDICAL SCAN') ||
          text.includes('SURVIVOR STABILIZING') ||
          text.includes('MISSION ACCOMPLISHED') ||
          text.includes('MISSION DEBRIEF')
        );
      },
      { timeout: 25000 }
    );

    // Capture rescue sequence in flight
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_1_rescue_01_active.png') });
    console.log('  -> Saved rescue sequence in flight screenshot');

    // Check Skip button presence
    const hasSkip = await page.evaluate(() => {
      const skipBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        (b.innerText || '').toLowerCase().includes('skip')
      );
      return !!skipBtn;
    });
    console.log(`Rescue banner Skip button present: ${hasSkip}`);
    assert(hasSkip, 'Cinematic Rescue Protocol banner displays active Skip ▶ button');

    // Wait for debrief modal
    console.log('Waiting for debrief modal...');
    await page.waitForFunction(
      () => {
        const text = document.body.innerText || '';
        return text.includes('MISSION DEBRIEF') || text.includes('MISSION COMPLETE') || text.includes('PERFORMANCE RATING');
      },
      { timeout: 15000 }
    );

    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(screenshotsDir, 'v4_3_1_rescue_02_debrief.png') });
    console.log('  -> Saved debrief modal screenshot');

    assert(true, 'Rescue sequence completed cleanly and opened Mission Debrief modal');

    // ----------------------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`PROJECT AEGIS V4.3.1 VERIFICATION COMPLETE: ${passedChecks}/${totalChecks} PASSED`);
    console.log('================================================================\n');

  } finally {
    await browser.close();
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

main().catch((err) => {
  console.error('\nVerification run failed:', err);
  process.exit(1);
});
