/** Types de météo acceptés par le point d'entrée (énoncé). */
export const WEATHER_TYPES = ['SOLEIL', 'PLUIE', 'NEIGE', 'NUAGEUX'] as const;

export type WeatherType = (typeof WEATHER_TYPES)[number];

/** Garde de type : vrai si la valeur est exactement une météo acceptée. */
export function isWeatherType(value: unknown): value is WeatherType {
  throw new Error('Not implemented', { cause: value });
}

/** Valide une entrée externe ; lève `InvalidWeatherError` si la valeur n'est pas acceptée. */
export function parseWeatherType(value: unknown): WeatherType {
  throw new Error('Not implemented', { cause: value });
}
