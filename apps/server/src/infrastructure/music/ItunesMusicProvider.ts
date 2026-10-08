import type { Track, TrackQuery } from '@reveil/core';
import type { HttpFetch } from '../http/HttpFetch.ts';
import type { MusicProvider } from './MusicProvider.ts';

interface Deps {
  readonly httpFetch: HttpFetch;
}

/** Adaptateur de l'API Search d'iTunes : traduit sa réponse en `Track` (anti-corruption layer). */
export class ItunesMusicProvider implements MusicProvider {
  readonly name = 'itunes';
  readonly #httpFetch: HttpFetch;

  constructor({ httpFetch }: Deps) {
    this.#httpFetch = httpFetch;
  }

  resolve(query: TrackQuery): Promise<Track> {
    return Promise.reject(
      new Error('Not implemented', { cause: { query, httpFetch: this.#httpFetch } }),
    );
  }
}
