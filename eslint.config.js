import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(js.configs.recommended, {
  files: ['**/*.ts'],
  extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
  languageOptions: {
    parserOptions: {
      projectService: true,
    },
  },
  rules: {
    // node:test runs describe/it callbacks itself; awaiting them in test files is not required.
    '@typescript-eslint/no-floating-promises': [
      'error',
      {
        allowForKnownSafeCalls: [
          { from: 'package', name: ['describe', 'it', 'test'], package: 'node:test' },
        ],
      },
    ],
  },
});
