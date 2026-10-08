import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    // Le client ne parle qu'à notre API : jamais directement à iTunes ou MusicBrainz (voir ADR-0001).
    proxy: { '/api': 'http://localhost:3000' },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Réveil musical',
        short_name: 'Réveil',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#111827',
        theme_color: '#1f2937',
        icons: [],
      },
    }),
  ],
});
