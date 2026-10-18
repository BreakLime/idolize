// Session persistence encrypted with the OS keychain (DPAPI on Windows) via safeStorage.
import { app, safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fromLumitide, type LumitideSession, type Session } from './tidal/auth';
import type { SessionStore } from './tidal/http';

export function secureSessionStore(): SessionStore {
  const file = join(app.getPath('userData'), 'session.bin');
  return {
    load() {
      if (!existsSync(file)) return null;
      const raw = readFileSync(file);
      try {
        const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
        return JSON.parse(text) as Session;
      } catch {
        return null;
      }
    },
    save(s) {
      const text = JSON.stringify(s);
      writeFileSync(file, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : text);
    },
    clear() {
      // a marker (not a deleted file) so the lumitide import doesn't log the user back in after a logout
      writeFileSync(file, 'null');
    },
    isPristine() {
      return !existsSync(file);
    },
  };
}

/** lumitide (a terminal TIDAL client) uses the same desktop client id, so its login can bootstrap ours. */
export function lumitideSession(): Session | null {
  const file = join(homedir(), '.config/lumitide/session.json');
  try {
    return fromLumitide(JSON.parse(readFileSync(file, 'utf8')) as LumitideSession);
  } catch {
    return null;
  }
}
