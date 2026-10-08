/**
 * Puits d'écriture des envois simulés : les mocks « fournisseurs » y consignent chaque envoi
 * (console et/ou fichier) au lieu de contacter un vrai service (CA-NOT-02).
 */
export interface NotificationLog {
  write(entry: string): void;
}
