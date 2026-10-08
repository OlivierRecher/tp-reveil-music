import { describe, expect, it } from 'vitest';
import { DomainError, InvalidTrackError, LOCAL_TRACK_SOURCE, Track } from '../../src/index.ts';

// Champs des DTO iTunes et MusicBrainz qui ne doivent jamais exister dans le domaine.
const PROVIDER_FIELDS = [
  'trackViewUrl',
  'trackName',
  'artistName',
  'collectionName',
  'artist-credit',
  'recordings',
];

const VALID_PROPS = {
  title: 'Here Comes The Sun',
  artist: 'The Beatles',
  link: 'https://example.org/here-comes-the-sun',
  source: 'itunes',
} as const;

const BLANKS = ['', '   ', '\t\n'];

describe('Track', () => {
  it('[CA-DOM-07] crée un morceau avec un titre et un artiste non vides', () => {
    const track = Track.create(VALID_PROPS);

    expect(track.title).toBe('Here Comes The Sun');
    expect(track.artist).toBe('The Beatles');
    expect(track.link).toBe('https://example.org/here-comes-the-sun');
    expect(track.source).toBe('itunes');
  });

  it('le lien est facultatif', () => {
    const track = Track.create({
      title: 'Clair de lune',
      artist: 'Debussy',
      source: LOCAL_TRACK_SOURCE,
    });

    expect(track.link).toBeUndefined();
    expect(track.source).toBe('local');
  });

  it.each(BLANKS)('[CA-DOM-07] rejette un titre vide ou blanc (%j)', (title) => {
    expect(() => Track.create({ ...VALID_PROPS, title })).toThrow(InvalidTrackError);
    expect(() => Track.create({ ...VALID_PROPS, title })).toThrow(DomainError);
  });

  it.each(BLANKS)('[CA-DOM-07] rejette un artiste vide ou blanc (%j)', (artist) => {
    expect(() => Track.create({ ...VALID_PROPS, artist })).toThrow(InvalidTrackError);
    expect(() => Track.create({ ...VALID_PROPS, artist })).toThrow(DomainError);
  });

  it.each(BLANKS)('rejette une source vide ou blanche (%j)', (source) => {
    expect(() => Track.create({ ...VALID_PROPS, source })).toThrow(InvalidTrackError);
  });

  it('[CA-DOM-07] la forme sérialisée ne contient que les champs du domaine', () => {
    const json: unknown = JSON.parse(JSON.stringify(Track.create(VALID_PROPS)));

    expect(json).toEqual({
      title: 'Here Comes The Sun',
      artist: 'The Beatles',
      link: 'https://example.org/here-comes-the-sun',
      source: 'itunes',
    });
  });

  it('la forme sérialisée omet le lien absent', () => {
    const track = Track.create({ title: 'Clair de lune', artist: 'Debussy', source: 'local' });

    expect(track.toJSON()).toEqual({ title: 'Clair de lune', artist: 'Debussy', source: 'local' });
  });

  it.each(PROVIDER_FIELDS)("[CA-DOM-07] n'expose aucun champ fournisseur (%s)", (field) => {
    const track = Track.create(VALID_PROPS);
    const json = JSON.parse(JSON.stringify(track)) as Record<string, unknown>;

    expect(track.toJSON()).not.toHaveProperty([field]);
    expect(Object.keys(json)).not.toContain(field);
    expect(field in track).toBe(false);
  });
});
