# Plan d'action — Réveil musical

Chaque tâche suit la Definition of Done de `CLAUDE.md`. Cocher `[x]` au fil de l'eau ; une PR = une
tâche ou un lot cohérent. Les phases sont ordonnées par dépendance : le noyau d'abord (tests rapides,
zéro dépendance), puis les adaptateurs, puis l'assemblage.

Légende : 🎯 exigence de l'énoncé couverte · 🧪 tests d'acceptation (écrits **avant** le code)

**Chaque phase commence par ses tests.** Les étapes 🧪 « critères » et 🧪 « tests rouges » sont
terminées et relues par l'équipe avant la première tâche d'implémentation de la phase. Les tests
viennent de `docs/ACCEPTANCE_CRITERIA.md`, jamais du code (déroulé complet dans `CLAUDE.md`,
§ Tests écrits en amont).

---

## Phase 0 — Initialisation ✅

- [x] Choix d'architecture et contre-indications PWA analysées (ADR-0001, ADR-0002)
- [x] Vérification licence et fraîcheur de toutes les dépendances candidates (README, ADR-0003 à 0005)
- [x] Monorepo npm workspaces : `packages/core`, `apps/server`, `apps/web`
- [x] Outillage : TypeScript 6.0 strict, ESLint (+ règle anti-`new`), Prettier, Vitest (+ seuils de
      couverture), dependency-cruiser (règles hexagonales), contrôle des licences, audit avec exceptions
      expirables, CI GitHub Actions
- [x] Documentation : CLAUDE.md, ARCHITECTURE, DEPENDENCY_POLICY, ADR, PLAN, README
- [x] Critères d'acceptation des phases 1 à 4 rédigés (`docs/ACCEPTANCE_CRITERIA.md`)
- [x] Premier commit d'initialisation + création du dépôt distant

## Phase 1 — Domaine (`packages/core/src/domain`)

- [x] 🧪 Critères CA-DOM-01 à 08 relus et validés par l'équipe (colonne « Validé »)
- [x] 🧪 Tests d'acceptation écrits (tests paramétrés sur les 4 météos et 7 jours, entrées
      invalides), échouant pour la bonne raison, relus, commit `test(…): … (rouge)`

Implémentation :

- [x] `WeatherType`, `DayOfWeek`, `ChannelType` (tuples `as const` + types union + gardes `isWeatherType`…)
- [x] `UserId` (value object, `parse` avec validation)
- [x] `TrackQuery` (titre + artiste optionnel, normalisation pour la clé de cache) et `Track`
      (`title`, `artist`, `link?`, `source`) avec fabrique `create`
- [x] `UserPreferences` : morceau par météo (partiel), morceau de secours, canal préféré, coordonnées
- [x] `TrackSelectionPolicy` : météo couverte → morceau dédié, sinon morceau de secours 🎯
- [x] `WakeUpMessage.compose(track, day, weather)` : message localisé (FR)
- [x] `WakeUpReport` : track, trackSource, deliveredVia, attempts, degraded
- [x] Erreurs du domaine (`DomainError` et sous-classes)

## Phase 2 — Application (`packages/core/src/application`)

> Les ports (interfaces) sont créés **pendant** l'étape des tests rouges : ce sont des contrats sans
> logique, nécessaires pour écrire les doublures.

- [x] 🧪 Critères CA-APP-01 à 09 relus et validés par l'équipe (colonne « Validé »)
- [x] 🧪 Tests d'acceptation écrits avec doublures écrites à la main ; scénarios : nominal, météo non couverte,
      préférences en panne, utilisateur inconnu, catalogue en panne, canal préféré en panne, tous les
      canaux en panne, rapport `degraded`, échouant pour la bonne raison, relus, commit
      `test(…): … (rouge)`

Implémentation :

- [x] Ports `UserPreferencesProvider`, `MusicCatalog`, `EmergencyPlaylist`, `NotificationChannel`,
      `Logger` finalisés (créés à l'étape des tests, voir ARCHITECTURE §3)
- [x] `NotificationDispatcher` : canal préféré → autres canaux disponibles → canal de dernier recours ;
      journalise chaque tentative 🎯
- [x] Cas d'usage `TriggerWakeUp` : orchestration complète, mode dégradé à chaque étape, ne lève jamais 🎯
- [x] Export de l'API publique dans `src/index.ts`

## Phase 3 — Adaptateurs d'infrastructure (`apps/server/src/infrastructure`)

Chaque sous-phase (3b, 3c, 3d) suit le même ordre : critères validés → tests rouges → implémentation.

### 3a. Configuration et transverses

- [x] 🧪 Tests rouges de CA-MUS-04 (démarrage refusé sans `User-Agent`) et de la validation de l'environnement
- [x] `config/env.ts` : schéma zod de l'environnement (`.env.example`), échec explicite au démarrage
- [x] `logging/PinoLogger` implémente `Logger`
- [x] Type `HttpFetch` (signature de `fetch`) injecté dans les adaptateurs HTTP

### 3b. Préférences (mock du service interne)

- [x] 🧪 Critères CA-PRF-01 et 02 relus et validés par l'équipe (colonne « Validé »)
- [x] 🧪 Tests d'acceptation écrits, échouant pour la bonne raison, relus, commit
      `test(…): … (rouge)`
- [x] `InMemoryUserPreferencesProvider` + jeu de données (≥ 4 utilisateurs couvrant chaque canal,
      un utilisateur sans coordonnée pour son canal préféré, un utilisateur sans morceau pour certaines météos)

### 3c. Musique 🎯

- [x] 🧪 Critères CA-MUS-01 à 12 relus et validés par l'équipe (colonne « Validé »)
- [x] 🧪 Tests d'acceptation écrits : fixtures JSON réelles (une capture iTunes et une MusicBrainz),
      réponses vides ou malformées, HTTP 503, timeout, cache, quota (fake timers), circuit ouvert, échouant pour la bonne raison, relus, commit
      `test(…): … (rouge)`

Implémentation :

- [x] `ItunesMusicProvider` : URL `search?term=…&media=music&limit=5`, schéma zod de la réponse,
      traduction `trackName/artistName/trackViewUrl` → `Track` (rien ne fuit)
- [x] `MusicBrainzMusicProvider` : `recording?query=…&fmt=json` (Lucene par champs), en-tête `User-Agent` issu de la
      config, traduction `title/artist-credit` → `Track`
- [x] `LocalMusicProvider` : liste codée en dur (≥ 1 morceau par météo), ne lève jamais ; implémente
      aussi `EmergencyPlaylist`
- [x] Décorateurs : `CachedMusicProvider` (lru-cache + TTL), `RateLimitedMusicProvider` (fenêtre
      glissante interne, échec immédiat hors budget ; p-throttle retiré, ADR-0006), `ResilientMusicProvider` (cockatiel : timeout + circuit breaker)
- [x] `FallbackMusicCatalog` (chaîne de responsabilité) implémente `MusicCatalog`

### 3d. Notifications 🎯

- [x] 🧪 Critères CA-NOT-01 à 05 relus et validés par l'équipe (colonne « Validé »)
- [x] 🧪 Tests d'acceptation écrits : succès, statut rejeté, erreur, callback en erreur, coordonnée absente, échouant pour la bonne raison, relus, commit
      `test(…): … (rouge)`

Implémentation :

- [x] Mocks « fournisseurs » aux interfaces **volontairement différentes**, écrivant dans un fichier
      de log (et la console) :
  - `FakeEmailClient.sendMail({ to, subject, html }): Promise<{ messageId }>`
  - `FakeSmsGateway.send(phoneNumber, text): Promise<{ status: 'QUEUED' | 'REJECTED' }>`
  - `FakePushService.push(deviceToken, { title, body }, callback(err))` (style callback)
  - Chaque mock peut être configuré pour simuler une panne (tests et démo)
- [x] Adaptateurs `EmailChannelAdapter`, `SmsChannelAdapter`, `PushChannelAdapter` → `NotificationChannel`
- [x] `LogChannel` : canal de dernier recours, ne lève jamais

## Phase 4 — Composition root et points d'entrée

- [ ] 🧪 Critères CA-CMP-01 à 05 relus et validés par l'équipe (colonne « Validé »)
- [ ] 🧪 Tests d'acceptation écrits : résolution par le conteneur, changement de fournisseur par
      configuration, tests HTTP via `fastify.inject()` (sans réseau), scénario « tout en panne », échouant pour la bonne raison, relus, commit
      `test(…): … (rouge)`

Implémentation :

- [ ] `composition/container.ts` : enregistrement awilix explicite (pas de `loadModules`), chaîne
      musicale construite selon `MUSIC_PROVIDERS`, registre des canaux
- [ ] `http/` : serveur Fastify, `POST /api/wake-ups` (validation zod → 400 si invalide), `GET /health`,
      gestion d'erreurs centralisée
- [ ] `main.ts` : démarrage, arrêt propre (SIGINT/SIGTERM → `container.dispose()`)
- [ ] Script CLI de démonstration : `npm run wake -- --user u1 --day LUNDI --weather PLUIE`
- [ ] Démo manuelle avec les vraies API iTunes et MusicBrainz, puis avec le réseau coupé (mode dégradé)

## Phase 5 — Client PWA (`apps/web`)

- [ ] 🧪 Rédiger les critères `CA-WEB-…` dans `docs/ACCEPTANCE_CRITERIA.md` et les faire valider
- [ ] 🧪 Tests rouges des critères comportant de la logique (appel API, rendu du rapport, erreurs réseau)

Implémentation :

- [ ] Formulaire (utilisateur, jour, météo) → `POST /api/wake-ups`, affichage du rapport (morceau,
      canal utilisé, tentatives, badge « mode dégradé »)
- [ ] Manifest + icônes, service worker (coquille hors ligne), installable (vérification Lighthouse)
- [ ] Accessibilité de base (labels, contrastes, navigation clavier)
- [ ] Ajouter `apps/web` à la couverture si de la logique non triviale y apparaît

## Phase 6 — Finalisation et livrables

- [ ] Chaque critère `CA-…` a au moins un test portant son ID (`grep -r "\[CA-" */*/test`)
- [ ] Couverture ≥ seuils ; rapport HTML relu, branches non couvertes justifiées
- [ ] `npm run deps:outdated` : mise à jour du tableau du README (versions installées et dernières stables,
      fraîcheur à la date de rendu)
- [ ] Revue des exceptions d'audit
- [ ] README : démarrage rapide, architecture résumée, exemples d'appel `curl`
- [ ] Relecture finale contre la grille : isolation, IoC (aucun `new`), patterns, tests, README des dépendances
- [ ] Tag `v1.0.0`

---

## Risques identifiés

| Risque                                                                            | Parade                                                                                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| API externes lentes ou indisponibles pendant la démo                              | fallback local + `MUSIC_PROVIDERS` configurable ; tests sans réseau                                                                  |
| Quota iTunes dépassé en développement                                             | cache + rate limit ; fixtures en test                                                                                                |
| MusicBrainz rejette les requêtes sans User-Agent                                  | variable obligatoire validée au démarrage                                                                                            |
| Dérive des versions ou nouvelle vulnérabilité avant le rendu                      | versions figées + lockfile ; CI avec audit ; revue périodique (DEPENDENCY_POLICY §6)                                                 |
| Exception d'audit awilix expirée (2027-01-08)                                     | réévaluation planifiée ; remplacement possible du conteneur grâce à l'objet `Deps`                                                   |
| Contournement involontaire de l'IoC                                               | règle ESLint + règles dependency-cruiser en CI                                                                                       |
| Tests écrits pour valider le code produit (par l'IA ou non) au lieu des exigences | tests écrits avant le code à partir des critères `CA-…`, relus, commit rouge séparé, modification interdite pendant l'implémentation |
| Ambiguïté sur le rôle du jour de la semaine                                       | hypothèse documentée (ARCHITECTURE §6), point d'extension `TrackSelectionPolicy`                                                     |
