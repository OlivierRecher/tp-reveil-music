import { describe, expect, it } from 'vitest';
import {
  LOCAL_TRACK_SOURCE,
  NotificationDispatcher,
  Track,
  TrackQuery,
  TriggerWakeUp,
  UserId,
  UserPreferences,
  WeatherTrackSelectionPolicy,
} from '../../src/index.ts';
import type {
  EmergencyPlaylist,
  Logger,
  MusicCatalog,
  NotificationChannel,
  TrackSelectionPolicy,
  UserPreferencesProvider,
  WakeUpCommand,
  WakeUpReport,
} from '../../src/index.ts';
import { FailingMusicCatalog } from '../doubles/FailingMusicCatalog.ts';
import { FailingPreferences } from '../doubles/FailingPreferences.ts';
import { FixedEmergencyPlaylist } from '../doubles/FixedEmergencyPlaylist.ts';
import { InMemoryPreferences } from '../doubles/InMemoryPreferences.ts';
import { RecordingChannel } from '../doubles/RecordingChannel.ts';
import { RecordingLogger } from '../doubles/RecordingLogger.ts';
import { StubMusicCatalog } from '../doubles/StubMusicCatalog.ts';

// Doublures écrites à la main, instanciées directement : ni conteneur, ni réseau (CA-APP-02).

const ALICE = UserId.parse('alice');
const UNKNOWN = UserId.parse('inconnu');

const SUNNY_QUERY = TrackQuery.create({ title: 'Walking on Sunshine', artist: 'Katrina' });
const RAINY_QUERY = TrackQuery.create({ title: "Singin' in the Rain", artist: 'Gene Kelly' });
const ALICE_FALLBACK_QUERY = TrackQuery.create({ title: 'Lovely Day', artist: 'Bill Withers' });

const CONTACTS = { EMAIL: 'alice@example.org', SMS: '+33600000000' } as const;

const ALICE_PREFERENCES = UserPreferences.create({
  userId: ALICE,
  tracksByWeather: { SOLEIL: SUNNY_QUERY, PLUIE: RAINY_QUERY },
  fallbackTrack: ALICE_FALLBACK_QUERY,
  preferredChannel: 'EMAIL',
  contacts: CONTACTS,
});

const RESOLVED_TRACK = Track.create({
  title: 'Walking on Sunshine',
  artist: 'Katrina and the Waves',
  link: 'https://example.org/walking-on-sunshine',
  source: 'itunes',
});

const EMERGENCY_TRACK = Track.create({
  title: 'Good Day Sunshine',
  artist: 'The Beatles',
  source: LOCAL_TRACK_SOURCE,
});

const SUNNY_MONDAY: WakeUpCommand = { userId: ALICE, dayOfWeek: 'LUNDI', weather: 'SOLEIL' };

const failure = (what: string): Error => new Error(`${what} hors service`);

interface Overrides {
  readonly preferences?: UserPreferencesProvider;
  readonly catalog?: MusicCatalog;
  readonly email?: RecordingChannel;
  readonly sms?: RecordingChannel;
  readonly push?: RecordingChannel;
  readonly lastResort?: RecordingChannel;
}

/** Monte le cas d'usage avec des doublures ; chaque doublure peut être remplacée. */
function setup(overrides: Overrides = {}) {
  const logger = new RecordingLogger();
  const preferences = overrides.preferences ?? new InMemoryPreferences([ALICE_PREFERENCES]);
  const catalog = overrides.catalog ?? new StubMusicCatalog(RESOLVED_TRACK);
  const emergency = new FixedEmergencyPlaylist(EMERGENCY_TRACK);
  const email = overrides.email ?? new RecordingChannel('EMAIL');
  const sms = overrides.sms ?? new RecordingChannel('SMS');
  const push = overrides.push ?? new RecordingChannel('PUSH');
  const lastResort = overrides.lastResort ?? new RecordingChannel('LOG');
  const notificationChannels: ReadonlyArray<NotificationChannel> = [email, sms, push];
  const notificationDispatcher = new NotificationDispatcher({
    notificationChannels,
    lastResortChannel: lastResort,
    logger,
  });
  const useCase = new TriggerWakeUp({
    userPreferencesProvider: preferences,
    musicCatalog: catalog,
    emergencyPlaylist: emergency,
    trackSelectionPolicy: new WeatherTrackSelectionPolicy(),
    notificationDispatcher,
    logger,
  });
  const allChannels = [email, sms, push, lastResort];
  const totalSends = (): number => allChannels.reduce((sum, ch) => sum + ch.calls.length, 0);
  return { useCase, logger, emergency, email, sms, push, lastResort, totalSends };
}

function failingChannel(type: 'EMAIL' | 'SMS' | 'PUSH'): RecordingChannel {
  return new RecordingChannel(type, { failWith: failure(type) });
}

describe('TriggerWakeUp', () => {
  describe('nominal', () => {
    it('[CA-APP-01] envoie exactement une notification, sur le canal préféré, avec le morceau choisi', async () => {
      const { useCase, email, totalSends } = setup();

      await useCase.execute(SUNNY_MONDAY);

      expect(totalSends()).toBe(1);
      expect(email.calls).toHaveLength(1);
      const sent = email.calls[0];
      expect(sent?.recipient.address).toBe(CONTACTS.EMAIL);
      expect(sent?.recipient.userId.equals(ALICE)).toBe(true);
      expect(sent?.message.track).toBe(RESOLVED_TRACK);
      expect(sent?.message.body).toContain(RESOLVED_TRACK.title);
      expect(sent?.message.body).toContain(RESOLVED_TRACK.artist);
      expect(sent?.message.dayOfWeek).toBe('LUNDI');
      expect(sent?.message.weather).toBe('SOLEIL');
    });

    it('[CA-APP-01] demande au catalogue le morceau associé à la météo du jour', async () => {
      const catalog = new StubMusicCatalog(RESOLVED_TRACK);
      const { useCase } = setup({ catalog });

      await useCase.execute({ userId: ALICE, dayOfWeek: 'MARDI', weather: 'PLUIE' });

      expect(catalog.queries.map((query) => query.cacheKey)).toEqual([RAINY_QUERY.cacheKey]);
    });

    it("[CA-APP-01] demande le morceau de secours de l'utilisateur quand la météo n'est pas couverte", async () => {
      const catalog = new StubMusicCatalog(RESOLVED_TRACK);
      const { useCase, email } = setup({ catalog });

      await useCase.execute({ userId: ALICE, dayOfWeek: 'MERCREDI', weather: 'NEIGE' });

      expect(catalog.queries.map((query) => query.cacheKey)).toEqual([
        ALICE_FALLBACK_QUERY.cacheKey,
      ]);
      expect(email.calls).toHaveLength(1);
    });

    it('[CA-APP-01] renvoie un rapport complet : utilisateur, jour, météo, morceau, source, canal, tentatives', async () => {
      const { useCase } = setup();

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(report.userId).toBe(ALICE.value);
      expect(report.dayOfWeek).toBe('LUNDI');
      expect(report.weather).toBe('SOLEIL');
      expect(report.track).toBe(RESOLVED_TRACK);
      expect(report.trackSource).toBe('itunes');
      expect(report.deliveredVia).toBe('EMAIL');
      expect(report.attempts).toEqual([{ channel: 'EMAIL', success: true }]);
    });

    it('[CA-APP-02] fonctionne avec de simples doublures implémentant les ports, sans réseau ni conteneur', async () => {
      // Typage explicite par les ports : le cas d'usage n'exige rien de plus que ces interfaces.
      const userPreferencesProvider: UserPreferencesProvider = new InMemoryPreferences([
        ALICE_PREFERENCES,
      ]);
      const musicCatalog: MusicCatalog = new StubMusicCatalog(RESOLVED_TRACK);
      const emergencyPlaylist: EmergencyPlaylist = new FixedEmergencyPlaylist(EMERGENCY_TRACK);
      const trackSelectionPolicy: TrackSelectionPolicy = new WeatherTrackSelectionPolicy();
      const logger: Logger = new RecordingLogger();
      const email: NotificationChannel = new RecordingChannel('EMAIL');
      const lastResortChannel: NotificationChannel = new RecordingChannel('LOG');
      const useCase = new TriggerWakeUp({
        userPreferencesProvider,
        musicCatalog,
        emergencyPlaylist,
        trackSelectionPolicy,
        notificationDispatcher: new NotificationDispatcher({
          notificationChannels: [email],
          lastResortChannel,
          logger,
        }),
        logger,
      });

      const report: WakeUpReport = await useCase.execute(SUNNY_MONDAY);

      expect(report.deliveredVia).toBe('EMAIL');
      expect(report.track).toBe(RESOLVED_TRACK);
    });

    it('[CA-APP-07] indique degraded: false en fonctionnement nominal', async () => {
      const { useCase } = setup();

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(report.degraded).toBe(false);
    });

    it("[CA-APP-07] indique degraded: false quand le morceau de secours de l'utilisateur est utilisé (météo non couverte)", async () => {
      const { useCase } = setup();

      const report = await useCase.execute({
        userId: ALICE,
        dayOfWeek: 'JEUDI',
        weather: 'NUAGEUX',
      });

      expect(report.degraded).toBe(false);
    });

    it('[CA-APP-08] ne journalise aucun warn en fonctionnement nominal', async () => {
      const { useCase, logger } = setup();

      await useCase.execute(SUNNY_MONDAY);

      expect(logger.at('warn')).toHaveLength(0);
    });
  });

  describe('catalogue musical en panne', () => {
    it('[CA-APP-03] envoie quand même une notification avec un morceau de secours local', async () => {
      const { useCase, email, emergency, totalSends } = setup({
        catalog: new FailingMusicCatalog(failure('Catalogue')),
      });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(emergency.picked).toEqual(['SOLEIL']);
      expect(totalSends()).toBe(1);
      expect(email.calls[0]?.message.track).toBe(EMERGENCY_TRACK);
      expect(email.calls[0]?.message.body).toContain(EMERGENCY_TRACK.title);
      expect(report.track).toBe(EMERGENCY_TRACK);
      expect(report.trackSource).toBe(LOCAL_TRACK_SOURCE);
      expect(report.deliveredVia).toBe('EMAIL');
      expect(report.degraded).toBe(true);
    });

    it('[CA-APP-03] indique degraded: true quand le catalogue a dû se replier sur un morceau local', async () => {
      const localTrack = Track.create({
        title: 'Here Comes the Sun',
        artist: 'The Beatles',
        source: LOCAL_TRACK_SOURCE,
      });
      const { useCase, email } = setup({
        catalog: new StubMusicCatalog(localTrack, { degraded: true }),
      });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(email.calls[0]?.message.track).toBe(localTrack);
      expect(report.trackSource).toBe(LOCAL_TRACK_SOURCE);
      expect(report.degraded).toBe(true);
    });
  });

  describe('signal de repli du catalogue', () => {
    it('[CA-APP-10] un morceau de source locale sans repli signalé est un fonctionnement normal', async () => {
      const localTrack = Track.create({
        title: 'Clair de lune',
        artist: 'Debussy',
        source: LOCAL_TRACK_SOURCE,
      });
      const { useCase, logger } = setup({
        catalog: new StubMusicCatalog(localTrack, { degraded: false }),
      });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(report.track).toBe(localTrack);
      expect(report.degraded).toBe(false);
      expect(logger.at('warn')).toHaveLength(0);
    });

    it('[CA-APP-10] un repli signalé par le catalogue rend le réveil dégradé, quelle que soit la source', async () => {
      const { useCase, logger } = setup({
        catalog: new StubMusicCatalog(RESOLVED_TRACK, { degraded: true }),
      });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(report.track).toBe(RESOLVED_TRACK);
      expect(report.trackSource).toBe('itunes');
      expect(report.degraded).toBe(true);
      expect(logger.at('warn')).toHaveLength(1);
    });
  });

  describe('canaux de notification en panne', () => {
    it('[CA-APP-04] envoie sur un autre canal disponible si le canal préféré échoue et liste la tentative échouée', async () => {
      const { useCase, sms, lastResort } = setup({ email: failingChannel('EMAIL') });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(sms.calls).toHaveLength(1);
      expect(sms.calls[0]?.recipient.address).toBe(CONTACTS.SMS);
      expect(sms.calls[0]?.message.track).toBe(RESOLVED_TRACK);
      expect(lastResort.calls).toHaveLength(0);
      expect(report.deliveredVia).toBe('SMS');
      expect(report.attempts[0]).toMatchObject({ channel: 'EMAIL', success: false });
      expect(report.attempts[0]?.error).toContain('EMAIL hors service');
      expect(report.attempts.at(-1)).toMatchObject({ channel: 'SMS', success: true });
      expect(report.degraded).toBe(true);
    });

    it('[CA-APP-05] remet le message au canal de dernier recours quand tous les canaux échouent, sans lever', async () => {
      const { useCase, lastResort } = setup({
        email: failingChannel('EMAIL'),
        sms: failingChannel('SMS'),
        push: failingChannel('PUSH'),
      });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(lastResort.calls).toHaveLength(1);
      expect(lastResort.calls[0]?.message.track).toBe(RESOLVED_TRACK);
      expect(report.deliveredVia).toBe('LOG');
      expect(report.attempts.filter((attempt) => !attempt.success).map((a) => a.channel)).toEqual([
        'EMAIL',
        'SMS',
      ]);
      expect(report.attempts.at(-1)).toEqual({ channel: 'LOG', success: true });
      expect(report.degraded).toBe(true);
    });

    it('[CA-APP-05] ne lève pas même si préférences, catalogue et canaux sont tous en panne', async () => {
      const { useCase, lastResort } = setup({
        preferences: new FailingPreferences(failure('Préférences')),
        catalog: new FailingMusicCatalog(failure('Catalogue')),
        email: failingChannel('EMAIL'),
        sms: failingChannel('SMS'),
        push: failingChannel('PUSH'),
      });

      await expect(useCase.execute(SUNNY_MONDAY)).resolves.toMatchObject({
        deliveredVia: 'LOG',
        degraded: true,
      });
      expect(lastResort.calls).toHaveLength(1);
      expect(lastResort.calls[0]?.message.track).toBe(EMERGENCY_TRACK);
    });

    it('[CA-APP-05] renvoie un rapport dégradé sans lever si le dernier recours échoue lui aussi', async () => {
      const { useCase, lastResort, logger } = setup({
        email: failingChannel('EMAIL'),
        sms: failingChannel('SMS'),
        push: failingChannel('PUSH'),
        lastResort: new RecordingChannel('LOG', { failWith: failure('LOG') }),
      });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(lastResort.calls).toHaveLength(1);
      expect(report.deliveredVia).toBe('LOG');
      expect(report.attempts.at(-1)).toMatchObject({ channel: 'LOG', success: false });
      expect(report.attempts.every((attempt) => !attempt.success)).toBe(true);
      expect(report.degraded).toBe(true);
      expect(logger.at('error').length).toBeGreaterThan(0);
    });

    it("[CA-APP-09] ne tente pas un canal dont l'utilisateur n'a pas la coordonnée", async () => {
      // Alice préfère EMAIL et a EMAIL + SMS, mais aucun jeton PUSH.
      const { useCase, push } = setup({
        email: failingChannel('EMAIL'),
        sms: failingChannel('SMS'),
      });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(push.calls).toHaveLength(0);
      expect(report.attempts.map((attempt) => attempt.channel)).not.toContain('PUSH');
      expect(report.deliveredVia).toBe('LOG');
    });
  });

  describe('préférences indisponibles', () => {
    it('[CA-APP-06] émet quand même un réveil avec les préférences par défaut si le service est en panne', async () => {
      const catalog = new StubMusicCatalog(RESOLVED_TRACK);
      const { useCase, lastResort, totalSends } = setup({
        preferences: new FailingPreferences(failure('Préférences')),
        catalog,
      });

      const report = await useCase.execute(SUNNY_MONDAY);

      const defaults = UserPreferences.createDefault(ALICE);
      expect(catalog.queries.map((query) => query.cacheKey)).toEqual([
        defaults.fallbackTrack.cacheKey,
      ]);
      // Préférences par défaut : canal LOG et aucune coordonnée → dernier recours.
      expect(totalSends()).toBe(1);
      expect(lastResort.calls).toHaveLength(1);
      expect(lastResort.calls[0]?.message.track).toBe(RESOLVED_TRACK);
      expect(report.userId).toBe(ALICE.value);
      expect(report.deliveredVia).toBe('LOG');
      expect(report.degraded).toBe(true);
    });

    it("[CA-APP-06] émet quand même un réveil avec les préférences par défaut si l'utilisateur est inconnu", async () => {
      const catalog = new StubMusicCatalog(RESOLVED_TRACK);
      const { useCase, lastResort, email } = setup({ catalog });

      const report = await useCase.execute({
        userId: UNKNOWN,
        dayOfWeek: 'LUNDI',
        weather: 'SOLEIL',
      });

      const defaults = UserPreferences.createDefault(UNKNOWN);
      expect(catalog.queries.map((query) => query.cacheKey)).toEqual([
        defaults.fallbackTrack.cacheKey,
      ]);
      expect(email.calls).toHaveLength(0);
      expect(lastResort.calls).toHaveLength(1);
      expect(lastResort.calls[0]?.recipient.userId.equals(UNKNOWN)).toBe(true);
      expect(report.userId).toBe(UNKNOWN.value);
      expect(report.degraded).toBe(true);
    });
  });

  describe('journalisation du mode dégradé', () => {
    const SCENARIOS: ReadonlyArray<{
      readonly name: string;
      readonly overrides: () => Overrides;
      readonly command: WakeUpCommand;
    }> = [
      {
        name: 'service de préférences en panne',
        overrides: () => ({ preferences: new FailingPreferences(failure('Préférences')) }),
        command: SUNNY_MONDAY,
      },
      {
        name: 'utilisateur inconnu',
        overrides: () => ({}),
        command: { userId: UNKNOWN, dayOfWeek: 'LUNDI', weather: 'SOLEIL' },
      },
      {
        name: 'catalogue musical en panne',
        overrides: () => ({ catalog: new FailingMusicCatalog(failure('Catalogue')) }),
        command: SUNNY_MONDAY,
      },
      {
        name: 'repli local signalé par le catalogue',
        overrides: () => ({
          catalog: new StubMusicCatalog(
            Track.create({ title: 'Morning', artist: 'Grieg', source: LOCAL_TRACK_SOURCE }),
            { degraded: true },
          ),
        }),
        command: SUNNY_MONDAY,
      },
      {
        name: 'canal préféré en panne',
        overrides: () => ({ email: failingChannel('EMAIL') }),
        command: SUNNY_MONDAY,
      },
      {
        name: 'tous les canaux en panne',
        overrides: () => ({
          email: failingChannel('EMAIL'),
          sms: failingChannel('SMS'),
          push: failingChannel('PUSH'),
        }),
        command: SUNNY_MONDAY,
      },
    ];

    it.each(SCENARIOS)(
      '[CA-APP-08] journalise la bascule en mode dégradé au niveau warn : $name',
      async ({ overrides, command }) => {
        const { useCase, logger } = setup(overrides());

        const report = await useCase.execute(command);

        expect(report.degraded).toBe(true);
        expect(logger.at('warn').length).toBeGreaterThan(0);
      },
    );
  });

  describe("détails d'implémentation", () => {
    it('rend le rapport dégradé quand le canal préféré est sauté faute de coordonnée', async () => {
      const userPreferencesProvider = new InMemoryPreferences([
        UserPreferences.create({
          userId: ALICE,
          tracksByWeather: { SOLEIL: SUNNY_QUERY },
          fallbackTrack: ALICE_FALLBACK_QUERY,
          preferredChannel: 'PUSH',
          contacts: CONTACTS,
        }),
      ]);
      const { useCase, sms, logger } = setup({ preferences: userPreferencesProvider });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(report.deliveredVia).toBe('EMAIL');
      expect(sms.calls).toHaveLength(0);
      expect(report.degraded).toBe(true);
      const warnings = logger.at('warn').map((entry) => RecordingLogger.text(entry));
      expect(warnings.some((text) => text.includes('canal préféré indisponible'))).toBe(true);
    });

    it("ne signale aucune bascule quand l'utilisateur a choisi le journal comme canal préféré", async () => {
      const userPreferencesProvider = new InMemoryPreferences([
        UserPreferences.create({
          userId: ALICE,
          tracksByWeather: { SOLEIL: SUNNY_QUERY },
          fallbackTrack: ALICE_FALLBACK_QUERY,
          preferredChannel: 'LOG',
          contacts: {},
        }),
      ]);
      const { useCase, lastResort, logger } = setup({ preferences: userPreferencesProvider });

      const report = await useCase.execute(SUNNY_MONDAY);

      expect(lastResort.calls).toHaveLength(1);
      expect(report.deliveredVia).toBe('LOG');
      expect(report.degraded).toBe(false);
      expect(logger.at('warn')).toHaveLength(0);
    });
  });
});
