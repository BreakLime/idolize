// Authenticated TIDAL API client. Lives in the main process so tokens never reach the renderer.
// Optional fixture mode (IDOLIZE_FIXTURES=record:<dir> | replay:<dir>) makes UI work deterministic and offline.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApiHost, ApiRequest } from '../../shared/ipc';
import { isExpired, refreshSession, TIDAL_UA, TokenError, type Session } from './auth';

export type { ApiHost, ApiRequest };

const BASES: Record<ApiHost, string> = {
  v1: 'https://api.tidal.com/v1',
  v2: 'https://api.tidal.com/v2',
  openapi: 'https://openapi.tidal.com/v2',
  login: 'https://login.tidal.com',
};
export const CLIENT_VERSION = '2026.10.14';

export class ApiError extends Error {
  constructor(
    public status: number,
    public url: string,
    public body: string,
  ) {
    super(`TIDAL API ${status} on ${url}: ${body.slice(0, 300)}`);
  }
}

export interface SessionStore {
  load(): Session | null;
  save(s: Session): void;
  /** logs out; leaves a marker so an explicit logout is remembered */
  clear(): void;
  /** true until a session was ever saved or cleared (first run) */
  isPristine(): boolean;
}

type FixtureMode = { kind: 'record' | 'replay'; dir: string } | null;

function parseFixtureMode(v = process.env.IDOLIZE_FIXTURES): FixtureMode {
  const m = v?.match(/^(record|replay):(.+)$/);
  return m ? { kind: m[1] as 'record' | 'replay', dir: m[2] } : null;
}

export function buildUrl(req: ApiRequest): string {
  const url = new URL(BASES[req.host] + (req.path.startsWith('/') ? req.path : `/${req.path}`));
  for (const [k, v] of Object.entries(req.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  return url.toString();
}

/** Stable key for fixtures: method + url with sorted query, ignoring volatile params. */
export function fixtureKey(method: string, url: string): string {
  const u = new URL(url);
  const q = [...u.searchParams].filter(([k]) => k !== 'sessionId').sort(([a], [b]) => a.localeCompare(b));
  return `${method} ${u.origin}${u.pathname}?${new URLSearchParams(q)}`;
}

export class TidalHttp {
  private session: Session | null;
  private refreshing: Promise<Session> | null = null;
  private fixtures: FixtureMode;
  onSessionChange?: (s: Session | null) => void;

  constructor(
    private store: SessionStore,
    fixtures: FixtureMode = parseFixtureMode(),
  ) {
    this.session = store.load();
    this.fixtures = fixtures;
    if (fixtures) mkdirSync(fixtures.dir, { recursive: true });
  }

  get current(): Session | null {
    return this.session;
  }

  setSession(s: Session | null) {
    this.session = s;
    if (s) this.store.save(s);
    else this.store.clear();
    this.onSessionChange?.(s);
  }

  /** Returns a session with a valid access token, refreshing if needed. */
  async ensureSession(force = false): Promise<Session> {
    if (this.fixtures?.kind === 'replay')
      return this.session ?? { accessToken: '', refreshToken: '', expiresAt: Infinity, userId: 0, countryCode: 'BE', tokenType: 'Bearer' };
    const s = this.session;
    if (!s) throw new ApiError(401, 'session', 'Not logged in');
    if (!force && !isExpired(s)) return s;
    this.refreshing ??= refreshSession(s)
      .then((next) => {
        // logged out / in as someone else while refreshing: don't resurrect the old session
        if (this.session !== s) {
          if (this.session) return this.session;
          throw new ApiError(401, 'session', 'Not logged in');
        }
        this.setSession(next);
        return next;
      })
      .catch((e: unknown) => {
        // the refresh token is dead (revoked, password change): log out so the UI shows the login screen
        if (e instanceof TokenError && (e.status === 400 || e.status === 401) && this.session === s) {
          this.setSession(null);
          throw new ApiError(401, 'session', 'Session expired, please log in again');
        }
        throw e;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  async request<T = unknown>(req: ApiRequest): Promise<T> {
    const method = req.method ?? 'GET';
    const url = buildUrl(req);
    const key = fixtureKey(method, url);
    const fixtureFile = this.fixtures && join(this.fixtures.dir, `${createHash('sha1').update(key).digest('hex').slice(0, 16)}.json`);

    if (this.fixtures?.kind === 'replay' && fixtureFile) {
      if (!existsSync(fixtureFile)) throw new ApiError(599, url, `fixture missing: ${key}`);
      const f = JSON.parse(readFileSync(fixtureFile, 'utf8')) as { status: number; body: T };
      if (f.status >= 400) throw new ApiError(f.status, url, JSON.stringify(f.body));
      return f.body;
    }

    const doFetch = async (s: Session) => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${s.accessToken}`,
        'User-Agent': TIDAL_UA,
        Accept: 'application/json',
        ...(req.host !== 'v1' ? { 'x-tidal-client-version': CLIENT_VERSION } : {}),
        ...req.headers,
      };
      let body: BodyInit | undefined;
      if (req.body !== undefined) {
        if (req.form) {
          body = new URLSearchParams(req.body as Record<string, string>);
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else {
          body = JSON.stringify(req.body);
          headers['Content-Type'] ??= req.host === 'openapi' ? 'application/vnd.api+json' : 'application/json';
        }
      }
      return fetch(url, { method, headers, body });
    };

    let res = await doFetch(await this.ensureSession());
    if (res.status === 401) res = await doFetch(await this.ensureSession(true));
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    if (this.fixtures?.kind === 'record' && fixtureFile && method === 'GET')
      writeFileSync(fixtureFile, JSON.stringify({ key, status: res.status, body: parsed }));
    if (!res.ok) throw new ApiError(res.status, url, text);
    return parsed as T;
  }
}

/** Plain JSON-file session store (used by scripts/tests; the app wraps this with safeStorage). */
export function fileSessionStore(path: string): SessionStore {
  return {
    load: () => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Session) : null),
    save: (s) => writeFileSync(path, JSON.stringify(s, null, 2)),
    clear: () => writeFileSync(path, 'null'),
    isPristine: () => !existsSync(path),
  };
}
