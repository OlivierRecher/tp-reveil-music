import type { ChannelType, NotificationChannel, Recipient, WakeUpMessage } from '@reveil/core';
import type { FakeSmsGateway } from './vendors/FakeSmsGateway.ts';

interface Deps {
  readonly smsGateway: FakeSmsGateway;
}

/**
 * Adapter : ramène l'API à statut de la passerelle SMS à `NotificationChannel`. Un statut
 * `REJECTED` (ou un rejet) devient une `NotificationChannelError`.
 */
export class SmsChannelAdapter implements NotificationChannel {
  readonly type: ChannelType = 'SMS';
  readonly #smsGateway: FakeSmsGateway;

  constructor({ smsGateway }: Deps) {
    this.#smsGateway = smsGateway;
  }

  send(recipient: Recipient, message: WakeUpMessage): Promise<void> {
    return Promise.reject(
      new Error('Not implemented', { cause: [this.#smsGateway, recipient, message] }),
    );
  }
}
