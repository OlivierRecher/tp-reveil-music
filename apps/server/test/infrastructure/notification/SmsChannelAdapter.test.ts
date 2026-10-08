import { describe, expect, it } from 'vitest';
import type { NotificationChannel } from '@reveil/core';
import { NotificationChannelError } from '../../../src/infrastructure/notification/NotificationChannelError.ts';
import { SmsChannelAdapter } from '../../../src/infrastructure/notification/SmsChannelAdapter.ts';
import { FakeSmsGateway } from '../../../src/infrastructure/notification/vendors/FakeSmsGateway.ts';
import { captureRejection } from './doubles/captureRejection.ts';
import { MESSAGE, recipient } from './doubles/fixtures.ts';
import { MemoryNotificationLog } from './doubles/MemoryNotificationLog.ts';

const PHONE = '+33600000000';

function setup(failing = false) {
  const notificationLog = new MemoryNotificationLog();
  const smsGateway = new FakeSmsGateway({ notificationLog, failing });
  const channel: NotificationChannel = new SmsChannelAdapter({ smsGateway });
  return { channel, notificationLog };
}

describe('SmsChannelAdapter', () => {
  it('[CA-NOT-03] est un NotificationChannel de type SMS qui transmet le numéro et le corps à la passerelle', async () => {
    const { channel, notificationLog } = setup();

    expect(channel.type).toBe('SMS');
    await expect(channel.send(recipient(PHONE), MESSAGE)).resolves.toBeUndefined();

    expect(notificationLog.entries).toHaveLength(1);
    const entry = notificationLog.entries[0] ?? '';
    expect(entry).toContain(PHONE);
    // Le corps se suffit à lui-même (il reprend l'objet) : c'est lui que porte le SMS.
    expect(entry).toContain(MESSAGE.body);
  });

  it('[CA-NOT-04] transforme le statut REJECTED de la passerelle en NotificationChannelError (canal SMS)', async () => {
    const { channel } = setup(true);

    const error = await captureRejection(channel.send(recipient(PHONE), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
    expect((error as NotificationChannelError).channel).toBe('SMS');
  });

  it('[CA-NOT-04] rejette avec NotificationChannelError sans appeler la passerelle quand le numéro est absent', async () => {
    const { channel, notificationLog } = setup();

    const error = await captureRejection(channel.send(recipient(''), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
    expect((error as NotificationChannelError).channel).toBe('SMS');
    expect(notificationLog.entries).toHaveLength(0);
  });
});
