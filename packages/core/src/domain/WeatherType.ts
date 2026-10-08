import { InvalidWeatherError } from './InvalidWeatherError.ts';

/** Types de météo acceptés par le point d'entrée (énoncé). */
export const WEATHER_TYPES = ['SOLEIL', 'PLUIE', 'NEIGE', 'NUAGEUX'] as const;

export type WeatherType = (typeof WEATHER_TYPES)[number];

/** Garde de type : vrai si la valeur est exactement une météo acceptée. */
export function isWeatherType(value: unknown): value is WeatherType {
  return WEATHER_TYPES.some((weather) => weather === value);
}

/** Valide une entrée externe ; lève `InvalidWeatherError` si la valeur n'est pas acceptée. */
export function parseWeatherType(value: unknown): WeatherType {
  if (!isWeatherType(value)) {
    throw new InvalidWeatherError(
      `Météo invalide : « ${String(value)} » (attendu : ${WEATHER_TYPES.join(', ')})`,
    );
  }
  return value;
}
