import type { ChannelType } from '../domain/ChannelType.ts';
import type { UserPreferences } from '../domain/UserPreferences.ts';
import type { WakeUpMessage } from '../domain/WakeUpMessage.ts';
import type { DeliveryAttempt } from '../domain/WakeUpReport.ts';
import type { Logger } from './ports/Logger.ts';
import type { NotificationChannel } from './ports/NotificationChannel.ts';

/** Résultat d'une distribution : canal ayant livré le message et tentatives effectuées. */
export interface DispatchResult {
  readonly deliveredVia: ChannelType;
  readonly attempts: ReadonlyArray<DeliveryAttempt>;
}

interface Deps {
  readonly notificationChannels: ReadonlyArray<NotificationChannel>;
  readonly lastResortChannel: NotificationChannel;
  readonly logger: Logger;
}

/**
 * Chaîne de responsabilité : canal préféré → autres canaux pour lesquels l'utilisateur a une
 * coordonnée → canal de dernier recours. Ne lève jamais.
 */
export class NotificationDispatcher {
  readonly #deps: Deps;

  constructor(deps: Deps) {
    this.#deps = deps;
  }

  dispatch(preferences: UserPreferences, message: WakeUpMessage): Promise<DispatchResult> {
    return Promise.reject(
      new Error('Not implemented', { cause: [this.#deps, preferences, message] }),
    );
  }
}
