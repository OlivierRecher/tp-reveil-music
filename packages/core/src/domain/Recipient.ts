import type { UserId } from './UserId.ts';

/** Destinataire d'une notification : l'utilisateur et sa coordonnée sur le canal visé. */
export interface Recipient {
  readonly userId: UserId;
  readonly address: string;
}
