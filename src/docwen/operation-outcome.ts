import { LocalCliError } from "./errors";

export type OperationWarningCode =
  | "task_cleanup_failed"
  | "input_cleanup_failed"
  | "output_cleanup_failed"
  | "post_publish_failed";

/** Safe diagnostic facts; raw exception text can contain paths or document text. */
export interface OperationWarning {
  readonly code: OperationWarningCode;
  readonly phase: "cleanup" | "post_publish";
  readonly detailCode?: string;
}

export interface Completed<T> {
  value: T;
  warnings: OperationWarning[];
}

const failureWarnings = new WeakMap<object, OperationWarning[]>();

export function recordFailureWarning(error: unknown, warning: OperationWarning): unknown {
  if (typeof error === "object" && error !== null) {
    failureWarnings.set(error, [...(failureWarnings.get(error) ?? []), warning]);
  }
  return error;
}

export function getFailureWarnings(error: unknown): readonly OperationWarning[] {
  return typeof error === "object" && error !== null ? failureWarnings.get(error) ?? [] : [];
}

export function operationWarning(code: OperationWarningCode, error: unknown): OperationWarning {
  const detailCode = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  return {
    code,
    phase: code === "post_publish_failed" ? "post_publish" : "cleanup",
    ...(typeof detailCode === "string" && /^[a-zA-Z0-9_.-]{1,64}$/u.test(detailCode) ? { detailCode } : {}),
  };
}

/** Only the owned commit determines publication; host callbacks cannot invent or undo it. */
export async function publishOnce<T>(
  commit: () => Promise<T>,
  publish?: (commit: () => Promise<T>) => Promise<unknown>,
): Promise<Completed<T>> {
  const state: { attempt: Promise<T> | null; completed: Completed<T> | null } = { attempt: null, completed: null };
  const guardedCommit = (): Promise<T> => {
    if (state.attempt) return Promise.reject(new LocalCliError("cli_commit_failed", "Publication can be attempted only once."));
    state.attempt = Promise.resolve().then(commit).then((value) => {
      state.completed = { value, warnings: [] };
      return value;
    });
    // A host can throw or return before awaiting its commit. Keep that attempt owned.
    void state.attempt.catch(() => undefined);
    return state.attempt;
  };
  let failure: { error: unknown } | null = null;
  try {
    if (publish) await publish(guardedCommit);
    else await guardedCommit();
  } catch (error) {
    failure = { error };
  }
  if (state.attempt) {
    try {
      await state.attempt;
    } catch (error) {
      failure = { error };
    }
  }
  if (state.completed) {
    if (failure) state.completed.warnings.push(operationWarning("post_publish_failed", failure.error));
    return state.completed;
  }
  if (failure) throw failure.error;
  throw new LocalCliError("cli_commit_failed", "The host did not publish the prepared output.");
}
