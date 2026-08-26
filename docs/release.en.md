---
source_language: zh-CN
translation_of: release.zh-CN.md
translation_status: synced
---

# DocWen Assistant — Release procedure

[简体中文源文](release.zh-CN.md)

## Version identity

`manifest.json`, `package.json`, `package-lock.json`, and `versions.json` agree on one canonical `x.y.z` version and minimum Obsidian version. The tag has no `v` prefix and points to the exact release commit on the default branch. A source version or tag alone does not prove that a GitHub Release exists.

## Toolchain and source gate

`.node-version` is the single declaration of Node, and `package.json#packageManager` is the single declaration of npm. After `npm ci`, `npm run release:check` runs the full `check` first and then read-only release-version verification. Release documentation does not copy the npm pin into a second authority.

## Candidate construction

Two independent clean Ubuntu runners build the same commit and compare candidates byte for byte. The publication handoff contains metadata binding the candidate and source, the four public assets (`main.js`, `manifest.json`, `styles.css`, and the versioned ZIP), plus `SHA256SUMS` for internal handoff validation only. The checksum manifest is not uploaded to the public Release. The installation ZIP contains only the first three runtime files; documentation and `data.json` never enter the release package.

## Installation boundary

Installation replaces only `main.js`, `manifest.json`, and `styles.css`. Release archives never contain, replace, or delete `data.json`. The `manifest.id` is `docwen-assistant`, which fixes the installed-plugin identity and settings-file location.

## Read-only preflight

Manual workflow dispatch verifies version, source ancestry, both builds, the candidate, the DocWen dependency, and release state without creating a tag or Release. The verification job holds read-only permissions, runs the repository `release:check`, and hands one fixed candidate and digest to the publication boundary.

## Publication boundary

Only a numeric tag push reaches the publish job. That job performs no source checkout and consumes only the fixed handoff from verification. It rechecks the tag, candidate digest, the DocWen 0.9.x identity fixed into the handoff by read-only verification, and absence of the Release, then attests assets and creates the Release with `--verify-tag`.

## Post-publication verification

With finite retries, the workflow reads back the final GitHub Release and requires stable, non-draft, non-prerelease, immutable state and the exact asset inventory. Downloaded bytes match the candidate, and every attestation binds the same repository, workflow, ref, and commit.

## External prerequisites

Immutable Releases and the required GitHub permissions are publication prerequisites outside repository source. Repository rulesets and tag protection are optional defense-in-depth controls, not publication gates. Community Plugins review and real user upgrades remain separate external evidence; publication is complete only after the immutable hosted state and exact assets have been verified.

## Failure and recovery

The workflow stops when a tag has different assets, candidates differ, the DocWen dependency is untrusted, or remote state drifts. It never clobbers, edits, or reuploads same-tag assets. A release failure does not authorize deleting user `data.json` or modifying a Vault.
