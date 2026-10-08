/** Jours de la semaine acceptés par le point d'entrée. */
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

/** Garde de type : vrai si la valeur est exactement un jour accepté. */
export function isDayOfWeek(value: unknown): value is DayOfWeek {
  throw new Error('Not implemented', { cause: value });
}

/** Valide une entrée externe ; lève `InvalidDayOfWeekError` si la valeur n'est pas acceptée. */
export function parseDayOfWeek(value: unknown): DayOfWeek {
  throw new Error('Not implemented', { cause: value });
}
