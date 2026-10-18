// Main window: frameless (the renderer draws the 30px title bar like TIDAL), persisted bounds,
// optional Win11 acrylic/Mica backdrop or a clear (see-through) window, zoom, mouse back/forward, playback-driven title.
import { app, BrowserWindow, powerSaveBlocker, screen, shell } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MenuCommand, PlaybackStatus, Settings, Transparency, WindowState } from '../shared/ipc';
import { updateThumbar } from './desktop';
import { settings } from './settings';
import { addResizeFrame, setNativeFrame } from './win32';

interface Bounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized?: boolean;
}

const APP_TITLE = 'Idolize';
const WM_SYSCOMMAND = 0x0112;
const SC_MAXIMIZE = 0xf030;
const boundsFile = () => join(app.getPath('userData'), 'window-state.json');

function initialBounds(): Bounds {
  try {
    const b = JSON.parse(readFileSync(boundsFile(), 'utf8')) as Bounds;
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return b.x !== undefined && b.y !== undefined && b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y;
    });
    if (visible) return b;
  } catch {
    /* first run */
  }
  // first run: 85% of the primary work area, centered (same as TIDAL)
  const a = screen.getPrimaryDisplay().workArea;
  const width = Math.round(a.width * 0.85);
  const height = Math.round(a.height * 0.85);
  return { width, height, x: a.x + Math.round((a.width - width) / 2), y: a.y + Math.round((a.height - height) / 2) };
}

/** Clear needs a window created transparent (Electron can't switch it later); Off/Acrylic/Mica also work on one. */
let clearWindow = false;
let applied: Transparency = 'off';
/** Now Playing with the Acrylic background is open: acrylic whatever the setting */
let npAcrylic = false;

export function applyTransparency(win: BrowserWindow, s: Settings) {
  if (process.platform !== 'win32') return;
  // Clear chosen on a standard window: keep the current look until the restart
  const mode = s.transparency === 'clear' && !clearWindow ? applied : s.transparency;
  applied = mode;
  if (npAcrylic) {
    win.setBackgroundColor('#00000000');
    win.setBackgroundMaterial('acrylic');
    return;
  }
  // (a clear window stays see-through in Off: the page paints it opaque and Windows rounds its corners)
  win.setBackgroundColor(mode === 'off' && !clearWindow ? '#000000' : '#00000000');
  // a clear window takes 'auto' (its default) for no backdrop: 'none' makes Windows paint its own (light theme: white)
  win.setBackgroundMaterial(mode === 'acrylic' || mode === 'mica' ? mode : clearWindow ? 'auto' : 'none');
}

export function setNowPlayingAcrylic(win: BrowserWindow, on: boolean) {
  npAcrylic = on;
  applyTransparency(win, settings.get());
}

export function windowState(win: BrowserWindow): WindowState {
  return { maximized: win.isMaximized(), fullscreen: win.isFullScreen(), focused: win.isFocused(), transparency: applied, clearWindow };
}

export function createMainWindow(preload: string): BrowserWindow {
  const s = settings.get();
  const b = initialBounds();
  clearWindow = process.platform === 'win32' && s.transparency === 'clear';
  const win = new BrowserWindow({
    ...b,
    minWidth: 200, // as TIDAL
    minHeight: 200,
    frame: false,
    show: false,
    title: APP_TITLE,
    transparent: clearWindow,
    backgroundColor: clearWindow ? '#00000000' : '#000000',
    icon: join(app.getAppPath(), 'resources/icon.png'),
    webPreferences: {
      preload,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  // the resize frame first: setting the style re-extends the DWM frame, which applyTransparency resets
  if (clearWindow) addResizeFrame(win);
  applyTransparency(win, s);
  if (clearWindow) {
    const frame = () => !win.isDestroyed() && setNativeFrame(win, !win.isMaximized() && !win.isFullScreen());
    frame();
    win.on('maximize', frame);
    win.on('unmaximize', frame);
    win.on('enter-full-screen', frame);
    win.on('leave-full-screen', frame);
  }
  if (b.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  if (clearWindow) {
    // a title-bar double-click, Win+Up or Snap to the top edge send SC_MAXIMIZE, which Electron ignores for a transparent
    // window (Windows still sees it unmaximized, so a second double-click sends SC_MAXIMIZE again: toggle)
    win.hookWindowMessage(WM_SYSCOMMAND, (wParam) => {
      if ((wParam.readInt32LE(0) & 0xfff0) === SC_MAXIMIZE) setImmediate(() => !win.isDestroyed() && (win.isMaximized() ? win.unmaximize() : win.maximize()));
    });
  }

  const send = () => !win.isDestroyed() && win.webContents.send('window:state', windowState(win));
  win.on('maximize', send);
  win.on('unmaximize', send);
  win.on('enter-full-screen', send);
  win.on('leave-full-screen', send);
  win.on('focus', send);
  win.on('blur', send);

  const saveBounds = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    const nb = win.getNormalBounds();
    writeFileSync(boundsFile(), JSON.stringify({ ...nb, maximized: win.isMaximized() }));
  };
  let t: NodeJS.Timeout | undefined;
  const scheduleSave = () => {
    clearTimeout(t);
    t = setTimeout(saveBounds, 400);
  };
  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('maximize', scheduleSave);
  win.on('unmaximize', scheduleSave);
  win.on('close', saveBounds);

  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomLevel(settings.get().zoom);
    // a reload while Now Playing (Acrylic) was open never closed it
    if (npAcrylic) setNowPlayingAcrylic(win, false);
  });
  settings.on('changed', (next) => {
    if (win.isDestroyed()) return;
    applyTransparency(win, next);
    send();
    win.webContents.setZoomLevel(next.zoom);
  });

  // mouse buttons 4/5
  win.on('app-command', (_e, cmd) => {
    const map: Record<string, MenuCommand> = { 'browser-backward': 'navigate:back', 'browser-forward': 'navigate:forward' };
    if (map[cmd]) win.webContents.send('menu:command', map[cmd]);
  });

  // external links open in the default browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // and the main frame never navigates away from the app (links, dropped files/URLs): the preload's
  // window.idol bridge (authenticated API, settings) must only ever be exposed to our own UI
  const isAppUrl = (url: string) => {
    const dev = process.env.ELECTRON_RENDERER_URL;
    return url.startsWith('idol://app/') || (!!dev && url.startsWith(dev));
  };
  win.webContents.on('will-navigate', (e, url) => {
    if (isAppUrl(url)) return;
    e.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });
  win.webContents.on('will-redirect', (e, url) => {
    if (!isAppUrl(url)) e.preventDefault();
  });
  return win;
}

let blocker: number | null = null;
let lastStatus: PlaybackStatus = { playing: false, hasPrevious: false, hasNext: false };
/** the renderer's latest player state (the hamburger menu shows it) */
export const playbackStatus = () => lastStatus;

export function setPlaybackStatus(win: BrowserWindow, s: PlaybackStatus) {
  lastStatus = s;
  win.setTitle(s.playing && s.title ? `${s.title} - ${s.artist ?? ''}` : APP_TITLE);
  updateThumbar(win, s);
  if (s.playing && blocker === null) blocker = powerSaveBlocker.start('prevent-app-suspension');
  if (!s.playing && blocker !== null) {
    powerSaveBlocker.stop(blocker);
    blocker = null;
  }
}
