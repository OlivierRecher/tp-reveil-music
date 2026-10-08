import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import type { Logger } from '@reveil/core';
import { PinoLogger } from '../../../src/infrastructure/logging/PinoLogger.ts';
import { MemoryStream } from '../../doubles/MemoryStream.ts';

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

  it.each([
    ['debug', 20],
    ['info', 30],
    ['warn', 40],
    ['error', 50],
  ] as const)('journalise au niveau %s sans contexte', (level, pinoLevel) => {
    const { logger, stream } = setup();

    logger[level]('réveil déclenché');

    expect(stream.lines).toHaveLength(1);
    expect(stream.lines[0]).toMatchObject({ level: pinoLevel, msg: 'réveil déclenché' });
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
