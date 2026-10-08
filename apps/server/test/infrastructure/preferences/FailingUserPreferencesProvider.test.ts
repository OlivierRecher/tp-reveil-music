import { describe, expect, it } from 'vitest';
import { UserId } from '@reveil/core';
import type { UserPreferencesProvider } from '@reveil/core';
import { FailingUserPreferencesProvider } from '../../../src/infrastructure/preferences/FailingUserPreferencesProvider.ts';

describe('FailingUserPreferencesProvider', () => {
  it('[CA-PRF-02] simule un service de préférences indisponible derrière le même port', async () => {
    const provider: UserPreferencesProvider = new FailingUserPreferencesProvider();

    await expect(provider.findByUserId(UserId.parse('u1'))).rejects.toThrow(/indisponible/);
  });

  it('échoue pour tout utilisateur, connu ou non', async () => {
    const provider: UserPreferencesProvider = new FailingUserPreferencesProvider();

    await expect(provider.findByUserId(UserId.parse('inconnu'))).rejects.toThrow(/indisponible/);
  });
});
