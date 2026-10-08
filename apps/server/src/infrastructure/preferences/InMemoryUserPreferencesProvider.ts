import type { UserId, UserPreferences, UserPreferencesProvider } from '@reveil/core';

interface Deps {
  readonly preferencesSeed: ReadonlyArray<UserPreferences>;
}

/** Mock du service interne de préférences : jeu de données en mémoire. */
export class InMemoryUserPreferencesProvider implements UserPreferencesProvider {
  readonly #seed: ReadonlyArray<UserPreferences>;

  constructor({ preferencesSeed }: Deps) {
    this.#seed = preferencesSeed;
  }

  findByUserId(userId: UserId): Promise<UserPreferences | null> {
    return Promise.reject(new Error('Not implemented', { cause: { seed: this.#seed, userId } }));
  }
}
