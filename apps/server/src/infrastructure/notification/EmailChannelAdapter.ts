import type { ChannelType, NotificationChannel, Recipient, WakeUpMessage } from '@reveil/core';
import type { FakeEmailClient } from './vendors/FakeEmailClient.ts';

interface Deps {
  readonly emailClient: FakeEmailClient;
}

/**
 * Adapter : ramène l'API à promesse du client e-mail à `NotificationChannel`. Le corps est
 * échappé avant d'être placé dans le HTML ; tout rejet devient une `NotificationChannelError`.
 */
export class EmailChannelAdapter implements NotificationChannel {
  readonly type: ChannelType = 'EMAIL';
  readonly #emailClient: FakeEmailClient;

  constructor({ emailClient }: Deps) {
    this.#emailClient = emailClient;
  }

  send(recipient: Recipient, message: WakeUpMessage): Promise<void> {
    return Promise.reject(
      new Error('Not implemented', { cause: [this.#emailClient, recipient, message] }),
    );
  }
}
