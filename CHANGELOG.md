# Changelog

This changelog records notable source changes to DocWen Assistant. A source version or tag does not by itself prove that a GitHub Release was published, that Community Plugins accepted the plugin, or that any Vault was updated.

## [Unreleased]

### Added

- Added a fixed-layout rendering DPI override for PDF, OFD, and XPS Markdown exports.

### Changed

- Replaced the standalone Usage settings tab with contextual help cards on the four relevant tabs.
- Made conversion options capability-specific and clarified that Assistant overrides never rewrite
  DocWen's saved settings.
- Grouped the DocWen file menu and added safe loading, error, folder-target, and submenu-fallback states.
- Updated the non-major development dependency group in line with Dependabot PR #6.

## [2.2.3] - 2026-09-01

### Changed

- Migrated release handoff to the single Candidate Bundle v3 contract backed by release-core 2.0,
  with source-candidate and transport-candidate verification kept as separate claims.
- Kept candidate verification offline and added a repository-owned product scenario contract for
  independently reproducible desktop acceptance.

## [2.2.2] - 2026-08-31

### Fixed

- Restored the exact production assets from the fixed candidate handoff before detached GitHub
  publication and post-verification jobs validate it, keeping those jobs independent from
  untracked build output.

## [2.2.1] - 2026-08-31

### Fixed

- Protected settings that use an invalid or newer schema from being overwritten, presented them as
  read-only, and kept failed settings saves visible and retryable.

## [2.2.0] - 2026-08-30

### Added

- Added strict consumption of `number-suite.interop.v2`, including H1-H9 targets, nine counters,
  and the shared Number Suite/DocWen H7-H9 extension.
- Added strict consumption and atomic adjacent publication of DocWen's single-file DOCX round-trip
  sidecar resource.

### Fixed

- Accepted ID-only caption declarations and rejected Number Suite Heading literals that DocWen
  cannot materialize safely.
- Failed resolved DOCX export closed before publication when its required sidecar is missing,
  damaged, extra, or ambiguously related.
- Corrected Usage help so it no longer claims that merely opening a file sends its path to DocWen.

## [2.1.1] - 2026-08-30

### Fixed

- Updated the Community directory description to remove redundant host branding and added a
  repository contract that keeps the public package and plugin descriptions synchronized.

## [2.1.0] - 2026-08-29

### Added

- Added automatic Microsoft Store discovery through the fixed `%LOCALAPPDATA%\\Microsoft\\WindowsApps\\docwen.exe` execution alias while retaining the portable ZIP installation as a manual fallback.
- Added verified connection states for product identity, version, protocol compatibility, health, missing aliases, and manual-location failures.

### Changed

- Reworked first-run settings and recovery text around automatic detection, a conditional manual-installation picker, Microsoft Store and portable download choices, and a user-facing **Check DocWen connection** action.
- Migrated existing saved paths to manual mode without discarding them, while new installations default to automatic discovery.
- Updated all supported UI languages, public READMEs, and product/architecture/testing contracts for Microsoft Store installation and alias-safe upgrades.

### Fixed

- Reset connection checks, runtime capabilities, file caches, and pending preloads as one fail-closed unit whenever the DocWen target changes.
- Prevented invalidated capability requests from restoring stale results, de-duplicated same-file preloads and connection checks, and kept failed discovery retryable.
- Rejected relative automatic launch targets so a same-named program on `PATH` can never replace the registered Store alias.

## [2.0.1] - 2026-08-27

### Fixed

- Replaced the removed GraphQL `Release.isImmutable` readback with the GitHub REST `immutable: true` field and added a manual CI trigger for governance-only recovery checks.
- Adopted the official Obsidian plugin lint rules, removed unsafe DOM HTML assignment, and type-checked the desktop Electron fallback boundary.
- Made picker and workspace promises explicit so UI callbacks cannot leak rejected work.
- Disclosed the exact Vault-external filesystem access required for local DocWen conversion and export in every public README language.
- Refreshed directory screenshots to the Community listing's exact `1200x800` desktop size.

## [2.0.0] - 2026-08-26

### Changed

- Rebuilt the DocWen boundary around `docwen.machine.v1` and the single accepted `docwen.artifact_bundle.v2` schema, with typed inputs, bounded process lifecycle, strict Bundle validation, and atomic output commit.
- Added fixed-package acceptance for the Machine boundary while keeping package evidence separate from ordinary source tests.
- Added five synchronized product and engineering document pairs plus executable README, documentation, formatting, and release checks.
- Unified settings into five accessible top tabs backed by one shared page model and removed the unused speculative settings adapter.
- Kept that custom tabbed surface independent of declarative host rendering and restored the supported Obsidian floor to 1.12.7.
- Bound proofreading reports to `docwen.proofread_report.v2` and fail closed on older report shapes.
- Revalidated Vault file identity, fixed path, editor state, and content at every numbering commit boundary.
- Added deterministic, immutable numeric-tag publication governance and synchronized the public documentation with the actual 2.0.0 source state.

## [v1.2.0] - 2026-03-06

### Added

- Added file-explorer context-menu conversion and path-selection improvements recorded by the local source tag.

## [1.0.0] - 2026-01-17

### Added

- Established the first locally tagged source baseline for DocWen Assistant.

[Unreleased]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.2.3...HEAD
[2.2.3]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.2.2...2.2.3
[2.2.2]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.2.1...2.2.2
[2.2.1]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.2.0...2.2.1
[2.2.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.1.1...2.2.0
[2.1.1]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.1.0...2.1.1
[2.1.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.0.1...2.1.0
[2.0.1]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.0.0...2.0.1
[2.0.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/tree/2.0.0
[v1.2.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/tree/v1.2.0
[1.0.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/tree/1.0.0
