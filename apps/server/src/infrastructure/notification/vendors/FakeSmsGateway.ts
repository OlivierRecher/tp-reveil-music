import type { NotificationLog } from '../NotificationLog.ts';
import type { SmsGateway, SmsResult } from '../SmsGateway.ts';

interface Deps {
  readonly notificationLog: NotificationLog;
  /** Simule une panne de la passerelle (tests et démo). Défaut : `false`. */
  readonly failing?: boolean;
}

/**
 * Mock d'une passerelle SMS (style API à statut) : écrit l'envoi dans le journal, sans envoi
 * réel. En panne, la promesse est résolue avec `{ status: 'REJECTED' }` (aucune exception).
 */
export class FakeSmsGateway implements SmsGateway {
  readonly #notificationLog: NotificationLog;
  readonly #failing: boolean;

  constructor({ notificationLog, failing = false }: Deps) {
    this.#notificationLog = notificationLog;
    this.#failing = failing;
  }

  send(phoneNumber: string, text: string): Promise<SmsResult> {
    if (this.#failing) {
      return Promise.resolve({ status: 'REJECTED' });
    }
    this.#notificationLog.write(`[SMS] to=${phoneNumber} text=${text}`);
    return Promise.resolve({ status: 'QUEUED' });
  }
}
