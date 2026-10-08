import type { NotificationLog } from '../../../../src/infrastructure/notification/NotificationLog.ts';

/** Journal des envois en panne : chaque écriture lève. */
export class ThrowingNotificationLog implements NotificationLog {
  write(entry: string): void {
    throw new Error(`Journal des notifications indisponible (${String(entry.length)} caractères)`);
  }
}
