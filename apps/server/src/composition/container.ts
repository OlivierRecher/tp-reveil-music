// Composition root : SEUL endroit qui connaît les implémentations concrètes (ADR-0003).
// Enregistrement explicite awilix (InjectionMode.PROXY), jamais de chargement automatique de modules.
import type {
  EmergencyPlaylist,
  Logger,
  MusicCatalog,
  NotificationChannel,
  NotificationDispatcher,
  TrackSelectionPolicy,
  TriggerWakeUp,
  UserPreferencesProvider,
} from '@reveil/core';
import type { AwilixContainer } from 'awilix';
import type { Logger as Pino } from 'pino';
import type { AppConfig } from '../config/env.ts';
import type { HttpFetch } from '../infrastructure/http/HttpFetch.ts';

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

/** Construit le conteneur de l'application à partir de la configuration validée. */
export function buildContainer(
  config: AppConfig,
  overrides: ContainerOverrides = {},
): AwilixContainer<AppCradle> {
  throw new Error('Not implemented', { cause: { config, overrides } });
}
