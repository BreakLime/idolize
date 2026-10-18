import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

const shared = { '@shared': resolve('src/shared') };

export default defineConfig({
  main: { resolve: { alias: shared } },
  preload: {
    resolve: { alias: shared },
    // sandboxed preloads must be CommonJS
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    resolve: { alias: { ...shared, '@': resolve('src/renderer/src') } },
    plugins: [react()],
  },
});
