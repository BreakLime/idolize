import type { WindowState } from '@shared/ipc';
import { create } from 'zustand';
import { idol } from '@/lib/bridge';

export const useWindowState = create<WindowState>(() => ({ maximized: false, fullscreen: false, focused: true, transparency: 'off', clearWindow: false }));

export async function initWindowState() {
  useWindowState.setState(await idol.window.state());
  idol.on('window:state', (w) => useWindowState.setState(w));
}
