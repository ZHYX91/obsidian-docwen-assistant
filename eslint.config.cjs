const obsidianmd = require("eslint-plugin-obsidianmd").default;

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      "build/**",
      "coverage/**",
      "dist/**",
      "main.js",
      "node_modules/**",
      "release/**",
      "scripts/**",
      "tests/**",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ["src/settings.ts"],
    rules: {
      // Obsidian 1.13 deprecates display(), but non-empty declarative definitions
      // bypass this plugin's intentional five-tab settings information architecture.
      "@typescript-eslint/no-deprecated": "off",
    },
  },
];
