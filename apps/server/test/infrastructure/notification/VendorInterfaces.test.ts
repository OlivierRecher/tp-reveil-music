import { describe, expect, it } from 'vitest';
import type { NotificationChannel } from '@reveil/core';
import { EmailChannelAdapter } from '../../../src/infrastructure/notification/EmailChannelAdapter.ts';
import { NotificationChannelError } from '../../../src/infrastructure/notification/NotificationChannelError.ts';
import { PushChannelAdapter } from '../../../src/infrastructure/notification/PushChannelAdapter.ts';
import { SmsChannelAdapter } from '../../../src/infrastructure/notification/SmsChannelAdapter.ts';
import { captureRejection } from './doubles/captureRejection.ts';
import { MESSAGE, recipient } from './doubles/fixtures.ts';
import { RecordingEmailClient } from './doubles/RecordingEmailClient.ts';
import { RecordingPushService } from './doubles/RecordingPushService.ts';
import { RecordingSmsGateway } from './doubles/RecordingSmsGateway.ts';

// CA-NOT-06 : chaque adaptateur dépend d'une interface du fournisseur, pas d'un mock concret. Les
// fournisseurs ci-dessous sont des doublures écrites à la main, sans lien avec `vendors/` : remplacer
// un mock par un vrai fournisseur ne demande aucune modification de l'adaptateur. L'interdiction
// d'importer `vendors/` depuis un adaptateur est vérifiée par `npm run arch:check`.

describe('Adaptateurs de canal et interfaces des fournisseurs', () => {
  it("[CA-NOT-06] EmailChannelAdapter envoie via toute implémentation d'EmailClient", async () => {
    const emailClient = new RecordingEmailClient();
    const channel: NotificationChannel = new EmailChannelAdapter({ emailClient });

    await channel.send(recipient('alice@example.org'), MESSAGE);

    expect(emailClient.sent).toHaveLength(1);
    expect(emailClient.sent[0]?.to).toBe('alice@example.org');
    expect(emailClient.sent[0]?.subject).toBe(MESSAGE.subject);
  });

  it("[CA-NOT-06] EmailChannelAdapter traduit le rejet de toute implémentation d'EmailClient", async () => {
    const channel = new EmailChannelAdapter({
      emailClient: new RecordingEmailClient(new Error('SMTP indisponible')),
    });

    const error = await captureRejection(channel.send(recipient('alice@example.org'), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
  });

  it('[CA-NOT-06] SmsChannelAdapter envoie via toute implémentation de SmsGateway', async () => {
    const smsGateway = new RecordingSmsGateway();
    const channel: NotificationChannel = new SmsChannelAdapter({ smsGateway });

    await channel.send(recipient('+33600000000'), MESSAGE);

    expect(smsGateway.sent).toEqual([{ phoneNumber: '+33600000000', text: MESSAGE.body }]);
  });

  it('[CA-NOT-06] SmsChannelAdapter traduit le statut REJECTED de toute implémentation de SmsGateway', async () => {
    const channel = new SmsChannelAdapter({ smsGateway: new RecordingSmsGateway('REJECTED') });

    const error = await captureRejection(channel.send(recipient('+33600000000'), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
  });

  it('[CA-NOT-06] PushChannelAdapter envoie via toute implémentation de PushService', async () => {
    const pushService = new RecordingPushService();
    const channel: NotificationChannel = new PushChannelAdapter({ pushService });

    await channel.send(recipient('push-token-alice'), MESSAGE);

    expect(pushService.sent).toEqual([
      {
        deviceToken: 'push-token-alice',
        payload: { title: MESSAGE.subject, body: MESSAGE.body },
      },
    ]);
  });

  it("[CA-NOT-06] PushChannelAdapter traduit l'erreur de callback de toute implémentation de PushService", async () => {
    const channel = new PushChannelAdapter({
      pushService: new RecordingPushService(new Error('APNs indisponible')),
    });

    const error = await captureRejection(channel.send(recipient('push-token-alice'), MESSAGE));

    expect(error).toBeInstanceOf(NotificationChannelError);
  });
});
