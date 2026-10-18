// The PKCE login window must catch tidal://login/auth in-process (never hand it to the OS / real TIDAL app).
import { expect, test } from '@playwright/test';
import { launch } from './helpers';

test('login redirect is intercepted and exchanged in-process', async () => {
  const { app, page } = await launch('login', { fresh: true });
  try {
    const login = page.evaluate(() => (window as any).idol.auth.login().then(
      () => 'ok',
      (e: Error) => `rejected: ${e.message}`,
    ));
    // wait for the modal login window to load login.tidal.com
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.webContents.getURL()).find((u) => u.includes('login.tidal.com')) ?? ''), { timeout: 20_000 }).toContain('login.tidal.com/authorize');
    // simulate the identity provider redirecting back with a (fake) code
    await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes('login.tidal.com'))!;
      await w.webContents.executeJavaScript(`location.href = 'tidal://login/auth?code=FAKE_CODE&appMode=desktop'`).catch(() => {});
    });
    const result = await login;
    // the fake code reached our token exchange (and was rejected by TIDAL) → the redirect never left the app
    expect(result).toMatch(/rejected: .*Token request failed/);
    const remaining = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    expect(remaining).toBe(1);
  } finally {
    await app.close();
  }
});
