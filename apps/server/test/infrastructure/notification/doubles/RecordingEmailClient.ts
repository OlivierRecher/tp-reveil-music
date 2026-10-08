import type {
  EmailClient,
  EmailEnvelope,
  EmailReceipt,
} from '../../../../src/infrastructure/notification/EmailClient.ts';

/** Client e-mail écrit à la main : mémorise les envois, ou rejette si `failWith` est fourni. */
export class RecordingEmailClient implements EmailClient {
  readonly sent: EmailEnvelope[] = [];
  readonly #failWith: Error | undefined;

  constructor(failWith?: Error) {
    this.#failWith = failWith;
  }

  sendMail(envelope: EmailEnvelope): Promise<EmailReceipt> {
    if (this.#failWith !== undefined) {
      return Promise.reject(this.#failWith);
    }
    this.sent.push(envelope);
    return Promise.resolve({ messageId: `msg-${String(this.sent.length)}` });
  }
}
