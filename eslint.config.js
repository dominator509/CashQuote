const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = [
  {
    ignores: [
      'client/dist/**',
      'coverage/**',
      'dist/**',
      'eslint.config.js',
      'jest.config.js',
      'node_modules/**',
      'packages/**/dist/**',
      'server/dist/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
