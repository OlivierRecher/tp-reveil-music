import type { NotificationLog } from '../NotificationLog.ts';

export interface EmailEnvelope {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
}

export interface EmailReceipt {
  readonly messageId: string;
}

interface Deps {
  readonly notificationLog: NotificationLog;
  /** Simule une panne du fournisseur (tests et démo). Défaut : `false`. */
  readonly failing?: boolean;
}

/**
 * Mock d'un fournisseur d'e-mail (style SDK à promesse) : écrit l'envoi dans le journal, sans
 * envoi réel. En panne, la promesse est rejetée.
 */
export class FakeEmailClient {
  readonly #notificationLog: NotificationLog;
  readonly #failing: boolean;

  constructor({ notificationLog, failing = false }: Deps) {
    this.#notificationLog = notificationLog;
    this.#failing = failing;
  }

  sendMail(envelope: EmailEnvelope): Promise<EmailReceipt> {
    return Promise.reject(
      new Error('Not implemented', { cause: [this.#notificationLog, this.#failing, envelope] }),
    );
  }
}
