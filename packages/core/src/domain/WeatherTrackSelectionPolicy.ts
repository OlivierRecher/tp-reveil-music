import type { DayOfWeek } from './DayOfWeek.ts';
import type { TrackQuery } from './TrackQuery.ts';
import type { TrackSelectionPolicy } from './TrackSelectionPolicy.ts';
import type { UserPreferences } from './UserPreferences.ts';
import type { WeatherType } from './WeatherType.ts';

/** Météo couverte par les préférences → morceau dédié ; sinon morceau de secours. */
export class WeatherTrackSelectionPolicy implements TrackSelectionPolicy {
  select(preferences: UserPreferences, weather: WeatherType, dayOfWeek: DayOfWeek): TrackQuery {
    throw new Error('Not implemented', { cause: [preferences, weather, dayOfWeek] });
  }
}
