// PKCE login inside an Electron window. The tidal://login/auth redirect is caught in-process,
// so unlike lumitide no registry handler is needed and the real TIDAL app is never launched.
import { BrowserWindow, session } from 'electron';
import { codeFromRedirect, exchangeCode, startPkceLogin, TIDAL_UA, type Session } from './tidal/auth';

const PARTITION = 'persist:tidal-login';
let loginSessionReady = false;
/** the login attempt currently waiting for its code (the protocol handler outlives single attempts) */
let activeOnCode: ((url: string) => void) | null = null;

export function loginWithWindow(parent: BrowserWindow): Promise<Session> {
  const login = startPkceLogin();
  const ses = session.fromPartition(PARTITION);
  if (!loginSessionReady) {
    // last line of defence: any tidal:// request in this session is swallowed here instead of reaching the OS
    ses.protocol.handle('tidal', (req) => {
      activeOnCode?.(req.url);
      return new Response('', { status: 204 });
    });
    ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission !== 'openExternal'));
    loginSessionReady = true;
  }

  const win = new BrowserWindow({
    parent,
    modal: true,
    width: 520,
    height: 760,
    title: 'Log in to TIDAL',
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true },
  });

  return new Promise<Session>((resolve, reject) => {
    let done = false;
    const onCode = (url: string) => {
      const code = codeFromRedirect(url);
      if (!code || done) return;
      done = true;
      activeOnCode = null;
      if (!win.isDestroyed()) win.destroy();
      exchangeCode(code, login).then(resolve, reject);
    };
    activeOnCode = onCode;
    const intercept = (e: { preventDefault(): void }, url: string) => {
      if (url.startsWith('tidal:')) {
        e.preventDefault();
        onCode(url);
      }
    };
    win.webContents.on('will-redirect', intercept);
    win.webContents.on('will-navigate', intercept);
    win.webContents.on('will-frame-navigate', (e) => intercept(e, e.url));
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('tidal:')) onCode(url);
      return { action: 'deny' };
    });
    win.on('closed', () => {
      if (activeOnCode === onCode) activeOnCode = null;
      if (!done) reject(new Error('Login window closed'));
    });
    void win.loadURL(login.url, { userAgent: TIDAL_UA });
  });
}
