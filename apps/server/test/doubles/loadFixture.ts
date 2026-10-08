import { readFileSync } from 'node:fs';

/** Charge une fixture JSON de `test/fixtures/` (copie neuve à chaque appel, modifiable par le test). */
export function loadFixture(fileName: string): unknown {
  const url = new URL(`../fixtures/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as unknown;
}
