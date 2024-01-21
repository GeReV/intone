/* eslint-env node */
module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/strict-type-checked", "plugin:@typescript-eslint/stylistic-type-checked"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true, tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-misused-promises": ["error", {
      checksVoidReturn: false
    }],
  },
  root: true,
  overrides: [{
    files: ["*.js"], extends: ["plugin:@typescript-eslint/disable-type-checked"],
  },],
};
