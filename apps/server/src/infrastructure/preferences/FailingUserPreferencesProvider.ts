import type { UserId, UserPreferences, UserPreferencesProvider } from '@reveil/core';

/** Service de préférences toujours en panne (démo `SIMULATED_FAILURES=preferences`). */
export class FailingUserPreferencesProvider implements UserPreferencesProvider {
  findByUserId(userId: UserId): Promise<UserPreferences | null> {
    return Promise.reject(new Error('Not implemented', { cause: userId }));
  }
}
