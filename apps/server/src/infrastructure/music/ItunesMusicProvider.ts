import { Track } from '@reveil/core';
import type { TrackQuery } from '@reveil/core';
import { z } from 'zod';
import type { HttpFetch } from '../http/HttpFetch.ts';
import { fetchProviderJson } from './fetchProviderJson.ts';
import type { MusicProvider } from './MusicProvider.ts';
import { MusicProviderUnavailableError } from './MusicProviderUnavailableError.ts';

const SEARCH_URL = 'https://itunes.apple.com/search';
const RESULT_LIMIT = 5;

/** Enveloppe de la réponse : les résultats sont validés un par un (types d'entités hétérogènes). */
const searchResponseSchema = z.object({ results: z.array(z.unknown()) });

/** Résultat exploitable : un morceau, avec titre et artiste. Les autres champs iTunes sont ignorés. */
const trackResultSchema = z.object({
  trackName: z.string().trim().min(1),
  artistName: z.string().trim().min(1),
  trackViewUrl: z.string().optional(),
});

interface Deps {
  readonly httpFetch: HttpFetch;
}

/** Adaptateur de l'API Search d'iTunes : traduit sa réponse en `Track` (anti-corruption layer). */
export class ItunesMusicProvider implements MusicProvider {
  readonly name = 'itunes';
  readonly #httpFetch: HttpFetch;

  constructor({ httpFetch }: Deps) {
    this.#httpFetch = httpFetch;
  }

  async resolve(query: TrackQuery): Promise<Track> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('term', query.toSearchTerm());
    url.searchParams.set('media', 'music');
    url.searchParams.set('limit', String(RESULT_LIMIT));

    const body = await fetchProviderJson(this.#httpFetch, this.name, url);
    const response = searchResponseSchema.safeParse(body);
    if (!response.success) {
      throw new MusicProviderUnavailableError(this.name, 'schéma de réponse invalide', {
        cause: response.error,
      });
    }

    // Premier morceau exploitable : iTunes peut mêler albums, artistes et morceaux.
    for (const candidate of response.data.results) {
      const result = trackResultSchema.safeParse(candidate);
      if (result.success) {
        // Traduction explicite : seuls les champs du domaine sortent de l'adaptateur.
        return Track.create({
          title: result.data.trackName,
          artist: result.data.artistName,
          link: result.data.trackViewUrl,
          source: this.name,
        });
      }
    }
    throw new MusicProviderUnavailableError(this.name, 'aucun morceau trouvé');
  }
}
