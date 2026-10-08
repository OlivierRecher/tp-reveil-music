export const SMS_STATUSES = ['QUEUED', 'REJECTED'] as const;
export type SmsStatus = (typeof SMS_STATUSES)[number];

export interface SmsResult {
  readonly status: SmsStatus;
}

/** Contrat d'une passerelle SMS (style API à statut) : un échec est signalé par `REJECTED`. */
export interface SmsGateway {
  send(phoneNumber: string, text: string): Promise<SmsResult>;
}
