import type { WakeUpRequest } from './wakeUpApi.ts';
import {
  DAY_LABELS,
  DAYS_OF_WEEK,
  WEATHER_LABELS,
  WEATHER_TYPES,
  type DayOfWeek,
  type WeatherType,
} from './wakeUpOptions.ts';

/** Option d'une liste déroulante. */
export interface FormFieldOption {
  readonly value: string;
  readonly label: string;
}

/** Description d'un champ du formulaire de déclenchement (rendu générique dans `main.ts`). */
export interface FormFieldDescription {
  readonly id: 'userId' | 'dayOfWeek' | 'weather';
  readonly label: string;
  readonly type: 'text' | 'select';
  /** Options d'une liste déroulante, dans l'ordre d'affichage ; vide pour un champ texte. */
  readonly options: ReadonlyArray<FormFieldOption>;
}

/** Champs du formulaire : utilisateur, jour, météo (fonction pure). */
export function describeFormFields(): ReadonlyArray<FormFieldDescription> {
  return [
    { id: 'userId', label: 'Identifiant utilisateur', type: 'text', options: [] },
    {
      id: 'dayOfWeek',
      label: 'Jour de la semaine',
      type: 'select',
      options: DAYS_OF_WEEK.map((value) => ({ value, label: DAY_LABELS[value] })),
    },
    {
      id: 'weather',
      label: 'Météo du jour',
      type: 'select',
      options: WEATHER_TYPES.map((value) => ({ value, label: WEATHER_LABELS[value] })),
    },
  ];
}

/** Valeurs brutes saisies, indexées par identifiant de champ. */
export type FormValues = Readonly<Record<FormFieldDescription['id'], string>>;

/**
 * Traduit la saisie en requête typée (fonction pure) ; `undefined` si un champ est vide ou hors des
 * listes proposées (formulaire altéré). Le serveur reste juge en dernier ressort (400).
 */
export function toWakeUpRequest(values: FormValues): WakeUpRequest | undefined {
  const userId = values.userId.trim();
  const { dayOfWeek, weather } = values;
  if (userId === '' || !isDayOfWeek(dayOfWeek) || !isWeatherType(weather)) return undefined;
  return { userId, dayOfWeek, weather };
}

function isDayOfWeek(value: string): value is DayOfWeek {
  return (DAYS_OF_WEEK as ReadonlyArray<string>).includes(value);
}

function isWeatherType(value: string): value is WeatherType {
  return (WEATHER_TYPES as ReadonlyArray<string>).includes(value);
}
