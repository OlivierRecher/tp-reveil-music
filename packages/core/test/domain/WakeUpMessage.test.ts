import { describe, expect, it } from 'vitest';
import { Track, WakeUpMessage, WEATHER_TYPES } from '../../src/index.ts';
import type { DayOfWeek, WeatherType } from '../../src/index.ts';

// Le message est en français et lisible : on attend le libellé usuel du jour et de la météo,
// pas la constante technique. Libellés retenus (formulation libre autour d'eux) :
//   jours  : le nom du jour en français (« lundi »… insensible à la casse) ;
//   météos : SOLEIL → « soleil », PLUIE → « pluie » ou « pleut », NEIGE → « neige »,
//            NUAGEUX → « nuage », « nuageux »… (radical « nuag »).
const DAY_LABELS: Readonly<Record<DayOfWeek, RegExp>> = {
  LUNDI: /lundi/i,
  MARDI: /mardi/i,
  MERCREDI: /mercredi/i,
  JEUDI: /jeudi/i,
  VENDREDI: /vendredi/i,
  SAMEDI: /samedi/i,
  DIMANCHE: /dimanche/i,
};
const WEATHER_LABELS: Readonly<Record<WeatherType, RegExp>> = {
  SOLEIL: /soleil/i,
  PLUIE: /pluie|pleut/i,
  NEIGE: /neige/i,
  NUAGEUX: /nuag/i,
};
const SAMPLE_DAYS: ReadonlyArray<DayOfWeek> = ['LUNDI', 'MERCREDI', 'SAMEDI', 'DIMANCHE'];

const CASES = WEATHER_TYPES.flatMap((weather) => SAMPLE_DAYS.map((day) => [weather, day] as const));

function sampleTrack(): Track {
  return Track.create({
    title: 'Here Comes The Sun',
    artist: 'The Beatles',
    link: 'https://example.org/here-comes-the-sun',
    source: 'itunes',
  });
}

// Le corps seul doit suffire : certains canaux (SMS, push) n'envoient pas l'objet.
function fullText(message: WakeUpMessage): string {
  return message.body;
}

describe('WakeUpMessage', () => {
  it.each(CASES)(
    '[CA-DOM-08] météo %s, %s : le message contient titre, artiste, jour et météo',
    (weather, day) => {
      const text = fullText(WakeUpMessage.compose(sampleTrack(), day, weather));

      expect(text).toContain('Here Comes The Sun');
      expect(text).toContain('The Beatles');
      expect(text).toMatch(DAY_LABELS[day]);
      expect(text).toMatch(WEATHER_LABELS[weather]);
    },
  );

  it('[CA-DOM-08] le corps du message cite le morceau', () => {
    const message = WakeUpMessage.compose(sampleTrack(), 'VENDREDI', 'PLUIE');

    expect(message.body).toContain('Here Comes The Sun');
    expect(message.body).toContain('The Beatles');
    expect(message.subject.trim()).not.toBe('');
  });

  it('[CA-DOM-08] conserve le morceau, le jour et la météo du réveil', () => {
    const track = sampleTrack();
    const message = WakeUpMessage.compose(track, 'JEUDI', 'NEIGE');

    expect(message.track).toBe(track);
    expect(message.dayOfWeek).toBe('JEUDI');
    expect(message.weather).toBe('NEIGE');
  });
});

describe('WakeUpMessage (détails de rédaction)', () => {
  it('le sujet salue le jour du réveil', () => {
    expect(WakeUpMessage.compose(sampleTrack(), 'LUNDI', 'SOLEIL').subject).toBe('Bon lundi !');
  });

  it('le corps propose le lien d’écoute quand il est connu', () => {
    const message = WakeUpMessage.compose(sampleTrack(), 'MARDI', 'PLUIE');

    expect(message.body).toContain('https://example.org/here-comes-the-sun');
  });

  it('le corps ne propose pas d’écoute sans lien', () => {
    const track = Track.create({ title: 'Clair de lune', artist: 'Debussy', source: 'local' });
    const message = WakeUpMessage.compose(track, 'MARDI', 'PLUIE');

    expect(message.body).not.toMatch(/écouter/i);
    expect(message.body).toContain('« Clair de lune » de Debussy');
  });
});
