// Point d'entrée : assemble l'application (composition root) puis démarre l'API HTTP.
import { composeApplication } from './composition/compositionRoot.ts';
import { ConfigError } from './config/ConfigError.ts';
import { loadConfig } from './config/env.ts';
import type { AppConfig } from './config/env.ts';
import { buildHttpServer } from './http/buildHttpServer.ts';

/** Écoute sur toutes les interfaces : la PWA peut être testée depuis un téléphone du réseau local. */
const HOST = '0.0.0.0';

function readConfig(): AppConfig {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      // Échec explicite au démarrage : chaque variable invalide est listée.
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const config = readConfig();
const application = composeApplication(config);
const { logger } = application;
const app = buildHttpServer({ triggerWakeUp: application.triggerWakeUp, logger });

await app.listen({ port: config.port, host: HOST });
logger.info('API du réveil musical démarrée', {
  port: config.port,
  musicProviders: config.musicProviders,
  simulatedFailures: [...config.simulatedFailures],
});

/** Arrêt propre : plus de nouvelles requêtes, puis libération des ressources de l'application. */
async function shutdown(signal: string): Promise<void> {
  logger.info('Arrêt du serveur', { signal });
  await app.close();
  await application.dispose();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      console.error('Arrêt du serveur en erreur', error);
      process.exitCode = 1;
    });
  });
}
