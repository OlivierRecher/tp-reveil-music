// Lecture et validation de l'environnement (zod) : échec explicite au démarrage si invalide.
import { z } from 'zod';
import { ConfigError } from './ConfigError.ts';

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

/** Décision d'équipe : une variable vide (ou composée d'espaces) est traitée comme absente. */
function emptyAsUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

/** Entier strictement positif écrit en décimal (`'0'`, `'-1'`, `'1.5'`, `'abc'` refusés). */
function positiveInteger(defaultValue: number, max = Number.MAX_SAFE_INTEGER) {
  return z.preprocess(
    emptyAsUndefined,
    z
      .string()
      .trim()
      .regex(/^[1-9]\d*$/, 'entier strictement positif attendu')
      .transform(Number)
      .pipe(z.number().max(max, `valeur maximale ${String(max)}`))
      .default(defaultValue),
  );
}

/**
 * Liste séparée par virgules de valeurs autorisées, sans doublon.
 * Ici une chaîne vide est une liste vide (et non l'absence de variable) : elle a un sens métier
 * (« aucun fournisseur distant », « aucune panne »).
 */
function commaSeparatedList<const T extends readonly [string, ...string[]]>(
  allowed: T,
  defaultValue: string,
) {
  return z
    .string()
    .default(defaultValue)
    .transform((raw) =>
      raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== ''),
    )
    .pipe(
      z
        .array(z.enum(allowed))
        .refine((items) => new Set(items).size === items.length, 'valeur déclarée plusieurs fois'),
    );
}

/** Schéma de l'environnement : les clés sont les noms de variables (cf. `.env.example`). */
const envSchema = z.object({
  PORT: positiveInteger(3000, 65535),
  LOG_LEVEL: z.preprocess(emptyAsUndefined, z.enum(LOG_LEVELS).default('info')),
  MUSIC_PROVIDERS: commaSeparatedList(MUSIC_PROVIDER_NAMES, 'itunes,musicbrainz'),
  // Requis par MusicBrainz (ADR-0004, CA-MUS-04) : pas de valeur par défaut.
  MUSICBRAINZ_USER_AGENT: z.preprocess(
    emptyAsUndefined,
    z.string({ error: 'requis (nom d’application + contact)' }).trim(),
  ),
  ITUNES_MAX_REQUESTS_PER_MINUTE: positiveInteger(20),
  MUSIC_CACHE_TTL_SECONDS: positiveInteger(86400),
  MUSIC_PROVIDER_TIMEOUT_MS: positiveInteger(2000),
  NOTIFICATION_LOG_FILE: z.preprocess(
    emptyAsUndefined,
    z.string().trim().default('logs/notifications.log'),
  ),
  SIMULATED_FAILURES: commaSeparatedList(SIMULATED_FAILURE_TARGETS, ''),
});

/** Valide l'environnement ; lève `ConfigError` en listant chaque variable invalide. */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`),
    );
  }
  const values = result.data;
  return Object.freeze({
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
    musicProviders: Object.freeze(values.MUSIC_PROVIDERS),
    musicBrainzUserAgent: values.MUSICBRAINZ_USER_AGENT,
    itunesMaxRequestsPerMinute: values.ITUNES_MAX_REQUESTS_PER_MINUTE,
    musicCacheTtlSeconds: values.MUSIC_CACHE_TTL_SECONDS,
    musicProviderTimeoutMs: values.MUSIC_PROVIDER_TIMEOUT_MS,
    notificationLogFile: values.NOTIFICATION_LOG_FILE,
    simulatedFailures: new Set(values.SIMULATED_FAILURES),
  });
}
