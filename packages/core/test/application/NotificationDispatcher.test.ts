import { describe, expect, it } from 'vitest';
import {
  NotificationDispatcher,
  Track,
  TrackQuery,
  UserId,
  UserPreferences,
  WakeUpMessage,
} from '../../src/index.ts';
import type { ChannelType, NotificationChannel } from '../../src/index.ts';
import { RecordingChannel } from '../doubles/RecordingChannel.ts';
import { RecordingLogger } from '../doubles/RecordingLogger.ts';

// Doublures écrites à la main, instanciées directement : ni conteneur, ni réseau (CA-APP-02).

const USER_ID = UserId.parse('alice');

const CONTACTS = {
  EMAIL: 'alice@example.org',
  SMS: '+33600000000',
  PUSH: 'push-token-alice',
} as const;

const MESSAGE = WakeUpMessage.compose(
  Track.create({ title: 'Walking on Sunshine', artist: 'Katrina and the Waves', source: 'itunes' }),
  'LUNDI',
  'SOLEIL',
);

function preferences(
  preferredChannel: ChannelType,
  contacts: Partial<Readonly<Record<ChannelType, string>>>,
): UserPreferences {
  return UserPreferences.create({
    userId: USER_ID,
    tracksByWeather: {},
    fallbackTrack: TrackQuery.create({ title: 'Lovely Day', artist: 'Bill Withers' }),
    preferredChannel,
    contacts,
  });
}

function setup(channels: ReadonlyArray<RecordingChannel>) {
  const logger = new RecordingLogger();
  const lastResort = new RecordingChannel('LOG');
  const notificationChannels: ReadonlyArray<NotificationChannel> = channels;
  const dispatcher = new NotificationDispatcher({
    notificationChannels,
    lastResortChannel: lastResort,
    logger,
  });
  return { dispatcher, lastResort, logger };
}

const failure = (channel: string): Error => new Error(`${channel} hors service`);

describe('NotificationDispatcher', () => {
  it('[CA-APP-01] livre une seule fois sur le canal préféré quand il fonctionne', async () => {
    const email = new RecordingChannel('EMAIL');
    const sms = new RecordingChannel('SMS');
    const { dispatcher, lastResort } = setup([email, sms]);

    const result = await dispatcher.dispatch(preferences('EMAIL', CONTACTS), MESSAGE);

    expect(result.deliveredVia).toBe('EMAIL');
    expect(result.attempts).toEqual([{ channel: 'EMAIL', success: true }]);
    expect(email.calls).toHaveLength(1);
    expect(email.calls[0]?.message).toBe(MESSAGE);
    expect(email.calls[0]?.recipient.address).toBe(CONTACTS.EMAIL);
    expect(email.calls[0]?.recipient.userId.equals(USER_ID)).toBe(true);
    expect(sms.calls).toHaveLength(0);
    expect(lastResort.calls).toHaveLength(0);
  });

  it("[CA-APP-01] essaie d'abord le canal préféré, quel que soit l'ordre d'enregistrement", async () => {
    const email = new RecordingChannel('EMAIL');
    const sms = new RecordingChannel('SMS');
    const push = new RecordingChannel('PUSH');
    const { dispatcher } = setup([email, sms, push]);

    const result = await dispatcher.dispatch(preferences('PUSH', CONTACTS), MESSAGE);

    expect(result.deliveredVia).toBe('PUSH');
    expect(push.calls[0]?.recipient.address).toBe(CONTACTS.PUSH);
    expect(email.calls).toHaveLength(0);
    expect(sms.calls).toHaveLength(0);
  });

  it('[CA-APP-04] bascule sur un autre canal disponible si le canal préféré échoue et liste la tentative échouée', async () => {
    const email = new RecordingChannel('EMAIL', { failWith: failure('EMAIL') });
    const sms = new RecordingChannel('SMS');
    const { dispatcher, lastResort } = setup([email, sms]);

    const result = await dispatcher.dispatch(preferences('EMAIL', CONTACTS), MESSAGE);

    expect(result.deliveredVia).toBe('SMS');
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({ channel: 'EMAIL', success: false });
    expect(result.attempts[0]?.error).toContain('EMAIL hors service');
    expect(result.attempts[1]).toMatchObject({ channel: 'SMS', success: true });
    expect(sms.calls).toHaveLength(1);
    expect(sms.calls[0]?.recipient.address).toBe(CONTACTS.SMS);
    expect(sms.calls[0]?.message).toBe(MESSAGE);
    expect(lastResort.calls).toHaveLength(0);
  });

  it("[CA-APP-04] s'arrête au premier canal qui réussit", async () => {
    const email = new RecordingChannel('EMAIL', { failWith: failure('EMAIL') });
    const sms = new RecordingChannel('SMS');
    const push = new RecordingChannel('PUSH');
    const { dispatcher } = setup([email, sms, push]);

    const result = await dispatcher.dispatch(preferences('EMAIL', CONTACTS), MESSAGE);

    expect(result.deliveredVia).toBe('SMS');
    expect(push.calls).toHaveLength(0);
  });

  it('[CA-APP-05] remet le message au canal de dernier recours quand tous les canaux échouent', async () => {
    const email = new RecordingChannel('EMAIL', { failWith: failure('EMAIL') });
    const sms = new RecordingChannel('SMS', { failWith: failure('SMS') });
    const { dispatcher, lastResort } = setup([email, sms]);

    const result = await dispatcher.dispatch(preferences('EMAIL', CONTACTS), MESSAGE);

    expect(result.deliveredVia).toBe('LOG');
    expect(lastResort.calls).toHaveLength(1);
    expect(lastResort.calls[0]?.message).toBe(MESSAGE);
    // Le journal n'a pas de coordonnée propre : il est adressé à l'identifiant de l'utilisateur.
    expect(lastResort.calls[0]?.recipient.address).toBe(USER_ID.value);
    expect(lastResort.calls[0]?.recipient.userId.equals(USER_ID)).toBe(true);
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0]).toMatchObject({ channel: 'EMAIL', success: false });
    expect(result.attempts[1]).toMatchObject({ channel: 'SMS', success: false });
    expect(result.attempts[2]).toMatchObject({ channel: 'LOG', success: true });
  });

  it('[CA-APP-05] ne lève pas quand tous les canaux échouent', async () => {
    const email = new RecordingChannel('EMAIL', { failWith: failure('EMAIL') });
    const sms = new RecordingChannel('SMS', { failWith: failure('SMS') });
    const push = new RecordingChannel('PUSH', { failWith: failure('PUSH') });
    const { dispatcher } = setup([email, sms, push]);

    await expect(dispatcher.dispatch(preferences('SMS', CONTACTS), MESSAGE)).resolves.toMatchObject(
      { deliveredVia: 'LOG' },
    );
  });

  it('[CA-APP-05] ne lève pas si le dernier recours échoue malgré son contrat : tentative en échec, journalisée en error', async () => {
    const email = new RecordingChannel('EMAIL', { failWith: failure('EMAIL') });
    const logger = new RecordingLogger();
    const lastResort = new RecordingChannel('LOG', { failWith: failure('LOG') });
    const notificationChannels: ReadonlyArray<NotificationChannel> = [email];
    const dispatcher = new NotificationDispatcher({
      notificationChannels,
      lastResortChannel: lastResort,
      logger,
    });

    const result = await dispatcher.dispatch(preferences('EMAIL', CONTACTS), MESSAGE);

    expect(lastResort.calls).toHaveLength(1);
    expect(result.deliveredVia).toBe('LOG');
    expect(result.attempts.map((attempt) => attempt.channel)).toEqual(['EMAIL', 'LOG']);
    expect(result.attempts[1]).toMatchObject({ channel: 'LOG', success: false });
    expect(result.attempts[1]?.error).toContain('LOG hors service');
    const errors = logger.at('error').map((entry) => RecordingLogger.text(entry));
    expect(errors.some((text) => text.includes('LOG'))).toBe(true);
  });

  it('[CA-APP-08] journalise un warn pour chaque canal en échec, en nommant le canal', async () => {
    const email = new RecordingChannel('EMAIL', { failWith: failure('EMAIL') });
    const sms = new RecordingChannel('SMS', { failWith: failure('SMS') });
    const { dispatcher, logger } = setup([email, sms]);

    await dispatcher.dispatch(preferences('EMAIL', CONTACTS), MESSAGE);

    const warnings = logger.at('warn').map((entry) => RecordingLogger.text(entry));
    expect(warnings.some((text) => text.includes('EMAIL'))).toBe(true);
    expect(warnings.some((text) => text.includes('SMS'))).toBe(true);
  });

  it('[CA-APP-08] ne journalise aucun warn quand le canal préféré livre le message', async () => {
    const email = new RecordingChannel('EMAIL');
    const { dispatcher, logger } = setup([email]);

    await dispatcher.dispatch(preferences('EMAIL', CONTACTS), MESSAGE);

    expect(logger.at('warn')).toHaveLength(0);
  });

  it("[CA-APP-09] ne tente jamais le canal préféré si l'utilisateur n'en a pas la coordonnée", async () => {
    const email = new RecordingChannel('EMAIL');
    const sms = new RecordingChannel('SMS');
    const { dispatcher } = setup([email, sms]);

    const result = await dispatcher.dispatch(
      preferences('SMS', { EMAIL: CONTACTS.EMAIL }),
      MESSAGE,
    );

    expect(sms.calls).toHaveLength(0);
    expect(result.attempts.map((attempt) => attempt.channel)).not.toContain('SMS');
    expect(result.deliveredVia).toBe('EMAIL');
    expect(email.calls[0]?.recipient.address).toBe(CONTACTS.EMAIL);
  });

  it("[CA-APP-09] ne tente aucun canal de repli dont l'utilisateur n'a pas la coordonnée", async () => {
    const email = new RecordingChannel('EMAIL', { failWith: failure('EMAIL') });
    const sms = new RecordingChannel('SMS');
    const push = new RecordingChannel('PUSH');
    const { dispatcher, lastResort } = setup([email, sms, push]);

    const result = await dispatcher.dispatch(
      preferences('EMAIL', { EMAIL: CONTACTS.EMAIL, PUSH: CONTACTS.PUSH }),
      MESSAGE,
    );

    expect(sms.calls).toHaveLength(0);
    expect(result.deliveredVia).toBe('PUSH');
    expect(result.attempts.map((attempt) => attempt.channel)).toEqual(['EMAIL', 'PUSH']);
    expect(lastResort.calls).toHaveLength(0);
  });

  it("[CA-APP-09] passe directement au dernier recours si l'utilisateur n'a aucune coordonnée", async () => {
    const email = new RecordingChannel('EMAIL');
    const sms = new RecordingChannel('SMS');
    const push = new RecordingChannel('PUSH');
    const { dispatcher, lastResort } = setup([email, sms, push]);

    const result = await dispatcher.dispatch(preferences('EMAIL', {}), MESSAGE);

    expect(email.calls).toHaveLength(0);
    expect(sms.calls).toHaveLength(0);
    expect(push.calls).toHaveLength(0);
    expect(lastResort.calls).toHaveLength(1);
    expect(result.deliveredVia).toBe('LOG');
    expect(result.attempts).toEqual([{ channel: 'LOG', success: true }]);
  });
});
