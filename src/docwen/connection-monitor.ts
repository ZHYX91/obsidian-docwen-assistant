import type { DocWenConnectionMode } from "../settings-model";
import type { HealthReport } from "./client";
import type { DocWenConnectionStatus } from "./connection-status";
import { LocalCliError } from "./errors";

type ConnectionCheckRequest = {
  readonly abortCleanups: Set<() => void>;
  readonly controller: AbortController;
  readonly generation: number;
  readonly promise: Promise<HealthReport>;
};

export class DocWenConnectionMonitor {
  private status: DocWenConnectionStatus = { state: "unchecked" };
  private generation = 0;
  private request: ConnectionCheckRequest | null = null;

  constructor(
    private readonly resolveMode: () => DocWenConnectionMode,
    private readonly checkHealth: (signal?: AbortSignal) => Promise<HealthReport>,
  ) {}

  getStatus(): DocWenConnectionStatus {
    return this.status;
  }

  reset(): void {
    ++this.generation;
    this.cancelRequest(this.request);
    this.request = null;
    this.status = { state: "unchecked" };
  }

  check(signal?: AbortSignal): Promise<HealthReport> {
    if (signal?.aborted) {
      return Promise.reject(new LocalCliError("cli_cancelled", "DocWen connection check was cancelled."));
    }
    const current = this.request;
    if (current?.generation === this.generation && !current.controller.signal.aborted) {
      this.linkAbortSignal(signal, current);
      return current.promise;
    }
    if (current) {
      this.cancelRequest(current);
      if (this.request === current) this.request = null;
    }

    const generation = ++this.generation;
    const mode = this.resolveMode();
    const controller = new AbortController();
    const abortCleanups = new Set<() => void>();
    this.status = { state: "checking", mode };
    let request!: ConnectionCheckRequest;
    const promise = this.runCheck(mode, generation, controller).finally(() => {
      for (const cleanup of abortCleanups) cleanup();
      abortCleanups.clear();
      if (this.request === request) this.request = null;
    });
    request = { abortCleanups, controller, generation, promise };
    this.request = request;
    this.linkAbortSignal(signal, request);
    return promise;
  }

  dispose(): void {
    this.reset();
  }

  private async runCheck(
    mode: DocWenConnectionMode,
    generation: number,
    controller: AbortController,
  ): Promise<HealthReport> {
    try {
      const report = await this.checkHealth(controller.signal);
      if (generation !== this.generation || controller.signal.aborted) {
        throw new LocalCliError("cli_cancelled", "DocWen connection check was cancelled.");
      }
      if (!report.allOk) {
        throw new LocalCliError("cli_health_failed", "DocWen reported a failed health check.", {
          checks: report.checks,
        });
      }
      if (generation === this.generation) {
        this.status = { state: "connected", mode, productVersion: report.productVersion };
      }
      return report;
    } catch (error) {
      if (generation === this.generation) {
        this.status = controller.signal.aborted
          ? { state: "unchecked" }
          : {
              state: "error",
              mode,
              code: error instanceof LocalCliError ? error.code : "cli_spawn_failed",
            };
      }
      throw error;
    }
  }

  private linkAbortSignal(signal: AbortSignal | undefined, request: ConnectionCheckRequest): void {
    if (!signal) return;
    const abort = () => request.controller.abort();
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    request.abortCleanups.add(() => signal.removeEventListener("abort", abort));
  }

  private cancelRequest(request: ConnectionCheckRequest | null): void {
    if (!request) return;
    request.controller.abort();
    for (const cleanup of request.abortCleanups) cleanup();
    request.abortCleanups.clear();
  }
}
