// API publique du noyau métier : seul point d'import autorisé depuis les applications.

// Erreurs du domaine
export { DomainError } from './domain/DomainError.ts';
export { InvalidWeatherError } from './domain/InvalidWeatherError.ts';
export { InvalidDayOfWeekError } from './domain/InvalidDayOfWeekError.ts';
export { InvalidUserIdError } from './domain/InvalidUserIdError.ts';
export { InvalidTrackError } from './domain/InvalidTrackError.ts';
export { InvalidTrackQueryError } from './domain/InvalidTrackQueryError.ts';

// Énumérations
export { WEATHER_TYPES, isWeatherType, parseWeatherType } from './domain/WeatherType.ts';
export type { WeatherType } from './domain/WeatherType.ts';
export { DAYS_OF_WEEK, isDayOfWeek, parseDayOfWeek } from './domain/DayOfWeek.ts';
export type { DayOfWeek } from './domain/DayOfWeek.ts';
export { CHANNEL_TYPES, isChannelType } from './domain/ChannelType.ts';
export type { ChannelType } from './domain/ChannelType.ts';

// Value objects
export { UserId } from './domain/UserId.ts';
export { TrackQuery } from './domain/TrackQuery.ts';
export type { TrackQueryProps } from './domain/TrackQuery.ts';
export { Track, LOCAL_TRACK_SOURCE } from './domain/Track.ts';
export type { TrackProps, TrackJson } from './domain/Track.ts';
export type { Recipient } from './domain/Recipient.ts';
export { UserPreferences } from './domain/UserPreferences.ts';
export type { UserPreferencesProps } from './domain/UserPreferences.ts';
export { WakeUpMessage } from './domain/WakeUpMessage.ts';
export type { DeliveryAttempt, WakeUpReport } from './domain/WakeUpReport.ts';

// Règles de sélection (Strategy)
export type { TrackSelectionPolicy } from './domain/TrackSelectionPolicy.ts';
export { WeatherTrackSelectionPolicy } from './domain/WeatherTrackSelectionPolicy.ts';

// Ports (contrats des adaptateurs)
export type { UserPreferencesProvider } from './application/ports/UserPreferencesProvider.ts';
export type { MusicCatalog, ResolvedTrack } from './application/ports/MusicCatalog.ts';
export type { EmergencyPlaylist } from './application/ports/EmergencyPlaylist.ts';
export type { NotificationChannel } from './application/ports/NotificationChannel.ts';
export type { Logger, LogContext } from './application/ports/Logger.ts';

// Application
export { NotificationDispatcher } from './application/NotificationDispatcher.ts';
export type { DispatchResult } from './application/NotificationDispatcher.ts';
export { TriggerWakeUp } from './application/TriggerWakeUp.ts';
export { describeError } from './application/describeError.ts';
export type { WakeUpCommand } from './application/TriggerWakeUp.ts';
