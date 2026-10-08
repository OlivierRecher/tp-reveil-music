import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../../../src/infrastructure/notification/escapeHtml.ts';
import { LogChannel } from '../../../../src/infrastructure/notification/LogChannel.ts';
import type { NotificationLog } from '../../../../src/infrastructure/notification/NotificationLog.ts';
import { NotificationChannelError } from '../../../../src/infrastructure/notification/NotificationChannelError.ts';
import { PushChannelAdapter } from '../../../../src/infrastructure/notification/PushChannelAdapter.ts';
import { SmsChannelAdapter } from '../../../../src/infrastructure/notification/SmsChannelAdapter.ts';
import { FakePushService } from '../../../../src/infrastructure/notification/vendors/FakePushService.ts';
import { FakeSmsGateway } from '../../../../src/infrastructure/notification/vendors/FakeSmsGateway.ts';
import type { SmsResult } from '../../../../src/infrastructure/notification/vendors/FakeSmsGateway.ts';
import { RecordingLogger } from '../../../doubles/RecordingLogger.ts';
import { captureRejection } from '../doubles/captureRejection.ts';
import { MESSAGE, recipient } from '../doubles/fixtures.ts';
import { MemoryNotificationLog } from '../doubles/MemoryNotificationLog.ts';
import { ThrowingNotificationLog } from '../doubles/ThrowingNotificationLog.ts';

/** Passerelle injoignable : la promesse est rejetée au lieu de renvoyer un statut. */
class UnreachableSmsGateway extends FakeSmsGateway {
  override send(): Promise<SmsResult> {
    return Promise.reject(new Error('connexion refusée'));
  }
}

/** Journal qui lève une valeur qui n'est pas une `Error`. */
class NonErrorThrowingLog implements NotificationLog {
  write(): void {
    const reason: unknown = 'disque plein';
    throw reason;
  }
}

describe('escapeHtml', () => {
  it('échappe les cinq caractères spéciaux HTML, sans double échappement', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });
});

describe('SmsChannelAdapter (cas limites)', () => {
  it('transforme le rejet de la passerelle en NotificationChannelError avec la cause', async () => {
    const channel = new SmsChannelAdapter({
      smsGateway: new UnreachableSmsGateway({ notificationLog: new MemoryNotificationLog() }),
    });

    const error = await captureRejection(channel.send(recipient('+33600000000'), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
    expect((error as NotificationChannelError).cause).toBeInstanceOf(Error);
  });
});

describe('PushChannelAdapter (cas limites)', () => {
  it('transforme une exception synchrone du service en NotificationChannelError', async () => {
    const channel = new PushChannelAdapter({
      pushService: new FakePushService({ notificationLog: new ThrowingNotificationLog() }),
    });

    const error = await captureRejection(channel.send(recipient('push-token'), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
    expect((error as NotificationChannelError).channel).toBe('PUSH');
  });
});

describe('LogChannel (cas limites)', () => {
  it("journalise une erreur qui n'est pas une Error sans rejeter", async () => {
    const logger = new RecordingLogger();
    const channel = new LogChannel({ notificationLog: new NonErrorThrowingLog(), logger });

    await expect(channel.send(recipient(''), MESSAGE)).resolves.toBeUndefined();

    const errors = logger.at('error');
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors[0])).toContain('disque plein');
  });
});
