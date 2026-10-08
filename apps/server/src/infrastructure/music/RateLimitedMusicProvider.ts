import type { Track, TrackQuery } from '@reveil/core';
import type { MusicProvider } from './MusicProvider.ts';

interface Deps {
  readonly inner: MusicProvider;
  readonly maxRequests: number;
  readonly intervalMs: number;
}

/**
 * Décorateur : limite le débit vers le fournisseur. Hors budget, échoue immédiatement
 * (`MusicProviderUnavailableError`) au lieu de mettre l'appel en file d'attente (ADR-0004).
 */
export class RateLimitedMusicProvider implements MusicProvider {
  readonly #inner: MusicProvider;
  readonly #maxRequests: number;
  readonly #intervalMs: number;

  constructor({ inner, maxRequests, intervalMs }: Deps) {
    this.#inner = inner;
    this.#maxRequests = maxRequests;
    this.#intervalMs = intervalMs;
  }

  get name(): string {
    return this.#inner.name;
  }

  resolve(query: TrackQuery): Promise<Track> {
    return Promise.reject(
      new Error('Not implemented', {
        cause: { query, maxRequests: this.#maxRequests, intervalMs: this.#intervalMs },
      }),
    );
  }
}
