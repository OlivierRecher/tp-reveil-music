// Composition root : SEUL endroit qui connaît les implémentations concrètes (ADR-0003).
// Enregistrement explicite awilix (InjectionMode.PROXY), jamais de chargement automatique de modules.
import { NotificationDispatcher, TriggerWakeUp, WeatherTrackSelectionPolicy } from '@reveil/core';
import type {
  EmergencyPlaylist,
  Logger,
  MusicCatalog,
  NotificationChannel,
  TrackSelectionPolicy,
  UserPreferences,
  UserPreferencesProvider,
} from '@reveil/core';
import { InjectionMode, asClass, asFunction, asValue, createContainer } from 'awilix';
import type { AwilixContainer } from 'awilix';
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
import type { NotificationLog } from '../infrastructure/notification/NotificationLog.ts';
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
export interface ContainerOverrides {
  /** `fetch` des fournisseurs musicaux (défaut : `globalThis.fetch`). */
  readonly httpFetch?: HttpFetch;
  /** Instance pino (défaut : pino au niveau `config.logLevel`). */
  readonly pinoLogger?: Pino;
}

/** Dépendances résolubles par le conteneur. */
export interface AppCradle {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly triggerWakeUp: TriggerWakeUp;
  readonly musicCatalog: MusicCatalog;
  readonly emergencyPlaylist: EmergencyPlaylist;
  readonly trackSelectionPolicy: TrackSelectionPolicy;
  readonly notificationDispatcher: NotificationDispatcher;
  readonly notificationChannels: ReadonlyArray<NotificationChannel>;
  readonly lastResortChannel: NotificationChannel;
  readonly userPreferencesProvider: UserPreferencesProvider;
}

/** Dépendances techniques internes à la composition root (non exposées aux appelants). */
interface Cradle extends AppCradle {
  readonly pinoLogger: Pino;
  readonly httpFetch: HttpFetch;
  readonly musicProviders: ReadonlyArray<MusicProvider>;
  readonly localMusicProvider: LocalMusicProvider;
  readonly preferencesSeed: ReadonlyArray<UserPreferences>;
  readonly notificationLogFile: string;
  readonly notificationLog: NotificationLog;
  readonly emailClient: FakeEmailClient;
  readonly smsGateway: FakeSmsGateway;
  readonly pushService: FakePushService;
}

type Container = AwilixContainer<Cradle>;

/** Construit le conteneur de l'application à partir de la configuration validée. */
export function buildContainer(
  config: AppConfig,
  overrides: ContainerOverrides = {},
): AwilixContainer<AppCradle> {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  });
  container.register({ config: asValue(config) });
  registerLogging(container, overrides.pinoLogger);
  registerPreferences(container, config);
  registerMusic(container, overrides.httpFetch);
  registerNotifications(container, config);
  registerUseCase(container);
  return container;
}

/** Journal applicatif : pino fourni (tests) ou pino JSON sur la sortie standard. */
function registerLogging(container: Container, pinoLogger: Pino | undefined): void {
  container.register({
    pinoLogger:
      pinoLogger === undefined
        ? asFunction(({ config }: Cradle) => pino({ level: config.logLevel }))
            .singleton()
            // Vide le tampon de pino à l'arrêt : aucune ligne de journal perdue.
            .disposer((logger) => {
              logger.flush();
            })
        : asValue(pinoLogger),
    logger: asClass(PinoLogger).singleton(),
  });
}

/** Mock du service interne de préférences, ou service en panne (`SIMULATED_FAILURES=preferences`). */
function registerPreferences(container: Container, config: AppConfig): void {
  container.register({
    preferencesSeed: asValue(createPreferencesSeed()),
    userPreferencesProvider: config.simulatedFailures.has('preferences')
      ? asClass(FailingUserPreferencesProvider).singleton()
      : asClass(InMemoryUserPreferencesProvider).singleton(),
  });
}

/**
 * Chaîne musicale (ADR-0004) : un maillon décoré par fournisseur de `MUSIC_PROVIDERS`, dans l'ordre
 * configuré, puis le fallback local (qui sert aussi de playlist de secours au cas d'usage).
 */
function registerMusic(container: Container, httpFetch: HttpFetch | undefined): void {
  container.register({
    // Fonction fléchée : `fetch` natif appelé sans dépendre du `this` de l'appelant.
    httpFetch: asValue(httpFetch ?? ((input, init) => fetch(input, init))),
    musicProviders: asFunction((cradle: Cradle) =>
      Object.freeze(cradle.config.musicProviders.map((name) => createMusicChainLink(name, cradle))),
    ).singleton(),
    localMusicProvider: asClass(LocalMusicProvider).singleton(),
    emergencyPlaylist: asFunction(
      ({ localMusicProvider }: Cradle) => localMusicProvider,
    ).singleton(),
    musicCatalog: asClass(FallbackMusicCatalog).singleton(),
  });
}

/** Maillon de la chaîne : Cached( RateLimited( Resilient( fournisseur ) ) ). */
function createMusicChainLink(
  name: MusicProviderName,
  { config, httpFetch }: Cradle,
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
 * Ajouter un canal = un adaptateur + une entrée dans `notificationChannels`.
 */
function registerNotifications(container: Container, config: AppConfig): void {
  const failing = config.simulatedFailures;
  container.register({
    notificationLogFile: asValue(config.notificationLogFile),
    notificationLog: asClass(FileNotificationLog).singleton(),
    emailClient: asFunction(
      ({ notificationLog }: Cradle) =>
        new FakeEmailClient({ notificationLog, failing: failing.has('email') }),
    ).singleton(),
    smsGateway: asFunction(
      ({ notificationLog }: Cradle) =>
        new FakeSmsGateway({ notificationLog, failing: failing.has('sms') }),
    ).singleton(),
    pushService: asFunction(
      ({ notificationLog }: Cradle) =>
        new FakePushService({ notificationLog, failing: failing.has('push') }),
    ).singleton(),
    notificationChannels: asFunction((cradle: Cradle) =>
      Object.freeze([
        new EmailChannelAdapter(cradle),
        new SmsChannelAdapter(cradle),
        new PushChannelAdapter(cradle),
      ]),
    ).singleton(),
    lastResortChannel: asClass(LogChannel).singleton(),
  });
}

/** Noyau métier : règle de sélection, distribution des notifications et cas d'usage. */
function registerUseCase(container: Container): void {
  container.register({
    trackSelectionPolicy: asClass(WeatherTrackSelectionPolicy).singleton(),
    notificationDispatcher: asClass(NotificationDispatcher).singleton(),
    triggerWakeUp: asClass(TriggerWakeUp).singleton(),
  });
}
