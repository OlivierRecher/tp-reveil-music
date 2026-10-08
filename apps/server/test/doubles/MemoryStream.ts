import { Writable } from 'node:stream';

/** Flux mémoire : capture chaque ligne JSON écrite par pino (aucun fichier, aucune console). */
export class MemoryStream extends Writable {
  readonly lines: Array<Record<string, unknown>> = [];

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void): void {
    for (const line of chunk.toString('utf8').split('\n')) {
      if (line.trim() !== '') {
        this.lines.push(JSON.parse(line) as Record<string, unknown>);
      }
    }
    callback();
  }

  /** Lignes d'un niveau pino donné (debug 20, info 30, warn 40, error 50). */
  atLevel(level: number): ReadonlyArray<Record<string, unknown>> {
    return this.lines.filter((line) => line['level'] === level);
  }
}
