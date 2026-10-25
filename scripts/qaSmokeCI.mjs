/**
 * PROJECT AEGIS — CI BROWSER SMOKE TEST
 * Executes live browser assertions against a local preview or staging server.
 * Validates document metadata, OpenGraph tags, dynamic A* replanning telemetry,
 * mobile HUD bounding-box non-overlap, Algorithm Arena metrics, unreachable goals,
 * and zero console errors.
 */

import puppeteer from 'puppeteer';
import {
  assertExactInt,
  assertFloatClose,
  assertNonOverlap,
  assertInViewportBounds,
  assertDimensionsPositive,
  runNegativeAssertionSelfTests,
} from './qaAssertionUtils.mjs';

const targetUrl = process.argv[2] || process.env.TEST_URL || 'http://127.0.0.1:4173/';

async function clickButtonWithText(page, text) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const content = await page.evaluate((el) => el.innerText || el.textContent || '', btn);
    if (content.toLowerCase().includes(text.toLowerCase())) {
      await btn.click();
      return true;
    }
  }
  return false;
}

async function runSmokeTest() {
  console.log('================================================================');
  console.log('PROJECT AEGIS — CI BROWSER SMOKE TEST');
  console.log(`Target: ${targetUrl}`);
  console.log('================================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

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
    // 1. Initial Page Load & Document Metadata
    console.log('[CHECK 1] Verifying Page Load, Title & OpenGraph Metadata...');
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    const metadata = await page.evaluate(() => {
      const title = document.title;
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      const twCard = document.querySelector('meta[name="twitter:card"]')?.getAttribute('content');
      return { title, ogTitle, ogDesc, ogImage, twCard };
    });

    console.log(`  -> Title: "${metadata.title}"`);
    console.log(`  -> OpenGraph Title: "${metadata.ogTitle}"`);
    console.log(`  -> OpenGraph Image: "${metadata.ogImage}"`);

    if (!metadata.title.includes('Project Aegis: Rescue Protocol')) {
      throw new Error(`Unexpected document title: "${metadata.title}"`);
    }
    if (!metadata.ogTitle || !metadata.ogDesc || !metadata.ogImage) {
      throw new Error('Missing essential OpenGraph metadata tags in <head>');
    }
    if (metadata.twCard !== 'summary_large_image') {
      throw new Error(`Unexpected twitter:card: "${metadata.twCard}"`);
    }

    // 2. Presentation Mode Auto-Hold & Dynamic Replanning Telemetry
    console.log('\n[CHECK 2] Verifying Presentation Mode Dynamic A* Replanning...');
    const presNav = await page.$('[data-nav-item="presentation"]');
    if (!presNav) throw new Error('Presentation mode navigation button missing');
    await presNav.click();
    await page.waitForSelector('[data-deploy-button]', { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 400));

    // Deploy robot with Auto-Hold ON
    await page.click('[data-deploy-button]');
    let autoHeld = false;
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const statusCheck = await page.evaluate(() => {
        const trigger = document.querySelector('[data-trigger-blockage]');
        const triggerDisabled = trigger ? trigger.disabled : true;
        const text = document.body.innerText;
        return {
          triggerDisabled,
          hasImminent: text.includes('COLLAPSE IMMINENT') || text.includes('EXHIBIT PAUSED'),
        };
      });

      if (!statusCheck.triggerDisabled || statusCheck.hasImminent) {
        autoHeld = true;
        console.log(`  -> Auto-Hold paused robot at iteration ${i}`);
        break;
      }
    }
    if (!autoHeld) throw new Error('Auto-Hold did not pause robot at step 2');

    // Trigger Collapse
    await page.click('[data-trigger-blockage]');

    // Wait for rescue complete
    let rescueDone = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const body = await page.evaluate(() => document.body.innerText);
      if (body.includes('RESCUE COMPLETE · DETOUR SUCCESSFUL')) {
        rescueDone = true;
        break;
      }
    }
    if (!rescueDone) throw new Error('Presentation detour did not reach RESCUE COMPLETE');

    // Scoped Telemetry Verification
    const presTele = await page.evaluate(() => {
      const stepsEl = document.querySelector('[data-telemetry="steps"]');
      const replansEl = document.querySelector('[data-telemetry="replans"]');
      const costEl = document.querySelector('[data-telemetry="total-cost"]');
      return {
        steps: stepsEl ? parseInt(stepsEl.innerText.trim(), 10) : NaN,
        replans: replansEl ? parseInt(replansEl.innerText.trim(), 10) : NaN,
        cost: costEl ? parseFloat(costEl.innerText.trim()) : NaN,
      };
    });

    console.log(`  -> Scoped Telemetry: steps=${presTele.steps}, replans=${presTele.replans}, cost=${presTele.cost}`);
    assertExactInt(presTele.steps, 20, 'Presentation Detour Steps');
    assertExactInt(presTele.replans, 1, 'Presentation Detour Replans');
    assertFloatClose(presTele.cost, 20.0, 0.01, 'Presentation Detour Cost');

    // 3. Challenge Mode Mobile HUD Bounding-Box Layout & Non-Overlap
    console.log('\n[CHECK 3] Verifying Challenge Mobile HUD Bounding-Box Layout (390x844 and 320x844)...');
    const smokeViewports = [
      { width: 390, height: 844 },
      { width: 320, height: 844 },
    ];

    await page.setViewport({ width: smokeViewports[0].width, height: smokeViewports[0].height });
    await page.click('[data-nav-item="missions"]');
    await page.waitForSelector('[data-mission-card="mission-challenge-1"]', { timeout: 6000 });
    await page.click('[data-mission-card="mission-challenge-1"]');
    await page.waitForSelector('[data-testid="mobile-repair-counter"]', { timeout: 6000 });

    for (const vp of smokeViewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 200));

      const hudData = await page.evaluate(() => {
        const counterEl = document.querySelector('[data-testid="mobile-repair-counter"]');
        const toolsBtn = document.querySelector('[aria-label="Open Tools Drawer"]');
        const telBtn = document.querySelector('[aria-label="Open Telemetry Drawer"]');

        if (!counterEl || !toolsBtn || !telBtn) {
          return { found: false };
        }

        const counterRect = counterEl.getBoundingClientRect();
        const toolsRect = toolsBtn.getBoundingClientRect();
        const telRect = telBtn.getBoundingClientRect();
        const style = window.getComputedStyle(counterEl);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        const text = (counterEl.innerText || counterEl.textContent || '').trim();

        return {
          found: true,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          isVisible,
          text,
          counterRect: {
            left: counterRect.left,
            right: counterRect.right,
            top: counterRect.top,
            bottom: counterRect.bottom,
            width: counterRect.width,
            height: counterRect.height,
          },
          toolsRect: {
            left: toolsRect.left,
            right: toolsRect.right,
            top: toolsRect.top,
            bottom: toolsRect.bottom,
            width: toolsRect.width,
            height: toolsRect.height,
          },
          telRect: {
            left: telRect.left,
            right: telRect.right,
            top: telRect.top,
            bottom: telRect.bottom,
            width: telRect.width,
            height: telRect.height,
          },
        };
      });

      if (!hudData.found) {
        throw new Error(`Mobile HUD elements missing at viewport ${vp.width}x${vp.height}`);
      }

      assertExactInt(hudData.innerWidth, vp.width, `Viewport Width (${vp.width}px)`);
      assertExactInt(hudData.innerHeight, vp.height, `Viewport Height (${vp.height}px)`);
      if (!hudData.isVisible) {
        throw new Error(`Mobile repair counter is not visible at ${vp.width}x${vp.height}`);
      }
      if (!hudData.text.includes('2/2')) {
        throw new Error(`Mobile repair counter text does not contain "2/2" (got: "${hudData.text}")`);
      }

      assertDimensionsPositive(hudData.counterRect, `Mobile Repair Counter (${vp.width}px)`);
      assertDimensionsPositive(hudData.toolsRect, `Tools Drawer Button (${vp.width}px)`);
      assertDimensionsPositive(hudData.telRect, `Telemetry Drawer Button (${vp.width}px)`);

      assertNonOverlap(hudData.counterRect, hudData.toolsRect, 'Repair Counter', 'Tools Button');
      assertNonOverlap(hudData.counterRect, hudData.telRect, 'Repair Counter', 'Telemetry Button');

      assertInViewportBounds(hudData.counterRect, vp.width, vp.height, 'Repair Counter');
      assertInViewportBounds(hudData.toolsRect, vp.width, vp.height, 'Tools Button');
      assertInViewportBounds(hudData.telRect, vp.width, vp.height, 'Telemetry Button');

      console.log(`  -> Viewport ${vp.width}x${vp.height}: Non-overlap verified, within bounds, text="${hudData.text}"`);
    }

    // 4. Algorithm Arena Scoped Metric Verification
    console.log('\n[CHECK 4] Verifying Algorithm Arena Scoped Metrics...');
    await page.setViewport({ width: 1280, height: 800 });
    await page.click('[data-nav-item="arena"]');
    await page.waitForSelector('[data-tab="bfs"]', { timeout: 6000 });

    await clickButtonWithText(page, 'weighted');
    await new Promise((r) => setTimeout(r, 400));

    const arenaMetrics = await page.evaluate(() => {
      const getCard = (tab) => {
        const card = document.querySelector(`[data-tab="${tab}"]`);
        if (!card) return { steps: NaN, cost: NaN };
        const stepsEl = card.querySelector('[data-metric="steps"]');
        const costEl = card.querySelector('[data-metric="cost"]');
        return {
          steps: stepsEl ? parseInt(stepsEl.innerText.trim(), 10) : NaN,
          cost: costEl ? parseFloat(costEl.innerText.trim()) : NaN,
        };
      };
      return {
        bfs: getCard('bfs'),
        astar: getCard('astar'),
        dijkstra: getCard('dijkstra'),
      };
    });

    console.log(`  -> Arena Scoped Metrics: BFS(cost=${arenaMetrics.bfs.cost}), A*(cost=${arenaMetrics.astar.cost}), Dijkstra(cost=${arenaMetrics.dijkstra.cost})`);
    assertFloatClose(arenaMetrics.bfs.cost, 30.0, 0.01, 'Weighted Arena BFS Cost');
    assertFloatClose(arenaMetrics.astar.cost, 22.0, 0.01, 'Weighted Arena A* Cost');
    assertFloatClose(arenaMetrics.dijkstra.cost, 22.0, 0.01, 'Weighted Arena Dijkstra Cost');

    // 5. Unreachable Target Authoritative Engine Verification
    console.log('\n[CHECK 5] Verifying Unreachable Goal Handling in Algorithm Core...');
    const unreachableRes = await page.evaluate(() => {
      const engine = window.__AEGIS_ENGINE__;
      if (!engine || typeof engine.findPathAStar !== 'function') {
        throw new Error('__AEGIS_ENGINE__ not available on window');
      }
      // Wall off goal at (2, 2) in 3x3 grid with uppercase 'WALL'
      const grid = [
        ['EMPTY', 'EMPTY', 'EMPTY'],
        ['EMPTY', 'EMPTY', 'WALL'],
        ['EMPTY', 'WALL',  'EMPTY'],
      ];
      const res = engine.findPathAStar({
        grid,
        rows: 3,
        cols: 3,
        start: { r: 0, c: 0 },
        goal: { r: 2, c: 2 },
        movementMode: '4-directional',
        heuristicType: 'manhattan',
      });
      return { found: res.found, pathLength: res.path.length };
    });

    console.log(`  -> Unreachable Goal: found=${unreachableRes.found}, pathLength=${unreachableRes.pathLength}`);
    if (unreachableRes.found !== false) {
      throw new Error(`Unreachable goal test failed: expected found=false, got ${unreachableRes.found}`);
    }
    assertExactInt(unreachableRes.pathLength, 0, 'Unreachable Goal Path Length');

    // 6. Negative Test Harness Check (ensure failures are genuinely caught)
    console.log('\n[CHECK 6] Verifying Negative Test Failure Detection in Harness...');
    const negativeTestCount = runNegativeAssertionSelfTests();
    console.log(`  -> Negative assertion rejection verified across ${negativeTestCount} deliberately invalid fixtures ✅`);

    // 7. Console Error Verification
    console.log('\n[CHECK 7] Verifying Zero Browser Console Errors...');
    console.log(`  -> Captured Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      throw new Error(`Detected ${consoleErrors.length} browser console errors: ${consoleErrors.join('; ')}`);
    }

    console.log('\n================================================================');
    console.log('ALL CI BROWSER SMOKE TEST CHECKS PASSED ✅');
    console.log('================================================================');
    process.exit(0);

  } catch (err) {
    console.error(`\n❌ CI BROWSER SMOKE TEST FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runSmokeTest();
