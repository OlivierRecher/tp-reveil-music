import type { ChannelType } from '@reveil/core';

/**
 * Échec d'envoi uniforme côté adaptateur (CA-NOT-04) : quel que soit le style d'erreur du
 * fournisseur (promesse rejetée, statut `REJECTED`, callback en erreur), l'adaptateur rejette
 * avec cette erreur, qui porte le canal concerné.
 */
export class NotificationChannelError extends Error {
  readonly channel: ChannelType;

  constructor(channel: ChannelType, reason: string, options?: ErrorOptions) {
    super(`Échec d'envoi sur le canal ${channel} : ${reason}`, options);
    this.name = 'NotificationChannelError';
    this.channel = channel;
  }
}
