import { Track } from '@reveil/core';
import type { WakeUpReport } from '@reveil/core';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildHttpServer } from '../../src/http/buildHttpServer.ts';
import { RecordingLogger } from '../doubles/RecordingLogger.ts';
import { RecordingTriggerWakeUp } from './doubles/RecordingTriggerWakeUp.ts';

const VALID_BODY = { userId: 'u1', dayOfWeek: 'LUNDI', weather: 'PLUIE' } as const;

const REPORT: WakeUpReport = {
  userId: 'u1',
  dayOfWeek: 'LUNDI',
  weather: 'PLUIE',
  track: Track.create({
    title: 'Riders on the Storm',
    artist: 'The Doors',
    link: 'https://music.example/riders',
    source: 'itunes',
  }),
  trackSource: 'itunes',
  deliveredVia: 'SMS',
  attempts: [
    { channel: 'EMAIL', success: false, error: 'panne simulée' },
    { channel: 'SMS', success: true },
  ],
  degraded: true,
};

let useCase: RecordingTriggerWakeUp;
let logger: RecordingLogger;
let app: FastifyInstance | undefined;

beforeEach(() => {
  useCase = new RecordingTriggerWakeUp(REPORT);
  logger = new RecordingLogger();
  app = undefined;
});

afterEach(async () => {
  await app?.close();
});

function server(): FastifyInstance {
  app = buildHttpServer({ triggerWakeUp: useCase, logger });
  return app;
}

function postWakeUp(options: Omit<InjectOptions, 'method' | 'url'>) {
  return server().inject({ method: 'POST', url: '/api/wake-ups', ...options });
}

describe('POST /api/wake-ups — requête valide', () => {
  it('[CA-CMP-03] renvoie 200 et le rapport de réveil sérialisé', async () => {
    const response = await postWakeUp({ payload: VALID_BODY });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: 'u1',
      dayOfWeek: 'LUNDI',
      weather: 'PLUIE',
      track: {
        title: 'Riders on the Storm',
        artist: 'The Doors',
        link: 'https://music.example/riders',
        source: 'itunes',
      },
      trackSource: 'itunes',
      deliveredVia: 'SMS',
      attempts: [
        { channel: 'EMAIL', success: false, error: 'panne simulée' },
        { channel: 'SMS', success: true },
      ],
      degraded: true,
    });
  });

  it('[CA-CMP-03] transmet au cas d’usage une commande du domaine (value objects)', async () => {
    await postWakeUp({ payload: VALID_BODY });

    expect(useCase.calls).toBe(1);
    const [command] = useCase.commands;
    expect(command?.userId.value).toBe('u1');
    expect(command?.dayOfWeek).toBe('LUNDI');
    expect(command?.weather).toBe('PLUIE');
  });
});

describe('POST /api/wake-ups — requête invalide', () => {
  it.each([
    ['une météo inconnue', { ...VALID_BODY, weather: 'ORAGE' }, 'weather'],
    ['une météo en minuscules', { ...VALID_BODY, weather: 'pluie' }, 'weather'],
    ['une météo non textuelle', { ...VALID_BODY, weather: 3 }, 'weather'],
    ['un jour inconnu', { ...VALID_BODY, dayOfWeek: 'FUNDAY' }, 'dayOfWeek'],
    ['un jour en anglais', { ...VALID_BODY, dayOfWeek: 'MONDAY' }, 'dayOfWeek'],
    ['un identifiant vide', { ...VALID_BODY, userId: '' }, 'userId'],
    ['un identifiant composé d’espaces', { ...VALID_BODY, userId: '   ' }, 'userId'],
    ['un identifiant non textuel', { ...VALID_BODY, userId: 42 }, 'userId'],
    ['la météo manquante', { userId: 'u1', dayOfWeek: 'LUNDI' }, 'weather'],
    ['le jour manquant', { userId: 'u1', weather: 'PLUIE' }, 'dayOfWeek'],
    ['l’identifiant manquant', { dayOfWeek: 'LUNDI', weather: 'PLUIE' }, 'userId'],
  ])(
    '[CA-CMP-04] refuse %s (400) sans déclencher d’envoi',
    async (_label, payload, invalidField) => {
      const response = await postWakeUp({ payload });

      expect(response.statusCode).toBe(400);
      const body = response.json<{ error: string; details: unknown }>();
      expect(body.error).toBe('INVALID_REQUEST');
      expect(Array.isArray(body.details)).toBe(true);
      expect(body.details).not.toHaveLength(0);
      expect(JSON.stringify(body.details)).toContain(invalidField);
      expect(useCase.calls).toBe(0);
    },
  );

  it('[CA-CMP-04] refuse un corps absent (400) sans déclencher d’envoi', async () => {
    const response = await postWakeUp({});

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'INVALID_REQUEST' });
    expect(useCase.calls).toBe(0);
  });

  it('[CA-CMP-04] refuse un corps qui n’est pas un objet JSON (400) sans déclencher d’envoi', async () => {
    const response = await postWakeUp({ payload: ['u1', 'LUNDI', 'PLUIE'] });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'INVALID_REQUEST' });
    expect(useCase.calls).toBe(0);
  });

  it('[CA-CMP-04] refuse un JSON malformé (400) sans déclencher d’envoi', async () => {
    const response = await postWakeUp({
      payload: '{"userId": "u1", "dayOfWeek": ',
      headers: { 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'INVALID_REQUEST' });
    expect(useCase.calls).toBe(0);
  });

  it('refuse un corps qui n’est pas du JSON (text/plain → 400 ou 415) sans déclencher d’envoi', async () => {
    const response = await postWakeUp({
      payload: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'text/plain' },
    });

    // Statut au choix de l'implémentation (décision d'équipe) : 400 (corps invalide) ou 415.
    expect([400, 415]).toContain(response.statusCode);
    expect(useCase.calls).toBe(0);
  });
});

describe('Gestion d’erreurs centralisée', () => {
  it('renvoie un 500 générique sans fuite de détail quand le cas d’usage lève', async () => {
    useCase.failWith(new Error('secret-interne: connexion refusée à db:5432'));

    const response = await postWakeUp({ payload: VALID_BODY });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'INTERNAL_ERROR' });
    expect(response.body).not.toContain('secret-interne');
    expect(response.body).not.toContain('db:5432');
  });

  it('journalise l’erreur inattendue (jamais de silence)', async () => {
    useCase.failWith(new Error('secret-interne: connexion refusée à db:5432'));

    await postWakeUp({ payload: VALID_BODY });

    expect(logger.at('error').length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /health', () => {
  it('renvoie 200 et { status: "ok" }', async () => {
    const response = await server().inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
