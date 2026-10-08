import { describe, expect, it } from 'vitest';
import { toReportViewModel } from '../src/reportView.ts';
import { NOMINAL_REPORT } from './doubles/reports.ts';

function viewWithLink(link: string): ReturnType<typeof toReportViewModel> {
  return toReportViewModel({ ...NOMINAL_REPORT, track: { ...NOMINAL_REPORT.track, link } });
}

describe('lien du morceau dans le modèle de vue', () => {
  it('conserve un lien http', () => {
    expect(viewWithLink('http://example.org/morceau').link).toBe('http://example.org/morceau');
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['URL relative', '/morceau'],
    ['texte libre', 'pas une URL'],
  ])('écarte un lien non http(s) : %s', (_case, link) => {
    const view = viewWithLink(link);

    expect(view.link).toBeUndefined();
    expect(view).not.toHaveProperty('link');
  });
});
