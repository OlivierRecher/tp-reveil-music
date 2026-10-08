import type { NotificationLog } from '../../../../src/infrastructure/notification/NotificationLog.ts';

/** Journal des envois en mémoire : chaque entrée est conservée dans un tableau. */
export class MemoryNotificationLog implements NotificationLog {
  readonly entries: string[] = [];

  write(entry: string): void {
    this.entries.push(entry);
  }

  /** Toutes les entrées concaténées, pour rechercher une mention. */
  text(): string {
    return this.entries.join('\n');
  }
}
