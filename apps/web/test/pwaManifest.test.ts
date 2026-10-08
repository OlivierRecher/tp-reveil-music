import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pwaManifest, workboxOptions } from '../src/pwaManifest.ts';

const PUBLIC_DIR = new URL('../public/', import.meta.url);

/** Dimensions réelles d'un PNG, lues dans l'en-tête IHDR (signature 8 octets, longueur, type, puis largeur et hauteur). */
function pngSize(file: URL): { readonly width: number; readonly height: number } {
  const bytes = readFileSync(file);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function iconsOfSize(size: number): ReadonlyArray<(typeof pwaManifest.icons)[number]> {
  return pwaManifest.icons.filter((icon) => icon.sizes === `${String(size)}x${String(size)}`);
}

describe('installabilité de la PWA', () => {
  it('[CA-WEB-07] le manifest porte un nom, un nom court et l’affichage standalone', () => {
    expect(pwaManifest.name.trim()).not.toBe('');
    expect(pwaManifest.short_name.trim()).not.toBe('');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.start_url).toBe('/');
  });

  it('[CA-WEB-07] le manifest déclare des icônes PNG 192 et 512 px', () => {
    expect(iconsOfSize(192).length).toBeGreaterThan(0);
    expect(iconsOfSize(512).length).toBeGreaterThan(0);
    for (const icon of pwaManifest.icons) expect(icon.type).toBe('image/png');
  });

  it('[CA-WEB-07] une icône 512 px est utilisable telle quelle (any) et une autre en maskable', () => {
    const purposes = iconsOfSize(512).map((icon) => icon.purpose ?? 'any');
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
  });

  it('[CA-WEB-07] chaque icône référencée existe dans public/ avec les dimensions déclarées', () => {
    for (const icon of pwaManifest.icons) {
      const { width, height } = pngSize(new URL(icon.src, PUBLIC_DIR));
      expect(`${String(width)}x${String(height)}`).toBe(icon.sizes);
    }
  });

  it('[CA-WEB-07] le service worker précache la coquille (HTML, JS, CSS) et sert index.html hors ligne', () => {
    const patterns = workboxOptions.globPatterns.join(' ');
    for (const extension of ['html', 'js', 'css']) expect(patterns).toContain(extension);
    expect(workboxOptions.navigateFallback).toBe('index.html');
  });

  it('[CA-WEB-07] les appels /api ne sont jamais servis par la coquille hors ligne', () => {
    const denied = (path: string): boolean =>
      workboxOptions.navigateFallbackDenylist.some((pattern) => pattern.test(path));
    expect(denied('/api/wake-ups')).toBe(true);
    expect(denied('/')).toBe(false);
    expect(denied('/index.html')).toBe(false);
  });
});
