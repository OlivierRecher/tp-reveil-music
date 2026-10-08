import type { Track, TrackQuery } from '@reveil/core';
import type { MusicProvider } from './MusicProvider.ts';

interface Deps {
  readonly inner: MusicProvider;
  readonly timeoutMs: number;
  /** Échecs consécutifs avant ouverture du circuit (défaut : 3). */
  readonly failureThreshold?: number;
  /** Durée d'ouverture du circuit avant un nouvel essai, en ms (défaut : 30 000). */
  readonly halfOpenAfterMs?: number;
}

/** Décorateur : délai maximal + circuit breaker ; délai dépassé ou circuit ouvert → indisponibilité typée. */
export class ResilientMusicProvider implements MusicProvider {
  readonly #inner: MusicProvider;
  readonly #timeoutMs: number;
  readonly #failureThreshold: number | undefined;
  readonly #halfOpenAfterMs: number | undefined;

  constructor({ inner, timeoutMs, failureThreshold, halfOpenAfterMs }: Deps) {
    this.#inner = inner;
    this.#timeoutMs = timeoutMs;
    this.#failureThreshold = failureThreshold;
    this.#halfOpenAfterMs = halfOpenAfterMs;
  }

  get name(): string {
    return this.#inner.name;
  }

  resolve(query: TrackQuery): Promise<Track> {
    return Promise.reject(
      new Error('Not implemented', {
        cause: {
          query,
          timeoutMs: this.#timeoutMs,
          failureThreshold: this.#failureThreshold,
          halfOpenAfterMs: this.#halfOpenAfterMs,
        },
      }),
    );
  }
}
