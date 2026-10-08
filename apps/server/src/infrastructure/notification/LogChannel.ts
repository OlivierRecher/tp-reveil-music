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
    return Promise.reject(
      new Error('Not implemented', {
        cause: [this.#notificationLog, this.#logger, recipient, message],
      }),
    );
  }
}
