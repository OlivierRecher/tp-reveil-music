import type { ChannelType } from './ChannelType.ts';
import type { TrackQuery } from './TrackQuery.ts';
import type { UserId } from './UserId.ts';
import type { WeatherType } from './WeatherType.ts';

export interface UserPreferencesProps {
  readonly userId: UserId;
  readonly tracksByWeather: Partial<Readonly<Record<WeatherType, TrackQuery>>>;
  readonly fallbackTrack: TrackQuery;
  readonly preferredChannel: ChannelType;
  readonly contacts: Partial<Readonly<Record<ChannelType, string>>>;
}

/** Préférences d'un utilisateur : morceau par météo (partiel), secours, canal, coordonnées. */
export class UserPreferences {
  private constructor() {}

  static create(props: UserPreferencesProps): UserPreferences {
    throw new Error('Not implemented', { cause: props });
  }

  /** Préférences du mode dégradé : aucune météo couverte, morceau générique, canal `LOG`. */
  static createDefault(userId: UserId): UserPreferences {
    throw new Error('Not implemented', { cause: userId });
  }

  get userId(): UserId {
    throw new Error('Not implemented');
  }

  get fallbackTrack(): TrackQuery {
    throw new Error('Not implemented');
  }

  get preferredChannel(): ChannelType {
    throw new Error('Not implemented');
  }

  trackFor(weather: WeatherType): TrackQuery | undefined {
    throw new Error('Not implemented', { cause: weather });
  }

  contactFor(channel: ChannelType): string | undefined {
    throw new Error('Not implemented', { cause: channel });
  }
}
