import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackQuery } from '@reveil/core';
import { FallbackMusicCatalog } from '../../../src/infrastructure/music/FallbackMusicCatalog.ts';
import { ResilientMusicProvider } from '../../../src/infrastructure/music/ResilientMusicProvider.ts';
import { expectUnavailableReason, flush, observe } from './doubles/helpers.ts';
import type { Settlement } from './doubles/helpers.ts';
import { RecordingLogger } from '../../doubles/RecordingLogger.ts';
import { ScriptedMusicProvider } from './doubles/ScriptedMusicProvider.ts';

// Délai maximal et circuit breaker : horloge simulée, aucune attente réelle.

const TIMEOUT_MS = 2_000;
const FAILURE_THRESHOLD = 3;
const HALF_OPEN_AFTER_MS = 30_000;
const QUERY = TrackQuery.create({ title: 'Under Pressure', artist: 'Queen' });

function resilient(inner: ScriptedMusicProvider): ResilientMusicProvider {
  return new ResilientMusicProvider({
    inner,
    timeoutMs: TIMEOUT_MS,
    failureThreshold: FAILURE_THRESHOLD,
    halfOpenAfterMs: HALF_OPEN_AFTER_MS,
  });
}

function reasonOf<T>(settlement: Settlement<T>): unknown {
  return settlement.status === 'rejected' ? settlement.reason : undefined;
}

/** Appelle `count` fois le fournisseur et laisse chaque appel se régler (sans avancer l'horloge). */
async function callAndSettle(
  provider: ResilientMusicProvider,
  count: number,
): Promise<Settlement<unknown>[]> {
  const settlements: Settlement<unknown>[] = [];
  for (let index = 0; index < count; index += 1) {
    const settled = observe(provider.resolve(QUERY));
    await flush();
    settlements.push(settled());
  }
  return settlements;
}

describe('ResilientMusicProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reprend le nom du fournisseur décoré', () => {
    expect(resilient(new ScriptedMusicProvider('itunes')).name).toBe('itunes');
  });

  it('transmet le morceau quand le fournisseur répond dans le délai', async () => {
    const itunes = new ScriptedMusicProvider('itunes');

    const settled = observe(resilient(itunes).resolve(QUERY));
    await flush();

    const outcome = settled();
    expect(outcome.status).toBe('fulfilled');
    expect(outcome.status === 'fulfilled' ? outcome.value.toJSON() : undefined).toEqual(
      itunes.trackFor(QUERY).toJSON(),
    );
  });

  describe('délai maximal', () => {
    it('[CA-MUS-06] un dépassement de délai devient MusicProviderUnavailableError', async () => {
      const provider = resilient(new ScriptedMusicProvider('itunes').hang());

      const settled = observe(provider.resolve(QUERY));
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

      expect(settled().status).toBe('rejected');
      expectUnavailableReason(reasonOf(settled()), 'itunes');
    });

    it('[CA-MUS-11] un fournisseur qui ne répond pas est abandonné au bout du délai configuré, pas avant', async () => {
      const provider = resilient(new ScriptedMusicProvider('itunes').hang());

      const settled = observe(provider.resolve(QUERY));
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
      expect(settled().status).toBe('pending');

      await vi.advanceTimersByTimeAsync(1);
      expect(settled().status).toBe('rejected');
    });

    it('[CA-MUS-11] dans la chaîne, un fournisseur muet est abandonné au profit du suivant', async () => {
      const itunes = new ScriptedMusicProvider('itunes').hang();
      const musicBrainz = new ScriptedMusicProvider('musicbrainz');
      const catalog = new FallbackMusicCatalog({
        musicProviders: [resilient(itunes), musicBrainz],
        localMusicProvider: new ScriptedMusicProvider('local'),
        logger: new RecordingLogger(),
      });

      const settled = observe(catalog.resolve(QUERY));
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

      const outcome = settled();
      expect(outcome.status).toBe('fulfilled');
      expect(outcome.status === 'fulfilled' ? outcome.value.source : undefined).toBe('musicbrainz');
      expect(itunes.calls).toBe(1);
    });
  });

  describe('circuit breaker', () => {
    it('[CA-MUS-12] après failureThreshold échecs consécutifs, le fournisseur n’est plus appelé (circuit ouvert)', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const provider = resilient(itunes);
      await callAndSettle(provider, FAILURE_THRESHOLD);
      expect(itunes.calls).toBe(FAILURE_THRESHOLD);

      const [whileOpen] = await callAndSettle(provider, 1);

      expect(whileOpen?.status).toBe('rejected');
      expectUnavailableReason(whileOpen === undefined ? undefined : reasonOf(whileOpen), 'itunes');
      expect(itunes.calls).toBe(FAILURE_THRESHOLD);
    });

    it('[CA-MUS-12] le circuit reste ouvert pendant halfOpenAfterMs, puis un nouvel essai atteint le fournisseur', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const provider = resilient(itunes);
      await callAndSettle(provider, FAILURE_THRESHOLD);

      await vi.advanceTimersByTimeAsync(HALF_OPEN_AFTER_MS - 1);
      await callAndSettle(provider, 1);
      expect(itunes.calls).toBe(FAILURE_THRESHOLD);

      itunes.succeed();
      await vi.advanceTimersByTimeAsync(2);
      const [afterOpening] = await callAndSettle(provider, 1);

      expect(itunes.calls).toBe(FAILURE_THRESHOLD + 1);
      expect(afterOpening?.status).toBe('fulfilled');
    });

    it('[CA-MUS-12] des échecs non consécutifs n’ouvrent pas le circuit', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const provider = resilient(itunes);

      await callAndSettle(provider, FAILURE_THRESHOLD - 1);
      itunes.succeed();
      await callAndSettle(provider, 1);
      itunes.fail();
      await callAndSettle(provider, FAILURE_THRESHOLD - 1);
      await callAndSettle(provider, 1);

      expect(itunes.calls).toBe(2 * FAILURE_THRESHOLD);
    });

    it('[CA-MUS-12] par défaut : 3 échecs consécutifs ouvrent le circuit pendant 30 s', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const provider = new ResilientMusicProvider({ inner: itunes, timeoutMs: TIMEOUT_MS });
      await callAndSettle(provider, 3);

      await vi.advanceTimersByTimeAsync(29_999);
      await callAndSettle(provider, 1);
      expect(itunes.calls).toBe(3);

      await vi.advanceTimersByTimeAsync(2);
      await callAndSettle(provider, 1);
      expect(itunes.calls).toBe(4);
    });

    it('[CA-MUS-12] dans la chaîne, un circuit ouvert bascule immédiatement sur le fournisseur suivant', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const musicBrainz = new ScriptedMusicProvider('musicbrainz');
      const catalog = new FallbackMusicCatalog({
        musicProviders: [resilient(itunes), musicBrainz],
        localMusicProvider: new ScriptedMusicProvider('local'),
        logger: new RecordingLogger(),
      });
      for (let index = 0; index < FAILURE_THRESHOLD; index += 1) {
        const settled = observe(catalog.resolve(QUERY));
        await flush();
        expect(settled().status).toBe('fulfilled');
      }

      const settled = observe(catalog.resolve(QUERY));
      await flush();

      expect(settled().status).toBe('fulfilled');
      expect(itunes.calls).toBe(FAILURE_THRESHOLD);
      expect(musicBrainz.calls).toBe(FAILURE_THRESHOLD + 1);
    });
  });
});
