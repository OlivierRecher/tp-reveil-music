import type { WakeUpCommand } from '@reveil/core';

/**
 * Lit les arguments du script CLI de démonstration (`--user`, `--day`, `--weather`) et les
 * convertit en commande du domaine ; lève une erreur explicite si un argument manque ou est invalide.
 */
export function parseWakeArgs(argv: ReadonlyArray<string>): WakeUpCommand {
  throw new Error('Not implemented', { cause: { argv } });
}
