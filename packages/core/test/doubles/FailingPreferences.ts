import type { UserId, UserPreferences, UserPreferencesProvider } from '../../src/index.ts';

/** Service de préférences en panne : rejette toujours. */
export class FailingPreferences implements UserPreferencesProvider {
  readonly #error: Error;
  readonly requested: UserId[] = [];

  constructor(error: Error = new Error('Service de préférences indisponible')) {
    this.#error = error;
  }

  findByUserId(userId: UserId): Promise<UserPreferences | null> {
    this.requested.push(userId);
    return Promise.reject(this.#error);
  }
}
