import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['src/leaflet.min.js', 'src/main.js'],
  },
  {
    files: ['*.js', '*.mjs'],
    languageOptions: {
      globals: {
        module: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    settings: { react: { version: 'detect' } },
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: process.cwd(),
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
      },
    },
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: 'error',
      'import/order': ['warn', { 'newlines-between': 'always' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      'react/jsx-no-useless-fragment': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ["src/test/**/*.js"],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        console: 'readonly',
      },
    },
  },
  prettier,
];
