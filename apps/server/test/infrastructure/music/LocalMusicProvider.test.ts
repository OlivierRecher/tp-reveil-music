import { describe, expect, it } from 'vitest';
import { LOCAL_TRACK_SOURCE, Track, TrackQuery, WEATHER_TYPES } from '@reveil/core';
import type { WeatherType } from '@reveil/core';
import { LocalMusicProvider } from '../../../src/infrastructure/music/LocalMusicProvider.ts';
import { LOCAL_TRACKS } from '../../../src/infrastructure/music/localTracks.ts';

// Fallback local : dernier filet de la chaîne musicale, sans réseau, qui ne lève jamais (CA-MUS-08).

function isLocalTrack(track: Track, weather?: WeatherType): boolean {
  return LOCAL_TRACKS.some(
    (entry) =>
      entry.title === track.title &&
      entry.artist === track.artist &&
      (weather === undefined || entry.weather === weather),
  );
}

describe('LocalMusicProvider', () => {
  it('se nomme « local »', () => {
    expect(new LocalMusicProvider().name).toBe('local');
  });

  describe('playlist codée en dur', () => {
    it('[CA-MUS-08] contient entre 5 et 10 morceaux', () => {
      expect(LOCAL_TRACKS.length).toBeGreaterThanOrEqual(5);
      expect(LOCAL_TRACKS.length).toBeLessThanOrEqual(10);
    });

    it.each(WEATHER_TYPES)(
      '[CA-MUS-08] contient au moins un morceau pour la météo %s',
      (weather) => {
        expect(LOCAL_TRACKS.some((entry) => entry.weather === weather)).toBe(true);
      },
    );
  });

  describe('pick (EmergencyPlaylist)', () => {
    it.each(WEATHER_TYPES)(
      '[CA-MUS-08] renvoie de façon synchrone un morceau local adapté à la météo %s',
      (weather) => {
        const provider = new LocalMusicProvider();

        const track = provider.pick(weather);

        expect(track).toBeInstanceOf(Track);
        expect(track.source).toBe(LOCAL_TRACK_SOURCE);
        expect(isLocalTrack(track, weather)).toBe(true);
      },
    );

    it('[CA-MUS-08] ne lève jamais, même appelé de nombreuses fois', () => {
      const provider = new LocalMusicProvider();

      for (let round = 0; round < 25; round += 1) {
        for (const weather of WEATHER_TYPES) {
          expect(() => provider.pick(weather)).not.toThrow();
        }
      }
    });
  });

  describe('resolve (MusicProvider)', () => {
    it('[CA-MUS-08] renvoie le morceau local correspondant au titre demandé', async () => {
      const provider = new LocalMusicProvider();

      const track = await provider.resolve(
        TrackQuery.create({ title: 'Purple Rain', artist: 'Prince' }),
      );

      expect(track.title).toBe('Purple Rain');
      expect(track.artist).toBe('Prince');
      expect(track.source).toBe(LOCAL_TRACK_SOURCE);
    });

    it('[CA-MUS-08] reconnaît le titre sans tenir compte de la casse ni des espaces superflus', async () => {
      const provider = new LocalMusicProvider();

      const track = await provider.resolve(
        TrackQuery.create({ title: '  purple   RAIN ', artist: 'prince' }),
      );

      expect(track.title).toBe('Purple Rain');
      expect(track.artist).toBe('Prince');
      expect(track.source).toBe(LOCAL_TRACK_SOURCE);
    });

    it('[CA-MUS-08] ne rejette jamais : un titre inconnu donne un morceau local déterministe', async () => {
      const provider = new LocalMusicProvider();
      const unknown = TrackQuery.create({ title: 'Morceau introuvable', artist: 'Personne' });

      const first = await provider.resolve(unknown);
      const second = await provider.resolve(unknown);

      expect(first.source).toBe(LOCAL_TRACK_SOURCE);
      expect(isLocalTrack(first)).toBe(true);
      expect(second.toJSON()).toEqual(first.toJSON());
    });
  });
});
