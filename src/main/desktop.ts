// Windows desktop integration: taskbar thumbnail buttons, tray icon, close-to-tray.
import { app, Menu, nativeImage, Tray, type BrowserWindow, type NativeImage } from 'electron';
import type { MenuCommand, PlaybackStatus } from '../shared/ipc';
import { appIcon, transportIcon, type TransportGlyph } from './raster';
import { settings } from './settings';

let quitting = false;
app.on('before-quit', () => {
  quitting = true;
});

const glyphCache = new Map<TransportGlyph, NativeImage>();
function glyph(g: TransportGlyph): NativeImage {
  let img = glyphCache.get(g);
  if (!img) {
    // 16px at 2× for crisp taskbar buttons on scaled displays
    img = nativeImage.createFromBitmap(transportIcon(g, 32), { width: 32, height: 32, scaleFactor: 2 });
    glyphCache.set(g, img);
  }
  return img;
}

const send = (win: BrowserWindow, c: MenuCommand) => !win.isDestroyed() && win.webContents.send('menu:command', c);

let last: PlaybackStatus = { playing: false, hasNext: false, hasPrevious: false };

export function updateThumbar(win: BrowserWindow, s: PlaybackStatus) {
  last = s;
  if (process.platform !== 'win32' || win.isDestroyed()) return;
  win.setThumbarButtons([
    { tooltip: 'Previous', icon: glyph('previous'), flags: s.hasPrevious ? [] : ['disabled'], click: () => send(win, 'playback:previous') },
    { tooltip: s.playing ? 'Pause' : 'Play', icon: glyph(s.playing ? 'pause' : 'play'), click: () => send(win, 'playback:toggle') },
    { tooltip: 'Next', icon: glyph('next'), flags: s.hasNext ? [] : ['disabled'], click: () => send(win, 'playback:next') },
  ]);
  updateTrayMenu(win);
}

let tray: Tray | null = null;

function trayMenu(win: BrowserWindow) {
  return Menu.buildFromTemplate([
    { label: last.title ? `${last.title} — ${last.artist ?? ''}` : 'Idolize', enabled: false },
    { type: 'separator' },
    { label: last.playing ? 'Pause' : 'Play', click: () => send(win, 'playback:toggle') },
    { label: 'Next', enabled: last.hasNext, click: () => send(win, 'playback:next') },
    { label: 'Previous', enabled: last.hasPrevious, click: () => send(win, 'playback:previous') },
    { type: 'separator' },
    { label: win.isVisible() ? 'Minimize to tray' : 'Show Idolize', click: () => (win.isVisible() ? win.hide() : showWindow(win)) },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function updateTrayMenu(win: BrowserWindow) {
  if (!tray) return;
  tray.setToolTip(last.playing && last.title ? `${last.title} — ${last.artist ?? ''}` : 'Idolize');
  tray.setContextMenu(trayMenu(win));
}

function showWindow(win: BrowserWindow) {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function syncTray(win: BrowserWindow) {
  const want = settings.get().closeToTray;
  if (want && !tray) {
    tray = new Tray(nativeImage.createFromBitmap(appIcon(32, 'bgra'), { width: 32, height: 32, scaleFactor: 2 }));
    tray.on('click', () => showWindow(win));
    updateTrayMenu(win);
  } else if (!want && tray) {
    tray.destroy();
    tray = null;
  }
}

export function setupDesktop(win: BrowserWindow) {
  syncTray(win);
  settings.on('changed', () => syncTray(win));
  win.on('show', () => updateTrayMenu(win));
  win.on('hide', () => updateTrayMenu(win));
  // TIDAL's close-to-tray: closing hides the window while the setting is on (only Quit exits)
  win.on('close', (e) => {
    if (settings.get().closeToTray && !quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  // thumbar buttons are lost when the window is hidden/shown on Windows; re-apply
  win.on('show', () => updateThumbar(win, last));
  win.once('ready-to-show', () => updateThumbar(win, last));
}
