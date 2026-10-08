import { Track } from '@reveil/core';
import type { TrackQuery } from '@reveil/core';
import { z } from 'zod';
import type { HttpFetch } from '../http/HttpFetch.ts';
import { fetchProviderJson } from './fetchProviderJson.ts';
import type { MusicProvider } from './MusicProvider.ts';
import { MusicProviderUnavailableError } from './MusicProviderUnavailableError.ts';

const RECORDING_SEARCH_URL = 'https://musicbrainz.org/ws/2/recording';
const RECORDING_PAGE_URL = 'https://musicbrainz.org/recording/';

/**
 * Enveloppe de la réponse. Un corps `{ error }` (serveur occupé, requête invalide), même avec un
 * statut 200, n'a pas de `recordings` : il est rejeté ici.
 */
const searchResponseSchema = z.object({ recordings: z.array(z.unknown()) });

/** Enregistrement exploitable : identifiant, titre et au moins un artiste crédité. */
const recordingSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  'artist-credit': z
    .array(z.object({ name: z.string().trim().min(1), joinphrase: z.string().optional() }))
    .min(1),
});

type Recording = z.infer<typeof recordingSchema>;

interface Deps {
  readonly httpFetch: HttpFetch;
  readonly musicBrainzUserAgent: string;
}

/** Adaptateur de l'API MusicBrainz (`/ws/2/recording`) : traduit sa réponse en `Track`. */
export class MusicBrainzMusicProvider implements MusicProvider {
  readonly name = 'musicbrainz';
  readonly #httpFetch: HttpFetch;
  readonly #userAgent: string;

  constructor({ httpFetch, musicBrainzUserAgent }: Deps) {
    this.#httpFetch = httpFetch;
    this.#userAgent = musicBrainzUserAgent;
  }

  async resolve(query: TrackQuery): Promise<Track> {
    const url = new URL(RECORDING_SEARCH_URL);
    url.searchParams.set('query', luceneQuery(query));
    url.searchParams.set('fmt', 'json');

    // MusicBrainz refuse les clients anonymes : l'en-tête User-Agent est obligatoire.
    const body = await fetchProviderJson(this.#httpFetch, this.name, url, {
      'User-Agent': this.#userAgent,
    });
    const response = searchResponseSchema.safeParse(body);
    if (!response.success) {
      throw new MusicProviderUnavailableError(this.name, 'schéma de réponse invalide', {
        cause: response.error,
      });
    }

    for (const candidate of response.data.recordings) {
      const recording = recordingSchema.safeParse(candidate);
      if (recording.success) {
        return toTrack(recording.data, this.name);
      }
    }
    throw new MusicProviderUnavailableError(this.name, 'aucun enregistrement trouvé');
  }
}

/**
 * Requête Lucene par champs : la recherche plein texte remonte surtout des reprises, d'où
 * `recording:"…" AND artist:"…"` (l'artiste seulement s'il est connu).
 */
function luceneQuery(query: TrackQuery): string {
  const recording = `recording:${quoted(query.title)}`;
  return query.artist === undefined ? recording : `${recording} AND artist:${quoted(query.artist)}`;
}

/** Phrase Lucene entre guillemets : l'antislash est échappé AVANT le guillemet, sinon `\"` serait libéré. */
function quoted(text: string): string {
  return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/** Traduction vers le domaine : l'artiste est la concaténation des crédits (`name` + `joinphrase`). */
function toTrack(recording: Recording, source: string): Track {
  const artist = recording['artist-credit']
    .map((credit) => `${credit.name}${credit.joinphrase ?? ''}`)
    .join('');
  return Track.create({
    title: recording.title,
    artist,
    link: `${RECORDING_PAGE_URL}${encodeURIComponent(recording.id)}`,
    source,
  });
}
