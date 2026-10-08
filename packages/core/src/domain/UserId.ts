import { InvalidUserIdError } from './InvalidUserIdError.ts';

/** Identifiant utilisateur (value object) : chaîne non vide, sans espaces superflus. */
export class UserId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  /** Lève `InvalidUserIdError` si l'entrée n'est pas une chaîne non vide (hors espaces). */
  static parse(raw: unknown): UserId {
    if (typeof raw !== 'string') {
      throw new InvalidUserIdError("L'identifiant utilisateur doit être une chaîne de caractères");
    }
    const value = raw.trim();
    if (value === '') {
      throw new InvalidUserIdError("L'identifiant utilisateur ne peut pas être vide");
    }
    return new UserId(value);
  }

  get value(): string {
    return this.#value;
  }

  equals(other: UserId): boolean {
    return this.#value === other.#value;
  }

  toString(): string {
    return this.#value;
  }
}
