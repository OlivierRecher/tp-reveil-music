import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppConfig } from '../../src/config/env.ts';
import { loadConfig } from '../../src/config/env.ts';

/** Dossier temporaire où écrit le journal des notifications d'un test (supprimé par `cleanup`). */
export interface TestWorkspace {
  readonly notificationLogFile: string;
  config(env?: Readonly<Record<string, string | undefined>>): AppConfig;
  cleanup(): void;
}

/** Configuration de test construite par `loadConfig`, comme au démarrage réel. */
export function createTestWorkspace(): TestWorkspace {
  const directory = mkdtempSync(join(tmpdir(), 'reveil-test-'));
  const notificationLogFile = join(directory, 'notifications.log');
  return {
    notificationLogFile,
    config: (env = {}) =>
      loadConfig({
        MUSICBRAINZ_USER_AGENT: 'ReveilMusical-test/0.0.0 ( test@example.org )',
        NOTIFICATION_LOG_FILE: notificationLogFile,
        ...env,
      }),
    cleanup: () => {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
