import { app } from 'electron';
import { EventEmitter } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Settings } from '../shared/ipc';

export function defaultSettings(): Settings {
  return {
    // Max: the desktop token gets 24-bit FLAC; tracks without hi-res fall back to 16-bit
    streamingQuality: 'HI_RES_LOSSLESS',
    // see-through without blur, the desktop under a 75 % tint
    transparency: 'clear',
    transparencyTint: 0.75,
    loudnessNormalization: false,
    normalizationMode: 'track',
    explicitContent: true,
    aiContent: true,
    autoplay: true,
    closeToTray: false,
    zoom: 0,
    sidebarCollapsed: false,
  };
}

class SettingsStore extends EventEmitter<{ changed: [Settings] }> {
  private file = '';
  private data!: Settings;

  load() {
    this.file = join(app.getPath('userData'), 'settings.json');
    let stored: Partial<Settings> = {};
    try {
      stored = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Settings>;
    } catch {
      /* first run */
    }
    this.data = { ...defaultSettings(), ...stored };
    return this.data;
  }

  get(): Settings {
    return this.data;
  }

  set(patch: Partial<Settings>): Settings {
    this.data = { ...this.data, ...patch };
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    this.emit('changed', this.data);
    return this.data;
  }
}

export const settings = new SettingsStore();
