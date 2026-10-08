import type { EmergencyPlaylist, Track, TrackQuery, WeatherType } from '@reveil/core';
import type { MusicProvider } from './MusicProvider.ts';
import { LOCAL_TRACKS } from './localTracks.ts';

/**
 * Fallback local : dernier maillon de la chaîne musicale et `EmergencyPlaylist` du cas d'usage.
 * Ne dépend d'aucun réseau ; `resolve` ne rejette jamais et `pick` ne lève jamais.
 */
export class LocalMusicProvider implements MusicProvider, EmergencyPlaylist {
  readonly name = 'local';

  resolve(query: TrackQuery): Promise<Track> {
    return Promise.reject(new Error('Not implemented', { cause: { query, tracks: LOCAL_TRACKS } }));
  }

  pick(weather: WeatherType): Track {
    throw new Error('Not implemented', { cause: { weather, tracks: LOCAL_TRACKS } });
  }
}
