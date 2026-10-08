# Tests et couverture — Réveil musical

Les tests sont écrits **avant** le code, à partir des critères d'acceptation tirés de l'énoncé
([`ACCEPTANCE_CRITERIA.md`](ACCEPTANCE_CRITERIA.md)). Démarche détaillée : [`CLAUDE.md`](../CLAUDE.md#tests-écrits-en-amont-obligatoire).

## Lancer les tests

```bash
npm test                # 475 tests (Vitest), sans aucun accès réseau
npm run test:coverage   # + rapport texte, HTML (coverage/index.html) et lcov
```

## Traçabilité

Chacun des 51 critères `CA-DOM/APP/MUS/NOT/PRF/CMP/WEB-…` est vérifié par au moins un test portant son
ID (`grep -rhoE "\[CA-[A-Z]+-[0-9]+\]" packages/*/test apps/*/test | sort -u`) ; les critères
transverses `CA-ARC/DEP-…` le sont par l'outillage (`lint`, `arch:check`, `deps:*`).

## Couverture

Couverture au 2026-10-08 (seuils bloquants : 90 % lignes, fonctions et instructions, 85 % branches) :
**99,8 % lignes, 99,6 % instructions, 99,4 % fonctions, 96,8 % branches**.

Fichiers exclus de la mesure, faute de logique propre à tester unitairement :

- `apps/server/src/main.ts` et `apps/server/src/cli/wake.ts` : points d'entrée qui lisent l'environnement,
  appellent la composition root et démarrent le serveur ou impriment le rapport ; tout ce qu'ils
  assemblent (`loadConfig`, `composeApplication`, `buildHttpServer`, `parseWakeArgs`) est testé.
- `apps/web/src/main.ts` : rendu DOM fin ; les décisions (champs, requête, validation de la réponse,
  libellés du rapport) vivent dans des fonctions pures testées. L'annonce `aria-live` et la navigation
  au clavier sont vérifiées en revue et par Lighthouse (CA-WEB-08).
- `apps/web/vite.config.ts` : configuration de build ; le manifest et les options Workbox qu'elle
  consomme sont extraits dans `apps/web/src/pwaManifest.ts` et testés (CA-WEB-07).
- `index.ts` : réexportations de l'API publique.

Branches restantes non couvertes (6 sur 186), toutes défensives et non atteignables par les tests sans
artifice :

| Fichier                                         | Branche                                                       | Pourquoi elle n'est pas testée                                                         |
| ----------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `composition/compositionRoot.ts`                | `fetch` natif par défaut quand aucun `httpFetch` n'est fourni | l'exercer ferait un appel réseau réel ; les tests injectent toujours un faux `fetch`   |
| `cli/parseWakeArgs.ts`                          | erreur de `parseArgs` qui ne serait pas une `Error`           | `node:util` ne lève que des `Error` ; garde de typage (`unknown`)                      |
| `http/wakeUpRequestSchema.ts`                   | exception non `DomainError` relancée par un parseur           | les parseurs du domaine ne lèvent que des `DomainError` ; garde contre une régression  |
| `http/buildHttpServer.ts`                       | erreur portant un `statusCode` hors 4xx (5xx)                 | même traitement que l'erreur sans statut (500 générique), testée                       |
| `infrastructure/music/LocalMusicProvider.ts` ×2 | morceau par défaut si la playlist locale était vide           | la playlist est une constante non vide : filet du « fallback qui ne peut pas échouer » |
