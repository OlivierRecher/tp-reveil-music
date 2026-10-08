import { describe, expect, it } from 'vitest';
import { describeFormFields } from '../src/formView.ts';

// Valeurs de l'énoncé, écrites en dur : le test ne se déduit pas des constantes du code.
const DAYS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];
const WEATHERS = ['SOLEIL', 'PLUIE', 'NEIGE', 'NUAGEUX'];

function field(id: string): ReturnType<typeof describeFormFields>[number] {
  const found = describeFormFields().find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`champ ${id} absent du formulaire`);
  return found;
}

describe('formulaire de déclenchement', () => {
  it('[CA-WEB-01] propose exactement trois champs : utilisateur, jour et météo', () => {
    expect(describeFormFields().map((candidate) => candidate.id)).toEqual([
      'userId',
      'dayOfWeek',
      'weather',
    ]);
  });

  it('[CA-WEB-01] chaque champ porte un libellé non vide', () => {
    for (const candidate of describeFormFields()) {
      expect(candidate.label.trim()).not.toBe('');
    }
  });

  it('[CA-WEB-01] l’identifiant utilisateur est un champ texte libre', () => {
    expect(field('userId').type).toBe('text');
  });

  it('[CA-WEB-01] le jour propose les 7 valeurs LUNDI … DIMANCHE dans l’ordre, chacune libellée', () => {
    const day = field('dayOfWeek');

    expect(day.type).toBe('select');
    expect(day.options.map((option) => option.value)).toEqual(DAYS);
    for (const option of day.options) expect(option.label.trim()).not.toBe('');
  });

  it('[CA-WEB-01] la météo propose les 4 valeurs de l’énoncé, chacune libellée', () => {
    const weather = field('weather');

    expect(weather.type).toBe('select');
    expect(weather.options.map((option) => option.value)).toEqual(WEATHERS);
    for (const option of weather.options) expect(option.label.trim()).not.toBe('');
  });
});
