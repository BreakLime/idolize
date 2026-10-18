import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SCRATCH = resolve('reference/e2e');

export async function launch(profile: string, opts: { fresh?: boolean; args?: string[] } = {}): Promise<{ app: ElectronApplication; page: Page }> {
  const userData = resolve(SCRATCH, 'profiles', profile);
  if (opts.fresh) rmSync(userData, { recursive: true, force: true });
  mkdirSync(userData, { recursive: true });
  // a new profile gets the standard window the tests were written for (the app's default, Clear, is another kind of
  // window, switched only by a restart)
  const settings = resolve(userData, 'settings.json');
  if (!existsSync(settings)) writeFileSync(settings, JSON.stringify({ transparency: 'off' }));
  const app = await electron.launch({ args: [resolve('.'), ...(opts.args ?? [])], env: { ...process.env, IDOLIZE_USER_DATA: userData } as Record<string, string> });
  const page = await app.firstWindow();
  await page.evaluate('globalThis.__name ??= (f) => f');
  await page.waitForSelector('[data-test="main"]', { timeout: 30_000 });
  return { app, page };
}
