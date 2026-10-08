/**
 * Règles d'architecture hexagonale vérifiées automatiquement (`npm run arch:check`).
 * Voir docs/ARCHITECTURE.md pour la justification de chaque règle.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-has-no-external-dependency',
      comment:
        'Le noyau métier ne dépend d’aucun package npm ni module Node : il ne connaît aucun détail technique.',
      severity: 'error',
      from: { path: '^packages/core/src' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'core'] },
    },
    {
      name: 'core-does-not-know-apps',
      severity: 'error',
      from: { path: '^packages/core' },
      to: { path: '^apps/' },
    },
    {
      name: 'domain-does-not-know-application',
      comment: 'Le domaine est le cœur : il ne dépend pas des cas d’usage ni des ports.',
      severity: 'error',
      from: { path: '^packages/core/src/domain' },
      to: { path: '^packages/core/src/application' },
    },
    {
      name: 'apps-use-core-public-api-only',
      comment: 'Les applications importent `@reveil/core`, jamais ses fichiers internes.',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^packages/core/src/(?!index\\.ts$)' },
    },
    {
      name: 'infrastructure-only-wired-by-composition-root',
      comment: 'Seule la composition root connaît les implémentations concrètes (IoC).',
      severity: 'error',
      from: { path: '^apps/server/src/(?!composition/|infrastructure/)', pathNot: '\\.test\\.ts$' },
      to: { path: '^apps/server/src/infrastructure/' },
    },
    {
      name: 'music-and-notification-adapters-are-isolated',
      severity: 'error',
      from: { path: '^apps/server/src/infrastructure/music/' },
      to: { path: '^apps/server/src/infrastructure/notification/' },
    },
    {
      name: 'notification-and-music-adapters-are-isolated',
      severity: 'error',
      from: { path: '^apps/server/src/infrastructure/notification/' },
      to: { path: '^apps/server/src/infrastructure/music/' },
    },
    {
      name: 'web-client-does-not-import-server',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^apps/server/' },
    },
    {
      name: 'web-client-does-not-import-core',
      comment:
        'La PWA ne parle qu’à l’API HTTP (ADR-0001) : elle ne partage aucun code avec le noyau.',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^packages/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|coverage|dist|dev-dist)' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'default'] },
  },
};
