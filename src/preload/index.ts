import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type BridgeEvents, type IdolBridge } from '../shared/ipc';

type IpcResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

export class BridgeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function unwrap<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const r = await p;
  if (r.ok) return r.data;
  throw new BridgeError(r.status, r.message);
}

const bridge: IdolBridge = {
  platform: process.platform,
  api: { request: (req) => unwrap(ipcRenderer.invoke(IPC.apiRequest, req)) },
  auth: {
    state: () => ipcRenderer.invoke(IPC.authState),
    login: () => unwrap(ipcRenderer.invoke(IPC.authLogin)),
    logout: () => ipcRenderer.invoke(IPC.authLogout),
  },
  window: {
    minimize: () => ipcRenderer.send(IPC.winMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.winToggleMax),
    close: () => ipcRenderer.send(IPC.winClose),
    state: () => ipcRenderer.invoke(IPC.winState),
    openMenu: (x, y) => ipcRenderer.send(IPC.winMenu, x, y),
    setPlaybackStatus: (s) => ipcRenderer.send(IPC.winPlayback, s),
    setNowPlayingAcrylic: (on) => ipcRenderer.send(IPC.winNpAcrylic, on),
  },
  app: { relaunch: () => ipcRenderer.send(IPC.appRelaunch) },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  },
  media: { prepare: (trackId, quality) => unwrap(ipcRenderer.invoke(IPC.mediaPrepare, trackId, quality)) },
  crowd: { comments: (q) => ipcRenderer.invoke(IPC.crowdComments, q) },
  on(channel, cb) {
    const listener = (_e: unknown, payload: BridgeEvents[typeof channel]) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('idol', bridge);
