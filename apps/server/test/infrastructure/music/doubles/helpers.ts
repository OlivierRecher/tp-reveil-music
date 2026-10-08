import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { MusicProviderUnavailableError } from '../../../../src/infrastructure/music/MusicProviderUnavailableError.ts';

/** Charge une fixture JSON (copie neuve à chaque appel, modifiable par le test). */
export function loadFixture(fileName: string): unknown {
  const url = new URL(`../../../fixtures/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as unknown;
}

export type Settlement<T> =
  | { readonly status: 'pending' }
  | { readonly status: 'fulfilled'; readonly value: T }
  | { readonly status: 'rejected'; readonly reason: unknown };

/**
 * Observe une promesse sans l'attendre : évite qu'un test sous horloge simulée reste bloqué sur une
 * promesse jamais résolue. Lire l'état après `await flush()` ou `vi.advanceTimersByTimeAsync(…)`.
 */
export function observe<T>(promise: Promise<T>): () => Settlement<T> {
  let settlement: Settlement<T> = { status: 'pending' };
  promise.then(
    (value) => {
      settlement = { status: 'fulfilled', value };
    },
    (reason: unknown) => {
      settlement = { status: 'rejected', reason };
    },
  );
  return () => settlement;
}

/** Laisse s'exécuter les microtâches et les temporisations échues, sans avancer l'horloge simulée. */
export async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

/** Vérifie qu'une promesse rejette une `MusicProviderUnavailableError` attribuée au bon fournisseur. */
export async function expectUnavailable(
  promise: Promise<unknown>,
  providerName: string,
): Promise<void> {
  const outcome = await promise.then(
    () => ({ rejected: false as const }),
    (reason: unknown) => ({ rejected: true as const, reason }),
  );
  expect(outcome.rejected, 'la promesse aurait dû être rejetée').toBe(true);
  expectUnavailableReason(outcome.rejected ? outcome.reason : undefined, providerName);
}

/** Vérifie qu'une raison de rejet est une `MusicProviderUnavailableError` du bon fournisseur. */
export function expectUnavailableReason(reason: unknown, providerName: string): void {
  expect(reason).toBeInstanceOf(MusicProviderUnavailableError);
  expect(reason).toMatchObject({ providerName });
}
