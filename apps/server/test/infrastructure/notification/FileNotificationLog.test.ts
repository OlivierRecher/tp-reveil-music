import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileNotificationLog } from '../../../src/infrastructure/notification/FileNotificationLog.ts';
import type { NotificationLog } from '../../../src/infrastructure/notification/NotificationLog.ts';

const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

describe('FileNotificationLog', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'reveil-notifications-'));
    // La console est observée mais rendue muette pendant les tests.
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  it('[CA-NOT-02] ajoute une ligne horodatée par envoi au fichier, en créant le dossier si besoin', () => {
    const notificationLogFile = join(directory, 'logs', 'nested', 'notifications.log');
    const log: NotificationLog = new FileNotificationLog({ notificationLogFile });

    log.write('[EMAIL] to=alice@example.org Bon lundi !');
    log.write('[SMS] to=+33600000000 Bon mardi !');

    const lines = readFileSync(notificationLogFile, 'utf8')
      .split('\n')
      .filter((l) => l !== '');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('[EMAIL] to=alice@example.org Bon lundi !');
    expect(lines[0]).toMatch(ISO_TIMESTAMP);
    expect(lines[1]).toContain('[SMS] to=+33600000000 Bon mardi !');
    expect(lines[1]).toMatch(ISO_TIMESTAMP);
  });

  it('[CA-NOT-02] écrit aussi chaque envoi en console', () => {
    const log = new FileNotificationLog({
      notificationLogFile: join(directory, 'notifications.log'),
    });

    log.write('[PUSH] to=push-token-alice Bon jeudi !');

    const printed = vi.mocked(console.log).mock.calls.flat().map(String).join('\n');
    expect(printed).toContain('[PUSH] to=push-token-alice Bon jeudi !');
  });

  it("[CA-NOT-02] ne lève jamais : une erreur d'écriture du fichier est signalée par console.error", () => {
    // Le chemin désigne un dossier existant : l'ajout dans un « fichier » échoue (EISDIR).
    const log = new FileNotificationLog({ notificationLogFile: directory });

    expect(() => {
      log.write('[LOG] alice Bon vendredi !');
    }).not.toThrow();
    expect(vi.mocked(console.error)).toHaveBeenCalled();
  });
});
