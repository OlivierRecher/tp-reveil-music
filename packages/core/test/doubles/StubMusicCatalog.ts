import type { MusicCatalog, ResolvedTrack, Track, TrackQuery } from '../../src/index.ts';

interface Options {
  /** Le catalogue signale un repli sur sa source de secours. Défaut : `false`. */
  readonly degraded?: boolean;
}

/** Catalogue qui résout toujours le même morceau et mémorise les requêtes reçues. */
export class StubMusicCatalog implements MusicCatalog {
  readonly #track: Track;
  readonly #degraded: boolean;
  readonly queries: TrackQuery[] = [];

  constructor(track: Track, { degraded = false }: Options = {}) {
    this.#track = track;
    this.#degraded = degraded;
  }

  resolve(query: TrackQuery): Promise<ResolvedTrack> {
    this.queries.push(query);
    return Promise.resolve({ track: this.#track, degraded: this.#degraded });
  }
}
