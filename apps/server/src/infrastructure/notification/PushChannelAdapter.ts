import type { ChannelType, NotificationChannel, Recipient, WakeUpMessage } from '@reveil/core';
import { NotificationChannelError } from './NotificationChannelError.ts';
import { requireAddress } from './requireAddress.ts';
import type { FakePushService } from './vendors/FakePushService.ts';

interface Deps {
  readonly pushService: FakePushService;
}

/**
 * Adapter : ramène l'API à callback du service push à `NotificationChannel` (promesse). Un
 * `callback(erreur)` (ou une exception) devient une `NotificationChannelError`.
 */
export class PushChannelAdapter implements NotificationChannel {
  readonly type: ChannelType = 'PUSH';
  readonly #pushService: FakePushService;

  constructor({ pushService }: Deps) {
    this.#pushService = pushService;
  }

  send(recipient: Recipient, message: WakeUpMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      const deviceToken = requireAddress(this.type, recipient);
      const fail = (cause: unknown): void => {
        reject(
          new NotificationChannelError(this.type, "le service push a refusé l'envoi", { cause }),
        );
      };
      try {
        this.#pushService.push(
          deviceToken,
          { title: message.subject, body: message.body },
          (error) => {
            if (error === null) {
              resolve();
            } else {
              fail(error);
            }
          },
        );
      } catch (error) {
        fail(error);
      }
    });
  }
}
