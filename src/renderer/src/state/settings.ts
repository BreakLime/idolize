import type { Settings } from '@shared/ipc';
import { create } from 'zustand';
import { idol } from '@/lib/bridge';

export const useSettings = create<{ settings: Settings | null }>(() => ({ settings: null }));

export async function initSettings() {
  useSettings.setState({ settings: await idol.settings.get() });
  idol.on('settings:changed', (settings) => useSettings.setState({ settings }));
}

export const updateSettings = (patch: Partial<Settings>) => idol.settings.set(patch);
