// Valeurs de l'énoncé, redéfinies côté client : la PWA ne parle qu'à l'API (ADR-0001) et n'importe
// ni `@reveil/core` ni le serveur. Le serveur reste seul juge de la validité (400 sinon).

export const DAYS_OF_WEEK = [
  'LUNDI',
  'MARDI',
  'MERCREDI',
  'JEUDI',
  'VENDREDI',
  'SAMEDI',
  'DIMANCHE',
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAY_LABELS: Readonly<Record<DayOfWeek, string>> = {
  LUNDI: 'Lundi',
  MARDI: 'Mardi',
  MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi',
  VENDREDI: 'Vendredi',
  SAMEDI: 'Samedi',
  DIMANCHE: 'Dimanche',
};

export const WEATHER_TYPES = ['SOLEIL', 'PLUIE', 'NEIGE', 'NUAGEUX'] as const;
export type WeatherType = (typeof WEATHER_TYPES)[number];

export const WEATHER_LABELS: Readonly<Record<WeatherType, string>> = {
  SOLEIL: 'Soleil',
  PLUIE: 'Pluie',
  NEIGE: 'Neige',
  NUAGEUX: 'Nuageux',
};
