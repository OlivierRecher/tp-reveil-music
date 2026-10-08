import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// Règle d'architecture n°2 de l'énoncé : aucune implémentation concrète instanciée avec `new`
// en dehors de la composition root. On cible les suffixes de nos classes de services/adaptateurs
// (`Logger`/`Log` : PinoLogger, FileNotificationLog ; `WakeUp` : le cas d'usage TriggerWakeUp).
const FORBIDDEN_NEW =
  'NewExpression[callee.name=/(Provider|Catalog|Notifier|Channel|Adapter|Client|Gateway|Service|Repository|UseCase|Dispatcher|Policy|Logger|Log|WakeUp)$/]';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/coverage/**', '**/dist/**', '**/dev-dist/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: FORBIDDEN_NEW,
          message:
            'Pas de `new` sur un service/adaptateur : construisez-le dans la composition root (apps/server/src/composition) et injectez-le.',
        },
      ],
    },
  },
  {
    files: ['apps/server/src/composition/**', '**/*.test.ts', '**/test/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly', module: 'writable' },
    },
  },
);
