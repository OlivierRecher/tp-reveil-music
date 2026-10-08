import { describe, expect, it } from 'vitest';
import type { NotificationChannel } from '@reveil/core';
import { NotificationChannelError } from '../../../src/infrastructure/notification/NotificationChannelError.ts';
import { PushChannelAdapter } from '../../../src/infrastructure/notification/PushChannelAdapter.ts';
import { FakePushService } from '../../../src/infrastructure/notification/vendors/FakePushService.ts';
import { captureRejection } from './doubles/captureRejection.ts';
import { MESSAGE, recipient } from './doubles/fixtures.ts';
import { MemoryNotificationLog } from './doubles/MemoryNotificationLog.ts';

const DEVICE_TOKEN = 'push-token-alice';

function setup(failing = false) {
  const notificationLog = new MemoryNotificationLog();
  const pushService = new FakePushService({ notificationLog, failing });
  const channel: NotificationChannel = new PushChannelAdapter({ pushService });
  return { channel, notificationLog };
}

describe('PushChannelAdapter', () => {
  it('[CA-NOT-03] est un NotificationChannel de type PUSH qui transmet jeton, titre et corps au service push', async () => {
    const { channel, notificationLog } = setup();

    expect(channel.type).toBe('PUSH');
    await expect(channel.send(recipient(DEVICE_TOKEN), MESSAGE)).resolves.toBeUndefined();

    expect(notificationLog.entries).toHaveLength(1);
    const entry = notificationLog.entries[0] ?? '';
    expect(entry).toContain(DEVICE_TOKEN);
    expect(entry).toContain(MESSAGE.subject);
    expect(entry).toContain(MESSAGE.body);
  });

  it('[CA-NOT-04] transforme callback(erreur) en NotificationChannelError (canal PUSH)', async () => {
    const { channel } = setup(true);

    const error = await captureRejection(channel.send(recipient(DEVICE_TOKEN), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
    expect((error as NotificationChannelError).channel).toBe('PUSH');
    expect((error as NotificationChannelError).cause).toBeInstanceOf(Error);
  });

  it('[CA-NOT-04] rejette avec NotificationChannelError sans appeler le service quand le jeton est absent', async () => {
    const { channel, notificationLog } = setup();

    const error = await captureRejection(channel.send(recipient(''), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
    expect((error as NotificationChannelError).channel).toBe('PUSH');
    expect(notificationLog.entries).toHaveLength(0);
  });
});
