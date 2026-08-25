# Machine integration contract

DocWen Assistant 2.0 consumes `docwen.machine.v1` and Artifact Bundle v2 from the configured `DocWenCLI.exe`. Other Bundle schemas and older process envelopes fail closed.

## Process boundary

- The settings UI accepts an extracted DocWen folder, `DocWen.exe`, or `DocWenCLI.exe`, then resolves exactly one sibling `DocWenCLI.exe`.
- Every operation spawns `DocWenCLI.exe serve --stdio` with `shell: false`, a hidden Windows console, a bounded environment, and canonical `Content-Length` framing.
- The client initializes JSON-RPC 2.0 as `docwen.machine` major 1, requires `server.name` to be exactly `DocWen`, and accepts only a stable DocWen 0.9.x product version. Prereleases and 0.10-or-newer versions fail closed. Package acceptance additionally pins an exact product version. Every Artifact Bundle must repeat the exact product version returned by that session's initialize response; a mismatch fails closed.
- Queries and tasks have timeouts. Cancellation sends `task/cancel` after task acceptance, then terminates the owned process tree if the server does not settle within two seconds; cancellation before acceptance and plugin unload also settle waiting callers and terminate every owned process tree. Stderr is capped at 256 KiB, protocol frames at 16 MiB, and queued/deferred messages at 64 each.
- Every file handle contains an absolute local locator, immutable `kind`/`role`, a unique normalized relative-POSIX `logical_path`, media type, byte length, and SHA-256. Inputs are preflighted before hashing, limited to 256 files, 512 MiB per file and 1 GiB total, then hashed sequentially with identity revalidation. Capability `input_shape` declares role/kind/media-type slots and rejects undeclared roles; DocWen rechecks handles at plan and execute boundaries.
- Markdown-to-DOCX keeps the source snapshot for inspection and advisory proofreading, but the task itself has exactly two inputs: one `neutral_document` and one `numbering_export_plan`. The neutral document authenticates DocWen heading levels 1 through 9, including extended levels that Obsidian's standard heading cache can omit. Obsidian's metadata cache resolves only image embeds explicitly present in the note. PNG, JPEG, GIF, BMP, and WebP bytes are deduplicated by Vault path, authenticated, embedded in the neutral document, and bound to every authored occurrence by Unicode-code-point range. The Assistant never discovers sibling files or scans the Vault/CWD. Missing, unsupported, stale-cache, empty, or over-budget images fail before task planning.

## Methods used

| Plugin behavior | Machine method/capability |
|---|---|
| Diagnostics | `health/check` |
| Start, activate, or open in DocWen | `gui/open`, `gui/activate`, `gui/status` |
| Inspect an isolated input | `file/inspect` |
| Discover stable capabilities | `capability/list` |
| Discover templates, optimizations, numbering schemes | `resource/list` |
| Markdown to DOCX | `convert.markdown.to_docx` |
| Markdown to XLSX | `convert.markdown.to_xlsx` |
| DOCX to Markdown | `convert.docx.to_markdown` |
| XLSX to Markdown | `convert.xlsx.to_markdown` |
| Markdown proofreading | `validate.markdown` |
| Markdown heading numbering | `transform.markdown.heading_numbering` |

Support comes from the conjunction of content-derived `file/inspect` results and available Machine capabilities for the detected media type. The Assistant does not infer conversion support from extensions or DocWen route IDs. Route-specific optimizers are not exposed until DocWen promotes them to a normalized Machine capability.

## Artifact Bundle consumption

DocWen writes only to a request-owned staging directory. Before using a completed task, the Assistant validates:

- Bundle schema, producer, task identity, artifact and entry uniqueness;
- v2 layout identity and normalized artifact `logical_path` values;
- producer product version equality with the initialized Machine server for that same process;
- normalized relative locators and containment after canonical path resolution;
- regular-file status, byte length, and SHA-256 for every artifact;
- entry roles, relation roles/kinds/ordinals, structural ownership, acyclicity, and reachability.

Validation accepts at most 1,024 artifacts, 1,024 entries and 4,096 relations, with a 512 MiB per-artifact and 1 GiB total artifact budget. Proofreading JSON is additionally capped at 16 MiB before it is read into memory.

The preferred artifact maps to the user's explicit output path. Related resources and fragments map beside it by safe portable `suggested_name`. The Assistant revalidates each staged source before and after copying, creates transaction-local files exclusively, and rechecks target identity immediately before commit. Only the explicitly confirmed preferred target may be replaced; related artifacts are never overwritten. Existing preferred bytes are retained through an exclusive same-directory backup link, and prepared outputs are installed with exclusive no-clobber links. Failure removes only transaction-owned unchanged files and restores an unchanged backup without overwriting a concurrently created target. DocWen never writes an Obsidian Vault path directly.

Proofreading reads the preferred JSON report resource and never commits it. Numbering still passes through the existing editor/Vault snapshot, conflict, and reconciliation transaction before changing a note.

## Source ownership

| File | Responsibility |
|---|---|
| `src/docwen/machine-framing.ts` | Canonical `Content-Length` encoder and incremental decoder |
| `src/docwen/machine-client.ts` | Process lifecycle, JSON-RPC, cancellation, terminal state, and strict Bundle validation |
| `src/docwen/client.ts` | Consumer-neutral option mapping, report parsing, and atomic output commit |
| `src/docwen/capability-service.ts` | Inspection plus Machine capability projection for Assistant use cases |
| `src/docwen/path.ts` | Deterministic executable selection and exact `DocWenCLI.exe` validation |
| `src/docwen/errors.ts` | Local boundary errors and remote Machine failures |
| `src/host/vault-read-snapshot.ts` | Isolated source snapshots plus Obsidian-resolved neutral Markdown/resource ports |
| `src/host/vault-write-transaction.ts` | Editor/Vault conflict-safe numbering commit |

New DocWen operations require a versioned Machine capability, mocked process-boundary tests, Bundle/commit negative tests, and packaged `DocWenCLI.exe` verification before UI exposure.
