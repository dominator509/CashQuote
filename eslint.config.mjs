import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/**/*',
      'client/dist/**/*',
      'server/dist/**/*',
      'packages/shared/dist/**/*',
      'packages/db/dist/**/*',
      'node_modules/**/*',
      'client/node_modules/**/*',
      'server/node_modules/**/*',
      'packages/shared/node_modules/**/*',
      'packages/db/node_modules/**/*'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  }
);
