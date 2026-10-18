// Renderer-only display preferences (not part of the main-process Settings file).
import { create } from 'zustand';

/** transparent / acrylic: the desktop behind the window (acrylic: the window turns acrylic while Now Playing is open) */
export type PlayerBackground = 'color' | 'blur' | 'transparent' | 'acrylic';

interface Prefs {
  playerBackground: PlayerBackground;
  /** the sidebar's idol moves with the music */
  dancingLogo: boolean;
  /** Now Playing's Stage toggle: the light show (the default) or the plain cover */
  stageView: boolean;
  /** the stage shows the song's top YouTube comments in its calm parts */
  stageComments: boolean;
}

const DEFAULTS: Prefs = { playerBackground: 'color', dancingLogo: true, stageView: true, stageComments: true };

const KEY = 'idolize:prefs';

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export const usePrefs = create<Prefs>(load);

export function setPrefs(patch: Partial<Prefs>) {
  usePrefs.setState(patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(usePrefs.getState()));
  } catch {
    /* ignore */
  }
}
