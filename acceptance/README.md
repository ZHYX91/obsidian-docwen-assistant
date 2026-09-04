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
   digest or size drift, a version outside stable DocWen 0.9.x, a wrong Machine server identity/version, or a Bundle
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

- Custom tabbed settings on minimum Obsidian 1.12.7 and current 1.13.x hosts: all four pages and contextual help cards, index-time zero I/O, program/folder selection, canonical CLI-path save, failed-save pending state and Retry.
- Popout: settings/proofreading use the owning document and window; closing the view cancels the active proofread child.
- Capability: successful empty results stay empty; typed discovery failures remain visible and never produce default actions.
- File admission: menus, commands and optimization scope follow Core inspection/capability, including detected-format confirmation.
- Vault safety: unsaved editor numbering, inactive-file numbering, simultaneous editor change, leaf/view replacement and reconciliation mismatch.
- Operations: doctor, resources, gui, convert, validate and number success/failure; latest proofread wins; bounded input/output resources; timeout, cancellation, unload and zero residual child process tree.
- Output commit: staged-source drift, a concurrently created target, related-output collisions, directories and supported symlinks all fail closed; only a save-dialog-confirmed preferred file may be overwritten and rollback leaves no transaction residue.
- Accessibility and locale: keyboard issue buttons, `:focus-visible`, 11 languages, `zh-Hant-HK`, `zh-Hans-SG`, ribbon and command text refresh.
- Installation: only `main.js`, `manifest.json`, `styles.css` change; the fixture `data.json` hash is preserved.
- DocWen location: the full-package folder, `DocWen.exe`, and `DocWenCLI.exe` all resolve to the same exact CLI; unrelated executables, missing siblings, and recursive child-folder guesses fail visibly; a successful selection runs doctor.
