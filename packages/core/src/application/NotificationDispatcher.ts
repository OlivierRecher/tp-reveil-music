import type { ChannelType } from '../domain/ChannelType.ts';
import type { Recipient } from '../domain/Recipient.ts';
import type { UserPreferences } from '../domain/UserPreferences.ts';
import type { WakeUpMessage } from '../domain/WakeUpMessage.ts';
import type { DeliveryAttempt } from '../domain/WakeUpReport.ts';
import { describeError } from './describeError.ts';
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

/** Canal candidat associé à la coordonnée de l'utilisateur sur ce canal. */
interface Candidate {
  readonly channel: NotificationChannel;
  readonly recipient: Recipient;
}

/**
 * Chaîne de responsabilité : canal préféré → autres canaux pour lesquels l'utilisateur a une
 * coordonnée → canal de dernier recours. Ne lève jamais.
 */
export class NotificationDispatcher {
  readonly #notificationChannels: ReadonlyArray<NotificationChannel>;
  readonly #lastResortChannel: NotificationChannel;
  readonly #logger: Logger;

  constructor({ notificationChannels, lastResortChannel, logger }: Deps) {
    this.#notificationChannels = notificationChannels;
    this.#lastResortChannel = lastResortChannel;
    this.#logger = logger;
  }

  async dispatch(preferences: UserPreferences, message: WakeUpMessage): Promise<DispatchResult> {
    const attempts: DeliveryAttempt[] = [];
    for (const candidate of this.#candidatesFor(preferences)) {
      const attempt = await this.#tryChannel(candidate, message);
      attempts.push(attempt);
      if (attempt.success) {
        return { deliveredVia: attempt.channel, attempts };
      }
    }
    attempts.push(await this.#tryLastResort(preferences, message));
    return { deliveredVia: this.#lastResortChannel.type, attempts };
  }

  /** Canaux à tenter, dans l'ordre : préféré d'abord, puis ordre d'enregistrement. */
  #candidatesFor(preferences: UserPreferences): ReadonlyArray<Candidate> {
    const preferred = preferences.preferredChannel;
    const ordered = [
      ...this.#notificationChannels.filter((channel) => channel.type === preferred),
      ...this.#notificationChannels.filter((channel) => channel.type !== preferred),
    ];
    const candidates: Candidate[] = [];
    for (const channel of ordered) {
      const address = preferences.contactFor(channel.type);
      if (address === undefined) {
        // Pas de coordonnée : le canal est indisponible pour cet utilisateur (CA-APP-09).
        this.#logger.debug('Canal ignoré faute de coordonnée', {
          userId: preferences.userId.value,
          channel: channel.type,
        });
      } else {
        candidates.push({ channel, recipient: { userId: preferences.userId, address } });
      }
    }
    return candidates;
  }

  async #tryChannel(
    { channel, recipient }: Candidate,
    message: WakeUpMessage,
  ): Promise<DeliveryAttempt> {
    const context = { userId: recipient.userId.value, channel: channel.type };
    this.#logger.debug('Tentative de notification', context);
    try {
      await channel.send(recipient, message);
      this.#logger.info('Notification livrée', context);
      return { channel: channel.type, success: true };
    } catch (error) {
      const reason = describeError(error);
      this.#logger.warn(`Échec du canal ${channel.type}, bascule sur le canal suivant`, {
        ...context,
        reason,
      });
      return { channel: channel.type, success: false, error: reason };
    }
  }

  /** Le journal n'a pas de coordonnée propre : il est adressé à l'identifiant de l'utilisateur. */
  async #tryLastResort(
    preferences: UserPreferences,
    message: WakeUpMessage,
  ): Promise<DeliveryAttempt> {
    const channel = this.#lastResortChannel;
    const recipient: Recipient = {
      userId: preferences.userId,
      address: preferences.userId.value,
    };
    const context = { userId: recipient.userId.value, channel: channel.type };
    this.#logger.warn('Aucun canal disponible, remise au canal de dernier recours', context);
    try {
      await channel.send(recipient, message);
      this.#logger.info('Notification livrée', context);
      return { channel: channel.type, success: true };
    } catch (error) {
      const reason = describeError(error);
      // Contrat rompu par le dernier recours : on le signale sans interrompre le réveil.
      this.#logger.error(`Échec du canal de dernier recours ${channel.type}`, {
        ...context,
        reason,
      });
      return { channel: channel.type, success: false, error: reason };
    }
  }
}
