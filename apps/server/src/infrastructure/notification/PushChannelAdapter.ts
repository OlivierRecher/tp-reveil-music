import type { ChannelType, NotificationChannel, Recipient, WakeUpMessage } from '@reveil/core';
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
    return Promise.reject(
      new Error('Not implemented', { cause: [this.#pushService, recipient, message] }),
    );
  }
}
