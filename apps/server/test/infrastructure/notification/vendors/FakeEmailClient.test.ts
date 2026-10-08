import { describe, expect, it } from 'vitest';
import { FakeEmailClient } from '../../../../src/infrastructure/notification/vendors/FakeEmailClient.ts';
import { MemoryNotificationLog } from '../doubles/MemoryNotificationLog.ts';

const ENVELOPE = {
  to: 'alice@example.org',
  subject: 'Bon lundi !',
  html: '<p>Réveil en musique avec « Walking on Sunshine »</p>',
} as const;

describe('FakeEmailClient', () => {
  it('[CA-NOT-01] sendMail prend une enveloppe { to, subject, html } et renvoie une promesse de { messageId }', async () => {
    const client = new FakeEmailClient({ notificationLog: new MemoryNotificationLog() });

    expect(client.sendMail.bind(client)).toHaveLength(1);
    const pending = client.sendMail(ENVELOPE);
    expect(pending).toBeInstanceOf(Promise);
    const receipt = await pending;

    expect(typeof receipt.messageId).toBe('string');
    expect(receipt.messageId.trim()).not.toBe('');
  });

  it('[CA-NOT-01] en panne, rejette la promesse (style SDK à exceptions)', async () => {
    const client = new FakeEmailClient({
      notificationLog: new MemoryNotificationLog(),
      failing: true,
    });

    const error: unknown = await client.sendMail(ENVELOPE).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toBe('Not implemented');
  });

  it("[CA-NOT-02] écrit l'envoi (destinataire, objet, contenu) dans le journal, sans envoi réel", async () => {
    const notificationLog = new MemoryNotificationLog();
    const client = new FakeEmailClient({ notificationLog });

    await client.sendMail(ENVELOPE);

    expect(notificationLog.entries).toHaveLength(1);
    const entry = notificationLog.entries[0] ?? '';
    expect(entry).toContain(ENVELOPE.to);
    expect(entry).toContain(ENVELOPE.subject);
    expect(entry).toContain('Walking on Sunshine');
  });

  it('[CA-NOT-02] attribue un messageId distinct à chaque envoi', async () => {
    const client = new FakeEmailClient({ notificationLog: new MemoryNotificationLog() });

    const first = await client.sendMail(ENVELOPE);
    const second = await client.sendMail(ENVELOPE);

    expect(first.messageId).not.toBe(second.messageId);
  });
});
