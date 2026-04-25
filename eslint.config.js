const ts = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const globals = require('globals')

const IGNORED = ['dist', 'node_modules', 'extension', 'eslint.config.js', 'vite.config*.ts', 'shim.d.ts']

module.exports = [
  { ignores: IGNORED },

  // TypeScript source — strict + stylistic type-checked
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        __DEV__: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': ts },
    rules: {
      ...ts.configs['flat/strict-type-checked'][1]?.rules,
      ...ts.configs['flat/stylistic-type-checked'][1]?.rules,
      'eqeqeq': ['error', 'always'],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/consistent-type-definitions': 'off',
    },
  },

  // JS scripts — disable type-checked rules (no tsconfig available)
  {
    files: ['scripts/**/*.js', '*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { '@typescript-eslint': ts },
    rules: {
      ...ts.configs['flat/disable-type-checked']?.rules,
    },
  },
]
