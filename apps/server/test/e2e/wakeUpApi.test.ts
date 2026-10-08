import { existsSync, readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '../../src/config/env.ts';
import { composeApplication } from '../../src/composition/compositionRoot.ts';
import type { Application } from '../../src/composition/compositionRoot.ts';
import { buildHttpServer } from '../../src/http/buildHttpServer.ts';
import { HostRoutingFetch, ITUNES_HOST } from '../doubles/HostRoutingFetch.ts';
import { MemoryStream } from '../doubles/MemoryStream.ts';
import { createTestWorkspace } from '../doubles/testConfig.ts';
import type { TestWorkspace } from '../doubles/testConfig.ts';
import { loadFixture } from '../doubles/loadFixture.ts';

// Bout en bout sans réseau : vraie composition root + vrai serveur Fastify, interrogé par `inject()`.
// Seuls `fetch` (faux écrit à la main) et la sortie de pino (flux mémoire) sont remplacés.

const PINO_WARN = 40;

interface StartedApi {
  readonly http: FastifyInstance;
  readonly fetch: HostRoutingFetch;
  readonly logs: MemoryStream;
}

let workspace: TestWorkspace;
let app: Application | undefined;
let http: FastifyInstance | undefined;

beforeEach(() => {
  workspace = createTestWorkspace();
  app = undefined;
  http = undefined;
});

afterEach(async () => {
  await http?.close();
  await app?.dispose();
  workspace.cleanup();
});

function start(config: AppConfig, fetch: HostRoutingFetch): StartedApi {
  const logs = new MemoryStream();
  app = composeApplication(config, {
    httpFetch: fetch.fetch,
    pinoLogger: pino({ level: 'debug' }, logs),
  });
  http = buildHttpServer({
    triggerWakeUp: app.triggerWakeUp,
    logger: app.logger,
  });
  return { http, fetch, logs };
}

function notificationLog(): string {
  return existsSync(workspace.notificationLogFile)
    ? readFileSync(workspace.notificationLogFile, 'utf8')
    : '';
}

describe('API de réveil — bout en bout', () => {
  it('[CA-CMP-03] POST valide : 200 et rapport complet avec un morceau iTunes', async () => {
    const app = start(
      workspace.config(),
      new HostRoutingFetch().respondJson(ITUNES_HOST, loadFixture('itunes-search.json')),
    );

    const response = await app.http.inject({
      method: 'POST',
      url: '/api/wake-ups',
      payload: { userId: 'u1', dayOfWeek: 'LUNDI', weather: 'PLUIE' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: 'u1',
      dayOfWeek: 'LUNDI',
      weather: 'PLUIE',
      track: {
        title: 'Under Pressure (Single Version) [2017 Remastered Version]',
        artist: 'Queen & David Bowie',
        link: 'https://music.apple.com/us/album/under-pressure-single-version-2017-remastered-version/1255088551?i=1255089803&uo=4',
        source: 'itunes',
      },
      trackSource: 'itunes',
      deliveredVia: 'EMAIL',
      attempts: [{ channel: 'EMAIL', success: true }],
      degraded: false,
    });
    expect(notificationLog()).toContain('u1@example.org');
  });

  it('[CA-CMP-04] POST invalide : 400, aucun appel musical et aucune notification', async () => {
    const app = start(workspace.config(), new HostRoutingFetch());

    const response = await app.http.inject({
      method: 'POST',
      url: '/api/wake-ups',
      payload: { userId: 'u1', dayOfWeek: 'LUNDI', weather: 'ORAGE' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'INVALID_REQUEST' });
    expect(app.fetch.hosts).toEqual([]);
    expect(notificationLog()).toBe('');
  });

  it('[CA-CMP-05] tout en panne : 200, morceau local, remise au journal et avertissements', async () => {
    const app = start(
      workspace.config({
        SIMULATED_FAILURES: 'preferences,itunes,musicbrainz,email,sms,push',
      }),
      new HostRoutingFetch().rejectAll(),
    );

    const response = await app.http.inject({
      method: 'POST',
      url: '/api/wake-ups',
      payload: { userId: 'u1', dayOfWeek: 'LUNDI', weather: 'PLUIE' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      userId: 'u1',
      track: { source: 'local' },
      trackSource: 'local',
      deliveredVia: 'LOG',
      degraded: true,
    });
    expect(notificationLog()).toContain('u1');
    expect(app.logs.atLevel(PINO_WARN).length).toBeGreaterThanOrEqual(1);
  });

  it('[CA-CMP-05] fournisseurs et canaux en panne (préférences disponibles) : 200, morceau local, LOG', async () => {
    const app = start(
      workspace.config({ SIMULATED_FAILURES: 'itunes,musicbrainz,email,sms,push' }),
      new HostRoutingFetch().rejectAll(),
    );

    const response = await app.http.inject({
      method: 'POST',
      url: '/api/wake-ups',
      payload: { userId: 'u1', dayOfWeek: 'LUNDI', weather: 'PLUIE' },
    });

    expect(response.statusCode).toBe(200);
    const report = response.json<{
      attempts: ReadonlyArray<{ channel: string; success: boolean }>;
    }>();
    expect(report).toMatchObject({
      track: { source: 'local' },
      trackSource: 'local',
      deliveredVia: 'LOG',
      degraded: true,
    });
    // u1 a les trois coordonnées : chaque canal a été tenté (et a échoué) avant le dernier recours.
    expect(
      report.attempts
        .filter((attempt) => !attempt.success)
        .map((attempt) => attempt.channel)
        .sort(),
    ).toEqual(['EMAIL', 'PUSH', 'SMS']);
    expect(app.fetch.hosts).toEqual([]);
    expect(notificationLog()).toContain('u1');
    expect(app.logs.atLevel(PINO_WARN).length).toBeGreaterThanOrEqual(1);
  });

  it('GET /health répond 200', async () => {
    const app = start(workspace.config(), new HostRoutingFetch());

    const response = await app.http.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
