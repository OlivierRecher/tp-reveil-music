import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { describeFormFields } from '../src/formView.ts';

// Vérifications statiques de CA-WEB-08. La navigation clavier et l'annonce `aria-live` relèvent du
// rendu DOM (main.ts) : elles sont vérifiées en revue et par Lighthouse en démonstration.

const INDEX_HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const STYLE_CSS = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

/** Variables `--nom: #rrggbb` déclarées dans le bloc `:root` de style.css. */
function cssColorVariables(css: string): ReadonlyMap<string, string> {
  const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  const variables = new Map<string, string>();
  for (const match of rootBlock.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) variables.set(name, value);
  }
  return variables;
}

/** Luminance relative WCAG 2.x d'une couleur #rrggbb. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

// Paires texte/fond réellement utilisées par style.css (premier plan, arrière-plan).
const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['text', 'bg'], // corps de page, champs de saisie
  ['text', 'surface'], // titres du rapport, libellés du formulaire
  ['muted', 'surface'], // contenu du rapport
  ['accent', 'surface'], // lien « Écouter le morceau »
  ['accent', 'bg'],
  ['button-text', 'button-bg'],
  ['error-text', 'error-bg'],
  ['badge-text', 'badge-bg'],
];

describe('accessibilité de base', () => {
  it('[CA-WEB-08] la page déclare sa langue (fr) pour les lecteurs d’écran', () => {
    expect(INDEX_HTML).toMatch(/<html[^>]*\slang="fr"/);
  });

  it('[CA-WEB-08] chaque champ du formulaire a un libellé non vide', () => {
    for (const field of describeFormFields()) expect(field.label.trim()).not.toBe('');
  });

  it('[CA-WEB-08] le calcul de contraste suit WCAG (noir sur blanc = 21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it.each(TEXT_PAIRS)(
    '[CA-WEB-08] contraste AA (≥ 4,5:1) du texte --%s sur --%s',
    (foreground, background) => {
      const colors = cssColorVariables(STYLE_CSS);
      const fg = colors.get(foreground);
      const bg = colors.get(background);
      expect(fg, `--${foreground} absente de :root`).toBeDefined();
      expect(bg, `--${background} absente de :root`).toBeDefined();
      expect(contrastRatio(fg ?? '', bg ?? '')).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('[CA-WEB-08] le focus clavier reste visible (outline sur :focus-visible)', () => {
    expect(STYLE_CSS).toMatch(/:focus-visible\s*\{[^}]*outline:\s*\d+px solid/);
  });
});
