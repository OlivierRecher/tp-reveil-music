// Configuration d'installabilité de la PWA (CA-WEB-07), extraite de vite.config.ts pour être testée.
// Données pures : seul le type de vite-plugin-pwa est importé (effacé à la compilation).
import type { ManifestOptions, VitePWAOptions } from 'vite-plugin-pwa';

/** Manifest Web App : nom, affichage standalone et icônes 192/512 px (fichiers dans `public/`). */
export const pwaManifest = {
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
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    // Déclaration séparée (« any maskable » est déconseillé) : le motif tient dans la zone sûre.
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
} satisfies Partial<ManifestOptions>;

/** Service worker généré par Workbox : coquille hors ligne, API jamais servie par le cache. */
export const workboxOptions = {
  // HTML, JS et CSS précachés (les icônes du manifest le sont d'office).
  globPatterns: ['**/*.{html,js,css}'],
  navigateFallback: 'index.html',
  // Un réveil hors ligne doit échouer visiblement : /api n'est jamais remplacé par la coquille.
  navigateFallbackDenylist: [/^\/api\//],
} satisfies VitePWAOptions['workbox'];
