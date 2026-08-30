---
source_language: zh-CN
translation_of: release.zh-CN.md
translation_status: synced
---

# DocWen Assistant — Release procedure

[简体中文源文](release.zh-CN.md)

## Version identity

`manifest.json`, `package.json`, `package-lock.json`, and `versions.json` agree on one canonical `x.y.z` version and minimum Obsidian version. The tag has no `v` prefix, points to the exact accepted commit, and is reachable from the default branch. A tag is one identity binding; it neither triggers nor authorizes publication.

## Toolchain and source gate

`.node-version` is the single declaration of Node, and `package.json#packageManager` is the single declaration of npm. After `npm ci`, `npm run check` runs the full offline source gate and canonical validation without enforcing local tag presence. `npm run release:check` adds the absent-or-exact tag policy for a real candidate. Release documentation does not copy the npm pin into a second authority.

## Candidate construction

The pinned, vendored release core creates one deterministic, path- and timestamp-free candidate bound to the exact commit, tree, plugin identity, version, core version and runtime hash. The handoff contains the four public assets (`main.js`, `manifest.json`, `styles.css`, and the versioned ZIP), sorted `SHA256SUMS`, and `candidate.json`. Isolated rebuilds must produce the same candidate digest. The checksum and candidate metadata are not public Release assets. The installation ZIP contains only the first three runtime files; documentation and `data.json` never enter the release package.

## Installation boundary

Installation replaces only `main.js`, `manifest.json`, and `styles.css`. Release archives never contain, replace, or delete `data.json`. The `manifest.id` is `docwen-assistant`, which fixes the installed-plugin identity and settings-file location.

## Read-only preflight

Manual workflow dispatch defaults to `verify`. Its read-only job checks the exact tagged commit, complete repository gate, canonical candidate digest, and the immutable public DocWen 0.9.x package compatibility hook without creating a Release. It uploads one fixed candidate artifact and records both its artifact ID and service digest.

## Publication boundary

Only a dispatch whose mode explicitly says `publish` reaches jobs with write permissions. The job checks out the already accepted commit without persisted credentials, downloads the fixed artifact ID, decodes the portable acceptance closure and authorization, verifies their exact SHA-256 digests and cross-bindings, and runs the read-only core publication boundary. Before any remote write, `publication-preflight` reads GitHub state: a missing Release permits staging, attestation, and creation; an exact existing Release whose bytes and provenance pass every check is a zero-write safe rerun; any conflict fails before those writes. `publish-github` repeats the boundary and existing-state check before creating the exact immutable Release with `--verify-tag`; manual authorization is never inferred from a tag or passing acceptance.

## Post-publication verification

A separate read-only job uses the same fixed candidate to read back the final GitHub Release and requires stable, non-draft, non-prerelease, immutable state and the exact asset inventory. Downloaded bytes match the candidate, and every attestation binds the same repository, workflow, ref, commit, and GitHub-hosted runner policy.

## External prerequisites

Immutable Releases, a no-update/no-delete numeric-version tag ruleset, the protected `release` environment, and the required GitHub permissions are publication prerequisites outside repository source. Community Plugins review and real user upgrades remain separate external evidence; publication is complete only after the immutable hosted state and exact assets have been verified.

## Failure and recovery

The workflow stops when candidate, closure, authorization, tag, DocWen dependency, artifact identity, or hosted state differs. It never clobbers, edits, or reuploads same-tag assets. A release failure does not authorize deleting user `data.json` or modifying a Vault.
