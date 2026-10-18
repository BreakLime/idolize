// The app was called tidal-idol: preferences stored under that name move to Idolize's keys on the next start.
import { expect, test } from '@playwright/test';
import { launch } from './helpers';

test("preferences stored under the app's old name carry over", async () => {
  let { app, page } = await launch('renamed', { fresh: true });
  await page.evaluate(() => {
    localStorage.removeItem('idolize:prefs');
    localStorage.setItem('tidal-idol:prefs', JSON.stringify({ dancingLogo: false }));
  });
  await app.close();

  ({ app, page } = await launch('renamed'));
  try {
    const stored = await page.evaluate(() => ({ now: localStorage.getItem('idolize:prefs'), old: localStorage.getItem('tidal-idol:prefs') }));
    expect(stored.old).toBeNull();
    expect(JSON.parse(stored.now ?? '{}').dancingLogo).toBe(false);
  } finally {
    await app.close();
  }
});
