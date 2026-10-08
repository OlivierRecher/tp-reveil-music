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
    this.#pino.debug(context ?? {}, message);
  }

  info(message: string, context?: LogContext): void {
    this.#pino.info(context ?? {}, message);
  }

  warn(message: string, context?: LogContext): void {
    this.#pino.warn(context ?? {}, message);
  }

  error(message: string, context?: LogContext): void {
    this.#pino.error(context ?? {}, message);
  }
}
