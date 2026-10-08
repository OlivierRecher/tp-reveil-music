import type {
  ChannelType,
  NotificationChannel,
  Recipient,
  WakeUpMessage,
} from '../../src/index.ts';

export interface SentNotification {
  readonly recipient: Recipient;
  readonly message: WakeUpMessage;
}

/** Canal qui enregistre chaque tentative d'envoi ; échoue avec `failWith` s'il est fourni. */
export class RecordingChannel implements NotificationChannel {
  readonly type: ChannelType;
  readonly #failWith: Error | undefined;
  /** Tous les appels à `send`, réussis ou non. */
  readonly calls: SentNotification[] = [];

  constructor(type: ChannelType, options: { readonly failWith?: Error } = {}) {
    this.type = type;
    this.#failWith = options.failWith;
  }

  send(recipient: Recipient, message: WakeUpMessage): Promise<void> {
    this.calls.push({ recipient, message });
    return this.#failWith === undefined ? Promise.resolve() : Promise.reject(this.#failWith);
  }
}
