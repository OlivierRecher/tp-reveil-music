import { InvalidDayOfWeekError } from './InvalidDayOfWeekError.ts';

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
  return DAYS_OF_WEEK.some((day) => day === value);
}

/** Valide une entrée externe ; lève `InvalidDayOfWeekError` si la valeur n'est pas acceptée. */
export function parseDayOfWeek(value: unknown): DayOfWeek {
  if (!isDayOfWeek(value)) {
    throw new InvalidDayOfWeekError(
      `Jour invalide : « ${String(value)} » (attendu : ${DAYS_OF_WEEK.join(', ')})`,
    );
  }
  return value;
}
