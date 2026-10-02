# DocWen contract test data

`docwen/` is a revision-bound snapshot of the [DocWen normative contracts](https://github.com/ZHYX91/docwen/tree/main/contracts).
Its `snapshot.json` records the source commit, original Git blob digests, exported digests and inventory.
JSON whitespace is normalized without changing data. The included AGPL-3.0-or-later license applies to
the vendored test data; it does not replace this plugin's MIT license. These files are excluded from the runtime package.

The ordinary source test command validates the complete snapshot and all schema expectations. It also
runs framing fixtures through the actual decoder and Bundle fixtures through the actual consumer validator,
materializing symbolic bytes in test-owned temporary directories and changing only size/hash in a test copy.
Lifecycle traces receive schema validation here; their cross-message behavior is covered separately by
the client's process/lifecycle tests and the upstream offline conformance gate.

To update, use `tools/export_consumer_contracts.py` in a checkout of the recorded upstream repository with
an explicit new commit and a new output directory. Review and replace the snapshot as one change, preserving
its license and manifest; rerun the source checks and update other consumers to the same snapshot.
The exporter supports read-only `--check` against any selected committed revision.
A standalone clone runs these tests locally without another checkout, Python, a server, or network downloads.
