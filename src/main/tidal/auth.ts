// TIDAL desktop-client auth (PKCE), ported from lumitide src/auth.rs (Windows path).
// The desktop client id issues "at": "INTERNAL" tokens, which unlock LOSSLESS FLAC.
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const CLIENT_ID = 'mhPVJJEBNRzVjr2p';
export const SCOPE = 'r_usr w_usr';
export const REDIRECT_URI = 'tidal://login/auth';
const AUTH_BASE = 'https://auth.tidal.com/v1/oauth2';
const LOGIN_BASE = 'https://login.tidal.com';

export const TIDAL_UA =
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) TIDAL/2.43.2 Chrome/150.0.7871.129 Electron/43.2.0 Safari/537.36';

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
  userId: number;
  countryCode: string;
  tokenType: string;
  clientUniqueKey?: string;
}

export const isExpired = (s: Session, skewMs = 60_000) => Date.now() >= s.expiresAt - skewMs;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  user?: { userId: number; countryCode: string };
  user_id?: number;
}

function toSession(data: TokenResponse, fallbackRefresh: string, prev?: Partial<Session>): Session {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || fallbackRefresh,
    expiresAt: Date.now() + data.expires_in * 1000,
    userId: data.user?.userId ?? data.user_id ?? prev?.userId ?? 0,
    countryCode: data.user?.countryCode ?? prev?.countryCode ?? 'US',
    tokenType: data.token_type ?? 'Bearer',
    clientUniqueKey: prev?.clientUniqueKey,
  };
}

/** Token endpoint failure; 400/401 mean the grant/refresh token is no longer valid. */
export class TokenError extends Error {
  constructor(
    public status: number,
    body: string,
  ) {
    super(`Token request failed: ${status} ${body.slice(0, 200)}`);
  }
}

async function postToken(form: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': TIDAL_UA },
    body: new URLSearchParams(form),
  });
  if (!res.ok) throw new TokenError(res.status, await res.text().catch(() => ''));
  return (await res.json()) as TokenResponse;
}

export async function refreshSession(prev: Session): Promise<Session> {
  const data = await postToken({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: prev.refreshToken,
    scope: SCOPE,
  });
  return toSession(data, prev.refreshToken, prev);
}

// ── PKCE login ───────────────────────────────────────────────────────────────

export interface PkceLogin {
  url: string;
  verifier: string;
  clientUniqueKey: string;
}

export function startPkceLogin(): PkceLogin {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const clientUniqueKey = randomUUID();
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    client_unique_key: clientUniqueKey,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
  });
  return { url: `${LOGIN_BASE}/authorize?${q}`, verifier, clientUniqueKey };
}

export function codeFromRedirect(url: string): string | null {
  if (!url.startsWith(REDIRECT_URI)) return null;
  return new URL(url.replace(/^tidal:/, 'https:')).searchParams.get('code');
}

export async function exchangeCode(code: string, login: PkceLogin): Promise<Session> {
  const data = await postToken({
    client_id: CLIENT_ID,
    client_unique_key: login.clientUniqueKey,
    code,
    code_verifier: login.verifier,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
  });
  return toSession(data, '', { clientUniqueKey: login.clientUniqueKey });
}

// ── lumitide session import ──────────────────────────────────────────────────

/** Shape of ~/.config/lumitide/session.json */
export interface LumitideSession {
  access_token: string;
  refresh_token: string;
  expiry_time: string;
  user_id: number;
  country_code: string;
  token_type?: string;
}

export const fromLumitide = (l: LumitideSession): Session => ({
  accessToken: l.access_token,
  refreshToken: l.refresh_token,
  expiresAt: Date.parse(l.expiry_time),
  userId: l.user_id,
  countryCode: l.country_code,
  tokenType: l.token_type ?? 'Bearer',
});

export const toLumitide = (s: Session): LumitideSession => ({
  access_token: s.accessToken,
  refresh_token: s.refreshToken,
  expiry_time: new Date(s.expiresAt).toISOString(),
  user_id: s.userId,
  country_code: s.countryCode,
  token_type: s.tokenType,
});
