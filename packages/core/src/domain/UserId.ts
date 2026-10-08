/** Identifiant utilisateur (value object) : chaîne non vide, sans espaces superflus. */
export class UserId {
  private constructor() {}

  /** Lève `InvalidUserIdError` si l'entrée n'est pas une chaîne non vide (hors espaces). */
  static parse(raw: unknown): UserId {
    throw new Error('Not implemented', { cause: raw });
  }

  get value(): string {
    throw new Error('Not implemented');
  }

  equals(other: UserId): boolean {
    throw new Error('Not implemented', { cause: other });
  }

  toString(): string {
    throw new Error('Not implemented');
  }
}
