import type { ChannelType, Recipient } from '@reveil/core';
import { NotificationChannelError } from './NotificationChannelError.ts';

/**
 * Coordonnée du destinataire, sans espaces superflus. Une coordonnée vide est un échec d'envoi
 * uniforme : l'adaptateur rejette sans solliciter le fournisseur (CA-NOT-04).
 */
export function requireAddress(channel: ChannelType, recipient: Recipient): string {
  const address = recipient.address.trim();
  if (address === '') {
    throw new NotificationChannelError(channel, 'aucune coordonnée pour ce destinataire');
  }
  return address;
}
