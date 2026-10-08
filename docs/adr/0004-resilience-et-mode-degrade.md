# ADR-0004 — Résilience et mode dégradé

- Statut : Accepté (2026-10-08)
- Amendé par [ADR-0006](0006-quota-sans-p-throttle.md) : le quota n'utilise plus p-throttle (le texte
  ci-dessous est conservé tel qu'accepté, conformément à la règle des ADR)

## Contexte

« Une panne du fournisseur musical ou du canal de notification ne doit jamais empêcher l'envoi (un mode
dégradé est acceptable, un silence ne l'est pas). » iTunes limite à environ 20 req/min. Le réveil a une
heure précise : attendre un fournisseur en panne est aussi un échec.

## Décision

**Musique**, chaîne de responsabilité configurable (`MUSIC_PROVIDERS=itunes,musicbrainz`) :

```
FallbackMusicCatalog
 ├─ Cached( RateLimited( Resilient( ItunesMusicProvider ) ) )
 ├─ Cached( RateLimited( Resilient( MusicBrainzMusicProvider ) ) )  // MusicBrainz : 1 req/s
 └─ LocalMusicProvider                                      // toujours en dernier, ne lève jamais
```

- `Resilient` : timeout (`MUSIC_PROVIDER_TIMEOUT_MS`) + circuit breaker via **cockatiel** (MIT, zéro
  dépendance, natif TypeScript). Pas de retry à l'heure du réveil : le maillon suivant est plus rapide.
- `RateLimited` : **p-throttle** (MIT, zéro dépendance). Au-delà du budget, on échoue immédiatement
  vers le maillon suivant plutôt que de mettre en file d'attente.
- `Cached` : **lru-cache** (BlueOak-1.0.0, permissive, OSI) avec TTL. La clé est la requête normalisée.
- Le catalogue renvoie `{ track, degraded }` : `degraded` vaut `true` quand le fallback local a répondu.
  Le cas d'usage suit ce signal et ne compare jamais la source du morceau à `local` (ajout du
  2026-10-08, CA-APP-10, suite à une revue externe).
- Filet final dans le cas d'usage : `EmergencyPlaylist` si une exception remonte malgré tout.

**Notification** : `NotificationDispatcher` essaie le canal préféré, puis les autres canaux disponibles
pour lesquels l'utilisateur a une coordonnée, puis `LogChannel` (écriture fichier/console, ne lève jamais).

**Préférences** : panne ou utilisateur inconnu → préférences par défaut.

Le `WakeUpReport` expose `degraded` et la liste des tentatives, pour l'observabilité.

## Alternatives écartées

- opossum (Apache-2.0, frais) : circuit breaker seul, API orientée événements ; cockatiel couvre
  timeout + breaker + composition de politiques.
- bottleneck : dernière version **2019** → refusé (politique de fraîcheur).
- Cache maison `Map` + TTL : simple au départ, mais éviction, taille maximale et TTL sont des cas limites
  déjà résolus.

## Conséquences

Chaque scénario de panne a un test dédié. Le mode dégradé est visible (logs `warn` et rapport), jamais muet.
