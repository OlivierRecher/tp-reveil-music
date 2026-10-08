import { describe, expect, it } from 'vitest';
import { DomainError, InvalidTrackQueryError, TrackQuery } from '../../src/index.ts';

// Tests unitaires de détail (sans ID de critère) : la requête de morceau porte le choix du domaine
// (CA-DOM-04/05) vers les catalogues. La clé de cache et le terme de recherche préparent CA-MUS-09
// et CA-MUS-01 (phase 3), qui seront vérifiés sur les adaptateurs, pas ici.
describe('TrackQuery', () => {
  it('conserve le titre et l’artiste demandés', () => {
    const query = TrackQuery.create({ title: 'Singin’ in the Rain', artist: 'Gene Kelly' });

    expect(query.title).toBe('Singin’ in the Rain');
    expect(query.artist).toBe('Gene Kelly');
  });

  it('l’artiste est facultatif', () => {
    expect(TrackQuery.create({ title: 'Let It Snow' }).artist).toBeUndefined();
  });

  it('un artiste vide ou blanc est considéré comme absent', () => {
    expect(TrackQuery.create({ title: 'Let It Snow', artist: '' }).artist).toBeUndefined();
    expect(TrackQuery.create({ title: 'Let It Snow', artist: '   ' }).artist).toBeUndefined();
  });

  it.each(['', '   ', '\t\n'])('rejette un titre vide ou blanc (%j)', (title) => {
    expect(() => TrackQuery.create({ title })).toThrow(InvalidTrackQueryError);
    expect(() => TrackQuery.create({ title })).toThrow(DomainError);
  });

  it('deux requêtes équivalentes à la casse et aux espaces près ont la même clé de cache', () => {
    const a = TrackQuery.create({ title: 'Here Comes The Sun', artist: 'The Beatles' });
    const b = TrackQuery.create({ title: '  here   comes the SUN ', artist: 'THE  beatles' });

    expect(a.cacheKey).toBe(b.cacheKey);
  });

  it('des requêtes différentes ont des clés de cache différentes', () => {
    const base = TrackQuery.create({ title: 'Yesterday', artist: 'The Beatles' });

    expect(base.cacheKey).not.toBe(TrackQuery.create({ title: 'Yesterday' }).cacheKey);
    expect(base.cacheKey).not.toBe(
      TrackQuery.create({ title: 'Yesterday', artist: 'Boyz II Men' }).cacheKey,
    );
    expect(base.cacheKey).not.toBe(
      TrackQuery.create({ title: 'Help', artist: 'The Beatles' }).cacheKey,
    );
  });

  it('le terme de recherche combine artiste et titre', () => {
    const term = TrackQuery.create({ title: 'Yesterday', artist: 'The Beatles' }).toSearchTerm();

    expect(term).toContain('Yesterday');
    expect(term).toContain('The Beatles');
  });

  it('sans artiste, le terme de recherche est le titre seul', () => {
    expect(TrackQuery.create({ title: '  Yesterday ' }).toSearchTerm()).toBe('Yesterday');
  });
});
