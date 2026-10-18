// Logout must survive a restart (no silent re-import of the lumitide login), and the main window
// must never navigate to a remote page (it carries the privileged window.idol bridge).
import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { launch, SCRATCH } from './helpers';

test('logout persists across restarts', async () => {
  let { app, page } = await launch('session', { fresh: true }); // fresh profile imports lumitide's login
  await page.evaluate(() => (window as any).idol.auth.logout());
  await expect(page.locator('[data-test="login-page"]')).toBeVisible();
  await app.close();

  // relaunch the same profile: still logged out
  app = await electron.launch({ args: [resolve('.')], env: { ...process.env, IDOLIZE_USER_DATA: resolve(SCRATCH, 'profiles', 'session') } as Record<string, string> });
  page = await app.firstWindow();
  try {
    await expect(page.locator('[data-test="login-page"]')).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => (window as any).idol.auth.state())).toEqual({ loggedIn: false });
  } finally {
    await app.close();
  }
});

test('main window refuses to navigate to remote pages', async () => {
  const { app, page } = await launch('navguard', { fresh: true });
  try {
    // record instead of really opening the browser (on a desktop without a working https handler
    // that leaves a "Pick an application" dialog behind)
    await app.evaluate(({ shell }) => {
      const g = globalThis as unknown as { __opened: string[] };
      g.__opened = [];
      shell.openExternal = async (url: string) => void g.__opened.push(url);
    });
    const before = page.url();
    await page.evaluate(() => {
      location.href = 'https://example.com/';
    });
    await page.waitForTimeout(1500);
    expect(page.url()).toBe(before);
    expect(await page.evaluate(() => typeof (window as any).idol?.api?.request)).toBe('function');
    // the link went to the default browser instead
    expect(await app.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened)).toEqual(['https://example.com/']);
  } finally {
    await app.close();
  }
});

test('reload on a deep route boots the app again (View → Reload)', async () => {
  const { app, page } = await launch('deep-reload', { fresh: true });
  try {
    await page.waitForSelector('[data-test="main"]', { timeout: 30_000 });
    await page.evaluate(() => (window as any).__idol.navigate('/album/446039372'));
    await expect(page).toHaveURL(/\/album\/446039372$/);
    await page.reload();
    await expect(page.locator('[data-test="main"]')).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => location.pathname)).toBe('/album/446039372');
    expect(await page.evaluate(() => typeof (window as any).__idol)).toBe('object');
  } finally {
    await app.close();
  }
});
