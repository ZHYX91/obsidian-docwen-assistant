# DocWen Assistant product fixtures

This directory contains deterministic notes and the product scenario matrix used to verify the
Assistant against real Obsidian hosts. It does not contain or depend on machine-local host launchers.
Use only a disposable Vault, install the exact packaged plugin candidate, and keep infrastructure
checks, product observations, and manual visual conclusions as separate evidence.

The acceptance matrix uses two packaged-DocWen evidence layers and keeps their claims separate:

1. **Local pre-push candidate.** Before publication, run `npm run acceptance:docwen-package` against
   the exact locally built `DocWenCLI.exe`. Set `DOCWEN_TEST_BINARY` to its absolute path and set
   `DOCWEN_TEST_SHA256`, `DOCWEN_TEST_SIZE_BYTES`, and `DOCWEN_TEST_VERSION` to the candidate's exact
   immutable identity. The gate refuses missing inputs, a relative/non-file/link/wrong-name path,
   digest or size drift, a non-stable version or a version below DocWen 0.12.0, a wrong Machine server identity/version, or a Bundle
   producer version that differs from initialization. This proves only that pre-push checkpoint.
2. **Public distribution verification.** After publication, download the canonical immutable Release
   asset into a fresh location, independently verify its published digest and size, and repeat the same
   command with that downloaded `DocWenCLI.exe`. Only this second layer supports a public distribution
   claim. A local build, private package, mutable asset, or tag without a published Release cannot do so.

The packaged D2 case opens the produced DOCX as a ZIP, verifies that the exact declared PNG bytes are
present under `word/media/`, verifies that the physical sibling decoy bytes are absent, and re-hashes
all three inputs after conversion. Ordinary `npm run check` intentionally skips this package-only suite
and therefore must not be reported as packaged acceptance.

## Product scenario matrix

`product-scenarios.json` is the desktop-only execution contract. Each scenario can be selected
independently and states its package, input and fault prerequisites. A full batch may share one
disposable Vault/profile and host; before each scenario reset scratch inputs, temporary settings,
open editors and idle operation state so it does not inherit earlier effects. Do not switch the
run's Vault outside the host lifecycle. Record the
candidate/contract and host identities, input hashes, case observations and cleanup outcome. A
scenario passes only when every declared case is observed; unavailable prerequisites or omitted
cases remain unverified. Run only scratch copies of the fixtures and never write outputs back to
this repository.

Each run proves only its recorded host/version. Minimum Obsidian 1.12.7 and current 1.13.x coverage,
or a profile that must be seeded before launch (such as newer-schema settings), requires separate
prepared host runs and an explicit case summary. A single fixed host profile cannot prove all of
those environments. Retain untested matrix entries as unverified.

| Scenario | Independently prepared behavior |
| --- | --- |
| `desktop-settings-surface` | Four tabs and help cards, recorded-host/theme/layout/locale combinations, saved controls and save-failure Retry |
| `desktop-connection-discovery` | Native package/program selection, canonical CLI path, Doctor, capability/resource empty and failure states, Retry and obsolete-response suppression |
| `desktop-file-handoff` | All 35 format examples, explicit GUI selection in single/batch modes, repeated and alternating requests, command/ribbon entry points and admission explanations |
| `desktop-proofread-validation` | Direct Markdown validation, read-only sidebar results, sorting/keyboard navigation, source refresh and latest-request ownership |
| `desktop-conversion-exports` | DOCX/XLSX/Markdown routes, template/optimization choices, actual output content, successive complete result directories, advisory proofreading and detected-format confirmation |
| `desktop-heading-numbering` | Add/remove numbering on an unsaved unique editor buffer and a separately prepared inactive Vault file |
| `desktop-vault-conflicts` | Concurrent source/editor/file-identity changes, stale report/export rejection and unconfirmed-write handling |
| `desktop-output-conflicts` | Occupied/changed output destinations, staged artifact drift, related-output collisions and owned-staging cleanup |
| `desktop-cancellation-unload` | Cancelled choices/accepted tasks, view-close generation ownership, timeout, disable/re-enable and process-tree settlement |

The numbering scenario is a small normal-operation smoke scope. The full contract retains every scenario as a coverage inventory; routine publication selects representative affected cases and records omissions by risk. Direct proofreading already runs
Markdown validation; there is no additional standalone validation command. Export selects an output
parent and creates a new result directory. The former save-file overwrite wording does not describe
the current implementation.

Fault cases need a prepared, identity-recorded controlled endpoint or host fault arrangement:
empty/failed/delayed discovery replies, held task completion, malformed/colliding output bundles,
timeout, save failure or reconciliation failure. The scenario steps name the required behavior,
but this repository does not ship a real-host fault-injection harness. If that setup is unavailable,
record those cases as unverified. An endpoint simulation proves the Assistant boundary in the
declared host; it does not prove the real DocWen package produced that response. For timing cases,
observe the mutation before releasing completion; a task that already finished cannot prove the
conflict or cancellation path.

New scenario IDs and changed contract bytes require new evidence. Historical observations under an
older contract remain scoped to their original cases and verdict; do not relabel an old aggregate
or a subset of it as a pass for this matrix. Standalone selection does not itself qualify a pass for
retry carry-forward.

The following broader checks retain their source/package/host evidence boundaries:

- Custom tabbed settings on minimum Obsidian 1.12.7 and current 1.13.x hosts: all four pages and contextual help cards, index-time zero I/O, program/folder selection, canonical CLI-path save, failed-save pending state and Retry.
- Settings compatibility: an invalid/newer schema requires a separately seeded temporary profile; controls remain visibly read-only and the stored bytes are unchanged. Normal writable-settings runs do not prove this boundary.
- Popout: settings/proofreading use the owning document and window; closing the view cancels the active proofread child.
- Capability: successful empty results stay empty; typed discovery failures remain visible and never produce default actions.
- File admission: menus, commands and optimization scope follow Core inspection/capability, including detected-format confirmation.
- Vault safety: unsaved editor numbering, inactive-file numbering, simultaneous editor change, leaf/view replacement and reconciliation mismatch.
- Operations: doctor, resources, gui, convert, validate and number success/failure; latest proofread wins; bounded input/output resources; timeout, cancellation, unload and zero residual child process tree.
- Output commit: staged-source drift, a concurrently created result root, related-output collisions, directories and supported symlinks all fail closed; only a confirmed output parent and absent result root may receive the complete staged directory. Foreign entries are preserved and cleanup failures remain visible.
- Accessibility and locale: keyboard issue buttons, `:focus-visible`, 11 languages, `zh-Hant-HK`, `zh-Hans-SG`, ribbon and command text refresh.
- Installation: only `main.js`, `manifest.json`, `styles.css` change; the fixture `data.json` hash is preserved.
- DocWen location: the full-package folder, `DocWen.exe`, and `DocWenCLI.exe` all resolve to the same exact CLI; unrelated executables, missing siblings, and recursive child-folder guesses fail visibly; a successful selection runs doctor.
