import { spawnSync } from "node:child_process";

import { RELEASE_VERSION_PATTERN } from "./release-assets.mjs";

const [mode, releaseTag, previousReleaseTag = ""] = process.argv.slice(2);
if (!new Set(["preflight", "release", "previous-ancestor"]).has(mode) || !RELEASE_VERSION_PATTERN.test(releaseTag ?? "")) {
  throw new Error(
    "Usage: verify-release-source.mjs <preflight|release> <x.y.z> | previous-ancestor <x.y.z> [previous-tag]",
  );
}

const expectedCommit = resolveCommit(requiredEnvironment("GITHUB_SHA"));
const checkoutCommit = resolveCommit("HEAD");
if (checkoutCommit !== expectedCommit) {
  throw new Error("The checked-out commit does not match the workflow event commit");
}

if (mode === "previous-ancestor") {
  verifyPreviousReleaseAncestor({ expectedCommit, previousReleaseTag, releaseTag });
  process.exit(0);
}

const defaultBranch = requiredEnvironment("GITHUB_DEFAULT_BRANCH");
git(["check-ref-format", `refs/heads/${defaultBranch}`]);
const remoteDefaultRef = `refs/heads/${defaultBranch}`;
const localDefaultRef = `refs/remotes/origin/${defaultBranch}`;
const defaultBeforeFetch = resolveSingleRemoteRef(remoteDefaultRef);
git(["fetch", "--no-tags", "origin", `+${remoteDefaultRef}:${localDefaultRef}`]);
const fetchedDefaultCommit = resolveCommit(localDefaultRef);
const defaultAfterFetch = resolveSingleRemoteRef(remoteDefaultRef);
if (defaultBeforeFetch !== defaultAfterFetch || fetchedDefaultCommit !== defaultAfterFetch) {
  throw new Error("The remote default branch changed while the release source was being verified");
}

if (mode === "preflight") {
  verifyPreflightSource({
    defaultBranch,
    expectedCommit,
    fetchedDefaultCommit,
    releaseTag,
  });
} else {
  verifyReleaseSource({
    expectedCommit,
    fetchedDefaultCommit,
    releaseTag,
  });
}

function verifyPreflightSource({ defaultBranch, expectedCommit, fetchedDefaultCommit, releaseTag }) {
  if (requiredEnvironment("GITHUB_REF") !== `refs/heads/${defaultBranch}`) {
    throw new Error("Release preflight must be dispatched from the repository default branch");
  }
  if (expectedCommit !== fetchedDefaultCommit) {
    throw new Error("Release preflight must run against the current remote default-branch head");
  }
  const tagRef = `refs/tags/${releaseTag}`;
  const existingTag = git(["ls-remote", "origin", tagRef, `${tagRef}^{}`]);
  if (existingTag.length > 0) {
    throw new Error(`Release preflight requires an unused tag: ${releaseTag}`);
  }
  console.log(`Release preflight source verified at ${expectedCommit}: ${defaultBranch}, unused tag ${releaseTag}`);
}

function verifyReleaseSource({ expectedCommit, fetchedDefaultCommit, releaseTag }) {
  const tagRef = `refs/tags/${releaseTag}`;
  if (requiredEnvironment("GITHUB_REF") !== tagRef) {
    throw new Error(`Release workflow must run from ${tagRef}`);
  }
  const remoteTagCommit = resolveRemoteTagCommit(tagRef);
  if (remoteTagCommit !== expectedCommit) {
    throw new Error("The remote release tag does not point to the workflow event commit");
  }
  const ancestry = gitResult(["merge-base", "--is-ancestor", expectedCommit, fetchedDefaultCommit]);
  if (ancestry.status === 1) {
    throw new Error("The release commit is not reachable from the current remote default branch");
  }
  requireSuccess(ancestry, "git merge-base --is-ancestor");
  console.log(`Release source verified at ${expectedCommit}: ${tagRef} is reachable from the default branch`);
}

function verifyPreviousReleaseAncestor({ expectedCommit, previousReleaseTag, releaseTag }) {
  if (previousReleaseTag === "") {
    console.log(`Previous Release ancestor check verified: ${releaseTag} is the first published stable Release`);
    return;
  }
  const previous = parseHistoricalStableTag(previousReleaseTag);
  const candidate = parseStableTag(releaseTag);
  if (compareVersion(previous, candidate) >= 0) {
    throw new Error(`Previous stable Release is not older than ${releaseTag}: ${previousReleaseTag}`);
  }
  const previousRef = `refs/tags/${previousReleaseTag}`;
  const remotePreviousCommit = resolveRemoteTagCommit(previousRef);
  git(["fetch", "--no-tags", "origin", previousRef]);
  const fetchedPreviousCommit = resolveCommit("FETCH_HEAD");
  if (fetchedPreviousCommit !== remotePreviousCommit) {
    throw new Error("Fetched previous stable Release tag differs from the remote tag object");
  }
  const ancestry = gitResult(["merge-base", "--is-ancestor", fetchedPreviousCommit, expectedCommit]);
  if (ancestry.status === 1) {
    throw new Error(`Previous stable Release ${previousReleaseTag} is not an ancestor of ${expectedCommit}`);
  }
  requireSuccess(ancestry, "git merge-base --is-ancestor previous stable Release");
  console.log(`Previous stable Release ancestor verified: ${previousReleaseTag} -> ${expectedCommit}`);
}

function parseStableTag(tag) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(tag ?? "");
  if (!match) throw new Error(`Invalid stable Release tag: ${String(tag ?? "")}`);
  return match.slice(1, 4);
}

function parseHistoricalStableTag(tag) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(tag ?? "");
  if (!match) throw new Error(`Invalid previous stable Release tag: ${String(tag ?? "")}`);
  return match.slice(1, 4);
}

function compareVersion(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index].length !== right[index].length) return Math.sign(left[index].length - right[index].length);
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

function resolveCommit(revision) {
  return git(["rev-parse", `${revision}^{commit}`]);
}

function resolveSingleRemoteRef(reference) {
  const output = git(["ls-remote", "--exit-code", "origin", reference]);
  const matches = parseRemoteRefs(output).filter(({ ref }) => ref === reference);
  if (matches.length !== 1) {
    throw new Error(`Remote reference did not resolve exactly once: ${reference}`);
  }
  return matches[0].object;
}

function resolveRemoteTagCommit(tagRef) {
  const output = git(["ls-remote", "--exit-code", "origin", tagRef, `${tagRef}^{}`]);
  const references = parseRemoteRefs(output);
  const tagObjects = references.filter(({ ref }) => ref === tagRef);
  const peeledCommits = references.filter(({ ref }) => ref === `${tagRef}^{}`);
  if (tagObjects.length !== 1 || peeledCommits.length > 1) {
    throw new Error("The remote release tag did not resolve to one unambiguous object");
  }
  return peeledCommits[0]?.object ?? tagObjects[0].object;
}

function parseRemoteRefs(output) {
  if (!output) return [];
  return output.split(/\r?\n/u).map((line) => {
    const [object, ref, ...extra] = line.split("\t");
    if (!object || !ref || extra.length > 0) {
      throw new Error(`Invalid git ls-remote output: ${line}`);
    }
    return { object, ref };
  });
}

function git(arguments_) {
  const result = gitResult(arguments_);
  requireSuccess(result, `git ${arguments_.join(" ")}`);
  return result.stdout.trim();
}

function gitResult(arguments_) {
  const result = spawnSync("git", arguments_, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  return result;
}

function requireSuccess(result, label) {
  if (result.status !== 0) {
    const diagnostic = result.stderr.trim() || result.stdout.trim() || `exit ${String(result.status)}`;
    throw new Error(`${label} failed: ${diagnostic}`);
  }
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
