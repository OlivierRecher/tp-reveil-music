import { describe, expect, it } from 'vitest';
import { FakeSmsGateway } from '../../../../src/infrastructure/notification/vendors/FakeSmsGateway.ts';
import { MemoryNotificationLog } from '../doubles/MemoryNotificationLog.ts';

const PHONE = '+33600000000';
const TEXT = 'Bon lundi ! Réveil en musique avec « Walking on Sunshine »';

describe('FakeSmsGateway', () => {
  it('[CA-NOT-01] send(phoneNumber, text) prend deux arguments positionnels et renvoie un statut QUEUED', async () => {
    const gateway = new FakeSmsGateway({ notificationLog: new MemoryNotificationLog() });

    expect(gateway.send.bind(gateway)).toHaveLength(2);
    const result = await gateway.send(PHONE, TEXT);

    expect(result).toEqual({ status: 'QUEUED' });
  });

  it("[CA-NOT-01] en panne, résout { status: 'REJECTED' } sans lever (style API à statut)", async () => {
    const gateway = new FakeSmsGateway({
      notificationLog: new MemoryNotificationLog(),
      failing: true,
    });

    const result = await gateway.send(PHONE, TEXT);

    expect(result).toEqual({ status: 'REJECTED' });
  });

  it("[CA-NOT-02] écrit l'envoi (numéro et texte) dans le journal, sans envoi réel", async () => {
    const notificationLog = new MemoryNotificationLog();
    const gateway = new FakeSmsGateway({ notificationLog });

    await gateway.send(PHONE, TEXT);

    expect(notificationLog.entries).toHaveLength(1);
    const entry = notificationLog.entries[0] ?? '';
    expect(entry).toContain(PHONE);
    expect(entry).toContain(TEXT);
  });
});
