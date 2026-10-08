import { describe, expect, it } from 'vitest';
import { NotificationDispatcher, TrackQuery, UserPreferences } from '@reveil/core';
import type { ChannelType, NotificationChannel, Recipient, WakeUpMessage } from '@reveil/core';
import { LogChannel } from '../../../src/infrastructure/notification/LogChannel.ts';
import { NotificationChannelError } from '../../../src/infrastructure/notification/NotificationChannelError.ts';
import { MESSAGE, USER_ID } from './doubles/fixtures.ts';
import { MemoryNotificationLog } from './doubles/MemoryNotificationLog.ts';
import { RecordingLogger } from '../../doubles/RecordingLogger.ts';

// CA-NOT-05 : un nouveau canal (ici WhatsApp) s'ajoute côté infrastructure uniquement. Le fournisseur
// et son adaptateur sont écrits dans ce test ; le noyau (@reveil/core) est utilisé tel quel.

/** Faux client WhatsApp avec encore une autre interface : synchrone, résultat booléen. */
class FakeWhatsAppClient {
  readonly delivered: { readonly phone: string; readonly content: string }[] = [];
  readonly #online: boolean;

  constructor(online: boolean) {
    this.#online = online;
  }

  dispatchMessage(phone: string, content: string): { readonly ok: boolean } {
    if (!this.#online) {
      return { ok: false };
    }
    this.delivered.push({ phone, content });
    return { ok: true };
  }
}

/**
 * Adaptateur WhatsApp écrit hors du noyau. Faute de type `WHATSAPP` dans `CHANNEL_TYPES` (seule
 * modification du core admise par CA-NOT-05), il réutilise le type existant `SMS`.
 */
class WhatsAppChannelAdapter implements NotificationChannel {
  readonly type: ChannelType = 'SMS';
  readonly #client: FakeWhatsAppClient;

  constructor(client: FakeWhatsAppClient) {
    this.#client = client;
  }

  send(recipient: Recipient, message: WakeUpMessage): Promise<void> {
    const { ok } = this.#client.dispatchMessage(recipient.address, message.body);
    return ok
      ? Promise.resolve()
      : Promise.reject(new NotificationChannelError(this.type, 'WhatsApp a refusé le message'));
  }
}

const PHONE = '+33611111111';

function setup(online: boolean) {
  const whatsAppClient = new FakeWhatsAppClient(online);
  const notificationLog = new MemoryNotificationLog();
  const logger = new RecordingLogger();
  const dispatcher = new NotificationDispatcher({
    notificationChannels: [new WhatsAppChannelAdapter(whatsAppClient)],
    lastResortChannel: new LogChannel({ notificationLog, logger }),
    logger,
  });
  const preferences = UserPreferences.create({
    userId: USER_ID,
    tracksByWeather: {},
    fallbackTrack: TrackQuery.create({ title: 'Lovely Day', artist: 'Bill Withers' }),
    preferredChannel: 'SMS',
    contacts: { SMS: PHONE },
  });
  return { dispatcher, preferences, whatsAppClient, notificationLog };
}

describe('Ajout d’un canal de notification', () => {
  it('[CA-NOT-05] un adaptateur WhatsApp écrit hors du noyau est utilisé par le NotificationDispatcher sans modifier @reveil/core', async () => {
    const { dispatcher, preferences, whatsAppClient, notificationLog } = setup(true);

    const result = await dispatcher.dispatch(preferences, MESSAGE);

    expect(result.deliveredVia).toBe('SMS');
    expect(whatsAppClient.delivered).toEqual([{ phone: PHONE, content: MESSAGE.body }]);
    expect(notificationLog.entries).toHaveLength(0);
  });

  it('[CA-NOT-05] en panne, le nouveau canal bénéficie du même repli vers LogChannel', async () => {
    const { dispatcher, preferences, whatsAppClient, notificationLog } = setup(false);

    const result = await dispatcher.dispatch(preferences, MESSAGE);

    expect(result.deliveredVia).toBe('LOG');
    expect(whatsAppClient.delivered).toHaveLength(0);
    expect(notificationLog.text()).toContain(MESSAGE.body);
  });
});
