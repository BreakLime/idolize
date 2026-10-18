import { app, BrowserWindow, net, protocol } from 'electron';
import { existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_SCHEME } from '../shared/ipc';
import { registerIpc } from './ipc';
import { mediaSchemePrivileges, registerMediaProtocol } from './mediaProtocol';
import { lumitideSession, secureSessionStore } from './sessionStore';
import { settings } from './settings';
import { TidalHttp } from './tidal/http';
import { setupDesktop } from './desktop';
import { createMainWindow } from './window';

// isolated profiles for tests / parallel dev instances; otherwise the profile of the app's old name (tidal-idol), if
// there is one: its settings and login stay in use
if (process.env.IDOLIZE_USER_DATA) app.setPath('userData', process.env.IDOLIZE_USER_DATA);
else {
  const legacy = join(app.getPath('appData'), 'tidal-idol');
  // ("Local State": Chromium's mark of a profile that has run)
  if (existsSync(legacy) && !existsSync(join(app.getPath('userData'), 'Local State'))) app.setPath('userData', legacy);
}
app.setAppUserModelId('com.breaklime.idolize');

protocol.registerSchemesAsPrivileged([
  mediaSchemePrivileges,
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// another instance owns this profile: exit before anything starts
if (!app.requestSingleInstanceLock()) app.exit(0);

let mainWindow: BrowserWindow | null = null;
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

/** Production renderer: idol://app/<path>, with SPA fallback to index.html for client-side routes. */
function registerAppProtocol() {
  const root = join(import.meta.dirname, '../renderer');
  protocol.handle(APP_SCHEME, (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname);
    const file = normalize(join(root, rel));
    const isFile = file.startsWith(root) && existsSync(file) && statSync(file).isFile();
    // a missing build asset is an error, never the HTML fallback (served as JS it fails silently)
    if (!isFile && rel.startsWith('/assets/')) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(isFile ? file : join(root, 'index.html')).toString());
  });
}

void app.whenReady().then(() => {
  settings.load();
  const store = secureSessionStore();
  const http = new TidalHttp(store);
  // first run only: an explicit logout must not be undone by re-importing lumitide's login
  if (!http.current && store.isPristine() && !process.env.IDOLIZE_NO_IMPORT) {
    const imported = lumitideSession();
    if (imported) http.setSession(imported);
  }

  registerMediaProtocol(http);
  registerAppProtocol();
  mainWindow = createMainWindow(join(import.meta.dirname, '../preload/index.cjs'));
  registerIpc(mainWindow, http);
  setupDesktop(mainWindow);

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  void mainWindow.loadURL(devUrl ?? `${APP_SCHEME}://app/`);
});

app.on('window-all-closed', () => app.quit());
