import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaManifest, workboxOptions } from './src/pwaManifest.ts';

export default defineConfig({
  server: {
    // Le client ne parle qu'à notre API : jamais directement à iTunes ou MusicBrainz (voir ADR-0001).
    proxy: { '/api': 'http://localhost:3000' },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Manifest et Workbox testés dans test/pwaManifest.test.ts (CA-WEB-07).
      manifest: pwaManifest,
      workbox: workboxOptions,
    }),
  ],
});
