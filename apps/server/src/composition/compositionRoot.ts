// Composition root : SEUL endroit qui connaît les implémentations concrètes (ADR-0007).
// Injection de dépendances manuelle (Pure DI) : chaque composant est construit une fois, dans l'ordre
// de ses dépendances, puis passé aux constructeurs via leur objet `Deps`. Le câblage est vérifié par tsc.
import { NotificationDispatcher, TriggerWakeUp, WeatherTrackSelectionPolicy } from '@reveil/core';
import type {
  EmergencyPlaylist,
  Logger,
  MusicCatalog,
  NotificationChannel,
  UserPreferencesProvider,
} from '@reveil/core';
import { pino } from 'pino';
import type { Logger as Pino } from 'pino';
import type { AppConfig, MusicProviderName } from '../config/env.ts';
import type { HttpFetch } from '../infrastructure/http/HttpFetch.ts';
import { PinoLogger } from '../infrastructure/logging/PinoLogger.ts';
import { CachedMusicProvider } from '../infrastructure/music/CachedMusicProvider.ts';
import { FallbackMusicCatalog } from '../infrastructure/music/FallbackMusicCatalog.ts';
import { ItunesMusicProvider } from '../infrastructure/music/ItunesMusicProvider.ts';
import { LocalMusicProvider } from '../infrastructure/music/LocalMusicProvider.ts';
import { MusicBrainzMusicProvider } from '../infrastructure/music/MusicBrainzMusicProvider.ts';
import type { MusicProvider } from '../infrastructure/music/MusicProvider.ts';
import { RateLimitedMusicProvider } from '../infrastructure/music/RateLimitedMusicProvider.ts';
import { ResilientMusicProvider } from '../infrastructure/music/ResilientMusicProvider.ts';
import { EmailChannelAdapter } from '../infrastructure/notification/EmailChannelAdapter.ts';
import { FileNotificationLog } from '../infrastructure/notification/FileNotificationLog.ts';
import { LogChannel } from '../infrastructure/notification/LogChannel.ts';
import { PushChannelAdapter } from '../infrastructure/notification/PushChannelAdapter.ts';
import { SmsChannelAdapter } from '../infrastructure/notification/SmsChannelAdapter.ts';
import { FakeEmailClient } from '../infrastructure/notification/vendors/FakeEmailClient.ts';
import { FakePushService } from '../infrastructure/notification/vendors/FakePushService.ts';
import { FakeSmsGateway } from '../infrastructure/notification/vendors/FakeSmsGateway.ts';
import { FailingUserPreferencesProvider } from '../infrastructure/preferences/FailingUserPreferencesProvider.ts';
import { InMemoryUserPreferencesProvider } from '../infrastructure/preferences/InMemoryUserPreferencesProvider.ts';
import { createPreferencesSeed } from '../infrastructure/preferences/preferencesSeed.ts';

/** Fenêtre du quota iTunes : `ITUNES_MAX_REQUESTS_PER_MINUTE` requêtes par minute. */
const ITUNES_QUOTA_INTERVAL_MS = 60_000;

/**
 * Quota MusicBrainz : 1 requête par seconde et par adresse IP, imposé par sa politique d'usage
 * (au-delà, réponses 503). Valeur fixée par le fournisseur, donc constante et non configurable
 * (ADR-0004).
 */
const MUSICBRAINZ_MAX_REQUESTS = 1;
const MUSICBRAINZ_QUOTA_INTERVAL_MS = 1_000;

/** Remplacements des dépendances techniques (tests, démo hors réseau). */
export interface CompositionOverrides {
  /** `fetch` des fournisseurs musicaux (défaut : `globalThis.fetch`). */
  readonly httpFetch?: HttpFetch;
  /** Instance pino (défaut : pino au niveau `config.logLevel`). */
  readonly pinoLogger?: Pino;
}

/** Application assemblée : points d'entrée du cas d'usage et ports exposés aux tests. */
export interface Application {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly triggerWakeUp: TriggerWakeUp;
  readonly musicCatalog: MusicCatalog;
  readonly emergencyPlaylist: EmergencyPlaylist;
  readonly notificationChannels: ReadonlyArray<NotificationChannel>;
  readonly lastResortChannel: NotificationChannel;
  readonly userPreferencesProvider: UserPreferencesProvider;
  /** Libère les ressources créées par la composition root (vidage du tampon de pino). */
  dispose(): Promise<void>;
}

/** Assemble l'application à partir de la configuration validée. */
export function composeApplication(
  config: AppConfig,
  overrides: CompositionOverrides = {},
): Application {
  // Pino fourni (tests, CLI) : son propriétaire le libère. Sinon pino JSON sur la sortie standard.
  const ownsPino = overrides.pinoLogger === undefined;
  const pinoLogger = overrides.pinoLogger ?? pino({ level: config.logLevel });
  const logger = new PinoLogger({ pinoLogger });

  const userPreferencesProvider = composePreferences(config);
  const localMusicProvider = new LocalMusicProvider();
  const musicCatalog = new FallbackMusicCatalog({
    musicProviders: composeMusicProviders(config, overrides.httpFetch),
    localMusicProvider,
    logger,
  });
  const { notificationChannels, lastResortChannel } = composeNotifications(config, logger);

  const triggerWakeUp = new TriggerWakeUp({
    userPreferencesProvider,
    musicCatalog,
    // Le fournisseur local sert aussi de playlist de secours, qui ne peut pas échouer.
    emergencyPlaylist: localMusicProvider,
    trackSelectionPolicy: new WeatherTrackSelectionPolicy(),
    notificationDispatcher: new NotificationDispatcher({
      notificationChannels,
      lastResortChannel,
      logger,
    }),
    logger,
  });

  return {
    config,
    logger,
    triggerWakeUp,
    musicCatalog,
    emergencyPlaylist: localMusicProvider,
    notificationChannels,
    lastResortChannel,
    userPreferencesProvider,
    dispose: () => {
      // Vide le tampon de pino à l'arrêt : aucune ligne de journal perdue.
      if (ownsPino) pinoLogger.flush();
      return Promise.resolve();
    },
  };
}

/** Mock du service interne de préférences, ou service en panne (`SIMULATED_FAILURES=preferences`). */
function composePreferences(config: AppConfig): UserPreferencesProvider {
  return config.simulatedFailures.has('preferences')
    ? new FailingUserPreferencesProvider()
    : new InMemoryUserPreferencesProvider({ preferencesSeed: createPreferencesSeed() });
}

/**
 * Chaîne musicale (ADR-0004) : un maillon décoré par fournisseur de `MUSIC_PROVIDERS`, dans l'ordre
 * configuré. Le fallback local est ajouté par `FallbackMusicCatalog`.
 */
function composeMusicProviders(
  config: AppConfig,
  httpFetch: HttpFetch | undefined,
): ReadonlyArray<MusicProvider> {
  // Fonction fléchée : `fetch` natif appelé sans dépendre du `this` de l'appelant.
  const fetchOrNative: HttpFetch = httpFetch ?? ((input, init) => fetch(input, init));
  return Object.freeze(
    config.musicProviders.map((name) => createMusicChainLink(name, config, fetchOrNative)),
  );
}

/** Maillon de la chaîne : Cached( RateLimited( Resilient( fournisseur ) ) ). */
function createMusicChainLink(
  name: MusicProviderName,
  config: AppConfig,
  httpFetch: HttpFetch,
): MusicProvider {
  // Panne simulée : le fournisseur garde son vrai code, seul son accès réseau échoue.
  const providerFetch = config.simulatedFailures.has(name) ? simulatedNetworkFailure : httpFetch;
  const quota =
    name === 'itunes'
      ? { maxRequests: config.itunesMaxRequestsPerMinute, intervalMs: ITUNES_QUOTA_INTERVAL_MS }
      : { maxRequests: MUSICBRAINZ_MAX_REQUESTS, intervalMs: MUSICBRAINZ_QUOTA_INTERVAL_MS };
  const provider =
    name === 'itunes'
      ? new ItunesMusicProvider({ httpFetch: providerFetch })
      : new MusicBrainzMusicProvider({
          httpFetch: providerFetch,
          musicBrainzUserAgent: config.musicBrainzUserAgent,
        });
  const resilient = new ResilientMusicProvider({
    inner: provider,
    timeoutMs: config.musicProviderTimeoutMs,
  });
  const rateLimited = new RateLimitedMusicProvider({ inner: resilient, ...quota });
  return new CachedMusicProvider({ inner: rateLimited, ttlMs: config.musicCacheTtlSeconds * 1000 });
}

/** `fetch` d'un fournisseur en panne simulée : rejette comme une coupure réseau, sans réseau. */
const simulatedNetworkFailure: HttpFetch = () =>
  Promise.reject(new Error('panne simulée (SIMULATED_FAILURES)'));

/**
 * Canaux de notification : mocks des fournisseurs (en panne si `SIMULATED_FAILURES` les cite),
 * adaptateurs vers `NotificationChannel`, et canal `LOG` de dernier recours.
 * Ajouter un canal = un adaptateur + une valeur de `ChannelType` (core) + une entrée dans
 * `notificationChannels` (ADR-0002, CA-NOT-05).
 */
function composeNotifications(
  config: AppConfig,
  logger: Logger,
): {
  readonly notificationChannels: ReadonlyArray<NotificationChannel>;
  readonly lastResortChannel: NotificationChannel;
} {
  const failing = config.simulatedFailures;
  const notificationLog = new FileNotificationLog({
    notificationLogFile: config.notificationLogFile,
  });
  return {
    notificationChannels: Object.freeze([
      new EmailChannelAdapter({
        emailClient: new FakeEmailClient({ notificationLog, failing: failing.has('email') }),
      }),
      new SmsChannelAdapter({
        smsGateway: new FakeSmsGateway({ notificationLog, failing: failing.has('sms') }),
      }),
      new PushChannelAdapter({
        pushService: new FakePushService({ notificationLog, failing: failing.has('push') }),
      }),
    ]),
    lastResortChannel: new LogChannel({ notificationLog, logger }),
  };
}
