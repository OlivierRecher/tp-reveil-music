import { describe, expect, it } from 'vitest';
import { parseWakeArgs } from '../../src/cli/parseWakeArgs.ts';

/** Message de l'erreur levée par `parseWakeArgs` (échoue si rien n'est levé). */
function errorMessageOf(argv: ReadonlyArray<string>): string {
  try {
    parseWakeArgs(argv);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return (error as Error).message;
  }
  throw new Error('parseWakeArgs aurait dû lever une erreur');
}

const VALID_ARGS = ['--user', 'u1', '--day', 'LUNDI', '--weather', 'PLUIE'] as const;

describe('parseWakeArgs', () => {
  it('convertit les arguments en commande du domaine', () => {
    const command = parseWakeArgs(VALID_ARGS);

    expect(command.userId.value).toBe('u1');
    expect(command.dayOfWeek).toBe('LUNDI');
    expect(command.weather).toBe('PLUIE');
  });

  it('accepte la forme --option=valeur', () => {
    const command = parseWakeArgs(['--user=u2', '--day=MARDI', '--weather=NEIGE']);

    expect(command.userId.value).toBe('u2');
    expect(command.dayOfWeek).toBe('MARDI');
    expect(command.weather).toBe('NEIGE');
  });

  it.each([
    ['--user', ['--day', 'LUNDI', '--weather', 'PLUIE']],
    ['--day', ['--user', 'u1', '--weather', 'PLUIE']],
    ['--weather', ['--user', 'u1', '--day', 'LUNDI']],
  ])('signale l’argument manquant %s', (option, argv) => {
    expect(errorMessageOf(argv)).toContain(option);
  });

  it('refuse une météo invalide en citant la valeur', () => {
    expect(errorMessageOf(['--user', 'u1', '--day', 'LUNDI', '--weather', 'ORAGE'])).toContain(
      'ORAGE',
    );
  });

  it('refuse un jour invalide en citant la valeur', () => {
    expect(errorMessageOf(['--user', 'u1', '--day', 'FUNDAY', '--weather', 'PLUIE'])).toContain(
      'FUNDAY',
    );
  });

  it('refuse un identifiant vide', () => {
    expect(errorMessageOf(['--user', '  ', '--day', 'LUNDI', '--weather', 'PLUIE'])).toMatch(
      /identifiant|--user/i,
    );
  });

  it('refuse une option inconnue', () => {
    expect(errorMessageOf([...VALID_ARGS, '--canal', 'SMS'])).toContain('--canal');
  });
});
