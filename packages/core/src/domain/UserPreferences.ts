import { CHANNEL_TYPES } from './ChannelType.ts';
import type { ChannelType } from './ChannelType.ts';
import { TrackQuery } from './TrackQuery.ts';
import type { UserId } from './UserId.ts';
import type { WeatherType } from './WeatherType.ts';

export interface UserPreferencesProps {
  readonly userId: UserId;
  readonly tracksByWeather: Partial<Readonly<Record<WeatherType, TrackQuery>>>;
  readonly fallbackTrack: TrackQuery;
  readonly preferredChannel: ChannelType;
  readonly contacts: Partial<Readonly<Record<ChannelType, string>>>;
}

/** Morceau générique proposé quand les préférences de l'utilisateur sont indisponibles. */
const DEFAULT_FALLBACK_TRACK = TrackQuery.create({
  title: 'Here Comes the Sun',
  artist: 'The Beatles',
});

/** Préférences d'un utilisateur : morceau par météo (partiel), secours, canal, coordonnées. */
export class UserPreferences {
  readonly #userId: UserId;
  readonly #tracksByWeather: Partial<Readonly<Record<WeatherType, TrackQuery>>>;
  readonly #fallbackTrack: TrackQuery;
  readonly #preferredChannel: ChannelType;
  readonly #contacts: Partial<Readonly<Record<ChannelType, string>>>;

  private constructor(props: UserPreferencesProps) {
    this.#userId = props.userId;
    // Copies figées : l'appelant ne peut plus modifier les préférences après création.
    this.#tracksByWeather = Object.freeze({ ...props.tracksByWeather });
    this.#fallbackTrack = props.fallbackTrack;
    this.#preferredChannel = props.preferredChannel;
    this.#contacts = Object.freeze(normalizeContacts(props.contacts));
  }

  /** Une coordonnée vide ou blanche est considérée absente (canal indisponible, ARCHITECTURE §6). */
  static create(props: UserPreferencesProps): UserPreferences {
    return new UserPreferences(props);
  }

  /** Préférences du mode dégradé : aucune météo couverte, morceau générique, canal `LOG`. */
  static createDefault(userId: UserId): UserPreferences {
    return new UserPreferences({
      userId,
      tracksByWeather: {},
      fallbackTrack: DEFAULT_FALLBACK_TRACK,
      preferredChannel: 'LOG',
      contacts: {},
    });
  }

  get userId(): UserId {
    return this.#userId;
  }

  get fallbackTrack(): TrackQuery {
    return this.#fallbackTrack;
  }

  get preferredChannel(): ChannelType {
    return this.#preferredChannel;
  }

  trackFor(weather: WeatherType): TrackQuery | undefined {
    return this.#tracksByWeather[weather];
  }

  contactFor(channel: ChannelType): string | undefined {
    return this.#contacts[channel];
  }
}

function normalizeContacts(
  contacts: Partial<Readonly<Record<ChannelType, string>>>,
): Partial<Record<ChannelType, string>> {
  const normalized: Partial<Record<ChannelType, string>> = {};
  for (const channel of CHANNEL_TYPES) {
    const address = contacts[channel]?.trim();
    if (address !== undefined && address !== '') {
      normalized[channel] = address;
    }
  }
  return normalized;
}
