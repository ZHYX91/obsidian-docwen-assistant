import { clearTimeout, setTimeout } from "node:timers";

import { LocalCliError } from "./errors";

/** Store activation and an owned Machine Job cannot attach concurrently. */
export class DocWenProcessCoordinator {
  private busy = false;
  private readonly waiting: Array<() => void> = [];

  async run<T>(operation: () => Promise<T>, signals: readonly (AbortSignal | undefined)[], timeoutMs: number): Promise<T> {
    const release = await this.acquire(signals, timeoutMs);
    try {
      if (signals.some((signal) => signal?.aborted)) throw this.cancelled();
      return await operation();
    } finally {
      release();
    }
  }

  private acquire(signals: readonly (AbortSignal | undefined)[], timeoutMs: number): Promise<() => void> {
    if (signals.some((signal) => signal?.aborted)) return Promise.reject(this.cancelled());
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        for (const signal of signals) signal?.removeEventListener("abort", abort);
      };
      const fail = (error: LocalCliError): void => {
        const index = this.waiting.indexOf(start);
        if (index < 0) return;
        this.waiting.splice(index, 1);
        cleanup();
        reject(error);
      };
      const abort = (): void => fail(this.cancelled());
      const start = (): void => {
        cleanup();
        this.busy = true;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          const next = this.waiting.shift();
          if (next) next();
          else this.busy = false;
        });
      };
      if (!this.busy) { start(); return; }
      this.waiting.push(start);
      for (const signal of signals) signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => fail(new LocalCliError("cli_timeout", "DocWen process startup queue timed out.", { timeoutMs })), timeoutMs);
    });
  }

  private cancelled(): LocalCliError {
    return new LocalCliError("cli_cancelled", "DocWen process startup was cancelled.");
  }
}
