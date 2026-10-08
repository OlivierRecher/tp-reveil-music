import type { TrackQuery } from './TrackQuery.ts';
import type { TrackSelectionPolicy } from './TrackSelectionPolicy.ts';
import type { UserPreferences } from './UserPreferences.ts';
import type { WeatherType } from './WeatherType.ts';

/** Météo couverte par les préférences → morceau dédié ; sinon morceau de secours. */
export class WeatherTrackSelectionPolicy implements TrackSelectionPolicy {
  // Le jour n'influence pas le choix (ARCHITECTURE §6) : le paramètre du port est ignoré.
  select(preferences: UserPreferences, weather: WeatherType): TrackQuery {
    return preferences.trackFor(weather) ?? preferences.fallbackTrack;
  }
}
