// G6: with transparency on, what is behind the window shows through (Win11 acrylic, or sharp in Clear); with it off,
// the app is opaque black.
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, SCRATCH } from './helpers';

/** Average screen color of a box (physical px), sampled with GDI — sees the composited desktop, unlike page screenshots. */
function screenColor(x: number, y: number, size = 60): [number, number, number] {
  const ps = `
Add-Type -AssemblyName System.Drawing
$b = New-Object Drawing.Bitmap ${size},${size}
$g = [Drawing.Graphics]::FromImage($b)
$g.CopyFromScreen(${x - size / 2},${y - size / 2},0,0,$b.Size)
$r=0;$gg=0;$bb=0
for($i=0;$i -lt ${size};$i++){for($j=0;$j -lt ${size};$j++){$c=$b.GetPixel($i,$j);$r+=$c.R;$gg+=$c.G;$bb+=$c.B}}
$n=${size * size}; "$([int]($r/$n)),$([int]($gg/$n)),$([int]($bb/$n))"`;
  return execFileSync('powershell', ['-NoProfile', '-Command', ps]).toString().trim().split(',').map(Number) as [number, number, number];
}

test('acrylic transparency shows what is behind the window', async () => {
  test.skip(process.platform !== 'win32', 'Windows only');
  const { app, page } = await launch('transparency', { fresh: true });
  try {
    // physical-pixel center of the content area (GDI capture is in physical pixels)
    const center = await app.evaluate(({ BrowserWindow, screen }) => {
      const main = BrowserWindow.getAllWindows()[0];
      main.unmaximize();
      main.setBounds({ x: 200, y: 150, width: 1000, height: 700 });
      main.setAlwaysOnTop(true, 'screen-saver'); // background test processes cannot take the foreground otherwise
      main.focus();
      const f = screen.getDisplayNearestPoint({ x: 700, y: 500 }).scaleFactor;
      return { x: Math.round(750 * f), y: Math.round(520 * f) };
    });
    await page.evaluate(() => (window as any).idol.settings.set({ transparency: 'off' }));
    await page.waitForTimeout(1000);
    const off = screenColor(center.x, center.y);

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    await page.waitForTimeout(800);
    const behind = screenColor(center.x, center.y);

    await page.evaluate(() => (window as any).idol.settings.set({ transparency: 'acrylic', transparencyTint: 0.3 }));
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.show();
      w.focus();
    });
    await page.waitForTimeout(1500);
    const on = screenColor(center.x, center.y);
    console.log({ off, behind, on });

    expect(Math.max(...off)).toBeLessThan(12); // opaque black
    expect(Math.max(...on)).toBeGreaterThan(12); // no longer black
    // acrylic = blurred backdrop under a 30% black tint: each channel tracks what is behind
    for (let i = 0; i < 3; i++) expect(Math.abs(on[i] - behind[i] * 0.7)).toBeLessThan(70);
  } finally {
    await page.evaluate(() => (window as any).idol.settings.set({ transparency: 'off' })).catch(() => {});
    await app.close();
  }
});

/** A muted, paused track in the player, the given player background, then Now Playing opened from the player bar. */
async function openNowPlaying(page: Page, background: string) {
  await page.evaluate(async () => {
    const w = window as any;
    w.__idol.player.setVolume(0);
    w.__idol.player.playList([await w.__idol.api.tracks.get(541500182)], 0, null);
  });
  await page.waitForFunction(() => (window as any).__idol.usePlayer.getState().currentTime > 0.3, null, { timeout: 30_000 });
  await page.evaluate(() => (window as any).__idol.player.pause());
  await page.evaluate(() => (window as any).__idol.navigate('/settings/general'));
  await page.locator(`[data-test="appearance-${background}"]`).click();
  await page.locator('[data-test="player-details-toggle-now-playing"]').click();
  // the plain view (the stage, on by default, would paint over the desktop)
  const stage = page.locator('[data-test="toggle-stage"][aria-pressed="true"]');
  if (await stage.count()) await stage.click();
  await page.waitForTimeout(1200);
}

/** Single screen pixels (physical px), sampled with GDI. */
function screenPixels(pts: [number, number][]): [number, number, number][] {
  const ps =
    `Add-Type -AssemblyName System.Drawing; $b = New-Object Drawing.Bitmap 1,1; $g=[Drawing.Graphics]::FromImage($b); ` +
    pts.map(([x, y]) => `$g.CopyFromScreen(${x},${y},0,0,$b.Size); $c=$b.GetPixel(0,0); "$($c.R),$($c.G),$($c.B)"`).join('; ');
  return execFileSync('powershell', ['-NoProfile', '-Command', ps])
    .toString()
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(',').map(Number) as [number, number, number]);
}

test('clear transparency: sharp see-through window, resize frame, caption maximize, restart row', async () => {
  test.skip(process.platform !== 'win32', 'Windows only');
  // Clear is chosen when the window is created: start with it saved
  const userData = resolve(SCRATCH, 'profiles', 'transparency-clear');
  rmSync(userData, { recursive: true, force: true });
  mkdirSync(userData, { recursive: true });
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ transparency: 'clear', transparencyTint: 0.3 }));
  const { app, page } = await launch('transparency-clear');
  try {
    expect(await page.evaluate(() => (window as any).idol.window.state())).toMatchObject({ transparency: 'clear', clearWindow: true });
    // a backdrop window right behind: blue left half, orange right half, a sharp edge at x = 700
    const g = await app.evaluate(async ({ BrowserWindow, screen }) => {
      const main = BrowserWindow.getAllWindows()[0];
      main.unmaximize();
      main.setBounds({ x: 200, y: 150, width: 1000, height: 700 });
      const back = new BrowserWindow({ x: 150, y: 100, width: 1100, height: 800, frame: false, show: true, focusable: false });
      await back.loadURL('data:text/html,<body style="margin:0;background:linear-gradient(90deg,%234080c0 50%,%23c08040 50%)"></body>');
      back.setAlwaysOnTop(true, 'floating');
      main.setAlwaysOnTop(true, 'screen-saver');
      main.moveTop();
      return { f: screen.getDisplayNearestPoint({ x: 700, y: 500 }).scaleFactor, hwnd: main.getNativeWindowHandle().readBigInt64LE(0).toString() };
    });
    const px = (v: number) => Math.round(v * g.f);
    await page.waitForTimeout(1500);
    // the empty middle of the title bar, 2px either side of the backdrop's edge; and the window's outermost corner pixels
    const edge: [number, number][] = [
      [px(700) - 2, px(165)],
      [px(700) + 2, px(165)],
    ];
    const corners: [number, number][] = [
      [px(200), px(850) - 1],
      [px(1200) - 1, px(850) - 1],
    ];
    const [l, r, bl, br] = screenPixels([...edge, ...corners]);
    console.log('clear', { l, r, bl, br });
    expect(l[2]).toBeGreaterThan(l[0] + 30); // blue shows through on the left …
    expect(r[0]).toBeGreaterThan(r[2] + 30); // … orange on the right
    expect(Math.abs(l[0] - r[0])).toBeGreaterThan(50); // and the edge between them stays sharp: no blur
    // rounded corners (Windows 11 rounds the window on request): the outermost pixels show the backdrop, under the shadow
    expect(bl[2]).toBeGreaterThan(bl[0] + 30);
    expect(br[0]).toBeGreaterThan(br[2] + 30);
    // the resize frame FancyZones and Windows Snap look for (WS_THICKFRAME), without a caption (WS_CAPTION paints it black)
    const style = Number(
      execFileSync('powershell', [
        '-NoProfile',
        '-Command',
        `Add-Type -Namespace W -Name S -MemberDefinition '[DllImport("user32.dll")] public static extern int GetWindowLong(System.IntPtr h, int i);'; [W.S]::GetWindowLong([System.IntPtr]::new([Int64]${g.hwnd}),-16)`,
      ]).toString(),
    );
    expect(style & 0x00040000).toBeTruthy();
    expect(style & 0x00c00000).not.toBe(0x00c00000);
    // the player bar has the sidebar's glass, and nothing scrolls under it: an empty spot of each over the blue half
    const sidebarSpot: [number, number] = [px(430), px(720)];
    const barSpot: [number, number] = [px(650), px(846)];
    // (and one that stays empty in Now Playing too: below the collapse button, where its header row has nothing)
    const topSpot: [number, number] = [px(432), px(230)];
    const [side, bar, top] = screenPixels([sidebarSpot, barSpot, topSpot]);
    console.log('sidebar / bar', { side, bar, top });
    for (let i = 0; i < 3; i++) expect(Math.abs(side[i] - bar[i])).toBeLessThan(5);

    // acrylic still works on the clear window: the same edge is blurred
    await page.evaluate(() => (window as any).idol.settings.set({ transparency: 'acrylic' }));
    await page.waitForTimeout(1500);
    const [al, ar] = screenPixels(edge);
    console.log('acrylic', { al, ar });
    expect(Math.abs(al[0] - ar[0])).toBeLessThan(40);

    // double-clicking the caption maximizes: DefWindowProc turns it into SC_MAXIMIZE, which main handles (Electron ignores
    // it for a transparent window)
    const dblclick = `Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern System.IntPtr SendMessage(System.IntPtr h, uint m, System.IntPtr w, System.IntPtr l); [DllImport("user32.dll")] public static extern System.IntPtr SetThreadDpiAwarenessContext(System.IntPtr c);'
[W.U]::SetThreadDpiAwarenessContext([System.IntPtr]::new(-4))|Out-Null
[W.U]::SendMessage([System.IntPtr]::new([Int64]${g.hwnd}),0xA3,[System.IntPtr]::new(2),[System.IntPtr]::new((${px(165)} -shl 16) -bor ${px(700)}))|Out-Null`;
    execFileSync('powershell', ['-NoProfile', '-Command', dblclick]);
    await expect.poll(() => page.evaluate(() => (window as any).idol.window.state().then((s: any) => s.maximized))).toBe(true);
    await page.locator('[data-test="title-bar"] button[aria-label="Restore"]').click();
    await expect.poll(() => page.evaluate(() => (window as any).idol.window.state().then((s: any) => s.maximized))).toBe(false);

    // leaving Clear takes a restart: the row offers it
    await page.evaluate(() => (window as any).__idol.navigate('/settings/general'));
    const row = page.locator('[data-test="transparency-restart"]');
    await expect(row).toBeVisible();
    await app.evaluate(({ app: a }) => {
      const s = globalThis as any;
      s.__real = { relaunch: a.relaunch, quit: a.quit, calls: [] };
      a.relaunch = (() => s.__real.calls.push('relaunch')) as typeof a.relaunch;
      a.quit = (() => s.__real.calls.push('quit')) as typeof a.quit;
    });
    await page.locator('[data-test="button-restart"]').click();
    await expect
      .poll(() =>
        app.evaluate(({ app: a }) => {
          const s = (globalThis as any).__real;
          if (s.calls.length === 2) Object.assign(a, { relaunch: s.relaunch, quit: s.quit });
          return s.calls;
        }),
      )
      .toEqual(['relaunch', 'quit']);
    await page.locator('[data-test="transparency-clear"]').click();
    await expect(row).toHaveCount(0);

    // Now Playing "Transparent": the app underneath fades out, the desktop shows behind the view (only the root's tint
    // over it, no sidebar layer), and comes back on close
    await openNowPlaying(page, 'transparent');
    const [npTop] = screenPixels([topSpot]);
    console.log('now playing transparent', { npTop, top });
    expect(npTop[2]).toBeGreaterThan(npTop[0] + 30); // the blue backdrop
    expect(npTop[2]).toBeGreaterThan(top[2] + 12); // one glass layer less than the sidebar had
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    const [back] = screenPixels([topSpot]);
    for (let i = 0; i < 3; i++) expect(Math.abs(back[i] - top[i])).toBeLessThan(5);
  } finally {
    await app
      .evaluate(({ BrowserWindow }) => {
        for (const w of BrowserWindow.getAllWindows()) w.setAlwaysOnTop(false);
        BrowserWindow.getAllWindows().slice(1).forEach((w) => w.destroy());
      })
      .catch(() => {});
    await app.close();
  }
});

test('now playing "Acrylic" in an opaque window: the desktop shows blurred while it is open', async () => {
  test.skip(process.platform !== 'win32', 'Windows only');
  const { app, page } = await launch('np-acrylic', { fresh: true });
  try {
    await page.evaluate(() => (window as any).idol.settings.set({ transparency: 'off' }));
    const g = await app.evaluate(async ({ BrowserWindow, screen }) => {
      const main = BrowserWindow.getAllWindows()[0];
      main.unmaximize();
      main.setBounds({ x: 200, y: 150, width: 1000, height: 700 });
      const back = new BrowserWindow({ x: 150, y: 100, width: 1100, height: 800, frame: false, show: true, focusable: false });
      await back.loadURL('data:text/html,<body style="margin:0;background:%234080c0"></body>');
      back.setAlwaysOnTop(true, 'floating');
      main.setAlwaysOnTop(true, 'screen-saver');
      main.moveTop();
      return { f: screen.getDisplayNearestPoint({ x: 700, y: 500 }).scaleFactor };
    });
    // an empty spot of Now Playing's header row (right of the window, below the title bar); black page before
    const spot: [number, number] = [Math.round(1100 * g.f), Math.round(260 * g.f)];
    await openNowPlaying(page, 'acrylic');
    const [open] = screenPixels([spot]);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    const [closed] = screenPixels([spot]);
    console.log('now playing acrylic', { open, closed });
    expect(open[2]).toBeGreaterThan(open[0] + 20); // the blue desktop, through acrylic
    expect(Math.max(...closed)).toBeLessThan(20); // opaque again
  } finally {
    await app
      .evaluate(({ BrowserWindow }) => {
        for (const w of BrowserWindow.getAllWindows()) w.setAlwaysOnTop(false);
        BrowserWindow.getAllWindows().slice(1).forEach((w) => w.destroy());
      })
      .catch(() => {});
    await app.close();
  }
});
