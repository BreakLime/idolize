// The dancing logo: it moves while music plays and stands still when paused or switched off in Settings.
// Muted at the browser level (--mute-audio) with the player's volume up: the analyser has to hear the music.
import { expect, test } from '@playwright/test';
import { launch } from './helpers';

test('the sidebar logo dances to the music, and stops when paused or switched off', async () => {
  const { app, page } = await launch('dance', { fresh: true, args: ['--mute-audio'] });
  try {
    const arm = page.locator('[data-test="dancing-logo"] > g > g').nth(2); // the left arm
    const armTransforms = async (ms: number) => {
      const seen = new Set<string | null>();
      for (const end = Date.now() + ms; Date.now() < end; ) {
        seen.add(await arm.getAttribute('transform'));
        await page.waitForTimeout(60);
      }
      return seen;
    };
    await page.evaluate(async () => {
      const w = window as any;
      w.__idol.player.setVolume(0.5);
      w.__idol.player.playList(await w.__idol.api.albums.tracks(446039372), 0, null);
    });
    await page.waitForFunction(() => (window as any).__idol.usePlayer.getState().currentTime > 3, null, { timeout: 30_000 });
    expect((await armTransforms(2500)).size).toBeGreaterThan(5); // swaying

    // paused: back to rest, the loop stops
    await page.evaluate(() => (window as any).__idol.player.pause());
    await page.waitForTimeout(1000);
    expect([...(await armTransforms(500))]).toEqual(['rotate(0 8.5 14.5)']);
    await expect.poll(() => page.evaluate(() => (window as any).__idol.danceDebug().running)).toBe(false);

    // switched off in Settings: playing, but still
    await page.evaluate(() => (window as any).__idol.navigate('/settings/general'));
    await page.locator('[data-test="switch-dancing-logo"]').setChecked(false, { force: true });
    await page.evaluate(() => (window as any).__idol.player.play());
    await page.waitForTimeout(1500);
    expect([...(await armTransforms(1000))]).toEqual(['rotate(0 8.5 14.5)']);
    await page.locator('[data-test="switch-dancing-logo"]').setChecked(true, { force: true });
    await page.waitForTimeout(1500);
    expect((await armTransforms(1500)).size).toBeGreaterThan(3);
  } finally {
    await page.evaluate(() => (window as any).__idol.player.pause()).catch(() => {});
    await app.close();
  }
});
