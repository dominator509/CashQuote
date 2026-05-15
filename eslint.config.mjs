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
      'node_modules/**/*',
      'client/node_modules/**/*',
      'server/node_modules/**/*',
      'packages/shared/node_modules/**/*'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  }
);
