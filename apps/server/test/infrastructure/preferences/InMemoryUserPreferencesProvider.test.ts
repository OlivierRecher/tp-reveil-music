import { describe, expect, it } from 'vitest';
import { CHANNEL_TYPES, TrackQuery, UserId, UserPreferences, WEATHER_TYPES } from '@reveil/core';
import type { UserPreferencesProvider } from '@reveil/core';
import { InMemoryUserPreferencesProvider } from '../../../src/infrastructure/preferences/InMemoryUserPreferencesProvider.ts';
import { createPreferencesSeed } from '../../../src/infrastructure/preferences/preferencesSeed.ts';

/** CA-PRF-02 : le mock n'est manipulé qu'à travers le port, comme tout fournisseur. */
function providerFrom(seed: ReadonlyArray<UserPreferences>): UserPreferencesProvider {
  return new InMemoryUserPreferencesProvider({ preferencesSeed: seed });
}

const ALICE = UserPreferences.create({
  userId: UserId.parse('alice'),
  tracksByWeather: {
    SOLEIL: TrackQuery.create({ title: 'Walking on Sunshine', artist: 'Katrina and the Waves' }),
  },
  fallbackTrack: TrackQuery.create({ title: 'Lovely Day', artist: 'Bill Withers' }),
  preferredChannel: 'SMS',
  contacts: { SMS: '+33600000000' },
});

const BOB = UserPreferences.create({
  userId: UserId.parse('bob'),
  tracksByWeather: {},
  fallbackTrack: TrackQuery.create({ title: 'Wake Me Up', artist: 'Avicii' }),
  preferredChannel: 'PUSH',
  contacts: { PUSH: 'push-token-bob' },
});

/** Toutes les préférences du jeu de données, lues à travers le port. */
async function seededPreferences(): Promise<ReadonlyArray<UserPreferences>> {
  const provider = providerFrom(createPreferencesSeed());
  const ids = ['u1', 'u2', 'u3', 'u4'];
  const found = await Promise.all(ids.map((id) => provider.findByUserId(UserId.parse(id))));
  return found.filter((preferences): preferences is UserPreferences => preferences !== null);
}

describe('InMemoryUserPreferencesProvider', () => {
  it('[CA-PRF-01] renvoie les préférences d’un utilisateur connu : morceau par météo (partiel), secours, canal', async () => {
    const provider = providerFrom([ALICE, BOB]);

    const preferences = await provider.findByUserId(UserId.parse('alice'));

    expect(preferences).not.toBeNull();
    expect(preferences?.userId.value).toBe('alice');
    expect(preferences?.trackFor('SOLEIL')?.title).toBe('Walking on Sunshine');
    expect(preferences?.trackFor('SOLEIL')?.artist).toBe('Katrina and the Waves');
    expect(preferences?.trackFor('PLUIE')).toBeUndefined();
    expect(preferences?.fallbackTrack.title).toBe('Lovely Day');
    expect(preferences?.preferredChannel).toBe('SMS');
    expect(preferences?.contactFor('SMS')).toBe('+33600000000');
  });

  it('[CA-PRF-01] distingue les utilisateurs par identifiant', async () => {
    const provider = providerFrom([ALICE, BOB]);

    const preferences = await provider.findByUserId(UserId.parse('bob'));

    expect(preferences?.userId.value).toBe('bob');
    expect(preferences?.preferredChannel).toBe('PUSH');
  });

  it('[CA-PRF-01] renvoie null pour un utilisateur inconnu', async () => {
    const provider = providerFrom([ALICE, BOB]);

    await expect(provider.findByUserId(UserId.parse('inconnu'))).resolves.toBeNull();
  });

  it('[CA-PRF-01] renvoie null quand le jeu de données est vide', async () => {
    await expect(providerFrom([]).findByUserId(UserId.parse('alice'))).resolves.toBeNull();
  });
});

describe('Jeu de données des préférences (via le port)', () => {
  it('[CA-PRF-01] connaît au moins 4 utilisateurs u1..u4, chacun avec un morceau de secours', async () => {
    const all = await seededPreferences();

    expect(all.map((preferences) => preferences.userId.value)).toEqual(['u1', 'u2', 'u3', 'u4']);
    for (const preferences of all) {
      expect(preferences.fallbackTrack.title).not.toBe('');
    }
  });

  it('[CA-PRF-01] couvre chaque canal EMAIL, SMS et PUSH comme canal préféré', async () => {
    const preferred = new Set((await seededPreferences()).map((p) => p.preferredChannel));

    expect(preferred).toContain('EMAIL');
    expect(preferred).toContain('SMS');
    expect(preferred).toContain('PUSH');
  });

  it('[CA-PRF-01] contient un utilisateur sans coordonnée pour son canal préféré', async () => {
    const all = await seededPreferences();

    expect(all.some((p) => p.contactFor(p.preferredChannel) === undefined)).toBe(true);
  });

  it('[CA-PRF-01] contient un utilisateur sans morceau pour certaines météos (préférences partielles)', async () => {
    const all = await seededPreferences();

    expect(
      all.some((p) => WEATHER_TYPES.some((weather) => p.trackFor(weather) === undefined)),
    ).toBe(true);
  });

  it('[CA-PRF-01] contient un utilisateur couvrant toutes les météos', async () => {
    const all = await seededPreferences();

    expect(
      all.some((p) => WEATHER_TYPES.every((weather) => p.trackFor(weather) !== undefined)),
    ).toBe(true);
  });

  it('ne déclare que des canaux connus du domaine', async () => {
    for (const preferences of await seededPreferences()) {
      expect(CHANNEL_TYPES).toContain(preferences.preferredChannel);
    }
  });
});
