// Now Playing's artist card: hidden until the artist name is clicked, closed by the name, a click elsewhere or Escape;
// its picture / name lead to the artist page. Outside Now Playing the name still goes straight to the page.
// And the player bar as Now Playing's handle: a click on it opens and closes it, its controls keep their own.
import { expect, test } from '@playwright/test';
import { launch } from './helpers';

test('artist card opens from the artist name in Now Playing', async () => {
  const { app, page } = await launch('nowplaying', { fresh: true });
  try {
    // a muted, paused track with two artists
    const artists = await page.evaluate(async () => {
      const w = window as any;
      w.__idol.player.setVolume(0);
      const tracks = await w.__idol.api.albums.tracks(446039372);
      const t = tracks.find((x: any) => x.artists.length > 1) ?? tracks[0];
      w.__idol.player.playList([t], 0, null);
      return t.artists.map((a: any) => ({ id: a.id, name: a.name }));
    });
    console.log('artists', artists.map((a: { name: string }) => a.name).join(', '));
    await page.waitForFunction(() => (window as any).__idol.usePlayer.getState().currentTime > 0.3, null, { timeout: 30_000 });
    await page.evaluate(() => (window as any).__idol.player.pause());
    const path = () => page.evaluate(() => location.pathname);
    const card = page.locator('[data-test="artist-info-card"]');
    const name = (i: number) => page.locator('[data-test="footer-artist-name"] a').nth(i);

    await page.locator('[data-test="player-details-toggle-now-playing"]').click();
    await expect(page.locator('section[data-test="new-now-playing"][aria-hidden="false"]')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(card).toBeHidden(); // not shown by itself

    const before = await path();
    await name(0).click();
    await expect(card).toBeVisible();
    await expect(page.locator('[data-test="artist-info-name"]')).toHaveText(artists[0].name);
    expect(await path()).toBe(before); // the name didn't navigate
    if (artists.length > 1) {
      await name(1).click(); // another artist of the track: its card
      await expect(page.locator('[data-test="artist-info-name"]')).toHaveText(artists[1].name);
      await name(1).click(); // the same name again closes it
      await expect(card).toBeHidden();
      await name(0).click();
      await expect(card).toBeVisible();
    } else {
      await name(0).click();
      await expect(card).toBeHidden();
      await name(0).click();
      await expect(card).toBeVisible();
    }

    // a click elsewhere (the artwork) closes it
    await page.locator('[data-test="now-playing-artwork"]').click();
    await expect(card).toBeHidden();
    // Escape closes the card first, then Now Playing
    await name(0).click();
    await expect(card).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect(page.locator('section[data-test="new-now-playing"][aria-hidden="false"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('section[data-test="new-now-playing"][aria-hidden="false"]')).toHaveCount(0);

    // reopened: hidden again; the card's name opens the artist page and leaves Now Playing
    await page.locator('[data-test="player-details-toggle-now-playing"]').click();
    await page.waitForTimeout(600);
    await expect(card).toBeHidden();
    await name(0).click();
    await page.locator('[data-test="artist-info-name"]').click();
    await expect.poll(path).toBe(`/artist/${artists[0].id}`);
    await expect(page.locator('section[data-test="new-now-playing"][aria-hidden="false"]')).toHaveCount(0);

    // outside Now Playing the player bar's name goes straight to the artist page
    await page.evaluate(() => (window as any).__idol.navigate('/'));
    await name(0).click();
    await expect.poll(path).toBe(`/artist/${artists[0].id}`);
    await expect(card).toBeHidden();
  } finally {
    await app.close();
  }
});

test('a click on the player bar opens Now Playing and closes it; its controls keep their own', async () => {
  const { app, page } = await launch('nowplaying-bar', { fresh: true });
  try {
    await page.evaluate(async () => {
      const w = window as any;
      w.__idol.player.setVolume(0);
      w.__idol.player.playList((await w.__idol.api.albums.tracks(446039372)).slice(0, 1), 0, null);
    });
    await page.waitForFunction(() => (window as any).__idol.usePlayer.getState().currentTime > 0.3, null, { timeout: 30_000 });
    await page.evaluate(() => (window as any).__idol.player.pause());
    const open = () => page.evaluate(() => document.querySelector('section[data-test="new-now-playing"][aria-hidden="false"]') !== null);
    const bar = page.locator('[data-test="footer-player"]');
    const box = (await bar.boundingBox())!;
    // an empty spot: between the track info and the controls, near the bar's top edge
    const spot = { x: box.x + box.width * 0.33, y: box.y + 6 };

    await page.mouse.click(spot.x, spot.y);
    await expect.poll(open).toBe(true);
    await page.waitForTimeout(500);
    await page.mouse.click(spot.x, spot.y);
    await expect.poll(open).toBe(false);
    await page.waitForTimeout(500);

    // a control does its own thing: play, without opening Now Playing
    await page.locator('[data-test="play"], [data-test="pause"]').first().click();
    await page.waitForTimeout(400);
    expect(await open()).toBe(false);
    await page.evaluate(() => (window as any).__idol.player.pause());
    // a drag that began on the progress bar and ends elsewhere on the bar doesn't open it either
    const progress = (await page.locator('[data-test="progress-bar"]').boundingBox())!;
    await page.mouse.move(progress.x + progress.width * 0.2, progress.y + progress.height / 2);
    await page.mouse.down();
    await page.mouse.move(spot.x, spot.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await open()).toBe(false);
  } finally {
    await page.evaluate(() => (window as any).__idol.player.pause()).catch(() => {});
    await app.close();
  }
});
