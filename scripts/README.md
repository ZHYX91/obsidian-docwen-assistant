# Build and release scripts

This repository has one cross-platform Node build and release path and remains complete in a
standalone clone.

```bash
npm ci
npm run check
npm run release:check
```

The source gate verifies pinned Node/npm declarations, lint, formatting, bilingual documentation,
coverage, type checking, production build, exact three-file `dist/`, dependencies, and release
source contracts. `release:check` additionally runs the absent-or-exact tag gate while remaining
deterministic and offline.

## Release adapter and core

`release.config.mjs` is schema 2 and declares only plugin identity, assets, repository, exact build
toolchain, standalone workflow, and `acceptance/product-scenarios.json`.
`scripts/release.mjs` is a thin `createReleaseAdapter` client of the zero-dependency vendored
release-core. The adjacent schema-2 lock pins version `2.0.0` and the exact runtime SHA-256; neither
file depends on a parent workspace or sibling repository.

The package scripts expose the active commands:

- `release:validate` and `release:validate-tag` validate source without mutation.
- `release:bundle -- --output-dir <new-directory>` creates Candidate Bundle v3.
- `release:verify-source -- --bundle-dir <directory>` binds Bundle, source, config, workflow,
  scenario resources, and `dist`.
- `release:verify-transport -- --bundle-dir <directory>` verifies downloaded Bundle bytes without
  requiring `dist`.
- `release:publication-boundary` is the offline read-only publication gate.
- `release:publish-github` is the only mutating core command.
- `release:post-verify` reads back immutable hosted bytes and provenance.

`npm run release` runs the complete local gate and creates a new `release/` Candidate Bundle. The
directory must not already exist. It contains `main.js`, `manifest.json`, `styles.css`,
`docwen-assistant-<version>.zip`, `SHA256SUMS`, and `candidate-bundle.json`. The public GitHub
Release contains only the first four assets. The manual-install ZIP contains one
`docwen-assistant/` directory and exactly the three runtime files, byte-identical to the loose
assets. No release operation contains, replaces, or deletes `data.json`.

## Product compatibility preflight

`npm run release:docwen-compatibility` is the sole product-specific release hook. With a read-only
`GH_TOKEN`, it selects only the highest stable numeric 0.9.x immutable Release from public
`ZHYX91/docwen`, requiring exactly one complete `DocWen-windows-x64.zip`, canonical URLs, nonzero
size, and a GitHub SHA-256 digest. This network preflight is outside the ordinary offline source
gate and does not replace real-host acceptance of packaged `DocWenCLI.exe`.

## Generated GitHub workflow

`.github/workflows/release.yml` is generated from the vendored core and checked in. It is explicit
`workflow_dispatch` only and has exactly nine inputs binding release-run UUID, mode, commit,
Candidate Bundle digest, portable closure bytes/digest, and authorization phrase/bytes/digest.

The read-only verify job performs one independent install and exactly one full `release:check`,
recreates and source-verifies Candidate Bundle v3, and uploads that fixed artifact. The downstream
publish job downloads the same artifact and performs transport verification without restoring
`dist`. It decodes and deeply validates closure and authorization records before the first write,
then runs read-only preflight. Only a missing Release may proceed to attestation and
`publish-github`; an exact immutable Release is a zero-write no-op, and any mismatch fails. A
separate job runs `post-verify` against hosted bytes and provenance.

Generated notes use GitHub's `--generate-notes`; publication uses `--verify-tag`. Immutable
Releases, a no-update/no-delete numeric-tag ruleset, and the protected `release` environment remain
external prerequisites. Tag creation, workflow dispatch, publication authorization, and Vault
deployment are separate actions.

Version changes use one rollback-protected command:

```bash
npm run version:set -- 2.3.0
```

It synchronizes `package.json`, `package-lock.json`, `manifest.json`, and `versions.json`. The
repository remains `obsidian-docwen-assistant`; installed plugin, archive root, and settings
identity remain `docwen-assistant`.
