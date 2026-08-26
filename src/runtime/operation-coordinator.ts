import { LocalCliError } from "../docwen";

export type OperationKind = "proofread" | "export" | "numbering" | "doctor" | "gui-control";
export type OperationState = "running" | "cancelling";

export interface OperationRequest {
  /** Internal latest-run-wins key. It is never exposed through snapshots. */
  readonly key: string;
  /** Safe, localized UI category. It must not contain file or Vault names. */
  readonly kind: OperationKind;
}

export interface OperationItem {
  readonly generation: number;
  readonly kind: OperationKind;
  readonly state: OperationState;
}

export interface OperationSnapshot {
  readonly operations: readonly OperationItem[];
}

export interface OperationLease {
  readonly signal: AbortSignal;
  readonly generation: number;
  isCurrent(): boolean;
  finish(): void;
}

type ActiveOperation = {
  readonly key: string;
  readonly kind: OperationKind;
  readonly controller: AbortController;
  readonly generation: number;
  state: OperationState;
};

type OperationListener = (snapshot: OperationSnapshot) => void;

/** Owns latest-run-wins cancellation, observable UI state, and unload settlement. */
export class OperationCoordinator {
  private readonly active = new Map<number, ActiveOperation>();
  private readonly latestByKey = new Map<string, number>();
  private readonly listeners = new Set<OperationListener>();
  private generation = 0;
  private disposed = false;

  begin(request: OperationRequest): OperationLease {
    if (this.disposed) throw new LocalCliError("cli_cancelled", "DocWen Assistant is unloading.");
    const previousGeneration = this.latestByKey.get(request.key);
    if (previousGeneration !== undefined) {
      this.cancelActive(
        previousGeneration,
        new LocalCliError("cli_cancelled", "A newer operation replaced this one."),
      );
    }

    const controller = new AbortController();
    const generation = ++this.generation;
    const operation: ActiveOperation = {
      key: request.key,
      kind: request.kind,
      controller,
      generation,
      state: "running",
    };
    this.active.set(generation, operation);
    this.latestByKey.set(request.key, generation);
    this.notify();

    let finished = false;
    return {
      signal: controller.signal,
      generation,
      isCurrent: () => this.latestByKey.get(request.key) === generation && !controller.signal.aborted,
      finish: () => {
        if (finished) return;
        finished = true;
        this.active.delete(generation);
        if (this.latestByKey.get(request.key) === generation) this.latestByKey.delete(request.key);
        this.notify();
      },
    };
  }

  getSnapshot(): OperationSnapshot {
    return {
      operations: [...this.active.values()]
        .sort((left, right) => left.generation - right.generation)
        .map(({ generation, kind, state }) => ({ generation, kind, state })),
    };
  }

  subscribe(listener: OperationListener): () => void {
    this.listeners.add(listener);
    this.callListener(listener);
    return () => this.listeners.delete(listener);
  }

  cancelGeneration(generation: number): boolean {
    return this.cancelActive(
      generation,
      new LocalCliError("cli_cancelled", "Operation cancelled."),
    );
  }

  cancelAll(): number {
    let cancelled = 0;
    for (const operation of this.active.values()) {
      if (operation.state !== "running") continue;
      if (this.cancelActive(
        operation.generation,
        new LocalCliError("cli_cancelled", "All operations cancelled."),
      )) cancelled += 1;
    }
    return cancelled;
  }

  /** Key-based internal cancellation; UI callers should use generations. */
  cancel(key: string): boolean {
    const generation = this.latestByKey.get(key);
    return generation === undefined ? false : this.cancelGeneration(generation);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const operation of this.active.values()) {
      operation.controller.abort(new LocalCliError("cli_cancelled", "DocWen Assistant unloaded."));
    }
    this.active.clear();
    this.latestByKey.clear();
    this.notify();
    this.listeners.clear();
  }

  private cancelActive(generation: number, reason: LocalCliError): boolean {
    const operation = this.active.get(generation);
    if (!operation || operation.state === "cancelling") return false;
    operation.state = "cancelling";
    operation.controller.abort(reason);
    this.notify();
    return true;
  }

  private notify(): void {
    for (const listener of [...this.listeners]) this.callListener(listener);
  }

  private callListener(listener: OperationListener): void {
    try {
      listener(this.getSnapshot());
    } catch {
      // One host/UI listener must never break cancellation or other listeners.
    }
  }
}
