import { describe, expect, it } from 'vitest';
import { TrackQuery, UserId, UserPreferences, WEATHER_TYPES } from '../../src/index.ts';

describe('UserPreferences', () => {
  it('[CA-DOM-04] restitue le morceau associé à une météo couverte', () => {
    const userId = UserId.parse('user-42');
    const rain = TrackQuery.create({ title: 'Singin’ in the Rain', artist: 'Gene Kelly' });
    const preferences = UserPreferences.create({
      userId,
      tracksByWeather: { PLUIE: rain },
      fallbackTrack: TrackQuery.create({ title: 'Wake Me Up', artist: 'Avicii' }),
      preferredChannel: 'SMS',
      contacts: { SMS: '+33600000000' },
    });

    expect(preferences.trackFor('PLUIE')?.title).toBe('Singin’ in the Rain');
    expect(preferences.userId.equals(userId)).toBe(true);
    expect(preferences.preferredChannel).toBe('SMS');
    expect(preferences.contactFor('SMS')).toBe('+33600000000');
  });

  it('[CA-DOM-05] une météo non couverte n’a pas de morceau dédié et le morceau de secours reste disponible', () => {
    const userId = UserId.parse('user-42');
    const preferences = UserPreferences.create({
      userId,
      tracksByWeather: {},
      fallbackTrack: TrackQuery.create({ title: 'Wake Me Up', artist: 'Avicii' }),
      preferredChannel: 'EMAIL',
      contacts: {},
    });

    expect(preferences.trackFor('NEIGE')).toBeUndefined();
    expect(preferences.fallbackTrack.title).toBe('Wake Me Up');
    expect(preferences.contactFor('EMAIL')).toBeUndefined();
  });

  describe('préférences par défaut (mode dégradé, support de CA-APP-06 vérifié en phase 2)', () => {
    it('ne couvrent aucune météo', () => {
      const userId = UserId.parse('user-42');
      const preferences = UserPreferences.createDefault(userId);

      for (const weather of WEATHER_TYPES) {
        expect(preferences.trackFor(weather)).toBeUndefined();
      }
    });

    it('proposent un morceau de secours non vide', () => {
      const userId = UserId.parse('user-42');
      const preferences = UserPreferences.createDefault(userId);

      expect(preferences.fallbackTrack.title.trim()).not.toBe('');
    });

    it('utilisent le canal de dernier recours LOG, sans coordonnées', () => {
      const userId = UserId.parse('user-42');
      const preferences = UserPreferences.createDefault(userId);

      expect(preferences.userId.equals(userId)).toBe(true);
      expect(preferences.preferredChannel).toBe('LOG');
      expect(preferences.contactFor('EMAIL')).toBeUndefined();
      expect(preferences.contactFor('SMS')).toBeUndefined();
      expect(preferences.contactFor('PUSH')).toBeUndefined();
    });
  });
});

describe('UserPreferences (immutabilité)', () => {
  it('une modification ultérieure des objets fournis ne change pas les préférences', () => {
    const tracksByWeather: Partial<Record<'PLUIE' | 'NEIGE', TrackQuery>> = {};
    const contacts: Partial<Record<'SMS' | 'EMAIL', string>> = { SMS: '+33600000000' };
    const preferences = UserPreferences.create({
      userId: UserId.parse('user-42'),
      tracksByWeather,
      fallbackTrack: TrackQuery.create({ title: 'Wake Me Up' }),
      preferredChannel: 'SMS',
      contacts,
    });

    tracksByWeather.NEIGE = TrackQuery.create({ title: 'Let It Snow' });
    contacts.SMS = '+33611111111';

    expect(preferences.trackFor('NEIGE')).toBeUndefined();
    expect(preferences.contactFor('SMS')).toBe('+33600000000');
  });
});
