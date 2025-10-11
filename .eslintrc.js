module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended",
    "prettier"
  ],
  env: {
    browser: true,
    es6: true
  },
  globals: {
    "$": "readonly",
    "L": "readonly",
    "firebase": "readonly",
    "turf": "readonly",
    "leafletImage": "readonly",
    "URLSearchParams": "readonly",
    "Blob": "readonly",
    "URL": "readonly"
  },
  ignorePatterns: ["src/leaflet.min.js"],
  settings: { react: { version: "detect" } },
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "eqeqeq": "error",
    "import/order": ["warn", { "newlines-between": "always" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-floating-promises": "error",
    "react/jsx-no-useless-fragment": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
};
