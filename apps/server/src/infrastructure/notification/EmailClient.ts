export interface EmailEnvelope {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
}

export interface EmailReceipt {
  readonly messageId: string;
}

/** Contrat d'un fournisseur d'e-mail (style SDK à promesse) : rejette la promesse en cas d'échec. */
export interface EmailClient {
  sendMail(envelope: EmailEnvelope): Promise<EmailReceipt>;
}
