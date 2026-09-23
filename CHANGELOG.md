# Changelog

This changelog records notable source changes to DocWen Assistant. A source version or tag does not by itself prove that a GitHub Release was published, that Community Plugins accepted the plugin, or that any Vault was updated.

## [Unreleased]

## [3.1.0] - 2026-09-21

### Breaking changes

- Require DocWen 0.13.0 or later. Content operations continue to require Machine Protocol v2 and Artifact Bundle v3; older product releases are rejected even when they expose the same protocol identity.

### Changed

- Open or activate the DocWen desktop app through the public local `gui open` CLI control command instead of first negotiating the conversion Machine session. A Machine incompatibility can therefore disable background integration without preventing the user from opening DocWen.
- Preserve the exact Machine protocol sent by Assistant plus the received/supported protocol and server identity returned by DocWen. Generic initialize parameter failures are no longer mislabeled as version mismatches, and the settings row shows both sides of a protocol conflict.
- Show application control and background integration separately, with a direct application launch button and bounded copyable diagnostics including manifest/runtime identities.
- Validate the independent GUI-control CLI success envelope, bound its output and timeout, and reuse the same fixed launch target and bounded child environment as Machine startup without sharing process ownership.
- Keep direct Markdown proofreading on the dedicated `validate.markdown` Machine capability and `docwen.proofread_report.v2`; it does not pass through Markdown→DOCX conversion or the new DocWen post-conversion proofreading pipeline.
- Update compatibility and integration documentation for the DocWen 0.13.0 / Assistant 3.1.0 pairing.

## [3.0.0] - 2026-09-20

### Breaking changes

- Require DocWen 0.12.1 or later with Machine Protocol v2 and Artifact Bundle v3. Update DocWen before using this plugin version; an incompatible Store installation can be replaced in plugin settings by a compatible, fully extracted portable package.

### Changed

- Discover templates by canonical ID with their origin, default state and server order, and validate options against the selected conversion or optimization capability.
- Share one initialized DocWen process across discovery, planning and execution within an operation; close it afterward while retaining query deadlines, task cancellation and source checks.
- Preserve the selected DocWen profile and publish complete result directories without node JSON or hidden layout manifests. Keep valid outputs and report cleanup warnings after the commit boundary.
- Reject malformed framing, invalid UTF-8, mismatched task events and incomplete or contradictory Bundle graphs using the shared, provenance-bound conformance fixtures.
- Preserve editor/Vault snapshots, destination identity and output conflicts across conversion, cancellation and numbering commits. Dispose of superseded action pickers and requests without starting late operations.
- Bind proofreading navigation to the checked source version; request a refresh when the note or editor changes, and discard navigation from superseded reports or closed views.
- Add localized diagnostic details and a bounded sharing preview with recovery advice. Keep raw paths, document text and producer errors out of copied summaries.
- Report files without an available Machine capability as unsupported or unavailable, rather than as malformed responses; preserve actual discovery failures.
- Cancel active work on normal Obsidian exit and give its cleanup up to ten seconds to settle through the host's quit task collector.
- Synchronize the 11-language compatibility and output documentation, and remove the temporary workflow that modified product source remotely.

## [2.4.0] - 2026-09-07

### Changed

- Match inspected document formats to their correct media types, including OFD and XPS, when discovering Machine operations.
- Place dropdowns below their descriptions at a consistent full width, preserving room for translated choices and numbering retry controls.
- Keep the manual installation path on its own row with two equal-width picker buttons across languages and panel widths.
- Clarify subheading/body paragraph merging and its adjacency and ending-punctuation rules in every interface language.
- Offer direct table export before optional Excel templates, including when no templates are installed.

- Capture output-parent identity before conversion and reject source changes, directory conflicts or open editors inside a new result root before atomic publication.
- Show a persistent cancelled proofreading status instead of presenting previous results as a completed check.
- Keep long-note proofreading responsive by constructing semantic inputs only for exports that need them and indexing text positions once per snapshot.
- Publish complete result directories with timestamped source names, linked resources and layout manifests; omit manifests from business output counts and preserve existing result directories.
- Preserve the source document name when exporting resolved Markdown to Word.
- Export both `.md` and `.markdown` sources through the same resolved document path.
- Validate editor and Vault snapshots before publishing converted files or proofreading results; preserve outputs when source content conflicts or an operation is cancelled before commit.
- Localize proofreading issue types and distinguish diagnostic explanations from actual text replacements.
- Keep every operation discoverable by searching for DocWen in the command palette after settings changes.

- Open an action picker from an uncached file menu so users can choose a conversion or edit without reopening the menu.
- Use consistent settings control widths, an explicit connection-check button, and localized failure summaries with expandable technical details.
- Replace command-line wording in image settings and remove obsolete sidecar guidance.
- Require DocWen 0.10.x and accept its independent DOCX output without an original-source sidecar.
- Preserve unnumbered cross references in the neutral document so DocWen can display the target title or Alias.
- Pass capability-supported Markdown extension overrides without changing DocWen's saved settings.
- Preserve existing result directories and adjacent files during Word export.
- Allow a bounded five-second normal CLI shutdown while still terminating a server that does not exit.

## [2.3.0] - 2026-09-04

### Added

- Added a fixed-layout rendering DPI override for PDF, OFD, and XPS Markdown exports.

### Changed

- Replaced the standalone Usage settings tab with contextual help cards on the four relevant tabs.
- Made conversion options capability-specific and clarified that Assistant overrides never rewrite
  DocWen's saved settings.
- Grouped the DocWen file menu and added safe loading, error, folder-target, and submenu-fallback states.
- Updated the non-major development dependency group in line with Dependabot PRs #6 and #7.

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

[Unreleased]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/3.1.0...HEAD
[3.1.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/3.0.0...3.1.0
[3.0.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.4.0...3.0.0
[2.4.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.3.0...2.4.0
[2.3.0]: https://github.com/ZHYX91/obsidian-docwen-assistant/compare/2.2.3...2.3.0
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
