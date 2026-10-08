import type { MusicCatalog, Track, TrackQuery } from '../../src/index.ts';

/** Catalogue qui résout toujours le même morceau et mémorise les requêtes reçues. */
export class StubMusicCatalog implements MusicCatalog {
  readonly #track: Track;
  readonly queries: TrackQuery[] = [];

  constructor(track: Track) {
    this.#track = track;
  }

  resolve(query: TrackQuery): Promise<Track> {
    this.queries.push(query);
    return Promise.resolve(this.#track);
  }
}
