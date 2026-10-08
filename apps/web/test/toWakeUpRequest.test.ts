import { describe, expect, it } from 'vitest';
import { toWakeUpRequest } from '../src/formView.ts';

describe('saisie du formulaire → requête', () => {
  it('construit la requête à partir des valeurs saisies (identifiant rogné)', () => {
    expect(toWakeUpRequest({ userId: '  alice ', dayOfWeek: 'MARDI', weather: 'NEIGE' })).toEqual({
      userId: 'alice',
      dayOfWeek: 'MARDI',
      weather: 'NEIGE',
    });
  });

  it.each([
    ['identifiant vide', { userId: '   ', dayOfWeek: 'LUNDI', weather: 'SOLEIL' }],
    ['jour hors liste', { userId: 'alice', dayOfWeek: 'FUNDI', weather: 'SOLEIL' }],
    ['météo hors liste', { userId: 'alice', dayOfWeek: 'LUNDI', weather: 'GRELE' }],
  ])('rejette une saisie incomplète ou altérée : %s', (_case, values) => {
    expect(toWakeUpRequest(values)).toBeUndefined();
  });
});
