export interface PushPayload {
  readonly title: string;
  readonly body: string;
}

export type PushCallback = (error: Error | null) => void;

/** Contrat d'un service push (style callback « à la Node ») : `callback(erreur)` en cas d'échec. */
export interface PushService {
  push(deviceToken: string, payload: PushPayload, callback: PushCallback): void;
}
