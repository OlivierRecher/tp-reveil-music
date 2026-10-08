// Script de démonstration : déclenche un réveil sans serveur HTTP (l'ordonnancement est hors
// périmètre). Usage : npm run wake -- --user u1 --day LUNDI --weather PLUIE
import { pino } from 'pino';
import { composeApplication } from '../composition/compositionRoot.ts';
import { ConfigError } from '../config/ConfigError.ts';
import { loadConfig } from '../config/env.ts';
import { parseWakeArgs } from './parseWakeArgs.ts';
import { WakeArgsError } from './WakeArgsError.ts';

const USAGE =
  'Usage : npm run wake -- --user <id> --day <LUNDI…DIMANCHE> --weather <SOLEIL|PLUIE|NEIGE|NUAGEUX>';

/** Code de sortie : 0 si le réveil a été émis (même en mode dégradé), 1 si la saisie est invalide. */
async function main(argv: ReadonlyArray<string>): Promise<number> {
  let command;
  let config;
  try {
    command = parseWakeArgs(argv);
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof WakeArgsError || error instanceof ConfigError) {
      console.error(error.message);
      console.error(USAGE);
      return 1;
    }
    throw error;
  }

  // Journal applicatif sur la sortie d'erreur : la sortie standard ne porte que la trace de l'envoi
  // simulé (FileNotificationLog, CA-NOT-02) et le rapport.
  const app = composeApplication(config, {
    pinoLogger: pino({ level: config.logLevel }, pino.destination(2)),
  });
  try {
    const report = await app.triggerWakeUp.execute(command);
    // `Track` se sérialise par son `toJSON`.
    console.log(JSON.stringify(report, null, 2));
    return 0;
  } finally {
    await app.dispose();
  }
}

process.exitCode = await main(process.argv.slice(2));
