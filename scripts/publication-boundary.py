"""Dependency-free GitHub publication boundary used without a repository checkout."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, NoReturn

API_VERSION = "2026-03-10"
HANDOFF_NAME = "docwen-assistant-publication-handoff.zip"
BUNDLE_BUDGET = 1_000_000
VERSION_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
HISTORICAL_VERSION_RE = re.compile(r"^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
DIGEST_RE = re.compile(r"^(?:sha256:)?([0-9a-f]{64})$")
REPOSITORY_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
RUN_RE = re.compile(r"^[1-9]\d*$")
PUBLISHED_AT_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$"
)


class BoundaryError(RuntimeError):
    pass


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is None:
            return None
        parsed = urllib.parse.urlsplit(redirected.full_url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
        ):
            fail("Artifact or Release asset redirect must use a credential-free HTTPS URL")
        return urllib.request.Request(
            redirected.full_url,
            headers={"User-Agent": "docwen-assistant-publication-boundary"},
            method="GET",
            origin_req_host=req.origin_req_host,
            unverifiable=True,
        )


def fail(message: str) -> NoReturn:
    raise BoundaryError(message)


def required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        fail(f"{name} is required")
    return value


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalized_digest(value: object) -> str:
    match = DIGEST_RE.fullmatch(str(value or ""))
    if not match:
        fail(f"Invalid SHA-256 digest: {value!r}")
    return f"sha256:{match.group(1)}"


def api_url(path: str) -> str:
    root = required("GITHUB_API_URL").rstrip("/")
    if not root.startswith("https://"):
        fail("GITHUB_API_URL must use HTTPS")
    return f"{root}{path}"


def request_bytes(path_or_url: str, *, accept: str = "application/vnd.github+json") -> bytes:
    url = path_or_url if path_or_url.startswith("https://") else api_url(path_or_url)
    request = urllib.request.Request(
        url,
        headers={
            "Accept": accept,
            "Authorization": f"Bearer {required('GH_TOKEN')}",
            "User-Agent": "docwen-assistant-publication-boundary",
            "X-GitHub-Api-Version": API_VERSION,
        },
    )
    opener = urllib.request.build_opener(SafeRedirectHandler())
    with opener.open(request, timeout=60) as response:
        return response.read()


def request_json(path: str, *, allow_404: bool = False) -> Any:
    try:
        raw = request_bytes(path)
    except urllib.error.HTTPError as error:
        if allow_404 and error.code == 404:
            return None
        fail(f"GitHub API request failed ({error.code}): {path}")
    try:
        return json.loads(raw)
    except Exception as error:
        fail(f"GitHub API returned invalid JSON for {path}: {error}")


def graphql(query: str, variables: dict[str, object]) -> Any:
    body = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    request = urllib.request.Request(
        api_url("/graphql"),
        data=body,
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {required('GH_TOKEN')}",
            "Content-Type": "application/json",
            "User-Agent": "docwen-assistant-publication-boundary",
            "X-GitHub-Api-Version": API_VERSION,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as error:
        fail(f"GitHub GraphQL request failed ({error.code})")
    if payload.get("errors"):
        fail(f"GitHub GraphQL returned errors: {payload['errors']!r}")
    return payload.get("data")


def write_output(name: str, value: str) -> None:
    output = required("GITHUB_OUTPUT")
    if "\n" in value or "\r" in value:
        fail(f"Invalid multiline output: {name}")
    with open(output, "a", encoding="utf-8", newline="\n") as handle:
        handle.write(f"{name}={value}\n")


def parse_version(value: str) -> tuple[int, int, int]:
    match = VERSION_RE.fullmatch(value)
    if not match:
        fail(f"Invalid stable version tag: {value!r}")
    return tuple(int(part) for part in match.groups())


def parse_historical_version(value: str) -> tuple[int, int, int]:
    match = HISTORICAL_VERSION_RE.fullmatch(value)
    if not match:
        fail(f"Invalid previous stable Release tag: {value!r}")
    return tuple(int(part) for part in match.groups())


def valid_published_at(value: object) -> bool:
    if not isinstance(value, str):
        return False
    match = PUBLISHED_AT_RE.fullmatch(value)
    if not match:
        return False
    try:
        datetime(*(int(part) for part in match.groups()))
    except ValueError:
        return False
    return True


def validate_release_record(release: object) -> dict[str, Any]:
    if type(release) is not dict:
        fail("GitHub Release record must be a plain object")
    tag = release.get("tag_name")
    if not isinstance(tag, str) or not tag.strip():
        fail("GitHub Release tag_name must be a non-empty string")
    if type(release.get("draft")) is not bool:
        fail(f"GitHub Release {tag} draft must be boolean")
    if type(release.get("prerelease")) is not bool:
        fail(f"GitHub Release {tag} prerelease must be boolean")
    if "published_at" not in release:
        fail(f"GitHub Release {tag} is missing published_at")
    published_at = release["published_at"]
    if published_at is not None and not valid_published_at(published_at):
        fail(f"GitHub Release {tag} has an invalid published_at")
    if release["draft"] is False and release["prerelease"] is False and published_at is None:
        fail(f"Published stable GitHub Release {tag} has no published_at")
    return release


def release_names(version: str) -> list[str]:
    parse_version(version)
    return [
        "SHA256SUMS",
        f"docwen-assistant-{version}.zip",
        "main.js",
        "manifest.json",
        "styles.css",
    ]


def public_release_names(version: str) -> list[str]:
    parse_version(version)
    return [
        f"docwen-assistant-{version}.zip",
        "main.js",
        "manifest.json",
        "styles.css",
    ]


def canonical_json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def zip_mode(info: zipfile.ZipInfo) -> int:
    return (info.external_attr >> 16) & 0xFFFF


def verify_safe_zip_name(name: str) -> None:
    parts = name.replace("\\", "/").split("/")
    if (
        not name
        or name.startswith(("/", "\\"))
        or re.match(r"^[A-Za-z]:", name)
        or "\x00" in name
        or any(part in {"", ".", ".."} for part in parts)
    ):
        fail(f"Unsafe ZIP path: {name!r}")


def read_strict_zip(data: bytes, expected_names: list[str]) -> dict[str, bytes]:
    try:
        archive = zipfile.ZipFile(io_bytes(data), "r")
    except Exception as error:
        fail(f"Invalid deterministic ZIP: {error}")
    with archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        if names != expected_names or len(set(names)) != len(names):
            fail(f"Deterministic ZIP inventory/order mismatch: {names!r}")
        result: dict[str, bytes] = {}
        for info in infos:
            verify_safe_zip_name(info.filename)
            if (
                info.compress_type != zipfile.ZIP_STORED
                or info.date_time != (1980, 1, 1, 0, 0, 0)
                or info.flag_bits != 0x800
                or info.extra != b""
                or info.comment != b""
                or info.create_system != 3
                or zip_mode(info) != 0o100644
                or info.is_dir()
            ):
                fail(f"Deterministic ZIP metadata mismatch: {info.filename}")
            result[info.filename] = archive.read(info)
        if archive.comment != b"":
            fail("ZIP archive comment is forbidden")
        return result


def io_bytes(data: bytes):
    import io

    return io.BytesIO(data)


def validate_identity_environment() -> dict[str, str]:
    identity = {
        "repository": required("GITHUB_REPOSITORY"),
        "run_id": required("GITHUB_RUN_ID"),
        "run_attempt": required("GITHUB_RUN_ATTEMPT"),
        "source": required("GITHUB_SHA"),
        "source_ref": required("GITHUB_REF"),
        "version": required("RELEASE_VERSION"),
    }
    if not REPOSITORY_RE.fullmatch(identity["repository"]):
        fail("Invalid GITHUB_REPOSITORY")
    if not RUN_RE.fullmatch(identity["run_id"]) or not RUN_RE.fullmatch(identity["run_attempt"]):
        fail("Invalid GitHub run identity")
    if not COMMIT_RE.fullmatch(identity["source"]):
        fail("Invalid GITHUB_SHA")
    parse_version(identity["version"])
    if identity["source_ref"] != f"refs/tags/{identity['version']}":
        fail("Publication must run from the exact numeric version tag")
    return identity


def command_handoff() -> None:
    identity = validate_identity_environment()
    artifact_id = required("EXPECTED_ARTIFACT_ID")
    if not RUN_RE.fullmatch(artifact_id):
        fail("Invalid publication artifact ID")
    artifact_name = required("EXPECTED_ARTIFACT_NAME")
    expected_name = f"docwen-assistant-publication-{identity['run_id']}-{identity['run_attempt']}"
    if artifact_name != expected_name:
        fail("Publication artifact name is not bound to run_id + run_attempt")
    expected_digest = normalized_digest(required("EXPECTED_ARTIFACT_DIGEST"))
    expected_handoff_digest = normalized_digest(required("EXPECTED_HANDOFF_SHA256"))
    expected_handoff_size = int(required("EXPECTED_HANDOFF_SIZE"))
    if expected_handoff_size <= 0:
        fail("Invalid handoff size")

    repository = request_json(f"/repos/{identity['repository']}")
    artifact = request_json(f"/repos/{identity['repository']}/actions/artifacts/{artifact_id}")
    workflow_run = artifact.get("workflow_run") or {}
    if (
        str(artifact.get("id")) != artifact_id
        or artifact.get("name") != artifact_name
        or artifact.get("expired") is not False
        or normalized_digest(artifact.get("digest")) != expected_digest
        or str(workflow_run.get("id")) != identity["run_id"]
        or workflow_run.get("head_sha") != identity["source"]
        or workflow_run.get("repository_id") != repository.get("id")
        or workflow_run.get("head_repository_id") != repository.get("id")
    ):
        fail("GitHub artifact owner/run/source/digest identity mismatch")
    attempt = request_json(
        f"/repos/{identity['repository']}/actions/runs/{identity['run_id']}/attempts/{identity['run_attempt']}"
    )
    if (
        str(attempt.get("id")) != identity["run_id"]
        or str(attempt.get("run_attempt")) != identity["run_attempt"]
        or attempt.get("event") != "push"
        or attempt.get("head_sha") != identity["source"]
        or (attempt.get("head_repository") or {}).get("full_name") != identity["repository"]
    ):
        fail("GitHub workflow attempt identity mismatch")
    archive_url = artifact.get("archive_download_url")
    expected_prefix = f"{required('GITHUB_API_URL').rstrip('/')}/repos/{identity['repository']}/actions/artifacts/"
    if not isinstance(archive_url, str) or not archive_url.startswith(expected_prefix):
        fail("Artifact archive URL is outside the current repository")
    service_zip = request_bytes(archive_url)
    if normalized_digest(sha256(service_zip)) != expected_digest:
        fail("Downloaded GitHub artifact does not match the server digest")
    with zipfile.ZipFile(io_bytes(service_zip), "r") as archive:
        infos = archive.infolist()
        if [item.filename for item in infos] != [HANDOFF_NAME]:
            fail("GitHub artifact must contain exactly one publication handoff ZIP")
        info = infos[0]
        mode = zip_mode(info)
        if info.is_dir() or stat.S_ISLNK(mode) or (mode and not stat.S_ISREG(mode)):
            fail("GitHub artifact handoff entry is not a regular file")
        handoff = archive.read(info)
    if len(handoff) != expected_handoff_size or normalized_digest(sha256(handoff)) != expected_handoff_digest:
        fail("Publication handoff size or SHA-256 differs from the verified job output")

    version = identity["version"]
    expected_handoff_names = [
        "handoff.json",
        f"release/docwen-assistant-{version}.zip",
        "release/main.js",
        "release/manifest.json",
        "release/SHA256SUMS",
        "release/styles.css",
    ]
    entries = read_strict_zip(handoff, expected_handoff_names)
    try:
        document = json.loads(entries["handoff.json"].decode("utf-8", errors="strict"))
    except Exception as error:
        fail(f"Invalid publication handoff JSON: {error}")
    if entries["handoff.json"] != canonical_json_bytes(document):
        fail("Publication handoff JSON is not canonical")
    validate_handoff_document(document, identity, artifact_name)

    root = Path(required("RUNNER_TEMP")) / "docwen-assistant-publication"
    if root.exists():
        fail(f"Publication directory already exists: {root}")
    release_dir = root / "release"
    release_dir.mkdir(parents=True)
    records = {item["name"]: item for item in document["releaseAssets"]}
    local_assets: dict[str, bytes] = {}
    for name in release_names(version):
        data = entries[f"release/{name}"]
        record = records[name]
        if len(data) != record["size"] or sha256(data) != record["sha256"]:
            fail(f"Handoff asset differs from its signed inventory: {name}")
        target = release_dir / name
        target.write_bytes(data)
        target.chmod(0o600)
        local_assets[name] = data
    verify_release_assets(local_assets, version)
    metadata_path = root / "handoff.json"
    metadata_path.write_bytes(entries["handoff.json"])
    write_output("release_dir", str(release_dir))
    write_output("metadata_path", str(metadata_path))


def validate_handoff_document(document: object, identity: dict[str, str], artifact_name: str) -> None:
    if not isinstance(document, dict):
        fail("Publication handoff document must be an object")
    expected_keys = {
        "defaultBranch",
        "docwenCore",
        "mainBundleBudgetBytes",
        "previousReleaseTag",
        "publicationArtifactName",
        "releaseAssets",
        "repository",
        "runAttempt",
        "runId",
        "schemaVersion",
        "signerWorkflow",
        "sourceCommit",
        "sourceRef",
        "version",
    }
    if set(document) != expected_keys:
        fail("Publication handoff fields differ from the allowlist")
    previous = document.get("previousReleaseTag")
    if previous != "" and (not isinstance(previous, str) or not HISTORICAL_VERSION_RE.fullmatch(previous)):
        fail("Invalid previous stable Release tag in handoff")
    if (
        document.get("schemaVersion") != 1
        or document.get("repository") != identity["repository"]
        or document.get("sourceCommit") != identity["source"]
        or document.get("sourceRef") != identity["source_ref"]
        or document.get("runId") != identity["run_id"]
        or document.get("runAttempt") != identity["run_attempt"]
        or document.get("version") != identity["version"]
        or document.get("publicationArtifactName") != artifact_name
        or document.get("signerWorkflow") != f"{identity['repository']}/.github/workflows/release.yml"
        or document.get("mainBundleBudgetBytes") != BUNDLE_BUDGET
        or not re.fullmatch(r"[A-Za-z0-9._/-]+", str(document.get("defaultBranch") or ""))
    ):
        fail("Publication handoff identity does not match the current workflow")
    core = document.get("docwenCore")
    if not isinstance(core, dict) or set(core) != {"assetDigest", "tag", "version"}:
        fail("DocWen Core dependency identity is malformed")
    parse_version(str(core.get("tag") or ""))
    parse_version(str(core.get("version") or ""))
    normalized_digest(core.get("assetDigest"))
    records = document.get("releaseAssets")
    expected_names = release_names(identity["version"])
    if not isinstance(records, list) or [item.get("name") for item in records if isinstance(item, dict)] != expected_names:
        fail("Handoff release asset inventory/order differs from the five-asset contract")
    for record in records:
        if (
            not isinstance(record, dict)
            or set(record) != {"name", "sha256", "size"}
            or not DIGEST_RE.fullmatch(str(record.get("sha256") or ""))
            or not isinstance(record.get("size"), int)
            or record["size"] <= 0
        ):
            fail("Handoff release asset record is malformed")


def verify_release_assets(assets: dict[str, bytes], version: str) -> None:
    expected_names = release_names(version)
    if list(sorted(assets)) != expected_names:
        fail("Local release asset set differs from the five-asset contract")
    archive_name = f"docwen-assistant-{version}.zip"
    hashed_names = [archive_name, "main.js", "manifest.json", "styles.css"]
    expected_sums = "".join(f"{sha256(assets[name])}  {name}\n" for name in hashed_names).encode("utf-8")
    if assets["SHA256SUMS"] != expected_sums:
        fail("SHA256SUMS does not exactly match the four payload assets")
    install_names = [
        "docwen-assistant/main.js",
        "docwen-assistant/manifest.json",
        "docwen-assistant/styles.css",
    ]
    installed = read_strict_zip(assets[archive_name], install_names)
    for entry_name in install_names:
        loose_name = entry_name.split("/", 1)[1]
        if installed[entry_name] != assets[loose_name]:
            fail(f"Installation ZIP differs from loose asset: {loose_name}")
    try:
        manifest = json.loads(assets["manifest.json"].decode("utf-8", errors="strict"))
    except Exception as error:
        fail(f"Invalid manifest.json: {error}")
    if (
        manifest.get("id") != "docwen-assistant"
        or manifest.get("version") != version
        or manifest.get("minAppVersion") != "1.12.7"
        or manifest.get("isDesktopOnly") is not True
    ):
        fail("Plugin manifest identity/version/host boundary changed")
    if len(assets["main.js"]) > BUNDLE_BUDGET:
        fail("main.js exceeds the audited bundle budget")


def load_context() -> tuple[dict[str, str], dict[str, Any], Path, dict[str, bytes]]:
    identity = validate_identity_environment()
    metadata_path = Path(required("HANDOFF_METADATA_PATH"))
    release_dir = Path(required("RELEASE_DIR"))
    document = json.loads(metadata_path.read_text(encoding="utf-8"))
    validate_handoff_document(document, identity, required("EXPECTED_ARTIFACT_NAME"))
    assets = {name: (release_dir / name).read_bytes() for name in release_names(identity["version"])}
    verify_release_assets(assets, identity["version"])
    return identity, document, release_dir, assets


def resolve_tag_commit(repository: str, tag: str) -> str:
    reference = request_json(f"/repos/{repository}/git/ref/tags/{urllib.parse.quote(tag, safe='')}")
    target = reference.get("object") or {}
    for _ in range(4):
        object_type = target.get("type")
        object_sha = target.get("sha")
        if not COMMIT_RE.fullmatch(str(object_sha or "")):
            fail(f"Tag {tag} has an invalid Git object identity")
        if object_type == "commit":
            return object_sha
        if object_type != "tag":
            fail(f"Tag {tag} does not resolve to a commit")
        annotated = request_json(f"/repos/{repository}/git/tags/{object_sha}")
        target = annotated.get("object") or {}
    fail(f"Tag {tag} annotation depth exceeds the fail-closed limit")


def verify_ancestor(repository: str, base: str, head: str, label: str) -> None:
    comparison = request_json(f"/repos/{repository}/compare/{base}...{head}")
    if (comparison.get("merge_base_commit") or {}).get("sha") != base:
        fail(f"{label} is not an ancestor of the release source")


def verify_source(identity: dict[str, str], document: dict[str, Any]) -> None:
    repository = request_json(f"/repos/{identity['repository']}")
    if repository.get("private") is not False or repository.get("full_name") != identity["repository"]:
        fail("Publication repository identity or visibility changed")
    if repository.get("default_branch") != document["defaultBranch"]:
        fail("Repository default branch changed after read-only verification")
    tag_commit = resolve_tag_commit(identity["repository"], identity["version"])
    if tag_commit != identity["source"]:
        fail("Numeric release tag no longer resolves to the workflow source commit")
    branch = request_json(
        f"/repos/{identity['repository']}/branches/{urllib.parse.quote(document['defaultBranch'], safe='')}"
    )
    default_commit = (branch.get("commit") or {}).get("sha")
    if not COMMIT_RE.fullmatch(str(default_commit or "")):
        fail("Default branch head is unavailable")
    verify_ancestor(identity["repository"], identity["source"], default_commit, "Release source")


def fetch_stable_releases(repository: str) -> list[tuple[tuple[int, int, int], dict[str, Any]]]:
    stable: list[tuple[tuple[int, int, int], dict[str, Any]]] = []
    tags_by_version: dict[tuple[int, int, int], str] = {}
    for page in range(1, 101):
        batch = request_json(f"/repos/{repository}/releases?per_page=100&page={page}")
        if not isinstance(batch, list):
            fail("GitHub Releases response is not an array")
        for release in batch:
            release = validate_release_record(release)
            tag = release["tag_name"]
            if (
                HISTORICAL_VERSION_RE.fullmatch(tag)
                and release.get("draft") is False
                and release.get("prerelease") is False
            ):
                version = parse_historical_version(tag)
                previous_tag = tags_by_version.get(version)
                if previous_tag is not None:
                    fail(
                        f"Published stable Releases have ambiguous tags for "
                        f"{'.'.join(str(part) for part in version)}: "
                        f"{', '.join(sorted([previous_tag, tag]))}"
                    )
                tags_by_version[version] = tag
                stable.append((version, release))
        if len(batch) < 100:
            return stable
    fail("GitHub Releases pagination exceeds the fail-closed limit")


def verify_baseline(identity: dict[str, str], document: dict[str, Any]) -> None:
    candidate = parse_version(identity["version"])
    releases = fetch_stable_releases(identity["repository"])
    older: list[tuple[tuple[int, int, int], dict[str, Any]]] = []
    for version, release in releases:
        tag = release["tag_name"]
        if version > candidate or (version == candidate and tag != identity["version"]):
            fail(f"Published stable Release is not older than {identity['version']}: {tag}")
        if version < candidate:
            older.append((version, release))
    older.sort(key=lambda item: item[0], reverse=True)
    previous = older[0][1]["tag_name"] if older else ""
    if previous != document["previousReleaseTag"]:
        fail("Previous stable Release baseline changed after read-only verification")
    if previous:
        previous_commit = resolve_tag_commit(identity["repository"], previous)
        verify_ancestor(identity["repository"], previous_commit, identity["source"], f"Previous Release {previous}")


def verify_immutable(repository: str, tag: str) -> None:
    owner, name = repository.split("/", 1)
    data = graphql(
        "query($owner:String!,$name:String!,$tag:String!){repository(owner:$owner,name:$name){release(tagName:$tag){isImmutable}}}",
        {"owner": owner, "name": name, "tag": tag},
    )
    if (((data or {}).get("repository") or {}).get("release") or {}).get("isImmutable") is not True:
        fail("Release exists but GraphQL isImmutable is not true")


def verify_release_state(
    identity: dict[str, str], assets: dict[str, bytes], *, allow_missing: bool
) -> str:
    tag_path = urllib.parse.quote(identity["version"], safe="")
    release = request_json(
        f"/repos/{identity['repository']}/releases/tags/{tag_path}", allow_404=allow_missing
    )
    if release is None:
        return "create"
    release = validate_release_record(release)
    if (
        release.get("tag_name") != identity["version"]
        or release.get("draft") is not False
        or release.get("prerelease") is not False
        or release.get("immutable") is not True
        or not isinstance(release.get("published_at"), str)
        or not release["published_at"]
    ):
        fail("Same-tag Release is not a published immutable Release")
    verify_immutable(identity["repository"], identity["version"])
    remote_assets = release.get("assets")
    if not isinstance(remote_assets, list) or sorted(item.get("name") for item in remote_assets) != public_release_names(
        identity["version"]
    ):
        fail("Remote Release asset inventory differs from the four-public-asset contract")
    expected_url_prefix = f"{required('GITHUB_API_URL').rstrip('/')}/repos/{identity['repository']}/releases/assets/"
    expected_download_prefix = (
        f"https://github.com/{identity['repository']}/releases/download/{identity['version']}/"
    )
    for item in remote_assets:
        name = item["name"]
        local = assets[name]
        if (
            item.get("state") != "uploaded"
            or item.get("size") != len(local)
            or normalized_digest(item.get("digest")) != normalized_digest(sha256(local))
            or not str(item.get("url") or "").startswith(expected_url_prefix)
            or item.get("browser_download_url") != expected_download_prefix + urllib.parse.quote(name)
        ):
            fail(f"Remote Release asset metadata mismatch: {name}")
        remote = request_bytes(item["url"], accept="application/octet-stream")
        if remote != local:
            fail(f"Remote Release asset bytes differ: {name}")
    return "noop"


def command_before() -> None:
    identity, document, _release_dir, assets = load_context()
    verify_source(identity, document)
    verify_baseline(identity, document)
    decision = verify_release_state(identity, assets, allow_missing=True)
    write_output("decision", decision)
    write_output("previous_release_tag", document["previousReleaseTag"])
    print(f"Publication boundary decision: {decision}")


def command_source() -> None:
    identity, document, _release_dir, _assets = load_context()
    verify_source(identity, document)
    verify_baseline(identity, document)
    print("Release source and previous-Release ancestry re-verified")


def command_after() -> None:
    identity, document, _release_dir, assets = load_context()
    last_error: Exception | None = None
    for attempt in range(1, 11):
        try:
            verify_source(identity, document)
            verify_baseline(identity, document)
            if verify_release_state(identity, assets, allow_missing=False) != "noop":
                fail("Published Release unexpectedly disappeared")
            print("Final immutable Release state and bytes verified")
            return
        except Exception as error:  # finite eventual-consistency retry
            last_error = error
            if attempt == 10:
                break
            print(f"Final Release not yet verifiable ({attempt}/10): {error}")
            time.sleep(3)
    fail(f"Final Release verification exhausted retries: {last_error}")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {"handoff", "before", "source", "after"}:
        fail("Usage: publication-boundary.py <handoff|before|source|after>")
    command = sys.argv[1]
    if command == "handoff":
        command_handoff()
    elif command == "before":
        command_before()
    elif command == "source":
        command_source()
    else:
        command_after()


if __name__ == "__main__":
    try:
        main()
    except BoundaryError as error:
        print(f"publication boundary failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
