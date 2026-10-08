import { describe, expect, it } from 'vitest';
import { toReportViewModel } from '../src/reportView.ts';
import { DEGRADED_REPORT, NOMINAL_REPORT } from './doubles/reports.ts';

describe('modèle de vue du rapport de réveil', () => {
  it('[CA-WEB-03] affiche le titre, l’artiste et le lien du morceau quand il existe', () => {
    const view = toReportViewModel(NOMINAL_REPORT);

    expect(view.title).toBe('Here Comes the Sun');
    expect(view.artist).toBe('The Beatles');
    expect(view.link).toBe(
      'https://music.apple.com/fr/album/here-comes-the-sun/1441164426?i=1441164430',
    );
  });

  it('[CA-WEB-03] n’affiche aucun lien quand le morceau n’en a pas (morceau local)', () => {
    const view = toReportViewModel(DEGRADED_REPORT);

    expect(view.title).toBe('Riders on the Storm');
    expect(view.artist).toBe('The Doors');
    expect(view.link).toBeUndefined();
  });

  it('[CA-WEB-03] affiche le canal effectivement utilisé', () => {
    expect(toReportViewModel(NOMINAL_REPORT).deliveredVia).toContain('EMAIL');
    expect(toReportViewModel({ ...NOMINAL_REPORT, deliveredVia: 'PUSH' }).deliveredVia).toContain(
      'PUSH',
    );
  });

  it('[CA-WEB-03] liste chaque tentative dans l’ordre avec son canal et son succès ou son échec motivé', () => {
    expect(toReportViewModel(DEGRADED_REPORT).attempts).toEqual([
      '✗ SMS : passerelle SMS indisponible',
      '✓ EMAIL',
    ]);
  });

  it('[CA-WEB-03] un échec sans raison fournie reste affiché comme un échec', () => {
    const view = toReportViewModel({
      ...DEGRADED_REPORT,
      attempts: [
        { channel: 'PUSH', success: false },
        { channel: 'LOG', success: true },
      ],
    });

    expect(view.attempts).toEqual(['✗ PUSH', '✓ LOG']);
  });

  it('[CA-WEB-03] affiche aussi un canal inconnu du client (canal ajouté côté serveur)', () => {
    const view = toReportViewModel({
      ...NOMINAL_REPORT,
      deliveredVia: 'WHATSAPP',
      attempts: [
        { channel: 'SMS', success: false, error: 'passerelle SMS indisponible' },
        { channel: 'WHATSAPP', success: true },
      ],
    });

    expect(view.deliveredVia).toContain('WHATSAPP');
    expect(view.attempts).toEqual(['✗ SMS : passerelle SMS indisponible', '✓ WHATSAPP']);
  });

  it('[CA-WEB-04] affiche le badge « mode dégradé » quand le rapport indique degraded: true', () => {
    expect(toReportViewModel(DEGRADED_REPORT).degradedBadge).toBe(true);
  });

  it('[CA-WEB-04] n’affiche pas le badge quand le rapport indique degraded: false', () => {
    expect(toReportViewModel(NOMINAL_REPORT).degradedBadge).toBe(false);
  });

  it('[CA-WEB-04] le badge suit uniquement le champ degraded, pas les échecs de tentatives', () => {
    expect(toReportViewModel({ ...DEGRADED_REPORT, degraded: false }).degradedBadge).toBe(false);
    expect(toReportViewModel({ ...NOMINAL_REPORT, degraded: true }).degradedBadge).toBe(true);
  });
});
