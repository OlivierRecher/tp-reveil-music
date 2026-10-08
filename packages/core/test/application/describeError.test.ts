import { describe, expect, it } from 'vitest';
import { describeError } from '../../src/application/describeError.ts';

describe('describeError', () => {
  it("renvoie le message d'une Error", () => {
    expect(describeError(new Error('panne réseau'))).toBe('panne réseau');
  });

  it('convertit en texte une valeur rejetée qui n’est pas une Error', () => {
    expect(describeError('délai dépassé')).toBe('délai dépassé');
    expect(describeError(503)).toBe('503');
  });
});
