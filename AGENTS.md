# Repository Guidelines

## Project Structure & Module Organization

This repository contains the TypeScript DocWen Assistant plugin for Obsidian. The plugin entry point is `src/main.ts`. DocWen protocol, path, process, and semantic clients live under `src/docwen/`; user operations live under `src/actions/`; Obsidian and Electron boundaries live under `src/host/`. Settings share one model across `src/settings-model.ts`, `src/settings-definitions.ts`, and `src/settings.ts`, while `src/settings.ts` keeps the imperative top-tab surface active and returns no declarative definitions. Unit tests live in `tests/` and use `*.test.ts` naming. Built plugin output is written to `dist/`; release artifacts go to `release/`. The root `README.md` is English and public translations use `docs/i18n/README.<locale>.md`. Stable product and engineering decisions live in the five synchronized `docs/*.{zh-CN,en}.md` pairs. Every README variant starts with the canonical product title followed by the same native-language navigation order.

## Settings Surface Policy

Declarative settings are intentionally disabled because non-empty definitions bypass DocWen
Assistant's five-tab `PluginSettingTab.display()` layout on Obsidian 1.13 and degrade the user
experience. Keep `getSettingDefinitions()` returning an empty array. Dormant definition helpers may
remain, but must not become active accidentally. Do not flag the `display()` deprecation, empty
definitions, or missing settings search, and do not propose a declarative migration unless the user
explicitly asks to revisit this decision.

## Manual Installation Release Policy

The versioned `docwen-assistant-<version>.zip` is an intentional required public release asset for
users who install without the Obsidian Community marketplace. Community ignores it during plugin
ingestion, so an automated-review `extra unsupported files` recommendation is expected and must not
be treated as a defect or a reason to remove the archive. The deterministic ZIP contains one
`docwen-assistant/` directory with `main.js`, `manifest.json`, and `styles.css`, byte-identical to
the three loose release assets. Release checks must preserve and verify all four public assets.

## Release acceptance scope

This plugin is desktop-only. An exact release candidate requires current desktop acceptance;
Android emulators, Android physical devices, and iOS are out of scope. Keep source,
packaged-candidate, real-host, publication, and production-Vault claims separate.

## Public documentation

`CHANGELOG.md` is the only public document that records release history. README and user help
describe the product as it works now: compatibility, installation, usage, settings, limitations,
privacy, and support. Do not add version banners, dated acceptance evidence, release-status
narratives, or superseded plans outside the changelog. Keep migration or deprecation guidance only
when users still need to act, and state the required action directly. Engineering documents describe
the current contract and repeatable process rather than past executions.

## Build, Test, and Development Commands

- `npm ci`: install the exact dependency tree from `package-lock.json`.
- `npm run dev`: watch-build `src/main.ts` to `dist/main.js` for local Obsidian testing.
- `npm run build`: type-check with `tsc --noEmit`, then create a minified plugin bundle.
- `npm run build:quick`: bundle without type-checking or minification.
- `npm test`: run Vitest once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run lint`: lint TypeScript source files.
- `npm run check`: run runtime, lint, format, README/document localization, coverage, type-check/build, artifact, and audit checks.
- `npm run release:check`: run the complete source gate plus exact current-tag validation.
- `npm run release`: run the full local gate and create the canonical deterministic candidate handoff.

## Coding Style & Naming Conventions

Use TypeScript modules and keep imports explicit. The codebase uses two-space indentation, double quotes, semicolons, and `camelCase` for variables/functions. Classes and Obsidian view/plugin types use `PascalCase`; constants may use `UPPER_SNAKE_CASE` when they represent protocol or command tokens. Prefer the existing `@/*` path alias only when it improves clarity, and keep Obsidian-specific behavior isolated near plugin or view code.

## Testing Guidelines

Vitest runs in a Node environment and includes `tests/**/*.test.ts`. Add tests beside related behavior in `tests/`, using descriptive `describe`/`it` blocks. Mock Obsidian, Electron, or child process boundaries in unit tests. Treat fixed-candidate `DocWenCLI.exe` integration and real Obsidian host acceptance as separate evidence, and never substitute unit tests for those gates. Run `npm run check` before handing off a candidate.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit-style prefixes such as `docs:`, `refactor:`, and `chore:`. Use concise imperative subjects, for example `fix: handle missing CLI envelope`. Pull requests should include a short purpose statement, testing performed, and screenshots or GIFs for visible Obsidian UI changes. Link related issues when available and call out documentation or localization updates when user-facing text changes.

## Security & Configuration Tips

Do not commit local Obsidian Vault data, generated `dist/` or `release/` output unless preparing a release, or machine-specific executable paths. Keep DocWen protocol parsing, typed failures, cancellation, and process cleanup inside the shared client/action boundaries. Do not collapse capability-query failures into successful empty results. Do not let the CLI rewrite an open Vault file in place without explicit editor-buffer, snapshot, conflict, and reconciliation handling. Deployment and upgrade procedures must preserve the user's plugin `data.json` unless a reset is explicitly authorized. Release workflows must remain deterministic, fail closed, and must not overwrite mutable same-tag assets.
