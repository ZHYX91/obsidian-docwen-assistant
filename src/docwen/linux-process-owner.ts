/** Own Linux descendants by process identity; protocol sessions only request cleanup. */
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { setTimeout as scheduleTimeout } from "node:timers";
import { LocalCliError } from "./errors";

const PROCESS_GROUP_POLL_MS = 25;

type LinuxProcessIssueKind =
  | "identity_changed"
  | "group_changed"
  | "proc_namespace_mismatch"
  | "proc_unreadable"
  | "task_changed"
  | "unknown_group_member";

type LinuxProcessGroupIssue = {
  kind: LinuxProcessIssueKind;
  systemCode?: string;
  identity?: LinuxProcessIdentity;
};

type LinuxProcessIdentity = {
  pid: number;
  startTime: string;
};

type LinuxProcessMetadata = LinuxProcessIdentity & {
  state: string;
  parentPid: number;
  processGroup: number;
  session: number;
};

type LinuxProcessGroupInspection = {
  members: LinuxProcessIdentity[];
  issues: LinuxProcessGroupIssue[];
};

export type LinuxProcessGroupEvidence = {
  hardIssues: LinuxProcessGroupIssue[];
};

export function bootstrapLinuxProcessIdentity(
  groupId: number,
  knownProcesses: Map<number, string>,
): void {
  try {
    const self = parseLinuxProcessMetadata(readFileSync("/proc/self/stat", "utf8"));
    if (self.pid !== process.pid) return;
    const root = parseLinuxProcessMetadata(readFileSync(`/proc/${groupId}/stat`, "utf8"));
    if (
      root.pid === groupId
      && root.processGroup === groupId
      && root.session === groupId
    ) {
      // A direct child can already have a zombie leader after pthread_exit
      // while its worker threads remain alive. State is therefore not an
      // ownership discriminator for the root identity.
      knownProcesses.set(root.pid, root.startTime);
    }
  } catch {
    // initialize/cleanup retries direct-root capture after spawn visibility.
  }
}

export async function captureLinuxProcessOwnership(
  groupId: number,
  knownProcesses: Map<number, string>,
  rootProcessExited: () => boolean,
): Promise<void> {
  const namespaceIssue = await linuxProcNamespaceIssue();
  if (namespaceIssue) throw linuxProcessGroupUnconfirmed({ members: [], issues: [namespaceIssue] });

  if (!knownProcesses.has(groupId) && !rootProcessExited()) {
    await recoverDirectLinuxRootIdentity(
      groupId,
      knownProcesses,
      rootProcessExited,
    );
  }
  if (knownProcesses.size === 0) {
    throw linuxProcessGroupUnconfirmed({
      members: [],
      issues: [{ kind: "identity_changed" }],
    });
  }
  const issues = await discoverKnownLinuxDescendants(groupId, knownProcesses);
  if (issues.length > 0) throw linuxProcessGroupUnconfirmed({ members: [], issues });
}

async function recoverDirectLinuxRootIdentity(
  groupId: number,
  knownProcesses: Map<number, string>,
  rootProcessExited: () => boolean,
): Promise<void> {
  if (rootProcessExited()) return;

  let root: LinuxProcessMetadata;
  try {
    root = await readLinuxProcessMetadata(groupId);
  } catch (error) {
    if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) return;
    throw linuxProcessGroupError("Unable to inspect the DocWen root process.", error);
  }

  if (rootProcessExited()) return;
  if (
    root.pid !== groupId
    || root.processGroup !== groupId
    || root.session !== groupId
  ) {
    throw linuxProcessGroupUnconfirmed({
      members: [],
      issues: [{ kind: "group_changed" }],
    });
  }

  // groupId is the PID returned by our detached spawn. While ChildProcess has
  // not emitted "exit", that direct-child lifetime cannot be replaced by an
  // unrelated process. Bind its current starttime; unknown group members never
  // use this recovery path.
  knownProcesses.set(groupId, root.startTime);
}

export async function signalLinuxProcessGroup(
  groupId: number,
  knownProcesses: Map<number, string>,
  evidence: LinuxProcessGroupEvidence,
  rootProcessExited: () => boolean,
  force: boolean,
): Promise<void> {
  const inspection = await inspectLinuxProcessGroup(
    groupId,
    knownProcesses,
    rootProcessExited(),
  );
  rememberHardLinuxIssues(evidence, inspection.issues);
  const issues = mergeLinuxIssues(inspection.issues, evidence.hardIssues);
  if (inspection.members.length === 0) {
    if (issues.length > 0) {
      throw linuxProcessGroupUnconfirmed({ members: [], issues });
    }
    return;
  }

  const anchor = await findCurrentLinuxSignalAnchor(
    groupId,
    inspection.members,
    rootProcessExited(),
  );
  if (!anchor) {
    const anchorIssue: LinuxProcessGroupIssue = { kind: "identity_changed" };
    rememberHardLinuxIssues(evidence, [anchorIssue]);
    throw linuxProcessGroupUnconfirmed({
      members: [],
      issues: mergeLinuxIssues(issues, evidence.hardIssues),
    });
  }
  try {
    process.kill(-groupId, force ? "SIGKILL" : "SIGTERM");
  } catch (error) {
    if (isErrno(error, "ESRCH")) return;
    throw linuxProcessGroupError("Unable to signal the DocWen process group.", error);
  }
}

export async function waitForLinuxProcessGroupExit(
  groupId: number,
  knownProcesses: Map<number, string>,
  evidence: LinuxProcessGroupEvidence,
  rootProcessExited: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const inspection = await inspectLinuxProcessGroup(
      groupId,
      knownProcesses,
      rootProcessExited(),
    );
    rememberHardLinuxIssues(evidence, inspection.issues);
    if (inspection.members.length === 0) {
      const issues = mergeLinuxIssues(inspection.issues, evidence.hardIssues);
      if (issues.length === 0) return true;
      // A procfs scan can outlive the direct child's exit observation. Retry
      // transient task/group changes within the existing bound; unreadable,
      // unknown, namespace or identity evidence must remain unconfirmed.
      if (evidence.hardIssues.length > 0 || Date.now() >= deadline) {
        throw linuxProcessGroupUnconfirmed({ members: [], issues });
      }
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    await waitMilliseconds(Math.min(PROCESS_GROUP_POLL_MS, remaining));
  }
}

async function inspectLinuxProcessGroup(
  groupId: number,
  knownProcesses: Map<number, string>,
  rootProcessExited: boolean,
): Promise<LinuxProcessGroupInspection> {
  const namespaceIssue = await linuxProcNamespaceIssue();
  if (namespaceIssue) return { members: [], issues: [namespaceIssue] };

  const descendantIssues = await discoverKnownLinuxDescendants(groupId, knownProcesses);
  let candidatePids: number[];
  let procEnumerationComplete = true;
  let issues: LinuxProcessGroupIssue[] = [...descendantIssues];
  try {
    candidatePids = (await readdir("/proc"))
      .filter((entry) => /^\d+$/u.test(entry))
      .map(Number);
  } catch (error) {
    procEnumerationComplete = false;
    candidatePids = [...knownProcesses.keys()];
    issues.push(linuxProcessGroupIssue(error));
  }

  const candidateSet = new Set(candidatePids);
  const confirmedDead = new Set<string>();
  let missingActiveRoot: LinuxProcessIdentity | null = null;
  if (procEnumerationComplete) {
    for (const [pid, startTime] of knownProcesses) {
      if (!candidateSet.has(pid)) {
        const identity = { pid, startTime };
        if (pid === groupId && !rootProcessExited) {
          missingActiveRoot = identity;
          issues.push({ kind: "task_changed", identity });
        } else {
          confirmedDead.add(linuxIdentityKey(identity));
        }
      }
    }
  }

  const members: LinuxProcessIdentity[] = [];
  if (missingActiveRoot) members.push(missingActiveRoot);
  for (const pid of candidateSet) {
    const expectedStartTime = knownProcesses.get(pid);
    try {
      const metadata = await readLinuxProcessMetadata(pid);
      if (expectedStartTime !== undefined) {
        const identity = { pid, startTime: expectedStartTime };
        if (metadata.startTime !== expectedStartTime) {
          issues.push({ kind: "identity_changed", identity });
          continue;
        }
        if (metadata.processGroup !== groupId || metadata.session !== groupId) {
          issues.push({ kind: "group_changed", identity });
          continue;
        }
        if (isLiveLinuxProcessState(metadata.state)) {
          members.push(identity);
          continue;
        }
        if (pid === groupId && rootProcessExited) {
          confirmedDead.add(linuxIdentityKey(identity));
          continue;
        }

        const taskInspection = await inspectLinuxProcessTasks(
          pid,
          identity,
          groupId,
        );
        issues.push(...taskInspection.issues);
        members.push(...taskInspection.members);
        if (taskInspection.members.length > 0) continue;
        if (pid === groupId && !rootProcessExited) {
          // Node has not observed the direct child process exit. The leader may
          // be a zombie after pthread_exit while other threads keep the same
          // process group alive. Keep the stable root identity as a signal
          // anchor regardless of task-directory visibility.
          members.push(identity);
          continue;
        }
        if (taskInspection.complete) {
          confirmedDead.add(linuxIdentityKey(identity));
        }
        continue;
      }
      if (
        metadata.processGroup === groupId
        && metadata.session === groupId
      ) {
        if (isLiveLinuxProcessState(metadata.state)) {
          issues.push({ kind: "unknown_group_member" });
          continue;
        }

        const unknownIdentity = { pid: metadata.pid, startTime: metadata.startTime };
        const taskInspection = await inspectLinuxProcessTasks(
          pid,
          unknownIdentity,
          groupId,
        );
        if (taskInspection.members.length > 0) {
          // Task liveness is evidence that this unknown process is still part
          // of the group, but it does not establish ownership. Never add it to
          // knownProcesses or use its task identities as signal anchors.
          issues.push({ kind: "unknown_group_member" });
          continue;
        }
        if (taskInspection.complete) {
          // A stable task snapshot with no live task is sufficient to ignore
          // this unknown dead process. It still never becomes owned.
          continue;
        }

        const hardTaskIssues = taskInspection.issues.filter(
          (issue) => issue.kind === "proc_unreadable",
        );
        if (hardTaskIssues.length > 0) {
          issues.push(...hardTaskIssues);
        } else {
          // Task topology changed or could not be completed. Without ownership
          // continuity, that uncertainty must remain an unknown group member.
          issues.push({ kind: "unknown_group_member" });
        }
      }
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
        if (expectedStartTime !== undefined) {
          const identity = { pid, startTime: expectedStartTime };
          if (pid === groupId && !rootProcessExited) {
            // /proc disappearance can race process teardown, but Node has not
            // observed the direct child exit yet. Keep the captured root
            // lifetime and report uncertainty rather than treating ENOENT as
            // whole-process exit proof.
            issues.push({ kind: "task_changed", identity });
          } else {
            confirmedDead.add(linuxIdentityKey(identity));
            knownProcesses.delete(pid);
          }
        }
        continue;
      }
      issues.push(linuxProcessGroupIssue(error));
    }
  }

  if (members.length === 0 && procEnumerationComplete) {
    issues = issues.filter((issue) => {
      if (
        (issue.kind !== "task_changed" && issue.kind !== "group_changed")
        || issue.identity === undefined
      ) {
        return true;
      }
      return !confirmedDead.has(linuxIdentityKey(issue.identity));
    });
  }
  return { members, issues };
}

async function inspectLinuxProcessTasks(
  processId: number,
  ownerIdentity: LinuxProcessIdentity,
  groupId: number,
): Promise<{
  members: LinuxProcessIdentity[];
  issues: LinuxProcessGroupIssue[];
  complete: boolean;
}> {
  let firstTaskIds: number[];
  try {
    firstTaskIds = (await readdir(`/proc/${processId}/task`))
      .filter((entry) => /^\d+$/u.test(entry))
      .map(Number);
  } catch (error) {
    if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
      return {
        members: [],
        issues: [{ kind: "task_changed", identity: ownerIdentity }],
        complete: false,
      };
    }
    return {
      members: [],
      issues: [linuxProcessGroupIssue(error)],
      complete: false,
    };
  }

  const first = new Map<number, LinuxProcessMetadata>();
  const issues: LinuxProcessGroupIssue[] = [];
  for (const taskId of new Set(firstTaskIds)) {
    try {
      first.set(taskId, await readLinuxTaskMetadata(processId, taskId));
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
        issues.push({ kind: "task_changed", identity: ownerIdentity });
      } else {
        issues.push(linuxProcessGroupIssue(error));
      }
    }
  }

  let secondTaskIds: number[];
  try {
    secondTaskIds = (await readdir(`/proc/${processId}/task`))
      .filter((entry) => /^\d+$/u.test(entry))
      .map(Number);
  } catch (error) {
    if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
      issues.push({ kind: "task_changed", identity: ownerIdentity });
    } else {
      issues.push(linuxProcessGroupIssue(error));
    }
    return { members: [], issues, complete: false };
  }

  const firstSet = new Set(firstTaskIds);
  const secondSet = new Set(secondTaskIds);
  if (
    firstSet.size !== secondSet.size
    || [...firstSet].some((taskId) => !secondSet.has(taskId))
  ) {
    issues.push({ kind: "task_changed", identity: ownerIdentity });
  }

  const members: LinuxProcessIdentity[] = [];
  for (const taskId of secondSet) {
    const before = first.get(taskId);
    if (!before) {
      issues.push({ kind: "task_changed", identity: ownerIdentity });
      continue;
    }
    try {
      const after = await readLinuxTaskMetadata(processId, taskId);
      if (
        after.pid !== before.pid
        || after.startTime !== before.startTime
        || after.processGroup !== before.processGroup
        || after.session !== before.session
      ) {
        issues.push({ kind: "task_changed", identity: ownerIdentity });
        continue;
      }
      if (after.processGroup !== groupId || after.session !== groupId) {
        issues.push({ kind: "group_changed", identity: ownerIdentity });
        continue;
      }
      if (isLiveLinuxProcessState(after.state)) {
        members.push({ pid: after.pid, startTime: after.startTime });
      }
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
        issues.push({ kind: "task_changed", identity: ownerIdentity });
      } else {
        issues.push(linuxProcessGroupIssue(error));
      }
    }
  }

  return {
    members,
    issues,
    complete: issues.length === 0,
  };
}

async function discoverKnownLinuxDescendants(
  groupId: number,
  knownProcesses: Map<number, string>,
): Promise<LinuxProcessGroupIssue[]> {
  const issues: LinuxProcessGroupIssue[] = [];
  const queue = [...knownProcesses.keys()];
  const visited = new Set<number>();
  while (queue.length > 0) {
    const pid = queue.shift();
    if (pid === undefined || visited.has(pid)) continue;
    visited.add(pid);
    const expectedStartTime = knownProcesses.get(pid);
    if (expectedStartTime === undefined) continue;
    const parentIdentity = { pid, startTime: expectedStartTime };

    let parentBefore: LinuxProcessMetadata;
    try {
      parentBefore = await readLinuxProcessMetadata(pid);
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
        // Keep the captured pid+starttime until the authoritative full /proc
        // scan in this inspection can prove that exact lifetime is gone.
        continue;
      }
      issues.push(linuxProcessGroupIssue(error));
      continue;
    }
    if (parentBefore.pid !== pid || parentBefore.startTime !== expectedStartTime) {
      issues.push({ kind: "identity_changed", identity: parentIdentity });
      continue;
    }
    if (parentBefore.processGroup !== groupId || parentBefore.session !== groupId) {
      issues.push({ kind: "group_changed", identity: parentIdentity });
      continue;
    }

    let taskIds: number[];
    try {
      taskIds = (await readdir(`/proc/${pid}/task`))
        .filter((entry) => /^\d+$/u.test(entry))
        .map(Number);
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
        issues.push({ kind: "task_changed", identity: parentIdentity });
      } else {
        issues.push(linuxProcessGroupIssue(error));
      }
      continue;
    }

    let childrenUnavailable = false;
    for (const taskId of new Set(taskIds)) {
      const taskIssues = await discoverLinuxTaskChildren(
        groupId,
        pid,
        taskId,
        parentIdentity,
        knownProcesses,
        queue,
      );
      if (taskIssues === "children_unavailable") {
        childrenUnavailable = true;
      } else {
        issues.push(...taskIssues);
      }
    }

    let parentUnchanged = false;
    try {
      const parentAfter = await readLinuxProcessMetadata(pid);
      if (parentAfter.pid !== pid || parentAfter.startTime !== expectedStartTime) {
        issues.push({ kind: "identity_changed", identity: parentIdentity });
      } else if (parentAfter.processGroup !== groupId || parentAfter.session !== groupId) {
        issues.push({ kind: "group_changed", identity: parentIdentity });
      } else if (parentAfter.parentPid !== parentBefore.parentPid) {
        issues.push({ kind: "task_changed", identity: parentIdentity });
      } else {
        parentUnchanged = true;
      }
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
        issues.push({ kind: "task_changed", identity: parentIdentity });
      } else {
        issues.push(linuxProcessGroupIssue(error));
      }
    }
    if (childrenUnavailable && parentUnchanged) {
      // PROC_CHILDREN is optional. Scan once per verified parent, not once
      // per task; PPID refers to the parent process even for a thread's child.
      issues.push(...await discoverLinuxChildrenFromProc(
        groupId,
        parentIdentity,
        knownProcesses,
        queue,
      ));
    }
  }
  return issues;
}

async function discoverLinuxTaskChildren(
  groupId: number,
  processId: number,
  taskId: number,
  ownerIdentity: LinuxProcessIdentity,
  knownProcesses: Map<number, string>,
  queue: number[],
): Promise<LinuxProcessGroupIssue[] | "children_unavailable"> {
  const issues: LinuxProcessGroupIssue[] = [];
  let taskBefore: LinuxProcessMetadata;
  try {
    taskBefore = await readLinuxTaskMetadata(processId, taskId);
  } catch (error) {
    if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
      return [{ kind: "task_changed", identity: ownerIdentity }];
    }
    return [linuxProcessGroupIssue(error)];
  }
  if (taskBefore.pid !== taskId) {
    return [{ kind: "task_changed", identity: ownerIdentity }];
  }
  if (taskBefore.processGroup !== groupId || taskBefore.session !== groupId) {
    return [{ kind: "group_changed", identity: ownerIdentity }];
  }

  let children: string | null = null;
  try {
    children = await readFile(`/proc/${processId}/task/${taskId}/children`, "utf8");
  } catch (error) {
    if (isErrno(error, "ESRCH")) {
      return [{ kind: "task_changed", identity: ownerIdentity }];
    }
    if (!isErrno(error, "ENOENT")) return [linuxProcessGroupIssue(error)];
  }

  let taskAfter: LinuxProcessMetadata;
  try {
    taskAfter = await readLinuxTaskMetadata(processId, taskId);
  } catch (error) {
    if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
      return [{ kind: "task_changed", identity: ownerIdentity }];
    }
    return [linuxProcessGroupIssue(error)];
  }
  if (
    taskAfter.pid !== taskBefore.pid
    || taskAfter.startTime !== taskBefore.startTime
    || taskAfter.parentPid !== taskBefore.parentPid
    || taskAfter.processGroup !== taskBefore.processGroup
    || taskAfter.session !== taskBefore.session
  ) {
    return [{ kind: "task_changed", identity: ownerIdentity }];
  }
  if (children === null) {
    // ENOENT is an absent interface only when the same task is still live
    // on both sides of the read. A disappearing task must not enable fallback.
    return isLiveLinuxProcessState(taskBefore.state) && isLiveLinuxProcessState(taskAfter.state)
      ? "children_unavailable"
      : [{ kind: "task_changed", identity: ownerIdentity }];
  }

  for (const child of children.trim().split(/\s+/u)) {
    if (!/^\d+$/u.test(child)) continue;
    const childPid = Number(child);
    const existingStartTime = knownProcesses.get(childPid);
    try {
      const metadata = await readLinuxProcessMetadata(childPid);
      if (
        metadata.processGroup !== groupId
        || metadata.session !== groupId
        || !isLiveLinuxProcessState(metadata.state)
      ) {
        if (existingStartTime !== undefined) {
          issues.push({
            kind: "group_changed",
            identity: { pid: childPid, startTime: existingStartTime },
          });
        }
        continue;
      }
      if (existingStartTime !== undefined && metadata.startTime !== existingStartTime) {
        issues.push({
          kind: "identity_changed",
          identity: { pid: childPid, startTime: existingStartTime },
        });
        continue;
      }
      if (existingStartTime === undefined) {
        knownProcesses.set(childPid, metadata.startTime);
      }
      queue.push(childPid);
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) continue;
      issues.push(linuxProcessGroupIssue(error));
    }
  }
  return issues;
}

async function discoverLinuxChildrenFromProc(
  groupId: number,
  ownerIdentity: LinuxProcessIdentity,
  knownProcesses: Map<number, string>,
  queue: number[],
): Promise<LinuxProcessGroupIssue[]> {
  const issues: LinuxProcessGroupIssue[] = [];
  let parentBefore: LinuxProcessMetadata;
  let candidatePids: number[];
  try {
    parentBefore = await readLinuxProcessMetadata(ownerIdentity.pid);
    if (
      parentBefore.pid !== ownerIdentity.pid
      || parentBefore.startTime !== ownerIdentity.startTime
    ) return [{ kind: "identity_changed", identity: ownerIdentity }];
    if (parentBefore.processGroup !== groupId || parentBefore.session !== groupId) {
      return [{ kind: "group_changed", identity: ownerIdentity }];
    }
    candidatePids = (await readdir("/proc"))
      .filter((entry) => /^\d+$/u.test(entry))
      .map(Number);
  } catch (error) {
    if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
      return [{ kind: "task_changed", identity: ownerIdentity }];
    }
    return [linuxProcessGroupIssue(error)];
  }

  for (const childPid of new Set(candidatePids)) {
    if (childPid === ownerIdentity.pid) continue;
    let childBefore: LinuxProcessMetadata;
    try {
      childBefore = await readLinuxProcessMetadata(childPid);
    } catch (error) {
      if (!isErrno(error, "ENOENT") && !isErrno(error, "ESRCH")) {
        issues.push(linuxProcessGroupIssue(error));
      }
      continue;
    }
    // Group membership is a constraint, never a substitute for ancestry.
    if (childBefore.parentPid !== ownerIdentity.pid) continue;
    const childIdentity = { pid: childPid, startTime: childBefore.startTime };
    if (childBefore.pid !== childPid) {
      issues.push({ kind: "identity_changed", identity: childIdentity });
      continue;
    }
    if (childBefore.processGroup !== groupId || childBefore.session !== groupId) continue;

    try {
      const childAfter = await readLinuxProcessMetadata(childPid);
      const parentAfter = await readLinuxProcessMetadata(ownerIdentity.pid);
      if (
        parentAfter.pid !== parentBefore.pid
        || parentAfter.startTime !== parentBefore.startTime
        || childAfter.pid !== childBefore.pid
        || childAfter.startTime !== childBefore.startTime
      ) {
        issues.push({ kind: "identity_changed", identity: childIdentity });
        continue;
      }
      if (
        parentAfter.processGroup !== groupId
        || parentAfter.session !== groupId
        || childAfter.processGroup !== groupId
        || childAfter.session !== groupId
      ) {
        issues.push({ kind: "group_changed", identity: childIdentity });
        continue;
      }
      if (
        parentAfter.parentPid !== parentBefore.parentPid
        || childAfter.parentPid !== childBefore.parentPid
      ) {
        issues.push({ kind: "task_changed", identity: ownerIdentity });
        continue;
      }
      const namespaceIssue = await linuxProcNamespaceIssue();
      if (namespaceIssue) return [...issues, namespaceIssue];
      const existingStartTime = knownProcesses.get(childPid);
      if (existingStartTime !== undefined && existingStartTime !== childAfter.startTime) {
        issues.push({ kind: "identity_changed", identity: { pid: childPid, startTime: existingStartTime } });
        continue;
      }
      // Commit only after both lifetimes and their parent relation survive all
      // checks. A zombie leader can have live threads; inspection decides liveness.
      knownProcesses.set(childPid, childAfter.startTime);
      queue.push(childPid);
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) {
        issues.push({ kind: "task_changed", identity: ownerIdentity });
      } else {
        issues.push(linuxProcessGroupIssue(error));
      }
    }
  }
  return issues;
}

async function readLinuxTaskMetadata(
  processId: number,
  taskId: number,
): Promise<LinuxProcessMetadata> {
  return parseLinuxProcessMetadata(
    await readFile(`/proc/${processId}/task/${taskId}/stat`, "utf8"),
  );
}

async function linuxProcNamespaceIssue(): Promise<LinuxProcessGroupIssue | null> {
  try {
    const self = parseLinuxProcessMetadata(await readFile("/proc/self/stat", "utf8"));
    return self.pid === process.pid ? null : { kind: "proc_namespace_mismatch" };
  } catch (error) {
    return linuxProcessGroupIssue(error);
  }
}

async function findCurrentLinuxSignalAnchor(
  groupId: number,
  members: readonly LinuxProcessIdentity[],
  rootProcessExited: boolean,
): Promise<LinuxProcessIdentity | null> {
  for (const member of members) {
    try {
      const metadata = await readLinuxProcessMetadata(member.pid);
      if (
        metadata.startTime === member.startTime
        && metadata.processGroup === groupId
        && metadata.session === groupId
        && (
          isLiveLinuxProcessState(metadata.state)
          || (member.pid === groupId && !rootProcessExited)
        )
      ) {
        return member;
      }
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ESRCH")) continue;
      return null;
    }
  }
  return null;
}

async function readLinuxProcessMetadata(pid: number): Promise<LinuxProcessMetadata> {
  return parseLinuxProcessMetadata(await readFile(`/proc/${pid}/stat`, "utf8"));
}

function parseLinuxProcessMetadata(raw: string): LinuxProcessMetadata {
  const openingParen = raw.indexOf("(");
  const closingParen = raw.lastIndexOf(")");
  if (openingParen < 1 || closingParen <= openingParen) {
    throw new LocalCliError("cli_cleanup_failed", "Linux process metadata is malformed.");
  }
  const pid = Number(raw.slice(0, openingParen).trim());
  const fields = raw.slice(closingParen + 1).trim().split(/\s+/u);
  const parentPid = Number(fields[1]);
  const processGroup = Number(fields[2]);
  const session = Number(fields[3]);
  const startTime = fields[19] ?? "";
  if (
    !Number.isSafeInteger(pid)
    || pid <= 0
    || !Number.isSafeInteger(parentPid)
    || parentPid < 0
    || !Number.isSafeInteger(processGroup)
    || !Number.isSafeInteger(session)
    || !/^\d+$/u.test(startTime)
  ) {
    throw new LocalCliError("cli_cleanup_failed", "Linux process metadata is malformed.");
  }
  return {
    pid,
    state: fields[0] ?? "",
    parentPid,
    processGroup,
    session,
    startTime,
  };
}

function isLiveLinuxProcessState(state: string): boolean {
  return state !== "Z" && state !== "X" && state !== "x";
}

function linuxProcessGroupIssue(error: unknown): LinuxProcessGroupIssue {
  const systemCode = systemErrorCode(error);
  return { kind: "proc_unreadable", ...(systemCode ? { systemCode } : {}) };
}

function linuxProcessGroupUnconfirmed(inspection: LinuxProcessGroupInspection): LocalCliError {
  const systemCode = inspection.issues.map((issue) => issue.systemCode).find((code) => code !== undefined);
  const ownershipIssue = primaryLinuxOwnershipIssue(inspection.issues);
  return new LocalCliError(
    "cli_cleanup_failed",
    "Unable to confirm that every owned DocWen process-group member exited.",
    {
      cleanupState: "unconfirmed",
      ownershipState: "unconfirmed",
      unconfirmedEvidenceCount: inspection.issues.length,
      ...(ownershipIssue ? { ownershipIssue } : {}),
      ...(systemCode ? { systemCode } : {}),
    },
  );
}

function primaryLinuxOwnershipIssue(
  issues: readonly LinuxProcessGroupIssue[],
): LinuxProcessIssueKind | undefined {
  const priority: readonly LinuxProcessIssueKind[] = [
    "proc_namespace_mismatch",
    "identity_changed",
    "proc_unreadable",
    "unknown_group_member",
    "group_changed",
    "task_changed",
  ];
  return priority.find((kind) => issues.some((issue) => issue.kind === kind));
}

function rememberHardLinuxIssues(
  evidence: LinuxProcessGroupEvidence,
  issues: readonly LinuxProcessGroupIssue[],
): void {
  for (const issue of issues) {
    if (issue.kind === "task_changed" || issue.kind === "group_changed") continue;
    const key = linuxIssueKey(issue);
    if (!evidence.hardIssues.some((existing) => linuxIssueKey(existing) === key)) {
      evidence.hardIssues.push(issue);
    }
  }
}

function mergeLinuxIssues(
  current: readonly LinuxProcessGroupIssue[],
  hard: readonly LinuxProcessGroupIssue[],
): LinuxProcessGroupIssue[] {
  const merged: LinuxProcessGroupIssue[] = [];
  for (const issue of [...current, ...hard]) {
    const key = linuxIssueKey(issue);
    if (!merged.some((existing) => linuxIssueKey(existing) === key)) merged.push(issue);
  }
  return merged;
}

function linuxIssueKey(issue: LinuxProcessGroupIssue): string {
  return [
    issue.kind,
    issue.systemCode ?? "",
    issue.identity?.pid ?? "",
    issue.identity?.startTime ?? "",
  ].join(":");
}

function linuxIdentityKey(identity: LinuxProcessIdentity): string {
  return `${identity.pid}:${identity.startTime}`;
}

function linuxProcessGroupError(message: string, error: unknown): LocalCliError {
  const systemCode = systemErrorCode(error);
  return new LocalCliError("cli_cleanup_failed", message, systemCode ? { systemCode } : {});
}

function waitMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    scheduleTimeout(resolve, milliseconds);
  });
}

function systemErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
