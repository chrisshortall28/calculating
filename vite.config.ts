import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Podium',
        short_name: 'Podium',
        description: 'Roller skating competition calculator',
        theme_color: '#1c7ed6',
        background_color: '#ffffff',
        display: 'standalone',
        // PNGs generated from favicon.svg by `npm run generate-icons` (pwa-assets.config.ts).
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  // The native file watcher intermittently missed edits on Windows, leaving the dev server serving
  // stale modules; polling is reliable. Dev server only.
  server: { watch: { usePolling: true, interval: 300 } },
  // Offline app: everything is precached, so large chunks are fine.
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
