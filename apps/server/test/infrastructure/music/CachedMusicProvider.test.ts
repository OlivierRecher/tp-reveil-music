import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackQuery } from '@reveil/core';
import { CachedMusicProvider } from '../../../src/infrastructure/music/CachedMusicProvider.ts';
import { ItunesMusicProvider } from '../../../src/infrastructure/music/ItunesMusicProvider.ts';
import { FakeHttpFetch } from './doubles/FakeHttpFetch.ts';
import { expectUnavailable, loadFixture } from './doubles/helpers.ts';
import { ScriptedMusicProvider } from './doubles/ScriptedMusicProvider.ts';

// Cache avec durée de vie : horloge simulée, appels HTTP comptés sur un faux fetch.

const TTL_MS = 10 * 60 * 1000;

const QUERY = TrackQuery.create({ title: 'Under Pressure', artist: 'Queen' });
/** Même requête une fois normalisée (casse, espaces) : même clé de cache. */
const SAME_QUERY = TrackQuery.create({ title: '  under   PRESSURE ', artist: 'QUEEN ' });
const OTHER_QUERY = TrackQuery.create({ title: 'Bohemian Rhapsody', artist: 'Queen' });

function cachedItunes(maxEntries?: number): {
  readonly http: FakeHttpFetch;
  readonly provider: CachedMusicProvider;
} {
  const http = new FakeHttpFetch();
  const inner = new ItunesMusicProvider({ httpFetch: http.fetch });
  const provider = new CachedMusicProvider(
    maxEntries === undefined ? { inner, ttlMs: TTL_MS } : { inner, ttlMs: TTL_MS, maxEntries },
  );
  return { http, provider };
}

describe('CachedMusicProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reprend le nom du fournisseur décoré', () => {
    const inner = new ScriptedMusicProvider('musicbrainz');

    expect(new CachedMusicProvider({ inner, ttlMs: TTL_MS }).name).toBe('musicbrainz');
  });

  it('[CA-MUS-09] deux recherches identiques dans la durée du cache ne déclenchent qu’un seul appel HTTP', async () => {
    const { http, provider } = cachedItunes();
    http.alwaysRespondJson(loadFixture('itunes-search.json'));

    const first = await provider.resolve(QUERY);
    await vi.advanceTimersByTimeAsync(TTL_MS - 1);
    const second = await provider.resolve(QUERY);

    expect(http.requests).toHaveLength(1);
    expect(second.toJSON()).toEqual(first.toJSON());
  });

  it('la clé de cache est la requête normalisée (casse, espaces) : un seul appel HTTP (ADR-0004)', async () => {
    const { http, provider } = cachedItunes();
    http.alwaysRespondJson(loadFixture('itunes-search.json'));

    const first = await provider.resolve(QUERY);
    const second = await provider.resolve(SAME_QUERY);

    expect(http.requests).toHaveLength(1);
    expect(second.toJSON()).toEqual(first.toJSON());
  });

  it('[CA-MUS-09] après expiration de la durée du cache, un nouvel appel HTTP est fait', async () => {
    const { http, provider } = cachedItunes();
    http.alwaysRespondJson(loadFixture('itunes-search.json'));

    await provider.resolve(QUERY);
    await vi.advanceTimersByTimeAsync(TTL_MS + 1);
    await provider.resolve(QUERY);

    expect(http.requests).toHaveLength(2);
  });

  it('[CA-MUS-09] deux recherches différentes déclenchent chacune leur appel HTTP', async () => {
    const { http, provider } = cachedItunes();
    http.alwaysRespondJson(loadFixture('itunes-search.json'));

    await provider.resolve(QUERY);
    await provider.resolve(OTHER_QUERY);

    expect(http.requests).toHaveLength(2);
  });

  it('un échec n’est pas mis en cache : la recherche suivante rappelle le fournisseur', async () => {
    const { http, provider } = cachedItunes();
    http
      .respondText('Service Unavailable', 503)
      .alwaysRespondJson(loadFixture('itunes-search.json'));

    await expectUnavailable(provider.resolve(QUERY), 'itunes');
    const track = await provider.resolve(QUERY);

    expect(http.requests).toHaveLength(2);
    expect(track.title).toBe('Under Pressure (Single Version) [2017 Remastered Version]');
  });

  it('borne le nombre d’entrées (maxEntries) : l’entrée la moins récente est évincée', async () => {
    const { http, provider } = cachedItunes(1);
    http.alwaysRespondJson(loadFixture('itunes-search.json'));

    await provider.resolve(QUERY);
    await provider.resolve(OTHER_QUERY);
    await provider.resolve(QUERY);

    expect(http.requests).toHaveLength(3);
  });
});
