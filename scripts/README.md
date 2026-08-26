# Build and release scripts

The repository has one cross-platform Node build and packaging path. There is no separate Windows batch implementation.

```bash
npm ci
npm run check
npm run release
```

The full gate begins by verifying the exact Node.js version in `.node-version`, the matching `engines.node` declaration, and the exact npm version in `packageManager`. Floating or mismatched local toolchains fail before lint, tests, or build.

`npm run check` runs runtime validation, lint, formatting, the 11-README safety contract, the five synchronized documentation pairs, full-source coverage inventory, type checking, the production build, artifact checks and a high-severity audit of the complete locked dependency tree. `npm run release:check` adds read-only release-version validation, and `npm run release` then writes a deterministic release set under `release/`.

The sole runtime asset list is `release-assets.mjs`:

- `main.js`
- `manifest.json`
- `styles.css`

The manual-install ZIP contains one `docwen-assistant/` folder and exactly those three files. It never contains, replaces, or deletes `data.json`; deleting that settings file is an explicit user reset, not an installation step.

`package-release.mjs` sorts entries, stores fixed metadata, builds the ZIP twice as a determinism self-check and writes `SHA256SUMS`. The checksum manifest stays inside the publication handoff; the public Release contains only the three loose Obsidian assets and the versioned manual-install ZIP. An existing same-tag Release is a no-op only when it is published and immutable, every public asset name and SHA-256 exactly matches, and all four public byte-identical assets have trusted provenance from this repository's Release workflow at the same tag ref and source commit. Assets are never clobbered, and missing provenance fails the no-op.

The Release workflow uses exact Node.js and npm versions and serializes every version through one repository-wide concurrency group. Two independent clean runners use the pinned lockfile to run the single full gate and build the four public assets plus the private checksum manifest; the read-only verification job compares every output byte, enforces the audited `main.js` budget, resolves the public Core dependency and previous stable Release, and uploads one deterministic handoff bound to the current run and attempt. The tag-triggered publication job is the only job with Release and attestation write permissions. It does not check out repository content, install dependencies, build, or execute checked-out repository code. Instead, it materializes a fixed dependency-free publication boundary whose bytes and SHA-256 are embedded in the reviewed workflow, then re-verifies the exact artifact ID, owner, repository, run/attempt, source commit, GitHub server digest, outer handoff ZIP, inner installation ZIP, loose assets, source ancestry, immutable same-tag state and final provenance. Missing or ambiguous state fails closed for manual recovery; the workflow never overwrites an existing Release.

After changing `scripts/publication-boundary.py`, run `npm run release:boundary:sync` to refresh the exact embedded bytes and digest in the Release workflow. The governance test rejects stale generated content.

Before creating a tag, manually dispatch the workflow from the current default-branch head with the proposed `x.y.z` version. This read-only preflight requires an unused tag and runs the version, test, deterministic-package and public-dependency gates without creating a tag or Release. A pushed version tag must still identify the workflow event commit, and that commit must remain reachable from the current remote default branch.

Repository-level Immutable Releases and a no-update/no-delete numeric-version tag ruleset are externally administered publication prerequisites. Record evidence that both protections are enabled before pushing any version tag. The ordinary workflow token cannot read the administration-only repository immutability setting, so the post-publication `isImmutable` checks verify the resulting Release but cannot make an unsafe publication attempt recoverable. Do not start publication without the recorded prerequisite; true automated pre-publication enforcement would require a separately authorized administration-read credential.

The public dependency gate fails closed. It accepts only the canonical public `ZHYX91/docwen` repository's highest stable 0.9.x immutable Release when that Release contains exactly one non-empty `DocWen-windows-x64.zip` with a GitHub SHA-256 digest. Prereleases and 0.10-or-newer releases are incompatible. A local build, private artifact, tag without a published Release, mutable Release or differently named package cannot satisfy this gate. This repository check does not replace downloading that exact public package and exercising its packaged `DocWenCLI.exe` in the real-host acceptance matrix.

Generated notes start at the highest lower stable version that has an actual published Release. New Release tags must use `x.y.z` without a `v` prefix; the baseline resolver accepts an already-published legacy `vX.Y.Z` tag only so repositories can migrate without discarding real Release history. Duplicate prefixed and unprefixed Releases for the same semantic version are ambiguous and fail closed. Unpublished tags are never used as the notes baseline, and publication fails if an equal or newer stable Release already exists.

Version changes use one command:

```bash
npm run version:set -- 2.0.0
```

It synchronizes `package.json`, `package-lock.json`, `manifest.json` and `versions.json` as one rollback-protected operation. `release:version` verifies the tag and all four files.

## Repository and plugin identity

The repository and local-directory name is `obsidian-docwen-assistant`. The installed plugin identity is `manifest.id = "docwen-assistant"`. Repository links, workflow identity checks and release attestations use `ZHYX91/obsidian-docwen-assistant`; release archives and the installation directory use `docwen-assistant`.
