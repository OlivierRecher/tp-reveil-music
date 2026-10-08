import { readFileSync } from 'node:fs';
import { TrackQuery, TriggerWakeUp, UserId } from '@reveil/core';
import type { WakeUpReport } from '@reveil/core';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../src/config/env.ts';
import { composeApplication } from '../../src/composition/compositionRoot.ts';
import type { Application } from '../../src/composition/compositionRoot.ts';
import { HostRoutingFetch, ITUNES_HOST, MUSICBRAINZ_HOST } from '../doubles/HostRoutingFetch.ts';
import { createTestWorkspace } from '../doubles/testConfig.ts';
import type { TestWorkspace } from '../doubles/testConfig.ts';
import { loadFixture } from '../doubles/loadFixture.ts';

// La règle « aucun `new` d'implémentation concrète hors de la composition root » (CA-CMP-01) est
// vérifiée par `npm run lint` (no-restricted-syntax) et `npm run arch:check` : pas besoin de relancer
// ESLint ici. Ces tests vérifient que la composition root câble réellement le cas d'usage.

const QUERY = TrackQuery.create({ title: 'Riders on the Storm', artist: 'The Doors' });

let workspace: TestWorkspace;
let apps: Array<Application>;

beforeEach(() => {
  workspace = createTestWorkspace();
  apps = [];
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(apps.map((app) => app.dispose()));
  workspace.cleanup();
});

/** Application sans réseau ni sortie console : faux `fetch` et pino silencieux. */
function appFor(config: AppConfig, fetch: HostRoutingFetch): Application {
  const app = composeApplication(config, {
    httpFetch: fetch.fetch,
    pinoLogger: pino({ level: 'silent' }),
  });
  apps.push(app);
  return app;
}

function wakeUpU1(app: Application): Promise<WakeUpReport> {
  return app.triggerWakeUp.execute({
    userId: UserId.parse('u1'),
    dayOfWeek: 'LUNDI',
    weather: 'PLUIE',
  });
}

describe('composeApplication — assemblage des dépendances', () => {
  it('[CA-CMP-01] assemble le cas d’usage TriggerWakeUp et ses dépendances', () => {
    const config = workspace.config();
    const app = appFor(config, new HostRoutingFetch());

    expect(app.triggerWakeUp).toBeInstanceOf(TriggerWakeUp);
    expect(app.musicCatalog).toBeDefined();
    expect(app.userPreferencesProvider).toBeDefined();
    expect(app.logger).toBeDefined();
    expect(app.config).toBe(config);
  });

  it('[CA-CMP-01] le cas d’usage assemblé fonctionne de bout en bout (préférences, musique, canal)', async () => {
    const fetch = new HostRoutingFetch().respondJson(
      ITUNES_HOST,
      loadFixture('itunes-search.json'),
    );
    const app = appFor(workspace.config(), fetch);

    const report = await wakeUpU1(app);

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
    const app = appFor(workspace.config(), new HostRoutingFetch());

    const types = app.notificationChannels.map((channel) => channel.type);
    expect([...types].sort()).toEqual(['EMAIL', 'PUSH', 'SMS']);
    expect(app.lastResortChannel.type).toBe('LOG');
  });

  it('[CA-CMP-01] branche le mock du service de préférences (utilisateurs du jeu de données)', async () => {
    const app = appFor(workspace.config(), new HostRoutingFetch());

    const preferences = await app.userPreferencesProvider.findByUserId(UserId.parse('u1'));

    expect(preferences?.preferredChannel).toBe('EMAIL');
  });
});

describe('composeApplication — chaîne musicale configurée par MUSIC_PROVIDERS', () => {
  it('[CA-CMP-02] ordre par défaut : iTunes puis MusicBrainz, puis morceau local', async () => {
    const fetch = new HostRoutingFetch();
    const app = appFor(workspace.config(), fetch);

    const track = await app.musicCatalog.resolve(QUERY);

    expect(fetch.hosts).toEqual([ITUNES_HOST, MUSICBRAINZ_HOST]);
    expect(track.source).toBe('local');
  });

  it('[CA-CMP-02] MUSIC_PROVIDERS=musicbrainz,itunes interroge MusicBrainz avant iTunes', async () => {
    const fetch = new HostRoutingFetch();
    const app = appFor(workspace.config({ MUSIC_PROVIDERS: 'musicbrainz,itunes' }), fetch);

    const track = await app.musicCatalog.resolve(QUERY);

    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST, ITUNES_HOST]);
    expect(track.source).toBe('local');
  });

  it('[CA-CMP-02] MUSIC_PROVIDERS=musicbrainz retire iTunes de la chaîne', async () => {
    const fetch = new HostRoutingFetch();
    const app = appFor(workspace.config({ MUSIC_PROVIDERS: 'musicbrainz' }), fetch);

    await app.musicCatalog.resolve(QUERY);

    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST]);
    expect(fetch.hosts).not.toContain(ITUNES_HOST);
  });

  it('[CA-CMP-02] MUSIC_PROVIDERS vide : aucun appel HTTP, morceau local', async () => {
    const fetch = new HostRoutingFetch();
    const app = appFor(workspace.config({ MUSIC_PROVIDERS: '' }), fetch);

    const track = await app.musicCatalog.resolve(QUERY);

    expect(fetch.hosts).toEqual([]);
    expect(track.source).toBe('local');
  });

  it('[CA-CMP-02] le premier fournisseur qui répond fournit le morceau', async () => {
    const fetch = new HostRoutingFetch().respondJson(
      MUSICBRAINZ_HOST,
      loadFixture('musicbrainz-recording.json'),
    );
    const app = appFor(workspace.config({ MUSIC_PROVIDERS: 'musicbrainz,itunes' }), fetch);

    const track = await app.musicCatalog.resolve(QUERY);

    expect(track.source).toBe('musicbrainz');
    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST]);
  });
});

describe('composeApplication — décorateurs de la chaîne musicale', () => {
  it('met en cache un morceau déjà résolu (un seul appel HTTP pour deux résolutions)', async () => {
    const fetch = new HostRoutingFetch().respondJson(
      ITUNES_HOST,
      loadFixture('itunes-search.json'),
    );
    const app = appFor(workspace.config({ MUSIC_PROVIDERS: 'itunes' }), fetch);
    const catalog = app.musicCatalog;

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
    const app = appFor(
      workspace.config({ MUSIC_PROVIDERS: 'itunes', ITUNES_MAX_REQUESTS_PER_MINUTE: '2' }),
      fetch,
    );
    const catalog = app.musicCatalog;

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
    const app = appFor(workspace.config({ MUSIC_PROVIDERS: 'musicbrainz' }), fetch);
    const catalog = app.musicCatalog;

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

describe('composeApplication — pannes simulées par SIMULATED_FAILURES', () => {
  it('[CA-CMP-05] « preferences » branche un service de préférences en panne', async () => {
    const app = appFor(
      workspace.config({ SIMULATED_FAILURES: 'preferences' }),
      new HostRoutingFetch(),
    );

    await expect(app.userPreferencesProvider.findByUserId(UserId.parse('u1'))).rejects.toThrow();
  });

  it('[CA-CMP-05] « itunes » simule la panne sans atteindre le réseau, la chaîne bascule', async () => {
    const fetch = new HostRoutingFetch()
      .respondJson(ITUNES_HOST, loadFixture('itunes-search.json'))
      .respondJson(MUSICBRAINZ_HOST, loadFixture('musicbrainz-recording.json'));
    const app = appFor(workspace.config({ SIMULATED_FAILURES: 'itunes' }), fetch);

    const track = await app.musicCatalog.resolve(QUERY);

    expect(track.source).toBe('musicbrainz');
    expect(fetch.hosts).toEqual([MUSICBRAINZ_HOST]);
  });

  it('[CA-CMP-05] « musicbrainz » simule la panne sans atteindre le réseau', async () => {
    const fetch = new HostRoutingFetch().respondJson(
      MUSICBRAINZ_HOST,
      loadFixture('musicbrainz-recording.json'),
    );
    const app = appFor(
      workspace.config({ MUSIC_PROVIDERS: 'musicbrainz', SIMULATED_FAILURES: 'musicbrainz' }),
      fetch,
    );

    const track = await app.musicCatalog.resolve(QUERY);

    expect(track.source).toBe('local');
    expect(fetch.hosts).toEqual([]);
  });

  it('[CA-CMP-05] « email » met le canal e-mail en panne : u1 est réveillé par un autre canal', async () => {
    const app = appFor(workspace.config({ SIMULATED_FAILURES: 'email' }), new HostRoutingFetch());

    const report = await wakeUpU1(app);

    expect(report.attempts[0]).toMatchObject({ channel: 'EMAIL', success: false });
    expect(['SMS', 'PUSH']).toContain(report.deliveredVia);
    expect(report.degraded).toBe(true);
  });

  it('[CA-CMP-05] « email,sms,push » : u1 est réveillé par le canal LOG de dernier recours', async () => {
    const app = appFor(
      workspace.config({ SIMULATED_FAILURES: 'email,sms,push' }),
      new HostRoutingFetch(),
    );

    const report = await wakeUpU1(app);

    // Ordre entre SMS et PUSH = ordre d'enregistrement, non imposé par les critères.
    const failed = report.attempts.slice(0, -1);
    expect(report.attempts[0]?.channel).toBe('EMAIL');
    expect(failed.map((attempt) => attempt.channel).sort()).toEqual(['EMAIL', 'PUSH', 'SMS']);
    expect(failed.every((attempt) => !attempt.success)).toBe(true);
    expect(report.attempts.at(-1)).toMatchObject({ channel: 'LOG', success: true });
    expect(report.deliveredVia).toBe('LOG');
  });
});
