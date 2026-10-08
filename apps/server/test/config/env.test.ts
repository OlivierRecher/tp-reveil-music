import { describe, expect, it } from 'vitest';
import { ConfigError } from '../../src/config/ConfigError.ts';
import { loadConfig } from '../../src/config/env.ts';

/** Environnement minimal valide : seule la variable obligatoire est fournie. */
const MINIMAL_ENV = {
  MUSICBRAINZ_USER_AGENT: 'ReveilMusical/0.1.0 ( contact@example.com )',
} as const;

function withEnv(
  overrides: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  return { ...MINIMAL_ENV, ...overrides };
}

/** Exécute `loadConfig` et renvoie l'erreur levée (échoue si rien n'est levé). */
function configErrorOf(env: Readonly<Record<string, string | undefined>>): ConfigError {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return error as ConfigError;
  }
  throw new Error('loadConfig aurait dû lever une ConfigError');
}

describe('loadConfig — User-Agent MusicBrainz', () => {
  it('[CA-MUS-04] refuse de démarrer sans MUSICBRAINZ_USER_AGENT', () => {
    const error = configErrorOf({});
    expect(error.message).toContain('MUSICBRAINZ_USER_AGENT');
  });

  it('[CA-MUS-04] refuse de démarrer avec un MUSICBRAINZ_USER_AGENT vide', () => {
    const error = configErrorOf({ MUSICBRAINZ_USER_AGENT: '' });
    expect(error.message).toContain('MUSICBRAINZ_USER_AGENT');
  });

  it('[CA-MUS-04] refuse de démarrer avec un MUSICBRAINZ_USER_AGENT composé d’espaces', () => {
    const error = configErrorOf({ MUSICBRAINZ_USER_AGENT: '   ' });
    expect(error.message).toContain('MUSICBRAINZ_USER_AGENT');
  });

  it('[CA-MUS-04] conserve le User-Agent fourni', () => {
    expect(loadConfig(MINIMAL_ENV).musicBrainzUserAgent).toBe(
      'ReveilMusical/0.1.0 ( contact@example.com )',
    );
  });
});

describe('loadConfig — valeurs par défaut', () => {
  it('applique les valeurs par défaut documentées dans .env.example', () => {
    const config = loadConfig(MINIMAL_ENV);

    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe('info');
    expect(config.musicProviders).toEqual(['itunes', 'musicbrainz']);
    expect(config.itunesMaxRequestsPerMinute).toBe(20);
    expect(config.musicCacheTtlSeconds).toBe(86400);
    expect(config.musicProviderTimeoutMs).toBe(2000);
    expect(config.notificationLogFile).toBe('logs/notifications.log');
    expect(config.simulatedFailures.size).toBe(0);
  });

  it('lit et convertit les valeurs fournies', () => {
    const config = loadConfig(
      withEnv({
        PORT: '8080',
        LOG_LEVEL: 'debug',
        ITUNES_MAX_REQUESTS_PER_MINUTE: '10',
        MUSIC_CACHE_TTL_SECONDS: '60',
        MUSIC_PROVIDER_TIMEOUT_MS: '500',
        NOTIFICATION_LOG_FILE: '/tmp/notifs.log',
      }),
    );

    expect(config.port).toBe(8080);
    expect(config.logLevel).toBe('debug');
    expect(config.itunesMaxRequestsPerMinute).toBe(10);
    expect(config.musicCacheTtlSeconds).toBe(60);
    expect(config.musicProviderTimeoutMs).toBe(500);
    expect(config.notificationLogFile).toBe('/tmp/notifs.log');
  });

  it.each([
    ['PORT', 'port', 3000],
    ['ITUNES_MAX_REQUESTS_PER_MINUTE', 'itunesMaxRequestsPerMinute', 20],
    ['MUSIC_CACHE_TTL_SECONDS', 'musicCacheTtlSeconds', 86400],
    ['MUSIC_PROVIDER_TIMEOUT_MS', 'musicProviderTimeoutMs', 2000],
  ] as const)('considère %s vide comme absente : valeur par défaut', (name, key, expected) => {
    expect(loadConfig(withEnv({ [name]: '' }))[key]).toBe(expected);
  });

  it('rejette un niveau de journal inconnu', () => {
    expect(configErrorOf(withEnv({ LOG_LEVEL: 'verbose' })).message).toContain('LOG_LEVEL');
  });
});

describe('loadConfig — MUSIC_PROVIDERS', () => {
  it('conserve l’ordre déclaré de la chaîne de fournisseurs', () => {
    expect(loadConfig(withEnv({ MUSIC_PROVIDERS: 'musicbrainz,itunes' })).musicProviders).toEqual([
      'musicbrainz',
      'itunes',
    ]);
  });

  it('accepte un seul fournisseur et ignore les espaces autour des noms', () => {
    expect(loadConfig(withEnv({ MUSIC_PROVIDERS: ' musicbrainz ' })).musicProviders).toEqual([
      'musicbrainz',
    ]);
    expect(loadConfig(withEnv({ MUSIC_PROVIDERS: 'itunes , musicbrainz' })).musicProviders).toEqual(
      ['itunes', 'musicbrainz'],
    );
  });

  it('accepte une liste vide : aucun fournisseur distant, seul le local répond', () => {
    expect(loadConfig(withEnv({ MUSIC_PROVIDERS: '' })).musicProviders).toEqual([]);
  });

  it('rejette un fournisseur inconnu en nommant la variable', () => {
    const error = configErrorOf(withEnv({ MUSIC_PROVIDERS: 'itunes,spotify' }));
    expect(error.message).toContain('MUSIC_PROVIDERS');
  });

  it('rejette un fournisseur déclaré deux fois', () => {
    const error = configErrorOf(withEnv({ MUSIC_PROVIDERS: 'itunes,itunes' }));
    expect(error.message).toContain('MUSIC_PROVIDERS');
  });
});

describe('loadConfig — nombres', () => {
  it.each([
    ['PORT', 'abc'],
    ['PORT', '0'],
    ['PORT', '-1'],
    ['PORT', '3000.5'],
    ['ITUNES_MAX_REQUESTS_PER_MINUTE', 'vingt'],
    ['ITUNES_MAX_REQUESTS_PER_MINUTE', '0'],
    ['MUSIC_CACHE_TTL_SECONDS', '-60'],
    ['MUSIC_PROVIDER_TIMEOUT_MS', '1.5'],
  ])('rejette %s=%s (entier strictement positif attendu)', (name, value) => {
    expect(configErrorOf(withEnv({ [name]: value })).message).toContain(name);
  });

  it('liste toutes les variables invalides dans un seul message', () => {
    const error = configErrorOf({ PORT: 'abc', MUSIC_PROVIDER_TIMEOUT_MS: '0' });
    expect(error.message).toContain('PORT');
    expect(error.message).toContain('MUSIC_PROVIDER_TIMEOUT_MS');
    expect(error.message).toContain('MUSICBRAINZ_USER_AGENT');
  });
});

describe('loadConfig — SIMULATED_FAILURES', () => {
  it('lit la liste des pannes simulées', () => {
    const config = loadConfig(withEnv({ SIMULATED_FAILURES: 'preferences, itunes,sms' }));
    expect([...config.simulatedFailures].sort()).toEqual(['itunes', 'preferences', 'sms']);
  });

  it('accepte toutes les cibles connues', () => {
    const config = loadConfig(
      withEnv({ SIMULATED_FAILURES: 'preferences,itunes,musicbrainz,email,sms,push' }),
    );
    expect(config.simulatedFailures.size).toBe(6);
  });

  it('considère une liste vide comme « aucune panne »', () => {
    expect(loadConfig(withEnv({ SIMULATED_FAILURES: '' })).simulatedFailures.size).toBe(0);
  });

  it('rejette une cible inconnue en nommant la variable', () => {
    const error = configErrorOf(withEnv({ SIMULATED_FAILURES: 'preferences,whatsapp' }));
    expect(error.message).toContain('SIMULATED_FAILURES');
  });
});
