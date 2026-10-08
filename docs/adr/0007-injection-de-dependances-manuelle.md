# ADR-0007 — Injection de dépendances manuelle (Pure DI) à la place d'awilix

- Statut : Accepté (2026-10-08)
- Remplace : [ADR-0003](0003-conteneur-di-awilix.md)

## Contexte

L'énoncé exige l'inversion de contrôle : « aucune implémentation concrète ne doit être instanciée
(`new`) ». ADR-0003 avait retenu le conteneur **awilix** pour câbler l'application. Une fois le projet
terminé (v1.0.0), on peut mesurer ce que le conteneur apporte vraiment :

- **37 enregistrements, tous `singleton`** : aucun scope par requête, aucun cycle de vie transitoire,
  aucune résolution paresseuse utile. Tout est construit une fois au démarrage.
- Une partie du câblage était **déjà écrite à la main** dans des `asFunction` : la chaîne de décorateurs
  `Cached(RateLimited(Resilient(fournisseur)))`, les clients de notification simulés, la liste des canaux.
  awilix ne savait pas l'exprimer seul.
- Les classes ne dépendaient **pas** d'awilix : elles reçoivent un objet `Deps` typé (choix d'ADR-0003),
  utilisable aussi bien par un conteneur que par un simple appel de constructeur.
- Coût : une **exception d'audit** (GHSA-vfj7-8cjw-p6xm, `braces` via `awilix → fast-glob → micromatch`),
  sans correctif, qui expire le 2027-01-08. Elle impose aussi des garde-fous (règles ESLint et test
  contre `loadModules()`) pour une fonctionnalité qu'on n'utilise pas.
- Le typage d'awilix (`AwilixContainer<Cradle>`) n'est vérifié qu'**à l'exécution** : une dépendance
  oubliée ou mal nommée n'apparaît qu'au premier `resolve()`, pas à la compilation.

## Décision

Le câblage se fait **à la main**, dans une seule fonction, `composeApplication(config, overrides)` de
`apps/server/src/composition/compositionRoot.ts`. C'est le pattern **Composition Root** (Mark Seemann,
_Dependency Injection Principles, Practices, and Patterns_) appliqué sans conteneur, aussi appelé
**Pure DI** :

- chaque composant est construit **une seule fois** (une `const`), puis passé aux constructeurs qui en
  ont besoin via leur objet `Deps` : les singletons sont naturels, sans mécanisme dédié ;
- la fonction renvoie un objet `Application` (cas d'usage, logger, ports exposés aux tests) et une
  méthode `dispose()` qui vide le tampon de pino quand la composition root l'a créé ;
- les entrées (`main.ts`, `cli/wake.ts`) et les tests lisent des propriétés (`app.triggerWakeUp`) au
  lieu d'appeler `container.resolve('triggerWakeUp')`.

**Lecture de l'exigence « aucun `new` ».** L'inversion de contrôle ne supprime pas les `new` : elle les
**regroupe** en un seul endroit, la composition root, qui est la seule à connaître les implémentations
concrètes. Avec awilix, ces `new` étaient cachés dans `asClass` ou écrits dans des `asFunction` ; ils
sont désormais visibles, mais toujours confinés au même dossier. Le reste du code n'en contient aucun.
La règle reste vérifiée automatiquement :

- ESLint `no-restricted-syntax` interdit `new XxxProvider()`, `new XxxAdapter()`… hors de
  `apps/server/src/composition/` ;
- dependency-cruiser interdit d'importer `infrastructure/` ailleurs que dans la composition root ;
- les cas d'usage ne reçoivent que des ports (interfaces de `@reveil/core`).

awilix est **désinstallé**, l'exception d'audit est retirée, et les règles ESLint anti-`loadModules`
disparaissent.

## Alternatives écartées

| Option                    | Raison                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Conserver awilix          | Aucun service rendu au-delà du câblage manuel, une exception d'audit à renouveler, typage plus faible |
| InversifyJS, tsyringe     | Décorateurs et `reflect-metadata`, incompatibles avec l'exécution native de TypeScript (ADR-0005)     |
| typed-inject (Apache-2.0) | Sans décorateurs et typé à la compilation, mais dernière version en décembre 2024 : non frais         |
| brandi (ISC)              | Sans décorateurs et frais (5.1.0, janvier 2026), mais peu utilisé ; jetons plus verbeux que des noms  |

La politique de dépendances demande de ne pas réinventer un problème résolu. Ici, le « problème » se
limite à appeler des constructeurs dans le bon ordre : il n'y a ni graphe dynamique, ni scope, ni
chargement de modules à résoudre. C'est le cas « pas de dépendance pour quelques lignes ».

## Conséquences

- Une dépendance de production en moins et **aucune exception d'audit** en cours.
- Le câblage est **vérifié par `tsc`** : une dépendance manquante, mal nommée ou du mauvais type est une
  erreur de compilation. L'ordre de construction se lit de haut en bas.
- `compositionRoot.ts` reste du même ordre de taille qu'avant (environ 200 lignes, contre 224).
- Si l'application devait un jour gérer des scopes (une instance par requête HTTP, par utilisateur…), un
  conteneur redeviendrait pertinent : nouvel ADR à ce moment-là. Les classes n'auront pas à changer,
  puisqu'elles ne dépendent que de leur objet `Deps`.
- Changer de fournisseur ou de canal ne change pas : la configuration (`MUSIC_PROVIDERS`) ou une ligne
  de la composition root, jamais le code métier.
