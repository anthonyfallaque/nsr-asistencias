import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

/**
 * Las reglas no están para imponer un estilo: `eslint-config-prettier`
 * desactiva todo lo cosmético al final, porque el formato lo decide
 * Prettier y discutirlo dos veces solo genera ruido.
 *
 * Lo que queda son reglas que atrapan defectos reales — y en particular las
 * de accesibilidad, que existen para que el trabajo hecho sobre etiquetas,
 * roles y foco no se erosione con el próximo componente que alguien añada
 * con prisa.
 */
export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Un `any` en el borde de la API es justo donde el tipado deja de
      // servir: es el patrón que llenó el código anterior de `as Alumna[]`.
      '@typescript-eslint/no-explicit-any': 'error',

      // Una promesa sin await en un manejador de eventos falla en silencio.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // `??` en lugar de `||` evita tratar 0 y '' como ausencia de valor.
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
    ...tseslint.configs.disableTypeChecked,
  },

  prettier
);
