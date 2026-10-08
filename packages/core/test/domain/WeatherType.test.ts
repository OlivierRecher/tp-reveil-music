import { describe, expect, it } from 'vitest';
import {
  DomainError,
  InvalidWeatherError,
  WEATHER_TYPES,
  isWeatherType,
  parseWeatherType,
} from '../../src/index.ts';

// Entrées refusées : casse, valeur hors liste, vide, espaces parasites, types non textuels.
const INVALID_WEATHERS: ReadonlyArray<readonly [string, unknown]> = [
  ['minuscules', 'soleil'],
  ['casse mixte', 'Pluie'],
  ['météo inconnue', 'ORAGE'],
  ['chaîne vide', ''],
  ['espace seul', ' '],
  ['espace final', 'NEIGE '],
  ['espace initial', ' NUAGEUX'],
  ['null', null],
  ['undefined', undefined],
  ['nombre', 42],
  ['objet', { weather: 'SOLEIL' }],
  ['tableau', ['SOLEIL']],
];

describe('WeatherType', () => {
  it('[CA-DOM-01] la liste des météos acceptées est exactement SOLEIL, PLUIE, NEIGE, NUAGEUX', () => {
    expect([...WEATHER_TYPES].sort()).toEqual(['NEIGE', 'NUAGEUX', 'PLUIE', 'SOLEIL']);
  });

  it.each(['SOLEIL', 'PLUIE', 'NEIGE', 'NUAGEUX'])('[CA-DOM-01] accepte la météo %s', (value) => {
    expect(isWeatherType(value)).toBe(true);
    expect(parseWeatherType(value)).toBe(value);
  });

  it.each(INVALID_WEATHERS)('[CA-DOM-01] rejette une météo invalide (%s)', (_label, value) => {
    expect(isWeatherType(value)).toBe(false);
    expect(() => parseWeatherType(value)).toThrow(InvalidWeatherError);
    expect(() => parseWeatherType(value)).toThrow(DomainError);
  });
});
