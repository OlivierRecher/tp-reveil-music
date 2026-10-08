import { afterEach, describe, expect, it } from 'vitest';
import { buildContainer } from '../../src/composition/container.ts';
import { createTestWorkspace } from '../doubles/testConfig.ts';

// Tests unitaires (détails d'implémentation) : valeurs par défaut du conteneur, sans réseau.

const workspace = createTestWorkspace();

afterEach(() => {
  workspace.cleanup();
});

describe('buildContainer — valeurs par défaut', () => {
  it('crée son propre pino au niveau LOG_LEVEL et le libère à la fermeture', async () => {
    const container = buildContainer(workspace.config({ LOG_LEVEL: 'fatal' }));

    const logger = container.resolve('logger');
    logger.info('message filtré par le niveau fatal');

    await expect(container.dispose()).resolves.toBeUndefined();
  });

  it('la playlist de secours est le fournisseur local de la chaîne musicale', () => {
    const container = buildContainer(workspace.config({ MUSIC_PROVIDERS: '' }));

    expect(container.resolve('emergencyPlaylist').pick('NEIGE').source).toBe('local');
  });
});
