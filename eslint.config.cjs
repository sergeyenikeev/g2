const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");
const prettier = require("eslint-config-prettier");

module.exports = [
  {
    files: ["**/*.ts"],
    ignores: ["dist/**"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  },
  prettier
];
