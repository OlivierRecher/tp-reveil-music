import type { LogContext, Logger } from '@reveil/core';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly context: LogContext | undefined;
}

/** Doublure du port `Logger` (partagée par les tests du serveur) : enregistre chaque entrée avec son niveau. */
export class RecordingLogger implements Logger {
  readonly entries: LogEntry[] = [];

  debug(message: string, context?: LogContext): void {
    this.entries.push({ level: 'debug', message, context });
  }

  info(message: string, context?: LogContext): void {
    this.entries.push({ level: 'info', message, context });
  }

  warn(message: string, context?: LogContext): void {
    this.entries.push({ level: 'warn', message, context });
  }

  error(message: string, context?: LogContext): void {
    this.entries.push({ level: 'error', message, context });
  }

  at(level: LogLevel): ReadonlyArray<LogEntry> {
    return this.entries.filter((entry) => entry.level === level);
  }

  /** Texte d'une entrée (message + contexte sérialisé), pour rechercher une mention. */
  static text(entry: LogEntry): string {
    return `${entry.message} ${JSON.stringify(entry.context ?? {})}`;
  }
}
