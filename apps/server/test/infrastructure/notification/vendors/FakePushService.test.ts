import { describe, expect, it } from 'vitest';
import { FakePushService } from '../../../../src/infrastructure/notification/vendors/FakePushService.ts';
import type { PushPayload } from '../../../../src/infrastructure/notification/PushService.ts';
import { MemoryNotificationLog } from '../doubles/MemoryNotificationLog.ts';

const DEVICE_TOKEN = 'push-token-alice';
const PAYLOAD: PushPayload = {
  title: 'Bon lundi !',
  body: 'Réveil en musique avec « Walking on Sunshine »',
};

/** Appelle `push` et capture ce que reçoit le callback, ainsi que la valeur de retour. */
function pushAndCapture(
  service: FakePushService,
): Promise<{ readonly returned: unknown; readonly error: Error | null }> {
  return new Promise((resolve) => {
    // Vue « non typée » du retour, pour vérifier que `push` ne renvoie réellement rien.
    const push: (...args: Parameters<FakePushService['push']>) => unknown =
      service.push.bind(service);
    let returned: unknown = 'pas encore retourné';
    returned = push(DEVICE_TOKEN, PAYLOAD, (error) => {
      // Le callback peut être appelé avant ou après le retour de `push` : on diffère la lecture.
      queueMicrotask(() => {
        resolve({ returned, error });
      });
    });
  });
}

describe('FakePushService', () => {
  it('[CA-NOT-01] push(deviceToken, payload, callback) est en style callback et ne renvoie rien', async () => {
    const service = new FakePushService({ notificationLog: new MemoryNotificationLog() });

    expect(service.push.bind(service)).toHaveLength(3);
    const { returned, error } = await pushAndCapture(service);

    expect(returned).toBeUndefined();
    expect(error).toBeNull();
  });

  it('[CA-NOT-01] en panne, appelle callback(erreur) sans lever', async () => {
    const service = new FakePushService({
      notificationLog: new MemoryNotificationLog(),
      failing: true,
    });

    const { returned, error } = await pushAndCapture(service);

    expect(returned).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
  });

  it("[CA-NOT-02] écrit l'envoi (jeton, titre, corps) dans le journal, sans envoi réel", async () => {
    const notificationLog = new MemoryNotificationLog();
    const service = new FakePushService({ notificationLog });

    await pushAndCapture(service);

    expect(notificationLog.entries).toHaveLength(1);
    const entry = notificationLog.entries[0] ?? '';
    expect(entry).toContain(DEVICE_TOKEN);
    expect(entry).toContain(PAYLOAD.title);
    expect(entry).toContain(PAYLOAD.body);
  });
});
