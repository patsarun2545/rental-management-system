module.exports = [
  {
    ignores: ["node_modules/**", "prisma/migrations/**"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        global: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      semi: ["error", "always"],
      quotes: ["error", "double"],
    },
  },
];
