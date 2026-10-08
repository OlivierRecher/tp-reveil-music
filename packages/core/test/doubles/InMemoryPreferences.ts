import type { UserId, UserPreferences, UserPreferencesProvider } from '../../src/index.ts';

/** Service de préférences en mémoire : renvoie `null` pour un utilisateur inconnu. */
export class InMemoryPreferences implements UserPreferencesProvider {
  readonly #byUserId: ReadonlyMap<string, UserPreferences>;
  readonly requested: UserId[] = [];

  constructor(preferences: ReadonlyArray<UserPreferences> = []) {
    this.#byUserId = new Map(preferences.map((p) => [p.userId.value, p]));
  }

  findByUserId(userId: UserId): Promise<UserPreferences | null> {
    this.requested.push(userId);
    return Promise.resolve(this.#byUserId.get(userId.value) ?? null);
  }
}
