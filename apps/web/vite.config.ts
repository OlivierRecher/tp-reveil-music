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
        description:
          'Déclenche un réveil musical de démonstration et affiche le morceau, le canal et le mode dégradé.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#111827',
        theme_color: '#1f2937',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Coquille hors ligne : HTML, JS et CSS précachés (les icônes du manifest le sont d'office).
        globPatterns: ['**/*.{html,js,css}'],
        navigateFallback: 'index.html',
        // L'API n'est jamais servie par le cache : un réveil hors ligne doit échouer visiblement.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
