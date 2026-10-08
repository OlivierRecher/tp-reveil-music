import type { ChannelType } from './ChannelType.ts';
import type { DayOfWeek } from './DayOfWeek.ts';
import type { Track } from './Track.ts';
import type { WeatherType } from './WeatherType.ts';

/** Tentative d'envoi sur un canal. */
export interface DeliveryAttempt {
  readonly channel: ChannelType;
  readonly success: boolean;
  readonly error?: string;
}

/** Compte rendu d'un réveil, renvoyé à l'appelant et journalisé. */
export interface WakeUpReport {
  readonly userId: string;
  readonly dayOfWeek: DayOfWeek;
  readonly weather: WeatherType;
  readonly track: Track;
  readonly trackSource: string;
  readonly deliveredVia: ChannelType;
  readonly attempts: ReadonlyArray<DeliveryAttempt>;
  readonly degraded: boolean;
}
