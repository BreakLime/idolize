import type { IdolBridge } from '@shared/ipc';

declare global {
  interface Window {
    idol: IdolBridge;
  }
}

export const idol: IdolBridge = window.idol;
