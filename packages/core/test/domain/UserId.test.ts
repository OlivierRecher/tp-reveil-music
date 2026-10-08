import { describe, expect, it } from 'vitest';
import { DomainError, InvalidUserIdError, UserId } from '../../src/index.ts';

const INVALID_USER_IDS: ReadonlyArray<readonly [string, unknown]> = [
  ['chaîne vide', ''],
  ['espaces', '   '],
  ['tabulation et retour à la ligne', '\t\n'],
  ['null', null],
  ['undefined', undefined],
  ['nombre', 42],
  ['objet', { id: 'alice' }],
];

describe('UserId', () => {
  it.each(INVALID_USER_IDS)(
    '[CA-DOM-03] rejette un identifiant vide ou non textuel (%s)',
    (_label, raw) => {
      expect(() => UserId.parse(raw)).toThrow(InvalidUserIdError);
      expect(() => UserId.parse(raw)).toThrow(DomainError);
    },
  );

  it('[CA-DOM-03] accepte un identifiant non vide', () => {
    expect(UserId.parse('user-42').value).toBe('user-42');
  });

  it('retire les espaces entourant un identifiant valide', () => {
    const userId = UserId.parse('  user-42 \t');

    expect(userId.value).toBe('user-42');
    expect(userId.toString()).toBe('user-42');
  });

  it('deux identifiants de même valeur sont égaux', () => {
    expect(UserId.parse('user-42').equals(UserId.parse(' user-42 '))).toBe(true);
    expect(UserId.parse('user-42').equals(UserId.parse('user-43'))).toBe(false);
  });
});
