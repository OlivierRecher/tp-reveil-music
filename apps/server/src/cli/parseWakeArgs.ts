import { parseArgs } from 'node:util';
import { DomainError, UserId, parseDayOfWeek, parseWeatherType } from '@reveil/core';
import type { WakeUpCommand } from '@reveil/core';
import { WakeArgsError } from './WakeArgsError.ts';

/** Options reconnues : toutes obligatoires, chacune avec une valeur. */
const OPTIONS = {
  user: { type: 'string' },
  day: { type: 'string' },
  weather: { type: 'string' },
} as const;

/**
 * Lit les arguments du script CLI de démonstration (`--user`, `--day`, `--weather`) et les
 * convertit en commande du domaine ; lève une `WakeArgsError` explicite si un argument manque ou
 * est invalide.
 */
export function parseWakeArgs(argv: ReadonlyArray<string>): WakeUpCommand {
  const { user, day, weather } = readOptions(argv);
  try {
    return {
      userId: UserId.parse(required('--user', user)),
      dayOfWeek: parseDayOfWeek(required('--day', day)),
      weather: parseWeatherType(required('--weather', weather)),
    };
  } catch (error) {
    // Règles de validation du domaine : même message que l'API HTTP.
    if (error instanceof DomainError) {
      throw new WakeArgsError(error.message, { cause: error });
    }
    throw error;
  }
}

/** Analyse stricte : option inconnue, valeur manquante ou argument positionnel refusés. */
function readOptions(argv: ReadonlyArray<string>) {
  try {
    return parseArgs({ args: [...argv], options: OPTIONS, strict: true, allowPositionals: false })
      .values;
  } catch (error) {
    // Le message de node:util cite l'option fautive (« Unknown option '--canal' »).
    throw new WakeArgsError(error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }
}

function required(option: string, value: string | undefined): string {
  if (value === undefined) {
    throw new WakeArgsError(`Argument manquant : ${option}`);
  }
  return value;
}
