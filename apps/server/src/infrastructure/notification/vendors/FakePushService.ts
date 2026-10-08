import type { NotificationLog } from '../NotificationLog.ts';
import type { PushCallback, PushPayload, PushService } from '../PushService.ts';

interface Deps {
  readonly notificationLog: NotificationLog;
  /** Simule une panne du service push (tests et démo). Défaut : `false`. */
  readonly failing?: boolean;
}

/**
 * Mock d'un service de push (style callback « à la Node ») : écrit l'envoi dans le journal, sans
 * envoi réel, puis appelle `callback(null)`. En panne, appelle `callback(erreur)`.
 */
export class FakePushService implements PushService {
  readonly #notificationLog: NotificationLog;
  readonly #failing: boolean;

  constructor({ notificationLog, failing = false }: Deps) {
    this.#notificationLog = notificationLog;
    this.#failing = failing;
  }

  push(deviceToken: string, payload: PushPayload, callback: PushCallback): void {
    if (this.#failing) {
      callback(new Error('Service push indisponible (panne simulée)'));
      return;
    }
    this.#notificationLog.write(
      `[PUSH] to=${deviceToken} title=${payload.title} body=${payload.body}`,
    );
    callback(null);
  }
}
