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

  resolve(query: TrackQuery): Promise<Track> {
    return Promise.reject(
      new Error('Not implemented', {
        cause: {
          query,
          musicProviders: this.#musicProviders,
          localMusicProvider: this.#localMusicProvider,
          logger: this.#logger,
        },
      }),
    );
  }
}
