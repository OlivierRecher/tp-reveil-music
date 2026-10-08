# ADR-0003 — Conteneur d'injection de dépendances : awilix

- Statut : Accepté (2026-10-08)

## Contexte

Exigence : « aucune implémentation concrète ne doit être instanciée (`new`) ». Il faut un conteneur IoC
compatible avec l'exécution native de TypeScript par Node (ADR-0005), qui **interdit les décorateurs**
(syntaxe non effaçable).

## Alternatives évaluées (2026-10-08)

| Candidat    | Licence | Dernière stable     | Décorateurs                              | Verdict                                            |
| ----------- | ------- | ------------------- | ---------------------------------------- | -------------------------------------------------- |
| **awilix**  | MIT     | 13.0.5 (2026-06-15) | non : injection par objet de dépendances | **retenu**                                         |
| InversifyJS | MIT     | 8.2.3 (2026-07-23)  | oui (`@injectable`, `@inject`)           | incompatible avec le type stripping                |
| tsyringe    | MIT     | 4.10.0 (2025-04-16) | oui + `reflect-metadata`                 | incompatible, moins actif                          |
| DI manuelle | —       | —                   | —                                        | réinventer gestion des cycles de vie et résolution |

## Décision

awilix en mode `InjectionMode.PROXY`, enregistrements **explicites** dans
`apps/server/src/composition/container.ts`. Une règle ESLint interdit `new` sur les classes de services
et d'adaptateurs ailleurs.

## Exception de sécurité

`npm audit` signale **GHSA-vfj7-8cjw-p6xm** (high) sur `braces`, via
`awilix → fast-glob → micromatch → braces` : déni de service avec des motifs glob profondément imbriqués.
Aucune version corrigée de `braces` n'existe à cette date.

Analyse d'exploitabilité : `fast-glob` n'est utilisé que par `awilix.loadModules()`. Notre architecture ne
l'appelle **jamais** (enregistrement explicite, règle documentée dans CLAUDE.md) et aucun motif glob ne
provient d'une entrée utilisateur. Risque jugé non exploitable.

Condition vérifiée automatiquement : test `[CA-CMP-01]` sur la composition root et, dans tout le dépôt,
règles ESLint `no-restricted-imports` (`loadModules` importé d'awilix) et `no-restricted-properties`
(`container.loadModules(...)`).

→ Exception dans `audit-exceptions.json`, **expirant le 2027-01-08**. À réévaluer : correctif publié,
nouvelle version d'awilix sans `fast-glob`, ou bascule vers une autre solution.

Revue du 2026-10-08 (phase 6) : toujours nécessaire (`braces` 3.0.3 reste la dernière version, aucune
version d'awilix sans `fast-glob` ; le « correctif » proposé par `npm audit`, awilix 6.0.0, date de 2021,
recule de sept versions majeures et dépend de `glob` 7, obsolète : 🔴 selon notre politique), exception
non expirée, condition respectée.

Outils d'exception d'audit écartés : `audit-ci` (dernière version 2024-07, dépend d'`event-stream`, connu
pour une attaque de la chaîne d'approvisionnement en 2018) et `better-npm-audit` (2024-09). Les deux sont
non frais selon notre politique ; un script de 40 lignes (`scripts/check-audit.mjs`) filtre la sortie
JSON de `npm audit` sans dépendance.

## Conséquences

- Les classes déclarent leurs dépendances via un objet typé `Deps`, découplé du conteneur : elles restent
  testables sans awilix (on passe un objet littéral de doublures).
- Le conteneur ne dépasse pas la composition root : ni le core ni les adaptateurs n'importent awilix.
