import type { WakeUpReportView } from '../../src/wakeUpApi.ts';

/** Rapport nominal tel que l'API le renvoie (contrat de `POST /api/wake-ups`, 200). */
export const NOMINAL_REPORT: WakeUpReportView = {
  userId: 'alice',
  dayOfWeek: 'LUNDI',
  weather: 'SOLEIL',
  track: {
    title: 'Here Comes the Sun',
    artist: 'The Beatles',
    link: 'https://music.apple.com/fr/album/here-comes-the-sun/1441164426?i=1441164430',
    source: 'itunes',
  },
  trackSource: 'itunes',
  deliveredVia: 'EMAIL',
  attempts: [{ channel: 'EMAIL', success: true }],
  degraded: false,
};

/** Rapport en mode dégradé : morceau local sans lien, canal préféré en échec, bascule sur EMAIL. */
export const DEGRADED_REPORT: WakeUpReportView = {
  userId: 'bob',
  dayOfWeek: 'DIMANCHE',
  weather: 'PLUIE',
  track: { title: 'Riders on the Storm', artist: 'The Doors', source: 'local' },
  trackSource: 'local',
  deliveredVia: 'EMAIL',
  attempts: [
    { channel: 'SMS', success: false, error: 'passerelle SMS indisponible' },
    { channel: 'EMAIL', success: true },
  ],
  degraded: true,
};
