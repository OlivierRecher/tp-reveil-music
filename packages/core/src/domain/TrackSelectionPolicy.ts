import type { DayOfWeek } from './DayOfWeek.ts';
import type { TrackQuery } from './TrackQuery.ts';
import type { UserPreferences } from './UserPreferences.ts';
import type { WeatherType } from './WeatherType.ts';

/** Strategy : choisit le morceau à demander selon les préférences, la météo et le jour. */
export interface TrackSelectionPolicy {
  select(preferences: UserPreferences, weather: WeatherType, dayOfWeek: DayOfWeek): TrackQuery;
}
