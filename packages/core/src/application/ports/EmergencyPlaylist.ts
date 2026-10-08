import type { Track } from '../../domain/Track.ts';
import type { WeatherType } from '../../domain/WeatherType.ts';

/** Port sortant : morceaux de secours locaux, dernier filet quand le catalogue échoue. */
export interface EmergencyPlaylist {
  /** Synchrone et ne lève jamais : renvoie toujours un morceau adapté à la météo. */
  pick(weather: WeatherType): Track;
}
