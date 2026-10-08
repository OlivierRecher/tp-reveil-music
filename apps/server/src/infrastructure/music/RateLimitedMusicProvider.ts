import type { Track, TrackQuery } from '@reveil/core';
import type { MusicProvider } from './MusicProvider.ts';
import { MusicProviderUnavailableError } from './MusicProviderUnavailableError.ts';

interface Deps {
  readonly inner: MusicProvider;
  readonly maxRequests: number;
  readonly intervalMs: number;
}

/**
 * Décorateur : limite le débit vers le fournisseur. Hors budget, échoue immédiatement
 * (`MusicProviderUnavailableError`) au lieu de mettre l'appel en file d'attente (ADR-0004, ADR-0006).
 *
 * Fenêtre glissante : on garde l'horodatage des appels des `intervalMs` dernières millisecondes ; un
 * appel n'est accepté que si moins de `maxRequests` y figurent. Un appel refusé n'est pas compté, il
 * ne consomme donc aucun budget futur (contrairement à une file d'attente, voir ADR-0006).
 */
export class RateLimitedMusicProvider implements MusicProvider {
  readonly #inner: MusicProvider;
  readonly #maxRequests: number;
  readonly #intervalMs: number;
  /** Horodatages (`Date.now()`) des appels acceptés, du plus ancien au plus récent. */
  readonly #acceptedAt: number[] = [];

  constructor({ inner, maxRequests, intervalMs }: Deps) {
    this.#inner = inner;
    this.#maxRequests = maxRequests;
    this.#intervalMs = intervalMs;
  }

  get name(): string {
    return this.#inner.name;
  }

  resolve(query: TrackQuery): Promise<Track> {
    if (!this.#tryAcquire()) {
      return Promise.reject(
        new MusicProviderUnavailableError(this.name, 'quota de requêtes atteint'),
      );
    }
    return this.#inner.resolve(query);
  }

  /** Réserve une place dans la fenêtre courante ; `false` si le budget est épuisé. */
  #tryAcquire(): boolean {
    const now = Date.now();
    while (this.#acceptedAt.length > 0 && now - (this.#acceptedAt[0] ?? now) >= this.#intervalMs) {
      this.#acceptedAt.shift();
    }
    if (this.#acceptedAt.length >= this.#maxRequests) {
      return false;
    }
    this.#acceptedAt.push(now);
    return true;
  }
}
