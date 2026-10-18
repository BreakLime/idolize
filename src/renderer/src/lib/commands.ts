// App commands from the hamburger menu (main process) and keyboard shortcuts (TIDAL's Windows bindings).
import type { MenuCommand } from '@shared/ipc';
import { idol } from './bridge';

const handlers = new Map<MenuCommand, Set<() => void>>();

export function onCommand(c: MenuCommand, fn: () => void): () => void {
  let set = handlers.get(c);
  if (!set) handlers.set(c, (set = new Set()));
  set.add(fn);
  return () => set!.delete(fn);
}

export function runCommand(c: MenuCommand) {
  handlers.get(c)?.forEach((fn) => fn());
}

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

function shortcut(e: KeyboardEvent): MenuCommand | 'zoom-in' | 'zoom-out' | 'zoom-reset' | null {
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key;
  // inside text fields Ctrl(+Shift)+Arrow are word jumps/selections, never playback shortcuts
  if (k.startsWith('Arrow') && isEditable(e.target)) return null;
  if (ctrl && e.shiftKey && k === 'ArrowLeft') return 'playback:seek-backward';
  if (ctrl && e.shiftKey && k === 'ArrowRight') return 'playback:seek-forward';
  if (ctrl && e.shiftKey && (k === 'L' || k === 'l')) return 'app:logout';
  if (ctrl && !e.shiftKey) {
    switch (k.toLowerCase()) {
      case 'arrowleft':
        return 'playback:previous';
      case 'arrowright':
        return 'playback:next';
      case 'arrowup':
        return 'playback:volume-up';
      case 'arrowdown':
        return 'playback:volume-down';
      case 's':
        return 'playback:shuffle';
      case 'r':
        return 'playback:repeat';
      case 'f':
        return 'navigate:search';
      case 'h':
        return 'navigate:home';
      case 'p':
        return 'navigate:settings';
      case '+':
      case '=':
        return 'zoom-in';
      case '-':
        return 'zoom-out';
      case '0':
        return 'zoom-reset';
    }
  }
  if (isEditable(e.target)) return null;
  if (!ctrl && k === ' ') return 'playback:toggle';
  if (!ctrl && k === 'Backspace') return e.shiftKey ? 'navigate:forward' : 'navigate:back';
  return null;
}

export function initCommands() {
  idol.on('menu:command', runCommand);
  window.addEventListener('keydown', async (e) => {
    const c = shortcut(e);
    if (!c) return;
    e.preventDefault();
    if (c.startsWith('zoom')) {
      const s = await idol.settings.get();
      const zoom = c === 'zoom-reset' ? 0 : Math.max(-5, Math.min(5, s.zoom + (c === 'zoom-in' ? 0.5 : -0.5)));
      await idol.settings.set({ zoom });
      return;
    }
    runCommand(c as MenuCommand);
  });
  // mouse back/forward buttons: Chromium already navigates history on them (and keyboards' browser keys arrive
  // as main-process app-commands), so a renderer handler here would move two entries per press
}
