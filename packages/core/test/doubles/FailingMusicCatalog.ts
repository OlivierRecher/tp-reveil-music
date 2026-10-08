import type { MusicCatalog, ResolvedTrack, TrackQuery } from '../../src/index.ts';

/** Catalogue en panne : rejette toujours. */
export class FailingMusicCatalog implements MusicCatalog {
  readonly #error: Error;
  readonly queries: TrackQuery[] = [];

  constructor(error: Error = new Error('Catalogue musical indisponible')) {
    this.#error = error;
  }

  resolve(query: TrackQuery): Promise<ResolvedTrack> {
    this.queries.push(query);
    return Promise.reject(this.#error);
  }
}
