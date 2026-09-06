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

An authorized stable version tag push triggers publication. Manual dispatch on the same tag supports verify-only or publish mode through the same workflow. Host acceptance is optional; publishing does not deploy to a Vault.

## Version and source

`manifest.json`, `package.json`, `package-lock.json`, and `versions.json` bind one canonical `x.y.z`
version, the Obsidian `1.12.7` minimum, and the exact commit/tree. A clean worktree must pass
the deterministic offline `npm run release:check`. The read-only DocWen 0.10.x package
compatibility preflight remains a separate external-state gate that is rerun near publication.

## Candidate Bundle v3

The vendored release-core `3.0.1` and thin adapter create the sole Candidate Bundle v3. It contains
`main.js`, `manifest.json`, `styles.css`, `docwen-assistant-x.y.z.zip`, `SHA256SUMS`, and
`candidate-bundle.json`, and binds source, toolchain, core/config/workflow, product payload,
scenario contract, and fixture hashes. The ZIP contains neither documentation nor `data.json`.

## Optional product acceptance

DocWen Assistant is desktop-only. Use the same Bundle for desktop acceptance covering all four
imperative settings tabs, capability discovery, proofread, conversion, validation, numbering,
cancellation, unsaved-buffer conflicts, and concurrent-target conflicts. External DocWen package
acceptance and plugin-host acceptance are recorded separately and cannot substitute for each other.

## Standalone workflow

Tag push and manual dispatch use the same build, publish, and post-verification jobs. The read-only build job produces and verifies the Bundle. Publication downloads that fixed artifact without rebuilding and verifies the event, tag, commit, and Bundle digest before writing. Manual verify mode performs no publication.

## Publication and verification

Source and transport verification use `--verify-tag` to enforce the exact release tag.

Actions generates SLSA build provenance for the four public assets. The publisher verifies their source, tag and workflow, creates a draft, downloads and checks all draft assets, then publishes the immutable Release. A separate job checks the hosted release. Only the three loose files and versioned ZIP are public assets; Bundle metadata stays in the CI artifact. GitHub publication and Community Directory review are separate outcomes.

## Failure, rollback, and deployment

An existing same-tag Release is a zero-write no-op only when metadata, all four asset bytes, and
provenance are exact. Any difference fails and a fix requires a new version. Production-Vault
deployment needs separate authorization for the exact Vault, preserves `data.json`, and never
collapses package, host, or Community Plugins state into one verdict.
