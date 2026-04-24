const js = require('@eslint/js')
const ts = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')

module.exports = [
  {
    ignores: ['dist', 'node_modules', 'extension', 'eslint.config.js', 'vite.config*.ts', 'shim.d.ts']
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
      globals: {
        __DEV__: 'readonly',
        Audio: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
      ecmaVersion: 2020,
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...js.configs.recommended.rules,
      'eqeqeq': ['error', 'always'],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: false
      }],
      '@typescript-eslint/consistent-type-definitions': 'off',
    }
  }
]
