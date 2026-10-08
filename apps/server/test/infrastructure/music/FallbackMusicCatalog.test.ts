import { describe, expect, it } from 'vitest';
import { LOCAL_TRACK_SOURCE, TrackQuery } from '@reveil/core';
import { FallbackMusicCatalog } from '../../../src/infrastructure/music/FallbackMusicCatalog.ts';
import { LocalMusicProvider } from '../../../src/infrastructure/music/LocalMusicProvider.ts';
import type { MusicProvider } from '../../../src/infrastructure/music/MusicProvider.ts';
import { RecordingLogger } from '../../doubles/RecordingLogger.ts';
import { ScriptedMusicProvider } from './doubles/ScriptedMusicProvider.ts';

// Chaîne de responsabilité : ordre configuré, premier succès, warn à chaque bascule, local en dernier.

const QUERY = TrackQuery.create({ title: 'Under Pressure', artist: 'Queen' });

function chain(
  musicProviders: ReadonlyArray<MusicProvider>,
  localMusicProvider: MusicProvider = new ScriptedMusicProvider('local'),
): { readonly catalog: FallbackMusicCatalog; readonly logger: RecordingLogger } {
  const logger = new RecordingLogger();
  const catalog = new FallbackMusicCatalog({ musicProviders, localMusicProvider, logger });
  return { catalog, logger };
}

describe('FallbackMusicCatalog', () => {
  describe('ordre et premier résultat valide', () => {
    it('[CA-MUS-07] renvoie le résultat du premier fournisseur sans appeler les suivants', async () => {
      const callLog: string[] = [];
      const itunes = new ScriptedMusicProvider('itunes', callLog);
      const musicBrainz = new ScriptedMusicProvider('musicbrainz', callLog);
      const local = new ScriptedMusicProvider('local', callLog);
      const { catalog, logger } = chain([itunes, musicBrainz], local);

      const track = (await catalog.resolve(QUERY)).track;

      expect(track.source).toBe('itunes');
      expect(callLog).toEqual(['itunes']);
      expect(logger.at('warn')).toHaveLength(0);
    });

    it('[CA-MUS-07] essaie les fournisseurs dans l’ordre configuré et renvoie le premier succès', async () => {
      const callLog: string[] = [];
      const itunes = new ScriptedMusicProvider('itunes', callLog).fail();
      const musicBrainz = new ScriptedMusicProvider('musicbrainz', callLog);
      const other = new ScriptedMusicProvider('autre', callLog);
      const local = new ScriptedMusicProvider('local', callLog);
      const { catalog } = chain([itunes, musicBrainz, other], local);

      const track = (await catalog.resolve(QUERY)).track;

      expect(track.source).toBe('musicbrainz');
      expect(track.toJSON()).toEqual(musicBrainz.trackFor(QUERY).toJSON());
      expect(callLog).toEqual(['itunes', 'musicbrainz']);
    });

    it('[CA-MUS-07] respecte un autre ordre de configuration (musicbrainz puis itunes)', async () => {
      const callLog: string[] = [];
      const itunes = new ScriptedMusicProvider('itunes', callLog);
      const musicBrainz = new ScriptedMusicProvider('musicbrainz', callLog).fail();
      const { catalog } = chain([musicBrainz, itunes], new ScriptedMusicProvider('local', callLog));

      const track = (await catalog.resolve(QUERY)).track;

      expect(track.source).toBe('itunes');
      expect(callLog).toEqual(['musicbrainz', 'itunes']);
    });

    it('[CA-MUS-07] transmet la requête telle quelle à chaque fournisseur', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const musicBrainz = new ScriptedMusicProvider('musicbrainz');
      const { catalog } = chain([itunes, musicBrainz]);

      await catalog.resolve(QUERY);

      expect(itunes.queries).toEqual([QUERY]);
      expect(musicBrainz.queries).toEqual([QUERY]);
    });

    it('[CA-MUS-07] journalise chaque échec au niveau warn en nommant le fournisseur', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const musicBrainz = new ScriptedMusicProvider('musicbrainz').fail();
      const other = new ScriptedMusicProvider('autre');
      const { catalog, logger } = chain([itunes, musicBrainz, other]);

      await catalog.resolve(QUERY);

      const warnings = logger.at('warn').map((entry) => RecordingLogger.text(entry));
      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toContain('itunes');
      expect(warnings[1]).toContain('musicbrainz');
    });

    it('[CA-MUS-06] bascule aussi sur une erreur non typée (pas de crash de la chaîne)', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail(new TypeError('fetch failed'));
      const musicBrainz = new ScriptedMusicProvider('musicbrainz');
      const { catalog } = chain([itunes, musicBrainz]);

      const track = (await catalog.resolve(QUERY)).track;

      expect(track.source).toBe('musicbrainz');
    });
  });

  describe('fallback local', () => {
    it('[CA-MUS-08] tous les fournisseurs distants en panne : renvoie le morceau du fournisseur local', async () => {
      const callLog: string[] = [];
      const itunes = new ScriptedMusicProvider('itunes', callLog).fail();
      const musicBrainz = new ScriptedMusicProvider('musicbrainz', callLog).fail();
      const local = new ScriptedMusicProvider('local', callLog);
      const { catalog, logger } = chain([itunes, musicBrainz], local);

      const track = (await catalog.resolve(QUERY)).track;

      expect(track.source).toBe('local');
      expect(callLog).toEqual(['itunes', 'musicbrainz', 'local']);
      expect(logger.at('warn').length).toBeGreaterThanOrEqual(2);
    });

    it('[CA-MUS-08] tous en panne avec le vrai LocalMusicProvider : un morceau local est renvoyé, sans rejet', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const musicBrainz = new ScriptedMusicProvider('musicbrainz').fail(new Error('HTTP 503'));
      const { catalog } = chain([itunes, musicBrainz], new LocalMusicProvider());

      const track = (await catalog.resolve(QUERY)).track;

      expect(track.source).toBe(LOCAL_TRACK_SOURCE);
    });

    it('[CA-MUS-08] sans fournisseur distant configuré, le fournisseur local répond', async () => {
      const { catalog } = chain([], new LocalMusicProvider());

      const track = (await catalog.resolve(QUERY)).track;

      expect(track.source).toBe(LOCAL_TRACK_SOURCE);
    });
  });
  describe('signal de repli', () => {
    it('[CA-APP-10] ne signale aucun repli quand un fournisseur distant répond', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const musicBrainz = new ScriptedMusicProvider('musicbrainz');
      const { catalog } = chain([itunes, musicBrainz]);

      const resolved = await catalog.resolve(QUERY);

      expect(resolved.track.source).toBe('musicbrainz');
      expect(resolved.degraded).toBe(false);
    });

    it('[CA-APP-10] signale le repli quand le morceau vient du fournisseur local', async () => {
      const itunes = new ScriptedMusicProvider('itunes').fail();
      const { catalog } = chain([itunes], new LocalMusicProvider());

      const resolved = await catalog.resolve(QUERY);

      expect(resolved.degraded).toBe(true);
    });

    it('[CA-APP-10] le signal ne dépend pas du nom de la source : un fournisseur distant nommé « local » n’est pas un repli', async () => {
      const homonym = new ScriptedMusicProvider(LOCAL_TRACK_SOURCE);
      const { catalog } = chain([homonym], new ScriptedMusicProvider('secours'));

      const resolved = await catalog.resolve(QUERY);

      expect(resolved.track.source).toBe(LOCAL_TRACK_SOURCE);
      expect(resolved.degraded).toBe(false);
    });
  });
});
