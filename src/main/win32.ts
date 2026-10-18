// Win32 calls Electron has no API for (koffi FFI, Windows only, loaded on first use).
import type { BrowserWindow } from 'electron';
import koffi from 'koffi';

const GWL_STYLE = -16;
const WS_THICKFRAME = 0x00040000;
// SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED
const SWP_REFRAME = 0x0001 | 0x0002 | 0x0004 | 0x0010 | 0x0020;
const DWMWA_NCRENDERING_POLICY = 2; // DWMNCRP_USEWINDOWSTYLE 0, DWMNCRP_DISABLED 1
const DWMWA_WINDOW_CORNER_PREFERENCE = 33; // DWMWCP_DONOTROUND 1, DWMWCP_ROUND 2 (Windows 11)

type Hwnd = bigint;
interface User32 {
  GetWindowLongPtrW(hwnd: Hwnd, index: number): number | bigint;
  SetWindowLongPtrW(hwnd: Hwnd, index: number, value: number | bigint): number | bigint;
  SetWindowPos(hwnd: Hwnd, after: Hwnd, x: number, y: number, cx: number, cy: number, flags: number): number;
  DwmSetWindowAttribute(hwnd: Hwnd, attr: number, value: Buffer, size: number): number;
}

let user32: User32 | null = null;
function api(): User32 {
  if (!user32) {
    const lib = koffi.load('user32.dll');
    const dwm = koffi.load('dwmapi.dll');
    user32 = {
      GetWindowLongPtrW: lib.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hWnd, int nIndex)'),
      SetWindowLongPtrW: lib.func('intptr_t __stdcall SetWindowLongPtrW(intptr_t hWnd, int nIndex, intptr_t dwNewLong)'),
      SetWindowPos: lib.func('int __stdcall SetWindowPos(intptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)'),
      DwmSetWindowAttribute: dwm.func('int __stdcall DwmSetWindowAttribute(intptr_t hwnd, uint32_t dwAttribute, void *pvAttribute, uint32_t cbAttribute)'),
    };
  }
  return user32;
}

const hwndOf = (win: BrowserWindow): Hwnd => win.getNativeWindowHandle().readBigInt64LE(0);

function setDwm(win: BrowserWindow, attr: number, value: number) {
  const b = Buffer.alloc(4);
  b.writeInt32LE(value);
  return api().DwmSetWindowAttribute(hwndOf(win), attr, b, 4);
}

/**
 * Gives a transparent window the resize frame (WS_THICKFRAME) Electron leaves off: FancyZones and Windows Snap only
 * size windows that have one. Keeps WS_CAPTION off, which would make Windows paint the frame black behind the page.
 */
export function addResizeFrame(win: BrowserWindow) {
  const u = api();
  const hwnd = hwndOf(win);
  const style = Number(u.GetWindowLongPtrW(hwnd, GWL_STYLE));
  if (style & WS_THICKFRAME) return;
  u.SetWindowLongPtrW(hwnd, GWL_STYLE, style | WS_THICKFRAME);
  u.SetWindowPos(hwnd, 0n, 0, 0, 0, 0, SWP_REFRAME);
}

/**
 * Windows 11's rounded corners, border and shadow for a frameless window, asked for explicitly (the transparent window
 * only gets them square, or not at all after a backdrop change). Off while it fills the screen: Electron emulates
 * maximize for a transparent window, so Windows doesn't square it itself. No-op before Windows 11.
 */
export function setNativeFrame(win: BrowserWindow, on: boolean) {
  setDwm(win, DWMWA_NCRENDERING_POLICY, on ? 0 : 1);
  setDwm(win, DWMWA_WINDOW_CORNER_PREFERENCE, on ? 2 : 1);
}
