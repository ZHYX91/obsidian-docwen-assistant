const obsidianmd = require("eslint-plugin-obsidianmd").default;
const tseslint = require("typescript-eslint");

const disabledObsidianRules = Object.fromEntries(
  Object.keys(obsidianmd.rules).map((ruleName) => [`obsidianmd/${ruleName}`, "off"]),
);

const disabledHostSecurityRules = {
  "@microsoft/sdl/no-inner-html": "off",
  "@microsoft/sdl/no-html-method": "off",
  "no-unsanitized/method": "off",
  "no-unsanitized/property": "off",
  "no-restricted-globals": "off",
};

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
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
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
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["tests/**/*.ts", "scripts/**/*.mjs"],
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      ...disabledObsidianRules,
      ...disabledHostSecurityRules,
      "@typescript-eslint/no-deprecated": "off",
      "no-undef": "off",
    },
  },
];
