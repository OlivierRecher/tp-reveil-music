import type { DayOfWeek } from './DayOfWeek.ts';
import type { Track } from './Track.ts';
import type { WeatherType } from './WeatherType.ts';

const DAY_LABELS: Readonly<Record<DayOfWeek, string>> = {
  LUNDI: 'lundi',
  MARDI: 'mardi',
  MERCREDI: 'mercredi',
  JEUDI: 'jeudi',
  VENDREDI: 'vendredi',
  SAMEDI: 'samedi',
  DIMANCHE: 'dimanche',
};

/** Phrase d'ouverture et ton du réveil selon la météo. */
const WEATHER_PHRASES: Readonly<
  Record<WeatherType, { readonly sky: string; readonly mood: string }>
> = {
  SOLEIL: { sky: "Grand soleil aujourd'hui", mood: "réveil plein d'énergie" },
  PLUIE: { sky: "Il pleut aujourd'hui", mood: 'réveil en douceur' },
  NEIGE: { sky: "Il neige aujourd'hui", mood: 'réveil au chaud' },
  NUAGEUX: { sky: "Ciel nuageux aujourd'hui", mood: 'réveil tout en nuances' },
};

/** Message de réveil (FR) : contient le titre, l'artiste, le jour et la météo. */
export class WakeUpMessage {
  readonly #subject: string;
  readonly #body: string;
  readonly #track: Track;
  readonly #dayOfWeek: DayOfWeek;
  readonly #weather: WeatherType;

  private constructor(
    subject: string,
    body: string,
    track: Track,
    dayOfWeek: DayOfWeek,
    weather: WeatherType,
  ) {
    this.#subject = subject;
    this.#body = body;
    this.#track = track;
    this.#dayOfWeek = dayOfWeek;
    this.#weather = weather;
  }

  static compose(track: Track, dayOfWeek: DayOfWeek, weather: WeatherType): WakeUpMessage {
    const subject = `Bon ${DAY_LABELS[dayOfWeek]} !`;
    const { sky, mood } = WEATHER_PHRASES[weather];
    const listen = track.link === undefined ? '' : ` Écouter : ${track.link}`;
    // Le corps se suffit à lui-même : SMS et push n'affichent pas l'objet.
    const body = `${subject} ${sky} : ${mood} avec « ${track.title} » de ${track.artist}.${listen}`;
    return new WakeUpMessage(subject, body, track, dayOfWeek, weather);
  }

  get subject(): string {
    return this.#subject;
  }

  get body(): string {
    return this.#body;
  }

  get track(): Track {
    return this.#track;
  }

  get dayOfWeek(): DayOfWeek {
    return this.#dayOfWeek;
  }

  get weather(): WeatherType {
    return this.#weather;
  }
}
