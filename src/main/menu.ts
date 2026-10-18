// The hamburger menu in the title bar. Mirrors TIDAL's Windows menu (File, Navigation, Playback, View, Help).
// Accelerators are displayed only: the renderer handles keys itself so text fields keep Backspace etc.
import { Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import type { MenuCommand } from '../shared/ipc';
import { settings } from './settings';
import { playbackStatus } from './window';

export function popupAppMenu(win: BrowserWindow, x: number, y: number) {
  const cmd = (c: MenuCommand) => () => {
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send('menu:command', c);
  };
  const item = (label: string, c: MenuCommand, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    registerAccelerator: false,
    click: cmd(c),
  });
  const zoom = settings.get().zoom;
  const ps = playbackStatus();
  const repeatItem = (label: string, mode: 'off' | 'all' | 'one'): MenuItemConstructorOptions => ({
    label,
    type: 'radio',
    checked: (ps.repeat ?? 'off') === mode,
    enabled: !!ps.hasTrack,
    click: cmd(`playback:repeat-${mode}`),
  });
  const setZoom = (z: number) => () => settings.set({ zoom: Math.max(-5, Math.min(5, z)) });

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        item('Settings', 'navigate:settings', 'Ctrl+P'),
        { type: 'separator' },
        item('Log out', 'app:logout', 'Shift+Ctrl+L'),
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Navigation',
      submenu: [
        item('Home', 'navigate:home', 'Ctrl+H'),
        item('Back', 'navigate:back', 'Backspace'),
        item('Forward', 'navigate:forward', 'Shift+Backspace'),
        item('Search', 'navigate:search', 'Ctrl+F'),
      ],
    },
    {
      label: 'Playback',
      submenu: [
        // TIDAL: one item, Play or Pause by state; transport items disabled without something to act on
        { ...item(ps.playing ? 'Pause' : 'Play', 'playback:toggle'), enabled: !!ps.hasTrack },
        { ...item('Previous', 'playback:previous', 'Ctrl+Left'), enabled: !!ps.hasTrack && ps.hasPrevious },
        { ...item('Next', 'playback:next', 'Ctrl+Right'), enabled: !!ps.hasTrack && ps.hasNext },
        { ...item('Seek back', 'playback:seek-backward', 'Shift+Ctrl+Left'), enabled: !!ps.hasTrack },
        { ...item('Seek forward', 'playback:seek-forward', 'Shift+Ctrl+Right'), enabled: !!ps.hasTrack },
        { type: 'separator' },
        { label: 'Repeat', submenu: [repeatItem('Repeat off', 'off'), repeatItem('Repeat all', 'all'), repeatItem('Repeat one', 'one')] },
        { ...item('Shuffle', 'playback:shuffle', 'Ctrl+S'), type: 'checkbox', checked: !!ps.shuffle, enabled: !!ps.hasTrack },
        { type: 'separator' },
        item('Volume up', 'playback:volume-up', 'Ctrl+Up'),
        item('Volume down', 'playback:volume-down', 'Ctrl+Down'),
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', click: () => win.webContents.reload() },
        { label: 'Zoom In', accelerator: 'Ctrl+Plus', registerAccelerator: false, enabled: zoom < 5, click: setZoom(zoom + 0.5) },
        { label: 'Zoom Out', accelerator: 'Ctrl+-', registerAccelerator: false, enabled: zoom > -5, click: setZoom(zoom - 0.5) },
        { label: 'Zoom Reset', accelerator: 'Ctrl+0', registerAccelerator: false, enabled: zoom !== 0, click: setZoom(0) },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', accelerator: 'Ctrl+Shift+I', click: () => win.webContents.toggleDevTools() },
      ],
    },
    {
      label: 'Help',
      submenu: [
        item('About Idolize', 'app:about'),
        { label: 'TIDAL Support', click: () => void shell.openExternal('https://support.tidal.com/hc/en-us') },
      ],
    },
  ];
  Menu.buildFromTemplate(template).popup({ window: win, x: Math.round(x), y: Math.round(y) });
}
