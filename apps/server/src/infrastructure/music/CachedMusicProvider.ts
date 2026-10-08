import type { Track, TrackQuery } from '@reveil/core';
import { LRUCache } from 'lru-cache';
import type { MusicProvider } from './MusicProvider.ts';

/** Taille maximale par défaut : quelques centaines de recherches distinctes suffisent largement. */
const DEFAULT_MAX_ENTRIES = 500;

interface Deps {
  readonly inner: MusicProvider;
  readonly ttlMs: number;
  readonly maxEntries?: number;
}

/** Décorateur : met en cache (LRU + TTL) les morceaux résolus, par requête normalisée. */
export class CachedMusicProvider implements MusicProvider {
  readonly #inner: MusicProvider;
  readonly #cache: LRUCache<string, Track>;

  constructor({ inner, ttlMs, maxEntries = DEFAULT_MAX_ENTRIES }: Deps) {
    this.#inner = inner;
    this.#cache = new LRUCache<string, Track>({
      max: maxEntries,
      ttl: ttlMs,
      // lru-cache lit par défaut `performance.now`, capturé au chargement du module : l'horloge
      // simulée de vitest (`vi.useFakeTimers`) ne le remplace pas et le TTL ne pourrait pas être
      // testé. `Date.now()`, lu à chaque appel, suit l'horloge simulée ; la précision à la
      // milliseconde suffit pour un TTL de plusieurs minutes.
      perf: { now: () => Date.now() },
    });
  }

  get name(): string {
    return this.#inner.name;
  }

  /** Seuls les succès sont mis en cache : après un échec, l'appel suivant interroge de nouveau la source. */
  async resolve(query: TrackQuery): Promise<Track> {
    const key = query.cacheKey;
    const cached = this.#cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const track = await this.#inner.resolve(query);
    this.#cache.set(key, track);
    return track;
  }
}
