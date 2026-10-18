import { app, ipcMain, type BrowserWindow } from 'electron';
import { IPC, type ApiRequest, type AudioQuality, type AuthState, type CrowdQuery, type PlaybackStatus, type Settings } from '../shared/ipc';
import { loginWithWindow } from './login';
import { prepareStream } from './mediaProtocol';
import { popupAppMenu } from './menu';
import { settings } from './settings';
import { ApiError, type TidalHttp } from './tidal/http';
import { setNowPlayingAcrylic, setPlaybackStatus, windowState } from './window';
import { crowd } from './youtube';

export type IpcResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function wrap<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, status: e instanceof ApiError ? e.status : 0, message: e instanceof Error ? e.message : String(e) };
  }
}

export function registerIpc(win: BrowserWindow, http: TidalHttp) {
  const authState = (): AuthState => {
    const s = http.current;
    return s ? { loggedIn: true, userId: s.userId, countryCode: s.countryCode } : { loggedIn: false };
  };
  http.onSessionChange = () => !win.isDestroyed() && win.webContents.send('auth:changed', authState());

  ipcMain.handle(IPC.apiRequest, (_e, req: ApiRequest) => wrap(() => http.request(req)));

  ipcMain.handle(IPC.authState, () => authState());
  ipcMain.handle(IPC.authLogin, () =>
    wrap(async () => {
      http.setSession(await loginWithWindow(win));
      return authState();
    }),
  );
  ipcMain.handle(IPC.authLogout, () => http.setSession(null));

  ipcMain.on(IPC.winMinimize, () => win.minimize());
  ipcMain.on(IPC.winToggleMax, () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  // close-to-tray is handled by the window's close event (desktop.ts)
  ipcMain.on(IPC.winClose, () => win.close());
  ipcMain.handle(IPC.winState, () => windowState(win));
  ipcMain.on(IPC.winMenu, (_e, x: number, y: number) => popupAppMenu(win, x, y));
  ipcMain.on(IPC.winPlayback, (_e, s: PlaybackStatus) => setPlaybackStatus(win, s));
  ipcMain.on(IPC.winNpAcrylic, (_e, on: boolean) => setNowPlayingAcrylic(win, !!on));
  // Electron's relaunch (its relauncher outlives us; child processes of ours don't). The portable build starts its
  // launcher again: the unpacked app it ran is deleted when it exits, and the new one clears and unpacks it afresh.
  ipcMain.on(IPC.appRelaunch, () => {
    const portable = process.env.PORTABLE_EXECUTABLE_FILE;
    app.relaunch(portable ? { execPath: portable, args: [] } : undefined);
    app.quit();
  });

  ipcMain.handle(IPC.settingsGet, () => settings.get());
  ipcMain.handle(IPC.settingsSet, (_e, patch: Partial<Settings>) => settings.set(patch));

  ipcMain.handle(IPC.mediaPrepare, (_e, trackId: number, quality?: AudioQuality) =>
    wrap(() => prepareStream(http, trackId, quality ?? settings.get().streamingQuality)),
  );

  ipcMain.handle(IPC.crowdComments, (_e, q: CrowdQuery) => crowd(q));
  settings.on('changed', (s) => !win.isDestroyed() && win.webContents.send('settings:changed', s));

  app.on('before-quit', () => ipcMain.removeAllListeners());
}
