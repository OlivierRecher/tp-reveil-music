import type { MusicCatalog } from '@reveil/core';

/** Source musicale nommée : un maillon de la chaîne `FallbackMusicCatalog` (iTunes, MusicBrainz, local…). */
export interface MusicProvider extends MusicCatalog {
  /** Nom stable du fournisseur, repris dans les journaux et les erreurs (`itunes`, `musicbrainz`, `local`). */
  readonly name: string;
}
