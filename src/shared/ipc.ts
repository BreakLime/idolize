// The typed contract between main and renderer. The preload exposes `window.idol: IdolBridge`.

export type ApiHost = 'v1' | 'v2' | 'openapi' | 'login';

export interface ApiRequest {
  host: ApiHost;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON body, or a flat record sent as x-www-form-urlencoded when `form` is set */
  body?: unknown;
  form?: boolean;
  headers?: Record<string, string>;
}

export interface ApiErrorInfo {
  status: number;
  message: string;
}

export type AudioQuality = 'LOW' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';
/** 'clear': see-through without blur (a transparent window, chosen when the window is created) */
export type Transparency = 'off' | 'acrylic' | 'mica' | 'clear';

export interface Settings {
  streamingQuality: AudioQuality;
  transparency: Transparency;
  /** 0..1 opacity of the dark tint over the acrylic/mica backdrop or the clear window */
  transparencyTint: number;
  loudnessNormalization: boolean;
  normalizationMode: 'track' | 'album';
  explicitContent: boolean;
  /** "Allow AI content": tracks of AI-labeled releases are greyed out and skipped when off */
  aiContent: boolean;
  autoplay: boolean;
  closeToTray: boolean;
  zoom: number;
  sidebarCollapsed: boolean;
}

export interface WindowState {
  maximized: boolean;
  fullscreen: boolean;
  focused: boolean;
  /** what the window shows now: Clear chosen on a standard window waits for the restart */
  transparency: Transparency;
  /** created see-through for Clear: Windows gives it no shadow, corners or snapping, and switching to or from Clear takes a restart */
  clearWindow: boolean;
}

export interface AuthState {
  loggedIn: boolean;
  userId?: number;
  countryCode?: string;
}

/** What the renderer needs to know about a stream before/while playing it. */
export interface StreamMeta {
  trackId: number;
  url: string; // idol-media:// URL for <audio src>
  audioQuality: string;
  codec: string;
  bitDepth?: number;
  sampleRate?: number;
  trackReplayGain?: number;
  albumReplayGain?: number;
  trackPeakAmplitude?: number;
  albumPeakAmplitude?: number;
}

export interface PlaybackStatus {
  playing: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  /** for the hamburger menu's Play/Pause label, Repeat radio and Shuffle checkbox */
  hasTrack?: boolean;
  shuffle?: boolean;
  repeat?: 'off' | 'all' | 'one';
  title?: string;
  artist?: string;
}

// ── The crowd: a song's top YouTube comments, for the stage ──────────────────────────────────────────────────────

export interface CrowdQuery {
  trackId: number;
  artist: string;
  title: string;
  /** e.g. "Radio Edit", "Remix" */
  version?: string | null;
  /** seconds */
  duration: number;
}

export interface CrowdComment {
  author: string;
  text: string;
  likes: number;
  /** when it was written, about (ms; YouTube only says "5 years ago") */
  date?: number;
}

export interface Crowd {
  videoId: string;
  videoTitle: string;
  comments: CrowdComment[];
}

export type MenuCommand =
  | 'navigate:home'
  | 'navigate:explore'
  | 'navigate:back'
  | 'navigate:forward'
  | 'navigate:search'
  | 'navigate:settings'
  | 'playback:toggle'
  | 'playback:next'
  | 'playback:previous'
  | 'playback:seek-forward'
  | 'playback:seek-backward'
  | 'playback:shuffle'
  | 'playback:repeat'
  | 'playback:repeat-off'
  | 'playback:repeat-all'
  | 'playback:repeat-one'
  | 'playback:volume-up'
  | 'playback:volume-down'
  | 'app:logout'
  | 'app:about';

export interface BridgeEvents {
  'window:state': WindowState;
  'settings:changed': Settings;
  'auth:changed': AuthState;
  'menu:command': MenuCommand;
}

export interface IdolBridge {
  platform: string;
  api: { request<T = unknown>(req: ApiRequest): Promise<T> };
  auth: {
    state(): Promise<AuthState>;
    login(): Promise<AuthState>;
    logout(): Promise<void>;
  };
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    state(): Promise<WindowState>;
    openMenu(x: number, y: number): void;
    setPlaybackStatus(s: PlaybackStatus): void;
    /** Now Playing's Acrylic background: the window turns acrylic while the view is open */
    setNowPlayingAcrylic(on: boolean): void;
  };
  app: {
    /** quits and starts again (switching to or from the Clear window) */
    relaunch(): void;
  };
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
  };
  media: {
    /** resolves playback info (cached in main) and returns the idol-media:// URL to play */
    prepare(trackId: number, quality?: AudioQuality): Promise<StreamMeta>;
  };
  crowd: {
    /** the song's top YouTube comments (null: no video found, or YouTube couldn't be read: none shown) */
    comments(q: CrowdQuery): Promise<Crowd | null>;
  };
  on<K extends keyof BridgeEvents>(channel: K, cb: (payload: BridgeEvents[K]) => void): () => void;
}

export const IPC = {
  apiRequest: 'api:request',
  authState: 'auth:state',
  authLogin: 'auth:login',
  authLogout: 'auth:logout',
  authToken: 'auth:token',
  winMinimize: 'window:minimize',
  winToggleMax: 'window:toggle-maximize',
  winClose: 'window:close',
  winState: 'window:get-state',
  winMenu: 'window:open-menu',
  winPlayback: 'window:playback-status',
  appRelaunch: 'app:relaunch',
  winNpAcrylic: 'window:now-playing-acrylic',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  mediaPrepare: 'media:prepare',
  crowdComments: 'crowd:comments',
} as const;

export const MEDIA_SCHEME = 'idol-media';
export const APP_SCHEME = 'idol';
