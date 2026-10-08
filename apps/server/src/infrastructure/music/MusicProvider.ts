import type { Track, TrackQuery } from '@reveil/core';

/**
 * Source musicale nommée : un maillon de la chaîne `FallbackMusicCatalog` (iTunes, MusicBrainz, local…).
 * Contrat interne à l'infrastructure : c'est `FallbackMusicCatalog` qui implémente le port `MusicCatalog`.
 */
export interface MusicProvider {
  /** Nom stable du fournisseur, repris dans les journaux et les erreurs (`itunes`, `musicbrainz`, `local`). */
  readonly name: string;
  /** Rejette la promesse si aucun morceau n'a pu être résolu. */
  resolve(query: TrackQuery): Promise<Track>;
}
