import type { LogContext, Logger } from '@reveil/core';
import type { Logger as Pino } from 'pino';

interface Deps {
  readonly pinoLogger: Pino;
}

/** Adaptateur du port `Logger` vers pino (journal JSON structuré). */
export class PinoLogger implements Logger {
  readonly #pino: Pino;

  constructor({ pinoLogger }: Deps) {
    this.#pino = pinoLogger;
  }

  debug(message: string, context?: LogContext): void {
    throw new Error('Not implemented', { cause: { pino: this.#pino, message, context } });
  }

  info(message: string, context?: LogContext): void {
    throw new Error('Not implemented', { cause: { pino: this.#pino, message, context } });
  }

  warn(message: string, context?: LogContext): void {
    throw new Error('Not implemented', { cause: { pino: this.#pino, message, context } });
  }

  error(message: string, context?: LogContext): void {
    throw new Error('Not implemented', { cause: { pino: this.#pino, message, context } });
  }
}
