# CLAUDE.md — Réveil musical

Guide de travail pour Claude (et pour tout développeur) sur ce dépôt. À lire avant toute modification.

## Le projet en bref

TP IMT S5 (cours : **gestion des dépendances**). Énoncé : `TP_reveil_musical.pdf`.
Un appel `triggerWakeUp(userId, dayOfWeek, weather)` choisit un morceau selon les préférences de
l'utilisateur et la météo du jour, puis le notifie sur son canal préféré. Il fonctionne **toujours**,
y compris en mode dégradé.

Critères d'évaluation : bonnes pratiques, design patterns bien choisis, architecture propre et
maintenable, intégration **raisonnée** des dépendances (sans réinventer la roue), tests avec une bonne
couverture, README des dépendances.

Documents de référence :

- `docs/PLAN.md` : plan d'action et suivi des tâches. **Cocher les tâches au fil de l'eau.**
- `docs/ACCEPTANCE_CRITERIA.md` : critères d'acceptation `CA-…` tirés de l'énoncé, **source des tests**.
- `docs/ARCHITECTURE.md` : couches, ports, flux, patterns, traçabilité des exigences.
- `docs/DEPENDENCY_POLICY.md` : procédure obligatoire avant d'ajouter une dépendance.
- `docs/adr/` : décisions d'architecture (ADR). Toute décision structurante y est consignée.
- `README.md` : présentation synthétique et gestion des dépendances (démarche, contrôles, inventaire :
  licence, version, fraîcheur, justification).
- `docs/DEMARRAGE.md` : installation, lancement et test pas à pas ; `docs/TESTS.md` : couverture et
  branches non couvertes justifiées.

## Commandes

```bash
npm install            # Node >= 24 (voir .nvmrc) ; versions figées (save-exact)
npm run dev:server     # API sur :3000 (node --watch, TypeScript exécuté nativement)
npm run dev:web        # PWA sur :5173, proxy /api -> :3000
npm test               # tests unitaires (vitest)
npm run test:coverage  # couverture (seuils : 90 % lignes/fonctions, 85 % branches)
npm run lint           # ESLint (typescript-eslint strict + règle anti-`new`)
npm run typecheck      # tsc sur chaque workspace
npm run arch:check     # règles d'architecture (dependency-cruiser)
npm run deps:licenses  # licences conformes à license-policy.json
npm run deps:audit     # npm audit filtré par audit-exceptions.json (avec expiration)
npm run deps:outdated  # fraîcheur des dépendances
npm run verify         # tout ce qui précède : à lancer avant chaque commit
```

Un test isolé : `npx vitest run packages/core/test/TriggerWakeUp.test.ts`.

## Structure

```
packages/core/          @reveil/core : domaine + application. ZÉRO dépendance runtime.
  src/domain/           types, value objects, règles métier pures (TrackSelectionPolicy…)
  src/application/      ports (interfaces) + cas d'usage (TriggerWakeUp) + NotificationDispatcher
  src/index.ts          API publique, seul point d'import autorisé
apps/server/            @reveil/server : adaptateurs, composition root, API HTTP
  src/composition/      container.ts : SEUL endroit où les implémentations concrètes sont connues
  src/config/           lecture/validation de l'environnement (zod)
  src/http/             adaptateur entrant Fastify (POST /api/wake-ups, GET /health)
  src/cli/              adaptateur entrant CLI de démonstration (npm run wake)
  src/infrastructure/   adaptateurs sortants : music/, notification/, preferences/, logging/, http/ (type HttpFetch)
apps/web/               @reveil/web : client PWA (vanilla TS + Vite), ne parle qu'à notre API
```

## Règles d'architecture (non négociables, vérifiées en CI)

1. **Aucune classe métier ne connaît un détail technique** d'un fournisseur ou d'un canal.
   `packages/core` n'importe aucun package npm ni module `node:*`. Les DTO externes (`trackViewUrl`,
   `artist-credit`…) ne sortent jamais de leur adaptateur : ils sont validés (zod) puis traduits en
   objets du domaine (anti-corruption layer).
2. **Aucun `new` sur une implémentation concrète** hors de `apps/server/src/composition/`.
   Tout passe par le conteneur awilix. La règle ESLint `no-restricted-syntax` bloque `new XxxProvider()`,
   `new XxxAdapter()`, etc. Restent autorisés : `new Error`/sous-classes d'erreur, `new Map`, `new Date`,
   `new URL`, et les value objects via leurs fabriques statiques.
3. **Dépendre d'abstractions** : les cas d'usage reçoivent des ports (interfaces de `application/ports`).
4. **Jamais de silence** : toute panne (préférences, musique, canal) mène à un mode dégradé journalisé,
   jamais à une exception non rattrapée dans le cas d'usage. Le fallback local de morceaux ne peut pas échouer.
5. Les applications importent `@reveil/core`, jamais `packages/core/src/...`.
6. Les adaptateurs `music/` et `notification/` ne s'importent pas mutuellement.

## Conventions TypeScript

- TypeScript **6.0.x** (pas 7 : typescript-eslint ne le supporte pas encore, voir ADR-0005).
- `erasableSyntaxOnly` : Node exécute le TS sans compilation. Donc **pas d'`enum`, pas de `namespace`,
  pas de propriétés de paramètres de constructeur** (`constructor(private x)`), pas de décorateurs.
  Énumérations : `export const WEATHER_TYPES = ['SOLEIL', 'PLUIE', 'NEIGE', 'NUAGEUX'] as const;`
  et `export type WeatherType = (typeof WEATHER_TYPES)[number];`.
- Imports relatifs **avec l'extension `.ts`** ; `import type` pour les types (`verbatimModuleSyntax`).
- ESM uniquement (`"type": "module"`).
- Identifiants de code en anglais, valeurs métier de l'énoncé conservées (`SOLEIL`, `PLUIE`…).
  Commentaires et documentation en français.
- Données immuables (`readonly`, `ReadonlyArray`) ; pas de `any` ; pas d'assertion `!` non justifiée.
- Un fichier = une classe/un concept, nommé comme lui (`ItunesMusicProvider.ts`).

## Injection de dépendances (awilix)

- Mode `InjectionMode.PROXY` : chaque classe reçoit un objet de dépendances typé.

  ```ts
  interface Deps {
    readonly musicCatalog: MusicCatalog;
    readonly logger: Logger;
  }
  export class TriggerWakeUp {
    readonly #musicCatalog: MusicCatalog;
    constructor({ musicCatalog }: Deps) {
      this.#musicCatalog = musicCatalog;
    }
  }
  ```

- Enregistrement **explicite** dans `container.ts` (`asClass(...).singleton()`, `asFunction`, `asValue`).
  **Ne jamais utiliser `loadModules()`** : c'est la condition de l'exception d'audit
  GHSA-vfj7-8cjw-p6xm (voir `audit-exceptions.json` et ADR-0003).
- Changer de fournisseur ou de canal = modifier la configuration (`MUSIC_PROVIDERS`) ou une ligne du
  conteneur, jamais le code métier.

## Dépendances : procédure obligatoire

Exigence légale de l'énoncé : aucun composant externe sans vérification préalable de licence et fraîcheur.
Avant tout `npm install <pkg>` :

1. Suivre la checklist de `docs/DEPENDENCY_POLICY.md` (licence autorisée, dernière version < 12 mois,
   maintenance, dépendances transitives, audit). `npm view <pkg> version license time --json`.
2. Se demander si la plateforme suffit (fetch natif, `node:test`…) : pas de dépendance pour 10 lignes,
   mais pas de réimplémentation d'un problème résolu (cache, retry, circuit breaker, validation).
3. Installer en version exacte dans le **bon workspace** (`npm i -w @reveil/server pkg@x.y.z`).
   Jamais de dépendance runtime dans `packages/core`.
4. Mettre à jour le tableau du `README.md` (et un ADR si le choix est structurant).
5. `npm run deps:licenses && npm run deps:audit` doivent passer.

npm 12 bloque les scripts d'installation par défaut (`allowScripts`) : ne pas les autoriser sans revue.

## Tests écrits en amont (obligatoire)

Les tests vérifient que **les critères de l'énoncé sont respectés**, pas que le code fait ce qu'il fait.
Ils sont donc écrits **avant** le code de production de chaque phase, à partir de
`docs/ACCEPTANCE_CRITERIA.md`, et jamais déduits de l'implémentation.

Déroulé de chaque phase :

1. **Critères** : relire les critères `CA-…` de la phase dans `docs/ACCEPTANCE_CRITERIA.md`. S'il en
   manque ou si l'un est ambigu, **s'arrêter et demander** à l'équipe ; ne pas trancher seul.
   L'équipe coche « Validé ».
2. **Tests (rouge)** : écrire les tests de la phase, un ou plusieurs par critère, nommés par l'ID
   (`it('[CA-APP-03] envoie un morceau local quand le catalogue est en panne', …)`). Seuls les ports et
   les signatures publiques nécessaires à la compilation des tests peuvent être créés à cette étape,
   **sans logique**. Lancer les tests : ils doivent **échouer pour la bonne raison** (comportement
   absent, pas une faute de frappe).
3. **Relecture humaine** des tests, puis commit séparé : `test(<scope>): critères CA-XXX-01..NN (rouge)`.
4. **Implémentation (vert)** : écrire le code minimal qui fait passer les tests, puis refactorer.
   Des tests unitaires supplémentaires peuvent être ajoutés pour les détails d'implémentation.
5. **Interdit pendant l'implémentation** : modifier, affaiblir, ignorer (`skip`, `todo`) ou supprimer un
   test d'acceptation pour le faire passer. Si un test semble faux, **s'arrêter, l'expliquer et demander**.
   Toute modification acceptée est faite dans un commit à part dont le message dit pourquoi.

Conséquence Git : le commit « rouge » de l'étape 3 ne passe pas `npm run verify`. Il n'existe que sur la
branche de la phase ; la PR n'est fusionnée que lorsque `verify` est vert.

La couverture est une **conséquence**, pas un objectif : ne pas écrire de test sans assertion
significative pour atteindre un seuil.

## Tests : conventions

- Vitest. Tests à côté du workspace : `packages/core/test/**`, `apps/server/test/**` (miroir de `src/`).
- Les doublures de test sont **écrites à la main** et implémentent les ports (pas de mock magique).
- Aucun accès réseau en test : les adaptateurs HTTP reçoivent une fonction `fetch` injectée, remplacée
  par un faux en test. Les payloads réels d'iTunes/MusicBrainz sont stockés en fixtures JSON.
- Le cas d'usage se teste avec ses ports simulés ; chaque scénario de panne de l'énoncé a son test
  (fournisseur musical en panne, tous en panne, canal en panne, préférences indisponibles).
- Horloge et temporisations injectées (`vi.useFakeTimers()` pour le rate limit et les timeouts).

## Workflow Git

- Branches `feat/…`, `fix/…`, `docs/…`, `chore/…` ; Conventional Commits (`feat(core): …`).
- `npm run verify` vert avant chaque commit, **sauf** le commit de tests rouges d'une phase (voir
  § Tests écrits en amont) ; `verify` vert obligatoire avant toute fusion.
- Une PR = une phase ou un lot cohérent de `docs/PLAN.md`.
- Ne pas committer `.env`, `logs/`, `coverage/`.

## Definition of Done (par tâche)

Critères `CA-…` validés **avant** le code · tests d'acceptation écrits et relus avant l'implémentation,
non modifiés pour passer · code · `npm run verify` vert (couverture maintenue) · documentation à jour
(PLAN coché, README si dépendance, ADR si décision) · aucune règle d'architecture contournée.
