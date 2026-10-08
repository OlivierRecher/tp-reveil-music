import { describe, expect, it } from 'vitest';
import {
  DAYS_OF_WEEK,
  TrackQuery,
  UserId,
  UserPreferences,
  WEATHER_TYPES,
  WeatherTrackSelectionPolicy,
} from '../../src/index.ts';
import type { TrackSelectionPolicy, WeatherType } from '../../src/index.ts';

// Un morceau distinct par météo, pour vérifier que c'est bien CELUI de la météo du jour qui est choisi.
const DEDICATED_TITLES: Readonly<Record<WeatherType, string>> = {
  SOLEIL: 'Here Comes The Sun',
  PLUIE: 'Singin’ in the Rain',
  NEIGE: 'Let It Snow',
  NUAGEUX: 'Both Sides Now',
};
const FALLBACK_TITLE = 'Wake Me Up';

function preferencesCovering(weathers: ReadonlyArray<WeatherType>): UserPreferences {
  const tracksByWeather: Partial<Record<WeatherType, TrackQuery>> = {};
  for (const weather of weathers) {
    tracksByWeather[weather] = TrackQuery.create({ title: DEDICATED_TITLES[weather] });
  }
  return UserPreferences.create({
    userId: UserId.parse('user-42'),
    tracksByWeather,
    fallbackTrack: TrackQuery.create({ title: FALLBACK_TITLE, artist: 'Avicii' }),
    preferredChannel: 'EMAIL',
    contacts: { EMAIL: 'user42@example.org' },
  });
}

const policy: TrackSelectionPolicy = new WeatherTrackSelectionPolicy();

describe('WeatherTrackSelectionPolicy', () => {
  describe('[CA-DOM-06] utilisateur couvrant les 4 météos', () => {
    it.each(WEATHER_TYPES)(
      '[CA-DOM-04] météo %s couverte : le morceau dédié est demandé',
      (weather) => {
        const query = policy.select(preferencesCovering(WEATHER_TYPES), weather, 'LUNDI');

        expect(query.title).toBe(DEDICATED_TITLES[weather]);
      },
    );
  });

  describe('[CA-DOM-06] utilisateur sans aucune météo couverte', () => {
    it.each(WEATHER_TYPES)(
      '[CA-DOM-05] météo %s non couverte : le morceau de secours est demandé',
      (weather) => {
        const query = policy.select(preferencesCovering([]), weather, 'LUNDI');

        expect(query.title).toBe(FALLBACK_TITLE);
        expect(query.artist).toBe('Avicii');
      },
    );
  });

  describe('[CA-DOM-06] utilisateur aux préférences partielles (seulement PLUIE)', () => {
    it('[CA-DOM-04] PLUIE couverte : le morceau dédié est demandé', () => {
      const query = policy.select(preferencesCovering(['PLUIE']), 'PLUIE', 'MARDI');

      expect(query.title).toBe(DEDICATED_TITLES.PLUIE);
    });

    it.each(WEATHER_TYPES.filter((weather) => weather !== 'PLUIE'))(
      '[CA-DOM-05] météo %s non couverte : le morceau de secours est demandé',
      (weather) => {
        const query = policy.select(preferencesCovering(['PLUIE']), weather, 'MARDI');

        expect(query.title).toBe(FALLBACK_TITLE);
      },
    );
  });

  describe('[CA-DOM-06] chaque météo testée seule, couverte ou non', () => {
    it.each(WEATHER_TYPES)(
      '[CA-DOM-04] seule %s couverte : son morceau est demandé pour cette météo',
      (weather) => {
        expect(policy.select(preferencesCovering([weather]), weather, 'JEUDI').title).toBe(
          DEDICATED_TITLES[weather],
        );
      },
    );

    it.each(WEATHER_TYPES)(
      '[CA-DOM-05] toutes sauf %s couvertes : le secours est demandé pour cette météo',
      (weather) => {
        const others = WEATHER_TYPES.filter((other) => other !== weather);

        expect(policy.select(preferencesCovering(others), weather, 'JEUDI').title).toBe(
          FALLBACK_TITLE,
        );
      },
    );
  });

  // Hypothèse ARCHITECTURE §6 : le service fournit un morceau par météo, le jour ne change pas le choix.
  describe('indépendance vis-à-vis du jour (hypothèse ARCHITECTURE §6)', () => {
    it.each(DAYS_OF_WEEK)('[CA-DOM-04] %s : le morceau dédié à la météo est demandé', (day) => {
      expect(policy.select(preferencesCovering(['NEIGE']), 'NEIGE', day).title).toBe(
        DEDICATED_TITLES.NEIGE,
      );
    });

    it.each(DAYS_OF_WEEK)('[CA-DOM-05] %s : le morceau de secours est demandé', (day) => {
      expect(policy.select(preferencesCovering(['NEIGE']), 'SOLEIL', day).title).toBe(
        FALLBACK_TITLE,
      );
    });
  });
});
