import type { Logger, MusicCatalog, Track, TrackQuery } from '@reveil/core';
import type { MusicProvider } from './MusicProvider.ts';

interface Deps {
  readonly musicProviders: ReadonlyArray<MusicProvider>;
  readonly localMusicProvider: MusicProvider;
  readonly logger: Logger;
}

/**
 * Chaîne de responsabilité : essaie les fournisseurs dans l'ordre configuré, journalise chaque échec
 * (`warn`) et termine par le fournisseur local, qui ne rejette jamais.
 */
export class FallbackMusicCatalog implements MusicCatalog {
  readonly #musicProviders: ReadonlyArray<MusicProvider>;
  readonly #localMusicProvider: MusicProvider;
  readonly #logger: Logger;

  constructor({ musicProviders, localMusicProvider, logger }: Deps) {
    this.#musicProviders = musicProviders;
    this.#localMusicProvider = localMusicProvider;
    this.#logger = logger;
  }

  async resolve(query: TrackQuery): Promise<Track> {
    for (const provider of this.#musicProviders) {
      try {
        return await provider.resolve(query);
      } catch (error) {
        // Toute erreur, typée ou non, fait basculer sur le maillon suivant : jamais de crash.
        this.#logger.warn(`Fournisseur musical « ${provider.name} » en échec, bascule`, {
          provider: provider.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return this.#localMusicProvider.resolve(query);
  }
}
