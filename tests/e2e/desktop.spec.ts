// Desktop integration: playback-driven window title, close-to-tray, plain close quits.
import { expect, test } from '@playwright/test';
import { launch } from './helpers';

test('window title follows playback and close-to-tray hides instead of quitting', async () => {
  const { app, page } = await launch('desktop', { fresh: true });
  try {
    await page.evaluate(async () => {
      const w = window as any;
      w.__idol.player.setVolume(0);
      const t = await w.__idol.api.tracks.get(541500182);
      w.__idol.player.playList([t], 0, null);
    });
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()), { timeout: 15_000 }).toMatch(/WannaCry - /);
    await page.evaluate(() => (window as any).__idol.player.pause());
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())).toBe('Idolize');

    await page.evaluate(() => (window as any).idol.settings.set({ closeToTray: true }));
    await page.locator('[data-test="title-bar"] button[aria-label="Close"]').click();
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
    // still alive: show it again through the main process
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await page.evaluate(() => (window as any).idol.settings.set({ closeToTray: false }));
  } finally {
    const closed = app.waitForEvent('close');
    await page.locator('[data-test="title-bar"] button[aria-label="Close"]').click().catch(() => {});
    await Promise.race([closed, new Promise((r) => setTimeout(r, 8000))]);
    await app.close().catch(() => {});
  }
});
