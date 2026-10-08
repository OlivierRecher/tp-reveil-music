import type { NotificationLog } from '../NotificationLog.ts';

export interface PushPayload {
  readonly title: string;
  readonly body: string;
}

export type PushCallback = (error: Error | null) => void;

interface Deps {
  readonly notificationLog: NotificationLog;
  /** Simule une panne du service push (tests et démo). Défaut : `false`. */
  readonly failing?: boolean;
}

/**
 * Mock d'un service de push (style callback « à la Node ») : écrit l'envoi dans le journal, sans
 * envoi réel, puis appelle `callback(null)`. En panne, appelle `callback(erreur)`.
 */
export class FakePushService {
  readonly #notificationLog: NotificationLog;
  readonly #failing: boolean;

  constructor({ notificationLog, failing = false }: Deps) {
    this.#notificationLog = notificationLog;
    this.#failing = failing;
  }

  push(deviceToken: string, payload: PushPayload, callback: PushCallback): void {
    throw new Error('Not implemented', {
      cause: [this.#notificationLog, this.#failing, deviceToken, payload, callback],
    });
  }
}
