# Contributing to DocWen Assistant

Thank you for helping improve DocWen Assistant. Changes must preserve its local, explicit-target, fail-closed boundary unless a canonical product decision changes that contract.

## Before opening a change

- Use issue forms for reproducible bugs and focused feature proposals.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.
- Remove private note text, Vault and executable paths, CLI logs, credentials, and unrelated settings from examples.
- Keep a change focused and identify any remaining package, host, or manual evidence gap.

## Development setup

Use Node.js `24.19.0`, npm `11.17.0`, and the exact dependency graph in `package-lock.json`.

```sh
npm ci
npm run check
```

Keep composition in `src/main.ts`, user workflows in `src/actions/`, DocWen protocol and artifact handling in `src/docwen/`, host APIs in `src/host/`, and lifecycle ownership in `src/runtime/`. Use strict TypeScript, ES modules, two-space indentation, double quotes, semicolons, and focused regression tests.

## Product and documentation authority

Simplified Chinese is the source for the five stable pairs under `docs/`: product requirements, UX specification, architecture, testing strategy, and release. Update the `.zh-CN.md` source and `.en.md` translation together, preserve exact frontmatter and heading-level parity, and add an Unreleased changelog entry for material user or operational changes.

The README remains English at the root with translations under `docs/i18n/`. Do not create a second product authority or reintroduce retired document names.

## Tests and evidence

Add the smallest test that fails before a fix. Use synthetic files, temporary directories, and dedicated test Vaults. Never point a fixture or destructive operation at an ordinary or production Vault, and preserve `data.json` unless a reset is explicitly authorized.

Source checks, a fixed packaged DocWen candidate, real minimum Obsidian 1.12.7 and current 1.13.x host acceptance, manual Windows/Office checks, GitHub publication, and Community Plugins approval are separate claims. State exactly which layer was exercised.

## Pull requests

A pull request should state the purpose, design boundary, tests run, remaining host or device gaps, and documentation impact. Include screenshots or short recordings for visible Obsidian UI changes. Do not include generated coverage, local release output, private data, or dependencies on sibling repositories or personal paths.

Contributing a branch does not authorize pushing a tag, creating a GitHub Release, deploying to a Vault, or resetting user settings.
