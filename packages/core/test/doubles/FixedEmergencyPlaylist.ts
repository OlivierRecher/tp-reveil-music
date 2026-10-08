import type { EmergencyPlaylist, Track, WeatherType } from '../../src/index.ts';

/** Playlist de secours qui renvoie toujours le même morceau et mémorise les météos demandées. */
export class FixedEmergencyPlaylist implements EmergencyPlaylist {
  readonly #track: Track;
  readonly picked: WeatherType[] = [];

  constructor(track: Track) {
    this.#track = track;
  }

  pick(weather: WeatherType): Track {
    this.picked.push(weather);
    return this.#track;
  }
}
