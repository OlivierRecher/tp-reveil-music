# Architecture — Réveil musical

## 1. Vue d'ensemble

Architecture **hexagonale (Ports & Adapters)** dans un monorepo npm workspaces. Le noyau métier ne
dépend de rien ; tout le reste dépend de lui (inversion de dépendances). Les règles sont vérifiées
automatiquement par `dependency-cruiser` (`npm run arch:check`) et ESLint.

```
                ┌──────────────────────── apps/web (PWA) ────────────────────────┐
                │  formulaire de déclenchement · affichage du WakeUpReport        │
                └───────────────────────────────┬────────────────────────────────┘
                                                │ HTTP POST /api/wake-ups
┌───────────────────────────────── apps/server ─▼────────────────────────────────────────────┐
│  http/ (adaptateur entrant Fastify + validation zod)                                         │
│        │                                                                                     │
│        ▼  résolu par le conteneur                                                            │
│  ┌─────────────────────── packages/core (@reveil/core) ───────────────────────┐              │
│  │ application/                                                               │              │
│  │   TriggerWakeUp (cas d'usage) ──► NotificationDispatcher                   │              │
│  │   ports : UserPreferencesProvider · MusicCatalog · NotificationChannel     │              │
│  │           EmergencyPlaylist · Logger                                       │              │
│  │ domain/                                                                    │              │
│  │   WeatherType · DayOfWeek · Track · UserPreferences · ChannelType          │              │
│  │   UserId · TrackQuery · Recipient · DomainError (et sous-classes)          │              │
│  │   TrackSelectionPolicy (WeatherTrackSelectionPolicy) · WakeUpMessage       │              │
│  │   WakeUpReport                                                             │              │
│  └───────────────────────────────▲────────────────────────────────────────────┘              │
│                                  │ implémentent les ports                                    │
│  infrastructure/                                                                             │
│   preferences/  InMemoryUserPreferencesProvider (mock du service interne)                    │
│                 FailingUserPreferencesProvider (panne simulée, démo)                         │
│   music/        ItunesMusicProvider · MusicBrainzMusicProvider · LocalMusicProvider          │
│                 décorateurs : Cached / RateLimited / Resilient · FallbackMusicCatalog        │
│   notification/ mocks vendeurs : FakeEmailClient · FakeSmsGateway · FakePushService          │
│                 adaptateurs : Email/Sms/PushChannelAdapter · LogChannel (dernier recours)    │
│                 FileNotificationLog (journal des envois simulés : fichier + console)         │
│   logging/      PinoLogger                                                                   │
│  composition/container.ts  ← SEUL endroit qui connaît les classes concrètes (awilix)         │
│  cli/wake.ts               ← script de démonstration (même conteneur, sans HTTP)             │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Décorateurs musicaux : `Cached` s'appuie sur lru-cache, `Resilient` sur cockatiel ; `RateLimited` est une
fenêtre glissante interne de quelques lignes (p-throttle met en file au lieu d'échouer immédiatement,
voir [ADR-0006](adr/0006-quota-sans-p-throttle.md)).

## 2. Flux de l'appel `TriggerWakeUp.execute({ userId, dayOfWeek, weather })`

Les entrées sont des value objects déjà validés par l'adaptateur entrant : `userId: UserId`,
`dayOfWeek: DayOfWeek`, `weather: WeatherType` (`WakeUpCommand`). Le cas d'usage ne lève jamais :
chaque bascule est journalisée en `warn` (avec `userId` et `reason`) et rend le rapport `degraded`.

1. **Préférences** : `UserPreferencesProvider.findByUserId(userId)`.
   Panne ou utilisateur inconnu (`null`) → `UserPreferences.createDefault(userId)` (morceau de secours
   générique, canal `LOG`, aucune coordonnée), `degraded = true`.
2. **Sélection** (domaine pur) : `TrackSelectionPolicy.select(preferences, weather, dayOfWeek)` renvoie
   la `TrackQuery` associée à la météo, sinon le morceau de secours de l'utilisateur (fonctionnement
   **normal**, pas dégradé).
3. **Résolution** : `MusicCatalog.resolve(query)` → `Track`. L'implémentation est une chaîne
   (`FallbackMusicCatalog`) : iTunes → MusicBrainz → fallback local, chaque maillon décoré par
   cache, limitation de débit et timeout/circuit breaker. Un morceau de source `local` renvoyé par la
   chaîne est une bascule (`degraded = true`). Si malgré tout une exception remonte, le cas d'usage
   prend `EmergencyPlaylist.pick(weather)` (double filet de sécurité, la chaîne étant de
   l'infrastructure), `degraded = true`.
4. **Message** (domaine) : `WakeUpMessage.compose(track, dayOfWeek, weather)` (« Bon lundi ! Il pleut… »).
5. **Envoi** : `NotificationDispatcher.dispatch(preferences, message)` renvoie un `DispatchResult`
   (`deliveredVia`, `attempts`). Ordre : canal préféré (s'il est enregistré et que l'utilisateur en a
   la coordonnée), puis les autres canaux enregistrés pour lesquels il a une coordonnée (ordre
   d'enregistrement, sans re-tenter le préféré), puis `lastResortChannel` (`LogChannel`, adressé à
   `userId.value`). Chaque tentative est journalisée (`debug` avant, `info` si livrée, `warn` si échec) ;
   la remise au dernier recours est un `warn`, sauf si `LOG` est le canal préféré de l'utilisateur.
   Si le dernier recours lève malgré son contrat : `error` journalisé, tentative en échec,
   `deliveredVia` = type du dernier recours, aucune exception. Livraison hors du canal préféré ou
   tentative en échec → `degraded = true`.
6. **Résultat** : `WakeUpReport` (`userId`, `dayOfWeek`, `weather`, `track`, `trackSource`,
   `deliveredVia`, `attempts`, `degraded`) journalisé (`info`) et renvoyé à l'appelant.

## 3. Ports (contrats du noyau)

```ts
interface UserPreferencesProvider {
  /** `null` si l'utilisateur est inconnu ; rejette si le service est en panne. */
  findByUserId(userId: UserId): Promise<UserPreferences | null>;
}
interface MusicCatalog {
  resolve(query: TrackQuery): Promise<Track>; // Track = { title, artist, link?, source }
}
interface EmergencyPlaylist {
  pick(weather: WeatherType): Track; // synchrone, ne peut pas échouer
}
interface NotificationChannel {
  readonly type: ChannelType; // 'EMAIL' | 'SMS' | 'PUSH' | 'LOG'
  send(recipient: Recipient, message: WakeUpMessage): Promise<void>; // Recipient = { userId, address }
}
type LogContext = Readonly<Record<string, unknown>>;
interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
```

Services applicatifs (classes du noyau, injectées par awilix) :

```ts
class NotificationDispatcher {
  dispatch(preferences: UserPreferences, message: WakeUpMessage): Promise<DispatchResult>;
}
class TriggerWakeUp {
  execute(command: WakeUpCommand): Promise<WakeUpReport>; // { userId: UserId, dayOfWeek, weather }
}
```

`TriggerWakeUp` dépend directement de `NotificationDispatcher` : c'est un service du noyau, sans
détail technique, dont l'extensibilité passe par les canaux injectés (`NotificationChannel`). Le placer
derrière un port n'apporterait qu'une indirection.

`Track.link` est une URL neutre : `trackViewUrl` d'iTunes est traduit dans l'adaptateur et ne fuit pas.

### Points d'entrée (adaptateurs entrants)

Les deux points d'entrée valident la saisie avec les parseurs du domaine (`UserId.parse`,
`parseDayOfWeek`, `parseWeatherType`) avant d'appeler le cas d'usage : une saisie invalide ne déclenche
aucun appel musical ni aucun envoi. Ils ne connaissent que `@reveil/core` et la composition root.

- **HTTP** (`http/buildHttpServer.ts`, Fastify) : `POST /api/wake-ups` avec
  `{ userId, dayOfWeek, weather }` (schéma zod) → `200` + `WakeUpReport` sérialisé (`track` via
  `Track.toJSON()`) ; `400 { error: 'INVALID_REQUEST', details: [{ field, message }] }` pour un champ
  invalide ou manquant, un corps absent, non objet ou mal formé ; `500 { error: 'INTERNAL_ERROR' }`
  sans détail (journalisé en `error`). `GET /health` → `200 { status: 'ok' }`.
- **CLI** (`cli/wake.ts`, `npm run wake -- --user u1 --day LUNDI --weather PLUIE`) : arguments lus
  par `node:util` `parseArgs` (strict), rapport JSON sur la sortie standard, journal sur la sortie
  d'erreur, code de sortie `1` si la saisie ou la configuration est invalide.

`main.ts` charge la configuration (échec explicite si invalide), construit le conteneur et le serveur,
et sur `SIGINT`/`SIGTERM` ferme le serveur puis appelle `container.dispose()` (vidage du journal pino).
`SIMULATED_FAILURES` est lu par la composition root uniquement : elle substitue le mock en panne
(préférences, canaux) ou un `fetch` qui rejette (fournisseurs musicaux), sans toucher au métier.

## 4. Design patterns retenus

| Pattern                               | Où                                                                          | Problème métier résolu                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Ports & Adapters** (hexagonal)      | partout                                                                     | changer de fournisseur ou de canal sans toucher au métier                                            |
| **Dependency Injection / IoC**        | `composition/container.ts` (awilix)                                         | exigence « aucun `new` d'implémentation concrète »                                                   |
| **Adapter**                           | `ItunesMusicProvider`, `MusicBrainzMusicProvider`                           | traduire chaque API vers `Track` (anti-corruption layer + zod)                                       |
| **Adapter**                           | `EmailChannelAdapter`, `SmsChannelAdapter`, `PushChannelAdapter`            | ramener 3 mocks aux interfaces différentes vers `NotificationChannel`                                |
| **Decorator**                         | `CachedMusicProvider`, `RateLimitedMusicProvider`, `ResilientMusicProvider` | ajouter cache / quota 20 req/min (échec immédiat, ADR-0006) / timeout sans modifier les fournisseurs |
| **Chain of Responsibility**           | `FallbackMusicCatalog`, `NotificationDispatcher`                            | mode dégradé : essayer le suivant quand un maillon échoue                                            |
| **Strategy**                          | `TrackSelectionPolicy` ; choix du canal par `ChannelType`                   | règles de sélection isolées et testables                                                             |
| **Registry** (+ Factory du conteneur) | canaux indexés par `ChannelType`, chaîne musicale par config                | ajouter WhatsApp ou appel vocal = 1 adaptateur + 1 ligne d'enregistrement                            |
| **Circuit Breaker / Retry / Timeout** | `ResilientMusicProvider` (cockatiel)                                        | ne pas attendre un fournisseur en panne à l'heure du réveil                                          |
| **Value Object / Factory method**     | `Track.create`, `UserId.parse`, `WakeUpMessage.compose`                     | invariants garantis, pas d'objet invalide dans le domaine                                            |

Patterns volontairement **non** retenus : Singleton « à la main » (le conteneur gère les cycles de vie),
Observer/EventBus (un seul consommateur, ce serait de la complexité gratuite), Repository générique.

## 5. Traçabilité des exigences

Vue de synthèse. Le détail testable (un ID `CA-…` par comportement attendu) est dans
[`ACCEPTANCE_CRITERIA.md`](ACCEPTANCE_CRITERIA.md).

| Exigence de l'énoncé                                  | Traduction technique                                                                                              | Preuve (test / outil)                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Changer rapidement de source musicale                 | port `MusicCatalog` ; chaîne configurée par `MUSIC_PROVIDERS`                                                     | test de la composition root par configuration |
| Plusieurs canaux, nouveaux à venir                    | port `NotificationChannel` + registre ; adaptateurs par mock                                                      | tests des adaptateurs + du dispatcher         |
| Mocks aux interfaces différentes                      | `FakeEmailClient.sendMail({...})`, `FakeSmsGateway.send(phone, text)`, `FakePushService.push(token, payload, cb)` | tests des adaptateurs                         |
| Aucune dépendance sans vérification licence/fraîcheur | `DEPENDENCY_POLICY.md`, `license-policy.json`, `deps:licenses`, `deps:audit`, tableau README                      | CI                                            |
| Panne ≠ silence                                       | chaînes de fallback, `EmergencyPlaylist`, `LogChannel`, rapport `degraded`                                        | tests de panne du cas d'usage                 |
| iTunes ~20 req/min                                    | `RateLimitedMusicProvider` (fenêtre glissante, échec immédiat, ADR-0006) + `CachedMusicProvider` (lru-cache, TTL) | tests avec fake timers                        |
| MusicBrainz exige un User-Agent                       | en-tête fourni par la config `MUSICBRAINZ_USER_AGENT`, vérifié au démarrage (zod)                                 | test de l'adaptateur                          |
| `trackViewUrl` ne fuit pas dans le métier             | traduction en `Track.link` dans l'adaptateur ; core sans dépendance                                               | `arch:check` + test                           |
| Isolation, faible couplage                            | règles dependency-cruiser                                                                                         | `arch:check`                                  |
| Aucun `new` d'implémentation                          | awilix + règle ESLint `no-restricted-syntax`                                                                      | `lint`                                        |
| Tests unitaires, bonne couverture                     | vitest + seuils 90/85 %                                                                                           | `test:coverage`                               |

## 6. Hypothèses (à valider avec l'enseignant si besoin)

- **Rôle du jour de la semaine** : le service interne fournit un morceau par météo (pas par jour). Le jour
  sert à personnaliser le message et est conservé dans le rapport. `TrackSelectionPolicy` est le point
  d'extension si une règle par jour est demandée plus tard (ex. week-end).
- **Coordonnées** : le mock du service interne renvoie aussi les coordonnées par canal (email, téléphone,
  jeton push), nécessaires aux adaptateurs. Un canal sans coordonnée est considéré comme indisponible.
- **Utilisateur inconnu** : traité comme une panne du service de préférences (mode dégradé, canal `LOG`).
- **Ordonnancement** hors périmètre (énoncé) : l'API HTTP et un script CLI simulent le déclenchement.
- **Fallback local** : 5 à 10 morceaux codés en dur, au moins un par type de météo.
- **Recherche MusicBrainz** : requête Lucene par champs (`recording:"…" AND artist:"…"`), la recherche
  plein texte renvoyant surtout des reprises (constaté sur capture réelle).
