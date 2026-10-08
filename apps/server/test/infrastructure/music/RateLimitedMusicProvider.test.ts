import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackQuery } from '@reveil/core';
import { FallbackMusicCatalog } from '../../../src/infrastructure/music/FallbackMusicCatalog.ts';
import { RateLimitedMusicProvider } from '../../../src/infrastructure/music/RateLimitedMusicProvider.ts';
import { expectUnavailableReason, flush, observe } from './doubles/helpers.ts';
import { RecordingLogger } from '../../doubles/RecordingLogger.ts';
import { ScriptedMusicProvider } from './doubles/ScriptedMusicProvider.ts';

// Quota iTunes (~20 req/min) : hors budget, échec immédiat sans atteindre le fournisseur (ADR-0004).
// « Immédiat » = la promesse est réglée sans avancer l'horloge simulée.

const MAX_REQUESTS = 20;
const INTERVAL_MS = 60_000;
const QUERY = TrackQuery.create({ title: 'Under Pressure', artist: 'Queen' });

function rateLimited(inner: ScriptedMusicProvider): RateLimitedMusicProvider {
  return new RateLimitedMusicProvider({
    inner,
    maxRequests: MAX_REQUESTS,
    intervalMs: INTERVAL_MS,
  });
}

async function consumeBudget(
  provider: RateLimitedMusicProvider | FallbackMusicCatalog,
): Promise<void> {
  for (let index = 0; index < MAX_REQUESTS; index += 1) {
    const settled = observe<unknown>(provider.resolve(QUERY));
    await flush();
    expect(settled().status, `appel n° ${String(index + 1)} dans le budget`).toBe('fulfilled');
  }
}

describe('RateLimitedMusicProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reprend le nom du fournisseur décoré', () => {
    expect(rateLimited(new ScriptedMusicProvider('itunes')).name).toBe('itunes');
  });

  it('[CA-MUS-10] laisse passer 20 requêtes dans la minute', async () => {
    const itunes = new ScriptedMusicProvider('itunes');
    const provider = rateLimited(itunes);

    await consumeBudget(provider);

    expect(itunes.calls).toBe(MAX_REQUESTS);
  });

  it('[CA-MUS-10] la 21e requête dans la minute échoue immédiatement sans atteindre le fournisseur', async () => {
    const itunes = new ScriptedMusicProvider('itunes');
    const provider = rateLimited(itunes);
    await consumeBudget(provider);

    const settled = observe(provider.resolve(QUERY));
    await flush();

    const outcome = settled();
    expect(outcome.status).toBe('rejected');
    expectUnavailableReason(outcome.status === 'rejected' ? outcome.reason : undefined, 'itunes');
    expect(itunes.calls).toBe(MAX_REQUESTS);
  });

  it('[CA-MUS-10] reste hors budget jusqu’à la fin de la fenêtre', async () => {
    const itunes = new ScriptedMusicProvider('itunes');
    const provider = rateLimited(itunes);
    await consumeBudget(provider);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS - 1);
    const settled = observe(provider.resolve(QUERY));
    await flush();

    expect(settled().status).toBe('rejected');
    expect(itunes.calls).toBe(MAX_REQUESTS);
  });

  it('[CA-MUS-10] après la fenêtre d’une minute, les requêtes sont de nouveau autorisées', async () => {
    const itunes = new ScriptedMusicProvider('itunes');
    const provider = rateLimited(itunes);
    await consumeBudget(provider);
    const refused = observe(provider.resolve(QUERY));
    await flush();
    expect(refused().status).toBe('rejected');

    await vi.advanceTimersByTimeAsync(INTERVAL_MS + 1);
    const settled = observe(provider.resolve(QUERY));
    await flush();

    expect(settled().status).toBe('fulfilled');
    expect(itunes.calls).toBe(MAX_REQUESTS + 1);
  });

  it('[CA-MUS-10] dans la chaîne, la 21e requête bascule immédiatement sur le fournisseur suivant', async () => {
    const itunes = new ScriptedMusicProvider('itunes');
    const musicBrainz = new ScriptedMusicProvider('musicbrainz');
    const catalog = new FallbackMusicCatalog({
      musicProviders: [rateLimited(itunes), musicBrainz],
      localMusicProvider: new ScriptedMusicProvider('local'),
      logger: new RecordingLogger(),
    });
    await consumeBudget(catalog);
    expect(musicBrainz.calls).toBe(0);

    const settled = observe(catalog.resolve(QUERY));
    await flush();

    const outcome = settled();
    expect(outcome.status).toBe('fulfilled');
    expect(outcome.status === 'fulfilled' ? outcome.value.track.source : undefined).toBe(
      'musicbrainz',
    );
    expect(itunes.calls).toBe(MAX_REQUESTS);
    expect(musicBrainz.calls).toBe(1);
  });
});
