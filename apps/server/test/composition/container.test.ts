import { readFileSync } from 'node:fs';
import { TrackQuery, TriggerWakeUp, UserId } from '@reveil/core';
import type { WakeUpReport } from '@reveil/core';
import type { AwilixContainer } from 'awilix';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../src/config/env.ts';
import { buildContainer } from '../../src/composition/container.ts';
import type { AppCradle } from '../../src/composition/container.ts';
import { HostRoutingFetch, ITUNES_HOST, MUSICBRAINZ_HOST } from '../doubles/HostRoutingFetch.ts';
import { createTestWorkspace } from '../doubles/testConfig.ts';
import type { TestWorkspace } from '../doubles/testConfig.ts';
import { loadFixture } from '../doubles/loadFixture.ts';

// La règle « aucun `new` d'implémentation concrète hors de la composition root » (CA-CMP-01) est
// vérifiée par `npm run lint` (no-restricted-syntax) et `npm run arch:check` : pas besoin de relancer
// ESLint ici. Ces tests vérifient que le conteneur câble réellement le cas d'usage.

const QUERY = TrackQuery.create({ title: 'Riders on the Storm', artist: 'The Doors' });

let workspace: TestWorkspace;
let containers: Array<AwilixContainer<AppCradle>>;

beforeEach(() => {
  workspace = createTestWorkspace();
  containers = [];
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(containers.map((container) => container.dispose()));
  workspace.cleanup();
});

/** Conteneur sans réseau ni sortie console : faux `fetch` et pino silencieux. */
function containerFor(config: AppConfig, fetch: HostRoutingFetch): AwilixContainer<AppCradle> {
  const container = buildContainer(config, {
    httpFetch: fetch.fetch,
    pinoLogger: pino({ level: 'silent' }),
  });
  containers.push(container);
  return container;
}

function wakeUpU1(container: AwilixContainer<AppCradle>): Promise<WakeUpReport> {
  return container.resolve('triggerWakeUp').execute({
    userId: UserId.parse('u1'),
    dayOfWeek: 'LUNDI',
    weather: 'PLUIE',
  });
}

describe('buildContainer — résolution des dépendances', () => {
  it('[CA-CMP-01] résout le cas d’usage TriggerWakeUp et ses dépendances', () => {
    const config = workspace.config();
    const container = containerFor(config, new HostRoutingFetch());

    expect(container.resolve('triggerWakeUp')).toBeInstanceOf(TriggerWakeUp);
    expect(container.resolve('musicCatalog')).toBeDefined();
    expect(container.resolve('userPreferencesProvider')).toBeDefined();
    expect(container.resolve('logger')).toBeDefined();
    expect(container.resolve('config')).toBe(config);
  });

  it('[CA-CMP-01] le cas d’usage résolu fonctionne de bout en bout (préférences, musique, canal)', async () => {
    const fetch = new HostRoutingFetch().respondJson(
      ITUNES_HOST,
      loadFixture('itunes-search.json'),
    );
    const container = containerFor(workspace.config(), fetch);

    const report = await wakeUpU1(container);

    expect(report).toMatchObject({
      userId: 'u1',
      trackSource: 'itunes',
      deliveredVia: 'EMAIL',
      degraded: false,
    });
    expect(fetch.hosts).toEqual([ITUNES_HOST]);
    expect(readFileSync(workspace.notificationLogFile, 'utf8')).toContain('u1@example.org');
  });

  it('[CA-CMP-01] enregistre les canaux EMAIL, SMS et PUSH, et LOG en dernier recours', () => {
    const container = containerFor(workspace.config(), new HostRoutingFetch());

    const types = container.resolve('notificationChannels').map((channel) => channel.type);
    expect([...types].sort()).toEqual(['EMAIL', 'PUSH', 'SMS']);
    expect(container.resolve('lastResortChannel').type).toBe('LOG');
  });

  it('[CA-CMP-01] branche le mock du service de préférences (utilisateurs du jeu de données)', async () => {
    const container = containerFor(workspace.config(), new HostRoutingFetch());

    const preferences = await container
      .resolve('userPreferencesProvider')
      .findByUserId(UserId.parse('u1'));

    expect(preferences?.preferredChannel).toBe('EMAIL');
  });

  it('[CA-CMP-01] le cas d’usage est un singleton', () => {
    const container = containerFor(workspace.config(), new HostRoutingFetch());

    expect(container.resolve('triggerWakeUp')).toBe(container.resolve('triggerWakeUp'));
  });

  it('[CA-CMP-01] la composition root n’utilise pas loadModules (exception d’audit ADR-0003)', () => {
    const source = readFileSync(
      new URL('../../src/composition/container.ts', import.meta.url),
      'utf8',
    );

    expect(source).not.toMatch(/\bloadModules\s*\(/);
    expect(source).not.toMatch(/import\s*\{[^}]*\bloadModules\b[^}]*\}\s*from\s*['"]awilix['"]/);
  });
});

describe('buildContainer — chaîne musicale configurée par MUSIC_PROVIDERS', () => {
  it('[CA-CMP-02] ordre par défaut : iTunes puis MusicBrainz, puis morceau local', async () => {
    const fetch = new HostRoutingFetch();
    const container = containerFor(workspace.config(), fetch);

    const track = await container.resolve('musicCatalog').resolve(QUERY);

    expect(fetch.hosts).toEqual([ITUNES_HOST, MUSICBRAINZ_HOST]);
    expect(track.source).toBe('local');
  });

  it('[CA-CMP-02] MUSIC_PROVIDERS=musicbrainz,itunes interroge MusicBrainz avant iTunes', async () => {
    const fetch = new HostRoutingFetch();
    const container = containerFor(
      workspace.config({ MUSIC_PROVIDERS: 'musicbrainz,itunes' }),
      fetch,
    );

    const track = await container.resolve('musicCatalog').resolve(QUERY);

    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST, ITUNES_HOST]);
    expect(track.source).toBe('local');
  });

  it('[CA-CMP-02] MUSIC_PROVIDERS=musicbrainz retire iTunes de la chaîne', async () => {
    const fetch = new HostRoutingFetch();
    const container = containerFor(workspace.config({ MUSIC_PROVIDERS: 'musicbrainz' }), fetch);

    await container.resolve('musicCatalog').resolve(QUERY);

    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST]);
    expect(fetch.hosts).not.toContain(ITUNES_HOST);
  });

  it('[CA-CMP-02] MUSIC_PROVIDERS vide : aucun appel HTTP, morceau local', async () => {
    const fetch = new HostRoutingFetch();
    const container = containerFor(workspace.config({ MUSIC_PROVIDERS: '' }), fetch);

    const track = await container.resolve('musicCatalog').resolve(QUERY);

    expect(fetch.hosts).toEqual([]);
    expect(track.source).toBe('local');
  });

  it('[CA-CMP-02] le premier fournisseur qui répond fournit le morceau', async () => {
    const fetch = new HostRoutingFetch().respondJson(
      MUSICBRAINZ_HOST,
      loadFixture('musicbrainz-recording.json'),
    );
    const container = containerFor(
      workspace.config({ MUSIC_PROVIDERS: 'musicbrainz,itunes' }),
      fetch,
    );

    const track = await container.resolve('musicCatalog').resolve(QUERY);

    expect(track.source).toBe('musicbrainz');
    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST]);
  });
});

describe('buildContainer — décorateurs de la chaîne musicale', () => {
  it('met en cache un morceau déjà résolu (un seul appel HTTP pour deux résolutions)', async () => {
    const fetch = new HostRoutingFetch().respondJson(
      ITUNES_HOST,
      loadFixture('itunes-search.json'),
    );
    const container = containerFor(workspace.config({ MUSIC_PROVIDERS: 'itunes' }), fetch);
    const catalog = container.resolve('musicCatalog');

    await catalog.resolve(QUERY);
    const second = await catalog.resolve(QUERY);

    expect(second.source).toBe('itunes');
    expect(fetch.hosts).toEqual([ITUNES_HOST]);
  });

  it('applique le quota iTunes ITUNES_MAX_REQUESTS_PER_MINUTE (échec immédiat au-delà)', async () => {
    // Horloge figée : seul `Date` est simulé, les temporisations (timeout) restent réelles.
    vi.useFakeTimers({ toFake: ['Date'], now: 0 });
    const fetch = new HostRoutingFetch().respondJson(
      ITUNES_HOST,
      loadFixture('itunes-search.json'),
    );
    const container = containerFor(
      workspace.config({ MUSIC_PROVIDERS: 'itunes', ITUNES_MAX_REQUESTS_PER_MINUTE: '2' }),
      fetch,
    );
    const catalog = container.resolve('musicCatalog');

    // Requêtes distinctes : le cache ne s'applique pas.
    const first = await catalog.resolve(TrackQuery.create({ title: 'Titre 1' }));
    const second = await catalog.resolve(TrackQuery.create({ title: 'Titre 2' }));
    const third = await catalog.resolve(TrackQuery.create({ title: 'Titre 3' }));

    expect([first.source, second.source, third.source]).toEqual(['itunes', 'itunes', 'local']);
    expect(fetch.hosts).toEqual([ITUNES_HOST, ITUNES_HOST]);

    // Une minute plus tard, le budget est de nouveau disponible.
    vi.setSystemTime(60_000);
    const later = await catalog.resolve(TrackQuery.create({ title: 'Titre 4' }));
    expect(later.source).toBe('itunes');
    expect(fetch.hosts).toEqual([ITUNES_HOST, ITUNES_HOST, ITUNES_HOST]);
  });

  it('limite MusicBrainz à une requête par seconde', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: 0 });
    const fetch = new HostRoutingFetch().respondJson(
      MUSICBRAINZ_HOST,
      loadFixture('musicbrainz-recording.json'),
    );
    const container = containerFor(workspace.config({ MUSIC_PROVIDERS: 'musicbrainz' }), fetch);
    const catalog = container.resolve('musicCatalog');

    const first = await catalog.resolve(TrackQuery.create({ title: 'Titre 1' }));
    const second = await catalog.resolve(TrackQuery.create({ title: 'Titre 2' }));

    expect([first.source, second.source]).toEqual(['musicbrainz', 'local']);
    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST]);

    vi.setSystemTime(1_000);
    const later = await catalog.resolve(TrackQuery.create({ title: 'Titre 3' }));
    expect(later.source).toBe('musicbrainz');
    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST, MUSICBRAINZ_HOST]);
  });
});

describe('buildContainer — pannes simulées par SIMULATED_FAILURES', () => {
  it('[CA-CMP-05] « preferences » branche un service de préférences en panne', async () => {
    const container = containerFor(
      workspace.config({ SIMULATED_FAILURES: 'preferences' }),
      new HostRoutingFetch(),
    );

    await expect(
      container.resolve('userPreferencesProvider').findByUserId(UserId.parse('u1')),
    ).rejects.toThrow();
  });

  it('[CA-CMP-05] « itunes » simule la panne sans atteindre le réseau, la chaîne bascule', async () => {
    const fetch = new HostRoutingFetch()
      .respondJson(ITUNES_HOST, loadFixture('itunes-search.json'))
      .respondJson(MUSICBRAINZ_HOST, loadFixture('musicbrainz-recording.json'));
    const container = containerFor(workspace.config({ SIMULATED_FAILURES: 'itunes' }), fetch);

    const track = await container.resolve('musicCatalog').resolve(QUERY);

    expect(track.source).toBe('musicbrainz');
    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST]);
  });

  it('[CA-CMP-05] « musicbrainz » simule la panne sans atteindre le réseau', async () => {
    const fetch = new HostRoutingFetch().respondJson(
      MUSICBRAINZ_HOST,
      loadFixture('musicbrainz-recording.json'),
    );
    const container = containerFor(
      workspace.config({ MUSIC_PROVIDERS: 'musicbrainz', SIMULATED_FAILURES: 'musicbrainz' }),
      fetch,
    );

    const track = await container.resolve('musicCatalog').resolve(QUERY);

    expect(track.source).toBe('local');
    expect(fetch.hosts).toEqual([]);
  });

  it('[CA-CMP-05] « email » met le canal e-mail en panne : u1 est réveillé par un autre canal', async () => {
    const container = containerFor(
      workspace.config({ SIMULATED_FAILURES: 'email' }),
      new HostRoutingFetch(),
    );

    const report = await wakeUpU1(container);

    expect(report.attempts[0]).toMatchObject({ channel: 'EMAIL', success: false });
    expect(['SMS', 'PUSH']).toContain(report.deliveredVia);
    expect(report.degraded).toBe(true);
  });

  it('[CA-CMP-05] « email,sms,push » : u1 est réveillé par le canal LOG de dernier recours', async () => {
    const container = containerFor(
      workspace.config({ SIMULATED_FAILURES: 'email,sms,push' }),
      new HostRoutingFetch(),
    );

    const report = await wakeUpU1(container);

    // Ordre entre SMS et PUSH = ordre d'enregistrement, non imposé par les critères.
    const failed = report.attempts.slice(0, -1);
    expect(report.attempts[0]?.channel).toBe('EMAIL');
    expect(failed.map((attempt) => attempt.channel).sort()).toEqual(['EMAIL', 'PUSH', 'SMS']);
    expect(failed.every((attempt) => !attempt.success)).toBe(true);
    expect(report.attempts.at(-1)).toMatchObject({ channel: 'LOG', success: true });
    expect(report.deliveredVia).toBe('LOG');
  });
});
