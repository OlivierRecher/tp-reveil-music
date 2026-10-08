import { TrackQuery, UserId, UserPreferences } from '@reveil/core';

/**
 * Jeu de données du mock de préférences (ARCHITECTURE §6) :
 * - u1 : EMAIL préféré, toutes les météos couvertes, toutes les coordonnées ;
 * - u2 : SMS préféré, préférences partielles (ni NEIGE ni NUAGEUX) ;
 * - u3 : PUSH préféré ;
 * - u4 : SMS préféré mais sans numéro (bascule sur un autre canal).
 */
export function createPreferencesSeed(): ReadonlyArray<UserPreferences> {
  return Object.freeze([
    UserPreferences.create({
      userId: UserId.parse('u1'),
      tracksByWeather: {
        SOLEIL: TrackQuery.create({
          title: 'Walking on Sunshine',
          artist: 'Katrina and the Waves',
        }),
        PLUIE: TrackQuery.create({ title: 'Riders on the Storm', artist: 'The Doors' }),
        NEIGE: TrackQuery.create({ title: 'Let It Snow', artist: 'Dean Martin' }),
        NUAGEUX: TrackQuery.create({ title: 'Clouds', artist: 'Joni Mitchell' }),
      },
      fallbackTrack: TrackQuery.create({ title: 'Lovely Day', artist: 'Bill Withers' }),
      preferredChannel: 'EMAIL',
      contacts: {
        EMAIL: 'u1@example.org',
        SMS: '+33600000001',
        PUSH: 'push-token-u1',
      },
    }),
    UserPreferences.create({
      userId: UserId.parse('u2'),
      tracksByWeather: {
        SOLEIL: TrackQuery.create({ title: 'Here Comes the Sun', artist: 'The Beatles' }),
        PLUIE: TrackQuery.create({ title: 'Singin’ in the Rain', artist: 'Gene Kelly' }),
      },
      fallbackTrack: TrackQuery.create({ title: 'Good Morning', artist: 'Kanye West' }),
      preferredChannel: 'SMS',
      contacts: {
        EMAIL: 'u2@example.org',
        SMS: '+33600000002',
      },
    }),
    UserPreferences.create({
      userId: UserId.parse('u3'),
      tracksByWeather: {
        SOLEIL: TrackQuery.create({ title: 'Mr. Blue Sky', artist: 'Electric Light Orchestra' }),
        PLUIE: TrackQuery.create({ title: 'Purple Rain', artist: 'Prince' }),
        NEIGE: TrackQuery.create({ title: 'Snow (Hey Oh)', artist: 'Red Hot Chili Peppers' }),
        NUAGEUX: TrackQuery.create({ title: 'Both Sides Now', artist: 'Joni Mitchell' }),
      },
      fallbackTrack: TrackQuery.create({ title: 'Wake Me Up', artist: 'Avicii' }),
      preferredChannel: 'PUSH',
      contacts: {
        PUSH: 'push-token-u3',
        EMAIL: 'u3@example.org',
      },
    }),
    UserPreferences.create({
      userId: UserId.parse('u4'),
      tracksByWeather: {
        SOLEIL: TrackQuery.create({ title: 'Good Day Sunshine', artist: 'The Beatles' }),
        NUAGEUX: TrackQuery.create({ title: 'Cloudbusting', artist: 'Kate Bush' }),
      },
      fallbackTrack: TrackQuery.create({ title: 'Morning Has Broken', artist: 'Cat Stevens' }),
      preferredChannel: 'SMS',
      contacts: {
        EMAIL: 'u4@example.org',
      },
    }),
  ]);
}
