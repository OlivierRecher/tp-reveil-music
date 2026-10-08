import { describe, expect, it } from 'vitest';
import { TrackQuery } from '@reveil/core';
import { FallbackMusicCatalog } from '../../../src/infrastructure/music/FallbackMusicCatalog.ts';
import { ResilientMusicProvider } from '../../../src/infrastructure/music/ResilientMusicProvider.ts';
import { RecordingLogger } from '../../doubles/RecordingLogger.ts';
import { expectUnavailable } from './doubles/helpers.ts';
import { ScriptedMusicProvider } from './doubles/ScriptedMusicProvider.ts';

// Détails d'implémentation : traduction des erreurs inattendues (complète les tests CA-MUS).

const QUERY = TrackQuery.create({ title: 'Under Pressure', artist: 'Queen' });

describe('traduction des erreurs inattendues', () => {
  it('ResilientMusicProvider : une erreur non typée devient MusicProviderUnavailableError, cause conservée', async () => {
    const cause = new TypeError('fetch failed');
    const provider = new ResilientMusicProvider({
      inner: new ScriptedMusicProvider('itunes').fail(cause),
      timeoutMs: 1_000,
    });

    const outcome = provider.resolve(QUERY);

    await expectUnavailable(outcome, 'itunes');
    await expect(outcome).rejects.toMatchObject({ cause });
  });

  it('FallbackMusicCatalog : un rejet qui n’est pas une Error est journalisé puis contourné', async () => {
    const oddProvider = {
      name: 'itunes',
      // Rejet volontairement non conforme (valeur brute), pour vérifier la robustesse de la chaîne.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      resolve: () => Promise.reject('panne brute'),
    };
    const logger = new RecordingLogger();
    const catalog = new FallbackMusicCatalog({
      musicProviders: [oddProvider],
      localMusicProvider: new ScriptedMusicProvider('local'),
      logger,
    });

    const track = await catalog.resolve(QUERY);

    expect(track.source).toBe('local');
    expect(
      RecordingLogger.text(
        logger.at('warn')[0] ?? { level: 'warn', message: '', context: undefined },
      ),
    ).toContain('panne brute');
  });
});
