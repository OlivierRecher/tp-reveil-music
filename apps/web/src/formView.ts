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
  throw new Error('Not implemented');
}
