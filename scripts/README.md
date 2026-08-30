# Build and release scripts

The repository has one cross-platform Node build and release path and remains complete in a
standalone clone.

```bash
npm ci
npm run check
npm run release:check
```

The full source gate verifies the exact Node.js and npm declarations, lint, formatting, localized
documentation, tests and coverage, the production build, the three-file `dist/` inventory, and the
locked dependency tree. `release:validate` adds the canonical source, package, manifest, lockfile,
`versions.json`, and production-asset contract without requiring a release tag. `release:check`
adds the absent-or-exact current-tag policy used for a real candidate.

## Canonical release adapter

`release.config.mjs` contains only DocWen Assistant's declarative identity and publication policy.
`scripts/release.mjs` is the thin adapter to the MIT-licensed, zero-dependency runtime at
`scripts/vendor/obsidian-release-core.mjs`. Its adjacent lock records package version `1.0.0` and
the exact runtime SHA-256. The adapter compares the canonical lock bytes before every operation;
it never imports a parent workspace, sibling repository, private path, or network package.

The core commands are exposed through package scripts:

- `release:validate` and `release:validate-tag` validate source without mutation.
- `release:candidate -- --output <new-directory>` creates the deterministic handoff.
- `release:verify-handoff` rejects missing, extra, changed, or non-regular candidate files.
- `release:publication-boundary` validates the exact tag, candidate digest, acceptance-closure
  digest, and explicit authorization without calling GitHub.
- `release:publish-github` is the only mutating command and requires the same boundary again.
- `release:post-verify` reads back immutable hosted state, exact bytes, source identity, and
  attestations.

`npm run release` runs the complete local gate and writes a new `release/` candidate. The directory
must not already exist; this prevents silently replacing a reviewed candidate. The handoff contains
`main.js`, `manifest.json`, `styles.css`, `docwen-assistant-<version>.zip`, `SHA256SUMS`, and the
deterministic `candidate.json`. The public GitHub Release contains only the first four assets. The
manual-install ZIP contains one `docwen-assistant/` directory and exactly the three runtime files,
byte-identical to the loose assets. No release path contains, replaces, or deletes `data.json`.

## Product compatibility preflight

Generic GitHub publication logic lives in the vendored core. DocWen Assistant retains one narrow
product hook: `npm run release:docwen-compatibility`. With a read-only `GH_TOKEN`, it selects only
the highest stable numeric 0.9.x immutable Release from public `ZHYX91/docwen`, requiring exactly
one fully uploaded `DocWen-windows-x64.zip` with non-empty size, canonical URLs, and a GitHub
SHA-256 digest. This online workflow preflight is intentionally outside the ordinary offline source
gate. It does not replace packaged `DocWenCLI.exe` real-host acceptance.

## GitHub workflow boundary

The Release workflow is manual `workflow_dispatch` only. Its ten inputs bind one workspace release
run, exact commit, core `candidate.json` digest, candidate-envelope digest, portable acceptance
closure, and exact authorization. Mode defaults to read-only `verify`; only an explicit `publish`
mode reaches jobs with write permissions.

The verification job checks out the exact tagged commit without persisted credentials, runs the
complete gate and DocWen compatibility hook, rebuilds the canonical candidate, checks the exact
`candidate.json` digest, and uploads one fixed artifact with ID and service digest. The publication
job downloads that exact artifact ID, rejects non-canonical or oversized base64 evidence, verifies
both decoded digests and all cross-bindings, and runs the read-only `publication-boundary` before
attestation. It then repeats the same boundary in `publish-github`. A separate read-only job runs
`post-verify` against immutable hosted bytes and provenance. Same-tag publication is a no-op only
when every bound field and byte already matches; any difference fails without overwriting assets.

Generated notes use GitHub's verified `--generate-notes` path and the core creates Releases with
`--verify-tag`. Repository Immutable Releases, a no-update/no-delete numeric-tag ruleset, and the
protected `release` environment remain external prerequisites. Creating a tag, dispatching verify,
authorizing publication, and deploying to an Obsidian Vault are separate actions.

Version changes use one command:

```bash
npm run version:set -- 2.3.0
```

It synchronizes `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` as one
rollback-protected operation. The repository name remains `obsidian-docwen-assistant`; the installed
plugin, archive directory, and settings identity remain `docwen-assistant`.
