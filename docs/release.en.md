---
source_language: zh-CN
translation_of: release.zh-CN.md
translation_status: synced
---

# DocWen Assistant — Release procedure

[简体中文源文](release.zh-CN.md)

This document defines the repeatable DocWen Assistant release process. Source checks, the
Candidate Bundle, real Obsidian acceptance, GitHub publication, and production-Vault deployment are
separate boundaries.

## Boundaries

An ordinary tag push does not trigger publication. Commit, push, tag, workflow dispatch, GitHub
Release, and production-Vault deployment require separate authorization; local gates make no
remote write.

## Version and source

`manifest.json`, `package.json`, `package-lock.json`, and `versions.json` bind one canonical `x.y.z`
version, the Obsidian `1.12.7` minimum, and the exact commit/tree. A clean worktree must pass
the deterministic offline `npm run release:check`. The read-only DocWen 0.9.x package
compatibility preflight remains a separate external-state gate that is rerun near publication.

## Candidate Bundle v3

The vendored release-core `2.0.0` and thin adapter create the sole Candidate Bundle v3. It contains
`main.js`, `manifest.json`, `styles.css`, `docwen-assistant-x.y.z.zip`, `SHA256SUMS`, and
`candidate-bundle.json`, and binds source, toolchain, core/config/workflow, product payload,
scenario contract, and fixture hashes. The ZIP contains neither documentation nor `data.json`.

## Product acceptance

DocWen Assistant is desktop-only. The same Bundle requires desktop acceptance covering all four
imperative settings tabs, capability discovery, proofread, conversion, validation, numbering,
cancellation, unsaved-buffer conflicts, and concurrent-target conflicts. External DocWen package
acceptance and plugin-host acceptance are recorded separately and cannot substitute for each other.

## Standalone workflow

The generated, checked-in standalone workflow accepts only explicit `workflow_dispatch`. Its
read-only verify job performs one independent install and one complete `release:check` at the exact
commit, rebuilds the Bundle, and source-verifies it. The publish job downloads the fixed artifact
and performs transport verification without restoring `dist`.

## Publication and verification

The acceptance closure does not authorize publication; separate authorization binds the same
Bundle and closure. Before the first write, the workflow deeply validates both records, applies the
equivalent of `--verify-tag`, and performs a read-only preflight. The public Release contains
exactly the three loose assets and versioned ZIP; `SHA256SUMS` and `candidate-bundle.json` remain in
the private Bundle. Post-verification reads back hosted bytes and provenance.

## Failure, rollback, and deployment

An existing same-tag Release is a zero-write no-op only when metadata, all four asset bytes, and
provenance are exact. Any difference fails and a fix requires a new version. Production-Vault
deployment needs separate authorization for the exact Vault, preserves `data.json`, and never
collapses package, host, or Community Plugins state into one verdict.
