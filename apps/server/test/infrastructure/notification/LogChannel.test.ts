import { describe, expect, it } from 'vitest';
import type { NotificationChannel } from '@reveil/core';
import { LogChannel } from '../../../src/infrastructure/notification/LogChannel.ts';
import { MESSAGE, recipient, USER_ID } from './doubles/fixtures.ts';
import { MemoryNotificationLog } from './doubles/MemoryNotificationLog.ts';
import { RecordingLogger } from '../../doubles/RecordingLogger.ts';
import { ThrowingNotificationLog } from './doubles/ThrowingNotificationLog.ts';

describe('LogChannel', () => {
  it("[CA-NOT-03] est un NotificationChannel de type LOG qui écrit l'utilisateur, l'objet et le corps dans le journal", async () => {
    const notificationLog = new MemoryNotificationLog();
    const channel: NotificationChannel = new LogChannel({
      notificationLog,
      logger: new RecordingLogger(),
    });

    expect(channel.type).toBe('LOG');
    await expect(channel.send(recipient(USER_ID.value), MESSAGE)).resolves.toBeUndefined();

    expect(notificationLog.entries).toHaveLength(1);
    const entry = notificationLog.entries[0] ?? '';
    expect(entry).toContain(USER_ID.value);
    expect(entry).toContain(MESSAGE.subject);
    expect(entry).toContain(MESSAGE.body);
  });

  it('[CA-NOT-04] canal de dernier recours : ne rejette jamais, même sans coordonnée', async () => {
    const notificationLog = new MemoryNotificationLog();
    const channel = new LogChannel({ notificationLog, logger: new RecordingLogger() });

    await expect(channel.send(recipient(''), MESSAGE)).resolves.toBeUndefined();
    expect(notificationLog.text()).toContain(MESSAGE.body);
  });

  it("[CA-NOT-04] ne rejette pas quand le journal des notifications lève, et signale l'incident via logger.error", async () => {
    const logger = new RecordingLogger();
    const channel = new LogChannel({ notificationLog: new ThrowingNotificationLog(), logger });

    await expect(channel.send(recipient(USER_ID.value), MESSAGE)).resolves.toBeUndefined();

    const errors = logger.at('error');
    expect(errors).toHaveLength(1);
    // Jamais de silence : le message de réveil reste lisible dans le journal applicatif.
    expect(JSON.stringify(errors[0])).toContain(MESSAGE.body);
  });
});
