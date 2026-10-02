export default Object.freeze({
  schemaVersion: 2,
  plugin: Object.freeze({
    id: "docwen-assistant",
    name: "DocWen Assistant",
    minAppVersion: "1.12.7",
    isDesktopOnly: true,
  }),
  assets: Object.freeze({
    styles: "required",
  }),
  publication: Object.freeze({
    repository: "ZHYX91/obsidian-docwen-assistant",
  }),
  build: Object.freeze({
    node: "24.19.0",
    packageManager: "npm@11.17.0",
    installCommand: "npm ci --no-audit --no-fund",
    verifyCommand: "npm run release:check",
    workflow: ".github/workflows/release.yml",
  }),
  acceptance: Object.freeze({
    scenarioContract: "acceptance/product-scenarios.json",
  }),
});
