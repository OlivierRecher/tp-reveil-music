# Réveil musical

Service qui réveille chaque utilisateur avec un morceau choisi selon le jour de la semaine et la météo,
puis le notifie sur le canal de son choix (email, SMS, push), avec un **mode dégradé garanti** : une
panne d'un fournisseur ne produit jamais de silence.

TP IMT S5 : gestion des dépendances. Énoncé : [`TP_reveil_musical.pdf`](TP_reveil_musical.pdf).

## Démarrage rapide

```bash
nvm use                 # Node 26 (>= 24 requis)
npm install
cp .env.example .env    # renseigner MUSICBRAINZ_USER_AGENT avec un contact réel
npm run dev:server      # API : http://localhost:3000
npm run dev:web         # PWA : http://localhost:5173
npm run build:web       # PWA de production (manifest + service worker) dans apps/web/dist
npm run verify          # format, lint, types, architecture, tests + couverture, licences, audit
```

Déclencher un réveil sans serveur (script de démonstration ; la trace de l'envoi simulé puis le
rapport JSON sortent sur la sortie standard, le journal pino sur la sortie d'erreur ; code de sortie 1
si un argument est invalide) :

```bash
npm run wake -- --user u1 --day LUNDI --weather PLUIE
```

Par l'API HTTP :

```bash
curl -X POST http://localhost:3000/api/wake-ups \
  -H 'content-type: application/json' \
  -d '{"userId":"u1","dayOfWeek":"LUNDI","weather":"PLUIE"}'
# 200 : { userId, dayOfWeek, weather, track: { title, artist, link?, source }, trackSource,
#         deliveredVia, attempts: [{ channel, success, error? }], degraded }
# 400 : { "error": "INVALID_REQUEST", "details": [{ "field": "weather", "message": "Météo invalide…" }] }
# 500 : { "error": "INTERNAL_ERROR" } (détail uniquement dans le journal)

curl http://localhost:3000/health   # { "status": "ok" }
```

Utilisateurs du jeu de données : `u1` (EMAIL), `u2` (SMS, préférences partielles), `u3` (PUSH),
`u4` (SMS sans numéro). Jours : `LUNDI` … `DIMANCHE` ; météos : `SOLEIL`, `PLUIE`, `NEIGE`, `NUAGEUX`.

### Démontrer le mode dégradé

`SIMULATED_FAILURES` (liste séparée par virgules) met en panne des dépendances choisies, sans toucher
au code : `preferences`, `itunes`, `musicbrainz` (le `fetch` du fournisseur rejette, aucun appel
réseau), `email`, `sms`, `push` (le mock du fournisseur échoue).

```bash
SIMULATED_FAILURES=itunes,musicbrainz,email,sms,push \
  npm run wake -- --user u1 --day LUNDI --weather PLUIE
# → morceau local, remise par le canal LOG, "degraded": true, avertissements (warn) au journal
```

`MUSIC_PROVIDERS` change l'ordre ou la composition de la chaîne musicale (`musicbrainz,itunes`,
`musicbrainz`, ou vide pour le seul fallback local). Les envois simulés sont écrits dans
`NOTIFICATION_LOG_FILE` (chemin relatif au dossier `apps/server` avec les scripts npm ; `logs/` est
ignoré par git). Toutes les variables : [`.env.example`](.env.example).

## Architecture

Hexagonale (Ports & Adapters) en monorepo npm workspaces. Le noyau `@reveil/core` n'a **aucune
dépendance** ; seule la composition root (`apps/server/src/composition`) connaît les implémentations
concrètes, injectées par awilix. Détails : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) et
[ADR](docs/adr/README.md).

| Workspace       | Rôle                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| `packages/core` | domaine, ports, cas d'usage `TriggerWakeUp`, `NotificationDispatcher`        |
| `apps/server`   | adaptateurs iTunes / MusicBrainz / local, mocks de notification, API Fastify |
| `apps/web`      | client PWA de démonstration (formulaire, rapport, mode dégradé, hors ligne)  |

Suivi du projet : [`docs/PLAN.md`](docs/PLAN.md). Les tests sont écrits **avant** le code, à partir
des critères d'acceptation tirés de l'énoncé : [`docs/ACCEPTANCE_CRITERIA.md`](docs/ACCEPTANCE_CRITERIA.md).

## Tests et couverture

```bash
npm test                # 477 tests (Vitest), sans aucun accès réseau
npm run test:coverage   # + rapport texte, HTML (coverage/index.html) et lcov
```

Chacun des 49 critères `CA-DOM/APP/MUS/NOT/PRF/CMP/WEB-…` est vérifié par au moins un test portant son
ID (`grep -rhoE "\[CA-[A-Z]+-[0-9]+\]" packages/*/test apps/*/test | sort -u`) ; les critères
transverses `CA-ARC/DEP-…` le sont par l'outillage (`lint`, `arch:check`, `deps:*`).

Couverture au 2026-10-08 (seuils bloquants : 90 % lignes, fonctions et instructions, 85 % branches) :
**99,6 % lignes, 99,6 % instructions, 99,4 % fonctions, 96,7 % branches**.

Fichiers exclus de la mesure, faute de logique propre à tester unitairement :

- `apps/server/src/main.ts` et `apps/server/src/cli/wake.ts` : points d'entrée qui lisent l'environnement,
  appellent la composition root et démarrent le serveur ou impriment le rapport ; tout ce qu'ils
  assemblent (`loadConfig`, `createAppContainer`, `buildHttpServer`, `parseWakeArgs`) est testé.
- `apps/web/src/main.ts` : rendu DOM fin ; les décisions (champs, requête, validation de la réponse,
  libellés du rapport) vivent dans des fonctions pures testées. L'annonce `aria-live` et la navigation
  au clavier sont vérifiées en revue et par Lighthouse (CA-WEB-08).
- `apps/web/vite.config.ts` : configuration de build ; le manifest et les options Workbox qu'elle
  consomme sont extraits dans `apps/web/src/pwaManifest.ts` et testés (CA-WEB-07).
- `index.ts` : réexportations de l'API publique.

Branches restantes non couvertes (6 sur 184), toutes défensives et non atteignables par les tests sans
artifice :

| Fichier                                         | Branche                                                       | Pourquoi elle n'est pas testée                                                         |
| ----------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `composition/container.ts`                      | `fetch` natif par défaut quand aucun `httpFetch` n'est fourni | l'exercer ferait un appel réseau réel ; les tests injectent toujours un faux `fetch`   |
| `cli/parseWakeArgs.ts`                          | erreur de `parseArgs` qui ne serait pas une `Error`           | `node:util` ne lève que des `Error` ; garde de typage (`unknown`)                      |
| `http/wakeUpRequestSchema.ts`                   | exception non `DomainError` relancée par un parseur           | les parseurs du domaine ne lèvent que des `DomainError` ; garde contre une régression  |
| `http/buildHttpServer.ts`                       | erreur portant un `statusCode` hors 4xx (5xx)                 | même traitement que l'erreur sans statut (500 générique), testée                       |
| `infrastructure/music/LocalMusicProvider.ts` ×2 | morceau par défaut si la playlist locale était vide           | la playlist est une constante non vide : filet du « fallback qui ne peut pas échouer » |

## Dépendances

Toute dépendance est vérifiée **avant** intégration selon
[`docs/DEPENDENCY_POLICY.md`](docs/DEPENDENCY_POLICY.md) : licence (`npm run deps:licenses`, contrôle
de l'arbre complet, transitives incluses), fraîcheur (`npm run deps:outdated`), vulnérabilités
(`npm run deps:audit`). Les versions sont figées (`save-exact`) et le lockfile est commité.

Fraîcheur : 🟢 dernière stable publiée il y a moins de 12 mois · 🟠 12 à 24 mois · 🔴 plus de 24 mois.
Relevé du **2026-10-08** (`npm run deps:outdated` vide, `npm view <pkg> version time` pour chaque ligne).

### Production (`apps/server`, `apps/web`)

| Package   | Rôle                                                         | Licence       | Version installée | Dernière stable (date) | Fraîcheur | Remarque                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------ | ------------- | ----------------- | ---------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| awilix    | Conteneur IoC / DI                                           | MIT           | 13.0.5            | 13.0.5 (2026-06-15)    | 🟢        | Sans décorateurs. ⚠️ Exception d'audit GHSA-vfj7-8cjw-p6xm via `fast-glob`, non exploitable (`loadModules` jamais appelé), expire le 2027-01-08 : [ADR-0003](docs/adr/0003-conteneur-di-awilix.md) |
| fastify   | API HTTP (adaptateur entrant)                                | MIT           | 5.12.5            | 5.12.5 (2026-09-16)    | 🟢        |                                                                                                                                                                                                    |
| zod       | Validation (env, requêtes, réponses d'API) — **server, web** | MIT           | 4.6.5             | 4.6.5 (2026-09-13)     | 🟢        | Zéro dépendance. Côté web, import `zod/mini` (tree-shakable) : bundle JS 20 kB (7 kB gzip) contre 83 kB (25 kB gzip) avec `zod`, l'API suffit au schéma du rapport                                 |
| cockatiel | Timeout + circuit breaker                                    | MIT           | 4.0.0             | 4.0.0 (2026-05-26)     | 🟢        | Zéro dépendance                                                                                                                                                                                    |
| lru-cache | Cache des recherches musicales (TTL)                         | BlueOak-1.0.0 | 11.5.3            | 11.5.3 (2026-09-18)    | 🟢        | Licence peu courante mais **permissive** (approuvée OSI, sans copyleft, clause de brevets) : autorisée par la politique                                                                            |
| pino      | Logs structurés                                              | MIT           | 10.4.0            | 10.4.0 (2026-10-02)    | 🟢        | Déjà embarqué par Fastify : une seule bibliothèque de logs                                                                                                                                         |

`packages/core` : **aucune dépendance**, par construction (vérifié par dependency-cruiser).

### Développement et outillage

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

### Composants évalués et écartés

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

### API externes

| Service           | Conditions                                               | Usage                                                                                                                     |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| iTunes Search API | gratuite, sans clé, ~20 req/min                          | fournisseur musical, derrière cache + rate limit                                                                          |
| MusicBrainz API   | gratuite, `User-Agent` identifiable obligatoire, 1 req/s | fournisseur musical ; données sous licences CC0 / CC BY-NC-SA selon le jeu de données : on n'affiche que titre et artiste |
