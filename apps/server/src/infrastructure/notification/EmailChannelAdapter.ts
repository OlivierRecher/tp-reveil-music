import type { ChannelType, NotificationChannel, Recipient, WakeUpMessage } from '@reveil/core';
import type { EmailClient } from './EmailClient.ts';
import { escapeHtml } from './escapeHtml.ts';
import { NotificationChannelError } from './NotificationChannelError.ts';
import { requireAddress } from './requireAddress.ts';

interface Deps {
  readonly emailClient: EmailClient;
}

/**
 * Adapter : ramène l'API à promesse d'un client e-mail (`EmailClient`) à `NotificationChannel`. Le corps est
 * échappé avant d'être placé dans le HTML ; tout rejet devient une `NotificationChannelError`.
 */
export class EmailChannelAdapter implements NotificationChannel {
  readonly type: ChannelType = 'EMAIL';
  readonly #emailClient: EmailClient;

  constructor({ emailClient }: Deps) {
    this.#emailClient = emailClient;
  }

  async send(recipient: Recipient, message: WakeUpMessage): Promise<void> {
    const to = requireAddress(this.type, recipient);
    try {
      await this.#emailClient.sendMail({
        to,
        subject: message.subject,
        html: `<p>${escapeHtml(message.body)}</p>`,
      });
    } catch (error) {
      throw new NotificationChannelError(this.type, "le client e-mail a rejeté l'envoi", {
        cause: error,
      });
    }
  }
}
