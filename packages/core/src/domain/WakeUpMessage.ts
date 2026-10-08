import type { DayOfWeek } from './DayOfWeek.ts';
import type { Track } from './Track.ts';
import type { WeatherType } from './WeatherType.ts';

/** Message de réveil (FR) : contient le titre, l'artiste, le jour et la météo. */
export class WakeUpMessage {
  private constructor() {}

  static compose(track: Track, dayOfWeek: DayOfWeek, weather: WeatherType): WakeUpMessage {
    throw new Error('Not implemented', { cause: [track, dayOfWeek, weather] });
  }

  get subject(): string {
    throw new Error('Not implemented');
  }

  get body(): string {
    throw new Error('Not implemented');
  }

  get track(): Track {
    throw new Error('Not implemented');
  }

  get dayOfWeek(): DayOfWeek {
    throw new Error('Not implemented');
  }

  get weather(): WeatherType {
    throw new Error('Not implemented');
  }
}
