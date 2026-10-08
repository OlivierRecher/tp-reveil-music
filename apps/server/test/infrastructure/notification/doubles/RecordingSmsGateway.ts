import type {
  SmsGateway,
  SmsResult,
  SmsStatus,
} from '../../../../src/infrastructure/notification/SmsGateway.ts';

/** Passerelle SMS écrite à la main : mémorise les envois et répond par le statut configuré. */
export class RecordingSmsGateway implements SmsGateway {
  readonly sent: { readonly phoneNumber: string; readonly text: string }[] = [];
  readonly #status: SmsStatus;

  constructor(status: SmsStatus = 'QUEUED') {
    this.#status = status;
  }

  send(phoneNumber: string, text: string): Promise<SmsResult> {
    this.sent.push({ phoneNumber, text });
    return Promise.resolve({ status: this.#status });
  }
}
