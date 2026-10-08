import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
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
    const line = `${new Date().toISOString()} ${entry}`;
    console.log(line);
    try {
      mkdirSync(dirname(this.#notificationLogFile), { recursive: true });
      appendFileSync(this.#notificationLogFile, `${line}\n`, 'utf8');
    } catch (error) {
      // Écriture synchrone volontaire : volume faible (un envoi par réveil), ordre des lignes garanti.
      console.error(
        `Journal des notifications : écriture impossible dans ${this.#notificationLogFile}`,
        error,
      );
    }
  }
}
