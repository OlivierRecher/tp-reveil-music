import type { ChannelType } from '../../domain/ChannelType.ts';
import type { Recipient } from '../../domain/Recipient.ts';
import type { WakeUpMessage } from '../../domain/WakeUpMessage.ts';

/** Port sortant : un canal de notification (e-mail, SMS, push, journal…). */
export interface NotificationChannel {
  readonly type: ChannelType;
  /** Rejette la promesse si l'envoi échoue. */
  send(recipient: Recipient, message: WakeUpMessage): Promise<void>;
}
