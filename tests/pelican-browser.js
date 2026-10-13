// Run with the workspace browser_run_code_unsafe tool, filename: tests/pelican-browser.js.
// Requires the static page at http://localhost:8000 and .ca/screenshots/ directory.
// Uses the existing Playwright browser; no project runtime dependencies are required.
async (workspacePage) => {
  // Keep real-time and controlled-clock tests in separate browser contexts.
  const liveContext = await workspacePage.context().browser().newContext({ reducedMotion: 'no-preference' });
  const page = await liveContext.newPage();
  const origin = 'http://localhost:8000';
  const report = {
    browser: `Chromium ${page.context().browser().version()}`,
    checks: [],
    errors: [],
    failedRequests: [],
    screenshots: []
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const check = async (name, action) => {
    const started = Date.now();
    try {
      const details = await action();
      report.checks.push({ name, status: 'passed', milliseconds: Date.now() - started, details });
    } catch (error) {
      report.checks.push({ name, status: 'failed', milliseconds: Date.now() - started, error: error.message });
    }
    // Retain completed checks even if the caller times out before the full report.
    await workspacePage.evaluate(value => { window.__pelicanTestReport = value; }, report);
  };
  const observe = (target) => {
    target.on('pageerror', error => report.errors.push(error.message));
    target.on('console', message => {
      if (message.type() === 'error') report.errors.push(message.text());
    });
    target.on('response', response => {
      if (response.status() >= 400) report.failedRequests.push(`${response.status()} ${response.url()}`);
    });
    target.on('requestfailed', request => report.failedRequests.push(`${request.url()} ${request.failure()?.errorText}`));
  };
  const pose = (target) => target.evaluate(() => {
    const ids = ['near-foot', 'far-foot', 'near-leg', 'far-leg', 'rear-spokes', 'front-spokes', 'road-lines'];
    return ids.map(id => {
      const element = document.getElementById(id);
      return [id, element.getAttribute('transform'), element.getAttribute('d'), element.getAttribute('stroke-dashoffset')];
    });
  });
  const label = (target) => target.locator('#playback-label').textContent();
  const snapshot = async (target, name, sceneOnly = false) => {
    const path = `/workspace/.ca/screenshots/${name}.png`;
    if (sceneOnly) await target.screenshot({ path, clip: await target.locator('#ride-scene').boundingBox() });
    else await target.screenshot({ path, fullPage: true });
    report.screenshots.push(path);
  };

  observe(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });

  await check('HTML / inline SVG / accessible description', async () => {
    const response = await page.goto(origin);
    assert(response.status() === 200, 'HTML response was not 200');
    assert(await page.title() === '鹈鹕的海边骑行', 'Unexpected page title');
    const details = await page.evaluate(() => {
      const scene = document.getElementById('ride-scene');
      const xml = new DOMParser().parseFromString(new XMLSerializer().serializeToString(scene), 'image/svg+xml');
      return {
        svgRole: scene.getAttribute('role'),
        description: document.getElementById('scene-description').textContent,
        paths: scene.querySelectorAll('path').length,
        externalAssets: document.querySelectorAll('script[src],link[rel="stylesheet"],image').length,
        xmlErrors: xml.querySelectorAll('parsererror').length,
        duplicateIds: [...document.querySelectorAll('[id]')].length - new Set([...document.querySelectorAll('[id]')].map(element => element.id)).size
      };
    });
    assert(details.svgRole === 'img' && details.description.includes('喉囊'), 'SVG description missing');
    assert(details.paths > 30 && details.externalAssets === 0 && details.xmlErrors === 0 && details.duplicateIds === 0, 'SVG structure or dependency failure');
    return details;
  });

  await check('Real animation: at least three full cycles and continuous contact', async () => {
    const details = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now();
      const frames = [];
      let previous = null;
      let wraps = 0;
      let maximumFootStep = 0;
      let maximumKneeStep = 0;
      let maximumContactError = 0;
      let maximumOppositionError = 0;
      const quadrants = new Set();
      const readFoot = (side) => {
        const m = document.getElementById(`${side}-foot`).transform.baseVal.consolidate().matrix;
        return { x: m.e, y: m.f };
      };
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      function sample() {
        const near = readFoot('near');
        const far = readFoot('far');
        const angle = (Math.atan2(near.y - 463, near.x - 475) + Math.PI * 2) % (Math.PI * 2);
        quadrants.add(Math.floor(angle / (Math.PI / 2)));
        const knees = [];
        for (const side of ['near', 'far']) {
          const leg = document.getElementById(`${side}-leg`);
          const values = leg.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
          knees.push({ x: values[2], y: values[3] });
          const end = leg.getPointAtLength(leg.getTotalLength());
          const crank = document.getElementById(`${side}-crank`);
          const pedal = crank.getPointAtLength(crank.getTotalLength());
          const foot = side === 'near' ? near : far;
          maximumContactError = Math.max(maximumContactError, distance(end, foot), distance(pedal, foot));
        }
        maximumOppositionError = Math.max(maximumOppositionError, Math.hypot((near.x + far.x) / 2 - 475, (near.y + far.y) / 2 - 463));
        if (previous) {
          if (previous.angle > angle + Math.PI) wraps++;
          maximumFootStep = Math.max(maximumFootStep, distance(near, previous.near), distance(far, previous.far));
          maximumKneeStep = Math.max(maximumKneeStep, ...knees.map((knee, i) => distance(knee, previous.knees[i])));
        }
        frames.push({ near, far, wheel: document.getElementById('rear-spokes').getAttribute('transform'), road: document.getElementById('road-lines').getAttribute('stroke-dashoffset') });
        previous = { near, far, knees, angle };
        if (performance.now() - start < 8100) requestAnimationFrame(sample);
        else resolve({ milliseconds: performance.now() - start, frames: frames.length, wraps, quadrants: [...quadrants].sort(), maximumContactError, maximumOppositionError, maximumFootStep, maximumKneeStep, distinctWheelPositions: new Set(frames.map(frame => frame.wheel)).size, distinctRoadPositions: new Set(frames.map(frame => frame.road)).size });
      }
      requestAnimationFrame(sample);
    }));
    assert(details.wraps >= 3 && details.quadrants.length === 4, 'Did not observe three cycles and all quadrants');
    assert(details.maximumContactError < 0.01 && details.maximumOppositionError < 0.01, 'Feet separated from pedals or opposite phase');
    assert(details.maximumFootStep < 6 && details.maximumKneeStep < 10, 'Discontinuous foot or knee movement');
    assert(details.distinctWheelPositions > 30 && details.distinctRoadPositions > 30, 'Wheel or road did not animate');
    return details;
  });

  await check('Pause / resume and keyboard focus / Enter / Space', async () => {
    await page.reload();
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ id: document.activeElement.id, outline: getComputedStyle(document.activeElement).outlineStyle }));
    assert(focus.id === 'playback' && focus.outline !== 'none', 'Keyboard focus is not visible on playback button');
    await page.keyboard.press('Enter');
    assert(await label(page) === '播放动画', 'Enter did not pause');
    const paused = await pose(page);
    await page.waitForTimeout(220);
    assert(JSON.stringify(paused) === JSON.stringify(await pose(page)), 'Pose changed while paused');
    await page.keyboard.press('Space');
    assert(await label(page) === '暂停动画', 'Space did not resume');
    await page.waitForTimeout(180);
    assert(JSON.stringify(paused) !== JSON.stringify(await pose(page)), 'Pose did not change after resume');
    return { focus, pausedStable: true, keyboardResume: true };
  });

  await check('Reduced motion: default, manual play and live preference change', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    assert(await label(page) === '播放动画', 'Reduced motion started automatically');
    const initial = await pose(page);
    await page.waitForTimeout(200);
    assert(JSON.stringify(initial) === JSON.stringify(await pose(page)), 'Reduced-motion initial pose changed');
    await page.getByRole('button', { name: '播放动画', exact: true }).click();
    await page.waitForTimeout(180);
    assert(JSON.stringify(initial) !== JSON.stringify(await pose(page)), 'Manual play under reduced motion failed');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Allow a rendered preference change before reversing it; back-to-back
    // overrides can be coalesced by Chromium into no observable change.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.getElementById('playback-label').textContent === '播放动画', null, { timeout: 2000 });
    assert(await label(page) === '播放动画', 'Live reduced-motion change did not pause');
    const stopped = await pose(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(200);
    assert(JSON.stringify(stopped) === JSON.stringify(await pose(page)), 'Disabling reduced-motion preference restarted animation');
    return { staticDefault: true, manualPlay: true, livePause: true, noUnrequestedRestart: true };
  });

  // A controlled clock makes exact phases and long hidden intervals reproducible.
  const controlledContext = await page.context().browser().newContext({ reducedMotion: 'no-preference' });
  const controlled = await controlledContext.newPage();
  observe(controlled);
  await controlled.emulateMedia({ reducedMotion: 'no-preference' });
  await controlled.setViewportSize({ width: 1000, height: 900 });
  await controlled.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await controlled.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await controlled.goto(origin);
  await controlled.clock.runFor(16);

  await check('Four pedal directions / cycle boundary / wheel and road direction', async () => {
    const samples = [];
    for (let phase = 0; phase < 5; phase++) {
      if (phase) await controlled.clock.runFor(600);
      const sample = await controlled.evaluate(() => {
        const foot = document.getElementById('near-foot').transform.baseVal.consolidate().matrix;
        const wheel = Number(document.getElementById('rear-spokes').getAttribute('transform').match(/-?\d+(?:\.\d+)?/)[0]);
        const road = Number(document.getElementById('road-lines').getAttribute('stroke-dashoffset'));
        return { x: foot.e, y: foot.f, wheel, road };
      });
      samples.push(sample);
      if (phase < 4) await snapshot(controlled, `pelican-phase-${['right', 'down', 'left', 'up'][phase]}-test`, true);
      const expected = [{ x: 503, y: 463 }, { x: 475, y: 491 }, { x: 447, y: 463 }, { x: 475, y: 435 }, { x: 503, y: 463 }][phase];
      assert(Math.hypot(sample.x - expected.x, sample.y - expected.y) < 1.4, `Incorrect pedal direction at phase ${phase}`);
    }
    const angleDelta = (samples[1].wheel - samples[0].wheel + 720) % 720;
    const roadDelta = (samples[1].road - samples[0].road + 120) % 120;
    assert(angleDelta > 170 && angleDelta < 190 && roadDelta > 8 && roadDelta < 29, 'Incorrect wheel or road direction/rate');
    assert(Math.hypot(samples[4].x - samples[0].x, samples[4].y - samples[0].y) < 1.4, 'Cycle boundary is discontinuous');
    return { samples, clockwiseWheelDelta: angleDelta, leftwardRoadOffsetDelta: roadDelta };
  });

  await check('Repeated control does not create additional animation loops', async () => {
    for (let i = 0; i < 12; i++) await controlled.locator('#playback').dispatchEvent('click');
    const before = await controlled.evaluate(() => {
      window.__wheelUpdates = 0;
      window.__wheelObserver = new MutationObserver(records => { window.__wheelUpdates += records.length; });
      const wheel = document.getElementById('rear-spokes');
      window.__wheelObserver.observe(wheel, { attributes: true, attributeFilter: ['transform'] });
      return Number(wheel.getAttribute('transform').match(/-?\d+(?:\.\d+)?/)[0]);
    });
    await controlled.clock.runFor(256);
    const after = await controlled.evaluate(() => {
      const angle = Number(document.getElementById('rear-spokes').getAttribute('transform').match(/-?\d+(?:\.\d+)?/)[0]);
      const updates = window.__wheelUpdates;
      window.__wheelObserver.disconnect();
      delete window.__wheelObserver;
      delete window.__wheelUpdates;
      return { angle, updates };
    });
    const delta = (after.angle - before + 720) % 720;
    assert(delta > 68 && delta < 83, `Animation speed changed after repeated controls: ${delta}`);
    assert(after.updates >= 14 && after.updates <= 17, `Unexpected render count after repeated controls: ${after.updates}`);
    return { toggles: 12, wheelDegreesIn256ms: delta, rendersIn256ms: after.updates };
  });

  await check('Simulated page visibility: freeze, resume and retained user pause', async () => {
    // Headless tabs remain visible. Simulate document.hidden + visibilitychange;
    // this verifies scheduler behavior, not an actual operating-system tab switch.
    const visibility = (hidden) => controlled.evaluate(value => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value ? 'hidden' : 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    const before = await pose(controlled);
    await visibility(true);
    await controlled.clock.runFor(3000);
    assert(JSON.stringify(before) === JSON.stringify(await pose(controlled)), 'Hidden page pose changed');
    await visibility(false);
    await controlled.clock.runFor(16);
    assert(JSON.stringify(before) === JSON.stringify(await pose(controlled)), 'Resume accumulated hidden time');
    await controlled.clock.runFor(128);
    assert(JSON.stringify(before) !== JSON.stringify(await pose(controlled)), 'Visible page did not resume');
    await controlled.locator('#playback').dispatchEvent('click');
    assert(await label(controlled) === '播放动画', 'Could not pause controlled page');
    const paused = await pose(controlled);
    await visibility(true);
    await controlled.clock.runFor(3000);
    await visibility(false);
    await controlled.clock.runFor(1000);
    assert(JSON.stringify(paused) === JSON.stringify(await pose(controlled)), 'Visibility change lost user pause');
    await controlled.evaluate(() => {
      delete document.hidden;
      delete document.visibilityState;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    return { method: 'simulated visibility properties and event', hiddenMilliseconds: 3000, hiddenPoseStable: true, noCatchUpJump: true, userPauseRetained: true };
  });
  await controlledContext.close();

  await check('Four target viewports: layout, subject bounds and controls', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    const layouts = [];
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [844, 390]]) {
      await page.setViewportSize({ width, height });
      const layout = await page.evaluate(() => {
        const scene = document.getElementById('ride-scene');
        const rect = scene.getBoundingClientRect();
        const button = document.getElementById('playback').getBoundingClientRect();
        const groups = ['pelican', 'wing', 'wheels', 'near-limb', 'far-limb', 'bicycle'];
        const subjectInside = groups.every(id => {
          const b = document.getElementById(id).getBBox();
          return b.x >= 8 && b.y >= 8 && b.x + b.width <= 992 && b.y + b.height <= 692;
        });
        return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, sceneWidth: rect.width, sceneHeight: rect.height, subjectInside, buttonInsideWidth: button.left >= 0 && button.right <= innerWidth, buttonHeight: button.height };
      });
      assert(layout.documentWidth === width && layout.subjectInside && layout.buttonInsideWidth && layout.buttonHeight >= 44, `Layout failure at ${width}×${height}`);
      assert(Math.abs(layout.sceneWidth / layout.sceneHeight - 1000 / 700) < 0.005, 'SVG aspect ratio changed');
      await snapshot(page, `pelican-${width}x${height}-test`);
      layouts.push(layout);
    }
    return layouts;
  });

  await check('JavaScript disabled: complete static illustration, no inactive control', async () => {
    const context = await page.context().browser().newContext({ javaScriptEnabled: false, viewport: { width: 1000, height: 900 } });
    try {
      const staticPage = await context.newPage();
      observe(staticPage);
      await staticPage.goto(origin);
      const initial = await pose(staticPage);
      await staticPage.waitForTimeout(180);
      assert(JSON.stringify(initial) === JSON.stringify(await pose(staticPage)), 'Static pose changed with JavaScript disabled');
      assert(!await staticPage.locator('#playback').isVisible(), 'Inactive control is visible with JavaScript disabled');
      assert(await staticPage.locator('#pelican').isVisible() && await staticPage.locator('#wheels').isVisible(), 'Static subject missing');
      await snapshot(staticPage, 'pelican-no-javascript-test');
      return { fullStaticSubject: true, poseStable: true, controlHidden: true };
    } finally { await context.close(); }
  });

  await check('Offline file opening: single HTML plays without a server', async () => {
    const context = await page.context().browser().newContext({ offline: true, reducedMotion: 'no-preference', viewport: { width: 1000, height: 900 } });
    try {
      const offlinePage = await context.newPage();
      observe(offlinePage);
      await offlinePage.goto('file:///workspace/index.html');
      assert(await offlinePage.title() === '鹈鹕的海边骑行', 'Offline file did not load');
      assert(await offlinePage.getByRole('button', { name: '暂停动画', exact: true }).isVisible(), 'Offline animation did not initialize');
      const initial = await pose(offlinePage);
      await offlinePage.waitForTimeout(180);
      assert(JSON.stringify(initial) !== JSON.stringify(await pose(offlinePage)), 'Offline file did not animate');
      await snapshot(offlinePage, 'pelican-offline-file-test');
      return { url: offlinePage.url(), offline: true, animationActive: true };
    } finally { await context.close(); }
  });

  await check('No uncaught script errors or failed network requests', async () => {
    assert(report.errors.length === 0 && report.failedRequests.length === 0, JSON.stringify({ errors: report.errors, requests: report.failedRequests }));
    return { errors: report.errors.length, failedRequests: report.failedRequests.length };
  });
  report.passed = report.checks.filter(item => item.status === 'passed').length;
  report.failed = report.checks.filter(item => item.status === 'failed').length;
  await workspacePage.evaluate(value => { window.__pelicanTestReport = value; }, report);
  await liveContext.close();
  return report;
}
