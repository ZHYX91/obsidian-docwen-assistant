# Security Policy

DocWen Assistant handles local Vault text, executable paths, subprocesses, staged artifacts, and release assets. A vulnerability that crosses those boundaries should be reported privately.

## Reporting a vulnerability

Use GitHub's [private advisory form](https://github.com/ZHYX91/obsidian-docwen-assistant/security/advisories/new). If private vulnerability reporting is unavailable, open a public issue containing only a request for a private contact channel; do not disclose exploit details or private data publicly.

Include the affected plugin revision, DocWen version, Obsidian version, Windows version, impact, and the smallest sanitized reproduction. Remove credentials, note contents, Vault and document paths, executable locations, unsanitized CLI output, and unrelated `data.json` values.

## Security scope

Relevant reports include stale editor or Vault writes, path or staging escape, unsafe symlink or overwrite handling, process-tree or protocol-boundary failures, malformed Bundle graph/path/hash acceptance, loss of `data.json`, exposure of private content, and release provenance or hosted-byte substitution.

DocWen Core conversion, OCR, proofreading, or CLI vulnerabilities outside the Assistant boundary should also be reported to the [DocWen repository](https://github.com/ZHYX91/docwen/security/advisories/new).

## Supported revisions and response

Reports are evaluated against the current default branch and relevant tagged revisions. There is no guaranteed support lifetime, response deadline, or remediation deadline. The maintainer will coordinate disclosure according to reproducibility, impact, affected revisions, and release readiness.

## Public reports

Ordinary bugs, feature requests, unsupported-host questions, and already-public hardening suggestions belong in the repository issue forms unless they demonstrate a concrete confidentiality, integrity, or availability impact.
