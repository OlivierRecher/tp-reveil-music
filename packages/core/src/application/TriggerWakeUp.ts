import type { DayOfWeek } from '../domain/DayOfWeek.ts';
import type { TrackSelectionPolicy } from '../domain/TrackSelectionPolicy.ts';
import type { UserId } from '../domain/UserId.ts';
import type { WakeUpReport } from '../domain/WakeUpReport.ts';
import type { WeatherType } from '../domain/WeatherType.ts';
import type { NotificationDispatcher } from './NotificationDispatcher.ts';
import type { EmergencyPlaylist } from './ports/EmergencyPlaylist.ts';
import type { Logger } from './ports/Logger.ts';
import type { MusicCatalog } from './ports/MusicCatalog.ts';
import type { UserPreferencesProvider } from './ports/UserPreferencesProvider.ts';

/** Demande de réveil : `triggerWakeUp(userId, dayOfWeek, weather)`. */
export interface WakeUpCommand {
  readonly userId: UserId;
  readonly dayOfWeek: DayOfWeek;
  readonly weather: WeatherType;
}

interface Deps {
  readonly userPreferencesProvider: UserPreferencesProvider;
  readonly musicCatalog: MusicCatalog;
  readonly emergencyPlaylist: EmergencyPlaylist;
  readonly trackSelectionPolicy: TrackSelectionPolicy;
  readonly notificationDispatcher: NotificationDispatcher;
  readonly logger: Logger;
}

/** Cas d'usage : choisit un morceau et notifie l'utilisateur ; ne lève jamais (mode dégradé). */
export class TriggerWakeUp {
  readonly #deps: Deps;

  constructor(deps: Deps) {
    this.#deps = deps;
  }

  execute(command: WakeUpCommand): Promise<WakeUpReport> {
    return Promise.reject(new Error('Not implemented', { cause: [this.#deps, command] }));
  }
}
