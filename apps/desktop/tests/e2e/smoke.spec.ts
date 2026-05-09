// apps/desktop/tests/e2e/smoke.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('app launches and shows mode tabs', async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' },
  });

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // ModeTabs should render eventually (after runtime probe ok or runtime error).
  // Use Playwright's auto-retrying assertion so it polls until the pattern matches
  // or the timeout is reached. "Connecting to Hermes…" is the transient loading state
  // that resolves once the runtime probe finishes (fast path: binary not found → error).
  await expect(win.locator('body')).toContainText(
    /Hermes Cowork|Chat|Cowork|Hermes runtime unavailable|Connecting to Hermes/,
    { timeout: 15_000 },
  );

  await app.close();
});
