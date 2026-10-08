import type { Track, TrackQuery } from '@reveil/core';
import {
  BrokenCircuitError,
  ConsecutiveBreaker,
  TaskCancelledError,
  TimeoutStrategy,
  circuitBreaker,
  handleAll,
  timeout,
  wrap,
} from 'cockatiel';
import type { IPolicy } from 'cockatiel';
import type { MusicProvider } from './MusicProvider.ts';
import { MusicProviderUnavailableError } from './MusicProviderUnavailableError.ts';

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_HALF_OPEN_AFTER_MS = 30_000;

interface Deps {
  readonly inner: MusicProvider;
  readonly timeoutMs: number;
  /** Échecs consécutifs avant ouverture du circuit (défaut : 3). */
  readonly failureThreshold?: number;
  /** Durée d'ouverture du circuit avant un nouvel essai, en ms (défaut : 30 000). */
  readonly halfOpenAfterMs?: number;
}

/**
 * Décorateur : délai maximal + circuit breaker (cockatiel) ; délai dépassé ou circuit ouvert →
 * indisponibilité typée. Pas de nouvel essai : à l'heure du réveil, le maillon suivant est plus rapide.
 */
export class ResilientMusicProvider implements MusicProvider {
  readonly #inner: MusicProvider;
  readonly #policy: IPolicy;

  constructor({
    inner,
    timeoutMs,
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
    halfOpenAfterMs = DEFAULT_HALF_OPEN_AFTER_MS,
  }: Deps) {
    this.#inner = inner;
    // Le disjoncteur enveloppe le délai : un dépassement de délai compte comme un échec.
    // Stratégie « agressive » : on n'attend pas que la source coopère, la promesse est abandonnée.
    this.#policy = wrap(
      circuitBreaker(handleAll, {
        halfOpenAfter: halfOpenAfterMs,
        breaker: new ConsecutiveBreaker(failureThreshold),
      }),
      timeout(timeoutMs, TimeoutStrategy.Aggressive),
    );
  }

  get name(): string {
    return this.#inner.name;
  }

  async resolve(query: TrackQuery): Promise<Track> {
    try {
      return await this.#policy.execute(() => this.#inner.resolve(query));
    } catch (error) {
      throw this.#toUnavailable(error);
    }
  }

  #toUnavailable(error: unknown): MusicProviderUnavailableError {
    if (error instanceof MusicProviderUnavailableError) {
      return error;
    }
    if (error instanceof BrokenCircuitError) {
      return new MusicProviderUnavailableError(this.name, 'circuit ouvert', { cause: error });
    }
    if (error instanceof TaskCancelledError) {
      return new MusicProviderUnavailableError(this.name, 'délai dépassé', { cause: error });
    }
    return new MusicProviderUnavailableError(this.name, 'erreur inattendue', { cause: error });
  }
}
