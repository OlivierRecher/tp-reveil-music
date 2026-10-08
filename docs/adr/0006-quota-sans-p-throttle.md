# ADR-0006 — Quota des fournisseurs musicaux sans p-throttle

- Statut : Accepté (2026-10-08)
- Amende : [ADR-0004](0004-resilience-et-mode-degrade.md) (choix de la bibliothèque du décorateur `RateLimited`)

## Contexte

ADR-0004 prévoit un décorateur `RateLimitedMusicProvider` fondé sur **p-throttle** et exige qu'au-delà
du budget (iTunes ~20 req/min) l'appel **échoue immédiatement** vers le maillon suivant de la chaîne,
plutôt que d'attendre : le réveil a une heure précise (critère CA-MUS-10).

Lecture du code de `p-throttle@8.1.1` (`node_modules/p-throttle/index.js`) pendant l'implémentation :

- p-throttle est conçu pour **retarder** les appels, pas pour les refuser. Le délai est calculé par
  `getDelay()` (`windowedDelay` ou `strictDelay`) **avant** toute notification, puis l'appel est placé
  dans une file (`setTimeout`).
- Ce calcul **réserve déjà la place** : en mode fenêtré, `currentTick` avance d'un intervalle et
  `activeWeight` est compté ; en mode strict, un horodatage futur est ajouté à `strictTicks`. Un appel
  mis en file consomme donc le budget de la fenêtre suivante, même s'il est abandonné ensuite.
- `onDelay` n'est qu'une notification (ses exceptions sont avalées) : il ne peut pas annuler l'appel.
- Le seul moyen d'annuler est le `signal` (`AbortSignal`) donné à la construction : il rejette **toute**
  la file et **remet le compteur à zéro** (`currentTick = 0`, `activeWeight = 0`, `strictTicks` vidé).
  L'utiliser pour refuser un appel ferait perdre la comptabilité du quota, et il faudrait recréer le
  limiteur (et un nouveau signal) à chaque refus.

Obtenir un « échec immédiat sans consommer de budget » avec p-throttle demande donc de contourner son
modèle ; le besoin réel, lui, tient en une dizaine de lignes.

## Décision

`RateLimitedMusicProvider` implémente une **fenêtre glissante minimale** : il conserve les horodatages
(`Date.now()`) des appels acceptés durant les `intervalMs` dernières millisecondes. Si `maxRequests`
y figurent déjà, l'appel est rejeté aussitôt par `MusicProviderUnavailableError` (motif « quota de
requêtes atteint ») sans atteindre le fournisseur, et **n'est pas compté**. Sinon il est horodaté et
transmis.

p-throttle est **désinstallé** (`apps/server/package.json`, lockfile) et retiré de l'inventaire du README.

Ce n'est pas « réinventer la roue » au sens de la politique de dépendances : aucune bibliothèque fraîche
ne fournit ce comportement tel quel, l'algorithme est trivial (pas d'éviction, de concurrence ni de
persistance), et il est couvert par les tests d'acceptation CA-MUS-10 sous horloge simulée.

## Alternatives écartées

- **p-throttle + `onDelay` / `signal`** : `onDelay` ne peut pas annuler ; `signal` annule toute la file
  et réinitialise le quota ; l'appel en file a déjà réservé le budget de la fenêtre suivante. Le résultat
  serait plus long et plus fragile que la fenêtre glissante, pour une dépendance de plus.
- **p-throttle avec un compteur maison à côté** (refuser avant d'appeler le limiteur) : la logique de
  refus serait de toute façon maison, p-throttle n'apporterait plus rien.
- **bottleneck** (qui sait rejeter via `highWater`/`strategy`) : dernière version publiée en **2019**,
  refusé par la politique de fraîcheur (déjà écarté par ADR-0004).
- **Laisser le circuit breaker gérer le 403 d'iTunes** : on dépasserait d'abord le quota, ce que
  l'énoncé demande précisément d'éviter.

## Conséquences

- Une dépendance de production en moins (surface d'audit et de licences réduite).
- Le quota est **par instance** du décorateur et en mémoire : suffisant pour un serveur unique. Un
  déploiement multi-instances demanderait un quota partagé (Redis…) : nouvel ADR le cas échéant.
- Les horodatages viennent de `Date.now()`, simulé par `vi.useFakeTimers()` : les tests de quota
  n'attendent jamais réellement.
- La mémoire est bornée par `maxRequests` horodatages.
