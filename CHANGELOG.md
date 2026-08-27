# Changelog

This changelog records notable source changes to DocWen Assistant. A source version or tag does not by itself prove that a GitHub Release was published, that Community Plugins accepted the plugin, or that any Vault was updated.

## [Unreleased]

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

[Unreleased]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.0.1...HEAD
[2.0.1]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.0.0...2.0.1
[2.0.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/tree/2.0.0
[v1.2.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/tree/v1.2.0
[1.0.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/tree/1.0.0
