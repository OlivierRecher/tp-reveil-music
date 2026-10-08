/** Statut renvoyé par la passerelle (type seul : aucune valeur n'est lue à l'exécution). */
export type SmsStatus = 'QUEUED' | 'REJECTED';

export interface SmsResult {
  readonly status: SmsStatus;
}

/** Contrat d'une passerelle SMS (style API à statut) : un échec est signalé par `REJECTED`. */
export interface SmsGateway {
  send(phoneNumber: string, text: string): Promise<SmsResult>;
}
