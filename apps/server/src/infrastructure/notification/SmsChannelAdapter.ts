import type { ChannelType, NotificationChannel, Recipient, WakeUpMessage } from '@reveil/core';
import { NotificationChannelError } from './NotificationChannelError.ts';
import { requireAddress } from './requireAddress.ts';
import type { FakeSmsGateway, SmsResult } from './vendors/FakeSmsGateway.ts';

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

  async send(recipient: Recipient, message: WakeUpMessage): Promise<void> {
    const phoneNumber = requireAddress(this.type, recipient);
    let result: SmsResult;
    try {
      // Le corps se suffit à lui-même (il reprend l'objet) : c'est lui que porte le SMS.
      result = await this.#smsGateway.send(phoneNumber, message.body);
    } catch (error) {
      throw new NotificationChannelError(this.type, 'la passerelle SMS est injoignable', {
        cause: error,
      });
    }
    if (result.status === 'REJECTED') {
      throw new NotificationChannelError(this.type, 'la passerelle a renvoyé le statut REJECTED');
    }
  }
}
