import { describe, expect, it } from 'vitest';
import {
  DAYS_OF_WEEK,
  DomainError,
  InvalidDayOfWeekError,
  isDayOfWeek,
  parseDayOfWeek,
} from '../../src/index.ts';

const VALID_DAYS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];

// Entrées refusées : casse, jours étrangers ou abrégés, vide, espaces parasites, non textuels.
const INVALID_DAYS: ReadonlyArray<readonly [string, unknown]> = [
  ['minuscules', 'lundi'],
  ['casse mixte', 'Mardi'],
  ['anglais', 'MONDAY'],
  ['abréviation', 'LUN'],
  ['chaîne vide', ''],
  ['espace seul', ' '],
  ['espace final', 'LUNDI '],
  ['espace initial', ' DIMANCHE'],
  ['null', null],
  ['undefined', undefined],
  ['numéro de jour', 1],
  ['objet', { day: 'LUNDI' }],
];

describe('DayOfWeek', () => {
  it('[CA-DOM-02] la liste des jours acceptés est exactement LUNDI … DIMANCHE', () => {
    expect([...DAYS_OF_WEEK]).toEqual(VALID_DAYS);
  });

  it.each(VALID_DAYS)('[CA-DOM-02] accepte le jour %s', (value) => {
    expect(isDayOfWeek(value)).toBe(true);
    expect(parseDayOfWeek(value)).toBe(value);
  });

  it.each(INVALID_DAYS)('[CA-DOM-02] rejette un jour invalide (%s)', (_label, value) => {
    expect(isDayOfWeek(value)).toBe(false);
    expect(() => parseDayOfWeek(value)).toThrow(InvalidDayOfWeekError);
    expect(() => parseDayOfWeek(value)).toThrow(DomainError);
  });
});
