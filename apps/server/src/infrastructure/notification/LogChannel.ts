import type {
  ChannelType,
  Logger,
  NotificationChannel,
  Recipient,
  WakeUpMessage,
} from '@reveil/core';
import type { NotificationLog } from './NotificationLog.ts';

interface Deps {
  readonly notificationLog: NotificationLog;
  readonly logger: Logger;
}

/**
 * Canal de dernier recours (`LOG`) : écrit le message dans le journal des notifications. Ne
 * rejette jamais ; si le journal lui-même échoue, l'incident est remonté via `logger.error`.
 */
export class LogChannel implements NotificationChannel {
  readonly type: ChannelType = 'LOG';
  readonly #notificationLog: NotificationLog;
  readonly #logger: Logger;

  constructor({ notificationLog, logger }: Deps) {
    this.#notificationLog = notificationLog;
    this.#logger = logger;
  }

  send(recipient: Recipient, message: WakeUpMessage): Promise<void> {
    const userId = recipient.userId.value;
    try {
      this.#notificationLog.write(`[LOG] user=${userId} ${message.subject} ${message.body}`);
    } catch (error) {
      // Jamais de silence : le message reste lisible dans le journal applicatif.
      this.#logger.error('Canal LOG : journal des notifications indisponible', {
        userId,
        subject: message.subject,
        body: message.body,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return Promise.resolve();
  }
}
