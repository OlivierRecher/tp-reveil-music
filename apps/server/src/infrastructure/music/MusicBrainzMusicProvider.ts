import type { Track, TrackQuery } from '@reveil/core';
import type { HttpFetch } from '../http/HttpFetch.ts';
import type { MusicProvider } from './MusicProvider.ts';

interface Deps {
  readonly httpFetch: HttpFetch;
  readonly musicBrainzUserAgent: string;
}

/** Adaptateur de l'API MusicBrainz (`/ws/2/recording`) : traduit sa réponse en `Track`. */
export class MusicBrainzMusicProvider implements MusicProvider {
  readonly name = 'musicbrainz';
  readonly #httpFetch: HttpFetch;
  readonly #userAgent: string;

  constructor({ httpFetch, musicBrainzUserAgent }: Deps) {
    this.#httpFetch = httpFetch;
    this.#userAgent = musicBrainzUserAgent;
  }

  resolve(query: TrackQuery): Promise<Track> {
    return Promise.reject(
      new Error('Not implemented', {
        cause: { query, httpFetch: this.#httpFetch, userAgent: this.#userAgent },
      }),
    );
  }
}
