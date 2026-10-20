import js from '@eslint/js';
import globals from 'globals';

export default [
  {ignores: ['dist/', 'build/', 'node_modules/', 'test/remote/']},
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {sourceType: 'module', globals: {...globals.browser}},
    // The 2016 code base: its escaped regexes and own-property checks are deliberate or harmless, and rewriting the
    // tokenizer's regexes to satisfy a style rule is how bugs get in.
    rules: {
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
      'no-unused-vars': ['error', {caughtErrors: 'none'}],
      'no-empty': ['error', {allowEmptyCatch: true}]
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {globals: {...globals.mocha, expect: 'readonly', sinon: 'readonly', $: 'readonly'}},
    rules: {'no-useless-assignment': 'off'}
  },
  {
    files: ['test/epom/postscribe-check.cjs'],
    languageOptions: {sourceType: 'commonjs', globals: {...globals.node, ...globals.browser, postscribe: 'readonly'}}
  },
  {
    files: ['*.config.mjs'],
    languageOptions: {globals: globals.node}
  }
];
