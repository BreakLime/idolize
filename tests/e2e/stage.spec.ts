// The stage: Now Playing's default view, gone with its toggle (remembered), a panel or Now Playing closed; it renders
// while the music plays (the idol cut out of it) and stops when paused.
// Muted at the browser level (--mute-audio) with the player's volume up: the show listens to the music.
import { expect, test } from '@playwright/test';
import { launch } from './helpers';

test("the stage is Now Playing's default view, switched off and on by its toggle", async () => {
  const { app, page } = await launch('stage', { fresh: true, args: ['--mute-audio'] });
  try {
    const frames = () => page.evaluate(() => (window as any).__idol.stageDebug.frames as number);
    const stage = page.locator('[data-test="stage"]');
    const toggle = page.locator('[data-test="toggle-stage"]');
    await page.evaluate(async () => {
      const w = window as any;
      w.__idol.player.setVolume(0.5);
      w.__idol.player.playList(await w.__idol.api.albums.tracks(446039372), 0, null);
    });
    await page.waitForFunction(() => (window as any).__idol.usePlayer.getState().currentTime > 1, null, { timeout: 30_000 });

    // the default view of Now Playing: drawing frames, the cover handing its place to the LED wall
    await page.locator('[data-test="player-details-toggle-now-playing"]').click();
    await expect(stage).toHaveCount(1);
    await expect.poll(frames, { timeout: 10_000 }).toBeGreaterThan(30);
    await expect(page.locator('[data-test="now-playing-artwork"]')).toHaveCSS('opacity', '0');
    expect(await page.evaluate(() => (window as any).__idol.stageDebug.failed)).toBe('');
    // the idol is cut out of the canvas (the figure itself only moves, unseen)
    await expect(stage).toHaveAttribute('data-gl', 'on');
    expect(await page.evaluate(() => (window as any).__idol.stageDebug.idol)).toBe(true);
    await expect(page.locator('[data-test="stage-performer"]').locator('xpath=..')).toHaveCSS('opacity', '0');
    // the idol up in the top left (where the sidebar's sits), the lyrics under the album
    const idolBox = (await page.locator('[data-test="stage-performer"]').boundingBox())!;
    expect(idolBox.x).toBeLessThan(40);
    expect(idolBox.y).toBeLessThan(80);
    const albumBox = (await page.locator('[data-test="now-playing-artwork"]').boundingBox())!;
    await expect.poll(async () => (await page.locator('[data-test="stage-lyrics"]').boundingBox())!.y).toBeGreaterThanOrEqual(albumBox.y + albumBox.height);

    // the toggle: the plain cover, and back
    await toggle.click();
    await expect(stage).toHaveCount(0);
    await expect(page.locator('[data-test="now-playing-artwork"]')).toHaveCSS('opacity', '1');
    await toggle.click();
    await expect(stage).toHaveCount(1);

    // a panel takes the view: no stage behind it
    await page.locator('[data-test="toggle-lyrics"]').click();
    await expect(stage).toHaveCount(0);
    await page.locator('[data-test="toggle-lyrics"]').click();
    await expect(stage).toHaveCount(1);

    // the next track: the stage keeps drawing (it once lost its WebGL context at a track change), and the show starts
    // calm, with nothing structural until the new song's map is there
    await page.evaluate(() => (window as any).__idol.player.next());
    await page.waitForFunction(() => (window as any).__idol.usePlayer.getState().currentTime > 0.5, null, { timeout: 30_000 });
    const before = await frames();
    await page.waitForTimeout(1500);
    expect(await frames()).toBeGreaterThan(before + 30);
    expect(await page.evaluate(() => (window as any).__idol.stageDebug.failed)).toBe('');
    expect(await page.evaluate(() => (window as any).__idol.stageDebug.tension)).toBeLessThan(0.05);

    // paused: no more frames
    await page.evaluate(() => (window as any).__idol.player.pause());
    await page.waitForTimeout(300);
    const paused = await frames();
    await page.waitForTimeout(1000);
    expect(await frames()).toBe(paused);

    // closed: gone; opened again while paused: a still, not a blank stage
    await page.keyboard.press('Escape');
    await expect(stage).toHaveCount(0);
    await page.waitForTimeout(500);
    await page.locator('[data-test="player-details-toggle-now-playing"]').click();
    await expect(stage).toHaveAttribute('data-gl', 'on', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // the toggle's choice is remembered for the next time
    await page.evaluate(() => (window as any).__idol.player.play());
    await page.locator('[data-test="player-details-toggle-now-playing"]').click();
    await expect(stage).toHaveCount(1);
    await toggle.click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.locator('[data-test="player-details-toggle-now-playing"]').click();
    await page.waitForTimeout(600);
    await expect(stage).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await page.evaluate(() => (window as any).__idol.player.pause()).catch(() => {});
    await app.close();
  }
});
