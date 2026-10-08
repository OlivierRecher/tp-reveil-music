import type {
  PushCallback,
  PushPayload,
  PushService,
} from '../../../../src/infrastructure/notification/PushService.ts';

/** Service push écrit à la main : mémorise les envois, puis `callback(failWith ?? null)`. */
export class RecordingPushService implements PushService {
  readonly sent: { readonly deviceToken: string; readonly payload: PushPayload }[] = [];
  readonly #failWith: Error | undefined;

  constructor(failWith?: Error) {
    this.#failWith = failWith;
  }

  push(deviceToken: string, payload: PushPayload, callback: PushCallback): void {
    this.sent.push({ deviceToken, payload });
    callback(this.#failWith ?? null);
  }
}
