import { LOCAL_TRACK_SOURCE, Track } from '@reveil/core';
import type { EmergencyPlaylist, TrackQuery, WeatherType } from '@reveil/core';
import type { MusicProvider } from './MusicProvider.ts';
import { LOCAL_TRACKS } from './localTracks.ts';
import type { LocalTrackEntry } from './localTracks.ts';

/** Morceau de dernier recours si la playlist ne couvrait pas un cas : garantit l'absence d'exception. */
const DEFAULT_ENTRY: LocalTrackEntry = {
  weather: 'SOLEIL',
  title: 'Here Comes the Sun',
  artist: 'The Beatles',
};

/**
 * Fallback local : dernier maillon de la chaîne musicale et `EmergencyPlaylist` du cas d'usage.
 * Ne dépend d'aucun réseau ; `resolve` ne rejette jamais et `pick` ne lève jamais.
 */
export class LocalMusicProvider implements MusicProvider, EmergencyPlaylist {
  readonly name = LOCAL_TRACK_SOURCE;

  /**
   * Morceau local de même titre (casse, espaces et forme de l'apostrophe ignorés), sinon le premier
   * de la playlist : sans la météo, la requête ne permet pas de choisir mieux.
   */
  resolve(query: TrackQuery): Promise<Track> {
    const wanted = normalize(query.title);
    const entry = LOCAL_TRACKS.find((candidate) => normalize(candidate.title) === wanted);
    return Promise.resolve(toTrack(entry ?? LOCAL_TRACKS[0] ?? DEFAULT_ENTRY));
  }

  /** Premier morceau local prévu pour cette météo (choix déterministe). */
  pick(weather: WeatherType): Track {
    const entry = LOCAL_TRACKS.find((candidate) => candidate.weather === weather);
    return toTrack(entry ?? DEFAULT_ENTRY);
  }
}

/** Apostrophes typographiques (’ ‘ ʼ) et accent grave ramenés à l'apostrophe droite. */
const APOSTROPHES = /[\u2018\u2019\u02BC`]/g;

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(APOSTROPHES, "'").toLowerCase();
}

function toTrack(entry: LocalTrackEntry): Track {
  return Track.create({ title: entry.title, artist: entry.artist, source: LOCAL_TRACK_SOURCE });
}
