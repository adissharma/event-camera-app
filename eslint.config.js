// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Dev tooling that runs under Node, not in the app bundle: CommonJS
    // globals are legitimate there and undefined everywhere else.
    files: ["tools/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { __dirname: "readonly", __filename: "readonly", require: "readonly", module: "writable", process: "readonly", Buffer: "readonly", console: "readonly" },
    },
    rules: {
      // These files are CommonJS by definition; `require` is the only import
      // they can use.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: ["dist/*", ".tmp/*", "tools/filter-lab/out/*"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react/no-unescaped-entities": "off",
    },
  }
]);
