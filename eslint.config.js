const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  prettier,
  {
    ignores: ['node_modules/**'],
  },
  {
    // Node backend code (node helper + driver modules)
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // MagicMirror frontend module — runs in the browser/Electron renderer
    files: ['MMM-CECControl.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        Module: 'readonly',
        Log: 'readonly',
      },
    },
  },
  {
    // Vitest test files (ESM)
    files: ['spec/**/*.{js,mjs}', '**/*.spec.{js,mjs}', '**/*.test.{js,mjs}'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
];
