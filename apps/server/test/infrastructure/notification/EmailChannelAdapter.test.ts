import { describe, expect, it } from 'vitest';
import type { NotificationChannel } from '@reveil/core';
import { EmailChannelAdapter } from '../../../src/infrastructure/notification/EmailChannelAdapter.ts';
import { NotificationChannelError } from '../../../src/infrastructure/notification/NotificationChannelError.ts';
import { FakeEmailClient } from '../../../src/infrastructure/notification/vendors/FakeEmailClient.ts';
import { captureRejection } from './doubles/captureRejection.ts';
import { HTML_UNSAFE_MESSAGE, MESSAGE, recipient } from './doubles/fixtures.ts';
import { MemoryNotificationLog } from './doubles/MemoryNotificationLog.ts';

const ADDRESS = 'alice@example.org';

function setup(failing = false) {
  const notificationLog = new MemoryNotificationLog();
  const emailClient = new FakeEmailClient({ notificationLog, failing });
  const channel: NotificationChannel = new EmailChannelAdapter({ emailClient });
  return { channel, notificationLog };
}

describe('EmailChannelAdapter', () => {
  it('[CA-NOT-03] est un NotificationChannel de type EMAIL qui transmet destinataire, objet et corps au client e-mail', async () => {
    const { channel, notificationLog } = setup();

    expect(channel.type).toBe('EMAIL');
    await expect(channel.send(recipient(ADDRESS), MESSAGE)).resolves.toBeUndefined();

    expect(notificationLog.entries).toHaveLength(1);
    const entry = notificationLog.entries[0] ?? '';
    expect(entry).toContain(ADDRESS);
    expect(entry).toContain(MESSAGE.subject);
    expect(entry).toContain('Walking on Sunshine');
    expect(entry).toContain('Katrina and the Waves');
  });

  it('[CA-NOT-03] échappe le corps du message avant de le placer dans le HTML', async () => {
    const { channel, notificationLog } = setup();

    await channel.send(recipient(ADDRESS), HTML_UNSAFE_MESSAGE);

    const entry = notificationLog.text();
    expect(entry).toContain('Rock &amp; Roll &lt;Live&gt;');
    expect(entry).not.toContain('<Live>');
  });

  it('[CA-NOT-04] transforme le rejet du client e-mail en NotificationChannelError (canal EMAIL)', async () => {
    const { channel } = setup(true);

    const error = await captureRejection(channel.send(recipient(ADDRESS), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
    expect((error as NotificationChannelError).channel).toBe('EMAIL');
    expect((error as NotificationChannelError).cause).toBeInstanceOf(Error);
  });

  it("[CA-NOT-04] rejette avec NotificationChannelError sans appeler le client quand l'adresse est absente", async () => {
    const { channel, notificationLog } = setup();

    const error = await captureRejection(channel.send(recipient('   '), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
    expect((error as NotificationChannelError).channel).toBe('EMAIL');
    expect(notificationLog.entries).toHaveLength(0);
  });
});
