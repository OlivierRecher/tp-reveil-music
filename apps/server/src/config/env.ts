// Lecture et validation de l'environnement (zod). Implémentation : phase 3a, étape « vert ».

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Fournisseurs musicaux distants activables par `MUSIC_PROVIDERS` (le local est toujours ajouté). */
export const MUSIC_PROVIDER_NAMES = ['itunes', 'musicbrainz'] as const;
export type MusicProviderName = (typeof MUSIC_PROVIDER_NAMES)[number];

/** Pannes simulables par `SIMULATED_FAILURES` (démonstration du mode dégradé). */
export const SIMULATED_FAILURE_TARGETS = [
  'preferences',
  'itunes',
  'musicbrainz',
  'email',
  'sms',
  'push',
] as const;
export type SimulatedFailure = (typeof SIMULATED_FAILURE_TARGETS)[number];

/** Configuration validée et typée du serveur. */
export interface AppConfig {
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly musicProviders: ReadonlyArray<MusicProviderName>;
  readonly musicBrainzUserAgent: string;
  readonly itunesMaxRequestsPerMinute: number;
  readonly musicCacheTtlSeconds: number;
  readonly musicProviderTimeoutMs: number;
  readonly notificationLogFile: string;
  readonly simulatedFailures: ReadonlySet<SimulatedFailure>;
}

/** Valide l'environnement ; lève `ConfigError` en listant chaque variable invalide. */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  throw new Error('Not implemented', { cause: env });
}
