import { afterEach, describe, expect, it } from 'vitest';
import { composeApplication } from '../../src/composition/compositionRoot.ts';
import { createTestWorkspace } from '../doubles/testConfig.ts';

// Tests unitaires (détails d'implémentation) : valeurs par défaut de la composition root, sans réseau.

const workspace = createTestWorkspace();

afterEach(() => {
  workspace.cleanup();
});

describe('composeApplication — valeurs par défaut', () => {
  it('crée son propre pino au niveau LOG_LEVEL et le libère à la fermeture', async () => {
    const app = composeApplication(workspace.config({ LOG_LEVEL: 'fatal' }));

    const logger = app.logger;
    logger.info('message filtré par le niveau fatal');

    await expect(app.dispose()).resolves.toBeUndefined();
  });

  it('la playlist de secours est le fournisseur local de la chaîne musicale', () => {
    const app = composeApplication(workspace.config({ MUSIC_PROVIDERS: '' }));

    expect(app.emergencyPlaylist.pick('NEIGE').source).toBe('local');
  });
});
