import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA install + offline shell (SPEC-PWA-001). vite-plugin-pwa generates the
// manifest and the Workbox service worker; both automatically respect the
// `base` below (REQ-PWA-106), and `cleanupOutdatedCaches` + autoUpdate's
// skipWaiting/clientsClaim (plugin defaults) purge stale caches on activate
// (REQ-PWA-108).
export default defineConfig({
  base: '/solar-simulator/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: '태양계 탐험',
        short_name: '태양계',
        description: 'Interactive 3D Solar System Simulation',
        display: 'standalone',
        background_color: '#0a0a0f',
        theme_color: '#0a0a0f',
        start_url: '/solar-simulator/',
        scope: '/solar-simulator/',
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Default glob is {js,css,html} only — widen it to also precache the
        // texture set, icons, self-hosted font woff2 files, and the manifest
        // itself (REQ-PWA-104). Largest asset is ~1.1MB, under Workbox's
        // 2MiB default maximumFileSizeToCacheInBytes, so that stays default.
        //
        // mp3/json bring in the pre-recorded narration (scripts/build-tts.mjs)
        // and its manifest. They are precached rather than runtime-cached on
        // purpose: the recorded Korean voice IS the narration this app was tuned
        // for, and leaving it to a runtime fetch would mean the first offline
        // visit to any body falls back to the device voice instead.
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,woff2,webmanifest,mp3,json}'],
        runtimeCaching: [
          {
            // Live aircraft data is never cached; FlightDataService's existing
            // OFFLINE state (SPEC-EARTH-002) covers the offline gap (REQ-PWA-108).
            urlPattern: /^https:\/\/api\.airplanes\.live\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
