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

Simplified Chinese is the source for the product-specific document pairs under `docs/`: product requirements, UX specification, architecture, and testing strategy. Update the `.zh-CN.md` source and `.md` translation together, preserve exact frontmatter and heading-level parity, and add an Unreleased changelog entry for material user or operational changes.

The README remains English at the root with translations under `docs/i18n/`. Do not create a second product authority or reintroduce retired document names.

## Tests and evidence

Add the smallest test that fails before a fix. Use synthetic files, temporary directories, and dedicated test Vaults. Never point a fixture or destructive operation at an ordinary or production Vault, and preserve `data.json` unless a reset is explicitly authorized.

Source checks, a fixed packaged DocWen candidate, real minimum Obsidian 1.12.7 and current 1.13.x host acceptance, manual Windows/Office checks, Linux host checks, GitHub publication, and Community Plugins approval are separate claims. State exactly which layer was exercised.

For local diagnosis, `npm run test:source` separates source regressions from the real Linux Machine lifetime file. Run `npm run test:native:linux` on Linux x64/arm64 for native process cases. Windows Job mechanics live in Core; `npm run test:native:windows` requires a hash-pinned packaged Core candidate and runs the paired package gate. The source command still has Python fixture and platform-specific publication prerequisites. The default `npm test`, coverage and `npm run check` continue to include all tests. Linux prerequisite failures report the exact phase and retain a temporary diagnostic; they fail the native suite and do not count as lifecycle acceptance.

## Pull requests

A pull request should state the purpose, design boundary, tests run, remaining host or device gaps, and documentation impact. Include screenshots or short recordings for visible Obsidian UI changes. Do not include generated coverage, local release output, private data, or dependencies on sibling repositories or personal paths.

Contributing a branch does not authorize pushing a tag, creating a GitHub Release, deploying to a Vault, or resetting user settings.

## Lint dependency maintenance

Caller-scoped overrides keep minimatch at 11.0.4 in the development dependency tree.
`npm ci` runs `scripts/prepare-lint-dependencies.mjs` to adapt the legacy callers to its
named exports and `Minimatch.match` API. The script accepts only reviewed package versions
and exact source fragments; it fails if upstream changes invalidate a patch. Review and
remove the corresponding adaptation when upgrading a caller that supports the new API.
These changes do not enter the plugin runtime bundle.

`npm run lint` first reapplies the adaptations idempotently, then runs
`scripts/check-lint-dependencies.mjs`. The check verifies every locked and resolved minimatch
version and exercises matching and nonmatching cases through the installed callers. Rule
probes use each caller's installed ESLint peer; they do not establish compatibility with a
different ESLint major. The normal lint command independently checks the active repository
configuration without disabling rules. If installation used `--ignore-scripts`, run
`npm run prelint` before invoking ESLint directly.

## Shared maintenance tool snapshots

`scripts/shared-tools.lock.json` records the source repository, one full reviewed commit,
and SHA-256 values for `runtime-contract.mjs`, `prepare-lint-dependencies.mjs` and
`check-lint-dependencies.mjs`. Their existing paths are the snapshots; there is no second
copy or runtime dependency on another plugin. The source is
[Property Order](https://github.com/ZHYX91/obsidian-property-order).

`npm run check:tools` compares the checked-in files with this local lock. It runs offline;
it does not query GitHub or authenticate the recorded commit remotely. Runtime checks,
installation hooks, lint preparation and build entry points reject drift before loading
these tools. Runtime checks require the exact Node/npm versions and agreement between
`.node-version`, `engines.node` and `packageManager`. With dependencies installed, builds
need no network connection or sibling repository to obtain maintenance code.

To update a snapshot:

1. Review changes to the three source files in Property Order and select the full commit
   containing those changes. Preserve the reviewed lint adaptations until their upstream
   callers support the newer API.
2. Copy all three files from that exact commit into the same paths in each consuming
   repository. Update the lock's commit and SHA-256 values from those exact bytes together;
   an arbitrary local edit and a new hash are not evidence of reviewed upstream source.
3. For Property Order itself, commit the reviewed source changes first, then update its
   lock to that existing commit in a follow-up commit. This keeps the source identity
   concrete without requiring a commit to name itself.
4. Run `npm run check:tools`, `npm run check:runtime`, `npm run test:tools`, and
   `npm run check`. Review the installed lint-caller probes as part of the normal lint gate.

The source snapshot and dependency lock serve different purposes. Updating these scripts
alone does not authorize changing dependency versions, publishing packages or releasing a plugin.
