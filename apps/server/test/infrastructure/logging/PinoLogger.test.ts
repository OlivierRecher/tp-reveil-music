import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import type { Logger } from '@reveil/core';
import { PinoLogger } from '../../../src/infrastructure/logging/PinoLogger.ts';

/** Flux mémoire : capture chaque ligne JSON écrite par pino (aucun fichier, aucune console). */
class MemoryStream extends Writable {
  readonly lines: Array<Record<string, unknown>> = [];

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void): void {
    for (const line of chunk.toString('utf8').split('\n')) {
      if (line.trim() !== '') {
        this.lines.push(JSON.parse(line) as Record<string, unknown>);
      }
    }
    callback();
  }
}

function setup(): { logger: Logger; stream: MemoryStream } {
  const stream = new MemoryStream();
  const logger: Logger = new PinoLogger({ pinoLogger: pino({ level: 'trace' }, stream) });
  return { logger, stream };
}

// Niveaux numériques de pino : debug 20, info 30, warn 40, error 50.
describe('PinoLogger', () => {
  it.each([
    ['debug', 20],
    ['info', 30],
    ['warn', 40],
    ['error', 50],
  ] as const)('journalise au niveau %s avec le message et le contexte', (level, pinoLevel) => {
    const { logger, stream } = setup();

    logger[level]('fournisseur en panne', { provider: 'itunes', attempt: 2 });

    expect(stream.lines).toHaveLength(1);
    expect(stream.lines[0]).toMatchObject({
      level: pinoLevel,
      msg: 'fournisseur en panne',
      provider: 'itunes',
      attempt: 2,
    });
  });

  it('journalise sans contexte', () => {
    const { logger, stream } = setup();

    logger.info('réveil déclenché');

    expect(stream.lines).toHaveLength(1);
    expect(stream.lines[0]).toMatchObject({ level: 30, msg: 'réveil déclenché' });
  });

  it('respecte le niveau minimal configuré sur pino', () => {
    const stream = new MemoryStream();
    const logger = new PinoLogger({ pinoLogger: pino({ level: 'warn' }, stream) });

    logger.debug('ignoré');
    logger.info('ignoré aussi');
    logger.warn('conservé');

    expect(stream.lines.map((line) => line['msg'])).toEqual(['conservé']);
  });
});
