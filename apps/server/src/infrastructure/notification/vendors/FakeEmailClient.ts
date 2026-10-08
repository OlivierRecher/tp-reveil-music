import { randomUUID } from 'node:crypto';
import type { EmailClient, EmailEnvelope, EmailReceipt } from '../EmailClient.ts';
import type { NotificationLog } from '../NotificationLog.ts';

interface Deps {
  readonly notificationLog: NotificationLog;
  /** Simule une panne du fournisseur (tests et démo). Défaut : `false`. */
  readonly failing?: boolean;
}

/**
 * Mock d'un fournisseur d'e-mail (style SDK à promesse) : écrit l'envoi dans le journal, sans
 * envoi réel. En panne, la promesse est rejetée.
 */
export class FakeEmailClient implements EmailClient {
  readonly #notificationLog: NotificationLog;
  readonly #failing: boolean;

  constructor({ notificationLog, failing = false }: Deps) {
    this.#notificationLog = notificationLog;
    this.#failing = failing;
  }

  sendMail(envelope: EmailEnvelope): Promise<EmailReceipt> {
    if (this.#failing) {
      return Promise.reject(new Error('Fournisseur e-mail indisponible (panne simulée)'));
    }
    const messageId = randomUUID();
    this.#notificationLog.write(
      `[EMAIL] id=${messageId} to=${envelope.to} subject=${envelope.subject} html=${envelope.html}`,
    );
    return Promise.resolve({ messageId });
  }
}
