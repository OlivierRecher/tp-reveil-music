import { describeError } from '@reveil/core';
import type { Logger, MusicCatalog, ResolvedTrack, TrackQuery } from '@reveil/core';
import type { MusicProvider } from './MusicProvider.ts';

interface Deps {
  readonly musicProviders: ReadonlyArray<MusicProvider>;
  readonly localMusicProvider: MusicProvider;
  readonly logger: Logger;
}

/**
 * Chaîne de responsabilité : essaie les fournisseurs dans l'ordre configuré, journalise chaque échec
 * (`warn`) et termine par le fournisseur local, qui ne rejette jamais. Le recours au fournisseur local
 * est signalé par `degraded: true` (CA-APP-10) : le cas d'usage n'a pas à interpréter la source.
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

  async resolve(query: TrackQuery): Promise<ResolvedTrack> {
    for (const provider of this.#musicProviders) {
      try {
        return { track: await provider.resolve(query), degraded: false };
      } catch (error) {
        // Toute erreur, typée ou non, fait basculer sur le maillon suivant : jamais de crash.
        this.#logger.warn(`Fournisseur musical « ${provider.name} » en échec, bascule`, {
          provider: provider.name,
          error: describeError(error),
        });
      }
    }
    return { track: await this.#localMusicProvider.resolve(query), degraded: true };
  }
}
