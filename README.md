# Réveil musical

Service qui réveille chaque utilisateur avec un morceau choisi selon **la météo du jour**, puis le
prévient sur **son canal préféré** (email, SMS, push). Une panne d'un fournisseur ne produit jamais de
silence : le service bascule en **mode dégradé**, le journalise et le signale.

TP IMT S5, cours de **gestion des dépendances**. Énoncé : [`TP_reveil_musical.pdf`](TP_reveil_musical.pdf).

| Pour…                                     | Lire                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| installer, lancer et tester pas à pas     | [`docs/DEMARRAGE.md`](docs/DEMARRAGE.md)                                                       |
| comprendre l'architecture et les patterns | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                                 |
| connaître les décisions et leurs raisons  | [`docs/adr/`](docs/adr/README.md) (ADR-0001 à 0006)                                            |
| ajouter une dépendance                    | [`docs/DEPENDENCY_POLICY.md`](docs/DEPENDENCY_POLICY.md)                                       |
| savoir ce que les tests prouvent          | [`docs/ACCEPTANCE_CRITERIA.md`](docs/ACCEPTANCE_CRITERIA.md), [`docs/TESTS.md`](docs/TESTS.md) |
| suivre l'avancement                       | [`docs/PLAN.md`](docs/PLAN.md)                                                                 |
| contribuer (règles, conventions)          | [`CLAUDE.md`](CLAUDE.md)                                                                       |

## Ce que fait le service

Un seul appel, `triggerWakeUp(userId, dayOfWeek, weather)`, exposé par une API HTTP
(`POST /api/wake-ups`), un script CLI (`npm run wake`) et un client PWA de démonstration :

1. **Préférences** : lit les goûts de l'utilisateur (un morceau par météo, un morceau de secours, un canal).
2. **Sélection** : règle métier pure, le morceau associé à la météo, sinon le morceau de secours.
3. **Résolution** : cherche le morceau chez iTunes, puis MusicBrainz, puis dans une playlist locale.
4. **Notification** : envoie le message sur le canal préféré, puis les autres, puis le journal.
5. **Rapport** : morceau, source, canal utilisé, chaque tentative et l'indicateur `degraded`.

Chaque panne prévue par l'énoncé a sa réponse, testée et démontrable sans toucher au code
(`SIMULATED_FAILURES`, voir [`docs/DEMARRAGE.md`](docs/DEMARRAGE.md#démontrer-le-mode-dégradé)) :

| Panne                                 | Réponse                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| service de préférences                | préférences par défaut, remise par le canal `LOG`                     |
| un fournisseur musical                | fournisseur suivant de la chaîne (cache, quota, timeout, disjoncteur) |
| tous les fournisseurs                 | playlist locale, qui ne peut pas échouer                              |
| canal préféré (ou coordonnée absente) | autres canaux de l'utilisateur, puis `LOG` en dernier recours         |

## Démarrage express

Node.js 24 ou plus (voir `.nvmrc`).

```bash
npm install
cp .env.example .env    # renseigner MUSICBRAINZ_USER_AGENT avec une adresse de contact réelle
npm run dev:server      # terminal 1 — API sur http://localhost:3000
npm run dev:web         # terminal 2 — PWA sur http://localhost:5173 (utilisateurs u1 à u4)
npm run verify          # format, lint, types, architecture, tests + couverture, licences, audit
```

Avertissements attendus à l'installation, jeu de données, appels `curl`, CLI et démonstration du mode
dégradé : [`docs/DEMARRAGE.md`](docs/DEMARRAGE.md).

## Architecture en bref

Hexagonale (Ports & Adapters) dans un monorepo npm workspaces. Le métier ne dépend de rien ; tout le
reste dépend de lui.

```
apps/web (PWA) ── HTTP ──► apps/server
                           ├─ http/, cli/          adaptateurs entrants
                           │        │ appellent
                           │        ▼
                           │  packages/core        domaine + cas d'usage, aucune dépendance npm
                           │        ▲ implémentent ses ports
                           │        │
                           ├─ infrastructure/      iTunes, MusicBrainz, local, canaux, logs
                           └─ composition/         seul endroit qui connaît les classes concrètes (awilix)
```

| Workspace       | Rôle                                                                         | Dépendances runtime                              |
| --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `packages/core` | domaine, ports, cas d'usage `TriggerWakeUp`, `NotificationDispatcher`        | **aucune** (vérifié par dependency-cruiser)      |
| `apps/server`   | adaptateurs iTunes / MusicBrainz / local, mocks de notification, API Fastify | awilix, fastify, zod, cockatiel, lru-cache, pino |
| `apps/web`      | client PWA de démonstration (formulaire, rapport, mode dégradé, hors ligne)  | zod (`zod/mini`)                                 |

Patterns : Adapter (anti-corruption des API), Decorator (cache, quota, résilience), Chain of
Responsibility (fallbacks), Strategy (sélection), Registry (canaux), injection de dépendances. Changer de
fournisseur musical = modifier `MUSIC_PROVIDERS` ; ajouter un canal = un adaptateur et une ligne
d'enregistrement. Détails, flux complet et traçabilité des exigences :
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Qualité et tests

Les tests sont écrits **avant** le code, à partir de 49 critères d'acceptation tirés de l'énoncé
(`[CA-APP-03] envoie un morceau local quand le catalogue est en panne`…). 477 tests Vitest, sans aucun
accès réseau (le `fetch` est injecté, les réponses réelles d'iTunes et MusicBrainz sont des fixtures).
Couverture : **99,6 % lignes, 96,7 % branches** (seuils bloquants 90 / 85 %). La CI GitHub Actions
rejoue `npm run verify` à chaque PR. Détails et branches non couvertes justifiées :
[`docs/TESTS.md`](docs/TESTS.md).

## Gestion des dépendances

L'énoncé pose une exigence légale : _« aucun composant externe ne doit être intégré sans vérification
préalable de sa licence et de sa fraîcheur »_. Le projet y répond par une démarche (quand prendre une
dépendance), une procédure (comment la vérifier) et des contrôles automatiques (comment s'assurer
qu'elle reste conforme).

### 1. Prendre une dépendance… ou pas

La question n'est pas « existe-t-il un paquet ? », mais « le problème justifie-t-il le coût d'une
dépendance ? » (licence à suivre, mises à jour, surface d'attaque, dépendances transitives). Grille
appliquée ([`DEPENDENCY_POLICY.md` § 1](docs/DEPENDENCY_POLICY.md#1-faut-il-une-dépendance-)) :

| Situation                                | Décision                  | Exemples dans le projet                                                                        |
| ---------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| la plateforme le fait déjà               | **pas de dépendance**     | `fetch` natif (pas d'axios), TypeScript exécuté par Node (pas de tsx), `node:util.parseArgs`   |
| quelques lignes sans piège               | **pas de dépendance**     | quota à fenêtre glissante ([ADR-0006](docs/adr/0006-quota-sans-p-throttle.md)), script d'audit |
| problème connu et piégeux                | **bibliothèque éprouvée** | cache LRU/TTL, circuit breaker, validation de schéma, conteneur DI, serveur HTTP, logs         |
| besoin limité aux tests ou à l'outillage | **devDependency**         | Vitest, ESLint, Vite, dependency-cruiser                                                       |
| code métier                              | **jamais**                | `packages/core` n'a aucune dépendance : le métier survit à tout changement de bibliothèque     |

Résultat : **6 dépendances de production** côté serveur, 1 côté web, chacune répondant à un besoin
précis :

| Besoin (exigence)                                                       | Choix         | Pourquoi celle-ci                                                                                    |
| ----------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| aucun `new` d'implémentation concrète hors composition root             | **awilix**    | IoC sans décorateurs, compatible avec l'exécution native de TypeScript (InversifyJS, tsyringe : non) |
| exposer le cas d'usage en HTTP                                          | **fastify**   | performant, très maintenu, journalisation pino intégrée                                              |
| ne jamais laisser une donnée externe non vérifiée entrer dans le métier | **zod**       | zéro dépendance, typage inféré ; `zod/mini` côté web divise le bundle par 4                          |
| ne pas attendre un fournisseur en panne à l'heure du réveil             | **cockatiel** | timeout + circuit breaker en une bibliothèque sans dépendance (opossum : valable, mais plus lourd)   |
| iTunes limité à ~20 req/min                                             | **lru-cache** | cache avec TTL de référence ; évite de rappeler l'API pour un même morceau                           |
| journaliser chaque bascule en mode dégradé                              | **pino**      | logs structurés JSON ; déjà présent via Fastify, donc aucune bibliothèque de plus                    |

### 2. Vérifier avant d'installer

Chaque ajout suit la checklist de [`DEPENDENCY_POLICY.md` § 2](docs/DEPENDENCY_POLICY.md#2-checklist-de-vérification-à-recopier-dans-la-pr),
recopiée dans la PR : besoin et au moins deux alternatives comparées, licence, fraîcheur, maintenance,
poids des transitives, compatibilité, audit, scripts d'installation.

- **Licence** : autorisées partout (MIT, ISC, Apache-2.0, BSD, BlueOak…), tolérées pour l'outillage
  seulement (MPL-2.0, CC-BY…), interdites (GPL, AGPL, LGPL, SSPL, sans licence…). Le copyleft
  imposerait de publier notre code. Liste exécutable : [`license-policy.json`](license-policy.json).
- **Fraîcheur** : 🟢 dernière stable publiée il y a moins de 12 mois · 🟠 12 à 24 mois, justification
  obligatoire · 🔴 plus de 24 mois ou dépôt archivé, refusé sauf dérogation par ADR.
- **Choix structurant** : consigné dans un [ADR](docs/adr/README.md) (contexte, alternatives,
  conséquences).

### 3. Installer de façon reproductible

- Versions **exactes** (`save-exact=true` dans `.npmrc`) et `package-lock.json` commité : deux
  installations donnent le même arbre, et toute montée de version est un acte volontaire et relu.
- `engine-strict=true` : l'installation refuse une version de Node non supportée.
- Chaque dépendance dans **le bon workspace** (`npm i -w @reveil/server pkg@x.y.z`), en
  `devDependencies` quand elle ne sert qu'au build ou aux tests.
- Scripts d'installation bloqués par défaut (npm 12) : aucun n'est autorisé sans revue.

### 4. Contrôler en continu

Les règles ne reposent pas sur la bonne volonté : elles sont exécutées par `npm run verify` et par la CI
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) à chaque PR.

| Contrôle                     | Commande                | Outil                                                                                    | Échoue si…                                                                      |
| ---------------------------- | ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| licences de **tout** l'arbre | `npm run deps:licenses` | [`scripts/check-licenses.mjs`](scripts/check-licenses.mjs) + license-checker-rseidelsohn | une licence interdite, inconnue, ou réservée à l'outillage arrive en production |
| vulnérabilités               | `npm run deps:audit`    | [`scripts/check-audit.mjs`](scripts/check-audit.mjs) sur `npm audit`                     | une faille high/critical sans exception valide, ou une exception expirée        |
| fraîcheur                    | `npm run deps:outdated` | `npm outdated`                                                                           | (informatif) revu à chaque phase, reporté dans les tableaux ci-dessous          |
| isolation du métier          | `npm run arch:check`    | dependency-cruiser ([`.dependency-cruiser.cjs`](.dependency-cruiser.cjs))                | `packages/core` importe un paquet npm ou un module `node:*`                     |
| bibliothèques confinées      | `npm run lint`          | ESLint (`no-restricted-syntax`)                                                          | un `new XxxProvider()` apparaît hors de la composition root                     |

Le contrôle des licences distingue production et outillage grâce à `npm query .prod` : une licence
MPL-2.0 est acceptée dans Vite, pas dans ce qui est livré.

### 5. Cas concrets rencontrés

Les règles ont été confrontées à de vraies situations, chacune tracée :

- **Exception d'audit datée** — `npm install` signale 4 vulnérabilités _high_ : `braces` (DoS sur des
  motifs glob), embarqué par awilix via `fast-glob`. Aucune version corrigée n'existe. Analyse : ce code
  n'est atteint que par `awilix.loadModules()`, que l'architecture n'appelle jamais (enregistrement
  explicite, règle inscrite dans `CLAUDE.md`). L'exception est acceptée dans
  [`audit-exceptions.json`](audit-exceptions.json) avec une **date d'expiration** (2027-01-08) : passé
  cette date, la CI échoue et la décision doit être réévaluée.
  [ADR-0003](docs/adr/0003-conteneur-di-awilix.md). Ne pas lancer `npm audit fix --force`.
- **Dernière version non retenue** — TypeScript 7 est sorti, mais typescript-eslint exige `<6.1.0` :
  le projet reste volontairement en 6.0.3, et documente pourquoi.
  [ADR-0005](docs/adr/0005-outillage-et-execution-typescript.md).
- **Dépendance retirée après coup** — p-throttle (MIT, fraîche) a été installée pour le quota iTunes,
  puis désinstallée : elle met les appels en file d'attente au lieu d'échouer tout de suite, ce qui
  retarderait le réveil au lieu de basculer sur le fournisseur suivant. Une fenêtre glissante de
  quelques lignes la remplace. [ADR-0006](docs/adr/0006-quota-sans-p-throttle.md).
- **Licence peu courante** — lru-cache est sous BlueOak-1.0.0 : vérifiée (permissive, approuvée OSI,
  clause de brevets), puis ajoutée explicitement à la politique plutôt que tolérée en silence.
- **Fork maintenu plutôt qu'original abandonné** — license-checker (🔴 2019) remplacé par
  license-checker-rseidelsohn.
- **Risque de chaîne d'approvisionnement** — audit-ci (🟠) dépend d'`event-stream`, compromis en 2018 :
  écarté au profit d'un script interne de 40 lignes.
- **Poids du bundle** — côté web, `zod/mini` au lieu de `zod` : 7 kB gzip au lieu de 25 kB, pour la même
  validation du rapport.

### 6. Inventaire

Relevé du **2026-10-08** (`npm run deps:outdated` vide, `npm view <pkg> version time` pour chaque ligne).
Fraîcheur : 🟢 moins de 12 mois · 🟠 12 à 24 mois · 🔴 plus de 24 mois.

#### Production (`apps/server`, `apps/web`)

| Package   | Rôle                                                         | Licence       | Version installée | Dernière stable (date) | Fraîcheur | Remarque                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------ | ------------- | ----------------- | ---------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| awilix    | Conteneur IoC / DI                                           | MIT           | 13.0.5            | 13.0.5 (2026-06-15)    | 🟢        | Sans décorateurs. ⚠️ Exception d'audit GHSA-vfj7-8cjw-p6xm via `fast-glob`, non exploitable (`loadModules` jamais appelé), expire le 2027-01-08 : [ADR-0003](docs/adr/0003-conteneur-di-awilix.md) |
| fastify   | API HTTP (adaptateur entrant)                                | MIT           | 5.12.5            | 5.12.5 (2026-09-16)    | 🟢        |                                                                                                                                                                                                    |
| zod       | Validation (env, requêtes, réponses d'API) — **server, web** | MIT           | 4.6.5             | 4.6.5 (2026-09-13)     | 🟢        | Zéro dépendance. Côté web, import `zod/mini` (tree-shakable) : bundle JS 20 kB (7 kB gzip) contre 83 kB (25 kB gzip) avec `zod`, l'API suffit au schéma du rapport                                 |
| cockatiel | Timeout + circuit breaker                                    | MIT           | 4.0.0             | 4.0.0 (2026-05-26)     | 🟢        | Zéro dépendance                                                                                                                                                                                    |
| lru-cache | Cache des recherches musicales (TTL)                         | BlueOak-1.0.0 | 11.5.3            | 11.5.3 (2026-09-18)    | 🟢        | Licence peu courante mais **permissive** (approuvée OSI, sans copyleft, clause de brevets) : autorisée par la politique                                                                            |
| pino      | Logs structurés                                              | MIT           | 10.4.0            | 10.4.0 (2026-10-02)    | 🟢        | Déjà embarqué par Fastify : une seule bibliothèque de logs                                                                                                                                         |

`packages/core` : **aucune dépendance**, par construction (vérifié par dependency-cruiser).

#### Développement et outillage

| Package                     | Workspace | Rôle                             | Licence      | Version installée  | Dernière stable (date) | Fraîcheur | Remarque                                                                                                                      |
| --------------------------- | --------- | -------------------------------- | ------------ | ------------------ | ---------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| typescript                  | racine    | Typage, typecheck                | Apache-2.0   | 6.0.3 (2026-04-16) | **7.0.2** (2026-07-08) | 🟢        | ⚠️ Volontairement en 6.0 : `typescript-eslint` exige `<6.1.0`. [ADR-0005](docs/adr/0005-outillage-et-execution-typescript.md) |
| @types/node                 | racine    | Types Node                       | MIT          | 26.6.4             | 26.6.4 (2026-10-01)    | 🟢        |                                                                                                                               |
| eslint                      | racine    | Lint                             | MIT          | 10.12.0            | 10.12.0 (2026-10-02)   | 🟢        |                                                                                                                               |
| @eslint/js                  | racine    | Règles recommandées ESLint       | MIT          | 10.0.1             | 10.0.1 (2026-02-06)    | 🟢        |                                                                                                                               |
| typescript-eslint           | racine    | Lint TypeScript typé             | MIT          | 8.71.1             | 8.71.1 (2026-10-05)    | 🟢        |                                                                                                                               |
| prettier                    | racine    | Formatage                        | MIT          | 3.9.9              | 3.9.9 (2026-09-23)     | 🟢        |                                                                                                                               |
| vitest                      | racine    | Tests unitaires                  | MIT          | 5.0.3              | 5.0.3 (2026-09-30)     | 🟢        |                                                                                                                               |
| @vitest/coverage-v8         | racine    | Couverture                       | MIT          | 5.0.3              | 5.0.3 (2026-09-30)     | 🟢        |                                                                                                                               |
| dependency-cruiser          | racine    | Règles d'architecture            | MIT          | 18.5.0             | 18.5.0 (2026-09-30)    | 🟢        |                                                                                                                               |
| license-checker-rseidelsohn | racine    | Contrôle des licences            | BSD-3-Clause | 5.0.1              | 5.0.1 (2026-05-27)     | 🟢        | Fork maintenu de `license-checker` (abandonné en 2019)                                                                        |
| pino-pretty                 | server    | Logs lisibles en dev             | MIT          | 13.2.0             | 13.2.0 (2026-10-04)    | 🟢        |                                                                                                                               |
| vite                        | web       | Build et serveur de dev          | MIT          | 8.3.3              | 8.3.3 (2026-10-06)     | 🟢        |                                                                                                                               |
| vite-plugin-pwa             | web       | Manifest + service worker        | MIT          | 2.0.0              | 2.0.0 (2026-10-03)     | 🟢        | S'appuie sur Workbox (Google, MIT)                                                                                            |
| workbox-window              | web       | Enregistrement du service worker | MIT          | 7.4.1              | 7.4.1 (2026-05-04)     | 🟢        | Pair requis par vite-plugin-pwa                                                                                               |

**Dépendances transitives** (654 paquets analysés au 2026-10-08, dont 68 de production) : toutes conformes à
`license-policy.json`. En production : MIT, ISC, BSD-3-Clause et BlueOak-1.0.0 (famille `lru-cache`)
uniquement. Seuls des outils de développement embarquent des licences autorisées hors produit livré :
`MPL-2.0` (`lightningcss`, via Vite : copyleft faible au niveau du fichier, sans effet sur notre code
puisque non modifié et non distribué), `CC-BY-3.0`/`CC-BY-4.0` (données SPDX et `caniuse-lite`).
`fsevents` (optionnel, macOS) a un script d'installation bloqué par npm 12 : aucun effet fonctionnel.

### 7. Composants évalués et écartés

| Composant                  | Raison                                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript 7.0             | incompatible avec typescript-eslint à ce jour (voir ci-dessus)                                                                                                                                     |
| InversifyJS, tsyringe      | décorateurs, incompatibles avec l'exécution native de TypeScript ; tsyringe moins actif (2025-04)                                                                                                  |
| bottleneck                 | 🔴 dernière version en 2019                                                                                                                                                                        |
| p-throttle                 | 🟢 frais (MIT) mais met les appels en file au lieu d'échouer immédiatement hors quota ; désinstallé au profit d'une fenêtre glissante interne : [ADR-0006](docs/adr/0006-quota-sans-p-throttle.md) |
| license-checker            | 🔴 dernière version en 2019 (remplacé par son fork maintenu)                                                                                                                                       |
| audit-ci, better-npm-audit | 🟠 dernières versions en 2024 ; audit-ci dépend d'`event-stream` (incident de supply chain en 2018) → script interne de 40 lignes                                                                  |
| husky / lint-staged        | husky 🟠 (2024-11) ; la CI et `npm run verify` suffisent                                                                                                                                           |
| axios, node-fetch          | `fetch` natif suffisant                                                                                                                                                                            |
| tsx, ts-node               | Node exécute TypeScript nativement                                                                                                                                                                 |
| msw, nock                  | inutiles : `fetch` est injecté dans les adaptateurs                                                                                                                                                |
| opossum                    | valable (Apache-2.0, frais) mais cockatiel couvre timeout + breaker sans dépendance                                                                                                                |
| React / Vue                | surdimensionné pour un formulaire de démonstration                                                                                                                                                 |

### 8. API externes

| Service           | Conditions                                               | Usage                                                                                                                     |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| iTunes Search API | gratuite, sans clé, ~20 req/min                          | fournisseur musical, derrière cache + rate limit                                                                          |
| MusicBrainz API   | gratuite, `User-Agent` identifiable obligatoire, 1 req/s | fournisseur musical ; données sous licences CC0 / CC BY-NC-SA selon le jeu de données : on n'affiche que titre et artiste |
