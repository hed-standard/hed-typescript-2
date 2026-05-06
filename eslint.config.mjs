import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier/flat'
import globals from 'globals'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist/**/*'], 'Ignore Build Directory'),
  globalIgnores(['docs/**/*'], 'Ignore Documentation Directory'),
  globalIgnores(['tests/bidsDemoData/**/*'], 'Ignore BIDS Demo Data Directory'),
  globalIgnores(['tests/otherTestData/**/*'], 'Ignore Other Test Data Directory'),
  globalIgnores(['src/data/*'], 'Ignore Source Data Directory'),

  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    plugins: {
      js,
    },

    extends: ['js/recommended'],

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        __VITE_ENV__: 'readonly',
      },

      ecmaVersion: 'latest',
    },

    rules: {
      'no-console': [
        'error',
        {
          allow: ['warn'],
        },
      ],

      'guard-for-in': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'array-callback-return': 'error',
      'no-constructor-return': 'error',
      'no-duplicate-imports': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unmodified-loop-condition': 'warn',
      'no-unreachable-loop': 'error',

      'prefer-arrow-callback': [
        'error',
        {
          allowUnboundThis: false,
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    files: ['**/*.ts'],
    plugins: {
      js,
    },

    extends: [tseslint.configs.recommendedTypeChecked],

    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },

    rules: {
      'no-console': [
        'error',
        {
          allow: ['warn'],
        },
      ],

      'guard-for-in': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'array-callback-return': 'error',
      'no-constructor-return': 'error',
      'no-duplicate-imports': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unmodified-loop-condition': 'warn',
      'no-unreachable-loop': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'warn',

      'prefer-arrow-callback': [
        'error',
        {
          allowUnboundThis: false,
        },
      ],
    },
  },
  prettier,
])
