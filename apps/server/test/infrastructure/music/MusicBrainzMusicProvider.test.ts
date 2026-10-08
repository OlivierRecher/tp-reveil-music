import { describe, expect, it } from 'vitest';
import { Track, TrackQuery } from '@reveil/core';
import { MusicBrainzMusicProvider } from '../../../src/infrastructure/music/MusicBrainzMusicProvider.ts';
import { FakeHttpFetch } from './doubles/FakeHttpFetch.ts';
import { loadFixture } from '../../doubles/loadFixture.ts';
import { expectUnavailable } from './doubles/helpers.ts';

// Adaptateur MusicBrainz testé contre une réponse réelle stockée en fixture : aucun accès réseau.

interface ArtistCredit {
  readonly name: string;
  readonly joinphrase?: string;
  readonly artist: { readonly id: string; readonly name: string; readonly 'sort-name': string };
}

interface MusicBrainzRecording {
  readonly id: string;
  readonly title: string;
  'artist-credit': ArtistCredit[];
}

interface MusicBrainzFixture {
  count: number;
  recordings: MusicBrainzRecording[];
}

function musicBrainzFixture(): MusicBrainzFixture {
  return loadFixture('musicbrainz-recording.json') as MusicBrainzFixture;
}

function firstRecording(fixture: MusicBrainzFixture): MusicBrainzRecording {
  const recording = fixture.recordings[0];
  if (recording === undefined) {
    throw new Error('Fixture MusicBrainz : aucun enregistrement');
  }
  return recording;
}

const USER_AGENT = 'ReveilMusical/0.1.0 ( reveil@example.org )';
const QUERY = TrackQuery.create({ title: 'Under Pressure', artist: 'Queen' });

/**
 * Requête Lucene par champs attendue pour QUERY : la recherche plein texte renvoie surtout des
 * reprises (constaté sur capture réelle), d'où `recording:"…" AND artist:"…"`.
 */
const EXPECTED_LUCENE_QUERY = 'recording:"Under Pressure" AND artist:"Queen"';

/** Identifiant du premier enregistrement de la capture réelle (voir test/fixtures/README.md). */
const EXPECTED_RECORDING_ID = 'ec256b84-fd49-4dd0-baff-8480b58b5e1e';

function setup(): { readonly http: FakeHttpFetch; readonly provider: MusicBrainzMusicProvider } {
  const http = new FakeHttpFetch();
  const provider = new MusicBrainzMusicProvider({
    httpFetch: http.fetch,
    musicBrainzUserAgent: USER_AGENT,
  });
  return { http, provider };
}

describe('MusicBrainzMusicProvider', () => {
  it('se nomme « musicbrainz »', () => {
    expect(setup().provider.name).toBe('musicbrainz');
  });

  describe('appel HTTP', () => {
    it('[CA-MUS-03] appelle https://musicbrainz.org/ws/2/recording avec query (Lucene par champs) et fmt=json (GET)', async () => {
      const { http, provider } = setup();
      http.respondJson(musicBrainzFixture());

      await provider.resolve(QUERY);

      expect(http.requests).toHaveLength(1);
      const [request] = http.requests;
      const url = new URL(request?.url ?? '');
      expect(`${url.origin}${url.pathname}`).toBe('https://musicbrainz.org/ws/2/recording');
      // L'ordre des paramètres n'a pas de sens HTTP : seuls leur ensemble et leurs valeurs comptent.
      expect([...url.searchParams.entries()].sort()).toEqual(
        [
          ['query', EXPECTED_LUCENE_QUERY],
          ['fmt', 'json'],
        ].sort(),
      );
      expect(request?.method).toBe('GET');
    });

    it('[CA-MUS-03] sans artiste, query ne porte que sur le titre : recording:"<titre>"', async () => {
      const { http, provider } = setup();
      http.respondJson(musicBrainzFixture());

      await provider.resolve(TrackQuery.create({ title: 'Under Pressure' }));

      const url = new URL(http.requests[0]?.url ?? '');
      expect(url.searchParams.get('query')).toBe('recording:"Under Pressure"');
    });

    it('[CA-MUS-03] échappe les guillemets du titre et de l’artiste par un antislash', async () => {
      const { http, provider } = setup();
      http.respondJson(musicBrainzFixture());

      await provider.resolve(
        TrackQuery.create({ title: 'The "Real" Slim Shady', artist: 'Marshall "Em" Mathers' }),
      );

      const url = new URL(http.requests[0]?.url ?? '');
      expect(url.searchParams.get('query')).toBe(
        'recording:"The \\"Real\\" Slim Shady" AND artist:"Marshall \\"Em\\" Mathers"',
      );
    });

    it('[CA-MUS-03] échappe l’antislash avant les guillemets (pas de guillemet libéré)', async () => {
      const { http, provider } = setup();
      http.respondJson(musicBrainzFixture());

      await provider.resolve(TrackQuery.create({ title: 'Back\\"Slash', artist: 'AC\\DC' }));

      const url = new URL(http.requests[0]?.url ?? '');
      // Back\"Slash -> Back\\\"Slash ; AC\DC -> AC\\DC
      expect(url.searchParams.get('query')).toBe(
        'recording:"Back\\\\\\"Slash" AND artist:"AC\\\\DC"',
      );
    });

    it('[CA-MUS-03] envoie l’en-tête User-Agent configuré', async () => {
      const { http, provider } = setup();
      http.respondJson(musicBrainzFixture());

      await provider.resolve(QUERY);

      expect(http.requests[0]?.headers.get('User-Agent')).toBe(USER_AGENT);
    });

    it('[CA-MUS-03] encode le terme de recherche (espaces, accents, &)', async () => {
      const { http, provider } = setup();
      http.respondJson(musicBrainzFixture());
      const query = TrackQuery.create({ title: 'Rock & Roll Café', artist: 'Mylène Farmer' });

      await provider.resolve(query);

      const rawUrl = http.requests[0]?.url ?? '';
      expect(rawUrl).toMatch(/^[\x21-\x7E]+$/);
      const url = new URL(rawUrl);
      expect([...url.searchParams.keys()].sort()).toEqual(['fmt', 'query']);
      expect(url.searchParams.get('query')).toBe(
        'recording:"Rock & Roll Café" AND artist:"Mylène Farmer"',
      );
    });
  });

  describe('traduction vers le domaine', () => {
    it('[CA-MUS-05] traduit title et artist-credit (name + joinphrase) du premier enregistrement', async () => {
      const { http, provider } = setup();
      const fixture = musicBrainzFixture();
      http.respondJson(fixture);

      const track = await provider.resolve(QUERY);

      expect(track).toBeInstanceOf(Track);
      expect(track.title).toBe('Under Pressure');
      expect(track.artist).toBe('Queen & David Bowie');
      expect(track.source).toBe('musicbrainz');
    });

    it('construit le lien vers la page MusicBrainz de l’enregistrement retenu', async () => {
      const { http, provider } = setup();
      const fixture = musicBrainzFixture();
      http.respondJson(fixture);

      const track = await provider.resolve(QUERY);

      expect(firstRecording(fixture).id).toBe(EXPECTED_RECORDING_ID);
      expect(track.link).toBe(`https://musicbrainz.org/recording/${EXPECTED_RECORDING_ID}`);
    });

    it('[CA-MUS-05] un crédit unique sans joinphrase donne le seul nom crédité', async () => {
      const { http, provider } = setup();
      const fixture = musicBrainzFixture();
      const recording = firstRecording(fixture);
      recording['artist-credit'] = [
        {
          name: 'David Bowie',
          artist: {
            id: '5441c29d-3602-4898-b1a1-b77fa23b8e50',
            name: 'David Bowie',
            'sort-name': 'Bowie, David',
          },
        },
      ];
      http.respondJson(fixture);

      const track = await provider.resolve(QUERY);

      expect(track.artist).toBe('David Bowie');
    });

    it("[CA-MUS-05] aucun champ propre à MusicBrainz (artist-credit, joinphrase…) ne sort de l'adaptateur", async () => {
      const { http, provider } = setup();
      http.respondJson(musicBrainzFixture());

      const track = await provider.resolve(QUERY);

      expect(Object.keys(track.toJSON()).sort()).toEqual(['artist', 'link', 'source', 'title']);
      const serialized = JSON.stringify(track);
      for (const musicBrainzKey of [
        'artist-credit',
        'joinphrase',
        'sort-name',
        'releases',
        'score',
      ]) {
        expect(serialized).not.toContain(musicBrainzKey);
        expect(musicBrainzKey in track).toBe(false);
      }
    });
  });

  describe('indisponibilité (erreur typée, jamais de crash)', () => {
    const cases: ReadonlyArray<readonly [string, (http: FakeHttpFetch) => void]> = [
      [
        'une réponse vide (recordings [])',
        (http) =>
          http.respondJson({
            created: '2026-10-08T07:12:43.118Z',
            count: 0,
            offset: 0,
            recordings: [],
          }),
      ],
      [
        'un JSON malformé',
        (http) =>
          http.respondText('{"created":"2026-10-08T07:12:43.118Z","recordings":[{"id"', 200),
      ],
      [
        'un schéma invalide (enregistrement sans titre ni artist-credit)',
        (http) =>
          http.respondJson({
            created: '2026-10-08T07:12:43.118Z',
            count: 1,
            offset: 0,
            recordings: [{ id: '32c7e292-14f1-4080-bddf-ef852e0a4c59', score: 100 }],
          }),
      ],
      [
        'un schéma invalide (message d’erreur MusicBrainz à la place des résultats)',
        (http) =>
          http.respondJson({
            error: 'Invalid query',
            help: 'For usage, please see: https://musicbrainz.org/development/mmd',
          }),
      ],
      [
        'une erreur HTTP 503 (limite de débit MusicBrainz)',
        (http) =>
          http.respondJson({ error: 'Your requests are exceeding the allowable rate limit.' }, 503),
      ],
      [
        'une erreur HTTP 503 avec le corps réel « serveur occupé »',
        (http) => http.respondJson(loadFixture('musicbrainz-busy.json'), 503),
      ],
      [
        'un corps {error} réel (« serveur occupé ») renvoyé avec un statut 200',
        (http) => http.respondJson(loadFixture('musicbrainz-busy.json')),
      ],
      ['une erreur réseau (fetch rejette)', (http) => http.failWith(new TypeError('fetch failed'))],
    ];

    it.each(cases)(
      '[CA-MUS-06] %s devient MusicProviderUnavailableError(musicbrainz)',
      async (_label, script) => {
        const { http, provider } = setup();
        script(http);

        await expectUnavailable(provider.resolve(QUERY), 'musicbrainz');
      },
    );
  });
});
