import type { NotificationLog } from './NotificationLog.ts';

interface Deps {
  readonly notificationLogFile: string;
}

/**
 * Journal des envois simulés : ajoute une ligne horodatée au fichier (dossier créé si besoin) et
 * l'affiche en console. Ne lève jamais : une erreur d'écriture est signalée par `console.error`.
 */
export class FileNotificationLog implements NotificationLog {
  readonly #notificationLogFile: string;

  constructor({ notificationLogFile }: Deps) {
    this.#notificationLogFile = notificationLogFile;
  }

  write(entry: string): void {
    throw new Error('Not implemented', { cause: [this.#notificationLogFile, entry] });
  }
}
