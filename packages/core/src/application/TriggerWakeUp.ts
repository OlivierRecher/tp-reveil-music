import type { DayOfWeek } from '../domain/DayOfWeek.ts';
import { LOCAL_TRACK_SOURCE } from '../domain/Track.ts';
import type { Track } from '../domain/Track.ts';
import type { TrackSelectionPolicy } from '../domain/TrackSelectionPolicy.ts';
import type { UserId } from '../domain/UserId.ts';
import { UserPreferences } from '../domain/UserPreferences.ts';
import { WakeUpMessage } from '../domain/WakeUpMessage.ts';
import type { WakeUpReport } from '../domain/WakeUpReport.ts';
import type { WeatherType } from '../domain/WeatherType.ts';
import type { DispatchResult, NotificationDispatcher } from './NotificationDispatcher.ts';
import { describeError } from './describeError.ts';
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

/** Résultat d'une étape : la valeur obtenue et l'indication d'une bascule en mode dégradé. */
interface StepOutcome<T> {
  readonly value: T;
  readonly degraded: boolean;
}

/** Cas d'usage : choisit un morceau et notifie l'utilisateur ; ne lève jamais (mode dégradé). */
export class TriggerWakeUp {
  readonly #userPreferencesProvider: UserPreferencesProvider;
  readonly #musicCatalog: MusicCatalog;
  readonly #emergencyPlaylist: EmergencyPlaylist;
  readonly #trackSelectionPolicy: TrackSelectionPolicy;
  readonly #notificationDispatcher: NotificationDispatcher;
  readonly #logger: Logger;

  constructor({
    userPreferencesProvider,
    musicCatalog,
    emergencyPlaylist,
    trackSelectionPolicy,
    notificationDispatcher,
    logger,
  }: Deps) {
    this.#userPreferencesProvider = userPreferencesProvider;
    this.#musicCatalog = musicCatalog;
    this.#emergencyPlaylist = emergencyPlaylist;
    this.#trackSelectionPolicy = trackSelectionPolicy;
    this.#notificationDispatcher = notificationDispatcher;
    this.#logger = logger;
  }

  async execute(command: WakeUpCommand): Promise<WakeUpReport> {
    const { userId, dayOfWeek, weather } = command;
    this.#logger.info('Déclenchement du réveil', { userId: userId.value, dayOfWeek, weather });

    const preferences = await this.#loadPreferences(userId);
    const track = await this.#chooseTrack(preferences.value, command);
    const message = WakeUpMessage.compose(track.value, dayOfWeek, weather);
    const dispatch = await this.#notificationDispatcher.dispatch(preferences.value, message);
    const deliveryDegraded = this.#isDeliveryDegraded(preferences.value, dispatch);

    const report: WakeUpReport = {
      userId: userId.value,
      dayOfWeek,
      weather,
      track: track.value,
      trackSource: track.value.source,
      deliveredVia: dispatch.deliveredVia,
      attempts: dispatch.attempts,
      degraded: preferences.degraded || track.degraded || deliveryDegraded,
    };
    this.#logger.info('Réveil émis', {
      userId: report.userId,
      trackSource: report.trackSource,
      deliveredVia: report.deliveredVia,
      degraded: report.degraded,
    });
    return report;
  }

  /** Panne du service ou utilisateur inconnu → préférences par défaut. */
  async #loadPreferences(userId: UserId): Promise<StepOutcome<UserPreferences>> {
    try {
      const found = await this.#userPreferencesProvider.findByUserId(userId);
      if (found !== null) {
        return { value: found, degraded: false };
      }
      this.#logger.warn('Utilisateur inconnu, préférences par défaut', {
        userId: userId.value,
        reason: 'utilisateur inconnu',
      });
    } catch (error) {
      this.#logger.warn('Service de préférences indisponible, préférences par défaut', {
        userId: userId.value,
        reason: describeError(error),
      });
    }
    return { value: UserPreferences.createDefault(userId), degraded: true };
  }

  /** Sélection puis résolution ; toute erreur mène à la playlist de secours locale. */
  async #chooseTrack(
    preferences: UserPreferences,
    { userId, dayOfWeek, weather }: WakeUpCommand,
  ): Promise<StepOutcome<Track>> {
    try {
      const query = this.#trackSelectionPolicy.select(preferences, weather, dayOfWeek);
      const track = await this.#musicCatalog.resolve(query);
      if (track.source === LOCAL_TRACK_SOURCE) {
        this.#logger.warn('Catalogue replié sur un morceau local', {
          userId: userId.value,
          reason: 'fournisseurs musicaux indisponibles',
        });
        return { value: track, degraded: true };
      }
      return { value: track, degraded: false };
    } catch (error) {
      this.#logger.warn('Résolution du morceau impossible, morceau de secours local', {
        userId: userId.value,
        weather,
        reason: describeError(error),
      });
      return { value: this.#emergencyPlaylist.pick(weather), degraded: true };
    }
  }

  /** Dégradé si le message n'est pas parti, ou pas par le canal préféré. */
  #isDeliveryDegraded(preferences: UserPreferences, dispatch: DispatchResult): boolean {
    const onPreferred = dispatch.deliveredVia === preferences.preferredChannel;
    const allSucceeded = dispatch.attempts.every((attempt) => attempt.success);
    if (onPreferred && allSucceeded) {
      return false;
    }
    this.#logger.warn('Réveil non livré par le canal préféré', {
      userId: preferences.userId.value,
      preferredChannel: preferences.preferredChannel,
      deliveredVia: dispatch.deliveredVia,
      reason: allSucceeded ? 'canal préféré indisponible' : 'échec de canal',
    });
    return true;
  }
}
