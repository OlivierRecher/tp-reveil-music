import { describe, expect, it } from 'vitest';
import { Track, TrackQuery } from '@reveil/core';
import { ItunesMusicProvider } from '../../../src/infrastructure/music/ItunesMusicProvider.ts';
import { FakeHttpFetch } from './doubles/FakeHttpFetch.ts';
import { expectUnavailable, loadFixture } from './doubles/helpers.ts';

// Adaptateur iTunes testé contre une réponse réelle stockée en fixture : aucun accès réseau.

interface ItunesResult {
  readonly trackName?: unknown;
  readonly artistName?: unknown;
  readonly trackViewUrl?: unknown;
  readonly collectionName?: unknown;
}

interface ItunesFixture {
  resultCount: number;
  results: ItunesResult[];
}

function itunesFixture(): ItunesFixture {
  return loadFixture('itunes-search.json') as ItunesFixture;
}

function firstResult(fixture: ItunesFixture, index = 0): ItunesResult {
  const result = fixture.results[index];
  if (result === undefined) {
    throw new Error(`Fixture iTunes : résultat ${String(index)} absent`);
  }
  return result;
}

/** Résultat de type collection (album), sans `trackName` : réel quand iTunes mélange les entités. */
const ALBUM_RESULT = {
  wrapperType: 'collection',
  collectionType: 'Album',
  artistId: 3296287,
  collectionId: 1440650428,
  artistName: 'Queen',
  collectionName: 'Hot Space (Deluxe Edition 2011 Remaster)',
  collectionViewUrl: 'https://music.apple.com/fr/album/hot-space/1440650428?uo=4',
  artworkUrl100:
    'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/8a/9b/cc/8a9bcc5f/source/100x100bb.jpg',
  trackCount: 11,
  releaseDate: '1982-05-21T07:00:00Z',
  primaryGenreName: 'Rock',
} as const;

const QUERY = TrackQuery.create({ title: 'Under Pressure', artist: 'Queen' });

/** Valeurs du premier résultat de la capture réelle (voir test/fixtures/README.md). */
const EXPECTED_TITLE = 'Under Pressure (Single Version) [2017 Remastered Version]';
const EXPECTED_ARTIST = 'Queen & David Bowie';
const EXPECTED_LINK =
  'https://music.apple.com/us/album/under-pressure-single-version-2017-remastered-version/1255088551?i=1255089803&uo=4';

function setup(): { readonly http: FakeHttpFetch; readonly provider: ItunesMusicProvider } {
  const http = new FakeHttpFetch();
  return { http, provider: new ItunesMusicProvider({ httpFetch: http.fetch }) };
}

describe('ItunesMusicProvider', () => {
  it('se nomme « itunes »', () => {
    expect(setup().provider.name).toBe('itunes');
  });

  describe('appel HTTP', () => {
    it('[CA-MUS-01] appelle https://itunes.apple.com/search avec term, media=music et limit=5 (GET)', async () => {
      const { http, provider } = setup();
      http.respondJson(itunesFixture());

      await provider.resolve(QUERY);

      expect(http.requests).toHaveLength(1);
      const [request] = http.requests;
      const url = new URL(request?.url ?? '');
      expect(`${url.origin}${url.pathname}`).toBe('https://itunes.apple.com/search');
      // L'ordre des paramètres n'a pas de sens HTTP : seuls leur ensemble et leurs valeurs comptent.
      expect([...url.searchParams.entries()].sort()).toEqual(
        [
          ['term', QUERY.toSearchTerm()],
          ['media', 'music'],
          ['limit', '5'],
        ].sort(),
      );
      expect(request?.method).toBe('GET');
    });

    it('[CA-MUS-01] encode le terme de recherche (espaces, accents, &)', async () => {
      const { http, provider } = setup();
      http.respondJson(itunesFixture());
      const query = TrackQuery.create({ title: 'Rock & Roll Café', artist: 'Mylène Farmer' });

      await provider.resolve(query);

      const rawUrl = http.requests[0]?.url ?? '';
      // Aucun caractère brut (espace, accent) : uniquement de l'ASCII imprimable.
      expect(rawUrl).toMatch(/^[\x21-\x7E]+$/);
      const url = new URL(rawUrl);
      // Le « & » du titre ne coupe pas le paramètre : seuls term, media et limit existent.
      expect([...url.searchParams.keys()].sort()).toEqual(['limit', 'media', 'term']);
      expect(url.searchParams.get('term')).toBe('Mylène Farmer Rock & Roll Café');
    });
  });

  describe('traduction vers le domaine', () => {
    it('[CA-MUS-02] traduit trackName/artistName/trackViewUrl du premier résultat en Track (source itunes)', async () => {
      const { http, provider } = setup();
      const fixture = itunesFixture();
      http.respondJson(fixture);

      const track = await provider.resolve(QUERY);

      expect(track).toBeInstanceOf(Track);
      expect(track.title).toBe(EXPECTED_TITLE);
      expect(track.artist).toBe(EXPECTED_ARTIST);
      expect(track.link).toBe(EXPECTED_LINK);
      expect(track.link).toBe(firstResult(fixture).trackViewUrl);
      expect(track.source).toBe('itunes');
    });

    it("[CA-MUS-02] aucun champ propre à iTunes (trackViewUrl, trackName…) ne sort de l'adaptateur", async () => {
      const { http, provider } = setup();
      http.respondJson(itunesFixture());

      const track = await provider.resolve(QUERY);

      expect(Object.keys(track.toJSON()).sort()).toEqual(['artist', 'link', 'source', 'title']);
      const serialized = JSON.stringify(track);
      for (const itunesKey of [
        'trackViewUrl',
        'trackName',
        'artistName',
        'collectionName',
        'previewUrl',
        'wrapperType',
      ]) {
        expect(serialized).not.toContain(itunesKey);
        expect(itunesKey in track).toBe(false);
      }
    });

    it('[CA-MUS-02] ignore les résultats sans trackName et retient le premier morceau exploitable', async () => {
      const { http, provider } = setup();
      const fixture = itunesFixture();
      const firstTrack = firstResult(fixture);
      fixture.results = [ALBUM_RESULT, firstTrack];
      fixture.resultCount = fixture.results.length;
      http.respondJson(fixture);

      const track = await provider.resolve(QUERY);

      expect(track.title).toBe(EXPECTED_TITLE);
      expect(track.artist).toBe(EXPECTED_ARTIST);
      expect(track.link).toBe(EXPECTED_LINK);
      expect(track.link).toBe(firstTrack.trackViewUrl);
    });
  });

  describe('indisponibilité (erreur typée, jamais de crash)', () => {
    const cases: ReadonlyArray<readonly [string, (http: FakeHttpFetch) => void]> = [
      [
        'une réponse vide (resultCount 0)',
        (http) => http.respondJson({ resultCount: 0, results: [] }),
      ],
      [
        'une réponse sans aucun morceau exploitable',
        (http) => http.respondJson({ resultCount: 1, results: [ALBUM_RESULT] }),
      ],
      [
        'un JSON malformé',
        (http) => http.respondText('{"resultCount": 3, "results": [{"wrapperType": "tr', 200),
      ],
      [
        'un schéma invalide (results n’est pas un tableau)',
        (http) => http.respondJson({ resultCount: 1, results: 'Under Pressure' }),
      ],
      [
        'un schéma invalide (message d’erreur iTunes à la place des résultats)',
        (http) =>
          http.respondJson({
            errorMessage: 'Invalid value(s) for key(s): [mediaType]',
            queryParameters: { media: 'music', term: 'Queen Under Pressure' },
          }),
      ],
      ['une erreur HTTP 503', (http) => http.respondText('Service Unavailable', 503)],
      ['une erreur HTTP 403 (quota iTunes dépassé)', (http) => http.respondText('', 403)],
      ['une erreur réseau (fetch rejette)', (http) => http.failWith(new TypeError('fetch failed'))],
    ];

    it.each(cases)(
      '[CA-MUS-06] %s devient MusicProviderUnavailableError(itunes)',
      async (_label, script) => {
        const { http, provider } = setup();
        script(http);

        await expectUnavailable(provider.resolve(QUERY), 'itunes');
      },
    );
  });
});
