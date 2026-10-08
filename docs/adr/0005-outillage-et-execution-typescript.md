# ADR-0005 — Outillage qualité et exécution native de TypeScript

- Statut : Accepté (2026-10-08)

## Décisions

| Besoin                  | Choix                                                     | Pourquoi / alternatives écartées                                                                                                                 |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exécution du serveur    | **Node 24+ natif** (type stripping)                       | pas de `tsx`/`ts-node`/étape de build : une dépendance de moins. Impose `erasableSyntaxOnly`.                                                    |
| Langage                 | **TypeScript 6.0.3**                                      | la 7.0.2 (portage natif) est la dernière stable, mais `typescript-eslint@8.71.1` exige `typescript <6.1.0`. On remontera quand il la supportera. |
| HTTP sortant            | **`fetch` natif**                                         | axios / node-fetch / undici inutiles ; `AbortSignal.timeout` natif.                                                                              |
| API HTTP entrante       | **Fastify 5**                                             | MIT, très actif, logger pino intégré, validation simple ; Express 5 possible mais moins typé.                                                    |
| Validation              | **zod 4**                                                 | MIT, zéro dépendance ; valide l'environnement, les requêtes HTTP et les réponses des API externes.                                               |
| Logs                    | **pino** (+ pino-pretty en dev)                           | déjà utilisé par Fastify : une seule bibliothèque de logs.                                                                                       |
| Tests et couverture     | **vitest** + `@vitest/coverage-v8`                        | TS natif, fake timers, couverture intégrée ; `node:test` envisagé, mais couverture et doublures moins confortables.                              |
| Simulation HTTP en test | **aucune bibliothèque** (`fetch` injecté)                 | msw / nock non nécessaires grâce à l'injection : moins de dépendances.                                                                           |
| Lint                    | **ESLint 10** + **typescript-eslint** (strictTypeChecked) | standard du marché.                                                                                                                              |
| Formatage               | **Prettier**                                              | standard ; pas de règles de style dans ESLint.                                                                                                   |
| Règles d'architecture   | **dependency-cruiser**                                    | rend les frontières hexagonales vérifiables en CI.                                                                                               |
| Licences                | **license-checker-rseidelsohn**                           | fork maintenu ; `license-checker` d'origine abandonné (dernière version 2019).                                                                   |
| Hooks Git               | **aucun** (CI GitHub Actions)                             | husky : dernière version 2024-11 (🟠) ; la CI suffit et `npm run verify` est documenté.                                                          |
| PWA                     | **Vite 8** + **vite-plugin-pwa** (Workbox)                | standard ; pas de framework UI : un formulaire ne justifie pas React/Vue.                                                                        |

## Conséquences

- Pas d'`enum`, de `namespace`, de propriétés de paramètres ni de décorateurs (voir CLAUDE.md).
- Imports relatifs avec l'extension `.ts`.
- npm 12 bloque les scripts d'installation non approuvés : `fsevents` (optionnel, macOS, utilisé par le
  watcher) reste bloqué sans effet fonctionnel.
