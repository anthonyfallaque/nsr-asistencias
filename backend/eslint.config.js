import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Reglas del backend.
 *
 * `no-floating-promises` es la más importante aquí: una consulta sin await
 * dentro de una transacción se pierde sin dejar rastro y el COMMIT confirma
 * un trabajo que nunca ocurrió.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',

      /**
       * `checksVoidReturn.arguments` desactivado a propósito.
       *
       * Los tipos de Express 4 declaran los handlers como `void`, así que
       * pasar una función async dispara la regla 35 veces en las rutas. En
       * este proyecto es seguro: `index.ts` importa `express-async-errors`,
       * que parchea el router para capturar los rechazos y reenviarlos al
       * middleware de error. La regla no puede ver esa garantía de runtime.
       *
       * El resto de comprobaciones sigue activo, y `no-floating-promises`
       * —que es la que de verdad atrapa una consulta sin await dentro de una
       * transacción— permanece intacta.
       */
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // `declare global { namespace Express { interface Request ... } }` es
      // la forma canónica de aumentar los tipos de Express. La regla apunta
      // a los namespaces como forma de organizar código, no a esto.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },

  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },

  prettier
);
