import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under any repo name.
// (The service worker's cache name is stamped after the build by tools/stamp-sw.mjs.)
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
