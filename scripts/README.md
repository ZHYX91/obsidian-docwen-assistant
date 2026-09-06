# Build and product compatibility checks

Use the repository-pinned Node and npm versions, install with `npm ci`, and run `npm run check`.
The package scripts and `release.config.mjs` define the executable build and release commands.
`npm run release:check` includes the absent-or-exact tag validation. All tools remain usable from
an independent clone.

## DocWen compatibility

`npm run release:docwen-compatibility` checks the highest stable numeric DocWen 0.9.x immutable
Release and its canonical Windows package metadata using read-only GitHub access. This external
compatibility check stays separate from the offline source checks.

`npm run acceptance:docwen-package` validates the actual packaged CLI. Its inputs and product
scenarios are documented in [the product fixture guide](../acceptance/README.md). A local package
check and a downloaded public-package check support separate claims.

## Version metadata

`npm run version:set -- <version>` synchronizes package, lockfile, manifest, and compatibility
version metadata with rollback on failure. It does not publish a Release or deploy to a Vault.
