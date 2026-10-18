// Player behaviours that only show in the real engine: repeat-one loops, and the queue/position is persisted while playing.
import { expect, test } from '@playwright/test';
import { launch } from './helpers';

test('repeat-one restarts the track and the position is saved during playback', async () => {
  const { app, page } = await launch('player', { fresh: true });
  try {
    await page.evaluate(async () => {
      const w = window as any;
      w.__idol.player.setVolume(0);
      w.__idol.player.playList(await w.__idol.api.albums.tracks(446039372), 0, null);
    });
    await expect.poll(() => page.evaluate(() => (window as any).__idol.engineDebug().currentTime), { timeout: 15_000 }).toBeGreaterThan(2);

    // persisted while playing (throttled, not starved by 4 Hz time updates)
    await page.waitForTimeout(2500);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('idolize:player') ?? '{}').currentTime ?? 0);
    expect(saved).toBeGreaterThan(1);

    // repeat one: let the track end, it must start over on the same queue position
    await page.evaluate(() => {
      const w = window as any;
      w.__idol.player.cycleRepeat(); // all
      w.__idol.player.cycleRepeat(); // one
      w.__idol.player.seek(w.__idol.engineDebug().duration - 2);
    });
    await page.waitForTimeout(5000);
    const after = await page.evaluate(() => ({ ...(window as any).__idol.engineDebug(), pos: (window as any).__idol.usePlayer.getState().pos }));
    expect(after.pos).toBe(0);
    expect(after.paused).toBe(false);
    expect(after.currentTime).toBeLessThan(5);
  } finally {
    await app.close();
  }
});
