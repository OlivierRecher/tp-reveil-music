import type { Track, TrackQuery } from '@reveil/core';
import type { MusicProvider } from './MusicProvider.ts';

interface Deps {
  readonly inner: MusicProvider;
  readonly ttlMs: number;
  readonly maxEntries?: number;
}

/** Décorateur : met en cache (LRU + TTL) les morceaux résolus, par requête normalisée. */
export class CachedMusicProvider implements MusicProvider {
  readonly #inner: MusicProvider;
  readonly #ttlMs: number;
  readonly #maxEntries: number | undefined;

  constructor({ inner, ttlMs, maxEntries }: Deps) {
    this.#inner = inner;
    this.#ttlMs = ttlMs;
    this.#maxEntries = maxEntries;
  }

  get name(): string {
    return this.#inner.name;
  }

  resolve(query: TrackQuery): Promise<Track> {
    return Promise.reject(
      new Error('Not implemented', {
        cause: { query, ttlMs: this.#ttlMs, maxEntries: this.#maxEntries },
      }),
    );
  }
}
