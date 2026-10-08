import { describe, expect, it } from 'vitest';
import { requestWakeUp, type WakeUpRequest } from '../src/wakeUpApi.ts';
import { FakeHttpFetch } from './doubles/FakeHttpFetch.ts';
import { DEGRADED_REPORT, NOMINAL_REPORT } from './doubles/reports.ts';

const REQUEST: WakeUpRequest = { userId: 'alice', dayOfWeek: 'LUNDI', weather: 'SOLEIL' };

function onlyRequest(http: FakeHttpFetch): FakeHttpFetch['requests'][number] {
  expect(http.requests).toHaveLength(1);
  const [request] = http.requests;
  if (request === undefined) throw new Error('aucune requête envoyée');
  return request;
}

describe('requestWakeUp — appel de notre API', () => {
  it('[CA-WEB-02] envoie un POST sur l’URL relative /api/wake-ups (même origine)', async () => {
    const http = new FakeHttpFetch().respondJson(NOMINAL_REPORT);

    await requestWakeUp(REQUEST, http.fetch);

    const sent = onlyRequest(http);
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe('/api/wake-ups');
  });

  it('[CA-WEB-02] n’appelle jamais d’hôte externe (ni iTunes, ni MusicBrainz, ni URL absolue)', async () => {
    const http = new FakeHttpFetch().respondJson(NOMINAL_REPORT);

    await requestWakeUp(REQUEST, http.fetch);

    for (const sent of http.requests) {
      expect(sent.url).not.toMatch(/^[a-z][a-z0-9+.-]*:|^\/\//i);
      expect(sent.url).not.toMatch(/itunes|apple|musicbrainz/i);
    }
  });

  it('[CA-WEB-02] envoie le corps JSON exact { userId, dayOfWeek, weather }', async () => {
    const http = new FakeHttpFetch().respondJson(NOMINAL_REPORT);
    const request: WakeUpRequest = { userId: 'bob', dayOfWeek: 'DIMANCHE', weather: 'NUAGEUX' };

    await requestWakeUp(request, http.fetch);

    const sent = onlyRequest(http);
    expect(sent.headers.get('Content-Type')).toMatch(/^application\/json/);
    expect(sent.body).toBeDefined();
    const body: unknown = JSON.parse(sent.body ?? '');
    expect(body).toEqual({ userId: 'bob', dayOfWeek: 'DIMANCHE', weather: 'NUAGEUX' });
  });
});

describe('requestWakeUp — rapport reçu', () => {
  it('[CA-WEB-03] un rapport 200 est restitué intégralement (morceau, lien, canal, tentatives)', async () => {
    const http = new FakeHttpFetch().respondJson(NOMINAL_REPORT);

    await expect(requestWakeUp(REQUEST, http.fetch)).resolves.toEqual({
      kind: 'report',
      report: NOMINAL_REPORT,
    });
  });

  it('[CA-WEB-03] un rapport 200 sans lien de morceau est accepté', async () => {
    const http = new FakeHttpFetch().respondJson(DEGRADED_REPORT);

    await expect(requestWakeUp(REQUEST, http.fetch)).resolves.toEqual({
      kind: 'report',
      report: DEGRADED_REPORT,
    });
  });
  it('[CA-WEB-03] un rapport dont le canal est inconnu du client (ex. WHATSAPP) est accepté', async () => {
    const report = {
      ...NOMINAL_REPORT,
      deliveredVia: 'WHATSAPP',
      attempts: [
        { channel: 'SMS', success: false, error: 'passerelle SMS indisponible' },
        { channel: 'WHATSAPP', success: true },
      ],
    };
    const http = new FakeHttpFetch().respondJson(report);

    await expect(requestWakeUp(REQUEST, http.fetch)).resolves.toEqual({ kind: 'report', report });
  });

  it('les champs inconnus de la réponse sont ignorés et absents du rapport restitué', async () => {
    const http = new FakeHttpFetch().respondJson({
      ...NOMINAL_REPORT,
      internalTraceId: 'abc-123',
      track: { ...NOMINAL_REPORT.track, trackViewUrl: 'https://itunes.apple.com/x' },
      attempts: [{ channel: 'EMAIL', success: true, latencyMs: 12 }],
    });

    await expect(requestWakeUp(REQUEST, http.fetch)).resolves.toStrictEqual({
      kind: 'report',
      report: NOMINAL_REPORT,
    });
  });
});

describe('requestWakeUp — erreurs (jamais de rejet)', () => {
  it('[CA-WEB-05] une réponse 400 devient une erreur de saisie', async () => {
    const http = new FakeHttpFetch().respondJson(
      { error: 'INVALID_REQUEST', details: [{ path: ['weather'], message: 'Invalid option' }] },
      400,
    );

    const outcome = await requestWakeUp(REQUEST, http.fetch);

    expect(outcome.kind).toBe('invalid-request');
    if (outcome.kind !== 'invalid-request') return;
    expect(outcome.message).toMatch(/saisie|invalide/i);
  });

  it.each([
    ['500 JSON', (http: FakeHttpFetch) => http.respondJson({ error: 'INTERNAL_ERROR' }, 500)],
    ['503', (http: FakeHttpFetch) => http.respondText('Service Unavailable', 503)],
    ['500 au corps non JSON', (http: FakeHttpFetch) => http.respondText('<html>oops</html>', 500)],
    ['erreur réseau', (http: FakeHttpFetch) => http.failWithNetworkError()],
  ])('[CA-WEB-05] %s : « service indisponible », sans rejet', async (_case, script) => {
    const http = new FakeHttpFetch();
    script(http);

    const outcome = await requestWakeUp(REQUEST, http.fetch);

    expect(outcome.kind).toBe('unavailable');
    if (outcome.kind !== 'unavailable') return;
    expect(outcome.message).toMatch(/service indisponible/i);
  });

  it('[CA-WEB-05] une réponse 400 au corps non JSON reste une erreur de saisie, sans rejet', async () => {
    const http = new FakeHttpFetch().respondText('Bad Request', 400);

    await expect(requestWakeUp(REQUEST, http.fetch)).resolves.toMatchObject({
      kind: 'invalid-request',
    });
  });
});

describe('requestWakeUp — réponse 200 validée', () => {
  const trackWithoutTitle = { artist: 'The Beatles', source: 'itunes' };
  const reportWithoutDegraded = Object.fromEntries(
    Object.entries(NOMINAL_REPORT).filter(([key]) => key !== 'degraded'),
  );

  it.each([
    ['corps non JSON', (http: FakeHttpFetch) => http.respondText('pas du JSON', 200)],
    ['corps null', (http: FakeHttpFetch) => http.respondJson(null)],
    ['objet vide', (http: FakeHttpFetch) => http.respondJson({})],
    [
      'titre du morceau manquant',
      (http: FakeHttpFetch) => http.respondJson({ ...NOMINAL_REPORT, track: trackWithoutTitle }),
    ],
    ['degraded manquant', (http: FakeHttpFetch) => http.respondJson(reportWithoutDegraded)],
    [
      'degraded non booléen',
      (http: FakeHttpFetch) => http.respondJson({ ...NOMINAL_REPORT, degraded: 'false' }),
    ],
    [
      'tentatives qui ne sont pas une liste',
      (http: FakeHttpFetch) => http.respondJson({ ...NOMINAL_REPORT, attempts: 'EMAIL' }),
    ],
    [
      'tentative sans indicateur de succès',
      (http: FakeHttpFetch) =>
        http.respondJson({ ...NOMINAL_REPORT, attempts: [{ channel: 'EMAIL' }] }),
    ],
    [
      'canal utilisé vide',
      (http: FakeHttpFetch) => http.respondJson({ ...NOMINAL_REPORT, deliveredVia: '' }),
    ],
    [
      'canal de tentative vide',
      (http: FakeHttpFetch) =>
        http.respondJson({ ...NOMINAL_REPORT, attempts: [{ channel: '', success: true }] }),
    ],
    ['jour vide', (http: FakeHttpFetch) => http.respondJson({ ...NOMINAL_REPORT, dayOfWeek: '' })],
    [
      'météo non textuelle',
      (http: FakeHttpFetch) => http.respondJson({ ...NOMINAL_REPORT, weather: 3 }),
    ],
  ])(
    '[CA-WEB-06] %s : traité comme une erreur, jamais un rapport partiel',
    async (_case, script) => {
      const http = new FakeHttpFetch();
      script(http);

      const outcome = await requestWakeUp(REQUEST, http.fetch);

      expect(outcome.kind).toBe('unavailable');
      expect(outcome).not.toHaveProperty('report');
    },
  );
});
